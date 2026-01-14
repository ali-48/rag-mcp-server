// src/rag/vector-store.ts
// Version refactorisée utilisant l'abstraction IVectorStore et VectorStoreFactory
// Remplace le PostgreSQL hardcodé par une configuration dynamique
import { createVectorStore, createVectorStoreForProject } from './vector-store-factory.js';
import { VectorStoreLogger } from './vector-store-interface.js';
// Configuration des embeddings
let embeddingProvider = "fake";
let embeddingModel = "nomic-embed-text";
// Cache pour embeddings (évite de regénérer les mêmes embeddings)
const embeddingCache = new Map();
const CACHE_MAX_SIZE = 1000;
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
 * Configure le fournisseur d'embeddings
 */
export function setEmbeddingProvider(provider, model = "nomic-embed-text") {
    embeddingProvider = provider;
    embeddingModel = model;
    VectorStoreLogger.info('embedding.provider.configured', `Embedding provider configured`, {
        provider,
        model
    });
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
function generateFakeEmbedding(text) {
    const seed = text.length;
    const hash = simpleHash(text);
    return Array(768).fill(0).map((_, i) => {
        const base = Math.sin(hash * 0.01 + i * 0.017) * 0.3;
        const variation = Math.cos(hash * 0.007 + i * 0.023) * 0.2;
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
 * Fonction de hachage pour le cache
 */
function hashText(text) {
    let hash = 0;
    for (let i = 0; i < Math.min(text.length, 1000); i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return `${embeddingModel}:${hash}:${text.length}`;
}
/**
 * Récupère un embedding depuis le cache
 */
function getCachedEmbedding(text) {
    const key = hashText(text);
    return embeddingCache.get(key) || null;
}
/**
 * Met en cache un embedding
 */
function cacheEmbedding(text, embedding) {
    const key = hashText(text);
    embeddingCache.set(key, embedding);
    // Gérer la taille du cache (LRU simple)
    if (embeddingCache.size > CACHE_MAX_SIZE) {
        const firstKey = embeddingCache.keys().next().value;
        if (firstKey) {
            embeddingCache.delete(firstKey);
        }
    }
}
/**
 * Génère un embedding avec Ollama
 */
async function generateOllamaEmbedding(text) {
    // Vérifier le cache d'abord
    const cached = getCachedEmbedding(text);
    if (cached) {
        VectorStoreLogger.debug('embedding.cache.hit', `Using cached embedding`, {
            textPreview: text.substring(0, 50)
        });
        return cached;
    }
    // Si le provider n'est pas Ollama, utiliser les embeddings factices
    if (embeddingProvider !== "ollama") {
        return generateFakeEmbedding(text);
    }
    VectorStoreLogger.debug('embedding.ollama.queueing', `Queueing embedding for Ollama`, {
        model: embeddingModel,
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
                model: embeddingModel,
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
                cacheEmbedding(text, embedding);
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
                    model: embeddingModel,
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
            cacheEmbedding(item.text, data.embedding);
            item.resolve(data.embedding);
        }
        catch (error) {
            VectorStoreLogger.error('embedding.ollama.individual.error', `Failed to get embedding from Ollama for individual request`, error);
            // Fallback sur les embeddings factices
            const fakeEmbedding = generateFakeEmbedding(item.text);
            cacheEmbedding(item.text, fakeEmbedding);
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
    return generateFakeEmbedding(text);
}
/**
 * Génère un embedding selon le fournisseur configuré
 */
async function generateEmbedding(text) {
    let embedding;
    switch (embeddingProvider) {
        case "ollama":
            embedding = await generateOllamaEmbedding(text);
            break;
        case "sentence-transformers":
            embedding = await generateSentenceTransformerEmbedding(text);
            break;
        case "fake":
        default:
            embedding = generateFakeEmbedding(text);
            break;
    }
    // Normaliser l'embedding
    return normalizeL2(embedding);
}
/**
 * Stocke un document avec son embedding
 */
export async function embedAndStore(projectPath, filePath, content, options = {}) {
    const { chunkIndex = 0, totalChunks = 1, contentType = 'other', role = null, fileExtension = null, language = null, linesCount = null, isCompressed = false } = options;
    // Générer l'embedding
    const vector = await generateEmbedding(content);
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
    const queryVector = await generateEmbedding(query);
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
    VectorStoreLogger.info('embedding.cache.cleared', 'Cache des embeddings vidé');
}
/**
 * Obtient les statistiques du cache des embeddings
 */
export function getEmbeddingCacheStats() {
    // Note: Cette implémentation simplifiée ne suit pas les hits/misses
    // Une implémentation complète nécessiterait un compteur
    return {
        totalEntries: embeddingCache.size,
        hitRate: 0,
        hits: 0,
        misses: 0
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