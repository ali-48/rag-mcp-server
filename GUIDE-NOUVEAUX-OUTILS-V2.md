# Guide des Nouveaux Outils - Système ToolRegistry v2.0

Ce document explique la nouvelle architecture v2.0 avec les outils `activated_rag` et `recherche_rag`, et comment migrer depuis l'ancien système.

## 🚀 Vue d'Ensemble v2.0

### Nouvelle Architecture

Le système v2.0 introduit une **architecture simplifiée** avec seulement deux outils principaux :

| Outil | Description | Remplace |
|-------|-------------|----------|
| **`activated_rag`** | Outil maître pour l'indexation automatique | `injection_rag`, `index_project`, `update_project`, `analyse_code` |
| **`recherche_rag`** | Outil de recherche avancée | `search_code` |

### Avantages de v2.0

1. **Simplification** : 2 outils au lieu de 6
2. **Automatisation** : Détection VS Code + file watcher intégrés
3. **Intelligence** : Chunking intelligent par type de contenu
4. **Rétrocompatibilité** : Les anciens outils fonctionnent toujours (masqués)

## 📋 Migration depuis v1.0

### Étape 1 : Mise à jour de la configuration

Mettez à jour votre `config/rag-config.json` :

```json
{
  "version": "2.0.0",
  "description": "Configuration RAG v2.0",
  "system": {
    "legacy_mode": true,
    "exposed_tools": ["activated_rag", "recherche_rag"],
    "legacy_tools": ["injection_rag", "index_project", "update_project", "search_code", "manage_projects"]
  },
  "defaults": {
    "embedding_provider": "ollama",
    "embedding_model": "nomic-embed-text",
    "chunk_size": 1000,
    "chunk_overlap": 200
  },
  "providers": {
    "ollama": {
      "description": "Ollama embeddings",
      "models": {
        "code": "nomic-embed-code",
        "text": "nomic-embed-text"
      }
    }
  }
}
```

### Étape 2 : Migration automatique

Exécutez le script de migration :

```bash
npm run migrate-v2
```

Ou manuellement :

```typescript
import { migrateFromV1 } from './src/core/registry-v2.js';

await migrateFromV1();
```

### Étape 3 : Vérification

Vérifiez que la migration a réussi :

```bash
npm run test-retrocompatibility
```

## 🛠️ Utilisation des Nouveaux Outils

### 1. activated_rag - Indexation Automatique

**Description** : Outil maître qui orchestre tout le pipeline RAG automatiquement.

**Schéma d'entrée** :

```typescript
{
  project_path: string;           // Chemin du projet à indexer
  file_patterns?: string[];       // Patterns de fichiers (défaut: **/*.{js,ts,py,md,txt,json,yaml,yml,html,css,scss})
  recursive?: boolean;            // Parcours récursif (défaut: true)
  enable_phase0?: boolean;        // Activer Phase 0 (détection VS Code + file watcher)
  enable_watcher?: boolean;       // Activer le file watcher en temps réel
  embedding_provider?: string;    // Fournisseur d'embeddings (fake, ollama, sentence-transformers)
  embedding_model?: string;       // Modèle d'embeddings
  chunk_size?: number;            // Taille des chunks (tokens)
  chunk_overlap?: number;         // Chevauchement entre chunks
}
```

**Exemple d'utilisation** :

```typescript
// Indexation automatique d'un projet
const result = await toolRegistry.execute('activated_rag', {
  project_path: '/chemin/vers/mon/projet',
  file_patterns: ['**/*.ts', '**/*.js', '**/*.md'],
  recursive: true,
  enable_phase0: true,
  enable_watcher: false,
  embedding_provider: 'ollama',
  embedding_model: 'nomic-embed-text',
  chunk_size: 1000,
  chunk_overlap: 200
});
```

**Pipeline interne** :

```
activated_rag
    ├── Phase 0 : Détection projet VS Code
    ├── Scan fichiers & changements
    ├── Analyse statique multi-langage
    ├── Chunking intelligent
    │   ├── Code : 1 fonction = 1 chunk
    │   ├── Classes : N chunks
    │   └── Documentation : par paragraphes
    ├── Calcul embeddings
    │   ├── Code : nomic-embed-code
    │   └── Texte : nomic-embed-text
    └── Injection RAG
```

### 2. recherche_rag - Recherche Avancée

**Description** : Outil de recherche sémantique avec filtres avancés.

**Schéma d'entrée** :

```typescript
{
  query: string;                  // Requête de recherche
  scope?: 'project' | 'global';   // Scope de recherche (défaut: 'project')
  top_k?: number;                 // Nombre de résultats (défaut: 10)
  filters?: {
    project_filter?: string;      // Filtre par projet
    content_type?: string[];      // Types de contenu (code, doc, config, other)
    language?: string[];          // Langages (typescript, javascript, python, etc.)
    file_extension?: string[];    // Extensions de fichier
    min_score?: number;           // Score minimum (0-1)
  };
}
```

**Exemple d'utilisation** :

```typescript
// Recherche avec filtres
const results = await toolRegistry.execute('recherche_rag', {
  query: 'comment implémenter l\'authentification',
  scope: 'project',
  top_k: 5,
  filters: {
    project_filter: '/chemin/vers/mon/projet',
    content_type: ['code', 'doc'],
    language: ['typescript', 'javascript'],
    min_score: 0.3
  }
});
```

**Fonctionnalités avancées** :

- **Recherche hybride** : Combinaison similarité sémantique + recherche textuelle
- **Re-ranking** : Classement basé sur métadonnées (fraîcheur, taille, type)
- **Filtres booléens** : Combinaisons AND/OR sur les filtres
- **Seuil dynamique** : Adaptation automatique du seuil de similarité

## 🔧 Configuration Avancée

### Configuration Phase 0

```json
{
  "phase0": {
    "enabled": true,
    "workspace_detection": {
      "enabled": true,
      "polling_interval": 5000
    },
    "file_watcher": {
      "enabled": false,
      "ignored_patterns": ["node_modules", ".git", "*.log"]
    },
    "event_logging": {
      "enabled": true,
      "log_level": "INFO"
    }
  }
}
```

### Configuration des Embeddings par Type

```json
{
  "embedding_models": {
    "code": {
      "provider": "ollama",
      "model": "nomic-embed-code",
      "dimensions": 768
    },
    "text": {
      "provider": "ollama",
      "model": "nomic-embed-text",
      "dimensions": 768
    },
    "config": {
      "provider": "ollama",
      "model": "nomic-embed-text",
      "dimensions": 768
    }
  }
}
```

### Paramètres de Chunking Intelligent

```json
{
  "chunking": {
    "code": {
      "strategy": "ast_based",
      "max_tokens": 1000,
      "overlap_tokens": 200,
      "preserve_structure": true
    },
    "documentation": {
      "strategy": "paragraph_based",
      "max_tokens": 800,
      "overlap_tokens": 100,
      "preserve_headers": true
    },
    "configuration": {
      "strategy": "file_based",
      "max_tokens": 500,
      "overlap_tokens": 0
    }
  }
}
```

## 📊 Exemples Complets

### Exemple 1 : Migration d'un Projet Existant

```typescript
// Ancienne façon (v1.0)
const oldResult = await toolRegistry.execute('injection_rag', {
  project_path: '/mon/projet',
  file_patterns: ['**/*.ts'],
  recursive: true
});

// Nouvelle façon (v2.0)
const newResult = await toolRegistry.execute('activated_rag', {
  project_path: '/mon/projet',
  file_patterns: ['**/*.ts'],
  recursive: true,
  enable_phase0: true
});
```

### Exemple 2 : Recherche Avancée

```typescript
// Recherche de code TypeScript sur l'authentification
const authCode = await toolRegistry.execute('recherche_rag', {
  query: 'JWT authentication middleware implementation',
  scope: 'project',
  top_k: 3,
  filters: {
    project_filter: '/mon/projet/auth',
    content_type: ['code'],
    language: ['typescript'],
    file_extension: ['.ts', '.tsx']
  }
});

// Recherche de documentation
const authDocs = await toolRegistry.execute('recherche_rag', {
  query: 'authentication setup and configuration',
  scope: 'project',
  top_k: 2,
  filters: {
    content_type: ['doc'],
    file_extension: ['.md', '.txt']
  }
});
```

### Exemple 3 : Surveillance en Temps Réel

```typescript
// Activer la surveillance automatique
const watcher = await toolRegistry.execute('activated_rag', {
  project_path: '/mon/projet',
  enable_phase0: true,
  enable_watcher: true,
  file_patterns: ['**/*.ts', '**/*.js']
});

// Le système surveille automatiquement les changements
// et met à jour l'index en temps réel
```

## 🧪 Tests et Validation

### Tests de Rétrocompatibilité

```bash
# Exécuter tous les tests
npm test

# Tests spécifiques v2.0
npm run test:v2

# Tests de rétrocompatibilité
npm run test:retrocompatibility
```

### Vérification de la Migration

```typescript
import { autoRegistryV2 } from './src/core/registry-v2.js';

// Vérifier les outils enregistrés
const tools = autoRegistryV2.listRegisteredTools();
console.log('Outils enregistrés:', tools);

// Vérifier la visibilité
const visibleTools = tools.filter(t => !t.hidden);
const hiddenTools = tools.filter(t => t.hidden);

console.log('Outils visibles:', visibleTools.map(t => t.name));
console.log('Outils masqués:', hiddenTools.map(t => t.name));
```

## 🔍 Dépannage

### Problème : Les anciens outils ne fonctionnent plus

**Solution** : Activez le mode legacy dans la configuration :

```json
{
  "system": {
    "legacy_mode": true
  }
}
```

### Problème : activated_rag ne détecte pas les changements

**Solution** : Vérifiez la configuration Phase 0 :

1. Assurez-vous que `enable_phase0` est à `true`
2. Vérifiez les permissions du file watcher
3. Consultez les logs : `logs/phase0-events.log`

### Problème : Recherche avec scores bas

**Solution** : Ajustez les paramètres :

1. Utilisez le modèle approprié pour le type de contenu
2. Ajustez le seuil dynamique : `filters.min_score`
3. Activez le re-ranking : `enable_reranking: true`

### Problème : Performances lentes

**Solution** : Optimisez la configuration :

1. Réduisez `chunk_size` pour les gros fichiers
2. Utilisez `embedding_provider: 'fake'` pour les tests
3. Désactivez `enable_watcher` si non nécessaire

## 📈 Métriques et Monitoring

### Logs Disponibles

- `logs/activated-rag.log` : Logs d'indexation
- `logs/recherche-rag.log` : Logs de recherche
- `logs/phase0-events.log` : Événements Phase 0
- `logs/performance.log` : Métriques de performance

### Métriques Clés

```typescript
const metrics = {
  indexation: {
    files_processed: number,
    chunks_created: number,
    embedding_time_ms: number,
    total_time_ms: number
  },
  recherche: {
    query_time_ms: number,
    results_count: number,
    avg_score: number,
    cache_hit_rate: number
  },
  phase0: {
    files_watched: number,
    change_events: number,
    auto_index_count: number
  }
};
```

## 🔮 Prochaines Étapes

### Roadmap v2.1

1. **Intégration Tree-sitter** : Analyse AST native
2. **Cache distribué** : Partage d'embeddings entre projets
3. **API REST** : Interface HTTP pour les outils
4. **Plugins** : Extensions personnalisables

### Roadmap v3.0

1. **Apprentissage automatique** : Adaptation des paramètres
2. **Collaboration** : Partage d'index entre utilisateurs
3. **Intégration CI/CD** : Pipeline d'indexation automatisé
4. **Dashboard** : Interface web de monitoring

## 📚 Ressources

### Documentation

- [README.md](./README.md) : Documentation principale
- [CONFIGURATION.md](./docs/CONFIGURATION.md) : Guide de configuration
- [API_REFERENCE.md](./docs/API_REFERENCE.md) : Référence API

### Exemples

- [examples/basic-usage.ts](./examples/basic-usage.ts) : Exemple basique
- [examples/advanced-search.ts](./examples/advanced-search.ts) : Recherche avancée
- [examples/migration-guide.ts](./examples/migration-guide.ts) : Guide de migration

### Support

- [Issues GitHub](https://github.com/votre-repo/issues) : Rapporter des bugs
- [Discussions](https://github.com/votre-repo/discussions) : Questions et discussions
- [Wiki](https://github.com/votre-repo/wiki) : Documentation communautaire

---

**Dernière mise à jour** : 13/01/2026  
**Version du système** : ToolRegistry v2.0.0  
**Statut** : Production Ready 🚀  
**Compatibilité** : Rétrocompatible avec v1.0.0
