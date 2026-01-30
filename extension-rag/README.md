# RAG MCP Extension for VS Code

**Extension d'intégration VS Code pour surveillance humaine uniquement**

> ⚠️ **IMPORTANT : Cette extension est un bonus d'intégration pour usage humain uniquement.**
>
> **Les opérations RAG (init, activate, query) doivent être effectuées directement via les outils MCP par l'IA.**
>
> **Cette extension fournit uniquement une interface de surveillance et configuration pour les développeurs humains.**

## 🎯 Objectif

Cette extension VS Code fournit une interface de **surveillance et configuration** pour le serveur RAG MCP. Elle permet aux développeurs humains de :

- **Surveiller** l'état du serveur RAG MCP
- **Configurer** la connexion au serveur
- **Visualiser** les logs en temps réel
- **Observer** les métriques de performance

**Elle ne remplace pas les outils MCP pour les opérations RAG.**

## 🚫 Ce que cette extension NE FAIT PAS

- ❌ **N'exécute pas** les opérations RAG (init_rag, activated_rag, query_rag)
- ❌ **Ne remplace pas** les outils MCP pour l'IA
- ❌ **N'est pas** une interface d'exécution pour les pipelines RAG
- ❌ **Ne permet pas** d'indexer ou de rechercher via l'interface graphique

## ✅ Ce que cette extension FAIT

- ✅ **Dashboard** : Surveillance de l'état système RAG
- ✅ **Configuration** : Configuration serveur MCP (URL, timeout, options)
- ✅ **Monitoring** : Santé serveur et métriques de performance
- ✅ **Logs** : Visualisation des logs en temps réel avec filtres
- ✅ **Navigation** : Liens entre les différentes vues de surveillance

## 📊 Vues disponibles

### 1. **Dashboard** (`RAG MCP: Show Dashboard`)

Interface centrale avec :

- État de connexion au serveur RAG MCP
- Métriques système (projets initialisés, jobs actifs, etc.)
- Navigation vers les autres vues
- Auto-refresh toutes les 5 secondes

### 2. **Configuration** (`RAG MCP: Configure Server`)

Configuration du serveur MCP :

- URL du serveur (ex: `http://localhost:3000`)
- Timeout des requêtes
- Options de connexion (auto-connect, logging, retries)
- Test de connexion intégré

### 3. **Monitoring** (`RAG MCP: Show Monitor`)

Surveillance santé serveur :

- État des composants (RAG Queue, Vector Store, Embedding Provider)
- Métriques de performance (connexions actives, taux d'erreur, temps de réponse)
- Charts de performance (CPU, mémoire, réseau)

### 4. **Logs** (`RAG MCP: Show Logs`)

Visualisation logs temps réel :

- Filtrage par niveau (info, warn, error, debug)
- Recherche textuelle dans les logs
- Export des logs en JSON
- Nettoyage des logs

## ⚙️ Configuration

### Configuration VS Code

```json
{
  "rag-mcp.server.url": "http://localhost:3000",
  "rag-mcp.server.timeout": 30000,
  "rag-mcp.options.enableAutoConnect": true,
  "rag-mcp.options.enableLogging": true,
  "rag-mcp.options.maxRetries": 3,
  "rag-mcp.options.retryDelay": 1000
}
```

### Commandes disponibles

| Commande                    | Description                   | Usage                 |
| --------------------------- | ----------------------------- | --------------------- |
| `RAG MCP: Show Dashboard`   | Ouvre le dashboard principal  | Surveillance humaine  |
| `RAG MCP: Configure Server` | Configure le serveur MCP      | Configuration humaine |
| `RAG MCP: Show Monitor`     | Affiche le monitoring serveur | Surveillance humaine  |
| `RAG MCP: Show Logs`        | Affiche les logs temps réel   | Debug humain          |

## 🏗️ Architecture

### Séparation IA/Humain

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   IA (Cline)    │    │   Serveur MCP   │    │   Extension     │
│                 │    │   RAG MCP       │    │   VS Code       │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • init_rag      │◄──►│ • init_rag      │    │ • Dashboard     │
│ • activated_rag │    │ • activated_rag │    │ • Configuration │
│ • query_rag     │    │ • query_rag     │    │ • Monitoring    │
│ • get_status    │    │ • get_status    │◄──►│ • Logs          │
│ • get_context   │    │ • get_context   │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
       │                       │                       │
       └───────────────────────┴───────────────────────┘
                 Communication MCP (WebSocket)
```

### Points clés d'architecture

1. **IA ↔ Serveur MCP** : Toutes les opérations RAG passent par MCP
2. **Humain ↔ Extension** : Toutes les opérations de surveillance passent par l'extension
3. **Pas de chevauchement** : L'extension ne fait pas d'opérations RAG
4. **Lecture seule** : L'extension est principalement en lecture (sauf configuration)

## 🚀 Développement

### Prérequis

- Node.js 18+
- VS Code 1.96+
- Serveur RAG MCP en cours d'exécution

### Installation développement

```bash
cd extension-rag
npm install
npm run compile
```

### Debug

1. Ouvrir le dossier `extension-rag` dans VS Code
2. Appuyer sur **F5** pour démarrer le debug
3. Utiliser la configuration "Run Extension"

### Structure du code

```
extension-rag/
├── src/
│   ├── extension.ts          # Point d'entrée principal
│   ├── services/
│   │   ├── McpClient.ts      # Client MCP WebSocket
│   │   ├── ContextService.ts # Service contexte VS Code
│   │   └── error-handler.ts  # Gestion erreurs
│   ├── views/
│   │   ├── DashboardView.ts  # Vue dashboard
│   │   ├── ConfigView.ts     # Vue configuration
│   │   ├── MonitorView.ts    # Vue monitoring
│   │   └── LogView.ts        # Vue logs
│   └── models/
│       └── json-schemas.ts   # Schémas JSON validation
├── package.json              # Manifest extension
└── tsconfig.json            # Configuration TypeScript
```

## 📋 Tests

### Tests unitaires

```bash
npm test
```

### Tests d'intégration

1. Démarrer le serveur RAG MCP
2. Démarrer l'extension en mode debug
3. Tester chaque vue manuellement

## 🔄 Workflow recommandé

### Pour les développeurs humains

1. **Configuration** : Configurer le serveur via `RAG MCP: Configure Server`
2. **Surveillance** : Ouvrir le dashboard via `RAG MCP: Show Dashboard`
3. **Debug** : Consulter les logs via `RAG MCP: Show Logs` en cas de problème
4. **Performance** : Surveiller les métriques via `RAG MCP: Show Monitor`

### Pour l'IA (Cline)

1. **Opérations RAG** : Utiliser directement les outils MCP (`init_rag`, `activated_rag`, `query_rag`)
2. **Statut** : Utiliser `get_status` pour vérifier l'état
3. **Contexte** : Utiliser `get_context` pour récupérer le contexte sémantique

## 🚨 Dépannage

### Problèmes courants

| Problème                   | Solution                                |
| -------------------------- | --------------------------------------- |
| "Cannot connect to server" | Vérifier l'URL dans la configuration    |
| "Timeout exceeded"         | Augmenter le timeout dans les options   |
| "No logs available"        | Vérifier que le serveur génère des logs |
| "Dashboard not updating"   | Vérifier l'auto-refresh est activé      |

### Logs de debug

Activez le logging détaillé dans la configuration :

```json
{
  "rag-mcp.options.enableLogging": true
}
```

## 📄 Licence

MIT

## 🔗 Liens

- [RAG MCP Server](https://github.com/ali-48/rag-mcp-server) - Serveur RAG MCP principal
- [MCP Documentation](https://spec.modelcontextprotocol.io/) - Documentation MCP officielle
- [VS Code Extension API](https://code.visualstudio.com/api) - Documentation API extension VS Code

---

**Note importante** : Cette extension est conçue comme un outil de **surveillance humaine**. Pour toute opération RAG, utilisez les outils MCP directement via l'IA. L'extension ne doit pas être utilisée pour exécuter des pipelines RAG.
