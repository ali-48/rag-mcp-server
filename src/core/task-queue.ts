// src/core/task-queue.ts
// Système de file d'attente par projet pour les tâches RAG asynchrones
// Version: v1.0.0
// Responsabilités: FIFO par projet, limitation concurrence, gestion annulation

import { logger } from './logger.js';
import { getProgressTracker, ProgressStatus } from './progress-tracker.js';

/**
 * Interface pour une tâche en file d'attente
 */
export interface QueuedTask {
    id: string;
    projectPath: string;
    run: () => Promise<void>;
    priority?: number; // 1 = haute, 5 = basse
    metadata?: Record<string, any>;
    createdAt: Date;
}

/**
 * Interface pour une file d'attente par projet
 */
interface ProjectQueue {
    tasks: QueuedTask[];
    running: boolean;
    projectPath: string;
}

/**
 * Classe principale pour la gestion des files d'attente par projet
 */
export class TaskQueue {
    private queues = new Map<string, ProjectQueue>();
    private readonly MAX_QUEUE_PER_PROJECT = 3;
    private readonly MAX_CONCURRENT_PER_PROJECT = 1;

    /**
     * Ajoute une tâche à la file d'attente d'un projet
     */
    async enqueue(
        taskId: string,
        projectPath: string,
        taskFn: () => Promise<void>,
        priority: number = 3,
        metadata?: Record<string, any>
    ): Promise<{ queued: boolean; position: number; queueSize: number }> {
        // Vérifier si la file d'attente existe pour ce projet
        let queue = this.queues.get(projectPath);
        if (!queue) {
            queue = {
                tasks: [],
                running: false,
                projectPath
            };
            this.queues.set(projectPath, queue);
        }

        // Vérifier la limite de file d'attente
        if (queue.tasks.length >= this.MAX_QUEUE_PER_PROJECT) {
            logger.warn('task.queue.full', `File d'attente pleine pour le projet: ${projectPath}`, {
                projectPath,
                currentSize: queue.tasks.length,
                maxSize: this.MAX_QUEUE_PER_PROJECT,
                taskId
            });

            return {
                queued: false,
                position: -1,
                queueSize: queue.tasks.length
            };
        }

        // Créer la tâche
        const task: QueuedTask = {
            id: taskId,
            projectPath,
            run: taskFn,
            priority,
            metadata,
            createdAt: new Date()
        };

        // Ajouter à la file d'attente avec priorité
        this.insertWithPriority(queue.tasks, task);

        const position = queue.tasks.findIndex(t => t.id === taskId) + 1;

        logger.info('task.queue.enqueue', `Tâche ajoutée à la file d'attente: ${taskId}`, {
            taskId,
            projectPath,
            position,
            queueSize: queue.tasks.length,
            priority
        });

        // Créer une entrée dans le ProgressTracker si elle n'existe pas
        const progressTracker = getProgressTracker();
        if (!progressTracker.get(taskId)) {
            progressTracker.create(taskId, projectPath, 0, {
                type: 'task_queue',
                priority,
                ...metadata
            });
        }

        // Démarrer l'exécution si possible (de manière asynchrone)
        setTimeout(() => this.runNext(projectPath), 0);

        return {
            queued: true,
            position,
            queueSize: queue.tasks.length
        };
    }

    /**
     * Insère une tâche avec priorité (tri par priorité, puis date)
     */
    private insertWithPriority(tasks: QueuedTask[], task: QueuedTask): void {
        let insertIndex = 0;

        // Trouver la position basée sur la priorité (1 = haute, 5 = basse)
        for (let i = 0; i < tasks.length; i++) {
            const currentTask = tasks[i];
            const currentPriority = currentTask.priority || 3;
            const taskPriority = task.priority || 3;

            if (currentPriority > taskPriority) {
                // Priorité actuelle plus basse que la nouvelle tâche
                // Insérer avant (la nouvelle tâche a priorité plus haute)
                insertIndex = i;
                break;
            } else if (currentPriority === taskPriority) {
                // Même priorité = insérer avant les plus anciennes
                if (currentTask.createdAt > task.createdAt) {
                    insertIndex = i;
                    break;
                }
            }
            // Si la priorité actuelle est plus haute, on continue
            insertIndex = i + 1;
        }

        tasks.splice(insertIndex, 0, task);
    }

    /**
     * Exécute la prochaine tâche dans la file d'attente d'un projet
     */
    private async runNext(projectPath: string): Promise<void> {
        const queue = this.queues.get(projectPath);
        if (!queue || queue.running || queue.tasks.length === 0) {
            return;
        }

        // Vérifier la limite concurrente
        if (this.getRunningCount(projectPath) >= this.MAX_CONCURRENT_PER_PROJECT) {
            return;
        }

        queue.running = true;
        const task = queue.tasks.shift()!;

        logger.info('task.queue.start', `Début d'exécution de la tâche: ${task.id}`, {
            taskId: task.id,
            projectPath,
            remainingTasks: queue.tasks.length,
            priority: task.priority
        });

        try {
            // Mettre à jour le statut de progression
            const progressTracker = getProgressTracker();
            progressTracker.update(task.id, {
                state: 'running',
                step: 'execution',
                currentOperation: 'task_execution'
            });

            // Exécuter la tâche
            await task.run();

            logger.info('task.queue.complete', `Tâche terminée avec succès: ${task.id}`, {
                taskId: task.id,
                projectPath,
                executionTime: new Date().getTime() - task.createdAt.getTime()
            });

            // Mettre à jour le statut de progression
            progressTracker.update(task.id, {
                state: 'completed',
                progress: 100,
                completedAt: new Date().toISOString()
            });

        } catch (error) {
            logger.error('task.queue.error', `Erreur lors de l'exécution de la tâche: ${task.id}`, {
                taskId: task.id,
                projectPath,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });

            // Mettre à jour le statut de progression
            const progressTracker = getProgressTracker();
            progressTracker.fail(task.id, error instanceof Error ? error : new Error(String(error)), 'task_execution');

        } finally {
            queue.running = false;

            // Exécuter la prochaine tâche
            setTimeout(() => this.runNext(projectPath), 0);
        }
    }

    /**
     * Annule une tâche spécifique
     */
    cancel(taskId: string): boolean {
        let cancelled = false;

        for (const [projectPath, queue] of this.queues.entries()) {
            const taskIndex = queue.tasks.findIndex(t => t.id === taskId);
            if (taskIndex !== -1) {
                // Tâche trouvée dans la file d'attente
                queue.tasks.splice(taskIndex, 1);
                cancelled = true;

                logger.info('task.queue.cancel.queued', `Tâche annulée dans la file d'attente: ${taskId}`, {
                    taskId,
                    projectPath,
                    wasRunning: false
                });

                break;
            }
        }

        // Si la tâche n'était pas dans la file d'attente, elle pourrait être en cours d'exécution
        // Dans ce cas, on ne peut pas l'annuler directement, mais on peut marquer son statut
        if (!cancelled) {
            const progressTracker = getProgressTracker();
            cancelled = progressTracker.cancel(taskId, 'Annulée par l\'utilisateur');

            if (cancelled) {
                logger.info('task.queue.cancel.running', `Tâche en cours d'exécution marquée comme annulée: ${taskId}`, {
                    taskId,
                    wasRunning: true
                });
            }
        }

        return cancelled;
    }

    /**
     * Liste toutes les tâches d'un projet
     */
    list(projectPath: string): {
        queued: QueuedTask[];
        running: boolean;
        queueSize: number;
        maxSize: number;
    } {
        const queue = this.queues.get(projectPath);
        if (!queue) {
            return {
                queued: [],
                running: false,
                queueSize: 0,
                maxSize: this.MAX_QUEUE_PER_PROJECT
            };
        }

        return {
            queued: [...queue.tasks], // Copie
            running: queue.running,
            queueSize: queue.tasks.length,
            maxSize: this.MAX_QUEUE_PER_PROJECT
        };
    }

    /**
     * Obtient la position d'une tâche dans la file d'attente
     */
    getQueuePosition(taskId: string): { position: number; total: number; projectPath?: string } | null {
        for (const [projectPath, queue] of this.queues.entries()) {
            const position = queue.tasks.findIndex(t => t.id === taskId);
            if (position !== -1) {
                return {
                    position: position + 1,
                    total: queue.tasks.length,
                    projectPath
                };
            }
        }

        return null;
    }

    /**
     * Obtient le nombre de tâches en cours d'exécution pour un projet
     */
    getRunningCount(projectPath: string): number {
        const queue = this.queues.get(projectPath);
        if (!queue) {
            return 0;
        }

        return queue.running ? 1 : 0;
    }

    /**
     * Vide la file d'attente d'un projet
     */
    clear(projectPath: string): number {
        const queue = this.queues.get(projectPath);
        if (!queue) {
            return 0;
        }

        const clearedCount = queue.tasks.length;
        queue.tasks = [];

        logger.info('task.queue.clear', `File d'attente vidée pour le projet: ${projectPath}`, {
            projectPath,
            clearedCount
        });

        return clearedCount;
    }

    /**
     * Obtient les statistiques globales
     */
    getStats(): {
        totalProjects: number;
        totalQueuedTasks: number;
        totalRunningTasks: number;
        byProject: Record<string, {
            queued: number;
            running: boolean;
            maxSize: number;
        }>;
    } {
        const byProject: Record<string, { queued: number; running: boolean; maxSize: number }> = {};
        let totalQueuedTasks = 0;
        let totalRunningTasks = 0;

        for (const [projectPath, queue] of this.queues.entries()) {
            byProject[projectPath] = {
                queued: queue.tasks.length,
                running: queue.running,
                maxSize: this.MAX_QUEUE_PER_PROJECT
            };

            totalQueuedTasks += queue.tasks.length;
            if (queue.running) {
                totalRunningTasks++;
            }
        }

        return {
            totalProjects: this.queues.size,
            totalQueuedTasks,
            totalRunningTasks,
            byProject
        };
    }

    /**
     * Vérifie si une tâche est en cours d'exécution
     */
    isTaskRunning(taskId: string): boolean {
        const progressTracker = getProgressTracker();
        const status = progressTracker.get(taskId);

        return status?.state === 'running' || false;
    }

    /**
     * Attend la complétion d'une tâche (timeout optionnel)
     */
    async waitForCompletion(
        taskId: string,
        timeoutMs: number = 30000,
        pollIntervalMs: number = 500
    ): Promise<ProgressStatus | null> {
        const startTime = Date.now();
        const progressTracker = getProgressTracker();

        while (Date.now() - startTime < timeoutMs) {
            const status = progressTracker.get(taskId);

            if (!status) {
                // Tâche non trouvée
                return null;
            }

            if (status.state === 'completed' || status.state === 'failed' || status.state === 'cancelled') {
                // Tâche terminée
                return status;
            }

            // Attendre avant de vérifier à nouveau
            await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        }

        // Timeout
        logger.warn('task.queue.wait.timeout', `Timeout d'attente pour la tâche: ${taskId}`, {
            taskId,
            timeoutMs
        });

        // Retourner null pour indiquer un timeout (la tâche est toujours en cours)
        return null;
    }
}

/**
 * Instance singleton du TaskQueue
 */
let taskQueue: TaskQueue | null = null;

/**
 * Obtient l'instance singleton du TaskQueue
 */
export function getTaskQueue(): TaskQueue {
    if (!taskQueue) {
        taskQueue = new TaskQueue();
        logger.info('task.queue.init', 'TaskQueue initialisé');
    }
    return taskQueue;
}

/**
 * Fonction utilitaire pour créer une tâche d'indexation
 */
export function createIndexTask(
    taskId: string,
    projectPath: string,
    indexFn: () => Promise<void>,
    priority: number = 2
): QueuedTask {
    return {
        id: taskId,
        projectPath,
        run: indexFn,
        priority,
        metadata: {
            type: 'indexing',
            createdAt: new Date().toISOString()
        },
        createdAt: new Date()
    };
}

/**
 * Teste le TaskQueue
 */
export async function testTaskQueue(): Promise<boolean> {
    try {
        const queue = getTaskQueue();
        const testTaskId = `test-${Date.now()}`;
        const testProjectPath = '/test/project';

        let taskExecuted = false;

        // Test d'ajout à la file d'attente
        const enqueueResult = await queue.enqueue(
            testTaskId,
            testProjectPath,
            async () => {
                taskExecuted = true;
                await new Promise(resolve => setTimeout(resolve, 100));
            },
            1
        );

        if (!enqueueResult.queued || enqueueResult.position !== 1) {
            throw new Error('Échec de l\'ajout à la file d\'attente');
        }

        // Attendre l'exécution
        await new Promise(resolve => setTimeout(resolve, 500));

        if (!taskExecuted) {
            throw new Error('La tâche n\'a pas été exécutée');
        }

        // Test de listing
        const listResult = queue.list(testProjectPath);
        if (listResult.queueSize !== 0) {
            throw new Error('La file d\'attente devrait être vide après exécution');
        }

        logger.info('task.queue.test.success', 'Test TaskQueue réussi');
        return true;

    } catch (error) {
        logger.error('task.queue.test.failed', 'Test TaskQueue échoué', {
            error: error instanceof Error ? error.message : String(error)
        });
        return false;
    }
}

// Exécution automatique si ce fichier est exécuté directement
if (typeof require !== 'undefined' && require.main === module) {
    testTaskQueue().then(success => {
        if (success) {
            console.log(JSON.stringify({
                success: true,
                message: 'TaskQueue testé avec succès'
            }, null, 2));
            process.exit(0);
        } else {
            console.error(JSON.stringify({
                success: false,
                message: 'Échec du test TaskQueue'
            }, null, 2));
            process.exit(1);
        }
    });
}
