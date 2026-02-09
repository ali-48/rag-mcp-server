/**
 * Écouteur passif pour les événements de sauvegarde de fichiers
 *
 * Capture les événements onDidSaveTextDocument de manière passive
 * sans interaction humaine
 */

import * as vscode from 'vscode';
import { EventFilter, RawVSCodeEvent } from '../filters/event.filter.js';
import { EventNormalizer, NormalizedEvent } from '../normalizers/event.normalizer.js';
import { FileHasher } from '../utils/file-hasher.js';
import { logger } from '../utils/logger.js';

/**
 * Écouteur pour les sauvegardes de fichiers
 */
export class FileSaveListener {
  private eventFilter: EventFilter;
  private eventNormalizer: EventNormalizer;
  private fileHasher: FileHasher;

  private disposables: vscode.Disposable[] = [];
  private active = false;
  private eventCallbacks: ((event: NormalizedEvent) => void)[] = [];

  constructor(
    eventFilter: EventFilter,
    eventNormalizer: EventNormalizer,
    fileHasher: FileHasher
  ) {
    this.eventFilter = eventFilter;
    this.eventNormalizer = eventNormalizer;
    this.fileHasher = fileHasher;

    logger.info('FileSaveListener créé');
  }

  /**
   * Démarre l'écouteur
   */
  public async start(): Promise<void> {
    if (this.active) {
      logger.warn('FileSaveListener déjà actif');
      return;
    }

    try {
      // Configurer l'écouteur pour les sauvegardes de fichiers
      const disposable = vscode.workspace.onDidSaveTextDocument(
        this.handleFileSave.bind(this)
      );

      this.disposables.push(disposable);
      this.active = true;

      logger.info('FileSaveListener démarré', {
        event_type: 'onDidSaveTextDocument'
      });

    } catch (error) {
      logger.error('Erreur lors du démarrage du FileSaveListener', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Gère les sauvegardes de fichiers
   */
  private async handleFileSave(document: vscode.TextDocument): Promise<void> {
    try {
      // Créer l'événement brut
      const rawEvent: RawVSCodeEvent = {
        type: 'file_save',
        timestamp: Date.now(),
        data: {
          document,
          workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
        },
        source: 'vscode'
      };

      // Filtrer l'événement
      if (!this.eventFilter.filter(rawEvent)) {
        return;
      }

      // Vérifier si le fichier a réellement changé
      const filePath = document.uri.fsPath;
      const previousHash = this.fileHasher.getCachedHash(filePath);
      const hasChanged = await this.fileHasher.hasFileChanged(filePath, previousHash || undefined);

      if (!hasChanged) {
        logger.debug('Fichier sauvegardé mais non modifié (hash identique)', {
          file_path: filePath
        });
        return;
      }

      // Normaliser l'événement
      const normalizedEvent = this.eventNormalizer.normalize('file_save', rawEvent.data);

      if (!normalizedEvent) {
        logger.warn('Événement de sauvegarde non normalisé', {
          file_path: filePath
        });
        return;
      }

      // Ajouter le hash du fichier au payload
      const hashResult = await this.fileHasher.computeHash(filePath);
      if (hashResult) {
        normalizedEvent.payload.file_hash = hashResult.hash;
        normalizedEvent.payload.file_size = hashResult.size;
      }

      // Notifier les callbacks
      this.notifyEventCaptured(normalizedEvent);

      logger.debug('Événement de sauvegarde capturé', {
        event_uuid: normalizedEvent.event_uuid,
        file_path: filePath,
        file_hash: hashResult?.hash?.substring(0, 8) + '...'
      });

    } catch (error) {
      logger.error('Erreur lors de la capture de l\'événement de sauvegarde', {
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
    logger.debug('Callback ajouté au FileSaveListener', {
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

      logger.info('FileSaveListener arrêté');

    } catch (error) {
      logger.error('Erreur lors de l\'arrêt du FileSaveListener', {
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
      event_type: 'file_save',
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

export default FileSaveListener;
