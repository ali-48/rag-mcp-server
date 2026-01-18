// Types pour l'audit incrémental de code
// Définit les interfaces pour les résultats d'audit, les différences de symboles et les changements de fichiers

/**
 * Type de changement détecté dans un fichier
 */
export type FileChangeType = "added" | "modified" | "deleted" | "unchanged";

/**
 * Type de symbole extrait du code
 */
export type SymbolType =
  | "function"
  | "class"
  | "interface"
  | "type"
  | "enum"
  | "variable"
  | "constant"
  | "import"
  | "export"
  | "method"
  | "property"
  | "unknown";

/**
 * Représente un symbole extrait d'un fichier
 */
export interface SymbolInfo {
  /** Nom du symbole */
  name: string;
  /** Type du symbole */
  type: SymbolType;
  /** Ligne de début (1-indexed) */
  startLine: number;
  /** Ligne de fin (1-indexed) */
  endLine: number;
  /** Colonne de début (0-indexed) */
  startColumn: number;
  /** Colonne de fin (0-indexed) */
  endColumn: number;
  /** Portée du symbole (module, class, etc.) */
  scope?: string;
  /** Modificateurs (public, private, async, etc.) */
  modifiers?: string[];
  /** Type de retour (pour les fonctions/méthodes) */
  returnType?: string;
  /** Paramètres (pour les fonctions/méthodes) */
  parameters?: Array<{
    name: string;
    type?: string;
    optional?: boolean;
  }>;
  /** Documentation (commentaire JSDoc/TSDoc) */
  documentation?: string;
  /** Métadonnées supplémentaires */
  metadata?: Record<string, any>;
}

/**
 * Différence entre deux versions d'un symbole
 */
export interface SymbolDiff {
  /** Type de changement du symbole */
  changeType: "added" | "modified" | "deleted" | "unchanged";
  /** Symbole avant le changement (pour 'modified' et 'deleted') */
  oldSymbol?: SymbolInfo;
  /** Symbole après le changement (pour 'added' et 'modified') */
  newSymbol?: SymbolInfo;
  /** Niveau de changement (mineur, majeur, breaking) */
  severity: "minor" | "major" | "breaking";
  /** Description du changement */
  description: string;
  /** Impact sur la qualité (score -1 à 1) */
  qualityImpact: number;
}

/**
 * Changement détecté dans un fichier
 */
export interface FileChange {
  /** Chemin du fichier (relatif à la racine du projet) */
  filePath: string;
  /** Type de changement du fichier */
  changeType: FileChangeType;
  /** Hash MD5 du fichier avant le changement (pour 'modified' et 'deleted') */
  oldHash?: string;
  /** Hash MD5 du fichier après le changement (pour 'added' et 'modified') */
  newHash?: string;
  /** Taille du fichier avant (en octets) */
  oldSize?: number;
  /** Taille du fichier après (en octets) */
  newSize?: number;
  /** Timestamp de dernière modification avant */
  oldModified?: Date;
  /** Timestamp de dernière modification après */
  newModified?: Date;
  /** Différences de symboles dans ce fichier */
  symbolDiffs: SymbolDiff[];
  /** Métriques de qualité avant le changement */
  oldQuality?: FileQualityMetrics;
  /** Métriques de qualité après le changement */
  newQuality?: FileQualityMetrics;
}

/**
 * Métriques de qualité pour un fichier
 */
export interface FileQualityMetrics {
  /** Score de qualité global (0-1) */
  qualityScore: number;
  /** Complexité cyclomatique */
  complexity: number;
  /** Maintenabilité (0-100) */
  maintainability: number;
  /** Nombre de lignes de code */
  linesOfCode: number;
  /** Nombre de symboles */
  symbolCount: number;
  /** Nombre de dépendances */
  dependencyCount: number;
  /** Couverture de documentation (%) */
  documentationCoverage: number;
  /** Violations de règles (nombre) */
  ruleViolations: number;
  /** Dette technique estimée (en heures) */
  technicalDebt: number;
}

/**
 * Résultat complet d'un audit incrémental
 */
export interface IncrementalAuditResult {
  /** ID unique de l'audit */
  auditId: string;
  /** Timestamp de début de l'audit */
  startTime: Date;
  /** Timestamp de fin de l'audit */
  endTime: Date;
  /** Durée de l'audit en millisecondes */
  durationMs: number;
  /** Liste des fichiers analysés */
  filesAnalyzed: string[];
  /** Nombre total de fichiers analysés */
  totalFiles: number;
  /** Changements détectés par fichier */
  fileChanges: FileChange[];
  /** Statistiques globales */
  statistics: {
    /** Fichiers ajoutés */
    addedFiles: number;
    /** Fichiers modifiés */
    modifiedFiles: number;
    /** Fichiers supprimés */
    deletedFiles: number;
    /** Fichiers inchangés */
    unchangedFiles: number;
    /** Symboles ajoutés */
    addedSymbols: number;
    /** Symboles modifiés */
    modifiedSymbols: number;
    /** Symboles supprimés */
    deletedSymbols: number;
    /** Impact total sur la qualité (moyenne) */
    totalQualityImpact: number;
    /** Score de qualité avant l'audit */
    previousQualityScore?: number;
    /** Score de qualité après l'audit */
    currentQualityScore?: number;
    /** Variation du score de qualité */
    qualityScoreDelta?: number;
  };
  /** Recommandations basées sur les changements */
  recommendations: Array<{
    /** Niveau de priorité */
    priority: "low" | "medium" | "high" | "critical";
    /** Catégorie de recommandation */
    category:
    | "performance"
    | "maintainability"
    | "security"
    | "best-practice"
    | "refactoring";
    /** Description de la recommandation */
    description: string;
    /** Fichiers concernés */
    affectedFiles: string[];
    /** Actions suggérées */
    suggestedActions: string[];
  }>;
  /** Métadonnées supplémentaires */
  metadata?: Record<string, any>;
}

/**
 * Configuration pour l'audit incrémental
 */
export interface IncrementalAuditConfig {
  /** Dossier racine à analyser */
  rootDir: string;
  /** Patterns de fichiers à inclure (glob) */
  includePatterns?: string[];
  /** Patterns de fichiers à exclure (glob) */
  excludePatterns?: string[];
  /** Utiliser le cache AST */
  useAstCache: boolean;
  /** Seuil de similarité pour détecter les modifications (0-1) */
  similarityThreshold?: number;
  /** Types de symboles à suivre */
  trackedSymbolTypes?: SymbolType[];
  /** Ignorer les changements mineurs */
  ignoreMinorChanges?: boolean;
  /** Générer des recommandations */
  generateRecommendations?: boolean;
  /** Exporter les résultats en JSON */
  exportJson?: boolean;
  /** Chemin d'export JSON */
  jsonExportPath?: string;
}

/**
 * État du cache AST pour un fichier
 */
export interface AstCacheEntry {
  /** Chemin du fichier */
  filePath: string;
  /** Hash MD5 du contenu */
  fileHash: string;
  /** Taille du fichier en octets */
  fileSize: number;
  /** Timestamp de dernière modification */
  lastModified: Date;
  /** AST sérialisé en JSON */
  astJson: string;
  /** Symboles extraits */
  symbols: SymbolInfo[];
  /** Métriques de qualité */
  qualityMetrics: FileQualityMetrics;
  /** Timestamp de création du cache */
  cachedAt: Date;
  /** Timestamp de dernière utilisation */
  lastAccessed: Date;
}

/**
 * Résultat de la comparaison de cache
 */
export interface CacheComparisonResult {
  /** État du cache */
  status: "hit" | "miss" | "stale" | "expired";
  /** Entrée de cache existante (si disponible) */
  cachedEntry?: AstCacheEntry;
  /** Hash actuel du fichier */
  currentHash: string;
  /** Hash précédent (caché) */
  cachedHash?: string;
  /** Fichier modifié depuis le cache ? */
  isModified: boolean;
  /** Différence de taille (octets) */
  sizeDelta?: number;
  /** Différence de temps de modification (ms) */
  timeDeltaMs?: number;
}
