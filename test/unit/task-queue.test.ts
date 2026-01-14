// test/unit/task-queue.test.ts
// Tests unitaires pour TaskQueue
// Version: 1.0.0

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TaskQueue, type QueuedTask } from '../../src/core/task-queue.js';

describe('TaskQueue', () => {
    let taskQueue: TaskQueue;

    beforeEach(() => {
        taskQueue = new TaskQueue();
    });

    afterEach(() => {
        // Nettoyer après chaque test
        taskQueue['queues'].clear();
    });

    describe('enqueue()', () => {
        it('devrait ajouter une tâche à la file d\'attente d\'un projet', async () => {
            const taskId = 'test-task-123';
            const projectPath = '/test/project';
            const taskFn = async () => { console.log('Task executed'); };

            const result = await taskQueue.enqueue(taskId, projectPath, taskFn, 2);

            expect(result.queued).toBe(true);
            expect(result.position).toBe(1);
            expect(result.queueSize).toBe(1);
        });

        it('devrait respecter la limite de 3 tâches par projet', async () => {
            const projectPath = '/test/project';
            const taskFn = async () => { console.log('Task executed'); };

            // Ajouter 3 tâches
            const results = [];
            for (let i = 1; i <= 3; i++) {
                results.push(await taskQueue.enqueue(`task-${i}`, projectPath, taskFn, 2));
            }

            // La 4ème devrait être rejetée
            const result4 = await taskQueue.enqueue('task-4', projectPath, taskFn, 2);

            expect(results[0].queued).toBe(true);
            expect(results[0].position).toBe(1);
            expect(results[1].queued).toBe(true);
            expect(results[1].position).toBe(2);
            expect(results[2].queued).toBe(true);
            expect(results[2].position).toBe(3);
            expect(result4.queued).toBe(false);
            expect(result4.queueSize).toBe(3);
        });

        it('devrait gérer les files d\'attente séparées pour différents projets', async () => {
            const taskFn = async () => { console.log('Task executed'); };

            // Ajouter 2 tâches au projet A
            const resultA1 = await taskQueue.enqueue('task-a1', '/project/a', taskFn, 2);
            const resultA2 = await taskQueue.enqueue('task-a2', '/project/a', taskFn, 2);

            // Ajouter 2 tâches au projet B
            const resultB1 = await taskQueue.enqueue('task-b1', '/project/b', taskFn, 2);
            const resultB2 = await taskQueue.enqueue('task-b2', '/project/b', taskFn, 2);

            expect(resultA1.queued).toBe(true);
            expect(resultA1.position).toBe(1);
            expect(resultA1.queueSize).toBe(1);

            expect(resultA2.queued).toBe(true);
            expect(resultA2.position).toBe(2);
            expect(resultA2.queueSize).toBe(2);

            expect(resultB1.queued).toBe(true);
            expect(resultB1.position).toBe(1);
            expect(resultB1.queueSize).toBe(1);

            expect(resultB2.queued).toBe(true);
            expect(resultB2.position).toBe(2);
            expect(resultB2.queueSize).toBe(2);
        });

        it('devrait respecter les priorités (1 = haute, 5 = basse)', async () => {
            const projectPath = '/test/project';
            const taskFn = async () => { console.log('Task executed'); };

            // Ajouter des tâches avec différentes priorités
            await taskQueue.enqueue('task-low', projectPath, taskFn, 5); // Basse priorité
            await taskQueue.enqueue('task-high', projectPath, taskFn, 1); // Haute priorité
            await taskQueue.enqueue('task-medium', projectPath, taskFn, 3); // Priorité moyenne

            const queueResult = taskQueue.list(projectPath);
            expect(queueResult.queued).toHaveLength(3);

            // Vérifier l'ordre par priorité (plus petit nombre = plus haute priorité)
            expect(queueResult.queued[0].id).toBe('task-high'); // Priorité 1 d'abord
            expect(queueResult.queued[0].priority).toBe(1);
            expect(queueResult.queued[1].id).toBe('task-medium'); // Priorité 3 ensuite
            expect(queueResult.queued[1].priority).toBe(3);
            expect(queueResult.queued[2].id).toBe('task-low'); // Priorité 5 en dernier
            expect(queueResult.queued[2].priority).toBe(5);
        });
    });

    describe('cancel()', () => {
        it('devrait annuler une tâche dans la file d\'attente', async () => {
            const taskId = 'test-task-123';
            const projectPath = '/test/project';
            const taskFn = async () => { console.log('Task executed'); };

            await taskQueue.enqueue(taskId, projectPath, taskFn, 2);

            const cancelResult = taskQueue.cancel(taskId);
            expect(cancelResult).toBe(true);

            const queueResult = taskQueue.list(projectPath);
            expect(queueResult.queued).toHaveLength(0);
        });

        it('devrait retourner false si la tâche n\'existe pas', () => {
            const cancelResult = taskQueue.cancel('non-existent-task');
            expect(cancelResult).toBe(false);
        });

        it('devrait retourner true si la tâche est déjà en cours d\'exécution (marquée comme annulée dans le tracker)', async () => {
            const taskId = 'test-task-123';
            const projectPath = '/test/project';
            const taskFn = async () => {
                await new Promise(resolve => setTimeout(resolve, 1000));
            };

            await taskQueue.enqueue(taskId, projectPath, taskFn, 2);

            // Démarrer l'exécution
            taskQueue['runNext'](projectPath);

            // Attendre un peu pour que la tâche soit en cours d'exécution
            await new Promise(resolve => setTimeout(resolve, 100));

            const cancelResult = taskQueue.cancel(taskId);
            expect(cancelResult).toBe(true); // Peut marquer une tâche en cours d'exécution comme annulée
        });
    });

    describe('list()', () => {
        it('devrait lister toutes les tâches d\'un projet', async () => {
            const projectPath = '/test/project';
            const taskFn = async () => { console.log('Task executed'); };

            await taskQueue.enqueue('task-1', projectPath, taskFn, 2);
            await taskQueue.enqueue('task-2', projectPath, taskFn, 3);
            await taskQueue.enqueue('task-3', projectPath, taskFn, 1);

            const queueResult = taskQueue.list(projectPath);

            expect(queueResult.queued).toHaveLength(3);
            expect(queueResult.queued.map((t: QueuedTask) => t.id)).toEqual(['task-3', 'task-1', 'task-2']); // Trié par priorité
            expect(queueResult.queued[0].priority).toBe(1);
            expect(queueResult.queued[1].priority).toBe(2);
            expect(queueResult.queued[2].priority).toBe(3);
            expect(queueResult.queued[0].projectPath).toBe(projectPath);
        });

        it('devrait retourner un tableau vide si le projet n\'a pas de file d\'attente', () => {
            const queueResult = taskQueue.list('/non-existent/project');
            expect(queueResult.queued).toEqual([]);
        });
    });

    describe('getQueuePosition()', () => {
        it('devrait retourner la position d\'une tâche dans la file d\'attente', async () => {
            const projectPath = '/test/project';
            const taskFn = async () => { console.log('Task executed'); };

            await taskQueue.enqueue('task-1', projectPath, taskFn, 2);
            await taskQueue.enqueue('task-2', projectPath, taskFn, 3);
            await taskQueue.enqueue('task-3', projectPath, taskFn, 1);

            const position1 = taskQueue.getQueuePosition('task-1');
            const position2 = taskQueue.getQueuePosition('task-2');
            const position3 = taskQueue.getQueuePosition('task-3');

            expect(position1?.position).toBe(2); // task-1 est en position 2 (après task-3)
            expect(position2?.position).toBe(3); // task-2 est en position 3
            expect(position3?.position).toBe(1); // task-3 est en position 1 (priorité 1)
        });

        it('devrait retourner null si la tâche n\'existe pas', () => {
            const position = taskQueue.getQueuePosition('non-existent-task');
            expect(position).toBeNull();
        });

        it('devrait retourner 0 si la tâche est en cours d\'exécution', async () => {
            const taskId = 'test-task-123';
            const projectPath = '/test/project';
            const taskFn = async () => {
                await new Promise(resolve => setTimeout(resolve, 1000));
            };

            await taskQueue.enqueue(taskId, projectPath, taskFn, 2);

            // Démarrer l'exécution
            taskQueue['runNext'](projectPath);

            // Attendre un peu pour que la tâche soit en cours d'exécution
            await new Promise(resolve => setTimeout(resolve, 100));

            const position = taskQueue.getQueuePosition(taskId);
            expect(position).toBeNull(); // La tâche n'est plus dans la file d'attente si elle est en cours d'exécution
        });
    });

    describe('waitForCompletion()', () => {
        it('devrait attendre la complétion d\'une tâche', async () => {
            const taskId = 'test-task-123';
            const projectPath = '/test/project';
            let executed = false;

            const taskFn = async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
                executed = true;
            };

            await taskQueue.enqueue(taskId, projectPath, taskFn, 2);

            // Laisser le système démarrer l'exécution automatiquement via setTimeout
            // Attendre un peu pour que la tâche soit prise en charge
            await new Promise(resolve => setTimeout(resolve, 50));

            const result = await taskQueue.waitForCompletion(taskId, 5000);

            expect(executed).toBe(true);
            expect(result).toBeDefined();
            expect(result?.state).toBe('completed');
        }, 10000);

        it('devrait timeout si la tâche prend trop de temps', async () => {
            const taskId = `test-task-${Date.now()}`;
            const projectPath = '/test/project';

            const taskFn = async () => {
                await new Promise(resolve => setTimeout(resolve, 10000)); // 10 secondes
            };

            await taskQueue.enqueue(taskId, projectPath, taskFn, 2);

            // Ne pas démarrer manuellement, laisser le système démarrer via setTimeout
            // Attendre un peu pour que la tâche soit prise en charge
            await new Promise(resolve => setTimeout(resolve, 50));

            const result = await taskQueue.waitForCompletion(taskId, 100); // Timeout de 100ms

            expect(result).toBeNull(); // Timeout, résultat null
        }, 15000);

        it('devrait retourner null si la tâche n\'existe pas', async () => {
            const result = await taskQueue.waitForCompletion('non-existent-task', 1000);
            expect(result).toBeNull();
        });
    });

    describe('Exécution automatique', () => {
        it('devrait exécuter automatiquement la prochaine tâche quand une se termine', async () => {
            const projectPath = '/test/project';
            const executionOrder: string[] = [];

            const taskFn1 = async () => {
                executionOrder.push('task-1');
                await new Promise(resolve => setTimeout(resolve, 100));
            };

            const taskFn2 = async () => {
                executionOrder.push('task-2');
                await new Promise(resolve => setTimeout(resolve, 100));
            };

            const taskFn3 = async () => {
                executionOrder.push('task-3');
                await new Promise(resolve => setTimeout(resolve, 100));
            };

            // Ajouter 3 tâches
            await taskQueue.enqueue('task-1', projectPath, taskFn1, 2);
            await taskQueue.enqueue('task-2', projectPath, taskFn2, 2);
            await taskQueue.enqueue('task-3', projectPath, taskFn3, 2);

            // Démarrer la première tâche
            taskQueue['runNext'](projectPath);

            // Attendre que toutes les tâches soient exécutées
            await new Promise(resolve => setTimeout(resolve, 500));

            expect(executionOrder).toEqual(['task-1', 'task-2', 'task-3']);
        }, 10000);

        it('devrait respecter la limite d\'une tâche active par projet', async () => {
            const projectPath = '/test/project';
            let activeTasks = 0;
            let maxConcurrent = 0;

            const taskFn = async () => {
                activeTasks++;
                maxConcurrent = Math.max(maxConcurrent, activeTasks);
                await new Promise(resolve => setTimeout(resolve, 200));
                activeTasks--;
            };

            // Ajouter 3 tâches
            await taskQueue.enqueue('task-1', projectPath, taskFn, 2);
            await taskQueue.enqueue('task-2', projectPath, taskFn, 2);
            await taskQueue.enqueue('task-3', projectPath, taskFn, 2);

            // Démarrer l'exécution
            taskQueue['runNext'](projectPath);

            // Attendre que toutes les tâches soient exécutées
            await new Promise(resolve => setTimeout(resolve, 1000));

            expect(maxConcurrent).toBe(1); // Une seule tâche active à la fois
        }, 10000);
    });

    describe('Gestion des erreurs', () => {
        it('devrait gérer les erreurs dans les tâches sans bloquer la file', async () => {
            const projectPath = '/test/project';
            let errorTaskExecuted = false;
            let nextTaskExecuted = false;

            const errorTaskFn = async () => {
                errorTaskExecuted = true;
                throw new Error('Task failed');
            };

            const nextTaskFn = async () => {
                nextTaskExecuted = true;
            };

            await taskQueue.enqueue('error-task', projectPath, errorTaskFn, 2);
            await taskQueue.enqueue('next-task', projectPath, nextTaskFn, 2);

            // Démarrer l'exécution
            taskQueue['runNext'](projectPath);

            // Attendre que les tâches soient exécutées
            await new Promise(resolve => setTimeout(resolve, 500));

            expect(errorTaskExecuted).toBe(true);
            expect(nextTaskExecuted).toBe(true); // La tâche suivante devrait s'exécuter
        }, 10000);

        it('devrait marquer les tâches comme échouées en cas d\'erreur', async () => {
            const taskId = 'error-task';
            const projectPath = '/test/project';

            const errorTaskFn = async () => {
                throw new Error('Task failed');
            };

            await taskQueue.enqueue(taskId, projectPath, errorTaskFn, 2);

            // Démarrer l'exécution
            taskQueue['runNext'](projectPath);

            // Attendre que la tâche soit exécutée
            await new Promise(resolve => setTimeout(resolve, 100));

            const queueResult = taskQueue.list(projectPath);
            expect(queueResult.queued).toHaveLength(0); // La tâche devrait être retirée de la file
        }, 10000);
    });

    describe('Statistiques', () => {
        it('devrait retourner les statistiques de la file d\'attente', async () => {
            const projectPath = '/test/project';
            const taskFn = async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
            };

            // Ajouter des tâches
            await taskQueue.enqueue('task-1', projectPath, taskFn, 1);
            await taskQueue.enqueue('task-2', projectPath, taskFn, 2);
            await taskQueue.enqueue('task-3', projectPath, taskFn, 3);

            const stats = taskQueue.getStats();

            expect(stats.totalProjects).toBe(1);
            expect(stats.totalQueuedTasks).toBe(3);
            expect(stats.totalRunningTasks).toBe(0);
            expect(stats.byProject[projectPath]).toBeDefined();
            expect(stats.byProject[projectPath].queued).toBe(3);
            expect(stats.byProject[projectPath].running).toBe(false);
        });

        it('devrait mettre à jour les statistiques après exécution', async () => {
            const projectPath = '/test/project';
            const taskFn = async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
            };

            await taskQueue.enqueue('task-1', projectPath, taskFn, 2);

            // Démarrer l'exécution
            taskQueue['runNext'](projectPath);

            // Attendre un peu
            await new Promise(resolve => setTimeout(resolve, 200));

            const stats = taskQueue.getStats();
            expect(stats.totalQueuedTasks).toBe(0);
            expect(stats.totalRunningTasks).toBe(0);
        });
    });
});
