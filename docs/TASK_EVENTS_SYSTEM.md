# 📋 Système d'Événements de Tâches - Task Manager MCP

## 🎯 Objectif

Le système d'événements de tâches permet d'émettre et d'écouter des événements quand des tâches sont créées ou terminées dans le Task Manager MCP. Ce système permet :

1. **Observabilité en temps réel** des tâches RAG
2. **Intégration avec d'autres systèmes** via MCP Gateway
3. **Historique des événements** pour audit et debugging
4. **Abonnement sélectif** par type d'événement et projet

## 🏗️ Architecture

```
┌─────────────────┐    Événements    ┌──────────────────┐
│   TaskQueue     │ ───────────────► │ TaskEventEmitter │
│   (existant)    │                  │   (nouveau)      │
└─────────────────┘                  └──────────────────┘
         │                                    │
         ▼                                    ▼
┌─────────────────┐                  ┌──────────────────┐
│TaskQueueWrapper │                  │ Outils MCP       │
│   (wrapper)     │                  │ - subscribe      │
└─────────────────┘                  │ - get_events     │
                                     │ - unsubscribe    │
                                     └──────────────────┘
```

## 📦 Composants

### 1. TaskEventEmitter (`src/core/task-event-emitter.ts`)

Classe principale pour émettre des événements de tâches.

**Types d'événements :**

- `task_created` : Tâche créée dans la file d'attente
- `task_started` : Tâche commencée à s'exécuter
- `task_completed` : Tâche terminée avec succès
- `task_failed` : Tâche échouée avec erreur
- `task_cancelled` : Tâche annulée par l'utilisateur
- `task_progress` : Progression de la tâche (%)

**Utilisation :**

```typescript
import { getTaskEventEmitter } from "./task-event-emitter.js";

const emitter = getTaskEventEmitter();

// Émettre un événement
await emitter.emitTaskCreated("task-123", "/project/path", {
  priority: 1,
  metadata: { type: "indexing" },
});

// Écouter des événements
emitter.on("task_completed", (event) => {
  console.log("Tâche terminée:", event.task_id);
});
```

### 2. TaskQueueWrapper (`src/core/task-queue-wrapper.ts`)

Wrapper qui étend le TaskQueue existant avec émission d'événements.

**Fonctionnalités :**

- Émet automatiquement des événements aux moments clés
- Proxy pour toutes les méthodes du TaskQueue original
- Création de tâches avec événements intégrés

**Utilisation :**

```typescript
import { getTaskQueueWrapper } from "./task-queue-wrapper.js";

const wrapper = getTaskQueueWrapper();

// Ajouter une tâche avec événements
await wrapper.enqueue(
  "task-123",
  "/project/path",
  async () => {
    /* tâche */
  },
  1, // priorité
  { type: "indexing" },
);

// Créer une tâche d'indexation avec événements
const task = wrapper.createIndexTaskWithEvents(
  "task-456",
  "/project/path",
  async () => {
    /* indexation */
  },
);
```

### 3. Outils MCP (`src/tools/rag/task-events.ts`)

Trois nouveaux outils MCP pour gérer les abonnements aux événements.

#### a) `subscribe_task_events`

S'abonne aux événements de tâches.

**Paramètres :**

- `event_types` : Types d'événements à écouter (optionnel, défaut: création/complétion/échec)
- `project_path` : Chemin du projet (optionnel, tous les projets si vide)
- `auto_cleanup_hours` : Heures avant nettoyage automatique (défaut: 24)

**Exemple :**

```json
{
  "event_types": ["task_created", "task_completed"],
  "project_path": "/my/project",
  "auto_cleanup_hours": 48
}
```

#### b) `get_task_events`

Récupère les événements pour un abonnement.

**Paramètres :**

- `subscription_id` : ID de l'abonnement (obligatoire)
- `limit` : Nombre maximum d'événements (défaut: 50)
- `include_stats` : Inclure les statistiques (défaut: true)

#### c) `unsubscribe_task_events`

Se désabonne des événements.

**Paramètres :**

- `subscription_id` : ID de l'abonnement à supprimer (obligatoire)

## 🔧 Intégration avec le Task Manager existant

### Fichiers modifiés

1. **`src/core/task-queue.ts`** : Ajout de l'import de TaskEventEmitter (commenté pour éviter les conflits de formateur)
2. **`src/tools/rag/index-rag.ts`** : Les outils existants peuvent maintenant écouter les événements

### Compatibilité

- ✅ Rétrocompatible avec les outils existants (`cancel_task`, `list_tasks`)
- ✅ Les événements sont émis sans affecter le comportement existant
- ✅ Les abonnements sont stockés en mémoire (peut être étendu à SQLite)

## 🧪 Tests

Chaque composant inclut des tests unitaires :

```bash
# Tester TaskEventEmitter
node -r ts-node/register src/core/task-event-emitter.ts

# Tester TaskQueueWrapper
node -r ts-node/register src/core/task-queue-wrapper.ts

# Tester les outils MCP
node -r ts-node/register src/tools/rag/task-events.ts
```

## 📊 Format des événements

```typescript
interface TaskEvent {
  event_id: string; // ID unique de l'événement
  event_type: TaskEventType; // Type d'événement
  task_id: string; // ID de la tâche
  project_path: string; // Chemin du projet
  timestamp: string; // ISO timestamp
  metadata: {
    source: "task_manager";
    version: "1.0.0";
    [key: string]: any;
  };
  payload: {
    task_status?: Partial<ProgressStatus>; // Statut de la tâche
    queue_position?: number; // Position dans la file
    queue_size?: number; // Taille de la file
    error?: string; // Erreur (si échec)
    progress?: number; // Progression (0-1)
    [key: string]: any;
  };
}
```

## 🔄 Cycle de vie d'une tâche

```
1. Création → task_created
   ↓
2. Mise en file d'attente → task_created (avec position)
   ↓
3. Début d'exécution → task_started
   ↓
4. Progression → task_progress (optionnel)
   ↓
5. Terminaison → task_completed (succès) OU task_failed (échec)
   ↓
6. Annulation → task_cancelled (si annulée)
```

## 🚀 Utilisation avancée

### Intégration avec MCP Gateway

```typescript
const emitter = getTaskEventEmitter({
  enableGatewayRouting: true,
  gatewayUrl: "http://localhost:3000",
});

// Les événements seront automatiquement routés via le Gateway
```

### Écouteurs personnalisés

```typescript
const emitter = getTaskEventEmitter();

// Ajouter un écouteur pour tous les événements de complétion
emitter.on("task_completed", async (event) => {
  // Envoyer une notification
  await sendNotification(`Tâche ${event.task_id} terminée`);

  // Mettre à jour un dashboard
  await updateDashboard(event);
});

// Limiter le nombre d'écouteurs
emitter.configure({ maxListeners: 20 });
```

### Historique des événements

```typescript
// Les événements sont conservés pendant 24 heures par défaut
// Chaque abonnement garde jusqu'à 100 événements
// Nettoyage automatique des abonnements inactifs
```

## 📈 Métriques et surveillance

Le système fournit des métriques via :

1. **Statistiques d'abonnement** : Nombre d'événements par type/projet
2. **Logs structurés** : Tous les événements sont loggés
3. **Historique consultable** : Via `get_task_events`

## 🔒 Sécurité et limites

- **Limite d'écouteurs** : 10 par défaut (configurable)
- **Historique limité** : 100 événements par abonnement
- **Nettoyage automatique** : 24 heures d'inactivité
- **Isolation par projet** : Filtrage optionnel par projet

## 🐛 Dépannage

### Problèmes courants

1. **Événements non reçus** :
   - Vérifier que l'abonnement est actif
   - Vérifier les types d'événements souscrits
   - Vérifier le chemin du projet (si filtré)

2. **Performance** :
   - Limiter le nombre d'écouteurs
   - Utiliser le filtrage par projet
   - Désactiver les logs d'événements si nécessaire

3. **Mémoire** :
   - Les abonnements inactifs sont nettoyés automatiquement
   - L'historique est limité à 100 événements par abonnement

## 🔮 Évolutions futures

1. **Stockage persistant** : SQLite pour l'historique des événements
2. **Webhooks** : Notifications HTTP pour les événements
3. **Filtres avancés** : Par priorité, type de tâche, etc.
4. **Dashboard temps réel** : Interface web pour surveiller les événements

---

**Version :** 1.0.0
**Date :** 30/01/2026
**Auteur :** Cline (Assistant IA)
**Statut :** ✅ Production Ready
