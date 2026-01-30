# 📋 Intégration Task Manager → RAG : Outil `index_decision`

## 🎯 Objectif

Indexer automatiquement les décisions du Task Manager dans le RAG pour :

- **Recherche sémantique** des décisions passées
- **Analyse des patterns** de décision
- **Apprentissage automatique** des meilleures pratiques
- **Audit et traçabilité** des décisions

## 🛠️ Outil MCP : `index_decision`

### Définition

```typescript
{
  name: "index_decision",
  description: "Indexe une décision de Task Manager dans le RAG pour recherche sémantique future"
}
```

### Paramètres d'entrée

| Paramètre        | Type   | Requis | Description                                                                              |
| ---------------- | ------ | ------ | ---------------------------------------------------------------------------------------- |
| `task_id`        | string | ✅     | ID de la tâche concernée                                                                 |
| `decision_type`  | enum   | ❌     | Type de décision (`created`, `completed`, `failed`, `cancelled`, `approved`, `rejected`) |
| `decision_by`    | enum   | ❌     | Qui a pris la décision (`task_manager`, `user`, `ai`, `system`)                          |
| `title`          | string | ❌     | Titre de la tâche                                                                        |
| `description`    | string | ❌     | Description de la tâche                                                                  |
| `result`         | object | ❌     | Résultat de la tâche                                                                     |
| `error`          | string | ❌     | Erreur si échec                                                                          |
| `metadata`       | object | ❌     | Métadonnées supplémentaires                                                              |
| `duration_ms`    | number | ❌     | Durée d'exécution                                                                        |
| `project_path`   | string | ❌     | Chemin du projet                                                                         |
| `workspace`      | string | ❌     | Workspace VS Code                                                                        |
| `git_branch`     | string | ❌     | Branche Git                                                                              |
| `git_commit`     | string | ❌     | Commit Git                                                                               |
| `vscode_context` | object | ❌     | Contexte VS Code                                                                         |

### Format de sortie

```json
{
  "success": true,
  "decision": {
    "task_id": "task-123",
    "decision_type": "completed",
    "decision_by": "task_manager",
    "decision_timestamp": "2026-01-30T20:41:00.000Z"
  },
  "indexing_result": {
    "decision_id": "decision-task-123-1738262460000",
    "chunks_created": 1,
    "indexed_at": "2026-01-30T20:41:00.000Z"
  },
  "timestamp": "2026-01-30T20:41:00.000Z",
  "duration_ms": 150,
  "notes_for_ai": [
    "Décision indexée dans le RAG",
    "ID de tâche: task-123",
    "Type de décision: completed",
    "Prise par: task_manager",
    "Chunks créés: 1",
    "La décision est maintenant disponible pour recherche sémantique"
  ]
}
```

## 🔗 Intégration avec Task Manager

### 1. Après chaque décision de tâche

```typescript
// Exemple dans task-events.ts
import { indexDecisionHandler } from "../tools/rag/index-decision-simple.js";

async function onTaskCompleted(taskId: string, result: any) {
  // Appeler l'outil index_decision
  const response = await indexDecisionHandler({
    task_id: taskId,
    decision_type: "completed",
    decision_by: "task_manager",
    result: result,
    duration_ms: calculateDuration(taskId),
  });

  logger.info("decision.indexed", "Décision indexée dans le RAG", {
    taskId,
    success: response.success,
  });
}
```

### 2. Points d'intégration recommandés

- **Tâche créée** → `decision_type: "created"`
- **Tâche terminée** → `decision_type: "completed"`
- **Tâche échouée** → `decision_type: "failed"`
- **Tâche annulée** → `decision_type: "cancelled"`
- **Tâche approuvée** → `decision_type: "approved"`
- **Tâche rejetée** → `decision_type: "rejected"`

## 🔍 Recherche sémantique des décisions

### 1. Recherche simple

```typescript
import { semanticSearch } from "../rag/vector-store.js";

async function searchTaskDecisions(query: string) {
  const results = await semanticSearch(query, {
    limit: 10,
    contentTypeFilter: "decision",
    roleFilter: "task_decision",
  });

  return results.map((result) => ({
    task_id: result.metadata?.task_id,
    decision_type: result.metadata?.decision_type,
    content: result.content,
    score: result.score,
  }));
}
```

### 2. Exemples de requêtes

- "tâches qui ont échoué avec erreur de connexion"
- "décisions prises par l'IA cette semaine"
- "tâches de refactoring réussies"
- "erreurs fréquentes dans les tests unitaires"

## 📊 Statistiques et analyse

### Métriques disponibles

- **Total des décisions indexées**
- **Répartition par type de décision**
- **Taux de réussite/échec**
- **Temps moyen d'exécution**
- **Patterns récurrents**

### Dashboard d'analyse

```typescript
// Exemple de dashboard
const stats = {
  total_decisions: 150,
  by_type: {
    completed: 120,
    failed: 15,
    cancelled: 10,
    approved: 5,
  },
  success_rate: "80%",
  avg_duration_ms: 2450,
};
```

## 🧪 Tests et validation

### Test unitaire

```bash
# Exécuter le test d'indexation
node test-index-decision.js
```

### Validation manuelle

1. Indexer une décision de test
2. Vérifier dans le vector store
3. Tester la recherche sémantique
4. Valider les métadonnées

## 🚀 Déploiement

### 1. Configuration

```json
// config/rag-config.json
{
  "vector_store": {
    "type": "sqlite",
    "sqlite": {
      "file": "./rag/db/decisions.sqlite"
    }
  },
  "indexing": {
    "enable_task_decisions": true,
    "auto_index_on_completion": true
  }
}
```

### 2. Activation

```bash
# Compiler l'outil
npm run build

# Tester l'intégration
npm run test:task-decisions
```

### 3. Monitoring

- **Logs** : `logs/decision-indexing.log`
- **Métriques** : `stats/decision-metrics.json`
- **Alertes** : Erreurs d'indexation > 5%

## 📈 Avantages

### Pour les développeurs

- **Historique consultable** des décisions
- **Recherche intelligente** par similarité sémantique
- **Apprentissage** des patterns de succès/échec

### Pour le système

- **Amélioration continue** des décisions IA
- **Détection précoce** des problèmes récurrents
- **Optimisation** des workflows

### Pour le projet

- **Documentation automatique** des décisions
- **Traçabilité complète** du développement
- **Capitalisation** de la connaissance

## 🔧 Dépannage

### Problèmes courants

1. **Erreur de connexion au vector store**
   - Vérifier la configuration SQLite
   - Tester la connexion : `npm run test:vector-store`

2. **Décisions non indexées**
   - Vérifier les logs d'erreur
   - Tester manuellement l'outil

3. **Recherche sans résultats**
   - Vérifier les filtres de contenu
   - Tester avec une requête simple

### Support

- **Documentation** : `docs/INDEX_DECISION_TASK_MANAGER.md`
- **Logs** : `logs/decision-indexing-*.log`
- **Tests** : `test/unit/decision-indexer.test.ts`

## 🔮 Roadmap

### Phase 1 (Maintenant)

- ✅ Indexation basique des décisions
- ✅ Recherche sémantique simple
- ✅ Intégration avec Task Manager

### Phase 2 (Prochaine)

- 🔄 Analyse des patterns de décision
- 🔄 Recommandations intelligentes
- 🔄 Dashboard d'analytics

### Phase 3 (Future)

- 🔄 Apprentissage automatique des décisions
- 🔄 Prédiction des risques
- 🔄 Optimisation automatique

---

## 📝 Notes techniques

### Architecture

```
Task Manager → Événements → index_decision → Vector Store RAG
      ↓                           ↓               ↓
  Décisions                  Indexation      Recherche sémantique
```

### Performance

- **Latence d'indexation** : < 500ms
- **Capacité** : 10K+ décisions
- **Recherche** : < 100ms

### Sécurité

- **Authentification** : Via MCP
- **Autorisations** : Lecture seule pour les recherches
- **Audit** : Logs complets des opérations

---

**Dernière mise à jour** : 30/01/2026
**Version** : v1.0.0
**Statut** : ✅ Production Ready
