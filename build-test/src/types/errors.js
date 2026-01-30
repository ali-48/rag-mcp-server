/**
 * Types pour la gestion des erreurs dans le pipeline RAG
 * Permet de documenter et tracer toutes les erreurs par phase
 */
/**
 * Créer un résumé vide
 */
export function createEmptyErrorSummary() {
    return {
        total: 0,
        parsing_errors: 0,
        access_denied: 0,
        file_not_found: 0,
        encoding_errors: 0,
        timeouts: 0,
        network_errors: 0,
        chunking_errors: 0,
        embedding_errors: 0,
        database_errors: 0,
        unknown_errors: 0,
        by_phase: {
            phase0: 0,
            phase1: 0,
            phase2: 0,
            phase3: 0,
            phase4: 0,
            init: 0,
            query: 0,
            unknown: 0,
        },
    };
}
/**
 * Créer une ErrorList vide
 */
export function createEmptyErrorList() {
    return {
        summary: createEmptyErrorSummary(),
        errors: [],
        total_errors: 0,
        displayed_errors: 0,
    };
}
/**
 * Ajouter une erreur au résumé
 */
export function addErrorToSummary(summary, error) {
    summary.total++;
    // Incrémenter par type
    switch (error.type) {
        case "PARSING_ERROR":
            summary.parsing_errors++;
            break;
        case "ACCESS_DENIED":
            summary.access_denied++;
            break;
        case "FILE_NOT_FOUND":
            summary.file_not_found++;
            break;
        case "ENCODING_ERROR":
            summary.encoding_errors++;
            break;
        case "TIMEOUT":
            summary.timeouts++;
            break;
        case "NETWORK_ERROR":
            summary.network_errors++;
            break;
        case "CHUNKING_ERROR":
            summary.chunking_errors++;
            break;
        case "EMBEDDING_ERROR":
            summary.embedding_errors++;
            break;
        case "DATABASE_ERROR":
            summary.database_errors++;
            break;
        default:
            summary.unknown_errors++;
    }
    // Incrémenter par phase
    summary.by_phase[error.phase]++;
}
/**
 * Trier les erreurs par fréquence et garder les N premières
 */
export function limitErrorsToTop(errors, limit = 50) {
    // Compter la fréquence de chaque type d'erreur
    const errorCounts = new Map();
    for (const error of errors) {
        const key = `${error.type}:${error.phase}:${error.error}`;
        const existing = errorCounts.get(key);
        if (existing) {
            existing.count++;
        }
        else {
            errorCounts.set(key, { count: 1, sample: error });
        }
    }
    // Trier par fréquence décroissante
    const sorted = Array.from(errorCounts.values()).sort((a, b) => b.count - a.count);
    // Prendre les N premières
    const topErrors = sorted.slice(0, limit).map((item) => ({
        ...item.sample,
        metadata: {
            ...item.sample.metadata,
            occurrence_count: item.count,
        },
    }));
    // Créer le résumé
    const summary = createEmptyErrorSummary();
    for (const error of errors) {
        addErrorToSummary(summary, error);
    }
    return {
        summary,
        errors: topErrors,
        total_errors: errors.length,
        displayed_errors: topErrors.length,
        limit_applied: `top_${limit}`,
    };
}
/**
 * Créer une FileError
 */
export function createFileError(file, error, type, phase, metadata) {
    return {
        file,
        error,
        type,
        phase,
        timestamp: new Date().toISOString(),
        metadata,
    };
}
//# sourceMappingURL=errors.js.map