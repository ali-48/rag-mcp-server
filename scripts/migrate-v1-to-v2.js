#!/usr/bin/env node

/**
 * Script de migration PostgreSQL → SQLite pour RAG MCP Server
 * 
 * Ce script migre les données de la base PostgreSQL vers SQLite
 * avec backup des données et validation.
 * 
 * Version: v1.0.0
 */

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
    // PostgreSQL (source)
    postgres: {
        host: process.env.PG_HOST || "localhost",
        port: parseInt(process.env.PG_PORT || "16432"),
        database: process.env.PG_DATABASE || "rag_mcp_dedicated",
        user: process.env.PG_USER || "rag_user",
        password: process.env.PG_PASSWORD || "secure_rag_password",
        ssl: process.env.PG_SSL === 'true'
    },

    // SQLite (destination)
    sqlite: {
        path: process.env.SQLITE_PATH || path.join(__dirname, '..', 'rag', 'db', 'vectors.sqlite'),
        backup_path: process.env.SQLITE_BACKUP_PATH || path.join(__dirname, '..', 'rag', 'db', 'vectors.backup.sqlite')
    },

    // Migration
    batch_size: parseInt(process.env.BATCH_SIZE || "1000"),
    backup_enabled: process.env.BACKUP_ENABLED !== 'false',
    verbose: process.env.VERBOSE === 'true'
};

/**
 * Affiche un message avec timestamp
 */
function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warn' ? '⚠️' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
}

/**
 * Vérifie si PostgreSQL est accessible
 */
async function checkPostgresConnection(pool) {
    try {
        const result = await pool.query('SELECT 1 as test');
        return result.rows[0].test === 1;
    } catch (error) {
        log(`Erreur de connexion PostgreSQL: ${error.message}`, 'error');
        return false;
    }
}

/**
 * Vérifie si une table existe dans PostgreSQL
 */
async function checkPostgresTableExists(pool, tableName) {
    try {
        const result = await pool.query(
            `SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = $1
            )`,
            [tableName]
        );
        return result.rows[0].exists;
    } catch (error) {
        log(`Erreur lors de la vérification de la table ${tableName}: ${error.message}`, 'error');
        return false;
    }
}

/**
 * Récupère les statistiques d'une table PostgreSQL
 */
async function getPostgresTableStats(pool, tableName) {
    try {
        const result = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        return parseInt(result.rows[0].count) || 0;
    } catch (error) {
        log(`Erreur lors de la récupération des stats pour ${tableName}: ${error.message}`, 'error');
        return 0;
    }
}

/**
 * Crée une sauvegarde de la base SQLite existante
 */
async function backupSqliteDatabase() {
    if (!CONFIG.backup_enabled) {
        log('Sauvegarde désactivée', 'warn');
        return true;
    }

    if (!fs.existsSync(CONFIG.sqlite.path)) {
        log('Base SQLite inexistante, pas de sauvegarde nécessaire', 'info');
        return true;
    }

    try {
        const backupDir = path.dirname(CONFIG.sqlite.backup_path);
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        fs.copyFileSync(CONFIG.sqlite.path, CONFIG.sqlite.backup_path);
        log(`Sauvegarde SQLite créée: ${CONFIG.sqlite.backup_path}`, 'info');
        return true;
    } catch (error) {
        log(`Erreur lors de la sauvegarde SQLite: ${error.message}`, 'error');
        return false;
    }
}

/**
 * Initialise la base SQLite avec le schéma v2
 */
async function initializeSqliteDatabase() {
    try {
        // Créer le répertoire si nécessaire
        const sqliteDir = path.dirname(CONFIG.sqlite.path);
        if (!fs.existsSync(sqliteDir)) {
            fs.mkdirSync(sqliteDir, { recursive: true });
        }

        // Ouvrir la base de données
        const db = await open({
            filename: CONFIG.sqlite.path,
            driver: sqlite3.Database
        });

        // Créer les tables v2
        await db.exec(`
            -- Table principale pour les embeddings
            CREATE TABLE IF NOT EXISTS rag_store_v2 (
                id TEXT PRIMARY KEY,
                project_path TEXT NOT NULL,
                file_path TEXT NOT NULL,
                content TEXT NOT NULL,
                vector BLOB NOT NULL,
                content_type TEXT NOT NULL,
                file_extension TEXT,
                file_size_bytes INTEGER,
                lines_count INTEGER,
                language TEXT,
                chunk_index INTEGER,
                total_chunks INTEGER,
                metadata JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                embedding_model TEXT,
                embedding_dimensions INTEGER,
                embedding_provider TEXT
            );

            -- Index pour les recherches par projet
            CREATE INDEX IF NOT EXISTS idx_rag_store_v2_project_path 
            ON rag_store_v2(project_path);

            -- Index pour les recherches par type de contenu
            CREATE INDEX IF NOT EXISTS idx_rag_store_v2_content_type 
            ON rag_store_v2(content_type);

            -- Index pour les recherches par langue
            CREATE INDEX IF NOT EXISTS idx_rag_store_v2_language 
            ON rag_store_v2(language);

            -- Table pour les métadonnées de projet
            CREATE TABLE IF NOT EXISTS project_metadata (
                project_hash TEXT PRIMARY KEY,
                project_path TEXT NOT NULL,
                total_files INTEGER DEFAULT 0,
                total_chunks INTEGER DEFAULT 0,
                last_indexed_at TIMESTAMP,
                vector_store_backend TEXT DEFAULT 'sqlite',
                embedding_model TEXT,
                chunking_strategy TEXT,
                metadata JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Table pour les verrous
            CREATE TABLE IF NOT EXISTS locks (
                lock_id TEXT PRIMARY KEY,
                resource TEXT NOT NULL,
                process_id INTEGER NOT NULL,
                acquired_at TIMESTAMP NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                metadata JSON
            );
        `);

        await db.close();
        log(`Base SQLite initialisée: ${CONFIG.sqlite.path}`, 'info');
        return true;
    } catch (error) {
        log(`Erreur lors de l'initialisation SQLite: ${error.message}`, 'error');
        return false;
    }
}

/**
 * Détermine le type de contenu basé sur l'extension de fichier
 */
function determineContentType(filePath) {
    const extension = path.extname(filePath).toLowerCase();

    const contentTypeMap = {
        // Documents
        '.md': 'doc',
        '.txt': 'doc',
        '.pdf': 'doc',
        '.doc': 'doc',
        '.docx': 'doc',

        // Code
        '.js': 'code',
        '.ts': 'code',
        '.jsx': 'code',
        '.tsx': 'code',
        '.py': 'code',
        '.java': 'code',
        '.cpp': 'code',
        '.c': 'code',
        '.cs': 'code',
        '.go': 'code',
        '.rs': 'code',
        '.php': 'code',
        '.rb': 'code',
        '.swift': 'code',
        '.kt': 'code',

        // Configuration
        '.json': 'config',
        '.yaml': 'config',
        '.yml': 'config',
        '.toml': 'config',
        '.ini': 'config',
        '.conf': 'config',
        '.xml': 'config',

        // Autres
        '.html': 'other',
        '.css': 'other',
        '.sql': 'other',
        '.sh': 'other',
        '.bat': 'other'
    };

    return contentTypeMap[extension] || 'other';
}

/**
 * Migre les données de PostgreSQL vers SQLite
 */
async function migrateData(pool) {
    let totalMigrated = 0;
    let totalFailed = 0;
    let offset = 0;

    const db = await open({
        filename: CONFIG.sqlite.path,
        driver: sqlite3.Database
    });

    try {
        // Démarrer une transaction
        await db.run('BEGIN TRANSACTION');

        // Récupérer le nombre total d'enregistrements
        const totalRecords = await getPostgresTableStats(pool, 'rag_store');
        log(`Total d'enregistrements à migrer: ${totalRecords}`, 'info');

        while (offset < totalRecords) {
            // Récupérer un batch d'enregistrements
            const result = await pool.query(`
                SELECT 
                    id, project_path, file_path, content, vector,
                    created_at, updated_at
                FROM rag_store 
                ORDER BY id
                LIMIT $1 OFFSET $2
            `, [CONFIG.batch_size, offset]);

            const rows = result.rows;
            if (rows.length === 0) {
                break;
            }

            // Insérer chaque enregistrement dans SQLite
            for (const row of rows) {
                try {
                    const contentType = determineContentType(row.file_path);
                    const fileExtension = path.extname(row.file_path);

                    await db.run(`
                        INSERT INTO rag_store_v2 (
                            id, project_path, file_path, content, vector,
                            content_type, file_extension, metadata,
                            created_at, updated_at,
                            embedding_model, embedding_dimensions, embedding_provider
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        row.id,
                        row.project_path,
                        row.file_path,
                        row.content,
                        row.vector,
                        contentType,
                        fileExtension,
                        JSON.stringify({
                            migrated_from: 'postgresql',
                            migrated_at: new Date().toISOString(),
                            original_created_at: row.created_at,
                            original_updated_at: row.updated_at
                        }),
                        row.created_at,
                        row.updated_at,
                        'nomic-embed-text', // Valeur par défaut
                        768, // Dimensions par défaut
                        'ollama' // Provider par défaut
                    ]);

                    totalMigrated++;

                    if (CONFIG.verbose && totalMigrated % 100 === 0) {
                        log(`Migré: ${totalMigrated}/${totalRecords}`, 'info');
                    }
                } catch (error) {
                    totalFailed++;
                    if (CONFIG.verbose) {
                        log(`Échec migration ID ${row.id}: ${error.message}`, 'warn');
                    }
                }
            }

            offset += CONFIG.batch_size;
        }

        // Valider la transaction
        await db.run('COMMIT');

        log(`Migration terminée: ${totalMigrated} réussis, ${totalFailed} échoués`, 'info');

        // Mettre à jour les métadonnées de projet
        await updateProjectMetadata(db);

        return { totalMigrated, totalFailed };

    } catch (error) {
        // Annuler la transaction en cas d'erreur
        await db.run('ROLLBACK');
        throw error;
    } finally {
        await db.close();
    }
}

/**
 * Met à jour les métadonnées de projet
 */
async function updateProjectMetadata(db) {
    try {
        // Récupérer tous les projets distincts
        const projects = await db.all(`
            SELECT DISTINCT project_path 
            FROM rag_store_v2
        `);

        for (const project of projects) {
            const projectPath = project.project_path;
            const projectHash = require('crypto')
                .createHash('md5')
                .update(projectPath)
                .digest('hex');

            // Compter les fichiers et chunks
            const stats = await db.get(`
                SELECT 
                    COUNT(DISTINCT file_path) as total_files,
                    COUNT(*) as total_chunks
                FROM rag_store_v2 
                WHERE project_path = ?
            `, [projectPath]);

            // Insérer ou mettre à jour les métadonnées
            await db.run(`
                INSERT OR REPLACE INTO project_metadata (
                    project_hash, project_path, total_files, total_chunks,
                    last_indexed_at, vector_store_backend, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                projectHash,
                projectPath,
                stats.total_files,
                stats.total_chunks,
                new Date().toISOString(),
                'sqlite',
                JSON.stringify({
                    migrated: true,
                    migration_date: new Date().toISOString(),
                    source_backend: 'postgresql'
                })
            ]);
        }

        log(`Métadonnées de projet mises à jour: ${projects.length} projets`, 'info');
    } catch (error) {
        log(`Erreur lors de la mise à jour des métadonnées: ${error.message}`, 'error');
    }
}

/**
 * Valide la migration
 */
async function validateMigration(pool) {
    try {
        // Ouvrir la base SQLite
        const db = await open({
            filename: CONFIG.sqlite.path,
            driver: sqlite3.Database
        });

        // Compter les enregistrements dans PostgreSQL
        const pgCount = await getPostgresTableStats(pool, 'rag_store');

        // Compter les enregistrements dans SQLite
        const sqliteResult = await db.get('SELECT COUNT(*) as count FROM rag_store_v2');
        const sqliteCount = sqliteResult.count;

        await db.close();

        log(`Validation: PostgreSQL=${pgCount}, SQLite=${sqliteCount}`, 'info');

        if (pgCount === 0 && sqliteCount === 0) {
            log('Aucune donnée à migrer', 'warn');
            return true;
        }

        if (sqliteCount >= pgCount * 0.95) { // Accepte 5% de perte
            log('✅ Migration validée avec succès', 'info');
            return true;
        } else {
            log(`❌ Migration incomplète: ${sqliteCount}/${pgCount} enregistrements`, 'error');
            return false;
        }
    } catch (error) {
        log(`Erreur lors de la validation: ${error.message}`, 'error');
        return false;
    }
}

/**
 * Point d'entrée principal
 */
async function main() {
    console.log('🚀 Migration PostgreSQL → SQLite pour RAG MCP Server');
    console.log('════════════════════════════════════════════════════════');

    // Vérifier les dépendances
    try {
        await import('pg');
        await import('sqlite3');
    } catch (error) {
        log(`Dépendances manquantes: ${error.message}`, 'error');
        log('Installez les dépendances avec: npm install pg sqlite3', 'error');
        process.exit(1);
    }

    let pool = null;

    try {
        // 1. Se connecter à PostgreSQL
        log('Connexion à PostgreSQL...', 'info');
        pool = new Pool(CONFIG.postgres);

        if (!await checkPostgresConnection(pool)) {
            throw new Error('Impossible de se connecter à PostgreSQL');
        }

        // 2. Vérifier si la table source existe
        if (!await checkPostgresTableExists(pool, 'rag_store')) {
            log('Table rag_store non trouvée dans PostgreSQL', 'warn');
            log('Aucune donnée à migrer', 'info');
            process.exit(0);
        }

        // 3. Créer une sauvegarde de SQLite
        if (!await backupSqliteDatabase()) {
            throw new Error('Échec de la sauvegarde SQLite');
        }

        // 4. Initialiser SQLite
        if (!await initializeSqliteDatabase()) {
            throw new Error('Échec de l\'initialisation SQLite');
        }

        // 5. Migrer les données
        log('Démarrage de la migration des données...', 'info');
        const migrationResult = await migrateData(pool);

        // 6. Valider la migration
        const isValid = await validateMigration(pool);

        // 7. Afficher le rapport
        console.log('\n📊 Rapport de migration:');
        console.log('════════════════════════════════════════════════════════');
        console.log(`   PostgreSQL (source): ${CONFIG.postgres.database}`);
        console.log(`   SQLite (destination): ${CONFIG.sqlite.path}`);
        console.log(`   Enregistrements migrés: ${migrationResult.totalMigrated}`);
        console.log(`   Échecs: ${migrationResult.totalFailed}`);
        console.log(`   Validation: ${isValid ? '✅ Réussie' : '❌ Échouée'}`);
        console.log(`   Sauvegarde: ${CONFIG.backup_enabled ? '✅ Créée' : '❌ Désactivée'}`);

        if (CONFIG.backup_enabled && fs.existsSync(CONFIG.sqlite.backup_path)) {
            console.log(`   Fichier de sauvegarde: ${CONFIG.sqlite.backup_path}`);
        }

        console.log('\n📋 Recommandations:');
        console.log('   1. Mettre à jour db.config.json pour utiliser SQLite');
        console.log('   2. Tester les outils RAG avec la nouvelle base');
        console.log('   3. Supprimer la base PostgreSQL si plus nécessaire');
        console.log('   4. Vérifier les performances de recherche');

        if (!isValid) {
            console.log('\n⚠️  Attention: La validation a échoué.');
            console.log('   Consultez les logs pour plus de détails.');
            process.exit(1);
        }

        console.log('\n✅ Migration terminée avec succès!');

    } catch (error) {
        log(`Erreur fatale: ${error.message}`, 'error');
        console.error(error.stack);
        process.exit(1);
    } finally {
        if (pool) {
            await pool.end();
        }
    }
}

// Exécuter le script
main().catch(error => {
    console.error('❌ Erreur non gérée:', error);
    process.exit(1);
});
