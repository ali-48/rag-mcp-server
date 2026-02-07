// src/rag/db/metadata-database.ts
// Fonctions d'initialisation et de gestion de la base de données metadata.sqlite

import * as path from 'path';
import { getSqliteInitializer } from '../daemon/sqlite-initializer';

/**
 * Configuration de la base de données metadata
 */
export interface MetadataDatabaseConfig {
  dbDir?: string;
  force?: boolean;
  verbose?: boolean;
}

/**
 * Résultat de l'initialisation
 */
export interface MetadataDatabaseResult {
  success: boolean;
  dbPath: string;
  tables: string[];
  error?: string;
  status?: {
    metadata: { exists: boolean; tables: number };
    memory: { exists: boolean; tables: number };
  };
}

/**
 * Initialise la base de données metadata.sqlite
 *
 * Cette fonction initialise la base de données centralisée metadata.sqlite
 * qui contient les métadonnées des projets, fichiers, et statut d'indexation.
 *
 * @param config Configuration d'initialisation
 * @returns Résultat de l'initialisation
 */
export async function initializeMetadataDatabase(
  config: MetadataDatabaseConfig = {}
): Promise<MetadataDatabaseResult> {
  const {
    dbDir = '/rag/db',
    force = false,
    verbose = false
  } = config;

  const dbPath = path.join(dbDir, 'metadata.sqlite');

  if (verbose) {
    console.log(`🚀 Initialisation metadata.sqlite: ${dbPath}`);
    console.log(`📁 Répertoire: ${dbDir}`);
    console.log(`⚡ Force: ${force}`);
  }

  try {
    // Obtenir l'initialiseur SQLite
    const sqliteInitializer = getSqliteInitializer(dbDir);

    // Initialiser la base de données metadata
    await sqliteInitializer.initializeMetadataDb(force);

    // Vérifier l'état des bases de données
    const status = await sqliteInitializer.checkDatabaseStatus();

    // Liste des tables attendues dans metadata.sqlite
    const expectedTables = ['projects', 'files', 'index_status'];
    const actualTables = status.metadata.tables;

    if (verbose) {
      console.log(`✅ metadata.sqlite initialisée avec succès`);
      console.log(`📊 Tables créées: ${actualTables}`);
      console.log(`📁 Chemin: ${dbPath}`);
    }

    return {
      success: true,
      dbPath,
      tables: expectedTables,
      status
    };

  } catch (error: any) {
    console.error(`❌ Erreur initialisation metadata.sqlite:`, error.message);

    return {
      success: false,
      dbPath,
      tables: [],
      error: error.message,
      status: {
        metadata: { exists: false, tables: 0 },
        memory: { exists: false, tables: 0 }
      }
    };
  }
}

/**
 * Vérifie si la base de données metadata est initialisée
 */
export async function isMetadataDatabaseInitialized(
  dbDir: string = '/rag/db'
): Promise<boolean> {
  try {
    const sqliteInitializer = getSqliteInitializer(dbDir);
    const status = await sqliteInitializer.checkDatabaseStatus();

    return status.metadata.exists && status.metadata.tables >= 3; // Au moins 3 tables attendues
  } catch {
    return false;
  }
}

/**
 * Obtient les informations détaillées sur la base de données metadata
 */
export async function getMetadataDatabaseInfo(
  dbDir: string = '/rag/db'
): Promise<{
  initialized: boolean;
  dbPath: string;
  tablesCount: number;
  tables: string[];
  sizeBytes?: number;
  lastModified?: Date;
}> {
  const dbPath = path.join(dbDir, 'metadata.sqlite');
  const fs = await import('fs');

  try {
    const sqliteInitializer = getSqliteInitializer(dbDir);
    const status = await sqliteInitializer.checkDatabaseStatus();

    // Obtenir la liste des tables
    const tables: string[] = [];
    if (status.metadata.exists) {
      // Note: Pour obtenir la liste exacte des tables, nous aurions besoin
      // d'une méthode supplémentaire dans SqliteInitializer
      // Pour l'instant, nous retournons les tables attendues
      tables.push('projects', 'files', 'index_status');
    }

    // Obtenir les informations de fichier
    let sizeBytes: number | undefined;
    let lastModified: Date | undefined;

    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      sizeBytes = stats.size;
      lastModified = stats.mtime;
    }

    return {
      initialized: status.metadata.exists && status.metadata.tables >= 3,
      dbPath,
      tablesCount: status.metadata.tables,
      tables,
      sizeBytes,
      lastModified
    };

  } catch (error: any) {
    console.error(`❌ Erreur récupération infos metadata.sqlite:`, error.message);

    return {
      initialized: false,
      dbPath,
      tablesCount: 0,
      tables: [],
      sizeBytes: undefined,
      lastModified: undefined
    };
  }
}

/**
 * Réinitialise complètement la base de données metadata
 *
 * Attention: Cette fonction supprime et recrée la base de données
 *
 * @param dbDir Répertoire des bases de données
 * @param backupDir Répertoire de sauvegarde (optionnel)
 */
export async function resetMetadataDatabase(
  dbDir: string = '/rag/db',
  backupDir?: string
): Promise<MetadataDatabaseResult> {
  console.log(`🔄 Réinitialisation metadata.sqlite: ${path.join(dbDir, 'metadata.sqlite')}`);

  try {
    const sqliteInitializer = getSqliteInitializer(dbDir);

    // Sauvegarder si demandé
    if (backupDir) {
      await sqliteInitializer.backupDatabases(backupDir);
      console.log(`💾 Sauvegarde créée dans: ${backupDir}`);
    }

    // Réinitialiser avec force=true
    await sqliteInitializer.initializeMetadataDb(true);

    // Vérifier l'état
    const status = await sqliteInitializer.checkDatabaseStatus();

    console.log(`✅ metadata.sqlite réinitialisée avec succès`);
    console.log(`📊 Tables: ${status.metadata.tables}`);

    return {
      success: true,
      dbPath: path.join(dbDir, 'metadata.sqlite'),
      tables: ['projects', 'files', 'index_status'],
      status
    };

  } catch (error: any) {
    console.error(`❌ Erreur réinitialisation metadata.sqlite:`, error.message);

    return {
      success: false,
      dbPath: path.join(dbDir, 'metadata.sqlite'),
      tables: [],
      error: error.message
    };
  }
}

/**
 * Exemple d'utilisation de l'API metadata database
 */
export async function demonstrateMetadataDatabase(): Promise<void> {
  console.log('📊 Démonstration Metadata Database API');
  console.log('======================================');

  // 1. Vérifier l'état actuel
  console.log('\n1. 📋 Vérification état actuel:');
  const isInitialized = await isMetadataDatabaseInitialized();
  console.log(`   ✅ metadata.sqlite initialisée: ${isInitialized ? 'OUI' : 'NON'}`);

  // 2. Obtenir les informations
  console.log('\n2. 📋 Informations base de données:');
  const info = await getMetadataDatabaseInfo();
  console.log(`   📁 Chemin: ${info.dbPath}`);
  console.log(`   📊 Tables: ${info.tablesCount}`);
  console.log(`   💾 Taille: ${info.sizeBytes ? `${(info.sizeBytes / 1024).toFixed(2)} KB` : 'N/A'}`);
  console.log(`   🕐 Dernière modification: ${info.lastModified?.toISOString() || 'N/A'}`);

  // 3. Initialiser si nécessaire
  if (!isInitialized) {
    console.log('\n3. 🚀 Initialisation metadata.sqlite:');
    const result = await initializeMetadataDatabase({ verbose: true });
    console.log(`   ✅ Succès: ${result.success ? 'OUI' : 'NON'}`);
    if (result.error) {
      console.log(`   ❌ Erreur: ${result.error}`);
    }
  } else {
    console.log('\n3. ✅ metadata.sqlite déjà initialisée, skip');
  }

  // 4. Vérification finale
  console.log('\n4. ✅ Vérification finale:');
  const finalCheck = await isMetadataDatabaseInitialized();
  console.log(`   ✅ metadata.sqlite opérationnelle: ${finalCheck ? 'OUI' : 'NON'}`);

  console.log('\n🎯 API Metadata Database prête pour utilisation');
}

// Export par défaut pour une utilisation facile
export default {
  initializeMetadataDatabase,
  isMetadataDatabaseInitialized,
  getMetadataDatabaseInfo,
  resetMetadataDatabase,
  demonstrateMetadataDatabase
};
