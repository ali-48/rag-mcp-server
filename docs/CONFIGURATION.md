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
  }
}
```

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

### Exemple de Sortie de Test

```
🚀 Démarrage des tests d'intégration RAG
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

**Dernière mise à jour** : 28/12/2025  
**Auteur** : Système de Configuration RAG  
**Statut** : Production Ready ✅
