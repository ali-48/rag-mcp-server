/**
 * Normalisateur d'événements pour la capture passive
 *
 * Transforme les données brutes VS Code en format JSON normalisé
 * conforme aux schémas définis dans extension-rag/src/models/event-schemas.ts
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

/**
 * Interface pour les événements normalisés
 */
export interface NormalizedEvent {
  event_uuid: string;
  event_type: string;
  timestamp: string;
  project_id: string;
  workspace_id: string;
  source: string;
  version: string;
  payload: any;
  metadata: {
    normalized_at: string;
    normalizer_version: string;
    source_timestamp: number;
  };
}

/**
 * Normalisateur d'événements
 */
export class EventNormalizer {
  private projectId: string = '';
  private workspaceId: string = '';
  private isInitialized = false;

  constructor() {
    logger.info('EventNormalizer créé', { version: '1.0.0' });
  }

  /**
   * Initialise le normalisateur
   */
  public async initialize(): Promise<void> {
    try {
      // Générer des IDs uniques pour le projet et workspace
      this.projectId = this.generateProjectId();
      this.workspaceId = this.generateWorkspaceId();

      this.isInitialized = true;

      logger.info('EventNormalizer initialisé', {
        project_id: this.projectId,
        workspace_id: this.workspaceId
      });

    } catch (error) {
      logger.error('Erreur lors de l\'initialisation du EventNormalizer', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Normalise un événement brut
   */
  public normalize(eventType: string, rawData: any, source: string = 'vscode'): NormalizedEvent | null {
    if (!this.isInitialized) {
      logger.warn('EventNormalizer non initialisé, tentative de normalisation ignorée');
      return null;
    }

    try {
      const timestamp = new Date().toISOString();
      const sourceTimestamp = Date.now();

      // Créer l'événement normalisé
      const normalizedEvent: NormalizedEvent = {
        event_uuid: uuidv4(),
        event_type: eventType,
        timestamp,
        project_id: this.projectId,
        workspace_id: this.workspaceId,
        source,
        version: '1.0.0',
        payload: this.normalizePayload(eventType, rawData),
        metadata: {
          normalized_at: timestamp,
          normalizer_version: '1.0.0',
          source_timestamp: sourceTimestamp
        }
      };

      logger.debug('Événement normalisé', {
        event_type: eventType,
        event_uuid: normalizedEvent.event_uuid,
        payload_type: typeof normalizedEvent.payload
      });

      return normalizedEvent;

    } catch (error) {
      logger.error('Erreur lors de la normalisation de l\'événement', {
        event_type: eventType,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Normalise le payload selon le type d'événement
   */
  private normalizePayload(eventType: string, rawData: any): any {
    switch (eventType) {
      case 'file_save':
        return this.normalizeFileSavePayload(rawData);
      case 'diagnostic':
        return this.normalizeDiagnosticPayload(rawData);
      case 'workspace':
        return this.normalizeWorkspacePayload(rawData);
      default:
        return this.normalizeGenericPayload(rawData);
    }
  }

  /**
   * Normalise le payload pour les sauvegardes de fichiers
   */
  private normalizeFileSavePayload(rawData: any): any {
    const document = rawData?.document;

    return {
      file: {
        path: document?.uri?.fsPath || '',
        language: document?.languageId || '',
        line_count: document?.lineCount || 0,
        is_untitled: document?.isUntitled || false
      },
      editor: {
        selection: rawData?.selection || null,
        visible_ranges: rawData?.visibleRanges || []
      },
      workspace: {
        root: rawData?.workspaceRoot || ''
      }
    };
  }

  /**
   * Normalise le payload pour les diagnostics
   */
  private normalizeDiagnosticPayload(rawData: any): any {
    const diagnostic = rawData?.diagnostic;

    return {
      diagnostic: {
        severity: diagnostic?.severity || 0,
        message: diagnostic?.message || '',
        code: diagnostic?.code || '',
        source: diagnostic?.source || '',
        range: diagnostic?.range || null
      },
      file: {
        path: rawData?.uri?.fsPath || '',
        language: rawData?.languageId || ''
      },
      workspace: {
        root: rawData?.workspaceRoot || ''
      }
    };
  }

  /**
   * Normalise le payload pour les changements workspace
   */
  private normalizeWorkspacePayload(rawData: any): any {
    return {
      workspace: {
        added: rawData?.added?.map((folder: any) => ({
          name: folder?.name,
          path: folder?.uri?.fsPath,
          uri: folder?.uri?.toString()
        })) || [],
        removed: rawData?.removed?.map((folder: any) => ({
          name: folder?.name,
          path: folder?.uri?.fsPath,
          uri: folder?.uri?.toString()
        })) || [],
        total: rawData?.total || 0
      }
    };
  }

  /**
   * Normalise le payload générique
   */
  private normalizeGenericPayload(rawData: any): any {
    return {
      raw_data: this.sanitizeData(rawData),
      data_type: typeof rawData,
      data_keys: rawData ? Object.keys(rawData) : []
    };
  }

  /**
   * Nettoie les données pour enlever les informations sensibles
   */
  private sanitizeData(data: any): any {
    if (!data) return null;

    try {
      // Convertir en JSON et retourner
      const jsonString = JSON.stringify(data, (key, value) => {
        // Masquer les chemins absolus potentiellement sensibles
        if (key === 'path' && typeof value === 'string') {
          return this.maskSensitivePath(value);
        }
        // Masquer les tokens d'authentification
        if (key.match(/(token|password|secret|key)/i) && typeof value === 'string') {
          return '[REDACTED]';
        }
        return value;
      });

      return JSON.parse(jsonString);
    } catch {
      return { error: 'unable_to_sanitize' };
    }
  }

  /**
   * Masque les chemins sensibles
   */
  private maskSensitivePath(path: string): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    if (path.startsWith(homeDir)) {
      return path.replace(homeDir, '~');
    }
    return path;
  }

  /**
   * Génère un ID de projet unique
   */
  private generateProjectId(): string {
    // Utiliser le chemin du workspace ou générer un hash
    const workspacePath = process.cwd();
    return this.generateHash(workspacePath);
  }

  /**
   * Génère un ID de workspace unique
   */
  private generateWorkspaceId(): string {
    // Utiliser l'ID de l'instance VS Code ou générer un UUID
    return uuidv4();
  }

  /**
   * Génère un hash simple
   */
  private generateHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir en 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * Vérifie si le normalisateur est initialisé
   */
  public isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Obtient les IDs générés
   */
  public getIds(): { projectId: string; workspaceId: string } {
    return {
      projectId: this.projectId,
      workspaceId: this.workspaceId
    };
  }

  /**
   * Réinitialise le normalisateur
   */
  public reset(): void {
    this.projectId = '';
    this.workspaceId = '';
    this.isInitialized = false;
    logger.info('EventNormalizer réinitialisé');
  }
}

export default EventNormalizer;
