"use strict";
// src/core/tool-registry.ts
// ToolRegistry Core - Système central d'enregistrement des outils MCP
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
exports.toolRegistry = exports.ToolRegistry = void 0;
exports.createToolDefinition = createToolDefinition;
exports.validateToolArgs = validateToolArgs;
/**
 * Registry central pour la gestion des outils MCP
 *
 * Fonctionnalités :
 * - Enregistrement d'outils avec leurs handlers
 * - Récupération de la liste des outils disponibles
 * - Exécution d'outils par nom
 * - Vérification d'existence d'outils
 */
var ToolRegistry = /** @class */ (function () {
    function ToolRegistry() {
        this.tools = new Map();
        this.handlers = new Map();
    }
    /**
     * Enregistre un nouvel outil dans le registry
     * @param tool Définition de l'outil (nom, description, schéma)
     * @param handler Fonction d'exécution de l'outil
     * @throws Error si l'outil existe déjà
     */
    ToolRegistry.prototype.register = function (tool, handler) {
        if (this.tools.has(tool.name)) {
            throw new Error("Tool '".concat(tool.name, "' is already registered"));
        }
        this.tools.set(tool.name, tool);
        this.handlers.set(tool.name, handler);
    };
    /**
     * Récupère la définition d'un outil par son nom
     * @param name Nom de l'outil
     * @returns Définition de l'outil ou undefined
     */
    ToolRegistry.prototype.getTool = function (name) {
        return this.tools.get(name);
    };
    /**
     * Récupère la liste de tous les outils enregistrés
     * @returns Tableau de définitions d'outils
     */
    ToolRegistry.prototype.getTools = function () {
        return Array.from(this.tools.values());
    };
    /**
     * Vérifie si un outil est enregistré
     * @param name Nom de l'outil
     * @returns true si l'outil existe
     */
    ToolRegistry.prototype.hasTool = function (name) {
        return this.tools.has(name);
    };
    /**
     * Exécute un outil par son nom avec les arguments fournis
     * @param name Nom de l'outil
     * @param args Arguments de l'outil
     * @returns Résultat de l'exécution
     * @throws Error si l'outil n'existe pas
     */
    ToolRegistry.prototype.execute = function (name, args) {
        return __awaiter(this, void 0, void 0, function () {
            var handler, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        handler = this.handlers.get(name);
                        if (!handler) {
                            throw new Error("Tool '".concat(name, "' not found in registry"));
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, handler(args)];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        error_1 = _a.sent();
                        // Pas de logs sur stderr pour compatibilité MCP
                        throw error_1;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Supprime un outil du registry
     * @param name Nom de l'outil à supprimer
     * @returns true si l'outil a été supprimé
     */
    ToolRegistry.prototype.unregister = function (name) {
        var toolRemoved = this.tools.delete(name);
        var handlerRemoved = this.handlers.delete(name);
        return toolRemoved || handlerRemoved;
    };
    /**
     * Vide complètement le registry
     */
    ToolRegistry.prototype.clear = function () {
        this.tools.clear();
        this.handlers.clear();
    };
    /**
     * Récupère le nombre d'outils enregistrés
     * @returns Nombre d'outils
     */
    ToolRegistry.prototype.size = function () {
        return this.tools.size;
    };
    /**
     * Récupère les noms de tous les outils enregistrés
     * @returns Tableau de noms d'outils
     */
    ToolRegistry.prototype.getToolNames = function () {
        return Array.from(this.tools.keys());
    };
    /**
     * Filtre les outils par préfixe
     * @param prefix Préfixe à rechercher
     * @returns Outils dont le nom commence par le préfixe
     */
    ToolRegistry.prototype.filterByPrefix = function (prefix) {
        return this.getTools().filter(function (tool) { return tool.name.startsWith(prefix); });
    };
    /**
     * Filtre les outils par catégorie (basé sur le préfixe ou autre logique)
     * @param category Catégorie à rechercher
     * @returns Outils de la catégorie
     */
    ToolRegistry.prototype.filterByCategory = function (category) {
        if (category === 'graph') {
            // Outils graph: pas de préfixe spécifique
            return this.getTools().filter(function (tool) { return !tool.name.startsWith('rag_'); });
        }
        else if (category === 'rag') {
            // Outils RAG: préfixe "rag_"
            return this.filterByPrefix('rag_');
        }
        else {
            // Catégorie personnalisée
            return this.getTools().filter(function (tool) {
                return tool.name.toLowerCase().includes(category.toLowerCase());
            });
        }
    };
    return ToolRegistry;
}());
exports.ToolRegistry = ToolRegistry;
/**
 * Instance singleton du ToolRegistry pour une utilisation globale
 */
exports.toolRegistry = new ToolRegistry();
/**
 * Fonction utilitaire pour créer une définition d'outil
 */
function createToolDefinition(name, description, inputSchema) {
    return {
        name: name,
        description: description,
        inputSchema: inputSchema,
    };
}
/**
 * Fonction utilitaire pour valider les arguments d'un outil
 */
function validateToolArgs(args, expectedSchema) {
    // Implémentation basique - à améliorer avec une validation complète
    if (!args || typeof args !== 'object') {
        return false;
    }
    // Vérification des champs requis
    if (expectedSchema.required) {
        for (var _i = 0, _a = expectedSchema.required; _i < _a.length; _i++) {
            var requiredField = _a[_i];
            if (!(requiredField in args)) {
                return false;
            }
        }
    }
    return true;
}
