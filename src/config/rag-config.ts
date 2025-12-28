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
  
  limits: {
    chunk_size: { min: number; max: number; default: number };
    chunk_overlap: { min: number; max: number; default: number };
    search_limit: { min: number; max: number; default: number };
    search_threshold: { min: number; max: number; default: number };
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
      console.error(`❌ Erreur lors du chargement de la configuration RAG: ${error}`);
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
    
    if (value < limits.min) {
      console.warn(`⚠️ Valeur ${param} (${value}) inférieure au minimum (${limits.min}), utilisation du minimum`);
      return limits.min;
    }
    
    if (value > limits.max) {
      console.warn(`⚠️ Valeur ${param} (${value}) supérieure au maximum (${limits.max}), utilisation du maximum`);
      return limits.max;
    }
    
    return value;
  }
  
  /**
   * Récupère la configuration pour un outil spécifique
   */
  getToolConfig(toolName: string): any {
    const defaults = this.getDefaults();
    
    switch (toolName) {
      case 'index_project':
      case 'update_project':
        return {
          embedding_provider: defaults.embedding_provider,
          embedding_model: defaults.embedding_model,
          chunk_size: defaults.chunk_size,
          chunk_overlap: defaults.chunk_overlap,
          file_patterns: defaults.file_patterns,
          recursive: defaults.recursive
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
    
    console.log('🧪 Test de la configuration RAG...');
    
    // Vérifier la version
    if (!config.version) {
      console.error('❌ Version manquante dans la configuration');
      return false;
    }
    
    // Vérifier les valeurs par défaut
    const defaults = configManager.getDefaults();
    if (!defaults.embedding_provider) {
      console.error('❌ embedding_provider manquant dans les valeurs par défaut');
      return false;
    }
    
    // Vérifier les limites
    const chunkSizeLimits = configManager.getLimits('chunk_size');
    if (chunkSizeLimits.min >= chunkSizeLimits.max) {
      console.error('❌ Limites chunk_size invalides');
      return false;
    }
    
    // Vérifier les fournisseurs
    const providers = Object.keys(config.providers);
    if (providers.length === 0) {
      console.error('❌ Aucun fournisseur configuré');
      return false;
    }
    
    console.log('✅ Configuration RAG valide');
    console.log(`📊 Version: ${config.version}`);
    console.log(`📊 Fournisseurs disponibles: ${providers.join(', ')}`);
    console.log(`📊 Valeurs par défaut: embedding_provider=${defaults.embedding_provider}, chunk_size=${defaults.chunk_size}`);
    
    return true;
  } catch (error) {
    console.error('❌ Erreur lors du test de la configuration RAG:', error);
    return false;
  }
}

// Exécution automatique si ce fichier est exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🚀 Test de la configuration RAG...');
  
  testRagConfig().then(success => {
    if (success) {
      console.log('🎉 Test de configuration réussi !');
      process.exit(0);
    } else {
      console.error('❌ Test de configuration échoué');
      process.exit(1);
    }
  });
}
