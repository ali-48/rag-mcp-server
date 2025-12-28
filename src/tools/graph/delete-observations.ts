// src/tools/graph/delete-observations.ts
// Outil: delete_observations - Supprimer des observations d'entités

import { ToolDefinition, ToolHandler } from "../../core/tool-registry.js";
import { knowledgeGraphManager } from "../../knowledge-graph/manager.js";

/**
 * Définition de l'outil delete_observations
 */
export const deleteObservationsTool: ToolDefinition = {
  name: "delete_observations",
  description: "Delete specific observations from entities in the knowledge graph",
  inputSchema: {
    type: "object",
    properties: {
      deletions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            entityName: { 
              type: "string", 
              description: "The name of the entity containing the observations" 
            },
            observations: {
              type: "array",
              items: { type: "string" },
              description: "An array of observations to delete"
            },
          },
          required: ["entityName", "observations"],
        },
      },
    },
    required: ["deletions"],
  },
};

/**
 * Handler pour l'outil delete_observations
 */
export const deleteObservationsHandler: ToolHandler = async (args) => {
  if (!args.deletions || !Array.isArray(args.deletions)) {
    throw new Error("The 'deletions' parameter is required and must be an array");
  }

  // Valider chaque suppression
  for (const deletion of args.deletions) {
    if (!deletion.entityName || typeof deletion.entityName !== 'string') {
      throw new Error("Each deletion must have an 'entityName' string property");
    }
    if (!deletion.observations || !Array.isArray(deletion.observations)) {
      throw new Error("Each deletion must have an 'observations' array property");
    }
  }

  try {
    await knowledgeGraphManager.deleteObservations(args.deletions);
    return { 
      content: [{ 
        type: "text", 
        text: "Observations deleted successfully" 
      }] 
    };
  } catch (error) {
    console.error("Error in delete_observations tool:", error);
    throw error;
  }
};

/**
 * Fonction utilitaire pour supprimer des observations d'une entité
 */
export async function deleteObservation(
  entityName: string, 
  observations: string[]
): Promise<any> {
  return deleteObservationsHandler({ 
    deletions: [{ entityName, observations }] 
  });
}

/**
 * Test de l'outil (pour usage en développement)
 */
export async function testDeleteObservations() {
  console.log("Testing delete_observations tool...");
  
  const testEntityName = "Test Entity for Observations";
  const testObservations = ["Observation 1", "Observation 2", "Observation 3"];
  
  try {
    // Créer une entité avec des observations
    await knowledgeGraphManager.createEntities([{
      name: testEntityName,
      entityType: "Test",
      observations: testObservations
    }]);
    
    console.log(`✅ Created test entity with ${testObservations.length} observations`);
    
    // Supprimer une observation
    const result = await deleteObservationsHandler({ 
      deletions: [{
        entityName: testEntityName,
        observations: ["Observation 2"] // Supprimer seulement la deuxième
      }]
    });
    
    console.log("✅ Test passed:", result);
    return result;
  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  }
}
