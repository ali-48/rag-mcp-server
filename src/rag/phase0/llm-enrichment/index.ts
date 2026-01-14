// Phase 0.3 - LLM Enrichment Module
// Version: 1.0.0
// Description: Module d'enrichissement des chunks via LLM avant embeddings

import { getGlobalLogger } from '../event-logger.js';
import { LLMEnricherConfig } from './config.js';
import { validateEnrichmentInput, validateEnrichmentOutput } from './schemas.js';

const logger = getGlobalLogger();

/**
 * Interface pour les chunks enrichis
 */
export interface EnrichedChunk {
    id: string;
    originalContent: string;
    enrichedContent: string;
    metadata: {
        summary?: string;
        keywords?: string[];
        entities?: string[];
        complexity?: 'low' | 'medium' | 'high';
        category?: string;
        language?: string;
        confidence: number;
    };
    enrichmentTimeMs: number;
    modelUsed: string;
    timestamp: Date;
}

/**
 * Interface pour les métriques d'enrichissement
 */
export interface EnrichmentMetrics {
    totalChunksProcessed: number;
    totalChunksEnriched: number;
    totalEnrichmentTimeMs: number;
    averageEnrichmentTimeMs: number;
    successRate: number;
    errors: number;
    byModel: Record<string, {
        count: number;
        totalTimeMs: number;
        errors: number;
    }>;
    lastUpdated: Date;
}

/**
 * Service d'enrichissement LLM
 */
export class LLMEnricherService {
    private config: LLMEnricherConfig;
    private isEnabled: boolean;
    private metrics: EnrichmentMetrics;

    constructor(config?: Partial<LLMEnricherConfig>) {
        this.config = {
            enabled: config?.enabled ?? false,
            provider: config?.provider ?? 'ollama',
            model: config?.model ?? 'llama3.1:latest',
            temperature: config?.temperature ?? 0.1,
            maxTokens: config?.maxTokens ?? 1000,
            timeoutMs: config?.timeoutMs ?? null,
            batchSize: config?.batchSize ?? 5,
            features: config?.features ?? ['summary', 'keywords', 'entities'],
            cacheEnabled: config?.cacheEnabled ?? true,
            cacheTtlSeconds: config?.cacheTtlSeconds ?? 3600,
        };
        this.isEnabled = this.config.enabled;

        // Initialisation des métriques
        this.metrics = {
            totalChunksProcessed: 0,
            totalChunksEnriched: 0,
            totalEnrichmentTimeMs: 0,
            averageEnrichmentTimeMs: 0,
            successRate: 1.0,
            errors: 0,
            byModel: {},
            lastUpdated: new Date(),
        };

        logger.info(`Phase 0.3 - LLM Enricher initialisé: ${this.isEnabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`, 'LLMEnricherService');
        if (this.isEnabled) {
            logger.info(`Configuration: ${this.config.provider}/${this.config.model}`, 'LLMEnricherService');
        }
    }

    /**
     * Vérifie si l'enrichissement est activé
     */
    isEnrichmentEnabled(): boolean {
        return this.isEnabled;
    }

    /**
     * Enrichit un chunk unique
     */
    async enrichChunk(chunkId: string, content: string, metadata: any): Promise<EnrichedChunk | null> {
        if (!this.isEnabled) {
            logger.debug(`Phase 0.3 désactivée, skip enrichissement pour chunk: ${chunkId}`, 'LLMEnricherService');
            return null;
        }

        // Mise à jour des métriques: chunks traités
        this.updateMetrics('processed', 0, false);

        try {
            // Validation de l'entrée
            const inputValidation = validateEnrichmentInput({
                chunkId,
                content,
                metadata,
                config: this.config
            });

            if (!inputValidation.success) {
                logger.warn(`Validation échouée pour chunk ${chunkId}: ${JSON.stringify(inputValidation.error)}`, 'LLMEnricherService');
                this.updateMetrics('error', 0, false);
                return null;
            }

            logger.debug(`Enrichissement chunk ${chunkId} (${content.length} chars)`, 'LLMEnricherService');

            // Appel LLM pour enrichissement
            const startTime = Date.now();
            const enrichedData = await this.callLLMForEnrichment(content, metadata);
            const enrichmentTimeMs = Date.now() - startTime;

            // Validation de la sortie
            const outputValidation = validateEnrichmentOutput(enrichedData);
            if (!outputValidation.success) {
                logger.warn(`Sortie LLM invalide pour chunk ${chunkId}: ${JSON.stringify(outputValidation.error)}`, 'LLMEnricherService');
                this.updateMetrics('error', enrichmentTimeMs, false);
                return null;
            }

            const enrichedChunk: EnrichedChunk = {
                id: chunkId,
                originalContent: content,
                enrichedContent: enrichedData.enrichedContent,
                metadata: {
                    ...enrichedData.metadata,
                    confidence: enrichedData.confidence,
                },
                enrichmentTimeMs,
                modelUsed: this.config.model,
                timestamp: new Date(),
            };

            // Mise à jour des métriques: succès
            this.updateMetrics('success', enrichmentTimeMs, true);

            logger.info(`Chunk ${chunkId} enrichi avec succès (${enrichmentTimeMs}ms)`, 'LLMEnricherService');
            return enrichedChunk;

        } catch (error) {
            logger.error(`Erreur enrichissement chunk ${chunkId}: ${error instanceof Error ? error.message : String(error)}`, 'LLMEnricherService');
            this.updateMetrics('error', 0, false);
            return null;
        }
    }

    /**
     * Enrichit un batch de chunks
     */
    async enrichBatch(chunks: Array<{ id: string, content: string, metadata: any }>): Promise<Array<EnrichedChunk | null>> {
        if (!this.isEnabled || chunks.length === 0) {
            return chunks.map(() => null);
        }

        logger.info(`Enrichissement batch de ${chunks.length} chunks`, 'LLMEnricherService');

        // Traitement par batch selon config
        const batchSize = this.config.batchSize;
        const results: Array<EnrichedChunk | null> = [];

        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            const batchPromises = batch.map(chunk =>
                this.enrichChunk(chunk.id, chunk.content, chunk.metadata)
            );

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            logger.debug(`Batch ${Math.floor(i / batchSize) + 1} traité: ${batchResults.filter(r => r !== null).length}/${batch.length} succès`, 'LLMEnricherService');
        }

        const successCount = results.filter(r => r !== null).length;
        logger.info(`Enrichissement batch terminé: ${successCount}/${chunks.length} succès`, 'LLMEnricherService');

        return results;
    }

    /**
     * Appel LLM pour enrichissement
     */
    private async callLLMForEnrichment(content: string, metadata: any): Promise<any> {
        // TODO: Implémenter l'appel réel au LLM
        // Pour l'instant, retourne des données simulées
        return {
            enrichedContent: content, // Même contenu pour l'instant
            metadata: {
                summary: `Résumé automatique de ${content.substring(0, 50)}...`,
                keywords: ['test', 'code', 'example'],
                entities: ['Calculator', 'function'],
                complexity: 'low' as const,
                category: 'code',
                language: metadata?.language || 'javascript',
            },
            confidence: 0.85,
        };
    }

    /**
     * Met à jour la configuration
     */
    updateConfig(newConfig: Partial<LLMEnricherConfig>): void {
        this.config = { ...this.config, ...newConfig };
        this.isEnabled = this.config.enabled;
        logger.info(`Configuration Phase 0.3 mise à jour: enabled=${this.isEnabled}`, 'LLMEnricherService');
    }

    /**
     * Récupère la configuration actuelle
     */
    getConfig(): LLMEnricherConfig {
        return { ...this.config };
    }

    /**
     * Met à jour les métriques
     */
    private updateMetrics(type: 'processed' | 'success' | 'error', timeMs: number, isSuccess: boolean): void {
        this.metrics.totalChunksProcessed++;

        if (type === 'success') {
            this.metrics.totalChunksEnriched++;
            this.metrics.totalEnrichmentTimeMs += timeMs;

            // Mise à jour des métriques par modèle
            const model = this.config.model;
            if (!this.metrics.byModel[model]) {
                this.metrics.byModel[model] = { count: 0, totalTimeMs: 0, errors: 0 };
            }
            this.metrics.byModel[model].count++;
            this.metrics.byModel[model].totalTimeMs += timeMs;
        } else if (type === 'error') {
            this.metrics.errors++;

            // Mise à jour des erreurs par modèle
            const model = this.config.model;
            if (!this.metrics.byModel[model]) {
                this.metrics.byModel[model] = { count: 0, totalTimeMs: 0, errors: 0 };
            }
            this.metrics.byModel[model].errors++;
        }

        // Calcul des moyennes et taux
        this.metrics.averageEnrichmentTimeMs = this.metrics.totalChunksEnriched > 0
            ? this.metrics.totalEnrichmentTimeMs / this.metrics.totalChunksEnriched
            : 0;

        this.metrics.successRate = this.metrics.totalChunksProcessed > 0
            ? this.metrics.totalChunksEnriched / this.metrics.totalChunksProcessed
            : 1.0;

        this.metrics.lastUpdated = new Date();
    }

    /**
     * Récupère les métriques d'enrichissement
     */
    getMetrics(): EnrichmentMetrics {
        return { ...this.metrics };
    }

    /**
     * Récupère les statistiques d'utilisation (alias pour compatibilité)
     */
    getStats(): any {
        return {
            enabled: this.isEnabled,
            totalEnriched: this.metrics.totalChunksEnriched,
            averageTimeMs: this.metrics.averageEnrichmentTimeMs,
            successRate: this.metrics.successRate,
            totalProcessed: this.metrics.totalChunksProcessed,
            errors: this.metrics.errors,
            lastUpdated: this.metrics.lastUpdated,
        };
    }

    /**
     * Réinitialise les métriques
     */
    resetMetrics(): void {
        this.metrics = {
            totalChunksProcessed: 0,
            totalChunksEnriched: 0,
            totalEnrichmentTimeMs: 0,
            averageEnrichmentTimeMs: 0,
            successRate: 1.0,
            errors: 0,
            byModel: {},
            lastUpdated: new Date(),
        };
        logger.info('Métriques Phase 0.3 réinitialisées', 'LLMEnricherService');
    }
}

/**
 * Instance singleton du service
 */
let enricherInstance: LLMEnricherService | null = null;

/**
 * Initialise le service d'enrichissement
 */
export function initLLMEnricher(config?: Partial<LLMEnricherConfig>): LLMEnricherService {
    if (!enricherInstance) {
        enricherInstance = new LLMEnricherService(config);
    }
    return enricherInstance;
}

/**
 * Récupère l'instance du service
 */
export function getLLMEnricher(): LLMEnricherService | null {
    return enricherInstance;
}

/**
 * Export par défaut
 */
export default {
    LLMEnricherService,
    initLLMEnricher,
    getLLMEnricher,
};
