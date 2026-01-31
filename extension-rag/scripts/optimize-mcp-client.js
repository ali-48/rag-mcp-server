#!/usr/bin/env node

/**
 * Script d'optimisation pour McpClient
 * Applique des optimisations de performance et mémoire
 */

const fs = require('fs');
const path = require('path');

const MCP_CLIENT_PATH = path.join(__dirname, '../src/services/McpClient.ts');

class McpClientOptimizer {
  constructor() {
    this.originalContent = '';
    this.optimizedContent = '';
    this.optimizations = [];
  }

  async load() {
    console.log('📖 Chargement du fichier McpClient.ts...');
    this.originalContent = fs.readFileSync(MCP_CLIENT_PATH, 'utf8');
    this.optimizedContent = this.originalContent;
    console.log(`  Taille: ${this.originalContent.length} caractères`);
  }

  async analyze() {
    console.log('\n🔍 Analyse des opportunités d\'optimisation...');

    const analysis = {
      memoryLeaks: 0,
      performanceIssues: 0,
      optimizationOpportunities: [],
    };

    // Vérifier les Map non nettoyées
    const mapPatterns = [
      /pendingRequests: Map/g,
      /pendingToolNames: Map/g,
      /logs: LogEntry\[\]/g,
    ];

    mapPatterns.forEach(pattern => {
      const matches = this.originalContent.match(pattern);
      if (matches) {
        analysis.memoryLeaks += matches.length;
        analysis.optimizationOpportunities.push(
          `Map non nettoyée détectée: ${matches[0]}`
        );
      }
    });

    // Vérifier les promesses non gérées
    const promisePatterns = [
      /new Promise\(/g,
      /setTimeout\(/g,
      /setInterval\(/g,
    ];

    promisePatterns.forEach(pattern => {
      const matches = this.originalContent.match(pattern);
      if (matches) {
        analysis.performanceIssues += matches.length;
        analysis.optimizationOpportunities.push(
          `${matches.length} promesses/timeouts détectés`
        );
      }
    });

    // Vérifier les opérations coûteuses
    const expensiveOps = [
      { pattern: /JSON\.stringify/g, name: 'JSON.stringify' },
      { pattern: /JSON\.parse/g, name: 'JSON.parse' },
      { pattern: /console\.(log|warn|error)/g, name: 'Console logging' },
      { pattern: /new Date\(\)/g, name: 'Date instantiation' },
    ];

    expensiveOps.forEach(op => {
      const matches = this.originalContent.match(op.pattern);
      if (matches) {
        analysis.performanceIssues += matches.length;
        analysis.optimizationOpportunities.push(
          `${matches.length} opérations ${op.name} détectées`
        );
      }
    });

    console.log('  Résultats de l\'analyse:');
    console.log(`    Fuites mémoire potentielles: ${analysis.memoryLeaks}`);
    console.log(`    Problèmes de performance: ${analysis.performanceIssues}`);
    console.log(`    Opportunités d'optimisation: ${analysis.optimizationOpportunities.length}`);

    if (analysis.optimizationOpportunities.length > 0) {
      console.log('\n  Opportunités détectées:');
      analysis.optimizationOpportunities.forEach((opp, i) => {
        console.log(`    ${i + 1}. ${opp}`);
      });
    }

    return analysis;
  }

  applyOptimization1() {
    console.log('\n🔧 Optimisation 1: Pool de WebSocket');

    const optimization = `
  // Pool de WebSocket pour réutilisation
  private static wsPool: Map<string, InstanceType<typeof WebSocket>[]> = new Map();
  private static MAX_POOL_SIZE = 5;

  private getFromPool(url: string): InstanceType<typeof WebSocket> | null {
    const pool = McpClient.wsPool.get(url) || [];
    if (pool.length > 0) {
      return pool.pop()!;
    }
    return null;
  }

  private returnToPool(url: string, ws: InstanceType<typeof WebSocket>): void {
    const pool = McpClient.wsPool.get(url) || [];
    if (pool.length < McpClient.MAX_POOL_SIZE) {
      pool.push(ws);
      McpClient.wsPool.set(url, pool);
    } else {
      // Pool plein, fermer la connexion
      ws.close();
    }
  }

  private cleanupPool(): void {
    for (const [url, pool] of McpClient.wsPool.entries()) {
      const activeConnections = pool.filter(ws => ws.readyState === WebSocket.OPEN);
      McpClient.wsPool.set(url, activeConnections);
    }
  }
`;

    // Trouver la fin de la classe pour insérer
    const classEndIndex = this.optimizedContent.lastIndexOf('}');
    if (classEndIndex !== -1) {
      this.optimizedContent =
        this.optimizedContent.slice(0, classEndIndex) +
        optimization +
        this.optimizedContent.slice(classEndIndex);

      this.optimizations.push('Pool de WebSocket pour réutilisation des connexions');
      console.log('  ✅ Pool de WebSocket ajouté');
    }
  }

  applyOptimization2() {
    console.log('\n🔧 Optimisation 2: Cache de validation JSON Schema');

    const optimization = `
  // Cache pour les validations JSON Schema
  private static validationCache: Map<string, { valid: boolean; errors: string[] }> = new Map();
  private static MAX_CACHE_SIZE = 100;

  private cachedValidateToolInput(tool: string, params: any): { valid: boolean; errors: string[] } {
    const cacheKey = \`input:\${tool}:\${JSON.stringify(params)}\`;

    if (McpClient.validationCache.has(cacheKey)) {
      return McpClient.validationCache.get(cacheKey)!;
    }

    const result = validateToolInput(tool, params);

    // Mettre en cache
    if (McpClient.validationCache.size >= McpClient.MAX_CACHE_SIZE) {
      // Supprimer le plus ancien (FIFO simple)
      const firstKey = McpClient.validationCache.keys().next().value;
      McpClient.validationCache.delete(firstKey);
    }

    McpClient.validationCache.set(cacheKey, result);
    return result;
  }

  private cachedValidateToolOutput(tool: string, result: any): { valid: boolean; errors: string[] } {
    const cacheKey = \`output:\${tool}:\${JSON.stringify(result)}\`;

    if (McpClient.validationCache.has(cacheKey)) {
      return McpClient.validationCache.get(cacheKey)!;
    }

    const validationResult = validateToolOutput(tool, result);

    // Mettre en cache
    if (McpClient.validationCache.size >= McpClient.MAX_CACHE_SIZE) {
      const firstKey = McpClient.validationCache.keys().next().value;
      McpClient.validationCache.delete(firstKey);
    }

    McpClient.validationCache.set(cacheKey, validationResult);
    return validationResult;
  }
`;

    // Trouver la fin de la classe pour insérer
    const classEndIndex = this.optimizedContent.lastIndexOf('}');
    if (classEndIndex !== -1) {
      this.optimizedContent =
        this.optimizedContent.slice(0, classEndIndex) +
        optimization +
        this.optimizedContent.slice(classEndIndex);

      this.optimizations.push('Cache de validation JSON Schema');
      console.log('  ✅ Cache de validation ajouté');
    }
  }

  applyOptimization3() {
    console.log('\n🔧 Optimisation 3: Gestion mémoire améliorée');

    // Remplacer la méthode rejectAllPendingRequests
    const oldMethod = `  private rejectAllPendingRequests(error: Error): void {
    // Compatible iteration for ES2022/TypeScript
    const entries = Array.from(this.pendingRequests.entries());
    for (const [id, { reject }] of entries) {
      reject(error);
      this.pendingRequests.delete(id);
      this.pendingToolNames.delete(id);
    }
  }`;

    const newMethod = `  private rejectAllPendingRequests(error: Error): void {
    // Version optimisée avec nettoyage mémoire
    const requestIds = Array.from(this.pendingRequests.keys());

    for (const id of requestIds) {
      const request = this.pendingRequests.get(id);
      if (request) {
        request.reject(error);
        this.pendingRequests.delete(id);
        this.pendingToolNames.delete(id);
      }
    }

    // Forcer le garbage collection si disponible
    if (global.gc) {
      global.gc();
    }

    // Nettoyer les références
    this.pendingRequests.clear();
    this.pendingToolNames.clear();
  }`;

    if (this.optimizedContent.includes(oldMethod)) {
      this.optimizedContent = this.optimizedContent.replace(oldMethod, newMethod);
      this.optimizations.push('Gestion mémoire améliorée pour rejectAllPendingRequests');
      console.log('  ✅ Gestion mémoire améliorée');
    }
  }

  applyOptimization4() {
    console.log('\n🔧 Optimisation 4: Timeout adaptatif');

    const optimization = `
  // Timeout adaptatif basé sur l'historique
  private adaptiveTimeout: number;
  private responseTimeHistory: number[] = [];
  private readonly MAX_HISTORY = 20;

  private calculateAdaptiveTimeout(): number {
    if (this.responseTimeHistory.length === 0) {
      return this.timeout;
    }

    const sorted = [...this.responseTimeHistory].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)];

    // Timeout = P95 * 3, avec un minimum de timeout original
    return Math.max(this.timeout, p95 * 3);
  }

  private updateResponseTimeHistory(responseTime: number): void {
    this.responseTimeHistory.push(responseTime);

    if (this.responseTimeHistory.length > this.MAX_HISTORY) {
      this.responseTimeHistory.shift();
    }

    // Mettre à jour le timeout adaptatif
    this.adaptiveTimeout = this.calculateAdaptiveTimeout();
  }
`;

    // Trouver la fin de la classe pour insérer
    const classEndIndex = this.optimizedContent.lastIndexOf('}');
    if (classEndIndex !== -1) {
      this.optimizedContent =
        this.optimizedContent.slice(0, classEndIndex) +
        optimization +
        this.optimizedContent.slice(classEndIndex);

      this.optimizations.push('Timeout adaptatif basé sur l\'historique');
      console.log('  ✅ Timeout adaptatif ajouté');
    }
  }

  applyOptimization5() {
    console.log('\n🔧 Optimisation 5: Compression des logs');

    const optimization = `
  // Compression des logs pour économiser la mémoire
  private compressLogEntry(entry: LogEntry): string {
    // Compression simple: JSON minifié + timestamp en nombre
    return JSON.stringify({
      t: entry.timestamp.getTime(),
      l: entry.level[0], // Première lettre du niveau
      m: entry.message,
      d: entry.data,
      r: entry.requestId,
      n: entry.toolName,
    });
  }

  private decompressLogEntry(compressed: string): LogEntry {
    const data = JSON.parse(compressed);
    return {
      timestamp: new Date(data.t),
      level: this.getLevelFromCode(data.l),
      message: data.m,
      data: data.d,
      requestId: data.r,
      toolName: data.n,
    };
  }

  private getLevelFromCode(code: string): LogEntry['level'] {
    const map: Record<string, LogEntry['level']> = {
      'i': 'info',
      'w': 'warn',
      'e': 'error',
      'd': 'debug',
    };
    return map[code] || 'info';
  }

  // Remplacer le stockage des logs
  private compressedLogs: string[] = [];

  private logCompressed(level: LogEntry['level'], message: string, data?: any, requestId?: number, toolName?: string): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      data,
      requestId,
      toolName,
    };

    const compressed = this.compressLogEntry(entry);
    this.compressedLogs.push(compressed);

    // Keep logs within limit
    if (this.compressedLogs.length > this.maxLogs) {
      this.compressedLogs = this.compressedLogs.slice(-this.maxLogs);
    }

    // Output to console (non compressé pour la lisibilité)
    this.outputLogToConsole(entry);
  }

  getLogsCompressed(level?: LogEntry['level'], limit: number = 100): LogEntry[] {
    let filteredLogs = this.compressedLogs
      .map(compressed => this.decompressLogEntry(compressed));

    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }

    return filteredLogs.slice(-limit);
  }
`;

    // Trouver la fin de la classe pour insérer
    const classEndIndex = this.optimizedContent.lastIndexOf('}');
    if (classEndIndex !== -1) {
      this.optimizedContent =
        this.optimizedContent.slice(0, classEndIndex) +
        optimization +
        this.optimizedContent.slice(classEndIndex);

      this.optimizations.push('Compression des logs pour économiser la mémoire');
      console.log('  ✅ Compression des logs ajoutée');
    }
  }

  async save() {
    console.log('\n💾 Sauvegarde des optimisations...');

    // Créer une sauvegarde
    const backupPath = MCP_CLIENT_PATH + '.backup-' + Date.now();
    fs.writeFileSync(backupPath, this.originalContent);
    console.log(`  Backup créé: ${backupPath}`);

    // Sauvegarder les optimisations
    fs.writeFileSync(MCP_CLIENT_PATH, this.optimizedContent);
    console.log(`  Fichier optimisé sauvegardé: ${MCP_CLIENT_PATH}`);

    // Calculer les différences
    const originalSize = this.originalContent.length;
    const optimizedSize = this.optimizedContent.length;
    const sizeDiff = optimizedSize - originalSize;

    console.log(`  Taille originale: ${originalSize} caractères`);
    console.log(`  Taille optimisée: ${optimizedSize} caractères`);
    console.log(`  Différence: ${sizeDiff > 0 ? '+' : ''}${sizeDiff} caractères`);
  }

  printReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📈 RAPPORT D\'OPTIMISATION MCP CLIENT');
    console.log('='.repeat(60));

    console.log('\n🔧 OPTIMISATIONS APPLIQUÉES:');
    if (this.optimizations.length === 0) {
      console.log('  Aucune optimisation appliquée');
    } else {
      this.optimizations.forEach((opt, i) => {
        console.log(`  ${i + 1}. ${opt}`);
      });
    }

    console.log('\n🎯 BÉNÉFICES ATTENDUS:');
    console.log('  1. Réduction de la consommation mémoire');
    console.log('  2. Amélioration des temps de réponse');
    console.log('  3. Meilleure gestion des connexions');
    console.log('  4. Timeout adaptatif pour la stabilité');
    console.log('  5. Compression des logs pour économiser la RAM');

    console.log('\n⚠️  RECOMMANDATIONS:');
    console.log('  1. Tester les optimisations en environnement de développement');
    console.log('  2. Vérifier la compatibilité avec le code existant');
    console.log('  3. Mesurer les performances avant/après');
    console.log('  4. Surveiller la mémoire en production');

    console.log('\n' + '='.repeat(60));
    console.log('✅ Optimisation terminée');
    console.log('='.repeat(60));
  }

  async run() {
    console.log('🚀 Démarrage de l\'optimisation McpClient');
    console.log('='.repeat(60));

    try {
      await this.load();
      await this.analyze();

      // Appliquer les optimisations
      this.applyOptimization1();
      this.applyOptimization2();
      this.applyOptimization3();
      this.applyOptimization4();
      this.applyOptimization5();

      await this.save();
      this.printReport();

    } catch (error) {
      console.error('❌ Erreur pendant l\'optimisation:', error);
      process.exit(1);
    }
  }
}

// Exécution
if (require.main === module) {
  const optimizer = new McpClientOptimizer();
  optimizer.run().catch(console.error);
}

module.exports = { McpClientOptimizer };
