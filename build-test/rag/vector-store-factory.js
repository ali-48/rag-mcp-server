"use strict";
// src/rag/vector-store-factory.ts
// Factory pour créer des instances de vector store basées sur la configuration
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
exports.VectorStoreFactory = void 0;
exports.createVectorStore = createVectorStore;
exports.createVectorStoreForProject = createVectorStoreForProject;
exports.testVectorStoreConnection = testVectorStoreConnection;
exports.getAvailableVectorStoreBackends = getAvailableVectorStoreBackends;
var vector_store_interface_js_1 = require("./vector-store-interface.js");
var vector_store_sqlite_js_1 = require("./vector-store-sqlite.js");
/**
 * Factory pour créer des instances de vector store
 *
 * Cette factory crée des instances de vector store basées sur la configuration
 * et gère le fallback automatique en cas d'échec de connexion.
 */
var VectorStoreFactory = /** @class */ (function () {
    function VectorStoreFactory() {
    }
    /**
     * Crée une instance de vector store basée sur la configuration
     * @param config Configuration du vector store
     * @returns Instance de IVectorStore
     */
    VectorStoreFactory.create = function (config) {
        // Valider la configuration
        var errors = (0, vector_store_interface_js_1.validateVectorStoreConfig)(config);
        if (errors.length > 0) {
            throw new vector_store_interface_js_1.VectorStoreError("Configuration invalide: ".concat(errors.join(', ')), 'INVALID_CONFIG', { errors: errors });
        }
        vector_store_interface_js_1.VectorStoreLogger.info('factory.create', "Cr\u00E9ation de vector store avec backend: ".concat(config.type), {
            type: config.type
        });
        try {
            switch (config.type) {
                case 'sqlite':
                    return this.createSQLiteStore(config);
                case 'postgresql':
                    return this.createPostgreSQLStore(config);
                case 'memory':
                    return this.createMemoryStore(config);
                default:
                    throw new vector_store_interface_js_1.VectorStoreError("Type de backend non support\u00E9: ".concat(config.type), 'UNSUPPORTED_BACKEND', { type: config.type });
            }
        }
        catch (error) {
            vector_store_interface_js_1.VectorStoreLogger.error('factory.create', "\u00C9chec de cr\u00E9ation du vector store", error, {
                type: config.type
            });
            // Fallback sur SQLite en cas d'échec
            return this.createFallbackStore(config);
        }
    };
    /**
     * Crée un store SQLite
     */
    VectorStoreFactory.createSQLiteStore = function (config) {
        var _a;
        vector_store_interface_js_1.VectorStoreLogger.info('factory.sqlite', 'Création de vector store SQLite', {
            file: ((_a = config.sqlite) === null || _a === void 0 ? void 0 : _a.file) || ':memory:'
        });
        return new vector_store_sqlite_js_1.VectorStoreSQLite(config);
    };
    /**
     * Crée un store PostgreSQL (optionnel)
     */
    VectorStoreFactory.createPostgreSQLStore = function (config) {
        var _a, _b;
        vector_store_interface_js_1.VectorStoreLogger.info('factory.postgresql', 'Création de vector store PostgreSQL', {
            host: (_a = config.postgresql) === null || _a === void 0 ? void 0 : _a.host,
            database: (_b = config.postgresql) === null || _b === void 0 ? void 0 : _b.database
        });
        // Vérifier si PostgreSQL est disponible
        if (!this.isPostgreSQLAvailable()) {
            vector_store_interface_js_1.VectorStoreLogger.warn('factory.postgresql', 'PostgreSQL non disponible, fallback sur SQLite', {
                reason: 'PostgreSQL non installé ou non configuré'
            });
            return this.createFallbackStore(config);
        }
        try {
            // Importer dynamiquement le module PostgreSQL
            var VectorStorePostgreSQL = require('./vector-store-postgresql.js').VectorStorePostgreSQL;
            return new VectorStorePostgreSQL(config);
        }
        catch (error) {
            vector_store_interface_js_1.VectorStoreLogger.error('factory.postgresql', 'Échec de chargement du module PostgreSQL', error);
            throw new vector_store_interface_js_1.VectorStoreError('PostgreSQL non disponible. Assurez-vous que le module est installé et configuré.', 'POSTGRESQL_UNAVAILABLE', { error: error instanceof Error ? error.message : String(error) });
        }
    };
    /**
     * Crée un store en mémoire
     */
    VectorStoreFactory.createMemoryStore = function (config) {
        vector_store_interface_js_1.VectorStoreLogger.info('factory.memory', 'Création de vector store en mémoire');
        try {
            // Importer dynamiquement le module memory
            var VectorStoreMemory = require('./vector-store-memory.js').VectorStoreMemory;
            return new VectorStoreMemory(config);
        }
        catch (error) {
            vector_store_interface_js_1.VectorStoreLogger.warn('factory.memory', 'Module memory non disponible, fallback sur SQLite', {
                error: error instanceof Error ? error.message : String(error)
            });
            return this.createFallbackStore(config);
        }
    };
    /**
     * Crée un store de fallback (SQLite)
     */
    VectorStoreFactory.createFallbackStore = function (originalConfig) {
        vector_store_interface_js_1.VectorStoreLogger.warn('factory.fallback', 'Utilisation du fallback SQLite', {
            originalBackend: originalConfig.type
        });
        // Créer une configuration SQLite de fallback
        var fallbackConfig = {
            type: 'sqlite',
            sqlite: {
                file: ':memory:',
                memory: true
            },
            options: originalConfig.options
        };
        return new vector_store_sqlite_js_1.VectorStoreSQLite(fallbackConfig);
    };
    /**
     * Vérifie si PostgreSQL est disponible
     */
    VectorStoreFactory.isPostgreSQLAvailable = function () {
        try {
            // Essayer de charger le module
            require('pg');
            return true;
        }
        catch (_a) {
            return false;
        }
    };
    /**
     * Crée un vector store basé sur la configuration du projet
     * @param projectPath Chemin du projet
     * @returns Instance de vector store configurée
     */
    VectorStoreFactory.createFromProjectConfig = function (projectPath) {
        vector_store_interface_js_1.VectorStoreLogger.info('factory.project', "Cr\u00E9ation de vector store pour le projet: ".concat(projectPath));
        try {
            // Charger la configuration du projet
            var config = this.loadProjectConfig(projectPath);
            return this.create(config);
        }
        catch (error) {
            vector_store_interface_js_1.VectorStoreLogger.error('factory.project', "\u00C9chec de chargement de la configuration du projet", error, {
                projectPath: projectPath
            });
            // Configuration par défaut
            var defaultConfig = {
                type: 'sqlite',
                sqlite: {
                    file: "".concat(projectPath, "/rag/db/vectors.sqlite")
                }
            };
            return this.create(defaultConfig);
        }
    };
    /**
     * Charge la configuration du projet
     */
    VectorStoreFactory.loadProjectConfig = function (projectPath) {
        // Essayer de charger depuis rag/config/db.config.json
        var fs = require('fs');
        var path = require('path');
        var configPath = path.join(projectPath, 'rag', 'config', 'db.config.json');
        if (fs.existsSync(configPath)) {
            var configData = fs.readFileSync(configPath, 'utf8');
            var config = JSON.parse(configData);
            // Valider et normaliser la configuration
            return this.normalizeConfig(config);
        }
        // Configuration par défaut
        return {
            type: 'sqlite',
            sqlite: {
                file: path.join(projectPath, 'rag', 'db', 'vectors.sqlite')
            }
        };
    };
    /**
     * Normalise la configuration
     */
    VectorStoreFactory.normalizeConfig = function (config) {
        // S'assurer que le type est valide
        var type = config.type || 'sqlite';
        var normalized = {
            type: type
        };
        // Normaliser la configuration SQLite
        if (type === 'sqlite' && config.sqlite) {
            normalized.sqlite = {
                file: config.sqlite.file || ':memory:',
                memory: config.sqlite.memory || false,
                readonly: config.sqlite.readonly || false
            };
        }
        // Normaliser la configuration PostgreSQL
        if (type === 'postgresql' && config.postgresql) {
            normalized.postgresql = {
                host: config.postgresql.host || 'localhost',
                port: config.postgresql.port || 5432,
                database: config.postgresql.database || 'rag',
                user: config.postgresql.user || 'postgres',
                password: config.postgresql.password || '',
                ssl: config.postgresql.ssl || false,
                poolSize: config.postgresql.poolSize || 10
            };
        }
        // Normaliser la configuration mémoire
        if (type === 'memory' && config.memory) {
            normalized.memory = {
                maxDocuments: config.memory.maxDocuments || 10000,
                persistToFile: config.memory.persistToFile
            };
        }
        // Options communes
        if (config.options) {
            normalized.options = {
                enableCompression: config.options.enableCompression || false,
                compressionThreshold: config.options.compressionThreshold || 1000,
                enableCache: config.options.enableCache || true,
                cacheSize: config.options.cacheSize || 1000,
                vectorDimension: config.options.vectorDimension || 768,
                similarityFunction: config.options.similarityFunction || 'cosine'
            };
        }
        return normalized;
    };
    /**
     * Teste la connectivité d'un vector store
     * @param config Configuration à tester
     * @returns Résultat du test
     */
    VectorStoreFactory.testConnection = function (config) {
        return __awaiter(this, void 0, void 0, function () {
            var store, connected, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        vector_store_interface_js_1.VectorStoreLogger.info('factory.test', "Test de connexion pour backend: ".concat(config.type));
                        store = this.create(config);
                        return [4 /*yield*/, store.testConnection()];
                    case 1:
                        connected = _a.sent();
                        if (connected) {
                            return [2 /*return*/, {
                                    success: true,
                                    backend: config.type,
                                    message: "Connexion r\u00E9ussie au backend ".concat(config.type)
                                }];
                        }
                        else {
                            return [2 /*return*/, {
                                    success: false,
                                    backend: config.type,
                                    message: "\u00C9chec de connexion au backend ".concat(config.type)
                                }];
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _a.sent();
                        return [2 /*return*/, {
                                success: false,
                                backend: config.type,
                                message: "Erreur lors du test de connexion: ".concat(error_1 instanceof Error ? error_1.message : String(error_1)),
                                details: { error: error_1 }
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Obtient les backends disponibles
     */
    VectorStoreFactory.getAvailableBackends = function () {
        var backends = [
            {
                type: 'sqlite',
                available: true, // Toujours disponible
                description: 'Backend SQLite local (recommandé)'
            },
            {
                type: 'postgresql',
                available: this.isPostgreSQLAvailable(),
                description: 'Backend PostgreSQL pour production'
            },
            {
                type: 'memory',
                available: true, // Toujours disponible via fallback
                description: 'Backend mémoire pour tests'
            }
        ];
        return backends;
    };
    return VectorStoreFactory;
}());
exports.VectorStoreFactory = VectorStoreFactory;
/**
 * Fonction utilitaire pour créer un vector store
 * (Compatibilité avec l'ancien code)
 */
function createVectorStore(config) {
    return VectorStoreFactory.create(config);
}
/**
 * Fonction utilitaire pour créer un vector store depuis un projet
 */
function createVectorStoreForProject(projectPath) {
    return VectorStoreFactory.createFromProjectConfig(projectPath);
}
/**
 * Fonction utilitaire pour tester la connectivité
 */
function testVectorStoreConnection(config) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, VectorStoreFactory.testConnection(config)];
        });
    });
}
/**
 * Fonction utilitaire pour lister les backends disponibles
 */
function getAvailableVectorStoreBackends() {
    return VectorStoreFactory.getAvailableBackends();
}
