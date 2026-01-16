// src/rag/queue/rag-queue.ts
// File d'attente RAG avec gestion d'exclusivité des mutateurs et dépendances
import { logger } from "../../core/logger.js";
import { canJobRun, isMutatorJob, isReadOnlyJob, updateJobStatus } from "./job-types.js";
/**
 * Classe principale de la file d'attente RAG
 */
export class RagQueue {
    jobs = new Map();
    runningJobs = new Set();
    config;
    checkInterval = null;
    maxQueueSizeReached = 0;
    constructor(config) {
        this.config = {
            maxQueueSize: 10,
            maxConcurrentMutators: 1, // Un seul mutateur à la fois
            maxConcurrentReadOnly: 3,
            checkIntervalMs: 1000,
            ...config,
        };
        this.startChecker();
        logger.info("rag.queue.init", "RagQueue initialisé", {
            config: this.config,
        });
    }
    /**
     * Ajoute un job à la file d'attente
     */
    async enqueue(job) {
        // Vérifier la limite de taille
        if (this.jobs.size >= this.config.maxQueueSize) {
            const message = `File d'attente pleine (max ${this.config.maxQueueSize} jobs)`;
            logger.warn("rag.queue.full", message, {
                currentSize: this.jobs.size,
                maxSize: this.config.maxQueueSize,
                jobId: job.id,
            });
            return {
                queued: false,
                position: -1,
                message,
            };
        }
        // Vérifier les doublons
        if (this.jobs.has(job.id)) {
            const message = `Job déjà présent dans la file: ${job.id}`;
            logger.warn("rag.queue.duplicate", message, { jobId: job.id });
            return {
                queued: false,
                position: -1,
                message,
            };
        }
        // Ajouter le job
        this.jobs.set(job.id, job);
        // Mettre à jour la statistique de taille maximale
        this.maxQueueSizeReached = Math.max(this.maxQueueSizeReached, this.jobs.size);
        // Calculer la position dans la file
        const position = Array.from(this.jobs.values())
            .filter(j => j.status === 'pending')
            .sort((a, b) => (a.priority || 3) - (b.priority || 3))
            .findIndex(j => j.id === job.id) + 1;
        logger.info("rag.queue.enqueue", "Job ajouté à la file d'attente", {
            jobId: job.id,
            type: job.type,
            projectPath: job.projectPath,
            position,
            totalJobs: this.jobs.size,
            dependsOn: job.dependsOn,
        });
        // Vérifier immédiatement si le job peut s'exécuter
        this.checkAndRunJobs();
        return {
            queued: true,
            position,
        };
    }
    /**
     * Récupère et exécute le prochain job disponible
     */
    async checkAndRunJobs() {
        const pendingJobs = Array.from(this.jobs.values())
            .filter(job => job.status === 'pending')
            .sort((a, b) => (a.priority || 3) - (b.priority || 3));
        for (const job of pendingJobs) {
            if (this.canRunJob(job)) {
                await this.runJob(job);
            }
        }
    }
    /**
     * Vérifie si un job peut s'exécuter
     */
    canRunJob(job) {
        // Vérifier si le job est déjà en cours d'exécution
        if (this.runningJobs.has(job.id)) {
            return false;
        }
        // Vérifier les dépendances
        if (!canJobRun(job, Array.from(this.jobs.values()))) {
            return false;
        }
        // Vérifier les limites concurrentes
        if (isMutatorJob(job)) {
            const runningMutators = Array.from(this.runningJobs)
                .map(id => this.jobs.get(id))
                .filter(j => j && isMutatorJob(j))
                .length;
            if (runningMutators >= this.config.maxConcurrentMutators) {
                return false;
            }
        }
        else if (isReadOnlyJob(job)) {
            const runningReadOnly = Array.from(this.runningJobs)
                .map(id => this.jobs.get(id))
                .filter(j => j && isReadOnlyJob(j))
                .length;
            if (runningReadOnly >= this.config.maxConcurrentReadOnly) {
                return false;
            }
        }
        return true;
    }
    /**
     * Exécute un job
     */
    async runJob(job) {
        // Marquer le job comme en cours d'exécution
        this.runningJobs.add(job.id);
        const updatedJob = updateJobStatus(job, 'running');
        this.jobs.set(job.id, updatedJob);
        logger.info("rag.queue.job.start", "Début d'exécution du job", {
            jobId: job.id,
            type: job.type,
            projectPath: job.projectPath,
            runningJobs: this.runningJobs.size,
        });
        try {
            // Ici, le job serait normalement exécuté par un worker
            // Pour l'instant, on simule l'exécution
            await this.executeJob(updatedJob);
            // Marquer le job comme terminé
            const completedJob = updateJobStatus(updatedJob, 'done');
            this.jobs.set(job.id, completedJob);
            this.runningJobs.delete(job.id);
            logger.info("rag.queue.job.complete", "Job terminé avec succès", {
                jobId: job.id,
                type: job.type,
                duration: getJobDuration(completedJob),
            });
        }
        catch (error) {
            // Marquer le job comme échoué
            const errorDetails = error instanceof Error ? error : new Error(String(error));
            const failedJob = updateJobStatus(updatedJob, 'failed', {
                message: errorDetails.message,
                details: errorDetails.stack,
            });
            this.jobs.set(job.id, failedJob);
            this.runningJobs.delete(job.id);
            logger.error("rag.queue.job.failed", "Job échoué", {
                jobId: job.id,
                type: job.type,
                error: errorDetails.message,
                stack: errorDetails.stack,
            });
        }
        // Vérifier les autres jobs après l'exécution
        this.checkAndRunJobs();
    }
    /**
     * Exécute le job (méthode à surcharger par les implémentations concrètes)
     */
    async executeJob(job) {
        // Méthode à implémenter par les sous-classes
        // Pour l'instant, on simule une exécution
        logger.debug("rag.queue.job.execute", "Exécution simulée du job", {
            jobId: job.id,
            type: job.type,
        });
        // Simulation d'un délai d'exécution
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    /**
     * Annule un job
     */
    cancelJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job) {
            logger.warn("rag.queue.cancel.not_found", "Job non trouvé pour annulation", { jobId });
            return false;
        }
        if (job.status === 'running') {
            // On ne peut pas annuler un job en cours d'exécution
            logger.warn("rag.queue.cancel.running", "Impossible d'annuler un job en cours d'exécution", { jobId });
            return false;
        }
        if (job.status === 'done' || job.status === 'failed') {
            logger.warn("rag.queue.cancel.completed", "Impossible d'annuler un job terminé", {
                jobId,
                status: job.status,
            });
            return false;
        }
        // Supprimer le job
        this.jobs.delete(jobId);
        // Si le job était dans runningJobs (au cas où)
        this.runningJobs.delete(jobId);
        logger.info("rag.queue.cancel.success", "Job annulé", {
            jobId,
            type: job.type,
            projectPath: job.projectPath,
        });
        return true;
    }
    /**
     * Récupère un job par son ID
     */
    getJob(jobId) {
        return this.jobs.get(jobId) || null;
    }
    /**
     * Liste tous les jobs pour un projet
     */
    listJobsByProject(projectPath) {
        return Array.from(this.jobs.values())
            .filter(job => job.projectPath === projectPath)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }
    /**
     * Liste les jobs par type et statut
     */
    listJobsByTypeAndStatus(type, status) {
        let jobs = Array.from(this.jobs.values());
        if (type) {
            jobs = jobs.filter(job => job.type === type);
        }
        if (status) {
            jobs = jobs.filter(job => job.status === status);
        }
        return jobs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }
    /**
     * Récupère les statistiques de la file d'attente
     */
    getStats() {
        const jobs = Array.from(this.jobs.values());
        const jobsByType = {
            'scan': 0,
            'prepare': 0,
            'embed': 0,
            'index': 0,
            'query': 0,
        };
        const jobsByStatus = {
            'pending': 0,
            'running': 0,
            'done': 0,
            'failed': 0,
        };
        const projectSet = new Set();
        for (const job of jobs) {
            jobsByType[job.type]++;
            jobsByStatus[job.status]++;
            projectSet.add(job.projectPath);
        }
        const runningMutators = Array.from(this.runningJobs)
            .map(id => this.jobs.get(id))
            .filter(j => j && isMutatorJob(j))
            .length;
        const runningReadOnly = Array.from(this.runningJobs)
            .map(id => this.jobs.get(id))
            .filter(j => j && isReadOnlyJob(j))
            .length;
        return {
            totalJobs: jobs.length,
            jobsByType,
            jobsByStatus,
            totalProjects: projectSet.size,
            runningMutators,
            runningReadOnly,
            maxQueueSizeReached: this.maxQueueSizeReached,
        };
    }
    /**
     * Récupère le statut global du système RAG
     */
    getGlobalStatus() {
        const stats = this.getStats();
        const projects = Array.from(new Set(Array.from(this.jobs.values()).map(job => job.projectPath)));
        // Pour l'instant, on retourne un statut simplifié
        // Dans une implémentation réelle, on récupérerait l'état des projets depuis le StateManager
        const projectStatuses = projects.map(projectPath => ({
            project_id: projectPath,
            current_phase: 'unknown', // À remplacer par l'état réel
            locked: this.hasRunningMutatorsForProject(projectPath),
            last_updated: new Date(),
        }));
        return {
            status: 'ok',
            scope: 'global',
            rag_state: {
                initialized: true, // À vérifier
                active_jobs: stats.runningMutators + stats.runningReadOnly,
                queued_jobs: stats.totalJobs,
                total_projects: stats.totalProjects,
            },
            projects: projectStatuses,
            notes_for_ai: [
                'Le système RAG est opérationnel',
                'Utilisez get_status avec scope=project pour voir l\'état détaillé d\'un projet',
                'Utilisez get_status avec scope=task pour suivre une tâche spécifique',
            ],
            allowed_actions: ['init_rag', 'scan_rag', 'prepare_rag', 'embed_rag', 'index_rag', 'query_rag'],
            required_action: undefined,
        };
    }
    /**
     * Nettoie les jobs terminés (succès ou échec) plus anciens qu'une certaine date
     */
    cleanupOldJobs(maxAgeHours = 24) {
        const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
        let cleaned = 0;
        for (const [jobId, job] of this.jobs.entries()) {
            if ((job.status === 'done' || job.status === 'failed') && job.completedAt && job.completedAt < cutoff) {
                this.jobs.delete(jobId);
                this.runningJobs.delete(jobId);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            logger.info("rag.queue.cleanup", "Jobs anciens nettoyés", {
                cleaned,
                maxAgeHours,
                remainingJobs: this.jobs.size,
            });
        }
        return cleaned;
    }
    /**
     * Démarre le vérificateur périodique
     */
    startChecker() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
        this.checkInterval = setInterval(() => {
            this.checkAndRunJobs().catch(error => {
                logger.error("rag.queue.checker.error", "Erreur lors de la vérification des jobs", {
                    error: error instanceof Error ? error.message : String(error),
                });
            });
        }, this.config.checkIntervalMs);
    }
    /**
     * Arrête la file d'attente
     */
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        logger.info("rag.queue.stop", "RagQueue arrêté", {
            totalJobs: this.jobs.size,
            runningJobs: this.runningJobs.size,
        });
    }
    /**
     * Vérifie si un projet a des jobs en cours
     */
    hasRunningJobsForProject(projectPath) {
        return Array.from(this.runningJobs)
            .map(id => this.jobs.get(id))
            .some(job => job && job.projectPath === projectPath);
    }
    /**
     * Vérifie si un projet a des jobs mutateurs en cours
     */
    hasRunningMutatorsForProject(projectPath) {
        return Array.from(this.runningJobs)
            .map(id => this.jobs.get(id))
            .some(job => job && job.projectPath === projectPath && isMutatorJob(job));
    }
}
/**
 * Fonction utilitaire pour calculer la durée d'un job
 */
function getJobDuration(job) {
    if (!job.startedAt) {
        return null;
    }
    const endTime = job.completedAt || new Date();
    return endTime.getTime() - job.startedAt.getTime();
}
/**
 * Instance singleton de RagQueue
 */
let ragQueueInstance = null;
/**
 * Obtient l'instance singleton de RagQueue
 */
export function getRagQueue(config) {
    if (!ragQueueInstance) {
        ragQueueInstance = new RagQueue(config);
    }
    return ragQueueInstance;
}
/**
 * Test de la file d'attente
 */
export async function testRagQueue() {
    try {
        const queue = new RagQueue({
            maxQueueSize: 5,
            maxConcurrentMutators: 1,
            maxConcurrentReadOnly: 2,
            checkIntervalMs: 100,
        });
        // Test d'ajout de jobs
        const job1 = {
            id: 'test-job-1',
            type: 'scan',
            status: 'pending',
            projectPath: '/test/project',
            createdAt: new Date(),
            priority: 1,
        };
        const enqueueResult = await queue.enqueue(job1);
        if (!enqueueResult.queued) {
            throw new Error('Échec de l\'ajout du job');
        }
        // Test de récupération des statistiques
        const stats = queue.getStats();
        if (stats.totalJobs !== 1) {
            throw new Error('Statistiques incorrectes');
        }
        // Arrêt de la file
        queue.stop();
        logger.info("rag.queue.test.success", "Test RagQueue réussi");
        return true;
    }
    catch (error) {
        logger.error("rag.queue.test.failed", "Test RagQueue échoué", {
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
}
//# sourceMappingURL=rag-queue.js.map