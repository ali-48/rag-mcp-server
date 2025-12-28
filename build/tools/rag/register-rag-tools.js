// src/tools/rag/register-rag-tools.ts
// Enregistrement des outils RAG dans le ToolRegistry
import { toolRegistry } from "../../core/tool-registry.js";
import { indexProjectHandler, indexProjectTool } from "./index-project.js";
import { manageProjectsHandler, manageProjectsTool } from "./manage-projects.js";
import { searchCodeHandler, searchCodeTool } from "./search-code.js";
import { updateProjectHandler, updateProjectTool } from "./update-project.js";
/**
 * Enregistre tous les outils RAG dans le ToolRegistry
 */
export function registerRagTools() {
    console.log("📝 Enregistrement des outils RAG...");
    // Enregistrer index_project
    try {
        toolRegistry.register(indexProjectTool, indexProjectHandler);
        console.log(`✅ Outil enregistré: ${indexProjectTool.name}`);
    }
    catch (error) {
        console.error(`❌ Erreur lors de l'enregistrement de ${indexProjectTool.name}:`, error);
    }
    // Enregistrer search_code
    try {
        toolRegistry.register(searchCodeTool, searchCodeHandler);
        console.log(`✅ Outil enregistré: ${searchCodeTool.name}`);
    }
    catch (error) {
        console.error(`❌ Erreur lors de l'enregistrement de ${searchCodeTool.name}:`, error);
    }
    // Enregistrer manage_projects
    try {
        toolRegistry.register(manageProjectsTool, manageProjectsHandler);
        console.log(`✅ Outil enregistré: ${manageProjectsTool.name}`);
    }
    catch (error) {
        console.error(`❌ Erreur lors de l'enregistrement de ${manageProjectsTool.name}:`, error);
    }
    // Enregistrer update_project
    try {
        toolRegistry.register(updateProjectTool, updateProjectHandler);
        console.log(`✅ Outil enregistré: ${updateProjectTool.name}`);
    }
    catch (error) {
        console.error(`❌ Erreur lors de l'enregistrement de ${updateProjectTool.name}:`, error);
    }
    console.log(`🎉 Outils RAG terminés. Outils enregistrés au total: ${toolRegistry.size()}`);
}
/**
 * Vérifie que tous les outils RAG sont correctement enregistrés
 */
export function verifyRagTools() {
    const expectedTools = [
        "index_project",
        "search_code",
        "manage_projects",
        "update_project"
    ];
    console.log("🔍 Vérification des outils RAG...");
    let allRegistered = true;
    for (const toolName of expectedTools) {
        if (toolRegistry.hasTool(toolName)) {
            console.log(`✅ ${toolName} est enregistré`);
        }
        else {
            console.log(`❌ ${toolName} n'est PAS enregistré`);
            allRegistered = false;
        }
    }
    if (allRegistered) {
        console.log("🎉 Tous les outils RAG sont correctement enregistrés !");
    }
    else {
        console.log("⚠️ Certains outils RAG ne sont pas enregistrés");
    }
    return allRegistered;
}
/**
 * Test d'intégration des outils RAG
 */
export async function testRagTools() {
    console.log("🧪 Test d'intégration des outils RAG...");
    const testProjectPath = "/tmp/test-project-rag-integration";
    try {
        // Créer un répertoire de test
        const fs = await import('fs');
        const path = await import('path');
        if (!fs.existsSync(testProjectPath)) {
            fs.mkdirSync(testProjectPath, { recursive: true });
        }
        // Créer des fichiers de test
        const testFile1 = path.join(testProjectPath, "test1.js");
        const testFile2 = path.join(testProjectPath, "test2.py");
        fs.writeFileSync(testFile1, "// JavaScript test file\nconsole.log('Hello from JS');");
        fs.writeFileSync(testFile2, "# Python test file\nprint('Hello from Python')");
        console.log(`✅ Créé projet de test à: ${testProjectPath}`);
        // Test 1: index_project
        try {
            console.log("\nTest 1: index_project");
            const result = await toolRegistry.execute("index_project", {
                project_path: testProjectPath,
                file_patterns: ["**/*.{js,py}"],
                recursive: true,
                embedding_provider: "fake"
            });
            console.log("✅ index_project fonctionne:", result ? "Oui" : "Non");
        }
        catch (error) {
            console.error("❌ index_project a échoué:", error instanceof Error ? error.message : String(error));
            return false;
        }
        // Test 2: search_code
        try {
            console.log("\nTest 2: search_code");
            const result = await toolRegistry.execute("search_code", {
                query: "JavaScript",
                format_output: false,
                embedding_provider: "fake"
            });
            console.log("✅ search_code fonctionne:", result ? "Oui" : "Non");
        }
        catch (error) {
            console.error("❌ search_code a échoué:", error instanceof Error ? error.message : String(error));
            return false;
        }
        // Test 3: manage_projects
        try {
            console.log("\nTest 3: manage_projects");
            const result = await toolRegistry.execute("manage_projects", {
                action: "list"
            });
            console.log("✅ manage_projects fonctionne:", result ? "Oui" : "Non");
        }
        catch (error) {
            console.error("❌ manage_projects a échoué:", error instanceof Error ? error.message : String(error));
            return false;
        }
        // Test 4: update_project
        try {
            console.log("\nTest 4: update_project");
            const newFile = path.join(testProjectPath, "newfile.md");
            fs.writeFileSync(newFile, "# New markdown file\nThis is an update test.");
            const result = await toolRegistry.execute("update_project", {
                project_path: testProjectPath,
                file_patterns: ["**/*.{js,py,md}"],
                recursive: true,
                embedding_provider: "fake"
            });
            console.log("✅ update_project fonctionne:", result ? "Oui" : "Non");
        }
        catch (error) {
            console.error("❌ update_project a échoué:", error instanceof Error ? error.message : String(error));
            return false;
        }
        // Nettoyer
        fs.rmSync(testProjectPath, { recursive: true, force: true });
        console.log("\n✅ Données de test nettoyées");
        console.log("\n🎉 Tous les tests d'intégration RAG ont réussi !");
        return true;
    }
    catch (error) {
        console.error("❌ Erreur lors des tests RAG:", error instanceof Error ? error.message : String(error));
        return false;
    }
}
/**
 * Fonction principale pour initialiser les outils RAG
 */
export function initializeRagTools() {
    console.log("🚀 Initialisation des outils RAG...");
    // Enregistrer les outils
    registerRagTools();
    // Vérifier l'enregistrement
    const registered = verifyRagTools();
    if (registered) {
        console.log("✅ Initialisation RAG terminée avec succès");
        console.log(`📊 Outils disponibles: ${toolRegistry.getToolNames().join(', ')}`);
        console.log(`📈 Total d'outils: ${toolRegistry.size()}`);
    }
    else {
        console.error("❌ Échec de l'initialisation RAG");
    }
}
// Exécution automatique si ce fichier est exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
    initializeRagTools();
    // Exécuter les tests si demandé
    if (process.argv.includes("--test")) {
        testRagTools().then(success => {
            if (success) {
                console.log("🎉 Tous les tests RAG ont réussi !");
                process.exit(0);
            }
            else {
                console.error("❌ Certains tests RAG ont échoué");
                process.exit(1);
            }
        });
    }
}
