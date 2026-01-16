// src/tools/rag/index-rag.ts
// Outil index_rag refactorisé - Support asynchrone avec progression
// Version: v2.0.0
// Responsabilités: Indexation asynchrone avec task_id, progression, file d'attente
import { getRagConfigManager } from "../../config/rag-config.js";
import { logger } from "../../core/logger.js";
import { getProgressTracker } from "../../core/progress-tracker.js";
import { indexProject, updateProject } from "../../rag/indexer.js";
import { isRagInitialized } from "../../rag/phase0/rag-state.js";
import { createRagJob } from "../../rag/queue/job-types.js";
import { getRagQueue } from "../../rag/queue/rag-queue.js";
import { setEmbeddingProvider } from "../../rag/vector-store.js";
/**
 * Définition de l'outil prepare_rag (Phase 1: Préparation des fichiers)
 */
export const prepareRagTool = {
    name: "prepare_rag",
    description: "Phase 1: Préparation des fichiers pour l'embedding (chunking, nettoyage, normalisation)",
    inputSchema: {
        type: "object",
        properties: {
            project_path: {
                type: "string",
                description: "Chemin absolu vers le projet (auto-détecté si vide)"
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
            enable_llm_enrichment: {
                type: "boolean",
                description: "Activer l'enrichissement LLM optionnel",
                default: false
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
 * Définition de l'outil embed_rag (Phase 2: Génération d'embeddings)
 */
export const embedRagTool = {
    name: "embed_rag",
    description: "Phase 2: Génération d'embeddings pour les chunks préparés",
    inputSchema: {
        type: "object",
        properties: {
            project_path: {
                type: "string",
                description: "Chemin absolu vers le projet (auto-détecté si vide)"
            },
            embedding_model: {
                type: "string",
                description: "Modèle d'embedding à utiliser",
                default: "nomic-embed-text"
            },
            batch_size: {
                type: "number",
                description: "Taille des lots pour la génération d'embeddings",
                default: 32,
                minimum: 1,
                maximum: 256
            },
            max_concurrent_batches: {
                type: "number",
                description: "Nombre maximum de lots concurrents",
                default: 2,
                minimum: 1,
                maximum: 8
            },
            enable_cache: {
                type: "boolean",
                description: "Activer le cache d'embeddings",
                default: true
            },
            cache_ttl_seconds: {
                type: "number",
                description: "Durée de vie du cache en secondes",
                default: 86400,
                minimum: 60,
                maximum: 604800
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
        const mode = args.mode || 'full';
        logger.info("rag.index.start", "Début de l'indexation asynchrone", {
            project_path: projectPath,
            mode
        });
        // Créer un job d'indexation dans la file d'attente RAG
        const queue = getRagQueue();
        const job = createRagJob('index', projectPath, {
            metadata: {
                args: args,
                startTime: startTime,
                mode: mode
            }
        });
        const enqueueResult = await queue.enqueue(job);
        if (!enqueueResult.queued) {
            throw new Error(`Impossible d'ajouter le job à la file d'attente: ${enqueueResult.message}`);
        }
        logger.info("rag.index.job.created", "Job d'indexation créé", {
            jobId: job.id,
            projectPath: projectPath,
            position: enqueueResult.position
        });
        // Formater la réponse asynchrone
        const asyncResponse = {
            status: "accepted",
            action: "index_rag",
            task_id: job.id,
            execution: "background",
            message: "Indexation démarrée en arrière-plan. Utilisez get_status pour suivre la progression.",
            next_action: "get_status",
            notes_for_ai: [
                "L'indexation s'exécute de manière asynchrone",
                `Utilisez get_status avec scope=task et task_id=${job.id} pour suivre la progression`,
                "Le projet sera verrouillé pour les autres opérations mutatrices pendant l'exécution",
                "L'indexation inclut le chunking, embeddings et stockage dans la base vectorielle",
                "Après l'indexation, vous pouvez exécuter query_rag pour effectuer des recherches"
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
/**
 * Handler pour l'outil embed_rag (version asynchrone)
 * Retourne immédiatement un task_id et crée un job dans la file d'attente RAG
 */
export const embedRagHandler = async (args) => {
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
                    logger.info("rag.embed.project.auto_detected", `Projet auto-détecté: ${projectPath}`, { path: projectPath });
                }
                else {
                    throw new Error("Impossible de détecter automatiquement le projet. Spécifiez 'project_path'.");
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error("rag.embed.project.detection_error", "Erreur de détection automatique", { error: errorMessage });
                throw error;
            }
        }
        // Vérifier si le RAG est initialisé pour ce projet
        const isInitialized = await isRagInitialized(projectPath);
        if (!isInitialized) {
            const errorMessage = `RAG non initialisé pour le projet: ${projectPath}. Utilisez d'abord l'outil init_rag.`;
            logger.error("rag.embed.not_initialized", errorMessage, { project_path: projectPath });
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
        // Créer un job d'embedding dans la file d'attente RAG
        const queue = getRagQueue();
        const job = createRagJob('embed', projectPath, {
            metadata: {
                args: args,
                startTime: startTime
            }
        });
        const enqueueResult = await queue.enqueue(job);
        if (!enqueueResult.queued) {
            throw new Error(`Impossible d'ajouter le job à la file d'attente: ${enqueueResult.message}`);
        }
        logger.info("rag.embed.job.created", "Job d'embedding créé", {
            jobId: job.id,
            projectPath: projectPath,
            position: enqueueResult.position
        });
        // Formater la réponse asynchrone
        const asyncResponse = {
            status: "accepted",
            action: "embed_rag",
            task_id: job.id,
            execution: "background",
            message: "Génération d'embeddings démarrée en arrière-plan. Utilisez get_status pour suivre la progression.",
            next_action: "get_status",
            notes_for_ai: [
                "La génération d'embeddings s'exécute de manière asynchrone",
                `Utilisez get_status avec scope=task et task_id=${job.id} pour suivre la progression`,
                "Le projet sera verrouillé pour les autres opérations mutatrices pendant l'exécution",
                "Les embeddings sont générés par lots pour optimiser les performances",
                "Après la génération d'embeddings, vous pouvez exécuter index_rag"
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
        logger.error("rag.embed.error", "Erreur lors de la création du job d'embedding", {
            error: error.message,
            stack: error.stack,
            duration: `${duration}s`
        });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        status: "error",
                        error: "EMBED_JOB_CREATION_ERROR",
                        message: error.message,
                        duration_seconds: parseFloat(duration),
                        timestamp: new Date().toISOString(),
                        stack_trace: error.stack
                    }, null, 2)
                }]
        };
    }
};
/**
 * Handler pour l'outil prepare_rag (version asynchrone)
 * Retourne immédiatement un task_id et crée un job dans la file d'attente RAG
 */
export const prepareRagHandler = async (args) => {
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
                    logger.info("rag.prepare.project.auto_detected", `Projet auto-détecté: ${projectPath}`, { path: projectPath });
                }
                else {
                    throw new Error("Impossible de détecter automatiquement le projet. Spécifiez 'project_path'.");
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error("rag.prepare.project.detection_error", "Erreur de détection automatique", { error: errorMessage });
                throw error;
            }
        }
        // Vérifier si le RAG est initialisé pour ce projet
        const isInitialized = await isRagInitialized(projectPath);
        if (!isInitialized) {
            const errorMessage = `RAG non initialisé pour le projet: ${projectPath}. Utilisez d'abord l'outil init_rag.`;
            logger.error("rag.prepare.not_initialized", errorMessage, { project_path: projectPath });
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
        // Créer un job de préparation dans la file d'attente RAG
        const queue = getRagQueue();
        const job = createRagJob('prepare', projectPath, {
            metadata: {
                args: args,
                startTime: startTime
            }
        });
        const enqueueResult = await queue.enqueue(job);
        if (!enqueueResult.queued) {
            throw new Error(`Impossible d'ajouter le job à la file d'attente: ${enqueueResult.message}`);
        }
        logger.info("rag.prepare.job.created", "Job de préparation créé", {
            jobId: job.id,
            projectPath: projectPath,
            position: enqueueResult.position
        });
        // Formater la réponse asynchrone
        const asyncResponse = {
            status: "accepted",
            action: "prepare_rag",
            task_id: job.id,
            execution: "background",
            message: "Préparation démarrée en arrière-plan. Utilisez get_status pour suivre la progression.",
            next_action: "get_status",
            notes_for_ai: [
                "La préparation s'exécute de manière asynchrone",
                `Utilisez get_status avec scope=task et task_id=${job.id} pour suivre la progression`,
                "Le projet sera verrouillé pour les autres opérations mutatrices pendant l'exécution",
                "La préparation inclut le chunking, nettoyage et normalisation des fichiers",
                "Après la préparation, vous pouvez exécuter embed_rag"
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
        logger.error("rag.prepare.error", "Erreur lors de la création du job de préparation", {
            error: error.message,
            stack: error.stack,
            duration: `${duration}s`
        });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        status: "error",
                        error: "PREPARE_JOB_CREATION_ERROR",
                        message: error.message,
                        duration_seconds: parseFloat(duration),
                        timestamp: new Date().toISOString(),
                        stack_trace: error.stack
                    }, null, 2)
                }]
        };
    }
};
//# sourceMappingURL=index-rag.js.map