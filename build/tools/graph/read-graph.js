// src/tools/graph/read-graph.ts
// Outil: read_graph - Lire l'ensemble du graphe de connaissances
import { knowledgeGraphManager } from "../../knowledge-graph/manager.js";
/**
 * Définition de l'outil read_graph
 */
export const readGraphTool = {
    name: "read_graph",
    description: "Read the entire knowledge graph",
    inputSchema: {
        type: "object",
        properties: {},
        required: [],
    },
};
/**
 * Handler pour l'outil read_graph
 */
export const readGraphHandler = async (args) => {
    try {
        const graph = await knowledgeGraphManager.readGraph();
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(graph, null, 2)
                }]
        };
    }
    catch (error) {
        console.error("Error in read_graph tool:", error);
        throw error;
    }
};
/**
 * Test de l'outil (pour usage en développement)
 */
export async function testReadGraph() {
    console.log("Testing read_graph tool...");
    try {
        // D'abord créer quelques données de test
        await knowledgeGraphManager.createEntities([
            {
                name: "Test Entity for Read Graph",
                entityType: "Test",
                observations: ["Entity for testing read_graph tool"]
            }
        ]);
        // Lire le graphe
        const result = await readGraphHandler({});
        console.log("✅ Test passed:", result ? "Oui" : "Non");
        return result;
    }
    catch (error) {
        console.error("❌ Test failed:", error);
        throw error;
    }
}
