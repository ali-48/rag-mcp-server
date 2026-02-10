/**
 * File d'attente locale pour événements en cas de déconnexion
 *
 * Cette file d'attente persiste les événements en mémoire et permet
 * de les retenter automatiquement lors de la reconnexion.
 */

import { logger } from '../../context-capture/utils/logger.js';

/**
 * Priorité d'un élément dans la file d'attente
 */
export type QueuePriority = 'low' | 'medium' | 'high';

/**
 * Options pour l'ajout d'un élément à la file d'attente
 */
export interface QueueItemOptions {
  /** Priorité de l'élément */
  priority: QueuePriority;
  /** Nombre maximum de tentatives */
  maxRetries: number;
  /** Délai entre les tentatives (ms) */
  retryDelay: number;
  /** Temps d'expiration (ms) - 0 = pas d'expiration */
  ttl: number;
  /** Ne pas journaliser cet élément */
  silent: boolean;
}

/**
 * Élément de la file d'attente
 */
export interface QueueItem<T = any> {
  /** ID unique de l'élément */
  id: string;
  /** Données de l'élément */
  data: T;
  /** Type de l'élément (pour le routage) */
  type: string;
  /** Options de traitement */
  options: QueueItemOptions;
  /** Métadonnées */
  metadata: {
    /** Timestamp de création */
    createdAt: number;
    /** Timestamp de dernière tentative */
    lastAttemptAt: number | null;
    /** Nombre de tentatives */
    attemptCount: number;
    /** Statut actuel */
    status: 'pending' | 'processing' | 'failed' | 'completed';
    /** Erreur de la dernière tentative */
    lastError: string | null;
  };
  /** Callback de succès */
  resolve?: (value: any) => void;
  /** Callback d'erreur */
  reject?: (reason?: any) => void;
}

/**
 * Statistiques de la file d'attente
 */
export interface QueueStats {
  /** Nombre total d'éléments */
  totalItems: number;
  /** Éléments en attente */
  pendingItems: number;
  /** Éléments en cours de traitement */
  processingItems: number;
  /** Éléments échoués */
  failedItems: number;
  /** Éléments complétés */
  completedItems: number;
  /** Éléments expirés */
  expiredItems: number;
  /** Taille maximale atteinte */
  maxSizeReached: number;
  /** Taux de succès */
  successRate: number;
  /** Temps moyen de traitement (ms) */
  averageProcessingTime: number;
  /** Distribution par priorité */
  priorityDistribution: Record<QueuePriority, number>;
  /** Distribution par type */
  typeDistribution: Record<string, number>;
}

/**
 * Configuration de la file d'attente
 */
export interface LocalQueueConfig {
  /** Taille maximale de la file */
  maxSize: number;
  /** Intervalle de traitement (ms) */
  processingInterval: number;
  /** Traitement automatique activé */
  autoProcessing: boolean;
  /** Persistance en mémoire activée */
  memoryPersistence: boolean;
  /** Journalisation détaillée */
  verboseLogging: boolean;
  /** Nettoyage automatique des éléments expirés */
  autoCleanup: boolean;
  /** Intervalle de nettoyage (ms) */
  cleanupInterval: number;
}

/**
 * File d'attente locale avec persistance en mémoire
 */
export class LocalQueue<T = any> {
  private items: QueueItem<T>[] = [];
  private config: LocalQueueConfig;
  private stats: QueueStats;
  private isProcessing: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private itemIdCounter: number = 0;
  private processingCallbacks: Map<string, (item: QueueItem<T>) => Promise<any>> = new Map();

  constructor(config?: Partial<LocalQueueConfig>) {
    this.config = {
      maxSize: 1000,
      processingInterval: 1000,
      autoProcessing: true,
      memoryPersistence: true,
      verboseLogging: false,
      autoCleanup: true,
      cleanupInterval: 30000, // 30 secondes
      ...config
    };

    this.stats = {
      totalItems: 0,
      pendingItems: 0,
      processingItems: 0,
      failedItems: 0,
      completedItems: 0,
      expiredItems: 0,
      maxSizeReached: 0,
      successRate: 0,
      averageProcessingTime: 0,
      priorityDistribution: { low: 0, medium: 0, high: 0 },
      typeDistribution: {}
    };

    this.initialize();
  }

  /**
   * Initialise la file d'attente
   */
  private initialize(): void {
    if (this.config.autoProcessing) {
      this.startProcessing();
    }

    if (this.config.autoCleanup) {
      this.startCleanup();
    }

    logger.info('LocalQueue initialisée', {
      config: this.config,
      maxSize: this.config.maxSize
    });
  }

  /**
   * Démarre le traitement automatique
   */
  startProcessing(): void {
    if (this.processingInterval) {
      return;
    }

    this.processingInterval = setInterval(() => {
      this.processNextBatch();
    }, this.config.processingInterval);

    logger.info('Traitement automatique démarré', {
      interval: this.config.processingInterval
    });
  }

  /**
   * Arrête le traitement automatique
   */
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      logger.info('Traitement automatique arrêté');
    }
  }

  /**
   * Démarre le nettoyage automatique
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredItems();
    }, this.config.cleanupInterval);

    if (this.config.verboseLogging) {
      logger.info('Nettoyage automatique démarré', {
        interval: this.config.cleanupInterval
      });
    }
  }

  /**
   * Arrête le nettoyage automatique
   */
  private stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Nettoyage automatique arrêté');
    }
  }

  /**
   * Génère un ID unique pour un élément
   */
  private generateItemId(): string {
    this.itemIdCounter++;
    return `queue-item-${this.itemIdCounter}-${Date.now()}`;
  }

  /**
   * Ajoute un élément à la file d'attente
   */
  public enqueue(
    data: T,
    type: string,
    options?: Partial<QueueItemOptions>
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      // Vérifier si la file est pleine
      if (this.items.length >= this.config.maxSize) {
        const evicted = this.evictLowPriorityItems();
        if (!evicted) {
          const error = new Error('File d\'attente pleine et impossible d\'évincer des éléments');
          logger.error('Impossible d\'ajouter l\'élément à la file', {
            type,
            currentSize: this.items.length,
            maxSize: this.config.maxSize
          });
          reject(error);
          return;
        }
      }

      const itemOptions: QueueItemOptions = {
        priority: 'medium',
        maxRetries: 3,
        retryDelay: 1000,
        ttl: 0,
        silent: false,
        ...options
      };

      const item: QueueItem<T> = {
        id: this.generateItemId(),
        data,
        type,
        options: itemOptions,
        metadata: {
          createdAt: Date.now(),
          lastAttemptAt: null,
          attemptCount: 0,
          status: 'pending',
          lastError: null
        },
        resolve,
        reject
      };

      // Ajouter l'élément à la file selon sa priorité
      this.insertItemByPriority(item);

      // Mettre à jour les statistiques
      this.updateStatsAfterEnqueue(item);

      if (!itemOptions.silent && this.config.verboseLogging) {
        logger.debug('Élément ajouté à la file d\'attente', {
          itemId: item.id,
          type,
          priority: itemOptions.priority,
          queueSize: this.items.length
        });
      }

      // Démarrer le traitement si nécessaire
      if (this.config.autoProcessing && !this.isProcessing) {
        this.processNextBatch();
      }
    });
  }

  /**
   * Insère un élément dans la file selon sa priorité
   */
  private insertItemByPriority(item: QueueItem<T>): void {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const itemPriority = priorityOrder[item.options.priority];

    // Trouver la position d'insertion
    let insertIndex = 0;
    for (let i = 0; i < this.items.length; i++) {
      const currentPriority = priorityOrder[this.items[i].options.priority];
      if (itemPriority > currentPriority) {
        insertIndex = i;
        break;
      }
      insertIndex = i + 1;
    }

    // Insérer l'élément à la position trouvée
    this.items.splice(insertIndex, 0, item);
  }

  /**
   * Évince les éléments de basse priorité lorsque la file est pleine
   */
  private evictLowPriorityItems(): boolean {
    // Trier les éléments par priorité (bas en haut)
    const sortedByPriority = [...this.items].sort((a, b) => {
      const priorityOrder = { low: 1, medium: 2, high: 3 };
      return priorityOrder[a.options.priority] - priorityOrder[b.options.priority];
    });

    // Évincer les éléments de priorité "low" d'abord
    for (const item of sortedByPriority) {
      if (item.options.priority === 'low') {
        const index = this.items.findIndex(i => i.id === item.id);
        if (index !== -1) {
          const evictedItem = this.items.splice(index, 1)[0];

          // Appeler le callback de rejet
          if (evictedItem.reject) {
            evictedItem.reject(new Error('Élément évincé de la file d\'attente (priorité basse)'));
          }

          // Mettre à jour les statistiques
          this.stats.expiredItems++;
          this.stats.priorityDistribution.low--;

          logger.warn('Élément évincé de la file d\'attente', {
            itemId: evictedItem.id,
            type: evictedItem.type,
            reason: 'priorité basse, file pleine'
          });

          return true;
        }
      }
    }

    return false;
  }

  /**
   * Met à jour les statistiques après l'ajout d'un élément
   */
  private updateStatsAfterEnqueue(item: QueueItem<T>): void {
    this.stats.totalItems++;
    this.stats.pendingItems++;
    this.stats.priorityDistribution[item.options.priority]++;

    // Mettre à jour la distribution par type
    if (!this.stats.typeDistribution[item.type]) {
      this.stats.typeDistribution[item.type] = 0;
    }
    this.stats.typeDistribution[item.type]++;

    // Mettre à jour la taille maximale atteinte
    if (this.items.length > this.stats.maxSizeReached) {
      this.stats.maxSizeReached = this.items.length;
    }
  }

  /**
   * Traite le prochain lot d'éléments
   */
  private async processNextBatch(): Promise<void> {
    if (this.isProcessing || this.items.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Nettoyer les éléments expirés avant le traitement
      this.cleanupExpiredItems();

      // Obtenir les éléments à traiter (priorité haute d'abord)
      const itemsToProcess = this.getNextItemsToProcess();

      for (const item of itemsToProcess) {
        await this.processItem(item);
      }

    } catch (error) {
      logger.error('Erreur lors du traitement du lot', {
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Obtient les prochains éléments à traiter
   */
  private getNextItemsToProcess(): QueueItem<T>[] {
    // Filtrer les éléments en attente
    const pendingItems = this.items.filter(item => item.metadata.status === 'pending');

    // Trier par priorité (haute d'abord)
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return pendingItems.sort((a, b) => {
      return priorityOrder[b.options.priority] - priorityOrder[a.options.priority];
    }).slice(0, 10); // Limiter à 10 éléments par lot
  }

  /**
   * Traite un élément individuel
   */
  private async processItem(item: QueueItem<T>): Promise<void> {
    // Vérifier si l'élément a expiré
    if (this.isItemExpired(item)) {
      this.markItemAsExpired(item);
      return;
    }

    // Vérifier le nombre maximum de tentatives
    if (item.metadata.attemptCount >= item.options.maxRetries) {
      this.markItemAsFailed(item, 'Nombre maximum de tentatives atteint');
      return;
    }

    // Mettre à jour le statut
    item.metadata.status = 'processing';
    item.metadata.lastAttemptAt = Date.now();
    item.metadata.attemptCount++;

    // Mettre à jour les statistiques
    this.stats.pendingItems--;
    this.stats.processingItems++;

    try {
      // Obtenir le callback de traitement pour ce type
      const processCallback = this.processingCallbacks.get(item.type);
      if (!processCallback) {
        throw new Error(`Aucun callback de traitement enregistré pour le type: ${item.type}`);
      }

      // Exécuter le traitement
      const startTime = Date.now();
      const result = await processCallback(item);
      const processingTime = Date.now() - startTime;

      // Marquer l'élément comme complété
      this.markItemAsCompleted(item, result, processingTime);

    } catch (error) {
      // Gérer l'erreur
      const errorMessage = error instanceof Error ? error.message : String(error);
      item.metadata.lastError = errorMessage;

      // Vérifier si on doit retenter
      if (item.metadata.attemptCount < item.options.maxRetries) {
        // Replanifier la tentative
        this.scheduleRetry(item);
      } else {
        // Marquer comme échoué
        this.markItemAsFailed(item, errorMessage);
      }
    } finally {
      // Mettre à jour les statistiques
      this.stats.processingItems--;
    }
  }

  /**
   * Vérifie si un élément a expiré
   */
  private isItemExpired(item: QueueItem<T>): boolean {
    if (item.options.ttl === 0) {
      return false;
    }

    const age = Date.now() - item.metadata.createdAt;
    return age > item.options.ttl;
  }

  /**
   * Marque un élément comme expiré
   */
  private markItemAsExpired(item: QueueItem<T>): void {
    const index = this.items.findIndex(i => i.id === item.id);
    if (index !== -1) {
      this.items.splice(index, 1);

      // Appeler le callback de rejet
      if (item.reject) {
        item.reject(new Error('Élément expiré dans la file d\'attente'));
      }

      // Mettre à jour les statistiques
      this.stats.expiredItems++;
      this.stats.priorityDistribution[item.options.priority]--;
      this.stats.typeDistribution[item.type]--;

      logger.warn('Élément expiré retiré de la file', {
        itemId: item.id,
        type: item.type,
        age: Date.now() - item.metadata.createdAt
      });
    }
  }

  /**
   * Marque un élément comme complété
   */
  private markItemAsCompleted(item: QueueItem<T>, result: any, processingTime: number): void {
    const index = this.items.findIndex(i => i.id === item.id);
    if (index !== -1) {
      this.items.splice(index, 1);

      // Appeler le callback de succès
      if (item.resolve) {
        item.resolve(result);
      }

      // Mettre à jour les statistiques
      this.stats.completedItems++;
      this.stats.priorityDistribution[item.options.priority]--;
      this.stats.typeDistribution[item.type]--;

      // Mettre à jour le temps moyen de traitement
      this.updateAverageProcessingTime(processingTime);

      if (!item.options.silent && this.config.verboseLogging) {
        logger.debug('Élément traité avec succès', {
          itemId: item.id,
          type: item.type,
          processingTime,
          attemptCount: item.metadata.attemptCount
        });
      }
    }
  }

  /**
   * Marque un élément comme échoué
   */
  private markItemAsFailed(item: QueueItem<T>, error: string): void {
    const index = this.items.findIndex(i => i.id === item.id);
    if (index !== -1) {
      this.items.splice(index, 1);

      // Appeler le callback de rejet
      if (item.reject) {
        item.reject(new Error(`Élément échoué: ${error}`));
      }

      // Mettre à jour les statistiques
      this.stats.failedItems++;
      this.stats.priorityDistribution[item.options.priority]--;
      this.stats.typeDistribution[item.type]--;

      logger.error('Élément échoué retiré de la file', {
        itemId: item.id,
        type: item.type,
        error,
        attemptCount: item.metadata.attemptCount
      });
    }
  }

  /**
   * Replanifie une tentative pour un élément
   */
  private scheduleRetry(item: QueueItem<T>): void {
    // Réinitialiser le statut
    item.metadata.status = 'pending';
    item.metadata.lastAttemptAt = null;

    // Mettre à jour les statistiques
    this.stats.pendingItems++;

    // Replanifier après le délai de retry
    setTimeout(() => {
      if (this.config.autoProcessing) {
        this.processNextBatch();
      }
    }, item.options.retryDelay);

    if (this.config.verboseLogging) {
      logger.debug('Tentative replanifiée', {
        itemId: item.id,
        type: item.type,
        attemptCount: item.metadata.attemptCount,
        nextAttemptIn: item.options.retryDelay
      });
    }
  }

  /**
   * Met à jour le temps moyen de traitement
   */
  private updateAverageProcessingTime(newTime: number): void {
    if (this.stats.completedItems === 1) {
      this.stats.averageProcessingTime = newTime;
    } else {
      this.stats.averageProcessingTime =
        (this.stats.averageProcessingTime * (this.stats.completedItems - 1) + newTime) /
        this.stats.completedItems;
    }
  }

  /**
   * Nettoie les éléments expirés
   */
  private cleanupExpiredItems(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];

      if (this.isItemExpired(item)) {
        this.markItemAsExpired(item);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0 && this.config.verboseLogging) {
      logger.info('Éléments expirés nettoyés', {
        count: cleanedCount,
        remainingItems: this.items.length
      });
    }
  }

  /**
   * Enregistre un callback de traitement pour un type d'élément
   */
  public registerProcessor(type: string, callback: (item: QueueItem<T>) => Promise<any>): void {
    this.processingCallbacks.set(type, callback);

    if (this.config.verboseLogging) {
      logger.info('Callback de traitement enregistré', {
        type,
        totalProcessors: this.processingCallbacks.size
      });
    }
  }

  /**
   * Supprime un callback de traitement
   */
  public unregisterProcessor(type: string): void {
    this.processingCallbacks.delete(type);

    if (this.config.verboseLogging) {
      logger.info('Callback de traitement supprimé', {
        type,
        remainingProcessors: this.processingCallbacks.size
      });
    }
  }

  /**
   * Vide la file d'attente
   */
  public clear(): void {
    const count = this.items.length;

    // Appeler les callbacks de rejet pour tous les éléments
    this.items.forEach(item => {
      if (item.reject) {
        item.reject(new Error('File d\'attente vidée'));
      }
    });

    // Réinitialiser la file
    this.items = [];
    this.itemIdCounter = 0;

    // Réinitialiser les statistiques
    this.stats = {
      totalItems: 0,
      pendingItems: 0,
      processingItems: 0,
      failedItems: 0,
      completedItems: 0,
      expiredItems: 0,
      maxSizeReached: this.stats.maxSizeReached,
      successRate: 0,
      averageProcessingTime: 0,
      priorityDistribution: { low: 0, medium: 0, high: 0 },
      typeDistribution: {}
    };

    logger.info('File d\'attente vidée', {
      clearedItems: count
    });
  }

  /**
   * Obtient les statistiques actuelles
   */
  public getStats(): QueueStats {
    // Calculer le taux de succès
    const totalProcessed = this.stats.completedItems + this.stats.failedItems;
    this.stats.successRate = totalProcessed > 0
      ? this.stats.completedItems / totalProcessed
      : 0;

    return { ...this.stats };
  }

  /**
   * Obtient l'état actuel de la file
   */
  public getStatus(): {
    size: number;
    isProcessing: boolean;
    hasProcessors: boolean;
    config: LocalQueueConfig;
  } {
    return {
      size: this.items.length,
      isProcessing: this.isProcessing,
      hasProcessors: this.processingCallbacks.size > 0,
      config: this.config
    };
  }

  /**
   * Obtient les éléments en attente
   */
  public getPendingItems(): QueueItem<T>[] {
    return this.items.filter(item => item.metadata.status === 'pending');
  }

  /**
   * Obtient tous les éléments de la file
   */
  public getAllItems(): QueueItem<T>[] {
    return [...this.items];
  }

  /**
   * Obtient le nombre d'éléments dans la file
   */
  public getSize(): number {
    return this.items.length;
  }

  /**
   * Vérifie si la file est vide
   */
  public isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * Vérifie si la file est pleine
   */
  public isFull(): boolean {
    return this.items.length >= this.config.maxSize;
  }

  /**
   * Détruit la file d'attente et libère les ressources
   */
  public destroy(): void {
    // Arrêter les intervalles
    this.stopProcessing();
    this.stopCleanup();

    // Vider la file
    this.clear();

    // Nettoyer les callbacks
    this.processingCallbacks.clear();

    logger.info('LocalQueue détruite');
  }
}

export default LocalQueue;
