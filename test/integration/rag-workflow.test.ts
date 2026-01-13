// test/integration/rag-workflow.test.ts
// Tests d'intégration pour le workflow complet init_rag → activated_rag

import fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isRagInitialized } from '../../src/rag/phase0/rag-state.js';
import { activatedRagHandler } from '../../src/tools/rag/activated-rag.js';
import { initRagTool } from '../../src/tools/rag/init-rag.js';

// Mock des dépendances
vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(),
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
        readFileSync: vi.fn(),
        promises: {
            access: vi.fn(),
            mkdir: vi.fn(),
            writeFile: vi.fn(),
            readFile: vi.fn(),
            stat: vi.fn(),
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

// Mock pour sqlite3
vi.mock('sqlite3', () => ({
    default: {
        Database: vi.fn()
    }
}));

// Mock pour sqlite
vi.mock('sqlite', () => ({
    open: vi.fn().mockResolvedValue({
        exec: vi.fn().mockResolvedValue(undefined),
        all: vi.fn().mockResolvedValue([
            { name: 'files_indexed' },
            { name: 'chunks' },
            { name: 'llm_cache' },
            { name: 'events' },
            { name: 'project_state' }
        ]),
        run: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined)
    })
}));

describe('Workflow d\'intégration RAG', () => {
    const mockProjectPath = '/mock/project/path';
    const mockFs = fs as any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Configuration des mocks par défaut
        mockFs.existsSync.mockReturnValue(true);
        mockFs.mkdirSync.mockImplementation(() => { });
        mockFs.writeFileSync.mockImplementation(() => { });
        mockFs.readFileSync.mockReturnValue(JSON.stringify({ version: '2.0.0' }));

        mockFs.promises.access.mockResolvedValue(undefined);
        mockFs.promises.mkdir.mockResolvedValue(undefined);
        mockFs.promises.writeFile.mockResolvedValue(undefined);
        mockFs.promises.readFile.mockResolvedValue(JSON.stringify({ success: true }));
        mockFs.promises.stat.mockResolvedValue({ isDirectory: () => true });
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Workflow complet init_rag → activated_rag', () => {
        it('devrait initialiser un projet puis exécuter activated_rag avec succès', async () => {
            // Étape 1: Initialisation avec init_rag
            const initResult = await initRagTool({
                project_path: mockProjectPath,
                mode: 'default'
            });

            expect(initResult).toBeDefined();
            expect(initResult.status).toBe('success');
            expect(initResult.message).toContain('initialisée');

            // Vérifier que le projet est marqué comme initialisé
            const isInitialized = await isRagInitialized(mockProjectPath);
            expect(isInitialized).toBe(true);

            // Étape 2: Exécution de activated_rag
            const activatedResult = await activatedRagHandler({
                mode: 'full',
                project_path: mockProjectPath,
                file_patterns: ['**/*.ts', '**/*.js'],
                enable_phase0: true
            });

            expect(activatedResult).toBeDefined();
            expect(activatedResult.content).toBeDefined();
            expect(activatedResult.isError).toBe(false);
        });

        it('devrait échouer avec activated_rag si le projet n\'est pas initialisé', async () => {
            // Simuler un projet non initialisé
            mockFs.promises.access.mockRejectedValue(new Error('Fichier non trouvé'));

            const result = await activatedRagHandler({
                mode: 'full',
                project_path: mockProjectPath,
                file_patterns: ['**/*.ts', '**/*.js']
            });

            expect(result).toBeDefined();
            expect(result.isError).toBe(true);
            expect(result.content).toContain('non initialisé');
            expect(result.content).toContain('init_rag');
        });

        it('devrait gérer les erreurs d\'initialisation', async () => {
            // Simuler une erreur lors de l'initialisation
            mockFs.promises.mkdir.mockRejectedValue(new Error('Permission denied'));

            const initResult = await initRagTool({
                project_path: mockProjectPath,
                mode: 'default'
            });

            expect(initResult).toBeDefined();
            expect(initResult.status).toBe('error');
            expect(initResult.message).toContain('Permission denied');
        });

        it('devrait supporter différents modes d\'initialisation', async () => {
            const modes = ['default', 'memory-only', 'full'] as const;

            for (const mode of modes) {
                // Réinitialiser les mocks pour chaque mode
                vi.clearAllMocks();
                mockFs.existsSync.mockReturnValue(true);
                mockFs.promises.access.mockResolvedValue(undefined);
                mockFs.promises.mkdir.mockResolvedValue(undefined);
                mockFs.promises.writeFile.mockResolvedValue(undefined);
                mockFs.promises.readFile.mockResolvedValue(JSON.stringify({ success: true }));

                const initResult = await initRagTool({
                    project_path: mockProjectPath,
                    mode
                });

                expect(initResult).toBeDefined();
                expect(initResult.status).toBe('success');
                expect(initResult.message).toContain('initialisée');

                // Vérifier que le projet est initialisé
                const isInitialized = await isRagInitialized(mockProjectPath);
                expect(isInitialized).toBe(true);
            }
        });

        it('devrait gérer les chemins de projet invalides', async () => {
            const invalidPaths = [
                '/invalid/path',
                '',
                null,
                undefined
            ];

            for (const invalidPath of invalidPaths) {
                const result = await initRagTool({
                    project_path: invalidPath as any,
                    mode: 'default'
                });

                expect(result).toBeDefined();
                expect(result.status).toBe('error');
                expect(result.message).toContain('chemin');
            }
        });
    });

    describe('Intégration avec le système de fichiers', () => {
        it('devrait créer la structure de dossiers nécessaire', async () => {
            await initRagTool({
                project_path: mockProjectPath,
                mode: 'default'
            });

            // Vérifier que les dossiers ont été créés
            expect(mockFs.promises.mkdir).toHaveBeenCalledWith(
                expect.stringContaining('rag/db/memory'),
                expect.any(Object)
            );
            expect(mockFs.promises.mkdir).toHaveBeenCalledWith(
                expect.stringContaining('rag/config'),
                expect.any(Object)
            );
        });

        it('devrait créer les fichiers de configuration', async () => {
            await initRagTool({
                project_path: mockProjectPath,
                mode: 'default'
            });

            // Vérifier que les fichiers de config ont été créés
            expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('rag/config/rag.config.json'),
                expect.any(String),
                'utf-8'
            );

            expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('rag/config/db.config.json'),
                expect.any(String),
                'utf-8'
            );

            expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('.ragignore'),
                expect.any(String),
                'utf-8'
            );
        });

        it('devrait créer la base de données SQLite', async () => {
            await initRagTool({
                project_path: mockProjectPath,
                mode: 'default'
            });

            // Vérifier que la base de données a été initialisée
            expect(mockFs.promises.mkdir).toHaveBeenCalledWith(
                expect.stringContaining('rag/db/memory'),
                expect.any(Object)
            );
        });
    });

    describe('Validation des arguments', () => {
        it('devrait valider les arguments requis pour init_rag', async () => {
            // Test sans project_path
            const result1 = await initRagTool({
                mode: 'default'
            } as any);

            expect(result1.status).toBe('error');
            expect(result1.message).toContain('project_path');

            // Test avec project_path invalide
            const result2 = await initRagTool({
                project_path: '',
                mode: 'default'
            });

            expect(result2.status).toBe('error');
            expect(result2.message).toContain('chemin');
        });

        it('devrait valider les arguments requis pour activated_rag', async () => {
            // Test sans project_path (devrait échouer car non initialisé)
            const result = await activatedRagHandler({
                mode: 'full'
            } as any);

            expect(result.content[0].text).toContain('RAG_NOT_INITIALIZED');
        });

        it('devrait accepter des arguments optionnels', async () => {
            // Initialiser d'abord
            await initRagTool({
                project_path: mockProjectPath,
                mode: 'default'
            });

            // Test avec arguments optionnels
            const result = await activatedRagHandler({
                mode: 'full',
                project_path: mockProjectPath,
                file_patterns: ['**/*.ts'],
                enable_phase0: true,
                enable_watcher: false,
                content_types: ['code', 'doc']
            });

            expect(result).toBeDefined();
            expect(result.isError).toBe(false);
        });
    });

    describe('Gestion des erreurs et rollback', () => {
        it('devrait gérer les erreurs partielles lors de l\'initialisation', async () => {
            // Simuler une erreur à l'étape A4 (génération config RAG)
            mockFs.promises.writeFile
                .mockResolvedValueOnce(undefined) // .ragignore
                .mockRejectedValueOnce(new Error('Disk full')); // rag.config.json

            const result = await initRagTool({
                project_path: mockProjectPath,
                mode: 'default'
            });

            expect(result.status).toBe('error');
            expect(result.message).toContain('Disk full');
        });

        it('devrait maintenir un état cohérent après une erreur', async () => {
            // Initialiser avec succès
            await initRagTool({
                project_path: mockProjectPath,
                mode: 'default'
            });

            // Vérifier que le projet est initialisé
            const isInitialized = await isRagInitialized(mockProjectPath);
            expect(isInitialized).toBe(true);

            // Simuler une corruption du fichier de config
            mockFs.promises.readFile.mockRejectedValue(new Error('Fichier corrompu'));

            // activated_rag devrait détecter l'erreur
            const result = await activatedRagHandler({
                mode: 'full',
                project_path: mockProjectPath
            });

            expect(result.isError).toBe(true);
            expect(result.content).toContain('non initialisé');
        });
    });

    describe('Performance et robustesse', () => {
        it('devrait gérer les chemins de projet longs', async () => {
            const longPath = '/very/long/path/with/many/subdirectories/and/a/very/long/project/name/that/exceeds/typical/path/length/limits';

            const result = await initRagTool({
                project_path: longPath,
                mode: 'default'
            });

            expect(result).toBeDefined();
            expect(result.status).toBe('success');
        });

        it('devrait gérer les projets avec des caractères spéciaux', async () => {
            const specialPaths = [
                '/path/with spaces',
                '/path/with-accents-éàç',
                '/path/with/special/ch@r@ct3rs',
                '/path/with/unicode/🎉'
            ];

            for (const specialPath of specialPaths) {
                const result = await initRagTool({
                    project_path: specialPath,
                    mode: 'default'
                });

                expect(result).toBeDefined();
                expect(typeof result.status).toBe('string');
            }
        });
    });
});
