/**
 * McpContract - Contrat pour le routing MCP entre serveurs
 *
 * Structure standardisée pour les échanges entre serveurs MCP
 * Permet le routing, la validation et la traçabilité des interactions
 */
export interface McpContract {
  /** Source de la requête (ex: "task-manager", "rag-server", "vscode-extension") */
  source: string;

  /** Cible de la requête (ex: "rag-server", "task-manager", "mcp-gateway") */
  target: string;

  /** Opération à effectuer (ex: "query_rag", "create_task", "get_status") */
  operation: string;

  /** Données de la requête (payload) */
  payload: Record<string, any>;

  /** Validation schema pour le payload (JSON Schema ou référence) */
  validation?: {
    /** Type de validation ("json-schema", "custom", "none") */
    type: 'json-schema' | 'custom' | 'none';

    /** Schéma de validation (JSON Schema string ou object) */
    schema?: string | Record<string, any>;

    /** Fonction de validation personnalisée (si type="custom") */
    validator?: (payload: any) => boolean;
  };

  /** Métadonnées de la requête */
  metadata?: {
    /** ID unique de la requête */
    requestId: string;

    /** Timestamp de création */
    timestamp: number;

    /** Priorité (1-10, 10 = haute priorité) */
    priority?: number;

    /** Timeout en millisecondes */
    timeout?: number;

    /** Tags pour le routing avancé */
    tags?: string[];

    /** Contexte de la requête (pour le debugging) */
    context?: Record<string, any>;
  };

  /** Options de routing */
  routing?: {
    /** Stratégie de routing ("direct", "broadcast", "round-robin") */
    strategy: 'direct' | 'broadcast' | 'round-robin';

    /** Fallback si la cible principale échoue */
    fallbackTargets?: string[];

    /** Retry policy */
    retry?: {
      maxAttempts: number;
      delayMs: number;
      backoffMultiplier: number;
    };
  };
}

/**
 * McpContractResponse - Réponse standardisée pour les contrats MCP
 */
export interface McpContractResponse {
  /** Succès de l'opération */
  success: boolean;

  /** Données de la réponse */
  data?: Record<string, any>;

  /** Erreur (si success = false) */
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };

  /** Métadonnées de la réponse */
  metadata: {
    /** ID de la requête originale */
    requestId: string;

    /** Timestamp de la réponse */
    timestamp: number;

    /** Durée d'exécution en millisecondes */
    durationMs: number;

    /** Serveur qui a traité la requête */
    processedBy: string;
  };
}

/**
 * ValidationResult - Résultat de la validation d'un contrat
 */
export interface ValidationResult {
  /** Contrat valide ou non */
  isValid: boolean;

  /** Erreurs de validation (si isValid = false) */
  errors?: string[];

  /** Warnings (validation réussie avec avertissements) */
  warnings?: string[];
}

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

/**
 * JSON Schema validator instance
 */
const ajv = new Ajv({
  allErrors: true,
  strict: false,
  coerceTypes: true,
  useDefaults: true,
});
addFormats(ajv);

/**
 * Helper functions pour les contrats MCP
 */
export const McpContractUtils = {
  /**
   * Crée un nouveau contrat MCP
   */
  createContract(
    source: string,
    target: string,
    operation: string,
    payload: Record<string, any>,
    options?: Partial<McpContract>
  ): McpContract {
    const now = Date.now();
    return {
      source,
      target,
      operation,
      payload,
      validation: options?.validation || { type: 'none' },
      metadata: {
        requestId: `req-${now}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: now,
        priority: options?.metadata?.priority || 5,
        timeout: options?.metadata?.timeout || 30000,
        tags: options?.metadata?.tags || [],
        context: options?.metadata?.context || {},
      },
      routing: options?.routing || {
        strategy: 'direct',
        fallbackTargets: [],
        retry: {
          maxAttempts: 3,
          delayMs: 1000,
          backoffMultiplier: 2,
        },
      },
    };
  },

  /**
   * Valide un contrat MCP
   */
  validateContract(contract: McpContract): ValidationResult {
    const errors: string[] = [];

    // Validation des champs requis
    if (!contract.source) errors.push('source is required');
    if (!contract.target) errors.push('target is required');
    if (!contract.operation) errors.push('operation is required');
    if (!contract.payload) errors.push('payload is required');

    // Validation du format source/target
    if (contract.source && typeof contract.source !== 'string') {
      errors.push('source must be a string');
    }
    if (contract.target && typeof contract.target !== 'string') {
      errors.push('target must be a string');
    }

    // Validation du payload (doit être un objet)
    if (contract.payload && typeof contract.payload !== 'object') {
      errors.push('payload must be an object');
    }

    // Validation JSON Schema si spécifiée
    if (contract.validation?.type === 'json-schema' && contract.validation.schema) {
      const schemaValidation = this.validateJsonSchema(contract.payload, contract.validation.schema);
      if (!schemaValidation.isValid && schemaValidation.errors) {
        errors.push(...schemaValidation.errors.map(err => `JSON Schema: ${err}`));
      }
    }

    // Validation custom si spécifiée
    if (contract.validation?.type === 'custom' && contract.validation.validator) {
      try {
        const isValid = contract.validation.validator(contract.payload);
        if (!isValid) {
          errors.push('Custom validation failed');
        }
      } catch (error) {
        errors.push(`Custom validation error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  },

  /**
   * Valide un payload contre un JSON Schema
   */
  validateJsonSchema(payload: any, schema: string | Record<string, any>): ValidationResult {
    try {
      const schemaObj = typeof schema === 'string' ? JSON.parse(schema) : schema;
      const validate = ajv.compile(schemaObj);
      const isValid = validate(payload);

      if (isValid) {
        return { isValid: true };
      } else {
        const errors = validate.errors?.map(err =>
          `${err.instancePath || 'root'} ${err.message}`
        ) || ['Unknown JSON Schema validation error'];

        return {
          isValid: false,
          errors,
        };
      }
    } catch (error) {
      return {
        isValid: false,
        errors: [`JSON Schema parsing error: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  },

  /**
   * Crée un schéma JSON pour une opération MCP
   */
  createJsonSchema(schemaDefinition: Record<string, any>): Record<string, any> {
    return {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: schemaDefinition,
      additionalProperties: false,
      required: Object.keys(schemaDefinition).filter(key => !schemaDefinition[key].optional),
    };
  },

  /**
   * Exemples de schémas JSON pour les opérations courantes
   */
  exampleSchemas: {
    query_rag: {
      query: { type: 'string', description: 'Search query' },
      top_k: { type: 'number', minimum: 1, maximum: 100, default: 10, optional: true },
      threshold: { type: 'number', minimum: 0, maximum: 1, default: 0.3, optional: true },
      content_types: {
        type: 'array',
        items: { type: 'string', enum: ['code', 'doc', 'config', 'other'] },
        optional: true
      },
    },
    get_status: {
      scope: { type: 'string', enum: ['global', 'project', 'task'], default: 'global' },
      project_id: { type: 'string', optional: true },
      task_id: { type: 'string', optional: true },
      include_notes_for_ai: { type: 'boolean', default: true, optional: true },
    },
    create_task: {
      title: { type: 'string', minLength: 1 },
      description: { type: 'string' },
      priority: { type: 'number', minimum: 1, maximum: 5, default: 3, optional: true },
      tags: { type: 'array', items: { type: 'string' }, optional: true },
    },
  },

  /**
   * Crée une réponse de contrat
   */
  createResponse(
    contract: McpContract,
    success: boolean,
    data?: Record<string, any>,
    error?: { code: string; message: string; details?: Record<string, any> }
  ): McpContractResponse {
    const now = Date.now();
    const startTime = contract.metadata?.timestamp || now;

    return {
      success,
      data,
      error,
      metadata: {
        requestId: contract.metadata?.requestId || 'unknown',
        timestamp: now,
        durationMs: now - startTime,
        processedBy: 'mcp-gateway',
      },
    };
  },
};
