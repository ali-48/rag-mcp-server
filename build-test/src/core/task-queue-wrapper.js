// src/core/task-queue-wrapper.ts
// Wrapper pour TaskQueue avec émission d'événements
// Version: v1.0.0
// Responsabilités: Étendre TaskQueue avec TaskEventEmitter
import { logger } from './logger.js';
import { getTaskEventEmitter } from './task-event-emitter.js';
import { createIndexTask, TaskQueue } from './task-queue.js';
/**
 * Wrapper pour TaskQueue avec émission d'événements
 */
export class TaskQueueWrapper {
    taskQueue;
    eventEmitter;
    constructor() {
        this.taskQueue = new TaskQueue();
        this.eventEmitter = getTaskEventEmitter({
            logEvents: true,
            enableGatewayRouting: false
        });
        logger.info('task.queue.wrapper.init', 'TaskQueueWrapper initialisé');
    }
    /**
     * Ajoute une tâche à la file d'attente avec émission d'événement
     */
    async enqueue(taskId, projectPath, taskFn, priority = 3, metadata) {
        const startTime = Date.now();
        try {
            // Émettre événement de création de tâche
            await this.eventEmitter.emitTaskCreated(taskId, projectPath, {
                priority,
                metadata,
                timestamp: startTime
            });
            // Ajouter à la file d'attente
            const result = await this.taskQueue.enqueue(taskId, projectPath, taskFn, priority, metadata);
            if (result.queued) {
                // Émettre événement de mise en file d'attente
                await this.eventEmitter.emit('task_created', taskId, projectPath, {
                    queue_position: result.position,
                    queue_size: result.queueSize,
                    priority,
                    metadata
                });
                logger.info('task.queue.wrapper.enqueue.success', 'Tâche ajoutée avec événements', {
                    taskId,
                    projectPath,
                    position: result.position,
                    queueSize: result.queueSize
                });
            }
            else {
                logger.warn('task.queue.wrapper.enqueue.failed', 'Échec d\'ajout à la file d\'attente', {
                    taskId,
                    projectPath,
                    reason: 'queue_full'
                });
            }
            return result;
        }
        catch (error) {
            logger.error('task.queue.wrapper.enqueue.error', 'Erreur lors de l\'ajout à la file d\'attente', {
                taskId,
                projectPath,
                error: error instanceof Error ? error.message : String(error)
            });
            // Émettre événement d'échec
            await this.eventEmitter.emitTaskFailed(taskId, projectPath, error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    /**
     * Exécute la prochaine tâche avec émission d'événements
     */
    async runNextWithEvents(projectPath) {
        const startTime = Date.now();
        try {
            // Note: Cette méthode est appelée par le TaskQueue interne
            // Nous devons intercepter les événements du TaskQueue
            // Pour l'instant, nous nous appuyons sur les événements émis par les autres méthodes
            // Cette méthode sera appelée par le TaskQueue interne
            // Nous émettons des événements dans les méthodes wrapper
        }
        catch (error) {
            logger.error('task.queue.wrapper.run.error', 'Erreur dans runNextWithEvents', {
                projectPath,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    /**
     * Annule une tâche avec émission d'événement
     */
    cancel(taskId, reason) {
        const startTime = Date.now();
        try {
            // Émettre événement d'annulation demandée
            this.eventEmitter.emitTaskCancelled(taskId, 'unknown', reason || 'Annulée par l\'utilisateur');
            // Annuler via TaskQueue
            const cancelled = this.taskQueue.cancel(taskId);
            if (cancelled) {
                logger.info('task.queue.wrapper.cancel.success', 'Tâche annulée avec événements', {
                    taskId,
                    reason,
                    timestamp: startTime
                });
            }
            else {
                logger.warn('task.queue.wrapper.cancel.failed', 'Échec d\'annulation de tâche', {
                    taskId,
                    reason
                });
            }
            return cancelled;
        }
        catch (error) {
            logger.error('task.queue.wrapper.cancel.error', 'Erreur lors de l\'annulation de tâche', {
                taskId,
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }
    /**
     * Émet un événement de début de tâche
     */
    async emitTaskStarted(taskId, projectPath, metadata) {
        await this.eventEmitter.emitTaskStarted(taskId, projectPath, metadata);
    }
    /**
     * Émet un événement de complétion de tâche
     */
    async emitTaskCompleted(taskId, projectPath, result) {
        await this.eventEmitter.emitTaskCompleted(taskId, projectPath, result);
    }
    /**
     * Émet un événement d'échec de tâche
     */
    async emitTaskFailed(taskId, projectPath, error) {
        await this.eventEmitter.emitTaskFailed(taskId, projectPath, error);
    }
    /**
     * Émet un événement de progression de tâche
     */
    async emitTaskProgress(taskId, projectPath, progress, step) {
        await this.eventEmitter.emitTaskProgress(taskId, projectPath, progress, step);
    }
    /**
     * Proxy pour les méthodes du TaskQueue
     */
    list(projectPath) {
        return this.taskQueue.list(projectPath);
    }
    getQueuePosition(taskId) {
        return this.taskQueue.getQueuePosition(taskId);
    }
    getRunningCount(projectPath) {
        return this.taskQueue.getRunningCount(projectPath);
    }
    clear(projectPath) {
        return this.taskQueue.clear(projectPath);
    }
    getStats() {
        return this.taskQueue.getStats();
    }
    isTaskRunning(taskId) {
        return this.taskQueue.isTaskRunning(taskId);
    }
    waitForCompletion(taskId, timeoutMs, pollIntervalMs) {
        return this.taskQueue.waitForCompletion(taskId, timeoutMs, pollIntervalMs);
    }
    /**
     * Configure l'EventEmitter
     */
    configureEventEmitter(options) {
        this.eventEmitter.configure(options);
    }
    /**
     * Retourne l'EventEmitter
     */
    getEventEmitter() {
        return this.eventEmitter;
    }
    /**
     * Crée une tâche d'indexation avec événements
     */
    createIndexTaskWithEvents(taskId, projectPath, indexFn, priority = 2) {
        const task = createIndexTask(taskId, projectPath, indexFn, priority);
        // Ajouter un wrapper à la fonction pour émettre des événements
        const originalRun = task.run;
        task.run = async () => {
            const startTime = Date.now();
            try {
                // Émettre événement de début
                await this.emitTaskStarted(taskId, projectPath, {
                    priority,
                    startTime
                });
                // Exécuter la fonction originale
                await originalRun();
                // Émettre événement de complétion
                await this.emitTaskCompleted(taskId, projectPath, {
                    executionTime: Date.now() - startTime,
                    success: true
                });
            }
            catch (error) {
                // Émettre événement d'échec
                await this.emitTaskFailed(taskId, projectPath, error instanceof Error ? error : new Error(String(error)));
                throw error;
            }
        };
        return task;
    }
}
/**
 * Instance singleton du TaskQueueWrapper
 */
let taskQueueWrapper = null;
/**
 * Obtient l'instance singleton du TaskQueueWrapper
 */
export function getTaskQueueWrapper() {
    if (!taskQueueWrapper) {
        taskQueueWrapper = new TaskQueueWrapper();
        logger.info('task.queue.wrapper.singleton', 'TaskQueueWrapper singleton créé');
    }
    return taskQueueWrapper;
}
/**
 * Teste le TaskQueueWrapper
 */
export async function testTaskQueueWrapper() {
    try {
        const wrapper = getTaskQueueWrapper();
        const testTaskId = `test-wrapper-${Date.now()}`;
        const testProjectPath = '/test/project/wrapper';
        let eventCreated = false;
        let eventCompleted = false;
        // Ajouter des écouteurs d'événements
        const eventEmitter = wrapper.getEventEmitter();
        eventEmitter.on('task_created', (event) => {
            if (event.task_id === testTaskId) {
                eventCreated = true;
                logger.info('task.queue.wrapper.test.event.created', 'Événement de création reçu', {
                    taskId: event.task_id
                });
            }
        });
        eventEmitter.on('task_completed', (event) => {
            if (event.task_id === testTaskId) {
                eventCompleted = true;
                logger.info('task.queue.wrapper.test.event.completed', 'Événement de complétion reçu', {
                    taskId: event.task_id
                });
            }
        });
        // Créer et exécuter une tâche
        const task = wrapper.createIndexTaskWithEvents(testTaskId, testProjectPath, async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
        }, 1);
        // Exécuter la tâche directement
        await task.run();
        // Attendre un peu pour les événements
        await new Promise(resolve => setTimeout(resolve, 200));
        if (!eventCreated) {
            throw new Error('Événement de création non reçu');
        }
        if (!eventCompleted) {
            throw new Error('Événement de complétion non reçu');
        }
        // Nettoyer les écouteurs
        eventEmitter.removeAllListeners();
        logger.info('task.queue.wrapper.test.success', 'Test TaskQueueWrapper réussi');
        return true;
    }
    catch (error) {
        logger.error('task.queue.wrapper.test.failed', 'Test TaskQueueWrapper échoué', {
            error: error instanceof Error ? error.message : String(error)
        });
        return false;
    }
}
// Exécution automatique si ce fichier est exécuté directement
if (typeof require !== 'undefined' && require.main === module) {
    testTaskQueueWrapper().then(success => {
        if (success) {
            logger.info('task.queue.wrapper.test.cli', 'TaskQueueWrapper testé avec succès', {
                success: true,
                message: 'TaskQueueWrapper testé avec succès'
            });
            process.exit(0);
        }
        else {
            logger.error('task.queue.wrapper.test.cli', 'Échec du test TaskQueueWrapper', {
                success: false,
                message: 'Échec du test TaskQueueWrapper'
            });
            process.exit(1);
        }
    });
}
//# sourceMappingURL=task-queue-wrapper.js.map