import * as fs from 'fs';
import * as path from 'path';
import { Database } from 'sqlite3';
import { promisify } from 'util';

/**
 * Utilitaire d'initialisation des bases de données SQLite centralisées
 * Gère la création et la migration des schémas pour metadata.sqlite et memory.sqlite
 */
export class SqliteInitializer {
  private dbDir: string;

  constructor(dbDir: string = '/rag/db') {
    this.dbDir = dbDir;

    // Assurer que le répertoire existe
    this.ensureDirectoryExists();
  }

  /**
   * Assure l'existence du répertoire des bases de données
   */
  private ensureDirectoryExists(): void {
    try {
      if (!fs.existsSync(this.dbDir)) {
        fs.mkdirSync(this.dbDir, { recursive: true });
        console.log(`📁 Répertoire créé: ${this.dbDir}`);
      }
    } catch (error) {
      console.error(`❌ Erreur création répertoire ${this.dbDir}:`, error);
      throw error;
    }
  }

  /**
   * Ouvre une connexion à une base de données SQLite
   */
  private openDatabase(dbPath: string): Promise<Database> {
    return new Promise((resolve, reject) => {
      const db = new Database(dbPath, (err) => {
        if (err) {
          console.error(`❌ Erreur ouverture ${dbPath}:`, err);
          reject(err);
        } else {
          console.log(`📂 Base de données ouverte: ${dbPath}`);
          resolve(db);
        }
      });
    });
  }

  /**
   * Exécute un script SQL sur une base de données
   */
  private async executeSqlScript(db: Database, scriptPath: string): Promise<void> {
    try {
      if (!fs.existsSync(scriptPath)) {
        throw new Error(`Script SQL non trouvé: ${scriptPath}`);
      }

      const sql = fs.readFileSync(scriptPath, 'utf-8');
      const exec = promisify(db.exec.bind(db));

      // Exécuter le script complet
      await exec(sql);

      console.log(`✅ Script exécuté: ${scriptPath}`);
    } catch (error) {
      console.error(`❌ Erreur exécution script ${scriptPath}:`, error);
      throw error;
    }
  }

  /**
   * Vérifie si une table existe dans la base de données
   */
  private async tableExists(db: Database, tableName: string): Promise<boolean> {
    const get = promisify(db.get.bind(db));

    try {
      const result = await get(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
        [tableName]
      );
      return !!result;
    } catch (error) {
      console.error(`❌ Erreur vérification table ${tableName}:`, error);
      return false;
    }
  }

  /**
   * Ferme une connexion à la base de données
   */
  private closeDatabase(db: Database): Promise<void> {
    return new Promise((resolve, reject) => {
      db.close((err) => {
        if (err) {
          console.error('❌ Erreur fermeture base de données:', err);
          reject(err);
        } else {
          console.log('📂 Base de données fermée');
          resolve();
        }
      });
    });
  }

  /**
   * Initialise la base de données metadata.sqlite
   * @param force Forcer la réinitialisation même si la base existe déjà
   */
  async initializeMetadataDb(force: boolean = false): Promise<void> {
    const dbPath = path.join(this.dbDir, 'metadata.sqlite');
    const scriptPath = path.join(__dirname, '../../../scripts/create_metadata_sqlite.sql');

    console.log(`🚀 Initialisation metadata.sqlite: ${dbPath}`);

    try {
      // Vérifier si la base existe déjà
      const dbExists = fs.existsSync(dbPath);

      if (dbExists && !force) {
        // Vérifier si les tables principales existent
        const db = await this.openDatabase(dbPath);
        const projectsExists = await this.tableExists(db, 'projects');
        await this.closeDatabase(db);

        if (projectsExists) {
          console.log('✅ metadata.sqlite déjà initialisée, skip');
          return;
        }
      }

      // Supprimer l'ancienne base si force=true
      if (force && dbExists) {
        fs.unlinkSync(dbPath);
        console.log('🗑️ Ancienne base metadata.sqlite supprimée');
      }

      // Créer la nouvelle base et exécuter le script
      const db = await this.openDatabase(dbPath);
      await this.executeSqlScript(db, scriptPath);

      // Vérifier la création des tables
      const tables = ['projects', 'files', 'index_status'];
      for (const table of tables) {
        const exists = await this.tableExists(db, table);
        if (!exists) {
          throw new Error(`Table ${table} non créée`);
        }
      }

      await this.closeDatabase(db);

      console.log('✅ metadata.sqlite initialisée avec succès');
    } catch (error) {
      console.error('❌ Erreur initialisation metadata.sqlite:', error);
      throw error;
    }
  }

  /**
   * Initialise la base de données memory.sqlite
   * @param force Forcer la réinitialisation même si la base existe déjà
   */
  async initializeMemoryDb(force: boolean = false): Promise<void> {
    const dbPath = path.join(this.dbDir, 'memory.sqlite');
    const scriptPath = path.join(__dirname, '../../../scripts/create_memory_sqlite.sql');

    console.log(`🚀 Initialisation memory.sqlite: ${dbPath}`);

    try {
      // Vérifier si la base existe déjà
      const dbExists = fs.existsSync(dbPath);

      if (dbExists && !force) {
        // Vérifier si les tables principales existent
        const db = await this.openDatabase(dbPath);
        const cacheExists = await this.tableExists(db, 'cache');
        await this.closeDatabase(db);

        if (cacheExists) {
          console.log('✅ memory.sqlite déjà initialisée, skip');
          return;
        }
      }

      // Supprimer l'ancienne base si force=true
      if (force && dbExists) {
        fs.unlinkSync(dbPath);
        console.log('🗑️ Ancienne base memory.sqlite supprimée');
      }

      // Créer la nouvelle base et exécuter le script
      const db = await this.openDatabase(dbPath);
      await this.executeSqlScript(db, scriptPath);

      // Vérifier la création des tables
      const tables = ['cache', 'context_history', 'active_sessions'];
      for (const table of tables) {
        const exists = await this.tableExists(db, table);
        if (!exists) {
          throw new Error(`Table ${table} non créée`);
        }
      }

      await this.closeDatabase(db);

      console.log('✅ memory.sqlite initialisée avec succès');
    } catch (error) {
      console.error('❌ Erreur initialisation memory.sqlite:', error);
      throw error;
    }
  }

  /**
   * Initialise les deux bases de données (metadata et memory)
   */
  async initializeAll(force: boolean = false): Promise<void> {
    console.log('🚀 Initialisation de toutes les bases de données SQLite');

    try {
      await this.initializeMetadataDb(force);
      await this.initializeMemoryDb(force);

      console.log('✅ Toutes les bases de données SQLite initialisées');
    } catch (error) {
      console.error('❌ Erreur initialisation bases de données:', error);
      throw error;
    }
  }

  /**
   * Vérifie l'état des bases de données
   */
  async checkDatabaseStatus(): Promise<{
    metadata: { exists: boolean; tables: number };
    memory: { exists: boolean; tables: number };
  }> {
    const metadataPath = path.join(this.dbDir, 'metadata.sqlite');
    const memoryPath = path.join(this.dbDir, 'memory.sqlite');

    const result = {
      metadata: { exists: false, tables: 0 },
      memory: { exists: false, tables: 0 }
    };

    try {
      // Vérifier metadata.sqlite
      if (fs.existsSync(metadataPath)) {
        result.metadata.exists = true;
        const db = await this.openDatabase(metadataPath);
        const get = promisify(db.get.bind(db));
        const tablesResult = await get(
          "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'"
        );
        result.metadata.tables = (tablesResult as any)?.count || 0;
        await this.closeDatabase(db);
      }

      // Vérifier memory.sqlite
      if (fs.existsSync(memoryPath)) {
        result.memory.exists = true;
        const db = await this.openDatabase(memoryPath);
        const get = promisify(db.get.bind(db));
        const tablesResult = await get(
          "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'"
        );
        result.memory.tables = (tablesResult as any)?.count || 0;
        await this.closeDatabase(db);
      }
    } catch (error) {
      console.error('❌ Erreur vérification état bases de données:', error);
    }

    return result;
  }

  /**
   * Sauvegarde les bases de données
   */
  async backupDatabases(backupDir: string): Promise<void> {
    console.log(`💾 Sauvegarde bases de données vers: ${backupDir}`);

    try {
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const metadataPath = path.join(this.dbDir, 'metadata.sqlite');
      const memoryPath = path.join(this.dbDir, 'memory.sqlite');

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      if (fs.existsSync(metadataPath)) {
        const backupPath = path.join(backupDir, `metadata_${timestamp}.sqlite`);
        fs.copyFileSync(metadataPath, backupPath);
        console.log(`✅ metadata.sqlite sauvegardée: ${backupPath}`);
      }

      if (fs.existsSync(memoryPath)) {
        const backupPath = path.join(backupDir, `memory_${timestamp}.sqlite`);
        fs.copyFileSync(memoryPath, backupPath);
        console.log(`✅ memory.sqlite sauvegardée: ${backupPath}`);
      }

      console.log('✅ Sauvegarde terminée');
    } catch (error) {
      console.error('❌ Erreur sauvegarde bases de données:', error);
      throw error;
    }
  }

  /**
   * Nettoie les anciennes sauvegardes
   */
  cleanupOldBackups(backupDir: string, maxAgeDays: number = 7): void {
    try {
      if (!fs.existsSync(backupDir)) {
        return;
      }

      const files = fs.readdirSync(backupDir);
      const now = Date.now();
      const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

      for (const file of files) {
        if (file.endsWith('.sqlite')) {
          const filePath = path.join(backupDir, file);
          const stats = fs.statSync(filePath);
          const ageMs = now - stats.mtimeMs;

          if (ageMs > maxAgeMs) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Sauvegarde supprimée: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Erreur nettoyage sauvegardes:', error);
    }
  }
}

// Export singleton pour une utilisation facile
let instance: SqliteInitializer | null = null;

export function getSqliteInitializer(dbDir?: string): SqliteInitializer {
  if (!instance) {
    instance = new SqliteInitializer(dbDir);
  }
  return instance;
}
