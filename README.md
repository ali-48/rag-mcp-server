# RAG MCP Server

Un serveur MCP (Model Context Protocol) qui combine un graphe de connaissances avec des fonctionnalités RAG (Retrieval-Augmented Generation) pour l'indexation et la recherche sémantique de code.

## 🚀 Fonctionnalités

### 📋 MCP Server - Commandes simplifiées

#### 🎯 Graphe de connaissances (Graph Tools) - 9 outils

Ces commandes sont intégrées en arrière-plan dans l'injection RAG pour enrichissement automatique des connaissances (Phase 0).

- **`create_entities`** : Crée de nouvelles entités
- **`create_relations`** : Crée des relations entre entités
- **`add_observations`** : Ajoute des observations aux entités
- **`delete_entities`** : Supprime des entités
- **`delete_observations`** : Supprime des observations
- **`delete_relations`** : Supprime des relations
- **`read_graph`** : Lit tout le graphe
- **`search_nodes`** : Recherche des nœuds
- **`open_nodes`** : Ouvre des nœuds spécifiques

#### 🔍 Recherche sémantique (RAG Tools) - 4 outils visibles + 1 masqué

Les paramètres LLM et autres configurations sont préconfigurés par défaut, aucune sélection manuelle nécessaire.

- **`injection_rag`** (anciennement `index_project`) : Analyse du projet complet + prépare et injecte les données automatiquement (Phase 0 → RAG) - **Outil principal**
- **`search_code`** : Recherche sémantique dans le code
- **`manage_projects`** : Gère les projets indexés
- **`update_project`** : Réindexation incrémentale pour mise à jour des données

**Outil masqué (rétrocompatibilité)** :

- **`index_project`** : Alias déprécié pour `injection_rag` - masqué de la liste mais fonctionnel si appelé directement

#### 🧠 Analyse LLM Intelligente (Intégration Ollama)

Le serveur inclut désormais une analyse LLM intelligente pour améliorer la préparation des données :

- **Analyse automatique** : Utilisation d'Ollama pour analyser le contenu avant indexation
- **Tâches intelligentes** : Résumé, extraction de mots-clés, suggestion de structure, détection d'entités, classification de complexité
- **Cache LLM** : Système de cache pour éviter les appels redondants à Ollama
- **Configuration flexible** : Support de multiples modèles LLM via configuration
- **Batch processing** : Traitement par lots pour optimisation des performances

**Fonctionnalités LLM** :

- ✅ Analyse sémantique du contenu avant segmentation
- ✅ Cache intelligent avec TTL configurable
- ✅ Support de multiples modèles Ollama
- ✅ Traitement par lots pour optimisation
- ✅ Intégration transparente avec le pipeline RAG existant

## 🏗️ Architecture

### Système ToolRegistry

Le serveur utilise un système centralisé `ToolRegistry` qui permet :

- **Enregistrement automatique** : Découverte dynamique des outils via convention de nommage
- **Gestion centralisée** : Tous les outils sont gérés dans un registre unique
- **Exécution unifiée** : Interface cohérente pour l'exécution de tous les outils

### Structure des Outils

Chaque outil est composé de deux parties :

1. **Définition** (`*Tool`) : Schéma d'entrée et métadonnées
2. **Handler** (`*Handler`) : Fonction d'exécution de l'outil

### Enregistrement Automatique

Le système découvre automatiquement les outils dans :

- `src/tools/graph/` : Outils de graphe de connaissances
- `src/tools/rag/` : Outils RAG

## 📦 Installation

```bash
# Cloner le dépôt
git clone <repository-url>
cd rag-mcp-server

# Installer les dépendances
npm install

# Construire le projet
npm run build
```

## 🚀 Utilisation

### Démarrage du serveur

```bash
npm start
```

### Développement

```bash
# Mode développement avec rechargement automatique
npm run dev
```

## 🧪 Tests

Le projet inclut une suite complète de tests :

```bash
# Exécuter tous les tests
node run-all-tests.js

# Tests individuels
node test-basic.js
node test-tool-registry.js
node test-batch1.js
node test-batch2.js
node test-batch3.js
node test-rag.js
node test-auto-registry.js
node test-index-integration.js
node test-config-integration.js
node test-llm-config.js
node test-ollama-integration.js
```

### Tests LLM (Nouveau)

- **`test-llm-config.js`** : Teste le chargement de la configuration LLM et le fonctionnement du service
- **`test-ollama-integration.js`** : Teste l'intégration réelle avec Ollama (nécessite Ollama en cours d'exécution)

Pour tester l'intégration Ollama :

```bash
# Vérifier qu'Ollama est en cours d'exécution
ollama serve

# Exécuter les tests LLM
node test-llm-config.js
node test-ollama-integration.js
```

## 🛠️ Structure du Projet

```
rag-mcp-server/
├── src/
│   ├── config/
│   │   └── rag-config.ts         # Gestionnaire de configuration centralisée
│   ├── core/
│   │   ├── tool-registry.ts      # Système central d'enregistrement des outils
│   │   └── registry.ts           # Enregistrement automatique des outils
│   ├── tools/
│   │   ├── graph/                # Outils de graphe de connaissances
│   │   │   ├── create-entities.ts
│   │   │   ├── create-relations.ts
│   │   │   ├── add-observations.ts
│   │   │   ├── delete-entities.ts
│   │   │   ├── delete-observations.ts
│   │   │   ├── delete-relations.ts
│   │   │   ├── read-graph.ts
│   │   │   ├── search-nodes.ts
│   │   │   └── open-nodes.ts
│   │   └── rag/                  # Outils RAG
│   │       ├── injection-rag.ts  # Outil principal (anciennement index-project)
│   │       ├── index-project.ts  # Alias déprécié (rétrocompatibilité)
│   │       ├── search-code.ts
│   │       ├── manage-projects.ts
│   │       └── update-project.ts
│   ├── knowledge-graph/          # Gestionnaire de graphe de connaissances
│   ├── rag/                      # Composants RAG (indexation, recherche, LLM)
│   │   ├── indexer.ts            # Indexation avec support LLM
│   │   ├── searcher.ts           # Recherche sémantique
│   │   ├── vector-store.ts       # Stockage vectoriel
│   │   ├── ignore-filter.ts      # Filtrage des fichiers
│   │   ├── types.ts              # Types RAG
│   │   ├── llm-service.ts        # Service LLM pour analyse intelligente (Nouveau)
│   │   ├── llm-cache.ts          # Cache LLM pour optimisation (Nouveau)
│   │   └── ai-segmenter.ts       # Segmentation intelligente avec LLM (Nouveau)
│   └── index.ts                  # Point d'entrée principal
├── config/
│   └── rag-config.json           # Configuration centrale
├── build/                        # Fichiers compilés
├── test-*.js                     # Fichiers de test
└── package.json
```

## 🔧 Configuration

### Système de Configuration RAG Centralisée

Le serveur utilise désormais un système de configuration centralisée avec validation des limites :

#### Fichier de Configuration

- **`config/rag-config.json`** : Configuration principale avec valeurs par défaut, limites et fournisseurs
- **`src/config/rag-config.ts`** : Gestionnaire TypeScript pour charger et valider la configuration

#### Fonctionnalités de Configuration

- **Valeurs par défaut** : Paramètres prédéfinis pour tous les outils
- **Limites de validation** : Bornes min/max pour les paramètres numériques
- **Fournisseurs d'embeddings** : Support pour `fake`, `ollama`, `sentence-transformers`
- **Fournisseurs LLM** : Support pour `ollama` avec modèles configurables
- **Configuration de préparation** : Analyse LLM intelligente avec cache
- **Modèles par défaut** : Configuration par fournisseur
- **Environnements** : Configuration différente pour développement/production

#### Configuration LLM (Nouveau)

Le serveur supporte désormais l'analyse LLM intelligente via Ollama :

```json
"llm_providers": {
  "ollama": {
    "description": "LLM Ollama pour analyse et préparation intelligente",
    "models": ["llama3.1:latest", "qwen2.5:7b", "mistral:7b"],
    "endpoint": "http://localhost:11434",
    "default_model": "llama3.1:latest",
    "requires_ollama": true,
    "max_tokens": 4096,
    "temperature": 0.1,
    "timeout_ms": 30000
  }
},
"preparation": {
  "enable_llm_analysis": true,
  "llm_provider": "ollama",
  "llm_model": "llama3.1:latest",
  "tasks": ["summarize", "extract_keywords", "suggest_structure", "detect_entities", "classify_complexity"],
  "cache_enabled": true,
  "cache_ttl_seconds": 3600,
  "batch_size": 5,
  "max_content_length": 10000
}
```

#### Utilisation dans les Outils

Tous les outils RAG utilisent automatiquement la configuration :

- `injection_rag` : Utilise les valeurs par défaut pour embedding_provider, embedding_model, chunk_size, chunk_overlap
- `update_project` : Même configuration que injection_rag
- `search_code` : Utilise les limites de recherche et seuils de similarité
- `ai-segmenter` : Utilise l'analyse LLM quand activée dans la configuration
- Les valeurs fournies par l'utilisateur sont validées par rapport aux limites

#### Simplification des Schémas d'Entrée

Les outils RAG ont été simplifiés pour une meilleure expérience utilisateur :

- **`search_code`** : Paramètres simplifiés - seul `query` est requis, les autres paramètres (limit, threshold, embedding_provider, embedding_model) sont gérés par la configuration
- **`injection_rag`** : Paramètres simplifiés - `project_path` requis, les paramètres embedding (embedding_provider, embedding_model, chunk_size, chunk_overlap) sont gérés par la configuration
- **`update_project`** : Paramètres simplifiés - `project_path` requis, les paramètres embedding sont gérés par la configuration

Cette simplification permet une utilisation plus intuitive tout en maintenant la flexibilité via la configuration centralisée.

### Options d'Indexation RAG

- **Fournisseurs d'embeddings** : `fake`, `ollama`, `sentence-transformers`
- **Modèles** : `nomic-embed-text`, `all-minilm`, etc.
- **Taille des chunks** : Configurable (défaut: 1000 tokens, limites: 100-10000)
- **Chevauchement** : Configurable (défaut: 200 tokens, limites: 0-1000)
- **Limites de recherche** : 1-50 résultats (défaut: 10)
- **Seuil de similarité** : 0.0-1.0 (défaut: 0)

### Fichiers d'Ignorance

Le système supporte les fichiers `.ragignore` pour exclure des fichiers de l'indexation :

- Syntaxe similaire à `.gitignore`
- Patterns glob supportés
- Priorité : `.ragignore` local > templates prédéfinis

### Configuration Cline MCP

Pour utiliser rag-mcp-server avec Cline, ajoutez cette configuration à `cline_mcp_settings.json` :

```json
{
  "mcpServers": {
    "rag-mcp-server": {
      "command": "node",
      "args": ["/chemin/vers/rag-mcp-server/build/index.js"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## 📊 Métriques

- **13 outils visibles** (9 graph + 4 RAG) + **1 outil masqué** pour rétrocompatibilité
  - 9 outils Graph de connaissances
  - 4 outils RAG visibles (dont `injection_rag` comme outil principal)
  - 1 outil RAG masqué (`index_project` - alias déprécié)
- **Enregistrement automatique** au démarrage
- **Rétrocompatibilité** maintenue avec l'ancien système
- **Tests complets** avec couverture de 87.5%
- **Configuration centralisée** avec validation des limites
- **Tests d'intégration** complets pour la configuration RAG

### Tests de Configuration

Le projet inclut un script de test d'intégration complet :

```bash
# Tester la configuration RAG
node test-config-integration.js
```

Ce script valide :

1. ✅ Chargement de la configuration
2. ✅ Gestionnaire de configuration
3. ✅ Outils utilisant la configuration
4. ✅ Validation des limites
5. ✅ Tests fonctionnels des outils

### Tests LLM (Nouveau)

Les tests LLM vérifient l'intégration complète avec Ollama :

```bash
# Tester la configuration LLM
node test-llm-config.js

# Tester l'intégration Ollama (nécessite Ollama en cours d'exécution)
node test-ollama-integration.js
```

**Tests LLM inclus** :

1. ✅ Chargement de la configuration LLM
2. ✅ Configuration des fournisseurs LLM (Ollama)
3. ✅ Configuration de préparation avec cache
4. ✅ Service LLM avec vérification de disponibilité
5. ✅ Cache LLM avec statistiques
6. ✅ Intégration complète avec Ollama (appels réels)

**Prérequis pour les tests Ollama** :

- Ollama doit être en cours d'exécution (`ollama serve`)
- Modèle `llama3.1:latest` ou autre modèle configuré doit être disponible

## 🤝 Contribution

1. Fork le projet
2. Créer une branche (`git checkout -b feature/amazing-feature`)
3. Commit les changements (`git commit -m 'Add amazing feature'`)
4. Push vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 🙏 Remerciements

- [Model Context Protocol](https://modelcontextprotocol.io/) pour le framework MCP
- L'équipe de développement pour les contributions
- La communauté open source pour les outils et bibliothèques utilisés

---

**Dernière mise à jour** : 28/12/2025  
**Version** : 1.5.0  
**Statut** : Production Ready avec Analyse LLM Intelligente 🧠🚀

### Changelog v1.5.0

- **Nouveau** : Analyse LLM intelligente avec intégration Ollama
- **Nouveau** : Service LLM (`LlmService`) pour appels à l'API Ollama
- **Nouveau** : Cache LLM (`LlmCache`) pour optimisation des performances
- **Nouveau** : Configuration LLM dans `rag-config.json` avec fournisseurs et préparation
- **Nouveau** : Tâches intelligentes : résumé, extraction de mots-clés, suggestion de structure, détection d'entités, classification de complexité
- **Nouveau** : Intégration dans `ai-segmenter.ts` pour segmentation intelligente
- **Nouveau** : Intégration dans `indexer.ts` avec cache LLM
- **Nouveau** : Tests de configuration LLM (`test-llm-config.js`)
- **Nouveau** : Tests d'intégration Ollama (`test-ollama-integration.js`)
- **Amélioration** : Support de multiples modèles Ollama configurables
- **Amélioration** : Batch processing pour optimisation des appels LLM
- **Amélioration** : Cache intelligent avec TTL configurable
- **Amélioration** : Documentation complète des fonctionnalités LLM

### Changelog v1.4.0

- **Nouveau** : Simplification des schémas d'entrée des outils RAG
- **Nouveau** : Paramètres embedding (embedding_provider, embedding_model, chunk_size, chunk_overlap) gérés automatiquement par la configuration
- **Simplification** : `search_code` - seul `query` requis, autres paramètres gérés par configuration
- **Simplification** : `injection_rag` - `project_path` requis, paramètres embedding gérés par configuration
- **Simplification** : `update_project` - `project_path` requis, paramètres embedding gérés par configuration
- **Amélioration** : Meilleure expérience utilisateur avec moins de paramètres requis
- **Amélioration** : Tests complets validant la simplification
- **Amélioration** : Documentation mise à jour avec détails sur la simplification

### Changelog v1.3.0

- **Nouveau** : Système de masquage des outils avec flag `hidden`
- **Nouveau** : `index_project` masqué de la liste des outils visibles (rétrocompatibilité maintenue)
- **Nouveau** : Filtrage automatique des outils masqués dans `ListToolsRequestSchema`
- **Nouveau** : Tri des outils avec `injection_rag` en premier
- **Amélioration** : Comptage RAG corrigé (13 outils visibles : 9 graph + 4 RAG)
- **Amélioration** : Tests mis à jour pour vérifier la visibilité des outils
- **Amélioration** : Documentation mise à jour avec métriques précises

### Changelog v1.2.0

- **Nouveau** : Outil `injection_rag` - Pipeline automatisé Phase 0 → RAG
- **Nouveau** : Intégration automatique Graph → RAG (enrichissement Phase 0)
- **Nouveau** : Système de logs détaillés avec niveaux (INFO, DEBUG, ERROR)
- **Nouveau** : Script wrapper `scripts/injection-rag.sh` pour usage CLI
- **Nouveau** : Test complet de pipeline `test-pipeline-complet.js`
- **Migration** : `index_project` devient alias déprécié de `injection_rag`
- **Amélioration** : Configuration LLM préconfigurée par défaut
- **Amélioration** : Vérification automatique des permissions et sécurité
- **Amélioration** : Documentation simplifiée et unifiée

### Changelog v1.1.0

- **Nouveau** : Système de configuration RAG centralisée
- **Nouveau** : Gestionnaire de configuration TypeScript avec validation
- **Nouveau** : Limites automatiques pour les paramètres numériques
- **Nouveau** : Script de test d'intégration complet
- **Amélioration** : Tous les outils RAG utilisent la configuration
- **Amélioration** : Documentation mise à jour
- **Fix** : Validation des valeurs hors limites
