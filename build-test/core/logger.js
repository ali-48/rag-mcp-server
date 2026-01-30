"use strict";
// src/core/logger.ts
// Logger central MCP-compatible pour le serveur RAG
// Format JSON strict : stockage en mémoire uniquement
// Aucune sortie sur stdout/stderr pour compatibilité MCP
Object.defineProperty(exports, "__esModule", { value: true });
exports.loggerConfig = exports.logger = void 0;
exports.logToStderr = logToStderr;
exports.isMCPMode = isMCPMode;
exports.initLogger = initLogger;
exports.getLogs = getLogs;
exports.clearLogs = clearLogs;
exports.testLogger = testLogger;
// Stockage des logs en mémoire
var memoryLogs = [];
var MAX_LOG_ENTRIES = 1000;
/**
 * Stocke un log en mémoire (pas de sortie stdout/stderr)
 * Une ligne = un objet JSON stocké en mémoire
 */
function emit(log) {
    // Ajouter le log à la mémoire
    memoryLogs.push(log);
    // Limiter la taille de la mémoire
    if (memoryLogs.length > MAX_LOG_ENTRIES) {
        memoryLogs.splice(0, memoryLogs.length - MAX_LOG_ENTRIES);
    }
}
/**
 * Logger central MCP-compatible
 * Convention d'événements : rag.module.action.status
 *
 * Exemples :
 * - rag.init.start
 * - rag.init.fs.created
 * - rag.init.db.ready
 * - rag.phase0.detect.start
 * - rag.phase0.detect.done
 * - rag.phase1.embed.start
 * - rag.phase1.embed.error
 * - rag.vector.store.failed
 */
exports.logger = {
    /**
     * Log d'information
     * @param event - Événement structuré (ex: rag.init.start)
     * @param message - Message optionnel pour contexte humain
     * @param data - Données supplémentaires optionnelles
     */
    info: function (event, message, data) {
        emit({
            level: 'info',
            event: event,
            message: message,
            data: data,
            timestamp: new Date().toISOString()
        });
    },
    /**
     * Log d'avertissement
     * @param event - Événement structuré (ex: rag.db.connection.warning)
     * @param message - Message optionnel pour contexte humain
     * @param data - Données supplémentaires optionnelles
     */
    warn: function (event, message, data) {
        emit({
            level: 'warn',
            event: event,
            message: message,
            data: data,
            timestamp: new Date().toISOString()
        });
    },
    /**
     * Log d'erreur
     * @param event - Événement structuré (ex: rag.db.connection.failed)
     * @param message - Message optionnel pour contexte humain
     * @param data - Données supplémentaires optionnelles
     */
    error: function (event, message, data) {
        emit({
            level: 'error',
            event: event,
            message: message,
            data: data,
            timestamp: new Date().toISOString()
        });
    },
    /**
     * Log de débogage (utilisé uniquement en développement)
     * @param event - Événement structuré (ex: rag.debug.cache.hit)
     * @param message - Message optionnel pour contexte humain
     * @param data - Données supplémentaires optionnelles
     */
    debug: function (event, message, data) {
        emit({
            level: 'debug',
            event: event,
            message: message,
            data: data,
            timestamp: new Date().toISOString()
        });
    }
};
/**
 * Fonction utilitaire pour logger vers stderr (texte libre)
 * À utiliser uniquement pour les logs humains qui ne doivent pas être parsés par MCP
 * Note: Même stderr peut interférer avec MCP, utiliser avec précaution
 */
function logToStderr(message) {
    // En mode MCP, on n'écrit rien sur stderr
    if (!isMCPMode()) {
        process.stderr.write(message + '\n');
    }
}
/**
 * Fonction utilitaire pour vérifier si on est en mode MCP
 * Permet de conditionner certains logs
 */
function isMCPMode() {
    return process.env.MCP_MODE === 'true' ||
        process.argv.some(function (arg) { return arg.includes('mcp') || arg.includes('MCP'); });
}
/**
 * Configuration du logger
 */
exports.loggerConfig = {
    /**
     * Niveau de log minimum (par défaut: 'info')
     * Niveaux disponibles: debug < info < warn < error
     */
    level: 'info',
    /**
     * Activer/désactiver les logs de débogage
     */
    enableDebug: false,
    /**
     * Activer/désactiver les logs vers stderr
     */
    enableStderrLogs: true,
    /**
     * Filtre d'événements (regex)
     */
    eventFilter: null
};
/**
 * Initialise le logger avec une configuration
 */
function initLogger(config) {
    if (config) {
        Object.assign(exports.loggerConfig, config);
    }
    // Log de démarrage du logger
    exports.logger.info('rag.logger.init', 'Logger MCP initialisé', {
        level: exports.loggerConfig.level,
        enableDebug: exports.loggerConfig.enableDebug,
        enableStderrLogs: exports.loggerConfig.enableStderrLogs
    });
}
/**
 * Récupère les logs stockés en mémoire
 * @param limit Nombre maximum de logs à retourner (défaut: 100)
 * @param level Filtrer par niveau de log (optionnel)
 */
function getLogs(limit, level) {
    if (limit === void 0) { limit = 100; }
    var filteredLogs = memoryLogs;
    if (level) {
        filteredLogs = memoryLogs.filter(function (log) { return log.level === level; });
    }
    // Retourner les logs les plus récents en premier
    return filteredLogs.slice(-limit).reverse();
}
/**
 * Vide les logs en mémoire
 */
function clearLogs() {
    memoryLogs.length = 0;
}
/**
 * Test rapide du logger (silencieux en mode MCP)
 */
function testLogger() {
    // En mode MCP, on ne fait aucun console.log/error
    if (isMCPMode()) {
        exports.logger.info('rag.logger.test.start', 'Début du test du logger (mode MCP silencieux)');
        exports.logger.warn('rag.logger.test.warning', 'Ceci est un avertissement de test', { test: true });
        exports.logger.error('rag.logger.test.error', 'Ceci est une erreur de test', { code: 500 });
        if (exports.loggerConfig.enableDebug) {
            exports.logger.debug('rag.logger.test.debug', 'Ceci est un log de débogage');
        }
        exports.logger.info('rag.logger.test.done', 'Test du logger terminé (mode MCP)');
        return;
    }
    // Hors mode MCP, on peut afficher des logs de test
    exports.logger.info('rag.logger.test.start', 'Début du test du logger');
    exports.logger.warn('rag.logger.test.warning', 'Ceci est un avertissement de test', { test: true });
    exports.logger.error('rag.logger.test.error', 'Ceci est une erreur de test', { code: 500 });
    if (exports.loggerConfig.enableDebug) {
        exports.logger.debug('rag.logger.test.debug', 'Ceci est un log de débogage');
    }
    exports.logger.info('rag.logger.test.done', 'Test du logger terminé');
    // Afficher un résumé des logs (uniquement hors MCP, mais même hors MCP on évite console.log)
    var logs = getLogs(5);
    // Note: Même hors MCP, on évite console.log pour rester cohérent
}
// Initialisation automatique si exécuté directement
if (typeof require !== 'undefined' && require.main === module) {
    testLogger();
}
