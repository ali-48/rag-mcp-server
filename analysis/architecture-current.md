# Analyse de l'Architecture Actuelle - RAG MCP Server

## 📊 Vue d'Ensemble

**Projet** : rag-mcp-server  
**Version** : 1.0.0  
**Dernière mise à jour** : 28/12/2025  
**État** : Système RAG "outil par outil" avec 5 outils exposés

## 🛠️ Outils Exposés au LLM (5 outils)

### 1. `injection_rag` - Outil Principal

- **Rôle** : Analyse complète du projet + injection automatique
- **Remplace** : `index_project` (alias déprécié)
- **Pipeline** : Phase 0.1 → Phase 1 → Phase 2
- **Fichier** : `src/tools/rag/injection-rag.ts`

### 2. `search_code` - Recherche Sémantique

- **Rôle** : Recherche dans le code indexé
- **Fichier** : `src/tools/rag/search-code.ts`

### 3. `manage_projects` - Gestion Projets

- **Rôle** : Lister les projets indexés + statistiques
- **Fichier** : `src/tools/rag/manage-projects.ts`

### 4. `update_project` - Mise à Jour Incrémentale

- **Rôle** : Indexation incrémentale basée sur Git
- **Fichier** : `src/tools/rag/update-project.ts`

### 5. `index_project` - Alias Déprécié

- **Rôle** : Alias de `injection_rag` pour rétrocompatibilité
- **Statut** : Masqué dans le registre

## 🏗️ Architecture des Composants

### 1. **Tool Registry System** (`src/core/`)

- `tool-registry.ts` : Registre central des outils MCP
- `registry.ts` : Enregistrement automatique des outils
- **Pattern** : Chaque outil = `{name}Tool` + `{name}Handler`

### 2. **Pipeline RAG Principal** (`src/rag/`)

- `indexer.ts` : Indexation principale (`indexProject`, `updateProject`)
- `vector-store.ts` : Gestion embeddings + stockage PostgreSQL
- `content-detector.ts` : Détection type contenu + langage
- `code-preprocessor.ts` : Pré-traitement code (AST basique)
- `ai-segmenter.ts` : Chunking intelligent avec suggestions IA

### 3. **Phase 0 - Nouveaux Outils** (`src/rag/phase0/`)

- `phase0-integration.ts` : Intégration workspace + file watcher
- `chunker-integration.ts` : Intégration chunking intelligent
- `llm-enrichment/` : Enrichissement LLM optionnel (Phase 0.3)

### 4. **Configuration** (`src/config/`)

- `rag-config.ts` : Gestionnaire de configuration
- `rag-config.json` : Fichier de configuration principal

## 🔄 Flux de Données Actuel

### Pipeline `injection_rag`

```
1. Vérification permissions (Phase 0)
2. Chargement configuration
3. Phase 0.1 : Workspace detection + File watcher
4. Phase 1 : Intégration graphe connaissances (optionnel)
5. Configuration embeddings
6. Phase 2 : Injection RAG principale (indexProject)
7. Retour statistiques
```

### Pipeline `indexProject`

```
1. Initialisation cache LLM + Phase 0.3 (optionnel)
2. Scan fichiers avec fast-glob
3. Pour chaque fichier :
   a. Filtrage ignore patterns
   b. Détection type contenu (code/doc/config)
   c. Chunking intelligent (basé sur type)
   d. Enrichissement LLM Phase 0.3 (optionnel)
   e. Génération embeddings
   f. Stockage PostgreSQL
4. Retour statistiques
```

## 🗄️ Stockage de Données

### Base de données PostgreSQL

- **Table principale** : `rag_store` ou `rag_store_v2`
- **Schéma v2** : Métadonnées enrichies + compression
- **Champs clés** : `id`, `project_path`, `file_path`, `content`, `vector`, `metadata`

### Métadonnées Actuelles

```typescript
{
  chunkIndex: number,
  totalChunks: number,
  contentType: string,  // 'code', 'doc', 'config', 'other'
  language: string,     // 'typescript', 'python', etc.
  fileExtension: string,
  linesCount: number,
  role: string         // 'core', 'example', 'template'
}
```

## 🔧 Système d'Embeddings

### Configuration Actuelle

- **Provider** : `ollama` (par défaut)
- **Modèle** : `qwen3-embedding:8b`
- **Dimension** : 1024 (pour qwen3-embedding)

### Problèmes Identifiés

1. **Même modèle pour tous les types** : Code, doc, config utilisent le même embedding
2. **Chunking fixe** : 500 tokens par défaut, pas de chunking par unités logiques
3. **Pas de séparation sémantique** : Code et documentation mélangés

### Fonctionnalités Avancées

- **Cache embeddings** : Map avec limite 1000 entrées
- **Batching Ollama** : Traitement par lots (max 10)
- **Normalisation L2** : Vecteurs normalisés pour similarité cosinus
- **Fallback fake** : Embeddings factices si Ollama indisponible

## 📁 Structure des Fichiers

```
src/
├── index.ts                    # Point d'entrée MCP
├── config/rag-config.ts        # Gestion configuration
├── core/                       # Système registre outils
│   ├── registry.ts
│   └── tool-registry.ts
├── rag/                        # Pipeline RAG principal
│   ├── indexer.ts
│   ├── vector-store.ts
│   ├── content-detector.ts
│   ├── code-preprocessor.ts
│   ├── ai-segmenter.ts
│   └── phase0/                 # Nouveaux outils
│       ├── phase0-integration.ts
│       ├── chunker-integration.ts
│       └── llm-enrichment/
└── tools/rag/                  # Outils MCP exposés
    ├── injection-rag.ts
    ├── search-code.ts
    ├── manage-projects.ts
    ├── update-project.ts
    └── index-project.ts
```

## 🔗 Dépendances Clés

### Dépendances NPM Principales

- `@modelcontextprotocol/sdk` : SDK MCP
- `pg` : Client PostgreSQL
- `fast-glob` : Scan fichiers
- `zlib` : Compression
- Dépendances optionnelles : `chokidar`, `tree-sitter`

### Configuration Base de Données

```javascript
const pool = new Pool({
  host: "localhost",
  port: 5432,           // ou 16432 pour dédié
  database: "rag_db",   // ou "rag_mcp_dedicated"
  user: "rag_user",
  password: "rag_password" // ou "secure_rag_password"
});
```

## ⚠️ Problèmes Architecturaux Identifiés

### 1. **Multiplicité des Outils**

- 5 outils exposés au LLM
- Risque d'oubli d'étapes
- Ordre d'exécution non garanti
- UX complexe pour l'agent

### 2. **Embeddings Non Spécialisés**

- Même modèle pour code et documentation
- Perte de sémantique spécifique
- Recherche moins précise

### 3. **Chunking Sous-optimal**

- Taille fixe (500 tokens)
- Pas de respect des unités logiques
- Fonctions/code découpés arbitrairement

### 4. **Phase 0 Incomplète**

- Détection workspace basique
- Pas d'intégration tree-sitter
- File watcher optionnel

### 5. **Métadonnées Limitées**

- Pas de hash pour détection changements
- Pas de symbol extraction (fonctions, classes)
- Pas de relations entre chunks

## ✅ Points Forts à Conserver

### 1. **Architecture Modulaire**

- Séparation claire des responsabilités
- Système de registre flexible
- Configuration centralisée

### 2. **Pipeline Établi**

- Flux de travail testé
- Intégration PostgreSQL robuste
- Gestion erreurs complète

### 3. **Fonctionnalités Avancées**

- Cache embeddings
- Batching Ollama
- Compression automatique
- Re-ranking intelligent

### 4. **Rétrocompatibilité**

- Alias pour anciens outils
- Support multi-tables (v1/v2)
- Fallback graceful

## 🎯 Recommandations pour la Refonte

### Priorité 1 : Unifier les Outils

- Créer `activated_rag` comme outil maître
- Masquer les 4 autres outils
- Garder `recherche_rag` pour lecture seule

### Priorité 2 : Specialiser les Embeddings

- Modèles différents pour code vs texte
- Chunking par unités logiques
- Métadonnées enrichies

### Priorité 3 : Compléter Phase 0

- Intégration tree-sitter
- Détection workspace automatique
- File watcher temps réel

### Priorité 4 : Améliorer Métadonnées

- Hash pour détection changements
- Extraction symbols (AST)
- Relations entre entités

## 📈 Métriques de Référence

### Performance Actuelle

- **Temps indexation** : ~X ms/fichier (à mesurer)
- **Taille embeddings** : 1024 dimensions
- **Taille base** : ~Y Mo/projet (à mesurer)
- **Précision recherche** : ~Z% (à mesurer)

### Limitations Connues

- Pas de support multi-modèles
- Chunking non contextuel
- Pas d'analyse AST profonde
- Métadonnées limitées

---

**Document généré le** : 13/01/2026  
**Prochaine étape** : Conception de l'architecture `activated_rag`
