// src/tools/rag/index-project.ts
// Outil: index_project - Indexer un projet complet pour la recherche sémantique
import { getRagConfigManager } from "../../config/rag-config.js";
import { indexProject } from "../../rag/indexer.js";
import { setEmbeddingProvider } from "../../rag/vector-store.js";
/**
 * Définition de l'outil index_project
 */
export const indexProjectTool = {
    name: "index_project",
    description: "Indexer un projet complet pour la recherche sémantique avec options RAG",
    inputSchema: {
        type: "object",
        properties: {
            project_path: {
                type: "string",
                description: "Chemin absolu vers le projet à indexer"
            },
            file_patterns: {
                type: "array",
                items: { type: "string" },
                description: "Patterns de fichiers à inclure (ex: ['**/*.py', '**/*.js'])",
                default: ["**/*.{js,ts,py,md,txt,json,yaml,yml,html,css,scss}"]
            },
            recursive: {
                type: "boolean",
                description: "Parcourir les sous-dossiers récursivement",
                default: true
            },
            embedding_provider: {
                type: "string",
                description: "Fournisseur d'embeddings (fake, ollama, sentence-transformers)",
                enum: ["fake", "ollama", "sentence-transformers"],
                default: "fake"
            },
            embedding_model: {
                type: "string",
                description: "Modèle d'embeddings (pour Ollama: 'nomic-embed-text', 'all-minilm', etc.)",
                default: "nomic-embed-text"
            },
            chunk_size: {
                type: "number",
                description: "Taille des chunks pour le découpage (en tokens)",
                default: 1000,
                minimum: 100,
                maximum: 10000
            },
            chunk_overlap: {
                type: "number",
                description: "Chevauchement entre les chunks (en tokens)",
                default: 200,
                minimum: 0,
                maximum: 1000
            }
        },
        required: ["project_path"]
    },
};
/**
 * Handler pour l'outil index_project
 */
export const indexProjectHandler = async (args) => {
    if (!args.project_path || typeof args.project_path !== 'string') {
        throw new Error("The 'project_path' parameter is required and must be a string");
    }
    // Charger la configuration
    const configManager = getRagConfigManager();
    const defaults = configManager.getDefaults();
    // Utiliser les valeurs par défaut de la configuration si non spécifiées
    const file_patterns = args.file_patterns || defaults.file_patterns;
    const recursive = args.recursive !== undefined ? args.recursive : defaults.recursive;
    const embedding_provider = args.embedding_provider || defaults.embedding_provider;
    const embedding_model = args.embedding_model || defaults.embedding_model;
    // Appliquer les limites aux valeurs numériques
    const chunk_size = configManager.applyLimits('chunk_size', args.chunk_size || defaults.chunk_size);
    const chunk_overlap = configManager.applyLimits('chunk_overlap', args.chunk_overlap || defaults.chunk_overlap);
    // Configurer le fournisseur d'embeddings
    setEmbeddingProvider(embedding_provider, embedding_model);
    const options = {
        filePatterns: file_patterns,
        recursive: recursive,
        chunkSize: chunk_size,
        chunkOverlap: chunk_overlap
    };
    try {
        const result = await indexProject(args.project_path, options);
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        ...result,
                        config_used: {
                            embedding_provider,
                            embedding_model,
                            chunk_size,
                            chunk_overlap,
                            recursive,
                            file_patterns_count: file_patterns.length
                        }
                    }, null, 2)
                }]
        };
    }
    catch (error) {
        console.error("Error in index_project tool:", error);
        throw error;
    }
};
/**
 * Test de l'outil (pour usage en développement)
 */
export async function testIndexProject() {
    console.log("Testing index_project tool...");
    const testProjectPath = "/tmp/test-project";
    try {
        // Créer un répertoire de test
        const fs = await import('fs');
        const path = await import('path');
        if (!fs.existsSync(testProjectPath)) {
            fs.mkdirSync(testProjectPath, { recursive: true });
        }
        // Créer un fichier de test
        const testFile = path.join(testProjectPath, "test.js");
        fs.writeFileSync(testFile, "// Test file for index_project\nconsole.log('Hello World');");
        console.log(`✅ Created test project at: ${testProjectPath}`);
        // Indexer le projet
        const result = await indexProjectHandler({
            project_path: testProjectPath,
            file_patterns: ["**/*.js"],
            recursive: true,
            embedding_provider: "fake"
        });
        console.log("✅ Test passed:", result ? "Oui" : "Non");
        // Nettoyer
        fs.rmSync(testProjectPath, { recursive: true, force: true });
        return result;
    }
    catch (error) {
        console.error("❌ Test failed:", error);
        throw error;
    }
}
