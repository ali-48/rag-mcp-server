// src/tools/rag/index-rag.ts
// Outil index_rag - Phase 2-4: Chunking, Embeddings, Indexation
// Responsabilités: Découpage intelligent, génération embeddings, stockage vectoriel

import { getRagConfigManager } from "../../config/rag-config.js";
import { logger } from "../../core/logger.js";
import { ToolDefinition, ToolHandler } from "../../core/tool-registry.js";
import { indexProject, updateProject } from "../../rag/indexer.js";
import { isRagInitialized } from "../../rag/phase0/rag-state.js";
import { setEmbeddingProvider } from "../../rag/vector-store-refactored.js";

/**
 * Définition de l'outil index_rag
 */
export const indexRagTool: ToolDefinition = {
    name: "index_rag",
    description: "Phase 2-4: Indexation des fichiers avec chunking intelligent et embeddings",
    inputSchema: {
        type: "object",
        properties: {
            project_path: {
                type: "string",
                description: "Chemin absolu vers le projet (auto-détecté si vide)"
            },
            mode: {
                type: "string",
                enum: ["full", "incremental"],
                description: "Mode d'indexation",
                default: "full"
            },
            file_patterns: {
                type: "array",
                items: { type: "string" },
                description: "Patterns de fichiers à indexer",
                default: ["**/*.{js,ts,py,md,txt,json,yaml,yml,html,css,scss}"]
            },
            chunking_strategy: {
                type: "string",
                enum: ["logical", "fixed", "ai_enhanced"],
                description: "Stratégie de chunking",
                default: "logical"
            },
            max_chunk_size: {
                type: "number",
                description: "Taille maximale des chunks (tokens)",
                default: 1000,
                minimum: 100,
                maximum: 10000
            },
            chunk_overlap: {
                type: "number",
                description: "Chevauchement entre chunks (tokens)",
                default: 200,
                minimum: 0,
                maximum: 1000
            },
            content_types: {
                type: "array",
                items: {
                    type: "string",
                    enum: ["code", "doc", "config", "other"]
                },
                description: "Types de contenu à inclure"
            },
            languages: {
                type: "array",
                items: { type: "string" },
                description: "Langages à inclure (ex: ['typescript', 'python'])"
            },
            embedding_model: {
                type: "string",
                description: "Modèle d'embedding à utiliser",
                default: "nomic-embed-text"
            },
            enable_llm_enrichment: {
                type: "boolean",
                description: "Activer l'enrichissement LLM optionnel",
                default: false
            },
            recursive: {
                type: "boolean",
                description: "Recherche récursive dans les sous-dossiers",
                default: true
            },
            metadata_overrides: {
                type: "object",
                description: "Surcharges de métadonnées",
                additionalProperties: true
            }
        },
        required: []
    },
};

/**
 * Handler pour l'outil index_rag
 */
export const indexRagHandler: ToolHandler = async (args) => {
    const startTime = Date.now();

    try {
        // Détection automatique du projet si non spécifié
        let projectPath = args.project_path;
        if (!projectPath) {
            try {
                const fs = await import('fs');
                const path = await import('path');
                const cwd = process.cwd();

                const projectFiles = ['.git', 'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod'];
                const hasProjectFile = projectFiles.some(file => fs.existsSync(path.join(cwd, file)));

                if (hasProjectFile) {
                    projectPath = cwd;
                    logger.info("rag.index.project.auto_detected", `Projet auto-détecté: ${projectPath}`, { path: projectPath });
                } else {
                    throw new Error("Impossible de détecter automatiquement le projet. Spécifiez 'project_path'.");
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error("rag.index.project.detection_error", "Erreur de détection automatique", { error: errorMessage });
                throw error;
            }
        }

        // Vérifier si le RAG est initialisé pour ce projet
        const isInitialized = await isRagInitialized(projectPath);
        if (!isInitialized) {
            const errorMessage = `RAG non initialisé pour le projet: ${projectPath}. Utilisez d'abord l'outil init_rag.`;

            logger.error("rag.index.not_initialized", errorMessage, { project_path: projectPath });

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        status: "error",
                        error: "RAG_NOT_INITIALIZED",
                        message: errorMessage,
                        required_action: "run_init_rag",
                        details: {
                            project_path: projectPath,
                            timestamp: new Date().toISOString()
                        }
                    }, null, 2)
                }]
            };
        }

        logger.info("rag.index.start", "Début de l'indexation du projet", {
            project_path: projectPath,
            mode: args.mode || 'full'
        });

        // Vérification des permissions
        const fs = await import('fs');
        if (!fs.existsSync(projectPath)) {
            throw new Error(`Le chemin du projet n'existe pas: ${projectPath}`);
        }

        // Configuration du chunking
        const configManager = getRagConfigManager();
        const defaults = configManager.getDefaults();

        const chunkingStrategy = args.chunking_strategy || 'logical';
        const maxChunkSize = args.max_chunk_size || defaults.chunk_size;
        const chunkOverlap = args.chunk_overlap || defaults.chunk_overlap;

        // Configuration des embeddings
        const embeddingModel = args.embedding_model || defaults.embedding_model;
        setEmbeddingProvider(defaults.embedding_provider, embeddingModel);

        logger.info("rag.index.config", "Configuration de l'indexation", {
            chunking_strategy: chunkingStrategy,
            max_chunk_size: maxChunkSize,
            chunk_overlap: chunkOverlap,
            embedding_model: embeddingModel,
            enable_llm_enrichment: args.enable_llm_enrichment === true
        });

        // Préparation des options d'indexation
        const options = {
            filePatterns: args.file_patterns || defaults.file_patterns,
            recursive: args.recursive !== undefined ? args.recursive : defaults.recursive,
            chunkSize: maxChunkSize,
            chunkOverlap: chunkOverlap,
            chunkingStrategy: chunkingStrategy,
            contentTypes: args.content_types,
            languages: args.languages,
            metadataOverrides: args.metadata_overrides
        };

        // Exécution de l'indexation selon le mode
        let indexResult;
        const mode = args.mode || 'full';

        if (mode === 'incremental') {
            logger.info("rag.index.mode.incremental", "Mode: Indexation incrémentale");
            indexResult = await updateProject(projectPath, options);
        } else {
            logger.info("rag.index.mode.full", "Mode: Indexation complète");
            indexResult = await indexProject(projectPath, options);
        }

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        logger.info("rag.index.completed", "Indexation terminée avec succès", {
            duration: `${duration}s`,
            total_files: indexResult.totalFiles,
            indexed_files: indexResult.indexedFiles,
            chunks_created: indexResult.chunksCreated
        });

        // Préparer les statistiques selon le mode
        const stats: any = {
            total_files: indexResult.totalFiles,
            indexed_files: indexResult.indexedFiles,
            ignored_files: indexResult.ignoredFiles || 0,
            errors: indexResult.errors || 0,
            chunks_created: indexResult.chunksCreated
        };

        // Ajouter les statistiques spécifiques au mode incrémental
        if (mode === 'incremental') {
            const incrementalResult = indexResult as any;
            stats.modified_files = incrementalResult.modifiedFiles || 0;
            stats.deleted_files = incrementalResult.deletedFiles || 0;
            stats.unchanged_files = incrementalResult.unchangedFiles || 0;
        }

        // Préparer la réponse
        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    status: "ok",
                    message: "Indexation terminée avec succès",
                    project_path: projectPath,
                    mode: mode,
                    duration_seconds: parseFloat(duration),
                    stats: stats,
                    config_used: {
                        chunking_strategy: chunkingStrategy,
                        max_chunk_size: maxChunkSize,
                        chunk_overlap: chunkOverlap,
                        embedding_model: embeddingModel,
                        content_types: args.content_types,
                        languages: args.languages,
                        enable_llm_enrichment: args.enable_llm_enrichment === true
                    },
                    phase03_metrics: indexResult.phase03Metrics || null,
                    next_steps: [
                        "Utilisez query_rag pour rechercher dans les fichiers indexés",
                        "Utilisez scan_rag pour analyser les changements dans le projet"
                    ],
                    timestamp: new Date().toISOString()
                }, null, 2)
            }]
        };

    } catch (error: any) {
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        logger.error("rag.index.error", "Erreur lors de l'indexation", {
            error: error.message,
            stack: error.stack,
            duration: `${duration}s`
        });

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    status: "error",
                    error: "INDEX_ERROR",
                    message: error.message,
                    duration_seconds: parseFloat(duration),
                    timestamp: new Date().toISOString(),
                    stack_trace: error.stack
                }, null, 2)
            }]
        };
    }
};
