// src/rag/guards/modules/mcp-formatter.ts
// Formatage JSON strict pour les réponses MCP (Règle R3)

import { RagUsageError } from "../../errors/rag-usage-error.js";

/**
 * Format MCP pour une erreur
 */
export interface MCPErrorFormat {
  status: 'error';
  error: string;
  message: string;
  required_action?: string;
  notes_for_ai: string[];
  details?: Record<string, any>;
}

/**
 * Format MCP pour un succès
 */
export interface MCPSuccessFormat {
  status: 'success';
  message: string;
  data?: Record<string, any>;
  notes_for_ai?: string[];
}

/**
 * Format MCP pour un avertissement
 */
export interface MCPWarningFormat {
  status: 'warning';
  message: string;
  warnings: string[];
  notes_for_ai?: string[];
  details?: Record<string, any>;
}

/**
 * Format MCP pour une analyse de phase
 */
export interface MCPPhaseAnalysisFormat {
  status: 'analysis';
  analysis: {
    current_phase: string;
    current_status: 'running' | 'done' | 'pending' | 'error';
    next_phase: string | null;
    phases: Array<{
      name: string;
      status: 'done' | 'running' | 'pending' | 'error';
      tool_name: string;
      description: string;
    }>;
    recommended_actions: string[];
  };
  notes_for_ai: string[];
}

/**
 * Crée un format MCP à partir d'une erreur RagUsageError
 */
export function createMCPErrorFromRagError(
  error: RagUsageError,
  recommendations: string[] = []
): MCPErrorFormat {
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
export function createMCPSuccess(
  message: string,
  data?: Record<string, any>,
  notesForAI?: string[]
): MCPSuccessFormat {
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
export function createMCPWarning(
  message: string,
  warnings: string[],
  details?: Record<string, any>,
  notesForAI?: string[]
): MCPWarningFormat {
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
export function createMCPPhaseAnalysis(
  analysis: MCPPhaseAnalysisFormat['analysis'],
  notesForAI: string[] = []
): MCPPhaseAnalysisFormat {
  return {
    status: 'analysis',
    analysis,
    notes_for_ai: notesForAI
  };
}

/**
 * Formate un message d'erreur pour l'utilisateur (sans icônes, conforme à R3)
 */
export function formatUserErrorMessage(error: RagUsageError): string {
  const lines: string[] = [];

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
    error.details.recommendations.forEach((rec: string, index: number) => {
      lines.push(`${index + 1}. ${rec}`);
    });
  }

  return lines.join('\n');
}

/**
 * Valide qu'un objet JSON ne contient pas d'icônes (conforme à R3)
 */
export function validateJSONStrict(obj: any): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  const checkString = (value: string, path: string) => {
    // Liste des icônes courantes à détecter
    const icons = ['❌', '✅', '⚠️', '📋', '💡', '🎯', '🚀', '🔧', '📊', '🔍', '📝', '⚡', '✨', '🔥'];
    for (const icon of icons) {
      if (value.includes(icon)) {
        violations.push(`Icône "${icon}" détectée dans ${path}`);
      }
    }
  };

  const traverse = (current: any, path: string) => {
    if (typeof current === 'string') {
      checkString(current, path);
    } else if (Array.isArray(current)) {
      current.forEach((item, index) => {
        traverse(item, `${path}[${index}]`);
      });
    } else if (typeof current === 'object' && current !== null) {
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
export function stripIcons(text: string): string {
  // Liste des icônes courantes et leurs équivalents textuels
  const iconReplacements: Record<string, string> = {
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
