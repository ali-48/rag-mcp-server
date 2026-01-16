// src/tools/rag/init-rag.ts
// Module C : Outil MCP init_rag
// Responsabilités : C1 - Validation arguments, C2 - Exécution contrôlée, C3 - Retour MCP normalisé
import { initializeRagInfrastructure } from '../../rag/phase0/rag-initialization.js';
import { isRagInitialized } from '../../rag/phase0/rag-state.js';
import { formatErrorResponse, formatSuccessResponse } from '../../rag/response-formatter.js';
import { StateManager } from '../../rag/state-manager.js';
/**
 * C1 - Validation des arguments
 *
 * @param input Arguments d'entrée
 * @returns { valid: boolean, errors: string[], normalizedInput: InitRagInput }
 */
function validateInitRagInput(input) {
    const errors = [];
    const normalizedInput = {
        project_path: '',
        mode: 'default',
        force: false,
        verbose: false
    };
    // Vérifier que project_path est fourni
    if (!input.project_path) {
        errors.push('Le paramètre "project_path" est requis');
    }
    else if (typeof input.project_path !== 'string') {
        errors.push('Le paramètre "project_path" doit être une chaîne de caractères');
    }
    else {
        normalizedInput.project_path = input.project_path.trim();
    }
    // Vérifier le mode
    if (input.mode) {
        const validModes = ['default', 'memory-only', 'full'];
        if (!validModes.includes(input.mode)) {
            errors.push(`Le mode "${input.mode}" est invalide. Valeurs acceptées: ${validModes.join(', ')}`);
        }
        else {
            normalizedInput.mode = input.mode;
        }
    }
    // Vérifier force
    if (input.force !== undefined) {
        if (typeof input.force !== 'boolean') {
            errors.push('Le paramètre "force" doit être un booléen');
        }
        else {
            normalizedInput.force = input.force;
        }
    }
    // Vérifier verbose
    if (input.verbose !== undefined) {
        if (typeof input.verbose !== 'boolean') {
            errors.push('Le paramètre "verbose" doit être un booléen');
        }
        else {
            normalizedInput.verbose = input.verbose;
        }
    }
    return {
        valid: errors.length === 0,
        errors,
        normalizedInput
    };
}
/**
 * C2 - Exécution contrôlée
 *
 * @param input Arguments validés
 * @returns Résultat de l'initialisation
 */
async function executeInitRag(input) {
    const startTime = Date.now();
    try {
        // Vérifier la non-réentrance (Règle #15)
        const stateManager = StateManager.getInstance();
        const isCommandExecuted = await stateManager.isCommandExecuted('init_rag');
        if (isCommandExecuted && !input.force) {
            return formatErrorResponse('COMMAND_ALREADY_EXECUTED', 'init_rag a déjà été exécuté. Utilisez force=true pour forcer une ré-exécution.', {
                requiredAction: 'use_force_true',
                notesForAI: [
                    'La commande init_rag a déjà été exécutée',
                    'Utilisez force=true pour forcer une ré-exécution',
                    'Cela réinitialisera l\'infrastructure RAG'
                ],
                allowedActions: ['init_rag'],
                nextSteps: [
                    'Ajoutez force=true à votre requête',
                    'Ou utilisez get_status pour vérifier l\'état actuel'
                ]
            });
        }
        // Vérifier si le projet est déjà initialisé
        const alreadyInitialized = await isRagInitialized(input.project_path);
        if (alreadyInitialized && !input.force) {
            return formatErrorResponse('ALREADY_INITIALIZED', 'Le projet est déjà initialisé pour RAG. Utilisez force=true pour réinitialiser.', {
                requiredAction: 'use_force_true',
                notesForAI: [
                    'Le projet est déjà initialisé pour RAG',
                    'Utilisez force=true pour réinitialiser',
                    'La réinitialisation effacera les configurations existantes'
                ],
                allowedActions: ['init_rag', 'get_status'],
                nextSteps: [
                    'Ajoutez force=true à votre requête',
                    'Ou utilisez get_status pour vérifier l\'état du projet'
                ]
            });
        }
        // Exécuter l'initialisation
        const result = await initializeRagInfrastructure(input.project_path, input.mode);
        // Marquer la commande comme exécutée si succès (Règle #15)
        if (result.status === 'initialized') {
            await stateManager.markCommandExecuted('init_rag');
        }
        // Formater la réponse
        if (result.status === 'initialized') {
            const notesForAI = [
                'Infrastructure RAG initialisée avec succès',
                `Projet: ${result.projectPath}`,
                `Mode: ${result.mode}`,
                `ID: ${result.projectId}`,
                'Actions disponibles: scan_rag, prepare_rag, embed_rag, index_rag, query_rag'
            ];
            if (input.verbose) {
                notesForAI.push(`Dossiers créés: ${result.details.stepA2.directoriesCreated.length}`, `Fichier .ragignore créé: ${result.details.stepA3.fileCreated}`, `Config RAG: ${result.details.stepA4.configPath}`, `Config DB: ${result.details.stepA5.configPath}`, `Base SQLite: ${result.details.stepA6.dbPath}`);
            }
            return formatSuccessResponse('Infrastructure RAG initialisée avec succès', {
                project_path: result.projectPath,
                mode: result.mode,
                project_id: result.projectId,
                initialized_at: result.initializedAt,
                steps: {
                    A1: result.details.stepA1.success,
                    A2: result.details.stepA2.success,
                    A3: result.details.stepA3.success,
                    A4: result.details.stepA4.success,
                    A5: result.details.stepA5.success,
                    A6: result.details.stepA6.success,
                    A7: result.details.stepA7.success,
                    A8: result.details.stepA8.success
                },
                errors: result.errors,
                warnings: result.warnings
            }, {
                nextSteps: [
                    'Utilisez scan_rag pour analyser les fichiers du projet',
                    'Utilisez prepare_rag pour préparer les fichiers à l\'indexation',
                    'Utilisez embed_rag pour générer les embeddings',
                    'Utilisez index_rag pour indexer dans la base vectorielle',
                    'Utilisez query_rag pour effectuer des recherches'
                ],
                notesForAI
            });
        }
        else {
            return formatErrorResponse('INITIALIZATION_FAILED', `Échec de l'initialisation: ${result.errors?.join(', ')}`, {
                notesForAI: [
                    'Échec de l\'initialisation RAG',
                    `Erreurs: ${result.errors?.join(', ')}`,
                    'Vérifiez les permissions et l\'espace disque'
                ],
                allowedActions: ['init_rag'],
                nextSteps: [
                    'Vérifiez les permissions du répertoire',
                    'Assurez-vous d\'avoir suffisamment d\'espace disque',
                    'Corrigez les erreurs et réessayez'
                ]
            });
        }
    }
    catch (error) {
        // Erreur inattendue
        return formatErrorResponse('UNEXPECTED_ERROR', `Erreur inattendue: ${error.message || error}`, {
            notesForAI: [
                'Erreur inattendue lors de l\'initialisation RAG',
                `Message: ${error.message || error}`,
                'Consultez les logs pour plus de détails'
            ],
            allowedActions: ['init_rag'],
            nextSteps: [
                'Vérifiez les logs pour plus de détails',
                'Assurez-vous que le chemin du projet est valide',
                'Réessayez avec des paramètres différents'
            ]
        });
    }
}
/**
 * Définition de l'outil init_rag
 */
export const initRagTool = {
    name: "init_rag",
    description: "Initialise l'infrastructure RAG pour un projet (8 étapes atomiques)",
    inputSchema: {
        type: "object",
        properties: {
            project_path: {
                type: "string",
                description: "Chemin absolu vers le projet à initialiser"
            },
            mode: {
                type: "string",
                enum: ["default", "memory-only", "full"],
                description: "Mode d'initialisation",
                default: "default"
            },
            force: {
                type: "boolean",
                description: "Forcer l'initialisation même si déjà initialisé",
                default: false
            },
            verbose: {
                type: "boolean",
                description: "Afficher des détails supplémentaires",
                default: false
            }
        },
        required: ["project_path"]
    }
};
/**
 * Handler pour l'outil init_rag avec wrapper MCP robuste
 */
export const initRagHandler = async (args) => {
    const startTime = Date.now();
    try {
        // Validation des arguments
        const validation = validateInitRagInput(args);
        if (!validation.valid) {
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify({
                            status: 'error',
                            tool: 'init_rag',
                            step: 'validation',
                            error: {
                                code: 'INVALID_ARGUMENTS',
                                message: `Arguments invalides: ${validation.errors.join(', ')}`
                            },
                            metadata: {
                                tool_version: '1.0',
                                timestamp: new Date().toISOString(),
                                execution_time_ms: Date.now() - startTime
                            }
                        }, null, 2)
                    }]
            };
        }
        // Exécution
        const result = await executeInitRag(validation.normalizedInput);
        // Retourner le résultat au format MCP
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }]
        };
    }
    catch (error) {
        // Erreur inattendue - wrapper global
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        status: 'error',
                        tool: 'init_rag',
                        step: 'unexpected_error',
                        error: {
                            code: 'UNEXPECTED_ERROR',
                            message: error.message || String(error)
                        },
                        metadata: {
                            tool_version: '1.0',
                            timestamp: new Date().toISOString(),
                            execution_time_ms: Date.now() - startTime
                        }
                    }, null, 2)
                }]
        };
    }
};
/**
 * Fonction originale pour la rétrocompatibilité
 */
export async function initRagToolLegacy(args) {
    // Validation des arguments
    const validation = validateInitRagInput(args);
    if (!validation.valid) {
        return {
            status: 'error',
            message: `Arguments invalides: ${validation.errors.join(', ')}`,
            metadata: {
                tool_version: '1.0',
                timestamp: new Date().toISOString(),
                execution_time_ms: 0
            }
        };
    }
    // Exécution
    const result = await executeInitRag(validation.normalizedInput);
    return result;
}
/**
 * Enregistrement de l'outil dans le registry MCP (pour compatibilité)
 */
export function registerInitRagTool(registry) {
    registry.registerTool({
        name: 'init_rag',
        description: 'Initialise l\'infrastructure RAG pour un projet (8 étapes atomiques)',
        inputSchema: {
            type: 'object',
            properties: {
                project_path: {
                    type: 'string',
                    description: 'Chemin absolu vers le projet à initialiser'
                },
                mode: {
                    type: 'string',
                    enum: ['default', 'memory-only', 'full'],
                    description: 'Mode d\'initialisation',
                    default: 'default'
                },
                force: {
                    type: 'boolean',
                    description: 'Forcer l\'initialisation même si déjà initialisé',
                    default: false
                },
                verbose: {
                    type: 'boolean',
                    description: 'Afficher des détails supplémentaires',
                    default: false
                }
            },
            required: ['project_path']
        },
        execute: initRagToolLegacy
    });
}
//# sourceMappingURL=init-rag.js.map