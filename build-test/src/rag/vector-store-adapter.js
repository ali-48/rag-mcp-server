// src/rag/vector-store-adapter.ts
// Adaptateur pour l'interface IVectorStore avec injection de dépendances
// Responsabilité unique : Adapter pattern entre les nouveaux modules et l'interface existante
import { configureDefaultEmbeddingService, generateEmbedding, generateEmbeddingForContent, getDefaultEmbeddingService, setDefaultEmbeddingModels, } from "./embedding-service.js";
import { createVectorStore, createVectorStoreForProject } from "./vector-store-factory.js";
import { VectorStoreLogger, } from "./vector-store-interface.js";
/**
 * Convertit un SearchResult de types.ts en SearchResult de vector-store-interface.ts
 */
function convertSearchResult(result) {
    return {
        id: result.id,
        filePath: result.filePath,
        content: result.content,
        score: result.score,
        metadata: {
            projectPath: result.metadata.projectPath,
            fileSize: result.metadata.fileSize,
            originalSize: result.metadata.originalSize || result.metadata.fileSize,
            lines: result.metadata.lines,
            contentType: result.metadata.contentType || null,
            role: result.metadata.role || null,
            fileExtension: result.metadata.fileExtension || null,
            language: result.metadata.language || null,
            linesCount: result.metadata.linesCount || null,
            isCompressed: result.metadata.isCompressed || false,
            compressionRatio: result.metadata.compressionRatio || null,
            createdAt: result.metadata.createdAt || null,
            updatedAt: result.metadata.updatedAt || null,
        },
    };
}
/**
 * Adaptateur pour IVectorStore avec injection de dépendances
 */
export class VectorStoreAdapter {
    vectorStore;
    embeddingService;
    /**
     * Crée un adaptateur avec injection de dépendances
     */
    constructor(vectorStore, embeddingService = getDefaultEmbeddingService()) {
        this.vectorStore = vectorStore;
        this.embeddingService = embeddingService;
        VectorStoreLogger.info("vectorstore.adapter.init", "Vector store adapter initialized", {
            hasCustomEmbeddingService: embeddingService !== getDefaultEmbeddingService(),
        });
    }
    /**
     * Stocke un document avec son embedding
     */
    async embedAndStore(projectPath, filePath, content, embedding, options = {}) {
        const { chunkIndex = 0, totalChunks = 1, contentType = "other", role = null, fileExtension = null, language = null, linesCount = null, isCompressed = false, } = options;
        try {
            await this.vectorStore.embedAndStore(projectPath, filePath, content, embedding, {
                chunkIndex,
                totalChunks,
                contentType,
                role: role || undefined,
                fileExtension: fileExtension || undefined,
                language: language || undefined,
                linesCount: linesCount || undefined,
                isCompressed,
            });
            VectorStoreLogger.info("vectorstore.store", "Document stocké", {
                projectPath,
                filePath,
                contentType,
                chunkIndex,
                totalChunks,
            });
        }
        catch (error) {
            VectorStoreLogger.error("vectorstore.store.error", "Erreur lors du stockage du document", error, {
                projectPath,
                filePath,
            });
            throw error;
        }
    }
    /**
     * Recherche sémantique par similarité cosinus
     */
    async semanticSearch(queryEmbedding, options = {}) {
        const { projectFilter, limit = 10, threshold = 0.3, dynamicThreshold = false, contentTypeFilter, roleFilter, languageFilter, minFileSizeBytes, maxFileSizeBytes, minLinesCount, maxLinesCount, dateFrom, dateTo, } = options;
        try {
            const results = await this.vectorStore.semanticSearch(queryEmbedding, {
                projectFilter,
                limit,
                threshold,
                dynamicThreshold,
                contentTypeFilter,
                roleFilter,
                languageFilter,
                minFileSizeBytes,
                maxFileSizeBytes,
                minLinesCount,
                maxLinesCount,
                dateFrom,
                dateTo,
            });
            // Convertir les résultats au format attendu
            return results.map(convertSearchResult);
        }
        catch (error) {
            VectorStoreLogger.error("vectorstore.search.error", "Erreur lors de la recherche sémantique", error);
            throw error;
        }
    }
    /**
     * Supprime un document par son ID
     */
    async deleteDocument(id) {
        try {
            const result = await this.vectorStore.deleteDocument(id);
            return result;
        }
        catch (error) {
            VectorStoreLogger.error("vectorstore.delete.error", "Erreur lors de la suppression du document", error, {
                id,
            });
            throw error;
        }
    }
    /**
     * Supprime les documents correspondant à un pattern (LIKE)
     */
    async deleteDocumentsByPattern(pattern) {
        try {
            const result = await this.vectorStore.deleteDocumentsByPattern(pattern);
            return result;
        }
        catch (error) {
            VectorStoreLogger.error("vectorstore.delete.pattern.error", "Erreur lors de la suppression avec pattern", error, {
                pattern,
            });
            throw error;
        }
    }
    /**
     * Obtient les statistiques d'un projet spécifique
     */
    async getProjectStats(projectPath) {
        try {
            return await this.vectorStore.getProjectStats(projectPath);
        }
        catch (error) {
            VectorStoreLogger.error("vectorstore.stats.error", "Erreur lors de la récupération des stats", error, {
                projectPath,
            });
            throw error;
        }
    }
    /**
     * Liste tous les projets indexés
     */
    async listProjects() {
        try {
            return await this.vectorStore.listProjects();
        }
        catch (error) {
            VectorStoreLogger.error("vectorstore.list.error", "Erreur lors du listing des projets", error);
            throw error;
        }
    }
    /**
     * Obtient les statistiques globales du store
     */
    async getStats() {
        try {
            return await this.vectorStore.getStats();
        }
        catch (error) {
            VectorStoreLogger.error("vectorstore.stats.global.error", "Erreur lors de la récupération des statistiques globales", error);
            throw error;
        }
    }
    /**
     * Vide complètement le store (pour les tests)
     */
    async clearAll() {
        try {
            await this.vectorStore.clearAll();
            VectorStoreLogger.info("vectorstore.clear", "Tous les documents ont été supprimés");
        }
        catch (error) {
            VectorStoreLogger.error("vectorstore.clear.error", "Erreur lors du vidage des documents", error);
            throw error;
        }
    }
    /**
     * Initialise les tables/schémas si nécessaire
     */
    async initialize() {
        try {
            await this.vectorStore.initialize();
            VectorStoreLogger.info("vectorstore.initialize", "Vector store initialisé");
        }
        catch (error) {
            VectorStoreLogger.error("vectorstore.initialize.error", "Erreur lors de l'initialisation du vector store", error);
            throw error;
        }
    }
    /**
     * Vérifie la connectivité au backend
     */
    async testConnection() {
        try {
            return await this.vectorStore.testConnection();
        }
        catch (error) {
            VectorStoreLogger.error("vectorstore.test.error", "Erreur lors du test de connexion", error);
            return false;
        }
    }
    /**
     * Met à jour un document existant
     */
    async updateDocument(id, updates) {
        try {
            return await this.vectorStore.updateDocument(id, updates);
        }
        catch (error) {
            VectorStoreLogger.error("vectorstore.update.error", "Erreur lors de la mise à jour du document", error, {
                id,
            });
            throw error;
        }
    }
    /**
     * Recherche hybride (sémantique + textuelle)
     */
    async hybridSearch(queryEmbedding, textQuery, options = {}) {
        const { semanticWeight = 0.7, textWeight = 0.3, ...semanticOptions } = options;
        try {
            // Si le store supporte la recherche hybride, l'utiliser
            if (this.vectorStore.hybridSearch) {
                const results = await this.vectorStore.hybridSearch(queryEmbedding, textQuery, {
                    ...semanticOptions,
                    semanticWeight,
                    textWeight,
                });
                return results.map(convertSearchResult);
            }
            // Sinon, fallback sur la recherche sémantique
            VectorStoreLogger.warn("vectorstore.hybrid.fallback", "Recherche hybride non supportée, fallback sur recherche sémantique");
            return await this.semanticSearch(queryEmbedding, semanticOptions);
        }
        catch (error) {
            VectorStoreLogger.error("vectorstore.hybrid.error", "Erreur lors de la recherche hybride", error);
            throw error;
        }
    }
    /**
     * Recherche par métadonnées
     */
    async searchByMetadata(filters) {
        try {
            // Si le store supporte la recherche par métadonnées, l'utiliser
            if (this.vectorStore.searchByMetadata) {
                const results = await this.vectorStore.searchByMetadata(filters);
                return results.map(convertSearchResult);
            }
            // Sinon, fallback sur la recherche sémantique avec filtres
            VectorStoreLogger.warn("vectorstore.metadata.fallback", "Recherche par métadonnées non supportée, fallback sur recherche sémantique");
            // Convertir les filtres en options de recherche sémantique
            const semanticOptions = {
                projectFilter: filters.projectPath,
                contentTypeFilter: filters.contentType ? [filters.contentType] : undefined,
                roleFilter: filters.role ? [filters.role] : undefined,
                languageFilter: filters.language ? [filters.language] : undefined,
                dateFrom: filters.dateRange?.from,
                dateTo: filters.dateRange?.to,
            };
            // Recherche sémantique avec une requête vide (tous les résultats)
            return await this.semanticSearch([], semanticOptions);
        }
        catch (error) {
            VectorStoreLogger.error("vectorstore.metadata.error", "Erreur lors de la recherche par métadonnées", error, {
                filters,
            });
            throw error;
        }
    }
    /**
     * Obtient l'instance de vector store sous-jacente
     */
    getUnderlyingVectorStore() {
        return this.vectorStore;
    }
    /**
     * Obtient l'instance du service d'embeddings
     */
    getEmbeddingService() {
        return this.embeddingService;
    }
    /**
     * Met à jour le service d'embeddings
     */
    setEmbeddingService(service) {
        this.embeddingService = service;
        VectorStoreLogger.info("vectorstore.adapter.embedding-service.updated", "Embedding service updated in adapter");
    }
}
// ========== FONCTIONS D'UTILITÉ POUR LA COMPATIBILITÉ ==========
/**
 * Instance singleton de l'adaptateur
 */
let adapterInstance = null;
/**
 * Obtient l'instance de vector store (singleton)
 */
function getVectorStore() {
    if (!adapterInstance) {
        // Créer le vector store basé sur la configuration du projet
        const vectorStore = createVectorStoreForProject(process.cwd());
        adapterInstance = new VectorStoreAdapter(vectorStore);
        VectorStoreLogger.info("vectorstore.init", "Vector store initialisé", {
            type: "dynamic",
            projectPath: process.cwd(),
        });
    }
    return adapterInstance;
}
/**
 * Configure explicitement le vector store avec une configuration spécifique
 */
export function configureVectorStore(config) {
    const vectorStore = createVectorStore(config);
    adapterInstance = new VectorStoreAdapter(vectorStore);
    VectorStoreLogger.info("vectorstore.configure", "Vector store configuré", {
        type: config.type,
    });
}
/**
 * Configure le fournisseur d'embeddings avec support multi-modèles
 */
export function setEmbeddingProvider(provider, defaultModel = "qwen3-embedding:8b", modelConfig) {
    configureDefaultEmbeddingService(provider, defaultModel, modelConfig);
    VectorStoreLogger.info("embedding.provider.configured", "Embedding provider configured", {
        provider,
        defaultModel,
    });
}
/**
 * Configure uniquement les modèles (sans changer le provider)
 */
export function setEmbeddingModels(models) {
    setDefaultEmbeddingModels(models);
    VectorStoreLogger.info("embedding.models.updated", "Embedding models updated", {
        models,
    });
}
/**
 * Détermine le modèle approprié pour un type de contenu
 */
export { getEmbeddingModelForContentType } from "./embedding-service.js";
/**
 * Obtient la dimension attendue pour un modèle
 */
export { getEmbeddingDimensionForModel } from "./embedding-service.js";
/**
 * Génère un embedding avec routage automatique par type de contenu
 */
export { generateEmbeddingForContent } from "./embedding-service.js";
/**
 * Génère un embedding selon le fournisseur configuré (compatibilité)
 */
export { generateEmbedding } from "./embedding-service.js";
/**
 * Stocke un document avec son embedding (fonction exportée)
 */
export async function embedAndStore(projectPath, filePath, content, options = {}) {
    const { contentType = "other", language, } = options;
    // Générer l'embedding avec routage automatique par type de contenu
    const vector = await generateEmbeddingForContent(content, contentType, language || undefined);
    const store = getVectorStore();
    await store.embedAndStore(projectPath, filePath, content, vector, options);
}
/**
 * Recherche sémantique (fonction exportée)
 */
export async function semanticSearch(query, options = {}) {
    // Générer l'embedding pour la requête
    const queryVector = await generateEmbeddingForContent(query, "other");
    const store = getVectorStore();
    return await store.semanticSearch(queryVector, options);
}
/**
 * Obtient les statistiques d'un projet (fonction exportée)
 */
export async function getProjectStats(projectPath) {
    const store = getVectorStore();
    return await store.getProjectStats(projectPath);
}
/**
 * Liste tous les projets indexés (fonction exportée)
 */
export async function listProjects() {
    const store = getVectorStore();
    return await store.listProjects();
}
/**
 * Supprime un document par son ID (fonction exportée)
 */
export async function deleteDocument(id) {
    const store = getVectorStore();
    return await store.deleteDocument(id);
}
/**
 * Vide tous les documents (pour les tests) (fonction exportée)
 */
export async function clearAll() {
    const store = getVectorStore();
    await store.clearAll();
}
/**
 * Obtient les statistiques globales du store (fonction exportée)
 */
export async function getStats() {
    const store = getVectorStore();
    return await store.getStats();
}
/**
 * Teste la connectivité au vector store (fonction exportée)
 */
export async function testConnection() {
    const store = getVectorStore();
    return await store.testConnection();
}
/**
 * Met à jour un document existant (fonction exportée)
 */
export async function updateDocument(id, updates) {
    const store = getVectorStore();
    return await store.updateDocument(id, updates);
}
/**
 * Recherche hybride (sémantique + textuelle) (fonction exportée)
 */
export async function hybridSearch(query, options = {}) {
    const { semanticWeight = 0.7, textWeight = 0.3, textQuery, ...semanticOptions } = options;
    const store = getVectorStore();
    const queryVector = await generateEmbedding(query);
    return await store.hybridSearch(queryVector, textQuery || query, {
        ...semanticOptions,
        semanticWeight,
        textWeight,
    });
}
/**
 * Recherche par métadonnées (fonction exportée)
 */
export async function searchByMetadata(filters) {
    const store = getVectorStore();
    return await store.searchByMetadata(filters);
}
/**
 * Supprime les documents correspondant à un pattern (fonction exportée)
 */
export async function deleteDocumentsByPattern(pattern) {
    const store = getVectorStore();
    return await store.deleteDocumentsByPattern(pattern);
}
/**
 * Initialise le vector store (fonction exportée)
 */
export async function initialize() {
    const store = getVectorStore();
    await store.initialize();
}
/**
 * Ferme proprement le vector store (fonction exportée)
 */
export async function close() {
    // Nettoyer les ressources des services
    const { cleanupDefaultOllamaService } = await import("./ollama-service.js");
    cleanupDefaultOllamaService();
    VectorStoreLogger.info("vectorstore.close", "Vector store fermé");
}
/**
 * Vide le cache des embeddings (fonction exportée)
 */
export function clearEmbeddingCache() {
    const { clearDefaultEmbeddingCache } = require("./embedding-cache.js");
    clearDefaultEmbeddingCache();
}
/**
 * Obtient les statistiques du cache des embeddings (fonction exportée)
 */
export function getEmbeddingCacheStats() {
    const { getDefaultEmbeddingCacheStats } = require("./embedding-cache.js");
    return getDefaultEmbeddingCacheStats();
}
//# sourceMappingURL=vector-store-adapter.js.map