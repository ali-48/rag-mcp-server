// MCP Client with improved error handling, validation, and monitoring
import * as WebSocketModule from 'ws';
import { validateToolInput, validateToolOutput } from '../models/json-schemas';

// Définir WebSocket correctement pour Node.js
const WebSocket = WebSocketModule.default || WebSocketModule;

export interface ConnectionMetrics {
  totalConnections: number;
  successfulConnections: number;
  failedConnections: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalBytesSent: number;
  totalBytesReceived: number;
  averageResponseTime: number;
  lastConnectionTime: Date | null;
  lastErrorTime: Date | null;
  uptime: number; // seconds since first connection
}

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
  requestId?: number;
  toolName?: string;
}

export interface ConnectionStatus {
  isConnected: boolean;
  serverUrl: string;
  lastError?: string;
  metrics: ConnectionMetrics;
  uptime: number;
  pendingRequests: number;
  lastHeartbeat?: Date;
}

export interface PassiveSendOptions {
  /** Ne pas attendre de réponse (fire and forget) */
  fireAndForget: boolean;
  /** Priorité de l'envoi (pour la file d'attente) */
  priority: 'low' | 'medium' | 'high';
  /** Temps maximum d'attente pour l'envoi (ms) */
  sendTimeout: number;
  /** Ne pas valider les schémas JSON (pour performance) */
  skipValidation: boolean;
  /** Ne pas journaliser cet envoi */
  silent: boolean;
}

export class McpClient {
  private ws: InstanceType<typeof WebSocket> | null = null;
  private serverUrl: string;
  private timeout: number;
  private isConnected: boolean = false;
  private requestId: number = 0;
  private pendingRequests: Map<number, {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    startTime: Date;
  }> = new Map();
  private pendingToolNames: Map<number, string> = new Map();
  private lastError: string | null = null;
  private validateOutput: boolean = true;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private metrics: ConnectionMetrics;
  private connectionStartTime: Date | null = null;
  private lastHeartbeat: Date | null = null;
  private enableStructuredLogs: boolean = false;

  // File d'attente pour envoi passif
  private passiveQueue: Array<{
    tool: string;
    params: any;
    options: PassiveSendOptions;
    timestamp: number;
    resolve?: (value: any) => void;
    reject?: (reason?: any) => void;
  }> = [];
  private maxQueueSize: number = 1000;
  private isProcessingQueue: boolean = false;
  private queueProcessingInterval: NodeJS.Timeout | null = null;

  constructor(serverUrl: string, timeout: number = 30000) {
    this.serverUrl = serverUrl;
    this.timeout = timeout;

    // Initialize metrics
    this.metrics = {
      totalConnections: 0,
      successfulConnections: 0,
      failedConnections: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalBytesSent: 0,
      totalBytesReceived: 0,
      averageResponseTime: 0,
      lastConnectionTime: null,
      lastErrorTime: null,
      uptime: 0,
    };
  }

  /**
   * Enable or disable output validation (default: true)
   */
  setOutputValidation(enabled: boolean): void {
    this.validateOutput = enabled;
    this.log('info', `Output validation ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Enable or disable structured JSON logs (default: false)
   */
  setStructuredLogs(enabled: boolean): void {
    this.enableStructuredLogs = enabled;
    this.log('info', `Structured logs ${enabled ? 'enabled' : 'disabled'}`);
  }

  private log(level: LogEntry['level'], message: string, data?: any, requestId?: number, toolName?: string): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      data,
      requestId,
      toolName,
    };

    this.logs.push(entry);

    // Keep logs within limit
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Output to console based on structured logs setting
    if (this.enableStructuredLogs) {
      console.log(JSON.stringify(entry));
    } else {
      const prefix = {
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌',
        debug: '🔍',
      }[level];

      const formattedMessage = `${prefix} ${message}`;
      const consoleMethod = {
        info: console.log,
        warn: console.warn,
        error: console.error,
        debug: console.debug,
      }[level];

      if (data) {
        consoleMethod(formattedMessage, data);
      } else {
        consoleMethod(formattedMessage);
      }
    }
  }

  private updateMetricsOnConnect(success: boolean): void {
    this.metrics.totalConnections++;
    if (success) {
      this.metrics.successfulConnections++;
      this.metrics.lastConnectionTime = new Date();
      this.connectionStartTime = new Date();
    } else {
      this.metrics.failedConnections++;
      this.metrics.lastErrorTime = new Date();
    }
  }

  private updateMetricsOnRequest(success: boolean, responseTime?: number, bytesSent?: number, bytesReceived?: number): void {
    this.metrics.totalRequests++;
    if (success) {
      this.metrics.successfulRequests++;
      if (responseTime !== undefined) {
        // Update average response time
        const totalTime = this.metrics.averageResponseTime * (this.metrics.successfulRequests - 1) + responseTime;
        this.metrics.averageResponseTime = totalTime / this.metrics.successfulRequests;
      }
    } else {
      this.metrics.failedRequests++;
      this.metrics.lastErrorTime = new Date();
    }

    if (bytesSent !== undefined) {
      this.metrics.totalBytesSent += bytesSent;
    }
    if (bytesReceived !== undefined) {
      this.metrics.totalBytesReceived += bytesReceived;
    }
  }

  async connect(): Promise<void> {
    const startTime = Date.now();
    this.log('info', `Connecting to MCP server at ${this.serverUrl}`);

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          const connectTime = Date.now() - startTime;
          this.isConnected = true;
          this.lastError = null;
          this.updateMetricsOnConnect(true);
          this.log('info', `Connected to MCP server at ${this.serverUrl} (${connectTime}ms)`);
          resolve();
        };

        this.ws.onclose = (event) => {
          this.isConnected = false;
          const message = event.code === 1000 ? 'Normal closure' : `Closed with code ${event.code}`;
          this.log('info', `Disconnected from MCP server: ${message}`);
          // Reject any pending requests
          this.rejectAllPendingRequests(new Error(`WebSocket closed: ${message}`));
        };

        this.ws.onerror = (error) => {
          this.lastError = error instanceof Error ? error.message : 'Unknown WebSocket error';
          this.updateMetricsOnConnect(false);
          this.log('error', `WebSocket error: ${this.lastError}`, error);
          reject(new Error(`Failed to connect to MCP server at ${this.serverUrl}: ${this.lastError}`));
        };

        this.ws.onmessage = (event) => {
          try {
            const receiveTime = new Date();
            const data = event.data;
            const jsonString = typeof data === 'string' ? data : data.toString();
            const message = JSON.parse(jsonString);

            // Update bytes received
            this.updateMetricsOnRequest(true, undefined, undefined, jsonString.length);

            if (message.id !== undefined && this.pendingRequests.has(message.id)) {
              const { resolve, reject, startTime } = this.pendingRequests.get(message.id)!;
              const toolName = this.pendingToolNames.get(message.id);
              this.pendingRequests.delete(message.id);
              this.pendingToolNames.delete(message.id);

              const responseTime = Date.now() - startTime.getTime();

              // Handle JSON-RPC error response
              if (message.error) {
                const errorMsg = message.error.message || 'Unknown MCP error';
                const errorCode = message.error.code || -32000;
                this.updateMetricsOnRequest(false, responseTime);
                this.log('error', `MCP error ${errorCode}: ${errorMsg}`, { toolName, responseTime, requestId: message.id });
                reject(new Error(`MCP error ${errorCode}: ${errorMsg}`));
                return;
              }

              // Success response
              if (message.result !== undefined) {
                // Validate output if enabled and we know the tool name
                if (this.validateOutput && toolName) {
                  const outputValidation = validateToolOutput(toolName, message.result);
                  if (!outputValidation.valid) {
                    this.log('warn', `Output validation failed for tool ${toolName}`, {
                      errors: outputValidation.errors,
                      responseTime,
                      requestId: message.id,
                    });
                    // Still resolve, but log warning (we don't reject because server responded)
                  }
                }

                this.updateMetricsOnRequest(true, responseTime);
                this.log('info', `MCP tool ${toolName} completed successfully`, {
                  responseTime,
                  requestId: message.id,
                });
                resolve(message.result);
              } else {
                // If no result field but message is valid, return the whole message
                this.updateMetricsOnRequest(true, responseTime);
                this.log('info', `MCP request completed (no result field)`, {
                  responseTime,
                  requestId: message.id,
                  toolName,
                });
                resolve(message);
              }
            }
          } catch (error) {
            this.updateMetricsOnRequest(false);
            this.log('error', 'Failed to parse MCP message', { error, rawData: event.data });
            this.lastError = 'Failed to parse MCP response';
          }
        };
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : 'Unknown connection error';
        this.updateMetricsOnConnect(false);
        this.log('error', 'Failed to create WebSocket connection', { error });
        reject(new Error(`Failed to create WebSocket connection: ${this.lastError}`));
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.isConnected = false;
    this.rejectAllPendingRequests(new Error('Client disconnected'));
    this.log('info', 'Disconnected from MCP server');
  }

  async call(tool: string, params: any): Promise<any> {
    // Basic validation
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected to MCP server. Please call connect() first.');
    }

    if (!tool || typeof tool !== 'string') {
      throw new Error('Tool name must be a non-empty string');
    }

    if (params && typeof params !== 'object') {
      throw new Error('Parameters must be an object or null/undefined');
    }

    // JSON Schema validation
    const inputValidation = validateToolInput(tool, params);
    if (!inputValidation.valid) {
      throw new Error(`Invalid parameters for tool ${tool}: ${inputValidation.errors.join(', ')}`);
    }

    const id = ++this.requestId;
    const request = {
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name: tool,
        arguments: params || {},
      },
    };

    return new Promise((resolve, reject) => {
      const startTime = new Date();
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        this.pendingToolNames.delete(id);
        this.updateMetricsOnRequest(false);
        this.log('error', `MCP call timeout for tool ${tool}`, { requestId: id, timeout: this.timeout });
        reject(new Error(`MCP call timeout after ${this.timeout}ms (tool: ${tool})`));
      }, this.timeout);

      this.pendingRequests.set(id, {
        resolve: (result: any) => {
          clearTimeout(timeoutId);
          resolve(result);
        },
        reject: (error: any) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        startTime,
      });

      // Store tool name for output validation
      this.pendingToolNames.set(id, tool);

      try {
        const requestStr = JSON.stringify(request);
        this.updateMetricsOnRequest(true, undefined, requestStr.length);
        this.log('info', `Calling MCP tool: ${tool}`, { params, requestId: id });

        if (!this.ws) {
          throw new Error('WebSocket not initialized');
        }
        this.ws.send(requestStr);
      } catch (error) {
        this.pendingRequests.delete(id);
        this.pendingToolNames.delete(id);
        clearTimeout(timeoutId);
        this.updateMetricsOnRequest(false);
        const errorMsg = error instanceof Error ? error.message : 'Unknown send error';
        this.log('error', `Failed to send MCP request for tool ${tool}`, { error: errorMsg, requestId: id });
        reject(new Error(`Failed to send MCP request for tool ${tool}: ${errorMsg}`));
      }
    });
  }

  async validateConnection(): Promise<boolean> {
    try {
      // Send a simple ping-like request with timeout
      await this.call('rag_get_status', { scope: 'global' });
      this.lastHeartbeat = new Date();
      return true;
    } catch (error) {
      this.log('warn', 'Connection validation failed', { error });
      return false;
    }
  }

  getConnectionStatus(): ConnectionStatus {
    const uptime = this.connectionStartTime
      ? (Date.now() - this.connectionStartTime.getTime()) / 1000
      : 0;

    // Update uptime in metrics
    this.metrics.uptime = uptime;

    return {
      isConnected: this.isConnected,
      serverUrl: this.serverUrl,
      lastError: this.lastError || undefined,
      metrics: { ...this.metrics },
      uptime,
      pendingRequests: this.pendingRequests.size,
      lastHeartbeat: this.lastHeartbeat || undefined,
    };
  }

  getLogs(level?: LogEntry['level'], limit: number = 100): LogEntry[] {
    let filteredLogs = this.logs;
    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }
    return filteredLogs.slice(-limit);
  }

  clearLogs(): void {
    this.logs = [];
    this.log('info', 'Logs cleared');
  }

  getMetrics(): ConnectionMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      totalConnections: 0,
      successfulConnections: 0,
      failedConnections: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalBytesSent: 0,
      totalBytesReceived: 0,
      averageResponseTime: 0,
      lastConnectionTime: null,
      lastErrorTime: null,
      uptime: 0,
    };
    this.log('info', 'Metrics reset');
  }

  /**
   * Envoi passif (fire and forget) sans attendre de réponse
   */
  async sendPassive(tool: string, params: any, options: Partial<PassiveSendOptions> = {}): Promise<void> {
    const fullOptions: PassiveSendOptions = {
      fireAndForget: true,
      priority: 'medium',
      sendTimeout: 5000,
      skipValidation: false,
      silent: false,
      ...options
    };

    try {
      // Validation basique
      if (!this.isConnected || !this.ws) {
        throw new Error('Not connected to MCP server');
      }

      if (!tool || typeof tool !== 'string') {
        throw new Error('Tool name must be a non-empty string');
      }

      // Validation JSON Schema (sauf si skipValidation)
      if (!fullOptions.skipValidation) {
        const inputValidation = validateToolInput(tool, params);
        if (!inputValidation.valid) {
          throw new Error(`Invalid parameters for tool ${tool}: ${inputValidation.errors.join(', ')}`);
        }
      }

      const id = ++this.requestId;
      const request = {
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: {
          name: tool,
          arguments: params || {},
        },
      };

      const requestStr = JSON.stringify(request);

      // Mettre à jour les métriques
      this.updateMetricsOnRequest(true, undefined, requestStr.length);

      // Journaliser (sauf si silent)
      if (!fullOptions.silent) {
        this.log('info', `Passive send to MCP tool: ${tool}`, {
          params,
          requestId: id,
          options: fullOptions
        });
      }

      // Envoyer sans attendre de réponse
      if (!this.ws) {
        throw new Error('WebSocket not initialized');
      }
      this.ws.send(requestStr);

    } catch (error) {
      // Journaliser l'erreur (sauf si silent)
      if (!options.silent) {
        this.log('error', `Failed passive send to MCP tool ${tool}`, {
          error: error instanceof Error ? error.message : String(error),
          options: fullOptions
        });
      }

      // Pour l'envoi passif, on ne propage pas l'erreur
      // mais on peut la mettre dans la file d'attente pour retry
      if (this.isConnected) {
        this.addToQueue(tool, params, fullOptions);
      }
    }
  }

  /**
   * Envoi asynchrone avec gestion de file d'attente
   */
  async sendAsync(tool: string, params: any, options: Partial<PassiveSendOptions> = {}): Promise<any> {
    const fullOptions: PassiveSendOptions = {
      fireAndForget: false,
      priority: 'medium',
      sendTimeout: this.timeout,
      skipValidation: false,
      silent: false,
      ...options
    };

    // Si déconnecté, mettre dans la file d'attente
    if (!this.isConnected || !this.ws) {
      return new Promise((resolve, reject) => {
        this.addToQueue(tool, params, fullOptions, resolve, reject);
      });
    }

    // Sinon, envoyer normalement
    return this.call(tool, params);
  }

  /**
   * Ajoute une requête à la file d'attente
   */
  private addToQueue(
    tool: string,
    params: any,
    options: PassiveSendOptions,
    resolve?: (value: any) => void,
    reject?: (reason?: any) => void
  ): void {
    // Vérifier la taille de la file d'attente
    if (this.passiveQueue.length >= this.maxQueueSize) {
      // Supprimer les éléments les plus anciens de priorité basse
      const lowPriorityItems = this.passiveQueue.filter(item => item.options.priority === 'low');
      if (lowPriorityItems.length > 0) {
        const index = this.passiveQueue.indexOf(lowPriorityItems[0]);
        this.passiveQueue.splice(index, 1);
        this.log('warn', 'Queue full, removed low priority item', { tool, queueSize: this.passiveQueue.length });
      } else {
        // Si pas d'éléments basse priorité, rejeter la nouvelle requête
        if (reject) {
          reject(new Error('Queue is full'));
        }
        this.log('error', 'Queue is full, cannot add new item', { tool, queueSize: this.passiveQueue.length });
        return;
      }
    }

    // Ajouter à la file d'attente
    const queueItem = {
      tool,
      params,
      options,
      timestamp: Date.now(),
      resolve,
      reject
    };

    // Trier par priorité et timestamp
    this.passiveQueue.push(queueItem);
    this.passiveQueue.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const aPriority = priorityOrder[a.options.priority];
      const bPriority = priorityOrder[b.options.priority];

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      return a.timestamp - b.timestamp;
    });

    this.log('info', 'Added to passive queue', {
      tool,
      queueSize: this.passiveQueue.length,
      priority: options.priority
    });

    // Démarrer le traitement de la file d'attente si pas déjà en cours
    this.startQueueProcessing();
  }

  /**
   * Démarre le traitement de la file d'attente
   */
  private startQueueProcessing(): void {
    if (this.isProcessingQueue || this.queueProcessingInterval) {
      return;
    }

    this.isProcessingQueue = true;

    this.queueProcessingInterval = setInterval(async () => {
      await this.processQueue();
    }, 1000); // Traiter la file d'attente toutes les secondes
  }

  /**
   * Traite la file d'attente
   */
  private async processQueue(): Promise<void> {
    if (!this.isConnected || !this.ws || this.passiveQueue.length === 0) {
      return;
    }

    // Prendre le premier élément de la file d'attente
    const item = this.passiveQueue.shift();
    if (!item) {
      return;
    }

    try {
      if (item.options.fireAndForget) {
        // Envoi passif sans attente de réponse
        await this.sendPassive(item.tool, item.params, item.options);
        if (item.resolve) {
          item.resolve(undefined);
        }
      } else {
        // Envoi normal avec attente de réponse
        const result = await this.call(item.tool, item.params);
        if (item.resolve) {
          item.resolve(result);
        }
      }

      this.log('info', 'Processed queue item successfully', {
        tool: item.tool,
        queueSize: this.passiveQueue.length
      });

    } catch (error) {
      // En cas d'erreur, remettre dans la file d'attente avec backoff
      if (item.reject) {
        item.reject(error);
      }

      // Ne pas remettre dans la file d'attente si l'erreur est permanente
      const shouldRetry = this.shouldRetryQueueItem(item, error);
      if (shouldRetry) {
        // Ajouter un délai avant retry
        item.timestamp = Date.now() + 5000; // 5 secondes de délai
        this.passiveQueue.unshift(item);
        this.log('warn', 'Queue item failed, will retry', {
          tool: item.tool,
          error: error instanceof Error ? error.message : String(error),
          queueSize: this.passiveQueue.length
        });
      } else {
        this.log('error', 'Queue item failed permanently', {
          tool: item.tool,
          error: error instanceof Error ? error.message : String(error),
          queueSize: this.passiveQueue.length
        });
      }
    }
  }

  /**
   * Détermine si un élément de la file d'attente doit être retenté
   */
  private shouldRetryQueueItem(item: any, error: any): boolean {
    // Ne pas retenter les erreurs de validation
    if (error instanceof Error && error.message.includes('Invalid parameters')) {
      return false;
    }

    // Ne pas retenter les erreurs de timeout
    if (error instanceof Error && error.message.includes('timeout')) {
      return false;
    }

    // Retenter les erreurs de connexion
    if (error instanceof Error && error.message.includes('Not connected')) {
      return true;
    }

    // Retenter les erreurs réseau
    if (error instanceof Error && error.message.includes('WebSocket')) {
      return true;
    }

    // Par défaut, retenter
    return true;
  }

  /**
   * Arrête le traitement de la file d'attente
   */
  private stopQueueProcessing(): void {
    if (this.queueProcessingInterval) {
      clearInterval(this.queueProcessingInterval);
      this.queueProcessingInterval = null;
    }
    this.isProcessingQueue = false;
  }

  /**
   * Récupère les statistiques de la file d'attente
   */
  getQueueStats(): { size: number; items: Array<{ tool: string; priority: string; timestamp: number }> } {
    return {
      size: this.passiveQueue.length,
      items: this.passiveQueue.map(item => ({
        tool: item.tool,
        priority: item.options.priority,
        timestamp: item.timestamp
      }))
    };
  }

  /**
   * Vide la file d'attente
   */
  clearQueue(): void {
    this.passiveQueue = [];
    this.log('info', 'Passive queue cleared');
  }

  /**
   * Configure la taille maximale de la file d'attente
   */
  setMaxQueueSize(size: number): void {
    this.maxQueueSize = size;
    this.log('info', `Max queue size set to ${size}`);
  }

  private rejectAllPendingRequests(error: Error): void {
    // Compatible iteration for ES2022/TypeScript
    const entries = Array.from(this.pendingRequests.entries());
    for (const [id, { reject }] of entries) {
      reject(error);
      this.pendingRequests.delete(id);
      this.pendingToolNames.delete(id);
    }

    // Rejeter aussi les éléments de la file d'attente
    for (const item of this.passiveQueue) {
      if (item.reject) {
        item.reject(error);
      }
    }
    this.passiveQueue = [];
  }
}
