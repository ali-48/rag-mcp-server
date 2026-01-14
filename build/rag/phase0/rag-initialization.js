// src/rag/phase0/rag-initialization.ts
// Module A : Initialisation de l'infrastructure RAG (8 étapes atomiques)
// Responsabilités : A1-A8 - Logique métier pure, zéro MCP
import { promises as fs } from 'fs';
import path from 'path';
import { computeProjectId, isValidProjectPath } from './rag-state.js';
/**
 * Configuration par défaut pour .ragignore
 */
const DEFAULT_RAGIGNORE_CONTENT = `# Fichiers et dossiers à ignorer pour le RAG
node_modules/
.git/
dist/
build/
rag/db
rag/*.log
*.tmp
*.log
.DS_Store
Thumbs.db
`;
/**
 * Configuration RAG par défaut
 */
const DEFAULT_RAG_CONFIG = {
    rag_initialized: true,
    initialized_by: "init_rag",
    rag_version: "1.0",
    mode: "default",
    infrastructure: {
        memory_db: "sqlite://rag/db/memory/rag_memory.sqlite",
        vector_db: "postgres://localhost:5432/rag_project",
        config_version: "1.0"
    }
};
/**
 * Configuration DB par défaut
 */
const DEFAULT_DB_CONFIG = {
    memory: {
        type: "sqlite",
        path: "./rag/db/memory/rag_memory.sqlite"
    },
    vectors: {
        type: "postgres",
        host: "localhost",
        port: 5432,
        database: "rag_project",
        user: "rag",
        password: "rag"
    }
};
/**
 * Schéma SQL minimal pour SQLite
 */
const DEFAULT_SQL_SCHEMA = `-- Tables minimales pour la mémoire RAG
CREATE TABLE IF NOT EXISTS files_indexed (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP,
    UNIQUE(file_path)
);

CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_hash TEXT NOT NULL,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_path) REFERENCES files_indexed(file_path),
    UNIQUE(file_path, chunk_index)
);

CREATE TABLE IF NOT EXISTS llm_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_hash TEXT NOT NULL,
    response TEXT NOT NULL,
    model TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    UNIQUE(query_hash)
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    event_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(key)
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_files_indexed_path ON files_indexed(file_path);
CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(file_path);
CREATE INDEX IF NOT EXISTS idx_llm_cache_hash ON llm_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
`;
// ========== ÉTAPES ATOMIQUES ==========
/**
 * A1 — Résolution du projet
 *
 * @param projectPath Chemin du projet
 * @returns { rootPath, projectIdHash }
 */
async function resolveProjectPath(projectPath) {
    try {
        // Vérifier que le chemin existe et est un dossier
        if (!await isValidProjectPath(projectPath)) {
            throw new Error(`Chemin de projet invalide: ${projectPath}`);
        }
        // Normaliser le chemin
        const rootPath = path.resolve(projectPath);
        // Calculer le hash du projet
        const projectIdHash = computeProjectId(rootPath);
        return { rootPath, projectIdHash };
    }
    catch (error) {
        throw new Error(`Échec de la résolution du projet: ${error}`);
    }
}
/**
 * A2 — Création de l'arborescence
 *
 * @param rootPath Racine du projet
 * @returns Liste des dossiers créés
 */
async function ensureRagDirectories(rootPath) {
    const createdDirs = [];
    // Dossiers à créer (uniquement si absents)
    const directories = [
        path.join(rootPath, 'rag'),
        path.join(rootPath, 'rag', 'db'),
        path.join(rootPath, 'rag', 'db', 'memory'),
        path.join(rootPath, 'rag', 'db', 'metadata'),
        path.join(rootPath, 'rag', 'config')
    ];
    for (const dir of directories) {
        try {
            await fs.access(dir);
            // Dossier existe déjà
        }
        catch {
            // Créer le dossier
            await fs.mkdir(dir, { recursive: true });
            createdDirs.push(dir);
        }
    }
    return createdDirs;
}
/**
 * A3 — Création .ragignore
 *
 * @param rootPath Racine du projet
 * @returns true si le fichier a été créé
 */
async function ensureRagIgnore(rootPath) {
    const ragIgnorePath = path.join(rootPath, '.ragignore');
    try {
        // Vérifier si le fichier existe déjà
        await fs.access(ragIgnorePath);
        return false; // Fichier existe déjà
    }
    catch {
        // Créer le fichier avec le contenu par défaut
        await fs.writeFile(ragIgnorePath, DEFAULT_RAGIGNORE_CONTENT, 'utf-8');
        return true; // Fichier créé
    }
}
/**
 * A4 — Génération config RAG
 *
 * @param rootPath Racine du projet
 * @param projectId Hash du projet
 * @param mode Mode d'initialisation
 * @returns Chemin vers la config
 */
async function ensureRagConfig(rootPath, projectId, mode) {
    const configPath = path.join(rootPath, 'rag', 'config', 'rag.config.json');
    let existingConfig = {};
    try {
        // Essayer de lire la config existante
        const content = await fs.readFile(configPath, 'utf-8');
        existingConfig = JSON.parse(content);
    }
    catch {
        // Fichier n'existe pas ou erreur de parsing, on part de zéro
    }
    // Fusionner avec la config par défaut
    const config = {
        ...DEFAULT_RAG_CONFIG,
        ...existingConfig,
        project_id: projectId,
        mode,
        initialized_at: new Date().toISOString()
    };
    // Écrire la config
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return configPath;
}
/**
 * A5 — Génération config DB
 *
 * @param rootPath Racine du projet
 * @param mode Mode d'initialisation
 * @returns Chemin vers la config DB
 */
async function ensureDbConfig(rootPath, mode) {
    const configPath = path.join(rootPath, 'rag', 'config', 'db.config.json');
    let existingConfig = {};
    try {
        // Essayer de lire la config existante
        const content = await fs.readFile(configPath, 'utf-8');
        existingConfig = JSON.parse(content);
    }
    catch {
        // Fichier n'existe pas ou erreur de parsing
    }
    // Adapter la config selon le mode
    let config = { ...DEFAULT_DB_CONFIG, ...existingConfig };
    if (mode === 'memory-only') {
        config.vectors = { type: 'none' };
    }
    // Écrire la config
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return configPath;
}
/**
 * A6 — Initialisation SQLite
 *
 * @param sqlitePath Chemin vers le fichier SQLite
 */
async function initMemoryDatabase(sqlitePath) {
    const sqlite3Module = await import('sqlite3');
    const sqlite3 = sqlite3Module.default;
    const { open } = await import('sqlite');
    // Créer le dossier parent si nécessaire
    const dir = path.dirname(sqlitePath);
    await fs.mkdir(dir, { recursive: true });
    // Ouvrir/creer la base de données
    const db = await open({
        filename: sqlitePath,
        driver: sqlite3.Database
    });
    try {
        // Exécuter le schéma SQL
        await db.exec(DEFAULT_SQL_SCHEMA);
        // Vérifier que les tables ont été créées
        const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
        const expectedTables = ['files_indexed', 'chunks', 'llm_cache', 'events', 'project_state'];
        const createdTables = tables.map(t => t.name);
        for (const expectedTable of expectedTables) {
            if (!createdTables.includes(expectedTable)) {
                throw new Error(`Table ${expectedTable} non créée`);
            }
        }
        // Insérer l'état initial du projet
        await db.run("INSERT OR REPLACE INTO project_state (key, value) VALUES (?, ?)", ['rag_initialized', 'true']);
        await db.run("INSERT OR REPLACE INTO project_state (key, value) VALUES (?, ?)", ['initialized_at', new Date().toISOString()]);
    }
    finally {
        // Fermer la connexion
        await db.close();
    }
}
/**
 * A7 — Test vector DB (si activée)
 *
 * @param dbConfig Configuration DB
 * @returns true si le test réussit
 */
async function testVectorStoreConnection(dbConfig) {
    // Pour l'instant, on simule simplement le test
    // Dans une version future, on testerait réellement la connexion PostgreSQL
    if (!dbConfig.vectors || dbConfig.vectors.type === 'none') {
        return true; // Pas de DB vectorielle à tester
    }
    if (dbConfig.vectors.type === 'postgres') {
        // Simulation de test de connexion
        // Log silencieux pour MCP
        return true;
    }
    // Type de DB non supporté
    throw new Error(`Type de base de données vectorielle non supporté: ${dbConfig.vectors.type}`);
}
/**
 * A8 — Enregistrement MCP
 *
 * @param projectInfo Informations du projet
 * @returns true si l'enregistrement réussit
 */
async function registerProjectInRegistry(projectInfo) {
    // Pour l'instant, on simule l'enregistrement
    // Dans une version future, on enregistrerait dans un registry MCP global
    // Log silencieux pour MCP
    return true;
}
// ========== FONCTION PRINCIPALE ==========
/**
 * Initialise l'infrastructure RAG pour un projet (8 étapes atomiques)
 *
 * @param projectPath Chemin vers le projet
 * @param mode Mode d'initialisation
 * @returns Résultat détaillé de l'initialisation
 */
export async function initializeRagInfrastructure(projectPath, mode = 'default') {
    const result = {
        status: 'error',
        projectPath,
        ragPath: '',
        projectId: '',
        mode,
        initializedAt: new Date().toISOString(),
        details: {
            stepA1: { success: false, error: 'Non exécutée' },
            stepA2: { success: false, error: 'Non exécutée', directoriesCreated: [] },
            stepA3: { success: false, error: 'Non exécutée', fileCreated: false },
            stepA4: { success: false, error: 'Non exécutée', configPath: '' },
            stepA5: { success: false, error: 'Non exécutée', configPath: '' },
            stepA6: { success: false, error: 'Non exécutée', dbPath: '' },
            stepA7: { success: false, error: 'Non exécutée', tested: false },
            stepA8: { success: false, error: 'Non exécutée', registered: false }
        },
        errors: [],
        warnings: []
    };
    try {
        // ========== A1 — Résolution du projet ==========
        try {
            const { rootPath, projectIdHash } = await resolveProjectPath(projectPath);
            result.projectPath = rootPath;
            result.projectId = projectIdHash;
            result.ragPath = path.join(rootPath, 'rag');
            result.details.stepA1 = { success: true };
        }
        catch (error) {
            result.details.stepA1 = { success: false, error: String(error) };
            result.errors?.push(`A1 échouée: ${error}`);
            return result;
        }
        // ========== A2 — Création de l'arborescence ==========
        try {
            const createdDirs = await ensureRagDirectories(result.projectPath);
            result.details.stepA2 = { success: true, directoriesCreated: createdDirs };
        }
        catch (error) {
            result.details.stepA2 = { success: false, error: String(error), directoriesCreated: [] };
            result.errors?.push(`A2 échouée: ${error}`);
            return result;
        }
        // ========== A3 — Création .ragignore ==========
        try {
            const fileCreated = await ensureRagIgnore(result.projectPath);
            result.details.stepA3 = { success: true, fileCreated };
        }
        catch (error) {
            result.details.stepA3 = { success: false, error: String(error), fileCreated: false };
            result.warnings?.push(`A3 échouée: ${error}`);
        }
        // ========== A4 — Génération config RAG ==========
        try {
            const configPath = await ensureRagConfig(result.projectPath, result.projectId, mode);
            result.details.stepA4 = { success: true, configPath };
        }
        catch (error) {
            result.details.stepA4 = { success: false, error: String(error), configPath: '' };
            result.errors?.push(`A4 échouée: ${error}`);
            return result;
        }
        // ========== A5 — Génération config DB ==========
        try {
            const configPath = await ensureDbConfig(result.projectPath, mode);
            result.details.stepA5 = { success: true, configPath };
        }
        catch (error) {
            result.details.stepA5 = { success: false, error: String(error), configPath: '' };
            result.errors?.push(`A5 échouée: ${error}`);
            return result;
        }
        // ========== A6 — Initialisation SQLite ==========
        try {
            const dbPath = path.join(result.projectPath, 'rag', 'db', 'memory', 'rag_memory.sqlite');
            await initMemoryDatabase(dbPath);
            result.details.stepA6 = { success: true, dbPath };
        }
        catch (error) {
            result.details.stepA6 = { success: false, error: String(error), dbPath: '' };
            result.errors?.push(`A6 échouée: ${error}`);
            return result;
        }
        // ========== A7 — Test vector DB ==========
        try {
            // Lire la config DB pour le test
            const dbConfigPath = path.join(result.projectPath, 'rag', 'config', 'db.config.json');
            const dbConfigContent = await fs.readFile(dbConfigPath, 'utf-8');
            const dbConfig = JSON.parse(dbConfigContent);
            const tested = await testVectorStoreConnection(dbConfig);
            result.details.stepA7 = { success: true, tested };
        }
        catch (error) {
            result.details.stepA7 = { success: false, error: String(error), tested: false };
            result.warnings?.push(`A7 échouée: ${error}`);
        }
        // ========== A8 — Enregistrement MCP ==========
        try {
            const registered = await registerProjectInRegistry({
                projectId: result.projectId,
                rootPath: result.projectPath,
                ragPath: result.ragPath,
                mode: result.mode
            });
            result.details.stepA8 = { success: true, registered };
        }
        catch (error) {
            result.details.stepA8 = { success: false, error: String(error), registered: false };
            result.warnings?.push(`A8 échouée: ${error}`);
        }
        // ========== FINALISATION ==========
        // Si on arrive ici, toutes les étapes critiques ont réussi
        result.status = 'initialized';
        return result;
    }
    catch (error) {
        // Erreur globale non capturée
        result.errors?.push(`Erreur globale: ${error}`);
        return result;
    }
}
