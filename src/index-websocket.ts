#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { initializeLogRedirection } from "./core/log-redirect.js";
import { logger } from "./core/logger.js";
import { initializeAutoRegistryV2 } from "./core/registry-v2.js";
import { toolRegistry } from "./core/tool-registry.js";
import { WebSocketServerTransport } from "./websocket-transport.js";

// Le serveur MCP
const server = new Server(
  {
    name: "rag-mcp-server-websocket",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Gérer la liste des outils
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const allTools = toolRegistry.getTools();

  // Filtrer les outils masqués
  const visibleTools = allTools.filter(tool => !tool.hidden);

  // Trier les outils : init_rag en premier, puis ordre alphabétique
  const sortedTools = visibleTools.sort((a, b) => {
    if (a.name === 'init_rag') return -1;
    if (b.name === 'init_rag') return 1;
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
  } catch (error) {
    // Pas de logs sur stderr pour compatibilité MCP
    throw error;
  }
});

// Fonction principale
async function main() {
  // Initialiser la redirection des logs console.* vers logger.ts
  initializeLogRedirection();

  // Charger la configuration RAG v3 (rag-config.json est maintenant v3.0.0)
  const { getRagConfigManager } = await import('./config/rag-config.js');
  const configManager = getRagConfigManager();
  const config = configManager.getConfig();

  // Configurer le registre automatique avec la configuration
  const { autoRegistryV2 } = await import('./core/registry-v2.js');
  autoRegistryV2.configureFromConfig(config);

  // Initialiser le registre automatique v2 (logs réduits pour MCP)
  const registeredCount = await initializeAutoRegistryV2({ verbose: false });

  // Récupérer la liste des outils
  const allTools = toolRegistry.getTools();

  // Filtrer les outils masqués pour les statistiques
  const visibleTools = allTools.filter(tool => !tool.hidden);

  // Compter les outils par catégorie (basé sur les outils visibles)
  const graphTools = visibleTools.filter(tool =>
    tool.name.includes('_entities') ||
    tool.name.includes('_relations') ||
    tool.name.includes('_observations') ||
    tool.name.includes('_graph') ||
    tool.name.includes('_nodes')
  );

  const ragTools = visibleTools.filter(tool =>
    tool.name.includes('_rag') ||        // init_rag, activated_rag, recherche_rag
    tool.name === 'manage_projects'      // manage_projects
  );

  // Créer le transport WebSocket
  const transport = new WebSocketServerTransport(3000);

  // Configurer les gestionnaires d'événements du transport
  transport.onmessage = (message, socket) => {
    // Le serveur MCP gère automatiquement les messages via le transport
    // Nous devons passer le message au serveur
    if (server.transport) {
      // Simuler l'événement message
      (server.transport as any).onmessage?.(message);
    }
  };

  transport.onerror = (error) => {
    logger.error(`❌ Erreur WebSocket: ${error.message}`);
  };

  transport.onclose = () => {
    logger.info('🔌 Serveur WebSocket fermé');
  };

  // Démarrer le serveur WebSocket
  await transport.start();

  // Connecter le serveur MCP au transport
  await server.connect({
    start: async () => {
      // Le transport est déjà démarré
    },
    send: async (message) => {
      // Envoyer le message au client d'origine (premier client pour l'instant)
      // Dans une implémentation réelle, nous devrions suivre quel client a envoyé quelle requête
      await transport.broadcast(message);
    },
    close: async () => {
      await transport.close();
    }
  });

  logger.info(`🚀 Serveur MCP WebSocket démarré sur ws://localhost:3000`);
  logger.info(`📊 Outils disponibles: ${visibleTools.length} (${ragTools.length} RAG, ${graphTools.length} Graph)`);

  // Gérer l'arrêt proprement
  process.on('SIGINT', async () => {
    logger.info('🛑 Arrêt du serveur WebSocket...');
    await transport.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('🛑 Arrêt du serveur WebSocket (SIGTERM)...');
    await transport.close();
    process.exit(0);
  });
}

// Gestion des erreurs
main().catch((error) => {
  logger.error(`❌ Erreur fatale: ${error.message}`);
  process.exit(1);
});
