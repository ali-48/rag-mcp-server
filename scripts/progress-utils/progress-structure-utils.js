// scripts/progress-utils/progress-structure-utils.js
// Utilitaires pour la structure de progression RAG

/**
 * Crée un score de charge de travail initial
 */
export function createInitialWorkloadScore() {
  return {
    overall: 0,
    complexity: 0,
    volume: 0,
    performance: 0,
    risk: 0,
    factors: {
      fileCount: 0,
      totalSize: 0,
      averageComplexity: 0,
      fileTypes: {},
      languages: {},
      dependencies: [],
    },
    recommendations: [
      "Analyse initiale en cours...",
      "Estimation de la charge de travail à venir",
    ],
  };
}

/**
 * Crée une phase d'initialisation
 */
export function createInitializationPhase(now) {
  return {
    id: 'phase-initialization',
    name: 'Initialisation',
    description: 'Préparation de l\'environnement d\'exécution',
    type: 'custom',
    status: 'completed',
    progress: 100,
    metrics: {
      filesProcessed: 0,
      filesTotal: 0,
      elapsedTime: 0,
    },
    startedAt: now,
    completedAt: now,
  };
}

/**
 * Crée des phases spécifiques au type de job
 */
export function createJobSpecificPhases(jobType) {
  const phases = [];

  switch (jobType) {
    case 'scan':
      phases.push({
        id: 'phase-scan',
        name: 'Scan des fichiers',
        description: 'Analyse des fichiers du projet',
        type: 'scan',
        status: 'pending',
        progress: 0,
        metrics: {
          filesProcessed: 0,
          filesTotal: 0,
          elapsedTime: 0,
        },
      });
      break;

    case 'prepare':
      phases.push({
        id: 'phase-prepare',
        name: 'Préparation des chunks',
        description: 'Découpage intelligent des fichiers',
        type: 'prepare',
        status: 'pending',
        progress: 0,
        metrics: {
          filesProcessed: 0,
          filesTotal: 0,
          elapsedTime: 0,
        },
      });
      break;

    case 'embed':
      phases.push({
        id: 'phase-embed',
        name: 'Génération d\'embeddings',
        description: 'Création des vecteurs sémantiques',
        type: 'embed',
        status: 'pending',
        progress: 0,
        metrics: {
          filesProcessed: 0,
          filesTotal: 0,
          elapsedTime: 0,
        },
      });
      break;

    case 'index':
      phases.push({
        id: 'phase-index',
        name: 'Indexation',
        description: 'Stockage et organisation des embeddings',
        type: 'index',
        status: 'pending',
        progress: 0,
        metrics: {
          filesProcessed: 0,
          filesTotal: 0,
          elapsedTime: 0,
        },
      });
      break;

    case 'query':
      phases.push({
        id: 'phase-query',
        name: 'Recherche',
        description: 'Recherche sémantique dans les index',
        type: 'query',
        status: 'pending',
        progress: 0,
        metrics: {
          filesProcessed: 0,
          filesTotal: 0,
          elapsedTime: 0,
        },
      });
      break;
  }

  return phases;
}

/**
 * Crée les métriques globales initiales
 */
export function createInitialGlobalMetrics() {
  return {
    totalFilesProcessed: 0,
    totalFiles: 0,
    overallProcessingRate: 0,
    totalElapsedTime: 0,
    averageMemoryUsage: 0,
    averageCpuUsage: 0,
    checkpointsSaved: 0,
    totalErrors: 0,
    totalWarnings: 0,
  };
}

/**
 * Crée les détails d'exécution initiaux
 */
export function createInitialExecutionDetails(now) {
  return {
    startedAt: now,
    updatedAt: now,
  };
}

/**
 * Crée la configuration d'exécution par défaut
 */
export function createDefaultExecutionConfig() {
  return {
    mode: 'full',
    chunkingStrategy: 'logical',
    embeddingModel: 'nomic-embed-text',
    maxChunkSize: 1000,
    chunkOverlap: 200,
    enableLLMEnrichment: false,
    enableCheckpoints: true,
    checkpointInterval: 60,
  };
}

/**
 * Crée les statistiques de performance initiales
 */
export function createInitialPerformanceStats() {
  return {
    averageFileProcessingTime: 0,
    averageEmbeddingTime: 0,
    successRate: 0,
    failureRate: 0,
    averageWaitTime: 0,
    averageCpuTime: 0,
    averageIoTime: 0,
  };
}

/**
 * Crée les données de monitoring initiales
 */
export function createInitialMonitoringData() {
  return {
    memoryUsageHistory: [],
    cpuUsageHistory: [],
    processingRateHistory: [],
    progressHistory: [],
    alerts: [],
  };
}

/**
 * Crée les métadonnées initiales
 */
export function createInitialMetadata() {
  return {
    version: '1.0.0',
    environment: {
      nodeVersion: process.version,
      os: process.platform,
      architecture: process.arch,
      totalMemory: 0,
      availableCpus: 0,
    },
    loadedPlugins: [],
    enabledExtensions: [],
  };
}

/**
 * Initialise la structure de progression complète
 */
export function initializeProgressStructure(job, now) {
  const initializationPhase = createInitializationPhase(now);
  const jobSpecificPhases = createJobSpecificPhases(job.type);
  const phases = [initializationPhase, ...jobSpecificPhases];

  return {
    id: `progress-${job.id}-${Date.now()}`,
    jobId: job.id,
    jobType: job.type,
    projectPath: job.projectPath,
    status: 'initializing',
    phases,
    currentPhase: initializationPhase,
    overallProgress: 0,
    workloadScore: createInitialWorkloadScore(),
    globalMetrics: createInitialGlobalMetrics(),
    executionDetails: createInitialExecutionDetails(now),
    executionConfig: createDefaultExecutionConfig(),
    performanceStats: createInitialPerformanceStats(),
    monitoringData: createInitialMonitoringData(),
    metadata: createInitialMetadata(),
  };
}
