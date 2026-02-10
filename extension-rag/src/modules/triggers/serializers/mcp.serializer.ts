/**
 * Sérialiseur JSON MCP pour les événements normalisés
 *
 * Transforme les événements normalisés en format JSON conforme aux exigences MCP
 * et prépare les payloads pour l'envoi via le protocole JSON-RPC 2.0.
 */

import { NormalizedEvent } from '../../context-capture/normalizers/event.normalizer.js';
import { logger } from '../../context-capture/utils/logger.js';

/**
 * Format de message JSON-RPC 2.0 pour MCP
 */
export interface McpJsonRpcMessage {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params: McpParams;
}

/**
 * Paramètres MCP pour l'outil receive_vscode_context
 */
export interface McpParams {
  name: string;
  arguments: McpArguments;
}

/**
 * Arguments MCP enrichis pour l'outil receive_vscode_context
 */
export interface McpArguments {
  event: NormalizedEvent;
  trigger_type: string;
  priority: 'low' | 'medium' | 'high';
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Configuration du sérialiseur MCP
 */
export interface McpSerializerConfig {
  /** Nom de l'outil MCP cible */
  toolName: string;
  /** Version du protocole JSON-RPC */
  jsonrpcVersion: string;
  /** Inclure les métadonnées enrichies */
  includeEnrichedMetadata: boolean;
  /** Valider le format de sortie */
  validateOutput: boolean;
  /** Limiter la taille des payloads (en caractères) */
  maxPayloadSize: number;
  /** Activer la compression des données */
  enableCompression: boolean;
}

/**
 * Statistiques du sérialiseur
 */
export interface McpSerializerStats {
  totalEventsSerialized: number;
  successfulSerializations: number;
  failedSerializations: number;
  averageSerializationTime: number;
  totalPayloadSize: number;
  averagePayloadSize: number;
  lastSerializationTime: number | null;
  serializationErrors: Record<string, number>;
}

/**
 * Sérialiseur MCP pour transformer les événements normalisés en format JSON-RPC 2.0
 */
export class McpSerializer {
  private config: McpSerializerConfig;
  private stats: McpSerializerStats;
  private requestIdCounter: number = 0;
  private isInitialized: boolean = false;

  constructor(config?: Partial<McpSerializerConfig>) {
    this.config = {
      toolName: 'receive_vscode_context',
      jsonrpcVersion: '2.0',
      includeEnrichedMetadata: true,
      validateOutput: true,
      maxPayloadSize: 100000, // 100KB max
      enableCompression: false,
      ...config
    };

    this.stats = {
      totalEventsSerialized: 0,
      successfulSerializations: 0,
      failedSerializations: 0,
      averageSerializationTime: 0,
      totalPayloadSize: 0,
      averagePayloadSize: 0,
      lastSerializationTime: null,
      serializationErrors: {}
    };
  }

  /**
   * Initialise le sérialiseur
   */
  async initialize(): Promise<void> {
    this.isInitialized = true;
    logger.info('McpSerializer initialisé', {
      config: this.config,
      toolName: this.config.toolName
    });
  }

  /**
   * Sérialise un événement normalisé en message JSON-RPC MCP
   */
  serialize(event: NormalizedEvent, triggerType: string, priority: 'low' | 'medium' | 'high' = 'medium', metadata?: Record<string, any>): McpJsonRpcMessage | null {
    if (!this.isInitialized) {
      logger.warn('McpSerializer non initialisé, tentative de sérialisation ignorée');
      return null;
    }

    const startTime = Date.now();
    this.stats.totalEventsSerialized++;

    try {
      // Préparer les arguments MCP
      const mcpArguments: McpArguments = {
        event: this.prepareEventForSerialization(event),
        trigger_type: triggerType,
        priority,
        timestamp: new Date().toISOString()
      };

      // Ajouter les métadonnées enrichies si configuré
      if (this.config.includeEnrichedMetadata && metadata) {
        mcpArguments.metadata = metadata;
      }

      // Créer les paramètres MCP
      const mcpParams: McpParams = {
        name: this.config.toolName,
        arguments: mcpArguments
      };

      // Générer un ID unique pour la requête
      const requestId = this.generateRequestId();

      // Créer le message JSON-RPC
      const jsonRpcMessage: McpJsonRpcMessage = {
        jsonrpc: this.config.jsonrpcVersion as '2.0',
        id: requestId,
        method: 'tools/call',
        params: mcpParams
      };

      // Valider le message si configuré
      if (this.config.validateOutput) {
        const validationResult = this.validateJsonRpcMessage(jsonRpcMessage);
        if (!validationResult.valid) {
          throw new Error(`Validation JSON-RPC échouée: ${validationResult.errors.join(', ')}`);
        }
      }

      // Vérifier la taille du payload
      const payloadSize = this.calculatePayloadSize(jsonRpcMessage);
      if (payloadSize > this.config.maxPayloadSize) {
        throw new Error(`Payload trop grand: ${payloadSize} caractères (max: ${this.config.maxPayloadSize})`);
      }

      // Mettre à jour les statistiques
      const serializationTime = Date.now() - startTime;
      this.updateStats(true, serializationTime, payloadSize);

      logger.debug('Événement sérialisé avec succès', {
        event_type: event.event_type,
        trigger_type: triggerType,
        priority,
        payload_size: payloadSize,
        serialization_time: serializationTime,
        request_id: requestId
      });

      return jsonRpcMessage;

    } catch (error) {
      // Mettre à jour les statistiques d'erreur
      const serializationTime = Date.now() - startTime;
      this.updateStats(false, serializationTime, 0, error);

      logger.error('Échec de la sérialisation MCP', {
        event_type: event.event_type,
        error: error instanceof Error ? error.message : String(error),
        serialization_time: serializationTime
      });

      return null;
    }
  }

  /**
   * Prépare un événement pour la sérialisation (nettoyage, optimisation)
   */
  private prepareEventForSerialization(event: NormalizedEvent): NormalizedEvent {
    // Créer une copie profonde pour éviter les mutations
    const preparedEvent = JSON.parse(JSON.stringify(event));

    // Optimiser le payload si nécessaire
    if (this.config.enableCompression) {
      preparedEvent.payload = this.compressPayload(preparedEvent.payload);
    }

    // Nettoyer les données sensibles
    preparedEvent.payload = this.sanitizePayload(preparedEvent.payload);

    return preparedEvent;
  }

  /**
   * Compresse le payload pour réduire la taille
   */
  private compressPayload(payload: any): any {
    // Pour l'instant, simple optimisation - pourrait être étendu avec gzip
    if (typeof payload === 'object' && payload !== null) {
      // Supprimer les propriétés vides ou null
      const compressed: any = {};
      for (const [key, value] of Object.entries(payload)) {
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value) && value.length === 0) {
            continue;
          }
          if (typeof value === 'object' && Object.keys(value).length === 0) {
            continue;
          }
          compressed[key] = value;
        }
      }
      return compressed;
    }
    return payload;
  }

  /**
   * Nettoie le payload des données sensibles
   */
  private sanitizePayload(payload: any): any {
    if (typeof payload !== 'object' || payload === null) {
      return payload;
    }

    const sensitivePatterns = [
      /password/i,
      /token/i,
      /secret/i,
      /key/i,
      /credential/i,
      /auth/i
    ];

    const sanitized = JSON.parse(JSON.stringify(payload));

    const sanitizeRecursive = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(item => sanitizeRecursive(item));
      }

      if (typeof obj === 'object' && obj !== null) {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          // Vérifier si la clé contient des informations sensibles
          const isSensitive = sensitivePatterns.some(pattern => pattern.test(key));

          if (isSensitive && typeof value === 'string') {
            result[key] = '[REDACTED]';
          } else {
            result[key] = sanitizeRecursive(value);
          }
        }
        return result;
      }

      return obj;
    };

    return sanitizeRecursive(sanitized);
  }

  /**
   * Génère un ID unique pour la requête JSON-RPC
   */
  private generateRequestId(): number {
    return ++this.requestIdCounter;
  }

  /**
   * Valide un message JSON-RPC
   */
  private validateJsonRpcMessage(message: McpJsonRpcMessage): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Vérifier la version JSON-RPC
    if (message.jsonrpc !== '2.0') {
      errors.push(`Version JSON-RPC invalide: ${message.jsonrpc}`);
    }

    // Vérifier l'ID
    if (message.id === undefined || message.id === null) {
      errors.push('ID JSON-RPC manquant');
    }

    // Vérifier la méthode
    if (!message.method || typeof message.method !== 'string') {
      errors.push('Méthode JSON-RPC invalide');
    }

    // Vérifier les paramètres
    if (!message.params || typeof message.params !== 'object') {
      errors.push('Paramètres JSON-RPC invalides');
    } else {
      // Vérifier la structure des paramètres MCP
      if (!message.params.name || typeof message.params.name !== 'string') {
        errors.push('Nom de l\'outil MCP invalide');
      }
      if (!message.params.arguments || typeof message.params.arguments !== 'object') {
        errors.push('Arguments MCP invalides');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Calcule la taille du payload en caractères
   */
  private calculatePayloadSize(message: McpJsonRpcMessage): number {
    try {
      const jsonString = JSON.stringify(message);
      return jsonString.length;
    } catch {
      return 0;
    }
  }

  /**
   * Met à jour les statistiques du sérialiseur
   */
  private updateStats(success: boolean, time: number, size: number = 0, error?: any): void {
    if (success) {
      this.stats.successfulSerializations++;
      this.stats.totalPayloadSize += size;
      this.stats.averagePayloadSize = this.stats.totalPayloadSize / this.stats.successfulSerializations;

      // Mettre à jour le temps moyen de sérialisation
      const totalTime = this.stats.averageSerializationTime * (this.stats.successfulSerializations - 1) + time;
      this.stats.averageSerializationTime = totalTime / this.stats.successfulSerializations;

      this.stats.lastSerializationTime = Date.now();
    } else {
      this.stats.failedSerializations++;

      // Enregistrer l'erreur dans les statistiques
      const errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
      this.stats.serializationErrors[errorType] = (this.stats.serializationErrors[errorType] || 0) + 1;
    }
  }

  /**
   * Récupère les statistiques du sérialiseur
   */
  getStats(): McpSerializerStats {
    return { ...this.stats };
  }

  /**
   * Réinitialise les statistiques
   */
  resetStats(): void {
    this.stats = {
      totalEventsSerialized: 0,
      successfulSerializations: 0,
      failedSerializations: 0,
      averageSerializationTime: 0,
      totalPayloadSize: 0,
      averagePayloadSize: 0,
      lastSerializationTime: null,
      serializationErrors: {}
    };
    this.requestIdCounter = 0;
    logger.info('Statistiques McpSerializer réinitialisées');
  }

  /**
   * Met à jour la configuration
   */
  updateConfig(config: Partial<McpSerializerConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Configuration McpSerializer mise à jour', { config: this.config });
  }

  /**
   * Vérifie si le sérialiseur est initialisé
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Nettoie les ressources
   */
  dispose(): void {
    this.isInitialized = false;
    logger.info('McpSerializer nettoyé');
  }

  /**
   * Sérialise un batch d'événements
   */
  serializeBatch(events: Array<{
    event: NormalizedEvent;
    triggerType: string;
    priority: 'low' | 'medium' | 'high';
    metadata?: Record<string, any>;
  }>): McpJsonRpcMessage[] {
    const results: McpJsonRpcMessage[] = [];

    for (const item of events) {
      const serialized = this.serialize(item.event, item.triggerType, item.priority, item.metadata);
      if (serialized) {
        results.push(serialized);
      }
    }

    logger.info('Batch sérialisé', {
      total_events: events.length,
      successful_serializations: results.length,
      failed_serializations: events.length - results.length
    });

    return results;
  }

  /**
   * Crée un message JSON-RPC pour un test de connexion
   */
  createConnectionTestMessage(): McpJsonRpcMessage {
    const testEvent: NormalizedEvent = {
      event_uuid: 'test-' + Date.now(),
      event_type: 'test',
      timestamp: new Date().toISOString(),
      project_id: 'test-project',
      workspace_id: 'test-workspace',
      source: 'test',
      version: '1.0.0',
      payload: { test: true },
      metadata: {
        normalized_at: new Date().toISOString(),
        normalizer_version: '1.0.0',
        source_timestamp: Date.now()
      }
    };

    return {
      jsonrpc: '2.0',
      id: 0,
      method: 'tools/call',
      params: {
        name: this.config.toolName,
        arguments: {
          event: testEvent,
          trigger_type: 'test',
          priority: 'low',
          timestamp: new Date().toISOString()
        }
      }
    };
  }

  /**
   * Valide un message JSON-RPC externe
   */
  validateExternalMessage(message: any): { valid: boolean; errors: string[]; normalized?: McpJsonRpcMessage } {
    try {
      // Vérifier la structure de base
      if (!message || typeof message !== 'object') {
        return { valid: false, errors: ['Message non valide ou non objet'] };
      }

      // Vérifier les champs requis
      const errors: string[] = [];

      if (message.jsonrpc !== '2.0') {
        errors.push(`Version JSON-RPC invalide: ${message.jsonrpc}`);
      }

      if (message.id === undefined || message.id === null) {
        errors.push('ID JSON-RPC manquant');
      }

      if (!message.method || typeof message.method !== 'string') {
        errors.push('Méthode JSON-RPC invalide');
      }

      if (!message.params || typeof message.params !== 'object') {
        errors.push('Paramètres JSON-RPC invalides');
      }

      if (errors.length > 0) {
        return { valid: false, errors };
      }

      // Normaliser le message
      const normalized: McpJsonRpcMessage = {
        jsonrpc: '2.0',
        id: message.id,
        method: message.method,
        params: message.params
      };

      return { valid: true, errors: [], normalized };
    } catch (error) {
      return {
        valid: false,
        errors: [`Erreur de validation: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }
}
