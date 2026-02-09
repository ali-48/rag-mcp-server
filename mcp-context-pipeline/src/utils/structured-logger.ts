/**
 * Logger structuré pour le pipeline MCP
 * Conforme aux règles R3, R17 : logs JSON structurés séparés du JSON métier
 */

import path from 'path';
import winston from 'winston';

/**
 * Format JSON structuré pour les logs
 */
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Format texte enrichi pour la console (développement)
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

/**
 * Configuration des transports
 */
const transports = [];

// Transport console (tous les environnements)
transports.push(
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? jsonFormat : consoleFormat,
    level: process.env.LOG_LEVEL || 'info',
  })
);

// Transport fichier (production uniquement)
if (process.env.NODE_ENV === 'production') {
  const logDir = process.env.LOG_DIR || './logs';
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: jsonFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  );
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: jsonFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  );
}

/**
 * Instance du logger
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: jsonFormat,
  defaultMeta: {
    service: 'mcp-context-pipeline',
    version: process.env.npm_package_version || '0.1.0',
  },
  transports,
  exitOnError: false,
});

/**
 * Helper pour logger les événements VS Code
 */
export function logVSCodeEvent(eventType: string, metadata: Record<string, any> = {}) {
  logger.info(`Événement VS Code capturé: ${eventType}`, {
    event_type: eventType,
    ...metadata,
  });
}

/**
 * Helper pour logger les erreurs de validation
 */
export function logValidationError(error: Error, context: Record<string, any> = {}) {
  logger.error('Erreur de validation JSON Schema', {
    error: error.message,
    validation_errors: (error as any).errors,
    ...context,
  });
}

/**
 * Helper pour logger les opérations de stockage
 */
export function logStorageOperation(
  operation: string,
  table: string,
  metadata: Record<string, any> = {}
) {
  logger.debug(`Opération de stockage: ${operation}`, {
    operation,
    table,
    ...metadata,
  });
}

/**
 * Helper pour logger les performances
 */
export function logPerformance(
  operation: string,
  durationMs: number,
  metadata: Record<string, any> = {}
) {
  logger.debug(`Performance: ${operation}`, {
    operation,
    duration_ms: durationMs,
    ...metadata,
  });
}

/**
 * Interface pour les métadonnées de log
 */
export interface LogMetadata {
  [key: string]: any;
}

/**
 * Type guard pour vérifier si un objet est une erreur
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export default logger;
