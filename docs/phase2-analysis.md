# Phase 2 - Analyse et Planification (Prime ID: 2)

**Date**: 27/12/2025 22:52:00  
**Statut**: En cours  
**Auteur**: Cline Assistant  
**Projet**: RAG MCP Server Refactoring

## 📊 Analyse de la Codebase Actuelle

### Structure des Fichiers

```
src/
├── index.ts                    # Point d'entrée principal
├── tools/
│   ├── graph-tools.ts         # 9 outils graphe + handler
│   └── rag-tools.ts           # 4 outils RAG + handler
├── knowledge-graph/
│   └── manager.ts            # Gestionnaire JSONL
└── rag/
    ├── indexer.ts            # Indexation projets
    ├── searcher.ts           # Recherche sémantique
    ├── vector-store.ts       # Stockage PostgreSQL
    ├── ignore-filter.ts      # Filtrage fichiers
    └── types.ts              # Types TypeScript
```

### Dépendances Actuelles

#### **Couche Outils → Gestionnaires**

```
graph-tools.ts → knowledgeGraphManager (JSONL)
rag-tools.ts → 
  ├── indexProject/updateProject (indexer.ts)
  ├── searchCode/getProjects/getProjectStatistics (searcher.ts)
  └── setEmbeddingProvider (vector-store.ts)
```

#### **Couche Routage**

```
index.ts → 
  ├── graphTools[] + executeGraphTool()
  └── ragTools[] + executeRagTool()
  Routing: ragToolLookup Map (préfixe "rag_")
```

### Points Forts de l'Architecture Actuelle

1. **Séparation claire** : Outils graph vs RAG
2. **Routing simple** : Préfixe "rag_" pour identification
3. **Modularité** : Fichiers séparés pour chaque domaine
4. **Rétrocompatibilité** : API MCP standard

### Points d'Amélioration Identifiés

1. **Switch/case monolithique** : Dans `executeGraphTool` et `executeRagTool`
2. **Pas de registry centralisée** : Outils déclarés dans 2 fichiers séparés
3. **Pas d'interface commune** : Chaque handler a sa propre signature
4. **Difficile à étendre** : Ajouter un outil = modifier 2+ fichiers

## 🎯 Plan de Migration Incrémentale

### **Principe Fondamental**

Migration progressive sans casser l'existant. Chaque étape doit être testable individuellement.

### **Étape 1 : Créer ToolRegistry (Tâche 2)**

- **Objectif** : Système central d'enregistrement
- **Approche** : Implémenter à côté de l'existant
- **Test** : Registry vide d'abord, puis ajout progressif

### **Étape 2 : Migrer Outils Graph par Batch (Tâches 3-5)**

- **Batch 1** (3 outils) : create_entities, create_relations, add_observations
- **Batch 2** (3 outils) : delete_entities, delete_observations, delete_relations
- **Batch 3** (3 outils) : read_graph, search_nodes, open_nodes
- **Approche** : Un outil à la fois, test après chaque migration

### **Étape 3 : Migrer Outils RAG (Tâche 6)**

- **Séquentiel** : rag_index_project → rag_search_code → rag_manage_projects → rag_update_project
- **Approche** : Garder préfixe "rag_" pour compatibilité

### **Étape 4 : Système Auto-enregistrement (Tâche 7)**

- **Objectif** : Chargement dynamique des modules
- **Approche** : Convention over configuration
- **Structure** : `src/tools/{category}/{tool-name}.ts`

### **Étape 5 : Adapter Point d'Entrée (Tâche 8)**

- **Objectif** : Remplacer ancien routing par ToolRegistry
- **Approche** : Double routing pendant transition
- **Test** : Vérifier que tous les outils fonctionnent

### **Étape 6 : Tests et Cleanup (Tâches 9-10)**

- **Tests** : Unitaires + intégration
- **Cleanup** : Supprimer anciens fichiers
- **Documentation** : Guide pour nouveaux outils

## 🔧 Structure Cible (Post-Migration)

```
src/
├── core/
│   └── tool-registry.ts      # ToolRegistry + interfaces
├── tools/
│   ├── registry.ts           # Auto-enregistrement
│   ├── graph/                # Outils graphe
│   │   ├── create-entities.ts
│   │   ├── create-relations.ts
│   │   ├── add-observations.ts
│   │   ├── delete-entities.ts
│   │   ├── delete-observations.ts
│   │   ├── delete-relations.ts
│   │   ├── read-graph.ts
│   │   ├── search-nodes.ts
│   │   └── open-nodes.ts
│   └── rag/                  # Outils RAG
│       ├── index-project.ts
│       ├── search-code.ts
│       ├── manage-projects.ts
│       └── update-project.ts
├── knowledge-graph/          # Inchangé (JSONL)
├── rag/                      # Inchangé
└── index.ts                  # Adapté pour ToolRegistry
```

## 📋 Matrice de Migration

| Outil | Fichier Source | Fichier Cible | Statut | Notes |
|-------|----------------|---------------|---------|-------|
| create_entities | graph-tools.ts | tools/graph/create-entities.ts | ❌ | Batch 1 |
| create_relations | graph-tools.ts | tools/graph/create-relations.ts | ❌ | Batch 1 |
| add_observations | graph-tools.ts | tools/graph/add-observations.ts | ❌ | Batch 1 |
| delete_entities | graph-tools.ts | tools/graph/delete-entities.ts | ❌ | Batch 2 |
| delete_observations | graph-tools.ts | tools/graph/delete-observations.ts | ❌ | Batch 2 |
| delete_relations | graph-tools.ts | tools/graph/delete-relations.ts | ❌ | Batch 2 |
| read_graph | graph-tools.ts | tools/graph/read-graph.ts | ❌ | Batch 3 |
| search_nodes | graph-tools.ts | tools/graph/search-nodes.ts | ❌ | Batch 3 |
| open_nodes | graph-tools.ts | tools/graph/open-nodes.ts | ❌ | Batch 3 |
| rag_index_project | rag-tools.ts | tools/rag/index-project.ts | ❌ | RAG 1 |
| rag_search_code | rag-tools.ts | tools/rag/search-code.ts | ❌ | RAG 2 |
| rag_manage_projects | rag-tools.ts | tools/rag/manage-projects.ts | ❌ | RAG 3 |
| rag_update_project | rag-tools.ts | tools/rag/update-project.ts | ❌ | RAG 4 |

## ⚠️ Risques Identifiés

### **Risque 1 : Rétrocompatibilité**

- **Impact** : Élevé (casse l'API MCP)
- **Mitigation** : Double routing pendant transition
- **Test** : Vérifier que tous les outils répondent

### **Risque 2 : Performance**

- **Impact** : Faible (routing supplémentaire)
- **Mitigation** : Cache des handlers dans Registry
- **Test** : Benchmarks avant/après

### **Risque 3 : Complexité Accrue**

- **Impact** : Modéré (nouveaux concepts)
- **Mitigation** : Documentation détaillée
- **Test** : Tests unitaires complets

## ✅ Critères de Succès Tâche 1

1. [x] Analyse complète de la codebase
2. [x] Documentation des dépendances
3. [x] Plan de migration incrémentale
4. [x] Identification des risques
5. [x] Structure cible définie

## 🚀 Prochaines Étapes

1. **Tâche 2** : Implémenter ToolRegistry Core
2. **Tâche 3** : Migrer Batch 1 outils graph
3. **Tâche 4** : Migrer Batch 2 outils graph
4. **Tâche 5** : Migrer Batch 3 outils graph
5. **Tâche 6** : Migrer outils RAG
6. **Tâche 7** : Système auto-enregistrement
7. **Tâche 8** : Adapter point d'entrée
8. **Tâche 9** : Tests et validation
9. **Tâche 10** : Cleanup et documentation

**Durée totale estimée** : 42 heures (Fibonacci progression)
**Date de début** : 27/12/2025
**Date de fin estimée** : 30/12/2025
