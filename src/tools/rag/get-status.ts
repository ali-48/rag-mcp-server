// src/tools/rag/get-status.ts
// Outil MCP pour récupérer le statut RAG (global, projet, tâche)
// Version: v1.0.0
// Responsabilités: Fournir une vue unifiée du statut RAG avec notes pour l'IA

import { logger } from "../../core/logger.js";
import { ToolDefinition, ToolHandler } from "../../core/tool-registry.js";
import { formatErrorForMCP } from "../../rag/errors/rag-usage-error.js";
import { getTaskStatus } from "../../rag/queue/job-types.js";
import { getRagQueue } from "../../rag/queue/rag-queue.js";
import { StateManager } from "../../rag/state-manager.js";
import { GetStatusResponse, StatusScope } from "../../rag/types.js";

/**
 * Définition de l'outil get_status
 */
export const getStatusTool: ToolDefinition = {
    name: "get_status",
    description: "Récupère le statut RAG (global, projet ou tâche) avec notes pour l'IA et actions autorisées",
    inputSchema: {
        type: "object",
        properties: {
            scope: {
                type: "string",
                enum: ["global", "project", "task"],
                description: "Scope du statut à récupérer",
                default: "global"
            },
            project_id: {
                type: "string",
                description: "ID du projet (requis si scope=project)"
            },
            task_id: {
                type: "string",
                description: "ID de la tâche (requis si scope=task)"
            },
            include_notes_for_ai: {
                type: "boolean",
                description: "Inclure les notes pour l'IA",
                default: true
            },
            include_allowed_actions: {
                type: "boolean",
                description: "Inclure les actions autorisées",
                default: true
            }
        },
        required: []
    },
};

/**
 * Handler pour l'outil get_status
 */
export const getStatusHandler: ToolHandler = async (args) => {
    const startTime = Date.now();

    try {
        const scope = (args.scope || "global") as StatusScope;
        const projectId = args.project_id;
        const taskId = args.task_id;
        const includeNotesForAI = args.include_notes_for_ai !== false;
        const includeAllowedActions = args.include_allowed_actions !== true;

        logger.info("rag.status.request", "Demande de statut RAG", {
            scope,
            projectId,
            taskId,
            includeNotesForAI,
            includeAllowedActions
        });

        let response: GetStatusResponse;

        switch (scope) {
            case "global":
                response = await handleGlobalStatus();
                break;
            case "project":
                if (!projectId) {
                    throw new Error("project_id est requis pour scope=project");
                }
                response = await handleProjectStatus(projectId);
                break;
            case "task":
                if (!taskId) {
                    throw new Error("task_id est requis pour scope=task");
                }
                response = await handleTaskStatus(taskId);
                break;
            default:
                throw new Error(`Scope invalide: ${scope}`);
        }

        // Filtrer les champs optionnels si demandé
        if (!includeNotesForAI) {
            response.notes_for_ai = [];
        }
        if (!includeAllowedActions) {
            delete response.allowed_actions;
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        logger.info("rag.status.success", "Statut RAG récupéré", {
            scope,
            projectId,
            taskId,
            status: response.status,
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

        logger.error("rag.status.error", "Erreur lors de la récupération du statut", {
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
 * Gère le statut global
 */
async function handleGlobalStatus(): Promise<GetStatusResponse> {
    const ragQueue = getRagQueue();
    const globalStatus = ragQueue.getGlobalStatus();

    // Déterminer les actions autorisées basées sur l'état global
    const allowed_actions = [
        'init_rag',
        'scan_rag',
        'prepare_rag',
        'embed_rag',
        'index_rag',
        'query_rag',
        'get_status'
    ];

    const notes_for_ai = [
        ...globalStatus.notes_for_ai,
        "Le système RAG est opérationnel",
        "Utilisez get_status avec scope=project pour voir l'état détaillé d'un projet",
        "Utilisez get_status avec scope=task pour suivre une tâche spécifique"
    ];

    return {
        status: 'ok',
        scope: 'global',
        data: globalStatus,
        notes_for_ai,
        allowed_actions,
        required_action: undefined
    };
}

/**
 * Gère le statut d'un projet
 */
async function handleProjectStatus(projectId: string): Promise<GetStatusResponse> {
    const stateManager = StateManager.getInstance();
    const projectStatus = await stateManager.getProjectStatus(projectId);

    // Les actions autorisées sont déjà définies dans projectStatus
    const notes_for_ai = [
        ...projectStatus.notes_for_ai,
        "Utilisez get_status avec scope=task pour suivre les tâches de ce projet",
        "Les actions autorisées dépendent de l'état du pipeline RAG"
    ];

    return {
        status: 'ok',
        scope: 'project',
        data: projectStatus,
        notes_for_ai,
        allowed_actions: projectStatus.allowed_actions,
        required_action: projectStatus.required_action
    };
}

/**
 * Gère le statut d'une tâche
 */
async function handleTaskStatus(taskId: string): Promise<GetStatusResponse> {
    const ragQueue = getRagQueue();
    const job = ragQueue.getJob(taskId);

    if (!job) {
        throw new Error(`Tâche non trouvée: ${taskId}`);
    }

    const taskStatus = getTaskStatus(job);

    // Les actions autorisées sont déjà définies dans taskStatus
    const notes_for_ai = [
        ...taskStatus.notes_for_ai,
        "Utilisez get_status avec scope=project pour voir l'état du projet",
        "Les actions autorisées dépendent de l'état de la tâche"
    ];

    return {
        status: 'ok',
        scope: 'task',
        data: taskStatus,
        notes_for_ai,
        allowed_actions: taskStatus.allowed_actions,
        required_action: taskStatus.required_action
    };
}

/**
 * Export par défaut
 */
export default {
    getStatusTool,
    getStatusHandler
};
