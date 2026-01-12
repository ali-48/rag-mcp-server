// src/rag/phase0/file-watcher.ts
// Surveillance temps réel des changements de fichiers avec chokidar

import type { FSWatcher } from 'chokidar';
import { relative, resolve } from 'path';
import { WorkspaceContext } from './workspace-detector.js';

/**
 * Types d'événements de fichiers
 */
export type FileEventType = 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';

/**
 * Événement de fichier détecté
 */
export interface FileEvent {
    /** Type d'événement */
    type: FileEventType;

    /** Chemin absolu du fichier */
    path: string;

    /** Chemin relatif au workspace */
    relativePath: string;

    /** Timestamp de l'événement */
    timestamp: Date;

    /** Métadonnées supplémentaires */
    metadata: {
        /** Taille du fichier (si disponible) */
        size?: number;

        /** Extension du fichier */
        extension?: string;

        /** Est-ce un fichier ignoré ? */
        ignored: boolean;

        /** Raison de l'ignorance (si applicable) */
        ignoreReason?: string;
    };
}

/**
 * Callback pour les événements de fichiers
 */
export type FileEventHandler = (event: FileEvent) => void | Promise<void>;

/**
 * Options du file watcher
 */
export interface FileWatcherOptions {
    /** Patterns à ignorer (regex ou glob) */
    ignored?: (string | RegExp)[];

    /** Délai avant traitement (debounce) en ms */
    debounceDelay?: number;

    /** Surveiller les sous-répertoires récursivement */
    recursive?: boolean;

    /** Ignorer les fichiers cachés (commençant par .) */
    ignoreHidden?: boolean;

    /** Ignorer les fichiers de node_modules */
    ignoreNodeModules?: boolean;

    /** Ignorer les fichiers .git */
    ignoreGit?: boolean;

    /** Journaliser les événements */
    logEvents?: boolean;

    /** Nom maximum d'événements en attente */
    maxPendingEvents?: number;
}

/**
 * Statistiques du watcher
 */
export interface WatcherStats {
    /** Nombre total d'événements reçus */
    totalEvents: number;

    /** Événements traités */
    processedEvents: number;

    /** Événements ignorés */
    ignoredEvents: number;

    /** Événements en attente */
    pendingEvents: number;

    /** Dernier événement traité */
    lastEvent?: FileEvent;

    /** Temps de démarrage */
    startedAt: Date;

    /** Temps d'activité en ms */
    uptime: number;
}

/**
 * File watcher avec gestion avancée des événements
 */
export class FileWatcher {
    private watcher: FSWatcher | null = null;
    private workspacePath: string = '';
    private options: Required<FileWatcherOptions>;
    private eventHandlers: FileEventHandler[] = [];
    private pendingEvents: Map<string, FileEvent> = new Map();
    private stats: WatcherStats;
    private isProcessing = false;
    private processingTimeout: NodeJS.Timeout | null = null;

    constructor(options: FileWatcherOptions = {}) {
        this.options = {
            ignored: options.ignored || [],
            debounceDelay: options.debounceDelay ?? 1000,
            recursive: options.recursive ?? true,
            ignoreHidden: options.ignoreHidden ?? true,
            ignoreNodeModules: options.ignoreNodeModules ?? true,
            ignoreGit: options.ignoreGit ?? true,
            logEvents: options.logEvents ?? false,
            maxPendingEvents: options.maxPendingEvents ?? 100,
        };

        this.stats = {
            totalEvents: 0,
            processedEvents: 0,
            ignoredEvents: 0,
            pendingEvents: 0,
            startedAt: new Date(),
            uptime: 0,
        };
    }

    /**
     * Démarre la surveillance d'un workspace
     */
    async start(
        workspace: WorkspaceContext | string,
        eventHandler?: FileEventHandler
    ): Promise<void> {
        if (this.watcher) {
            throw new Error('Watcher déjà démarré');
        }

        // Déterminer le chemin du workspace
        if (typeof workspace === 'string') {
            this.workspacePath = resolve(workspace);
        } else {
            this.workspacePath = workspace.path;
        }

        // Ajouter le handler si fourni
        if (eventHandler) {
            this.eventHandlers.push(eventHandler);
        }

        // Importer chokidar dynamiquement
        const chokidar = await import('chokidar');

        // Construire la liste des patterns ignorés
        const ignoredPatterns = this.buildIgnoredPatterns();

        // Créer le watcher
        this.watcher = chokidar.watch(this.workspacePath, {
            ignored: ignoredPatterns,
            persistent: true,
            ignoreInitial: true, // Ignorer les fichiers existants au démarrage
            followSymlinks: false,
            depth: this.options.recursive ? undefined : 0,
            awaitWriteFinish: {
                stabilityThreshold: this.options.debounceDelay,
                pollInterval: 100,
            },
            interval: 100,
            binaryInterval: 300,
        });

        // Configurer les écouteurs d'événements
        this.setupEventListeners();

        console.log(`👁️  File watcher démarré pour: ${this.workspacePath}`);
        console.log(`   Options:`, {
            recursive: this.options.recursive,
            debounceDelay: this.options.debounceDelay,
            maxPendingEvents: this.options.maxPendingEvents,
        });
    }

    /**
     * Construit les patterns ignorés
     */
    private buildIgnoredPatterns(): (string | RegExp)[] {
        const patterns: (string | RegExp)[] = [...this.options.ignored];

        // Fichiers cachés
        if (this.options.ignoreHidden) {
            patterns.push(/\/\.[^/]*$/); // Fichiers cachés
            patterns.push(/.*\/\.[^/]+\/.*/); // Dossiers cachés
        }

        // node_modules
        if (this.options.ignoreNodeModules) {
            patterns.push(/node_modules/);
        }

        // .git
        if (this.options.ignoreGit) {
            patterns.push(/\.git/);
        }

        // Patterns par défaut
        patterns.push(
            /\.DS_Store$/,
            /Thumbs\.db$/,
            /desktop\.ini$/,
            /\.swp$/,
            /\.tmp$/,
            /~$/,
            /\.log$/,
            /\.cache$/
        );

        return patterns;
    }

    /**
     * Configure les écouteurs d'événements chokidar
     */
    private setupEventListeners(): void {
        if (!this.watcher) return;

        this.watcher
            .on('add', (path) => this.handleEvent('add', path))
            .on('change', (path) => this.handleEvent('change', path))
            .on('unlink', (path) => this.handleEvent('unlink', path))
            .on('addDir', (path) => this.handleEvent('addDir', path))
            .on('unlinkDir', (path) => this.handleEvent('unlinkDir', path))
            .on('error', (error) => this.handleError(error))
            .on('ready', () => this.handleReady());
    }

    /**
     * Gère un événement de fichier
     */
    private async handleEvent(type: FileEventType, filePath: string): Promise<void> {
        this.stats.totalEvents++;
        this.stats.uptime = Date.now() - this.stats.startedAt.getTime();

        // Vérifier si le fichier doit être ignoré
        const shouldIgnore = this.shouldIgnoreFile(filePath);
        const relativePath = relative(this.workspacePath, filePath);

        const event: FileEvent = {
            type,
            path: filePath,
            relativePath,
            timestamp: new Date(),
            metadata: {
                ignored: shouldIgnore,
                ignoreReason: shouldIgnore ? this.getIgnoreReason(filePath) : undefined,
                extension: this.getFileExtension(filePath),
                size: await this.getFileSize(filePath),
            },
        };

        // Mettre à jour les statistiques
        if (shouldIgnore) {
            this.stats.ignoredEvents++;
            if (this.options.logEvents) {
                console.log(`👁️  [IGNORED] ${type}: ${relativePath}`);
            }
            return;
        }

        // Journaliser l'événement
        if (this.options.logEvents) {
            console.log(`👁️  [${type.toUpperCase()}] ${relativePath}`);
        }

        // Gérer le debouncing
        const eventKey = `${type}:${filePath}`;
        this.pendingEvents.set(eventKey, event);
        this.stats.pendingEvents = this.pendingEvents.size;

        // Déclencher le traitement après délai
        this.scheduleProcessing();
    }

    /**
     * Vérifie si un fichier doit être ignoré
     */
    private shouldIgnoreFile(filePath: string): boolean {
        const relativePath = relative(this.workspacePath, filePath);

        // Vérifier les patterns ignorés
        const patterns = this.buildIgnoredPatterns();

        for (const pattern of patterns) {
            if (typeof pattern === 'string') {
                if (relativePath.includes(pattern)) {
                    return true;
                }
            } else if (pattern.test(relativePath)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Obtient la raison de l'ignorance
     */
    private getIgnoreReason(filePath: string): string | undefined {
        const relativePath = relative(this.workspacePath, filePath);
        const patterns = this.buildIgnoredPatterns();

        for (const pattern of patterns) {
            if (typeof pattern === 'string') {
                if (relativePath.includes(pattern)) {
                    return `Matches ignored pattern: ${pattern}`;
                }
            } else if (pattern.test(relativePath)) {
                return `Matches ignored regex: ${pattern.toString()}`;
            }
        }

        return undefined;
    }

    /**
     * Obtient l'extension d'un fichier
     */
    private getFileExtension(filePath: string): string | undefined {
        const match = filePath.match(/\.([^.]+)$/);
        return match ? match[1].toLowerCase() : undefined;
    }

    /**
     * Obtient la taille d'un fichier
     */
    private async getFileSize(filePath: string): Promise<number | undefined> {
        try {
            const fs = await import('fs');
            const stats = fs.statSync(filePath);
            return stats.size;
        } catch (error: unknown) {
            return undefined;
        }
    }

    /**
     * Planifie le traitement des événements
     */
    private scheduleProcessing(): void {
        if (this.processingTimeout) {
            clearTimeout(this.processingTimeout);
        }

        this.processingTimeout = setTimeout(() => {
            this.processPendingEvents();
        }, this.options.debounceDelay);
    }

    /**
     * Traite les événements en attente
     */
    private async processPendingEvents(): Promise<void> {
        if (this.isProcessing || this.pendingEvents.size === 0) {
            return;
        }

        this.isProcessing = true;

        try {
            // Récupérer tous les événements en attente
            const events = Array.from(this.pendingEvents.values());
            this.pendingEvents.clear();
            this.stats.pendingEvents = 0;

            // Traiter chaque événement
            for (const event of events) {
                await this.processEvent(event);
            }

            this.stats.processedEvents += events.length;

            if (this.options.logEvents && events.length > 0) {
                console.log(`👁️  Processed ${events.length} events`);
            }

        } catch (error) {
            console.error('❌ Error processing events:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Traite un événement individuel
     */
    private async processEvent(event: FileEvent): Promise<void> {
        try {
            // Appeler tous les handlers
            for (const handler of this.eventHandlers) {
                await handler(event);
            }

            this.stats.lastEvent = event;

        } catch (error) {
            console.error(`❌ Error in event handler for ${event.path}:`, error);
        }
    }

    /**
     * Gère les erreurs du watcher
     */
    private handleError(error: unknown): void {
        if (error instanceof Error) {
            console.error('❌ File watcher error:', error);
        } else {
            console.error('❌ File watcher error:', String(error));
        }
    }

    /**
     * Gère l'événement ready
     */
    private handleReady(): void {
        console.log('✅ File watcher ready');
    }

    /**
     * Arrête la surveillance
     */
    async stop(): Promise<void> {
        if (this.processingTimeout) {
            clearTimeout(this.processingTimeout);
            this.processingTimeout = null;
        }

        if (this.watcher) {
            await this.watcher.close();
            this.watcher = null;
        }

        this.pendingEvents.clear();
        this.stats.pendingEvents = 0;

        console.log('👁️  File watcher stopped');
    }

    /**
     * Ajoute un handler d'événements
     */
    addEventHandler(handler: FileEventHandler): void {
        this.eventHandlers.push(handler);
    }

    /**
     * Supprime un handler d'événements
     */
    removeEventHandler(handler: FileEventHandler): void {
        const index = this.eventHandlers.indexOf(handler);
        if (index !== -1) {
            this.eventHandlers.splice(index, 1);
        }
    }

    /**
     * Obtient les statistiques actuelles
     */
    getStats(): WatcherStats {
        return {
            ...this.stats,
            uptime: Date.now() - this.stats.startedAt.getTime(),
        };
    }

    /**
     * Vérifie si le watcher est actif
     */
    isActive(): boolean {
        return this.watcher !== null;
    }

    /**
     * Obtient le chemin du workspace surveillé
     */
    getWorkspacePath(): string {
        return this.workspacePath;
    }

    /**
     * Obtient les événements en attente
     */
    getPendingEvents(): FileEvent[] {
        return Array.from(this.pendingEvents.values());
    }
}

/**
 * Factory pour créer un file watcher
 */
export async function createFileWatcher(
    workspace: WorkspaceContext | string,
    options: FileWatcherOptions = {},
    eventHandler?: FileEventHandler
): Promise<FileWatcher> {
    const watcher = new FileWatcher(options);
    await watcher.start(workspace, eventHandler);
    return watcher;
}

/**
 * Utilitaire : Crée un handler qui journalise les événements
 */
export function createLoggingEventHandler(
    prefix: string = 'FILE_WATCHER'
): FileEventHandler {
    return (event: FileEvent) => {
        const timestamp = event.timestamp.toISOString().split('T')[1].slice(0, -1);
        const sizeInfo = event.metadata.size
            ? ` (${formatFileSize(event.metadata.size)})`
            : '';

        console.log(`[${timestamp}] ${prefix}: ${event.type.toUpperCase()} ${event.relativePath}${sizeInfo}`);

        if (event.metadata.ignored) {
            console.log(`       IGNORED: ${event.metadata.ignoreReason}`);
        }
    };
}

/**
 * Utilitaire : Formate la taille d'un fichier
 */
function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Utilitaire : Crée un handler qui déclenche l'indexation
 */
export function createIndexingEventHandler(
    onIndexNeeded: (filePath: string, eventType: FileEventType) => Promise<void>
): FileEventHandler {
    return async (event: FileEvent) => {
        if (event.metadata.ignored) {
            return;
        }

        console.log(`🔍 Indexation nécessaire: ${event.type} ${event.relativePath}`);

        try {
            await onIndexNeeded(event.path, event.type);
            console.log(`✅ Indexation déclenchée pour: ${event.relativePath}`);
        } catch (error) {
            console.error(`❌ Erreur d'indexation pour ${event.relativePath}:`, error);
        }
    };
}

// Test unitaire si exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🧪 Test du file watcher...');

    // Créer un répertoire de test
    const testDir = '/tmp/test-file-watcher-' + Date.now();
    const fs = require('fs');
    const path = require('path');

    fs.mkdirSync(testDir, { recursive: true });

    async function runTest() {
        try {
            const watcher = await createFileWatcher(testDir, {
                logEvents: true,
                debounceDelay: 500,
            }, createLoggingEventHandler('TEST'));

            console.log(`✅ Watcher démarré pour: ${testDir}`);
            console.log('   Création de fichiers de test...');

            // Créer quelques fichiers
            fs.writeFileSync(path.join(testDir, 'test1.txt'), 'Hello');
            fs.writeFileSync(path.join(testDir, 'test2.js'), 'console.log("test")');

            // Attendre un peu pour voir les événements
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Afficher les statistiques
            const stats = watcher.getStats();
            console.log('📊 Statistiques du watcher:');
            console.log(`  Total events: ${stats.totalEvents}`);
            console.log(`  Processed: ${stats.processedEvents}`);
            console.log(`  Ignored: ${stats.ignoredEvents}`);
            console.log(`  Pending: ${stats.pendingEvents}`);

            // Arrêter le watcher
            await watcher.stop();

            // Nettoyer
            fs.rmSync(testDir, { recursive: true, force: true });
            console.log('🧹 Répertoire de test nettoyé');

            console.log('✅ Test du file watcher réussi !');
        } catch (error) {
            console.error('❌ Test du file watcher échoué:', error);
            // Nettoyer en cas d'erreur
            try {
                fs.rmSync(testDir, { recursive: true, force: true });
            } catch (cleanupError) {
                // Ignorer les erreurs de nettoyage
            }
            process.exit(1);
        }
    }

    runTest().catch(console.error);
}
