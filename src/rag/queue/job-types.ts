// src/rag/queue/job-types.ts
// Types pour les jobs RAG avec dépendances et exclusivité mutateurs

/**
 * Types de jobs RAG supportés
 */
export type RagJobType =
    | 'scan'    // Phase 0: Scan du workspace
    | 'prepare' // Phase 1: Préparation des fichiers
    | 'embed'   // Phase 2: Génération d'embeddings
    | 'index'   // Phase 3: Indexation dans la base vectorielle
    | 'query';  // Phase 4: Recherche (lecture seule)

/**
 * Statut d'un job RAG
 */
export type RagJobStatus =
    | 'pending'  // En attente dans la file
    | 'running'  // En cours d'exécution
    | 'done'     // Terminé avec succès
    | 'failed';  // Échoué

/**
 * Interface pour un job RAG
 */
export interface RagJob {
    /** Identifiant unique du job */
    id: string;

    /** Type de job */
    type: RagJobType;

    /** Statut actuel */
    status: RagJobStatus;

    /** Jobs dont celui-ci dépend (IDs) */
    dependsOn?: string[];

    /** Chemin absolu du projet */
    projectPath: string;

    /** Date de création */
    createdAt: Date;

    /** Date de début d'exécution (si en cours/terminé) */
    startedAt?: Date;

    /** Date de fin d'exécution (si terminé/échoué) */
    completedAt?: Date;

    /** Priorité (1 = haute, 5 = basse) */
    priority?: number;

    /** Métadonnées spécifiques au job */
    metadata?: Record<string, any>;

    /** Erreur en cas d'échec */
    error?: {
        message: string;
        code?: string;
        details?: any;
    };
}

/**
 * Vérifie si un job est un mutateur (modifie l'état RAG)
 * Les mutateurs doivent s'exécuter de manière exclusive
 */
export function isMutatorJob(job: RagJob): boolean {
    return job.type === 'scan' || job.type === 'prepare' || job.type === 'embed' || job.type === 'index';
}

/**
 * Vérifie si un job est en lecture seule
 * Les jobs en lecture seule peuvent s'exécuter en parallèle
 */
export function isReadOnlyJob(job: RagJob): boolean {
    return job.type === 'query';
}

/**
 * Génère un ID unique pour un job
 */
export function generateJobId(projectPath: string, type: RagJobType): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const projectHash = require('crypto')
        .createHash('md5')
        .update(projectPath)
        .digest('hex')
        .substring(0, 6);

    return `rag-${type}-${timestamp}-${projectHash}-${random}`;
}

/**
 * Calcule les dépendances par défaut pour un type de job
 */
export function getDefaultDependencies(jobType: RagJobType): RagJobType[] {
    switch (jobType) {
        case 'scan':
            return []; // scan ne dépend de rien
        case 'prepare':
            return ['scan']; // prepare dépend de scan
        case 'embed':
            return ['prepare']; // embed dépend de prepare
        case 'index':
            return ['embed']; // index dépend de embed
        case 'query':
            return ['index']; // query dépend de index (au moins un index doit exister)
        default:
            return [];
    }
}

/**
 * Vérifie si un job peut s'exécuter étant donné l'état actuel des autres jobs
 */
export function canJobRun(job: RagJob, allJobs: RagJob[]): boolean {
    // Vérifier les dépendances
    if (job.dependsOn && job.dependsOn.length > 0) {
        for (const depId of job.dependsOn) {
            const depJob = allJobs.find(j => j.id === depId);
            if (!depJob || depJob.status !== 'done') {
                return false; // Dépendance non satisfaite
            }
        }
    }

    return true;
}

/**
 * Crée un nouveau job avec les valeurs par défaut
 */
export function createRagJob(
    type: RagJobType,
    projectPath: string,
    options: {
        dependsOn?: string[];
        priority?: number;
        metadata?: Record<string, any>;
    } = {}
): RagJob {
    const id = generateJobId(projectPath, type);

    return {
        id,
        type,
        status: 'pending',
        projectPath,
        createdAt: new Date(),
        dependsOn: options.dependsOn || getDefaultDependencies(type),
        priority: options.priority || 3,
        metadata: options.metadata || {},
    };
}

/**
 * Met à jour le statut d'un job
 */
export function updateJobStatus(
    job: RagJob,
    status: RagJobStatus,
    error?: { message: string; code?: string; details?: any }
): RagJob {
    const updated = { ...job, status };

    if (status === 'running' && !job.startedAt) {
        updated.startedAt = new Date();
    }

    if ((status === 'done' || status === 'failed') && !job.completedAt) {
        updated.completedAt = new Date();
    }

    if (error) {
        updated.error = error;
    }

    return updated;
}

/**
 * Calcule la durée d'exécution d'un job (en ms)
 */
export function getJobDuration(job: RagJob): number | null {
    if (!job.startedAt) {
        return null; // Pas encore démarré
    }

    const endTime = job.completedAt || new Date();
    return endTime.getTime() - job.startedAt.getTime();
}

/**
 * Formate un job pour le logging
 */
export function formatJobForLog(job: RagJob): string {
    const duration = getJobDuration(job);
    const durationStr = duration ? `${Math.round(duration / 1000)}s` : 'N/A';

    return `[${job.id}] ${job.type} (${job.status}) - ${job.projectPath} - ${durationStr}`;
}
