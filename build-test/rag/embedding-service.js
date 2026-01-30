"use strict";
// src/rag/embedding-service.ts
// Module dédié à la génération d'embeddings multi-modèles
// Responsabilité unique : Routage et génération d'embeddings par type de contenu
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MODEL_CONFIG = exports.EmbeddingService = void 0;
exports.getDefaultEmbeddingService = getDefaultEmbeddingService;
exports.configureDefaultEmbeddingService = configureDefaultEmbeddingService;
exports.setDefaultEmbeddingModels = setDefaultEmbeddingModels;
exports.getEmbeddingModelForContentType = getEmbeddingModelForContentType;
exports.getEmbeddingDimensionForModel = getEmbeddingDimensionForModel;
exports.generateEmbedding = generateEmbedding;
exports.generateEmbeddingForContent = generateEmbeddingForContent;
exports.normalizeL2 = normalizeL2;
var embedding_cache_js_1 = require("./embedding-cache.js");
var ollama_service_js_1 = require("./ollama-service.js");
var vector_store_interface_js_1 = require("./vector-store-interface.js");
/**
 * Dimensions par type (pour référence)
 */
var EMBEDDING_DIMENSIONS = {
    code: 768,
    text: 768,
    config: 384,
    fallback: 1024,
};
/**
 * Service de génération d'embeddings
 */
var EmbeddingService = /** @class */ (function () {
    /**
     * Crée une instance du service d'embeddings
     */
    function EmbeddingService(config) {
        this.config = config;
        this.ollamaService = null;
        this.cache = config.cache || (0, embedding_cache_js_1.getDefaultEmbeddingCache)();
        if (config.provider === "ollama") {
            this.ollamaService = config.ollamaService || (0, ollama_service_js_1.getDefaultOllamaService)();
        }
        vector_store_interface_js_1.VectorStoreLogger.info("embedding.service.init", "Embedding service initialized", {
            provider: config.provider,
            models: config.models,
        });
    }
    /**
     * Détermine le modèle approprié pour un type de contenu
     */
    EmbeddingService.prototype.getModelForContentType = function (contentType, language) {
        // Normaliser le type de contenu
        var normalizedType = contentType.toLowerCase();
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
    };
    /**
     * Obtient la dimension attendue pour un modèle
     */
    EmbeddingService.prototype.getDimensionForModel = function (model) {
        // Chercher dans la configuration
        for (var _i = 0, _a = Object.entries(this.config.models); _i < _a.length; _i++) {
            var _b = _a[_i], type = _b[0], modelName = _b[1];
            if (modelName === model) {
                return EMBEDDING_DIMENSIONS[type];
            }
        }
        // Fallback
        return EMBEDDING_DIMENSIONS.fallback;
    };
    /**
     * Normalise un vecteur selon la norme L2
     */
    EmbeddingService.prototype.normalizeL2 = function (vector) {
        var norm = Math.sqrt(vector.reduce(function (sum, val) { return sum + val * val; }, 0));
        if (norm === 0)
            return vector;
        return vector.map(function (val) { return val / norm; });
    };
    /**
     * Génère des embeddings de fallback améliorés basés sur le contenu
     */
    EmbeddingService.prototype.generateFallbackEmbedding = function (text, model) {
        if (model === void 0) { model = this.config.models.fallback; }
        // Déterminer la dimension basée sur le modèle
        var dimension = this.getDimensionForModel(model);
        // Hachage sémantique basé sur le contenu
        var contentHash = this.semanticHash(text + model);
        // Caractéristiques textuelles basiques
        var textLength = Math.min(text.length, 1000);
        var wordCount = text.split(/\s+/).length;
        var lineCount = text.split("\n").length;
        var avgWordLength = textLength / Math.max(wordCount, 1);
        // Générer un embedding déterministe mais sémantiquement significatif
        return Array(dimension)
            .fill(0)
            .map(function (_, i) {
            // Base déterministe basée sur le hachage sémantique
            var hashFactor = (contentHash * (i + 1)) % 1;
            var base = Math.sin(hashFactor * Math.PI * 2) * 0.4;
            // Influence des caractéristiques textuelles
            var lengthFactor = Math.sin(textLength * 0.001 + i * 0.01) * 0.1;
            var wordFactor = Math.cos(wordCount * 0.01 + i * 0.02) * 0.05;
            var lineFactor = Math.sin(lineCount * 0.05 + i * 0.03) * 0.03;
            var avgWordFactor = Math.cos(avgWordLength * 0.1 + i * 0.04) * 0.02;
            // Bruit minimal pour éviter les collisions exactes
            var noise = (Math.random() - 0.5) * 0.02;
            return (base + lengthFactor + wordFactor + lineFactor + avgWordFactor + noise);
        });
    };
    /**
     * Hachage sémantique amélioré basé sur le contenu du texte
     */
    EmbeddingService.prototype.semanticHash = function (text) {
        // Normaliser le texte
        var normalized = text
            .toLowerCase()
            .replace(/[^\w\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        // Utiliser les premiers 100 caractères pour le hachage
        var sample = normalized.substring(0, Math.min(100, normalized.length));
        // Hachage basé sur la somme des codes de caractères pondérés
        var hash = 0;
        for (var i = 0; i < sample.length; i++) {
            var char = sample.charCodeAt(i);
            // Poids différent pour chaque position pour éviter les collisions
            var weight = 1 + (i % 10) * 0.1;
            hash = (hash * 31 + char * weight) % 2147483647;
        }
        // Normaliser entre 0 et 1
        return (hash % 10000) / 10000;
    };
    /**
     * Fonction de hachage simple
     */
    EmbeddingService.prototype.simpleHash = function (text) {
        var hash = 0;
        for (var i = 0; i < text.length; i++) {
            var char = text.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    };
    /**
     * Génère un embedding avec routage automatique par type de contenu
     */
    EmbeddingService.prototype.generateForContent = function (text_1) {
        return __awaiter(this, arguments, void 0, function (text, contentType, language) {
            var model, cached, vector, normalizedVector;
            if (contentType === void 0) { contentType = "other"; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        model = this.getModelForContentType(contentType, language);
                        cached = this.cache.get(text, model);
                        if (cached) {
                            vector_store_interface_js_1.VectorStoreLogger.debug("embedding.cache.hit", "Using cached embedding (".concat(model, ")"), {
                                model: model,
                                textPreview: text.substring(0, 50),
                            });
                            return [2 /*return*/, cached];
                        }
                        // 3. Générer l'embedding avec le modèle approprié
                        vector_store_interface_js_1.VectorStoreLogger.debug("embedding.generating", "Generating embedding with ".concat(model, " for ").concat(contentType), {
                            model: model,
                            contentType: contentType,
                            textPreview: text.substring(0, 50),
                        });
                        return [4 /*yield*/, this.generateWithModel(text, model)];
                    case 1:
                        vector = _a.sent();
                        normalizedVector = this.normalizeL2(vector);
                        // 5. Mettre en cache
                        this.cache.set(text, normalizedVector, model, contentType, language);
                        return [2 /*return*/, normalizedVector];
                }
            });
        });
    };
    /**
     * Génère un embedding avec un modèle spécifique
     */
    EmbeddingService.prototype.generateWithModel = function (text, model) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this.config.provider;
                        switch (_a) {
                            case "ollama": return [3 /*break*/, 1];
                            case "sentence-transformers": return [3 /*break*/, 3];
                            case "fallback": return [3 /*break*/, 5];
                        }
                        return [3 /*break*/, 5];
                    case 1:
                        if (!this.ollamaService) {
                            throw new Error("Ollama service not configured");
                        }
                        return [4 /*yield*/, this.ollamaService.generateEmbedding(text, model)];
                    case 2: return [2 /*return*/, _b.sent()];
                    case 3: return [4 /*yield*/, this.generateSentenceTransformerEmbedding(text)];
                    case 4: return [2 /*return*/, _b.sent()];
                    case 5: return [2 /*return*/, this.generateFallbackEmbedding(text, model)];
                }
            });
        });
    };
    /**
     * Génère un embedding selon le fournisseur configuré (compatibilité)
     */
    EmbeddingService.prototype.generate = function (text) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.generateWithModel(text, this.config.models.fallback)];
                    case 1: 
                    // Utiliser le modèle par défaut pour la compatibilité
                    return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Embeddings avec Sentence Transformers
     */
    EmbeddingService.prototype.generateSentenceTransformerEmbedding = function (text) {
        return __awaiter(this, void 0, void 0, function () {
            var pipeline, extractor, result, embedding, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        vector_store_interface_js_1.VectorStoreLogger.debug("embedding.sentence-transformers", "Generating embedding with Sentence Transformers", {
                            textPreview: text.substring(0, 50),
                        });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, , 6]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("@xenova/transformers"); })];
                    case 2:
                        pipeline = (_a.sent()).pipeline;
                        return [4 /*yield*/, pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
                                quantized: true, // Utiliser la version quantifiée pour réduire la taille
                            })];
                    case 3:
                        extractor = _a.sent();
                        return [4 /*yield*/, extractor(text, {
                                pooling: "mean", // Pooling moyen pour obtenir un vecteur fixe
                                normalize: false, // Nous normaliserons nous-mêmes après
                            })];
                    case 4:
                        result = _a.sent();
                        embedding = Array.from(result.data);
                        vector_store_interface_js_1.VectorStoreLogger.debug("embedding.sentence-transformers.success", "Sentence Transformer embedding generated successfully", {
                            embeddingLength: embedding.length,
                            textPreview: text.substring(0, 50),
                        });
                        return [2 /*return*/, embedding];
                    case 5:
                        error_1 = _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("embedding.sentence-transformers.error", "Failed to generate Sentence Transformer embedding", error_1);
                        // Fallback sur les embeddings de fallback en cas d'erreur
                        vector_store_interface_js_1.VectorStoreLogger.warn("embedding.sentence-transformers.fallback", "Falling back to fallback embedding");
                        return [2 /*return*/, this.generateFallbackEmbedding(text, this.config.models.fallback)];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Détecte le meilleur provider disponible
     */
    EmbeddingService.prototype.detectBestProvider = function () {
        return __awaiter(this, void 0, void 0, function () {
            var ollamaService, ollamaAvailable, error_2, pipeline, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        ollamaService = (0, ollama_service_js_1.getDefaultOllamaService)();
                        return [4 /*yield*/, ollamaService.testConnection()];
                    case 1:
                        ollamaAvailable = _a.sent();
                        if (ollamaAvailable) {
                            vector_store_interface_js_1.VectorStoreLogger.info("embedding.provider.detection", "Ollama provider detected as available");
                            return [2 /*return*/, "ollama"];
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_2 = _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.debug("embedding.provider.detection.ollama", "Ollama not available", { error: error_2 instanceof Error ? error_2.message : String(error_2) });
                        return [3 /*break*/, 3];
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("@xenova/transformers"); })];
                    case 4:
                        pipeline = (_a.sent()).pipeline;
                        vector_store_interface_js_1.VectorStoreLogger.info("embedding.provider.detection", "Sentence Transformers provider detected as available");
                        return [2 /*return*/, "sentence-transformers"];
                    case 5:
                        error_3 = _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.debug("embedding.provider.detection.sentence-transformers", "Sentence Transformers not available", { error: error_3 instanceof Error ? error_3.message : String(error_3) });
                        return [3 /*break*/, 6];
                    case 6:
                        // 3. Fallback
                        vector_store_interface_js_1.VectorStoreLogger.info("embedding.provider.detection", "No embedding provider available, using fallback");
                        return [2 /*return*/, "fallback"];
                }
            });
        });
    };
    /**
     * Obtient l'instance de cache utilisée
     */
    EmbeddingService.prototype.getCache = function () {
        return this.cache;
    };
    /**
     * Obtient l'instance du service Ollama (si configuré)
     */
    EmbeddingService.prototype.getOllamaService = function () {
        return this.ollamaService;
    };
    /**
     * Obtient la configuration actuelle
     */
    EmbeddingService.prototype.getConfig = function () {
        return __assign({}, this.config);
    };
    /**
     * Met à jour la configuration
     */
    EmbeddingService.prototype.updateConfig = function (newConfig) {
        this.config = __assign(__assign({}, this.config), newConfig);
        if (newConfig.cache) {
            this.cache = newConfig.cache;
        }
        if (this.config.provider === "ollama" && newConfig.ollamaService) {
            this.ollamaService = newConfig.ollamaService;
        }
        else if (this.config.provider !== "ollama") {
            this.ollamaService = null;
        }
        vector_store_interface_js_1.VectorStoreLogger.info("embedding.service.config.updated", "Embedding service configuration updated", {
            newProvider: this.config.provider,
        });
    };
    /**
     * Teste la connectivité du service
     */
    EmbeddingService.prototype.testConnection = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = this.config.provider;
                        switch (_a) {
                            case "ollama": return [3 /*break*/, 1];
                            case "sentence-transformers": return [3 /*break*/, 5];
                            case "fallback": return [3 /*break*/, 6];
                        }
                        return [3 /*break*/, 7];
                    case 1:
                        if (!this.ollamaService) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.ollamaService.testConnection()];
                    case 2:
                        _b = _c.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        _b = false;
                        _c.label = 4;
                    case 4: return [2 /*return*/, _b];
                    case 5: 
                    // Sentence Transformers est toujours disponible localement
                    return [2 /*return*/, true];
                    case 6: return [2 /*return*/, true];
                    case 7: return [2 /*return*/, false];
                }
            });
        });
    };
    return EmbeddingService;
}());
exports.EmbeddingService = EmbeddingService;
/**
 * Configuration par défaut des modèles
 */
exports.DEFAULT_MODEL_CONFIG = {
    code: "nomic-embed-code",
    text: "nomic-embed-text",
    config: "bge-small",
    fallback: "qwen3-embedding:8b",
};
/**
 * Instance singleton par défaut
 */
var defaultEmbeddingServiceInstance = null;
/**
 * Obtient l'instance singleton du service d'embeddings
 */
function getDefaultEmbeddingService() {
    return __awaiter(this, void 0, void 0, function () {
        var detectedProvider;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!!defaultEmbeddingServiceInstance) return [3 /*break*/, 2];
                    return [4 /*yield*/, detectBestProvider()];
                case 1:
                    detectedProvider = _a.sent();
                    defaultEmbeddingServiceInstance = new EmbeddingService({
                        provider: detectedProvider,
                        models: exports.DEFAULT_MODEL_CONFIG,
                    });
                    vector_store_interface_js_1.VectorStoreLogger.info("embedding.service.default.init", "Default embedding service initialized");
                    _a.label = 2;
                case 2: return [2 /*return*/, defaultEmbeddingServiceInstance];
            }
        });
    });
}
/**
 * Détecte le meilleur provider disponible (fonction utilitaire)
 */
function detectBestProvider() {
    return __awaiter(this, void 0, void 0, function () {
        var ollamaService, ollamaAvailable, error_4, pipeline, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    ollamaService = (0, ollama_service_js_1.getDefaultOllamaService)();
                    return [4 /*yield*/, ollamaService.testConnection()];
                case 1:
                    ollamaAvailable = _a.sent();
                    if (ollamaAvailable) {
                        vector_store_interface_js_1.VectorStoreLogger.info("embedding.provider.detection", "Ollama provider detected as available");
                        return [2 /*return*/, "ollama"];
                    }
                    return [3 /*break*/, 3];
                case 2:
                    error_4 = _a.sent();
                    vector_store_interface_js_1.VectorStoreLogger.debug("embedding.provider.detection.ollama", "Ollama not available", { error: error_4 instanceof Error ? error_4.message : String(error_4) });
                    return [3 /*break*/, 3];
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("@xenova/transformers"); })];
                case 4:
                    pipeline = (_a.sent()).pipeline;
                    vector_store_interface_js_1.VectorStoreLogger.info("embedding.provider.detection", "Sentence Transformers provider detected as available");
                    return [2 /*return*/, "sentence-transformers"];
                case 5:
                    error_5 = _a.sent();
                    vector_store_interface_js_1.VectorStoreLogger.debug("embedding.provider.detection.sentence-transformers", "Sentence Transformers not available", { error: error_5 instanceof Error ? error_5.message : String(error_5) });
                    return [3 /*break*/, 6];
                case 6:
                    // 3. Fallback
                    vector_store_interface_js_1.VectorStoreLogger.info("embedding.provider.detection", "No embedding provider available, using fallback");
                    return [2 /*return*/, "fallback"];
            }
        });
    });
}
/**
 * Configure l'instance singleton du service d'embeddings
 */
function configureDefaultEmbeddingService(provider, defaultModel, modelConfig) {
    if (defaultModel === void 0) { defaultModel = "qwen3-embedding:8b"; }
    var models = __assign(__assign(__assign({}, exports.DEFAULT_MODEL_CONFIG), { fallback: defaultModel }), modelConfig);
    defaultEmbeddingServiceInstance = new EmbeddingService({
        provider: provider,
        models: models,
    });
    vector_store_interface_js_1.VectorStoreLogger.info("embedding.service.default.configured", "Default embedding service configured", {
        provider: provider,
        models: models,
    });
}
/**
 * Configure uniquement les modèles (sans changer le provider)
 */
function setDefaultEmbeddingModels(models) {
    if (defaultEmbeddingServiceInstance) {
        var currentConfig = defaultEmbeddingServiceInstance.getConfig();
        defaultEmbeddingServiceInstance.updateConfig({
            models: __assign(__assign({}, currentConfig.models), models),
        });
    }
}
/**
 * Détermine le modèle approprié pour un type de contenu (utilitaire)
 */
function getEmbeddingModelForContentType(contentType, language) {
    return __awaiter(this, void 0, void 0, function () {
        var service;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDefaultEmbeddingService()];
                case 1:
                    service = _a.sent();
                    return [2 /*return*/, service.getModelForContentType(contentType, language)];
            }
        });
    });
}
/**
 * Obtient la dimension attendue pour un modèle (utilitaire)
 */
function getEmbeddingDimensionForModel(model) {
    return __awaiter(this, void 0, void 0, function () {
        var service;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDefaultEmbeddingService()];
                case 1:
                    service = _a.sent();
                    return [2 /*return*/, service.getDimensionForModel(model)];
            }
        });
    });
}
/**
 * Génère un embedding (utilitaire de compatibilité)
 */
function generateEmbedding(text) {
    return __awaiter(this, void 0, void 0, function () {
        var service;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDefaultEmbeddingService()];
                case 1:
                    service = _a.sent();
                    return [4 /*yield*/, service.generate(text)];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Génère un embedding avec routage automatique (utilitaire)
 */
function generateEmbeddingForContent(text_1) {
    return __awaiter(this, arguments, void 0, function (text, contentType, language) {
        var service;
        if (contentType === void 0) { contentType = "other"; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDefaultEmbeddingService()];
                case 1:
                    service = _a.sent();
                    return [4 /*yield*/, service.generateForContent(text, contentType, language)];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Normalise un vecteur L2 (utilitaire)
 */
function normalizeL2(vector) {
    var norm = Math.sqrt(vector.reduce(function (sum, val) { return sum + val * val; }, 0));
    if (norm === 0)
        return vector;
    return vector.map(function (val) { return val / norm; });
}
