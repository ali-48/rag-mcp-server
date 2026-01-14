// src/tools/rag/scan-rag.ts
// Outil scan_rag - Phase 0: Workspace Detection & File Analysis
// Responsabilités: Détection workspace, analyse statique, préparation pour indexation

import { logger } from "../../core/logger.js";
import { ToolDefinition, ToolHandler } from "../../core/tool-registry.js";
import { createPhase0IntegrationWithIndexing } from "../../rag/phase0/phase0-integration.js";
import { isRagInitialized } from "../../rag/phase0/rag-state.js";

/**
 * Définition de l'outil scan_rag
 */
export const scanRagTool: ToolDefinition = {
    name: "scan_rag",
    description: "Phase 0: Détection workspace et analyse statique des fichiers",
    inputSchema: {
        type: "object",
        properties: {
            project_path: {
                type: "string",
                description: "Chemin absolu vers le projet (auto-détecté si vide)"
            },
            enable_workspace_detection: {
                type: "boolean",
                description: "Activer la détection automatique du workspace",
                default: true
            },
            enable_file_watcher: {
                type: "boolean",
                description: "Activer le file watcher en temps réel",
                default: false
            },
            file_patterns: {
                type: "array",
                items: { type: "string" },
                description: "Patterns de fichiers à analyser",
                default: ["**/*"]
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
            max_depth: {
                type: "number",
                description: "Profondeur maximale de scan",
                default: 10,
                minimum: 1,
                maximum: 100
            },
            include_hidden: {
                type: "boolean",
                description: "Inclure les fichiers cachés",
                default: false
            }
        },
        required: []
    },
};

/**
 * Handler pour l'outil scan_rag
 */
export const scanRagHandler: ToolHandler = async (args) => {
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
                    logger.info("rag.scan.project.auto_detected", `Projet auto-détecté: ${projectPath}`, { path: projectPath });
                } else {
                    throw new Error("Impossible de détecter automatiquement le projet. Spécifiez 'project_path'.");
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error("rag.scan.project.detection_error", "Erreur de détection automatique", { error: errorMessage });
                throw error;
            }
        }

        // Vérifier si le RAG est initialisé pour ce projet
        const isInitialized = await isRagInitialized(projectPath);
        if (!isInitialized) {
            const errorMessage = `RAG non initialisé pour le projet: ${projectPath}. Utilisez d'abord l'outil init_rag.`;

            logger.error("rag.scan.not_initialized", errorMessage, { project_path: projectPath });

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

        logger.info("rag.scan.start", "Début du scan du projet", { project_path: projectPath });

        // Vérification des permissions
        const fs = await import('fs');
        const path = await import('path');

        if (!fs.existsSync(projectPath)) {
            throw new Error(`Le chemin du projet n'existe pas: ${projectPath}`);
        }

        // Initialisation Phase 0
        let phase0Integration = null;
        let projectMetadata = null;

        if (args.enable_workspace_detection !== false) {
            try {
                const onIndexNeeded = async (filePath: string, eventType: string) => {
                    logger.debug("rag.scan.phase0.auto_index", `Indexation automatique déclenchée: ${eventType} ${filePath}`, {
                        file_path: filePath,
                        event_type: eventType
                    });
                };

                phase0Integration = await createPhase0IntegrationWithIndexing(
                    onIndexNeeded,
                    {
                        enableWorkspaceDetection: true,
                        enableFileWatcher: args.enable_file_watcher === true,
                        enableLogging: true,
                        fileWatcherOptions: {
                            debounceDelay: 500,
                            recursive: true,
                            logEvents: true,
                        },
                        loggerOptions: {
                            minLevel: 'info',
                            enableConsole: true,
                            enableMemoryStorage: true,
                        },
                    },
                    projectPath
                );

                logger.info("rag.scan.phase0.initialized", "Phase 0 initialisée avec succès");

                // Récupérer les métadonnées du workspace
                const workspace = phase0Integration.getWorkspace();
                if (workspace) {
                    projectMetadata = {
                        path: workspace.path,
                        vscodeWorkspace: workspace.vscodeWorkspace,
                        language: workspace.language,
                        fileCount: workspace.metadata.fileCount,
                        isGitRepo: workspace.metadata.isGitRepo,
                        detectedBy: workspace.metadata.detectedBy,
                    };
                    logger.info("rag.scan.phase0.workspace_detected", "Workspace détecté", projectMetadata);
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error("rag.scan.phase0.error", "Erreur Phase 0, continuation sans", { error: errorMessage });
            }
        }

        // Scan des fichiers
        const fg = await import('fast-glob');
        const filePatterns = args.file_patterns || ["**/*"];

        const files = await fg.default(filePatterns, {
            cwd: projectPath,
            absolute: true,
            dot: args.include_hidden === true,
            onlyFiles: true,
            followSymbolicLinks: false,
            deep: args.max_depth || 10,
        });

        logger.info("rag.scan.files.found", `${files.length} fichiers trouvés`, { count: files.length });

        // Analyse basique des fichiers
        const fileAnalysis = [];
        const contentTypes = args.content_types || ['code', 'doc', 'config', 'other'];
        const languages = args.languages || [];

        for (const filePath of files.slice(0, 100)) { // Limiter à 100 fichiers pour la démo
            try {
                const stats = fs.statSync(filePath);
                const ext = path.extname(filePath).toLowerCase();
                const relativePath = path.relative(projectPath, filePath);

                // Détection basique du type de contenu
                let contentType = 'other';
                if (['.js', '.ts', '.py', '.java', '.cpp', '.c', '.go', '.rs', '.php'].includes(ext)) {
                    contentType = 'code';
                } else if (['.md', '.txt', '.rst', '.adoc'].includes(ext)) {
                    contentType = 'doc';
                } else if (['.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf'].includes(ext)) {
                    contentType = 'config';
                }

                // Détection basique du langage
                let language = 'unknown';
                if (ext === '.js') language = 'javascript';
                else if (ext === '.ts') language = 'typescript';
                else if (ext === '.py') language = 'python';
                else if (ext === '.java') language = 'java';
                else if (ext === '.cpp' || ext === '.c') language = 'c++';
                else if (ext === '.go') language = 'go';
                else if (ext === '.rs') language = 'rust';
                else if (ext === '.php') language = 'php';

                // Filtrer par type de contenu et langage si spécifiés
                if (contentTypes.includes(contentType) &&
                    (languages.length === 0 || languages.includes(language))) {

                    fileAnalysis.push({
                        path: relativePath,
                        absolute_path: filePath,
                        size_bytes: stats.size,
                        modified: stats.mtime.toISOString(),
                        content_type: contentType,
                        language: language,
                        extension: ext
                    });
                }
            } catch (error) {
                // Ignorer les erreurs de lecture de fichier
            }
        }

        // Collecter les statistiques
        const statsByType = fileAnalysis.reduce((acc, file) => {
            acc[file.content_type] = (acc[file.content_type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const statsByLanguage = fileAnalysis.reduce((acc, file) => {
            acc[file.language] = (acc[file.language] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        // Arrêter Phase 0 si nécessaire
        if (phase0Integration && phase0Integration.isActive()) {
            try {
                await phase0Integration.stop();
                logger.info("rag.scan.phase0.stopped", "Phase 0 arrêtée proprement");
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.warn("rag.scan.phase0.stop_error", "Erreur lors de l'arrêt de Phase 0", { error: errorMessage });
            }
        }

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        logger.info("rag.scan.completed", "Scan terminé avec succès", {
            duration: `${duration}s`,
            total_files: files.length,
            analyzed_files: fileAnalysis.length
        });

        // Préparer la réponse
        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    status: "ok",
                    message: "Scan terminé avec succès",
                    project_path: projectPath,
                    duration_seconds: parseFloat(duration),
                    stats: {
                        total_files_found: files.length,
                        files_analyzed: fileAnalysis.length,
                        by_content_type: statsByType,
                        by_language: statsByLanguage
                    },
                    project_metadata: projectMetadata,
                    file_analysis: fileAnalysis.slice(0, 50), // Limiter à 50 fichiers pour la réponse
                    recommendations: {
                        chunking_strategy: statsByType.code > statsByType.doc ? 'logical' : 'fixed',
                        estimated_chunks: Math.ceil(files.length / 10),
                        suggested_content_types: Object.keys(statsByType).filter(type => statsByType[type] > 0),
                        suggested_languages: Object.keys(statsByLanguage).filter(lang => statsByLanguage[lang] > 0)
                    },
                    next_steps: [
                        "Utilisez index_rag pour indexer les fichiers analysés",
                        "Utilisez query_rag pour rechercher dans les fichiers indexés"
                    ],
                    timestamp: new Date().toISOString()
                }, null, 2)
            }]
        };

    } catch (error: any) {
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        logger.error("rag.scan.error", "Erreur lors du scan", {
            error: error.message,
            stack: error.stack,
            duration: `${duration}s`
        });

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    status: "error",
                    error: "SCAN_ERROR",
                    message: error.message,
                    duration_seconds: parseFloat(duration),
                    timestamp: new Date().toISOString(),
                    stack_trace: error.stack
                }, null, 2)
            }]
        };
    }
};
