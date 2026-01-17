/**
 * Utilitaires de logging pour l'audit de code
 * Structure organisée avec timestamp, durée, erreurs
 */

import * as fs from 'fs';
import * as path from 'path';

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  duration?: number; // en millisecondes
  error?: Error;
  metadata?: Record<string, any>;
}

export interface AuditLogConfig {
  logDir: string;
  maxFiles: number;
  maxFileSize: number; // en bytes
  timestampFormat: string;
  includeConsole: boolean;
  logLevel: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
}

export class AuditLogger {
  private config: AuditLogConfig;
  private currentLogFile: string | null = null;
  private startTime: number;

  constructor(config?: Partial<AuditLogConfig>) {
    this.config = {
      logDir: 'audit/logs',
      maxFiles: 30,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      timestampFormat: 'YYYYMMDD_HHmmss',
      includeConsole: true,
      logLevel: 'INFO',
      ...config
    };

    this.startTime = Date.now();
    this.ensureLogDirectory();
  }

  /**
   * Crée le répertoire de logs s'il n'existe pas
   */
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.config.logDir)) {
      fs.mkdirSync(this.config.logDir, { recursive: true });
    }
  }

  /**
   * Génère un nom de fichier de log avec timestamp
   */
  private generateLogFileName(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `audit_${year}${month}${day}_${hours}${minutes}${seconds}.log`;
  }

  /**
   * Obtient le fichier de log actuel
   */
  private getCurrentLogFile(): string {
    if (!this.currentLogFile) {
      this.currentLogFile = path.join(this.config.logDir, this.generateLogFileName());
    }

    // Vérifier la taille du fichier
    if (fs.existsSync(this.currentLogFile)) {
      const stats = fs.statSync(this.currentLogFile);
      if (stats.size > this.config.maxFileSize) {
        this.currentLogFile = path.join(this.config.logDir, this.generateLogFileName());
      }
    }

    return this.currentLogFile;
  }

  /**
   * Formate une entrée de log
   */
  private formatLogEntry(entry: LogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.level}]`,
      entry.message
    ];

    if (entry.duration !== undefined) {
      parts.push(`(duration: ${entry.duration}ms)`);
    }

    if (entry.error) {
      parts.push(`\nError: ${entry.error.message}`);
      if (entry.error.stack) {
        parts.push(`\nStack: ${entry.error.stack}`);
      }
    }

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      parts.push(`\nMetadata: ${JSON.stringify(entry.metadata, null, 2)}`);
    }

    return parts.join(' ') + '\n';
  }

  /**
   * Écrit une entrée de log
   */
  private writeLog(entry: LogEntry): void {
    const logFile = this.getCurrentLogFile();
    const formattedEntry = this.formatLogEntry(entry);

    // Écrire dans le fichier
    fs.appendFileSync(logFile, formattedEntry, 'utf8');

    // Écrire dans la console si configuré
    if (this.config.includeConsole) {
      const consoleEntry = this.formatLogEntry(entry);
      switch (entry.level) {
        case 'ERROR':
          console.error(consoleEntry);
          break;
        case 'WARN':
          console.warn(consoleEntry);
          break;
        default:
          console.log(consoleEntry);
      }
    }
  }

  /**
   * Vérifie si un niveau de log doit être enregistré
   */
  private shouldLog(level: LogEntry['level']): boolean {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const configLevelIndex = levels.indexOf(this.config.logLevel);
    const entryLevelIndex = levels.indexOf(level);
    return entryLevelIndex >= configLevelIndex;
  }

  /**
   * Crée une entrée de log
   */
  private createLogEntry(level: LogEntry['level'], message: string, options?: {
    duration?: number;
    error?: Error;
    metadata?: Record<string, any>;
  }): LogEntry {
    const now = new Date();
    const timestamp = now.toISOString();

    return {
      timestamp,
      level,
      message,
      duration: options?.duration,
      error: options?.error,
      metadata: options?.metadata
    };
  }

  /**
   * Log un message INFO
   */
  info(message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog('INFO')) return;

    const entry = this.createLogEntry('INFO', message, { metadata });
    this.writeLog(entry);
  }

  /**
   * Log un message WARN
   */
  warn(message: string, error?: Error, metadata?: Record<string, any>): void {
    if (!this.shouldLog('WARN')) return;

    const entry = this.createLogEntry('WARN', message, { error, metadata });
    this.writeLog(entry);
  }

  /**
   * Log un message ERROR
   */
  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    if (!this.shouldLog('ERROR')) return;

    const entry = this.createLogEntry('ERROR', message, { error, metadata });
    this.writeLog(entry);
  }

  /**
   * Log un message DEBUG
   */
  debug(message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog('DEBUG')) return;

    const entry = this.createLogEntry('DEBUG', message, { metadata });
    this.writeLog(entry);
  }

  /**
   * Démarre un timer pour mesurer la durée
   */
  startTimer(label: string): () => number {
    const start = Date.now();

    return (): number => {
      const duration = Date.now() - start;
      this.info(`${label} completed`, { duration, label });
      return duration;
    };
  }

  /**
   * Log le début d'une opération
   */
  startOperation(operation: string, metadata?: Record<string, any>): void {
    this.info(`Starting: ${operation}`, metadata);
  }

  /**
   * Log la fin d'une opération avec durée
   */
  endOperation(operation: string, startTime: number, metadata?: Record<string, any>): void {
    const duration = Date.now() - startTime;
    this.info(`Completed: ${operation}`, { ...metadata, duration });
  }

  /**
   * Génère un rapport de log
   */
  generateLogReport(): {
    totalEntries: number;
    byLevel: Record<string, number>;
    errors: LogEntry[];
    warnings: LogEntry[];
    averageDuration: number;
  } {
    const logDir = this.config.logDir;
    const files = fs.readdirSync(logDir).filter(f => f.endsWith('.log'));

    let totalEntries = 0;
    const byLevel: Record<string, number> = { INFO: 0, WARN: 0, ERROR: 0, DEBUG: 0 };
    const errors: LogEntry[] = [];
    const warnings: LogEntry[] = [];
    let totalDuration = 0;
    let durationCount = 0;

    for (const file of files) {
      const filePath = path.join(logDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      for (const line of lines) {
        totalEntries++;

        // Analyser la ligne (simplifié)
        if (line.includes('[ERROR]')) {
          byLevel.ERROR++;
          errors.push(this.parseLogLine(line));
        } else if (line.includes('[WARN]')) {
          byLevel.WARN++;
          warnings.push(this.parseLogLine(line));
        } else if (line.includes('[INFO]')) {
          byLevel.INFO++;
        } else if (line.includes('[DEBUG]')) {
          byLevel.DEBUG++;
        }

        // Extraire la durée
        const durationMatch = line.match(/duration: (\d+)ms/);
        if (durationMatch) {
          totalDuration += parseInt(durationMatch[1], 10);
          durationCount++;
        }
      }
    }

    return {
      totalEntries,
      byLevel,
      errors,
      warnings,
      averageDuration: durationCount > 0 ? totalDuration / durationCount : 0
    };
  }

  /**
   * Parse une ligne de log (simplifié)
   */
  private parseLogLine(line: string): LogEntry {
    const timestampMatch = line.match(/\[([^\]]+)\]/);
    const levelMatch = line.match(/\[(INFO|WARN|ERROR|DEBUG)\]/);
    const durationMatch = line.match(/duration: (\d+)ms/);

    return {
      timestamp: timestampMatch ? timestampMatch[1] : new Date().toISOString(),
      level: (levelMatch ? levelMatch[1] : 'INFO') as LogEntry['level'],
      message: line.split(']').slice(2).join(']').trim(),
      duration: durationMatch ? parseInt(durationMatch[1], 10) : undefined
    };
  }

  /**
   * Nettoie les anciens fichiers de log
   */
  cleanupOldLogs(): void {
    const logDir = this.config.logDir;
    if (!fs.existsSync(logDir)) return;

    const files = fs.readdirSync(logDir)
      .filter(f => f.endsWith('.log'))
      .map(f => ({
        name: f,
        path: path.join(logDir, f),
        time: fs.statSync(path.join(logDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // Plus récent en premier

    // Supprimer les fichiers excédentaires
    if (files.length > this.config.maxFiles) {
      const toDelete = files.slice(this.config.maxFiles);

      for (const file of toDelete) {
        try {
          fs.unlinkSync(file.path);
          this.info(`Deleted old log file: ${file.name}`);
        } catch (error) {
          this.error(`Failed to delete log file: ${file.name}`, error as Error);
        }
      }
    }
  }

  /**
   * Crée un résumé de l'exécution
   */
  createExecutionSummary(options: {
    operation: string;
    startTime: number;
    filesProcessed: number;
    errors: number;
    warnings: number;
    outputSize: number;
    metadata?: Record<string, any>;
  }): void {
    const duration = Date.now() - options.startTime;
    const summary = {
      operation: options.operation,
      duration,
      filesProcessed: options.filesProcessed,
      errors: options.errors,
      warnings: options.warnings,
      outputSize: options.outputSize,
      filesPerSecond: options.filesProcessed / (duration / 1000),
      ...options.metadata
    };

    this.info('Execution summary', summary);

    // Écrire un fichier de résumé
    const summaryFile = path.join(this.config.logDir, `summary_${Date.now()}.json`);
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2), 'utf8');
  }
}

// Instance globale par défaut
export const defaultLogger = new AuditLogger();

// Fonctions utilitaires exportées
export function createLogger(config?: Partial<AuditLogConfig>): AuditLogger {
  return new AuditLogger(config);
}

export function logInfo(message: string, metadata?: Record<string, any>): void {
  defaultLogger.info(message, metadata);
}

export function logWarn(message: string, error?: Error, metadata?: Record<string, any>): void {
  defaultLogger.warn(message, error, metadata);
}

export function logError(message: string, error?: Error, metadata?: Record<string, any>): void {
  defaultLogger.error(message, error, metadata);
}

export function logDebug(message: string, metadata?: Record<string, any>): void {
  defaultLogger.debug(message, metadata);
}

export function startTimer(label: string): () => number {
  return defaultLogger.startTimer(label);
}

export function startOperation(operation: string, metadata?: Record<string, any>): void {
  defaultLogger.startOperation(operation, metadata);
}

export function endOperation(operation: string, startTime: number, metadata?: Record<string, any>): void {
  defaultLogger.endOperation(operation, startTime, metadata);
}
