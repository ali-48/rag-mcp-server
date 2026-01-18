# Nouvelles méthodes IVectorStore - Documentation

**Date** : 18/01/2026
**Version** : 1.0.0
**Statut** : ✅ Implémenté et testé

## 📋 Vue d'ensemble

Cette documentation décrit les nouvelles méthodes ajoutées à l'interface `IVectorStore` dans le cadre du refactoring du vector store. Toutes les méthodes ont été implémentées dans `VectorStoreSQLite` et validées par les tests unitaires.

## 🎯 Méthodes ajoutées

### 1. `deleteDocumentsByPattern(pattern: string): Promise<number>`

**Description** : Supprime les documents correspondant à un pattern SQL LIKE.

**Paramètres** :

- `pattern` : Pattern SQL LIKE (ex: `%test%`, `project_%`)

**Retour** : Nombre de documents supprimés

**Cas d'usage** :

```typescript
// Supprimer tous les documents contenant "test" dans l'ID ou le chemin
const deleted = await store.deleteDocumentsByPattern("%test%");

// Supprimer tous les documents d'un projet spécifique
const deleted = await store.deleteDocumentsByPattern("project/path/%");
```

### 2. `getStats(): Promise<StoreStats>`

**Description** : Obtient les statistiques globales du vector store.

**Retour** : `StoreStats` contenant :

- `totalDocuments` : Nombre total de documents
- `totalProjects` : Nombre total de projets
- `totalSizeBytes` : Taille totale en octets
- `averageVectorDimension` : Dimension moyenne des vecteurs
- `lastUpdated` : Date de dernière mise à jour

**Cas d'usage** :

```typescript
const stats = await store.getStats();
console.log(
  `Documents: ${stats.totalDocuments}, Projets: ${stats.totalProjects}`,
);
```

### 3. `initialize(): Promise<void>`

**Description** : Initialise les tables/schémas si nécessaire.

**Cas d'usage** :

```typescript
// Initialiser le store avant utilisation
await store.initialize();
```

### 4. `testConnection(): Promise<boolean>`

**Description** : Vérifie la connectivité au backend.

**Retour** : `true` si la connexion est fonctionnelle, `false` sinon

**Cas d'usage** :

```typescript
const isConnected = await store.testConnection();
if (!isConnected) {
  throw new Error("Connexion au vector store échouée");
}
```

### 5. `updateDocument(id: string, updates: Partial<...>): Promise<boolean>`

**Description** : Met à jour un document existant.

**Paramètres** :

- `id` : ID du document à mettre à jour
- `updates` : Mises à jour à appliquer (contenu, embedding, métadonnées)

**Retour** : `true` si mis à jour, `false` si document non trouvé

**Cas d'usage** :

```typescript
const updated = await store.updateDocument("doc123", {
  content: "Nouveau contenu",
  metadata: {
    contentType: "updated",
    language: "fr",
  },
});
```

### 6. `hybridSearch(queryEmbedding: number[], textQuery: string, options?: ...): Promise<SearchResult[]>`

**Description** : Recherche hybride combinant similarité sémantique et recherche textuelle.

**Paramètres** :

- `queryEmbedding` : Vecteur d'embedding pour la recherche sémantique
- `textQuery` : Requête textuelle pour la recherche textuelle
- `options` : Options de recherche avec pondérations (`semanticWeight`, `textWeight`)

**Retour** : Résultats combinés et triés par score hybride

**Cas d'usage** :

```typescript
const results = await store.hybridSearch(queryEmbedding, "fonction de test", {
  semanticWeight: 0.7,
  textWeight: 0.3,
  limit: 10,
});
```

### 7. `searchByMetadata(filters: Partial<...>): Promise<SearchResult[]>`

**Description** : Recherche par métadonnées avec filtres avancés.

**Paramètres** :

- `filters` : Filtres de métadonnées (type contenu, rôle, langue, plage de dates, etc.)

**Retour** : Documents correspondant aux filtres

**Cas d'usage** :

```typescript
const results = await store.searchByMetadata({
  contentType: "code",
  language: "typescript",
  dateRange: {
    from: new Date("2024-01-01"),
    to: new Date("2024-12-31"),
  },
});
```

## 🧪 Validation

### Tests unitaires

Toutes les nouvelles méthodes ont été validées par les tests "Multi-Backend Vector Store Tests" :

- ✅ `deleteDocumentsByPattern` : Testé avec différents patterns
- ✅ `getStats` : Statistiques calculées correctement
- ✅ `initialize` : Tables créées si nécessaire
- ✅ `testConnection` : Connexion SQLite testée
- ✅ `updateDocument` : Mise à jour partielle et complète
- ✅ `hybridSearch` : Combinaison sémantique + textuelle
- ✅ `searchByMetadata` : Filtres multiples et plages de dates

### Configuration

La configuration SQLite a été corrigée dans `rag/config/db.config.json` :

- Type `vectors` changé de `"none"` à `"sqlite"`
- Chemin configuré : `"./rag/db/vector/rag_vectors.sqlite"`

## 🔧 Intégration

### Interface IVectorStore

L'interface a été mise à jour dans `src/rag/vector-store-interface.ts` avec :

1. Documentation complète pour chaque méthode
2. Types TypeScript détaillés
3. Options configurables
4. Gestion d'erreurs standardisée

### Implémentation SQLite

Toutes les méthodes sont implémentées dans `src/rag/vector-store-sqlite.ts` avec :

1. Logging structuré via `VectorStoreLogger`
2. Gestion d'erreurs robuste
3. Optimisations SQLite (index, WAL mode)
4. Compatibilité avec l'interface abstraite

## 📊 Métriques de qualité

- **Couverture tests** : 100% des nouvelles méthodes testées
- **Complexité** : Fonctions < 50 lignes (conforme R5)
- **Documentation** : 100% des méthodes documentées
- **Performance** : Tests d'intégration < 5 secondes

## 🔮 Prochaines étapes

### Améliorations potentielles

1. **Index vectoriel** : Implémenter HNSW ou IVF pour recherche plus rapide
2. **Compression** : Support natif pour embeddings compressés
3. **Backends additionnels** : PostgreSQL avec pgvector, Qdrant, Weaviate
4. **Monitoring** : Métriques temps réel et alertes

### Maintenance

- Surveiller les performances avec des jeux de données volumineux
- Ajouter des tests de charge pour `hybridSearch`
- Documenter les patterns d'utilisation avancés

---

**Statut final** : ✅ Toutes les nouvelles méthodes sont implémentées, testées et documentées.
**Prochaine revue** : Après déploiement en production avec données réelles.
