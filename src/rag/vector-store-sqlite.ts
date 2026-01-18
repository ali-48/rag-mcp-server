// src/rag/vector-store-sqlite.ts
// Backend SQLite pour le stockage vectoriel RAG - Implémente IVectorStore

import { getDbConfigManager } from '../config/db-config.js';
import {
  EmbedAndStoreOptions,
  IVectorStore,
  ProjectStats,
  SearchResult,
  SemanticSearchOptions,
  StoreStats,
  VectorStoreConfig,
  VectorStoreLogger,
  createDocumentId
} from './vector-store-interface.js';

/**
 * Classe principale pour le backend SQLite vectoriel
 * Implémente l'interface IVectorStore pour l'abstraction
 */
export class VectorStoreSQLite implements IVectorStore {
  private db: any;
  private dbConfigManager = getDbConfigManager();
  private config: VectorStoreConfig;

  constructor(config?: VectorStoreConfig) {
    if (config) {
      this.config = config;
      // Utiliser la configuration fournie
      if (config.sqlite?.file) {
        // Charger sqlite3 dynamiquement
        const sqlite3 = this.loadSqlite3();
        this.db = new sqlite3.Database(config.sqlite.file);
      } else {
        // Fallback à la configuration existante
        this.db = this.dbConfigManager.getSqliteConnection('vectors');
      }
    } else {
      // Compatibilité avec l'ancien code
      this.db = this.dbConfigManager.getSqliteConnection('vectors');
      this.config = {
        type: 'sqlite',
        sqlite: { file: ':memory:' } // Valeur par défaut
      };
    }

    this.initializeTable();
  }
  deleteDocumentsByPattern(pattern: string): Promise<number> {
    throw new Error('Method not implemented.');
  }
  getStats(): Promise<StoreStats> {
    throw new Error('Method not implemented.');
  }
  initialize(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  testConnection(): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  updateDocument(id: string, updates: Partial<{ content: string; embedding: number[]; metadata: Partial<EmbedAndStoreOptions>; }>): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  hybridSearch?(queryEmbedding: number[], textQuery: string, options?: SemanticSearchOptions & { semanticWeight?: number; textWeight?: number; }): Promise<SearchResult[]> {
    throw new Error('Method not implemented.');
  }
  searchByMetadata?(filters: Partial<EmbedAndStoreOptions> & {
    projectPath?: string; dateRange?: {
      from
      /**
       * Stocke un document avec son embedding
       * Implémentation de IVectorStore.embedAndStore
       */
      ?: Date; to?: Date;
    };
  }): Promise<SearchResult[]> {
    throw new Error('Method not implemented.');
  }

  /**
   * Charge sqlite3 dynamiquement
   */
  private loadSqlite3(): any {
    try {
      // Utiliser require pour compatibilité
      return require('sqlite3');
    } catch (error) {
      // Fallback pour les tests
      return {
        Database: class MockDatabase {
          constructor(path: string) { }
          exec(sql: string) { }
          run(sql: string, params: any[], callback: Function) {
            if (callback) callback(null);
            return { changes: 0 };
          }
          all(sql: string, params: any[], callback: Function) {
            if (callback) callback(null, []);
          }
          get(sql: string, params: any[], callback: Function) {
            if (callback) callback(null, {});
          }
        }
      };
    }
  }

  /**
   * Initialise la table si elle n'existe pas
   */
  private initializeTable(): void {
    this.db.exec(`
            CREATE TABLE IF NOT EXISTS rag_vectors (
                id TEXT PRIMARY KEY,
                project_path TEXT NOT NULL,
                file_path TEXT NOT NULL,
                chunk_index INTEGER NOT NULL,
                total_chunks INTEGER NOT NULL,
                content TEXT NOT NULL,
                content_type TEXT NOT NULL,
                role TEXT,
                file_extension TEXT,
                file_size_bytes INTEGER NOT NULL,
                lines_count INTEGER,
                language TEXT,
                embedding BLOB NOT NULL,
                is_compressed BOOLEAN DEFAULT FALSE,
                original_size_bytes INTEGER,
                version INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_rag_vectors_project ON rag_vectors(project_path);
            CREATE INDEX IF NOT EXISTS idx_rag_vectors_file ON rag_vectors(file_path);
            CREATE INDEX IF NOT EXISTS idx_rag_vectors_content_type ON rag_vectors(content_type);
            CREATE INDEX IF NOT EXISTS idx_rag_vectors_language ON rag_vectors(language);
            CREATE INDEX IF NOT EXISTS idx_rag_vectors_created ON rag_vectors(created_at);
            CREATE INDEX IF NOT EXISTS idx_rag_vectors_updated ON rag_vectors(updated_at);
        `);

    VectorStoreLogger.info('init', 'Table rag_vectors initialisée');
  }

  /**
   * Normalise la longueur des vecteurs pour qu'ils aient la même dimension
   * - Si les vecteurs ont la même longueur, les retourner tels quels
   * - Sinon, pad le vecteur plus court avec des zéros et tronquer le plus long
   */
  private normalizeVectorLength(vec1: number[], vec2: number[]): [number[], number[]] {
    if (vec1.length === vec2.length) {
      return [vec1, vec2];
    }

    const targetLength = Math.max(vec1.length, vec2.length);

    const normalize = (vec: number[], length: number): number[] => {
      if (vec.length === length) {
        return vec;
      }
      const result = new Array(length).fill(0);
      const copyLength = Math.min(vec.length, length);
      for (let i = 0; i < copyLength; i++) {
        result[i] = vec[i];
      }
      return result;
    };

    return [normalize(vec1, targetLength), normalize(vec2, targetLength)];
  }

  /**
   * Calcule la similarité cosinus entre deux vecteurs
   * Gère les vecteurs de dimensions différentes en les normalisant
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    // Normaliser les longueurs si nécessaire
    const [normalizedVec1, normalizedVec2] = this.normalizeVectorLength(vec1, vec2);

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < normalizedVec1.length; i++) {
      dotProduct += normalizedVec1[i] * normalizedVec2[i];
      norm1 += normalizedVec1[i] * normalizedVec1[i];
      norm2 += normalizedVec2[i] * normalizedVec2[i];
    }

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Stocke un document avec son embedding
   * Implémentation de IVectorStore.embedAndStore
   */
  async embedAndStore(
    projectPath: string,
    filePath: string,
    content: string,
    embedding: number[],
    options: EmbedAndStoreOptions = {}
  ): Promise<void> {
    const {
      chunkIndex = 0,
      totalChunks = 1,
      contentType = 'other',
      role = null,
      fileExtension = null,
      language = null,
      linesCount = null,
      isCompressed = false
    } = options;

    // Utiliser la fonction utilitaire pour créer l'ID
    const id = createDocumentId(projectPath, filePath, chunkIndex);

    // Calculer les métadonnées automatiquement si non fournies
    const finalFileExtension = fileExtension || filePath.split('.').pop() || null;
    const finalLinesCount = linesCount || content.split('\n').length;
    const fileSizeBytes = content.length;
    const originalSizeBytes = isCompressed ? Buffer.from(content).length : content.length;

    // Convertir l'embedding en Buffer pour stockage BLOB
    const embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer);

    try {
      await this.runQuery(
        `INSERT INTO rag_vectors (
                    id, project_path, file_path, chunk_index, total_chunks,
                    content, content_type, role, file_extension, file_size_bytes,
                    lines_count, language, embedding, is_compressed, original_size_bytes,
                    version, created_at, updated_at, indexed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET
                    content = excluded.content,
                    content_type = excluded.content_type,
                    role = excluded.role,
                    file_extension = excluded.file_extension,
                    file_size_bytes = excluded.file_size_bytes,
                    lines_count = excluded.lines_count,
                    language = excluded.language,
                    embedding = excluded.embedding,
                    is_compressed = excluded.is_compressed,
                    original_size_bytes = excluded.original_size_bytes,
                    updated_at = CURRENT_TIMESTAMP`,
        [
          id, projectPath, filePath, chunkIndex, totalChunks,
          content, contentType, role, finalFileExtension, fileSizeBytes,
          finalLinesCount, language, embeddingBuffer, isCompressed ? 1 : 0, originalSizeBytes
        ]
      );

      VectorStoreLogger.info('store', `Document stocké: ${id}`, {
        projectPath,
        filePath,
        contentType,
        chunkIndex,
        totalChunks
      });
    } catch (error) {
      VectorStoreLogger.error('store', `Erreur lors du stockage du document ${id}`, error as Error, {
        projectPath,
        filePath
      });
      throw error;
    }
  }

  /**
   * Recherche sémantique avec similarité cosinus
   * Implémentation de IVectorStore.semanticSearch
   */
  async semanticSearch(
    queryEmbedding: number[],
    options: SemanticSearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      projectFilter,
      limit = 10,
      threshold = 0.3,
      contentTypeFilter,
      roleFilter,
      languageFilter,
      minFileSizeBytes,
      maxFileSizeBytes,
      minLinesCount,
      maxLinesCount,
      dateFrom,
      dateTo
    } = options;

    // Récupérer tous les vecteurs avec leurs métadonnées
    // Note: Pour les grandes bases, il faudrait implémenter un index vectoriel
    // Pour l'instant, on calcule la similarité en mémoire
    let sql = `
            SELECT id, project_path, file_path, content, content_type, role,
                   file_extension, lines_count, language, is_compressed, original_size_bytes,
                   embedding, created_at, updated_at
            FROM rag_vectors
            WHERE 1=1
        `;

    const params: any[] = [];

    // Appliquer les filtres
    if (projectFilter) {
      sql += ' AND project_path = ?';
      params.push(projectFilter);
    }

    if (contentTypeFilter) {
      if (Array.isArray(contentTypeFilter)) {
        if (contentTypeFilter.length > 0) {
          const placeholders = contentTypeFilter.map(() => '?').join(', ');
          sql += ` AND content_type IN (${placeholders})`;
          params.push(...contentTypeFilter);
        }
      } else {
        sql += ' AND content_type = ?';
        params.push(contentTypeFilter);
      }
    }

    if (roleFilter) {
      if (Array.isArray(roleFilter)) {
        if (roleFilter.length > 0) {
          const placeholders = roleFilter.map(() => '?').join(', ');
          sql += ` AND role IN (${placeholders})`;
          params.push(...roleFilter);
        }
      } else {
        sql += ' AND role = ?';
        params.push(roleFilter);
      }
    }

    if (languageFilter) {
      if (Array.isArray(languageFilter)) {
        if (languageFilter.length > 0) {
          const placeholders = languageFilter.map(() => '?').join(', ');
          sql += ` AND language IN (${placeholders})`;
          params.push(...languageFilter);
        }
      } else {
        sql += ' AND language = ?';
        params.push(languageFilter);
      }
    }

    if (minFileSizeBytes !== undefined) {
      sql += ' AND file_size_bytes >= ?';
      params.push(minFileSizeBytes);
    }

    if (maxFileSizeBytes !== undefined) {
      sql += ' AND file_size_bytes <= ?';
      params.push(maxFileSizeBytes);
    }

    if (minLinesCount !== undefined) {
      sql += ' AND lines_count >= ?';
      params.push(minLinesCount);
    }

    if (maxLinesCount !== undefined) {
      sql += ' AND lines_count <= ?';
      params.push(maxLinesCount);
    }

    if (dateFrom) {
      sql += ' AND created_at >= ?';
      params.push(dateFrom.toISOString());
    }

    if (dateTo) {
      sql += ' AND created_at <= ?';
      params.push(dateTo.toISOString());
    }

    try {
      const rows = await this.allQuery(sql, params);
      const results: Array<SearchResult & { similarity: number }> = [];

      // Calculer la similarité pour chaque résultat
      for (const row of rows) {
        // Convertir le BLOB en tableau de nombres
        const embeddingBuffer = row.embedding as Buffer;
        const storedEmbedding = Array.from(new Float32Array(embeddingBuffer.buffer));

        // Calculer la similarité cosinus
        const similarity = this.cosineSimilarity(queryEmbedding, storedEmbedding);

        if (similarity >= threshold) {
          results.push({
            id: row.id,
            filePath: row.file_path,
            content: row.content,
            score: similarity,
            similarity,
            metadata: {
              projectPath: row.project_path,
              fileSize: row.file_size_bytes,
              originalSize: row.original_size_bytes || row.file_size_bytes,
              lines: row.content.split('\n').length,
              contentType: row.content_type || null,
              role: row.role || null,
              fileExtension: row.file_extension || null,
              language: row.language || null,
              linesCount: row.lines_count || null,
              isCompressed: row.is_compressed === 1,
              compressionRatio: row.is_compressed === 1 && row.original_size_bytes
                ? ((row.content.length / row.original_size_bytes) * 100).toFixed(1) + '%'
                : null,
              createdAt: row.created_at ? new Date(row.created_at) : null,
              updatedAt: row.updated_at ? new Date(row.updated_at) : null,
            },
          });
        }
      }

      // Trier par similarité (décroissant) et limiter
      results.sort((a, b) => b.similarity - a.similarity);
      const limitedResults = results.slice(0, limit);

      VectorStoreLogger.info('search', `Recherche terminée: ${limitedResults.length} résultats`, {
        totalCandidates: rows.length,
        filteredResults: results.length,
        finalResults: limitedResults.length,
        threshold
      });

      return limitedResults;
    } catch (error) {
      VectorStoreLogger.error('search', 'Erreur lors de la recherche sémantique', error as Error);
      throw error;
    }
  }

  /**
   * Obtient les statistiques d'un projet
   * Implémentation de IVectorStore.getProjectStats
   */
  async getProjectStats(projectPath: string): Promise<ProjectStats> {
    try {
      // Statistiques de base
      const statsResult = await this.getQuery(
        `SELECT
                    COUNT(*) as total_chunks,
                    MIN(created_at) as indexed_at,
                    MAX(updated_at) as last_updated
                FROM rag_vectors
                WHERE project_path = ?`,
        [projectPath]
      );

      const totalChunks = parseInt(statsResult.total_chunks) || 0;

      // Compter les fichiers uniques (approximation basée sur file_path sans chunk index)
      const filesResult = await this.getQuery(
        `SELECT COUNT(DISTINCT
                    CASE
                        WHEN INSTR(file_path, '#chunk') > 0
                        THEN SUBSTR(file_path, 1, INSTR(file_path, '#chunk') - 1)
                        ELSE file_path
                    END
                ) as total_files
                FROM rag_vectors
                WHERE project_path = ?`,
        [projectPath]
      );

      const totalFiles = parseInt(filesResult.total_files) || 0;

      // Distribution par type de contenu
      const typesResult = await this.allQuery(
        `SELECT content_type, COUNT(*) as count
                FROM rag_vectors
                WHERE project_path = ?
                GROUP BY content_type`,
        [projectPath]
      );

      const contentTypes: Record<string, number> = {};
      typesResult.forEach(typeRow => {
        contentTypes[typeRow.content_type] = parseInt(typeRow.count);
      });

      return {
        totalFiles,
        totalChunks,
        indexedAt: statsResult.indexed_at ? new Date(statsResult.indexed_at) : null,
        lastUpdated: statsResult.last_updated ? new Date(statsResult.last_updated) : null,
        contentTypes,
      };
    } catch (error) {
      VectorStoreLogger.error('stats', `Erreur lors de la récupération des stats pour ${projectPath}`, error as Error);
      throw error;
    }
  }

  /**
   * Liste tous les projets indexés
   * Implémentation de IVectorStore.listProjects
   */
  async listProjects(): Promise<string[]> {
    try {
      const result = await this.allQuery(
        `SELECT DISTINCT project_path FROM rag_vectors ORDER BY project_path`
      );

      return result.map(row => row.project_path);
    } catch (error) {
      VectorStoreLogger.error('list', 'Erreur lors du listing des projets', error as Error);
      throw error;
    }
  }

  /**
   * Supprime un document par son ID
   * Implémentation de IVectorStore.deleteDocument
   */
  async deleteDocument(id: string): Promise<boolean> {
    try {
      const result = await this.runQuery(
        'DELETE FROM rag_vectors WHERE id = ?',
        [id]
      );

      const deleted = result.changes > 0;
      if (deleted) {
        VectorStoreLogger.info('delete', `Document supprimé: ${id}`);
      }

      return deleted;
    } catch (error) {
      VectorStoreLogger.error('delete', `Erreur lors de la suppression du document ${id}`, error as Error);
      throw error;
    }
  }

  /**
   * Vide la table (pour les tests)
   * Implémentation de IVectorStore.clearAll
   */
  async clearAll(): Promise<void> {
    try {
      await this.runQuery('DELETE FROM rag_vectors');
      VectorStoreLogger.info('clear', 'Tous les documents ont été supprimés');
    } catch (error) {
      VectorStoreLogger.error('clear', 'Erreur lors du vidage de la table', error as Error);
      throw error;
    }
  }

  /**
   * Exécute une requête SQL et retourne le résultat
   */
  private runQuery(sql: string, params: any[] = []): Promise<{ changes: number }> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (this: { changes: number }, err: Error | null) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes || 0 });
        }
      });
    });
  }

  /**
   * Exécute une requête SQL et retourne toutes les lignes
   */
  private allQuery(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Exécute une requête SQL et retourne une seule ligne
   */
  private getQuery(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err: Error | null, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }
}
