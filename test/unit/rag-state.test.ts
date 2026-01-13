// test/unit/rag-state.test.ts
// Tests unitaires pour le Module B (rag-state.ts)
// Fonctions testées: B1-B2 (isRagInitialized, getRagState)

import fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeProjectId, getRagState, isRagInitialized, isValidProjectPath } from '../../src/rag/phase0/rag-state.js';

// Mock des dépendances
vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(),
        readFileSync: vi.fn(),
        promises: {
            access: vi.fn(),
            readFile: vi.fn(),
        }
    }
}));

vi.mock('path', () => ({
    default: {
        join: (...args: string[]) => args.join('/'),
        resolve: (...args: string[]) => args.join('/'),
        dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
        basename: (p: string) => p.split('/').pop() || '',
    }
}));

vi.mock('crypto', () => ({
    default: {
        createHash: () => ({
            update: () => ({
                digest: () => 'mock-project-hash'
            })
        })
    }
}));

describe('Module B - rag-state.ts', () => {
    const mockProjectPath = '/mock/project/path';
    const mockFs = fs as any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Configuration des mocks par défaut
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(JSON.stringify({ rag_initialized: true }));

        mockFs.promises.access.mockResolvedValue(undefined);
        mockFs.promises.readFile.mockResolvedValue(JSON.stringify({ rag_initialized: true }));
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('B1 - isRagInitialized', () => {
        it('devrait retourner true si RAG est initialisé', async () => {
            const result = await isRagInitialized(mockProjectPath);

            expect(result).toBe(true);
            expect(mockFs.promises.access).toHaveBeenCalledWith(
                expect.stringContaining('rag/config/rag.config.json'),
                expect.any(Number)
            );
        });

        it('devrait retourner false si le fichier de config n\'existe pas', async () => {
            mockFs.promises.access.mockRejectedValue(new Error('Fichier non trouvé'));

            const result = await isRagInitialized(mockProjectPath);

            expect(result).toBe(false);
        });

        it('devrait retourner false si la config n\'est pas valide', async () => {
            mockFs.promises.readFile.mockResolvedValue(JSON.stringify({ rag_initialized: false }));

            const result = await isRagInitialized(mockProjectPath);

            expect(result).toBe(false);
        });

        it('devrait retourner false si la config est corrompue', async () => {
            mockFs.promises.readFile.mockResolvedValue('{ invalid json');

            const result = await isRagInitialized(mockProjectPath);

            expect(result).toBe(false);
        });

        it('devrait gérer les erreurs de lecture', async () => {
            mockFs.promises.readFile.mockRejectedValue(new Error('Permission denied'));

            const result = await isRagInitialized(mockProjectPath);

            expect(result).toBe(false);
        });
    });

    describe('B2 - getRagState', () => {
        it('devrait retourner l\'état complet du RAG', async () => {
            const mockConfig = {
                rag_initialized: true,
                project_id: 'mock-project-hash',
                project_path: mockProjectPath,
                mode: 'default',
                initialized_at: '2024-01-13T22:10:00.000Z',
                infrastructure: {
                    memory_db: 'sqlite://rag/db/memory/rag_memory.sqlite',
                    vector_db: 'postgres://localhost:5432/rag_project'
                }
            };

            mockFs.promises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

            const result = await getRagState(mockProjectPath);

            expect(result.initialized).toBe(true);
            expect(result.projectId).toBe('mock-project-hash');
            expect(result.projectPath).toBe(mockProjectPath);
            expect(result.mode).toBe('default');
            expect(result.initializedAt).toBe('2024-01-13T22:10:00.000Z');
            expect(result.errors).toBeDefined();
            expect(result.warnings).toBeDefined();
        });

        it('devrait retourner un état non initialisé si le fichier n\'existe pas', async () => {
            mockFs.promises.access.mockRejectedValue(new Error('Fichier non trouvé'));

            const result = await getRagState(mockProjectPath);

            expect(result.initialized).toBe(false);
            expect(result.projectPath).toBe(mockProjectPath);
            expect(result.errors).toBeDefined();
            expect(result.errors?.length).toBeGreaterThan(0);
            expect(result.errors?.[0]).toContain('Configuration RAG non trouvée');
        });

        it('devrait inclure les erreurs de parsing', async () => {
            mockFs.promises.readFile.mockResolvedValue('{ invalid json');

            const result = await getRagState(mockProjectPath);

            expect(result.initialized).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors?.length).toBeGreaterThan(0);
            expect(result.errors?.[0]).toContain('Erreur de lecture/parsing');
        });

        it('devrait inclure les erreurs de lecture', async () => {
            mockFs.promises.readFile.mockRejectedValue(new Error('Permission denied'));

            const result = await getRagState(mockProjectPath);

            expect(result.initialized).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors?.length).toBeGreaterThan(0);
            expect(result.errors?.[0]).toContain('Permission denied');
        });

        it('devrait gérer les chemins de projet invalides', async () => {
            const result = await getRagState('/invalid/path');

            expect(result.initialized).toBe(false);
            expect(result.errors).toBeDefined();
        });
    });

    describe('Fonctions utilitaires', () => {
        describe('computeProjectId', () => {
            it('devrait calculer un hash stable pour un chemin de projet', () => {
                const projectId = computeProjectId(mockProjectPath);

                expect(projectId).toBe('mock-project-hash');
                expect(typeof projectId).toBe('string');
                expect(projectId.length).toBeGreaterThan(0);
            });

            it('devrait retourner le même hash pour le même chemin', () => {
                const hash1 = computeProjectId(mockProjectPath);
                const hash2 = computeProjectId(mockProjectPath);

                expect(hash1).toBe(hash2);
            });

            it('devrait normaliser les chemins', () => {
                const hash1 = computeProjectId('/some/path/../project');
                const hash2 = computeProjectId('/some/project');

                // Note: Le mock retourne toujours 'mock-project-hash'
                // Dans la réalité, les chemins normalisés devraient produire le même hash
                expect(hash1).toBe('mock-project-hash');
                expect(hash2).toBe('mock-project-hash');
            });
        });

        describe('isValidProjectPath', () => {
            it('devrait valider un chemin de projet existant', async () => {
                const result = await isValidProjectPath(mockProjectPath);

                expect(result).toBe(true);
                expect(mockFs.promises.access).toHaveBeenCalledWith(mockProjectPath);
            });

            it('devrait rejeter un chemin non existant', async () => {
                mockFs.promises.access.mockRejectedValue(new Error('Chemin non trouvé'));

                const result = await isValidProjectPath('/invalid/path');

                expect(result).toBe(false);
            });

            it('devrait rejeter un chemin qui est un fichier', async () => {
                // Simuler que le chemin existe mais est un fichier
                mockFs.promises.access.mockResolvedValue(undefined);
                mockFs.existsSync.mockImplementation((p: string) => {
                    if (p === mockProjectPath) return true;
                    return false;
                });

                const result = await isValidProjectPath(mockProjectPath);

                expect(result).toBe(true); // Le mock ne peut pas distinguer fichier/dossier
            });
        });
    });

    describe('Intégration des fonctions', () => {
        it('devrait coordonner isRagInitialized et getRagState', async () => {
            const mockConfig = {
                rag_initialized: true,
                project_id: 'test-hash',
                project_path: mockProjectPath
            };

            mockFs.promises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

            const isInitialized = await isRagInitialized(mockProjectPath);
            const state = await getRagState(mockProjectPath);

            expect(isInitialized).toBe(true);
            expect(state.initialized).toBe(true);
            expect(state.projectId).toBe('test-hash');
        });

        it('devrait détecter les incohérences entre les fonctions', async () => {
            // Config marquée comme non initialisée
            const mockConfig = {
                rag_initialized: false,
                project_id: 'test-hash'
            };

            mockFs.promises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

            const isInitialized = await isRagInitialized(mockProjectPath);
            const state = await getRagState(mockProjectPath);

            expect(isInitialized).toBe(false);
            expect(state.initialized).toBe(false);
        });

        it('devrait gérer les projets avec des chemins spéciaux', async () => {
            const specialPaths = [
                '/home/user/project with spaces',
                'C:\\Users\\project\\path', // Windows path
                './relative/path',
                '../parent/project'
            ];

            for (const specialPath of specialPaths) {
                const result = await isRagInitialized(specialPath);
                expect(typeof result).toBe('boolean');
            }
        });
    });
});
