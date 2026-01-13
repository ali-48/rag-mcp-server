// Tests de rétro-compatibilité Phase 0.3
// Version: 1.0.0
// Objectif: Tester que Phase 0.3 désactivée ne brise pas Phase 0.1/0.2 existantes
import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getRagConfigManager } from '../../src/config/rag-config.js';
import { indexProject } from '../../src/rag/indexer.js';
import { initLLMEnricher } from '../../src/rag/phase0/llm-enrichment/index.js';
describe('Phase 0.3 - Tests Rétro-compatibilité', () => {
    const testProjectPath = path.join(__dirname, '..', '..', 'test-data', 'retrocompatibility-test');
    let originalConfig;
    beforeEach(async () => {
        // Sauvegarder la configuration originale
        const configManager = getRagConfigManager();
        originalConfig = configManager.getConfig();
        // Créer le répertoire de test si nécessaire
        if (!fs.existsSync(testProjectPath)) {
            fs.mkdirSync(testProjectPath, { recursive: true });
        }
        // Réinitialiser l'instance singleton
        global.enricherInstance = null;
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
    describe('1. Rétro-compatibilité Phase 0.1', () => {
        it('1.1 - Phase 0.1 fonctionne avec Phase 0.3 désactivée', async () => {
            // S'assurer que Phase 0.3 est désactivée
            const configManager = getRagConfigManager();
            const config = configManager.getConfig();
            config.phase0_3 = {
                ...config.phase0_3,
                enabled: false,
            };
            const configPath = path.join(process.cwd(), 'config', 'rag-config.json');
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            // Créer un fichier de test simple
            const testFile = path.join(testProjectPath, 'test-phase0-1.js');
            fs.writeFileSync(testFile, `
        // Test file for Phase 0.1 compatibility
        console.log('Phase 0.1 test');
        
        function testFunction() {
          return 'Hello from Phase 0.1';
        }
        
        module.exports = { testFunction };
      `);
            // Indexer le projet
            const stats = await indexProject(testProjectPath, {
                filePatterns: ['**/*.js'],
                recursive: false,
                chunkSize: 500,
                chunkOverlap: 100,
            });
            // Vérifier que l'indexation a réussi
            expect(stats.totalFiles).toBe(1);
            expect(stats.indexedFiles).toBe(1);
            expect(stats.chunksCreated).toBeGreaterThan(0);
            expect(stats.errors).toBe(0);
            // Vérifier que Phase 0.3 est bien désactivée
            const enricher = initLLMEnricher();
            expect(enricher.isEnrichmentEnabled()).toBe(false);
            // Vérifier qu'aucune métrique Phase 0.3 n'est présente
            expect(stats.phase03Metrics).toBeUndefined();
        });
        it('1.2 - Phase 0.1 fonctionne avec Phase 0.3 activée mais non utilisée', async () => {
            // Activer Phase 0.3 mais avec provider fake (pas d'appel réel)
            const configManager = getRagConfigManager();
            const config = configManager.getConfig();
            config.phase0_3 = {
                ...config.phase0_3,
                enabled: true,
                provider: 'fake', // Utiliser fake provider pour éviter les appels LLM
                model: 'test-model',
            };
            const configPath = path.join(process.cwd(), 'config', 'rag-config.json');
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            // Créer un fichier de test
            const testFile = path.join(testProjectPath, 'test-phase0-1-2.js');
            fs.writeFileSync(testFile, `
        // Another test file
        const config = {
          phase0_1: 'workspace-detector',
          phase0_2: 'ai-segmenter',
          phase0_3: 'llm-enricher'
        };
        
        export default config;
      `);
            // Indexer le projet
            const stats = await indexProject(testProjectPath, {
                filePatterns: ['**/*.js'],
                recursive: false,
                chunkSize: 500,
                chunkOverlap: 100,
            });
            // Vérifier que l'indexation a réussi
            expect(stats.totalFiles).toBe(1);
            expect(stats.indexedFiles).toBe(1);
            expect(stats.chunksCreated).toBeGreaterThan(0);
            expect(stats.errors).toBe(0);
            // Vérifier que Phase 0.3 est activée
            const enricher = initLLMEnricher();
            expect(enricher.isEnrichmentEnabled()).toBe(true);
            // Vérifier que les métriques Phase 0.3 sont présentes
            expect(stats.phase03Metrics).toBeDefined();
            expect(stats.phase03Metrics.enabled).toBe(true);
        });
    });
    describe('2. Rétro-compatibilité Phase 0.2', () => {
        it('2.1 - Phase 0.2 (chunking intelligent) fonctionne avec Phase 0.3 désactivée', async () => {
            // Désactiver Phase 0.3
            const configManager = getRagConfigManager();
            const config = configManager.getConfig();
            config.phase0_3 = {
                ...config.phase0_3,
                enabled: false,
            };
            const configPath = path.join(process.cwd(), 'config', 'rag-config.json');
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            // Créer un fichier avec structure complexe pour tester le chunking intelligent
            const testFile = path.join(testProjectPath, 'complex-structure.js');
            fs.writeFileSync(testFile, `
        // Complex JavaScript file with multiple functions and classes
        // Phase 0.2 should chunk this intelligently
        
        // Utility functions
        function add(a, b) {
          return a + b;
        }
        
        function multiply(a, b) {
          return a * b;
        }
        
        // Calculator class
        class Calculator {
          constructor() {
            this.result = 0;
          }
          
          calculate(operation, x, y) {
            switch(operation) {
              case 'add':
                this.result = add(x, y);
                break;
              case 'multiply':
                this.result = multiply(x, y);
                break;
              default:
                throw new Error('Unknown operation');
            }
            return this.result;
          }
          
          reset() {
            this.result = 0;
          }
        }
        
        // Configuration object
        const config = {
          version: '1.0.0',
          features: ['add', 'multiply', 'calculator'],
          enabled: true
        };
        
        module.exports = { Calculator, config };
      `);
            // Indexer avec différents paramètres de chunking
            const stats = await indexProject(testProjectPath, {
                filePatterns: ['**/*.js'],
                recursive: false,
                chunkSize: 300, // Petit chunk size pour tester le chunking intelligent
                chunkOverlap: 50,
            });
            // Vérifier que l'indexation a réussi
            expect(stats.totalFiles).toBe(1);
            expect(stats.indexedFiles).toBe(1);
            expect(stats.chunksCreated).toBeGreaterThan(1); // Devrait créer plusieurs chunks
            expect(stats.errors).toBe(0);
            // Vérifier que Phase 0.3 est désactivée
            const enricher = initLLMEnricher();
            expect(enricher.isEnrichmentEnabled()).toBe(false);
        });
        it('2.2 - Phase 0.2 avec différents types de fichiers (code, doc, config)', async () => {
            // Désactiver Phase 0.3
            const configManager = getRagConfigManager();
            const config = configManager.getConfig();
            config.phase0_3 = {
                ...config.phase0_3,
                enabled: false,
            };
            const configPath = path.join(process.cwd(), 'config', 'rag-config.json');
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            // Créer plusieurs fichiers de différents types
            const files = [
                {
                    name: 'code.js',
                    content: `
            // JavaScript code file
            export function hello() {
              return 'Hello World';
            }
            
            export const PI = 3.14159;
          `
                },
                {
                    name: 'documentation.md',
                    content: `
            # Documentation
            
            ## Overview
            This is a test documentation file.
            
            ## Features
            - Feature 1
            - Feature 2
            - Feature 3
            
            ## Usage
            \`\`\`javascript
            import { hello } from './code.js';
            console.log(hello());
            \`\`\`
          `
                },
                {
                    name: 'config.json',
                    content: JSON.stringify({
                        version: '1.0.0',
                        settings: {
                            debug: true,
                            timeout: 5000,
                            retries: 3
                        },
                        phases: {
                            phase0_1: true,
                            phase0_2: true,
                            phase0_3: false
                        }
                    }, null, 2)
                }
            ];
            for (const file of files) {
                const filePath = path.join(testProjectPath, file.name);
                fs.writeFileSync(filePath, file.content);
            }
            // Indexer tous les types de fichiers
            const stats = await indexProject(testProjectPath, {
                filePatterns: ['**/*.{js,md,json}'],
                recursive: false,
                chunkSize: 400,
                chunkOverlap: 100,
            });
            // Vérifier que tous les fichiers ont été indexés
            expect(stats.totalFiles).toBe(3);
            expect(stats.indexedFiles).toBe(3);
            expect(stats.chunksCreated).toBeGreaterThan(0);
            expect(stats.errors).toBe(0);
            // Vérifier qu'aucun enrichissement n'a été effectué
            const enricher = initLLMEnricher();
            expect(enricher.isEnrichmentEnabled()).toBe(false);
        });
    });
    describe('3. Configuration rétro-compatible', () => {
        it('3.1 - Configuration sans section phase0_3 (backward compatibility)', async () => {
            // Créer une configuration sans section phase0_3 (simuler ancienne version)
            const configManager = getRagConfigManager();
            const config = configManager.getConfig();
            // Supprimer la section phase0_3 pour simuler ancienne config
            delete config.phase0_3;
            const configPath = path.join(process.cwd(), 'config', 'rag-config.json');
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            // Recharger la configuration
            const reloadedConfig = getRagConfigManager().getConfig();
            // Vérifier que la configuration est valide même sans phase0_3
            expect(reloadedConfig).toBeDefined();
            expect(reloadedConfig.defaults).toBeDefined();
            expect(reloadedConfig.providers).toBeDefined();
            expect(reloadedConfig.limits).toBeDefined();
            // Vérifier que le service LLM Enricher s'initialise correctement
            const enricher = initLLMEnricher();
            expect(enricher).toBeDefined();
            // Par défaut, Phase 0.3 devrait être désactivée si non configurée
            expect(enricher.isEnrichmentEnabled()).toBe(false);
        });
        it('3.2 - Migration depuis ancienne version (ajout phase0_3)', async () => {
            // Simuler une ancienne configuration
            const oldConfig = {
                version: '1.0.0',
                description: 'Old configuration without phase0_3',
                defaults: {
                    embedding_provider: 'fake',
                    embedding_model: 'nomic-embed-text',
                    chunk_size: 1000,
                    chunk_overlap: 200,
                },
                providers: {
                    fake: { description: 'Fake provider', models: ['nomic-embed-text'] },
                    ollama: { description: 'Ollama', models: ['nomic-embed-text'] }
                },
                limits: {
                    chunk_size: { min: 100, max: 10000, default: 1000 },
                    chunk_overlap: { min: 0, max: 1000, default: 200 }
                }
                // Pas de section phase0_3
            };
            const configPath = path.join(process.cwd(), 'config', 'rag-config.json');
            fs.writeFileSync(configPath, JSON.stringify(oldConfig, null, 2));
            // Recharger la configuration
            const configManager = getRagConfigManager();
            const reloadedConfig = configManager.getConfig();
            // Vérifier que la configuration est valide
            expect(reloadedConfig).toBeDefined();
            // Vérifier que le service LLM Enricher s'initialise avec des valeurs par défaut
            const enricher = initLLMEnricher();
            expect(enricher).toBeDefined();
            expect(enricher.isEnrichmentEnabled()).toBe(false); // Désactivé par défaut
            // Créer un fichier de test
            const testFile = path.join(testProjectPath, 'migration-test.js');
            fs.writeFileSync(testFile, '// Migration test file\nconsole.log("Migration successful");');
            // Indexer pour vérifier que tout fonctionne
            const stats = await indexProject(testProjectPath, {
                filePatterns: ['**/*.js'],
                recursive: false,
            });
            expect(stats.totalFiles).toBe(1);
            expect(stats.indexedFiles).toBe(1);
            expect(stats.errors).toBe(0);
        });
    });
    describe('4. Performance rétro-compatible', () => {
        it('4.1 - Performance avec Phase 0.3 désactivée', async () => {
            // Désactiver Phase 0.3
            const configManager = getRagConfigManager();
            const config = configManager.getConfig();
            config.phase0_3 = {
                ...config.phase0_3,
                enabled: false,
            };
            const configPath = path.join(process.cwd(), 'config', 'rag-config.json');
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            // Créer un fichier de taille moyenne
            const testFile = path.join(testProjectPath, 'performance-test.js');
            let content = '// Performance test without Phase 0.3\n';
            for (let i = 0; i < 50; i++) {
                content += `function func${i}() {\n  return ${i} * Math.random();\n}\n\n`;
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
            expect(stats.errors).toBe(0);
            console.log(`Performance sans Phase 0.3: ${duration}ms, ${stats.chunksCreated} chunks`);
        });
        it('4.2 - Performance avec Phase 0.3 activée (fake provider)', async () => {
            // Activer Phase 0.3 avec provider fake
            const configManager = getRagConfigManager();
            const config = configManager.getConfig();
            config.phase0_3 = {
                ...config.phase0_3,
                enabled: true,
                provider: 'fake',
                model: 'test-model',
                batch_size: 10,
            };
            const configPath = path.join(process.cwd(), 'config', 'rag-config.json');
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            // Créer un fichier de test
            const testFile = path.join(testProjectPath, 'performance-test-2.js');
            let content = '// Performance test with Phase 0.3 (fake)\n';
            for (let i = 0; i < 50; i++) {
                content += `function func${i}() {\n  return ${i} * Math.random();\n}\n\n`;
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
            expect(stats.errors).toBe(0);
            // Vérifier que Phase 0.3 est activée
            const enricher = initLLMEnricher();
            expect(enricher.isEnrichmentEnabled()).toBe(true);
            // Vérifier que les métriques Phase 0.3 sont présentes
            expect(stats.phase03Metrics).toBeDefined();
            expect(stats.phase03Metrics.enabled).toBe(true);
            console.log(`Performance avec Phase 0.3 (fake): ${duration}ms, ${stats.chunksCreated} chunks`);
        });
    });
});
//# sourceMappingURL=test-retrocompatibility.js.map