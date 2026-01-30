"use strict";
// src/rag/vector-store-adapter.ts
// Adaptateur pour l'interface IVectorStore avec injection de dépendances
// Responsabilité unique : Adapter pattern entre les nouveaux modules et l'interface existante
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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEmbedding = exports.generateEmbeddingForContent = exports.getEmbeddingDimensionForModel = exports.getEmbeddingModelForContentType = exports.VectorStoreAdapter = void 0;
exports.configureVectorStore = configureVectorStore;
exports.setEmbeddingProvider = setEmbeddingProvider;
exports.setEmbeddingModels = setEmbeddingModels;
exports.embedAndStore = embedAndStore;
exports.semanticSearch = semanticSearch;
exports.getProjectStats = getProjectStats;
exports.listProjects = listProjects;
exports.deleteDocument = deleteDocument;
exports.clearAll = clearAll;
exports.getStats = getStats;
exports.testConnection = testConnection;
exports.updateDocument = updateDocument;
exports.hybridSearch = hybridSearch;
exports.searchByMetadata = searchByMetadata;
exports.deleteDocumentsByPattern = deleteDocumentsByPattern;
exports.initialize = initialize;
exports.close = close;
exports.clearEmbeddingCache = clearEmbeddingCache;
exports.getEmbeddingCacheStats = getEmbeddingCacheStats;
var embedding_service_js_1 = require("./embedding-service.js");
var vector_store_factory_js_1 = require("./vector-store-factory.js");
var vector_store_interface_js_1 = require("./vector-store-interface.js");
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
var VectorStoreAdapter = /** @class */ (function () {
    /**
     * Crée un adaptateur avec injection de dépendances
     */
    function VectorStoreAdapter(vectorStore, embeddingService) {
        this.vectorStore = vectorStore;
        // Si aucun service n'est fourni, utiliser le service par défaut
        if (embeddingService) {
            this.embeddingService = embeddingService;
        }
        else {
            // Initialiser avec une promesse qui sera résolue plus tard
            this.embeddingService = null;
            this.initializeEmbeddingService();
        }
        vector_store_interface_js_1.VectorStoreLogger.info("vectorstore.adapter.init", "Vector store adapter initialized", {
            hasCustomEmbeddingService: !!embeddingService,
        });
    }
    /**
     * Initialise le service d'embeddings de manière asynchrone
     */
    VectorStoreAdapter.prototype.initializeEmbeddingService = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        _a = this;
                        return [4 /*yield*/, (0, embedding_service_js_1.getDefaultEmbeddingService)()];
                    case 1:
                        _a.embeddingService = _b.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _b.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("vectorstore.adapter.embedding.init.error", "Erreur lors de l'initialisation du service d'embeddings", error_1);
                        throw error_1;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Stocke un document avec son embedding
     */
    VectorStoreAdapter.prototype.embedAndStore = function (projectPath_1, filePath_1, content_1, embedding_1) {
        return __awaiter(this, arguments, void 0, function (projectPath, filePath, content, embedding, options) {
            var _a, chunkIndex, _b, totalChunks, _c, contentType, _d, role, _e, fileExtension, _f, language, _g, linesCount, _h, isCompressed, error_2;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        _a = options.chunkIndex, chunkIndex = _a === void 0 ? 0 : _a, _b = options.totalChunks, totalChunks = _b === void 0 ? 1 : _b, _c = options.contentType, contentType = _c === void 0 ? "other" : _c, _d = options.role, role = _d === void 0 ? null : _d, _e = options.fileExtension, fileExtension = _e === void 0 ? null : _e, _f = options.language, language = _f === void 0 ? null : _f, _g = options.linesCount, linesCount = _g === void 0 ? null : _g, _h = options.isCompressed, isCompressed = _h === void 0 ? false : _h;
                        _j.label = 1;
                    case 1:
                        _j.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.vectorStore.embedAndStore(projectPath, filePath, content, embedding, {
                                chunkIndex: chunkIndex,
                                totalChunks: totalChunks,
                                contentType: contentType,
                                role: role || undefined,
                                fileExtension: fileExtension || undefined,
                                language: language || undefined,
                                linesCount: linesCount || undefined,
                                isCompressed: isCompressed,
                            })];
                    case 2:
                        _j.sent();
                        vector_store_interface_js_1.VectorStoreLogger.info("vectorstore.store", "Document stocké", {
                            projectPath: projectPath,
                            filePath: filePath,
                            contentType: contentType,
                            chunkIndex: chunkIndex,
                            totalChunks: totalChunks,
                        });
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _j.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("vectorstore.store.error", "Erreur lors du stockage du document", error_2, {
                            projectPath: projectPath,
                            filePath: filePath,
                        });
                        throw error_2;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Recherche sémantique par similarité cosinus
     */
    VectorStoreAdapter.prototype.semanticSearch = function (queryEmbedding_1) {
        return __awaiter(this, arguments, void 0, function (queryEmbedding, options) {
            var projectFilter, _a, limit, _b, threshold, _c, dynamicThreshold, contentTypeFilter, roleFilter, languageFilter, minFileSizeBytes, maxFileSizeBytes, minLinesCount, maxLinesCount, dateFrom, dateTo, results, error_3;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        projectFilter = options.projectFilter, _a = options.limit, limit = _a === void 0 ? 10 : _a, _b = options.threshold, threshold = _b === void 0 ? 0.3 : _b, _c = options.dynamicThreshold, dynamicThreshold = _c === void 0 ? false : _c, contentTypeFilter = options.contentTypeFilter, roleFilter = options.roleFilter, languageFilter = options.languageFilter, minFileSizeBytes = options.minFileSizeBytes, maxFileSizeBytes = options.maxFileSizeBytes, minLinesCount = options.minLinesCount, maxLinesCount = options.maxLinesCount, dateFrom = options.dateFrom, dateTo = options.dateTo;
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.vectorStore.semanticSearch(queryEmbedding, {
                                projectFilter: projectFilter,
                                limit: limit,
                                threshold: threshold,
                                dynamicThreshold: dynamicThreshold,
                                contentTypeFilter: contentTypeFilter,
                                roleFilter: roleFilter,
                                languageFilter: languageFilter,
                                minFileSizeBytes: minFileSizeBytes,
                                maxFileSizeBytes: maxFileSizeBytes,
                                minLinesCount: minLinesCount,
                                maxLinesCount: maxLinesCount,
                                dateFrom: dateFrom,
                                dateTo: dateTo,
                            })];
                    case 2:
                        results = _d.sent();
                        // Convertir les résultats au format attendu
                        return [2 /*return*/, results.map(convertSearchResult)];
                    case 3:
                        error_3 = _d.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("vectorstore.search.error", "Erreur lors de la recherche sémantique", error_3);
                        throw error_3;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Supprime un document par son ID
     */
    VectorStoreAdapter.prototype.deleteDocument = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var result, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.vectorStore.deleteDocument(id)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result];
                    case 2:
                        error_4 = _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("vectorstore.delete.error", "Erreur lors de la suppression du document", error_4, {
                            id: id,
                        });
                        throw error_4;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Supprime les documents correspondant à un pattern (LIKE)
     */
    VectorStoreAdapter.prototype.deleteDocumentsByPattern = function (pattern) {
        return __awaiter(this, void 0, void 0, function () {
            var result, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.vectorStore.deleteDocumentsByPattern(pattern)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result];
                    case 2:
                        error_5 = _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("vectorstore.delete.pattern.error", "Erreur lors de la suppression avec pattern", error_5, {
                            pattern: pattern,
                        });
                        throw error_5;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Obtient les statistiques d'un projet spécifique
     */
    VectorStoreAdapter.prototype.getProjectStats = function (projectPath) {
        return __awaiter(this, void 0, void 0, function () {
            var error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.vectorStore.getProjectStats(projectPath)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_6 = _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("vectorstore.stats.error", "Erreur lors de la récupération des stats", error_6, {
                            projectPath: projectPath,
                        });
                        throw error_6;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Liste tous les projets indexés
     */
    VectorStoreAdapter.prototype.listProjects = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.vectorStore.listProjects()];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_7 = _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("vectorstore.list.error", "Erreur lors du listing des projets", error_7);
                        throw error_7;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Obtient les statistiques globales du store
     */
    VectorStoreAdapter.prototype.getStats = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_8;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.vectorStore.getStats()];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_8 = _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("vectorstore.stats.global.error", "Erreur lors de la récupération des statistiques globales", error_8);
                        throw error_8;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Vide complètement le store (pour les tests)
     */
    VectorStoreAdapter.prototype.clearAll = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_9;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.vectorStore.clearAll()];
                    case 1:
                        _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.info("vectorstore.clear", "Tous les documents ont été supprimés");
                        return [3 /*break*/, 3];
                    case 2:
                        error_9 = _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("vectorstore.clear.error", "Erreur lors du vidage des documents", error_9);
                        throw error_9;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Initialise les tables/schémas si nécessaire
     */
    VectorStoreAdapter.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_10;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.vectorStore.initialize()];
                    case 1:
                        _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.info("vectorstore.initialize", "Vector store initialisé");
                        return [3 /*break*/, 3];
                    case 2:
                        error_10 = _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("vectorstore.initialize.error", "Erreur lors de l'initialisation du vector store", error_10);
                        throw error_10;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Vérifie la connectivité au backend
     */
    VectorStoreAdapter.prototype.testConnection = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_11;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.vectorStore.testConnection()];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_11 = _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("vectorstore.test.error", "Erreur lors du test de connexion", error_11);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Met à jour un document existant
     */
    VectorStoreAdapter.prototype.updateDocument = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var error_12;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.vectorStore.updateDocument(id, updates)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_12 = _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("vectorstore.update.error", "Erreur lors de la mise à jour du document", error_12, {
                            id: id,
                        });
                        throw error_12;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Recherche hybride (sémantique + textuelle)
     */
    VectorStoreAdapter.prototype.hybridSearch = function (queryEmbedding_1, textQuery_1) {
        return __awaiter(this, arguments, void 0, function (queryEmbedding, textQuery, options) {
            var _a, semanticWeight, _b, textWeight, semanticOptions, results, error_13;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = options.semanticWeight, semanticWeight = _a === void 0 ? 0.7 : _a, _b = options.textWeight, textWeight = _b === void 0 ? 0.3 : _b, semanticOptions = __rest(options, ["semanticWeight", "textWeight"]);
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 5, , 6]);
                        if (!this.vectorStore.hybridSearch) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.vectorStore.hybridSearch(queryEmbedding, textQuery, __assign(__assign({}, semanticOptions), { semanticWeight: semanticWeight, textWeight: textWeight }))];
                    case 2:
                        results = _c.sent();
                        return [2 /*return*/, results.map(convertSearchResult)];
                    case 3:
                        // Sinon, fallback sur la recherche sémantique
                        vector_store_interface_js_1.VectorStoreLogger.warn("vectorstore.hybrid.fallback", "Recherche hybride non supportée, fallback sur recherche sémantique");
                        return [4 /*yield*/, this.semanticSearch(queryEmbedding, semanticOptions)];
                    case 4: return [2 /*return*/, _c.sent()];
                    case 5:
                        error_13 = _c.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("vectorstore.hybrid.error", "Erreur lors de la recherche hybride", error_13);
                        throw error_13;
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Recherche par métadonnées
     */
    VectorStoreAdapter.prototype.searchByMetadata = function (filters) {
        return __awaiter(this, void 0, void 0, function () {
            var results, semanticOptions, error_14;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 4, , 5]);
                        if (!this.vectorStore.searchByMetadata) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.vectorStore.searchByMetadata(filters)];
                    case 1:
                        results = _c.sent();
                        return [2 /*return*/, results.map(convertSearchResult)];
                    case 2:
                        // Sinon, fallback sur la recherche sémantique avec filtres
                        vector_store_interface_js_1.VectorStoreLogger.warn("vectorstore.metadata.fallback", "Recherche par métadonnées non supportée, fallback sur recherche sémantique");
                        semanticOptions = {
                            projectFilter: filters.projectPath,
                            contentTypeFilter: filters.contentType
                                ? [filters.contentType]
                                : undefined,
                            roleFilter: filters.role ? [filters.role] : undefined,
                            languageFilter: filters.language ? [filters.language] : undefined,
                            dateFrom: (_a = filters.dateRange) === null || _a === void 0 ? void 0 : _a.from,
                            dateTo: (_b = filters.dateRange) === null || _b === void 0 ? void 0 : _b.to,
                        };
                        return [4 /*yield*/, this.semanticSearch([], semanticOptions)];
                    case 3: 
                    // Recherche sémantique avec une requête vide (tous les résultats)
                    return [2 /*return*/, _c.sent()];
                    case 4:
                        error_14 = _c.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("vectorstore.metadata.error", "Erreur lors de la recherche par métadonnées", error_14, {
                            filters: filters,
                        });
                        throw error_14;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Obtient l'instance de vector store sous-jacente
     */
    VectorStoreAdapter.prototype.getUnderlyingVectorStore = function () {
        return this.vectorStore;
    };
    /**
     * Obtient l'instance du service d'embeddings
     */
    VectorStoreAdapter.prototype.getEmbeddingService = function () {
        return this.embeddingService;
    };
    /**
     * Met à jour le service d'embeddings
     */
    VectorStoreAdapter.prototype.setEmbeddingService = function (service) {
        this.embeddingService = service;
        vector_store_interface_js_1.VectorStoreLogger.info("vectorstore.adapter.embedding-service.updated", "Embedding service updated in adapter");
    };
    return VectorStoreAdapter;
}());
exports.VectorStoreAdapter = VectorStoreAdapter;
// ========== FONCTIONS D'UTILITÉ POUR LA COMPATIBILITÉ ==========
/**
 * Instance singleton de l'adaptateur
 */
var adapterInstance = null;
/**
 * Obtient l'instance de vector store (singleton)
 */
function getVectorStore() {
    return __awaiter(this, void 0, void 0, function () {
        var vectorStore;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!adapterInstance) {
                        vectorStore = (0, vector_store_factory_js_1.createVectorStoreForProject)(process.cwd());
                        adapterInstance = new VectorStoreAdapter(vectorStore);
                        vector_store_interface_js_1.VectorStoreLogger.info("vectorstore.init", "Vector store initialisé", {
                            type: "dynamic",
                            projectPath: process.cwd(),
                        });
                    }
                    if (!!adapterInstance.getEmbeddingService()) return [3 /*break*/, 2];
                    return [4 /*yield*/, adapterInstance.initializeEmbeddingService()];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2: return [2 /*return*/, adapterInstance];
            }
        });
    });
}
/**
 * Configure explicitement le vector store avec une configuration spécifique
 */
function configureVectorStore(config) {
    var vectorStore = (0, vector_store_factory_js_1.createVectorStore)(config);
    adapterInstance = new VectorStoreAdapter(vectorStore);
    vector_store_interface_js_1.VectorStoreLogger.info("vectorstore.configure", "Vector store configuré", {
        type: config.type,
    });
}
/**
 * Configure le fournisseur d'embeddings avec support multi-modèles
 */
function setEmbeddingProvider(provider, defaultModel, modelConfig) {
    if (defaultModel === void 0) { defaultModel = "qwen3-embedding:8b"; }
    (0, embedding_service_js_1.configureDefaultEmbeddingService)(provider, defaultModel, modelConfig);
    vector_store_interface_js_1.VectorStoreLogger.info("embedding.provider.configured", "Embedding provider configured", {
        provider: provider,
        defaultModel: defaultModel,
    });
}
/**
 * Configure uniquement les modèles (sans changer le provider)
 */
function setEmbeddingModels(models) {
    (0, embedding_service_js_1.setDefaultEmbeddingModels)(models);
    vector_store_interface_js_1.VectorStoreLogger.info("embedding.models.updated", "Embedding models updated", {
        models: models,
    });
}
/**
 * Détermine le modèle approprié pour un type de contenu
 */
var embedding_service_js_2 = require("./embedding-service.js");
Object.defineProperty(exports, "getEmbeddingModelForContentType", { enumerable: true, get: function () { return embedding_service_js_2.getEmbeddingModelForContentType; } });
/**
 * Obtient la dimension attendue pour un modèle
 */
var embedding_service_js_3 = require("./embedding-service.js");
Object.defineProperty(exports, "getEmbeddingDimensionForModel", { enumerable: true, get: function () { return embedding_service_js_3.getEmbeddingDimensionForModel; } });
/**
 * Génère un embedding avec routage automatique par type de contenu
 */
var embedding_service_js_4 = require("./embedding-service.js");
Object.defineProperty(exports, "generateEmbeddingForContent", { enumerable: true, get: function () { return embedding_service_js_4.generateEmbeddingForContent; } });
/**
 * Génère un embedding selon le fournisseur configuré (compatibilité)
 */
var embedding_service_js_5 = require("./embedding-service.js");
Object.defineProperty(exports, "generateEmbedding", { enumerable: true, get: function () { return embedding_service_js_5.generateEmbedding; } });
/**
 * Stocke un document avec son embedding (fonction exportée)
 */
function embedAndStore(projectPath_1, filePath_1, content_1) {
    return __awaiter(this, arguments, void 0, function (projectPath, filePath, content, options) {
        var _a, contentType, language, vector, store;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = options.contentType, contentType = _a === void 0 ? "other" : _a, language = options.language;
                    return [4 /*yield*/, (0, embedding_service_js_1.generateEmbeddingForContent)(content, contentType, language || undefined)];
                case 1:
                    vector = _b.sent();
                    return [4 /*yield*/, getVectorStore()];
                case 2:
                    store = _b.sent();
                    return [4 /*yield*/, store.embedAndStore(projectPath, filePath, content, vector, options)];
                case 3:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Recherche sémantique (fonction exportée)
 */
function semanticSearch(query_1) {
    return __awaiter(this, arguments, void 0, function (query, options) {
        var queryVector, store;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, embedding_service_js_1.generateEmbeddingForContent)(query, "other")];
                case 1:
                    queryVector = _a.sent();
                    return [4 /*yield*/, getVectorStore()];
                case 2:
                    store = _a.sent();
                    return [4 /*yield*/, store.semanticSearch(queryVector, options)];
                case 3: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Obtient les statistiques d'un projet (fonction exportée)
 */
function getProjectStats(projectPath) {
    return __awaiter(this, void 0, void 0, function () {
        var store;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getVectorStore()];
                case 1:
                    store = _a.sent();
                    return [4 /*yield*/, store.getProjectStats(projectPath)];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Liste tous les projets indexés (fonction exportée)
 */
function listProjects() {
    return __awaiter(this, void 0, void 0, function () {
        var store;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getVectorStore()];
                case 1:
                    store = _a.sent();
                    return [4 /*yield*/, store.listProjects()];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Supprime un document par son ID (fonction exportée)
 */
function deleteDocument(id) {
    return __awaiter(this, void 0, void 0, function () {
        var store;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getVectorStore()];
                case 1:
                    store = _a.sent();
                    return [4 /*yield*/, store.deleteDocument(id)];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Vide tous les documents (pour les tests) (fonction exportée)
 */
function clearAll() {
    return __awaiter(this, void 0, void 0, function () {
        var store;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getVectorStore()];
                case 1:
                    store = _a.sent();
                    return [4 /*yield*/, store.clearAll()];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Obtient les statistiques globales du store (fonction exportée)
 */
function getStats() {
    return __awaiter(this, void 0, void 0, function () {
        var store;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getVectorStore()];
                case 1:
                    store = _a.sent();
                    return [4 /*yield*/, store.getStats()];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Teste la connectivité au vector store (fonction exportée)
 */
function testConnection() {
    return __awaiter(this, void 0, void 0, function () {
        var store;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getVectorStore()];
                case 1:
                    store = _a.sent();
                    return [4 /*yield*/, store.testConnection()];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Met à jour un document existant (fonction exportée)
 */
function updateDocument(id, updates) {
    return __awaiter(this, void 0, void 0, function () {
        var store;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getVectorStore()];
                case 1:
                    store = _a.sent();
                    return [4 /*yield*/, store.updateDocument(id, updates)];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Recherche hybride (sémantique + textuelle) (fonction exportée)
 */
function hybridSearch(query_1) {
    return __awaiter(this, arguments, void 0, function (query, options) {
        var _a, semanticWeight, _b, textWeight, textQuery, semanticOptions, store, queryVector;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = options.semanticWeight, semanticWeight = _a === void 0 ? 0.7 : _a, _b = options.textWeight, textWeight = _b === void 0 ? 0.3 : _b, textQuery = options.textQuery, semanticOptions = __rest(options, ["semanticWeight", "textWeight", "textQuery"]);
                    return [4 /*yield*/, getVectorStore()];
                case 1:
                    store = _c.sent();
                    return [4 /*yield*/, (0, embedding_service_js_1.generateEmbedding)(query)];
                case 2:
                    queryVector = _c.sent();
                    return [4 /*yield*/, store.hybridSearch(queryVector, textQuery || query, __assign(__assign({}, semanticOptions), { semanticWeight: semanticWeight, textWeight: textWeight }))];
                case 3: return [2 /*return*/, _c.sent()];
            }
        });
    });
}
/**
 * Recherche par métadonnées (fonction exportée)
 */
function searchByMetadata(filters) {
    return __awaiter(this, void 0, void 0, function () {
        var store;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getVectorStore()];
                case 1:
                    store = _a.sent();
                    return [4 /*yield*/, store.searchByMetadata(filters)];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Supprime les documents correspondant à un pattern (fonction exportée)
 */
function deleteDocumentsByPattern(pattern) {
    return __awaiter(this, void 0, void 0, function () {
        var store;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getVectorStore()];
                case 1:
                    store = _a.sent();
                    return [4 /*yield*/, store.deleteDocumentsByPattern(pattern)];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Initialise le vector store (fonction exportée)
 */
function initialize() {
    return __awaiter(this, void 0, void 0, function () {
        var store;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getVectorStore()];
                case 1:
                    store = _a.sent();
                    return [4 /*yield*/, store.initialize()];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Ferme proprement le vector store (fonction exportée)
 */
function close() {
    return __awaiter(this, void 0, void 0, function () {
        var cleanupDefaultOllamaService;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require("./ollama-service.js"); })];
                case 1:
                    cleanupDefaultOllamaService = (_a.sent()).cleanupDefaultOllamaService;
                    cleanupDefaultOllamaService();
                    vector_store_interface_js_1.VectorStoreLogger.info("vectorstore.close", "Vector store fermé");
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Vide le cache des embeddings (fonction exportée)
 */
function clearEmbeddingCache() {
    var clearDefaultEmbeddingCache = require("./embedding-cache.js").clearDefaultEmbeddingCache;
    clearDefaultEmbeddingCache();
}
/**
 * Obtient les statistiques du cache des embeddings (fonction exportée)
 */
function getEmbeddingCacheStats() {
    var getDefaultEmbeddingCacheStats = require("./embedding-cache.js").getDefaultEmbeddingCacheStats;
    return getDefaultEmbeddingCacheStats();
}
