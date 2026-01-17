# 📚 Guide d'installation complet - Code Mapper

## 📋 Vue d'ensemble

Ce guide vous accompagne pas à pas dans l'installation et la configuration de Code Mapper, l'outil d'audit technique pour votre codebase TypeScript/JavaScript.

### 🎯 Objectifs

- ✅ Installation des dépendances
- ✅ Configuration des hooks Git
- ✅ Configuration du script cron
- ✅ Activation de tous les déclencheurs
- ✅ Validation de l'installation

## 🚀 Installation rapide (5 minutes)

### Étape 1 : Prérequis

```bash
# Vérifier les prérequis
node --version  # Doit être ≥ 16
npm --version   # Doit être ≥ 8
git --version   # Doit être installé
```

### Étape 2 : Installation des dépendances

```bash
# Dans le dossier du projet
cd /home/ali/Documents/Cline/MCP/rag-mcp-server

# Installer les dépendances principales
npm install

# Installer les dépendances de développement
npm install -D tsx ts-morph @types/node @types/chokidar
```

### Étape 3 : Test d'installation

```bash
# Tester l'exécution basique
npx tsx scripts/code-mapper.ts --help

# Vérifier la génération des 3 formats
npx tsx scripts/code-mapper.ts --output-all
```

## 📦 Installation détaillée

### 1. Dépendances système

#### Node.js et npm

```bash
# Installation sur Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Installation sur macOS
brew install node

# Vérification
node --version  # 18.x ou supérieur
npm --version   # 8.x ou supérieur
```

#### TypeScript et tsx

```bash
# Installation globale (optionnel)
npm install -g typescript tsx

# Installation locale (recommandé)
npm install --save-dev typescript tsx
```

### 2. Dépendances du projet

#### package.json

```json
{
  "devDependencies": {
    "@types/chokidar": "^3.5.7",
    "@types/node": "^20.0.0",
    "chokidar": "^3.6.0",
    "ts-morph": "^22.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  },
  "scripts": {
    "audit": "npx tsx scripts/code-mapper.ts --output-all",
    "audit:watch": "npx tsx scripts/code-mapper.ts --watch",
    "audit:incremental": "npx tsx scripts/code-mapper.ts --incremental",
    "audit:ci": "npx tsx scripts/code-mapper.ts --output-json --quality-threshold 0.7"
  }
}
```

#### Installation

```bash
# Installer toutes les dépendances
npm install

# Vérifier l'installation
npm list ts-morph chokidar tsx
```

## 🔗 Configuration des hooks Git

### Installation automatique

```bash
# Activer tous les hooks Git
npx tsx scripts/integrate-logging.ts all

# Vérifier l'installation
ls -la .git/hooks/
```

### Installation manuelle

#### Hook pre-commit

```bash
# Créer le fichier
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
echo "🔍 Audit de qualité du code (pre-commit)..."
cd /home/ali/Documents/Cline/MCP/rag-mcp-server
npx tsx scripts/code-mapper.ts --output-json --silent
QUALITY=$(node -e "console.log(require('./audit/code_map.json').summary.avgQuality)")
THRESHOLD=0.6
if (( $(echo "$QUALITY < $THRESHOLD" | bc -l) )); then
  echo "❌ Qualité insuffisante: $QUALITY (minimum: $THRESHOLD)"
  exit 1
fi
echo "✅ Audit pre-commit réussi!"
EOF

# Rendre exécutable
chmod +x .git/hooks/pre-commit
```

#### Hook post-commit

```bash
# Créer le fichier
cat > .git/hooks/post-commit << 'EOF'
#!/bin/bash
echo "📝 Mise à jour documentation (post-commit)..."
cd /home/ali/Documents/Cline/MCP/rag-mcp-server
npx tsx scripts/code-mapper.ts --output-all --silent &
echo "✅ Documentation mise à jour en arrière-plan"
EOF

chmod +x .git/hooks/post-commit
```

#### Hook post-merge

```bash
# Créer le fichier
cat > .git/hooks/post-merge << 'EOF'
#!/bin/bash
echo "🔄 Analyse après fusion (post-merge)..."
cd /home/ali/Documents/Cline/MCP/rag-mcp-server
npx tsx scripts/code-mapper.ts --output-all --silent &
echo "✅ Analyse de fusion démarrée"
EOF

chmod +x .git/hooks/post-merge
```

### Vérification des hooks

```bash
# Tester les hooks
.git/hooks/pre-commit
.git/hooks/post-commit
.git/hooks/post-merge

# Vérifier les logs
ls -la audit/logs/
```

## ⏰ Configuration du script cron

### Installation automatique

```bash
# Installer la configuration cron
npx tsx scripts/install-cron-audit.sh

# Vérifier l'installation
crontab -l | grep cron-audit
```

### Installation manuelle

#### Créer le script cron

```bash
# Créer le script
cat > scripts/cron-audit.sh << 'EOF'
#!/bin/bash
# Script d'audit périodique pour cron

PROJECT_DIR="/home/ali/Documents/Cline/MCP/rag-mcp-server"
LOG_DIR="$PROJECT_DIR/audit/logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="$LOG_DIR/cron_audit_$TIMESTAMP.log"

cd "$PROJECT_DIR"

echo "⏰ Audit périodique démarré à $(date)" > "$LOG_FILE"

# Exécuter l'audit
npx tsx scripts/code-mapper.ts --output-all --incremental --silent >> "$LOG_FILE" 2>&1

# Vérifier la qualité
QUALITY=$(node -e "try { console.log(require('./audit/code_map.json').summary.avgQuality) } catch(e) { console.log('0.5') }")
THRESHOLD=0.6

if (( $(echo "$QUALITY < $THRESHOLD" | bc -l) )); then
  echo "⚠️  Alerte: Qualité insuffisante: $QUALITY" >> "$LOG_FILE"
  # Ici, vous pourriez ajouter une notification (email, Slack, etc.)
fi

echo "✅ Audit périodique terminé à $(date)" >> "$LOG_FILE"
EOF

chmod +x scripts/cron-audit.sh
```

#### Configurer crontab

```bash
# Éditer la crontab
crontab -e

# Ajouter une des lignes suivantes :

# Toutes les heures
0 * * * * cd /home/ali/Documents/Cline/MCP/rag-mcp-server && ./scripts/cron-audit.sh

# Tous les jours à 2h du matin
0 2 * * * cd /home/ali/Documents/Cline/MCP/rag-mcp-server && ./scripts/cron-audit.sh

# Toutes les 30 minutes
*/30 * * * * cd /home/ali/Documents/Cline/MCP/rag-mcp-server && ./scripts/cron-audit.sh
```

### Vérification de cron

```bash
# Tester le script manuellement
./scripts/cron-audit.sh

# Vérifier les logs
ls -la audit/logs/cron_audit_*.log

# Vérifier la crontab
crontab -l
```

## 🔄 Activation des optimisations

### Mode incrémental

```bash
# Activer le mode incrémental
npx tsx scripts/integrate-incremental.ts all

# Tester le mode incrémental
npx tsx scripts/code-mapper.ts --incremental --stats
```

### Cache AST

```bash
# Activer le cache AST
npx tsx scripts/integrate-ast-cache.ts all

# Tester le cache
npx tsx scripts/integrate-ast-cache.ts test

# Vérifier la structure du cache
ls -la audit/ast-cache/
```

### Watcher temps réel

```bash
# Tester le watcher
npx tsx scripts/code-mapper.ts --watch --verbose

# Démarrer en arrière-plan
npx tsx scripts/code-mapper.ts --watch --silent &
```

## 🤖 Configuration GitHub Actions

### Fichier de workflow

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

### Installation

```bash
# Créer le dossier workflows
mkdir -p .github/workflows

# Copier le fichier de configuration
cp .github/workflows/code-audit.yml .github/workflows/

# Tester localement (avec act)
act -W .github/workflows/code-audit.yml
```

## 🎯 Configuration par environnement

### Développement local

```bash
# Configuration optimale pour le développement
npx tsx scripts/code-mapper.ts --watch --silent &
# Les hooks Git s'exécuteront automatiquement
```

### Intégration continue

```bash
# Configuration pour CI
npx tsx scripts/code-mapper.ts \
  --incremental \
  --output-json \
  --quality-threshold 0.7 \
  --exclude "test/**" \
  --exclude "node_modules/**"
```

### Production/surveillance

```bash
# Configuration pour surveillance
npx tsx scripts/code-mapper.ts \
  --output-all \
  --verbose \
  --stats
```

## 🔧 Personnalisation avancée

### Exclusions personnalisées

```typescript
// Modifier scripts/code-mapper.ts
const EXCLUDED_DIRS = [
  "node_modules",
  ".git",
  "build",
  "dist",
  "coverage",
  // Ajouter vos exclusions
  "temp",
  "tmp",
  "vendor",
  ".cache",
];

const EXCLUDED_FILES = [
  ".DS_Store",
  "Thumbs.db",
  "*.log",
  "*.tmp",
  // Ajouter vos exclusions
  "*.min.js",
  "*.bundle.js",
  "package-lock.json",
];
```

### Seuils de qualité

```bash
# Modifier le seuil dans les hooks Git
QUALITY_THRESHOLD=0.7  # Au lieu de 0.6

# Modifier le seuil dans GitHub Actions
--quality-threshold 0.7
```

### Formats de sortie

```bash
# Générer seulement certains formats
npx tsx scripts/code-mapper.ts --output-json
npx tsx scripts/code-mapper.ts --output-mindmap
npx tsx scripts/code-mapper.ts --output-sqlite

# Changer le dossier de sortie
npx tsx scripts/code-mapper.ts --output-dir ./reports
```

## 🐛 Dépannage

### Problèmes courants

#### 1. Erreur "ts-morph not found"

```bash
# Solution
npm install ts-morph
# Ou
npm install --save-dev ts-morph
```

#### 2. Erreur "Permission denied" sur les hooks Git

```bash
# Solution
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/post-commit
chmod +x .git/hooks/post-merge
```

#### 3. Erreur "bc: command not found" (macOS)

```bash
# Solution
brew install bc
# Ou utiliser une alternative
QUALITY=0.7
THRESHOLD=0.6
if (( $(echo "$QUALITY < $THRESHOLD" | bc -l) )); then
```

#### 4. Temps d'exécution trop long

```bash
# Solutions
# Activer le mode incrémental
npx tsx scripts/code-mapper.ts --incremental

# Activer le cache AST
npx tsx scripts/integrate-ast-cache.ts all

# Exclure plus de dossiers
npx tsx scripts/code-mapper.ts --exclude "test/**" --exclude "docs/**"
```

#### 5. Mémoire insuffisante

```bash
# Solution
export NODE_OPTIONS="--max-old-space-size=4096"
npx tsx scripts/code-mapper.ts --output-all
```

### Diagnostic

```bash
# Vérifier l'état du système
npx tsx scripts/code-mapper.ts --status

# Vérifier les statistiques
npx tsx scripts/code-mapper.ts --stats

# Vérifier les logs
ls -la audit/logs/
tail -f audit/logs/latest.log
```

### Tests de validation

```bash
# Test 1: Installation des dépendances
npm list ts-morph chokidar tsx

# Test 2: Exécution basique
npx tsx scripts/code-mapper.ts --help

# Test 3: Génération des formats
npx tsx scripts/code-mapper.ts --output-all
ls -la audit/

# Test 4: Hooks Git
.git/hooks/pre-commit

# Test 5: Mode incrémental
npx tsx scripts/code-mapper.ts --incremental --stats

# Test 6: Cache AST
npx tsx scripts/integrate-ast-cache.ts test
```

## 📊 Validation de l'installation

### Checklist d'installation

- [ ] Node.js ≥ 16 installé
- [ ] npm ≥ 8 installé
- [ ] Dépendances npm installées
- [ ] Hooks Git installés et exécutables
- [ ] Script cron configuré
- [ ] Mode incrémental activé
- [ ] Cache AST activé
- [ ] GitHub Actions configuré (optionnel)
- [ ] Tests de validation réussis

### Commandes de validation

```bash
# Script de validation complet
cat > validate-installation.sh << 'EOF'
#!/bin/bash
echo "🔍 Validation de l'installation Code Mapper..."

echo "1. Vérification Node.js..."
node --version

echo "2. Vérification npm..."
npm --version

echo "3. Vérification dépendances..."
npm list ts-morph chokidar tsx 2>/dev/null | grep -E "(ts-morph|chokidar|tsx)"

echo "4. Vérification hooks Git..."
ls -la .git/hooks/ | grep -E "(pre-commit|post-commit|post-merge)"

echo "5. Vérification cron..."
crontab -l | grep -q "cron-audit" && echo "✅ Cron configuré" || echo "⚠️  Cron non configuré"

echo "6. Test d'exécution..."
npx tsx scripts/code-mapper.ts --help >/dev/null 2>&1 && echo "✅ Exécution OK" || echo "❌ Erreur d'exécution"

echo "7. Génération test..."
npx tsx scripts/code-mapper.ts --output-json --silent
if [ -f "audit/code_map.json" ]; then
  echo "✅ Génération OK"
else
  echo "❌ Erreur de génération"
fi

echo "📊 Validation terminée"
EOF

chmod +x validate-installation.sh
./validate-installation.sh
```

## 🔄 Mise à jour

### Mise à jour des dépendances

```bash
# Mettre à jour toutes les dépendances
npm update

# Mettre à jour spécifiquement
npm update ts-morph chokidar tsx
```

### Mise à jour des hooks Git

```bash
# Régénérer les hooks
npx tsx scripts/integrate-logging.ts all --force
```

### Mise à jour de la configuration cron

```bash
# Régénérer la configuration
npx tsx scripts/install-cron-audit.sh --force
```

## 📚 Ressources supplémentaires

### Documentation

- [README_AUDIT.md](../README_AUDIT.md) - Documentation complète
- [Règles d'architecture
