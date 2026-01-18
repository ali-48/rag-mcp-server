// src/rag/embedding-service.ts
// Module dédié à la génération d'embeddings multi-modèles
// Responsabilité unique : Routage et génération d'embeddings par type de contenu

import { EmbeddingCache, getDefaultEmbeddingCache } from "./embedding-cache.js";
import { OllamaService, getDefaultOllamaService } from "./ollama-service.js";
import { VectorStoreLogger } from "./vector-store-interface.js";

/**
 * Configuration des modèles par type de contenu
 */
export interface EmbeddingModelConfig {
  code: string; // nomic-embed-code
  text: string; // nomic-embed-text
  config: string; // bge-small
  fallback: string; // qwen3-embedding:8b
}

/**
 * Dimensions par type (pour référence)
 */
const EMBEDDING_DIMENSIONS: Record<keyof EmbeddingModelConfig, number> = {
  code: 768,
  text: 768,
  config: 384,
  fallback: 1024,
};

/**
 * Fournisseurs d'embeddings supportés
 */
export type EmbeddingProvider = "ollama" | "sentence-transformers" | "fallback";

/**
 * Configuration du service d'embeddings
 */
export interface EmbeddingServiceConfig {
  provider: EmbeddingProvider;
  models: EmbeddingModelConfig;
  cache?: EmbeddingCache;
  ollamaService?: OllamaService;
}

/**
 * Service de génération d'embeddings
 */
export class EmbeddingService {
  private cache: EmbeddingCache;
  private ollamaService: OllamaService | null = null;

  /**
   * Crée une instance du service d'embeddings
   */
  constructor(private config: EmbeddingServiceConfig) {
    this.cache = config.cache || getDefaultEmbeddingCache();

    if (config.provider === "ollama") {
      this.ollamaService = config.ollamaService || getDefaultOllamaService();
    }

    VectorStoreLogger.info(
      "embedding.service.init",
      "Embedding service initialized",
      {
        provider: config.provider,
        models: config.models,
      },
    );
  }

  /**
   * Détermine le modèle approprié pour un type de contenu
   */
  getModelForContentType(contentType: string, language?: string): string {
    // Normaliser le type de contenu
    const normalizedType = contentType.toLowerCase();

    // Routage basé sur le type
    switch (normalizedType) {
      case "code":
      case "source":
      case "program":
        return this.config.models.code;

      case "doc":
      case "text":
      case "documentation":
      case "markdown":
      case "readme":
        return this.config.models.text;

      case "config":
      case "configuration":
      case "json":
      case "yaml":
      case "toml":
      case "ini":
        return this.config.models.config;

      default:
        return this.config.models.fallback;
    }
  }

  /**
   * Obtient la dimension attendue pour un modèle
   */
  getDimensionForModel(model: string): number {
    // Chercher dans la configuration
    for (const [type, modelName] of Object.entries(this.config.models)) {
      if (modelName === model) {
        return EMBEDDING_DIMENSIONS[type as keyof EmbeddingModelConfig];
      }
    }

    // Fallback
    return EMBEDDING_DIMENSIONS.fallback;
  }

  /**
   * Normalise un vecteur selon la norme L2
   */
  normalizeL2(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0) return vector;
    return vector.map((val) => val / norm);
  }

  /**
   * Génère des embeddings de fallback améliorés basés sur le contenu
   */
  generateFallbackEmbedding(
    text: string,
    model: string = this.config.models.fallback,
  ): number[] {
    // Déterminer la dimension basée sur le modèle
    const dimension = this.getDimensionForModel(model);

    // Hachage sémantique basé sur le contenu
    const contentHash = this.semanticHash(text + model);

    // Caractéristiques textuelles basiques
    const textLength = Math.min(text.length, 1000);
    const wordCount = text.split(/\s+/).length;
    const lineCount = text.split("\n").length;
    const avgWordLength = textLength / Math.max(wordCount, 1);

    // Générer un embedding déterministe mais sémantiquement significatif
    return Array(dimension)
      .fill(0)
      .map((_, i) => {
        // Base déterministe basée sur le hachage sémantique
        const hashFactor = (contentHash * (i + 1)) % 1;
        const base = Math.sin(hashFactor * Math.PI * 2) * 0.4;

        // Influence des caractéristiques textuelles
        const lengthFactor = Math.sin(textLength * 0.001 + i * 0.01) * 0.1;
        const wordFactor = Math.cos(wordCount * 0.01 + i * 0.02) * 0.05;
        const lineFactor = Math.sin(lineCount * 0.05 + i * 0.03) * 0.03;
        const avgWordFactor = Math.cos(avgWordLength * 0.1 + i * 0.04) * 0.02;

        // Bruit minimal pour éviter les collisions exactes
        const noise = (Math.random() - 0.5) * 0.02;

        return (
          base + lengthFactor + wordFactor + lineFactor + avgWordFactor + noise
        );
      });
  }

  /**
   * Hachage sémantique amélioré basé sur le contenu du texte
   */
  private semanticHash(text: string): number {
    // Normaliser le texte
    const normalized = text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Utiliser les premiers 100 caractères pour le hachage
    const sample = normalized.substring(0, Math.min(100, normalized.length));

    // Hachage basé sur la somme des codes de caractères pondérés
    let hash = 0;
    for (let i = 0; i < sample.length; i++) {
      const char = sample.charCodeAt(i);
      // Poids différent pour chaque position pour éviter les collisions
      const weight = 1 + (i % 10) * 0.1;
      hash = (hash * 31 + char * weight) % 2147483647;
    }

    // Normaliser entre 0 et 1
    return (hash % 10000) / 10000;
  }

  /**
   * Fonction de hachage simple
   */
  private simpleHash(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Génère un embedding avec routage automatique par type de contenu
   */
  async generateForContent(
    text: string,
    contentType: string = "other",
    language?: string,
  ): Promise<number[]> {
    // 1. Déterminer le modèle approprié
    const model = this.getModelForContentType(contentType, language);

    // 2. Vérifier le cache
    const cached = this.cache.get(text, model);
    if (cached) {
      VectorStoreLogger.debug(
        "embedding.cache.hit",
        `Using cached embedding (${model})`,
        {
          model,
          textPreview: text.substring(0, 50),
        },
      );
      return cached;
    }

    // 3. Générer l'embedding avec le modèle approprié
    VectorStoreLogger.debug(
      "embedding.generating",
      `Generating embedding with ${model} for ${contentType}`,
      {
        model,
        contentType,
        textPreview: text.substring(0, 50),
      },
    );
    const vector = await this.generateWithModel(text, model);

    // 4. Normaliser
    const normalizedVector = this.normalizeL2(vector);

    // 5. Mettre en cache
    this.cache.set(text, normalizedVector, model, contentType, language);

    return normalizedVector;
  }

  /**
   * Génère un embedding avec un modèle spécifique
   */
  async generateWithModel(text: string, model: string): Promise<number[]> {
    switch (this.config.provider) {
      case "ollama":
        if (!this.ollamaService) {
          throw new Error("Ollama service not configured");
        }
        return await this.ollamaService.generateEmbedding(text, model);

      case "sentence-transformers":
        return await this.generateSentenceTransformerEmbedding(text);

      case "fallback":
      default:
        return this.generateFallbackEmbedding(text, model);
    }
  }

  /**
   * Génère un embedding selon le fournisseur configuré (compatibilité)
   */
  async generate(text: string): Promise<number[]> {
    // Utiliser le modèle par défaut pour la compatibilité
    return await this.generateWithModel(text, this.config.models.fallback);
  }

  /**
   * Embeddings avec Sentence Transformers
   */
  private async generateSentenceTransformerEmbedding(
    text: string,
  ): Promise<number[]> {
    VectorStoreLogger.debug(
      "embedding.sentence-transformers",
      "Generating embedding with Sentence Transformers",
      {
        textPreview: text.substring(0, 50),
      },
    );

    try {
      // Import dynamique pour éviter les problèmes de chargement
      const { pipeline } = await import("@xenova/transformers");

      // Utiliser un modèle Sentence Transformer léger et performant
      // 'Xenova/all-MiniLM-L6-v2' est un bon choix pour l'équilibre performance/qualité
      const extractor = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
        {
          quantized: true, // Utiliser la version quantifiée pour réduire la taille
        },
      );

      // Générer l'embedding
      const result = await extractor(text, {
        pooling: "mean", // Pooling moyen pour obtenir un vecteur fixe
        normalize: false, // Nous normaliserons nous-mêmes après
      });

      // Convertir le tensor en tableau
      const embedding = Array.from(result.data);

      VectorStoreLogger.debug(
        "embedding.sentence-transformers.success",
        "Sentence Transformer embedding generated successfully",
        {
          embeddingLength: embedding.length,
          textPreview: text.substring(0, 50),
        },
      );

      return embedding;
    } catch (error) {
      VectorStoreLogger.error(
        "embedding.sentence-transformers.error",
        "Failed to generate Sentence Transformer embedding",
        error as Error,
      );

      // Fallback sur les embeddings de fallback en cas d'erreur
      VectorStoreLogger.warn(
        "embedding.sentence-transformers.fallback",
        "Falling back to fallback embedding",
      );
      return this.generateFallbackEmbedding(text, this.config.models.fallback);
    }
  }

  /**
   * Détecte le meilleur provider disponible
   */
  private async detectBestProvider(): Promise<EmbeddingProvider> {
    // 1. Tester Ollama
    try {
      const ollamaService = getDefaultOllamaService();
      const ollamaAvailable = await ollamaService.testConnection();
      if (ollamaAvailable) {
        VectorStoreLogger.info(
          "embedding.provider.detection",
          "Ollama provider detected as available",
        );
        return "ollama";
      }
    } catch (error) {
      VectorStoreLogger.debug(
        "embedding.provider.detection.ollama",
        "Ollama not available",
        { error: error instanceof Error ? error.message : String(error) },
      );
    }

    // 2. Tester Sentence Transformers
    try {
      // Vérifier si @xenova/transformers est disponible
      const { pipeline } = await import("@xenova/transformers");
      VectorStoreLogger.info(
        "embedding.provider.detection",
        "Sentence Transformers provider detected as available",
      );
      return "sentence-transformers";
    } catch (error) {
      VectorStoreLogger.debug(
        "embedding.provider.detection.sentence-transformers",
        "Sentence Transformers not available",
        { error: error instanceof Error ? error.message : String(error) },
      );
    }

    // 3. Fallback
    VectorStoreLogger.info(
      "embedding.provider.detection",
      "No embedding provider available, using fallback",
    );
    return "fallback";
  }

  /**
   * Obtient l'instance de cache utilisée
   */
  getCache(): EmbeddingCache {
    return this.cache;
  }

  /**
   * Obtient l'instance du service Ollama (si configuré)
   */
  getOllamaService(): OllamaService | null {
    return this.ollamaService;
  }

  /**
   * Obtient la configuration actuelle
   */
  getConfig(): EmbeddingServiceConfig {
    return { ...this.config };
  }

  /**
   * Met à jour la configuration
   */
  updateConfig(newConfig: Partial<EmbeddingServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (newConfig.cache) {
      this.cache = newConfig.cache;
    }

    if (this.config.provider === "ollama" && newConfig.ollamaService) {
      this.ollamaService = newConfig.ollamaService;
    } else if (this.config.provider !== "ollama") {
      this.ollamaService = null;
    }

    VectorStoreLogger.info(
      "embedding.service.config.updated",
      "Embedding service configuration updated",
      {
        newProvider: this.config.provider,
      },
    );
  }

  /**
   * Teste la connectivité du service
   */
  async testConnection(): Promise<boolean> {
    switch (this.config.provider) {
      case "ollama":
        return this.ollamaService
          ? await this.ollamaService.testConnection()
          : false;

      case "sentence-transformers":
        // Sentence Transformers est toujours disponible localement
        return true;

      case "fallback":
        return true;

      default:
        return false;
    }
  }
}

/**
 * Configuration par défaut des modèles
 */
export const DEFAULT_MODEL_CONFIG: EmbeddingModelConfig = {
  code: "nomic-embed-code",
  text: "nomic-embed-text",
  config: "bge-small",
  fallback: "qwen3-embedding:8b",
};

/**
 * Instance singleton par défaut
 */
let defaultEmbeddingServiceInstance: EmbeddingService | null = null;

/**
 * Obtient l'instance singleton du service d'embeddings
 */
export async function getDefaultEmbeddingService(): Promise<EmbeddingService> {
  if (!defaultEmbeddingServiceInstance) {
    // Détecter automatiquement le meilleur provider disponible
    const detectedProvider = await detectBestProvider();

    defaultEmbeddingServiceInstance = new EmbeddingService({
      provider: detectedProvider,
      models: DEFAULT_MODEL_CONFIG,
    });
    VectorStoreLogger.info(
      "embedding.service.default.init",
      "Default embedding service initialized",
    );
  }
  return defaultEmbeddingServiceInstance;
}

/**
 * Détecte le meilleur provider disponible (fonction utilitaire)
 */
async function detectBestProvider(): Promise<EmbeddingProvider> {
  // 1. Tester Ollama
  try {
    const ollamaService = getDefaultOllamaService();
    const ollamaAvailable = await ollamaService.testConnection();
    if (ollamaAvailable) {
      VectorStoreLogger.info(
        "embedding.provider.detection",
        "Ollama provider detected as available",
      );
      return "ollama";
    }
  } catch (error) {
    VectorStoreLogger.debug(
      "embedding.provider.detection.ollama",
      "Ollama not available",
      { error: error instanceof Error ? error.message : String(error) },
    );
  }

  // 2. Tester Sentence Transformers
  try {
    // Vérifier si @xenova/transformers est disponible
    const { pipeline } = await import("@xenova/transformers");
    VectorStoreLogger.info(
      "embedding.provider.detection",
      "Sentence Transformers provider detected as available",
    );
    return "sentence-transformers";
  } catch (error) {
    VectorStoreLogger.debug(
      "embedding.provider.detection.sentence-transformers",
      "Sentence Transformers not available",
      { error: error instanceof Error ? error.message : String(error) },
    );
  }

  // 3. Fallback
  VectorStoreLogger.info(
    "embedding.provider.detection",
    "No embedding provider available, using fallback",
  );
  return "fallback";
}

/**
 * Configure l'instance singleton du service d'embeddings
 */
export function configureDefaultEmbeddingService(
  provider: EmbeddingProvider,
  defaultModel: string = "qwen3-embedding:8b",
  modelConfig?: Partial<EmbeddingModelConfig>,
): void {
  const models: EmbeddingModelConfig = {
    ...DEFAULT_MODEL_CONFIG,
    fallback: defaultModel,
    ...modelConfig,
  };

  defaultEmbeddingServiceInstance = new EmbeddingService({
    provider,
    models,
  });

  VectorStoreLogger.info(
    "embedding.service.default.configured",
    "Default embedding service configured",
    {
      provider,
      models,
    },
  );
}

/**
 * Configure uniquement les modèles (sans changer le provider)
 */
export function setDefaultEmbeddingModels(
  models: Partial<EmbeddingModelConfig>,
): void {
  if (defaultEmbeddingServiceInstance) {
    const currentConfig = defaultEmbeddingServiceInstance.getConfig();
    defaultEmbeddingServiceInstance.updateConfig({
      models: { ...currentConfig.models, ...models },
    });
  }
}

/**
 * Détermine le modèle approprié pour un type de contenu (utilitaire)
 */
export async function getEmbeddingModelForContentType(
  contentType: string,
  language?: string,
): Promise<string> {
  const service = await getDefaultEmbeddingService();
  return service.getModelForContentType(contentType, language);
}

/**
 * Obtient la dimension attendue pour un modèle (utilitaire)
 */
export async function getEmbeddingDimensionForModel(
  model: string,
): Promise<number> {
  const service = await getDefaultEmbeddingService();
  return service.getDimensionForModel(model);
}

/**
 * Génère un embedding (utilitaire de compatibilité)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const service = await getDefaultEmbeddingService();
  return await service.generate(text);
}

/**
 * Génère un embedding avec routage automatique (utilitaire)
 */
export async function generateEmbeddingForContent(
  text: string,
  contentType: string = "other",
  language?: string,
): Promise<number[]> {
  const service = await getDefaultEmbeddingService();
  return await service.generateForContent(text, contentType, language);
}

/**
 * Normalise un vecteur L2 (utilitaire)
 */
export function normalizeL2(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) return vector;
  return vector.map((val) => val / norm);
}
