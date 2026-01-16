#!/usr/bin/env node
/**
 * Script d'audit : Quality Report
 * Génère un rapport de qualité complet du codebase
 *
 * Usage: npx tsx scripts/audit/quality-report.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface QualityMetric {
  name: string;
  value: number;
  max: number;
  score: number; // 0-100
  weight: number; // Importance relative
  description: string;
}

interface FileQuality {
  filePath: string;
  metrics: {
    lines: number;
    complexity: number;
    maintainability: number;
    duplication: number;
    coverage?: number;
    issues: number;
  };
  score: number;
}

interface QualityReport {
  generated: string;
  overallScore: number;
  metrics: QualityMetric[];
  files: FileQuality[];
  recommendations: string[];
  stats: {
    totalFiles: number;
    filesByScore: {
      excellent: number; // 90-100
      good: number;     // 70-89
      moderate: number; // 50-69
      poor: number;     // 30-49
      critical: number; // 0-29
    };
    averageLines: number;
    averageComplexity: number;
    totalIssues: number;
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

const INCLUDED_EXTENSIONS = ['.ts', '.js', '.json', '.md', '.yml', '.yaml'];

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

function calculateFileComplexity(content: string): number {
  // Calcul simple de complexité cyclomatique
  let complexity = 1;

  // Compter les structures de contrôle
  const controlPatterns = [
    /\bif\s*\(/g,
    /\belse\b/g,
    /\bfor\s*\(/g,
    /\bwhile\s*\(/g,
    /\bdo\b/g,
    /\bswitch\s*\(/g,
    /\bcase\b/g,
    /\bcatch\s*\(/g,
    /\bthrow\b/g,
    /\breturn\b/g,
    /\bbreak\b/g,
    /\bcontinue\b/g,
    /\b&&/g,
    /\b\|\|/g,
    /\?/g,
    /:/g
  ];

  for (const pattern of controlPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}

function calculateMaintainabilityIndex(lines: number, complexity: number, issues: number): number {
  // Calcul simplifié de l'index de maintenabilité
  // Formule: 171 - 5.2 * ln(complexité) - 0.23 * issues - 16.2 * ln(lines)
  if (lines === 0 || complexity === 0) return 100;

  const logComplexity = Math.log(complexity);
  const logLines = Math.log(lines);

  let mi = 171 - (5.2 * logComplexity) - (0.23 * issues) - (16.2 * logLines);

  // Normaliser entre 0 et 100
  mi = Math.max(0, Math.min(100, mi));

  return Math.round(mi);
}

function analyzeFile(filePath: string): FileQuality {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').length;
  const complexity = calculateFileComplexity(content);

  // Détecter les problèmes courants
  let issues = 0;

  // Longues lignes
  const longLines = content.split('\n').filter(line => line.length > 120).length;
  issues += Math.min(longLines, 10);

  // Fichiers trop longs
  if (lines > 500) issues += 5;
  if (lines > 1000) issues += 10;

  // Complexité élevée
  if (complexity > 20) issues += 5;
  if (complexity > 50) issues += 10;

  // Code commenté
  const commentedCode = (content.match(/\/\/\s*TODO|\/\/\s*FIXME|\/\/\s*XXX/g) || []).length;
  issues += Math.min(commentedCode, 5);

  // Duplication simple (lignes identiques consécutives)
  const duplicateLines = detectSimpleDuplication(content);
  issues += Math.min(duplicateLines, 10);

  const maintainability = calculateMaintainabilityIndex(lines, complexity, issues);

  // Calcul du score (0-100)
  let score = 100;
  score -= Math.min(issues * 2, 40); // Pénalité pour les issues
  score -= Math.max(0, (lines - 200) / 10); // Pénalité pour les fichiers longs
  score -= Math.max(0, (complexity - 15) / 2); // Pénalité pour la complexité
  score = Math.max(0, Math.min(100, score));

  return {
    filePath: path.relative(process.cwd(), filePath),
    metrics: {
      lines,
      complexity,
      maintainability,
      duplication: duplicateLines,
      issues
    },
    score: Math.round(score)
  };
}

function detectSimpleDuplication(content: string): number {
  const lines = content.split('\n');
  let duplicateCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const currentLine = lines[i].trim();
    const prevLine = lines[i - 1].trim();

    // Ignorer les lignes vides ou très courtes
    if (currentLine.length < 10 || prevLine.length < 10) continue;

    // Ignorer les imports, exports, commentaires
    if (currentLine.startsWith('import ') || currentLine.startsWith('export ') ||
      currentLine.startsWith('//') || currentLine.startsWith('/*') ||
      prevLine.startsWith('import ') || prevLine.startsWith('export ') ||
      prevLine.startsWith('//') || prevLine.startsWith('/*')) {
      continue;
    }

    if (currentLine === prevLine) {
      duplicateCount++;
    }
  }

  return duplicateCount;
}

function runESLint(): number {
  try {
    console.log('🔍 Exécution d\'ESLint...');
    const result = execSync('npx eslint . --format=json', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    const eslintReport = JSON.parse(result);
    let totalIssues = 0;

    eslintReport.forEach((file: any) => {
      totalIssues += file.errorCount + file.warningCount;
    });

    console.log(`   📊 ${totalIssues} problèmes ESLint trouvés`);
    return totalIssues;
  } catch (error: any) {
    // ESLint retourne un code d'erreur quand il trouve des problèmes
    if (error.status !== 0 && error.stdout) {
      try {
        const eslintReport = JSON.parse(error.stdout);
        let totalIssues = 0;

        eslintReport.forEach((file: any) => {
          totalIssues += file.errorCount + file.warningCount;
        });

        console.log(`   📊 ${totalIssues} problèmes ESLint trouvés`);
        return totalIssues;
      } catch (parseError) {
        console.log('   ⚠️  Impossible de parser le rapport ESLint');
      }
    }
    console.log('   ⚠️  ESLint non disponible ou erreur d\'exécution');
    return 0;
  }
}

function runTypeScriptCompiler(): number {
  try {
    console.log('🔍 Vérification TypeScript...');
    const result = execSync('npx tsc --noEmit --project .', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    // Si tsc réussit sans erreur
    console.log('   ✅ Aucune erreur TypeScript');
    return 0;
  } catch (error: any) {
    if (error.stderr) {
      const errorLines = error.stderr.split('\n').filter((line: string) => line.includes('error'));
      const errorCount = errorLines.length;
      console.log(`   📊 ${errorCount} erreurs TypeScript trouvées`);
      return errorCount;
    }
    console.log('   ⚠️  TypeScript non disponible ou erreur d\'exécution');
    return 0;
  }
}

function getTestCoverage(): number {
  try {
    console.log('🔍 Vérification de la couverture de tests...');
    const result = execSync('npx jest --coverage --json', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    const coverageReport = JSON.parse(result);
    const totalCoverage = coverageReport.coverageMap?.total?.statements?.pct || 0;

    console.log(`   📊 Couverture de tests: ${totalCoverage}%`);
    return totalCoverage;
  } catch (error: any) {
    console.log('   ⚠️  Tests non disponibles ou erreur d\'exécution');
    return 0;
  }
}

async function main() {
  console.log('📊 Génération du rapport de qualité...');

  const startTime = Date.now();
  const rootDir = process.cwd();

  // Trouver tous les fichiers
  const allFiles: string[] = [];

  function scanFiles(dir: string) {
    try {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          if (!shouldProcessFile(fullPath)) {
            continue;
          }
          scanFiles(fullPath);
        } else if (shouldProcessFile(fullPath)) {
          allFiles.push(fullPath);
        }
      }
    } catch (error: any) {
      console.warn(`⚠️  Impossible de scanner ${dir}:`, error.message);
    }
  }

  scanFiles(rootDir);

  console.log(`📁 ${allFiles.length} fichiers à analyser`);

  // Analyser chaque fichier
  const fileQualities: FileQuality[] = [];
  let processedFiles = 0;

  for (const file of allFiles) {
    try {
      const quality = analyzeFile(file);
      fileQualities.push(quality);
      processedFiles++;

      if (processedFiles % 20 === 0) {
        console.log(`  📄 ${processedFiles}/${allFiles.length} fichiers analysés...`);
      }
    } catch (error: any) {
      console.warn(`⚠️  Impossible d'analyser ${file}:`, error.message);
    }
  }

  // Exécuter les outils externes
  const eslintIssues = runESLint();
  const typescriptErrors = runTypeScriptCompiler();
  const testCoverage = getTestCoverage();

  // Calculer les statistiques globales
  const totalLines = fileQualities.reduce((sum, f) => sum + f.metrics.lines, 0);
  const totalComplexity = fileQualities.reduce((sum, f) => sum + f.metrics.complexity, 0);
  const totalIssues = fileQualities.reduce((sum, f) => sum + f.metrics.issues, 0) + eslintIssues + typescriptErrors;
  const averageScore = fileQualities.reduce((sum, f) => sum + f.score, 0) / fileQualities.length;

  // Catégoriser les fichiers par score
  const filesByScore = {
    excellent: fileQualities.filter(f => f.score >= 90).length,
    good: fileQualities.filter(f => f.score >= 70 && f.score < 90).length,
    moderate: fileQualities.filter(f => f.score >= 50 && f.score < 70).length,
    poor: fileQualities.filter(f => f.score >= 30 && f.score < 50).length,
    critical: fileQualities.filter(f => f.score < 30).length
  };

  // Définir les métriques de qualité
  const metrics: QualityMetric[] = [
    {
      name: 'Score moyen des fichiers',
      value: averageScore,
      max: 100,
      score: averageScore,
      weight: 0.3,
      description: 'Score de qualité moyen de tous les fichiers'
    },
    {
      name: 'Couverture de tests',
      value: testCoverage,
      max: 100,
      score: testCoverage,
      weight: 0.25,
      description: 'Pourcentage de code couvert par les tests'
    },
    {
      name: 'Complexité moyenne',
      value: totalComplexity / fileQualities.length,
      max: 50,
      score: Math.max(0, 100 - ((totalComplexity / fileQualities.length) * 2)),
      weight: 0.2,
      description: 'Complexité cyclomatique moyenne'
    },
    {
      name: 'Problèmes de code',
      value: totalIssues,
      max: 100,
      score: Math.max(0, 100 - (totalIssues * 2)),
      weight: 0.15,
      description: 'Nombre total de problèmes (ESLint, TypeScript, duplication)'
    },
    {
      name: 'Maintenabilité',
      value: fileQualities.reduce((sum, f) => sum + f.metrics.maintainability, 0) / fileQualities.length,
      max: 100,
      score: fileQualities.reduce((sum, f) => sum + f.metrics.maintainability, 0) / fileQualities.length,
      weight: 0.1,
      description: 'Index de maintenabilité moyen'
    }
  ];

  // Calculer le score global pondéré
  const overallScore = metrics.reduce((sum, metric) => sum + (metric.score * metric.weight), 0);

  // Générer des recommandations
  const recommendations: string[] = [];

  if (testCoverage < 80) {
    recommendations.push(`🚨 Augmenter la couverture de tests (actuellement ${testCoverage}%, cible: 80%)`);
  }

  if (eslintIssues > 0) {
    recommendations.push(`🔧 Corriger les ${eslintIssues} problèmes ESLint`);
  }

  if (typescriptErrors > 0) {
    recommendations.push(`🔧 Corriger les ${typescriptErrors} erreurs TypeScript`);
  }

  const criticalFiles = fileQualities.filter(f => f.score < 30);
  if (criticalFiles.length > 0) {
    recommendations.push(`⚠️  Refactoriser ${criticalFiles.length} fichiers critiques (score < 30)`);
    criticalFiles.slice(0, 5).forEach(f => {
      recommendations.push(`   - ${f.filePath} (score: ${f.score})`);
    });
  }

  const longFiles = fileQualities.filter(f => f.metrics.lines > 500);
  if (longFiles.length > 0) {
    recommendations.push(`📏 Diviser ${longFiles.length} fichiers trop longs (> 500 lignes)`);
  }

  // Générer le rapport
  const qualityReport: QualityReport = {
    generated: new Date().toISOString(),
    overallScore: Math.round(overallScore),
    metrics,
    files: fileQualities,
    recommendations,
    stats: {
      totalFiles: fileQualities.length,
      filesByScore,
      averageLines: Math.round(totalLines / fileQualities.length),
      averageComplexity: Math.round(totalComplexity / fileQualities.length),
      totalIssues
    }
  };

  // Écrire le fichier de sortie
  const outputPath = path.join(rootDir, 'audit', 'quality_report.json');
  fs.writeFileSync(outputPath, JSON.stringify(qualityReport, null, 2), 'utf8');

  const elapsedTime = Date.now() - startTime;

  console.log('\n✅ Rapport de qualité généré !');
  console.log(`📊 Score global: ${Math.round(overallScore)}/100`);
  console.log(`\n📈 Distribution des fichiers par score:`);
  console.log(`   🏆 Excellent (90-100): ${filesByScore.excellent} fichiers`);
  console.log(`   👍 Bon (70-89): ${filesByScore.good} fichiers`);
  console.log(`   ⚠️  Modéré (50-69): ${filesByScore.moderate} fichiers`);
  console.log(`   🔴 Pauvre (30-49): ${filesByScore.poor} fichiers`);
  console.log(`   🚨 Critique (0-29): ${filesByScore.critical} fichiers`);

  console.log(`\n📊 Métriques clés:`);
  metrics.forEach(metric => {
    console.log(`   ${metric.name}: ${metric.value.toFixed(2)} (score: ${metric.score.toFixed(1)})`);
  });

  console.log(`\n💡 Recommandations (${recommendations.length}):`);
  recommendations.forEach((rec, index) => {
    console.log(`   ${index + 1}. ${rec}`);
  });

  console.log(`\n📁 Fichier généré:`);
  console.log(`   📄 ${outputPath}`);
  console.log(`   ⏱️  Temps d'exécution: ${elapsedTime}ms`);
}

// Exécution
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: any) => {
    console.error('❌ Erreur lors de la génération du rapport de qualité:', error);
    process.exit(1);
  });
}

export { analyzeFile, calculateFileComplexity, calculateMaintainabilityIndex };
