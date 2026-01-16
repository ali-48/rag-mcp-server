// src/rag/response-formatter.ts
// Formateur de réponse standardisé pour les outils RAG
// Responsabilités: Formatage cohérent des réponses asynchrones, erreurs, statuts
/**
 * Formate une réponse asynchrone standard pour les outils RAG
 * Utilisé par scan_rag, prepare_rag, embed_rag, index_rag
 */
export function formatAsyncResponse(action, taskId, message, options = {}) {
    const { execution = 'background', notesForAI = [] } = options;
    // Notes par défaut basées sur l'action
    const defaultNotes = getDefaultNotesForAction(action, taskId);
    const allNotes = [...defaultNotes, ...notesForAI];
    return {
        status: "accepted",
        action,
        task_id: taskId,
        execution,
        message,
        next_action: "get_status",
        notes_for_ai: allNotes
    };
}
/**
 * Génère des notes par défaut pour l'IA basées sur l'action
 */
function getDefaultNotesForAction(action, taskId) {
    const baseNotes = [
        `L'action '${action}' s'exécute de manière asynchrone`,
        `Utilisez get_status avec scope=task et task_id=${taskId} pour suivre la progression`,
        "Le projet sera verrouillé pour les autres opérations mutatrices pendant l'exécution"
    ];
    switch (action) {
        case 'scan_rag':
            return [
                ...baseNotes,
                "Le scan analyse la structure du projet et détecte les fichiers",
                "Après le scan, vous pouvez exécuter prepare_rag"
            ];
        case 'prepare_rag':
            return [
                ...baseNotes,
                "La préparation inclut le chunking, nettoyage et normalisation des fichiers",
                "Après la préparation, vous pouvez exécuter embed_rag"
            ];
        case 'embed_rag':
            return [
                ...baseNotes,
                "Les embeddings sont générés par lots pour optimiser les performances",
                "Après la génération d'embeddings, vous pouvez exécuter index_rag"
            ];
        case 'index_rag':
            return [
                ...baseNotes,
                "L'indexation inclut le chunking, embeddings et stockage dans la base vectorielle",
                "Après l'indexation, vous pouvez exécuter query_rag pour effectuer des recherches"
            ];
        default:
            return baseNotes;
    }
}
/**
 * Formate une réponse d'erreur standardisée
 */
export function formatErrorResponse(errorCode, errorMessage, options = {}) {
    const { requiredAction, details = {}, stackTrace, notesForAI = [], allowedActions, nextSteps } = options;
    // Notes par défaut pour les erreurs
    const defaultNotes = [
        "Une erreur s'est produite lors de l'exécution",
        "Vérifiez les paramètres d'entrée et les conditions préalables",
        "Consultez les détails de l'erreur pour plus d'informations"
    ];
    const response = {
        status: "error",
        error: errorCode,
        message: errorMessage,
        timestamp: new Date().toISOString(),
        details,
        notes_for_ai: [...defaultNotes, ...notesForAI]
    };
    if (requiredAction) {
        response.required_action = requiredAction;
    }
    if (stackTrace) {
        response.stack_trace = stackTrace;
    }
    if (allowedActions) {
        response.allowed_actions = allowedActions;
    }
    if (nextSteps) {
        response.next_steps = nextSteps;
    }
    return response;
}
/**
 * Formate une réponse de statut global
 */
export function formatGlobalStatus(status, options = {}) {
    const { notesForAI = [], allowedActions, requiredAction } = options;
    const allNotes = [
        "Statut global du système RAG",
        `Projets actifs: ${status.rag_state.total_projects}`,
        `Jobs en cours: ${status.rag_state.active_jobs}`,
        `Jobs en attente: ${status.rag_state.queued_jobs}`,
        ...notesForAI
    ];
    return {
        status: status.status,
        scope: 'global',
        data: status,
        notes_for_ai: allNotes,
        allowed_actions: allowedActions,
        required_action: requiredAction
    };
}
/**
 * Formate une réponse de statut de projet
 */
export function formatProjectStatus(status, options = {}) {
    const { notesForAI = [], allowedActions, requiredAction } = options;
    // Détecter la phase actuelle et la prochaine action recommandée
    const pipeline = status.pipeline;
    const currentPhase = getCurrentPhase(pipeline);
    const nextPhase = getNextPhase(pipeline);
    const allNotes = [
        `Statut du projet: ${status.project_id}`,
        `Phase actuelle: ${currentPhase}`,
        nextPhase ? `Phase suivante recommandée: ${nextPhase}` : "Pipeline complet",
        ...notesForAI
    ];
    return {
        status: status.status,
        scope: 'project',
        data: status,
        notes_for_ai: allNotes,
        allowed_actions: allowedActions || status.allowed_actions,
        required_action: requiredAction || status.required_action
    };
}
/**
 * Formate une réponse de statut de tâche
 */
export function formatTaskStatus(status, options = {}) {
    const { notesForAI = [], allowedActions, requiredAction } = options;
    const allNotes = [
        `Statut de la tâche: ${status.task_id}`,
        `Action: ${status.action}`,
        `État: ${status.state}`,
        `Progression: ${status.progress.percent}%`,
        status.project_locked ? "Projet verrouillé pour les opérations mutatrices" : "Projet disponible",
        ...status.notes_for_ai,
        ...notesForAI
    ];
    return {
        status: status.status,
        scope: 'task',
        data: status,
        notes_for_ai: allNotes,
        allowed_actions: allowedActions || status.allowed_actions,
        required_action: requiredAction || status.required_action
    };
}
/**
 * Détecte la phase actuelle du pipeline
 */
function getCurrentPhase(pipeline) {
    const phases = [
        { key: 'init_rag', name: 'Initialisation' },
        { key: 'scan_rag', name: 'Scan' },
        { key: 'prepare_rag', name: 'Préparation' },
        { key: 'embed_rag', name: 'Embedding' },
        { key: 'index_rag', name: 'Indexation' }
    ];
    for (const phase of phases) {
        if (pipeline[phase.key] === 'running') {
            return phase.name;
        }
    }
    // Si aucune phase en cours, retourner la dernière phase terminée
    for (let i = phases.length - 1; i >= 0; i--) {
        if (pipeline[phases[i].key] === 'done') {
            return phases[i].name;
        }
    }
    return 'init_rag';
}
/**
 * Détecte la prochaine phase à exécuter
 */
function getNextPhase(pipeline) {
    const phases = [
        { key: 'init_rag', name: 'init_rag' },
        { key: 'scan_rag', name: 'scan_rag' },
        { key: 'prepare_rag', name: 'prepare_rag' },
        { key: 'embed_rag', name: 'embed_rag' },
        { key: 'index_rag', name: 'index_rag' }
    ];
    for (const phase of phases) {
        const status = pipeline[phase.key];
        if (status === 'pending' || status === 'error') {
            return phase.name;
        }
    }
    return null; // Toutes les phases sont terminées
}
/**
 * Formate une réponse de succès pour les opérations synchrones
 */
export function formatSuccessResponse(message, data = {}, options = {}) {
    const { nextSteps = [], notesForAI = [] } = options;
    return {
        status: "ok",
        message,
        data,
        next_steps: nextSteps,
        notes_for_ai: notesForAI,
        timestamp: new Date().toISOString()
    };
}
/**
 * Formate une réponse de validation d'erreur pour les schémas MCP
 */
export function formatValidationError(errors, received, options = {}) {
    const { notesForAI = [], allowedActions, nextSteps } = options;
    const defaultNotes = [
        "Les paramètres fournis ne respectent pas le schéma attendu",
        "Vérifiez la documentation de l'outil pour connaître les paramètres requis",
        "Utilisez des valeurs valides pour chaque paramètre"
    ];
    const response = {
        status: "error",
        error: "VALIDATION_ERROR",
        message: "Erreur de validation des paramètres d'entrée",
        details: {
            errors,
            received
        },
        timestamp: new Date().toISOString(),
        notes_for_ai: [...defaultNotes, ...notesForAI]
    };
    if (allowedActions) {
        response.allowed_actions = allowedActions;
    }
    if (nextSteps) {
        response.next_steps = nextSteps;
    }
    return response;
}
//# sourceMappingURL=response-formatter.js.map