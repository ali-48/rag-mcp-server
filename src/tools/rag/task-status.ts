// src/tools/rag/task-status.ts
// Outils MCP pour la gestion des tâches asynchrones
// Version: v1.0.0
// Responsabilités: Annulation de tâches, liste des tâches
// NOTE: get_task_status a été supprimé - utilisez get_status à la place

import { logger } from "../../core/logger.js";
import { getProgressTracker, ProgressStatus } from "../../core/progress-tracker.js";
import { getTaskQueue } from "../../core/task-queue.js";
import { ToolDefinition, ToolHandler } from "../../core/tool-registry.js";

/**
 * Définition de l'outil cancel_task
 */
export const cancelTaskTool: ToolDefinition = {
    name: "cancel_task",
    description: "Annule une tâche RAG asynchrone en cours d'exécution ou en file d'attente",
    inputSchema: {
        type: "object",
        properties: {
            task_id: {
                type: "string",
                description: "ID de la tâche à annuler (obtenu via index_rag ou activated_rag)"
            },
            reason: {
                type: "string",
                description: "Raison de l'annulation (optionnel)",
                default: "Annulée par l'utilisateur"
            },
            force: {
                type: "boolean",
                description: "Forcer l'annulation même si la tâche est en cours d'exécution",
                default: false
            }
        },
        required: ["task_id"]
    },
};

/**
 * Handler pour l'outil cancel_task
 */
export const cancelTaskHandler: ToolHandler = async (args) => {
    const startTime = Date.now();

    try {
        const taskId = args.task_id;
        const reason = args.reason || "Annulée par l'utilisateur";
        const force = args.force === true;

        logger.info("task.cancel.request", "Demande d'annulation de tâche", {
            taskId,
            reason,
            force
        });

        // Vérifier d'abord si la tâche existe
        const progressTracker = getProgressTracker();
        const currentStatus = progressTracker.get(taskId);

        if (!currentStatus) {
            logger.warn("task.cancel.not_found", "Tâche non trouvée pour annulation", { taskId });

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: false,
                        error: "TASK_NOT_FOUND",
                        message: `Tâche non trouvée: ${taskId}`,
                        task_id: taskId,
                        timestamp: new Date().toISOString(),
                        notes_for_ai: [
                            "Tâche non trouvée",
                            "Vérifier l'ID de tâche",
                            "Utiliser list_tasks pour voir les tâches disponibles"
                        ]
                    }, null, 2)
                }]
            };
        }

        // Vérifier si la tâche peut être annulée
        if (currentStatus.state === 'completed') {
            logger.warn("task.cancel.already_completed", "Tâche déjà terminée", {
                taskId,
                state: currentStatus.state
            });

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: false,
                        error: "TASK_ALREADY_COMPLETED",
                        message: `Tâche déjà terminée: ${taskId}`,
                        task_id: taskId,
                        current_state: currentStatus.state,
                        timestamp: new Date().toISOString(),
                        notes_for_ai: [
                            "Tâche déjà terminée",
                            "État: " + currentStatus.state,
                            "Utiliser get_status pour voir les résultats"
                        ]
                    }, null, 2)
                }]
            };
        }

        if (currentStatus.state === 'failed') {
            logger.warn("task.cancel.already_failed", "Tâche déjà échouée", {
                taskId,
                state: currentStatus.state
            });

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: false,
                        error: "TASK_ALREADY_FAILED",
                        message: `Tâche déjà échouée: ${taskId}`,
                        task_id: taskId,
                        current_state: currentStatus.state,
                        timestamp: new Date().toISOString(),
                        notes_for_ai: [
                            "Tâche déjà échouée",
                            "État: " + currentStatus.state,
                            "Utiliser get_status pour voir les détails de l'erreur"
                        ]
                    }, null, 2)
                }]
            };
        }

        if (currentStatus.state === 'cancelled') {
            logger.warn("task.cancel.already_cancelled", "Tâche déjà annulée", {
                taskId,
                state: currentStatus.state
            });

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: false,
                        error: "TASK_ALREADY_CANCELLED",
                        message: `Tâche déjà annulée: ${taskId}`,
                        task_id: taskId,
                        current_state: currentStatus.state,
                        timestamp: new Date().toISOString(),
                        notes_for_ai: [
                            "Tâche déjà annulée",
                            "État: " + currentStatus.state,
                            "Utiliser get_status pour voir le statut final"
                        ]
                    }, null, 2)
                }]
            };
        }

        // Annuler la tâche via la file d'attente
        const taskQueue = getTaskQueue();
        let cancelled = false;
        let cancellationMethod = 'unknown';

        // Essayer d'annuler via la file d'attente
        cancelled = taskQueue.cancel(taskId);

        if (cancelled) {
            cancellationMethod = 'queue_cancellation';
            logger.info("task.cancel.queue_success", "Tâche annulée via la file d'attente", {
                taskId,
                reason
            });
        } else if (force) {
            // Forcer l'annulation via le ProgressTracker
            cancelled = progressTracker.cancel(taskId, reason);
            if (cancelled) {
                cancellationMethod = 'forced_cancellation';
                logger.info("task.cancel.forced_success", "Tâche annulée de force", {
                    taskId,
                    reason
                });
            }
        }

        if (!cancelled) {
            logger.error("task.cancel.failed", "Échec de l'annulation de la tâche", {
                taskId,
                current_state: currentStatus.state,
                force
            });

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: false,
                        error: "CANCELLATION_FAILED",
                        message: `Annulation échouée: ${taskId}`,
                        task_id: taskId,
                        current_state: currentStatus.state,
                        timestamp: new Date().toISOString(),
                        notes_for_ai: [
                            "Annulation échouée",
                            "État actuel: " + currentStatus.state,
                            "Force utilisée: " + force,
                            "Recommandation: " + (force ? "Tâche trop avancée pour annulation" : "Essayer avec force=true")
                        ]
                    }, null, 2)
                }]
            };
        }

        // Récupérer le statut final
        const finalStatus = progressTracker.get(taskId);

        const endTime = Date.now();
        const duration = endTime - startTime;

        const response = {
            success: true,
            task_id: taskId,
            cancelled: true,
            cancellation_method: cancellationMethod,
            reason: reason,
            final_status: {
                state: finalStatus?.state || 'cancelled',
                step: finalStatus?.step || 'cancelled',
                progress: finalStatus?.progress || 0,
                files_processed: finalStatus?.filesProcessed || 0,
                files_total: finalStatus?.filesTotal || 0
            },
            previous_state: currentStatus.state,
            duration_ms: duration,
            timestamp: new Date().toISOString(),
            notes_for_ai: [
                "Annulation réussie",
                "Méthode: " + cancellationMethod,
                "État précédent: " + currentStatus.state,
                "État final: " + (finalStatus?.state || 'cancelled'),
                "Durée: " + duration + "ms"
            ],
            recommendations: [
                "Vérifier statut avec get_status",
                "Relancer indexation si nécessaire"
            ]
        };

        logger.info("task.cancel.success", "Tâche annulée avec succès", {
            taskId,
            previous_state: currentStatus.state,
            cancellation_method: cancellationMethod,
            duration_ms: duration
        });

        return {
            content: [{
                type: "text",
                text: JSON.stringify(response, null, 2)
            }]
        };

    } catch (error: any) {
        const endTime = Date.now();
        const duration = endTime - startTime;

        logger.error("task.cancel.error", "Erreur lors de l'annulation de la tâche", {
            error: error.message,
            stack: error.stack,
            duration_ms: duration
        });

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    success: false,
                    error: "CANCELLATION_ERROR",
                    message: error.message,
                    duration_ms: duration,
                    timestamp: new Date().toISOString()
                }, null, 2)
            }]
        };
    }
};

/**
 * Définition de l'outil list_tasks (bonus)
 */
export const listTasksTool: ToolDefinition = {
    name: "list_tasks",
    description: "Liste toutes les tâches RAG pour un projet ou tous les projets",
    inputSchema: {
        type: "object",
        properties: {
            project_path: {
                type: "string",
                description: "Chemin du projet (optionnel, liste toutes les tâches si vide)"
            },
            state_filter: {
                type: "string",
                enum: ["all", "queued", "running", "completed", "failed", "cancelled"],
                description: "Filtrer par état",
                default: "all"
            },
            limit: {
                type: "number",
                description: "Nombre maximum de tâches à retourner",
                default: 50,
                minimum: 1,
                maximum: 1000
            },
            include_stats: {
                type: "boolean",
                description: "Inclure les statistiques globales",
                default: true
            }
        },
        required: []
    },
};

/**
 * Handler pour l'outil list_tasks
 */
export const listTasksHandler: ToolHandler = async (args) => {
    const startTime = Date.now();

    try {
        const projectPath = args.project_path;
        const stateFilter = args.state_filter || 'all';
        const limit = Math.min(args.limit || 50, 1000);
        const includeStats = args.include_stats !== false;

        logger.info("task.list.request", "Liste des tâches demandée", {
            projectPath,
            stateFilter,
            limit,
            includeStats
        });

        const progressTracker = getProgressTracker();
        const taskQueue = getTaskQueue();

        let tasks: ProgressStatus[] = [];

        // Récupérer les tâches
        if (projectPath) {
            // Tâches pour un projet spécifique
            tasks = progressTracker.listByProject(projectPath);
        } else {
            // Toutes les tâches (approximation)
            // Note: ProgressTracker n'a pas de méthode listAll, donc on utilise listByState
            if (stateFilter === 'all') {
                const states: Array<ProgressStatus['state']> = ['queued', 'running', 'completed', 'failed', 'cancelled'];
                for (const state of states) {
                    tasks.push(...progressTracker.listByState(state));
                }
            } else {
                tasks = progressTracker.listByState(stateFilter as ProgressStatus['state']);
            }
        }

        // Appliquer le filtre d'état si spécifié et pas déjà filtré
        if (stateFilter !== 'all' && !projectPath) {
            // Déjà filtré par listByState
        } else if (stateFilter !== 'all') {
            tasks = tasks.filter(task => task.state === stateFilter);
        }

        // Limiter le nombre de résultats
        tasks = tasks.slice(0, limit);

        // Trier par date de création (plus récent d'abord)
        tasks.sort((a, b) =>
            new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
        );

        // Préparer la réponse
        const response: any = {
            success: true,
            tasks: tasks.map(task => ({
                task_id: task.taskId,
                project_path: task.projectPath,
                state: task.state,
                step: task.step,
                progress: task.progress,
                files_processed: task.filesProcessed,
                files_total: task.filesTotal,
                started_at: task.startedAt,
                updated_at: task.updatedAt,
                completed_at: task.completedAt
            })),
            total_tasks: tasks.length,
            timestamp: new Date().toISOString(),
            notes_for_ai: [
                "Liste des tâches récupérée",
                "Filtre: " + (projectPath || "tous les projets"),
                "État: " + stateFilter,
                "Limite: " + limit,
                "Total: " + tasks.length + " tâches"
            ]
        };

        // Ajouter les statistiques si demandées
        if (includeStats) {
            const stats = progressTracker.getStats();
            const queueStats = taskQueue.getStats();

            response.stats = {
                progress_tracker: {
                    total_tasks: stats.totalTasks,
                    by_state: stats.byState,
                    memory_usage_kb: stats.memoryUsage
                },
                task_queue: {
                    total_projects: queueStats.totalProjects,
                    total_queued_tasks: queueStats.totalQueuedTasks,
                    total_running_tasks: queueStats.totalRunningTasks
                }
            };
        }

        const endTime = Date.now();
        response.duration_ms = endTime - startTime;

        logger.info("task.list.success", "Liste des tâches récupérée", {
            total_tasks: tasks.length,
            project_path: projectPath || 'all',
            state_filter: stateFilter,
            duration_ms: response.duration_ms
        });

        return {
            content: [{
                type: "text",
                text: JSON.stringify(response, null, 2)
            }]
        };

    } catch (error: any) {
        const endTime = Date.now();
        const duration = endTime - startTime;

        logger.error("task.list.error", "Erreur lors de la liste des tâches", {
            error: error.message,
            stack: error.stack,
            duration_ms: duration
        });

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    success: false,
                    error: "LIST_ERROR",
                    message: `Erreur liste tâches: ${error.message}`,
                    duration_ms: duration,
                    timestamp: new Date().toISOString(),
                    notes_for_ai: [
                        "Erreur lors de la liste des tâches",
                        "Message: " + error.message,
                        "Durée: " + duration + "ms"
                    ]
                }, null, 2)
            }]
        };
    }
};
