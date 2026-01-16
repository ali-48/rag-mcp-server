// src/tools/rag/activated-rag.ts
// Outil désactivé: activated_rag - Utilisez le pipeline RAG explicite
// Version: v5.0.0 (désactivé)
// Responsabilités: Retourner une erreur guidée avec le pipeline explicite

import { logger } from "../../core/logger.js";
import { ToolDefinition, ToolHandler } from "../../core/tool-registry.js";
import { RagUsageError } from "../../rag/errors/rag-usage-error.js";

/**
 * Définition de l'outil activated_rag (désactivé)
 */
export const activatedRagTool: ToolDefinition = {
    name: "activated_rag",
    description: "⚠️ OUTIL DÉSACTIVÉ - Utilisez le pipeline RAG explicite: init_rag → scan_rag → prepare_rag → embed_rag → index_rag",
    inputSchema: {
        type: "object",
        properties: {
            // Paramètres conservés pour la rétrocompatibilité (mais ignorés)
            mode: {
                type: "string",
                description: "⚠️ Mode d'opération (ignoré - outil désactivé)",
                enum: ["full", "incremental", "watch", "analyze_only"],
                default: "full"
            },
            project_path: {
                type: "string",
                description: "⚠️ Chemin du projet (ignoré - outil désactivé)"
            },
            wait_for_completion: {
                type: "boolean",
                description: "⚠️ Attendre la complétion (ignoré - outil désactivé)",
                default: false
            }
        }
    },
};

/**
 * Handler pour l'outil activated_rag (désactivé)
 * Retourne toujours une erreur RAG_PIPELINE_REQUIRED avec le pipeline explicite
 */
export const activatedRagHandler: ToolHandler = async (args) => {
    const startTime = Date.now();

    try {
        logger.warn("rag.activated.disabled.called", "L'outil activated_rag a été appelé (désactivé)", {
            project_path: args.project_path,
            mode: args.mode,
            wait_for_completion: args.wait_for_completion,
            timestamp: new Date().toISOString()
        });

        // Créer l'erreur de pipeline requis
        const error = RagUsageError.pipelineRequired();

        // Formater la réponse pour MCP
        const mcpResponse = error.formatForMCP();

        // Ajouter des informations supplémentaires pour la migration
        mcpResponse.migration_guide = {
            status: "required",
            reason: "activated_rag est désactivé pour éviter les exécutions monolithiques non contrôlées",
            new_pipeline: [
                {
                    tool: "init_rag",
                    description: "Initialiser le projet RAG",
                    parameters: {
                        project_path: args.project_path || "auto-détecté",
                        mode: "default"
                    }
                },
                {
                    tool: "scan_rag",
                    description: "Analyser les fichiers du projet",
                    parameters: {
                        project_path: args.project_path || "auto-détecté",
                        enable_workspace_detection: true
                    }
                },
                {
                    tool: "prepare_rag",
                    description: "Préparer les fichiers pour l'embedding",
                    parameters: {
                        project_path: args.project_path || "auto-détecté",
                        chunking_strategy: "logical"
                    }
                },
                {
                    tool: "embed_rag",
                    description: "Générer les embeddings",
                    parameters: {
                        project_path: args.project_path || "auto-détecté",
                        embedding_model: "nomic-embed-text"
                    }
                },
                {
                    tool: "index_rag",
                    description: "Indexer les embeddings",
                    parameters: {
                        project_path: args.project_path || "auto-détecté",
                        mode: args.mode || "full"
                    }
                }
            ],
            benefits: [
                "Contrôle granulaire sur chaque phase",
                "Reprise après crash possible",
                "Monitoring individuel de chaque étape",
                "Meilleure gestion des erreurs",
                "Optimisation indépendante par phase"
            ]
        };

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(3);

        mcpResponse.duration_seconds = parseFloat(duration);
        mcpResponse.timestamp = new Date().toISOString();

        return {
            content: [{
                type: "text",
                text: JSON.stringify(mcpResponse, null, 2)
            }]
        };

    } catch (error) {
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(3);

        logger.error("rag.activated.disabled.error", "Erreur lors du traitement de la désactivation", {
            error: error instanceof Error ? error.message : String(error),
            duration_seconds: parseFloat(duration)
        });

        // En cas d'erreur, retourner une erreur générique
        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    success: false,
                    error: "RAG_PIPELINE_REQUIRED",
                    message: "activated_rag est désactivé. Utilisez le pipeline RAG explicite.",
                    required_action: "Exécutez le pipeline complet: init_rag → scan_rag → prepare_rag → embed_rag → index_rag",
                    duration_seconds: parseFloat(duration),
                    timestamp: new Date().toISOString()
                }, null, 2)
            }]
        };
    }
};

/**
 * Test de la désactivation
 */
export async function testActivatedRagDisabled(): Promise<boolean> {
    try {
        logger.info("rag.activated.disabled.test.start", "Début du test de désactivation");

        // Simuler un appel à l'outil désactivé
        const testArgs = {
            project_path: "/test/project",
            mode: "full",
            wait_for_completion: false
        };

        const response = await activatedRagHandler(testArgs);

        if (!response.content || response.content.length === 0) {
            throw new Error("Réponse vide");
        }

        const responseText = response.content[0].text;
        const parsedResponse = JSON.parse(responseText);

        if (parsedResponse.success !== false) {
            throw new Error("La réponse devrait indiquer success: false");
        }

        if (parsedResponse.error !== "RAG_PIPELINE_REQUIRED") {
            throw new Error(`Code d'erreur incorrect: ${parsedResponse.error}`);
        }

        if (!parsedResponse.migration_guide) {
            throw new Error("Guide de migration manquant");
        }

        logger.info("rag.activated.disabled.test.success", "Test de désactivation réussi");
        return true;

    } catch (error) {
        logger.error("rag.activated.disabled.test.failed", "Test de désactivation échoué", {
            error: error instanceof Error ? error.message : String(error)
        });
        return false;
    }
}

/**
 * Vérifie si activated_rag est désactivé
 */
export function isActivatedRagDisabled(): boolean {
    return true;
}

/**
 * Obtient le guide de migration pour activated_rag
 */
export function getMigrationGuide(): Record<string, any> {
    return {
        status: "disabled",
        version: "v5.0.0",
        disabled_since: "2025-01-14",
        reason: "Éviter les exécutions monolithiques non contrôlées",
        alternative_pipeline: [
            "init_rag",
            "scan_rag",
            "prepare_rag",
            "embed_rag",
            "index_rag"
        ],
        benefits: [
            "Contrôle granulaire sur chaque phase",
            "Reprise après crash possible",
            "Monitoring individuel de chaque étape",
            "Meilleure gestion des erreurs",
            "Optimisation indépendante par phase"
        ],
        migration_example: {
            before: "activated_rag({ project_path: '/my/project', mode: 'full' })",
            after: [
                "init_rag({ project_path: '/my/project' })",
                "scan_rag({ project_path: '/my/project' })",
                "prepare_rag({ project_path: '/my/project' })",
                "embed_rag({ project_path: '/my/project' })",
                "index_rag({ project_path: '/my/project', mode: 'full' })"
            ]
        }
    };
}
