# 🐛 Configuration de Debug VS Code - RAG MCP Extension

Ce document décrit les configurations de debug disponibles pour l'extension RAG MCP et le serveur WebSocket associé.

## 📋 Configurations disponibles

### 1. **Run Extension** (Configuration par défaut)

- **Type** : Extension Host
- **Description** : Démarre l'extension dans une fenêtre VS Code dédiée
- **Pré-requis** : Serveur WebSocket MCP doit être déjà en cours d'exécution
- **Utilisation** : Pour déboguer uniquement l'extension

### 2. **Start WebSocket MCP Server**

- **Type** : Node.js
- **Description** : Démarre le serveur WebSocket MCP sur le port 3000
- **Programme** : `../build/index-websocket.js`
- **Répertoire** : Racine du projet parent
- **Terminal** : Terminal intégré avec sortie visible
- **Environnement** : `NODE_ENV=development`
- **Pré-tâche** : Compilation du projet (`npm: build (workspace)`)

### 3. **Extension + WebSocket Server** (Configuration automatique)

- **Type** : Extension Host avec action serveur
- **Description** : Démarre l'extension et détecte automatiquement le serveur
- **Fonctionnalité** : `serverReadyAction` détecte le message "WebSocket server started on port 3000"
- **Comportement** : Démarre automatiquement le serveur WebSocket quand l'extension est lancée
- **Arrêt** : Le serveur s'arrête automatiquement quand le debug de l'extension s'arrête

### 4. **Full Stack Debug** (Configuration composée)

- **Type** : Compound (configuration multiple)
- **Description** : Démarre simultanément l'extension ET le serveur WebSocket
- **Configurations** : ["Run Extension", "Start WebSocket MCP Server"]
- **Avantage** : Debug complet de toute la stack en une seule action

### 5. **Extension Tests**

- **Type** : Extension Host pour tests
- **Description** : Exécute les tests unitaires de l'extension
- **Utilisation** : Pour déboguer les tests

## 🚀 Guide d'utilisation rapide

### Option A : Déboguer l'extension seule (serveur déjà démarré)

1. Démarrer le serveur WebSocket : `./scripts/start-websocket.sh`
2. Dans VS Code : `F5` → Sélectionner "Run Extension"
3. Tester les commandes de l'extension

### Option B : Déboguer l'extension + serveur (recommandé)

1. Dans VS Code : `F5` → Sélectionner "Extension + WebSocket Server"
2. VS Code démarre automatiquement :
   - L'extension dans une nouvelle fenêtre
   - Le serveur WebSocket en arrière-plan
3. Tout est intégré et s'arrête proprement

### Option C : Déboguer toute la stack simultanément

1. Dans VS Code : `F5` → Sélectionner "Full Stack Debug"
2. VS Code démarre deux sessions de debug :
   - Serveur WebSocket (terminal visible)
   - Extension (fenêtre séparée)
3. Permet de mettre des breakpoints dans les deux parties

## 🔧 Configuration technique

### Pré-requis

- **Node.js** : Version 16+ recommandée
- **VS Code** : Version 1.85+ recommandée
- **Extensions VS Code** :
  - TypeScript/JavaScript
  - Debugger for Chrome (pour les WebViews)

### Structure des fichiers

```
extension-rag/
├── .vscode/
│   └── launch.json          # Configurations de debug
├── docs/
│   └── DEBUG_CONFIGURATION.md  # Ce fichier
├── out/                     # Fichiers compilés
└── src/                     # Code source TypeScript
```

### Variables d'environnement

- `NODE_ENV=development` : Active le mode développement
- `DEBUG=*` : Pour activer les logs détaillés (optionnel)

## 🐛 Dépannage

### Problème : "Cannot connect to WebSocket server"

**Solutions** :

1. Vérifier que le serveur est démarré : `./scripts/status-websocket.sh`
2. Vérifier le port 3000 : `netstat -tlnp | grep 3000`
3. Redémarrer le serveur : `./scripts/stop-websocket.sh && ./scripts/start-websocket.sh`

### Problème : "Extension fails to compile"

**Solutions** :

1. Exécuter la compilation manuelle : `npm run compile`
2. Vérifier les erreurs TypeScript : `npm run type-check`
3. Nettoyer et recompiler : `npm run clean && npm run compile`

### Problème : "Debug configuration not showing"

**Solutions** :

1. Recharger la fenêtre VS Code : `Ctrl+Shift+P` → "Developer: Reload Window"
2. Vérifier le fichier `launch.json` pour les erreurs de syntaxe
3. Redémarrer VS Code

## 🔍 Fonctionnalités avancées

### Breakpoints

- **Extension** : Breakpoints dans `src/` (TypeScript)
- **Serveur** : Breakpoints dans `../src/` (code du serveur MCP)
- **WebViews** : Breakpoints dans le code frontend des WebViews

### Watch Expressions

- Variables à surveiller pendant le debug
- Expressions JavaScript évaluées en temps réel

### Call Stack

- Navigation dans la pile d'appels
- Inspection des variables à chaque niveau

### Console de debug

- Sortie des logs `console.log()`
- Évaluation d'expressions JavaScript
- Inspection d'objets

## 📚 Ressources supplémentaires

- [Documentation VS Code Debugging](https://code.visualstudio.com/docs/editor/debugging)
- [Guide TypeScript Debugging](https://code.visualstudio.com/docs/typescript/typescript-debugging)
- [Extension Development](https://code.visualstudio.com/api/get-started/your-first-extension)

## 🎯 Bonnes pratiques

1. **Utiliser "Extension + WebSocket Server"** pour le développement quotidien
2. **Tester avec "Full Stack Debug"** pour les problèmes complexes
3. **Vérifier les logs** dans la console de debug
4. **Utiliser les scripts shell** pour les opérations manuelles
5. **Documenter les breakpoints** importants dans le code

---

**Dernière mise à jour** : 31/01/2026
**Version configuration** : 2.0
**Compatibilité** : VS Code 1.85+, Node.js 16+
