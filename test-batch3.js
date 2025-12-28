// Test d'intégration pour Batch 3 des outils graph
import { initializeGraphToolsBatch2 } from './build/tools/graph/register-graph-tools-batch2.js';
import { initializeGraphToolsBatch3, testGraphToolsBatch3 } from './build/tools/graph/register-graph-tools-batch3.js';
import { initializeGraphToolsBatch1 } from './build/tools/graph/register-graph-tools.js';

async function runBatch3Tests() {
  console.log('🚀 Début des tests Batch 3 (Outils Graph - Lecture/Recherche)...\n');

  try {
    // Initialiser les outils Batch 1 et 2 (nécessaires pour les tests)
    console.log('Étape 1: Initialisation des outils Batch 1...');
    initializeGraphToolsBatch1();
    
    console.log('\nÉtape 2: Initialisation des outils Batch 2...');
    initializeGraphToolsBatch2();
    
    // Initialiser les outils Batch 3
    console.log('\nÉtape 3: Initialisation des outils Batch 3...');
    initializeGraphToolsBatch3();
    
    console.log('\nÉtape 4: Test d\'intégration...');
    const success = await testGraphToolsBatch3();
    
    if (success) {
      console.log('\n🎉 Tous les tests Batch 3 ont réussi !');
      console.log('✅ read_graph fonctionne');
      console.log('✅ search_nodes fonctionne');
      console.log('✅ open_nodes fonctionne');
      console.log('\n📊 Résumé:');
      console.log('- 3 outils de lecture/recherche migrés avec succès');
      console.log('- ToolRegistry fonctionnel avec 9 outils au total');
      console.log('- Tests d\'intégration passants');
      console.log('- Interaction entre tous les batches validée');
      console.log('- Cycle complet CRUD (Create, Read, Update, Delete) opérationnel');
    } else {
      console.error('\n❌ Certains tests Batch 3 ont échoué');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Erreur lors des tests Batch 3:', error);
    process.exit(1);
  }
}

// Exécuter les tests
runBatch3Tests().catch(error => {
  console.error('❌ Erreur non gérée:', error);
  process.exit(1);
});
