import { Pool } from "pg";
import { promisify } from "util";
import { gunzip, gzip } from "zlib";
import { SearchResult } from "./types.js";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

// Configuration de la connexion PostgreSQL
const pool = new Pool({
    host: "localhost",
    port: 5432,
    database: "rag_db",
    user: "rag_user",
    password: "rag_password",
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// ========== NOUVELLE ARCHITECTURE: CONFIGURATION MULTI-MODÈLES ==========

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

// File d'attente pour batching Ollama
let ollamaBatchQueue: Array<{
    text: string;
    model: string;
    resolve: (embedding: number[]) => void;
    reject: (error: Error) => void;
}> = [];
let batchTimeout: NodeJS.Timeout | null = null;
const BATCH_DELAY_MS = 50;
const BATCH_MAX_SIZE = 10;

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

    console.error(`Embedding provider configured: ${provider}`);
    console.error(`Models: ${JSON.stringify(embeddingModels)}`);
}

/**
 * Configure uniquement les modèles (sans changer le provider)
 */
export function setEmbeddingModels(models: Partial<EmbeddingModelConfig>): void {
    embeddingModels = { ...embeddingModels, ...models };
    console.error(`Embedding models updated: ${JSON.stringify(embeddingModels)}`);
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
    console.error("Embedding cache cleared");
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

// ========== GÉNÉRATION D'EMBEDDINGS AVEC ROUTAGE ==========

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
        console.error(`Using cached embedding (${model}) for: ${text.substring(0, 50)}...`);
        return cached;
    }

    // 3. Générer l'embedding avec le modèle approprié
    console.error(`Generating embedding with ${model} for ${contentType}: ${text.substring(0, 50)}...`);
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

// ========== OLLAMA EMBEDDINGS AVEC SUPPORT MULTI-MODÈLES ==========

/**
 * Génère un embedding avec Ollama (version avec cache et batching)
 */
async function generateOllamaEmbedding(text: string, model: string): Promise<number[]> {
    // Si le provider n'est pas Ollama, utiliser les embeddings factices
    if (embeddingProvider !== "ollama") {
        return generateFakeEmbedding(text, model);
    }

    console.error(`Queueing Ollama embedding (${model}): ${text.substring(0, 50)}...`);

    // Retourner une promesse qui sera résolue par le batch
    return new Promise((resolve, reject) => {
        ollamaBatchQueue.push({ text, model, resolve, reject });

        // Démarrer le traitement du batch si nécessaire
        if (!batchTimeout) {
            batchTimeout = setTimeout(processOllamaBatch, BATCH_DELAY_MS);
        }

        // Traiter immédiatement si le batch est plein
        if (ollamaBatchQueue.length >= BATCH_MAX_SIZE) {
            if (batchTimeout) {
                clearTimeout(batchTimeout);
                batchTimeout = null;
            }
            processOllamaBatch();
        }
    });
}

/**
 * Traite un batch de requêtes Ollama
 */
async function processOllamaBatch(): Promise<void> {
    if (batchTimeout) {
        clearTimeout(batchTimeout);
        batchTimeout = null;
    }

    if (ollamaBatchQueue.length === 0) {
        return;
    }

    // Grouper par modèle pour des batches optimisés
    const batchesByModel = new Map<string, Array<{
        text: string;
        resolve: (embedding: number[]) => void;
        reject: (error: Error) => void;
    }>>();

    ollamaBatchQueue.forEach(item => {
        if (!batchesByModel.has(item.model)) {
            batchesByModel.set(item.model, []);
        }
        batchesByModel.get(item.model)!.push({
            text: item.text,
            resolve: item.resolve,
            reject: item.reject
        });
    });

    // Vider la file d'attente
    ollamaBatchQueue = [];

    // Traiter chaque batch par modèle
    for (const [model, batch] of batchesByModel) {
        await processOllamaBatchForModel(model, batch);
    }
}

/**
 * Traite un batch pour un modèle spécifique
 */
async function processOllamaBatchForModel(
    model: string,
    batch: Array<{ text: string; resolve: (embedding: number[]) => void; reject: (error: Error) => void }>
): Promise<void> {
    const texts = batch.map(item => item.text);

    console.error(`Processing Ollama batch for ${model} (${texts.length} texts)`);

    try {
        const response = await fetch('http://localhost:11434/api/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model,
                input: texts,
            }),
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.embeddings || !Array.isArray(data.embeddings)) {
            // Fallback: traiter chaque texte individuellement
            console.error('Ollama batch API not supported, falling back to individual requests');
            await processIndividualOllamaRequests(model, batch);
            return;
        }

        // Vérifier que nous avons le bon nombre d'embeddings
        if (data.embeddings.length !== texts.length) {
            throw new Error(`Ollama batch API returned ${data.embeddings.length} embeddings, expected ${texts.length}`);
        }

        // Distribuer les résultats
        for (let i = 0; i < batch.length; i++) {
            const embedding = data.embeddings[i];
            const { text, resolve } = batch[i];

            if (!embedding || !Array.isArray(embedding)) {
                resolve(generateFakeEmbedding(text, model));
            } else {
                resolve(embedding);
            }
        }

    } catch (error) {
        console.error(`Failed to process Ollama batch for ${model}: ${error}. Falling back to individual requests.`);
        await processIndividualOllamaRequests(model, batch);
    }
}

/**
 * Traite les requêtes Ollama individuellement (fallback)
 */
async function processIndividualOllamaRequests(
    model: string,
    batch: Array<{ text: string; resolve: (embedding: number[]) => void; reject: (error: Error) => void }>
): Promise<void> {
    for (const item of batch) {
        try {
            const response = await fetch('http://localhost:11434/api/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: model,
                    prompt: item.text,
                }),
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.embedding || !Array.isArray(data.embedding)) {
                throw new Error('Invalid response from Ollama API: missing embedding array');
            }

            item.resolve(data.embedding);

        } catch (error) {
            console.error(`Failed to get embedding from Ollama for individual request: ${error}. Falling back to fake embeddings.`);
            // Fallback sur les embeddings factices
            item.resolve(generateFakeEmbedding(item.text, model));
        }
    }
}

// ========== SENTENCE TRANSFORMERS (À IMPLÉMENTER) ==========

async function generateSentenceTransformerEmbedding(text: string, model: string): Promise<number[]> {
    console.error(`Generating embedding with Sentence Transformers (${model}): ${text.substring(0, 50)}...`);
    // TODO: Implémenter avec @xenova/transformers
    return generateFakeEmbedding(text, model);
}

// ========== FONCTIONS EXISTANTES (MISES À JOUR) ==========

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

/**
 * Fonction pour nettoyer le filePath
 */
function cleanFilePath(filePath: string): string {
    return filePath.replace(/#chunk\d+$/, '');
}

/**
 * Stocke un document avec son embedding (version mise à jour avec routage)
 */
export async function embedAndStore(
    projectPath: string,
    filePath: string,
    content: string,
    options: EmbedAndStoreOptions = {}
): Promise<void
