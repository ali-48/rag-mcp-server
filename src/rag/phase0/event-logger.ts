// src/rag/phase0/event-logger.ts
// Journalisation structurée des événements Phase 0

import { FileEvent } from './file-watcher.js';
import { WorkspaceContext } from './workspace-detector.js';

/**
 * Niveaux de log
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

/**
 * Entrée de log structurée
 */
export interface LogEntry {
    /** ID unique du log */
    id: string;

    /** Niveau de log */
    level: LogLevel;

    /** Message du log */
    message: string;

    /** Timestamp */
    timestamp: Date;

    /** Source du log */
    source: string;

    /** Métadonnées supplémentaires */
    metadata: Record<string, any>;

    /** Contexte du workspace (si disponible) */
    workspaceContext?: Partial<WorkspaceContext>;

    /** Événement de fichier (si applicable) */
    fileEvent?: Partial<FileEvent>;
}

/**
 * Options du logger
 */
export interface LoggerOptions {
    /** Niveau de log minimum */
    minLevel?: LogLevel;

    /** Activer la sortie console */
    enableConsole?: boolean;

    /** Activer le stockage en mémoire */
    enableMemoryStorage?: boolean;

    /** Taille maximale du stockage en mémoire */
    maxMemoryEntries?: number;

    /** Activer le stockage fichier */
    enableFileStorage?: boolean;

    /** Chemin du fichier de log */
    logFilePath?: string;

    /** Format de sortie */
    format?: 'json' | 'text' | 'both';

    /** Inclure les métadonnées */
    includeMetadata?: boolean;
}

/**
 * Statistiques du logger
 */
export interface LoggerStats {
    /** Nombre total de logs */
    totalLogs: number;

    /** Logs par niveau */
    logsByLevel: Record<LogLevel, number>;

    /** Dernier log */
    lastLog?: LogEntry;

    /** Taille du stockage en mémoire */
    memorySize: number;

    /** Temps de démarrage */
    startedAt: Date;
}

/**
 * Logger structuré pour Phase 0
 */
export class Phase0Logger {
    private options: Required<LoggerOptions>;
    private memoryStorage: LogEntry[] = [];
    private stats: LoggerStats;
    private workspaceContext?: WorkspaceContext;

    constructor(options: LoggerOptions = {}) {
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
    setWorkspaceContext(context: WorkspaceContext): void {
        this.workspaceContext = context;
    }

    /**
     * Log un message
     */
    log(
        level: LogLevel,
        message: string,
        source: string,
        metadata: Record<string, any> = {},
        fileEvent?: Partial<FileEvent>
    ): LogEntry {
        // Vérifier le niveau de log
        if (!this.shouldLog(level)) {
            return this.createEmptyEntry();
        }

        // Créer l'entrée de log
        const entry: LogEntry = {
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
    debug(
        message: string,
        source: string,
        metadata: Record<string, any> = {},
        fileEvent?: Partial<FileEvent>
    ): LogEntry {
        return this.log('debug', message, source, metadata, fileEvent);
    }

    /**
     * Log de niveau info
     */
    info(
        message: string,
        source: string,
        metadata: Record<string, any> = {},
        fileEvent?: Partial<FileEvent>
    ): LogEntry {
        return this.log('info', message, source, metadata, fileEvent);
    }

    /**
     * Log de niveau warn
     */
    warn(
        message: string,
        source: string,
        metadata: Record<string, any> = {},
        fileEvent?: Partial<FileEvent>
    ): LogEntry {
        return this.log('warn', message, source, metadata, fileEvent);
    }

    /**
     * Log de niveau error
     */
    error(
        message: string,
        source: string,
        metadata: Record<string, any> = {},
        fileEvent?: Partial<FileEvent>
    ): LogEntry {
        return this.log('error', message, source, metadata, fileEvent);
    }

    /**
     * Log de niveau critical
     */
    critical(
        message: string,
        source: string,
        metadata: Record<string, any> = {},
        fileEvent?: Partial<FileEvent>
    ): LogEntry {
        return this.log('critical', message, source, metadata, fileEvent);
    }

    /**
     * Log un événement de fichier
     */
    logFileEvent(event: FileEvent, source: string = 'file-watcher'): LogEntry {
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
    logWorkspaceDetection(context: WorkspaceContext): LogEntry {
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
    private shouldLog(level: LogLevel): boolean {
        const levelPriority: Record<LogLevel, number> = {
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
    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Crée une entrée vide (pour les logs ignorés)
     */
    private createEmptyEntry(): LogEntry {
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
    private processLogEntry(entry: LogEntry): void {
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
    private outputToConsole(entry: LogEntry): void {
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
    private getLevelColor(level: LogLevel): string {
        const colors: Record<LogLevel, string> = {
            debug: '\x1b[36m', // Cyan
            info: '\x1b[32m',  // Vert
            warn: '\x1b[33m',  // Jaune
            error: '\x1b[31m', // Rouge
            critical: '\x1b[41m\x1b[37m', // Fond rouge, texte blanc
        };

        return colors[level] || '\x1b[0m';
    }

    /**
     * Sortie vers fichier
     */
    private outputToFile(entry: LogEntry): void {
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
        } catch (error) {
            // En cas d'erreur, log dans la console
            console.error('Failed to write log to file:', error);
        }
    }

    /**
     * S'assure que le répertoire de logs existe
     */
    private ensureLogDirectory(): void {
        try {
            const fs = require('fs');
            const path = require('path');

            const logDir = path.dirname(this.options.logFilePath);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
        } catch (error) {
            console.error('Failed to create log directory:', error);
        }
    }

    /**
     * Obtient les logs stockés en mémoire
     */
    getLogs(filter?: {
        level?: LogLevel;
        source?: string;
        since?: Date;
        limit?: number;
    }): LogEntry[] {
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
                logs = logs.filter(log => log.timestamp >= filter.since!);
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
    getStats(): LoggerStats {
        return {
            ...this.stats,
            memorySize: this.memoryStorage.length,
        };
    }

    /**
     * Vide le stockage en mémoire
     */
    clearMemoryStorage(): void {
        this.memoryStorage = [];
        this.stats.memorySize = 0;
    }

    /**
     * Exporte les logs au format JSON
     */
    exportLogs(format: 'json' | 'csv' = 'json'): string {
        if (format === 'json') {
            return JSON.stringify(this.memoryStorage, null, 2);
        } else {
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
let globalLogger: Phase0Logger | null = null;

/**
 * Initialise le logger global
 */
export function initGlobalLogger(options?: LoggerOptions): Phase0Logger {
    if (!globalLogger) {
        globalLogger = new Phase0Logger(options);
    }
    return globalLogger;
}

/**
 * Obtient le logger global
 */
export function getGlobalLogger(): Phase0Logger {
    if (!globalLogger) {
        return initGlobalLogger();
    }
    return globalLogger;
}

/**
 * Utilitaire : Crée un logger pré-configuré pour Phase 0
 */
export function createPhase0Logger(workspaceContext?: WorkspaceContext): Phase0Logger {
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
    console.log('🧪 Test du event logger...');

    const logger = createPhase0Logger();

    // Tester différents niveaux de log
    logger.debug('Message debug', 'test');
    logger.info('Message info', 'test', { test: true });
    logger.warn('Message warn', 'test');
    logger.error('Message error', 'test');

    // Tester le log d'événement de fichier
    const mockFileEvent: FileEvent = {
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
    console.log('📊 Statistiques du logger:');
    console.log(`  Total logs: ${stats.totalLogs}`);
    console.log(`  Par niveau:`, stats.logsByLevel);
    console.log(`  Taille mémoire: ${stats.memorySize}`);

    // Exporter les logs
    const logs = logger.getLogs({ limit: 3 });
    console.log('📝 Derniers logs:');
    logs.forEach(log => {
        console.log(`  [${log.level}] ${log.message}`);
    });

    console.log('✅ Test du event logger réussi !');
}
