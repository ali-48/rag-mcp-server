// test/multi-backends.test.ts
// Tests pour les différents backends de vector store (SQLite, PostgreSQL mocké, memory)
// Version: v1.0.0

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VectorStoreFactory } from '../src/rag/vector-store-factory.js';
import { IVectorStore, VectorStoreConfig } from '../src/rag/vector-store-interface.js';
import { VectorStoreSQLite } from '../src/rag/vector-store-sqlite.js';

// Mock pour éviter les logs pendant les tests
vi.mock('../src/rag/vector-store-interface.js', async () => {
    const actual = await vi.importActual('../src/rag/vector-store-interface.js');
    return {
        ...actual,
        VectorStoreLogger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        }
    };
});

describe('Multi-Backend Vector Store Tests', () => {
    describe('SQLite Backend', () => {
        let sqliteStore: IVectorStore;

        beforeEach(async () => {
            const config: VectorStoreConfig = {
                type: 'sqlite',
                sqlite: {
                    file: ':memory:',
                    memory: true
                }
            };

            sqliteStore = VectorStoreFactory.create(config);
            await sqliteStore.initialize();
        });

        afterEach(async () => {
            await sqliteStore.clearAll();
        });

        it('should store and retrieve embeddings', async () => {
            const projectPath = '/test/project';
            const filePath = '/test/file.txt';
            const content = 'Test content';
            const embedding = [0.1, 0.2, 0.3, 0.4];

            await sqliteStore.embedAndStore(projectPath, filePath, content, embedding, {
                contentType: 'text',
                language: 'plaintext'
            });

            const searchResults = await sqliteStore.semanticSearch(embedding, {
                limit: 1
            });

            expect(searchResults).toHaveLength(1);
            expect(searchResults[0].filePath).toBe(filePath);
            expect(searchResults[0].content).toBe(content);
            expect(searchResults[0].score).toBeGreaterThan(0.9); // Similarité élevée
        });

        it('should handle multiple documents', async () => {
            const projectPath = '/test/project';
            const documents = [
                {
                    filePath: '/test/file1.txt',
                    content: 'First document',
                    embedding: [0.1, 0.2, 0.3, 0.4]
                },
                {
                    filePath: '/test/file2.txt',
                    content: 'Second document',
                    embedding: [0.5, 0.6, 0.7, 0.8]
                },
                {
                    filePath: '/test/file3.txt',
                    content: 'Third document',
                    embedding: [0.9, 1.0, 1.1, 1.2]
                }
            ];

            for (const doc of documents) {
                await sqliteStore.embedAndStore(projectPath, doc.filePath, doc.content, doc.embedding);
            }

            const stats = await sqliteStore.getStats();
            expect(stats.totalDocuments).toBe(3);

            const projectStats = await sqliteStore.getProjectStats(projectPath);
            expect(projectStats.totalFiles).toBe(3);
        });

        it('should delete documents', async () => {
            const projectPath = '/test/project';
            const filePath = '/test/to-delete.txt';
            const content = 'To delete';
            const embedding = [0.1, 0.2, 0.3, 0.4];

            await sqliteStore.embedAndStore(projectPath, filePath, content, embedding);

            // Rechercher pour obtenir l'ID
            const results = await sqliteStore.semanticSearch(embedding, { limit: 1 });
            expect(results).toHaveLength(1);

            const deleted = await sqliteStore.deleteDocument(results[0].id);
            expect(deleted).toBe(true);

            const afterDelete = await sqliteStore.semanticSearch(embedding, { limit: 1 });
            expect(afterDelete).toHaveLength(0);
        });

        it('should test connection successfully', async () => {
            const connected = await sqliteStore.testConnection();
            expect(connected).toBe(true);
        });
    });

    describe('PostgreSQL Backend (Mocked)', () => {
        // Mock pour le module PostgreSQL
        const mockPostgreSQL = {
            VectorStorePostgreSQL: class MockPostgreSQLStore {
                async initialize() { }
                async store() {
                    return { success: true, id: 'mock-postgres-id' };
                }
                async search() {
                    return { results: [], total: 0 };
                }
                async testConnection() {
                    return true;
                }
                async cleanup() { }
                async getStats() {
                    return { totalDocuments: 0, totalVectors: 0, storageSize: 0 };
                }
            }
        };

        beforeEach(() => {
            // Mock require pour PostgreSQL
            vi.mock('pg', () => ({}));
            vi.mock('../src/rag/vector-store-postgresql.js', () => mockPostgreSQL);
        });

        afterEach(() => {
            vi.clearAllMocks();
        });

        it('should create PostgreSQL store when available', () => {
            const config: VectorStoreConfig = {
                type: 'postgresql',
                postgresql: {
                    host: 'localhost',
                    port: 5432,
                    database: 'test',
                    user: 'test',
                    password: 'test'
                }
            };

            const store = VectorStoreFactory.create(config);
            expect(store).toBeDefined();
        });

        it('should fallback to SQLite when PostgreSQL unavailable', () => {
            // Simuler l'indisponibilité de PostgreSQL
            vi.mock('pg', () => {
                throw new Error('Module not found');
            });

            const config: VectorStoreConfig = {
                type: 'postgresql',
                postgresql: {
                    host: 'localhost',
                    port: 5432,
                    database: 'test',
                    user: 'test',
                    password: 'test'
                }
            };

            const store = VectorStoreFactory.create(config);
            expect(store).toBeInstanceOf(VectorStoreSQLite);
        });
    });

    describe('Memory Backend', () => {
        // Mock pour le module memory
        const mockMemoryStore = {
            VectorStoreMemory: class MockMemoryStore {
                async initialize() { }
                async store() {
                    return { success: true, id: 'mock-memory-id' };
                }
                async search() {
                    return { results: [], total: 0 };
                }
                async testConnection() {
                    return true;
                }
                async cleanup() { }
                async getStats() {
                    return { totalDocuments: 0, totalVectors: 0, storageSize: 0 };
                }
            }
        };

        beforeEach(() => {
            vi.mock('../src/rag/vector-store-memory.js', () => mockMemoryStore);
        });

        afterEach(() => {
            vi.clearAllMocks();
        });

        it('should create memory store', () => {
            const config: VectorStoreConfig = {
                type: 'memory',
                memory: {
                    maxDocuments: 1000
                }
            };

            const store = VectorStoreFactory.create(config);
            expect(store).toBeDefined();
        });

        it('should fallback to SQLite when memory module unavailable', () => {
            // Simuler l'indisponibilité du module memory
            vi.mock('../src/rag/vector-store-memory.js', () => {
                throw new Error('Module not found');
            });

            const config: VectorStoreConfig = {
                type: 'memory',
                memory: {
                    maxDocuments: 1000
                }
            };

            const store = VectorStoreFactory.create(config);
            expect(store).toBeInstanceOf(VectorStoreSQLite);
        });
    });

    describe('Factory Tests', () => {
        it('should validate configuration', () => {
            const invalidConfig = {} as VectorStoreConfig;

            expect(() => VectorStoreFactory.create(invalidConfig)).toThrow();
        });

        it('should create store from project config', () => {
            const mockProjectPath = '/test/project';
            const mockConfig = {
                type: 'sqlite',
                sqlite: {
                    file: `${mockProjectPath}/rag/db/vectors.sqlite`
                }
            };

            // Mock fs pour simuler la lecture de fichier
            const fs = require('fs');
            vi.spyOn(fs, 'existsSync').mockReturnValue(false);

            const store = VectorStoreFactory.createFromProjectConfig(mockProjectPath);
            expect(store).toBeInstanceOf(VectorStoreSQLite);
        });

        it('should test connection for all backends', async () => {
            const testCases = [
                {
                    type: 'sqlite' as const,
                    config: {
                        sqlite: { file: ':memory:', memory: true }
                    }
                },
                {
                    type: 'postgresql' as const,
                    config: {
                        postgresql: {
                            host: 'localhost',
                            port: 5432,
                            database: 'test',
                            user: 'test',
                            password: 'test'
                        }
                    }
                },
                {
                    type: 'memory' as const,
                    config: {
                        memory: { maxDocuments: 1000 }
                    }
                }
            ];

            for (const testCase of testCases) {
                const config: VectorStoreConfig = {
                    type: testCase.type,
                    ...testCase.config
                };

                const result = await VectorStoreFactory.testConnection(config);
                expect(result.backend).toBe(testCase.type);
                // Le test peut échouer pour PostgreSQL si non disponible, c'est attendu
            }
        });

        it('should list available backends', () => {
            const backends = VectorStoreFactory.getAvailableBackends();

            expect(backends).toHaveLength(3);
            expect(backends.map(b => b.type)).toEqual(['sqlite', 'postgresql', 'memory']);

            // SQLite doit toujours être disponible
            const sqliteBackend = backends.find(b => b.type === 'sqlite');
            expect(sqliteBackend?.available).toBe(true);
        });
    });

    describe('Performance Tests', () => {
        it('should handle concurrent operations', async () => {
            const config: VectorStoreConfig = {
                type: 'sqlite',
                sqlite: {
                    file: ':memory:',
                    memory: true
                }
            };

            const store = VectorStoreFactory.create(config);
            await store.initialize();

            const numOperations = 100;
            const projectPath = '/test/project';

            const startTime = performance.now();

            // Exécuter les opérations en parallèle
            const operations = Array.from({ length: numOperations }, (_, i) => ({
                filePath: `/test/file${i}.txt`,
                content: `Content ${i}`,
                embedding: [i * 0.01, i * 0.02, i * 0.03, i * 0.04]
            }));

            const results = await Promise.all(
                operations.map(async (op) => {
                    await store.embedAndStore(projectPath, op.filePath, op.content, op.embedding);
                    return { success: true };
                })
            );

            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(results).toHaveLength(numOperations);
            expect(results.every(r => r.success)).toBe(true);
            expect(duration).toBeLessThan(5000); // Moins de 5 secondes

            await store.clearAll();
        });

        it('should scale with large datasets', async () => {
            const config: VectorStoreConfig = {
                type: 'sqlite',
                sqlite: {
                    file: ':memory:',
                    memory: true
                }
            };

            const store = VectorStoreFactory.create(config);
            await store.initialize();

            const batchSize = 100;
            const projectPath = '/large/project';

            const startTime = performance.now();

            for (let i = 0; i < batchSize; i++) {
                const embedding = Array.from({ length: 768 }, () => Math.random());
                await store.embedAndStore(
                    projectPath,
                    `/large/dataset/file${i}.txt`,
                    'x'.repeat(100), // Contenu de 100 caractères
                    embedding
                );
            }

            const endTime = performance.now();

            expect(endTime - startTime).toBeLessThan(10000); // Moins de 10 secondes

            const stats = await store.getStats();
            expect(stats.totalDocuments).toBe(batchSize);

            await store.clearAll();
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid embeddings', async () => {
            const config: VectorStoreConfig = {
                type: 'sqlite',
                sqlite: {
                    file: ':memory:',
                    memory: true
                }
            };

            const store = VectorStoreFactory.create(config);
            await store.initialize();

            // Embedding vide
            await expect(
                store.embedAndStore('/test', '/test.txt', 'content', [])
            ).rejects.toThrow();

            await store.clearAll();
        });

        it('should handle database errors gracefully', async () => {
            const config: VectorStoreConfig = {
                type: 'sqlite',
                sqlite: {
                    file: '/invalid/path/db.sqlite', // Chemin invalide
                    memory: false
                }
            };

            // La création devrait échouer
            expect(() => VectorStoreFactory.create(config)).toThrow();
        });

        it('should provide meaningful error messages', async () => {
            const config: VectorStoreConfig = {
                type: 'sqlite',
                sqlite: {
                    file: ':memory:',
                    memory: true
                }
            };

            const store = VectorStoreFactory.create(config);
            await store.initialize();

            try {
                await store.embedAndStore('/test', '/test.txt', 'content', []);
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toContain('embedding');
            }

            await store.clearAll();
        });
    });

    describe('Configuration Validation', () => {
        it('should reject invalid backend types', () => {
            const invalidConfig = {
                type: 'invalid_backend'
            } as unknown as VectorStoreConfig;

            expect(() => VectorStoreFactory.create(invalidConfig)).toThrow('Type de backend non supporté');
        });

        it('should validate SQLite configuration', () => {
            const validConfig: VectorStoreConfig = {
                type: 'sqlite',
                sqlite: {
                    file: 'test.db'
                }
            };

            expect(() => VectorStoreFactory.create(validConfig)).not.toThrow();

            const invalidConfig = {
                type: 'sqlite'
                // sqlite manquant
            } as VectorStoreConfig;

            expect(() => VectorStoreFactory.create(invalidConfig)).toThrow();
        });

        it('should normalize configuration', () => {
            const partialConfig = {
                type: 'sqlite'
            };

            const normalized = VectorStoreFactory['normalizeConfig'](partialConfig);
            expect(normalized.type).toBe('sqlite');
            expect(normalized.sqlite?.file).toBe(':memory:');
            expect(normalized.sqlite?.memory).toBe(false);
        });
    });

    describe('Integration with RAG Pipeline', () => {
        it('should work with indexer', async () => {
            const config: VectorStoreConfig = {
                type: 'sqlite',
                sqlite: {
                    file: ':memory:',
                    memory: true
                }
            };

            const store = VectorStoreFactory.create(config);
            await store.initialize();

            // Simuler l'indexation de documents
            const documents = [
                {
                    projectPath: '/test/project',
                    filePath: '/test/doc1.txt',
                    content: 'Premier document de test',
                    embedding: Array.from({ length: 768 }, () => Math.random())
                },
                {
                    projectPath: '/test/project',
                    filePath: '/test/doc2.txt',
                    content: 'Deuxième document de test',
                    embedding: Array.from({ length: 768 }, () => Math.random())
                }
            ];

            // Stocker les documents
            for (const doc of documents) {
                await store.embedAndStore(doc.projectPath, doc.filePath, doc.content, doc.embedding, {
                    language: 'fr'
                });
            }

            // Rechercher des documents similaires
            const queryEmbedding = documents[0].embedding;
            const results = await store.semanticSearch(queryEmbedding, { limit: 2 });

            expect(results).toHaveLength(2);
            expect(results[0].score).toBeGreaterThan(results[1].score);

            await store.clearAll();
        });

        it('should support incremental updates', async () => {
            const config: VectorStoreConfig = {
                type: 'sqlite',
                sqlite: {
                    file: ':memory:',
                    memory: true
                }
            };

            const store = VectorStoreFactory.create(config);
            await store.initialize();

            const projectPath = '/test/project';

            // Premier lot
            const batch1 = [
                {
                    filePath: '/test/file1.txt',
                    content: 'First document',
                    embedding: [0.1, 0.2, 0.3, 0.4]
                },
                {
                    filePath: '/test/file2.txt',
                    content: 'Second document',
                    embedding: [0.5, 0.6, 0.7, 0.8]
                }
            ];

            for (const doc of batch1) {
                await store.embedAndStore(projectPath, doc.filePath, doc.content, doc.embedding);
            }

            let stats = await store.getStats();
            expect(stats.totalDocuments).toBe(2);

            // Deuxième lot (mise à jour incrémentale)
            const batch2 = [
                {
                    filePath: '/test/file3.txt',
                    content: 'Third document',
                    embedding: [0.9, 1.0, 1.1, 1.2]
                }
            ];

            for (const doc of batch2) {
                await store.embedAndStore(projectPath, doc.filePath, doc.content, doc.embedding);
            }

            stats = await store.getStats();
            expect(stats.totalDocuments).toBe(3);

            await store.clearAll();
        });
    });
});
