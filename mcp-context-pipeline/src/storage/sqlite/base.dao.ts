/**
 * DAO de base pour SQLite
 * Fournit des opérations CRUD génériques pour toutes les tables
 */

import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { logger } from '../../utils/structured-logger.js';

/**
 * Interface pour les opérations CRUD de base
 */
export interface BaseDAO<T> {
  create(data: Partial<T>): Promise<T>;
  findById(id: number): Promise<T | null>;
  findAll(filter?: Partial<T>): Promise<T[]>;
  update(id: number, data: Partial<T>): Promise<T | null>;
  delete(id: number): Promise<boolean>;
  count(filter?: Partial<T>): Promise<number>;
}

/**
 * Configuration de la base de données
 */
export interface DatabaseConfig {
  path: string;
  verbose?: boolean;
  readonly?: boolean;
}

/**
 * Classe de base pour tous les DAO
 */
export abstract class BaseDAOImpl<T extends { id?: number }> implements BaseDAO<T> {
  protected db: Database | null = null;
  protected tableName: string;
  protected config: DatabaseConfig;

  constructor(tableName: string, config: DatabaseConfig) {
    this.tableName = tableName;
    this.config = config;
  }

  /**
   * Initialise la connexion à la base de données
   */
  protected async init(): Promise<void> {
    if (this.db) return;

    try {
      this.db = await open({
        filename: this.config.path,
        driver: sqlite3.Database,
        mode: this.config.readonly ? sqlite3.OPEN_READONLY : sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
      });

      if (this.config.verbose) {
        logger.debug(`Connexion SQLite établie: ${this.config.path}`);
      }
    } catch (error) {
      logger.error('Erreur lors de la connexion à SQLite', {
        error: error instanceof Error ? error.message : String(error),
        path: this.config.path
      });
      throw error;
    }
  }

  /**
   * Crée un nouvel enregistrement
   */
  async create(data: Partial<T>): Promise<T> {
    await this.init();

    try {
      const keys = Object.keys(data).filter(key => data[key as keyof T] !== undefined);
      const values = keys.map(key => data[key as keyof T]);
      const placeholders = keys.map(() => '?').join(', ');
      const columns = keys.join(', ');

      const sql = `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`;

      const result = await this.db!.run(sql, values);
      const insertedId = result.lastID;

      logger.debug('Enregistrement créé', {
        table: this.tableName,
        id: insertedId,
        columns: keys
      });

      return { ...data as T, id: insertedId };
    } catch (error) {
      logger.error('Erreur lors de la création', {
        error: error instanceof Error ? error.message : String(error),
        table: this.tableName,
        data
      });
      throw error;
    }
  }

  /**
   * Trouve un enregistrement par ID
   */
  async findById(id: number): Promise<T | null> {
    await this.init();

    try {
      const sql = `SELECT * FROM ${this.tableName} WHERE id = ?`;
      const row = await this.db!.get(sql, id);

      if (!row) {
        logger.debug('Enregistrement non trouvé', {
          table: this.tableName,
          id
        });
        return null;
      }

      return row as T;
    } catch (error) {
      logger.error('Erreur lors de la recherche par ID', {
        error: error instanceof Error ? error.message : String(error),
        table: this.tableName,
        id
      });
      throw error;
    }
  }

  /**
   * Trouve tous les enregistrements avec filtre optionnel
   */
  async findAll(filter?: Partial<T>): Promise<T[]> {
    await this.init();

    try {
      let sql = `SELECT * FROM ${this.tableName}`;
      const params: any[] = [];

      if (filter && Object.keys(filter).length > 0) {
        const conditions = Object.keys(filter)
          .filter(key => filter[key as keyof T] !== undefined)
          .map((key, index) => `${key} = ?`);

        if (conditions.length > 0) {
          sql += ` WHERE ${conditions.join(' AND ')}`;
          params.push(...Object.values(filter).filter(val => val !== undefined));
        }
      }

      sql += ' ORDER BY id DESC';

      const rows = await this.db!.all(sql, params);
      return rows as T[];
    } catch (error) {
      logger.error('Erreur lors de la recherche de tous les enregistrements', {
        error: error instanceof Error ? error.message : String(error),
        table: this.tableName,
        filter
      });
      throw error;
    }
  }

  /**
   * Met à jour un enregistrement
   */
  async update(id: number, data: Partial<T>): Promise<T | null> {
    await this.init();

    try {
      const existing = await this.findById(id);
      if (!existing) {
        return null;
      }

      const updates = Object.keys(data)
        .filter(key => data[key as keyof T] !== undefined && key !== 'id')
        .map(key => `${key} = ?`);

      if (updates.length === 0) {
        return existing;
      }

      const values = Object.keys(data)
        .filter(key => data[key as keyof T] !== undefined && key !== 'id')
        .map(key => data[key as keyof T]);

      values.push(id);

      const sql = `UPDATE ${this.tableName} SET ${updates.join(', ')} WHERE id = ?`;
      await this.db!.run(sql, values);

      logger.debug('Enregistrement mis à jour', {
        table: this.tableName,
        id,
        updates: Object.keys(data).filter(key => key !== 'id')
      });

      return { ...existing, ...data } as T;
    } catch (error) {
      logger.error('Erreur lors de la mise à jour', {
        error: error instanceof Error ? error.message : String(error),
        table: this.tableName,
        id,
        data
      });
      throw error;
    }
  }

  /**
   * Supprime un enregistrement
   */
  async delete(id: number): Promise<boolean> {
    await this.init();

    try {
      const existing = await this.findById(id);
      if (!existing) {
        return false;
      }

      const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
      await this.db!.run(sql, id);

      logger.debug('Enregistrement supprimé', {
        table: this.tableName,
        id
      });

      return true;
    } catch (error) {
      logger.error('Erreur lors de la suppression', {
        error: error instanceof Error ? error.message : String(error),
        table: this.tableName,
        id
      });
      throw error;
    }
  }

  /**
   * Compte les enregistrements avec filtre optionnel
   */
  async count(filter?: Partial<T>): Promise<number> {
    await this.init();

    try {
      let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
      const params: any[] = [];

      if (filter && Object.keys(filter).length > 0) {
        const conditions = Object.keys(filter)
          .filter(key => filter[key as keyof T] !== undefined)
          .map((key, index) => `${key} = ?`);

        if (conditions.length > 0) {
          sql += ` WHERE ${conditions.join(' AND ')}`;
          params.push(...Object.values(filter).filter(val => val !== undefined));
        }
      }

      const result = await this.db!.get(sql, params);
      return result?.count || 0;
    } catch (error) {
      logger.error('Erreur lors du comptage', {
        error: error instanceof Error ? error.message : String(error),
        table: this.tableName,
        filter
      });
      throw error;
    }
  }

  /**
   * Exécute une requête SQL personnalisée
   */
  protected async query(sql: string, params: any[] = []): Promise<any[]> {
    await this.init();

    try {
      return await this.db!.all(sql, params);
    } catch (error) {
      logger.error('Erreur lors de l\'exécution de la requête', {
        error: error instanceof Error ? error.message : String(error),
        sql,
        params
      });
      throw error;
    }
  }

  /**
   * Exécute une commande SQL (INSERT, UPDATE, DELETE)
   */
  protected async run(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    await this.init();

    try {
      return await this.db!.run(sql, params);
    } catch (error) {
      logger.error('Erreur lors de l\'exécution de la commande', {
        error: error instanceof Error ? error.message : String(error),
        sql,
        params
      });
      throw error;
    }
  }

  /**
   * Ferme la connexion à la base de données
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      logger.debug('Connexion SQLite fermée');
    }
  }
}

export default BaseDAOImpl;
