/**
 * Filtre d'événements pour la capture passive
 *
 * Filtre les événements mineurs (scroll, hover, etc.)
 * et applique des règles de fréquence (anti-spam)
 */

import { logger } from '../utils/logger.js';

/**
 * Interface pour les événements VS Code bruts
 */
export interface RawVSCodeEvent {
  type: string;
  timestamp: number;
  data: any;
  source: string;
}

/**
 * Filtre d'événements
 */
export class EventFilter {
  private lastEventTimes: Map<string, number> = new Map();
  private minIntervalMs: Map<string, number> = new Map();
  private ignoredEventTypes: Set<string> = new Set();

  constructor() {
    // Configurer les intervalles minimums par type d'événement
    this.minIntervalMs.set('file_save', 1000); // 1 seconde entre les sauvegardes
    this.minIntervalMs.set('diagnostic', 2000); // 2 secondes entre les diagnostics
    this.minIntervalMs.set('workspace', 5000); // 5 secondes entre les changements workspace

    // Configurer les types d'événements à ignorer
    this.ignoredEventTypes.add('textEditorSelectionChange');
    this.ignoredEventTypes.add('textEditorVisibleRangesChange');
    this.ignoredEventTypes.add('textEditorViewColumnChange');
    this.ignoredEventTypes.add('windowStateChange');

    logger.info('EventFilter initialisé', {
      min_intervals: Object.fromEntries(this.minIntervalMs),
      ignored_types: Array.from(this.ignoredEventTypes)
    });
  }

  /**
   * Filtre un événement brut
   */
  public filter(event: RawVSCodeEvent): boolean {
    try {
      // 1. Vérifier si le type d'événement est ignoré
      if (this.ignoredEventTypes.has(event.type)) {
        logger.debug('Événement ignoré (type ignoré)', {
          event_type: event.type,
          source: event.source
        });
        return false;
      }

      // 2. Vérifier l'intervalle minimum
      const minInterval = this.minIntervalMs.get(event.type);
      if (minInterval) {
        const lastTime = this.lastEventTimes.get(event.type) || 0;
        const timeSinceLast = event.timestamp - lastTime;

        if (timeSinceLast < minInterval) {
          logger.debug('Événement ignoré (intervalle trop court)', {
            event_type: event.type,
            time_since_last_ms: timeSinceLast,
            min_interval_ms: minInterval
          });
          return false;
        }
      }

      // 3. Mettre à jour le dernier temps pour ce type
      this.lastEventTimes.set(event.type, event.timestamp);

      // 4. Vérifier les données spécifiques
      if (!this.isSignificantEvent(event)) {
        logger.debug('Événement ignoré (non significatif)', {
          event_type: event.type,
          data_summary: this.getDataSummary(event.data)
        });
        return false;
      }

      logger.debug('Événement accepté par le filtre', {
        event_type: event.type,
        timestamp: new Date(event.timestamp).toISOString()
      });

      return true;

    } catch (error) {
      logger.error('Erreur lors du filtrage de l\'événement', {
        event_type: event.type,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Vérifie si un événement est significatif
   */
  private isSignificantEvent(event: RawVSCodeEvent): boolean {
    switch (event.type) {
      case 'file_save':
        return this.isSignificantFileSave(event.data);
      case 'diagnostic':
        return this.isSignificantDiagnostic(event.data);
      case 'workspace':
        return this.isSignificantWorkspaceChange(event.data);
      default:
        return true; // Par défaut, accepter les autres types
    }
  }

  /**
   * Vérifie si une sauvegarde de fichier est significative
   */
  private isSignificantFileSave(data: any): boolean {
    // Ignorer les fichiers temporaires ou de configuration système
    const filePath = data?.document?.uri?.fsPath || '';
    const ignoredPatterns = [
      /\.tmp$/,
      /\.log$/,
      /\.git$/,
      /node_modules/,
      /\.vscode/,
      /\.git/
    ];

    for (const pattern of ignoredPatterns) {
      if (pattern.test(filePath)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Vérifie si un diagnostic est significatif
   */
  private isSignificantDiagnostic(data: any): boolean {
    // Ignorer les diagnostics de type "hint" ou "information"
    const severity = data?.diagnostic?.severity || 0;
    return severity >= 2; // Warning (2) ou Error (1)
  }

  /**
   * Vérifie si un changement workspace est significatif
   */
  private isSignificantWorkspaceChange(data: any): boolean {
    // Toujours significatif car rare
    return true;
  }

  /**
   * Obtient un résumé des données pour le logging
   */
  private getDataSummary(data: any): string {
    if (!data) return 'no-data';

    try {
      const str = JSON.stringify(data);
      return str.length > 100 ? str.substring(0, 100) + '...' : str;
    } catch {
      return 'unserializable-data';
    }
  }

  /**
   * Réinitialise le filtre
   */
  public reset(): void {
    this.lastEventTimes.clear();
    logger.info('EventFilter réinitialisé');
  }

  /**
   * Obtient les statistiques du filtre
   */
  public getStats(): FilterStats {
    return {
      total_event_types: this.minIntervalMs.size,
      ignored_event_types: this.ignoredEventTypes.size,
      last_event_times: Object.fromEntries(this.lastEventTimes)
    };
  }
}

/**
 * Statistiques du filtre
 */
export interface FilterStats {
  total_event_types: number;
  ignored_event_types: number;
  last_event_times: Record<string, number>;
}

export default EventFilter;
