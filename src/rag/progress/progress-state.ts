// src/rag/progress/progress-state.ts
// Interface ProgressState avec phases, ETA indicatif, workloadScore

import { RagJob } from "../queue/job-types.js";

/**
 * Phase d'exécution RAG
 */
export interface RagPhase {
    /** ID unique de la phase */
    id: string;

    /** Nom de la phase */
    name: string;

    /** Description de la phase */
    description: string;

    /** Type de phase */
    type: 'scan' | 'prepare' | 'embed' | 'index' | 'query' | 'custom';

    /** Statut de la phase */
    status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';

    /** Progression (0-100) */
    progress: number;

    /** Métriques de performance */
    metrics?: {
        /** Fichiers traités */
        filesProcessed: number;

        /** Fichiers totaux */
        filesTotal: number;

        /** Taux de traitement (fichiers/seconde) */
        processingRate?: number;

        /** Temps écoulé (ms) */
        elapsedTime: number;

        /** Temps estimé restant (ms) */
        estimatedRemaining?: number;

        /** Utilisation mémoire (MB) */
        memoryUsage?: number;

        /** Utilisation CPU (%) */
        cpuUsage?: number;
    };

    /** Détails de la phase */
    details?: Record<string, any>;

    /** Date de début */
    startedAt?: Date;

    /** Date de fin */
    completedAt?: Date;

    /** Erreurs (si échec) */
    errors?: string[];

    /** Avertissements */
    warnings?: string[];
}

/**
 * Score de charge de travail
 */
export interface WorkloadScore {
    /** Score global (0-100) */
    overall: number;

    /** Score de complexité (0-100) */
    complexity: number;

    /** Score de volume (0-100) */
    volume: number;

    /** Score de performance (0-100) */
    performance: number;

    /** Score de risque (0-100) */
    risk: number;

    /** Facteurs influençant le score */
    factors: {
        /** Nombre de fichiers */
        fileCount: number;

        /** Taille totale des fichiers (octets) */
        totalSize: number;

        /** Complexité moyenne des fichiers */
        averageComplexity: number;

        /** Types de fichiers */
        fileTypes: Record<string, number>;

        /** Langages de programmation */
        languages: Record<string, number>;

        /** Dependencies */
        dependencies: string[];
    };

    /** Recommandations basées sur le score */
    recommendations: string[];
}

/**
 * Estimation de temps (ETA)
 */
export interface TimeEstimate {
    /** Temps total estimé (ms) */
    total: number;

    /** Temps écoulé (ms) */
    elapsed: number;

    /** Temps restant estimé (ms) */
    remaining: number;

    /** Pourcentage de complétion */
    completionPercentage: number;

    /** Heure de début estimée */
    startTime: Date;

    /** Heure de fin estimée */
    estimatedEndTime: Date;

    /** Précision de l'estimation */
    confidence: 'low' | 'medium' | 'high';

    /** Facteurs affectant l'estimation */
    factors: {
        /** Taux de traitement actuel */
        currentRate: number;

        /** Taux de traitement historique */
        historicalRate?: number;

        /** Complexité restante */
        remainingComplexity: number;

        /** Ressources disponibles */
        availableResources: number;

        /** Variables externes */
        externalVariables: string[];
    };
}

/**
 * État de progression pour un job RAG
 */
export interface ProgressState {
    /** ID unique de l'état de progression */
    id: string;

    /** ID du job associé */
    jobId: string;

    /** Type de job */
    jobType: string;

    /** Chemin du projet */
    projectPath: string;

    /** Statut global */
    status: 'initializing' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

    /** Phases d'exécution */
    phases: RagPhase[];

    /** Phase actuelle */
    currentPhase?: RagPhase;

    /** Progression globale (0-100) */
    overallProgress: number;

    /** Estimation de temps */
    timeEstimate?: TimeEstimate;

    /** Score de charge de travail */
    workloadScore?: WorkloadScore;

    /** Métriques globales */
    globalMetrics: {
        /** Fichiers traités total */
        totalFilesProcessed: number;

        /** Fichiers totaux */
        totalFiles: number;

        /** Taux de traitement global (fichiers/seconde) */
        overallProcessingRate: number;

        /** Temps total écoulé (ms) */
        totalElapsedTime: number;

        /** Utilisation mémoire moyenne (MB) */
        averageMemoryUsage: number;

        /** Utilisation CPU moyenne (%) */
        averageCpuUsage: number;

        /** Checkpoints sauvegardés */
        checkpointsSaved: number;

        /** Erreurs totales */
        totalErrors: number;

        /** Avertissements totaux */
        totalWarnings: number;
    };

    /** Détails d'exécution */
    executionDetails: {
        /** Date de début */
        startedAt: Date;

        /** Date de dernière mise à jour */
        updatedAt: Date;

        /** Date de fin (si terminé) */
        finishedAt?: Date;

        /** Durée totale (ms) */
        totalDuration?: number;

        /** Raison d'échec (si applicable) */
        failureReason?: string;

        /** Stack trace d'erreur (si applicable) */
        errorStackTrace?: string;

        /** Code de sortie */
        exitCode?: number;
    };

    /** Configuration d'exécution */
    executionConfig: {
        /** Mode d'exécution */
        mode: 'full' | 'incremental' | 'watch' | 'analyze_only';

        /** Stratégie de chunking */
        chunkingStrategy: 'logical' | 'fixed' | 'ai_enhanced';

        /** Modèle d'embedding */
        embeddingModel: string;

        /** Taille maximale des chunks */
        maxChunkSize: number;

        /** Chevauchement des chunks */
        chunkOverlap: number;

        /** Activer l'enrichissement LLM */
        enableLLMEnrichment: boolean;

        /** Activer les checkpoints */
        enableCheckpoints: boolean;

        /** Intervalle de checkpoint (secondes) */
        checkpointInterval: number;
    };

    /** Statistiques de performance */
    performanceStats: {
        /** Temps de traitement moyen par fichier (ms) */
        averageFileProcessingTime: number;

        /** Temps d'embedding moyen par chunk (ms) */
        averageEmbeddingTime: number;

        /** Taux de succès des opérations (%) */
        successRate: number;

        /** Taux d'échec des opérations (%) */
        failureRate: number;

        /** Temps d'attente moyen (ms) */
        averageWaitTime: number;

        /** Temps d'exécution CPU moyen (ms) */
        averageCpuTime: number;

        /** Temps d'I/O moyen (ms) */
        averageIoTime: number;
    };

    /** Données de monitoring */
    monitoringData: {
        /** Utilisation mémoire historique (MB) */
        memoryUsageHistory: Array<{ timestamp: Date; usage: number }>;

        /** Utilisation CPU historique (%) */
        cpuUsageHistory: Array<{ timestamp: Date; usage: number }>;

        /** Taux de traitement historique (fichiers/seconde) */
        processingRateHistory: Array<{ timestamp: Date; rate: number }>;

        /** Progression historique (%) */
        progressHistory: Array<{ timestamp: Date; progress: number }>;

        /** Alertes générées */
        alerts: Array<{
            id: string;
            type: 'warning' | 'error' | 'info';
            message: string;
            timestamp: Date;
            resolved: boolean;
        }>;
    };

    /** Métadonnées */
    metadata: {
        /** Version du format ProgressState */
        version: string;

        /** Environnement d'exécution */
        environment: {
            /** Node.js version */
            nodeVersion: string;

            /** OS */
            os: string;

            /** Architecture */
            architecture: string;

            /** Mémoire totale (MB) */
            totalMemory: number;

            /** CPUs disponibles */
            availableCpus: number;
        };

        /** Plugins chargés */
        loadedPlugins: string[];

        /** Extensions activées */
        enabledExtensions: string[];

        /** Configuration personnalisée */
        customConfig?: Record<string, any>;
    };
}

/**
 * Options de création de ProgressState
 */
export interface ProgressStateOptions {
    /** Forcer la création même si un état existe déjà */
    force?: boolean;

    /** Activer le monitoring détaillé */
    enableDetailedMonitoring?: boolean;

    /** Intervalle de mise à jour (ms) */
    updateInterval?: number;

    /** Activer les alertes */
    enableAlerts?: boolean;

    /** Seuils d'alerte */
    alertThresholds?: {
        /** Seuil d'utilisation mémoire (MB) */
        memoryThreshold: number;

        /** Seuil d'utilisation CPU (%) */
        cpuThreshold: number;

        /** Seuil de taux d'échec (%) */
        failureRateThreshold: number;

        /** Seuil de temps d'exécution (ms) */
        executionTimeThreshold: number;
    };
}

/**
 * Résultat de mise à jour de ProgressState
 */
export interface ProgressStateUpdateResult {
    /** Succès de l'opération */
    success: boolean;

    /** État mis à jour */
    updatedState?: ProgressState;

    /** Changements appliqués */
    changes: Array<{
        field: string;
        oldValue: any;
        newValue: any;
        timestamp: Date;
    }>;

    /** Alertes générées */
    alerts?: Array<{
        id: string;
        type: 'warning' | 'error' | 'info';
        message: string;
        timestamp: Date;
    }>;

    /** Message d'information */
    message?: string;

    /** Erreurs (si échec) */
    errors?: string[];
}

/**
 * Crée un ProgressState initial pour un job
 */
export function createInitialProgressState(
    job: RagJob,
    options: ProgressStateOptions = {}
): ProgressState {
    const now = new Date();

    // Calculer le score de charge de travail initial
    const workloadScore: WorkloadScore = {
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

    // Définir les phases initiales
    const phases: RagPhase[] = [
        {
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
        },
    ];

    // Ajouter les phases spécifiques au type de job
    switch (job.type) {
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

    // Créer l'état initial
    const progressState: ProgressState = {
        id: `progress-${job.id}-${Date.now()}`,
        jobId: job.id,
        jobType: job.type,
        projectPath: job.projectPath,
        status: 'initializing',
        phases,
        currentPhase: phases[0],
        overallProgress: 0,
        workloadScore,
        globalMetrics: {
            totalFilesProcessed: 0,
            totalFiles: 0,
            overallProcessingRate: 0,
            totalElapsedTime: 0,
            averageMemoryUsage: 0,
            averageCpuUsage: 0,
            checkpointsSaved: 0,
            totalErrors: 0,
            totalWarnings: 0,
        },
        executionDetails: {
            startedAt: now,
            updatedAt: now,
        },
        executionConfig: {
            mode: 'full',
            chunkingStrategy: 'logical',
            embeddingModel: 'nomic-embed-text',
            maxChunkSize: 1000,
            chunkOverlap: 200,
            enableLLMEnrichment: false,
            enableCheckpoints: true,
            checkpointInterval: 60,
        },
        performanceStats: {
            averageFileProcessingTime: 0,
            averageEmbeddingTime: 0,
            successRate: 0,
            failureRate: 0,
            averageWaitTime: 0,
            averageCpuTime: 0,
            averageIoTime: 0,
        },
        monitoringData: {
            memoryUsageHistory: [],
            cpuUsageHistory: [],
            processingRateHistory: [],
            progressHistory: [],
            alerts: [],
        },
        metadata: {
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
        },
    };

    return progressState;
}

/**
 * Met à jour la progression d'une phase
 */
export function updatePhaseProgress(
    progressState: ProgressState,
    phaseId: string,
    updates: Partial<RagPhase>,
    options: ProgressStateOptions = {}
): ProgressStateUpdateResult {
    const changes: Array<{ field: string; oldValue: any; newValue: any; timestamp: Date }> = [];
    const alerts: Array<{ id: string; type: 'warning' | 'error' | 'info'; message: string; timestamp: Date }> = [];
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
        const field = key as keyof RagPhase;
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
    const updatedState: ProgressState = {
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
export function calculateTimeEstimate(
    progressState: ProgressState
): TimeEstimate | undefined {
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
    let confidence: 'low' | 'medium' | 'high' = 'low';
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
export function calculateWorkloadScore(
    progressState: ProgressState
): WorkloadScore {
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
    const recommendations: string[] = [];

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
 * Test de la création et mise à jour de ProgressState
 */
export function testProgressState(): boolean {
    try {
        console.log("🧪 Début des tests ProgressState");

        // Créer un job fictif
        const testJob: RagJob = {
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

        // Mettre à jour une phase
        const updateResult = updatePhaseProgress(initialState, 'phase-scan', {
            status: 'running',
            progress: 25,
            metrics: {
                filesProcessed: 10,
                filesTotal: 100,
                elapsedTime: 5000,
                processingRate: 2,
                memoryUsage: 50,
                cpuUsage: 30,
            },
            startedAt: new Date(),
        });

        if (!updateResult.success) {
            throw new Error("Échec de la mise à jour de phase");
        }

        if (!updateResult.updatedState) {
            throw new Error("État mis à jour manquant");
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

        console.log("✅ Tests ProgressState réussis");
        return true;

    } catch (error) {
        console.error("❌ Tests ProgressState échoués:", error instanceof Error ? error.message : String(error));
        return false;
    }
}
