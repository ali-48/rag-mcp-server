# RAG MCP Server

Un serveur MCP (Model Context Protocol) qui combine un graphe de connaissances avec des fonctionnalités RAG (Retrieval-Augmented Generation) pour l'indexation et la recherche sémantique de code.

## 🚀 Fonctionnalités

### Outils Graph (Graphe de Connaissances)

- **`create_entities`** : Créer de nouvelles entités dans le graphe
- **`create_relations`** : Créer des relations entre entités
- **`add_observations`** : Ajouter des observations aux entités existantes
- **`delete_entities`** : Supprimer des entités et leurs relations
- **`delete_observations`** : Supprimer des observations spécifiques
- **`delete_relations`** : Supprimer des relations
- **`read_graph`** : Lire l'ensemble du graphe
- **`search_nodes`** : Rechercher des nœuds par requête sémantique
- **`open_nodes`** : Ouvrir des nœuds spécifiques par nom

### Outils RAG (Recherche et Indexation)

- **`index_project`** : Indexer un projet complet pour la recherche sémantique
- **`search_code`** : Recherche sémantique dans le code indexé
- **`manage_projects`** : Gérer et lister les projets indexés
- **`update_project`** : Mettre à jour l'indexation d'un projet

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
```

## 🛠️ Structure du Projet

```
rag-mcp-server/
├── src/
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
│   │       ├── index-project.ts
│   │       ├── search-code.ts
│   │       ├── manage-projects.ts
│   │       └── update-project.ts
│   ├── knowledge-graph/          # Gestionnaire de graphe de connaissances
│   ├── rag/                      # Composants RAG (indexation, recherche)
│   └── index.ts                  # Point d'entrée principal
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
- **Modèles par défaut** : Configuration par fournisseur
- **Environnements** : Configuration différente pour développement/production

#### Utilisation dans les Outils

Tous les outils RAG utilisent automatiquement la configuration :

- `index_project` : Utilise les valeurs par défaut pour chunk_size, embedding_provider, etc.
- `update_project` : Même configuration que index_project
- `search_code` : Utilise les limites de recherche et seuils de similarité
- Les valeurs fournies par l'utilisateur sont validées par rapport aux limites

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

- **13 outils disponibles** (9 graph + 4 RAG)
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
**Version** : 1.1.0  
**Statut** : Production Ready avec Configuration Centralisée 🚀

### Changelog v1.1.0

- **Nouveau** : Système de configuration RAG centralisée
- **Nouveau** : Gestionnaire de configuration TypeScript avec validation
- **Nouveau** : Limites automatiques pour les paramètres numériques
- **Nouveau** : Script de test d'intégration complet
- **Amélioration** : Tous les outils RAG utilisent la configuration
- **Amélioration** : Documentation mise à jour
- **Fix** : Validation des valeurs hors limites
