# 📊 Analyse Architecture Existante - Extension VS Code RAG MCP

**Date d'analyse** : 09/02/2026
**Tâche** : T1.1 - Analyse architecture existante
**Validation** : Document produit avec mapping des composants existants ✓

## 🎯 Objectif

Examiner tous les fichiers de l'extension VS Code existante et documenter la structure actuelle pour préparer la transformation en capteur de contexte passif.

## 📁 Structure des Fichiers

### **Répertoire principal : `extension-rag/`**

```
extension-rag/
├── src/
│   ├── extension.ts                    # Point d'entrée principal
│   ├── commands/                       # Commandes VS Code
│   ├── models/                         # Modèles et schémas
│   │   ├── event-schemas.ts            # Schémas JSON événements
│   │   ├── events.ts                   # Interfaces TypeScript
│   │   ├── json-schemas.ts             # Types JSON Schema
│   │   └── validator.ts                # Validation Ajv
│   ├── services/                       # Services métier
│   │   ├── ContextService.ts           # Service de contexte (actif)
│   │   ├── error-handler.ts            # Gestion des erreurs
│   │   ├── McpClient.ts                # Client MCP (actif)
│   │   ├── McpClient.ts.backup         # Backup
│   │   └── MonitoringReader.ts         # Lecture monitoring (read-only)
│   └── views/                          # Vues WebView
│       ├── ConfigView.ts
│       ├── DashboardView.ts
│       ├── LogView.ts
│       └── MonitorView.ts
├── test/                               # Tests unitaires
├── package.json                        # Configuration npm
├── tsconfig.json                       # Configuration TypeScript
└── jest.config.js                      # Configuration Jest
```

## 🔧 Composants Principaux

### **1. Point d'Entrée (`extension.ts`)**

- **Rôle** : Activation/désactivation de l'extension
- **Fonctionnalités** :
  - Initialisation du `MonitoringReader`
  - Enregistrement des commandes VS Code (5 commandes)
  - Vérification de la disponibilité du monitoring
  - Affichage des dashboards WebView

### **2. Service de Contexte (`ContextService.ts`)**

- **Rôle** : Collecte active du contexte VS Code
- **Problème identifié** : Service **actif** avec méthode publique `getFullContext()`
- **Fonctionnalités** :
  - Récupération workspace info
  - Configuration VS Code
  - Informations Git
  - Structure projet
  - État éditeur
  - Extensions installées
- **Interface publique à supprimer** : `getFullContext()`

### **3. Schémas Événements (`models/`)**

- **État** : ✅ **Déjà implémenté** selon les spécifications
- **Schémas disponibles** :
  - `file_save` : Sauvegarde fichier
  - `diagnostic` : Diagnostics/erreurs
  - `workspace` : Changements workspace
  - `error` : Erreurs système
- **Conformité** : Respecte R3 (JSON strict), R4 (Architecture RAG)

### **4. Client MCP (`McpClient.ts`)**

- **Rôle** : Communication avec le serveur MCP
- **Problème identifié** : Client **actif** avec envoi manuel
- **À adapter** : Transformer en client **passif** avec file d'attente

### **5. Monitoring Reader (`MonitoringReader.ts`)**

- **Rôle** : Lecture des fichiers de monitoring RAG
- **État** : Read-only (bonne base pour capture passive)
- **Réutilisable** : Logique de lecture peut être adaptée

## 📊 Mapping des Dépendances

### **Dépendances (`package.json`)**

```json
{
  "dependencies": {
    "ajv": "^8.17.1"                    # Validation JSON Schema
  },
  "devDependencies": {
    "@types/jest": "^30.0.0",
    "@types/node": "^20.0.0",
    "@types/vscode": "^1.96.0",
    "@vscode/vsce": "^3.2.0",
    "jest": "^30.2.0",
    "ts-jest": "^29.4.6",
    "typescript": "^5.0.0"
  }
}
```

### **Configuration TypeScript (`tsconfig.json`)**

- **Cible** : ES2022
- **Modules** : CommonJS
- **Lib** : ES2022 + DOM (pour WebViews)
- **Strict** : true (bonne pratique)

## 🔄 Flux Actuel vs Flux Cible

### **Flux Actuel (Problématique)**

```
Événement VS Code → [IGNORÉ] → Extension (read-only monitoring)
```

### **Flux Cible (Architecture 3 Modules)**

```
Événement VS Code → Module B (Capture) → Module C (Déclencheur) → MCP → RAG
```

## 🎯 Points de Transformation Identifiés

### **1. Module B - Capture Passive**

- **Refactoriser** : `ContextService.ts` → écouteurs passifs
- **Supprimer** : Méthode publique `getFullContext()`
- **Ajouter** : Écouteurs `onFileSave`, `onDiagnosticsChange`, `onWorkspaceChange`
- **Implémenter** : Filtrage événements mineurs

### **2. Module C - Déclencheurs**

- **Adapter** : `McpClient.ts` → client passif avec file d'attente
- **Ajouter** : Sérialisation JSON MCP
- **Implémenter** : Retry automatique avec backoff

### **3. Pipeline MCP**

- **Créer** : Nouveau projet `mcp-context-pipeline/`
- **Implémenter** : Outil MCP `receive-vscode-context`
- **Ajouter** : Validation JSON Schema (utiliser Ajv existant)

## ✅ Éléments Réutilisables

### **✅ Déjà Conformes**

1. **Schémas JSON** : `event-schemas.ts` (4 schémas complets)
2. **Interfaces TypeScript** : `events.ts` (types générés)
3. **Validation Ajv** : `validator.ts` (configuré)
4. **Structure tests** : `jest.config.js` (prêt)

### **🔄 À Adapter**

1. **ContextService** : Passif → écouteurs
2. **McpClient** : Actif → passif avec file d'attente
3. **MonitoringReader** : Read-only → peut inspirer la logique de lecture

### **➕ À Créer**

1. **Pipeline MCP** : Nouveau projet séparé
2. **Stockage SQL** : Tables minimales (events, files, errors, audit_log)
3. **Intégration RAG** : Service d'indexation différée

## 📋 Checklist Pré-Transformation

### **Phase 1 - Fondations (8 tâches)**

- [x] **T1.1** : Analyse architecture existante ✓
- [ ] T1.2 : Définir schémas JSON événements (✅ déjà fait)
- [ ] T1.3 : Créer interface TypeScript événements (✅ déjà fait)
- [ ] T1.4 : Configurer Ajv pour validation (✅ déjà fait)
- [ ] T1.5 : Créer script SQL schéma
- [ ] T1.6 : Configurer environnement développement
- [ ] T1.7 : Documenter architecture cible
- [ ] T1.8 : Configurer tests unitaires base

## 🚀 Recommandations pour la Suite

### **Priorité 1 : Refactorisation ContextService**

1. Supprimer `getFullContext()` publique
2. Créer écouteurs passifs dans `modules/context-capture/listeners/`
3. Implémenter filtrage événements mineurs

### **Priorité 2 : Pipeline MCP**

1. Créer structure `mcp-context-pipeline/`
2. Implémenter outil MCP `receive-vscode-context`
3. Tester intégration avec serveur MCP existant

### **Priorité 3 : Stockage SQL**

1. Créer schéma SQL minimal
2. Implémenter DAO basique
3. Ajouter indexes pour performance

## 📈 Métriques d'Architecture

| Composant      | État         | Conformité | Action Requise  |
| -------------- | ------------ | ---------- | --------------- |
| Schémas JSON   | ✅ Complet   | R3, R4     | Aucune          |
| Interfaces TS  | ✅ Complet   | -          | Aucune          |
| Validation     | ✅ Configuré | -          | Aucune          |
| ContextService | ❌ Actif     | R2         | Refactorisation |
| McpClient      | ❌ Actif     | R2         | Adaptation      |
| Tests          | ⚠️ Partiel   | R10        | Compléter       |
| Logs           | ❌ Manquant  | R10        | Implémenter     |

## 🔗 Liens avec les Règles Absolues

### **R2 : Séparation des responsabilités**

- **Problème** : `ContextService` mélange capture et logique métier
- **Solution** : Module B dédié à la capture passive

### **R3 : JSON strict**

- **État** : ✅ Conforme (schémas existants)
- **Vérification** : Pas d'icônes dans JSON métier

### **R10 : Testabilité obligatoire**

- **État** : ⚠️ Tests partiels
- **Action** : Compléter tests unitaires pour nouveaux modules

---

**Document validé** : ✓ Mapping complet des composants existants produit
**Prochaine étape** : T1.2 - Définir schémas JSON événements (déjà fait, passer à T1.5)
