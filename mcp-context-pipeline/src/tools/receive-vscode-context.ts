/**
 * Outil MCP pour recevoir les événements VS Code
 *
 * Cet outil reçoit les événements capturés passivement par l'extension VS Code,
 * les valide, les normalise, les enrichit et les stocke dans SQLite.
 */

import { Tool } from '@modelcontextprotocol/sdk/server/tool.js';
import { enrichErrorData } from '../enrichers/error.enricher.js';
import { enrichFileData } from '../enrichers/file.enricher.js';
import { normalizeTechnicalData } from '../normalizers/technical.normalizer.js';
import { EventsDAO } from '../storage/sqlite/events.dao.js';
import { logger, logValidationError, logVSCodeEvent } from '../utils/structured-logger.js';
import { validateVSCodeEvent } from '../validators/json-schema.validator.js';

/**
 * Schéma d'entrée pour l'outil receive-vscode-context
 */
const inputSchema = {
  type: 'object',
  properties: {
    event: {
      type: 'object',
      description: 'Événement VS Code capturé',
      properties: {
        source: { type: 'string', enum: ['vscode'] },
        type: {
          type: 'string',
          enum: ['file_save', 'diagnostic', 'workspace', 'error']
        },
        timestamp: { type: 'string', format: 'date-time' },
        project_id: { type: 'string', minLength: 1 },
        file: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            language: { type: 'string' },
            hash: { type: 'string', minLength: 64, maxLength: 64 }
          },
          required: ['path', 'hash']
        },
        payload: { type: 'object' }
      },
      required: ['source', 'type', 'timestamp', 'project_id', 'payload']
    },
    metadata: {
      type: 'object',
      description: 'Métadonnées supplémentaires',
      properties: {
        workspace: { type: 'string' },
        git_branch: { type: 'string' },
        git_commit: { type: 'string' },
        vscode_version: { type: 'string' }
      }
    }
  },
  required: ['event']
};

/**
 * Définition de l'outil MCP
 */
export const receiveVSCodeContextTool: Tool = {
  definition: {
    name: 'receive_vscode_context',
    description: 'Reçoit un événement VS Code capturé passivement, le valide, le normalise et le stocke',
    inputSchema
  },

  /**
   * Handler principal de l'outil
   */
  async handler(args: any) {
    const startTime = Date.now();

    try {
      logger.info('Début traitement événement VS Code');

      // 1. Extraction des arguments
      const { event, metadata = {} } = args;

      // 2. Validation JSON Schema
      logger.debug('Validation JSON Schema...');
      const validationResult = await validateVSCodeEvent(event);
      if (!validationResult.valid) {
        logValidationError(new Error('Événement invalide'), { errors: validationResult.errors });
        throw new Error(`Événement invalide: ${validationResult.errors?.join(', ')}`);
      }

      // 3. Log de l'événement reçu
      logVSCodeEvent(event.type, {
        project_id: event.project_id,
        file_path: event.file?.path,
        timestamp: event.timestamp
      });

      // 4. Normalisation technique
      logger.debug('Normalisation technique...');
      const normalizedEvent = await normalizeTechnicalData(event, metadata);

      // 5. Enrichissement selon le type d'événement
      logger.debug('Enrichissement des données...');
      let enrichedEvent = normalizedEvent;

      if (event.type === 'file_save' || event.type === 'diagnostic') {
        enrichedEvent = await enrichFileData(enrichedEvent);
      }

      if (event.type === 'error') {
        enrichedEvent = await enrichErrorData(enrichedEvent);
      }

      // 6. Stockage dans SQLite
      logger.debug('Stockage dans SQLite...');
      const eventsDAO = EventsDAO.getInstance();
      const storedEvent = await eventsDAO.create(enrichedEvent);

      // 7. Log de succès
      const duration = Date.now() - startTime;
      logger.info('Événement traité avec succès', {
        event_id: storedEvent.id,
        event_type: event.type,
        duration_ms: duration,
        project_id: event.project_id
      });

      // 8. Retour du résultat
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              event_id: storedEvent.id,
              event_uuid: storedEvent.event_uuid,
              message: `Événement ${event.type} traité avec succès`,
              duration_ms: duration
            }, null, 2)
          }
        ]
      };

    } catch (error) {
      // Gestion des erreurs
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Erreur lors du traitement de l\'événement', {
        error: errorMessage,
        duration_ms: duration,
        event_type: args.event?.type,
        project_id: args.event?.project_id
      });

      // Retour d'erreur structurée
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: errorMessage,
              duration_ms: duration,
              message: 'Échec du traitement de l\'événement'
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }
};

/**
 * Fonction utilitaire pour créer un événement de test
 * (Utilisée uniquement pour les tests)
 */
export function createTestEvent(eventType: string, projectId: string = 'test-project') {
  return {
    source: 'vscode',
    type: eventType,
    timestamp: new Date().toISOString(),
    project_id: projectId,
    file: {
      path: '/test/file.ts',
      language: 'typescript',
      hash: 'a'.repeat(64)
    },
    payload: {
      content_preview: '// Test content',
      line_count: 10,
      has_errors: false,
      has_warnings: false
    }
  };
}

export default receiveVSCodeContextTool;
