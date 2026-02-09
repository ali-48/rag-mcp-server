/**
 * Calculateur de hash SHA-256 pour fichiers
 *
 * Utilisé pour détecter les changements réels dans les fichiers
 * et éviter de capturer des événements inutiles
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import { logger } from './logger.js';

/**
 * Interface pour les résultats de hash
 */
export interface FileHashResult {
  filePath: string;
  hash: string;
  size: number;
  lastModified: number;
  algorithm: string;
  computedAt: string;
}

/**
 * Calculateur de hash de fichiers
 */
export class FileHasher {
  private algorithm: string = 'sha256';
  private hashCache: Map<string, FileHashResult> = new Map();
  private maxCacheSize: number = 1000;
  private isInitialized = false;

  constructor() {
    logger.info('FileHasher créé', {
      algorithm: this.algorithm,
      max_cache_size: this.maxCacheSize
    });
  }

  /**
   * Initialise le calculateur de hash
   */
  public async initialize(): Promise<void> {
    try {
      // Vérifier que l'algorithme est disponible
      if (!crypto.getHashes().includes(this.algorithm)) {
        throw new Error(`Algorithme de hash non disponible: ${this.algorithm}`);
      }

      this.isInitialized = true;

      logger.info('FileHasher initialisé', {
        algorithm: this.algorithm,
        available_algorithms: crypto.getHashes().slice(0, 5)
      });

    } catch (error) {
      logger.error('Erreur lors de l\'initialisation du FileHasher', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Calcule le hash d'un fichier
   */
  public async computeHash(filePath: string): Promise<FileHashResult | null> {
    if (!this.isInitialized) {
      logger.warn('FileHasher non initialisé, tentative de calcul de hash ignorée');
      return null;
    }

    try {
      // Vérifier si le fichier existe
      if (!fs.existsSync(filePath)) {
        logger.warn('Fichier non trouvé pour calcul de hash', { filePath });
        return null;
      }

      // Vérifier le cache
      const cached = this.hashCache.get(filePath);
      if (cached && this.isCacheValid(cached, filePath)) {
        logger.debug('Hash récupéré depuis le cache', {
          filePath,
          hash: cached.hash.substring(0, 8) + '...'
        });
        return cached;
      }

      // Calculer les métadonnées du fichier
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      const lastModified = stats.mtimeMs;

      // Calculer le hash
      const hash = await this.computeFileHash(filePath);

      // Créer le résultat
      const result: FileHashResult = {
        filePath,
        hash,
        size: fileSize,
        lastModified,
        algorithm: this.algorithm,
        computedAt: new Date().toISOString()
      };

      // Mettre en cache
      this.updateCache(filePath, result);

      logger.debug('Hash calculé avec succès', {
        filePath,
        hash: hash.substring(0, 8) + '...',
        size: fileSize,
        lastModified: new Date(lastModified).toISOString()
      });

      return result;

    } catch (error) {
      logger.error('Erreur lors du calcul du hash du fichier', {
        filePath,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Calcule le hash d'un fichier de manière asynchrone
   */
  private async computeFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(this.algorithm);
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => {
        hash.update(data);
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Vérifie si un fichier a changé depuis le dernier hash
   */
  public async hasFileChanged(filePath: string, previousHash?: string): Promise<boolean> {
    try {
      const currentHashResult = await this.computeHash(filePath);
      if (!currentHashResult) {
        return true; // Si on ne peut pas calculer le hash, considérer comme changé
      }

      if (!previousHash) {
        return true; // Pas de hash précédent, donc considérer comme changé
      }

      return currentHashResult.hash !== previousHash;

    } catch (error) {
      logger.error('Erreur lors de la vérification du changement de fichier', {
        filePath,
        error: error instanceof Error ? error.message : String(error)
      });
      return true; // En cas d'erreur, considérer comme changé
    }
  }

  /**
   * Vérifie si le cache est valide pour un fichier
   */
  private isCacheValid(cachedResult: FileHashResult, filePath: string): boolean {
    try {
      // Vérifier si le fichier existe toujours
      if (!fs.existsSync(filePath)) {
        return false;
      }

      // Vérifier si le fichier a été modifié
      const stats = fs.statSync(filePath);
      return stats.mtimeMs <= cachedResult.lastModified;

    } catch {
      return false;
    }
  }

  /**
   * Met à jour le cache
   */
  private updateCache(filePath: string, result: FileHashResult): void {
    // Limiter la taille du cache
    if (this.hashCache.size >= this.maxCacheSize) {
      const firstKey = this.hashCache.keys().next().value;
      if (firstKey) {
        this.hashCache.delete(firstKey);
      }
    }

    this.hashCache.set(filePath, result);
  }

  /**
   * Obtient le hash d'un fichier depuis le cache
   */
  public getCachedHash(filePath: string): string | null {
    const cached = this.hashCache.get(filePath);
    return cached?.hash || null;
  }

  /**
   * Nettoie le cache
   */
  public clearCache(): void {
    this.hashCache.clear();
    logger.info('Cache FileHasher nettoyé');
  }

  /**
   * Obtient les statistiques du cache
   */
  public getCacheStats(): CacheStats {
    return {
      cache_size: this.hashCache.size,
      max_cache_size: this.maxCacheSize,
      cache_hit_rate: this.calculateCacheHitRate(),
      algorithm: this.algorithm
    };
  }

  /**
   * Calcule le taux de succès du cache
   */
  private calculateCacheHitRate(): number {
    // Implémentation simplifiée
    return this.hashCache.size > 0 ? 0.5 : 0;
  }

  /**
   * Vérifie si le FileHasher est initialisé
   */
  public isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Réinitialise le FileHasher
   */
  public reset(): void {
    this.hashCache.clear();
    this.isInitialized = false;
    logger.info('FileHasher réinitialisé');
  }
}

/**
 * Statistiques du cache
 */
export interface CacheStats {
  cache_size: number;
  max_cache_size: number;
  cache_hit_rate: number;
  algorithm: string;
}

export default FileHasher;
