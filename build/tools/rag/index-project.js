// src/tools/rag/index-project.ts
// Outil: index_project - Alias pour injection_rag (déprécié)
// Version: v1.0.0 (alias)
import { injectionRagHandler } from "./injection-rag.js";
/**
 * Définition de l'outil index_project (alias déprécié)
 */
export const indexProjectTool = {
    name: "index_project",
    description: "ALIAS DÉPRÉCIÉ - Utilisez 'injection_rag' à la place. Indexer un projet complet pour la recherche sémantique avec options RAG",
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
    hidden: true, // Masqué de la liste des outils visibles
};
/**
 * Handler pour l'outil index_project (alias vers injection_rag)
 */
export const indexProjectHandler = async (args) => {
    console.warn("⚠️  L'outil 'index_project' est déprécié. Utilisez 'injection_rag' à la place.");
    console.warn("   → 'index_project' sera supprimé dans une future version.");
    console.warn("   → Migration recommandée: injection_rag offre plus de fonctionnalités.");
    // Ajouter un flag pour indiquer que c'est un appel via alias
    const enhancedArgs = {
        ...args,
        _called_via_alias: "index_project",
        _deprecation_warning: true
    };
    // Appeler le handler injection_rag
    return await injectionRagHandler(enhancedArgs);
};
/**
 * Test de l'outil (pour usage en développement)
 */
export async function testIndexProject() {
    console.log("🧪 Test de l'alias index_project (déprécié)...");
    const testProjectPath = "/tmp/test-index-project-alias";
    try {
        // Créer un répertoire de test
        const fs = await import('fs');
        const path = await import('path');
        if (!fs.existsSync(testProjectPath)) {
            fs.mkdirSync(testProjectPath, { recursive: true });
        }
        // Créer un fichier de test
        const testFile = path.join(testProjectPath, "test.js");
        fs.writeFileSync(testFile, "// Test file for index_project alias\nconsole.log('Testing alias');");
        console.log(`✅ Projet de test créé: ${testProjectPath}`);
        // Tester l'alias
        const result = await indexProjectHandler({
            project_path: testProjectPath,
            file_patterns: ["**/*.js"],
            recursive: true,
            embedding_provider: "fake"
        });
        console.log("✅ Test d'alias réussi:", result ? "Oui" : "Non");
        // Nettoyer
        fs.rmSync(testProjectPath, { recursive: true, force: true });
        return result;
    }
    catch (error) {
        console.error("❌ Test d'alias échoué:", error);
        throw error;
    }
}
