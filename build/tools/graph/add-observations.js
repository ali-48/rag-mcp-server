// src/tools/graph/add-observations.ts
// Outil: add_observations - Ajouter des observations aux entités existantes
import { knowledgeGraphManager } from "../../knowledge-graph/manager.js";
/**
 * Définition de l'outil add_observations
 */
export const addObservationsTool = {
    name: "add_observations",
    description: "Add new observations to existing entities in the knowledge graph",
    inputSchema: {
        type: "object",
        properties: {
            observations: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        entityName: {
                            type: "string",
                            description: "The name of the entity to add the observations to"
                        },
                        contents: {
                            type: "array",
                            items: { type: "string" },
                            description: "An array of observation contents to add"
                        },
                    },
                    required: ["entityName", "contents"],
                },
            },
        },
        required: ["observations"],
    },
};
/**
 * Handler pour l'outil add_observations
 */
export const addObservationsHandler = async (args) => {
    if (!args.observations || !Array.isArray(args.observations)) {
        throw new Error("The 'observations' parameter is required and must be an array");
    }
    // Valider chaque observation
    for (const observation of args.observations) {
        if (!observation.entityName || typeof observation.entityName !== 'string') {
            throw new Error("Each observation must have an 'entityName' string property");
        }
        if (!observation.contents || !Array.isArray(observation.contents)) {
            throw new Error("Each observation must have a 'contents' array property");
        }
    }
    try {
        const result = await knowledgeGraphManager.addObservations(args.observations);
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }]
        };
    }
    catch (error) {
        console.error("Error in add_observations tool:", error);
        throw error;
    }
};
/**
 * Fonction utilitaire pour ajouter des observations à une entité
 */
export async function addObservation(entityName, contents) {
    return addObservationsHandler({
        observations: [{ entityName, contents }]
    });
}
/**
 * Test de l'outil (pour usage en développement)
 */
export async function testAddObservations() {
    console.log("Testing add_observations tool...");
    const testObservations = [
        {
            entityName: "Test Entity",
            contents: ["This is an additional observation"]
        }
    ];
    try {
        const result = await addObservationsHandler({ observations: testObservations });
        console.log("Test passed:", result);
        return result;
    }
    catch (error) {
        console.error("Test failed:", error);
        throw error;
    }
}
