// src/tools/rag/pipeline-validator.ts
// Outil pipeline_validator - Validation des pipelines RAG déclaratifs
// Responsabilités: Validation JSON Schema, vérification des dépendances, compatibilité inputs/outputs

import { readFileSync } from 'fs';
import { join } from 'path';
import { validateJsonSchema } from "../../core/json-schema-validator.js";
import { logger } from "../../core/logger.js";
import { ToolDefinition, ToolHandler } from "../../core/tool-registry.js";

/**
 * Définition de l'outil pipeline_validator
 */
export const pipelineValidatorTool: ToolDefinition = {
    name: "pipeline_validator",
    description: "Validation des pipelines RAG déclaratifs (JSON Schema, dépendances, compatibilité)",
    inputSchema: {
        type: "object",
        properties: {
            pipeline_path: {
                type: "string",
                description: "Chemin vers le fichier pipeline.json à valider"
            },
            validate_schema: {
                type: "boolean",
                description: "Valider contre le schéma JSON",
                default: true
            },
            validate_dependencies: {
                type: "boolean",
                description: "Valider les dépendances entre phases",
                default: true
            },
            validate_io_compatibility: {
                type: "boolean",
                description: "Valider la compatibilité inputs/outputs",
                default: true
            },
            validate_workflows: {
                type: "boolean",
                description: "Valider les workflows prédéfinis",
                default: true
            },
            strict_mode: {
                type: "boolean",
                description: "Mode strict (erreurs bloquantes)",
                default: false
            }
        },
        required: ["pipeline_path"]
    },
};

/**
 * Handler pour l'outil pipeline_validator
 */
export const pipelineValidatorHandler: ToolHandler = async (args) => {
    const startTime = Date.now();

    try {
        const pipelinePath = args.pipeline_path;
        const validateSchema = args.validate_schema !== false;
        const validateDependencies = args.validate_dependencies !== false;
        const validateIO = args.validate_io_compatibility !== false;
        const validateWorkflows = args.validate_workflows !== false;
        const strictMode = args.strict_mode === true;

        logger.info("rag.pipeline_validator.start", "Début de la validation du pipeline", {
            pipeline_path: pipelinePath,
            options: {
                validate_schema: validateSchema,
                validate_dependencies: validateDependencies,
                validate_io_compatibility: validateIO,
                validate_workflows: validateWorkflows,
                strict_mode: strictMode
            }
        });

        // 1. Charger le pipeline
        let pipelineData;
        try {
            const fileContent = readFileSync(pipelinePath, 'utf-8');
            pipelineData = JSON.parse(fileContent);
            logger.info("rag.pipeline_validator.loaded", "Pipeline chargé avec succès", {
                name: pipelineData.name,
                version: pipelineData.version,
                phases_count: pipelineData.phases?.length || 0
            });
        } catch (error: any) {
            const errorMessage = `Erreur lors du chargement du pipeline: ${error.message}`;
            logger.error("rag.pipeline_validator.load_error", errorMessage, { error: error.message });
            throw new Error(errorMessage);
        }

        const validationResults = {
            schema: { valid: false, errors: [] as string[] },
            dependencies: { valid: false, errors: [] as string[] },
            io_compatibility: { valid: false, errors: [] as string[] },
            workflows: { valid: false, errors: [] as string[] },
            overall: { valid: false, warnings: [] as string[] }
        };

        // 2. Validation JSON Schema
        if (validateSchema) {
            try {
                const schemaPath = join(__dirname, '../../../config/pipeline-schema.json');
                const schemaContent = readFileSync(schemaPath, 'utf-8');
                const schema = JSON.parse(schemaContent);

                const schemaResult = validateJsonSchema(pipelineData, schema);
                validationResults.schema.valid = schemaResult.valid;
                validationResults.schema.errors = schemaResult.errors || [];

                if (schemaResult.valid) {
                    logger.info("rag.pipeline_validator.schema_valid", "Validation JSON Schema réussie");
                } else {
                    logger.warn("rag.pipeline_validator.schema_invalid", "Validation JSON Schema échouée", {
                        errors: schemaResult.errors
                    });
                }
            } catch (error: any) {
                const errorMessage = `Erreur lors de la validation JSON Schema: ${error.message}`;
                validationResults.schema.errors.push(errorMessage);
                logger.error("rag.pipeline_validator.schema_error", errorMessage, { error: error.message });
            }
        } else {
            validationResults.schema.valid = true;
            logger.info("rag.pipeline_validator.schema_skipped", "Validation JSON Schema ignorée");
        }

        // 3. Validation des dépendances
        if (validateDependencies && pipelineData.phases && pipelineData.dependencies) {
            const phases = pipelineData.phases;
            const dependencies = pipelineData.dependencies;
            const phaseIds = new Set(phases.map((p: any) => p.id));

            // Vérifier que toutes les phases référencées existent
            for (const [phaseId, depList] of Object.entries(dependencies)) {
                if (!phaseIds.has(phaseId)) {
                    validationResults.dependencies.errors.push(`Phase '${phaseId}' dans les dépendances n'existe pas`);
                }

                const deps = depList as string[];
                for (const depId of deps) {
                    if (!phaseIds.has(depId)) {
                        validationResults.dependencies.errors.push(`Dépendance '${depId}' pour '${phaseId}' n'existe pas`);
                    }
                }
            }

            // Vérifier les cycles dans les dépendances
            const hasCycle = checkDependencyCycles(dependencies);
            if (hasCycle) {
                validationResults.dependencies.errors.push("Cycle détecté dans les dépendances entre phases");
            }

            validationResults.dependencies.valid = validationResults.dependencies.errors.length === 0;

            if (validationResults.dependencies.valid) {
                logger.info("rag.pipeline_validator.deps_valid", "Validation des dépendances réussie");
            } else {
                logger.warn("rag.pipeline_validator.deps_invalid", "Validation des dépendances échouée", {
                    errors: validationResults.dependencies.errors
                });
            }
        } else {
            validationResults.dependencies.valid = true;
            logger.info("rag.pipeline_validator.deps_skipped", "Validation des dépendances ignorée");
        }

        // 4. Validation compatibilité inputs/outputs
        if (validateIO && pipelineData.phases && pipelineData.dependencies) {
            const phases = pipelineData.phases as Array<{ id: string; inputs: string[]; outputs: string[] }>;
            const phaseMap = new Map(phases.map(p => [p.id, p]));

            for (const phase of phases) {
                // Vérifier que les inputs référencent des outputs existants dans les phases précédentes
                for (const input of phase.inputs || []) {
                    let found = false;

                    // Chercher dans les dépendances
                    const deps = pipelineData.dependencies[phase.id] || [];
                    for (const depId of deps) {
                        const depPhase = phaseMap.get(depId);
                        if (depPhase && (depPhase.outputs || []).includes(input)) {
                            found = true;
                            break;
                        }
                    }

                    if (!found && phase.inputs.length > 0) {
                        validationResults.io_compatibility.errors.push(
                            `Input '${input}' de la phase '${phase.id}' n'est produit par aucune phase dépendante`
                        );
                    }
                }

                // Vérifier que les outputs sont uniques (pas de conflits)
                for (const output of phase.outputs || []) {
                    let conflictPhase = null;
                    for (const otherPhase of phases) {
                        if (otherPhase.id !== phase.id && (otherPhase.outputs || []).includes(output)) {
                            conflictPhase = otherPhase.id;
                            break;
                        }
                    }

                    if (conflictPhase) {
                        validationResults.io_compatibility.errors.push(
                            `Output '${output}' de la phase '${phase.id}' en conflit avec la phase '${conflictPhase}'`
                        );
                    }
                }
            }

            validationResults.io_compatibility.valid = validationResults.io_compatibility.errors.length === 0;

            if (validationResults.io_compatibility.valid) {
                logger.info("rag.pipeline_validator.io_valid", "Validation compatibilité I/O réussie");
            } else {
                logger.warn("rag.pipeline_validator.io_invalid", "Validation compatibilité I/O échouée", {
                    errors: validationResults.io_compatibility.errors
                });
            }
        } else {
            validationResults.io_compatibility.valid = true;
            logger.info("rag.pipeline_validator.io_skipped", "Validation compatibilité I/O ignorée");
        }

        // 5. Validation des workflows
        if (validateWorkflows && pipelineData.workflows && pipelineData.phases) {
            const workflows = pipelineData.workflows as Array<{ id: string; phases: string[] }>;
            const phaseIds = new Set(pipelineData.phases.map((p: any) => p.id));

            for (const workflow of workflows) {
                // Vérifier que toutes les phases du workflow existent
                for (const phaseId of workflow.phases) {
                    if (!phaseIds.has(phaseId)) {
                        validationResults.workflows.errors.push(
                            `Phase '${phaseId}' dans le workflow '${workflow.id}' n'existe pas`
                        );
                    }
                }

                // Vérifier l'ordre des phases (doit respecter les dépendances)
                const phaseOrder = workflow.phases;
                for (let i = 0; i < phaseOrder.length; i++) {
                    const phaseId = phaseOrder[i];
                    const deps = pipelineData.dependencies[phaseId] || [];

                    for (const depId of deps) {
                        const depIndex = phaseOrder.indexOf(depId);
                        if (depIndex > i) {
                            validationResults.workflows.errors.push(
                                `Workflow '${workflow.id}': Phase '${phaseId}' dépend de '${depId}' mais vient avant dans l'ordre`
                            );
                        }
                    }
                }
            }

            validationResults.workflows.valid = validationResults.workflows.errors.length === 0;

            if (validationResults.workflows.valid) {
                logger.info("rag.pipeline_validator.workflows_valid", "Validation des workflows réussie");
            } else {
                logger.warn("rag.pipeline_validator.workflows_invalid", "Validation des workflows échouée", {
                    errors: validationResults.workflows.errors
                });
            }
        } else {
            validationResults.workflows.valid = true;
            logger.info("rag.pipeline_validator.workflows_skipped", "Validation des workflows ignorée");
        }

        // 6. Résultat global
        const allValid = validationResults.schema.valid &&
            validationResults.dependencies.valid &&
            validationResults.io_compatibility.valid &&
            validationResults.workflows.valid;

        const allErrors = [
            ...validationResults.schema.errors,
            ...validationResults.dependencies.errors,
            ...validationResults.io_compatibility.errors,
            ...validationResults.workflows.errors
        ];

        const hasErrors = allErrors.length > 0;

        validationResults.overall.valid = allValid;
        validationResults.overall.warnings = hasErrors ? allErrors : [];

        // Gestion du mode strict
        if (strictMode && hasErrors) {
            const errorMessage = `Pipeline invalide en mode strict: ${allErrors.join('; ')}`;
            logger.error("rag.pipeline_validator.strict_failed", errorMessage);
            throw new Error(errorMessage);
        }

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        logger.info("rag.pipeline_validator.completed", "Validation du pipeline terminée", {
            duration: `${duration}s`,
            overall_valid: allValid,
            has_errors: hasErrors,
            error_count: allErrors.length
        });

        // Préparer la réponse
        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    status: "ok",
                    message: hasErrors ? "Validation terminée avec erreurs" : "Validation réussie",
                    pipeline_path: pipelinePath,
                    duration_seconds: parseFloat(duration),
                    validation_results: validationResults,
                    summary: {
                        valid: allValid,
                        total_errors: allErrors.length,
                        total_warnings: validationResults.overall.warnings.length,
                        strict_mode: strictMode,
                        passed_strict: !(strictMode && hasErrors)
                    },
                    recommendations: hasErrors ? [
                        "Corrigez les erreurs listées ci-dessus",
                        "Réexécutez la validation après correction",
                        "Consultez la documentation des pipelines pour plus d'informations"
                    ] : [
                        "Le pipeline est valide et prêt à être utilisé",
                        "Vous pouvez maintenant exécuter les workflows définis",
                        "Utilisez activated_rag avec mode='full' pour exécuter le pipeline complet"
                    ],
                    timestamp: new Date().toISOString()
                }, null, 2)
            }]
        };

    } catch (error: any) {
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        logger.error("rag.pipeline_validator.error", "Erreur lors de la validation", {
            error: error.message,
            stack: error.stack,
            duration: `${duration}s`
        });

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    status: "error",
                    error: "VALIDATION_ERROR",
                    message: error.message,
                    duration_seconds: parseFloat(duration),
                    timestamp: new Date().toISOString(),
                    stack_trace: error.stack
                }, null, 2)
            }]
        };
    }
};

/**
 * Vérifie les cycles dans les dépendances
 */
function checkDependencyCycles(dependencies: Record<string, string[]>): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    function hasCycle(node: string): boolean {
        if (!visited.has(node)) {
            visited.add(node);
            recursionStack.add(node);

            const neighbors = dependencies[node] || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor) && hasCycle(neighbor)) {
                    return true;
                } else if (recursionStack.has(neighbor)) {
                    return true;
                }
            }
        }

        recursionStack.delete(node);
        return false;
    }

    for (const node of Object.keys(dependencies)) {
        if (hasCycle(node)) {
            return true;
        }
    }

    return false;
}
