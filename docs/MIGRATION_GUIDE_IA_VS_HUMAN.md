# Guide de Migration : Transition IA vs Humain

## 📋 Vue d'ensemble

Ce guide aide les utilisateurs existants à comprendre et adopter la nouvelle architecture de séparation stricte entre IA et humains dans le système RAG MCP.

## 🎯 Pourquoi cette migration ?

### Ancien modèle (obsolète)

- Interface mixte : IA et humains utilisaient les mêmes interfaces
- Confusion des rôles : Humains pouvaient exécuter des opérations RAG
- Manque de clarté : Pas de séparation claire des responsabilités

### Nouveau modèle (recommandé)

- **IA uniquement** : Exécute toutes les opérations RAG via MCP
- **Humains uniquement** : Surveillent et configurent via extension VS Code
- **Séparation stricte** : Rôles clairement définis et isolés

## 🔄 Ce qui change

### Avant → Après

| Aspect                    | Avant (Obsolète)        | Après (Recommandé)                     |
| ------------------------- | ----------------------- | -------------------------------------- |
| **Initialisation projet** | Humain : `rag init`     | IA : `init_rag` via MCP                |
| **Pipeline RAG**          | Humain : `rag activate` | IA : `activated_rag` via MCP           |
| **Recherche**             | Humain : `rag query`    | IA : `query_rag` via MCP               |
| **Surveillance**          | IA : `get_status`       | Humain : Extension VS Code Dashboard   |
| **Configuration**         | IA : Modifie config     | Humain : Extension VS Code Config      |
| **Logs**                  | Mixte : stdout/stderr   | Séparé : IA (stderr), Humain (LogView) |

## 🚀 Guide étape par étape

### Étape 1 : Comprendre la nouvelle architecture

Lisez les documents suivants :

1. [ARCHITECTURE_IA_VS_HUMAN.md](../ARCHITECTURE_IA_VS_HUMAN.md) - Principes fondamentaux
2. [VSCODE_CONTEXT_API.md](./VSCODE_CONTEXT_API.md) - API contexte VS Code
3. [FEDERATION_ARCHITECTURE.md](../FEDERATION_ARCHITECTURE.md) - Architecture fédérée

### Étape 2 : Installer l'extension VS Code

```bash
# Dans le répertoire extension-rag
cd extension-rag
npm install
npm run compile

# Dans VS Code : F5 pour lancer en mode debug
# Ou package et installer l'extension
```

### Étape 3 : Configurer le serveur MCP

1. Ouvrez VS Code
2. Appuyez sur `Cmd+Shift+P` (Mac) ou `Ctrl+Shift+P` (Windows/Linux)
3. Tapez "RAG: Configure Server"
4. Entrez l'URL du serveur MCP (ex: `ws://localhost:3000`)
5. Configurez le timeout et autres options

### Étape 4 : Utiliser le Dashboard

1. Ouvrez le Dashboard : `Cmd+Shift+P` → "RAG: Open Dashboard"
2. Visualisez l'état global du système
3. Consultez la liste des projets
4. Utilisez le bouton refresh ou attendez l'auto-refresh (5s)

### Étape 5 : Configurer via ConfigView

1. Ouvrez ConfigView : `Cmd+Shift+P` → "RAG: Open Configuration"
2. Modifiez les paramètres du serveur
3. Sauvegardez la configuration
4. Testez la connexion

### Étape 6 : Surveiller via MonitorView

1. Ouvrez MonitorView : `Cmd+Shift+P` → "RAG: Open Monitor"
2. Visualisez la santé du serveur
3. Consultez les métriques de performance
4. Surveillez les erreurs en temps réel

### Étape 7 : Consulter les logs via LogView

1. Ouvrez LogView : `Cmd+Shift+P` → "RAG: Open Logs"
2. Filtrez les logs par type (info, warning, error)
3. Recherchez dans les logs
4. Exportez les logs si nécessaire

## 📝 Exemples concrets

### Exemple 1 : Migration d'un workflow d'initialisation

**Ancienne méthode (obsolète) :**

```bash
# Humain exécute directement
rag init /path/to/project --mode=full
```

**Nouvelle méthode (recommandée) :**

```typescript
// IA (Cline) exécute via MCP
const result = await mcpClient.call("init_rag", {
  project_path: "/path/to/project",
  mode: "full",
});

// Humain surveille via Dashboard
// 1. Ouvrir Dashboard
// 2. Vérifier que le projet apparaît
// 3. Vérifier le status "initialized"
```

### Exemple 2 : Migration d'un workflow d'activation

**Ancienne méthode (obsolète) :**

```bash
# Humain exécute directement
rag activate /path/to/project --mode=incremental
```

**Nouvelle méthode (recommandée) :**

```typescript
// IA (Cline) exécute via MCP
const result = await mcpClient.call("activated_rag", {
  project_path: "/path/to/project",
  mode: "incremental",
});

// Humain surveille via MonitorView
// 1. Ouvrir MonitorView
// 2. Vérifier la progression
// 3. Vérifier les stats finales
```

### Exemple 3 : Migration d'une requête

**Ancienne méthode (obsolète) :**

```bash
# Humain exécute directement
rag query "Comment implémenter l'authentification?" --top_k=10
```

**Nouvelle méthode (recommandée) :**

```typescript
// IA (Cline) exécute via MCP
const result = await mcpClient.call("query_rag", {
  query: "Comment implémenter l'authentification?",
  top_k: 10,
  project_path: "/path/to/project",
});

// Humain peut utiliser QueryView pour tester
// 1. Ouvrir QueryView
// 2. Entrer la requête
// 3. Vérifier les résultats
// 4. Cliquer pour ouvrir les fichiers
```

## 🔧 Configuration avancée

### Configuration du serveur MCP

```json
{
  "rag.mcp.server.url": "ws://localhost:3000",
  "rag.mcp.server.timeout": 30000,
  "rag.mcp.server.autoConnect": true,
  "rag.mcp.server.retryAttempts": 3,
  "rag.mcp.server.retryDelay": 1000
}
```

### Configuration du Dashboard

```json
{
  "rag.dashboard.autoRefresh": true,
  "rag.dashboard.refreshInterval": 5000,
  "rag.dashboard.showProjects": true,
  "rag.dashboard.showStatus": true,
  "rag.dashboard.showMetrics": true
}
```

### Configuration des logs

```json
{
  "rag.logs.maxEntries": 1000,
  "rag.logs.autoScroll": true,
  "rag.logs.showTimestamps": true,
  "rag.logs.filterLevel": "info"
}
```

## 🚨 Problèmes courants et solutions

### Problème 1 : "Je ne peux plus exécuter rag init"

**Solution :**

- Comprenez que c'est intentionnel : les humains ne doivent pas exécuter d'opérations RAG
- Utilisez l'IA (Cline) pour exécuter `init_rag` via MCP
- Surveillez le résultat via le Dashboard

### Problème 2 : "Le Dashboard ne se connecte pas"

**Solution :**

1. Vérifiez que le serveur MCP est en cours d'exécution
2. Vérifiez l'URL dans la configuration
3. Testez la connexion via ConfigView
4. Consultez les logs via LogView

### Problème 3 : "Je ne vois pas mes projets"

**Solution :**

1. Vérifiez que l'IA a exécuté `init_rag` pour le projet
2. Vérifiez que le projet est dans la liste des projets du Dashboard
3. Rafraîchissez manuellement le Dashboard
4. Consultez les logs du serveur MCP

### Problème 4 : "Les logs ne s'affichent pas"

**Solution :**

1. Vérifiez que le serveur MCP génère des logs
2. Vérifiez les filtres dans LogView
3. Augmentez le niveau de log si nécessaire
4. Vérifiez les permissions d'accès aux fichiers de log

## 📊 Tableau de correspondance des commandes

| Commande obsolète | Nouvelle approche IA    | Interface humaine                    |
| ----------------- | ----------------------- | ------------------------------------ |
| `rag init`        | `init_rag` via MCP      | Dashboard → Vérifier status          |
| `rag activate`    | `activated_rag` via MCP | MonitorView → Surveiller progression |
| `rag query`       | `query_rag` via MCP     | QueryView → Tester requêtes          |
| `rag status`      | `get_status` via MCP    | Dashboard → Visualiser état          |
| `rag config`      | Configuration MCP       | ConfigView → Configurer serveur      |
| `rag logs`        | Logs MCP                | LogView → Consulter logs             |

## 🔮 Bonnes pratiques

### Pour les développeurs (humains)

1. **Ne jamais exécuter d'opérations RAG directement**
   - Laissez l'IA gérer `init_rag`, `activated_rag`, `query_rag`
   - Utilisez l'extension VS Code pour surveiller

2. **Utilisez le Dashboard comme point d'entrée**
   - Ouvrez toujours le Dashboard en premier
   - Vérifiez l'état global avant toute action

3. **Configurez via ConfigView**
   - Ne modifiez pas les fichiers de configuration manuellement
   - Utilisez l'interface ConfigView pour toute configuration

4. **Surveillez via MonitorView**
   - Utilisez MonitorView pour suivre les opérations en cours
   - Consultez les métriques de performance

5. **Consultez les logs via LogView**
   - Utilisez LogView pour le débogage
   - Filtrez les logs par niveau et type

### Pour l'IA (Cline)

1. **Exécutez toutes les opérations RAG via MCP**
   - Utilisez `init_rag`, `activated_rag`, `query_rag`
   - Respectez l'ordre des commandes (init → activate → query)

2. **Récupérez le contexte via `get_status`**
   - Utilisez `get_status` pour comprendre l'état du système
   - Prenez des décisions basées sur le contexte

3. **Indexez les décisions via `index_decision`**
   - Indexez toutes les décisions importantes dans le RAG
   - Enrichissez le contexte sémantique

4. **Utilisez le contexte VS Code**
   - Récupérez le contexte VS Code via `store_vscode_context`
   - Enrichissez les requêtes avec le contexte du projet

## 📚 Ressources supplémentaires

### Documentation

- [ARCHITECTURE_IA_VS_HUMAN.md](../ARCHITECTURE_IA_VS_HUMAN.md) - Architecture détaillée
- [VSCODE_CONTEXT_API.md](./VSCODE_CONTEXT_API.md) - API contexte VS Code
- [FEDERATION_ARCHITECTURE.md](../FEDERATION_ARCHITECTURE.md) - Architecture fédérée
- [README.md](../README.md) - Documentation générale

### Code source

- `extension-rag/` - Extension VS Code
- `src/tools/rag/` - Outils MCP RAG
- `mcp-gateway/` - Gateway MCP

### Exemples

- `examples/` - Exemples d'utilisation
- `test-end-to-end/` - Tests end-to-end

## 🎉 Félicitations

Vous avez maintenant migré vers la nouvelle architecture de séparation IA vs Humain. Cette architecture offre :

1. **Clarté** : Rôles clairement définis
2. **Sécurité** : Séparation stricte des responsabilités
3. **Évolutivité** : Architecture modulaire et extensible
4. **Observabilité** : Surveillance complète via extension VS Code

Pour toute question ou problème, consultez la documentation ou ouvrez une issue sur le repository.

---

**Dernière mise à jour** : 30/01/2026
**Version du guide** : 1.0.0
**Responsable migration** : Conseil d'Architecture RAG MCP
