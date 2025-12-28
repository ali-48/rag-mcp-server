#!/usr/bin/env node
// Script pour exécuter tous les tests du projet

import { spawn } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

// Liste des tests à exécuter dans l'ordre
const testFiles = [
  'test-basic.js',
  'test-tool-registry.js',
  'test-batch1.js',
  'test-batch2.js',
  'test-batch3.js',
  'test-rag.js',
  'test-auto-registry.js',
  'test-index-integration.js'
];

// Configuration
const config = {
  timeout: 30000, // 30 secondes par test
  verbose: true
};

// Fonction pour exécuter un test
async function runTest(testFile) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Exécution de ${testFile}...`);
    console.log('─'.repeat(50));
    
    const startTime = Date.now();
    const testProcess = spawn('node', [testFile], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    let stdout = '';
    let stderr = '';

    testProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      if (config.verbose) {
        process.stdout.write(data);
      }
    });

    testProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      if (config.verbose) {
        process.stderr.write(data);
      }
    });

    testProcess.on('close', (code) => {
      const duration = Date.now() - startTime;
      
      if (code === 0) {
        console.log(`\n✅ ${testFile} réussi (${duration}ms)`);
        resolve({
          file: testFile,
          success: true,
          duration,
          stdout,
          stderr
        });
      } else {
        console.log(`\n❌ ${testFile} échoué avec code ${code} (${duration}ms)`);
        if (!config.verbose) {
          console.log('Sortie stderr:', stderr);
        }
        resolve({
          file: testFile,
          success: false,
          duration,
          code,
          stdout,
          stderr
        });
      }
    });

    testProcess.on('error', (error) => {
      reject(error);
    });

    // Timeout
    setTimeout(() => {
      testProcess.kill('SIGTERM');
      console.log(`\n⏰ ${testFile} timeout après ${config.timeout}ms`);
      resolve({
        file: testFile,
        success: false,
        duration: config.timeout,
        timeout: true,
        stdout,
        stderr
      });
    }, config.timeout);
  });
}

// Fonction principale
async function runAllTests() {
  console.log('🧪 LANCEMENT DE TOUS LES TESTS');
  console.log('='.repeat(60));
  console.log(`📋 ${testFiles.length} tests à exécuter\n`);

  const results = [];
  let passed = 0;
  let failed = 0;

  // Exécuter chaque test
  for (const testFile of testFiles) {
    try {
      const result = await runTest(testFile);
      results.push(result);
      
      if (result.success) {
        passed++;
      } else {
        failed++;
      }
      
      // Petite pause entre les tests
      await sleep(500);
    } catch (error) {
      console.error(`❌ Erreur lors de l'exécution de ${testFile}:`, error);
      results.push({
        file: testFile,
        success: false,
        error: error.message
      });
      failed++;
    }
  }

  // Afficher le résumé
  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ DES TESTS');
  console.log('='.repeat(60));

  for (const result of results) {
    const icon = result.success ? '✅' : '❌';
    const status = result.success ? 'PASSÉ' : 'ÉCHOUÉ';
    const details = result.timeout ? ' (timeout)' : result.code ? ` (code: ${result.code})` : '';
    console.log(`${icon} ${result.file}: ${status}${details} (${result.duration}ms)`);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`🎯 TOTAL: ${results.length} tests`);
  console.log(`✅ PASSÉS: ${passed}`);
  console.log(`❌ ÉCHOUÉS: ${failed}`);
  console.log(`📈 TAUX DE RÉUSSITE: ${((passed / results.length) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));

  // Afficher les détails des échecs
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    console.log('\n🔍 DÉTAILS DES ÉCHECS:');
    for (const failure of failures) {
      console.log(`\n📄 ${failure.file}:`);
      if (failure.error) {
        console.log(`   Erreur: ${failure.error}`);
      }
      if (failure.stderr && failure.stderr.trim()) {
        console.log(`   Sortie erreur: ${failure.stderr.substring(0, 500)}...`);
      }
    }
  }

  // Retourner le code de sortie approprié
  if (failed > 0) {
    console.log('\n❌ Certains tests ont échoué');
    process.exit(1);
  } else {
    console.log('\n🎉 Tous les tests ont réussi !');
    process.exit(0);
  }
}

// Gestion des erreurs
runAllTests().catch(error => {
  console.error('❌ Erreur fatale lors de l\'exécution des tests:', error);
  process.exit(1);
});
