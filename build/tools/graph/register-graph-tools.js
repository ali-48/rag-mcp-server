// src/tools/graph/register-graph-tools.ts
// Enregistrement des outils graph dans le ToolRegistry
import { toolRegistry } from "../../core/tool-registry.js";
import { addObservationsHandler, addObservationsTool } from "./add-observations.js";
import { createEntitiesHandler, createEntitiesTool } from "./create-entities.js";
import { createRelationsHandler, createRelationsTool } from "./create-relations.js";
/**
 * Enregistre tous les outils graph Batch 1 dans le ToolRegistry
 */
export function registerGraphToolsBatch1() {
    console.log("📝 Enregistrement des outils graph Batch 1...");
    // Enregistrer create_entities
    try {
        toolRegistry.register(createEntitiesTool, createEntitiesHandler);
        console.log(`✅ Outil enregistré: ${createEntitiesTool.name}`);
    }
    catch (error) {
        console.error(`❌ Erreur lors de l'enregistrement de ${createEntitiesTool.name}:`, error);
    }
    // Enregistrer create_relations
    try {
        toolRegistry.register(createRelationsTool, createRelationsHandler);
        console.log(`✅ Outil enregistré: ${createRelationsTool.name}`);
    }
    catch (error) {
        console.error(`❌ Erreur lors de l'enregistrement de ${createRelationsTool.name}:`, error);
    }
    // Enregistrer add_observations
    try {
        toolRegistry.register(addObservationsTool, addObservationsHandler);
        console.log(`✅ Outil enregistré: ${addObservationsTool.name}`);
    }
    catch (error) {
        console.error(`❌ Erreur lors de l'enregistrement de ${addObservationsTool.name}:`, error);
    }
    console.log(`🎉 Batch 1 terminé. Outils enregistrés: ${toolRegistry.size()}`);
}
/**
 * Vérifie que tous les outils Batch 1 sont correctement enregistrés
 */
export function verifyGraphToolsBatch1() {
    const expectedTools = [
        "create_entities",
        "create_relations",
        "add_observations"
    ];
    console.log("🔍 Vérification des outils graph Batch 1...");
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
        console.log("🎉 Tous les outils Batch 1 sont correctement enregistrés !");
    }
    else {
        console.log("⚠️ Certains outils Batch 1 ne sont pas enregistrés");
    }
    return allRegistered;
}
/**
 * Test d'intégration des outils Batch 1
 */
export async function testGraphToolsBatch1() {
    console.log("🧪 Test d'intégration des outils graph Batch 1...");
    // Créer une entité de test
    try {
        console.log("Test 1: create_entities");
        const createResult = await toolRegistry.execute("create_entities", {
            entities: [{
                    name: "Test Entity for Batch 1",
                    entityType: "Test",
                    observations: ["Created by Batch 1 integration test"]
                }]
        });
        console.log("✅ create_entities fonctionne:", createResult ? "Oui" : "Non");
    }
    catch (error) {
        console.error("❌ create_entities a échoué:", error instanceof Error ? error.message : String(error));
        return false;
    }
    // Créer une relation de test
    try {
        console.log("Test 2: create_relations");
        const relationResult = await toolRegistry.execute("create_relations", {
            relations: [{
                    from: "Test Entity for Batch 1",
                    to: "Another Entity",
                    relationType: "TEST_RELATION"
                }]
        });
        console.log("✅ create_relations fonctionne:", relationResult ? "Oui" : "Non");
    }
    catch (error) {
        console.error("❌ create_relations a échoué:", error instanceof Error ? error.message : String(error));
        return false;
    }
    // Ajouter une observation de test
    try {
        console.log("Test 3: add_observations");
        const observationResult = await toolRegistry.execute("add_observations", {
            observations: [{
                    entityName: "Test Entity for Batch 1",
                    contents: ["Additional observation from integration test"]
                }]
        });
        console.log("✅ add_observations fonctionne:", observationResult ? "Oui" : "Non");
    }
    catch (error) {
        console.error("❌ add_observations a échoué:", error instanceof Error ? error.message : String(error));
        return false;
    }
    console.log("🎉 Tous les tests d'intégration Batch 1 ont réussi !");
    return true;
}
/**
 * Fonction principale pour initialiser les outils graph Batch 1
 */
export function initializeGraphToolsBatch1() {
    console.log("🚀 Initialisation des outils graph Batch 1...");
    // Enregistrer les outils
    registerGraphToolsBatch1();
    // Vérifier l'enregistrement
    const registered = verifyGraphToolsBatch1();
    if (registered) {
        console.log("✅ Initialisation Batch 1 terminée avec succès");
        console.log(`📊 Outils disponibles: ${toolRegistry.getToolNames().join(', ')}`);
    }
    else {
        console.error("❌ Échec de l'initialisation Batch 1");
    }
}
// Exécution automatique si ce fichier est exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
    initializeGraphToolsBatch1();
    // Exécuter les tests si demandé
    if (process.argv.includes("--test")) {
        testGraphToolsBatch1().then(success => {
            if (success) {
                console.log("🎉 Tous les tests Batch 1 ont réussi !");
                process.exit(0);
            }
            else {
                console.error("❌ Certains tests Batch 1 ont échoué");
                process.exit(1);
            }
        });
    }
}
