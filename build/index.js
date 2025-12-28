#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { initializeAutoRegistry } from "./core/registry.js";
import { toolRegistry } from "./core/tool-registry.js";
// Le serveur MCP
const server = new Server({
    name: "rag-mcp-server",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
// Gérer la liste des outils
server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = toolRegistry.getTools();
    return {
        tools,
    };
});
// Gérer l'exécution des outils
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (!args) {
        throw new Error(`No arguments provided for tool: ${name}`);
    }
    try {
        // Utiliser le ToolRegistry pour exécuter l'outil
        return await toolRegistry.execute(name, args);
    }
    catch (error) {
        console.error(`Error executing tool ${name}:`, error);
        throw error;
    }
});
// Fonction principale
async function main() {
    // Initialiser le registre automatique
    console.error("🚀 Initialisation du registre automatique...");
    const registeredCount = await initializeAutoRegistry({ verbose: true });
    // Récupérer la liste des outils
    const tools = toolRegistry.getTools();
    // Compter les outils par catégorie
    const graphTools = tools.filter(tool => tool.name.includes('_entities') ||
        tool.name.includes('_relations') ||
        tool.name.includes('_observations') ||
        tool.name.includes('_graph') ||
        tool.name.includes('_nodes'));
    const ragTools = tools.filter(tool => tool.name.includes('_project') ||
        tool.name.includes('_code'));
    // Démarrer le serveur
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("✅ RAG MCP Server running on stdio");
    console.error(`📊 Total tools available: ${tools.length} (${graphTools.length} graph tools, ${ragTools.length} RAG tools)`);
    console.error(`🎉 Outils enregistrés automatiquement: ${registeredCount}`);
}
// Gestion des erreurs
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
