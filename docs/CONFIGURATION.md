# Documentation de Configuration RAG

## 📋 Vue d'ensemble

Le système de configuration RAG centralisée permet de gérer tous les paramètres des outils RAG dans un seul endroit, avec validation des limites et valeurs par défaut.

## 🗂️ Structure des Fichiers

### Fichier de Configuration Principal

- **`config/rag-config.json`** : Configuration JSON avec toutes les options
- **`src/config/rag-config.ts`** : Gestionnaire TypeScript pour charger et valider

### Structure du Fichier JSON

```json
{
  "version": "1.0.0",
  "description": "Configuration des paramètres RAG",
  
  "defaults": {
    "embedding_provider": "fake",
    "embedding_model": "nomic-embed-text",
    "chunk_size": 1000,
    "chunk_overlap": 200,
    "file_patterns": ["**/*.{js,ts,py,md,txt,json,yaml,yml,html,css,scss}"],
    "recursive": true,
    "search_limit": 10,
    "search_threshold": 0,
    "format_output": true
  },
  
  "providers": {
    "fake": { "description": "Fournisseur factice pour tests", "models": ["nomic-embed-text"] },
    "ollama": { "description": "Ollama pour embeddings locaux", "models": ["nomic-embed-text"] },
    "sentence-transformers": { "description": "Sentence Transformers", "models": ["all-MiniLM-L6-v2"] }
  },
  
  "limits": {
    "chunk_size": { "min": 100, "max": 10000, "default": 1000 },
    "chunk_overlap": { "min": 0, "max": 1000, "default": 200 },
    "search_limit": { "min": 1, "max": 50, "default": 10 },
    "search_threshold": { "min": 0, "max": 1, "default": 0 }
  },

  "phase0_3": {
    "enabled": false,
    "provider": "ollama",
    "model": "llama3.1:latest",
    "temperature": 0.1,
    "max_tokens": 1000,
    "timeout_ms": 30000,
    "batch_size": 5,
    "features": ["summary", "keywords", "entities"],
    "cache_enabled": true,
    "cache_ttl_seconds": 3600
  }
}
```

## 🔄 Nouveau Flux de Configuration (RAG v3)

### Configuration Centralisée avec rag-config-v3.json

Le serveur RAG MCP utilise désormais une configuration centralisée via `config/rag-config-v3.json` pour gérer les outils exposés et leur visibilité. Ce nouveau flux remplace l'ancien système de configuration statique.

#### Structure de Configuration

```json
{
  "system": {
    "mode": "memory-only",
    "exposed_tools": [
      "init_rag",
      "scan_rag",
      "index_rag",
      "query_rag",
      "manage_projects",
      "pipeline_validator",
      "get_status"
    ],
    "legacy_tools": [
      "activated_rag",
      "injection_rag",
      "index_project",
      "update_project",
      "search_code",
      "recherche_rag"
    ],
    "legacy_mode": false
  }
}
```

#### Fonctionnement du Flux

1. **Chargement au Démarrage** : Le serveur charge `config/rag-config-v3.json` via `getRagConfigManager`
2. **Configuration du Registre** : La configuration est appliquée au `AutoRegistryV2` via `configureFromConfig`
3. **Enregistrement Automatique** : Les outils sont enregistrés selon leur visibilité définie dans `exposed_tools` et `legacy_tools`

#### Intégration dans src/index.ts

```typescript
// Fonction principale
async function main() {
  // Initialiser la redirection des logs
  initializeLogRedirection();

  // Charger la configuration RAG v3
  const { getRagConfigManager } = await import('./config/rag-config.js');
  const configManager = getRagConfigManager('config/rag-config-v3.json');
  const config = configManager.getConfig();

  // Configurer le registre automatique avec la configuration
  const { autoRegistryV2 } = await import('./core/registry-v2.js');
  autoRegistryV2.configureFromConfig(config);

  // Initialiser le registre automatique v2
  const registeredCount = await initializeAutoRegistryV2({ verbose: false });

  // ... reste du code
}
```

#### Migration depuis l'Ancien Système

- **Ancien** : Configuration statique dans `src/core/registry-v2.ts`
- **Nouveau** : Configuration dynamique via `rag-config-v3.json`
- **Avantages** : Modification sans recompilation, configuration par environnement

#### Outils Supprimés/Fusionnés

- `recherche_rag` : Fusionné dans `query_rag` (paramètre `legacy_mode` supprimé)
- `get_task_status` : Remplacé par `get_status` avec 3 scopes (global, projet, tâche)
- `legacy_mode` : Paramètre supprimé de `query_rag`, remplacé par détection automatique basée sur `format_output`

#### Nouveaux Schémas MCP

Les schémas MCP suivants ont été ajoutés dans `src/core/mcp-schemas.ts` :

- `queryRagInputSchema` / `queryRagOutputSchema` : Schémas pour l'outil `query_rag`
- `cancelTaskInputSchema` / `cancelTaskOutputSchema` : Schémas pour l'outil `cancel_task`
- `listTasksInputSchema` / `listTasksOutputSchema` : Schémas pour l'outil `list_tasks`
- `getStatusInputSchema` / `getStatusOutputSchema` : Schémas pour l'outil `get_status`

Ces schémas sont intégrés au mapping `toolSchemas` pour la validation automatique.

#### Messages Orientés IA

Les outils suivants ont été durcis pour des messages orientés IA :

- `get_status` : Messages factuels avec `notes_for_ai` et `allowed_actions`
- `cancel_task` : Messages purement factuels, élimination du langage émotionnel
- `list_tasks` : Format structuré IA avec statistiques et filtres
- `query_rag` : Messages simplifiés avec notes pour l'IA et format JSON standardisé

Les réponses incluent désormais des champs `notes_for_ai` avec des informations concrètes pour l'interprétation par l'IA.

#### Vérification de la Configuration

```bash
# Build et test
npm run build
node build/index.js

# Vérifier que les outils exposés correspondent à la configuration
```

---

## 🧠 Phase 0.3 - LLM Enrichment Configuration

### Configuration de la Phase 0.3

La Phase 0.3 ajoute une couche d'enrichissement LLM optionnelle entre le chunking intelligent (Phase 0.2) et les embeddings (Phase 1). Cette fonctionnalité est contrôlée par un feature flag.

**Paramètres configurables :**

```json
"phase0_3": {
  "enabled": false,                    // Activer/désactiver Phase 0.3
  "provider": "ollama",                // Fournisseur LLM (ollama, fake)
  "model": "llama3.1:latest",          // Modèle LLM à utiliser
  "temperature": 0.1,                  // Température sampling (0.0-1.0)
  "max_tokens": 1000,                  // Tokens maximum par réponse
  "timeout_ms": 30000,                 // Timeout pour les appels LLM
  "batch_size": 5,                     // Taille des batches d'enrichissement
  "features": ["summary", "keywords", "entities"], // Fonctionnalités d'enrichissement
  "cache_enabled": true,               // Activer le cache LLM
  "cache_ttl_seconds": 3600            // TTL du cache en secondes
}
```

**Fonctionnalités d'enrichissement disponibles :**

- `summary` : Résumé sémantique du chunk
- `keywords` : Mots-clés pertinents extraits
- `entities` : Entités identifiées (classes, fonctions, variables)
- `complexity` : Complexité du code (low/medium/high)
- `category` : Catégorie (utility-class, api-endpoint, etc.)
- `language` : Langage de programmation détecté

**Exemple d'activation :**

```json
"phase0_3": {
  "enabled": true,
  "provider": "ollama",
  "model": "llama3.1:latest",
  "temperature": 0.1,
  "max_tokens": 1000,
  "timeout_ms": 30000,
  "batch_size": 5,
  "features": ["summary", "keywords", "entities", "complexity"],
  "cache_enabled": true,
  "cache_ttl_seconds": 3600
}
```

### Métriques Phase 0.3

Lorsque la Phase 0.3 est activée, les métriques suivantes sont collectées :

- `totalChunksProcessed` : Nombre total de chunks traités
- `totalChunksEnriched` : Nombre de chunks enrichis avec succès
- `totalEnrichmentTimeMs` : Temps total d'enrichissement
- `averageEnrichmentTimeMs` : Temps moyen par chunk
- `successRate` : Taux de succès (chunks enrichis / traités)
- `errors` : Nombre d'erreurs LLM
- `byModel` : Statistiques par modèle LLM utilisé

Ces métriques sont disponibles dans les résultats de `indexProject` et `updateProject` via la propriété `phase03Metrics`.

## 🔧 Utilisation dans les Outils

### index_project et update_project

Ces outils utilisent automatiquement la configuration :

```typescript
// Chargement de la configuration
const configManager = getRagConfigManager();
const defaults = configManager.getDefaults();

// Utilisation des valeurs par défaut si non spécifiées
const embedding_provider = args.embedding_provider || defaults.embedding_provider;
const chunk_size = configManager.applyLimits('chunk_size', args.chunk_size || defaults.chunk_size);

// Validation automatique des limites
// Si chunk_size = 50 → devient 100 (minimum)
// Si chunk_size = 20000 → devient 10000 (maximum)
```

### index_project et update_project avec Phase 0.3

Lorsque la Phase 0.3 est activée, les outils d'indexation utilisent automatiquement le service d'enrichissement :

```typescript
// Chargement de la configuration Phase 0.3
const configManager = getRagConfigManager();
const config = configManager.getConfig();
const phase03Config = config.phase0_3 || { enabled: false };

// Initialisation du service LLM Enricher
const llmEnricher = initLLMEnricher({
  enabled: phase03Config.enabled || false,
  provider: phase03Config.provider || 'ollama',
  model: phase03Config.model || 'llama3.1:latest',
  temperature: phase03Config.temperature || 0.1,
  maxTokens: phase03Config.max_tokens || 1000,
  timeoutMs: phase03Config.timeout_ms || 30000,
  batchSize: phase03Config.batch_size || 5,
  features: phase03Config.features || ['summary', 'keywords', 'entities'],
  cacheEnabled: phase03Config.cache_enabled || true,
  cacheTtlSeconds: phase03Config.cache_ttl_seconds || 3600,
});

// Les métriques Phase 0.3 sont incluses dans les résultats
const stats = await indexProject('/chemin/projet', options);
if (stats.phase03Metrics) {
  console.log('Métriques Phase 0.3:', stats.phase03Metrics);
}
```

### search_code

L'outil de recherche utilise également la configuration :

```typescript
const limit = configManager.applyLimits('search_limit', args.limit || searchDefaults.limit);
const threshold = configManager.applyLimits('search_threshold', args.threshold || searchDefaults.threshold);
```

## 🧪 Tests de Configuration

### Script de Test d'Intégration

```bash
# Exécuter tous les tests de configuration
node test-config-integration.js
```

### Tests Inclus

1. **Test de chargement** : Vérifie que la configuration est valide
2. **Test des limites** : Vérifie la validation min/max
3. **Test des outils** : Vérifie que chaque outil utilise la configuration
4. **Test des valeurs par défaut** : Vérifie les valeurs par défaut

🧪 Test 1: Configuration RAG
✅ Configuration RAG valide
📊 Version: 1.0.0
📊 Fournisseurs disponibles: fake, ollama, sentence-transformers

🧪 Test 2: Gestionnaire de configuration
📊 Limites chunk_size: 100-10000
📊 Validation chunk_size 500: ✅
📊 Validation chunk_size 50000: ❌ (attendu: false)

🧪 Test 3: Outil index_project
✅ Test index_project réussi

🎉 TOUS LES TESTS ONT RÉUSSI !

```
### Exemple de Sortie de Test avec Phase 0.3

```

🚀 Démarrage des tests d'intégration RAG

🧪 Test 1: Configuration RAG
✅ Configuration RAG valide
📊 Version: 1.0.0
📊 Fournisseurs disponibles: fake, ollama, sentence-transformers
🧠 Phase 0.3: DÉSACTIVÉ (feature flag)

🧪 Test 2: Gestionnaire de configuration
📊 Limites chunk_size: 100-10000
📊 Validation chunk_size 500: ✅
📊 Validation chunk_size 50000: ❌ (attendu: false)

🧪 Test 3: Outil index_project
✅ Test index_project réussi

🧪 Test 4: Phase 0.3 - LLM Enrichment
🧠 Phase 0.3 activée: ollama/llama3.1:latest
📊 Chunks traités: 15
📊 Chunks enrichis: 14
📊 Taux succès: 93.3%
📊 Temps moyen: 245ms
✅ Test Phase 0.3 réussi

🎉 TOUS LES TESTS ONT RÉUSSI !

```
============================================================

🧪 Test 1: Configuration RAG
✅ Configuration RAG valide
📊 Version: 1.0.0
📊 Fournisseurs disponibles: fake, ollama, sentence-transformers

🧪 Test 2: Gestionnaire de configuration
📊 Limites chunk_size: 100-10000
📊 Validation chunk_size 500: ✅
📊 Validation chunk_size 50000: ❌ (attendu: false)

🧪 Test 3: Outil index_project
✅ Test index_project réussi

🎉 TOUS LES TESTS ONT RÉUSSI !
```

## ⚙️ Personnalisation

### Modifier la Configuration

1. Éditez `config/rag-config.json`
2. Ajoutez de nouveaux fournisseurs dans la section `providers`
3. Ajustez les limites dans la section `limits`
4. Modifiez les valeurs par défaut dans la section `defaults`

### Ajouter un Nouveau Fournisseur

```json
"providers": {
  "nouveau-fournisseur": {
    "description": "Description du fournisseur",
    "models": ["modele-1", "modele-2"],
    "requires_ollama": false,
    "endpoint": "http://localhost:8080"
  }
}
```

### Configurer la Phase 0.3

Pour activer la Phase 0.3, modifiez la section `phase0_3` :

```json
"phase0_3": {
  "enabled": true,
  "provider": "ollama",
  "model": "llama3.1:latest",
  "temperature": 0.1,
  "max_tokens": 1000,
  "timeout_ms": 30000,
  "batch_size": 5,
  "features": ["summary", "keywords", "entities", "complexity", "category"],
  "cache_enabled": true,
  "cache_ttl_seconds": 7200
}
```

**Remarque :** Assurez-vous que Ollama est en cours d'exécution si vous utilisez le provider `ollama` :

```bash
ollama serve
```

### Ajuster les Limites

```json
"limits": {
  "chunk_size": {
    "min": 50,      // Nouvelle valeur minimum
    "max": 20000,   // Nouvelle valeur maximum
    "default": 1500 // Nouvelle valeur par défaut
  }
}
```

## 🔍 API du Gestionnaire de Configuration

### Méthodes Principales

```typescript
// Charger la configuration
const configManager = getRagConfigManager();

// Récupérer la configuration complète
const config = configManager.getConfig();

// Récupérer les valeurs par défaut
const defaults = configManager.getDefaults();

// Récupérer les limites d'un paramètre
const limits = configManager.getLimits('chunk_size');

// Valider une valeur
const isValid = configManager.validateValue('chunk_size', 500);

// Appliquer les limites (ajuste automatiquement)
const adjustedValue = configManager.applyLimits('chunk_size', 50); // → 100

// Récupérer les modèles d'un fournisseur
const models = configManager.getProviderModels('ollama');
```

### Singleton Pattern

Le gestionnaire utilise un pattern singleton pour éviter de charger plusieurs fois la configuration :

```typescript
// Première utilisation : charge la configuration
const manager1 = getRagConfigManager();

// Utilisations suivantes : réutilise l'instance existante
const manager2 = getRagConfigManager(); // Même instance que manager1
```

## 🚀 Intégration avec Cline

### Configuration Cline MCP

Ajoutez cette configuration à `~/.config/cline/cline_mcp_settings.json` :

```json
{
  "mcpServers": {
    "rag-mcp-server": {
      "command": "node",
      "args": ["/chemin/absolu/vers/rag-mcp-server/build/index.js"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Vérification de l'Intégration

1. Redémarrez Cline
2. Vérifiez que rag-mcp-server apparaît dans les serveurs MCP
3. Testez avec un outil RAG :

```bash
# Via l'interface Cline
use_mcp_tool("rag-mcp-server", "index_project", {
  "project_path": "/chemin/vers/projet"
})
```

## 🐛 Dépannage

### Problèmes Courants

#### Configuration Non Chargée

```
❌ Erreur lors du chargement de la configuration RAG
```

**Solution** : Vérifiez que `config/rag-config.json` existe et est un JSON valide.

#### Valeurs Hors Limites

```
⚠️ Valeur chunk_size (50) inférieure au minimum (100)
```

**Solution** : La valeur est automatiquement ajustée au minimum. Ajustez la valeur fournie.

#### Fournisseur Inconnu

```
❌ Fournisseur d'embeddings inconnu: 'inconnu'
```

**Solution** : Utilisez un fournisseur de la liste : `fake`, `ollama`, `sentence-transformers`

#### Erreur Phase 0.3

```
❌ Erreur Phase 0.3: LLM API timeout
```

**Solution** : Vérifiez que Ollama est en cours d'exécution si vous utilisez le provider `ollama` :

```bash
ollama serve
```

#### JSON Parsing Error Phase 0.3

```
❌ Sortie LLM invalide: Invalid JSON format
```

**Solution** : Réduisez la température ou vérifiez le prompt système dans `src/rag/phase0/llm-enrichment/prompts.ts`

### Logs de Débogage

Activez les logs détaillés dans la configuration :

```json
"environments": {
  "development": {
    "verbose_logging": true,
    "cache_enabled": false
  }
}
```

## 📈 Métriques de Performance

La configuration centralisée améliore :

- **Maintenabilité** : Un seul endroit pour modifier les paramètres
- **Cohérence** : Tous les outils utilisent les mêmes valeurs
- **Sécurité** : Validation automatique des limites
- **Testabilité** : Tests d'intégration complets

### Métriques Phase 0.3

La Phase 0.3 ajoute des métriques d'enrichissement détaillées :

- **Qualité** : Taux de succès d'enrichissement, confiance moyenne
- **Performance** : Temps d'enrichissement, latence LLM
- **Utilisation** : Modèles utilisés, fonctionnalités activées
- **Fiabilité** : Taux d'erreur, timeouts, validations échouées

Ces métriques permettent d'optimiser :

- Choix du modèle LLM
- Taille des batches
- Configuration du cache
- Timeouts et retries

## 🔄 Mises à Jour

### Procédure de Mise à Jour

1. Sauvegardez l'ancienne configuration
2. Copiez la nouvelle configuration
3. Exécutez les tests d'intégration
4. Vérifiez la rétrocompatibilité

### Versioning

- **Version majeure** : Changements incompatibles
- **Version mineure** : Nouvelles fonctionnalités
- **Patch** : Corrections de bugs

---

**Dernière mise à jour** : 15/01/2026  
**Auteur** : Système de Configuration RAG  
**Statut** : Production Ready ✅  
**Phase 0.3** : Disponible (feature flag)
