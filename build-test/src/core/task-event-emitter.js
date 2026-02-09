// src/core/task-event-emitter.ts
// Système d'événements pour les tâches du Task Manager MCP
// Version: v1.0.0
// Responsabilités: Émettre des événements pour création/complétion de tâches
// Intégration avec MCP Gateway pour fédération
import { logger } from './logger.js';
import { getProgressTracker } from './progress-tracker.js';
import { getTaskQueue } from './task-queue.js';
/**
 * Classe principale pour l'émission d'événements de tâches
 */
export class TaskEventEmitter {
    listeners = new Map();
    options;
    gatewayClient = null;
    constructor(options = {}) {
        this.options = {
            enableGatewayRouting: false,
            gatewayUrl: 'http://localhost:3000',
            maxListeners: 10,
            logEvents: true,
            ...options
        };
        this.initialize();
    }
    /**
     * Initialise l'émetteur d'événements
     */
    initialize() {
        if (this.options.enableGatewayRouting) {
            this.initializeGatewayClient();
        }
        logger.info('task.event.emitter.init', 'TaskEventEmitter initialisé', {
            enableGatewayRouting: this.options.enableGatewayRouting,
            gatewayUrl: this.options.gatewayUrl,
            maxListeners: this.options.maxListeners
        });
    }
    /**
     * Initialise le client Gateway pour le routing d'événements
     */
    async initializeGatewayClient() {
        try {
            // Import dynamique pour éviter les dépendances circulaires
            const { McpGateway } = await import('../../mcp-gateway/dist/index.js');
            this.gatewayClient = new McpGateway();
            logger.info('task.event.emitter.gateway.connected', 'Connecté au MCP Gateway', {
                gatewayUrl: this.options.gatewayUrl
            });
        }
        catch (error) {
            logger.warn('task.event.emitter.gateway.failed', 'Échec de connexion au MCP Gateway', {
                error: error instanceof Error ? error.message : String(error),
                gatewayUrl: this.options.gatewayUrl
            });
        }
    }
    /**
     * Émet un événement de tâche
     */
    async emit(eventType, taskId, projectPath, payload = {}) {
        const eventId = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = new Date().toISOString();
        // Récupérer le statut actuel de la tâche
        const progressTracker = getProgressTracker();
        const taskStatus = progressTracker.get(taskId);
        // Récupérer la position dans la file d'attente
        const taskQueue = getTaskQueue();
        const queuePosition = taskQueue.getQueuePosition(taskId);
        // Construire l'événement
        const event = {
            event_id: eventId,
            event_type: eventType,
            task_id: taskId,
            project_path: projectPath,
            timestamp,
            metadata: {
                source: 'task_manager',
                version: '1.0.0',
                emitter_version: '1.0.0'
            },
            payload: {
                task_status: taskStatus,
                queue_position: queuePosition?.position,
                queue_size: queuePosition?.total,
                ...payload
            }
        };
        // Log l'événement si activé
        if (this.options.logEvents) {
            logger.info('task.event.emitted', `Événement émis: ${eventType}`, {
                eventId,
                eventType,
                taskId,
                projectPath,
                timestamp
            });
        }
        // Notifier les écouteurs locaux
        await this.notifyListeners(eventType, event);
        // Router via Gateway si activé
        if (this.options.enableGatewayRouting && this.gatewayClient) {
            await this.routeViaGateway(event);
        }
    }
    /**
     * Notifie tous les écouteurs pour un type d'événement
     */
    async notifyListeners(eventType, event) {
        const listeners = this.listeners.get(eventType);
        if (!listeners || listeners.size === 0) {
            return;
        }
        const promises = [];
        listeners.forEach(listener => {
            try {
                const result = listener(event);
                if (result instanceof Promise) {
                    promises.push(result);
                }
            }
            catch (error) {
                logger.error('task.event.listener.error', 'Erreur dans l\'écouteur d\'événements', {
                    eventType,
                    eventId: event.event_id,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        });
        // Attendre tous les écouteurs asynchrones
        if (promises.length > 0) {
            await Promise.allSettled(promises);
        }
    }
    /**
     * Route l'événement via le MCP Gateway
     */
    async routeViaGateway(event) {
        if (!this.gatewayClient) {
            return;
        }
        try {
            const contract = {
                source: 'task_manager',
                target: 'rag_server',
                operation: 'task_event',
                payload: event,
                validation: {
                    schema: 'task_event_v1'
                }
            };
            await this.gatewayClient.route(contract);
            logger.debug('task.event.gateway.routed', 'Événement routé via Gateway', {
                eventId: event.event_id,
                eventType: event.event_type
            });
        }
        catch (error) {
            logger.warn('task.event.gateway.error', 'Erreur lors du routing via Gateway', {
                eventId: event.event_id,
                eventType: event.event_type,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    /**
     * Ajoute un écouteur pour un type d'événement
     */
    on(eventType, listener) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }
        const listeners = this.listeners.get(eventType);
        // Vérifier la limite d'écouteurs
        if (listeners.size >= (this.options.maxListeners || 10)) {
            logger.warn('task.event.listener.limit', 'Limite d\'écouteurs atteinte', {
                eventType,
                currentCount: listeners.size,
                maxListeners: this.options.maxListeners
            });
            return;
        }
        listeners.add(listener);
        logger.debug('task.event.listener.added', 'Écouteur ajouté', {
            eventType,
            listenerCount: listeners.size
        });
    }
    /**
     * Supprime un écouteur pour un type d'événement
     */
    off(eventType, listener) {
        const listeners = this.listeners.get(eventType);
        if (!listeners) {
            return;
        }
        listeners.delete(listener);
        logger.debug('task.event.listener.removed', 'Écouteur supprimé', {
            eventType,
            listenerCount: listeners.size
        });
        // Nettoyer si plus d'écouteurs
        if (listeners.size === 0) {
            this.listeners.delete(eventType);
        }
    }
    /**
     * Supprime tous les écouteurs pour un type d'événement
     */
    removeAllListeners(eventType) {
        if (eventType) {
            this.listeners.delete(eventType);
            logger.debug('task.event.listeners.removed', 'Tous les écouteurs supprimés pour un type', {
                eventType
            });
        }
        else {
            this.listeners.clear();
            logger.debug('task.event.listeners.cleared', 'Tous les écouteurs supprimés');
        }
    }
    /**
     * Retourne le nombre d'écouteurs pour un type d'événement
     */
    listenerCount(eventType) {
        const listeners = this.listeners.get(eventType);
        return listeners ? listeners.size : 0;
    }
    /**
     * Retourne tous les types d'événements avec écouteurs
     */
    getEventTypes() {
        return Array.from(this.listeners.keys());
    }
    /**
     * Émet un événement de création de tâche
     */
    async emitTaskCreated(taskId, projectPath, metadata) {
        await this.emit('task_created', taskId, projectPath, {
            action: 'created',
            ...metadata
        });
    }
    /**
     * Émet un événement de début de tâche
     */
    async emitTaskStarted(taskId, projectPath, metadata) {
        await this.emit('task_started', taskId, projectPath, {
            action: 'started',
            ...metadata
        });
    }
    /**
     * Émet un événement de complétion de tâche
     */
    async emitTaskCompleted(taskId, projectPath, result) {
        await this.emit('task_completed', taskId, projectPath, {
            action: 'completed',
            result,
            success: true
        });
    }
    /**
     * Émet un événement d'échec de tâche
     */
    async emitTaskFailed(taskId, projectPath, error) {
        await this.emit('task_failed', taskId, projectPath, {
            action: 'failed',
            error: error.message,
            error_stack: error.stack,
            success: false
        });
    }
    /**
     * Émet un événement d'annulation de tâche
     */
    async emitTaskCancelled(taskId, projectPath, reason) {
        await this.emit('task_cancelled', taskId, projectPath, {
            action: 'cancelled',
            reason: reason || 'Annulée par l\'utilisateur',
            success: false
        });
    }
    /**
     * Émet un événement de progression de tâche
     */
    async emitTaskProgress(taskId, projectPath, progress, step) {
        await this.emit('task_progress', taskId, projectPath, {
            action: 'progress',
            progress,
            step,
            percentage: Math.round(progress * 100)
        });
    }
    /**
     * Configure les options
     */
    configure(options) {
        this.options = {
            ...this.options,
            ...options
        };
        logger.info('task.event.emitter.configured', 'TaskEventEmitter reconfiguré', {
            newOptions: options
        });
    }
    /**
     * Retourne les options actuelles
     */
    getOptions() {
        return { ...this.options };
    }
    /**
     * Nettoie les ressources
     */
    dispose() {
        this.removeAllListeners();
        this.gatewayClient = null;
        logger.info('task.event.emitter.disposed', 'TaskEventEmitter nettoyé');
    }
}
/**
 * Instance singleton du TaskEventEmitter
 */
let taskEventEmitter = null;
/**
 * Obtient l'instance singleton du TaskEventEmitter
 */
export function getTaskEventEmitter(options) {
    if (!taskEventEmitter) {
        taskEventEmitter = new TaskEventEmitter(options);
    }
    else if (options) {
        taskEventEmitter.configure(options);
    }
    return taskEventEmitter;
}
/**
 * Teste le TaskEventEmitter
 */
export async function testTaskEventEmitter() {
    try {
        const emitter = getTaskEventEmitter({
            logEvents: true,
            enableGatewayRouting: false
        });
        const testTaskId = `test-event-${Date.now()}`;
        const testProjectPath = '/test/project';
        let eventReceived = false;
        // Ajouter un écouteur
        emitter.on('task_created', (event) => {
            if (event.task_id === testTaskId) {
                eventReceived = true;
                logger.info('task.event.test.received', 'Événement de test reçu', {
                    eventId: event.event_id,
                    taskId: event.task_id
                });
            }
        });
        // Émettre un événement de test
        await emitter.emitTaskCreated(testTaskId, testProjectPath, {
            test: true,
            timestamp: Date.now()
        });
        // Attendre un peu pour l'événement
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!eventReceived) {
            throw new Error('L\'événement n\'a pas été reçu par l\'écouteur');
        }
        // Vérifier le nombre d'écouteurs
        const listenerCount = emitter.listenerCount('task_created');
        if (listenerCount !== 1) {
            throw new Error(`Nombre d'écouteurs incorrect: ${listenerCount}`);
        }
        // Nettoyer
        emitter.removeAllListeners();
        logger.info('task.event.test.success', 'Test TaskEventEmitter réussi');
        return true;
    }
    catch (error) {
        logger.error('task.event.test.failed', 'Test TaskEventEmitter échoué', {
            error: error instanceof Error ? error.message : String(error)
        });
        return false;
    }
}
// Exécution automatique si ce fichier est exécuté directement
if (typeof require !== 'undefined' && require.main === module) {
    testTaskEventEmitter().then(success => {
        if (success) {
            logger.info('task.event.test.cli', 'TaskEventEmitter testé avec succès', {
                success: true,
                message: 'TaskEventEmitter testé avec succès'
            });
            process.exit(0);
        }
        else {
            logger.error('task.event.test.cli', 'Échec du test TaskEventEmitter', {
                success: false,
                message: 'Échec du test TaskEventEmitter'
            });
            process.exit(1);
        }
    });
}
//# sourceMappingURL=task-event-emitter.js.map