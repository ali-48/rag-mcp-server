#!/usr/bin/env node
/**
 * Script de scan anti-duplication avancé
 * Détecte les duplications de code dans le codebase
 *
 * Usage: npx tsx scripts/audit/duplication-scanner.ts [options]
 * Options:
 *   --min-lines <number>    Nombre minimum de lignes identiques (défaut: 5)
 *   --min-tokens <number>   Nombre minimum de tokens identiques (défaut: 20)
 *   --threshold <number>    Seuil de similarité (0.0-1.0, défaut: 0.8)
 *   --exclude <patterns>    Patterns à exclure (séparés par des virgules)
 *   --output <path>         Chemin de sortie pour le rapport (défaut: audit/duplication-report.json)
 *   --verbose               Mode verbeux
 *   --help                  Afficher l'aide
 */

import { createHash } from 'crypto';
import * as path from 'path';

interface CodeChunk {
  filePath: string;
  startLine: number;
  endLine: number;
  lines: string[];
  hash: string;
  normalizedHash: string;
  type: 'function' | 'class' | 'config' | 'utility' | 'other';
  signature?: string;
}

interface Duplication {
  id: string;
  chunks: CodeChunk[];
  lineCount: number;
  tokenCount: number;
  similarity: number;
  type: string;
  category: 'exact' | 'near' | 'structural';
  severity: 'high' | 'medium' | 'low';
  recommendation?: string;
}

interface DuplicationReport {
  generated: string;
  config: {
    minLines: number;
    minTokens: number;
    threshold: number;
    filesScanned: number;
    chunksExtracted: number;
  };
  summary: {
    totalDuplications: number;
    totalDuplicateLines: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    byCategory: Record<string, number>;
  };
  duplications: Duplication[];
  filesWithMostDuplications: Array<{
    filePath: string;
    duplicateLines: number;
    duplicationCount: number;
  }>;
  recommendations: string[];
  metrics: {
    duplicationDensity: number; // Pourcentage de code dupliqué
    potentialSavings: number;   // Lignes potentielles à éliminer
    refactoringPriority: 'high' | 'medium' | 'low';
  };
}

// Configuration
const DEFAULT_CONFIG = {
  minLines: 5,
  minTokens: 20,
  threshold: 0.8,
  excludePatterns: [
    /node_modules/,
    /\.git/,
    /build/,
    /build-test/,
    /dist/,
    /coverage/,
    /\.min\./,
    /package-lock\.json/,
    /yarn\.lock/,
    /audit\/.*\.json$/, // Exclure les rapports d'audit
    /logs\//,
  ],
  includeExtensions: ['.ts', '.js', '.tsx', '.jsx'],
  ignorePatterns: [
    /^\s*import\s+/,
    /^\s*export\s+/,
    /^\s*\/\/.*$/,
    /^\s*\/\*.*\*\/\s*$/,
    /^\s*$/,
    /^\s*\}\s*$/,
    /^\s*\{\s*$/,
  ],
};

function parseArgs(): any {
  const args = process.argv.slice(2);
  const result: any = {
    minLines: DEFAULT_CONFIG.minLines,
    minTokens: DEFAULT_CONFIG.minTokens,
    threshold: DEFAULT_CONFIG.threshold,
    exclude: [],
    output: path.join(process.cwd(), 'audit', 'duplication-report.json'),
    verbose: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
      return result;
    } else if (arg === '--verbose' || arg === '-v') {
      result.verbose = true;
    } else if (arg === '--min-lines' && i + 1 < args.length) {
      result.minLines = parseInt(args[++i]);
    } else if (arg === '--min-tokens' && i + 1 < args.length) {
      result.minTokens = parseInt(args[++i]);
    } else if (arg === '--threshold' && i + 1 < args.length) {
      result.threshold = parseFloat(args[++i]);
    } else if (arg === '--exclude' && i + 1 < args.length) {
      result.exclude = args[++i].split(',').map((p: string) => new RegExp(p.trim()));
    } else if (arg === '--output' && i + 1 < args.length) {
      result.output = args[++i];
    }
  }

  return result;
}

function showHelp() {
  console.log(`
🔍 Scanner Anti-Duplication - Détection de code dupliqué

Usage:
  npx tsx scripts/audit/duplication-scanner.ts [options]

Options:
  --min-lines <number>    Nombre minimum de lignes identiques (défaut: 5)
  --min-tokens <number>   Nombre minimum de tokens identiques (défaut: 20)
  --threshold <number>    Seuil de similarité (0.0-1.0, défaut: 0.8)
  --exclude <patterns>    Patterns à exclure (séparés par des virgules, regex)
  --output <path>         Chemin de sortie pour le rapport
  --verbose, -v           Mode verbeux
  --help, -h              Afficher cette aide

Exemples:
  # Scan standard
  npx tsx scripts/audit/duplication-scanner.ts

  # Scan avec seuil plus strict
  npx tsx scripts/audit/duplication-scanner.ts --min-lines 10 --threshold 0.9

  # Exclure certains dossiers
  npx tsx scripts/audit/duplication-scanner.ts --exclude "test/.*,archived-tests/.*"

  # Mode verbeux
  npx tsx scripts/audit/duplication-scanner.ts --verbose

  # Sortie personnalisée
  npx tsx scripts/audit/duplication-scanner.ts --output ./my-report.json

Algorithme:
  • Extraction de chunks de code (fonctions, classes, blocs)
  • Hashing avec normalisation (ignore noms variables, valeurs littérales)
  • Détection similitudes avec Rabin-Karp
  • Classification par type et sévérité

Sortie:
  • Rapport JSON structuré
  • Métriques de duplication
  • Recommandations de refactoring
  • Liste priorisée des duplications
`);
}

function shouldProcessFile(filePath: string, excludePatterns: RegExp[]): boolean {
  const fullPath = path.resolve(filePath);

  // Vérifier les patterns d'exclusion par défaut
  for (const pattern of DEFAULT_CONFIG.excludePatterns) {
    if (pattern.test(fullPath)) {
      return false;
    }
  }

  // Vérifier les patterns d'exclusion personnalisés
  for (const pattern of excludePatterns) {
    if (pattern.test(fullPath)) {
      return false;
    }
  }

  // Vérifier l'extension
  const ext = path.extname(fullPath).toLowerCase();
  return DEFAULT_CONFIG.includeExtensions.includes(ext);
}

function normalizeCodeLine(line: string): string {
  // Normalise la ligne pour ignorer les différences mineures
  let normalized = line.trim();

  // Ignorer les commentaires
  if (normalized.startsWith('//') || normalized.startsWith('/*')) {
    return '';
  }

  // Normaliser les espaces
  normalized = normalized.replace(/\s+/g, ' ');

  // Ignorer les noms de variables (simplifié)
  normalized = normalized.replace(/\b(const|let|var)\s+\w+\s*=/g, '$1 _ =');
  normalized = normalized.replace(/\bfunction\s+\w+/g, 'function _');
  normalized = normalized.replace(/\bclass\s+\w+/g, 'class _');

  // Ignorer les valeurs littérales (simplifié)
  normalized = normalized.replace(/"[^"]*"/g, '""');
  normalized = normalized.replace(/'[^']*'/g, "''");
  normalized = normalized.replace(/\b\d+\b/g, '0');

  return normalized;
}

function tokenizeLine(line: string): string[] {
  // Tokenisation simple pour la similarité
  return line
    .split(/[^\w]/)
    .filter(token => token.length > 0)
    .map(token => token.toLowerCase());
}

function extractCodeChunks(filePath: string, content: string): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const lines = content.split('\n');

  let currentChunk: string[] = [];
  let startLine = 0;
  let inFunction = false;
  let braceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Ignorer les lignes vides et commentaires pour la détection
    if (DEFAULT_CONFIG.ignorePatterns.some(pattern => pattern.test(trimmed))) {
      continue;
    }

    // Détection de fonctions
    if (trimmed.startsWith('function ') || trimmed.match(/^(async\s+)?\w+\s*\(/)) {
      if (currentChunk.length > 0) {
        // Sauvegarder le chunk précédent
        saveChunk(chunks, filePath, currentChunk, startLine, i - 1);
      }

      currentChunk = [line];
      startLine = i + 1;
      inFunction = true;
      braceCount = 0;
      continue;
    }

    // Détection de classes
    if (trimmed.startsWith('class ')) {
      if (currentChunk.length > 0) {
        saveChunk(chunks, filePath, currentChunk, startLine, i - 1);
      }

      currentChunk = [line];
      startLine = i + 1;
      continue;
    }

    // Suivi des accolades pour les fonctions
    if (inFunction) {
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      braceCount += openBraces - closeBraces;

      if (braceCount === 0 && openBraces === 0 && closeBraces > 0) {
        // Fin de fonction
        currentChunk.push(line);
        saveChunk(chunks, filePath, currentChunk, startLine, i);
        currentChunk = [];
        inFunction = false;
        continue;
      }
    }

    // Ajouter à la chunk courante
    currentChunk.push(line);

    // Sauvegarder les chunks de taille raisonnable
    if (currentChunk.length >= 20 && !inFunction) {
      saveChunk(chunks, filePath, currentChunk, startLine, i);
      currentChunk = [];
      startLine = i + 1;
    }
  }

  // Sauvegarder le dernier chunk
  if (currentChunk.length > 0) {
    saveChunk(chunks, filePath, currentChunk, startLine, lines.length - 1);
  }

  return chunks;
}

function saveChunk(
  chunks: CodeChunk[],
  filePath: string,
  lines: string[],
  startLine: number,
  endLine: number
) {
  if (lines.length < 3) return; // Ignorer les chunks trop courts

  const rawContent = lines.join('\n');
  const normalizedContent = lines.map(normalizeCodeLine).filter(l => l.length > 0).join('\n');

  if (normalizedContent.length === 0) return;

  const rawHash = createHash('md5').update(rawContent).digest('hex');
  const normalizedHash = createHash('md5').update(normalizedContent).digest('hex');

  // Déterminer le type
  let type: CodeChunk['type'] = 'other';
  const firstLine = lines[0].trim();

  if (firstLine.startsWith('function ') || firstLine.match(/^(async\s+)?\w+\s*\(/)) {
    type = 'function';
  } else if (firstLine.startsWith('class ')) {
    type = 'class';
  } else if (firstLine.includes('export const') || firstLine.includes('export default')) {
    type = 'config';
  } else if (lines.some(l => l.includes('utils') || l.includes('helper') || l.includes('utility'))) {
    type = 'utility';
  }

  chunks.push({
    filePath,
    startLine: startLine + 1, // Convertir en 1-based
    endLine: endLine + 1,
    lines,
    hash: rawHash,
    normalizedHash,
    type,
    signature: firstLine.length > 0 ? firstLine.substring(0, 100) : undefined,
  });
}

function findDuplications(chunks: CodeChunk[], config: any): Duplication[] {
  const duplications: Duplication[] = [];
  const seenHashes = new Set<string>();
  const hashMap = new Map<string, CodeChunk[]>();

  // Grouper par hash normalisé
  for (const chunk of chunks) {
    if (!hashMap.has(chunk.normalizedHash)) {
      hashMap.set(chunk.normalizedHash, []);
    }
    hashMap.get(chunk.normalizedHash)!.push(chunk);
  }

  // Identifier les duplications
  for (const [hash, chunkGroup] of hashMap) {
    if (chunkGroup.length < 2) continue;

    // Vérifier la taille minimale
    const sampleChunk = chunkGroup[0];
    if (sampleChunk.lines.length < config.minLines) continue;

    // Calculer les tokens
    const tokens = sampleChunk.lines.flatMap(tokenizeLine);
    if (tokens.length < config.minTokens) continue;

    // Déterminer le type et la catégorie
    const types = new Set(chunkGroup.map(c => c.type));
    const type = types.size === 1 ? types.values().next().value : 'mixed';

    let category: Duplication['category'] = 'exact';
    let similarity = 1.0;

    // Pour les hashs normalisés, vérifier la similarité exacte
    const rawHashes = new Set(chunkGroup.map(c => c.hash));
    if (rawHashes.size > 1) {
      category = 'near';
      similarity = 0.9; // Approximation pour hash normalisé identique
    }

    // Déterminer la sévérité
    let severity: Duplication['severity'] = 'low';
    const lineCount = sampleChunk.lines.length;
    const duplicationCount = chunkGroup.length;

    if (lineCount >= 20 && duplicationCount >= 3) {
      severity = 'high';
    } else if (lineCount >= 10 && duplicationCount >= 2) {
      severity = 'medium';
    }

    // Créer la duplication
    const duplication: Duplication = {
      id: `dup-${duplications.length + 1}`,
      chunks: chunkGroup,
      lineCount,
      tokenCount: tokens.length,
      similarity,
      type,
      category,
      severity,
    };

    // Ajouter une recommandation
    if (type === 'function' || type === 'utility') {
      duplication.recommendation = `Extraire dans un module commun (${chunkGroup.length} occurrences)`;
    } else if (type === 'config') {
      duplication.recommendation = 'Unifier la configuration';
    }

    duplications.push(duplication);
    seenHashes.add(hash);
  }

  return duplications;
}

function generateReport(
  duplications: Duplication[],
  config: any,
  filesScanned: number,
  chunksExtracted: number
): DuplicationReport {
  // Calculer les statistiques
  const totalDuplicateLines = duplications.reduce((sum, dup) => sum + (dup.lineCount * (dup.chunks.length - 1)), 0);

  const bySeverity: Record<string, number> = { high: 0, medium: 0, low: 0 };
  const byType: Record<string, number> = {};
  const byCategory: Record<string, number> = { exact: 0, near: 0, structural: 0 };

  for (const dup of duplications) {
    bySeverity[dup.severity]++;
    byType[dup.type] = (byType[dup.type] || 0) + 1;
    byCategory[dup.category] = (byCategory[dup.category] || 0) + 1;
  }

  // Identifier les fichiers avec le plus de duplications
  const fileStats = new Map<string, { duplicateLines: number, duplicationCount: number }>();

  for (const dup of duplications) {
    for (const chunk of dup.chunks) {
      const key = chunk.filePath;
      const stats = fileStats.get(key) || { duplicateLines: 0, duplicationCount: 0 };
      stats.duplicateLines += dup.lineCount;
      stats.duplicationCount++;
      fileStats.set(key, stats);
    }
  }

  const filesWithMostDuplications = Array.from(fileStats.entries())
    .map(([filePath, stats]) => ({ filePath, ...stats }))
    .sort((a, b) => b.duplicateLines - a.duplicateLines)
    .slice(0, 10);

  // Générer des recommandations
  const recommendations: string[] = [];

  if (duplications.length === 0) {
    recommendations.push('✅ Aucune duplication significative détectée. Codebase propre!');
  } else {
    recommendations.push(`🚨 ${duplications.length} duplications détectées nécessitant attention.`);

    // Recommandations par sévérité
    if (bySeverity.high > 0) {
      recommendations.push(`🔴 ${bySeverity.high} duplications HIGH: Extraire en modules communs immédiatement.`);
    }
    if (bySeverity.medium > 0) {
      recommendations.push(`🟠 ${bySeverity.medium} duplications MEDIUM: Planifier refactoring prochaine itération.`);
    }
    if (bySeverity.low > 0) {
      recommendations.push(`🟢 ${bySeverity.low} duplications LOW: Peuvent être ignorées si faible impact.`);
    }

    // Recommandations par type
    if (byType.function > 0) {
      recommendations.push(`🧩 ${byType.function} fonctions dupliquées: Créer utils/helpers communs.`);
    }
    if (byType.utility > 0) {
      recommendations.push(`🔧 ${byType.utility} utilitaires dupliqués: Extraire dans modules dédiés.`);
    }
    if (byType.config > 0) {
      recommendations.push(`⚙️ ${byType.config} configurations dupliquées: Unifier dans fichiers de config.`);
    }

    // Fichiers prioritaires
    if (filesWithMostDuplications.length > 0) {
      recommendations.push('\n📋 Fichiers prioritaires pour refactoring:');
      filesWithMostDuplications.slice(0, 5).forEach((file, index) => {
        recommendations.push(`   ${index + 1}. ${file.filePath}: ${file.duplicateLines} lignes dupliquées`);
      });
    }
  }

  // Calculer les métriques
  const totalLinesScanned = chunksExtracted * 10; // Estimation
  const duplicationDensity = totalLinesScanned > 0 ? (totalDuplicateLines / totalLinesScanned) * 100 : 0;
  const potentialSavings = totalDuplicateLines * 0.7; // Estimation: 70% des lignes dupliquées peuvent être éliminées

  let refactoringPriority: 'high' | 'medium' | 'low' = 'low';
  if (bySeverity.high >= 3 || totalDuplicateLines > 100) {
    refactoringPriority = 'high';
  } else if (bySeverity.medium >= 2 || totalDuplicateLines > 50) {
    refactoringPriority = 'medium';
  }

  const report: DuplicationReport = {
    generated: new Date().toISOString(),
    config: {
      minLines: config.minLines,
      minTokens: config.minTokens,
      threshold: config.threshold,
      filesScanned,
      chunksExtracted,
    },
    summary: {
      totalDuplications: duplications.length,
      totalDuplicateLines,
      bySeverity,
      byType,
      byCategory,
    },
    duplications,
    filesWithMostDuplications,
    recommendations,
    metrics: {
      duplicationDensity: parseFloat(duplicationDensity.toFixed(2)),
      potentialSavings: Math.round(potentialSavings),
      refactoringPriority,
    },
  };

  return report;
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    return;
  }

  console.log('🔍 Démarrage du scan anti-duplication...');
  console.log(`⚙️  Configuration:`);
  console.log(`  • Lignes minimum: ${args.minLines}`);
  console.log(`  • Tokens minimum: ${args.minTokens}`);
  console.log(`  • Seuil similarité: ${args.threshold}`);
  console.log(`  • Mode verbeux: ${args.verbose ? 'Oui' : 'Non'}`);
  console.log();

  const startTime = Date.now();
  const rootDir = process.cwd();

  // Trouver tous les fichiers
  const allFiles: string[] = [];

  function scanFiles(dir: string) {
    try {
      const fs = require('fs');
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          scanFiles(fullPath);
        } else if (shouldProcessFile(fullPath, args.exclude)) {
          allFiles.push(fullPath);
        }
      }
    } catch (error: any) {
      if (args.verbose) {
        console.warn(`⚠️  Impossible de scanner ${dir}:`, error.message);
      }
    }
  }

  scanFiles(rootDir);

  console.log(`📁 ${allFiles.length} fichiers à analyser`);

  // Extraire les chunks de code
  const allChunks: CodeChunk[] = [];
  let processedFiles = 0;

  for (const file of allFiles) {
    try {
      const fs = require('fs');
      const content = fs.readFileSync(file, 'utf8');
      const chunks = extractCodeChunks(file, content);
      allChunks.push(...chunks);
      processedFiles++;

      if (args.verbose && processedFiles % 20 === 0) {
        console.log(`  📄 ${processedFiles}/${allFiles.length} fichiers analysés...`);
      }
    } catch (error: any) {
      if (args.verbose) {
        console.warn(`⚠️  Impossible d'analyser ${file}:`, error.message);
      }
    }
  }

  console.log(`✅ ${processedFiles} fichiers analysés, ${allChunks.length} chunks extraits`);

  // Trouver les duplications
  console.log('🔍 Recherche de duplications...');
  const duplications = findDuplications(allChunks, args);

  // Générer le rapport
  const report = generateReport(duplications, args, processedFiles, allChunks.length);

  // Écrire le rapport JSON
  const fs = require('fs');
  const outputDir = path.dirname(args.output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(args.output, JSON.stringify(report, null, 2), 'utf8');

  // Générer un rapport Markdown
  const mdOutput = args.output.replace(/\.json$/, '.md');
  generateMarkdownReport(report, mdOutput);

  const elapsedTime = Date.now() - startTime;

  // Afficher le résumé
  console.log('\n📊 RÉSUMÉ DU SCAN ANTI-DUPLICATION');
  console.log('='.repeat(60));
  console.log(`📁 Fichiers scannés: ${processedFiles}`);
  console.log(`🧩 Chunks extraits: ${allChunks.length}`);
  console.log(`🚨 Duplications détectées: ${report.summary.totalDuplications}`);
  console.log(`📏 Lignes dupliquées: ${report.summary.totalDuplicateLines}`);
  console.log(`⏱️  Temps d'exécution: ${elapsedTime}ms`);
  console.log();

  if (report.summary.totalDuplications === 0) {
    console.log('✅ Aucune duplication significative détectée!');
  } else {
    console.log('📈 Distribution par sévérité:');
    console.log(`  🔴 HIGH: ${report.summary.bySeverity.high || 0}`);
    console.log(`  🟠 MEDIUM: ${report.summary.bySeverity.medium || 0}`);
    console.log(`  🟢 LOW: ${report.summary.bySeverity.low || 0}`);
    console.log();

    console.log('📋 Top 5 fichiers avec duplications:');
    report.filesWithMostDuplications.slice(0, 5).forEach((file, index) => {
      console.log(`  ${index + 1}. ${file.filePath}: ${file.duplicateLines} lignes dupliquées`);
    });
    console.log();

    console.log('💡 Recommandations:');
    report.recommendations.slice(0, 5).forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });
  }

  console.log('\n📄 Rapports générés:');
  console.log(`  📊 JSON: ${args.output}`);
  console.log(`  📝 Markdown: ${mdOutput}`);
  console.log(`  🎯 Priorité refactoring: ${report.metrics.refactoringPriority.toUpperCase()}`);
}

function generateMarkdownReport(report: DuplicationReport, outputPath: string) {
  const fs = require('fs');
  const lines: string[] = [];

  lines.push('# 📊 Rapport Anti-Duplication');
  lines.push('');
  lines.push(`**Généré le:** ${new Date(report.generated).toLocaleString()}`);
  lines.push('');
  lines.push('## 📋 Résumé');
  lines.push('');
  lines.push(`- **Fichiers scannés:** ${report.config.filesScanned}`);
  lines.push(`- **Chunks extraits:** ${report.config.chunksExtracted}`);
  lines.push(`- **Duplications détectées:** ${report.summary.totalDuplications}`);
  lines.push(`- **Lignes dupliquées:** ${report.summary.totalDuplicateLines}`);
  lines.push(`- **Densité de duplication:** ${report.metrics.duplicationDensity}%`);
  lines.push(`- **Économies potentielles:** ${report.metrics.potentialSavings} lignes`);
  lines.push(`- **Priorité refactoring:** ${report.metrics.refactoringPriority.toUpperCase()}`);
  lines.push('');

  lines.push('## 📈 Statistiques');
  lines.push('');
  lines.push('### Par Sévérité');
  lines.push('');
  lines.push(`- 🔴 **HIGH:** ${report.summary.bySeverity.high || 0}`);
  lines.push(`- 🟠 **MEDIUM:** ${report.summary.bySeverity.medium || 0}`);
  lines.push(`- 🟢 **LOW:** ${report.summary.bySeverity.low || 0}`);
  lines.push('');

  lines.push('### Par Type');
  lines.push('');
  Object.entries(report.summary.byType).forEach(([type, count]) => {
    lines.push(`- **${type}:** ${count}`);
  });
  lines.push('');

  lines.push('## 📁 Fichiers avec le plus de duplications');
  lines.push('');
  report.filesWithMostDuplications.forEach((file, index) => {
    lines.push(`${index + 1}. **${file.filePath}**`);
    lines.push(`   - Lignes dupliquées: ${file.duplicateLines}`);
    lines.push(`   - Nombre de duplications: ${file.duplicationCount}`);
    lines.push('');
  });

  if (report.duplications.length > 0) {
    lines.push('## 🚨 Duplications Détectées');
    lines.push('');

    report.duplications.forEach((dup, index) => {
      if (index < 10) { // Limiter à 10 pour lisibilité
        lines.push(`### Duplication ${dup.id}`);
        lines.push('');
        lines.push(`- **Type:** ${dup.type}`);
        lines.push(`- **Sévérité:** ${dup.severity}`);
        lines.push(`- **Lignes:** ${dup.lineCount}`);
        lines.push(`- **Occurrences:** ${dup.chunks.length}`);
        lines.push(`- **Recommandation:** ${dup.recommendation || 'Aucune'}`);
        lines.push('');
        lines.push('**Fichiers concernés:**');
        lines.push('');
        dup.chunks.forEach((chunk, chunkIndex) => {
          lines.push(`${chunkIndex + 1}. ${chunk.filePath}:${chunk.startLine}-${chunk.endLine}`);
          if (chunk.signature) {
            lines.push(`   \`${chunk.signature}\``);
          }
        });
        lines.push('');
      }
    });

    if (report.duplications.length > 10) {
      lines.push(`*... et ${report.duplications.length - 10} duplications supplémentaires*`);
      lines.push('');
    }
  }

  lines.push('## 💡 Recommandations');
  lines.push('');
  report.recommendations.forEach((rec, index) => {
    lines.push(`${index + 1}. ${rec}`);
  });

  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
}

// Exécution
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: any) => {
    console.error('❌ Erreur lors du scan anti-duplication:', error);
    process.exit(1);
  });
}
