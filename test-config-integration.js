#!/usr/bin/env node
// Test d'intégration de la configuration RAG

import { getRagConfigManager, testRagConfig } from './build/config/rag-config.js';
import { testIndexProject } from './build/tools/rag/index-project.js';
import { testSearchCode } from './build/tools/rag/search-code.js';
import { testUpdateProject } from './build/tools/rag/update-project.js';

async function runAllTests() {
  console.log('🚀 Démarrage des tests d\'intégration RAG');
  console.log('=' .repeat(60));
  
  let allTestsPassed = true;
  
  // Test 1: Configuration RAG
  console.log('\n🧪 Test 1: Configuration RAG');
  console.log('-' .repeat(40));
  try {
    const configTest = await testRagConfig();
    if (configTest) {
      console.log('✅ Test de configuration réussi');
    } else {
      console.log('❌ Test de configuration échoué');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('❌ Test de configuration échoué avec erreur:', error.message);
    allTestsPassed = false;
  }
  
  // Test 2: Gestionnaire de configuration
  console.log('\n🧪 Test 2: Gestionnaire de configuration');
  console.log('-' .repeat(40));
  try {
    const configManager = getRagConfigManager();
    const config = configManager.getConfig();
    const defaults = configManager.getDefaults();
    
    console.log(`📊 Version config: ${config.version}`);
    console.log(`📊 Fournisseur par défaut: ${defaults.embedding_provider}`);
    console.log(`📊 Taille chunk par défaut: ${defaults.chunk_size}`);
    
    // Test des limites
    const chunkSizeLimits = configManager.getLimits('chunk_size');
    console.log(`📊 Limites chunk_size: ${chunkSizeLimits.min}-${chunkSizeLimits.max}`);
    
    // Test validation
    const validValue = configManager.validateValue('chunk_size', 500);
    const invalidValue = configManager.validateValue('chunk_size', 50000);
    console.log(`📊 Validation chunk_size 500: ${validValue ? '✅' : '❌'}`);
    console.log(`📊 Validation chunk_size 50000: ${invalidValue ? '✅' : '❌'} (attendu: false)`);
    
    if (validValue && !invalidValue) {
      console.log('✅ Gestionnaire de configuration fonctionnel');
    } else {
      console.log('❌ Gestionnaire de configuration avec problèmes');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('❌ Gestionnaire de configuration échoué avec erreur:', error.message);
    allTestsPassed = false;
  }
  
  // Test 3: Outil index_project
  console.log('\n🧪 Test 3: Outil index_project');
  console.log('-' .repeat(40));
  try {
    console.log('⚠️  Création projet test temporaire...');
    const result = await testIndexProject();
    if (result) {
      console.log('✅ Test index_project réussi');
    } else {
      console.log('❌ Test index_project échoué');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('❌ Test index_project échoué avec erreur:', error.message);
    allTestsPassed = false;
  }
  
  // Test 4: Outil update_project
  console.log('\n🧪 Test 4: Outil update_project');
  console.log('-' .repeat(40));
  try {
    console.log('⚠️  Création projet test temporaire...');
    const result = await testUpdateProject();
    if (result) {
      console.log('✅ Test update_project réussi');
    } else {
      console.log('❌ Test update_project échoué');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('❌ Test update_project échoué avec erreur:', error.message);
    allTestsPassed = false;
  }
  
  // Test 5: Outil search_code
  console.log('\n🧪 Test 5: Outil search_code');
  console.log('-' .repeat(40));
  try {
    console.log('⚠️  Création projet test temporaire...');
    const result = await testSearchCode();
    if (result) {
      console.log('✅ Test search_code réussi');
    } else {
      console.log('❌ Test search_code échoué');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('❌ Test search_code échoué avec erreur:', error.message);
    allTestsPassed = false;
  }
  
  // Test 6: Test avec valeurs limites
  console.log('\n🧪 Test 6: Valeurs limites');
  console.log('-' .repeat(40));
  try {
    const configManager = getRagConfigManager();
    
    // Test application des limites
    const minChunkSize = configManager.applyLimits('chunk_size', 50); // En dessous du minimum
    const maxChunkSize = configManager.applyLimits('chunk_size', 20000); // Au-dessus du maximum
    const normalChunkSize = configManager.applyLimits('chunk_size', 1500); // Normal
    
    console.log(`📊 chunk_size 50 → ${minChunkSize} (attendu: 100)`);
    console.log(`📊 chunk_size 20000 → ${maxChunkSize} (attendu: 10000)`);
    console.log(`📊 chunk_size 1500 → ${normalChunkSize} (attendu: 1500)`);
    
    if (minChunkSize === 100 && maxChunkSize === 10000 && normalChunkSize === 1500) {
      console.log('✅ Application des limites fonctionnelle');
    } else {
      console.log('❌ Application des limites avec problèmes');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('❌ Test valeurs limites échoué avec erreur:', error.message);
    allTestsPassed = false;
  }
  
  // Résumé
  console.log('\n' + '=' .repeat(60));
  console.log('📋 RÉSUMÉ DES TESTS');
  console.log('=' .repeat(60));
  
  if (allTestsPassed) {
    console.log('🎉 TOUS LES TESTS ONT RÉUSSI !');
    console.log('✅ Configuration RAG intégrée avec succès');
    console.log('✅ Gestionnaire de configuration fonctionnel');
    console.log('✅ Outils RAG utilisent la configuration');
    console.log('✅ Validation des limites opérationnelle');
  } else {
    console.log('⚠️  CERTAINS TESTS ONT ÉCHOUÉ');
    console.log('❌ Vérifiez les erreurs ci-dessus');
  }
  
  return allTestsPassed;
}

// Exécution des tests
runAllTests().then(success => {
  if (success) {
    console.log('\n🚀 Tests d\'intégration terminés avec succès !');
    process.exit(0);
  } else {
    console.log('\n❌ Tests d\'intégration échoués');
    process.exit(1);
  }
}).catch(error => {
  console.error('\n💥 Erreur inattendue lors des tests:', error);
  process.exit(1);
});
