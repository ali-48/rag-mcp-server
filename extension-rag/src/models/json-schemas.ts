/**
 * JSON Schema types for MCP tool validation
 * Based on the server-side schemas in src/core/mcp-schemas.ts
 */

export interface JSONSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
  items?: any;
  enum?: any[];
  description?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  default?: any;
}

/**
 * Input schemas for MCP tools
 */
export const initRagInputSchema: JSONSchema = {
  type: "object",
  properties: {
    project_path: {
      type: "string",
      description: "Chemin absolu vers le projet à initialiser",
      minLength: 1,
    },
    mode: {
      type: "string",
      enum: ["default", "memory-only", "full"],
      description: "Mode d'initialisation",
      default: "default",
    },
    force: {
      type: "boolean",
      description: "Forcer l'initialisation même si déjà initialisé",
      default: false,
    },
    verbose: {
      type: "boolean",
      description: "Afficher des détails supplémentaires",
      default: false,
    },
  },
  required: ["project_path"],
  additionalProperties: false,
};

export const getStatusInputSchema: JSONSchema = {
  type: "object",
  properties: {
    scope: {
      type: "string",
      enum: ["global", "project", "task"],
      description: "Scope du statut à récupérer",
      default: "global",
    },
    project_id: {
      type: "string",
      description: "ID du projet (requis si scope=project)",
    },
    task_id: {
      type: "string",
      description: "ID de la tâche (requis si scope=task)",
    },
    include_notes_for_ai: {
      type: "boolean",
      description: "Inclure les notes pour l'IA",
      default: true,
    },
    include_allowed_actions: {
      type: "boolean",
      description: "Inclure les actions autorisées",
      default: true,
    },
  },
  additionalProperties: false,
};

export const queryRagInputSchema: JSONSchema = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Requête de recherche sémantique",
      minLength: 1,
    },
    project_path: {
      type: "string",
      description: "Chemin absolu vers le projet (auto-détecté si vide)",
    },
    scope: {
      type: "string",
      enum: ["project", "global"],
      description: "Scope de recherche",
      default: "project",
    },
    content_types: {
      type: "array",
      items: {
        type: "string",
        enum: ["code", "doc", "config", "other"],
      },
      description: "Types de contenu à inclure",
    },
    top_k: {
      type: "number",
      description: "Nombre maximum de résultats à retourner",
      default: 10,
      minimum: 1,
      maximum: 100,
    },
    threshold: {
      type: "number",
      description: "Seuil de similarité minimum (0.0-1.0)",
      default: 0.3,
      minimum: 0,
      maximum: 1,
    },
  },
  required: ["query"],
  additionalProperties: false,
};

export const activatedRagInputSchema: JSONSchema = {
  type: "object",
  properties: {
    mode: {
      type: "string",
      enum: ["full", "incremental", "watch", "analyze_only"],
      description: "Mode d'opération",
      default: "full",
    },
    project_path: {
      type: "string",
      description: "Chemin absolu vers le projet (auto-détecté si vide)",
    },
    file_patterns: {
      type: "array",
      items: { type: "string" },
      description: "Patterns de fichiers à inclure",
      default: ["**/*"],
    },
    enable_phase0: {
      type: "boolean",
      description: "Activer la Phase 0 (Workspace detection automatique)",
      default: true,
    },
  },
  additionalProperties: false,
};

export const cancelTaskInputSchema: JSONSchema = {
  type: "object",
  properties: {
    task_id: {
      type: "string",
      description: "ID de la tâche à annuler",
    },
    reason: {
      type: "string",
      description: "Raison de l'annulation (optionnel)",
      default: "Annulée par l'utilisateur",
    },
    force: {
      type: "boolean",
      description: "Forcer l'annulation même si la tâche est en cours d'exécution",
      default: false,
    },
  },
  required: ["task_id"],
  additionalProperties: false,
};

/**
 * Output schemas for MCP tools
 */
export const baseOutputSchema: JSONSchema = {
  type: "object",
  properties: {
    status: {
      type: "string",
      description: "Statut de l'opération",
    },
    message: {
      type: "string",
      description: "Message descriptif",
    },
    timestamp: {
      type: "string",
      format: "date-time",
      description: "Horodatage de l'opération",
    },
  },
  required: ["status", "timestamp"],
  additionalProperties: true,
};

/**
 * Tool schema mapping
 */
export const toolSchemas: Record<string, { input: JSONSchema; output: JSONSchema }> = {
  init_rag: {
    input: initRagInputSchema,
    output: baseOutputSchema,
  },
  get_status: {
    input: getStatusInputSchema,
    output: baseOutputSchema,
  },
  query_rag: {
    input: queryRagInputSchema,
    output: baseOutputSchema,
  },
  activated_rag: {
    input: activatedRagInputSchema,
    output: baseOutputSchema,
  },
  cancel_task: {
    input: cancelTaskInputSchema,
    output: baseOutputSchema,
  },
};

/**
 * MCP tool names
 */
export type ToolName = keyof typeof toolSchemas;

/**
 * Get input schema for a tool
 */
export function getInputSchema(toolName: string): JSONSchema | null {
  return toolSchemas[toolName]?.input || null;
}

/**
 * Get output schema for a tool
 */
export function getOutputSchema(toolName: string): JSONSchema | null {
  return toolSchemas[toolName]?.output || null;
}

/**
 * Basic JSON schema validator
 */
export function validateJson(data: any, schema: JSONSchema): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data) {
    errors.push("Data is null or undefined");
    return { valid: false, errors };
  }

  // Check type
  if (schema.type === "object") {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      errors.push(`Expected object, got ${typeof data}`);
      return { valid: false, errors };
    }

    // Check required properties
    if (schema.required) {
      for (const prop of schema.required) {
        if (!(prop in data)) {
          errors.push(`Missing required property: ${prop}`);
        }
      }
    }

    // Check properties
    if (schema.properties) {
      for (const [prop, propSchema] of Object.entries(schema.properties)) {
        if (prop in data) {
          const propValue = data[prop];
          const propResult = validateJson(propValue, propSchema);
          if (!propResult.valid) {
            errors.push(`Property '${prop}': ${propResult.errors.join(", ")}`);
          }
        }
      }
    }

    // Check additional properties
    if (schema.additionalProperties === false) {
      for (const prop of Object.keys(data)) {
        if (!schema.properties || !(prop in schema.properties)) {
          errors.push(`Additional property not allowed: ${prop}`);
        }
      }
    }
  } else if (schema.type === "string") {
    if (typeof data !== "string") {
      errors.push(`Expected string, got ${typeof data}`);
    }
    if (schema.minLength && data.length < schema.minLength) {
      errors.push(`String too short, minimum length: ${schema.minLength}`);
    }
    if (schema.enum && !schema.enum.includes(data)) {
      errors.push(`Value must be one of: ${schema.enum.join(", ")}`);
    }
  } else if (schema.type === "number") {
    if (typeof data !== "number") {
      errors.push(`Expected number, got ${typeof data}`);
    }
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push(`Number too small, minimum: ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push(`Number too large, maximum: ${schema.maximum}`);
    }
  } else if (schema.type === "boolean") {
    if (typeof data !== "boolean") {
      errors.push(`Expected boolean, got ${typeof data}`);
    }
  } else if (schema.type === "array") {
    if (!Array.isArray(data)) {
      errors.push(`Expected array, got ${typeof data}`);
    } else if (schema.items) {
      for (let i = 0; i < data.length; i++) {
        const itemResult = validateJson(data[i], schema.items);
        if (!itemResult.valid) {
          errors.push(`Array item ${i}: ${itemResult.errors.join(", ")}`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate tool input
 */
export function validateToolInput(toolName: string, input: any): { valid: boolean; errors: string[] } {
  const schema = getInputSchema(toolName);
  if (!schema) {
    return { valid: true, errors: [] }; // No schema = skip validation
  }
  return validateJson(input, schema);
}

/**
 * Validate tool output
 */
export function validateToolOutput(toolName: string, output: any): { valid: boolean; errors: string[] } {
  const schema = getOutputSchema(toolName);
  if (!schema) {
    return { valid: true, errors: [] }; // No schema = skip validation
  }
  return validateJson(output, schema);
}
