// src/rag/daemon/multi-project-manager.ts
// Gestionnaire multi-projets avec support monorepo et isolation
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { PersistentStateManager } from './persistent-state.js';
/**
 * Gestionnaire multi-projets avec support monorepo
 */
export class MultiProjectManager extends EventEmitter {
    config;
    stateManager;
    projects = new Map();
    monorepoGroups = new Map();
    isolationViolations = [];
    scanInterval;
    resourceMonitors = new Map();
    constructor(config, stateManager) {
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
    async start() {
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
        }
        catch (error) {
            console.error('❌ Erreur démarrage MultiProjectManager:', error);
            return false;
        }
    }
    /**
     * Arrête le gestionnaire
     */
    async stop() {
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
    async performDetection() {
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
        }
        catch (error) {
            console.error('❌ Erreur détection projets:', error);
        }
    }
    /**
     * Traite un projet détecté
     */
    async processDetectedProject(rawProject) {
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
        const managedProject = {
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
    async initializeProject(project) {
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
        }
        catch (error) {
            project.status = 'failed';
            this.projects.set(project.id, project);
            this.emit('project-failed', project, error.message);
            console.error(`❌ Échec initialisation projet ${project.path}:`, error);
        }
    }
    /**
     * Détecte les monorepos
     */
    async detectMonorepos() {
        const projectsByPath = new Map();
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
    checkMonorepoPatterns(dirPath) {
        for (const pattern of this.config.monorepo.detectionPatterns) {
            if (pattern.endsWith('/')) {
                // Dossier
                const dirName = pattern.slice(0, -1);
                if (fs.existsSync(path.join(dirPath, dirName))) {
                    return true;
                }
            }
            else {
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
    async createMonorepoGroup(rootPath, firstProject) {
        const groupId = `monorepo-${this.hash(rootPath)}`;
        // Vérifier si le groupe existe déjà
        if (this.monorepoGroups.has(groupId)) {
            return;
        }
        // Trouver tous les projets dans ce monorepo
        const monorepoProjects = [];
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
        const group = {
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
    async createSharedResources(group) {
        if (!group.sharedResources)
            return;
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
        fs.writeFileSync(path.join(configPath, 'shared-config.json'), JSON.stringify(sharedConfig, null, 2));
        console.log(`📁 Ressources partagées créées pour ${group.id}`);
    }
    /**
     * Détermine le niveau d'isolation d'un projet
     */
    determineIsolationLevel(project) {
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
    async checkProjectResources(project) {
        // Vérifier le nombre de projets concurrents
        const activeProjects = Array.from(this.projects.values()).filter(p => p.status === 'active' || p.status === 'initializing').length;
        if (activeProjects >= this.config.isolation.maxConcurrentProjects) {
            const threshold = {
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
                const threshold = {
                    projectId: project.id,
                    resource: 'disk',
                    current: freeSpace,
                    threshold: 100 * 1024 * 1024,
                    timestamp: new Date().toISOString()
                };
                this.emit('resource-threshold', threshold);
                return false;
            }
        }
        catch {
            // Ignorer les erreurs de stat
        }
        return true;
    }
    /**
     * Crée la structure d'un projet
     */
    async createProjectStructure(project) {
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
        fs.writeFileSync(path.join(projectRagDir, 'config', 'project.json'), JSON.stringify(projectConfig, null, 2));
    }
    /**
     * Initialise la base de données d'un projet
     */
    async initializeProjectDatabase(project) {
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
    startResourceMonitoring() {
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
    stopResourceMonitoring() {
        for (const [key, interval] of this.resourceMonitors.entries()) {
            clearInterval(interval);
        }
        this.resourceMonitors.clear();
    }
    /**
     * Monitorer les ressources d'un projet
     */
    monitorProjectResources(project) {
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
    checkResourceThresholds(project, usage) {
        const thresholds = [
            { resource: 'memory', current: usage.memoryMb, threshold: 500, type: 'memory' },
            { resource: 'cpu', current: usage.cpuPercent, threshold: 80, type: 'cpu' },
            { resource: 'disk', current: usage.dbSizeMb, threshold: 100, type: 'disk' }
        ];
        for (const { resource, current, threshold, type } of thresholds) {
            if (current > threshold) {
                const resourceThreshold = {
                    projectId: project.id,
                    resource: type,
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
    updateProjectStates() {
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
    generateProjectId(projectPath) {
        return `project-${this.hash(projectPath)}`;
    }
    /**
     * Hash simple pour identification
     */
    hash(str) {
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
    getFreeDiskSpace(path) {
        // Simulation: retourne 1 GB
        return 1024 * 1024 * 1024;
    }
    /**
     * Obtient le chemin de la DB d'un projet
     */
    getProjectDbPath(project) {
        if (project.rootGroup && this.monorepoGroups.has(project.rootGroup)) {
            const group = this.monorepoGroups.get(project.rootGroup);
            if (group.sharedResources) {
                return path.join(group.sharedResources.dbPath, `${project.id}.sqlite`);
            }
        }
        return path.join(project.path, '.rag', 'db', 'project.sqlite');
    }
    /**
     * Récupère tous les projets
     */
    getAllProjects() {
        return Array.from(this.projects.values());
    }
    /**
     * Récupère un projet par ID
     */
    getProject(projectId) {
        return this.projects.get(projectId);
    }
    /**
     * Récupère les groupes monorepo
     */
    getMonorepoGroups() {
        return Array.from(this.monorepoGroups.values());
    }
    /**
     * Récupère les violations d'isolation
     */
    getIsolationViolations() {
        return [...this.isolationViolations];
    }
    /**
     * Enregistre une violation d'isolation
     */
    recordIsolationViolation(violation) {
        const fullViolation = {
            ...violation,
            timestamp: new Date().toISOString()
        };
        this.isolationViolations.push(fullViolation);
        this.emit('isolation-violation', fullViolation);
    }
    /**
     * Vérifie si un accès cross-projet est autorisé
     */
    isCrossProjectAccessAllowed(sourceProjectId, targetProjectId) {
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
    getStatus() {
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
//# sourceMappingURL=multi-project-manager.js.map