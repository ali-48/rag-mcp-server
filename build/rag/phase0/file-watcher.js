// src/rag/phase0/file-watcher.ts
// Surveillance temps réel des changements de fichiers avec chokidar
import { relative, resolve } from 'path';
import { formatFileSize } from '../../core/utils/string-utils.js';
/**
 * File watcher avec gestion avancée des événements
 */
export class FileWatcher {
    watcher = null;
    workspacePath = '';
    options;
    eventHandlers = [];
    pendingEvents = new Map();
    stats;
    isProcessing = false;
    processingTimeout = null;
    constructor(options = {}) {
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
    async start(workspace, eventHandler) {
        if (this.watcher) {
            throw new Error('Watcher déjà démarré');
        }
        // Déterminer le chemin du workspace
        if (typeof workspace === 'string') {
            this.workspacePath = resolve(workspace);
        }
        else {
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
        // Log silencieux pour MCP
        // Log silencieux pour MCP
    }
    /**
     * Construit les patterns ignorés
     */
    buildIgnoredPatterns() {
        const patterns = [...this.options.ignored];
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
        patterns.push(/\.DS_Store$/, /Thumbs\.db$/, /desktop\.ini$/, /\.swp$/, /\.tmp$/, /~$/, /\.log$/, /\.cache$/);
        return patterns;
    }
    /**
     * Configure les écouteurs d'événements chokidar
     */
    setupEventListeners() {
        if (!this.watcher)
            return;
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
    async handleEvent(type, filePath) {
        this.stats.totalEvents++;
        this.stats.uptime = Date.now() - this.stats.startedAt.getTime();
        // Vérifier si le fichier doit être ignoré
        const shouldIgnore = this.shouldIgnoreFile(filePath);
        const relativePath = relative(this.workspacePath, filePath);
        const event = {
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
                // Log silencieux pour MCP
            }
            return;
        }
        // Journaliser l'événement
        if (this.options.logEvents) {
            // Log silencieux pour MCP
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
    shouldIgnoreFile(filePath) {
        const relativePath = relative(this.workspacePath, filePath);
        // Vérifier les patterns ignorés
        const patterns = this.buildIgnoredPatterns();
        for (const pattern of patterns) {
            if (typeof pattern === 'string') {
                if (relativePath.includes(pattern)) {
                    return true;
                }
            }
            else if (pattern.test(relativePath)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Obtient la raison de l'ignorance
     */
    getIgnoreReason(filePath) {
        const relativePath = relative(this.workspacePath, filePath);
        const patterns = this.buildIgnoredPatterns();
        for (const pattern of patterns) {
            if (typeof pattern === 'string') {
                if (relativePath.includes(pattern)) {
                    return `Matches ignored pattern: ${pattern}`;
                }
            }
            else if (pattern.test(relativePath)) {
                return `Matches ignored regex: ${pattern.toString()}`;
            }
        }
        return undefined;
    }
    /**
     * Obtient l'extension d'un fichier
     */
    getFileExtension(filePath) {
        const match = filePath.match(/\.([^.]+)$/);
        return match ? match[1].toLowerCase() : undefined;
    }
    /**
     * Obtient la taille d'un fichier
     */
    async getFileSize(filePath) {
        try {
            const fs = await import('fs');
            const stats = fs.statSync(filePath);
            return stats.size;
        }
        catch (error) {
            return undefined;
        }
    }
    /**
     * Planifie le traitement des événements
     */
    scheduleProcessing() {
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
    async processPendingEvents() {
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
                // Log silencieux pour MCP
            }
        }
        catch (error) {
            // Log silencieux pour MCP
        }
        finally {
            this.isProcessing = false;
        }
    }
    /**
     * Traite un événement individuel
     */
    async processEvent(event) {
        try {
            // Appeler tous les handlers
            for (const handler of this.eventHandlers) {
                await handler(event);
            }
            this.stats.lastEvent = event;
        }
        catch (error) {
            // Log silencieux pour MCP
        }
    }
    /**
     * Gère les erreurs du watcher
     */
    handleError(error) {
        if (error instanceof Error) {
            // Log silencieux pour MCP
        }
        else {
            // Log silencieux pour MCP
        }
    }
    /**
     * Gère l'événement ready
     */
    handleReady() {
        // Log silencieux pour MCP
    }
    /**
     * Arrête la surveillance
     */
    async stop() {
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
        // Log silencieux pour MCP
    }
    /**
     * Ajoute un handler d'événements
     */
    addEventHandler(handler) {
        this.eventHandlers.push(handler);
    }
    /**
     * Supprime un handler d'événements
     */
    removeEventHandler(handler) {
        const index = this.eventHandlers.indexOf(handler);
        if (index !== -1) {
            this.eventHandlers.splice(index, 1);
        }
    }
    /**
     * Obtient les statistiques actuelles
     */
    getStats() {
        return {
            ...this.stats,
            uptime: Date.now() - this.stats.startedAt.getTime(),
        };
    }
    /**
     * Vérifie si le watcher est actif
     */
    isActive() {
        return this.watcher !== null;
    }
    /**
     * Obtient le chemin du workspace surveillé
     */
    getWorkspacePath() {
        return this.workspacePath;
    }
    /**
     * Obtient les événements en attente
     */
    getPendingEvents() {
        return Array.from(this.pendingEvents.values());
    }
}
/**
 * Factory pour créer un file watcher
 */
export async function createFileWatcher(workspace, options = {}, eventHandler) {
    const watcher = new FileWatcher(options);
    await watcher.start(workspace, eventHandler);
    return watcher;
}
/**
 * Utilitaire : Crée un handler qui journalise les événements
 */
export function createLoggingEventHandler(prefix = 'FILE_WATCHER') {
    return (event) => {
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
 * Utilitaire : Crée un handler qui déclenche l'indexation
 */
export function createIndexingEventHandler(onIndexNeeded) {
    return async (event) => {
        if (event.metadata.ignored) {
            return;
        }
        // Log silencieux pour MCP
        try {
            await onIndexNeeded(event.path, event.type);
            // Log silencieux pour MCP
        }
        catch (error) {
            // Log silencieux pour MCP
        }
    };
}
// Test unitaire si exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
    // Log silencieux pour MCP
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
            // Log silencieux pour MCP
            // Log silencieux pour MCP
            // Créer quelques fichiers
            fs.writeFileSync(path.join(testDir, 'test1.txt'), 'Hello');
            fs.writeFileSync(path.join(testDir, 'test2.js'), 'console.log("test")');
            // Attendre un peu pour voir les événements
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Afficher les statistiques
            const stats = watcher.getStats();
            // Log silencieux pour MCP
            // Arrêter le watcher
            await watcher.stop();
            // Nettoyer
            fs.rmSync(testDir, { recursive: true, force: true });
            // Log silencieux pour MCP
            // Log silencieux pour MCP
        }
        catch (error) {
            // Log silencieux pour MCP
            // Nettoyer en cas d'erreur
            try {
                fs.rmSync(testDir, { recursive: true, force: true });
            }
            catch (cleanupError) {
                // Ignorer les erreurs de nettoyage
            }
            process.exit(1);
        }
    }
    runTest().catch(() => { });
}
