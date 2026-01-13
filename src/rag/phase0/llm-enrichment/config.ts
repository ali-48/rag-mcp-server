// Phase 0.3 - Configuration du module LLM Enrichment
// Version: 1.0.0

/**
 * Configuration du service d'enrichissement LLM
 */
export interface LLMEnricherConfig {
    /** Activer/désactiver l'enrichissement */
    enabled: boolean;

    /** Fournisseur LLM (ollama, openai, etc.) */
    provider: 'ollama' | 'openai' | 'anthropic' | 'fake';

    /** Modèle LLM à utiliser */
    model: string;

    /** Température pour la génération (0-2) */
    temperature: number;

    /** Nombre maximum de tokens en sortie */
    maxTokens: number;

    /** Timeout en millisecondes */
    timeoutMs: number;

    /** Taille des batches pour traitement parallèle */
    batchSize: number;

    /** Fonctionnalités d'enrichissement à activer */
    features: Array<
        'summary' |
        'keywords' |
        'entities' |
        'complexity' |
        'category' |
        'sentiment' |
        'topics' |
        'relations'
    >;

    /** Activer le cache des résultats */
    cacheEnabled: boolean;

    /** Durée de vie du cache en secondes */
    cacheTtlSeconds: number;

    /** Paramètres spécifiques au provider */
    providerOptions?: Record<string, any>;
}

/**
 * Configuration par défaut
 */
export const DEFAULT_LLM_ENRICHER_CONFIG: LLMEnricherConfig = {
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
 * Options de configuration pour Ollama
 */
export interface OllamaProviderOptions {
    endpoint: string;
    keepAlive: string;
    numPredict: number;
    topK: number;
    topP: number;
    repeatPenalty: number;
    stop: string[];
}

/**
 * Options de configuration pour OpenAI
 */
export interface OpenAIProviderOptions {
    apiKey: string;
    organization?: string;
    project?: string;
    baseURL?: string;
}

/**
 * Valide la configuration
 */
export function validateLLMEnricherConfig(config: Partial<LLMEnricherConfig>): {
    success: boolean;
    errors: string[];
    config: LLMEnricherConfig;
} {
    const errors: string[] = [];
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
export function serializeConfig(config: LLMEnricherConfig): Record<string, any> {
    return {
        ...config,
        providerOptions: config.providerOptions || {},
    };
}

/**
 * Parse la configuration depuis un objet
 */
export function parseConfig(data: Record<string, any>): LLMEnricherConfig {
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
export function getConfigFromEnv(): Partial<LLMEnricherConfig> {
    const config: Partial<LLMEnricherConfig> = {};

    if (process.env.PHASE03_ENABLED) {
        config.enabled = process.env.PHASE03_ENABLED.toLowerCase() === 'true';
    }

    if (process.env.PHASE03_PROVIDER) {
        const provider = process.env.PHASE03_PROVIDER as LLMEnricherConfig['provider'];
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
        } catch (error) {
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
