// src/core/registry-v2.ts
// Système d'enregistrement automatique des outils v2.0
// Support des nouveaux outils activated_rag et recherche_rag
import { existsSync, readdirSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { toolRegistry } from "./tool-registry.js";
/**
 * Configuration par défaut v2.0
 */
const DEFAULT_CONFIG_V2 = {
    toolDirectories: [
        'build/tools/rag'
    ],
    toolFilePattern: /\.js$/,
    toolExportPattern: /(Tool|Handler)$/,
    verbose: true,
    legacyMode: false, // Par défaut, désactiver le mode rétrocompatible (suivre config v3)
    exposedTools: [
        'init_rag',
        'get_status',
        'query_rag',
        'cancel_task'
    ],
    hiddenTools: [
        'activated_rag',
        'scan_rag',
        'index_rag',
        'prepare_rag',
        'embed_rag',
        'list_tasks',
        'manage_projects',
        'pipeline_validator',
        'recherche_rag',
        'injection_rag',
        'index_project',
        'update_project',
        'search_code'
    ]
};
/**
 * Classe principale du registre automatique v2.0
 */
export class AutoRegistryV2 {
    config;
    registeredTools = new Set();
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG_V2, ...config };
    }
    /**
     * Découvre tous les modules d'outils dans les répertoires configurés
     */
    async discoverToolModules() {
        const modules = [];
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const projectRoot = join(__dirname, '..', '..');
        for (const dir of this.config.toolDirectories) {
            const fullPath = join(projectRoot, dir);
            if (!existsSync(fullPath)) {
                if (this.config.verbose) {
                    // Pas de logs sur stderr pour compatibilité MCP
                }
                continue;
            }
            const files = this.scanDirectory(fullPath);
            for (const file of files) {
                if (this.config.toolFilePattern.test(file)) {
                    try {
                        // Construire le chemin relatif correct depuis la racine du projet
                        const relativePath = join(dir, file).replace(/\\/g, '/');
                        const modulePath = `../../${relativePath}`.replace(/\.js$/, '.js');
                        const module = await import(modulePath);
                        modules.push({ path: relativePath, module });
                    }
                    catch (error) {
                        if (this.config.verbose) {
                            // Pas de logs sur stderr pour compatibilité MCP
                        }
                    }
                }
            }
        }
        return modules;
    }
    /**
     * Scanne récursivement un répertoire pour trouver des fichiers
     */
    scanDirectory(dir) {
        const files = [];
        try {
            const entries = readdirSync(dir);
            for (const entry of entries) {
                const fullPath = join(dir, entry);
                const stat = statSync(fullPath);
                if (stat.isDirectory()) {
                    files.push(...this.scanDirectory(fullPath).map(f => join(entry, f)));
                }
                else if (stat.isFile()) {
                    files.push(entry);
                }
            }
        }
        catch (error) {
            if (this.config.verbose) {
                // Pas de logs sur stderr pour compatibilité MCP
            }
        }
        return files;
    }
    /**
     * Extrait les outils d'un module
     */
    extractToolsFromModule(module) {
        const tools = [];
        // Chercher les paires tool/handler
        const toolEntries = Object.entries(module).filter(([key]) => this.config.toolExportPattern.test(key));
        // Grouper par nom d'outil (sans suffixe)
        const toolGroups = new Map();
        for (const [key, value] of toolEntries) {
            const baseName = key.replace(/(Tool|Handler)$/, '');
            if (!toolGroups.has(baseName)) {
                toolGroups.set(baseName, {});
            }
            const group = toolGroups.get(baseName);
            if (key.endsWith('Tool')) {
                group.tool = value;
            }
            else if (key.endsWith('Handler')) {
                group.handler = value;
            }
        }
        // Créer les paires complètes
        for (const [baseName, group] of toolGroups) {
            if (group.tool && group.handler) {
                tools.push({ tool: group.tool, handler: group.handler });
            }
            else if (this.config.verbose) {
                // Pas de logs sur stderr pour compatibilité MCP
            }
        }
        return tools;
    }
    /**
     * Applique la configuration de visibilité aux outils
     */
    applyVisibility(tool) {
        // Marquer les outils cachés
        if (this.config.hiddenTools?.includes(tool.name)) {
            return {
                ...tool,
                hidden: true
            };
        }
        // Marquer les outils exposés comme non cachés
        if (this.config.exposedTools?.includes(tool.name)) {
            return {
                ...tool,
                hidden: false
            };
        }
        // Par défaut, les outils sont visibles
        return tool;
    }
    /**
     * Enregistre automatiquement tous les outils découverts
     */
    async autoRegister() {
        if (this.config.verbose) {
            // Pas de logs sur stderr pour compatibilité MCP
        }
        const modules = await this.discoverToolModules();
        let registeredCount = 0;
        for (const { path, module } of modules) {
            const tools = this.extractToolsFromModule(module);
            for (const { tool, handler } of tools) {
                if (this.registeredTools.has(tool.name)) {
                    if (this.config.verbose) {
                        // Pas de logs sur stderr pour compatibilité MCP
                    }
                    continue;
                }
                try {
                    // Appliquer la configuration de visibilité
                    const visibleTool = this.applyVisibility(tool);
                    // Enregistrer l'outil
                    toolRegistry.register(visibleTool, handler);
                    this.registeredTools.add(tool.name);
                    registeredCount++;
                    if (this.config.verbose) {
                        // Pas de logs sur stderr pour compatibilité MCP
                    }
                }
                catch (error) {
                    if (this.config.verbose) {
                        // Pas de logs sur stderr pour compatibilité MCP
                    }
                }
            }
        }
        if (this.config.verbose) {
            // Pas de logs sur stderr pour compatibilité MCP
        }
        return registeredCount;
    }
    /**
     * Vérifie que tous les outils attendus sont enregistrés
     */
    verifyRegistration(expectedTools = []) {
        const missingTools = [];
        for (const toolName of expectedTools) {
            if (!toolRegistry.hasTool(toolName)) {
                missingTools.push(toolName);
            }
        }
        if (missingTools.length > 0) {
            // Pas de logs sur stderr pour compatibilité MCP
            return false;
        }
        // Pas de logs sur stderr pour compatibilité MCP
        return true;
    }
    /**
     * Liste tous les outils enregistrés avec leur visibilité
     */
    listRegisteredTools() {
        const allTools = toolRegistry.getTools();
        return allTools.map(tool => ({
            name: tool.name,
            hidden: !!tool.hidden
        }));
    }
    /**
     * Réinitialise le registre (pour les tests)
     */
    reset() {
        this.registeredTools.clear();
    }
    /**
     * Configure le registre à partir d'un fichier de configuration
     */
    configureFromConfig(configData) {
        if (configData.system) {
            // Créer une nouvelle configuration pour éviter les problèmes d'accès privé
            const newConfig = {
                ...this.config,
                legacyMode: configData.system.legacy_mode !== false,
                exposedTools: configData.system.exposed_tools || this.config.exposedTools,
                hiddenTools: configData.system.legacy_tools || this.config.hiddenTools
            };
            // Mettre à jour la configuration via une méthode interne
            this.updateConfig(newConfig);
        }
        if (this.config.verbose) {
            // Pas de logs sur stderr pour compatibilité MCP
        }
    }
    /**
     * Méthode interne pour mettre à jour la configuration
     */
    updateConfig(newConfig) {
        this.config = newConfig;
    }
    /**
     * Getter pour la configuration (pour usage externe)
     */
    getConfig() {
        return { ...this.config };
    }
}
/**
 * Instance singleton du registre automatique v2.0
 */
export const autoRegistryV2 = new AutoRegistryV2();
/**
 * Fonction utilitaire pour initialiser le registre automatique v2.0
 */
export async function initializeAutoRegistryV2(config) {
    const registry = new AutoRegistryV2(config);
    return await registry.autoRegister();
}
/**
 * Fonction utilitaire pour obtenir la liste des outils attendus v2.0
 */
export function getExpectedToolsV2() {
    return [
        // Nouveaux outils principaux (exposés)
        'init_rag',
        'get_status',
        'query_rag',
        'cancel_task',
        // Outils legacy (masqués par défaut)
        'activated_rag',
        'scan_rag',
        'index_rag',
        'prepare_rag',
        'embed_rag',
        'list_tasks',
        'manage_projects',
        'pipeline_validator',
        'recherche_rag',
        'injection_rag',
        'index_project',
        'update_project',
        'search_code'
    ];
}
/**
 * Fonction utilitaire pour migrer depuis l'ancien registre
 */
export async function migrateFromV1() {
    // Pas de logs sur stderr pour compatibilité MCP
    // Créer une nouvelle instance pour éviter les problèmes d'accès
    const registry = new AutoRegistryV2();
    // Désactiver temporairement le mode verbose
    const config = registry.getConfig();
    const oldVerbose = config.verbose;
    registry.configureFromConfig({
        system: {
            legacy_mode: config.legacyMode,
            exposed_tools: config.exposedTools,
            legacy_tools: config.hiddenTools
        }
    });
    // Réinitialiser le registre
    registry.reset();
    // Réenregistrer avec la nouvelle configuration
    await registry.autoRegister();
    // Pas de logs sur stderr pour compatibilité MCP
}
// Exécution automatique si ce fichier est exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
    // Pas de logs sur stderr pour compatibilité MCP
    initializeAutoRegistryV2({ verbose: false }).then(async (count) => {
        // Pas de logs sur stderr pour compatibilité MCP
        // Vérifier les outils attendus
        const expectedTools = getExpectedToolsV2();
        const registry = new AutoRegistryV2();
        const allRegistered = registry.verifyRegistration(expectedTools);
        // Lister les outils avec leur visibilité
        const toolsList = registry.listRegisteredTools();
        if (allRegistered) {
            // Pas de logs sur stderr pour compatibilité MCP
            process.exit(0);
        }
        else {
            // Pas de logs sur stderr pour compatibilité MCP
            process.exit(1);
        }
    }).catch(error => {
        // Pas de logs sur stderr pour compatibilité MCP
        process.exit(1);
    });
}
