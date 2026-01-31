#!/usr/bin/env node

/**
 * Script de benchmark pour McpClient
 * Mesure les performances de connexion, temps de réponse, et utilisation mémoire
 */

const { McpClient } = require('../out/services/McpClient');
const { performance } = require('perf_hooks');

// Configuration
const SERVER_URL = process.env.MCP_SERVER_URL || 'ws://localhost:3000';
const ITERATIONS = parseInt(process.env.ITERATIONS || '10', 10);
const CONCURRENT_REQUESTS = parseInt(process.env.CONCURRENT_REQUESTS || '3', 10);

class Benchmark {
  constructor() {
    this.client = new McpClient(SERVER_URL, 30000);
    this.results = {
      connection: [],
      requests: [],
      memory: [],
      errors: 0,
    };
  }

  async measureConnection() {
    console.log('📊 Benchmark de connexion...');

    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      try {
        await this.client.connect();
        const end = performance.now();
        this.results.connection.push(end - start);
        console.log(`  Connexion ${i + 1}: ${(end - start).toFixed(2)}ms`);

        // Déconnexion pour le prochain test
        this.client.disconnect();
      } catch (error) {
        console.error(`  ❌ Connexion ${i + 1} échouée:`, error.message);
        this.results.errors++;
      }

      // Pause courte entre les connexions
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async measureRequests() {
    console.log('\n📊 Benchmark de requêtes...');

    // Se connecter une fois
    await this.client.connect();

    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      try {
        // Utiliser get_status comme requête de test
        await this.client.call('get_status', { scope: 'global' });
        const end = performance.now();
        this.results.requests.push(end - start);
        console.log(`  Requête ${i + 1}: ${(end - start).toFixed(2)}ms`);
      } catch (error) {
        console.error(`  ❌ Requête ${i + 1} échouée:`, error.message);
        this.results.errors++;
      }

      // Pause courte entre les requêtes
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    this.client.disconnect();
  }

  async measureConcurrentRequests() {
    console.log('\n📊 Benchmark de requêtes concurrentes...');

    await this.client.connect();

    const promises = [];
    for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
      const promise = (async (index) => {
        const start = performance.now();
        try {
          await this.client.call('get_status', { scope: 'global' });
          const end = performance.now();
          return { success: true, time: end - start, index };
        } catch (error) {
          return { success: false, error: error.message, index };
        }
      })(i);

      promises.push(promise);
    }

    const results = await Promise.all(promises);

    results.forEach(result => {
      if (result.success) {
        console.log(`  Requête concurrente ${result.index + 1}: ${result.time.toFixed(2)}ms`);
        this.results.requests.push(result.time);
      } else {
        console.error(`  ❌ Requête concurrente ${result.index + 1} échouée:`, result.error);
        this.results.errors++;
      }
    });

    this.client.disconnect();
  }

  measureMemory() {
    console.log('\n📊 Mesure mémoire...');

    // Mesure mémoire avant
    const memoryBefore = process.memoryUsage();

    // Créer plusieurs clients pour tester la mémoire
    const clients = [];
    for (let i = 0; i < 10; i++) {
      clients.push(new McpClient(SERVER_URL, 30000));
    }

    // Mesure mémoire après
    const memoryAfter = process.memoryUsage();

    this.results.memory.push({
      before: memoryBefore,
      after: memoryAfter,
      diff: {
        rss: memoryAfter.rss - memoryBefore.rss,
        heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
        heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
        external: memoryAfter.external - memoryBefore.external,
      },
    });

    console.log('  Utilisation mémoire:');
    console.log(`    RSS: ${(memoryAfter.rss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`    Heap Total: ${(memoryAfter.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    console.log(`    Heap Used: ${(memoryAfter.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`    External: ${(memoryAfter.external / 1024 / 1024).toFixed(2)} MB`);

    // Nettoyer
    clients.forEach(client => {
      try {
        client.disconnect();
      } catch (e) {
        // Ignorer les erreurs de déconnexion
      }
    });
  }

  calculateStats(times) {
    if (times.length === 0) return null;

    const sorted = [...times].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = sum / sorted.length;

    // Percentiles
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p90 = sorted[Math.floor(sorted.length * 0.9)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    // Écart type
    const variance = sorted.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / sorted.length;
    const stdDev = Math.sqrt(variance);

    return {
      count: sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg,
      p50,
      p90,
      p95,
      p99,
      stdDev,
    };
  }

  printReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📈 RAPPORT DE PERFORMANCE MCP CLIENT');
    console.log('='.repeat(60));

    console.log('\n📊 CONNEXIONS:');
    const connectionStats = this.calculateStats(this.results.connection);
    if (connectionStats) {
      console.log(`  Nombre: ${connectionStats.count}`);
      console.log(`  Min: ${connectionStats.min.toFixed(2)}ms`);
      console.log(`  Max: ${connectionStats.max.toFixed(2)}ms`);
      console.log(`  Moyenne: ${connectionStats.avg.toFixed(2)}ms`);
      console.log(`  P50: ${connectionStats.p50.toFixed(2)}ms`);
      console.log(`  P90: ${connectionStats.p90.toFixed(2)}ms`);
      console.log(`  P95: ${connectionStats.p95.toFixed(2)}ms`);
      console.log(`  P99: ${connectionStats.p99.toFixed(2)}ms`);
      console.log(`  Écart type: ${connectionStats.stdDev.toFixed(2)}ms`);
    } else {
      console.log('  Aucune donnée de connexion');
    }

    console.log('\n📊 REQUÊTES:');
    const requestStats = this.calculateStats(this.results.requests);
    if (requestStats) {
      console.log(`  Nombre: ${requestStats.count}`);
      console.log(`  Min: ${requestStats.min.toFixed(2)}ms`);
      console.log(`  Max: ${requestStats.max.toFixed(2)}ms`);
      console.log(`  Moyenne: ${requestStats.avg.toFixed(2)}ms`);
      console.log(`  P50: ${requestStats.p50.toFixed(2)}ms`);
      console.log(`  P90: ${requestStats.p90.toFixed(2)}ms`);
      console.log(`  P95: ${requestStats.p95.toFixed(2)}ms`);
      console.log(`  P99: ${requestStats.p99.toFixed(2)}ms`);
      console.log(`  Écart type: ${requestStats.stdDev.toFixed(2)}ms`);
    } else {
      console.log('  Aucune donnée de requête');
    }

    console.log('\n📊 MÉMOIRE:');
    if (this.results.memory.length > 0) {
      const mem = this.results.memory[0];
      console.log('  Différence après création de 10 clients:');
      console.log(`    RSS: ${(mem.diff.rss / 1024 / 1024).toFixed(2)} MB`);
      console.log(`    Heap Total: ${(mem.diff.heapTotal / 1024 / 1024).toFixed(2)} MB`);
      console.log(`    Heap Used: ${(mem.diff.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`    External: ${(mem.diff.external / 1024 / 1024).toFixed(2)} MB`);
    }

    console.log('\n📊 ERREURS:');
    console.log(`  Nombre total d'erreurs: ${this.results.errors}`);

    console.log('\n📊 RECOMMANDATIONS:');
    if (connectionStats && connectionStats.avg > 1000) {
      console.log('  ⚠️  Temps de connexion élevé (> 1s)');
      console.log('    → Vérifier la latence réseau');
      console.log('    → Optimiser le serveur WebSocket');
    }

    if (requestStats && requestStats.avg > 500) {
      console.log('  ⚠️  Temps de réponse élevé (> 500ms)');
      console.log('    → Optimiser les requêtes MCP');
      console.log('    → Vérifier la charge du serveur');
    }

    if (requestStats && requestStats.stdDev > requestStats.avg * 0.5) {
      console.log('  ⚠️  Variance élevée des temps de réponse');
      console.log('    → Instabilité réseau possible');
      console.log('    → Considérer le retry avec backoff');
    }

    if (this.results.errors > 0) {
      console.log('  ⚠️  Erreurs détectées pendant les tests');
      console.log('    → Améliorer la gestion des erreurs');
      console.log('    → Implémenter le retry automatique');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Benchmark terminé');
    console.log('='.repeat(60));
  }

  async run() {
    console.log('🚀 Démarrage du benchmark MCP Client');
    console.log(`Serveur: ${SERVER_URL}`);
    console.log(`Itérations: ${ITERATIONS}`);
    console.log(`Requêtes concurrentes: ${CONCURRENT_REQUESTS}`);
    console.log('='.repeat(60));

    try {
      await this.measureConnection();
      await this.measureRequests();
      await this.measureConcurrentRequests();
      this.measureMemory();
      this.printReport();
    } catch (error) {
      console.error('❌ Erreur pendant le benchmark:', error);
      process.exit(1);
    }
  }
}

// Exécution
if (require.main === module) {
  const benchmark = new Benchmark();
  benchmark.run().catch(console.error);
}

module.exports = { Benchmark };
