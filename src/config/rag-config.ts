// src/config/rag-config.ts
// Gestionnaire de configuration RAG

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

/**
 * Interface pour la configuration RAG
 */
export interface RagConfig {
  version: string;
  description: string;
  last_updated: string;

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

  providers: {
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
      timeout_ms?: number;
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

  limits: {
    chunk_size: { min: number; max: number; default: number };
    chunk_overlap: { min: number; max: number; default: number };
    search_limit: { min: number; max: number; default: number };
    search_threshold: { min: number; max: number; default: number };
    preparation_batch_size?: { min: number; max: number; default: number };
    preparation_timeout?: { min: number; max: number; default: number };
  };

  file_handling: {
    default_patterns: string[];
    ignore_patterns: string[];
    recursive_default: boolean;
  };

  indexing: {
    max_file_size_mb: number;
    supported_extensions: string[];
    text_extensions: string[];
    code_extensions: string[];
  };

  search: {
    default_limit: number;
    max_limit: number;
    similarity_threshold: number;
    format_results: boolean;
    include_context_lines: number;
  };

  environments: {
    development: {
      embedding_provider: string;
      verbose_logging: boolean;
      cache_enabled: boolean;
    };
    production: {
      embedding_provider: string;
      verbose_logging: boolean;
      cache_enabled: boolean;
    };
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
    return value >= limits.min && value <= limits.max;
  }

  /**
   * Récupère les modèles disponibles pour un fournisseur
   */
  getProviderModels(provider: string): string[] {
    return this.config.providers[provider]?.models || [];
  }

  /**
   * Vérifie si un fournisseur nécessite Ollama
   */
  requiresOllama(provider: string): boolean {
    return this.config.providers[provider]?.requires_ollama || false;
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
