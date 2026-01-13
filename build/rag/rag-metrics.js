// src/rag/rag-metrics.ts
// Métriques de qualité sémantique et performance pour le système RAG
/**
 * Collecteur de métriques RAG
 */
export class RagMetricsCollector {
    metrics = [];
    logger;
    stats = {
        semanticQuality: {},
        performance: {},
        chunking: {},
    };
    constructor(logger) {
        this.logger = logger;
    }
    /**
     * Enregistre une métrique
     */
    recordMetric(metric) {
        const fullMetric = {
            ...metric,
            timestamp: new Date(),
        };
        this.metrics.push(fullMetric);
        // Log la métrique si un logger est disponible
        if (this.logger) {
            this.logger.info(`Metric recorded: ${metric.name} = ${metric.value}${metric.unit}`, 'rag-metrics', {
                metricType: metric.type,
                metricName: metric.name,
                metricValue: metric.value,
                metricUnit: metric.unit,
                ...metric.metadata,
                ...metric.context,
            });
        }
        return fullMetric;
    }
    /**
     * Enregistre une métrique de qualité sémantique
     */
    recordSemanticQuality(name, value, metadata = {}, context) {
        return this.recordMetric({
            type: 'semantic_quality',
            name,
            value,
            unit: '',
            metadata,
            context,
        });
    }
    /**
     * Enregistre une métrique de performance
     */
    recordPerformance(name, value, unit = 'ms', metadata = {}, context) {
        return this.recordMetric({
            type: 'performance',
            name,
            value,
            unit,
            metadata,
            context,
        });
    }
    /**
     * Enregistre les résultats d'une recherche sémantique
     */
    recordSearchResults(results, searchTime, context) {
        if (results.length === 0)
            return;
        const scores = results.map(r => r.score);
        const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const minScore = Math.min(...scores);
        const maxScore = Math.max(...scores);
        // Calcul de la médiane
        const sortedScores = [...scores].sort((a, b) => a - b);
        const medianScore = sortedScores.length % 2 === 0
            ? (sortedScores[sortedScores.length / 2 - 1] + sortedScores[sortedScores.length / 2]) / 2
            : sortedScores[Math.floor(sortedScores.length / 2)];
        // Enregistrer les métriques
        this.recordSemanticQuality('search_average_similarity', averageScore, { resultCount: results.length }, context);
        this.recordSemanticQuality('search_median_similarity', medianScore, {}, context);
        this.recordSemanticQuality('search_min_similarity', minScore, {}, context);
        this.recordSemanticQuality('search_max_similarity', maxScore, {}, context);
        this.recordPerformance('search_time', searchTime, 'ms', { resultCount: results.length }, context);
        // Mettre à jour les statistiques
        this.stats.semanticQuality = {
            averageSimilarity: averageScore,
            medianSimilarity: medianScore,
            minSimilarity: minScore,
            maxSimilarity: maxScore,
            resultCount: results.length,
            scoreDistribution: this.calculateScoreDistribution(scores),
        };
    }
    /**
     * Enregistre les statistiques de chunking
     */
    recordChunkingStats(totalChunks, atomicityRate, semanticCoherenceRate, chunkingTime, byContentType, byLanguage, chunksPerFile, context) {
        // Enregistrer les métriques
        this.recordMetric({
            type: 'chunking',
            name: 'total_chunks',
            value: totalChunks,
            unit: '',
            metadata: { byContentType, byLanguage },
            context,
        });
        this.recordSemanticQuality('chunk_atomicity_rate', atomicityRate, {}, context);
        this.recordSemanticQuality('chunk_semantic_coherence_rate', semanticCoherenceRate, {}, context);
        this.recordPerformance('chunking_time', chunkingTime, 'ms', { totalChunks }, context);
        // Mettre à jour les statistiques
        this.stats.chunking = {
            totalChunks,
            averageChunkSize: 0, // À calculer si disponible
            atomicityRate,
            semanticCoherenceRate,
            byContentType,
            byLanguage,
            chunksPerFile,
        };
    }
    /**
     * Enregistre les statistiques d'indexation
     */
    recordIndexingStats(totalFiles, indexedFiles, chunksCreated, indexingTime, context) {
        const successRate = totalFiles > 0 ? (indexedFiles / totalFiles) * 100 : 0;
        this.recordMetric({
            type: 'indexing',
            name: 'indexing_success_rate',
            value: successRate,
            unit: '%',
            metadata: { totalFiles, indexedFiles, chunksCreated },
            context,
        });
        this.recordPerformance('indexing_time', indexingTime, 'ms', {
            totalFiles,
            indexedFiles,
            chunksCreated,
            filesPerSecond: totalFiles > 0 ? totalFiles / (indexingTime / 1000) : 0,
            chunksPerSecond: chunksCreated > 0 ? chunksCreated / (indexingTime / 1000) : 0,
        }, context);
        // Mettre à jour les statistiques de performance
        this.stats.performance = {
            ...this.stats.performance,
            indexingTime,
            requestCount: (this.stats.performance.requestCount || 0) + 1,
        };
    }
    /**
     * Enregistre les statistiques de cache
     */
    recordCacheStats(hits, misses, hitRate, context) {
        this.recordMetric({
            type: 'cache',
            name: 'cache_hit_rate',
            value: hitRate,
            unit: '%',
            metadata: { hits, misses },
            context,
        });
        this.stats.performance = {
            ...this.stats.performance,
            cacheHitRate: hitRate,
        };
    }
    /**
     * Calcule la distribution des scores
     */
    calculateScoreDistribution(scores) {
        if (scores.length === 0)
            return [];
        const min = Math.min(...scores);
        const max = Math.max(...scores);
        const bucketCount = Math.min(10, scores.length);
        const bucketSize = (max - min) / bucketCount;
        const distribution = [];
        for (let i = 0; i < bucketCount; i++) {
            const bucketStart = min + i * bucketSize;
            const bucketEnd = bucketStart + bucketSize;
            const count = scores.filter(score => score >= bucketStart && score < bucketEnd).length;
            distribution.push({
                score: (bucketStart + bucketEnd) / 2,
                count,
            });
        }
        return distribution;
    }
    /**
     * Obtient toutes les métriques
     */
    getMetrics(filter) {
        let metrics = [...this.metrics];
        if (filter) {
            if (filter.type) {
                metrics = metrics.filter(m => m.type === filter.type);
            }
            if (filter.since) {
                metrics = metrics.filter(m => m.timestamp >= filter.since);
            }
            if (filter.limit) {
                metrics = metrics.slice(-filter.limit);
            }
        }
        return metrics;
    }
    /**
     * Obtient les statistiques agrégées
     */
    getStats() {
        return {
            semanticQuality: this.stats.semanticQuality,
            performance: this.stats.performance,
            chunking: this.stats.chunking,
            totalMetrics: this.metrics.length,
            lastUpdate: this.metrics.length > 0 ? this.metrics[this.metrics.length - 1].timestamp : new Date(),
        };
    }
    /**
     * Exporte les métriques au format JSON
     */
    exportMetrics(format = 'json') {
        if (format === 'json') {
            return JSON.stringify({
                metrics: this.metrics,
                stats: this.getStats(),
            }, null, 2);
        }
        else {
            // Format CSV
            const headers = ['timestamp', 'type', 'name', 'value', 'unit', 'context', 'metadata'];
            const rows = this.metrics.map(metric => [
                metric.timestamp.toISOString(),
                metric.type,
                metric.name,
                metric.value.toString(),
                metric.unit,
                JSON.stringify(metric.context || {}),
                JSON.stringify(metric.metadata),
            ]);
            const csv = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
            ].join('\n');
            return csv;
        }
    }
    /**
     * Vide les métriques
     */
    clearMetrics() {
        this.metrics = [];
        this.stats = {
            semanticQuality: {},
            performance: {},
            chunking: {},
        };
    }
    /**
     * Crée un collecteur pré-configuré
     */
    static createWithLogger(logger) {
        return new RagMetricsCollector(logger);
    }
}
/**
 * Instance globale du collecteur de métriques
 */
let globalMetricsCollector = null;
/**
 * Initialise le collecteur global
 */
export function initGlobalMetricsCollector(logger) {
    if (!globalMetricsCollector) {
        globalMetricsCollector = new RagMetricsCollector(logger);
    }
    return globalMetricsCollector;
}
/**
 * Obtient le collecteur global
 */
export function getGlobalMetricsCollector() {
    if (!globalMetricsCollector) {
        return initGlobalMetricsCollector();
    }
    return globalMetricsCollector;
}
// Test unitaire si exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🧪 Test du collecteur de métriques RAG...');
    const collector = new RagMetricsCollector();
    // Tester l'enregistrement de métriques
    collector.recordSemanticQuality('test_similarity', 0.85, { test: true });
    collector.recordPerformance('test_time', 123.45, 'ms', { operation: 'test' });
    // Tester l'enregistrement de résultats de recherche
    collector.recordSearchResults([
        { score: 0.9 },
        { score: 0.8 },
        { score: 0.7 },
        { score: 0.95 },
        { score: 0.6 },
    ], 150, { projectPath: '/test/project' });
    // Tester l'enregistrement de statistiques de chunking
    collector.recordChunkingStats(100, 95.5, 92.3, 500, { code: 60, doc: 30, config: 10 }, { typescript: 40, javascript: 30, python: 30 }, 5.2, { projectPath: '/test/project' });
    // Tester l'enregistrement de statistiques d'indexation
    collector.recordIndexingStats(50, 48, 120, 2000, { projectPath: '/test/project' });
    // Tester l'enregistrement de statistiques de cache
    collector.recordCacheStats(85, 15, 85.0, { projectPath: '/test/project' });
    // Afficher les métriques
    const metrics = collector.getMetrics();
    console.log(`📊 Total métriques: ${metrics.length}`);
    const stats = collector.getStats();
    console.log('📈 Statistiques agrégées:');
    console.log(JSON.stringify(stats, null, 2));
    // Exporter les métriques
    const jsonExport = collector.exportMetrics('json');
    console.log(`📝 Export JSON (${jsonExport.length} caractères)`);
    console.log('✅ Test du collecteur de métriques RAG réussi !');
}
