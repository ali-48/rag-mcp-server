import * as vscode from 'vscode';
import { McpClient } from './services/McpClient';

let mcpClient: McpClient | null = null;

export function activate(context: vscode.ExtensionContext) {
  console.log('RAG MCP Extension is now active!');

  // Initialize MCP client
  const config = vscode.workspace.getConfiguration('rag-mcp');
  const serverUrl = config.get<string>('serverUrl') || 'ws://localhost:3000';
  const timeout = config.get<number>('timeout') || 30000;

  mcpClient = new McpClient(serverUrl, timeout);

  // Register commands
  const commands = [
    vscode.commands.registerCommand('rag-mcp.showDashboard', () => {
      showDashboard(context);
    }),
    vscode.commands.registerCommand('rag-mcp.initProject', () => {
      initProject();
    }),
    vscode.commands.registerCommand('rag-mcp.activatePipeline', () => {
      activatePipeline();
    }),
    vscode.commands.registerCommand('rag-mcp.queryRag', () => {
      queryRag(context);
    }),
    vscode.commands.registerCommand('rag-mcp.getStatus', () => {
      getStatus();
    })
  ];

  commands.forEach(command => context.subscriptions.push(command));

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
    vscode.window.showErrorMessage(`❌ Failed to connect to RAG MCP Server: ${error}`);
  }
}

async function showDashboard(context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    'ragDashboard',
    'RAG MCP Dashboard',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  panel.webview.html = getDashboardWebviewContent();
}

async function initProject() {
  const projectPath = await vscode.window.showInputBox({
    prompt: 'Enter project path to initialize RAG for',
    placeHolder: '/path/to/your/project'
  });

  if (!projectPath) {
    return;
  }

  try {
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Initializing RAG Project...',
      cancellable: false
    }, async (progress) => {
      progress.report({ message: 'Starting initialization...' });

      const result = await mcpClient?.call('init_rag', {
        project_path: projectPath,
        force: true,
        verbose: true
      });

      if (result?.status === 'ok') {
        vscode.window.showInformationMessage(`✅ RAG project initialized: ${projectPath}`);
      } else {
        vscode.window.showErrorMessage(`❌ Failed to initialize RAG project: ${result?.message || 'Unknown error'}`);
      }
    });
  } catch (error) {
    vscode.window.showErrorMessage(`❌ Error initializing RAG project: ${error}`);
  }
}

async function activatePipeline() {
  const modes = ['full', 'incremental', 'analyze_only', 'watch'];
  const selectedMode = await vscode.window.showQuickPick(modes, {
    placeHolder: 'Select activation mode'
  });

  if (!selectedMode) {
    return;
  }

  const projectPath = await vscode.window.showInputBox({
    prompt: 'Enter project path (optional, leave empty for current workspace)',
    placeHolder: vscode.workspace.rootPath || ''
  });

  try {
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Activating RAG Pipeline (${selectedMode})...`,
      cancellable: false
    }, async (progress) => {
      progress.report({ message: 'Starting pipeline activation...' });

      const params: any = {
        mode: selectedMode,
        enable_phase0: true,
        enable_llm_enrichment: false
      };

      if (projectPath) {
        params.project_path = projectPath;
      }

      const result = await mcpClient?.call('activated_rag', params);

      if (result?.success) {
        vscode.window.showInformationMessage(`✅ RAG pipeline activated successfully (${selectedMode})`);
      } else {
        vscode.window.showErrorMessage(`❌ Failed to activate RAG pipeline: ${result?.message || 'Unknown error'}`);
      }
    });
  } catch (error) {
    vscode.window.showErrorMessage(`❌ Error activating RAG pipeline: ${error}`);
  }
}

async function queryRag(context: vscode.ExtensionContext) {
  const query = await vscode.window.showInputBox({
    prompt: 'Enter your RAG query',
    placeHolder: 'Search for code, documentation, or configuration'
  });

  if (!query) {
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    'ragQuery',
    `RAG Query: ${query}`,
    vscode.ViewColumn.One,
    {
      enableScripts: true
    }
  );

  panel.webview.html = getLoadingWebviewContent();

  try {
    const result = await mcpClient?.call('query_rag', {
      query,
      top_k: 10,
      format_output: true
    });

    panel.webview.html = getQueryResultsWebviewContent(query, result);
  } catch (error) {
    panel.webview.html = getErrorWebviewContent(`Query failed: ${error}`);
  }
}

async function getStatus() {
  try {
    const result = await mcpClient?.call('get_status', {
      scope: 'global',
      include_notes_for_ai: true,
      include_allowed_actions: true
    });

    if (result?.status === 'ok') {
      const data = result.data;
      const message = `RAG System Status:\n` +
        `• Initialized: ${data.rag_state?.initialized ? '✅' : '❌'}\n` +
        `• Active Jobs: ${data.rag_state?.active_jobs || 0}\n` +
        `• Total Projects: ${data.rag_state?.total_projects || 0}\n` +
        `• Allowed Actions: ${data.allowed_actions?.join(', ') || 'none'}`;

      vscode.window.showInformationMessage(message);
    } else {
      vscode.window.showErrorMessage(`❌ Failed to get status: ${result?.message || 'Unknown error'}`);
    }
  } catch (error) {
    vscode.window.showErrorMessage(`❌ Error getting status: ${error}`);
  }
}

function getDashboardWebviewContent(): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>RAG MCP Dashboard</title>
      <style>
        body {
          font-family: var(--vscode-font-family);
          padding: 20px;
          color: var(--vscode-foreground);
          background: var(--vscode-editor-background);
        }
        h1 {
          color: var(--vscode-textLink-foreground);
          border-bottom: 2px solid var(--vscode-textLink-foreground);
          padding-bottom: 10px;
        }
        .card {
          background: var(--vscode-editor-inactiveSelectionBackground);
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .status {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 10px 0;
        }
        .status-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }
        .status-online {
          background: #4CAF50;
        }
        .status-offline {
          background: #F44336;
        }
        .button {
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin: 5px;
        }
        .button:hover {
          background: var(--vscode-button-hoverBackground);
        }
      </style>
    </head>
    <body>
      <h1>RAG MCP Dashboard</h1>

      <div class="card">
        <h2>System Status</h2>
        <div class="status">
          <div class="status-indicator status-online"></div>
          <span>RAG MCP Server: Connected</span>
        </div>
        <div id="status-details">Loading...</div>
      </div>

      <div class="card">
        <h2>Quick Actions</h2>
        <button class="button" onclick="initProject()">Initialize RAG Project</button>
        <button class="button" onclick="activatePipeline()">Activate Pipeline</button>
        <button class="button" onclick="queryRag()">Query RAG</button>
        <button class="button" onclick="refreshStatus()">Refresh Status</button>
      </div>

      <div class="card">
        <h2>Recent Activity</h2>
        <div id="activity-log">No recent activity</div>
      </div>

      <script>
        async function refreshStatus() {
          const response = await vscode.postMessage({ command: 'refreshStatus' });
          document.getElementById('status-details').innerHTML = 'Refreshing...';
        }

        function initProject() {
          vscode.postMessage({ command: 'initProject' });
        }

        function activatePipeline() {
          vscode.postMessage({ command: 'activatePipeline' });
        }

        function queryRag() {
          vscode.postMessage({ command: 'queryRag' });
        }

        // Handle messages from extension
        window.addEventListener('message', event => {
          const message = event.data;
          if (message.command === 'updateStatus') {
            document.getElementById('status-details').innerHTML = message.data;
          }
        });

        // Initial status load
        refreshStatus();
      </script>
    </body>
    </html>
  `;
}

function getLoadingWebviewContent(): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: var(--vscode-font-family);
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          background: var(--vscode-editor-background);
          color: var(--vscode-foreground);
        }
        .loader {
          text-align: center;
        }
        .spinner {
          border: 4px solid var(--vscode-editor-inactiveSelectionBackground);
          border-top: 4px solid var(--vscode-textLink-foreground);
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="loader">
        <div class="spinner"></div>
        <p>Executing RAG query...</p>
      </div>
    </body>
    </html>
  `;
}

function getQueryResultsWebviewContent(query: string, result: any): string {
  const results = result?.results || [];
  const resultsHtml = results.map((item: any, index: number) => `
    <div class="result">
      <h3>${index + 1}. ${item.file_path || 'Unknown file'} (Score: ${item.score?.toFixed(3) || 'N/A'})</h3>
      <pre>${item.content || 'No content'}</pre>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: var(--vscode-font-family);
          padding: 20px;
          background: var(--vscode-editor-background);
          color: var(--vscode-foreground);
        }
        h1 {
          color: var(--vscode-textLink-foreground);
        }
        .query {
          background: var(--vscode-editor-inactiveSelectionBackground);
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .result {
          background: var(--vscode-editor-inactiveSelectionBackground);
          padding: 15px;
          border-radius: 8px;
          margin: 15px 0;
        }
        pre {
          white-space: pre-wrap;
          background: rgba(0,0,0,0.1);
          padding: 10px;
          border-radius: 4px;
          max-height: 200px;
          overflow-y: auto;
        }
      </style>
    </head>
    <body>
      <h1>RAG Query Results</h1>
      <div class="query">
        <strong>Query:</strong> "${query}"
      </div>
      ${results.length > 0 ? resultsHtml : '<p>No results found.</p>'}
    </body>
    </html>
  `;
}

function getErrorWebviewContent(error: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: var(--vscode-font-family);
          padding: 20px;
          background: var(--vscode-editor-background);
          color: var(--vscode-foreground);
        }
        .error {
          background: #f8d7da;
          color: #721c24;
          padding: 15px;
          border-radius: 8px;
          border: 1px solid #f5c6cb;
        }
      </style>
    </head>
    <body>
      <h1>Error</h1>
      <div class="error">
        ${error}
      </div>
    </body>
    </html>
  `;
}
