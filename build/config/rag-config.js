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
        // Vérifier si l'objet limites a les propriétés min et max
        if (typeof limits === 'object' && 'min' in limits && 'max' in limits) {
            return value >= limits.min && value <= limits.max;
        }
        // Pour les limites sans min/max (comme file_size), on retourne true
        return true;
    }
    /**
     * Récupère les modèles disponibles pour un fournisseur
     */
    getProviderModels(provider) {
        return this.config.providers?.[provider]?.models || [];
    }
    /**
     * Vérifie si un fournisseur nécessite Ollama
     */
    requiresOllama(provider) {
        return this.config.providers?.[provider]?.requires_ollama || false;
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
        if (!limits || typeof limits !== 'object' || !('min' in limits) || !('max' in limits)) {
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
    /**
     * Récupère la configuration UI (interface utilisateur)
     */
    getUIConfig() {
        return this.config.ui || {
            human_progress: {
                enabled: true,
                type: 'bar',
                width: 40,
                realtime: true,
                update_interval: 100,
                show_eta: true,
                show_stats: true,
                show_phases: true,
                show_memory: false,
                show_cpu: false,
                colors: {
                    bar: '\x1b[32m',
                    percentage: '\x1b[36m',
                    eta: '\x1b[33m',
                    stats: '\x1b[35m',
                    phase: '\x1b[34m',
                    memory: '\x1b[31m',
                    cpu: '\x1b[31m'
                },
                output_format: 'text',
                output_target: 'stdout'
            },
            verbose_logging: false,
            format_output: true,
            interactive_mode: false
        };
    }
    /**
     * Récupère la configuration legacy (rétrocompatibilité)
     */
    getLegacyConfig() {
        return this.config.legacy || {
            activated_rag: {
                enabled: false,
                redirect_to_pipeline: true,
                error_message: 'activated_rag est désactivé. Utilisez le pipeline RAG explicite: init_rag → scan_rag → index_rag → query_rag',
                migration_guide: 'docs/MIGRATION_V2_V3.md'
            },
            compatibility_mode: false,
            preserve_old_data: true,
            migration_script: 'scripts/migrate-v1-to-v2.js'
        };
    }
    /**
     * Récupère la configuration des checkpoints
     */
    getCheckpointsConfig() {
        return this.config.checkpoints || {
            enabled: true,
            auto_save: true,
            save_interval: 30000,
            max_checkpoints: 10,
            retention_days: 7,
            compression: true,
            encryption: false,
            locations: {
                memory: './rag/db/checkpoints/memory',
                vector: './rag/db/checkpoints/vector',
                metadata: './rag/db/checkpoints/metadata'
            },
            recovery: {
                auto_recover: true,
                max_attempts: 3,
                validation_strictness: 'medium'
            }
        };
    }
    /**
     * Récupère la configuration de la file d'attente
     */
    getQueueConfig() {
        return this.config.queue || {
            max_size_per_project: 3,
            fifo_order: true,
            mutator_exclusivity: true,
            readonly_concurrent: 5,
            timeout: null,
            retry: {
                enabled: true,
                max_attempts: 3,
                backoff_factor: 2,
                initial_delay: 1000
            },
            stats: {
                enabled: true,
                retention_days: 30,
                aggregation_interval: 3600000
            }
        };
    }
    /**
     * Récupère la configuration du pipeline
     */
    getPipelineConfig() {
        return this.config.pipeline || {
            description: "Nouveau pipeline RAG avec file d'attente et checkpoints",
            phases: [
                {
                    name: 'init',
                    tool: 'init_rag',
                    description: 'Initialisation du projet RAG',
                    required: true,
                    depends_on: []
                },
                {
                    name: 'scan',
                    tool: 'scan_rag',
                    description: 'Scan des fichiers et analyse structurelle',
                    required: true,
                    depends_on: ['init']
                },
                {
                    name: 'prepare',
                    tool: 'index_rag',
                    description: 'Préparation et chunking des fichiers',
                    required: true,
                    depends_on: ['scan']
                },
                {
                    name: 'embed',
                    tool: 'index_rag',
                    description: 'Génération des embeddings',
                    required: true,
                    depends_on: ['prepare']
                },
                {
                    name: 'index',
                    tool: 'index_rag',
                    description: 'Indexation dans la base vectorielle',
                    required: true,
                    depends_on: ['embed']
                },
                {
                    name: 'query',
                    tool: 'query_rag',
                    description: 'Recherche sémantique',
                    required: false,
                    depends_on: ['index']
                }
            ],
            validation: {
                enabled: true,
                strict: false,
                schema_path: 'config/pipeline-schema.json'
            },
            orchestration: {
                auto_progress: true,
                parallel_phases: false,
                error_handling: 'continue',
                timeout: null
            }
        };
    }
    /**
     * Récupère la configuration de gestion d'erreurs
     */
    getErrorHandlingConfig() {
        return this.config.error_handling || {
            mcp_formatting: true,
            human_formatting: true,
            structured_logging: true,
            error_recovery: false,
            statistics: true,
            alert_thresholds: {
                error_rate: 0.1,
                consecutive_errors: 5,
                memory_usage: 90
            }
        };
    }
    /**
     * Vérifie si activated_rag est activé
     */
    isActivatedRagEnabled() {
        return this.config.legacy?.activated_rag?.enabled || false;
    }
    /**
     * Vérifie si la barre de progression humaine est activée
     */
    isHumanProgressEnabled() {
        return this.config.ui?.human_progress?.enabled || false;
    }
    /**
     * Vérifie si les checkpoints sont activés
     */
    areCheckpointsEnabled() {
        return this.config.checkpoints?.enabled || false;
    }
    /**
     * Vérifie si la file d'attente est activée
     */
    isQueueEnabled() {
        return this.config.queue !== undefined;
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
        if (!chunkSizeLimits || typeof chunkSizeLimits !== 'object' || !('min' in chunkSizeLimits) || !('max' in chunkSizeLimits)) {
            // Pas de logs sur stderr pour compatibilité MCP
            return false;
        }
        if (chunkSizeLimits.min >= chunkSizeLimits.max) {
            // Pas de logs sur stderr pour compatibilité MCP
            return false;
        }
        // Vérifier les fournisseurs
        const providers = config.providers ? Object.keys(config.providers) : [];
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
