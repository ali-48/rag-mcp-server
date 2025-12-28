// Test d'intégration du point d'entrée principal
import { initializeAutoRegistry } from './build/core/registry.js';
import { toolRegistry } from './build/core/tool-registry.js';

async function testIndexIntegration() {
  console.log('🧪 Test d\'intégration du point d\'entrée principal...\n');

  try {
    // Test 1: Initialisation du registre automatique
    console.log('Test 1: Initialisation du registre automatique...');
    const registeredCount = await initializeAutoRegistry({ verbose: false });
    console.log(`✅ Outils enregistrés: ${registeredCount}`);

    // Test 2: Vérification des outils disponibles
    console.log('\nTest 2: Vérification des outils disponibles...');
    const tools = toolRegistry.getTools();
    console.log(`📊 Total outils dans ToolRegistry: ${tools.length}`);
    
    // Catégoriser les outils
    const graphTools = tools.filter(tool => 
      tool.name.includes('_entities') || 
      tool.name.includes('_relations') || 
      tool.name.includes('_observations') ||
      tool.name.includes('_graph') ||
      tool.name.includes('_nodes')
    );
    
    const ragTools = tools.filter(tool => 
      tool.name.includes('_project') || 
      tool.name.includes('_code')
    );
    
    console.log(`📊 Graph tools: ${graphTools.length}`);
    console.log(`📊 RAG tools: ${ragTools.length}`);

    // Test 3: Vérification des outils attendus
    console.log('\nTest 3: Vérification des outils attendus...');
    const expectedTools = [
      'create_entities',
      'create_relations',
      'add_observations',
      'delete_entities',
      'delete_observations',
      'delete_relations',
      'read_graph',
      'search_nodes',
      'open_nodes',
      'index_project',
      'search_code',
      'manage_projects',
      'update_project'
    ];

    const missingTools = [];
    for (const toolName of expectedTools) {
      if (!toolRegistry.hasTool(toolName)) {
        missingTools.push(toolName);
      }
    }

    if (missingTools.length > 0) {
      console.error(`❌ Outils manquants: ${missingTools.join(', ')}`);
      return false;
    }

    console.log(`✅ Tous les ${expectedTools.length} outils attendus sont disponibles`);

    // Test 4: Test d'exécution d'un outil simple
    console.log('\nTest 4: Test d\'exécution d\'un outil simple...');
    try {
      const result = await toolRegistry.execute('read_graph', {});
      console.log(`✅ Outil 'read_graph' exécuté avec succès`);
      console.log(`📊 Résultat: ${JSON.stringify(result, null, 2).substring(0, 200)}...`);
    } catch (error) {
      console.log(`⚠️ Outil 'read_graph' a échoué (attendu si pas de données): ${error.message}`);
    }

    // Test 5: Test d'exécution d'un outil avec paramètres invalides
    console.log('\nTest 5: Test d\'exécution avec paramètres invalides...');
    try {
      await toolRegistry.execute('create_entities', {});
      console.error('❌ L\'outil aurait dû échouer avec des paramètres invalides');
      return false;
    } catch (error) {
      console.log(`✅ L\'outil a correctement échoué avec l\'erreur: ${error.message}`);
    }

    // Test 6: Vérification de la structure des outils
    console.log('\nTest 6: Vérification de la structure des outils...');
    const firstTool = tools[0];
    if (!firstTool.name || !firstTool.description || !firstTool.inputSchema) {
      console.error('❌ Structure d\'outil invalide');
      return false;
    }
    console.log(`✅ Structure d\'outil valide pour: ${firstTool.name}`);

    console.log('\n🎉 Tous les tests d\'intégration ont réussi !');
    console.log('\n📊 Résumé:');
    console.log(`- Outils enregistrés: ${registeredCount}`);
    console.log(`- Outils disponibles: ${tools.length}`);
    console.log(`- Outils Graph: ${graphTools.length}`);
    console.log(`- Outils RAG: ${ragTools.length}`);
    console.log(`- Système ToolRegistry fonctionnel`);
    console.log(`- Point d\'entrée prêt pour MCP`);

    return true;

  } catch (error) {
    console.error('❌ Erreur lors du test d\'intégration:', error);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Exécuter le test
testIndexIntegration().then(success => {
  if (success) {
    console.log('\n✅ Point d\'entrée principal prêt pour la production');
    process.exit(0);
  } else {
    console.error('\n❌ Le point d\'entrée principal nécessite des corrections');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Erreur non gérée:', error);
  process.exit(1);
});
