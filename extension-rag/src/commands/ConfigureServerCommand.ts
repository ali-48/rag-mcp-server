import * as vscode from 'vscode';
import { McpClient } from '../services/McpClient';
import { getErrorHandler } from '../services/error-handler';

/**
 * Command handler for configuring the RAG MCP Server connection
 */
export class ConfigureServerCommand {
  private readonly errorHandler = getErrorHandler();

  /**
   * Register the command in the extension
   */
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const command = new ConfigureServerCommand();
    return vscode.commands.registerCommand('rag-mcp.configureServer', () => command.execute(context));
  }

  /**
   * Execute the configuration command
   */
  private async execute(context: vscode.ExtensionContext): Promise<void> {
    try {
      // Get current configuration
      const config = vscode.workspace.getConfiguration('rag-mcp');
      const currentUrl = config.get<string>('serverUrl', 'ws://localhost:3000');
      const currentTimeout = config.get<number>('timeout', 30000);

      // Show input boxes for configuration
      const serverUrl = await vscode.window.showInputBox({
        prompt: 'Enter RAG MCP Server WebSocket URL',
        placeHolder: 'ws://localhost:3000',
        value: currentUrl,
        validateInput: this.validateServerUrl
      });

      if (serverUrl === undefined) {
        return; // User cancelled
      }

      const timeoutStr = await vscode.window.showInputBox({
        prompt: 'Enter timeout for MCP requests (milliseconds)',
        placeHolder: '30000',
        value: currentTimeout.toString(),
        validateInput: this.validateTimeout
      });

      if (timeoutStr === undefined) {
        return; // User cancelled
      }

      const timeout = parseInt(timeoutStr, 10);

      // Validate the new configuration
      const validationResult = await this.validateConfiguration(serverUrl, timeout);
      if (!validationResult.valid) {
        vscode.window.showErrorMessage(`Invalid configuration: ${validationResult.error}`);
        return;
      }

      // Save the configuration
      await config.update('serverUrl', serverUrl, vscode.ConfigurationTarget.Global);
      await config.update('timeout', timeout, vscode.ConfigurationTarget.Global);

      // Show success message
      vscode.window.showInformationMessage(
        `✅ RAG MCP Server configuration updated:\n` +
        `URL: ${serverUrl}\n` +
        `Timeout: ${timeout}ms`
      );

      // Test the connection with new configuration
      const testResult = await this.testConnection(serverUrl, timeout);
      if (testResult.success) {
        vscode.window.showInformationMessage(`✅ Connection test successful: ${testResult.message}`);
      } else {
        vscode.window.showWarningMessage(`⚠️ Configuration saved but connection test failed: ${testResult.message}`);
      }

    } catch (error) {
      await this.errorHandler.handleError(error, {
        operation: 'Configure RAG MCP Server'
      });
    }
  }

  /**
   * Validate server URL input
   */
  private validateServerUrl(value: string): string | undefined {
    if (!value) {
      return 'Server URL is required';
    }

    if (!value.startsWith('ws://') && !value.startsWith('wss://')) {
      return 'URL must start with ws:// or wss://';
    }

    try {
      new URL(value);
      return undefined; // Valid
    } catch (error) {
      return 'Invalid URL format';
    }
  }

  /**
   * Validate timeout input
   */
  private validateTimeout(value: string): string | undefined {
    if (!value) {
      return 'Timeout is required';
    }

    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return 'Timeout must be a number';
    }

    if (num < 1000) {
      return 'Timeout must be at least 1000ms (1 second)';
    }

    if (num > 300000) {
      return 'Timeout must not exceed 300000ms (5 minutes)';
    }

    return undefined; // Valid
  }

  /**
   * Validate the complete configuration
   */
  private async validateConfiguration(serverUrl: string, timeout: number): Promise<{ valid: boolean; error?: string }> {
    try {
      // Basic validation
      if (!serverUrl || !timeout) {
        return { valid: false, error: 'Server URL and timeout are required' };
      }

      // URL format validation
      if (!serverUrl.startsWith('ws://') && !serverUrl.startsWith('wss://')) {
        return { valid: false, error: 'URL must use WebSocket protocol (ws:// or wss://)' };
      }

      // Timeout range validation
      if (timeout < 1000 || timeout > 300000) {
        return { valid: false, error: 'Timeout must be between 1000ms and 300000ms' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Test connection with the new configuration
   */
  private async testConnection(serverUrl: string, timeout: number): Promise<{ success: boolean; message: string }> {
    try {
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Testing RAG MCP Server connection...',
        cancellable: false
      }, async (progress) => {
        progress.report({ message: 'Connecting to server...' });
      });

      // Create a temporary MCP client for testing
      const testClient = new McpClient(serverUrl, timeout);

      try {
        // Try to connect
        await testClient.connect();

        // Try a simple status request
        const result = await testClient.call('get_status', {
          scope: 'global',
          include_notes_for_ai: false,
          include_allowed_actions: false
        });

        // Disconnect
        await testClient.disconnect();

        if (result?.status === 'ok') {
          return {
            success: true,
            message: `Connected successfully to ${serverUrl}. Server is responding.`
          };
        } else {
          return {
            success: false,
            message: `Connected but server returned error: ${result?.message || 'Unknown error'}`
          };
        }
      } finally {
        // Ensure client is disconnected
        try {
          await testClient.disconnect();
        } catch (error) {
          // Ignore disconnect errors during test
        }
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get current configuration summary
   */
  public static getConfigurationSummary(): string {
    const config = vscode.workspace.getConfiguration('rag-mcp');
    const serverUrl = config.get<string>('serverUrl', 'ws://localhost:3000');
    const timeout = config.get<number>('timeout', 30000);
    const autoRefresh = config.get<boolean>('autoRefresh', true);

    return `Server: ${serverUrl}\nTimeout: ${timeout}ms\nAuto-refresh: ${autoRefresh ? 'Enabled' : 'Disabled'}`;
  }

  /**
   * Check if configuration is valid
   */
  public static isConfigurationValid(): boolean {
    const config = vscode.workspace.getConfiguration('rag-mcp');
    const serverUrl = config.get<string>('serverUrl', '');
    const timeout = config.get<number>('timeout', 0);

    return !!serverUrl && serverUrl.startsWith('ws://') && timeout >= 1000 && timeout <= 300000;
  }
}
