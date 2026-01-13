// Tests unitaires Phase 0.3 - LLM Enrichment
// Version: 1.0.0

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LLM_ENRICHER_CONFIG } from '../../src/rag/phase0/llm-enrichment/config.js';
import { LLMEnricherService, getLLMEnricher, initLLMEnricher } from '../../src/rag/phase0/llm-enrichment/index.js';
import { validateEnrichmentInput, validateEnrichmentOutput } from '../../src/rag/phase0/llm-enrichment/schemas.js';

describe('Phase 0.3 - LLM Enrichment Unit Tests', () => {
    let enricher: LLMEnricherService;

    beforeEach(() => {
        // Réinitialiser l'instance singleton avant chaque test
        (global as any).enricherInstance = null;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('1. Feature Flag Tests', () => {
        it('1.1 - Service désactivé par défaut', () => {
            enricher = new LLMEnricherService();
            expect(enricher.isEnrichmentEnabled()).toBe(false);
        });

        it('1.2 - Service activé avec configuration', () => {
            enricher = new LLMEnricherService({ enabled: true });
            expect(enricher.isEnrichmentEnabled()).toBe(true);
        });

        it('1.3 - Mise à jour configuration feature flag', () => {
            enricher = new LLMEnricherService({ enabled: false });
            expect(enricher.isEnrichmentEnabled()).toBe(false);

            enricher.updateConfig({ enabled: true });
            expect(enricher.isEnrichmentEnabled()).toBe(true);

            enricher.updateConfig({ enabled: false });
            expect(enricher.isEnrichmentEnabled()).toBe(false);
        });

        it('1.4 - Singleton pattern', () => {
            const instance1 = initLLMEnricher({ enabled: true });
            const instance2 = getLLMEnricher();
            const instance3 = initLLMEnricher({ enabled: false }); // Doit retourner l'instance existante

            expect(instance1).toBe(instance2);
            expect(instance1).toBe(instance3);
            expect(instance1.isEnrichmentEnabled()).toBe(true); // La première configuration reste
        });
    });

    describe('2. Validation Schemas Tests', () => {
        const validInput = {
            chunkId: 'test-chunk-123',
            content: 'function add(a, b) { return a + b; }',
            metadata: {
                language: 'javascript',
                fileType: 'code',
                filePath: '/test/file.js',
                chunkIndex: 0,
                totalChunks: 1,
                role: 'core' as const,
                contentType: 'code' as const,
            },
            config: DEFAULT_LLM_ENRICHER_CONFIG,
        };

        const validOutput = {
            enrichedContent: 'Fonction addition en JavaScript',
            metadata: {
                summary: 'Fonction utilitaire pour additionner deux nombres',
                keywords: ['addition', 'function', 'utility'],
                entities: ['add', 'a', 'b'],
                complexity: 'low' as const,
                category: 'utility-function',
                language: 'javascript',
                confidence: 0.85,
            },
            confidence: 0.85,
        };

        it('2.1 - Validation entrée valide', () => {
            const result = validateEnrichmentInput(validInput);
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.chunkId).toBe('test-chunk-123');
        });

        it('2.2 - Validation entrée invalide (chunkId manquant)', () => {
            const invalidInput = { ...validInput, chunkId: '' };
            const result = validateEnrichmentInput(invalidInput);
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('2.3 - Validation entrée invalide (contenu vide)', () => {
            const invalidInput = { ...validInput, content: '' };
            const result = validateEnrichmentInput(invalidInput);
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('2.4 - Validation sortie valide', () => {
            const result = validateEnrichmentOutput(validOutput);
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.enrichedContent).toBe('Fonction addition en JavaScript');
        });

        it('2.5 - Validation sortie invalide (contenu enrichi vide)', () => {
            const invalidOutput = { ...validOutput, enrichedContent: '' };
            const result = validateEnrichmentOutput(invalidOutput);
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('2.6 - Validation sortie invalide (confidence hors limites)', () => {
            const invalidOutput = { ...validOutput, confidence: 1.5 };
            const result = validateEnrichmentOutput(invalidOutput);
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('3. Enrichment Service Tests', () => {
        beforeEach(() => {
            enricher = new LLMEnricherService({ enabled: true });
        });

        it('3.1 - Enrichissement chunk unique (service activé)', async () => {
            const chunkId = 'test-chunk-001';
            const content = 'console.log("Hello, World!");';
            const metadata = { language: 'javascript' };

            const result = await enricher.enrichChunk(chunkId, content, metadata);

            expect(result).not.toBeNull();
            expect(result?.id).toBe(chunkId);
            expect(result?.originalContent).toBe(content);
            expect(result?.enrichedContent).toBeDefined();
            expect(result?.metadata.confidence).toBeGreaterThanOrEqual(0);
            expect(result?.metadata.confidence).toBeLessThanOrEqual(1);
            expect(result?.enrichmentTimeMs).toBeGreaterThan(0);
            expect(result?.modelUsed).toBe(DEFAULT_LLM_ENRICHER_CONFIG.model);
        });

        it('3.2 - Enrichissement chunk unique (service désactivé)', async () => {
            enricher = new LLMEnricherService({ enabled: false });
            const result = await enricher.enrichChunk('test-chunk-002', 'test content', {});

            expect(result).toBeNull();
        });

        it('3.3 - Enrichissement batch (service activé)', async () => {
            const chunks = [
                { id: 'chunk-1', content: 'const x = 5;', metadata: { language: 'javascript' } },
                { id: 'chunk-2', content: 'function test() {}', metadata: { language: 'javascript' } },
                { id: 'chunk-3', content: '// Comment', metadata: { language: 'javascript' } },
            ];

            const results = await enricher.enrichBatch(chunks);

            expect(results).toHaveLength(3);
            expect(results.filter(r => r !== null).length).toBeGreaterThan(0);

            // Vérifier que chaque résultat non-null a les propriétés attendues
            results.forEach((result, index) => {
                if (result) {
                    expect(result.id).toBe(chunks[index].id);
                    expect(result.originalContent).toBe(chunks[index].content);
                    expect(result.enrichedContent).toBeDefined();
                    expect(result.metadata.confidence).toBeDefined();
                }
            });
        });

        it('3.4 - Enrichissement batch (service désactivé)', async () => {
            enricher = new LLMEnricherService({ enabled: false });
            const chunks = [
                { id: 'chunk-1', content: 'test', metadata: {} },
            ];

            const results = await enricher.enrichBatch(chunks);

            expect(results).toHaveLength(1);
            expect(results[0]).toBeNull();
        });

        it('3.5 - Batch vide', async () => {
            const results = await enricher.enrichBatch([]);
            expect(results).toHaveLength(0);
        });
    });

    describe('4. Error Handling Tests', () => {
        beforeEach(() => {
            enricher = new LLMEnricherService({ enabled: true });
        });

        it('4.1 - Validation échouée retourne null', async () => {
            // Mock la validation pour échouer
            vi.spyOn(enricher as any, 'validateEnrichmentInput').mockReturnValue({
                success: false,
                error: new Error('Validation failed'),
            });

            const result = await enricher.enrichChunk('invalid-chunk', '', {});
            expect(result).toBeNull();
        });

        it('4.2 - Erreur LLM retourne null', async () => {
            // Mock l'appel LLM pour échouer
            vi.spyOn(enricher as any, 'callLLMForEnrichment').mockRejectedValue(
                new Error('LLM API error')
            );

            const result = await enricher.enrichChunk('error-chunk', 'test content', {});
            expect(result).toBeNull();
        });

        it('4.3 - Validation sortie LLM échouée retourne null', async () => {
            // Mock l'appel LLM pour retourner des données invalides
            vi.spyOn(enricher as any, 'callLLMForEnrichment').mockResolvedValue({
                enrichedContent: '', // Contenu vide invalide
                metadata: {},
                confidence: 0.5,
            });

            const result = await enricher.enrichChunk('invalid-output-chunk', 'test content', {});
            expect(result).toBeNull();
        });
    });

    describe('5. Configuration Tests', () => {
        it('5.1 - Configuration par défaut', () => {
            enricher = new LLMEnricherService();
            const config = enricher.getConfig();

            expect(config.enabled).toBe(false);
            expect(config.provider).toBe('ollama');
            expect(config.model).toBe('llama3.1:latest');
            expect(config.temperature).toBe(0.1);
            expect(config.maxTokens).toBe(1000);
            expect(config.features).toEqual(['summary', 'keywords', 'entities']);
        });

        it('5.2 - Configuration personnalisée', () => {
            const customConfig = {
                enabled: true,
                provider: 'openai' as const,
                model: 'gpt-4',
                temperature: 0.7,
                maxTokens: 2000,
                features: ['summary', 'complexity', 'category'] as any,
            };

            enricher = new LLMEnricherService(customConfig);
            const config = enricher.getConfig();

            expect(config.enabled).toBe(true);
            expect(config.provider).toBe('openai');
            expect(config.model).toBe('gpt-4');
            expect(config.temperature).toBe(0.7);
            expect(config.maxTokens).toBe(2000);
            expect(config.features).toEqual(['summary', 'complexity', 'category']);
        });

        it('5.3 - Mise à jour configuration', () => {
            enricher = new LLMEnricherService({ enabled: false });

            enricher.updateConfig({ enabled: true, temperature: 0.5 });
            const config = enricher.getConfig();

            expect(config.enabled).toBe(true);
            expect(config.temperature).toBe(0.5);
            // Les autres valeurs doivent rester à leurs valeurs par défaut
            expect(config.provider).toBe('ollama');
            expect(config.model).toBe('llama3.1:latest');
        });
    });

    describe('6. Prompts Tests', () => {
        it('6.1 - Import prompts', async () => {
            const prompts = await import('../../src/rag/phase0/llm-enrichment/prompts.js');

            expect(prompts).toBeDefined();
            expect(prompts.CODE_SEMANTIC_ANALYSIS_PROMPT).toBeDefined();
            expect(prompts.DOCUMENTATION_ANALYSIS_PROMPT).toBeDefined();
            expect(prompts.CONFIGURATION_ANALYSIS_PROMPT).toBeDefined();
            expect(prompts.GENERAL_ENRICHMENT_PROMPT).toBeDefined();
        });

        it('6.2 - Structure prompts', async () => {
            const prompts = await import('../../src/rag/phase0/llm-enrichment/prompts.js');

            const codePrompt = prompts.CODE_SEMANTIC_ANALYSIS_PROMPT;
            expect(codePrompt.id).toBe('prompt-code-semantic-001');
            expect(codePrompt.name).toBe('Code Semantic Analysis');
            expect(codePrompt.systemPrompt).toContain('expert en analyse de code source');
            expect(codePrompt.outputFormat.type).toBe('json');
            expect(codePrompt.enabled).toBe(true);
        });

        it('6.3 - Fonctions utilitaires prompts', async () => {
            const prompts = await import('../../src/rag/phase0/llm-enrichment/prompts.js');

            const prompt = prompts.CODE_SEMANTIC_ANALYSIS_PROMPT;
            const userPrompt = prompts.generateUserPrompt(prompt, {
                code: 'function test() {}',
                language: 'javascript',
                fileType: 'code',
                filePath: '/test.js',
            });

            expect(userPrompt).toContain('function test() {}');
            expect(userPrompt).toContain('javascript');
            expect(userPrompt).toContain('/test.js');
        });
    });

    describe('7. Integration Tests', () => {
        it('7.1 - Service intégré dans indexer.ts', async () => {
            // Vérifier que l'import fonctionne
            const indexer = await import('../../src/rag/indexer.js');
            expect(indexer.indexProject).toBeDefined();
            expect(indexer.updateProject).toBeDefined();
        });

        it('7.2 - Configuration Phase 0.3 dans rag-config.json', async () => {
            const fs = await import('fs');
            const path = await import('path');

            const configPath = path.join(process.cwd(), 'config', 'rag-config.json');
            const configData = fs.readFileSync(configPath, 'utf-8');
            const config = JSON.parse(configData);

            expect(config.phase0_3).toBeDefined();
            expect(config.phase0_3.enabled).toBe(false); // Désactivé par défaut
            expect(config.phase0_3.provider).toBe('ollama');
            expect(config.phase0_3.model).toBe('llama3.1:latest');
        });
    });
});

describe('Phase 0.3 - Performance Tests', () => {
    let enricher: LLMEnricherService;

    beforeEach(() => {
        enricher = new LLMEnricherService({ enabled: true });
    });

    it('8.1 - Temps d\'enrichissement raisonnable', async () => {
        const startTime = Date.now();
        const result = await enricher.enrichChunk('perf-test', 'test content', {});
        const endTime = Date.now();
        const duration = endTime - startTime;

        // L'enrichissement ne devrait pas prendre plus de 5 secondes (simulé)
        expect(duration).toBeLessThan(5000);

        if (result) {
            expect(result.enrichmentTimeMs).toBeGreaterThan(0);
            expect(result.enrichmentTimeMs).toBeLessThanOrEqual(duration);
        }
    });

    it('8.2 - Batch processing performance', async () => {
        const chunks = Array.from({ length: 10 }, (_, i) => ({
            id: `chunk-${i}`,
            content: `Content ${i}`,
            metadata: { index: i },
        }));

        const startTime = Date.now();
        const results = await enricher.enrichBatch(chunks);
        const endTime = Date.now();
        const duration = endTime - startTime;

        // 10 chunks ne devraient pas prendre plus de 10 secondes
        expect(duration).toBeLessThan(10000);
        expect(results).toHaveLength(10);
    });
});

console.log('✅ Tous les tests unitaires Phase 0.3 sont définis');
console.log('📋 Résumé des tests:');
console.log('  1. Feature Flag Tests (4 tests)');
console.log('  2. Validation Schemas Tests (6 tests)');
console.log('  3. Enrichment Service Tests (5 tests)');
console.log('  4. Error Handling Tests (3 tests)');
console.log('  5. Configuration Tests (3 tests)');
console.log('  6. Prompts Tests (3 tests)');
console.log('  7. Integration Tests (2 tests)');
console.log('  8. Performance Tests (2 tests)');
console.log('  Total: 28 tests unitaires');
