// src/rag/guards/modules/phase-analyzer.ts
// Analyse des phases RAG et recommandations

import { logger } from "../../../core/logger.js";
import { RagState, getRagState } from "../../phase0/rag-state.js";
import { isPhaseReady } from "../rag-guards.js";

/**
 * Phase RAG avec ses métadonnées
 */
export interface RagPhase {
  name: string;
  tool_name: string;
  description: string;
  depends_on?: string[];
}

/**
 * Résultat de l'analyse d'une phase
 */
export interface PhaseAnalysisResult {
  /** Phase actuelle (celle en cours d'exécution ou la dernière terminée) */
  current_phase: string;
  /** Statut de la phase actuelle */
  current_status: 'running' | 'done' | 'pending' | 'error';
  /** Prochaine phase recommandée (null si toutes terminées) */
  next_phase: string | null;
  /** Toutes les phases avec leur statut */
  phases: Array<{
    name: string;
    status: 'done' | 'running' | 'pending' | 'error';
    tool_name: string;
    description: string;
  }>;
  /** Actions recommandées */
  recommended_actions: string[];
  /** Notes pour l'IA */
  notes_for_ai: string[];
}

/**
 * Définition des phases RAG standard
 */
export const STANDARD_RAG_PHASES: RagPhase[] = [
  { name: 'init', tool_name: 'init_rag', description: 'Initialisation du projet RAG' },
  { name: 'scan', tool_name: 'scan_rag', description: 'Scan des fichiers du projet', depends_on: ['init'] },
  { name: 'prepare', tool_name: 'prepare_rag', description: 'Préparation et chunking des fichiers', depends_on: ['scan'] },
  { name: 'embed', tool_name: 'embed_rag', description: 'Génération des embeddings', depends_on: ['prepare'] },
  { name: 'index', tool_name: 'index_rag', description: 'Indexation dans la base vectorielle', depends_on: ['embed'] },
  { name: 'query', tool_name: 'query_rag', description: 'Recherche sémantique', depends_on: ['index'] }
];

/**
 * Obtient une analyse détaillée des phases pour un projet
 */
export async function analyzePhases(projectPath: string): Promise<PhaseAnalysisResult> {
  try {
    const state = await getRagState(projectPath);
    return await analyzePhasesWithState(projectPath, state);
  } catch (error) {
    logger.error("rag.guards.phase_analysis.error", "Erreur lors de l'analyse des phases", {
      projectPath,
      error: error instanceof Error ? error.message : String(error),
    });

    // Retourner une analyse d'erreur
    return createErrorAnalysis(error);
  }
}

/**
 * Analyse les phases avec un état RAG déjà récupéré
 */
export async function analyzePhasesWithState(
  projectPath: string,
  state: RagState
): Promise<PhaseAnalysisResult> {
  const phaseStatuses = [];
  let currentPhase = 'init';
  let currentStatus: 'running' | 'done' | 'pending' | 'error' = 'pending';
  let nextPhase: string | null = null;
  const recommendedActions: string[] = [];
  const notesForAI: string[] = [];

  // Déterminer le statut de chaque phase
  for (const phase of STANDARD_RAG_PHASES) {
    const status = await getPhaseStatus(projectPath, phase.name, state);
    phaseStatuses.push({
      name: phase.name,
      status,
      tool_name: phase.tool_name,
      description: phase.description
    });
  }

  // Déterminer la phase actuelle et la suivante
  const analysis = determineCurrentAndNextPhase(phaseStatuses, state);
  currentPhase = analysis.currentPhase;
  currentStatus = analysis.currentStatus;
  nextPhase = analysis.nextPhase;

  // Générer les recommandations
  if (!state.initialized) {
    recommendedActions.push('Exécutez init_rag pour initialiser le projet');
    notesForAI.push('Le projet n\'est pas encore initialisé pour RAG');
  } else if (nextPhase) {
    const nextPhaseInfo = STANDARD_RAG_PHASES.find(p => p.name === nextPhase);
    if (nextPhaseInfo) {
      recommendedActions.push(`Exécutez ${nextPhaseInfo.tool_name} pour ${nextPhaseInfo.description}`);
      notesForAI.push(`La phase ${nextPhase} est en attente`);
    }
  } else {
    recommendedActions.push('Toutes les phases sont terminées, vous pouvez exécuter query_rag pour effectuer des recherches');
    notesForAI.push('Pipeline RAG complet et prêt pour les requêtes');
  }

  return {
    current_phase: currentPhase,
    current_status: currentStatus,
    next_phase: nextPhase,
    phases: phaseStatuses,
    recommended_actions: recommendedActions,
    notes_for_ai: notesForAI
  };
}

/**
 * Obtient le statut d'une phase spécifique
 */
async function getPhaseStatus(
  projectPath: string,
  phaseName: string,
  state: RagState
): Promise<'done' | 'running' | 'pending' | 'error'> {
  if (phaseName === 'init') {
    return state.initialized ? 'done' : 'pending';
  }

  try {
    const isReady = await isPhaseReady(projectPath, phaseName);
    return isReady ? 'done' : 'pending';
  } catch (error) {
    logger.warn("rag.guards.phase_status.error", `Erreur lors de la vérification de la phase ${phaseName}`, {
      projectPath,
      phaseName,
      error: error instanceof Error ? error.message : String(error),
    });
    return 'error';
  }
}

/**
 * Détermine la phase actuelle et la suivante
 */
function determineCurrentAndNextPhase(
  phaseStatuses: PhaseAnalysisResult['phases'],
  state: RagState
): {
  currentPhase: string;
  currentStatus: 'running' | 'done' | 'pending' | 'error';
  nextPhase: string | null;
} {
  if (!state.initialized) {
    return {
      currentPhase: 'init',
      currentStatus: 'pending',
      nextPhase: 'init'
    };
  }

  // Chercher la dernière phase terminée
  let lastDonePhase = 'init';
  for (const phase of phaseStatuses) {
    if (phase.status === 'done') {
      lastDonePhase = phase.name;
    } else {
      // Première phase non terminée
      return {
        currentPhase: lastDonePhase,
        currentStatus: 'done',
        nextPhase: phase.name
      };
    }
  }

  // Toutes les phases sont terminées
  return {
    currentPhase: 'query',
    currentStatus: 'done',
    nextPhase: null
  };
}

/**
 * Crée une analyse d'erreur
 */
function createErrorAnalysis(error: unknown): PhaseAnalysisResult {
  const errorMessage = error instanceof Error ? error.message : String(error);

  return {
    current_phase: 'unknown',
    current_status: 'error',
    next_phase: null,
    phases: [],
    recommended_actions: [
      "Vérifiez que le projet existe et est accessible",
      "Assurez-vous que la base de données RAG est initialisée"
    ],
    notes_for_ai: [
      `Erreur lors de l'analyse des phases: ${errorMessage}`
    ]
  };
}

/**
 * Obtient la prochaine phase à exécuter pour un projet
 */
export async function getNextPhaseToExecute(projectPath: string): Promise<string | null> {
  const analysis = await analyzePhases(projectPath);
  return analysis.next_phase;
}

/**
 * Vérifie si une phase spécifique est prête à être exécutée
 */
export async function isPhaseReadyToExecute(
  projectPath: string,
  phaseName: string
): Promise<boolean> {
  const analysis = await analyzePhases(projectPath);

  // Vérifier si toutes les phases précédentes sont terminées
  const phaseIndex = STANDARD_RAG_PHASES.findIndex(p => p.name === phaseName);
  if (phaseIndex === -1) {
    return false;
  }

  // Vérifier les dépendances
  for (let i = 0; i < phaseIndex; i++) {
    const previousPhase = STANDARD_RAG_PHASES[i];
    const phaseStatus = analysis.phases.find(p => p.name === previousPhase.name);
    if (!phaseStatus || phaseStatus.status !== 'done') {
      return false;
    }
  }

  return true;
}

/**
 * Génère un rapport d'analyse des phases
 */
export function generatePhaseAnalysisReport(analysis: PhaseAnalysisResult): string {
  const lines: string[] = [];

  lines.push('=== Analyse des phases RAG ===');
  lines.push('');
  lines.push(`Phase actuelle: ${analysis.current_phase} (${analysis.current_status})`);
  lines.push(`Phase suivante: ${analysis.next_phase || 'Aucune (pipeline complet)'}`);
  lines.push('');

  lines.push('Statut des phases:');
  for (const phase of analysis.phases) {
    const statusIcon = getStatusIcon(phase.status);
    lines.push(`  ${statusIcon} ${phase.name.padEnd(10)} - ${phase.description}`);
  }

  lines.push('');
  if (analysis.recommended_actions.length > 0) {
    lines.push('Actions recommandées:');
    analysis.recommended_actions.forEach((action, index) => {
      lines.push(`  ${index + 1}. ${action}`);
    });
  }

  return lines.join('\n');
}

/**
 * Obtient une icône pour un statut (pour l'affichage console seulement)
 */
function getStatusIcon(status: string): string {
  switch (status) {
    case 'done': return '✅';
    case 'running': return '🔄';
    case 'pending': return '⏳';
    case 'error': return '❌';
    default: return '❓';
  }
}
