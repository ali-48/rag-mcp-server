// src/rag/vector-store-factory.ts
// Factory pour créer des instances de vector store basées sur la configuration

import {
    IVectorStore,
    VectorStoreConfig,
    VectorStoreError,
    VectorStoreLogger,
    validateVectorStoreConfig
} from './vector-store-interface.js';
import { VectorStoreSQLite } from './vector-store-sqlite.js';

/**
 * Factory pour créer des instances de vector store
 * 
 * Cette factory crée des instances de vector store basées sur la configuration
 * et gère le fallback automatique en cas d'échec de connexion.
 */
export class VectorStoreFactory {
    /**
     * Crée une instance de vector store basée sur la configuration
     * @param config Configuration du vector store
     * @returns Instance de IVectorStore
     */
    static create(config: VectorStoreConfig): IVectorStore {
        // Valider la configuration
        const errors = validateVectorStoreConfig(config);
        if (errors.length > 0) {
            throw new VectorStoreError(
                `Configuration invalide: ${errors.join(', ')}`,
                'INVALID_CONFIG',
                { errors }
            );
        }

        VectorStoreLogger.info('factory.create', `Création de vector store avec backend: ${config.type}`, {
            type: config.type
        });

        try {
            switch (config.type) {
                case 'sqlite':
                    return this.createSQLiteStore(config);

                case 'postgresql':
                    return this.createPostgreSQLStore(config);

                case 'memory':
                    return this.createMemoryStore(config);

                default:
                    throw new VectorStoreError(
                        `Type de backend non supporté: ${config.type}`,
                        'UNSUPPORTED_BACKEND',
                        { type: config.type }
                    );
            }
        } catch (error) {
            VectorStoreLogger.error('factory.create', `Échec de création du vector store`, error as Error, {
                type: config.type
            });

            // Fallback sur SQLite en cas d'échec
            return this.createFallbackStore(config);
        }
    }

    /**
     * Crée un store SQLite
     */
    private static createSQLiteStore(config: VectorStoreConfig): IVectorStore {
        VectorStoreLogger.info('factory.sqlite', 'Création de vector store SQLite', {
            file: config.sqlite?.file || ':memory:'
        });

        return new VectorStoreSQLite(config);
    }

    /**
     * Crée un store PostgreSQL (optionnel)
     */
    private static createPostgreSQLStore(config: VectorStoreConfig): IVectorStore {
        VectorStoreLogger.info('factory.postgresql', 'Création de vector store PostgreSQL', {
            host: config.postgresql?.host,
            database: config.postgresql?.database
        });

        // Vérifier si PostgreSQL est disponible
        if (!this.isPostgreSQLAvailable()) {
            VectorStoreLogger.warn('factory.postgresql', 'PostgreSQL non disponible, fallback sur SQLite', {
                reason: 'PostgreSQL non installé ou non configuré'
            });
            return this.createFallbackStore(config);
        }

        try {
            // Importer dynamiquement le module PostgreSQL
            const { VectorStorePostgreSQL } = require('./vector-store-postgresql.js');
            return new VectorStorePostgreSQL(config);
        } catch (error) {
            VectorStoreLogger.error('factory.postgresql', 'Échec de chargement du module PostgreSQL', error as Error);
            throw new VectorStoreError(
                'PostgreSQL non disponible. Assurez-vous que le module est installé et configuré.',
                'POSTGRESQL_UNAVAILABLE',
                { error: error instanceof Error ? error.message : String(error) }
            );
        }
    }

    /**
     * Crée un store en mémoire
     */
    private static createMemoryStore(config: VectorStoreConfig): IVectorStore {
        VectorStoreLogger.info('factory.memory', 'Création de vector store en mémoire');

        try {
            // Importer dynamiquement le module memory
            const { VectorStoreMemory } = require('./vector-store-memory.js');
            return new VectorStoreMemory(config);
        } catch (error) {
            VectorStoreLogger.warn('factory.memory', 'Module memory non disponible, fallback sur SQLite', {
                error: error instanceof Error ? error.message : String(error)
            });
            return this.createFallbackStore(config);
        }
    }

    /**
     * Crée un store de fallback (SQLite)
     */
    private static createFallbackStore(originalConfig: VectorStoreConfig): IVectorStore {
        VectorStoreLogger.warn('factory.fallback', 'Utilisation du fallback SQLite', {
            originalBackend: originalConfig.type
        });

        // Créer une configuration SQLite de fallback
        const fallbackConfig: VectorStoreConfig = {
            type: 'sqlite',
            sqlite: {
                file: ':memory:',
                memory: true
            },
            options: originalConfig.options
        };

        return new VectorStoreSQLite(fallbackConfig);
    }

    /**
     * Vérifie si PostgreSQL est disponible
     */
    private static isPostgreSQLAvailable(): boolean {
        try {
            // Essayer de charger le module
            require('pg');
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Crée un vector store basé sur la configuration du projet
     * @param projectPath Chemin du projet
     * @returns Instance de vector store configurée
     */
    static createFromProjectConfig(projectPath: string): IVectorStore {
        VectorStoreLogger.info('factory.project', `Création de vector store pour le projet: ${projectPath}`);

        try {
            // Charger la configuration du projet
            const config = this.loadProjectConfig(projectPath);
            return this.create(config);
        } catch (error) {
            VectorStoreLogger.error('factory.project', `Échec de chargement de la configuration du projet`, error as Error, {
                projectPath
            });

            // Configuration par défaut
            const defaultConfig: VectorStoreConfig = {
                type: 'sqlite',
                sqlite: {
                    file: `${projectPath}/rag/db/vectors.sqlite`
                }
            };

            return this.create(defaultConfig);
        }
    }

    /**
     * Charge la configuration du projet
     */
    private static loadProjectConfig(projectPath: string): VectorStoreConfig {
        // Essayer de charger depuis rag/config/db.config.json
        const fs = require('fs');
        const path = require('path');

        const configPath = path.join(projectPath, 'rag', 'config', 'db.config.json');

        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configData);

            // Valider et normaliser la configuration
            return this.normalizeConfig(config);
        }

        // Configuration par défaut
        return {
            type: 'sqlite',
            sqlite: {
                file: path.join(projectPath, 'rag', 'db', 'vectors.sqlite')
            }
        };
    }

    /**
     * Normalise la configuration
     */
    private static normalizeConfig(config: any): VectorStoreConfig {
        // S'assurer que le type est valide
        const type = config.type || 'sqlite';

        const normalized: VectorStoreConfig = {
            type: type as 'sqlite' | 'postgresql' | 'memory'
        };

        // Normaliser la configuration SQLite
        if (type === 'sqlite' && config.sqlite) {
            normalized.sqlite = {
                file: config.sqlite.file || ':memory:',
                memory: config.sqlite.memory || false,
                readonly: config.sqlite.readonly || false
            };
        }

        // Normaliser la configuration PostgreSQL
        if (type === 'postgresql' && config.postgresql) {
            normalized.postgresql = {
                host: config.postgresql.host || 'localhost',
                port: config.postgresql.port || 5432,
                database: config.postgresql.database || 'rag',
                user: config.postgresql.user || 'postgres',
                password: config.postgresql.password || '',
                ssl: config.postgresql.ssl || false,
                poolSize: config.postgresql.poolSize || 10
            };
        }

        // Normaliser la configuration mémoire
        if (type === 'memory' && config.memory) {
            normalized.memory = {
                maxDocuments: config.memory.maxDocuments || 10000,
                persistToFile: config.memory.persistToFile
            };
        }

        // Options communes
        if (config.options) {
            normalized.options = {
                enableCompression: config.options.enableCompression || false,
                compressionThreshold: config.options.compressionThreshold || 1000,
                enableCache: config.options.enableCache || true,
                cacheSize: config.options.cacheSize || 1000,
                vectorDimension: config.options.vectorDimension || 768,
                similarityFunction: config.options.similarityFunction || 'cosine'
            };
        }

        return normalized;
    }

    /**
     * Teste la connectivité d'un vector store
     * @param config Configuration à tester
     * @returns Résultat du test
     */
    static async testConnection(config: VectorStoreConfig): Promise<{
        success: boolean;
        backend: string;
        message: string;
        details?: any;
    }> {
        try {
            VectorStoreLogger.info('factory.test', `Test de connexion pour backend: ${config.type}`);

            const store = this.create(config);
            const connected = await store.testConnection();

            if (connected) {
                return {
                    success: true,
                    backend: config.type,
                    message: `Connexion réussie au backend ${config.type}`
                };
            } else {
                return {
                    success: false,
                    backend: config.type,
                    message: `Échec de connexion au backend ${config.type}`
                };
            }
        } catch (error) {
            return {
                success: false,
                backend: config.type,
                message: `Erreur lors du test de connexion: ${error instanceof Error ? error.message : String(error)}`,
                details: { error }
            };
        }
    }

    /**
     * Obtient les backends disponibles
     */
    static getAvailableBackends(): Array<{
        type: string;
        available: boolean;
        description: string;
    }> {
        const backends = [
            {
                type: 'sqlite',
                available: true, // Toujours disponible
                description: 'Backend SQLite local (recommandé)'
            },
            {
                type: 'postgresql',
                available: this.isPostgreSQLAvailable(),
                description: 'Backend PostgreSQL pour production'
            },
            {
                type: 'memory',
                available: true, // Toujours disponible via fallback
                description: 'Backend mémoire pour tests'
            }
        ];

        return backends;
    }
}

/**
 * Fonction utilitaire pour créer un vector store
 * (Compatibilité avec l'ancien code)
 */
export function createVectorStore(config: VectorStoreConfig): IVectorStore {
    return VectorStoreFactory.create(config);
}

/**
 * Fonction utilitaire pour créer un vector store depuis un projet
 */
export function createVectorStoreForProject(projectPath: string): IVectorStore {
    return VectorStoreFactory.createFromProjectConfig(projectPath);
}

/**
 * Fonction utilitaire pour tester la connectivité
 */
export async function testVectorStoreConnection(config: VectorStoreConfig): Promise<{
    success: boolean;
    backend: string;
    message: string;
    details?: any;
}> {
    return VectorStoreFactory.testConnection(config);
}

/**
 * Fonction utilitaire pour lister les backends disponibles
 */
export function getAvailableVectorStoreBackends(): Array<{
    type: string;
    available: boolean;
    description: string;
}> {
    return VectorStoreFactory.getAvailableBackends();
}
