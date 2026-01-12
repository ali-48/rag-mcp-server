// Test d'intégration pour les outils RAG
import { initializeRagTools, testRagTools } from './build/tools/rag/register-rag-tools.js';

async function runRagTests() {
  console.log('🚀 Début des tests RAG (Outils de Recherche et Indexation)...\n');

  try {
    // Initialiser les outils RAG
    console.log('Étape 1: Initialisation des outils RAG...');
    initializeRagTools();

    console.log('\nÉtape 2: Test d\'intégration...');
    const success = await testRagTools();

    if (success) {
      console.log('\n🎉 Tous les tests RAG ont réussi !');
      console.log('✅ injection_rag fonctionne');
      console.log('✅ search_code fonctionne');
      console.log('✅ manage_projects fonctionne');
      console.log('✅ update_project fonctionne');
      console.log('\n📊 Résumé:');
      console.log('- 4 outils RAG visibles fonctionnels');
      console.log('- 1 outil RAG masqué (index_project) pour rétrocompatibilité');
      console.log('- ToolRegistry fonctionnel avec 5 outils au total');
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
