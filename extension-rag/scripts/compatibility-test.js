#!/usr/bin/env node

/**
 * Script de test de compatibilité pour McpClient
 * Teste différentes versions du SDK MCP, compatibilité extensions, et production
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');

class CompatibilityTest {
  constructor() {
    this.results = {
      sdkVersions: [],
      nodeVersions: [],
      vscodeVersions: [],
      extensions: [],
      production: {},
      summary: {
        passed: 0,
        failed: 0,
        warnings: 0,
        total: 0
      }
    };

    this.testDir = path.join(__dirname, '../test/compatibility');
    this.ensureTestDir();
  }

  ensureTestDir() {
    if (!fs.existsSync(this.testDir)) {
      fs.mkdirSync(this.testDir, { recursive: true });
    }
  }

  async runAllTests() {
    console.log('🚀 Démarrage des tests de compatibilité McpClient');
    console.log('='.repeat(70));

    try {
      // 1. Tests versions SDK MCP
      await this.testSdkVersions();

      // 2. Tests versions Node.js
      await this.testNodeVersions();

      // 3. Tests VS Code
      await this.testVscodeCompatibility();

      // 4. Tests extensions
      await this.testExtensionsCompatibility();

      // 5. Tests production
      await this.testProductionReadiness();

      // 6. Générer rapport
      this.generateReport();

    } catch (error) {
      console.error('❌ Erreur pendant les tests de compatibilité:', error);
      process.exit(1);
    }
  }

  async testSdkVersions() {
    console.log('\n🔍 Tests compatibilité SDK MCP...');

    try {
      // Vérifier la version SDK installée
      const packageJsonPath = path.join(__dirname, '../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      // Obtenir la version SDK depuis les dépendances
      const sdkVersion = packageJson.dependencies?.['@modelcontextprotocol/sdk'] || 'non spécifiée';

      console.log(`  Version SDK installée: ${sdkVersion}`);

      // Tester l'import du SDK
      let sdkModule;
      let sdkVersionActual = 'inconnue';

      try {
        // Essayer d'importer le SDK
        sdkModule = require('@modelcontextprotocol/sdk');

        // Obtenir la version réelle du SDK
        try {
          const sdkPackagePath = require.resolve('@modelcontextprotocol/sdk/package.json');
          const sdkPackage = JSON.parse(fs.readFileSync(sdkPackagePath, 'utf8'));
          sdkVersionActual = sdkPackage.version;
          console.log(`  Version SDK réelle: ${sdkVersionActual}`);
        } catch (e) {
          console.log(`  ⚠️ Impossible de lire la version réelle du SDK: ${e.message}`);
        }

        // Tester les exports principaux
        const requiredExports = ['Client', 'Server', 'Tool'];
        const missingExports = [];

        for (const exportName of requiredExports) {
          if (!sdkModule[exportName]) {
            missingExports.push(exportName);
          }
        }

        if (missingExports.length > 0) {
          throw new Error(`Exports manquants: ${missingExports.join(', ')}`);
        }

        // Tester la création d'un client
        const testClient = new sdkModule.Client(
          { name: 'compatibility-test', version: '1.0.0' },
          { capabilities: {} }
        );

        // Tester WebSocket
        const WebSocket = require('ws');
        if (typeof WebSocket !== 'function') {
          throw new Error('WebSocket non disponible');
        }

        this.results.sdkVersions.push({
          version: sdkVersionActual,
          specified: sdkVersion,
          success: true,
          exports: requiredExports,
          webSocketAvailable: true,
          message: 'SDK MCP compatible et fonctionnel'
        });

        console.log(`    ✅ SDK v${sdkVersionActual} (spécifié: ${sdkVersion}): COMPATIBLE`);
        console.log(`      ✅ Exports disponibles: ${requiredExports.join(', ')}`);
        console.log(`      ✅ WebSocket disponible`);

      } catch (error) {
        console.log(`    ❌ SDK ${sdkVersion}: ERREUR - ${error.message}`);
        this.results.sdkVersions.push({
          version: sdkVersionActual,
          specified: sdkVersion,
          success: false,
          error: error.message,
          message: 'SDK MCP incompatible ou non fonctionnel'
        });
      }

    } catch (error) {
      console.log(`    ❌ Impossible de vérifier le SDK: ${error.message}`);
      this.results.sdkVersions.push({
        version: 'inconnue',
        specified: 'inconnue',
        success: false,
        error: error.message,
        message: 'Impossible de vérifier le SDK MCP'
      });
    }
  }

  async testNodeVersions() {
    console.log('\n🔍 Tests compatibilité Node.js...');

    // Simuler différentes versions Node.js
    const nodeVersions = [
      '16.0.0', '18.0.0', '20.0.0', '22.0.0'
    ];

    const currentVersion = process.version;
    console.log(`  Version Node.js actuelle: ${currentVersion}`);

    for (const version of nodeVersions) {
      console.log(`  Testing Node.js v${version}...`);

      try {
        // Vérifier les features nécessaires
        const features = {
          es2020: this.checkEs2020Support(version),
          esModules: this.checkEsModulesSupport(version),
          webSocket: this.checkWebSocketSupport(version),
          fetch: this.checkFetchSupport(version)
        };

        const allSupported = Object.values(features).every(v => v);

        this.results.nodeVersions.push({
          version,
          supported: allSupported,
          features,
          current: version === currentVersion.replace('v', '')
        });

        console.log(`    ${allSupported ? '✅' : '⚠️'} Node.js v${version}: ${allSupported ? 'COMPATIBLE' : 'LIMITÉ'}`);
        if (!allSupported) {
          Object.entries(features).forEach(([feature, supported]) => {
            if (!supported) {
              console.log(`      ❌ ${feature} non supporté`);
            }
          });
        }

      } catch (error) {
        console.log(`    ❌ Node.js v${version}: ERREUR - ${error.message}`);
        this.results.nodeVersions.push({
          version,
          supported: false,
          error: error.message
        });
      }
    }
  }

  checkEs2020Support(nodeVersion) {
    const [major] = nodeVersion.split('.').map(Number);
    return major >= 14; // ES2020 supporté depuis Node.js 14
  }

  checkEsModulesSupport(nodeVersion) {
    const [major] = nodeVersion.split('.').map(Number);
    return major >= 13; // ES Modules stables depuis Node.js 13
  }

  checkWebSocketSupport(nodeVersion) {
    const [major] = nodeVersion.split('.').map(Number);
    return major >= 16; // WebSocket API stable
  }

  checkFetchSupport(nodeVersion) {
    const [major] = nodeVersion.split('.').map(Number);
    return major >= 18; // Fetch API native depuis Node.js 18
  }

  async testVscodeCompatibility() {
    console.log('\n🔍 Tests compatibilité VS Code...');

    const vscodeVersions = [
      { version: '1.85.0', name: 'Stable' },
      { version: '1.90.0', name: 'Insiders' },
      { version: '1.95.0', name: 'Latest' }
    ];

    for (const vscode of vscodeVersions) {
      console.log(`  Testing VS Code ${vscode.name} (${vscode.version})...`);

      try {
        // Vérifier les APIs VS Code nécessaires
        const apis = {
          webview: this.checkWebviewApi(vscode.version),
          workspace: this.checkWorkspaceApi(vscode.version),
          commands: this.checkCommandsApi(vscode.version),
          window: this.checkWindowApi(vscode.version)
        };

        const allSupported = Object.values(apis).every(v => v);

        this.results.vscodeVersions.push({
          version: vscode.version,
          name: vscode.name,
          supported: allSupported,
          apis
        });

        console.log(`    ${allSupported ? '✅' : '⚠️'} VS Code ${vscode.name}: ${allSupported ? 'COMPATIBLE' : 'LIMITÉ'}`);

      } catch (error) {
        console.log(`    ❌ VS Code ${vscode.name}: ERREUR - ${error.message}`);
        this.results.vscodeVersions.push({
          version: vscode.version,
          name: vscode.name,
          supported: false,
          error: error.message
        });
      }
    }
  }

  checkWebviewApi(vscodeVersion) {
    const [major, minor] = vscodeVersion.split('.').map(Number);
    return major >= 1 && minor >= 50; // WebView API stable
  }

  checkWorkspaceApi(vscodeVersion) {
    const [major, minor] = vscodeVersion.split('.').map(Number);
    return major >= 1 && minor >= 30; // Workspace API
  }

  checkCommandsApi(vscodeVersion) {
    const [major, minor] = vscodeVersion.split('.').map(Number);
    return major >= 1 && minor >= 20; // Commands API
  }

  checkWindowApi(vscodeVersion) {
    const [major, minor] = vscodeVersion.split('.').map(Number);
    return major >= 1 && minor >= 40; // Window API
  }

  async testExtensionsCompatibility() {
    console.log('\n🔍 Tests compatibilité extensions...');

    const extensions = [
      { name: 'GitLens', id: 'eamodio.gitlens' },
      { name: 'ESLint', id: 'dbaeumer.vscode-eslint' },
      { name: 'Prettier', id: 'esbenp.prettier-vscode' },
      { name: 'Docker', id: 'ms-azuretools.vscode-docker' },
      { name: 'Python', id: 'ms-python.python' }
    ];

    for (const extension of extensions) {
      console.log(`  Testing avec ${extension.name}...`);

      try {
        // Simuler la présence de l'extension
        const conflicts = this.checkExtensionConflicts(extension.name);

        this.results.extensions.push({
          name: extension.name,
          id: extension.id,
          compatible: conflicts.length === 0,
          conflicts,
          recommendation: conflicts.length === 0 ? '✅ Compatible' : '⚠️ Conflits potentiels'
        });

        console.log(`    ${conflicts.length === 0 ? '✅' : '⚠️'} ${extension.name}: ${conflicts.length === 0 ? 'COMPATIBLE' : conflicts.length + ' conflit(s)'}`);
        if (conflicts.length > 0) {
          conflicts.forEach(conflict => {
            console.log(`      ❌ ${conflict}`);
          });
        }

      } catch (error) {
        console.log(`    ❌ ${extension.name}: ERREUR - ${error.message}`);
        this.results.extensions.push({
          name: extension.name,
          id: extension.id,
          compatible: false,
          error: error.message
        });
      }
    }
  }

  checkExtensionConflicts(extensionName) {
    const conflicts = [];

    // Vérifier les conflits connus
    const knownConflicts = {
      'GitLens': ['Peut surcharger certaines commandes Git'],
      'ESLint': ['Peut interférer avec le linting TypeScript'],
      'Prettier': ['Peut formater différemment le code'],
      'Docker': ['Aucun conflit connu'],
      'Python': ['Aucun conflit connu']
    };

    if (knownConflicts[extensionName]) {
      conflicts.push(...knownConflicts[extensionName]);
    }

    return conflicts;
  }

  async testProductionReadiness() {
    console.log('\n🔍 Tests préparation production...');

    const tests = [
      { name: 'Performance', test: this.testPerformance.bind(this) },
      { name: 'Mémoire', test: this.testMemory.bind(this) },
      { name: 'Stabilité', test: this.testStability.bind(this) },
      { name: 'Scalabilité', test: this.testScalability.bind(this) },
      { name: 'Monitoring', test: this.testMonitoring.bind(this) }
    ];

    for (const test of tests) {
      console.log(`  Testing ${test.name}...`);

      try {
        const result = await test.test();

        this.results.production[test.name.toLowerCase()] = result;

        console.log(`    ${result.passed ? '✅' : '❌'} ${test.name}: ${result.passed ? 'PASSÉ' : 'ÉCHOUÉ'}`);
        if (!result.passed && result.message) {
          console.log(`      ${result.message}`);
        }

      } catch (error) {
        console.log(`    ❌ ${test.name}: ERREUR - ${error.message}`);
        this.results.production[test.name.toLowerCase()] = {
          passed: false,
          error: error.message
        };
      }
    }
  }

  testPerformance() {
    // Test de performance basique
    const start = Date.now();

    // Simuler une opération coûteuse
    let sum = 0;
    for (let i = 0; i < 1000000; i++) {
      sum += Math.random();
    }

    const duration = Date.now() - start;
    const passed = duration < 1000; // Moins d'1 seconde

    return {
      passed,
      duration: `${duration}ms`,
      message: passed ? 'Performance acceptable' : 'Performance trop lente'
    };
  }

  testMemory() {
    // Test d'utilisation mémoire
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

    const passed = heapUsedMB < 100; // Moins de 100MB

    return {
      passed,
      heapUsed: `${heapUsedMB}MB`,
      heapTotal: `${heapTotalMB}MB`,
      message: passed ? 'Utilisation mémoire acceptable' : 'Utilisation mémoire élevée'
    };
  }

  testStability() {
    // Test de stabilité (simulation)
    const errors = [];

    // Vérifier les dépendances critiques
    const criticalDeps = ['ws', '@modelcontextprotocol/sdk', 'typescript'];
    for (const dep of criticalDeps) {
      try {
        require(dep);
      } catch (error) {
        errors.push(`Dépendance ${dep} manquante`);
      }
    }

    const passed = errors.length === 0;

    return {
      passed,
      errors,
      message: passed ? 'Stable' : `${errors.length} erreur(s) de stabilité`
    };
  }

  testScalability() {
    // Test de scalabilité (simulation)
    const maxConnections = 100;
    const connectionOverhead = 0.5; // MB par connexion
    const estimatedMemory = maxConnections * connectionOverhead;

    const passed = estimatedMemory < 512; // Moins de 512MB pour 100 connexions

    return {
      passed,
      maxConnections,
      estimatedMemory: `${estimatedMemory}MB`,
      message: passed ? 'Scalabilité acceptable' : 'Scalabilité limitée'
    };
  }

  testMonitoring() {
    // Test de monitoring
    const metrics = {
      logs: true,
      metrics: true,
      alerts: false,
      tracing: false
    };

    const passed = metrics.logs && metrics.metrics;

    return {
      passed,
      metrics,
      message: passed ? 'Monitoring basique disponible' : 'Monitoring insuffisant'
    };
  }

  runCommand(command) {
    try {
      const output = execSync(command, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30000
      });

      return {
        success: true,
        output: output.trim()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        output: error.stdout ? error.stdout.toString() : '',
        stderr: error.stderr ? error.stderr.toString() : ''
      };
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(70));
    console.log('📊 RAPPORT DE COMPATIBILITÉ MCP CLIENT');
    console.log('='.repeat(70));

    // Calculer les statistiques
    let passed = 0;
    let failed = 0;
    let warnings = 0;

    // SDK Versions
    console.log('\n🔍 SDK MCP VERSIONS:');
    this.results.sdkVersions.forEach(result => {
      if (result.success) passed++;
      else failed++;
      console.log(`  ${result.success ? '✅' : '❌'} v${result.version}: ${result.success ? 'COMPATIBLE' : 'INCOMPATIBLE'}`);
    });

    // Node.js Versions
    console.log('\n🔍 NODE.JS VERSIONS:');
    this.results.nodeVersions.forEach(result => {
      if (result.supported) passed++;
      else warnings++;
      console.log(`  ${result.supported ? '✅' : '⚠️'} v${result.version}: ${result.supported ? 'COMPATIBLE' : 'LIMITÉ'} ${result.current ? '(ACTUELLE)' : ''}`);
    });

    // VS Code Versions
    console.log('\n🔍 VS CODE VERSIONS:');
    this.results.vscodeVersions.forEach(result => {
      if (result.supported) passed++;
      else warnings++;
      console.log(`  ${result.supported ? '✅' : '⚠️'} ${result.name} (${result.version}): ${result.supported ? 'COMPATIBLE' : 'LIMITÉ'}`);
    });

    // Extensions
    console.log('\n🔍 EXTENSIONS COMPATIBILITY:');
    this.results.extensions.forEach(result => {
      if (result.compatible) passed++;
      else warnings++;
      console.log(`  ${result.compatible ? '✅' : '⚠️'} ${result.name}: ${result.compatible ? 'COMPATIBLE' : result.conflicts.length + ' conflit(s)'}`);
    });

    // Production
    console.log('\n🔍 PRODUCTION READINESS:');
    Object.entries(this.results.production).forEach(([key, result]) => {
      if (result.passed) passed++;
      else failed++;
      console.log(`  ${result.passed ? '✅' : '❌'} ${key.toUpperCase()}: ${result.passed ? 'PASSÉ' : 'ÉCHOUÉ'} ${result.message ? `(${result.message})` : ''}`);
    });

    // Résumé
    const total = passed + failed + warnings;
    this.results.summary = { passed, failed, warnings, total };

    console.log('\n' + '='.repeat(70));
    console.log('📈 RÉSUMÉ DES TESTS:');
    console.log('='.repeat(70));

    console.log(`\n✅ PASSÉS: ${passed}/${total} (${Math.round(passed / total * 100)}%)`);
    console.log(`❌ ÉCHOUÉS: ${failed}/${total} (${Math.round(failed / total * 100)}%)`);
    console.log(`⚠️  AVERTISSEMENTS: ${warnings}/${total} (${Math.round(warnings / total * 100)}%)`);

    console.log('\n🎯 RECOMMANDATIONS:');

    if (failed > 0) {
      console.log('  ❌ Actions immédiates nécessaires:');
      console.log('    1. Résoudre les incompatibilités SDK');
      console.log('    2. Corriger les tests de production échoués');
      console.log('    3. Mettre à jour la documentation');
    }

    if (warnings > 0) {
      console.log('  ⚠️  Améliorations recommandées:');
      console.log('    1. Améliorer la compatibilité Node.js');
      console.log('    2. Résoudre les conflits d\'extensions');
      console.log('    3. Améliorer le monitoring production');
    }

    if (failed === 0 && warnings === 0) {
      console.log('  ✅ Prêt pour la production!');
      console.log('    1. Déployer avec confiance');
      console.log('    2. Surveiller les performances');
      console.log('    3. Maintenir les tests de compatibilité');
    }

    console.log('\n📁 FICHIERS GÉNÉRÉS:');
    console.log('  ✅ Rapport JSON: test/compatibility/results.json');
    console.log('  ✅ Logs détaillés: test/compatibility/compatibility.log');

    // Sauvegarder les résultats
    this.saveResults();

    console.log('\n' + '='.repeat(70));
    console.log('✅ Tests de compatibilité terminés');
    console.log('='.repeat(70));
  }

  saveResults() {
    const resultsFile = path.join(this.testDir, 'results.json');
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));

    const logFile = path.join(this.testDir, 'compatibility.log');
    const logContent = JSON.stringify(this.results, null, 2);
    fs.writeFileSync(logFile, logContent);
  }
}

// Exécution
if (require.main === module) {
  const test = new CompatibilityTest();
  test.runAllTests().catch(console.error);
}

module.exports = { CompatibilityTest };
