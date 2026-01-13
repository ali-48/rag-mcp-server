# Refonte du Système d'Embeddings - Plan

## Problèmes Actuels

1. **Modèle unique** : `qwen3-embedding:8b` pour tous les types de contenu
2. **Pas de routage** : Impossible de sélectionner automatiquement le modèle adapté
3. **Cache non spécialisé** : Cache partagé entre tous les types

## Nouvelle Architecture

### 1. Configuration Multi-Modèles

```typescript
interface EmbeddingModelConfig {
  code: string;      // nomic-embed-code
  text: string;      // nomic-embed-text  
  config: string;    // bge-small
  fallback: string;  // qwen3-embedding:8b
}

interface EmbeddingProviderConfig {
  provider: string;  // 'ollama'
  models: EmbeddingModelConfig;
  dimensions: {
    code: number;    // 768
    text: number;    // 768
    config: number;  // 384
    fallback: number; // 1024
  };
}
```

### 2. Routage Automatique par Type

```typescript
function getEmbeddingModelForContentType(
  contentType: string, 
  language?: string
): string {
  switch (contentType) {
    case 'code':
      return config.models.code;
    case 'doc':
    case 'text':
      return config.models.text;
    case 'config':
      return config.models.config;
    default:
      return config.models.fallback;
  }
}
```

### 3. Cache Séparé par Modèle

```typescript
const embeddingCache = new Map<string, {
  vector: number[];
  model: string;
  timestamp: number;
}>();

function getCacheKey(text: string, model: string): string {
  return `${model}:${hashText(text)}`;
}
```

### 4. Génération d'Embeddings avec Routage

```typescript
async function generateEmbedding(
  text: string, 
  contentType: string = 'other',
  language?: string
): Promise<number[]> {
  // 1. Déterminer le modèle approprié
  const model = getEmbeddingModelForContentType(contentType, language);
  
  // 2. Vérifier le cache
  const cacheKey = getCacheKey(text, model);
  const cached = embeddingCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.vector;
  }
  
  // 3. Générer l'embedding avec le modèle approprié
  const vector = await generateEmbeddingWithModel(text, model);
  
  // 4. Mettre en cache
  embeddingCache.set(cacheKey, {
    vector,
    model,
    timestamp: Date.now()
  });
  
  return vector;
}
```

## Modifications à Apporter à `vector-store.ts`

### 1. Ajouter les Nouvelles Fonctions d'Export

```typescript
// Configuration
export function setEmbeddingModels(models: Partial<EmbeddingModelConfig>): void;
export function getEmbeddingModelForContentType(contentType: string, language?: string): string;

// Cache management
export function clearEmbeddingCache(): void;
export function getEmbeddingCacheStats(): {
  totalEntries: number;
  byModel: Record<string, number>;
  hitRate: number;
};

// Embedding generation with routing
export async function generateEmbeddingForContent(
  text: string,
  contentType: string,
  language?: string
): Promise<number[]>;
```

### 2. Modifier `setEmbeddingProvider`

```typescript
export function setEmbeddingProvider(
  provider: string, 
  defaultModel: string = 'qwen3-embedding:8b',
  modelConfig?: Partial<EmbeddingModelConfig>
): void {
  embeddingProvider = provider;
  
  // Configuration par défaut
  const defaultModels: EmbeddingModelConfig = {
    code: 'nomic-embed-code',
    text: 'nomic-embed-text',
    config: 'bge-small',
    fallback: defaultModel
  };
  
  // Fusionner avec la configuration fournie
  embeddingModels = { ...defaultModels, ...modelConfig };
  
  console.error(`Embedding provider configured: ${provider}`);
  console.error(`Models: ${JSON.stringify(embeddingModels)}`);
}
```

### 3. Mettre à Jour `embedAndStore`

```typescript
export async function embedAndStore(
  projectPath: string,
  filePath: string,
  content: string,
  options: EmbedAndStoreOptions = {}
): Promise<void> {
  const {
    contentType = 'other',
    language = null,
    // ... autres options
  } = options;
  
  // Utiliser le routage automatique
  const vector = await generateEmbeddingForContent(content, contentType, language);
  
  // ... reste inchangé
}
```

## Configuration dans `rag-config.json`

```json
{
  "embeddings": {
    "provider": "ollama",
    "models": {
      "code": "nomic-embed-code",
      "text": "nomic-embed-text", 
      "config": "bge-small",
      "fallback": "qwen3-embedding:8b"
    },
    "dimensions": {
      "code": 768,
      "text": 768,
      "config": 384,
      "fallback": 1024
    },
    "cache": {
      "enabled": true,
      "max_entries": 1000,
      "ttl_seconds": 3600
    }
  }
}
```

## Rétrocompatibilité

1. **Ancienne API** : `setEmbeddingProvider('ollama', 'qwen3-embedding:8b')` continue à fonctionner
2. **Nouvelle API** : `setEmbeddingProvider('ollama', 'qwen3-embedding:8b', { code: 'nomic-embed-code' })`
3. **Fallback** : Si le modèle spécifique n'est pas disponible, utiliser le fallback

## Tests à Prévoir

1. Test de routage par type de contenu
2. Test de cache multi-modèles
3. Test de performance vs ancien système
4. Test de qualité embeddings par type
