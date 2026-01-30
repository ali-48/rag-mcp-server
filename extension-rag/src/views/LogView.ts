import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { McpClient } from '../services/McpClient';
import { getErrorHandler } from '../services/error-handler';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: string;
  message: string;
  details?: any;
}

export interface LogFilter {
  levels: ('info' | 'warn' | 'error' | 'debug')[];
  categories: string[];
  searchText: string;
  timeRange: {
    start: Date | null;
    end: Date | null;
  };
}

export class LogView {
  private static currentPanel: LogView | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly mcpClient: McpClient | null;
  private readonly errorHandler = getErrorHandler();
  private logs: LogEntry[] = [];
  private currentFilter: LogFilter = {
    levels: ['info', 'warn', 'error', 'debug'],
    categories: [],
    searchText: '',
    timeRange: {
      start: null,
      end: null
    }
  };
  private refreshInterval: NodeJS.Timeout | null = null;
  private logFiles: string[] = [];

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
    this.discoverLogFiles();
    this.loadLogs();

    // Start auto-refresh
    this.startAutoRefresh(10000); // Refresh every 10 seconds
  }

  public static createOrShow(extensionUri: vscode.Uri, mcpClient: McpClient | null) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (LogView.currentPanel) {
      LogView.currentPanel.panel.reveal(column);
      return LogView.currentPanel;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'ragLogs',
      'RAG MCP Logs',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    LogView.currentPanel = new LogView(panel, extensionUri, mcpClient);
    return LogView.currentPanel;
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, mcpClient: McpClient | null) {
    LogView.currentPanel = new LogView(panel, extensionUri, mcpClient);
  }

  private discoverLogFiles(): void {
    try {
      // Look for log files in the workspace
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return;
      }

      const workspacePath = workspaceFolders[0].uri.fsPath;
      const logsPath = path.join(workspacePath, 'logs');

      if (fs.existsSync(logsPath) && fs.statSync(logsPath).isDirectory()) {
        const files = fs.readdirSync(logsPath)
          .filter(file => file.endsWith('.log'))
          .map(file => path.join(logsPath, file));

        this.logFiles = files;
        this.sendMessageToWebview('updateLogFiles', { files: this.logFiles.map(f => path.basename(f)) });
      }
    } catch (error) {
      console.warn('Failed to discover log files:', error);
    }
  }

  private async loadLogs(): Promise<void> {
    try {
      const allLogs: LogEntry[] = [];

      // Load from each log file
      for (const logFile of this.logFiles) {
        try {
          const fileLogs = await this.parseLogFile(logFile);
          allLogs.push(...fileLogs);
        } catch (error) {
          console.warn(`Failed to parse log file ${logFile}:`, error);
        }
      }

      // Try to get real-time logs via MCP if available
      if (this.mcpClient) {
        try {
          const realtimeLogs = await this.getRealtimeLogs();
          allLogs.push(...realtimeLogs);
        } catch (error) {
          // Silently fail - realtime logs are optional
        }
      }

      // Sort by timestamp (newest first)
      allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      this.logs = allLogs;
      this.applyFilterAndSend();
    } catch (error) {
      this.sendMessageToWebview('updateError', {
        message: 'Failed to load logs',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async parseLogFile(logFile: string): Promise<LogEntry[]> {
    const logs: LogEntry[] = [];

    try {
      const content = fs.readFileSync(logFile, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          // Try to parse as JSON structured log
          const parsed = JSON.parse(line);
          if (parsed.timestamp && parsed.level && parsed.category && parsed.message) {
            logs.push({
              timestamp: parsed.timestamp,
              level: parsed.level,
              category: parsed.category,
              message: parsed.message,
              details: parsed.details
            });
          }
        } catch {
          // If not JSON, try to parse as text log
          const textLog = this.parseTextLog(line);
          if (textLog) {
            logs.push(textLog);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to read log file ${logFile}:`, error);
    }

    return logs;
  }

  private parseTextLog(line: string): LogEntry | null {
    // Simple text log parser for common formats
    const timestampMatch = line.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]/);
    const levelMatch = line.match(/(INFO|WARN|ERROR|DEBUG)/i);
    const categoryMatch = line.match(/\[([^\]]+)\]/g);

    if (timestampMatch && levelMatch) {
      const timestamp = timestampMatch[1];
      const level = levelMatch[1].toLowerCase() as 'info' | 'warn' | 'error' | 'debug';
      const category = categoryMatch && categoryMatch.length > 1 ? categoryMatch[1].replace(/[\[\]]/g, '') : 'unknown';

      // Extract message (everything after the last bracket)
      const messageStart = line.lastIndexOf(']') + 1;
      const message = line.substring(messageStart).trim();

      return {
        timestamp,
        level,
        category,
        message
      };
    }

    return null;
  }

  private async getRealtimeLogs(): Promise<LogEntry[]> {
    // This would use MCP to get real-time logs
    // For now, return empty array
    return [];
  }

  private applyFilterAndSend(): void {
    const filteredLogs = this.logs.filter(log => {
      // Filter by level
      if (!this.currentFilter.levels.includes(log.level)) {
        return false;
      }

      // Filter by category
      if (this.currentFilter.categories.length > 0 && !this.currentFilter.categories.includes(log.category)) {
        return false;
      }

      // Filter by search text
      if (this.currentFilter.searchText) {
        const searchLower = this.currentFilter.searchText.toLowerCase();
        const logText = `${log.message} ${JSON.stringify(log.details || '')}`.toLowerCase();
        if (!logText.includes(searchLower)) {
          return false;
        }
      }

      // Filter by time range
      const logDate = new Date(log.timestamp);
      if (this.currentFilter.timeRange.start && logDate < this.currentFilter.timeRange.start) {
        return false;
      }
      if (this.currentFilter.timeRange.end && logDate > this.currentFilter.timeRange.end) {
        return false;
      }

      return true;
    });

    this.sendMessageToWebview('updateLogs', {
      logs: filteredLogs,
      total: this.logs.length,
      filtered: filteredLogs.length
    });
  }

  private async clearLogs(): Promise<void> {
    try {
      // Clear in-memory logs
      this.logs = [];

      // Optionally clear log files (commented out for safety)
      // for (const logFile of this.logFiles) {
      //   fs.writeFileSync(logFile, '');
      // }

      this.applyFilterAndSend();
      this.sendMessageToWebview('showNotification', {
        type: 'success',
        message: 'Logs cleared'
      });
    } catch (error) {
      this.sendMessageToWebview('showNotification', {
        type: 'error',
        message: 'Failed to clear logs',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async exportLogs(): Promise<void> {
    try {
      const options: vscode.SaveDialogOptions = {
        filters: {
          'JSON Files': ['json'],
          'Text Files': ['txt'],
          'All Files': ['*']
        },
        defaultUri: vscode.Uri.file('rag-logs-export.json')
      };

      const fileUri = await vscode.window.showSaveDialog(options);
      if (fileUri) {
        const exportData = {
          exportedAt: new Date().toISOString(),
          totalLogs: this.logs.length,
          logs: this.logs
        };

        fs.writeFileSync(fileUri.fsPath, JSON.stringify(exportData, null, 2));

        this.sendMessageToWebview('showNotification', {
          type: 'success',
          message: `Logs exported to ${path.basename(fileUri.fsPath)}`
        });
      }
    } catch (error) {
      this.sendMessageToWebview('showNotification', {
        type: 'error',
        message: 'Failed to export logs',
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
              await this.loadLogs();
              break;
            case 'filter':
              this.currentFilter = message.filter;
              this.applyFilterAndSend();
              break;
            case 'clear':
              await this.clearLogs();
              break;
            case 'export':
              await this.exportLogs();
              break;
            case 'openLogFile':
              await this.openLogFile(message.filename);
              break;
          }
        } catch (error) {
          await this.errorHandler.handleError(error, {
            operation: `LogView message: ${message.command}`
          });
        }
      },
      undefined
    );
  }

  private async openLogFile(filename: string): Promise<void> {
    try {
      const logFile = this.logFiles.find(f => path.basename(f) === filename);
      if (logFile) {
        const document = await vscode.workspace.openTextDocument(logFile);
        await vscode.window.showTextDocument(document);
      }
    } catch (error) {
      this.sendMessageToWebview('showNotification', {
        type: 'error',
        message: `Failed to open log file: ${filename}`,
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
        this.loadLogs();
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
        <title>RAG MCP Logs</title>
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

          .log-container {
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

          .controls {
            display: flex;
            flex-wrap: wrap;
            gap: var(--spacing-md);
            margin-bottom: var(--spacing-lg);
            padding-bottom: var(--spacing-md);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          }

          .filter-section {
            display: flex;
            flex-direction: column;
            gap: var(--spacing-sm);
            flex: 1;
            min-width: 200px;
          }

          .filter-label {
            font-size: 0.85em;
            font-weight: 500;
            margin-bottom: var(--spacing-xs);
            color: var(--vscode-foreground);
          }

          .filter-checkboxes {
            display: flex;
            flex-wrap: wrap;
            gap: var(--spacing-sm);
          }

          .filter-checkbox {
            display: flex;
            align-items: center;
            gap: var(--spacing-xs);
          }

          .filter-checkbox input {
            margin: 0;
          }

          .filter-checkbox label {
            font-size: 0.85em;
            color: var(--vscode-foreground);
          }

          .search-input {
            flex: 2;
            min-width: 300px;
          }

          .search-input input {
            width: 100%;
            padding: var(--spacing-sm) var(--spacing-md);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: var(--border-radius);
            font-family: inherit;
            font-size: 13px;
          }

          .search-input input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
          }

          .actions {
            display: flex;
            gap: var(--spacing-sm);
            align-items: flex-end;
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

          .stats {
            display: flex;
            gap: var(--spacing-md);
            margin-bottom: var(--spacing-lg);
            padding: var(--spacing-md);
            background: rgba(0, 0, 0, 0.2);
            border-radius: var(--border-radius);
            border: 1px solid rgba(255, 255, 255, 0.1);
          }

          .stat-item {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .stat-label {
            font-size: 0.75em;
            opacity: 0.7;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }

          .stat-value {
            font-size: 1.2em;
            font-weight: 600;
            color: var(--vscode-textLink-foreground);
          }

          .logs-container {
            max-height: 600px;
            overflow-y: auto;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: var(--border-radius);
            background: rgba(0, 0, 0, 0.1);
          }

          .log-entry {
            padding: var(--spacing-sm) var(--spacing-md);
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            font-family: 'SF Mono', Monaco, 'Cascadia Mono', 'Segoe UI Mono', monospace;
            font-size: 0.85em;
            line-height: 1.5;
          }

          .log-entry:last-child {
            border-bottom: none;
          }

          .log-entry:hover {
            background: rgba(255, 255, 255, 0.05);
          }

          .log-timestamp {
            color: var(--vscode-warningForeground);
            font-size: 0.8em;
            margin-right: var(--spacing-sm);
          }

          .log-level {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.75em;
            font-weight: 600;
            margin-right: var(--spacing-sm);
            text-transform: uppercase;
          }

          .level-info {
            background: rgba(55, 148, 255, 0.2);
            color: var(--vscode-textLink-foreground);
            border: 1px solid rgba(55, 148, 255, 0.3);
          }

          .level-warn {
            background: rgba(204, 167, 0, 0.2);
            color: var(--vscode-warningForeground);
            border: 1px solid rgba(204, 167, 0, 0.3);
          }

          .level-error {
            background: rgba(244, 135, 113, 0.2);
            color: var(--vscode-errorForeground);
            border: 1px solid rgba(244, 135, 113, 0.3);
          }

          .level-debug {
            background: rgba(137, 209, 133, 0.2);
            color: var(--vscode-successForeground);
            border: 1px solid rgba(137, 209, 133, 0.3);
          }

          .log-category {
            color: var(--vscode-textLink-foreground);
            font-weight: 500;
            margin-right: var(--spacing-sm);
          }

          .log-message {
            color: var(--vscode-foreground);
          }

          .log-details {
            margin-top: var(--spacing-xs);
            padding-left: var(--spacing-md);
            color: var(--vscode-foreground);
            opacity: 0.8;
            font-size: 0.8em;
            white-space: pre-wrap;
            word-break: break-all;
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
            .log-container {
              gap: var(--spacing-md);
            }

            .card {
              padding: var(--spacing-md);
            }

            .controls {
              flex-direction: column;
            }

            .search-input {
              min-width: 100%;
            }

            .actions {
              width: 100%;
              justify-content: stretch;
            }

            .button {
              flex: 1;
            }
          }
        </style>
      </head>
      <body>
        <div class="log-container">
          <div class="card">
            <h1>RAG MCP Logs</h1>

            <div class="stats">
              <div class="stat-item">
                <span class="stat-label">Total Logs</span>
                <span id="totalLogs" class="stat-value">0</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Filtered</span>
                <span id="filteredLogs" class="stat-value">0</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Log Files</span>
                <span id="logFilesCount" class="stat-value">0</span>
              </div>
            </div>

            <div class="controls">
              <div class="filter-section">
                <div class="filter-label">Log Levels</div>
                <div class="filter-checkboxes">
                  <div class="filter-checkbox">
                    <input type="checkbox" id="filterInfo" checked>
                    <label for="filterInfo">Info</label>
                  </div>
                  <div class="filter-checkbox">
                    <input type="checkbox" id="filterWarn" checked>
                    <label for="filterWarn">Warn</label>
                  </div>
                  <div class="filter-checkbox">
                    <input type="checkbox" id="filterError" checked>
                    <label for="filterError">Error</label>
                  </div>
                  <div class="filter-checkbox">
                    <input type="checkbox" id="filterDebug" checked>
                    <label for="filterDebug">Debug</label>
                  </div>
                </div>
              </div>

              <div class="filter-section search-input">
                <div class="filter-label">Search</div>
                <input type="text" id="searchInput" placeholder="Search in logs...">
              </div>

              <div class="actions">
                <button id="refreshBtn" class="button">
                  <span class="button-icon">🔄</span>
                  Refresh
                </button>
                <button id="clearBtn" class="button button-warning">
                  <span class="button-icon">🗑️</span>
                  Clear
                </button>
                <button id="exportBtn" class="button button-success">
                  <span class="button-icon">📤</span>
                  Export
                </button>
              </div>
            </div>

            <div id="loadingIndicator" class="loading">
              <div class="spinner"></div>
              <p>Loading logs...</p>
            </div>

            <div id="logsContainer" class="logs-container hidden">
              <div id="logsList"></div>
            </div>

            <div id="emptyState" class="empty-state hidden">
              No logs found. Logs will appear here when RAG MCP Server is active.
            </div>
          </div>
        </div>

        <div id="notificationContainer"></div>

        <script>
          const vscode = acquireVsCodeApi();

          // DOM Elements
          const totalLogsEl = document.getElementById('totalLogs');
          const filteredLogsEl = document.getElementById('filteredLogs');
          const logFilesCountEl = document.getElementById('logFilesCount');
          const filterInfo = document.getElementById('filterInfo');
          const filterWarn = document.getElementById('filterWarn');
          const filterError = document.getElementById('filterError');
          const filterDebug = document.getElementById('filterDebug');
          const searchInput = document.getElementById('searchInput');
          const refreshBtn = document.getElementById('refreshBtn');
          const clearBtn = document.getElementById('clearBtn');
          const exportBtn = document.getElementById('exportBtn');
          const loadingIndicator = document.getElementById('loadingIndicator');
          const logsContainer = document.getElementById('logsContainer');
          const logsList = document.getElementById('logsList');
          const emptyState = document.getElementById('emptyState');

          // State
          let currentLogs = [];
          let currentFilter = {
            levels: ['info', 'warn', 'error', 'debug'],
            searchText: ''
          };

          // Event Listeners
          filterInfo.addEventListener('change', updateFilter);
          filterWarn.addEventListener('change', updateFilter);
          filterError.addEventListener('change', updateFilter);
          filterDebug.addEventListener('change', updateFilter);
          searchInput.addEventListener('input', updateFilter);

          refreshBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'refresh' });
          });

          clearBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all logs? This cannot be undone.')) {
              vscode.postMessage({ command: 'clear' });
            }
          });

          exportBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'export' });
          });

          // Message handling
          window.addEventListener('message', (event) => {
            const message = event.data;

            switch (message.command) {
              case 'updateLogs':
                updateLogs(message.logs, message.total, message.filtered);
                break;
              case 'updateLogFiles':
                updateLogFiles(message.files);
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
          function updateFilter() {
            const levels = [];
            if (filterInfo.checked) levels.push('info');
            if (filterWarn.checked) levels.push('warn');
            if (filterError.checked) levels.push('error');
            if (filterDebug.checked) levels.push('debug');

            currentFilter = {
              levels,
              searchText: searchInput.value.trim()
            };

            vscode.postMessage({
              command: 'filter',
              filter: currentFilter
            });
          }

          function updateLogs(logs, total, filtered) {
            currentLogs = logs;

            totalLogsEl.textContent = total;
            filteredLogsEl.textContent = filtered;

            if (logs.length === 0) {
              logsContainer.classList.add('hidden');
              emptyState.classList.remove('hidden');
            } else {
              logsContainer.classList.remove('hidden');
              emptyState.classList.add('hidden');

              logsList.innerHTML = logs.map(log => \`
                <div class="log-entry">
                  <div>
                    <span class="log-timestamp">\${formatTimestamp(log.timestamp)}</span>
                    <span class="log-level level-\${log.level}">\${log.level}</span>
                    <span class="log-category">\${log.category}</span>
                    <span class="log-message">\${escapeHtml(log.message)}</span>
                  </div>
                  \${log.details ? \`
                    <div class="log-details">
                      \${escapeHtml(JSON.stringify(log.details, null, 2))}
                    </div>
                  \` : ''}
                </div>
              \`).join('');
            }

            loadingIndicator.classList.add('hidden');
          }

          function updateLogFiles(files) {
            logFilesCountEl.textContent = files.length;
          }

          function formatTimestamp(timestamp) {
            try {
              const date = new Date(timestamp);
              return date.toLocaleTimeString();
            } catch {
              return timestamp;
            }
          }

          function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
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
          updateFilter();
        </script>
      </body>
      </html>
    `;
  }

  public dispose(): void {
    this.stopAutoRefresh();

    if (LogView.currentPanel === this) {
      LogView.currentPanel = undefined;
    }

    this.panel.dispose();
  }
}
