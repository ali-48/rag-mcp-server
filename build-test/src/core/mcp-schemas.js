// src/core/mcp-schemas.ts
// Schémas JSON pour les outils MCP
// Définit les schémas d'entrée et de sortie pour chaque outil
/**
 * Schémas pour l'outil init_rag
 */
export const initRagInputSchema = {
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
export const initRagOutputSchema = {
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
export const activatedRagInputSchema = {
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
export const activatedRagOutputSchema = {
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
export const manageProjectsInputSchema = {
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
export const manageProjectsOutputSchema = {
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
export const getStatusInputSchema = {
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
export const getStatusOutputSchema = {
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
 * Schémas pour l'outil query_rag
 */
export const queryRagInputSchema = {
    type: 'object',
    properties: {
        query: {
            type: 'string',
            description: 'Requête de recherche sémantique',
            minLength: 1
        },
        project_path: {
            type: 'string',
            description: 'Chemin absolu vers le projet (auto-détecté si vide)'
        },
        scope: {
            type: 'string',
            enum: ['project', 'global'],
            description: 'Scope de recherche',
            default: 'project'
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
        file_extensions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Extensions de fichier à inclure (ex: [\'.ts\', \'.py\'])'
        },
        roles: {
            type: 'array',
            items: { type: 'string' },
            description: 'Rôles à inclure (ex: [\'core\', \'example\', \'template\'])'
        },
        top_k: {
            type: 'number',
            description: 'Nombre maximum de résultats à retourner',
            default: 10,
            minimum: 1,
            maximum: 100
        },
        threshold: {
            type: 'number',
            description: 'Seuil de similarité minimum (0.0-1.0)',
            default: 0.3,
            minimum: 0,
            maximum: 1
        },
        dynamic_threshold: {
            type: 'boolean',
            description: 'Activer le seuil dynamique basé sur la distribution des scores',
            default: false
        },
        search_mode: {
            type: 'string',
            enum: ['semantic', 'hybrid', 'text'],
            description: 'Mode de recherche',
            default: 'semantic'
        },
        text_query: {
            type: 'string',
            description: 'Requête textuelle pour la recherche hybride'
        },
        semantic_weight: {
            type: 'number',
            description: 'Poids pour la recherche sémantique (0.0-1.0)',
            default: 0.7,
            minimum: 0,
            maximum: 1
        },
        text_weight: {
            type: 'number',
            description: 'Poids pour la recherche textuelle (0.0-1.0)',
            default: 0.3,
            minimum: 0,
            maximum: 1
        },
        enable_reranking: {
            type: 'boolean',
            description: 'Activer le re-ranking basé sur les métadonnées',
            default: false
        },
        prefer_recent: {
            type: 'boolean',
            description: 'Préférer les fichiers récents dans le re-ranking',
            default: true
        },
        prefer_smaller_files: {
            type: 'boolean',
            description: 'Préférer les fichiers plus petits dans le re-ranking',
            default: true
        },
        priority_content_types: {
            type: 'array',
            items: { type: 'string' },
            description: 'Types de contenu prioritaires pour le re-ranking',
            default: ['code', 'doc']
        },
        format_output: {
            type: 'boolean',
            description: 'Formater la sortie pour une lecture humaine',
            default: true
        },
        include_metadata: {
            type: 'boolean',
            description: 'Inclure les métadonnées complètes dans la sortie',
            default: false
        },
        include_content: {
            type: 'boolean',
            description: 'Inclure le contenu complet dans la sortie',
            default: true
        },
        max_content_length: {
            type: 'number',
            description: 'Longueur maximale du contenu à inclure (caractères)',
            default: 500,
            minimum: 0,
            maximum: 10000
        },
        timeout_seconds: {
            type: 'number',
            description: 'Timeout en secondes pour la recherche (exception - conservé pour query_rag)',
            default: 30,
            minimum: 1,
            maximum: 300
        }
    },
    required: ['query'],
    additionalProperties: false
};
export const queryRagOutputSchema = {
    type: 'object',
    properties: {
        status: {
            type: 'string',
            enum: ['ok', 'error'],
            description: 'Statut de la recherche'
        },
        message: {
            type: 'string',
            description: 'Message descriptif'
        },
        query: {
            type: 'string',
            description: 'Requête de recherche'
        },
        project_path: {
            type: 'string',
            description: 'Chemin du projet recherché'
        },
        duration_seconds: {
            type: 'number',
            description: 'Durée d\'exécution en secondes'
        },
        results: {
            type: 'array',
            description: 'Résultats de la recherche',
            items: {
                type: 'object',
                properties: {
                    filePath: { type: 'string' },
                    score: { type: 'number' },
                    content: { type: 'string' },
                    metadata: { type: 'object' }
                },
                required: ['filePath', 'score']
            }
        },
        stats: {
            type: 'object',
            description: 'Statistiques de la recherche',
            properties: {
                total_results: { type: 'number' },
                execution_time_ms: { type: 'number' },
                projects_scanned: { type: 'number' }
            },
            additionalProperties: false
        },
        config_used: {
            type: 'object',
            description: 'Configuration utilisée',
            properties: {
                scope: { type: 'string' },
                top_k: { type: 'number' },
                threshold: { type: 'number' },
                search_mode: { type: 'string' },
                enable_reranking: { type: 'boolean' }
            },
            additionalProperties: false
        },
        next_steps: {
            type: 'array',
            items: { type: 'string' },
            description: 'Étapes suivantes recommandées'
        },
        timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Horodatage de la recherche'
        }
    },
    required: ['status', 'message', 'query', 'timestamp'],
    additionalProperties: false
};
/**
 * Schémas pour l'outil cancel_task
 */
export const cancelTaskInputSchema = {
    type: 'object',
    properties: {
        task_id: {
            type: 'string',
            description: 'ID de la tâche à annuler (obtenu via index_rag ou activated_rag)'
        },
        reason: {
            type: 'string',
            description: 'Raison de l\'annulation (optionnel)',
            default: 'Annulée par l\'utilisateur'
        },
        force: {
            type: 'boolean',
            description: 'Forcer l\'annulation même si la tâche est en cours d\'exécution',
            default: false
        }
    },
    required: ['task_id'],
    additionalProperties: false
};
export const cancelTaskOutputSchema = {
    type: 'object',
    properties: {
        success: {
            type: 'boolean',
            description: 'Succès de l\'annulation'
        },
        task_id: {
            type: 'string',
            description: 'ID de la tâche'
        },
        cancelled: {
            type: 'boolean',
            description: 'Si la tâche a été annulée'
        },
        cancellation_method: {
            type: 'string',
            description: 'Méthode d\'annulation utilisée'
        },
        reason: {
            type: 'string',
            description: 'Raison de l\'annulation'
        },
        final_status: {
            type: 'object',
            description: 'Statut final de la tâche',
            properties: {
                state: { type: 'string' },
                step: { type: 'string' },
                progress: { type: 'number' },
                files_processed: { type: 'number' },
                files_total: { type: 'number' }
            },
            additionalProperties: false
        },
        previous_state: {
            type: 'string',
            description: 'État précédent de la tâche'
        },
        duration_ms: {
            type: 'number',
            description: 'Durée de l\'opération en millisecondes'
        },
        timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Horodatage de l\'annulation'
        },
        recommendations: {
            type: 'array',
            items: { type: 'string' },
            description: 'Recommandations pour les étapes suivantes'
        }
    },
    required: ['success', 'task_id', 'cancelled', 'timestamp'],
    additionalProperties: false
};
/**
 * Schémas pour l'outil list_tasks
 */
export const listTasksInputSchema = {
    type: 'object',
    properties: {
        project_path: {
            type: 'string',
            description: 'Chemin du projet (optionnel, liste toutes les tâches si vide)'
        },
        state_filter: {
            type: 'string',
            enum: ['all', 'queued', 'running', 'completed', 'failed', 'cancelled'],
            description: 'Filtrer par état',
            default: 'all'
        },
        limit: {
            type: 'number',
            description: 'Nombre maximum de tâches à retourner',
            default: 50,
            minimum: 1,
            maximum: 1000
        },
        include_stats: {
            type: 'boolean',
            description: 'Inclure les statistiques globales',
            default: true
        }
    },
    additionalProperties: false
};
export const listTasksOutputSchema = {
    type: 'object',
    properties: {
        success: {
            type: 'boolean',
            description: 'Succès de l\'opération'
        },
        tasks: {
            type: 'array',
            description: 'Liste des tâches',
            items: {
                type: 'object',
                properties: {
                    task_id: { type: 'string' },
                    project_path: { type: 'string' },
                    state: { type: 'string' },
                    step: { type: 'string' },
                    progress: { type: 'number' },
                    files_processed: { type: 'number' },
                    files_total: { type: 'number' },
                    started_at: { type: 'string', format: 'date-time' },
                    updated_at: { type: 'string', format: 'date-time' },
                    completed_at: { type: 'string', format: 'date-time' }
                },
                required: ['task_id', 'project_path', 'state']
            }
        },
        total_tasks: {
            type: 'number',
            description: 'Nombre total de tâches retournées'
        },
        stats: {
            type: 'object',
            description: 'Statistiques globales',
            properties: {
                progress_tracker: {
                    type: 'object',
                    properties: {
                        total_tasks: { type: 'number' },
                        by_state: { type: 'object' },
                        memory_usage_kb: { type: 'number' }
                    },
                    additionalProperties: false
                },
                task_queue: {
                    type: 'object',
                    properties: {
                        total_projects: { type: 'number' },
                        total_queued_tasks: { type: 'number' },
                        total_running_tasks: { type: 'number' }
                    },
                    additionalProperties: false
                }
            },
            additionalProperties: false
        },
        timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Horodatage de la requête'
        },
        duration_ms: {
            type: 'number',
            description: 'Durée de l\'opération en millisecondes'
        }
    },
    required: ['success', 'tasks', 'total_tasks', 'timestamp'],
    additionalProperties: false
};
/**
 * Schéma d'erreur standard pour tous les outils
 */
export const errorOutputSchema = {
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
    },
    query_rag: {
        input: queryRagInputSchema,
        output: queryRagOutputSchema
    },
    cancel_task: {
        input: cancelTaskInputSchema,
        output: cancelTaskOutputSchema
    },
    list_tasks: {
        input: listTasksInputSchema,
        output: listTasksOutputSchema
    }
};
/**
 * Obtient le schéma d'entrée pour un outil
 */
export function getInputSchema(toolName) {
    return toolSchemas[toolName]?.input || null;
}
/**
 * Obtient le schéma de sortie pour un outil
 */
export function getOutputSchema(toolName) {
    return toolSchemas[toolName]?.output || null;
}
/**
 * Valide l'entrée d'un outil
 */
export function validateToolInput(toolName, input) {
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
export function validateToolOutput(toolName, output) {
    const schema = getOutputSchema(toolName);
    if (!schema) {
        return { valid: false, errors: [`No schema found for tool: ${toolName}`] };
    }
    // Pour l'instant, retourner une validation simple
    // TODO: Intégrer avec JSONSchemaValidator
    return { valid: true, errors: [] };
}
//# sourceMappingURL=mcp-schemas.js.map