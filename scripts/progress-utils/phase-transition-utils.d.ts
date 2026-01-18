// scripts/progress-utils/phase-transition-utils.d.ts
// Déclarations TypeScript pour phase-transition-utils

import { ProgressState, ProgressStateOptions, ProgressStateUpdateResult, RagPhase, TimeEstimate, WorkloadScore } from '../../src/rag/progress/progress-state.js';

export function updatePhaseProgress(
  progressState: ProgressState,
  phaseId: string,
  updates: Partial<RagPhase>,
  options?: ProgressStateOptions
): ProgressStateUpdateResult;

export function calculateTimeEstimate(
  progressState: ProgressState
): TimeEstimate | undefined;

export function calculateWorkloadScore(
  progressState: ProgressState
): WorkloadScore;

export function setupPhaseTransitions(
  progressState: ProgressState,
  options?: ProgressStateOptions
): {
  pendingToRunning: (phaseId: string) => ProgressStateUpdateResult;
  runningToCompleted: (phaseId: string, metrics?: any) => ProgressStateUpdateResult;
  runningToFailed: (phaseId: string, errors?: string[]) => ProgressStateUpdateResult;
  runningToPaused: (phaseId: string) => ProgressStateUpdateResult;
  pausedToRunning: (phaseId: string) => ProgressStateUpdateResult;
};
