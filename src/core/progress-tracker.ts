// src/core/progress-tracker.ts
// Système de suivi de progression pour les tâches RAG asynchrones
// Version: v1.0.0
// Responsabilités: Suivi temps réel, état, progression, ETA, erreurs

import type { ProgressState, ProgressStateUpdateResult } from '../rag/progress/progress-state.js';
import { logger } from './logger.js';

/**
 * Interface pour les erreurs de tâche
 */
export interface TaskError {
    message: string;
    step: string;
    timestamp: string;
    details?: any;
}

/**
 * Interface pour les coûts estimés d'embeddings
 */
export interface EstimatedEmbeddingCost {
    tokens: number;
    model: string;
    approxSeconds: number;
    estimatedAt: string;
}

/**
 * Interface complète pour le statut de progression
 */
export interface ProgressStatus {
    // Identifiants
    taskId: string;
    projectPath: string;

    // État principal
    state: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
    step: string;

    // Progression
    progress: number; // 0-100
    filesTotal: number;
    filesProcessed: number;

    // Timing
    etaSeconds: number;
    startedAt: string;
    updatedAt: string;
    completedAt?: string;

    // Détails d'exécution
    currentFile?: string;
    currentOperation?: string;

    // Métriques d'estimation
    estimatedEmbeddingCost?: EstimatedEmbeddingCost;

    // Gestion d'erreurs
    error?: TaskError;
    warnings?: string[];

    // Métadonnées
    metadata?: Record<string, any>;
}

/**
 * Classe principale pour le suivi de progression
 */
export class ProgressTracker {
    private tasks = new Map<string, ProgressStatus>();
    private readonly MAX_HISTORY = 1000; // Limite mémoire

    /**
     * Crée une nouvelle tâche de suivi
     */
    create(
        taskId: string,
        projectPath: string,
        filesTotal: number,
        metadata?: Record<string, any>
    ): ProgressStatus {
        const now = new Date().toISOString();

        const status: ProgressStatus = {
            taskId,
            projectPath,
            state: 'queued',
            step: 'init',
            progress: 0,
            filesTotal,
            filesProcessed: 0,
            etaSeconds: 0,
            startedAt: now,
            updatedAt: now,
            metadata
        };

        this.tasks.set(taskId, status);

        // Gestion de la limite mémoire
        if (this.tasks.size > this.MAX_HISTORY) {
            this.cleanupOldTasks();
        }

        logger.info('progress.tracker.create', `Tâche créée: ${taskId}`, {
            taskId,
            projectPath,
            filesTotal,
            state: 'queued'
        });

        return status;
    }

    /**
     * Met à jour le statut d'une tâche
     */
    update(taskId: string, patch: Partial<ProgressStatus>): ProgressStatus | null {
        const task = this.tasks.get(taskId);
        if (!task) {
            logger.warn('progress.tracker.update.not_found', `Tâche non trouvée: ${taskId}`, { taskId });
            return null;
        }

        // Mettre à jour les champs
        Object.assign(task, patch);
        task.updatedAt = new Date().toISOString();

        // Calcul automatique de la progression si filesTotal > 0
        if (task.filesTotal > 0 && patch.filesProcessed !== undefined) {
            task.progress = Math.min(100, Math.round((task.filesProcessed / task.filesTotal) * 100));
        }

        // Mettre à jour l'état si nécessaire
        if (patch.state) {
            if (patch.state === 'completed' || patch.state === 'failed' || patch.state === 'cancelled') {
                task.completedAt = new Date().toISOString();
            }
        }

        logger.debug('progress.tracker.update', `Tâche mise à jour: ${taskId}`, {
            taskId,
            state: task.state,
            step: task.step,
            progress: task.progress,
            filesProcessed: task.filesProcessed,
            filesTotal: task.filesTotal
        });

        return task;
    }

    /**
     * Récupère le statut d'une tâche
     */
    get(taskId: string): ProgressStatus | null {
        const task = this.tasks.get(taskId);
        if (!task) {
            return null;
        }

        // Calculer ETA dynamique si la tâche est en cours
        if (task.state === 'running' && task.filesTotal > 0 && task.filesProcessed > 0) {
            const elapsedMs = new Date().getTime() - new Date(task.startedAt).getTime();
            const elapsedSeconds = elapsedMs / 1000;
            const filesPerSecond = task.filesProcessed / elapsedSeconds;
            const remainingFiles = task.filesTotal - task.filesProcessed;

            if (filesPerSecond > 0) {
                task.etaSeconds = Math.round(remainingFiles / filesPerSecond);
            }
        }

        return { ...task }; // Retourner une copie
    }

    /**
     * Supprime une tâche (nettoyage)
     */
    delete(taskId: string): boolean {
        const existed = this.tasks.delete(taskId);

        if (existed) {
            logger.info('progress.tracker.delete', `Tâche supprimée: ${taskId}`, { taskId });
        }

        return existed;
    }

    /**
     * Annule une tâche
     */
    cancel(taskId: string, reason?: string): boolean {
        const task = this.tasks.get(taskId);
        if (!task) {
            return false;
        }

        this.update(taskId, {
            state: 'cancelled',
            error: reason ? {
                message: `Tâche annulée: ${reason}`,
                step: task.step,
                timestamp: new Date().toISOString()
            } : undefined
        });

        logger.info('progress.tracker.cancel', `Tâche annulée: ${taskId}`, {
            taskId,
            reason,
            step: task.step,
            progress: task.progress
        });

        return true;
    }

    /**
     * Marque une tâche comme échouée
     */
    fail(taskId: string, error: Error, step: string): boolean {
        const task = this.tasks.get(taskId);
        if (!task) {
            return false;
        }

        this.update(taskId, {
            state: 'failed',
            error: {
                message: error.message,
                step,
                timestamp: new Date().toISOString(),
                details: {
                    stack: error.stack,
                    name: error.name
                }
            }
        });

        logger.error('progress.tracker.fail', `Tâche échouée: ${taskId}`, {
            taskId,
            step,
            error: error.message,
            progress: task.progress
        });

        return true;
    }

    /**
     * Ajoute un avertissement à une tâche
     */
    addWarning(taskId: string, warning: string): boolean {
        const task = this.tasks.get(taskId);
        if (!task) {
            return false;
        }

        if (!task.warnings) {
            task.warnings = [];
        }

        task.warnings.push(`${new Date().toISOString()}: ${warning}`);
        task.updatedAt = new Date().toISOString();

        logger.warn('progress.tracker.warning', `Avertissement ajouté: ${taskId}`, {
            taskId,
            warning,
            step: task.step
        });

        return true;
    }

    /**
     * Met à jour l'estimation des coûts d'embeddings
     */
    updateEmbeddingCost(
        taskId: string,
        tokens: number,
        model: string,
        approxSeconds: number
    ): boolean {
        const task = this.tasks.get(taskId);
        if (!task) {
            return false;
        }

        task.estimatedEmbeddingCost = {
            tokens,
            model,
            approxSeconds,
            estimatedAt: new Date().toISOString()
        };

        task.updatedAt = new Date().toISOString();

        logger.info('progress.tracker.embedding_cost', `Coût embeddings mis à jour: ${taskId}`, {
            taskId,
            tokens,
            model,
            approxSeconds
        });

        return true;
    }

    /**
     * Liste toutes les tâches pour un projet
     */
    listByProject(projectPath: string): ProgressStatus[] {
        const tasks: ProgressStatus[] = [];

        for (const task of this.tasks.values()) {
            if (task.projectPath === projectPath) {
                tasks.push({ ...task }); // Copie
            }
        }

        // Trier par date de création (plus récent d'abord)
        tasks.sort((a, b) =>
            new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
        );

        return tasks;
    }

    /**
     * Liste toutes les tâches avec un état spécifique
     */
    listByState(state: ProgressStatus['state']): ProgressStatus[] {
        const tasks: ProgressStatus[] = [];

        for (const task of this.tasks.values()) {
            if (task.state === state) {
                tasks.push({ ...task }); // Copie
            }
        }

        return tasks;
    }

    /**
     * Nettoie les anciennes tâches terminées
     */
    private cleanupOldTasks(): void {
        const now = new Date();
        const completedTasks: Array<{ taskId: string; completedAt: Date }> = [];

        // Collecter les tâches terminées
        for (const [taskId, task] of this.tasks.entries()) {
            if (task.completedAt) {
                completedTasks.push({
                    taskId,
                    completedAt: new Date(task.completedAt)
                });
            }
        }

        // Trier par date de complétion (plus ancien d'abord)
        completedTasks.sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());

        // Supprimer les plus anciennes jusqu'à atteindre la limite
        const toDelete = Math.max(0, this.tasks.size - this.MAX_HISTORY);
        for (let i = 0; i < toDelete && i < completedTasks.length; i++) {
            this.tasks.delete(completedTasks[i].taskId);
        }

        if (toDelete > 0) {
            logger.info('progress.tracker.cleanup', `Nettoyage de ${toDelete} anciennes tâches`, {
                deleted: toDelete,
                remaining: this.tasks.size
            });
        }
    }

    /**
     * Met à jour un ProgressState pour une tâche
     * Cette méthode permet de synchroniser l'état de progression détaillé
     * avec le suivi de base du ProgressTracker
     */
    updateProgressState(
        taskId: string,
        progressState: ProgressState
    ): ProgressStateUpdateResult | null {
        const task = this.tasks.get(taskId);
        if (!task) {
            logger.warn('progress.tracker.updateProgressState.not_found', `Tâche non trouvée: ${taskId}`, { taskId });
            return null;
        }

        // Mettre à jour les métriques de base à partir du ProgressState
        const filesProcessed = progressState.globalMetrics.totalFilesProcessed;
        const filesTotal = progressState.globalMetrics.totalFiles;
        const progress = progressState.overallProgress;
        const step = progressState.currentPhase?.name || 'unknown';

        // Mettre à jour la tâche
        this.update(taskId, {
            filesProcessed,
            filesTotal,
            progress,
            step,
            currentOperation: progressState.currentPhase?.description,
            metadata: {
                ...task.metadata,
                progressState: {
                    id: progressState.id,
                    jobId: progressState.jobId,
                    status: progressState.status,
                    phases: progressState.phases.map(p => ({
                        id: p.id,
                        name: p.name,
                        status: p.status,
                        progress: p.progress
                    })),
                    timeEstimate: progressState.timeEstimate,
                    workloadScore: progressState.workloadScore
                }
            }
        });

        // Log de la mise à jour
        logger.debug('progress.tracker.updateProgressState', `ProgressState mis à jour: ${taskId}`, {
            taskId,
            progressStateId: progressState.id,
            jobId: progressState.jobId,
            status: progressState.status,
            overallProgress: progressState.overallProgress,
            currentPhase: progressState.currentPhase?.name,
            phasesCount: progressState.phases.length
        });

        // Retourner un résultat de mise à jour simplifié
        return {
            success: true,
            updatedState: progressState,
            changes: [{
                field: 'progressState',
                oldValue: null,
                newValue: progressState,
                timestamp: new Date()
            }],
            message: `ProgressState mis à jour pour la tâche ${taskId}`
        };
    }

    /**
     * Statistiques du tracker
     */
    getStats(): {
        totalTasks: number;
        byState: Record<string, number>;
        memoryUsage: number;
    } {
        const byState: Record<string, number> = {
            queued: 0,
            running: 0,
            completed: 0,
            failed: 0,
            cancelled: 0
        };

        for (const task of this.tasks.values()) {
            byState[task.state] = (byState[task.state] || 0) + 1;
        }

        // Estimation mémoire (approximative)
        const memoryUsage = this.tasks.size * 1024; // ~1KB par tâche

        return {
            totalTasks: this.tasks.size,
            byState,
            memoryUsage
        };
    }
}

/**
 * Instance singleton du ProgressTracker
 */
let progressTracker: ProgressTracker | null = null;

/**
 * Obtient l'instance singleton du ProgressTracker
 */
export function getProgressTracker(): ProgressTracker {
    if (!progressTracker) {
        progressTracker = new ProgressTracker();
        logger.info('progress.tracker.init', 'ProgressTracker initialisé');
    }
    return progressTracker;
}

/**
 * Fonction utilitaire pour générer un ID de tâche
 */
export function generateTaskId(projectPath: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const random = Math.random().toString(36).substring(2, 8);
    const crypto = require('crypto');
    const projectHash = crypto.createHash('md5').update(projectPath).digest('hex').substring(0, 6);
    return `rag-${timestamp}-${projectHash}-${random}`;
}

/**
 * Teste le ProgressTracker
 */
export async function testProgressTracker(): Promise<boolean> {
    try {
        const tracker = getProgressTracker();
        const testTaskId = generateTaskId('/test/project');

        // Test création
        const task = tracker.create(testTaskId, '/test/project', 100);
        if (task.taskId !== testTaskId) {
            throw new Error('Création de tâche échouée');
        }

        // Test mise à jour
        tracker.update(testTaskId, {
            state: 'running',
            step: 'indexing',
            filesProcessed: 10
        });

        const updated = tracker.get(testTaskId);
        if (!updated || updated.state !== 'running' || updated.progress !== 10) {
            throw new Error('Mise à jour de tâche échouée');
        }

        // Test annulation
        tracker.cancel(testTaskId, 'Test d\'annulation');
        const cancelled = tracker.get(testTaskId);
        if (!cancelled || cancelled.state !== 'cancelled') {
            throw new Error('Annulation de tâche échouée');
        }

        // Nettoyage
        tracker.delete(testTaskId);

        logger.info('progress.tracker.test.success', 'Test ProgressTracker réussi');
        return true;

    } catch (error) {
        logger.error('progress.tracker.test.failed', 'Test ProgressTracker échoué', {
            error: error instanceof Error ? error.message : String(error)
        });
        return false;
    }
}

// Exécution automatique si ce fichier est exécuté directement
if (typeof require !== 'undefined' && require.main === module) {
    testProgressTracker().then(success => {
        if (success) {
            console.log(JSON.stringify({
                success: true,
                message: 'ProgressTracker testé avec succès'
            }, null, 2));
            process.exit(0);
        } else {
            console.error(JSON.stringify({
                success: false,
                message: 'Échec du test ProgressTracker'
            }, null, 2));
            process.exit(1);
        }
    });
}
