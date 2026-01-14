// test/integration/async-workflow.test.ts
// Test d'intégration pour le workflow asynchrone RAG
// Version: 1.0.0

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateTaskId, getProgressTracker } from '../../src/core/progress-tracker.js';
import { getTaskQueue } from '../../src/core/task-queue.js';

describe('Workflow Asynchrone RAG', () => {
    let progressTracker: ReturnType<typeof getProgressTracker>;
    let taskQueue: ReturnType<typeof getTaskQueue>;

    beforeEach(() => {
        progressTracker = getProgressTracker();
        taskQueue = getTaskQueue();
    });

    afterEach(() => {
        // Nettoyer après chaque test
        progressTracker['tasks'].clear();
        taskQueue['queues'].clear();
    });

    describe('Workflow complet: index_rag → get_task_status → cancel_task', () => {
        it('devrait exécuter un workflow asynchrone complet', async () => {
            const projectPath = '/test/project';
            const taskId = generateTaskId(projectPath);
            let taskExecuted = false;

            // Simuler une tâche d'indexation
            const indexTask = async () => {
                // Simuler le travail d'indexation
                await new Promise(resolve => setTimeout(resolve, 100));
                taskExecuted = true;
            };

            // Étape 1: Créer la tâche dans le ProgressTracker
            progressTracker.create(taskId, projectPath, 100, {
                mode: 'full',
                workflow: 'test'
            });

            // Étape 2: Ajouter à la file d'attente
            const enqueueResult = await taskQueue.enqueue(
                taskId,
                projectPath,
                indexTask,
                2,
                { type: 'indexing' }
            );

            expect(enqueueResult.queued).toBe(true);
            expect(enqueueResult.position).toBe(1);

            // Étape 3: Vérifier le statut initial
            const initialStatus = progressTracker.get(taskId);
            expect(initialStatus).toBeDefined();
            expect(initialStatus?.state).toBe('queued');
            expect(initialStatus?.step).toBe('init');

            // Étape 4: Démarrer l'exécution
            taskQueue['runNext'](projectPath);

            // Étape 5: Attendre la complétion
            const finalStatus = await taskQueue.waitForCompletion(taskId, 5000);

            expect(finalStatus).toBeDefined();
            expect(finalStatus?.state).toBe('completed');
            expect(finalStatus?.progress).toBe(100);
            expect(taskExecuted).toBe(true);
        }, 10000);

        it('devrait gérer l\'annulation d\'une tâche', async () => {
            const projectPath = '/test/project';
            const taskId = generateTaskId(projectPath);
            let taskStarted = false;
            let taskCancelled = false;

            // Simuler une longue tâche qui peut être annulée
            const longTask = async () => {
                taskStarted = true;
                try {
                    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 secondes
                } catch (error) {
                    taskCancelled = true;
                    throw error;
                }
            };

            // Créer et ajouter la tâche
            progressTracker.create(taskId, projectPath, 100, {});
            await taskQueue.enqueue(taskId, projectPath, longTask, 2);

            // Démarrer l'exécution
            taskQueue['runNext'](projectPath);

            // Attendre que la tâche commence
            await new Promise(resolve => setTimeout(resolve, 100));
            expect(taskStarted).toBe(true);

            // Annuler la tâche
            const cancelResult = taskQueue.cancel(taskId);
            expect(cancelResult).toBe(true);

            // Vérifier le statut
            const status = progressTracker.get(taskId);
            expect(status?.state).toBe('cancelled');
            expect(taskCancelled).toBe(true);
        }, 10000);

        it('devrait gérer les erreurs dans les tâches', async () => {
            const projectPath = '/test/project';
            const taskId = generateTaskId(projectPath);

            // Simuler une tâche qui échoue
            const failingTask = async () => {
                throw new Error('Simulated task failure');
            };

            // Créer et ajouter la tâche
            progressTracker.create(taskId, projectPath, 100, {});
            await taskQueue.enqueue(taskId, projectPath, failingTask, 2);

            // Démarrer l'exécution
            taskQueue['runNext'](projectPath);

            // Attendre la complétion
            const status = await taskQueue.waitForCompletion(taskId, 2000);

            expect(status).toBeDefined();
            expect(status?.state).toBe('failed');
            expect(status?.error).toBeDefined();
            expect(status?.error?.message).toBe('Simulated task failure');
        }, 10000);
    });

    describe('Gestion de file d\'attente par projet', () => {
        it('devrait limiter à 3 tâches par projet', async () => {
            const projectPath = '/test/project';
            const taskFn = async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
            };

            // Ajouter 3 tâches (devraient réussir)
            const results = [];
            for (let i = 1; i <= 3; i++) {
                const taskId = generateTaskId(projectPath);
                progressTracker.create(taskId, projectPath, 100, {});
                results.push(await taskQueue.enqueue(taskId, projectPath, taskFn, 2));
            }

            // La 4ème devrait échouer
            const taskId4 = generateTaskId(projectPath);
            progressTracker.create(taskId4, projectPath, 100, {});
            const result4 = await taskQueue.enqueue(taskId4, projectPath, taskFn, 2);

            expect(results[0].queued).toBe(true);
            expect(results[1].queued).toBe(true);
            expect(results[2].queued).toBe(true);
            expect(result4.queued).toBe(false);
            expect(result4.queueSize).toBe(3);
        });

        it('devrait gérer les files d\'attente séparées pour différents projets', async () => {
            const taskFn = async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
            };

            // Ajouter 3 tâches au projet A
            const projectA = '/project/a';
            const resultsA = [];
            for (let i = 1; i <= 3; i++) {
                const taskId = generateTaskId(projectA);
                progressTracker.create(taskId, projectA, 100, {});
                resultsA.push(await taskQueue.enqueue(taskId, projectA, taskFn, 2));
            }

            // Ajouter 3 tâches au projet B (devrait aussi réussir)
            const projectB = '/project/b';
            const resultsB = [];
            for (let i = 1; i <= 3; i++) {
                const taskId = generateTaskId(projectB);
                progressTracker.create(taskId, projectB, 100, {});
                resultsB.push(await taskQueue.enqueue(taskId, projectB, taskFn, 2));
            }

            expect(resultsA.every(r => r.queued)).toBe(true);
            expect(resultsB.every(r => r.queued)).toBe(true);
        });
    });

    describe('Priorités des tâches', () => {
        it('devrait exécuter les tâches par ordre de priorité', async () => {
            const projectPath = '/test/project';
            const executionOrder: string[] = [];

            // Créer des tâches avec différentes priorités
            const tasks = [
                { id: 'task-low', priority: 5, name: 'low' },
                { id: 'task-high', priority: 1, name: 'high' },
                { id: 'task-medium', priority: 3, name: 'medium' }
            ];

            for (const task of tasks) {
                const taskFn = async () => {
                    executionOrder.push(task.name);
                    await new Promise(resolve => setTimeout(resolve, 50));
                };

                progressTracker.create(task.id, projectPath, 100, {});
                await taskQueue.enqueue(task.id, projectPath, taskFn, task.priority);
            }

            // Démarrer l'exécution
            taskQueue['runNext'](projectPath);

            // Attendre que toutes les tâches soient exécutées
            await new Promise(resolve => setTimeout(resolve, 500));

            // Vérifier l'ordre d'exécution (priorité 1 d'abord, puis 3, puis 5)
            expect(executionOrder).toEqual(['high', 'medium', 'low']);
        }, 10000);
    });

    describe('Statistiques et monitoring', () => {
        it('devrait fournir des statistiques complètes', async () => {
            const projectPath = '/test/project';
            const taskFn = async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
            };

            // Ajouter quelques tâches
            for (let i = 1; i <= 3; i++) {
                const taskId = generateTaskId(projectPath);
                progressTracker.create(taskId, projectPath, 100, {});
                await taskQueue.enqueue(taskId, projectPath, taskFn, 2);
            }

            // Obtenir les statistiques
            const queueStats = taskQueue.getStats();
            const progressStats = progressTracker.getStats();

            expect(queueStats.totalProjects).toBe(1);
            expect(queueStats.totalQueuedTasks).toBe(3);
            expect(queueStats.totalRunningTasks).toBe(0);
            expect(queueStats.byProject[projectPath]).toBeDefined();

            expect(progressStats.totalTasks).toBe(3);
            expect(progressStats.byState.queued).toBe(3);
        });

        it('devrait suivre la progression en temps réel', async () => {
            const projectPath = '/test/project';
            const taskId = generateTaskId(projectPath);
            let progressUpdates = 0;

            // Simuler une tâche avec progression
            const progressiveTask = async () => {
                // Simuler plusieurs étapes avec mise à jour de progression
                for (let i = 1; i <= 10; i++) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                    progressTracker.update(taskId, {
                        filesProcessed: i * 10,
                        progress: i * 10
                    });
                    progressUpdates++;
                }
            };

            // Créer et ajouter la tâche
            progressTracker.create(taskId, projectPath, 100, {});
            await taskQueue.enqueue(taskId, projectPath, progressiveTask, 2);

            // Démarrer l'exécution
            taskQueue['runNext'](projectPath);

            // Surveiller la progression
            let lastProgress = 0;
            const checkInterval = setInterval(() => {
                const status = progressTracker.get(taskId);
                if (status && status.progress > lastProgress) {
                    lastProgress = status.progress;
                }
            }, 50);

            // Attendre la complétion
            await taskQueue.waitForCompletion(taskId, 2000);
            clearInterval(checkInterval);

            expect(lastProgress).toBe(100);
            expect(progressUpdates).toBe(10);
        }, 10000);
    });

    describe('Résilience et reprise', () => {
        it('devrait reprendre après une erreur', async () => {
            const projectPath = '/test/project';
            const executionOrder: string[] = [];

            // Première tâche échoue
            const failingTask = async () => {
                executionOrder.push('failing');
                throw new Error('First task fails');
            };

            // Deuxième tâche réussit
            const succeedingTask = async () => {
                executionOrder.push('succeeding');
                await new Promise(resolve => setTimeout(resolve, 100));
            };

            // Ajouter les deux tâches
            const taskId1 = generateTaskId(projectPath);
            const taskId2 = generateTaskId(projectPath);

            progressTracker.create(taskId1, projectPath, 100, {});
            progressTracker.create(taskId2, projectPath, 100, {});

            await taskQueue.enqueue(taskId1, projectPath, failingTask, 2);
            await taskQueue.enqueue(taskId2, projectPath, succeedingTask, 2);

            // Démarrer l'exécution
            taskQueue['runNext'](projectPath);

            // Attendre que les deux tâches soient traitées
            await new Promise(resolve => setTimeout(resolve, 500));

            expect(executionOrder).toEqual(['failing', 'succeeding']);

            // Vérifier les statuts
            const status1 = progressTracker.get(taskId1);
            const status2 = progressTracker.get(taskId2);

            expect(status1?.state).toBe('failed');
            expect(status2?.state).toBe('completed');
        }, 10000);

        it('devrait nettoyer les anciennes tâches', async () => {
            const projectPath = '/test/project';
            const now = new Date();

            // Créer des tâches terminées anciennes
            for (let i = 0; i < 5; i++) {
                const taskId = `old-task-${i}`;
                progressTracker.create(taskId, projectPath, 100, {});
                progressTracker.update(taskId, {
                    state: 'completed',
                    completedAt: new Date(now.getTime() - (i + 1) * 3600000).toISOString() // 1-5 heures
                });
            }

            // Créer des tâches récentes
            for (let i = 0; i < 5; i++) {
                const taskId = `recent-task-${i}`;
                progressTracker.create(taskId, projectPath, 100, {});
                progressTracker.update(taskId, {
                    state: 'completed',
                    completedAt: new Date().toISOString()
                });
            }

            // Le nettoyage automatique devrait s'être déclenché
            const stats = progressTracker.getStats();
            expect(stats.totalTasks).toBeLessThanOrEqual(1000); // MAX_HISTORY
        });
    });
});
