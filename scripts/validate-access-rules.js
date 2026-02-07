#!/usr/bin/env node
/**
 * Script de validation des règles d'accès
 * Vérifie la conformité avec l'architecture autonome
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

/**
 * Règles à vérifier
 */
const ACCESS_RULES = {
  MONITORING_WRITE_ONLY: {
    description: 'Le moteur NE DOIT PAS lire ses propres fichiers de monitoring',
    paths: ['/rag/monitoring/'],
    forbiddenPatterns: [
      /fs\.readFileSync.*monitoring/,
      /fs\.readFile.*monitoring/,
      /fs\.promises\.readFile.*monitoring/,
      /require.*monitoring.*\.json/,
      /import.*monitoring.*\.json/
    ]
  },
  EXTENSION_READ_ONLY: {
    description: "L'extension NE DOIT PAS écrire dans les dossiers système",
    paths: ['/rag/state/', '/rag/monitoring/', '/rag/db/', '/rag/logs/'],
    forbiddenPatterns: [
      /fs\.writeFileSync/,
      /fs\.writeFile/,
      /fs\.promises\.writeFile/,
      /fs\.appendFileSync/,
      /fs\.appendFile/
    ],
    allowedFiles: ['extension-rag/']
  },
  DB_ISOLATION: {
    description: 'La DB NE DOIT PAS être accessible directement par IA ou extension',
    paths: ['/rag/db/'],
    forbiddenPatterns: [
      /\.sqlite/,
      /SQLite3/,
      /database\./
    ],
    allowedContexts: ['src/rag/daemon/', 'src/rag/db/']
  }
};

/**
 * Résultat de validation
 */
class ValidationResult {
  constructor() {
    this.passed = [];
    this.warnings = [];
    this.errors = [];
    this.timestamp = new Date();
  }

  addPass(rule, file, message) {
    this.passed.push({ rule, file, message });
  }

  addWarning(rule, file, message) {
    this.warnings.push({ rule, file, message });
  }

  addError(rule, file, message) {
    this.errors.push({ rule, file, message });
  }

  getSummary() {
    return {
      total: this.passed.length + this.warnings.length + this.errors.length,
      passed: this.passed.length,
      warnings: this.warnings.length,
      errors: this.errors.length,
      timestamp: this.timestamp.toISOString()
    };
  }

  printReport() {
    console.log('\n📊 RAPPORT DE VALIDATION DES RÈGLES D\'ACCÈS\n');
    console.log(`Date: ${this.timestamp.toISOString()}`);
    console.log('='.repeat(60));

    // Résumé
    const summary = this.getSummary();
    console.log(`\n📈 RÉSUMÉ:`);
    console.log(`  ✅ Passés: ${summary.passed}`);
    console.log(`  ⚠️  Avertissements: ${summary.warnings}`);
    console.log(`  ❌ Erreurs: ${summary.errors}`);
    console.log(`  📊 Total: ${summary.total}`);

    // Erreurs détaillées
    if (this.errors.length > 0) {
      console.log('\n❌ ERREURS CRITIQUES:');
      this.errors.forEach((error, index) => {
        console.log(`\n  ${index + 1}. ${error.rule}`);
        console.log(`     Fichier: ${error.file}`);
        console.log(`     Message: ${error.message}`);
      });
    }

    // Avertissements
    if (this.warnings.length > 0) {
      console.log('\n⚠️  AVERTISSEMENTS:');
      this.warnings.forEach((warning, index) => {
        console.log(`\n  ${index + 1}. ${warning.rule}`);
        console.log(`     Fichier: ${warning.file}`);
        console.log(`     Message: ${warning.message}`);
      });
    }

    // Succès
    if (this.passed.length > 0 && this.errors.length === 0) {
      console.log('\n✅ TOUTES LES RÈGLES SONT RESPECTÉES!');
    }

    console.log('\n' + '='.repeat(60));
  }
}

/**
 * Scanne un fichier pour des patterns interdits
 */
function scanFileForPatterns(filePath, rule) {
  const content = fs.readFileSync(filePath, 'utf8');
  const violations = [];

  for (const pattern of rule.forbiddenPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      violations.push({
        pattern: pattern.toString(),
        matches: matches.slice(0, 3) // Premier 3 matches seulement
      });
    }
  }

  return violations;
}

/**
 * Vérifie si un fichier est dans un contexte autorisé
 */
function isInAllowedContext(filePath, rule) {
  if (!rule.allowedContexts) return false;

  return rule.allowedContexts.some(context =>
    filePath.includes(context)
  );
}

/**
 * Vérifie si un fichier est une extension (autorisé à écrire)
 */
function isExtensionFile(filePath, rule) {
  if (!rule.allowedFiles) return false;

  return rule.allowedFiles.some(allowedFile =>
    filePath.includes(allowedFile)
  );
}

/**
 * Scanne récursivement les fichiers TypeScript/JavaScript
 */
function scanSourceFiles(rootDir, rule) {
  const files = [];

  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Ignorer node_modules et autres dossiers système
        if (!item.startsWith('.') && item !== 'node_modules' && item !== 'build' && item !== 'dist') {
          scanDirectory(fullPath);
        }
      } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.js') || item.endsWith('.tsx') || item.endsWith('.jsx'))) {
        files.push(fullPath);
      }
    }
  }

  scanDirectory(rootDir);
  return files;
}

/**
 * Valide une règle spécifique
 */
function validateRule(rule, result) {
  console.log(`\n🔍 Validation: ${rule.description}`);

  const sourceFiles = scanSourceFiles(PROJECT_ROOT, rule);
  let checkedFiles = 0;

  for (const filePath of sourceFiles) {
    const relativePath = path.relative(PROJECT_ROOT, filePath);

    // Vérifier si le fichier concerne les chemins de la règle
    const concernsRulePaths = rule.paths.some(rulePath =>
      relativePath.includes(rulePath.replace(/^\//, ''))
    );

    if (!concernsRulePaths) continue;

    checkedFiles++;

    // Vérifier les contextes autorisés
    if (isInAllowedContext(relativePath, rule)) {
      result.addPass(
        rule.description,
        relativePath,
        'Fichier dans contexte autorisé'
      );
      continue;
    }

    // Vérifier les fichiers d'extension (autorisation spéciale)
    if (isExtensionFile(relativePath, rule)) {
      result.addWarning(
        rule.description,
        relativePath,
        'Fichier extension - règles spéciales applicables'
      );
      continue;
    }

    // Scanner pour les patterns interdits
    const violations = scanFileForPatterns(filePath, rule);

    if (violations.length > 0) {
      violations.forEach(violation => {
        result.addError(
          rule.description,
          relativePath,
          `Pattern interdit trouvé: ${violation.pattern}`
        );
      });
    } else {
      result.addPass(
        rule.description,
        relativePath,
        'Aucune violation détectée'
      );
    }
  }

  console.log(`   📁 Fichiers vérifiés: ${checkedFiles}`);
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🚀 Démarrage de la validation des règles d\'accès...');

  const result = new ValidationResult();

  // Valider chaque règle
  for (const [ruleName, rule] of Object.entries(ACCESS_RULES)) {
    validateRule(rule, result);
  }

  // Afficher le rapport
  result.printReport();

  // Retourner le code d'erreur approprié
  if (result.errors.length > 0) {
    console.error('\n❌ VALIDATION ÉCHOUÉE: Des violations critiques ont été trouvées.');
    process.exit(1);
  } else if (result.warnings.length > 0) {
    console.warn('\n⚠️  VALIDATION AVEC AVERTISSEMENTS: Vérifiez les avertissements.');
    process.exit(0);
  } else {
    console.log('\n✅ VALIDATION RÉUSSIE: Toutes les règles sont respectées.');
    process.exit(0);
  }
}

// Gestion des erreurs
main().catch(error => {
  console.error('❌ Erreur lors de la validation:', error);
  process.exit(1);
});
