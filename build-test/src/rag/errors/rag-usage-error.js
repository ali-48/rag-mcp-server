// src/rag/errors/rag-usage-error.ts
// Classe d'erreur pour messages MCP guidés avec codes, actions requises et aide
import { logger } from "../../core/logger.js";
/**
 * Classe d'erreur spécialisée pour les erreurs d'utilisation RAG
 * Fournit des messages guidés avec codes, actions requises et aide
 */
export class RagUsageError extends Error {
    /** Code d'erreur unique */
    code;
    /** Action requise pour corriger l'erreur */
    requiredAction;
    /** Message d'aide supplémentaire */
    help;
    /** Détails supplémentaires (JSON-serializable) */
    details;
    /** Cause originale de l'erreur */
    cause;
    /** Timestamp de l'erreur */
    timestamp;
    /** Type d'erreur (pour la sérialisation) */
    type = "RagUsageError";
    constructor(message, code = "RAG_USAGE_ERROR", options = {}) {
        super(message);
        this.name = "RagUsageError";
        this.code = code;
        this.requiredAction = options.requiredAction;
        this.help = options.help;
        this.details = options.details;
        this.cause = options.cause;
        this.timestamp = new Date();
        // Maintenir la stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, RagUsageError);
        }
        // Log automatique de l'erreur
        this.logError();
    }
    /**
     * Log l'erreur avec le logger
     */
    logError() {
        const logData = {
            code: this.code,
            message: this.message,
            timestamp: this.timestamp.toISOString(),
        };
        if (this.requiredAction) {
            logData.requiredAction = this.requiredAction;
        }
        if (this.details) {
            logData.details = this.details;
        }
        if (this.cause) {
            logData.cause = this.cause.message;
            logData.causeStack = this.cause.stack;
        }
        logger.error("rag.usage.error", this.message, logData);
    }
    /**
     * Formate l'erreur pour l'affichage à l'utilisateur
     */
    formatForUser() {
        let formatted = `❌ ${this.message}\n`;
        if (this.code) {
            formatted += `Code: ${this.code}\n`;
        }
        if (this.requiredAction) {
            formatted += `\n📋 Action requise:\n${this.requiredAction}\n`;
        }
        if (this.help) {
            formatted += `\n💡 Aide: ${this.help}\n`;
        }
        if (this.details?.recommendations) {
            formatted += `\n🎯 Recommandations:\n`;
            if (Array.isArray(this.details.recommendations)) {
                this.details.recommendations.forEach((rec, index) => {
                    formatted += `${index + 1}. ${rec}\n`;
                });
            }
        }
        return formatted;
    }
    /**
     * Formate l'erreur pour MCP (JSON strict)
     */
    formatForMCP() {
        const response = {
            success: false,
            error: {
                type: this.type,
                message: this.message,
                code: this.code,
                timestamp: this.timestamp.toISOString(),
            },
        };
        if (this.requiredAction) {
            response.error.requiredAction = this.requiredAction;
        }
        if (this.help) {
            response.error.help = this.help;
        }
        if (this.details) {
            response.error.details = this.details;
        }
        return response;
    }
    /**
     * Convertit en objet JSON (pour la sérialisation)
     */
    toJSON() {
        return {
            type: this.type,
            name: this.name,
            message: this.message,
            code: this.code,
            requiredAction: this.requiredAction,
            help: this.help,
            details: this.details,
            timestamp: this.timestamp.toISOString(),
            stack: this.stack,
            cause: this.cause ? {
                message: this.cause.message,
                stack: this.cause.stack,
                name: this.cause.name,
            } : undefined,
        };
    }
    /**
     * Crée une RagUsageError à partir d'une erreur existante
     */
    static fromError(error, code = "RAG_INTERNAL_ERROR", options = {}) {
        return new RagUsageError(error.message, code, {
            ...options,
            cause: error,
            details: {
                ...options.details,
                originalError: error.name,
                originalStack: error.stack,
            },
        });
    }
    /**
     * Crée une erreur pour un pipeline RAG requis
     */
    static pipelineRequired() {
        return new RagUsageError("`activated_rag` est désactivé. Utilisez le pipeline RAG explicite.", "RAG_PIPELINE_REQUIRED", {
            requiredAction: "Exécutez le pipeline complet: init_rag → scan_rag → prepare_rag → embed_rag → index_rag",
            help: "Le pipeline RAG doit être exécuté étape par étape pour garantir la cohérence des données.",
            details: {
                pipeline: ["init_rag", "scan_rag", "prepare_rag", "embed_rag", "index_rag"],
                reason: "activated_rag est désactivé pour éviter les exécutions monolithiques non contrôlées",
            },
        });
    }
    /**
     * Crée une erreur pour une phase manquante
     */
    static missingPhase(phase, requiredPhases) {
        return new RagUsageError(`Phase ${phase} manquante dans le pipeline`, "RAG_PHASE_MISSING", {
            requiredAction: `Exécutez d'abord: ${requiredPhases.join(" → ")}`,
            help: "Les phases RAG doivent être exécutées dans l'ordre pour garantir la cohérence des données.",
            details: {
                missingPhase: phase,
                requiredPhases,
                pipelineOrder: ["init", "scan", "prepare", "embed", "index", "query"],
            },
        });
    }
    /**
     * Crée une erreur pour un projet non initialisé
     */
    static projectNotInitialized(projectPath) {
        return new RagUsageError(`Le projet n'est pas initialisé pour RAG: ${projectPath}`, "RAG_PROJECT_NOT_INITIALIZED", {
            requiredAction: "Exécutez `init_rag` pour initialiser le projet",
            help: "Un projet doit être initialisé avec init_rag avant toute opération RAG.",
            details: {
                projectPath,
                initializationSteps: [
                    "Création de la structure /rag/",
                    "Configuration des bases de données",
                    "Génération des fichiers de configuration",
                ],
            },
        });
    }
    /**
     * Crée une erreur pour un job déjà en cours
     */
    static jobAlreadyRunning(jobId, jobType) {
        return new RagUsageError(`Job ${jobType} (${jobId}) est déjà en cours d'exécution`, "RAG_JOB_ALREADY_RUNNING", {
            requiredAction: "Attendez la fin du job ou annulez-le",
            help: "Un seul job mutateur peut s'exécuter à la fois pour éviter les conflits.",
            details: {
                jobId,
                jobType,
                mutatorJobs: ["scan", "prepare", "embed", "index"],
                readOnlyJobs: ["query"],
            },
        });
    }
    /**
     * Crée une erreur pour une file d'attente pleine
     */
    static queueFull(maxSize) {
        return new RagUsageError(`File d'attente RAG pleine (max ${maxSize} jobs)`, "RAG_QUEUE_FULL", {
            requiredAction: "Attendez que des jobs se terminent ou annulez des jobs en attente",
            help: "La file d'attente a une taille limitée pour éviter la surcharge mémoire.",
            details: {
                maxQueueSize: maxSize,
                recommendations: [
                    "Vérifiez les jobs en cours avec `get_task_status`",
                    "Annulez les jobs non essentiels avec `cancel_task`",
                    "Attendez la fin des jobs en cours",
                ],
            },
        });
    }
    /**
     * Test de la classe RagUsageError
     */
    static test() {
        try {
            logger.info("rag.usage.error.test.start", "Début des tests RagUsageError");
            // Test création basique
            const error1 = new RagUsageError("Test erreur", "TEST_ERROR", {
                requiredAction: "Faire quelque chose",
                help: "Ceci est un test",
            });
            if (error1.code !== "TEST_ERROR") {
                throw new Error("Code d'erreur incorrect");
            }
            if (error1.requiredAction !== "Faire quelque chose") {
                throw new Error("Action requise incorrecte");
            }
            // Test formatForUser
            const userFormatted = error1.formatForUser();
            if (!userFormatted.includes("❌ Test erreur")) {
                throw new Error("Format utilisateur incorrect");
            }
            // Test formatForMCP
            const mcpFormatted = error1.formatForMCP();
            if (!mcpFormatted.error || mcpFormatted.error.code !== "TEST_ERROR") {
                throw new Error("Format MCP incorrect");
            }
            // Test fromError
            const originalError = new Error("Erreur originale");
            const wrappedError = RagUsageError.fromError(originalError, "WRAPPED_ERROR");
            if (wrappedError.cause !== originalError) {
                throw new Error("Erreur originale non préservée");
            }
            // Test méthodes statiques
            const pipelineError = RagUsageError.pipelineRequired();
            if (pipelineError.code !== "RAG_PIPELINE_REQUIRED") {
                throw new Error("Erreur pipeline incorrecte");
            }
            logger.info("rag.usage.error.test.success", "Tests RagUsageError réussis");
            return true;
        }
        catch (error) {
            logger.error("rag.usage.error.test.failed", "Tests RagUsageError échoués", {
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }
}
/**
 * Vérifie si une erreur est une RagUsageError
 */
export function isRagUsageError(error) {
    return error instanceof RagUsageError ||
        (error && error.type === "RagUsageError" && error.code && error.message);
}
/**
 * Convertit n'importe quelle erreur en RagUsageError
 */
export function toRagUsageError(error) {
    if (isRagUsageError(error)) {
        return error;
    }
    if (error instanceof Error) {
        return RagUsageError.fromError(error);
    }
    return new RagUsageError(String(error), "UNKNOWN_ERROR", { details: { originalError: error } });
}
/**
 * Formate une erreur pour MCP (générique)
 */
export function formatErrorForMCP(error) {
    const ragError = toRagUsageError(error);
    return ragError.formatForMCP();
}
/**
 * Formate une erreur pour l'utilisateur (générique)
 */
export function formatErrorForUser(error) {
    const ragError = toRagUsageError(error);
    return ragError.formatForUser();
}
//# sourceMappingURL=rag-usage-error.js.map