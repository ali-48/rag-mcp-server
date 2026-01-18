#!/usr/bin/env node

// scripts/validate-json-strict.js
// Validateur automatique pour R3 (JSON strict) - Intégration CI/CD
// Usage: node scripts/validate-json-strict.js [options]
// Options:
//   --ci           Mode CI (sortie JSON uniquement, exit code non-zero si violations)
//   --strict       Mode strict (bloque sur toute violation)
//   --exclude      Patterns à exclure (séparés par des virgules)
//   --help         Afficher l'aide

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  // Patterns pour détecter les violations R3
  VIOLATION_PATTERNS: [
    // Icônes dans JSON métier (stdout) - champs critiques
    /"result"\s*:\s*\{[^}]*["']?[🔴🟢🟡🔵⚫⚪🟣🟠🟤🧪✅❌⚠️🚨📊📈📉📋📁📂📄📑]/,
    /"status"\s*:\s*\{[^}]*["']?[🔴🟢🟡🔵⚫⚪🟣🟠🟤🧪✅❌⚠️🚨📊📈📉📋📁📂📄📑]/,
    /"data"\s*:\s*\{[^}]*["']?[🔴🟢🟡🔵⚫⚪🟣🟠🟤🧪✅❌⚠️🚨📊📈📉📋📁📂📄📑]/,
    /"error"\s*:\s*\{[^}]*["']?[🔴🟢🟡🔵⚫⚪🟣🟠🟤🧪✅❌⚠️🚨📊📈📉📋📁📂📄📑]/,

    // Icônes dans les valeurs JSON (tous champs)
    /:\s*["'][🔴🟢🟡🔵⚫⚪🟣🟠🟤🧪✅❌⚠️🚨📊📈📉📋📁📂📄📑]/,
  ],

  // Patterns pour détecter les fichiers à scanner
  FILE_PATTERNS: [
    /\.ts$/,
    /\.js$/,
    /\.tsx?$/,
    /\.jsx?$/,
    /\.json$/,
  ],

  // Patterns pour exclure certains fichiers/dossiers
  EXCLUDE_PATTERNS: [
    /node_modules/,
    /\.git/,
    /coverage/,
    /build/,
    /dist/,
    /\.min\./,
    /package-lock\.json/,
    /yarn\.lock/,
    /scripts\/audit\/json-strict-audit-report\.json$/, // Exclure le rapport d'audit lui-même
    /scripts\/audit\/json-strict-audit-report\.md$/,   // Exclure le rapport Markdown
  ],

  // Fichiers à toujours scanner (même s'ils sont exclus par d'autres patterns)
  ALWAYS_SCAN: [
    /test\/mcp-json\.test\.ts$/,
    /src\/.*\.ts$/,
    /scripts\/.*\.js$/,
  ],

  // Types de violations
  VIOLATION_TYPES: {
    ICON_IN_RESULT: 'ICON_IN_RESULT',
    ICON_IN_STATUS: 'ICON_IN_STATUS',
    ICON_IN_DATA: 'ICON_IN_DATA',
    ICON_IN_ERROR: 'ICON_IN_ERROR',
    ICON_IN_VALUE: 'ICON_IN_VALUE',
  },

  // Niveaux de sévérité
  SEVERITY_LEVELS: {
    CRITICAL: 'CRITICAL',    // Violation dans JSON métier MCP
    HIGH: 'HIGH',            // Violation dans code de production
    MEDIUM: 'MEDIUM',        // Violation dans tests
    LOW: 'LOW',              // Violation dans fichiers archivés
  },
};

/**
 * Parser les arguments de ligne de commande
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    ci: false,
    strict: false,
    exclude: [],
    help: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--ci' || arg === '-c') {
      result.ci = true;
    } else if (arg === '--strict' || arg === '-s') {
      result.strict = true;
    } else if (arg === '--verbose' || arg === '-v') {
      result.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--exclude' && i + 1 < args.length) {
      result.exclude = args[++i].split(',').map(p => new RegExp(p.trim()));
    }
  }

  return result;
}

/**
 * Afficher l'aide
 */
function showHelp() {
  console.log(`
🔍 Validateur JSON Strict R3 - Conformité règles absolues

Usage:
  node scripts/validate-json-strict.js [options]

Options:
  --ci, -c           Mode CI (sortie JSON uniquement, exit code non-zero si violations)
  --strict, -s       Mode strict (bloque sur toute violation, même basse sévérité)
  --exclude <patterns> Patterns à exclure (séparés par des virgules, regex)
  --verbose, -v      Mode verbeux (affiche plus de détails)
  --help, -h         Afficher cette aide

Exemples:
  # Validation standard
  node scripts/validate-json-strict.js

  # Mode CI (pour GitHub Actions, GitLab CI, etc.)
  node scripts/validate-json-strict.js --ci

  # Mode strict (bloque sur toute violation)
  node scripts/validate-json-strict.js --strict

  # Exclure certains fichiers
  node scripts/validate-json-strict.js --exclude "test/.*,archived-tests/.*"

  # Mode verbeux
  node scripts/validate-json-strict.js --verbose

Règles validées (R3):
  • stdout = JSON strict sans icônes
  • stderr = texte enrichi avec icônes
  • Pas d'icônes dans result/status/data/error
  • Pas d'icônes dans les valeurs JSON métier

Sortie CI:
  • JSON structuré avec violations détectées
  • Exit code 0: succès (aucune violation critique)
  • Exit code 1: échec (violations critiques détectées)
`);
}

/**
 * Déterminer la sévérité d'une violation
 */
function determineSeverity(violation, filePath) {
  const file = filePath.toLowerCase();

  // Violations dans les champs MCP critiques
  if (violation.type.includes('RESULT') ||
    violation.type.includes('STATUS') ||
    violation.type.includes('DATA') ||
    violation.type.includes('ERROR')) {
    return CONFIG.SEVERITY_LEVELS.CRITICAL;
  }

  // Fichiers de production
  if (file.includes('/src/') && !file.includes('/test/')) {
    return CONFIG.SEVERITY_LEVELS.HIGH;
  }

  // Fichiers de test
  if (file.includes('/test/') || file.includes('.test.')) {
    return CONFIG.SEVERITY_LEVELS.MEDIUM;
  }

  // Fichiers archivés
  if (file.includes('archived-') || file.includes('/archived/')) {
    return CONFIG.SEVERITY_LEVELS.LOW;
  }

  // Par défaut
  return CONFIG.SEVERITY_LEVELS.MEDIUM;
}

/**
 * Scanner un fichier pour violations
 */
function scanFile(filePath, args) {
  const violations = [];

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, lineNumber) => {
      CONFIG.VIOLATION_PATTERNS.forEach((pattern, patternIndex) => {
        if (pattern.test(line)) {
          const match = line.match(pattern);
          if (match) {
            let violationType;

            switch (patternIndex) {
              case 0: violationType = CONFIG.VIOLATION_TYPES.ICON_IN_RESULT; break;
              case 1: violationType = CONFIG.VIOLATION_TYPES.ICON_IN_STATUS; break;
              case 2: violationType = CONFIG.VIOLATION_TYPES.ICON_IN_DATA; break;
              case 3: violationType = CONFIG.VIOLATION_TYPES.ICON_IN_ERROR; break;
              case 4: violationType = CONFIG.VIOLATION_TYPES.ICON_IN_VALUE; break;
              default: violationType = CONFIG.VIOLATION_TYPES.ICON_IN_VALUE;
            }

            const severity = determineSeverity({ type: violationType }, filePath);

            violations.push({
              type: violationType,
              severity: severity,
              line: lineNumber + 1,
              column: match.index + 1,
              match: match[0],
              context: line.trim(),
              file: filePath,
              relativePath: path.relative(process.cwd(), filePath),
            });
          }
        }
      });
    });
  } catch (error) {
    if (args.verbose) {
      console.error(`❌ Erreur lecture ${filePath}:`, error.message);
    }
  }

  return violations;
}

/**
 * Scanner un répertoire récursivement
 */
function scanDirectory(dirPath, args, results = { violations: [], filesScanned: 0 }) {
  try {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const fullPath = path.join(dirPath, item);

      // Vérifier les exclusions
      const shouldExclude = CONFIG.EXCLUDE_PATTERNS.some(pattern => pattern.test(fullPath)) ||
        args.exclude.some(pattern => pattern.test(fullPath));

      const shouldAlwaysScan = CONFIG.ALWAYS_SCAN.some(pattern => pattern.test(fullPath));

      if (shouldExclude && !shouldAlwaysScan) {
        continue;
      }

      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scanDirectory(fullPath, args, results);
      } else if (stat.isFile()) {
        // Vérifier si c'est un fichier à scanner
        const shouldScan = CONFIG.FILE_PATTERNS.some(pattern => pattern.test(fullPath)) ||
          shouldAlwaysScan;

        if (shouldScan) {
          const violations = scanFile(fullPath, args);

          if (violations.length > 0) {
            results.violations.push(...violations);
          }

          results.filesScanned++;
        }
      }
    }
  } catch (error) {
    if (args.verbose) {
      console.error(`❌ Erreur scan ${dirPath}:`, error.message);
    }
  }

  return results;
}

/**
 * Générer un rapport de validation
 */
function generateValidationReport(results, args) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalFilesScanned: results.filesScanned,
      totalViolations: results.violations.length,
      bySeverity: {},
      byType: {},
      byFile: {},
    },
    violations: results.violations,
    passed: results.violations.length === 0,
    ciMode: args.ci,
    strictMode: args.strict,
  };

  // Compter par sévérité et type
  results.violations.forEach(violation => {
    report.summary.bySeverity[violation.severity] =
      (report.summary.bySeverity[violation.severity] || 0) + 1;

    report.summary.byType[violation.type] =
      (report.summary.byType[violation.type] || 0) + 1;

    report.summary.byFile[violation.relativePath] =
      (report.summary.byFile[violation.relativePath] || 0) + 1;
  });

  return report;
}

/**
 * Afficher le rapport en mode humain
 */
function displayHumanReport(report, args) {
  console.log('🔍 Validation JSON Strict R3');
  console.log('='.repeat(60));
  console.log(`📊 Résumé:`);
  console.log(`  • Fichiers scannés: ${report.summary.totalFilesScanned}`);
  console.log(`  • Violations détectées: ${report.summary.totalViolations}`);
  console.log(`  • Mode: ${report.ciMode ? 'CI' : 'Standard'} ${report.strictMode ? '+ Strict' : ''}`);
  console.log();

  if (report.summary.totalViolations === 0) {
    console.log('✅ Aucune violation R3 détectée. Conformité parfaite!');
    return;
  }

  // Afficher par sévérité
  console.log('🚨 Violations par sévérité:');
  Object.entries(report.summary.bySeverity)
    .sort(([a], [b]) => {
      const order = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      return order.indexOf(a) - order.indexOf(b);
    })
    .forEach(([severity, count]) => {
      const icon = severity === 'CRITICAL' ? '🔴' :
        severity === 'HIGH' ? '🟠' :
          severity === 'MEDIUM' ? '🟡' : '🟢';
      console.log(`  ${icon} ${severity}: ${count}`);
    });

  console.log();

  // Afficher fichiers prioritaires
  console.log('📋 Fichiers avec violations:');
  Object.entries(report.summary.byFile)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .forEach(([file, count]) => {
      const violations = report.violations.filter(v => v.relativePath === file);
      const criticalCount = violations.filter(v => v.severity === 'CRITICAL').length;
      const icon = criticalCount > 0 ? '🔴' : '🟡';
      console.log(`  ${icon} ${file}: ${count} violations (${criticalCount} critiques)`);
    });

  console.log();

  // Afficher détails si verbose
  if (args.verbose && report.violations.length > 0) {
    console.log('📝 Détail des violations:');
    report.violations
      .sort((a, b) => {
        const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity] ||
          a.relativePath.localeCompare(b.relativePath) ||
          a.line - b.line;
      })
      .forEach((violation, index) => {
        if (index < 20) { // Limiter à 20 violations pour lisibilité
          console.log(`  ${index + 1}. ${violation.relativePath}:${violation.line}`);
          console.log(`     Type: ${violation.type} (${violation.severity})`);
          console.log(`     Contexte: ${violation.context}`);
          console.log();
        }
      });

    if (report.violations.length > 20) {
      console.log(`  ... et ${report.violations.length - 20} violations supplémentaires`);
      console.log();
    }
  }

  // Recommandations
  console.log('💡 Recommandations:');
  if (report.summary.bySeverity.CRITICAL > 0) {
    console.log('  🔴 Violations CRITIQUES détectées dans JSON métier MCP');
    console.log('     → Corriger immédiatement avant déploiement');
  }

  if (report.summary.bySeverity.HIGH > 0) {
    console.log('  🟠 Violations HIGH détectées dans code de production');
    console.log('     → Corriger avant prochaine release');
  }

  if (report.summary.bySeverity.MEDIUM > 0) {
    console.log('  🟡 Violations MEDIUM détectées dans tests');
    console.log('     → Corriger lors du prochain refactoring');
  }

  if (report.summary.bySeverity.LOW > 0) {
    console.log('  🟢 Violations LOW détectées dans fichiers archivés');
    console.log('     → Peuvent être ignorées si fichiers non utilisés');
  }

  console.log();
  console.log('📚 Règles R3:');
  console.log('  • stdout = JSON strict sans icônes (result/status/data/error)');
  console.log('  • stderr = texte enrichi avec icônes (console.error)');
  console.log('  • notes_for_ai = icônes autorisées pour contexte IA');
}

/**
 * Fonction principale
 */
async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    return;
  }

  const startTime = Date.now();
  const projectRoot = process.cwd();

  // Scanner le projet
  const scanResults = scanDirectory(projectRoot, args, { violations: [], filesScanned: 0 });

  // Générer rapport
  const report = generateValidationReport(scanResults, args);

  // Afficher le rapport
  if (args.ci) {
    // Mode CI: sortie JSON uniquement
    console.log(JSON.stringify(report, null, 2));
  } else {
    // Mode standard: sortie humaine
    displayHumanReport(report, args);
  }

  // Calculer le temps d'exécution
  const elapsedTime = Date.now() - startTime;
  if (args.verbose) {
    console.log(`\n⏱️  Temps d'exécution: ${elapsedTime}ms`);
  }

  // Déterminer le code de sortie
  let exitCode = 0;

  if (args.strict) {
    // Mode strict: échec si ANY violation
    exitCode = report.summary.totalViolations > 0 ? 1 : 0;
  } else {
    // Mode normal: échec seulement si violations CRITICAL ou HIGH
    const criticalOrHighViolations = report.violations.filter(
      v => v.severity === 'CRITICAL' || v.severity === 'HIGH'
    ).length;
    exitCode = criticalOrHighViolations > 0 ? 1 : 0;
  }

  // Afficher le résultat final
  if (!args.ci) {
    console.log('\n' + '='.repeat(60));
    if (exitCode === 0) {
      console.log('✅ Validation R3 réussie!');
    } else {
      console.log('❌ Validation R3 échouée!');
      console.log(`   Code de sortie: ${exitCode}`);

      if (args.strict) {
        console.log('   Mode strict: toute violation cause un échec');
      } else {
        console.log('   Mode normal: seules les violations CRITICAL/HIGH causent un échec');
      }
    }
  }

  // Terminer avec le code de sortie approprié
  process.exit(exitCode);
}

// Gestion des erreurs non capturées
process.on('unhandledRejection', (error) => {
  console.error('❌ Erreur non capturée:', error);
  process.exit(1);
});

// Exécuter le script si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Erreur lors de la validation R3:', error);
    process.exit(1);
  });
}
