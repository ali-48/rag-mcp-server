/**
 * Types pour la gestion des erreurs dans le pipeline RAG
 * Permet de documenter et tracer toutes les erreurs par phase
 */

/**
 * Phase du pipeline RAG où l'erreur s'est produite
 */
export type RagPhase =
  | "phase0" // Workspace detection
  | "phase1" // Scanning
  | "phase2" // Chunking
  | "phase3" // Embeddings
  | "phase4" // Indexation
  | "init" // Initialisation
  | "query" // Recherche
  | "unknown";

/**
 * Type d'erreur
 */
export type ErrorType =
  | "PARSING_ERROR" // Erreur de parsing du code
  | "ACCESS_DENIED" // Permission refusée
  | "FILE_NOT_FOUND" // Fichier introuvable
  | "ENCODING_ERROR" // Problème d'encodage
  | "TIMEOUT" // Timeout
  | "NETWORK_ERROR" // Erreur réseau
  | "INVALID_CONFIG" // Configuration invalide
  | "EMBEDDING_ERROR" // Erreur génération embeddings
  | "CHUNKING_ERROR" // Erreur chunking
  | "DATABASE_ERROR" // Erreur base de données
  | "UNKNOWN_ERROR"; // Erreur inconnue

/**
 * Erreur associée à un fichier spécifique
 */
export interface FileError {
  /** Chemin du fichier concerné */
  file: string;

  /** Message d'erreur */
  error: string;

  /** Type d'erreur */
  type: ErrorType;

  /** Phase où l'erreur s'est produite */
  phase: RagPhase;

  /** Timestamp de l'erreur (ISO 8601) */
  timestamp?: string;

  /** Stack trace (optionnel, pour debug) */
  stack?: string;

  /** Métadonnées additionnelles */
  metadata?: {
    lineNumber?: number;
    columnNumber?: number;
    language?: string;
    fileSize?: number;
    [key: string]: unknown;
  };
}

/**
 * Résumé des erreurs par type
 */
export interface ErrorSummary {
  /** Total d'erreurs */
  total: number;

  /** Erreurs de parsing */
  parsing_errors: number;

  /** Accès refusés */
  access_denied: number;

  /** Fichiers introuvables */
  file_not_found: number;

  /** Erreurs d'encodage */
  encoding_errors: number;

  /** Timeouts */
  timeouts: number;

  /** Erreurs réseau */
  network_errors: number;

  /** Erreurs de chunking */
  chunking_errors: number;

  /** Erreurs d'embeddings */
  embedding_errors: number;

  /** Erreurs de base de données */
  database_errors: number;

  /** Autres erreurs */
  unknown_errors: number;

  /** Répartition par phase */
  by_phase: Record<RagPhase, number>;
}

/**
 * Liste d'erreurs avec résumé
 */
export interface ErrorList {
  /** Résumé des erreurs */
  summary: ErrorSummary;

  /** Liste des erreurs (limitée aux N plus fréquentes) */
  errors: FileError[];

  /** Nombre total d'erreurs (avant limitation) */
  total_errors: number;

  /** Nombre d'erreurs affichées */
  displayed_errors: number;

  /** Limitation appliquée (ex: "top_50") */
  limit_applied?: string;
}

/**
 * Créer un résumé vide
 */
export function createEmptyErrorSummary(): ErrorSummary {
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
export function createEmptyErrorList(): ErrorList {
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
export function addErrorToSummary(
  summary: ErrorSummary,
  error: FileError,
): void {
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
export function limitErrorsToTop(
  errors: FileError[],
  limit: number = 50,
): ErrorList {
  // Compter la fréquence de chaque type d'erreur
  const errorCounts = new Map<string, { count: number; sample: FileError }>();

  for (const error of errors) {
    const key = `${error.type}:${error.phase}:${error.error}`;
    const existing = errorCounts.get(key);

    if (existing) {
      existing.count++;
    } else {
      errorCounts.set(key, { count: 1, sample: error });
    }
  }

  // Trier par fréquence décroissante
  const sorted = Array.from(errorCounts.values()).sort(
    (a, b) => b.count - a.count,
  );

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
export function createFileError(
  file: string,
  error: string,
  type: ErrorType,
  phase: RagPhase,
  metadata?: FileError["metadata"],
): FileError {
  return {
    file,
    error,
    type,
    phase,
    timestamp: new Date().toISOString(),
    metadata,
  };
}
