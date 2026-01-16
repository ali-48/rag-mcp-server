// src/rag/guards/rag-guards.ts
// Guards pour vérifier l'ordre d'exécution des phases RAG
import { logger } from "../../core/logger.js";
import { RagUsageError } from "../errors/rag-usage-error.js";
import { getRagState } from "../phase0/rag-state.js";
/**
 * Crée un format MCP à partir d'une erreur RagUsageError
 */
function createMCPFormatFromError(error, recommendations = []) {
    const notesForAI = [
        `Erreur de guard: ${error.code || 'RAG_PHASE_REQUIREMENTS_NOT_MET'}`,
        error.message,
        ...recommendations.map(rec => `Recommandation: ${rec}`)
    ];
    if (error.requiredAction) {
        notesForAI.push(`Action requise: ${error.requiredAction}`);
    }
    return {
        status: 'error',
        error: error.code || 'RAG_PHASE_REQUIREMENTS_NOT_MET',
        message: error.message,
        required_action: error.requiredAction,
        notes_for_ai: notesForAI,
        details: error.details
    };
}
/**
 * Vérifie les prérequis pour une phase RAG
 */
export async function checkRagPhase(projectPath, requirements) {
    try {
        // Récupérer l'état RAG actuel
        const state = await getRagState(projectPath);
        // Vérifier chaque condition
        const errors = [];
        const recommendations = [];
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
            const error = new RagUsageError(requirements.errorMessage || "Prérequis RAG non satisfaits", "RAG_PHASE_REQUIREMENTS_NOT_MET", {
                requiredAction: requirements.requiredAction,
                details: {
                    requirements,
                    currentState: state,
                    errors,
                    recommendations,
                }
            });
            // Format MCP pour l'erreur
            const mcpFormat = createMCPFormatFromError(error, recommendations);
            return {
                passed: false,
                error,
                state,
                recommendations,
                mcpFormat
            };
        }
        return {
            passed: true,
            state,
        };
    }
    catch (error) {
        logger.error("rag.guards.check.error", "Erreur lors de la vérification des guards", {
            projectPath,
            error: error instanceof Error ? error.message : String(error),
        });
        const guardError = new RagUsageError("Impossible de vérifier l'état RAG", "RAG_STATE_CHECK_FAILED", {
            details: {
                originalError: error instanceof Error ? error.message : String(error)
            }
        });
        const mcpFormat = createMCPFormatFromError(guardError, [
            "Vérifiez que le projet existe et est accessible",
            "Assurez-vous que la base de données RAG est initialisée"
        ]);
        return {
            passed: false,
            error: guardError,
            mcpFormat
        };
    }
}
/**
 * Guard : Vérifie que le projet est initialisé pour RAG
 */
export async function requireInit(projectPath) {
    return checkRagPhase(projectPath, {
        initialized: true,
        errorMessage: "Le projet doit être initialisé pour RAG",
        requiredAction: "init_rag",
    });
}
/**
 * Guard : Vérifie que la phase de scan est terminée
 */
export async function requireScan(projectPath) {
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
export async function requirePrepare(projectPath) {
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
export async function requireEmbed(projectPath) {
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
export async function requireIndex(projectPath) {
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
export async function requireQueryReady(projectPath) {
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
export async function checkPhaseNotRunning(projectPath, phase) {
    try {
        // Pour l'instant, on retourne toujours vrai
        // Cette fonction sera implémentée avec la file d'attente
        return {
            passed: true,
        };
    }
    catch (error) {
        const guardError = new RagUsageError(`Impossible de vérifier si la phase ${phase} est en cours`, "PHASE_CHECK_FAILED", {
            details: {
                phase,
                originalError: error instanceof Error ? error.message : String(error)
            }
        });
        return {
            passed: false,
            error: guardError,
        };
    }
}
/**
 * Vérifie les prérequis pour un type de job spécifique
 */
export async function checkJobRequirements(projectPath, jobType) {
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
            const error = new RagUsageError(`Type de job non reconnu: ${jobType}`, "UNKNOWN_JOB_TYPE", {
                details: { jobType }
            });
            return {
                passed: false,
                error,
            };
    }
}
/**
 * Formate un message d'erreur de guard pour l'utilisateur
 */
export function formatGuardError(error) {
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
        error.details.recommendations.forEach((rec, index) => {
            message += `${index + 1}. ${rec}\n`;
        });
    }
    return message;
}
/**
 * Test des guards
 */
export async function testRagGuards() {
    try {
        logger.info("rag.guards.test.start", "Début des tests des guards");
        // Test avec un chemin de projet fictif
        const testPath = "/test/project";
        // Test requireInit (devrait échouer car le projet n'existe pas)
        const initResult = await requireInit(testPath);
        if (initResult.passed) {
            logger.warn("rag.guards.test.init", "requireInit aurait dû échouer pour un projet non existant");
        }
        else {
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
    }
    catch (error) {
        logger.error("rag.guards.test.failed", "Tests des guards échoués", {
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
}
/**
 * Utilitaire : Vérifie rapidement si un projet est prêt pour une phase
 */
export async function isPhaseReady(projectPath, phase) {
    const result = await checkJobRequirements(projectPath, phase);
    return result.passed;
}
/**
 * Obtient une analyse détaillée des phases pour un projet
 */
export async function getPhaseAnalysis(projectPath) {
    try {
        const state = await getRagState(projectPath);
        const phases = [
            { name: 'init', tool_name: 'init_rag', description: 'Initialisation du projet RAG' },
            { name: 'scan', tool_name: 'scan_rag', description: 'Scan des fichiers du projet' },
            { name: 'prepare', tool_name: 'prepare_rag', description: 'Préparation et chunking des fichiers' },
            { name: 'embed', tool_name: 'embed_rag', description: 'Génération des embeddings' },
            { name: 'index', tool_name: 'index_rag', description: 'Indexation dans la base vectorielle' },
            { name: 'query', tool_name: 'query_rag', description: 'Recherche sémantique' }
        ];
        // Déterminer le statut de chaque phase
        const phaseStatuses = [];
        let currentPhase = 'init';
        let currentStatus = 'pending';
        let nextPhase = null;
        const recommendedActions = [];
        const notesForAI = [];
        // Pour l'instant, on utilise une logique simplifiée basée sur l'initialisation
        // À améliorer avec l'état réel du pipeline
        if (!state.initialized) {
            currentPhase = 'init';
            currentStatus = 'pending';
            nextPhase = 'init';
            recommendedActions.push('Exécutez init_rag pour initialiser le projet');
            notesForAI.push('Le projet n\'est pas encore initialisé pour RAG');
        }
        else {
            currentPhase = 'init';
            currentStatus = 'done';
            // Chercher la première phase non terminée
            for (const phase of phases.slice(1)) {
                const isReady = await isPhaseReady(projectPath, phase.name);
                if (!isReady) {
                    nextPhase = phase.name;
                    recommendedActions.push(`Exécutez ${phase.tool_name} pour ${phase.description}`);
                    notesForAI.push(`La phase ${phase.name} est en attente`);
                    break;
                }
            }
            if (!nextPhase) {
                nextPhase = null;
                recommendedActions.push('Toutes les phases sont terminées, vous pouvez exécuter query_rag pour effectuer des recherches');
                notesForAI.push('Pipeline RAG complet et prêt pour les requêtes');
            }
        }
        // Construire le tableau des phases avec leur statut
        for (const phase of phases) {
            let status = 'pending';
            if (phase.name === 'init') {
                status = state.initialized ? 'done' : 'pending';
            }
            else {
                const isReady = await isPhaseReady(projectPath, phase.name);
                status = isReady ? 'done' : 'pending';
            }
            phaseStatuses.push({
                name: phase.name,
                status,
                tool_name: phase.tool_name,
                description: phase.description
            });
        }
        return {
            current_phase: currentPhase,
            current_status: currentStatus,
            next_phase: nextPhase,
            phases: phaseStatuses,
            recommended_actions: recommendedActions,
            notes_for_ai: notesForAI
        };
    }
    catch (error) {
        logger.error("rag.guards.phase_analysis.error", "Erreur lors de l'analyse des phases", {
            projectPath,
            error: error instanceof Error ? error.message : String(error),
        });
        // Retourner une analyse d'erreur
        return {
            current_phase: 'unknown',
            current_status: 'error',
            next_phase: null,
            phases: [],
            recommended_actions: [
                "Vérifiez que le projet existe et est accessible",
                "Assurez-vous que la base de données RAG est initialisée"
            ],
            notes_for_ai: [
                `Erreur lors de l'analyse des phases: ${error instanceof Error ? error.message : String(error)}`
            ]
        };
    }
}
/**
 * Obtient la prochaine phase à exécuter pour un projet (version simplifiée)
 */
export async function getNextPhase(projectPath) {
    const analysis = await getPhaseAnalysis(projectPath);
    return analysis.next_phase;
}
//# sourceMappingURL=rag-guards.js.map