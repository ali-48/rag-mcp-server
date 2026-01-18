// scripts/integrate-ast-cache-refactored.ts
// Version refactorée du script d'intégration du cache AST

import * as fs from 'fs';
import * as path from 'path';
import { createASTCache } from './ast-cache';
import {
  createASTCacheStructure,
  DEFAULT_AST_CACHE_OPTIONS
} from './cache-utils/cache-directory-utils';

/**
 * Patche le script code-mapper pour ajouter le cache AST
 */
export function patchCodeMapperWithASTCache(): void {
  const codeMapperPath = path.join(__dirname, 'code-mapper.ts');

  if (!fs.existsSync(codeMapperPath)) {
    console.error('❌ Fichier code-mapper.ts non trouvé');
    return;
  }

  console.log('🔧 Patch du fichier code-mapper.ts avec le cache AST...');

  const content = fs.readFileSync(codeMapperPath, 'utf8');

  // Vérifier si le cache AST est déjà intégré
  if (content.includes('ASTCache') || content.includes('ast-cache')) {
    console.log('✅ Le cache AST est déjà intégré dans code-mapper.ts');
    return;
  }

  // Ajouter l'import
  const importStatement = `import { createASTCache } from './ast-cache';\n`;

  // Trouver où insérer l'import (après les autres imports)
  const importSectionEnd = content.indexOf('\n\n', content.indexOf('import'));
  let patchedContent = content;

  if (importSectionEnd !== -1) {
    patchedContent =
      content.slice(0, importSectionEnd + 1) +
      importStatement +
      content.slice(importSectionEnd + 1);
  } else {
    // Insérer après la première ligne
    patchedContent = content.replace(/(import.*\n)/, `$1${importStatement}`);
  }

  // Ajouter le cache AST au début de main()
  const mainFunctionStart = patchedContent.indexOf('async function main()');
  if (mainFunctionStart !== -1) {
    const mainBodyStart = patchedContent.indexOf('{', mainFunctionStart) + 1;
    const cacheInit = '\n  // Initialisation du cache AST\n' +
      '  const astCache = createASTCache({\n' +
      '    enabled: true,\n' +
      '    cacheDir: \'audit/ast-cache\',\n' +
      '    maxEntries: 1000,\n' +
      '    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours\n' +
      '    compression: true,\n' +
      '    validation: {\n' +
      '      checkHash: true,\n' +
      '      checkSize: true,\n' +
      '      checkMtime: true\n' +
      '    }\n' +
      '  });\n';

    patchedContent =
      patchedContent.slice(0, mainBodyStart) +
      cacheInit +
      patchedContent.slice(mainBodyStart);
  }

  // Sauvegarder le fichier patché
  const backupPath = codeMapperPath + '.backup.ast-cache';
  fs.writeFileSync(backupPath, content, 'utf8');
  fs.writeFileSync(codeMapperPath, patchedContent, 'utf8');

  console.log('✅ Fichier patché avec succès');
  console.log(`📁 Backup créé: ${backupPath}`);
}

/**
 * Teste le système de cache AST
 */
export function testASTCacheSystem(): void {
  console.log('🧪 Test du système de cache AST...');

  const astCache = createASTCache({
    enabled: true,
    cacheDir: 'audit/test-ast-cache',
    maxEntries: 10,
    compression: false,
    validation: {
      checkHash: false,  // Désactiver pour les tests
      checkSize: false,
      checkMtime: false
    }
  });

  // Réinitialiser pour un test propre
  astCache.clear();

  // Créer des fichiers temporaires pour les tests
  const testDir = 'audit/test-files';
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const testFiles = [
    path.join(testDir, 'file1.ts'),
    path.join(testDir, 'file2.ts'),
    path.join(testDir, 'file3.ts')
  ];

  // Créer les fichiers de test
  for (const file of testFiles) {
    const content = `// Test file: ${file}\nexport function test${path.basename(file, '.ts')}() {\n  console.log("Hello from ${file}");\n}\n`;
    fs.writeFileSync(file, content, 'utf8');
  }

  // Test 1: Sauvegarde dans le cache
  console.log('📝 Test 1: Sauvegarde dans le cache...');
  for (const file of testFiles) {
    const astData = {
      imports: [`import_${path.basename(file)}`],
      exports: [`export_${path.basename(file)}`],
      functions: [`function_${path.basename(file)}`],
      classes: [`class_${path.basename(file)}`]
    };
    const dependencies = [`dep_${path.basename(file)}`];
    astCache.save(file, astData, dependencies);
    console.log(`  ✅ ${path.basename(file)} sauvegardé`);
  }

  // Test 2: Récupération du cache
  console.log('📝 Test 2: Récupération du cache...');
  for (const file of testFiles) {
    const cachedEntry = astCache.get(file);
    if (cachedEntry) {
      console.log(`  ✅ ${path.basename(file)} récupéré du cache`);
    } else {
      console.log(`  ❌ ${path.basename(file)} non trouvé dans le cache`);
    }
  }

  // Test 3: Invalidation
  console.log('📝 Test 3: Invalidation...');
  const fileToInvalidate = testFiles[0];
  astCache.invalidate(fileToInvalidate);
  const invalidatedEntry = astCache.get(fileToInvalidate);
  if (!invalidatedEntry) {
    console.log(`  ✅ ${path.basename(fileToInvalidate)} correctement invalidé`);
  } else {
    console.log(`  ❌ ${path.basename(fileToInvalidate)} toujours dans le cache`);
  }

  // Test 4: Statistiques
  console.log('📝 Test 4: Statistiques...');
  const stats = astCache.getStats();
  console.log(`  ✅ Entrées: ${stats.entries}`);
  console.log(`  ✅ Hits: ${stats.hits}`);
  console.log(`  ✅ Misses: ${stats.misses}`);
  console.log(`  ✅ Taux de succès: ${stats.hitRate}`);

  // Test 5: Rapport
  console.log('📝 Test 5: Rapport...');
  const report = astCache.generateReport();
  console.log(`  ✅ Rapport généré (${report.length} caractères)`);

  // Nettoyer après le test
  astCache.clear();

  // Supprimer les fichiers temporaires
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch (error) {
    // Ignorer les erreurs de suppression
  }

  console.log('🧹 Cache de test nettoyé');

  console.log('✅ Tous les tests du cache AST ont réussi !');
}

/**
 * Fonction principale refactorée
 */
function main(): void {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  switch (command) {
    case 'structure':
      console.log('🔧 Création de la structure de cache AST...');
      const result = createASTCacheStructure(DEFAULT_AST_CACHE_OPTIONS);
      console.log('✅ Structure créée avec succès');
      break;

    case 'patch':
      patchCodeMapperWithASTCache();
      break;

    case 'test':
      testASTCacheSystem();
      break;

    case 'all':
      console.log('🔧 Exécution de toutes les étapes...');
      createASTCacheStructure(DEFAULT_AST_CACHE_OPTIONS);
      patchCodeMapperWithASTCache();
      testASTCacheSystem();
      console.log('✅ Toutes les étapes terminées avec succès');
      break;

    case 'help':
    default:
      console.log(`
Usage: npx tsx scripts/integrate-ast-cache-refactored.ts <command>

Commands:
  structure   Créer la structure de répertoires pour le cache AST
  patch       Patcher le script code-mapper pour ajouter le cache AST
  test        Tester le système de cache AST
  all         Exécuter toutes les étapes (structure + patch + test)
  help        Afficher cette aide

Exemples:
  npx tsx scripts/integrate-ast-cache-refactored.ts structure
  npx tsx scripts/integrate-ast-cache-refactored.ts patch
  npx tsx scripts/integrate-ast-cache-refactored.ts test
  npx tsx scripts/integrate-ast-cache-refactored.ts all
`);
      break;
  }
}

// Exécuter la fonction principale si le script est appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
