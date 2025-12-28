// src/tools/graph/delete-entities.ts
// Outil: delete_entities - Supprimer des entités du graphe de connaissances

import { ToolDefinition, ToolHandler } from "../../core/tool-registry.js";
import { knowledgeGraphManager } from "../../knowledge-graph/manager.js";

/**
 * Définition de l'outil delete_entities
 */
export const deleteEntitiesTool: ToolDefinition = {
  name: "delete_entities",
  description: "Delete multiple entities and their associated relations from the knowledge graph",
  inputSchema: {
    type: "object",
    properties: {
      entityNames: {
        type: "array",
        items: { 
          type: "string" 
        },
        description: "An array of entity names to delete"
      },
    },
    required: ["entityNames"],
  },
};

/**
 * Handler pour l'outil delete_entities
 */
export const deleteEntitiesHandler: ToolHandler = async (args) => {
  if (!args.entityNames || !Array.isArray(args.entityNames)) {
    throw new Error("The 'entityNames' parameter is required and must be an array");
  }

  // Valider chaque nom d'entité
  for (const entityName of args.entityNames) {
    if (!entityName || typeof entityName !== 'string') {
      throw new Error("Each entity name must be a non-empty string");
    }
  }

  try {
    await knowledgeGraphManager.deleteEntities(args.entityNames);
    return { 
      content: [{ 
        type: "text", 
        text: "Entities deleted successfully" 
      }] 
    };
  } catch (error) {
    console.error("Error in delete_entities tool:", error);
    throw error;
  }
};

/**
 * Fonction utilitaire pour supprimer une entité
 */
export async function deleteEntity(entityName: string): Promise<any> {
  return deleteEntitiesHandler({ 
    entityNames: [entityName] 
  });
}

/**
 * Test de l'outil (pour usage en développement)
 */
export async function testDeleteEntities() {
  console.log("Testing delete_entities tool...");
  
  // D'abord créer une entité à supprimer
  const testEntityName = "Test Entity to Delete";
  
  try {
    // Créer l'entité
    await knowledgeGraphManager.createEntities([{
      name: testEntityName,
      entityType: "Test",
      observations: ["This entity will be deleted"]
    }]);
    
    console.log(`✅ Created test entity: ${testEntityName}`);
    
    // Supprimer l'entité
    const result = await deleteEntitiesHandler({ 
      entityNames: [testEntityName] 
    });
    
    console.log("✅ Test passed:", result);
    return result;
  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  }
}
