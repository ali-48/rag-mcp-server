// src/rag/phase0/rag-state.ts
// Module B : Vérification de l'état RAG (lecture seule)
// Responsabilités : B1 - Vérification minimale, B2 - État détaillé

import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * État du RAG pour un projet
 */
export interface RagState {
    /** Le projet est-il initialisé pour RAG ? */
    initialized: boolean;

    /** Mode d'initialisation (default, memory-only, full) */
    mode?: string;

    /** Chemin vers la racine du projet */
    projectPath: string;

    /** Chemin vers le dossier /rag/ */
    ragPath?: string;

    /** Statut de la base de données mémoire */
    memoryDbStatus?: 'ok' | 'missing' | 'error';

    /** Statut de la base de données vectorielle */
    vectorDbStatus?: 'ok' | 'missing' | 'not_configured' | 'error';

    /** Version de la configuration */
    configVersion?: string;

    /** Date d'initialisation */
    initializedAt?: string;

    /** Hash du projet */
    projectId?: string;

    /** Erreurs détectées */
    errors?: string[];

    /** Avertissements */
    warnings?: string[];
}

/**
 * Configuration RAG d'un projet
 */
interface RagConfig {
    rag_initialized?: boolean;
    initialized_by?: string;
    initialized_at?: string;
    project_id?: string;
    rag_version?: string;
    mode?: string;
    infrastructure?: {
        memory_db?: string;
        vector_db?: string;
        config_version?: string;
    };
}

/**
 * B1 - Vérification minimale
 * Vérifie si un projet est initialisé pour RAG
 * 
 * @param projectPath Chemin vers le projet
 * @returns true si le projet est RAG-initialized
 */
export async function isRagInitialized(projectPath: string): Promise<boolean> {
    try {
        const configPath = path.join(projectPath, 'rag', 'config', 'rag.config.json');

        // Vérifier l'existence du fichier de configuration
        try {
            await fs.access(configPath);
        } catch {
            return false; // Fichier non trouvé
        }

        // Lire et parser la configuration
        const configContent = await fs.readFile(configPath, 'utf-8');
        const config: RagConfig = JSON.parse(configContent);

        // Vérifier le flag rag_initialized
        return config.rag_initialized === true;
    } catch (error) {
        // En cas d'erreur de lecture/parsing, considérer comme non initialisé
        console.error(`Erreur lors de la vérification RAG pour ${projectPath}:`, error);
        return false;
    }
}

/**
 * B2 - État détaillé (pour agents)
 * Retourne l'état complet du RAG pour un projet
 * 
 * @param projectPath Chemin vers le projet
 * @returns État détaillé du RAG
 */
export async function getRagState(projectPath: string): Promise<RagState> {
    const state: RagState = {
        initialized: false,
        projectPath,
        errors: [],
        warnings: []
    };

    try {
        // Normaliser le chemin
        const normalizedPath = path.resolve(projectPath);
        state.projectPath = normalizedPath;

        // Chemin vers /rag/
        const ragPath = path.join(normalizedPath, 'rag');
        state.ragPath = ragPath;

        // Chemin vers la configuration
        const configPath = path.join(ragPath, 'config', 'rag.config.json');

        // Vérifier l'existence de la structure de base
        try {
            await fs.access(configPath);
        } catch {
            state.errors?.push(`Configuration RAG non trouvée: ${configPath}`);
            return state;
        }

        // Lire la configuration
        let config: RagConfig = {};
        try {
            const configContent = await fs.readFile(configPath, 'utf-8');
            config = JSON.parse(configContent);
        } catch (error) {
            state.errors?.push(`Erreur de lecture/parsing de la configuration: ${error}`);
            return state;
        }

        // Vérifier le flag d'initialisation
        state.initialized = config.rag_initialized === true;

        if (!state.initialized) {
            state.errors?.push('RAG non initialisé (rag_initialized !== true)');
            return state;
        }

        // Récupérer les métadonnées
        state.mode = config.mode;
        state.configVersion = config.rag_version;
        state.initializedAt = config.initialized_at;
        state.projectId = config.project_id;

        // Vérifier la base de données mémoire
        if (config.infrastructure?.memory_db) {
            try {
                const dbPath = config.infrastructure.memory_db.replace('sqlite://', '');
                await fs.access(dbPath);
                state.memoryDbStatus = 'ok';
            } catch {
                state.memoryDbStatus = 'missing';
                state.warnings?.push('Base de données mémoire SQLite non trouvée');
            }
        } else {
            state.memoryDbStatus = 'missing';
            state.warnings?.push('Configuration mémoire DB manquante');
        }

        // Vérifier la base de données vectorielle
        if (config.infrastructure?.vector_db) {
            // Pour l'instant, on marque simplement comme configurée
            // La connexion réelle sera testée dans rag-initialization.ts
            state.vectorDbStatus = 'not_configured';
        } else {
            state.vectorDbStatus = 'not_configured';
            state.warnings?.push('Base de données vectorielle non configurée');
        }

        // Vérifier la structure des dossiers
        const requiredDirs = [
            path.join(ragPath, 'db', 'memory'),
            path.join(ragPath, 'db', 'metadata'),
            path.join(ragPath, 'config')
        ];

        for (const dir of requiredDirs) {
            try {
                await fs.access(dir);
            } catch {
                state.warnings?.push(`Dossier manquant: ${dir}`);
            }
        }

        // Vérifier l'existence de .ragignore
        const ragIgnorePath = path.join(normalizedPath, '.ragignore');
        try {
            await fs.access(ragIgnorePath);
        } catch {
            state.warnings?.push('.ragignore non trouvé');
        }

        return state;

    } catch (error) {
        state.errors?.push(`Erreur inattendue: ${error}`);
        return state;
    }
}

/**
 * Utilitaire : Vérifie si un chemin est un projet valide
 * 
 * @param projectPath Chemin à vérifier
 * @returns true si le chemin existe et est accessible
 */
export async function isValidProjectPath(projectPath: string): Promise<boolean> {
    try {
        const stats = await fs.stat(projectPath);
        return stats.isDirectory();
    } catch {
        return false;
    }
}

/**
 * Utilitaire : Calcule un hash simple pour un projet
 * 
 * @param projectPath Chemin du projet
 * @returns Hash MD5 du chemin normalisé
 */
export function computeProjectId(projectPath: string): string {
    // Pour l'instant, utilisation d'un hash simple basé sur le chemin
    // Pourrait être remplacé par SHA-256 ou autre algorithme plus robuste
    const normalizedPath = path.resolve(projectPath);

    // Hash simple (à améliorer si nécessaire)
    let hash = 0;
    for (let i = 0; i < normalizedPath.length; i++) {
        const char = normalizedPath.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convertir en entier 32-bit
    }

    return Math.abs(hash).toString(16).padStart(8, '0');
}

// Export pour les tests
export type { RagConfig };

// Test si exécuté directement (commenté pour éviter les erreurs de compilation)
// if (import.meta.url === `file://${process.argv[1]}`) {
//     console.log('🧪 Test de rag-state.ts...');
// 
//     async function runTest() {
//         try {
//             // Test avec le répertoire courant
//             const testPath = process.cwd();
// 
//             console.log(`Test avec: ${testPath}`);
// 
//             // Test isValidProjectPath
//             const isValid = await isValidProjectPath(testPath);
//             console.log(`isValidProjectPath: ${isValid}`);
// 
//             // Test computeProjectId
//             const projectId = computeProjectId(testPath);
//             console.log(`Project ID: ${projectId}`);
// 
//             // Test isRagInitialized (devrait être false pour un projet non initialisé)
//             const initialized = await isRagInitialized(testPath);
//             console.log(`isRagInitialized: ${initialized}`);
// 
//             // Test getRagState
//             const state = await getRagState(testPath);
//             console.log('État RAG:', JSON.stringify(state, null, 2));
// 
//             console.log('✅ Tests rag-state.ts terminés');
// 
//         } catch (error) {
//             console.error('❌ Erreur lors des tests:', error);
//             process.exit(1);
//         }
//     }
// 
//     runTest().catch(console.error);
// }
