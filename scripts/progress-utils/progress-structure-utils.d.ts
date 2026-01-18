// scripts/progress-utils/progress-structure-utils.d.ts
// Déclarations TypeScript pour progress-structure-utils

import { ProgressState, RagPhase, WorkloadScore } from '../../src/rag/progress/progress-state.js';
import { RagJob } from '../../src/rag/queue/job-types.js';

export function createInitialWorkloadScore(): WorkloadScore;
export function createInitializationPhase(now: Date): RagPhase;
export function createJobSpecificPhases(jobType: string): RagPhase[];
export function createInitialGlobalMetrics(): any;
export function createInitialExecutionDetails(now: Date): any;
export function createDefaultExecutionConfig(): any;
export function createInitialPerformanceStats(): any;
export function createInitialMonitoringData(): any;
export function createInitialMetadata(): any;
export function initializeProgressStructure(job: RagJob, now: Date): ProgressState;
