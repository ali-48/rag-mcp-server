# Phase 0.1 - Nouveaux Outils d'Observation

## 🎯 Objectif

La Phase 0.1 introduit une couche d'observation avancée pour le RAG MCP Server, permettant une détection automatique du workspace, une surveillance temps réel des fichiers et une journalisation structurée des événements.

## 📦 Composants

### 1. Workspace Detector (`workspace-detector.ts`)

**Fonctionnalités :**

- Détection automatique du workspace VS Code
- Support des variables d'environnement (`RAG_WORKSPACE`, `VSCODE_WORKSPACE`)
- Fallback au répertoire courant
- Détection du langage principal (JavaScript, TypeScript, Python, etc.)
- Collecte de métadonnées (nombre de fichiers, types, dépôt Git)

**Priorité de détection :**

1. Chemin manuel fourni
2. Workspace VS Code (variable d'environnement ou fichier `.vscode/`)
3. Variable d'environnement `RAG_WORKSPACE`
4. Répertoire courant

### 2. File Watcher (`file-watcher.ts`)

**Fonctionnalités :**

- Surveillance temps réel avec chokidar
- Debouncing intelligent (évite les événements multiples)
- Filtrage des fichiers ignorés (node_modules, .git, fichiers cachés)
- Gestion des événements en attente
- Statistiques détaillées

**Options configurables :**

- `debounceDelay` : Délai avant traitement (défaut: 1000ms)
- `recursive` : Surveillance récursive (défaut: true)
- `ignoreHidden` : Ignorer les fichiers cachés (défaut: true)
- `ignoreNodeModules` : Ignorer node_modules (défaut: true)
- `logEvents` : Journaliser les événements (défaut: false)

### 3. Event Logger (`event-logger.ts`)

**Fonctionnalités :**

- Journalisation structurée avec niveaux (debug, info, warn, error, critical)
- Stockage en mémoire avec limite configurable
- Sortie console avec couleurs
- Export JSON/CSV
- Statistiques en temps réel

**Niveaux de log :**

- `debug` : Informations de débogage
- `info` : Informations générales
- `warn` : Avertissements
- `error` : Erreurs
- `critical` : Erreurs critiques

### 4. Phase 0 Integration (`phase0-integration.ts`)

**Fonctionnalités :**

- Orchestration des 3 composants
- Initialisation automatique
- Gestion du cycle de vie
- Callback pour l'indexation automatique
- État et statistiques centralisés

## 🔧 Intégration avec injection-rag

La Phase 0.1 est intégrée à l'outil `injection_rag` via deux nouveaux paramètres :

```javascript
{
  "enable_phase0": true,           // Activer la Phase 0.1
  "enable_watcher": true           // Activer le file watcher
}
```

### Workflow d'intégration

1. **Détection du workspace** : Analyse automatique du projet
2. **Initialisation du logger** : Configuration de la journalisation
3. **Démarrage du file watcher** : Surveillance temps réel
4. **Indexation RAG** : Processus principal d'indexation
5. **Arrêt propre** : Fermeture des composants Phase 0.1

## 📊 Statistiques et Monitoring

Chaque composant fournit des statistiques détaillées :

### Workspace Detector

- Temps de détection
- Langage détecté
- Nombre de fichiers
- Présence Git

### File Watcher

- Événements totaux
- Événements traités/ignorés
- Événements en attente
- Temps d'activité

### Event Logger

- Logs par niveau
- Taille du stockage
- Dernier log

## 🧪 Tests

Un script de test complet est disponible :

```bash
node test-phase0-integration.js
```

**Tests effectués :**

1. ✅ Détection de workspace
2. ✅ Journalisation structurée
3. ✅ Surveillance de fichiers
4. ✅ Intégration complète
5. ✅ Simulation avec injection-rag

## 🚀 Utilisation

### Intégration manuelle

```typescript
import { createPhase0Integration } from './src/rag/phase0/phase0-integration.js';

// Créer l'intégration
const integration = await createPhase0Integration({
  enableWorkspaceDetection: true,
  enableFileWatcher: true,
  enableLogging: true,
  fileWatcherOptions: {
    debounceDelay: 2000,
    recursive: true,
    logEvents: true,
  },
}, '/chemin/du/projet');

// Obtenir l'état
const state = integration.getState();
console.log('Workspace:', state.workspace?.path);

// Arrêter proprement
await integration.stop();
```

### Via injection-rag

```bash
# Activer la Phase 0.1
curl -X POST http://localhost:3000/tools/injection_rag \
  -H "Content-Type: application/json" \
  -d '{
    "project_path": "/chemin/du/projet",
    "enable_phase0": true,
    "enable_watcher": true,
    "enable_graph_integration": false
  }'
```

## 🔍 Dépannage

### Problèmes courants

1. **Workspace non détecté**
   - Vérifier les permissions du répertoire
   - Vérifier la présence de `.vscode/` pour VS Code
   - Utiliser `manualPath` pour forcer un chemin

2. **File watcher ne détecte pas les changements**
   - Augmenter `debounceDelay`
   - Vérifier les patterns ignorés
   - Tester avec `logEvents: true`

3. **Erreurs de journalisation**
   - Vérifier les permissions d'écriture
   - Réduire `maxMemoryEntries` si mémoire insuffisante

## 📈 Avantages

### Pour les développeurs

- **Automatisation** : Plus besoin de configurer manuellement le workspace
- **Observabilité** : Logs structurés pour le débogage
- **Réactivité** : Indexation automatique sur modification

### Pour le système RAG

- **Contexte enrichi** : Métadonnées du workspace
- **Indexation incrémentale** : Seuls les fichiers modifiés sont ré-indexés
- **Monitoring** : Statistiques pour l'optimisation

## 🔮 Roadmap

### Phase 0.2 (Planifiée)

- Intégration avec le graphe de connaissances
- Détection des dépendances
- Analyse des patterns de code
- Suggestions d'optimisation

### Phase 0.3 (Planifiée)

- API REST pour le monitoring
- Dashboard web
- Alertes intelligentes
- Export avancé des données

## 📝 Notes de version

### v1.0.0 (Initiale)

- ✅ Workspace detector avec détection VS Code
- ✅ File watcher avec chokidar
- ✅ Event logger structuré
- ✅ Intégration complète Phase 0.1
- ✅ Tests unitaires complets
- ✅ Documentation technique

## 🤝 Contribution

Les contributions sont les bienvenues ! Voir [CONTRIBUTING.md](../CONTRIBUTING.md) pour les guidelines.

## 📄 Licence

MIT License - Voir [LICENSE](../LICENSE) pour plus de détails.
