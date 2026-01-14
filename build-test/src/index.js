#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { initializeLogRedirection } from "./core/log-redirect.js";
import { initializeAutoRegistryV2 } from "./core/registry-v2.js";
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
    // Trier les outils : init_rag en premier, puis ordre alphabétique
    const sortedTools = visibleTools.sort((a, b) => {
        if (a.name === 'init_rag')
            return -1;
        if (b.name === 'init_rag')
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
        // Pas de logs sur stderr pour compatibilité MCP
        throw error;
    }
});
// Fonction principale
async function main() {
    // Initialiser la redirection des logs console.* vers logger.ts
    initializeLogRedirection();
    // Initialiser le registre automatique v2 (logs réduits pour MCP)
    const registeredCount = await initializeAutoRegistryV2({ verbose: false });
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
    const ragTools = visibleTools.filter(tool => tool.name.includes('_rag') || // init_rag, activated_rag, recherche_rag
        tool.name === 'manage_projects' // manage_projects
    );
    // Démarrer le serveur
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // Pas de logs sur stdout/stderr pour compatibilité MCP
    // Les statistiques sont disponibles via les outils MCP
}
// Gestion des erreurs
main().catch((error) => {
    // Pas de logs sur stderr pour compatibilité MCP
    process.exit(1);
});
//# sourceMappingURL=index.js.map