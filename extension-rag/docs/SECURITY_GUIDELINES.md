# 🛡️ Guide de Sécurité - McpClient

Ce document décrit les mesures de sécurité implémentées pour la classe `McpClient` et les outils d'audit associés.

## 🎯 Objectifs de Sécurité

1. **Prévention des injections** : Validation stricte des URLs et paramètres
2. **Protection des données** : Masquage des informations sensibles
3. **Limitation des attaques** : Rate limiting et timeouts adaptatifs
4. **Auditabilité** : Logs sécurisés et traçabilité
5. **Conformité** : Respect des bonnes pratiques de sécurité

## 🔍 Outils d'Audit de Sécurité

### Script d'Audit Automatique

```bash
# Exécuter l'audit de sécurité
cd extension-rag
node scripts/security-audit-mcp-client.js

# Options disponibles
SECURITY_THRESHOLD=80 node scripts/security-audit-mcp-client.js
```

### Script d'Application des Correctifs

```bash
# Appliquer automatiquement les correctifs de sécurité
cd extension-rag
node scripts/apply-security-patches.js

# Crée automatiquement :
# 1. Backup du fichier original
# 2. Application des correctifs
# 3. Vérification de la syntaxe
# 4. Rapport détaillé
```

## 🚨 Vulnérabilités Détectées et Corrections

### 1. Validation des URLs WebSocket

#### Problème

```typescript
// AVANT - Pas de validation
this.ws = new WebSocket(serverUrl);
```

#### Solution

```typescript
// APRÈS - Validation sécurisée
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

    return true;
  } catch (error) {
    return false;
  }
}

// Utilisation dans le constructeur
if (!this.validateWebSocketUrl(serverUrl)) {
  throw new Error('URL WebSocket invalide ou non sécurisée');
}
```

#### Bénéfices

- ✅ Prévention des injections d'URL malveillantes
- ✅ Validation des protocoles autorisés (ws://, wss://)
- ✅ Vérification des ports valides
- ✅ Rejet des URLs mal formées

### 2. Sanitization des Logs

#### Problème

```typescript
// AVANT - Données sensibles exposées
console.log("Token:", userToken);
console.log("Password:", userPassword);
```

#### Solution

```typescript
// APRÈS - Sanitization automatique
private sanitizeLogData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sanitized = { ...data };
  const sensitiveFields = [
    'password', 'token', 'secret',
    'key', 'credential', 'authorization'
  ];

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

// Utilisation automatique
console.log('Données:', this.sanitizeLogData(sensitiveData));
```

#### Bénéfices

- ✅ Masquage automatique des données sensibles
- ✅ Sanitization récursive des objets imbriqués
- ✅ Compatibilité avec tous les niveaux de log
- ✅ Prévention des fuites d'informations

### 3. Rate Limiting

#### Problème

Attaques par déni de service (DoS) via requêtes massives.

#### Solution

```typescript
// Configuration du rate limiting
private requestTimestamps: number[] = [];
private readonly MAX_REQUESTS_PER_MINUTE = 60;
private readonly MAX_REQUESTS_PER_SECOND = 10;

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
    return false;
  }

  // Vérifier la limite par seconde
  const recentRequests = this.requestTimestamps.filter(
    timestamp => timestamp > oneSecondAgo
  );
  if (recentRequests.length >= this.MAX_REQUESTS_PER_SECOND) {
    return false;
  }

  // Ajouter la nouvelle requête
  this.requestTimestamps.push(now);
  return true;
}

// Utilisation dans call()
if (!this.checkRateLimit()) {
  throw new Error('Rate limit atteint. Veuillez réessayer plus tard.');
}
```

#### Bénéfices

- ✅ Prévention des attaques DoS
- ✅ Limites configurables (minute/seconde)
- ✅ Logs d'alerte automatiques
- ✅ Rejet élégant avec message d'erreur

### 4. Parsing JSON Sécurisé

#### Problème

```typescript
// AVANT - JSON.parse vulnérable
const data = JSON.parse(jsonString);
```

#### Solution

```typescript
// APRÈS - Parsing sécurisé avec limites
private safeJsonParse(jsonString: string, maxLength: number = 1000000): any {
  // Vérifier la taille
  if (jsonString.length > maxLength) {
    throw new Error('JSON trop volumineux');
  }

  // Vérifier les caractères dangereux
  const dangerousPatterns = [
    /\u2028/g, // Line separator
    /\u2029/g, // Paragraph separator
    /[\x00-\x08\x0B\x0C\x0E-\x1F]/g, // Control characters
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

// Remplacement automatique
const data = this.safeJsonParse(jsonString);
```

#### Bénéfices

- ✅ Limitation de taille pour prévenir les attaques mémoire
- ✅ Filtrage des caractères dangereux
- ✅ Gestion d'erreur améliorée
- ✅ Remplacement automatique de JSON.parse

### 5. Validation des Entrées Renforcée

#### Problème

Validation insuffisante des paramètres d'entrée.

#### Solution

```typescript
// Validation renforcée dans call()
async call(tool: string, params: any): Promise<any> {
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
      throw new Error('Validation des paramètres échouée: ' +
                     validation.errors.join(', '));
    }
  }

  // Suite de la méthode...
}
```

#### Bénéfices

- ✅ Validation type stricte
- ✅ Vérification des chaînes non vides
- ✅ Intégration JSON Schema
- ✅ Messages d'erreur descriptifs

## 📊 Métriques de Sécurité

### Score de Sécurité

Le script d'audit génère un score sur 100 basé sur :

| Catégorie        | Poids | Description                      |
| ---------------- | ----- | -------------------------------- |
| URL Validation   | 20%   | Validation des URLs WebSocket    |
| Input Validation | 15%   | Validation des paramètres        |
| JSON Parsing     | 10%   | Sécurité du parsing JSON         |
| Error Handling   | 5%    | Gestion des erreurs              |
| Logging Security | 25%   | Protection des données sensibles |
| Dependencies     | 30%   | Sécurité des dépendances         |
| Rate Limiting    | 15%   | Protection contre DoS            |
| Authentication   | 10%   | Mécanismes d'authentification    |

### Interprétation du Score

- **80-100** : ✅ SÉCURISÉ - Bonnes pratiques respectées
- **60-79** : ⚠️ AMÉLIORATIONS NÉCESSAIRES - Correctifs recommandés
- **0-59** : ❌ CRITIQUE - Actions immédiates requises

## 🔧 Intégration CI/CD

### Pipeline de Sécurité

```yaml
# .github/workflows/security.yml
name: Security Audit

on: [push, pull_request]

jobs:
  security-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      - name: Install dependencies
        run: npm ci

      - name: Run security audit
        run: |
          cd extension-rag
          node scripts/security-audit-mcp-client.js

      - name: Security gate
        run: |
          # Analyse du score de sécurité
          # Rejet si score < 70
          # Génération rapport détaillé

      - name: Apply security patches
        if: failure()
        run: |
          cd extension-rag
          node scripts/apply-security-patches.js
```

### Alertes Automatiques

```typescript
// Webhook pour notifications de sécurité
async function sendSecurityAlert(vulnerabilities: SecurityVulnerability[]) {
  const webhookUrl = process.env.SECURITY_WEBHOOK;

  if (vulnerabilities.length > 0) {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `⚠️ Vulnérabilités de sécurité détectées`,
        vulnerabilities: vulnerabilities.map((v) => ({
          severity: v.severity,
          type: v.type,
          description: v.description,
          location: v.location,
        })),
        timestamp: new Date().toISOString(),
        recommendations: [
          "Exécuter: node scripts/apply-security-patches.js",
          "Revoir: docs/SECURITY_GUIDELINES.md",
          "Contacter: équipe sécurité",
        ],
      }),
    });
  }
}
```

## 🚀 Bonnes Pratiques de Développement

### 1. Validation des Entrées

```typescript
// TOUJOURS valider les entrées
function processUserInput(input: string): void {
  // Validation type
  if (typeof input !== "string") {
    throw new Error("Input must be a string");
  }

  // Validation longueur
  if (input.length === 0 || input.length > 1000) {
    throw new Error("Input length invalid");
  }

  // Validation contenu
  const dangerousPatterns = /[<>'"&]/g;
  if (dangerousPatterns.test(input)) {
    throw new Error("Input contains dangerous characters");
  }

  // Traitement sécurisé...
}
```

### 2. Gestion des Erreurs

```typescript
// NE JAMAIS exposer les détails d'erreur
try {
  const result = await client.call("sensitive_operation", params);
} catch (error) {
  // MAUVAIS - Exposition des détails
  console.error("Erreur détaillée:", error.stack);

  // BON - Message générique
  console.error("Opération échouée");

  // MEILLEUR - Log sécurisé
  this.logSecure("error", "Operation failed", {
    operation: "sensitive_operation",
    errorType: error.constructor.name,
    timestamp: new Date().toISOString(),
  });
}
```

### 3. Configuration Sécurisée

```typescript
// Configuration avec valeurs par défaut sécurisées
const SECURE_DEFAULTS = {
  timeout: 30000, // 30 secondes max
  maxRetries: 3,
  rateLimit: {
    perMinute: 60,
    perSecond: 10,
  },
  validation: {
    maxJsonSize: 1000000, // 1MB max
    allowedProtocols: ["ws:", "wss:"],
    blockedCharacters: /[<>'"&]/g,
  },
};

// Application des defaults
const config = { ...SECURE_DEFAULTS, ...userConfig };
```

## 🔍 Tests de Sécurité

### Tests Unitaires de Sécurité

```typescript
// test/unit/security.test.ts
describe("Security Features", () => {
  test("URL validation rejects invalid protocols", () => {
    const client = new McpClient("http://insecure.com");
    expect(() => client.connect()).toThrow("URL WebSocket invalide");
  });

  test("Rate limiting blocks excessive requests", async () => {
    const client = new McpClient("ws://localhost:3000");

    // Envoyer 100 requêtes rapidement
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(client.call("get_status", {}));
    }

    // Certaines doivent échouer
    const results = await Promise.allSettled(promises);
    const failures = results.filter((r) => r.status === "rejected");
    expect(failures.length).toBeGreaterThan(0);
  });

  test("Log sanitization masks sensitive data", () => {
    const client = new McpClient("ws://localhost:3000");
    const sensitiveData = {
      password: "secret123",
      token: "abc123",
      user: { email: "test@example.com" },
    };

    const sanitized = client.sanitizeLogData(sensitiveData);
    expect(sanitized.password).toBe("***REDACTED***");
    expect(sanitized.token).toBe("***REDACTED***");
    expect(sanitized.user.email).toBe("test@example.com"); // Email non masqué
  });
});
```

### Tests d'Intrusion

```bash
# Script de test d'intrusion
#!/bin/bash
echo "🔍 Tests d'intrusion McpClient"

# Test 1: Injection d'URL
echo "Test 1: Injection URL..."
node -e "
const { McpClient } = require('./out/services/McpClient');
try {
  new McpClient('javascript:alert(\"xss\")');
  console.log('❌ ÉCHEC: Injection URL possible');
} catch (e) {
  console.log('✅ SUCCÈS: Injection URL bloquée');
}
"

# Test 2: Attaque DoS
echo "Test 2: Attaque DoS..."
node scripts/benchmark-mcp-client.js --dos-mode

# Test 3: Fuite données sensibles
echo "Test 3: Fuite données..."
node scripts/security-audit-mcp-client.js --check-leaks
```

## 📚 Documentation des Correctifs

### Journal des Correctifs

```markdown
## Journal de Sécurité - McpClient

### Version 2.1.0 (31/01/2026)

**Correctifs de sécurité appliqués:**

1. **URL Validation** (HIGH)
   - Problème: Injection d'URL WebSocket possible
   - Solution: Implémentation validateWebSocketUrl()
   - Impact: Prévention attaques par redirection

2. **Log Sanitization** (HIGH)
   - Problème: Données sensibles exposées dans logs
   - Solution: Implémentation sanitizeLogData()
   - Impact: Masquage automatique passwords/tokens

3. **Rate Limiting** (MEDIUM)
   - Problème: Attaques DoS possibles
   - Solution: Implémentation checkRateLimit()
   - Impact: Limitation 60 req/min, 10 req/sec

4. **Safe JSON Parsing** (MEDIUM)
   - Problème: JSON.parse vulnérable aux attaques
   - Solution: Implémentation safeJsonParse()
   - Impact: Limitation taille + filtrage caractères

5. **Input Validation** (MEDIUM)
   - Problème: Validation paramètres insuffisante
   - Solution: Validation renforcée dans call()
   - Impact: Rejet paramètres mal formés
```

## 🔮 Roadmap de Sécurité

### Court Terme (1-2 semaines)

1. **Chiffrement TLS** : Support obligatoire wss:// en production
2. **JWT Authentication** : Support tokens JWT pour authentification
3. **Security Headers** : Headers HTTP de sécurité pour WebSocket

### Moyen Terme (1-2 mois)

1. **Audit Automatique** : Intégration scan de vulnérabilités
2. \*\*Monitoring
