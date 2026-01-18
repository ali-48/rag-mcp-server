// src/rag/vector-store.ts
// Version refactorisée utilisant les nouveaux modules dédiés
// Ce fichier sert maintenant de façade pour la compatibilité ascendante

import { SearchResult } from './types.js';
import {
  // Interface et configuration
  IVectorStore,
  EmbedAndStoreOptions as InterfaceEmbedAndStoreOptions,
  SemanticSearchOptions as InterfaceSemanticSearchOptions,
  VectorStoreConfig,
  VectorStoreLogger,
} from './vector-store-interface.js';

// Import des nouveaux modules
import {
  // Adaptateur principal
  VectorStoreAdapter,
  clearAll as adapterClearAll,
  close as adapterClose,
  deleteDocument as adapterDeleteDocument,
  deleteDocumentsByPattern as adapterDeleteDocumentsByPattern,
  // Fonctions exportées
  embedAndStore as adapterEmbedAndStore,
  getProjectStats as adapterGetProjectStats,
  getStats as adapterGetStats,
  hybridSearch as adapterHybridSearch,
  initialize as adapterInitialize,
  listProjects as adapterListProjects,
  searchByMetadata as adapterSearchByMetadata,
  semanticSearch as adapterSemanticSearch,
  testConnection as adapterTestConnection,
  updateDocument as adapterUpdateDocument,
  clearEmbeddingCache,
  configureVectorStore as configureVectorStoreAdapter,
  generateEmbedding,
  generateEmbeddingForContent,
  getEmbeddingCacheStats,
  getEmbeddingDimensionForModel,
  getEmbeddingModelForContentType,
  setEmbeddingModels,
  setEmbeddingProvider,
} from './vector-store-adapter.js';

// ========== COMPATIBILITÉ ASCENDANTE ==========

// Ré-export des interfaces pour la compatibilité
export interface EmbedAndStoreOptions extends InterfaceEmbedAndStoreOptions { }
export interface SemanticSearchOptions extends InterfaceSemanticSearchOptions { }

// Instance singleton pour la compatibilité
let vectorStoreInstance: IVectorStore | null = null;

/**
 * Obtient l'instance de vector store (singleton)
 * Utilise l'adaptateur avec les nouveaux modules
 */
function getVectorStore(): IVectorStore {
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
export function configureVectorStore(config: VectorStoreConfig): void {
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
export async function embedAndStore(
  projectPath: string,
  filePath: string,
  content: string,
  options: EmbedAndStoreOptions = {}
): Promise<void> {
  return adapterEmbedAndStore(projectPath, filePath, content, options);
}

/**
 * Recherche sémantique
 */
export async function semanticSearch(
  query: string,
  options: SemanticSearchOptions = {}
): Promise<SearchResult[]> {
  return adapterSemanticSearch(query, options);
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
  return adapterGetProjectStats(projectPath);
}

/**
 * Liste tous les projets indexés
 */
export async function listProjects(): Promise<string[]> {
  return adapterListProjects();
}

/**
 * Supprime un document par son ID
 */
export async function deleteDocument(id: string): Promise<boolean> {
  return adapterDeleteDocument(id);
}

/**
 * Vide tous les documents (pour les tests)
 */
export async function clearAll(): Promise<void> {
  return adapterClearAll();
}

/**
 * Obtient les statistiques globales du store
 */
export async function getStats(): Promise<{
  totalDocuments: number;
  totalProjects: number;
  totalSizeBytes: number;
  averageVectorDimension: number;
  lastUpdated: Date | null;
}> {
  return adapterGetStats();
}

/**
 * Teste la connectivité au vector store
 */
export async function testConnection(): Promise<boolean> {
  return adapterTestConnection();
}

/**
 * Met à jour un document existant
 */
export async function updateDocument(
  id: string,
  updates: Partial<{
    content: string;
    embedding: number[];
    metadata: Partial<EmbedAndStoreOptions>;
  }>
): Promise<boolean> {
  return adapterUpdateDocument(id, updates);
}

/**
 * Recherche hybride (sémantique + textuelle)
 */
export async function hybridSearch(
  query: string,
  options: SemanticSearchOptions & {
    semanticWeight?: number;
    textWeight?: number;
    textQuery?: string;
  } = {}
): Promise<SearchResult[]> {
  return adapterHybridSearch(query, options);
}

/**
 * Recherche par métadonnées
 */
export async function searchByMetadata(
  filters: Partial<EmbedAndStoreOptions> & {
    projectPath?: string;
    dateRange?: { from?: Date; to?: Date };
  }
): Promise<SearchResult[]> {
  return adapterSearchByMetadata(filters);
}

/**
 * Supprime les documents correspondant à un pattern
 */
export async function deleteDocumentsByPattern(pattern: string): Promise<number> {
  return adapterDeleteDocumentsByPattern(pattern);
}

/**
 * Initialise le vector store
 */
export async function initialize(): Promise<void> {
  return adapterInitialize();
}

/**
 * Ferme proprement le vector store
 */
export async function close(): Promise<void> {
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
export type { IVectorStore, VectorStoreConfig };

// ========== FONCTIONS DÉPRÉCIÉES (MAINTENUES POUR COMPATIBILITÉ) ==========

/**
 * @deprecated Utilisez getEmbeddingModelForContentType à la place
 */
export function getModelForContentType(contentType: string, language?: string): string {
  return getEmbeddingModelForContentType(contentType, language);
}

/**
 * @deprecated Utilisez getEmbeddingDimensionForModel à la place
 */
export function getDimensionForModel(model: string): number {
  return getEmbeddingDimensionForModel(model);
}

/**
 * @deprecated Utilisez generateEmbedding à la place
 */
export async function generateEmbeddingWithModel(text: string, model: string): Promise<number[]> {
  const { getDefaultEmbeddingService } = require('./embedding-service.js');
  const service = getDefaultEmbeddingService();
  return await service.generateWithModel(text, model);
}

/**
 * @deprecated Utilisez generateEmbeddingForContent à la place
 */
export async function generateEmbeddingForContentType(
  text: string,
  contentType: string = 'other',
  language?: string
): Promise<number[]> {
  return generateEmbeddingForContent(text, contentType, language);
}
