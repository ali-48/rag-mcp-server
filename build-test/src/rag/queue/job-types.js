// src/rag/queue/job-types.ts
// Types pour les jobs RAG avec dépendances et exclusivité mutateurs
/**
 * Vérifie si un job est un mutateur (modifie l'état RAG)
 * Les mutateurs doivent s'exécuter de manière exclusive
 */
export function isMutatorJob(job) {
    return job.type === 'scan' || job.type === 'prepare' || job.type === 'embed' || job.type === 'index';
}
/**
 * Vérifie si un job est en lecture seule
 * Les jobs en lecture seule peuvent s'exécuter en parallèle
 */
export function isReadOnlyJob(job) {
    return job.type === 'query';
}
/**
 * Génère un ID unique pour un job
 */
export function generateJobId(projectPath, type) {
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
export function getDefaultDependencies(jobType) {
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
export function canJobRun(job, allJobs) {
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
export function createRagJob(type, projectPath, options = {}) {
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
export function updateJobStatus(job, status, error) {
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
export function getJobDuration(job) {
    if (!job.startedAt) {
        return null; // Pas encore démarré
    }
    const endTime = job.completedAt || new Date();
    return endTime.getTime() - job.startedAt.getTime();
}
/**
 * Formate un job pour le logging
 */
export function formatJobForLog(job) {
    const duration = getJobDuration(job);
    const durationStr = duration ? `${Math.round(duration / 1000)}s` : 'N/A';
    return `[${job.id}] ${job.type} (${job.status}) - ${job.projectPath} - ${durationStr}`;
}
//# sourceMappingURL=job-types.js.map