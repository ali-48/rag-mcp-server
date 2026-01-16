// src/tools/rag/activated-rag-refactored.ts
// Outil maître refactorisé: activated_rag - Orchestration via pipeline déclaratif
// Utilise les outils distincts: scan_rag, index_rag, query_rag
// Version: v3.0.0
// Responsabilités: Orchestration pipeline, gestion d'état, exécution séquentielle
import { readFileSync } from 'fs';
import { join } from 'path';
import { logger } from "../../core/logger.js";
import { toolRegistry } from "../../core/tool-registry.js";
import { getRagState, isRagInitialized } from "../../rag/phase0/rag-state.js";
/**
 * Définition de l'outil activated_rag refactorisé
 */
export const activatedRagRefactoredTool = {
    name: "activated_rag",
    description: "Outil maître d'orchestration RAG via pipeline déclaratif (scan → index → query)",
    inputSchema: {
        type: "object",
        properties: {
            // Mode d'opération
            mode: {
                type: "string",
                description: "Mode d'opération ou workflow prédéfini",
                enum: ["full", "incremental", "watch", "analyze_only", "search_only", "custom"],
                default: "full"
            },
            // Cible
            project_path: {
                type: "string",
                description: "Chemin absolu vers le projet (auto-détecté si vide)"
            },
            // Pipeline personnalisé
            pipeline_path: {
                type: "string",
                description: "Chemin vers un fichier pipeline.json personnalisé"
            },
            workflow_id: {
                type: "string",
                description: "ID du workflow à exécuter (si pipeline_path spécifié)"
            },
            // Options avancées
            enable_phase0: {
                type: "boolean",
                description: "Activer la Phase 0 (Workspace detection automatique)",
                default: true
            },
            enable_watcher: {
                type: "boolean",
                description: "Activer le file watcher en temps réel",
                default: false
            },
            enable_llm_enrichment: {
                type: "boolean",
                description: "Activer l'enrichissement LLM optionnel",
                default: false
            },
            // Filtres
            content_types: {
                type: "array",
                items: {
                    type: "string",
                    enum: ["code", "doc", "config", "other"]
                },
                description: "Types de contenu à inclure"
            },
            languages: {
                type: "array",
                items: { type: "string" },
                description: "Langages à inclure (ex: ['typescript', 'python'])"
            },
            // Configuration embeddings
            embedding_models: {
                type: "object",
                description: "Modèles d'embeddings par type de contenu",
                properties: {
                    code: { type: "string" },
                    text: { type: "string" },
                    config: { type: "string" }
                }
            },
            // Options de chunking
            chunking_strategy: {
                type: "string",
                description: "Stratégie de chunking",
                enum: ["logical", "fixed", "ai_enhanced"],
                default: "logical"
            },
            max_chunk_size: {
                type: "number",
                description: "Taille maximale des chunks (tokens)",
                default: 1000
            },
            // Métadonnées
            metadata_overrides: {
                type: "object",
                description: "Surcharges de métadonnées"
            },
            // Options d'exécution
            validate_pipeline: {
                type: "boolean",
                description: "Valider le pipeline avant exécution",
                default: true
            },
            stop_on_error: {
                type: "boolean",
                description: "Arrêter l'exécution en cas d'erreur",
                default: true
            },
            max_concurrent_phases: {
                type: "number",
                description: "Nombre maximum de phases concurrentes",
                default: 1,
                minimum: 1,
                maximum: 10
            }
        }
    },
};
// Alias pour compatibilité avec le code existant
export const activatedRagTool = activatedRagRefactoredTool;
/**
 * Handler pour l'outil activated_rag refactorisé
 */
export const activatedRagRefactoredHandler = async (args) => {
    const startTime = Date.now();
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    try {
        logger.info("rag.activated.refactored.start", "Début de l'orchestration pipeline", {
            execution_id: executionId,
            mode: args.mode,
            project_path: args.project_path
        });
        // ========== DÉTECTION AUTOMATIQUE DU PROJET ==========
        let projectPath = args.project_path;
        if (!projectPath) {
            projectPath = await detectProjectPath();
            logger.info("rag.activated.refactored.project.detected", "Projet auto-détecté", { project_path: projectPath });
        }
        // ========== VÉRIFICATION RAG INITIALISÉ ==========
        const isInitialized = await isRagInitialized(projectPath);
        if (!isInitialized) {
            const errorMessage = `RAG non initialisé pour le projet: ${projectPath}. Utilisez d'abord l'outil init_rag.`;
            logger.error("rag.activated.refactored.not_initialized", errorMessage, { project_path: projectPath });
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            error: "RAG_NOT_INITIALIZED",
                            message: errorMessage,
                            required_action: "run_init_rag",
                            details: {
                                project_path: projectPath,
                                rag_state: await getRagState(projectPath),
                                timestamp: new Date().toISOString()
                            }
                        }, null, 2)
                    }]
            };
        }
        // ========== CHARGEMENT DU PIPELINE ==========
        const pipeline = await loadPipeline(args.pipeline_path);
        logger.info("rag.activated.refactored.pipeline.loaded", "Pipeline chargé", {
            name: pipeline.name,
            version: pipeline.version,
            phases_count: pipeline.phases.length,
            workflows_count: pipeline.workflows.length
        });
        // ========== VALIDATION DU PIPELINE ==========
        if (args.validate_pipeline !== false) {
            await validatePipeline(pipeline, projectPath);
            logger.info("rag.activated.refactored.pipeline.validated", "Pipeline validé avec succès");
        }
        // ========== SÉLECTION DU WORKFLOW ==========
        const workflow = selectWorkflow(pipeline, args.mode, args.workflow_id);
        logger.info("rag.activated.refactored.workflow.selected", "Workflow sélectionné", {
            workflow_id: workflow.id,
            workflow_name: workflow.name,
            phases_count: workflow.phases.length
        });
        // ========== PRÉPARATION DE LA CONFIGURATION ==========
        const phaseConfigs = preparePhaseConfigs(pipeline, workflow, args);
        logger.info("rag.activated.refactored.config.prepared", "Configurations préparées", {
            phases: Object.keys(phaseConfigs)
        });
        // ========== EXÉCUTION SÉQUENTIELLE DES PHASES ==========
        const executionResults = await executePipelineSequentially(pipeline, workflow, phaseConfigs, projectPath, args);
        // ========== FINALISATION ==========
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        const summary = generateExecutionSummary(executionResults, pipeline, workflow, duration, executionId);
        logger.info("rag.activated.refactored.completed", "Orchestration pipeline terminée", {
            execution_id: executionId,
            duration: `${duration}s`,
            success: summary.success,
            phases_executed: summary.phases_executed,
            phases_failed: summary.phases_failed
        });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(summary, null, 2)
                }]
        };
    }
    catch (error) {
        // ========== GESTION DES ERREURS ==========
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        logger.error("rag.activated.refactored.error", "Erreur dans l'orchestration pipeline", {
            execution_id: executionId,
            error: error.message,
            stack: error.stack,
            duration: `${duration}s`
        });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: false,
                        execution_id: executionId,
                        error: "PIPELINE_ORCHESTRATION_ERROR",
                        message: error.message,
                        duration_seconds: parseFloat(duration),
                        timestamp: new Date().toISOString(),
                        stack_trace: error.stack
                    }, null, 2)
                }]
        };
    }
};
// Alias pour compatibilité avec le code existant
export const activatedRagHandler = activatedRagRefactoredHandler;
/**
 * Détecte automatiquement le chemin du projet
 */
async function detectProjectPath() {
    const fs = await import('fs');
    const path = await import('path');
    const cwd = process.cwd();
    // Vérifier si cwd contient des fichiers de projet
    const projectFiles = ['.git', 'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod'];
    const hasProjectFile = projectFiles.some(file => fs.existsSync(path.join(cwd, file)));
    if (hasProjectFile) {
        return cwd;
    }
    throw new Error("Impossible de détecter automatiquement le projet. Spécifiez 'project_path'.");
}
/**
 * Charge un pipeline depuis un fichier ou utilise le pipeline par défaut
 */
async function loadPipeline(pipelinePath) {
    if (pipelinePath) {
        try {
            const fileContent = readFileSync(pipelinePath, 'utf-8');
            return JSON.parse(fileContent);
        }
        catch (error) {
            throw new Error(`Erreur lors du chargement du pipeline: ${error.message}`);
        }
    }
    // Charger le pipeline par défaut
    const defaultPipelinePath = join(__dirname, '../../../config/pipeline.json');
    try {
        const fileContent = readFileSync(defaultPipelinePath, 'utf-8');
        return JSON.parse(fileContent);
    }
    catch (error) {
        throw new Error(`Erreur lors du chargement du pipeline par défaut: ${error.message}`);
    }
}
/**
 * Valide un pipeline
 */
async function validatePipeline(pipeline, projectPath) {
    // Vérifier que le pipeline_validator existe
    if (!toolRegistry.hasTool('pipeline_validator')) {
        logger.warn("rag.activated.refactored.validator.missing", "Pipeline validator non disponible, validation ignorée");
        return;
    }
    try {
        // Créer un fichier temporaire pour la validation
        const fs = await import('fs');
        const os = await import('os');
        const path = await import('path');
        const tempDir = os.tmpdir();
        const tempPipelinePath = path.join(tempDir, `pipeline_${Date.now()}.json`);
        fs.writeFileSync(tempPipelinePath, JSON.stringify(pipeline, null, 2));
        // Exécuter la validation
        const validationResult = await toolRegistry.execute('pipeline_validator', {
            pipeline_path: tempPipelinePath,
            validate_schema: true,
            validate_dependencies: true,
            validate_io_compatibility: true,
            validate_workflows: true,
            strict_mode: true
        });
        // Nettoyer le fichier temporaire
        fs.unlinkSync(tempPipelinePath);
        // Vérifier le résultat
        const resultContent = validationResult.content[0].text;
        const result = JSON.parse(resultContent);
        if (!result.validation_results.overall.valid) {
            const errors = result.validation_results.overall.warnings || [];
            throw new Error(`Pipeline invalide: ${errors.join('; ')}`);
        }
    }
    catch (error) {
        if (error.message.includes('Pipeline validator non disponible')) {
            // Ignorer si le validateur n'est pas disponible
            return;
        }
        throw error;
    }
}
/**
 * Sélectionne un workflow basé sur le mode ou l'ID
 */
function selectWorkflow(pipeline, mode, workflowId) {
    if (workflowId) {
        const workflow = pipeline.workflows.find(w => w.id === workflowId);
        if (!workflow) {
            throw new Error(`Workflow '${workflowId}' non trouvé dans le pipeline`);
        }
        return workflow;
    }
    // Mapper les modes aux workflows
    const modeToWorkflow = {
        'full': 'full_indexing',
        'incremental': 'incremental_update',
        'watch': 'full_indexing', // Même que full pour l'instant
        'analyze_only': 'analyze_and_index',
        'search_only': 'search_only',
        'custom': 'full_indexing' // Par défaut
    };
    const workflowIdFromMode = modeToWorkflow[mode];
    if (!workflowIdFromMode) {
        throw new Error(`Mode '${mode}' non supporté`);
    }
    const workflow = pipeline.workflows.find(w => w.id === workflowIdFromMode);
    if (!workflow) {
        throw new Error(`Workflow pour mode '${mode}' (${workflowIdFromMode}) non trouvé`);
    }
    return workflow;
}
/**
 * Prépare les configurations pour chaque phase
 */
function preparePhaseConfigs(pipeline, workflow, args) {
    const configs = {};
    for (const phaseId of workflow.phases) {
        const phase = pipeline.phases.find(p => p.id === phaseId);
        if (!phase) {
            throw new Error(`Phase '${phaseId}' non trouvée dans le pipeline`);
        }
        // Configuration de base de la phase
        let config = { ...phase.config };
        // Appliquer la configuration par défaut du workflow
        if (workflow.default_config) {
            config = { ...config, ...workflow.default_config };
        }
        // Appliquer les arguments de l'utilisateur
        config = applyUserArgsToConfig(config, args, phase.tool);
        // Ajouter le chemin du projet
        config.project_path = args.project_path;
        configs[phaseId] = config;
    }
    return configs;
}
/**
 * Applique les arguments de l'utilisateur à la configuration
 */
function applyUserArgsToConfig(config, args, toolName) {
    const toolConfigMap = {
        'scan_rag': ['enable_phase0', 'enable_watcher', 'enable_llm_enrichment', 'content_types', 'languages'],
        'index_rag': ['chunking_strategy', 'max_chunk_size', 'embedding_models', 'content_types', 'languages', 'metadata_overrides'],
        'query_rag': ['content_types', 'languages']
    };
    const relevantArgs = toolConfigMap[toolName] || [];
    const result = { ...config };
    for (const argName of relevantArgs) {
        if (args[argName] !== undefined) {
            result[argName] = args[argName];
        }
    }
    return result;
}
/**
 * Exécute les phases séquentiellement
 */
async function executePipelineSequentially(pipeline, workflow, phaseConfigs, projectPath, args) {
    const results = {};
    const phaseOutputs = new Map();
    for (const phaseId of workflow.phases) {
        const phase = pipeline.phases.find(p => p.id === phaseId);
        const config = phaseConfigs[phaseId];
        logger.info("rag.activated.refactored.phase.start", `Début de la phase: ${phase.name}`, {
            phase_id: phase.id,
            tool: phase.tool
        });
        try {
            // Vérifier que l'outil existe
            if (!toolRegistry.hasTool(phase.tool)) {
                throw new Error(`Outil '${phase.tool}' non disponible`);
            }
            // Préparer les arguments avec les outputs des phases précédentes
            const toolArgs = { ...config };
            // Ajouter les outputs des phases précédentes si disponibles
            for (const input of phase.inputs || []) {
                for (const [prevPhaseId, outputs] of phaseOutputs.entries()) {
                    if (outputs && outputs[input] !== undefined) {
                        toolArgs[input] = outputs[input];
                        break;
                    }
                }
            }
            // Exécuter l'outil
            const startPhaseTime = Date.now();
            const toolResult = await toolRegistry.execute(phase.tool, toolArgs);
            const endPhaseTime = Date.now();
            const phaseDuration = ((endPhaseTime - startPhaseTime) / 1000).toFixed(2);
            // Extraire le résultat
            const resultContent = toolResult.content[0].text;
            const result = JSON.parse(resultContent);
            // Stocker les résultats
            results[phaseId] = {
                success: result.success !== false,
                duration: parseFloat(phaseDuration),
                result: result,
                timestamp: new Date().toISOString()
            };
            // Stocker les outputs pour les phases suivantes
            if (phase.outputs && result.outputs) {
                phaseOutputs.set(phaseId, result.outputs);
            }
            else if (result.data) {
                // Fallback: utiliser data comme output
                phaseOutputs.set(phaseId, { data: result.data });
            }
            logger.info("rag.activated.refactored.phase.completed", `Phase terminée: ${phase.name}`, {
                phase_id: phase.id,
                duration: `${phaseDuration}s`,
                success: results[phaseId].success
            });
            // Arrêter en cas d'erreur si demandé
            if (!results[phaseId].success && args.stop_on_error !== false) {
                throw new Error(`Phase '${phase.name}' a échoué: ${result.message || 'Erreur inconnue'}`);
            }
        }
        catch (error) {
            logger.error("rag.activated.refactored.phase.error", `Erreur dans la phase: ${phase.name}`, {
                phase_id: phase.id,
                error: error.message
            });
            results[phaseId] = {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
            if (args.stop_on_error !== false) {
                throw error;
            }
        }
    }
    return results;
}
/**
 * Génère un résumé d'exécution
 */
function generateExecutionSummary(executionResults, pipeline, workflow, duration, executionId) {
    const phasesExecuted = Object.keys(executionResults).length;
    const phasesFailed = Object.values(executionResults).filter(r => !r.success).length;
    const success = phasesFailed === 0;
    // Calculer les statistiques
    const totalDuration = parseFloat(duration);
    const avgPhaseDuration = phasesExecuted > 0
        ? (totalDuration / phasesExecuted).toFixed(2)
        : "0.00";
    // Préparer les détails par phase
    const phaseDetails = {};
    for (const [phaseId, result] of Object.entries(executionResults)) {
        const phase = pipeline.phases.find(p => p.id === phaseId);
        phaseDetails[phaseId] = {
            name: phase?.name || phaseId,
            tool: phase?.tool || 'unknown',
            success: result.success,
            duration: result.duration || 0,
            timestamp: result.timestamp
        };
    }
    return {
        success: success,
        execution_id: executionId,
        duration_seconds: totalDuration,
        summary: {
            workflow_id: workflow.id,
            workflow_name: workflow.name,
            phases_executed: phasesExecuted,
            phases_failed: phasesFailed,
            phases_total: workflow.phases.length,
            success_rate: phasesExecuted > 0 ? ((phasesExecuted - phasesFailed) / phasesExecuted * 100).toFixed(1) + '%' : '0%',
            avg_phase_duration_seconds: parseFloat(avgPhaseDuration)
        },
        phases: phaseDetails,
        pipeline: {
            name: pipeline.name,
            version: pipeline.version,
            description: pipeline.description
        },
        recommendations: success ? [
            "Pipeline exécuté avec succès",
            "Les données sont maintenant disponibles pour la recherche",
            "Utilisez query_rag pour effectuer des recherches sémantiques"
        ] : [
            "Certaines phases ont échoué",
            "Vérifiez les logs pour plus de détails",
            "Corrigez les erreurs et réexécutez le pipeline"
        ],
        timestamp: new Date().toISOString()
    };
}
