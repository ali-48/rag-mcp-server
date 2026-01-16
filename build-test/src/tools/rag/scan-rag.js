// src/tools/rag/scan-rag.ts
// Outil scan_rag - Phase 0: Workspace Detection & File Analysis
// Responsabilités: Détection workspace, analyse statique, préparation pour indexation
// Version asynchrone: retourne un task_id immédiatement
import { logger } from "../../core/logger.js";
import { isRagInitialized } from "../../rag/phase0/rag-state.js";
import { createRagJob } from "../../rag/queue/job-types.js";
import { getRagQueue } from "../../rag/queue/rag-queue.js";
/**
 * Définition de l'outil scan_rag
 */
export const scanRagTool = {
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
 * Handler pour l'outil scan_rag (version asynchrone)
 * Retourne immédiatement un task_id et crée un job dans la file d'attente
 */
export const scanRagHandler = async (args) => {
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
                }
                else {
                    throw new Error("Impossible de détecter automatiquement le projet. Spécifiez 'project_path'.");
                }
            }
            catch (error) {
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
        // Créer un job de scan dans la file d'attente
        const queue = getRagQueue();
        const job = createRagJob('scan', projectPath, {
            metadata: {
                args: args,
                startTime: startTime
            }
        });
        const enqueueResult = await queue.enqueue(job);
        if (!enqueueResult.queued) {
            throw new Error(`Impossible d'ajouter le job à la file d'attente: ${enqueueResult.message}`);
        }
        logger.info("rag.scan.job.created", "Job de scan créé", {
            jobId: job.id,
            projectPath: projectPath,
            position: enqueueResult.position
        });
        // Formater la réponse asynchrone
        const asyncResponse = {
            status: "accepted",
            action: "scan_rag",
            task_id: job.id,
            execution: "background",
            message: "Scan démarré en arrière-plan. Utilisez get_status pour suivre la progression.",
            next_action: "get_status",
            notes_for_ai: [
                "Le scan s'exécute de manière asynchrone",
                `Utilisez get_status avec scope=task et task_id=${job.id} pour suivre la progression`,
                "Le projet sera verrouillé pour les autres opérations mutatrices pendant l'exécution",
                "Vous pouvez continuer à utiliser query_rag pendant le scan"
            ]
        };
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(asyncResponse, null, 2)
                }]
        };
    }
    catch (error) {
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        logger.error("rag.scan.error", "Erreur lors de la création du job de scan", {
            error: error.message,
            stack: error.stack,
            duration: `${duration}s`
        });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        status: "error",
                        error: "SCAN_JOB_CREATION_ERROR",
                        message: error.message,
                        duration_seconds: parseFloat(duration),
                        timestamp: new Date().toISOString(),
                        stack_trace: error.stack
                    }, null, 2)
                }]
        };
    }
};
//# sourceMappingURL=scan-rag.js.map