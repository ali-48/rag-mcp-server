# 📋 Guide des Tests MCP Client

Ce guide explique comment utiliser les différents scripts de test pour vérifier la compatibilité, la connexion et la production du MCP Client.

## 🚀 Scripts Disponibles

### 1. **Tests de Compatibilité SDK MCP**

```bash
node scripts/compatibility-test.js
```

**Objectif:** Vérifier la compatibilité avec le SDK MCP et Node.js.

**Tests inclus:**

- ✅ Compatibilité versions Node.js
- ✅ Compatibilité SDK MCP
- ✅ Compatibilité WebSocket
- ✅ Compatibilité TypeScript
- ✅ Compatibilité dépendances

**Fichiers générés:**

- `test/compatibility/results.json` - Résultats détaillés
- `test/compatibility/compatibility.log` - Logs de test

### 2. **Tests de Connexion MCP**

```bash
node scripts/test-mcp-connection.js
```

**Objectif:** Tester la connexion entre l'extension et le serveur MCP.

**Tests inclus:**

- ✅ Disponibilité serveur MCP
- ✅ Connexion WebSocket
- ✅ Authentification MCP
- ✅ Commandes MCP (initialize, tools/list, resources/list)
- ✅ Performances (latence, débit, stabilité)

**Fichiers générés:**

- `test/mcp-connection/results.json` - Résultats détaillés
- `test/mcp-connection/connection.log` - Logs de test

### 3. **Tests de Production**

```bash
node scripts/production-test.js
```

**Objectif:** Tester le bon fonctionnement en environnement de production.

**Tests inclus:**

- ✅ Environnement (Node.js, mémoire, disque, réseau)
- ✅ Performance (démarrage, connexion, mémoire, CPU)
- ✅ Stabilité (gestion erreurs, fuites mémoire, exécution longue)
- ✅ Sécurité (validation entrées, authentification, chiffrement)
- ✅ Monitoring (logs, métriques, alertes)

**Fichiers générés:**

- `test/production/results.json` - Résultats détaillés
- `test/production/production.log` - Logs de test

### 4. **Tests d'Extensions MCP**

```bash
node scripts/test-mcp-extensions.js
```

**Objectif:** Tester la compatibilité avec différentes extensions MCP.

**Tests inclus:**

- ✅ Compatibilité extensions courantes
- ✅ Tests d'intégration
- ✅ Tests de performance
- ✅ Tests de stabilité

**Fichiers générés:**

- `test/mcp-extensions/results.json` - Résultats détaillés
- `test/mcp-extensions/extensions.log` - Logs de test

### 5. **Tests de Compatibilité Complets**

```bash
node scripts/run-compatibility-tests.js
```

**Objectif:** Exécuter tous les tests de compatibilité et générer un rapport global.

**Tests inclus:**

- ✅ Tests compatibilité SDK
- ✅ Tests extensions MCP
- ✅ Tests production

**Fichiers générés:**

- `test/compatibility-reports/global-report.json` - Rapport global JSON
- `test/compatibility-reports/report.html` - Rapport HTML
- `test/compatibility-reports/summary.md` - Résumé Markdown

### 6. **Tous les Tests**

```bash
node scripts/run-all-tests.js
```

**Objectif:** Exécuter la suite complète de tests.

**Tests inclus:**

- ✅ Tests compatibilité SDK MCP
- ✅ Tests connexion MCP
- ✅ Tests production
- ✅ Tests extensions MCP

**Fichiers générés:**

- `test/all-tests-reports/global-report.json` - Rapport global JSON
- `test/all-tests-reports/report.html` - Rapport HTML
- `test/all-tests-reports/summary.md` - Résumé Markdown

## 📊 Interprétation des Résultats

### Scores

- **🎉 90-100%:** Excellente qualité - Prêt pour production
- **👍 70-89%:** Bonne qualité - Déploiement possible avec ajustements
- **⚠️ 50-69%:** Qualité limitée - Résoudre problèmes critiques
- **❌ 0-49%:** Qualité insuffisante - Actions immédiates nécessaires

### Catégories de Test

1. **🔍 Compatibilité SDK:** Compatibilité avec le SDK MCP et Node.js
2. **🔌 Connexion MCP:** Connexion et communication avec le serveur MCP
3. **🏭 Production:** Performance et stabilité en environnement production
4. **🔧 Extensions MCP:** Compatibilité avec les extensions MCP

## 🛠️ Configuration

### Prérequis

```bash
# Installer les dépendances
npm install

# Installer les dépendances de test
npm install --save-dev @modelcontextprotocol/sdk ws
```

### Configuration Serveur MCP

Par défaut, les tests se connectent à `ws://localhost:3000`.

Pour changer l'URL du serveur MCP:

```javascript
// Dans test-mcp-connection.js
this.mcpServerUrl = "ws://votre-serveur:port";
```

## 🔧 Dépannage

### Problèmes Courants

#### 1. Serveur MCP non disponible

```
❌ Serveur MCP: INDISPONIBLE
```

**Solution:**

- Vérifier que le serveur MCP est en cours d'exécution
- Vérifier le port (par défaut: 3000)
- Vérifier les logs du serveur MCP

#### 2. Erreurs de compatibilité SDK

```
❌ SDK MCP: INCOMPATIBLE
```

**Solution:**

- Mettre à jour le SDK MCP: `npm update @modelcontextprotocol/sdk`
- Vérifier la version Node.js (requis: Node.js 18+)
- Vérifier les dépendances manquantes

#### 3. Problèmes de performance

```
❌ Latence: TROP ÉLEVÉE
```

**Solution:**

- Optimiser la configuration réseau
- Vérifier la charge du serveur
- Tester avec un serveur MCP local

## 📈 Amélioration Continue

### 1. Ajouter de nouveaux tests

Pour ajouter un nouveau test:

```javascript
// Dans le fichier de test approprié
async testNouvelleFonctionnalite() {
  // Implémenter le test
  const passed = /* logique de test */;
  return {
    passed,
    message: passed ? 'Fonctionnalité testée avec succès' : 'Problème détecté'
  };
}
```

### 2. Personnaliser les seuils

Pour ajuster les seuils de performance:

```javascript
// Dans test-mcp-connection.js
const passed = avgLatency < 500; // Changer de 1000ms à 500ms
```

### 3. Étendre les rapports

Pour ajouter de nouvelles sections aux rapports:

```javascript
// Dans generateReport()
console.log("\n🔍 NOUVELLE CATÉGORIE:");
console.log(`  ✅ Tests: ${results}`);
```

## 🎯 Bonnes Pratiques

### 1. Exécution régulière

```bash
# Exécuter tous les tests avant chaque déploiement
node scripts/run-all-tests.js

# Exécuter les tests de compatibilité après chaque mise à jour
node scripts/compatibility-test.js
```

### 2. Surveillance continue

```bash
# Configurer une exécution automatique (cron)
0 * * * * cd /chemin/vers/extension-rag && node scripts/run-all-tests.js
```

### 3. Documentation des résultats

- Conserver les rapports HTML pour référence
- Documenter les problèmes détectés et leurs solutions
- Mettre à jour ce guide avec les nouvelles fonctionnalités

## 📁 Structure des Fichiers

```
extension-rag/
├── scripts/
│   ├── compatibility-test.js          # Tests compatibilité SDK
│   ├── test-mcp-connection.js         # Tests connexion MCP
│   ├── production-test.js             # Tests production
│   ├── test-mcp-extensions.js         # Tests extensions MCP
│   ├── run-compatibility-tests.js     # Tests compatibilité complets
│   ├── run-all-tests.js               # Tous les tests
│   └── README-TESTS.md                # Ce guide
├── test/
│   ├── compatibility/                 # Résultats compatibilité
│   ├── mcp-connection/                # Résultats connexion MCP
│   ├── production/                    # Résultats production
│   ├── mcp-extensions/                # Résultats extensions MCP
│   ├── compatibility-reports/         # Rapports compatibilité
│   └── all-tests-reports/             # Rapports tous tests
└── package.json                       # Dépendances
```

## 🔗 Ressources Utiles

- [Documentation SDK MCP](https://modelcontextprotocol.io)
- [Guide d'installation Node.js](https://nodejs.org)
- [Documentation WebSocket](https://developer.mozilla.org/docs/Web/API/WebSocket)
- [Guide de performance Node.js](https://nodejs.org/docs/latest/api/perf_hooks.html)

## 📞 Support

Pour toute question ou problème:

1. Consulter les logs de test
2. Vérifier la configuration
3. Consulter la documentation
4. Ouvrir une issue si nécessaire

---

**Dernière mise à jour:** ${new Date().toLocaleDateString('fr-FR')}

**Statut:** ✅ Tests fonctionnels et prêts à l'emploi
