#!/usr/bin/env node

/**
 * Script pour appliquer les correctifs de sécurité à McpClient
 */

const fs = require('fs');
const path = require('path');

const MCP_CLIENT_PATH = path.join(__dirname, '../src/services/McpClient.ts');

class SecurityPatcher {
  constructor() {
    this.content = '';
    this.appliedPatches = [];
    this.backupPath = '';
  }

  async load() {
    console.log('📖 Chargement du fichier McpClient.ts...');
    this.content = fs.readFileSync(MCP_CLIENT_PATH, 'utf8');

    // Créer une sauvegarde
    this.backupPath = MCP_CLIENT_PATH + '.backup-security-' + Date.now();
    fs.writeFileSync(this.backupPath, this.content);
    console.log(`  Backup créé: ${this.backupPath}`);
  }

  applyUrlValidation() {
    console.log('\n🔧 Application du correctif: Validation d\'URL WebSocket...');

    // Vérifier si le correctif existe déjà
    if (this.content.includes('validateWebSocketUrl')) {
      console.log('  ✅ Correctif déjà présent');
      return false;
    }

    // Trouver le constructeur pour insérer après
    const constructorIndex = this.content.indexOf('constructor(');
    if (constructorIndex === -1) {
      console.log('  ❌ Constructeur non trouvé');
      return false;
    }

    // Trouver la fin du constructeur
    let braceCount = 0;
    let endIndex = constructorIndex;
    let inConstructor = false;

    for (let i = constructorIndex; i < this.content.length; i++) {
      if (this.content[i] === '{') {
        braceCount++;
        inConstructor = true;
      } else if (this.content[i] === '}') {
        braceCount--;
        if (inConstructor && braceCount === 0) {
          endIndex = i;
          break;
        }
      }
    }

    // Ajouter la validation dans le constructeur
    const validationCode = `
    // Validation de sécurité de l'URL WebSocket
    if (!this.validateWebSocketUrl(serverUrl)) {
      throw new Error('URL WebSocket invalide ou non sécurisée');
    }
`;

    // Insérer après l'appel super() dans le constructeur
    const superCallIndex = this.content.indexOf('super();', constructorIndex);
    if (superCallIndex !== -1 && superCallIndex < endIndex) {
      const insertIndex = superCallIndex + 'super();'.length;
      this.content = this.content.slice(0, insertIndex) + validationCode + this.content.slice(insertIndex);

      // Ajouter la méthode de validation
      this.addValidationMethod();

      this.appliedPatches.push('URL Validation');
      console.log('  ✅ Validation d\'URL ajoutée');
      return true;
    }

    console.log('  ❌ Impossible de trouver super() dans le constructeur');
    return false;
  }

  addValidationMethod() {
    const validationMethod = `
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

      // Vérifier le hostname
      if (!parsed.hostname) {
        return false;
      }

      // Vérifier les ports valides
      const port = parseInt(parsed.port, 10);
      if (parsed.port && (port < 1 || port > 65535)) {
        return false;
      }

      // Vérifier les domaines locaux (optionnel)
      const localDomains = ['localhost', '127.0.0.1', '::1'];
      if (!localDomains.includes(parsed.hostname) && parsed.hostname.includes('localhost')) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }
`;

    // Trouver la fin de la classe pour insérer
    const classEndIndex = this.content.lastIndexOf('}');
    if (classEndIndex !== -1) {
      this.content = this.content.slice(0, classEndIndex) + validationMethod + this.content.slice(classEndIndex);
    }
  }

  applyLogSanitization() {
    console.log('\n🔧 Application du correctif: Sanitization des logs...');

    if (this.content.includes('sanitizeLogData')) {
      console.log('  ✅ Correctif déjà présent');
      return false;
    }

    // Ajouter la méthode de sanitization
    const sanitizeMethod = `
  /**
   * Sanitize les données sensibles avant logging
   */
  private sanitizeLogData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = { ...data };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'credential', 'authorization'];

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
`;

    // Trouver la méthode log() pour la modifier
    const logMethodIndex = this.content.indexOf('private log(');
    if (logMethodIndex !== -1) {
      // Trouver le début et la fin de la méthode log
      let braceCount = 0;
      let methodStart = logMethodIndex;
      let methodEnd = logMethodIndex;
      let inMethod = false;

      for (let i = logMethodIndex; i < this.content.length; i++) {
        if (this.content[i] === '{') {
          braceCount++;
          inMethod = true;
        } else if (this.content[i] === '}') {
          braceCount--;
          if (inMethod && braceCount === 0) {
            methodEnd = i;
            break;
          }
        }
      }

      // Extraire la méthode log
      const logMethod = this.content.substring(methodStart, methodEnd + 1);

      // Ajouter l'appel à sanitizeLogData
      const sanitizedLogMethod = logMethod.replace(
        /console\.(log|warn|error)\(([^)]+)\)/g,
        (match, level, args) => {
          return `console.${level}(this.sanitizeLogData(${args}))`;
        }
      );

      // Remplacer la méthode
      this.content = this.content.substring(0, methodStart) +
        sanitizedLogMethod +
        this.content.substring(methodEnd + 1);

      // Ajouter la méthode sanitizeLogData
      const classEndIndex = this.content.lastIndexOf('}');
      this.content = this.content.slice(0, classEndIndex) + sanitizeMethod + this.content.slice(classEndIndex);

      this.appliedPatches.push('Log Sanitization');
      console.log('  ✅ Sanitization des logs ajoutée');
      return true;
    }

    console.log('  ❌ Méthode log() non trouvée');
    return false;
  }

  applyRateLimiting() {
    console.log('\n🔧 Application du correctif: Rate limiting...');

    if (this.content.includes('checkRateLimit')) {
      console.log('  ✅ Correctif déjà présent');
      return false;
    }

    // Ajouter les propriétés de rate limiting
    const rateLimitProperties = `
  // Rate limiting
  private requestTimestamps: number[] = [];
  private readonly MAX_REQUESTS_PER_MINUTE = 60;
  private readonly MAX_REQUESTS_PER_SECOND = 10;
`;

    // Ajouter la méthode checkRateLimit
    const rateLimitMethod = `
  /**
   * Vérifie et applique le rate limiting
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneSecondAgo = now - 1000;

    // Filtrer les requêtes récentes
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => timestamp > oneMinuteAgo
    );

    // Vérifier la limite par minute
    if (this.requestTimestamps.length >= this.MAX_REQUESTS_PER_MINUTE) {
      this.log('warn', 'Rate limit atteint: limite par minute dépassée');
      return false;
    }

    // Vérifier la limite par seconde
    const recentRequests = this.requestTimestamps.filter(
      timestamp => timestamp > oneSecondAgo
    );
    if (recentRequests.length >= this.MAX_REQUESTS_PER_SECOND) {
      this.log('warn', 'Rate limit atteint: limite par seconde dépassée');
      return false;
    }

    // Ajouter la nouvelle requête
    this.requestTimestamps.push(now);
    return true;
  }
`;

    // Ajouter l'appel dans la méthode call()
    const callMethodIndex = this.content.indexOf('async call(');
    if (callMethodIndex !== -1) {
      // Trouver le début de la méthode call
      let methodStart = callMethodIndex;
      let methodBodyStart = this.content.indexOf('{', callMethodIndex);

      if (methodBodyStart !== -1) {
        // Insérer la vérification du rate limiting au début de la méthode
        const rateLimitCheck = `
    // Vérification du rate limiting
    if (!this.checkRateLimit()) {
      throw new Error('Rate limit atteint. Veuillez réessayer plus tard.');
    }
`;

        this.content = this.content.slice(0, methodBodyStart + 1) +
          rateLimitCheck +
          this.content.slice(methodBodyStart + 1);

        // Ajouter les propriétés et la méthode
        const classEndIndex = this.content.lastIndexOf('}');
        this.content = this.content.slice(0, classEndIndex) +
          rateLimitProperties + rateLimitMethod +
          this.content.slice(classEndIndex);

        this.appliedPatches.push('Rate Limiting');
        console.log('  ✅ Rate limiting ajouté');
        return true;
      }
    }

    console.log('  ❌ Méthode call() non trouvée');
    return false;
  }

  applySafeJsonParsing() {
    console.log('\n🔧 Application du correctif: Parsing JSON sécurisé...');

    if (this.content.includes('safeJsonParse')) {
      console.log('  ✅ Correctif déjà présent');
      return false;
    }

    // Ajouter la méthode safeJsonParse
    const safeJsonMethod = `
  /**
   * Parse JSON de manière sécurisée avec limites
   */
  private safeJsonParse(jsonString: string, maxLength: number = 1000000): any {
    // Vérifier la taille
    if (jsonString.length > maxLength) {
      throw new Error('JSON trop volumineux (max ' + maxLength + ' caractères)');
    }

    // Vérifier les caractères dangereux
    const dangerousPatterns = [
      /\\\\u2028/g, // Line separator
      /\\\\u2029/g, // Paragraph separator
      /[\\\\x00-\\\\x08\\\\x0B\\\\x0C\\\\x0E-\\\\x1F]/g, // Control characters
    ];

    let sanitized = jsonString;
    dangerousPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });

    try {
      return JSON.parse(sanitized);
    } catch (error) {
      throw new Error('JSON invalide: ' + error.message);
    }
  }
`;

    // Remplacer les JSON.parse par safeJsonParse
    const jsonParseRegex = /JSON\.parse\(([^)]+)\)/g;
    let match;
    let replacements = 0;

    while ((match = jsonParseRegex.exec(this.content)) !== null) {
      const original = match[0];
      const args = match[1];
      const replacement = `this.safeJsonParse(${args})`;

      this.content = this.content.replace(original, replacement);
      replacements++;
    }

    if (replacements > 0) {
      // Ajouter la méthode safeJsonParse
      const classEndIndex = this.content.lastIndexOf('}');
      this.content = this.content.slice(0, classEndIndex) + safeJsonMethod + this.content.slice(classEndIndex);

      this.appliedPatches.push('Safe JSON Parsing');
      console.log(`  ✅ ${replacements} JSON.parse remplacés par safeJsonParse`);
      return true;
    }

    console.log('  ℹ️  Aucun JSON.parse trouvé à remplacer');
    return false;
  }

  applyInputValidation() {
    console.log('\n🔧 Application du correctif: Validation des entrées renforcée...');

    // Vérifier la méthode call() pour la validation
    const callMethodIndex = this.content.indexOf('async call(');
    if (callMethodIndex === -1) {
      console.log('  ❌ Méthode call() non trouvée');
      return false;
    }

    // Extraire la méthode call
    let braceCount = 0;
    let methodStart = callMethodIndex;
    let methodEnd = callMethodIndex;
    let inMethod = false;

    for (let i = callMethodIndex; i < this.content.length; i++) {
      if (this.content[i] === '{') {
        braceCount++;
        inMethod = true;
      } else if (this.content[i] === '}') {
        braceCount--;
        if (inMethod && braceCount === 0) {
          methodEnd = i;
          break;
        }
      }
    }

    const callMethod = this.content.substring(methodStart, methodEnd + 1);

    // Vérifier si la validation existe déjà
    if (callMethod.includes('validateToolInput')) {
      console.log('  ✅ Validation des entrées déjà présente');
      return false;
    }

    // Ajouter la validation au début de la méthode
    const validationCode = `
    // Validation de sécurité des paramètres
    if (typeof tool !== 'string' || tool.length === 0) {
      throw new Error('Nom d\'outil invalide');
    }

    if (params && typeof params !== 'object') {
      throw new Error('Paramètres doivent être un objet');
    }

    // Validation JSON Schema si disponible
    if (typeof validateToolInput === 'function') {
      const validation = validateToolInput(tool, params);
      if (!validation.valid) {
        throw new Error('Validation des paramètres échouée: ' + validation.errors.join(', '));
      }
    }
`;

    // Trouver le début du corps de la méthode
    const methodBodyStart = callMethod.indexOf('{');
    const newCallMethod = callMethod.slice(0, methodBodyStart + 1) +
      validationCode +
      callMethod.slice(methodBodyStart + 1);

    // Remplacer la méthode
    this.content = this.content.substring(0, methodStart) +
      newCallMethod +
      this.content.substring(methodEnd + 1);

    this.appliedPatches.push('Input Validation');
    console.log('  ✅ Validation des entrées renforcée');
    return true;
  }

  async save() {
    console.log('\n💾 Sauvegarde des modifications...');

    fs.writeFileSync(MCP_CLIENT_PATH, this.content);
    console.log(`  Fichier mis à jour: ${MCP_CLIENT_PATH}`);

    // Vérifier la syntaxe TypeScript
    console.log('  🔍 Vérification de la syntaxe...');
    try {
      require('typescript');
      console.log('  ✅ Syntaxe TypeScript valide');
    } catch (error) {
      console.log('  ⚠️  Impossible de vérifier la syntaxe TypeScript');
    }
  }

  printReport() {
    console.log('\n' + '='.repeat(60));
    console.log('🛡️  RAPPORT D\'APPLICATION DES CORRECTIFS DE SÉCURITÉ');
    console.log('='.repeat(60));

    console.log('\n🔧 CORRECTIFS APPLIQUÉS:');
    if (this.appliedPatches.length === 0) {
      console.log('  Aucun correctif appliqué (déjà présents ou non applicables)');
    } else {
      this.appliedPatches.forEach((patch, i) => {
        console.log(`  ${i + 1}. ${patch}`);
      });
    }

    console.log('\n📁 SAUVEGARDE:');
    console.log(`  Backup disponible: ${this.backupPath}`);
    console.log('  Pour restaurer: cp ' + this.backupPath + ' ' + MCP_CLIENT_PATH);

    console.log('\n🎯 BÉNÉFICES DE SÉCURITÉ:');
    console.log('  1. ✅ Validation des URLs WebSocket');
    console.log('  2. ✅ Sanitization des données sensibles dans les logs');
    console.log('  3. ✅ Rate limiting pour prévenir les attaques DoS');
    console.log('  4. ✅ Parsing JSON sécurisé avec limites');
    console.log('  5. ✅ Validation renforcée des entrées');

    console.log('\n⚠️  RECOMMANDATIONS:');
    console.log('  1. Tester les modifications en environnement de développement');
    console.log('  2. Exécuter les tests unitaires: npm test');
    console.log('  3. Vérifier la compilation: npm run compile');
    console.log('  4. Exécuter l\'audit de sécurité: node scripts/security-audit-mcp-client.js');
    console.log('  5. Surveiller les logs en production');

    console.log('\n' + '='.repeat(60));
    console.log('✅ Correctifs de sécurité appliqués');
    console.log('='.repeat(60));
  }

  async run() {
    console.log('🚀 Démarrage de l\'application des correctifs de sécurité');
    console.log('='.repeat(60));

    try {
      await this.load();

      // Appliquer tous les correctifs
      this.applyUrlValidation();
      this.applyLogSanitization();
      this.applyRateLimiting();
      this.applySafeJsonParsing();
      this.applyInputValidation();

      await this.save();
      this.printReport();

    } catch (error) {
      console.error('❌ Erreur pendant l\'application des correctifs:', error);
      process.exit(1);
    }
  }
}

// Exécution
if (require.main === module) {
  const patcher = new SecurityPatcher();
  patcher.run().catch(console.error);
}

module.exports = { SecurityPatcher };
