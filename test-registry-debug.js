// Test de débogage du système d'enregistrement automatique
import { AutoRegistry } from './build/core/registry.js';

async function debugRegistry() {
  console.log('🔍 Débogage du système d\'enregistrement automatique...\n');

  const registry = new AutoRegistry({ verbose: true });

  try {
    // Test 1: Découverte des modules
    console.log('Test 1: Découverte des modules...');
    const modules = await registry.discoverToolModules();
    console.log(`📦 Modules découverts: ${modules.length}`);
    
    for (const { path, module } of modules) {
      console.log(`  📄 ${path}`);
      console.log(`    Exports: ${Object.keys(module).join(', ')}`);
    }

    // Test 2: Extraction des outils
    console.log('\nTest 2: Extraction des outils...');
    let totalTools = 0;
    for (const { path, module } of modules) {
      const tools = registry.extractToolsFromModule(module);
      console.log(`  📄 ${path}: ${tools.length} outils`);
      for (const { tool } of tools) {
        console.log(`    🔧 ${tool.name}`);
      }
      totalTools += tools.length;
    }
    console.log(`📊 Total outils extraits: ${totalTools}`);

    // Test 3: Enregistrement automatique
    console.log('\nTest 3: Enregistrement automatique...');
    const registeredCount = await registry.autoRegister();
    console.log(`✅ Outils enregistrés: ${registeredCount}`);

    // Test 4: Liste des outils enregistrés
    console.log('\nTest 4: Liste des outils enregistrés...');
    const registeredTools = registry.listRegisteredTools();
    console.log(`📋 Outils enregistrés (${registeredTools.length}):`);
    registeredTools.forEach((tool, index) => {
      console.log(`  ${index + 1}. ${tool}`);
    });

  } catch (error) {
    console.error('❌ Erreur lors du débogage:', error);
    console.error('Stack:', error.stack);
  }
}

// Exécuter le débogage
debugRegistry().catch(error => {
  console.error('❌ Erreur non gérée:', error);
  process.exit(1);
});
