# RAG MCP Extension for VS Code (Read-Only)

**Extension VS Code pour surveillance read-only du serveur RAG MCP**

> ⚠️ **IMPORTANT : Cette extension est une interface de surveillance READ-ONLY.**
>
> **Elle lit uniquement les fichiers de monitoring générés par le moteur RAG MCP.**
>
> **Aucune interaction avec le moteur RAG, aucune connexion WebSocket, aucune opération d'écriture.**

## 🎯 Objectif

Cette extension VS Code fournit une interface de **surveillance read-only** pour le serveur RAG MCP. Elle permet aux développeurs humains de :

- **Lire** les métriques système depuis les fichiers JSON
- **Visualiser** le statut de santé du système
- **Consulter** les événements récents
- **Surveiller** les tâches en cours

**Elle ne se connecte pas au serveur RAG MCP, elle lit uniquement les fichiers de monitoring.**

## 🚫 Ce que cette extension NE FAIT PAS

- ❌ **Ne se connecte pas** au serveur RAG MCP via WebSocket
- ❌ **N'exécute pas** les opérations RAG (init_rag, activated_rag, query_rag)
- ❌ **Ne modifie pas** les fichiers de monitoring
- ❌ **N'interagit pas** avec le moteur RAG
- ❌ **Ne remplace pas** les outils MCP pour l'IA

## ✅ Ce que cette extension FAIT (Read-Only)

- ✅ **Dashboard** : Interface de surveillance complète
- ✅ **Métriques** : Lecture des métriques système depuis `rag/monitoring/metrics.json`
- ✅ **Santé** : Lecture du statut de santé depuis `rag/monitoring/health/latest.json`
- ✅ **Événements** : Lecture des événements depuis `rag/monitoring/events/`
- ✅ **Progression** : Lecture des tâches en cours depuis `rag/monitoring/progress/`

## 📊 Vues disponibles

### 1. **Dashboard** (`RAG MCP: Show Dashboard`)

Interface centrale avec :

- Métriques système (CPU, mémoire, uptime, threads)
- File d'attente (tâches en attente, actives, terminées, échouées)
- Statut de santé avec vérifications détaillées
- Événements récents (5 derniers événements)

### 2. **Métriques** (`RAG MCP: Show Metrics`)

Affichage détaillé des métriques :

- Système : démarrage, uptime, CPU, mémoire, threads
- Performance : temps réponse moyen, requêtes/seconde, taux d'erreur
- Projets : nombre de projets, fichiers indexés, statut

### 3. **Santé** (`RAG MCP: Show Health`)

Statut de santé détaillé :

- Statut global (healthy, degraded, unhealthy)
- Vérifications individuelles (pass, fail, warning)
- Dernière vérification

### 4. **Événements** (`RAG MCP: Show Events`)

Événements du jour :

- 10 derniers événements
- Type d'événement (info, warning, error, phase_started, etc.)
- Timestamp et message

## ⚙️ Configuration

### Configuration VS Code

```json
{
  "rag-mcp.autoRefresh": true
}
```

### Commandes disponibles

| Commande                     | Description                      | Usage                |
| ---------------------------- | -------------------------------- | -------------------- |
| `RAG MCP: Show Dashboard`    | Ouvre le dashboard principal     | Surveillance humaine |
| `RAG MCP: Get System Status` | Affiche le statut système rapide | Surveillance humaine |
| `RAG MCP: Show Metrics`      | Affiche les métriques détaillées | Surveillance humaine |
| `RAG MCP: Show Health`       | Affiche le statut de santé       | Surveillance humaine |
| `RAG MCP: Show Events`       | Affiche les événements récents   | Surveillance humaine |

## 🏗️ Architecture

### Séparation stricte monitoring/moteur

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Moteur RAG    │    │   Fichiers      │    │   Extension     │
│                 │    │   Monitoring    │    │   VS Code       │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • Monitoring    │───▶│ • metrics.json  │◀───│ • Dashboard     │
│   Writer        │    │ • health/       │    │ • Metrics       │
│   (write-only)  │    │ • events/       │    │ • Health        │
│                 │    │ • progress/     │    │ • Events        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
       │                       │                       │
       └───────────────────────┴───────────────────────┘
                 Écriture seule       Lecture seule
```

### Points clés d'architecture

1. **Moteur → Fichiers** : Écriture seule par le `MonitoringWriter`
2. **Fichiers → Extension** : Lecture seule par le `MonitoringReader`
3. **Pas de connexion directe** : Aucun WebSocket, aucune API
4. **Séparation stricte** : Conformité règle #25 (anti-duplication)

## 🚀 Développement

### Prérequis

- Node.js 18+
- VS Code 1.96+
- Serveur RAG MCP avec monitoring activé

### Installation développement

```bash
cd extension-rag
npm install
npm run compile
```

### Debug

1. Ouvrir le dossier `extension-rag` dans VS Code
2. Appuyer sur **F5** pour démarrer le debug
3. Utiliser la configuration "Run Extension"

### Structure du code

```
extension-rag/
├── src/
│   ├── extension.ts          # Point d'entrée principal
│   ├── services/
│   │   └── MonitoringReader.ts # Service read-only pour lire les fichiers
│   └── models/               # (Optionnel) Modèles de données
├── package.json              # Manifest extension
└── tsconfig.json            # Configuration TypeScript
```
