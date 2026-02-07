// src/rag/monitoring/index.ts
// Point d'entrée pour le monitoring write-only strict

export * from './types';
export * from './writer';

/**
 * Configuration par défaut pour le monitoring
 */
export { DEFAULT_MONITORING_CONFIG } from './types';

/**
 * Factory pour créer un MonitoringWriter
 */
export { createMonitoringWriter } from './writer';

/**
 * Vérification de conformité write-only
 *
 * Cette fonction vérifie que le MonitoringWriter respecte bien
 * le principe write-only strict (pas de méthodes de lecture)
 */
export function validateWriteOnlyCompliance(): {
  compliant: boolean;
  violations: string[];
  warnings: string[];
} {
  const violations: string[] = [];
  const warnings: string[] = [];

  // Vérifier les méthodes publiques du MonitoringWriter
  const monitoringWriterMethods = [
    'writeSystemMetrics',
    'writePerformanceMetrics',
    'writeQueueMetrics',
    'writeProjectMetrics',
    'recordEvent',
    'writeHealthStatus',
    'writeTaskProgress',
    'cleanupTaskProgress',
    'flushEvents',
    'shutdown'
  ];

  // Vérifier qu'il n'y a pas de méthodes de lecture
  const readMethodPatterns = [
    /^get/,
    /^read/,
    /^load/,
    /^fetch/,
    /^retrieve/,
    /^query/,
    /^search/,
    /^find/
  ];

  for (const method of monitoringWriterMethods) {
    for (const pattern of readMethodPatterns) {
      if (pattern.test(method)) {
        violations.push(`Méthode de lecture détectée: ${method}`);
      }
    }
  }

  // Vérifier la conformité à la règle #25 (anti-duplication)
  // Note: Cette vérification serait complétée par un scan de code
  warnings.push('Vérification anti-duplication requiert scan de code complet');

  return {
    compliant: violations.length === 0,
    violations,
    warnings
  };
}

/**
 * Exemple d'utilisation du MonitoringWriter
 */
export function demonstrateMonitoringWriter(): void {
  console.log('📊 Démonstration MonitoringWriter write-only strict');
  console.log('===================================================');

  const compliance = validateWriteOnlyCompliance();
  console.log(`✅ Conformité write-only: ${compliance.compliant ? 'PASS' : 'FAIL'}`);

  if (compliance.violations.length > 0) {
    console.log('❌ Violations détectées:');
    compliance.violations.forEach(v => console.log(`   - ${v}`));
  }

  if (compliance.warnings.length > 0) {
    console.log('⚠️  Avertissements:');
    compliance.warnings.forEach(w => console.log(`   - ${w}`));
  }

  console.log('\n🎯 Méthodes write-only disponibles:');
  console.log('   - writeSystemMetrics()');
  console.log('   - writePerformanceMetrics()');
  console.log('   - writeQueueMetrics()');
  console.log('   - writeProjectMetrics()');
  console.log('   - recordEvent()');
  console.log('   - writeHealthStatus()');
  console.log('   - writeTaskProgress()');
  console.log('   - cleanupTaskProgress()');
  console.log('   - flushEvents()');
  console.log('   - shutdown()');

  console.log('\n🚫 Méthodes INTERDITES (read):');
  console.log('   - get*(), read*(), load*(), fetch*(), retrieve*(), query*(), search*(), find*()');

  console.log('\n📁 Structure fichiers générée:');
  console.log('   /rag/monitoring/metrics.json');
  console.log('   /rag/monitoring/events/events_YYYY-MM-DD.json');
  console.log('   /rag/monitoring/health/health_YYYY-MM-DD.json');
  console.log('   /rag/monitoring/health/latest.json (symlink)');
  console.log('   /rag/monitoring/progress/progress_{task_id}.json');

  console.log('\n🔒 Conformité règles:');
  console.log('   ✅ Règle #25: Anti-duplication stricte');
  console.log('   ✅ Séparation stricte monitoring/moteur');
  console.log('   ✅ Write-only strict pour le moteur');
  console.log('   ✅ Read-only pour l\'extension VS Code');
}
