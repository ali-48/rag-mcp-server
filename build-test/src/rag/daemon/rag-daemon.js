// src/rag/daemon/rag-daemon.ts
// Service démon RAG avec gardes et protection des sections critiques
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { PersistentStateManager } from './persistent-state.js';
/**
 * Garde de protection
 */
export class Guard {
    name;
    description;
    violations = [];
    enabled = true;
    constructor(name, description) {
        this.name = name;
        this.description = description;
    }
    /**
     * Vérifie une condition
     */
    check(condition, violation, context) {
        if (!this.enabled)
            return true;
        if (!condition) {
            const guardViolation = {
                guard: this.name,
                violation,
                timestamp: new Date().toISOString(),
                context
            };
            this.violations.push(guardViolation);
            console.error(`❌ VIOLATION [${this.name}]: ${violation}`);
            return false;
        }
        return true;
    }
    /**
     * Enregistre une violation
     */
    recordViolation(violation, context) {
        const guardViolation = {
            guard: this.name,
            violation,
            timestamp: new Date().toISOString(),
            context
        };
        this.violations.push(guardViolation);
        console.error(`❌ VIOLATION [${this.name}]: ${violation}`);
    }
    /**
     * Récupère les violations
     */
    getViolations() {
        return [...this.violations];
    }
    /**
     * Nettoie les violations
     */
    clearViolations() {
        this.violations = [];
    }
    /**
     * Active/désactive la garde
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }
}
/**
 * Gestionnaire de sections critiques
 */
export class CriticalSectionManager {
    timeoutMs;
    allowInterruption;
    activeSections = new Map();
    timeoutIntervals = new Map();
    constructor(timeoutMs = 30000, allowInterruption = false) {
        this.timeoutMs = timeoutMs;
        this.allowInterruption = allowInterruption;
    }
    /**
     * Démarre une section critique
     */
    start(sectionId, name, metadata) {
        if (this.activeSections.has(sectionId)) {
            console.warn(`⚠️ Section critique déjà active: ${sectionId}`);
            return false;
        }
        const section = {
            id: sectionId,
            name,
            startedAt: new Date().toISOString(),
            isActive: true,
            metadata
        };
        this.activeSections.set(sectionId, section);
        // Configurer le timeout
        const timeout = setTimeout(() => {
            console.error(`⏰ Timeout section critique: ${sectionId} (${name})`);
            this.end(sectionId);
        }, this.timeoutMs);
        this.timeoutIntervals.set(sectionId, timeout);
        console.log(`🔒 Section critique démarrée: ${sectionId} (${name})`);
        return true;
    }
    /**
     * Termine une section critique
     */
    end(sectionId) {
        const section = this.activeSections.get(sectionId);
        if (!section) {
            console.warn(`⚠️ Section critique non trouvée: ${sectionId}`);
            return false;
        }
        // Nettoyer le timeout
        const timeout = this.timeoutIntervals.get(sectionId);
        if (timeout) {
            clearTimeout(timeout);
            this.timeoutIntervals.delete(sectionId);
        }
        section.isActive = false;
        this.activeSections.delete(sectionId);
        console.log(`🔓 Section critique terminée: ${sectionId} (${section.name})`);
        return true;
    }
    /**
     * Vérifie si une section est active
     */
    isActive(sectionId) {
        return this.activeSections.has(sectionId);
    }
    /**
     * Récupère les sections actives
     */
    getActiveSections() {
        return Array.from(this.activeSections.values());
    }
    /**
     * Interrompt une section (si autorisé)
     */
    interrupt(sectionId) {
        if (!this.allowInterruption) {
            console.error(`❌ Interruption non autorisée pour: ${sectionId}`);
            return false;
        }
        return this.end(sectionId);
    }
    /**
     * Nettoie toutes les sections
     */
    cleanup() {
        for (const [sectionId, timeout] of this.timeoutIntervals.entries()) {
            clearTimeout(timeout);
        }
        this.activeSections.clear();
        this.timeoutIntervals.clear();
        console.log('🧹 Sections critiques nettoyées');
    }
}
/**
 * Service démon RAG principal
 */
export class RAGDaemon extends EventEmitter {
    config;
    stateManager;
    criticalSectionManager;
    guards = new Map();
    isRunning = false;
    workspaceScanInterval;
    constructor(config) {
        super();
        this.config = {
            workspaceDetection: {
                enabled: true,
                scanIntervalMs: 60000, // 1 minute
                maxDepth: 3
            },
            criticalSections: {
                protectedOperations: ['sqlite-write', 'embedding', 'indexing', 'db-commit'],
                timeoutMs: 30000,
                allowInterruption: false
            },
            guards: {
                monitoringWriteOnly: true,
                dbIsolation: true,
                extensionReadOnly: true
            },
            autoStart: true,
            stateDir: '/rag/state',
            monitoringDir: '/rag/monitoring',
            ...config
        };
        this.stateManager = new PersistentStateManager(this.config.stateDir);
        this.criticalSectionManager = new CriticalSectionManager(this.config.criticalSections.timeoutMs, this.config.criticalSections.allowInterruption);
        this.initializeGuards();
    }
    /**
     * Initialise les gardes
     */
    initializeGuards() {
        // Garde 1: Write-Only Monitoring
        if (this.config.guards.monitoringWriteOnly) {
            const monitoringGuard = new Guard('MONITORING_WRITE_ONLY', 'Le moteur NE DOIT PAS lire ses propres fichiers de monitoring');
            this.guards.set('monitoring', monitoringGuard);
        }
        // Garde 2: DB Isolation
        if (this.config.guards.dbIsolation) {
            const dbGuard = new Guard('DB_ISOLATION', 'La DB NE DOIT PAS être accessible directement par IA ou extension');
            this.guards.set('db', dbGuard);
        }
        // Garde 3: Extension Read-Only
        if (this.config.guards.extensionReadOnly) {
            const extensionGuard = new Guard('EXTENSION_READ_ONLY', 'L\'extension NE DOIT PAS écrire dans les dossiers système');
            this.guards.set('extension', extensionGuard);
        }
        console.log(`🛡️ ${this.guards.size} gardes initialisées`);
    }
    /**
     * Démarre le démon
     */
    async start() {
        if (this.isRunning) {
            console.warn('⚠️ Démon déjà en cours d\'exécution');
            return false;
        }
        try {
            console.log('🚀 Démarrage du démon RAG...');
            // Vérifier la structure des dossiers
            this.ensureDirectoryStructure();
            // Démarrer la détection workspace
            if (this.config.workspaceDetection.enabled) {
                this.startWorkspaceDetection();
            }
            this.isRunning = true;
            this.emit('started');
            console.log('✅ Démon RAG démarré avec succès');
            return true;
        }
        catch (error) {
            console.error('❌ Erreur lors du démarrage du démon:', error);
            this.emit('error', error);
            return false;
        }
    }
    /**
     * Arrête le démon
     */
    async stop() {
        if (!this.isRunning) {
            console.warn('⚠️ Démon déjà arrêté');
            return false;
        }
        try {
            console.log('🛑 Arrêt du démon RAG...');
            // Arrêter la détection workspace
            if (this.workspaceScanInterval) {
                clearInterval(this.workspaceScanInterval);
                this.workspaceScanInterval = undefined;
            }
            // Nettoyer les sections critiques
            this.criticalSectionManager.cleanup();
            this.isRunning = false;
            this.emit('stopped');
            console.log('✅ Démon RAG arrêté avec succès');
            return true;
        }
        catch (error) {
            console.error('❌ Erreur lors de l\'arrêt du démon:', error);
            this.emit('error', error);
            return false;
        }
    }
    /**
     * Vérifie la structure des dossiers
     */
    ensureDirectoryStructure() {
        const directories = [
            this.config.stateDir,
            this.config.monitoringDir,
            path.join(this.config.monitoringDir, 'progress'),
            path.join(this.config.monitoringDir, 'health'),
            path.join(this.config.monitoringDir, 'events')
        ];
        for (const dir of directories) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 Dossier créé: ${dir}`);
            }
        }
    }
    /**
     * Démarre la détection workspace
     */
    startWorkspaceDetection() {
        console.log('🔍 Détection workspace activée');
        // Détection initiale
        this.detectWorkspace();
        // Détection périodique
        this.workspaceScanInterval = setInterval(() => {
            this.detectWorkspace();
        }, this.config.workspaceDetection.scanIntervalMs);
    }
    /**
     * Détecte le workspace actuel
     */
    async detectWorkspace() {
        try {
            const workspacePath = process.cwd();
            console.log(`📂 Workspace détecté: ${workspacePath}`);
            this.emit('workspace-detected', workspacePath);
            // Détecter et initialiser les projets
            const projects = await this.stateManager.detectAndInitializeAll(workspacePath);
            // Mettre à jour le monitoring
            this.updateMonitoring(projects);
        }
        catch (error) {
            console.error('❌ Erreur lors de la détection workspace:', error);
            this.emit('error', error);
        }
    }
    /**
     * Met à jour le monitoring
     */
    updateMonitoring(projects) {
        const monitoringData = {
            timestamp: new Date().toISOString(),
            workspace: process.cwd(),
            projects: projects.length,
            activeSections: this.criticalSectionManager.getActiveSections().length,
            guards: {
                monitoring: this.guards.get('monitoring')?.getViolations().length || 0,
                db: this.guards.get('db')?.getViolations().length || 0,
                extension: this.guards.get('extension')?.getViolations().length || 0
            }
        };
        const monitoringFile = path.join(this.config.monitoringDir, 'daemon-status.json');
        try {
            fs.writeFileSync(monitoringFile, JSON.stringify(monitoringData, null, 2));
            console.log(`📊 Monitoring mis à jour: ${monitoringFile}`);
        }
        catch (error) {
            console.error('❌ Erreur lors de la mise à jour du monitoring:', error);
        }
    }
    /**
     * Exécute une opération dans une section critique
     */
    async executeInCriticalSection(sectionId, operationName, operation, metadata) {
        // Vérifier si une section critique est déjà active
        if (this.criticalSectionManager.isActive(sectionId)) {
            throw new Error(`Section critique déjà active: ${sectionId}`);
        }
        // Démarrer la section critique
        const started = this.criticalSectionManager.start(sectionId, operationName, metadata);
        if (!started) {
            throw new Error(`Impossible de démarrer la section critique: ${sectionId}`);
        }
        this.emit('critical-section-started', sectionId);
        try {
            // Exécuter l'opération
            const result = await operation();
            // Terminer la section critique
            this.criticalSectionManager.end(sectionId);
            this.emit('critical-section-ended', sectionId);
            return result;
        }
        catch (error) {
            // En cas d'erreur, terminer la section critique
            this.criticalSectionManager.end(sectionId);
            this.emit('critical-section-ended', sectionId);
            throw error;
        }
    }
    /**
     * Vérifie une garde spécifique
     */
    checkGuard(guardName, condition, violation, context) {
        const guard = this.guards.get(guardName);
        if (!guard) {
            console.warn(`⚠️ Garde non trouvée: ${guardName}`);
            return true;
        }
        const passed = guard.check(condition, violation, context);
        if (!passed) {
            const violationObj = {
                guard: guardName,
                violation,
                timestamp: new Date().toISOString(),
                context
            };
            this.emit('guard-violation', violationObj);
        }
        return passed;
    }
    /**
     * Récupère les violations de toutes les gardes
     */
    getAllViolations() {
        const violations = [];
        for (const guard of this.guards.values()) {
            violations.push(...guard.getViolations());
        }
        return violations;
    }
    /**
     * Nettoie les violations
     */
    clearAllViolations() {
        for (const guard of this.guards.values()) {
            guard.clearViolations();
        }
        console.log('🧹 Violations nettoyées');
    }
    /**
     * Récupère l'état du démon
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            workspace: process.cwd(),
            activeSections: this.criticalSectionManager.getActiveSections(),
            guardViolations: this.getAllViolations().length,
            config: { ...this.config } // Copie pour éviter la mutation
        };
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
        console.log('⚙️ Configuration mise à jour');
    }
}
/**
 * Fonction utilitaire pour créer et démarrer un démon
 */
export async function createAndStartDaemon(config) {
    const daemon = new RAGDaemon(config);
    if (daemon.getConfig().autoStart) {
        await daemon.start();
    }
    return daemon;
}
//# sourceMappingURL=rag-daemon.js.map