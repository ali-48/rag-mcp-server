"use strict";
// src/config/db-config.ts
// Gestionnaire de configuration de base de données pour RAG
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
exports.DbConfigManager = void 0;
exports.getDbConfigManager = getDbConfigManager;
exports.loadDbConfig = loadDbConfig;
exports.testDbConfig = testDbConfig;
var fs_1 = require("fs");
var path_1 = require("path");
var sqlite3 = require("sqlite3");
var logger_js_1 = require("../core/logger.js");
/**
 * Classe pour charger et gérer la configuration des bases de données
 */
var DbConfigManager = /** @class */ (function () {
    function DbConfigManager(configPath) {
        this.connections = new Map();
        this.configPath = configPath || './rag/config/db.config.json';
        this.config = this.loadConfig();
    }
    /**
     * Charge la configuration depuis le fichier JSON
     */
    DbConfigManager.prototype.loadConfig = function () {
        try {
            var configData = (0, fs_1.readFileSync)(this.configPath, 'utf-8');
            var config = JSON.parse(configData);
            // S'assurer que toutes les bases ont une configuration
            if (!config.metadata) {
                config.metadata = {
                    type: 'sqlite',
                    path: './rag/db/metadata/rag_metadata.sqlite'
                };
            }
            return config;
        }
        catch (error) {
            // Configuration par défaut si le fichier n'existe pas
            return {
                memory: {
                    type: 'sqlite',
                    path: './rag/db/memory/rag_memory.sqlite'
                },
                vectors: {
                    type: 'sqlite',
                    path: './rag/db/vector/rag_vectors.sqlite'
                },
                metadata: {
                    type: 'sqlite',
                    path: './rag/db/metadata/rag_metadata.sqlite'
                }
            };
        }
    };
    /**
     * Récupère la configuration complète
     */
    DbConfigManager.prototype.getConfig = function () {
        return this.config;
    };
    /**
     * Récupère la configuration pour un type de base spécifique
     */
    DbConfigManager.prototype.getDatabaseConfig = function (type) {
        var config = this.config[type];
        if (!config) {
            throw new Error("Configuration non trouv\u00E9e pour le type de base: ".concat(type));
        }
        return config;
    };
    /**
     * Vérifie si toutes les bases sont configurées en SQLite
     */
    DbConfigManager.prototype.isAllSqlite = function () {
        return Object.values(this.config).every(function (db) { return (db === null || db === void 0 ? void 0 : db.type) === 'sqlite'; });
    };
    /**
     * Obtient une connexion SQLite pour un type de base spécifique
     */
    DbConfigManager.prototype.getSqliteConnection = function (type) {
        if (this.connections.has(type)) {
            return this.connections.get(type);
        }
        var dbConfig = this.getDatabaseConfig(type);
        if (dbConfig.type !== 'sqlite') {
            throw new Error("La base ".concat(type, " n'est pas configur\u00E9e comme SQLite"));
        }
        if (!dbConfig.path) {
            throw new Error("Chemin non d\u00E9fini pour la base ".concat(type));
        }
        // Créer le répertoire parent si nécessaire
        var path = dbConfig.path;
        var dir = (0, path_1.dirname)(path);
        try {
            // Cette opération peut nécessiter des permissions, mais nous laissons
            // le système de fichiers gérer les erreurs
            require('fs').mkdirSync(dir, { recursive: true });
        }
        catch (error) {
            // Ignorer les erreurs de création de répertoire
        }
        // Créer la connexion SQLite
        var db = new sqlite3.Database(path, function (err) {
            if (err) {
                logger_js_1.logger.error("rag.db.connection.failed", "Erreur lors de l'ouverture de la base ".concat(type), {
                    type: type,
                    path: path,
                    error: err.message
                });
            }
        });
        // Configurer des paramètres optimisés pour RAG
        db.exec("\n            PRAGMA journal_mode = WAL;\n            PRAGMA synchronous = NORMAL;\n            PRAGMA foreign_keys = ON;\n            PRAGMA cache_size = -2000; -- 2MB de cache\n        ");
        this.connections.set(type, db);
        return db;
    };
    /**
     * Ferme toutes les connexions SQLite
     */
    DbConfigManager.prototype.closeAllConnections = function () {
        var entries = Array.from(this.connections.entries());
        for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
            var _a = entries_1[_i], type = _a[0], connection = _a[1];
            try {
                connection.close();
            }
            catch (error) {
                // Ignorer les erreurs de fermeture
            }
        }
        this.connections.clear();
    };
    /**
     * Initialise les schémas de base de données si nécessaire
     */
    DbConfigManager.prototype.initializeSchemas = function () {
        if (!this.isAllSqlite()) {
            throw new Error('L\'initialisation des schémas n\'est supportée que pour SQLite');
        }
        // Initialiser la base de mémoire
        var memoryDb = this.getSqliteConnection('memory');
        memoryDb.exec("\n      CREATE TABLE IF NOT EXISTS rag_memory (\n        id TEXT PRIMARY KEY,\n        project_path TEXT NOT NULL,\n        operation TEXT NOT NULL,\n        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,\n        details TEXT,\n        metadata TEXT\n      );\n      \n      CREATE INDEX IF NOT EXISTS idx_rag_memory_project ON rag_memory(project_path);\n      CREATE INDEX IF NOT EXISTS idx_rag_memory_timestamp ON rag_memory(timestamp);\n    ");
        // Initialiser la base de vecteurs
        var vectorsDb = this.getSqliteConnection('vectors');
        vectorsDb.exec("\n      CREATE TABLE IF NOT EXISTS rag_vectors (\n        id TEXT PRIMARY KEY,\n        project_path TEXT NOT NULL,\n        file_path TEXT NOT NULL,\n        chunk_index INTEGER NOT NULL,\n        content_type TEXT NOT NULL,\n        language TEXT,\n        role TEXT,\n        content TEXT NOT NULL,\n        embedding BLOB NOT NULL,\n        metadata TEXT NOT NULL,\n        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP\n      );\n      \n      CREATE INDEX IF NOT EXISTS idx_rag_vectors_project ON rag_vectors(project_path);\n      CREATE INDEX IF NOT EXISTS idx_rag_vectors_file ON rag_vectors(file_path);\n      CREATE INDEX IF NOT EXISTS idx_rag_vectors_content_type ON rag_vectors(content_type);\n      CREATE INDEX IF NOT EXISTS idx_rag_vectors_language ON rag_vectors(language);\n      \n      -- Index pour la recherche par similarit\u00E9 (sera utilis\u00E9 avec des fonctions personnalis\u00E9es)\n      CREATE INDEX IF NOT EXISTS idx_rag_vectors_embedding ON rag_vectors(embedding);\n    ");
        // Initialiser la base de métadonnées
        var metadataDb = this.getSqliteConnection('metadata');
        metadataDb.exec("\n      CREATE TABLE IF NOT EXISTS rag_metadata (\n        id TEXT PRIMARY KEY,\n        project_path TEXT NOT NULL,\n        key TEXT NOT NULL,\n        value TEXT NOT NULL,\n        data_type TEXT NOT NULL,\n        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP\n      );\n      \n      CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_metadata_project_key ON rag_metadata(project_path, key);\n      CREATE INDEX IF NOT EXISTS idx_rag_metadata_key ON rag_metadata(key);\n    ");
    };
    /**
     * Vérifie la connectivité aux bases de données
     */
    DbConfigManager.prototype.testConnections = function () {
        return __awaiter(this, void 0, void 0, function () {
            var results, memoryDb_1, error_1, vectorsDb_1, error_2, metadataDb_1, error_3;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        results = {
                            memory: false,
                            vectors: false,
                            metadata: false
                        };
                        if (!this.isAllSqlite()) return [3 /*break*/, 11];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        memoryDb_1 = this.getSqliteConnection('memory');
                        return [4 /*yield*/, new Promise(function (resolve, reject) {
                                memoryDb_1.get('SELECT 1 as test', function (err) {
                                    if (err)
                                        reject(err);
                                    else
                                        resolve();
                                });
                            })];
                    case 2:
                        _a.sent();
                        results.memory = true;
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        results.memory = false;
                        return [3 /*break*/, 4];
                    case 4:
                        _a.trys.push([4, 6, , 7]);
                        vectorsDb_1 = this.getSqliteConnection('vectors');
                        return [4 /*yield*/, new Promise(function (resolve, reject) {
                                vectorsDb_1.get('SELECT 1 as test', function (err) {
                                    if (err)
                                        reject(err);
                                    else
                                        resolve();
                                });
                            })];
                    case 5:
                        _a.sent();
                        results.vectors = true;
                        return [3 /*break*/, 7];
                    case 6:
                        error_2 = _a.sent();
                        results.vectors = false;
                        return [3 /*break*/, 7];
                    case 7:
                        _a.trys.push([7, 9, , 10]);
                        metadataDb_1 = this.getSqliteConnection('metadata');
                        return [4 /*yield*/, new Promise(function (resolve, reject) {
                                metadataDb_1.get('SELECT 1 as test', function (err) {
                                    if (err)
                                        reject(err);
                                    else
                                        resolve();
                                });
                            })];
                    case 8:
                        _a.sent();
                        results.metadata = true;
                        return [3 /*break*/, 10];
                    case 9:
                        error_3 = _a.sent();
                        results.metadata = false;
                        return [3 /*break*/, 10];
                    case 10: return [3 /*break*/, 12];
                    case 11:
                        // Pour PostgreSQL, nous devrions tester les connexions pool
                        // Pour l'instant, retourner false pour les bases non-SQLite
                        Object.keys(results).forEach(function (key) {
                            var dbConfig = _this.config[key];
                            results[key] = (dbConfig === null || dbConfig === void 0 ? void 0 : dbConfig.type) === 'sqlite';
                        });
                        _a.label = 12;
                    case 12: return [2 /*return*/, results];
                }
            });
        });
    };
    /**
     * Récupère les chemins des fichiers SQLite
     */
    DbConfigManager.prototype.getSqlitePaths = function () {
        var _this = this;
        var paths = {
            memory: undefined,
            vectors: undefined,
            metadata: undefined
        };
        Object.keys(paths).forEach(function (key) {
            var config = _this.config[key];
            if ((config === null || config === void 0 ? void 0 : config.type) === 'sqlite' && config.path) {
                paths[key] = config.path;
            }
        });
        return paths;
    };
    return DbConfigManager;
}());
exports.DbConfigManager = DbConfigManager;
/**
 * Instance singleton du gestionnaire de configuration DB
 */
var dbConfigManager = null;
/**
 * Obtient l'instance singleton du gestionnaire de configuration DB
 */
function getDbConfigManager(configPath) {
    if (!dbConfigManager) {
        dbConfigManager = new DbConfigManager(configPath);
    }
    return dbConfigManager;
}
/**
 * Fonction utilitaire pour charger rapidement la configuration DB
 */
function loadDbConfig(configPath) {
    return getDbConfigManager(configPath).getConfig();
}
/**
 * Test de la configuration DB
 */
function testDbConfig() {
    return __awaiter(this, void 0, void 0, function () {
        var dbConfigManager_1, config, connections, allConnected, error_4;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 2, , 3]);
                    dbConfigManager_1 = getDbConfigManager();
                    config = dbConfigManager_1.getConfig();
                    // Vérifier que toutes les bases sont configurées
                    if (!config.memory || !config.vectors) {
                        logger_js_1.logger.warn('rag.db.config.incomplete', 'Configuration DB incomplète: memory ou vectors manquants');
                        return [2 /*return*/, false];
                    }
                    // Vérifier que nous sommes en SQLite (pour la migration)
                    if (!dbConfigManager_1.isAllSqlite()) {
                        logger_js_1.logger.warn('rag.db.config.mixed_backends', 'Attention: Certaines bases ne sont pas en SQLite. La migration peut nécessiter des adaptations.', {
                            memoryType: config.memory.type,
                            vectorsType: config.vectors.type,
                            metadataType: (_a = config.metadata) === null || _a === void 0 ? void 0 : _a.type
                        });
                    }
                    return [4 /*yield*/, dbConfigManager_1.testConnections()];
                case 1:
                    connections = _c.sent();
                    allConnected = Object.values(connections).every(function (connected) { return connected; });
                    if (!allConnected) {
                        logger_js_1.logger.warn('rag.db.connections.failed', 'Certaines connexions DB ont échoué', {
                            connections: connections,
                            memoryPath: config.memory.path,
                            vectorsPath: config.vectors.path,
                            metadataPath: (_b = config.metadata) === null || _b === void 0 ? void 0 : _b.path
                        });
                    }
                    return [2 /*return*/, true];
                case 2:
                    error_4 = _c.sent();
                    logger_js_1.logger.error('rag.db.config.test.failed', 'Erreur lors du test de la configuration DB', {
                        error: error_4 instanceof Error ? error_4.message : String(error_4)
                    });
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Exécution automatique si ce fichier est exécuté directement
if (typeof require !== 'undefined' && require.main === module) {
    testDbConfig().then(function (success) {
        if (success) {
            logger_js_1.logger.info('rag.db.config.test.success', 'Configuration DB testée avec succès');
            process.exit(0);
        }
        else {
            logger_js_1.logger.error('rag.db.config.test.failure', 'Échec du test de configuration DB');
            process.exit(1);
        }
    });
}
