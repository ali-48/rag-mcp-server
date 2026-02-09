/**
 * Schémas JSON stricts pour les événements VS Code
 * Conformes aux règles absolues RAG MCP Server
 *
 * Règles appliquées :
 * - R3 : JSON strict (pas d'icônes dans JSON métier)
 * - R4 : Architecture RAG standard
 * - R16 : JSON MCP unique par stdout
 * - R17 : Séparation JSON métier / logs
 */

import { JSONSchema } from './json-schemas';

/**
 * Schéma de base pour tous les événements VS Code
 */
export const baseEventSchema: JSONSchema = {
  type: "object",
  properties: {
    source: {
      type: "string",
      enum: ["vscode"],
      description: "Source de l'événement (toujours 'vscode')",
      default: "vscode"
    },
    type: {
      type: "string",
      description: "Type d'événement",
      enum: ["file_save", "diagnostic", "workspace", "error", "build", "test"]
    },
    timestamp: {
      type: "string",
      format: "date-time",
      description: "Horodatage ISO-8601 de l'événement"
    },
    project_id: {
      type: "string",
      description: "ID unique du projet (auto-généré)",
      minLength: 1
    },
    file: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Chemin relatif du fichier",
          minLength: 1
        },
        language: {
          type: "string",
          description: "Langage du fichier (ex: 'typescript', 'python')",
          minLength: 1
        },
        hash: {
          type: "string",
          description: "Hash SHA-256 du contenu du fichier",
          pattern: "^[a-f0-9]{64}$"
        }
      },
      required: ["path", "hash"],
      additionalProperties: false
    },
    payload: {
      type: "object",
      description: "Contenu spécifique à l'événement"
    }
  },
  required: ["source", "type", "timestamp", "project_id", "payload"],
  additionalProperties: false
};

/**
 * Événement : Sauvegarde de fichier (onFileSave)
 */
export const fileSaveEventSchema: JSONSchema = {
  type: "object",
  properties: {
    source: baseEventSchema.properties!.source,
    type: {
      type: "string",
      enum: ["file_save"],
      description: "Type d'événement : sauvegarde de fichier"
    },
    timestamp: baseEventSchema.properties!.timestamp,
    project_id: baseEventSchema.properties!.project_id,
    file: baseEventSchema.properties!.file,
    payload: {
      type: "object",
      properties: {
        content_preview: {
          type: "string",
          description: "Aperçu du contenu (premiers 1000 caractères)",
          maxLength: 1000
        },
        line_count: {
          type: "number",
          description: "Nombre total de lignes dans le fichier",
          minimum: 1
        },
        symbol_count: {
          type: "number",
          description: "Nombre de symboles (fonctions, classes, etc.)",
          minimum: 0
        },
        diagnostics: {
          type: "array",
          description: "Diagnostics actifs sur le fichier",
          items: {
            type: "object",
            properties: {
              severity: {
                type: "string",
                enum: ["error", "warning", "info", "hint"],
                description: "Sévérité du diagnostic"
              },
              message: {
                type: "string",
                description: "Message du diagnostic",
                minLength: 1
              },
              line: {
                type: "number",
                description: "Ligne du diagnostic (1-indexed)",
                minimum: 1
              },
              column: {
                type: "number",
                description: "Colonne du diagnostic (1-indexed)",
                minimum: 1
              }
            },
            required: ["severity", "message", "line"],
            additionalProperties: false
          }
        },
        has_errors: {
          type: "boolean",
          description: "Indique si le fichier contient des erreurs"
        },
        has_warnings: {
          type: "boolean",
          description: "Indique si le fichier contient des avertissements"
        }
      },
      required: ["content_preview", "line_count", "has_errors", "has_warnings"],
      additionalProperties: false
    }
  },
  required: baseEventSchema.required!,
  additionalProperties: false
};

/**
 * Événement : Diagnostic (erreurs, avertissements)
 */
export const diagnosticEventSchema: JSONSchema = {
  type: "object",
  properties: {
    source: baseEventSchema.properties!.source,
    type: {
      type: "string",
      enum: ["diagnostic"],
      description: "Type d'événement : diagnostic"
    },
    timestamp: baseEventSchema.properties!.timestamp,
    project_id: baseEventSchema.properties!.project_id,
    file: baseEventSchema.properties!.file,
    payload: {
      type: "object",
      properties: {
        diagnostic_type: {
          type: "string",
          enum: ["error", "warning", "info", "hint"],
          description: "Type de diagnostic"
        },
        message: {
          type: "string",
          description: "Message du diagnostic",
          minLength: 1
        },
        code: {
          type: "string",
          description: "Code d'erreur (ex: 'TS2322')"
        },
        source: {
          type: "string",
          description: "Source du diagnostic (ex: 'typescript', 'eslint')"
        },
        line: {
          type: "number",
          description: "Ligne du diagnostic",
          minimum: 1
        },
        column: {
          type: "number",
          description: "Colonne du diagnostic",
          minimum: 1
        },
        is_new: {
          type: "boolean",
          description: "Indique si c'est un nouveau diagnostic"
        },
        was_fixed: {
          type: "boolean",
          description: "Indique si un diagnostic précédent a été corrigé"
        }
      },
      required: ["diagnostic_type", "message", "line", "is_new"],
      additionalProperties: false
    }
  },
  required: baseEventSchema.required!,
  additionalProperties: false
};

/**
 * Événement : Changement workspace
 */
export const workspaceEventSchema: JSONSchema = {
  type: "object",
  properties: {
    source: baseEventSchema.properties!.source,
    type: {
      type: "string",
      enum: ["workspace"],
      description: "Type d'événement : changement workspace"
    },
    timestamp: baseEventSchema.properties!.timestamp,
    project_id: baseEventSchema.properties!.project_id,
    file: {
      ...baseEventSchema.properties!.file,
      required: ["path"]
    },
    payload: {
      type: "object",
      properties: {
        change_type: {
          type: "string",
          enum: ["created", "deleted", "renamed", "moved"],
          description: "Type de changement"
        },
        old_path: {
          type: "string",
          description: "Ancien chemin (pour rename/move)"
        },
        file_type: {
          type: "string",
          description: "Type de fichier (extension)"
        },
        is_config_file: {
          type: "boolean",
          description: "Indique si c'est un fichier de configuration"
        },
        config_files_affected: {
          type: "array",
          description: "Fichiers de configuration affectés",
          items: { type: "string" }
        }
      },
      required: ["change_type"],
      additionalProperties: false
    }
  },
  required: baseEventSchema.required!,
  additionalProperties: false
};

/**
 * Événement : Erreur système
 */
export const errorEventSchema: JSONSchema = {
  type: "object",
  properties: {
    source: baseEventSchema.properties!.source,
    type: {
      type: "string",
      enum: ["error"],
      description: "Type d'événement : erreur système"
    },
    timestamp: baseEventSchema.properties!.timestamp,
    project_id: baseEventSchema.properties!.project_id,
    file: baseEventSchema.properties!.file,
    payload: {
      type: "object",
      properties: {
        error_type: {
          type: "string",
          enum: ["build", "test", "runtime", "extension", "system"],
          description: "Type d'erreur"
        },
        error_message: {
          type: "string",
          description: "Message d'erreur",
          minLength: 1
        },
        stack_trace: {
          type: "string",
          description: "Stack trace (optionnel)"
        },
        exit_code: {
          type: "number",
          description: "Code de sortie (pour build/test)"
        },
        command: {
          type: "string",
          description: "Commande qui a échoué"
        },
        duration_ms: {
          type: "number",
          description: "Durée avant échec (millisecondes)",
          minimum: 0
        },
        retry_count: {
          type: "number",
          description: "Nombre de tentatives",
          minimum: 0
        }
      },
      required: ["error_type", "error_message"],
      additionalProperties: false
    }
  },
  required: baseEventSchema.required!,
  additionalProperties: false
};

/**
 * Mapping des schémas par type d'événement
 */
export const eventSchemas: Record<string, JSONSchema> = {
  file_save: fileSaveEventSchema,
  diagnostic: diagnosticEventSchema,
  workspace: workspaceEventSchema,
  error: errorEventSchema
};

/**
 * Obtenir le schéma pour un type d'événement
 */
export function getEventSchema(eventType: string): JSONSchema | null {
  return eventSchemas[eventType] || null;
}

/**
 * Valider un événement contre son schéma
 */
export function validateEvent(event: any, eventType: string): { valid: boolean; errors: string[] } {
  const schema = getEventSchema(eventType);
  if (!schema) {
    return { valid: false, errors: [`Schéma inconnu pour le type d'événement: ${eventType}`] };
  }

  // Utiliser le validateur Ajv
  const { validateJson } = require('./validator');
  return validateJson(event, schema);
}

/**
 * Générer un ID de projet unique basé sur le workspace
 */
export function generateProjectId(workspacePath: string): string {
  // Utiliser un hash simple du chemin workspace
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update(workspacePath).digest('hex');
  return `proj_${hash.substring(0, 16)}`;
}

/**
 * Interface TypeScript pour les événements (générée automatiquement)
 */
export interface BaseEvent {
  source: "vscode";
  type: string;
  timestamp: string;
  project_id: string;
  file?: {
    path: string;
    language?: string;
    hash: string;
  };
  payload: any;
}

export interface FileSaveEvent extends BaseEvent {
  type: "file_save";
  payload: {
    content_preview: string;
    line_count: number;
    symbol_count?: number;
    diagnostics?: Array<{
      severity: "error" | "warning" | "info" | "hint";
      message: string;
      line: number;
      column?: number;
    }>;
    has_errors: boolean;
    has_warnings: boolean;
  };
}

export interface DiagnosticEvent extends BaseEvent {
  type: "diagnostic";
  payload: {
    diagnostic_type: "error" | "warning" | "info" | "hint";
    message: string;
    code?: string;
    source?: string;
    line: number;
    column?: number;
    is_new: boolean;
    was_fixed?: boolean;
  };
}

export interface WorkspaceEvent extends BaseEvent {
  type: "workspace";
  payload: {
    change_type: "created" | "deleted" | "renamed" | "moved";
    old_path?: string;
    file_type?: string;
    is_config_file?: boolean;
    config_files_affected?: string[];
  };
}

export interface ErrorEvent extends BaseEvent {
  type: "error";
  payload: {
    error_type: "build" | "test" | "runtime" | "extension" | "system";
    error_message: string;
    stack_trace?: string;
    exit_code?: number;
    command?: string;
    duration_ms?: number;
    retry_count?: number;
  };
}

export type VSCodeEvent = FileSaveEvent | DiagnosticEvent | WorkspaceEvent | ErrorEvent;
