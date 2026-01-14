// src/config/json-schemas.ts
// Schémas JSON pour la validation des configurations RAG
// Version: v1.0.0
/**
 * Schéma JSON pour rag-config.json
 */
export const RAG_CONFIG_SCHEMA = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    title: 'RAG Configuration Schema',
    description: 'Configuration du serveur RAG MCP',
    required: ['version', 'system', 'defaults', 'embedding_models'],
    properties: {
        version: {
            type: 'string',
            pattern: '^\\d+\\.\\d+\\.\\d+$',
            description: 'Version de la configuration'
        },
        description: {
            type: 'string',
            description: 'Description de la configuration'
        },
        last_updated: {
            type: 'string',
            description: 'Date de dernière mise à jour'
        },
        system: {
            type: 'object',
            required: ['mode', 'exposed_tools', 'vector_store'],
            properties: {
                mode: {
                    type: 'string',
                    enum: ['memory-only', 'full', 'default'],
                    description: 'Mode de fonctionnement'
                },
                exposed_tools: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Outils MCP exposés'
                },
                legacy_tools: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Outils legacy maintenus pour compatibilité'
                },
                legacy_mode: {
                    type: 'boolean',
                    description: 'Activer le mode legacy'
                },
                auto_detect_vscode: {
                    type: 'boolean',
                    description: 'Détection automatique VS Code'
                },
                auto_watch_files: {
                    type: 'boolean',
                    description: 'Surveillance automatique des fichiers'
                },
                auto_index_changes: {
                    type: 'boolean',
                    description: 'Indexation automatique des changements'
                },
                vector_store: {
                    type: 'object',
                    required: ['backend'],
                    properties: {
                        backend: {
                            type: 'string',
                            enum: ['sqlite', 'postgresql', 'memory'],
                            description: 'Backend du vector store'
                        },
                        path: {
                            type: 'string',
                            description: 'Chemin du fichier SQLite'
                        },
                        host: {
                            type: 'string',
                            description: 'Hôte PostgreSQL'
                        },
                        port: {
                            type: 'number',
                            minimum: 1,
                            maximum: 65535,
                            description: 'Port PostgreSQL'
                        },
                        database: {
                            type: 'string',
                            description: 'Base de données PostgreSQL'
                        },
                        user: {
                            type: 'string',
                            description: 'Utilisateur PostgreSQL'
                        },
                        password: {
                            type: 'string',
                            description: 'Mot de passe PostgreSQL'
                        }
                    }
                }
            }
        },
        defaults: {
            type: 'object',
            required: ['embedding_provider', 'chunk_size', 'chunk_overlap'],
            properties: {
                embedding_provider: {
                    type: 'string',
                    description: 'Fournisseur d\'embeddings par défaut'
                },
                embedding_model: {
                    type: 'string',
                    description: 'Modèle d\'embedding par défaut'
                },
                chunk_size: {
                    type: 'number',
                    minimum: 100,
                    maximum: 10000,
                    description: 'Taille des chunks'
                },
                chunk_overlap: {
                    type: 'number',
                    minimum: 0,
                    maximum: 1000,
                    description: 'Overlap des chunks'
                },
                file_patterns: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Patterns de fichiers'
                },
                recursive: {
                    type: 'boolean',
                    description: 'Recherche récursive'
                },
                search_limit: {
                    type: 'number',
                    minimum: 1,
                    maximum: 100,
                    description: 'Limite de recherche'
                },
                search_threshold: {
                    type: 'number',
                    minimum: 0,
                    maximum: 1,
                    description: 'Seuil de similarité'
                },
                format_output: {
                    type: 'boolean',
                    description: 'Formater la sortie'
                }
            }
        },
        embedding_models: {
            type: 'object',
            required: ['by_content_type', 'providers'],
            properties: {
                by_content_type: {
                    type: 'object',
                    properties: {
                        code: {
                            type: 'object',
                            required: ['provider', 'model', 'dimension'],
                            properties: {
                                provider: { type: 'string' },
                                model: { type: 'string' },
                                dimension: { type: 'number' },
                                description: { type: 'string' }
                            }
                        },
                        text: {
                            type: 'object',
                            required: ['provider', 'model', 'dimension'],
                            properties: {
                                provider: { type: 'string' },
                                model: { type: 'string' },
                                dimension: { type: 'number' },
                                description: { type: 'string' }
                            }
                        },
                        config: {
                            type: 'object',
                            required: ['provider', 'model', 'dimension'],
                            properties: {
                                provider: { type: 'string' },
                                model: { type: 'string' },
                                dimension: { type: 'number' },
                                description: { type: 'string' }
                            }
                        },
                        fallback: {
                            type: 'object',
                            required: ['provider', 'model', 'dimension'],
                            properties: {
                                provider: { type: 'string' },
                                model: { type: 'string' },
                                dimension: { type: 'number' },
                                description: { type: 'string' }
                            }
                        }
                    }
                },
                providers: {
                    type: 'object',
                    properties: {
                        fake: {
                            type: 'object',
                            required: ['description', 'models'],
                            properties: {
                                description: { type: 'string' },
                                models: { type: 'array', items: { type: 'string' } },
                                requires_ollama: { type: 'boolean' }
                            }
                        },
                        ollama: {
                            type: 'object',
                            required: ['description', 'models', 'endpoint'],
                            properties: {
                                description: { type: 'string' },
                                models: { type: 'array', items: { type: 'string' } },
                                endpoint: { type: 'string' },
                                requires_ollama: { type: 'boolean' },
                                default_model: { type: 'string' }
                            }
                        },
                        sentence_transformers: {
                            type: 'object',
                            required: ['description', 'models'],
                            properties: {
                                description: { type: 'string' },
                                models: { type: 'array', items: { type: 'string' } },
                                requires_ollama: { type: 'boolean' },
                                default_model: { type: 'string' }
                            }
                        }
                    }
                }
            }
        },
        phase0: {
            type: 'object',
            properties: {
                enabled: { type: 'boolean' },
                description: { type: 'string' },
                components: {
                    type: 'object',
                    properties: {
                        workspace_detector: {
                            type: 'object',
                            properties: {
                                enabled: { type: 'boolean' },
                                detect_vscode: { type: 'boolean' },
                                detect_git: { type: 'boolean' },
                                auto_select_project: { type: 'boolean' }
                            }
                        },
                        file_watcher: {
                            type: 'object',
                            properties: {
                                enabled: { type: 'boolean' },
                                library: { type: 'string' },
                                watch_options: { type: 'object' },
                                debounce_ms: { type: 'number' },
                                max_file_size_mb: { type: 'number' }
                            }
                        },
                        tree_sitter: {
                            type: 'object',
                            properties: {
                                enabled: { type: 'boolean' },
                                languages: { type: 'array', items: { type: 'string' } },
                                max_file_size_mb: { type: 'number' },
                                timeout_ms: { type: 'number' },
                                fallback_to_regex: { type: 'boolean' }
                            }
                        },
                        chunking: {
                            type: 'object',
                            properties: {
                                strategy: { type: 'string' },
                                max_chunk_size: { type: 'number' },
                                chunk_overlap: { type: 'number' },
                                rules: { type: 'object' }
                            }
                        },
                        llm_enrichment: {
                            type: 'object',
                            properties: {
                                enabled: { type: 'boolean' },
                                provider: { type: 'string' },
                                model: { type: 'string' },
                                temperature: { type: 'number' },
                                max_tokens: { type: 'number' },
                                timeout_ms: { type: 'number' },
                                batch_size: { type: 'number' },
                                features: { type: 'array', items: { type: 'string' } },
                                cache_enabled: { type: 'boolean' },
                                cache_ttl_seconds: { type: 'number' }
                            }
                        }
                    }
                },
                pipeline: {
                    type: 'object',
                    properties: {
                        auto_start: { type: 'boolean' },
                        concurrent_workers: { type: 'number' },
                        max_queue_size: { type: 'number' },
                        retry_attempts: { type: 'number' },
                        retry_delay_ms: { type: 'number' }
                    }
                }
            }
        },
        activated_rag: {
            type: 'object',
            properties: {
                description: { type: 'string' },
                input_schema: { type: 'object' },
                output_schema: { type: 'object' },
                performance: { type: 'object' }
            }
        },
        recherche_rag: {
            type: 'object',
            properties: {
                description: { type: 'string' },
                input_schema: { type: 'object' },
                filters: { type: 'object' },
                reranking: { type: 'object' },
                output: { type: 'object' }
            }
        },
        limits: {
            type: 'object',
            properties: {
                chunk_size: { type: 'object' },
                chunk_overlap: { type: 'object' },
                search_limit: { type: 'object' },
                search_threshold: { type: 'object' },
                file_size: { type: 'object' },
                concurrent: { type: 'object' },
                preparation_batch_size: { type: 'object' },
                preparation_timeout: { type: 'object' }
            }
        },
        file_handling: {
            type: 'object',
            properties: {
                default_patterns: { type: 'array', items: { type: 'string' } },
                ignore_patterns: { type: 'array', items: { type: 'string' } },
                recursive_default: { type: 'boolean' },
                follow_symlinks: { type: 'boolean' }
            }
        },
        indexing: {
            type: 'object',
            properties: {
                max_file_size_mb: { type: 'number' },
                supported_extensions: { type: 'array', items: { type: 'string' } },
                content_type_mapping: { type: 'object' },
                text_extensions: { type: 'array', items: { type: 'string' } },
                code_extensions: { type: 'array', items: { type: 'string' } }
            }
        },
        search: {
            type: 'object',
            properties: {
                default_limit: { type: 'number' },
                max_limit: { type: 'number' },
                similarity_threshold: { type: 'number' },
                dynamic_threshold: { type: 'boolean' },
                format_results: { type: 'boolean' },
                include_context_lines: { type: 'number' },
                hybrid_search: { type: 'object' }
            }
        },
        environments: {
            type: 'object',
            properties: {
                development: { type: 'object' },
                production: { type: 'object' }
            }
        },
        migration: {
            type: 'object',
            properties: {
                from_version: { type: 'string' },
                auto_migrate: { type: 'boolean' },
                backup_old_config: { type: 'boolean' },
                preserve_legacy_tools: { type: 'boolean' },
                migration_script: { type: 'string' },
                migrated_from: { type: 'string' },
                migrated_at: { type: 'string' },
                backup_location: { type: 'string' }
            }
        },
        cache: {
            type: 'object',
            properties: {
                enabled: { type: 'boolean' },
                ttl_seconds: { type: 'number' }
            }
        }
    },
    additionalProperties: false
};
/**
 * Schéma JSON pour db-config.json
 */
export const DB_CONFIG_SCHEMA = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    title: 'Database Configuration Schema',
    description: 'Configuration de la base de données RAG',
    required: ['vector_backend'],
    properties: {
        vector_backend: {
            type: 'string',
            enum: ['sqlite', 'postgresql', 'memory'],
            description: 'Backend du vector store'
        },
        sqlite_path: {
            type: 'string',
            description: 'Chemin du fichier SQLite'
        },
        postgres: {
            type: 'object',
            properties: {
                enabled: { type: 'boolean' },
                host: { type: 'string' },
                port: { type: 'number', minimum: 1, maximum: 65535 },
                database: { type: 'string' },
                user: { type: 'string' },
                password: { type: 'string' },
                ssl: { type: 'boolean' },
                max_connections: { type: 'number', minimum: 1 },
                idle_timeout_ms: { type: 'number', minimum: 1000 }
            }
        },
        memory: {
            type: 'object',
            properties: {
                max_vectors: { type: 'number', minimum: 1 },
                cleanup_interval_ms: { type: 'number', minimum: 1000 }
            }
        },
        vector_extension: {
            type: 'boolean',
            description: 'Activer l\'extension vectorielle'
        },
        embedding_dimensions: {
            type: 'number',
            minimum: 1,
            description: 'Dimensions des embeddings'
        },
        embedding_model: {
            type: 'string',
            description: 'Modèle d\'embedding par défaut'
        },
        chunking_strategy: {
            type: 'string',
            enum: ['logical', 'fixed', 'ai_enhanced'],
            description: 'Stratégie de chunking'
        },
        max_chunk_size: {
            type: 'number',
            minimum: 100,
            maximum: 10000,
            description: 'Taille maximale des chunks'
        },
        chunk_overlap: {
            type: 'number',
            minimum: 0,
            maximum: 1000,
            description: 'Overlap des chunks'
        },
        metadata: {
            type: 'object',
            description: 'Métadonnées additionnelles'
        }
    },
    additionalProperties: false
};
/**
 * Schéma JSON pour state.json
 */
export const STATE_SCHEMA = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    title: 'State Schema',
    description: 'État du projet RAG',
    required: ['project_path', 'project_hash', 'initialized', 'initialized_at'],
    properties: {
        project_path: {
            type: 'string',
            description: 'Chemin du projet'
        },
        project_hash: {
            type: 'string',
            pattern: '^[0-9a-f]{8}$',
            description: 'Hash unique du projet'
        },
        initialized: {
            type: 'boolean',
            description: 'Projet initialisé'
        },
        initialized_at: {
            type: 'string',
            format: 'date-time',
            description: 'Date d\'initialisation'
        },
        last_indexed_at: {
            type: 'string',
            format: 'date-time',
            description: 'Date de dernière indexation'
        },
        last_updated_at: {
            type: 'string',
            format: 'date-time',
            description: 'Date de dernière mise à jour'
        },
        total_files: {
            type: 'number',
            minimum: 0,
            description: 'Nombre total de fichiers indexés'
        },
        total_chunks: {
            type: 'number',
            minimum: 0,
            description: 'Nombre total de chunks'
        },
        vector_store_backend: {
            type: 'string',
            enum: ['sqlite', 'postgresql', 'memory'],
            description: 'Backend du vector store'
        },
        embedding_model: {
            type: 'string',
            description: 'Modèle d\'embedding utilisé'
        },
        chunking_strategy: {
            type: 'string',
            enum: ['logical', 'fixed', 'ai_enhanced'],
            description: 'Stratégie de chunking'
        },
        version: {
            type: 'string',
            pattern: '^\\d+\\.\\d+\\.\\d+$',
            description: 'Version du projet'
        },
        metadata: {
            type: 'object',
            description: 'Métadonnées additionnelles'
        }
    },
    additionalProperties: false
};
/**
 * Schéma JSON pour pipeline.json
 */
export const PIPELINE_SCHEMA = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    title: 'Pipeline Schema',
    description: 'Configuration du pipeline RAG',
    required: ['name', 'version', 'steps'],
    properties: {
        name: {
            type: 'string',
            description: 'Nom du pipeline'
        },
        version: {
            type: 'string',
            pattern: '^\\d+\\.\\d+\\.\\d+$',
            description: 'Version du pipeline'
        },
        description: {
            type: 'string',
            description: 'Description du pipeline'
        },
        steps: {
            type: 'array',
            minLength: 1,
            items: {
                type: 'object',
                required: ['name', 'tool', 'inputs'],
                properties: {
                    name: {
                        type: 'string',
                        description: 'Nom de l\'étape'
                    },
                    tool: {
                        type: 'string',
                        description: 'Outil MCP à exécuter'
                    },
                    inputs: {
                        type: 'object',
                        description: 'Entrées de l\'outil'
                    },
                    outputs: {
                        type: 'object',
                        description: 'Sorties attendues'
                    },
                    depends_on: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Dépendances de l\'étape'
                    },
                    timeout_ms: {
                        type: 'number',
                        minimum: 1000,
                        description: 'Timeout en millisecondes'
                    },
                    retry_attempts: {
                        type: 'number',
                        minimum: 0,
                        description: 'Nombre de tentatives de reprise'
                    },
                    retry_delay_ms: {
                        type: 'number',
                        minimum: 100,
                        description: 'Délai entre les tentatives'
                    },
                    enabled: {
                        type: 'boolean',
                        description: 'Étape activée'
                    }
                }
            }
        },
        metadata: {
            type: 'object',
            description: 'Métadonnées additionnelles'
        },
        created_at: {
            type: 'string',
            format: 'date-time',
            description: 'Date de création'
        },
        updated_at: {
            type: 'string',
            format: 'date-time',
            description: 'Date de mise à jour'
        }
    },
    additionalProperties: false
};
/**
 * Validateur de configuration
 */
export class ConfigValidator {
    validator = null;
    async getValidator() {
        if (!this.validator) {
            const { JSONSchemaValidator } = await import('../core/json-schema-validator.js');
            this.validator = new JSONSchemaValidator();
        }
        return this.validator;
    }
    /**
     * Valide une configuration RAG
     */
    async validateRagConfig(config) {
        const validator = await this.getValidator();
        const result = validator.validate(config, RAG_CONFIG_SCHEMA);
        return {
            valid: result.valid,
            errors: result.errors.map((e) => `${e.path}: ${e.message}`)
        };
    }
    /**
     * Valide une configuration de base de données
     */
    async validateDbConfig(config) {
        const validator = await this.getValidator();
        const result = validator.validate(config, DB_CONFIG_SCHEMA);
        return {
            valid: result.valid,
            errors: result.errors.map((e) => `${e.path}: ${e.message}`)
        };
    }
    /**
     * Valide un état de projet
     */
    async validateState(state) {
        const validator = await this.getValidator();
        const result = validator.validate(state, STATE_SCHEMA);
        return {
            valid: result.valid,
            errors: result.errors.map((e) => `${e.path}: ${e.message}`)
        };
    }
    /**
     * Valide un pipeline
     */
    async validatePipeline(pipeline) {
        const validator = await this.getValidator();
        const result = validator.validate(pipeline, PIPELINE_SCHEMA);
        return {
            valid: result.valid,
            errors: result.errors.map((e) => `${e.path}: ${e.message}`)
        };
    }
    /**
     * Valide tous les fichiers de configuration
     */
    async validateAllConfigs() {
        const fs = await import('fs');
        const path = await import('path');
        const results = {
            rag_config: { valid: false, errors: ['Fichier non trouvé'] },
            db_config: { valid: false, errors: ['Fichier non trouvé'] },
            state: { valid: false, errors: ['Fichier non trouvé'] },
            pipeline: { valid: false, errors: ['Fichier non trouvé'] }
        };
        // Valider rag-config.json
        const ragConfigPath = path.join(process.cwd(), 'config', 'rag-config.json');
        if (fs.existsSync(ragConfigPath)) {
            const config = JSON.parse(fs.readFileSync(ragConfigPath, 'utf-8'));
            const validation = await this.validateRagConfig(config);
            results.rag_config = {
                valid: validation.valid,
                errors: validation.errors || []
            };
        }
        // Valider db-config.json
        const dbConfigPath = path.join(process.cwd(), 'rag', 'config', 'db.config.json');
        if (fs.existsSync(dbConfigPath)) {
            const config = JSON.parse(fs.readFileSync(dbConfigPath, 'utf-8'));
            const validation = await this.validateDbConfig(config);
            results.db_config = {
                valid: validation.valid,
                errors: validation.errors || []
            };
        }
        // Valider state.json
        const stateDir = path.join(process.cwd(), 'rag', 'db', 'state');
        if (fs.existsSync(stateDir)) {
            const stateFiles = fs.readdirSync(stateDir).filter(f => f.endsWith('.json'));
            if (stateFiles.length > 0) {
                const stateFile = path.join(stateDir, stateFiles[0]);
                const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
                const validation = await this.validateState(state);
                results.state = {
                    valid: validation.valid,
                    errors: validation.errors || []
                };
            }
        }
        // Valider pipeline.json
        const pipelinePath = path.join(process.cwd(), 'config', 'pipeline.json');
        if (fs.existsSync(pipelinePath)) {
            const pipeline = JSON.parse(fs.readFileSync(pipelinePath, 'utf-8'));
            const validation = await this.validatePipeline(pipeline);
            results.pipeline = {
                valid: validation.valid,
                errors: validation.errors || []
            };
        }
        return results;
    }
}
/**
 * Instance singleton du validateur
 */
export const configValidator = new ConfigValidator();
