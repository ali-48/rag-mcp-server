// src/rag/vector-store-interface.ts
// Interface abstraite pour le stockage vectoriel RAG
// Supporte SQLite, PostgreSQL, et autres backends via implémentation
import { logger } from '../core/logger.js';
/**
 * Erreurs spécifiques au vector store
 */
export class VectorStoreError extends Error {
    code;
    context;
    constructor(message, code, context) {
        super(message);
        this.code = code;
        this.context = context;
        this.name = 'VectorStoreError';
    }
}
/**
 * Valide une configuration de vector store
 */
export function validateVectorStoreConfig(config) {
    const errors = [];
    if (!config.type) {
        errors.push('Le type de backend est requis');
    }
    switch (config.type) {
        case 'sqlite':
            if (!config.sqlite?.file) {
                errors.push('Le fichier SQLite est requis pour le backend SQLite');
            }
            break;
        case 'postgresql':
            if (!config.postgresql?.host || !config.postgresql?.database) {
                errors.push('L\'hôte et la base de données sont requis pour PostgreSQL');
            }
            break;
        case 'memory':
            // Pas de validation spécifique pour memory
            break;
        default:
            errors.push(`Type de backend non supporté: ${config.type}`);
    }
    return errors;
}
/**
 * Crée un ID unique pour un document
 */
export function createDocumentId(projectPath, filePath, chunkIndex) {
    const cleanFilePath = filePath.replace(/#chunk\d+$/, '');
    if (chunkIndex !== undefined) {
        return `${projectPath}:${cleanFilePath}#chunk${chunkIndex}`;
    }
    return `${projectPath}:${cleanFilePath}`;
}
/**
 * Extrait les informations d'un ID de document
 */
export function parseDocumentId(id) {
    const [projectPath, rest] = id.split(':', 2);
    if (!rest) {
        throw new VectorStoreError(`ID de document invalide: ${id}`, 'INVALID_DOCUMENT_ID');
    }
    const chunkMatch = rest.match(/#chunk(\d+)$/);
    if (chunkMatch) {
        const filePath = rest.replace(/#chunk\d+$/, '');
        const chunkIndex = parseInt(chunkMatch[1], 10);
        return {
            projectPath,
            filePath,
            chunkIndex
        };
    }
    return {
        projectPath,
        filePath: rest
    };
}
/**
 * Wrapper de logger pour le vector store
 */
export class VectorStoreLogger {
    static info(operation, message, context) {
        logger.info(`rag.vectorstore.${operation}`, message, context);
    }
    static error(operation, message, error, context) {
        logger.error(`rag.vectorstore.${operation}.error`, message, {
            ...context,
            error: error?.message || String(error)
        });
    }
    static warn(operation, message, context) {
        logger.warn(`rag.vectorstore.${operation}.warning`, message, context);
    }
    static debug(operation, message, context) {
        logger.debug(`rag.vectorstore.${operation}.debug`, message, context);
    }
}
