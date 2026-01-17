/**
 * Module de métriques d'exécution pour l'audit de code
 * Mesure temps d'exécution, fichiers analysés, taille sortie, performances
 */

import * as fs from 'fs';
import * as path from 'path';
import { AuditLogger, createLogger } from './logging-utils';

export interface ExecutionMetrics {
  // Métriques temporelles
  startTime: number;
  endTime: number;
  totalDuration: number; // ms

  // Métriques de volume
  filesProcessed: number;
  filesSkipped: number;
  filesFailed: number;

  // Métriques de taille
  totalInputSize: number; // bytes
  totalOutputSize: number; // bytes
  outputFiles: Array<{
    path: string;
    size: number;
    format: string;
  }>;

  // Métriques de performance
  filesPerSecond: number;
  bytesPerSecond: number;
  averageFileSize: number;

  // Métriques de qualité
  qualityScores: {
    min: number;
    max: number;
    average: number;
    median: number;
  };

  // Métriques de complexité
  complexityMetrics: {
    totalFunctions: number;
    totalClasses: number;
    totalImports: number;
    totalCalls: number;
    averageCyclomaticComplexity: number;
  };

  // Métriques système
  memoryUsage: {
    heapUsed: number; // MB
    heapTotal: number; // MB
    external: number; // MB
    rss: number; // MB
  };

  // Métriques d'erreurs
  errors: Array<{
    type: string;
    count: number;
    files: string[];
  }>;

  // Métriques personnalisées
  customMetrics: Record<string, any>;
}

export interface MetricsCollectorOptions {
  enabled: boolean;
  logMetrics: boolean;
  saveToFile: boolean;
  outputDir: string;
  collectMemory: boolean;
  collectQuality: boolean;
  collectComplexity: boolean;
}

const DEFAULT_OPTIONS: MetricsCollectorOptions = {
  enabled: true,
  logMetrics: true,
  saveToFile: true,
  outputDir: 'audit/metrics',
  collectMemory: true,
  collectQuality: true,
  collectComplexity: true
};

export class MetricsCollector {
  private options: MetricsCollectorOptions;
  private metrics: Partial<ExecutionMetrics>;
  private logger: AuditLogger;
  private timers: Map<string, number>;
  private counters: Map<string, number>;
  private fileSizes: Map<string, number>;
  private qualityScores: number[];
  private errors: Map<string, { count: number; files: Set<string> }>;

  constructor(options?: Partial<MetricsCollectorOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.logger = createLogger();
    this.timers = new Map();
    this.counters = new Map();
    this.fileSizes = new Map();
    this.qualityScores = [];
    this.errors = new Map();

    this.reset();
  }

  /**
   * Réinitialise les métriques
   */
  reset(): void {
    this.metrics = {
      startTime: Date.now(),
      endTime: 0,
      totalDuration: 0,
      filesProcessed: 0,
      filesSkipped: 0,
      filesFailed: 0,
      totalInputSize: 0,
      totalOutputSize: 0,
      outputFiles: [],
      filesPerSecond: 0,
      bytesPerSecond: 0,
      averageFileSize: 0,
      qualityScores: {
        min: 0,
        max: 0,
        average: 0,
        median: 0
      },
      complexityMetrics: {
        totalFunctions: 0,
        totalClasses: 0,
        totalImports: 0,
        totalCalls: 0,
        averageCyclomaticComplexity: 0
      },
      memoryUsage: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0
      },
      errors: [],
      customMetrics: {}
    };

    this.timers.clear();
    this.counters.clear();
    this.fileSizes.clear();
    this.qualityScores = [];
    this.errors.clear();
  }

  /**
   * Démarre un timer
   */
  startTimer(name: string): void {
    this.timers.set(name, Date.now());
  }

  /**
   * Arrête un timer et retourne la durée
   */
  stopTimer(name: string): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(name);

    // Enregistrer la durée dans les métriques personnalisées
    if (!this.metrics.customMetrics) {
      this.metrics.customMetrics = {};
    }
    this.metrics.customMetrics[`${name}Duration`] = duration;

    return duration;
  }

  /**
   * Incrémente un compteur
   */
  incrementCounter(name: string, value: number = 1): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  /**
   * Enregistre la taille d'un fichier d'entrée
   */
  recordInputFile(filePath: string, size: number): void {
    this.fileSizes.set(filePath, size);
    this.metrics.totalInputSize = (this.metrics.totalInputSize || 0) + size;
    this.incrementCounter('inputFiles');
  }

  /**
   * Enregistre la taille d'un fichier de sortie
   */
  recordOutputFile(filePath: string, size: number, format: string): void {
    this.metrics.outputFiles = this.metrics.outputFiles || [];
    this.metrics.outputFiles.push({ path: filePath, size, format });
    this.metrics.totalOutputSize = (this.metrics.totalOutputSize || 0) + size;
  }

  /**
   * Enregistre un score de qualité
   */
  recordQualityScore(score: number): void {
    this.qualityScores.push(score);
  }

  /**
   * Enregistre une erreur
   */
  recordError(type: string, filePath?: string): void {
    if (!this.errors.has(type)) {
      this.errors.set(type, { count: 0, files: new Set() });
    }

    const error = this.errors.get(type)!;
    error.count++;

    if (filePath) {
      error.files.add(filePath);
    }
  }

  /**
   * Enregistre les métriques de complexité
   */
  recordComplexityMetrics(metrics: {
    functions?: number;
    classes?: number;
    imports?: number;
    calls?: number;
    cyclomaticComplexity?: number;
  }): void {
    if (!this.metrics.complexityMetrics) {
      this.metrics.complexityMetrics = {
        totalFunctions: 0,
        totalClasses: 0,
        totalImports: 0,
        totalCalls: 0,
        averageCyclomaticComplexity: 0
      };
    }

    const cm = this.metrics.complexityMetrics;

    if (metrics.functions !== undefined) {
      cm.totalFunctions += metrics.functions;
    }
    if (metrics.classes !== undefined) {
      cm.totalClasses += metrics.classes;
    }
    if (metrics.imports !== undefined) {
      cm.totalImports += metrics.imports;
    }
    if (metrics.calls !== undefined) {
      cm.totalCalls += metrics.calls;
    }
    if (metrics.cyclomaticComplexity !== undefined) {
      // Mettre à jour la moyenne
      const currentCount = this.counters.get('complexitySamples') || 0;
      const currentTotal = cm.averageCyclomaticComplexity * currentCount;
      const newTotal = currentTotal + metrics.cyclomaticComplexity;
      const newCount = currentCount + 1;
      cm.averageCyclomaticComplexity = newTotal / newCount;
      this.counters.set('complexitySamples', newCount);
    }
  }

  /**
   * Finalise les métriques
   */
  finalize(): ExecutionMetrics {
    this.metrics.endTime = Date.now();
    this.metrics.totalDuration = this.metrics.endTime - this.metrics.startTime;

    // Calculer les métriques dérivées
    this.calculateDerivedMetrics();

    // Collecter l'utilisation mémoire si activé
    if (this.options.collectMemory) {
      this.collectMemoryUsage();
    }

    // Calculer les métriques de qualité si activé
    if (this.options.collectQuality && this.qualityScores.length > 0) {
      this.calculateQualityMetrics();
    }

    // Préparer les erreurs
    this.prepareErrors();

    // Sauvegarder si configuré
    if (this.options.saveToFile) {
      this.saveMetrics();
    }

    // Logger si configuré
    if (this.options.logMetrics) {
      this.logMetrics();
    }

    return this.metrics as ExecutionMetrics;
  }

  /**
   * Calcule les métriques dérivées
   */
  private calculateDerivedMetrics(): void {
    const durationSeconds = this.metrics.totalDuration / 1000;

    // Fichiers par seconde
    if (durationSeconds > 0) {
      this.metrics.filesPerSecond = this.metrics.filesProcessed / durationSeconds;
      this.metrics.bytesPerSecond = this.metrics.totalInputSize / durationSeconds;
    }

    // Taille moyenne des fichiers
    if (this.metrics.filesProcessed > 0) {
      this.metrics.averageFileSize = this.metrics.totalInputSize / this.metrics.filesProcessed;
    }

    // Mettre à jour les compteurs
    this.metrics.filesProcessed = this.counters.get('inputFiles') || 0;
    this.metrics.filesSkipped = this.counters.get('skippedFiles') || 0;
    this.metrics.filesFailed = this.counters.get('failedFiles') || 0;
  }

  /**
   * Calcule les métriques de qualité
   */
  private calculateQualityMetrics(): void {
    if (this.qualityScores.length === 0) return;

    const sorted = [...this.qualityScores].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    this.metrics.qualityScores = {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      average: sum / sorted.length,
      median: sorted[Math.floor(sorted.length / 2)]
    };
  }

  /**
   * Collecte l'utilisation mémoire
   */
  private collectMemoryUsage(): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memory = process.memoryUsage();

      this.metrics.memoryUsage = {
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024 * 100) / 100, // MB
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024 * 100) / 100, // MB
        external: Math.round(memory.external / 1024 / 1024 * 100) / 100, // MB
        rss: Math.round(memory.rss / 1024 / 1024 * 100) / 100 // MB
      };
    }
  }

  /**
   * Prépare les erreurs pour le rapport
   */
  private prepareErrors(): void {
    this.metrics.errors = Array.from(this.errors.entries()).map(([type, data]) => ({
      type,
      count: data.count,
      files: Array.from(data.files)
    }));
  }

  /**
   * Sauvegarde les métriques dans un fichier
   */
  private saveMetrics(): void {
    try {
      // Créer le répertoire si nécessaire
      if (!fs.existsSync(this.options.outputDir)) {
        fs.mkdirSync(this.options.outputDir, { recursive: true });
      }

      // Générer un nom de fichier avec timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `metrics_${timestamp}.json`;
      const filepath = path.join(this.options.outputDir, filename);

      // Sauvegarder les métriques
      fs.writeFileSync(
        filepath,
        JSON.stringify(this.metrics, null, 2),
        'utf8'
      );

      this.logger.info(`Métriques sauvegardées: ${filepath}`);
    } catch (error) {
      this.logger.error('Erreur lors de la sauvegarde des métriques', error as Error);
    }
  }

  /**
   * Log les métriques
   */
  private logMetrics(): void {
    const m = this.metrics as ExecutionMetrics;

    this.logger.info('📊 Métriques d exécution', {
      duration: `${m.totalDuration}ms`,
      filesProcessed: m.filesProcessed,
      filesPerSecond: m.filesPerSecond.toFixed(2),
      totalInputSize: `${(m.totalInputSize / 1024 / 1024).toFixed(2)} MB`,
      totalOutputSize: `${(m.totalOutputSize / 1024 / 1024).toFixed(2)} MB`,
      outputFiles: m.outputFiles.length,
      qualityAverage: m.qualityScores.average.toFixed(3),
      memoryUsed: `${m.memoryUsage.heapUsed} MB`,
      errors: m.errors.length
    });
  }

  /**
   * Génère un rapport de métriques formaté
   */
  generateReport(): string {
    const m = this.metrics as ExecutionMetrics;

    return `# Rapport de Métriques d'Exécution
- **Date**: ${new Date(m.startTime).toISOString()}
- **Durée totale**: ${m.totalDuration}ms (${(m.totalDuration / 1000).toFixed(2)}s)

## Métriques de Performance
- **Fichiers traités**: ${m.filesProcessed}
- **Fichiers ignorés**: ${m.filesSkipped}
- **Fichiers échoués**: ${m.filesFailed}
- **Fichiers par seconde**: ${m.filesPerSecond.toFixed(2)}
- **Taille moyenne des fichiers**: ${(m.averageFileSize / 1024).toFixed(2)} KB
- **Débit**: ${(m.bytesPerSecond / 1024 / 1024).toFixed(2)} MB/s

## Métriques de Taille
- **Taille totale d'entrée**: ${(m.totalInputSize / 1024 / 1024).toFixed(2)} MB
- **Taille totale de sortie**: ${(m.totalOutputSize / 1024 / 1024).toFixed(2)} MB
- **Fichiers de sortie**: ${m.outputFiles.length}
${m.outputFiles.map(f => `  - ${f.path}: ${(f.size / 1024).toFixed(2)} KB (${f.format})`).join('\n')}

## Métriques de Qualité
- **Score minimum**: ${m.qualityScores.min.toFixed(3)}
- **Score maximum**: ${m.qualityScores.max.toFixed(3)}
- **Score moyen**: ${m.qualityScores.average.toFixed(3)}
- **Score médian**: ${m.qualityScores.median.toFixed(3)}

## Métriques de Complexité
- **Fonctions totales**: ${m.complexityMetrics.totalFunctions}
- **Classes totales**: ${m.complexityMetrics.totalClasses}
- **Imports totaux**: ${m.complexityMetrics.totalImports}
- **Appels totaux**: ${m.complexityMetrics.totalCalls}
- **Complexité cyclomatique moyenne**: ${m.complexityMetrics.averageCyclomaticComplexity.toFixed(2)}

## Métriques Système
- **Mémoire heap utilisée**: ${m.memoryUsage.heapUsed} MB
- **Mémoire heap totale**: ${m.memoryUsage.heapTotal} MB
- **Mémoire RSS**: ${m.memoryUsage.rss} MB

## Erreurs
${m.errors.length > 0 ? m.errors.map(e => `- **${e.type}**: ${e.count} occurrence(s)${e.files.length > 0 ? ` (fichiers: ${e.files.slice(0, 3).join(', ')}${e.files.length > 3 ? '...' : ''})` : ''}`).join('\n') : 'Aucune erreur'}

## Recommandations
${this.generateRecommendations()}
`;
  }

  /**
   * Génère des recommandations basées sur les métriques
   */
  private generateRecommendations(): string {
    const m = this.metrics as ExecutionMetrics;
    const recommendations: string[] = [];

    // Recommandations de performance
    if (m.filesPerSecond < 10) {
      recommendations.push('⚠️ Performance faible: moins de 10 fichiers par seconde. Considérez l optimisation du code.');
    }

    if (m.memoryUsage.heapUsed > 500) {
      recommendations.push('⚠️ Utilisation mémoire élevée: plus de 500MB utilisés. Vérifiez les fuites mémoire.');
    }

    // Recommandations de qualité
    if (m.qualityScores.average < 0.5) {
      recommendations.push('⚠️ Qualité moyenne faible: score inférieur à 0.5. Améliorez la qualité du code.');
    }

    // Recommandations d erreurs
    if (m.errors.length > 10) {
      recommendations.push('⚠️ Nombre élevé d erreurs: plus de 10 erreurs détectées. Vérifiez la configuration.');
    }

    if (m.filesFailed > m.filesProcessed * 0.1) {
      recommendations.push('⚠️ Taux d échec élevé: plus de 10% des fichiers ont échoué. Vérifiez les permissions et formats.');
    }

    // Recommandations de complexité
    if (m.complexityMetrics.averageCyclomaticComplexity > 10) {
      recommendations.push('⚠️ Complexité élevée: complexité cyclomatique moyenne supérieure à 10. Simplifiez le code.');
    }

    // Recommandations de taille
    if (m.averageFileSize > 1024 * 1024) {
      recommendations.push('⚠️ Fichiers trop volumineux: taille moyenne supérieure à 1MB. Considérez de diviser les fichiers.');
    }

    // Si aucune recommandation, ajouter un message positif
    if (recommendations.length === 0) {
      recommendations.push('✅ Toutes les métriques sont dans les limites acceptables. Bon travail !');
    }

    return recommendations.join('\n');
  }
}
