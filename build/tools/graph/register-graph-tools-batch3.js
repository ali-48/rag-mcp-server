// src/tools/graph/register-graph-tools-batch3.ts
// Enregistrement des outils graph Batch 3 dans le ToolRegistry
import { toolRegistry } from "../../core/tool-registry.js";
import { openNodesHandler, openNodesTool } from "./open-nodes.js";
import { readGraphHandler, readGraphTool } from "./read-graph.js";
import { searchNodesHandler, searchNodesTool } from "./search-nodes.js";
/**
 * Enregistre tous les outils graph Batch 3 dans le ToolRegistry
 */
export function registerGraphToolsBatch3() {
    console.log("📝 Enregistrement des outils graph Batch 3...");
    // Enregistrer read_graph
    try {
        toolRegistry.register(readGraphTool, readGraphHandler);
        console.log(`✅ Outil enregistré: ${readGraphTool.name}`);
    }
    catch (error) {
        console.error(`❌ Erreur lors de l'enregistrement de ${readGraphTool.name}:`, error);
    }
    // Enregistrer search_nodes
    try {
        toolRegistry.register(searchNodesTool, searchNodesHandler);
        console.log(`✅ Outil enregistré: ${searchNodesTool.name}`);
    }
    catch (error) {
        console.error(`❌ Erreur lors de l'enregistrement de ${searchNodesTool.name}:`, error);
    }
    // Enregistrer open_nodes
    try {
        toolRegistry.register(openNodesTool, openNodesHandler);
        console.log(`✅ Outil enregistré: ${openNodesTool.name}`);
    }
    catch (error) {
        console.error(`❌ Erreur lors de l'enregistrement de ${openNodesTool.name}:`, error);
    }
    console.log(`🎉 Batch 3 terminé. Outils enregistrés au total: ${toolRegistry.size()}`);
}
/**
 * Vérifie que tous les outils Batch 3 sont correctement enregistrés
 */
export function verifyGraphToolsBatch3() {
    const expectedTools = [
        "read_graph",
        "search_nodes",
        "open_nodes"
    ];
    console.log("🔍 Vérification des outils graph Batch 3...");
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
        console.log("🎉 Tous les outils Batch 3 sont correctement enregistrés !");
    }
    else {
        console.log("⚠️ Certains outils Batch 3 ne sont pas enregistrés");
    }
    return allRegistered;
}
/**
 * Test d'intégration des outils Batch 3
 */
export async function testGraphToolsBatch3() {
    console.log("🧪 Test d'intégration des outils graph Batch 3...");
    // Préparer des données de test
    const testEntity1 = "Test Entity for Batch 3 Read";
    const testEntity2 = "Test Entity for Batch 3 Search";
    try {
        // Créer des entités pour les tests
        console.log("Préparation: Création des entités de test...");
        await toolRegistry.execute("create_entities", {
            entities: [
                {
                    name: testEntity1,
                    entityType: "Test",
                    observations: ["Entity for read_graph test"]
                },
                {
                    name: testEntity2,
                    entityType: "SearchTest",
                    observations: ["Entity for search_nodes test"]
                }
            ]
        });
        console.log("✅ Données de test préparées");
    }
    catch (error) {
        console.error("❌ Échec de la préparation des données de test:", error instanceof Error ? error.message : String(error));
        return false;
    }
    // Test 1: read_graph
    try {
        console.log("\nTest 1: read_graph");
        const result = await toolRegistry.execute("read_graph", {});
        console.log("✅ read_graph fonctionne:", result ? "Oui" : "Non");
    }
    catch (error) {
        console.error("❌ read_graph a échoué:", error instanceof Error ? error.message : String(error));
        return false;
    }
    // Test 2: search_nodes
    try {
        console.log("\nTest 2: search_nodes");
        const result = await toolRegistry.execute("search_nodes", {
            query: "SearchTest"
        });
        console.log("✅ search_nodes fonctionne:", result ? "Oui" : "Non");
    }
    catch (error) {
        console.error("❌ search_nodes a échoué:", error instanceof Error ? error.message : String(error));
        return false;
    }
    // Test 3: open_nodes
    try {
        console.log("\nTest 3: open_nodes");
        const result = await toolRegistry.execute("open_nodes", {
            names: [testEntity1]
        });
        console.log("✅ open_nodes fonctionne:", result ? "Oui" : "Non");
    }
    catch (error) {
        console.error("❌ open_nodes a échoué:", error instanceof Error ? error.message : String(error));
        return false;
    }
    // Nettoyer les données de test
    try {
        console.log("\nNettoyage: Suppression des entités de test...");
        await toolRegistry.execute("delete_entities", {
            entityNames: [testEntity1, testEntity2]
        });
        console.log("✅ Données de test nettoyées");
    }
    catch (error) {
        console.warn("⚠️ Échec du nettoyage des données de test:", error instanceof Error ? error.message : String(error));
    }
    console.log("\n🎉 Tous les tests d'intégration Batch 3 ont réussi !");
    return true;
}
/**
 * Fonction principale pour initialiser les outils graph Batch 3
 */
export function initializeGraphToolsBatch3() {
    console.log("🚀 Initialisation des outils graph Batch 3...");
    // Enregistrer les outils
    registerGraphToolsBatch3();
    // Vérifier l'enregistrement
    const registered = verifyGraphToolsBatch3();
    if (registered) {
        console.log("✅ Initialisation Batch 3 terminée avec succès");
        console.log(`📊 Outils disponibles: ${toolRegistry.getToolNames().join(', ')}`);
        console.log(`📈 Total d'outils: ${toolRegistry.size()}`);
    }
    else {
        console.error("❌ Échec de l'initialisation Batch 3");
    }
}
// Exécution automatique si ce fichier est exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
    initializeGraphToolsBatch3();
    // Exécuter les tests si demandé
    if (process.argv.includes("--test")) {
        testGraphToolsBatch3().then(success => {
            if (success) {
                console.log("🎉 Tous les tests Batch 3 ont réussi !");
                process.exit(0);
            }
            else {
                console.error("❌ Certains tests Batch 3 ont échoué");
                process.exit(1);
            }
        });
    }
}
