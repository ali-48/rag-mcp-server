// src/core/log-redirect.ts
// Redirection globale des logs console.* vers logger.ts
// À importer au démarrage du serveur pour centraliser tous les logs
import { logger } from './logger.js';
/**
 * Sauvegarde des fonctions console originales
 */
const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug
};
/**
 * État de la redirection
 */
let isRedirected = false;
let currentConfig = {};
/**
 * Vérifie si un message doit être filtré
 */
function shouldFilter(message, config) {
    if (config.filterPattern && !config.filterPattern.test(message)) {
        return true;
    }
    if (config.excludePattern && config.excludePattern.test(message)) {
        return true;
    }
    return false;
}
/**
 * Obtient la pile d'appel (sans les frames internes)
 */
function getCleanStackTrace() {
    try {
        const stack = new Error().stack;
        if (!stack)
            return undefined;
        // Filtrer les frames internes
        const lines = stack.split('\n').slice(3); // Ignorer Error et les 2 premières frames
        const cleanLines = lines.filter(line => !line.includes('node:internal') &&
            !line.includes('log-redirect.ts') &&
            !line.includes('logger.ts'));
        return cleanLines.join('\n');
    }
    catch {
        return undefined;
    }
}
/**
 * Redirige les logs console.* vers logger
 */
export function redirectConsoleLogs(config = {}) {
    if (isRedirected) {
        logger.warn('log.redirect.already', 'Les logs console sont déjà redirigés');
        return;
    }
    currentConfig = {
        redirectLog: true,
        redirectInfo: true,
        redirectWarn: true,
        redirectError: true,
        redirectDebug: true,
        includeStackTrace: false,
        ...config
    };
    // Rediriger console.log
    if (currentConfig.redirectLog) {
        console.log = (...args) => {
            const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
            if (shouldFilter(message, currentConfig)) {
                return;
            }
            const data = {
                source: 'console.log',
                originalArgs: args.length > 1 ? args : undefined
            };
            if (currentConfig.includeStackTrace) {
                const stack = getCleanStackTrace();
                if (stack) {
                    data.stack = stack;
                }
            }
            logger.info('console.redirect.log', message, data);
        };
    }
    // Rediriger console.info
    if (currentConfig.redirectInfo) {
        console.info = (...args) => {
            const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
            if (shouldFilter(message, currentConfig)) {
                return;
            }
            const data = {
                source: 'console.info',
                originalArgs: args.length > 1 ? args : undefined
            };
            if (currentConfig.includeStackTrace) {
                const stack = getCleanStackTrace();
                if (stack) {
                    data.stack = stack;
                }
            }
            logger.info('console.redirect.info', message, data);
        };
    }
    // Rediriger console.warn
    if (currentConfig.redirectWarn) {
        console.warn = (...args) => {
            const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
            if (shouldFilter(message, currentConfig)) {
                return;
            }
            const data = {
                source: 'console.warn',
                originalArgs: args.length > 1 ? args : undefined
            };
            if (currentConfig.includeStackTrace) {
                const stack = getCleanStackTrace();
                if (stack) {
                    data.stack = stack;
                }
            }
            logger.warn('console.redirect.warn', message, data);
        };
    }
    // Rediriger console.error
    if (currentConfig.redirectError) {
        console.error = (...args) => {
            const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
            if (shouldFilter(message, currentConfig)) {
                return;
            }
            const data = {
                source: 'console.error',
                originalArgs: args.length > 1 ? args : undefined
            };
            if (currentConfig.includeStackTrace) {
                const stack = getCleanStackTrace();
                if (stack) {
                    data.stack = stack;
                }
            }
            logger.error('console.redirect.error', message, data);
        };
    }
    // Rediriger console.debug
    if (currentConfig.redirectDebug) {
        console.debug = (...args) => {
            const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
            if (shouldFilter(message, currentConfig)) {
                return;
            }
            const data = {
                source: 'console.debug',
                originalArgs: args.length > 1 ? args : undefined
            };
            if (currentConfig.includeStackTrace) {
                const stack = getCleanStackTrace();
                if (stack) {
                    data.stack = stack;
                }
            }
            logger.debug('console.redirect.debug', message, data);
        };
    }
    isRedirected = true;
    logger.info('log.redirect.enabled', 'Redirection des logs console activée', {
        config: currentConfig
    });
}
/**
 * Restaure les fonctions console originales
 */
export function restoreConsoleLogs() {
    if (!isRedirected) {
        logger.warn('log.redirect.not_active', 'Les logs console ne sont pas redirigés');
        return;
    }
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
    isRedirected = false;
    logger.info('log.redirect.disabled', 'Redirection des logs console désactivée');
}
/**
 * Vérifie si les logs sont redirigés
 */
export function isConsoleRedirected() {
    return isRedirected;
}
/**
 * Obtient la configuration actuelle
 */
export function getRedirectConfig() {
    return { ...currentConfig };
}
/**
 * Initialise la redirection des logs au démarrage
 * Cette fonction doit être appelée au début du programme
 */
export function initializeLogRedirection() {
    // Vérifier si on est en mode MCP
    const isMCPMode = process.env.MCP_MODE === 'true' ||
        process.argv.some(arg => arg.includes('mcp') || arg.includes('MCP'));
    if (isMCPMode) {
        // En mode MCP, rediriger tous les logs
        redirectConsoleLogs({
            includeStackTrace: false,
            filterPattern: undefined,
            excludePattern: /^$/
        });
        logger.info('log.redirect.mcp_mode', 'Mode MCP détecté, redirection complète activée');
    }
    else {
        // Hors mode MCP, rediriger mais permettre certains logs
        redirectConsoleLogs({
            includeStackTrace: false,
            filterPattern: undefined,
            excludePattern: /^(MCP|mcp)/
        });
        logger.info('log.redirect.normal_mode', 'Mode normal détecté, redirection partielle activée');
    }
}
/**
 * Export par défaut
 */
export default {
    redirectConsoleLogs,
    restoreConsoleLogs,
    isConsoleRedirected,
    getRedirectConfig,
    initializeLogRedirection
};
//# sourceMappingURL=log-redirect.js.map