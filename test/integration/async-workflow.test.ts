// test/integration/async-workflow.test.ts
// Tests d'intégration pour le workflow RAG asynchrone complet
// Teste: init → scan → get_status → prepare → embed → index → query

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isRagInitialized } from '../../src/rag/phase0/rag-state.js';
import { createRagJob, getTaskStatus } from '../../src/rag/queue/job-types.js';
import { getRagQueue } from '../../src/rag/queue/rag-queue.js';
import { StateManager } from '../../src/rag/state-manager.js';
import { getStatusHandler } from '../../src/tools/rag/get-status.js';
import { embedRagHandler, indexRagHandler, prepareRagHandler } from '../../src/tools/rag/index-rag.js';
import { initRagHandler } from '../../src/tools/rag/init-rag.js';
import { queryRagHandler } from '../../src/tools/rag/query-rag.js';
import { scanRagHandler } from '../../src/tools/rag/scan-rag.js';

// Mock des dépendances
vi.mock('../../src/rag/phase0/rag-state.js', () => ({
    isRagInitialized: vi.fn()
}));

vi.mock('../../src/rag/queue/job-types.js', () => ({
    createRagJob: vi.fn(),
    getTaskStatus: vi.fn()
}));

vi.mock('../../src/rag/queue/rag-queue.js', () => ({
    getRagQueue: vi.fn()
}));

vi.mock('../../src/rag/state-manager.js', () => ({
    StateManager: {
        getInstance: vi.fn()
    }
}));

vi.mock('../../src/core/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

describe('Tests d\'intégration pour le workflow RAG asynchrone complet', () => {
    const TEST_PROJECT_PATH = '/test/project/path';
    let mockRagQueue: any;
    let mockStateManager: any;
    let jobCounter = 0;

    beforeEach(() => {
        vi.clearAllMocks();
        jobCounter = 0;

        // Mock de la file d'attente RAG
        mockRagQueue = {
            enqueue: vi.fn(),
            getGlobalStatus: vi.fn(),
            getJob: vi.fn()
        };
        (getRagQueue as any).mockReturnValue(mockRagQueue);

        // Mock du StateManager
        mockStateManager = {
            getProjectStatus: vi.fn(),
            updateProjectStatus: vi.fn()
        };
        (StateManager.getInstance as any).mockReturnValue(mockStateManager);

        // Par défaut, le projet n'est pas initialisé
        (isRagInitialized as any).mockResolvedValue(false);

        // Mock pour créer des jobs avec des IDs uniques
        (createRagJob as any).mockImplementation((type: string, projectPath: string, options?: any) => {
            jobCounter++;
            return {
                id: `test-job-${jobCounter}`,
                type,
                projectPath,
                metadata: options?.metadata || {}
            };
        });

        // Mock pour l'enqueue (toujours réussi)
        mockRagQueue.enqueue.mockResolvedValue({
            queued: true,
            position: 1,
            message: 'Job ajouté à la file'
        });

        // Mock pour getGlobalStatus
        mockRagQueue.getGlobalStatus.mockReturnValue({
            status: 'ok',
            rag_state: {
                total_projects: 1,
                active_jobs: 0,
                queued_jobs: 0
            },
            notes_for_ai: ['Système opérationnel']
        });

        // Mock pour getJob (retourne un job basé sur l'ID)
        mockRagQueue.getJob.mockImplementation((jobId: string) => {
            const jobNumber = parseInt(jobId.split('-')[2]);
            return {
                id: jobId,
                type: ['init', 'scan', 'prepare', 'embed', 'index'][jobNumber - 1] || 'unknown',
                projectPath: TEST_PROJECT_PATH,
                status: 'completed'
            };
        });

        // Mock pour getTaskStatus
        (getTaskStatus as any).mockImplementation((job: any) => {
            return {
                task_id: job.id,
                action: `${job.type}_rag`,
                state: 'completed',
                progress: { percent: 100 },
                notes_for_ai: [`Tâche ${job.type} terminée`],
                allowed_actions: ['get_status', 'query_rag'],
                required_action: undefined
            };
        });

        // Mock pour getProjectStatus
        mockStateManager.getProjectStatus.mockResolvedValue({
            project_id: TEST_PROJECT_PATH,
            status: 'ok',
            pipeline: {
                init_rag: 'done',
                scan_rag: 'done',
                prepare_rag: 'done',
                embed_rag: 'done',
                index_rag: 'done'
            },
            notes_for_ai: ['Projet complètement indexé'],
            allowed_actions: ['query_rag', 'get_status'],
            required_action: undefined
        });
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Workflow complet: init → scan → get_status → prepare → embed → index → query', () => {
        it('devrait exécuter le workflow RAG complet de manière asynchrone', async () => {
            // Étape 1: Initialisation du projet
            console.log('🚀 Étape 1: Initialisation du projet');
            const initArgs = {
                project_path: TEST_PROJECT_PATH,
                mode: 'default'
            };

            const initResult = await initRagHandler(initArgs);
            const initResponse = JSON.parse(initResult.content[0].text);

            expect(initResponse.status).toBe('ok');
            expect(initResponse.message).toContain('initialisé');
            console.log(`✅ Projet initialisé: ${initResponse.message}`);

            // Après init, le projet est considéré comme initialisé
            (isRagInitialized as any).mockResolvedValue(true);

            // Étape 2: Scan du projet
            console.log('🔍 Étape 2: Scan du projet');
            const scanArgs = {
                project_path: TEST_PROJECT_PATH,
                enable_workspace_detection: true
            };

            const scanResult = await scanRagHandler(scanArgs);
            const scanResponse = JSON.parse(scanResult.content[0].text);

            expect(scanResponse.status).toBe('accepted');
            expect(scanResponse.task_id).toBe('test-job-1');
            expect(scanResponse.action).toBe('scan_rag');
            console.log(`✅ Scan démarré: task_id=${scanResponse.task_id}`);

            // Étape 3: Vérification du statut du scan
            console.log('📊 Étape 3: Vérification du statut du scan');
            const statusArgs1 = {
                scope: 'task',
                task_id: 'test-job-1'
            };

            const statusResult1 = await getStatusHandler(statusArgs1);
            const statusResponse1 = JSON.parse(statusResult1.content[0].text);

            expect(statusResponse1.status).toBe('ok');
            expect(statusResponse1.scope).toBe('task');
            expect(statusResponse1.data.task_id).toBe('test-job-1');
            expect(statusResponse1.data.state).toBe('completed');
            console.log(`✅ Statut scan vérifié: ${statusResponse1.data.state}`);

            // Étape 4: Préparation des chunks
            console.log('✂️ Étape 4: Préparation des chunks');
            const prepareArgs = {
                project_path: TEST_PROJECT_PATH,
                chunking_strategy: 'logical'
            };

            const prepareResult = await prepareRagHandler(prepareArgs);
            const prepareResponse = JSON.parse(prepareResult.content[0].text);

            expect(prepareResponse.status).toBe('accepted');
            expect(prepareResponse.task_id).toBe('test-job-2');
            expect(prepareResponse.action).toBe('prepare_rag');
            console.log(`✅ Préparation démarrée: task_id=${prepareResponse.task_id}`);

            // Étape 5: Vérification du statut de la préparation
            console.log('📊 Étape 5: Vérification du statut de la préparation');
            const statusArgs2 = {
                scope: 'task',
                task_id: 'test-job-2'
            };

            const statusResult2 = await getStatusHandler(statusArgs2);
            const statusResponse2 = JSON.parse(statusResult2.content[0].text);

            expect(statusResponse2.status).toBe('ok');
            expect(statusResponse2.data.state).toBe('completed');
            console.log(`✅ Statut préparation vérifié: ${statusResponse2.data.state}`);

            // Étape 6: Embedding
            console.log('🧠 Étape 6: Embedding');
            const embedArgs = {
                project_path: TEST_PROJECT_PATH,
                embedding_model: 'nomic-embed-text'
            };

            const embedResult = await embedRagHandler(embedArgs);
            const embedResponse = JSON.parse(embedResult.content[0].text);

            expect(embedResponse.status).toBe('accepted');
            expect(embedResponse.task_id).toBe('test-job-3');
            expect(embedResponse.action).toBe('embed_rag');
            console.log(`✅ Embedding démarré: task_id=${embedResponse.task_id}`);

            // Étape 7: Vérification du statut de l'embedding
            console.log('📊 Étape 7: Vérification du statut de l\'embedding');
            const statusArgs3 = {
                scope: 'task',
                task_id: 'test-job-3'
            };

            const statusResult3 = await getStatusHandler(statusArgs3);
            const statusResponse3 = JSON.parse(statusResult3.content[0].text);

            expect(statusResponse3.status).toBe('ok');
            expect(statusResponse3.data.state).toBe('completed');
            console.log(`✅ Statut embedding vérifié: ${statusResponse3.data.state}`);

            // Étape 8: Indexation
            console.log('📚 Étape 8: Indexation');
            const indexArgs = {
                project_path: TEST_PROJECT_PATH,
                mode: 'full'
            };

            const indexResult = await indexRagHandler(indexArgs);
            const indexResponse = JSON.parse(indexResult.content[0].text);

            expect(indexResponse.status).toBe('accepted');
            expect(indexResponse.task_id).toBe('test-job-4');
            expect(indexResponse.action).toBe('index_rag');
            console.log(`✅ Indexation démarrée: task_id=${indexResponse.task_id}`);

            // Étape 9: Vérification du statut de l'indexation
            console.log('📊 Étape 9: Vérification du statut de l\'indexation');
            const statusArgs4 = {
                scope: 'task',
                task_id: 'test-job-4'
            };

            const statusResult4 = await getStatusHandler(statusArgs4);
            const statusResponse4 = JSON.parse(statusResult4.content[0].text);

            expect(statusResponse4.status).toBe('ok');
            expect(statusResponse4.data.state).toBe('completed');
            console.log(`✅ Statut indexation vérifié: ${statusResponse4.data.state}`);

            // Étape 10: Vérification du statut global du projet
            console.log('🌐 Étape 10: Vérification du statut global du projet');
            const projectStatusArgs = {
                scope: 'project',
                project_id: TEST_PROJECT_PATH
            };

            const projectStatusResult = await getStatusHandler(projectStatusArgs);
            const projectStatusResponse = JSON.parse(projectStatusResult.content[0].text);

            expect(projectStatusResponse.status).toBe('ok');
            expect(projectStatusResponse.scope).toBe('project');
            expect(projectStatusResponse.data.project_id).toBe(TEST_PROJECT_PATH);
            expect(projectStatusResponse.data.pipeline.init_rag).toBe('done');
            expect(projectStatusResponse.data.pipeline.index_rag).toBe('done');
            console.log(`✅ Statut projet vérifié: pipeline complet`);

            // Étape 11: Requête sur le projet indexé
            console.log('🔎 Étape 11: Requête sur le projet indexé');
            const queryArgs = {
                query: 'test query',
                project_path: TEST_PROJECT_PATH,
                top_k: 5
            };

            const queryResult = await queryRagHandler(queryArgs);
            const queryResponse = JSON.parse(queryResult.content[0].text);

            expect(queryResponse.status).toBe('ok');
            expect(queryResponse.results).toBeDefined();
            console.log(`✅ Requête exécutée: ${queryResponse.results?.length || 0} résultats`);

            // Résumé du workflow
            console.log('\n🎉 Workflow RAG complet exécuté avec succès!');
            console.log(`📋 Étapes exécutées: 11`);
            console.log(`📦 Jobs créés: ${jobCounter}`);
            console.log(`✅ Toutes les étapes ont retourné les réponses attendues`);
        });

        it('devrait gérer les erreurs dans le workflow', async () => {
            // Simuler une erreur lors du scan
            mockRagQueue.enqueue.mockResolvedValue({
                queued: false,
                message: 'File d\'attente pleine'
            });

            const scanArgs = {
                project_path: TEST_PROJECT_PATH
            };

            const scanResult = await scanRagHandler(scanArgs);
            const scanResponse = JSON.parse(scanResult.content[0].text);

            expect(scanResponse.status).toBe('error');
            expect(scanResponse.error).toBe('SCAN_JOB_CREATION_ERROR');
            console.log(`✅ Erreur gérée correctement: ${scanResponse.message}`);
        });

        it('devrait suivre la progression via get_status', async () => {
            // Simuler différents états de progression
            let progressCounter = 0;
            (getTaskStatus as any).mockImplementation((job: any) => {
                progressCounter += 25;
                return {
                    task_id: job.id,
                    action: `${job.type}_rag`,
                    state: progressCounter < 100 ? 'running' : 'completed',
                    progress: { percent: Math.min(progressCounter, 100) },
                    notes_for_ai: [`Progression: ${progressCounter}%`],
                    allowed_actions: ['get_status'],
                    required_action: progressCounter < 100 ? 'Attendre la fin' : undefined
                };
            });

            const scanArgs = {
                project_path: TEST_PROJECT_PATH
            };

            const scanResult = await scanRagHandler(scanArgs);
            const scanResponse = JSON.parse(scanResult.content[0].text);
            const taskId = scanResponse.task_id;

            // Vérifier la progression à différents moments
            for (let i = 0; i < 4; i++) {
                const statusArgs = {
                    scope: 'task',
                    task_id: taskId
                };

                const statusResult = await getStatusHandler(statusArgs);
                const statusResponse = JSON.parse(statusResult.content[0].text);

                expect(statusResponse.data.progress.percent).toBe((i + 1) * 25);
                console.log(`✅ Progression vérifiée: ${statusResponse.data.progress.percent}%`);
            }
        });
    });

    describe('Tests de scénarios spécifiques', () => {
        it('devrait gérer un projet non initialisé', async () => {
            // Tentative de scan sans initialisation
            const scanArgs = {
                project_path: TEST_PROJECT_PATH
            };

            const scanResult = await scanRagHandler(scanArgs);
            const scanResponse = JSON.parse(scanResult.content[0].text);

            expect(scanResponse.status).toBe('error');
            expect(scanResponse.error).toBe('RAG_NOT_INITIALIZED');
            expect(scanResponse.required_action).toBe('run_init_rag');
        });

        it('devrait permettre les requêtes pendant l\'exécution d\'autres jobs', async () => {
            // Initialiser le projet
            (isRagInitialized as any).mockResolvedValue(true);

            // Démarrer un scan
            const scanArgs = {
                project_path: TEST_PROJECT_PATH
            };

            await scanRagHandler(scanArgs);

            // Exécuter une requête pendant le scan
            const queryArgs = {
                query: 'test query',
                project_path: TEST_PROJECT_PATH
            };

            const queryResult = await queryRagHandler(queryArgs);
            const queryResponse = JSON.parse(queryResult.content[0].text);

            expect(queryResponse.status).toBe('ok');
            console.log('✅ Requête exécutée pendant le scan');
        });

        it('devrait mettre à jour les actions autorisées selon l\'état du pipeline', async () => {
            // Simuler différentes étapes du pipeline
            const pipelineStates = [
                {
                    pipeline: { init_rag: 'done', scan_rag: 'pending' },
                    expectedActions: ['init_rag', 'scan_rag']
                },
                {
                    pipeline: { init_rag: 'done', scan_rag: 'done', prepare_rag: 'pending' },
                    expectedActions: ['scan_rag', 'prepare_rag']
                },
                {
                    pipeline: { init_rag: 'done', scan_rag: 'done', prepare_rag: 'done', embed_rag: 'pending' },
                    expectedActions: ['prepare_rag', 'embed_rag']
                },
                {
                    pipeline: { init_rag: 'done', scan_rag: 'done', prepare_rag: 'done', embed_rag: 'done', index_rag: 'pending' },
                    expectedActions: ['embed_rag', 'index_rag']
                },
                {
                    pipeline: { init_rag: 'done', scan_rag: 'done', prepare_rag: 'done', embed_rag: 'done', index_rag: 'done' },
                    expectedActions: ['index_rag', 'query_rag']
                }
            ];

            for (const state of pipelineStates) {
                mockStateManager.getProjectStatus.mockResolvedValue({
                    project_id: TEST_PROJECT_PATH,
                    status: 'ok',
                    pipeline: state.pipeline,
                    notes_for_ai: [],
                    allowed_actions: [],
                    required_action: undefined
                });

                const args = {
                    scope: 'project',
                    project_id: TEST_PROJECT_PATH
                };

                const result = await getStatusHandler(args);
                const response = JSON.parse(result.content[0].text);

                // Vérifier que les actions autorisées incluent les actions attendues
                for (const expectedAction of state.expectedActions) {
                    expect(response.allowed_actions).toContain(expectedAction);
                }
                console.log(`✅ Actions autorisées vérifiées pour l'état: ${JSON.stringify(state.pipeline)}`);
            }
        });
    });
});
