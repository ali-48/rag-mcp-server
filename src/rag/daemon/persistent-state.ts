// src/rag/daemon/persistent-state.ts
// Système d'état persistant avec AutoInitializer et retry avec backoff

import fs from 'fs';
import path from 'path';

/**
 * État d'initialisation d'un projet
 */
export interface ProjectInitState {
  projectPath: string;
  status: 'pending' | 'initializing' | 'ok' | 'temporary_failure' | 'permanent_failure';
  lastAttempt: string; // ISO date
  retryAfter?: string; // ISO date (si temporary_failure)
  errorCount: number;
  lastError?: string;
  initializedAt?: string;
  metadata?: Record<string, any>;
}

/**
 * État d'un projet détecté
 */
export interface DetectedProject {
  path: string;
  type: string;
  detectedAt: string;
  rootGroup?: string; // Pour monorepos
  isolationLevel: 'full' | 'shared_memory';
  metadata?: Record<string, any>;
}

/**
 * Échec temporaire
 */
export interface TemporaryFailure {
  projectPath: string;
  error: string;
  occurredAt: string;
  retryAfter: string;
  attemptCount: number;
  context?: Record<string, any>;
}

/**
 * Configuration du backoff
 */
export interface BackoffConfig {
  pattern: 'fibonacci' | 'exponential' | 'linear';
  initialDelayMs: number;
  maxDelayMs: number;
  maxRetries: number;
}

/**
 * AutoInitializer avec retry et backoff
 */
export class AutoInitializer {
  private statePath: string;
  private backoffConfig: BackoffConfig;

  constructor(stateDir: string = '/rag/state') {
    this.statePath = path.resolve(stateDir);
    this.backoffConfig = {
      pattern: 'fibonacci',
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      maxRetries: 3
    };
  }

  /**
   * Initialise un projet avec retry automatique
   */
  async initializeProject(projectPath: string): Promise<boolean> {
    const initState = await this.getInitState(projectPath);

    // Vérifier si déjà initialisé
    if (initState.status === 'ok') {
      console.log(`✅ Projet déjà initialisé: ${projectPath}`);
      return true;
    }

    // Vérifier si en échec temporaire (attendre retryAfter)
    if (initState.status === 'temporary_failure' && initState.retryAfter) {
      const retryAfter = new Date(initState.retryAfter);
      if (retryAfter > new Date()) {
        console.log(`⏳ Projet en échec temporaire, réessai après: ${initState.retryAfter}`);
        return false;
      }
    }

    // Mettre à jour l'état
    initState.status = 'initializing';
    initState.lastAttempt = new Date().toISOString();
    await this.saveInitState(initState);

    // Tentatives avec backoff
    for (let attempt = 1; attempt <= this.backoffConfig.maxRetries; attempt++) {
      try {
        console.log(`🔄 Tentative ${attempt}/${this.backoffConfig.maxRetries} pour ${projectPath}`);

        await this.performInitialization(projectPath);

        // Succès
        initState.status = 'ok';
        initState.initializedAt = new Date().toISOString();
        initState.errorCount = 0;
        initState.lastError = undefined;
        initState.retryAfter = undefined;
        await this.saveInitState(initState);

        console.log(`✅ Projet initialisé avec succès: ${projectPath}`);
        return true;

      } catch (error: any) {
        // Échec
        const delay = this.calculateBackoff(attempt);
        console.error(`❌ Tentative ${attempt} échouée pour ${projectPath}:`, error.message);
        console.log(`⏳ Prochaine tentative dans ${delay}ms`);

        // Mettre à jour l'état
        initState.status = 'temporary_failure';
        initState.errorCount = attempt;
        initState.lastError = error.message;
        initState.retryAfter = new Date(Date.now() + delay).toISOString();
        await this.saveInitState(initState);

        // Attendre le backoff
        if (attempt < this.backoffConfig.maxRetries) {
          await this.sleep(delay);
        }
      }
    }

    // Toutes les tentatives ont échoué
    initState.status = 'permanent_failure';
    await this.saveInitState(initState);

    // Enregistrer l'échec temporaire
    await this.recordTemporaryFailure({
      projectPath,
      error: `Échec après ${this.backoffConfig.maxRetries} tentatives`,
      occurredAt: new Date().toISOString(),
      retryAfter: new Date(Date.now() + 3600000).toISOString(), // 1 heure
      attemptCount: this.backoffConfig.maxRetries
    });

    console.error(`❌❌ Échec permanent pour ${projectPath}`);
    return false;
  }

  /**
   * Calcule le délai de backoff
   */
  private calculateBackoff(attempt: number): number {
    switch (this.backoffConfig.pattern) {
      case 'fibonacci':
        // Séquence Fibonacci: 1, 1, 2, 3, 5, 8, 13, 21, ...
        let a = 1, b = 1;
        for (let i = 1; i < attempt; i++) {
          [a, b] = [b, a + b];
        }
        return Math.min(a * this.backoffConfig.initialDelayMs, this.backoffConfig.maxDelayMs);

      case 'exponential':
        return Math.min(
          Math.pow(2, attempt - 1) * this.backoffConfig.initialDelayMs,
          this.backoffConfig.maxDelayMs
        );

      case 'linear':
        return Math.min(
          attempt * this.backoffConfig.initialDelayMs,
          this.backoffConfig.maxDelayMs
        );

      default:
        return this.backoffConfig.initialDelayMs;
    }
  }

  /**
   * Effectue l'initialisation réelle du projet
   */
  private async performInitialization(projectPath: string): Promise<void> {
    // Vérifier que le projet existe
    if (!fs.existsSync(projectPath)) {
      throw new Error(`Le projet n'existe pas: ${projectPath}`);
    }

    // Vérifier les permissions
    try {
      fs.accessSync(projectPath, fs.constants.R_OK);
    } catch {
      throw new Error(`Permissions insuffisantes pour lire le projet: ${projectPath}`);
    }

    // Créer la structure de base
    const ragDir = path.join(projectPath, '.rag');
    if (!fs.existsSync(ragDir)) {
      fs.mkdirSync(ragDir, { recursive: true });
    }

    // Initialiser la base de données structurelle
    const structureDbPath = path.join(ragDir, 'structure.sqlite');
    // TODO: Initialiser la DB structurelle

    // Initialiser la base de données vecteurs
    const vectorsDbPath = path.join(ragDir, 'vectors.sqlite');
    // TODO: Initialiser la DB vecteurs

    // Créer le fichier de configuration
    const config = {
      version: '1.0.0',
      projectPath,
      initializedAt: new Date().toISOString(),
      structureDbPath,
      vectorsDbPath
    };

    fs.writeFileSync(
      path.join(ragDir, 'config.json'),
      JSON.stringify(config, null, 2)
    );

    console.log(`📁 Structure créée pour ${projectPath}`);
  }

  /**
   * Obtient l'état d'initialisation d'un projet
   */
  async getInitState(projectPath: string): Promise<ProjectInitState> {
    const initFile = path.join(this.statePath, 'init.json');

    if (!fs.existsSync(initFile)) {
      return {
        projectPath,
        status: 'pending',
        lastAttempt: new Date().toISOString(),
        errorCount: 0
      };
    }

    const data = JSON.parse(fs.readFileSync(initFile, 'utf8'));
    return data.projects[projectPath] || {
      projectPath,
      status: 'pending',
      lastAttempt: new Date().toISOString(),
      errorCount: 0
    };
  }

  /**
   * Sauvegarde l'état d'initialisation
   */
  private async saveInitState(state: ProjectInitState): Promise<void> {
    const initFile = path.join(this.statePath, 'init.json');

    let data: any = { version: '1.0.0', projects: {} };
    if (fs.existsSync(initFile)) {
      data = JSON.parse(fs.readFileSync(initFile, 'utf8'));
    }

    data.projects[state.projectPath] = state;
    data.lastUpdated = new Date().toISOString();

    fs.writeFileSync(initFile, JSON.stringify(data, null, 2));
  }

  /**
   * Enregistre un échec temporaire
   */
  async recordTemporaryFailure(failure: TemporaryFailure): Promise<void> {
    const failuresFile = path.join(this.statePath, 'failures.json');

    let data: any = { version: '1.0.0', temporary_failures: {} };
    if (fs.existsSync(failuresFile)) {
      data = JSON.parse(fs.readFileSync(failuresFile, 'utf8'));
    }

    data.temporary_failures[failure.projectPath] = failure;
    data.lastUpdated = new Date().toISOString();

    fs.writeFileSync(failuresFile, JSON.stringify(data, null, 2));
  }

  /**
   * Nettoie les échecs anciens
   */
  async cleanupOldFailures(maxAgeDays: number = 7): Promise<void> {
    const failuresFile = path.join(this.statePath, 'failures.json');

    if (!fs.existsSync(failuresFile)) return;

    const data = JSON.parse(fs.readFileSync(failuresFile, 'utf8'));
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);

    const cleanedFailures: Record<string, TemporaryFailure> = {};
    for (const [projectPath, failure] of Object.entries(data.temporary_failures || {}) as [string, TemporaryFailure][]) {
      const occurredAt = new Date(failure.occurredAt);
      if (occurredAt > cutoff) {
        cleanedFailures[projectPath] = failure;
      }
    }

    data.temporary_failures = cleanedFailures;
    data.lastUpdated = new Date().toISOString();

    fs.writeFileSync(failuresFile, JSON.stringify(data, null, 2));

    console.log(`🧹 Nettoyage des échecs: ${Object.keys(cleanedFailures).length} restants`);
  }

  /**
   * Récupère tous les projets en échec temporaire
   */
  async getTemporaryFailures(): Promise<TemporaryFailure[]> {
    const failuresFile = path.join(this.statePath, 'failures.json');

    if (!fs.existsSync(failuresFile)) {
      return [];
    }

    const data = JSON.parse(fs.readFileSync(failuresFile, 'utf8'));
    return Object.values(data.temporary_failures || {});
  }

  /**
   * Vérifie si un projet peut être réessayé
   */
  async canRetry(projectPath: string): Promise<boolean> {
    const failures = await this.getTemporaryFailures();
    const failure = failures.find(f => f.projectPath === projectPath);

    if (!failure) return true;

    const retryAfter = new Date(failure.retryAfter);
    return retryAfter <= new Date();
  }

  /**
   * Sleep utilitaire
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Gestionnaire d'état persistant principal
 */
export class PersistentStateManager {
  private autoInitializer: AutoInitializer;
  private projectsFile: string;

  constructor(stateDir: string = '/rag/state') {
    this.autoInitializer = new AutoInitializer(stateDir);
    this.projectsFile = path.join(stateDir, 'projects.json');
  }

  /**
   * Détecte et initialise tous les projets
   */
  async detectAndInitializeAll(workspaceRoot: string): Promise<DetectedProject[]> {
    console.log(`🔍 Détection des projets dans: ${workspaceRoot}`);

    const projects = await this.detectProjects(workspaceRoot);
    console.log(`📁 ${projects.length} projets détectés`);

    // Sauvegarder les projets détectés
    await this.saveDetectedProjects(projects);

    // Initialiser chaque projet
    for (const project of projects) {
      console.log(`🚀 Initialisation de: ${project.path}`);
      await this.autoInitializer.initializeProject(project.path);
    }

    return projects;
  }

  /**
   * Détecte les projets dans un workspace
   */
  private async detectProjects(workspaceRoot: string): Promise<DetectedProject[]> {
    const projects: DetectedProject[] = [];
    const signatures = [
      { file: 'package.json', type: 'node' },
      { file: 'pyproject.toml', type: 'python' },
      { file: 'Cargo.toml', type: 'rust' },
      { file: 'go.mod', type: 'go' },
      { file: '.git', type: 'git' }
    ];

    // Scanner récursivement (profondeur limitée)
    await this.scanDirectory(workspaceRoot, 3, (dirPath) => {
      for (const sig of signatures) {
        if (fs.existsSync(path.join(dirPath, sig.file))) {
          // Vérifier si c'est un monorepo
          const rootGroup = this.detectMonorepo(dirPath);

          projects.push({
            path: dirPath,
            type: sig.type,
            detectedAt: new Date().toISOString(),
            rootGroup,
            isolationLevel: rootGroup ? 'shared_memory' : 'full',
            metadata: { signature: sig.file }
          });

          break; // Un projet par dossier
        }
      }
    });

    return projects;
  }

  /**
   * Détecte un monorepo
   */
  private detectMonorepo(dirPath: string): string | null {
    const monorepoPatterns = ['packages/', 'workspaces', 'lerna.json'];

    for (const pattern of monorepoPatterns) {
      if (pattern.endsWith('/')) {
        // Dossier
        if (fs.existsSync(path.join(dirPath, pattern))) {
          return `monorepo-${this.hash(dirPath)}`;
        }
      } else {
        // Fichier
        if (fs.existsSync(path.join(dirPath, pattern))) {
          return `monorepo-${this.hash(dirPath)}`;
        }
      }
    }

    return null;
  }

  /**
   * Hash simple pour identification
   */
  private hash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0; // Convertir en 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Scanner récursif avec profondeur limitée
   */
  private async scanDirectory(
    dirPath: string,
    maxDepth: number,
    callback: (dirPath: string) => void
  ): Promise<void> {
    if (maxDepth <= 0) return;

    try {
      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        const fullPath = path.join(dirPath, item);

        try {
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            // Ignorer les dossiers système
            if (item.startsWith('.') ||
              item === 'node_modules' ||
              item === 'build' ||
              item === 'dist' ||
              item === '.git') {
              continue;
            }

            // Appeler le callback pour ce dossier
            callback(fullPath);

            // Scanner récursivement
            await this.scanDirectory(fullPath, maxDepth - 1, callback);
          }
        } catch (error) {
          // Ignorer les erreurs d'accès
          console.warn(`⚠️ Impossible d'accéder à ${fullPath}:`, error.message);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Impossible de scanner ${dirPath}:`, error.message);
    }
  }

  /**
   * Sauvegarde les projets détectés
   */
  private async saveDetectedProjects(projects: DetectedProject[]): Promise<void> {
    const data = {
      version: '1.0.0',
      detected_at: new Date().toISOString(),
      projects,
      workspace_root: process.cwd(),
      detection_rules: {
        max_depth: 3,
        project_signatures: [
          { file: 'package.json', type: 'node' },
          { file: 'pyproject.toml', type: 'python' },
          { file: 'Cargo.toml', type: 'rust' },
          { file: 'go.mod', type: 'go' },
          { file: '.git', type: 'git' }
        ],
        monorepo_detection: {
          patterns: ['packages/', 'workspaces', 'lerna.json'],
          isolation: 'full'
        }
      }
    };

    fs.writeFileSync(this.projectsFile, JSON.stringify(data, null, 2));
    console.log(`💾 Projets sauvegardés: ${projects.length} projets`);
  }

  /**
   * Charge les projets détectés
   */
  async loadDetectedProjects(): Promise<DetectedProject[]> {
    if (!fs.existsSync(this.projectsFile)) {
      return [];
    }

    const data = JSON.parse(fs.readFileSync(this.projectsFile, 'utf8'));
    return data.projects || [];
  }

  /**
   * Met à jour l'état d'un projet
   */
  async updateProjectState(projectPath: string, updates: Partial<DetectedProject>): Promise<void> {
    const projects = await this.loadDetectedProjects();
    const index = projects.findIndex(p => p.path === projectPath);

    if (index !== -1) {
      projects[index] = { ...projects[index], ...updates };
      await this.saveDetectedProjects(projects);
    }
  }

  /**
   * Retourne les projets qui nécessitent une réinitialisation
   */
  async getProjectsNeedingReset(): Promise<DetectedProject[]> {
    const projects = await this.loadDetectedProjects();
    const needsReset: DetectedProject[] = [];

    for (const project of projects) {
      const canRetry = await this.autoInitializer.canRetry(project.path);
      if (canRetry) {
        needsReset.push(project);
      }
    }

    return needsReset;
  }

  /**
   * Nettoie les anciens états
   */
  async cleanupOldStates(): Promise<void> {
    await this.autoInitializer.cleanupOldFailures();

    // Nettoyer les projets qui n'existent plus
    const projects = await this.loadDetectedProjects();
    const validProjects: DetectedProject[] = [];

    for (const project of projects) {
      if (fs.existsSync(project.path)) {
        validProjects.push(project);
      }
    }

    if (validProjects.length !== projects.length) {
      await this.saveDetectedProjects(validProjects);
      console.log(`🧹 Projets nettoyés: ${projects.length - validProjects.length} supprimés`);
    }
  }
}
