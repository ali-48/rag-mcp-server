// src/tools/rag/query-rag.ts
// Outil query_rag - Recherche sémantique dans les fichiers indexés
// Responsabilités: Recherche vectorielle, filtrage, ranking, retour de résultats
import { logger } from "../../core/logger.js";
import { isRagInitialized } from "../../rag/phase0/rag-state.js";
import { searchCode } from "../../rag/searcher.js";
/**
 * Définition de l'outil query_rag
 */
export const queryRagTool = {
    name: "query_rag",
    description: "Recherche sémantique dans les fichiers indexés avec filtres avancés",
    inputSchema: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "Requête de recherche sémantique",
                minLength: 1
            },
            project_path: {
                type: "string",
                description: "Chemin absolu vers le projet (auto-détecté si vide)"
            },
            scope: {
                type: "string",
                enum: ["project", "global"],
                description: "Scope de recherche",
                default: "project"
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
            file_extensions: {
                type: "array",
                items: { type: "string" },
                description: "Extensions de fichier à inclure (ex: ['.ts', '.py'])"
            },
            roles: {
                type: "array",
                items: { type: "string" },
                description: "Rôles à inclure (ex: ['core', 'example', 'template'])"
            },
            top_k: {
                type: "number",
                description: "Nombre maximum de résultats à retourner",
                default: 10,
                minimum: 1,
                maximum: 100
            },
            threshold: {
                type: "number",
                description: "Seuil de similarité minimum (0.0-1.0)",
                default: 0.3,
                minimum: 0,
                maximum: 1
            },
            dynamic_threshold: {
                type: "boolean",
                description: "Activer le seuil dynamique basé sur la distribution des scores",
                default: false
            },
            search_mode: {
                type: "string",
                enum: ["semantic", "hybrid", "text"],
                description: "Mode de recherche",
                default: "semantic"
            },
            text_query: {
                type: "string",
                description: "Requête textuelle pour la recherche hybride"
            },
            semantic_weight: {
                type: "number",
                description: "Poids pour la recherche sémantique (0.0-1.0)",
                default: 0.7,
                minimum: 0,
                maximum: 1
            },
            text_weight: {
                type: "number",
                description: "Poids pour la recherche textuelle (0.0-1.0)",
                default: 0.3,
                minimum: 0,
                maximum: 1
            },
            enable_reranking: {
                type: "boolean",
                description: "Activer le re-ranking basé sur les métadonnées",
                default: false
            },
            prefer_recent: {
                type: "boolean",
                description: "Préférer les fichiers récents dans le re-ranking",
                default: true
            },
            prefer_smaller_files: {
                type: "boolean",
                description: "Préférer les fichiers plus petits dans le re-ranking",
                default: true
            },
            priority_content_types: {
                type: "array",
                items: { type: "string" },
                description: "Types de contenu prioritaires pour le re-ranking",
                default: ["code", "doc"]
            },
            format_output: {
                type: "boolean",
                description: "Formater la sortie pour une lecture humaine",
                default: true
            },
            include_metadata: {
                type: "boolean",
                description: "Inclure les métadonnées complètes dans la sortie",
                default: false
            },
            include_content: {
                type: "boolean",
                description: "Inclure le contenu complet dans la sortie",
                default: true
            },
            max_content_length: {
                type: "number",
                description: "Longueur maximale du contenu à inclure (caractères)",
                default: 500,
                minimum: 0,
                maximum: 10000
            }
        },
        required: ["query"]
    },
};
/**
 * Handler pour l'outil query_rag
 */
export const queryRagHandler = async (args) => {
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
                    logger.info("rag.query.project.auto_detected", `Projet auto-détecté: ${projectPath}`, { path: projectPath });
                }
                else {
                    throw new Error("Impossible de détecter automatiquement le projet. Spécifiez 'project_path'.");
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error("rag.query.project.detection_error", "Erreur de détection automatique", { error: errorMessage });
                throw error;
            }
        }
        // Vérifier si le RAG est initialisé pour ce projet
        const isInitialized = await isRagInitialized(projectPath);
        if (!isInitialized) {
            const errorMessage = `RAG non initialisé pour le projet: ${projectPath}. Utilisez d'abord l'outil init_rag.`;
            logger.error("rag.query.not_initialized", errorMessage, { project_path: projectPath });
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
        logger.info("rag.query.start", "Début de la recherche", {
            project_path: projectPath,
            query: args.query.substring(0, 100) + (args.query.length > 100 ? "..." : "")
        });
        // Préparation des options de recherche
        const searchOptions = {
            scope: args.scope || 'project',
            projectFilter: projectPath,
            contentTypes: args.content_types,
            languages: args.languages,
            fileExtensions: args.file_extensions,
            roles: args.roles,
            topK: args.top_k || 10,
            threshold: args.threshold || 0.3,
            dynamicThreshold: args.dynamic_threshold === true,
            searchMode: args.search_mode || 'semantic',
            textQuery: args.text_query,
            semanticWeight: args.semantic_weight || 0.7,
            textWeight: args.text_weight || 0.3,
            enableReranking: args.enable_reranking === true,
            preferRecent: args.prefer_recent !== false,
            preferSmallerFiles: args.prefer_smaller_files !== false,
            priorityContentTypes: args.priority_content_types || ['code', 'doc'],
            formatOutput: args.format_output !== false,
            includeMetadata: args.include_metadata === true,
            includeContent: args.include_content !== false,
            maxContentLength: args.max_content_length || 500
        };
        // Exécution de la recherche
        const searchResult = await searchCode(args.query, searchOptions);
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        logger.info("rag.query.completed", "Recherche terminée avec succès", {
            duration: `${duration}s`,
            total_results: searchResult.results?.length || 0,
            query_length: args.query.length
        });
        // Préparer la réponse
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        status: "ok",
                        message: "Recherche terminée avec succès",
                        query: args.query,
                        project_path: projectPath,
                        duration_seconds: parseFloat(duration),
                        results: searchResult.results || [],
                        stats: {
                            total_results: searchResult.results?.length || 0,
                            execution_time_ms: searchResult.stats?.executionTime || 0,
                            projects_scanned: searchResult.stats?.projectsScanned || 0
                        },
                        config_used: {
                            scope: args.scope || 'project',
                            top_k: args.top_k || 10,
                            threshold: args.threshold || 0.3,
                            search_mode: args.search_mode || 'semantic',
                            enable_reranking: args.enable_reranking === true
                        },
                        next_steps: [
                            "Affinez votre requête pour des résultats plus précis",
                            "Utilisez scan_rag pour analyser les changements dans le projet",
                            "Utilisez index_rag pour mettre à jour l'indexation"
                        ],
                        timestamp: new Date().toISOString()
                    }, null, 2)
                }]
        };
    }
    catch (error) {
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        logger.error("rag.query.error", "Erreur lors de la recherche", {
            error: error.message,
            stack: error.stack,
            duration: `${duration}s`
        });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        status: "error",
                        error: "QUERY_ERROR",
                        message: error.message,
                        duration_seconds: parseFloat(duration),
                        timestamp: new Date().toISOString(),
                        stack_trace: error.stack
                    }, null, 2)
                }]
        };
    }
};
