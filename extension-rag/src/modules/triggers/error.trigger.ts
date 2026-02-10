/**
 * Déclencheur basé sur les diagnostics d'erreur
 *
 * Ce déclencheur écoute les événements de diagnostics normalisés
 * et déclenche un envoi MCP uniquement pour les nouvelles erreurs
 * TypeScript/Python significatives.
 */

import { McpClient } from '../../services/McpClient.js';
import { NormalizedEvent } from '../context-capture/normalizers/event.normalizer.js';
import { logger } from '../context-capture/utils/logger.js';

export interface ErrorTriggerConfig {
  /** Langages à surveiller pour les erreurs */
  monitoredLanguages: string[];
  /** Niveaux de sévérité minimum (1=Error, 2=Warning, 3=Info, 4=Hint) */
  minSeverity: number;
  /** Ignorer les erreurs déjà connues (basé sur hash) */
  ignoreKnownErrors: boolean;
  /** Délai minimum entre déclenchements pour le même fichier (ms) */
  minIntervalMs: number;
  /** Activer/désactiver le déclencheur */
  enabled: boolean;
}

export interface ErrorTriggerStats {
  totalEventsProcessed: number;
  errorsTriggered: number;
  errorsFiltered: number;
  lastTriggerTime: number | null;
  errorTypes: Record<string, number>;
}

export class ErrorTrigger {
  private config: ErrorTriggerConfig;
  private mcpClient: McpClient;
  private stats: ErrorTriggerStats;
  private lastTriggerTimes: Map<string, number>; // filePath -> timestamp
  private knownErrorHashes: Set<string>; // Hash des erreurs déjà vues
  private isActive: boolean = false;

  constructor(mcpClient: McpClient, config?: Partial<ErrorTriggerConfig>) {
    this.mcpClient = mcpClient;
    this.config = {
      monitoredLanguages: ['typescript', 'javascript', 'python', 'java', 'csharp'],
      minSeverity: 1, // Error seulement
      ignoreKnownErrors: true,
      minIntervalMs: 5000, // 5 secondes
      enabled: true,
      ...config
    };

    this.stats = {
      totalEventsProcessed: 0,
      errorsTriggered: 0,
      errorsFiltered: 0,
      lastTriggerTime: null,
      errorTypes: {}
    };

    this.lastTriggerTimes = new Map();
    this.knownErrorHashes = new Set();
  }

  /**
   * Initialise le déclencheur
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('ErrorTrigger désactivé dans la configuration');
      return;
    }

    this.isActive = true;
    logger.info('ErrorTrigger initialisé', {
      config: this.config,
      monitoredLanguages: this.config.monitoredLanguages.length
    });
  }

  /**
   * Traite un événement normalisé et déclenche si c'est une nouvelle erreur
   */
  async processEvent(event: NormalizedEvent): Promise<boolean> {
    if (!this.isActive || !this.config.enabled) {
      return false;
    }

    this.stats.totalEventsProcessed++;

    // Vérifier que c'est un événement de diagnostic
    if (event.event_type !== 'diagnostic') {
      return false;
    }

    // Vérifier la sévérité
    const severity = event.payload.diagnostic?.severity;
    if (severity === undefined || severity > this.config.minSeverity) {
      this.stats.errorsFiltered++;
      return false;
    }

    // Vérifier le langage
    const language = event.payload.file?.language;
    if (language && !this.config.monitoredLanguages.includes(language)) {
      this.stats.errorsFiltered++;
      return false;
    }

    // Vérifier le fichier
    const filePath = event.payload.file?.path;
    if (!filePath) {
      logger.warn('Événement diagnostic sans fichier', { event_uuid: event.event_uuid });
      this.stats.errorsFiltered++;
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
      this.stats.errorsFiltered++;
      return false;
    }

    // Vérifier si l'erreur est déjà connue (basé sur hash)
    const errorHash = this.computeErrorHash(event);
    if (this.config.ignoreKnownErrors && this.knownErrorHashes.has(errorHash)) {
      logger.debug('Erreur déjà connue, ignorée', {
        filePath,
        errorHash,
        message: event.payload.diagnostic?.message
      });
      this.stats.errorsFiltered++;
      return false;
    }

    // Ajouter au cache des erreurs connues
    this.knownErrorHashes.add(errorHash);

    // Mettre à jour les statistiques
    const errorType = event.payload.diagnostic?.code || 'unknown';
    this.stats.errorTypes[errorType] = (this.stats.errorTypes[errorType] || 0) + 1;

    // Déclencher l'envoi MCP
    try {
      await this.triggerMcpSend(event);

      // Mettre à jour les timestamps et statistiques
      this.lastTriggerTimes.set(filePath, now);
      this.stats.lastTriggerTime = now;
      this.stats.errorsTriggered++;

      logger.info('Erreur déclenchée pour envoi MCP', {
        filePath,
        errorType,
        severity,
        language,
        event_uuid: event.event_uuid
      });

      return true;
    } catch (error) {
      logger.error('Échec du déclenchement MCP', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
        event_uuid: event.event_uuid
      });
      return false;
    }
  }

  /**
   * Déclenche l'envoi MCP pour un événement
   */
  private async triggerMcpSend(event: NormalizedEvent): Promise<void> {
    // Préparer les arguments pour l'outil MCP
    const mcpArguments = {
      event: event,
      trigger_type: 'error_detected',
      priority: 'high', // Les erreurs ont haute priorité
      timestamp: new Date().toISOString()
    };

    // Appeler l'outil MCP via le client
    await this.mcpClient.call('receive_vscode_context', mcpArguments);
  }

  /**
   * Calcule un hash unique pour une erreur
   * Basé sur : fichier + ligne + colonne + message + code
   */
  private computeErrorHash(event: NormalizedEvent): string {
    const diagnostic = event.payload.diagnostic;
    const file = event.payload.file;

    if (!diagnostic || !file) {
      return 'unknown';
    }

    const components = [
      file.path,
      diagnostic.range?.start?.line?.toString() || '0',
      diagnostic.range?.start?.character?.toString() || '0',
      diagnostic.message,
      diagnostic.code?.toString() || ''
    ];

    // Hash simple basé sur les composants
    const hashString = components.join('|');
    return this.simpleHash(hashString);
  }

  /**
   * Hash simple pour identification d'erreur
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir en 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Récupère les statistiques du déclencheur
   */
  getStats(): ErrorTriggerStats {
    return { ...this.stats };
  }

  /**
   * Réinitialise les statistiques et le cache
   */
  reset(): void {
    this.stats = {
      totalEventsProcessed: 0,
      errorsTriggered: 0,
      errorsFiltered: 0,
      lastTriggerTime: null,
      errorTypes: {}
    };
    this.lastTriggerTimes.clear();
    this.knownErrorHashes.clear();
    logger.info('ErrorTrigger réinitialisé');
  }

  /**
   * Met à jour la configuration
   */
  updateConfig(config: Partial<ErrorTriggerConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Configuration ErrorTrigger mise à jour', { config: this.config });
  }

  /**
   * Active/désactive le déclencheur
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.isActive = enabled;
    logger.info(`ErrorTrigger ${enabled ? 'activé' : 'désactivé'}`);
  }

  /**
   * Nettoie les ressources
   */
  dispose(): void {
    this.isActive = false;
    this.lastTriggerTimes.clear();
    this.knownErrorHashes.clear();
    logger.info('ErrorTrigger nettoyé');
  }

  /**
   * Vérifie si une erreur est nouvelle (non vue)
   */
  isNewError(event: NormalizedEvent): boolean {
    const errorHash = this.computeErrorHash(event);
    return !this.knownErrorHashes.has(errorHash);
  }

  /**
   * Ajoute manuellement une erreur au cache (pour tests)
   */
  addErrorToCache(event: NormalizedEvent): void {
    const errorHash = this.computeErrorHash(event);
    this.knownErrorHashes.add(errorHash);
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
   * Récupère le nombre d'erreurs connues
   */
  getKnownErrorCount(): number {
    return this.knownErrorHashes.size;
  }
}
