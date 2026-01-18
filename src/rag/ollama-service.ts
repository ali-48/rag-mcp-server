// src/rag/ollama-service.ts
// Module dédié aux appels HTTP à l'API Ollama
// Responsabilité unique : Communication avec le service Ollama pour les embeddings

import { VectorStoreLogger } from "./vector-store-interface.js";

/**
 * Configuration du service Ollama
 */
export interface OllamaServiceConfig {
  baseUrl: string;
  defaultModel: string;
  batchDelayMs: number;
  batchMaxSize: number;
  timeoutMs: number;
}

/**
 * Requête d'embedding en attente
 */
interface PendingEmbeddingRequest {
  text: string;
  resolve: (embedding: number[]) => void;
  reject: (error: Error) => void;
}

/**
 * Réponse de l'API Ollama pour les embeddings
 */
interface OllamaEmbeddingResponse {
  embedding: number[];
}

/**
 * Réponse de l'API Ollama pour les embeddings batch
 */
interface OllamaBatchEmbeddingResponse {
  embeddings: number[][];
}

/**
 * Service pour interagir avec l'API Ollama
 */
export class OllamaService {
  private batchQueue: PendingEmbeddingRequest[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;

  /**
   * Crée une instance du service Ollama
   */
  constructor(private config: OllamaServiceConfig = {
    baseUrl: "http://localhost:11434",
    defaultModel: "qwen3-embedding:8b",
    batchDelayMs: 50,
    batchMaxSize: 10,
    timeoutMs: 30000,
  }) { }

  /**
   * Génère un embedding via Ollama (avec batching automatique)
   */
  async generateEmbedding(text: string, model?: string): Promise<number[]> {
    const targetModel = model || this.config.defaultModel;

    VectorStoreLogger.debug("ollama.embedding.queueing", "Queueing embedding for Ollama", {
      model: targetModel,
      textPreview: text.substring(0, 50),
    });

    // Retourner une promesse qui sera résolue par le batch
    return new Promise((resolve, reject) => {
      this.batchQueue.push({ text, resolve, reject });

      // Démarrer le traitement du batch si nécessaire
      if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => this.processBatch(), this.config.batchDelayMs);
      }

      // Traiter immédiatement si le batch est plein
      if (this.batchQueue.length >= this.config.batchMaxSize) {
        if (this.batchTimeout) {
          clearTimeout(this.batchTimeout);
          this.batchTimeout = null;
        }
        this.processBatch();
      }
    });
  }

  /**
   * Traite un batch de requêtes Ollama
   */
  private async processBatch(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.batchQueue.length === 0) {
      return;
    }

    const batch = this.batchQueue.splice(0, this.config.batchMaxSize);
    const texts = batch.map(item => item.text);

    VectorStoreLogger.debug("ollama.embedding.batch", "Processing Ollama batch", {
      batchSize: texts.length,
    });

    try {
      const response = await fetch(`${this.config.baseUrl}/api/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.defaultModel,
          input: texts,
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as OllamaBatchEmbeddingResponse;

      if (!data.embeddings || !Array.isArray(data.embeddings)) {
        // Fallback: traiter chaque texte individuellement
        VectorStoreLogger.warn("ollama.embedding.batch.fallback",
          "Ollama batch API not supported, falling back to individual requests");
        await this.processIndividualRequests(batch);
        return;
      }

      // Vérifier que nous avons le bon nombre d'embeddings
      if (data.embeddings.length !== texts.length) {
        throw new Error(
          `Ollama batch API returned ${data.embeddings.length} embeddings, expected ${texts.length}`
        );
      }

      // Distribuer les résultats
      for (let i = 0; i < batch.length; i++) {
        const embedding = data.embeddings[i];
        const { resolve } = batch[i];

        if (!embedding || !Array.isArray(embedding)) {
          resolve(this.generateFallbackEmbedding(texts[i]));
        } else {
          resolve(embedding);
        }
      }

    } catch (error) {
      VectorStoreLogger.error("ollama.embedding.batch.error",
        "Failed to process Ollama batch", error as Error);
      // Fallback: traiter chaque texte individuellement
      await this.processIndividualRequests(batch);
    }
  }

  /**
   * Traite les requêtes Ollama individuellement (fallback)
   */
  private async processIndividualRequests(batch: PendingEmbeddingRequest[]): Promise<void> {
    for (const item of batch) {
      try {
        const embedding = await this.generateIndividualEmbedding(item.text);
        item.resolve(embedding);
      } catch (error) {
        VectorStoreLogger.error("ollama.embedding.individual.error",
          "Failed to get embedding from Ollama for individual request", error as Error);
        // Fallback sur les embeddings factices
        const fakeEmbedding = this.generateFallbackEmbedding(item.text);
        item.resolve(fakeEmbedding);
      }
    }
  }

  /**
   * Génère un embedding via une requête individuelle
   */
  private async generateIndividualEmbedding(text: string): Promise<number[]> {
    const response = await fetch(`${this.config.baseUrl}/api/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.defaultModel,
        prompt: text,
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as OllamaEmbeddingResponse;

    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new Error("Invalid response from Ollama API: missing embedding array");
    }

    return data.embedding;
  }

  /**
   * Génère un embedding factice de fallback
   */
  private generateFallbackEmbedding(text: string): number[] {
    // Dimension par défaut pour le modèle fallback
    const dimension = 1024;
    const seed = this.simpleHash(text + this.config.defaultModel);

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
  private simpleHash(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Teste la connectivité à l'API Ollama
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      VectorStoreLogger.info("ollama.connection.test", "Ollama connection test successful");
      return true;
    } catch (error) {
      VectorStoreLogger.error("ollama.connection.test.error",
        "Ollama connection test failed", error as Error);
      return false;
    }
  }

  /**
   * Liste les modèles disponibles sur Ollama
   */
  async listAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { models: Array<{ name: string }> };
      return data.models.map(model => model.name);
    } catch (error) {
      VectorStoreLogger.error("ollama.models.list.error",
        "Failed to list Ollama models", error as Error);
      return [];
    }
  }

  /**
   * Nettoie les ressources (annule le timeout en attente)
   */
  cleanup(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    // Rejeter toutes les requêtes en attente
    for (const item of this.batchQueue) {
      item.reject(new Error("Ollama service cleaned up"));
    }
    this.batchQueue = [];

    VectorStoreLogger.debug("ollama.service.cleanup", "Ollama service cleaned up");
  }

  /**
   * Obtient le nombre de requêtes en attente
   */
  getPendingRequestsCount(): number {
    return this.batchQueue.length;
  }

  /**
   * Obtient la configuration actuelle
   */
  getConfig(): OllamaServiceConfig {
    return { ...this.config };
  }

  /**
   * Met à jour la configuration
   */
  updateConfig(newConfig: Partial<OllamaServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    VectorStoreLogger.info("ollama.service.config.updated", "Ollama service configuration updated", {
      newConfig,
    });
  }
}

/**
 * Instance singleton par défaut
 */
let defaultOllamaServiceInstance: OllamaService | null = null;

/**
 * Obtient l'instance singleton du service Ollama
 */
export function getDefaultOllamaService(): OllamaService {
  if (!defaultOllamaServiceInstance) {
    defaultOllamaServiceInstance = new OllamaService();
    VectorStoreLogger.info("ollama.service.init", "Default Ollama service initialized");
  }
  return defaultOllamaServiceInstance;
}

/**
 * Configure l'instance singleton du service Ollama
 */
export function configureDefaultOllamaService(config: Partial<OllamaServiceConfig>): void {
  defaultOllamaServiceInstance = new OllamaService({
    baseUrl: "http://localhost:11434",
    defaultModel: "qwen3-embedding:8b",
    batchDelayMs: 50,
    batchMaxSize: 10,
    timeoutMs: 30000,
    ...config,
  });
  VectorStoreLogger.info("ollama.service.configured", "Default Ollama service configured", {
    config: defaultOllamaServiceInstance.getConfig(),
  });
}

/**
 * Nettoie le service singleton
 */
export function cleanupDefaultOllamaService(): void {
  if (defaultOllamaServiceInstance) {
    defaultOllamaServiceInstance.cleanup();
  }
}

/**
 * Teste la connexion au service singleton
 */
export async function testDefaultOllamaConnection(): Promise<boolean> {
  return defaultOllamaServiceInstance
    ? await defaultOllamaServiceInstance.testConnection()
    : false;
}
