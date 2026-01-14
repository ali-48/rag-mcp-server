// Phase 0.3 - Schemas de validation pour LLM Enrichment
// Version: 1.0.0
import { z } from 'zod';
/**
 * Schema pour la validation des entrées d'enrichissement
 */
export const EnrichmentInputSchema = z.object({
    chunkId: z.string().min(1, "chunkId est requis"),
    content: z.string().min(1, "Le contenu ne peut pas être vide").max(100000, "Le contenu est trop long (max 100k caractères)"),
    metadata: z.object({
        language: z.string().optional(),
        fileType: z.string().optional(),
        filePath: z.string().optional(),
        projectPath: z.string().optional(),
        chunkIndex: z.number().int().min(0).optional(),
        totalChunks: z.number().int().min(1).optional(),
        role: z.enum(['core', 'helper', 'test', 'example', 'template', 'other']).optional(),
        contentType: z.enum(['code', 'doc', 'config', 'other']).optional(),
    }).optional().default({}),
    config: z.object({
        enabled: z.boolean(),
        provider: z.enum(['ollama', 'openai', 'anthropic', 'fake']),
        model: z.string(),
        temperature: z.number().min(0).max(2),
        maxTokens: z.number().int().positive(),
        timeoutMs: z.number().int().positive(),
        batchSize: z.number().int().positive(),
        features: z.array(z.enum(['summary', 'keywords', 'entities', 'complexity', 'category', 'sentiment', 'topics', 'relations'])),
        cacheEnabled: z.boolean(),
        cacheTtlSeconds: z.number().int().min(0),
    }),
});
/**
 * Schema pour la validation des sorties d'enrichissement
 */
export const EnrichmentOutputSchema = z.object({
    enrichedContent: z.string().min(1, "Le contenu enrichi ne peut pas être vide"),
    metadata: z.object({
        summary: z.string().optional(),
        keywords: z.array(z.string()).optional(),
        entities: z.array(z.string()).optional(),
        complexity: z.enum(['low', 'medium', 'high']).optional(),
        category: z.string().optional(),
        language: z.string().optional(),
        sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
        topics: z.array(z.string()).optional(),
        relations: z.array(z.string()).optional(),
    }),
    confidence: z.number().min(0).max(1),
});
/**
 * Schema pour les métriques d'enrichissement
 */
export const EnrichmentMetricsSchema = z.object({
    chunkId: z.string(),
    enrichmentTimeMs: z.number().int().min(0),
    modelUsed: z.string(),
    success: z.boolean(),
    error: z.string().optional(),
    inputLength: z.number().int().min(0),
    outputLength: z.number().int().min(0),
    confidence: z.number().min(0).max(1).optional(),
    timestamp: z.date(),
});
/**
 * Schema pour le cache d'enrichissement
 */
export const EnrichmentCacheSchema = z.object({
    key: z.string(),
    chunkId: z.string(),
    contentHash: z.string(),
    enrichedData: EnrichmentOutputSchema,
    createdAt: z.date(),
    expiresAt: z.date(),
    hits: z.number().int().min(0),
});
/**
 * Schema pour les erreurs LLM
 */
export const LLMErrorSchema = z.object({
    code: z.string(),
    message: z.string(),
    provider: z.string(),
    model: z.string(),
    timestamp: z.date(),
    retryable: z.boolean(),
    details: z.record(z.string(), z.any()).optional(),
});
/**
 * Valide les données d'entrée pour l'enrichissement
 */
export function validateEnrichmentInput(data) {
    try {
        const validated = EnrichmentInputSchema.parse(data);
        return { success: true, data: validated };
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error };
        }
        throw error;
    }
}
/**
 * Valide les données de sortie de l'enrichissement
 */
export function validateEnrichmentOutput(data) {
    try {
        const validated = EnrichmentOutputSchema.parse(data);
        return { success: true, data: validated };
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error };
        }
        throw error;
    }
}
/**
 * Valide les métriques d'enrichissement
 */
export function validateEnrichmentMetrics(data) {
    try {
        const validated = EnrichmentMetricsSchema.parse(data);
        return { success: true, data: validated };
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error };
        }
        throw error;
    }
}
/**
 * Génère un hash pour le cache basé sur le contenu et la configuration
 */
export function generateCacheHash(content, config) {
    // Simple hash implementation for now
    const data = `${content}:${JSON.stringify(config)}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
}
/**
 * Export par défaut
 */
export default {
    EnrichmentInputSchema,
    EnrichmentOutputSchema,
    EnrichmentMetricsSchema,
    EnrichmentCacheSchema,
    LLMErrorSchema,
    validateEnrichmentInput,
    validateEnrichmentOutput,
    validateEnrichmentMetrics,
    generateCacheHash,
};
//# sourceMappingURL=schemas.js.map