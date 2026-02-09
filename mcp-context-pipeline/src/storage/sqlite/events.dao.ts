/**
 * DAO pour la table events
 */

import { logger } from '../../utils/structured-logger.js';
import { BaseDAOImpl } from './base.dao.js';

/**
 * Interface pour un événement
 */
export interface EventRecord {
  id?: number;
  event_uuid: string;
  project_id: string;
  source: string;
  event_type: string;
  timestamp: string;
  file_path?: string;
  file_language?: string;
  file_hash?: string;
  payload_json: string;
  status: string;
  processing_attempts: number;
  last_processing_attempt?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Configuration de la base de données par défaut
 */
const DEFAULT_CONFIG = {
  path: process.env.DATABASE_PATH || './data/context.db',
  verbose: process.env.NODE_ENV !== 'production'
};

/**
 * DAO pour la table events
 */
export class EventsDAO extends BaseDAOImpl<EventRecord> {
  private static instance: EventsDAO;

  private constructor() {
    super('events', DEFAULT_CONFIG);
  }

  /**
   * Obtient l'instance singleton
   */
  public static getInstance(): EventsDAO {
    if (!EventsDAO.instance) {
      EventsDAO.instance = new EventsDAO();
    }
    return EventsDAO.instance;
  }

  /**
   * Crée un événement avec validation
   */
  async create(event: Partial<EventRecord>): Promise<EventRecord> {
    // Validation basique
    if (!event.event_uuid) {
      throw new Error('event_uuid est requis');
    }
    if (!event.project_id) {
      throw new Error('project_id est requis');
    }
    if (!event.event_type) {
      throw new Error('event_type est requis');
    }
    if (!event.payload_json) {
      throw new Error('payload_json est requis');
    }

    // Valeurs par défaut
    const eventWithDefaults: Partial<EventRecord> = {
      source: 'vscode',
      status: 'pending',
      processing_attempts: 0,
      ...event
    };

    return super.create(eventWithDefaults);
  }

  /**
   * Trouve les événements en attente de traitement
   */
  async findPending(limit: number = 100): Promise<EventRecord[]> {
    await this.init();

    try {
      const sql = `
        SELECT * FROM events
        WHERE status = 'pending'
        ORDER BY timestamp ASC
        LIMIT ?
      `;

      const rows = await this.query(sql, [limit]);
      return rows as EventRecord[];
    } catch (error) {
      logger.error('Erreur lors de la recherche des événements en attente', {
        error: error instanceof Error ? error.message : String(error),
        limit
      });
      throw error;
    }
  }

  /**
   * Marque un événement comme en cours de traitement
   */
  async markAsProcessing(id: number): Promise<boolean> {
    await this.init();

    try {
      const sql = `
        UPDATE events
        SET status = 'processing',
            processing_attempts = processing_attempts + 1,
            last_processing_attempt = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'pending'
      `;

      const result = await this.run(sql, [id]);
      return result.changes > 0;
    } catch (error) {
      logger.error('Erreur lors du marquage comme traitement', {
        error: error instanceof Error ? error.message : String(error),
        id
      });
      throw error;
    }
  }

  /**
   * Marque un événement comme traité
   */
  async markAsProcessed(id: number): Promise<boolean> {
    await this.init();

    try {
      const sql = `
        UPDATE events
        SET status = 'processed',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'processing'
      `;

      const result = await this.run(sql, [id]);
      return result.changes > 0;
    } catch (error) {
      logger.error('Erreur lors du marquage comme traité', {
        error: error instanceof Error ? error.message : String(error),
        id
      });
      throw error;
    }
  }

  /**
   * Marque un événement comme échoué
   */
  async markAsFailed(id: number, errorMessage?: string): Promise<boolean> {
    await this.init();

    try {
      let sql = `
        UPDATE events
        SET status = 'failed',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      const params: any[] = [id];

      if (errorMessage) {
        // Mettre à jour le payload JSON avec le message d'erreur
        sql = `
          UPDATE events
          SET status = 'failed',
              payload_json = json_set(payload_json, '$.error', ?),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;
        params.unshift(errorMessage);
      }

      const result = await this.run(sql, params);
      return result.changes > 0;
    } catch (error) {
      logger.error('Erreur lors du marquage comme échoué', {
        error: error instanceof Error ? error.message : String(error),
        id
      });
      throw error;
    }
  }

  /**
   * Statistiques des événements par type
   */
  async getStatsByType(): Promise<Record<string, number>> {
    await this.init();

    try {
      const sql = `
        SELECT event_type, COUNT(*) as count
        FROM events
        GROUP BY event_type
        ORDER BY count DESC
      `;

      const rows = await this.query(sql);
      const stats: Record<string, number> = {};

      for (const row of rows) {
        stats[row.event_type] = row.count;
      }

      return stats;
    } catch (error) {
      logger.error('Erreur lors de la récupération des statistiques', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {};
    }
  }

  /**
   * Statistiques des événements par projet
   */
  async getStatsByProject(): Promise<Record<string, number>> {
    await this.init();

    try {
      const sql = `
        SELECT project_id, COUNT(*) as count
        FROM events
        GROUP BY project_id
        ORDER BY count DESC
      `;

      const rows = await this.query(sql);
      const stats: Record<string, number> = {};

      for (const row of rows) {
        stats[row.project_id] = row.count;
      }

      return stats;
    } catch (error) {
      logger.error('Erreur lors de la récupération des statistiques par projet', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {};
    }
  }
}

export default EventsDAO;
