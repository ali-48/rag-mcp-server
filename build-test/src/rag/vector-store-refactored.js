// src/rag/vector-store-refactored.ts
// Version SQLite complète - Remplacement de PostgreSQL
import { logger } from '../core/logger.js';
import { VectorStoreSQLite } from './vector-store-sqlite.js';
// Configuration du provider
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

// ========== SENTENCE TRANSFORMERS CONFIGURATION ==========

// Mapping des modèles vers les modèles Sentence Transformers appropriés
const sentenceTransformerModels = {
  'nomic-embed-code': 'Xenova/all-MiniLM-L6-v2',        // 384 dimensions, bon pour le code
  'nomic-embed-text': 'Xenova/all-mpnet-base-v2',       // 768 dimensions, excellent pour le texte
  'bge-small': 'Xenova/bge-small-en-v1.5',              // 384 dimensions, optimisé pour la recherche
  'qwen3-embedding:8b': 'Xenova/all-MiniLM-L6-v2'       // 384 dimensions, fallback général
};

// Dimensions des modèles Sentence Transformers
const sentenceTransformerDimensions = {
  'Xenova/all-MiniLM-L6-v2': 384,
  'Xenova/all-mpnet-base-v2': 768,
  'Xenova/bge-small-en-v1.5': 384
};

// Cache des pipelines Sentence Transformers chargés
const loadedSentenceTransformerPipelines = new Map();

// Configuration du timeout pour Sentence Transformers (en millisecondes)
const SENTENCE_TRANSFORMERS_TIMEOUT = 30000; // 30 secondes
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
// Instance du backend SQLite
let vectorStore = null;
/**
 * Obtient l'instance du VectorStoreSQLite (singleton)
 */
function getVectorStore() {
  if (!vectorStore) {
    vectorStore = new VectorStoreSQLite();
    logger.info('rag.vectorstore.sqlite.init', 'VectorStoreSQLite initialisé');
  }
  return vectorStore;
}
// ========== FONCTIONS DE CONFIGURATION ==========

// Liste des providers d'embeddings supportés
const SUPPORTED_EMBEDDING_PROVIDERS = ['fake', 'ollama', 'sentence-transformers'];

/**
 * Vérifie si un provider est supporté
 */
export function isEmbeddingProviderSupported(provider) {
  return SUPPORTED_EMBEDDING_PROVIDERS.includes(provider);
}

/**
 * Liste tous les providers d'embeddings supportés
 */
export function listSupportedEmbeddingProviders() {
  return [...SUPPORTED_EMBEDDING_PROVIDERS];
}

/**
 * Configure le fournisseur d'embeddings avec support multi-modèles
 */
export function setEmbeddingProvider(provider, defaultModel = 'qwen3-embedding:8b', modelConfig) {
  // Valider le provider
  if (!isEmbeddingProviderSupported(provider)) {
    logger.warn('rag.embedding.provider.unsupported',
      `Unsupported embedding provider: ${provider}. Using 'fake' as fallback.`, {
      requestedProvider: provider,
      supportedProviders: SUPPORTED_EMBEDDING_PROVIDERS
    });
    provider = 'fake';
  }

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

  // Configuration spécifique pour Sentence Transformers
  if (provider === 'sentence-transformers') {
    logger.info('rag.embedding.provider.sentence-transformers.configured',
      'Sentence Transformers provider configured with optimized models', {
      provider,
      models: embeddingModels,
      sentenceTransformerMapping: sentenceTransformerModels,
      note: 'Models will be automatically mapped to appropriate Sentence Transformers models'
    });
  } else {
    logger.info('rag.embedding.provider.configured', `Embedding provider configured: ${provider}`, {
      provider,
      models: embeddingModels
    });
  }
}
/**
 * Configure uniquement les modèles (sans changer le provider)
 */
export function setEmbeddingModels(models) {
  embeddingModels = { ...embeddingModels, ...models };
  logger.info('rag.embedding.models.updated', `Embedding models updated`, {
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
// ========== GESTION DU CACHE ==========
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
  logger.info('rag.embedding.cache.cleared', 'Embedding cache cleared');
}
/**
 * Obtient les statistiques du cache
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
// ========== GÉNÉRATION D'EMBEDDINGS ==========
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
 * Génère un embedding avec routage automatique par type de contenu
 */
export async function generateEmbeddingForContent(text, contentType = 'other', language) {
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
async function generateEmbeddingWithModel(text, model) {
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
function generateFakeEmbedding(text, model) {
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
// ========== OLLAMA EMBEDDINGS ==========
/**
 * Génère un embedding avec Ollama
 */
async function generateOllamaEmbedding(text, model) {
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
  }
  catch (error) {
    logger.error('rag.embedding.ollama.failed', `Failed to get embedding from Ollama`, {
      model,
      error: error instanceof Error ? error.message : String(error)
    });
    // Fallback sur les embeddings factices
    return generateFakeEmbedding(text, model);
  }
}
// ========== SENTENCE TRANSFORMERS ==========

/**
 * Charge un pipeline Sentence Transformers de manière lazy avec cache
 */
async function loadSentenceTransformerPipeline(modelName) {
  // Vérifier le cache
  if (loadedSentenceTransformerPipelines.has(modelName)) {
    logger.debug('rag.embedding.sentence-transformers.cache.hit', `Using cached pipeline: ${modelName}`);
    return loadedSentenceTransformerPipelines.get(modelName);
  }

  logger.debug('rag.embedding.sentence-transformers.loading', `Loading Sentence Transformers model: ${modelName}`);

  try {
    // Importer dynamiquement @xenova/transformers
    const { pipeline } = await import('@xenova/transformers');

    // Créer un timeout pour éviter les blocages
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout loading model: ${modelName}`)), SENTENCE_TRANSFORMERS_TIMEOUT);
    });

    // Charger le pipeline avec options optimisées
    const loadPromise = pipeline('feature-extraction', modelName, {
      quantized: true, // Utiliser les modèles quantifiés pour réduire la taille
      progress_callback: (progress) => {
        if (progress.status === 'downloading') {
          logger.debug('rag.embedding.sentence-transformers.progress',
            `Downloading ${modelName}: ${Math.round(progress.loaded * 100)}%`);
        }
      }
    });

    // Exécuter avec timeout
    const pipelineInstance = await Promise.race([loadPromise, timeoutPromise]);

    // Mettre en cache
    loadedSentenceTransformerPipelines.set(modelName, pipelineInstance);

    logger.info('rag.embedding.sentence-transformers.loaded', `Model loaded successfully: ${modelName}`, {
      modelName,
      cacheSize: loadedSentenceTransformerPipelines.size
    });

    return pipelineInstance;

  } catch (error) {
    logger.error('rag.embedding.sentence-transformers.load.failed',
      `Failed to load Sentence Transformers model: ${modelName}`, {
      modelName,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    // Propager l'erreur pour que la fonction appelante puisse fallback
    throw error;
  }
}

/**
 * Nettoie le cache des pipelines Sentence Transformers
 */
export function clearSentenceTransformerCache() {
  const previousSize = loadedSentenceTransformerPipelines.size;
  loadedSentenceTransformerPipelines.clear();

  logger.info('rag.embedding.sentence-transformers.cache.cleared',
    `Sentence Transformers cache cleared (${previousSize} pipelines removed)`);

  return previousSize;
}

/**
 * Obtient les statistiques du cache des pipelines
 */
export function getSentenceTransformerCacheStats() {
  return {
    totalPipelines: loadedSentenceTransformerPipelines.size,
    pipelineNames: Array.from(loadedSentenceTransformerPipelines.keys()),
    cacheEnabled: true
  };
}

async function generateSentenceTransformerEmbedding(text, model) {
  logger.debug('rag.embedding.sentence-transformers.generating', `Generating Sentence Transformers embedding (${model})`, {
    model,
    textPreview: text.substring(0, 50)
  });

  try {
    // 1. Mapper le modèle vers un modèle Sentence Transformers
    const stModel = sentenceTransformerModels[model] || 'Xenova/all-MiniLM-L6-v2';

    // 2. Vérifier si le provider est bien sentence-transformers
    if (embeddingProvider !== "sentence-transformers") {
      logger.warn('rag.embedding.sentence-transformers.wrong-provider',
        `Sentence Transformers called but provider is ${embeddingProvider}, using fake embedding as fallback`, {
        requestedModel: model,
        stModel,
        currentProvider: embeddingProvider
      });
      return generateFakeEmbedding(text, model);
    }

    // 3. Charger le pipeline (lazy loading avec cache)
    const extractor = await loadSentenceTransformerPipeline(stModel);

    // 4. Créer un timeout pour la génération d'embedding
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout generating embedding with ${stModel}`)), SENTENCE_TRANSFORMERS_TIMEOUT);
    });

    // 5. Générer l'embedding avec options optimisées
    const generatePromise = extractor(text, {
      pooling: 'mean',      // Pooling pour obtenir un vecteur unique
      normalize: false,     // On normalisera manuellement après
      truncation: true,     // Truncation pour les textes longs
      max_length: 512       // Longueur maximale pour les modèles
    });

    // 6. Exécuter avec timeout
    const result = await Promise.race([generatePromise, timeoutPromise]);

    // 7. Convertir le tensor en tableau JavaScript
    let embedding;
    if (result && result.data) {
      // Cas standard : résultat avec .data
      embedding = Array.from(result.data);
    } else if (Array.isArray(result)) {
      // Cas où le résultat est déjà un tableau
      embedding = result;
    } else {
      throw new Error(`Invalid embedding result format from model ${stModel}`);
    }

    // 8. Normaliser le vecteur (norme L2)
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      embedding = embedding.map(val => val / norm);
    }

    // 9. Vérifier les dimensions
    const expectedDimension = sentenceTransformerDimensions[stModel] || 384;
    if (embedding.length !== expectedDimension) {
      logger.warn('rag.embedding.sentence-transformers.dimension-mismatch',
        `Embedding dimension mismatch: expected ${expectedDimension}, got ${embedding.length}`, {
        stModel,
        expectedDimension,
        actualDimension: embedding.length
      });
    }

    // 10. Logging de succès
    logger.debug('rag.embedding.sentence-transformers.generated',
      `Sentence Transformers embedding generated successfully (${model} → ${stModel})`, {
      model,
      stModel,
      dimensions: embedding.length,
      textPreview: text.substring(0, 50),
      embeddingPreview: embedding.slice(0, 3) // Premières valeurs pour debug
    });

    return embedding;

  } catch (error) {
    logger.error('rag.embedding.sentence-transformers.failed',
      `Failed to generate Sentence Transformers embedding`, {
      model,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      textPreview: text.substring(0, 50)
    });

    // Fallback sur les embeddings factices
    logger.info('rag.embedding.sentence-transformers.fallback',
      `Falling back to fake embedding for model ${model}`);

    return generateFakeEmbedding(text, model);
  }
}
/**
 * Stocke un document avec son embedding
 */
export async function embedAndStore(projectPath, filePath, content, options = {}) {
  const { chunkIndex = 0, totalChunks = 1, contentType = 'other', role = null, fileExtension = null, language = null, linesCount = null, isCompressed = false } = options;
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
  }
  catch (error) {
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
export async function semanticSearch(query, options = {}) {
  const { projectFilter, limit = 10, threshold = 0.3, contentTypeFilter, roleFilter, languageFilter, minFileSizeBytes, maxFileSizeBytes, minLinesCount, maxLinesCount, dateFrom, dateTo } = options;
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
  }
  catch (error) {
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
export async function getProjectStats(projectPath) {
  try {
    const store = getVectorStore();
    return await store.getProjectStats(projectPath);
  }
  catch (error) {
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
export async function listProjects() {
  try {
    const store = getVectorStore();
    return await store.listProjects();
  }
  catch (error) {
    logger.error('rag.vectorstore.list.error', 'Erreur lors du listing des projets', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
//# sourceMappingURL=vector-store-refactored.js.map
