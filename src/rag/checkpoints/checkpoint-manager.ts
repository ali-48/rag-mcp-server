// src/rag/checkpoints/checkpoint-manager.ts
// Gestionnaire de checkpoints pour reprise après crash

import { logger } from "../../core/logger.js";
import { RagUsageError } from "../errors/rag-usage-error.js";
import { RagJob } from "../queue/job-types.js";

/**
 * État d'un checkpoint
 */
export interface CheckpointState {
    /** ID unique du checkpoint */
    id: string;

    /** Type de checkpoint (job, phase, file, etc.) */
    type: 'job' | 'phase' | 'file' | 'batch' | 'custom';

    /** ID du job associé (si applicable) */
    jobId?: string;

    /** ID de la phase associée (si applicable) */
    phaseId?: string;

    /** Chemin du projet */
    projectPath: string;

    /** État sérialisable du checkpoint */
    state: Record<string, any>;

    /** Métadonnées du checkpoint */
    metadata: {
        /** Date de création */
        createdAt: Date;

        /** Date de dernière mise à jour */
        updatedAt: Date;

        /** Version du format de checkpoint */
        version: string;

        /** Hash de vérification (optionnel) */
        checksum?: string;

        /** Taille des données (octets) */
        size?: number;

        /** Tags pour organisation */
        tags?: string[];
    };

    /** Statistiques d'exécution */
    stats?: {
        /** Fichiers traités */
        filesProcessed: number;

        /** Fichiers totaux */
        filesTotal: number;

        /** Temps écoulé (ms) */
        elapsedTime: number;

        /** Estimation temps restant (ms) */
        estimatedRemaining?: number;

        /** Taux de progression (0-100) */
        progress: number;
    };
}

/**
 * Options de création de checkpoint
 */
export interface CheckpointOptions {
    /** Forcer la création même si un checkpoint existe déjà */
    force?: boolean;

    /** TTL (Time To Live) en secondes */
    ttlSeconds?: number;

    /** Tags pour organisation */
    tags?: string[];

    /** Niveau de compression (0-9) */
    compressionLevel?: number;

    /** Chiffrer les données */
    encrypt?: boolean;
}

/**
 * Résultat de sauvegarde de checkpoint
 */
export interface CheckpointSaveResult {
    /** Succès de l'opération */
    success: boolean;

    /** ID du checkpoint */
    checkpointId: string;

    /** Chemin de stockage */
    storagePath?: string;

    /** Taille des données (octets) */
    size?: number;

    /** Message d'information */
    message?: string;

    /** Avertissements */
    warnings?: string[];
}

/**
 * Résultat de chargement de checkpoint
 */
export interface CheckpointLoadResult<T = any> {
    /** Succès de l'opération */
    success: boolean;

    /** État restauré */
    state?: T;

    /** Checkpoint chargé */
    checkpoint?: CheckpointState;

    /** Message d'information */
    message?: string;

    /** Erreurs (si succès partiel) */
    errors?: string[];
}

/**
 * Configuration du gestionnaire de checkpoints
 */
export interface CheckpointManagerConfig {
    /** Répertoire de stockage des checkpoints */
    storageDir: string;

    /** TTL par défaut (secondes) */
    defaultTTL: number;

    /** Niveau de compression par défaut (0-9) */
    defaultCompressionLevel: number;

    /** Taille maximale des checkpoints (octets) */
    maxCheckpointSize: number;

    /** Nombre maximum de checkpoints par projet */
    maxCheckpointsPerProject: number;

    /** Activer le chiffrement */
    enableEncryption: boolean;

    /** Clé de chiffrement (optionnelle) */
    encryptionKey?: string;

    /** Intervalle de nettoyage automatique (secondes) */
    cleanupInterval: number;
}

/**
 * Gestionnaire de checkpoints pour reprise après crash
 */
export class CheckpointManager {
    private config: CheckpointManagerConfig;
    private checkpoints = new Map<string, CheckpointState>();
    private cleanupInterval: NodeJS.Timeout | null = null;
    private fs: typeof import('fs') = null!;
    private path: typeof import('path') = null!;
    private crypto: typeof import('crypto') = null!;

    constructor(config?: Partial<CheckpointManagerConfig>) {
        this.config = {
            storageDir: './rag/checkpoints',
            defaultTTL: 7 * 24 * 60 * 60, // 7 jours
            defaultCompressionLevel: 6,
            maxCheckpointSize: 10 * 1024 * 1024, // 10 MB
            maxCheckpointsPerProject: 100,
            enableEncryption: false,
            cleanupInterval: 3600, // 1 heure
            ...config,
        };

        this.init();
    }

    /**
     * Initialise le gestionnaire de checkpoints
     */
    private async init(): Promise<void> {
        try {
            // Charger les modules nécessaires
            this.fs = await import('fs');
            this.path = await import('path');
            this.crypto = await import('crypto');

            // Créer le répertoire de stockage
            await this.ensureStorageDir();

            // Charger les checkpoints existants
            await this.loadExistingCheckpoints();

            // Démarrer le nettoyage automatique
            this.startCleanupInterval();

            logger.info("rag.checkpoints.init", "CheckpointManager initialisé", {
                storageDir: this.config.storageDir,
                checkpointsLoaded: this.checkpoints.size,
                config: {
                    defaultTTL: this.config.defaultTTL,
                    maxCheckpointSize: this.config.maxCheckpointSize,
                    maxCheckpointsPerProject: this.config.maxCheckpointsPerProject,
                    enableEncryption: this.config.enableEncryption,
                },
            });

        } catch (error) {
            logger.error("rag.checkpoints.init.error", "Erreur lors de l'initialisation du CheckpointManager", {
                error: error instanceof Error ? error.message : String(error),
            });

            throw new RagUsageError(
                "Impossible d'initialiser le gestionnaire de checkpoints",
                "CHECKPOINT_MANAGER_INIT_FAILED",
                {
                    cause: error instanceof Error ? error : new Error(String(error)),
                    details: { config: this.config },
                }
            );
        }
    }

    /**
     * Crée un répertoire de stockage s'il n'existe pas
     */
    private async ensureStorageDir(): Promise<void> {
        if (!this.fs.existsSync(this.config.storageDir)) {
            this.fs.mkdirSync(this.config.storageDir, { recursive: true });
            logger.debug("rag.checkpoints.storage.created", "Répertoire de stockage créé", {
                storageDir: this.config.storageDir,
            });
        }
    }

    /**
     * Charge les checkpoints existants depuis le stockage
     */
    private async loadExistingCheckpoints(): Promise<void> {
        try {
            if (!this.fs.existsSync(this.config.storageDir)) {
                return;
            }

            const files = this.fs.readdirSync(this.config.storageDir);
            let loaded = 0;
            let failed = 0;

            for (const file of files) {
                if (!file.endsWith('.checkpoint.json')) {
                    continue;
                }

                const filePath = this.path.join(this.config.storageDir, file);

                try {
                    const data = this.fs.readFileSync(filePath, 'utf8');
                    const checkpoint = JSON.parse(data);

                    // Convertir les dates
                    checkpoint.metadata.createdAt = new Date(checkpoint.metadata.createdAt);
                    checkpoint.metadata.updatedAt = new Date(checkpoint.metadata.updatedAt);

                    this.checkpoints.set(checkpoint.id, checkpoint);
                    loaded++;

                } catch (error) {
                    logger.warn("rag.checkpoints.load.error", "Erreur lors du chargement d'un checkpoint", {
                        file,
                        error: error instanceof Error ? error.message : String(error),
                    });
                    failed++;
                }
            }

            if (loaded > 0 || failed > 0) {
                logger.info("rag.checkpoints.load.complete", "Checkpoints chargés depuis le stockage", {
                    loaded,
                    failed,
                    total: this.checkpoints.size,
                });
            }

        } catch (error) {
            logger.error("rag.checkpoints.load.all.error", "Erreur lors du chargement des checkpoints", {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Démarre l'intervalle de nettoyage automatique
     */
    private startCleanupInterval(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredCheckpoints().catch(error => {
                logger.error("rag.checkpoints.cleanup.error", "Erreur lors du nettoyage automatique", {
                    error: error instanceof Error ? error.message : String(error),
                });
            });
        }, this.config.cleanupInterval * 1000);

        logger.debug("rag.checkpoints.cleanup.started", "Nettoyage automatique démarré", {
            intervalSeconds: this.config.cleanupInterval,
        });
    }

    /**
     * Sauvegarde un checkpoint
     */
    async saveCheckpoint(
        checkpointId: string,
        state: Record<string, any>,
        options: CheckpointOptions = {}
    ): Promise<CheckpointSaveResult> {
        const startTime = Date.now();

        try {
            // Vérifier la taille des données
            const stateSize = JSON.stringify(state).length;
            if (stateSize > this.config.maxCheckpointSize) {
                throw new RagUsageError(
                    `Checkpoint trop volumineux: ${stateSize} octets (max: ${this.config.maxCheckpointSize})`,
                    "CHECKPOINT_TOO_LARGE",
                    {
                        details: {
                            stateSize,
                            maxSize: this.config.maxCheckpointSize,
                            recommendation: "Divisez les données en checkpoints plus petits",
                        },
                    }
                );
            }

            // Vérifier les limites par projet
            const projectPath = state.projectPath || 'unknown';
            const projectCheckpoints = Array.from(this.checkpoints.values())
                .filter(cp => cp.projectPath === projectPath)
                .length;

            if (projectCheckpoints >= this.config.maxCheckpointsPerProject) {
                if (!options.force) {
                    throw new RagUsageError(
                        `Limite de checkpoints atteinte pour le projet: ${projectPath}`,
                        "CHECKPOINT_LIMIT_REACHED",
                        {
                            details: {
                                projectPath,
                                currentCount: projectCheckpoints,
                                maxCount: this.config.maxCheckpointsPerProject,
                                recommendation: "Supprimez d'anciens checkpoints ou utilisez force: true",
                            },
                        }
                    );
                }

                // Supprimer le checkpoint le plus ancien
                const oldestCheckpoint = Array.from(this.checkpoints.values())
                    .filter(cp => cp.projectPath === projectPath)
                    .sort((a, b) => a.metadata.createdAt.getTime() - b.metadata.createdAt.getTime())[0];

                if (oldestCheckpoint) {
                    await this.deleteCheckpoint(oldestCheckpoint.id);
                }
            }

            // Créer le checkpoint
            const now = new Date();
            const checkpoint: CheckpointState = {
                id: checkpointId,
                type: state.type || 'custom',
                jobId: state.jobId,
                phaseId: state.phaseId,
                projectPath,
                state,
                metadata: {
                    createdAt: now,
                    updatedAt: now,
                    version: '1.0.0',
                    size: stateSize,
                    tags: options.tags || [],
                },
                stats: state.stats,
            };

            // Calculer le checksum
            checkpoint.metadata.checksum = this.calculateChecksum(checkpoint);

            // Sauvegarder en mémoire
            this.checkpoints.set(checkpointId, checkpoint);

            // Sauvegarder sur disque
            const storagePath = await this.saveToDisk(checkpoint, options);

            const duration = Date.now() - startTime;

            logger.info("rag.checkpoints.save.success", "Checkpoint sauvegardé", {
                checkpointId,
                projectPath,
                type: checkpoint.type,
                size: stateSize,
                duration,
                storagePath,
            });

            return {
                success: true,
                checkpointId,
                storagePath,
                size: stateSize,
                message: "Checkpoint sauvegardé avec succès",
            };

        } catch (error) {
            const duration = Date.now() - startTime;

            logger.error("rag.checkpoints.save.error", "Erreur lors de la sauvegarde du checkpoint", {
                checkpointId,
                error: error instanceof Error ? error.message : String(error),
                duration,
            });

            if (error instanceof RagUsageError) {
                throw error;
            }

            throw new RagUsageError(
                "Erreur lors de la sauvegarde du checkpoint",
                "CHECKPOINT_SAVE_FAILED",
                {
                    cause: error instanceof Error ? error : new Error(String(error)),
                    details: { checkpointId, options },
                }
            );
        }
    }

    /**
     * Charge un checkpoint
     */
    async loadCheckpoint<T = any>(checkpointId: string): Promise<CheckpointLoadResult<T>> {
        const startTime = Date.now();

        try {
            // Vérifier si le checkpoint existe en mémoire
            let checkpoint = this.checkpoints.get(checkpointId);

            // Si pas en mémoire, essayer de charger depuis le disque
            if (!checkpoint) {
                checkpoint = await this.loadFromDisk(checkpointId);
                if (checkpoint) {
                    this.checkpoints.set(checkpointId, checkpoint);
                }
            }

            if (!checkpoint) {
                return {
                    success: false,
                    message: `Checkpoint non trouvé: ${checkpointId}`,
                    errors: [`Checkpoint ${checkpointId} n'existe pas`],
                };
            }

            // Vérifier le checksum
            const currentChecksum = this.calculateChecksum(checkpoint);
            if (checkpoint.metadata.checksum && checkpoint.metadata.checksum !== currentChecksum) {
                logger.warn("rag.checkpoints.load.checksum", "Checksum du checkpoint invalide", {
                    checkpointId,
                    expected: checkpoint.metadata.checksum,
                    actual: currentChecksum,
                });

                return {
                    success: false,
                    checkpoint,
                    message: "Checkpoint corrompu (checksum invalide)",
                    errors: ["Checksum invalide - données potentiellement corrompues"],
                };
            }

            // Vérifier l'expiration
            if (this.isCheckpointExpired(checkpoint)) {
                logger.warn("rag.checkpoints.load.expired", "Checkpoint expiré", {
                    checkpointId,
                    createdAt: checkpoint.metadata.createdAt.toISOString(),
                });

                return {
                    success: false,
                    checkpoint,
                    message: "Checkpoint expiré",
                    errors: ["Checkpoint a expiré"],
                };
            }

            const duration = Date.now() - startTime;

            logger.info("rag.checkpoints.load.success", "Checkpoint chargé", {
                checkpointId,
                projectPath: checkpoint.projectPath,
                type: checkpoint.type,
                size: checkpoint.metadata.size,
                duration,
            });

            return {
                success: true,
                state: checkpoint.state as T,
                checkpoint,
                message: "Checkpoint chargé avec succès",
            };

        } catch (error) {
            const duration = Date.now() - startTime;

            logger.error("rag.checkpoints.load.error", "Erreur lors du chargement du checkpoint", {
                checkpointId,
                error: error instanceof Error ? error.message : String(error),
                duration,
            });

            return {
                success: false,
                message: "Erreur lors du chargement du checkpoint",
                errors: [error instanceof Error ? error.message : String(error)],
            };
        }
    }

    /**
     * Supprime un checkpoint
     */
    async deleteCheckpoint(checkpointId: string): Promise<boolean> {
        try {
            // Supprimer de la mémoire
            const deletedFromMemory = this.checkpoints.delete(checkpointId);

            // Supprimer du disque
            const deletedFromDisk = await this.deleteFromDisk(checkpointId);

            if (deletedFromMemory || deletedFromDisk) {
                logger.info("rag.checkpoints.delete.success", "Checkpoint supprimé", {
                    checkpointId,
                    deletedFromMemory,
                    deletedFromDisk,
                });
                return true;
            }

            logger.warn("rag.checkpoints.delete.not_found", "Checkpoint non trouvé pour suppression", {
                checkpointId,
            });
            return false;

        } catch (error) {
            logger.error("rag.checkpoints.delete.error", "Erreur lors de la suppression du checkpoint", {
                checkpointId,
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }

    /**
     * Liste les checkpoints pour un projet
     */
    listCheckpoints(projectPath?: string, type?: string): CheckpointState[] {
        let checkpoints = Array.from(this.checkpoints.values());

        if (projectPath) {
            checkpoints = checkpoints.filter(cp => cp.projectPath === projectPath);
        }

        if (type) {
            checkpoints = checkpoints.filter(cp => cp.type === type);
        }

        return checkpoints.sort((a, b) => b.metadata.updatedAt.getTime() - a.metadata.updatedAt.getTime());
    }

    /**
     * Nettoie les checkpoints expirés
     */
    async cleanupExpiredCheckpoints(): Promise<number> {
        let cleaned = 0;

        for (const [checkpointId, checkpoint] of this.checkpoints.entries()) {
            if (this.isCheckpointExpired(checkpoint)) {
                await this.deleteCheckpoint(checkpointId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.info("rag.checkpoints.cleanup.complete", "Checkpoints expirés nettoyés", {
                cleaned,
                remaining: this.checkpoints.size,
            });
        }

        return cleaned;
    }

    /**
     * Vérifie si un checkpoint est expiré
     */
    private isCheckpointExpired(checkpoint: CheckpointState): boolean {
        const ttl = this.config.defaultTTL * 1000; // Convertir en millisecondes
        const age = Date.now() - checkpoint.metadata.createdAt.getTime();
        return age > ttl;
    }

    /**
     * Calcule le checksum d'un checkpoint
     */
    private calculateChecksum(checkpoint: CheckpointState): string {
        const data = JSON.stringify({
            id: checkpoint.id,
            state: checkpoint.state,
            metadata: {
                createdAt: checkpoint.metadata.createdAt.toISOString(),
                updatedAt: checkpoint.metadata.updatedAt.toISOString(),
                version: checkpoint.metadata.version,
            },
        });

        return this.crypto.createHash('sha256').update(data).digest('hex');
    }

    /**
     * Sauvegarde un checkpoint sur le disque
     */
    private async saveToDisk(checkpoint: CheckpointState, options: CheckpointOptions): Promise<string> {
        const fileName = `${checkpoint.id}.checkpoint.json`;
        const filePath = this.path.join(this.config.storageDir, fileName);

        // Préparer les données pour la sauvegarde
        const dataToSave = {
            ...checkpoint,
            metadata: {
                ...checkpoint.metadata,
                createdAt: checkpoint.metadata.createdAt.toISOString(),
                updatedAt: checkpoint.metadata.updatedAt.toISOString(),
            },
        };

        // Sauvegarder sur le disque
        this.fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2), 'utf8');

        return filePath;
    }

    /**
     * Charge un checkpoint depuis le disque
     */
    private async loadFromDisk(checkpointId: string): Promise<CheckpointState | undefined> {
        const fileName = `${checkpointId}.checkpoint.json`;
        const filePath = this.path.join(this.config.storageDir, fileName);

        if (!this.fs.existsSync(filePath)) {
            return undefined;
        }

        try {
            const data = this.fs.readFileSync(filePath, 'utf8');
            const checkpoint = JSON.parse(data);

            // Convertir les dates
            checkpoint.metadata.createdAt = new Date(checkpoint.metadata.createdAt);
            checkpoint.metadata.updatedAt = new Date(checkpoint.metadata.updatedAt);

            return checkpoint;
        } catch (error) {
            logger.warn("rag.checkpoints.load.disk.error", "Erreur lors du chargement depuis le disque", {
                checkpointId,
                error: error instanceof Error ? error.message : String(error),
            });
            return undefined;
        }
    }

    /**
     * Supprime un checkpoint du disque
     */
    private async deleteFromDisk(checkpointId: string): Promise<boolean> {
        const fileName = `${checkpointId}.checkpoint.json`;
        const filePath = this.path.join(this.config.storageDir, fileName);

        if (!this.fs.existsSync(filePath)) {
            return false;
        }

        try {
            this.fs.unlinkSync(filePath);
            return true;
        } catch (error) {
            logger.warn("rag.checkpoints.delete.disk.error", "Erreur lors de la suppression du disque", {
                checkpointId,
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }

    /**
     * Arrête le gestionnaire de checkpoints
     */
    stop(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        logger.info("rag.checkpoints.stop", "CheckpointManager arrêté", {
            checkpointsInMemory: this.checkpoints.size,
        });
    }

    /**
     * Test du gestionnaire de checkpoints
     */
    static async test(): Promise<boolean> {
        try {
            logger.info("rag.checkpoints.test.start", "Début des tests CheckpointManager");

            // Créer un gestionnaire temporaire
            const tempDir = './rag/checkpoints-test';
            const manager = new CheckpointManager({
                storageDir: tempDir,
                defaultTTL: 60, // 1 minute pour les tests
                maxCheckpointsPerProject: 2,
            });

            // Test de sauvegarde
            const testState = {
                projectPath: '/test/project',
                type: 'test',
                data: { test: 'value' },
                stats: {
                    filesProcessed: 10,
                    filesTotal: 100,
                    elapsedTime: 5000,
                    progress: 10,
                },
            };

            const saveResult = await manager.saveCheckpoint('test-checkpoint-1', testState);
            if (!saveResult.success) {
                throw new Error(`Échec de sauvegarde: ${saveResult.message}`);
            }

            // Test de chargement
            const loadResult = await manager.loadCheckpoint('test-checkpoint-1');
            if (!loadResult.success || !loadResult.state) {
                throw new Error(`Échec de chargement: ${loadResult.message}`);
            }

            if (loadResult.state.projectPath !== testState.projectPath) {
                throw new Error('État restauré incorrect');
            }

            // Test de liste
            const checkpoints = manager.listCheckpoints('/test/project');
            if (checkpoints.length !== 1) {
                throw new Error(`Liste incorrecte: ${checkpoints.length} checkpoints`);
            }

            // Test de limite
            await manager.saveCheckpoint('test-checkpoint-2', testState);
            await manager.saveCheckpoint('test-checkpoint-3', testState, { force: true });

            const finalCheckpoints = manager.listCheckpoints('/test/project');
            if (finalCheckpoints.length > 2) {
                throw new Error(`Limite non respectée: ${finalCheckpoints.length} checkpoints`);
            }

            // Test de suppression
            const deleted = await manager.deleteCheckpoint('test-checkpoint-1');
            if (!deleted) {
                throw new Error('Échec de suppression');
            }

            // Arrêter le gestionnaire
            manager.stop();

            // Nettoyer le répertoire temporaire
            try {
                const fs = await import('fs');
                const path = await import('path');
                if (fs.existsSync(tempDir)) {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                }
            } catch (cleanupError) {
                // Ignorer les erreurs de nettoyage
            }

            logger.info("rag.checkpoints.test.success", "Tests CheckpointManager réussis");
            return true;

        } catch (error) {
            logger.error("rag.checkpoints.test.failed", "Tests CheckpointManager échoués", {
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }
}

/**
 * Instance singleton de CheckpointManager
 */
let checkpointManagerInstance: CheckpointManager | null = null;

/**
 * Obtient l'instance singleton de CheckpointManager
 */
export function getCheckpointManager(config?: Partial<CheckpointManagerConfig>): CheckpointManager {
    if (!checkpointManagerInstance) {
        checkpointManagerInstance = new CheckpointManager(config);
    }
    return checkpointManagerInstance;
}

/**
 * Crée un checkpoint pour un job RAG
 */
export async function createJobCheckpoint(
    job: RagJob,
    state: Record<string, any>,
    options: CheckpointOptions = {}
): Promise<CheckpointSaveResult> {
    const manager = getCheckpointManager();
    const checkpointId = `job-${job.id}-${Date.now()}`;

    const checkpointState = {
        ...state,
        jobId: job.id,
        type: job.type,
        projectPath: job.projectPath,
        jobStatus: job.status,
        createdAt: job.createdAt,
    };

    return manager.saveCheckpoint(checkpointId, checkpointState, options);
}

/**
 * Restaure le dernier checkpoint pour un job
 */
export async function restoreJobCheckpoint(jobId: string): Promise<CheckpointLoadResult> {
    const manager = getCheckpointManager();

    // Chercher le dernier checkpoint pour ce job
    const checkpoints = manager.listCheckpoints()
        .filter(cp => cp.jobId === jobId)
        .sort((a, b) => b.metadata.updatedAt.getTime() - a.metadata.updatedAt.getTime());

    if (checkpoints.length === 0) {
        return {
            success: false,
            message: `Aucun checkpoint trouvé pour le job: ${jobId}`,
        };
    }

    const latestCheckpoint = checkpoints[0];
    return manager.loadCheckpoint(latestCheckpoint.id);
}

/**
 * Nettoie tous les checkpoints expirés
 */
export async function cleanupAllExpiredCheckpoints(): Promise<number> {
    const manager = getCheckpointManager();
    return manager.cleanupExpiredCheckpoints();
}
