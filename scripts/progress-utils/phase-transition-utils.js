// scripts/progress-utils/phase-transition-utils.js
// Utilitaires pour les transitions de phase RAG

/**
 * Met à jour la progression d'une phase
 */
export function updatePhaseProgress(
  progressState,
  phaseId,
  updates,
  options = {}
) {
  const changes = [];
  const alerts = [];
  const now = new Date();

  // Trouver la phase
  const phaseIndex = progressState.phases.findIndex(p => p.id === phaseId);
  if (phaseIndex === -1) {
    return {
      success: false,
      changes: [],
      message: `Phase non trouvée: ${phaseId}`,
      errors: [`Phase ${phaseId} n'existe pas`],
    };
  }

  const oldPhase = { ...progressState.phases[phaseIndex] };
  const newPhase = { ...oldPhase, ...updates, updatedAt: now };

  // Enregistrer les changements
  Object.keys(updates).forEach(key => {
    const field = key;
    if (oldPhase[field] !== newPhase[field]) {
      changes.push({
        field: `phases[${phaseIndex}].${field}`,
        oldValue: oldPhase[field],
        newValue: newPhase[field],
        timestamp: now,
      });
    }
  });

  // Mettre à jour la phase
  const updatedPhases = [...progressState.phases];
  updatedPhases[phaseIndex] = newPhase;

  // Mettre à jour l'état global
  const updatedState = {
    ...progressState,
    phases: updatedPhases,
    currentPhase: newPhase.status === 'running' ? newPhase : progressState.currentPhase,
    executionDetails: {
      ...progressState.executionDetails,
      updatedAt: now,
    },
  };

  // Calculer la progression globale
  const completedPhases = updatedPhases.filter(p => p.status === 'completed').length;
  const totalPhases = updatedPhases.length;
  const overallProgress = Math.round((completedPhases / totalPhases) * 100);

  updatedState.overallProgress = overallProgress;

  // Mettre à jour les métriques globales
  const totalFilesProcessed = updatedPhases.reduce((sum, phase) =>
    sum + (phase.metrics?.filesProcessed || 0), 0);
  const totalFiles = updatedPhases.reduce((sum, phase) =>
    sum + (phase.metrics?.filesTotal || 0), 0);
  const totalElapsedTime = updatedPhases.reduce((sum, phase) =>
    sum + (phase.metrics?.elapsedTime || 0), 0);

  updatedState.globalMetrics = {
    ...updatedState.globalMetrics,
    totalFilesProcessed,
    totalFiles,
    totalElapsedTime,
    overallProcessingRate: totalElapsedTime > 0 ?
      (totalFilesProcessed / (totalElapsedTime / 1000)) : 0,
  };

  // Vérifier les alertes
  if (options.enableAlerts && options.alertThresholds) {
    const { alertThresholds } = options;

    // Vérifier l'utilisation mémoire
    if (newPhase.metrics?.memoryUsage && newPhase.metrics.memoryUsage > alertThresholds.memoryThreshold) {
      alerts.push({
        id: `alert-memory-${Date.now()}`,
        type: 'warning',
        message: `Utilisation mémoire élevée: ${newPhase.metrics.memoryUsage}MB (seuil: ${alertThresholds.memoryThreshold}MB)`,
        timestamp: now,
      });
    }

    // Vérifier l'utilisation CPU
    if (newPhase.metrics?.cpuUsage && newPhase.metrics.cpuUsage > alertThresholds.cpuThreshold) {
      alerts.push({
        id: `alert-cpu-${Date.now()}`,
        type: 'warning',
        message: `Utilisation CPU élevée: ${newPhase.metrics.cpuUsage}% (seuil: ${alertThresholds.cpuThreshold}%)`,
        timestamp: now,
      });
    }

    // Vérifier le temps d'exécution
    if (newPhase.metrics?.elapsedTime && newPhase.metrics.elapsedTime > alertThresholds.executionTimeThreshold) {
      alerts.push({
        id: `alert-time-${Date.now()}`,
        type: 'warning',
        message: `Temps d'exécution long: ${newPhase.metrics.elapsedTime}ms (seuil: ${alertThresholds.executionTimeThreshold}ms)`,
        timestamp: now,
      });
    }
  }

  // Ajouter les données de monitoring
  if (options.enableDetailedMonitoring) {
    updatedState.monitoringData = {
      ...updatedState.monitoringData,
      progressHistory: [
        ...updatedState.monitoringData.progressHistory,
        { timestamp: now, progress: overallProgress }
      ],
    };

    if (newPhase.metrics?.memoryUsage) {
      updatedState.monitoringData.memoryUsageHistory.push({
        timestamp: now,
        usage: newPhase.metrics.memoryUsage,
      });
    }

    if (newPhase.metrics?.cpuUsage) {
      updatedState.monitoringData.cpuUsageHistory.push({
        timestamp: now,
        usage: newPhase.metrics.cpuUsage,
      });
    }

    if (newPhase.metrics?.processingRate) {
      updatedState.monitoringData.processingRateHistory.push({
        timestamp: now,
        rate: newPhase.metrics.processingRate,
      });
    }
  }

  // Ajouter les alertes à l'état
  if (alerts.length > 0) {
    updatedState.monitoringData.alerts = [
      ...updatedState.monitoringData.alerts,
      ...alerts.map(alert => ({ ...alert, resolved: false }))
    ];
  }

  return {
    success: true,
    updatedState,
    changes,
    alerts: alerts.length > 0 ? alerts : undefined,
    message: `Phase ${phaseId} mise à jour avec succès`,
  };
}

/**
 * Calcule une estimation de temps pour un ProgressState
 */
export function calculateTimeEstimate(progressState) {
  if (progressState.phases.length === 0) {
    return undefined;
  }

  const now = new Date();
  const completedPhases = progressState.phases.filter(p => p.status === 'completed');
  const runningPhase = progressState.phases.find(p => p.status === 'running');

  if (!runningPhase) {
    return undefined;
  }

  // Calculer le temps écoulé
  const elapsedTime = completedPhases.reduce((sum, phase) =>
    sum + (phase.metrics?.elapsedTime || 0), 0) +
    (runningPhase.metrics?.elapsedTime || 0);

  // Calculer le taux de traitement
  const filesProcessed = runningPhase.metrics?.filesProcessed || 0;
  const filesTotal = runningPhase.metrics?.filesTotal || 1;
  const processingRate = runningPhase.metrics?.processingRate ||
    (filesProcessed > 0 ? filesProcessed / (elapsedTime / 1000) : 0);

  // Calculer le temps restant
  const remainingFiles = filesTotal - filesProcessed;
  const estimatedRemaining = processingRate > 0 ?
    (remainingFiles / processingRate) * 1000 : 0;

  // Calculer la confiance
  let confidence = 'low';
  if (filesProcessed > 10 && processingRate > 0) {
    confidence = 'medium';
  }
  if (filesProcessed > 50 && processingRate > 0) {
    confidence = 'high';
  }

  return {
    total: elapsedTime + estimatedRemaining,
    elapsed: elapsedTime,
    remaining: estimatedRemaining,
    completionPercentage: filesTotal > 0 ? Math.round((filesProcessed / filesTotal) * 100) : 0,
    startTime: progressState.executionDetails.startedAt,
    estimatedEndTime: new Date(now.getTime() + estimatedRemaining),
    confidence,
    factors: {
      currentRate: processingRate,
      remainingComplexity: remainingFiles,
      availableResources: 1,
      externalVariables: [],
    },
  };
}

/**
 * Calcule un score de charge de travail basé sur les métriques
 */
export function calculateWorkloadScore(progressState) {
  const { globalMetrics, phases } = progressState;

  // Calculer les scores individuels
  const volumeScore = Math.min(globalMetrics.totalFiles * 0.1, 100);
  const complexityScore = phases.length > 1 ? 50 : 20;
  const performanceScore = globalMetrics.overallProcessingRate > 10 ? 80 :
    globalMetrics.overallProcessingRate > 1 ? 50 : 20;
  const riskScore = globalMetrics.totalErrors > 0 ?
    Math.min(globalMetrics.totalErrors * 10, 100) : 10;

  // Calculer le score global
  const overallScore = Math.round(
    (volumeScore * 0.3) +
    (complexityScore * 0.3) +
    (performanceScore * 0.2) +
    (riskScore * 0.2)
  );

  // Générer des recommandations
  const recommendations = [];

  if (volumeScore > 70) {
    recommendations.push("Charge volumique élevée - envisagez un traitement par lots");
  }

  if (complexityScore > 60) {
    recommendations.push("Complexité élevée - surveillez l'utilisation des ressources");
  }

  if (performanceScore < 30) {
    recommendations.push("Performance faible - optimisez le traitement des fichiers");
  }

  if (riskScore > 50) {
    recommendations.push("Risque élevé d'erreurs - activez les checkpoints fréquents");
  }

  return {
    overall: overallScore,
    volume: Math.round(volumeScore),
    complexity: Math.round(complexityScore),
    performance: Math.round(performanceScore),
    risk: Math.round(riskScore),
    factors: {
      fileCount: globalMetrics.totalFiles,
      totalSize: 0, // À calculer à partir des fichiers
      averageComplexity: 0, // À calculer à partir de l'analyse
      fileTypes: {},
      languages: {},
      dependencies: [],
    },
    recommendations,
  };
}

/**
 * Configure les transitions de phase
 */
export function setupPhaseTransitions(progressState, options = {}) {
  const transitions = {
    // Transition de pending à running
    pendingToRunning: (phaseId) => {
      return updatePhaseProgress(progressState, phaseId, {
        status: 'running',
        startedAt: new Date(),
      }, options);
    },

    // Transition de running à completed
    runningToCompleted: (phaseId, metrics = {}) => {
      return updatePhaseProgress(progressState, phaseId, {
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
        metrics: {
          ...progressState.phases.find(p => p.id === phaseId)?.metrics,
          ...metrics,
        },
      }, options);
    },

    // Transition de running à failed
    runningToFailed: (phaseId, errors = []) => {
      return updatePhaseProgress(progressState, phaseId, {
        status: 'failed',
        errors,
        completedAt: new Date(),
      }, options);
    },

    // Transition de running à paused
    runningToPaused: (phaseId) => {
      return updatePhaseProgress(progressState, phaseId, {
        status: 'paused',
      }, options);
    },

    // Transition de paused à running
    pausedToRunning: (phaseId) => {
      return updatePhaseProgress(progressState, phaseId, {
        status: 'running',
      }, options);
    },
  };

  return transitions;
}
