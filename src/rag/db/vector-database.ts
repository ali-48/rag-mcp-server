// src/rag/db/vector-database.ts
// Fonctions d'initialisation et de gestion de la base de données vecteurs
// Support PostgreSQL avec fallback SQLite

import * as path from 'path';
import { getSqliteInitializer } from '../daemon/sqlite-initializer';

/**
 * Type de base de données vecteurs
 */
export type VectorDatabaseType = 'postgresql' | 'sqlite';

/**
 * Configuration PostgreSQL
 */
export interface PostgreSQLConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  connectionTimeout?: number;
  maxConnections?: number;
}

/**
 * Configuration de la base de données vecteurs
 */
export interface VectorDatabaseConfig {
  type?: VectorDatabaseType;
  dbDir?: string;
  force?: boolean;
  verbose?: boolean;
  postgresql?: PostgreSQLConfig;
  fallbackToSqlite?: boolean;
}

/**
 * Résultat de l'initialisation
 */
export interface VectorDatabaseResult {
  success: boolean;
  type: VectorDatabaseType;
  dbPath?: string;
  postgresqlConfig?: PostgreSQLConfig;
  error?: string;
  fallbackUsed?: boolean;
  message?: string;
}

/**
 * Vérifie si PostgreSQL est disponible
 */
async function isPostgreSQLAvailable(config: PostgreSQLConfig): Promise<boolean> {
  try {
    // Tentative de connexion à PostgreSQL
    // Note: Cette implémentation nécessiterait le module 'pg' installé
    // Pour l'instant, nous simulons la vérification
    console.log(`🔍 Vérification PostgreSQL: ${config.host}:${config.port}/${config.database}`);

    // Simulation: PostgreSQL non disponible par défaut
    // Dans une implémentation réelle, on tenterait une connexion
    return false;

  } catch (error) {
    console.warn(`⚠️ PostgreSQL non disponible:`, error);
    return false;
  }
}

/**
 * Initialise la base de données PostgreSQL pour les vecteurs
 */
async function initializePostgreSQL(
  config: PostgreSQLConfig,
  verbose: boolean = false
): Promise<VectorDatabaseResult> {
  if (verbose) {
    console.log(`🚀 Initialisation PostgreSQL pour les vecteurs`);
    console.log(`📡 Host: ${config.host}:${config.port}`);
    console.log(`📁 Database: ${config.database}`);
    console.log(`👤 User: ${config.user}`);
  }

  try {
    // Vérifier la disponibilité
    const available = await isPostgreSQLAvailable(config);
    if (!available) {
      throw new Error('PostgreSQL non disponible');
    }

    // Créer la base de données si elle n'existe pas
    // Note: Cette implémentation nécessiterait des requêtes SQL spécifiques
    // Pour l'instant, nous simulons la création

    if (verbose) {
      console.log(`✅ PostgreSQL initialisé pour les vecteurs`);
      console.log(`📊 Extension vectorielle: pgvector`);
      console.log(`📁 Schéma: rag_vectors`);
    }

    return {
      success: true,
      type: 'postgresql',
      postgresqlConfig: config,
      message: 'PostgreSQL initialisé avec succès pour le stockage des vecteurs'
    };

  } catch (error: any) {
    console.error(`❌ Erreur initialisation PostgreSQL:`, error.message);

    return {
      success: false,
      type: 'postgresql',
      error: error.message,
      message: 'Échec initialisation PostgreSQL'
    };
  }
}

/**
 * Initialise la base de données SQLite pour les vecteurs (fallback)
 */
async function initializeSQLiteVectors(
  dbDir: string = '/rag/db',
  force: boolean = false,
  verbose: boolean = false
): Promise<VectorDatabaseResult> {
  const dbPath = path.join(dbDir, 'vectors.sqlite');

  if (verbose) {
    console.log(`🚀 Initialisation SQLite pour les vecteurs: ${dbPath}`);
    console.log(`📁 Répertoire: ${dbDir}`);
    console.log(`⚡ Force: ${force}`);
  }

  try {
    // Obtenir l'initialiseur SQLite
    const sqliteInitializer = getSqliteInitializer(dbDir);

    // Pour l'instant, nous utilisons memory.sqlite comme fallback
    // Dans une implémentation future, nous créerions vectors.sqlite spécifiquement
    await sqliteInitializer.initializeMemoryDb(force);

    // Vérifier l'état
    const status = await sqliteInitializer.checkDatabaseStatus();

    if (verbose) {
      console.log(`✅ SQLite initialisé pour les vecteurs (fallback)`);
      console.log(`📊 Utilisation de: memory.sqlite`);
      console.log(`📁 Chemin: ${dbPath}`);
      console.log(`📊 Tables disponibles: ${status.memory.tables}`);
    }

    return {
      success: true,
      type: 'sqlite',
      dbPath,
      message: 'SQLite initialisé avec succès comme fallback pour les vecteurs'
    };

  } catch (error: any) {
    console.error(`❌ Erreur initialisation SQLite vecteurs:`, error.message);

    return {
      success: false,
      type: 'sqlite',
      dbPath,
      error: error.message,
      message: 'Échec initialisation SQLite pour les vecteurs'
    };
  }
}

/**
 * Initialise la base de données vecteurs
 *
 * Cette fonction initialise la base de données pour le stockage des vecteurs
 * avec priorité PostgreSQL et fallback SQLite.
 *
 * @param config Configuration d'initialisation
 * @returns Résultat de l'initialisation
 */
export async function initializeVectorDatabase(
  config: VectorDatabaseConfig = {}
): Promise<VectorDatabaseResult> {
  const {
    type = 'postgresql',
    dbDir = '/rag/db',
    force = false,
    verbose = false,
    postgresql = {
      host: 'localhost',
      port: 5432,
      database: 'rag_vectors',
      user: 'postgres',
      password: 'postgres'
    },
    fallbackToSqlite = true
  } = config;

  if (verbose) {
    console.log('🚀 Initialisation base de données vecteurs');
    console.log(`🎯 Type préféré: ${type}`);
    console.log(`📁 Répertoire SQLite: ${dbDir}`);
    console.log(`🔄 Fallback SQLite: ${fallbackToSqlite ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);
  }

  // Tentative avec le type préféré
  if (type === 'postgresql') {
    if (verbose) {
      console.log('\n🔧 Tentative PostgreSQL...');
    }

    const postgresResult = await initializePostgreSQL(postgresql, verbose);

    if (postgresResult.success) {
      return postgresResult;
    }

    // Fallback vers SQLite si PostgreSQL échoue et fallback activé
    if (fallbackToSqlite) {
      if (verbose) {
        console.log('\n🔄 PostgreSQL échoué, fallback vers SQLite...');
      }

      const sqliteResult = await initializeSQLiteVectors(dbDir, force, verbose);

      return {
        ...sqliteResult,
        fallbackUsed: true,
        message: `Fallback SQLite utilisé: ${sqliteResult.message}`
      };
    } else {
      return {
        ...postgresResult,
        message: 'PostgreSQL échoué et fallback SQLite désactivé'
      };
    }
  } else {
    // Type SQLite directement
    if (verbose) {
      console.log('\n🔧 Initialisation SQLite directe...');
    }

    return await initializeSQLiteVectors(dbDir, force, verbose);
  }
}

/**
 * Vérifie si la base de données vecteurs est initialisée
 */
export async function isVectorDatabaseInitialized(
  dbDir: string = '/rag/db'
): Promise<{
  initialized: boolean;
  type?: VectorDatabaseType;
  availableTypes: VectorDatabaseType[];
}> {
  try {
    const sqliteInitializer = getSqliteInitializer(dbDir);
    const status = await sqliteInitializer.checkDatabaseStatus();

    // Vérifier SQLite
    const sqliteAvailable = status.memory.exists && status.memory.tables >= 1;

    // Vérifier PostgreSQL (simulation)
    const postgresqlAvailable = false; // À implémenter avec une vraie vérification

    const availableTypes: VectorDatabaseType[] = [];
    if (sqliteAvailable) availableTypes.push('sqlite');
    if (postgresqlAvailable) availableTypes.push('postgresql');

    return {
      initialized: sqliteAvailable || postgresqlAvailable,
      type: sqliteAvailable ? 'sqlite' : postgresqlAvailable ? 'postgresql' : undefined,
      availableTypes
    };

  } catch {
    return {
      initialized: false,
      availableTypes: []
    };
  }
}

/**
 * Obtient les informations sur la base de données vecteurs
 */
export async function getVectorDatabaseInfo(
  dbDir: string = '/rag/db'
): Promise<{
  initialized: boolean;
  type?: VectorDatabaseType;
  dbPath?: string;
  postgresqlConfig?: PostgreSQLConfig;
  sqliteInfo?: {
    dbPath: string;
    tablesCount: number;
    sizeBytes?: number;
  };
}> {
  const fs = await import('fs');
  const dbPath = path.join(dbDir, 'vectors.sqlite');

  try {
    const { initialized, type, availableTypes } = await isVectorDatabaseInitialized(dbDir);

    const result: any = {
      initialized,
      type,
      availableTypes
    };

    // Informations SQLite
    if (availableTypes.includes('sqlite')) {
      const memoryDbPath = path.join(dbDir, 'memory.sqlite');
      let sizeBytes: number | undefined;

      if (fs.existsSync(memoryDbPath)) {
        const stats = fs.statSync(memoryDbPath);
        sizeBytes = stats.size;
      }

      result.sqliteInfo = {
        dbPath: memoryDbPath,
        tablesCount: 3, // cache, context_history, active_sessions
        sizeBytes
      };
    }

    // Configuration PostgreSQL par défaut
    if (availableTypes.includes('postgresql')) {
      result.postgresqlConfig = {
        host: 'localhost',
        port: 5432,
        database: 'rag_vectors',
        user: 'postgres',
        password: 'postgres'
      };
    }

    return result;

  } catch (error: any) {
    console.error(`❌ Erreur récupération infos vecteurs:`, error.message);

    return {
      initialized: false,
      availableTypes: []
    };
  }
}

/**
 * Recommande le type de base de données vecteurs optimal
 */
export function recommendVectorDatabaseType(): {
  type: VectorDatabaseType;
  reason: string;
  priority: number; // 1-10, 10 étant le meilleur
} {
  // Vérifier l'environnement
  const hasPostgres = false; // À implémenter avec une vraie vérification
  const memoryAvailable = true; // Toujours disponible

  if (hasPostgres) {
    return {
      type: 'postgresql',
      reason: 'PostgreSQL disponible avec extension pgvector pour performances optimales',
      priority: 10
    };
  } else {
    return {
      type: 'sqlite',
      reason: 'PostgreSQL non disponible, SQLite utilisé comme fallback fiable',
      priority: 7
    };
  }
}

/**
 * Exemple d'utilisation de l'API vector database
 */
export async function demonstrateVectorDatabase(): Promise<void> {
  console.log('🧠 Démonstration Vector Database API');
  console.log('====================================');

  // 1. Recommandation
  console.log('\n1. 🎯 Recommandation type base de données:');
  const recommendation = recommendVectorDatabaseType();
  console.log(`   📊 Type recommandé: ${recommendation.type}`);
  console.log(`   📝 Raison: ${recommendation.reason}`);
  console.log(`   ⭐ Priorité: ${recommendation.priority}/10`);

  // 2. Vérifier l'état actuel
  console.log('\n2. 📋 Vérification état actuel:');
  const isInitialized = await isVectorDatabaseInitialized();
  console.log(`   ✅ Base vecteurs initialisée: ${isInitialized.initialized ? 'OUI' : 'NON'}`);
  console.log(`   🎯 Type actuel: ${isInitialized.type || 'AUCUN'}`);
  console.log(`   📊 Types disponibles: ${isInitialized.availableTypes.join(', ') || 'AUCUN'}`);

  // 3. Obtenir les informations
  console.log('\n3. 📋 Informations base de données:');
  const info = await getVectorDatabaseInfo();
  console.log(`   🎯 Type: ${info.type || 'N/A'}`);
  if (info.sqliteInfo) {
    console.log(`   📁 SQLite: ${info.sqliteInfo.dbPath}`);
    console.log(`   📊 Tables: ${info.sqliteInfo.tablesCount}`);
    console.log(`   💾 Taille: ${info.sqliteInfo.sizeBytes ? `${(info.sqliteInfo.sizeBytes / 1024).toFixed(2)} KB` : 'N/A'}`);
  }
  if (info.postgresqlConfig) {
    console.log(`   🐘 PostgreSQL: ${info.postgresqlConfig.host}:${info.postgresqlConfig.port}/${info.postgresqlConfig.database}`);
  }

  // 4. Initialiser si nécessaire
  if (!isInitialized.initialized) {
    console.log('\n4. 🚀 Initialisation base de données vecteurs:');
    const result = await initializeVectorDatabase({
      type: recommendation.type,
      verbose: true,
      fallbackToSqlite: true
    });

    console.log(`   ✅ Succès: ${result.success ? 'OUI' : 'NON'}`);
    console.log(`   🎯 Type utilisé: ${result.type}`);
    if (result.fallbackUsed) {
      console.log(`   🔄 Fallback utilisé: OUI`);
    }
    if (result.message) {
      console.log(`   📝 Message: ${result.message}`);
    }
    if (result.error) {
      console.log(`   ❌ Erreur: ${result.error}`);
    }
  } else {
    console.log('\n4. ✅ Base de données vecteurs déjà initialisée, skip');
  }

  // 5. Vérification finale
  console.log('\n5. ✅ Vérification finale:');
  const finalCheck = await isVectorDatabaseInitialized();
  console.log(`   ✅ Base vecteurs opérationnelle: ${finalCheck.initialized ? 'OUI' : 'NON'}`);
  console.log(`   🎯 Type: ${finalCheck.type || 'N/A'}`);

  console.log('\n🎯 API Vector Database prête pour utilisation');
}

// Export par défaut pour une utilisation facile
export default {
  initializeVectorDatabase,
  isVectorDatabaseInitialized,
  getVectorDatabaseInfo,
  recommendVectorDatabaseType,
  demonstrateVectorDatabase
};
