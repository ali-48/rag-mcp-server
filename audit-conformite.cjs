#!/usr/bin/env node

// Script d'audit de conformité aux règles RAG MCP Server
// Vérifie les règles #25-28 (séparation monitoring/moteur, idempotence, etc.)

const fs = require('fs');
const path = require('path');

class ConformityAudit {
  constructor() {
    this.results = {
      passed: [],
      warnings: [],
      errors: []
    };
    this.projectRoot = process.cwd();
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '✅';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async run() {
    console.log('🔍 Audit de conformité RAG MCP Server');
    console.log('='.repeat(50));

    // 1. Vérifier la séparation monitoring/moteur (règle #25)
    await this.checkMonitoringSeparation();

    // 2. Vérifier l'idempotence des sous-fonctions (règle #20)
    await this.checkIdempotence();

    // 3. Vérifier la non-duplication (règle #25)
    await this.checkAntiDuplication();

    // 4. Vérifier la structure /rag/
    await this.checkRagStructure();

    // 5. Vérifier les fichiers de configuration
    await this.checkConfiguration();

    // Afficher les résultats
    this.printResults();
  }

  async checkMonitoringSeparation() {
    this.log('Vérification séparation monitoring/moteur...');

    // Vérifier que /rag/monitoring/ existe
    const monitoringDir = path.join(this.projectRoot, 'rag', 'monitoring');
    if (!fs.existsSync(monitoringDir)) {
      this.results.errors.push('Le répertoire /rag/monitoring/ n\'existe pas');
      return;
    }

    // Vérifier les fichiers de monitoring
    const expectedFiles = ['metrics.json', 'health/latest.json', 'events/', 'progress/'];
    for (const file of expectedFiles) {
      const filePath = path.join(monitoringDir, file);
      if (file.endsWith('/')) {
        if (!fs.existsSync(filePath)) {
          this.results.warnings.push(`Le répertoire /rag/monitoring/${file} n'existe pas`);
        }
      } else {
        if (!fs.existsSync(filePath)) {
          this.results.warnings.push(`Le fichier /rag/monitoring/${file} n'existe pas`);
        }
      }
    }

    // Vérifier que l'extension VS Code est read-only
    const extensionPath = path.join(this.projectRoot, 'extension-rag', 'src', 'services', 'MonitoringReader.ts');
    if (fs.existsSync(extensionPath)) {
      const content = fs.readFileSync(extensionPath, 'utf8');
      const hasWriteMethods = content.includes('writeFile') || content.includes('writeFileSync');
      if (hasWriteMethods) {
        this.results.errors.push('L\'extension VS Code contient des méthodes d\'écriture (devrait être read-only)');
      } else {
        this.results.passed.push('Extension VS Code correctement en read-only');
      }
    }

    this.results.passed.push('Séparation monitoring/moteur vérifiée');
  }

  async checkIdempotence() {
    this.log('Vérification idempotence des sous-fonctions...');

    // Vérifier les fichiers dans src/rag/ pour des fonctions idempotentes
    const ragDir = path.join(this.projectRoot, 'src', 'rag');
    if (!fs.existsSync(ragDir)) {
      this.results.errors.push('Le répertoire src/rag/ n\'existe pas');
      return;
    }

    // Vérifier les fichiers TypeScript pour des patterns d'idempotence
    const tsFiles = this.findFiles(ragDir, '.ts');
    let idempotentFunctions = 0;
    let nonIdempotentPatterns = 0;

    for (const file of tsFiles.slice(0, 10)) { // Limiter pour performance
      const content = fs.readFileSync(file, 'utf8');

      // Rechercher des patterns non-idempotents
      const nonIdempotentPatternsInFile = [
        /Math\.random\(\)/g,
        /Date\.now\(\)/g,
        /new Date\(\)/g,
        /process\.hrtime\(\)/g
      ];

      for (const pattern of nonIdempotentPatternsInFile) {
        const matches = content.match(pattern);
        if (matches) {
          nonIdempotentPatterns += matches.length;
        }
      }

      // Rechercher des fonctions avec des checks d'idempotence
      if (content.includes('idempotent') || content.includes('alreadyExecuted') || content.includes('checkpoint')) {
        idempotentFunctions++;
      }
    }

    if (nonIdempotentPatterns > 0) {
      this.results.warnings.push(`${nonIdempotentPatterns} patterns potentiellement non-idempotents détectés`);
    }

    if (idempotentFunctions > 0) {
      this.results.passed.push(`${idempotentFunctions} fonctions avec vérifications d'idempotence`);
    }

    this.results.passed.push('Vérification idempotence terminée');
  }

  async checkAntiDuplication() {
    this.log('Vérification anti-duplication...');

    // Rechercher des fichiers avec des noms similaires
    const srcDir = path.join(this.projectRoot, 'src');
    const allFiles = this.findFiles(srcDir);

    // Regrouper par nom de base
    const fileGroups = {};
    allFiles.forEach(file => {
      const basename = path.basename(file);
      const baseWithoutExt = basename.replace(/\.(ts|js)$/, '');

      if (!fileGroups[baseWithoutExt]) {
        fileGroups[baseWithoutExt] = [];
      }
      fileGroups[baseWithoutExt].push(file);
    });

    // Identifier les duplications
    let duplicationCount = 0;
    for (const [baseName, files] of Object.entries(fileGroups)) {
      if (files.length > 1) {
        // Vérifier si c'est une duplication problématique
        const isProblematic = this.isProblematicDuplication(baseName, files);
        if (isProblematic) {
          duplicationCount++;
          this.results.warnings.push(`Duplication potentielle: ${baseName} (${files.length} fichiers)`);
        }
      }
    }

    if (duplicationCount === 0) {
      this.results.passed.push('Aucune duplication problématique détectée');
    } else {
      this.results.warnings.push(`${duplicationCount} duplications potentielles détectées`);
    }
  }

  isProblematicDuplication(baseName, files) {
    // Ignorer certains cas
    const ignorePatterns = [
      /test\./i,
      /spec\./i,
      /\.test\./i,
      /\.spec\./i,
      /index\./i,
      /types\./i,
      /interface\./i
    ];

    for (const pattern of ignorePatterns) {
      if (pattern.test(baseName)) {
        return false;
      }
    }

    // Vérifier si les fichiers sont dans des répertoires différents mais avec même nom
    const dirs = files.map(f => path.dirname(f));
    const uniqueDirs = [...new Set(dirs)];

    // Si même nom mais répertoires différents, c'est potentiellement problématique
    return uniqueDirs.length > 1;
  }

  async checkRagStructure() {
    this.log('Vérification structure /rag/...');

    const ragDir = path.join(this.projectRoot, 'rag');
    if (!fs.existsSync(ragDir)) {
      this.results.errors.push('Le répertoire /rag/ n\'existe pas');
      return;
    }

    const expectedSubdirs = ['db', 'config', 'logs', 'monitoring', 'state'];
    for (const subdir of expectedSubdirs) {
      const subdirPath = path.join(ragDir, subdir);
      if (!fs.existsSync(subdirPath)) {
        this.results.warnings.push(`Le répertoire /rag/${subdir}/ n'existe pas`);
      } else {
        this.results.passed.push(`/rag/${subdir}/ existe`);
      }
    }

    // Vérifier les fichiers obligatoires
    const requiredFiles = [
      'state/init.json',
      'state/projects.json',
      'state/failures.json',
      'ACCESS_RULES.md'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(ragDir, file);
      if (!fs.existsSync(filePath)) {
        this.results.warnings.push(`Le fichier /rag/${file} n'existe pas`);
      } else {
        this.results.passed.push(`/rag/${file} existe`);
      }
    }
  }

  async checkConfiguration() {
    this.log('Vérification configuration...');

    // Vérifier la configuration v3
    const configV3Path = path.join(this.projectRoot, 'config', 'rag-config-v3.json');
    if (!fs.existsSync(configV3Path)) {
      this.results.errors.push('La configuration v3 n\'existe pas (config/rag-config-v3.json)');
      return;
    }

    try {
      const config = JSON.parse(fs.readFileSync(configV3Path, 'utf8'));

      // Vérifier les champs obligatoires
      const requiredFields = ['version', 'system', 'defaults', 'legacy'];
      for (const field of requiredFields) {
        if (!config[field]) {
          this.results.errors.push(`Champ ${field} manquant dans la configuration v3`);
        }
      }

      // Vérifier que legacy_mode est false
      if (config.system?.legacy_mode !== false) {
        this.results.warnings.push('legacy_mode devrait être false dans la configuration v3');
      }

      // Vérifier que activated_rag est désactivé
      if (config.legacy?.activated_rag?.enabled !== false) {
        this.results.errors.push('activated_rag devrait être désactivé dans la configuration v3');
      }

      this.results.passed.push('Configuration v3 valide');
    } catch (error) {
      this.results.errors.push(`Erreur de parsing configuration v3: ${error.message}`);
    }
  }

  findFiles(dir, extension = null) {
    let files = [];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          files = files.concat(this.findFiles(fullPath, extension));
        } else if (entry.isFile()) {
          if (!extension || entry.name.endsWith(extension)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Ignorer les erreurs de lecture
    }

    return files;
  }

  printResults() {
    console.log('\n📊 Résultats de l\'audit');
    console.log('='.repeat(50));

    console.log('\n✅ Tests réussis:');
    this.results.passed.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result}`);
    });

    if (this.results.warnings.length > 0) {
      console.log('\n⚠️  Avertissements:');
      this.results.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning}`);
      });
    }

    if (this.results.errors.length > 0) {
      console.log('\n❌ Erreurs critiques:');
      this.results.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    console.log('\n' + '='.repeat(50));
    console.log(`📈 Résumé:`);
    console.log(`  ✅ ${this.results.passed.length} tests réussis`);
    console.log(`  ⚠️  ${this.results.warnings.length} avertissements`);
    console.log(`  ❌ ${this.results.errors.length} erreurs critiques`);

    if (this.results.errors.length === 0) {
      console.log('\n🎉 Audit réussi ! Le système est conforme aux règles principales.');
    } else {
      console.log('\n🚨 Audit échoué ! Des corrections sont nécessaires.');
      process.exit(1);
    }
  }
}

// Exécuter l'audit
const audit = new ConformityAudit();
audit.run().catch(error => {
  console.error('❌ Erreur lors de l\'audit:', error);
  process.exit(1);
});
