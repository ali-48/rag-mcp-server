// src/config/db-config.ts
// Gestionnaire de configuration de base de données pour RAG

import { readFileSync } from 'fs';
import { dirname } from 'path';
import * as sqlite3 from 'sqlite3';
import { logger } from '../core/logger.js';

/**
 * Interface pour la configuration d'une base de données
 */
export interface DatabaseConfig {
    type: 'sqlite' | 'postgresql' | 'memory';
    path?: string;
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    maxConnections?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
}

/**
 * Interface pour la configuration complète des bases de données
 */
export interface DbConfig {
    memory: DatabaseConfig;
    vectors: DatabaseConfig;
    metadata?: DatabaseConfig;
}

/**
 * Classe pour charger et gérer la configuration des bases de données
 */
export class DbConfigManager {
    private config: DbConfig;
    private configPath: string;
    private connections: Map<string, sqlite3.Database> = new Map();

    constructor(configPath?: string) {
        this.configPath = configPath || './rag/config/db.config.json';
        this.config = this.loadConfig();
    }

    /**
     * Charge la configuration depuis le fichier JSON
     */
    private loadConfig(): DbConfig {
        try {
            const configData = readFileSync(this.configPath, 'utf-8');
            const config = JSON.parse(configData) as DbConfig;

            // S'assurer que toutes les bases ont une configuration
            if (!config.metadata) {
                config.metadata = {
                    type: 'sqlite',
                    path: './rag/db/metadata/rag_metadata.sqlite'
                };
            }

            return config;
        } catch (error) {
            // Configuration par défaut si le fichier n'existe pas
            return {
                memory: {
                    type: 'sqlite',
                    path: './rag/db/memory/rag_memory.sqlite'
                },
                vectors: {
                    type: 'sqlite',
                    path: './rag/db/vector/rag_vectors.sqlite'
                },
                metadata: {
                    type: 'sqlite',
                    path: './rag/db/metadata/rag_metadata.sqlite'
                }
            };
        }
    }

    /**
     * Récupère la configuration complète
     */
    getConfig(): DbConfig {
        return this.config;
    }

    /**
     * Récupère la configuration pour un type de base spécifique
     */
    getDatabaseConfig(type: keyof DbConfig): DatabaseConfig {
        const config = this.config[type];
        if (!config) {
            throw new Error(`Configuration non trouvée pour le type de base: ${type}`);
        }
        return config;
    }

    /**
     * Vérifie si toutes les bases sont configurées en SQLite
     */
    isAllSqlite(): boolean {
        return Object.values(this.config).every(db => db?.type === 'sqlite');
    }

    /**
     * Obtient une connexion SQLite pour un type de base spécifique
     */
    getSqliteConnection(type: keyof DbConfig): sqlite3.Database {
        if (this.connections.has(type)) {
            return this.connections.get(type)!;
        }

        const dbConfig = this.getDatabaseConfig(type);

        if (dbConfig.type !== 'sqlite') {
            throw new Error(`La base ${type} n'est pas configurée comme SQLite`);
        }

        if (!dbConfig.path) {
            throw new Error(`Chemin non défini pour la base ${type}`);
        }

        // Créer le répertoire parent si nécessaire
        const path = dbConfig.path;
        const dir = dirname(path);

        try {
            // Cette opération peut nécessiter des permissions, mais nous laissons
            // le système de fichiers gérer les erreurs
            require('fs').mkdirSync(dir, { recursive: true });
        } catch (error) {
            // Ignorer les erreurs de création de répertoire
        }

        // Créer la connexion SQLite
        const db = new sqlite3.Database(path, (err: Error | null) => {
            if (err) {
                logger.error(`rag.db.connection.failed`, `Erreur lors de l'ouverture de la base ${type}`, {
                    type,
                    path,
                    error: err.message
                });
            }
        });

        // Configurer des paramètres optimisés pour RAG
        db.exec(`
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA foreign_keys = ON;
            PRAGMA cache_size = -2000; -- 2MB de cache
        `);

        this.connections.set(type, db);
        return db;
    }

    /**
     * Ferme toutes les connexions SQLite
     */
    closeAllConnections(): void {
        const entries = Array.from(this.connections.entries());
        for (const [type, connection] of entries) {
            try {
                connection.close();
            } catch (error) {
                // Ignorer les erreurs de fermeture
            }
        }
        this.connections.clear();
    }

    /**
     * Initialise les schémas de base de données si nécessaire
     */
    initializeSchemas(): void {
        if (!this.isAllSqlite()) {
            throw new Error('L\'initialisation des schémas n\'est supportée que pour SQLite');
        }

        // Initialiser la base de mémoire
        const memoryDb = this.getSqliteConnection('memory');
        memoryDb.exec(`
      CREATE TABLE IF NOT EXISTS rag_memory (
        id TEXT PRIMARY KEY,
        project_path TEXT NOT NULL,
        operation TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        details TEXT,
        metadata TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_rag_memory_project ON rag_memory(project_path);
      CREATE INDEX IF NOT EXISTS idx_rag_memory_timestamp ON rag_memory(timestamp);
    `);

        // Initialiser la base de vecteurs
        const vectorsDb = this.getSqliteConnection('vectors');
        vectorsDb.exec(`
      CREATE TABLE IF NOT EXISTS rag_vectors (
        id TEXT PRIMARY KEY,
        project_path TEXT NOT NULL,
        file_path TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content_type TEXT NOT NULL,
        language TEXT,
        role TEXT,
        content TEXT NOT NULL,
        embedding BLOB NOT NULL,
        metadata TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_rag_vectors_project ON rag_vectors(project_path);
      CREATE INDEX IF NOT EXISTS idx_rag_vectors_file ON rag_vectors(file_path);
      CREATE INDEX IF NOT EXISTS idx_rag_vectors_content_type ON rag_vectors(content_type);
      CREATE INDEX IF NOT EXISTS idx_rag_vectors_language ON rag_vectors(language);
      
      -- Index pour la recherche par similarité (sera utilisé avec des fonctions personnalisées)
      CREATE INDEX IF NOT EXISTS idx_rag_vectors_embedding ON rag_vectors(embedding);
    `);

        // Initialiser la base de métadonnées
        const metadataDb = this.getSqliteConnection('metadata');
        metadataDb.exec(`
      CREATE TABLE IF NOT EXISTS rag_metadata (
        id TEXT PRIMARY KEY,
        project_path TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        data_type TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_metadata_project_key ON rag_metadata(project_path, key);
      CREATE INDEX IF NOT EXISTS idx_rag_metadata_key ON rag_metadata(key);
    `);
    }

    /**
     * Vérifie la connectivité aux bases de données
     */
    async testConnections(): Promise<{ [key in keyof DbConfig]: boolean }> {
        const results: { [key in keyof DbConfig]: boolean } = {
            memory: false,
            vectors: false,
            metadata: false
        };

        if (this.isAllSqlite()) {
            // Tester la connexion mémoire
            try {
                const memoryDb = this.getSqliteConnection('memory');
                await new Promise<void>((resolve, reject) => {
                    memoryDb.get('SELECT 1 as test', (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                results.memory = true;
            } catch (error) {
                results.memory = false;
            }

            // Tester la connexion vecteurs
            try {
                const vectorsDb = this.getSqliteConnection('vectors');
                await new Promise<void>((resolve, reject) => {
                    vectorsDb.get('SELECT 1 as test', (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                results.vectors = true;
            } catch (error) {
                results.vectors = false;
            }

            // Tester la connexion métadonnées
            try {
                const metadataDb = this.getSqliteConnection('metadata');
                await new Promise<void>((resolve, reject) => {
                    metadataDb.get('SELECT 1 as test', (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                results.metadata = true;
            } catch (error) {
                results.metadata = false;
            }
        } else {
            // Pour PostgreSQL, nous devrions tester les connexions pool
            // Pour l'instant, retourner false pour les bases non-SQLite
            Object.keys(results).forEach(key => {
                const dbConfig = this.config[key as keyof DbConfig];
                results[key as keyof DbConfig] = dbConfig?.type === 'sqlite';
            });
        }

        return results;
    }

    /**
     * Récupère les chemins des fichiers SQLite
     */
    getSqlitePaths(): { [key in keyof DbConfig]: string | undefined } {
        const paths: { [key in keyof DbConfig]: string | undefined } = {
            memory: undefined,
            vectors: undefined,
            metadata: undefined
        };

        Object.keys(paths).forEach(key => {
            const config = this.config[key as keyof DbConfig];
            if (config?.type === 'sqlite' && config.path) {
                paths[key as keyof DbConfig] = config.path;
            }
        });

        return paths;
    }
}

/**
 * Instance singleton du gestionnaire de configuration DB
 */
let dbConfigManager: DbConfigManager | null = null;

/**
 * Obtient l'instance singleton du gestionnaire de configuration DB
 */
export function getDbConfigManager(configPath?: string): DbConfigManager {
    if (!dbConfigManager) {
        dbConfigManager = new DbConfigManager(configPath);
    }
    return dbConfigManager;
}

/**
 * Fonction utilitaire pour charger rapidement la configuration DB
 */
export function loadDbConfig(configPath?: string): DbConfig {
    return getDbConfigManager(configPath).getConfig();
}

/**
 * Test de la configuration DB
 */
export async function testDbConfig(): Promise<boolean> {
    try {
        const dbConfigManager = getDbConfigManager();
        const config = dbConfigManager.getConfig();

        // Vérifier que toutes les bases sont configurées
        if (!config.memory || !config.vectors) {
            logger.warn('rag.db.config.incomplete', 'Configuration DB incomplète: memory ou vectors manquants');
            return false;
        }

        // Vérifier que nous sommes en SQLite (pour la migration)
        if (!dbConfigManager.isAllSqlite()) {
            logger.warn('rag.db.config.mixed_backends', 'Attention: Certaines bases ne sont pas en SQLite. La migration peut nécessiter des adaptations.', {
                memoryType: config.memory.type,
                vectorsType: config.vectors.type,
                metadataType: config.metadata?.type
            });
        }

        // Tester les connexions
        const connections = await dbConfigManager.testConnections();
        const allConnected = Object.values(connections).every(connected => connected);

        if (!allConnected) {
            logger.warn('rag.db.connections.failed', 'Certaines connexions DB ont échoué', {
                connections,
                memoryPath: config.memory.path,
                vectorsPath: config.vectors.path,
                metadataPath: config.metadata?.path
            });
        }

        return true;
    } catch (error) {
        logger.error('rag.db.config.test.failed', 'Erreur lors du test de la configuration DB', {
            error: error instanceof Error ? error.message : String(error)
        });
        return false;
    }
}

// Exécution automatique si ce fichier est exécuté directement
if (typeof require !== 'undefined' && require.main === module) {
    testDbConfig().then(success => {
        if (success) {
            logger.info('rag.db.config.test.success', 'Configuration DB testée avec succès');
            process.exit(0);
        } else {
            logger.error('rag.db.config.test.failure', 'Échec du test de configuration DB');
            process.exit(1);
        }
    });
}
