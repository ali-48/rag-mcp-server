// src/rag/embedding-cache.ts
// Module dédié au cache LRU avec TTL pour les embeddings
// Responsabilité unique : Gestion du cache des embeddings
import { VectorStoreLogger } from "./vector-store-interface.js";
/**
 * Cache LRU avec TTL pour les embeddings
 */
export class EmbeddingCache {
    config;
    cache = new Map();
    stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        byModel: {},
    };
    /**
     * Crée une instance de cache
     * @param config Configuration du cache
     */
    constructor(config = { maxSize: 1000, ttlMs: 3600 * 1000 }) {
        this.config = config;
    }
    /**
     * Génère une clé de cache unique
     */
    getCacheKey(text, model) {
        // Hash simple du texte
        let hash = 0;
        for (let i = 0; i < Math.min(text.length, 1000); i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return `${model}:${hash}:${text.length}`;
    }
    /**
     * Fonction de hachage simple (utilitaire)
     */
    static simpleHash(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }
    /**
     * Récupère un embedding depuis le cache
     */
    get(text, model) {
        const key = this.getCacheKey(text, model);
        const entry = this.cache.get(key);
        if (!entry) {
            this.stats.misses++;
            return null;
        }
        // Vérifier la validité du cache
        if (Date.now() - entry.timestamp > this.config.ttlMs) {
            this.cache.delete(key);
            this.stats.misses++;
            return null;
        }
        // Mettre à jour les statistiques
        this.stats.hits++;
        this.stats.byModel[model] = (this.stats.byModel[model] || 0) + 1;
        VectorStoreLogger.debug("embedding.cache.hit", "Using cached embedding", {
            model,
            textPreview: text.substring(0, 50),
        });
        return entry.vector;
    }
    /**
     * Met un embedding en cache
     */
    set(text, vector, model, contentType, language) {
        const key = this.getCacheKey(text, model);
        this.cache.set(key, {
            vector,
            model,
            timestamp: Date.now(),
            contentType,
            language,
        });
        // Gérer la taille du cache (LRU simple)
        if (this.cache.size > this.config.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
                this.stats.evictions++;
            }
        }
        VectorStoreLogger.debug("embedding.cache.set", "Embedding cached", {
            model,
            contentType,
            cacheSize: this.cache.size,
        });
    }
    /**
     * Vide complètement le cache
     */
    clear() {
        this.cache.clear();
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            byModel: {},
        };
        VectorStoreLogger.info("embedding.cache.cleared", "Cache des embeddings vidé");
    }
    /**
     * Obtient les statistiques du cache
     */
    getStats() {
        const totalRequests = this.stats.hits + this.stats.misses;
        const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
        return {
            totalEntries: this.cache.size,
            byModel: { ...this.stats.byModel },
            hitRate,
            hits: this.stats.hits,
            misses: this.stats.misses,
            evictions: this.stats.evictions,
        };
    }
    /**
     * Supprime les entrées expirées du cache
     */
    cleanup() {
        const now = Date.now();
        let removed = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.config.ttlMs) {
                this.cache.delete(key);
                removed++;
            }
        }
        if (removed > 0) {
            VectorStoreLogger.debug("embedding.cache.cleanup", "Expired entries removed", {
                removed,
                remaining: this.cache.size,
            });
        }
        return removed;
    }
    /**
     * Obtient la taille actuelle du cache
     */
    size() {
        return this.cache.size;
    }
    /**
     * Vérifie si le cache contient une clé
     */
    has(text, model) {
        const key = this.getCacheKey(text, model);
        const entry = this.cache.get(key);
        if (!entry)
            return false;
        // Vérifier si l'entrée est expirée
        if (Date.now() - entry.timestamp > this.config.ttlMs) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }
}
/**
 * Instance singleton par défaut
 */
let defaultCacheInstance = null;
/**
 * Obtient l'instance singleton du cache
 */
export function getDefaultEmbeddingCache() {
    if (!defaultCacheInstance) {
        defaultCacheInstance = new EmbeddingCache();
        VectorStoreLogger.info("embedding.cache.init", "Default embedding cache initialized");
    }
    return defaultCacheInstance;
}
/**
 * Configure l'instance singleton du cache
 */
export function configureDefaultEmbeddingCache(config) {
    defaultCacheInstance = new EmbeddingCache(config);
    VectorStoreLogger.info("embedding.cache.configured", "Default embedding cache configured", {
        maxSize: config.maxSize,
        ttlMs: config.ttlMs,
    });
}
/**
 * Vide le cache singleton
 */
export function clearDefaultEmbeddingCache() {
    if (defaultCacheInstance) {
        defaultCacheInstance.clear();
    }
}
/**
 * Obtient les statistiques du cache singleton
 */
export function getDefaultEmbeddingCacheStats() {
    return defaultCacheInstance ? defaultCacheInstance.getStats() : {
        totalEntries: 0,
        byModel: {},
        hitRate: 0,
        hits: 0,
        misses: 0,
        evictions: 0,
    };
}
//# sourceMappingURL=embedding-cache.js.map