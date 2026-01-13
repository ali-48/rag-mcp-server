// test/unit/rag-initialization.test.ts
// Tests unitaires pour le Module A (rag-initialization.ts)
// Fonctions testées: A1-A8

import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeRagInfrastructure } from '../../src/rag/phase0/rag-initialization.js';

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
        }
    }
}));

vi.mock('path', () => ({
    default: {
        join: (...args: string[]) => args.join('/'),
        dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
        basename: (p: string) => p.split('/').pop() || '',
        resolve: (...args: string[]) => args.join('/'),
    }
}));

vi.mock('crypto', () => ({
    default: {
        createHash: () => ({
            update: () => ({
                digest: () => 'mock-hash-123'
            })
        })
    }
}));

describe('Module A - rag-initialization.ts', () => {
    const mockProjectPath = '/mock/project/path';
    const mockFs = fs as any;
    const mockPath = path as any;

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
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('A1 - Résolution projet', () => {
        it('devrait résoudre le chemin du projet', async () => {
            const result = await initializeRagInfrastructure(mockProjectPath, 'default');

            expect(result).toBeDefined();
            expect(result.projectPath).toBe(mockProjectPath);
            expect(result.status).toBe('initialized');
        });

        it('devrait échouer si le projet n\'existe pas', async () => {
            mockFs.existsSync.mockReturnValue(false);

            const result = await initializeRagInfrastructure('/invalid/path', 'default');

            expect(result.status).toBe('error');
            expect(result.errors).toBeDefined();
            expect(result.errors?.length).toBeGreaterThan(0);
        });
    });

    describe('A2 - Création arborescence', () => {
        it('devrait créer les dossiers nécessaires', async () => {
            const result = await initializeRagInfrastructure(mockProjectPath, 'default');

            expect(mockFs.mkdirSync).toHaveBeenCalled();
            expect(result.details.stepA2.success).toBe(true);
            expect(result.details.stepA2.directoriesCreated.length).toBeGreaterThan(0);
        });

        it('devrait gérer les erreurs de création de dossier', async () => {
            mockFs.mkdirSync.mockImplementation(() => {
                throw new Error('Permission denied');
            });

            const result = await initializeRagInfrastructure(mockProjectPath, 'default');

            expect(result.details.stepA2.success).toBe(false);
            expect(result.details.stepA2.error).toBeDefined();
        });
    });

    describe('A3 - .ragignore', () => {
        it('devrait créer le fichier .ragignore', async () => {
            const result = await initializeRagInfrastructure(mockProjectPath, 'default');

            expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('.ragignore'),
                expect.any(String)
            );
            expect(result.details.stepA3.success).toBe(true);
            expect(result.details.stepA3.fileCreated).toBe(true);
        });

        it('devrait utiliser le template existant', async () => {
            mockFs.existsSync.mockImplementation((p: string) =>
                p.includes('.ragignore') ? true : false
            );

            const result = await initializeRagInfrastructure(mockProjectPath, 'default');

            expect(result.details.stepA3.success).toBe(true);
            expect(result.details.stepA3.fileCreated).toBe(false);
        });
    });

    describe('A4 - Config RAG', () => {
        it('devrait créer la configuration RAG', async () => {
            const result = await initializeRagInfrastructure(mockProjectPath, 'default');

            expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('rag-config.json'),
                expect.any(String)
            );
            expect(result.details.stepA4.success).toBe(true);
            expect(result.details.stepA4.configPath).toBeDefined();
        });

        it('devrait inclure les métadonnées du projet', async () => {
            const result = await initializeRagInfrastructure(mockProjectPath, 'default');

            expect(result.projectId).toBe('mock-hash-123');
            expect(result.projectPath).toBe(mockProjectPath);
        });
    });

    describe('A5 - Config DB', () => {
        it('devrait créer la configuration de base de données', async () => {
            const result = await initializeRagInfrastructure(mockProjectPath, 'default');

            expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('db-config.json'),
                expect.any(String)
            );
            expect(result.details.stepA5.success).toBe(true);
            expect(result.details.stepA5.configPath).toBeDefined();
        });
    });

    describe('A6 - SQLite', () => {
        it('devrait créer la base de données SQLite', async () => {
            const result = await initializeRagInfrastructure(mockProjectPath, 'default');

            expect(result.details.stepA6.success).toBe(true);
            expect(result.details.stepA6.dbPath).toBeDefined();
        });
    });

    describe('A7 - Test vector DB', () => {
        it('devrait tester la connexion à la base vectorielle', async () => {
            const result = await initializeRagInfrastructure(mockProjectPath, 'default');

            expect(result.details.stepA7.success).toBe(true);
            expect(result.details.stepA7.tested).toBe(true);
        });
    });

    describe('A8 - Enregistrement MCP', () => {
        it('devrait enregistrer le projet dans le registry MCP', async () => {
            const result = await initializeRagInfrastructure(mockProjectPath, 'default');

            expect(result.details.stepA8.success).toBe(true);
            expect(result.details.stepA8.registered).toBe(true);
        });
    });

    describe('Modes d\'initialisation', () => {
        it('devrait supporter le mode "default"', async () => {
            const result = await initializeRagInfrastructure(mockProjectPath, 'default');

            expect(result.mode).toBe('default');
            expect(result.status).toBe('initialized');
        });

        it('devrait supporter le mode "memory-only"', async () => {
            const result = await initializeRagInfrastructure(mockProjectPath, 'memory-only');

            expect(result.mode).toBe('memory-only');
            expect(result.details.stepA6.success).toBe(true); // SQLite toujours créé
        });

        it('devrait supporter le mode "full"', async () => {
            const result = await initializeRagInfrastructure(mockProjectPath, 'full');

            expect(result.mode).toBe('full');
            expect(result.status).toBe('initialized');
        });
    });

    describe('Validation des résultats', () => {
        it('devrait retourner un résultat structuré', async () => {
            const result = await initializeRagInfrastructure(mockProjectPath, 'default');

            expect(result).toMatchObject({
                status: expect.stringMatching(/initialized|error/),
                projectPath: mockProjectPath,
                projectId: expect.any(String),
                mode: expect.any(String),
                initializedAt: expect.any(String),
                details: {
                    stepA1: expect.any(Object),
                    stepA2: expect.any(Object),
                    stepA3: expect.any(Object),
                    stepA4: expect.any(Object),
                    stepA5: expect.any(Object),
                    stepA6: expect.any(Object),
                    stepA7: expect.any(Object),
                    stepA8: expect.any(Object),
                }
            });
        });

        it('devrait inclure des avertissements si nécessaire', async () => {
            // Simuler un avertissement
            mockFs.mkdirSync.mockImplementation(() => {
                console.warn('Dossier déjà existant');
            });

            const result = await initializeRagInfrastructure(mockProjectPath, 'default');

            expect(result.warnings).toBeDefined();
            expect(Array.isArray(result.warnings)).toBe(true);
        });
    });
});
