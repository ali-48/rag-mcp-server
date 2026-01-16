// src/rag/vector-store.ts
// Version refactorisée utilisant l'abstraction IVectorStore et VectorStoreFactory
// Remplace le PostgreSQL hardcodé par une configuration dynamique
import { createVectorStore, createVectorStoreForProject } from './vector-store-factory.js';
import { VectorStoreLogger } from './vector-store-interface.js';
// Configuration des embeddings
let embeddingProvider = "fake";
let embeddingModels = {
    code: 'nomic-embed-code',
    text: 'nomic-embed-text',
    config: 'bge-small',
    fallback: 'qwen3-embedding:8b'
};
// Dimensions par type (pour référence)
const embeddingDimensions = {
    code: 768,
    text: 768,
    config: 384,
    fallback: 1024
};
const embeddingCache = new Map();
const CACHE_MAX_SIZE = 1000;
const CACHE_TTL = 3600 * 1000; // 1 heure en millisecondes
// Statistiques de cache
let cacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    byModel: {}
};
// File d'attente pour batching Ollama
let ollamaBatchQueue = [];
let batchTimeout = null;
const BATCH_DELAY_MS = 50; // Délai avant traitement du batch
const BATCH_MAX_SIZE = 10; // Taille maximale du batch
// Instance de vector store (singleton)
let vectorStoreInstance = null;
/**
 * Obtient l'instance de vector store (singleton)
 * Utilise la configuration du projet par défaut
 */
function getVectorStore() {
    if (!vectorStoreInstance) {
        // Créer le vector store basé sur la configuration du projet
        vectorStoreInstance = createVectorStoreForProject(process.cwd());
        VectorStoreLogger.info('vectorstore.init', 'Vector store initialisé', {
            type: 'dynamic',
            projectPath: process.cwd()
        });
    }
    return vectorStoreInstance;
}
/**
 * Configure explicitement le vector store avec une configuration spécifique
 * @param config Configuration du vector store
 */
export function configureVectorStore(config) {
    vectorStoreInstance = createVectorStore(config);
    VectorStoreLogger.info('vectorstore.configure', 'Vector store configuré', {
        type: config.type
    });
}
/**
 * Configure le fournisseur d'embeddings avec support multi-modèles
 */
export function setEmbeddingProvider(provider, defaultModel = 'qwen3-embedding:8b', modelConfig) {
    embeddingProvider = provider;
    // Configuration par défaut
    const defaultModels = {
        code: 'nomic-embed-code',
        text: 'nomic-embed-text',
        config: 'bge-small',
        fallback: defaultModel
    };
    // Fusionner avec la configuration fournie
    embeddingModels = { ...defaultModels, ...modelConfig };
    VectorStoreLogger.info('embedding.provider.configured', `Embedding provider configured`, {
        provider,
        models: embeddingModels
    });
}
/**
 * Configure uniquement les modèles (sans changer le provider)
 */
export function setEmbeddingModels(models) {
    embeddingModels = { ...embeddingModels, ...models };
    VectorStoreLogger.info('embedding.models.updated', `Embedding models updated`, {
        models: embeddingModels
    });
}
/**
 * Détermine le modèle approprié pour un type de contenu
 */
export function getEmbeddingModelForContentType(contentType, language) {
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
export function getEmbeddingDimensionForModel(model) {
    // Chercher dans la configuration
    for (const [type, modelName] of Object.entries(embeddingModels)) {
        if (modelName === model) {
            return embeddingDimensions[type];
        }
    }
    // Fallback
    return embeddingDimensions.fallback;
}
/**
 * Normalise un vecteur selon la norme L2
 */
function normalizeL2(vector) {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0)
        return vector;
    return vector.map(val => val / norm);
}
/**
 * Génère des embeddings factices améliorés
 */
function generateFakeEmbedding(text, model = embeddingModels.fallback) {
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
function simpleHash(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}
/**
 * Génère une clé de cache unique
 */
function getCacheKey(text, model) {
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
function getCachedEmbedding(text, model) {
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
function cacheEmbedding(text, vector, model, contentType, language) {
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
 * Génère un embedding avec Ollama
 */
async function generateOllamaEmbedding(text, model = embeddingModels.fallback) {
    // Vérifier le cache d'abord
    const cached = getCachedEmbedding(text, model);
    if (cached) {
        VectorStoreLogger.debug('embedding.cache.hit', `Using cached embedding`, {
            model,
            textPreview: text.substring(0, 50)
        });
        return cached;
    }
    // Si le provider n'est pas Ollama, utiliser les embeddings factices
    if (embeddingProvider !== "ollama") {
        return generateFakeEmbedding(text, model);
    }
    VectorStoreLogger.debug('embedding.ollama.queueing', `Queueing embedding for Ollama`, {
        model,
        textPreview: text.substring(0, 50)
    });
    // Retourner une promesse qui sera résolue par le batch
    return new Promise((resolve, reject) => {
        ollamaBatchQueue.push({ text, resolve, reject });
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
 * Traiter un batch de requêtes Ollama
 */
async function processOllamaBatch() {
    if (batchTimeout) {
        clearTimeout(batchTimeout);
        batchTimeout = null;
    }
    if (ollamaBatchQueue.length === 0) {
        return;
    }
    const batch = ollamaBatchQueue.splice(0, BATCH_MAX_SIZE);
    const texts = batch.map(item => item.text);
    VectorStoreLogger.debug('embedding.ollama.batch', `Processing Ollama batch`, {
        batchSize: texts.length
    });
    try {
        const response = await fetch('http://localhost:11434/api/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: embeddingModels.fallback,
                input: texts,
            }),
        });
        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (!data.embeddings || !Array.isArray(data.embeddings)) {
            // Fallback: traiter chaque texte individuellement
            VectorStoreLogger.warn('embedding.ollama.batch.fallback', 'Ollama batch API not supported, falling back to individual requests');
            await processIndividualOllamaRequests(batch);
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
                resolve(generateFakeEmbedding(text));
            }
            else {
                // Mettre en cache et retourner
                cacheEmbedding(text, embedding, embeddingModels.fallback, 'other');
                resolve(embedding);
            }
        }
    }
    catch (error) {
        VectorStoreLogger.error('embedding.ollama.batch.error', `Failed to process Ollama batch`, error);
        // Fallback: traiter chaque texte individuellement
        await processIndividualOllamaRequests(batch);
    }
}
/**
 * Traiter les requêtes Ollama individuellement (fallback)
 */
async function processIndividualOllamaRequests(batch) {
    for (const item of batch) {
        try {
            const response = await fetch('http://localhost:11434/api/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: embeddingModels.fallback,
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
            // Mettre en cache et résoudre
            cacheEmbedding(item.text, data.embedding, embeddingModels.fallback, 'other');
            item.resolve(data.embedding);
        }
        catch (error) {
            VectorStoreLogger.error('embedding.ollama.individual.error', `Failed to get embedding from Ollama for individual request`, error);
            // Fallback sur les embeddings factices
            const fakeEmbedding = generateFakeEmbedding(item.text);
            cacheEmbedding(item.text, fakeEmbedding, embeddingModels.fallback, 'other');
            item.resolve(fakeEmbedding);
        }
    }
}
/**
 * Embeddings avec Sentence Transformers (à implémenter)
 */
async function generateSentenceTransformerEmbedding(text) {
    VectorStoreLogger.debug('embedding.sentence-transformers', `Generating embedding with Sentence Transformers`, {
        textPreview: text.substring(0, 50)
    });
    // TODO: Implémenter avec @xenova/transformers
    return generateFakeEmbedding(text, embeddingModels.fallback);
}
/**
 * Génère un embedding avec routage automatique par type de contenu
 */
async function generateEmbeddingForContent(text, contentType = 'other', language) {
    // 1. Déterminer le modèle approprié
    const model = getEmbeddingModelForContentType(contentType, language);
    // 2. Vérifier le cache
    const cached = getCachedEmbedding(text, model);
    if (cached) {
        VectorStoreLogger.debug('embedding.cache.hit', `Using cached embedding (${model})`, {
            model,
            textPreview: text.substring(0, 50)
        });
        return cached;
    }
    // 3. Générer l'embedding avec le modèle approprié
    VectorStoreLogger.debug('embedding.generating', `Generating embedding with ${model} for ${contentType}`, {
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
async function generateEmbeddingWithModel(text, model) {
    switch (embeddingProvider) {
        case "ollama":
            return await generateOllamaEmbedding(text, model);
        case "sentence-transformers":
            return await generateSentenceTransformerEmbedding(text);
        case "fake":
        default:
            return generateFakeEmbedding(text, model);
    }
}
/**
 * Génère un embedding selon le fournisseur configuré (compatibilité)
 */
async function generateEmbedding(text) {
    // Utiliser le modèle par défaut pour la compatibilité
    return await generateEmbeddingWithModel(text, embeddingModels.fallback);
}
/**
 * Stocke un document avec son embedding
 */
export async function embedAndStore(projectPath, filePath, content, options = {}) {
    const { chunkIndex = 0, totalChunks = 1, contentType = 'other', role = null, fileExtension = null, language = null, linesCount = null, isCompressed = false } = options;
    // Générer l'embedding avec routage automatique par type de contenu
    const vector = await generateEmbeddingForContent(content, contentType, language || undefined);
    try {
        // Utiliser le vector store abstrait
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
        VectorStoreLogger.info('vectorstore.store', `Document stocké`, {
            projectPath,
            filePath,
            contentType,
            chunkIndex,
            totalChunks
        });
    }
    catch (error) {
        VectorStoreLogger.error('vectorstore.store.error', `Erreur lors du stockage du document`, error, {
            projectPath,
            filePath
        });
        throw error;
    }
}
/**
 * Recherche sémantique
 */
export async function semanticSearch(query, options = {}) {
    const { projectFilter, limit = 10, threshold = 0.3, dynamicThreshold = false, contentTypeFilter, roleFilter, languageFilter, minFileSizeBytes, maxFileSizeBytes, minLinesCount, maxLinesCount, dateFrom, dateTo } = options;
    // Générer l'embedding pour la requête
    const queryVector = await generateEmbeddingForContent(query, 'other');
    try {
        // Utiliser le vector store abstrait
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
    }
    catch (error) {
        VectorStoreLogger.error('vectorstore.search.error', `Erreur lors de la recherche sémantique`, error, {
            query
        });
        throw error;
    }
}
/**
 * Obtient les statistiques d'un projet
 */
export async function getProjectStats(projectPath) {
    try {
        const store = getVectorStore();
        return await store.getProjectStats(projectPath);
    }
    catch (error) {
        VectorStoreLogger.error('vectorstore.stats.error', `Erreur lors de la récupération des stats`, error, {
            projectPath
        });
        throw error;
    }
}
/**
 * Liste tous les projets indexés
 */
export async function listProjects() {
    try {
        const store = getVectorStore();
        return await store.listProjects();
    }
    catch (error) {
        VectorStoreLogger.error('vectorstore.list.error', 'Erreur lors du listing des projets', error);
        throw error;
    }
}
/**
 * Supprime un document par son ID
 */
export async function deleteDocument(id) {
    try {
        const store = getVectorStore();
        return await store.deleteDocument(id);
    }
    catch (error) {
        VectorStoreLogger.error('vectorstore.delete.error', `Erreur lors de la suppression du document`, error, {
            id
        });
        throw error;
    }
}
/**
 * Vide tous les documents (pour les tests)
 */
export async function clearAll() {
    try {
        const store = getVectorStore();
        await store.clearAll();
        VectorStoreLogger.info('vectorstore.clear', 'Tous les documents ont été supprimés');
    }
    catch (error) {
        VectorStoreLogger.error('vectorstore.clear.error', 'Erreur lors du vidage des documents', error);
        throw error;
    }
}
/**
 * Obtient les statistiques globales du store
 */
export async function getStats() {
    try {
        const store = getVectorStore();
        return await store.getStats();
    }
    catch (error) {
        VectorStoreLogger.error('vectorstore.stats.global.error', 'Erreur lors de la récupération des statistiques globales', error);
        throw error;
    }
}
/**
 * Teste la connectivité au vector store
 */
export async function testConnection() {
    try {
        const store = getVectorStore();
        return await store.testConnection();
    }
    catch (error) {
        VectorStoreLogger.error('vectorstore.test.error', 'Erreur lors du test de connexion', error);
        return false;
    }
}
/**
 * Met à jour un document existant
 */
export async function updateDocument(id, updates) {
    try {
        const store = getVectorStore();
        return await store.updateDocument(id, updates);
    }
    catch (error) {
        VectorStoreLogger.error('vectorstore.update.error', `Erreur lors de la mise à jour du document`, error, {
            id
        });
        throw error;
    }
}
/**
 * Recherche hybride (sémantique + textuelle)
 */
export async function hybridSearch(query, options = {}) {
    const { semanticWeight = 0.7, textWeight = 0.3, textQuery, ...semanticOptions } = options;
    try {
        const store = getVectorStore();
        // Si le store supporte la recherche hybride, l'utiliser
        if (store.hybridSearch) {
            const queryVector = await generateEmbedding(query);
            return await store.hybridSearch(queryVector, textQuery || query, {
                ...semanticOptions,
                semanticWeight,
                textWeight
            });
        }
        // Sinon, fallback sur la recherche sémantique
        VectorStoreLogger.warn('vectorstore.hybrid.fallback', 'Recherche hybride non supportée, fallback sur recherche sémantique');
        return await semanticSearch(query, semanticOptions);
    }
    catch (error) {
        VectorStoreLogger.error('vectorstore.hybrid.error', `Erreur lors de la recherche hybride`, error, {
            query
        });
        throw error;
    }
}
/**
 * Recherche par métadonnées
 */
export async function searchByMetadata(filters) {
    try {
        const store = getVectorStore();
        // Si le store supporte la recherche par métadonnées, l'utiliser
        if (store.searchByMetadata) {
            return await store.searchByMetadata(filters);
        }
        // Sinon, fallback sur la recherche sémantique avec filtres
        VectorStoreLogger.warn('vectorstore.metadata.fallback', 'Recherche par métadonnées non supportée, fallback sur recherche sémantique');
        // Convertir les filtres en options de recherche sémantique
        const semanticOptions = {
            projectFilter: filters.projectPath,
            contentTypeFilter: filters.contentType ? [filters.contentType] : undefined,
            roleFilter: filters.role ? [filters.role] : undefined,
            languageFilter: filters.language ? [filters.language] : undefined,
            dateFrom: filters.dateRange?.from,
            dateTo: filters.dateRange?.to
        };
        // Recherche sémantique avec une requête vide (tous les résultats)
        return await semanticSearch('', semanticOptions);
    }
    catch (error) {
        VectorStoreLogger.error('vectorstore.metadata.error', `Erreur lors de la recherche par métadonnées`, error, {
            filters
        });
        throw error;
    }
}
/**
 * Supprime les documents correspondant à un pattern
 */
export async function deleteDocumentsByPattern(pattern) {
    try {
        const store = getVectorStore();
        return await store.deleteDocumentsByPattern(pattern);
    }
    catch (error) {
        VectorStoreLogger.error('vectorstore.delete.pattern.error', `Erreur lors de la suppression avec pattern`, error, {
            pattern
        });
        throw error;
    }
}
/**
 * Initialise le vector store
 */
export async function initialize() {
    try {
        const store = getVectorStore();
        await store.initialize();
        VectorStoreLogger.info('vectorstore.initialize', 'Vector store initialisé');
    }
    catch (error) {
        VectorStoreLogger.error('vectorstore.initialize.error', 'Erreur lors de l\'initialisation du vector store', error);
        throw error;
    }
}
/**
 * Vide le cache des embeddings
 */
export function clearEmbeddingCache() {
    embeddingCache.clear();
    cacheStats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        byModel: {}
    };
    VectorStoreLogger.info('embedding.cache.cleared', 'Cache des embeddings vidé');
}
/**
 * Obtient les statistiques du cache des embeddings
 */
export function getEmbeddingCacheStats() {
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
/**
 * Ferme proprement le vector store
 */
export async function close() {
    try {
        // Nettoyer la file d'attente Ollama
        if (batchTimeout) {
            clearTimeout(batchTimeout);
            batchTimeout = null;
        }
        // Vider le cache
        clearEmbeddingCache();
        VectorStoreLogger.info('vectorstore.close', 'Vector store fermé');
    }
    catch (error) {
        VectorStoreLogger.error('vectorstore.close.error', 'Erreur lors de la fermeture du vector store', error);
    }
}
//# sourceMappingURL=vector-store.js.map