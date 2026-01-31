import { McpClient } from '../../src/services/McpClient';

// Mock du module ws
jest.mock('ws', () => {
  const mockWebSocket = {
    onopen: null as (() => void) | null,
    onclose: null as ((event: any) => void) | null,
    onerror: null as ((error: any) => void) | null,
    onmessage: null as ((event: any) => void) | null,
    close: jest.fn(),
    send: jest.fn(),
    readyState: 0,
  };

  const MockWebSocket = jest.fn().mockImplementation(() => mockWebSocket);
  (MockWebSocket as any).OPEN = 1;
  (MockWebSocket as any).CLOSED = 3;

  return {
    __esModule: true,
    default: MockWebSocket,
    WebSocket: MockWebSocket,
  };
});

// Mock des validateurs JSON Schema
jest.mock('../../src/models/json-schemas', () => ({
  validateToolInput: jest.fn().mockReturnValue({ valid: true, errors: [] }),
  validateToolOutput: jest.fn().mockReturnValue({ valid: true, errors: [] }),
}));

describe('McpClient', () => {
  let client: McpClient;
  let mockWebSocket: any;

  beforeEach(() => {
    jest.clearAllMocks();
    const WebSocket = require('ws').WebSocket;
    mockWebSocket = new WebSocket();
    client = new McpClient('ws://localhost:3000', 1000); // timeout court pour les tests
  });

  afterEach(() => {
    if (client) {
      client.disconnect();
    }
  });

  describe('Constructor', () => {
    it('should create client with default timeout', () => {
      const defaultClient = new McpClient('ws://localhost:3000');
      expect(defaultClient).toBeInstanceOf(McpClient);
    });

    it('should create client with custom timeout', () => {
      const customClient = new McpClient('ws://localhost:3000', 5000);
      expect(customClient).toBeInstanceOf(McpClient);
    });
  });

  describe('connect()', () => {
    it('should successfully connect', async () => {
      const connectPromise = client.connect();

      // Simuler l'ouverture de la connexion
      setTimeout(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen();
        }
      }, 10);

      await expect(connectPromise).resolves.toBeUndefined();
    });

    it('should reject on connection error', async () => {
      const connectPromise = client.connect();

      // Simuler une erreur de connexion
      setTimeout(() => {
        if (mockWebSocket.onerror) {
          mockWebSocket.onerror(new Error('Connection failed'));
        }
      }, 10);

      await expect(connectPromise).rejects.toThrow('Failed to connect to MCP server');
    });

    it('should handle WebSocket creation error', async () => {
      // Forcer une erreur lors de la création du WebSocket
      const WebSocket = require('ws').WebSocket;
      WebSocket.mockImplementationOnce(() => {
        throw new Error('WebSocket creation failed');
      });

      const newClient = new McpClient('ws://localhost:3000');
      await expect(newClient.connect()).rejects.toThrow('Failed to create WebSocket connection');
    });
  });

  describe('disconnect()', () => {
    it('should close WebSocket connection', async () => {
      await client.connect();
      client.disconnect();

      expect(mockWebSocket.close).toHaveBeenCalledWith(1000, 'Client disconnect');
    });

    it('should handle disconnect when not connected', () => {
      expect(() => client.disconnect()).not.toThrow();
    });
  });

  describe('call()', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should reject when not connected', async () => {
      const disconnectedClient = new McpClient('ws://localhost:3000');
      await expect(disconnectedClient.call('test_tool', {})).rejects.toThrow('Not connected to MCP server');
    });

    it('should validate tool name', async () => {
      await expect(client.call('', {})).rejects.toThrow('Tool name must be a non-empty string');
      await expect(client.call(null as any, {})).rejects.toThrow('Tool name must be a non-empty string');
    });

    it('should validate parameters', async () => {
      await expect(client.call('test_tool', 'invalid')).rejects.toThrow('Parameters must be an object or null/undefined');
    });

    it('should send valid request and receive response', async () => {
      const callPromise = client.call('get_status', { scope: 'global' });

      // Simuler l'envoi du message
      setTimeout(() => {
        expect(mockWebSocket.send).toHaveBeenCalledWith(
          expect.stringContaining('"method":"tools/call"')
        );

        // Simuler une réponse du serveur
        if (mockWebSocket.onmessage) {
          const response = {
            jsonrpc: '2.0',
            id: 1,
            result: { status: 'ok' },
          };
          mockWebSocket.onmessage({ data: JSON.stringify(response) });
        }
      }, 10);

      await expect(callPromise).resolves.toEqual({ status: 'ok' });
    });

    it('should handle JSON-RPC error response', async () => {
      const callPromise = client.call('test_tool', {});

      setTimeout(() => {
        // Simuler une erreur JSON-RPC
        if (mockWebSocket.onmessage) {
          const errorResponse = {
            jsonrpc: '2.0',
            id: 1,
            error: {
              code: -32000,
              message: 'Internal error',
            },
          };
          mockWebSocket.onmessage({ data: JSON.stringify(errorResponse) });
        }
      }, 10);

      await expect(callPromise).rejects.toThrow('MCP error -32000: Internal error');
    });

    it('should timeout when no response received', async () => {
      await expect(client.call('slow_tool', {})).rejects.toThrow('MCP call timeout after 1000ms');
    });

    it('should handle send error', async () => {
      mockWebSocket.send.mockImplementationOnce(() => {
        throw new Error('Send failed');
      });

      await expect(client.call('test_tool', {})).rejects.toThrow('Failed to send MCP request');
    });
  });

  describe('validateConnection()', () => {
    it('should return true when connection is valid', async () => {
      await client.connect();

      // Mock de la méthode call pour simuler une réponse réussie
      const mockCall = jest.spyOn(client, 'call').mockResolvedValue({ status: 'ok' });

      const isValid = await client.validateConnection();
      expect(isValid).toBe(true);
      expect(mockCall).toHaveBeenCalledWith('get_status', { scope: 'global' });

      mockCall.mockRestore();
    });

    it('should return false when connection fails', async () => {
      await client.connect();

      // Mock de la méthode call pour simuler une erreur
      const mockCall = jest.spyOn(client, 'call').mockRejectedValue(new Error('Connection failed'));

      const isValid = await client.validateConnection();
      expect(isValid).toBe(false);

      mockCall.mockRestore();
    });
  });

  describe('getConnectionStatus()', () => {
    it('should return correct status when connected', async () => {
      await client.connect();

      const status = client.getConnectionStatus();
      expect(status).toEqual({
        isConnected: true,
        serverUrl: 'ws://localhost:3000',
        lastError: undefined,
      });
    });

    it('should include last error when present', async () => {
      const connectPromise = client.connect();

      // Simuler une erreur
      setTimeout(() => {
        if (mockWebSocket.onerror) {
          mockWebSocket.onerror(new Error('Test error'));
        }
      }, 10);

      try {
        await connectPromise;
      } catch (error) {
        // Expected
      }

      const status = client.getConnectionStatus();
      expect(status.lastError).toBe('Test error');
      expect(status.isConnected).toBe(false);
    });
  });

  describe('setOutputValidation()', () => {
    it('should enable output validation', () => {
      client.setOutputValidation(true);
      // Vérification indirecte via les logs (console.log est mocké par Jest)
    });

    it('should disable output validation', () => {
      client.setOutputValidation(false);
      // Vérification indirecte via les logs
    });
  });

  describe('Error scenarios', () => {
    it('should handle WebSocket close during operation', async () => {
      await client.connect();
      const callPromise = client.call('test_tool', {});

      // Simuler la fermeture du WebSocket
      setTimeout(() => {
        if (mockWebSocket.onclose) {
          mockWebSocket.onclose({ code: 1006 });
        }
      }, 10);

      await expect(callPromise).rejects.toThrow('WebSocket closed');
    });

    it('should handle invalid JSON response', async () => {
      await client.connect();
      const callPromise = client.call('test_tool', {});

      // Simuler une réponse JSON invalide
      setTimeout(() => {
        if (mockWebSocket.onmessage) {
          mockWebSocket.onmessage({ data: 'invalid json' });
        }
      }, 10);

      // La promesse devrait timeout (pas de réponse valide)
      await expect(callPromise).rejects.toThrow('MCP call timeout');
    });

    it('should handle response without id', async () => {
      await client.connect();
      const callPromise = client.call('test_tool', {});

      // Simuler une réponse sans ID (ne devrait pas être traitée)
      setTimeout(() => {
        if (mockWebSocket.onmessage) {
          const response = {
            jsonrpc: '2.0',
            result: { status: 'ok' },
            // Pas d'ID
          };
          mockWebSocket.onmessage({ data: JSON.stringify(response) });
        }
      }, 10);

      // La promesse devrait timeout (réponse ignorée)
      await expect(callPromise).rejects.toThrow('MCP call timeout');
    });
  });

  describe('Reconnection handling', () => {
    it('should reject all pending requests on disconnect', async () => {
      await client.connect();

      // Lancer plusieurs appels simultanés
      const callPromises = [
        client.call('tool1', {}),
        client.call('tool2', {}),
        client.call('tool3', {}),
      ];

      // Simuler la déconnexion
      setTimeout(() => {
        client.disconnect();
      }, 10);

      // Tous les appels devraient être rejetés
      for (const promise of callPromises) {
        await expect(promise).rejects.toThrow('Client disconnected');
      }
    });
  });
});
