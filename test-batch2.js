// Test d'intégration pour Batch 2 des outils graph
import { initializeGraphToolsBatch2, testGraphToolsBatch2 } from './build/tools/graph/register-graph-tools-batch2.js';
import { initializeGraphToolsBatch1 } from './build/tools/graph/register-graph-tools.js';

async function runBatch2Tests() {
  console.log('🚀 Début des tests Batch 2 (Outils Graph - Suppression)...\n');

  try {
    // Initialiser les outils Batch 1 (nécessaires pour les tests)
    console.log('Étape 1: Initialisation des outils Batch 1...');
    initializeGraphToolsBatch1();
    
    // Initialiser les outils Batch 2
    console.log('\nÉtape 2: Initialisation des outils Batch 2...');
    initializeGraphToolsBatch2();
    
    console.log('\nÉtape 3: Test d\'intégration...');
    const success = await testGraphToolsBatch2();
    
    if (success) {
      console.log('\n🎉 Tous les tests Batch 2 ont réussi !');
      console.log('✅ delete_entities fonctionne');
      console.log('✅ delete_observations fonctionne');
      console.log('✅ delete_relations fonctionne');
      console.log('\n📊 Résumé:');
      console.log('- 3 outils de suppression migrés avec succès');
      console.log('- ToolRegistry fonctionnel avec 6 outils au total');
      console.log('- Tests d\'intégration passants');
      console.log('- Interaction entre Batch 1 et Batch 2 validée');
    } else {
      console.error('\n❌ Certains tests Batch 2 ont échoué');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Erreur lors des tests Batch 2:', error);
    process.exit(1);
  }
}

// Exécuter les tests
runBatch2Tests().catch(error => {
  console.error('❌ Erreur non gérée:', error);
  process.exit(1);
});
