// src/tools/rag/task-events.ts
// Outil MCP pour la gestion des événements de tâches
// Version: v1.0.0
// Responsabilités: Abonnement aux événements de tâches, historique des événements
import { logger } from "../../core/logger.js";
import { getTaskEventEmitter } from "../../core/task-event-emitter.js";
/**
 * Stockage des abonnements (en mémoire pour l'instant)
 */
class EventSubscriptionManager {
    subscriptions = new Map();
    eventHistory = new Map();
    MAX_HISTORY_PER_SUBSCRIPTION = 100;
    /**
     * Crée un nouvel abonnement
     */
    createSubscription(eventTypes, projectPath) {
        const subscriptionId = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const subscription = {
            subscription_id: subscriptionId,
            event_types: eventTypes,
            project_path: projectPath,
            created_at: new Date().toISOString(),
            event_count: 0
        };
        this.subscriptions.set(subscriptionId, subscription);
        this.eventHistory.set(subscriptionId, []);
        logger.info('task.events.subscription.created', 'Nouvel abonnement créé', {
            subscriptionId,
            eventTypes,
            projectPath
        });
        return subscription;
    }
    /**
     * Supprime un abonnement
     */
    deleteSubscription(subscriptionId) {
        const deleted = this.subscriptions.delete(subscriptionId);
        this.eventHistory.delete(subscriptionId);
        if (deleted) {
            logger.info('task.events.subscription.deleted', 'Abonnement supprimé', {
                subscriptionId
            });
        }
        return deleted;
    }
    /**
     * Ajoute un événement à l'historique d'un abonnement
     */
    addEventToSubscription(subscriptionId, event) {
        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription) {
            return;
        }
        // Vérifier si l'événement correspond aux critères
        if (!subscription.event_types.includes(event.event_type)) {
            return;
        }
        if (subscription.project_path && event.project_path !== subscription.project_path) {
            return;
        }
        // Ajouter à l'historique
        const history = this.eventHistory.get(subscriptionId) || [];
        history.push(event);
        // Limiter la taille de l'historique
        if (history.length > this.MAX_HISTORY_PER_SUBSCRIPTION) {
            history.shift();
        }
        this.eventHistory.set(subscriptionId, history);
        // Mettre à jour les statistiques
        subscription.last_event_received = event.timestamp;
        subscription.event_count++;
        logger.debug('task.events.subscription.event_added', 'Événement ajouté à l\'abonnement', {
            subscriptionId,
            eventId: event.event_id,
            eventType: event.event_type,
            historySize: history.length
        });
    }
    /**
     * Récupère les événements d'un abonnement
     */
    getSubscriptionEvents(subscriptionId, limit = 50) {
        const history = this.eventHistory.get(subscriptionId) || [];
        return history.slice(-limit).reverse(); // Plus récents d'abord
    }
    /**
     * Récupère un abonnement
     */
    getSubscription(subscriptionId) {
        return this.subscriptions.get(subscriptionId);
    }
    /**
     * Récupère tous les abonnements
     */
    getAllSubscriptions() {
        return Array.from(this.subscriptions.values());
    }
    /**
     * Nettoie les abonnements inactifs
     */
    cleanupInactiveSubscriptions(maxAgeHours = 24) {
        const now = Date.now();
        const cutoffTime = now - (maxAgeHours * 60 * 60 * 1000);
        const inactiveSubscriptions = [];
        for (const [subscriptionId, subscription] of this.subscriptions.entries()) {
            const lastEventTime = subscription.last_event_received
                ? new Date(subscription.last_event_received).getTime()
                : new Date(subscription.created_at).getTime();
            if (lastEventTime < cutoffTime) {
                inactiveSubscriptions.push(subscriptionId);
            }
        }
        inactiveSubscriptions.forEach(subscriptionId => {
            this.deleteSubscription(subscriptionId);
        });
        logger.info('task.events.subscription.cleanup', 'Abonnements inactifs nettoyés', {
            cleanedCount: inactiveSubscriptions.length,
            maxAgeHours
        });
        return inactiveSubscriptions.length;
    }
    /**
     * Récupère les statistiques
     */
    getStats() {
        const stats = {
            total_subscriptions: this.subscriptions.size,
            total_events: 0,
            by_event_type: {},
            by_project: {}
        };
        // Compter les événements par type et par projet
        for (const history of this.eventHistory.values()) {
            stats.total_events += history.length;
            for (const event of history) {
                // Par type d'événement
                stats.by_event_type[event.event_type] = (stats.by_event_type[event.event_type] || 0) + 1;
                // Par projet
                if (event.project_path) {
                    stats.by_project[event.project_path] = (stats.by_project[event.project_path] || 0) + 1;
                }
            }
        }
        return stats;
    }
}
/**
 * Instance singleton du gestionnaire d'abonnements
 */
const subscriptionManager = new EventSubscriptionManager();
/**
 * Définition de l'outil subscribe_task_events
 */
export const subscribeTaskEventsTool = {
    name: "subscribe_task_events",
    description: "S'abonne aux événements de tâches RAG (création, complétion, échec, etc.)",
    inputSchema: {
        type: "object",
        properties: {
            event_types: {
                type: "array",
                description: "Types d'événements à écouter",
                items: {
                    type: "string",
                    enum: ["task_created", "task_started", "task_completed", "task_failed", "task_cancelled", "task_progress"]
                },
                default: ["task_created", "task_completed", "task_failed"]
            },
            project_path: {
                type: "string",
                description: "Chemin du projet (optionnel, écoute tous les projets si vide)"
            },
            auto_cleanup_hours: {
                type: "number",
                description: "Heures avant nettoyage automatique de l'abonnement inactif",
                default: 24,
                minimum: 1,
                maximum: 168
            }
        },
        required: []
    },
};
/**
 * Handler pour l'outil subscribe_task_events
 */
export const subscribeTaskEventsHandler = async (args) => {
    const startTime = Date.now();
    try {
        const eventTypes = args.event_types || ["task_created", "task_completed", "task_failed"];
        const projectPath = args.project_path;
        const autoCleanupHours = args.auto_cleanup_hours || 24;
        logger.info('task.events.subscribe.request', 'Demande d\'abonnement aux événements', {
            eventTypes,
            projectPath,
            autoCleanupHours
        });
        // Créer l'abonnement
        const subscription = subscriptionManager.createSubscription(eventTypes, projectPath);
        // Configurer l'EventEmitter pour écouter les événements
        const eventEmitter = getTaskEventEmitter();
        // Ajouter un écouteur pour chaque type d'événement
        eventTypes.forEach((eventType) => {
            eventEmitter.on(eventType, (event) => {
                subscriptionManager.addEventToSubscription(subscription.subscription_id, event);
            });
        });
        // Nettoyer les abonnements inactifs
        subscriptionManager.cleanupInactiveSubscriptions(autoCleanupHours);
        const endTime = Date.now();
        const duration = endTime - startTime;
        const response = {
            success: true,
            subscription: {
                subscription_id: subscription.subscription_id,
                event_types: subscription.event_types,
                project_path: subscription.project_path,
                created_at: subscription.created_at,
                auto_cleanup_hours: autoCleanupHours
            },
            instructions: [
                "Utiliser 'get_task_events' pour récupérer les événements",
                "Utiliser 'unsubscribe_task_events' pour se désabonner",
                "Les événements sont conservés pendant 24 heures maximum"
            ],
            timestamp: new Date().toISOString(),
            duration_ms: duration,
            notes_for_ai: [
                "Abonnement créé avec succès",
                "Types d'événements: " + eventTypes.join(", "),
                "Projet: " + (projectPath || "tous les projets"),
                "Nettoyage automatique après: " + autoCleanupHours + " heures"
            ]
        };
        logger.info('task.events.subscribe.success', 'Abonnement créé avec succès', {
            subscriptionId: subscription.subscription_id,
            duration_ms: duration
        });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(response, null, 2)
                }]
        };
    }
    catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        logger.error('task.events.subscribe.error', 'Erreur lors de la création d\'abonnement', {
            error: error.message,
            stack: error.stack,
            duration_ms: duration
        });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: false,
                        error: "SUBSCRIPTION_ERROR",
                        message: error.message,
                        duration_ms: duration,
                        timestamp: new Date().toISOString()
                    }, null, 2)
                }]
        };
    }
};
/**
 * Définition de l'outil get_task_events
 */
export const getTaskEventsTool = {
    name: "get_task_events",
    description: "Récupère les événements de tâches pour un abonnement",
    inputSchema: {
        type: "object",
        properties: {
            subscription_id: {
                type: "string",
                description: "ID de l'abonnement (obtenu via subscribe_task_events)"
            },
            limit: {
                type: "number",
                description: "Nombre maximum d'événements à retourner",
                default: 50,
                minimum: 1,
                maximum: 1000
            },
            include_stats: {
                type: "boolean",
                description: "Inclure les statistiques de l'abonnement",
                default: true
            }
        },
        required: ["subscription_id"]
    },
};
/**
 * Handler pour l'outil get_task_events
 */
export const getTaskEventsHandler = async (args) => {
    const startTime = Date.now();
    try {
        const subscriptionId = args.subscription_id;
        const limit = Math.min(args.limit || 50, 1000);
        const includeStats = args.include_stats !== false;
        logger.info('task.events.get.request', 'Demande d\'événements pour abonnement', {
            subscriptionId,
            limit,
            includeStats
        });
        // Vérifier l'abonnement
        const subscription = subscriptionManager.getSubscription(subscriptionId);
        if (!subscription) {
            logger.warn('task.events.get.not_found', 'Abonnement non trouvé', { subscriptionId });
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            error: "SUBSCRIPTION_NOT_FOUND",
                            message: `Abonnement non trouvé: ${subscriptionId}`,
                            timestamp: new Date().toISOString(),
                            notes_for_ai: [
                                "Abonnement non trouvé",
                                "Vérifier l'ID d'abonnement",
                                "Utiliser 'subscribe_task_events' pour créer un nouvel abonnement"
                            ]
                        }, null, 2)
                    }]
            };
        }
        // Récupérer les événements
        const events = subscriptionManager.getSubscriptionEvents(subscriptionId, limit);
        // Préparer la réponse
        const response = {
            success: true,
            subscription: {
                subscription_id: subscription.subscription_id,
                event_types: subscription.event_types,
                project_path: subscription.project_path,
                created_at: subscription.created_at,
                last_event_received: subscription.last_event_received,
                event_count: subscription.event_count
            },
            events: events.map(event => ({
                event_id: event.event_id,
                event_type: event.event_type,
                task_id: event.task_id,
                project_path: event.project_path,
                timestamp: event.timestamp,
                payload: event.payload
            })),
            total_events: events.length,
            timestamp: new Date().toISOString(),
            notes_for_ai: [
                "Événements récupérés avec succès",
                "Abonnement: " + subscriptionId,
                "Types d'événements: " + subscription.event_types.join(", "),
                "Total événements: " + events.length,
                "Limite: " + limit
            ]
        };
        // Ajouter les statistiques si demandées
        if (includeStats) {
            const stats = subscriptionManager.getStats();
            response.stats = stats;
        }
        const endTime = Date.now();
        response.duration_ms = endTime - startTime;
        logger.info('task.events.get.success', 'Événements récupérés avec succès', {
            subscriptionId,
            eventCount: events.length,
            duration_ms: response.duration_ms
        });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(response, null, 2)
                }]
        };
    }
    catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        logger.error('task.events.get.error', 'Erreur lors de la récupération d\'événements', {
            error: error.message,
            stack: error.stack,
            duration_ms: duration
        });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: false,
                        error: "GET_EVENTS_ERROR",
                        message: error.message,
                        duration_ms: duration,
                        timestamp: new Date().toISOString()
                    }, null, 2)
                }]
        };
    }
};
/**
 * Définition de l'outil unsubscribe_task_events
 */
export const unsubscribeTaskEventsTool = {
    name: "unsubscribe_task_events",
    description: "Se désabonne des événements de tâches",
    inputSchema: {
        type: "object",
        properties: {
            subscription_id: {
                type: "string",
                description: "ID de l'abonnement à supprimer"
            }
        },
        required: ["subscription_id"]
    },
};
/**
 * Handler pour l'outil unsubscribe_task_events
 */
export const unsubscribeTaskEventsHandler = async (args) => {
    const startTime = Date.now();
    try {
        const subscriptionId = args.subscription_id;
        logger.info('task.events.unsubscribe.request', 'Demande de désabonnement', {
            subscriptionId
        });
        // Supprimer l'abonnement
        const deleted = subscriptionManager.deleteSubscription(subscriptionId);
        if (!deleted) {
            logger.warn('task.events.unsubscribe.not_found', 'Abonnement non trouvé pour suppression', {
                subscriptionId
            });
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            error: "SUBSCRIPTION_NOT_FOUND",
                            message: `Abonnement non trouvé: ${subscriptionId}`,
                            timestamp: new Date().toISOString()
                        }, null, 2)
                    }]
            };
        }
        const endTime = Date.now();
        const duration = endTime - startTime;
        const response = {
            success: true,
            subscription_id: subscriptionId,
            deleted: true,
            timestamp: new Date().toISOString(),
            duration_ms: duration,
            notes_for_ai: [
                "Abonnement supprimé avec succès",
                "ID: " + subscriptionId,
                "Plus aucun événement ne sera collecté pour cet abonnement"
            ]
        };
        logger.info('task.events.unsubscribe.success', 'Abonnement supprimé avec succès', {
            subscriptionId,
            duration_ms: duration
        });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(response, null, 2)
                }]
        };
    }
    catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        logger.error('task.events.unsubscribe.error', 'Erreur lors de la suppression d\'abonnement', {
            error: error.message,
            stack: error.stack,
            duration_ms: duration
        });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: false,
                        error: "UNSUBSCRIBE_ERROR",
                        message: error.message,
                        duration_ms: duration,
                        timestamp: new Date().toISOString()
                    }, null, 2)
                }]
        };
    }
};
/**
 * Teste le système d'événements de tâches
 */
export async function testTaskEvents() {
    try {
        const eventEmitter = getTaskEventEmitter();
        const testTaskId = `test-events-${Date.now()}`;
        const testProjectPath = '/test/project/events';
        let eventReceived = false;
        // Créer un abonnement temporaire
        const subscriptionManager = new EventSubscriptionManager();
        const subscription = subscriptionManager.createSubscription(['task_created', 'task_completed'], testProjectPath);
        // Ajouter un écouteur
        eventEmitter.on('task_created', (event) => {
            if (event.task_id === testTaskId) {
                eventReceived = true;
                subscriptionManager.addEventToSubscription(subscription.subscription_id, event);
                logger.info('task.events.test.event_received', 'Événement de test reçu', {
                    eventId: event.event_id,
                    taskId: event.task_id
                });
            }
        });
        // Émettre un événement de test
        await eventEmitter.emitTaskCreated(testTaskId, testProjectPath, {
            test: true,
            timestamp: Date.now()
        });
        // Attendre un peu pour l'événement
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!eventReceived) {
            throw new Error('L\'événement n\'a pas été reçu');
        }
        // Vérifier l'historique
        const events = subscriptionManager.getSubscriptionEvents(subscription.subscription_id, 10);
        if (events.length !== 1) {
            throw new Error(`Nombre d'événements incorrect: ${events.length}`);
        }
        // Nettoyer
        eventEmitter.removeAllListeners();
        logger.info('task.events.test.success', 'Test TaskEvents réussi');
        return true;
    }
    catch (error) {
        logger.error('task.events.test.failed', 'Test TaskEvents échoué', {
            error: error instanceof Error ? error.message : String(error)
        });
        return false;
    }
}
// Exécution automatique si ce fichier est exécuté directement
if (typeof require !== 'undefined' && require.main === module) {
    testTaskEvents().then(success => {
        if (success) {
            logger.info('task.events.test.cli', 'TaskEvents testé avec succès', {
                success: true,
                message: 'TaskEvents testé avec succès'
            });
            process.exit(0);
        }
        else {
            logger.error('task.events.test.cli', 'Échec du test TaskEvents', {
                success: false,
                message: 'Échec du test TaskEvents'
            });
            process.exit(1);
        }
    });
}
//# sourceMappingURL=task-events.js.map