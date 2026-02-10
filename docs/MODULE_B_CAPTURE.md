# Module B : Capture Passive de Contexte VS Code

## 📋 Vue d'ensemble

Le Module B est responsable de la **capture passive** des événements VS Code. Contrairement à l'approche active (polling), ce module écoute passivement les événements VS Code et les transforme en format normalisé pour le pipeline MCP.

## 🎯 Objectifs

1. **Passivité** : Aucun appel manuel, uniquement des écouteurs d'événements
2. **Filtrage intelligent** : Ignorer les événements mineurs (scroll, hover, etc.)
3. **Normalisation** : Transformer les données brutes VS Code en JSON structuré
4. **Performance** : Minimal impact sur les performances de VS Code
5. **Fiabilité** : Gestion gracieuse des erreurs et logs structurés

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension                         │
├─────────────────────────────────────────────────────────────┤
│  Module B : Capture Passive                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │  Écouteurs  │→ │   Filtre    │→ │  Normalisateur   │   │
│  └─────────────┘  └─────────────┘  └──────────────────┘   │
│         │                         │              │         │
│  ┌──────▼─────┐           ┌───────▼──────┐ ┌────▼────────┐│
│  │ File Save  │           │   Logger     │ │ File Hasher ││
│  │ Diagnostic │           │  Structuré   │ └─────────────┘│
│  │ Workspace  │           └──────────────┘                │
│  └────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Composants

### 1. Écouteurs (Listeners)

#### `FileSaveListener`

- **Événement** : `onDidSaveTextDocument`
- **Responsabilité** : Capturer les sauvegardes de fichiers
- **Filtrage** : Vérifier si le fichier a réellement changé (via hash)
- **Données capturées** :

  ```typescript
  {
    document: vscode.TextDocument,
    timestamp: number,
    filePath: string,
    languageId: string,
    lineCount: number
  }
  ```

#### `DiagnosticsListener`

- **Événement** : `onDidChangeDiagnostics`
- **Responsabilité** : Capturer les changements de diagnostics (erreurs, warnings)
- **Filtrage** : Ignorer les diagnostics de faible sévérité (hint, information)
- **Données capturées** :

  ```typescript
  {
    uri: vscode.Uri,
    diagnostics: vscode.Diagnostic[],
    timestamp: number,
    severity: number
  }
  ```

#### `WorkspaceListener`

- **Événement** : `onDidChangeWorkspaceFolders`
- **Responsabilité** : Capturer les changements de workspace
- **Filtrage** : Toujours significatif (événements rares)
- **Données capturées** :

  ```typescript
  {
    event: vscode.WorkspaceFoldersChangeEvent,
    workspaceFolders: vscode.WorkspaceFolder[],
    timestamp: number
  }
  ```

### 2. Filtre d'événements (`EventFilter`)

#### Règles de filtrage

1. **Types ignorés par défaut** :
   - `textEditorSelectionChange`
   - `textEditorVisibleRangesChange`
   - `textEditorViewColumnChange`
   - `windowStateChange`

2. **Intervalles minimums** :
   - `file_save` : 1000ms (1 seconde)
   - `diagnostic` : 2000ms (2 secondes)
   - `workspace` : 5000ms (5 secondes)

3. **Vérification de significativité** :
   - **file_save** : Ignorer fichiers temporaires (.tmp, .log), node_modules, .vscode, .git
   - **diagnostic** : Accepter uniquement severity ≥ 2 (Warning ou Error)
   - **workspace** : Toujours significatif

#### API

```typescript
interface EventFilter {
  filter(event: RawVSCodeEvent): boolean;
  reset(): void;
  getStats(): FilterStats;
}

interface FilterStats {
  total_event_types: number;
  ignored_event_types: number;
  last_event_times: Record<string, number>;
}
```

### 3. Normalisateur d'événements (`EventNormalizer`)

#### Fonctionnalités

1. **Initialisation** : Génération d'IDs de projet et workspace
2. **Normalisation** : Transformation des données brutes en JSON structuré
3. **Sanitization** : Masquage des données sensibles (chemins absolus, tokens)
4. **Validation** : Conformité aux schémas JSON définis

#### Format de sortie

```json
{
  "event_uuid": "uuid-v4",
  "event_type": "file_save|diagnostic|workspace|error",
  "timestamp": "ISO-8601",
  "project_id": "hash-du-projet",
  "workspace_id": "hash-du-workspace",
  "source": "vscode",
  "version": "1.0.0",
  "payload": {
    // Données spécifiques au type d'événement
  },
  "metadata": {
    "normalized_at": "ISO-8601",
    "normalizer_version": "1.0.0",
    "source_timestamp": 1704067200000
  }
}
```

### 4. File Hasher (`FileHasher`)

#### Fonctionnalités

1. **Calcul de hash** : SHA-256 du contenu des fichiers
2. **Cache** : Mémorisation des hashs pour éviter recalculs inutiles
3. **Détection de changements** : Comparaison avec hash précédent
4. **Performance** : Calcul asynchrone pour ne pas bloquer VS Code

#### API

```typescript
interface FileHasher {
  hasFileChanged(
    filePath: string,
    previousHash: string | null,
  ): Promise<boolean>;
  computeHash(filePath: string): Promise<FileHash>;
  getCachedHash(filePath: string): string | null;
}

interface FileHash {
  filePath: string;
  hash: string;
  size: number;
  lastModified: number;
  algorithm: "sha256";
  computedAt: string;
}
```

### 5. Logger structuré

#### Format des logs

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "level": "info|debug|warn|error",
  "module": "context-capture",
  "component": "FileSaveListener|EventFilter|etc.",
  "message": "Message descriptif",
  "data": {
    // Données contextuelles
  }
}
```

## 🔧 Configuration

### Fichier de configuration

```json
{
  "capture": {
    "enabled": true,
    "filters": {
      "min_intervals": {
        "file_save": 1000,
        "diagnostic": 2000,
        "workspace": 5000
      },
      "ignored_event_types": [
        "textEditorSelectionChange",
        "textEditorVisibleRangesChange",
        "textEditorViewColumnChange",
        "windowStateChange"
      ],
      "ignored_file_patterns": [
        "\\.tmp$",
        "\\.log$",
        "node_modules",
        "\\.vscode",
        "\\.git"
      ]
    },
    "hashing": {
      "algorithm": "sha256",
      "cache_ttl_ms": 300000
    },
    "logging": {
      "level": "info",
      "structured": true
    }
  }
}
```

## 🧪 Tests

### Tests unitaires

- **Écouteurs** : `file-save.listener.test.ts`, `diagnostics.listener.test.ts`, `workspace.listener.test.ts`
- **Filtre** : `event.filter.test.ts`
- **Normalisateur** : `event.normalizer.test.ts`
- **File Hasher** : `file-hasher.test.ts`

### Tests d'intégration

- **Flux complet** : `integration.test.ts`
- **Scénarios testés** :
  1. Capture et normalisation d'événements
  2. Filtrage d'événements non significatifs
  3. Gestion des erreurs
  4. Performance avec événements multiples

## 📊 Métriques

### Métriques collectées

1. **Volume** : Nombre d'événements capturés/filtrés/normalisés
2. **Performance** : Temps de traitement par événement
3. **Erreurs** : Taux d'erreurs par composant
4. **Filtrage** : Pourcentage d'événements filtrés

### Dashboard de monitoring

```typescript
interface CaptureMetrics {
  events_captured: number;
  events_filtered: number;
  events_normalized: number;
  avg_processing_time_ms: number;
  error_rate: number;
  filter_efficiency: number; // % d'événements filtrés
}
```

## 🚀 Utilisation

### Initialisation

```typescript
import { ContextCaptureModule } from "./modules/context-capture";

const captureModule = new ContextCaptureModule();
await captureModule.initialize();

// Le module commence automatiquement à capturer les événements
```

### Configuration personnalisée

```typescript
const captureModule = new ContextCaptureModule({
  filters: {
    min_intervals: {
      file_save: 2000, // 2 secondes
      diagnostic: 3000, // 3 secondes
    },
  },
  logging: {
    level: "debug",
  },
});
```

### Arrêt

```typescript
await captureModule.dispose();
```

## 🔄 Flux de données

### Flux normal

```
1. Événement VS Code déclenché
2. Écouteur capture l'événement brut
3. File Hasher vérifie si le fichier a changé (pour file_save)
4. EventFilter applique les règles de filtrage
5. EventNormalizer transforme en JSON structuré
6. Événement normalisé prêt pour le Module C (Déclencheurs)
```

### Flux avec filtrage

```
1. Événement VS Code déclenché
2. Écouteur capture l'événement brut
3. File Hasher détecte aucun changement OU
4. EventFilter rejette l'événement
5. Événement ignoré, pas de normalisation
```

## ⚠️ Gestion des erreurs

### Types d'erreurs gérés

1. **Erreurs de normalisation** : Retour null, log d'erreur
2. **Erreurs de filtrage** : Exception attrapée, événement ignoré
3. **Erreurs de file hasher** : Promise rejetée, événement ignoré
4. **Erreurs d'initialisation** : Module désactivé, logs d'erreur

### Stratégies de récupération

1. **Retry limité** : 3 tentatives maximum
2. **Fallback silencieux** : Ignorer l'événement en cas d'erreur
3. **Logs structurés** : Toutes les erreurs sont loggées
4. **Métriques d'erreur** : Suivi des taux d'erreur

## 🔍 Dépannage

### Problèmes courants

1. **Aucun événement capturé**
   - Vérifier que le module est initialisé
   - Vérifier les logs pour erreurs d'initialisation
   - Vérifier les filtres configurés

2. **Événements filtrés trop agressivement**
   - Ajuster les intervalles minimums
   - Vérifier les patterns de fichiers ignorés
   - Vérifier les règles de significativité

3. **Performances dégradées**
   - Vérifier le volume d'événements
   - Ajuster les intervalles de filtrage
   - Vérifier les calculs de hash

### Commandes de debug

```bash
# Activer les logs détaillés
export VSCODE_CAPTURE_LOG_LEVEL=debug

# Désactiver le filtrage (pour debug)
export VSCODE_CAPTURE_DISABLE_FILTERS=true

# Désactiver le file hasher (pour debug)
export VSCODE_CAPTURE_DISABLE_HASHING=true
```

## 📈 Évolution future

### Améliorations planifiées

1. **Filtrage adaptatif** : Ajustement automatique des règles basé sur les patterns d'usage
2. **Compression** : Compression des payloads volumineux
3. **Batch processing** : Regroupement d'événements similaires
4. **Priorisation** : Priorité aux événements critiques (erreurs)

### Extensibilité

1. **Nouveaux écouteurs** : Ajout facile de nouveaux types d'événements
2. **Plugins de filtrage** : Filtres personnalisables
3. **Transformateurs** : Transformations personnalisées des données

## 📚 Références

### Fichiers source

- `extension-rag/src/modules/context-capture/` : Code source du module
- `extension-rag/src/models/event-schemas.ts` : Schémas JSON
- `extension-rag/src/models/events.ts` : Interfaces TypeScript

### Documentation liée

- [ARCHITECTURE_CONTEXT_CAPTURE.md](./ARCHITECTURE_CONTEXT_CAPTURE.md) : Architecture détaillée
- Schémas JSON : Documentation des formats de données
- Tests : Exemples d'utilisation et de configuration

---

**Version** : 1.0.0
**Dernière mise à jour** : 2026-02-09
**Auteur** : Module B - Capture Passive
**Statut** : ✅ Production Ready
