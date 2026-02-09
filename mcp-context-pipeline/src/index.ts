/**
 * Point d'entrée principal du pipeline MCP Context
 *
 * Ce module initialise le serveur MCP avec l'outil receive-vscode-context
 * et configure le pipeline de traitement des événements VS Code.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import { receiveVSCodeContextTool } from './tools/receive-vscode-context.js';
import { logger } from './utils/structured-logger.js';

/**
 * Configuration du serveur MCP
 */
const server = new Server(
  {
    name: 'mcp-context-pipeline',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Enregistrement des outils MCP
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  logger.info('ListToolsRequest reçu');
  return {
    tools: [receiveVSCodeContextTool.definition],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  logger.info(`CallToolRequest reçu: ${name}`, { args });

  if (name === receiveVSCodeContextTool.definition.name) {
    return await receiveVSCodeContextTool.handler(args);
  }

  throw new Error(`Outil non trouvé: ${name}`);
});

/**
 * Gestion des erreurs non capturées
 */
process.on('uncaughtException', (error) => {
  logger.error('Erreur non capturée', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Rejet non géré', { reason: String(reason) });
});

/**
 * Point d'entrée principal
 */
async function main() {
  try {
    logger.info('Démarrage du pipeline MCP Context...');

    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('Pipeline MCP Context démarré avec succès');
    logger.info('Outils disponibles:', {
      tools: [receiveVSCodeContextTool.definition.name]
    });

  } catch (error) {
    logger.error('Erreur lors du démarrage du pipeline', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

// Exécution principale
if (require.main === module) {
  main().catch((error) => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });
}

export { server }; // Pour les tests
