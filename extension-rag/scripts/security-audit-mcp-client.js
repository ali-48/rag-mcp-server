#!/usr/bin/env node

/**
 * Script d'audit de sécurité pour McpClient
 * Vérifie les vulnérabilités potentielles, injections, et problèmes de sécurité
 */

const fs = require('fs');
const path = require('path');
const url = require('url');

const MCP_CLIENT_PATH = path.join(__dirname, '../src/services/McpClient.ts');

class SecurityAudit {
  constructor() {
    this.content = '';
    this.vulnerabilities = [];
    this.recommendations = [];
    this.securityScore = 100; // Score initial
  }

  async load() {
    console.log('📖 Chargement du fichier McpClient.ts pour audit de sécurité...');
    this.content = fs.readFileSync(MCP_CLIENT_PATH, 'utf8');
    console.log(`  Taille: ${this.content.length} caractères`);
  }

  checkUrlValidation() {
    console.log('\n🔍 Vérification de la validation des URLs WebSocket...');

    const patterns = [
      { pattern: /new WebSocket\(/g, name: 'Instanciation WebSocket' },
      { pattern: /ws:\/\//g, name: 'URL WebSocket non sécurisée' },
      { pattern: /wss:\/\//g, name: 'URL WebSocket sécurisée' },
    ];

    patterns.forEach(({ pattern, name }) => {
      const matches = this.content.match(pattern);
      if (matches) {
        console.log(`  ${name}: ${matches.length} occurrences`);
      }
    });

    // Vérifier la validation d'URL
    if (!this.content.includes('URL.parse') && !this.content.includes('new URL')) {
      this.vulnerabilities.push({
        severity: 'HIGH',
        type: 'URL_VALIDATION',
        description: 'Absence de validation des URLs WebSocket',
        location: 'Constructeur McpClient',
        impact: 'Injection de URL malveillante possible',
        recommendation: 'Implémenter validateWebSocketUrl()',
      });
      this.securityScore -= 20;
    }
  }

  checkInputValidation() {
    console.log('\n🔍 Vérification de la validation des entrées...');

    // Vérifier la validation des paramètres
    const validationPatterns = [
      { pattern: /validateToolInput/g, name: 'Validation JSON Schema' },
      { pattern: /typeof.*!==.*'string'/g, name: 'Validation type string' },
      { pattern: /typeof.*!==.*'object'/g, name: 'Validation type object' },
      { pattern: /!==.*null/g, name: 'Validation null' },
      { pattern: /!==.*undefined/g, name: 'Validation undefined' },
    ];

    validationPatterns.forEach(({ pattern, name }) => {
      const matches = this.content.match(pattern);
      if (matches) {
        console.log(`  ${name}: ${matches.length} occurrences`);
      }
    });

    // Vérifier les appels à call() sans validation
    const callPattern = /async call\(tool: string, params: any\)/;
    if (callPattern.test(this.content)) {
      const afterCall = this.content.split(callPattern)[1];
      if (!afterCall.includes('validateToolInput')) {
        this.vulnerabilities.push({
          severity: 'MEDIUM',
          type: 'INPUT_VALIDATION',
          description: 'Validation des paramètres insuffisante dans call()',
          location: 'Méthode call()',
          impact: 'Injection de paramètres malveillants',
          recommendation: 'Renforcer la validation avec JSON Schema',
        });
        this.securityScore -= 15;
      }
    }
  }

  checkJsonParsing() {
    console.log('\n🔍 Vérification du parsing JSON sécurisé...');

    const jsonPatterns = [
      { pattern: /JSON\.parse/g, name: 'JSON.parse' },
      { pattern: /JSON\.stringify/g, name: 'JSON.stringify' },
      { pattern: /try.*catch.*JSON/g, name: 'Try-catch autour de JSON' },
    ];

    jsonPatterns.forEach(({ pattern, name }) => {
      const matches = this.content.match(pattern);
      if (matches) {
        console.log(`  ${name}: ${matches.length} occurrences`);
      }
    });

    // Vérifier les JSON.parse sans try-catch
    const jsonParseMatches = this.content.match(/JSON\.parse\([^)]+\)/g);
    if (jsonParseMatches) {
      jsonParseMatches.forEach(match => {
        const context = this.getContext(match, 3);
        if (!context.includes('try') && !context.includes('catch')) {
          this.vulnerabilities.push({
            severity: 'MEDIUM',
            type: 'JSON_PARSING',
            description: 'JSON.parse sans gestion d\'erreur',
            location: `Autour de: ${match.substring(0, 50)}...`,
            impact: 'Crash sur JSON malformé',
            recommendation: 'Ajouter try-catch autour de JSON.parse',
          });
          this.securityScore -= 10;
        }
      });
    }
  }

  checkErrorHandling() {
    console.log('\n🔍 Vérification de la gestion des erreurs...');

    const errorPatterns = [
      { pattern: /try\s*{/g, name: 'Blocs try' },
      { pattern: /catch\s*\(/g, name: 'Blocs catch' },
      { pattern: /finally\s*{/g, name: 'Blocs finally' },
      { pattern: /throw new Error/g, name: 'Erreurs lancées' },
      { pattern: /console\.error/g, name: 'Logs d\'erreur' },
    ];

    errorPatterns.forEach(({ pattern, name }) => {
      const matches = this.content.match(pattern);
      if (matches) {
        console.log(`  ${name}: ${matches.length} occurrences`);
      }
    });

    // Vérifier les promesses non catchées
    const promisePattern = /new Promise\(/g;
    const promiseMatches = this.content.match(promisePattern);
    if (promiseMatches) {
      promiseMatches.forEach((match, index) => {
        const startIndex = this.content.indexOf(match, index > 0 ? this.content.indexOf(match) + 1 : 0);
        const context = this.content.substring(startIndex, startIndex + 200);
        if (!context.includes('.catch') && !context.includes('try')) {
          this.vulnerabilities.push({
            severity: 'LOW',
            type: 'PROMISE_HANDLING',
            description: 'Promesse sans gestion d\'erreur',
            location: `Autour ligne ${this.getLineNumber(startIndex)}`,
            impact: 'Erreur silencieuse',
            recommendation: 'Ajouter .catch() à la promesse',
          });
          this.securityScore -= 5;
        }
      });
    }
  }

  checkLoggingSecurity() {
    console.log('\n🔍 Vérification de la sécurité des logs...');

    // Vérifier les logs qui pourraient contenir des données sensibles
    const logPatterns = [
      { pattern: /console\.log/g, name: 'console.log' },
      { pattern: /console\.warn/g, name: 'console.warn' },
      { pattern: /console\.error/g, name: 'console.error' },
      { pattern: /this\.log\(/g, name: 'Méthode log interne' },
    ];

    logPatterns.forEach(({ pattern, name }) => {
      const matches = this.content.match(pattern);
      if (matches) {
        console.log(`  ${name}: ${matches.length} occurrences`);
      }
    });

    // Vérifier les logs de données sensibles
    const sensitivePatterns = [
      /password/gi,
      /token/gi,
      /secret/gi,
      /key/gi,
      /credential/gi,
    ];

    sensitivePatterns.forEach(pattern => {
      const matches = this.content.match(pattern);
      if (matches) {
        this.vulnerabilities.push({
          severity: 'HIGH',
          type: 'SENSITIVE_DATA_LOGGING',
          description: `Mot sensible détecté: ${matches[0]}`,
          location: 'Plusieurs occurrences',
          impact: 'Exposition de données sensibles dans les logs',
          recommendation: 'Masquer les données sensibles avant logging',
        });
        this.securityScore -= 25;
      }
    });
  }

  checkDependencies() {
    console.log('\n🔍 Vérification des dépendances de sécurité...');

    // Vérifier l'import de ws
    if (this.content.includes("import * as WebSocketModule from 'ws'")) {
      console.log('  ✅ WebSocket importé correctement');
    } else {
      this.vulnerabilities.push({
        severity: 'HIGH',
        type: 'DEPENDENCY_IMPORT',
        description: 'Import WebSocket non sécurisé',
        location: 'Import section',
        impact: 'Vulnérabilités de dépendance',
        recommendation: 'Utiliser import * as WebSocketModule from \'ws\'',
      });
      this.securityScore -= 30;
    }

    // Vérifier les dépendances non sécurisées
    const unsafePatterns = [
      /eval\(/g,
      /Function\(/g,
      /setTimeout\(.*\)/g,
      /setInterval\(.*\)/g,
    ];

    unsafePatterns.forEach(pattern => {
      const matches = this.content.match(pattern);
      if (matches) {
        this.vulnerabilities.push({
          severity: 'CRITICAL',
          type: 'UNSAFE_CODE',
          description: `Code potentiellement dangereux: ${pattern.toString()}`,
          location: `${matches.length} occurrences`,
          impact: 'Exécution de code arbitraire',
          recommendation: 'Éviter eval() et Function()',
        });
        this.securityScore -= 40;
      }
    });
  }

  checkRateLimiting() {
    console.log('\n🔍 Vérification de la limitation de débit...');

    // Vérifier la présence de rate limiting
    const rateLimitPatterns = [
      /rate.*limit/gi,
      /throttle/gi,
      /debounce/gi,
      /max.*request/gi,
      /concurrent.*request/gi,
    ];

    let hasRateLimiting = false;
    rateLimitPatterns.forEach(pattern => {
      if (this.content.match(pattern)) {
        hasRateLimiting = true;
      }
    });

    if (!hasRateLimiting) {
      this.vulnerabilities.push({
        severity: 'MEDIUM',
        type: 'RATE_LIMITING',
        description: 'Absence de rate limiting',
        location: 'Classe McpClient',
        impact: 'Attaques par déni de service',
        recommendation: 'Implémenter rate limiting pour les requêtes',
      });
      this.securityScore -= 15;
    }
  }

  checkAuthentication() {
    console.log('\n🔍 Vérification de l\'authentification...');

    // Vérifier les tokens d'authentification
    const authPatterns = [
      /auth.*token/gi,
      /bearer/gi,
      /api.*key/gi,
      /authorization/gi,
    ];

    let hasAuth = false;
    authPatterns.forEach(pattern => {
      if (this.content.match(pattern)) {
        hasAuth = true;
      }
    });

    if (!hasAuth) {
      this.recommendations.push({
        type: 'AUTHENTICATION',
        description: 'Pas de mécanisme d\'authentification détecté',
        recommendation: 'Ajouter support pour tokens JWT/Bearer',
      });
    }
  }

  getContext(searchString, lines = 3) {
    const index = this.content.indexOf(searchString);
    if (index === -1) return '';

    const start = Math.max(0, index - 100);
    const end = Math.min(this.content.length, index + searchString.length + 100);
    return this.content.substring(start, end);
  }

  getLineNumber(index) {
    const lines = this.content.substring(0, index).split('\n');
    return lines.length;
  }

  generateSecurityPatches() {
    console.log('\n🔧 Génération de correctifs de sécurité...');

    const patches = [];

    // Patch 1: Validation d'URL WebSocket
    patches.push({
      name: 'validateWebSocketUrl',
      code: `
  /**
   * Valide une URL WebSocket de manière sécurisée
   */
  private validateWebSocketUrl(urlString: string): boolean {
    try {
      const parsed = new URL(urlString);

      // Vérifier le protocole
      if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
        return false;
      }

      // Vérifier le hostname (optionnel)
      if (!parsed.hostname) {
        return false;
      }

      // Vérifier les ports valides
      const port = parseInt(parsed.port, 10);
      if (parsed.port && (port < 1 || port > 65535)) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }
`,
      description: 'Validation sécurisée des URLs WebSocket',
    });

    // Patch 2: Sanitization des logs
    patches.push({
      name: 'sanitizeLogData',
      code: `
  /**
   * Sanitize les données sensibles avant logging
   */
  private sanitizeLogData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = { ...data };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'credential'];

    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    });

    // Sanitize récursif
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeLogData(sanitized[key]);
      }
    });

    return sanitized;
  }
`,
      description: 'Masquage des données sensibles dans les logs',
    });

    // Patch 3: Rate limiting
    patches.push({
      name: 'rateLimiter',
      code: `
  // Rate limiting
  private requestTimestamps: number[] = [];
  private readonly MAX_REQUESTS_PER_MINUTE = 60;

  private checkRateLimit(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Filtrer les requêtes récentes
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => timestamp > oneMinuteAgo
    );

    // Vérifier la limite
    if (this.requestTimestamps.length >= this.MAX_REQUESTS_PER_MINUTE) {
      return false;
    }

    // Ajouter la nouvelle requête
    this.requestTimestamps.push(now);
    return true;
  }
`,
      description: 'Rate limiting basique pour prévenir les attaques DoS',
    });

    // Patch 4: Validation JSON sécurisée
    patches.push({
      name: 'safeJsonParse',
      code: `
  /**
   * Parse JSON de manière sécurisée avec limites
   */
  private safeJsonParse(jsonString: string, maxLength: number = 1000000): any {
    if (jsonString.length > maxLength) {
      throw new Error('JSON trop volumineux');
    }

    try {
      return JSON.parse(jsonString);
    } catch (error) {
      throw new Error('JSON invalide');
    }
  }
`,
      description: 'Parsing JSON sécurisé avec limite de taille',
    });

    return patches;
  }

  printReport() {
    console.log('\n' + '='.repeat(70));
    console.log('🛡️  RAPPORT D\'AUDIT DE SÉCURITÉ MCP CLIENT');
    console.log('='.repeat(70));

    console.log(`\n📊 SCORE DE SÉCURITÉ: ${this.securityScore}/100`);
    console.log('   ' + (this.securityScore >= 80 ? '✅ SÉCURISÉ' :
      this.securityScore >= 60 ? '⚠️  AMÉLIORATIONS NÉCESSAIRES' :
        '❌ CRITIQUE'));

    if (this.vulnerabilities.length > 0) {
      console.log('\n🔴 VULNÉRABILITÉS DÉTECTÉES:');
      this.vulnerabilities.forEach((vuln, i) => {
        console.log(`\n  ${i + 1}. [${vuln.severity}] ${vuln.type}`);
        console.log(`     Description: ${vuln.description}`);
        console.log(`     Localisation: ${vuln.location}`);
        console.log(`     Impact: ${vuln.impact}`);
        console.log(`     Recommandation: ${vuln.recommendation}`);
      });
    } else {
      console.log('\n✅ Aucune vulnérabilité critique détectée');
    }

    if (this.recommendations.length > 0) {
      console.log('\n💡 RECOMMANDATIONS D\'AMÉLIORATION:');
      this.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec.type}: ${rec.description}`);
        console.log(`     → ${rec.recommendation}`);
      });
    }

    // Générer les correctifs
    const patches = this.generateSecurityPatches();
    console.log('\n🔧 CORRECTIFS DE SÉCURITÉ GÉNÉRÉS:');
    patches.forEach((patch, i) => {
      console.log(`\n  ${i + 1}. ${patch.name}`);
      console.log(`     Description: ${patch.description}`);
      console.log(`     Code: ${patch.code.substring(0, 100)}...`);
    });

    console.log('\n🚀 ACTIONS RECOMMANDÉES:');
    console.log('  1. Exécuter l\'audit régulièrement: node scripts/security-audit-mcp-client.js');
    console.log('  2. Appliquer les correctifs de sécurité');
    console.log('  3. Mettre à jour les dépendances: npm audit fix');
    console.log('  4. Configurer des scans automatiques en CI/CD');

    console.log('\n' + '='.repeat(70));
    console.log('✅ Audit de sécurité terminé');
    console.log('='.repeat(70));
  }

  async run() {
    console.log('🚀 Démarrage de l\'audit de sécurité McpClient');
    console.log('='.repeat(70));

    try {
      await this.load();

      // Exécuter toutes les vérifications
      this.checkUrlValidation();
      this.checkInputValidation();
      this.checkJsonParsing();
      this.checkErrorHandling();
      this.checkLoggingSecurity();
      this.checkDependencies();
      this.checkRateLimiting();
      this.checkAuthentication();

      this.printReport();

    } catch (error) {
      console.error('❌ Erreur pendant l\'audit de sécurité:', error);
      process.exit(1);
    }
  }
}

// Exécution
if (require.main === module) {
  const audit = new SecurityAudit();
  audit.run().catch(console.error);
}

module.exports = { SecurityAudit };
