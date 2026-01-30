// Phase 0.3 - LLM Enrichment Module
// Version: 1.0.0
// Description: Module d'enrichissement des chunks via LLM avant embeddings
import { getDefaultOllamaService } from "../../../rag/ollama-service.js";
import { getGlobalLogger } from "../event-logger.js";
import { validateEnrichmentInput, validateEnrichmentOutput, } from "./schemas.js";
const logger = getGlobalLogger();
/**
 * Service d'enrichissement LLM
 */
export class LLMEnricherService {
    config;
    isEnabled;
    metrics;
    constructor(config) {
        this.config = {
            enabled: config?.enabled ?? false,
            provider: config?.provider ?? "ollama",
            model: config?.model ?? "llama3.1:latest",
            temperature: config?.temperature ?? 0.1,
            maxTokens: config?.maxTokens ?? 1000,
            timeoutMs: config?.timeoutMs ?? null,
            batchSize: config?.batchSize ?? 5,
            features: config?.features ?? ["summary", "keywords", "entities"],
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
        logger.info(`Phase 0.3 - LLM Enricher initialisé: ${this.isEnabled ? "ACTIVÉ" : "DÉSACTIVÉ"}`, "LLMEnricherService");
        if (this.isEnabled) {
            logger.info(`Configuration: ${this.config.provider}/${this.config.model}`, "LLMEnricherService");
        }
    }
    /**
     * Vérifie si l'enrichissement est activé
     */
    isEnrichmentEnabled() {
        return this.isEnabled;
    }
    /**
     * Enrichit un chunk unique
     */
    async enrichChunk(chunkId, content, metadata) {
        if (!this.isEnabled) {
            logger.debug(`Phase 0.3 désactivée, skip enrichissement pour chunk: ${chunkId}`, "LLMEnricherService");
            return null;
        }
        // Mise à jour des métriques: chunks traités
        this.updateMetrics("processed", 0, false);
        try {
            // Validation de l'entrée
            const inputValidation = validateEnrichmentInput({
                chunkId,
                content,
                metadata,
                config: this.config,
            });
            if (!inputValidation.success) {
                logger.warn(`Validation échouée pour chunk ${chunkId}: ${JSON.stringify(inputValidation.error)}`, "LLMEnricherService");
                this.updateMetrics("error", 0, false);
                return null;
            }
            logger.debug(`Enrichissement chunk ${chunkId} (${content.length} chars)`, "LLMEnricherService");
            // Appel LLM pour enrichissement
            const startTime = Date.now();
            const enrichedData = await this.callLLMForEnrichment(content, metadata);
            const enrichmentTimeMs = Date.now() - startTime;
            // Validation de la sortie
            const outputValidation = validateEnrichmentOutput(enrichedData);
            if (!outputValidation.success) {
                logger.warn(`Sortie LLM invalide pour chunk ${chunkId}: ${JSON.stringify(outputValidation.error)}`, "LLMEnricherService");
                this.updateMetrics("error", enrichmentTimeMs, false);
                return null;
            }
            const enrichedChunk = {
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
            this.updateMetrics("success", enrichmentTimeMs, true);
            logger.info(`Chunk ${chunkId} enrichi avec succès (${enrichmentTimeMs}ms)`, "LLMEnricherService");
            return enrichedChunk;
        }
        catch (error) {
            logger.error(`Erreur enrichissement chunk ${chunkId}: ${error instanceof Error ? error.message : String(error)}`, "LLMEnricherService");
            this.updateMetrics("error", 0, false);
            return null;
        }
    }
    /**
     * Enrichit un batch de chunks
     */
    async enrichBatch(chunks) {
        if (!this.isEnabled || chunks.length === 0) {
            return chunks.map(() => null);
        }
        logger.info(`Enrichissement batch de ${chunks.length} chunks`, "LLMEnricherService");
        // Traitement par batch selon config
        const batchSize = this.config.batchSize;
        const results = [];
        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            const batchPromises = batch.map((chunk) => this.enrichChunk(chunk.id, chunk.content, chunk.metadata));
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            logger.debug(`Batch ${Math.floor(i / batchSize) + 1} traité: ${batchResults.filter((r) => r !== null).length}/${batch.length} succès`, "LLMEnricherService");
        }
        const successCount = results.filter((r) => r !== null).length;
        logger.info(`Enrichissement batch terminé: ${successCount}/${chunks.length} succès`, "LLMEnricherService");
        return results;
    }
    /**
     * Appel LLM pour enrichissement
     */
    async callLLMForEnrichment(content, metadata) {
        const ollamaService = getDefaultOllamaService();
        const model = this.config.model;
        const temperature = this.config.temperature;
        const maxTokens = this.config.maxTokens;
        // Construire le prompt pour l'enrichissement
        const language = metadata?.language || "unknown";
        const contentType = metadata?.contentType || "code";
        const prompt = this.buildEnrichmentPrompt(content, language, contentType);
        try {
            logger.debug(`Appel LLM pour enrichissement avec modèle ${model}`, "LLMEnricherService");
            const llmResponse = await ollamaService.generateCompletion(prompt, model, {
                temperature,
                maxTokens,
                systemPrompt: this.buildSystemPrompt(language, contentType),
            });
            // Parser la réponse LLM pour extraire les informations structurées
            const enrichedData = this.parseLLMResponse(llmResponse, content);
            return {
                enrichedContent: enrichedData.enrichedContent || content,
                metadata: {
                    summary: enrichedData.summary ||
                        `Résumé automatique de ${content.substring(0, 50)}...`,
                    keywords: enrichedData.keywords || [
                        "code",
                        "function",
                        "implementation",
                    ],
                    entities: enrichedData.entities || [],
                    complexity: enrichedData.complexity || "medium",
                    category: enrichedData.category || contentType,
                    language: language,
                },
                confidence: enrichedData.confidence || 0.7,
            };
        }
        catch (error) {
            logger.warn(`Échec de l'appel LLM: ${error instanceof Error ? error.message : String(error)}`, "LLMEnricherService");
            // Fallback sur les données simulées en cas d'erreur
            return {
                enrichedContent: content,
                metadata: {
                    summary: `Résumé automatique de ${content.substring(0, 50)}...`,
                    keywords: ["fallback", "code", "example"],
                    entities: [],
                    complexity: "low",
                    category: contentType,
                    language: language,
                },
                confidence: 0.5,
            };
        }
    }
    /**
     * Construit le prompt pour l'enrichissement
     */
    buildEnrichmentPrompt(content, language, contentType) {
        return `Analyse le contenu suivant (langage: ${language}, type: ${contentType}) et fournis un enrichissement structuré:

Contenu à analyser:
"""
${content}
"""

Fournis une réponse JSON avec les champs suivants:
1. "summary": un résumé concis (1-2 phrases)
2. "keywords": 3-5 mots-clés pertinents
3. "entities": noms d'entités importantes (fonctions, classes, variables, concepts)
4. "complexity": niveau de complexité ("low", "medium", "high")
5. "category": catégorie principale ("code", "documentation", "configuration", "test")
6. "enrichedContent": version enrichie du contenu (peut être identique si pas d'amélioration)
7. "confidence": niveau de confiance de l'analyse (0.0 à 1.0)

Réponse JSON uniquement, sans texte supplémentaire.`;
    }
    /**
     * Construit le prompt système
     */
    buildSystemPrompt(language, contentType) {
        return `Tu es un assistant spécialisé dans l'analyse de code et de texte.
Tu analyses du contenu de type ${contentType} en ${language}.
Ton rôle est d'extraire des informations structurées pour améliorer la recherche sémantique.
Sois précis, concis et retourne uniquement du JSON valide.`;
    }
    /**
     * Parse la réponse LLM pour extraire les données structurées
     */
    parseLLMResponse(llmResponse, originalContent) {
        try {
            // Essayer de parser la réponse comme JSON
            const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    enrichedContent: parsed.enrichedContent || originalContent,
                    summary: parsed.summary,
                    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
                    entities: Array.isArray(parsed.entities) ? parsed.entities : [],
                    complexity: parsed.complexity || "medium",
                    category: parsed.category || "code",
                    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.7,
                };
            }
        }
        catch (error) {
            logger.warn(`Échec du parsing de la réponse LLM: ${error instanceof Error ? error.message : String(error)}`, "LLMEnricherService");
        }
        // Fallback: analyser la réponse textuelle
        return {
            enrichedContent: originalContent,
            summary: llmResponse.substring(0, 100) + "...",
            keywords: ["parsed", "from", "response"],
            entities: [],
            complexity: "medium",
            category: "code",
            confidence: 0.6,
        };
    }
    /**
     * Met à jour la configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.isEnabled = this.config.enabled;
        logger.info(`Configuration Phase 0.3 mise à jour: enabled=${this.isEnabled}`, "LLMEnricherService");
    }
    /**
     * Récupère la configuration actuelle
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Met à jour les métriques
     */
    updateMetrics(type, timeMs, isSuccess) {
        this.metrics.totalChunksProcessed++;
        if (type === "success") {
            this.metrics.totalChunksEnriched++;
            this.metrics.totalEnrichmentTimeMs += timeMs;
            // Mise à jour des métriques par modèle
            const model = this.config.model;
            if (!this.metrics.byModel[model]) {
                this.metrics.byModel[model] = { count: 0, totalTimeMs: 0, errors: 0 };
            }
            this.metrics.byModel[model].count++;
            this.metrics.byModel[model].totalTimeMs += timeMs;
        }
        else if (type === "error") {
            this.metrics.errors++;
            // Mise à jour des erreurs par modèle
            const model = this.config.model;
            if (!this.metrics.byModel[model]) {
                this.metrics.byModel[model] = { count: 0, totalTimeMs: 0, errors: 0 };
            }
            this.metrics.byModel[model].errors++;
        }
        // Calcul des moyennes et taux
        this.metrics.averageEnrichmentTimeMs =
            this.metrics.totalChunksEnriched > 0
                ? this.metrics.totalEnrichmentTimeMs / this.metrics.totalChunksEnriched
                : 0;
        this.metrics.successRate =
            this.metrics.totalChunksProcessed > 0
                ? this.metrics.totalChunksEnriched / this.metrics.totalChunksProcessed
                : 1.0;
        this.metrics.lastUpdated = new Date();
    }
    /**
     * Récupère les métriques d'enrichissement
     */
    getMetrics() {
        return { ...this.metrics };
    }
    /**
     * Récupère les statistiques d'utilisation (alias pour compatibilité)
     */
    getStats() {
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
    resetMetrics() {
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
        logger.info("Métriques Phase 0.3 réinitialisées", "LLMEnricherService");
    }
}
/**
 * Instance singleton du service
 */
let enricherInstance = null;
/**
 * Initialise le service d'enrichissement
 */
export function initLLMEnricher(config) {
    if (!enricherInstance) {
        enricherInstance = new LLMEnricherService(config);
    }
    return enricherInstance;
}
/**
 * Récupère l'instance du service
 */
export function getLLMEnricher() {
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
