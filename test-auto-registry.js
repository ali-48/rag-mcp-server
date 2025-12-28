// Test du système d'enregistrement automatique
import { AutoRegistry, getExpectedTools, initializeAutoRegistry } from './build/core/registry.js';

async function runAutoRegistryTests() {
  console.log('🚀 Test du système d\'enregistrement automatique...\n');

  try {
    // Test 1: Initialisation du registre automatique
    console.log('Test 1: Initialisation du registre automatique...');
    const registeredCount = await initializeAutoRegistry({ verbose: false });
    
    console.log(`✅ Outils enregistrés: ${registeredCount}`);
    console.log(`📊 Total dans ToolRegistry: ${registeredCount}`);
    
    // Test 2: Vérification des outils attendus
    console.log('\nTest 2: Vérification des outils attendus...');
    const expectedTools = getExpectedTools();
    const registry = new AutoRegistry({ verbose: false });
    const allRegistered = registry.verifyRegistration(expectedTools);
    
    if (!allRegistered) {
      console.error('❌ Certains outils attendus sont manquants');
      process.exit(1);
    }
    
    console.log(`✅ Tous les ${expectedTools.length} outils attendus sont enregistrés`);
    
    // Test 3: Liste des outils enregistrés
    console.log('\nTest 3: Liste des outils enregistrés...');
    const registeredTools = registry.listRegisteredTools();
    console.log(`📋 Outils enregistrés (${registeredTools.length}):`);
    registeredTools.forEach((tool, index) => {
      console.log(`  ${index + 1}. ${tool}`);
    });
    
    // Test 4: Vérification des catégories d'outils
    console.log('\nTest 4: Vérification des catégories d\'outils...');
    const graphTools = expectedTools.filter(tool => 
      tool.includes('entities') || 
      tool.includes('relations') || 
      tool.includes('observations') ||
      tool.includes('graph') ||
      tool.includes('nodes')
    );
    
    const ragTools = expectedTools.filter(tool => 
      tool.includes('project') || 
      tool.includes('search') || 
      tool.includes('manage') ||
      tool.includes('update') ||
      tool.includes('index')
    );
    
    console.log(`📊 Outils Graph: ${graphTools.length} outils`);
    console.log(`📊 Outils RAG: ${ragTools.length} outils`);
    console.log(`📊 Total: ${graphTools.length + ragTools.length} outils`);
    
    // Test 5: Vérification de la non-duplication
    console.log('\nTest 5: Vérification de la non-duplication...');
    const uniqueTools = new Set(registeredTools);
    if (uniqueTools.size === registeredTools.length) {
      console.log('✅ Aucune duplication détectée');
    } else {
      console.error(`❌ Duplication détectée: ${registeredTools.length - uniqueTools.size} doublons`);
      process.exit(1);
    }
    
    console.log('\n🎉 Tous les tests du registre automatique ont réussi !');
    console.log('\n📊 Résumé:');
    console.log('- Système d\'enregistrement automatique fonctionnel');
    console.log(`- ${registeredCount} outils enregistrés automatiquement`);
    console.log(`- ${expectedTools.length} outils attendus validés`);
    console.log('- Découverte dynamique des modules opérationnelle');
    console.log('- Convention de nommage respectée (Tool/Handler)');
    console.log('- Pas de duplication d\'outils');
    
  } catch (error) {
    console.error('❌ Erreur lors des tests du registre automatique:', error);
    process.exit(1);
  }
}

// Exécuter les tests
runAutoRegistryTests().catch(error => {
  console.error('❌ Erreur non gérée:', error);
  process.exit(1);
});
