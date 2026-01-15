// src/core/mcp-schemas.ts
// Schémas JSON pour les outils MCP
// Définit les schémas d'entrée et de sortie pour chaque outil

import { JSONSchema } from './json-schema-validator.js';

/**
 * Schémas pour l'outil init_rag
 */
export const initRagInputSchema: JSONSchema = {
    type: 'object',
    properties: {
        project_path: {
            type: 'string',
            description: 'Chemin absolu vers le projet à initialiser',
            minLength: 1
        },
        mode: {
            type: 'string',
            enum: ['default', 'memory-only', 'full'],
            description: 'Mode d\'initialisation',
            default: 'default'
        },
        force: {
            type: 'boolean',
            description: 'Forcer l\'initialisation même si déjà initialisé',
            default: false
        },
        verbose: {
            type: 'boolean',
            description: 'Afficher des détails supplémentaires',
            default: false
        }
    },
    required: ['project_path'],
    additionalProperties: false
};

export const initRagOutputSchema: JSONSchema = {
    type: 'object',
    properties: {
        status: {
            type: 'string',
            enum: ['ok', 'error', 'already_initialized'],
            description: 'Statut de l\'initialisation'
        },
        message: {
            type: 'string',
            description: 'Message descriptif'
        },
        project_path: {
            type: 'string',
            description: 'Chemin du projet initialisé'
        },
        config_created: {
            type: 'boolean',
            description: 'Si la configuration a été créée'
        },
        db_created: {
            type: 'boolean',
            description: 'Si la base de données a été créée'
        },
        directories_created: {
            type: 'array',
            items: { type: 'string' },
            description: 'Répertoires créés'
        },
        timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Horodatage de l\'initialisation'
        }
    },
    required: ['status', 'message', 'project_path', 'timestamp'],
    additionalProperties: false
};

/**
 * Schémas pour l'outil activated_rag
 */
export const activatedRagInputSchema: JSONSchema = {
    type: 'object',
    properties: {
        mode: {
            type: 'string',
            enum: ['full', 'incremental', 'watch', 'analyze_only'],
            description: 'Mode d\'opération',
            default: 'full'
        },
        project_path: {
            type: 'string',
            description: 'Chemin absolu vers le projet (auto-détecté si vide)'
        },
        file_patterns: {
            type: 'array',
            items: { type: 'string' },
            description: 'Patterns de fichiers à inclure',
            default: ['**/*']
        },
        enable_phase0: {
            type: 'boolean',
            description: 'Activer la Phase 0 (Workspace detection automatique)',
            default: true
        },
        enable_watcher: {
            type: 'boolean',
            description: 'Activer le file watcher en temps réel',
            default: false
        },
        enable_llm_enrichment: {
            type: 'boolean',
            description: 'Activer l\'enrichissement LLM optionnel (Phase 0.3)',
            default: false
        },
        content_types: {
            type: 'array',
            items: {
                type: 'string',
                enum: ['code', 'doc', 'config', 'other']
            },
            description: 'Types de contenu à inclure'
        },
        languages: {
            type: 'array',
            items: { type: 'string' },
            description: 'Langages à inclure (ex: [\'typescript\', \'python\'])'
        },
        embedding_models: {
            type: 'object',
            description: 'Modèles d\'embeddings par type de contenu',
            properties: {
                code: { type: 'string' },
                text: { type: 'string' },
                config: { type: 'string' }
            },
            additionalProperties: false
        },
        chunking_strategy: {
            type: 'string',
            enum: ['logical', 'fixed', 'ai_enhanced'],
            description: 'Stratégie de chunking',
            default: 'logical'
        },
        max_chunk_size: {
            type: 'number',
            description: 'Taille maximale des chunks (tokens)',
            default: 1000,
            minimum: 100,
            maximum: 10000
        },
        metadata_overrides: {
            type: 'object',
            description: 'Surcharges de métadonnées',
            additionalProperties: true
        }
    },
    additionalProperties: false
};

export const activatedRagOutputSchema: JSONSchema = {
    type: 'object',
    properties: {
        status: {
            type: 'string',
            enum: ['ok', 'error', 'partial'],
            description: 'Statut de l\'exécution'
        },
        message: {
            type: 'string',
            description: 'Message descriptif'
        },
        project_path: {
            type: 'string',
            description: 'Chemin du projet traité'
        },
        mode: {
            type: 'string',
            description: 'Mode d\'exécution utilisé'
        },
        stats: {
            type: 'object',
            description: 'Statistiques d\'exécution',
            properties: {
                total_files: { type: 'number' },
                processed_files: { type: 'number' },
                chunks_created: { type: 'number' },
                errors: { type: 'number' },
                ignored_files: { type: 'number' },
                processing_time_ms: { type: 'number' }
            },
            additionalProperties: false
        },
        phases: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    status: { type: 'string' },
                    duration_ms: { type: 'number' },
                    details: { type: 'object' }
                },
                required: ['name', 'status']
            },
            description: 'Détails par phase d\'exécution'
        },
        timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Horodatage de fin d\'exécution'
        }
    },
    required: ['status', 'message', 'project_path', 'timestamp'],
    additionalProperties: false
};

/**
 * Schémas pour l'outil manage_projects
 */
export const manageProjectsInputSchema: JSONSchema = {
    type: 'object',
    properties: {
        action: {
            type: 'string',
            enum: ['list', 'stats'],
            description: 'Action à effectuer',
            default: 'list'
        },
        project_path: {
            type: 'string',
            description: 'Chemin du projet pour les statistiques (requis pour \'stats\')'
        }
    },
    additionalProperties: false
};

export const manageProjectsOutputSchema: JSONSchema = {
    type: 'object',
    properties: {
        status: {
            type: 'string',
            enum: ['ok', 'error'],
            description: 'Statut de l\'opération'
        },
        message: {
            type: 'string',
            description: 'Message descriptif'
        },
        action: {
            type: 'string',
            description: 'Action effectuée'
        },
        data: {
            type: 'object',
            description: 'Données de résultat',
            properties: {
                projects: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            path: { type: 'string' },
                            initialized: { type: 'boolean' },
                            indexed_at: { type: 'string', format: 'date-time' },
                            total_files: { type: 'number' },
                            total_chunks: { type: 'number' },
                            last_updated: { type: 'string', format: 'date-time' }
                        },
                        required: ['path', 'initialized']
                    }
                },
                stats: {
                    type: 'object',
                    description: 'Statistiques du projet (si action=stats)',
                    additionalProperties: true
                }
            },
            additionalProperties: false
        },
        timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Horodatage de l\'opération'
        }
    },
    required: ['status', 'message', 'action', 'timestamp'],
    additionalProperties: false
};

/**
 * Schémas pour l'outil get_status
 */
export const getStatusInputSchema: JSONSchema = {
    type: 'object',
    properties: {
        scope: {
            type: 'string',
            enum: ["global", "project", "task"],
            description: "Scope du statut à récupérer",
            default: "global"
        },
        project_id: {
            type: 'string',
            description: "ID du projet (requis si scope=project)"
        },
        task_id: {
            type: 'string',
            description: "ID de la tâche (requis si scope=task)"
        },
        include_notes_for_ai: {
            type: 'boolean',
            description: "Inclure les notes pour l'IA",
            default: true
        },
        include_allowed_actions: {
            type: 'boolean',
            description: "Inclure les actions autorisées",
            default: true
        }
    },
    additionalProperties: false
};

export const getStatusOutputSchema: JSONSchema = {
    type: 'object',
    properties: {
        status: {
            type: 'string',
            enum: ['ok', 'error'],
            description: 'Statut de la requête'
        },
        scope: {
            type: 'string',
            enum: ["global", "project", "task"],
            description: "Scope du statut récupéré"
        },
        data: {
            type: 'object',
            description: 'Données de statut',
            additionalProperties: true
        },
        notes_for_ai: {
            type: 'array',
            items: { type: 'string' },
            description: 'Notes pour l\'IA'
        },
        allowed_actions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Actions autorisées'
        },
        required_action: {
            type: 'string',
            description: 'Action requise pour continuer'
        },
        timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Horodatage de la requête'
        }
    },
    required: ['status', 'scope', 'timestamp'],
    additionalProperties: false
};

/**
 * Schéma d'erreur standard pour tous les outils
 */
export const errorOutputSchema: JSONSchema = {
    type: 'object',
    properties: {
        status: {
            type: 'string',
            enum: ['error'],
            description: 'Statut d\'erreur'
        },
        message: {
            type: 'string',
            description: 'Message d\'erreur'
        },
        error_type: {
            type: 'string',
            description: 'Type d\'erreur'
        },
        error_details: {
            type: 'object',
            description: 'Détails de l\'erreur',
            additionalProperties: true
        },
        timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Horodatage de l\'erreur'
        }
    },
    required: ['status', 'message', 'timestamp'],
    additionalProperties: false
};

/**
 * Mappage des outils vers leurs schémas
 */
export const toolSchemas = {
    init_rag: {
        input: initRagInputSchema,
        output: initRagOutputSchema
    },
    activated_rag: {
        input: activatedRagInputSchema,
        output: activatedRagOutputSchema
    },
    manage_projects: {
        input: manageProjectsInputSchema,
        output: manageProjectsOutputSchema
    },
    get_status: {
        input: getStatusInputSchema,
        output: getStatusOutputSchema
    }
};

/**
 * Type pour les noms d'outils
 */
export type ToolName = keyof typeof toolSchemas;

/**
 * Obtient le schéma d'entrée pour un outil
 */
export function getInputSchema(toolName: string): JSONSchema | null {
    return toolSchemas[toolName as ToolName]?.input || null;
}

/**
 * Obtient le schéma de sortie pour un outil
 */
export function getOutputSchema(toolName: string): JSONSchema | null {
    return toolSchemas[toolName as ToolName]?.output || null;
}

/**
 * Valide l'entrée d'un outil
 */
export function validateToolInput(toolName: string, input: any): { valid: boolean; errors: string[] } {
    const schema = getInputSchema(toolName);
    if (!schema) {
        return { valid: false, errors: [`No schema found for tool: ${toolName}`] };
    }

    // Pour l'instant, retourner une validation simple
    // TODO: Intégrer avec JSONSchemaValidator
    return { valid: true, errors: [] };
}

/**
 * Valide la sortie d'un outil
 */
export function validateToolOutput(toolName: string, output: any): { valid: boolean; errors: string[] } {
    const schema = getOutputSchema(toolName);
    if (!schema) {
        return { valid: false, errors: [`No schema found for tool: ${toolName}`] };
    }

    // Pour l'instant, retourner une validation simple
    // TODO: Intégrer avec JSONSchemaValidator
    return { valid: true, errors: [] };
}
