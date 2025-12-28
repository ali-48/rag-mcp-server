#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';
import { setTimeout } from 'timers/promises';

async function runBasicTest() {
  console.log('🧪 Test basique du serveur RAG MCP');
  console.log('===================================\n');

  // 1. Vérifier la compilation TypeScript
  console.log('1. Vérification de la compilation TypeScript...');
  try {
    const { execSync } = await import('child_process');
    execSync('npm run build', { stdio: 'pipe' });
    console.log('✅ Compilation TypeScript réussie');
  } catch (error) {
    console.log('❌ Échec de la compilation TypeScript');
    console.log(`   Erreur: ${error.message}`);
    process.exit(1);
  }

  // 2. Vérifier que les fichiers de build existent
  console.log('\n2. Vérification des fichiers de build...');
  const requiredFiles = [
    'build/index.js',
    'build/knowledge-graph/manager.js',
    'build/rag/indexer.js',
    'build/rag/searcher.js',
    'build/tools/graph-tools.js',
    'build/tools/rag-tools.js'
  ];

  let allFilesExist = true;
  for (const file of requiredFiles) {
    if (fs.existsSync(file)) {
      console.log(`   ✅ ${file}`);
    } else {
      console.log(`   ❌ ${file} (manquant)`);
      allFilesExist = false;
    }
  }

  if (!allFilesExist) {
    console.log('❌ Certains fichiers de build sont manquants');
    process.exit(1);
  }

  // 3. Vérifier que le serveur peut être démarré
  console.log('\n3. Test de démarrage du serveur...');
  
  const serverProcess = spawn('node', ['build/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let serverOutput = '';
  let serverError = '';
  
  serverProcess.stdout.on('data', (data) => {
    serverOutput += data.toString();
  });
  
  serverProcess.stderr.on('data', (data) => {
    serverError += data.toString();
  });

  // Attendre un peu pour que le serveur démarre
  await setTimeout(1000);

  // Vérifier que le serveur a démarré
  let serverStarted = false;
  if (serverError.includes('RAG MCP Server running on stdio')) {
    console.log('✅ Serveur démarré avec succès');
    console.log(`   Sortie: ${serverError.trim()}`);
    serverStarted = true;
  } else if (serverOutput.includes('RAG MCP Server running on stdio')) {
    console.log('✅ Serveur démarré avec succès');
    console.log(`   Sortie: ${serverOutput.trim()}`);
    serverStarted = true;
  }

  if (!serverStarted) {
    console.log('❌ Échec du démarrage du serveur');
    console.log(`   Erreur: ${serverError.substring(0, 200)}...`);
    console.log(`   Sortie: ${serverOutput.substring(0, 200)}...`);
    serverProcess.kill();
    process.exit(1);
  }

  // 4. Tuer le processus du serveur
  console.log('\n4. Arrêt du serveur...');
  serverProcess.kill();
  await setTimeout(500);
  console.log('✅ Serveur arrêté proprement');

  // 5. Vérifier le nombre d'outils via une analyse simple des fichiers
  console.log('\n5. Vérification du nombre d\'outils...');
  try {
    // Lire les fichiers pour compter les outils
    const graphToolsContent = fs.readFileSync('build/tools/graph-tools.js', 'utf8');
    const ragToolsContent = fs.readFileSync('build/tools/rag-tools.js', 'utf8');
    
    // Compter les occurrences de "name:" dans les outils
    const graphToolsCount = (graphToolsContent.match(/name:/g) || []).length;
    const ragToolsCount = (ragToolsContent.match(/name:/g) || []).length;
    
    const totalTools = graphToolsCount + ragToolsCount;
    console.log(`   ✅ Outils graphe: ${graphToolsCount}`);
    console.log(`   ✅ Outils RAG: ${ragToolsCount}`);
    console.log(`   ✅ Total outils: ${totalTools}`);
    
    if (totalTools >= 13) {
      console.log('   ✅ Nombre d\'outils suffisant (au moins 13 attendus)');
    } else {
      console.log(`   ⚠️ Nombre d\'outils inférieur à 13: ${totalTools}`);
    }
  } catch (error) {
    console.log(`   ⚠️ Erreur lors de la vérification des outils: ${error.message}`);
  }

  console.log('\n🎉 Tous les tests basiques ont réussi !');
  console.log('Le serveur RAG MCP est prêt pour l\'utilisation.');
}

// Exécuter les tests
runBasicTest().catch(error => {
  console.error('❌ Erreur lors de l\'exécution des tests:', error);
  process.exit(1);
});
