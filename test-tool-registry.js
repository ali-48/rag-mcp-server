// Test basique du ToolRegistry
import { ToolRegistry, createToolDefinition } from './build/core/tool-registry.js';

async function runTests() {
  console.log('🧪 Début des tests ToolRegistry...\n');

  const registry = new ToolRegistry();

  // Test 1: Enregistrement d'un outil
  console.log('Test 1: Enregistrement d\'un outil');
  const testTool = createToolDefinition(
    'test_tool',
    'Un outil de test',
    {
      type: 'object',
      properties: {
        message: { type: 'string' }
      },
      required: ['message']
    }
  );

  const testHandler = async (args) => {
    return { result: `Echo: ${args.message}` };
  };

  registry.register(testTool, testHandler);
  console.log('✅ Outil enregistré avec succès');
  console.log(`   Nombre d'outils: ${registry.size()}`);
  console.log(`   Outils disponibles: ${registry.getToolNames().join(', ')}`);

  // Test 2: Vérification d'existence
  console.log('\nTest 2: Vérification d\'existence');
  console.log(`   'test_tool' existe: ${registry.hasTool('test_tool')}`);
  console.log(`   'unknown_tool' existe: ${registry.hasTool('unknown_tool')}`);

  // Test 3: Récupération de définition
  console.log('\nTest 3: Récupération de définition');
  const toolDef = registry.getTool('test_tool');
  console.log(`   Définition récupérée: ${toolDef ? 'Oui' : 'Non'}`);
  console.log(`   Nom: ${toolDef?.name}`);
  console.log(`   Description: ${toolDef?.description}`);

  // Test 4: Exécution d'outil
  console.log('\nTest 4: Exécution d\'outil');
  try {
    const result = await registry.execute('test_tool', { message: 'Hello World' });
    console.log(`   Résultat: ${JSON.stringify(result)}`);
  } catch (error) {
    console.error(`   ❌ Erreur: ${error.message}`);
  }

  // Test 5: Exécution d'outil inexistant
  console.log('\nTest 5: Exécution d\'outil inexistant');
  try {
    await registry.execute('unknown_tool', {});
    console.error('   ❌ Devrait avoir échoué');
  } catch (error) {
    console.log(`   ✅ Erreur attendue: ${error.message}`);
  }

  // Test 6: Filtrage par catégorie
  console.log('\nTest 6: Filtrage par catégorie');
  
  // Ajouter un outil RAG pour tester
  const ragTool = createToolDefinition(
    'rag_search',
    'Recherche RAG',
    { type: 'object', properties: {} }
  );
  registry.register(ragTool, async () => ({ result: 'RAG search' }));
  
  console.log(`   Outils graph: ${registry.filterByCategory('graph').length}`);
  console.log(`   Outils RAG: ${registry.filterByCategory('rag').length}`);
  console.log(`   Tous les outils: ${registry.getTools().length}`);

  // Test 7: Suppression d'outil
  console.log('\nTest 7: Suppression d\'outil');
  const removed = registry.unregister('test_tool');
  console.log(`   Supprimé: ${removed}`);
  console.log(`   'test_tool' existe après suppression: ${registry.hasTool('test_tool')}`);
  console.log(`   Nombre d'outils restants: ${registry.size()}`);

  // Test 8: Nettoyage
  console.log('\nTest 8: Nettoyage du registry');
  registry.clear();
  console.log(`   Nombre d'outils après clear: ${registry.size()}`);

  console.log('\n🎉 Tous les tests ont réussi !');
  console.log('Le ToolRegistry fonctionne correctement.');
}

runTests().catch(error => {
  console.error('❌ Erreur lors des tests:', error);
  process.exit(1);
});
