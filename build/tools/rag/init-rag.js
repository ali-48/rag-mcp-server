// src/tools/rag/init-rag.ts
// Module C : Outil MCP init_rag
// Responsabilités : C1 - Validation arguments, C2 - Exécution contrôlée, C3 - Retour MCP normalisé
import { initializeRagInfrastructure } from '../../rag/phase0/rag-initialization.js';
import { isRagInitialized } from '../../rag/phase0/rag-state.js';
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
        // Vérifier si le projet est déjà initialisé
        const alreadyInitialized = await isRagInitialized(input.project_path);
        if (alreadyInitialized && !input.force) {
            return {
                status: 'already_initialized',
                message: 'Le projet est déjà initialisé pour RAG. Utilisez force=true pour réinitialiser.',
                metadata: {
                    tool_version: '1.0',
                    timestamp: new Date().toISOString(),
                    execution_time_ms: Date.now() - startTime
                }
            };
        }
        // Exécuter l'initialisation
        const result = await initializeRagInfrastructure(input.project_path, input.mode);
        // Formater la réponse
        const output = {
            status: result.status === 'initialized' ? 'success' : 'error',
            message: result.status === 'initialized'
                ? 'Infrastructure RAG initialisée avec succès'
                : `Échec de l'initialisation: ${result.errors?.join(', ')}`,
            data: {
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
            },
            metadata: {
                tool_version: '1.0',
                timestamp: new Date().toISOString(),
                execution_time_ms: Date.now() - startTime
            }
        };
        // Ajouter des détails supplémentaires en mode verbose
        if (input.verbose) {
            output.message += `\n\nDétails:\n` +
                `- Projet: ${result.projectPath}\n` +
                `- Mode: ${result.mode}\n` +
                `- ID: ${result.projectId}\n` +
                `- Dossiers créés: ${result.details.stepA2.directoriesCreated.length}\n` +
                `- Fichier .ragignore créé: ${result.details.stepA3.fileCreated}\n` +
                `- Config RAG: ${result.details.stepA4.configPath}\n` +
                `- Config DB: ${result.details.stepA5.configPath}\n` +
                `- Base SQLite: ${result.details.stepA6.dbPath}`;
        }
        return output;
    }
    catch (error) {
        // Erreur inattendue
        return {
            status: 'error',
            message: `Erreur inattendue: ${error}`,
            metadata: {
                tool_version: '1.0',
                timestamp: new Date().toISOString(),
                execution_time_ms: Date.now() - startTime
            }
        };
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
