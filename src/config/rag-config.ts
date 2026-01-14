// src/config/rag-config.ts
// Gestionnaire de configuration RAG

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

/**
 * Interface pour la configuration RAG v3.0
 */
export interface RagConfig {
  version: string;
  description: string;
  last_updated: string;

  system?: {
    mode: string;
    exposed_tools: string[];
    legacy_tools: string[];
    legacy_mode: boolean;
    auto_detect_vscode: boolean;
    auto_watch_files: boolean;
    auto_index_changes: boolean;
    vector_store: {
      backend: string;
      path: string;
    };
  };

  ui?: {
    human_progress: {
      enabled: boolean;
      type: string;
      width: number;
      realtime: boolean;
      update_interval: number;
      show_eta: boolean;
      show_stats: boolean;
      show_phases: boolean;
      show_memory: boolean;
      show_cpu: boolean;
      colors: {
        bar: string;
        percentage: string;
        eta: string;
        stats: string;
        phase: string;
        memory: string;
        cpu: string;
      };
      output_format: string;
      output_target: string;
    };
    verbose_logging: boolean;
    format_output: boolean;
    interactive_mode: boolean;
  };

  legacy?: {
    activated_rag: {
      enabled: boolean;
      redirect_to_pipeline: boolean;
      error_message: string;
      migration_guide: string;
    };
    compatibility_mode: boolean;
    preserve_old_data: boolean;
    migration_script: string;
  };

  checkpoints?: {
    enabled: boolean;
    auto_save: boolean;
    save_interval: number;
    max_checkpoints: number;
    retention_days: number;
    compression: boolean;
    encryption: boolean;
    locations: {
      memory: string;
      vector: string;
      metadata: string;
    };
    recovery: {
      auto_recover: boolean;
      max_attempts: number;
      validation_strictness: string;
    };
  };

  queue?: {
    max_size_per_project: number;
    fifo_order: boolean;
    mutator_exclusivity: boolean;
    readonly_concurrent: number;
    timeout: number | null;
    retry: {
      enabled: boolean;
      max_attempts: number;
      backoff_factor: number;
      initial_delay: number;
    };
    stats: {
      enabled: boolean;
      retention_days: number;
      aggregation_interval: number;
    };
  };

  defaults: {
    embedding_provider: string;
    embedding_model: string;
    chunk_size: number;
    chunk_overlap: number;
    file_patterns: string[];
    recursive: boolean;
    search_limit: number;
    search_threshold: number;
    format_output: boolean;
  };

  embedding_models?: {
    by_content_type: {
      code: {
        provider: string;
        model: string;
        dimension: number;
        description: string;
      };
      text: {
        provider: string;
        model: string;
        dimension: number;
        description: string;
      };
      config: {
        provider: string;
        model: string;
        dimension: number;
        description: string;
      };
      fallback: {
        provider: string;
        model: string;
        dimension: number;
        description: string;
      };
    };
    providers: {
      [key: string]: {
        description: string;
        models: string[];
        requires_ollama?: boolean;
        endpoint?: string;
        default_model?: string;
      };
    };
  };

  providers?: {
    [key: string]: {
      description: string;
      models: string[];
      requires_ollama?: boolean;
      endpoint?: string;
      default_model?: string;
    };
  };

  llm_providers?: {
    [key: string]: {
      description: string;
      models: string[];
      endpoint?: string;
      requires_ollama?: boolean;
      default_model?: string;
      max_tokens?: number;
      temperature?: number;
      timeout_ms?: number | null;
    };
  };

  preparation?: {
    enable_llm_analysis: boolean;
    llm_provider: string;
    llm_model: string;
    tasks: string[];
    cache_enabled: boolean;
    cache_ttl_seconds: number;
    batch_size: number;
    max_content_length: number;
  };

  phase0?: {
    enabled: boolean;
    description: string;
    components: {
      workspace_detector: {
        enabled: boolean;
        detect_vscode: boolean;
        detect_git: boolean;
        auto_select_project: boolean;
      };
      file_watcher: {
        enabled: boolean;
        library: string;
        watch_options: {
          ignored: string[];
          persistent: boolean;
          ignoreInitial: boolean;
          interval: number;
          binaryInterval: number;
        };
        debounce_ms: number;
        max_file_size_mb: number;
      };
      tree_sitter: {
        enabled: boolean;
        languages: string[];
        max_file_size_mb: number;
        timeout_ms?: number | null;
        fallback_to_regex: boolean;
      };
      chunking: {
        strategy: string;
        max_chunk_size: number;
        chunk_overlap: number;
        rules: {
          function_as_chunk: boolean;
          class_as_chunk: boolean;
          max_function_lines: number;
          max_class_methods: number;
          preserve_imports: boolean;
          include_comments: boolean;
          doc_by_paragraph: boolean;
          config_by_object: boolean;
        };
      };
      llm_enrichment: {
        enabled: boolean;
        provider: string;
        model: string;
        temperature: number;
        max_tokens: number;
        timeout_ms?: number | null;
        batch_size: number;
        features: string[];
        cache_enabled: boolean;
        cache_ttl_seconds: number;
      };
    };
    pipeline: {
      auto_start: boolean;
      concurrent_workers: number;
      max_queue_size: number;
      retry_attempts: number;
      retry_delay_ms: number;
    };
  };

  pipeline?: {
    description: string;
    phases: Array<{
      name: string;
      tool: string;
      description: string;
      required: boolean;
      depends_on: string[];
    }>;
    validation: {
      enabled: boolean;
      strict: boolean;
      schema_path: string;
    };
    orchestration: {
      auto_progress: boolean;
      parallel_phases: boolean;
      error_handling: string;
      timeout: number | null;
    };
  };

  limits: {
    chunk_size: { min: number; max: number; default: number };
    chunk_overlap: { min: number; max: number; default: number };
    search_limit: { min: number; max: number; default: number };
    search_threshold: { min: number; max: number; default: number };
    file_size?: { max_mb: number; warning_mb: number };
    concurrent?: {
      max_files: number;
      max_chunks: number;
      max_embeddings: number;
    };
    preparation_batch_size?: { min: number; max: number; default: number };
    preparation_timeout?: { min: number; max: number; default: number };
  };

  file_handling: {
    default_patterns: string[];
    ignore_patterns: string[];
    recursive_default: boolean;
    follow_symlinks?: boolean;
  };

  indexing: {
    max_file_size_mb: number;
    supported_extensions: string[];
    content_type_mapping?: {
      code: string[];
      doc: string[];
      config: string[];
      web: string[];
    };
    text_extensions: string[];
    code_extensions: string[];
  };

  search: {
    default_limit: number;
    max_limit: number;
    similarity_threshold: number;
    dynamic_threshold?: boolean;
    format_results: boolean;
    include_context_lines: number;
    hybrid_search?: {
      enabled: boolean;
      semantic_weight: number;
      text_weight: number;
    };
  };

  environments: {
    development: {
      embedding_provider: string;
      embedding_model?: string;
      verbose_logging: boolean;
      cache_enabled: boolean;
      batch_size?: number;
      ui_human_progress?: boolean;
    };
    production: {
      embedding_provider: string;
      embedding_model?: string;
      verbose_logging: boolean;
      cache_enabled: boolean;
      batch_size?: number;
      ui_human_progress?: boolean;
    };
  };

  error_handling?: {
    mcp_formatting: boolean;
    human_formatting: boolean;
    structured_logging: boolean;
    error_recovery: boolean;
    statistics: boolean;
    alert_thresholds: {
      error_rate: number;
      consecutive_errors: number;
      memory_usage: number;
    };
  };

  cache?: {
    enabled: boolean;
    ttl_seconds: number;
  };

  migration?: {
    from_version: string;
    auto_migrate: boolean;
    backup_old_config: boolean;
    preserve_legacy_tools: boolean;
    migration_script: string;
    breaking_changes?: string[];
  };

  phase0_3?: {
    enabled: boolean;
    description?: string;
    provider?: string;
    model?: string;
    temperature?: number;
    max_tokens?: number;
    timeout_ms?: number;
    batch_size?: number;
    features?: string[];
    cache_enabled?: boolean;
    cache_ttl_seconds?: number;
    provider_options?: Record<string, any>;
    limits?: {
      min_content_length?: number;
      max_content_length?: number;
      max_chunks_per_batch?: number;
      max_retries?: number;
      retry_delay_ms?: number;
    };
    metrics?: {
      enabled?: boolean;
      track_success_rate?: boolean;
      track_enrichment_time?: boolean;
      track_confidence_scores?: boolean;
      track_cache_hits?: boolean;
    };
  };
}

/**
 * Classe pour charger et gérer la configuration RAG
 */
export class RagConfigManager {
  private config: RagConfig;
  private configPath: string;

  constructor(configPath?: string) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    this.configPath = configPath || join(__dirname, '..', '..', 'config', 'rag-config.json');
    this.config = this.loadConfig();
  }

  /**
   * Charge la configuration depuis le fichier JSON
   */
  private loadConfig(): RagConfig {
    try {
      const configData = readFileSync(this.configPath, 'utf-8');
      return JSON.parse(configData) as RagConfig;
    } catch (error) {
      // Pas de logs sur stderr pour compatibilité MCP
      throw new Error(`Impossible de charger la configuration RAG depuis ${this.configPath}`);
    }
  }

  /**
   * Récupère la configuration complète
   */
  getConfig(): RagConfig {
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
  getLimits(param: keyof RagConfig['limits']) {
    return this.config.limits[param];
  }

  /**
   * Valide une valeur par rapport aux limites
   */
  validateValue(param: keyof RagConfig['limits'], value: number): boolean {
    const limits = this.getLimits(param);
    if (!limits) {
      // Pas de logs sur stderr pour compatibilité MCP
      return true; // Pas de validation si pas de limites
    }
    // Vérifier si l'objet limites a les propriétés min et max
    if (typeof limits === 'object' && 'min' in limits && 'max' in limits) {
      return value >= (limits as any).min && value <= (limits as any).max;
    }
    // Pour les limites sans min/max (comme file_size), on retourne true
    return true;
  }

  /**
   * Récupère les modèles disponibles pour un fournisseur
   */
  getProviderModels(provider: string): string[] {
    return this.config.providers?.[provider]?.models || [];
  }

  /**
   * Vérifie si un fournisseur nécessite Ollama
   */
  requiresOllama(provider: string): boolean {
    return this.config.providers?.[provider]?.requires_ollama || false;
  }

  /**
   * Récupère la configuration d'un fournisseur LLM
   */
  getLlmProviderConfig(provider: string) {
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
  isLlmAnalysisEnabled(): boolean {
    return this.config.preparation?.enable_llm_analysis || false;
  }

  /**
   * Récupère les modèles LLM disponibles pour un fournisseur
   */
  getLlmProviderModels(provider: string): string[] {
    return this.config.llm_providers?.[provider]?.models || [];
  }

  /**
   * Récupère la configuration pour un environnement
   */
  getEnvironmentConfig(env: 'development' | 'production') {
    return this.config.environments[env];
  }

  /**
   * Récupère les patterns de fichiers par défaut
   */
  getFilePatterns(): string[] {
    return this.config.file_handling.default_patterns;
  }

  /**
   * Récupère les patterns à ignorer
   */
  getIgnorePatterns(): string[] {
    return this.config.file_handling.ignore_patterns;
  }

  /**
   * Récupère les extensions supportées
   */
  getSupportedExtensions(): string[] {
    return this.config.indexing.supported_extensions;
  }

  /**
   * Vérifie si une extension est supportée
   */
  isExtensionSupported(extension: string): boolean {
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
  applyLimits(param: keyof RagConfig['limits'], value: number): number {
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
  getToolConfig(toolName: string): any {
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
  isActivatedRagEnabled(): boolean {
    return this.config.legacy?.activated_rag?.enabled || false;
  }

  /**
   * Vérifie si la barre de progression humaine est activée
   */
  isHumanProgressEnabled(): boolean {
    return this.config.ui?.human_progress?.enabled || false;
  }

  /**
   * Vérifie si les checkpoints sont activés
   */
  areCheckpointsEnabled(): boolean {
    return this.config.checkpoints?.enabled || false;
  }

  /**
   * Vérifie si la file d'attente est activée
   */
  isQueueEnabled(): boolean {
    return this.config.queue !== undefined;
  }
}

/**
 * Instance singleton du gestionnaire de configuration
 */
let configManager: RagConfigManager | null = null;

/**
 * Obtient l'instance singleton du gestionnaire de configuration
 */
export function getRagConfigManager(configPath?: string): RagConfigManager {
  if (!configManager) {
    configManager = new RagConfigManager(configPath);
  }
  return configManager;
}

/**
 * Fonction utilitaire pour charger rapidement la configuration
 */
export function loadRagConfig(configPath?: string): RagConfig {
  return getRagConfigManager(configPath).getConfig();
}

/**
 * Test de la configuration
 */
export async function testRagConfig(): Promise<boolean> {
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
  } catch (error) {
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
    } else {
      // Pas de logs sur stderr pour compatibilité MCP
      process.exit(1);
    }
  });
}
