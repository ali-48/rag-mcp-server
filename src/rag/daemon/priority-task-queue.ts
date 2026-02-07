// src/rag/daemon/priority-task-queue.ts
// File de tâches avec priorité et protection des sections critiques

import { EventEmitter } from 'events';

/**
 * Priorité des tâches
 */
export enum TaskPriority {
  CRITICAL = 0,    // Opérations critiques (écriture DB, embedding)
  HIGH = 1,        // Tâches importantes (indexation, analyse)
  NORMAL = 2,      // Tâches normales (requêtes, monitoring)
  LOW = 3,         // Tâches de fond (nettoyage, maintenance)
  BACKGROUND = 4   // Tâches très basses priorités
}

/**
 * État d'une tâche
 */
export enum TaskState {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  INTERRUPTED = 'interrupted'
}

/**
 * Type de tâche
 */
export enum TaskType {
  SQLITE_WRITE = 'sqlite_write',
  EMBEDDING = 'embedding',
  INDEXING = 'indexing',
  ANALYSIS = 'analysis',
  QUERY = 'query',
  CLEANUP = 'cleanup',
  MONITORING = 'monitoring',
  OTHER = 'other'
}

/**
 * Tâche dans la file
 */
export interface Task {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  state: TaskState;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  projectId?: string;
  data: any;
  metadata?: Record<string, any>;
  result?: any;
  error?: string;
  retryCount: number;
  maxRetries: number;
  isCritical: boolean; // Si la tâche est dans une section critique
  criticalSectionId?: string; // ID de la section critique
}

/**
 * Configuration de la file
 */
export interface TaskQueueConfig {
  maxConcurrentTasks: number;
  maxQueueSize: number;
  defaultPriority: TaskPriority;
  retryConfig: {
    maxRetries: number;
    backoffMs: number;
    backoffMultiplier: number;
  };
  criticalSections: {
    protectedTypes: TaskType[];
    allowInterruption: boolean;
    timeoutMs: number;
  };
  monitoring: {
    enabled: boolean;
    updateIntervalMs: number;
  };
}

/**
 * Statistiques de la file
 */
export interface QueueStats {
  totalTasks: number;
  pendingTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  cancelledTasks: number;
  avgCompletionTimeMs: number;
  criticalTasksRunning: number;
  queueSize: number;
  maxQueueSize: number;
}

/**
 * Événements de la file
 */
export interface TaskQueueEvents {
  'task-added': (task: Task) => void;
  'task-started': (task: Task) => void;
  'task-completed': (task: Task) => void;
  'task-failed': (task: Task, error: string) => void;
  'task-cancelled': (task: Task) => void;
  'task-interrupted': (task: Task) => void;
  'critical-section-started': (task: Task) => void;
  'critical-section-ended': (task: Task) => void;
  'queue-full': (taskCount: number) => void;
  'stats-updated': (stats: QueueStats) => void;
}

/**
 * File de tâches avec priorité et protection des sections critiques
 */
export class PriorityTaskQueue extends EventEmitter {
  private config: TaskQueueConfig;
  private queue: Task[] = [];
  private runningTasks: Map<string, Task> = new Map();
  private completedTasks: Task[] = [];
  private taskHistory: Task[] = [];
  private isProcessing: boolean = false;
  private processingInterval?: NodeJS.Timeout;
  private statsInterval?: NodeJS.Timeout;
  private criticalSections: Set<string> = new Set();
  private taskCounters: Map<TaskType, number> = new Map();

  constructor(config?: Partial<TaskQueueConfig>) {
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
  private initializeCounters(): void {
    Object.values(TaskType).forEach(type => {
      this.taskCounters.set(type, 0);
    });
  }

  /**
   * Démarre le traitement de la file
   */
  async start(): Promise<boolean> {
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
  async stop(): Promise<boolean> {
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
  private startProcessing(): void {
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 100); // Vérifier toutes les 100ms
  }

  /**
   * Démarre le monitoring
   */
  private startMonitoring(): void {
    this.statsInterval = setInterval(() => {
      this.updateStats();
    }, this.config.monitoring.updateIntervalMs);
  }

  /**
   * Ajoute une tâche à la file
   */
  async addTask(
    type: TaskType,
    data: any,
    options?: {
      priority?: TaskPriority;
      projectId?: string;
      metadata?: Record<string, any>;
      isCritical?: boolean;
      criticalSectionId?: string;
      maxRetries?: number;
    }
  ): Promise<string> {
    // Vérifier si la file est pleine
    if (this.queue.length >= this.config.maxQueueSize) {
      this.emit('queue-full', this.queue.length);
      throw new Error(`File pleine (${this.queue.length}/${this.config.maxQueueSize})`);
    }

    const taskId = this.generateTaskId(type);
    const priority = options?.priority ?? this.config.defaultPriority;
    const isCritical = options?.isCritical ?? this.isCriticalType(type);

    const task: Task = {
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
  private insertTaskByPriority(task: Task): void {
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
  private async processQueue(): Promise<void> {
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
  private getNextTask(): Task | undefined {
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
  private calculateBackoff(retryCount: number): number {
    const { backoffMs, backoffMultiplier } = this.config.retryConfig;
    return backoffMs * Math.pow(backoffMultiplier, retryCount - 1);
  }

  /**
   * Démarre une tâche
   */
  private async startTask(task: Task): Promise<void> {
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

    } catch (error: any) {
      await this.handleTaskError(task, error);
    }
  }

  /**
   * Exécute une tâche
   */
  private async executeTask(task: Task): Promise<any> {
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
  private getTaskDelay(type: TaskType): number {
    const delays: Record<TaskType, number> = {
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
  private async completeTask(task: Task, result: any): Promise<void> {
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
  private async handleTaskError(task: Task, error: any): Promise<void> {
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

    } else {
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
  private startCriticalSection(task: Task): void {
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
  private endCriticalSection(task: Task): void {
    if (task.criticalSectionId) {
      this.criticalSections.delete(task.criticalSectionId);
      this.emit('critical-section-ended', task);
      console.log(`🔓 Section critique terminée: ${task.criticalSectionId}`);
    }
  }

  /**
   * Vérifie si des tâches critiques sont en cours
   */
  private hasCriticalTasksRunning(): boolean {
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
  private isCriticalType(type: TaskType): boolean {
    return this.config.criticalSections.protectedTypes.includes(type);
  }

  /**
   * Annule une tâche
   */
  async cancelTask(taskId: string): Promise<boolean> {
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
      } else {
        console.warn(`⚠️ Impossible d'annuler tâche critique: ${taskId}`);
        return false;
      }
    }

    return false;
  }

  /**
   * Interrompt une tâche
   */
  async interruptTask(taskId: string, reason: string): Promise<boolean> {
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
  private cancelNonCriticalTasks(): void {
    const nonCriticalTasks: string[] = [];

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
  private updateStats(): void {
    const stats = this.getStats();
    this.emit('stats-updated', stats);
  }

  /**
   * Génère un ID de tâche unique
   */
  private generateTaskId(type: TaskType): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${type}-${timestamp}-${random}`;
  }

  /**
   * Récupère les statistiques de la file
   */
  getStats(): QueueStats {
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
  getTask(taskId: string): Task | undefined {
    // Chercher dans la file
    const queuedTask = this.queue.find(t => t.id === taskId);
    if (queuedTask) return queuedTask;

    // Chercher dans les tâches en cours
    const runningTask = this.runningTasks.get(taskId);
    if (runningTask) return runningTask;

    // Chercher dans l'historique
    return this.taskHistory.find(t => t.id === taskId);
  }

  /**
   * Récupère toutes les tâches
   */
  getAllTasks(): Task[] {
    return [
      ...this.queue,
      ...Array.from(this.runningTasks.values()),
      ...this.completedTasks
    ];
  }

  /**
   * Récupère les tâches par type
   */
  getTasksByType(type: TaskType): Task[] {
    return this.getAllTasks().filter(t => t.type === type);
  }

  /**
   * Récupère les tâches par projet
   */
  getTasksByProject(projectId: string): Task[] {
    return this.getAllTasks().filter(t => t.projectId === projectId);
  }

  /**
   * Récupère les compteurs par type
   */
  getTaskCounters(): Map<TaskType, number> {
    return new Map(this.taskCounters);
  }

  /**
   * Vide la file
   */
  clearQueue(): void {
    const count = this.queue.length;
    this.queue = [];
    console.log(`🧹 File vidée (${count} tâches supprimées)`);
  }

  /**
   * Nettoie l'historique ancien
   */
  cleanupHistory(maxAgeHours: number = 24): void {
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
  isActive(): boolean {
    return this.isProcessing;
  }

  /**
   * Récupère la configuration
   */
  getConfig(): TaskQueueConfig {
    return { ...this.config };
  }

  /**
   * Met à jour la configuration
   */
  updateConfig(updates: Partial<TaskQueueConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log('⚙️ Configuration file mise à jour');
  }
}
