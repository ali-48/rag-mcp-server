/**
 * Logger structuré pour la capture passive
 *
 * Conforme aux règles R3, R10, R17 :
 * - Logs structurés au format JSON
 * - Séparation stdout/stderr
 * - Pas d'interaction humaine
 */

import * as vscode from 'vscode';

/**
 * Niveaux de log
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * Interface pour les entrées de log
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  source?: string;
}

/**
 * Logger structuré pour la capture passive
 */
export class StructuredLogger {
  private static instance: StructuredLogger;
  private logLevel: LogLevel = LogLevel.INFO;
  private outputChannel: vscode.OutputChannel;
  private isEnabled = true;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('RAG Context Capture');
    this.log(LogLevel.INFO, 'Logger structuré initialisé', {
      log_level: this.logLevel,
      version: '1.0.0'
    });
  }

  /**
   * Obtient l'instance singleton
   */
  public static getInstance(): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger();
    }
    return StructuredLogger.instance;
  }

  /**
   * Configure le niveau de log
   */
  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.log(LogLevel.INFO, 'Niveau de log modifié', { new_level: level });
  }

  /**
   * Active/désactive le logger
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    this.log(LogLevel.INFO, `Logger ${enabled ? 'activé' : 'désactivé'}`);
  }

  /**
   * Log un message avec niveau et contexte
   */
  public log(level: LogLevel, message: string, context?: Record<string, any>, source?: string): void {
    if (!this.isEnabled) {
      return;
    }

    // Vérifier si le niveau de log est suffisant
    const levelPriority = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.ERROR]: 3
    };

    if (levelPriority[level] < levelPriority[this.logLevel]) {
      return;
    }

    // Créer l'entrée de log
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      source: source || 'context-capture'
    };

    // Formater pour la sortie
    const formatted = this.formatEntry(entry);

    // Écrire dans le canal de sortie VS Code
    this.outputChannel.appendLine(formatted);

    // Écrire dans la console pour debug (seulement en développement)
    if (process.env.NODE_ENV === 'development') {
      const consoleMessage = this.formatForConsole(entry);
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(consoleMessage);
          break;
        case LogLevel.INFO:
          console.info(consoleMessage);
          break;
        case LogLevel.WARN:
          console.warn(consoleMessage);
          break;
        case LogLevel.ERROR:
          console.error(consoleMessage);
          break;
      }
    }
  }

  /**
   * Format une entrée de log pour la sortie
   */
  private formatEntry(entry: LogEntry): string {
    return JSON.stringify(entry, null, 2);
  }

  /**
   * Format une entrée de log pour la console
   */
  private formatForConsole(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const level = entry.level.toUpperCase().padEnd(5);
    const source = entry.source ? `[${entry.source}]` : '';
    const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';

    return `${timestamp} ${level} ${source} ${entry.message}${context}`;
  }

  /**
   * Log de debug
   */
  public debug(message: string, context?: Record<string, any>, source?: string): void {
    this.log(LogLevel.DEBUG, message, context, source);
  }

  /**
   * Log d'information
   */
  public info(message: string, context?: Record<string, any>, source?: string): void {
    this.log(LogLevel.INFO, message, context, source);
  }

  /**
   * Log d'avertissement
   */
  public warn(message: string, context?: Record<string, any>, source?: string): void {
    this.log(LogLevel.WARN, message, context, source);
  }

  /**
   * Log d'erreur
   */
  public error(message: string, context?: Record<string, any>, source?: string): void {
    this.log(LogLevel.ERROR, message, context, source);
  }

  /**
   * Affiche le canal de sortie
   */
  public showOutputChannel(): void {
    this.outputChannel.show();
  }

  /**
   * Nettoie les logs
   */
  public clear(): void {
    this.outputChannel.clear();
  }

  /**
   * Dispose les ressources
   */
  public dispose(): void {
    this.outputChannel.dispose();
  }
}

// Export de l'instance singleton
export const logger = StructuredLogger.getInstance();
