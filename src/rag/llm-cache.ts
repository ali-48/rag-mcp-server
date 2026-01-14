interface CacheEntry {
    content: string;
    analysis: string;
    timestamp: number;
    task: string;
    contentType: string;
}

export interface CacheStats {
    hits: number;
    misses: number;
    size: number;
    maxSize: number;
    hitRatio: number;
    oldestEntry: number | null;
    newestEntry: number | null;
}

export class LlmCache {
    private cache = new Map<string, CacheEntry>();
    private ttlSeconds: number;
    private maxSize: number;
    private stats = {
        hits: 0,
        misses: 0
    };

    constructor(ttlSeconds: number = 3600, maxSize: number = 1000) {
        this.ttlSeconds = ttlSeconds;
        this.maxSize = maxSize;
        this.startCleanupInterval();
    }

    getKey(content: string, filePath: string, task: string): string {
        return `${filePath}:${task}:${hashString(content)}`;
    }

    get(content: string, filePath: string, task: string, contentType: string = 'unknown'): string | null {
        const key = this.getKey(content, filePath, task);
        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.misses++;
            // Pas de logs sur stderr pour compatibilité MCP
            return null;
        }

        // Vérifier l'expiration
        if (Date.now() - entry.timestamp > this.ttlSeconds * 1000) {
            this.cache.delete(key);
            this.stats.misses++;
            // Pas de logs sur stderr pour compatibilité MCP
            return null;
        }

        this.stats.hits++;
        // Pas de logs sur stderr pour compatibilité MCP
        return entry.analysis;
    }

    set(content: string, filePath: string, task: string, analysis: string, contentType: string = 'unknown'): void {
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

        // Pas de logs sur stderr pour compatibilité MCP
    }

    has(content: string, filePath: string, task: string): boolean {
        const key = this.getKey(content, filePath, task);
        const entry = this.cache.get(key);

        if (!entry) return false;

        // Vérifier l'expiration
        if (Date.now() - entry.timestamp > this.ttlSeconds * 1000) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }

    clear(): void {
        const size = this.cache.size;
        this.cache.clear();
        this.stats.hits = 0;
        this.stats.misses = 0;
        // Pas de logs sur stderr pour compatibilité MCP
    }

    getStats(): CacheStats {
        let oldestEntry: number | null = null;
        let newestEntry: number | null = null;

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

    private evictOldest(): void {
        let oldestKey: string | null = null;
        let oldestTimestamp = Date.now();

        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp < oldestTimestamp) {
                oldestTimestamp = entry.timestamp;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
            // Pas de logs sur stderr pour compatibilité MCP
        }
    }

    private startCleanupInterval(): void {
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
                // Pas de logs sur stderr pour compatibilité MCP
            }
        }, 60000); // Nettoyage toutes les minutes
    }

    // Méthode pour obtenir un snapshot du cache (utile pour le débogage)
    getSnapshot(): Array<{ key: string, entry: CacheEntry }> {
        return Array.from(this.cache.entries()).map(([key, entry]) => ({ key, entry }));
    }
}

function hashString(str: string): string {
    // Hash simple pour le cache (djb2)
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return Math.abs(hash).toString(36);
}

// Instance singleton pour une utilisation globale
let globalCache: LlmCache | null = null;

export function getLlmCache(ttlSeconds?: number, maxSize?: number): LlmCache {
    if (!globalCache) {
        globalCache = new LlmCache(ttlSeconds, maxSize);
    }
    return globalCache;
}

// Fonction utilitaire pour créer un cache avec la configuration RAG
import { getRagConfigManager } from "../config/rag-config.js";

export function createCacheFromConfig(): LlmCache {
    const configManager = getRagConfigManager();
    const preparationConfig = configManager.getPreparationConfig();

    const ttlSeconds = preparationConfig.cache_ttl_seconds || 3600;
    const maxSize = 1000; // Taille maximale par défaut

    return new LlmCache(ttlSeconds, maxSize);
}
