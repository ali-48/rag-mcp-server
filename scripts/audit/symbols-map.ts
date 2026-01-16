#!/usr/bin/env node
/**
 * Script d'audit : Symbols Map
 * Analyse les symboles (classes, fonctions, interfaces, etc.) du projet TypeScript
 *
 * Usage: npx tsx scripts/audit/symbols-map.ts
 */

import fs from 'fs';
import path from 'path';
import { Node, Project, SyntaxKind } from 'ts-morph';

interface SymbolInfo {
  id: string;
  name: string;
  type: 'class' | 'interface' | 'type' | 'function' | 'variable' | 'enum' | 'namespace';
  filePath: string;
  line: number;
  column: number;
  exported: boolean;
  public: boolean;
  dependencies: string[];
  dependents: string[];
  documentation?: string;
  complexity?: number;
}

interface SymbolsMap {
  generated: string;
  symbols: SymbolInfo[];
  stats: {
    totalSymbols: number;
    byType: Record<string, number>;
    byFile: Record<string, number>;
    exportedCount: number;
    publicCount: number;
    averageComplexity: number;
  };
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

function getSymbolType(node: Node): SymbolInfo['type'] | null {
  if (node.isKind(SyntaxKind.ClassDeclaration)) return 'class';
  if (node.isKind(SyntaxKind.InterfaceDeclaration)) return 'interface';
  if (node.isKind(SyntaxKind.TypeAliasDeclaration)) return 'type';
  if (node.isKind(SyntaxKind.FunctionDeclaration)) return 'function';
  if (node.isKind(SyntaxKind.VariableDeclaration)) return 'variable';
  if (node.isKind(SyntaxKind.EnumDeclaration)) return 'enum';
  if (node.isKind(SyntaxKind.ModuleDeclaration)) return 'namespace';
  return null;
}

function calculateComplexity(node: Node): number {
  let complexity = 1;

  // Compter les déclarations internes
  node.forEachChild(child => {
    if (child.isKind(SyntaxKind.FunctionDeclaration) ||
      child.isKind(SyntaxKind.MethodDeclaration) ||
      child.isKind(SyntaxKind.IfStatement) ||
      child.isKind(SyntaxKind.ForStatement) ||
      child.isKind(SyntaxKind.WhileStatement) ||
      child.isKind(SyntaxKind.SwitchStatement)) {
      complexity++;
    }
  });

  return complexity;
}

function extractSymbolsFromFile(filePath: string, project: Project): SymbolInfo[] {
  const symbols: SymbolInfo[] = [];

  try {
    const sourceFile = project.addSourceFileAtPath(filePath);

    sourceFile.forEachDescendant((node, traversal) => {
      const symbolType = getSymbolType(node);
      if (!symbolType) {
        return;
      }

      const name = node.getSymbol()?.getName() || 'anonymous';
      const pos = node.getStart();
      const lineAndColumn = sourceFile.getLineAndColumnAtPos(pos);

      // Vérifier si le symbole est exporté
      const isExported = node.getModifiers?.().some(mod => mod.getKind() === SyntaxKind.ExportKeyword) || false;

      // Vérifier si le symbole est public (pas de modificateur private/protected)
      const isPublic = !node.getModifiers?.().some(mod =>
        mod.getKind() === SyntaxKind.PrivateKeyword ||
        mod.getKind() === SyntaxKind.ProtectedKeyword
      );

      // Extraire la documentation
      const jsDocs = node.getJsDocs();
      const documentation = jsDocs.length > 0 ? jsDocs[0].getDescription()?.toString() : undefined;

      // Calculer la complexité
      const complexity = calculateComplexity(node);

      // Extraire les dépendances (imports utilisés par ce symbole)
      const dependencies: string[] = [];
      node.forEachDescendant(child => {
        if (child.isKind(SyntaxKind.Identifier)) {
          const symbol = child.getSymbol();
          if (symbol && symbol.getDeclarations().length > 0) {
            const decl = symbol.getDeclarations()[0];
            if (decl.getSourceFile().getFilePath() !== filePath) {
              const depName = symbol.getName();
              if (!dependencies.includes(depName)) {
                dependencies.push(depName);
              }
            }
          }
        }
      }, traversal);

      const symbol: SymbolInfo = {
        id: `${path.relative(process.cwd(), filePath)}:${name}:${symbolType}`,
        name,
        type: symbolType,
        filePath: path.relative(process.cwd(), filePath),
        line: lineAndColumn.line,
        column: lineAndColumn.column,
        exported: isExported,
        public: isPublic,
        dependencies,
        dependents: [], // Rempli plus tard
        documentation,
        complexity
      };

      symbols.push(symbol);
    });

    project.removeSourceFile(sourceFile);
  } catch (error: any) {
    console.warn(`⚠️  Impossible d'analyser ${filePath}:`, error.message);
  }

  return symbols;
}

function findDependents(symbols: SymbolInfo[]): SymbolInfo[] {
  // Créer un index des symboles par ID
  const symbolMap = new Map<string, SymbolInfo>();
  symbols.forEach(symbol => {
    symbolMap.set(symbol.id, symbol);
  });

  // Pour chaque symbole, trouver qui dépend de lui
  symbols.forEach(symbol => {
    symbol.dependencies.forEach(depName => {
      // Chercher les symboles qui ont ce nom dans leurs dépendances
      symbols.forEach(otherSymbol => {
        if (otherSymbol.dependencies.includes(depName) && otherSymbol.id !== symbol.id) {
          if (!symbol.dependents.includes(otherSymbol.id)) {
            symbol.dependents.push(otherSymbol.id);
          }
        }
      });
    });
  });

  return symbols;
}

async function main() {
  console.log('🔍 Analyse des symboles TypeScript...');

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

  // Extraire les symboles de chaque fichier
  let allSymbols: SymbolInfo[] = [];
  let processedFiles = 0;

  for (const file of allFiles) {
    const symbols = extractSymbolsFromFile(file, project);
    allSymbols.push(...symbols);
    processedFiles++;

    if (processedFiles % 10 === 0) {
      console.log(`  📄 ${processedFiles}/${allFiles.length} fichiers analysés...`);
    }
  }

  // Trouver les dépendants
  allSymbols = findDependents(allSymbols);

  // Calculer les statistiques
  const stats: SymbolsMap['stats'] = {
    totalSymbols: allSymbols.length,
    byType: {},
    byFile: {},
    exportedCount: 0,
    publicCount: 0,
    averageComplexity: 0
  };

  let totalComplexity = 0;

  allSymbols.forEach(symbol => {
    // Statistiques par type
    stats.byType[symbol.type] = (stats.byType[symbol.type] || 0) + 1;

    // Statistiques par fichier
    stats.byFile[symbol.filePath] = (stats.byFile[symbol.filePath] || 0) + 1;

    // Comptes d'exportation et de visibilité
    if (symbol.exported) stats.exportedCount++;
    if (symbol.public) stats.publicCount++;

    totalComplexity += symbol.complexity || 1;
  });

  stats.averageComplexity = allSymbols.length > 0 ? totalComplexity / allSymbols.length : 0;

  // Générer la sortie JSON
  const symbolsMap: SymbolsMap = {
    generated: new Date().toISOString(),
    symbols: allSymbols,
    stats
  };

  // Écrire le fichier de sortie
  const outputPath = path.join(rootDir, 'audit', 'symbols_map.json');
  fs.writeFileSync(outputPath, JSON.stringify(symbolsMap, null, 2), 'utf8');

  const elapsedTime = Date.now() - startTime;

  console.log('✅ Analyse des symboles terminée !');
  console.log(`📊 Statistiques:`);
  console.log(`   🔤 Symboles totaux: ${stats.totalSymbols}`);
  console.log(`   📤 Symboles exportés: ${stats.exportedCount} (${Math.round(stats.exportedCount / stats.totalSymbols * 100)}%)`);
  console.log(`   🔓 Symboles publics: ${stats.publicCount} (${Math.round(stats.publicCount / stats.totalSymbols * 100)}%)`);
  console.log(`   📈 Complexité moyenne: ${stats.averageComplexity.toFixed(2)}`);
  console.log(`   ⏱️  Temps d'exécution: ${elapsedTime}ms`);
  console.log(`\n📁 Fichier généré:`);
  console.log(`   📄 ${outputPath}`);

  // Afficher la distribution par type
  console.log('\n📈 Distribution par type:');
  const sortedTypes = Object.entries(stats.byType)
    .sort((a, b) => b[1] - a[1]);

  for (const [type, count] of sortedTypes) {
    const percentage = Math.round((count / stats.totalSymbols) * 100);
    console.log(`   ${type}: ${count} symboles (${percentage}%)`);
  }

  // Afficher les fichiers avec le plus de symboles
  console.log('\n🏆 Top 10 fichiers avec le plus de symboles:');
  const sortedFiles = Object.entries(stats.byFile)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [file, count] of sortedFiles) {
    console.log(`   ${file}: ${count} symboles`);
  }
}

// Exécution
if (require.main === module) {
  main().catch((error: any) => {
    console.error('❌ Erreur lors de l\'analyse des symboles:', error);
    process.exit(1);
  });
}

export { extractSymbolsFromFile, findDependents };
