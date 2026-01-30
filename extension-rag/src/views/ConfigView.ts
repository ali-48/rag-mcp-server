import * as vscode from 'vscode';
import { McpClient } from '../services/McpClient';
import { getErrorHandler } from '../services/error-handler';

export interface ServerConfig {
  url: string;
  timeout: number;
  options: {
    enableAutoConnect: boolean;
    enableLogging: boolean;
    maxRetries: number;
    retryDelay: number;
  };
}

export class ConfigView {
  private static currentPanel: ConfigView | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly mcpClient: McpClient | null;
  private readonly errorHandler = getErrorHandler();
  private currentConfig: ServerConfig | null = null;

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

    // Load current configuration
    this.loadCurrentConfig();
  }

  public static createOrShow(extensionUri: vscode.Uri, mcpClient: McpClient | null) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (ConfigView.currentPanel) {
      ConfigView.currentPanel.panel.reveal(column);
      return ConfigView.currentPanel;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'ragConfig',
      'RAG MCP Configuration',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    ConfigView.currentPanel = new ConfigView(panel, extensionUri, mcpClient);
    return ConfigView.currentPanel;
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, mcpClient: McpClient | null) {
    ConfigView.currentPanel = new ConfigView(panel, extensionUri, mcpClient);
  }

  private async loadCurrentConfig(): Promise<void> {
    try {
      // Load configuration from VS Code settings
      const config = vscode.workspace.getConfiguration('rag-mcp');
      this.currentConfig = {
        url: config.get('server.url', 'http://localhost:3000'),
        timeout: config.get('server.timeout', 30000),
        options: {
          enableAutoConnect: config.get('options.enableAutoConnect', true),
          enableLogging: config.get('options.enableLogging', true),
          maxRetries: config.get('options.maxRetries', 3),
          retryDelay: config.get('options.retryDelay', 1000)
        }
      };

      this.sendMessageToWebview('updateConfig', this.currentConfig);
    } catch (error) {
      this.sendMessageToWebview('updateError', {
        message: 'Failed to load configuration',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async saveConfig(config: ServerConfig): Promise<void> {
    try {
      const ragConfig = vscode.workspace.getConfiguration('rag-mcp');

      await ragConfig.update('server.url', config.url, vscode.ConfigurationTarget.Global);
      await ragConfig.update('server.timeout', config.timeout, vscode.ConfigurationTarget.Global);
      await ragConfig.update('options.enableAutoConnect', config.options.enableAutoConnect, vscode.ConfigurationTarget.Global);
      await ragConfig.update('options.enableLogging', config.options.enableLogging, vscode.ConfigurationTarget.Global);
      await ragConfig.update('options.maxRetries', config.options.maxRetries, vscode.ConfigurationTarget.Global);
      await ragConfig.update('options.retryDelay', config.options.retryDelay, vscode.ConfigurationTarget.Global);

      this.currentConfig = config;
      this.sendMessageToWebview('showNotification', {
        type: 'success',
        message: 'Configuration saved successfully'
      });
    } catch (error) {
      this.sendMessageToWebview('showNotification', {
        type: 'error',
        message: 'Failed to save configuration',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async testConnection(config: ServerConfig): Promise<void> {
    try {
      this.sendMessageToWebview('updateConnectionState', { testing: true });

      // Create a temporary client for testing
      const testClient = new McpClient(config.url, config.timeout);
      await testClient.connect();
      await testClient.disconnect();

      this.sendMessageToWebview('updateConnectionState', {
        testing: false,
        connected: true
      });
      this.sendMessageToWebview('showNotification', {
        type: 'success',
        message: '✅ Connection test successful'
      });
    } catch (error) {
      this.sendMessageToWebview('updateConnectionState', {
        testing: false,
        connected: false
      });
      this.sendMessageToWebview('showNotification', {
        type: 'error',
        message: '❌ Connection test failed',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private setupMessageListeners(): void {
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        try {
          switch (message.command) {
            case 'saveConfig':
              await this.saveConfig(message.config);
              break;
            case 'testConnection':
              await this.testConnection(message.config);
              break;
            case 'resetToDefaults':
              await this.resetToDefaults();
              break;
          }
        } catch (error) {
          await this.errorHandler.handleError(error, {
            operation: `ConfigView message: ${message.command}`
          });
        }
      },
      undefined
    );
  }

  private async resetToDefaults(): Promise<void> {
    const defaultConfig: ServerConfig = {
      url: 'http://localhost:3000',
      timeout: 30000,
      options: {
        enableAutoConnect: true,
        enableLogging: true,
        maxRetries: 3,
        retryDelay: 1000
      }
    };

    await this.saveConfig(defaultConfig);
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

  private getWebviewContent(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>RAG MCP Configuration</title>
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

          .config-container {
            display: flex;
            flex-direction: column;
            gap: var(--spacing-lg);
            max-width: 800px;
            margin: 0 auto;
          }

          .card {
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: var(--border-radius-lg);
            padding: var(--spacing-lg);
            box-shadow: var(--card-shadow);
            border: 1px solid rgba(255, 255, 255, 0.05);
          }

          .form-group {
            margin-bottom: var(--spacing-md);
          }

          .form-label {
            display: block;
            margin-bottom: var(--spacing-xs);
            font-weight: 500;
            color: var(--vscode-foreground);
          }

          .form-help {
            font-size: 0.85em;
            opacity: 0.7;
            margin-top: var(--spacing-xs);
            margin-bottom: var(--spacing-sm);
          }

          .form-input {
            width: 100%;
            padding: var(--spacing-sm) var(--spacing-md);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: var(--border-radius);
            font-family: inherit;
            font-size: 13px;
            transition: border-color var(--transition-speed) ease;
          }

          .form-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
          }

          .form-input[type="number"] {
            width: 200px;
          }

          .checkbox-group {
            display: flex;
            align-items: center;
            gap: var(--spacing-sm);
            margin-bottom: var(--spacing-sm);
          }

          .checkbox-input {
            margin: 0;
          }

          .checkbox-label {
            font-size: 13px;
            color: var(--vscode-foreground);
          }

          .actions {
            display: flex;
            gap: var(--spacing-sm);
            margin-top: var(--spacing-lg);
            padding-top: var(--spacing-md);
            border-top: 1px solid rgba(255, 255, 255, 0.1);
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

          .flex-row {
            display: flex;
            align-items: center;
            gap: var(--spacing-sm);
          }

          .flex-grow {
            flex-grow: 1;
          }

          /* Responsive adjustments */
          @media (max-width: 768px) {
            .config-container {
              gap: var(--spacing-md);
            }

            .card {
              padding: var(--spacing-md);
            }

            .actions {
              flex-direction: column;
            }
          }

          @media (max-width: 480px) {
            body {
              padding: var(--spacing-sm);
            }

            .form-input[type="number"] {
              width: 100%;
            }
          }
        </style>
      </head>
      <body>
        <div class="config-container">
          <div class="card">
            <h1>RAG MCP Configuration</h1>

            <div id="connectionStatus" class="connection-status">
              <div id="statusIndicator" class="status-indicator status-disconnected"></div>
              <span id="statusText">Not connected</span>
            </div>

            <form id="configForm">
              <div class="card">
                <h2>Server Settings</h2>

                <div class="form-group">
                  <label class="form-label" for="serverUrl">Server URL</label>
                  <div class="form-help">
                    URL of the RAG MCP Server (e.g., http://localhost:3000)
                  </div>
                  <input type="text" id="serverUrl" class="form-input" placeholder="http://localhost:3000" required>
                </div>

                <div class="form-group">
                  <label class="form-label" for="timeout">Timeout (ms)</label>
                  <div class="form-help">
                    Request timeout in milliseconds
                  </div>
                  <input type="number" id="timeout" class="form-input" min="1000" max="60000" step="1000" value="30000">
                </div>
              </div>

              <div class="card">
                <h2>Connection Options</h2>

                <div class="checkbox-group">
                  <input type="checkbox" id="enableAutoConnect" class="checkbox-input" checked>
                  <label class="checkbox-label" for="enableAutoConnect">Enable auto-connect on startup</label>
                </div>

                <div class="checkbox-group">
                  <input type="checkbox" id="enableLogging" class="checkbox-input" checked>
                  <label class="checkbox-label" for="enableLogging">Enable detailed logging</label>
                </div>

                <div class="form-group">
                  <label class="form-label" for="maxRetries">Max Retries</label>
                  <div class="form-help">
                    Maximum number of connection retry attempts
                  </div>
                  <input type="number" id="maxRetries" class="form-input" min="0" max="10" step="1" value="3">
                </div>

                <div class="form-group">
                  <label class="form-label" for="retryDelay">Retry Delay (ms)</label>
                  <div class="form-help">
                    Delay between retry attempts in milliseconds
                  </div>
                  <input type="number" id="retryDelay" class="form-input" min="100" max="10000" step="100" value="1000">
                </div>
              </div>

              <div class="actions">
                <button type="button" id="testConnectionBtn" class="button button-success">
                  <span class="button-icon">🔗</span>
                  Test Connection
                </button>
                <button type="button" id="resetDefaultsBtn" class="button button-secondary">
                  <span class="button-icon">↺</span>
                  Reset to Defaults
                </button>
                <button type="submit" id="saveBtn" class="button">
                  <span class="button-icon">💾</span>
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>

        <div id="notificationContainer"></div>

        <script>
          const vscode = acquireVsCodeApi();

          // DOM Elements
          const configForm = document.getElementById('configForm');
          const serverUrlInput = document.getElementById('serverUrl');
          const timeoutInput = document.getElementById('timeout');
          const enableAutoConnectInput = document.getElementById('enableAutoConnect');
          const enableLoggingInput = document.getElementById('enableLogging');
          const maxRetriesInput = document.getElementById('maxRetries');
          const retryDelayInput = document.getElementById('retryDelay');
          const testConnectionBtn = document.getElementById('testConnectionBtn');
          const resetDefaultsBtn = document.getElementById('resetDefaultsBtn');
          const saveBtn = document.getElementById('saveBtn');
          const connectionStatus = document.getElementById('connectionStatus');
          const statusIndicator = document.getElementById('statusIndicator');
          const statusText = document.getElementById('statusText');

          // State
          let isTesting = false;

          // Event Listeners
          configForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveConfig();
          });

          testConnectionBtn.addEventListener('click', () => {
            testConnection();
          });

          resetDefaultsBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'resetToDefaults' });
          });

          // Message handling
          window.addEventListener('message', (event) => {
            const message = event.data;

            switch (message.command) {
              case 'updateConfig':
                updateForm(message);
                break;
              case 'updateConnectionState':
                updateConnectionState(message.connected, message.testing);
                break;
              case 'showNotification':
                showNotification(message.type, message.message, message.details);
                break;
              case 'updateError':
                showNotification('error', message.message, message.details);
                break;
            }
          });

          // Form Functions
          function updateForm(config) {
            serverUrlInput.value = config.url || 'http://localhost:3000';
            timeoutInput.value = config.timeout || 30000;
            enableAutoConnectInput.checked = config.options?.enableAutoConnect !== false;
            enableLoggingInput.checked = config.options?.enableLogging !== false;
            maxRetriesInput.value = config.options?.maxRetries || 3;
            retryDelayInput.value = config.options?.retryDelay || 1000;
          }

          function getConfigFromForm() {
            return {
              url: serverUrlInput.value.trim(),
              timeout: parseInt(timeoutInput.value, 10),
              options: {
                enableAutoConnect: enableAutoConnectInput.checked,
                enableLogging: enableLoggingInput.checked,
                maxRetries: parseInt(maxRetriesInput.value, 10),
                retryDelay: parseInt(retryDelayInput.value, 10)
              }
            };
          }

          function validateConfig(config) {
            if (!config.url) {
              showNotification('error', 'Server URL is required');
              return false;
            }

            try {
              new URL(config.url);
            } catch (e) {
              showNotification('error', 'Invalid URL format');
              return false;
            }

            if (config.timeout < 1000 || config.timeout > 60000) {
              showNotification('error', 'Timeout must be between 1000 and 60000 ms');
              return false;
            }

            if (config.options.maxRetries < 0 || config.options.maxRetries > 10) {
              showNotification('error', 'Max retries must be between 0 and 10');
              return false;
            }

            if (config.options.retryDelay < 100 || config.options.retryDelay > 10000) {
              showNotification('error', 'Retry delay must be between 100 and 10000 ms');
              return false;
            }

            return true;
          }

          function saveConfig() {
            const config = getConfigFromForm();

            if (!validateConfig(config)) {
              return;
            }

            vscode.postMessage({
              command: 'saveConfig',
              config: config
            });
          }

          function testConnection() {
            const config = getConfigFromForm();

            if (!validateConfig(config)) {
              return;
            }

            vscode.postMessage({
              command: 'testConnection',
              config: config
            });
          }

          function updateConnectionState(connected, testing = false) {
            isTesting = testing;

            statusIndicator.className = 'status-indicator';
            if (testing) {
              statusIndicator.classList.add('status-testing');
              statusText.textContent = 'Testing connection...';
            } else if (connected) {
              statusIndicator.classList.add('status-connected');
              statusText.textContent = 'Connected';
            } else {
              statusIndicator.classList.add('status-disconnected');
              statusText.textContent = 'Not connected';
            }

            // Update button states
            testConnectionBtn.disabled = testing;
            saveBtn.disabled = testing;
            resetDefaultsBtn.disabled = testing;
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
    if (ConfigView.currentPanel === this) {
      ConfigView.currentPanel = undefined;
    }

    this.panel.dispose();
  }
}
