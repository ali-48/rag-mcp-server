#!/usr/bin/env node

/**
 * Script de validation des 25 règles absolues du RAG MCP Server
 *
 * Ce script valide la conformité du codebase aux 25 règles absolues
 * définies dans Règles_Absolues_Rag_Mcp_Server.md
 *
 * Usage: node scripts/validate-rules.js [options]
 * Options:
 *   --strict    : Échec sur la première violation
 *   --json      : Sortie JSON structurée
 *   --rule=N    : Valider uniquement la règle N
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, "..");

// Configuration
const CONFIG = {
  strict: process.argv.includes("--strict"),
  jsonOutput: process.argv.includes("--json"),
  specificRule: process.argv
    .find((arg) => arg.startsWith("--rule="))
    ?.split("=")[1],
  maxFileSize: 1024 * 1024, // 1MB
  excludedDirs: [
    "node_modules",
    ".git",
    "build-test",
    "coverage",
    "logs",
    "test-data",
  ],
  excludedExtensions: [
    ".log",
    ".db",
    ".db-journal",
    ".map",
    ".png",
    ".jpg",
    ".ico",
  ],
};

// Résultats de validation
const validationResults = {
  timestamp: new Date().toISOString(),
  totalRules: 25,
  rulesValidated: 0,
  violations: [],
  warnings: [],
  summary: {
    passed: 0,
    failed: 0,
    warnings: 0,
  },
};

/**
 * Règle 1: Base décisionnelle immuable
 * Vérifie que les règles sont référencées dans le code
 */
async function validateRule1() {
  const ruleName = "Base décisionnelle immuable";
  const violations = [];
  const warnings = [];

  try {
    // Vérifier que le fichier des règles existe
    const rulesPath = path.join(
      PROJECT_ROOT,
      "Règles_Absolues_Rag_Mcp_Server.md",
    );
    const rulesContent = await fs.readFile(rulesPath, "utf-8");

    // Vérifier que la version est présente
    if (!rulesContent.includes("Version: 3.0.0")) {
      violations.push("Version des règles non trouvée ou incorrecte");
    }

    // Vérifier la présence de références aux règles dans le code
    const srcFiles = await getAllSourceFiles();
    let ruleReferences = 0;

    for (const file of srcFiles) {
      const content = await fs.readFile(file, "utf-8");
      if (
        content.includes("Règles_Absolues") ||
        content.includes("rules_version")
      ) {
        ruleReferences++;
      }
    }

    if (ruleReferences < 5) {
      warnings.push(
        `Seulement ${ruleReferences} références aux règles trouvées dans le code source`,
      );
    }
  } catch (error) {
    violations.push(`Erreur lors de la validation: ${error.message}`);
  }

  return { ruleName, ruleNumber: 1, violations, warnings };
}

/**
 * Règle 2: Séparation stricte des responsabilités
 * Vérifie la séparation des modules
 */
async function validateRule2() {
  const ruleName = "Séparation stricte des responsabilités";
  const violations = [];
  const warnings = [];

  try {
    // Vérifier que init_rag ne fait pas d'exécution RAG
    const initRagPath = path.join(PROJECT_ROOT, "src/tools/rag/init-rag.ts");
    if (await fileExists(initRagPath)) {
      const content = await fs.readFile(initRagPath, "utf-8");

      // Vérifier les interdictions
      const forbiddenPatterns = [
        /generateEmbedding/i,
        /createEmbedding/i,
        /chunking/i,
        /indexing/i,
        /query_rag/i,
        /activated_rag/i,
      ];

      for (const pattern of forbiddenPatterns) {
        if (pattern.test(content)) {
          violations.push(
            `init_rag contient du code d'exécution RAG (pattern: ${pattern})`,
          );
        }
      }
    }

    // Vérifier que activated_rag ne crée pas de fichiers système
    const activatedRagPath = path.join(
      PROJECT_ROOT,
      "src/tools/rag/activated-rag.ts",
    );
    if (await fileExists(activatedRagPath)) {
      const content = await fs.readFile(activatedRagPath, "utf-8");

      // Vérifier les interdictions
      const forbiddenPatterns = [
        /fs\.writeFileSync/,
        /fs\.mkdirSync/,
        /fs\.copyFileSync/,
        /require.*fs.*sync/,
      ];

      for (const pattern of forbiddenPatterns) {
        if (pattern.test(content)) {
          warnings.push(
            `activated_rag pourrait créer des fichiers système (pattern: ${pattern})`,
          );
        }
      }
    }
  } catch (error) {
    violations.push(`Erreur lors de la validation: ${error.message}`);
  }

  return { ruleName, ruleNumber: 2, violations, warnings };
}

/**
 * Règle 3: JSON strict ou rien
 * Vérifie l'absence d'icônes dans JSON métier
 */
async function validateRule3() {
  const ruleName = "JSON strict ou rien";
  const violations = [];
  const warnings = [];

  try {
    // Utiliser le script existant validate-json-strict.js
    const validateScriptPath = path.join(
      PROJECT_ROOT,
      "scripts/validate-json-strict.js",
    );
    if (await fileExists(validateScriptPath)) {
      // Le script existe, c'est bon
    } else {
      violations.push("Script validate-json-strict.js non trouvé");
    }

    // Vérifier quelques fichiers clés pour icônes dans JSON
    const keyFiles = [
      "src/tools/rag/init-rag.ts",
      "src/tools/rag/activated-rag.ts",
      "src/tools/rag/index-rag.ts",
    ];

    const iconPattern = /[\u{1F300}-\u{1F9FF}]/u; // Emojis
    const textIconPattern = /\[✅\]|\[❌\]|\[⚠️\]|\[📊\]|\[🔍\]/; // Icônes textuelles

    for (const filePath of keyFiles) {
      const fullPath = path.join(PROJECT_ROOT, filePath);
      if (await fileExists(fullPath)) {
        const content = await fs.readFile(fullPath, "utf-8");

        // Chercher des icônes dans les retours JSON
        const jsonReturnPattern =
          /return\s+JSON\.stringify\([^)]*\)|return\s+\{[^}]*\}/g;
        const matches = content.match(jsonReturnPattern) || [];

        for (const match of matches) {
          if (iconPattern.test(match) || textIconPattern.test(match)) {
            violations.push(
              `Icône détectée dans JSON métier dans ${filePath}: ${match.substring(0, 100)}...`,
            );
          }
        }
      }
    }
  } catch (error) {
    violations.push(`Erreur lors de la validation: ${error.message}`);
  }

  return { ruleName, ruleNumber: 3, violations, warnings };
}

/**
 * Règle 4: Architecture RAG obligatoire
 * Vérifie la structure des fichiers
 */
async function validateRule4() {
  const ruleName = "Architecture RAG obligatoire";
  const violations = [];
  const warnings = [];

  try {
    // Vérifier la structure /rag/
    const ragDir = path.join(PROJECT_ROOT, "rag");
    const requiredDirs = ["db", "config", "logs"];
    const requiredFiles = [".ragignore", "state.json"];

    if (!(await directoryExists(ragDir))) {
      violations.push("Répertoire /rag/ manquant");
    } else {
      for (const dir of requiredDirs) {
        const dirPath = path.join(ragDir, dir);
        if (!(await directoryExists(dirPath))) {
          violations.push(`Sous-répertoire /rag/${dir}/ manquant`);
        }
      }

      for (const file of requiredFiles) {
        const filePath = path.join(ragDir, file);
        if (!(await fileExists(filePath))) {
          warnings.push(`Fichier /rag/${file} manquant`);
        }
      }
    }

    // Vérifier que init_rag crée la structure
    const initRagPath = path.join(PROJECT_ROOT, "src/tools/rag/init-rag.ts");
    if (await fileExists(initRagPath)) {
      const content = await fs.readFile(initRagPath, "utf-8");

      const requiredActions = [
        "mkdir",
        "createDirectory",
        "fs.mkdir",
        "fs.mkdirSync",
        "writeFile",
        "fs.writeFile",
        "fs.writeFileSync",
      ];

      let creationCount = 0;
      for (const action of requiredActions) {
        if (content.includes(action)) {
          creationCount++;
        }
      }

      if (creationCount < 3) {
        warnings.push(
          `init_rag pourrait ne pas créer suffisamment de fichiers/répertoires`,
        );
      }
    }
  } catch (error) {
    violations.push(`Erreur lors de la validation: ${error.message}`);
  }

  return { ruleName, ruleNumber: 4, violations, warnings };
}

/**
 * Règle 5: Base de données configurable uniquement
 * Vérifie l'absence de hardcoding DB
 */
async function validateRule5() {
  const ruleName = "Base de données configurable uniquement";
  const violations = [];
  const warnings = [];

  try {
    const srcFiles = await getAllSourceFiles();

    const hardcodedPatterns = [
      /if\s*\(\s*postgres\s*\)/i,
      /if\s*\(\s*pg\s*\)/i,
      /if\s*\(\s*mysql\s*\)/i,
      /if\s*\(\s*sqlite\s*\)/i,
      /require.*pg.*/,
      /require.*mysql.*/,
      /import.*pg.*/,
      /import.*mysql.*/,
    ];

    for (const file of srcFiles) {
      const content = await fs.readFile(file, "utf-8");

      for (const pattern of hardcodedPatterns) {
        if (pattern.test(content)) {
          const relativePath = path.relative(PROJECT_ROOT, file);
          violations.push(`Hardcoding DB détecté dans ${relativePath}`);
          break;
        }
      }

      // Vérifier la présence de configuration
      if (
        content.includes("database") &&
        content.includes("type") &&
        content.includes("config")
      ) {
        // Bon signe
      } else if (content.includes("db") && content.includes("connect")) {
        warnings.push(
          `Connexion DB potentiellement hardcodée dans ${path.relative(PROJECT_ROOT, file)}`,
        );
      }
    }
  } catch (error) {
    violations.push(`Erreur lors de la validation: ${error.message}`);
  }

  return { ruleName, ruleNumber: 5, violations, warnings };
}

/**
 * Règle 25: Anti-duplication stricte
 * Vérifie les duplications de code
 */
async function validateRule25() {
  const ruleName = "Anti-duplication stricte";
  const violations = [];
  const warnings = [];

  try {
    // Vérifier si le scanner de duplication existe
    const duplicationScannerPath = path.join(
      PROJECT_ROOT,
      "scripts/audit/duplication-scanner.ts",
    );
    if (!(await fileExists(duplicationScannerPath))) {
      violations.push(
        "Scanner de duplication non trouvé (scripts/audit/duplication-scanner.ts)",
      );
    }

    // Vérifier les fichiers avec "refactored" dans le nom
    const allFiles = await getAllFiles(PROJECT_ROOT);
    const refactoredFiles = allFiles.filter(
      (file) => file.includes("refactored") || file.includes("refactoring"),
    );

    if (refactoredFiles.length > 5) {
      warnings.push(
        `${refactoredFiles.length} fichiers avec "refactored" dans le nom - vérifier les duplications`,
      );
    }

    // Vérifier les fichiers obsolètes
    const archivedDir = path.join(PROJECT_ROOT, "archived-tests");
    if (await directoryExists(archivedDir)) {
      const archivedFiles = await fs.readdir(archivedDir);
      if (archivedFiles.length > 0) {
        // C'est bon, les fichiers sont archivés
      }
    }
  } catch (error) {
    violations.push(`Erreur lors de la validation: ${error.message}`);
  }

  return { ruleName, ruleNumber: 25, violations, warnings };
}

// Fonctions utilitaires
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function directoryExists(dirPath) {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function getAllSourceFiles() {
  const files = [];
  const extensions = [".ts", ".js", ".tsx", ".jsx"];

  async function scanDir(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Exclure certains répertoires
        if (entry.isDirectory()) {
          if (
            !CONFIG.excludedDirs.includes(entry.name) &&
            !fullPath.includes("node_modules")
          ) {
            await scanDir(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (
            extensions.includes(ext) &&
            !CONFIG.excludedExtensions.includes(ext)
          ) {
            // Vérifier la taille du fichier
            try {
              const stat = await fs.stat(fullPath);
              if (stat.size <= CONFIG.maxFileSize) {
                files.push(fullPath);
              }
            } catch {
              // Ignorer les fichiers inaccessibles
            }
          }
        }
      }
    } catch (error) {
      // Ignorer les répertoires inaccessibles
    }
  }

  await scanDir(path.join(PROJECT_ROOT, "src"));
  return files;
}

async function getAllFiles(dir) {
  const files = [];

  async function scanDir(currentDir) {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          if (
            !CONFIG.excludedDirs.includes(entry.name) &&
            !fullPath.includes("node_modules")
          ) {
            await scanDir(fullPath);
          }
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Ignorer les répertoires inaccessibles
    }
  }

  await scanDir(dir);
  return files;
}

// Mappage des règles aux fonctions de validation
const RULE_VALIDATORS = {
  1: validateRule1,
  2: validateRule2,
  3: validateRule3,
  4: validateRule4,
  5: validateRule5,
  25: validateRule25,
  // Note: Pour une implémentation complète, ajouter les 20 autres règles
};

// Export des fonctions pour les tests
export {
  directoryExists, fileExists, getAllFiles, getAllSourceFiles, validateRule1,
  validateRule2, validateRule25, validateRule3,
  validateRule4,
  validateRule5
};

async function validateAllRules() {
  const rulesToValidate = CONFIG.specificRule
    ? [parseInt(CONFIG.specificRule)]
    : Object.keys(RULE_VALIDATORS).map(Number);

  for (const ruleNumber of rulesToValidate.sort((a, b) => a - b)) {
    const validator = RULE_VALIDATORS[ruleNumber];
    if (validator) {
      try {
        const result = await validator();
        validationResults.rulesValidated++;

        if (result.violations.length === 0) {
          validationResults.summary.passed++;
          if (!CONFIG.jsonOutput) {
            console.log(`✅ Règle ${ruleNumber}: ${result.ruleName} - PASS`);
          }
        } else {
          validationResults.summary.failed++;
          validationResults.violations.push({
            rule: ruleNumber,
            name: result.ruleName,
            violations: result.violations,
          });

          if (!CONFIG.jsonOutput) {
            console.log(`❌ Règle ${ruleNumber}: ${result.ruleName} - FAIL`);
            result.violations.forEach((v) => console.log(`   - ${v}`));

            if (CONFIG.strict) {
              console.log(
                "\n🚨 Mode strict activé - Arrêt sur première violation",
              );
              process.exit(1);
            }
          }
        }

        if (result.warnings.length > 0) {
          validationResults.summary.warnings++;
          validationResults.warnings.push({
            rule: ruleNumber,
            name: result.ruleName,
            warnings: result.warnings,
          });

          if (!CONFIG.jsonOutput) {
            result.warnings.forEach((w) => console.log(`   ⚠️  ${w}`));
          }
        }
      } catch (error) {
        console.error(
          `❌ Erreur lors de la validation de la règle ${ruleNumber}:`,
          error.message,
        );
        validationResults.summary.failed++;
      }
    } else {
      console.warn(`⚠️  Validateur pour la règle ${ruleNumber} non implémenté`);
    }
  }
}

// Fonction principale
async function main() {
  console.log("🔍 Validation des 25 règles absolues du RAG MCP Server");
  console.log("=".repeat(60));

  await validateAllRules();

  // Afficher le résumé
  console.log("\n" + "=".repeat(60));
  console.log("📊 RÉSUMÉ DE VALIDATION");
  console.log("=".repeat(60));

  console.log(`✅ Règles passées: ${validationResults.summary.passed}`);
  console.log(`❌ Règles échouées: ${validationResults.summary.failed}`);
  console.log(`⚠️  Avertissements: ${validationResults.summary.warnings}`);
  console.log(`📋 Règles validées: ${validationResults.rulesValidated}/25`);

  if (validationResults.violations.length > 0) {
    console.log("\n🚨 VIOLATIONS DÉTECTÉES:");
    validationResults.violations.forEach((violation) => {
      console.log(`\nRègle ${violation.rule}: ${violation.name}`);
      violation.violations.forEach((v) => console.log(`   - ${v}`));
    });
  }

  if (validationResults.warnings.length > 0) {
    console.log("\n⚠️  AVERTISSEMENTS:");
    validationResults.warnings.forEach((warning) => {
      console.log(`\nRègle ${warning.rule}: ${warning.name}`);
      warning.warnings.forEach((w) => console.log(`   - ${w}`));
    });
  }

  // Sortie JSON si demandée
  if (CONFIG.jsonOutput) {
    console.log(JSON.stringify(validationResults, null, 2));
  }

  // Code de sortie
  if (validationResults.summary.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Gestion des erreurs non capturées
process.on("unhandledRejection", (error) => {
  console.error("❌ Erreur non gérée:", error);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Exception non capturée:", error);
  process.exit(1);
});

// Exécuter le script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("❌ Erreur fatale:", error);
    process.exit(1);
  });
}
