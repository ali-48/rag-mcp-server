// Phase 0.3 - Configuration du module LLM Enrichment
// Version: 1.0.0
/**
 * Configuration par défaut
 */
export const DEFAULT_LLM_ENRICHER_CONFIG = {
    enabled: false,
    provider: 'ollama',
    model: 'llama3.1:latest',
    temperature: 0.1,
    maxTokens: 1000,
    timeoutMs: 30000,
    batchSize: 5,
    features: ['summary', 'keywords', 'entities'],
    cacheEnabled: true,
    cacheTtlSeconds: 3600,
    providerOptions: {},
};
/**
 * Valide la configuration
 */
export function validateLLMEnricherConfig(config) {
    const errors = [];
    const mergedConfig = { ...DEFAULT_LLM_ENRICHER_CONFIG, ...config };
    // Validation des champs
    if (mergedConfig.temperature < 0 || mergedConfig.temperature > 2) {
        errors.push(`Temperature must be between 0 and 2, got ${mergedConfig.temperature}`);
    }
    if (mergedConfig.maxTokens < 1 || mergedConfig.maxTokens > 10000) {
        errors.push(`maxTokens must be between 1 and 10000, got ${mergedConfig.maxTokens}`);
    }
    if (mergedConfig.timeoutMs < 1000 || mergedConfig.timeoutMs > 120000) {
        errors.push(`timeoutMs must be between 1000 and 120000, got ${mergedConfig.timeoutMs}`);
    }
    if (mergedConfig.batchSize < 1 || mergedConfig.batchSize > 50) {
        errors.push(`batchSize must be between 1 and 50, got ${mergedConfig.batchSize}`);
    }
    if (mergedConfig.cacheTtlSeconds < 0 || mergedConfig.cacheTtlSeconds > 86400) {
        errors.push(`cacheTtlSeconds must be between 0 and 86400, got ${mergedConfig.cacheTtlSeconds}`);
    }
    // Validation des features
    const validFeatures = ['summary', 'keywords', 'entities', 'complexity', 'category', 'sentiment', 'topics', 'relations'];
    const invalidFeatures = mergedConfig.features.filter(f => !validFeatures.includes(f));
    if (invalidFeatures.length > 0) {
        errors.push(`Invalid features: ${invalidFeatures.join(', ')}. Valid features are: ${validFeatures.join(', ')}`);
    }
    return {
        success: errors.length === 0,
        errors,
        config: mergedConfig,
    };
}
/**
 * Convertit la configuration en objet simple pour le stockage
 */
export function serializeConfig(config) {
    return {
        ...config,
        providerOptions: config.providerOptions || {},
    };
}
/**
 * Parse la configuration depuis un objet
 */
export function parseConfig(data) {
    return {
        ...DEFAULT_LLM_ENRICHER_CONFIG,
        ...data,
        features: Array.isArray(data.features) ? data.features : DEFAULT_LLM_ENRICHER_CONFIG.features,
        providerOptions: data.providerOptions || {},
    };
}
/**
 * Récupère la configuration depuis les variables d'environnement
 */
export function getConfigFromEnv() {
    const config = {};
    if (process.env.PHASE03_ENABLED) {
        config.enabled = process.env.PHASE03_ENABLED.toLowerCase() === 'true';
    }
    if (process.env.PHASE03_PROVIDER) {
        const provider = process.env.PHASE03_PROVIDER;
        if (['ollama', 'openai', 'anthropic', 'fake'].includes(provider)) {
            config.provider = provider;
        }
    }
    if (process.env.PHASE03_MODEL) {
        config.model = process.env.PHASE03_MODEL;
    }
    if (process.env.PHASE03_TEMPERATURE) {
        const temp = parseFloat(process.env.PHASE03_TEMPERATURE);
        if (!isNaN(temp)) {
            config.temperature = temp;
        }
    }
    if (process.env.PHASE03_MAX_TOKENS) {
        const maxTokens = parseInt(process.env.PHASE03_MAX_TOKENS, 10);
        if (!isNaN(maxTokens)) {
            config.maxTokens = maxTokens;
        }
    }
    if (process.env.PHASE03_BATCH_SIZE) {
        const batchSize = parseInt(process.env.PHASE03_BATCH_SIZE, 10);
        if (!isNaN(batchSize)) {
            config.batchSize = batchSize;
        }
    }
    if (process.env.PHASE03_FEATURES) {
        try {
            const features = JSON.parse(process.env.PHASE03_FEATURES);
            if (Array.isArray(features)) {
                config.features = features;
            }
        }
        catch (error) {
            // Ignorer l'erreur de parsing
        }
    }
    return config;
}
/**
 * Export par défaut
 */
export default {
    DEFAULT_LLM_ENRICHER_CONFIG,
    validateLLMEnricherConfig,
    serializeConfig,
    parseConfig,
    getConfigFromEnv,
};
//# sourceMappingURL=config.js.map