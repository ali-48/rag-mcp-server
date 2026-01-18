// src/rag/embedding-service.ts
// Module dédié à la génération d'embeddings multi-modèles
// Responsabilité unique : Routage et génération d'embeddings par type de contenu
import { getDefaultEmbeddingCache } from "./embedding-cache.js";
import { getDefaultOllamaService } from "./ollama-service.js";
import { VectorStoreLogger } from "./vector-store-interface.js";
/**
 * Dimensions par type (pour référence)
 */
const EMBEDDING_DIMENSIONS = {
    code: 768,
    text: 768,
    config: 384,
    fallback: 1024,
};
/**
 * Service de génération d'embeddings
 */
export class EmbeddingService {
    config;
    cache;
    ollamaService = null;
    /**
     * Crée une instance du service d'embeddings
     */
    constructor(config) {
        this.config = config;
        this.cache = config.cache || getDefaultEmbeddingCache();
        if (config.provider === "ollama") {
            this.ollamaService = config.ollamaService || getDefaultOllamaService();
        }
        VectorStoreLogger.info("embedding.service.init", "Embedding service initialized", {
            provider: config.provider,
            models: config.models,
        });
    }
    /**
     * Détermine le modèle approprié pour un type de contenu
     */
    getModelForContentType(contentType, language) {
        // Normaliser le type de contenu
        const normalizedType = contentType.toLowerCase();
        // Routage basé sur le type
        switch (normalizedType) {
            case "code":
            case "source":
            case "program":
                return this.config.models.code;
            case "doc":
            case "text":
            case "documentation":
            case "markdown":
            case "readme":
                return this.config.models.text;
            case "config":
            case "configuration":
            case "json":
            case "yaml":
            case "toml":
            case "ini":
                return this.config.models.config;
            default:
                return this.config.models.fallback;
        }
    }
    /**
     * Obtient la dimension attendue pour un modèle
     */
    getDimensionForModel(model) {
        // Chercher dans la configuration
        for (const [type, modelName] of Object.entries(this.config.models)) {
            if (modelName === model) {
                return EMBEDDING_DIMENSIONS[type];
            }
        }
        // Fallback
        return EMBEDDING_DIMENSIONS.fallback;
    }
    /**
     * Normalise un vecteur selon la norme L2
     */
    normalizeL2(vector) {
        const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
        if (norm === 0)
            return vector;
        return vector.map(val => val / norm);
    }
    /**
     * Génère des embeddings factices améliorés
     */
    generateFakeEmbedding(text, model = this.config.models.fallback) {
        // Déterminer la dimension basée sur le modèle
        const dimension = this.getDimensionForModel(model);
        // Seed basée sur le texte et le modèle
        const seed = this.simpleHash(text + model);
        return Array(dimension).fill(0).map((_, i) => {
            const base = Math.sin(seed * 0.01 + i * 0.017) * 0.3;
            const variation = Math.cos(seed * 0.007 + i * 0.023) * 0.2;
            const noise = (Math.random() - 0.5) * 0.1;
            return base + variation + noise;
        });
    }
    /**
     * Fonction de hachage simple
     */
    simpleHash(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }
    /**
     * Génère un embedding avec routage automatique par type de contenu
     */
    async generateForContent(text, contentType = "other", language) {
        // 1. Déterminer le modèle approprié
        const model = this.getModelForContentType(contentType, language);
        // 2. Vérifier le cache
        const cached = this.cache.get(text, model);
        if (cached) {
            VectorStoreLogger.debug("embedding.cache.hit", `Using cached embedding (${model})`, {
                model,
                textPreview: text.substring(0, 50),
            });
            return cached;
        }
        // 3. Générer l'embedding avec le modèle approprié
        VectorStoreLogger.debug("embedding.generating", `Generating embedding with ${model} for ${contentType}`, {
            model,
            contentType,
            textPreview: text.substring(0, 50),
        });
        const vector = await this.generateWithModel(text, model);
        // 4. Normaliser
        const normalizedVector = this.normalizeL2(vector);
        // 5. Mettre en cache
        this.cache.set(text, normalizedVector, model, contentType, language);
        return normalizedVector;
    }
    /**
     * Génère un embedding avec un modèle spécifique
     */
    async generateWithModel(text, model) {
        switch (this.config.provider) {
            case "ollama":
                if (!this.ollamaService) {
                    throw new Error("Ollama service not configured");
                }
                return await this.ollamaService.generateEmbedding(text, model);
            case "sentence-transformers":
                return await this.generateSentenceTransformerEmbedding(text);
            case "fake":
            default:
                return this.generateFakeEmbedding(text, model);
        }
    }
    /**
     * Génère un embedding selon le fournisseur configuré (compatibilité)
     */
    async generate(text) {
        // Utiliser le modèle par défaut pour la compatibilité
        return await this.generateWithModel(text, this.config.models.fallback);
    }
    /**
     * Embeddings avec Sentence Transformers (à implémenter)
     */
    async generateSentenceTransformerEmbedding(text) {
        VectorStoreLogger.debug("embedding.sentence-transformers", "Generating embedding with Sentence Transformers", {
            textPreview: text.substring(0, 50),
        });
        // TODO: Implémenter avec @xenova/transformers
        return this.generateFakeEmbedding(text, this.config.models.fallback);
    }
    /**
     * Obtient l'instance de cache utilisée
     */
    getCache() {
        return this.cache;
    }
    /**
     * Obtient l'instance du service Ollama (si configuré)
     */
    getOllamaService() {
        return this.ollamaService;
    }
    /**
     * Obtient la configuration actuelle
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Met à jour la configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        if (newConfig.cache) {
            this.cache = newConfig.cache;
        }
        if (this.config.provider === "ollama" && newConfig.ollamaService) {
            this.ollamaService = newConfig.ollamaService;
        }
        else if (this.config.provider !== "ollama") {
            this.ollamaService = null;
        }
        VectorStoreLogger.info("embedding.service.config.updated", "Embedding service configuration updated", {
            newProvider: this.config.provider,
        });
    }
    /**
     * Teste la connectivité du service
     */
    async testConnection() {
        switch (this.config.provider) {
            case "ollama":
                return this.ollamaService ? await this.ollamaService.testConnection() : false;
            case "sentence-transformers":
                // Sentence Transformers est toujours disponible localement
                return true;
            case "fake":
                return true;
            default:
                return false;
        }
    }
}
/**
 * Configuration par défaut des modèles
 */
export const DEFAULT_MODEL_CONFIG = {
    code: "nomic-embed-code",
    text: "nomic-embed-text",
    config: "bge-small",
    fallback: "qwen3-embedding:8b",
};
/**
 * Instance singleton par défaut
 */
let defaultEmbeddingServiceInstance = null;
/**
 * Obtient l'instance singleton du service d'embeddings
 */
export function getDefaultEmbeddingService() {
    if (!defaultEmbeddingServiceInstance) {
        defaultEmbeddingServiceInstance = new EmbeddingService({
            provider: "fake",
            models: DEFAULT_MODEL_CONFIG,
        });
        VectorStoreLogger.info("embedding.service.default.init", "Default embedding service initialized");
    }
    return defaultEmbeddingServiceInstance;
}
/**
 * Configure l'instance singleton du service d'embeddings
 */
export function configureDefaultEmbeddingService(provider, defaultModel = "qwen3-embedding:8b", modelConfig) {
    const models = {
        ...DEFAULT_MODEL_CONFIG,
        fallback: defaultModel,
        ...modelConfig,
    };
    defaultEmbeddingServiceInstance = new EmbeddingService({
        provider,
        models,
    });
    VectorStoreLogger.info("embedding.service.default.configured", "Default embedding service configured", {
        provider,
        models,
    });
}
/**
 * Configure uniquement les modèles (sans changer le provider)
 */
export function setDefaultEmbeddingModels(models) {
    if (defaultEmbeddingServiceInstance) {
        const currentConfig = defaultEmbeddingServiceInstance.getConfig();
        defaultEmbeddingServiceInstance.updateConfig({
            models: { ...currentConfig.models, ...models },
        });
    }
}
/**
 * Détermine le modèle approprié pour un type de contenu (utilitaire)
 */
export function getEmbeddingModelForContentType(contentType, language) {
    return getDefaultEmbeddingService().getModelForContentType(contentType, language);
}
/**
 * Obtient la dimension attendue pour un modèle (utilitaire)
 */
export function getEmbeddingDimensionForModel(model) {
    return getDefaultEmbeddingService().getDimensionForModel(model);
}
/**
 * Génère un embedding (utilitaire de compatibilité)
 */
export async function generateEmbedding(text) {
    return await getDefaultEmbeddingService().generate(text);
}
/**
 * Génère un embedding avec routage automatique (utilitaire)
 */
export async function generateEmbeddingForContent(text, contentType = "other", language) {
    return await getDefaultEmbeddingService().generateForContent(text, contentType, language);
}
/**
 * Normalise un vecteur L2 (utilitaire)
 */
export function normalizeL2(vector) {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0)
        return vector;
    return vector.map(val => val / norm);
}
//# sourceMappingURL=embedding-service.js.map