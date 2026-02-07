// src/rag/daemon/multi-project-manager.ts
// Gestionnaire multi-projets avec support monorepo et isolation

import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { DetectedProject, PersistentStateManager } from './persistent-state.js';

/**
 * Configuration du gestionnaire multi-projets
 */
export interface MultiProjectConfig {
  detection: {
    enabled: boolean;
    scanIntervalMs: number;
    maxDepth: number;
    signatures: Array<{
      file: string;
      type: string;
      priority: number;
    }>;
  };
  monorepo: {
    detectionPatterns: string[];
    isolation: 'full' | 'shared_memory' | 'hybrid';
    sharedDbPath?: string;
  };
  isolation: {
    defaultLevel: 'full' | 'shared_memory';
    allowCrossProjectQueries: boolean;
    maxConcurrentProjects: number;
  };
}

/**
 * Projet avec métadonnées étendues
 */
export interface ManagedProject extends DetectedProject {
  id: string;
  status: 'pending' | 'initializing' | 'active' | 'inactive' | 'failed';
  lastActivity: string;
  resourceUsage?: {
    memoryMb: number;
    cpuPercent: number;
    dbSizeMb: number;
  };
  dependencies?: string[]; // IDs des projets dépendants
  isolationGroup?: string; // Pour regroupement d'isolation
}

/**
 * Groupe monorepo
 */
export interface MonorepoGroup {
  id: string;
  rootPath: string;
  projects: string[]; // IDs des projets
  isolationLevel: 'full' | 'shared_memory';
  sharedResources?: {
    dbPath: string;
    cachePath: string;
    configPath: string;
  };
}

/**
 * Événements du gestionnaire
 */
export interface MultiProjectEvents {
  'project-detected': (project: ManagedProject) => void;
  'project-initialized': (project: ManagedProject) => void;
  'project-failed': (project: ManagedProject, error: string) => void;
  'monorepo-detected': (group: MonorepoGroup) => void;
  'isolation-violation': (violation: IsolationViolation) => void;
  'resource-threshold': (threshold: ResourceThreshold) => void;
}

/**
 * Violation d'isolation
 */
export interface IsolationViolation {
  projectId: string;
  violation: string;
  attemptedAccess: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Seuil de ressources
 */
export interface ResourceThreshold {
  projectId: string;
  resource: 'memory' | 'cpu' | 'disk' | 'concurrent';
  current: number;
  threshold: number;
  timestamp: string;
}

/**
 * Gestionnaire multi-projets avec support monorepo
 */
export class MultiProjectManager extends EventEmitter {
  private config: MultiProjectConfig;
  private stateManager: PersistentStateManager;
  private projects: Map<string, ManagedProject> = new Map();
  private monorepoGroups: Map<string, MonorepoGroup> = new Map();
  private isolationViolations: IsolationViolation[] = [];
  private scanInterval?: NodeJS.Timeout;
  private resourceMonitors: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    config?: Partial<MultiProjectConfig>,
    stateManager?: PersistentStateManager
  ) {
    super();

    this.config = {
      detection: {
        enabled: true,
        scanIntervalMs: 30000, // 30 secondes
        maxDepth: 4,
        signatures: [
          { file: 'package.json', type: 'node', priority: 1 },
          { file: 'pyproject.toml', type: 'python', priority: 2 },
          { file: 'Cargo.toml', type: 'rust', priority: 3 },
          { file: 'go.mod', type: 'go', priority: 4 },
          { file: 'pom.xml', type: 'java', priority: 5 },
          { file: '.git', type: 'git', priority: 0 }
        ]
      },
      monorepo: {
        detectionPatterns: ['packages/', 'workspaces/', 'lerna.json', 'pnpm-workspace.yaml', 'rush.json'],
        isolation: 'hybrid',
        sharedDbPath: '/rag/db/shared'
      },
      isolation: {
        defaultLevel: 'full',
        allowCrossProjectQueries: false,
        maxConcurrentProjects: 10
      },
      ...config
    };

    this.stateManager = stateManager || new PersistentStateManager('/rag/state');
  }

  /**
   * Démarre le gestionnaire
   */
  async start(): Promise<boolean> {
    console.log('🚀 Démarrage MultiProjectManager...');

    try {
      // Détection initiale
      if (this.config.detection.enabled) {
        await this.performDetection();

        // Détection périodique
        this.scanInterval = setInterval(() => {
          this.performDetection();
        }, this.config.detection.scanIntervalMs);
      }

      // Démarrer le monitoring des ressources
      this.startResourceMonitoring();

      console.log(`✅ MultiProjectManager démarré, ${this.projects.size} projets détectés`);
      return true;

    } catch (error: any) {
      console.error('❌ Erreur démarrage MultiProjectManager:', error);
      return false;
    }
  }

  /**
   * Arrête le gestionnaire
   */
  async stop(): Promise<boolean> {
    console.log('🛑 Arrêt MultiProjectManager...');

    // Arrêter la détection
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = undefined;
    }

    // Arrêter le monitoring des ressources
    this.stopResourceMonitoring();

    console.log('✅ MultiProjectManager arrêté');
    return true;
  }

  /**
   * Effectue la détection des projets
   */
  private async performDetection(): Promise<void> {
    try {
      const workspacePath = process.cwd();
      console.log(`🔍 Détection projets dans: ${workspacePath}`);

      // Détecter les projets via le state manager
      const detectedProjects = await this.stateManager.detectAndInitializeAll(workspacePath);

      // Traiter chaque projet détecté
      for (const rawProject of detectedProjects) {
        await this.processDetectedProject(rawProject);
      }

      // Détecter les monorepos
      await this.detectMonorepos();

      // Mettre à jour les états
      this.updateProjectStates();

    } catch (error: any) {
      console.error('❌ Erreur détection projets:', error);
    }
  }

  /**
   * Traite un projet détecté
   */
  private async processDetectedProject(rawProject: DetectedProject): Promise<void> {
    const projectId = this.generateProjectId(rawProject.path);

    // Vérifier si le projet existe déjà
    const existingProject = this.projects.get(projectId);
    if (existingProject) {
      // Mettre à jour le projet existant
      existingProject.lastActivity = new Date().toISOString();
      this.projects.set(projectId, existingProject);
      return;
    }

    // Créer un nouveau projet managé
    const managedProject: ManagedProject = {
      ...rawProject,
      id: projectId,
      status: 'pending',
      lastActivity: new Date().toISOString()
    };

    // Déterminer le niveau d'isolation
    managedProject.isolationLevel = this.determineIsolationLevel(managedProject);

    // Ajouter au registre
    this.projects.set(projectId, managedProject);

    // Émettre l'événement
    this.emit('project-detected', managedProject);

    console.log(`📁 Projet détecté: ${managedProject.path} (${managedProject.type})`);

    // Initialiser le projet
    await this.initializeProject(managedProject);
  }

  /**
   * Initialise un projet
   */
  private async initializeProject(project: ManagedProject): Promise<void> {
    try {
      project.status = 'initializing';

      // Vérifier les ressources
      const hasResources = await this.checkProjectResources(project);
      if (!hasResources) {
        throw new Error('Ressources insuffisantes pour le projet');
      }

      // Créer la structure du projet
      await this.createProjectStructure(project);

      // Initialiser la base de données
      await this.initializeProjectDatabase(project);

      // Mettre à jour l'état
      project.status = 'active';
      project.lastActivity = new Date().toISOString();

      this.projects.set(project.id, project);
      this.emit('project-initialized', project);

      console.log(`✅ Projet initialisé: ${project.path}`);

    } catch (error: any) {
      project.status = 'failed';
      this.projects.set(project.id, project);

      this.emit('project-failed', project, error.message);
      console.error(`❌ Échec initialisation projet ${project.path}:`, error);
    }
  }

  /**
   * Détecte les monorepos
   */
  private async detectMonorepos(): Promise<void> {
    const projectsByPath = new Map<string, ManagedProject>();

    // Grouper les projets par chemin parent
    for (const project of this.projects.values()) {
      const parentPath = path.dirname(project.path);
      projectsByPath.set(parentPath, project);
    }

    // Vérifier les patterns monorepo
    for (const [parentPath, project] of projectsByPath.entries()) {
      const isMonorepo = this.checkMonorepoPatterns(parentPath);

      if (isMonorepo) {
        await this.createMonorepoGroup(parentPath, project);
      }
    }
  }

  /**
   * Vérifie les patterns monorepo
   */
  private checkMonorepoPatterns(dirPath: string): boolean {
    for (const pattern of this.config.monorepo.detectionPatterns) {
      if (pattern.endsWith('/')) {
        // Dossier
        const dirName = pattern.slice(0, -1);
        if (fs.existsSync(path.join(dirPath, dirName))) {
          return true;
        }
      } else {
        // Fichier
        if (fs.existsSync(path.join(dirPath, pattern))) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Crée un groupe monorepo
   */
  private async createMonorepoGroup(rootPath: string, firstProject: ManagedProject): Promise<void> {
    const groupId = `monorepo-${this.hash(rootPath)}`;

    // Vérifier si le groupe existe déjà
    if (this.monorepoGroups.has(groupId)) {
      return;
    }

    // Trouver tous les projets dans ce monorepo
    const monorepoProjects: string[] = [];
    for (const project of this.projects.values()) {
      if (project.path.startsWith(rootPath)) {
        monorepoProjects.push(project.id);
      }
    }

    // Déterminer le niveau d'isolation
    const isolationLevel = this.config.monorepo.isolation === 'hybrid'
      ? 'shared_memory'
      : this.config.monorepo.isolation;

    // Créer le groupe
    const group: MonorepoGroup = {
      id: groupId,
      rootPath,
      projects: monorepoProjects,
      isolationLevel,
      sharedResources: this.config.monorepo.sharedDbPath ? {
        dbPath: path.join(this.config.monorepo.sharedDbPath, groupId),
        cachePath: path.join(rootPath, '.rag', 'cache'),
        configPath: path.join(rootPath, '.rag', 'config')
      } : undefined
    };

    // Créer les ressources partagées
    if (group.sharedResources) {
      await this.createSharedResources(group);
    }

    // Mettre à jour les projets avec le groupe
    for (const projectId of monorepoProjects) {
      const project = this.projects.get(projectId);
      if (project) {
        project.rootGroup = groupId;
        project.isolationLevel = isolationLevel;
        this.projects.set(projectId, project);
      }
    }

    // Ajouter le groupe
    this.monorepoGroups.set(groupId, group);

    this.emit('monorepo-detected', group);
    console.log(`🏢 Monorepo détecté: ${rootPath} (${monorepoProjects.length} projets)`);
  }

  /**
   * Crée les ressources partagées pour un monorepo
   */
  private async createSharedResources(group: MonorepoGroup): Promise<void> {
    if (!group.sharedResources) return;

    const { dbPath, cachePath, configPath } = group.sharedResources;

    // Créer les dossiers
    [dbPath, cachePath, configPath].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Créer la configuration partagée
    const sharedConfig = {
      monorepoId: group.id,
      rootPath: group.rootPath,
      projects: group.projects,
      isolationLevel: group.isolationLevel,
      createdAt: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(configPath, 'shared-config.json'),
      JSON.stringify(sharedConfig, null, 2)
    );

    console.log(`📁 Ressources partagées créées pour ${group.id}`);
  }

  /**
   * Détermine le niveau d'isolation d'un projet
   */
  private determineIsolationLevel(project: ManagedProject): 'full' | 'shared_memory' {
    // Si le projet a déjà un rootGroup, utiliser shared_memory
    if (project.rootGroup) {
      return 'shared_memory';
    }

    // Sinon, utiliser la configuration par défaut
    return this.config.isolation.defaultLevel;
  }

  /**
   * Vérifie les ressources d'un projet
   */
  private async checkProjectResources(project: ManagedProject): Promise<boolean> {
    // Vérifier le nombre de projets concurrents
    const activeProjects = Array.from(this.projects.values()).filter(p =>
      p.status === 'active' || p.status === 'initializing'
    ).length;

    if (activeProjects >= this.config.isolation.maxConcurrentProjects) {
      const threshold: ResourceThreshold = {
        projectId: project.id,
        resource: 'concurrent',
        current: activeProjects,
        threshold: this.config.isolation.maxConcurrentProjects,
        timestamp: new Date().toISOString()
      };

      this.emit('resource-threshold', threshold);
      return false;
    }

    // Vérifier l'espace disque
    try {
      const stats = fs.statSync(project.path);
      const freeSpace = this.getFreeDiskSpace(project.path);

      if (freeSpace < 100 * 1024 * 1024) { // 100 MB minimum
        const threshold: ResourceThreshold = {
          projectId: project.id,
          resource: 'disk',
          current: freeSpace,
          threshold: 100 * 1024 * 1024,
          timestamp: new Date().toISOString()
        };

        this.emit('resource-threshold', threshold);
        return false;
      }
    } catch {
      // Ignorer les erreurs de stat
    }

    return true;
  }

  /**
   * Crée la structure d'un projet
   */
  private async createProjectStructure(project: ManagedProject): Promise<void> {
    const projectRagDir = path.join(project.path, '.rag');

    if (!fs.existsSync(projectRagDir)) {
      fs.mkdirSync(projectRagDir, { recursive: true });
    }

    // Créer les sous-dossiers
    const subdirs = ['db', 'cache', 'logs', 'config'];
    subdirs.forEach(subdir => {
      const dirPath = path.join(projectRagDir, subdir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });

    // Créer la configuration du projet
    const projectConfig = {
      id: project.id,
      path: project.path,
      type: project.type,
      isolationLevel: project.isolationLevel,
      rootGroup: project.rootGroup,
      createdAt: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(projectRagDir, 'config', 'project.json'),
      JSON.stringify(projectConfig, null, 2)
    );
  }

  /**
   * Initialise la base de données d'un projet
   */
  private async initializeProjectDatabase(project: ManagedProject): Promise<void> {
    const dbPath = this.getProjectDbPath(project);

    // Créer la base de données SQLite
    // Note: Dans une implémentation réelle, on utiliserait une lib SQLite
    console.log(`🗄️  DB initialisée pour ${project.id}: ${dbPath}`);

    // Pour l'instant, on crée juste un fichier vide
    fs.writeFileSync(dbPath, '');
  }

  /**
   * Démarre le monitoring des ressources
   */
  private startResourceMonitoring(): void {
    // Monitorer chaque projet actif
    const monitorInterval = setInterval(() => {
      for (const project of this.projects.values()) {
        if (project.status === 'active') {
          this.monitorProjectResources(project);
        }
      }
    }, 10000); // Toutes les 10 secondes

    this.resourceMonitors.set('global', monitorInterval);
  }

  /**
   * Arrête le monitoring des ressources
   */
  private stopResourceMonitoring(): void {
    for (const [key, interval] of this.resourceMonitors.entries()) {
      clearInterval(interval);
    }
    this.resourceMonitors.clear();
  }

  /**
   * Monitorer les ressources d'un projet
   */
  private monitorProjectResources(project: ManagedProject): void {
    // Simuler le monitoring des ressources
    // Dans une implémentation réelle, on utiliserait des APIs système
    const mockUsage = {
      memoryMb: Math.floor(Math.random() * 100) + 50,
      cpuPercent: Math.floor(Math.random() * 30) + 5,
      dbSizeMb: Math.floor(Math.random() * 10) + 1
    };

    project.resourceUsage = mockUsage;
    this.projects.set(project.id, project);

    // Vérifier les seuils
    this.checkResourceThresholds(project, mockUsage);
  }

  /**
   * Vérifie les seuils de ressources
   */
  private checkResourceThresholds(project: ManagedProject, usage: any): void {
    const thresholds = [
      { resource: 'memory', current: usage.memoryMb, threshold: 500, type: 'memory' },
      { resource: 'cpu', current: usage.cpuPercent, threshold: 80, type: 'cpu' },
      { resource: 'disk', current: usage.dbSizeMb, threshold: 100, type: 'disk' }
    ];

    for (const { resource, current, threshold, type } of thresholds) {
      if (current > threshold) {
        const resourceThreshold: ResourceThreshold = {
          projectId: project.id,
          resource: type as 'memory' | 'cpu' | 'disk',
          current,
          threshold,
          timestamp: new Date().toISOString()
        };

        this.emit('resource-threshold', resourceThreshold);
      }
    }
  }

  /**
   * Met à jour les états des projets
   */
  private updateProjectStates(): void {
    const now = Date.now();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

    for (const project of this.projects.values()) {
      if (project.status === 'active') {
        const lastActivity = new Date(project.lastActivity).getTime();
        if (now - lastActivity > inactiveThreshold) {
          project.status = 'inactive';
          this.projects.set(project.id, project);
        }
      }
    }
  }

  /**
   * Génère un ID unique pour un projet
   */
  private generateProjectId(projectPath: string): string {
    return `project-${this.hash(projectPath)}`;
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
   * Obtient l'espace disque libre (simulé)
   */
  private getFreeDiskSpace(path: string): number {
    // Simulation: retourne 1 GB
    return 1024 * 1024 * 1024;
  }

  /**
   * Obtient le chemin de la DB d'un projet
   */
  private getProjectDbPath(project: ManagedProject): string {
    if (project.rootGroup && this.monorepoGroups.has(project.rootGroup)) {
      const group = this.monorepoGroups.get(project.rootGroup)!;
      if (group.sharedResources) {
        return path.join(group.sharedResources.dbPath, `${project.id}.sqlite`);
      }
    }

    return path.join(project.path, '.rag', 'db', 'project.sqlite');
  }

  /**
   * Récupère tous les projets
   */
  getAllProjects(): ManagedProject[] {
    return Array.from(this.projects.values());
  }

  /**
   * Récupère un projet par ID
   */
  getProject(projectId: string): ManagedProject | undefined {
    return this.projects.get(projectId);
  }

  /**
   * Récupère les groupes monorepo
   */
  getMonorepoGroups(): MonorepoGroup[] {
    return Array.from(this.monorepoGroups.values());
  }

  /**
   * Récupère les violations d'isolation
   */
  getIsolationViolations(): IsolationViolation[] {
    return [...this.isolationViolations];
  }

  /**
   * Enregistre une violation d'isolation
   */
  recordIsolationViolation(violation: Omit<IsolationViolation, 'timestamp'>): void {
    const fullViolation: IsolationViolation = {
      ...violation,
      timestamp: new Date().toISOString()
    };

    this.isolationViolations.push(fullViolation);
    this.emit('isolation-violation', fullViolation);
  }

  /**
   * Vérifie si un accès cross-projet est autorisé
   */
  isCrossProjectAccessAllowed(sourceProjectId: string, targetProjectId: string): boolean {
    if (!this.config.isolation.allowCrossProjectQueries) {
      return false;
    }

    const sourceProject = this.projects.get(sourceProjectId);
    const targetProject = this.projects.get(targetProjectId);

    if (!sourceProject || !targetProject) {
      return false;
    }

    // Même groupe monorepo = accès autorisé
    if (sourceProject.rootGroup && sourceProject.rootGroup === targetProject.rootGroup) {
      return true;
    }

    // Même niveau d'isolation shared_memory = accès autorisé
    if (sourceProject.isolationLevel === 'shared_memory' &&
      targetProject.isolationLevel === 'shared_memory') {
      return true;
    }

    return false;
  }

  /**
   * Récupère l'état du gestionnaire
   */
  getStatus(): {
    totalProjects: number;
    activeProjects: number;
    monorepoGroups: number;
    isolationViolations: number;
    resourceThresholds: number;
  } {
    const activeProjects = Array.from(this.projects.values())
      .filter(p => p.status === 'active').length;

    return {
      totalProjects: this.projects.size,
      activeProjects,
      monorepoGroups: this.monorepoGroups.size,
      isolationViolations: this.isolationViolations.length,
      resourceThresholds: this.getAllProjects()
        .filter(p => p.resourceUsage &&
          (p.resourceUsage.memoryMb > 500 ||
            p.resourceUsage.cpuPercent > 80 ||
            p.resourceUsage.dbSizeMb > 100)).length
    };
  }
}
