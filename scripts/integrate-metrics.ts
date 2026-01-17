/**
 * Script d'intégration des métriques d'exécution dans le code-mapper
 */

import * as fs from 'fs';
import * as path from 'path';
import { MetricsCollector } from './execution-metrics';

/**
 * Patche le script code-mapper pour ajouter les métriques d'exécution
 */
export function patchCodeMapperWithMetrics(): void {
  const codeMapperPath = path.join(__dirname, 'code-mapper.ts');

  if (!fs.existsSync(codeMapperPath)) {
    console.error('❌ Fichier code-mapper.ts non trouvé');
    return;
  }

  console.log('🔧 Patch du fichier code-mapper.ts avec les métriques...');

  const content = fs.readFileSync(codeMapperPath, 'utf8');

  // Vérifier si les métriques sont déjà intégrées
  if (content.includes('MetricsCollector') || content.includes('execution-metrics')) {
    console.log('✅ Les métriques sont déjà intégrées dans code-mapper.ts');
    return;
  }

  // Ajouter l'import
  const importStatement = `import { MetricsCollector } from './execution-metrics';\n`;

  // Trouver où insérer l'import (après les autres imports)
  const importSectionEnd = content.indexOf('\n\n', content.indexOf('import'));
  let patchedContent = content;

  if (importSectionEnd !== -1) {
    patchedContent =
      content.slice(0, importSectionEnd + 1) +
      importStatement +
      content.slice(importSectionEnd + 1);
  } else {
    // Insérer après la première ligne
    patchedContent = content.replace(/(import.*\n)/, `$1${importStatement}`);
  }

  // Ajouter le collecteur de métriques au début de main()
  const mainFunctionStart = patchedContent.indexOf('async function main()');
  if (mainFunctionStart !== -1) {
    const mainBodyStart = patchedContent.indexOf('{', mainFunctionStart) + 1;
    const metricsInit = '\n  // Initialisation des métriques d exécution\n' +
      '  const metricsCollector = new MetricsCollector({\n' +
      '    enabled: true,\n' +
      '    logMetrics: true,\n' +
      '    saveToFile: true,\n' +
      '    outputDir: \'audit/metrics\',\n' +
      '    collectMemory: true,\n' +
      '    collectQuality: true,\n' +
      '    collectComplexity: true\n' +
      '  });\n' +
      '  metricsCollector.startTimer(\'totalExecution\');\n';

    patchedContent =
      patchedContent.slice(0, mainBodyStart) +
      metricsInit +
      patchedContent.slice(mainBodyStart);
  }

  // Sauvegarder le fichier patché
  const backupPath = codeMapperPath + '.backup.metrics';
  fs.writeFileSync(backupPath, content, 'utf8');
  fs.writeFileSync(codeMapperPath, patchedContent, 'utf8');

  console.log('✅ Fichier patché avec succès');
  console.log(`📁 Backup créé: ${backupPath}`);
}

/**
 * Crée la structure de répertoires pour les métriques
 */
export function createMetricsStructure(): void {
  const metricsDir = 'audit/metrics';

  if (!fs.existsSync(metricsDir)) {
    fs.mkdirSync(metricsDir, { recursive: true });
    console.log(`✅ Répertoire de métriques créé: ${metricsDir}`);
  } else {
    console.log(`📁 Répertoire de métriques existant: ${metricsDir}`);
  }

  // Créer un fichier .gitignore pour les métriques
  const gitignorePath = path.join(metricsDir, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, '*.json\n*.log\n', 'utf8');
    console.log(`✅ Fichier .gitignore créé: ${gitignorePath}`);
  }

  // Créer un fichier README pour les métriques
  const readmePath = path.join(metricsDir, 'README.md');
  if (!fs.existsSync(readmePath)) {
    const readmeContent = `# Métriques d'Exécution

## Structure des Métriques

Les fichiers de métriques sont organisés comme suit :

### Format des fichiers
- \`metrics_TIMESTAMP.json\` - Métriques complètes au format JSON
- \`.gitignore\` - Exclusion des métriques du versioning

### Métriques collectées

#### Métriques Temporelles
- **Durée totale d'exécution** : Temps total en millisecondes
- **Début/Fin** : Timestamps de début et fin d'exécution

#### Métriques de Volume
- **Fichiers traités** : Nombre de fichiers analysés avec succès
- **Fichiers ignorés** : Nombre de fichiers ignorés (exclusions)
- **Fichiers échoués** : Nombre de fichiers ayant échoué l'analyse

#### Métriques de Taille
- **Taille totale d'entrée** : Somme des tailles de tous les fichiers analysés
- **Taille totale de sortie** : Somme des tailles des fichiers générés
- **Fichiers de sortie** : Liste des fichiers générés avec leur taille et format

#### Métriques de Performance
- **Fichiers par seconde** : Vitesse de traitement
- **Bytes par seconde** : Débit de traitement
- **Taille moyenne des fichiers** : Taille moyenne des fichiers analysés

#### Métriques de Qualité
- **Score minimum** : Score de qualité le plus bas
- **Score maximum** : Score de qualité le plus élevé
- **Score moyen** : Moyenne des scores de qualité
- **Score médian** : Médiane des scores de qualité

#### Métriques de Complexité
- **Fonctions totales** : Nombre total de fonctions analysées
- **Classes totales** : Nombre total de classes analysées
- **Imports totaux** : Nombre total d'imports détectés
- **Appels totaux** : Nombre total d'appels de fonctions
- **Complexité cyclomatique moyenne** : Complexité moyenne du code

#### Métriques Système
- **Utilisation mémoire heap** : Mémoire utilisée par le processus
- **Mémoire heap totale** : Mémoire totale allouée
- **Mémoire RSS** : Resident Set Size (mémoire physique utilisée)

#### Métriques d'Erreurs
- **Types d'erreurs** : Classification des erreurs rencontrées
- **Nombre d'occurrences** : Fréquence de chaque type d'erreur
- **Fichiers concernés** : Liste des fichiers ayant généré des erreurs

## Utilisation

### Intégration dans le code
\`\`\`typescript
import { MetricsCollector } from './execution-metrics';

// Initialisation
const metricsCollector = new MetricsCollector({
  enabled: true,
  logMetrics: true,
  saveToFile: true,
  outputDir: 'audit/metrics',
  collectMemory: true,
  collectQuality: true,
  collectComplexity: true
});

// Démarrage du timer
metricsCollector.startTimer('operationName');

// Enregistrement des métriques
metricsCollector.recordInputFile(filePath, fileSize);
metricsCollector.recordQualityScore(score);
metricsCollector.recordError('type', filePath);

// Finalisation
const metrics = metricsCollector.finalize();
const report = metricsCollector.generateReport();
\`\`\`

### Commandes de surveillance
\`\`\`bash
# Lister les fichiers de métriques
ls -la audit/metrics/

# Voir le dernier rapport
tail -n 50 audit/metrics/metrics_*.json | jq '.'

# Analyser les tendances
grep "filesPerSecond" audit/metrics/*.json | awk -F: '{print \$2}' | sort -n

# Calculer la moyenne des durées
grep "totalDuration" audit/metrics/*.json | awk -F: '{sum+=\$2} END {print "Average:", sum/NR, "ms"}'
\`\`\`

## Recommandations Basées sur les Métriques

Le système génère automatiquement des recommandations basées sur les seuils :

### Performance
- **< 10 fichiers/seconde** : Optimisation recommandée
- **> 500MB mémoire utilisée** : Vérification des fuites mémoire

### Qualité
- **< 0.5 score moyen** : Amélioration de la qualité du code

### Erreurs
- **> 10 erreurs** : Vérification de la configuration
- **> 10% fichiers échoués** : Vérification des permissions/formats

### Complexité
- **> 10 complexité cyclomatique moyenne** : Simplification du code

### Taille
- **> 1MB taille moyenne des fichiers** : Division des fichiers recommandée

## Configuration

### Options du collecteur
\`\`\`typescript
interface MetricsCollectorOptions {
  enabled: boolean;           // Activer/désactiver la collecte
  logMetrics: boolean;        // Logger les métriques dans la console
  saveToFile: boolean;        // Sauvegarder les métriques dans un fichier
  outputDir: string;          // Répertoire de sortie
  collectMemory: boolean;     // Collecter l'utilisation mémoire
  collectQuality: boolean;    // Collecter les scores de qualité
  collectComplexity: boolean; // Collecter les métriques de complexité
}
\`\`\`

### Personnalisation
Pour personnaliser les seuils et comportements, étendez la classe \`MetricsCollector\` :
\`\`\`typescript
class CustomMetricsCollector extends MetricsCollector {
  // Surcharger les méthodes pour personnaliser
}
\`\`\`

## Dépannage

### Problèmes courants
1. **Pas de métriques générées** : Vérifier que \`enabled = true\`
2. **Fichiers non sauvegardés** : Vérifier les permissions d'écriture
3. **Métriques incomplètes** : Vérifier que tous les types de collecte sont activés
4. **Performances dégradées** : Désactiver certaines collectes si nécessaire

### Commandes de diagnostic
\`\`\`bash
# Vérifier l'espace disque
du -sh audit/metrics/

# Vérifier les permissions
ls -la audit/metrics/

# Tester le collecteur
npx tsx scripts/test-metrics.ts
\`\`\`

## Intégration avec les Logs

Les métriques sont complémentaires aux logs :
- **Logs** : Détails d'exécution, erreurs, warnings
- **Métriques** : Statistiques agrégées, performances, tendances

Utilisez les deux pour une observabilité complète :
\`\`\`bash
# Corréler logs et métriques
grep "duration" audit/logs/*.log | tail -5
tail -1 audit/metrics/*.json | jq '.totalDuration'
\`\`\`
`;

    fs.writeFileSync(readmePath, readmeContent, 'utf8');
    console.log(`✅ Fichier README créé: ${readmePath}`);
  }
}

/**
 * Teste le système de métriques
 */
export function testMetricsSystem(): void {
  console.log('🧪 Test du système de métriques...');

  const metricsCollector = new MetricsCollector({
    enabled: true,
    logMetrics: true,
    saveToFile: false, // Ne pas sauvegarder pendant les tests
    collectMemory: true,
    collectQuality: true,
    collectComplexity: true
  });

  // Simuler une exécution
  metricsCollector.startTimer('testOperation');

  // Enregistrer des fichiers d'entrée
  metricsCollector.recordInputFile('/fake/path/file1.ts', 1024);
  metricsCollector.recordInputFile('/fake/path/file2.ts', 2048);
  metricsCollector.incrementCounter('inputFiles', 2);

  // Enregistrer des fichiers de sortie
  metricsCollector.recordOutputFile('audit/code_map.json', 5120, 'json');
  metricsCollector.recordOutputFile('audit/code_map.mm', 3072, 'mindmap');
  metricsCollector.recordOutputFile('audit/code_map.db', 10240, 'sqlite');

  // Enregistrer des scores de qualité
  metricsCollector.recordQualityScore(0.8);
  metricsCollector.recordQualityScore(0.6);
  metricsCollector.recordQualityScore(0.9);

  // Enregistrer des erreurs
  metricsCollector.recordError('parse', '/fake/path/error.ts');
  metricsCollector.recordError('import');

  // Enregistrer des métriques de complexité
  metricsCollector.recordComplexityMetrics({
    functions: 10,
    classes: 2,
    imports: 15,
    calls: 25,
    cyclomaticComplexity: 5
  });

  // Finaliser les métriques
  const metrics = metricsCollector.finalize();

  // Générer un rapport
  const report = metricsCollector.generateReport();

  console.log('✅ Tests de métriques complétés');
  console.log('📊 Métriques collectées:');
  console.log(`  - Durée: ${metrics.totalDuration}ms`);
  console.log(`  - Fichiers traités: ${metrics.filesProcessed}`);
  console.log(`  - Taille entrée: ${(metrics.totalInputSize / 1024).toFixed(2)} KB`);
  console.log(`  - Taille sortie: ${(metrics.totalOutputSize / 1024).toFixed(2)} KB`);
  console.log(`  - Qualité moyenne: ${metrics.qualityScores.average.toFixed(3)}`);
  console.log(`  - Mémoire utilisée: ${metrics.memoryUsage.heapUsed} MB`);
  console.log(`  - Erreurs: ${metrics.errors.length}`);

  console.log('\n📋 Extrait du rapport:');
  console.log(report.split('\n').slice(0, 20).join('\n'));
  console.log('...');
}

/**
 * Point d'entrée principal
 */
async function main() {
  console.log('🚀 Intégration des métriques d exécution');
  console.log('========================================\n');

  const args = process.argv.slice(2);
  const command = args[0] || 'all';

  switch (command) {
    case 'patch':
      patchCodeMapperWithMetrics();
      break;

    case 'structure':
      createMetricsStructure();
      break;

    case 'test':
      testMetricsSystem();
      break;

    case 'all':
      console.log('🔧 Exécution complète de l intégration...\n');
      createMetricsStructure();
      patchCodeMapperWithMetrics();
      testMetricsSystem();
      console.log('\n✅ Intégration complète terminée');
      break;

    default:
      console.log('Usage: npx tsx scripts/integrate-metrics.ts [command]');
      console.log('\nCommands:');
      console.log('  patch     - Patche code-mapper.ts pour ajouter les métriques');
      console.log('  structure - Crée la structure de répertoires pour les métriques');
      console.log('  test      - Teste le système de métriques');
      console.log('  all       - Exécute toutes les étapes (défaut)');
      break;
  }
}

// Exécution
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Erreur lors de l intégration:', error);
    process.exit(1);
  });
}

export default {
  patchCodeMapperWithMetrics,
  createMetricsStructure,
  testMetricsSystem
};
