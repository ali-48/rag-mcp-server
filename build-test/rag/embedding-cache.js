"use strict";
// src/rag/embedding-cache.ts
// Module dédié au cache LRU avec TTL pour les embeddings
// Responsabilité unique : Gestion du cache des embeddings
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingCache = void 0;
exports.getDefaultEmbeddingCache = getDefaultEmbeddingCache;
exports.configureDefaultEmbeddingCache = configureDefaultEmbeddingCache;
exports.clearDefaultEmbeddingCache = clearDefaultEmbeddingCache;
exports.getDefaultEmbeddingCacheStats = getDefaultEmbeddingCacheStats;
var vector_store_interface_js_1 = require("./vector-store-interface.js");
/**
 * Cache LRU avec TTL pour les embeddings
 */
var EmbeddingCache = /** @class */ (function () {
    /**
     * Crée une instance de cache
     * @param config Configuration du cache
     */
    function EmbeddingCache(config) {
        if (config === void 0) { config = { maxSize: 1000, ttlMs: 3600 * 1000 }; }
        this.config = config;
        this.cache = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            byModel: {},
        };
    }
    /**
     * Génère une clé de cache unique
     */
    EmbeddingCache.prototype.getCacheKey = function (text, model) {
        // Hash simple du texte
        var hash = 0;
        for (var i = 0; i < Math.min(text.length, 1000); i++) {
            var char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return "".concat(model, ":").concat(hash, ":").concat(text.length);
    };
    /**
     * Fonction de hachage simple (utilitaire)
     */
    EmbeddingCache.simpleHash = function (text) {
        var hash = 0;
        for (var i = 0; i < text.length; i++) {
            var char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    };
    /**
     * Récupère un embedding depuis le cache
     */
    EmbeddingCache.prototype.get = function (text, model) {
        var key = this.getCacheKey(text, model);
        var entry = this.cache.get(key);
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
        vector_store_interface_js_1.VectorStoreLogger.debug("embedding.cache.hit", "Using cached embedding", {
            model: model,
            textPreview: text.substring(0, 50),
        });
        return entry.vector;
    };
    /**
     * Met un embedding en cache
     */
    EmbeddingCache.prototype.set = function (text, vector, model, contentType, language) {
        var key = this.getCacheKey(text, model);
        this.cache.set(key, {
            vector: vector,
            model: model,
            timestamp: Date.now(),
            contentType: contentType,
            language: language,
        });
        // Gérer la taille du cache (LRU simple)
        if (this.cache.size > this.config.maxSize) {
            var firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
                this.stats.evictions++;
            }
        }
        vector_store_interface_js_1.VectorStoreLogger.debug("embedding.cache.set", "Embedding cached", {
            model: model,
            contentType: contentType,
            cacheSize: this.cache.size,
        });
    };
    /**
     * Vide complètement le cache
     */
    EmbeddingCache.prototype.clear = function () {
        this.cache.clear();
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            byModel: {},
        };
        vector_store_interface_js_1.VectorStoreLogger.info("embedding.cache.cleared", "Cache des embeddings vidé");
    };
    /**
     * Obtient les statistiques du cache
     */
    EmbeddingCache.prototype.getStats = function () {
        var totalRequests = this.stats.hits + this.stats.misses;
        var hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
        return {
            totalEntries: this.cache.size,
            byModel: __assign({}, this.stats.byModel),
            hitRate: hitRate,
            hits: this.stats.hits,
            misses: this.stats.misses,
            evictions: this.stats.evictions,
        };
    };
    /**
     * Supprime les entrées expirées du cache
     */
    EmbeddingCache.prototype.cleanup = function () {
        var now = Date.now();
        var removed = 0;
        for (var _i = 0, _a = this.cache.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], entry = _b[1];
            if (now - entry.timestamp > this.config.ttlMs) {
                this.cache.delete(key);
                removed++;
            }
        }
        if (removed > 0) {
            vector_store_interface_js_1.VectorStoreLogger.debug("embedding.cache.cleanup", "Expired entries removed", {
                removed: removed,
                remaining: this.cache.size,
            });
        }
        return removed;
    };
    /**
     * Obtient la taille actuelle du cache
     */
    EmbeddingCache.prototype.size = function () {
        return this.cache.size;
    };
    /**
     * Vérifie si le cache contient une clé
     */
    EmbeddingCache.prototype.has = function (text, model) {
        var key = this.getCacheKey(text, model);
        var entry = this.cache.get(key);
        if (!entry)
            return false;
        // Vérifier si l'entrée est expirée
        if (Date.now() - entry.timestamp > this.config.ttlMs) {
            this.cache.delete(key);
            return false;
        }
        return true;
    };
    return EmbeddingCache;
}());
exports.EmbeddingCache = EmbeddingCache;
/**
 * Instance singleton par défaut
 */
var defaultCacheInstance = null;
/**
 * Obtient l'instance singleton du cache
 */
function getDefaultEmbeddingCache() {
    if (!defaultCacheInstance) {
        defaultCacheInstance = new EmbeddingCache();
        vector_store_interface_js_1.VectorStoreLogger.info("embedding.cache.init", "Default embedding cache initialized");
    }
    return defaultCacheInstance;
}
/**
 * Configure l'instance singleton du cache
 */
function configureDefaultEmbeddingCache(config) {
    defaultCacheInstance = new EmbeddingCache(config);
    vector_store_interface_js_1.VectorStoreLogger.info("embedding.cache.configured", "Default embedding cache configured", {
        maxSize: config.maxSize,
        ttlMs: config.ttlMs,
    });
}
/**
 * Vide le cache singleton
 */
function clearDefaultEmbeddingCache() {
    if (defaultCacheInstance) {
        defaultCacheInstance.clear();
    }
}
/**
 * Obtient les statistiques du cache singleton
 */
function getDefaultEmbeddingCacheStats() {
    return defaultCacheInstance ? defaultCacheInstance.getStats() : {
        totalEntries: 0,
        byModel: {},
        hitRate: 0,
        hits: 0,
        misses: 0,
        evictions: 0,
    };
}
