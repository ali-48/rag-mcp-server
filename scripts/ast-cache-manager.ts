// Gestionnaire de cache AST pour l'audit incrémental
// Fournit une interface simplifiée pour le cache AST avec support de comparaison

import { stat } from "node:fs/promises";
import { ASTCache, ASTCacheEntry, createASTCache } from "./ast-cache.js";
import {
  CacheComparisonResult,
  AstCacheEntry as TypesAstCacheEntry,
} from "./types/incremental-audit.js";
import {
  getFileHash
} from "./utils/file-hasher.js";

/**
 * Options pour le gestionnaire de cache AST
 */
export interface AstCacheManagerOptions {
  /** Activer/désactiver le cache */
  enabled: boolean;
  /** Répertoire de cache */
  cacheDir: string;
  /** Nombre maximum d'entrées dans le cache */
  maxEntries: number;
  /** Durée de vie maximale des entrées (en millisecondes) */
  maxAge: number;
  /** Vérifier le hash des fichiers */
  checkHash: boolean;
  /** Vérifier la taille des fichiers */
  checkSize: boolean;
  /** Vérifier la date de modification */
  checkMtime: boolean;
  /** Algorithme de hash (md5, sha256) */
  hashAlgorithm: "md5" | "sha256";
}

/**
 * Options par défaut
 */
const DEFAULT_OPTIONS: AstCacheManagerOptions = {
  enabled: true,
  cacheDir: "audit/ast-cache",
  maxEntries: 1000,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours
  checkHash: true,
  checkSize: true,
  checkMtime: true,
  hashAlgorithm: "md5",
};

/**
 * Gestionnaire de cache AST avec interface simplifiée
 */
export class AstCacheManager {
  private cache: ASTCache;
  private options: AstCacheManagerOptions;

  constructor(options?: Partial<AstCacheManagerOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Convertir les options pour le cache AST existant
    const astCacheOptions = {
      enabled: this.options.enabled,
      cacheDir: this.options.cacheDir,
      maxEntries: this.options.maxEntries,
      maxAge: this.options.maxAge,
      compression: true,
      validation: {
        checkHash: this.options.checkHash,
        checkSize: this.options.checkSize,
        checkMtime: this.options.checkMtime,
      },
    };

    this.cache = createASTCache(astCacheOptions);
  }

  /**
   * Récupère une entrée du cache
   * @param filePath Chemin du fichier
   * @returns Entrée du cache ou null si non trouvée
   */
  async get(filePath: string): Promise<TypesAstCacheEntry | null> {
    if (!this.options.enabled) {
      return null;
    }

    try {
      const entry = this.cache.get(filePath);
      if (!entry) {
        return null;
      }

      // Convertir l'entrée du cache vers le format TypesAstCacheEntry
      return this.convertToTypesAstCacheEntry(filePath, entry);
    } catch (error) {
      console.error(
        `[AstCacheManager] Erreur lors de la récupération du cache pour ${filePath}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Sauvegarde une entrée dans le cache
   * @param filePath Chemin du fichier
   * @param astJson AST sérialisé en JSON
   * @param symbols Symboles extraits
   * @param qualityMetrics Métriques de qualité
   * @param dependencies Dépendances du fichier
   * @returns true si sauvegardé avec succès
   */
  async set(
    filePath: string,
    astJson: string,
    symbols: any[],
    qualityMetrics: any,
    dependencies: string[] = [],
  ): Promise<boolean> {
    if (!this.options.enabled) {
      return false;
    }

    try {
      // Sauvegarder dans le cache existant
      this.cache.save(
        filePath,
        {
          astJson,
          symbols,
          qualityMetrics,
          cachedAt: new Date().toISOString(),
        },
        dependencies,
      );

      return true;
    } catch (error) {
      console.error(
        `[AstCacheManager] Erreur lors de la sauvegarde dans le cache pour ${filePath}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Compare un fichier avec son entrée de cache
   * @param filePath Chemin du fichier
   * @returns Résultat de la comparaison
   */
  async compare(filePath: string): Promise<CacheComparisonResult> {
    if (!this.options.enabled) {
      return {
        status: "miss",
        currentHash: "",
        isModified: true,
        cachedEntry: undefined,
        cachedHash: undefined,
      };
    }

    try {
      // Obtenir les métadonnées actuelles du fichier
      const currentHash = await getFileHash(filePath);
      if (currentHash === null) {
        return {
          status: "miss",
          currentHash: "",
          isModified: true,
          cachedEntry: undefined,
          cachedHash: undefined,
        };
      }

      // Obtenir l'entrée du cache
      const cachedEntry = await this.get(filePath);
      if (!cachedEntry) {
        return {
          status: "miss",
          currentHash,
          isModified: true,
          cachedEntry: undefined,
          cachedHash: undefined,
        };
      }

      // Vérifier si le fichier a été modifié
      const isModified = currentHash !== cachedEntry.fileHash;

      // Déterminer le statut
      let status: "hit" | "miss" | "stale" | "expired" = "hit";

      if (isModified) {
        status = "stale";
      } else {
        // Vérifier l'âge du cache
        const now = new Date();
        const cacheAge = now.getTime() - cachedEntry.cachedAt.getTime();
        if (cacheAge > this.options.maxAge) {
          status = "expired";
        }
      }

      // Calculer les différences
      let sizeDelta: number | undefined;
      let timeDeltaMs: number | undefined;

      try {
        const fileStats = await stat(filePath);
        sizeDelta = fileStats.size - cachedEntry.fileSize;
        timeDeltaMs = fileStats.mtimeMs - cachedEntry.lastModified.getTime();
      } catch {
        // Ignorer les erreurs de stat
      }

      return {
        status,
        currentHash,
        cachedEntry,
        cachedHash: cachedEntry.fileHash,
        isModified,
        sizeDelta,
        timeDeltaMs,
      };
    } catch (error) {
      console.error(
        `[AstCacheManager] Erreur lors de la comparaison pour ${filePath}:`,
        error,
      );
      return {
        status: "miss",
        currentHash: "",
        isModified: true,
        cachedEntry: undefined,
        cachedHash: undefined,
      };
    }
  }

  /**
   * Compare plusieurs fichiers avec leur cache
   * @param filePaths Liste des chemins de fichiers
   * @returns Map des résultats de comparaison
   */
  async compareBatch(
    filePaths: string[],
  ): Promise<Map<string, CacheComparisonResult>> {
    const results = new Map<string, CacheComparisonResult>();

    const promises = filePaths.map(async (filePath) => {
      const result = await this.compare(filePath);
      results.set(filePath, result);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Invalide une entrée du cache
   * @param filePath Chemin du fichier
   */
  invalidate(filePath: string): void {
    if (!this.options.enabled) {
      return;
    }

    this.cache.invalidate(filePath);
  }

  /**
   * Invalide les entrées dépendantes d'un fichier
   * @param filePath Chemin du fichier
   * @returns Liste des fichiers invalidés
   */
  invalidateDependents(filePath: string): string[] {
    if (!this.options.enabled) {
      return [];
    }

    return this.cache.invalidateDependents(filePath);
  }

  /**
   * Nettoie les entrées anciennes du cache
   */
  cleanup(): void {
    if (!this.options.enabled) {
      return;
    }

    this.cache.cleanupOldEntries();
  }

  /**
   * Vide complètement le cache
   */
  clear(): void {
    if (!this.options.enabled) {
      return;
    }

    this.cache.clear();
  }

  /**
   * Obtient les statistiques du cache
   */
  getStats(): any {
    return this.cache.getStats();
  }

  /**
   * Convertit une entrée ASTCache vers TypesAstCacheEntry
   */
  private convertToTypesAstCacheEntry(
    filePath: string,
    entry: ASTCacheEntry,
  ): TypesAstCacheEntry {
    // Extraire les données de l'entrée du cache
    const cacheData = entry.astData || {};

    return {
      filePath,
      fileHash: entry.hash,
      fileSize: entry.metadata.size,
      lastModified: new Date(entry.metadata.mtime),
      astJson: cacheData.astJson || "{}",
      symbols: cacheData.symbols || [],
      qualityMetrics: cacheData.qualityMetrics || {
        qualityScore: 0,
        complexity: 0,
        maintainability: 0,
        linesOfCode: 0,
        symbolCount: 0,
        dependencyCount: 0,
        documentationCoverage: 0,
        ruleViolations: 0,
        technicalDebt: 0,
      },
      cachedAt: new Date(entry.timestamp),
      lastAccessed: new Date(),
    };
  }

  /**
   * Vérifie si un fichier doit être analysé (cache manquant ou expiré)
   * @param filePath Chemin du fichier
   * @returns true si le fichier doit être analysé
   */
  async shouldAnalyze(filePath: string): Promise<boolean> {
    if (!this.options.enabled) {
      return true;
    }

    const comparison = await this.compare(filePath);
    return comparison.status !== "hit";
  }

  /**
   * Obtient la liste des fichiers qui doivent être analysés
   * @param filePaths Liste des chemins de fichiers
   * @returns Liste des fichiers à analyser
   */
  async getFilesToAnalyze(filePaths: string[]): Promise<string[]> {
    const filesToAnalyze: string[] = [];

    const promises = filePaths.map(async (filePath) => {
      const shouldAnalyze = await this.shouldAnalyze(filePath);
      if (shouldAnalyze) {
        filesToAnalyze.push(filePath);
      }
    });

    await Promise.all(promises);
    return filesToAnalyze;
  }

  /**
   * Met à jour la date d'accès d'une entrée du cache
   * @param filePath Chemin du fichier
   */
  async touch(filePath: string): Promise<void> {
    if (!this.options.enabled) {
      return;
    }

    // Pour l'instant, cette méthode ne fait rien car le cache existant
    // ne gère pas les dates d'accès. On pourrait l'implémenter si nécessaire.
    console.log(`[AstCacheManager] Touch ${filePath}`);
  }

  /**
   * Exporte le cache vers un fichier JSON
   * @param exportPath Chemin d'export
   */
  async export(exportPath: string): Promise<boolean> {
    try {
      // Cette fonctionnalité serait à implémenter si nécessaire
      console.log(
        `[AstCacheManager] Export vers ${exportPath} (non implémenté)`,
      );
      return false;
    } catch (error) {
      console.error(`[AstCacheManager] Erreur lors de l'export:`, error);
      return false;
    }
  }

  /**
   * Importe le cache depuis un fichier JSON
   * @param importPath Chemin d'import
   */
  async import(importPath: string): Promise<boolean> {
    try {
      // Cette fonctionnalité serait à implémenter si nécessaire
      console.log(
        `[AstCacheManager] Import depuis ${importPath} (non implémenté)`,
      );
      return false;
    } catch (error) {
      console.error(`[AstCacheManager] Erreur lors de l'import:`, error);
      return false;
    }
  }
}

/**
 * Crée une instance de AstCacheManager
 */
export function createAstCacheManager(
  options?: Partial<AstCacheManagerOptions>,
): AstCacheManager {
  return new AstCacheManager(options);
}

/**
 * Fonction utilitaire pour déterminer si un fichier a changé
 */
export async function hasFileChanged(
  filePath: string,
  cacheManager: AstCacheManager,
): Promise<boolean> {
  const comparison = await cacheManager.compare(filePath);
  return comparison.isModified;
}

/**
 * Fonction utilitaire pour obtenir les fichiers modifiés
 */
export async function getChangedFiles(
  filePaths: string[],
  cacheManager: AstCacheManager,
): Promise<string[]> {
  const changedFiles: string[] = [];

  const comparisons = await cacheManager.compareBatch(filePaths);
  for (const [filePath, comparison] of comparisons) {
    if (comparison.isModified) {
      changedFiles.push(filePath);
    }
  }

  return changedFiles;
}
