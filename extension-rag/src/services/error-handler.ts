import * as vscode from 'vscode';

export interface McpErrorDetails {
  code?: number;
  message: string;
  tool?: string;
  params?: any;
  timestamp: Date;
  stack?: string;
  source?: 'mcp' | 'websocket' | 'validation' | 'network' | 'unknown';
}

export interface ErrorHandlingOptions {
  maxRetries?: number;
  retryDelay?: number; // ms
  showNotification?: boolean;
  logToOutputChannel?: boolean;
}

export class ErrorHandler {
  private outputChannel: vscode.OutputChannel;
  private maxRetries: number;
  private retryDelay: number;
  private showNotification: boolean;
  private logToOutputChannel: boolean;

  constructor(options: ErrorHandlingOptions = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelay = options.retryDelay ?? 1000;
    this.showNotification = options.showNotification ?? true;
    this.logToOutputChannel = options.logToOutputChannel ?? true;

    this.outputChannel = vscode.window.createOutputChannel('RAG MCP Errors');
  }

  /**
   * Handle an error with grace and user-friendly messages
   */
  async handleError(error: any, context: {
    tool?: string;
    params?: any;
    operation?: string;
    retryCallback?: () => Promise<any>;
  } = {}): Promise<void> {
    const errorDetails = this.normalizeError(error, context);

    // Log to output channel
    if (this.logToOutputChannel) {
      this.logError(errorDetails);
    }

    // Show notification to user (if enabled)
    if (this.showNotification) {
      this.showUserNotification(errorDetails);
    }

    // Log to console for debugging
    console.error('RAG MCP Error:', errorDetails);
  }

  /**
   * Execute an operation with automatic retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: {
      tool?: string;
      description?: string;
    } = {}
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Log the failed attempt
        const errorDetails = this.normalizeError(error, {
          tool: context.tool,
          operation: context.description || 'Unknown operation',
        });

        if (attempt < this.maxRetries) {
          // Wait before retrying
          await this.delay(this.retryDelay * attempt); // Exponential backoff
        }
      }
    }

    // All retries failed
    await this.handleError(lastError, {
      tool: context.tool,
      operation: `Failed after ${this.maxRetries} attempts: ${context.description}`
    });
    throw lastError;
  }

  /**
   * Show a user-friendly error message based on error type
   */
  private showUserNotification(error: McpErrorDetails): void {
    let message = '';
    let details = '';

    // Categorize error and create user-friendly message
    switch (error.source) {
      case 'websocket':
        message = 'Connection to RAG server lost';
        details = 'Please check if the RAG MCP server is running and accessible.';
        break;

      case 'validation':
        message = 'Invalid request parameters';
        details = `The parameters for "${error.tool}" are invalid.`;
        break;

      case 'mcp':
        message = `MCP tool error: ${error.tool || 'Unknown tool'}`;
        details = error.message;
        break;

      case 'network':
        message = 'Network error';
        details = 'Check your internet connection and server accessibility.';
        break;

      default:
        message = 'An error occurred';
        details = error.message || 'Unknown error';
    }

    // Show error notification with optional "Show Details" button
    vscode.window.showErrorMessage(
      `${message}. Click for details.`,
      'Show Details',
      'Dismiss'
    ).then(selection => {
      if (selection === 'Show Details') {
        this.outputChannel.show();
        vscode.window.showInformationMessage(
          `Error Details:\n${details}\n\nTool: ${error.tool || 'N/A'}\nCode: ${error.code || 'N/A'}\nTime: ${error.timestamp.toISOString()}`,
          { modal: true }
        );
      }
    });
  }

  /**
   * Log error to output channel with structured format
   */
  private logError(error: McpErrorDetails): void {
    const timestamp = error.timestamp.toISOString();
    const toolInfo = error.tool ? ` [Tool: ${error.tool}]` : '';
    const codeInfo = error.code ? ` [Code: ${error.code}]` : '';

    this.outputChannel.appendLine(`[${timestamp}]${toolInfo}${codeInfo} ${error.source?.toUpperCase() || 'ERROR'}: ${error.message}`);

    if (error.params) {
      this.outputChannel.appendLine(`Params: ${JSON.stringify(error.params, null, 2)}`);
    }

    if (error.stack) {
      this.outputChannel.appendLine(`Stack trace:\n${error.stack}`);
    }

    this.outputChannel.appendLine('-'.repeat(80));
  }

  /**
   * Normalize any error type to McpErrorDetails
   */
  private normalizeError(error: any, context: {
    tool?: string;
    params?: any;
    operation?: string;
  } = {}): McpErrorDetails {
    const timestamp = new Date();
    let message = 'Unknown error';
    let code: number | undefined;
    let source: McpErrorDetails['source'] = 'unknown';
    let stack: string | undefined;

    // Extract information from various error types
    if (error instanceof Error) {
      message = error.message;
      stack = error.stack;

      // Classify by error message patterns
      if (error.message.includes('WebSocket')) {
        source = 'websocket';
      } else if (error.message.includes('Invalid parameters') || error.message.includes('JSON Schema')) {
        source = 'validation';
      } else if (error.message.includes('MCP error') || error.message.includes('Failed to send MCP')) {
        source = 'mcp';
      } else if (error.message.includes('network') || error.message.includes('connect')) {
        source = 'network';
      }
    } else if (typeof error === 'string') {
      message = error;
    } else if (error && typeof error === 'object') {
      message = error.message || error.error || JSON.stringify(error);
      code = error.code || error.statusCode;
    }

    // Extract MCP error code from message if present
    const mcpCodeMatch = message.match(/MCP error (-?\d+)/);
    if (mcpCodeMatch) {
      code = parseInt(mcpCodeMatch[1], 10);
      source = 'mcp';
    }

    return {
      code,
      message,
      tool: context.tool,
      params: context.params,
      timestamp,
      stack,
      source,
    };
  }

  /**
   * Utility method to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear the error output channel
   */
  clearLogs(): void {
    this.outputChannel.clear();
  }

  /**
   * Show the error output channel
   */
  showLogs(): void {
    this.outputChannel.show();
  }

  /**
   * Get the output channel instance
   */
  getOutputChannel(): vscode.OutputChannel {
    return this.outputChannel;
  }
}

/**
 * Singleton instance for easy access
 */
let globalErrorHandler: ErrorHandler | null = null;

export function getErrorHandler(options?: ErrorHandlingOptions): ErrorHandler {
  if (!globalErrorHandler) {
    globalErrorHandler = new ErrorHandler(options);
  }
  return globalErrorHandler;
}
