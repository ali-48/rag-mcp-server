# 📊 Initialisation des Bases de Données RAG MCP Server

**Version :** 1.0.0
**Dernière mise à jour :** 2026-02-07
**Auteur :** Cline Assistant IA
**Statut :** ✅ Production Ready

---

## 📋 Table des Matières

1. [🎯 Vue d'ensemble](#-vue-densemble)
2. [🏗️ Architecture des Bases de Données](#️-architecture-des-bases-de-données)
3. [📁 Structure des Répertoires](#-structure-des-répertoires)
4. [🔧 Composants d'Initialisation](#-composants-dinitialisation)
5. [🚀 Processus d'Initialisation](#-processus-dinitialisation)
6. [⚙️ Configuration PostgreSQL](#️-configuration-postgresql)
7. [🧪 Tests et Validation](#-tests-et-validation)
8. [🔍 Dépannage](#-dépannage)
9. [📚 Références API](#-références-api)
10. [🔮 Évolution Future](#-évolution-future)

---

## 🎯 Vue d'ensemble

Le système RAG MCP Server utilise **trois types de bases de données** pour gérer différents aspects du pipeline :

| Base de Données     | Type                                      | Rôle                                             | Emplacement                                                  |
| ------------------- | ----------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| **metadata.sqlite** | SQLite                                    | Métadonnées projets, fichiers, statut indexation | `/rag/db/metadata.sqlite`                                    |
| **memory.sqlite**   | SQLite                                    | Cache, historique contexte, sessions actives     | `/rag/db/memory.sqlite`                                      |
| **Vecteurs**        | PostgreSQL (priorité) / SQLite (fallback) | Stockage embeddings vectoriels                   | PostgreSQL: `rag_vectors` / SQLite: `/rag/db/vectors.sqlite` |

### 🔑 Principes de Conception

1. **Centralisation** : Toutes les bases de données dans `/rag/db/`
2. **Résilience** : Fallback automatique PostgreSQL → SQLite
3. **Isolation** : Séparation claire des responsabilités
4. **Observabilité** : Monitoring et logs intégrés
5. **Testabilité** : Scripts de test complets

---

## 🏗️ Architecture des Bases de Données

### 📊 metadata.sqlite

```sql
-- Schéma principal
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_indexed TIMESTAMP,
  status TEXT CHECK(status IN ('pending', 'indexing', 'indexed', 'error'))
);

CREATE TABLE files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT REFERENCES projects(id),
  path TEXT NOT NULL,
  hash TEXT,
  indexed_at TIMESTAMP,
  status TEXT CHECK(status IN ('pending', 'indexed', 'error'))
);

CREATE TABLE index_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT REFERENCES projects(id),
  phase TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT
);
```

### 🧠 memory.sqlite

```sql
-- Cache et mémoire
CREATE TABLE cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE context_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  context TEXT NOT NULL,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE active_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 🧮 PostgreSQL (Vecteurs)

```sql
-- Extension pgvector requise
CREATE EXTENSION IF NOT EXISTS vector;

-- Schéma rag_schema
CREATE SCHEMA IF NOT EXISTS rag_schema;

CREATE TABLE rag_schema.rag_vectors (
  id SERIAL PRIMARY KEY,
  embedding VECTOR(1536),
  content TEXT NOT NULL,
  metadata JSONB,
  project_id VARCHAR(255),
  file_path VARCHAR(1024),
  chunk_index INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour recherche vectorielle
CREATE INDEX idx_rag_vectors_embedding ON rag_schema.rag_vectors
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

## 📁 Structure des Répertoires

```
/rag/
├── db/                    # Bases de données centralisées
│   ├── metadata.sqlite    # Métadonnées projets/fichiers
│   ├── memory.sqlite      # Cache et mémoire
│   └── vectors.sqlite     # Fallback vecteurs (si PostgreSQL indisponible)
├── state/                 # États persistants
│   ├── init.json          # État initialisation
│   ├── projects.json      # Liste projets
│   └── failures.json      # Échecs d'indexation
└── monitoring/           # Métriques et logs
    ├── metrics.json      # Métriques système
    └── alerts.json       # Alertes configurées
```

### 🔧 Création des Répertoires

```bash
# Créer la structure complète
mkdir -p /rag/{db,state,monitoring}

# Vérifier les permissions
chmod 755 /rag /rag/db /rag/state /rag/monitoring
```

---

## 🔧 Composants d'Initialisation

### 1. SqliteInitializer (`src/rag/daemon/sqlite-initializer.ts`)

Classe singleton pour gérer l'initialisation SQLite.

**Fonctions principales :**

```typescript
interface SqliteInitializer {
  // Initialisation
  initializeMetadataDb(force?: boolean): Promise<void>;
  initializeMemoryDb(force?: boolean): Promise<void>;

  // Vérification
  checkDatabaseStatus(): Promise<DatabaseStatus>;

  // Maintenance
  backupDatabases(backupDir: string): Promise<void>;
  cleanupOldBackups(retentionDays: number): Promise<void>;
}
```

### 2. Metadata Database API (`src/rag/db/metadata-database.ts`)

API haut niveau pour metadata.sqlite.

**Fonctions :**

```typescript
// Initialisation
initializeMetadataDatabase(config: MetadataDatabaseConfig): Promise<MetadataDatabaseResult>

// Vérification
isMetadataDatabaseInitialized(dbDir?: string): Promise<boolean>
getMetadataDatabaseInfo(dbDir?: string): Promise<MetadataDatabaseInfo>

// Maintenance
resetMetadataDatabase(dbDir?: string, backupDir?: string): Promise<MetadataDatabaseResult>
```

### 3. Vector Database API (`src/rag/db/vector-database.ts`)

API pour gestion vecteurs avec fallback.

**Fonctions :**

```typescript
// Initialisation avec fallback automatique
initializeVectorDatabase(config: VectorDatabaseConfig): Promise<VectorDatabaseResult>

// Types supportés
type VectorDatabaseType = 'postgresql' | 'sqlite'

// Configuration PostgreSQL
interface PostgreSQLConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
  ssl?: boolean
}
```

### 4. Persistent State (`src/rag/daemon/persistent-state.ts`)

Intégration centrale avec chemins configurés.

**Chemins centraux :**

```typescript
const RAG_DB_DIR = "/rag/db";
const RAG_STATE_DIR = "/rag/state";
const RAG_MONITORING_DIR = "/rag/monitoring";
```

---

## 🚀 Processus d'Initialisation

### 📋 Étapes Séquentielles

1. **Vérification préalable**

   ```typescript
   // Vérifier les dépendances
   await checkDependencies();

   // Créer les répertoires
   await ensureDirectoriesExist();
   ```

2. **Initialisation metadata.sqlite**

   ```typescript
   const metadataResult = await initializeMetadataDatabase({
     dbDir: "/rag/db",
     force: false,
     verbose: true,
   });
   ```

3. **Initialisation memory.sqlite**

   ```typescript
   // Gérée automatiquement par SqliteInitializer
   // via persistent-state.ts
   ```

4. **Configuration PostgreSQL**

   ```typescript
   // Charger la configuration
   import postgresqlConfig from "../config/postgresql-config.json";
   const devConfig = postgresqlConfig.environments.development;
   ```

5. **Initialisation vecteurs**

   ```typescript
   const vectorResult = await initializeVectorDatabase({
     type: "postgresql",
     postgresql: devConfig,
     fallbackToSqlite: true,
     verbose: true,
   });
   ```

6. **Vérification finale**

   ```typescript
   const allInitialized = await Promise.all([
     isMetadataDatabaseInitialized(),
     isVectorDatabaseInitialized(),
   ]);
   ```

### ⚡ Script d'Initialisation Rapide

```bash
# Exécuter le script de test
node scripts/test-database-initialization.js

# Ou utiliser directement les APIs
node -e "
  import('./src/rag/db/metadata-database.js')
    .then(m => m.demonstrateMetadataDatabase())
    .catch(console.error)
"
```

---

## ⚙️ Configuration PostgreSQL

### 📄 Fichier de Configuration

`config/postgresql-config.json`

**Environnements prédéfinis :**

```json
{
  "development": {
    "host": "localhost",
    "port": 5432,
    "database": "rag_vectors_dev",
    "user": "postgres",
    "password": "postgres",
    "ssl": false
  },
  "production": {
    "host": "localhost",
    "port": 5432,
    "database": "rag_vectors",
    "user": "rag_user",
    "password": "${POSTGRES_PASSWORD}",
    "ssl": true
  }
}
```

### 🔧 Installation PostgreSQL

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Installer pgvector
sudo -u postgres psql -c "CREATE EXTENSION vector;"

# Créer la base de données
sudo -u postgres createdb rag_vectors_dev
```

### 🔐 Variables d'Environnement

```bash
# .env file
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=rag_vectors
POSTGRES_USER=rag_user
POSTGRES_PASSWORD=secure_password_here
POSTGRES_SSL=true
```

---

## 🧪 Tests et Validation

### 🔍 Script de Test Complet

`scripts/test-database-initialization.js`

**Fonctionnalités testées :**

- ✅ Dépendances système
- ✅ Répertoires RAG
- ✅ SqliteInitializer
- ✅ Metadata Database API
- ✅ Vector Database API
- ✅ Configuration PostgreSQL
- ✅ Persistent State
- ✅ Intégration complète

**Exécution :**

```bash
# Rendre exécutable
chmod +x scripts/test-database-initialization.js

# Exécuter les tests
./scripts/test-database-initialization.js

# Sortie colorée avec rapport JSON
# Rapports sauvegardés dans test-reports/
```

### 📊 Rapports de Test

**Format du rapport :**

```json
{
  "timestamp": "2026-02-07T23:50:00.000Z",
  "summary": {
    "totalTests": 8,
    "passedTests": 8,
    "failedTests": 0,
    "successRate": 100
  },
  "testResults": {
    "dependencies": true,
    "directories": true,
    "sqliteInitializer": true,
    "metadataDatabase": true,
    "vectorDatabase": true,
    "postgresqlConfig": true,
    "persistentState": true,
    "integration": true
  }
}
```

---

## 🔍 Dépannage

### ❌ Problèmes Courants

#### 1. Répertoires manquants

**Symptôme :** `ENOENT: no such file or directory`
**Solution :**

```bash
mkdir -p /rag/{db,state,monitoring}
chmod 755 /rag /rag/db /rag/state /rag/monitoring
```

#### 2. Permissions SQLite

**Symptôme :** `SQLITE_CANTOPEN: unable to open database file`
**Solution :**

```bash
# Vérifier les permissions
ls -la /rag/db/

# Corriger les permissions
chown -R $(whoami):$(whoami) /rag/db/
chmod 644 /rag/db/*.sqlite
```

#### 3. PostgreSQL indisponible

**Symptôme :** `PostgreSQL non disponible`
**Solution :**

```bash
# Vérifier le service
sudo systemctl status postgresql

# Démarrer PostgreSQL
sudo systemctl start postgresql

# Tester la connexion
psql -h localhost -U postgres -d rag_vectors_dev -c "SELECT 1;"
```

#### 4. Extension pgvector manquante

**Symptôme :** `type "vector" does not exist`
**Solution :**

```sql
-- Se connecter en tant que postgres
sudo -u postgres psql -d rag_vectors_dev

-- Installer l'extension
CREATE EXTENSION vector;

-- Vérifier l'installation
\dx
```

### 📝 Logs de Débogage

**Activer le mode verbose :**

```typescript
await initializeMetadataDatabase({
  dbDir: "/rag/db",
  force: false,
  verbose: true, // ← Logs détaillés
});
```

**Vérifier les logs système :**

```bash
# Vérifier les fichiers de base de données
ls -lh /rag/db/*.sqlite

# Vérifier l'espace disque
df -h /rag

# Vérifier les processus
ps aux | grep -E "(sqlite|postgres)"
```

---

## 📚 Références API

### Metadata Database API

**Initialisation :**

```typescript
import { initializeMetadataDatabase } from "./rag/db/metadata-database";

const result = await initializeMetadataDatabase({
  dbDir: "/rag/db",
  force: false,
  verbose: true,
});

if (result.success) {
  console.log(`✅ metadata.sqlite initialisée: ${result.dbPath}`);
  console.log(`📊 Tables: ${result.tables.join(", ")}`);
}
```

**Vérification :**

```typescript
import {
  isMetadataDatabaseInitialized,
  getMetadataDatabaseInfo,
} from "./rag/db/metadata-database";

const initialized = await isMetadataDatabaseInitialized();
const info = await getMetadataDatabaseInfo();

console.log(`Initialisée: ${initialized}`);
console.log(`Chemin: ${info.dbPath}`);
console.log(`Tables: ${info.tablesCount}`);
```

### Vector Database API

**Initialisation avec fallback :**

```typescript
import {
  initializeVectorDatabase,
  recommendVectorDatabaseType,
} from "./rag/db/vector-database";

// Recommandation automatique
const recommendation = recommendVectorDatabaseType();
console.log(`Type recommandé: ${recommendation.type}`);

// Initialisation
const result = await initializeVectorDatabase({
  type: recommendation.type,
  fallbackToSqlite: true,
  verbose: true,
});

if (result.success) {
  console.log(`✅ Base vecteurs initialisée: ${result.type}`);
  if (result.fallbackUsed) {
    console.log(`🔁 Fallback SQLite utilisé`);
  }
}
```

**Démonstration complète :**

```typescript
import { demonstrateVectorDatabase } from "./rag/db/vector-database";

await demonstrateVectorDatabase();
// Affiche un rapport complet dans la console
```

### Persistent State

**Utilisation dans le pipeline RAG :**

```typescript
import { getPersistentState } from "./rag/daemon/persistent-state";

const state = getPersistentState();

// Initialisation automatique au démarrage
await state.performInitialization();

// Accès aux bases de données
const metadataDb = state.getMetadataDatabase();
const memoryDb = state.getMemoryDatabase();
const vectorDb = state.getVectorDatabase();
```

---

## 🔮 Évolution Future

### 🚧 Améliorations Planifiées

1. **Migration automatique**
   - Système de versionnage des schémas
   - Migration sans temps d'arrêt
   - Rollback automatisé

2. **Réplication PostgreSQL**
   - Réplication maître-esclave
   - Load balancing automatique
   - Failover transparent

3. **Monitoring avancé**
   - Dashboard temps réel
   - Alertes prédictives
   - Analyse des performances

4. **Sauvegarde cloud**
   - Backup vers S3/Google Cloud
   - Chiffrement de bout en bout
   - Rétention configurable

### 📈 Métriques à Surveiller

| Métrique               | Seuil   | Action                  |
| ---------------------- | ------- | ----------------------- |
| Taille metadata.sqlite | > 1GB   | Nettoyage automatique   |
| Taille memory.sqlite   | > 500MB | Rotation du cache       |
| Latence PostgreSQL     | > 100ms | Optimisation requêtes   |
| Taux fallback SQLite   | > 10%   | Vérification PostgreSQL |

### 🔄 Maintenance Régulière

**Tâches cron recommandées :**

```bash
# Nettoyage quotidien
0 2 * * * /usr/bin/node /path/to/rag-mcp-server/scripts/cleanup-old-data.js

# Backup automatique
0 4 * * * /usr/bin/node /path/to/rag-mcp-server/scripts/backup-databases.js

# Vérification intégrité
0 6 * * * /usr/bin/node /path/to/rag-mcp-server/scripts
```
