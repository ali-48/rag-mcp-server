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
    const allTools = toolRegistry.getTools();
    // Filtrer les outils masqués
    const visibleTools = allTools.filter(tool => !tool.hidden);
    // Trier les outils : injection_rag en premier, puis ordre alphabétique
    const sortedTools = visibleTools.sort((a, b) => {
        if (a.name === 'injection_rag')
            return -1;
        if (b.name === 'injection_rag')
            return 1;
        return a.name.localeCompare(b.name);
    });
    return {
        tools: sortedTools,
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
    // Initialiser le registre automatique (logs réduits pour MCP)
    const registeredCount = await initializeAutoRegistry({ verbose: false });
    // Récupérer la liste des outils
    const allTools = toolRegistry.getTools();
    // Filtrer les outils masqués pour les statistiques
    const visibleTools = allTools.filter(tool => !tool.hidden);
    // Compter les outils par catégorie (basé sur les outils visibles)
    const graphTools = visibleTools.filter(tool => tool.name.includes('_entities') ||
        tool.name.includes('_relations') ||
        tool.name.includes('_observations') ||
        tool.name.includes('_graph') ||
        tool.name.includes('_nodes'));
    const ragTools = visibleTools.filter(tool => tool.name.includes('_rag') || // injection_rag
        tool.name.includes('_code') || // search_code
        tool.name === 'manage_projects' || // manage_projects
        tool.name === 'update_project' // update_project
    );
    // Démarrer le serveur
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // Log minimal pour MCP
    console.error("RAG MCP Server running on stdio");
}
// Gestion des erreurs
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
