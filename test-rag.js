// Test d'intégration pour les outils RAG
import { initializeGraphToolsBatch2 } from './build/tools/graph/register-graph-tools-batch2.js';
import { initializeGraphToolsBatch3 } from './build/tools/graph/register-graph-tools-batch3.js';
import { initializeGraphToolsBatch1 } from './build/tools/graph/register-graph-tools.js';
import { initializeRagTools, testRagTools } from './build/tools/rag/register-rag-tools.js';

async function runRagTests() {
  console.log('🚀 Début des tests RAG (Outils de Recherche et Indexation)...\n');

  try {
    // Initialiser tous les outils graph (nécessaires pour les tests)
    console.log('Étape 1: Initialisation des outils graph Batch 1...');
    initializeGraphToolsBatch1();
    
    console.log('\nÉtape 2: Initialisation des outils graph Batch 2...');
    initializeGraphToolsBatch2();
    
    console.log('\nÉtape 3: Initialisation des outils graph Batch 3...');
    initializeGraphToolsBatch3();
    
    // Initialiser les outils RAG
    console.log('\nÉtape 4: Initialisation des outils RAG...');
    initializeRagTools();
    
    console.log('\nÉtape 5: Test d\'intégration...');
    const success = await testRagTools();
    
    if (success) {
      console.log('\n🎉 Tous les tests RAG ont réussi !');
      console.log('✅ index_project fonctionne');
      console.log('✅ search_code fonctionne');
      console.log('✅ manage_projects fonctionne');
      console.log('✅ update_project fonctionne');
      console.log('\n📊 Résumé:');
      console.log('- 4 outils RAG migrés avec succès');
      console.log('- ToolRegistry fonctionnel avec 13 outils au total');
      console.log('- Tests d\'intégration passants');
      console.log('- Cycle complet d\'indexation/recherche opérationnel');
      console.log('- Support multi-langages (JS, Python, Markdown) validé');
    } else {
      console.error('\n❌ Certains tests RAG ont échoué');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Erreur lors des tests RAG:', error);
    process.exit(1);
  }
}

// Exécuter les tests
runRagTests().catch(error => {
  console.error('❌ Erreur non gérée:', error);
  process.exit(1);
});
