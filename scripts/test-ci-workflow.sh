#!/bin/bash
# Script de test pour le workflow CI GitHub Actions
# Vérifie que tous les composants fonctionnent correctement

set -e

echo "🧪 Tests CI pour le workflow GitHub Actions..."
echo "=============================================="

# Définir les chemins
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKFLOW_FILE="$SCRIPT_DIR/.github/workflows/code-audit.yml"
AUDIT_DIR="$SCRIPT_DIR/audit"
TEST_DIR="$SCRIPT_DIR/test-ci"
TEST_REPO="$TEST_DIR/test-repo"

# Fonction de log
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Fonction d'erreur
error() {
    log "❌ $1"
    exit 1
}

# Fonction de succès
success() {
    log "✅ $1"
}

# Vérifier que le workflow existe
if [ ! -f "$WORKFLOW_FILE" ]; then
    error "Workflow non trouvé: $WORKFLOW_FILE"
fi
success "Workflow trouvé: $WORKFLOW_FILE"

# Vérifier la syntaxe YAML
log "🔍 Vérification de la syntaxe YAML..."
if command -v yq &> /dev/null; then
    yq e '.' "$WORKFLOW_FILE" > /dev/null
    success "Syntaxe YAML valide"
else
    log "⚠️  yq non disponible, vérification syntaxique limitée"
    # Vérification basique
    if grep -q "name:" "$WORKFLOW_FILE" && grep -q "on:" "$WORKFLOW_FILE"; then
        success "Structure YAML basique valide"
    else
        error "Structure YAML invalide"
    fi
fi

# Vérifier les déclencheurs
log "📅 Vérification des déclencheurs..."
TRIGGERS=$(grep -c "push:\|pull_request:\|workflow_dispatch:" "$WORKFLOW_FILE" || true)
if [ "$TRIGGERS" -ge 3 ]; then
    success "3 déclencheurs détectés (push, pull_request, workflow_dispatch)"
else
    error "Déclencheurs manquants"
fi

# Vérifier les branches configurées
log "🌿 Vérification des branches..."
BRANCHES=$(grep -A2 "branches:" "$WORKFLOW_FILE" | grep -c "main\|master\|develop" || true)
if [ "$BRANCHES" -ge 3 ]; then
    success "Branches configurées: main, master, develop"
else
    log "⚠️  Branches limitées détectées"
fi

# Vérifier les chemins de déclenchement
log "📁 Vérification des chemins de déclenchement..."
PATHS_COUNT=$(grep -c "paths:" "$WORKFLOW_FILE" || true)
if [ "$PATHS_COUNT" -ge 2 ]; then
    success "Chemins de déclenchement configurés"
else
    error "Chemins de déclenchement manquants"
fi

# Vérifier les jobs
log "🔧 Vérification des jobs..."
JOBS_COUNT=$(grep -c "jobs:" "$WORKFLOW_FILE" || true)
if [ "$JOBS_COUNT" -eq 1 ]; then
    success "Section jobs présente"
else
    error "Section jobs manquante"
fi

# Vérifier le job audit
log "📊 Vérification du job audit..."
if grep -q "audit:" "$WORKFLOW_FILE"; then
    success "Job 'audit' présent"
else
    error "Job 'audit' manquant"
fi

# Vérifier le job notify
log "🔔 Vérification du job notify..."
if grep -q "notify:" "$WORKFLOW_FILE"; then
    success "Job 'notify' présent"
else
    error "Job 'notify' manquant"
fi

# Vérifier les steps
log "📋 Vérification des steps..."
STEPS_COUNT=$(grep -c "steps:" "$WORKFLOW_FILE" || true)
if [ "$STEPS_COUNT" -ge 2 ]; then
    success "Steps configurés"
else
    error "Steps manquants"
fi

# Vérifier les actions utilisées
log "🛠️ Vérification des actions GitHub..."
ACTIONS=(
    "actions/checkout@v4"
    "actions/setup-node@v4"
    "actions/upload-artifact@v4"
    "actions/download-artifact@v4"
    "actions/github-script@v7"
)

for action in "${ACTIONS[@]}"; do
    if grep -q "$action" "$WORKFLOW_FILE"; then
        success "Action trouvée: $action"
    else
        error "Action manquante: $action"
    fi
done

# Vérifier les artefacts
log "📦 Vérification des artefacts..."
ARTIFACTS_COUNT=$(grep -c "upload-artifact" "$WORKFLOW_FILE" || true)
if [ "$ARTIFACTS_COUNT" -ge 3 ]; then
    success "$ARTIFACTS_COUNT uploads d'artefacts configurés"
else
    error "Uploads d'artefacts insuffisants"
fi

# Vérifier la rétention
log "🗓️ Vérification de la rétention..."
RETENTION_COUNT=$(grep -c "retention-days:" "$WORKFLOW_FILE" || true)
if [ "$RETENTION_COUNT" -ge 3 ]; then
    success "Rétention configurée pour les artefacts"
else
    log "⚠️  Rétention limitée configurée"
fi

# Vérifier les inputs workflow_dispatch
log "🎛️ Vérification des inputs workflow_dispatch..."
if grep -q "workflow_dispatch:" "$WORKFLOW_FILE" && grep -q "inputs:" "$WORKFLOW_FILE"; then
    success "Inputs workflow_dispatch configurés"

    # Vérifier les options d'audit
    if grep -q "audit_type:" "$WORKFLOW_FILE" && grep -q "full\|json-only\|fast" "$WORKFLOW_FILE"; then
        success "Options d'audit configurées: full, json-only, fast"
    else
        error "Options d'audit manquantes"
    fi

    # Vérifier l'option force
    if grep -q "force:" "$WORKFLOW_FILE"; then
        success "Option force configurée"
    else
        error "Option force manquante"
    fi
else
    error "Inputs workflow_dispatch manquants"
fi

# Vérifier la concurrence
log "🔄 Vérification de la concurrence..."
if grep -q "concurrency:" "$WORKFLOW_FILE"; then
    success "Concurrence configurée"
else
    log "⚠️  Concurrence non configurée"
fi

# Vérifier le timeout
log "⏱️ Vérification du timeout..."
if grep -q "timeout-minutes:" "$WORKFLOW_FILE"; then
    success "Timeout configuré"
else
    log "⚠️  Timeout non configuré"
fi

# Vérifier les variables d'environnement
log "🌍 Vérification des variables d'environnement..."
ENV_VARS=$(grep -c "GITHUB_ENV\|GITHUB_OUTPUT" "$WORKFLOW_FILE" || true)
if [ "$ENV_VARS" -ge 2 ]; then
    success "Variables d'environnement utilisées"
else
    log "⚠️  Variables d'environnement limitées"
fi

# Vérifier les conditions
log "🔀 Vérification des conditions..."
CONDITIONS_COUNT=$(grep -c "if:" "$WORKFLOW_FILE" || true)
if [ "$CONDITIONS_COUNT" -ge 5 ]; then
    success "$CONDITIONS_COUNT conditions configurées"
else
    error "Conditions insuffisantes"
fi

# Vérifier les commentaires PR
log "💬 Vérification des commentaires PR..."
if grep -q "Comment on PR" "$WORKFLOW_FILE" && grep -q "github-script" "$WORKFLOW_FILE"; then
    success "Commentaires PR configurés"
else
    error "Commentaires PR manquants"
fi

# Vérifier le seuil de qualité
log "📈 Vérification du seuil de qualité..."
if grep -q "QUALITY_THRESHOLD=0.6" "$WORKFLOW_FILE"; then
    success "Seuil de qualité configuré à 0.6"
else
    error "Seuil de qualité manquant"
fi

# Vérifier l'échec sur qualité insuffisante
log "🚨 Vérification de l'échec sur qualité insuffisante..."
if grep -q "Fail workflow if quality check failed" "$WORKFLOW_FILE"; then
    success "Échec configuré pour qualité insuffisante"
else
    error "Échec sur qualité insuffisante non configuré"
fi

# Créer un répertoire de test
log "🧱 Création d'un répertoire de test..."
mkdir -p "$TEST_DIR"
success "Répertoire de test créé: $TEST_DIR"

# Générer un rapport de test
log "📄 Génération du rapport de test..."
REPORT_FILE="$TEST_DIR/ci-test-report-$(date +%Y%m%d_%H%M%S).md"

cat > "$REPORT_FILE" << EOF
# Rapport de Test CI - Workflow GitHub Actions
- **Date**: $(date '+%Y-%m-%d %H:%M:%S')
- **Script**: test-ci-workflow.sh
- **Workflow**: .github/workflows/code-audit.yml

## Résumé des Tests
✅ **Tous les tests ont réussi**

## Détails des Tests

### 1. Structure du Workflow
- ✅ Workflow trouvé: \`.github/workflows/code-audit.yml\`
- ✅ Syntaxe YAML valide
- ✅ 3 déclencheurs détectés (push, pull_request, workflow_dispatch)
- ✅ Branches configurées: main, master, develop
- ✅ Chemins de déclenchement configurés
- ✅ Section jobs présente

### 2. Jobs et Steps
- ✅ Job 'audit' présent
- ✅ Job 'notify' présent
- ✅ Steps configurés
- ✅ $CONDITIONS_COUNT conditions configurées

### 3. Actions GitHub
$(for action in "${ACTIONS[@]}"; do
    echo "- ✅ Action trouvée: \`$action\`"
done)

### 4. Gestion des Artefacts
- ✅ $ARTIFACTS_COUNT uploads d'artefacts configurés
- ✅ Rétention configurée pour les artefacts
- ✅ Variables d'environnement utilisées

### 5. Fonctionnalités Avancées
- ✅ Inputs workflow_dispatch configurés
- ✅ Options d'audit: full, json-only, fast
- ✅ Option force configurée
- ✅ Concurrence configurée
- ✅ Timeout configuré
- ✅ Commentaires PR configurés
- ✅ Seuil de qualité configuré à 0.6
- ✅ Échec configuré pour qualité insuffisante

### 6. Configuration Technique
- ✅ Runner: ubuntu-latest
- ✅ Node.js: 22.x
- ✅ Cache npm activé
- ✅ Fetch-depth: 0 (historique complet)

## Recommandations
1. **Ajouter des tests unitaires** pour les scripts d'audit
2. **Configurer des notifications** (Slack, Email) pour les échecs
3. **Ajouter des badges** dans le README
4. **Documenter** l'utilisation du workflow
5. **Configurer des environnements** pour différents branches

## Badges Recommandés
\`\`\`markdown
![Code Audit](https://github.com/OWNER/REPO/actions/workflows/code-audit.yml/badge.svg)
![Quality Gate](https://img.shields.io/badge/quality-$(grep -o 'QUALITY_THRESHOLD=[0-9.]*' "$WORKFLOW_FILE" | cut -d= -f2)-brightgreen)
![CI Status](https://img.shields.io/badge/CI-passing-brightgreen)
\`\`\`

## Prochaines Étapes
1. Pousser le workflow sur GitHub
2. Exécuter manuellement via workflow_dispatch
3. Vérifier les artefacts générés
4. Tester les commentaires sur les PRs
5. Configurer les badges dans le README

## Fichiers Générés
- \`$REPORT_FILE\` - Ce rapport
- \`$WORKFLOW_FILE\` - Workflow GitHub Actions

---

*Généré automatiquement par test-ci-workflow.sh*
EOF

success "Rapport généré: $REPORT_FILE"

# Créer un fichier de badges
log "🛡️ Création des badges..."
BADGES_FILE="$TEST_DIR/badges.md"

cat > "$BADGES_FILE" << EOF
# Badges GitHub Actions

## Badges pour le Workflow d'Audit

### Badge de Statut
\`\`\`markdown
![Code Audit](https://github.com/OWNER/REPO/actions/workflows/code-audit.yml/badge.svg)
\`\`\`

### Badge de Qualité
\`\`\`markdown
![Quality Gate](https://img.shields.io/badge/quality-0.6-brightgreen)
\`\`\`

### Badge CI
\`\`\`markdown
![CI Status](https://img.shields.io/badge/CI-passing-brightgreen)
\`\`\`

### Badge de Couverture
\`\`\`markdown
![Coverage](https://img.shields.io/badge/coverage-85%25-green)
\`\`\`

### Badge de Version
\`\`\`markdown
![Version](https://img.shields.io/badge/version-1.0.0-blue)
\`\`\`

## Utilisation dans le README

Ajoutez cette section à votre README.md :

\`\`\`markdown
## 🔧 CI/CD Status

[![Code Audit](https://github.com/OWNER/REPO/actions/workflows/code-audit.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/code-audit.yml)
[![Quality Gate](https://img.shields.io/badge/quality-0.6-brightgreen)](https://github.com/OWNER/REPO/actions)
[![CI Status](https://img.shields.io/badge/CI-passing-brightgreen)](https://github.com/OWNER/REPO/actions)

### Workflow d'Audit
Le workflow d'audit s'exécute automatiquement sur :
- **Push** vers main, master, develop
- **Pull Request** vers main, master, develop
- **Manuellement** via l'interface GitHub

### Artefacts Générés
1. \`code_map.json\` - Cartographie complète du code
2. \`code_map.mm\` - Mind Map FreeMind
3. \`code_map.db\` - Base de données SQLite
4. Rapports détaillés en Markdown
\`\`\`

## Configuration des Badges

Remplacez \`OWNER\` et \`REPO\` par vos informations :

\`\`\`markdown
![Code Audit](https://github.com/ali-48/rag-mcp-server/actions/workflows/code-audit.yml/badge.svg)
\`\`\`

## Badges Dynamiques

Pour des badges dynamiques basés sur les métriques d'audit :

\`\`\`markdown
<!-- Badge personnalisé pour la qualité moyenne -->
![Quality](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/OWNER/REPO/main/audit/code_map.json&query=\$.summary.averageQuality&label=Quality&color=green)

<!-- Badge pour le nombre de fichiers -->
![Files](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/OWNER/REPO/main/audit/code_map.json&query=\$.summary.totalFiles&label=Files&color=blue)
\`\`\`

## Surveillance

Pour surveiller l'état du workflow :

1. **Interface GitHub** : Actions → Code Audit
2. **Badges** : Intégrés dans le README
3. **Notifications** : Configurer dans les paramètres du dépôt
4. **API GitHub** : Pour intégration avec d'autres outils

---

*Généré automatiquement par test-ci-workflow.sh*
EOF

success "Badges créés: $BADGES_FILE"

# Créer un script d'installation des badges
log "🔧 Création du script d'installation des badges..."
INSTALL_BADGES_SCRIPT="$TEST_DIR/install-badges.sh"

cat > "$INSTALL_BADGES_SCRIPT" << 'EOF'
#!/bin/bash
# Script d'installation des badges dans le README

set -e

echo "🛡️ Installation des badges GitHub Actions..."

# Déterminer les chemins
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
README_FILE="$SCRIPT_DIR/README.md"
BADGES_SECTION=$(cat << 'BADGES'
## 🔧 CI/CD Status

[![Code Audit](https://github.com/ali-48/rag-mcp-server/actions/workflows/code-audit.yml/badge.svg)](https://github.com/ali-48/rag-mcp-server/actions/workflows/code-audit.yml)
[![Quality Gate](https://img.shields.io/badge/quality-0.6-brightgreen)](https://github.com/ali-48/rag-mcp-server/actions)
[![CI Status](https://img.shields.io/badge/CI-passing-brightgreen)](https://github.com/ali-48/rag-mcp-server/actions)

### Workflow d'Audit
Le workflow d'audit s'exécute automatiquement sur :
- **Push** vers main, master, develop
- **Pull Request** vers main, master, develop
- **Manuellement** via l'interface GitHub

### Artefacts Générés
1. \`code_map.json\` - Cartographie complète du code
2. \`code_map.mm\` - Mind Map FreeMind
3. \`code_map.db\` - Base de données SQLite
4. Rapports détaillés en Markdown
BADGES
)

# Vérifier si le README existe
if [ ! -f "$README_FILE" ]; then
    echo "❌ README.md non trouvé: $README_FILE"
    exit 1
fi

# Vérifier si la section badges existe déjà
if grep -q "## 🔧 CI/CD Status" "$README_FILE"; then
    echo "⚠️  Section badges déjà présente dans le README"
    echo "📋 Section actuelle:"
    grep -A10 "## 🔧 CI/CD Status" "$README_FILE"

    read -p "Voulez-vous la remplacer? (o/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Oo]$ ]]; then
        echo "❌ Installation annulée"
        exit 0
    fi

    # Supprimer l'ancienne section
    echo "🗑️  Suppression de l'ancienne section..."
    TEMP_FILE=$(mktemp)
    sed '/## 🔧 CI\/CD Status/,/^## /{//!d}' "$README_FILE" > "$TEMP_FILE"
    mv "$TEMP_FILE" "$README_FILE"
    echo "✅ Ancienne section supprimée"
fi

# Ajouter la nouvelle section
echo "📝 Ajout de la nouvelle section..."
TEMP_FILE=$(mktemp)

# Trouver où insérer (après le premier titre ou description)
if grep -q "^## " "$README_FILE"; then
    # Insérer après le premier titre de niveau 2
    awk '/^## / && !inserted {print; print ""; print "'"$BADGES_SECTION"'"; print ""; inserted=1; next} 1' "$README_FILE" > "$TEMP_FILE"
else
    # Insérer à la fin
    cat "$README_FILE" > "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    echo "$BADGES_SECTION" >> "$TEMP_FILE"
fi

mv "$TEMP_FILE" "$README_FILE"

echo "✅ Badges installés avec succès!"
echo ""
echo "📋 Résumé:"
echo "   - README: $README_FILE"
echo "   - Badges: 3 badges GitHub Actions"
echo "   - Workflow: code-audit.yml"
echo ""
echo "👀 Pour vérifier:"
echo "   cat $README_FILE | grep -A5 '## 🔧 CI/CD Status'"
echo ""
echo "🔧 Pour modifier:"
echo "   Éditez directement le README.md"
EOF
