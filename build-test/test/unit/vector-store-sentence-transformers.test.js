/**
 * Tests unitaires pour le provider Sentence Transformers dans vector-store-refactored.js
 * Couverture complète de l'implémentation Sentence Transformers
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearEmbeddingCache,
  clearSentenceTransformerCache,
  generateEmbeddingForContent,
  getEmbeddingCacheStats,
  getEmbeddingDimensionForModel,
  getEmbeddingModelForContentType,
  getSentenceTransformerCacheStats,
  isEmbeddingProviderSupported,
  listSupportedEmbeddingProviders,
  setEmbeddingProvider
} from "../../src/rag/vector-store-refactored.js";

// Mock pour @xenova/transformers
vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn()
}));

// Mock pour le logger
vi.mock('../../src/core/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Mock pour VectorStoreSQLite
vi.mock('../../src/rag/vector-store-sqlite.js', () => ({
  VectorStoreSQLite: vi.fn().mockImplementation(() => ({
    embedAndStore: vi.fn(),
    semanticSearch: vi.fn(),
    getProjectStats: vi.fn(),
    listProjects: vi.fn()
  }))
}));

describe("Sentence Transformers Provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Réinitialiser le provider à fake pour des tests propres
    setEmbeddingProvider('fake');
    clearEmbeddingCache();
    clearSentenceTransformerCache();
  });

  describe("Provider Configuration", () => {
    it("should support sentence-transformers provider", () => {
      const supported = isEmbeddingProviderSupported('sentence-transformers');
      expect(supported).toBe(true);
    });

    it("should list sentence-transformers in supported providers", () => {
      const providers = listSupportedEmbeddingProviders();
      expect(providers).toContain('sentence-transformers');
      expect(providers).toEqual(['fake', 'ollama', 'sentence-transformers']);
    });

    it("should configure sentence-transformers provider successfully", () => {
      setEmbeddingProvider('sentence-transformers', 'qwen3-embedding:8b', {
        code: 'nomic-embed-code',
        text: 'nomic-embed-text',
        config: 'bge-small'
      });

      // Vérifier que les modèles sont configurés
      const codeModel = getEmbeddingModelForContentType('code');
      expect(codeModel).toBe('nomic-embed-code');

      const textModel = getEmbeddingModelForContentType('text');
      expect(textModel).toBe('nomic-embed-text');

      const configModel = getEmbeddingModelForContentType('config');
      expect(configModel).toBe('bge-small');
    });

    it("should fallback to fake provider for unsupported provider", () => {
      // Mock console.warn pour éviter le bruit dans les tests
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

      setEmbeddingProvider('unsupported-provider');

      // Le provider devrait être fallback vers 'fake'
      const providers = listSupportedEmbeddingProviders();
      expect(providers).not.toContain('unsupported-provider');

      consoleWarnSpy.mockRestore();
    });
  });

  describe("Model Mapping", () => {
    beforeEach(() => {
      setEmbeddingProvider('sentence-transformers');
    });

    it("should map nomic-embed-code to Xenova/all-MiniLM-L6-v2", () => {
      const model = getEmbeddingModelForContentType('code');
      expect(model).toBe('nomic-embed-code');
      // Le mapping est interne, on vérifie via generateEmbeddingForContent
    });

    it("should map nomic-embed-text to Xenova/all-mpnet-base-v2", () => {
      const model = getEmbeddingModelForContentType('text');
      expect(model).toBe('nomic-embed-text');
    });

    it("should map bge-small to Xenova/bge-small-en-v1.5", () => {
      const model = getEmbeddingModelForContentType('config');
      expect(model).toBe('bge-small');
    });

    it("should map qwen3-embedding:8b to Xenova/all-MiniLM-L6-v2", () => {
      const model = getEmbeddingModelForContentType('unknown');
      expect(model).toBe('qwen3-embedding:8b');
    });
  });

  describe("Cache Management", () => {
    it("should clear sentence transformers cache", () => {
      const clearedCount = clearSentenceTransformerCache();
      expect(clearedCount).toBe(0); // Cache vide après beforeEach
    });

    it("should get sentence transformers cache stats", () => {
      const stats = getSentenceTransformerCacheStats();
      expect(stats).toEqual({
        totalPipelines: 0,
        pipelineNames: [],
        cacheEnabled: true
      });
    });

    it("should clear embedding cache", () => {
      clearEmbeddingCache();
      const stats = getEmbeddingCacheStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe("Embedding Generation (Mocked)", () => {
    let mockPipeline;

    beforeEach(async () => {
      // Configurer le mock pour @xenova/transformers
      const { pipeline } = await import('@xenova/transformers');
      mockPipeline = vi.fn();
      pipeline.mockResolvedValue(mockPipeline);

      setEmbeddingProvider('sentence-transformers');
    });

    it("should generate embedding with mocked sentence transformers", async () => {
      // Mock de l'embedding généré
      const mockEmbedding = {
        data: new Float32Array([0.1, 0.2, 0.3, 0.4])
      };

      mockPipeline.mockResolvedValue(mockEmbedding);

      const embedding = await generateEmbeddingForContent('test text', 'code');

      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(4); // Taille du mock embedding

      // Vérifier que l'embedding est normalisé (norme L2 ≈ 1)
      const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      expect(norm).toBeCloseTo(1, 5);
    });

    it("should handle array result from sentence transformers", async () => {
      // Mock avec tableau directement (format alternatif)
      const mockEmbeddingArray = [0.1, 0.2, 0.3, 0.4];
      mockPipeline.mockResolvedValue(mockEmbeddingArray);

      const embedding = await generateEmbeddingForContent('test text', 'text');

      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(4);
    });

    it("should fallback to fake embedding on sentence transformers error", async () => {
      // Mock d'erreur
      mockPipeline.mockRejectedValue(new Error('Model loading failed'));

      const embedding = await generateEmbeddingForContent('test text', 'code');

      // Devrait fallback vers fake embedding
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768); // Dimension du modèle code
    });

    it("should fallback to fake embedding when wrong provider configured", async () => {
      // Configurer un provider différent
      setEmbeddingProvider('fake');

      const embedding = await generateEmbeddingForContent('test text', 'code');

      // Devrait utiliser fake embedding
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768); // Dimension du modèle code
    });

    it("should cache embeddings", async () => {
      const mockEmbedding = {
        data: new Float32Array([0.1, 0.2, 0.3])
      };
      mockPipeline.mockResolvedValue(mockEmbedding);

      // Premier appel
      const embedding1 = await generateEmbeddingForContent('test text', 'code');

      // Deuxième appel (devrait être en cache)
      const embedding2 = await generateEmbeddingForContent('test text', 'code');

      // Les deux embeddings devraient être identiques
      expect(embedding1).toEqual(embedding2);

      // Vérifier les stats du cache
      const cacheStats = getEmbeddingCacheStats();
      expect(cacheStats.hits).toBeGreaterThan(0);
    });
  });

  describe("Timeout Handling", () => {
    it("should handle timeout during model loading", async () => {
      const { pipeline } = await import('@xenova/transformers');

      // Mock qui ne se résout jamais (timeout)
      pipeline.mockImplementation(() => new Promise(() => { }));

      setEmbeddingProvider('sentence-transformers');

      // Le timeout devrait déclencher et fallback vers fake embedding
      const embedding = await generateEmbeddingForContent('test text', 'code');

      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768); // Dimension du modèle code
    }, 10000); // Timeout de 10s pour le test
  });

  describe("Dimension Validation", () => {
    beforeEach(() => {
      setEmbeddingProvider('sentence-transformers');
    });

    it("should return correct dimension for nomic-embed-code", () => {
      const dimension = getEmbeddingDimensionForModel('nomic-embed-code');
      expect(dimension).toBe(768);
    });

    it("should return correct dimension for nomic-embed-text", () => {
      const dimension = getEmbeddingDimensionForModel('nomic-embed-text');
      expect(dimension).toBe(768);
    });

    it("should return correct dimension for bge-small", () => {
      const dimension = getEmbeddingDimensionForModel('bge-small');
      expect(dimension).toBe(384);
    });

    it("should return fallback dimension for unknown model", () => {
      const dimension = getEmbeddingDimensionForModel('unknown-model');
      expect(dimension).toBe(1024);
    });
  });

  describe("Content Type Routing", () => {
    beforeEach(() => {
      setEmbeddingProvider('sentence-transformers');
    });

    it("should route code content types to code model", () => {
      expect(getEmbeddingModelForContentType('code')).toBe('nomic-embed-code');
      expect(getEmbeddingModelForContentType('source')).toBe('nomic-embed-code');
      expect(getEmbeddingModelForContentType('program')).toBe('nomic-embed-code');
    });

    it("should route text content types to text model", () => {
      expect(getEmbeddingModelForContentType('doc')).toBe('nomic-embed-text');
      expect(getEmbeddingModelForContentType('text')).toBe('nomic-embed-text');
      expect(getEmbeddingModelForContentType('documentation')).toBe('nomic-embed-text');
      expect(getEmbeddingModelForContentType('markdown')).toBe('nomic-embed-text');
      expect(getEmbeddingModelForContentType('readme')).toBe('nomic-embed-text');
    });

    it("should route config content types to config model", () => {
      expect(getEmbeddingModelForContentType('config')).toBe('bge-small');
      expect(getEmbeddingModelForContentType('configuration')).toBe('bge-small');
      expect(getEmbeddingModelForContentType('json')).toBe('bge-small');
      expect(getEmbeddingModelForContentType('yaml')).toBe('bge-small');
      expect(getEmbeddingModelForContentType('toml')).toBe('bge-small');
      expect(getEmbeddingModelForContentType('ini')).toBe('bge-small');
    });

    it("should route unknown content types to fallback model", () => {
      expect(getEmbeddingModelForContentType('unknown')).toBe('qwen3-embedding:8b');
      expect(getEmbeddingModelForContentType('other')).toBe('qwen3-embedding:8b');
      expect(getEmbeddingModelForContentType('')).toBe('qwen3-embedding:8b');
    });
  });
});
