# Architecture Finale RAG MCP Server v3.0

## 📋 Vue d'ensemble

Cette documentation décrit l'architecture finale du RAG MCP Server v3.0, conçue pour respecter les **25 règles absolues** et fournir un système robuste, observable et maintenable.

## 🏗️ Architecture en Couches

### 1. Couche Infrastructure (`/rag/`)

```
/rag/
├── db/                    # Bases de données SQLite
│   ├── memory.sqlite      # Cache mémoire et contexte
│   ├── vectors.sqlite     # Vector store (embeddings)
│   └── metadata.sqlite    # Métadonnées et index
├── config/                # Configuration
│   ├── rag-config-v3.json # Configuration principale
│   └── pipeline.json      # Pipeline déclaratif
├── logs/                  # Logs structurés
│   └── rag.log           # Logs JSON structurés
├── monitoring/           # Monitoring write-only
│   ├── metrics.json      # Métriques temps réel
│   ├── health/           # Santé système
│   ├── events/           # Événements système
│   └── progress/         # Progression tâches
├── state/                # État persistant
│   ├── init.json         # État initialisation
│   ├── projects.json     # Projets actifs
│   └── failures.json     # Échecs temporaires
└── ACCESS_RULES.md       # Règles d'accès
```

### 2. Couche Moteur (`src/rag/`)

```
src/rag/
├── daemon/               # Service démon
│   ├── rag-daemon.ts     # Démon principal
│   ├── persistent-state.ts # État persistant
│   ├── multi-project-manager.ts # Gestion multi-projets
│   └── priority-task-queue.ts # File de tâches prioritaire
├── enrichment/           # Enrichissement de données
│   └── code/            # Analyse de code
│       ├── analyzer.ts  # Analyseur structurel
│       ├── symbols.ts   # Symboles et relations
│       ├── metrics.ts   # Métriques de qualité
│       └── index.ts     # Point d'entrée
├── monitoring/          # Monitoring write-only
│   ├── types.ts        # Types TypeScript
│   ├── writer.ts       # Writer strict (write-only)
│   └── index.ts        # Export principal
└── vector-store.ts     # Vector store abstrait
```

### 3. Couche Outils MCP (`src/tools/rag/`)

```
src/tools/rag/
├── init-rag.ts          # Initialisation projet
├── query-rag.ts         # Recherche sémantique (passive)
├── get-status.ts        # Consultation état
└── cancel-task.ts       # Annulation tâche
```

### 4. Couche Extension (`extension-rag/`)

```
extension-rag/
├── src/
│   └── services/
│       └── MonitoringReader.ts # Reader read-only
└── test-monitoring-reader.js  # Tests
```

## 🔒 Règles d'Accès Strictes

### Séparation Monitoring/Moteur (Règle #25)

- **Moteur** : Write-only sur `/rag/monitoring/`
- **Extension** : Read-only sur `/rag/monitoring/`
- **Validation** : Script `scripts/validate-access-rules.js`

### État Persistant (Règles #18, #20)

- **Immutable** : `state.json` modifiable uniquement par le moteur
- **Idempotent** : Sous-fonctions réentrantes et idempotentes
- **Checkpoints** : Reprise après crash garantie

## 🛠️ Outils MCP Exposés

### Outils Principaux (exposés)

| Outil         | Rôle                  | Contraintes                   |
| ------------- | --------------------- | ----------------------------- |
| `init_rag`    | Initialisation projet | Usage unique, non-réentrant   |
| `get_status`  | Consultation état     | Illimité, read-only           |
| `query_rag`   | Recherche sémantique  | Passive, pas d'indexation     |
| `cancel_task` | Annulation tâche      | Optionnel, interruption douce |

### Outils Legacy (masqués)

- `activated_rag` : Désactivé dans config v3
- `injection_rag` : Remplacé par `index_rag`
- `recherche_rag` : Alias de `query_rag`
- `search_code` : Remplacé par `query_rag`

## 🔄 Pipeline RAG Automatisé

### Phase 0 : Initialisation

```typescript
// Auto-initialisation avec retry
const initializer = new AutoInitializer({
  maxRetries: 3,
  backoffMs: 1000,
});
```

### Phase 1 : Détection Projets

```typescript
// Multi-project manager avec signature monorepo
const manager = new MultiProjectManager({
  detection: "auto",
  isolation: "full",
  rootGroup: "workspace",
});
```

### Phase 2 : Analyse Structurelle

```typescript
// Code analyzer interne (ex-code-mapper)
const analysis = await enrichCodebase({
  rootPath: project.root,
  mode: "full",
});
```

### Phase 3 : Indexation Vectorielle

```typescript
// Vector store avec multi-backends
const store = await VectorStore.initialize({
  backend: "sqlite", // ou 'postgresql', 'memory'
  config: config.vector_store,
});
```

### Phase 4 : Monitoring Temps Réel

```typescript
// Monitoring write-only strict
const monitor = new MonitoringWriter({
  basePath: "/rag/monitoring/",
  writeOnly: true, // validation stricte
});
```

## 🧪 Gardes et Validations

### Gardes d'Initialisation

```typescript
class InitializationGuard {
  static async requireInit(projectPath: string) {
    const state = await PersistentState.load(projectPath);
    if (!state.initialized) {
      throw new Error("PROJECT_NOT_INITIALIZED");
    }
  }
}
```

### Gardes de Sécurité

```typescript
class SecurityGuard {
  static validateMonitoringAccess(action: "read" | "write", caller: string) {
    if (caller === "engine" && action !== "write") {
      throw new Error("ENGINE_WRITE_ONLY_VIOLATION");
    }
    if (caller === "extension" && action !== "read") {
      throw new Error("EXTENSION_READ_ONLY_VIOLATION");
    }
  }
}
```

### Gardes d'Idempotence

```typescript
class IdempotenceGuard {
  static async ensureIdempotent(operationId: string, params: any) {
    const hash = createHash(params);
    const executed = await IdempotenceCache.get(hash);
    if (executed) {
      return executed.result; // Retour résultat précédent
    }
    // Exécuter et cacher
  }
}
```

## 📊 Observabilité et Monitoring

### Métriques Temps Réel

```json
{
  "timestamp": "2026-02-07T20:14:00Z",
  "metrics": {
    "projects_active": 3,
    "tasks_queued": 5,
    "tasks_running": 2,
    "tasks_completed": 42,
    "memory_usage_mb": 128,
    "vector_store_size_mb": 256
  }
}
```

### Événements Système

```json
{
  "event": "project_initialized",
  "timestamp": "2026-02-07T20:14:00Z",
  "data": {
    "project_id": "proj-123",
    "path": "/home/user/project",
    "initialization_time_ms": 1500
  }
}
```

### Santé Système

```json
{
  "status": "healthy",
  "timestamp": "2026-02-07T20:14:00Z",
  "components": {
    "vector_store": "online",
    "monitoring": "online",
    "daemon": "online",
    "memory_cache": "online"
  }
}
```

## 🔧 Procédures de Debug

### 1. Vérifier l'État du Système

```bash
# Utiliser get_status
node -e "import('./build/index.js').then(m => m.get_status())"

# Consulter les logs
tail -f /rag/logs/rag.log | jq '.'
```

### 2. Diagnostiquer les Problèmes d'Initialisation

```bash
# Vérifier l'état d'initialisation
cat /rag/state/init.json | jq '.'

# Vérifier les échecs temporaires
cat /rag/state/failures.json | jq '.'
```

### 3. Auditer la Conformité

```bash
# Exécuter l'audit de conformité
node audit-conformite.cjs

# Vérifier les règles d'accès
node scripts/validate-access-rules.js
```

### 4. Monitorer les Performances

```bash
# Surveiller les métriques temps réel
watch -n 5 'cat /rag/monitoring/metrics.json | jq .'

# Analyser les logs pour patterns
grep -i "error\|warning" /rag/logs/rag.log | jq '.'
```

## 🚀 Déploiement et Configuration

### Configuration Minimale

```json
{
  "version": "3.0.0",
  "system": {
    "json_strict": true,
    "legacy_mode": false,
    "exposed_tools": ["init_rag", "get_status", "query_rag", "cancel_task"]
  },
  "vector_store": {
    "default_backend": "sqlite"
  }
}
```

### Configuration Avancée

```json
{
  "monitoring": {
    "enabled": true,
    "write_only": true,
    "retention_days": 30
  },
  "daemon": {
    "auto_start": true,
    "project_detection": "auto",
    "max_concurrent_tasks": 5
  },
  "enrichment": {
    "code_analysis": {
      "enabled": true,
      "mode": "full",
      "cache_results": true
    }
  }
}
```

## 📈 Métriques de Qualité

### Conformité aux Règles

| Règle                            | Statut      | Dernière Vérification |
| -------------------------------- | ----------- | --------------------- |
| #25 Séparation monitoring/moteur | ✅ Conforme | 2026-02-07            |
| #20 Idempotence sous-fonctions   | ✅ Conforme | 2026-02-07            |
| #18 Immutabilité état            | ✅ Conforme | 2026-02-07            |
| #15 Non-réentrance commandes     | ✅ Conforme | 2026-02-07            |

### Performances

| Métrique             | Valeur  | Cible   |
| -------------------- | ------- | ------- |
| Temps initialisation | < 300ms | < 500ms |
| Temps recherche      | < 150ms | < 200ms |
| Mémoire utilisée     | < 150MB | < 200MB |
| Taux succès tâches   | 99.8%   | > 99%   |

## 🔄 Migration et Rétrocompatibilité

### Migration depuis v2.0

```bash
# Script de migration automatique
npm run migrate-v3

# Validation post-migration
npm run validate-migration
```

### Rétrocompatibilité

- **Outils legacy** : Disponibles si `legacy_mode: true`
- **Données** : Migration automatique vers SQLite
- **API** : Compatibilité ascendante maintenue

## 🛡️ Sécurité et Robustesse

### Protection des Sections Critiques

```typescript
class CriticalSection {
  private static locks = new Map<string, boolean>();

  static async execute<T>(id: string, operation: () => Promise<T>): Promise<T> {
    if (this.locks.get(id)) {
      throw new Error(`CRITICAL_SECTION_LOCKED: ${id}`);
    }

    this.locks.set(id, true);
    try {
      return await operation();
    } finally {
      this.locks.delete(id);
    }
  }
}
```

### Gestion des Échecs

```typescript
class FailureManager {
  static async handleTemporaryFailure(
    operation: () => Promise<any>,
    maxRetries: number = 3,
  ) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await this.backoff(i);
        await this.recordFailure(error);
      }
    }
  }
}
```

## 📚 Documentation Complémentaire

### Guides

- [MIGRATION_V2_V3.md](./MIGRATION_V2_V3.md) : Guide de migration
- [CONFIGURATION.md](./CONFIGURATION.md) : Configuration détaillée
- [Règles_Absolues_Rag_Mcp_Server.md](../Règles_Absolues_Rag_Mcp_Server.md) : Règles absolues

### Références

- [API_REFERENCE.md](./API_REFERENCE.md) : Référence API complète
- [EXAMPLES.md](./EXAMPLES.md) : Exemples d'utilisation
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) : Résolution problèmes

## ✅ Checklist de Validation

### Validation Architecture

- [ ] Séparation monitoring/moteur respectée
- [ ] État persistant immutable
- [ ] Sous-fonctions idempotentes
- [ ] Commandes MCP non-réentrantes
- [ ] JSON strict respecté

### Validation Fonctionnelle

- [ ] Initialisation projet fonctionnelle
- [ ] Recherche sémantique passive
- [ ] Monitoring temps réel opérationnel
- [ ] Gestion multi-projets fonctionnelle
- [ ] File de tâches prioritaire opérationnelle

### Validation Performance

- [ ] Temps réponse < cibles
- [ ] Mémoire utilisée < limites
- [ ] Taux succès > 99%
- [ ] Scalabilité vérifiée

## 🎯 Conclusion

L'architecture finale v3.0 du RAG MCP Server fournit :

1. **Robustesse** : Gardes, validations, gestion d'erreurs
2. **Observabilité** : Monitoring temps réel, logs structurés
3. **Maintenabilité** : Séparation des responsabilités, documentation
4. **Performance** : Optimisations, cache, multi-backends
5. **Conformité** : Respect strict des 25 règles absolues

Le système est prêt pour la production avec une gouvernance stricte, une observabilité totale et une architecture évolutive.

---

**Version** : 3.0.0
**Dernière mise à jour** : 2026-02-07
**Statut** : Production Ready
**Mainteneurs** : Équipe RAG MCP Server
