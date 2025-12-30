# Schéma RAG Store v2.0.0

## 📋 Vue d'ensemble

Le schéma `rag_store_v2` est une version étendue de la table originale `rag_store` avec support pour :

- **Typage de contenu** (code, doc, config, other)
- **Gestion des chunks** (indexation multi-chunks par fichier)
- **Métadonnées enrichies** (extension, taille, lignes, langage)
- **Rôles** (core, helper, test, example, template)
- **Versionnement** et historique des modifications
- **Compression** pour contenus volumineux

## 🗃️ Structure de la table

### Colonnes principales

| Colonne | Type | Description | Contraintes |
|---------|------|-------------|-------------|
| `id` | TEXT PRIMARY KEY | Identifiant unique: `projet:fichier#chunkIndex` | |
| `project_path` | TEXT NOT NULL | Chemin absolu du projet | |
| `file_path` | TEXT NOT NULL | Chemin relatif du fichier | |
| `chunk_index` | INTEGER NOT NULL | Index du chunk (0-based) | `>= 0` |
| `total_chunks` | INTEGER NOT NULL | Nombre total de chunks dans le fichier | `>= 1` |
| `content` | TEXT NOT NULL | Contenu textuel du chunk | |
| `content_type` | TEXT NOT NULL | Type de contenu | `IN ('code', 'doc', 'config', 'other')` |
| `role` | TEXT | Rôle du chunk | `IN ('core', 'helper', 'test', 'example', 'template', 'other')` |
| `file_extension` | TEXT | Extension du fichier (sans le point) | |
| `file_size_bytes` | INTEGER | Taille originale en bytes | |
| `lines_count` | INTEGER | Nombre de lignes dans le chunk | |
| `language` | TEXT | Langage de programmation (pour code) | |
| `vector` | VECTOR(4096) NOT NULL | Embedding vector (Qwen3-Embedding) | |
| `is_compressed` | BOOLEAN | Si le contenu est compressé | `DEFAULT FALSE` |
| `original_size_bytes` | INTEGER | Taille originale avant compression | |
| `version` | INTEGER | Numéro de version | `DEFAULT 1` |
| `parent_id` | TEXT | Référence au chunk parent | `REFERENCES rag_store_v2(id)` |
| `created_at` | TIMESTAMPTZ | Date de création | `DEFAULT NOW()` |
| `updated_at` | TIMESTAMPTZ | Date de mise à jour | `DEFAULT NOW()` |
| `indexed_at` | TIMESTAMPTZ | Date d'indexation | `DEFAULT NOW()` |

### Contraintes

1. `valid_chunk_index` : `chunk_index >= 0`
2. `valid_total_chunks` : `total_chunks >= 1 AND chunk_index < total_chunks`
3. `content_type` : Doit être l'une des valeurs autorisées
4. `role` : Doit être l'une des valeurs autorisées (nullable)

## 🗂️ Index

### Index principaux

- `idx_rag_store_v2_project_path` : Recherche par projet
- `idx_rag_store_v2_content_type` : Filtrage par type de contenu
- `idx_rag_store_v2_role` : Filtrage par rôle
- `idx_rag_store_v2_file_extension` : Recherche par extension
- `idx_rag_store_v2_vector` : Index IVFFlat pour recherche vectorielle (lists=100)
- `idx_rag_store_v2_project_content_type` : Composite projet + type
- `idx_rag_store_v2_project_file` : Composite projet + fichier

### Index temporels

- `idx_rag_store_v2_created_at` : Tri par date de création
- `idx_rag_store_v2_updated_at` : Tri par date de mise à jour

## 📊 Vues

### `rag_store_v2_stats`

Statistiques agrégées par projet, type de contenu et rôle :

- Nombre total de chunks
- Nombre total de fichiers
- Longueur moyenne du contenu
- Dates de première indexation et dernière mise à jour
- Nombre de chunks compressés

### `rag_store_v2_coverage`

Monitoring de la couverture par projet :

- Nombre de fichiers indexés
- Nombre total de chunks
- Date de dernière indexation
- Pourcentage estimé de couverture (à calculer)

## 🔧 Fonctions et Triggers

### `update_updated_at_column()`

Fonction PL/pgSQL pour mettre à jour automatiquement `updated_at` avant chaque UPDATE.

### `search_rag_store_v2()`

Fonction de recherche avec filtres :

```sql
SELECT * FROM search_rag_store_v2(
  query_vector => '[0.1, 0.2, ...]'::VECTOR(4096),
  p_project_path => '/chemin/projet',
  p_content_type => 'code',
  p_role => 'core',
  p_limit => 10,
  p_threshold => 0.3
);
```

### Trigger `update_rag_store_v2_updated_at`

Déclenché avant chaque UPDATE pour mettre à jour `updated_at`.

## 📜 Table d'historique

### `rag_store_v2_history`

Stocke l'historique des modifications pour le versionnement :

- `chunk_id` : Référence au chunk modifié
- `version` : Numéro de version
- `content` : Contenu à cette version
- `vector` : Embedding à cette version
- `changed_at` : Date du changement
- `change_type` : Type de modification (created, updated, deleted)
- `change_reason` : Raison du changement

## 🚀 Migration depuis rag_store

Un script de migration est inclus dans `create_rag_store_v2.sql` (section commentée). Pour migrer :

1. Exécuter le script de création
2. Décommenter et exécuter la section `DO $$ ... END $$;`
3. Vérifier la migration avec `SELECT COUNT(*) FROM rag_store_v2;`

## 🎯 Utilisation avec Qwen3-Embedding

### Dimension des vecteurs

- **Qwen3-Embedding:8b** : 4096 dimensions
- **Anciens modèles** : 768 dimensions (nomic-embed-text)

### Normalisation

Les embeddings Qwen3 sont déjà normalisés L2 (norme = 1.0), idéal pour la similarité cosinus.

### Configuration

Mettre à jour `config/rag-config.json` :

```json
{
  "defaults": {
    "embedding_provider": "ollama",
    "embedding_model": "qwen3-embedding:8b"
  }
}
```

## 📈 Performances

### Optimisations

1. **Index IVFFlat** : Optimisé pour la recherche par similarité cosinus
2. **Index composites** : Pour les requêtes filtrées fréquentes
3. **Partitionnement** : Possible par `project_path` pour grands volumes
4. **Compression** : Optionnelle pour contenus > 10KB

### Recommandations

- Ajuster `lists` dans l'index IVFFlat selon la taille des données
- Utiliser les vues matérialisées pour les statistiques fréquentes
- Implémenter le nettoyage périodique de l'historique

## 🔄 Workflow d'indexation

1. **Phase 0** : Détection du type de contenu et segmentation
2. **Génération d'embedding** : Avec Qwen3-Embedding (4096 dimensions)
3. **Insertion SQL** : Dans `rag_store_v2` avec métadonnées
4. **Recherche** : Via `search_rag_store_v2()` avec filtres

## 📝 Exemples d'utilisation

### Insertion d'un chunk

```sql
INSERT INTO rag_store_v2 (
  id, project_path, file_path, chunk_index, total_chunks,
  content, content_type, role, file_extension,
  file_size_bytes, lines_count, language, vector
) VALUES (
  '/home/project:src/main.js#0',
  '/home/project',
  'src/main.js',
  0, 3,
  'function main() { ... }',
  'code', 'core', 'js',
  1024, 25, 'javascript',
  '[0.1, 0.2, ...]'::VECTOR(4096)
);
```

### Recherche sémantique avec filtres

```sql
SELECT * FROM search_rag_store_v2(
  query_vector => (SELECT vector FROM rag_store_v2 WHERE id = 'reference'),
  p_content_type => 'code',
  p_role => 'core',
  p_limit => 5
);
