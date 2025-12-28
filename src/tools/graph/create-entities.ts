// src/tools/graph/create-entities.ts
// Outil: create_entities - Créer de nouvelles entités dans le graphe de connaissances

import { ToolDefinition, ToolHandler } from "../../core/tool-registry.js";
import { knowledgeGraphManager } from "../../knowledge-graph/manager.js";

/**
 * Définition de l'outil create_entities
 */
export const createEntitiesTool: ToolDefinition = {
  name: "create_entities",
  description: "Create multiple new entities in the knowledge graph",
  inputSchema: {
    type: "object",
    properties: {
      entities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { 
              type: "string", 
              description: "The name of the entity" 
            },
            entityType: { 
              type: "string", 
              description: "The type of the entity" 
            },
            observations: {
              type: "array",
              items: { type: "string" },
              description: "An array of observation contents associated with the entity"
            },
          },
          required: ["name", "entityType", "observations"],
        },
      },
    },
    required: ["entities"],
  },
};

/**
 * Handler pour l'outil create_entities
 */
export const createEntitiesHandler: ToolHandler = async (args) => {
  if (!args.entities || !Array.isArray(args.entities)) {
    throw new Error("The 'entities' parameter is required and must be an array");
  }

  // Valider chaque entité
  for (const entity of args.entities) {
    if (!entity.name || typeof entity.name !== 'string') {
      throw new Error("Each entity must have a 'name' string property");
    }
    if (!entity.entityType || typeof entity.entityType !== 'string') {
      throw new Error("Each entity must have an 'entityType' string property");
    }
    if (!entity.observations || !Array.isArray(entity.observations)) {
      throw new Error("Each entity must have an 'observations' array property");
    }
  }

  try {
    const result = await knowledgeGraphManager.createEntities(args.entities);
    return { 
      content: [{ 
        type: "text", 
        text: JSON.stringify(result, null, 2) 
      }] 
    };
  } catch (error) {
    console.error("Error in create_entities tool:", error);
    throw error;
  }
};

/**
 * Fonction utilitaire pour créer une entité simple
 */
export async function createEntity(
  name: string, 
  entityType: string, 
  observations: string[]
): Promise<any> {
  return createEntitiesHandler({ 
    entities: [{ name, entityType, observations }] 
  });
}

/**
 * Test de l'outil (pour usage en développement)
 */
export async function testCreateEntities() {
  console.log("Testing create_entities tool...");
  
  const testEntities = [
    {
      name: "Test Entity",
      entityType: "Test",
      observations: ["This is a test observation"]
    }
  ];

  try {
    const result = await createEntitiesHandler({ entities: testEntities });
    console.log("Test passed:", result);
    return result;
  } catch (error) {
    console.error("Test failed:", error);
    throw error;
  }
}
