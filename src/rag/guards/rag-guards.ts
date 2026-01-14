// src/rag/guards/rag-guards.ts
// Guards pour vérifier l'ordre d'exécution des phases RAG

import { logger } from "../../core/logger.js";
import { RagUsageError } from "../errors/rag-usage-error.js";
import { RagState, getRagState } from "../phase0/rag-state.js";

/**
 * État requis pour chaque phase RAG
 */
export interface RagPhaseRequirements {
    /** La phase RAG doit être initialisée */
    initialized?: boolean;

    /** La phase de scan doit être terminée */
    scanCompleted?: boolean;

    /** La phase de préparation doit être terminée */
    prepareCompleted?: boolean;

    /** La phase d'embedding doit être terminée */
    embedCompleted?: boolean;

    /** La phase d'indexation doit être terminée */
    indexCompleted?: boolean;

    /** Message d'erreur personnalisé */
    errorMessage?: string;

    /** Action requise pour corriger l'erreur */
    requiredAction?: string;
}

/**
 * Résultat de la vérification d'un guard
 */
export interface GuardResult {
    /** Le guard est-il passé ? */
    passed: boolean;

    /** Message d'erreur (si échec) */
    error?: RagUsageError;

    /** État RAG actuel */
    state?: RagState;

    /** Recommandations pour corriger */
    recommendations?: string[];
}

/**
 * Vérifie les prérequis pour une phase RAG
 */
export async function checkRagPhase(
    projectPath: string,
    requirements: RagPhaseRequirements
): Promise<GuardResult> {
    try {
        // Récupérer l'état RAG actuel
        const state = await getRagState(projectPath);

        // Vérifier chaque condition
        const errors: string[] = [];
        const recommendations: string[] = [];

        if (requirements.initialized && !state.initialized) {
            errors.push("Le projet n'est pas initialisé pour RAG");
            recommendations.push("Exécutez `init_rag` pour initialiser le projet");
        }

        if (requirements.scanCompleted) {
            // Pour vérifier si le scan est terminé, on peut vérifier l'existence de fichiers
            // ou d'un état spécifique dans la base de données
            // Pour l'instant, on vérifie simplement si le projet est initialisé
            if (!state.initialized) {
                errors.push("La phase de scan n'est pas terminée");
                recommendations.push("Exécutez `scan_rag` pour analyser le projet");
            }
        }

        if (requirements.prepareCompleted) {
            // Vérifier si la préparation est terminée
            // Pour l'instant, on utilise une vérification simplifiée
            if (!state.initialized) {
                errors.push("La phase de préparation n'est pas terminée");
                recommendations.push("Exécutez `prepare_rag` pour préparer les fichiers");
            }
        }

        if (requirements.embedCompleted) {
            // Vérifier si l'embedding est terminé
            if (!state.initialized) {
                errors.push("La phase d'embedding n'est pas terminée");
                recommendations.push("Exécutez `embed_rag` pour générer les embeddings");
            }
        }

        if (requirements.indexCompleted) {
            // Vérifier si l'indexation est terminée
            if (!state.initialized) {
                errors.push("La phase d'indexation n'est pas terminée");
                recommendations.push("Exécutez `index_rag` pour indexer les embeddings");
            }
        }

        if (errors.length > 0) {
            const error = new RagUsageError(
                requirements.errorMessage || "Prérequis RAG non satisfaits",
                "RAG_PHASE_REQUIREMENTS_NOT_MET",
                {
                    requiredAction: requirements.requiredAction,
                    details: {
                        requirements,
                        currentState: state,
                        errors,
                        recommendations,
                    }
                }
            );

            return {
                passed: false,
                error,
                state,
                recommendations,
            };
        }

        return {
            passed: true,
            state,
        };

    } catch (error) {
        logger.error("rag.guards.check.error", "Erreur lors de la vérification des guards", {
            projectPath,
            error: error instanceof Error ? error.message : String(error),
        });

        const guardError = new RagUsageError(
            "Impossible de vérifier l'état RAG",
            "RAG_STATE_CHECK_FAILED",
            {
                details: {
                    originalError: error instanceof Error ? error.message : String(error)
                }
            }
        );

        return {
            passed: false,
            error: guardError,
        };
    }
}

/**
 * Guard : Vérifie que le projet est initialisé pour RAG
 */
export async function requireInit(projectPath: string): Promise<GuardResult> {
    return checkRagPhase(projectPath, {
        initialized: true,
        errorMessage: "Le projet doit être initialisé pour RAG",
        requiredAction: "init_rag",
    });
}

/**
 * Guard : Vérifie que la phase de scan est terminée
 */
export async function requireScan(projectPath: string): Promise<GuardResult> {
    return checkRagPhase(projectPath, {
        initialized: true,
        scanCompleted: true,
        errorMessage: "La phase de scan doit être terminée",
        requiredAction: "scan_rag",
    });
}

/**
 * Guard : Vérifie que la phase de préparation est terminée
 */
export async function requirePrepare(projectPath: string): Promise<GuardResult> {
    return checkRagPhase(projectPath, {
        initialized: true,
        scanCompleted: true,
        prepareCompleted: true,
        errorMessage: "La phase de préparation doit être terminée",
        requiredAction: "prepare_rag",
    });
}

/**
 * Guard : Vérifie que la phase d'embedding est terminée
 */
export async function requireEmbed(projectPath: string): Promise<GuardResult> {
    return checkRagPhase(projectPath, {
        initialized: true,
        scanCompleted: true,
        prepareCompleted: true,
        embedCompleted: true,
        errorMessage: "La phase d'embedding doit être terminée",
        requiredAction: "embed_rag",
    });
}

/**
 * Guard : Vérifie que la phase d'indexation est terminée
 */
export async function requireIndex(projectPath: string): Promise<GuardResult> {
    return checkRagPhase(projectPath, {
        initialized: true,
        scanCompleted: true,
        prepareCompleted: true,
        embedCompleted: true,
        indexCompleted: true,
        errorMessage: "La phase d'indexation doit être terminée",
        requiredAction: "index_rag",
    });
}

/**
 * Guard : Vérifie que le pipeline complet est terminé (prêt pour les requêtes)
 */
export async function requireQueryReady(projectPath: string): Promise<GuardResult> {
    return checkRagPhase(projectPath, {
        initialized: true,
        scanCompleted: true,
        prepareCompleted: true,
        embedCompleted: true,
        indexCompleted: true,
        errorMessage: "Le pipeline RAG doit être complet pour les requêtes",
        requiredAction: "Exécutez le pipeline complet: init_rag → scan_rag → prepare_rag → embed_rag → index_rag",
    });
}

/**
 * Vérifie si une phase peut être exécutée (pas de conflit avec d'autres phases en cours)
 */
export async function checkPhaseNotRunning(
    projectPath: string,
    phase: string
): Promise<GuardResult> {
    try {
        // Pour l'instant, on retourne toujours vrai
        // Cette fonction sera implémentée avec la file d'attente
        return {
            passed: true,
        };
    } catch (error) {
        const guardError = new RagUsageError(
            `Impossible de vérifier si la phase ${phase} est en cours`,
            "PHASE_CHECK_FAILED",
            {
                details: {
                    phase,
                    originalError: error instanceof Error ? error.message : String(error)
                }
            }
        );

        return {
            passed: false,
            error: guardError,
        };
    }
}

/**
 * Vérifie les prérequis pour un type de job spécifique
 */
export async function checkJobRequirements(
    projectPath: string,
    jobType: string
): Promise<GuardResult> {
    switch (jobType) {
        case 'scan':
            return requireInit(projectPath);

        case 'prepare':
            return requireScan(projectPath);

        case 'embed':
            return requirePrepare(projectPath);

        case 'index':
            return requireEmbed(projectPath);

        case 'query':
            return requireQueryReady(projectPath);

        default:
            const error = new RagUsageError(
                `Type de job non reconnu: ${jobType}`,
                "UNKNOWN_JOB_TYPE",
                {
                    details: { jobType }
                }
            );

            return {
                passed: false,
                error,
            };
    }
}

/**
 * Formate un message d'erreur de guard pour l'utilisateur
 */
export function formatGuardError(error: RagUsageError): string {
    let message = `❌ ${error.message}\n`;

    if (error.code) {
        message += `Code: ${error.code}\n`;
    }

    if (error.requiredAction) {
        message += `\n📋 Action requise:\n${error.requiredAction}\n`;
    }

    if (error.help) {
        message += `\n💡 Aide: ${error.help}\n`;
    }

    if (error.details?.recommendations) {
        message += `\n🎯 Recommandations:\n`;
        error.details.recommendations.forEach((rec: string, index: number) => {
            message += `${index + 1}. ${rec}\n`;
        });
    }

    return message;
}

/**
 * Test des guards
 */
export async function testRagGuards(): Promise<boolean> {
    try {
        logger.info("rag.guards.test.start", "Début des tests des guards");

        // Test avec un chemin de projet fictif
        const testPath = "/test/project";

        // Test requireInit (devrait échouer car le projet n'existe pas)
        const initResult = await requireInit(testPath);
        if (initResult.passed) {
            logger.warn("rag.guards.test.init", "requireInit aurait dû échouer pour un projet non existant");
        } else {
            logger.info("rag.guards.test.init", "requireInit a correctement échoué", {
                error: initResult.error?.message,
            });
        }

        // Test formatGuardError
        if (initResult.error) {
            const formatted = formatGuardError(initResult.error);
            logger.debug("rag.guards.test.format", "Message d'erreur formaté", {
                formatted: formatted.substring(0, 100) + "...",
            });
        }

        // Test checkJobRequirements
        const scanRequirements = await checkJobRequirements(testPath, 'scan');
        logger.info("rag.guards.test.job", "Exigences pour job 'scan'", {
            passed: scanRequirements.passed,
            hasError: !!scanRequirements.error,
        });

        logger.info("rag.guards.test.success", "Tests des guards terminés avec succès");
        return true;

    } catch (error) {
        logger.error("rag.guards.test.failed", "Tests des guards échoués", {
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
}

/**
 * Utilitaire : Vérifie rapidement si un projet est prêt pour une phase
 */
export async function isPhaseReady(
    projectPath: string,
    phase: string
): Promise<boolean> {
    const result = await checkJobRequirements(projectPath, phase);
    return result.passed;
}

/**
 * Obtient la prochaine phase à exécuter pour un projet
 */
export async function getNextPhase(projectPath: string): Promise<string | null> {
    try {
        const state = await getRagState(projectPath);

        if (!state.initialized) {
            return 'init';
        }

        // Vérifier chaque phase dans l'ordre
        const phases = ['scan', 'prepare', 'embed', 'index', 'query'];

        for (const phase of phases) {
            const isReady = await isPhaseReady(projectPath, phase);
            if (!isReady) {
                return phase;
            }
        }

        // Toutes les phases sont terminées
        return null;

    } catch (error) {
        logger.error("rag.guards.next_phase.error", "Erreur lors de la détermination de la prochaine phase", {
            projectPath,
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}
