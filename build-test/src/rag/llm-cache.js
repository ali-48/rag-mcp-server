export class LlmCache {
    cache = new Map();
    ttlSeconds;
    maxSize;
    stats = {
        hits: 0,
        misses: 0
    };
    constructor(ttlSeconds = 3600, maxSize = 1000) {
        this.ttlSeconds = ttlSeconds;
        this.maxSize = maxSize;
        this.startCleanupInterval();
    }
    getKey(content, filePath, task) {
        return `${filePath}:${task}:${hashString(content)}`;
    }
    get(content, filePath, task, contentType = 'unknown') {
        const key = this.getKey(content, filePath, task);
        const entry = this.cache.get(key);
        if (!entry) {
            this.stats.misses++;
            console.log(`❌ Cache miss: ${filePath} (${task})`);
            return null;
        }
        // Vérifier l'expiration
        if (Date.now() - entry.timestamp > this.ttlSeconds * 1000) {
            this.cache.delete(key);
            this.stats.misses++;
            console.log(`⏰ Cache expired: ${filePath} (${task})`);
            return null;
        }
        this.stats.hits++;
        console.log(`✅ Cache hit: ${filePath} (${task})`);
        return entry.analysis;
    }
    set(content, filePath, task, analysis, contentType = 'unknown') {
        // Vérifier la taille maximale
        if (this.cache.size >= this.maxSize) {
            this.evictOldest();
        }
        const key = this.getKey(content, filePath, task);
        this.cache.set(key, {
            content,
            analysis,
            timestamp: Date.now(),
            task,
            contentType
        });
        console.log(`💾 Cache set: ${filePath} (${task}), taille: ${this.cache.size}/${this.maxSize}`);
    }
    has(content, filePath, task) {
        const key = this.getKey(content, filePath, task);
        const entry = this.cache.get(key);
        if (!entry)
            return false;
        // Vérifier l'expiration
        if (Date.now() - entry.timestamp > this.ttlSeconds * 1000) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        this.stats.hits = 0;
        this.stats.misses = 0;
        console.log(`🧹 Cache cleared (${size} entrées supprimées)`);
    }
    getStats() {
        let oldestEntry = null;
        let newestEntry = null;
        for (const entry of this.cache.values()) {
            if (oldestEntry === null || entry.timestamp < oldestEntry) {
                oldestEntry = entry.timestamp;
            }
            if (newestEntry === null || entry.timestamp > newestEntry) {
                newestEntry = entry.timestamp;
            }
        }
        const total = this.stats.hits + this.stats.misses;
        const hitRatio = total > 0 ? this.stats.hits / total : 0;
        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            size: this.cache.size,
            maxSize: this.maxSize,
            hitRatio,
            oldestEntry,
            newestEntry
        };
    }
    evictOldest() {
        let oldestKey = null;
        let oldestTimestamp = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp < oldestTimestamp) {
                oldestTimestamp = entry.timestamp;
                oldestKey = key;
            }
        }
        if (oldestKey) {
            this.cache.delete(oldestKey);
            console.log(`🗑️ Éviction cache: ${oldestKey}`);
        }
    }
    startCleanupInterval() {
        setInterval(() => {
            const now = Date.now();
            let expiredCount = 0;
            for (const [key, entry] of this.cache.entries()) {
                if (now - entry.timestamp > this.ttlSeconds * 1000) {
                    this.cache.delete(key);
                    expiredCount++;
                }
            }
            if (expiredCount > 0) {
                console.log(`🧹 Nettoyage cache: ${expiredCount} entrées expirées supprimées`);
            }
        }, 60000); // Nettoyage toutes les minutes
    }
    // Méthode pour obtenir un snapshot du cache (utile pour le débogage)
    getSnapshot() {
        return Array.from(this.cache.entries()).map(([key, entry]) => ({ key, entry }));
    }
}
function hashString(str) {
    // Hash simple pour le cache (djb2)
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return Math.abs(hash).toString(36);
}
// Instance singleton pour une utilisation globale
let globalCache = null;
export function getLlmCache(ttlSeconds, maxSize) {
    if (!globalCache) {
        globalCache = new LlmCache(ttlSeconds, maxSize);
    }
    return globalCache;
}
// Fonction utilitaire pour créer un cache avec la configuration RAG
import { getRagConfigManager } from "../config/rag-config.js";
export function createCacheFromConfig() {
    const configManager = getRagConfigManager();
    const preparationConfig = configManager.getPreparationConfig();
    const ttlSeconds = preparationConfig.cache_ttl_seconds || 3600;
    const maxSize = 1000; // Taille maximale par défaut
    return new LlmCache(ttlSeconds, maxSize);
}
//# sourceMappingURL=llm-cache.js.map