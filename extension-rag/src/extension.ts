import * as vscode from 'vscode';
import { McpClient } from './services/McpClient';
import { getErrorHandler } from './services/error-handler';
import { DashboardView } from './views/DashboardView';

let mcpClient: McpClient | null = null;
let errorHandler = getErrorHandler();

export function activate(context: vscode.ExtensionContext) {
  console.log('RAG MCP Extension is now active!');

  // Initialize MCP client
  const config = vscode.workspace.getConfiguration('rag-mcp');
  const serverUrl = config.get<string>('serverUrl') || 'ws://localhost:3000';
  const timeout = config.get<number>('timeout') || 30000;

  mcpClient = new McpClient(serverUrl, timeout);

  // Register commands (only human-facing commands, IA commands are reserved for MCP direct access)
  const commands = [
    vscode.commands.registerCommand('rag-mcp.showDashboard', () => {
      DashboardView.createOrShow(context.extensionUri, mcpClient);
    }),
    vscode.commands.registerCommand('rag-mcp.getStatus', () => {
      getStatus();
    }),
    vscode.commands.registerCommand('rag-mcp.showErrorLogs', () => {
      errorHandler.showLogs();
    })
  ];

  commands.forEach(command => context.subscriptions.push(command));

  // Add error handler output channel to subscriptions
  context.subscriptions.push(errorHandler.getOutputChannel());

  // Auto-connect to MCP server
  connectToMcpServer();
}

export function deactivate() {
  if (mcpClient) {
    mcpClient.disconnect();
  }
}

async function connectToMcpServer() {
  try {
    await mcpClient?.connect();
    vscode.window.showInformationMessage('✅ Connected to RAG MCP Server');
  } catch (error) {
    await errorHandler.handleError(error, {
      operation: 'connectToMcpServer',
      retryCallback: () => connectToMcpServer()
    });
  }
}


async function getStatus() {
  try {
    const result = await errorHandler.executeWithRetry(
      () => mcpClient!.call('rag_get_status', {
        scope: 'global',
        include_notes_for_ai: true,
        include_allowed_actions: true
      }),
      { tool: 'rag_get_status', description: 'Get RAG system status' }
    );

    if (result?.status === 'ok') {
      const data = result.data;
      const message = `RAG System Status:\n` +
        `• Initialized: ${data.rag_state?.initialized ? '✅' : '❌'}\n` +
        `• Active Jobs: ${data.rag_state?.active_jobs || 0}\n` +
        `• Total Projects: ${data.rag_state?.total_projects || 0}\n` +
        `• Allowed Actions: ${data.allowed_actions?.join(', ') || 'none'}`;

      vscode.window.showInformationMessage(message);
    } else {
      const errorMessage = result?.message || 'Unknown error';
      await errorHandler.handleError(new Error(`Failed to get status: ${errorMessage}`), {
        tool: 'rag_get_status'
      });
    }
  } catch (error) {
    await errorHandler.handleError(error, {
      tool: 'rag_get_status',
      operation: 'getStatus'
    });
  }
}
