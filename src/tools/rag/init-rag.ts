// src/tools/rag/init-rag.ts
// Module C : Outil MCP init_rag
// Responsabilités : C1 - Validation arguments, C2 - Exécution contrôlée, C3 - Retour MCP normalisé

import { initializeRagInfrastructure, RagInitializationMode } from '../../rag/phase0/rag-initialization.js';
import { isRagInitialized } from '../../rag/phase0/rag-state.js';

/**
 * Schéma d'entrée pour l'outil init_rag
 */
export interface InitRagInput {
    /** Chemin vers le projet à initialiser */
    project_path: string;

    /** Mode d'initialisation (default, memory-only, full) */
    mode?: RagInitializationMode;

    /** Forcer l'initialisation même si déjà initialisé */
    force?: boolean;

    /** Niveau de verbosité */
    verbose?: boolean;
}

/**
 * Schéma de sortie pour l'outil init_rag
 */
export interface InitRagOutput {
    /** Statut de l'opération */
    status: 'success' | 'already_initialized' | 'error';

    /** Message détaillé */
    message: string;

    /** Données de résultat */
    data?: {
        /** Chemin du projet */
        project_path: string;

        /** Mode utilisé */
        mode: RagInitializationMode;

        /** Hash du projet */
        project_id: string;

        /** Date d'initialisation */
        initialized_at: string;

        /** Détails des étapes */
        steps: {
            A1: boolean;
            A2: boolean;
            A3: boolean;
            A4: boolean;
            A5: boolean;
            A6: boolean;
            A7: boolean;
            A8: boolean;
        };

        /** Erreurs (si any) */
        errors?: string[];

        /** Avertissements */
        warnings?: string[];
    };

    /** Métadonnées */
    metadata: {
        /** Version de l'outil */
        tool_version: string;

        /** Timestamp */
        timestamp: string;

        /** Durée d'exécution (ms) */
        execution_time_ms: number;
    };
}

/**
 * C1 - Validation des arguments
 * 
 * @param input Arguments d'entrée
 * @returns { valid: boolean, errors: string[], normalizedInput: InitRagInput }
 */
function validateInitRagInput(input: any): {
    valid: boolean;
    errors: string[];
    normalizedInput: InitRagInput
} {
    const errors: string[] = [];
    const normalizedInput: InitRagInput = {
        project_path: '',
        mode: 'default',
        force: false,
        verbose: false
    };

    // Vérifier que project_path est fourni
    if (!input.project_path) {
        errors.push('Le paramètre "project_path" est requis');
    } else if (typeof input.project_path !== 'string') {
        errors.push('Le paramètre "project_path" doit être une chaîne de caractères');
    } else {
        normalizedInput.project_path = input.project_path.trim();
    }

    // Vérifier le mode
    if (input.mode) {
        const validModes: RagInitializationMode[] = ['default', 'memory-only', 'full'];
        if (!validModes.includes(input.mode)) {
            errors.push(`Le mode "${input.mode}" est invalide. Valeurs acceptées: ${validModes.join(', ')}`);
        } else {
            normalizedInput.mode = input.mode;
        }
    }

    // Vérifier force
    if (input.force !== undefined) {
        if (typeof input.force !== 'boolean') {
            errors.push('Le paramètre "force" doit être un booléen');
        } else {
            normalizedInput.force = input.force;
        }
    }

    // Vérifier verbose
    if (input.verbose !== undefined) {
        if (typeof input.verbose !== 'boolean') {
            errors.push('Le paramètre "verbose" doit être un booléen');
        } else {
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
async function executeInitRag(input: InitRagInput): Promise<InitRagOutput> {
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
        const output: InitRagOutput = {
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

    } catch (error) {
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
 * C3 - Outil MCP init_rag
 * 
 * @param args Arguments de l'outil MCP
 * @returns Réponse MCP normalisée
 */
export async function initRagTool(args: any): Promise<InitRagOutput> {
    console.log('[init_rag] Début de l\'initialisation RAG');

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

    console.log(`[init_rag] Validation OK: ${JSON.stringify(validation.normalizedInput)}`);

    // Exécution
    const result = await executeInitRag(validation.normalizedInput);

    // Log du résultat
    console.log(`[init_rag] Résultat: ${result.status} - ${result.message}`);

    if (result.status === 'error' && result.data?.errors) {
        console.error(`[init_rag] Erreurs: ${result.data.errors.join(', ')}`);
    }

    if (result.data?.warnings && result.data.warnings.length > 0) {
        console.warn(`[init_rag] Avertissements: ${result.data.warnings.join(', ')}`);
    }

    return result;
}

/**
 * Enregistrement de l'outil dans le registry MCP
 */
export function registerInitRagTool(registry: any): void {
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
        execute: initRagTool
    });

    console.log('[init_rag] Outil enregistré dans le registry MCP');
}

// Test si exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🧪 Test de init-rag.ts...');

    async function runTest() {
        try {
            // Test de validation
            console.log('Test de validation:');

            const testInput = {
                project_path: process.cwd(),
                mode: 'default',
                force: false,
                verbose: true
            };

            const validation = validateInitRagInput(testInput);
            console.log(`Validation: ${validation.valid ? 'OK' : 'Échec'}`);
            if (!validation.valid) {
                console.log(`Erreurs: ${validation.errors.join(', ')}`);
            }

            // Test d'exécution (simulé)
            console.log('\nTest d\'exécution simulé:');

            const result = await initRagTool(testInput);
            console.log(`Résultat: ${result.status}`);
            console.log(`Message: ${result.message}`);

            if (result.data) {
                console.log(`Projet: ${result.data.project_path}`);
                console.log(`Mode: ${result.data.mode}`);
                console.log(`ID: ${result.data.project_id}`);
            }

            console.log('✅ Tests init-rag.ts terminés');

        } catch (error) {
            console.error('❌ Erreur lors des tests:', error);
            process.exit(1);
        }
    }

    runTest().catch(console.error);
}
