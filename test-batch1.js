// Test d'intégration pour Batch 1 des outils graph
import { initializeGraphToolsBatch1, testGraphToolsBatch1 } from './build/tools/graph/register-graph-tools.js';

async function runBatch1Tests() {
  console.log('🚀 Début des tests Batch 1 (Outils Graph)...\n');

  try {
    // Initialiser les outils Batch 1
    console.log('Étape 1: Initialisation des outils...');
    initializeGraphToolsBatch1();
    
    console.log('\nÉtape 2: Test d\'intégration...');
    const success = await testGraphToolsBatch1();
    
    if (success) {
      console.log('\n🎉 Tous les tests Batch 1 ont réussi !');
      console.log('✅ create_entities fonctionne');
      console.log('✅ create_relations fonctionne');
      console.log('✅ add_observations fonctionne');
      console.log('\n📊 Résumé:');
      console.log('- 3 outils migrés avec succès');
      console.log('- ToolRegistry fonctionnel');
      console.log('- Tests d\'intégration passants');
    } else {
      console.error('\n❌ Certains tests Batch 1 ont échoué');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Erreur lors des tests Batch 1:', error);
    process.exit(1);
  }
}

// Exécuter les tests
runBatch1Tests().catch(error => {
  console.error('❌ Erreur non gérée:', error);
  process.exit(1);
});
