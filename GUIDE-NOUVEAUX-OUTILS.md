# Guide des Nouveaux Outils - Système ToolRegistry

Ce document explique comment créer et enregistrer de nouveaux outils dans le système ToolRegistry.

## 📋 Vue d'Ensemble

Le système ToolRegistry permet :

- **Enregistrement automatique** des outils via convention de nommage
- **Gestion centralisée** de tous les outils
- **Exécution unifiée** avec validation des paramètres
- **Découverte dynamique** au démarrage

## 🛠️ Création d'un Nouvel Outil

### Étape 1 : Structure de Fichier

Créez un nouveau fichier dans `src/tools/` avec la convention suivante :

```
src/tools/[catégorie]/[nom-outil].ts
```

Exemple : `src/tools/graph/create-entities.ts`

### Étape 2 : Définition de l'Outil

Chaque outil doit exporter deux éléments :

1. **Définition de l'outil** (`*Tool`) : Schéma d'entrée et métadonnées
2. **Handler de l'outil** (`*Handler`) : Fonction d'exécution

```typescript
// Exemple : src/tools/graph/create-entities.ts
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { knowledgeGraphManager } from "../../knowledge-graph/manager.js";

// 1. Définition de l'outil
export const createEntitiesTool: Tool = {
  name: "create_entities",
  description: "Create multiple new entities in the knowledge graph",
  inputSchema: {
    type: "object",
    properties: {
      entities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "The name of the entity" },
            entityType: { type: "string", description: "The type of the entity" },
            observations: {
              type: "array",
              items: { type: "string" },
              description: "An array of observation contents associated with the entity"
            },
          },
          required: ["name", "entityType", "observations"],
        },
      },
    },
    required: ["entities"],
  },
};

// 2. Handler de l'outil
export async function createEntitiesHandler(args: any): Promise<any> {
  // Validation des arguments
  if (!args.entities || !Array.isArray(args.entities)) {
    throw new Error("The 'entities' parameter is required and must be an array");
  }

  // Exécution de la logique métier
  const result = await knowledgeGraphManager.createEntities(args.entities);
  
  // Formatage de la réponse
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2)
      }
    ]
  };
}
```

### Étape 3 : Convention de Nommage

- **Nom de l'outil** : `snake_case` (ex: `create_entities`)
- **Nom du fichier** : `kebab-case` (ex: `create-entities.ts`)
- **Variables exportées** :
  - `[nom]Tool` : Définition de l'outil
  - `[nom]Handler` : Handler de l'outil

## 🔄 Enregistrement Automatique

Le système découvre automatiquement les outils qui suivent la convention :

1. **Recherche récursive** dans `src/tools/`
2. **Filtrage** des fichiers `.ts` avec `*Tool` et `*Handler` exports
3. **Enregistrement** dans le ToolRegistry

### Fichier de Configuration : `src/core/registry.ts`

```typescript
// Exemple d'enregistrement automatique
export async function initializeAutoRegistry(options: { verbose?: boolean } = {}): Promise<number> {
  const toolFiles = await discoverToolFiles();
  let registeredCount = 0;

  for (const file of toolFiles) {
    try {
      const module = await import(file);
      
      // Recherche des exports Tool et Handler
      const toolName = Object.keys(module).find(key => key.endsWith('Tool'));
      const handlerName = Object.keys(module).find(key => key.endsWith('Handler'));
      
      if (toolName && handlerName) {
        const tool = module[toolName];
        const handler = module[handlerName];
        
        toolRegistry.register(tool, handler);
        registeredCount++;
        
        if (options.verbose) {
          console.log(`✅ Outil enregistré: ${tool.name}`);
        }
      }
    } catch (error) {
      console.error(`❌ Erreur lors de l'enregistrement de ${file}:`, error);
    }
  }

  return registeredCount;
}
```

## 🧪 Tests des Nouveaux Outils

### Test Unitaire

```typescript
// test-nouvel-outil.js
import { toolRegistry } from './build/core/tool-registry.js';

async function testNouvelOutil() {
  console.log('🧪 Test du nouvel outil...');
  
  // Vérifier que l'outil est enregistré
  if (!toolRegistry.hasTool('nouvel_outil')) {
    console.error('❌ L\'outil n\'est pas enregistré');
    return false;
  }
  
  // Tester l'exécution avec des arguments valides
  try {
    const result = await toolRegistry.execute('nouvel_outil', {
      // arguments valides
    });
    console.log('✅ Exécution réussie:', result);
    return true;
  } catch (error) {
    console.error('❌ Erreur d\'exécution:', error);
    return false;
  }
}
```

### Test d'Intégration

Ajoutez votre test à `run-all-tests.js` :

```javascript
const testFiles = [
  // ... tests existants
  'test-nouvel-outil.js',  // Ajoutez votre test ici
];
```

## 📊 Bonnes Pratiques

### 1. Validation des Arguments

- Toujours valider les types et la présence des arguments requis
- Fournir des messages d'erreur clairs

### 2. Gestion des Erreurs

- Capturer et logger les erreurs
- Retourner des erreurs structurées

### 3. Formatage des Réponses

- Retourner toujours un objet avec `content`
- Utiliser `type: "text"` pour les réponses textuelles
- Formater JSON avec indentation pour la lisibilité

### 4. Documentation

- Documenter le schéma d'entrée dans la description
- Inclure des exemples d'utilisation

## 🔍 Dépannage

### Problème : L'outil n'est pas enregistré

**Solution :**

1. Vérifier la convention de nommage (`*Tool` et `*Handler`)
2. Vérifier que le fichier est dans `src/tools/`
3. Vérifier les erreurs d'import dans `registry.ts`

### Problème : Erreur d'exécution

**Solution :**

1. Vérifier la validation des arguments
2. Vérifier les dépendances (imports)
3. Tester le handler isolément

### Problème : Schéma invalide

**Solution :**

1. Vérifier la structure du schéma JSON
2. Tester avec `ajv` ou un validateur JSON

## 📚 Exemples Complets

### Exemple 1 : Outil Simple

```typescript
// src/tools/util/hello-world.ts
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export const helloWorldTool: Tool = {
  name: "hello_world",
  description: "A simple hello world tool",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Name to greet"
      }
    },
    required: ["name"]
  }
};

export async function helloWorldHandler(args: any): Promise<any> {
  if (!args.name) {
    throw new Error("The 'name' parameter is required");
  }
  
  return {
    content: [{
      type: "text",
      text: `Hello, ${args.name}!`
    }]
  };
}
```

### Exemple 2 : Outil avec Logique Complexe

```typescript
// src/tools/rag/advanced-search.ts
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { searchEngine } from "../../rag/searcher.js";

export const advancedSearchTool: Tool = {
  name: "advanced_search",
  description: "Advanced semantic search with filters",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
      filters: {
        type: "object",
        properties: {
          language: { type: "string" },
          minScore: { type: "number" },
          maxResults: { type: "number" }
        }
      }
    },
    required: ["query"]
  }
};

export async function advancedSearchHandler(args: any): Promise<any> {
  const { query, filters = {} } = args;
  
  if (!query || typeof query !== 'string') {
    throw new Error("The 'query' parameter is required and must be a string");
  }
  
  const results = await searchEngine.advancedSearch(query, filters);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify(results, null, 2)
    }]
  };
}
```

## 🚀 Prochaines Étapes

1. **Créer votre outil** suivant la convention
2. **Tester localement** avec les tests unitaires
3. **Ajouter à la suite de tests** principale
4. **Documenter** dans le README
5. **Soumettre** pour revue

---

**Dernière mise à jour** : 27/12/2025  
**Version du système** : ToolRegistry v1.0.0  
**Statut** : Production Ready 🚀
