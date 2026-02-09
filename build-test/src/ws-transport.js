import { WebSocket, WebSocketServer } from 'ws';
import { logger } from './core/logger.js';
/**
 * Transport WebSocket pour le serveur MCP
 * Implémente l'interface Transport du SDK MCP
 */
export class WebSocketTransport {
    port;
    wss = null;
    clients = new Map();
    _onclose;
    _onerror;
    _onmessage;
    sessionId;
    setProtocolVersion;
    constructor(port = 3000) {
        this.port = port;
        // Générer un ID de session unique
        this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    /**
     * Démarrer le serveur WebSocket
     */
    async start() {
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
                    // Associer un ID de session au client
                    const clientSessionId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                    this.clients.set(ws, {
                        sessionId: clientSessionId,
                        protocolVersion: undefined
                    });
                    // Gérer les messages
                    ws.on('message', (data) => {
                        try {
                            const message = JSON.parse(data.toString());
                            // Vérifier si c'est une requête (avec méthode) ou une réponse
                            const method = 'method' in message ? message.method :
                                'result' in message ? 'response' :
                                    'error' in message ? 'error_response' : 'unknown';
                            logger.debug(`📨 Message reçu: ${method}`);
                            // Créer les informations supplémentaires
                            const extra = {
                                requestInfo: {
                                    headers: {}
                                }
                            };
                            if (this._onmessage) {
                                this._onmessage(message, extra);
                            }
                        }
                        catch (error) {
                            logger.error(`❌ Erreur de parsing JSON: ${error instanceof Error ? error.message : String(error)}`);
                            if (this._onerror) {
                                this._onerror(error);
                            }
                        }
                    });
                    // Gérer la fermeture
                    ws.on('close', () => {
                        logger.info('🔌 Connexion WebSocket fermée');
                        this.clients.delete(ws);
                        // Vérifier si plus aucun client
                        if (this.clients.size === 0 && this._onclose) {
                            this._onclose();
                        }
                    });
                    // Gérer les erreurs
                    ws.on('error', (error) => {
                        logger.error(`❌ Erreur WebSocket: ${error.message}`);
                        if (this._onerror) {
                            this._onerror(error);
                        }
                    });
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * Envoyer un message JSON-RPC à un client spécifique
     */
    async sendToClient(ws, message) {
        return new Promise((resolve, reject) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message), (error) => {
                    if (error) {
                        reject(error);
                    }
                    else {
                        resolve();
                    }
                });
            }
            else {
                reject(new Error('WebSocket non connecté'));
            }
        });
    }
    /**
     * Envoyer un message JSON-RPC à tous les clients
     */
    async broadcast(message) {
        const promises = [];
        for (const [ws] of this.clients) {
            if (ws.readyState === WebSocket.OPEN) {
                promises.push(this.sendToClient(ws, message));
            }
        }
        await Promise.all(promises);
    }
    /**
     * Implémentation de Transport.send()
     */
    async send(message, options) {
        // Pour l'instant, on envoie à tous les clients
        // Dans une implémentation plus avancée, on pourrait suivre les requestId
        return this.broadcast(message);
    }
    /**
     * Fermer le serveur WebSocket
     */
    async close() {
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
                }
                else {
                    this.wss = null;
                    resolve();
                }
            });
        });
    }
    /**
     * Callback pour la fermeture
     */
    set onclose(handler) {
        this._onclose = handler;
    }
    /**
     * Callback pour les erreurs
     */
    set onerror(handler) {
        this._onerror = handler;
    }
    /**
     * Callback pour les messages
     */
    set onmessage(handler) {
        this._onmessage = handler;
    }
    /**
     * Obtenir le nombre de clients connectés
     */
    getClientCount() {
        return this.clients.size;
    }
    /**
     * Obtenir la liste des sessions actives
     */
    getActiveSessions() {
        const sessions = [];
        for (const client of this.clients.values()) {
            if (client.sessionId) {
                sessions.push(client.sessionId);
            }
        }
        return sessions;
    }
}
//# sourceMappingURL=ws-transport.js.map