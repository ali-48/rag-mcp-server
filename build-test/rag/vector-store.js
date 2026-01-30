"use strict";
// src/rag/vector-store.ts
// Version refactorisée utilisant les nouveaux modules dédiés
// Ce fichier sert maintenant de façade pour la compatibilité ascendante
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
exports.VectorStoreLogger = exports.getEmbeddingCacheStats = exports.clearEmbeddingCache = exports.generateEmbeddingForContent = exports.generateEmbedding = exports.getEmbeddingModelForContentType = exports.getEmbeddingDimensionForModel = exports.setEmbeddingProvider = exports.setEmbeddingModels = void 0;
exports.configureVectorStore = configureVectorStore;
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
exports.getModelForContentType = getModelForContentType;
exports.getDimensionForModel = getDimensionForModel;
exports.generateEmbeddingWithModel = generateEmbeddingWithModel;
exports.generateEmbeddingForContentType = generateEmbeddingForContentType;
var vector_store_interface_js_1 = require("./vector-store-interface.js");
Object.defineProperty(exports, "VectorStoreLogger", { enumerable: true, get: function () { return vector_store_interface_js_1.VectorStoreLogger; } });
// Import des nouveaux modules
var vector_store_adapter_js_1 = require("./vector-store-adapter.js");
Object.defineProperty(exports, "clearEmbeddingCache", { enumerable: true, get: function () { return vector_store_adapter_js_1.clearEmbeddingCache; } });
Object.defineProperty(exports, "generateEmbedding", { enumerable: true, get: function () { return vector_store_adapter_js_1.generateEmbedding; } });
Object.defineProperty(exports, "generateEmbeddingForContent", { enumerable: true, get: function () { return vector_store_adapter_js_1.generateEmbeddingForContent; } });
Object.defineProperty(exports, "getEmbeddingCacheStats", { enumerable: true, get: function () { return vector_store_adapter_js_1.getEmbeddingCacheStats; } });
Object.defineProperty(exports, "getEmbeddingDimensionForModel", { enumerable: true, get: function () { return vector_store_adapter_js_1.getEmbeddingDimensionForModel; } });
Object.defineProperty(exports, "getEmbeddingModelForContentType", { enumerable: true, get: function () { return vector_store_adapter_js_1.getEmbeddingModelForContentType; } });
Object.defineProperty(exports, "setEmbeddingModels", { enumerable: true, get: function () { return vector_store_adapter_js_1.setEmbeddingModels; } });
Object.defineProperty(exports, "setEmbeddingProvider", { enumerable: true, get: function () { return vector_store_adapter_js_1.setEmbeddingProvider; } });
// Instance singleton pour la compatibilité
var vectorStoreInstance = null;
/**
 * Obtient l'instance de vector store (singleton)
 * Utilise l'adaptateur avec les nouveaux modules
 */
function getVectorStore() {
    return __awaiter(this, void 0, void 0, function () {
        var createVectorStoreForProject, underlyingStore, getDefaultEmbeddingService, embeddingService;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!!vectorStoreInstance) return [3 /*break*/, 2];
                    createVectorStoreForProject = require("./vector-store-factory.js").createVectorStoreForProject;
                    underlyingStore = createVectorStoreForProject(process.cwd());
                    getDefaultEmbeddingService = require("./embedding-service.js").getDefaultEmbeddingService;
                    return [4 /*yield*/, getDefaultEmbeddingService()];
                case 1:
                    embeddingService = _a.sent();
                    vectorStoreInstance = new vector_store_adapter_js_1.VectorStoreAdapter(underlyingStore, embeddingService);
                    vector_store_interface_js_1.VectorStoreLogger.info("vectorstore.init", "Vector store initialisé (via adaptateur)", {
                        type: "adapter",
                        projectPath: process.cwd(),
                    });
                    _a.label = 2;
                case 2: return [2 /*return*/, vectorStoreInstance];
            }
        });
    });
}
/**
 * Configure explicitement le vector store avec une configuration spécifique
 * @param config Configuration du vector store
 */
function configureVectorStore(config) {
    (0, vector_store_adapter_js_1.configureVectorStore)(config);
    vector_store_interface_js_1.VectorStoreLogger.info("vectorstore.configure", "Vector store configuré (via adaptateur)", {
        type: config.type,
    });
}
// ========== FONCTIONS PRINCIPALES (COMPATIBILITÉ) ==========
/**
 * Stocke un document avec son embedding
 */
function embedAndStore(projectPath_1, filePath_1, content_1) {
    return __awaiter(this, arguments, void 0, function (projectPath, filePath, content, options) {
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, vector_store_adapter_js_1.embedAndStore)(projectPath, filePath, content, options)];
        });
    });
}
/**
 * Recherche sémantique
 */
function semanticSearch(query_1) {
    return __awaiter(this, arguments, void 0, function (query, options) {
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, vector_store_adapter_js_1.semanticSearch)(query, options)];
        });
    });
}
/**
 * Obtient les statistiques d'un projet
 */
function getProjectStats(projectPath) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, vector_store_adapter_js_1.getProjectStats)(projectPath)];
        });
    });
}
/**
 * Liste tous les projets indexés
 */
function listProjects() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, vector_store_adapter_js_1.listProjects)()];
        });
    });
}
/**
 * Supprime un document par son ID
 */
function deleteDocument(id) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, vector_store_adapter_js_1.deleteDocument)(id)];
        });
    });
}
/**
 * Vide tous les documents (pour les tests)
 */
function clearAll() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, vector_store_adapter_js_1.clearAll)()];
        });
    });
}
/**
 * Obtient les statistiques globales du store
 */
function getStats() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, vector_store_adapter_js_1.getStats)()];
        });
    });
}
/**
 * Teste la connectivité au vector store
 */
function testConnection() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, vector_store_adapter_js_1.testConnection)()];
        });
    });
}
/**
 * Met à jour un document existant
 */
function updateDocument(id, updates) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, vector_store_adapter_js_1.updateDocument)(id, updates)];
        });
    });
}
/**
 * Recherche hybride (sémantique + textuelle)
 */
function hybridSearch(query_1) {
    return __awaiter(this, arguments, void 0, function (query, options) {
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, vector_store_adapter_js_1.hybridSearch)(query, options)];
        });
    });
}
/**
 * Recherche par métadonnées
 */
function searchByMetadata(filters) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, vector_store_adapter_js_1.searchByMetadata)(filters)];
        });
    });
}
/**
 * Supprime les documents correspondant à un pattern
 */
function deleteDocumentsByPattern(pattern) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, vector_store_adapter_js_1.deleteDocumentsByPattern)(pattern)];
        });
    });
}
/**
 * Initialise le vector store
 */
function initialize() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, vector_store_adapter_js_1.initialize)()];
        });
    });
}
/**
 * Ferme proprement le vector store
 */
function close() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, vector_store_adapter_js_1.close)()];
        });
    });
}
// ========== FONCTIONS DÉPRÉCIÉES (MAINTENUES POUR COMPATIBILITÉ) ==========
/**
 * @deprecated Utilisez getEmbeddingModelForContentType à la place
 */
function getModelForContentType(contentType, language) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vector_store_adapter_js_1.getEmbeddingModelForContentType)(contentType, language)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * @deprecated Utilisez getEmbeddingDimensionForModel à la place
 */
function getDimensionForModel(model) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vector_store_adapter_js_1.getEmbeddingDimensionForModel)(model)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * @deprecated Utilisez generateEmbedding à la place
 */
function generateEmbeddingWithModel(text, model) {
    return __awaiter(this, void 0, void 0, function () {
        var getDefaultEmbeddingService, service;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    getDefaultEmbeddingService = require("./embedding-service.js").getDefaultEmbeddingService;
                    service = getDefaultEmbeddingService();
                    return [4 /*yield*/, service.generateWithModel(text, model)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * @deprecated Utilisez generateEmbeddingForContent à la place
 */
function generateEmbeddingForContentType(text_1) {
    return __awaiter(this, arguments, void 0, function (text, contentType, language) {
        if (contentType === void 0) { contentType = "other"; }
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, vector_store_adapter_js_1.generateEmbeddingForContent)(text, contentType, language)];
        });
    });
}
