// src/tools/rag/cancel_task.ts
// Outil MCP pour annuler une tâche RAG en cours
// Version: v1.0.0
// Responsabilités: Annuler une tâche en cours avec vérification d'état

import { logger } from "../../core/logger.js";
import { ToolDefinition, ToolHandler } from "../../core/tool-registry.js";
import { formatErrorForMCP } from "../../rag/errors/rag-usage-error.js";
import { getRagQueue } from "../../rag/queue/rag-queue.js";

/**
 * Interface d'entrée pour cancel_task
 */
interface CancelTaskInput {
    task_id: string;
    force?: boolean;
    reason?: string;
}

/**
 * Interface de sortie pour cancel_task
 */
interface CancelTaskOutput {
    status: 'success' | 'error' | 'not_found' | 'already_completed';
    message: string;
    data?: {
        task_id: string;
        previous_state: string;
        cancelled_at: string;
        reason?: string;
    };
    metadata: {
        tool_version: string;
        timestamp: string;
        execution_time_ms: number;
    };
    notes_for_ai?: string[];
    allowed_actions?: string[];
    next_steps?: string[];
}

/**
 * Définition de l'outil cancel_task
 */
export const cancelTaskTool: ToolDefinition = {
    name: "cancel_task",
    description: "Annule une tâche RAG en cours d'exécution",
    inputSchema: {
        type: "object",
        properties: {
            task_id: {
                type: "string",
                description: "ID de la tâche à annuler"
            },
            force: {
                type: "boolean",
                description: "Forcer l'annulation même si la tâche est en état final",
                default: false
            },
            reason: {
                type: "string",
                description: "Raison de l'annulation (pour les logs)"
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
        // Validation des arguments
        const input: CancelTaskInput = {
            task_id: args.task_id,
            force: args.force || false,
            reason: args.reason
        };

        if (!input.task_id || typeof input.task_id !== 'string') {
            throw new Error("task_id est requis et doit être une chaîne de caractères");
        }

        logger.info("rag.cancel_task.request", "Demande d'annulation de tâche", {
            task_id: input.task_id,
            force: input.force,
            reason: input.reason
        });

        // Récupérer la file d'attente RAG
        const ragQueue = getRagQueue();

        // Vérifier si la tâche existe
        const job = ragQueue.getJob(input.task_id);
        if (!job) {
            const output: CancelTaskOutput = {
                status: 'not_found',
                message: `Tâche non trouvée: ${input.task_id}`,
                metadata: {
                    tool_version: '1.0',
                    timestamp: new Date().toISOString(),
                    execution_time_ms: Date.now() - startTime
                }
            };

            logger.warn("rag.cancel_task.not_found", "Tâche non trouvée", {
                task_id: input.task_id
            });

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(output, null, 2)
                }]
            };
        }

        // Vérifier l'état actuel de la tâche
        const currentStatus = job.status;
        const finalStatuses = ['done', 'failed'];

        if (finalStatuses.includes(currentStatus) && !input.force) {
            const output: CancelTaskOutput = {
                status: 'already_completed',
                message: `La tâche est déjà dans un état final (${currentStatus}). Utilisez force=true pour forcer l'annulation.`,
                data: {
                    task_id: input.task_id,
                    previous_state: currentStatus,
                    cancelled_at: new Date().toISOString(),
                    reason: input.reason
                },
                metadata: {
                    tool_version: '1.0',
                    timestamp: new Date().toISOString(),
                    execution_time_ms: Date.now() - startTime
                }
            };

            logger.warn("rag.cancel_task.already_final", "Tâche déjà dans un état final", {
                task_id: input.task_id,
                current_status: currentStatus
            });

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(output, null, 2)
                }]
            };
        }

        // Annuler la tâche
        const cancelled = ragQueue.cancelJob(input.task_id);

        if (!cancelled) {
            throw new Error(`Échec de l'annulation de la tâche: ${input.task_id}`);
        }

        // Récupérer l'état mis à jour
        const updatedJob = ragQueue.getJob(input.task_id);
        const newStatus = updatedJob?.status || 'unknown';

        const output: CancelTaskOutput = {
            status: 'success',
            message: `Tâche annulée avec succès: ${input.task_id}`,
            data: {
                task_id: input.task_id,
                previous_state: currentStatus,
                cancelled_at: new Date().toISOString(),
                reason: input.reason
            },
            metadata: {
                tool_version: '1.0',
                timestamp: new Date().toISOString(),
                execution_time_ms: Date.now() - startTime
            },
            notes_for_ai: [
                `Tâche ${input.task_id} annulée avec succès`,
                `État précédent: ${currentStatus}`,
                `Nouvel état: ${newStatus}`,
                input.reason ? `Raison: ${input.reason}` : "Aucune raison spécifiée"
            ],
            allowed_actions: ['get_status', 'query_rag'],
            next_steps: [
                "Utilisez get_status pour vérifier l'état du système",
                "Utilisez query_rag pour effectuer des recherches",
                "Si nécessaire, relancez la tâche annulée"
            ]
        };

        logger.info("rag.cancel_task.success", "Tâche annulée avec succès", {
            task_id: input.task_id,
            previous_status: currentStatus,
            new_status: newStatus,
            reason: input.reason
        });

        return {
            content: [{
                type: "text",
                text: JSON.stringify(output, null, 2)
            }]
        };

    } catch (error: any) {
        const endTime = Date.now();
        const duration = endTime - startTime;

        logger.error("rag.cancel_task.error", "Erreur lors de l'annulation de la tâche", {
            error: error.message,
            stack: error.stack,
            duration_ms: duration
        });

        // Utiliser le formateur d'erreur MCP
        const mcpError = formatErrorForMCP(error);

        return {
            content: [{
                type: "text",
                text: JSON.stringify(mcpError, null, 2)
            }]
        };
    }
};

/**
 * Fonction utilitaire pour annuler une tâche (pour usage interne)
 */
export async function cancelTaskInternal(taskId: string): Promise<boolean> {
    const ragQueue = getRagQueue();
    return ragQueue.cancelJob(taskId);
}

/**
 * Export par défaut
 */
export default {
    cancelTaskTool,
    cancelTaskHandler
};
