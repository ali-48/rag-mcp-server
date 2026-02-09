// src/tools/rag/index-decision.ts
// Outil MCP pour indexer les décisions du Task Manager dans le RAG
// Version: v1.0.0
// Responsabilités: Indexer les décisions de tâches dans le vector store RAG
import { logger } from "../../core/logger.js";
/**
 * Gestionnaire de décisions pour le RAG - Version réelle avec vector store
 */
class RealDecisionIndexer {
    decisions = new Map();
    chunks = new Map();
    projectPath = process.cwd();
    /**
     * Indexe une décision dans le RAG
     */
    async indexDecision(decision) {
        const startTime = Date.now();
        const decisionId = `decision-${decision.task_id}-${Date.now()}`;
        try {
            logger.info('decision.index.start', 'Début de l\'indexation de décision', {
                decisionId,
                taskId: decision.task_id,
                decisionType: decision.decision_type
            });
            // 1. Stocker la décision
            this.decisions.set(decisionId, decision);
            // 2. Créer des chunks à partir de la décision
            const chunks = this.createChunksFromDecision(decision, decisionId);
            this.chunks.set(decisionId, chunks);
            // 3. Indexer chaque chunk dans le vector store
            const indexedCount = await this.indexChunksInVectorStore(chunks);
            const endTime = Date.now();
            const duration = endTime - startTime;
            logger.info('decision.index.success', 'Décision indexée avec succès', {
                decisionId,
                taskId: decision.task_id,
                chunksCreated: chunks.length,
                indexedCount,
                duration_ms: duration
            });
            return {
                success: true,
                decision_id: decisionId,
                chunks_created: chunks.length,
                indexed_at: new Date().toISOString()
            };
        }
        catch (error) {
            logger.error('decision.index.error', 'Erreur lors de l\'indexation de décision', {
                decisionId,
                taskId: decision.task_id,
                error: error.message,
                stack: error.stack
            });
            return {
                success: false,
                decision_id: decisionId,
                chunks_created: 0,
                indexed_at: new Date().toISOString()
            };
        }
    }
    /**
     * Crée des chunks à partir d'une décision
     */
    createChunksFromDecision(decision, decisionId) {
        const chunks = [];
        // Chunk 1: Métadonnées de la décision
        const metadataChunk = {
            id: `${decisionId}-metadata`,
            task_id: decision.task_id,
            decision_type: decision.decision_type,
            content: this.createMetadataContent(decision),
            metadata: {
                chunk_type: 'metadata',
                decision_type: decision.decision_type,
                decision_by: decision.decision_by,
                task_id: decision.task_id,
                timestamp: decision.decision_timestamp,
                source: 'task_decision',
                content_type: 'decision_metadata'
            },
            created_at: new Date().toISOString()
        };
        chunks.push(metadataChunk);
        // Chunk 2: Contenu de la décision
        const contentChunk = {
            id: `${decisionId}-content`,
            task_id: decision.task_id,
            decision_type: decision.decision_type,
            content: this.createContentContent(decision),
            metadata: {
                chunk_type: 'content',
                decision_type: decision.decision_type,
                has_title: !!decision.decision_data.title,
                has_description: !!decision.decision_data.description,
                has_result: !!decision.decision_data.result,
                has_error: !!decision.decision_data.error,
                source: 'task_decision',
                content_type: 'decision_content'
            },
            created_at: new Date().toISOString()
        };
        chunks.push(contentChunk);
        // Chunk 3: Contexte de la décision (si disponible)
        if (decision.context) {
            const contextChunk = {
                id: `${decisionId}-context`,
                task_id: decision.task_id,
                decision_type: decision.decision_type,
                content: this.createContextContent(decision),
                metadata: {
                    chunk_type: 'context',
                    has_project: !!decision.context.project_path,
                    has_git: !!(decision.context.git_branch || decision.context.git_commit),
                    has_vscode: !!decision.context.vscode_context,
                    source: 'task_decision',
                    content_type: 'decision_context'
                },
                created_at: new Date().
                /**
                 * Définition de l'outil index_decision
                 */
                ,
                /**
                 * Définition de l'outil index_decision
                 */
                const: indexDecisionTool, ToolDefinition = {
                    name: "index_decision",
                    description: "Indexe une décision de Task Manager dans le RAG pour recherche sémantique future",
                    inputSchema: {
                        type: "object",
                        properties: {
                            task_id: {
                                type: "string",
                                description: "ID de la tâche concernée par la décision",
                                minLength: 1
                            },
                            decision_type: {
                                type: "string",
                                description: "Type de décision",
                                enum: ["created", "completed", "failed", "cancelled", "approved", "rejected"],
                                default: "completed"
                            },
                            decision_by: {
                                type: "string",
                                description: "Qui a pris la décision",
                                enum: ["task_manager", "user", "ai", "system"],
                                default: "task_manager"
                            },
                            title: {
                                type: "string",
                                description: "Titre de la tâche (optionnel)"
                            },
                            description: {
                                type: "string",
                                description: "Description de la tâche (optionnel)"
                            },
                            result: {
                                type: "object",
                                description: "Résultat de la tâche (optionnel)"
                            },
                            error: {
                                type: "string",
                                description: "Erreur si la tâche a échoué (optionnel)"
                            },
                            metadata: {
                                type: "object",
                                description: "Métadonnées supplémentaires (optionnel)"
                            },
                            duration_ms: {
                                type: "number",
                                description: "Durée d'exécution en millisecondes (optionnel)"
                            },
                            project_path: {
                                type: "string",
                                description: "Chemin du projet (optionnel)"
                            },
                            workspace: {
                                type: "string",
                                description: "Workspace VS Code (optionnel)"
                            },
                            git_branch: {
                                type: "string",
                                description: "Branche Git (optionnel)"
                            },
                            git_commit: {
                                type: "string",
                                description: "Commit Git (optionnel)"
                            },
                            vscode_context: {
                                type: "object",
                                description: "Contexte VS Code (optionnel)"
                            }
                        },
                        required: ["task_id"]
                    },
                },
                /**
                 * Handler pour l'outil index_decision
                 */
                const: indexDecisionHandler, ToolHandler = async (args) => {
                    const startTime = Date.now();
                    try {
                        logger.info('decision.index.request', 'Demande d\'indexation de décision', {
                            taskId: args.task_id,
                            decisionType: args.decision_type
                        });
                        // Construire l'objet décision
                        const decision = {
                            task_id: args.task_id,
                            decision_type: args.decision_type || 'completed',
                            decision_by: args.decision_by || 'task_manager',
                            decision_timestamp: new Date().toISOString(),
                            decision_data: {
                                title: args.title,
                                description: args.description,
                                result: args.result,
                                error: args.error,
                                metadata: args.metadata,
                                duration_ms: args.duration_ms
                            },
                            context: {
                                project_path: args.project_path,
                                workspace: args.workspace,
                                git_branch: args.git_branch,
                                git_commit: args.git_commit,
                                vscode_context: args.vscode_context
                            }
                        };
                        // Indexer la décision
                        const result = await decisionIndexer.indexDecision(decision);
                        const endTime = Date.now();
                        const duration = endTime - startTime;
                        const response = {
                            success: result.success,
                            decision: {
                                task_id: decision.task_id,
                                decision_type: decision.decision_type,
                                decision_by: decision.decision_by,
                                decision_timestamp: decision.decision_timestamp
                            },
                            indexing_result: result,
                            stats: decisionIndexer.getStats(),
                            timestamp: new Date().toISOString(),
                            duration_ms: duration,
                            notes_for_ai: [
                                "Décision indexée dans le RAG",
                                `ID de tâche: ${decision.task_id}`,
                                `Type de décision: ${decision.decision_type}`,
                                `Prise par: ${decision.decision_by}`,
                                `Chunks créés: ${result.chunks_created}`,
                                "La décision est maintenant disponible pour recherche sémantique"
                            ]
                        };
                        logger.info('decision.index.response', 'Réponse d\'indexation de décision', {
                            taskId: args.task_id,
                            success: result.success,
                            chunksCreated: result.chunks_created,
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
                        logger.error('decision.index.error', 'Erreur lors de l\'indexation de décision', {
                            taskId: args.task_id,
                            error: error.message,
                            stack: error.stack,
                            duration_ms: duration
                        });
                        return {
                            content: [{
                                    type: "text",
                                    text: JSON.stringify({
                                        success: false,
                                        error: "INDEX_DECISION_ERROR",
                                        message: error.message,
                                        duration_ms: duration,
                                        timestamp: new Date().toISOString(),
                                        notes_for_ai: [
                                            "Erreur lors de l'indexation de la décision",
                                            `ID de tâche: ${args.task_id}`,
                                            "Vérifier les paramètres d'entrée",
                                            "Consulter les logs pour plus de détails"
                                        ]
                                    }, null, 2)
                                }]
                        };
                    }
                },
                /**
                 * Parse les données brutes d'une décision de tâche
                 */
                function: parseTaskDecision(rawData, any)
            }, { task_id: string };
            metadata: Record;
            decision: {
                type: string;
                by: string;
                timestamp: string;
                data: Record;
            }
            ;
            context ?  : Record;
        }
        {
            try {
                logger.debug('decision.parser.start', 'Début du parsing des données de décision', {
                    rawDataType: typeof rawData,
                    hasTaskId: !!rawData?.task_id
                });
                // Extraire le task_id (priorité: task_id, id, taskId)
                const taskId = rawData.task_id || rawData.id || rawData.taskId;
                if (!taskId) {
                    throw new Error('task_id manquant dans les données de décision');
                }
                // Extraire les métadonnées
                const metadata = {
                    source: rawData.source || 'task_manager',
                    received_at: new Date().toISOString(),
                    raw_data_type: typeof rawData,
                    data_structure: Object.keys(rawData)
                };
                // Ajouter les métadonnées spécifiques si présentes
                if (rawData.metadata) {
                    Object.assign(metadata, rawData.metadata);
                }
                // Extraire la décision
                const decisionData = {
                    title: rawData.title,
                    description: rawData.description,
                    result: rawData.result,
                    error: rawData.error,
                    metadata: rawData.decision_metadata || rawData.decision_data,
                    duration_ms: rawData.duration_ms || rawData.duration
                };
                // Nettoyer les données de décision (supprimer les valeurs undefined)
                Object.keys(decisionData).forEach(key => {
                    if (decisionData[key] === undefined) {
                        delete decisionData[key];
                    }
                });
                const decision = {
                    type: rawData.decision_type || rawData.type || rawData.decision || 'unknown',
                    by: rawData.decision_by || rawData.by || rawData.author || 'system',
                    timestamp: rawData.decision_timestamp || rawData.timestamp || rawData.created_at || new Date().toISOString(),
                    data: decisionData
                };
                // Extraire le contexte
                const context = rawData.context || rawData.environment || rawData.workspace;
                let parsedContext;
                if (context) {
                    parsedContext = {
                        project_path: context.project_path || context.projectPath || context.project,
                        workspace: context.workspace || context.workspace_name,
                        git_branch: context.git_branch || context.branch,
                        git_commit: context.git_commit || context.commit,
                        vscode_context: context.vscode_context || context.vscode,
                        environment: context.environment || 'development'
                    };
                    // Nettoyer le contexte (supprimer les valeurs undefined)
                    Object.keys(parsedContext).forEach(key => {
                        if (parsedContext[key] === undefined) {
                            delete parsedContext[key];
                        }
                    });
                    // Si le contexte est vide après nettoyage, le définir comme undefined
                    if (Object.keys(parsedContext).length === 0) {
                        parsedContext = undefined;
                    }
                }
                const parsedResult = {
                    task_id: taskId,
                    metadata,
                    decision,
                    context: parsedContext
                };
                logger.info('decision.parser.success', 'Données de décision parsées avec succès', {
                    taskId,
                    decisionType: decision.type,
                    hasContext: !!parsedContext,
                    metadataKeys: Object.keys(metadata).length
                });
                return parsedResult;
            }
            catch (error) {
                logger.error('decision.parser.error', 'Erreur lors du parsing des données de décision', {
                    error: error.message,
                    stack: error.stack,
                    rawData: JSON.stringify(rawData, null, 2).substring(0, 500) // Limiter la taille du log
                });
                throw new Error(`Erreur de parsing TaskDecision: ${error.message}`);
            }
        }
        /**
         * Valide les données parsées d'une décision
         */
        export function validateParsedDecision(parsedData) {
            const errors = [];
            const warnings = [];
            // Validation du task_id
            if (!parsedData.task_id || typeof parsedData.task_id !== 'string') {
                errors.push('task_id manquant ou invalide');
            }
            // Validation des métadonnées
            if (!parsedData.metadata || typeof parsedData.metadata !== 'object') {
                warnings.push('metadata manquant ou invalide');
            }
            // Validation de la décision
            if (!parsedData.decision) {
                errors.push('decision manquant');
            }
            else {
                if (!parsedData.decision.type || typeof parsedData.decision.type !== 'string') {
                    warnings.push('decision.type manquant ou invalide');
                }
                if (!parsedData.decision.by || typeof parsedData.decision.by !== 'string') {
                    warnings.push('decision.by manquant ou invalide');
                }
                if (!parsedData.decision.timestamp || typeof parsedData.decision.timestamp !== 'string') {
                    warnings.push('decision.timestamp manquant ou invalide');
                }
            }
            // Validation du contexte (optionnel)
            if (parsedData.context && typeof parsedData.context !== 'object') {
                warnings.push('context présent mais invalide');
            }
            const valid = errors.length === 0;
            if (!valid) {
                logger.warn('decision.validator.invalid', 'Données de décision invalides', {
                    errors,
                    warnings,
                    taskId: parsedData.task_id
                });
            }
            else if (warnings.length > 0) {
                logger.info('decision.validator.warnings', 'Données de décision avec avertissements', {
                    warnings,
                    taskId: parsedData.task_id
                });
            }
            else {
                logger.debug('decision.validator.valid', 'Données de décision valides', {
                    taskId: parsedData.task_id
                });
            }
            return {
                valid,
                errors,
                warnings
            };
        }
        /**
         * Convertit les données parsées en TaskDecision pour l'indexation
         */
        export function convertToTaskDecision(parsedData) {
            const validation = validateParsedDecision(parsedData);
            if (!validation.valid) {
                throw new Error(`Données de décision invalides: ${validation.errors.join(', ')}`);
            }
            const taskDecision = {
                task_id: parsedData.task_id,
                decision_type: parsedData.decision.type,
                decision_by: parsedData.decision.by,
                decision_timestamp: parsedData.decision.timestamp,
                decision_data: {
                    title: parsedData.decision.data?.title,
                    description: parsedData.decision.data?.description,
                    result: parsedData.decision.data?.result,
                    error: parsedData.decision.data?.error,
                    metadata: parsedData.decision.data?.metadata,
                    duration_ms: parsedData.decision.data?.duration_ms
                }
            };
            // Ajouter le contexte si présent
            if (parsedData.context) {
                taskDecision.context = {
                    project_path: parsedData.context.project_path,
                    workspace: parsedData.context.workspace,
                    git_branch: parsedData.context.git_branch,
                    git_commit: parsedData.context.git_commit,
                    vscode_context: parsedData.context.vscode_context
                };
            }
            // Nettoyer les données (supprimer les valeurs undefined)
            Object.keys(taskDecision.decision_data).forEach(key => {
                if (taskDecision.decision_data[key] === undefined) {
                    delete taskDecision.decision_data[key];
                }
            });
            if (taskDecision.context) {
                Object.keys(taskDecision.context).forEach(key => {
                    if (taskDecision.context[key] === undefined) {
                        delete taskDecision.context[key];
                    }
                });
                // Si le contexte est vide après nettoyage, le définir comme undefined
                if (Object.keys(taskDecision.context).length === 0) {
                    delete taskDecision.context;
                }
            }
            logger.info('decision.converter.success', 'Données converties en TaskDecision', {
                taskId: taskDecision.task_id,
                decisionType: taskDecision.decision_type,
                hasContext: !!taskDecision.context
            });
            return taskDecision;
        }
        /**
         * Teste l'indexeur de décisions
         */
        export async function testDecisionIndexer() {
            try {
                const testTaskId = `test-decision-${Date.now()}`;
                logger.info('decision.index.test.start', 'Début du test de l\'indexeur de décisions', {
                    testTaskId
                });
                // Créer une décision de test
                const testDecision = {
                    task_id: testTaskId,
                    decision_type: 'completed',
                    decision_by: 'task_manager',
                    decision_timestamp: new Date().toISOString(),
                    decision_data: {
                        title: 'Test Task Decision',
                        description: 'Ceci est une décision de test pour valider l\'indexeur',
                        result: { success: true, message: 'Test réussi' },
                        duration_ms: 1500
                    },
                    context: {
                        project_path: '/test/project',
                        workspace: 'test-workspace',
                        git_branch: 'main',
                        git_commit: 'abc123'
                    }
                };
                // Indexer la décision
                const result = await decisionIndexer.indexDecision(testDecision);
                if (!result.success) {
                    throw new Error('L\'indexation de la décision de test a échoué');
                }
                // Vérifier que la décision a été stockée
                const retrievedDecision = decisionIndexer.getDecision(result.decision_id);
                if (!retrievedDecision) {
                    throw new Error('La décision indexée n\'a pas été retrouvée');
                }
                // Vérifier que des chunks ont été créés
                const chunks = decisionIndexer.getDecisionChunks(result.decision_id);
                if (chunks.length === 0) {
                    throw new Error('Aucun chunk n\'a été créé pour la décision');
                }
                // Vérifier la recherche sémantique (simulée)
                const similarDecisions = await decisionIndexer.searchSimilarDecisions('test decision', 5);
                if (!Array.isArray(similarDecisions)) {
                    throw new Error('La recherche sémantique n\'a pas retourné un tableau');
                }
                // Vérifier les statistiques
                const stats = decisionIndexer.getStats();
                if (stats.total_decisions < 1) {
                    throw new Error('Les statistiques ne reflètent pas la décision indexée');
                }
                logger.info('decision.index.test.success', 'Test de l\'indexeur de décisions réussi', {
                    testTaskId,
                    decisionId: result.decision_id,
                    chunksCreated: chunks.length,
                    totalDecisions: stats.total_decisions
                });
                return true;
            }
            catch (error) {
                logger.error('decision.index.test.failed', 'Test de l\'indexeur de décisions échoué', {
                    error: error.message,
                    stack: error.stack
                });
                return false;
            }
        }
        // Exécution automatique si ce fichier est exécuté directement
        if (typeof require !== 'undefined' && require.main === module) {
            testDecisionIndexer().then(success => {
                if (success) {
                    logger.info('decision.index.test.cli', 'Indexeur de décisions testé avec succès', {
                        success: true,
                        message: 'Indexeur de décisions testé avec succès'
                    });
                    process.exit(0);
                }
                else {
                    logger.error('decision.index.test.cli', 'Échec du test de l\'indexeur de décisions', {
                        success: false,
                        message: 'Échec du test de l\'indexeur de décisions'
                    });
                    process.exit(1);
                }
            });
        }
    }
}
//# sourceMappingURL=index-decision.js.map