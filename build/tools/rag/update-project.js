// src/tools/rag/update-project.ts
// Outil: update_project - Mettre à jour l'indexation d'un projet
import { getRagConfigManager } from "../../config/rag-config.js";
import { updateProject } from "../../rag/indexer.js";
import { setEmbeddingProvider } from "../../rag/vector-store.js";
/**
 * Définition de l'outil update_project
 */
export const updateProjectTool = {
    name: "update_project",
    description: "Mettre à jour l'indexation d'un projet (indexation incrémentale) avec options RAG",
    inputSchema: {
        type: "object",
        properties: {
            project_path: {
                type: "string",
                description: "Chemin absolu vers le projet à mettre à jour"
            },
            file_patterns: {
                type: "array",
                items: { type: "string" },
                description: "Patterns de fichiers à inclure",
                default: ["**/*.{js,ts,py,md,txt,json,yaml,yml,html,css,scss}"]
            },
            recursive: {
                type: "boolean",
                description: "Parcourir les sous-dossiers récursivement",
                default: true
            }
        },
        required: ["project_path"]
    },
};
/**
 * Handler pour l'outil update_project
 */
export const updateProjectHandler = async (args) => {
    if (!args.project_path || typeof args.project_path !== 'string') {
        throw new Error("The 'project_path' parameter is required and must be a string");
    }
    // Charger la configuration
    const configManager = getRagConfigManager();
    const defaults = configManager.getDefaults();
    // Utiliser les valeurs par défaut de la configuration
    const file_patterns = args.file_patterns || defaults.file_patterns;
    const recursive = args.recursive !== undefined ? args.recursive : defaults.recursive;
    const embedding_provider = defaults.embedding_provider;
    const embedding_model = defaults.embedding_model;
    // Appliquer les limites aux valeurs numériques de la configuration
    const chunk_size = configManager.applyLimits('chunk_size', defaults.chunk_size);
    const chunk_overlap = configManager.applyLimits('chunk_overlap', defaults.chunk_overlap);
    // Configurer le fournisseur d'embeddings
    setEmbeddingProvider(embedding_provider, embedding_model);
    const options = {
        filePatterns: file_patterns,
        recursive: recursive,
        chunkSize: chunk_size,
        chunkOverlap: chunk_overlap
    };
    try {
        const result = await updateProject(args.project_path, options);
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
        console.error("Error in update_project tool:", error);
        throw error;
    }
};
/**
 * Test de l'outil (pour usage en développement)
 */
export async function testUpdateProject() {
    console.log("Testing update_project tool...");
    const testProjectPath = "/tmp/test-project-update";
    try {
        // Créer un répertoire de test
        const fs = await import('fs');
        const path = await import('path');
        if (!fs.existsSync(testProjectPath)) {
            fs.mkdirSync(testProjectPath, { recursive: true });
        }
        // Créer un fichier initial
        const initialFile = path.join(testProjectPath, "initial.js");
        fs.writeFileSync(initialFile, "// Initial file for update_project test\nconsole.log('Initial');");
        // Indexer le projet initialement
        const { indexProjectHandler } = await import("./index-project.js");
        await indexProjectHandler({
            project_path: testProjectPath,
            file_patterns: ["**/*.js"],
            recursive: true,
            embedding_provider: "fake"
        });
        console.log(`✅ Initial indexing done for: ${testProjectPath}`);
        // Ajouter un nouveau fichier
        const newFile = path.join(testProjectPath, "new.js");
        fs.writeFileSync(newFile, "// New file for update_project test\nconsole.log('Updated');");
        // Mettre à jour le projet
        const result = await updateProjectHandler({
            project_path: testProjectPath,
            file_patterns: ["**/*.js"],
            recursive: true
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
