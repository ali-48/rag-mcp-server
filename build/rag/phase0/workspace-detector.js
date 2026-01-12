// src/rag/phase0/workspace-detector.ts
// Détection automatique du workspace VS Code / MCP
import { existsSync } from 'fs';
import { join, resolve } from 'path';
/**
 * Détecte le workspace actuel
 *
 * Priorité :
 * 1. Chemin manuel fourni
 * 2. VS Code workspace (variable d'environnement ou socket)
 * 3. Variable d'environnement RAG_WORKSPACE
 * 4. Répertoire courant
 */
export async function detectWorkspace(options = {}) {
    const { manualPath, useVscodeDetection = true, useEnvDetection = true, fallbackToCurrentDir = true } = options;
    let workspacePath = null;
    let detectedBy = 'manual';
    let vscodeWorkspace = false;
    // 1. Chemin manuel (priorité absolue)
    if (manualPath) {
        workspacePath = resolve(manualPath);
        detectedBy = 'manual';
    }
    // 2. Détection VS Code
    else if (useVscodeDetection) {
        const vscodePath = detectVscodeWorkspace();
        if (vscodePath) {
            workspacePath = vscodePath;
            detectedBy = 'vscode';
            vscodeWorkspace = true;
        }
    }
    // 3. Variable d'environnement
    else if (useEnvDetection) {
        const envPath = process.env.RAG_WORKSPACE || process.env.VSCODE_WORKSPACE;
        if (envPath && existsSync(envPath)) {
            workspacePath = resolve(envPath);
            detectedBy = 'env';
        }
    }
    // 4. Fallback au répertoire courant
    else if (fallbackToCurrentDir) {
        workspacePath = process.cwd();
        detectedBy = 'fallback';
    }
    // Validation du chemin
    if (!workspacePath) {
        throw new Error('Impossible de détecter un workspace valide');
    }
    if (!existsSync(workspacePath)) {
        throw new Error(`Le workspace n'existe pas: ${workspacePath}`);
    }
    // Collecter les métadonnées
    const metadata = await collectWorkspaceMetadata(workspacePath, detectedBy);
    // Détecter les fichiers ouverts (simulation pour l'instant)
    const openFiles = vscodeWorkspace ? await detectOpenFiles(workspacePath) : undefined;
    const activeFile = openFiles && openFiles.length > 0 ? openFiles[0] : undefined;
    return {
        path: workspacePath,
        vscodeWorkspace,
        openFiles,
        activeFile,
        language: await detectPrimaryLanguage(workspacePath),
        metadata
    };
}
/**
 * Détecte le workspace VS Code
 */
function detectVscodeWorkspace() {
    // Méthode 1 : Variable d'environnement VS Code
    const vscodeEnv = process.env.VSCODE_WORKSPACE_FOLDERS;
    if (vscodeEnv) {
        try {
            const folders = JSON.parse(vscodeEnv);
            if (Array.isArray(folders) && folders.length > 0) {
                return resolve(folders[0]);
            }
        }
        catch (error) {
            // JSON invalide, continuer
        }
    }
    // Méthode 2 : Fichier .vscode/ dans le répertoire courant
    const currentDir = process.cwd();
    const vscodeDir = join(currentDir, '.vscode');
    if (existsSync(vscodeDir)) {
        return currentDir;
    }
    // Méthode 3 : Remonter les répertoires parents
    let dir = currentDir;
    while (dir !== '/') {
        const testVscodeDir = join(dir, '.vscode');
        if (existsSync(testVscodeDir)) {
            return dir;
        }
        dir = join(dir, '..');
    }
    return null;
}
/**
 * Collecte les métadonnées du workspace
 */
async function collectWorkspaceMetadata(workspacePath, detectedBy) {
    const fs = await import('fs');
    const path = await import('path');
    // Vérifier si c'est un dépôt Git
    const gitDir = join(workspacePath, '.git');
    const isGitRepo = existsSync(gitDir);
    // Compter les fichiers (approximation)
    let fileCount = 0;
    let fileTypes = new Set();
    try {
        const files = fs.readdirSync(workspacePath, { withFileTypes: true });
        for (const file of files) {
            if (file.isFile()) {
                fileCount++;
                const ext = path.extname(file.name).toLowerCase();
                if (ext) {
                    fileTypes.add(ext);
                }
            }
        }
    }
    catch (error) {
        // Ignorer les erreurs de lecture
    }
    return {
        fileCount,
        fileTypes: Array.from(fileTypes).slice(0, 10), // Limiter à 10 types
        isGitRepo,
        detectedBy
    };
}
/**
 * Détecte les fichiers ouverts (simulation)
 *
 * Note: Dans une implémentation réelle, cela communiquerait avec VS Code
 * via une extension ou une API.
 */
async function detectOpenFiles(workspacePath) {
    // Pour l'instant, retourner une liste vide
    // À implémenter avec une extension VS Code future
    return [];
}
/**
 * Détecte le langage principal du workspace
 */
async function detectPrimaryLanguage(workspacePath) {
    const fs = await import('fs');
    const path = await import('path');
    // Fichiers indicateurs de langage
    const languageIndicators = [
        { file: 'package.json', language: 'javascript' },
        { file: 'tsconfig.json', language: 'typescript' },
        { file: 'requirements.txt', language: 'python' },
        { file: 'pyproject.toml', language: 'python' },
        { file: 'Cargo.toml', language: 'rust' },
        { file: 'go.mod', language: 'go' },
        { file: 'composer.json', language: 'php' },
        { file: 'Gemfile', language: 'ruby' },
    ];
    for (const indicator of languageIndicators) {
        if (existsSync(join(workspacePath, indicator.file))) {
            return indicator.language;
        }
    }
    // Analyser les extensions de fichiers
    try {
        const files = fs.readdirSync(workspacePath);
        const extensions = new Map();
        for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            if (ext) {
                extensions.set(ext, (extensions.get(ext) || 0) + 1);
            }
        }
        // Déterminer le langage par extension
        const extensionToLanguage = {
            '.js': 'javascript',
            '.ts': 'typescript',
            '.py': 'python',
            '.java': 'java',
            '.cpp': 'c++',
            '.cs': 'c#',
            '.go': 'go',
            '.rs': 'rust',
            '.php': 'php',
            '.rb': 'ruby',
        };
        for (const [ext, language] of Object.entries(extensionToLanguage)) {
            if (extensions.has(ext)) {
                return language;
            }
        }
    }
    catch (error) {
        // Ignorer les erreurs
    }
    return undefined;
}
/**
 * Utilitaire : Vérifie si un chemin est valide pour l'indexation
 */
export function isValidWorkspacePath(path) {
    if (!existsSync(path)) {
        return false;
    }
    // Exclure certains chemins système
    const excludedPaths = [
        '/',
        '/home',
        '/etc',
        '/var',
        '/tmp',
        '/dev',
        '/proc',
        '/sys'
    ];
    for (const excluded of excludedPaths) {
        if (path.startsWith(excluded) && path !== excluded) {
            // Vérifier que ce n'est pas un sous-dossier autorisé
            const relative = path.substring(excluded.length);
            if (relative.split('/').length < 3) {
                continue; // Sous-dossier direct, probablement OK
            }
        }
        else if (path === excluded) {
            return false; // Chemin système exact
        }
    }
    return true;
}
/**
 * Utilitaire : Normalise un chemin de workspace
 */
export function normalizeWorkspacePath(path) {
    const resolved = resolve(path);
    // Supprimer le trailing slash
    if (resolved.endsWith('/')) {
        return resolved.slice(0, -1);
    }
    return resolved;
}
// Test unitaire si exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🧪 Test du workspace detector...');
    detectWorkspace({
        manualPath: process.cwd(),
        useVscodeDetection: true,
        useEnvDetection: true
    }).then(context => {
        console.log('✅ Workspace détecté:');
        console.log(`  Chemin: ${context.path}`);
        console.log(`  VS Code: ${context.vscodeWorkspace}`);
        console.log(`  Langage: ${context.language || 'inconnu'}`);
        console.log(`  Métadonnées:`, context.metadata);
    }).catch(error => {
        console.error('❌ Erreur:', error.message);
        process.exit(1);
    });
}
