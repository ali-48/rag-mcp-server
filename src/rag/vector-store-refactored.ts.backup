// src/rag/vector-store-refactored.ts
// Version SQLite complète - Remplacement de PostgreSQL

import { logger } from '../core/logger.js';
import { VectorStoreSQLite } from './vector-store-sqlite.js';

// ========== CONFIGURATION MULTI-MODÈLES ==========

// Configuration des modèles par type de contenu
interface EmbeddingModelConfig {
    code: string;      // nomic-embed-code
    text: string;      // nomic-embed-text  
    config: string;    // bge-small
    fallback: string;  // qwen3-embedding:8b
}

// Configuration du provider
let embeddingProvider: string = "fake";
let embeddingModels: EmbeddingModelConfig = {
    code: 'nomic-embed-code',
    text: 'nomic-embed-text',
    config: 'bge-small',
    fallback: 'qwen3-embedding:8b'
};

// Dimensions par type (pour référence)
const embeddingDimensions: Record<keyof EmbeddingModelConfig, number> = {
    code: 768,
    text: 768,
    config: 384,
    fallback: 1024
};

// Cache pour embeddings avec métadonnées
interface CacheEntry {
    vector: number[];
    model: string;
    timestamp: number;
    contentType: string;
    language?: string;
}

const embeddingCache = new Map<string, CacheEntry>();
const CACHE_MAX_SIZE = 1000;
const CACHE_TTL = 3600 * 1000; // 1 heure en millisecondes

// Statistiques de cache
let cacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    byModel: {} as Record<string, number>
};

// Instance du backend SQLite
let vectorStore: VectorStoreSQLite | null = null;

/**
 * Obtient l'instance du VectorStoreSQLite (singleton)
 */
function getVectorStore(): VectorStoreSQLite {
    if (!vectorStore) {
        vectorStore = new VectorStoreSQLite();
        logger.info('rag.vectorstore.sqlite.init', 'VectorStoreSQLite initialisé');
    }
    return vectorStore;
}

// ========== FONCTIONS DE CONFIGURATION ==========

/**
 * Configure le fournisseur d'embeddings avec support multi-modèles
 */
export function setEmbeddingProvider(
    provider: string,
    defaultModel: string = 'qwen3-embedding:8b',
    modelConfig?: Partial<EmbeddingModelConfig>
): void {
    embeddingProvider = provider;

    // Configuration par défaut
    const defaultModels: EmbeddingModelConfig = {
        code: 'nomic-embed-code',
        text: 'nomic-embed-text',
        config: 'bge-small',
        fallback: defaultModel
    };

    // Fusionner avec la configuration fournie
    embeddingModels = { ...defaultModels, ...modelConfig };

    logger.info('rag.embedding.provider.configured', `Embedding provider configured: ${provider}`, {
        provider,
        models: embeddingModels
    });
}

/**
 * Configure uniquement les modèles (sans changer le provider)
 */
export function setEmbeddingModels(models: Partial<EmbeddingModelConfig>): void {
    embeddingModels = { ...embeddingModels, ...models };
    logger.info('rag.embedding.models.updated', `Embedding models updated`, {
        models: embeddingModels
    });
}

/**
 * Détermine le modèle approprié pour un type de contenu
 */
export function getEmbeddingModelForContentType(
    contentType: string,
    language?: string
): string {
    // Normaliser le type de contenu
    const normalizedType = contentType.toLowerCase();

    // Routage basé sur le type
    switch (normalizedType) {
        case 'code':
        case 'source':
        case 'program':
            return embeddingModels.code;

        case 'doc':
        case 'text':
        case 'documentation':
        case 'markdown':
        case 'readme':
            return embeddingModels.text;

        case 'config':
        case 'configuration':
        case 'json':
        case 'yaml':
        case 'toml':
        case 'ini':
            return embeddingModels.config;

        default:
            return embeddingModels.fallback;
    }
}

/**
 * Obtient la dimension attendue pour un modèle
 */
export function getEmbeddingDimensionForModel(model: string): number {
    // Chercher dans la configuration
    for (const [type, modelName] of Object.entries(embeddingModels)) {
        if (modelName === model) {
            return embeddingDimensions[type as keyof EmbeddingModelConfig];
        }
    }

    // Fallback
    return embeddingDimensions.fallback;
}

// ========== GESTION DU CACHE ==========

/**
 * Génère une clé de cache unique
 */
function getCacheKey(text: string, model: string): string {
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
 * Récupère un embedding depuis le cache
 */
function getCachedEmbedding(text: string, model: string): number[] | null {
    const key = getCacheKey(text, model);
    const entry = embeddingCache.get(key);

    if (!entry) {
        cacheStats.misses++;
        return null;
    }

    // Vérifier la validité du cache
    if (Date.now() - entry.timestamp > CACHE_TTL) {
        embeddingCache.delete(key);
        cacheStats.misses++;
        return null;
    }

    // Mettre à jour les statistiques
    cacheStats.hits++;
    cacheStats.byModel[model] = (cacheStats.byModel[model] || 0) + 1;

    return entry.vector;
}

/**
 * Met un embedding en cache
 */
function cacheEmbedding(
    text: string,
    vector: number[],
    model: string,
    contentType: string,
    language?: string
): void {
    const key = getCacheKey(text, model);

    embeddingCache.set(key, {
        vector,
        model,
        timestamp: Date.now(),
        contentType,
        language
    });

    // Gérer la taille du cache (LRU simple)
    if (embeddingCache.size > CACHE_MAX_SIZE) {
        const firstKey = embeddingCache.keys().next().value;
        if (firstKey) {
            embeddingCache.delete(firstKey);
            cacheStats.evictions++;
        }
    }
}

/**
 * Vide le cache des embeddings
 */
export function clearEmbeddingCache(): void {
    embeddingCache.clear();
    cacheStats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        byModel: {}
    };
    logger.info('rag.embedding.cache.cleared', 'Embedding cache cleared');
}

/**
 * Obtient les statistiques du cache
 */
export function getEmbeddingCacheStats(): {
    totalEntries: number;
    byModel: Record<string, number>;
    hitRate: number;
    hits: number;
    misses: number;
    evictions: number;
} {
    const totalRequests = cacheStats.hits + cacheStats.misses;
    const hitRate = totalRequests > 0 ? (cacheStats.hits / totalRequests) * 100 : 0;

    return {
        totalEntries: embeddingCache.size,
        byModel: { ...cacheStats.byModel },
        hitRate,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        evictions: cacheStats.evictions
    };
}

// ========== GÉNÉRATION D'EMBEDDINGS ==========

/**
 * Normalise un vecteur selon la norme L2
 */
function normalizeL2(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0) return vector;
    return vector.map(val => val / norm);
}

/**
 * Génère un embedding avec routage automatique par type de contenu
 */
export async function generateEmbeddingForContent(
    text: string,
    contentType: string = 'other',
    language?: string
): Promise<number[]> {
    // 1. Déterminer le modèle approprié
    const model = getEmbeddingModelForContentType(contentType, language);

    // 2. Vérifier le cache
    const cached = getCachedEmbedding(text, model);
    if (cached) {
        logger.debug('rag.embedding.cache.hit', `Using cached embedding (${model})`, {
            model,
            textPreview: text.substring(0, 50)
        });
        return cached;
    }

    // 3. Générer l'embedding avec le modèle approprié
    logger.debug('rag.embedding.generating', `Generating embedding with ${model} for ${contentType}`, {
        model,
        contentType,
        textPreview: text.substring(0, 50)
    });
    const vector = await generateEmbeddingWithModel(text, model);

    // 4. Normaliser
    const normalizedVector = normalizeL2(vector);

    // 5. Mettre en cache
    cacheEmbedding(text, normalizedVector, model, contentType, language);

    return normalizedVector;
}

/**
 * Génère un embedding avec un modèle spécifique (compatibilité)
 */
async function generateEmbeddingWithModel(text: string, model: string): Promise<number[]> {
    switch (embeddingProvider) {
        case "ollama":
            return await generateOllamaEmbedding(text, model);
        case "sentence-transformers":
            return await generateSentenceTransformerEmbedding(text, model);
        case "fake":
        default:
            return generateFakeEmbedding(text, model);
    }
}

/**
 * Génère des embeddings factices améliorés
 */
function generateFakeEmbedding(text: string, model: string): number[] {
    // Déterminer la dimension basée sur le modèle
    const dimension = getEmbeddingDimensionForModel(model);

    // Seed basée sur le texte et le modèle
    const seed = simpleHash(text + model);

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
function simpleHash(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

// ========== OLLAMA EMBEDDINGS ==========

/**
 * Génère un embedding avec Ollama
 */
async function generateOllamaEmbedding(text: string, model: string): Promise<number[]> {
    // Si le provider n'est pas Ollama, utiliser les embeddings factices
    if (embeddingProvider !== "ollama") {
        return generateFakeEmbedding(text, model);
    }

    logger.debug('rag.embedding.ollama.generating', `Generating Ollama embedding (${model})`, {
        model,
        textPreview: text.substring(0, 50)
    });

    try {
        const response = await fetch('http://localhost:11434/api/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model,
                prompt: text,
            }),
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.embedding || !Array.isArray(data.embedding)) {
            throw new Error('Invalid response from Ollama API: missing embedding array');
        }

        return data.embedding;
    } catch (error) {
        logger.error('rag.embedding.ollama.failed', `Failed to get embedding from Ollama`, {
            model,
            error: error instanceof Error ? error.message : String(error)
        });
        // Fallback sur les embeddings factices
        return generateFakeEmbedding(text, model);
    }
}

// ========== SENTENCE TRANSFORMERS ==========

async function generateSentenceTransformerEmbedding(text: string, model: string): Promise<number[]> {
    logger.debug('rag.embedding.sentence-transformers.generating', `Generating Sentence Transformers embedding (${model})`, {
        model,
        textPreview: text.substring(0, 50)
    });
    // TODO: Implémenter avec @xenova/transformers
    return generateFakeEmbedding(text, model);
}

// ========== INTERFACES ET FONCTIONS PRINCIPALES ==========

export interface EmbedAndStoreOptions {
    chunkIndex?: number;
    totalChunks?: number;
    contentType?: string;
    role?: string;
    fileExtension?: string;
    language?: string;
    linesCount?: number;
    isCompressed?: boolean;
}

export interface SemanticSearchOptions {
    projectFilter?: string;
    limit?: number;
    threshold?: number;
    dynamicThreshold?: boolean;
    contentTypeFilter?: string | string[];
    roleFilter?: string | string[];
    fileExtensionFilter?: string | string[];
    languageFilter?: string | string[];
    minFileSizeBytes?: number;
    maxFileSizeBytes?: number;
    minLinesCount?: number;
    maxLinesCount?: number;
    dateFrom?: Date;
    dateTo?: Date;
    includeCompressed?: boolean;
    excludeCompressed?: boolean;
    enableReranking?: boolean;
}

/**
 * Stocke un document avec son embedding
 */
export async function embedAndStore(
    projectPath: string,
    filePath: string,
    content: string,
    options: EmbedAndStoreOptions = {}
): Promise<void> {
    const {
        chunkIndex = 0,
        totalChunks = 1,
        contentType = 'other',
        role = null,
        fileExtension = null,
        language = null,
        linesCount = null,
        isCompressed = false
    } = options;

    // Générer l'embedding avec routage automatique par type de contenu
    const vector = await generateEmbeddingForContent(content, contentType, language || undefined);

    try {
        // Utiliser le backend SQLite
        const store = getVectorStore();
        await store.embedAndStore(projectPath, filePath, content, vector, {
            chunkIndex,
            totalChunks,
            contentType,
            role: role || undefined,
            fileExtension: fileExtension || undefined,
            language: language || undefined,
            linesCount: linesCount || undefined,
            isCompressed
        });
    } catch (error) {
        logger.error('rag.vectorstore.embed.store.error', `Erreur lors du stockage du document`, {
            projectPath,
            filePath,
            error: error instanceof Error ? error.message : String(error)
        });
        throw error;
    }
}

/**
 * Recherche sémantique
 */
export async function semanticSearch(
    query: string,
    options: SemanticSearchOptions = {}
): Promise<Array<{ id: string; filePath: string; content: string; score: number; metadata: any }>> {
    const {
        projectFilter,
        limit = 10,
        threshold = 0.3,
        contentTypeFilter,
        roleFilter,
        languageFilter,
        minFileSizeBytes,
        maxFileSizeBytes,
        minLinesCount,
        maxLinesCount,
        dateFrom,
        dateTo
    } = options;

    // Générer l'embedding pour la requête
    const queryVector = await generateEmbeddingForContent(query, 'other');

    try {
        // Utiliser le backend SQLite
        const store = getVectorStore();
        const results = await store.semanticSearch(queryVector, {
            projectFilter,
            limit,
            threshold,
            contentTypeFilter,
            roleFilter,
            languageFilter,
            minFileSizeBytes,
            maxFileSizeBytes,
            minLinesCount,
            maxLinesCount,
            dateFrom,
            dateTo
        });

        // Convertir les résultats au format attendu
        return results.map(result => ({
            id: result.id,
            filePath: result.filePath,
            content: result.content,
            score: result.score,
            metadata: result.metadata
        }));
    } catch (error) {
        logger.error('rag.vectorstore.search.error', `Erreur lors de la recherche sémantique`, {
            query,
            error: error instanceof Error ? error.message : String(error)
        });
        throw error;
    }
}

/**
 * Obtient les statistiques d'un projet
 */
export async function getProjectStats(projectPath: string): Promise<{
    totalFiles: number;
    totalChunks: number;
    indexedAt: Date | null;
    lastUpdated: Date | null;
    contentTypes: Record<string, number>;
}> {
    try {
        const store = getVectorStore();
        return await store.getProjectStats(projectPath);
    } catch (error) {
        logger.error('rag.vectorstore.stats.error', `Erreur lors de la récupération des stats pour ${projectPath}`, {
            projectPath,
            error: error instanceof Error ? error.message : String(error)
        });
        throw error;
    }
}

/**
 * Liste tous les projets indexés
 */
export async function listProjects(): Promise<string[]> {
    try {
        const store = getVectorStore();
        return await store.listProjects();
    } catch (error) {
        logger.error('rag.vectorstore.list.error', 'Erreur lors du listing des projets', {
            error: error instanceof Error ? error.message : String(error)
        });
        throw error;
    }
}
