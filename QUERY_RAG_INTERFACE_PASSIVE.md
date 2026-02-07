# 📊 Interface Unique Passive : `query_rag`

## 🎯 Objectif

Confirmer et documenter que **`query_rag` est l'interface unique passive** du RAG MCP Server, conforme aux règles d'architecture.

## 🔍 Analyse de l'Architecture

### 1. **`query_rag` - Interface Passive Unique**

- **Rôle** : Recherche sémantique purement passive (lecture seule)
- **Comportement** : Aucune analyse, indexation ou modification déclenchée
- **Appels** : `searchCode` → `semanticSearch` → `vector-store-sqlite.semanticSearch`
- **Vérification** : `isRagInitialized` (lecture fichier seulement)

### 2. **Outils Actifs (non passifs)**

- `init_rag` : Initialisation infrastructure
- `scan_rag` : Phase 0 - Détection workspace (création job asynchrone)
- `prepare_rag` : Phase 1 - Préparation fichiers (création job asynchrone)
- `embed_rag` : Phase 2 - Génération embeddings (création job asynchrone)
- `index_rag` : Phase 2-4 - Indexation complète (création job asynchrone)
- `activated_rag` : Pipeline complet automatisé

### 3. **Outils Passifs (lecture seule)**

- `query_rag` : **Interface unique de recherche**
- `get_status` : Lecture état système
- `cancel_task` : Annulation seulement (pas d'analyse)
- `get_task_context` : Lecture contexte sémantique

## 🧪 Vérification Technique

### `semanticSearch` - Chaîne d'appels passive

```
query_rag → searchCode → semanticSearch → vector-store-adapter.semanticSearch → vector-store-sqlite.semanticSearch
```

**Aucun appel à :**

- `scanFiles` (Phase 0)
- `analyzeSymbols` (Phase 1)
- `generateEmbedding` (Phase 2)
- `embedAndStore` (Phase 3)

### `isRagInitialized` - Vérification passive

```typescript
// src/rag/phase0/rag-state.ts
export async function isRagInitialized(projectPath: string): Promise<boolean> {
  try {
    const configPath = path.join(
      projectPath,
      "rag",
      "config",
      "rag.config.json",
    );
    await fs.access(configPath); // Lecture fichier seulement
    const configContent = await fs.readFile(configPath, "utf-8");
    const config: RagConfig = JSON.parse(configContent);
    return config.rag_initialized === true; // Vérification booléenne
  } catch (error) {
    return false;
  }
}
```

## 📋 Modifications Apportées

### 1. **`query-rag.ts` - Renforcement de la passivité**

- **Commentaire** : Ajout "Interface unique passive pour la recherche RAG"
- **Messages** : Suppression suggestions `scan_rag`/`index_rag`
- **Notes IA** : Ajout "Interface passive: aucune analyse ou indexation déclenchée"
- **Next Steps** : Remplacement par "Pour mettre à jour l'index, utilisez le pipeline RAG automatisé (activated_rag)"

### 2. **Structure JSON de réponse**

```json
{
  "notes_for_ai": [
    "Recherche RAG réussie (interface passive)",
    "Interface passive: aucune analyse ou indexation déclenchée"
  ],
  "next_steps": [
    "Affinez votre requête pour des résultats plus précis",
    "Pour mettre à jour l'index, utilisez le pipeline RAG automatisé (activated_rag)"
  ]
}
```

## 🚫 Ce qui est Interdit

### `query_rag` NE DOIT PAS :

1. ❌ Appeler `scanFiles` ou `analyzeSymbols`
2. ❌ Générer des embeddings pour de nouveaux fichiers
3. ❌ Mettre à jour la base vectorielle
4. ❌ Créer des jobs asynchrones
5. ❌ Modifier `state.json` ou la configuration

### `query_rag` DOIT :

1. ✅ Vérifier `isRagInitialized` (lecture seule)
2. ✅ Appeler `semanticSearch` (lecture base SQLite)
3. ✅ Retourner des résultats existants
4. ✅ Gérer les erreurs sans déclencher d'actions

## 📊 Validation

### Tests de Passivité

1. **Appels système** : Aucun `fs.writeFile`, `db.exec`, `queue.enqueue`
2. **Dépendances** : Seulement `vector-store`, `searcher`, `rag-state`
3. **Effets de bord** : Aucun fichier créé/modifié
4. **Performances** : Temps constant, pas de traitement lourd

### Monitoring

```bash
# Vérifier les appels système
strace -e trace=file,process node test-query-rag.js

# Vérifier les écritures SQLite
sqlite3 rag/db/vectors.sqlite "SELECT COUNT(*) FROM rag_vectors;"
```

## 🎯 Conclusion

**`query_rag` est bien l'interface unique passive** du RAG MCP Server :

1. ✅ **Unique** : Seul outil de recherche sémantique
2. ✅ **Passive** : Aucune analyse ou indexation déclenchée
3. ✅ **Lecture seule** : Seulement consultation base vectorielle
4. ✅ **Conforme règles** : Respecte R6 (LLM ≠ accès direct fichiers) et R22 (zéro effet de bord non déclaré)

L'architecture garantit que les recherches RAG sont **déterministes, reproductibles et sans effet de bord**, permettant une utilisation fiable par les agents IA.

---

**Date** : 07/02/2026
**Version** : 1.0.0
**Statut** : ✅ Validé

1. ✅ **Unique** : Seul outil de recherche sémantique
2. ✅ **Passive** : Aucune analyse ou indexation déclenchée
3. ✅ **Lecture seule** : Seulement consultation base vectorielle
4. ✅ **Conforme règles** : Respecte R6 (LLM ≠ accès direct fichiers) et R22 (zéro effet de bord non déclaré)

L'architecture garantit que les recherches RAG sont **déterministes, reproductibles et sans effet de bord**, permettant une utilisation fiable par les agents IA.

---

**Date** : 07/02/2026
**Version** : 1.0.0
**Statut** : ✅ Validé
