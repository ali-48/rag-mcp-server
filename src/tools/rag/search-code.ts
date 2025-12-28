// src/tools/rag/search-code.ts
// Outil: search_code - Recherche sémantique dans le code indexé

import { getRagConfigManager } from "../../config/rag-config.js";
import { ToolDefinition, ToolHandler } from "../../core/tool-registry.js";
import { searchCode } from "../../rag/searcher.js";
import { setEmbeddingProvider } from "../../rag/vector-store.js";

/**
 * Définition de l'outil search_code
 */
export const searchCodeTool: ToolDefinition = {
  name: "search_code",
  description: "Recherche sémantique dans le code indexé avec options RAG",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Requête de recherche sémantique"
      },
      project_filter: {
        type: "string",
        description: "Filtrer par chemin de projet spécifique"
      },
      limit: {
        type: "number",
        description: "Nombre maximum de résultats",
        default: 10,
        minimum: 1,
        maximum: 50
      },
      threshold: {
        type: "number",
        description: "Seuil de similarité (0.0 à 1.0)",
        default: 0,
        minimum: 0,
        maximum: 1
      },
      format_output: {
        type: "boolean",
        description: "Formater la sortie pour l'affichage",
        default: true
      },
      embedding_provider: {
        type: "string",
        description: "Fournisseur d'embeddings pour la recherche (fake, ollama, sentence-transformers)",
        enum: ["fake", "ollama", "sentence-transformers"],
        default: "fake"
      },
      embedding_model: {
        type: "string",
        description: "Modèle d'embeddings (pour Ollama: 'nomic-embed-text', 'all-minilm', etc.)",
        default: "nomic-embed-text"
      }
    },
    required: ["query"]
  },
};

/**
 * Handler pour l'outil search_code
 */
export const searchCodeHandler: ToolHandler = async (args) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error("The 'query' parameter is required and must be a string");
  }

  // Charger la configuration
  const configManager = getRagConfigManager();
  const defaults = configManager.getDefaults();
  const searchDefaults = configManager.getSearchDefaults();
  
  // Utiliser les valeurs par défaut de la configuration si non spécifiées
  const embedding_provider = args.embedding_provider || defaults.embedding_provider;
  const embedding_model = args.embedding_model || defaults.embedding_model;
  const limit = configManager.applyLimits('search_limit',
    args.limit || searchDefaults.limit
  );
  const threshold = configManager.applyLimits('search_threshold',
    args.threshold || searchDefaults.threshold
  );
  const format_output = args.format_output !== undefined ? args.format_output : searchDefaults.format;

  // Configurer le fournisseur d'embeddings
  setEmbeddingProvider(embedding_provider, embedding_model);

  const options = {
    projectFilter: args.project_filter,
    limit: limit,
    threshold: threshold
  };

  try {
    const searchResult = await searchCode(args.query, options);
    
    // Formater la sortie si demandé
    if (format_output !== false) {
      const formatted = `Recherche RAG: "${args.query}"\n` +
        `Configuration: provider=${embedding_provider}, model=${embedding_model}\n` +
        `Résultats: ${searchResult.totalResults}\n` +
        `Temps d'exécution: ${searchResult.stats?.executionTime || 0}ms\n` +
        `Projets scannés: ${searchResult.stats?.projectsScanned || 0}\n` +
        `Limite: ${limit}, Seuil: ${threshold}\n\n` +
        searchResult.results.map((r: any, i: number) => 
          `${i + 1}. ${r.filePath} (score: ${(r.score * 100).toFixed(2)}%)\n` +
          `   Projet: ${r.metadata.projectPath}\n` +
          `   Contenu: ${r.content.substring(0, 100)}...`
        ).join('\n\n');
      
      return { content: [{ type: "text", text: formatted }] };
    }
    
    return { 
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          ...searchResult,
          config_used: {
            embedding_provider,
            embedding_model,
            limit,
            threshold,
            format_output
          }
        }, null, 2) 
      }] 
    };
  } catch (error) {
    console.error("Error in search_code tool:", error);
    throw error;
  }
};

/**
 * Test de l'outil (pour usage en développement)
 */
export async function testSearchCode() {
  console.log("Testing search_code tool...");
  
  try {
    // D'abord indexer un projet de test
    const testProjectPath = "/tmp/test-project-search";
    const fs = await import('fs');
    const path = await import('path');
    
    if (!fs.existsSync(testProjectPath)) {
      fs.mkdirSync(testProjectPath, { recursive: true });
    }
    
    // Créer un fichier de test avec du contenu spécifique
    const testFile = path.join(testProjectPath, "search-test.js");
    fs.writeFileSync(testFile, "// This is a test file for search functionality\nconst searchQuery = 'find me';\nconsole.log('Search test successful');");
    
    // Indexer le projet
    const { indexProjectHandler } = await import("./index-project.js");
    await indexProjectHandler({
      project_path: testProjectPath,
      file_patterns: ["**/*.js"],
      recursive: true,
      embedding_provider: "fake"
    });
    
    console.log(`✅ Indexed test project at: ${testProjectPath}`);
    
    // Rechercher
    const result = await searchCodeHandler({
      query: "search test",
      format_output: false,
      embedding_provider: "fake"
    });
    
    console.log("✅ Test passed:", result ? "Oui" : "Non");
    
    // Nettoyer
    fs.rmSync(testProjectPath, { recursive: true, force: true });
    
    return result;
  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  }
}
