// src/rag/daemon/priority-task-queue.ts
// File de tâches avec priorité et protection des sections critiques
import { EventEmitter } from 'events';
/**
 * Priorité des tâches
 */
export var TaskPriority;
(function (TaskPriority) {
    TaskPriority[TaskPriority["CRITICAL"] = 0] = "CRITICAL";
    TaskPriority[TaskPriority["HIGH"] = 1] = "HIGH";
    TaskPriority[TaskPriority["NORMAL"] = 2] = "NORMAL";
    TaskPriority[TaskPriority["LOW"] = 3] = "LOW";
    TaskPriority[TaskPriority["BACKGROUND"] = 4] = "BACKGROUND"; // Tâches très basses priorités
})(TaskPriority || (TaskPriority = {}));
/**
 * État d'une tâche
 */
export var TaskState;
(function (TaskState) {
    TaskState["PENDING"] = "pending";
    TaskState["RUNNING"] = "running";
    TaskState["COMPLETED"] = "completed";
    TaskState["FAILED"] = "failed";
    TaskState["CANCELLED"] = "cancelled";
    TaskState["INTERRUPTED"] = "interrupted";
})(TaskState || (TaskState = {}));
/**
 * Type de tâche
 */
export var TaskType;
(function (TaskType) {
    TaskType["SQLITE_WRITE"] = "sqlite_write";
    TaskType["EMBEDDING"] = "embedding";
    TaskType["INDEXING"] = "indexing";
    TaskType["ANALYSIS"] = "analysis";
    TaskType["QUERY"] = "query";
    TaskType["CLEANUP"] = "cleanup";
    TaskType["MONITORING"] = "monitoring";
    TaskType["OTHER"] = "other";
})(TaskType || (TaskType = {}));
/**
 * File de tâches avec priorité et protection des sections critiques
 */
export class PriorityTaskQueue extends EventEmitter {
    config;
    queue = [];
    runningTasks = new Map();
    completedTasks = [];
    taskHistory = [];
    isProcessing = false;
    processingInterval;
    statsInterval;
    criticalSections = new Set();
    taskCounters = new Map();
    constructor(config) {
        super();
        this.config = {
            maxConcurrentTasks: 5,
            maxQueueSize: 1000,
            defaultPriority: TaskPriority.NORMAL,
            retryConfig: {
                maxRetries: 3,
                backoffMs: 1000,
                backoffMultiplier: 2
            },
            criticalSections: {
                protectedTypes: [TaskType.SQLITE_WRITE, TaskType.EMBEDDING, TaskType.INDEXING],
                allowInterruption: false,
                timeoutMs: 30000
            },
            monitoring: {
                enabled: true,
                updateIntervalMs: 5000
            },
            ...config
        };
        this.initializeCounters();
    }
    /**
     * Initialise les compteurs de tâches
     */
    initializeCounters() {
        Object.values(TaskType).forEach(type => {
            this.taskCounters.set(type, 0);
        });
    }
    /**
     * Démarre le traitement de la file
     */
    async start() {
        if (this.isProcessing) {
            console.warn('⚠️ File déjà en cours de traitement');
            return false;
        }
        console.log('🚀 Démarrage PriorityTaskQueue...');
        this.isProcessing = true;
        // Démarrer le traitement
        this.startProcessing();
        // Démarrer le monitoring
        if (this.config.monitoring.enabled) {
            this.startMonitoring();
        }
        console.log('✅ PriorityTaskQueue démarrée');
        return true;
    }
    /**
     * Arrête le traitement de la file
     */
    async stop() {
        if (!this.isProcessing) {
            console.warn('⚠️ File déjà arrêtée');
            return false;
        }
        console.log('🛑 Arrêt PriorityTaskQueue...');
        this.isProcessing = false;
        // Arrêter le traitement
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = undefined;
        }
        // Arrêter le monitoring
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = undefined;
        }
        // Annuler les tâches en cours (sauf critiques)
        this.cancelNonCriticalTasks();
        console.log('✅ PriorityTaskQueue arrêtée');
        return true;
    }
    /**
     * Démarre le traitement des tâches
     */
    startProcessing() {
        this.processingInterval = setInterval(() => {
            this.processQueue();
        }, 100); // Vérifier toutes les 100ms
    }
    /**
     * Démarre le monitoring
     */
    startMonitoring() {
        this.statsInterval = setInterval(() => {
            this.updateStats();
        }, this.config.monitoring.updateIntervalMs);
    }
    /**
     * Ajoute une tâche à la file
     */
    async addTask(type, data, options) {
        // Vérifier si la file est pleine
        if (this.queue.length >= this.config.maxQueueSize) {
            this.emit('queue-full', this.queue.length);
            throw new Error(`File pleine (${this.queue.length}/${this.config.maxQueueSize})`);
        }
        const taskId = this.generateTaskId(type);
        const priority = options?.priority ?? this.config.defaultPriority;
        const isCritical = options?.isCritical ?? this.isCriticalType(type);
        const task = {
            id: taskId,
            type,
            priority,
            state: TaskState.PENDING,
            createdAt: new Date().toISOString(),
            projectId: options?.projectId,
            data,
            metadata: options?.metadata,
            retryCount: 0,
            maxRetries: options?.maxRetries ?? this.config.retryConfig.maxRetries,
            isCritical,
            criticalSectionId: options?.criticalSectionId
        };
        // Ajouter à la file avec priorité
        this.insertTaskByPriority(task);
        // Mettre à jour le compteur
        this.taskCounters.set(type, (this.taskCounters.get(type) || 0) + 1);
        this.emit('task-added', task);
        console.log(`📝 Tâche ajoutée: ${taskId} (${type}, priorité: ${priority})`);
        return taskId;
    }
    /**
     * Insère une tâche dans la file par priorité
     */
    insertTaskByPriority(task) {
        let inserted = false;
        for (let i = 0; i < this.queue.length; i++) {
            if (task.priority < this.queue[i].priority) {
                this.queue.splice(i, 0, task);
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            this.queue.push(task);
        }
    }
    /**
     * Traite la file
     */
    async processQueue() {
        // Vérifier le nombre de tâches en cours
        if (this.runningTasks.size >= this.config.maxConcurrentTasks) {
            return;
        }
        // Trouver la prochaine tâche à exécuter
        const task = this.getNextTask();
        if (!task) {
            return;
        }
        // Vérifier si on peut exécuter une tâche critique
        if (task.isCritical && this.hasCriticalTasksRunning()) {
            // Attendre que les tâches critiques actuelles se terminent
            return;
        }
        // Démarrer la tâche
        await this.startTask(task);
    }
    /**
     * Obtient la prochaine tâche à exécuter
     */
    getNextTask() {
        for (let i = 0; i < this.queue.length; i++) {
            const task = this.queue[i];
            // Vérifier si la tâche est prête
            if (task.state === TaskState.PENDING) {
                // Vérifier les retries
                if (task.retryCount > 0) {
                    const backoffTime = this.calculateBackoff(task.retryCount);
                    const createdAt = new Date(task.createdAt).getTime();
                    const now = Date.now();
                    if (now - createdAt < backoffTime) {
                        continue; // Tâche en backoff
                    }
                }
                return this.queue.splice(i, 1)[0];
            }
        }
        return undefined;
    }
    /**
     * Calcule le backoff pour une tâche
     */
    calculateBackoff(retryCount) {
        const { backoffMs, backoffMultiplier } = this.config.retryConfig;
        return backoffMs * Math.pow(backoffMultiplier, retryCount - 1);
    }
    /**
     * Démarre une tâche
     */
    async startTask(task) {
        task.state = TaskState.RUNNING;
        task.startedAt = new Date().toISOString();
        this.runningTasks.set(task.id, task);
        // Si c'est une tâche critique, démarrer la section critique
        if (task.isCritical) {
            this.startCriticalSection(task);
        }
        this.emit('task-started', task);
        console.log(`▶️  Tâche démarrée: ${task.id} (${task.type})`);
        // Exécuter la tâche
        try {
            const result = await this.executeTask(task);
            await this.completeTask(task, result);
        }
        catch (error) {
            await this.handleTaskError(task, error);
        }
    }
    /**
     * Exécute une tâche
     */
    async executeTask(task) {
        // Simulation d'exécution
        // Dans une implémentation réelle, on appellerait le handler approprié
        console.log(`⚡ Exécution tâche: ${task.id} (${task.type})`);
        // Simuler un délai basé sur le type
        const delay = this.getTaskDelay(task.type);
        await new Promise(resolve => setTimeout(resolve, delay));
        // Retourner un résultat simulé
        return {
            taskId: task.id,
            type: task.type,
            executedAt: new Date().toISOString(),
            durationMs: delay
        };
    }
    /**
     * Obtient le délai pour un type de tâche
     */
    getTaskDelay(type) {
        const delays = {
            [TaskType.SQLITE_WRITE]: 500,
            [TaskType.EMBEDDING]: 2000,
            [TaskType.INDEXING]: 1000,
            [TaskType.ANALYSIS]: 1500,
            [TaskType.QUERY]: 300,
            [TaskType.CLEANUP]: 800,
            [TaskType.MONITORING]: 200,
            [TaskType.OTHER]: 400
        };
        return delays[type] || 500;
    }
    /**
     * Termine une tâche avec succès
     */
    async completeTask(task, result) {
        task.state = TaskState.COMPLETED;
        task.completedAt = new Date().toISOString();
        task.result = result;
        this.runningTasks.delete(task.id);
        this.completedTasks.push(task);
        this.taskHistory.push(task);
        // Si c'était une tâche critique, terminer la section critique
        if (task.isCritical) {
            this.endCriticalSection(task);
        }
        this.emit('task-completed', task);
        console.log(`✅ Tâche terminée: ${task.id} (${task.type})`);
    }
    /**
     * Gère une erreur de tâche
     */
    async handleTaskError(task, error) {
        task.retryCount++;
        if (task.retryCount <= task.maxRetries) {
            // Réessayer la tâche
            console.log(`🔄 Réessai tâche ${task.id} (${task.retryCount}/${task.maxRetries})`);
            task.state = TaskState.PENDING;
            this.runningTasks.delete(task.id);
            // Si c'était une tâche critique, terminer la section critique
            if (task.isCritical) {
                this.endCriticalSection(task);
            }
            // Réinsérer dans la file avec backoff
            this.insertTaskByPriority(task);
        }
        else {
            // Échec définitif
            task.state = TaskState.FAILED;
            task.completedAt = new Date().toISOString();
            task.error = error.message;
            this.runningTasks.delete(task.id);
            this.completedTasks.push(task);
            this.taskHistory.push(task);
            // Si c'était une tâche critique, terminer la section critique
            if (task.isCritical) {
                this.endCriticalSection(task);
            }
            this.emit('task-failed', task, error.message);
            console.error(`❌ Tâche échouée: ${task.id} (${task.type}): ${error.message}`);
        }
    }
    /**
     * Démarre une section critique
     */
    startCriticalSection(task) {
        if (!task.criticalSectionId) {
            task.criticalSectionId = `critical-${task.id}`;
        }
        this.criticalSections.add(task.criticalSectionId);
        // Configurer un timeout pour la section critique
        setTimeout(() => {
            if (this.runningTasks.has(task.id) && task.state === TaskState.RUNNING) {
                console.warn(`⏰ Timeout section critique: ${task.criticalSectionId}`);
                this.interruptTask(task.id, 'timeout');
            }
        }, this.config.criticalSections.timeoutMs);
        this.emit('critical-section-started', task);
        console.log(`🔒 Section critique démarrée: ${task.criticalSectionId}`);
    }
    /**
     * Termine une section critique
     */
    endCriticalSection(task) {
        if (task.criticalSectionId) {
            this.criticalSections.delete(task.criticalSectionId);
            this.emit('critical-section-ended', task);
            console.log(`🔓 Section critique terminée: ${task.criticalSectionId}`);
        }
    }
    /**
     * Vérifie si des tâches critiques sont en cours
     */
    hasCriticalTasksRunning() {
        for (const task of this.runningTasks.values()) {
            if (task.isCritical) {
                return true;
            }
        }
        return false;
    }
    /**
     * Vérifie si un type de tâche est critique
     */
    isCriticalType(type) {
        return this.config.criticalSections.protectedTypes.includes(type);
    }
    /**
     * Annule une tâche
     */
    async cancelTask(taskId) {
        // Chercher dans la file
        const queueIndex = this.queue.findIndex(t => t.id === taskId);
        if (queueIndex !== -1) {
            const task = this.queue[queueIndex];
            task.state = TaskState.CANCELLED;
            this.queue.splice(queueIndex, 1);
            this.completedTasks.push(task);
            this.emit('task-cancelled', task);
            console.log(`🚫 Tâche annulée (file): ${taskId}`);
            return true;
        }
        // Chercher dans les tâches en cours
        const runningTask = this.runningTasks.get(taskId);
        if (runningTask) {
            // Vérifier si on peut interrompre (non critique ou interruption autorisée)
            if (!runningTask.isCritical || this.config.criticalSections.allowInterruption) {
                runningTask.state = TaskState.CANCELLED;
                this.runningTasks.delete(taskId);
                this.completedTasks.push(runningTask);
                // Si c'était une tâche critique, terminer la section critique
                if (runningTask.isCritical && runningTask.criticalSectionId) {
                    this.criticalSections.delete(runningTask.criticalSectionId);
                    this.emit('critical-section-ended', runningTask);
                }
                this.emit('task-cancelled', runningTask);
                console.log(`🚫 Tâche annulée (en cours): ${taskId}`);
                return true;
            }
            else {
                console.warn(`⚠️ Impossible d'annuler tâche critique: ${taskId}`);
                return false;
            }
        }
        return false;
    }
    /**
     * Interrompt une tâche
     */
    async interruptTask(taskId, reason) {
        const task = this.runningTasks.get(taskId);
        if (!task) {
            return false;
        }
        // Marquer comme interrompue
        task.state = TaskState.INTERRUPTED;
        task.error = `Interrompue: ${reason}`;
        this.runningTasks.delete(taskId);
        this.completedTasks.push(task);
        this.taskHistory.push(task);
        // Si c'était une tâche critique, terminer la section critique
        if (task.isCritical && task.criticalSectionId) {
            this.criticalSections.delete(task.criticalSectionId);
            this.emit('critical-section-ended', task);
        }
        this.emit('task-interrupted', task);
        console.log(`⏸️  Tâche interrompue: ${taskId} (${reason})`);
        return true;
    }
    /**
     * Annule les tâches non critiques
     */
    cancelNonCriticalTasks() {
        const nonCriticalTasks = [];
        // Tâches dans la file
        for (let i = this.queue.length - 1; i >= 0; i--) {
            if (!this.queue[i].isCritical) {
                nonCriticalTasks.push(this.queue[i].id);
                this.queue.splice(i, 1);
            }
        }
        // Tâches en cours
        for (const [taskId, task] of this.runningTasks.entries()) {
            if (!task.isCritical) {
                nonCriticalTasks.push(taskId);
                task.state = TaskState.CANCELLED;
                this.completedTasks.push(task);
                this.runningTasks.delete(taskId);
            }
        }
        if (nonCriticalTasks.length > 0) {
            console.log(`🧹 ${nonCriticalTasks.length} tâches non critiques annulées`);
        }
    }
    /**
     * Met à jour les statistiques
     */
    updateStats() {
        const stats = this.getStats();
        this.emit('stats-updated', stats);
    }
    /**
     * Génère un ID de tâche unique
     */
    generateTaskId(type) {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `${type}-${timestamp}-${random}`;
    }
    /**
     * Récupère les statistiques de la file
     */
    getStats() {
        const now = Date.now();
        let totalCompletionTime = 0;
        let completedCount = 0;
        for (const task of this.completedTasks) {
            if (task.startedAt && task.completedAt) {
                const start = new Date(task.startedAt).getTime();
                const end = new Date(task.completedAt).getTime();
                totalCompletionTime += (end - start);
                completedCount++;
            }
        }
        const avgCompletionTime = completedCount > 0 ? totalCompletionTime / completedCount : 0;
        const criticalTasksRunning = Array.from(this.runningTasks.values())
            .filter(t => t.isCritical).length;
        return {
            totalTasks: this.taskHistory.length,
            pendingTasks: this.queue.length,
            runningTasks: this.runningTasks.size,
            completedTasks: this.completedTasks.length,
            failedTasks: this.completedTasks.filter(t => t.state === TaskState.FAILED).length,
            cancelledTasks: this.completedTasks.filter(t => t.state === TaskState.CANCELLED).length,
            avgCompletionTimeMs: Math.round(avgCompletionTime),
            criticalTasksRunning,
            queueSize: this.queue.length,
            maxQueueSize: this.config.maxQueueSize
        };
    }
    /**
     * Récupère une tâche par ID
     */
    getTask(taskId) {
        // Chercher dans la file
        const queuedTask = this.queue.find(t => t.id === taskId);
        if (queuedTask)
            return queuedTask;
        // Chercher dans les tâches en cours
        const runningTask = this.runningTasks.get(taskId);
        if (runningTask)
            return runningTask;
        // Chercher dans l'historique
        return this.taskHistory.find(t => t.id === taskId);
    }
    /**
     * Récupère toutes les tâches
     */
    getAllTasks() {
        return [
            ...this.queue,
            ...Array.from(this.runningTasks.values()),
            ...this.completedTasks
        ];
    }
    /**
     * Récupère les tâches par type
     */
    getTasksByType(type) {
        return this.getAllTasks().filter(t => t.type === type);
    }
    /**
     * Récupère les tâches par projet
     */
    getTasksByProject(projectId) {
        return this.getAllTasks().filter(t => t.projectId === projectId);
    }
    /**
     * Récupère les compteurs par type
     */
    getTaskCounters() {
        return new Map(this.taskCounters);
    }
    /**
     * Vide la file
     */
    clearQueue() {
        const count = this.queue.length;
        this.queue = [];
        console.log(`🧹 File vidée (${count} tâches supprimées)`);
    }
    /**
     * Nettoie l'historique ancien
     */
    cleanupHistory(maxAgeHours = 24) {
        const cutoff = Date.now() - (maxAgeHours * 60 * 60 * 1000);
        const oldCount = this.taskHistory.length;
        this.taskHistory = this.taskHistory.filter(task => {
            const createdAt = new Date(task.createdAt).getTime();
            return createdAt > cutoff;
        });
        const removed = oldCount - this.taskHistory.length;
        if (removed > 0) {
            console.log(`🧹 Historique nettoyé: ${removed} tâches anciennes supprimées`);
        }
    }
    /**
     * Vérifie si la file est active
     */
    isActive() {
        return this.isProcessing;
    }
    /**
     * Récupère la configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Met à jour la configuration
     */
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
        console.log('⚙️ Configuration file mise à jour');
    }
}
//# sourceMappingURL=priority-task-queue.js.map