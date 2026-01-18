// src/rag/vector-store.ts
// Version refactorisée utilisant les nouveaux modules dédiés
// Ce fichier sert maintenant de façade pour la compatibilité ascendante
import { VectorStoreLogger, } from './vector-store-interface.js';
// Import des nouveaux modules
import { 
// Adaptateur principal
VectorStoreAdapter, clearAll as adapterClearAll, close as adapterClose, deleteDocument as adapterDeleteDocument, deleteDocumentsByPattern as adapterDeleteDocumentsByPattern, 
// Fonctions exportées
embedAndStore as adapterEmbedAndStore, getProjectStats as adapterGetProjectStats, getStats as adapterGetStats, hybridSearch as adapterHybridSearch, initialize as adapterInitialize, listProjects as adapterListProjects, searchByMetadata as adapterSearchByMetadata, semanticSearch as adapterSemanticSearch, testConnection as adapterTestConnection, updateDocument as adapterUpdateDocument, clearEmbeddingCache, configureVectorStore as configureVectorStoreAdapter, generateEmbedding, generateEmbeddingForContent, getEmbeddingCacheStats, getEmbeddingDimensionForModel, getEmbeddingModelForContentType, setEmbeddingModels, setEmbeddingProvider, } from './vector-store-adapter.js';
// Instance singleton pour la compatibilité
let vectorStoreInstance = null;
/**
 * Obtient l'instance de vector store (singleton)
 * Utilise l'adaptateur avec les nouveaux modules
 */
function getVectorStore() {
    if (!vectorStoreInstance) {
        // Créer l'adaptateur via la factory
        const { createVectorStoreForProject } = require('./vector-store-factory.js');
        const underlyingStore = createVectorStoreForProject(process.cwd());
        // Créer l'adaptateur avec injection de dépendances
        const { getDefaultEmbeddingService } = require('./embedding-service.js');
        vectorStoreInstance = new VectorStoreAdapter(underlyingStore, getDefaultEmbeddingService());
        VectorStoreLogger.info('vectorstore.init', 'Vector store initialisé (via adaptateur)', {
            type: 'adapter',
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
    configureVectorStoreAdapter(config);
    VectorStoreLogger.info('vectorstore.configure', 'Vector store configuré (via adaptateur)', {
        type: config.type
    });
}
// Ré-export des fonctions de configuration
export { setEmbeddingModels, setEmbeddingProvider };
// Ré-export des fonctions utilitaires
export { getEmbeddingDimensionForModel, getEmbeddingModelForContentType };
// Ré-export des fonctions de génération d'embeddings
export { generateEmbedding, generateEmbeddingForContent };
// ========== FONCTIONS PRINCIPALES (COMPATIBILITÉ) ==========
/**
 * Stocke un document avec son embedding
 */
export async function embedAndStore(projectPath, filePath, content, options = {}) {
    return adapterEmbedAndStore(projectPath, filePath, content, options);
}
/**
 * Recherche sémantique
 */
export async function semanticSearch(query, options = {}) {
    return adapterSemanticSearch(query, options);
}
/**
 * Obtient les statistiques d'un projet
 */
export async function getProjectStats(projectPath) {
    return adapterGetProjectStats(projectPath);
}
/**
 * Liste tous les projets indexés
 */
export async function listProjects() {
    return adapterListProjects();
}
/**
 * Supprime un document par son ID
 */
export async function deleteDocument(id) {
    return adapterDeleteDocument(id);
}
/**
 * Vide tous les documents (pour les tests)
 */
export async function clearAll() {
    return adapterClearAll();
}
/**
 * Obtient les statistiques globales du store
 */
export async function getStats() {
    return adapterGetStats();
}
/**
 * Teste la connectivité au vector store
 */
export async function testConnection() {
    return adapterTestConnection();
}
/**
 * Met à jour un document existant
 */
export async function updateDocument(id, updates) {
    return adapterUpdateDocument(id, updates);
}
/**
 * Recherche hybride (sémantique + textuelle)
 */
export async function hybridSearch(query, options = {}) {
    return adapterHybridSearch(query, options);
}
/**
 * Recherche par métadonnées
 */
export async function searchByMetadata(filters) {
    return adapterSearchByMetadata(filters);
}
/**
 * Supprime les documents correspondant à un pattern
 */
export async function deleteDocumentsByPattern(pattern) {
    return adapterDeleteDocumentsByPattern(pattern);
}
/**
 * Initialise le vector store
 */
export async function initialize() {
    return adapterInitialize();
}
/**
 * Ferme proprement le vector store
 */
export async function close() {
    return adapterClose();
}
/**
 * Vide le cache des embeddings
 */
export { clearEmbeddingCache };
/**
 * Obtient les statistiques du cache des embeddings
 */
export { getEmbeddingCacheStats };
// ========== EXPORT DES TYPES POUR LA COMPATIBILITÉ ==========
// Export des types pour les tests et l'utilisation externe
export { VectorStoreLogger };
// ========== FONCTIONS DÉPRÉCIÉES (MAINTENUES POUR COMPATIBILITÉ) ==========
/**
 * @deprecated Utilisez getEmbeddingModelForContentType à la place
 */
export function getModelForContentType(contentType, language) {
    return getEmbeddingModelForContentType(contentType, language);
}
/**
 * @deprecated Utilisez getEmbeddingDimensionForModel à la place
 */
export function getDimensionForModel(model) {
    return getEmbeddingDimensionForModel(model);
}
/**
 * @deprecated Utilisez generateEmbedding à la place
 */
export async function generateEmbeddingWithModel(text, model) {
    const { getDefaultEmbeddingService } = require('./embedding-service.js');
    const service = getDefaultEmbeddingService();
    return await service.generateWithModel(text, model);
}
/**
 * @deprecated Utilisez generateEmbeddingForContent à la place
 */
export async function generateEmbeddingForContentType(text, contentType = 'other', language) {
    return generateEmbeddingForContent(text, contentType, language);
}
//# sourceMappingURL=vector-store.js.map