import * as vscode from 'vscode';
import { McpClient } from '../services/McpClient';
import { getErrorHandler } from '../services/error-handler';

export interface RAGStatus {
  rag_state: {
    initialized: boolean;
    active_jobs: number;
    total_projects: number;
    last_updated: string;
    version: string;
  };
  projects: Array<{
    id: string;
    path: string;
    status: 'initialized' | 'active' | 'completed' | 'error';
    files_indexed: number;
    chunks_created: number;
    last_activity: string;
  }>;
  allowed_actions: string[];
  notes_for_ai?: string[];
}

export class DashboardView {
  private static currentPanel: DashboardView | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly mcpClient: McpClient | null;
  private readonly errorHandler = getErrorHandler();
  private refreshInterval: NodeJS.Timeout | null = null;
  private isConnected = false;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, mcpClient: McpClient | null) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.mcpClient = mcpClient;

    // Set webview options
    this.panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [extensionUri]
    };

    // Set HTML content
    this.panel.webview.html = this.getWebviewContent();

    // Listen for messages from webview
    this.setupMessageListeners();

    // Handle panel disposal
    this.panel.onDidDispose(() => this.dispose(), null);

    // Initial data load
    this.loadStatusData();
    this.loadProjectsData();

    // Start auto-refresh
    this.startAutoRefresh(5000);
  }

  public static createOrShow(extensionUri: vscode.Uri, mcpClient: McpClient | null) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (DashboardView.currentPanel) {
      DashboardView.currentPanel.panel.reveal(column);
      return DashboardView.currentPanel;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'ragDashboard',
      'RAG MCP Dashboard',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    DashboardView.currentPanel = new DashboardView(panel, extensionUri, mcpClient);
    return DashboardView.currentPanel;
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, mcpClient: McpClient | null) {
    DashboardView.currentPanel = new DashboardView(panel, extensionUri, mcpClient);
  }

  private async loadStatusData(): Promise<void> {
    try {
      if (!this.mcpClient) {
        throw new Error('MCP client not available');
      }

      const result = await this.errorHandler.executeWithRetry(
        () => this.mcpClient!.call('get_status', {
          scope: 'global',
          include_notes_for_ai: true,
          include_allowed_actions: true
        }),
        { tool: 'get_status', description: 'Load RAG system status' }
      );

      if (result?.status === 'ok') {
        const statusData = result.data as RAGStatus;
        this.isConnected = true;
        this.sendMessageToWebview('updateStatus', statusData);
        this.sendMessageToWebview('updateConnectionState', { connected: true });
      } else {
        throw new Error(result?.message || 'Failed to get status');
      }
    } catch (error) {
      this.isConnected = false;
      this.sendMessageToWebview('updateConnectionState', { connected: false });
      this.sendMessageToWebview('updateError', {
        message: 'Failed to load status data',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async loadProjectsData(): Promise<void> {
    try {
      // For now, we'll just show a placeholder or use status data
      // In a future version, we could have a dedicated tool for listing projects
      this.sendMessageToWebview('updateProjects', { projects: [] });
    } catch (error) {
      console.warn('Failed to load projects data:', error);
    }
  }

  private async handleRefresh(): Promise<void> {
    await this.loadStatusData();
  }

  private async handleInitProject(): Promise<void> {
    try {
      const projectPath = await vscode.window.showInputBox({
        prompt: 'Enter project path to initialize RAG for',
        placeHolder: '/path/to/your/project'
      });

      if (!projectPath) {
        return;
      }

      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Initializing RAG Project...',
        cancellable: false
      }, async (progress) => {
        progress.report({ message: 'Starting initialization...' });

        const result = await this.errorHandler.executeWithRetry(
          () => this.mcpClient!.call('init_rag', {
            project_path: projectPath,
            force: true,
            verbose: true
          }),
          { tool: 'init_rag', description: 'Initialize RAG project' }
        );

        if (result?.status === 'ok') {
          vscode.window.showInformationMessage(`✅ RAG project initialized: ${projectPath}`);
          await this.loadStatusData(); // Refresh dashboard
        } else {
          throw new Error(result?.message || 'Failed to initialize project');
        }
      });
    } catch (error) {
      await this.errorHandler.handleError(error, {
        tool: 'init_rag',
        operation: 'Initialize project from dashboard'
      });
    }
  }

  private async handleActivatePipeline(): Promise<void> {
    try {
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

        const result = await this.errorHandler.executeWithRetry(
          () => this.mcpClient!.call('activated_rag', params),
          { tool: 'activated_rag', description: 'Activate RAG pipeline' }
        );

        if (result?.success) {
          vscode.window.showInformationMessage(`✅ RAG pipeline activated successfully (${selectedMode})`);
          await this.loadStatusData(); // Refresh dashboard
        } else {
          throw new Error(result?.message || 'Failed to activate pipeline');
        }
      });
    } catch (error) {
      await this.errorHandler.handleError(error, {
        tool: 'activated_rag',
        operation: 'Activate pipeline from dashboard'
      });
    }
  }

  private async handleQueryRag(): Promise<void> {
    try {
      const query = await vscode.window.showInputBox({
        prompt: 'Enter your RAG query',
        placeHolder: 'Search for code, documentation, or configuration'
      });

      if (!query) {
        return;
      }

      vscode.window.showInformationMessage(`Executing query: ${query}`, { modal: false });

      // In a real implementation, we would open a QueryView here
      // For now, just show a notification
      const result = await this.errorHandler.executeWithRetry(
        () => this.mcpClient!.call('query_rag', {
          query,
          top_k: 10,
          format_output: true
        }),
        { tool: 'query_rag', description: 'Execute RAG query' }
      );

      if (result?.results?.length > 0) {
        vscode.window.showInformationMessage(`Found ${result.results.length} results for "${query}"`);
      } else {
        vscode.window.showWarningMessage(`No results found for "${query}"`);
      }
    } catch (error) {
      await this.errorHandler.handleError(error, {
        tool: 'query_rag',
        operation: 'Query RAG from dashboard'
      });
    }
  }

  private setupMessageListeners(): void {
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        try {
          switch (message.command) {
            case 'refresh':
              await this.handleRefresh();
              break;
            case 'initProject':
              await this.handleInitProject();
              break;
            case 'activatePipeline':
              await this.handleActivatePipeline();
              break;
            case 'queryRag':
              await this.handleQueryRag();
              break;
            case 'showErrorLogs':
              this.errorHandler.showLogs();
              break;
            case 'testConnection':
              await this.testConnection();
              break;
          }
        } catch (error) {
          await this.errorHandler.handleError(error, {
            operation: `Dashboard message: ${message.command}`
          });
        }
      },
      undefined
    );
  }

  private async testConnection(): Promise<void> {
    try {
      this.sendMessageToWebview('updateConnectionState', { connected: false, testing: true });

      if (!this.mcpClient) {
        throw new Error('MCP client not available');
      }

      await this.mcpClient.connect();
      this.isConnected = true;
      this.sendMessageToWebview('updateConnectionState', { connected: true, testing: false });
      this.sendMessageToWebview('showNotification', {
        type: 'success',
        message: '✅ Connected to RAG MCP Server'
      });
    } catch (error) {
      this.isConnected = false;
      this.sendMessageToWebview('updateConnectionState', { connected: false, testing: false });
      this.sendMessageToWebview('showNotification', {
        type: 'error',
        message: '❌ Failed to connect to RAG MCP Server'
      });
    }
  }

  private sendMessageToWebview(command: string, data: any = {}): void {
    try {
      if (this.panel?.webview) {
        this.panel.webview.postMessage({ command, ...data });
      }
    } catch (error) {
      console.warn('Failed to send message to webview:', error);
    }
  }

  private startAutoRefresh(intervalMs: number): void {
    this.stopAutoRefresh();
    this.refreshInterval = setInterval(() => {
      if (this.panel.visible && this.isConnected) {
        this.loadStatusData();
      }
    }, intervalMs);
  }

  private stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  private getWebviewContent(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>RAG MCP Dashboard</title>
        <style>
          :root {
            /* VS Code Theme Variables */
            --vscode-font-family: -apple-system, BlinkMacSystemFont, 'Segoe WPC', 'Segoe UI', 'HelveticaNeue-Light', 'Ubuntu', 'Droid Sans', sans-serif;
            --vscode-foreground: #cccccc;
            --vscode-editor-background: #1e1e1e;
            --vscode-editor-inactiveSelectionBackground: #3a3d41;
            --vscode-textLink-foreground: #3794ff;
            --vscode-button-background: #0e639c;
            --vscode-button-hoverBackground: #1177bb;
            --vscode-inputValidation-errorBackground: #5a1d1d;
            --vscode-errorForeground: #f48771;
            --vscode-warningForeground: #cca700;
            --vscode-successForeground: #89d185;
            --vscode-input-background: #3c3c3c;
            --vscode-input-border: #3c3c3c;
            --vscode-input-foreground: #cccccc;
            --vscode-focusBorder: #007fd4;
            --vscode-list-activeSelectionBackground: #094771;
            --vscode-list-hoverBackground: #2a2d2e;
            --vscode-badge-background: #4d4d4d;
            --vscode-badge-foreground: #ffffff;

            /* Custom Variables */
            --card-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
            --transition-speed: 0.2s;
            --border-radius: 6px;
            --border-radius-lg: 8px;
            --spacing-xs: 4px;
            --spacing-sm: 8px;
            --spacing-md: 16px;
            --spacing-lg: 24px;
            --spacing-xl: 32px;
          }

          body {
            font-family: var(--vscode-font-family);
            padding: var(--spacing-md);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            margin: 0;
            line-height: 1.6;
            font-size: 13px;
          }

          h1 {
            color: var(--vscode-textLink-foreground);
            border-bottom: 1px solid var(--vscode-editor-inactiveSelectionBackground);
            padding-bottom: var(--spacing-sm);
            margin-top: 0;
            margin-bottom: var(--spacing-lg);
            font-size: 1.8em;
            font-weight: 600;
          }

          h2 {
            color: var(--vscode-foreground);
            margin-top: var(--spacing-lg);
            margin-bottom: var(--spacing-md);
            font-size: 1.3em;
            font-weight: 600;
            border-bottom: 1px solid var(--vscode-editor-inactiveSelectionBackground);
            padding-bottom: var(--spacing-sm);
          }

          h3 {
            margin-top: var(--spacing-md);
            margin-bottom: var(--spacing-sm);
            font-size: 1.1em;
            font-weight: 600;
            color: var(--vscode-foreground);
          }

          .dashboard {
            display: flex;
            flex-direction: column;
            gap: var(--spacing-lg);
            max-width: 1200px;
            margin: 0 auto;
          }

          .card {
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: var(--border-radius-lg);
            padding: var(--spacing-lg);
            box-shadow: var(--card-shadow);
            border: 1px solid rgba(255, 255, 255, 0.05);
            transition: box-shadow var(--transition-speed) ease;
          }

          .card:hover {
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
          }

          .connection-status {
            display: flex;
            align-items: center;
            gap: var(--spacing-md);
            margin-bottom: var(--spacing-lg);
            padding: var(--spacing-md);
            border-radius: var(--border-radius);
            background: rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.1);
          }

          .status-indicator {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            position: relative;
          }

          .status-connected {
            background: var(--vscode-successForeground);
            box-shadow: 0 0 10px var(--vscode-successForeground);
          }

          .status-connected::after {
            content: '';
            position: absolute;
            top: -2px;
            left: -2px;
            right: -2px;
            bottom: -2px;
            border-radius: 50%;
            background: var(--vscode-successForeground);
            opacity: 0.3;
            animation: pulse 2s infinite;
          }

          .status-disconnected {
            background: var(--vscode-errorForeground);
            box-shadow: 0 0 10px var(--vscode-errorForeground);
          }

          .status-testing {
            background: var(--vscode-warningForeground);
            animation: pulse 1.5s infinite;
          }

          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
              opacity: 1;
            }
            50% {
              transform: scale(1.1);
              opacity: 0.7;
            }
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: var(--spacing-md);
            margin-top: var(--spacing-md);
          }

          .stat-card {
            background: rgba(0, 0, 0, 0.2);
            padding: var(--spacing-md);
            border-radius: var(--border-radius);
            text-align: center;
            border: 1px solid rgba(255, 255, 255, 0.05);
            transition: transform var(--transition-speed) ease, border-color var(--transition-speed) ease;
          }

          .stat-card:hover {
            transform: translateY(-2px);
            border-color: var(--vscode-textLink-foreground);
          }

          .stat-value {
            font-size: 2.2em;
            font-weight: 600;
            margin: var(--spacing-sm) 0;
            color: var(--vscode-textLink-foreground);
          }

          .stat-label {
            font-size: 0.85em;
            opacity: 0.8;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .actions-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: var(--spacing-sm);
            margin-top: var(--spacing-md);
          }

          .button {
            background: var(--vscode-button-background);
            color: white;
            border: none;
            padding: var(--spacing-sm) var(--spacing-md);
            border-radius: var(--border-radius);
            cursor: pointer;
            font-family: inherit;
            font-size: 13px;
            font-weight: 500;
            transition: all var(--transition-speed) ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: var(--spacing-sm);
            min-height: 36px;
          }

          .button:hover {
            background: var(--vscode-button-hoverBackground);
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
          }

          .button:active {
            transform: translateY(0);
          }

          .button:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: 2px;
          }

          .button-danger {
            background: var(--vscode-inputValidation-errorBackground);
          }

          .button-success {
            background: #2c5c2c;
          }

          .button-warning {
            background: #5c4c2c;
          }

          .button-secondary {
            background: var(--vscode-badge-background);
          }

          .button-icon {
            font-size: 14px;
            line-height: 1;
          }

          .projects-list {
            display: flex;
            flex-direction: column;
            gap: var(--spacing-sm);
          }

          .project-card {
            background: rgba(0, 0, 0, 0.2);
            padding: var(--spacing-md);
            border-radius: var(--border-radius);
            border-left: 4px solid var(--vscode-textLink-foreground);
            transition: all var(--transition-speed) ease;
            border: 1px solid rgba(255, 255, 255, 0.05);
          }

          .project-card:hover {
            transform: translateX(4px);
            border-color: var(--vscode-textLink-foreground);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          }

          .project-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: var(--spacing-sm);
          }

          .project-status {
            padding: var(--spacing-xs) var(--spacing-sm);
            border-radius: var(--border-radius);
            font-size: 0.75em;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .status-initialized {
            background: rgba(137, 209, 133, 0.2);
            color: var(--vscode-successForeground);
            border: 1px solid rgba(137, 209, 133, 0.3);
          }
          .status-active {
            background: rgba(55, 148, 255, 0.2);
            color: var(--vscode-textLink-foreground);
            border: 1px solid rgba(55, 148, 255, 0.3);
          }
          .status-completed {
            background: rgba(204, 167, 0, 0.2);
            color: var(--vscode-warningForeground);
            border: 1px solid rgba(204, 167, 0, 0.3);
          }
          .status-error {
            background: rgba(244, 135, 113, 0.2);
            color: var(--vscode-errorForeground);
            border: 1px solid rgba(244, 135, 113, 0.3);
          }

          .project-details {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: var(--spacing-sm);
            margin-top: var(--spacing-sm);
            font-size: 0.85em;
          }

          .detail-item {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .detail-label {
            font-size: 0.75em;
            opacity: 0.7;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }

          .loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: var(--spacing-xl);
            gap: var(--spacing-md);
          }

          .spinner {
            border: 3px solid rgba(255, 255, 255, 0.1);
            border-top: 3px solid var(--vscode-textLink-foreground);
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: var(--spacing-md);
            border-radius: var(--border-radius);
            background: var(--vscode-editor-inactiveSelectionBackground);
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
            z-index: 1000;
            max-width: 400px;
            animation: slideIn 0.3s ease-out;
            border: 1px solid rgba(255, 255, 255, 0.1);
          }

          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }

          .notification-success {
            border-left: 4px solid var(--vscode-successForeground);
          }

          .notification-error {
            border-left: 4px solid var(--vscode-errorForeground);
          }

          .notification-warning {
            border-left: 4px solid var(--vscode-warningForeground);
          }

          .notification-info {
            border-left: 4px solid var(--vscode-textLink-foreground);
          }

          .notification-close {
            position: absolute;
            top: 8px;
            right: 8px;
            background: none;
            border: none;
            color: inherit;
            cursor: pointer;
            font-size: 16px;
            padding: 4px;
            opacity: 0.7;
            transition: opacity var(--transition-speed) ease;
          }

          .notification-close:hover {
            opacity: 1;
          }

          .empty-state {
            text-align: center;
            padding: var(--spacing-xl);
            opacity: 0.6;
            font-style: italic;
            border: 2px dashed rgba(255, 255, 255, 0.1);
            border-radius: var(--border-radius);
            background: rgba(0, 0, 0, 0.1);
          }

          .flex-row {
            display: flex;
            align-items: center;
            gap: var(--spacing-sm);
          }

          .flex-grow {
            flex-grow: 1;
          }

          .hidden {
            display: none !important;
          }

          .monospace {
            font-family: 'SF Mono', Monaco, 'Cascadia Mono', 'Segoe UI Mono', 'Roboto Mono', 'Ubuntu Mono', monospace;
            font-size: 0.9em;
            opacity: 0.8;
          }

          .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 0.75em;
            font-weight: 600;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
          }

          .tooltip {
            position: relative;
          }

          .tooltip:hover::after {
            content: attr(data-tooltip);
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            padding: 6px 10px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            color: var(--vscode-foreground);
            border-radius: var(--border-radius);
            font-size: 0.85em;
            white-space: nowrap;
            z-index: 1000;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          }

          /* Responsive adjustments */
          @media (max-width: 768px) {
            .dashboard {
              gap: var(--spacing-md);
            }

            .card {
              padding: var(--spacing-md);
            }

            .stats-grid {
              grid-template-columns: repeat(2, 1fr);
            }

            .actions-grid {
              grid-template-columns: 1fr;
            }

            .project-details {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 480px) {
            body {
              padding: var(--spacing-sm);
            }

            .stats-grid {
              grid-template-columns: 1fr;
            }

            .connection-status {
              flex-direction: column;
              align-items: flex-start;
              gap: var(--spacing-sm);
            }
          }
        </style>
      </head>
      <body>
        <div class="dashboard">
          <div class="card">
            <h1>RAG MCP Dashboard</h1>

            <div id="connectionStatus" class="connection-status">
              <div id="statusIndicator" class="status-indicator status-disconnected"></div>
              <span id="statusText">Disconnected from RAG MCP Server</span>
              <button id="testConnectionBtn" class="button">Test Connection</button>
            </div>

            <div id="loadingIndicator" class="loading">
              <div class="spinner"></div>
              <p>Loading system status...</p>
            </div>

            <div id="content" class="hidden">
              <div class="card">
                <h2>System Status</h2>
                <div class="stats-grid">
                  <div class="stat-card">
                    <div class="stat-label">Initialized</div>
                    <div id="initializedStatus" class="stat-value">❌</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">Active Jobs</div>
                    <div id="activeJobs" class="stat-value">0</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">Total Projects</div>
                    <div id="totalProjects" class="stat-value">0</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">Last Updated</div>
                    <div id="lastUpdated" class="stat-value">-</div>
                  </div>
                </div>

                <div style="margin-top: 20px;">
                  <h3>Allowed Actions</h3>
                  <div id="allowedActions" class="actions-grid">
                    <!-- Dynamically populated -->
                  </div>
                </div>
              </div>

              <div class="card">
                <h2>Quick Actions</h2>
                <div class="actions-grid">
                  <button id="refreshBtn" class="button">
                    <span class="button-icon">🔄</span>
                    Refresh Status
                  </button>
                  <button id="initProjectBtn" class="button button-success">
                    <span class="button-icon">➕</span>
                    Initialize Project
                  </button>
                  <button id="activatePipelineBtn" class="button">
                    <span class="button-icon">🚀</span>
                    Activate Pipeline
                  </button>
                  <button id="queryRagBtn" class="button">
                    <span class="button-icon">🔍</span>
                    Query RAG
                  </button>
                  <button id="showErrorLogsBtn" class="button button-warning">
                    <span class="button-icon">📋</span>
                    Show Error Logs
                  </button>
                </div>
              </div>

              <div class="card">
                <h2>Projects</h2>
                <div id="projectsList" class="projects-list">
                  <div class="empty-state">
                    No projects found. Initialize a project to get started.
                  </div>
                </div>
              </div>

              <div class="card">
                <h2>Notes for AI</h2>
                <div id="notesForAi" class="empty-state">
                  No notes available.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div id="notificationContainer"></div>

        <script>
          const vscode = acquireVsCodeApi();

          // DOM Elements
          const connectionStatus = document.getElementById('connectionStatus');
          const statusIndicator = document.getElementById('statusIndicator');
          const statusText = document.getElementById('statusText');
          const testConnectionBtn = document.getElementById('testConnectionBtn');
          const loadingIndicator = document.getElementById('loadingIndicator');
          const content = document.getElementById('content');
          const refreshBtn = document.getElementById('refreshBtn');
          const initProjectBtn = document.getElementById('initProjectBtn');
          const activatePipelineBtn = document.getElementById('activatePipelineBtn');
          const queryRagBtn = document.getElementById('queryRagBtn');
          const showErrorLogsBtn = document.getElementById('showErrorLogsBtn');

          // State
          let isConnected = false;

          // Event Listeners
          testConnectionBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'testConnection' });
          });

          refreshBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'refresh' });
          });

          initProjectBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'initProject' });
          });

          activatePipelineBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'activatePipeline' });
          });

          queryRagBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'queryRag' });
          });

          showErrorLogsBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'showErrorLogs' });
          });

          // Message handling
          window.addEventListener('message', (event) => {
            const message = event.data;

            switch (message.command) {
              case 'updateConnectionState':
                updateConnectionState(message.connected, message.testing);
                break;
              case 'updateStatus':
                updateStatus(message);
                break;
              case 'updateProjects':
                updateProjects(message.projects);
                break;
              case 'updateError':
                showNotification('error', message.message, message.details);
                break;
              case 'showNotification':
                showNotification(message.type, message.message, message.details);
                break;
            }
          });

          // UI Update Functions
          function updateConnectionState(connected, testing = false) {
            isConnected = connected;

            statusIndicator.className = 'status-indicator';
            if (testing) {
              statusIndicator.classList.add('status-testing');
              statusText.textContent = 'Testing connection...';
            } else if (connected) {
              statusIndicator.classList.add('status-connected');
              statusText.textContent = 'Connected to RAG MCP Server';
            } else {
              statusIndicator.classList.add('status-disconnected');
              statusText.textContent = 'Disconnected from RAG MCP Server';
            }

            if (connected && loadingIndicator && content) {
              loadingIndicator.classList.add('hidden');
              content.classList.remove('hidden');
            }
          }

          function updateStatus(statusData) {
            // Update status cards
            document.getElementById('initializedStatus').textContent =
              statusData.rag_state?.initialized ? '✅' : '❌';
            document.getElementById('activeJobs').textContent =
              statusData.rag_state?.active_jobs || 0;
            document.getElementById('totalProjects').textContent =
              statusData.rag_state?.total_projects || 0;
            document.getElementById('lastUpdated').textContent =
              statusData.rag_state?.last_updated || 'Never';

            // Update allowed actions
            const allowedActionsContainer = document.getElementById('allowedActions');
            if (statusData.allowed_actions?.length > 0) {
              allowedActionsContainer.innerHTML = statusData.allowed_actions
                .map(action => \`
                  <button class="button" style="font-size: 0.8em;">
                    \${action}
                  </button>
                \`).join('');
            } else {
              allowedActionsContainer.innerHTML = '<div class="empty-state">No actions available</div>';
            }

            // Update notes for AI
            const notesContainer = document.getElementById('notesForAi');
            if (statusData.notes_for_ai?.length > 0) {
              notesContainer.innerHTML = \`
                <ul style="margin: 0; padding-left: 20px;">
                  \${statusData.notes_for_ai.map(note => \`<li>\${note}</li>\`).join('')}
                </ul>
              \`;
            }

            // Show success notification
            showNotification('success', 'Status updated successfully');
          }

          function updateProjects(projects) {
            const projectsList = document.getElementById('projectsList');

            if (projects?.length > 0) {
              projectsList.innerHTML = projects.map(project => \`
                <div class="project-card">
                  <div class="project-header">
                    <h3 style="margin: 0;">\${project.path.split('/').pop() || project.id}</h3>
                    <span class="project-status status-\${project.status}">
                      \${project.status.toUpperCase()}
                    </span>
                  </div>
                  <div style="font-family: monospace; font-size: 0.9em; opacity: 0.8;">
                    \${project.path}
                  </div>
                  <div class="project-details">
                    <div class="detail-item">
                      <span class="detail-label">Files Indexed</span>
                      <span>\${project.files_indexed || 0}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Chunks Created</span>
                      <span>\${project.chunks_created || 0}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Last Activity</span>
                      <span>\${project.last_activity || '-'}</span>
                    </div>
                  </div>
                </div>
              \`).join('');
            } else {
              projectsList.innerHTML = \`
                <div class="empty-state">
                  No projects found. Initialize a project to get started.
                </div>
              \`;
            }
          }

          function showNotification(type, message, details = '') {
            const container = document.getElementById('notificationContainer');
            const notificationId = 'notification-' + Date.now();

            const notification = document.createElement('div');
            notification.id = notificationId;
            notification.className = \`notification notification-\${type}\`;
            notification.innerHTML = \`
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="flex-grow: 1;">
                  <strong>\${message}</strong>
                  \${details ? \`<div style="margin-top: 4px; font-size: 0.9em; opacity: 0.8;">\${details}</div>\` : ''}
                </div>
                <button class="notification-close" onclick="document.getElementById('\${notificationId}').remove()">×</button>
              </div>
            \`;

            container.appendChild(notification);

            // Auto-remove after 5 seconds
            setTimeout(() => {
              const elem = document.getElementById(notificationId);
              if (elem) {
                elem.remove();
              }
            }, 5000);
          }

          // Initial load
          updateConnectionState(false);
        </script>
      </body>
      </html>
    `;
  }

  public dispose(): void {
    this.stopAutoRefresh();

    if (DashboardView.currentPanel === this) {
      DashboardView.currentPanel = undefined;
    }

    this.panel.dispose();
  }
}
