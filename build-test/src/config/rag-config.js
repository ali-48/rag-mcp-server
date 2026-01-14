// src/config/rag-config.ts
// Gestionnaire de configuration RAG
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
/**
 * Classe pour charger et gérer la configuration RAG
 */
export class RagConfigManager {
    config;
    configPath;
    constructor(configPath) {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        this.configPath = configPath || join(__dirname, '..', '..', 'config', 'rag-config.json');
        this.config = this.loadConfig();
    }
    /**
     * Charge la configuration depuis le fichier JSON
     */
    loadConfig() {
        try {
            const configData = readFileSync(this.configPath, 'utf-8');
            return JSON.parse(configData);
        }
        catch (error) {
            // Pas de logs sur stderr pour compatibilité MCP
            throw new Error(`Impossible de charger la configuration RAG depuis ${this.configPath}`);
        }
    }
    /**
     * Récupère la configuration complète
     */
    getConfig() {
        return this.config;
    }
    /**
     * Récupère les valeurs par défaut
     */
    getDefaults() {
        return this.config.defaults;
    }
    /**
     * Récupère les limites pour un paramètre
     */
    getLimits(param) {
        return this.config.limits[param];
    }
    /**
     * Valide une valeur par rapport aux limites
     */
    validateValue(param, value) {
        const limits = this.getLimits(param);
        if (!limits) {
            // Pas de logs sur stderr pour compatibilité MCP
            return true; // Pas de validation si pas de limites
        }
        return value >= limits.min && value <= limits.max;
    }
    /**
     * Récupère les modèles disponibles pour un fournisseur
     */
    getProviderModels(provider) {
        return this.config.providers[provider]?.models || [];
    }
    /**
     * Vérifie si un fournisseur nécessite Ollama
     */
    requiresOllama(provider) {
        return this.config.providers[provider]?.requires_ollama || false;
    }
    /**
     * Récupère la configuration d'un fournisseur LLM
     */
    getLlmProviderConfig(provider) {
        return this.config.llm_providers?.[provider];
    }
    /**
     * Récupère la configuration de préparation
     */
    getPreparationConfig() {
        return this.config.preparation || {
            enable_llm_analysis: false,
            llm_provider: 'ollama',
            llm_model: 'llama3.2:3b',
            tasks: [],
            cache_enabled: true,
            cache_ttl_seconds: 3600,
            batch_size: 5,
            max_content_length: 10000
        };
    }
    /**
     * Vérifie si l'analyse LLM est activée
     */
    isLlmAnalysisEnabled() {
        return this.config.preparation?.enable_llm_analysis || false;
    }
    /**
     * Récupère les modèles LLM disponibles pour un fournisseur
     */
    getLlmProviderModels(provider) {
        return this.config.llm_providers?.[provider]?.models || [];
    }
    /**
     * Récupère la configuration pour un environnement
     */
    getEnvironmentConfig(env) {
        return this.config.environments[env];
    }
    /**
     * Récupère les patterns de fichiers par défaut
     */
    getFilePatterns() {
        return this.config.file_handling.default_patterns;
    }
    /**
     * Récupère les patterns à ignorer
     */
    getIgnorePatterns() {
        return this.config.file_handling.ignore_patterns;
    }
    /**
     * Récupère les extensions supportées
     */
    getSupportedExtensions() {
        return this.config.indexing.supported_extensions;
    }
    /**
     * Vérifie si une extension est supportée
     */
    isExtensionSupported(extension) {
        return this.config.indexing.supported_extensions.includes(extension);
    }
    /**
     * Récupère les paramètres de recherche par défaut
     */
    getSearchDefaults() {
        return {
            limit: this.config.search.default_limit,
            threshold: this.config.search.similarity_threshold,
            format: this.config.search.format_results,
            contextLines: this.config.search.include_context_lines
        };
    }
    /**
     * Applique les limites à une valeur
     */
    applyLimits(param, value) {
        const limits = this.getLimits(param);
        if (!limits) {
            // Pas de logs sur stderr pour compatibilité MCP
            return value;
        }
        if (value < limits.min) {
            // Pas de logs sur stderr pour compatibilité MCP
            return limits.min;
        }
        if (value > limits.max) {
            // Pas de logs sur stderr pour compatibilité MCP
            return limits.max;
        }
        return value;
    }
    /**
     * Récupère la configuration pour un outil spécifique
     */
    getToolConfig(toolName) {
        const defaults = this.getDefaults();
        const preparation = this.getPreparationConfig();
        switch (toolName) {
            case 'index_project':
            case 'update_project':
                return {
                    embedding_provider: defaults.embedding_provider,
                    embedding_model: defaults.embedding_model,
                    chunk_size: defaults.chunk_size,
                    chunk_overlap: defaults.chunk_overlap,
                    file_patterns: defaults.file_patterns,
                    recursive: defaults.recursive,
                    enable_llm_analysis: preparation.enable_llm_analysis,
                    llm_provider: preparation.llm_provider,
                    llm_model: preparation.llm_model
                };
            case 'search_code':
                return {
                    embedding_provider: defaults.embedding_provider,
                    embedding_model: defaults.embedding_model,
                    limit: defaults.search_limit,
                    threshold: defaults.search_threshold,
                    format_output: defaults.format_output
                };
            case 'manage_projects':
                return {
                // Pas de configuration spécifique pour manage_projects
                };
            default:
                return {};
        }
    }
}
/**
 * Instance singleton du gestionnaire de configuration
 */
let configManager = null;
/**
 * Obtient l'instance singleton du gestionnaire de configuration
 */
export function getRagConfigManager(configPath) {
    if (!configManager) {
        configManager = new RagConfigManager(configPath);
    }
    return configManager;
}
/**
 * Fonction utilitaire pour charger rapidement la configuration
 */
export function loadRagConfig(configPath) {
    return getRagConfigManager(configPath).getConfig();
}
/**
 * Test de la configuration
 */
export async function testRagConfig() {
    try {
        const configManager = getRagConfigManager();
        const config = configManager.getConfig();
        // Pas de logs sur stderr pour compatibilité MCP
        // Vérifier la version
        if (!config.version) {
            // Pas de logs sur stderr pour compatibilité MCP
            return false;
        }
        // Vérifier les valeurs par défaut
        const defaults = configManager.getDefaults();
        if (!defaults.embedding_provider) {
            // Pas de logs sur stderr pour compatibilité MCP
            return false;
        }
        // Vérifier les limites
        const chunkSizeLimits = configManager.getLimits('chunk_size');
        if (!chunkSizeLimits || chunkSizeLimits.min >= chunkSizeLimits.max) {
            // Pas de logs sur stderr pour compatibilité MCP
            return false;
        }
        // Vérifier les fournisseurs
        const providers = Object.keys(config.providers);
        if (providers.length === 0) {
            // Pas de logs sur stderr pour compatibilité MCP
            return false;
        }
        // Vérifier la configuration LLM si présente
        if (config.llm_providers) {
            const llmProviders = Object.keys(config.llm_providers);
            // Pas de logs sur stderr pour compatibilité MCP
            if (config.preparation) {
                // Pas de logs sur stderr pour compatibilité MCP
            }
        }
        // Pas de logs sur stderr pour compatibilité MCP
        return true;
    }
    catch (error) {
        // Pas de logs sur stderr pour compatibilité MCP
        return false;
    }
}
// Exécution automatique si ce fichier est exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
    // Pas de logs sur stderr pour compatibilité MCP
    testRagConfig().then(success => {
        if (success) {
            // Pas de logs sur stderr pour compatibilité MCP
            process.exit(0);
        }
        else {
            // Pas de logs sur stderr pour compatibilité MCP
            process.exit(1);
        }
    });
}
//# sourceMappingURL=rag-config.js.map