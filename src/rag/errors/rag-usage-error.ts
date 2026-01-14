// src/rag/errors/rag-usage-error.ts
// Classe d'erreur pour messages MCP guidés avec codes, actions requises et aide

import { logger } from "../../core/logger.js";

/**
 * Options pour créer une RagUsageError
 */
export interface RagUsageErrorOptions {
    /** Code d'erreur unique */
    code?: string;

    /** Action requise pour corriger l'erreur */
    requiredAction?: string;

    /** Message d'aide supplémentaire */
    help?: string;

    /** Détails supplémentaires (JSON-serializable) */
    details?: Record<string, any>;

    /** Cause originale de l'erreur */
    cause?: Error;
}

/**
 * Classe d'erreur spécialisée pour les erreurs d'utilisation RAG
 * Fournit des messages guidés avec codes, actions requises et aide
 */
export class RagUsageError extends Error {
    /** Code d'erreur unique */
    public readonly code: string;

    /** Action requise pour corriger l'erreur */
    public readonly requiredAction?: string;

    /** Message d'aide supplémentaire */
    public readonly help?: string;

    /** Détails supplémentaires (JSON-serializable) */
    public readonly details?: Record<string, any>;

    /** Cause originale de l'erreur */
    public readonly cause?: Error;

    /** Timestamp de l'erreur */
    public readonly timestamp: Date;

    /** Type d'erreur (pour la sérialisation) */
    public readonly type = "RagUsageError";

    constructor(
        message: string,
        code: string = "RAG_USAGE_ERROR",
        options: RagUsageErrorOptions = {}
    ) {
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
    private logError(): void {
        const logData: Record<string, any> = {
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
    formatForUser(): string {
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
                this.details.recommendations.forEach((rec: string, index: number) => {
                    formatted += `${index + 1}. ${rec}\n`;
                });
            }
        }

        return formatted;
    }

    /**
     * Formate l'erreur pour MCP (JSON strict)
     */
    formatForMCP(): Record<string, any> {
        const response: Record<string, any> = {
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
    toJSON(): Record<string, any> {
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
    static fromError(
        error: Error,
        code: string = "RAG_INTERNAL_ERROR",
        options: RagUsageErrorOptions = {}
    ): RagUsageError {
        return new RagUsageError(
            error.message,
            code,
            {
                ...options,
                cause: error,
                details: {
                    ...options.details,
                    originalError: error.name,
                    originalStack: error.stack,
                },
            }
        );
    }

    /**
     * Crée une erreur pour un pipeline RAG requis
     */
    static pipelineRequired(): RagUsageError {
        return new RagUsageError(
            "`activated_rag` est désactivé. Utilisez le pipeline RAG explicite.",
            "RAG_PIPELINE_REQUIRED",
            {
                requiredAction: "Exécutez le pipeline complet: init_rag → scan_rag → prepare_rag → embed_rag → index_rag",
                help: "Le pipeline RAG doit être exécuté étape par étape pour garantir la cohérence des données.",
                details: {
                    pipeline: ["init_rag", "scan_rag", "prepare_rag", "embed_rag", "index_rag"],
                    reason: "activated_rag est désactivé pour éviter les exécutions monolithiques non contrôlées",
                },
            }
        );
    }

    /**
     * Crée une erreur pour une phase manquante
     */
    static missingPhase(
        phase: string,
        requiredPhases: string[]
    ): RagUsageError {
        return new RagUsageError(
            `Phase ${phase} manquante dans le pipeline`,
            "RAG_PHASE_MISSING",
            {
                requiredAction: `Exécutez d'abord: ${requiredPhases.join(" → ")}`,
                help: "Les phases RAG doivent être exécutées dans l'ordre pour garantir la cohérence des données.",
                details: {
                    missingPhase: phase,
                    requiredPhases,
                    pipelineOrder: ["init", "scan", "prepare", "embed", "index", "query"],
                },
            }
        );
    }

    /**
     * Crée une erreur pour un projet non initialisé
     */
    static projectNotInitialized(projectPath: string): RagUsageError {
        return new RagUsageError(
            `Le projet n'est pas initialisé pour RAG: ${projectPath}`,
            "RAG_PROJECT_NOT_INITIALIZED",
            {
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
            }
        );
    }

    /**
     * Crée une erreur pour un job déjà en cours
     */
    static jobAlreadyRunning(jobId: string, jobType: string): RagUsageError {
        return new RagUsageError(
            `Job ${jobType} (${jobId}) est déjà en cours d'exécution`,
            "RAG_JOB_ALREADY_RUNNING",
            {
                requiredAction: "Attendez la fin du job ou annulez-le",
                help: "Un seul job mutateur peut s'exécuter à la fois pour éviter les conflits.",
                details: {
                    jobId,
                    jobType,
                    mutatorJobs: ["scan", "prepare", "embed", "index"],
                    readOnlyJobs: ["query"],
                },
            }
        );
    }

    /**
     * Crée une erreur pour une file d'attente pleine
     */
    static queueFull(maxSize: number): RagUsageError {
        return new RagUsageError(
            `File d'attente RAG pleine (max ${maxSize} jobs)`,
            "RAG_QUEUE_FULL",
            {
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
            }
        );
    }

    /**
     * Test de la classe RagUsageError
     */
    static test(): boolean {
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

        } catch (error) {
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
export function isRagUsageError(error: any): error is RagUsageError {
    return error instanceof RagUsageError ||
        (error && error.type === "RagUsageError" && error.code && error.message);
}

/**
 * Convertit n'importe quelle erreur en RagUsageError
 */
export function toRagUsageError(error: any): RagUsageError {
    if (isRagUsageError(error)) {
        return error;
    }

    if (error instanceof Error) {
        return RagUsageError.fromError(error);
    }

    return new RagUsageError(
        String(error),
        "UNKNOWN_ERROR",
        { details: { originalError: error } }
    );
}

/**
 * Formate une erreur pour MCP (générique)
 */
export function formatErrorForMCP(error: any): Record<string, any> {
    const ragError = toRagUsageError(error);
    return ragError.formatForMCP();
}

/**
 * Formate une erreur pour l'utilisateur (générique)
 */
export function formatErrorForUser(error: any): string {
    const ragError = toRagUsageError(error);
    return ragError.formatForUser();
}
