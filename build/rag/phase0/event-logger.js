// src/rag/phase0/event-logger.ts
// Journalisation structurée des événements Phase 0
/**
 * Logger structuré pour Phase 0
 */
export class Phase0Logger {
    options;
    memoryStorage = [];
    stats;
    workspaceContext;
    constructor(options = {}) {
        this.options = {
            minLevel: options.minLevel ?? 'info',
            enableConsole: options.enableConsole ?? true,
            enableMemoryStorage: options.enableMemoryStorage ?? true,
            maxMemoryEntries: options.maxMemoryEntries ?? 1000,
            enableFileStorage: options.enableFileStorage ?? false,
            logFilePath: options.logFilePath ?? './logs/phase0.log',
            format: options.format ?? 'both',
            includeMetadata: options.includeMetadata ?? true,
        };
        this.stats = {
            totalLogs: 0,
            logsByLevel: {
                debug: 0,
                info: 0,
                warn: 0,
                error: 0,
                critical: 0,
            },
            memorySize: 0,
            startedAt: new Date(),
        };
        // Créer le répertoire de logs si nécessaire
        if (this.options.enableFileStorage) {
            this.ensureLogDirectory();
        }
    }
    /**
     * Définit le contexte du workspace
     */
    setWorkspaceContext(context) {
        this.workspaceContext = context;
    }
    /**
     * Log un message
     */
    log(level, message, source, metadata = {}, fileEvent) {
        // Vérifier le niveau de log
        if (!this.shouldLog(level)) {
            return this.createEmptyEntry();
        }
        // Créer l'entrée de log
        const entry = {
            id: this.generateId(),
            level,
            message,
            timestamp: new Date(),
            source,
            metadata: this.options.includeMetadata ? metadata : {},
            workspaceContext: this.workspaceContext ? {
                path: this.workspaceContext.path,
                vscodeWorkspace: this.workspaceContext.vscodeWorkspace,
                language: this.workspaceContext.language,
            } : undefined,
            fileEvent: fileEvent ? {
                type: fileEvent.type,
                path: fileEvent.path,
                relativePath: fileEvent.relativePath,
            } : undefined,
        };
        // Traiter le log
        this.processLogEntry(entry);
        return entry;
    }
    /**
     * Log de niveau debug
     */
    debug(message, source, metadata = {}, fileEvent) {
        return this.log('debug', message, source, metadata, fileEvent);
    }
    /**
     * Log de niveau info
     */
    info(message, source, metadata = {}, fileEvent) {
        return this.log('info', message, source, metadata, fileEvent);
    }
    /**
     * Log de niveau warn
     */
    warn(message, source, metadata = {}, fileEvent) {
        return this.log('warn', message, source, metadata, fileEvent);
    }
    /**
     * Log de niveau error
     */
    error(message, source, metadata = {}, fileEvent) {
        return this.log('error', message, source, metadata, fileEvent);
    }
    /**
     * Log de niveau critical
     */
    critical(message, source, metadata = {}, fileEvent) {
        return this.log('critical', message, source, metadata, fileEvent);
    }
    /**
     * Log un événement de fichier
     */
    logFileEvent(event, source = 'file-watcher') {
        const level = event.metadata.ignored ? 'debug' : 'info';
        const message = event.metadata.ignored
            ? `File ignored: ${event.relativePath}`
            : `File ${event.type}: ${event.relativePath}`;
        return this.log(level, message, source, {
            fileSize: event.metadata.size,
            fileExtension: event.metadata.extension,
            ignoreReason: event.metadata.ignoreReason,
        }, event);
    }
    /**
     * Log la détection d'un workspace
     */
    logWorkspaceDetection(context) {
        return this.info('Workspace detected', 'workspace-detector', {
            workspacePath: context.path,
            vscodeWorkspace: context.vscodeWorkspace,
            language: context.language,
            fileCount: context.metadata.fileCount,
            isGitRepo: context.metadata.isGitRepo,
            detectedBy: context.metadata.detectedBy,
        });
    }
    /**
     * Vérifie si un niveau doit être loggé
     */
    shouldLog(level) {
        const levelPriority = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
            critical: 4,
        };
        return levelPriority[level] >= levelPriority[this.options.minLevel];
    }
    /**
     * Génère un ID unique
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Crée une entrée vide (pour les logs ignorés)
     */
    createEmptyEntry() {
        return {
            id: '',
            level: 'debug',
            message: '',
            timestamp: new Date(),
            source: '',
            metadata: {},
        };
    }
    /**
     * Traite une entrée de log
     */
    processLogEntry(entry) {
        // Mettre à jour les statistiques
        this.stats.totalLogs++;
        this.stats.logsByLevel[entry.level]++;
        this.stats.lastLog = entry;
        // Stockage en mémoire
        if (this.options.enableMemoryStorage) {
            this.memoryStorage.push(entry);
            this.stats.memorySize = this.memoryStorage.length;
            // Limiter la taille du stockage
            if (this.memoryStorage.length > this.options.maxMemoryEntries) {
                this.memoryStorage = this.memoryStorage.slice(-this.options.maxMemoryEntries);
                this.stats.memorySize = this.memoryStorage.length;
            }
        }
        // Sortie console
        if (this.options.enableConsole) {
            this.outputToConsole(entry);
        }
        // Stockage fichier
        if (this.options.enableFileStorage) {
            this.outputToFile(entry);
        }
    }
    /**
     * Sortie vers la console
     */
    outputToConsole(entry) {
        const timestamp = entry.timestamp.toISOString().split('T')[1].slice(0, -1);
        const level = entry.level.toUpperCase().padEnd(8);
        const source = entry.source.padEnd(20);
        const message = entry.message;
        let output = '';
        if (this.options.format === 'json' || this.options.format === 'both') {
            output = JSON.stringify(entry, null, 2);
        }
        if (this.options.format === 'text' || this.options.format === 'both') {
            const color = this.getLevelColor(entry.level);
            const reset = '\x1b[0m';
            output = `${timestamp} ${color}${level}${reset} [${source}] ${message}`;
            if (entry.fileEvent) {
                output += ` (${entry.fileEvent.type} ${entry.fileEvent.relativePath})`;
            }
        }
        console.log(output);
    }
    /**
     * Obtient la couleur pour un niveau de log
     */
    getLevelColor(level) {
        const colors = {
            debug: '\x1b[36m', // Cyan
            info: '\x1b[32m', // Vert
            warn: '\x1b[33m', // Jaune
            error: '\x1b[31m', // Rouge
            critical: '\x1b[41m\x1b[37m', // Fond rouge, texte blanc
        };
        return colors[level] || '\x1b[0m';
    }
    /**
     * Sortie vers fichier
     */
    outputToFile(entry) {
        try {
            const fs = require('fs');
            const path = require('path');
            // S'assurer que le répertoire existe
            const logDir = path.dirname(this.options.logFilePath);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            // Formater l'entrée
            const formattedEntry = JSON.stringify(entry) + '\n';
            // Écrire dans le fichier
            fs.appendFileSync(this.options.logFilePath, formattedEntry, 'utf8');
        }
        catch (error) {
            // En cas d'erreur, log dans la console
            console.error('Failed to write log to file:', error);
        }
    }
    /**
     * S'assure que le répertoire de logs existe
     */
    ensureLogDirectory() {
        try {
            const fs = require('fs');
            const path = require('path');
            const logDir = path.dirname(this.options.logFilePath);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
        }
        catch (error) {
            console.error('Failed to create log directory:', error);
        }
    }
    /**
     * Obtient les logs stockés en mémoire
     */
    getLogs(filter) {
        let logs = [...this.memoryStorage];
        // Appliquer les filtres
        if (filter) {
            if (filter.level) {
                logs = logs.filter(log => log.level === filter.level);
            }
            if (filter.source) {
                logs = logs.filter(log => log.source === filter.source);
            }
            if (filter.since) {
                logs = logs.filter(log => log.timestamp >= filter.since);
            }
            if (filter.limit) {
                logs = logs.slice(-filter.limit);
            }
        }
        return logs;
    }
    /**
     * Obtient les statistiques
     */
    getStats() {
        return {
            ...this.stats,
            memorySize: this.memoryStorage.length,
        };
    }
    /**
     * Vide le stockage en mémoire
     */
    clearMemoryStorage() {
        this.memoryStorage = [];
        this.stats.memorySize = 0;
    }
    /**
     * Exporte les logs au format JSON
     */
    exportLogs(format = 'json') {
        if (format === 'json') {
            return JSON.stringify(this.memoryStorage, null, 2);
        }
        else {
            // Format CSV simple
            const headers = ['timestamp', 'level', 'source', 'message'];
            const rows = this.memoryStorage.map(log => [
                log.timestamp.toISOString(),
                log.level,
                log.source,
                log.message.replace(/"/g, '""')
            ]);
            const csv = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');
            return csv;
        }
    }
}
/**
 * Instance globale du logger
 */
let globalLogger = null;
/**
 * Initialise le logger global
 */
export function initGlobalLogger(options) {
    if (!globalLogger) {
        globalLogger = new Phase0Logger(options);
    }
    return globalLogger;
}
/**
 * Obtient le logger global
 */
export function getGlobalLogger() {
    if (!globalLogger) {
        return initGlobalLogger();
    }
    return globalLogger;
}
/**
 * Utilitaire : Crée un logger pré-configuré pour Phase 0
 */
export function createPhase0Logger(workspaceContext) {
    const logger = new Phase0Logger({
        minLevel: 'info',
        enableConsole: true,
        enableMemoryStorage: true,
        maxMemoryEntries: 500,
        enableFileStorage: false,
        format: 'both',
        includeMetadata: true,
    });
    if (workspaceContext) {
        logger.setWorkspaceContext(workspaceContext);
        logger.logWorkspaceDetection(workspaceContext);
    }
    return logger;
}
// Test unitaire si exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
    // Log silencieux pour MCP
    const logger = createPhase0Logger();
    // Tester différents niveaux de log
    logger.debug('Message debug', 'test');
    logger.info('Message info', 'test', { test: true });
    logger.warn('Message warn', 'test');
    logger.error('Message error', 'test');
    // Tester le log d'événement de fichier
    const mockFileEvent = {
        type: 'add',
        path: '/tmp/test.txt',
        relativePath: 'test.txt',
        timestamp: new Date(),
        metadata: {
            ignored: false,
            size: 1234,
            extension: 'txt',
        },
    };
    logger.logFileEvent(mockFileEvent);
    // Afficher les statistiques
    const stats = logger.getStats();
    // Log silencieux pour MCP
    // Exporter les logs
    const logs = logger.getLogs({ limit: 3 });
    // Log silencieux pour MCP
    // Log silencieux pour MCP
}
