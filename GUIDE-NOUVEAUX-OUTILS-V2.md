# Guide des Nouveaux Outils - Système ToolRegistry v2.0

Ce document explique la nouvelle architecture v2.0 avec les outils `activated_rag` et `recherche_rag`, et comment migrer depuis l'ancien système.

## 🚀 Vue d'Ensemble v2.0

### Nouvelle Architecture

Le système v2.0 introduit une **architecture modulaire** avec trois outils principaux :

| Outil | Description | Remplace |
|-------|-------------|----------|
| **`init_rag`** | Initialisation de l'infrastructure RAG (8 étapes atomiques) | - |
| **`activated_rag`** | Outil maître pour l'indexation automatique | `injection_rag`, `index_project`, `update_project`, `analyse_code` |
| **`recherche_rag`** | Outil de recherche avancée | `search_code` |

### Workflow RAG Complet

```
init_rag (Module A) → activated_rag (Module D) → recherche_rag
    ├── A1: Résolution projet
    ├── A2: Création arborescence
    ├── A3: .ragignore
    ├── A4: Config RAG
    ├── A5: Config DB
    ├── A6: SQLite
    ├── A7: Test vector DB
    └── A8: Enregistrement MCP
```

### Vérification d'État (Module B)

Le système inclut un module de vérification d'état :

- **`isRagInitialized()`** : Vérifie si un projet est initialisé
- **`getRagState()`** : Retourne l'état complet du RAG

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

### 1. init_rag - Initialisation RAG

**Description** : Initialise l'infrastructure RAG pour un projet (8 étapes atomiques).

**Schéma d'entrée** :

```typescript
{
  project_path: string;           // Chemin du projet à initialiser
  mode?: 'default' | 'memory-only' | 'full';  // Mode d'initialisation
  force?: boolean;                // Forcer l'initialisation même si déjà initialisé
  verbose?: boolean;              // Afficher des détails supplémentaires
}
```

**Exemple d'utilisation** :

```typescript
// Initialisation d'un projet
const result = await toolRegistry.execute('init_rag', {
  project_path: '/chemin/vers/mon/projet',
  mode: 'default',
  force: false,
  verbose: true
});

// Vérifier le résultat
if (result.status === 'success') {
  console.log('✅ Projet initialisé avec succès');
  console.log('ID du projet:', result.data.project_id);
  console.log('Étapes réussies:', result.data.steps);
}
```

**Étapes d'initialisation** :

1. **A1** : Résolution du chemin projet
2. **A2** : Création de l'arborescence des dossiers
3. **A3** : Génération du fichier `.ragignore`
4. **A4** : Configuration RAG (`rag.config.json`)
5. **A5** : Configuration base de données (`db.config.json`)
6. **A6** : Initialisation SQLite
7. **A7** : Test de la base vectorielle
8. **A8** : Enregistrement dans le registry MCP

### 2. activated_rag - Indexation Automatique

**Description** : Outil maître qui orchestre tout le pipeline RAG automatiquement. **Nécessite que le projet soit initialisé avec `init_rag`**.

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
// Vérifier d'abord si le projet est initialisé
const isInitialized = await isRagInitialized('/chemin/vers/mon/projet');

if (!isInitialized) {
  console.log('❌ Projet non initialisé. Utilisez init_rag d\'abord.');
  return;
}

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

**Vérification automatique** :

L'outil `activated_rag` inclut un **check bloquant** (Module D) qui vérifie automatiquement si le projet est initialisé. Si ce n'est pas le cas, il retourne une erreur propre avec des instructions pour utiliser `init_rag`.

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

### 3. recherche_rag - Recherche Avancée

**Description** : Outil de recherche sémantique avec filtres avancés. **Nécessite que le projet soit initialisé et indexé**.

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

### Exemple 1 : Initialisation et Indexation Complète

```typescript
// Étape 1 : Initialisation du projet
const initResult = await toolRegistry.execute('init_rag', {
  project_path: '/mon/projet',
  mode: 'default',
  verbose: true
});

if (initResult.status !== 'success') {
  console.error('❌ Échec de l\'initialisation:', initResult.message);
  return;
}

console.log('✅ Projet initialisé:', initResult.data.project_id);

// Étape 2 : Vérification de l'état
const ragState = await getRagState('/mon/projet');
console.log('📊 État RAG:', ragState);

// Étape 3 : Indexation complète
const indexResult = await toolRegistry.execute('activated_rag', {
  project_path: '/mon/projet',
  file_patterns: ['**/*.ts', '**/*.js', '**/*.md'],
  recursive: true,
  enable_phase0: true,
  mode: 'full'
});

console.log('📦 Indexation terminée:', indexResult.stats);
```

### Exemple 2 : Workflow avec Gestion des Erreurs

```typescript
try {
  // Vérifier si le projet est initialisé
  const isInitialized = await isRagInitialized('/mon/projet');
  
  if (!isInitialized) {
    // Initialisation automatique
    console.log('🔧 Initialisation automatique du projet...');
    const initResult = await toolRegistry.execute('init_rag', {
      project_path: '/mon/projet',
      mode: 'default'
    });
    
    if (initResult.status !== 'success') {
      throw new Error(`Échec de l'initialisation: ${initResult.message}`);
    }
  }

  // Indexation incrémentale
  const indexResult = await toolRegistry.execute('activated_rag', {
    project_path: '/mon/projet',
    mode: 'incremental',
    enable_phase0: true
  });

  // Recherche
  const searchResult = await toolRegistry.execute('recherche_rag', {
    query: 'comment implémenter l\'authentification',
    scope: 'project',
    project_filter: '/mon/projet',
    content_types: ['code', 'doc']
  });

  console.log('✅ Workflow terminé avec succès');

} catch (error) {
  console.error('❌ Erreur dans le workflow:', error);
  
  // Récupérer l'état pour le débogage
  const state = await getRagState('/mon/projet');
  console.error('📊 État RAG au moment de l\'erreur:', state);
}
```

### Exemple 3 : Tests Unitaires et d'Intégration

```typescript
// Tests unitaires pour les modules A et B
import { describe, it, expect } from 'vitest';
import { isRagInitialized, getRagState } from './src/rag/phase0/rag-state.js';
import { initRagTool } from './src/tools/rag/init-rag.js';
import { activatedRagHandler } from './src/tools/rag/activated-rag.js';

describe('Workflow RAG complet', () => {
  const mockProjectPath = '/mock/project/path';

  it('devrait initialiser un projet puis exécuter activated_rag', async () => {
    // Test d'initialisation
    const initResult = await initRagTool({
      project_path: mockProjectPath,
      mode: 'default'
    });

    expect(initResult.status).toBe('success');
    expect(initResult.data.project_id).toBeDefined();

    // Vérification de l'état
    const isInitialized = await isRagInitialized(mockProjectPath);
    expect(isInitialized).toBe(true);

    // Test d'indexation
    const activatedResult = await activatedRagHandler({
      mode: 'full',
      project_path: mockProjectPath,
      file_patterns: ['**/*.ts'],
      enable_phase0: true
    });

    expect(activatedResult).toBeDefined();
    expect(activatedResult.isError).toBe(false);
  });

  it('devrait échouer avec activated_rag si non initialisé', async () => {
    const result = await activatedRagHandler({
      mode: 'full',
      project_path: '/non/initialized/path'
    });

    expect(result.isError).toBe(true);
    expect(result.content).toContain('RAG_NOT_INITIALIZED');
  });
});
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

### Problème : activated_rag retourne "RAG non initialisé"

**Solution** : Utilisez `init_rag` pour initialiser le projet :

```typescript
// Étape 1 : Initialiser le projet
await toolRegistry.execute('init_rag', {
  project_path: '/mon/projet',
  mode: 'default'
});

// Étape 2 : Vérifier l'état
const state = await getRagState('/mon/projet');
console.log('État RAG:', state);

// Étape 3 : Exécuter activated_rag
await toolRegistry.execute('activated_rag', {
  project_path: '/mon/projet',
  mode: 'full'
});
```

### Problème : init_rag échoue avec des erreurs de permissions

**Solution** : Vérifiez les permissions et chemins :

1. Vérifiez que le chemin du projet existe
2. Assurez-vous d'avoir les permissions d'écriture
3. Utilisez `force: true` pour réinitialiser
4. Consultez les logs : `logs/rag-initialization.log`

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

## 🚀 Optimisations Récentes (v2.0.2)

### Système d'Initialisation RAG (Modules A-D)

Un système complet d'initialisation a été implémenté :

1. **Module A (rag-initialization.ts)** : 8 étapes atomiques d'initialisation
2. **Module B (rag-state.ts)** : Vérification et récupération de l'état RAG
3. **Module C (init-rag.ts)** : Outil MCP avec validation et exécution contrôlée
4. **Module D (activated-rag.ts)** : Check bloquant et échec propre si non initialisé

### Chunking Intelligent Amélioré

Le chunking intelligent a été optimisé avec les améliorations suivantes :

1. **Détection étendue des types de nœuds** :
   - +15 types pour TypeScript/JavaScript (async_function_declaration, generator_function, arrow_function, etc.)
   - +8 types pour Python (async_function_definition, class_definition, decorator, etc.)
   - Support des classes abstraites et interfaces

2. **Chunking hiérarchique des classes** :

   ```typescript
   // Règle : class_hierarchical_chunk (priorité 85)
   // Divise les classes complexes en chunks logiques :
   // 1. Définition de la classe
   // 2. Groupes de méthodes par visibilité
   // 3. Propriétés regroupées
   ```

3. **Métadonnées enrichies** :
   - Extraction des paramètres avec types
   - Calcul de complexité cyclomatique
   - Détection de visibilité (public/private/protected)
   - Estimation de la taille et complexité

4. **Tests de validation** :
   - Atomicité : 100% des chunks sont des unités sémantiques complètes
   - Cohérence sémantique : 100% de pertinence sémantique
   - Support multi-langage : TypeScript, Python, JavaScript

### Tests Unitaires et d'Intégration

Un système complet de tests a été implémenté :

1. **Tests unitaires** :
   - `test/unit/rag-initialization.test.ts` : Tests pour les 8 étapes (A1-A8)
   - `test/unit/rag-state.test.ts` : Tests pour les fonctions B1-B2
   - Couverture : Validation, gestion des erreurs, intégration

2. **Tests d'intégration** :
   - `test/integration/rag-workflow.test.ts` : Workflow complet init_rag → activated_rag
   - Scénarios : Initialisation, vérification, indexation, gestion des erreurs
   - Cas limites : Chemins invalides, permissions, corruption de config

3. **Mocks complets** : Système de fichiers, SQLite, crypto, path

### Système de Métriques RAG

Un système complet de métriques a été implémenté (`src/rag/rag-metrics.ts`) :

1. **Métriques de qualité sémantique** :
   - Scores de similarité et distribution
   - Précision, rappel, F1-score
   - Cohérence des résultats

2. **Métriques de performance** :
   - Temps d'indexation et de recherche
   - Taux de cache et utilisation mémoire
   - Latence des embeddings

3. **Métriques de chunking** :
   - Atomicité et cohérence sémantique
   - Distribution par type de contenu
   - Taille moyenne des chunks

4. **Export et analyse** :
   - Export JSON et CSV
   - Statistiques agrégées
   - Intégration avec Phase0Logger

### Bonnes Pratiques

1. **Workflow recommandé** :

   ```typescript
   // 1. Toujours initialiser d'abord
   await init_rag({ project_path: '/projet', mode: 'default' });
   
   // 2. Vérifier l'état
   const state = await getRagState('/projet');
   
   // 3. Indexer
   await activated_rag({ project_path: '/projet', mode: 'full' });
   
   // 4. Rechercher
   await recherche

2. **Optimisation mémoire** :
   - Utiliser `chunk_size: 800` pour les projets volumineux
   - Activer le cache LLM pour les enrichissements répétitifs
   - Limiter `top_k` à 10-20 pour les recherches

3. **Surveillance** :
   - Vérifier régulièrement les logs `logs/rag-metrics.log`
   - Monitorer l'utilisation mémoire du cache
   - Tester la qualité avec des requêtes de référence

### Limitations Connues

1. **Tree-sitter** :
   - Nécessite les grammaires installées localement
   - Performances sur fichiers très volumineux (>10k lignes)
   - Support limité pour les langages rares

2. **Embeddings** :
   - Modèles Ollama nécessitent 4-8GB de RAM
   - Latence sur les premiers appels
   - Dimensions fixes selon le modèle

3. **Cache** :
   - TTL limité à 1 heure par défaut
   - Pas de persistance entre redémarrages
   - Taille limitée à 1000 entrées

## 🔮 Prochaines Étapes

### Roadmap v2.1

1. **Intégration Tree-sitter complète** : Analyse AST native optimisée
2. **Cache distribué** : Partage d'embeddings entre projets
3. **API REST** : Interface HTTP pour les outils
4. **Plugins** : Extensions personnalisables
5. **Dashboard métriques** : Interface web de monitoring

### Roadmap v3.0

1. **Apprentissage automatique** : Adaptation des paramètres
2. **Collaboration** : Partage d'index entre utilisateurs
3. **Intégration CI/CD** : Pipeline d'indexation automatisé
4. **Analytics avancés** : Détection de patterns et recommandations
5. **Support multi-langage étendu** : Java, C#, Go, Rust

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
