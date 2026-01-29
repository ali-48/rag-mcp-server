// src/rag/streaming/scanner-error-collector.ts
// Collecte et gestion des erreurs pendant le scanning (Phase 1)
// Version: v1.0.0
// Responsabilités: Capturer, classifier et agréger les erreurs de scanning

import { logger } from '../../core/logger.js';
import type { FileError } from '../../types/errors.js';
import {
  createFileError,
  limitErrorsToTop,
  type ErrorList,
  type ErrorType
} from '../../types/errors.js';
import type { FileStreamer, FileStreamerOptions } from './file-streamer.js';

/**
 * Options pour le ScannerErrorCollector
 */
export interface ScannerErrorCollectorOptions extends FileStreamerOptions {
  /** Limite d'erreurs à collecter (0 = illimité) */
  maxErrors?: number;

  /** Limite d'erreurs à afficher dans le résultat final */
  displayLimit?: number;
}

/**
 * Résultat du scanning avec erreurs
 */
export interface ScanningResult {
  /** Nombre de fichiers scannés avec succès */
  filesScanned: number;

  /** Liste complète des erreurs avec résumé */
  errors: ErrorList;

  /** Temps total de scanning (ms) */
  duration: number;

  /** Octets traités */
  bytesProcessed: number;
}

/**
 * Classe pour collecter les erreurs pendant le scanning
 */
export class ScannerErrorCollector {
  private errors: FileError[] = [];
  private options: ScannerErrorCollectorOptions;
  private startTime: number = 0;

  /**
   * Constructeur
   */
  constructor(options: ScannerErrorCollectorOptions) {
    this.options = {
      maxErrors: options.maxErrors || 0, // 0 = illimité
      displayLimit: options.displayLimit || 50,
      ...options,
    };
  }

  /**
   * Enregistre une erreur de fichier
   */
  recordError(
    file: string,
    error: Error | string,
    type: ErrorType,
    metadata?: FileError['metadata']
  ): void {
    // Vérifier la limite d'erreurs
    if (this.options.maxErrors && this.errors.length >= this.options.maxErrors) {
      logger.debug('scanner.error.limit_reached', 'Limite d\'erreurs atteinte', {
        maxErrors: this.options.maxErrors,
        currentErrors: this.errors.length,
      });
      return;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    const fileError = createFileError(file, errorMessage, type, 'phase1', metadata);

    if (stack) {
      fileError.stack = stack;
    }

    this.errors.push(fileError);

    logger.debug('scanner.error.recorded', `Erreur enregistrée: ${file}`, {
      file,
      type,
      error: errorMessage,
    });
  }

  /**
   * Catégorise une erreur selon son message
   */
  private categorizeError(error: Error | string): ErrorType {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const lowerMessage = errorMessage.toLowerCase();

    if (lowerMessage.includes('enoent') || lowerMessage.includes('file not found')) {
      return 'FILE_NOT_FOUND';
    }

    if (lowerMessage.includes('eacces') || lowerMessage.includes('permission') || lowerMessage.includes('access denied')) {
      return 'ACCESS_DENIED';
    }

    if (lowerMessage.includes('encoding') || lowerMessage.includes('utf') || lowerMessage.includes('charset')) {
      return 'ENCODING_ERROR';
    }

    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      return 'TIMEOUT';
    }

    if (lowerMessage.includes('parse') || lowerMessage.includes('parsing') || lowerMessage.includes('syntax')) {
      return 'PARSING_ERROR';
    }

    if (lowerMessage.includes('network') || lowerMessage.includes('econnrefused') || lowerMessage.includes('enotfound')) {
      return 'NETWORK_ERROR';
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * Enregistre automatiquement une erreur en la catégorisant
   */
  recordAutoError(file: string, error: Error | string, metadata?: FileError['metadata']): void {
    const type = this.categorizeError(error);
    this.recordError(file, error, type, metadata);
  }

  /**
   * Wrapper autour de FileStreamer pour collecter les erreurs
   */
  async scanWithErrorCollection(fileStreamer: FileStreamer): Promise<ScanningResult> {
    this.startTime = Date.now();
    this.errors = []; // Reset

    let filesScanned = 0;
    let bytesProcessed = 0;

    // Intercepter les callbacks d'erreur
    const originalOnError = fileStreamer['options'].onError;

    fileStreamer['options'].onError = (error: Error, filePath: string) => {
      // Catégoriser et enregistrer l'erreur
      this.recordAutoError(filePath, error);

      // Appeler le callback original si présent
      if (originalOnError) {
        originalOnError(error, filePath);
      }
    };

    // Intercepter le callback de fichier réussi
    const originalOnFile = fileStreamer['options'].onFile;

    fileStreamer['options'].onFile = (filePath: string, content: string, stats: any) => {
      filesScanned++;
      bytesProcessed += stats.size;

      // Appeler le callback original si présent
      if (originalOnFile) {
        originalOnFile(filePath, content, stats);
      }
    };

    // Démarrer le streaming
    try {
      const metrics = await fileStreamer.start();
      bytesProcessed = metrics.bytesProcessed;
    } catch (error) {
      logger.error('scanner.error.fatal', 'Erreur fatale pendant le scanning', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Enregistrer l'erreur fatale
      this.recordError(
        this.options.projectPath,
        error instanceof Error ? error : new Error(String(error)),
        'UNKNOWN_ERROR',
        { fatal: true }
      );
    }

    const duration = Date.now() - this.startTime;

    // Créer le résultat avec limitation des erreurs affichées
    const errorList = limitErrorsToTop(this.errors, this.options.displayLimit);

    logger.info('scanner.complete', `Scanning terminé`, {
      filesScanned,
      bytesProcessed,
      totalErrors: this.errors.length,
      displayedErrors: errorList.displayed_errors,
      duration,
    });

    return {
      filesScanned,
      errors: errorList,
      duration,
      bytesProcessed,
    };
  }

  /**
   * Obtient la liste des erreurs collectées
   */
  getErrors(): FileError[] {
    return [...this.errors];
  }

  /**
   * Obtient la liste limitée avec résumé
   */
  getErrorList(): ErrorList {
    return limitErrorsToTop(this.errors, this.options.displayLimit);
  }

  /**
   * Réinitialise la collecte d'erreurs
   */
  reset(): void {
    this.errors = [];
    this.startTime = 0;
    logger.debug('scanner.error.reset', 'Collecte d\'erreurs réinitialisée');
  }

  /**
   * Retourne les statistiques d'erreurs
   */
  getStatistics(): {
    total: number;
    byType: Record<ErrorType, number>;
    mostFrequent: Array<{ error: string; count: number }>;
  } {
    const byType: Record<string, number> = {};
    const errorCounts = new Map<string, number>();

    for (const error of this.errors) {
      // Compter par type
      byType[error.type] = (byType[error.type] || 0) + 1;

      // Compter par message d'erreur
      const key = `${error.type}:${error.error}`;
      errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
    }

    // Trier par fréquence
    const mostFrequent = Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total: this.errors.length,
      byType: byType as Record<ErrorType, number>,
      mostFrequent,
    };
  }
}

/**
 * Fonction utilitaire pour créer un collector et scanner avec collecte d'erreurs
 */
export async function scanWithErrors(
  fileStreamer: FileStreamer,
  options?: Pick<ScannerErrorCollectorOptions, 'maxErrors' | 'displayLimit'>
): Promise<ScanningResult> {
  const collector = new ScannerErrorCollector({
    projectPath: fileStreamer['options'].projectPath,
    maxErrors: options?.maxErrors,
    displayLimit: options?.displayLimit,
  });

  return collector.scanWithErrorCollection(fileStreamer);
}

/**
 * Teste le module ScannerErrorCollector
 */
export async function testScannerErrorCollector(): Promise<boolean> {
  try {
    logger.info('scanner.error.test.start', 'Début test ScannerErrorCollector');

    // Créer un collector
    const collector = new ScannerErrorCollector({
      projectPath: '/test/path',
      maxErrors: 100,
      displayLimit: 10,
    });

    // Simuler quelques erreurs
    collector.recordError('/test/file1.ts', 'File not found', 'FILE_NOT_FOUND');
    collector.recordError('/test/file2.ts', 'Permission denied', 'ACCESS_DENIED');
    collector.recordError('/test/file3.ts', 'Parse error', 'PARSING_ERROR');

    // Récupérer la liste
    const errorList = collector.getErrorList();

    if (errorList.total_errors !== 3) {
      throw new Error(`Expected 3 errors, got ${errorList.total_errors}`);
    }

    if (errorList.summary.file_not_found !== 1) {
      throw new Error(`Expected 1 FILE_NOT_FOUND, got ${errorList.summary.file_not_found}`);
    }

    logger.info('scanner.error.test.success', 'Test ScannerErrorCollector réussi', {
      totalErrors: errorList.total_errors,
      summary: errorList.summary,
    });

    return true;
  } catch (error) {
    logger.error('scanner.error.test.failed', 'Test ScannerErrorCollector échoué', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
