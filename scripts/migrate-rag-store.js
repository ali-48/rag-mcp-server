#!/usr/bin/env node

// Script de migration depuis rag_store vers rag_store_v2
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration de la connexion PostgreSQL (identique à vector-store.ts)
const pool = new Pool({
  host: "localhost",
  port: 16432,
  database: "rag_mcp_dedicated",
  user: "rag_user",
  password: "secure_rag_password",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

console.log('🚀 Script de migration rag_store → rag_store_v2\n');

async function checkTableExists(tableName) {
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
    console.error(`Erreur lors de la vérification de la table ${tableName}:`, error.message);
    return false;
  }
}

async function getTableStats(tableName) {
  try {
    const result = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    return parseInt(result.rows[0].count) || 0;
  } catch (error) {
    console.error(`Erreur lors de la récupération des stats pour ${tableName}:`, error.message);
    return 0;
  }
}

async function getContentTypeDistribution(tableName) {
  try {
    const result = await pool.query(
      `SELECT content_type, COUNT(*) as count 
       FROM ${tableName} 
       GROUP BY content_type 
       ORDER BY count DESC`
    );
    return result.rows;
  } catch (error) {
    console.error(`Erreur lors de la récupération de la distribution pour ${tableName}:`, error.message);
    return [];
  }
}

async function runMigration() {
  console.log('📊 Analyse des tables existantes...');
  
  const oldTableExists = await checkTableExists('rag_store');
  const newTableExists = await checkTableExists('rag_store_v2');
  
  if (!oldTableExists) {
    console.log('❌ Table rag_store non trouvée. Aucune migration nécessaire.');
    return;
  }
  
  if (!newTableExists) {
    console.log('❌ Table rag_store_v2 non trouvée. Veuillez d\'abord exécuter create_rag_store_v2.sql');
    return;
  }
  
  const oldCount = await getTableStats('rag_store');
  const newCount = await getTableStats('rag_store_v2');
  
  console.log(`   rag_store: ${oldCount} entrées`);
  console.log(`   rag_store_v2: ${newCount} entrées`);
  
  if (newCount > 0) {
    console.log('\n⚠️  Attention: La table rag_store_v2 contient déjà des données.');
    console.log('   La migration pourrait créer des doublons.');
    
    const response = await askQuestion('Voulez-vous continuer? (oui/non): ');
    if (response.toLowerCase() !== 'oui') {
      console.log('❌ Migration annulée.');
      return;
    }
  }
  
  console.log('\n📋 Détails de la migration:');
  console.log('   Source: rag_store (ancien schéma)');
  console.log('   Cible: rag_store_v2 (nouveau schéma avec métadonnées enrichies)');
  console.log('   Colonnes migrées: id, project_path, file_path, content, vector, created_at, updated_at');
  console.log('   Métadonnées ajoutées: content_type, file_extension, file_size_bytes, lines_count, etc.');
  console.log('   Règles de typage:');
  console.log('     - .md/.txt → doc');
  console.log('     - .js/.ts/.py → code');
  console.log('     - .json/.yaml/.yml → config');
  console.log('     - autres → other');
  
  console.log('\n🚀 Démarrage de la migration...');
  
  try {
    // Lire le script SQL de migration
    const migrationSql = fs.readFileSync(
      path.join(__dirname, 'create_rag_store_v2.sql'),
      'utf8'
    );
    
    // Extraire uniquement la partie DO $$ ... END $$; de la migration
    const migrationStart = migrationSql.indexOf('DO $$');
    const migrationEnd = migrationSql.indexOf('END $$;') + 7;
    
    if (migrationStart === -1 || migrationEnd === -1) {
      throw new Error('Script de migration non trouvé dans le fichier SQL');
    }
    
    const migrationScript = migrationSql.substring(migrationStart, migrationEnd);
    
    // Exécuter la migration
    console.log('   Exécution du script de migration...');
    await pool.query(migrationScript);
    
    // Vérifier les résultats
    const finalNewCount = await getTableStats('rag_store_v2');
    const migratedCount = finalNewCount - newCount;
    
    console.log(`\n✅ Migration terminée avec succès!`);
    console.log(`   ${migratedCount} entrées migrées de rag_store vers rag_store_v2`);
    console.log(`   Total dans rag_store_v2: ${finalNewCount} entrées`);
    
    // Afficher la distribution par type de contenu
    const distribution = await getContentTypeDistribution('rag_store_v2');
    if (distribution.length > 0) {
      console.log('\n📊 Distribution par type de contenu:');
      distribution.forEach(row => {
        console.log(`   ${row.content_type}: ${row.count} entrées`);
      });
    }
    
    // Option: vider l'ancienne table (optionnel)
    const cleanup = await askQuestion('\nVoulez-vous vider l\'ancienne table rag_store? (oui/non): ');
    if (cleanup.toLowerCase() === 'oui') {
      await pool.query('DROP TABLE IF EXISTS rag_store CASCADE');
      console.log('🗑️  Table rag_store supprimée.');
    } else {
      console.log('📦 Table rag_store conservée pour référence.');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error.message);
    throw error;
  }
}

function askQuestion(question) {
  return new Promise((resolve) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question(question, (answer) => {
      readline.close();
      resolve(answer);
    });
  });
}

async function main() {
  try {
    // Vérifier la connexion
    await pool.query('SELECT 1');
    console.log('✅ Connexion PostgreSQL établie');
    
    await runMigration();
    
  } catch (error) {
    console.error('❌ Erreur fatale:', error.message);
    console.error('   Vérifiez que:');
    console.error('   1. PostgreSQL est en cours d\'exécution sur localhost:16432');
    console.error('   2. La base de données "rag_mcp_dedicated" existe');
    console.error('   3. L\'utilisateur "rag_user" a les permissions nécessaires');
    console.error('   4. L\'extension pgvector est installée');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
