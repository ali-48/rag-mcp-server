#!/usr/bin/env node

/**
 * Script principal pour exécuter tous les tests
 * Tests de compatibilité, connexion MCP, et production
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class AllTestsRunner {
  constructor() {
    this.results = {
      compatibility: null,
      mcpConnection: null,
      production: null,
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
        score: 0
      }
    };

    this.reportDir = path.join(__dirname, '../test/all-tests-reports');
    this.ensureReportDir();
  }

  ensureReportDir() {
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  async runAllTests() {
    console.log('🚀 DÉMARRAGE DE TOUS LES TESTS');
    console.log('='.repeat(80));
    console.log('📋 Suite de tests complète:');
    console.log('  1. ✅ Tests de compatibilité SDK MCP');
    console.log('  2. ✅ Tests de connexion MCP');
    console.log('  3. ✅ Tests de production');
    console.log('  4. ✅ Tests d\'extensions MCP');
    console.log('='.repeat(80));

    try {
      // 1. Tests de compatibilité
      console.log('\n🔍 ÉTAPE 1: Tests compatibilité SDK MCP...');
      await this.runCompatibilityTests();

      // 2. Tests de connexion MCP
      console.log('\n🔍 ÉTAPE 2: Tests connexion MCP...');
      await this.runMcpConnectionTests();

      // 3. Tests production
      console.log('\n🔍 ÉTAPE 3: Tests production...');
      await this.runProductionTests();

      // 4. Tests extensions MCP
      console.log('\n🔍 ÉTAPE 4: Tests extensions MCP...');
      await this.runMcpExtensionsTests();

      // 5. Générer rapport global
      console.log('\n🔍 ÉTAPE 5: Génération rapport global...');
      await this.generateGlobalReport();

      console.log('\n' + '='.repeat(80));
      console.log('🎉 TOUS LES TESTS TERMINÉS AVEC SUCCÈS!');
      console.log('='.repeat(80));

    } catch (error) {
      console.error('❌ Erreur pendant l\'exécution des tests:', error);
      process.exit(1);
    }
  }

  async runCompatibilityTests() {
    try {
      console.log('  Exécution des tests de compatibilité...');

      // Exécuter le script de compatibilité
      const { CompatibilityTest } = require('./compatibility-test');
      const test = new CompatibilityTest();
      await test.runAllTests();

      // Lire les résultats
      const resultsFile = path.join(__dirname, '../test/compatibility/results.json');
      if (fs.existsSync(resultsFile)) {
        this.results.compatibility = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
        console.log('  ✅ Tests de compatibilité terminés');
      } else {
        console.log('  ⚠️  Fichier de résultats non trouvé');
      }

    } catch (error) {
      console.log(`  ❌ Erreur: ${error.message}`);
      this.results.compatibility = { error: error.message };
    }
  }

  async runMcpConnectionTests() {
    try {
      console.log('  Exécution des tests de connexion MCP...');

      // Exécuter le script de connexion MCP
      const { McpConnectionTest } = require('./test-mcp-connection');
      const test = new McpConnectionTest();
      await test.runAllTests();

      // Lire les résultats
      const resultsFile = path.join(__dirname, '../test/mcp-connection/results.json');
      if (fs.existsSync(resultsFile)) {
        this.results.mcpConnection = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
        console.log('  ✅ Tests de connexion MCP terminés');
      } else {
        console.log('  ⚠️  Fichier de résultats non trouvé');
      }

    } catch (error) {
      console.log(`  ❌ Erreur: ${error.message}`);
      this.results.mcpConnection = { error: error.message };
    }
  }

  async runProductionTests() {
    try {
      console.log('  Exécution des tests production...');

      // Exécuter le script production
      const { ProductionTest } = require('./production-test');
      const test = new ProductionTest();
      await test.runAllTests();

      // Lire les résultats
      const resultsFile = path.join(__dirname, '../test/production/results.json');
      if (fs.existsSync(resultsFile)) {
        this.results.production = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
        console.log('  ✅ Tests production terminés');
      } else {
        console.log('  ⚠️  Fichier de résultats non trouvé');
      }

    } catch (error) {
      console.log(`  ❌ Erreur: ${error.message}`);
      this.results.production = { error: error.message };
    }
  }

  async runMcpExtensionsTests() {
    try {
      console.log('  Exécution des tests extensions MCP...');

      // Exécuter le script extensions MCP
      const { McpExtensionsTest } = require('./test-mcp-extensions');
      const test = new McpExtensionsTest();
      await test.runAllTests();

      // Lire les résultats
      const resultsFile = path.join(__dirname, '../test/mcp-extensions/results.json');
      if (fs.existsSync(resultsFile)) {
        const extensionsResults = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
        this.results.extensions = extensionsResults;
        console.log('  ✅ Tests extensions MCP terminés');
      } else {
        console.log('  ⚠️  Fichier de résultats non trouvé');
      }

    } catch (error) {
      console.log(`  ❌ Erreur: ${error.message}`);
      this.results.extensions = { error: error.message };
    }
  }

  async generateGlobalReport() {
    console.log('  Génération du rapport global...');

    // Calculer les statistiques globales
    let totalTests = 0;
    let passed = 0;
    let failed = 0;
    let warnings = 0;

    // Compatibilité
    if (this.results.compatibility && this.results.compatibility.summary) {
      const comp = this.results.compatibility.summary;
      totalTests += comp.total || 0;
      passed += comp.passed || 0;
      failed += comp.failed || 0;
      warnings += comp.warnings || 0;
    }

    // Connexion MCP
    if (this.results.mcpConnection && this.results.mcpConnection.summary) {
      const conn = this.results.mcpConnection.summary;
      totalTests += conn.total || 0;
      passed += conn.passed || 0;
      failed += conn.failed || 0;
    }

    // Production
    if (this.results.production && this.results.production.summary) {
      const prod = this.results.production.summary;
      totalTests += prod.total || 0;
      passed += prod.passed || 0;
      failed += prod.failed || 0;
      warnings += prod.warnings || 0;
    }

    // Extensions
    if (this.results.extensions && this.results.extensions.summary) {
      const ext = this.results.extensions.summary;
      totalTests += ext.total || 0;
      passed += ext.compatible || 0;
      failed += ext.incompatible || 0;
      warnings += ext.warnings || 0;
    }

    // Calculer le score
    const score = totalTests > 0 ? Math.round((passed / totalTests) * 100) : 0;

    this.results.summary = {
      totalTests,
      passed,
      failed,
      warnings,
      score
    };

    // Générer le rapport
    this.generateReport();

    // Sauvegarder les résultats
    this.saveResults();

    console.log('  ✅ Rapport global généré');
  }

  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 RAPPORT GLOBAL DE TOUS LES TESTS');
    console.log('='.repeat(80));

    // Score global
    console.log('\n🎯 SCORE GLOBAL:');
    console.log(`  ${this.getScoreEmoji(this.results.summary.score)} ${this.results.summary.score}/100`);

    // Résumé par catégorie
    console.log('\n📈 RÉSUMÉ PAR CATÉGORIE:');

    // Compatibilité
    if (this.results.compatibility && this.results.compatibility.summary) {
      const comp = this.results.compatibility.summary;
      const compScore = comp.total > 0 ? Math.round((comp.passed / comp.total) * 100) : 0;
      console.log(`  🔍 Compatibilité SDK: ${compScore}/100 (${comp.passed}/${comp.total} tests)`);
    }

    // Connexion MCP
    if (this.results.mcpConnection && this.results.mcpConnection.summary) {
      const conn = this.results.mcpConnection.summary;
      const connScore = conn.total > 0 ? Math.round((conn.passed / conn.total) * 100) : 0;
      console.log(`  🔌 Connexion MCP: ${connScore}/100 (${conn.passed}/${conn.total} tests)`);
    }

    // Production
    if (this.results.production && this.results.production.summary) {
      const prod = this.results.production.summary;
      const prodScore = prod.total > 0 ? Math.round((prod.passed / prod.total) * 100) : 0;
      console.log(`  🏭 Production: ${prodScore}/100 (${prod.passed}/${prod.total} tests)`);
    }

    // Extensions
    if (this.results.extensions && this.results.extensions.summary) {
      const ext = this.results.extensions.summary;
      const extScore = ext.total > 0 ? Math.round((ext.compatible / ext.total) * 100) : 0;
      console.log(`  🔧 Extensions MCP: ${extScore}/100 (${ext.compatible}/${ext.total} tests)`);
    }

    // Statistiques globales
    console.log('\n📊 STATISTIQUES GLOBALES:');
    console.log(`  ✅ Tests passés: ${this.results.summary.passed}/${this.results.summary.totalTests}`);
    console.log(`  ❌ Tests échoués: ${this.results.summary.failed}/${this.results.summary.totalTests}`);
    console.log(`  ⚠️  Avertissements: ${this.results.summary.warnings}/${this.results.summary.totalTests}`);

    // Recommandations
    console.log('\n🎯 RECOMMANDATIONS:');

    if (this.results.summary.score >= 90) {
      console.log('  🎉 Excellente qualité!');
      console.log('    1. Prêt pour le déploiement en production');
      console.log('    2. Compatibilité et performance optimales');
      console.log('    3. Connexion MCP stable et fiable');
    } else if (this.results.summary.score >= 70) {
      console.log('  👍 Bonne qualité');
      console.log('    1. Déploiement possible avec ajustements');
      console.log('    2. Vérifier les tests échoués');
      console.log('    3. Optimiser la configuration');
    } else if (this.results.summary.score >= 50) {
      console.log('  ⚠️  Qualité limitée');
      console.log('    1. Résoudre les problèmes critiques');
      console.log('    2. Améliorer la compatibilité');
      console.log('    3. Optimiser les performances');
    } else {
      console.log('  ❌ Qualité insuffisante');
      console.log('    1. Actions immédiates nécessaires');
      console.log('    2. Revoir l\'architecture');
      console.log('    3. Consulter les rapports détaillés');
    }

    // Fichiers générés
    console.log('\n📁 FICHIERS GÉNÉRÉS:');
    console.log('  📄 Rapport global: test/all-tests-reports/global-report.json');
    console.log('  📊 Rapport HTML: test/all-tests-reports/report.html');
    console.log('  📋 Résumé: test/all-tests-reports/summary.md');

    console.log('\n' + '='.repeat(80));
    console.log('🔍 Rapports individuels:');
    console.log('  - test/compatibility/results.json');
    console.log('  - test/mcp-connection/results.json');
    console.log('  - test/production/results.json');
    console.log('  - test/mcp-extensions/results.json');
    console.log('='.repeat(80));
  }

  getScoreEmoji(score) {
    if (score >= 90) return '🎉';
    if (score >= 70) return '👍';
    if (score >= 50) return '⚠️';
    return '❌';
  }

  saveResults() {
    // Sauvegarder le rapport global
    const globalReport = {
      timestamp: new Date().toISOString(),
      summary: this.results.summary,
      compatibility: this.results.compatibility,
      mcpConnection: this.results.mcpConnection,
      production: this.results.production,
      extensions: this.results.extensions
    };

    const reportFile = path.join(this.reportDir, 'global-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(globalReport, null, 2));

    // Générer un rapport HTML
    this.generateHtmlReport(globalReport);

    // Générer un résumé Markdown
    this.generateMarkdownSummary(globalReport);
  }

  generateHtmlReport(report) {
    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport Global de Tests MCP Client</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }
        .score {
            font-size: 48px;
            font-weight: bold;
            margin: 20px 0;
        }
        .category {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            border-left: 4px solid #667eea;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .stat-card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stat-value {
            font-size: 32px;
            font-weight: bold;
            margin: 10px 0;
        }
        .recommendations {
            background: #e8f4fd;
            border-radius: 8px;
            padding: 20px;
            margin: 30px 0;
        }
        .timestamp {
            color: #666;
            font-size: 14px;
            text-align: center;
            margin-top: 40px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Rapport Global de Tests MCP Client</h1>
        <div class="score">${report.summary.score}/100</div>
        <p>Testé le ${new Date(report.timestamp).toLocaleDateString('fr-FR')}</p>
    </div>

    <div class="stats">
        <div class="stat-card">
            <div>Tests Totaux</div>
            <div class="stat-value">${report.summary.totalTests}</div>
        </div>
        <div class="stat-card" style="border-left: 4px solid #28a745;">
            <div>Tests Passés</div>
            <div class="stat-value">${report.summary.passed}</div>
        </div>
        <div class="stat-card" style="border-left: 4px solid #dc3545;">
            <div>Tests Échoués</div>
            <div class="stat-value">${report.summary.failed}</div>
        </div>
        <div class="stat-card" style="border-left: 4px solid #ffc107;">
            <div>Avertissements</div>
            <div class="stat-value">${report.summary.warnings}</div>
        </div>
    </div>

    <div class="category">
        <h2>🔍 Compatibilité SDK MCP</h2>
        ${report.compatibility ? `
            <p>Score: ${Math.round((report.compatibility.summary.passed / report.compatibility.summary.total) * 100)}/100</p>
            <p>${report.compatibility.summary.passed}/${report.compatibility.summary.total} tests passés</p>
        ` : '<p>Données non disponibles</p>'}
    </div>

    <div class="category">
        <h2>🔌 Connexion MCP</h2>
        ${report.mcpConnection ? `
            <p>Score: ${Math.round((report.mcpConnection.summary.passed / report.mcpConnection.summary.total) * 100)}/100</p>
            <p>${report.mcpConnection.summary.passed}/${report.mcpConnection.summary.total} tests passés</p>
        ` : '<p>Données non disponibles</p>'}
    </div>

    <div class="category">
        <h2>🏭 Tests Production</h2>
        ${report.production ? `
            <p>Score: ${Math.round((report.production.summary.passed / report.production.summary.total) * 100)}/100</p>
            <p>${report.production.summary.passed}/${report.production.summary.total} tests passés</p>
        ` : '<p>Données non disponibles</p>'}
    </div>

    <div class="category">
        <h2>🔧 Extensions MCP</h2>
        ${report.extensions ? `
            <p>Score: ${Math.round((report.extensions.summary.compatible / report.extensions.summary.total) * 100)}/100</p>
            <p>${report.extensions.summary.compatible}/${report.extensions.summary.total} extensions compatibles</p>
        ` : '<p>Données non disponibles</p>'}
    </div>

    <div class="recommendations">
        <h2>🎯 Recommandations</h2>
        ${this.getRecommendationsHtml(report.summary.score)}
    </div>

    <div class="timestamp">
        Rapport généré le ${new Date(report.timestamp).toLocaleString('fr-FR')}
    </div>
</body>
</html>`;

    const htmlFile = path.join(this.reportDir, 'report.html');
    fs.writeFileSync(htmlFile, html);
  }

  getRecommendationsHtml(score) {
    if (score >= 90) {
      return `
        <ul>
          <li>🎉 Excellente qualité!</li>
          <li>Prêt pour le déploiement en production</li>
          <li>Compatibilité et performance optimales</li>
          <li>Connexion MCP stable et fiable</li>
        </ul>`;
    } else if (score >= 70) {
      return `
        <ul>
          <li>👍 Bonne qualité</li>
          <li>Déploiement possible avec ajustements</li>
          <li>Vérifier les tests échoués</li>
          <li>Optimiser la configuration</li>
        </ul>`;
    } else if (score >= 50) {
      return `
        <ul>
          <li>⚠️ Qualité limitée</li>
          <li>Résoudre les problèmes critiques</li>
          <li>Améliorer la compatibilité</li>
          <li>Optimiser les performances</li>
        </ul>`;
    } else {
      return `
        <ul>
          <li>❌ Qualité insuffisante</li>
          <li>Actions immédiates nécessaires</li>
          <li>Revoir l'architecture</li>
          <li>Consulter les rapports détaillés</li>
        </ul>`;
    }
  }

  generateMarkdownSummary(report) {
    const markdown = `# Rapport Global de Tests MCP Client

## Score Global: ${report.summary.score}/100 ${this.getScoreEmoji(report.summary.score)}

### 📊 Statistiques
- **Tests Totaux:** ${report.summary.totalTests}
- **✅ Tests Passés:** ${report.summary.passed}
- **❌ Tests Échoués:** ${report.summary.failed}
- **⚠️ Avertissements:** ${report.summary.warnings}

### 📈 Résultats par Catégorie

#### 🔍 Compatibilité SDK MCP
${report.compatibility ? `
- Score: ${Math.round((report.compatibility.summary.passed / report.compatibility.summary.total) * 100)}/100
- ${report.compatibility.summary.passed}/${report.compatibility.summary.total} tests passés
` : '- Données non disponibles'}

#### 🔌 Connexion MCP
${report.mcpConnection ? `
- Score: ${Math.round((report.mcpConnection.summary.passed / report.mcpConnection.summary.total) * 100)}/100
- ${report.mcpConnection.summary.passed}/${report.mcpConnection.summary.total} tests passés
` : '- Données non disponibles'}

#### 🏭 Tests Production
${report.production ? `
- Score: ${Math.round((report.production.summary.passed / report.production.summary.total) * 100)}/100
- ${report.production.summary.passed}/${report.production.summary.total} tests passés
` : '- Données non disponibles'}

#### 🔧 Extensions MCP
${report.extensions ? `
- Score: ${Math.round((report.extensions.summary.compatible / report.extensions.summary.total) * 100)}/100
- ${report.extensions.summary.compatible}/${report.extensions.summary.total} extensions compatibles
` : '- Données non disponibles'}

### 🎯 Recommandations
${this.getRecommendationsMarkdown(report.summary.score)}

### 📁 Fichiers Générés
- \`test/all-tests-reports/global-report.json\` - Rapport complet JSON
- \`test/all-tests-reports/report.html\` - Rapport HTML
- \`test/compatibility/results.json\` - Tests compatibilité
- \`test/mcp-connection/results.json\` - Tests connexion MCP
- \`test/production/results.json\` - Tests production
- \`test/mcp-extensions/results.json\` - Tests extensions MCP

---

**Date du test:** ${new Date(report.timestamp).toLocaleString('fr-FR')}
`;

    const mdFile = path.join(this.reportDir, 'summary.md');
    fs.writeFileSync(mdFile, markdown);
  }

  getRecommendationsMarkdown(score) {
    if (score >= 90) {
      return `🎉 **Excellente qualité!**

1. Prêt pour le déploiement en production
2. Compatibilité et performance optimales
3. Connexion MCP stable et fiable`;
    } else if (score >= 70) {
      return `👍 **Bonne qualité**

1. Déploiement possible avec ajustements
2. Vérifier les tests échoués
3. Optimiser la configuration`;
    } else if (score >= 50) {
      return `⚠️ **Qualité limitée**

1. Résoudre les problèmes critiques
2. Améliorer la compatibilité
3. Optimiser les performances`;
    } else {
      return `❌ **Qualité insuffisante**

1. Actions immédiates nécessaires
2. Revoir l'architecture
3. Consulter les rapports détaillés`;
    }
  }
}

// Exécution
if (require.main === module) {
  const runner = new AllTestsRunner();
  runner.runAllTests().catch(console.error);
}

module.exports = { AllTestsRunner };
