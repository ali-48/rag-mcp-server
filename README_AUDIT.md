# Code Mapper - Documentation d'audit

## 📋 Vue d'ensemble

Code Mapper est un script d'audit technique qui génère une cartographie complète d'un codebase TypeScript/JavaScript. Il analyse la structure, les dépendances, les métriques de qualité et produit trois formats de sortie :

1. **JSON canonique** (`code_map.json`) - Structure de données complète
2. **FreeMind Mind Map** (`code_map.mm`) - Visualisation hiérarchique
3. **Base de données SQLite** (`code_map.db`) - Requêtes et analyses avancées

## 🚀 Installation et utilisation

### Prérequis

- Node.js 16+
- TypeScript installé globalement ou localement
- ts-morph (installé automatiquement)

### Installation

```bash
# Cloner le projet
git clone <repository>
cd rag-mcp-server

# Installer les dépendances
npm install

# Compiler TypeScript
npx tsc scripts/code-mapper.ts --outDir build --module commonjs --target es2020
```

### Utilisation basique

```bash
# Exécuter le script complet (génère les 3 fichiers)
node scripts/code-mapper.js

# Ou utiliser directement TypeScript
npx tsx scripts/code-mapper.ts
```

### Options CLI (à implémenter)

```bash
# Générer uniquement le JSON
node scripts/code-mapper.js --json

# Générer uniquement la Mind Map
node scripts/code-mapper.js --mm

# Générer uniquement la base SQLite
node scripts/code-mapper.js --sql

# Spécifier le dossier de sortie
node scripts/code-mapper.js --output-dir ./my-audit

# Exclure des patterns
node scripts/code-mapper.js --exclude "test/**" --exclude "*.spec.ts"
```

## 📊 Formats de sortie

### 1. JSON Canonique (`code_map.json`)

Structure complète avec toutes les métadonnées :

```json
{
  "project": {
    "name": "rag-mcp-server",
    "path": "/home/ali/Documents/Cline/MCP/rag-mcp-server",
    "date": "2026-01-17T00:00:00.000Z",
    "language": "TypeScript/JavaScript"
  },
  "summary": {
    "totalFiles": 150,
    "codeFiles": 120,
    "configFiles": 20,
    "docFiles": 10,
    "functions": 450,
    "classes": 75,
    "interfaces": 30,
    "imports": 890,
    "calls": 1200
  },
  "files": [...],
  "relations": {...}
}
```

### 2. FreeMind Mind Map (`code_map.mm`)

Visualisation hiérarchique pour FreeMind :

- Arborescence des fichiers
- Fonctions et classes par fichier
- Relations d'imports et d'appels
- Scores de qualité visuels

### 3. Base SQLite (`code_map.db`)

Structure relationnelle pour analyses avancées :

## 🔍 Exemples de requêtes SQL

### Top 10 des fichiers les plus complexes

```sql
SELECT f.path, f.lines, f.score_complexity, f.score_maintainability
FROM files f
WHERE f.type = 'code'
ORDER BY f.score_complexity DESC
LIMIT 10;
```

### Graphe des imports

```sql
SELECT
  f1.path AS source_file,
  f2.path AS target_file,
  r.type AS import_type
FROM import_relations r
JOIN files f1 ON r.from_file_id = f1.id
LEFT JOIN files f2 ON r.to_file_id = f2.id
WHERE f2.id IS NOT NULL; -- Exclure les modules externes
```

### Métriques par type de fichier

```sql
SELECT
  type,
  COUNT(*) as file_count,
  AVG(score_complexity) as avg_complexity,
  AVG(score_maintainability) as avg_maintainability,
  AVG(score_quality) as avg_quality
FROM files
GROUP BY type;
```

### Fonctions avec complexité élevée

```sql
SELECT
  f.path as file_path,
  fn.name as function_name,
  fn.lines,
  fn.complexity,
  fn.visibility
FROM functions fn
JOIN files f ON fn.file_id = f.id
WHERE fn.complexity > 3
ORDER BY fn.complexity DESC;
```

## 🏗️ Architecture du script

### Pipeline d'exécution

1. **Scan des fichiers** - Parcours récursif avec exclusions
2. **Analyse TypeScript** - Utilisation de ts-morph pour l'AST
3. **Construction des relations** - Graphes d'imports, appels, héritage
4. **Calcul des métriques** - Complexité, maintenabilité, qualité
5. **Génération des sorties** - JSON, FreeMind, SQLite

### Structure des données

```
FileInfo
├── id (file_001)
├── path (chemin relatif)
├── type (code|doc|config|other)
├── language (ts|js|json|...)
├── lines (nombre de lignes)
├── size (taille en octets)
├── imports (ImportInfo[])
├── exports (ExportInfo[])
├── functions (FunctionInfo[])
├── classes (ClassInfo[])
└── score (FileScore)
```

### Relations

- **ImportRelation** : Fichier A → importe → Fichier B/Module
- **CallRelation** : Fonction X → appelle → Fonction Y
- **InheritanceRelation** : Classe enfant → étend → Classe parente

## ⚙️ Configuration

### Dossiers exclus par défaut

```typescript
const EXCLUDED_DIRS = [
  "node_modules",
  ".git",
  "build",
  "build-test",
  "dist",
  "coverage",
  ".nyc_output",
  ".vscode",
  "logs",
  "audit",
  "test",
  "test-data",
  "test-chuking",
  "archived-tests",
];
```

### Fichiers exclus

```typescript
const EXCLUDED_FILES = [
  ".DS_Store",
  "Thumbs.db",
  "*.log",
  "*.tmp",
  "*.temp",
  "*.map",
  "*.d.ts",
];
```

### Extensions incluses

```typescript
const INCLUDED_EXTENSIONS = [
  ".ts",
  ".js",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".toml",
  ".sql",
  ".sh",
  ".txt",
  ".html",
  ".css",
];
```

## 📈 Métriques de qualité

### Calcul de la complexité

1. **Taille du fichier** (0-0.3) : `lines / 500`
2. **Nombre de fonctions** (0-0.2) : `functions.length / 10`
3. **Nombre de classes** (0-0.2) : `classes.length / 5`
4. **Nombre d'imports** (0-0.15) : `imports.length / 20`
5. **Complexité des fonctions** (0-0.15) : Moyenne des complexités

### Calcul de la maintenabilité

- Base : `1 - complexité`
- Bonus documentation : `+0.1` si exports > 0
- Bonus simplicité : `+0.05` si fonctions ≤ 3
- Bonus indépendance : `+0.05` si imports ≤ 5

### Score de qualité

- Formule : `(complexité × 0.3) + (maintenabilité × 0.7)`
- Plage : 0.0 (mauvaise) à 1.0 (excellente)

## 🔧 Intégration avec d'autres outils

### Avec VS Code

```json
{
  "tasks": [
    {
      "label": "Audit Codebase",
      "type": "shell",
      "command": "node scripts/code-mapper.js",
      "group": "build"
    }
  ]
}
```

## 🤖 Automatisation et déclencheurs

Code Mapper offre un système complet d'automatisation avec 7 types de déclencheurs différents pour maintenir votre audit de code toujours à jour :

### 📋 Vue d'ensemble des déclencheurs

| Déclencheur            | Type         | Fréquence                      | Format         | Objectif principal                   |
| ---------------------- | ------------ | ------------------------------ | -------------- | ------------------------------------ |
| **Hooks Git**          | Événementiel | À chaque opération Git         | JSON/3 formats | Intégration workflow développeur     |
| **Watcher temps réel** | Continu      | Surveillance continue          | 3 formats      | Réactivité immédiate aux changements |
| **Script cron**        | Périodique   | Configurable (horaire/jour)    | 3 formats      | Surveillance régulière               |
| **GitHub Actions**     | CI/CD        | Push/Pull Request              | 3 formats      | Intégration DevOps                   |
| **Mode incrémental**   | Optimisé     | Seulement fichiers modifiés    | 3 formats      | Performance maximale                 |
| **Cache AST**          | Performance  | Réutilisation entre exécutions | Cache mémoire  | Réduction temps d'analyse            |
| **CLI manuel**         | Manuel       | À la demande                   | Configurable   | Contrôle total                       |

### 🚀 Installation et activation

```bash
# Activer tous les déclencheurs
npx tsx scripts/integrate-logging.ts all
npx tsx scripts/integrate-incremental.ts all
npx tsx scripts/integrate-ast-cache.ts all

# Vérifier l'état des déclencheurs
npx tsx scripts/code-mapper.ts --status
```

## 🔗 Hooks Git automatisés

Code Mapper inclut trois hooks Git prêts à l'emploi pour automatiser l'audit de qualité du code :

### 📋 Vue d'ensemble des hooks

| Hook            | Objectif                   | Mode d'exécution                                    | Format généré      | Seuil qualité       |
| --------------- | -------------------------- | --------------------------------------------------- | ------------------ | ------------------- |
| **pre-commit**  | Validation avant commit    | Bloquant (arrête le commit si qualité insuffisante) | JSON seulement     | ≥ 0.6 (60%)         |
| **post-commit** | Documentation après commit | Non-bloquant (arrière-plan)                         | 3 formats complets | Aucun               |
| **post-merge**  | Ré-audit après fusion      | Non-bloquant (arrière-plan)                         | 3 formats complets | Analyse comparative |

### 🚀 Installation des hooks

Les hooks sont automatiquement créés dans `.git/hooks/`. Pour les activer :

```bash
# Rendre les hooks exécutables (déjà fait par le script)
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/post-commit
chmod +x .git/hooks/post-merge

# Vérifier l'installation
ls -la .git/hooks/pre-commit .git/hooks/post-commit .git/hooks/post-merge
```

### 1. Hook pre-commit (validation qualité)

**Objectif** : Valider la qualité du code avant chaque commit.

**Fonctionnalités** :

- Audit léger (JSON seulement) pour rapidité
- Vérification du seuil de qualité (60% minimum)
- Analyse des fichiers modifiés (staged)
- Suggestions d'amélioration en cas d'échec
- Logs détaillés dans `audit/logs/pre-commit_*.log`

**Configuration** :

```bash
# Seuil de qualité (modifiable dans le script)
QUALITY_THRESHOLD=0.6  # 60% minimum

# Options d'exécution
npx tsx scripts/code-mapper.ts --output-json --silent
```

**Exemple de sortie** :

```
🔍 Audit de qualité du code (pre-commit)...
📁 Dossier du projet: /home/ali/Documents/Cline/MCP/rag-mcp-server
🚀 Exécution de l'audit léger (JSON seulement)...
✅ Audit léger exécuté avec succès
📊 Analyse du seuil de qualité...
📈 Métriques de qualité:
   Nombre de fichiers analysés: 42
   Qualité moyenne: 0.72
   Seuil minimum requis: 0.60
✅ Audit pre-commit réussi!
```

### 2. Hook post-commit (documentation automatique)

**Objectif** : Mettre à jour la documentation après chaque commit.

**Fonctionnalités** :

- Audit complet (3 formats) en arrière-plan
- Récupération des informations du commit (hash, message, branche)
- Génération de rapport de synthèse Markdown
- Logs détaillés dans `audit/logs/post-commit_*.log`
- Non-bloquant (ne ralentit pas le workflow)

**Configuration** :

```bash
# Options d'exécution
npx tsx scripts/code-mapper.ts --output-all --verbose
```

**Fichiers générés** :

- `audit/code_map.json` - Cartographie JSON complète
- `audit/code_map.mm` - Mind Map FreeMind
- `audit/code_map.db` - Base de données SQLite
- `audit/logs/summary_*.md` - Rapport de synthèse

### 3. Hook post-merge (analyse après fusion)

**Objectif** : Analyser l'impact des fusions sur la qualité du code.

**Fonctionnalités** :

- Détection du type de fusion (classique, fast-forward)
- Identification des conflits résolus
- Analyse comparative qualité avant/après fusion
- Catégorisation des fichiers modifiés (code/config/doc)
- Rapport spécifique aux fusions
- Logs détaillés dans `audit/logs/post-merge_*.log`

**Analyse avancée** :

```bash
# Détection des fichiers modifiés par la fusion
git diff --name-only MERGE_HEAD^..MERGE_HEAD

# Détection des conflits
git diff --name-only --diff-filter=U

# Analyse comparative de qualité
jq '[.files[].score.quality] | add / length' audit/code_map.json
```

### ⚙️ Personnalisation des hooks

#### Modifier le seuil de qualité

Éditez `.git/hooks/pre-commit` et modifiez :

```bash
QUALITY_THRESHOLD=0.7  # Augmenter à 70%
```

#### Désactiver un hook

```bash
# Renommer ou supprimer le fichier
mv .git/hooks/pre-commit .git/hooks/pre-commit.disabled
# Ou
rm .git/hooks/pre-commit
```

#### Activer/désactiver temporairement

```bash
# Désactiver
git config hooks.pre-commit false

# Réactiver
git config --unset hooks.pre-commit
```

### 🔧 Dépannage des hooks

#### Problème : Hook non exécuté

```bash
# Vérifier les permissions
ls -la .git/hooks/pre-commit
# Doit afficher -rwxr-xr-x

# Vérifier la syntaxe Bash
bash -n .git/hooks/pre-commit
```

#### Problème : Erreur de dépendance

```bash
# Vérifier que npx et tsx sont disponibles
which npx
which tsx

# Installer tsx si nécessaire
npm install -g tsx
```

#### Problème : Temps d'exécution trop long

```bash
# Réduire la portée de l'analyse (modifier le hook)
npx tsx scripts/code-mapper.ts --output-json --silent --root-dir ./src
```

#### Problème : Faux positifs/negatifs

```bash
# Ajuster le seuil de qualité
QUALITY_THRESHOLD=0.5  # Baisser à 50%

# Exclure certains fichiers
EXCLUDED_DIRS="test node_modules"
```

### 📊 Métriques et monitoring

#### Logs générés

```
audit/logs/
├── pre-commit_20260117_021134.log
├── post-commit_20260117_021145.log
├── post-merge_20260117_021200.log
├── summary_20260117_021145.md
└── merge_report_20260117_021200.md
```

#### Surveillance de la qualité

```sql
-- Suivi historique de la qualité
SELECT
  strftime('%Y-%m-%d', created_at) as date,
  COUNT(*) as files,
  AVG(quality) as avg_quality,
  MIN(quality) as min_quality,
  MAX(quality) as max_quality
FROM files
GROUP BY strftime('%Y-%m-%d', created_at)
ORDER BY date DESC;
```

### 🔄 Intégration avec d'autres workflows

#### Avec le watcher en temps réel

```bash
# Combiner hooks Git et watcher
npx tsx scripts/code-mapper.ts --watch --verbose &
# Les hooks complètent le watcher pour les opérations Git
```

#### Avec le pipeline CI/CD

```bash
# Utiliser les mêmes vérifications en CI
npx tsx scripts/code-mapper.ts --output-json
# Comparer la qualité avec le seuil configuré
```

#### Avec les outils d'analyse statique

```bash
# Combiner avec ESLint/TypeScript
npm run lint && .git/hooks/pre-commit
```

### 📈 Bonnes pratiques

1. **Commiter régulièrement** : Les hooks post-commit maintiennent la documentation à jour
2. **Résoudre les conflits proprement** : Le hook post-merge analyse l'impact
3. **Surveiller les logs** : Vérifier régulièrement `audit/logs/`
4. **Ajuster le seuil** : Adapter `QUALITY_THRESHOLD` à votre projet
5. **Former l'équipe** : Expliquer le fonctionnement des hooks aux développeurs

### 🚨 Limitations connues

- **Performance** : L'audit complet peut prendre plusieurs secondes sur de grands projets
- **Dépendances** : Requiert Node.js, TypeScript, et tsx
- **Git uniquement** : Conçu spécifiquement pour Git
- **Seuil fixe** : Le seuil de qualité est le même pour tous les fichiers

### 🔮 Évolutions futures

- [ ] Configuration externe (fichier `.code-audit.json`)
- [ ] Notifications (Slack, email, etc.)
- [ ] Dashboard web en temps réel
- [ ] Intégration avec Jira/GitHub Issues
- [ ] Analyse différentielle avancée

## 🕐 Watcher temps réel

### 📋 Vue d'ensemble

Le watcher temps réel surveille en continu les changements dans votre codebase et déclenche automatiquement des audits lorsque des fichiers sont modifiés.

### 🚀 Activation

```bash
# Démarrer le watcher
npx tsx scripts/code-mapper.ts --watch

# Démarrer avec options
npx tsx scripts/code-mapper.ts --watch --verbose --output-all
```

### ⚙️ Configuration

```typescript
// Options du watcher
const watcherOptions = {
  debounceDelay: 1000, // Délai anti-rebond (ms)
  ignored: [
    // Fichiers ignorés
    "**/node_modules/**",
    "**/.git/**",
    "**/audit/**",
    "*.log",
  ],
  persistent: true, // Continuer à surveiller
  ignoreInitial: true, // Ignorer le scan initial
  followSymlinks: false, // Ne pas suivre les liens symboliques
};
```

### 📊 Fonctionnalités

- **Détection en temps réel** : Changements de fichiers immédiatement détectés
- **Debouncing intelligent** : Évite les audits multiples pour changements rapides
- **Filtrage avancé** : Ignore les fichiers temporaires et de build
- **Logs détaillés** : Historique complet des changements
- **Mode silencieux** : Option pour réduire le bruit en console

### 🔧 Intégration

```bash
# Combiner avec d'autres déclencheurs
npx tsx scripts/code-mapper.ts --watch &
# Les hooks Git s'exécuteront en parallèle
```

## ⏰ Script cron (surveillance périodique)

### 📋 Vue d'ensemble

Le script cron permet d'exécuter des audits périodiques selon une planification configurable.

### 🚀 Installation

```bash
# Installer la configuration cron
npx tsx scripts/install-cron-audit.sh

# Configurer manuellement
crontab -e
```

### ⚙️ Configuration

```bash
# Exemples de configurations cron
# Toutes les heures
0 * * * * cd /home/ali/Documents/Cline/MCP/rag-mcp-server && npx tsx scripts/cron-audit.sh

# Tous les jours à 2h du matin
0 2 * * * cd /home/ali/Documents/Cline/MCP/rag-mcp-server && npx tsx scripts/cron-audit.sh

# Toutes les 30 minutes
*/30 * * * * cd /home/ali/Documents/Cline/MCP/rag-mcp-server && npx tsx scripts/cron-audit.sh
```

### 📊 Fonctionnalités

- **Planification flexible** : Heures, jours, mois configurables
- **Logs structurés** : Fichiers de log datés et organisés
- **Notifications** : Alertes en cas de baisse de qualité
- **Rapports périodiques** : Synthèses hebdomadaires/mensuelles
- **Gestion des erreurs** : Re-tentatives et notifications d'échec

### 🔧 Personnalisation

```bash
# Personnaliser le script cron
cp scripts/cron-audit.sh scripts/cron-audit-custom.sh
# Modifier les options d'audit
npx tsx scripts/code-mapper.ts --output-all --verbose --incremental
```

## 🔄 Mode incrémental

### 📋 Vue d'ensemble

Le mode incrémental optimise les performances en analysant uniquement les fichiers modifiés depuis le dernier audit.

### 🚀 Activation

```bash
# Activer le mode incrémental
npx tsx scripts/integrate-incremental.ts all

# Utiliser le mode incrémental
npx tsx scripts/code-mapper.ts --incremental
```

### ⚙️ Fonctionnement

1. **État persistant** : Stocke l'état des fichiers (hash, métadonnées)
2. **Détection de changements** : Compare avec l'état précédent
3. **Analyse ciblée** : Seulement les fichiers modifiés
4. **Mise à jour incrémentale** : Met à jour les sorties existantes
5. **Gestion des dépendances** : Réanalyse les fichiers dépendants

### 📊 Avantages

- **Performance** : Jusqu'à 90% de réduction du temps d'analyse
- **Précision** : Maintient la cohérence des données
- **Économie de ressources** : Moins de CPU et mémoire
- **Intégration transparente** : Compatible avec tous les autres déclencheurs

### 🔧 Configuration

```typescript
// Options du mode incrémental
const incrementalOptions = {
  enabled: true,
  stateFile: "audit/incremental-state.json",
  hashAlgorithm: "sha256",
  checkDependencies: true,
  cleanupOldEntries: true,
  maxAgeDays: 30,
};
```

## 🧠 Cache AST

### 📋 Vue d'ensemble

Le cache AST stocke les résultats d'analyse AST entre les exécutions pour réutilisation ultérieure.

### 🚀 Activation

```bash
# Activer le cache AST
npx tsx scripts/integrate-ast-cache.ts all

# Le cache est automatiquement utilisé
npx tsx scripts/code-mapper.ts
```

### ⚙️ Architecture

```
audit/ast-cache/
├── index.json          # Index des entrées de cache
├── 00/                 # Sous-répertoires par hash
│   ├── abc123.json    # Entrée de cache
│   └── def456.json
├── 01/
│   └── ...
└── README_AST_CACHE.md # Documentation
```

### 📊 Fonctionnalités

- **Stockage persistant** : Cache sur disque avec structure hiérarchique
- **Validation intelligente** : Vérification hash, taille, date de modification
- **Gestion des dépendances** : Invalidation des fichiers dépendants
- **Compression** : Suppression des données AST pour entrées anciennes
- **Statistiques** : Taux de succès, distribution, recommandations

### 🔧 Utilisation avancée

```typescript
import { createASTCache } from "./scripts/ast-cache";

const astCache = createASTCache({
  enabled: true,
  cacheDir: "audit/ast-cache",
  maxEntries: 1000,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours
  compression: true,
  validation: {
    checkHash: true,
    checkSize: true,
    checkMtime: true,
  },
});

// Utilisation manuelle
const cachedEntry = astCache.get(filePath);
if (cachedEntry) {
  // Utiliser les données du cache
} else {
  // Analyser et sauvegarder
  astCache.save(filePath, astData, dependencies);
}
```

## 🤖 GitHub Actions (CI/CD)

### 📋 Vue d'ensemble

Intégration complète avec GitHub Actions pour l'audit automatique dans les pipelines CI/CD.

### 🚀 Configuration

```yaml
# .github/workflows/code-audit.yml
name: Code Audit
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"
      - run: npm ci
      - name: Run Code Audit
        run: npx tsx scripts/code-mapper.ts --output-all --verbose
      - name: Upload Audit Artifacts
        uses: actions/upload-artifact@v3
        with:
          name: code-audit-${{ github.sha }}
          path: audit/
      - name: Quality Check
        run: |
          QUALITY=$(node -e "console.log(require('./audit/code_map.json').summary.avgQuality)")
          if (( $(echo "$QUALITY < 0.6" | bc -l) )); then
            echo "❌ Quality threshold not met: $QUALITY"
            exit 1
          fi
```

### 📊 Fonctionnalités CI/CD

- **Déclenchement automatique** : Push, pull_request, schedule
- **Artefacts générés** : Téléchargement des résultats d'audit
- **Seuils de qualité** : Validation automatique dans le pipeline
- **Badges** : Intégration avec README.md
- **Commentaires PR** : Feedback automatique sur les pull requests

### 🔧 Personnalisation

```yaml
# Options avancées
- name: Run with specific options
  run: |
    npx tsx scripts/code-mapper.ts \
      --incremental \
      --output-json \
      --exclude "test/**" \
      --quality-threshold 0.7
```

## 🎯 CLI manuel (contrôle total)

### 📋 Vue d'ensemble

Interface CLI complète pour un contrôle total sur l'exécution des audits.

### 🚀 Commandes disponibles

```bash
# Audit complet (3 formats)
npx tsx scripts/code-mapper.ts --output-all

# Formats spécifiques
npx tsx scripts/code-mapper.ts --output-json
npx tsx scripts/code-mapper.ts --output-mindmap
npx tsx scripts/code-mapper.ts --output-sqlite

# Options d'optimisation
npx tsx scripts/code-mapper.ts --incremental
npx tsx scripts/code-mapper.ts --watch
npx tsx scripts/code-mapper.ts --silent

# Configuration
npx tsx scripts/code-mapper.ts --exclude "test/**" --exclude "node_modules/**"
npx tsx scripts/code-mapper.ts --root-dir ./src
npx tsx scripts/code-mapper.ts --quality-threshold 0.7

# Informations et diagnostic
npx tsx scripts/code-mapper.ts --help
npx tsx scripts/code-mapper.ts --version
npx tsx scripts/code-mapper.ts --status
npx tsx scripts/code-mapper.ts --stats
```

### 📊 Options CLI complètes

| Option                | Description                | Valeur par défaut |
| --------------------- | -------------------------- | ----------------- |
| `--output-all`        | Générer les 3 formats      | false             |
| `--output-json`       | Générer JSON seulement     | false             |
| `--output-mindmap`    | Générer Mind Map seulement | false             |
| `--output-sqlite`     | Générer SQLite seulement   | false             |
| `--incremental`       | Mode incrémental           | false             |
| `--watch`             | Watcher temps réel         | false             |
| `--silent`            | Mode silencieux            | false             |
| `--verbose`           | Mode verbeux               | false             |
| `--exclude`           | Patterns à exclure         | multiple          |
| `--root-dir`          | Dossier racine             | .                 |
| `--quality-threshold` | Seuil de qualité           | 0.6               |
| `--help`              | Afficher l'aide            | -                 |
| `--version`           | Afficher la version        | -                 |
| `--status`            | État du système            | -                 |
| `--stats`             | Statistiques détaillées    | -                 |

## 🔄 Stratégies de combinaison

### 📋 Exemples d'utilisation combinée

#### Développement local

```bash
# Watcher + Hooks Git + Cache AST
npx tsx scripts/code-mapper.ts --watch &
# Les hooks Git s'exécutent automatiquement
```

#### Intégration continue

```yaml
# GitHub Actions + Mode incrémental + Validation qualité
- run: npx tsx scripts/code-mapper.ts --incremental --quality-threshold 0.7
```

#### Surveillance production

```bash
# Cron + Logs + Notifications
0 2 * * * cd /project && npx tsx scripts/code-mapper.ts --output-all --verbose
```

#### Audit ponctuel

```bash
# CLI manuel + Options avancées
npx tsx scripts/code-mapper.ts \
  --output-all \
  --exclude "test/**" \
  --exclude "node_modules/**" \
  --quality-threshold 0.8 \
  --verbose
```

### 📊 Recommandations par cas d'usage

| Cas d'usage                 | Déclencheurs recommandés | Configuration                           |
| --------------------------- | ------------------------ | --------------------------------------- |
| **Développement quotidien** | Hooks Git + Watcher      | `--watch --silent`                      |
| **Revue de code**           | CLI manuel               | `--output-all --verbose`                |
| **CI/CD**                   | GitHub Actions           | `--incremental --quality-threshold 0.7` |
| **Surveillance**            | Cron                     | `--output-all --verbose` (quotidien)    |
| **Audit initial**           | CLI manuel               | `--output-all` (sans optimisation)      |
| **Maintenance**             | CLI manuel + Cache       | `--incremental --stats`                 |

---

### Avec CI/CD

```yaml
# .github/workflows/audit.yml
name: Code Audit
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: node scripts/code-mapper.js --json
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: code-audit
          path: audit/
```

## 🐛 Dépannage

### Problèmes courants

1. **Erreur ts-morph** : Vérifier que TypeScript est installé
2. **Fichiers manquants** : Vérifier les exclusions dans la configuration
3. **Mémoire insuffisante** : Utiliser `--max-old-space-size=4096`
4. **Temps d'exécution long** : Exclure plus de dossiers

### Logs de débogage

```bash
# Activer les logs détaillés
DEBUG=code-mapper* node scripts/code-mapper.js

# Limiter l'analyse à un sous-dossier
node scripts/code-mapper.js --path src/core
```

## 📝 Roadmap et améliorations

### Améliorations planifiées

- [ ] Analyse des dépendances circulaires
- [ ] Détection des code smells
- [ ] Intégration avec SonarQube
- [ ] Export HTML interactif
- [ ] Dashboard web en temps réel

### Contributions

Les contributions sont les bienvenues ! Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour les guidelines.

## 📄 Licence

MIT License - Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🙏 Remerciements

- [ts-morph](https://github.com/dsherret/ts-morph) pour l'analyse AST
- [FreeMind](http://freemind.sourceforge.net) pour le format Mind Map
- La communauté TypeScript pour les outils et ressources
