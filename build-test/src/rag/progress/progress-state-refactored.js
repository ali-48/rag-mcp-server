// src/rag/progress/progress-state-refactored.ts
// Interface ProgressState avec phases, ETA indicatif, workloadScore (version refactorée)
import { calculateTimeEstimate as calculateTimeEstimateUtil, calculateWorkloadScore as calculateWorkloadScoreUtil, setupPhaseTransitions as setupPhaseTransitionsUtil, updatePhaseProgress as updatePhaseProgressUtil } from "../../../scripts/progress-utils/phase-transition-utils.js";
import { initializeProgressStructure as initializeProgressStructureUtil } from "../../../scripts/progress-utils/progress-structure-utils.js";
// Ré-exporter les interfaces existantes
export * from "./progress-state.js";
/**
 * Crée un ProgressState initial pour un job (version refactorée)
 */
export function createInitialProgressState(job, options = {}) {
    const now = new Date();
    return initializeProgressStructureUtil(job, now);
}
/**
 * Met à jour la progression d'une phase (version refactorée)
 */
export function updatePhaseProgress(progressState, phaseId, updates, options = {}) {
    return updatePhaseProgressUtil(progressState, phaseId, updates, options);
}
/**
 * Calcule une estimation de temps pour un ProgressState (version refactorée)
 */
export function calculateTimeEstimate(progressState) {
    return calculateTimeEstimateUtil(progressState);
}
/**
 * Calcule un score de charge de travail basé sur les métriques (version refactorée)
 */
export function calculateWorkloadScore(progressState) {
    return calculateWorkloadScoreUtil(progressState);
}
/**
 * Configure les transitions de phase (version refactorée)
 */
export function setupPhaseTransitions(progressState, options = {}) {
    return setupPhaseTransitionsUtil(progressState, options);
}
/**
 * Test de la création et mise à jour de ProgressState (version refactorée)
 */
export function testProgressState() {
    try {
        console.log("🧪 Début des tests ProgressState (version refactorée)");
        // Créer un job fictif
        const testJob = {
            id: 'test-job-123',
            type: 'scan',
            status: 'pending',
            projectPath: '/test/project',
            createdAt: new Date(),
        };
        // Créer un état initial
        const initialState = createInitialProgressState(testJob, {
            enableDetailedMonitoring: true,
            enableAlerts: true,
            alertThresholds: {
                memoryThreshold: 100,
                cpuThreshold: 80,
                failureRateThreshold: 10,
                executionTimeThreshold: 30000,
            },
        });
        if (initialState.jobId !== testJob.id) {
            throw new Error("Job ID incorrect");
        }
        if (initialState.phases.length < 2) {
            throw new Error("Phases manquantes");
        }
        // Configurer les transitions
        const transitions = setupPhaseTransitions(initialState, {
            enableAlerts: true,
            alertThresholds: {
                memoryThreshold: 100,
                cpuThreshold: 80,
                failureRateThreshold: 10,
                executionTimeThreshold: 30000,
            },
        });
        // Transition de pending à running
        const runningResult = transitions.pendingToRunning('phase-scan');
        if (!runningResult.success || !runningResult.updatedState) {
            throw new Error("Échec de la transition pendingToRunning");
        }
        // Mettre à jour la progression
        const updateResult = updatePhaseProgress(runningResult.updatedState, 'phase-scan', {
            progress: 25,
            metrics: {
                filesProcessed: 10,
                filesTotal: 100,
                elapsedTime: 5000,
                processingRate: 2,
                memoryUsage: 50,
                cpuUsage: 30,
            },
        });
        if (!updateResult.success || !updateResult.updatedState) {
            throw new Error("Échec de la mise à jour de progression");
        }
        // Calculer l'estimation de temps
        const timeEstimate = calculateTimeEstimate(updateResult.updatedState);
        if (!timeEstimate) {
            throw new Error("Échec du calcul de l'estimation de temps");
        }
        // Calculer le score de charge
        const workloadScore = calculateWorkloadScore(updateResult.updatedState);
        if (workloadScore.overall < 0 || workloadScore.overall > 100) {
            throw new Error("Score de charge invalide");
        }
        // Transition de running à completed
        const completedResult = transitions.runningToCompleted('phase-scan', {
            filesProcessed: 100,
            filesTotal: 100,
            elapsedTime: 10000,
            processingRate: 10,
        });
        if (!completedResult.success || !completedResult.updatedState) {
            throw new Error("Échec de la transition runningToCompleted");
        }
        console.log("✅ Tests ProgressState (version refactorée) réussis");
        return true;
    }
    catch (error) {
        console.error("❌ Tests ProgressState (version refactorée) échoués:", error instanceof Error ? error.message : String(error));
        return false;
    }
}
//# sourceMappingURL=progress-state-refactored.js.map