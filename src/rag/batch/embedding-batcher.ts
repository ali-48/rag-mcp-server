// src/rag/batch/embedding-batcher.ts
// Batch configurable pour embeddings avec pause/resume et statistiques
// Version: v1.0.0
// Responsabilités: Gestion de batch, contrôle mémoire, statistiques, intégration LLM

import { logger } from '../../core/logger.js';
import type { CheckpointManager } from '../checkpoints/checkpoint-manager.js';
import type { ProgressState } from '../progress/progress-state.js';

/**
 * Interface pour les options de batch
 */
export interface BatchOptions {
    /** Taille maximale du batch (nombre d'éléments) */
    maxBatchSize: number;

    /** Taille maximale du batch en tokens */
    maxTokensPerBatch: number;

    /** Délai entre les batches (ms) */
    delayBetweenBatches: number;

    /** Taille maximale de la file d'attente */
    maxQueueSize: number;

    /** Activer les checkpoints */
    enableCheckpoints: boolean;

    /** Intervalle de checkpoint (batches) */
    checkpointInterval: number;

    /** Limite mémoire (MB) */
    memoryLimit: number;

    /** Stratégie de batch: 'fixed' | 'dynamic' | 'adaptive' */
    strategy: 'fixed' | 'dynamic' | 'adaptive';

    /** Modèle d'embedding utilisé */
    embeddingModel: string;

    /** Taille de contexte du modèle (tokens) */
    modelContextSize: number;
}

/**
 * Interface pour les statistiques de batch
 */
export interface BatchStats {
    /** Batches traités */
    batchesProcessed: number;

    /** Batches totaux */
    batchesTotal: number;

    /** Éléments traités */
    itemsProcessed: number;

    /** Éléments totaux */
    itemsTotal: number;

    /** Tokens traités */
    tokensProcessed: number;

    /** Tokens totaux */
    tokensTotal: number;

    /** Taux de traitement (éléments/seconde) */
    itemsPerSecond: number;

    /** Taux de traitement (tokens/seconde) */
    tokensPerSecond: number;

    /** Utilisation mémoire (MB) */
    memoryUsage: number;

    /** Temps écoulé (ms) */
    elapsedTime: number;

    /** Temps estimé restant (ms) */
    estimatedRemaining: number;

    /** Progression (0-100) */
    progress: number;

    /** Taux de succès (0-1) */
    successRate: number;

    /** Taux d'échec (0-1) */
    failureRate: number;

    /** Latence moyenne par batch (ms) */
    averageLatency: number;
}

/**
 * Interface pour un élément de batch
 */
export interface BatchItem<T = any> {
    /** ID unique de l'élément */
    id: string;

    /** Données à traiter */
    data: T;

    /** Métadonnées */
    metadata: {
        /** Tokens estimés */
        estimatedTokens: number;

        /** Priorité (1-10) */
        priority: number;

        /** Type de contenu */
        contentType: string;

        /** Langage */
        language?: string;

        /** Complexité estimée (1-10) */
        complexity?: number;

        /** Date de création */
        createdAt: Date;
    };

    /** État de traitement */
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

    /** Résultat du traitement */
    result?: any;

    /** Erreur (si échec) */
    error?: Error;

    /** Date de début de traitement */
    startedAt?: Date;

    /** Date de fin de traitement */
    completedAt?: Date;

    /** Durée de traitement (ms) */
    duration?: number;
}

/**
 * Interface pour un batch
 */
export interface Batch<T = any> {
    /** ID unique du batch */
    id: string;

    /** Éléments du batch */
    items: BatchItem<T>[];

    /** Métriques du batch */
    metrics: {
        /** Nombre d'éléments */
        itemCount: number;

        /** Nombre total de tokens */
        totalTokens: number;

        /** Taille estimée (octets) */
        estimatedSize: number;

        /** Priorité moyenne */
        averagePriority: number;

        /** Complexité moyenne */
        averageComplexity: number;
    };

    /** État du batch */
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

    /** Date de création */
    createdAt: Date;

    /** Date de début de traitement */
    startedAt?: Date;

    /** Date de fin de traitement */
    completedAt?: Date;

    /** Durée de traitement (ms) */
    duration?: number;

    /** Résultats du batch */
    results?: any[];

    /** Erreurs (si échec) */
    errors?: Error[];
}

/**
 * Interface pour les résultats de traitement de batch
 */
export interface BatchProcessingResult<T = any> {
    /** Succès de l'opération */
    success: boolean;

    /** Batch traité */
    batch: Batch<T>;

    /** Résultats individuels */
    itemResults: Array<{
        itemId: string;
        success: boolean;
        result?: any;
        error?: Error;
        duration: number;
    }>;

    /** Statistiques du traitement */
    stats: {
        /** Durée totale (ms) */
        totalDuration: number;

        /** Durée moyenne par élément (ms) */
        averageDuration: number;

        /** Taux de succès (0-1) */
        successRate: number;

        /** Tokens traités */
        tokensProcessed: number;

        /** Utilisation mémoire maximale (MB) */
        peakMemoryUsage: number;
    };

    /** Métadonnées */
    metadata: {
        /** Modèle utilisé */
        model: string;

        /** Version du batch processor */
        processorVersion: string;

        /** Timestamp de traitement */
        processedAt: Date;
    };
}

/**
 * Interface pour les callbacks de batch
 */
export interface BatchCallbacks<T = any> {
    /** Avant le traitement d'un batch */
    onBatchStart?: (batch: Batch<T>) => void;

    /** Après le traitement d'un batch */
    onBatchComplete?: (result: BatchProcessingResult<T>) => void;

    /** Avant le traitement d'un élément */
    onItemStart?: (item: BatchItem<T>, batchId: string) => void;

    /** Après le traitement d'un élément */
    onItemComplete?: (item: BatchItem<T>, result: any) => void;

    /** En cas d'erreur sur un élément */
    onItemError?: (item: BatchItem<T>, error: Error) => void;

    /** Progression globale */
    onProgress?: (stats: BatchStats) => void;

    /** Checkpoint créé */
    onCheckpoint?: (checkpointId: string, batchId: string) => void;

    /** Batch annulé */
    onBatchCancelled?: (batchId: string, reason: string) => void;
}

/**
 * Classe principale pour le batching d'embeddings
 */
export class EmbeddingBatcher<T = any> {
    private options: Required<BatchOptions>;
    private callbacks: Required<BatchCallbacks<T>>;
    private stats: BatchStats;
    private queue: BatchItem<T>[] = [];
    private batches: Batch<T>[] = [];
    private currentBatch: Batch<T> | null = null;
    private isRunning = false;
    private isPaused = false;
    private checkpointManager?: CheckpointManager;
    private progressState?: ProgressState;
    private startTime: Date;

    /**
     * Constructeur
     */
    constructor(options: Partial<BatchOptions> = {}, callbacks: BatchCallbacks<T> = {}) {
        this.options = {
            maxBatchSize: options.maxBatchSize || 100,
            maxTokensPerBatch: options.maxTokensPerBatch || 8192,
            delayBetweenBatches: options.delayBetweenBatches || 100,
            maxQueueSize: options.maxQueueSize || 10000,
            enableCheckpoints: options.enableCheckpoints ?? true,
            checkpointInterval: options.checkpointInterval || 10,
            memoryLimit: options.memoryLimit || 500,
            strategy: options.strategy || 'adaptive',
            embeddingModel: options.embeddingModel || 'nomic-embed-text',
            modelContextSize: options.modelContextSize || 8192,
        };

        this.callbacks = {
            onBatchStart: callbacks.onBatchStart || (() => { }),
            onBatchComplete: callbacks.onBatchComplete || (() => { }),
            onItemStart: callbacks.onItemStart || (() => { }),
            onItemComplete: callbacks.onItemComplete || (() => { }),
            onItemError: callbacks.onItemError || (() => { }),
            onProgress: callbacks.onProgress || (() => { }),
            onCheckpoint: callbacks.onCheckpoint || (() => { }),
            onBatchCancelled: callbacks.onBatchCancelled || (() => { }),
        };

        this.stats = {
            batchesProcessed: 0,
            batchesTotal: 0,
            itemsProcessed: 0,
            itemsTotal: 0,
            tokensProcessed: 0,
            tokensTotal: 0,
            itemsPerSecond: 0,
            tokensPerSecond: 0,
            memoryUsage: 0,
            elapsedTime: 0,
            estimatedRemaining: 0,
            progress: 0,
            successRate: 1.0,
            failureRate: 0.0,
            averageLatency: 0,
        };

        this.startTime = new Date();
    }

    /**
     * Définit le CheckpointManager
     */
    setCheckpointManager(manager: CheckpointManager): void {
        this.checkpointManager = manager;
    }

    /**
     * Définit le ProgressState
     */
    setProgressState(state: ProgressState): void {
        this.progressState = state;
    }

    /**
     * Ajoute un élément à la file d'attente
     */
    addItem(data: T, metadata: Partial<BatchItem<T>['metadata']> = {}): string {
        if (this.queue.length >= this.options.maxQueueSize) {
            throw new Error(`File d'attente pleine (max: ${this.options.maxQueueSize})`);
        }

        const itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        const item: BatchItem<T> = {
            id: itemId,
            data,
            metadata: {
                estimatedTokens: metadata.estimatedTokens || 100,
                priority: metadata.priority || 5,
                contentType: metadata.contentType || 'text',
                language: metadata.language,
                complexity: metadata.complexity || 1,
                createdAt: new Date(),
            },
            status: 'pending',
        };

        this.queue.push(item);
        this.stats.itemsTotal++;
        this.stats.tokensTotal += item.metadata.estimatedTokens;

        logger.debug('embedding.batcher.item.added', `Élément ajouté: ${itemId}`, {
            itemId,
            queueSize: this.queue.length,
            estimatedTokens: item.metadata.estimatedTokens,
            priority: item.metadata.priority,
        });

        return itemId;
    }

    /**
     * Ajoute plusieurs éléments à la file d'attente
     */
    addItems(items: Array<{ data: T; metadata?: Partial<BatchItem<T>['metadata']> }>): string[] {
        const itemIds: string[] = [];

        for (const item of items) {
            try {
                const itemId = this.addItem(item.data, item.metadata);
                itemIds.push(itemId);
            } catch (error) {
                logger.warn('embedding.batcher.item.add_failed', `Échec ajout élément`, {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        return itemIds;
    }

    /**
     * Crée un batch à partir de la file d'attente
     */
    private createBatch(): Batch<T> | null {
        if (this.queue.length === 0) {
            return null;
        }

        // Trier par priorité (plus haute priorité d'abord)
        this.queue.sort((a, b) => b.metadata.priority - a.metadata.priority);

        const batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const batchItems: BatchItem<T>[] = [];
        let totalTokens = 0;
        let totalPriority = 0;
        let totalComplexity = 0;

        // Sélectionner les éléments pour le batch selon la stratégie
        for (const item of this.queue) {
            if (batchItems.length >= this.options.maxBatchSize) {
                break;
            }

            if (totalTokens + item.metadata.estimatedTokens > this.options.maxTokensPerBatch) {
                if (this.options.strategy === 'fixed') {
                    break;
                }
                // Pour 'dynamic' et 'adaptive', on peut dépasser légèrement
                if (totalTokens + item.metadata.estimatedTokens > this.options.maxTokensPerBatch * 1.1) {
                    break;
                }
            }

            batchItems.push(item);
            totalTokens += item.metadata.estimatedTokens;
            totalPriority += item.metadata.priority;
            totalComplexity += item.metadata.complexity || 1;

            // Marquer l'élément comme en cours de traitement
            item.status = 'processing';
        }

        if (batchItems.length === 0) {
            return null;
        }

        // Retirer les éléments de la file d'attente
        this.queue = this.queue.filter(item => !batchItems.includes(item));

        const batch: Batch<T> = {
            id: batchId,
            items: batchItems,
            metrics: {
                itemCount: batchItems.length,
                totalTokens,
                estimatedSize: totalTokens * 4, // Estimation: 4 octets par token
                averagePriority: totalPriority / batchItems.length,
                averageComplexity: totalComplexity / batchItems.length,
            },
            status: 'pending',
            createdAt: new Date(),
        };

        this.batches.push(batch);
        this.stats.batchesTotal++;

        logger.info('embedding.batcher.batch.created', `Batch créé: ${batchId}`, {
            batchId,
            itemCount: batchItems.length,
            totalTokens,
            averagePriority: batch.metrics.averagePriority,
            queueRemaining: this.queue.length,
        });

        return batch;
    }

    /**
     * Met à jour les statistiques
     */
    private updateStats(): void {
        const now = new Date();
        this.stats.elapsedTime = now.getTime() - this.startTime.getTime();

        // Calculer la progression
        if (this.stats.itemsTotal > 0) {
            this.stats.progress = Math.min(100, Math.round((this.stats.itemsProcessed / this.stats.itemsTotal) * 100));
        }

        // Calculer les taux
        if (this.stats.elapsedTime > 0) {
            this.stats.itemsPerSecond = this.stats.itemsProcessed / (this.stats.elapsedTime / 1000);
            this.stats.tokensPerSecond = this.stats.tokensProcessed / (this.stats.elapsedTime / 1000);
        }

        // Calculer le temps restant
        if (this.stats.itemsPerSecond > 0) {
            const remainingItems = this.stats.itemsTotal - this.stats.itemsProcessed;
            this.stats.estimatedRemaining = remainingItems / this.stats.itemsPerSecond * 1000;
        }

        // Mettre à jour l'utilisation mémoire
        if (typeof process !== 'undefined' && process.memoryUsage) {
            const memoryUsage = process.memoryUsage();
            this.stats.memoryUsage = memoryUsage.heapUsed / 1024 / 1024;
        }

        // Appeler le callback de progression
        this.callbacks.onProgress(this.stats);

        // Mettre à jour le ProgressState si défini
        if (this.progressState) {
            // Mettre à jour les métriques globales directement
            this.progressState.globalMetrics.totalFiles = this.stats.itemsTotal;
            this.progressState.globalMetrics.totalFilesProcessed = this.stats.itemsProcessed;
            this.progressState.overallProgress = this.stats.progress;
        }
    }

    /**
     * Traite un élément individuel (méthode à surcharger)
     */
    protected async processItem(item: BatchItem<T>): Promise<any> {
        // Simulation de traitement d'embedding
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
            embedding: Array(384).fill(0).map(() => Math.random() - 0.5),
            tokens: item.metadata.estimatedTokens,
            model: this.options.embeddingModel,
            processedAt: new Date(),
        };
    }

    /**
     * Traite un batch
     */
    private async processBatch(batch: Batch<T>): Promise<BatchProcessingResult<T>> {
        const batchStartTime = Date.now();
        batch.status = 'processing';
        batch.startedAt = new Date();

        this.currentBatch = batch;
        this.callbacks.onBatchStart(batch);

        logger.info('embedding.batcher.batch.start', `Début traitement batch: ${batch.id}`, {
            batchId: batch.id,
            itemCount: batch.items.length,
            totalTokens: batch.metrics.totalTokens,
        });

        const itemResults: BatchProcessingResult<T>['itemResults'] = [];
        const results: any[] = [];
        const errors: Error[] = [];
        let successfulItems = 0;
        let totalDuration = 0;
        let peakMemoryUsage = 0;

        // Traiter chaque élément du batch
        for (const item of batch.items) {
            if (!this.isRunning || this.isPaused) {
                break;
            }

            const itemStartTime = Date.now();
            item.startedAt = new Date();
            this.callbacks.onItemStart(item, batch.id);

            try {
                // Traiter l'élément
                const result = await this.processItem(item);

                const itemDuration = Date.now() - itemStartTime;
                item.status = 'completed';
                item.result = result;
                item.completedAt = new Date();
                item.duration = itemDuration;

                // Mettre à jour les statistiques
                this.stats.itemsProcessed++;
                this.stats.tokensProcessed += item.metadata.estimatedTokens;
                successfulItems++;
                totalDuration += itemDuration;

                // Enregistrer le résultat
                itemResults.push({
                    itemId: item.id,
                    success: true,
                    result,
                    duration: itemDuration,
                });
                results.push(result);

                // Appeler le callback
                this.callbacks.onItemComplete(item, result);

                logger.debug('embedding.batcher.item.complete', `Élément traité: ${item.id}`, {
                    itemId: item.id,
                    duration: itemDuration,
                    tokens: item.metadata.estimatedTokens,
                });

            } catch (error) {
                const itemDuration = Date.now() - itemStartTime;
                item.status = 'failed';
                item.error = error instanceof Error ? error : new Error(String(error));
                item.completedAt = new Date();
                item.duration = itemDuration;

                // Enregistrer l'erreur
                const errorObj = error instanceof Error ? error : new Error(String(error));
                errors.push(errorObj);
                itemResults.push({
                    itemId: item.id,
                    success: false,
                    error: errorObj,
                    duration: itemDuration,
                });

                // Appeler le callback d'erreur
                this.callbacks.onItemError(item, errorObj);

                logger.warn('embedding.batcher.item.error', `Erreur traitement élément: ${item.id}`, {
                    itemId: item.id,
                    error: errorObj.message,
                    duration: itemDuration,
                });
            }

            // Mettre à jour l'utilisation mémoire
            if (typeof process !== 'undefined' && process.memoryUsage) {
                const memoryUsage = process.memoryUsage();
                const currentUsage = memoryUsage.heapUsed / 1024 / 1024;
                if (currentUsage > peakMemoryUsage) {
                    peakMemoryUsage = currentUsage;
                }
            }

            // Mettre à jour les statistiques
            this.updateStats();
        }

        // Finaliser le batch
        const batchDuration = Date.now() - batchStartTime;
        batch.status = errors.length === 0 ? 'completed' : 'failed';
        batch.completedAt = new Date();
        batch.duration = batchDuration;
        batch.results = results;
        if (errors.length > 0) {
            batch.errors = errors;
        }

        // Mettre à jour les statistiques globales
        this.stats.batchesProcessed++;
        this.stats.successRate = successfulItems / batch.items.length;
        this.stats.failureRate = 1 - this.stats.successRate;
        this.stats.averageLatency = totalDuration / batch.items.length;

        // Créer le résultat
        const result: BatchProcessingResult<T> = {
            success: errors.length === 0,
            batch,
            itemResults,
            stats: {
                totalDuration: batchDuration,
                averageDuration: totalDuration / batch.items.length,
                successRate: this.stats.successRate,
                tokensProcessed: this.stats.tokensProcessed,
                peakMemoryUsage,
            },
            metadata: {
                model: this.options.embeddingModel,
                processorVersion: '1.0.0',
                processedAt: new Date(),
            },
        };

        // Appeler le callback de complétion
        this.callbacks.onBatchComplete(result);

        logger.info('embedding.batcher.batch.complete', `Batch terminé: ${batch.id}`, {
            batchId: batch.id,
            success: result.success,
            itemsProcessed: batch.items.length,
            successfulItems,
            failedItems: errors.length,
            duration: batchDuration,
            successRate: this.stats.successRate,
        });

        return result;
    }

    /**
     * Démarre le traitement des batches
     */
    async start(): Promise<BatchStats> {
        if (this.isRunning) {
            throw new Error('EmbeddingBatcher déjà en cours d\'exécution');
        }

        this.isRunning = true;
        this.startTime = new Date();

        logger.info('embedding.batcher.start', 'Début traitement des batches', {
            queueSize: this.queue.length,
            options: this.options,
        });

        try {
            // Traiter les batches tant qu'il y a des éléments dans la file
            while (this.queue.length > 0 && this.isRunning) {
                if (this.isPaused) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    continue;
                }

                // Créer un batch
                const batch = this.createBatch();
                if (!batch) {
                    break;
                }

                // Traiter le batch
                await this.processBatch(batch);

                // Délai entre les batches
                if (this.options.delayBetweenBatches > 0) {
                    await new Promise(resolve => setTimeout(resolve, this.options.delayBetweenBatches));
                }

                // Créer un checkpoint si nécessaire
                if (this.options.enableCheckpoints && this.checkpointManager &&
                    this.stats.batchesProcessed % this.options.checkpointInterval === 0) {
                    await this.createCheckpoint(batch.id);
                }
            }

            // Marquer comme terminé
            this.isRunning = false;

            logger.info('embedding.batcher.complete', 'Traitement des batches terminé', {
                batchesProcessed: this.stats.batchesProcessed,
                itemsProcessed: this.stats.itemsProcessed,
                tokensProcessed: this.stats.tokensProcessed,
                elapsedTime: this.stats.elapsedTime,
                successRate: this.stats.successRate,
            });

            return this.stats;

        } catch (error) {
            this.isRunning = false;
            logger.error('embedding.batcher.error', 'Erreur lors du traitement des batches', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /**
     * Met en pause le traitement
     */
    pause(): void {
        this.isPaused = true;
        logger.info('embedding.batcher.pause', 'Traitement mis en pause', {
            batchesProcessed: this.stats.batchesProcessed,
            itemsProcessed: this.stats.itemsProcessed,
        });
    }

    /**
     * Reprend le traitement
     */
    resume(): void {
        this.isPaused = false;
        logger.info('embedding.batcher.resume', 'Traitement repris', {
            batchesProcessed: this.stats.batchesProcessed,
            itemsProcessed: this.stats.itemsProcessed,
        });
    }

    /**
     * Arrête le traitement
     */
    stop(): void {
        this.isRunning = false;
        this.isPaused = false;
        logger.info('embedding.batcher.stop', 'Traitement arrêté', {
            batchesProcessed: this.stats.batchesProcessed,
            itemsProcessed: this.stats.itemsProcessed,
            elapsedTime: this.stats.elapsedTime,
        });
    }

    /**
     * Crée un checkpoint
     */
    private async createCheckpoint(batchId: string): Promise<void> {
        if (!this.checkpointManager) {
            return;
        }

        const checkpointId = `batch-checkpoint-${batchId}-${Date.now()}`;
        const checkpointData = {
            batchId,
            stats: this.stats,
            queue: this.queue,
            batches: this.batches,
            currentBatch: this.currentBatch,
            timestamp: new Date(),
        };

        try {
            await this.checkpointManager.saveCheckpoint(checkpointId, checkpointData);
            this.callbacks.onCheckpoint(checkpointId, batchId);

            logger.debug('embedding.batcher.checkpoint.saved', `Checkpoint créé: ${checkpointId}`, {
                checkpointId,
                batchId,
                queueSize: this.queue.length,
            });

        } catch (error) {
            logger.error('embedding.batcher.checkpoint.error', 'Erreur création checkpoint', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Charge un checkpoint
     */
    async loadCheckpoint(checkpointId: string): Promise<boolean> {
        if (!this.checkpointManager) {
            logger.warn('embedding.batcher.checkpoint.no_manager', 'CheckpointManager non défini');
            return false;
        }

        try {
            const result = await this.checkpointManager.loadCheckpoint(checkpointId);
            if (!result.success || !result.state) {
                return false;
            }

            const checkpoint = result.state;
            this.stats = checkpoint.stats;
            this.queue = checkpoint.queue;
            this.batches = checkpoint.batches;
            this.currentBatch = checkpoint.currentBatch;

            logger.info('embedding.batcher.checkpoint.loaded', `Checkpoint chargé: ${checkpointId}`, {
                checkpointId,
                queueSize: this.queue.length,
                batchesProcessed: this.stats.batchesProcessed,
            });

            return true;

        } catch (error) {
            logger.error('embedding.batcher.checkpoint.load_error', 'Erreur chargement checkpoint', {
                checkpointId,
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }

    /**
     * Récupère les statistiques actuelles
     */
    getStats(): BatchStats {
        return { ...this.stats };
    }

    /**
     * Récupère la file d'attente
     */
    getQueue(): BatchItem<T>[] {
        return [...this.queue];
    }

    /**
     * Récupère les batches
     */
    getBatches(): Batch<T>[] {
        return [...this.batches];
    }

    /**
     * Vide la file d'attente
     */
    clearQueue(): void {
        this.queue = [];
        logger.info('embedding.batcher.queue.cleared', 'File d\'attente vidée');
    }

    /**
     * Teste le EmbeddingBatcher
     */
    static async test(): Promise<boolean> {
        try {
            logger.info('embedding.batcher.test.start', 'Début test EmbeddingBatcher');

            // Créer un batcher de test
            const batcher = new EmbeddingBatcher<string>({
                maxBatchSize: 10,
                maxTokensPerBatch: 1000,
                delayBetweenBatches: 0,
                enableCheckpoints: false,
            });

            // Ajouter des éléments de test
            const testItems = Array.from({ length: 25 }, (_, i) => ({
                data: `Test content ${i + 1}`,
                metadata: {
                    estimatedTokens: 50 + Math.floor(Math.random() * 50),
                    priority: Math.floor(Math.random() * 10) + 1,
                    contentType: 'text',
                    language: 'french',
                    complexity: Math.floor(Math.random() * 5) + 1,
                },
            }));

            batcher.addItems(testItems);

            // Variables pour collecter les résultats
            let batchesProcessed = 0;
            let itemsProcessed = 0;

            batcher.callbacks.onBatchComplete = (result) => {
                batchesProcessed++;
                itemsProcessed += result.batch.items.length;
                logger.debug('embedding.batcher.test.batch', `Batch traité: ${result.batch.id}`, {
                    batchId: result.batch.id,
                    items: result.batch.items.length,
                    success: result.success,
                    duration: result.stats.totalDuration,
                });
            };

            // Démarrer le traitement
            const stats = await batcher.start();

            if (batchesProcessed === 0) {
                throw new Error('Aucun batch traité');
            }

            if (itemsProcessed !== testItems.length) {
                throw new Error(`Nombre d'éléments traité incorrect: ${itemsProcessed} au lieu de ${testItems.length}`);
            }

            logger.info('embedding.batcher.test.success', 'Test EmbeddingBatcher réussi', {
                batchesProcessed,
                itemsProcessed,
                elapsedTime: stats.elapsedTime,
                successRate: stats.successRate,
            });

            return true;

        } catch (error) {
            logger.error('embedding.batcher.test.failed', 'Test EmbeddingBatcher échoué', {
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }
}

/**
 * Instance singleton de EmbeddingBatcher
 */
let embeddingBatcherInstance: EmbeddingBatcher<any> | null = null;

/**
 * Obtient l'instance singleton de EmbeddingBatcher
 */
export function getEmbeddingBatcher<T = any>(options?: Partial<BatchOptions>, callbacks?: BatchCallbacks<T>): EmbeddingBatcher<T> {
    if (!embeddingBatcherInstance) {
        embeddingBatcherInstance = new EmbeddingBatcher(options, callbacks);
    }
    return embeddingBatcherInstance as EmbeddingBatcher<T>;
}

/**
 * Teste le module EmbeddingBatcher
 */
export async function testEmbeddingBatcherModule(): Promise<boolean> {
    return EmbeddingBatcher.test();
}

// Exécution automatique si ce fichier est exécuté directement
if (typeof require !== 'undefined' && require.main === module) {
    testEmbeddingBatcherModule().then(success => {
        if (success) {
            console.log(JSON.stringify({
                success: true,
                message: 'EmbeddingBatcher testé avec succès'
            }, null, 2));
            process.exit(0);
        } else {
            console.error(JSON.stringify({
                success: false,
                message: 'Échec du test EmbeddingBatcher'
            }, null, 2));
            process.exit(1);
        }
    });
}
