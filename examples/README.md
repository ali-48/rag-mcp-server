# Exemples d'utilisation du pipeline RAG asynchrone

Ce dossier contient des exemples d'utilisation du nouveau pipeline RAG asynchrone (v2.1).

## 📋 Fichiers disponibles

| Fichier | Description | Type |
|---------|-------------|------|
| [`async-pipeline-basic.ts`](./async-pipeline-basic.ts) | Exemple basique TypeScript avec workflow complet | TypeScript |
| [`async-pipeline-advanced.ts`](./async-pipeline-advanced.ts) | Exemple avancé avec gestion d'erreurs et annulation | TypeScript |
| [`async-pipeline-cli.js`](./async-pipeline-cli.js) | Script CLI exécutable avec barre de progression | JavaScript |
| [`mcp-config-v3.json`](./mcp-config-v3.json) | Configuration MCP pour le pipeline asynchrone | JSON |

## 🚀 Utilisation rapide

### Exemple CLI (le plus simple)

```bash
# Rendre le script exécutable
chmod +x examples/async-pipeline-cli.js

# Exécuter sur le répertoire courant
node examples/async-pipeline-cli.js .

# Exécuter sur un projet spécifique
node examples/async-pipeline-cli.js /chemin/vers/mon/projet

# Afficher l'aide
node examples/async-pipeline-cli.js --help
```

### Exemple TypeScript

```typescript
// Compiler d'abord le projet
npm run build

// Exécuter l'exemple basique
npx tsx examples/async-pipeline-basic.ts

// Exécuter l'exemple avancé
npx tsx examples/async-pipeline-advanced.ts
```

## 📖 Description des exemples

### 1. Exemple basique (`async-pipeline-basic.ts`)

**Fonctionnalités démontrées :**

- Initialisation automatique du projet
- Indexation asynchrone avec `index_rag`
- Suivi de progression avec `get_task_status`
- Recherche sémantique avec `recherche_rag`

**Workflow :**

```typescript
1. Vérifier si le projet est initialisé
2. Initialiser si nécessaire avec `init_rag`
3. Démarrer l'indexation avec `index_rag` → obtient un `task_id`
4. Suivre la progression avec `get_task_status`
5. Effectuer une recherche avec `recherche_rag`
```

### 2. Exemple avancé (`async-pipeline-advanced.ts`)

**Fonctionnalités démontrées :**

- Gestion d'erreurs avec `ErrorHandler`
- Annulation de tâches avec `cancel_task`
- Utilisation de `ProgressCLI` pour l'affichage
- Gestion des checkpoints
- Tests de performance

**Cas d'utilisation :**

- Workflow avec timeout et annulation
- Simulation de crash et reprise
- Mesure des performances

### 3. Script CLI (`async-pipeline-cli.js`)

**Fonctionnalités démontrées :**

- Interface en ligne de commande
- Barre de progression en temps réel
- Gestion des arguments
- Affichage des statistiques

**Avantages :**

- Exécutable directement avec Node.js
- Pas besoin de compilation
- Interface utilisateur conviviale

## 🔧 Prérequis

### Pour les exemples TypeScript

1. **Compilation du projet :**

   ```bash
   npm run build
   ```

2. **Dépendances :**

   ```bash
   npm install
   ```

3. **Ollama (optionnel) :**

   ```bash
   # Pour les embeddings réels
   ollama pull nomic-embed-text
   ollama serve
   ```

### Pour le script CLI

1. **Node.js 16+ requis**
2. **Projet compilé :** Le script utilise les fichiers compilés dans `build/`

## 🧪 Tests

### Tester avec un projet fictif

```bash
# Créer un projet de test
mkdir -p /tmp/test-rag-project
echo "// Test file" > /tmp/test-rag-project/test.js
echo "# Documentation" > /tmp/test-rag-project/README.md

# Exécuter le CLI sur le projet de test
node examples/async-pipeline-cli.js /tmp/test-rag-project
```

### Tester avec le mode "memory-only"

Modifiez les exemples pour utiliser `mode: 'memory-only'` :

```typescript
const initResult = await toolRegistry.execute('init_rag', {
  project_path: projectPath,
  mode: 'memory-only', // Plus rapide, pas de base de données
  verbose: true
});
```

## 📊 Structure des réponses

### Réponse de `index_rag`

```json
{
  "success": true,
  "task_id": "rag-1736845200-x91",
  "status": {
    "state": "queued",
    "step": "initialization",
    "progress": 0,
    "eta": "calculating..."
  }
}
```

### Réponse de `get_task_status`

```json
{
  "task_id": "rag-1736845200-x91",
  "state": "running",
  "step": "embedding",
  "progress": 63,
  "eta": "2m 30s",
  "stats": {
    "files_processed": 42,
    "chunks_created": 156,
    "elapsed_time": 120,
    "files_per_second": 0.35
  },
  "error": null
}
```

## 🚨 Dépannage

### Problème : "Module not found"

**Solution :** Compilez d'abord le projet :

```bash
npm run build
```

### Problème : "Task not found"

**Solution :** Vérifiez que le `task_id` est correct et que la tâche n'a pas expiré.

### Problème : "Embedding failed"

**Solution :** Vérifiez qu'Ollama est en cours d'exécution :

```bash
ollama serve
```

### Problème : "Project not initialized"

**Solution :** Exécutez `init_rag` d'abord ou utilisez l'initialisation automatique.

## 🔗 Liens utiles

- [Guide des nouveaux outils V2](../GUIDE-NOUVEAUX-OUTILS-V2.md) - Documentation complète
- [Règles d'architecture RAG](../RAG_ARCHITECTURE_RULES.md) - Règles architecturales
- [Règles d'exécution RAG](../RAG_EXECUTION_RULES.md) - Règles d'exécution

## 📝 Notes importantes

1. **Asynchrone uniquement :** Le nouveau pipeline est entièrement asynchrone
2. **Pas de timeout :** Les tâches n'ont pas de timeout automatique
3. **Gestion manuelle :** C'est à l'utilisateur de gérer les annulations et timeouts
4. **Persistance :** Les tâches sont en mémoire uniquement (pas de persistance DB)

## 🎯 Bonnes pratiques

1. **Toujours vérifier `task_id` :** Vérifiez que `index_rag` retourne bien un `task_id`
2. **Gérer les erreurs :** Utilisez `try/catch` et vérifiez `status.state === 'failed'`
3. **Nettoyer les tâches :** Annulez les tâches inutiles avec `cancel_task`
4. **Monitorer la progression :** Utilisez `get_task_status` régulièrement mais pas trop fréquemment (1-2 secondes)
5. **Tester avec de petits projets :** Commencez avec quelques fichiers avant de passer à de gros projets

## 🤝 Contribution

Pour ajouter un nouvel exemple :

1. Créez un fichier dans le dossier `examples/`
2. Suivez le format des exemples existants
3. Documentez l'exemple dans ce README
4. Testez avec `npm run build && node examples/votre-exemple.js`

---

**Dernière mise à jour :** 14/01/2026  
**Version :** v2.1.0  
**Statut :** Production Ready 🚀
