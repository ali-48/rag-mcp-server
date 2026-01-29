# 🔍 DIAGNOSTIC PHASE 3 - EMBEDDINGS

> **Date :** 29 janvier 2026, 16:41
> **Tâche :** T1.1 - Diagnostiquer Phase 3 Embeddings
> **Durée :** 15 min
> **Fichier analysé :** `src/rag/embedding-service.ts`

---

## 📋 CONSTAT INITIAL

**Problème rapporté :**

- Phase 3 marquée "✗" dans pipeline
- 0 fichiers indexés
- 0 chunks créés
- 0 embeddings générés
- Aucune erreur explicite retournée

---

## 🔎 ARCHITECTURE IDENTIFIÉE

### Structure réelle du code

**Fichier attendu :** ❌ `src/rag/phase3/embeddings.ts` (n'existe pas)
**Fichier réel :** ✅ `src/rag/embedding-service.ts`

### Composants clés

```typescript
EmbeddingService {
  - provider: "ollama" | "sentence-transformers" | "fallback"
  - models: {
      code: "nomic-embed-code"
      text: "nomic-embed-text"
      config: "bge-small"
      fallback: "qwen3-embedding:8b"
    }
  - cache: EmbeddingCache
  - ollamaService: OllamaService | null
}
```

### Flux de génération

```
1. detectBestProvider()
   ├─> Ollama disponible ? → "ollama"
   ├─> Sentence Transformers installé ? → "sentence-transformers"
   └─> Sinon → "fallback"

2. generateForContent(text, contentType)
   ├─> Déterminer modèle selon type (code/text/config)
   ├─> Vérifier cache
   ├─> Générer avec provider
   ├─> Normaliser L2
   └─> Mettre en cache

3. generateWithModel(text, model)
   ├─> ollama → ollamaService.generateEmbedding()
   ├─> sentence-transformers → @xenova/transformers
   └─> fallback → generateFallbackEmbedding()
```

---

## 🐛 POINTS DE BLOCAGE IDENTIFIÉS

### Blocage #1 : Détection provider échoue silencieusement

**Code concerné :**

```typescript
async function detectBestProvider(): Promise<EmbeddingProvider> {
  // 1. Tester Ollama
  try {
    const ollamaService = getDefaultOllamaService();
    const ollamaAvailable = await ollamaService.testConnection();
    if (ollamaAvailable) return "ollama";
  } catch (error) {
    VectorStoreLogger.debug(...); // ❌ Erreur seulement en debug
  }

  // 2. Tester Sentence Transformers
  try {
    await import("@xenova/transformers");
    return "sentence-transformers";
  } catch (error) {
    VectorStoreLogger.debug(...); // ❌ Erreur seulement en debug
  }

  // 3. Fallback
  return "fallback";
}
```

**Problème :**

- Si Ollama est indisponible → debug log seulement
- Si @xenova/transformers manque → debug log seulement
- Si fallback sélectionné → pas d'avertissement

**Impact :** Impossible de savoir quel provider est utilisé et pourquoi

---

### Blocage #2 : Modèles Ollama non disponibles

**Modèles requis par défaut :**

```typescript
const DEFAULT_MODEL_CONFIG = {
  code: "nomic-embed-code", // 768 dimensions
  text: "nomic-embed-text", // 768 dimensions
  config: "bge-small", // 384 dimensions
  fallback: "qwen3-embedding:8b", // 1024 dimensions
};
```

**Problème :**

- Si provider="ollama" mais modèles non téléchargés
- Aucune validation des modèles au démarrage
- Erreur remontée seulement lors de la génération

**Test nécessaire :**

```bash
ollama list | grep -E "(nomic-embed-code|nomic-embed-text|bge-small|qwen3-embedding)"
```

---

### Blocage #3 : Dépendance @xenova/transformers manquante

**Code concerné :**

```typescript
private async generateSentenceTransformerEmbedding(text: string) {
  try {
    const { pipeline } = await import("@xenova/transformers");
    const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      quantized: true
    });
    // ...
  } catch (error) {
    // Fallback sur generateFallbackEmbedding
  }
}
```

**Problème :**

- Si @xenova/transformers non installé → fallback silencieux
- Fallback peut être inattendu et non performant

**Vérification nécessaire :**

```bash
npm list @xenova/transformers
```

---

### Blocage #4 : 0 chunks créés (problème upstream)

**Phase 3 dépend de Phase 2 (Chunking) :**

```
Phase 1 (Scan) → 731 fichiers disponibles
Phase 2 (Chunking) → 0 chunks créés ❌
Phase 3 (Embeddings) → Rien à traiter ❌
```

**Hypothèses :**

1. `chunker-integration.ts` ne génère aucun chunk
2. Parsing échoue pour tous les fichiers
3. Configuration chunking incorrecte
4. Filtrage trop agressif

**Fichier à analyser :** `src/rag/phase0/chunker-integration.ts`

---

### Blocage #5 : Logs insuffisants pour diagnostic

**Logs actuels :**

```typescript
VectorStoreLogger.info("embedding.service.init", ...);
VectorStoreLogger.debug("embedding.cache.hit", ...);
VectorStoreLogger.debug("embedding.generating", ...);
VectorStoreLogger.error("embedding.sentence-transformers.error", ...);
```

**Problèmes :**

- Logs "debug" non visibles par défaut
- Pas de log au niveau "error" si provider fallback
- Pas de log si aucun embedding généré
- Pas de métriques (temps, volume, succès/échecs)

---

## 🎯 CAUSES PROBABLES PAR PRIORITÉ

### 🔴 Priorité 1 : Chunking défaillant (99% probable)

**Raison :** 0 chunks créés signifie Phase 3 n'a rien à traiter

**Preuve :**

```json
{
  "stats": {
    "indexed_files": 0,
    "chunks_created": 0 // ❌ Problème upstream
  }
}
```

**Action immédiate :** Analyser `chunker-integration.ts`

---

### 🟡 Priorité 2 : Provider fallback silencieux (50% probable)

**Raison :** Si Ollama et Sentence Transformers échouent → fallback sans warning

**Preuve :** Logs debug seulement, pas de logs error/warning

**Action immédiate :**

- Vérifier quel provider est sélectionné
- Tester disponibilité Ollama
- Vérifier installation @xenova/transformers

---

### 🟢 Priorité 3 : Modèles Ollama manquants (30% probable)

**Raison :** Modèles par défaut peuvent ne pas être téléchargés

**Preuve :** Aucune validation au démarrage

**Action immédiate :**

```bash
ollama list
# Vérifier présence de nomic-embed-code, etc.
```

---

## 📝 RECOMMANDATIONS IMMÉDIATES

### 1. Créer test unitaire isolé embeddings

```typescript
// test/unit/embeddings.test.ts
import { EmbeddingService } from "../../src/rag/embedding-service.js";

describe("EmbeddingService", () => {
  it("should generate embedding for simple text", async () => {
    const service = new EmbeddingService({
      provider: "fallback",
      models: DEFAULT_MODEL_CONFIG,
    });

    const embedding = await service.generate("Hello world");

    expect(embedding).toBeDefined();
    expect(embedding.length).toBeGreaterThan(0);
    expect(Array.isArray(embedding)).toBe(true);
  });
});
```

### 2. Ajouter logs détaillés Phase 3

**Positions clés pour logs :**

```typescript
// Au démarrage
VectorStoreLogger.info("phase3.start", "Starting Phase 3: Embeddings", {
  provider: config.provider,
  chunksCount: chunks.length,
});

// Pour chaque chunk
VectorStoreLogger.debug("phase3.chunk.processing", "Processing chunk", {
  chunkId: chunk.id,
  contentType: chunk.type,
  model: selectedModel,
});

// Si erreur
VectorStoreLogger.error("phase3.chunk.error", "Failed to generate embedding", {
  chunkId: chunk.id,
  error: error.message,
});

// À la fin
VectorStoreLogger.info("phase3.complete", "Phase 3 completed", {
  totalChunks: chunks.length,
  successCount: success,
  errorCount: errors,
  duration: Date.now() - startTime,
});
```

### 3. Ajouter validation provider au démarrage

```typescript
async function validateProvider(provider: EmbeddingProvider): Promise<boolean> {
  switch (provider) {
    case "ollama":
      const ollama = getDefaultOllamaService();
      const available = await ollama.testConnection();
      if (!available) {
        VectorStoreLogger.warn("provider.validation", "Ollama not available");
      }
      return available;

    case "sentence-transformers":
      try {
        await import("@xenova/transformers");
        return true;
      } catch {
        VectorStoreLogger.warn(
          "provider.validation",
          "@xenova/transformers not installed",
        );
        return false;
      }

    case "fallback":
      VectorStoreLogger.warn(
        "provider.validation",
        "Using fallback embeddings (low quality)",
      );
      return true;
  }
}
```

### 4. Retourner error_details dans activated_rag

```typescript
// Dans activated_rag output
{
  "success": false,  // ❌ Au lieu de true
  "pipeline": {
    "phase_3": "✗"
  },
  "error_details": {
    "phase_3": {
      "error": "NO_CHUNKS_TO_PROCESS",
      "message": "Phase 2 (Chunking) created 0 chunks",
      "chunks_expected": 731,
      "chunks_created": 0
    }
  }
}
```

---

## 🎯 PLAN D'ACTION DÉTAILLÉ

### Étape 1 : Tester provider disponibilité (5 min)

```bash
# Test Ollama
curl http://localhost:11434/api/version

# Test modèles Ollama
ollama list

# Test @xenova/transformers
node -e "import('@xenova/transformers').then(() => console.log('OK')).catch(() => console.log('KO'))"
```

### Étape 2 : Créer test unitaire embeddings (20 min)

- Créer `test/unit/embeddings.test.ts`
- Tester avec provider="fallback" (toujours disponible)
- Tester avec 1 simple string
- Valider : embedding généré, length > 0, normalisé

### Étape 3 : Analyser chunker-integration.ts (30 min)

- Lire le code
- Identifier pourquoi 0 chunks créés
- Tester chunking isolément
- Vérifier config chunking

### Étape 4 : Ajouter logs Phase 3 (15 min)

- 5 points de log stratégiques
- Logs au niveau INFO (pas DEBUG)
- Métriques : temps, volume, taux succès

### Étape 5 : Ajouter error_details dans output (20 min)

- Modifier `activated_rag` pour capturer erreurs Phase 3
- Retourner détails dans `error_details.phase_3`
- Respecter R9 (Erreurs explicites)

---

## ✅ CONCLUSION DIAGNOSTIC

### Fichier analysé

✅ `src/rag/embedding-service.ts` (449 lignes)

### Architecture identifiée

✅ EmbeddingService avec multi-providers et cache

### Points de blocage identifiés

✅ 5 blocages majeurs documentés

### Cause la plus probable

🔴 **Chunking défaillant** (0 chunks créés → Phase 3 n'a rien à traiter)

### Causes secondaires

🟡 Provider fallback silencieux
🟡 Modèles Ollama potentiellement manquants
🟡 Logs insuffisants pour diagnostic
🟡 Pas de validation au démarrage

### Prochaines étapes

1. Tester provider disponibilité
2. Créer test unitaire embeddings
3. **Analyser chunker-integration.ts (PRIORITÉ)**
4. Ajouter logs Phase 3
5. Retourner error_details

---

**Durée diagnostic :** 15 min
**Statut :** ✅ Tâche T1.1 terminée
**Fichiers à analyser ensuite :** `src/rag/phase0/chunker-integration.ts`
