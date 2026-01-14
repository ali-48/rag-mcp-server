# Migration du backend RAG de PostgreSQL vers SQLite

## Contexte

Le backend RAG utilisait initialement PostgreSQL avec l'extension pgvector pour le stockage vectoriel. Cette dépendance externe posait des problèmes de déploiement et de maintenance. La migration vers SQLite permet une solution embarquée, sans dépendances externes, tout en conservant les fonctionnalités RAG complètes.

## Changements d'architecture

### 1. Nouveau module de configuration DB (`src/config/db-config.ts`)

- **Rôle** : Gère la configuration des bases de données (memory, vectors, metadata)
- **Fonctionnalités** :
  - Chargement depuis `rag/config/db.config.json`
  - Connexions SQLite optimisées (WAL, cache)
  - Initialisation automatique des schémas
  - Test de connectivité

### 2. Backend SQLite vectoriel (`src/rag/vector-store-sqlite.ts`)

- **Rôle** : Implémente le stockage et la recherche vectorielle avec SQLite
- **Fonctionnalités** :
  - Stockage des embeddings en BLOB (Float32Array)
  - Similarité cosinus en JavaScript (avec gestion des dimensions variables)
  - CRUD complet pour les documents RAG
  - Filtrage avancé par métadonnées
  - Statistiques de projet

### 3. Adaptation du vector store principal (`src/rag/vector-store-refactored.ts`)

- **Rôle** : Point d'entrée unifié avec routage automatique vers SQLite
- **Changements** :
  - Remplacement des imports PostgreSQL par SQLite
  - Adaptation des requêtes SQL
  - Conservation de l'interface existante (rétrocompatible)
  - Gestion multi-modèles d'embeddings (code, text, config, fallback)

### 4. Mise à jour des outils MCP

- **`activated_rag`** : Import mis à jour vers `vector-store-refactored.js`
- **`init_rag`** : Utilise la configuration SQLite par défaut
- **`recherche_rag`** : Fonctionne avec le backend SQLite

## Validation des performances

### Tests effectués

1. **`embedAndStore`** : Stockage d'un document avec embedding
   - Résultat : Succès (dimension 768)
   - Temps : < 100ms

2. **`indexProject`** : Indexation de 2 fichiers (5 chunks)
   - Résultat : 2 fichiers indexés, 0 erreurs
   - Temps : ~50ms

3. **`semanticSearch`** : Recherche avec requête "vector store sqlite"
   - Résultat : 5 résultats pertinents (scores 0.62-0.68)
   - Temps : ~200ms (sur 126 vecteurs)

4. **`activated_rag`** : Pipeline complet avec SQLite
   - Résultat : Succès avec statistiques complètes
   - Temps : ~80ms

### Métriques de performance

| Opération | Temps moyen | Mémoire | Notes |
|-----------|-------------|---------|-------|
| Connexion DB | < 10ms | Négligeable | |
| Stockage embedding | < 50ms | ~1KB par vecteur | |
| Recherche sémantique | ~200ms | Linéaire au nombre de vecteurs | Pas d'index vectoriel (pour l'instant) |
| Indexation fichier | ~25ms/fichier | Dépend de la taille | |

### Limitations connues

1. **Recherche linéaire** : La similarité cosinus est calculée sur tous les vecteurs en mémoire. Pour les grandes bases (>10k vecteurs), envisager un index vectoriel (ex: HNSW via extension SQLite).
2. **Dimensions variables** : Les embeddings de différents modèles ont des dimensions différentes (384, 768, 1024). La fonction `cosineSimilarity` pad avec des zéros, ce qui peut réduire la précision.
3. **Concurrence** : SQLite en mode WAL supporte un writer multiple readers, mais les performances peuvent diminuer avec de nombreuses écritures concurrentes.

## Guide de migration

### Pour les utilisateurs existants

1. **Sauvegarder les données** :

   ```bash
   pg_dump -U rag_user -d rag_db > rag_backup.sql
   ```

2. **Mettre à jour la configuration** :

   ```bash
   # Vérifier que rag/config/db.config.json existe
   # Sinon, exécuter init_rag pour le générer
   ```

3. **Réindexer les projets** :

   ```bash
   # Utiliser activated_rag avec mode=full
   ```

### Pour les nouvelles installations

1. **Initialiser RAG** :

   ```bash
   # Utiliser l'outil init_rag
   ```

2. **Configurer les modèles d'embeddings** (optionnel) :

   ```json
   {
     "embedding_provider": "ollama",
     "embedding_models": {
       "code": "nomic-embed-code",
       "text": "nomic-embed-text",
       "config": "bge-small",
       "fallback": "qwen3-embedding:8b"
     }
   }
   ```

3. **Indexer le projet** :

   ```bash
   # Utiliser activated_rag avec les paramètres souhaités
   ```

### Configuration recommandée

```json
// rag/config/db.config.json
{
  "memory": {
    "type": "sqlite",
    "path": "./rag/db/memory/rag_memory.sqlite"
  },
  "vectors": {
    "type": "sqlite",
    "path": "./rag/db/vector/rag_vectors.sqlite"
  },
  "metadata": {
    "type": "sqlite",
    "path": "./rag/db/metadata/rag_metadata.sqlite"
  }
}
```

## Maintenance

### Sauvegarde

Les bases SQLite sont des fichiers simples. Pour sauvegarder :

```bash
cp rag/db/vector/rag_vectors.sqlite rag_backup_$(date +%Y%m%d).sqlite
```

### Monitoring

- **Taille des bases** : Surveiller la croissance des fichiers `.sqlite`
- **Performance** : Logs dans `rag/logs/rag.log`
- **Intégrité** : Utiliser `sqlite3 rag_vectors.sqlite "PRAGMA integrity_check;"`

### Dépannage

1. **Erreur "sqlite3.Database is not a constructor"** :
   - Vérifier que `sqlite3` est installé (`npm list sqlite3`)
   - Recompiler le projet (`npm run build`)

2. **Erreur de dimension des vecteurs** :
   - Vérifier la configuration des modèles d'embeddings
   - Les dimensions doivent être cohérentes ou utiliser la normalisation automatique

3. **Permissions d'écriture** :
   - Vérifier que l'utilisateur a les droits d'écriture sur `rag/db/`

## Conclusion

La migration vers SQLite offre :

- ✅ **Simplification** : Plus de dépendance PostgreSQL
- ✅ **Portabilité** : Fichiers autonomes, facile à déployer
- ✅ **Performance** : Suffisante pour la plupart des cas d'usage RAG
- ✅ **Rétrocompatibilité** : Interface préservée

Les limitations actuelles (recherche linéaire) peuvent être adressées dans des versions futures avec l'ajout d'un index vectoriel.

---

*Document généré le 2026-01-14*
*Version SQLite : 5.1.7*
*Version RAG MCP Server : 2.0.0*
