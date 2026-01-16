#!/usr/bin/env node
/**
 * Script d'audit : Project Tree
 * Génère une arborescence des fichiers du projet pour mapping
 *
 * Usage: npx tsx scripts/audit/project-tree.ts
 */

import fs from 'fs';
import path from 'path';

interface FileInfo {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  extension?: string;
  depth: number;
}

interface ProjectTree {
  root: string;
  generated: string;
  files: FileInfo[];
  stats: {
    totalFiles: number;
    totalDirectories: number;
    totalSize: number;
    byExtension: Record<string, number>;
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
  'audit'  // Exclure le dossier audit lui-même
];

const EXCLUDED_FILES = [
  '.DS_Store',
  'Thumbs.db',
  '*.log',
  '*.tmp',
  '*.temp'
];

const INCLUDED_EXTENSIONS = [
  '.ts', '.js', '.json', '.md', '.yml', '.yaml', '.toml',
  '.sql', '.sh', '.txt', '.html', '.css'
];

function shouldExclude(filePath: string, isDirectory: boolean): boolean {
  const name = path.basename(filePath);

  // Vérifier les dossiers exclus
  if (isDirectory && EXCLUDED_DIRS.includes(name)) {
    return true;
  }

  // Vérifier les fichiers exclus
  if (!isDirectory) {
    for (const pattern of EXCLUDED_FILES) {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        if (regex.test(name)) return true;
      } else if (name === pattern) {
        return true;
      }
    }

    // Vérifier les extensions incluses
    const ext = path.extname(name).toLowerCase();
    if (ext && !INCLUDED_EXTENSIONS.includes(ext)) {
      return true;
    }
  }

  return false;
}

function scanDirectory(dirPath: string, depth = 0): FileInfo[] {
  const files: FileInfo[] = [];

  try {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const relativePath = path.relative(process.cwd(), fullPath);

      try {
        const stat = fs.statSync(fullPath);
        const isDirectory = stat.isDirectory();

        if (shouldExclude(fullPath, isDirectory)) {
          continue;
        }

        const fileInfo: FileInfo = {
          path: relativePath,
          name: item,
          type: isDirectory ? 'directory' : 'file',
          depth
        };

        if (!isDirectory) {
          fileInfo.size = stat.size;
          fileInfo.extension = path.extname(item).toLowerCase() || 'none';
        }

        files.push(fileInfo);

        // Récursivité pour les dossiers
        if (isDirectory && depth < 10) { // Limite de profondeur
          const subFiles = scanDirectory(fullPath, depth + 1);
          files.push(...subFiles);
        }
      } catch (error: any) {
        console.warn(`⚠️  Impossible d'accéder à ${fullPath}:`, error.message);
      }
    }
  } catch (error: any) {
    console.error(`❌ Erreur lors du scan de ${dirPath}:`, error.message);
  }

  return files;
}

function generateTreeText(files: FileInfo[]): string {
  const lines: string[] = [];
  lines.push('# Arborescence du projet RAG MCP Server');
  lines.push(`# Généré le: ${new Date().toISOString()}`);
  lines.push(`# Répertoire racine: ${process.cwd()}`);
  lines.push('');

  // Trier les fichiers par chemin pour une meilleure lisibilité
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

  let currentDepth = -1;
  const stack: string[] = [];

  for (const file of sortedFiles) {
    // Gérer les changements de profondeur
    while (stack.length > file.depth) {
      stack.pop();
    }

    // Ajouter l'indentation
    const indent = '  '.repeat(file.depth);
    const prefix = file.type === 'directory' ? '📁 ' : '📄 ';

    // Ajouter des informations supplémentaires pour les fichiers
    let suffix = '';
    if (file.type === 'file') {
      const sizeKB = file.size ? Math.round(file.size / 1024 * 100) / 100 : 0;
      suffix = ` (${sizeKB} KB${file.extension ? `, ${file.extension}` : ''})`;
    }

    lines.push(`${indent}${prefix}${file.name}${suffix}`);

    // Mettre à jour la pile pour le prochain élément
    if (file.type === 'directory') {
      stack.push(file.name);
    }
  }

  return lines.join('\n');
}

function calculateStats(files: FileInfo[]): ProjectTree['stats'] {
  const stats: ProjectTree['stats'] = {
    totalFiles: 0,
    totalDirectories: 0,
    totalSize: 0,
    byExtension: {}
  };

  for (const file of files) {
    if (file.type === 'directory') {
      stats.totalDirectories++;
    } else {
      stats.totalFiles++;
      stats.totalSize += file.size || 0;

      const ext = file.extension || 'none';
      stats.byExtension[ext] = (stats.byExtension[ext] || 0) + 1;
    }
  }

  return stats;
}

async function main() {
  console.log('🌳 Génération de l\'arborescence du projet...');

  const startTime = Date.now();
  const rootDir = process.cwd();
  const files = scanDirectory(rootDir);
  const stats = calculateStats(files);
  const treeText = generateTreeText(files);

  // Générer la sortie JSON
  const projectTree: ProjectTree = {
    root: rootDir,
    generated: new Date().toISOString(),
    files,
    stats
  };

  // Écrire les fichiers de sortie
  const outputDir = path.join(rootDir, 'audit');

  // Fichier texte pour lecture humaine
  const textOutputPath = path.join(outputDir, 'project_tree.txt');
  fs.writeFileSync(textOutputPath, treeText, 'utf8');

  // Fichier JSON pour traitement automatique
  const jsonOutputPath = path.join(outputDir, 'project_tree.json');
  fs.writeFileSync(jsonOutputPath, JSON.stringify(projectTree, null, 2), 'utf8');

  const elapsedTime = Date.now() - startTime;

  console.log('✅ Arborescence générée avec succès !');
  console.log(`📊 Statistiques:`);
  console.log(`   📁 Dossiers: ${stats.totalDirectories}`);
  console.log(`   📄 Fichiers: ${stats.totalFiles}`);
  console.log(`   💾 Taille totale: ${Math.round(stats.totalSize / 1024 / 1024 * 100) / 100} MB`);
  console.log(`   ⏱️  Temps d'exécution: ${elapsedTime}ms`);
  console.log(`\n📁 Fichiers générés:`);
  console.log(`   📄 ${textOutputPath}`);
  console.log(`   📄 ${jsonOutputPath}`);

  // Afficher la distribution par extension
  console.log('\n📈 Distribution par extension:');
  const sortedExtensions = Object.entries(stats.byExtension)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [ext, count] of sortedExtensions) {
    const percentage = Math.round((count / stats.totalFiles) * 100);
    console.log(`   ${ext}: ${count} fichiers (${percentage}%)`);
  }
}

// Exécution
if (require.main === module) {
  main().catch((error: any) => {
    console.error('❌ Erreur lors de la génération de l\'arborescence:', error);
    process.exit(1);
  });
}

export { calculateStats, generateTreeText, scanDirectory };
