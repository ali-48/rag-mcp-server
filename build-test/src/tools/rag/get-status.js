// src/tools/rag/get-status.ts
// Outil MCP pour récupérer le statut RAG (global, projet, tâche)
// Version: v1.0.0
// Responsabilités: Fournir une vue unifiée du statut RAG avec notes pour l'IA
import { logger } from "../../core/logger.js";
import { formatErrorForMCP } from "../../rag/errors/rag-usage-error.js";
import { getPhaseAnalysis } from "../../rag/guards/rag-guards.js";
import { getTaskStatus } from "../../rag/queue/job-types.js";
import { getRagQueue } from "../../rag/queue/rag-queue.js";
import { StateManager } from "../../rag/state-manager.js";
/**
 * Définition de l'outil get_status
 */
export const getStatusTool = {
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
export const getStatusHandler = async (args) => {
    const startTime = Date.now();
    try {
        const scope = (args.scope || "global");
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
        let response;
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
    }
    catch (error) {
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
async function handleGlobalStatus() {
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
        "Système RAG: opérationnel",
        "Scope disponible: global, project, task",
        "Actions disponibles: init_rag, scan_rag, prepare_rag, embed_rag, index_rag, query_rag, get_status"
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
 * Détermine les actions autorisées basées sur l'analyse des phases
 */
function determineAllowedActions(phaseAnalysis) {
    const allowedActions = ['get_status']; // Toujours autorisé
    // Basé sur la phase actuelle et le statut
    const currentPhase = phaseAnalysis.current_phase;
    const currentStatus = phaseAnalysis.current_status;
    const nextPhase = phaseAnalysis.next_phase;
    // Ajouter init_rag si le projet n'est pas initialisé
    if (currentPhase === 'init' && currentStatus === 'pending') {
        allowedActions.push('init_rag');
        return allowedActions;
    }
    // Si le projet est initialisé, ajouter les outils selon les phases
    allowedActions.push('scan_rag');
    if (currentPhase === 'scan' && currentStatus === 'done') {
        allowedActions.push('prepare_rag');
    }
    if (currentPhase === 'prepare' && currentStatus === 'done') {
        allowedActions.push('embed_rag');
    }
    if (currentPhase === 'embed' && currentStatus === 'done') {
        allowedActions.push('index_rag');
    }
    if (currentPhase === 'index' && currentStatus === 'done') {
        allowedActions.push('query_rag');
    }
    // Si une phase est en cours, ajouter l'outil correspondant
    if (currentStatus === 'running') {
        const toolMap = {
            'scan': 'scan_rag',
            'prepare': 'prepare_rag',
            'embed': 'embed_rag',
            'index': 'index_rag'
        };
        if (toolMap[currentPhase]) {
            allowedActions.push(toolMap[currentPhase]);
        }
    }
    return allowedActions;
}
/**
 * Gère le statut d'un projet
 */
async function handleProjectStatus(projectId) {
    const stateManager = StateManager.getInstance();
    const projectStatus = await stateManager.getProjectStatus(projectId);
    // Utiliser les guards pour analyser les phases et déterminer les actions autorisées
    const phaseAnalysis = await getPhaseAnalysis(projectId);
    const allowed_actions = determineAllowedActions(phaseAnalysis);
    // Construire les notes pour l'IA
    const notes_for_ai = [
        ...projectStatus.notes_for_ai,
        ...phaseAnalysis.notes_for_ai,
        "Projet: " + projectId,
        "Phase actuelle: " + phaseAnalysis.current_phase,
        "Statut phase: " + phaseAnalysis.current_status,
        "Phase suivante: " + (phaseAnalysis.next_phase || "aucune"),
        "Actions autorisées: " + allowed_actions.join(", ")
    ];
    // Déterminer l'action requise
    let required_action = projectStatus.required_action;
    if (phaseAnalysis.next_phase) {
        const toolMap = {
            'init': 'init_rag',
            'scan': 'scan_rag',
            'prepare': 'prepare_rag',
            'embed': 'embed_rag',
            'index': 'index_rag',
            'query': 'query_rag'
        };
        const nextTool = toolMap[phaseAnalysis.next_phase];
        if (nextTool) {
            required_action = `Exécutez ${nextTool} pour continuer le pipeline`;
        }
    }
    return {
        status: 'ok',
        scope: 'project',
        data: projectStatus,
        notes_for_ai,
        allowed_actions,
        required_action
    };
}
/**
 * Gère le statut d'une tâche
 */
async function handleTaskStatus(taskId) {
    const ragQueue = getRagQueue();
    const job = ragQueue.getJob(taskId);
    if (!job) {
        throw new Error(`Tâche non trouvée: ${taskId}`);
    }
    const taskStatus = getTaskStatus(job);
    // Les actions autorisées sont déjà définies dans taskStatus
    const notes_for_ai = [
        ...taskStatus.notes_for_ai,
        "Tâche: " + taskId,
        "État: " + taskStatus.state,
        "Progression: " + (taskStatus.progress || 0) + "%",
        "Actions autorisées: " + (taskStatus.allowed_actions?.join(", ") || "aucune")
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
//# sourceMappingURL=get-status.js.map