// scripts/audit/json-strict-audit.js
// Scanner pour violations R3 (JSON strict) - icônes dans JSON métier

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Patterns pour détecter les violations R3
const VIOLATION_PATTERNS = [
  // Icônes dans JSON métier (stdout)
  /"result"\s*:\s*\{[^}]*["']?[🔴🟢🟡🔵⚫⚪🟣🟠🟤🟢🔴🟡🔵🧪✅❌⚠️🚨📊📈📉📋📁📂📄📑📊📈📉📋📁📂📄📑]/,
  /"status"\s*:\s*\{[^}]*["']?[🔴🟢🟡🔵⚫⚪🟣🟠🟤🟢🔴🟡🔵🧪✅❌⚠️🚨📊📈📉📋📁📂📄📑📊📈📉📋📁📂📄📑]/,
  /"data"\s*:\s*\{[^}]*["']?[🔴🟢🟡🔵⚫⚪🟣🟠🟤🟢🔴🟡🔵🧪✅❌⚠️🚨📊📈📉📋📁📂📄📑📊📈📉📋📁📂📄📑]/,
  /"error"\s*:\s*\{[^}]*["']?[🔴🟢🟡🔵⚫⚪🟣🟠🟤🟢🔴🟡🔵🧪✅❌⚠️🚨📊📈📉📋📁📂📄📑📊📈📉📋📁📂📄📑]/,

  // JSON avec icônes dans les valeurs
  /:\s*["'][🔴🟢🟡🔵⚫⚪🟣🟠🟤🟢🔴🟡🔵🧪✅❌⚠️🚨📊📈📉📋📁📂📄📑📊📈📉📋📁📂📄📑]/,

  // JSON avec icônes dans les clés (moins probable mais à vérifier)
  /["'][🔴🟢🟡🔵⚫⚪🟣🟠🟤🟢🔴🟡🔵🧪✅❌⚠️🚨📊📈📉📋📁📂📄📑📊📈📉📋📁📂📄📑][^"]*"\s*:/,
];

// Patterns pour détecter les fichiers JSON métier (stdout)
const JSON_METIER_PATTERNS = [
  /\.json$/,
  /\.ts$/,
  /\.js$/,
  /\.tsx?$/,
  /\.jsx?$/,
];

// Patterns pour exclure certains fichiers
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /coverage/,
  /build/,
  /dist/,
  /\.min\./,
  /package-lock\.json/,
  /yarn\.lock/,
];

// Types de violations
const VIOLATION_TYPES = {
  ICON_IN_RESULT: 'ICON_IN_RESULT',
  ICON_IN_STATUS: 'ICON_IN_STATUS',
  ICON_IN_DATA: 'ICON_IN_DATA',
  ICON_IN_ERROR: 'ICON_IN_ERROR',
  ICON_IN_VALUE: 'ICON_IN_VALUE',
  ICON_IN_KEY: 'ICON_IN_KEY',
};

/**
 * Scanner un fichier pour violations R3
 */
function scanFileForViolations(filePath, content) {
  const violations = [];
  const lines = content.split('\n');

  lines.forEach((line, lineNumber) => {
    VIOLATION_PATTERNS.forEach((pattern, patternIndex) => {
      if (pattern.test(line)) {
        const match = line.match(pattern);
        if (match) {
          let violationType;

          if (patternIndex === 0) violationType = VIOLATION_TYPES.ICON_IN_RESULT;
          else if (patternIndex === 1) violationType = VIOLATION_TYPES.ICON_IN_STATUS;
          else if (patternIndex === 2) violationType = VIOLATION_TYPES.ICON_IN_DATA;
          else if (patternIndex === 3) violationType = VIOLATION_TYPES.ICON_IN_ERROR;
          else if (patternIndex === 4) violationType = VIOLATION_TYPES.ICON_IN_VALUE;
          else violationType = VIOLATION_TYPES.ICON_IN_KEY;

          violations.push({
            type: violationType,
            line: lineNumber + 1,
            column: match.index + 1,
            match: match[0],
            context: line.trim(),
            file: filePath,
          });
        }
      }
    });
  });

  return violations;
}

/**
 * Scanner un répertoire récursivement
 */
function scanDirectory(dirPath, results = { violations: [], filesScanned: 0 }) {
  try {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const fullPath = path.join(dirPath, item);

      // Vérifier les exclusions
      if (EXCLUDE_PATTERNS.some(pattern => pattern.test(fullPath))) {
        continue;
      }

      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scanDirectory(fullPath, results);
      } else if (stat.isFile()) {
        // Vérifier si c'est un fichier JSON métier
        const isJsonMetier = JSON_METIER_PATTERNS.some(pattern => pattern.test(fullPath));

        if (isJsonMetier) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const violations = scanFileForViolations(fullPath, content);

            if (violations.length > 0) {
              results.violations.push(...violations);
            }

            results.filesScanned++;
          } catch (error) {
            console.error(`❌ Erreur lecture ${fullPath}:`, error.message);
          }
        }
      }
    }
  } catch (error) {
    console.error(`❌ Erreur scan ${dirPath}:`, error.message);
  }

  return results;
}

/**
 * Générer un rapport de violations
 */
function generateViolationReport(violations) {
  const report = {
    summary: {
      totalViolations: violations.length,
      byType: {},
      byFile: {},
    },
    violations: violations,
    recommendations: [],
  };

  // Compter par type
  violations.forEach(violation => {
    report.summary.byType[violation.type] = (report.summary.byType[violation.type] || 0) + 1;

    const relativePath = path.relative(process.cwd(), violation.file);
    report.summary.byFile[relativePath] = (report.summary.byFile[relativePath] || 0) + 1;
  });

  // Générer des recommandations
  if (violations.length > 0) {
    report.recommendations.push(
      `🚨 ${violations.length} violations R3 détectées. Actions requises:`
    );

    // Recommandations par type
    Object.entries(report.summary.byType).forEach(([type, count]) => {
      let recommendation = '';

      switch (type) {
        case VIOLATION_TYPES.ICON_IN_RESULT:
          recommendation = `- ${count} violations: Icônes dans "result". Déplacer vers "notes_for_ai" ou stderr`;
          break;
        case VIOLATION_TYPES.ICON_IN_STATUS:
          recommendation = `- ${count} violations: Icônes dans "status". Utiliser valeurs textuelles uniquement`;
          break;
        case VIOLATION_TYPES.ICON_IN_DATA:
          recommendation = `- ${count} violations: Icônes dans "data". Nettoyer les données métier`;
          break;
        case VIOLATION_TYPES.ICON_IN_ERROR:
          recommendation = `- ${count} violations: Icônes dans "error". Messages d'erreur textuels uniquement`;
          break;
        case VIOLATION_TYPES.ICON_IN_VALUE:
          recommendation = `- ${count} violations: Icônes dans valeurs JSON. Remplacer par texte`;
          break;
        case VIOLATION_TYPES.ICON_IN_KEY:
          recommendation = `- ${count} violations: Icônes dans clés JSON. Clés textuelles uniquement`;
          break;
      }

      if (recommendation) {
        report.recommendations.push(recommendation);
      }
    });

    // Recommandations par fichier
    report.recommendations.push('\n📋 Fichiers prioritaires:');
    Object.entries(report.summary.byFile)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .forEach(([file, count]) => {
        report.recommendations.push(`- ${file}: ${count} violations`);
      });
  } else {
    report.recommendations.push('✅ Aucune violation R3 détectée. Conformité parfaite.');
  }

  return report;
}

/**
 * Générer un plan de migration
 */
function generateMigrationPlan(violations) {
  const plan = {
    phases: [],
    estimatedEffort: 'Moyen',
    priorityFiles: [],
    migrationSteps: [],
  };

  if (violations.length === 0) {
    plan.phases.push({
      phase: 1,
      name: 'Validation',
      description: 'Aucune action requise - conformité R3 déjà atteinte',
      effort: 'Minimal',
    });
    return plan;
  }

  // Phase 1: Audit et analyse
  plan.phases.push({
    phase: 1,
    name: 'Audit complet',
    description: 'Scanner tous les fichiers, générer rapport détaillé',
    effort: 'Faible',
    tasks: [
      'Exécuter ce script sur codebase complète',
      'Générer rapport JSON et Markdown',
      'Identifier patterns récurrents',
    ],
  });

  // Phase 2: Correction fichiers prioritaires
  const filesByViolationCount = {};
  violations.forEach(violation => {
    const file = path.relative(process.cwd(), violation.file);
    filesByViolationCount[file] = (filesByViolationCount[file] || 0) + 1;
  });

  const priorityFiles = Object.entries(filesByViolationCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([file]) => file);

  plan.priorityFiles = priorityFiles;

  plan.phases.push({
    phase: 2,
    name: 'Correction fichiers prioritaires',
    description: 'Corriger les 5 fichiers avec le plus de violations',
    effort: 'Moyen',
    tasks: priorityFiles.map(file => `Corriger ${file}`),
  });

  // Phase 3: Correction fichiers restants
  plan.phases.push({
    phase: 3,
    name: 'Correction fichiers restants',
    description: 'Corriger toutes les violations restantes',
    effort: 'Élevé',
    tasks: [
      'Corriger violations par type',
      'Valider chaque correction',
      'Mettre à jour les tests',
    ],
  });

  // Phase 4: Validation et CI/CD
  plan.phases.push({
    phase: 4,
    name: 'Validation et intégration',
    description: 'Intégrer validation automatique dans CI/CD',
    effort: 'Moyen',
    tasks: [
      'Créer script validate-json-strict.js',
      'Intégrer dans pipeline CI/CD',
      'Configurer validation pré-commit',
      'Documenter règles R3',
    ],
  });

  // Étapes de migration détaillées
  plan.migrationSteps = [
    '1. Identifier toutes les violations avec ce script',
    '2. Classer par priorité (fichiers MCP > autres)',
    '3. Créer fonctions de nettoyage JSON',
    '4. Appliquer corrections fichier par fichier',
    '5. Tester chaque correction',
    '6. Valider conformité complète',
    '7. Intégrer validation automatique',
  ];

  return plan;
}

/**
 * Exporter le rapport en Markdown
 */
function exportMarkdownReport(report, plan, outputPath) {
  const markdown = `# 📊 Rapport Audit R3 (JSON strict)

## 📋 Résumé
- **Fichiers scannés**: ${report.summary.totalFilesScanned || 0}
- **Violations détectées**: ${report.summary.totalViolations}
- **Date**: ${new Date().toISOString()}

## 📈 Statistiques par type
${Object.entries(report.summary.byType)
      .map(([type, count]) => `- **${type}**: ${count} violations`)
      .join('\n')}

## 📁 Fichiers avec violations
${Object.entries(report.summary.byFile)
      .sort(([, a], [, b]) => b - a)
      .map(([file, count]) => `- \`${file}\`: ${count} violations`)
      .join('\n')}

## 🚨 Détail des violations
${report.violations
      .slice(0, 50) // Limiter à 50 pour lisibilité
      .map(violation => `
### ${path.basename(violation.file)}:${violation.line}
- **Type**: ${violation.type}
- **Position**: Ligne ${violation.line}, Colonne ${violation.column}
- **Contexte**: \`${violation.context}\`
- **Match**: \`${violation.match}\`
`)
      .join('\n')}

${report.violations.length > 50 ? `\n> ... et ${report.violations.length - 50} violations supplémentaires\n` : ''}

## 🎯 Plan de Migration

### Phases
${plan.phases
      .map(phase => `
#### Phase ${phase.phase}: ${phase.name}
- **Description**: ${phase.description}
- **Effort estimé**: ${phase.effort}
${phase.tasks ? `- **Tâches**:\n  ${phase.tasks.map(task => `- ${task}`).join('\n  ')}` : ''}
`)
      .join('\n')}

### Fichiers prioritaires
${plan.priorityFiles.map(file => `- \`${file}\``).join('\n')}

### Étapes détaillées
${plan.migrationSteps.map(step => step).join('\n')}

## 💡 Recommandations
${report.recommendations.map(rec => `- ${rec}`).join('\n')}

## 📝 Notes
- R3: JSON strict - pas d'icônes dans JSON métier
- stdout = JSON contractuel pur
- stderr = texte enrichi avec icônes
- rag.log = JSON structuré d'observabilité
`;

  fs.writeFileSync(outputPath, markdown);
  console.log(`✅ Rapport exporté: ${outputPath}`);
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🔍 Début audit R3 (JSON strict)...');

  const startTime = Date.now();
  const projectRoot = process.cwd();

  // Scanner le projet
  const scanResults = scanDirectory(projectRoot, { violations: [], filesScanned: 0 });

  // Générer rapport
  const report = generateViolationReport(scanResults.violations);
  report.summary.totalFilesScanned = scanResults.filesScanned;

  // Générer plan de migration
  const migrationPlan = generateMigrationPlan(scanResults.violations);

  // Exporter en JSON
  const jsonOutput = path.join(__dirname, 'json-strict-audit-report.json');
  fs.writeFileSync(jsonOutput, JSON.stringify({ report, migrationPlan }, null, 2));
  console.log(`✅ Rapport JSON exporté: ${jsonOutput}`);

  // Exporter en Markdown
  const mdOutput = path.join(__dirname, 'json-strict-audit-report.md');
  exportMarkdownReport(report, migrationPlan, mdOutput);

  // Afficher résumé
  const elapsedTime = Date.now() - startTime;
  console.log('\n📊 RÉSUMÉ AUDIT R3');
  console.log('='.repeat(50));
  console.log(`Fichiers scannés: ${scanResults.filesScanned}`);
  console.log(`Violations détectées: ${scanResults.violations.length}`);
  console.log(`Temps d'exécution: ${elapsedTime}ms`);

  if (scanResults.violations.length > 0) {
    console.log('\n🚨 VIOLATIONS DÉTECTÉES:');
    Object.entries(report.summary.byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    console.log('\n📋 FICHIERS PRIORITAIRES:');
    Object.entries(report.summary.byFile)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .forEach(([file, count]) => {
        console.log(`  ${file}: ${count} violations`);
      });
  }

  console.log('\n✅ Audit R3 terminé avec succès!');
  console.log(`📄 Rapport JSON: ${jsonOutput}`);
  console.log(`📄 Rapport Markdown: ${mdOutput}`);
}

// Exécuter le script si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Erreur lors de l\'audit R3:', error);
    process.exit(1);
  });
}
