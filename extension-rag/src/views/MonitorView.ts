import * as vscode from 'vscode';
import { McpClient } from '../services/McpClient';
import { getErrorHandler } from '../services/error-handler';

export interface ServerHealth {
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  uptime?: number;
  lastCheck?: string;
  metrics: {
    activeConnections: number;
    totalRequests: number;
    errorRate: number;
    responseTime: number;
  };
  components: {
    name: string;
    status: 'up' | 'down' | 'degraded';
    details: string;
  }[];
}

export interface PerformanceMetrics {
  timestamp: string;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkLatency: number;
}

export class MonitorView {
  private static currentPanel: MonitorView | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly mcpClient: McpClient | null;
  private readonly errorHandler = getErrorHandler();
  private serverHealth: ServerHealth = {
    status: 'unknown',
    metrics: {
      activeConnections: 0,
      totalRequests: 0,
      errorRate: 0,
      responseTime: 0
    },
    components: []
  };
  private performanceMetrics: PerformanceMetrics[] = [];
  private refreshInterval: NodeJS.Timeout | null = null;

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

    // Initial load
    this.loadServerHealth();

    // Start auto-refresh
    this.startAutoRefresh(5000); // Refresh every 5 seconds
  }

  public static createOrShow(extensionUri: vscode.Uri, mcpClient: McpClient | null) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (MonitorView.currentPanel) {
      MonitorView.currentPanel.panel.reveal(column);
      return MonitorView.currentPanel;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'ragMonitor',
      'RAG MCP Monitor',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    MonitorView.currentPanel = new MonitorView(panel, extensionUri, mcpClient);
    return MonitorView.currentPanel;
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, mcpClient: McpClient | null) {
    MonitorView.currentPanel = new MonitorView(panel, extensionUri, mcpClient);
  }

  private async loadServerHealth(): Promise<void> {
    try {
      if (!this.mcpClient) {
        throw new Error('MCP Client not available');
      }

      // Get global status from RAG MCP server
      const response = await this.mcpClient.call('get_status', {
        scope: 'global',
        include_notes_for_ai: false,
        include_allowed_actions: false
      });

      const statusData = JSON.parse(response.content[0].text);

      // Parse status data into health metrics
      this.serverHealth = this.parseStatusToHealth(statusData);
      this.serverHealth.lastCheck = new Date().toISOString();

      // Add performance metrics
      this.addPerformanceMetric();

      this.sendMessageToWebview('updateHealth', {
        health: this.serverHealth,
        metrics: this.performanceMetrics
      });
    } catch (error) {
      this.serverHealth = {
        status: 'error',
        metrics: {
          activeConnections: 0,
          totalRequests: 0,
          errorRate: 100,
          responseTime: 0
        },
        components: [{
          name: 'MCP Connection',
          status: 'down',
          details: error instanceof Error ? error.message : 'Connection failed'
        }],
        lastCheck: new Date().toISOString()
      };

      this.sendMessageToWebview('updateError', {
        message: 'Failed to load server health',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private parseStatusToHealth(statusData: any): ServerHealth {
    const components: ServerHealth['components'] = [];
    let overallStatus: ServerHealth['status'] = 'healthy';

    // Parse RAG queue status
    if (statusData.data?.rag_queue) {
      const queue = statusData.data.rag_queue;
      components.push({
        name: 'RAG Queue',
        status: queue.status === 'running' ? 'up' : 'down',
        details: `Jobs: ${queue.job_count || 0}, Active: ${queue.active_jobs || 0}`
      });

      if (queue.status !== 'running') {
        overallStatus = 'error';
      }
    }

    // Parse project status
    if (statusData.data?.projects) {
      const projects = statusData.data.projects;
      const activeProjects = Array.isArray(projects) ? projects.length : 0;
      components.push({
        name: 'Projects',
        status: activeProjects > 0 ? 'up' : 'degraded',
        details: `Active: ${activeProjects}`
      });

      if (activeProjects === 0) {
        overallStatus = overallStatus === 'healthy' ? 'warning' : overallStatus;
      }
    }

    // Parse vector store status
    if (statusData.data?.vector_store) {
      const store = statusData.data.vector_store;
      components.push({
        name: 'Vector Store',
        status: store.status === 'connected' ? 'up' : 'down',
        details: `Type: ${store.type || 'unknown'}`
      });

      if (store.status !== 'connected') {
        overallStatus = 'error';
      }
    }

    // Parse embedding provider status
    if (statusData.data?.embedding_provider) {
      const provider = statusData.data.embedding_provider;
      components.push({
        name: 'Embedding Provider',
        status: provider.status === 'available' ? 'up' : 'down',
        details: `Model: ${provider.model || 'unknown'}`
      });

      if (provider.status !== 'available') {
        overallStatus = overallStatus === 'healthy' ? 'warning' : overallStatus;
      }
    }

    // Calculate metrics from status data
    const metrics = {
      activeConnections: statusData.data?.active_connections || 0,
      totalRequests: statusData.data?.total_requests || 0,
      errorRate: statusData.data?.error_rate || 0,
      responseTime: statusData.data?.avg_response_time || 0
    };

    return {
      status: overallStatus,
      metrics,
      components
    };
  }

  private addPerformanceMetric(): void {
    // Simulate performance metrics (in a real implementation, these would come from the server)
    const metric: PerformanceMetrics = {
      timestamp: new Date().toISOString(),
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      diskUsage: Math.random() * 100,
      networkLatency: Math.random() * 100
    };

    this.performanceMetrics.push(metric);

    // Keep only last 20 metrics
    if (this.performanceMetrics.length > 20) {
      this.performanceMetrics = this.performanceMetrics.slice(-20);
    }
  }

  private async testConnection(): Promise<void> {
    try {
      if (!this.mcpClient) {
        throw new Error('MCP Client not available');
      }

      const startTime = Date.now();
      await this.mcpClient.call('get_status', { scope: 'global' });
      const endTime = Date.now();
      const latency = endTime - startTime;

      this.sendMessageToWebview('showNotification', {
        type: 'success',
        message: 'Connection test successful',
        details: `Latency: ${latency}ms`
      });
    } catch (error) {
      this.sendMessageToWebview('showNotification', {
        type: 'error',
        message: 'Connection test failed',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async restartComponent(componentName: string): Promise<void> {
    try {
      // In a real implementation, this would call a restart endpoint
      // For now, just simulate a restart
      this.sendMessageToWebview('showNotification', {
        type: 'info',
        message: `Restarting ${componentName}`,
        details: 'Component restart initiated...'
      });

      // Simulate restart delay
      setTimeout(() => {
        this.sendMessageToWebview('showNotification', {
          type: 'success',
          message: `${componentName} restarted`,
          details: 'Component is now running'
        });

        // Refresh health after restart
        setTimeout(() => this.loadServerHealth(), 1000);
      }, 2000);
    } catch (error) {
      this.sendMessageToWebview('showNotification', {
        type: 'error',
        message: `Failed to restart ${componentName}`,
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private setupMessageListeners(): void {
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        try {
          switch (message.command) {
            case 'refresh':
              await this.loadServerHealth();
              break;
            case 'testConnection':
              await this.testConnection();
              break;
            case 'restartComponent':
              await this.restartComponent(message.componentName);
              break;
            case 'viewLogs':
              await this.openLogs();
              break;
          }
        } catch (error) {
          await this.errorHandler.handleError(error, {
            operation: `MonitorView message: ${message.command}`
          });
        }
      },
      undefined
    );
  }

  private async openLogs(): Promise<void> {
    try {
      // This would open the LogView
      // For now, just show a notification
      this.sendMessageToWebview('showNotification', {
        type: 'info',
        message: 'Opening logs...',
        details: 'LogView would open here'
      });
    } catch (error) {
      this.sendMessageToWebview('showNotification', {
        type: 'error',
        message: 'Failed to open logs',
        details: error instanceof Error ? error.message : String(error)
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
      if (this.panel.visible) {
        this.loadServerHealth();
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
        <title>RAG MCP Monitor</title>
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

          .monitor-container {
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
          }

          .status-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: var(--spacing-lg);
            padding-bottom: var(--spacing-md);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          }

          .status-indicator {
            display: flex;
            align-items: center;
            gap: var(--spacing-sm);
            padding: var(--spacing-sm) var(--spacing-md);
            border-radius: var(--border-radius);
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .status-healthy {
            background: rgba(137, 209, 133, 0.2);
            color: var(--vscode-successForeground);
            border: 1px solid rgba(137, 209, 133, 0.3);
          }

          .status-warning {
            background: rgba(204, 167, 0, 0.2);
            color: var(--vscode-warningForeground);
            border: 1px solid rgba(204, 167, 0, 0.3);
          }

          .status-error {
            background: rgba(244, 135, 113, 0.2);
            color: var(--vscode-errorForeground);
            border: 1px solid rgba(244, 135, 113, 0.3);
          }

          .status-unknown {
            background: rgba(204, 204, 204, 0.2);
            color: var(--vscode-foreground);
            border: 1px solid rgba(204, 204, 204, 0.3);
          }

          .status-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            display: inline-block;
          }

          .status-dot-healthy {
            background: var(--vscode-successForeground);
          }

          .status-dot-warning {
            background: var(--vscode-warningForeground);
          }

          .status-dot-error {
            background: var(--vscode-errorForeground);
          }

          .status-dot-unknown {
            background: var(--vscode-foreground);
          }

          .actions {
            display: flex;
            gap: var(--spacing-sm);
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

          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: var(--spacing-md);
            margin-bottom: var(--spacing-lg);
          }

          .metric-card {
            background: rgba(0, 0, 0, 0.2);
            border-radius: var(--border-radius);
            padding: var(--spacing-md);
            border: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            flex-direction: column;
            gap: var(--spacing-xs);
          }

          .metric-label {
            font-size: 0.85em;
            opacity: 0.7;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }

          .metric-value {
            font-size: 1.5em;
            font-weight: 600;
            color: var(--vscode-textLink-foreground);
          }

          .metric-unit {
            font-size: 0.8em;
            opacity: 0.7;
          }

          .components-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: var(--spacing-md);
            margin-bottom: var(--spacing-lg);
          }

          .component-card {
            background: rgba(0, 0, 0, 0.2);
            border-radius: var(--border-radius);
            padding: var(--spacing-md);
            border: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .component-info {
            display: flex;
            flex-direction: column;
            gap: var(--spacing-xs);
          }

          .component-name {
            font-weight: 600;
            color: var(--vscode-foreground);
          }

          .component-details {
            font-size: 0.85em;
            opacity: 0.7;
          }

          .component-status {
            display: flex;
            align-items: center;
            gap: var(--spacing-sm);
          }

          .component-status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
          }

          .component-status-up {
            background: var(--vscode-successForeground);
          }

          .component-status-down {
            background: var(--vscode-errorForeground);
          }

          .component-status-degraded {
            background: var(--vscode-warningForeground);
          }

          .component-actions {
            display: flex;
            gap: var(--spacing-xs);
          }

          .component-button {
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: var(--vscode-foreground);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            cursor: pointer;
            transition: all var(--transition-speed) ease;
          }

          .component-button:hover {
            background: rgba(255, 255, 255, 0.1);
          }

          .charts-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: var(--spacing-md);
            margin-bottom: var(--spacing-lg);
          }

          .chart-card {
            background: rgba(0, 0, 0, 0.2);
            border-radius: var(--border-radius);
            padding: var(--spacing-md);
            border: 1px solid rgba(255, 255, 255, 0.1);
          }

          .chart-title {
            font-size: 0.9em;
            font-weight: 600;
            margin-bottom: var(--spacing-md);
            color: var(--vscode-foreground);
          }

          .chart-placeholder {
            height: 150px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: var(--border-radius);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--vscode-foreground);
            opacity: 0.5;
            font-style: italic;
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

          .hidden {
            display: none !important;
          }

          /* Responsive adjustments */
          @media (max-width: 768px) {
            .monitor-container {
              gap: var(--spacing-md);
            }

            .card {
              padding: var(--spacing-md);
            }

            .status-header {
              flex-direction: column;
              align-items: flex-start;
              gap: var(--spacing-md);
            }

            .actions {
              width: 100%;
              justify-content: stretch;
            }

            .button {
              flex: 1;
            }

            .metrics-grid {
              grid-template-columns: 1fr;
            }

            .components-grid {
              grid-template-columns: 1fr;
            }

            .charts-container {
              grid-template-columns: 1fr;
            }
          }
        </style>
      </head>
      <body>
        <div class="monitor-container">
          <div class="card">
            <div class="status-header">
              <div>
                <h1>RAG MCP Server Monitor</h1>
                <div id="lastCheck" style="font-size: 0.85em; opacity: 0.7;">
                  Last check: <span id="lastCheckTime">Never</span>
                </div>
              </div>
              <div class="actions">
                <button id="refreshBtn" class="button">
                  <span class="button-icon">🔄</span>
                  Refresh
                </button>
                <button id="testConnectionBtn" class="button button-secondary">
                  <span class="button-icon">🔗</span>
                  Test Connection
                </button>
                <button id="viewLogsBtn" class="button">
                  <span class="button-icon">📋</span>
                  View Logs
                </button>
              </div>
            </div>

            <div id="statusIndicator" class="status-indicator status-unknown">
              <span class="status-dot status-dot-unknown"></span>
              <span id="statusText">Unknown</span>
            </div>

            <div id="loadingIndicator" class="loading">
              <div class="spinner"></div>
              <p>Loading server health...</p>
            </div>

            <div id="content" class="hidden">
              <h2>Server Metrics</h2>
              <div class="metrics-grid">
                <div class="metric-card">
                  <div class="metric-label">Active Connections</div>
                  <div class="metric-value" id="metricConnections">0</div>
                  <div class="metric-unit">connections</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">Total Requests</div>
                  <div class="metric-value" id="metricRequests">0</div>
                  <div class="metric-unit">requests</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">Error Rate</div>
                  <div class="metric-value" id="metricErrorRate">0</div>
                  <div class="metric-unit">%</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">Response Time</div>
                  <div class="metric-value" id="metricResponseTime">0</div>
                  <div class="metric-unit">ms</div>
                </div>
              </div>

              <h2>System Components</h2>
              <div class="components-grid" id="componentsGrid">
                <!-- Components will be added here -->
              </div>

              <h2>Performance Charts</h2>
              <div class="charts-container">
                <div class="chart-card">
                  <div class="chart-title">CPU Usage</div>
                  <div class="chart-placeholder">Chart: CPU Usage over time</div>
                </div>
                <div class="chart-card">
                  <div class="chart-title">Memory Usage</div>
                  <div class="chart-placeholder">Chart: Memory Usage over time</div>
                </div>
                <div class="chart-card">
                  <div class="chart-title">Network Latency</div>
                  <div class="chart-placeholder">Chart: Network Latency over time</div>
                </div>
              </div>
            </div>

            <div id="errorState" class="hidden">
              <div style="text-align: center; padding: var(--spacing-xl); opacity: 0.6; font-style: italic;">
                Unable to connect to RAG MCP Server. Please check the server status and configuration.
              </div>
            </div>
          </div>
        </div>

        <div id="notificationContainer"></div>

        <script>
          const vscode = acquireVsCodeApi();

          // DOM Elements
          const lastCheckTime = document.getElementById('lastCheckTime');
          const statusIndicator = document.getElementById('statusIndicator');
          const statusText = document.getElementById('statusText');
          const refreshBtn = document.getElementById('refreshBtn');
          const testConnectionBtn = document.getElementById('testConnectionBtn');
          const viewLogsBtn = document.getElementById('viewLogsBtn');
          const loadingIndicator = document.getElementById('loadingIndicator');
          const content = document.getElementById('content');
          const errorState = document.getElementById('errorState');
          const metricConnections = document.getElementById('metricConnections');
          const metricRequests = document.getElementById('metricRequests');
          const metricErrorRate = document.getElementById('metricErrorRate');
          const metricResponseTime = document.getElementById('metricResponseTime');
          const componentsGrid = document.getElementById('componentsGrid');

          // Event Listeners
          refreshBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'refresh' });
          });

          testConnectionBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'testConnection' });
          });

          viewLogsBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'viewLogs' });
          });

          // Message handling
          window.addEventListener('message', (event) => {
            const message = event.data;

            switch (message.command) {
              case 'updateHealth':
                updateHealth(message.health, message.metrics);
                break;
              case 'updateError':
                showNotification('error', message.message, message.details);
                showErrorState();
                break;
              case 'showNotification':
                showNotification(message.type, message.message, message.details);
                break;
            }
          });

          // UI Update Functions
          function updateHealth(health, metrics) {
            // Update status indicator
            statusIndicator.className = \`status-indicator status-\${health.status}\`;
            statusText.textContent = health.status.charAt(0).toUpperCase() + health.status.slice(1);

            // Update last check time
            if (health.lastCheck) {
              const date = new Date(health.lastCheck);
              lastCheckTime.textContent = date.toLocaleTimeString();
            }

            // Update metrics
            metricConnections.textContent = health.metrics.activeConnections;
            metricRequests.textContent = health.metrics.totalRequests;
            metricErrorRate.textContent = health.metrics.errorRate.toFixed(1);
            metricResponseTime.textContent = health.metrics.responseTime.toFixed(0);

            // Update components
            componentsGrid.innerHTML = health.components.map(component => \`
              <div class="component-card">
                <div class="component-info">
                  <div class="component-name">\${component.name}</div>
                  <div class="component-details">\${component.details}</div>
                </div>
                <div class="component-status">
                  <div class="component-status-dot component-status-\${component.status}"></div>
                  <span>\${component.status.charAt(0).toUpperCase() + component.status.slice(1)}</span>
                  <div class="component-actions">
                    <button class="component-button" onclick="vscode.postMessage({ command: 'restartComponent', componentName: '\${component.name}' })">
                      Restart
                    </button>
                  </div>
                </div>
              </div>
            \`).join('');

            // Show content
            loadingIndicator.classList.add('hidden');
            errorState.classList.add('hidden');
            content.classList.remove('hidden');
          }

          function showErrorState() {
            loadingIndicator.classList.add('hidden');
            content.classList.add('hidden');
            errorState.classList.remove('hidden');
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
          vscode.postMessage({ command: 'refresh' });
        </script>
      </body>
      </html>
    `;
  }

  public dispose(): void {
    this.stopAutoRefresh();

    if (MonitorView.currentPanel === this) {
      MonitorView.currentPanel = undefined;
    }

    this.panel.dispose();
  }
}
