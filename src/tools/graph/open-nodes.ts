// src/tools/graph/open-nodes.ts
// Outil: open_nodes - Ouvrir des nœuds spécifiques dans le graphe

import { ToolDefinition, ToolHandler } from "../../core/tool-registry.js";
import { knowledgeGraphManager } from "../../knowledge-graph/manager.js";

/**
 * Définition de l'outil open_nodes
 */
export const openNodesTool: ToolDefinition = {
  name: "open_nodes",
  description: "Open specific nodes in the knowledge graph by their names",
  inputSchema: {
    type: "object",
    properties: {
      names: {
        type: "array",
        items: { type: "string" },
        description: "An array of entity names to retrieve"
      },
    },
    required: ["names"],
  },
};

/**
 * Handler pour l'outil open_nodes
 */
export const openNodesHandler: ToolHandler = async (args) => {
  if (!args.names || !Array.isArray(args.names)) {
    throw new Error("The 'names' parameter is required and must be an array");
  }

  // Valider chaque nom
  for (const name of args.names) {
    if (!name || typeof name !== 'string') {
      throw new Error("Each name must be a non-empty string");
    }
  }

  try {
    const nodes = await knowledgeGraphManager.openNodes(args.names);
    return { 
      content: [{ 
        type: "text", 
        text: JSON.stringify(nodes, null, 2) 
      }] 
    };
  } catch (error) {
    console.error("Error in open_nodes tool:", error);
    throw error;
  }
};

/**
 * Fonction utilitaire pour ouvrir un nœud
 */
export async function openNode(name: string): Promise<any> {
  return openNodesHandler({ names: [name] });
}

/**
 * Test de l'outil (pour usage en développement)
 */
export async function testOpenNodes() {
  console.log("Testing open_nodes tool...");
  
  const testEntityName = "Test Entity for Open Nodes";
  
  try {
    // D'abord créer une entité de test
    await knowledgeGraphManager.createEntities([
      {
        name: testEntityName,
        entityType: "Test",
        observations: ["Entity for testing open_nodes tool"]
      }
    ]);
    
    // Ouvrir le nœud
    const result = await openNodesHandler({ names: [testEntityName] });
    
    console.log("✅ Test passed:", result ? "Oui" : "Non");
    return result;
  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  }
}
