# Amélioration du Chunking Intelligent - Plan d'Implémentation

## Problèmes Actuels

1. **Analyse AST limitée** : Utilisation de regex et heuristiques simples
2. **Support langage limité** : Seulement JS/TS/Python via `preprocessCode`
3. **Chunking non optimal** : 1 fonction = 1 chunk, mais pas de gestion des classes complexes
4. **Pas de tree-sitter** : Analyse syntaxique complète manquante

## Nouvelle Architecture avec Tree-sitter

### 1. Installation des Dépendances

```bash
npm install tree-sitter tree-sitter-javascript tree-sitter-typescript tree-sitter-python tree-sitter-json tree-sitter-yaml tree-sitter-markdown
```

### 2. Structure du Module Tree-sitter

```typescript
// src/rag/phase0/parser/tree-sitter-parser.ts
interface TreeSitterNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  children: TreeSitterNode[];
}

interface CodeStructure {
  functions: Array<{
    name: string;
    body: string;
    startLine: number;
    endLine: number;
    parameters: string[];
    returnType?: string;
    isAsync: boolean;
  }>;
  classes: Array<{
    name: string;
    body: string;
    startLine: number;
    endLine: number;
    methods: Array<{
      name: string;
      body: string;
      startLine: number;
      endLine: number;
    }>;
    properties: string[];
  }>;
  imports: string[];
  exports: string[];
  comments: Array<{
    text: string;
    line: number;
    type: 'line' | 'block' | 'doc';
  }>;
}
```

### 3. Chunking par Unités Logiques

#### Règles de Chunking

1. **Fonctions** : 1 fonction = 1 chunk (sauf si > 200 lignes)
2. **Classes** :
   - Petite classe (< 10 méthodes) = 1 chunk
   - Grande classe = 1 chunk par méthode + 1 chunk pour la structure
3. **Documentation** : 1 section Markdown = 1 chunk
4. **Configuration** : 1 objet/tableau JSON = 1 chunk

#### Algorithme de Chunking

```typescript
function chunkByLogicalUnits(
  text: string,
  language: ProgrammingLanguage,
  maxChunkSize: number = 1000
): Chunk[] {
  // 1. Parser avec tree-sitter
  const ast = parseWithTreeSitter(text, language);
  
  // 2. Extraire les unités logiques
  const units = extractLogicalUnits(ast);
  
  // 3. Grouper les unités en chunks
  const chunks: Chunk[] = [];
  let currentChunk: string[] = [];
  let currentSize = 0;
  
  for (const unit of units) {
    const unitSize = estimateTokenCount(unit.text);
    
    if (currentSize + unitSize > maxChunkSize && currentSize > 0) {
      // Sauvegarder le chunk actuel
      chunks.push({
        text: currentChunk.join('\n\n'),
        metadata: {
          unitTypes: extractUnitTypes(currentChunk),
          language,
          isComplete: true
        }
      });
      currentChunk = [];
      currentSize = 0;
    }
    
    currentChunk.push(unit.text);
    currentSize += unitSize;
  }
  
  // Ajouter le dernier chunk
  if (currentChunk.length > 0) {
    chunks.push({
      text: currentChunk.join('\n\n'),
      metadata: {
        unitTypes: extractUnitTypes(currentChunk),
        language,
        isComplete: true
      }
    });
  }
  
  return chunks;
}
```

### 4. Intégration avec `indexer.ts`

#### Modifications à `chunkCodeIntelligently`

```typescript
async function chunkCodeIntelligently(
  text: string,
  language?: ProgrammingLanguage,
  chunkSize: number = 1000,
  overlap: number = 200
): Promise<string[]> {
  // 1. Vérifier si tree-sitter est disponible pour ce langage
  if (language && isTreeSitterSupported(language)) {
    try {
      const chunks = await chunkWithTreeSitter(text, language, chunkSize);
      if (chunks.length > 0) {
        return chunks;
      }
    } catch (error) {
      console.error(`Tree-sitter chunking failed: ${error}, falling back`);
    }
  }
  
  // 2. Fallback à l'ancienne méthode
  return chunkCodeIntelligentlyLegacy(text, language, chunkSize, overlap);
}
```

### 5. Configuration Tree-sitter

#### `rag-config.json`

```json
{
  "chunking": {
    "strategy": "logical",
    "max_chunk_size": 1000,
    "chunk_overlap": 200,
    "tree_sitter": {
      "enabled": true,
      "languages": ["javascript", "typescript", "python", "json", "yaml", "markdown"],
      "max_file_size_mb": 10,
      "timeout_ms": 5000
    },
    "rules": {
      "function_as_chunk": true,
      "class_as_chunk": true,
      "max_function_lines": 200,
      "max_class_methods": 10,
      "preserve_imports": true,
      "include_comments": true
    }
  }
}
```

### 6. Métriques et Monitoring

```typescript
interface ChunkingMetrics {
  totalFiles: number;
  filesWithTreeSitter: number;
  averageChunksPerFile: number;
  chunkSizeDistribution: Record<string, number>;
  languageBreakdown: Record<string, number>;
  treeSitterSuccessRate: number;
  fallbackRate: number;
}
```

### 7. Tests Unitaires

```typescript
describe('Tree-sitter Chunking', () => {
  test('should chunk TypeScript function correctly', async () => {
    const code = `
      function calculateSum(a: number, b: number): number {
        return a + b;
      }
    `;
    
    const chunks = await chunkCodeIntelligently(code, 'typescript', 1000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('calculateSum');
  });
  
  test('should chunk large class into multiple chunks', async () => {
    const code = `
      class LargeClass {
        method1() { /* 50 lines */ }
        method2() { /* 50 lines */ }
        method3() { /* 50 lines */ }
        method4() { /* 50 lines */ }
        method5() { /* 50 lines */ }
      }
    `;
    
    const chunks = await chunkCodeIntelligently(code, 'typescript', 500);
    expect(chunks.length).toBeGreaterThan(1);
  });
});
```

## Plan d'Implémentation

### Phase 1: Installation et Configuration

1. Installer les dépendances tree-sitter
2. Créer le module `tree-sitter-parser.ts`
3. Ajouter la configuration dans `rag-config.json`

### Phase 2: Implémentation du Parser

1. Implémenter `parseWithTreeSitter()`
2. Implémenter `extractLogicalUnits()`
3. Implémenter `chunkWithTreeSitter()`

### Phase 3: Intégration avec Indexer

1. Modifier `chunkCodeIntelligently()`
2. Ajouter le fallback à l'ancienne méthode
3. Mettre à jour `chunkIntelligently()`

### Phase 4: Tests et Validation

1. Tests unitaires pour chaque langage
2. Tests d'intégration avec des projets réels
3. Benchmark vs ancien système

### Phase 5: Monitoring et Optimisation

1. Ajouter les métriques de chunking
2. Optimiser la performance
3. Documenter les résultats

## Rétrocompatibilité

- **Ancien système** : Continue à fonctionner comme fallback
- **Nouveau système** : Activé via configuration `tree_sitter.enabled`
- **Migration progressive** : Peut être activé/désactivé par projet

## Avantages Attendus

1. **Meilleure qualité** : Chunks plus cohérents sémantiquement
2. **Support multi-langage** : JavaScript, TypeScript, Python, JSON, YAML, Markdown
3. **Performance** : Analyse syntaxique rapide
4. **Extensibilité** : Facile à ajouter de nouveaux langages
