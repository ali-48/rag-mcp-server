// src/rag/errors/error-handler.ts
// Gestionnaire d'erreurs pour formatage MCP JSON strict et messages humains
// Version: v1.0.0
// Responsabilités: Formatage erreurs, traduction MCP, logs structurés, récupération
import { logger } from '../../core/logger.js';
import { RagUsageError } from './rag-usage-error.js';
/**
 * Classe principale pour la gestion d'erreurs
 */
export class ErrorHandler {
    config;
    stats;
    errorHistory = [];
    recoveryStrategies = new Map();
    /**
     * Constructeur
     */
    constructor(config) {
        this.config = {
            enableMCPFormatting: config?.enableMCPFormatting ?? true,
            enableHumanFormatting: config?.enableHumanFormatting ?? true,
            enableStructuredLogging: config?.enableStructuredLogging ?? true,
            enableErrorRecovery: config?.enableErrorRecovery ?? false,
            enableStatistics: config?.enableStatistics ?? true,
            defaultLogLevel: config?.defaultLogLevel || 'error',
            defaultOutputFormats: config?.defaultOutputFormats || ['json', 'text'],
            maskSensitiveData: config?.maskSensitiveData ?? true,
            sensitiveDataPatterns: config?.sensitiveDataPatterns || [
                /password/i,
                /token/i,
                /secret/i,
                /key/i,
                /credential/i,
            ],
            maxErrorSize: config?.maxErrorSize || 1024 * 1024, // 1MB
            recoveryTimeout: config?.recoveryTimeout || 5000,
            recoveryStrategies: config?.recoveryStrategies || ['retry', 'fallback'],
            alertThresholds: {
                errorRate: config?.alertThresholds?.errorRate || 0.1,
                consecutiveErrors: config?.alertThresholds?.consecutiveErrors || 5,
                memoryUsage: config?.alertThresholds?.memoryUsage || 90,
            },
        };
        this.stats = {
            totalErrors: 0,
            errorsByCategory: {
                validation: 0,
                configuration: 0,
                io: 0,
                network: 0,
                database: 0,
                memory: 0,
                timeout: 0,
                security: 0,
                business: 0,
                technical: 0,
                unknown: 0,
            },
            errorsBySeverity: {
                debug: 0,
                info: 0,
                warning: 0,
                error: 0,
                critical: 0,
                fatal: 0,
            },
            errorRate: 0,
            uniqueErrors: 0,
            recurringErrors: [],
            userImpact: {
                low: 0,
                medium: 0,
                high: 0,
                critical: 0,
            },
        };
        this.initRecoveryStrategies();
    }
    /**
     * Initialise les stratégies de récupération
     */
    initRecoveryStrategies() {
        // Stratégie de retry
        this.recoveryStrategies.set('retry', async (error, context) => {
            logger.info('error.handler.recovery.retry', 'Tentative de réessai', {
                error: error.message,
                context,
            });
            // Implémentation basique - attendre et réessayer
            await new Promise(resolve => setTimeout(resolve, 1000));
            throw error; // Pour l'instant, on relance l'erreur
        });
        // Stratégie de fallback
        this.recoveryStrategies.set('fallback', async (error, context) => {
            logger.info('error.handler.recovery.fallback', 'Utilisation de fallback', {
                error: error.message,
                context,
            });
            // Retourner une valeur par défaut
            return {
                success: false,
                error: 'Fallback activé',
                originalError: error.message,
                timestamp: new Date(),
            };
        });
        // Stratégie circuit breaker
        this.recoveryStrategies.set('circuit-breaker', async (error, context) => {
            logger.warn('error.handler.recovery.circuit_breaker', 'Circuit breaker activé', {
                error: error.message,
                context,
            });
            // Simuler un état ouvert
            return {
                success: false,
                error: 'Circuit breaker ouvert - service temporairement indisponible',
                retryAfter: 30000, // 30 secondes
            };
        });
        // Stratégie dégradée
        this.recoveryStrategies.set('degraded', async (error, context) => {
            logger.warn('error.handler.recovery.degraded', 'Mode dégradé activé', {
                error: error.message,
                context,
            });
            // Retourner une réponse limitée
            return {
                success: true,
                degraded: true,
                message: 'Service en mode dégradé - fonctionnalités limitées',
                timestamp: new Date(),
            };
        });
    }
    /**
     * Formate une erreur pour MCP (JSON strict)
     */
    formatForMCP(error, context, options) {
        const severity = this.determineSeverity(error);
        const category = this.determineCategory(error);
        const timestamp = new Date().toISOString();
        // Masquer les données sensibles si nécessaire
        let errorMessage = error.message;
        if (this.config.maskSensitiveData) {
            errorMessage = this.maskSensitiveData(errorMessage);
        }
        // Construire le format MCP
        const mcpError = {
            type: severity === 'error' || severity === 'critical' || severity === 'fatal' ? 'error' :
                severity === 'warning' ? 'warning' : 'info',
            code: this.generateErrorCode(error),
            message: errorMessage,
            userMessage: this.generateUserMessage(error, options?.locale),
            metadata: {
                timestamp,
                requestId: context?.requestId,
                sessionId: context?.sessionId,
                environment: context?.environment ? JSON.stringify(context.environment) : undefined,
            },
        };
        // Ajouter des informations supplémentaires pour RagUsageError
        if (error instanceof RagUsageError) {
            mcpError.requiredAction = error.requiredAction;
            mcpError.help = error.help;
            mcpError.details = error.details;
        }
        // Ajouter la stack trace si demandé
        if (options?.includeStackTrace && error.stack) {
            mcpError.stackTrace = this.config.maskSensitiveData ?
                this.maskSensitiveData(error.stack) : error.stack;
        }
        // Ajouter des liens vers la documentation
        mcpError.links = this.generateHelpLinks(error, category);
        // Ajouter des suggestions
        mcpError.suggestions = this.generateSuggestions(error, category);
        // Limiter la taille si nécessaire
        return this.limitErrorSize(mcpError);
    }
    /**
     * Formate une erreur pour les humains
     */
    formatForHuman(error, context, options) {
        const severity = this.determineSeverity(error);
        const category = this.determineCategory(error);
        const errorCode = this.generateErrorCode(error);
        // Masquer les données sensibles
        let errorMessage = error.message;
        if (this.config.maskSensitiveData) {
            errorMessage = this.maskSensitiveData(errorMessage);
        }
        // Déterminer la gravité pour les humains
        let humanSeverity;
        switch (severity) {
            case 'debug':
            case 'info':
                humanSeverity = 'low';
                break;
            case 'warning':
                humanSeverity = 'medium';
                break;
            case 'error':
                humanSeverity = 'high';
                break;
            case 'critical':
            case 'fatal':
                humanSeverity = 'critical';
                break;
            default:
                humanSeverity = 'medium';
        }
        // Générer le format humain
        const humanError = {
            title: this.generateErrorTitle(error, category),
            description: errorMessage,
            possibleCauses: this.generatePossibleCauses(error, category, context),
            resolutionSteps: this.generateResolutionSteps(error, category, context),
            errorCode,
            severity: humanSeverity,
            userImpact: this.determineUserImpact(severity, category),
        };
        // Ajouter des informations supplémentaires
        if (error instanceof RagUsageError && error.help) {
            humanError.supportContact = 'Consultez la documentation ou contactez le support';
        }
        // Ajouter des exemples de code si applicable
        if (category === 'configuration' || category === 'validation') {
            humanError.codeExamples = this.generateCodeExamples(error, category);
        }
        // Temps estimé de résolution
        humanError.estimatedResolutionTime = this.estimateResolutionTime(severity, category);
        return humanError;
    }
    /**
     * Traite et log une erreur
     */
    handleError(error, context, options) {
        const severity = this.determineSeverity(error);
        const category = this.determineCategory(error);
        // Mettre à jour les statistiques
        this.updateStats(error, severity, category, context);
        // Formater l'erreur selon les configurations
        let mcpFormatted;
        let humanFormatted;
        if (this.config.enableMCPFormatting) {
            mcpFormatted = this.formatForMCP(error, context, options);
        }
        if (this.config.enableHumanFormatting) {
            humanFormatted = this.formatForHuman(error, context, options);
        }
        // Log structuré
        if (this.config.enableStructuredLogging) {
            this.logStructuredError(error, severity, category, context, mcpFormatted, humanFormatted);
        }
        // Ajouter à l'historique
        this.errorHistory.push({
            timestamp: new Date(),
            error,
            context,
            formatted: mcpFormatted || humanFormatted,
        });
        // Vérifier les alertes
        this.checkAlertThresholds();
        // Tenter la récupération si activée
        if (this.config.enableErrorRecovery && this.shouldAttemptRecovery(error, severity)) {
            this.attemptRecovery(error, context).catch(recoveryError => {
                logger.error('error.handler.recovery.failed', 'Échec de la récupération', {
                    originalError: error.message,
                    recoveryError: recoveryError.message,
                });
            });
        }
    }
    /**
     * Tente de récupérer d'une erreur
     */
    async attemptRecovery(error, context) {
        logger.info('error.handler.recovery.attempt', 'Tentative de récupération', {
            error: error.message,
            context,
        });
        // Essayer chaque stratégie de récupération configurée
        for (const strategyName of this.config.recoveryStrategies) {
            const strategy = this.recoveryStrategies.get(strategyName);
            if (!strategy) {
                continue;
            }
            try {
                const result = await Promise.race([
                    strategy(error, context),
                    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout récupération stratégie ${strategyName}`)), this.config.recoveryTimeout)),
                ]);
                logger.info('error.handler.recovery.success', 'Récupération réussie', {
                    strategy: strategyName,
                    result,
                });
                return result;
            }
            catch (strategyError) {
                logger.warn('error.handler.recovery.strategy_failed', 'Stratégie de récupération échouée', {
                    strategy: strategyName,
                    error: strategyError instanceof Error ? strategyError.message : String(strategyError),
                });
                // Continuer avec la stratégie suivante
                continue;
            }
        }
        // Toutes les stratégies ont échoué
        logger.error('error.handler.recovery.all_failed', 'Toutes les stratégies de récupération ont échoué', {
            error: error.message,
            strategiesTried: this.config.recoveryStrategies,
        });
        throw error;
    }
    /**
     * Détermine la sévérité d'une erreur
     */
    determineSeverity(error) {
        // RagUsageError n'a pas de propriété severity, on utilise le code
        if (error instanceof RagUsageError) {
            const code = error.code.toLowerCase();
            if (code.includes('fatal') || code.includes('critical')) {
                return 'critical';
            }
            if (code.includes('warning') || code.includes('warn')) {
                return 'warning';
            }
            if (code.includes('info') || code.includes('debug')) {
                return 'info';
            }
            return 'error';
        }
        // Analyse du message d'erreur
        const message = error.message.toLowerCase();
        if (message.includes('fatal') || message.includes('critical')) {
            return 'critical';
        }
        if (message.includes('warning') || message.includes('warn')) {
            return 'warning';
        }
        if (message.includes('info') || message.includes('debug')) {
            return 'info';
        }
        if (message.includes('timeout') || message.includes('deadline')) {
            return 'error';
        }
        // Par défaut
        return 'error';
    }
    /**
     * Détermine la catégorie d'une erreur
     */
    determineCategory(error) {
        const message = error.message.toLowerCase();
        const stack = error.stack?.toLowerCase() || '';
        if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
            return 'validation';
        }
        if (message.includes('config') || message.includes('setting') || message.includes('option')) {
            return 'configuration';
        }
        if (message.includes('file') || message.includes('directory') || message.includes('path') ||
            message.includes('io') || message.includes('read') || message.includes('write')) {
            return 'io';
        }
        if (message.includes('network') || message.includes('http') || message.includes('socket') ||
            message.includes('connection') || message.includes('timeout')) {
            return 'network';
        }
        if (message.includes('database') || message.includes('sql') || message.includes('query') ||
            message.includes('table') || message.includes('connection')) {
            return 'database';
        }
        if (message.includes('memory') || message.includes('heap') || message.includes('out of memory')) {
            return 'memory';
        }
        if (message.includes('security') || message.includes('auth') || message.includes('permission') ||
            message.includes('access') || message.includes('unauthorized')) {
            return 'security';
        }
        if (message.includes('business') || message.includes('logic') || message.includes('rule')) {
            return 'business';
        }
        // Analyse de la stack trace
        if (stack.includes('node:') || stack.includes('internal/') || stack.includes('native')) {
            return 'technical';
        }
        return 'unknown';
    }
    /**
     * Masque les données sensibles dans un texte
     */
    maskSensitiveData(text) {
        let masked = text;
        for (const pattern of this.config.sensitiveDataPatterns) {
            masked = masked.replace(pattern, '[SENSITIVE_DATA]');
        }
        return masked;
    }
    /**
     * Génère un code d'erreur unique
     */
    generateErrorCode(error) {
        const prefix = 'ERR';
        const category = this.determineCategory(error).substring(0, 3).toUpperCase();
        const severity = this.determineSeverity(error).substring(0, 1).toUpperCase();
        const hash = this.hashString(error.message + (error.stack || '')).substring(0, 6);
        return `${prefix}-${category}-${severity}-${hash}`;
    }
    /**
     * Génère un hash simple d'une chaîne
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }
    /**
     * Génère un message utilisateur
     */
    generateUserMessage(error, locale) {
        // Pour l'instant, version simple en français
        const category = this.determineCategory(error);
        const severity = this.determineSeverity(error);
        const messages = {
            validation: 'Erreur de validation des données',
            configuration: 'Erreur de configuration',
            io: 'Erreur d\'entrée/sortie',
            network: 'Erreur réseau',
            database: 'Erreur de base de données',
            memory: 'Erreur mémoire',
            timeout: 'Délai d\'attente dépassé',
            security: 'Erreur de sécurité',
            business: 'Erreur métier',
            technical: 'Erreur technique',
            unknown: 'Une erreur est survenue',
        };
        let message = messages[category] || messages.unknown;
        // Ajouter des détails basés sur la sévérité
        if (severity === 'critical' || severity === 'fatal') {
            message += ' (critique)';
        }
        else if (severity === 'warning') {
            message += ' (avertissement)';
        }
        return message;
    }
    /**
     * Génère des liens d'aide
     */
    generateHelpLinks(error, category) {
        const baseUrl = 'https://docs.rag-mcp-server.com/errors';
        const links = [];
        // Lien générique
        links.push({
            title: 'Documentation des erreurs',
            url: `${baseUrl}/general`,
            description: 'Guide général de résolution des erreurs',
        });
        // Lien spécifique à la catégorie
        if (category !== 'unknown') {
            links.push({
                title: `Documentation ${category}`,
                url: `${baseUrl}/${category}`,
                description: `Guide spécifique pour les erreurs ${category}`,
            });
        }
        // Lien spécifique pour RagUsageError
        if (error instanceof RagUsageError) {
            links.push({
                title: 'Guide d\'utilisation RAG',
                url: `${baseUrl}/rag-usage`,
                description: 'Guide complet d\'utilisation du pipeline RAG',
            });
        }
        return links;
    }
    /**
     * Génère des suggestions de correction
     */
    generateSuggestions(error, category) {
        const suggestions = [];
        // Suggestions génériques
        suggestions.push('Vérifiez les logs pour plus de détails');
        suggestions.push('Assurez-vous que toutes les dépendances sont installées');
        // Suggestions par catégorie
        switch (category) {
            case 'validation':
                suggestions.push('Vérifiez le format des données d\'entrée');
                suggestions.push('Assurez-vous que tous les champs requis sont fournis');
                break;
            case 'configuration':
                suggestions.push('Vérifiez votre fichier de configuration');
                suggestions.push('Assurez-vous que toutes les variables d\'environnement sont définies');
                break;
            case 'io':
                suggestions.push('Vérifiez les permissions des fichiers/dossiers');
                suggestions.push('Assurez-vous que le chemin existe et est accessible');
                break;
            case 'network':
                suggestions.push('Vérifiez votre connexion réseau');
                suggestions.push('Assurez-vous que les services distants sont accessibles');
                break;
            case 'database':
                suggestions.push('Vérifiez la connexion à la base de données');
                suggestions.push('Assurez-vous que les tables existent et sont accessibles');
                break;
            case 'memory':
                suggestions.push('Augmentez la mémoire allouée');
                suggestions.push('Réduisez la taille des données traitées');
                break;
        }
        return suggestions;
    }
    /**
     * Limite la taille d'une erreur formatée
     */
    limitErrorSize(error) {
        const jsonSize = JSON.stringify(error).length;
        if (jsonSize <= this.config.maxErrorSize) {
            return error;
        }
        // Réduire la taille
        if ('stackTrace' in error && error.stackTrace) {
            error.stackTrace = error.stackTrace.substring(0, 1000) + '... [TRUNCATED]';
        }
        if ('details' in error && error.details) {
            error.details = { truncated: true, originalSize: jsonSize };
        }
        return error;
    }
    /**
     * Génère un titre d'erreur
     */
    generateErrorTitle(error, category) {
        const categoryTitles = {
            validation: 'Erreur de validation',
            configuration: 'Erreur de configuration',
            io: 'Erreur d\'entrée/sortie',
            network: 'Erreur réseau',
            database: 'Erreur de base de données',
            memory: 'Erreur mémoire',
            timeout: 'Délai dépassé',
            security: 'Erreur de sécurité',
            business: 'Erreur métier',
            technical: 'Erreur technique',
            unknown: 'Erreur inattendue',
        };
        return categoryTitles[category];
    }
    /**
     * Génère les causes possibles
     */
    generatePossibleCauses(error, category, context) {
        const causes = [];
        // Causes génériques
        causes.push('Une condition inattendue s\'est produite');
        causes.push('Les données fournies sont incorrectes ou incomplètes');
        // Causes spécifiques
        switch (category) {
            case 'validation':
                causes.push('Format de données invalide');
                causes.push('Champs requis manquants');
                break;
            case 'configuration':
                causes.push('Fichier de configuration manquant ou incorrect');
                causes.push('Variables d\'environnement non définies');
                break;
            case 'io':
                causes.push('Fichier ou dossier inaccessible');
                causes.push('Permissions insuffisantes');
                break;
            case 'database':
                causes.push('Connexion à la base de données perdue');
                causes.push('Requête SQL invalide');
                break;
        }
        // Causes basées sur le contexte
        if (context?.executionPhase) {
            causes.push(`Erreur survenue pendant la phase: ${context.executionPhase}`);
        }
        return causes;
    }
    /**
     * Génère les étapes de résolution
     */
    generateResolutionSteps(error, category, context) {
        const steps = [];
        // Étapes génériques
        steps.push('Consultez les logs pour plus de détails');
        steps.push('Vérifiez la documentation correspondante');
        // Étapes spécifiques
        switch (category) {
            case 'validation':
                steps.push('Vérifiez le format des données d\'entrée');
                steps.push('Assurez-vous que tous les champs requis sont remplis');
                break;
            case 'configuration':
                steps.push('Vérifiez votre fichier rag-config.json');
                steps.push('Assurez-vous que les chemins sont corrects');
                break;
            case 'io':
                steps.push('Vérifiez les permissions du fichier/dossier');
                steps.push('Assurez-vous que le chemin existe');
                break;
            case 'database':
                steps.push('Vérifiez la connexion à la base de données');
                steps.push('Exécutez les migrations si nécessaire');
                break;
        }
        // Étapes pour RagUsageError
        if (error instanceof RagUsageError && error.requiredAction) {
            steps.push(`Action requise: ${error.requiredAction}`);
        }
        return steps;
    }
    /**
     * Détermine l'impact utilisateur
     */
    determineUserImpact(severity, category) {
        const impacts = {
            'debug': 'Aucun impact - pour le débogage uniquement',
            'info': 'Impact minimal - information seulement',
            'warning': 'Impact modéré - certaines fonctionnalités peuvent être limitées',
            'error': 'Impact élevé - fonctionnalité non disponible',
            'critical': 'Impact critique - service partiellement indisponible',
            'fatal': 'Impact fatal - service complètement indisponible',
        };
        return impacts[severity] || impacts.error;
    }
    /**
     * Génère des exemples de code
     */
    generateCodeExamples(error, category) {
        const examples = [];
        if (category === 'configuration') {
            examples.push({
                language: 'json',
                code: JSON.stringify({
                    "rag": {
                        "database": {
                            "type": "sqlite",
                            "path": "./rag/db/memory.sqlite"
                        }
                    }
                }, null, 2),
                description: 'Exemple de configuration valide',
            });
        }
        if (category === 'validation') {
            examples.push({
                language: 'typescript',
                code: `// Validation correcte
const validData = {
  projectPath: "/chemin/valide",
  mode: "full"
};`,
                description: 'Exemple de données valides',
            });
        }
        return examples;
    }
    /**
     * Estime le temps de résolution
     */
    estimateResolutionTime(severity, category) {
        if (severity === 'debug' || severity === 'info') {
            return 'Quelques minutes';
        }
        if (severity === 'warning') {
            return '15-30 minutes';
        }
        if (severity === 'error') {
            return '1-2 heures';
        }
        if (severity === 'critical' || severity === 'fatal') {
            return 'Plusieurs heures - contactez le support';
        }
        return 'Temps indéterminé';
    }
    /**
     * Met à jour les statistiques
     */
    updateStats(error, severity, category, context) {
        this.stats.totalErrors++;
        this.stats.errorsByCategory[category]++;
        this.stats.errorsBySeverity[severity]++;
        // Mettre à jour l'impact utilisateur
        const impact = this.determineUserImpact(severity, category);
        if (impact.includes('minimal') || impact.includes('Aucun')) {
            this.stats.userImpact.low++;
        }
        else if (impact.includes('modéré')) {
            this.stats.userImpact.medium++;
        }
        else if (impact.includes('élevé')) {
            this.stats.userImpact.high++;
        }
        else {
            this.stats.userImpact.critical++;
        }
        // Gérer les erreurs récurrentes
        const errorCode = this.generateErrorCode(error);
        const existingError = this.stats.recurringErrors.find(e => e.code === errorCode);
        if (existingError) {
            existingError.count++;
            existingError.lastOccurrence = new Date();
        }
        else {
            this.stats.uniqueErrors++;
            this.stats.recurringErrors.push({
                code: errorCode,
                count: 1,
                firstOccurrence: new Date(),
                lastOccurrence: new Date(),
            });
        }
        // Trier les erreurs récurrentes par fréquence
        this.stats.recurringErrors.sort((a, b) => b.count - a.count);
        this.stats.recurringErrors = this.stats.recurringErrors.slice(0, 10); // Garder les 10 plus fréquentes
    }
    /**
     * Log structuré d'erreur
     */
    logStructuredError(error, severity, category, context, mcpFormatted, humanFormatted) {
        const logData = {
            error: error.message,
            severity,
            category,
            errorCode: this.generateErrorCode(error),
            timestamp: new Date().toISOString(),
        };
        // Ajouter le contexte
        if (context) {
            logData.context = {
                requestId: context.requestId,
                projectPath: context.projectPath,
                executionPhase: context.executionPhase,
                currentAction: context.currentAction,
            };
        }
        // Ajouter les formats si disponibles
        if (mcpFormatted) {
            logData.mcpFormat = {
                code: mcpFormatted.code,
                type: mcpFormatted.type,
                userMessage: mcpFormatted.userMessage,
            };
        }
        if (humanFormatted) {
            logData.humanFormat = {
                title: humanFormatted.title,
                severity: humanFormatted.severity,
                userImpact: humanFormatted.userImpact,
            };
        }
        // Log selon la sévérité
        switch (severity) {
            case 'debug':
                logger.debug('error.handler.structured', 'Erreur debug', logData);
                break;
            case 'info':
                logger.info('error.handler.structured', 'Erreur info', logData);
                break;
            case 'warning':
                logger.warn('error.handler.structured', 'Erreur warning', logData);
                break;
            case 'error':
                logger.error('error.handler.structured', 'Erreur error', logData);
                break;
            case 'critical':
            case 'fatal':
                logger.error('error.handler.structured', 'Erreur critique', logData);
                break;
            default:
                logger.error('error.handler.structured', 'Erreur', logData);
        }
    }
    /**
     * Vérifie si on doit tenter une récupération
     */
    shouldAttemptRecovery(error, severity) {
        // Ne pas tenter de récupération pour les erreurs fatales
        if (severity === 'fatal') {
            return false;
        }
        // Ne pas tenter de récupération pour les erreurs de validation
        const category = this.determineCategory(error);
        if (category === 'validation' || category === 'configuration') {
            return false;
        }
        // Tenter la récupération pour les erreurs temporaires
        const message = error.message.toLowerCase();
        if (message.includes('timeout') ||
            message.includes('connection') ||
            message.includes('network') ||
            message.includes('temporary')) {
            return true;
        }
        return false;
    }
    /**
     * Vérifie les seuils d'alerte
     */
    checkAlertThresholds() {
        const { alertThresholds } = this.config;
        // Vérifier le taux d'erreur
        if (this.stats.totalErrors > 0) {
            // Calculer le taux d'erreur (simplifié)
            const errorRate = this.stats.totalErrors / (this.stats.totalErrors + 100); // Approximation
            if (errorRate > alertThresholds.errorRate) {
                logger.warn('error.handler.alert.error_rate', 'Taux d\'erreur élevé', {
                    errorRate,
                    threshold: alertThresholds.errorRate,
                    totalErrors: this.stats.totalErrors,
                });
            }
        }
        // Vérifier les erreurs consécutives
        if (this.errorHistory.length >= alertThresholds.consecutiveErrors) {
            const recentErrors = this.errorHistory.slice(-alertThresholds.consecutiveErrors);
            const allRecentAreErrors = recentErrors.every(entry => this.determineSeverity(entry.error) === 'error' ||
                this.determineSeverity(entry.error) === 'critical');
            if (allRecentAreErrors) {
                logger.warn('error.handler.alert.consecutive_errors', 'Erreurs consécutives détectées', {
                    consecutiveErrors: alertThresholds.consecutiveErrors,
                    recentErrors: recentErrors.map(e => e.error.message),
                });
            }
        }
        // Vérifier l'utilisation mémoire
        if (typeof process !== 'undefined' && process.memoryUsage) {
            const memoryUsage = process.memoryUsage();
            const usagePercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
            if (usagePercentage > alertThresholds.memoryUsage) {
                logger.warn('error.handler.alert.memory_usage', 'Utilisation mémoire élevée', {
                    usagePercentage,
                    threshold: alertThresholds.memoryUsage,
                    heapUsed: memoryUsage.heapUsed,
                    heapTotal: memoryUsage.heapTotal,
                });
            }
        }
    }
    /**
     * Récupère les statistiques d'erreurs
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Récupère l'historique des erreurs
     */
    getErrorHistory() {
        return [...this.errorHistory];
    }
    /**
     * Efface l'historique des erreurs
     */
    clearErrorHistory() {
        this.errorHistory = [];
        logger.info('error.handler.history.cleared', 'Historique des erreurs effacé');
    }
    /**
     * Exporte les erreurs au format JSON
     */
    exportErrors(format = 'json') {
        if (format === 'csv') {
            // Format CSV simple
            const headers = ['timestamp', 'error', 'code', 'severity', 'category'];
            const rows = this.errorHistory.map(entry => [
                entry.timestamp.toISOString(),
                entry.error.message,
                this.generateErrorCode(entry.error),
                this.determineSeverity(entry.error),
                this.determineCategory(entry.error),
            ]);
            const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
            return csv;
        }
        // Format JSON par défaut
        const exportData = {
            metadata: {
                exportedAt: new Date().toISOString(),
                totalErrors: this.stats.totalErrors,
                uniqueErrors: this.stats.uniqueErrors,
                errorRate: this.stats.errorRate,
            },
            stats: this.stats,
            errors: this.errorHistory.map(entry => ({
                timestamp: entry.timestamp,
                error: {
                    message: entry.error.message,
                    code: this.generateErrorCode(entry.error),
                    severity: this.determineSeverity(entry.error),
                    category: this.determineCategory(entry.error),
                    stack: entry.error.stack,
                },
                context: entry.context,
                formatted: entry.formatted,
            })),
        };
        return JSON.stringify(exportData, null, 2);
    }
    /**
     * Teste le ErrorHandler
     */
    static async test() {
        try {
            logger.info('error.handler.test.start', 'Début test ErrorHandler');
            // Créer un ErrorHandler de test
            const handler = new ErrorHandler({
                enableMCPFormatting: true,
                enableHumanFormatting: true,
                enableStructuredLogging: true,
                enableErrorRecovery: true,
                enableStatistics: true,
            });
            // Tester le formatage MCP
            const testError = new Error('Test erreur de validation');
            const mcpFormatted = handler.formatForMCP(testError);
            if (!mcpFormatted.code || !mcpFormatted.message) {
                throw new Error('Formatage MCP incorrect');
            }
            // Tester le formatage humain
            const humanFormatted = handler.formatForHuman(testError);
            if (!humanFormatted.title || !humanFormatted.description) {
                throw new Error('Formatage humain incorrect');
            }
            // Tester la gestion d'erreur
            handler.handleError(testError, {
                requestId: 'test-123',
                projectPath: '/test/project',
                executionPhase: 'test',
            });
            // Vérifier les statistiques
            const stats = handler.getStats();
            if (stats.totalErrors !== 1) {
                throw new Error('Statistiques incorrectes');
            }
            // Tester l'export
            const jsonExport = handler.exportErrors('json');
            if (!jsonExport.includes('Test erreur de validation')) {
                throw new Error('Export JSON incorrect');
            }
            logger.info('error.handler.test.success', 'Test ErrorHandler réussi');
            return true;
        }
        catch (error) {
            logger.error('error.handler.test.failed', 'Test ErrorHandler échoué', {
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }
}
/**
 * Instance singleton de ErrorHandler
 */
let errorHandlerInstance = null;
/**
 * Obtient l'instance singleton de ErrorHandler
 */
export function getErrorHandler(config) {
    if (!errorHandlerInstance) {
        errorHandlerInstance = new ErrorHandler(config);
    }
    return errorHandlerInstance;
}
/**
 * Formate une erreur pour MCP (utilitaire)
 */
export function formatErrorForMCP(error, context) {
    const handler = getErrorHandler();
    return handler.formatForMCP(error, context);
}
/**
 * Formate une erreur pour humains (utilitaire)
 */
export function formatErrorForHuman(error, context) {
    const handler = getErrorHandler();
    return handler.formatForHuman(error, context);
}
/**
 * Gère une erreur (utilitaire)
 */
export function handleError(error, context) {
    const handler = getErrorHandler();
    handler.handleError(error, context);
}
/**
 * Teste le module ErrorHandler
 */
export async function testErrorHandlerModule() {
    return ErrorHandler.test();
}
// Exécution automatique si ce fichier est exécuté directement
if (typeof require !== 'undefined' && require.main === module) {
    testErrorHandlerModule().then(success => {
        if (success) {
            console.log(JSON.stringify({
                success: true,
                message: 'ErrorHandler testé avec succès'
            }, null, 2));
            process.exit(0);
        }
        else {
            console.error(JSON.stringify({
                success: false,
                message: 'Échec du test ErrorHandler'
            }, null, 2));
            process.exit(1);
        }
    });
}
//# sourceMappingURL=error-handler.js.map