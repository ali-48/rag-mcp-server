// src/rag/streaming/scanner-error-collector.ts
// Collecte et gestion des erreurs pendant le scanning (Phase 1)
// Version: v1.0.0
// Responsabilités: Capturer, classifier et agréger les erreurs de scanning
import { logger } from '../../core/logger.js';
import { createFileError, limitErrorsToTop } from '../../types/errors.js';
/**
 * Classe pour collecter les erreurs pendant le scanning
 */
export class ScannerErrorCollector {
    errors = [];
    options;
    startTime = 0;
    /**
     * Constructeur
     */
    constructor(options) {
        this.options = {
            maxErrors: options.maxErrors || 0, // 0 = illimité
            displayLimit: options.displayLimit || 50,
            ...options,
        };
    }
    /**
     * Enregistre une erreur de fichier
     */
    recordError(file, error, type, metadata) {
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
    categorizeError(error) {
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
    recordAutoError(file, error, metadata) {
        const type = this.categorizeError(error);
        this.recordError(file, error, type, metadata);
    }
    /**
     * Wrapper autour de FileStreamer pour collecter les erreurs
     */
    async scanWithErrorCollection(fileStreamer) {
        this.startTime = Date.now();
        this.errors = []; // Reset
        let filesScanned = 0;
        let bytesProcessed = 0;
        // Intercepter les callbacks d'erreur
        const originalOnError = fileStreamer['options'].onError;
        fileStreamer['options'].onError = (error, filePath) => {
            // Catégoriser et enregistrer l'erreur
            this.recordAutoError(filePath, error);
            // Appeler le callback original si présent
            if (originalOnError) {
                originalOnError(error, filePath);
            }
        };
        // Intercepter le callback de fichier réussi
        const originalOnFile = fileStreamer['options'].onFile;
        fileStreamer['options'].onFile = (filePath, content, stats) => {
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
        }
        catch (error) {
            logger.error('scanner.error.fatal', 'Erreur fatale pendant le scanning', {
                error: error instanceof Error ? error.message : String(error),
            });
            // Enregistrer l'erreur fatale
            this.recordError(this.options.projectPath, error instanceof Error ? error : new Error(String(error)), 'UNKNOWN_ERROR', { fatal: true });
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
    getErrors() {
        return [...this.errors];
    }
    /**
     * Obtient la liste limitée avec résumé
     */
    getErrorList() {
        return limitErrorsToTop(this.errors, this.options.displayLimit);
    }
    /**
     * Réinitialise la collecte d'erreurs
     */
    reset() {
        this.errors = [];
        this.startTime = 0;
        logger.debug('scanner.error.reset', 'Collecte d\'erreurs réinitialisée');
    }
    /**
     * Retourne les statistiques d'erreurs
     */
    getStatistics() {
        const byType = {};
        const errorCounts = new Map();
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
            byType: byType,
            mostFrequent,
        };
    }
}
/**
 * Fonction utilitaire pour créer un collector et scanner avec collecte d'erreurs
 */
export async function scanWithErrors(fileStreamer, options) {
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
export async function testScannerErrorCollector() {
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
    }
    catch (error) {
        logger.error('scanner.error.test.failed', 'Test ScannerErrorCollector échoué', {
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
}
//# sourceMappingURL=scanner-error-collector.js.map