/**
 * Déclencheur basé sur les sauvegardes de fichiers
 *
 * Ce déclencheur écoute les événements de sauvegarde de fichiers normalisés
 * et déclenche un envoi MCP uniquement pour les changements significatifs.
 */

import { McpClient } from '../../services/McpClient.js';
import { NormalizedEvent } from '../context-capture/normalizers/event.normalizer.js';
import { logger } from '../context-capture/utils/logger.js';

export interface FileSaveTriggerConfig {
  /** Langages à surveiller pour les sauvegardes */
  monitoredLanguages: string[];
  /** Taille minimum de fichier pour déclenchement (en lignes) */
  minFileSizeLines: number;
  /** Ignorer les fichiers temporaires et de configuration */
  ignoreTemporaryFiles: boolean;
  /** Ignorer les fichiers dans node_modules, .git, etc. */
  ignoreIgnoredPaths: boolean;
  /** Délai minimum entre déclenchements pour le même fichier (ms) */
  minIntervalMs: number;
  /** Activer/désactiver le déclencheur */
  enabled: boolean;
  /** Priorité des sauvegardes (low, medium, high) */
  priority: 'low' | 'medium' | 'high';
}

export interface FileSaveTriggerStats {
  totalEventsProcessed: number;
  savesTriggered: number;
  savesFiltered: number;
  lastTriggerTime: number | null;
  fileTypes: Record<string, number>;
  languages: Record<string, number>;
}

export class FileSaveTrigger {
  private config: FileSaveTriggerConfig;
  private mcpClient: McpClient;
  private stats: FileSaveTriggerStats;
  private lastTriggerTimes: Map<string, number>; // filePath -> timestamp
  private isActive: boolean = false;

  constructor(mcpClient: McpClient, config?: Partial<FileSaveTriggerConfig>) {
    this.mcpClient = mcpClient;
    this.config = {
      monitoredLanguages: ['typescript', 'javascript', 'python', 'java', 'csharp', 'go', 'rust'],
      minFileSizeLines: 5, // Fichiers de moins de 5 lignes ignorés
      ignoreTemporaryFiles: true,
      ignoreIgnoredPaths: true,
      minIntervalMs: 30000, // 30 secondes entre sauvegardes du même fichier
      enabled: true,
      priority: 'medium',
      ...config
    };

    this.stats = {
      totalEventsProcessed: 0,
      savesTriggered: 0,
      savesFiltered: 0,
      lastTriggerTime: null,
      fileTypes: {},
      languages: {}
    };

    this.lastTriggerTimes = new Map();
  }

  /**
   * Initialise le déclencheur
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('FileSaveTrigger désactivé dans la configuration');
      return;
    }

    this.isActive = true;
    logger.info('FileSaveTrigger initialisé', {
      config: this.config,
      monitoredLanguages: this.config.monitoredLanguages.length
    });
  }

  /**
   * Traite un événement normalisé et déclenche si c'est une sauvegarde significative
   */
  async processEvent(event: NormalizedEvent): Promise<boolean> {
    if (!this.isActive || !this.config.enabled) {
      return false;
    }

    this.stats.totalEventsProcessed++;

    // Vérifier que c'est un événement de sauvegarde de fichier
    if (event.event_type !== 'file_save') {
      return false;
    }

    // Vérifier le fichier
    const filePath = event.payload.file?.path;
    if (!filePath) {
      logger.warn('Événement file_save sans fichier', { event_uuid: event.event_uuid });
      this.stats.savesFiltered++;
      return false;
    }

    // Vérifier si le fichier doit être ignoré
    if (this.shouldIgnoreFile(filePath)) {
      logger.debug('Fichier ignoré selon configuration', { filePath });
      this.stats.savesFiltered++;
      return false;
    }

    // Vérifier le langage
    const language = event.payload.file?.language;
    if (language && !this.config.monitoredLanguages.includes(language)) {
      logger.debug('Langage non surveillé', { filePath, language });
      this.stats.savesFiltered++;
      return false;
    }

    // Vérifier la taille du fichier
    const lineCount = event.payload.file?.line_count || 0;
    if (lineCount < this.config.minFileSizeLines) {
      logger.debug('Fichier trop petit', { filePath, lineCount, minFileSizeLines: this.config.minFileSizeLines });
      this.stats.savesFiltered++;
      return false;
    }

    // Vérifier l'intervalle minimum
    const lastTriggerTime = this.lastTriggerTimes.get(filePath);
    const now = Date.now();
    if (lastTriggerTime && (now - lastTriggerTime) < this.config.minIntervalMs) {
      logger.debug('Intervalle minimum non respecté pour le fichier', {
        filePath,
        lastTriggerTime,
        minIntervalMs: this.config.minIntervalMs,
        elapsed: now - lastTriggerTime
      });
      this.stats.savesFiltered++;
      return false;
    }

    // Mettre à jour les statistiques
    const fileType = this.getFileType(filePath);
    this.stats.fileTypes[fileType] = (this.stats.fileTypes[fileType] || 0) + 1;

    if (language) {
      this.stats.languages[language] = (this.stats.languages[language] || 0) + 1;
    }

    // Déclencher l'envoi MCP
    try {
      await this.triggerMcpSend(event);

      // Mettre à jour les timestamps et statistiques
      this.lastTriggerTimes.set(filePath, now);
      this.stats.lastTriggerTime = now;
      this.stats.savesTriggered++;

      logger.info('Sauvegarde de fichier déclenchée pour envoi MCP', {
        filePath,
        fileType,
        language,
        lineCount,
        priority: this.config.priority,
        event_uuid: event.event_uuid
      });

      return true;
    } catch (error) {
      logger.error('Échec du déclenchement MCP pour sauvegarde de fichier', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
        event_uuid: event.event_uuid
      });
      return false;
    }
  }

  /**
   * Déclenche l'envoi MCP pour un événement de sauvegarde
   */
  private async triggerMcpSend(event: NormalizedEvent): Promise<void> {
    // Préparer les arguments pour l'outil MCP
    const mcpArguments = {
      event: event,
      trigger_type: 'file_save',
      priority: this.config.priority,
      timestamp: new Date().toISOString(),
      metadata: {
        file_path: event.payload.file?.path,
        language: event.payload.file?.language,
        line_count: event.payload.file?.line_count
      }
    };

    // Appeler l'outil MCP via le client
    await this.mcpClient.call('receive_vscode_context', mcpArguments);
  }

  /**
   * Vérifie si un fichier doit être ignoré selon la configuration
   */
  private shouldIgnoreFile(filePath: string): boolean {
    if (this.config.ignoreTemporaryFiles && this.isTemporaryFile(filePath)) {
      return true;
    }

    if (this.config.ignoreIgnoredPaths && this.isIgnoredPath(filePath)) {
      return true;
    }

    return false;
  }

  /**
   * Vérifie si un fichier est temporaire
   */
  private isTemporaryFile(filePath: string): boolean {
    const tempPatterns = [
      /\.tmp$/i,
      /\.temp$/i,
      /\.bak$/i,
      /~$/,
      /^\.#/, // Fichiers d'édition temporaires (emacs)
      /\.swp$/, // Fichiers swap vim
      /\.swo$/,
      /\.swn$/
    ];

    return tempPatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Vérifie si un chemin doit être ignoré
   */
  private isIgnoredPath(filePath: string): boolean {
    const ignoredPatterns = [
      /node_modules/,
      /\.git/,
      /\.vscode/,
      /\.idea/,
      /\.vs/,
      /dist\//,
      /build\//,
      /out\//,
      /coverage\//,
      /logs?\//,
      /tmp\//,
      /temp\//
    ];

    return ignoredPatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Extrait le type de fichier de son chemin
   */
  private getFileType(filePath: string): string {
    const match = filePath.match(/\.([^.]+)$/);
    if (match) {
      return match[1].toLowerCase();
    }
    return 'unknown';
  }

  /**
   * Récupère les statistiques du déclencheur
   */
  getStats(): FileSaveTriggerStats {
    return { ...this.stats };
  }

  /**
   * Réinitialise les statistiques et le cache
   */
  reset(): void {
    this.stats = {
      totalEventsProcessed: 0,
      savesTriggered: 0,
      savesFiltered: 0,
      lastTriggerTime: null,
      fileTypes: {},
      languages: {}
    };
    this.lastTriggerTimes.clear();
    logger.info('FileSaveTrigger réinitialisé');
  }

  /**
   * Met à jour la configuration
   */
  updateConfig(config: Partial<FileSaveTriggerConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Configuration FileSaveTrigger mise à jour', { config: this.config });
  }

  /**
   * Active/désactive le déclencheur
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.isActive = enabled;
    logger.info(`FileSaveTrigger ${enabled ? 'activé' : 'désactivé'}`);
  }

  /**
   * Nettoie les ressources
   */
  dispose(): void {
    this.isActive = false;
    this.lastTriggerTimes.clear();
    logger.info('FileSaveTrigger nettoyé');
  }

  /**
   * Vérifie si un fichier peut être déclenché (respecte l'intervalle)
   */
  canTriggerForFile(filePath: string): boolean {
    const lastTriggerTime = this.lastTriggerTimes.get(filePath);
    if (!lastTriggerTime) {
      return true;
    }
    return (Date.now() - lastTriggerTime) >= this.config.minIntervalMs;
  }

  /**
   * Récupère la liste des langages surveillés
   */
  getMonitoredLanguages(): string[] {
    return [...this.config.monitoredLanguages];
  }

  /**
   * Vérifie si un fichier serait ignoré selon la configuration actuelle
   */
  wouldIgnoreFile(filePath: string): boolean {
    return this.shouldIgnoreFile(filePath);
  }

  /**
   * Récupère le nombre de déclenchements par type de fichier
   */
  getFileTypeStats(): Record<string, number> {
    return { ...this.stats.fileTypes };
  }

  /**
   * Récupère le nombre de déclenchements par langage
   */
  getLanguageStats(): Record<string, number> {
    return { ...this.stats.languages };
  }

  /**
   * Récupère le timestamp du dernier déclenchement pour un fichier
   */
  getLastTriggerTimeForFile(filePath: string): number | null {
    return this.lastTriggerTimes.get(filePath) || null;
  }

  /**
   * Force un déclenchement pour un fichier (pour tests)
   */
  forceTriggerForFile(filePath: string): void {
    this.lastTriggerTimes.delete(filePath);
    logger.info('Déclenchement forcé pour fichier', { filePath });
  }
}
