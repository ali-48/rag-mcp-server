// src/core/registry.ts
// Système d'enregistrement automatique des outils
import { existsSync, readdirSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { toolRegistry } from "./tool-registry.js";
/**
 * Configuration par défaut
 */
const DEFAULT_CONFIG = {
    toolDirectories: [
        'build/tools/rag'
    ],
    toolFilePattern: /\.js$/,
    toolExportPattern: /(Tool|Handler)$/,
    verbose: true
};
/**
 * Classe principale du registre automatique
 */
export class AutoRegistry {
    config;
    registeredTools = new Set();
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
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
                    console.warn(`⚠️ Répertoire non trouvé: ${fullPath}`);
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
                            console.error(`❌ Erreur lors du chargement du module ${file}:`, error);
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
                console.error(`❌ Erreur lors du scan de ${dir}:`, error);
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
                console.warn(`⚠️ Paire incomplète pour ${baseName}:`, {
                    hasTool: !!group.tool,
                    hasHandler: !!group.handler
                });
            }
        }
        return tools;
    }
    /**
     * Enregistre automatiquement tous les outils découverts
     */
    async autoRegister() {
        if (this.config.verbose) {
            console.log('🔍 Découverte automatique des outils...');
        }
        const modules = await this.discoverToolModules();
        let registeredCount = 0;
        for (const { path, module } of modules) {
            const tools = this.extractToolsFromModule(module);
            for (const { tool, handler } of tools) {
                if (this.registeredTools.has(tool.name)) {
                    if (this.config.verbose) {
                        console.log(`⏭️ Outil déjà enregistré: ${tool.name}`);
                    }
                    continue;
                }
                try {
                    toolRegistry.register(tool, handler);
                    this.registeredTools.add(tool.name);
                    registeredCount++;
                    if (this.config.verbose) {
                        console.log(`✅ Outil enregistré automatiquement: ${tool.name} (${path})`);
                    }
                }
                catch (error) {
                    if (this.config.verbose) {
                        console.error(`❌ Erreur lors de l'enregistrement de ${tool.name}:`, error);
                    }
                }
            }
        }
        if (this.config.verbose) {
            console.log(`🎉 Enregistrement automatique terminé: ${registeredCount} outils enregistrés`);
            console.log(`📊 Total d'outils dans le registre: ${toolRegistry.size()}`);
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
            console.error(`❌ Outils manquants: ${missingTools.join(', ')}`);
            return false;
        }
        console.log(`✅ Tous les outils attendus sont enregistrés (${expectedTools.length} outils)`);
        return true;
    }
    /**
     * Liste tous les outils enregistrés
     */
    listRegisteredTools() {
        return Array.from(this.registeredTools);
    }
    /**
     * Réinitialise le registre (pour les tests)
     */
    reset() {
        this.registeredTools.clear();
    }
}
/**
 * Instance singleton du registre automatique
 */
export const autoRegistry = new AutoRegistry();
/**
 * Fonction utilitaire pour initialiser le registre automatique
 */
export async function initializeAutoRegistry(config) {
    const registry = new AutoRegistry(config);
    return await registry.autoRegister();
}
/**
 * Fonction utilitaire pour obtenir la liste des outils attendus
 */
export function getExpectedTools() {
    return [
        // Outils RAG (5 outils - avec injection_rag comme outil principal)
        'injection_rag', // Nouvel outil principal
        'index_project', // Alias déprécié (rétrocompatibilité)
        'search_code',
        'manage_projects',
        'update_project'
    ];
}
// Exécution automatique si ce fichier est exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🚀 Initialisation du registre automatique...');
    initializeAutoRegistry({ verbose: true }).then(async (count) => {
        console.log(`\n📊 Résumé:`);
        console.log(`- Outils enregistrés: ${count}`);
        console.log(`- Total dans ToolRegistry: ${toolRegistry.size()}`);
        // Vérifier les outils attendus
        const expectedTools = getExpectedTools();
        const registry = new AutoRegistry();
        const allRegistered = registry.verifyRegistration(expectedTools);
        if (allRegistered) {
            console.log('🎉 Tous les outils sont correctement enregistrés !');
            process.exit(0);
        }
        else {
            console.error('❌ Certains outils sont manquants');
            process.exit(1);
        }
    }).catch(error => {
        console.error('❌ Erreur lors de l\'initialisation:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=registry.js.map