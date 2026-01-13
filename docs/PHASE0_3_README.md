# Phase 0.3 - LLM Enrichment Module

## 🎯 Objectif

La Phase 0.3 introduit une couche d'enrichissement LLM optionnelle entre la Phase 0.2 (chunking intelligent) et la Phase 1 (embeddings). Cette couche utilise des modèles LLM pour enrichir les chunks de code avec des métadonnées sémantiques, améliorant ainsi la qualité des embeddings et la pertinence des recherches.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Pipeline RAG Complet                      │
├─────────────────────────────────────────────────────────────┤
│  Phase 0.1: Observation                                      │
│  ├── Workspace Detection                                     │
│  ├── File Watcher                                            │
│  └── Event Logger                                            │
│                                                              │
│  Phase 0.2: Chunking Intelligent                             │
│  ├── Code Preprocessor                                       │
│  ├── AI Segmenter                                            │
│  └── Content Detector                                        │
│                                                              │
│  Phase 0.3: LLM Enrichment (OPTIONNEL)                      │
│  ├── LLM Enricher Service                                    │
│  ├── JSON Schema Validation                                  │
│  ├── Prompt Engineering                                      │
│  └── Metrics Collection                                      │
│                                                              │
│  Phase 1: Embeddings & Storage                               │
│  ├── Vector Embeddings                                       │
│  └── PostgreSQL Storage                                      │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Composants

### 1. LLM Enricher Service (`index.ts`)

**Fonctionnalités :**

- Service singleton avec feature flag
- Enrichissement par chunk ou par batch
- Validation d'entrée/sortie avec Zod schemas
- Cache LLM intégré pour la performance
- Métriques détaillées d'enrichissement

**Métriques collectées :**

- `totalChunksProcessed` : Nombre total de chunks traités
- `totalChunksEnriched` : Nombre de chunks enrichis avec succès
- `totalEnrichmentTimeMs` : Temps total d'enrichissement
- `averageEnrichmentTimeMs` : Temps moyen par chunk
- `successRate` : Taux de succès (chunks enrichis / traités)
- `errors` : Nombre d'erreurs LLM
- `byModel` : Statistiques par modèle LLM utilisé

### 2. Configuration (`config.ts`)

**Paramètres configurables :**

```typescript
interface LLMEnricherConfig {
  enabled: boolean;                    // Activer/désactiver Phase 0.3
  provider: 'ollama' | 'fake';         // Fournisseur LLM
  model: string;                       // Modèle LLM (ex: 'llama3.1:latest')
  temperature: number;                 // Température sampling (0.0-1.0)
  maxTokens: number;                   // Tokens maximum par réponse
  timeoutMs: number;                   // Timeout LLM
  batchSize: number;                   // Taille des batches
  features: EnrichmentFeature[];       // Fonctionnalités d'enrichissement
  cacheEnabled: boolean;               // Activer le cache LLM
  cacheTtlSeconds: number;             // TTL du cache
}
```

**Fonctionnalités d'enrichissement :**

- `summary` : Résumé sémantique du chunk
- `keywords` : Mots-clés pertinents
- `entities` : Entités identifiées (classes, fonctions, variables)
- `complexity` : Complexité du code (low/medium/high)
- `category` : Catégorie (utility-class, api-endpoint, etc.)
- `language` : Langage de programmation

### 3. Schemas Validation (`schemas.ts`)

**Validation Zod pour :**

- Entrée d'enrichissement (chunk + métadonnées)
- Sortie LLM (JSON strict)
- Métadonnées enrichies
- Configuration du service

**Exemple de schéma de sortie :**

```json
{
  "enrichedContent": "string",
  "metadata": {
    "summary": "string",
    "keywords": ["string"],
    "entities": ["string"],
    "complexity": "low|medium|high",
    "category": "string",
    "language": "string"
  },
  "confidence": 0.85
}
```

### 4. Prompt Engineering (`prompts.ts`)

**Prompts système JSON stricts :**

```typescript
const SYSTEM_PROMPT = `Vous êtes un assistant spécialisé dans l'analyse de code.
Analysez le code suivant et retournez UNIQUEMENT un objet JSON valide avec la structure suivante:
{
  "enrichedContent": "string",
  "metadata": {
    "summary": "string",
    "keywords": ["string"],
    "entities": ["string"],
    "complexity": "low|medium|high",
    "category": "string",
    "language": "string"
  },
  "confidence": number
}`;
```

## 🔧 Configuration

### 1. Activer Phase 0.3 dans `rag-config.json`

```json
{
  "phase0_3": {
    "enabled": true,
    "provider": "ollama",
    "model": "llama3.1:latest",
    "temperature": 0.1,
    "max_tokens": 1000,
    "timeout_ms": 30000,
    "batch_size": 5,
    "features": ["summary", "keywords", "entities"],
    "cache_enabled": true,
    "cache_ttl_seconds": 3600
  }
}
```

### 2. Utilisation avec `indexProject`

```typescript
import { indexProject } from './src/rag/indexer.js';

const stats = await indexProject('/chemin/projet', {
  filePatterns: ['**/*.{js,ts,py}'],
  chunkSize: 1000,
  chunkOverlap: 200,
});

// Métriques Phase 0.3 disponibles si activée
if (stats.phase03Metrics) {
  console.log('Chunks enrichis:', stats.phase03Metrics.totalEnriched);
  console.log('Taux succès:', stats.phase03Metrics.successRate);
  console.log('Temps moyen:', stats.phase03Metrics.averageTimeMs);
}
```

### 3. Utilisation avec `updateProject`

```typescript
const updateStats = await updateProject('/chemin/projet', {
  filePatterns: ['**/*.{js,ts,py}'],
});

// Métriques incluses dans les statistiques d'update
console.log('Métriques Phase 0.3:', updateStats.phase03Metrics);
```

## 📊 Métriques et Monitoring

### Métriques disponibles via API

```typescript
import { getLLMEnricher } from './src/rag/phase0/llm-enrichment/index.js';

const enricher = getLLMEnricher();
if (enricher) {
  const metrics = enricher.getMetrics();
  const stats = enricher.getStats();
  
  console.log('Métriques détaillées:', metrics);
  console.log('Statistiques résumées:', stats);
}
```

### Logs console lors de l'indexation

```
🧠 Phase 0.3 - LLM Enrichment ACTIVÉ: ollama/llama3.1:latest
🧠 Phase 0.3 - Enrichissement de 15 chunks...
🧠 Phase 0.3 - Enrichissement terminé: 14/15 succès
🧠 Phase 0.3 Métriques:
  Chunks traités: 15
  Chunks enrichis: 14
  Taux succès: 93.3%
  Temps moyen: 245ms
  Erreurs: 1
```

### Réinitialisation des métriques

```typescript
enricher.resetMetrics();
console.log('Métriques réinitialisées');
```

## 🧪 Tests

### Tests unitaires

```bash
# Exécuter les tests unitaires Phase 0.3
npm test -- test/phase0-llm-enrichment/test-llm-enrichment.ts
```

**Tests couverts :**

- ✅ Feature flag désactivé (skip enrichissement)
- ✅ Feature flag activé (enrichissement simulé)
- ✅ Validation JSON stricte
- ✅ Gestion erreurs LLM
- ✅ Cache LLM
- ✅ Métriques de performance

### Tests d'intégration

```bash
# Exécuter les tests d'intégration Phase 0.3
npm test -- test/phase0-llm-enrichment/test-integration.ts
```

**Tests couverts :**

- ✅ Pipeline complet Phase 0.2→0.3→1 (désactivé)
- ✅ Pipeline complet Phase 0.2→0.3→1 (activé)
- ✅ Performance indexation (comparaison temps)
- ✅ Gestion erreurs (LLM timeout, fichiers invalides)
- ✅ Mise à jour projet (updateProject avec Phase 0.3)

## 🚀 Utilisation avancée

### 1. Enrichissement manuel de chunks

```typescript
import { initLLMEnricher } from './src/rag/phase0/llm-enrichment/index.js';

const enricher = initLLMEnricher({
  enabled: true,
  provider: 'ollama',
  model: 'llama3.1:latest',
});

const enriched = await enricher.enrichChunk(
  'file.js#chunk0',
  'function add(a, b) { return a + b; }',
  { language: 'javascript' }
);

if (enriched) {
  console.log('Résumé:', enriched.metadata.summary);
  console.log('Mots-clés:', enriched.metadata.keywords);
  console.log('Temps:', enriched.enrichmentTimeMs);
}
```

### 2. Enrichissement par batch

```typescript
const chunks = [
  { id: 'file1.js#chunk0', content: 'code1', metadata: { language: 'js' } },
  { id: 'file1.js#chunk1', content: 'code2', metadata: { language: 'js' } },
  { id: 'file2.py#chunk0', content: 'code3', metadata: { language: 'python' } },
];

const results = await enricher.enrichBatch(chunks);
const successCount = results.filter(r => r !== null).length;
console.log(`${successCount}/${chunks.length} chunks enrichis`);
```

### 3. Configuration dynamique

```typescript
enricher.updateConfig({
  temperature: 0.2,
  batchSize: 10,
  features: ['summary', 'keywords', 'entities', 'complexity'],
});

console.log('Nouvelle config:', enricher.getConfig());
```

## 🔍 Dépannage

### Problèmes courants

1. **LLM non disponible**

   ```
   ❌ Erreur Phase 0.3: LLM API timeout
   ```

   **Solution :** Vérifier que Ollama est en cours d'exécution

   ```bash
   ollama serve
   ```

2. **JSON parsing error**

   ```
   ❌ Sortie LLM invalide: Invalid JSON format
   ```

   **Solution :** Vérifier le prompt système et réduire la température

3. **Performance lente**

   ```
   Temps moyen: 1500ms (trop élevé)
   ```

   **Solution :** Réduire `batchSize` ou utiliser un modèle plus léger

4. **Cache inefficace**

   ```
   Cache LLM: 0 hits, 15 misses
   ```

   **Solution :** Augmenter `cacheTtlSeconds` ou vérifier les clés de cache

### Logs de débogage

```typescript
// Activer les logs détaillés
import { getGlobalLogger } from './src/rag/phase0/event-logger.js';
const logger = getGlobalLogger();
logger.setLevel('debug');
```

## 📈 Avantages

### Pour la qualité des embeddings

- **Contexte enrichi** : Métadonnées sémantiques ajoutées aux chunks
- **Recherche améliorée** : Mots-clés et entités pour une meilleure pertinence
- **Catégorisation** : Organisation automatique par complexité et catégorie

### Pour les développeurs

- **Observabilité** : Métriques détaillées sur l'enrichissement
- **Flexibilité** : Feature flag pour activer/désactiver à volonté
- **Performance** : Cache LLM et traitement par batch

### Pour le système RAG

- **Rétro-compatibilité** : Phase 0.3 désactivée par défaut
- **Évolutivité** : Support de multiples fournisseurs LLM
- **Monitoring** : Statistiques pour l'optimisation continue

## 🔮 Roadmap

### Améliorations planifiées

1. **Support de plus de fournisseurs LLM**
   - OpenAI GPT
   - Anthropic Claude
   - Google Gemini
   - Hugging Face

2. **Enrichissement avancé**
   - Détection de patterns anti-patterns
   - Suggestions de refactoring
   - Analyse de sécurité
   - Estimation de complexité cyclomatique

3. **Intégration avec le graphe de connaissances**
   - Relations entre entités enrichies
   - Visualisation des dépendances
   - Analyse d'impact

4. **Dashboard de monitoring**
   - Visualisation des métriques en temps réel
   - Alertes intelligentes
   - Rapports d'optimisation

## 🧪 Exemples pratiques

### Exemple 1 : Code JavaScript

**Code original :**

```javascript
class Calculator {
  add(x, y) { return x + y; }
  subtract(x, y) { return x - y; }
  multiply(x, y) { return x * y; }
  divide(x, y) { 
    if (y === 0) throw new Error('Division by zero');
    return x / y; 
  }
}
```

**Enrichissement généré :**

```json
{
  "enrichedContent": "Classe Calculator avec méthodes mathématiques",
  "metadata": {
    "summary": "Classe de calculatrice avec opérations basiques",
    "keywords": ["calculator", "math", "operations", "arithmetic"],
    "entities": ["Calculator", "add", "subtract", "multiply", "divide"],
    "complexity": "low",
    "category": "utility-class",
    "language": "javascript"
  },
  "confidence": 0.92
}
```

### Exemple 2 : Documentation Markdown

**Contenu original :**

```markdown
# API Documentation

## Endpoints

### GET /users
Returns list of users

### POST /users
Creates a new user
```

**Enrichissement généré :**

```json
{
  "enrichedContent": "Documentation API utilisateurs avec endpoints GET et POST",
  "metadata": {
    "summary": "Documentation pour l'API de gestion des utilisateurs",
    "keywords": ["api", "documentation", "users", "endpoints", "rest"],
    "entities": ["GET /users", "POST /users"],
    "complexity": "low",
    "category": "api-documentation",
    "language": "markdown"
  },
  "confidence": 0.88
}
```

## 📝 Notes de version

### v1.0.0 (Initiale)

- ✅ Service LLM Enricher avec feature flag
- ✅ Configuration via `rag-config.json`
- ✅ Validation Zod pour entrée/sortie
- ✅ Prompts système JSON stricts
- ✅ Métriques détaillées d'enrichissement
- ✅ Intégration avec `indexProject` et `updateProject`
- ✅ Tests unitaires complets
- ✅ Tests d'intégration pipeline
- ✅ Documentation technique

## 🤝 Contribution

Les contributions sont les bienvenues ! Voir [CONTRIBUTING.md](../CONTRIBUTING.md) pour les guidelines.

## 📄 Licence

MIT License - Voir [LICENSE](../LICENSE) pour plus de détails.
