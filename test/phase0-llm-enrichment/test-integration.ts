// Tests d'intégration Phase 0.3 - Pipeline complet
// Version: 1.0.0

import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRagConfigManager } from '../../src/config/rag-config.js';
import { indexProject, updateProject } from '../../src/rag/indexer.js';
import { initLLMEnricher } from '../../src/rag/phase0/llm-enrichment/index.js';

describe('Phase 0.3 - Integration Tests', () => {
    const testProjectPath = path.join(__dirname, '..', '..', 'test-data', 'integration-test');
    let originalConfig: any;

    beforeEach(async () => {
        // Sauvegarder la configuration originale
        const configManager = getRagConfigManager();
        originalConfig = configManager.getConfig();

        // Créer le répertoire de test si nécessaire
        if (!fs.existsSync(testProjectPath)) {
            fs.mkdirSync(testProjectPath, { recursive: true });
        }

        // Réinitialiser l'instance singleton
        (global as any).enricherInstance = null;
    });

    afterEach(async () => {
        // Restaurer la configuration originale
        const configManager = getRagConfigManager();
        const configPath = path.join(process.cwd(), 'config', 'rag-config.json');
        fs.writeFileSync(configPath, JSON.stringify(originalConfig, null, 2));

        // Nettoyer les fichiers de test
        if (fs.existsSync(testProjectPath)) {
            const files = fs.readdirSync(testProjectPath);
            for (const file of files) {
                fs.unlinkSync(path.join(testProjectPath, file));
            }
        }
    });

    describe('1. Pipeline Integration Tests', () => {
        it('1.1 - Pipeline complet avec Phase 0.3 désactivée', async () => {
            // Créer un fichier de test simple
            const testFile = path.join(testProjectPath, 'test.js');
            fs.writeFileSync(testFile, `
        // Test JavaScript file
        function add(a, b) {
          return a + b;
        }

        function multiply(a, b) {
          return a * b;
        }

        // Export the functions
        module.exports = { add, multiply };
      `);

            // Indexer le projet avec Phase 0.3 désactivée
            const stats = await indexProject(testProjectPath, {
                filePatterns: ['**/*.js'],
                recursive: false,
                chunkSize: 500,
                chunkOverlap: 100,
            });

            // Vérifier les statistiques
            expect(stats.totalFiles).toBe(1);
            expect(stats.indexedFiles).toBe(1);
            expect(stats.chunksCreated).toBeGreaterThan(0);
            expect(stats.errors).toBe(0);

            // Vérifier que le service LLM Enricher n'a pas été utilisé
            const enricher = initLLMEnricher();
            expect(enricher.isEnrichmentEnabled()).toBe(false);
        });

        it('1.2 - Pipeline complet avec Phase 0.3 activée (simulée)', async () => {
            // Activer Phase 0.3 dans la configuration
            const configManager = getRagConfigManager();
            const config = configManager.getConfig();
            config.phase0_3 = {
                ...config.phase0_3,
                enabled: true,
                provider: 'fake', // Utiliser le provider fake pour les tests
                model: 'test-model',
                temperature: 0.1,
                max_tokens: 500,
                timeout_ms: 10000,
                batch_size: 2,
                features: ['summary', 'keywords'],
                cache_enabled: false,
            };

            const configPath = path.join(process.cwd(), 'config', 'rag-config.json');
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

            // Créer un fichier de test
            const testFile = path.join(testProjectPath, 'test-code.js');
            fs.writeFileSync(testFile, `
        // Calculator module
        class Calculator {
          add(x, y) {
            return x + y;
          }

          subtract(x, y) {
            return x - y;
          }

          multiply(x, y) {
            return x * y;
          }

          divide(x, y) {
            if (y === 0) throw new Error('Division by zero');
            return x / y;
          }
        }

        module.exports = Calculator;
      `);

            // Mock le service LLM Enricher pour retourner des données simulées
            const mockEnricher = {
                isEnrichmentEnabled: vi.fn().mockReturnValue(true),
                enrichBatch: vi.fn().mockResolvedValue([
                    {
                        id: 'test-code.js#chunk0',
                        originalContent: 'class Calculator {',
                        enrichedContent: 'Classe Calculator avec méthodes mathématiques',
                        metadata: {
                            summary: 'Classe de calculatrice avec opérations basiques',
                            keywords: ['calculator', 'math', 'operations'],
                            entities: ['Calculator', 'add', 'subtract', 'multiply', 'divide'],
                            complexity: 'low',
                            category: 'utility-class',
                            language: 'javascript',
                            confidence: 0.9,
                        },
                        enrichmentTimeMs: 100,
                        modelUsed: 'test-model',
                        timestamp: new Date(),
                    },
                ]),
                getConfig: vi.fn().mockReturnValue({
                    enabled: true,
                    provider: 'fake',
                    model: 'test-model',
                }),
            };

            // Remplacer l'instance singleton
            (global as any).enricherInstance = mockEnricher;

            // Indexer le projet
            const stats = await indexProject(testProjectPath, {
                filePatterns: ['**/*.js'],
                recursive: false,
                chunkSize: 1000,
                chunkOverlap: 200,
            });

            // Vérifier les statistiques
            expect(stats.totalFiles).toBe(1);
            expect(stats.indexedFiles).toBe(1);
            expect(stats.chunksCreated).toBeGreaterThan(0);
            expect(stats.errors).toBe(0);

            // Vérifier que le service d'enrichissement a été appelé
            expect(mockEnricher.isEnrichmentEnabled).toHaveBeenCalled();
            expect(mockEnricher.enrichBatch).toHaveBeenCalled();
        });

        it('1.3 - Pipeline avec différents types de fichiers', async () => {
            // Créer plusieurs fichiers de différents types
            const files = [
                { name: 'code.js', content: 'console.log("Hello");' },
                { name: 'doc.md', content: '# Documentation\n\nThis is a test document.' },
                { name: 'config.json', content: '{"test": true, "value": 42}' },
            ];

            for (const file of files) {
                const filePath = path.join(testProjectPath, file.name);
                fs.writeFileSync(filePath, file.content);
            }

            // Indexer le projet
            const stats = await indexProject(testProjectPath, {
                filePatterns: ['**/*.{js,md,json}'],
                recursive: false,
                chunkSize: 300,
                chunkOverlap: 50,
            });

            // Vérifier les statistiques
            expect(stats.totalFiles).toBe(3);
            expect(stats.indexedFiles).toBe(3);
            expect(stats.chunksCreated).toBeGreaterThan(0);
            expect(stats.errors).toBe(0);
        });
    });

    describe('2. Performance Integration Tests', () => {
        it('2.1 - Performance indexation avec Phase 0.3 désactivée', async () => {
            // Créer un fichier de taille moyenne
            const testFile = path.join(testProjectPath, 'perf-test.js');
            let content = '// Performance test file\n';
            for (let i = 0; i < 100; i++) {
                content += `function func${i}() { return ${i} * 2; }\n`;
            }
            fs.writeFileSync(testFile, content);

            // Mesurer le temps d'exécution
            const startTime = Date.now();
            const stats = await indexProject(testProjectPath, {
                filePatterns: ['**/*.js'],
                recursive: false,
                chunkSize: 500,
                chunkOverlap: 100,
            });
            const endTime = Date.now();
            const duration = endTime - startTime;

            // Vérifier les statistiques
            expect(stats.totalFiles).toBe(1);
            expect(stats.indexedFiles).toBe(1);
            expect(stats.chunksCreated).toBeGreaterThan(0);

            // Le temps d'exécution devrait être raisonnable (moins de 30 secondes)
            expect(duration).toBeLessThan(30000);
            console.log(`Performance test (Phase 0.3 désactivée): ${duration}ms, ${stats.chunksCreated} chunks`);
        });

        it('2.2 - Performance indexation avec Phase 0.3 activée (simulée)', async () => {
            // Activer Phase 0.3
            const configManager = getRagConfigManager();
            const config = configManager.getConfig();
            config.phase0_3 = {
                ...config.phase0_3,
                enabled: true,
                provider: 'fake',
                model: 'test-model',
                batch_size: 5,
            };

            const configPath = path.join(process.cwd(), 'config', 'rag-config.json');
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

            // Créer un fichier de test
            const testFile = path.join(testProjectPath, 'perf-test-2.js');
            let content = '// Performance test with Phase 0.3\n';
            for (let i = 0; i < 50; i++) {
                content += `class Class${i} {\n  method${i}() { return ${i}; }\n}\n`;
            }
            fs.writeFileSync(testFile, content);

            // Mock le service d'enrichissement pour simuler un délai
            const mockEnricher = {
                isEnrichmentEnabled: vi.fn().mockReturnValue(true),
                enrichBatch: vi.fn().mockImplementation(async (chunks) => {
                    // Simuler un délai d'enrichissement
                    await new Promise(resolve => setTimeout(resolve, 50));
                    return chunks.map(chunk => ({
                        id: chunk.id,
                        originalContent: chunk.content,
                        enrichedContent: `Enriched: ${chunk.content.substring(0, 50)}...`,
                        metadata: {
                            summary: 'Test summary',
                            keywords: ['test'],
                            confidence: 0.8,
                        },
                        enrichmentTimeMs: 50,
                        modelUsed: 'test-model',
                        timestamp: new Date(),
                    }));
                }),
            };

            (global as any).enricherInstance = mockEnricher;

            // Mesurer le temps d'exécution
            const startTime = Date.now();
            const stats = await indexProject(testProjectPath, {
                filePatterns: ['**/*.js'],
                recursive: false,
                chunkSize: 300,
                chunkOverlap: 50,
            });
            const endTime = Date.now();
            const duration = endTime - startTime;

            // Vérifier les statistiques
            expect(stats.totalFiles).toBe(1);
            expect(stats.indexedFiles).toBe(1);
            expect(stats.chunksCreated).toBeGreaterThan(0);

            // Le temps devrait être légèrement plus élevé avec l'enrichissement
            // mais toujours raisonnable (moins de 60 secondes)
            expect(duration).toBeLessThan(60000);
            console.log(`Performance test (Phase 0.3 activée): ${duration}ms, ${stats.chunksCreated} chunks`);
        });

        it('2.3 - Comparaison performance Phase 0.3 activée vs désactivée', async () => {
            // Ce test compare les performances (à exécuter manuellement)
            console.log('Note: Pour une comparaison complète des performances,');
            console.log('exécutez les tests 2.1 et 2.2 et comparez les durées.');
        });
    });

    describe('3. Error Handling Integration Tests', () => {
        it('3.1 - Erreur LLM pendant l\'indexation', async () => {
            // Activer Phase 0.3
            const configManager = getRagConfigManager();
            const config = configManager.getConfig();
            config.phase0_3 = {
                ...config.phase0_3,
                enabled: true,
                provider: 'fake',
                model: 'test-model',
            };

            const configPath = path.join(process.cwd(), 'config', 'rag-config.json');
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

            // Créer un fichier de test
            const testFile = path.join(testProjectPath, 'error-test.js');
            fs.writeFileSync(testFile, 'console.log("Test");');

            // Mock le service pour simuler une erreur LLM
            const mockEnricher = {
                isEnrichmentEnabled: vi.fn().mockReturnValue(true),
                enrichBatch: vi.fn().mockRejectedValue(new Error('LLM API timeout')),
            };

            (global as any).enricherInstance = mockEnricher;

            // L'indexation devrait quand même réussir (l'erreur est catchée)
            const stats = await indexProject(testProjectPath, {
                filePatterns: ['**/*.js'],
                recursive: false,
                chunkSize: 500,
                chunkOverlap: 100,
            });

            // Le fichier devrait être indexé même avec l'erreur LLM
            expect(stats.totalFiles).toBe(1);
            expect(stats.indexedFiles).toBe(1);
            expect(stats.chunksCreated).toBeGreaterThan(0);
            expect(stats.errors).toBe(0); // L'erreur LLM est catchée, donc pas d'erreur dans les stats
        });

        it('3.2 - Fichier invalide (trop petit)', async () => {
            // Créer un fichier trop petit
            const testFile = path.join(testProjectPath, 'tiny.js');
            fs.writeFileSync(testFile, '//');

            const stats = await indexProject(testProjectPath, {
                filePatterns: ['**/*.js'],
                recursive: false,
            });

            // Le fichier devrait être ignoré
            expect(stats.totalFiles).toBe(1);
            expect(stats.ignoredFiles).toBe(1);
            expect(stats.indexedFiles).toBe(0);
            expect(stats.chunksCreated).toBe(0);
        });

        it('3.3 - Fichier avec encodage invalide', async () => {
            // Créer un fichier binaire (non texte)
            const testFile = path.join(testProjectPath, 'binary.bin');
            const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
            fs.writeFileSync(testFile, buffer);

            const stats = await indexProject(testProjectPath, {
                filePatterns: ['**/*.bin'],
                recursive: false,
            });

            // Le fichier devrait être ignoré ou causer une erreur
            expect(stats.totalFiles).toBe(1);
            // Soit ignoré, soit erreur selon l'implémentation
            expect(stats.ignoredFiles + stats.errors).toBeGreaterThan(0);
        });
    });

    describe('4. Update Project Integration Tests', () => {
        it('4.1 - Mise à jour avec Phase 0.3 désactivée', async () => {
            // Créer un fichier initial
            const testFile = path.join(testProjectPath, 'update-test.js');
            fs.writeFileSync(testFile, '// Version 1\nconst x = 1;');

            // Indexer initialement
            await indexProject(testProjectPath, {
                filePatterns: ['**/*.js'],
                recursive: false,
            });

            // Modifier le fichier
            fs.writeFileSync(testFile, '// Version 2\nconst x = 2;\nconst y = 3;');

            // Mettre à jour
            const stats = await updateProject(testProjectPath, {
                filePatterns: ['**/*.js'],
                recursive: false,
            });

            // Vérifier les statistiques
            expect(stats.totalFiles).toBe(1);
            expect(stats.modifiedFiles).toBe(1);
            expect(stats.chunksCreated).toBeGreaterThan(0);
        });

        it('4.2 - Mise à jour avec Phase 0.3 activée', async () => {
            // Activer Phase 0.3
            const configManager = getRagConfigManager();
            const config = configManager.getConfig();
            config.phase0_3 = {
                ...config.phase0_3,
                enabled: true,
                provider: 'fake',
                model: 'test-model',
            };

            const configPath = path.join(process.cwd(), 'config', 'rag-config.json');
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

            // Créer un fichier initial
            const testFile = path.join(testProjectPath, 'update-test-2.js');
            fs.writeFileSync(testFile, '// Initial version\nfunction init() {}');

            // Mock le service
            const mockEnricher = {
                isEnrichmentEnabled: vi.fn().mockReturnValue(true),
                enrichBatch: vi.fn().mockResolvedValue([
                    {
                        id: 'update-test-2.js#chunk0',
                        originalContent: '// Initial version',
                        enrichedContent: 'Enriched initial version',
                        metadata: { summary: 'Initial function', confidence: 0.8 },
                        enrichmentTimeMs: 50,
                        modelUsed: 'test-model',
                        timestamp: new Date(),
                    },
                ]),
            };

            (global as any).enricherInstance = mockEnricher;

            // Indexer initialement
            await indexProject(testProjectPath, {
                filePatterns: ['**/*.js'],
                recursive: false,
            });

            // Modifier le fichier
            fs.writeFileSync(testFile, '// Updated version\nfunction updated() { return 42; }');

            // Mettre à jour
            const stats = await updateProject(testProjectPath, {
                filePatterns: ['**/*.js'],
                recursive: false,
            });

            // Vérifier les statistiques
            expect(stats.totalFiles).toBe(1);
            expect(stats.modifiedFiles).toBe(1);
            expect(stats.chunksCreated).toBeGreaterThan(0);
            expect(mockEnricher.enrichBatch).toHaveBeenCalled();
        });
    });
});
