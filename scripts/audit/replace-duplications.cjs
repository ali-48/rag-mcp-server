#!/usr/bin/env node
/**
 * Script de remplacement des fonctions dupliquées par les utilitaires communs
 */

const fs = require('fs');
const path = require('path');

// Mapping des fonctions dupliquées vers les nouveaux utilitaires
const FUNCTION_MAPPINGS = {
  // string-utils
  'getFileExtension': { module: 'string-utils', newName: 'getFileExtension' },
  'cleanComment': { module: 'string-utils', newName: 'cleanComment' },
  'formatFileSize': { module: 'string-utils', newName: 'formatFileSize' },
  'hashString': { module: 'string-utils', newName: 'hashString' },
  'truncateString': { module: 'string-utils', newName: 'truncateString' },
  'escapeRegExp': { module: 'string-utils', newName: 'escapeRegExp' },
  'toCamelCase': { module: 'string-utils', newName: 'toCamelCase' },
  'toPascalCase': { module: 'string-utils', newName: 'toPascalCase' },
  'toKebabCase': { module: 'string-utils', newName: 'toKebabCase' },
  'toSnakeCase': { module: 'string-utils', newName: 'toSnakeCase' },
  'isAlphanumeric': { module: 'string-utils', newName: 'isAlphanumeric' },
  'isValidIdentifier': { module: 'string-utils', newName: 'isValidIdentifier' },
  'removeAccents': { module: 'string-utils', newName: 'removeAccents' },
  'countWords': { module: 'string-utils', newName: 'countWords' },
  'extractKeywords': { module: 'string-utils', newName: 'extractKeywords' },
  'stringSimilarity': { module: 'string-utils', newName: 'stringSimilarity' },
  'formatDuration': { module: 'string-utils', newName: 'formatDuration' },

  // file-utils
  'pathExists': { module: 'file-utils', newName: 'pathExists' },
  'isFile': { module: 'file-utils', newName: 'isFile' },
  'isDirectory': { module: 'file-utils', newName: 'isDirectory' },
  'ensureDirectory': { module: 'file-utils', newName: 'ensureDirectory' },
  'readFileSafe': { module: 'file-utils', newName: 'readFileSafe' },
  'writeFileSafe': { module: 'file-utils', newName: 'writeFileSafe' },
  'deleteFileSafe': { module: 'file-utils', newName: 'deleteFileSafe' },
  'deleteDirectorySafe': { module: 'file-utils', newName: 'deleteDirectorySafe' },
  'listFiles': { module: 'file-utils', newName: 'listFiles' },
  'listDirectories': { module: 'file-utils', newName: 'listDirectories' },
  'walkDirectory': { module: 'file-utils', newName: 'walkDirectory' },
  'getFileSize': { module: 'file-utils', newName: 'getFileSize' },
  'getDirectorySize': { module: 'file-utils', newName: 'getDirectorySize' },
  'copyFile': { module: 'file-utils', newName: 'copyFile' },
  'copyDirectory': { module: 'file-utils', newName: 'copyDirectory' },
  'normalizePath': { module: 'file-utils', newName: 'normalizePath' },
  'makeRelative': { module: 'file-utils', newName: 'makeRelative' },
  'makeAbsolute': { module: 'file-utils', newName: 'makeAbsolute' },
  'getFileNameWithoutExtension': { module: 'file-utils', newName: 'getFileNameWithoutExtension' },
  'hasExtension': { module: 'file-utils', newName: 'hasExtension' },
  'changeExtension': { module: 'file-utils', newName: 'changeExtension' },
  'readJsonFile': { module: 'file-utils', newName: 'readJsonFile' },
  'writeJsonFile': { module: 'file-utils', newName: 'writeJsonFile' },

  // json-utils
  'parseJsonSafe': { module: 'json-utils', newName: 'parseJsonSafe' },
  'stringifyJsonSafe': { module: 'json-utils', newName: 'stringifyJsonSafe' },
  'isValidJson': { module: 'json-utils', newName: 'isValidJson' },
  'deepClone': { module: 'json-utils', newName: 'deepClone' },
  'mergeJson': { module: 'json-utils', newName: 'mergeJson' },
  'deepMerge': { module: 'json-utils', newName: 'deepMerge' },
  'deepEqual': { module: 'json-utils', newName: 'deepEqual' },
  'getJsonPath': { module: 'json-utils', newName: 'getJsonPath' },
  'setJsonPath': { module: 'json-utils', newName: 'setJsonPath' },
  'deleteJsonPath': { module: 'json-utils', newName: 'deleteJsonPath' },
  'filterJsonKeys': { module: 'json-utils', newName: 'filterJsonKeys' },
  'transformJsonKeys': { module: 'json-utils', newName: 'transformJsonKeys' },
  'flattenJson': { module: 'json-utils', newName: 'flattenJson' },
  'unflattenJson': { module: 'json-utils', newName: 'unflattenJson' },
  'validateJsonSchema': { module: 'json-utils', newName: 'validateJsonSchema' },
  'formatJsonForDisplay': { module: 'json-utils', newName: 'formatJsonForDisplay' },
};

// Patterns pour détecter les fonctions
const FUNCTION_PATTERNS = [
  // Fonctions exportées
  /export\s+(?:async\s+)?function\s+(\w+)/g,
  /export\s+const\s+(\w+)\s*=\s*(?:async\s+)?function/g,
  /export\s+const\s+(\w+)\s*=\s*\(/g,
  /export\s+const\s+(\w+)\s*=\s*\{/g,

  // Fonctions internes
  /function\s+(\w+)\s*\(/g,
  /const\s+(\w+)\s*=\s*(?:async\s+)?function/g,
  /const\s+(\w+)\s*=\s*\(/g,
  /const\s+(\w+)\s*=\s*\{/g,
  /let\s+(\w+)\s*=\s*(?:async\s+)?function/g,
  /let\s+(\w+)\s*=\s*\(/g,
  /let\s+(\w+)\s*=\s*\{/g,
  /var\s+(\w+)\s*=\s*(?:async\s+)?function/g,
  /var\s+(\w+)\s*=\s*\(/g,
  /var\s+(\w+)\s*=\s*\{/g,
];

// Fichiers à exclure
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /build/,
  /build-test/,
  /dist/,
  /coverage/,
  /test/,
  /\.test\./,
  /\.spec\./,
  /audit\//,
  /src\/core\/utils\//, // Exclure les nouveaux utilitaires
];

// Extensions à inclure
const INCLUDE_EXTENSIONS = ['.ts', '.js', '.tsx', '.jsx'];

function shouldProcessFile(filePath) {
  const fullPath = path.resolve(filePath);

  // Vérifier les patterns d'exclusion
  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(fullPath)) {
      return false;
    }
  }

  // Vérifier l'extension
  const ext = path.extname(fullPath).toLowerCase();
  return INCLUDE_EXTENSIONS.includes(ext);
}

function findFiles(dir) {
  const files = [];

  function walk(currentPath) {
    try {
      const items = fs.readdirSync(currentPath);

      for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (stat.isFile() && shouldProcessFile(fullPath)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`⚠️  Impossible de scanner ${currentPath}:`, error.message);
    }
  }

  walk(dir);
  return files;
}

function detectDuplicatedFunctions(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const functions = new Set();

    // Détecter toutes les fonctions
    for (const pattern of FUNCTION_PATTERNS) {
      let match;
      const regex = new RegExp(pattern.source, 'g');
      while ((match = regex.exec(content)) !== null) {
        const funcName = match[1];
        if (FUNCTION_MAPPINGS[funcName]) {
          functions.add(funcName);
        }
      }
    }

    return Array.from(functions);
  } catch (error) {
    console.warn(`⚠️  Impossible d'analyser ${filePath}:`, error.message);
    return [];
  }
}

function generateImportStatement(moduleName, functions) {
  const uniqueFunctions = [...new Set(functions)];
  return `import { ${uniqueFunctions.join(', ')} } from '../core/utils/${moduleName}.js';`;
}

function replaceFunctionCalls(content, functionName, moduleName) {
  // Remplacer les appels de fonction (mais pas les définitions)
  const patterns = [
    // Appels simples: functionName(...)
    new RegExp(`(?<![\\w.])\\b${functionName}\\s*\\(`, 'g'),
    // Appels avec await: await functionName(...)
    new RegExp(`await\\s+${functionName}\\s*\\(`, 'g'),
    // Appels avec return: return functionName(...)
    new RegExp(`return\\s+${functionName}\\s*\\(`, 'g'),
  ];

  let newContent = content;
  for (const pattern of patterns) {
    newContent = newContent.replace(pattern, match => match);
  }

  return newContent;
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const duplicatedFunctions = detectDuplicatedFunctions(filePath);

    if (duplicatedFunctions.length === 0) {
      return { filePath, changed: false, functions: [] };
    }

    console.log(`📄 ${filePath}: ${duplicatedFunctions.length} fonctions dupliquées`);

    // Grouper par module
    const importsByModule = {};
    for (const funcName of duplicatedFunctions) {
      const mapping = FUNCTION_MAPPINGS[funcName];
      if (!importsByModule[mapping.module]) {
        importsByModule[mapping.module] = [];
      }
      importsByModule[mapping.module].push(mapping.newName);
    }

    // Générer les nouvelles importations
    const importStatements = Object.entries(importsByModule).map(
      ([moduleName, functions]) => generateImportStatement(moduleName, functions)
    );

    // Ajouter les imports après les imports existants
    let newContent = content;
    const importRegex = /import\s+.*?from\s+['"][^'"]+['"];?\s*\n/g;
    const lastImportMatch = [...content.matchAll(importRegex)].pop();

    if (lastImportMatch) {
      const insertPosition = lastImportMatch.index + lastImportMatch[0].length;
      const importsToAdd = '\n' + importStatements.join('\n') + '\n';
      newContent = content.slice(0, insertPosition) + importsToAdd + content.slice(insertPosition);
    } else {
      // Pas d'imports existants, ajouter au début
      newContent = importStatements.join('\n') + '\n\n' + content;
    }

    // Remplacer les définitions de fonctions par des commentaires
    for (const funcName of duplicatedFunctions) {
      const mapping = FUNCTION_MAPPINGS[funcName];

      // Pattern pour trouver la définition de fonction
      const definitionPatterns = [
        // export function funcName
        new RegExp(`export\\s+(?:async\\s+)?function\\s+${funcName}\\s*\\([^)]*\\)\\s*{[^}]*}`, 'gs'),
        // export const funcName = function
        new RegExp(`export\\s+const\\s+${funcName}\\s*=\\s*(?:async\\s+)?function\\s*\\([^)]*\\)\\s*{[^}]*}`, 'gs'),
        // export const funcName = () =>
        new RegExp(`export\\s+const\\s+${funcName}\\s*=\\s*\\([^)]*\\)\\s*=>\\s*{[^}]*}`, 'gs'),
        // function funcName
        new RegExp(`(?:async\\s+)?function\\s+${funcName}\\s*\\([^)]*\\)\\s*{[^}]*}`, 'gs'),
        // const funcName = function
        new RegExp(`const\\s+${funcName}\\s*=\\s*(?:async\\s+)?function\\s*\\([^)]*\\)\\s*{[^}]*}`, 'gs'),
        // const funcName = () =>
        new RegExp(`const\\s+${funcName}\\s*=\\s*\\([^)]*\\)\\s*=>\\s*{[^}]*}`, 'gs'),
      ];

      for (const pattern of definitionPatterns) {
        const match = newContent.match(pattern);
        if (match) {
          const replacement = `// REMPLACÉ: ${funcName} → ${mapping.module}.${mapping.newName}\n// ${match[0].replace(/\n/g, '\n// ')}`;
          newContent = newContent.replace(pattern, replacement);
          break;
        }
      }
    }

    // Écrire le fichier modifié
    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      return {
        filePath,
        changed: true,
        functions: duplicatedFunctions,
        imports: importStatements
      };
    }

    return { filePath, changed: false, functions: duplicatedFunctions };
  } catch (error) {
    console.error(`❌ Erreur lors du traitement de ${filePath}:`, error.message);
    return { filePath, changed: false, functions: [], error: error.message };
  }
}

function main() {
  console.log('🔍 Démarrage du remplacement des fonctions dupliquées...');
  console.log(`📊 ${Object.keys(FUNCTION_MAPPINGS).length} fonctions dans le mapping`);

  const rootDir = process.cwd();
  const files = findFiles(rootDir);

  console.log(`📁 ${files.length} fichiers à analyser`);

  const results = [];
  let totalChanged = 0;
  let totalFunctions = 0;

  for (const file of files) {
    const result = processFile(file);
    results.push(result);

    if (result.changed) {
      totalChanged++;
      totalFunctions += result.functions.length;
      console.log(`✅ ${file}: ${result.functions.length} fonctions remplacées`);
    }
  }

  // Générer un rapport
  const report = {
    generated: new Date().toISOString(),
    summary: {
      filesScanned: files.length,
      filesChanged: totalChanged,
      functionsReplaced: totalFunctions,
      byModule: {},
    },
    details: results.filter(r => r.changed).map(r => ({
      file: path.relative(rootDir, r.filePath),
      functions: r.functions,
      imports: r.imports,
    })),
  };

  // Calculer les statistiques par module
  for (const result of results) {
    for (const funcName of result.functions) {
      const mapping = FUNCTION_MAPPINGS[funcName];
      if (mapping) {
        report.summary.byModule[mapping.module] = (report.summary.byModule[mapping.module] || 0) + 1;
      }
    }
  }

  // Écrire le rapport
  const reportPath = path.join(rootDir, 'audit', 'replacement-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n📊 RÉSUMÉ DU REMPLACEMENT');
  console.log('='.repeat(60));
  console.log(`📁 Fichiers scannés: ${files.length}`);
  console.log(`✏️  Fichiers modifiés: ${totalChanged}`);
  console.log(`🧩 Fonctions remplacées: ${totalFunctions}`);
  console.log(`📄 Rapport: ${reportPath}`);

  if (totalChanged > 0) {
    console.log('\n📈 Distribution par module:');
    for (const [moduleName, count] of Object.entries(report.summary.byModule)) {
      console.log(`  • ${moduleName}: ${count} fonctions`);
    }

    console.log('\n📋 Fichiers modifiés:');
    report.details.slice(0, 10).forEach((detail, index) => {
      console.log(`  ${index + 1}. ${detail.file}: ${detail.functions.length} fonctions`);
    });

    if (report.details.length > 10) {
      console.log(`  ... et ${report.details.length - 10} autres fichiers`);
    }
  } else {
    console.log('\n✅ Aucune fonction dupliquée trouvée à remplacer.');
  }

  console.log('\n🎯 Prochaines étapes:');
  console.log('  1. Vérifier les imports ajoutés');
  console.log('  2. Tester la compilation (npm run build)');
  console.log('  3. Exécuter les tests (npm test)');
  console.log('  4. Supprimer manuellement le code commenté si tout fonctionne');
}

// Exécution
if (require.main === module) {
  main();
}
