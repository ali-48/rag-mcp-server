"use strict";
// src/rag/vector-store-interface.ts
// Interface abstraite pour le stockage vectoriel RAG
// Supporte SQLite, PostgreSQL, et autres backends via implémentation
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorStoreLogger = exports.VectorStoreError = void 0;
exports.validateVectorStoreConfig = validateVectorStoreConfig;
exports.createDocumentId = createDocumentId;
exports.parseDocumentId = parseDocumentId;
var logger_js_1 = require("../core/logger.js");
/**
 * Erreurs spécifiques au vector store
 */
var VectorStoreError = /** @class */ (function (_super) {
    __extends(VectorStoreError, _super);
    function VectorStoreError(message, code, context) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.context = context;
        _this.name = 'VectorStoreError';
        return _this;
    }
    return VectorStoreError;
}(Error));
exports.VectorStoreError = VectorStoreError;
/**
 * Valide une configuration de vector store
 */
function validateVectorStoreConfig(config) {
    var _a, _b, _c;
    var errors = [];
    if (!config.type) {
        errors.push('Le type de backend est requis');
    }
    switch (config.type) {
        case 'sqlite':
            if (!((_a = config.sqlite) === null || _a === void 0 ? void 0 : _a.file)) {
                errors.push('Le fichier SQLite est requis pour le backend SQLite');
            }
            break;
        case 'postgresql':
            if (!((_b = config.postgresql) === null || _b === void 0 ? void 0 : _b.host) || !((_c = config.postgresql) === null || _c === void 0 ? void 0 : _c.database)) {
                errors.push('L\'hôte et la base de données sont requis pour PostgreSQL');
            }
            break;
        case 'memory':
            // Pas de validation spécifique pour memory
            break;
        default:
            errors.push("Type de backend non support\u00E9: ".concat(config.type));
    }
    return errors;
}
/**
 * Crée un ID unique pour un document
 */
function createDocumentId(projectPath, filePath, chunkIndex) {
    var cleanFilePath = filePath.replace(/#chunk\d+$/, '');
    if (chunkIndex !== undefined) {
        return "".concat(projectPath, ":").concat(cleanFilePath, "#chunk").concat(chunkIndex);
    }
    return "".concat(projectPath, ":").concat(cleanFilePath);
}
/**
 * Extrait les informations d'un ID de document
 */
function parseDocumentId(id) {
    var _a = id.split(':', 2), projectPath = _a[0], rest = _a[1];
    if (!rest) {
        throw new VectorStoreError("ID de document invalide: ".concat(id), 'INVALID_DOCUMENT_ID');
    }
    var chunkMatch = rest.match(/#chunk(\d+)$/);
    if (chunkMatch) {
        var filePath = rest.replace(/#chunk\d+$/, '');
        var chunkIndex = parseInt(chunkMatch[1], 10);
        return {
            projectPath: projectPath,
            filePath: filePath,
            chunkIndex: chunkIndex
        };
    }
    return {
        projectPath: projectPath,
        filePath: rest
    };
}
/**
 * Wrapper de logger pour le vector store
 */
var VectorStoreLogger = /** @class */ (function () {
    function VectorStoreLogger() {
    }
    VectorStoreLogger.info = function (operation, message, context) {
        logger_js_1.logger.info("rag.vectorstore.".concat(operation), message, context);
    };
    VectorStoreLogger.error = function (operation, message, error, context) {
        logger_js_1.logger.error("rag.vectorstore.".concat(operation, ".error"), message, __assign(__assign({}, context), { error: (error === null || error === void 0 ? void 0 : error.message) || String(error) }));
    };
    VectorStoreLogger.warn = function (operation, message, context) {
        logger_js_1.logger.warn("rag.vectorstore.".concat(operation, ".warning"), message, context);
    };
    VectorStoreLogger.debug = function (operation, message, context) {
        logger_js_1.logger.debug("rag.vectorstore.".concat(operation, ".debug"), message, context);
    };
    return VectorStoreLogger;
}());
exports.VectorStoreLogger = VectorStoreLogger;
