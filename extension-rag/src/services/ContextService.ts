/**
 * Service de contexte VS Code passif
 *
 * Ce service a été refactorisé pour être passif :
 * - Plus de méthode getFullContext() publique
 * - Écouteurs passifs pour événements VS Code
 * - Capture automatique sans interaction humaine
 *
 * Conforme aux règles R3, R4, R11, R15, R19
 */

import { EventFilter } from '../modules/context-capture/filters/event.filter.js';
import { DiagnosticsListener } from '../modules/context-capture/listeners/diagnostics.listener.js';
import { FileSaveListener } from '../modules/context-capture/listeners/file-save.listener.js';
import { WorkspaceListener } from '../modules/context-capture/listeners/workspace.listener.js';
import { EventNormalizer } from '../modules/context-capture/normalizers/event.normalizer.js';
import { FileHasher } from '../modules/context-capture/utils/file-hasher.js';
import { logger } from '../modules/context-capture/utils/logger.js';

/**
 * Service de contexte VS Code passif
 *
 * Remplace l'ancien ContextService qui avait une méthode getFullContext() publique.
 * Désormais, le service écoute passivement les événements VS Code et les capture
 * automatiquement sans interaction humaine.
 */
export class ContextService {
  private static instance: ContextService;

  private fileSaveListener: FileSaveListener | null = null;
  private diagnosticsListener: DiagnosticsListener | null = null;
  private workspaceListener: WorkspaceListener | null = null;
  private eventFilter: EventFilter;
  private eventNormalizer: EventNormalizer;
  private fileHasher: FileHasher;

  private isInitialized = false;
  private capturedEvents: any[] = [];
  private maxCapturedEvents = 1000; // Limite mémoire

  private constructor() {
    this.eventFilter = new EventFilter();
    this.eventNormalizer = new EventNormalizer();
    this.fileHasher = new FileHasher();

    logger.info('ContextService passif créé', {
      service_version: '2.0.0',
      capture_mode: 'passive',
      max_events: this.maxCapturedEvents
    });
  }

  /**
   * Obtient l'instance singleton
   */
  public static getInstance(): ContextService {
    if (!ContextService.instance) {
      ContextService.instance = new ContextService();
    }
    return ContextService.instance;
  }

  /**
   * Initialise le service de capture passive
   *
   * Cette méthode est appelée une fois au démarrage de l'extension
   * pour configurer tous les écouteurs passifs.
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('ContextService déjà initialisé');
      return;
    }

    try {
      logger.info('Initialisation du ContextService passif...');

      // Initialiser les composants
      await this.eventNormalizer.initialize();
      await this.fileHasher.initialize();

      // Créer et initialiser les écouteurs
      this.fileSaveListener = new FileSaveListener(this.eventFilter, this.eventNormalizer, this.fileHasher);
      this.diagnosticsListener = new DiagnosticsListener(this.eventFilter, this.eventNormalizer);
      this.workspaceListener = new WorkspaceListener(this.eventFilter, this.eventNormalizer);

      // Démarrer les écouteurs
      await this.fileSaveListener.start();
      await this.diagnosticsListener.start();
      await this.workspaceListener.start();

      // Configurer les callbacks pour les événements capturés
      this.setupEventCallbacks();

      this.isInitialized = true;

      logger.info('ContextService passif initialisé avec succès', {
        listeners: ['file_save', 'diagnostics', 'workspace'],
        components: ['filter', 'normalizer', 'hasher']
      });

    } catch (error) {
      logger.error('Erreur lors de l\'initialisation du ContextService', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Configure les callbacks pour les événements capturés
   */
  private setupEventCallbacks(): void {
    if (this.fileSaveListener) {
      this.fileSaveListener.onEventCaptured((event) => {
        this.handleCapturedEvent(event, 'file_save');
      });
    }

    if (this.diagnosticsListener) {
      this.diagnosticsListener.onEventCaptured((event) => {
        this.handleCapturedEvent(event, 'diagnostic');
      });
    }

    if (this.workspaceListener) {
      this.workspaceListener.onEventCaptured((event) => {
        this.handleCapturedEvent(event, 'workspace');
      });
    }
  }

  /**
   * Gère un événement capturé
   */
  private handleCapturedEvent(event: any, eventType: string): void {
    try {
      // Ajouter l'événement à la liste capturée (avec limite mémoire)
      this.capturedEvents.unshift(event);
      if (this.capturedEvents.length > this.maxCapturedEvents) {
        this.capturedEvents.pop();
      }

      // Log de l'événement capturé
      logger.debug('Événement VS Code capturé', {
        event_type: eventType,
        event_id: event.event_uuid,
        project_id: event.project_id,
        file_path: event.file?.path,
        timestamp: event.timestamp
      });

      // Ici, l'événement serait normalement envoyé au Module C (déclencheurs)
      // Pour l'instant, on se contente de le capturer et logger

    } catch (error) {
      logger.error('Erreur lors du traitement de l\'événement capturé', {
        event_type: eventType,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Arrête le service de capture passive
   */
  public async dispose(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      logger.info('Arrêt du ContextService passif...');

      // Arrêter les écouteurs
      if (this.fileSaveListener) {
        await this.fileSaveListener.stop();
      }
      if (this.diagnosticsListener) {
        await this.diagnosticsListener.stop();
      }
      if (this.workspaceListener) {
        await this.workspaceListener.stop();
      }

      // Nettoyer les ressources
      this.capturedEvents = [];
      this.isInitialized = false;

      logger.info('ContextService passif arrêté avec succès');

    } catch (error) {
      logger.error('Erreur lors de l\'arrêt du ContextService', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Obtient les statistiques de capture
   *
   * Méthode utilisée uniquement pour le monitoring (Module A)
   */
  public getCaptureStats(): CaptureStats {
    return {
      is_initialized: this.isInitialized,
      total_captured_events: this.capturedEvents.length,
      listeners_active: {
        file_save: this.fileSaveListener?.isActive() || false,
        diagnostics: this.diagnosticsListener?.isActive() || false,
        workspace: this.workspaceListener?.isActive() || false
      },
      last_capture_time: this.capturedEvents.length > 0
        ? this.capturedEvents[0].timestamp
        : null,
      memory_usage_mb: Math.round((this.capturedEvents.length * 0.1) * 100) / 100 // Estimation
    };
  }

  /**
   * Obtient les derniers événements capturés (pour debug uniquement)
   *
   * Méthode utilisée uniquement pour le monitoring (Module A)
   */
  public getRecentEvents(limit: number = 10): any[] {
    return this.capturedEvents.slice(0, limit).map(event => ({
      ...event,
      // Masquer les données sensibles pour le monitoring
      payload: event.payload ? '[REDACTED_FOR_MONITORING]' : undefined
    }));
  }

  /**
   * Vérifie si le service est actif
   */
  public isActive(): boolean {
    return this.isInitialized;
  }
}

/**
 * Statistiques de capture
 */
export interface CaptureStats {
  is_initialized: boolean;
  total_captured_events: number;
  listeners_active: {
    file_save: boolean;
    diagnostics: boolean;
    workspace: boolean;
  };
  last_capture_time: string | null;
  memory_usage_mb: number;
}

/**
 * Ancienne interface conservée pour compatibilité
 * (Les méthodes ne sont plus accessibles publiquement)
 */
export interface VSCodeContext {
  timestamp: string;
  workspace: any;
  configuration: any;
  git: any;
  project: any;
  editor: any;
  extensions: any;
  metadata: any;
}

export interface MinimalContext {
  workspace_name: string;
  project_type: string;
  git_branch: string | null;
  open_files: number;
  has_errors: boolean;
  timestamp: string;
}

// Export des types pour compatibilité
export type {
  ActiveEditor, ConfigFile, ContextMetadata, DiagnosticsSummary, EditorState, ExtensionsInfo, GitInfo,
  GitRemote, OpenEditor, ProjectStructure, VisibleRange, VSCodeConfiguration, WorkspaceFolder, WorkspaceInfo
} from './context-types';

export default ContextService;
