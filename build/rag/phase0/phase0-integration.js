// src/rag/phase0/phase0-integration.ts
// Intégration des composants Phase 0.1
import { createPhase0Logger } from './event-logger.js';
import { createFileWatcher, createIndexingEventHandler } from './file-watcher.js';
import { detectWorkspace } from './workspace-detector.js';
/**
 * Intégration complète Phase 0.1
 */
export class Phase0Integration {
    options;
    state;
    onIndexNeededCallback;
    constructor(options = {}) {
        this.options = {
            enableWorkspaceDetection: options.enableWorkspaceDetection ?? true,
            enableFileWatcher: options.enableFileWatcher ?? true,
            enableLogging: options.enableLogging ?? true,
            fileWatcherOptions: options.fileWatcherOptions ?? {
                debounceDelay: 1000,
                recursive: true,
                logEvents: true,
            },
            loggerOptions: options.loggerOptions ?? {
                minLevel: 'info',
                enableConsole: true,
                enableMemoryStorage: true,
            },
        };
        this.state = {
            status: 'initializing',
            stats: {
                fileEventsCount: 0,
                logsCount: 0,
                startedAt: new Date(),
            },
        };
    }
    /**
     * Initialise l'intégration Phase 0.1
     */
    async initialize(projectPath) {
        try {
            // Log silencieux pour MCP
            // 1. Détection du workspace
            if (this.options.enableWorkspaceDetection) {
                await this.initializeWorkspaceDetection(projectPath);
            }
            // 2. Initialisation du logger
            if (this.options.enableLogging) {
                await this.initializeLogger();
            }
            // 3. Initialisation du file watcher
            if (this.options.enableFileWatcher && this.state.workspace) {
                await this.initializeFileWatcher();
            }
            this.state.status = 'ready';
            // Log silencieux pour MCP
            return this.state;
        }
        catch (error) {
            this.state.status = 'error';
            this.state.error = error;
            // Log silencieux pour MCP
            throw error;
        }
    }
    /**
     * Initialise la détection de workspace
     */
    async initializeWorkspaceDetection(projectPath) {
        const startTime = Date.now();
        // Log silencieux pour MCP
        const workspace = await detectWorkspace({
            manualPath: projectPath,
            useVscodeDetection: true,
            useEnvDetection: true,
            fallbackToCurrentDir: true,
        });
        this.state.workspace = workspace;
        this.state.stats.workspaceDetectionTime = Date.now() - startTime;
        // Log silencieux pour MCP
    }
    /**
     * Initialise le logger
     */
    async initializeLogger() {
        // Log silencieux pour MCP
        this.state.logger = createPhase0Logger(this.state.workspace);
        if (this.state.workspace) {
            this.state.logger.logWorkspaceDetection(this.state.workspace);
        }
        this.state.logger.info('Logger Phase 0.1 initialisé', 'phase0-integration');
        this.state.stats.logsCount++;
        // Log silencieux pour MCP
    }
    /**
     * Initialise le file watcher
     */
    async initializeFileWatcher() {
        if (!this.state.workspace) {
            throw new Error('Workspace non détecté, impossible d\'initialiser le file watcher');
        }
        // Log silencieux pour MCP
        // Créer le handler d'indexation si un callback est défini
        let eventHandler;
        if (this.onIndexNeededCallback) {
            eventHandler = createIndexingEventHandler(this.onIndexNeededCallback);
        }
        // Créer le file watcher
        this.state.fileWatcher = await createFileWatcher(this.state.workspace, this.options.fileWatcherOptions, eventHandler);
        // Ajouter un handler pour logger les événements
        if (this.state.logger) {
            this.state.fileWatcher.addEventHandler((event) => {
                this.state.logger.logFileEvent(event);
                this.state.stats.fileEventsCount++;
                this.state.stats.logsCount++;
            });
        }
        // Log silencieux pour MCP
        this.state.logger?.info('File watcher initialisé', 'phase0-integration', {
            workspacePath: this.state.workspace.path,
            options: this.options.fileWatcherOptions,
        });
    }
    /**
     * Définit le callback pour l'indexation
     */
    setOnIndexNeededCallback(callback) {
        this.onIndexNeededCallback = callback;
        // Si le file watcher est déjà initialisé, mettre à jour son handler
        if (this.state.fileWatcher && this.state.fileWatcher.isActive()) {
            const newHandler = createIndexingEventHandler(callback);
            // Supprimer les anciens handlers d'indexation
            this.state.fileWatcher.removeEventHandler(this.state.fileWatcher.getPendingEvents().length > 0 ?
                this.state.fileWatcher.getPendingEvents()[0] :
                () => { });
            // Ajouter le nouveau handler
            this.state.fileWatcher.addEventHandler(newHandler);
        }
    }
    /**
     * Arrête l'intégration Phase 0.1
     */
    async stop() {
        // Log silencieux pour MCP
        // Arrêter le file watcher
        if (this.state.fileWatcher && this.state.fileWatcher.isActive()) {
            await this.state.fileWatcher.stop();
            // Log silencieux pour MCP
        }
        // Logger l'arrêt
        if (this.state.logger) {
            this.state.logger.info('Phase 0.1 arrêtée', 'phase0-integration', {
                fileEventsCount: this.state.stats.fileEventsCount,
                logsCount: this.state.stats.logsCount,
                uptime: Date.now() - this.state.stats.startedAt.getTime(),
            });
        }
        this.state.status = 'stopped';
        // Log silencieux pour MCP
    }
    /**
     * Obtient l'état actuel
     */
    getState() {
        return {
            ...this.state,
            stats: {
                ...this.state.stats,
                // Mettre à jour les compteurs en temps réel
                fileEventsCount: this.state.fileWatcher?.getStats().totalEvents || this.state.stats.fileEventsCount,
                logsCount: this.state.logger?.getStats().totalLogs || this.state.stats.logsCount,
            },
        };
    }
    /**
     * Obtient les logs
     */
    getLogs(limit) {
        return this.state.logger?.getLogs({ limit }) || [];
    }
    /**
     * Obtient les statistiques du file watcher
     */
    getFileWatcherStats() {
        return this.state.fileWatcher?.getStats();
    }
    /**
     * Obtient les statistiques du logger
     */
    getLoggerStats() {
        return this.state.logger?.getStats();
    }
    /**
     * Vérifie si l'intégration est active
     */
    isActive() {
        return this.state.status === 'ready' &&
            (this.state.fileWatcher?.isActive() || false);
    }
    /**
     * Obtient le workspace détecté
     */
    getWorkspace() {
        return this.state.workspace;
    }
    /**
     * Obtient le file watcher
     */
    getFileWatcher() {
        return this.state.fileWatcher;
    }
    /**
     * Obtient le logger
     */
    getLogger() {
        return this.state.logger;
    }
}
/**
 * Factory pour créer une intégration Phase 0.1
 */
export async function createPhase0Integration(options, projectPath) {
    const integration = new Phase0Integration(options);
    await integration.initialize(projectPath);
    return integration;
}
/**
 * Utilitaire : Crée une intégration Phase 0.1 avec indexation automatique
 */
export async function createPhase0IntegrationWithIndexing(onIndexNeeded, options, projectPath) {
    const integration = await createPhase0Integration(options, projectPath);
    integration.setOnIndexNeededCallback(onIndexNeeded);
    return integration;
}
// Test unitaire si exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
    // Log silencieux pour MCP
    async function runTest() {
        try {
            // Créer un répertoire de test
            const testDir = '/tmp/test-phase0-' + Date.now();
            const fs = require('fs');
            const path = require('path');
            fs.mkdirSync(testDir, { recursive: true });
            // Simuler un workspace VS Code
            fs.mkdirSync(path.join(testDir, '.vscode'), { recursive: true });
            fs.writeFileSync(path.join(testDir, '.vscode', 'settings.json'), '{}');
            // Créer l'intégration
            const integration = await createPhase0Integration({
                enableWorkspaceDetection: true,
                enableFileWatcher: true,
                enableLogging: true,
                fileWatcherOptions: {
                    debounceDelay: 500,
                    recursive: true,
                    logEvents: true,
                },
            }, testDir);
            // Log silencieux pour MCP
            // Afficher l'état
            const state = integration.getState();
            // Log silencieux pour MCP
            // Créer un fichier pour tester le watcher
            // Log silencieux pour MCP
            fs.writeFileSync(path.join(testDir, 'test-file.txt'), 'Hello Phase 0.1!');
            // Attendre un peu pour que le watcher détecte le fichier
            await new Promise(resolve => setTimeout(resolve, 1500));
            // Afficher les statistiques
            const watcherStats = integration.getFileWatcherStats();
            const loggerStats = integration.getLoggerStats();
            // Log silencieux pour MCP
            // Arrêter l'intégration
            await integration.stop();
            // Nettoyer
            fs.rmSync(testDir, { recursive: true, force: true });
            // Log silencieux pour MCP
            // Log silencieux pour MCP
        }
        catch (error) {
            // Log silencieux pour MCP
            process.exit(1);
        }
    }
    runTest().catch(() => { });
}
