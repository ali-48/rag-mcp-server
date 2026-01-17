/**
 * Script d'intégration du logging dans le code-mapper
 * Ajoute la structure de logs organisée
 */

import * as fs from 'fs';
import * as path from 'path';
import { AuditLogger, createLogger } from './logging-utils';

// Interface pour les options de logging
export interface LoggingOptions {
  enabled: boolean;
  logDir: string;
  logLevel: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  includeConsole: boolean;
  maxFiles: number;
  maxFileSize: number;
}

// Options par défaut
const DEFAULT_LOGGING_OPTIONS: LoggingOptions = {
  enabled: true,
  logDir: 'audit/logs',
  logLevel: 'INFO',
  includeConsole: true,
  maxFiles: 30,
  maxFileSize: 10 * 1024 * 1024 // 10MB
};

// Logger global
let globalLogger: AuditLogger | null = null;

/**
 * Initialise le logger global
 */
export function initLogger(options?: Partial<LoggingOptions>): AuditLogger {
  const config = { ...DEFAULT_LOGGING_OPTIONS, ...options };

  if (!config.enabled) {
    // Créer un logger minimal qui ne fait rien
    globalLogger = createLogger({
      includeConsole: false,
      logDir: '/dev/null'
    });
  } else {
    globalLogger = createLogger({
      logDir: config.logDir,
      logLevel: config.logLevel,
      includeConsole: config.includeConsole,
      maxFiles: config.maxFiles,
      maxFileSize: config.maxFileSize
    });
  }

  return globalLogger;
}

/**
 * Obtient le logger global
 */
export function getLogger(): AuditLogger {
  if (!globalLogger) {
    // Initialiser avec les options par défaut
    return initLogger();
  }
  return globalLogger;
}

/**
 * Patche le script code-mapper pour ajouter le logging
 */
export function patchCodeMapper(): void {
  const codeMapperPath = path.join(__dirname, 'code-mapper.ts');

  if (!fs.existsSync(codeMapperPath)) {
    console.error('❌ Fichier code-mapper.ts non trouvé');
    return;
  }

  console.log('🔧 Patch du fichier code-mapper.ts...');

  const content = fs.readFileSync(codeMapperPath, 'utf8');

  // Vérifier si le logging est déjà intégré
  if (content.includes('import.*logging-utils') || content.includes('getLogger')) {
    console.log('✅ Le logging est déjà intégré dans code-mapper.ts');
    return;
  }

  // Ajouter l'import
  const importStatement = `import { getLogger, logInfo, logError, logWarn, startTimer } from './logging-utils';\n`;

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

  // Ajouter le logger au début de main()
  const mainFunctionStart = patchedContent.indexOf('async function main()');
  if (mainFunctionStart !== -1) {
    const mainBodyStart = patchedContent.indexOf('{', mainFunctionStart) + 1;
    const loggerInit = '\n  const logger = getLogger();\n  const totalTimer = startTimer(\'Total execution\');\n';

    patchedContent =
      patchedContent.slice(0, mainBodyStart) +
      loggerInit +
      patchedContent.slice(mainBodyStart);
  }

  // Sauvegarder le fichier patché
  const backupPath = codeMapperPath + '.backup';
  fs.writeFileSync(backupPath, content, 'utf8');
  fs.writeFileSync(codeMapperPath, patchedContent, 'utf8');

  console.log('✅ Fichier patché avec succès');
  console.log(`📁 Backup créé: ${backupPath}`);
}

/**
 * Génère un template de configuration de logging
 */
export function generateLogConfigTemplate(): string {
  return `{
  "logging": {
    "enabled": true,
    "logDir": "audit/logs",
    "logLevel": "INFO",
    "includeConsole": true,
    "maxFiles": 30,
    "maxFileSize": 10485760
  },
  "audit": {
    "outputDir": "audit",
    "formats": ["json", "mindmap", "sqlite"],
    "qualityThreshold": 0.6,
    "excludePatterns": ["node_modules", ".git", "build", "dist"]
  }
}`;
}

/**
 * Crée la structure de répertoires pour les logs
 */
export function createLogStructure(): void {
  const logDir = DEFAULT_LOGGING_OPTIONS.logDir;

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
    console.log(`✅ Répertoire de logs créé: ${logDir}`);
  } else {
    console.log(`📁 Répertoire de logs existant: ${logDir}`);
  }

  // Créer un fichier .gitignore pour les logs
  const gitignorePath = path.join(logDir, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, '*.log\n*.json\n', 'utf8');
    console.log(`✅ Fichier .gitignore créé: ${gitignorePath}`);
  }

  // Créer un fichier README pour les logs
  const readmePath = path.join(logDir, 'README.md');
  if (!fs.existsSync(readmePath)) {
    const readmeContent = `# Logs d'Audit de Code

## Structure des Logs

Les fichiers de logs sont organisés comme suit :

### Format des fichiers
- \`audit_YYYYMMDD_HHMMSS.log\` - Logs principaux avec timestamp
- \`summary_TIMESTAMP.json\` - Résumés d'exécution
- \`.gitignore\` - Exclusion des logs du versioning

### Niveaux de Log
- **INFO** : Informations générales sur l'exécution
- **WARN** : Avertissements (problèmes non critiques)
- **ERROR** : Erreurs critiques
- **DEBUG** : Informations de débogage détaillées

### Contenu des Logs
Chaque ligne de log contient :
\`\`\`
[timestamp] [LEVEL] message (duration: Xms)
\`\`\`

Exemple :
\`\`\`
[2025-01-17T02:30:45.123Z] [INFO] Starting code audit (duration: 1500ms)
\`\`\`

## Gestion des Logs

### Rotation automatique
- Maximum 30 fichiers de logs
- Taille maximale par fichier : 10MB
- Les anciens fichiers sont automatiquement supprimés

### Nettoyage
Pour nettoyer manuellement les logs :
\`\`\`bash
rm -rf audit/logs/*.log
\`\`\`

### Surveillance
Pour surveiller les logs en temps réel :
\`\`\`bash
tail -f audit/logs/audit_*.log
\`\`\`

## Intégration

Les logs sont intégrés dans :
1. **Script principal** : \`code-mapper.ts\`
2. **Hooks Git** : pre-commit, post-commit, post-merge
3. **Script cron** : \`cron-audit.sh\`
4. **GitHub Actions** : Workflow d'audit

## Dépannage

### Problèmes courants
1. **Pas de logs générés** : Vérifier que \`logging.enabled = true\`
2. **Logs trop volumineux** : Ajuster \`maxFileSize\` et \`maxFiles\`
3. **Niveau de log trop bas** : Ajuster \`logLevel\` (INFO, WARN, ERROR, DEBUG)

### Commandes utiles
\`\`\`bash
# Compter les erreurs
grep -c "[ERROR]" audit/logs/*.log

# Voir les 10 dernières erreurs
grep "[ERROR]" audit/logs/*.log | tail -10

# Analyser les performances
grep "duration:" audit/logs/*.log | awk '{sum+=\$4} END {print "Average:", sum/NR, "ms"}'
\`\`\`

## Configuration

La configuration se trouve dans :
- \`scripts/logging-utils.ts\` - Configuration par défaut
- \`code-mapper.ts\` - Options de logging

Pour personnaliser :
\`\`\`typescript
import { initLogger } from './logging-utils';

const logger = initLogger({
  logLevel: 'DEBUG',
  maxFiles: 50,
  includeConsole: false
});
\`\`\`
`;

    fs.writeFileSync(readmePath, readmeContent, 'utf8');
    console.log(`✅ Fichier README créé: ${readmePath}`);
  }
}

/**
 * Teste le système de logging
 */
export function testLoggingSystem(): void {
  console.log('🧪 Test du système de logging...');

  const logger = initLogger({
    logLevel: 'DEBUG',
    includeConsole: true
  });

  // Tests des différents niveaux
  logger.info('Test message INFO', { test: true, timestamp: Date.now() });
  logger.warn('Test message WARN', new Error('Test warning'), { test: true });
  logger.error('Test message ERROR', new Error('Test error'), { test: true });
  logger.debug('Test message DEBUG', { test: true, debug: 'detailed' });

  // Test du timer
  const timer = logger.startTimer('Test operation');
  setTimeout(() => {
    const duration = timer();
    console.log(`⏱️  Timer test: ${duration}ms`);
  }, 100);

  // Test du résumé
  logger.createExecutionSummary({
    operation: 'Test audit',
    startTime: Date.now() - 5000,
    filesProcessed: 150,
    errors: 2,
    warnings: 5,
    outputSize: 1024 * 1024, // 1MB
    metadata: { test: true, version: '1.0.0' }
  });

  console.log('✅ Tests de logging complétés');
  console.log(`📁 Logs disponibles dans: ${DEFAULT_LOGGING_OPTIONS.logDir}`);
}

/**
 * Point d'entrée principal
 */
async function main() {
  console.log('🚀 Intégration du système de logging');
  console.log('====================================\n');

  const args = process.argv.slice(2);
  const command = args[0] || 'all';

  switch (command) {
    case 'patch':
      patchCodeMapper();
      break;

    case 'structure':
      createLogStructure();
      break;

    case 'test':
      testLoggingSystem();
      break;

    case 'config':
      console.log('📋 Template de configuration:');
      console.log(generateLogConfigTemplate());
      break;

    case 'all':
      console.log('🔧 Exécution complète de l intégration...\n');
      createLogStructure();
      patchCodeMapper();
      testLoggingSystem();
      console.log('\n✅ Intégration complète terminée');
      break;

    default:
      console.log('Usage: npx tsx scripts/integrate-logging.ts [command]');
      console.log('\nCommands:');
      console.log('  patch     - Patche code-mapper.ts pour ajouter le logging');
      console.log('  structure - Crée la structure de répertoires pour les logs');
      console.log('  test      - Teste le système de logging');
      console.log('  config    - Affiche un template de configuration');
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
  initLogger,
  getLogger,
  patchCodeMapper,
  createLogStructure,
  testLoggingSystem,
  generateLogConfigTemplate
};
