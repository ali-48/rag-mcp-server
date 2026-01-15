// test/unit/get-status.test.ts
// Tests unitaires pour l'outil MCP get_status

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPhaseAnalysis } from '../../src/rag/guards/rag-guards.js';
import { getTaskStatus } from '../../src/rag/queue/job-types.js';
import { getRagQueue } from '../../src/rag/queue/rag-queue.js';
import { StateManager } from '../../src/rag/state-manager.js';
import { getStatusHandler } from '../../src/tools/rag/get-status.js';

// Mock des dépendances
vi.mock('../../src/rag/queue/rag-queue.js', () => ({
    getRagQueue: vi.fn()
}));

vi.mock('../../src/rag/state-manager.js', () => ({
    StateManager: {
        getInstance: vi.fn()
    }
}));

vi.mock('../../src/rag/guards/rag-guards.js', () => ({
    getPhaseAnalysis: vi.fn()
}));

vi.mock('../../src/rag/queue/job-types.js', () => ({
    getTaskStatus: vi.fn()
}));

vi.mock('../../src/core/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

describe('Tests unitaires pour l\'outil MCP get_status', () => {
    let mockRagQueue: any;
    let mockStateManager: any;
    let mockPhaseAnalysis: any;
    let mockTaskStatus: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock de la file d'attente RAG
        mockRagQueue = {
            getGlobalStatus: vi.fn(),
            getJob: vi.fn()
        };
        (getRagQueue as any).mockReturnValue(mockRagQueue);

        // Mock du StateManager
        mockStateManager = {
            getProjectStatus: vi.fn()
        };
        (StateManager.getInstance as any).mockReturnValue(mockStateManager);

        // Mock de l'analyse des phases
        mockPhaseAnalysis = {
            current_phase: 'init',
            current_status: 'pending',
            next_phase: 'init',
            phases: [],
            recommended_actions: [],
            notes_for_ai: []
        };
        (getPhaseAnalysis as any).mockResolvedValue(mockPhaseAnalysis);

        // Mock du statut de tâche
        mockTaskStatus = {
            task_id: 'test-task-123',
            action: 'scan_rag',
            state: 'running',
            progress: { percent: 50 },
            notes_for_ai: ['Tâche en cours'],
            allowed_actions: ['get_status'],
            required_action: undefined
        };
        (getTaskStatus as any).mockReturnValue(mockTaskStatus);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Scope global', () => {
        it('devrait retourner le statut global avec actions autorisées', async () => {
            // Configurer le mock
            mockRagQueue.getGlobalStatus.mockReturnValue({
                status: 'ok',
                rag_state: {
                    total_projects: 5,
                    active_jobs: 2,
                    queued_jobs: 1
                },
                notes_for_ai: ['Système opérationnel']
            });

            const args = {
                scope: 'global',
                include_notes_for_ai: true,
                include_allowed_actions: true
            };

            const result = await getStatusHandler(args);

            expect(result).toBeDefined();
            expect(result.content).toBeDefined();
            expect(result.content[0].type).toBe('text');

            const response = JSON.parse(result.content[0].text);
            expect(response.status).toBe('ok');
            expect(response.scope).toBe('global');
            expect(response.data).toBeDefined();
            expect(response.notes_for_ai).toBeDefined();
            expect(response.allowed_actions).toBeDefined();
            expect(response.allowed_actions).toContain('get_status');
            expect(response.allowed_actions).toContain('init_rag');
            expect(response.allowed_actions).toContain('scan_rag');
        });

        it('devrait filtrer les notes pour l\'IA si include_notes_for_ai est false', async () => {
            mockRagQueue.getGlobalStatus.mockReturnValue({
                status: 'ok',
                rag_state: { total_projects: 0, active_jobs: 0, queued_jobs: 0 },
                notes_for_ai: ['Note 1', 'Note 2']
            });

            const args = {
                scope: 'global',
                include_notes_for_ai: false
            };

            const result = await getStatusHandler(args);
            const response = JSON.parse(result.content[0].text);

            expect(response.notes_for_ai).toEqual([]);
        });

        it('devrait filtrer les actions autorisées si include_allowed_actions est false', async () => {
            mockRagQueue.getGlobalStatus.mockReturnValue({
                status: 'ok',
                rag_state: { total_projects: 0, active_jobs: 0, queued_jobs: 0 },
                notes_for_ai: []
            });

            const args = {
                scope: 'global',
                include_allowed_actions: false
            };

            const result = await getStatusHandler(args);
            const response = JSON.parse(result.content[0].text);

            expect(response.allowed_actions).toBeUndefined();
        });
    });

    describe('Scope projet', () => {
        it('devrait retourner le statut d\'un projet avec actions autorisées déterminées par guards', async () => {
            // Configurer les mocks
            mockStateManager.getProjectStatus.mockResolvedValue({
                project_id: 'test-project',
                status: 'ok',
                pipeline: {
                    init_rag: 'done',
                    scan_rag: 'pending',
                    prepare_rag: 'pending',
                    embed_rag: 'pending',
                    index_rag: 'pending'
                },
                notes_for_ai: ['Projet initialisé'],
                allowed_actions: ['init_rag', 'scan_rag'],
                required_action: 'scan_rag'
            });

            // Configurer l'analyse des phases
            mockPhaseAnalysis.current_phase = 'init';
            mockPhaseAnalysis.current_status = 'done';
            mockPhaseAnalysis.next_phase = 'scan';
            mockPhaseAnalysis.notes_for_ai = ['Phase suivante: scan'];

            const args = {
                scope: 'project',
                project_id: 'test-project',
                include_notes_for_ai: true,
                include_allowed_actions: true
            };

            const result = await getStatusHandler(args);

            expect(result).toBeDefined();
            const response = JSON.parse(result.content[0].text);
            expect(response.status).toBe('ok');
            expect(response.scope).toBe('project');
            expect(response.data.project_id).toBe('test-project');
            expect(response.notes_for_ai).toContain('Projet initialisé');
            expect(response.notes_for_ai).toContain('Phase suivante: scan');
            expect(response.allowed_actions).toBeDefined();
            expect(response.allowed_actions).toContain('get_status');
            expect(response.allowed_actions).toContain('scan_rag');
            expect(response.required_action).toContain('Exécutez scan_rag');
        });

        it('devrait échouer si project_id n\'est pas fourni pour scope=project', async () => {
            const args = {
                scope: 'project'
                // Pas de project_id
            };

            await expect(getStatusHandler(args)).rejects.toThrow('project_id est requis pour scope=project');
        });

        it('devrait utiliser l\'analyse des phases pour déterminer les actions autorisées', async () => {
            mockStateManager.getProjectStatus.mockResolvedValue({
                project_id: 'test-project',
                status: 'ok',
                pipeline: {},
                notes_for_ai: [],
                allowed_actions: [],
                required_action: undefined
            });

            // Projet non initialisé
            mockPhaseAnalysis.current_phase = 'init';
            mockPhaseAnalysis.current_status = 'pending';
            mockPhaseAnalysis.next_phase = 'init';
            mockPhaseAnalysis.notes_for_ai = ['Projet non initialisé'];

            const args = {
                scope: 'project',
                project_id: 'test-project'
            };

            const result = await getStatusHandler(args);
            const response = JSON.parse(result.content[0].text);

            expect(response.allowed_actions).toContain('init_rag');
            expect(response.allowed_actions).not.toContain('scan_rag'); // Pas encore initialisé
            expect(response.required_action).toBeUndefined(); // Pas d'action requise car next_phase est init
        });

        it('devrait gérer les erreurs de getPhaseAnalysis', async () => {
            mockStateManager.getProjectStatus.mockResolvedValue({
                project_id: 'test-project',
                status: 'ok',
                pipeline: {},
                notes_for_ai: [],
                allowed_actions: [],
                required_action: undefined
            });

            (getPhaseAnalysis as any).mockRejectedValue(new Error('Erreur d\'analyse'));

            const args = {
                scope: 'project',
                project_id: 'test-project'
            };

            const result = await getStatusHandler(args);
            const response = JSON.parse(result.content[0].text);

            // Devrait quand même retourner une réponse (avec erreur dans le handler)
            expect(response).toBeDefined();
            // Le handler catch l'erreur et retourne un format d'erreur MCP
            expect(response.success).toBe(false);
        });
    });

    describe('Scope tâche', () => {
        it('devrait retourner le statut d\'une tâche', async () => {
            // Configurer les mocks
            const mockJob = {
                id: 'test-task-123',
                type: 'scan',
                status: 'running'
            };
            mockRagQueue.getJob.mockReturnValue(mockJob);

            const args = {
                scope: 'task',
                task_id: 'test-task-123',
                include_notes_for_ai: true,
                include_allowed_actions: true
            };

            const result = await getStatusHandler(args);

            expect(result).toBeDefined();
            const response = JSON.parse(result.content[0].text);
            expect(response.status).toBe('ok');
            expect(response.scope).toBe('task');
            expect(response.data.task_id).toBe('test-task-123');
            expect(response.data.action).toBe('scan_rag');
            expect(response.data.state).toBe('running');
            expect(response.notes_for_ai).toContain('Tâche en cours');
            expect(response.allowed_actions).toEqual(['get_status']);
        });

        it('devrait échouer si task_id n\'est pas fourni pour scope=task', async () => {
            const args = {
                scope: 'task'
                // Pas de task_id
            };

            await expect(getStatusHandler(args)).rejects.toThrow('task_id est requis pour scope=task');
        });

        it('devrait échouer si la tâche n\'existe pas', async () => {
            mockRagQueue.getJob.mockReturnValue(null);

            const args = {
                scope: 'task',
                task_id: 'tâche-inexistante'
            };

            await expect(getStatusHandler(args)).rejects.toThrow('Tâche non trouvée');
        });

        it('devrait filtrer les champs optionnels', async () => {
            const mockJob = { id: 'test-task', type: 'scan', status: 'done' };
            mockRagQueue.getJob.mockReturnValue(mockJob);

            const args = {
                scope: 'task',
                task_id: 'test-task',
                include_notes_for_ai: false,
                include_allowed_actions: false
            };

            const result = await getStatusHandler(args);
            const response = JSON.parse(result.content[0].text);

            expect(response.notes_for_ai).toEqual([]);
            expect(response.allowed_actions).toBeUndefined();
        });
    });

    describe('Gestion des erreurs', () => {
        it('devrait retourner une erreur formatée MCP en cas d\'exception', async () => {
            // Simuler une erreur dans getGlobalStatus
            mockRagQueue.getGlobalStatus.mockImplementation(() => {
                throw new Error('Erreur interne');
            });

            const args = {
                scope: 'global'
            };

            const result = await getStatusHandler(args);
            const response = JSON.parse(result.content[0].text);

            expect(response.success).toBe(false);
            expect(response.error).toBeDefined();
            expect(response.error.type).toBe('RagUsageError');
            expect(response.error.message).toContain('Erreur interne');
            expect(response.error.notes_for_ai).toBeDefined();
        });

        it('devrait gérer les scopes invalides', async () => {
            const args = {
                scope: 'invalid' as any
            };

            await expect(getStatusHandler(args)).rejects.toThrow('Scope invalide');
        });
    });

    describe('Intégration avec guards', () => {
        it('devrait déterminer correctement les actions autorisées selon l\'analyse des phases', async () => {
            // Test avec différentes phases
            const testCases = [
                {
                    phase: 'init',
                    status: 'pending',
                    expectedActions: ['get_status', 'init_rag'],
                    description: 'projet non initialisé'
                },
                {
                    phase: 'init',
                    status: 'done',
                    expectedActions: ['get_status', 'scan_rag'],
                    description: 'projet initialisé, scan suivant'
                },
                {
                    phase: 'scan',
                    status: 'done',
                    expectedActions: ['get_status', 'scan_rag', 'prepare_rag'],
                    description: 'scan terminé, préparation suivante'
                },
                {
                    phase: 'prepare',
                    status: 'done',
                    expectedActions: ['get_status', 'scan_rag', 'prepare_rag', 'embed_rag'],
                    description: 'préparation terminée, embedding suivant'
                },
                {
                    phase: 'embed',
                    status: 'done',
                    expectedActions: ['get_status', 'scan_rag', 'prepare_rag', 'embed_rag', 'index_rag'],
                    description: 'embedding terminé, indexation suivante'
                },
                {
                    phase: 'index',
                    status: 'done',
                    expectedActions: ['get_status', 'scan_rag', 'prepare_rag', 'embed_rag', 'index_rag', 'query_rag'],
                    description: 'indexation terminée, requêtes possibles'
                },
                {
                    phase: 'scan',
                    status: 'running',
                    expectedActions: ['get_status', 'scan_rag'],
                    description: 'scan en cours'
                }
            ];

            for (const testCase of testCases) {
                mockStateManager.getProjectStatus.mockResolvedValue({
                    project_id: 'test-project',
                    status: 'ok',
                    pipeline: {},
                    notes_for_ai: [],
                    allowed_actions: [],
                    required_action: undefined
                });

                mockPhaseAnalysis.current_phase = testCase.phase;
                mockPhaseAnalysis.current_status = testCase.status;
                mockPhaseAnalysis.next_phase = testCase.phase === 'index' && testCase.status === 'done' ? null : 'next';

                const args = {
                    scope: 'project',
                    project_id: 'test-project'
                };

                const result = await getStatusHandler(args);
                const response = JSON.parse(result.content[0].text);

                for (const expectedAction of testCase.expectedActions) {
                    expect(response.allowed_actions, `${testCase.description} devrait inclure ${expectedAction}`)
                        .toContain(expectedAction);
                }
            }
        });
    });
});
