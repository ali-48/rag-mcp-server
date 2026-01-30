import { WebSocket, WebSocketServer } from 'ws';
import { logger } from './core/logger.js';

/**
 * Transport personnalisé pour WebSocket pour le serveur MCP
 * Implémente l'interface Transport du SDK MCP
 */
export class WebSocketServerTransport {
  private wss: WebSocketServer | null = null;
  private clients = new Map<WebSocket, {
    onmessage?: (message: any) => void;
    onclose?: () => void;
    onerror?: (error: Error) => void;
  }>();

  private _onmessage?: (message: any, socket: WebSocket) => void;
  private _onclose?: () => void;
  private _onerror?: (error: Error) => void;

  constructor(private port: number = 3000) { }
  /**
   * Démarrer le serveur WebSocket
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ port: this.port });

        this.wss.on('listening', () => {
          logger.info(`🚀 Serveur WebSocket MCP démarré sur le port ${this.port}`);
          resolve();
        });

        this.wss.on('error', (error) => {
          logger.error(`❌ Erreur du serveur WebSocket: ${error.message}`);
          reject(error);
        });

        this.wss.on('connection', (ws) => {
          logger.info('🔗 Nouvelle connexion WebSocket');

          // Configurer le client
          const clientInfo: {
            onmessage?: (message: any) => void;
            onclose?: () => void;
            onerror?: (error: Error) => void;
          } = {
            onmessage: undefined,
            onclose: undefined,
            onerror: undefined
          };
          this.clients.set(ws, clientInfo);

          // Gérer les messages
          ws.on('message', (data) => {
            try {
              const message = JSON.parse(data.toString());
              logger.debug(`📨 Message reçu: ${message.method || 'unknown'}`);

              if (this._onmessage) {
                this._onmessage(message, ws);
              } else if (clientInfo.onmessage) {
                clientInfo.onmessage(message);
              }
            } catch (error) {
              logger.error(`❌ Erreur de parsing JSON: ${error instanceof Error ? error.message : String(error)}`);
              if (this._onerror) {
                this._onerror(error as Error);
              }
            }
          });

          // Gérer la fermeture
          ws.on('close', () => {
            logger.info('🔌 Connexion WebSocket fermée');
            this.clients.delete(ws);
            if (clientInfo.onclose) {
              clientInfo.onclose();
            }
          });

          // Gérer les erreurs
          ws.on('error', (error) => {
            logger.error(`❌ Erreur WebSocket: ${error.message}`);
            if (clientInfo.onerror) {
              clientInfo.onerror(error);
            }
          });
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Envoyer un message à un client spécifique
   */
  async sendToClient(ws: WebSocket, message: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message), (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      } else {
        reject(new Error('WebSocket non connecté'));
      }
    });
  }

  /**
   * Envoyer un message à tous les clients
   */
  async broadcast(message: any): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const [ws] of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        promises.push(this.sendToClient(ws, message));
      }
    }
    await Promise.all(promises);
  }

  /**
   * Fermer le serveur WebSocket
   */
  async close(): Promise<void> {
    logger.info('🛑 Fermeture du serveur WebSocket...');

    // Fermer toutes les connexions client
    for (const [ws] of this.clients) {
      ws.close();
    }
    this.clients.clear();

    // Fermer le serveur
    return new Promise((resolve, reject) => {
      if (!this.wss) {
        resolve();
        return;
      }

      this.wss.close((error) => {
        if (error) {
          reject(error);
        } else {
          this.wss = null;
          resolve();
        }
      });
    });
  }

  /**
   * Définir les gestionnaires d'événements globaux
   */
  set onmessage(handler: (message: any, socket: WebSocket) => void) {
    this._onmessage = handler;
  }

  set onclose(handler: () => void) {
    this._onclose = handler;
  }

  set onerror(handler: (error: Error) => void) {
    this._onerror = handler;
  }

  /**
   * Définir les gestionnaires d'événements pour un client spécifique
   */
  setClientHandlers(ws: WebSocket, handlers: {
    onmessage?: (message: any) => void;
    onclose?: () => void;
    onerror?: (error: Error) => void;
  }): void {
    const clientInfo = this.clients.get(ws);
    if (clientInfo) {
      Object.assign(clientInfo, handlers);
    }
  }

  /**
   * Obtenir le nombre de clients connectés
   */
  getClientCount(): number {
    return this.clients.size;
  }
}
