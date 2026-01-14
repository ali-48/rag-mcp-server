// src/tools/rag/index-rag.ts
// Outil index_rag refactorisé - Support asynchrone avec progression
// Version: v2.0.0
// Responsabilités: Indexation asynchrone avec task_id, progression, file d'attente
import { getRagConfigManager } from "../../config/rag-config.js";
import { logger } from "../../core/logger.js";
import { generateTaskId, getProgressTracker } from "../../core/progress-tracker.js";
import { getTaskQueue } from "../../core/task-queue.js";
import { indexProject, updateProject } from "../../rag/indexer.js";
import { isRagInitialized } from "../../rag/phase0/rag-state.js";
import { setEmbeddingProvider } from "../../rag/vector-store-refactored.js";
/**
 * Définition de l'outil index_rag refactorisé
 */
export const indexRagTool = {
    name: "index_rag",
    description: "Phase 2-4: Indexation asynchrone avec chunking intelligent, embeddings et suivi de progression",
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
            },
            // Nouveaux paramètres pour le mode asynchrone
            wait_for_completion: {
                type: "boolean",
                description: "Attendre la complétion de la tâche (false = retourne task_id immédiatement)",
                default: false
            },
            timeout_seconds: {
                type: "number",
                description: "Timeout en secondes pour wait_for_completion",
                default: 300,
                minimum: 10,
                maximum: 3600
            }
        },
        required: []
    },
};
/**
 * Fonction d'indexation principale avec suivi de progression
 */
async function indexTask(taskId, projectPath, options, mode) {
    const progressTracker = getProgressTracker();
    try {
        // Mettre à jour le statut
        progressTracker.update(taskId, {
            state: 'running',
            step: 'preparation',
            currentOperation: 'configuration'
        });
        // Configuration du chunking
        const configManager = getRagConfigManager();
        const defaults = configManager.getDefaults();
        const chunkingStrategy = options.chunking_strategy || 'logical';
        const maxChunkSize = options.max_chunk_size || defaults.chunk_size;
        const chunkOverlap = options.chunk_overlap || defaults.chunk_overlap;
        // Configuration des embeddings
        const embeddingModel = options.embedding_model || defaults.embedding_model;
        setEmbeddingProvider(defaults.embedding_provider, embeddingModel);
        // Estimation du coût des embeddings
        const estimatedTokens = await estimateEmbeddingTokens(projectPath, options);
        progressTracker.updateEmbeddingCost(taskId, estimatedTokens, embeddingModel, Math.ceil(estimatedTokens / 1000) // Estimation: 1000 tokens/seconde
        );
        logger.info("rag.index.task.start", `Début de la tâche d'indexation: ${taskId}`, {
            taskId,
            projectPath,
            mode,
            estimatedTokens
        });
        // Préparation des options d'indexation
        const indexOptions = {
            filePatterns: options.file_patterns || defaults.file_patterns,
            recursive: options.recursive !== undefined ? options.recursive : defaults.recursive,
            chunkSize: maxChunkSize,
            chunkOverlap: chunkOverlap,
            chunkingStrategy: chunkingStrategy,
            contentTypes: options.content_types,
            languages: options.languages,
            metadataOverrides: options.metadata_overrides,
            // Callback de progression
            onProgress: (filesProcessed, filesTotal, currentFile) => {
                progressTracker.update(taskId, {
                    step: 'indexing',
                    filesProcessed,
                    filesTotal,
                    currentFile,
                    currentOperation: 'file_processing',
                    progress: filesTotal > 0 ? Math.round((filesProcessed / filesTotal) * 100) : 0
                });
                // Log toutes les 10 fichiers
                if (filesProcessed % 10 === 0) {
                    logger.info("rag.index.task.progress", `Progression indexation: ${filesProcessed}/${filesTotal}`, {
                        taskId,
                        filesProcessed,
                        filesTotal,
                        progress: Math.round((filesProcessed / filesTotal) * 100),
                        currentFile
                    });
                }
            }
        };
        // Exécution de l'indexation selon le mode
        progressTracker.update(taskId, {
            step: 'execution',
            currentOperation: mode === 'incremental' ? 'incremental_indexing' : 'full_indexing'
        });
        let indexResult;
        if (mode === 'incremental') {
            logger.info("rag.index.task.mode.incremental", `Mode incrémental: ${taskId}`);
            indexResult = await updateProject(projectPath, indexOptions);
        }
        else {
            logger.info("rag.index.task.mode.full", `Mode complet: ${taskId}`);
            indexResult = await indexProject(projectPath, indexOptions);
        }
        // Mise à jour finale
        progressTracker.update(taskId, {
            state: 'completed',
            step: 'finalization',
            progress: 100,
            filesProcessed: indexResult.indexedFiles,
            currentOperation: 'cleanup'
        });
        logger.info("rag.index.task.complete", `Tâche d'indexation terminée: ${taskId}`, {
            taskId,
            totalFiles: indexResult.totalFiles,
            indexedFiles: indexResult.indexedFiles,
            chunksCreated: indexResult.chunksCreated,
            errors: indexResult.errors || 0
        });
    }
    catch (error) {
        logger.error("rag.index.task.error", `Erreur dans la tâche d'indexation: ${taskId}`, {
            taskId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        progressTracker.fail(taskId, error instanceof Error ? error : new Error(String(error)), 'index_execution');
        throw error;
    }
}
/**
 * Estime le nombre de tokens pour les embeddings
 */
async function estimateEmbeddingTokens(projectPath, options) {
    try {
        const fs = await import('fs');
        const fg = await import('fast-glob');
        // Récupérer les fichiers
        const filePatterns = options.file_patterns || ["**/*.{js,ts,py,md,txt,json,yaml,yml,html,css,scss}"];
        const recursive = options.recursive !== undefined ? options.recursive : true;
        const files = await fg.default(filePatterns, {
            cwd: projectPath,
            absolute: true,
            dot: false,
            onlyFiles: true,
            followSymbolicLinks: false,
            ...(recursive ? {} : { deep: 1 }),
        });
        // Estimation: 1.3 tokens par caractère (approximation)
        let totalChars = 0;
        const sampleSize = Math.min(files.length, 10);
        for (let i = 0; i < sampleSize && i < files.length; i++) {
            try {
                const content = fs.readFileSync(files[i], 'utf8');
                totalChars += content.length;
            }
            catch {
                // Ignorer les erreurs de lecture
            }
        }
        const avgCharsPerFile = sampleSize > 0 ? totalChars / sampleSize : 0;
        const estimatedTotalChars = avgCharsPerFile * files.length;
        const estimatedTokens = Math.ceil(estimatedTotalChars * 1.3);
        return estimatedTokens;
    }
    catch (error) {
        // Fallback: estimation basée sur le nombre de fichiers
        logger.warn("rag.index.estimation.error", "Erreur lors de l'estimation des tokens", {
            error: error instanceof Error ? error.message : String(error)
        });
        return 10000; // Estimation par défaut
    }
}
/**
 * Détecte automatiquement le chemin du projet
 */
async function detectProjectPath() {
    const fs = await import('fs');
    const path = await import('path');
    const cwd = process.cwd();
    const projectFiles = ['.git', 'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod'];
    const hasProjectFile = projectFiles.some(file => fs.existsSync(path.join(cwd, file)));
    if (hasProjectFile) {
        return cwd;
    }
    throw new Error("Impossible de détecter automatiquement le projet. Spécifiez 'project_path'.");
}
/**
 * Estime le nombre de fichiers dans le projet
 */
async function estimateFileCount(projectPath, options) {
    try {
        const fg = await import('fast-glob');
        const filePatterns = options.file_patterns || ["**/*.{js,ts,py,md,txt,json,yaml,yml,html,css,scss}"];
        const recursive = options.recursive !== undefined ? options.recursive : true;
        const files = await fg.default(filePatterns, {
            cwd: projectPath,
            absolute: true,
            dot: false,
            onlyFiles: true,
            followSymbolicLinks: false,
            ...(recursive ? {} : { deep: 1 }),
        });
        return files.length;
    }
    catch (error) {
        logger.warn("rag.index.estimation.files.error", "Erreur lors de l'estimation du nombre de fichiers", {
            error: error instanceof Error ? error.message : String(error)
        });
        return 100; // Estimation par défaut
    }
}
/**
 * Handler pour l'outil index_rag refactorisé
 */
export const indexRagHandler = async (args) => {
    const startTime = Date.now();
    try {
        // Détection automatique du projet si non spécifié
        let projectPath = args.project_path;
        if (!projectPath) {
            try {
                projectPath = await detectProjectPath();
                logger.info("rag.index.project.auto_detected", `Projet auto-détecté: ${projectPath}`, { path: projectPath });
            }
            catch (error) {
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
                            success: false,
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
        // Vérification des permissions
        const fs = await import('fs');
        if (!fs.existsSync(projectPath)) {
            throw new Error(`Le chemin du projet n'existe pas: ${projectPath}`);
        }
        // Générer un ID de tâche
        const taskId = generateTaskId(projectPath);
        const mode = args.mode || 'full';
        logger.info("rag.index.start", "Début de l'indexation asynchrone", {
            taskId,
            project_path: projectPath,
            mode,
            wait_for_completion: args.wait_for_completion === true
        });
        // Créer la tâche de suivi
        const progressTracker = getProgressTracker();
        // Estimation initiale du nombre de fichiers
        const estimatedFiles = await estimateFileCount(projectPath, args);
        progressTracker.create(taskId, projectPath, estimatedFiles, {
            mode,
            chunking_strategy: args.chunking_strategy,
            max_chunk_size: args.max_chunk_size,
            embedding_model: args.embedding_model,
            enable_llm_enrichment: args.enable_llm_enrichment === true
        });
        // Ajouter à la file d'attente
        const taskQueue = getTaskQueue();
        const enqueueResult = await taskQueue.enqueue(taskId, projectPath, () => indexTask(taskId, projectPath, args, mode), 2, // Priorité moyenne
        {
            type: 'indexing',
            mode,
            startedAt: new Date().toISOString()
        });
        if (!enqueueResult.queued) {
            throw new Error(`Impossible d'ajouter la tâche à la file d'attente. File pleine (max ${enqueueResult.queueSize} tâches)`);
        }
        // Réponse immédiate avec task_id
        const immediateResponse = {
            success: true,
            task_id: taskId,
            status: {
                state: 'queued',
                step: 'queued',
                progress: 0,
                queue_position: enqueueResult.position,
                queue_size: enqueueResult.queueSize,
                estimated_files: estimatedFiles,
                project_path: projectPath,
                mode
            },
            message: "Tâche d'indexation ajoutée à la file d'attente",
            next_steps: [
                `Utilisez get_task_status avec task_id: ${taskId} pour suivre la progression`,
                `Utilisez cancel_task avec task_id: ${taskId} pour annuler si nécessaire`
            ],
            timestamp: new Date().toISOString()
        };
        // Si wait_for_completion est true, attendre la complétion
        if (args.wait_for_completion === true) {
            logger.info("rag.index.waiting", `Attente de complétion pour la tâche: ${taskId}`, {
                taskId,
                timeout_seconds: args.timeout_seconds || 300
            });
            const timeoutMs = (args.timeout_seconds || 300) * 1000;
            const finalStatus = await taskQueue.waitForCompletion(taskId, timeoutMs);
            const endTime = Date.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2);
            if (finalStatus) {
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                success: finalStatus.state === 'completed',
                                task_id: taskId,
                                status: finalStatus,
                                duration_seconds: parseFloat(duration),
                                message: finalStatus.state === 'completed'
                                    ? "Indexation terminée avec succès"
                                    : `Indexation ${finalStatus.state}: ${finalStatus.error?.message || 'Raison inconnue'}`,
                                timestamp: new Date().toISOString()
                            }, null, 2)
                        }]
                };
            }
            else {
                // Timeout ou tâche non trouvée
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                task_id: taskId,
                                error: "TIMEOUT",
                                message: `Timeout d'attente (${args.timeout_seconds || 300}s). La tâche est toujours en cours.`,
                                duration_seconds: parseFloat(duration),
                                timestamp: new Date().toISOString()
                            }, null, 2)
                        }]
                };
            }
        }
        // Retourner la réponse immédiate
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(immediateResponse, null, 2)
                }]
        };
    }
    catch (error) {
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        logger.error("rag.index.error", "Erreur lors de l'indexation", {
            error: error.message,
            stack: error.stack,
            duration_seconds: parseFloat(duration)
        });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: false,
                        error: "INDEX_ERROR",
                        message: error.message,
                        duration_seconds: parseFloat(duration),
                        timestamp: new Date().toISOString()
                    }, null, 2)
                }]
        };
    }
};
