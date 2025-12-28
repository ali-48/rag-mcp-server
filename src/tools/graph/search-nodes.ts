// src/tools/graph/search-nodes.ts
// Outil: search_nodes - Rechercher des nœuds dans le graphe

import { ToolDefinition, ToolHandler } from "../../core/tool-registry.js";
import { knowledgeGraphManager } from "../../knowledge-graph/manager.js";

/**
 * Définition de l'outil search_nodes
 */
export const searchNodesTool: ToolDefinition = {
  name: "search_nodes",
  description: "Search for nodes in the knowledge graph based on a query",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query to match against entity names, types, and observation content"
      },
    },
    required: ["query"],
  },
};

/**
 * Handler pour l'outil search_nodes
 */
export const searchNodesHandler: ToolHandler = async (args) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error("The 'query' parameter is required and must be a string");
  }

  try {
    const results = await knowledgeGraphManager.searchNodes(args.query);
    return { 
      content: [{ 
        type: "text", 
        text: JSON.stringify(results, null, 2) 
      }] 
    };
  } catch (error) {
    console.error("Error in search_nodes tool:", error);
    throw error;
  }
};

/**
 * Fonction utilitaire pour rechercher des nœuds
 */
export async function searchNodes(query: string): Promise<any> {
  return searchNodesHandler({ query });
}

/**
 * Test de l'outil (pour usage en développement)
 */
export async function testSearchNodes() {
  console.log("Testing search_nodes tool...");
  
  const testQuery = "Test";
  
  try {
    // D'abord créer des données de test
    await knowledgeGraphManager.createEntities([
      {
        name: "Test Entity for Search",
        entityType: "Test",
        observations: ["This entity should be found by search"]
      },
      {
        name: "Another Entity",
        entityType: "Other",
        observations: ["This should not match the search"]
      }
    ]);
    
    // Rechercher
    const result = await searchNodesHandler({ query: testQuery });
    
    console.log("✅ Test passed:", result ? "Oui" : "Non");
    return result;
  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  }
}
