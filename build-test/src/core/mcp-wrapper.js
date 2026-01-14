// src/core/mcp-wrapper.ts
// Wrapper pour garantir JSON strict dans toutes les réponses MCP
// Redirige les logs vers logger.ts et empêche toute sortie non-JSON sur stdout
import { logger } from './logger.js';
/**
 * Classe principale du wrapper MCP
 */
export class MCPWrapper {
    requestId;
    version;
    logLevel;
    validateOutputSchema;
    redirectLogs;
    startTime;
    constructor(options = {}) {
        this.requestId = options.requestId || this.generateRequestId();
        this.version = options.version || '1.0.0';
        this.logLevel = options.logLevel || 'info';
        this.validateOutputSchema = options.validateOutputSchema ?? true;
        this.redirectLogs = options.redirectLogs ?? true;
        this.startTime = Date.now();
        // Rediriger les logs si demandé
        if (this.redirectLogs) {
            this.setupLogRedirection();
        }
    }
    /**
     * Génère un ID de requête unique
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Configure la redirection des logs
     */
    setupLogRedirection() {
        // Sauvegarder les fonctions originales
        const originalConsole = {
            log: console.log,
            info: console.info,
            warn: console.warn,
            error: console.error,
            debug: console.debug
        };
        // Rediriger console.log vers logger.info
        console.log = (...args) => {
            logger.info('mcp.console.log', args.join(' '), {
                requestId: this.requestId,
                source: 'console.log'
            });
        };
        // Rediriger console.info vers logger.info
        console.info = (...args) => {
            logger.info('mcp.console.info', args.join(' '), {
                requestId: this.requestId,
                source: 'console.info'
            });
        };
        // Rediriger console.warn vers logger.warn
        console.warn = (...args) => {
            logger.warn('mcp.console.warn', args.join(' '), {
                requestId: this.requestId,
                source: 'console.warn'
            });
        };
        // Rediriger console.error vers logger.error
        console.error = (...args) => {
            const message = args.join(' ');
            logger.error('mcp.console.error', message, {
                requestId: this.requestId,
                source: 'console.error',
                error: message
            });
        };
        // Rediriger console.debug vers logger.debug
        console.debug = (...args) => {
            logger.debug('mcp.console.debug', args.join(' '), {
                requestId: this.requestId,
                source: 'console.debug'
            });
        };
        // Restaurer les fonctions originales à la fin
        this.onCleanup(() => {
            console.log = originalConsole.log;
            console.info = originalConsole.info;
            console.warn = originalConsole.warn;
            console.error = originalConsole.error;
            console.debug = originalConsole.debug;
        });
    }
    /**
     * Enveloppe une fonction pour garantir une réponse JSON stricte
     */
    async wrap(fn, options = {}) {
        const { operationName = 'unknown', logSuccess = true, logError = true } = options;
        const operationStartTime = Date.now();
        try {
            // Log du début de l'opération
            logger.info('mcp.operation.start', `Début de l'opération: ${operationName}`, {
                requestId: this.requestId,
                operationName
            });
            // Exécuter la fonction
            const result = await fn();
            const duration = Date.now() - operationStartTime;
            // Valider le résultat si demandé
            if (this.validateOutputSchema) {
                this.validateResult(result);
            }
            // Log du succès si demandé
            if (logSuccess) {
                logger.info('mcp.operation.success', `Opération réussie: ${operationName}`, {
                    requestId: this.requestId,
                    operationName,
                    durationMs: duration,
                    resultType: typeof result
                });
            }
            // Retourner la réponse JSON
            return this.createSuccessResponse(result, duration);
        }
        catch (error) {
            const duration = Date.now() - operationStartTime;
            // Log de l'erreur si demandé
            if (logError) {
                logger.error('mcp.operation.error', `Erreur lors de l'opération: ${operationName}`, {
                    requestId: this.requestId,
                    operationName,
                    durationMs: duration,
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined
                });
            }
            // Retourner la réponse d'erreur JSON
            return this.createErrorResponse(error, duration);
        }
    }
    /**
     * Crée une réponse de succès
     */
    createSuccessResponse(data, duration) {
        return {
            success: true,
            data,
            metadata: {
                timestamp: new Date().toISOString(),
                version: this.version,
                requestId: this.requestId,
                durationMs: duration
            }
        };
    }
    /**
     * Crée une réponse d'erreur
     */
    createErrorResponse(error, duration) {
        // Extraire le code d'erreur si disponible
        let errorCode = 'UNKNOWN_ERROR';
        let errorMessage = error.message || 'Une erreur inconnue est survenue';
        let errorDetails = undefined;
        // Si l'erreur a des propriétés personnalisées
        if ('code' in error && typeof error.code === 'string') {
            errorCode = error.code;
        }
        // Si l'erreur a des détails
        if ('details' in error) {
            errorDetails = error.details;
        }
        return {
            success: false,
            error: {
                code: errorCode,
                message: errorMessage,
                details: errorDetails
            },
            metadata: {
                timestamp: new Date().toISOString(),
                version: this.version,
                requestId: this.requestId,
                durationMs: duration
            }
        };
    }
    /**
     * Valide qu'un résultat peut être sérialisé en JSON
     */
    validateResult(result) {
        try {
            // Essayer de sérialiser en JSON
            JSON.stringify(result);
            // Vérifier les types non supportés
            this.checkForUnsupportedTypes(result);
        }
        catch (error) {
            throw new Error(`Le résultat ne peut pas être sérialisé en JSON: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Vérifie la présence de types non supportés par JSON
     */
    checkForUnsupportedTypes(obj, path = '') {
        if (obj === null || obj === undefined) {
            return;
        }
        const type = typeof obj;
        if (type === 'function') {
            throw new Error(`Type non supporté dans la réponse JSON: fonction à ${path}`);
        }
        if (type === 'symbol') {
            throw new Error(`Type non supporté dans la réponse JSON: symbole à ${path}`);
        }
        if (obj instanceof Date) {
            // Les dates sont supportées mais seront converties en string
            return;
        }
        if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
                this.checkForUnsupportedTypes(item, `${path}[${index}]`);
            });
            return;
        }
        if (type === 'object') {
            Object.keys(obj).forEach(key => {
                this.checkForUnsupportedTypes(obj[key], path ? `${path}.${key}` : key);
            });
        }
    }
    /**
     * Enregistre une fonction de nettoyage
     */
    cleanupCallbacks = [];
    onCleanup(callback) {
        this.cleanupCallbacks.push(callback);
    }
    /**
     * Nettoie les ressources
     */
    cleanup() {
        // Exécuter tous les callbacks de nettoyage
        this.cleanupCallbacks.forEach(callback => {
            try {
                callback();
            }
            catch (error) {
                logger.error('mcp.cleanup.error', 'Erreur lors du nettoyage', {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined
                });
            }
        });
        // Log de la durée totale
        const totalDuration = Date.now() - this.startTime;
        logger.info('mcp.wrapper.cleanup', 'Wrapper MCP nettoyé', {
            requestId: this.requestId,
            totalDurationMs: totalDuration
        });
    }
    /**
     * Obtient l'ID de la requête
     */
    getRequestId() {
        return this.requestId;
    }
    /**
     * Obtient les métadonnées de la requête
     */
    getMetadata() {
        const duration = Date.now() - this.startTime;
        return {
            timestamp: new Date().toISOString(),
            version: this.version,
            requestId: this.requestId,
            durationMs: duration
        };
    }
}
/**
 * Fonction utilitaire pour wrapper un outil MCP
 */
export function wrapMCPTool(toolFunction, options = {}) {
    const { toolName = 'unknown', ...wrapperOptions } = options;
    return async (...args) => {
        const wrapper = new MCPWrapper(wrapperOptions);
        try {
            const response = await wrapper.wrap(() => toolFunction(...args), {
                operationName: toolName,
                logSuccess: true,
                logError: true
            });
            wrapper.cleanup();
            return response;
        }
        catch (error) {
            // En cas d'erreur dans le wrapper lui-même
            wrapper.cleanup();
            return {
                success: false,
                error: {
                    code: 'WRAPPER_ERROR',
                    message: `Erreur dans le wrapper MCP: ${error instanceof Error ? error.message : String(error)}`
                },
                metadata: wrapper.getMetadata()
            };
        }
    };
}
/**
 * Fonction utilitaire pour wrapper un handler MCP existant
 */
export function wrapMCPHandler(handler, options = {}) {
    return async (request) => {
        const wrapper = new MCPWrapper({
            ...options,
            requestId: request.requestId || options.requestId
        });
        try {
            const response = await wrapper.wrap(() => handler(request), {
                operationName: request.method || 'unknown',
                logSuccess: true,
                logError: true
            });
            wrapper.cleanup();
            return response;
        }
        catch (error) {
            wrapper.cleanup();
            return {
                success: false,
                error: {
                    code: 'HANDLER_ERROR',
                    message: `Erreur dans le handler MCP: ${error instanceof Error ? error.message : String(error)}`
                },
                metadata: wrapper.getMetadata()
            };
        }
    };
}
/**
 * Middleware Express pour wrapper les réponses MCP
 */
export function mcpMiddleware(options = {}) {
    return (req, res, next) => {
        const wrapper = new MCPWrapper({
            ...options,
            requestId: req.headers['x-request-id'] || req.id || options.requestId
        });
        // Sauvegarder la fonction res.json originale
        const originalJson = res.json;
        // Wrapper res.json pour garantir JSON strict
        res.json = function (data) {
            // Valider les données si demandé
            if (options.validateOutputSchema !== false) {
                try {
                    wrapper['validateResult'](data);
                }
                catch (error) {
                    logger.error('mcp.middleware.validation', 'Validation JSON échouée', {
                        requestId: wrapper.getRequestId(),
                        error: error instanceof Error ? error.message : String(error),
                        stack: error instanceof Error ? error.stack : undefined
                    });
                    // Retourner une erreur de validation
                    const errorResponse = wrapper['createErrorResponse'](new Error(`Validation JSON échouée: ${error instanceof Error ? error.message : String(error)}`), Date.now() - wrapper['startTime']);
                    return originalJson.call(this, errorResponse);
                }
            }
            // Ajouter les métadonnées si ce n'est pas déjà une réponse MCP
            if (!data || typeof data !== 'object' || !('success' in data)) {
                data = wrapper['createSuccessResponse'](data, Date.now() - wrapper['startTime']);
            }
            // Appeler la fonction originale
            return originalJson.call(this, data);
        };
        // Nettoyer à la fin de la requête
        res.on('finish', () => {
            wrapper.cleanup();
        });
        next();
    };
}
/**
 * Export par défaut
 */
export default MCPWrapper;
//# sourceMappingURL=mcp-wrapper.js.map