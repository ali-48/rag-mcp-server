"use strict";
// src/rag/vector-store-sqlite.ts
// Backend SQLite pour le stockage vectoriel RAG - Implémente IVectorStore
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
exports.VectorStoreSQLite = void 0;
var db_config_js_1 = require("../config/db-config.js");
var vector_store_interface_js_1 = require("./vector-store-interface.js");
/**
 * Classe principale pour le backend SQLite vectoriel
 * Implémente l'interface IVectorStore pour l'abstraction
 */
var VectorStoreSQLite = /** @class */ (function () {
    function VectorStoreSQLite(config) {
        var _a;
        this.dbConfigManager = (0, db_config_js_1.getDbConfigManager)();
        if (config) {
            this.config = config;
            // Utiliser la configuration fournie
            if ((_a = config.sqlite) === null || _a === void 0 ? void 0 : _a.file) {
                // Charger sqlite3 dynamiquement
                var sqlite3 = this.loadSqlite3();
                this.db = new sqlite3.Database(config.sqlite.file);
            }
            else {
                // Fallback à la configuration existante
                this.db = this.dbConfigManager.getSqliteConnection("vectors");
            }
        }
        else {
            // Compatibilité avec l'ancien code
            this.db = this.dbConfigManager.getSqliteConnection("vectors");
            this.config = {
                type: "sqlite",
                sqlite: { file: ":memory:" }, // Valeur par défaut
            };
        }
        this.initializeTable();
    }
    VectorStoreSQLite.prototype.deleteDocumentsByPattern = function (pattern) {
        return __awaiter(this, void 0, void 0, function () {
            var result, deletedCount, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.runQuery("DELETE FROM rag_vectors WHERE id LIKE ? OR file_path LIKE ? OR project_path LIKE ?", [pattern, pattern, pattern])];
                    case 1:
                        result = _a.sent();
                        deletedCount = result.changes;
                        vector_store_interface_js_1.VectorStoreLogger.info("deleteByPattern", "".concat(deletedCount, " documents supprim\u00E9s avec le pattern: ").concat(pattern), {
                            pattern: pattern,
                            deletedCount: deletedCount,
                        });
                        return [2 /*return*/, deletedCount];
                    case 2:
                        error_1 = _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("deleteByPattern", "Erreur lors de la suppression avec pattern: ".concat(pattern), error_1, {
                            pattern: pattern,
                        });
                        throw error_1;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    VectorStoreSQLite.prototype.getStats = function () {
        return __awaiter(this, void 0, void 0, function () {
            var statsResult, dimensionResult, totalDocuments, totalProjects, totalSizeBytes, averageVectorDimension, lastUpdated, stats, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.getQuery("SELECT\n          COUNT(*) as total_documents,\n          COUNT(DISTINCT project_path) as total_projects,\n          SUM(file_size_bytes) as total_size_bytes,\n          MAX(updated_at) as last_updated\n        FROM rag_vectors")];
                    case 1:
                        statsResult = _a.sent();
                        return [4 /*yield*/, this.getQuery("SELECT\n          AVG(LENGTH(embedding) / 4) as avg_dimension\n        FROM rag_vectors\n        WHERE embedding IS NOT NULL")];
                    case 2:
                        dimensionResult = _a.sent();
                        totalDocuments = parseInt(statsResult.total_documents) || 0;
                        totalProjects = parseInt(statsResult.total_projects) || 0;
                        totalSizeBytes = parseInt(statsResult.total_size_bytes) || 0;
                        averageVectorDimension = parseFloat(dimensionResult.avg_dimension) || 0;
                        lastUpdated = statsResult.last_updated
                            ? new Date(statsResult.last_updated)
                            : null;
                        stats = {
                            totalDocuments: totalDocuments,
                            totalProjects: totalProjects,
                            totalSizeBytes: totalSizeBytes,
                            averageVectorDimension: averageVectorDimension,
                            lastUpdated: lastUpdated,
                        };
                        vector_store_interface_js_1.VectorStoreLogger.info("getStats", "Statistiques globales récupérées", {
                            totalDocuments: totalDocuments,
                            totalProjects: totalProjects,
                            totalSizeBytes: "".concat((totalSizeBytes / 1024 / 1024).toFixed(2), " MB"),
                            averageVectorDimension: averageVectorDimension.toFixed(2),
                            lastUpdated: lastUpdated,
                        });
                        return [2 /*return*/, stats];
                    case 3:
                        error_2 = _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("getStats", "Erreur lors de la récupération des statistiques globales", error_2);
                        throw error_2;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    VectorStoreSQLite.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var tableCheck, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        // Appeler la méthode d'initialisation existante
                        this.initializeTable();
                        return [4 /*yield*/, this.getQuery("SELECT name FROM sqlite_master WHERE type='table' AND name='rag_vectors'")];
                    case 1:
                        tableCheck = _a.sent();
                        if (!tableCheck) {
                            throw new Error("La table rag_vectors n'a pas été créée");
                        }
                        vector_store_interface_js_1.VectorStoreLogger.info("initialize", "Vector store SQLite initialisé avec succès");
                        return [3 /*break*/, 3];
                    case 2:
                        error_3 = _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("initialize", "Erreur lors de l'initialisation du vector store", error_3);
                        throw error_3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    VectorStoreSQLite.prototype.testConnection = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result, connectionOk, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.getQuery("SELECT 1 as test_value")];
                    case 1:
                        result = _a.sent();
                        connectionOk = result && result.test_value === 1;
                        if (connectionOk) {
                            vector_store_interface_js_1.VectorStoreLogger.info("testConnection", "Connexion SQLite testée avec succès");
                        }
                        else {
                            vector_store_interface_js_1.VectorStoreLogger.warn("testConnection", "Connexion SQLite testée mais résultat inattendu", {
                                result: result,
                            });
                        }
                        return [2 /*return*/, connectionOk];
                    case 2:
                        error_4 = _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("testConnection", "Erreur lors du test de connexion SQLite", error_4);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    VectorStoreSQLite.prototype.updateDocument = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var existingDoc, updateFields, params, embeddingBuffer, metadata, sql, result, updated, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.getQuery("SELECT id FROM rag_vectors WHERE id = ?", [id])];
                    case 1:
                        existingDoc = _a.sent();
                        if (!existingDoc) {
                            vector_store_interface_js_1.VectorStoreLogger.warn("updateDocument", "Document non trouv\u00E9: ".concat(id), {
                                id: id,
                            });
                            return [2 /*return*/, false];
                        }
                        updateFields = [];
                        params = [];
                        // Mettre à jour le contenu si fourni
                        if (updates.content !== undefined) {
                            updateFields.push("content = ?");
                            params.push(updates.content);
                            // Mettre à jour la taille du fichier si le contenu change
                            updateFields.push("file_size_bytes = ?");
                            params.push(updates.content.length);
                            // Mettre à jour le nombre de lignes
                            updateFields.push("lines_count = ?");
                            params.push(updates.content.split("\n").length);
                        }
                        // Mettre à jour l'embedding si fourni
                        if (updates.embedding !== undefined) {
                            updateFields.push("embedding = ?");
                            embeddingBuffer = Buffer.from(new Float32Array(updates.embedding).buffer);
                            params.push(embeddingBuffer);
                        }
                        // Mettre à jour les métadonnées si fournies
                        if (updates.metadata) {
                            metadata = updates.metadata;
                            if (metadata.contentType !== undefined) {
                                updateFields.push("content_type = ?");
                                params.push(metadata.contentType);
                            }
                            if (metadata.role !== undefined) {
                                updateFields.push("role = ?");
                                params.push(metadata.role);
                            }
                            if (metadata.fileExtension !== undefined) {
                                updateFields.push("file_extension = ?");
                                params.push(metadata.fileExtension);
                            }
                            if (metadata.language !== undefined) {
                                updateFields.push("language = ?");
                                params.push(metadata.language);
                            }
                            if (metadata.linesCount !== undefined) {
                                updateFields.push("lines_count = ?");
                                params.push(metadata.linesCount);
                            }
                            if (metadata.isCompressed !== undefined) {
                                updateFields.push("is_compressed = ?");
                                params.push(metadata.isCompressed ? 1 : 0);
                                // Mettre à jour la taille originale si compression
                                if (metadata.isCompressed && updates.content !== undefined) {
                                    updateFields.push("original_size_bytes = ?");
                                    params.push(Buffer.from(updates.content).length);
                                }
                            }
                        }
                        // Toujours mettre à jour la date de mise à jour
                        updateFields.push("updated_at = CURRENT_TIMESTAMP");
                        // Si aucun champ à mettre à jour
                        if (updateFields.length === 1) {
                            // Seulement updated_at
                            vector_store_interface_js_1.VectorStoreLogger.warn("updateDocument", "Aucune mise \u00E0 jour \u00E0 appliquer pour: ".concat(id), { id: id });
                            return [2 /*return*/, true]; // Document existe mais pas de changements
                        }
                        sql = "UPDATE rag_vectors SET ".concat(updateFields.join(", "), " WHERE id = ?");
                        params.push(id);
                        return [4 /*yield*/, this.runQuery(sql, params)];
                    case 2:
                        result = _a.sent();
                        updated = result.changes > 0;
                        if (updated) {
                            vector_store_interface_js_1.VectorStoreLogger.info("updateDocument", "Document mis \u00E0 jour: ".concat(id), {
                                id: id,
                                updatedFields: updateFields.filter(function (f) { return f !== "updated_at = CURRENT_TIMESTAMP"; }),
                            });
                        }
                        else {
                            vector_store_interface_js_1.VectorStoreLogger.warn("updateDocument", "Aucune ligne mise \u00E0 jour pour: ".concat(id), { id: id });
                        }
                        return [2 /*return*/, updated];
                    case 3:
                        error_5 = _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("updateDocument", "Erreur lors de la mise \u00E0 jour du document ".concat(id), error_5, { id: id });
                        throw error_5;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    VectorStoreSQLite.prototype.hybridSearch = function (queryEmbedding, textQuery, options) {
        return __awaiter(this, void 0, void 0, function () {
            var semanticWeight_1, textWeight_1, semanticResults, textResults, sql, params, rows, queryWords_1, allResults_1, hybridResults, limit, finalResults, error_6;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 4, , 5]);
                        semanticWeight_1 = (_a = options === null || options === void 0 ? void 0 : options.semanticWeight) !== null && _a !== void 0 ? _a : 0.7;
                        textWeight_1 = (_b = options === null || options === void 0 ? void 0 : options.textWeight) !== null && _b !== void 0 ? _b : 0.3;
                        // Valider les pondérations
                        if (semanticWeight_1 + textWeight_1 !== 1.0) {
                            vector_store_interface_js_1.VectorStoreLogger.warn("hybridSearch", "Somme des pond\u00E9rations != 1.0 (semantic=".concat(semanticWeight_1, ", text=").concat(textWeight_1, "). Normalisation automatique."), { semanticWeight: semanticWeight_1, textWeight: textWeight_1 });
                        }
                        return [4 /*yield*/, this.semanticSearch(queryEmbedding, options)];
                    case 1:
                        semanticResults = _c.sent();
                        textResults = [];
                        if (!textQuery.trim()) return [3 /*break*/, 3];
                        sql = "\n          SELECT id, project_path, file_path, content, content_type, role,\n                 file_extension, lines_count, language, is_compressed, original_size_bytes,\n                 embedding, created_at, updated_at\n          FROM rag_vectors\n          WHERE content LIKE ?\n          ".concat((options === null || options === void 0 ? void 0 : options.projectFilter) ? "AND project_path = ?" : "", "\n          ").concat((options === null || options === void 0 ? void 0 : options.contentTypeFilter)
                            ? Array.isArray(options.contentTypeFilter)
                                ? "AND content_type IN (".concat(options.contentTypeFilter.map(function () { return "?"; }).join(", "), ")")
                                : "AND content_type = ?"
                            : "", "\n          LIMIT ?\n        ");
                        params = ["%".concat(textQuery, "%")];
                        if (options === null || options === void 0 ? void 0 : options.projectFilter)
                            params.push(options.projectFilter);
                        if (options === null || options === void 0 ? void 0 : options.contentTypeFilter) {
                            if (Array.isArray(options.contentTypeFilter)) {
                                params.push.apply(params, options.contentTypeFilter);
                            }
                            else {
                                params.push(options.contentTypeFilter);
                            }
                        }
                        params.push((options === null || options === void 0 ? void 0 : options.limit) || 50); // Plus de résultats pour le scoring
                        return [4 /*yield*/, this.allQuery(sql, params)];
                    case 2:
                        rows = _c.sent();
                        queryWords_1 = textQuery
                            .toLowerCase()
                            .split(/\s+/)
                            .filter(function (w) { return w.length > 2; });
                        textResults = rows.map(function (row) {
                            var content = row.content.toLowerCase();
                            var textScore = 0;
                            if (queryWords_1.length > 0) {
                                // Score basé sur la fréquence des mots
                                queryWords_1.forEach(function (word) {
                                    var regex = new RegExp("\\b".concat(word, "\\b"), "gi");
                                    var matches = content.match(regex);
                                    if (matches) {
                                        textScore += matches.length;
                                    }
                                });
                                // Normaliser le score
                                textScore = Math.min(1.0, textScore / 10);
                            }
                            else {
                                // Si la requête est trop courte, utiliser un score basé sur la présence
                                textScore = content.includes(textQuery.toLowerCase()) ? 0.5 : 0.1;
                            }
                            // Convertir l'embedding si nécessaire pour la cohérence
                            var embeddingBuffer = row.embedding;
                            var storedEmbedding = Array.from(new Float32Array(embeddingBuffer.buffer));
                            return {
                                id: row.id,
                                filePath: row.file_path,
                                content: row.content,
                                score: textScore, // Score temporaire
                                textScore: textScore,
                                metadata: {
                                    projectPath: row.project_path,
                                    fileSize: row.file_size_bytes,
                                    originalSize: row.original_size_bytes || row.file_size_bytes,
                                    lines: row.content.split("\n").length,
                                    contentType: row.content_type || null,
                                    role: row.role || null,
                                    fileExtension: row.file_extension || null,
                                    language: row.language || null,
                                    linesCount: row.lines_count || null,
                                    isCompressed: row.is_compressed === 1,
                                    compressionRatio: row.is_compressed === 1 && row.original_size_bytes
                                        ? ((row.content.length / row.original_size_bytes) *
                                            100).toFixed(1) + "%"
                                        : null,
                                    createdAt: row.created_at ? new Date(row.created_at) : null,
                                    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
                                },
                            };
                        });
                        // Trier par score textuel
                        textResults.sort(function (a, b) { return b.textScore - a.textScore; });
                        _c.label = 3;
                    case 3:
                        allResults_1 = new Map();
                        // Ajouter les résultats sémantiques
                        semanticResults.forEach(function (result) {
                            allResults_1.set(result.id, __assign(__assign({}, result), { semanticScore: result.score, textScore: 0 }));
                        });
                        // Ajouter ou mettre à jour avec les résultats textuels
                        textResults.forEach(function (result) {
                            var existing = allResults_1.get(result.id);
                            if (existing) {
                                // Mettre à jour le score textuel
                                existing.textScore = result.textScore;
                            }
                            else {
                                // Ajouter le résultat textuel
                                allResults_1.set(result.id, __assign(__assign({}, result), { semanticScore: 0, textScore: result.textScore }));
                            }
                        });
                        hybridResults = Array.from(allResults_1.values()).map(function (result) {
                            // Normaliser les scores si nécessaire
                            var normalizedSemantic = result.semanticScore || 0;
                            var normalizedText = result.textScore || 0;
                            // Score hybride pondéré
                            var hybridScore = normalizedSemantic * semanticWeight_1 + normalizedText * textWeight_1;
                            return __assign(__assign({}, result), { score: hybridScore });
                        });
                        // 5. Trier par score hybride et limiter
                        hybridResults.sort(function (a, b) { return b.score - a.score; });
                        limit = (options === null || options === void 0 ? void 0 : options.limit) || 10;
                        finalResults = hybridResults.slice(0, limit);
                        vector_store_interface_js_1.VectorStoreLogger.info("hybridSearch", "Recherche hybride terminée", {
                            semanticResults: semanticResults.length,
                            textResults: textResults.length,
                            combinedResults: allResults_1.size,
                            finalResults: finalResults.length,
                            semanticWeight: semanticWeight_1,
                            textWeight: textWeight_1,
                            queryLength: textQuery.length,
                        });
                        return [2 /*return*/, finalResults];
                    case 4:
                        error_6 = _c.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("hybridSearch", "Erreur lors de la recherche hybride", error_6, {
                            textQueryLength: textQuery === null || textQuery === void 0 ? void 0 : textQuery.length,
                        });
                        throw error_6;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    VectorStoreSQLite.prototype.searchByMetadata = function (filters) {
        return __awaiter(this, void 0, void 0, function () {
            var sql, params, _a, from, to, rows, results, error_7;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        sql = "\n        SELECT id, project_path, file_path, content, content_type, role,\n               file_extension, lines_count, language, is_compressed, original_size_bytes,\n               embedding, created_at, updated_at\n        FROM rag_vectors\n        WHERE 1=1\n      ";
                        params = [];
                        // Filtres de base
                        if (filters.projectPath) {
                            sql += " AND project_path = ?";
                            params.push(filters.projectPath);
                        }
                        // Filtres de métadonnées
                        if (filters.contentType) {
                            sql += " AND content_type = ?";
                            params.push(filters.contentType);
                        }
                        if (filters.role) {
                            sql += " AND role = ?";
                            params.push(filters.role);
                        }
                        if (filters.fileExtension) {
                            sql += " AND file_extension = ?";
                            params.push(filters.fileExtension);
                        }
                        if (filters.language) {
                            sql += " AND language = ?";
                            params.push(filters.language);
                        }
                        if (filters.linesCount !== undefined) {
                            sql += " AND lines_count = ?";
                            params.push(filters.linesCount);
                        }
                        if (filters.isCompressed !== undefined) {
                            sql += " AND is_compressed = ?";
                            params.push(filters.isCompressed ? 1 : 0);
                        }
                        // Filtres de plage de dates
                        if (filters.dateRange) {
                            _a = filters.dateRange, from = _a.from, to = _a.to;
                            if (from) {
                                sql += " AND created_at >= ?";
                                params.push(from.toISOString());
                            }
                            if (to) {
                                sql += " AND created_at <= ?";
                                params.push(to.toISOString());
                            }
                        }
                        // Note: fileSizeBytes n'est pas dans EmbedAndStoreOptions, donc on ne peut pas le filtrer directement
                        // Si besoin, utiliser SemanticSearchOptions à la place
                        // Filtres de chunk (si disponibles)
                        if (filters.chunkIndex !== undefined) {
                            sql += " AND chunk_index = ?";
                            params.push(filters.chunkIndex);
                        }
                        if (filters.totalChunks !== undefined) {
                            sql += " AND total_chunks = ?";
                            params.push(filters.totalChunks);
                        }
                        // Trier par date de création (plus récent d'abord)
                        sql += " ORDER BY created_at DESC";
                        // Limiter les résultats (par défaut 100)
                        sql += " LIMIT 100";
                        return [4 /*yield*/, this.allQuery(sql, params)];
                    case 1:
                        rows = _b.sent();
                        results = rows.map(function (row) {
                            // Convertir l'embedding si nécessaire pour la cohérence
                            var embeddingBuffer = row.embedding;
                            var storedEmbedding = Array.from(new Float32Array(embeddingBuffer.buffer));
                            return {
                                id: row.id,
                                filePath: row.file_path,
                                content: row.content,
                                score: 1.0, // Score par défaut pour les recherches par métadonnées
                                metadata: {
                                    projectPath: row.project_path,
                                    fileSize: row.file_size_bytes,
                                    originalSize: row.original_size_bytes || row.file_size_bytes,
                                    lines: row.content.split("\n").length,
                                    contentType: row.content_type || null,
                                    role: row.role || null,
                                    fileExtension: row.file_extension || null,
                                    language: row.language || null,
                                    linesCount: row.lines_count || null,
                                    isCompressed: row.is_compressed === 1,
                                    compressionRatio: row.is_compressed === 1 && row.original_size_bytes
                                        ? ((row.content.length / row.original_size_bytes) *
                                            100).toFixed(1) + "%"
                                        : null,
                                    createdAt: row.created_at ? new Date(row.created_at) : null,
                                    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
                                },
                            };
                        });
                        vector_store_interface_js_1.VectorStoreLogger.info("searchByMetadata", "Recherche par métadonnées terminée", {
                            filters: Object.keys(filters).filter(function (key) {
                                // Vérifier si la clé existe et a une valeur définie
                                var value = filters[key];
                                return value !== undefined;
                            }),
                            resultsCount: results.length,
                            hasDateRange: !!filters.dateRange,
                        });
                        return [2 /*return*/, results];
                    case 2:
                        error_7 = _b.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("searchByMetadata", "Erreur lors de la recherche par métadonnées", error_7, {
                            filters: Object.keys(filters).filter(function (key) {
                                // Vérifier si la clé existe et a une valeur définie
                                var value = filters[key];
                                return value !== undefined;
                            }),
                        });
                        throw error_7;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Charge sqlite3 dynamiquement
     */
    VectorStoreSQLite.prototype.loadSqlite3 = function () {
        try {
            // Utiliser require pour compatibilité
            return require("sqlite3");
        }
        catch (error) {
            // Fallback pour les tests
            return {
                Database: /** @class */ (function () {
                    function MockDatabase(path) {
                    }
                    MockDatabase.prototype.exec = function (sql) { };
                    MockDatabase.prototype.run = function (sql, params, callback) {
                        if (callback)
                            callback(null);
                        return { changes: 0 };
                    };
                    MockDatabase.prototype.all = function (sql, params, callback) {
                        if (callback)
                            callback(null, []);
                    };
                    MockDatabase.prototype.get = function (sql, params, callback) {
                        if (callback)
                            callback(null, {});
                    };
                    return MockDatabase;
                }()),
            };
        }
    };
    /**
     * Initialise la table si elle n'existe pas
     */
    VectorStoreSQLite.prototype.initializeTable = function () {
        this.db.exec("\n            CREATE TABLE IF NOT EXISTS rag_vectors (\n                id TEXT PRIMARY KEY,\n                project_path TEXT NOT NULL,\n                file_path TEXT NOT NULL,\n                chunk_index INTEGER NOT NULL,\n                total_chunks INTEGER NOT NULL,\n                content TEXT NOT NULL,\n                content_type TEXT NOT NULL,\n                role TEXT,\n                file_extension TEXT,\n                file_size_bytes INTEGER NOT NULL,\n                lines_count INTEGER,\n                language TEXT,\n                embedding BLOB NOT NULL,\n                is_compressed BOOLEAN DEFAULT FALSE,\n                original_size_bytes INTEGER,\n                version INTEGER DEFAULT 1,\n                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n                indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP\n            );\n\n            CREATE INDEX IF NOT EXISTS idx_rag_vectors_project ON rag_vectors(project_path);\n            CREATE INDEX IF NOT EXISTS idx_rag_vectors_file ON rag_vectors(file_path);\n            CREATE INDEX IF NOT EXISTS idx_rag_vectors_content_type ON rag_vectors(content_type);\n            CREATE INDEX IF NOT EXISTS idx_rag_vectors_language ON rag_vectors(language);\n            CREATE INDEX IF NOT EXISTS idx_rag_vectors_created ON rag_vectors(created_at);\n            CREATE INDEX IF NOT EXISTS idx_rag_vectors_updated ON rag_vectors(updated_at);\n        ");
        vector_store_interface_js_1.VectorStoreLogger.info("init", "Table rag_vectors initialisée");
    };
    /**
     * Normalise la longueur des vecteurs pour qu'ils aient la même dimension
     * - Si les vecteurs ont la même longueur, les retourner tels quels
     * - Sinon, pad le vecteur plus court avec des zéros et tronquer le plus long
     */
    VectorStoreSQLite.prototype.normalizeVectorLength = function (vec1, vec2) {
        if (vec1.length === vec2.length) {
            return [vec1, vec2];
        }
        var targetLength = Math.max(vec1.length, vec2.length);
        var normalize = function (vec, length) {
            if (vec.length === length) {
                return vec;
            }
            var result = new Array(length).fill(0);
            var copyLength = Math.min(vec.length, length);
            for (var i = 0; i < copyLength; i++) {
                result[i] = vec[i];
            }
            return result;
        };
        return [normalize(vec1, targetLength), normalize(vec2, targetLength)];
    };
    /**
     * Calcule la similarité cosinus entre deux vecteurs
     * Gère les vecteurs de dimensions différentes en les normalisant
     */
    VectorStoreSQLite.prototype.cosineSimilarity = function (vec1, vec2) {
        // Normaliser les longueurs si nécessaire
        var _a = this.normalizeVectorLength(vec1, vec2), normalizedVec1 = _a[0], normalizedVec2 = _a[1];
        var dotProduct = 0;
        var norm1 = 0;
        var norm2 = 0;
        for (var i = 0; i < normalizedVec1.length; i++) {
            dotProduct += normalizedVec1[i] * normalizedVec2[i];
            norm1 += normalizedVec1[i] * normalizedVec1[i];
            norm2 += normalizedVec2[i] * normalizedVec2[i];
        }
        if (norm1 === 0 || norm2 === 0) {
            return 0;
        }
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    };
    /**
     * Stocke un document avec son embedding
     * Implémentation de IVectorStore.embedAndStore
     */
    VectorStoreSQLite.prototype.embedAndStore = function (projectPath_1, filePath_1, content_1, embedding_1) {
        return __awaiter(this, arguments, void 0, function (projectPath, filePath, content, embedding, options) {
            var _a, chunkIndex, _b, totalChunks, _c, contentType, _d, role, _e, fileExtension, _f, language, _g, linesCount, _h, isCompressed, id, finalFileExtension, finalLinesCount, fileSizeBytes, originalSizeBytes, embeddingBuffer, error_8;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        _a = options.chunkIndex, chunkIndex = _a === void 0 ? 0 : _a, _b = options.totalChunks, totalChunks = _b === void 0 ? 1 : _b, _c = options.contentType, contentType = _c === void 0 ? "other" : _c, _d = options.role, role = _d === void 0 ? null : _d, _e = options.fileExtension, fileExtension = _e === void 0 ? null : _e, _f = options.language, language = _f === void 0 ? null : _f, _g = options.linesCount, linesCount = _g === void 0 ? null : _g, _h = options.isCompressed, isCompressed = _h === void 0 ? false : _h;
                        id = (0, vector_store_interface_js_1.createDocumentId)(projectPath, filePath, chunkIndex);
                        finalFileExtension = fileExtension || filePath.split(".").pop() || null;
                        finalLinesCount = linesCount || content.split("\n").length;
                        fileSizeBytes = content.length;
                        originalSizeBytes = isCompressed
                            ? Buffer.from(content).length
                            : content.length;
                        embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer);
                        _j.label = 1;
                    case 1:
                        _j.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.runQuery("INSERT INTO rag_vectors (\n                    id, project_path, file_path, chunk_index, total_chunks,\n                    content, content_type, role, file_extension, file_size_bytes,\n                    lines_count, language, embedding, is_compressed, original_size_bytes,\n                    version, created_at, updated_at, indexed_at\n                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)\n                ON CONFLICT(id) DO UPDATE SET\n                    content = excluded.content,\n                    content_type = excluded.content_type,\n                    role = excluded.role,\n                    file_extension = excluded.file_extension,\n                    file_size_bytes = excluded.file_size_bytes,\n                    lines_count = excluded.lines_count,\n                    language = excluded.language,\n                    embedding = excluded.embedding,\n                    is_compressed = excluded.is_compressed,\n                    original_size_bytes = excluded.original_size_bytes,\n                    updated_at = CURRENT_TIMESTAMP", [
                                id,
                                projectPath,
                                filePath,
                                chunkIndex,
                                totalChunks,
                                content,
                                contentType,
                                role,
                                finalFileExtension,
                                fileSizeBytes,
                                finalLinesCount,
                                language,
                                embeddingBuffer,
                                isCompressed ? 1 : 0,
                                originalSizeBytes,
                            ])];
                    case 2:
                        _j.sent();
                        vector_store_interface_js_1.VectorStoreLogger.info("store", "Document stock\u00E9: ".concat(id), {
                            projectPath: projectPath,
                            filePath: filePath,
                            contentType: contentType,
                            chunkIndex: chunkIndex,
                            totalChunks: totalChunks,
                        });
                        return [3 /*break*/, 4];
                    case 3:
                        error_8 = _j.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("store", "Erreur lors du stockage du document ".concat(id), error_8, {
                            projectPath: projectPath,
                            filePath: filePath,
                        });
                        throw error_8;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Recherche sémantique avec similarité cosinus
     * Implémentation de IVectorStore.semanticSearch
     */
    VectorStoreSQLite.prototype.semanticSearch = function (queryEmbedding_1) {
        return __awaiter(this, arguments, void 0, function (queryEmbedding, options) {
            var projectFilter, _a, limit, _b, threshold, contentTypeFilter, roleFilter, languageFilter, minFileSizeBytes, maxFileSizeBytes, minLinesCount, maxLinesCount, dateFrom, dateTo, sql, params, placeholders, placeholders, placeholders, rows, results, _i, rows_1, row, embeddingBuffer, storedEmbedding, similarity, limitedResults, error_9;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        projectFilter = options.projectFilter, _a = options.limit, limit = _a === void 0 ? 10 : _a, _b = options.threshold, threshold = _b === void 0 ? 0.3 : _b, contentTypeFilter = options.contentTypeFilter, roleFilter = options.roleFilter, languageFilter = options.languageFilter, minFileSizeBytes = options.minFileSizeBytes, maxFileSizeBytes = options.maxFileSizeBytes, minLinesCount = options.minLinesCount, maxLinesCount = options.maxLinesCount, dateFrom = options.dateFrom, dateTo = options.dateTo;
                        sql = "\n            SELECT id, project_path, file_path, content, content_type, role,\n                   file_extension, lines_count, language, is_compressed, original_size_bytes,\n                   embedding, created_at, updated_at\n            FROM rag_vectors\n            WHERE 1=1\n        ";
                        params = [];
                        // Appliquer les filtres
                        if (projectFilter) {
                            sql += " AND project_path = ?";
                            params.push(projectFilter);
                        }
                        if (contentTypeFilter) {
                            if (Array.isArray(contentTypeFilter)) {
                                if (contentTypeFilter.length > 0) {
                                    placeholders = contentTypeFilter.map(function () { return "?"; }).join(", ");
                                    sql += " AND content_type IN (".concat(placeholders, ")");
                                    params.push.apply(params, contentTypeFilter);
                                }
                            }
                            else {
                                sql += " AND content_type = ?";
                                params.push(contentTypeFilter);
                            }
                        }
                        if (roleFilter) {
                            if (Array.isArray(roleFilter)) {
                                if (roleFilter.length > 0) {
                                    placeholders = roleFilter.map(function () { return "?"; }).join(", ");
                                    sql += " AND role IN (".concat(placeholders, ")");
                                    params.push.apply(params, roleFilter);
                                }
                            }
                            else {
                                sql += " AND role = ?";
                                params.push(roleFilter);
                            }
                        }
                        if (languageFilter) {
                            if (Array.isArray(languageFilter)) {
                                if (languageFilter.length > 0) {
                                    placeholders = languageFilter.map(function () { return "?"; }).join(", ");
                                    sql += " AND language IN (".concat(placeholders, ")");
                                    params.push.apply(params, languageFilter);
                                }
                            }
                            else {
                                sql += " AND language = ?";
                                params.push(languageFilter);
                            }
                        }
                        if (minFileSizeBytes !== undefined) {
                            sql += " AND file_size_bytes >= ?";
                            params.push(minFileSizeBytes);
                        }
                        if (maxFileSizeBytes !== undefined) {
                            sql += " AND file_size_bytes <= ?";
                            params.push(maxFileSizeBytes);
                        }
                        if (minLinesCount !== undefined) {
                            sql += " AND lines_count >= ?";
                            params.push(minLinesCount);
                        }
                        if (maxLinesCount !== undefined) {
                            sql += " AND lines_count <= ?";
                            params.push(maxLinesCount);
                        }
                        if (dateFrom) {
                            sql += " AND created_at >= ?";
                            params.push(dateFrom.toISOString());
                        }
                        if (dateTo) {
                            sql += " AND created_at <= ?";
                            params.push(dateTo.toISOString());
                        }
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.allQuery(sql, params)];
                    case 2:
                        rows = _c.sent();
                        results = [];
                        // Calculer la similarité pour chaque résultat
                        for (_i = 0, rows_1 = rows; _i < rows_1.length; _i++) {
                            row = rows_1[_i];
                            embeddingBuffer = row.embedding;
                            storedEmbedding = Array.from(new Float32Array(embeddingBuffer.buffer));
                            similarity = this.cosineSimilarity(queryEmbedding, storedEmbedding);
                            if (similarity >= threshold) {
                                results.push({
                                    id: row.id,
                                    filePath: row.file_path,
                                    content: row.content,
                                    score: similarity,
                                    similarity: similarity,
                                    metadata: {
                                        projectPath: row.project_path,
                                        fileSize: row.file_size_bytes,
                                        originalSize: row.original_size_bytes || row.file_size_bytes,
                                        lines: row.content.split("\n").length,
                                        contentType: row.content_type || null,
                                        role: row.role || null,
                                        fileExtension: row.file_extension || null,
                                        language: row.language || null,
                                        linesCount: row.lines_count || null,
                                        isCompressed: row.is_compressed === 1,
                                        compressionRatio: row.is_compressed === 1 && row.original_size_bytes
                                            ? ((row.content.length / row.original_size_bytes) *
                                                100).toFixed(1) + "%"
                                            : null,
                                        createdAt: row.created_at ? new Date(row.created_at) : null,
                                        updatedAt: row.updated_at ? new Date(row.updated_at) : null,
                                    },
                                });
                            }
                        }
                        // Trier par similarité (décroissant) et limiter
                        results.sort(function (a, b) { return b.similarity - a.similarity; });
                        limitedResults = results.slice(0, limit);
                        vector_store_interface_js_1.VectorStoreLogger.info("search", "Recherche termin\u00E9e: ".concat(limitedResults.length, " r\u00E9sultats"), {
                            totalCandidates: rows.length,
                            filteredResults: results.length,
                            finalResults: limitedResults.length,
                            threshold: threshold,
                        });
                        return [2 /*return*/, limitedResults];
                    case 3:
                        error_9 = _c.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("search", "Erreur lors de la recherche sémantique", error_9);
                        throw error_9;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Obtient les statistiques d'un projet
     * Implémentation de IVectorStore.getProjectStats
     */
    VectorStoreSQLite.prototype.getProjectStats = function (projectPath) {
        return __awaiter(this, void 0, void 0, function () {
            var statsResult, totalChunks, filesResult, totalFiles, typesResult, contentTypes_1, error_10;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, this.getQuery("SELECT\n                    COUNT(*) as total_chunks,\n                    MIN(created_at) as indexed_at,\n                    MAX(updated_at) as last_updated\n                FROM rag_vectors\n                WHERE project_path = ?", [projectPath])];
                    case 1:
                        statsResult = _a.sent();
                        totalChunks = parseInt(statsResult.total_chunks) || 0;
                        return [4 /*yield*/, this.getQuery("SELECT COUNT(DISTINCT\n                    CASE\n                        WHEN INSTR(file_path, '#chunk') > 0\n                        THEN SUBSTR(file_path, 1, INSTR(file_path, '#chunk') - 1)\n                        ELSE file_path\n                    END\n                ) as total_files\n                FROM rag_vectors\n                WHERE project_path = ?", [projectPath])];
                    case 2:
                        filesResult = _a.sent();
                        totalFiles = parseInt(filesResult.total_files) || 0;
                        return [4 /*yield*/, this.allQuery("SELECT content_type, COUNT(*) as count\n                FROM rag_vectors\n                WHERE project_path = ?\n                GROUP BY content_type", [projectPath])];
                    case 3:
                        typesResult = _a.sent();
                        contentTypes_1 = {};
                        typesResult.forEach(function (typeRow) {
                            contentTypes_1[typeRow.content_type] = parseInt(typeRow.count);
                        });
                        return [2 /*return*/, {
                                totalFiles: totalFiles,
                                totalChunks: totalChunks,
                                indexedAt: statsResult.indexed_at
                                    ? new Date(statsResult.indexed_at)
                                    : null,
                                lastUpdated: statsResult.last_updated
                                    ? new Date(statsResult.last_updated)
                                    : null,
                                contentTypes: contentTypes_1,
                            }];
                    case 4:
                        error_10 = _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("stats", "Erreur lors de la r\u00E9cup\u00E9ration des stats pour ".concat(projectPath), error_10);
                        throw error_10;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Liste tous les projets indexés
     * Implémentation de IVectorStore.listProjects
     */
    VectorStoreSQLite.prototype.listProjects = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result, error_11;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.allQuery("SELECT DISTINCT project_path FROM rag_vectors ORDER BY project_path")];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.map(function (row) { return row.project_path; })];
                    case 2:
                        error_11 = _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("list", "Erreur lors du listing des projets", error_11);
                        throw error_11;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Supprime un document par son ID
     * Implémentation de IVectorStore.deleteDocument
     */
    VectorStoreSQLite.prototype.deleteDocument = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var result, deleted, error_12;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.runQuery("DELETE FROM rag_vectors WHERE id = ?", [id])];
                    case 1:
                        result = _a.sent();
                        deleted = result.changes > 0;
                        if (deleted) {
                            vector_store_interface_js_1.VectorStoreLogger.info("delete", "Document supprim\u00E9: ".concat(id));
                        }
                        return [2 /*return*/, deleted];
                    case 2:
                        error_12 = _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("delete", "Erreur lors de la suppression du document ".concat(id), error_12);
                        throw error_12;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Vide la table (pour les tests)
     * Implémentation de IVectorStore.clearAll
     */
    VectorStoreSQLite.prototype.clearAll = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_13;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.runQuery("DELETE FROM rag_vectors")];
                    case 1:
                        _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.info("clear", "Tous les documents ont été supprimés");
                        return [3 /*break*/, 3];
                    case 2:
                        error_13 = _a.sent();
                        vector_store_interface_js_1.VectorStoreLogger.error("clear", "Erreur lors du vidage de la table", error_13);
                        throw error_13;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Exécute une requête SQL et retourne le résultat
     */
    VectorStoreSQLite.prototype.runQuery = function (sql, params) {
        var _this = this;
        if (params === void 0) { params = []; }
        return new Promise(function (resolve, reject) {
            _this.db.run(sql, params, function (err) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve({ changes: this.changes || 0 });
                }
            });
        });
    };
    /**
     * Exécute une requête SQL et retourne toutes les lignes
     */
    VectorStoreSQLite.prototype.allQuery = function (sql, params) {
        var _this = this;
        if (params === void 0) { params = []; }
        return new Promise(function (resolve, reject) {
            _this.db.all(sql, params, function (err, rows) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(rows);
                }
            });
        });
    };
    /**
     * Exécute une requête SQL et retourne une seule ligne
     */
    VectorStoreSQLite.prototype.getQuery = function (sql, params) {
        var _this = this;
        if (params === void 0) { params = []; }
        return new Promise(function (resolve, reject) {
            _this.db.get(sql, params, function (err, row) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(row);
                }
            });
        });
    };
    return VectorStoreSQLite;
}());
exports.VectorStoreSQLite = VectorStoreSQLite;
