// MCP Client with improved error handling and validation
import { validateToolInput, validateToolOutput } from '../models/json-schemas';

export class McpClient {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private timeout: number;
  private isConnected: boolean = false;
  private requestId: number = 0;
  private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();
  private pendingToolNames: Map<number, string> = new Map();
  private lastError: string | null = null;
  private validateOutput: boolean = true;

  constructor(serverUrl: string, timeout: number = 30000) {
    this.serverUrl = serverUrl;
    this.timeout = timeout;
  }

  /**
   * Enable or disable output validation (default: true)
   */
  setOutputValidation(enabled: boolean): void {
    this.validateOutput = enabled;
    console.log(`Output validation ${enabled ? 'enabled' : 'disabled'}`);
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          this.isConnected = true;
          this.lastError = null;
          console.log('✅ Connected to MCP server at', this.serverUrl);
          resolve();
        };

        this.ws.onclose = (event) => {
          this.isConnected = false;
          const message = event.code === 1000 ? 'Normal closure' : `Closed with code ${event.code}`;
          console.log(`Disconnected from MCP server: ${message}`);
          // Reject any pending requests
          this.rejectAllPendingRequests(new Error(`WebSocket closed: ${message}`));
        };

        this.ws.onerror = (error) => {
          this.lastError = error instanceof Error ? error.message : 'Unknown WebSocket error';
          console.error('❌ WebSocket error:', error);
          reject(new Error(`Failed to connect to MCP server at ${this.serverUrl}: ${this.lastError}`));
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            if (message.id !== undefined && this.pendingRequests.has(message.id)) {
              const { resolve, reject } = this.pendingRequests.get(message.id)!;
              const toolName = this.pendingToolNames.get(message.id);
              this.pendingRequests.delete(message.id);
              this.pendingToolNames.delete(message.id);

              // Handle JSON-RPC error response
              if (message.error) {
                const errorMsg = message.error.message || 'Unknown MCP error';
                const errorCode = message.error.code || -32000;
                reject(new Error(`MCP error ${errorCode}: ${errorMsg}`));
                return;
              }

              // Success response
              if (message.result !== undefined) {
                // Validate output if enabled and we know the tool name
                if (this.validateOutput && toolName) {
                  const outputValidation = validateToolOutput(toolName, message.result);
                  if (!outputValidation.valid) {
                    console.warn(`⚠️ Output validation failed for tool ${toolName}:`, outputValidation.errors);
                    // Still resolve, but log warning (we don't reject because server responded)
                  }
                }
                resolve(message.result);
              } else {
                // If no result field but message is valid, return the whole message
                resolve(message);
              }
            }
          } catch (error) {
            console.error('❌ Failed to parse MCP message:', error, 'Raw data:', event.data);
            this.lastError = 'Failed to parse MCP response';
          }
        };
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : 'Unknown connection error';
        reject(new Error(`Failed to create WebSocket connection: ${this.lastError}`));
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.isConnected = false;
    this.rejectAllPendingRequests(new Error('Client disconnected'));
    console.log('Disconnected from MCP server');
  }

  async call(tool: string, params: any): Promise<any> {
    // Basic validation
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected to MCP server. Please call connect() first.');
    }

    if (!tool || typeof tool !== 'string') {
      throw new Error('Tool name must be a non-empty string');
    }

    if (params && typeof params !== 'object') {
      throw new Error('Parameters must be an object or null/undefined');
    }

    // JSON Schema validation
    const inputValidation = validateToolInput(tool, params);
    if (!inputValidation.valid) {
      throw new Error(`Invalid parameters for tool ${tool}: ${inputValidation.errors.join(', ')}`);
    }

    const id = ++this.requestId;
    const request = {
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name: tool,
        arguments: params || {},
      },
    };

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        this.pendingToolNames.delete(id);
        reject(new Error(`MCP call timeout after ${this.timeout}ms (tool: ${tool})`));
      }, this.timeout);

      this.pendingRequests.set(id, {
        resolve: (result: any) => {
          clearTimeout(timeoutId);
          resolve(result);
        },
        reject: (error: any) => {
          clearTimeout(timeoutId);
          reject(error);
        },
      });

      // Store tool name for output validation
      this.pendingToolNames.set(id, tool);

      try {
        console.log(`📤 Calling MCP tool: ${tool}`, params);
        const requestStr = JSON.stringify(request);
        this.ws!.send(requestStr);
      } catch (error) {
        this.pendingRequests.delete(id);
        this.pendingToolNames.delete(id);
        clearTimeout(timeoutId);
        const errorMsg = error instanceof Error ? error.message : 'Unknown send error';
        reject(new Error(`Failed to send MCP request for tool ${tool}: ${errorMsg}`));
      }
    });
  }

  async validateConnection(): Promise<boolean> {
    try {
      // Send a simple ping-like request with timeout
      await this.call('get_status', { scope: 'global' });
      return true;
    } catch (error) {
      console.warn('Connection validation failed:', error);
      return false;
    }
  }

  getConnectionStatus(): {
    isConnected: boolean;
    serverUrl: string;
    lastError?: string;
  } {
    return {
      isConnected: this.isConnected,
      serverUrl: this.serverUrl,
      lastError: this.lastError || undefined,
    };
  }

  private rejectAllPendingRequests(error: Error): void {
    // Compatible iteration for ES2022/TypeScript
    const entries = Array.from(this.pendingRequests.entries());
    for (const [id, { reject }] of entries) {
      reject(error);
      this.pendingRequests.delete(id);
      this.pendingToolNames.delete(id);
    }
  }
}
