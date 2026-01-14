# Optimisations du Chunking Intelligent

## Analyse des Résultats Actuels

### Statistiques des fichiers de test

1. **TypeScript** (`test-typescript.ts`) :
   - 3 fonctions, 1 classe, 1 interface
   - 12 chunks estimés
   - Ratio : ~2.4 chunks par structure principale

2. **Python** (`test-python.py`) :
   - 17 fonctions, 2 classes
   - 38 chunks estimés
   - Ratio : ~2.0 chunks par structure principale

3. **JavaScript** (`test-javascript.js`) :
   - 4 fonctions, 2 classes
   - 17 chunks estimés
   - Ratio : ~2.8 chunks par structure principale

## Problèmes Identifiés

1. **Trop de chunks** : Le chunker crée environ 2-3 chunks par structure principale
2. **Détection incomplète** : Certains types de nœuds ne sont pas correctement identifiés
3. **Gestion des classes complexes** : Les classes avec plusieurs méthodes devraient être divisées en chunks logiques
4. **Manque de métadonnées** : Extraction limitée des informations sur les fonctions et classes

## Optimisations Proposées

### 1. Amélioration de la Détection Tree-sitter

#### Types de nœuds à ajouter

**Pour TypeScript/JavaScript :**

```typescript
// Fonctions
'function_declaration', 'function_expression', 'arrow_function', 
'method_definition', 'generator_function', 'async_function_declaration',
'async_arrow_function', 'async_function_expression'

// Classes
'class_declaration', 'class_expression', 'abstract_class_declaration'

// Interfaces et Types
'interface_declaration', 'type_alias_declaration', 'enum_declaration',
'type_parameter', 'generic_type'

// Modules
'import_statement', 'export_statement', 'export_declaration',
'namespace_import', 'named_imports'
```

**Pour Python :**

```python
# Fonctions
'function_definition', 'async_function_definition', 'lambda',
'decorated_definition', 'decorator'

# Classes
'class_definition', 'decorated_class'

# Imports
'import_statement', 'import_from_statement', 'aliased_import'

# Autres
'with_statement', 'try_statement', 'match_statement'
```

### 2. Règles de Chunking Optimisées

#### Règle "1 Fonction = 1 Chunk" (améliorée)

```typescript
{
    name: 'optimized_function_chunk',
    description: 'Extrait les fonctions avec métadonnées enrichies',
    condition: (node, context) => {
        const functionTypes = [
            'function_declaration', 'function_expression', 'arrow_function',
            'method_definition', 'async_function_declaration',
            'function_definition', 'async_function_definition'  // Python
        ];
        return functionTypes.includes(node.type);
    },
    action: (node, context) => {
        // Extraction améliorée des métadonnées
        const metadata = {
            parameters: extractParametersEnhanced(node, context.language),
            returnType: extractReturnTypeEnhanced(node, context.language),
            isAsync: detectAsync(node, context.language),
            isGenerator: detectGenerator(node, context.language),
            decorators: extractDecorators(node, context.language),
            visibility: extractVisibilityEnhanced(node, context.language),
            complexity: calculateCyclomaticComplexity(node)
        };
        
        // Création du chunk avec métadonnées enrichies
        return [createEnhancedChunk('function', node, context, metadata)];
    },
    priority: 100
}
```

#### Règle "1 Classe = N Chunks" (nouvelle)

```typescript
{
    name: 'class_hierarchical_chunk',
    description: 'Divise les classes complexes en chunks hiérarchiques',
    condition: (node, context) => {
        const classTypes = ['class_declaration', 'class_definition'];
        return classTypes.includes(node.type) && 
               shouldSplitClass(node, context.config);
    },
    action: (node, context) => {
        const chunks = [];
        
        // 1. Chunk pour la définition de classe
        chunks.push(createClassDefinitionChunk(node, context));
        
        // 2. Chunks pour les méthodes (groupées par visibilité)
        const methods = extractClassMethods(node, context.language);
        const groupedMethods = groupMethodsByVisibility(methods);
        
        for (const [visibility, methodGroup] of Object.entries(groupedMethods)) {
            if (methodGroup.length > 0) {
                chunks.push(createMethodGroupChunk(
                    node, context, visibility, methodGroup
                ));
            }
        }
        
        // 3. Chunk pour les propriétés
        const properties = extractClassProperties(node, context.language);
        if (properties.length > 0) {
            chunks.push(createPropertyGroupChunk(node, context, properties));
        }
        
        return chunks;
    },
    priority: 95
}
```

### 3. Fonctions d'Extraction Améliorées

#### Extraction des Paramètres

```typescript
function extractParametersEnhanced(node, language) {
    const params = [];
    
    if (language === 'typescript' || language === 'javascript') {
        // Support des paramètres avec types, valeurs par défaut, destructuration
        const paramNodes = findNodesByType(node, [
            'formal_parameters', 'parameter', 'required_parameter',
            'optional_parameter', 'rest_parameter'
        ]);
        
        for (const paramNode of paramNodes) {
            const param = {
                name: extractParameterName(paramNode),
                type: extractTypeAnnotation(paramNode),
                defaultValue: extractDefaultValue(paramNode),
                isOptional: isParameterOptional(paramNode),
                isRest: isRestParameter(paramNode)
            };
            params.push(param);
        }
    } else if (language === 'python') {
        // Support des paramètres Python (args, kwargs, type hints)
        const paramNodes = findNodesByType(node, [
            'parameters', 'typed_parameter', 'default_parameter'
        ]);
        
        for (const paramNode of paramNodes) {
            const param = {
                name: extractParameterName(paramNode),
                type: extractTypeHint(paramNode),
                defaultValue: extractDefaultValue(paramNode),
                isKeywordOnly: isKeywordOnly(paramNode),
                isPositionalOnly: isPositionalOnly(paramNode)
            };
            params.push(param);
        }
    }
    
    return params;
}
```

#### Calcul de Complexité

```typescript
function calculateCyclomaticComplexity(node) {
    let complexity = 1; // Complexité de base
    
    // Compte les décisions conditionnelles
    const decisionNodes = findNodesByType(node, [
        'if_statement', 'else_clause', 'for_statement',
        'while_statement', 'case_clause', 'catch_clause',
        'conditional_expression', 'logical_expression'
    ]);
    
    complexity += decisionNodes.length;
    
    // Compte les opérateurs logiques
    const logicalOperators = findNodesByType(node, [
        '&&', '||', 'and', 'or'
    ]);
    
    complexity += logicalOperators.length;
    
    return Math.min(complexity, 10); // Normalisé à 10 max
}
```

### 4. Configuration Optimisée

```typescript
const OPTIMIZED_CONFIG: ChunkerConfig = {
    granularity: 'logical',
    chunkTypes: ['function', 'class', 'method', 'interface', 'import', 'export'],
    maxChunkSize: 1500,
    minChunkSize: 100,
    chunkOverlap: 200,
    includeDocumentation: true,
    includeContext: true,
    calculateQualityScores: true,
    extractRelations: true,
    detailLevel: 'comprehensive',
    
    rules: {
        neverSplitFunctions: true,
        neverSplitClasses: false, // Permet de diviser les classes complexes
        neverMixCodeAndText: true,
        respectSemanticBoundaries: true,
        groupImports: true,
        groupExports: true,
        collapseLargeFunctions: true,
        collapseLargeClasses: true,
        preferFunctions: true,
        
        // Nouvelles règles
        splitLargeClasses: true,
        maxMethodsPerChunk: 5,
        groupByVisibility: true,
        extractDecorators: true,
        calculateComplexity: true
    }
};
```

### 5. Métriques de Qualité Améliorées

```typescript
interface EnhancedQualityMetrics {
    // Métriques existantes
    atomicRate: number;
    documentedRate: number;
    relatedRate: number;
    semanticCoherence: number;
    
    // Nouvelles métriques
    chunkSizeDistribution: {
        small: number;    // < 500 tokens
        medium: number;   // 500-1500 tokens
        large: number;    // > 1500 tokens
    };
    
    complexityDistribution: {
        low: number;      // 1-3
        medium: number;   // 4-7
        high: number;     // 8-10
    };
    
    relationDensity: number; // Relations par chunk
    metadataCompleteness: number; // % de métadonnées extraites
}
```

### 6. Tests de Validation

#### Scénarios de test

1. **Petite fonction** : Doit produire 1 chunk atomique
2. **Classe complexe** : Doit produire N chunks (définition + groupes de méthodes)
3. **Fichier mixte** : Doit respecter les limites sémantiques
4. **Code avec décorateurs** : Doit extraire les décorateurs comme métadonnées
5. **Fonction asynchrone** : Doit détecter correctement `async`

#### Critères de succès

- Réduction de 30-50% du nombre de chunks pour les fichiers Python
- Amélioration de 20% de la complétude des métadonnées
- Maintien ou amélioration des scores de qualité
- Temps d'exécution similaire ou meilleur

## Plan d'Implémentation

### Phase 1 : Amélioration de la Détection

1. Étendre les types de nœuds dans `initializeNodeTypes()`
2. Ajouter des fonctions d'extraction améliorées
3. Tester avec les fichiers de référence

### Phase 2 : Nouvelles Règles

1. Implémenter la règle `class_hierarchical_chunk`
2. Implémenter la règle `optimized_function_chunk`
3. Ajouter les fonctions de calcul de complexité

### Phase 3 : Optimisation des Performances

1. Profiler le chunker actuel
2. Optimiser les traversées d'AST
3. Implémenter le caching des résultats d'analyse

### Phase 4 : Validation

1. Exécuter les tests existants
2. Ajouter des tests spécifiques aux nouvelles fonctionnalités
3. Valider sur des projets réels

## Impact Attendu

1. **Réduction du nombre de chunks** : De 2-3 à 1-2 chunks par structure principale
2. **Amélioration de la qualité** : Métadonnées plus complètes et précises
3. **Meilleure granularité** : Chunks plus cohérents sémantiquement
4. **Performance maintenue** : Temps d'exécution similaire ou amélioré

## Fichiers à Modifier

1. `src/rag/phase0/chunker/chunker-intelligent.ts`
   - `initializeNodeTypes()`
   - Ajout des nouvelles règles
   - Fonctions d'extraction améliorées

2. `src/rag/phase0/chunker/chunk-schema.ts`
   - Extension des interfaces de métadonnées
   - Nouvelles métriques de qualité

3. `test/phase0-chunker/test-chunker-intelligent.ts`
   - Ajout des tests pour les nouvelles fonctionnalités

4. `config/rag-config.json`
   - Ajout des nouvelles options de configuration
