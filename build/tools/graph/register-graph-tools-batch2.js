// src/tools/graph/register-graph-tools-batch2.ts
// Enregistrement des outils graph Batch 2 dans le ToolRegistry
import { toolRegistry } from "../../core/tool-registry.js";
import { deleteEntitiesHandler, deleteEntitiesTool } from "./delete-entities.js";
import { deleteObservationsHandler, deleteObservationsTool } from "./delete-observations.js";
import { deleteRelationsHandler, deleteRelationsTool } from "./delete-relations.js";
/**
 * Enregistre tous les outils graph Batch 2 dans le ToolRegistry
 */
export function registerGraphToolsBatch2() {
    console.log("📝 Enregistrement des outils graph Batch 2...");
    // Enregistrer delete_entities
    try {
        toolRegistry.register(deleteEntitiesTool, deleteEntitiesHandler);
        console.log(`✅ Outil enregistré: ${deleteEntitiesTool.name}`);
    }
    catch (error) {
        console.error(`❌ Erreur lors de l'enregistrement de ${deleteEntitiesTool.name}:`, error);
    }
    // Enregistrer delete_observations
    try {
        toolRegistry.register(deleteObservationsTool, deleteObservationsHandler);
        console.log(`✅ Outil enregistré: ${deleteObservationsTool.name}`);
    }
    catch (error) {
        console.error(`❌ Erreur lors de l'enregistrement de ${deleteObservationsTool.name}:`, error);
    }
    // Enregistrer delete_relations
    try {
        toolRegistry.register(deleteRelationsTool, deleteRelationsHandler);
        console.log(`✅ Outil enregistré: ${deleteRelationsTool.name}`);
    }
    catch (error) {
        console.error(`❌ Erreur lors de l'enregistrement de ${deleteRelationsTool.name}:`, error);
    }
    console.log(`🎉 Batch 2 terminé. Outils enregistrés au total: ${toolRegistry.size()}`);
}
/**
 * Vérifie que tous les outils Batch 2 sont correctement enregistrés
 */
export function verifyGraphToolsBatch2() {
    const expectedTools = [
        "delete_entities",
        "delete_observations",
        "delete_relations"
    ];
    console.log("🔍 Vérification des outils graph Batch 2...");
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
        console.log("🎉 Tous les outils Batch 2 sont correctement enregistrés !");
    }
    else {
        console.log("⚠️ Certains outils Batch 2 ne sont pas enregistrés");
    }
    return allRegistered;
}
/**
 * Test d'intégration des outils Batch 2
 */
export async function testGraphToolsBatch2() {
    console.log("🧪 Test d'intégration des outils graph Batch 2...");
    // Préparer des données de test
    const testEntity1 = "Test Entity for Batch 2 Delete";
    const testEntity2 = "Test Entity B for Relations";
    try {
        // Créer des entités pour les tests
        console.log("Préparation: Création des entités de test...");
        await toolRegistry.execute("create_entities", {
            entities: [
                {
                    name: testEntity1,
                    entityType: "Test",
                    observations: ["Observation 1", "Observation 2", "Observation 3"]
                },
                {
                    name: testEntity2,
                    entityType: "Test",
                    observations: ["Entity B for relation tests"]
                }
            ]
        });
        // Créer une relation pour le test delete_relations
        await toolRegistry.execute("create_relations", {
            relations: [{
                    from: testEntity1,
                    to: testEntity2,
                    relationType: "TEST_RELATION_BATCH2"
                }]
        });
        console.log("✅ Données de test préparées");
    }
    catch (error) {
        console.error("❌ Échec de la préparation des données de test:", error instanceof Error ? error.message : String(error));
        return false;
    }
    // Test 1: delete_observations
    try {
        console.log("\nTest 1: delete_observations");
        const result = await toolRegistry.execute("delete_observations", {
            deletions: [{
                    entityName: testEntity1,
                    observations: ["Observation 2"]
                }]
        });
        console.log("✅ delete_observations fonctionne:", result ? "Oui" : "Non");
    }
    catch (error) {
        console.error("❌ delete_observations a échoué:", error instanceof Error ? error.message : String(error));
        return false;
    }
    // Test 2: delete_relations
    try {
        console.log("\nTest 2: delete_relations");
        const result = await toolRegistry.execute("delete_relations", {
            relations: [{
                    from: testEntity1,
                    to: testEntity2,
                    relationType: "TEST_RELATION_BATCH2"
                }]
        });
        console.log("✅ delete_relations fonctionne:", result ? "Oui" : "Non");
    }
    catch (error) {
        console.error("❌ delete_relations a échoué:", error instanceof Error ? error.message : String(error));
        return false;
    }
    // Test 3: delete_entities
    try {
        console.log("\nTest 3: delete_entities");
        const result = await toolRegistry.execute("delete_entities", {
            entityNames: [testEntity1, testEntity2]
        });
        console.log("✅ delete_entities fonctionne:", result ? "Oui" : "Non");
    }
    catch (error) {
        console.error("❌ delete_entities a échoué:", error instanceof Error ? error.message : String(error));
        return false;
    }
    console.log("\n🎉 Tous les tests d'intégration Batch 2 ont réussi !");
    return true;
}
/**
 * Fonction principale pour initialiser les outils graph Batch 2
 */
export function initializeGraphToolsBatch2() {
    console.log("🚀 Initialisation des outils graph Batch 2...");
    // Enregistrer les outils
    registerGraphToolsBatch2();
    // Vérifier l'enregistrement
    const registered = verifyGraphToolsBatch2();
    if (registered) {
        console.log("✅ Initialisation Batch 2 terminée avec succès");
        console.log(`📊 Outils disponibles: ${toolRegistry.getToolNames().join(', ')}`);
        console.log(`📈 Total d'outils: ${toolRegistry.size()}`);
    }
    else {
        console.error("❌ Échec de l'initialisation Batch 2");
    }
}
// Exécution automatique si ce fichier est exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
    initializeGraphToolsBatch2();
    // Exécuter les tests si demandé
    if (process.argv.includes("--test")) {
        testGraphToolsBatch2().then(success => {
            if (success) {
                console.log("🎉 Tous les tests Batch 2 ont réussi !");
                process.exit(0);
            }
            else {
                console.error("❌ Certains tests Batch 2 ont échoué");
                process.exit(1);
            }
        });
    }
}
