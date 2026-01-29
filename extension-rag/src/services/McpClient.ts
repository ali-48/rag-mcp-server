// Simplified MCP Client using native WebSocket for prototyping
// @ts-ignore - We'll fix TypeScript errors later
export class McpClient {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private timeout: number;
  private isConnected: boolean = false;
  private requestId: number = 0;
  private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();

  constructor(serverUrl: string, timeout: number = 30000) {
    this.serverUrl = serverUrl;
    this.timeout = timeout;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          this.isConnected = true;
          console.log('✅ Connected to MCP server at', this.serverUrl);
          resolve();
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          console.log('Disconnected from MCP server');
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          reject(new Error(`Failed to connect to MCP server at ${this.serverUrl}`));
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.id !== undefined && this.pendingRequests.has(message.id)) {
              const { resolve } = this.pendingRequests.get(message.id)!;
              this.pendingRequests.delete(message.id);
              resolve(message.result || message);
            }
          } catch (error) {
            console.error('❌ Failed to parse MCP message:', error);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.pendingRequests.clear();
    console.log('Disconnected from MCP server');
  }

  async call(tool: string, params: any): Promise<any> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected to MCP server');
    }

    const id = ++this.requestId;
    const request = {
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name: tool,
        arguments: params,
      },
    };

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`MCP call timeout after ${this.timeout}ms`));
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

      try {
        console.log(`📤 Calling MCP tool: ${tool}`, params);
        // TypeScript doesn't understand that this.ws is not null after the check above
        this.ws!.send(JSON.stringify(request));
      } catch (error) {
        this.pendingRequests.delete(id);
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  async validateConnection(): Promise<boolean> {
    try {
      // Send a simple ping-like request
      await this.call('get_status', { scope: 'global' });
      return true;
    } catch (error) {
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
    };
  }
}
