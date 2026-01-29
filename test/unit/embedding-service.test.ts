/**
 * Tests unitaires pour embedding-service.ts
 * Couverture complète du service de génération d'embeddings RAG
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmbeddingCache } from "../../src/rag/embedding-cache.js";
import {
  configureDefaultEmbeddingService,
  DEFAULT_MODEL_CONFIG,
  EmbeddingProvider,
  EmbeddingService,
  EmbeddingServiceConfig,
  generateEmbedding,
  generateEmbeddingForContent,
  getDefaultEmbeddingService,
  getEmbeddingDimensionForModel,
  getEmbeddingModelForContentType,
  normalizeL2,
} from "../../src/rag/embedding-service.js";
import { OllamaService } from "../../src/rag/ollama-service.js";

// Mocks
const mockEmbeddingCache = {
  get: vi.fn(),
  set: vi.fn(),
  clear: vi.fn(),
  stats: vi.fn(() => ({ hits: 0, misses: 0, size: 0 })),
};

const mockOllamaService = {
  generateEmbedding: vi.fn(),
  testConnection: vi.fn(() => Promise.resolve(true)),
};

describe("embedding-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("EmbeddingService class", () => {
    it("should initialize with default configuration", () => {
      const service = new EmbeddingService({
        provider: "fallback",
        models: DEFAULT_MODEL_CONFIG,
      });

      expect(service).toBeInstanceOf(EmbeddingService);
      expect(service.getConfig().provider).toBe("fallback");
      expect(service.getConfig().models.code).toBe("nomic-embed-code");
    });

    it("should initialize with custom cache", () => {
      const service = new EmbeddingService({
        provider: "fallback",
        models: DEFAULT_MODEL_CONFIG,
        cache: mockEmbeddingCache as unknown as EmbeddingCache,
      });

      expect(service.getCache()).toBe(mockEmbeddingCache);
    });

    it("should initialize with Ollama service when provider is ollama", () => {
      const service = new EmbeddingService({
        provider: "ollama",
        models: DEFAULT_MODEL_CONFIG,
        ollamaService: mockOllamaService as unknown as OllamaService,
      });

      expect(service.getOllamaService()).toBe(mockOllamaService);
    });

    it("should not initialize Ollama service when provider is not ollama", () => {
      const service = new EmbeddingService({
        provider: "fallback",
        models: DEFAULT_MODEL_CONFIG,
      });

      expect(service.getOllamaService()).toBeNull();
    });

    describe("getModelForContentType", () => {
      const service = new EmbeddingService({
        provider: "fallback",
        models: DEFAULT_MODEL_CONFIG,
      });

      it("should return code model for code content type", () => {
        expect(service.getModelForContentType("code")).toBe("nomic-embed-code");
        expect(service.getModelForContentType("source")).toBe(
          "nomic-embed-code",
        );
        expect(service.getModelForContentType("program")).toBe(
          "nomic-embed-code",
        );
      });

      it("should return text model for doc content type", () => {
        expect(service.getModelForContentType("doc")).toBe("nomic-embed-text");
        expect(service.getModelForContentType("text")).toBe("nomic-embed-text");
        expect(service.getModelForContentType("documentation")).toBe(
          "nomic-embed-text",
        );
        expect(service.getModelForContentType("markdown")).toBe(
          "nomic-embed-text",
        );
        expect(service.getModelForContentType("readme")).toBe(
          "nomic-embed-text",
        );
      });

      it("should return config model for config content type", () => {
        expect(service.getModelForContentType("config")).toBe("bge-small");
        expect(service.getModelForContentType("configuration")).toBe(
          "bge-small",
        );
        expect(service.getModelForContentType("json")).toBe("bge-small");
        expect(service.getModelForContentType("yaml")).toBe("bge-small");
        expect(service.getModelForContentType("toml")).toBe("bge-small");
        expect(service.getModelForContentType("ini")).toBe("bge-small");
      });

      it("should return fallback model for unknown content type", () => {
        expect(service.getModelForContentType("unknown")).toBe(
          "qwen3-embedding:8b",
        );
        expect(service.getModelForContentType("other")).toBe(
          "qwen3-embedding:8b",
        );
        expect(service.getModelForContentType("")).toBe("qwen3-embedding:8b");
      });
    });

    describe("getDimensionForModel", () => {
      const service = new EmbeddingService({
        provider: "fallback",
        models: DEFAULT_MODEL_CONFIG,
      });

      it("should return correct dimension for code model", () => {
        expect(service.getDimensionForModel("nomic-embed-code")).toBe(768);
      });

      it("should return correct dimension for text model", () => {
        expect(service.getDimensionForModel("nomic-embed-text")).toBe(768);
      });

      it("should return correct dimension for config model", () => {
        expect(service.getDimensionForModel("bge-small")).toBe(384);
      });

      it("should return fallback dimension for unknown model", () => {
        expect(service.getDimensionForModel("unknown-model")).toBe(1024);
      });
    });

    describe("normalizeL2", () => {
      const service = new EmbeddingService({
        provider: "fallback",
        models: DEFAULT_MODEL_CONFIG,
      });

      it("should normalize a vector", () => {
        const vector = [1, 2, 3];
        const normalized = service.normalizeL2(vector);

        // Check that the normalized vector has unit length
        const norm = Math.sqrt(
          normalized.reduce((sum, val) => sum + val * val, 0),
        );
        expect(norm).toBeCloseTo(1, 5);
      });

      it("should handle zero vector", () => {
        const vector = [0, 0, 0];
        const normalized = service.normalizeL2(vector);
        expect(normalized).toEqual([0, 0, 0]);
      });
    });

    describe("generateFallbackEmbedding", () => {
      const service = new EmbeddingService({
        provider: "fallback",
        models: DEFAULT_MODEL_CONFIG,
      });

      it("should generate embedding with correct dimension", () => {
        const embedding = service.generateFallbackEmbedding(
          "test text",
          "nomic-embed-code",
        );
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBe(768); // Dimension for code model
      });

      it("should generate different embeddings for different texts", () => {
        const embedding1 = service.generateFallbackEmbedding("text 1");
        const embedding2 = service.generateFallbackEmbedding("text 2");

        // They should be different (very low probability of collision)
        let different = false;
        for (
          let i = 0;
          i < Math.min(embedding1.length, embedding2.length);
          i++
        ) {
          if (Math.abs(embedding1[i] - embedding2[i]) > 0.001) {
            different = true;
            break;
          }
        }
        expect(different).toBe(true);
      });
    });

    describe("generateForContent", () => {
      it("should use cache when available", async () => {
        const cachedEmbedding = [0.1, 0.2, 0.3];
        mockEmbeddingCache.get.mockReturnValue(cachedEmbedding);

        const service = new EmbeddingService({
          provider: "fallback",
          models: DEFAULT_MODEL_CONFIG,
          cache: mockEmbeddingCache as unknown as EmbeddingCache,
        });

        const result = await service.generateForContent("test text", "code");

        expect(mockEmbeddingCache.get).toHaveBeenCalledWith(
          "test text",
          "nomic-embed-code",
        );
        expect(result).toBe(cachedEmbedding);
      });

      it("should generate and cache when not in cache", async () => {
        mockEmbeddingCache.get.mockReturnValue(null);
        const generatedEmbedding = [0.1, 0.2, 0.3];

        const service = new EmbeddingService({
          provider: "fallback",
          models: DEFAULT_MODEL_CONFIG,
          cache: mockEmbeddingCache as unknown as EmbeddingCache,
        });

        // Mock the internal generation
        const generateSpy = vi
          .spyOn(service as any, "generateWithModel")
          .mockResolvedValue(generatedEmbedding);

        const result = await service.generateForContent("test text", "code");

        expect(mockEmbeddingCache.get).toHaveBeenCalled();
        expect(generateSpy).toHaveBeenCalledWith(
          "test text",
          "nomic-embed-code",
        );
        expect(mockEmbeddingCache.set).toHaveBeenCalled();
        // Vérifier que le résultat est normalisé (L2 norm = 1)
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
        const norm = Math.sqrt(result.reduce((sum, val) => sum + val * val, 0));
        expect(norm).toBeCloseTo(1, 5);
      });
    });

    describe("generateWithModel", () => {
      it("should use Ollama service when provider is ollama", async () => {
        const ollamaEmbedding = [0.1, 0.2, 0.3];
        mockOllamaService.generateEmbedding.mockResolvedValue(ollamaEmbedding);

        const service = new EmbeddingService({
          provider: "ollama",
          models: DEFAULT_MODEL_CONFIG,
          ollamaService: mockOllamaService as unknown as OllamaService,
        });

        const result = await service.generateWithModel(
          "test text",
          "nomic-embed-code",
        );

        expect(mockOllamaService.generateEmbedding).toHaveBeenCalledWith(
          "test text",
          "nomic-embed-code",
        );
        expect(result).toBe(ollamaEmbedding);
      });

      it("should use fallback provider by default", async () => {
        const service = new EmbeddingService({
          provider: "fallback",
          models: DEFAULT_MODEL_CONFIG,
        });

        const result = await service.generateWithModel(
          "test text",
          "nomic-embed-code",
        );

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(768); // Dimension for code model
      });

      it(
        "should fallback to fallback provider when Ollama not configured",
        async () => {
          const service = new EmbeddingService({
            provider: "ollama",
            models: DEFAULT_MODEL_CONFIG,
            // No ollamaService provided
          });

          // Le service devrait utiliser fallback au lieu de planter
          const result = await service.generateWithModel(
            "test text",
            "nomic-embed-code",
          );

          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBeGreaterThan(0); // Le service fallback génère un embedding valide
        },
        10000,
      ); // Timeout 10s pour détection réseau Ollama
    });

    describe("updateConfig", () => {
      it("should update configuration", () => {
        const service = new EmbeddingService({
          provider: "fallback",
          models: DEFAULT_MODEL_CONFIG,
        });

        const newConfig: Partial<EmbeddingServiceConfig> = {
          provider: "ollama" as EmbeddingProvider,
          models: { ...DEFAULT_MODEL_CONFIG, fallback: "new-model" },
        };

        service.updateConfig(newConfig);

        const updatedConfig = service.getConfig();
        expect(updatedConfig.provider).toBe("ollama");
        expect(updatedConfig.models.fallback).toBe("new-model");
      });

      it("should update cache when provided", () => {
        const newCache = { ...mockEmbeddingCache };
        const service = new EmbeddingService({
          provider: "fallback",
          models: DEFAULT_MODEL_CONFIG,
          cache: mockEmbeddingCache as unknown as EmbeddingCache,
        });

        service.updateConfig({ cache: newCache as unknown as EmbeddingCache });

        expect(service.getCache()).toBe(newCache);
      });

      it("should update Ollama service when provider is ollama", () => {
        const newOllamaService = { ...mockOllamaService };
        const service = new EmbeddingService({
          provider: "ollama",
          models: DEFAULT_MODEL_CONFIG,
          ollamaService: mockOllamaService as unknown as OllamaService,
        });

        service.updateConfig({
          ollamaService: newOllamaService as unknown as OllamaService,
        });

        expect(service.getOllamaService()).toBe(newOllamaService);
      });
    });

    describe("testConnection", () => {
      it("should return true for fallback provider", async () => {
        const service = new EmbeddingService({
          provider: "fallback",
          models: DEFAULT_MODEL_CONFIG,
        });

        const result = await service.testConnection();
        expect(result).toBe(true);
      });

      it("should use Ollama service testConnection", async () => {
        mockOllamaService.testConnection.mockResolvedValue(true);

        const service = new EmbeddingService({
          provider: "ollama",
          models: DEFAULT_MODEL_CONFIG,
          ollamaService: mockOllamaService as unknown as OllamaService,
        });

        const result = await service.testConnection();
        expect(result).toBe(true);
        expect(mockOllamaService.testConnection).toHaveBeenCalled();
      });

      it("should fallback when Ollama service not configured", async () => {
        const service = new EmbeddingService({
          provider: "ollama",
          models: DEFAULT_MODEL_CONFIG,
          // No ollamaService provided
        });

        const result = await service.testConnection();
        // Le service fallback automatiquement en l'absence d'Ollama
        expect(result).toBe(true);
      });
    });
  });

  describe("utility functions", () => {
    beforeEach(async () => {
      // Reset default service
      configureDefaultEmbeddingService("fallback", "qwen3-embedding:8b");
    });

    describe("getDefaultEmbeddingService", () => {
      it("should return singleton instance", async () => {
        const service1 = await getDefaultEmbeddingService();
        const service2 = await getDefaultEmbeddingService();

        expect(service1).toBe(service2);
      });
    });

    describe("configureDefaultEmbeddingService", () => {
      it("should configure default service", async () => {
        configureDefaultEmbeddingService("ollama", "custom-model", {
          code: "custom-code-model",
        });

        const service = await getDefaultEmbeddingService();
        const config = service.getConfig();

        expect(config.provider).toBe("ollama");
        expect(config.models.fallback).toBe("custom-model");
        expect(config.models.code).toBe("custom-code-model");
        expect(config.models.text).toBe("nomic-embed-text"); // Default preserved
      });
    });

    describe("getEmbeddingModelForContentType", () => {
      it("should delegate to default service", async () => {
        const model = await getEmbeddingModelForContentType("code");
        expect(model).toBe("nomic-embed-code");
      });
    });

    describe("getEmbeddingDimensionForModel", () => {
      it("should delegate to default service", async () => {
        const dimension =
          await getEmbeddingDimensionForModel("nomic-embed-code");
        expect(dimension).toBe(768);
      });
    });

    describe("generateEmbedding", () => {
      it("should generate embedding using default service", async () => {
        const embedding = await generateEmbedding("test text");

        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBe(1024); // Fallback model dimension
      });
    });

    describe("generateEmbeddingForContent", () => {
      it("should generate embedding for specific content type", async () => {
        const embedding = await generateEmbeddingForContent(
          "test text",
          "code",
        );

        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBe(768); // Code model dimension
      });
    });

    describe("normalizeL2", () => {
      it("should normalize vector", () => {
        const vector = [1, 2, 3];
        const normalized = normalizeL2(vector);

        const norm = Math.sqrt(
          normalized.reduce((sum, val) => sum + val * val, 0),
        );
        expect(norm).toBeCloseTo(1, 5);
      });
    });
  });
});
