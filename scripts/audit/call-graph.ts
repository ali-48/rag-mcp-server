#!/usr/bin/env node
/**
 * Script d'audit : Call Graph
 * Analyse les appels de fonctions dans le projet TypeScript
 *
 * Usage: npx tsx scripts/audit/call-graph.ts
 */

import fs from 'fs';
import path from 'path';
import { Node, Project, SyntaxKind } from 'ts-morph';

interface CallInfo {
  caller: {
    file: string;
    function: string;
    line: number;
    column: number;
  };
  callee: {
    file: string;
    function: string;
    line: number;
    column: number;
  };
  type: 'function' | 'method' | 'constructor' | 'arrow' | 'async';
  depth: number;
}

interface CallGraph {
  generated: string;
  calls: CallInfo[];
  stats: {
    totalCalls: number;
    byType: Record<string, number>;
    byFile: Record<string, number>;
    maxDepth: number;
    averageDepth: number;
    recursiveCalls: number;
  };
  functions: Array<{
    file: string;
    name: string;
    calls: number;
    calledBy: number;
    depth: number;
  }>;
}

// Configuration
const EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  'build',
  'build-test',
  'dist',
  'coverage',
  '.nyc_output',
  '.vscode',
  'logs',
  'audit',
  'test'
];

const INCLUDED_EXTENSIONS = ['.ts', '.tsx'];

function shouldProcessFile(filePath: string): boolean {
  const name = path.basename(filePath);
  const dir = path.dirname(filePath);

  // Vérifier les dossiers exclus
  for (const excludedDir of EXCLUDED_DIRS) {
    if (dir.includes(excludedDir)) {
      return false;
    }
  }

  // Vérifier les extensions incluses
  const ext = path.extname(name).toLowerCase();
  return INCLUDED_EXTENSIONS.includes(ext);
}

function getFunctionName(node: Node): string {
  if (node.isKind(SyntaxKind.FunctionDeclaration)) {
    return node.getName() || 'anonymous';
  }
  if (node.isKind(SyntaxKind.MethodDeclaration)) {
    return node.getName() || 'anonymous';
  }
  if (node.isKind(SyntaxKind.ArrowFunction)) {
    return 'arrow';
  }
  if (node.isKind(SyntaxKind.FunctionExpression)) {
    return 'function';
  }
  return 'unknown';
}

function getCallType(node: Node): CallInfo['type'] {
  if (node.isKind(SyntaxKind.CallExpression)) {
    const expr = node.getExpression();
    if (expr.isKind(SyntaxKind.PropertyAccessExpression)) {
      return 'method';
    }
    return 'function';
  }
  if (node.isKind(SyntaxKind.NewExpression)) {
    return 'constructor';
  }
  if (node.isKind(SyntaxKind.AwaitExpression)) {
    return 'async';
  }
  return 'function';
}

function extractCallsFromFile(filePath: string, project: Project): CallInfo[] {
  const calls: CallInfo[] = [];

  try {
    const sourceFile = project.addSourceFileAtPath(filePath);
    const relativePath = path.relative(process.cwd(), filePath);

    // Stack pour suivre les fonctions en cours d'analyse
    const functionStack: Array<{
      name: string;
      line: number;
      column: number;
      depth: number;
    }> = [];

    sourceFile.forEachDescendant((node) => {
      // Détecter les déclarations de fonctions
      if (node.isKind(SyntaxKind.FunctionDeclaration) ||
        node.isKind(SyntaxKind.MethodDeclaration) ||
        node.isKind(SyntaxKind.ArrowFunction) ||
        node.isKind(SyntaxKind.FunctionExpression)) {

        const pos = node.getStart();
        const lineAndColumn = sourceFile.getLineAndColumnAtPos(pos);
        const functionName = getFunctionName(node);

        functionStack.push({
          name: functionName,
          line: lineAndColumn.line,
          column: lineAndColumn.column,
          depth: functionStack.length
        });

        // Analyser le corps de la fonction
        const body = node.getBody();
        if (body) {
          analyzeFunctionBody(body, functionStack[functionStack.length - 1], calls, relativePath, sourceFile);
        }

        functionStack.pop();
      }

      // Détecter les appels au niveau racine (hors fonction)
      if (functionStack.length === 0) {
        if (node.isKind(SyntaxKind.CallExpression) ||
          node.isKind(SyntaxKind.NewExpression)) {

          const pos = node.getStart();
          const lineAndColumn = sourceFile.getLineAndColumnAtPos(pos);
          const callType = getCallType(node);

          // Essayer d'obtenir le nom de la fonction appelée
          let calleeName = 'unknown';
          if (node.isKind(SyntaxKind.CallExpression)) {
            const expr = node.getExpression();
            if (expr.isKind(SyntaxKind.Identifier)) {
              calleeName = expr.getText();
            } else if (expr.isKind(SyntaxKind.PropertyAccessExpression)) {
              calleeName = expr.getName();
            }
          } else if (node.isKind(SyntaxKind.NewExpression)) {
            const expr = node.getExpression();
            if (expr.isKind(SyntaxKind.Identifier)) {
              calleeName = `new ${expr.getText()}`;
            }
          }

          const call: CallInfo = {
            caller: {
              file: relativePath,
              function: 'global',
              line: lineAndColumn.line,
              column: lineAndColumn.column
            },
            callee: {
              file: 'unknown',
              function: calleeName,
              line: 0,
              column: 0
            },
            type: callType,
            depth: 0
          };

          calls.push(call);
        }
      }
    });

    project.removeSourceFile(sourceFile);
  } catch (error: any) {
    console.warn(`⚠️  Impossible d'analyser ${filePath}:`, error.message);
  }

  return calls;
}

function analyzeFunctionBody(
  body: Node,
  callerInfo: { name: string; line: number; column: number; depth: number },
  calls: CallInfo[],
  filePath: string,
  sourceFile: any
): void {
  body.forEachDescendant((node) => {
    if (node.isKind(SyntaxKind.CallExpression) ||
      node.isKind(SyntaxKind.NewExpression)) {

      const pos = node.getStart();
      const lineAndColumn = sourceFile.getLineAndColumnAtPos(pos);
      const callType = getCallType(node);

      // Essayer d'obtenir le nom de la fonction appelée
      let calleeName = 'unknown';
      if (node.isKind(SyntaxKind.CallExpression)) {
        const expr = node.getExpression();
        if (expr.isKind(SyntaxKind.Identifier)) {
          calleeName = expr.getText();
        } else if (expr.isKind(SyntaxKind.PropertyAccessExpression)) {
          calleeName = expr.getName();
        }
      } else if (node.isKind(SyntaxKind.NewExpression)) {
        const expr = node.getExpression();
        if (expr.isKind(SyntaxKind.Identifier)) {
          calleeName = `new ${expr.getText()}`;
        }
      }

      const call: CallInfo = {
        caller: {
          file: filePath,
          function: callerInfo.name,
          line: callerInfo.line,
          column: callerInfo.column
        },
        callee: {
          file: 'unknown', // À déterminer par analyse croisée
          function: calleeName,
          line: 0,
          column: 0
        },
        type: callType,
        depth: callerInfo.depth
      };

      calls.push(call);
    }
  });
}

function calculateStats(calls: CallInfo[]): CallGraph['stats'] {
  const stats: CallGraph['stats'] = {
    totalCalls: calls.length,
    byType: {},
    byFile: {},
    maxDepth: 0,
    averageDepth: 0,
    recursiveCalls: 0
  };

  let totalDepth = 0;

  calls.forEach(call => {
    // Statistiques par type
    stats.byType[call.type] = (stats.byType[call.type] || 0) + 1;

    // Statistiques par fichier appelant
    stats.byFile[call.caller.file] = (stats.byFile[call.caller.file] || 0) + 1;

    // Profondeur
    totalDepth += call.depth;
    if (call.depth > stats.maxDepth) {
      stats.maxDepth = call.depth;
    }

    // Détecter les appels récursifs
    if (call.caller.function === call.callee.function && call.caller.file === call.callee.file) {
      stats.recursiveCalls++;
    }
  });

  stats.averageDepth = calls.length > 0 ? totalDepth / calls.length : 0;

  return stats;
}

function analyzeFunctions(calls: CallInfo[]): CallGraph['functions'] {
  const functionMap = new Map<string, {
    file: string;
    name: string;
    calls: number;
    calledBy: number;
    depth: number;
  }>();

  // Compter les appels sortants
  calls.forEach(call => {
    const callerKey = `${call.caller.file}:${call.caller.function}`;
    if (!functionMap.has(callerKey)) {
      functionMap.set(callerKey, {
        file: call.caller.file,
        name: call.caller.function,
        calls: 0,
        calledBy: 0,
        depth: call.depth
      });
    }
    const caller = functionMap.get(callerKey)!;
    caller.calls++;
  });

  // Compter les appels entrants
  calls.forEach(call => {
    const calleeKey = `${call.callee.file}:${call.callee.function}`;
    if (!functionMap.has(calleeKey)) {
      functionMap.set(calleeKey, {
        file: call.callee.file,
        name: call.callee.function,
        calls: 0,
        calledBy: 0,
        depth: 0
      });
    }
    const callee = functionMap.get(calleeKey)!;
    callee.calledBy++;
  });

  return Array.from(functionMap.values());
}

async function main() {
  console.log('📞 Analyse des appels de fonctions...');

  const startTime = Date.now();
  const rootDir = process.cwd();

  // Initialiser le projet TypeScript
  const project = new Project({
    tsConfigFilePath: path.join(rootDir, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true
  });

  // Trouver tous les fichiers TypeScript
  const allFiles: string[] = [];

  function scanForTypeScriptFiles(dir: string) {
    try {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          if (!shouldProcessFile(fullPath)) {
            continue;
          }
          scanForTypeScriptFiles(fullPath);
        } else if (shouldProcessFile(fullPath)) {
          allFiles.push(fullPath);
        }
      }
    } catch (error: any) {
      console.warn(`⚠️  Impossible de scanner ${dir}:`, error.message);
    }
  }

  scanForTypeScriptFiles(rootDir);

  console.log(`📁 ${allFiles.length} fichiers TypeScript trouvés`);

  // Extraire les appels de chaque fichier
  let allCalls: CallInfo[] = [];
  let processedFiles = 0;

  for (const file of allFiles) {
    const calls = extractCallsFromFile(file, project);
    allCalls.push(...calls);
    processedFiles++;

    if (processedFiles % 10 === 0) {
      console.log(`  📄 ${processedFiles}/${allFiles.length} fichiers analysés...`);
    }
  }

  // Calculer les statistiques
  const stats = calculateStats(allCalls);
  const functions = analyzeFunctions(allCalls);

  // Générer la sortie JSON
  const callGraph: CallGraph = {
    generated: new Date().toISOString(),
    calls: allCalls,
    stats,
    functions
  };

  // Écrire le fichier de sortie
  const outputPath = path.join(rootDir, 'audit', 'call_graph.json');
  fs.writeFileSync(outputPath, JSON.stringify(callGraph, null, 2), 'utf8');

  const elapsedTime = Date.now() - startTime;

  console.log('✅ Analyse des appels terminée !');
  console.log(`📊 Statistiques:`);
  console.log(`   📞 Appels totaux: ${stats.totalCalls}`);
  console.log(`   🔄 Appels récursifs: ${stats.recursiveCalls}`);
  console.log(`   📈 Profondeur max: ${stats.maxDepth}`);
  console.log(`   📊 Profondeur moyenne: ${stats.averageDepth.toFixed(2)}`);
  console.log(`   ⏱️  Temps d'exécution: ${elapsedTime}ms`);
  console.log(`\n📁 Fichier généré:`);
  console.log(`   📄 ${outputPath}`);

  // Afficher la distribution par type
  console.log('\n📈 Distribution par type d\'appel:');
  const sortedTypes = Object.entries(stats.byType)
    .sort((a, b) => b[1] - a[1]);

  for (const [type, count] of sortedTypes) {
    const percentage = Math.round((count / stats.totalCalls) * 100);
    console.log(`   ${type}: ${count} appels (${percentage}%)`);
  }

  // Afficher les fonctions les plus actives
  console.log('\n🏆 Top 10 fonctions avec le plus d\'appels sortants:');
  const sortedByCalls = [...functions]
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 10);

  for (const func of sortedByCalls) {
    console.log(`   ${func.file}:${func.name}: ${func.calls} appels sortants, ${func.calledBy} appels entrants`);
  }

  // Afficher les fichiers avec le plus d'appels
  console.log('\n🏆 Top 10 fichiers avec le plus d\'appels:');
  const sortedFiles = Object.entries(stats.byFile)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [file, count] of sortedFiles) {
    console.log(`   ${file}: ${count} appels`);
  }
}

// Exécution
if (require.main === module) {
  main().catch((error: any) => {
    console.error('❌ Erreur lors de l\'analyse des appels:', error);
    process.exit(1);
  });
}

export { analyzeFunctions, calculateStats, extractCallsFromFile };
