// src/tools/graph/create-relations.ts
// Outil: create_relations - Créer de nouvelles relations entre entités

import { ToolDefinition, ToolHandler } from "../../core/tool-registry.js";
import { knowledgeGraphManager } from "../../knowledge-graph/manager.js";

/**
 * Définition de l'outil create_relations
 */
export const createRelationsTool: ToolDefinition = {
  name: "create_relations",
  description: "Create multiple new relations between entities in the knowledge graph. Relations should be in active voice",
  inputSchema: {
    type: "object",
    properties: {
      relations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            from: { 
              type: "string", 
              description: "The name of the entity where the relation starts" 
            },
            to: { 
              type: "string", 
              description: "The name of the entity where the relation ends" 
            },
            relationType: { 
              type: "string", 
              description: "The type of the relation" 
            },
          },
          required: ["from", "to", "relationType"],
        },
      },
    },
    required: ["relations"],
  },
};

/**
 * Handler pour l'outil create_relations
 */
export const createRelationsHandler: ToolHandler = async (args) => {
  if (!args.relations || !Array.isArray(args.relations)) {
    throw new Error("The 'relations' parameter is required and must be an array");
  }

  // Valider chaque relation
  for (const relation of args.relations) {
    if (!relation.from || typeof relation.from !== 'string') {
      throw new Error("Each relation must have a 'from' string property");
    }
    if (!relation.to || typeof relation.to !== 'string') {
      throw new Error("Each relation must have a 'to' string property");
    }
    if (!relation.relationType || typeof relation.relationType !== 'string') {
      throw new Error("Each relation must have a 'relationType' string property");
    }
  }

  try {
    const result = await knowledgeGraphManager.createRelations(args.relations);
    return { 
      content: [{ 
        type: "text", 
        text: JSON.stringify(result, null, 2) 
      }] 
    };
  } catch (error) {
    console.error("Error in create_relations tool:", error);
    throw error;
  }
};

/**
 * Fonction utilitaire pour créer une relation simple
 */
export async function createRelation(
  from: string, 
  to: string, 
  relationType: string
): Promise<any> {
  return createRelationsHandler({ 
    relations: [{ from, to, relationType }] 
  });
}

/**
 * Test de l'outil (pour usage en développement)
 */
export async function testCreateRelations() {
  console.log("Testing create_relations tool...");
  
  const testRelations = [
    {
      from: "Entity A",
      to: "Entity B",
      relationType: "CONNECTS_TO"
    }
  ];

  try {
    const result = await createRelationsHandler({ relations: testRelations });
    console.log("Test passed:", result);
    return result;
  } catch (error) {
    console.error("Test failed:", error);
    throw error;
  }
}
