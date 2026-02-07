// src/rag/daemon/rag-daemon.ts
// Service démon RAG avec gardes et protection des sections critiques

import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { PersistentStateManager } from './persistent-state.js';

/**
 * Événements du démon
 */
export interface RAGDaemonEvents {
  'started': () => void;
  'stopped': () => void;
  'error': (error: Error) => void;
  'workspace-detected': (workspacePath: string) => void;
  'project-initialized': (projectPath: string) => void;
  'critical-section-started': (section: string) => void;
  'critical-section-ended': (section: string) => void;
  'guard-violation': (violation: GuardViolation) => void;
}

/**
 * Violation de garde
 */
export interface GuardViolation {
  guard: string;
  violation: string;
  timestamp: string;
  context?: Record<string, any>;
}

/**
 * Section critique
 */
export interface CriticalSection {
  id: string;
  name: string;
  startedAt: string;
  isActive: boolean;
  metadata?: Record<string, any>;
}

/**
 * Configuration du démon
 */
export interface RAGDaemonConfig {
  workspaceDetection: {
    enabled: boolean;
    scanIntervalMs: number;
    maxDepth: number;
  };
  criticalSections: {
    protectedOperations: string[];
    timeoutMs: number;
    allowInterruption: boolean;
  };
  guards: {
    monitoringWriteOnly: boolean;
    dbIsolation: boolean;
    extensionReadOnly: boolean;
  };
  autoStart: boolean;
  stateDir: string;
  monitoringDir: string;
}

/**
 * Garde de protection
 */
export class Guard {
  private violations: GuardViolation[] = [];
  private enabled: boolean = true;

  constructor(
    private name: string,
    private description: string
  ) { }

  /**
   * Vérifie une condition
   */
  check(condition: boolean, violation: string, context?: Record<string, any>): boolean {
    if (!this.enabled) return true;

    if (!condition) {
      const guardViolation: GuardViolation = {
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
  recordViolation(violation: string, context?: Record<string, any>): void {
    const guardViolation: GuardViolation = {
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
  getViolations(): GuardViolation[] {
    return [...this.violations];
  }

  /**
   * Nettoie les violations
   */
  clearViolations(): void {
    this.violations = [];
  }

  /**
   * Active/désactive la garde
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}

/**
 * Gestionnaire de sections critiques
 */
export class CriticalSectionManager {
  private activeSections: Map<string, CriticalSection> = new Map();
  private timeoutIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private timeoutMs: number = 30000,
    private allowInterruption: boolean = false
  ) { }

  /**
   * Démarre une section critique
   */
  start(sectionId: string, name: string, metadata?: Record<string, any>): boolean {
    if (this.activeSections.has(sectionId)) {
      console.warn(`⚠️ Section critique déjà active: ${sectionId}`);
      return false;
    }

    const section: CriticalSection = {
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
  end(sectionId: string): boolean {
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
  isActive(sectionId: string): boolean {
    return this.activeSections.has(sectionId);
  }

  /**
   * Récupère les sections actives
   */
  getActiveSections(): CriticalSection[] {
    return Array.from(this.activeSections.values());
  }

  /**
   * Interrompt une section (si autorisé)
   */
  interrupt(sectionId: string): boolean {
    if (!this.allowInterruption) {
      console.error(`❌ Interruption non autorisée pour: ${sectionId}`);
      return false;
    }

    return this.end(sectionId);
  }

  /**
   * Nettoie toutes les sections
   */
  cleanup(): void {
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
  private config: RAGDaemonConfig;
  private stateManager: PersistentStateManager;
  private criticalSectionManager: CriticalSectionManager;
  private guards: Map<string, Guard> = new Map();
  private isRunning: boolean = false;
  private workspaceScanInterval?: NodeJS.Timeout;

  constructor(config?: Partial<RAGDaemonConfig>) {
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
    this.criticalSectionManager = new CriticalSectionManager(
      this.config.criticalSections.timeoutMs,
      this.config.criticalSections.allowInterruption
    );

    this.initializeGuards();
  }

  /**
   * Initialise les gardes
   */
  private initializeGuards(): void {
    // Garde 1: Write-Only Monitoring
    if (this.config.guards.monitoringWriteOnly) {
      const monitoringGuard = new Guard(
        'MONITORING_WRITE_ONLY',
        'Le moteur NE DOIT PAS lire ses propres fichiers de monitoring'
      );
      this.guards.set('monitoring', monitoringGuard);
    }

    // Garde 2: DB Isolation
    if (this.config.guards.dbIsolation) {
      const dbGuard = new Guard(
        'DB_ISOLATION',
        'La DB NE DOIT PAS être accessible directement par IA ou extension'
      );
      this.guards.set('db', dbGuard);
    }

    // Garde 3: Extension Read-Only
    if (this.config.guards.extensionReadOnly) {
      const extensionGuard = new Guard(
        'EXTENSION_READ_ONLY',
        'L\'extension NE DOIT PAS écrire dans les dossiers système'
      );
      this.guards.set('extension', extensionGuard);
    }

    console.log(`🛡️ ${this.guards.size} gardes initialisées`);
  }

  /**
   * Démarre le démon
   */
  async start(): Promise<boolean> {
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

    } catch (error: any) {
      console.error('❌ Erreur lors du démarrage du démon:', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Arrête le démon
   */
  async stop(): Promise<boolean> {
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

    } catch (error: any) {
      console.error('❌ Erreur lors de l\'arrêt du démon:', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Vérifie la structure des dossiers
   */
  private ensureDirectoryStructure(): void {
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
  private startWorkspaceDetection(): void {
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
  private async detectWorkspace(): Promise<void> {
    try {
      const workspacePath = process.cwd();
      console.log(`📂 Workspace détecté: ${workspacePath}`);

      this.emit('workspace-detected', workspacePath);

      // Détecter et initialiser les projets
      const projects = await this.stateManager.detectAndInitializeAll(workspacePath);

      // Mettre à jour le monitoring
      this.updateMonitoring(projects);

    } catch (error: any) {
      console.error('❌ Erreur lors de la détection workspace:', error);
      this.emit('error', error);
    }
  }

  /**
   * Met à jour le monitoring
   */
  private updateMonitoring(projects: any[]): void {
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
      fs.writeFileSync(
        monitoringFile,
        JSON.stringify(monitoringData, null, 2)
      );

      console.log(`📊 Monitoring mis à jour: ${monitoringFile}`);

    } catch (error: any) {
      console.error('❌ Erreur lors de la mise à jour du monitoring:', error);
    }
  }

  /**
   * Exécute une opération dans une section critique
   */
  async executeInCriticalSection<T>(
    sectionId: string,
    operationName: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
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

    } catch (error: any) {
      // En cas d'erreur, terminer la section critique
      this.criticalSectionManager.end(sectionId);
      this.emit('critical-section-ended', sectionId);

      throw error;
    }
  }

  /**
   * Vérifie une garde spécifique
   */
  checkGuard(guardName: string, condition: boolean, violation: string, context?: Record<string, any>): boolean {
    const guard = this.guards.get(guardName);
    if (!guard) {
      console.warn(`⚠️ Garde non trouvée: ${guardName}`);
      return true;
    }

    const passed = guard.check(condition, violation, context);

    if (!passed) {
      const violationObj: GuardViolation = {
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
  getAllViolations(): GuardViolation[] {
    const violations: GuardViolation[] = [];

    for (const guard of this.guards.values()) {
      violations.push(...guard.getViolations());
    }

    return violations;
  }

  /**
   * Nettoie les violations
   */
  clearAllViolations(): void {
    for (const guard of this.guards.values()) {
      guard.clearViolations();
    }

    console.log('🧹 Violations nettoyées');
  }

  /**
   * Récupère l'état du démon
   */
  getStatus(): {
    isRunning: boolean;
    workspace: string;
    activeSections: CriticalSection[];
    guardViolations: number;
    config: RAGDaemonConfig;
  } {
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
  getConfig(): RAGDaemonConfig {
    return { ...this.config };
  }

  /**
   * Met à jour la configuration
   */
  updateConfig(updates: Partial<RAGDaemonConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log('⚙️ Configuration mise à jour');
  }
}

/**
 * Fonction utilitaire pour créer et démarrer un démon
 */
export async function createAndStartDaemon(
  config?: Partial<RAGDaemonConfig>
): Promise<RAGDaemon> {
  const daemon = new RAGDaemon(config);

  if (daemon.getConfig().autoStart) {
    await daemon.start();
  }

  return daemon;
}
