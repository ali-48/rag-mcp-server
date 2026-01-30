import { gatewayLogger } from './logging';
import { McpContract, McpContractResponse, McpContractUtils } from './types/contract';

/**
 * McpGateway - Gateway pour le routing MCP entre serveurs
 *
 * Classe principale qui gère le routing, la validation et la traçabilité
 * des contrats MCP entre différents serveurs.
 */
export class McpGateway {
  private registeredTargets: Map<string, (contract: McpContract) => Promise<McpContractResponse>>;
  private requestHistory: Map<string, { contract: McpContract; response?: McpContractResponse; timestamp: number }>;
  private cycleDetection: Set<string>;

  constructor() {
    this.registeredTargets = new Map();
    this.requestHistory = new Map();
    this.cycleDetection = new Set();

    gatewayLogger.info('MCP Gateway initialized');
  }

  /**
   * Enregistre un handler pour une cible spécifique
   */
  registerTarget(target: string, handler: (contract: McpContract) => Promise<McpContractResponse>): void {
    this.registeredTargets.set(target, handler);
    gatewayLogger.logTargetRegistration(target);
  }

  /**
   * Désenregistre un handler pour une cible
   */
  unregisterTarget(target: string): void {
    this.registeredTargets.delete(target);
    gatewayLogger.logTargetUnregistration(target);
  }

  /**
   * Route un contrat MCP vers la cible appropriée
   */
  async route(contract: McpContract): Promise<McpContractResponse> {
    const startTime = Date.now();
    const requestId = contract.metadata?.requestId || `req-${startTime}`;

    gatewayLogger.info(`Routing contract: ${requestId}`, {
      requestId,
      source: contract.source,
      target: contract.target,
      operation: contract.operation
    });

    // 1. Validation du contrat
    const validation = McpContractUtils.validateContract(contract);
    if (!validation.isValid) {
      gatewayLogger.error(`Contract validation failed`, {
        requestId,
        source: contract.source,
        target: contract.target,
        operation: contract.operation,
        errorCode: 'VALIDATION_ERROR',
        errorDetails: { errors: validation.errors }
      });
      return McpContractUtils.createResponse(
        contract,
        false,
        undefined,
        { code: 'VALIDATION_ERROR', message: 'Contract validation failed', details: { errors: validation.errors } }
      );
    }

    // 2. Détection de cycles
    const cycleKey = `${contract.source}:${contract.target}:${contract.operation}`;
    if (this.cycleDetection.has(cycleKey)) {
      gatewayLogger.logCycleDetection(cycleKey, contract.metadata?.context?.trace);
      return McpContractUtils.createResponse(
        contract,
        false,
        undefined,
        { code: 'CYCLE_DETECTED', message: 'Routing cycle detected', details: { cycleKey } }
      );
    }

    this.cycleDetection.add(cycleKey);

    try {
      // 3. Vérification de la cible
      const handler = this.registeredTargets.get(contract.target);
      if (!handler) {
        gatewayLogger.error(`Target not found`, {
          requestId,
          source: contract.source,
          target: contract.target,
          operation: contract.operation,
          errorCode: 'TARGET_NOT_FOUND'
        });
        return McpContractUtils.createResponse(
          contract,
          false,
          undefined,
          { code: 'TARGET_NOT_FOUND', message: `Target '${contract.target}' not registered` }
        );
      }

      // 4. Stockage dans l'historique
      this.requestHistory.set(requestId, { contract, timestamp: startTime });

      // 5. Exécution du handler
      gatewayLogger.debug(`Executing handler for target`, {
        requestId,
        target: contract.target
      });

      const response = await handler(contract);

      // 6. Mise à jour de l'historique
      this.requestHistory.set(requestId, { contract, response, timestamp: startTime });

      const duration = Date.now() - startTime;
      gatewayLogger.logContractRouting(contract, duration, true);

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      gatewayLogger.logContractRouting(contract, duration, false, error);

      return McpContractUtils.createResponse(
        contract,
        false,
        undefined,
        {
          code: 'ROUTING_ERROR',
          message: error instanceof Error ? error.message : 'Unknown routing error',
          details: { error: String(error) }
        }
      );
    } finally {
      // 7. Nettoyage de la détection de cycles
      this.cycleDetection.delete(cycleKey);
    }
  }

  /**
   * Route un contrat avec retry selon la configuration
   */
  async routeWithRetry(contract: McpContract): Promise<McpContractResponse> {
    const retryConfig = contract.routing?.retry || { maxAttempts: 3, delayMs: 1000, backoffMultiplier: 2 };
    let lastError: any;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        if (attempt > 1) {
          gatewayLogger.logRetryAttempt(contract, attempt, retryConfig.maxAttempts);
          await new Promise(resolve => setTimeout(resolve, retryConfig.delayMs * Math.pow(retryConfig.backoffMultiplier, attempt - 2)));
        }

        const response = await this.route(contract);

        if (response.success) {
          return response;
        }

        lastError = response.error;

        // Si c'est une erreur non récupérable, on arrête
        if (response.error?.code === 'VALIDATION_ERROR' || response.error?.code === 'CYCLE_DETECTED') {
          break;
        }
      } catch (error) {
        lastError = error;
      }
    }

    gatewayLogger.error(`All retry attempts failed`, {
      requestId: contract.metadata?.requestId,
      source: contract.source,
      target: contract.target,
      operation: contract.operation,
      errorCode: 'RETRY_EXHAUSTED',
      errorDetails: { lastError: String(lastError), attempts: retryConfig.maxAttempts }
    });

    return McpContractUtils.createResponse(
      contract,
      false,
      undefined,
      {
        code: 'RETRY_EXHAUSTED',
        message: 'All retry attempts failed',
        details: { lastError: String(lastError), attempts: retryConfig.maxAttempts }
      }
    );
  }

  /**
   * Récupère l'historique des requêtes
   */
  getRequestHistory(): Array<{ requestId: string; contract: McpContract; response?: McpContractResponse; timestamp: number }> {
    return Array.from(this.requestHistory.entries()).map(([requestId, data]) => ({
      requestId,
      ...data
    }));
  }

  /**
   * Récupère les cibles enregistrées
   */
  getRegisteredTargets(): string[] {
    return Array.from(this.registeredTargets.keys());
  }

  /**
   * Détecte les cycles dans une trace de routing
   * @param trace Tableau des cibles visitées dans l'ordre
   * @returns Le cycle détecté ou null si pas de cycle
   */
  detectCycles(trace: string[]): string[] | null {
    if (trace.length < 2) {
      return null;
    }

    // Utiliser un Set pour détecter les doublons
    const visited = new Set<string>();
    const cycleStartIndex = new Map<string, number>();

    for (let i = 0; i < trace.length; i++) {
      const target = trace[i];

      if (visited.has(target)) {
        // Cycle détecté ! Trouver le début du cycle
        const startIndex = cycleStartIndex.get(target) || i;
        return trace.slice(startIndex, i + 1);
      }

      visited.add(target);
      cycleStartIndex.set(target, i);
    }

    return null;
  }

  /**
   * Nettoie l'historique des requêtes plus ancien que maxAgeMs
   */
  cleanupHistory(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    const oldEntries = Array.from(this.requestHistory.entries()).filter(
      ([_, data]) => now - data.timestamp > maxAgeMs
    );

    oldEntries.forEach(([requestId]) => this.requestHistory.delete(requestId));

    gatewayLogger.info(`Cleaned up ${oldEntries.length} old history entries`);
    return oldEntries.length;
  }

  /**
   * Récupère les statistiques des logs
   */
  getLogStats() {
    return gatewayLogger.getLogStats();
  }
}

// Export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { McpGateway, McpContractUtils };
}

// Export ES modules
export { McpContractUtils } from './types/contract';
