/**
 * Normalisateur technique pour les événements VS Code
 *
 * Ce module enrichit les événements avec des métadonnées techniques :
 * - UUID unique pour chaque événement
 * - Timestamps normalisés
 * - Métadonnées système
 * - Informations de version
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/structured-logger.js';

/**
 * Interface pour les métadonnées techniques
 */
export interface TechnicalMetadata {
  event_uuid: string;
  processed_at: string;
  pipeline_version: string;
  node_version: string;
  os_info?: {
    platform: string;
    arch: string;
    release: string;
  };
  metadata?: Record<string, any>;
}

/**
 * Normalise un événement VS Code avec des métadonnées techniques
 */
export async function normalizeTechnicalData(
  event: any,
  metadata: Record<string, any> = {}
): Promise<any> {
  const startTime = Date.now();

  try {
    logger.debug('Début normalisation technique', {
      event_type: event.type,
      project_id: event.project_id
    });

    // Créer les métadonnées techniques
    const technicalMetadata: TechnicalMetadata = {
      event_uuid: uuidv4(),
      processed_at: new Date().toISOString(),
      pipeline_version: process.env.npm_package_version || '0.1.0',
      node_version: process.version,
      os_info: {
        platform: process.platform,
        arch: process.arch,
        release: String(process.release)
      },
      metadata
    };

    // Normaliser le timestamp de l'événement
    let normalizedTimestamp = event.timestamp;
    try {
      // S'assurer que le timestamp est au format ISO-8601
      const date = new Date(event.timestamp);
      if (isNaN(date.getTime())) {
        throw new Error('Timestamp invalide');
      }
      normalizedTimestamp = date.toISOString();
    } catch (error) {
      logger.warn('Timestamp invalide, utilisation du timestamp actuel', {
        original_timestamp: event.timestamp,
        error: error instanceof Error ? error.message : String(error)
      });
      normalizedTimestamp = new Date().toISOString();
    }

    // Créer l'événement normalisé
    const normalizedEvent = {
      ...event,
      timestamp: normalizedTimestamp,
      technical_metadata: technicalMetadata,
      // Ajouter des champs normalisés supplémentaires
      normalized_at: new Date().toISOString(),
      processing_stage: 'technical_normalization'
    };

    // Log de succès
    const duration = Date.now() - startTime;
    logger.debug('Normalisation technique terminée', {
      event_type: event.type,
      event_uuid: technicalMetadata.event_uuid,
      duration_ms: duration,
      project_id: event.project_id
    });

    return normalizedEvent;

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Erreur lors de la normalisation technique', {
      error: errorMessage,
      duration_ms: duration,
      event_type: event.type,
      project_id: event.project_id
    });

    // En cas d'erreur, retourner l'événement original avec un UUID minimal
    return {
      ...event,
      technical_metadata: {
        event_uuid: uuidv4(),
        processed_at: new Date().toISOString(),
        pipeline_version: '0.1.0',
        normalization_error: errorMessage
      },
      normalized_at: new Date().toISOString(),
      processing_stage: 'technical_normalization_failed'
    };
  }
}

/**
 * Normalise un tableau d'événements
 */
export async function normalizeTechnicalDataBatch(
  events: any[],
  metadata: Record<string, any> = {}
): Promise<any[]> {
  const normalizedEvents = [];

  for (const event of events) {
    normalizedEvents.push(await normalizeTechnicalData(event, metadata));
  }

  return normalizedEvents;
}

/**
 * Extrait les métadonnées techniques d'un événement normalisé
 */
export function extractTechnicalMetadata(event: any): TechnicalMetadata | null {
  if (!event || !event.technical_metadata) {
    return null;
  }

  return event.technical_metadata as TechnicalMetadata;
}

/**
 * Vérifie si un événement a été normalisé
 */
export function isTechnicallyNormalized(event: any): boolean {
  return Boolean(
    event &&
    event.technical_metadata &&
    event.technical_metadata.event_uuid &&
    event.normalized_at
  );
}

export default {
  normalizeTechnicalData,
  normalizeTechnicalDataBatch,
  extractTechnicalMetadata,
  isTechnicallyNormalized
};
