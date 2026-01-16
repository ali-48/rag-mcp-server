// test/unit/rag-handlers.test.ts
// Tests unitaires pour les handlers RAG asynchrones
// Vérifie que les handlers retournent une réponse immédiate avec task_id
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isRagInitialized } from '../../src/rag/phase0/rag-state.js';
import { createRagJob } from '../../src/rag/queue/job-types.js';
import { getRagQueue } from '../../src/rag/queue/rag-queue.js';
import { embedRagHandler, indexRagHandler, prepareRagHandler } from '../../src/tools/rag/index-rag.js';
import { scanRagHandler } from '../../src/tools/rag/scan-rag.js';
// Mock des dépendances
vi.mock('../../src/rag/phase0/rag-state.js', () => ({
    isRagInitialized: vi.fn()
}));
vi.mock('../../src/rag/queue/job-types.js', () => ({
    createRagJob: vi.fn()
}));
vi.mock('../../src/rag/queue/rag-queue.js', () => ({
    getRagQueue: vi.fn()
}));
vi.mock('../../src/core/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));
describe('Tests unitaires pour les handlers RAG asynchrones', () => {
    let mockRagQueue;
    let mockJob;
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock de la file d'attente RAG
        mockRagQueue = {
            enqueue: vi.fn()
        };
        getRagQueue.mockReturnValue(mockRagQueue);
        // Mock d'un job
        mockJob = {
            id: 'test-job-123',
            type: 'scan',
            projectPath: '/test/project',
            metadata: {}
        };
        createRagJob.mockReturnValue(mockJob);
        // Par défaut, le projet est initialisé
        isRagInitialized.mockResolvedValue(true);
        // Par défaut, l'enqueue réussit
        mockRagQueue.enqueue.mockResolvedValue({
            queued: true,
            position: 1,
            message: 'Job ajouté à la file'
        });
    });
    afterEach(() => {
        vi.resetAllMocks();
    });
    describe('scanRagHandler', () => {
        it('devrait retourner une réponse asynchrone avec task_id', async () => {
            const args = {
                project_path: '/test/project',
                enable_workspace_detection: true,
                file_patterns: ['**/*']
            };
            const result = await scanRagHandler(args);
            expect(result).toBeDefined();
            expect(result.content).toBeDefined();
            expect(result.content[0].type).toBe('text');
            const response = JSON.parse(result.content[0].text);
            expect(response.status).toBe('accepted');
            expect(response.action).toBe('scan_rag');
            expect(response.task_id).toBe('test-job-123');
            expect(response.execution).toBe('background');
            expect(response.message).toContain('Scan démarré en arrière-plan');
            expect(response.next_action).toBe('get_status');
            expect(response.notes_for_ai).toBeDefined();
            expect(response.notes_for_ai).toContain('Le scan s\'exécute de manière asynchrone');
        });
        it('devrait créer un job de scan avec les bons paramètres', async () => {
            const args = {
                project_path: '/test/project',
                enable_workspace_detection: false,
                file_patterns: ['*.ts', '*.js'],
                content_types: ['code'],
                languages: ['typescript']
            };
            await scanRagHandler(args);
            expect(createRagJob).toHaveBeenCalledWith('scan', '/test/project', {
                metadata: {
                    args: args,
                    startTime: expect.any(Number)
                }
            });
            expect(mockRagQueue.enqueue).toHaveBeenCalledWith(mockJob);
        });
        it('devrait échouer si le projet n\'est pas initialisé', async () => {
            isRagInitialized.mockResolvedValue(false);
            const args = {
                project_path: '/test/project'
            };
            const result = await scanRagHandler(args);
            const response = JSON.parse(result.content[0].text);
            expect(response.status).toBe('error');
            expect(response.error).toBe('RAG_NOT_INITIALIZED');
            expect(response.required_action).toBe('run_init_rag');
        });
        it('devrait gérer les erreurs d\'enqueue', async () => {
            mockRagQueue.enqueue.mockResolvedValue({
                queued: false,
                message: 'File d\'attente pleine'
            });
            const args = {
                project_path: '/test/project'
            };
            const result = await scanRagHandler(args);
            const response = JSON.parse(result.content[0].text);
            expect(response.status).toBe('error');
            expect(response.error).toBe('SCAN_JOB_CREATION_ERROR');
            expect(response.message).toContain('Impossible d\'ajouter le job à la file d\'attente');
        });
        it('devrait détecter automatiquement le projet si project_path non spécifié', async () => {
            // Simuler la détection automatique
            const mockFs = {
                existsSync: vi.fn().mockReturnValue(true)
            };
            const mockPath = {
                join: vi.fn().mockReturnValue('/current/dir/.git')
            };
            vi.doMock('fs', () => mockFs);
            vi.doMock('path', () => mockPath);
            const args = {}; // Pas de project_path
            const result = await scanRagHandler(args);
            const response = JSON.parse(result.content[0].text);
            expect(response.status).toBe('accepted');
            expect(response.task_id).toBe('test-job-123');
        });
    });
    describe('prepareRagHandler', () => {
        it('devrait retourner une réponse asynchrone avec task_id', async () => {
            const args = {
                project_path: '/test/project',
                chunking_strategy: 'logical',
                max_chunk_size: 1000
            };
            const result = await prepareRagHandler(args);
            expect(result).toBeDefined();
            const response = JSON.parse(result.content[0].text);
            expect(response.status).toBe('accepted');
            expect(response.action).toBe('prepare_rag');
            expect(response.task_id).toBe('test-job-123');
            expect(response.execution).toBe('background');
            expect(response.message).toContain('Préparation démarrée en arrière-plan');
            expect(response.next_action).toBe('get_status');
        });
        it('devrait créer un job de préparation', async () => {
            const args = {
                project_path: '/test/project'
            };
            await prepareRagHandler(args);
            expect(createRagJob).toHaveBeenCalledWith('prepare', '/test/project', {
                metadata: {
                    args: args,
                    startTime: expect.any(Number)
                }
            });
        });
    });
    describe('embedRagHandler', () => {
        it('devrait retourner une réponse asynchrone avec task_id', async () => {
            const args = {
                project_path: '/test/project',
                embedding_model: 'nomic-embed-text'
            };
            const result = await embedRagHandler(args);
            expect(result).toBeDefined();
            const response = JSON.parse(result.content[0].text);
            expect(response.status).toBe('accepted');
            expect(response.action).toBe('embed_rag');
            expect(response.task_id).toBe('test-job-123');
            expect(response.execution).toBe('background');
            expect(response.message).toContain('Embedding démarré en arrière-plan');
            expect(response.next_action).toBe('get_status');
        });
        it('devrait créer un job d\'embedding', async () => {
            const args = {
                project_path: '/test/project'
            };
            await embedRagHandler(args);
            expect(createRagJob).toHaveBeenCalledWith('embed', '/test/project', {
                metadata: {
                    args: args,
                    startTime: expect.any(Number)
                }
            });
        });
    });
    describe('indexRagHandler', () => {
        it('devrait retourner une réponse asynchrone avec task_id', async () => {
            const args = {
                project_path: '/test/project',
                mode: 'full'
            };
            const result = await indexRagHandler(args);
            expect(result).toBeDefined();
            const response = JSON.parse(result.content[0].text);
            expect(response.status).toBe('accepted');
            expect(response.action).toBe('index_rag');
            expect(response.task_id).toBe('test-job-123');
            expect(response.execution).toBe('background');
            expect(response.message).toContain('Indexation démarrée en arrière-plan');
            expect(response.next_action).toBe('get_status');
        });
        it('devrait créer un job d\'indexation', async () => {
            const args = {
                project_path: '/test/project'
            };
            await indexRagHandler(args);
            expect(createRagJob).toHaveBeenCalledWith('index', '/test/project', {
                metadata: {
                    args: args,
                    startTime: expect.any(Number)
                }
            });
        });
    });
    describe('Format de réponse commun', () => {
        it('devrait inclure notes_for_ai dans toutes les réponses asynchrones', async () => {
            const handlers = [
                { handler: scanRagHandler, args: { project_path: '/test/project' } },
                { handler: prepareRagHandler, args: { project_path: '/test/project' } },
                { handler: embedRagHandler, args: { project_path: '/test/project' } },
                { handler: indexRagHandler, args: { project_path: '/test/project' } }
            ];
            for (const { handler, args } of handlers) {
                const result = await handler(args);
                const response = JSON.parse(result.content[0].text);
                expect(response.notes_for_ai).toBeDefined();
                expect(Array.isArray(response.notes_for_ai)).toBe(true);
                expect(response.notes_for_ai.length).toBeGreaterThan(0);
                expect(response.notes_for_ai[0]).toContain('asynchrone');
            }
        });
        it('devrait inclure task_id valide dans toutes les réponses', async () => {
            const handlers = [
                { handler: scanRagHandler, args: { project_path: '/test/project' } },
                { handler: prepareRagHandler, args: { project_path: '/test/project' } },
                { handler: embedRagHandler, args: { project_path: '/test/project' } },
                { handler: indexRagHandler, args: { project_path: '/test/project' } }
            ];
            for (const { handler, args } of handlers) {
                const result = await handler(args);
                const response = JSON.parse(result.content[0].text);
                expect(response.task_id).toBe('test-job-123');
                expect(typeof response.task_id).toBe('string');
                expect(response.task_id.length).toBeGreaterThan(0);
            }
        });
        it('devrait recommander get_status comme next_action', async () => {
            const handlers = [
                { handler: scanRagHandler, args: { project_path: '/test/project' } },
                { handler: prepareRagHandler, args: { project_path: '/test/project' } },
                { handler: embedRagHandler, args: { project_path: '/test/project' } },
                { handler: indexRagHandler, args: { project_path: '/test/project' } }
            ];
            for (const { handler, args } of handlers) {
                const result = await handler(args);
                const response = JSON.parse(result.content[0].text);
                expect(response.next_action).toBe('get_status');
            }
        });
    });
    describe('Gestion des erreurs', () => {
        it('devrait gérer les exceptions dans tous les handlers', async () => {
            // Simuler une exception dans createRagJob
            createRagJob.mockImplementation(() => {
                throw new Error('Erreur de création de job');
            });
            const handlers = [
                { handler: scanRagHandler, args: { project_path: '/test/project' } },
                { handler: prepareRagHandler, args: { project_path: '/test/project' } },
                { handler: embedRagHandler, args: { project_path: '/test/project' } },
                { handler: indexRagHandler, args: { project_path: '/test/project' } }
            ];
            for (const { handler, args } of handlers) {
                const result = await handler(args);
                const response = JSON.parse(result.content[0].text);
                expect(response.status).toBe('error');
                expect(response.error).toBeDefined();
                expect(response.message).toContain('Erreur de création de job');
            }
        });
        it('devrait formater les erreurs avec stack_trace', async () => {
            const error = new Error('Erreur de test');
            error.stack = 'stack trace détaillé';
            createRagJob.mockImplementation(() => {
                throw error;
            });
            const result = await scanRagHandler({ project_path: '/test/project' });
            const response = JSON.parse(result.content[0].text);
            expect(response.stack_trace).toBe('stack trace détaillé');
        });
    });
});
//# sourceMappingURL=rag-handlers.test.js.map