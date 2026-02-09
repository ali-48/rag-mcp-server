/**
 * Écouteur passif pour les événements de diagnostics
 *
 * Capture les événements onDidChangeDiagnostics de manière passive
 * sans interaction humaine
 */

import * as vscode from 'vscode';
import { EventFilter, RawVSCodeEvent } from '../filters/event.filter.js';
import { EventNormalizer, NormalizedEvent } from '../normalizers/event.normalizer.js';
import { logger } from '../utils/logger.js';

/**
 * Écouteur pour les diagnostics
 */
export class DiagnosticsListener {
  private eventFilter: EventFilter;
  private eventNormalizer: EventNormalizer;

  private disposables: vscode.Disposable[] = [];
  private active = false;
  private eventCallbacks: ((event: NormalizedEvent) => void)[] = [];

  constructor(
    eventFilter: EventFilter,
    eventNormalizer: EventNormalizer
  ) {
    this.eventFilter = eventFilter;
    this.eventNormalizer = eventNormalizer;

    logger.info('DiagnosticsListener créé');
  }

  /**
   * Démarre l'écouteur
   */
  public async start(): Promise<void> {
    if (this.active) {
      logger.warn('DiagnosticsListener déjà actif');
      return;
    }

    try {
      // Configurer l'écouteur pour les diagnostics
      const disposable = vscode.languages.onDidChangeDiagnostics(
        this.handleDiagnosticsChange.bind(this)
      );

      this.disposables.push(disposable);
      this.active = true;

      logger.info('DiagnosticsListener démarré', {
        event_type: 'onDidChangeDiagnostics'
      });

    } catch (error) {
      logger.error('Erreur lors du démarrage du DiagnosticsListener', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Gère les changements de diagnostics
   */
  private async handleDiagnosticsChange(event: vscode.DiagnosticChangeEvent): Promise<void> {
    try {
      // Pour chaque URI avec diagnostics
      for (const uri of event.uris) {
        const diagnostics = vscode.languages.getDiagnostics(uri);

        // Filtrer les diagnostics significatifs (erreurs et warnings)
        const significantDiagnostics = diagnostics.filter(d =>
          d.severity === vscode.DiagnosticSeverity.Error ||
          d.severity === vscode.DiagnosticSeverity.Warning
        );

        if (significantDiagnostics.length === 0) {
          continue;
        }

        // Créer un événement pour chaque diagnostic significatif
        for (const diagnostic of significantDiagnostics) {
          const rawEvent: RawVSCodeEvent = {
            type: 'diagnostic',
            timestamp: Date.now(),
            data: {
              uri,
              diagnostic,
              languageId: this.getLanguageId(uri),
              workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
            },
            source: 'vscode'
          };

          // Filtrer l'événement
          if (!this.eventFilter.filter(rawEvent)) {
            continue;
          }

          // Normaliser l'événement
          const normalizedEvent = this.eventNormalizer.normalize('diagnostic', rawEvent.data);

          if (!normalizedEvent) {
            logger.warn('Événement de diagnostic non normalisé', {
              file_path: uri.fsPath,
              severity: diagnostic.severity
            });
            continue;
          }

          // Notifier les callbacks
          this.notifyEventCaptured(normalizedEvent);

          logger.debug('Événement de diagnostic capturé', {
            event_uuid: normalizedEvent.event_uuid,
            file_path: uri.fsPath,
            severity: diagnostic.severity,
            message: diagnostic.message.substring(0, 50) + '...'
          });
        }
      }

    } catch (error) {
      logger.error('Erreur lors de la capture de l\'événement de diagnostic', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Obtient l'ID de langue pour une URI
   */
  private getLanguageId(uri: vscode.Uri): string {
    try {
      const document = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString());
      return document?.languageId || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Notifie les callbacks qu'un événement a été capturé
   */
  private notifyEventCaptured(event: NormalizedEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch (error) {
        logger.error('Erreur dans le callback d\'événement', {
          event_uuid: event.event_uuid,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Ajoute un callback pour les événements capturés
   */
  public onEventCaptured(callback: (event: NormalizedEvent) => void): void {
    this.eventCallbacks.push(callback);
    logger.debug('Callback ajouté au DiagnosticsListener', {
      total_callbacks: this.eventCallbacks.length
    });
  }

  /**
   * Arrête l'écouteur
   */
  public async stop(): Promise<void> {
    if (!this.active) {
      return;
    }

    try {
      // Supprimer tous les disposables
      for (const disposable of this.disposables) {
        disposable.dispose();
      }

      this.disposables = [];
      this.eventCallbacks = [];
      this.active = false;

      logger.info('DiagnosticsListener arrêté');

    } catch (error) {
      logger.error('Erreur lors de l\'arrêt du DiagnosticsListener', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Vérifie si l'écouteur est actif
   */
  public isActive(): boolean {
    return this.active;
  }

  /**
   * Obtient les statistiques de l'écouteur
   */
  public getStats(): ListenerStats {
    return {
      is_active: this.active,
      event_type: 'diagnostic',
      total_callbacks: this.eventCallbacks.length,
      total_disposables: this.disposables.length
    };
  }

  /**
   * Dispose les ressources
   */
  public dispose(): void {
    this.stop();
  }
}

/**
 * Statistiques de l'écouteur
 */
export interface ListenerStats {
  is_active: boolean;
  event_type: string;
  total_callbacks: number;
  total_disposables: number;
}

export default DiagnosticsListener;
