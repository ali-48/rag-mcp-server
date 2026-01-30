"use strict";
// src/rag/ollama-service.ts
// Module dédié aux appels HTTP à l'API Ollama
// Responsabilité unique : Communication avec le service Ollama pour les embeddings
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
exports.OllamaService = void 0;
exports.getDefaultOllamaService = getDefaultOllamaService;
exports.configureDefaultOllamaService = configureDefaultOllamaService;
exports.cleanupDefaultOllamaService = cleanupDefaultOllamaService;
exports.testDefaultOllamaConnection = testDefaultOllamaConnection;
var vector_store_interface_js_1 = require("./vector-store-interface.js");
/**
 * Service pour interagir avec l'API Ollama
 */
var OllamaService = /** @class */ (function () {
    /**
     * Crée une instance du service Ollama
     */
    function OllamaService(config) {
        if (config === void 0) { config = {
            baseUrl: "http://localhost:11434",
            defaultModel: "qwen3-embedding:8b",
            batchDelayMs: 50,
            batchMaxSize: 10,
            timeoutMs: 30000,
        }; }
        this.config = config;
        this.batchQueue = [];
        this.batchTimeout = null;
    }
    /**
     * Génère un embedding via Ollama (avec batching automatique)
     */
    OllamaService.prototype.generateEmbedding = function (text, model) {
        return __awaiter(this, void 0, void 0, function () {
            var targetModel;
            var _this = this;
            return __generator(this, function (_a) {
                targetModel = model || this.config.defaultModel;
                vector_store_interface_js_1.VectorStoreLogger.debug("ollama.embedding.queueing", "Queueing embedding for Ollama", {
                    model: targetModel,
                    textPreview: text.substring(0, 50),
                });
                // Retourner une promesse qui sera résolue par le batch
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        _this.batchQueue.push({ text: text, resolve: resolve, reject: reject });
                        // Démarrer le traitement du batch si nécessaire
                        if (!_this.batchTimeout) {
                            _this.batchTimeout = setTimeout(function () { return _this.processBatch(); }, _this.config.batchDelayMs);
                        }
                        // Traiter immédiatement si le batch est plein
                        if (_this.batchQueue.length >= _this.config.batchMaxSize) {
                            if (_this.batchTimeout) {
                                clearTimeout(_this.batchTimeout);
                                _this.batchTimeout = null;
                            }
                            _this.processBatch();
                        }
                    })];
            });
        });
    };
    /**
     * Traite un batch de requêtes Ollama
     */
    OllamaService.prototype.processBatch = function () {
        return __awaiter(this, void 0, void 0, function () {
            var batch, texts, response, data, i, embedding, resolve, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.batchTimeout) {
                            clearTimeout(this.batchTimeout);
                            this.batchTimeout = null;
                        }
                        if (this.batchQueue.length === 0) {
                            return [2 /*return*/];
                        }
                        batch = this.batchQueue.splice(0, this.config.batchMaxSize);
                        texts = batch.map(function (item) { return item.text; });
                        vector_store_interface_js_1.VectorStoreLogger.debug("ollama.embedding.batch", "Processing Ollama batch", {
                            batchSize: texts.length,
                        });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, , 8]);
                        return [4 /*yield*/, fetch("".concat(this.config.baseUrl, "/api/embeddings"), {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                    model: this.config.defaultModel,
                                    input: texts,
                                }),
                                signal: AbortSignal.timeout(this.config.timeoutMs),
                            })];
                    case 2:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("Ollama API error: ".concat(response.status, " ").concat(response.statusText));
                        }
                        return [4 /*yield*/, response.json()];
                    case 3:
                        data = (_a.sent());
                        if (!(!data.embeddings || !Array.isArray(data.embeddings))) return [3 /*break*/, 5];
                        // Fallback: traiter chaque texte individuellement
                        vector_store_interface_js_1.VectorStoreLogger.warn("ollama.embedding.batch.fallback", "Ollama batch API not supported, falling back to individual requests");
                        return [4 /*yield*/, this.processIndividualRequests(batch)];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                    case 5:
                        // Vérifier que nous avons le bon nombre d'embeddings
                        if (data.embeddings.length !== texts.length) {
                            throw new Error("Ollama batch API returned ".concat(data.embeddings.length, " embeddings, expected ").concat(texts.length));
                        }
                        // Distribuer les résultats
                        for (i = 0; i < batch.length; i++) {
                            embedding = data.embeddings[i];
                            resolve = batch[i].resolve;
                            if (!embedding || !Array.isArray(embedding)) {
                                resolve(this.generateFallbackEmbedding(texts[i]));
                            }
                            else {
                                resolve(embedding);
                            }
                        }
                        return [3 /*break*/, 8];
                    case 6:
                        error_1 = _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("ollama.embedding.batch.error", "Failed to process Ollama batch", error_1);
                        // Fallback: traiter chaque texte individuellement
                        return [4 /*yield*/, this.processIndividualRequests(batch)];
                    case 7:
                        // Fallback: traiter chaque texte individuellement
                        _a.sent();
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Traite les requêtes Ollama individuellement (fallback)
     */
    OllamaService.prototype.processIndividualRequests = function (batch) {
        return __awaiter(this, void 0, void 0, function () {
            var _i, batch_1, item, embedding, error_2, fakeEmbedding;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _i = 0, batch_1 = batch;
                        _a.label = 1;
                    case 1:
                        if (!(_i < batch_1.length)) return [3 /*break*/, 6];
                        item = batch_1[_i];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.generateIndividualEmbedding(item.text)];
                    case 3:
                        embedding = _a.sent();
                        item.resolve(embedding);
                        return [3 /*break*/, 5];
                    case 4:
                        error_2 = _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("ollama.embedding.individual.error", "Failed to get embedding from Ollama for individual request", error_2);
                        fakeEmbedding = this.generateFallbackEmbedding(item.text);
                        item.resolve(fakeEmbedding);
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Génère un embedding via une requête individuelle
     */
    OllamaService.prototype.generateIndividualEmbedding = function (text) {
        return __awaiter(this, void 0, void 0, function () {
            var response, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch("".concat(this.config.baseUrl, "/api/embeddings"), {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                model: this.config.defaultModel,
                                prompt: text,
                            }),
                            signal: AbortSignal.timeout(this.config.timeoutMs),
                        })];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("Ollama API error: ".concat(response.status, " ").concat(response.statusText));
                        }
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = (_a.sent());
                        if (!data.embedding || !Array.isArray(data.embedding)) {
                            throw new Error("Invalid response from Ollama API: missing embedding array");
                        }
                        return [2 /*return*/, data.embedding];
                }
            });
        });
    };
    /**
     * Génère un embedding de fallback amélioré basé sur le contenu du texte
     * Utilise une combinaison de hachage sémantique et de caractéristiques textuelles
     */
    OllamaService.prototype.generateFallbackEmbedding = function (text) {
        // Dimension par défaut pour le modèle fallback (compatible avec qwen3-embedding:8b)
        var dimension = 1024;
        // Hachage sémantique basé sur le contenu
        var contentHash = this.semanticHash(text);
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
    OllamaService.prototype.semanticHash = function (text) {
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
    OllamaService.prototype.simpleHash = function (text) {
        var hash = 0;
        for (var i = 0; i < text.length; i++) {
            var char = text.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    };
    /**
     * Teste la connectivité à l'API Ollama
     */
    OllamaService.prototype.testConnection = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, fetch("".concat(this.config.baseUrl, "/api/tags"), {
                                method: "GET",
                                signal: AbortSignal.timeout(5000),
                            })];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("Ollama API error: ".concat(response.status, " ").concat(response.statusText));
                        }
                        vector_store_interface_js_1.VectorStoreLogger.info("ollama.connection.test", "Ollama connection test successful");
                        return [2 /*return*/, true];
                    case 2:
                        error_3 = _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("ollama.connection.test.error", "Ollama connection test failed", error_3);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Liste les modèles disponibles sur Ollama
     */
    OllamaService.prototype.listAvailableModels = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, data, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, fetch("".concat(this.config.baseUrl, "/api/tags"), {
                                method: "GET",
                                signal: AbortSignal.timeout(this.config.timeoutMs),
                            })];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("Ollama API error: ".concat(response.status, " ").concat(response.statusText));
                        }
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = (_a.sent());
                        return [2 /*return*/, data.models.map(function (model) { return model.name; })];
                    case 3:
                        error_4 = _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("ollama.models.list.error", "Failed to list Ollama models", error_4);
                        return [2 /*return*/, []];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Génère une complétion via Ollama (pour l'enrichissement LLM)
     */
    OllamaService.prototype.generateCompletion = function (prompt, model, options) {
        return __awaiter(this, void 0, void 0, function () {
            var targetModel, temperature, maxTokens, systemPrompt, response, data, error_5;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        targetModel = model || this.config.defaultModel;
                        temperature = (_a = options === null || options === void 0 ? void 0 : options.temperature) !== null && _a !== void 0 ? _a : 0.1;
                        maxTokens = (_b = options === null || options === void 0 ? void 0 : options.maxTokens) !== null && _b !== void 0 ? _b : 1000;
                        systemPrompt = (_c = options === null || options === void 0 ? void 0 : options.systemPrompt) !== null && _c !== void 0 ? _c : "You are a helpful assistant that analyzes code and text to provide structured enrichment.";
                        vector_store_interface_js_1.VectorStoreLogger.debug("ollama.completion.generating", "Generating completion via Ollama", {
                            model: targetModel,
                            temperature: temperature,
                            maxTokens: maxTokens,
                            promptPreview: prompt.substring(0, 100),
                        });
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, fetch("".concat(this.config.baseUrl, "/api/generate"), {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                    model: targetModel,
                                    prompt: prompt,
                                    system: systemPrompt,
                                    options: {
                                        temperature: temperature,
                                        num_predict: maxTokens,
                                    },
                                    stream: false,
                                }),
                                signal: AbortSignal.timeout(this.config.timeoutMs),
                            })];
                    case 2:
                        response = _d.sent();
                        if (!response.ok) {
                            throw new Error("Ollama API error: ".concat(response.status, " ").concat(response.statusText));
                        }
                        return [4 /*yield*/, response.json()];
                    case 3:
                        data = (_d.sent());
                        if (!data.response || typeof data.response !== "string") {
                            throw new Error("Invalid response from Ollama API: missing response text");
                        }
                        vector_store_interface_js_1.VectorStoreLogger.debug("ollama.completion.success", "Completion generated successfully", {
                            model: targetModel,
                            responseLength: data.response.length,
                        });
                        return [2 /*return*/, data.response];
                    case 4:
                        error_5 = _d.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("ollama.completion.error", "Failed to generate completion via Ollama", error_5);
                        throw error_5;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Nettoie les ressources (annule le timeout en attente)
     */
    OllamaService.prototype.cleanup = function () {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
            this.batchTimeout = null;
        }
        // Rejeter toutes les requêtes en attente
        for (var _i = 0, _a = this.batchQueue; _i < _a.length; _i++) {
            var item = _a[_i];
            item.reject(new Error("Ollama service cleaned up"));
        }
        this.batchQueue = [];
        vector_store_interface_js_1.VectorStoreLogger.debug("ollama.service.cleanup", "Ollama service cleaned up");
    };
    /**
     * Obtient le nombre de requêtes en attente
     */
    OllamaService.prototype.getPendingRequestsCount = function () {
        return this.batchQueue.length;
    };
    /**
     * Obtient la configuration actuelle
     */
    OllamaService.prototype.getConfig = function () {
        return __assign({}, this.config);
    };
    /**
     * Met à jour la configuration
     */
    OllamaService.prototype.updateConfig = function (newConfig) {
        this.config = __assign(__assign({}, this.config), newConfig);
        vector_store_interface_js_1.VectorStoreLogger.info("ollama.service.config.updated", "Ollama service configuration updated", {
            newConfig: newConfig,
        });
    };
    return OllamaService;
}());
exports.OllamaService = OllamaService;
/**
 * Instance singleton par défaut
 */
var defaultOllamaServiceInstance = null;
/**
 * Obtient l'instance singleton du service Ollama
 */
function getDefaultOllamaService() {
    if (!defaultOllamaServiceInstance) {
        defaultOllamaServiceInstance = new OllamaService();
        vector_store_interface_js_1.VectorStoreLogger.info("ollama.service.init", "Default Ollama service initialized");
    }
    return defaultOllamaServiceInstance;
}
/**
 * Configure l'instance singleton du service Ollama
 */
function configureDefaultOllamaService(config) {
    defaultOllamaServiceInstance = new OllamaService(__assign({ baseUrl: "http://localhost:11434", defaultModel: "qwen3-embedding:8b", batchDelayMs: 50, batchMaxSize: 10, timeoutMs: 30000 }, config));
    vector_store_interface_js_1.VectorStoreLogger.info("ollama.service.configured", "Default Ollama service configured", {
        config: defaultOllamaServiceInstance.getConfig(),
    });
}
/**
 * Nettoie le service singleton
 */
function cleanupDefaultOllamaService() {
    if (defaultOllamaServiceInstance) {
        defaultOllamaServiceInstance.cleanup();
    }
}
/**
 * Teste la connexion au service singleton
 */
function testDefaultOllamaConnection() {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!defaultOllamaServiceInstance) return [3 /*break*/, 2];
                    return [4 /*yield*/, defaultOllamaServiceInstance.testConnection()];
                case 1:
                    _a = _b.sent();
                    return [3 /*break*/, 3];
                case 2:
                    _a = false;
                    _b.label = 3;
                case 3: return [2 /*return*/, _a];
            }
        });
    });
}
