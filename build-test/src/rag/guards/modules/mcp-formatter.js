// src/rag/guards/modules/mcp-formatter.ts
// Formatage JSON strict pour les réponses MCP (Règle R3)
/**
 * Crée un format MCP à partir d'une erreur RagUsageError
 */
export function createMCPErrorFromRagError(error, recommendations = []) {
    const notesForAI = [
        `Erreur de guard: ${error.code || 'RAG_PHASE_REQUIREMENTS_NOT_MET'}`,
        error.message,
        ...recommendations.map(rec => `Recommandation: ${rec}`)
    ];
    if (error.requiredAction) {
        notesForAI.push(`Action requise: ${error.requiredAction}`);
    }
    return {
        status: 'error',
        error: error.code || 'RAG_PHASE_REQUIREMENTS_NOT_MET',
        message: error.message,
        required_action: error.requiredAction,
        notes_for_ai: notesForAI,
        details: error.details
    };
}
/**
 * Crée un format MCP pour un succès
 */
export function createMCPSuccess(message, data, notesForAI) {
    return {
        status: 'success',
        message,
        data,
        notes_for_ai: notesForAI || []
    };
}
/**
 * Crée un format MCP pour un avertissement
 */
export function createMCPWarning(message, warnings, details, notesForAI) {
    return {
        status: 'warning',
        message,
        warnings,
        notes_for_ai: notesForAI || [],
        details
    };
}
/**
 * Crée un format MCP pour une analyse de phase
 */
export function createMCPPhaseAnalysis(analysis, notesForAI = []) {
    return {
        status: 'analysis',
        analysis,
        notes_for_ai: notesForAI
    };
}
/**
 * Formate un message d'erreur pour l'utilisateur (sans icônes, conforme à R3)
 */
export function formatUserErrorMessage(error) {
    const lines = [];
    // Message principal
    lines.push(`Erreur: ${error.message}`);
    // Code d'erreur
    if (error.code) {
        lines.push(`Code: ${error.code}`);
    }
    // Action requise
    if (error.requiredAction) {
        lines.push('');
        lines.push('Action requise:');
        lines.push(error.requiredAction);
    }
    // Aide
    if (error.help) {
        lines.push('');
        lines.push(`Aide: ${error.help}`);
    }
    // Recommandations
    if (error.details?.recommendations) {
        lines.push('');
        lines.push('Recommandations:');
        error.details.recommendations.forEach((rec, index) => {
            lines.push(`${index + 1}. ${rec}`);
        });
    }
    return lines.join('\n');
}
/**
 * Valide qu'un objet JSON ne contient pas d'icônes (conforme à R3)
 */
export function validateJSONStrict(obj) {
    const violations = [];
    const checkString = (value, path) => {
        // Liste des icônes courantes à détecter
        const icons = ['❌', '✅', '⚠️', '📋', '💡', '🎯', '🚀', '🔧', '📊', '🔍', '📝', '⚡', '✨', '🔥'];
        for (const icon of icons) {
            if (value.includes(icon)) {
                violations.push(`Icône "${icon}" détectée dans ${path}`);
            }
        }
    };
    const traverse = (current, path) => {
        if (typeof current === 'string') {
            checkString(current, path);
        }
        else if (Array.isArray(current)) {
            current.forEach((item, index) => {
                traverse(item, `${path}[${index}]`);
            });
        }
        else if (typeof current === 'object' && current !== null) {
            for (const [key, value] of Object.entries(current)) {
                traverse(value, `${path}.${key}`);
            }
        }
    };
    traverse(obj, 'root');
    return {
        valid: violations.length === 0,
        violations
    };
}
/**
 * Convertit un message avec icônes en message texte simple
 */
export function stripIcons(text) {
    // Liste des icônes courantes et leurs équivalents textuels
    const iconReplacements = {
        '❌': 'Erreur:',
        '✅': 'Succès:',
        '⚠️': 'Avertissement:',
        '📋': 'Action requise:',
        '💡': 'Aide:',
        '🎯': 'Recommandations:',
        '🚀': 'Action rapide:',
        '🔧': 'Configuration:',
        '📊': 'Statistiques:',
        '🔍': 'Recherche:',
        '📝': 'Note:',
        '⚡': 'Important:',
        '✨': 'Amélioration:',
        '🔥': 'Critique:'
    };
    let result = text;
    for (const [icon, replacement] of Object.entries(iconReplacements)) {
        result = result.replace(new RegExp(icon, 'g'), replacement);
    }
    return result;
}
//# sourceMappingURL=mcp-formatter.js.map