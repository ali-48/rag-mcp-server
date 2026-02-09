/**
 * Écouteur passif pour les événements de workspace
 *
 * Capture les événements onDidChangeWorkspaceFolders de manière passive
 * sans interaction humaine
 */

import * as vscode from 'vscode';
import { EventFilter, RawVSCodeEvent } from '../filters/event.filter.js';
import { EventNormalizer, NormalizedEvent } from '../normalizers/event.normalizer.js';
import { logger } from '../utils/logger.js';

/**
 * Écouteur pour les changements de workspace
 */
export class WorkspaceListener {
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

    logger.info('WorkspaceListener créé');
  }

  /**
   * Démarre l'écouteur
   */
  public async start(): Promise<void> {
    if (this.active) {
      logger.warn('WorkspaceListener déjà actif');
      return;
    }

    try {
      // Configurer l'écouteur pour les changements de workspace
      const disposable = vscode.workspace.onDidChangeWorkspaceFolders(
        this.handleWorkspaceChange.bind(this)
      );

      this.disposables.push(disposable);
      this.active = true;

      logger.info('WorkspaceListener démarré', {
        event_type: 'onDidChangeWorkspaceFolders'
      });

    } catch (error) {
      logger.error('Erreur lors du démarrage du WorkspaceListener', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Gère les changements de workspace
   */
  private async handleWorkspaceChange(event: vscode.WorkspaceFoldersChangeEvent): Promise<void> {
    try {
      // Créer l'événement brut
      const rawEvent: RawVSCodeEvent = {
        type: 'workspace',
        timestamp: Date.now(),
        data: {
          added: event.added,
          removed: event.removed,
          total: vscode.workspace.workspaceFolders?.length || 0
        },
        source: 'vscode'
      };

      // Filtrer l'événement
      if (!this.eventFilter.filter(rawEvent)) {
        return;
      }

      // Normaliser l'événement
      const normalizedEvent = this.eventNormalizer.normalize('workspace', rawEvent.data);

      if (!normalizedEvent) {
        logger.warn('Événement de workspace non normalisé', {
          added_count: event.added.length,
          removed_count: event.removed.length
        });
        return;
      }

      // Notifier les callbacks
      this.notifyEventCaptured(normalizedEvent);

      logger.debug('Événement de workspace capturé', {
        event_uuid: normalizedEvent.event_uuid,
        added_count: event.added.length,
        removed_count: event.removed.length,
        total_folders: rawEvent.data.total
      });

    } catch (error) {
      logger.error('Erreur lors de la capture de l\'événement de workspace', {
        error: error instanceof Error ? error.message : String(error)
      });
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
    logger.debug('Callback ajouté au WorkspaceListener', {
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

      logger.info('WorkspaceListener arrêté');

    } catch (error) {
      logger.error('Erreur lors de l\'arrêt du WorkspaceListener', {
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
      event_type: 'workspace',
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

export default WorkspaceListener;
