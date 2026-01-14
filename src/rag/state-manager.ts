// src/rag/state-manager.ts
// Gestionnaire d'état avec verrouillage pour éviter les écritures concurrentes
// Version: v1.0.0
// Responsabilités: Gestion des états RAG, verrouillage fichier, cohérence multi-processus

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { logger } from "../core/logger.js";

/**
 * Interface pour l'état d'un projet RAG
 */
export interface RagProjectState {
    project_path: string;
    project_hash: string;
    initialized: boolean;
    initialized_at: string;
    last_indexed_at?: string;
    last_updated_at?: string;
    total_files: number;
    total_chunks: number;
    vector_store_backend: string;
    embedding_model: string;
    chunking_strategy: string;
    version: string;
    metadata: Record<string, any>;
}

/**
 * Interface pour un verrou
 */
export interface StateLock {
    lock_id: string;
    process_id: number;
    acquired_at: string;
    expires_at: string;
    resource: string;
    metadata: Record<string, any>;
}

/**
 * Configuration du StateManager
 */
export interface StateManagerConfig {
    lock_timeout_ms: number;
    lock_retry_interval_ms: number;
    max_retries: number;
    state_dir: string;
    lock_dir: string;
    verbose: boolean;
}

/**
 * Configuration par défaut
 */
const DEFAULT_CONFIG: StateManagerConfig = {
    lock_timeout_ms: 30000, // 30 secondes
    lock_retry_interval_ms: 100, // 100ms entre les tentatives
    max_retries: 10,
    state_dir: 'rag/db/state',
    lock_dir: 'rag/db/locks',
    verbose: false
};

/**
 * Gestionnaire d'état avec verrouillage
 */
export class StateManager {
    private config: StateManagerConfig;
    private activeLocks: Map<string, StateLock> = new Map();
    private projectRoot: string;

    constructor(config: Partial<StateManagerConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.projectRoot = process.cwd();

        // Créer les répertoires si nécessaire
        this.ensureDirectories();
    }

    /**
     * Crée les répertoires nécessaires
     */
    private ensureDirectories(): void {
        const stateDir = join(this.projectRoot, this.config.state_dir);
        const lockDir = join(this.projectRoot, this.config.lock_dir);

        if (!existsSync(stateDir)) {
            mkdirSync(stateDir, { recursive: true });
            if (this.config.verbose) {
                logger.debug("rag.state_manager.dir_created", "Répertoire d'état créé", { path: stateDir });
            }
        }

        if (!existsSync(lockDir)) {
            mkdirSync(lockDir, { recursive: true });
            if (this.config.verbose) {
                logger.debug("rag.state_manager.dir_created", "Répertoire de verrous créé", { path: lockDir });
            }
        }
    }

    /**
     * Obtient le chemin du fichier d'état pour un projet
     */
    private getStateFilePath(projectPath: string): string {
        const projectHash = this.hashProjectPath(projectPath);
        const stateDir = join(this.projectRoot, this.config.state_dir);
        return join(stateDir, `${projectHash}.json`);
    }

    /**
     * Obtient le chemin du fichier de verrou pour un projet
     */
    private getLockFilePath(projectPath: string, resource: string = 'state'): string {
        const projectHash = this.hashProjectPath(projectPath);
        const lockDir = join(this.projectRoot, this.config.lock_dir);
        return join(lockDir, `${projectHash}_${resource}.lock`);
    }

    /**
     * Hash un chemin de projet pour créer un identifiant unique
     */
    private hashProjectPath(projectPath: string): string {
        // Hash simple basé sur le chemin absolu
        const absolutePath = join(process.cwd(), projectPath);
        let hash = 0;
        for (let i = 0; i < absolutePath.length; i++) {
            const char = absolutePath.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convertir en 32-bit integer
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
    }

    /**
     * Acquiert un verrou pour une ressource
     */
    async acquireLock(projectPath: string, resource: string = 'state'): Promise<StateLock> {
        const lockFilePath = this.getLockFilePath(projectPath, resource);
        const lockId = `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const processId = process.pid;
        const acquiredAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + this.config.lock_timeout_ms).toISOString();

        const lock: StateLock = {
            lock_id: lockId,
            process_id: processId,
            acquired_at: acquiredAt,
            expires_at: expiresAt,
            resource: resource,
            metadata: {
                project_path: projectPath,
                timeout_ms: this.config.lock_timeout_ms
            }
        };

        let retries = 0;
        while (retries < this.config.max_retries) {
            try {
                // Vérifier si le verrou existe déjà et s'il est expiré
                if (existsSync(lockFilePath)) {
                    const existingLockContent = readFileSync(lockFilePath, 'utf-8');
                    const existingLock = JSON.parse(existingLockContent) as StateLock;

                    // Vérifier si le verrou est expiré
                    const expiresAtTime = new Date(existingLock.expires_at).getTime();
                    if (Date.now() < expiresAtTime) {
                        // Verrou toujours valide, attendre et réessayer
                        retries++;
                        if (this.config.verbose) {
                            logger.debug("rag.state_manager.lock_waiting", "Verrou actif, attente", {
                                resource,
                                project_path: projectPath,
                                retry: retries,
                                expires_in: expiresAtTime - Date.now()
                            });
                        }
                        await new Promise(resolve => setTimeout(resolve, this.config.lock_retry_interval_ms));
                        continue;
                    } else {
                        // Verrou expiré, le supprimer
                        if (this.config.verbose) {
                            logger.warn("rag.state_manager.lock_expired", "Verrou expiré, suppression", {
                                resource,
                                project_path: projectPath,
                                lock_id: existingLock.lock_id
                            });
                        }
                        unlinkSync(lockFilePath);
                    }
                }

                // Créer le nouveau verrou
                writeFileSync(lockFilePath, JSON.stringify(lock, null, 2));
                this.activeLocks.set(lockId, lock);

                if (this.config.verbose) {
                    logger.info("rag.state_manager.lock_acquired", "Verrou acquis", {
                        lock_id: lockId,
                        resource,
                        project_path: projectPath,
                        process_id: processId
                    });
                }

                return lock;

            } catch (error: any) {
                retries++;
                if (retries >= this.config.max_retries) {
                    throw new Error(`Échec d'acquisition du verrou après ${retries} tentatives: ${error.message}`);
                }
                await new Promise(resolve => setTimeout(resolve, this.config.lock_retry_interval_ms));
            }
        }

        throw new Error(`Impossible d'acquérir le verrou pour ${resource} sur ${projectPath}`);
    }

    /**
     * Libère un verrou
     */
    async releaseLock(lock: StateLock): Promise<void> {
        const lockFilePath = this.getLockFilePath(lock.metadata.project_path, lock.resource);

        try {
            // Vérifier que le verrou appartient à ce processus
            if (lock.process_id !== process.pid) {
                logger.warn("rag.state_manager.lock_wrong_process", "Tentative de libération d'un verrou d'un autre processus", {
                    lock_id: lock.lock_id,
                    expected_pid: process.pid,
                    actual_pid: lock.process_id
                });
                return;
            }

            // Supprimer le fichier de verrou
            if (existsSync(lockFilePath)) {
                unlinkSync(lockFilePath);
            }

            // Retirer du cache des verrous actifs
            this.activeLocks.delete(lock.lock_id);

            if (this.config.verbose) {
                logger.info("rag.state_manager.lock_released", "Verrou libéré", {
                    lock_id: lock.lock_id,
                    resource: lock.resource,
                    project_path: lock.metadata.project_path
                });
            }

        } catch (error: any) {
            logger.error("rag.state_manager.lock_release_error", "Erreur lors de la libération du verrou", {
                lock_id: lock.lock_id,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Vérifie si un verrou est actif
     */
    isLocked(projectPath: string, resource: string = 'state'): boolean {
        const lockFilePath = this.getLockFilePath(projectPath, resource);

        if (!existsSync(lockFilePath)) {
            return false;
        }

        try {
            const lockContent = readFileSync(lockFilePath, 'utf-8');
            const lock = JSON.parse(lockContent) as StateLock;

            // Vérifier si le verrou est expiré
            const expiresAtTime = new Date(lock.expires_at).getTime();
            return Date.now() < expiresAtTime;
        } catch {
            return false;
        }
    }

    /**
     * Charge l'état d'un projet
     */
    async loadState(projectPath: string): Promise<RagProjectState | null> {
        const stateFilePath = this.getStateFilePath(projectPath);

        if (!existsSync(stateFilePath)) {
            return null;
        }

        try {
            const stateContent = readFileSync(stateFilePath, 'utf-8');
            return JSON.parse(stateContent) as RagProjectState;
        } catch (error: any) {
            logger.error("rag.state_manager.load_error", "Erreur lors du chargement de l'état", {
                project_path: projectPath,
                error: error.message
            });
            return null;
        }
    }

    /**
     * Sauvegarde l'état d'un projet avec verrouillage
     */
    async saveState(projectPath: string, state: Partial<RagProjectState>): Promise<void> {
        let lock: StateLock | null = null;

        try {
            // Acquérir un verrou pour l'écriture
            lock = await this.acquireLock(projectPath, 'state');

            // Charger l'état existant
            const existingState = await this.loadState(projectPath);
            const now = new Date().toISOString();

            // Fusionner avec l'état existant
            const mergedState: RagProjectState = {
                project_path: projectPath,
                project_hash: this.hashProjectPath(projectPath),
                initialized: false,
                initialized_at: now,
                total_files: 0,
                total_chunks: 0,
                vector_store_backend: 'sqlite',
                embedding_model: 'nomic-embed-text',
                chunking_strategy: 'logical',
                version: '1.0.0',
                metadata: {},
                ...existingState,
                ...state,
                last_updated_at: now
            };

            // Sauvegarder l'état
            const stateFilePath = this.getStateFilePath(projectPath);
            const stateDir = dirname(stateFilePath);

            if (!existsSync(stateDir)) {
                mkdirSync(stateDir, { recursive: true });
            }

            writeFileSync(stateFilePath, JSON.stringify(mergedState, null, 2));

            if (this.config.verbose) {
                logger.info("rag.state_manager.state_saved", "État sauvegardé", {
                    project_path: projectPath,
                    project_hash: mergedState.project_hash,
                    total_files: mergedState.total_files,
                    total_chunks: mergedState.total_chunks
                });
            }

        } finally {
            // Libérer le verrou
            if (lock) {
                await this.releaseLock(lock);
            }
        }
    }

    /**
     * Met à jour les statistiques d'un projet
     */
    async updateStats(projectPath: string, stats: { total_files?: number; total_chunks?: number }): Promise<void> {
        const currentState = await this.loadState(projectPath);

        if (!currentState) {
            throw new Error(`Aucun état trouvé pour le projet: ${projectPath}`);
        }

        await this.saveState(projectPath, {
            ...currentState,
            ...stats,
            last_updated_at: new Date().toISOString()
        });
    }

    /**
     * Marque un projet comme initialisé
     */
    async markAsInitialized(projectPath: string, config: any): Promise<void> {
        const now = new Date().toISOString();

        await this.saveState(projectPath, {
            initialized: true,
            initialized_at: now,
            last_updated_at: now,
            vector_store_backend: config.vector_backend || 'sqlite',
            embedding_model: config.embedding_model || 'nomic-embed-text',
            chunking_strategy: config.chunking_strategy || 'logical',
            metadata: {
                config: config,
                initialized_by: process.pid,
                initialization_time: now
            }
        });
    }

    /**
     * Marque un projet comme indexé
     */
    async markAsIndexed(projectPath: string, stats: { total_files: number; total_chunks: number }): Promise<void> {
        const now = new Date().toISOString();

        await this.saveState(projectPath, {
            last_indexed_at: now,
            last_updated_at: now,
            total_files: stats.total_files,
            total_chunks: stats.total_chunks
        });
    }

    /**
     * Vérifie si un projet est initialisé
     */
    async isInitialized(projectPath: string): Promise<boolean> {
        const state = await this.loadState(projectPath);
        return state?.initialized === true;
    }

    /**
     * Récupère les statistiques d'un projet
     */
    async getStats(projectPath: string): Promise<{ total_files: number; total_chunks: number; last_indexed_at?: string }> {
        const state = await this.loadState(projectPath);

        if (!state) {
            return { total_files: 0, total_chunks: 0 };
        }

        return {
            total_files: state.total_files || 0,
            total_chunks: state.total_chunks || 0,
            last_indexed_at: state.last_indexed_at
        };
    }

    /**
     * Nettoie les verrous expirés
     */
    async cleanupExpiredLocks(): Promise<number> {
        const lockDir = join(this.projectRoot, this.config.lock_dir);

        if (!existsSync(lockDir)) {
            return 0;
        }

        const fs = await import('fs');
        const path = await import('path');

        const files = fs.readdirSync(lockDir);
        let cleanedCount = 0;

        for (const file of files) {
            if (file.endsWith('.lock')) {
                const lockFilePath = path.join(lockDir, file);

                try {
                    const lockContent = fs.readFileSync(lockFilePath, 'utf-8');
                    const lock = JSON.parse(lockContent) as StateLock;

                    const expiresAtTime = new Date(lock.expires_at).getTime();
                    if (Date.now() >= expiresAtTime) {
                        fs.unlinkSync(lockFilePath);
                        cleanedCount++;

                        if (this.config.verbose) {
                            logger.debug("rag.state_manager.lock_cleaned", "Verrou expiré nettoyé", {
                                lock_id: lock.lock_id,
                                resource: lock.resource
                            });
                        }
                    }
                } catch (error) {
                    // Si le fichier est corrompu, le supprimer
                    fs.unlinkSync(lockFilePath);
                    cleanedCount++;
                }
            }
        }

        if (cleanedCount > 0 && this.config.verbose) {
            logger.info("rag.state_manager.locks_cleaned", "Verrous expirés nettoyés", { count: cleanedCount });
        }

        return cleanedCount;
    }

    /**
     * Liste tous les états de projet
     */
    async listAllStates(): Promise<RagProjectState[]> {
        const stateDir = join(this.projectRoot, this.config.state_dir);

        if (!existsSync(stateDir)) {
            return [];
        }

        const fs = await import('fs');
        const path = await import('path');

        const files = fs.readdirSync(stateDir);
        const states: RagProjectState[] = [];

        for (const file of files) {
            if (file.endsWith('.json')) {
                const stateFilePath = path.join(stateDir, file);

                try {
                    const stateContent = fs.readFileSync(stateFilePath, 'utf-8');
                    const state = JSON.parse(stateContent) as RagProjectState;
                    states.push(state);
                } catch (error) {
                    logger.warn("rag.state_manager.state_corrupted", "État corrompu ignoré", {
                        file,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }
        }

        return states;
    }

    /**
     * Supprime l'état d'un projet
     */
    async deleteState(projectPath: string): Promise<void> {
        const stateFilePath = this.getStateFilePath(projectPath);

        if (existsSync(stateFilePath)) {
            unlinkSync(stateFilePath);

            if (this.config.verbose) {
                logger.info("rag.state_manager.state_deleted", "État supprimé", {
                    project_path: projectPath,
                    state_file: stateFilePath
                });
            }
        }
    }

    /**
     * Instance singleton
     */
    private static instance: StateManager | null = null;

    /**
     * Obtient l'instance singleton du StateManager
     */
    static getInstance(config?: Partial<StateManagerConfig>): StateManager {
        if (!StateManager.instance) {
            StateManager.instance = new StateManager(config);
        }
        return StateManager.instance;
    }

    /**
     * Réinitialise l'instance singleton (pour les tests)
     */
    static resetInstance(): void {
        StateManager.instance = null;
    }
}
