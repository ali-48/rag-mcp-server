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

### Avec Git Hooks

```bash
# .git/hooks/pre-commit
#!/bin/bash
node scripts/code-mapper.js --json --output-dir .audit
# Vérifier les métriques et bloquer si qualité insuffisante
```

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
