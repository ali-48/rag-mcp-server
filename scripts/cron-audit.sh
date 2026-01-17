#!/bin/bash
# Script cron pour audit périodique du codebase
# Exécute un audit complet à intervalles réguliers

set -e

echo "🕐 Audit périodique du codebase (cron)..."

# Définir les chemins
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUDIT_DIR="$SCRIPT_DIR/audit"
LOG_DIR="$AUDIT_DIR/logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="$LOG_DIR/cron_audit_${TIMESTAMP}.log"
SUMMARY_FILE="$LOG_DIR/cron_summary_${TIMESTAMP}.md"

# Créer les dossiers si nécessaire
mkdir -p "$LOG_DIR"

# Fonction de log
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Fonction d'erreur
error() {
    log "❌ $1"
    exit 1
}

# Vérifier si le script Code Mapper existe
CODE_MAPPER="$SCRIPT_DIR/scripts/code-mapper.ts"
if [ ! -f "$CODE_MAPPER" ]; then
    error "Script Code Mapper non trouvé: $CODE_MAPPER"
fi

# Vérifier si tsx est disponible
if ! command -v npx &> /dev/null; then
    error "npx n'est pas disponible. Installez Node.js et npm."
fi

log "📁 Dossier du projet: $SCRIPT_DIR"
log "📄 Script Code Mapper: $CODE_MAPPER"
log "📁 Dossier d'audit: $AUDIT_DIR"
log "📁 Dossier de logs: $LOG_DIR"

# Obtenir des informations système
log "💻 Informations système:"
log "   OS: $(uname -s)"
log "   Architecture: $(uname -m)"
log "   Node.js: $(node --version 2>/dev/null || echo 'non disponible')"
log "   npm: $(npm --version 2>/dev/null || echo 'non disponible')"
log "   TypeScript: $(npx tsc --version 2>/dev/null || echo 'non disponible')"

# Vérifier l'état du dépôt Git
if [ -d "$SCRIPT_DIR/.git" ]; then
    log "📊 État du dépôt Git:"
    CURRENT_BRANCH=$(git -C "$SCRIPT_DIR" branch --show-current 2>/dev/null || echo "unknown")
    LAST_COMMIT=$(git -C "$SCRIPT_DIR" log -1 --pretty="%h - %s (%cr)" 2>/dev/null || echo "unknown")
    COMMIT_COUNT=$(git -C "$SCRIPT_DIR" rev-list --count HEAD 2>/dev/null || echo "0")

    log "   Branche: $CURRENT_BRANCH"
    log "   Dernier commit: $LAST_COMMIT"
    log "   Nombre de commits: $COMMIT_COUNT"

    # Vérifier les modifications non commitées
    UNCOMMITTED_CHANGES=$(git -C "$SCRIPT_DIR" status --porcelain 2>/dev/null | wc -l)
    if [ "$UNCOMMITTED_CHANGES" -gt 0 ]; then
        log "   ⚠️  Modifications non commitées: $UNCOMMITTED_CHANGES fichiers"
    else
        log "   ✅ Aucune modification non commitée"
    fi
else
    log "ℹ️  Pas de dépôt Git détecté"
fi

# Exécuter l'audit complet
log "🚀 Exécution de l'audit périodique complet..."
START_TIME=$(date +%s)

# Exécuter l'audit avec logs détaillés
cd "$SCRIPT_DIR"
AUDIT_OUTPUT=$(npx tsx "$CODE_MAPPER" --output-all --verbose 2>&1)
AUDIT_EXIT_CODE=$?

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

if [ $AUDIT_EXIT_CODE -eq 0 ]; then
    log "✅ Audit périodique réussi en ${DURATION}s"

    # Vérifier les fichiers générés
    JSON_FILE="$AUDIT_DIR/code_map.json"
    MINDMAP_FILE="$AUDIT_DIR/code_map.mm"
    SQLITE_FILE="$AUDIT_DIR/code_map.db"

    if [ -f "$JSON_FILE" ]; then
        log "📄 Fichier JSON généré: $JSON_FILE"

        # Analyser les métriques de qualité
        if command -v jq &> /dev/null; then
            log "📊 Analyse des métriques de qualité..."

            # Extraire les métriques principales
            TOTAL_FILES=$(jq '.summary.totalFiles' "$JSON_FILE")
            CODE_FILES=$(jq '.summary.codeFiles' "$JSON_FILE")
            FUNCTIONS=$(jq '.summary.functions' "$JSON_FILE")
            CLASSES=$(jq '.summary.classes' "$JSON_FILE")
            IMPORTS=$(jq '.summary.imports' "$JSON_FILE")
            CALLS=$(jq '.summary.calls' "$JSON_FILE")

            # Calculer la qualité moyenne
            QUALITY_ARRAY=$(jq '[.files[].score.quality]' "$JSON_FILE")
            QUALITY_COUNT=$(echo "$QUALITY_ARRAY" | jq 'length')
            QUALITY_SUM=$(echo "$QUALITY_ARRAY" | jq 'add')

            if [ "$QUALITY_COUNT" -gt 0 ]; then
                QUALITY_AVG=$(echo "scale=3; $QUALITY_SUM / $QUALITY_COUNT" | bc -l)
            else
                QUALITY_AVG=0
            fi

            # Identifier les fichiers avec qualité faible
            LOW_QUALITY_FILES=$(jq -r '.files[] | select(.score.quality < 0.5) | .path' "$JSON_FILE" 2>/dev/null || echo "")
            LOW_QUALITY_COUNT=$(echo "$LOW_QUALITY_FILES" | wc -l)

            log "📈 Métriques du projet:"
            log "   Fichiers totaux: $TOTAL_FILES"
            log "   Fichiers de code: $CODE_FILES"
            log "   Fonctions: $FUNCTIONS"
            log "   Classes: $CLASSES"
            log "   Imports: $IMPORTS"
            log "   Appels: $CALLS"
            log "   Qualité moyenne: $(echo "$QUALITY_AVG" | awk '{printf "%.3f", $1}')"

            if [ "$LOW_QUALITY_COUNT" -gt 0 ]; then
                log "   ⚠️  Fichiers avec qualité faible (< 0.5): $LOW_QUALITY_COUNT"
                echo "$LOW_QUALITY_FILES" | head -5 | while read -r file; do
                    log "     - $file"
                done
                if [ "$LOW_QUALITY_COUNT" -gt 5 ]; then
                    log "     ... et $(($LOW_QUALITY_COUNT - 5)) autres"
                fi
            else
                log "   ✅ Aucun fichier avec qualité faible"
            fi

            # Identifier les fichiers les plus complexes
            COMPLEX_FILES=$(jq -r '.files[] | select(.type == "code") | [.path, .score.complexity] | @tsv' "$JSON_FILE" 2>/dev/null | sort -k2 -nr | head -3 || echo "")
            if [ -n "$COMPLEX_FILES" ]; then
                log "🔍 Fichiers les plus complexes:"
                echo "$COMPLEX_FILES" | while read -r file complexity; do
                    log "     - $file: $(echo "$complexity" | awk '{printf "%.3f", $1}')"
                done
            fi

        else
            log "ℹ️  jq non disponible, analyse des métriques limitée"
        fi
    else
        log "⚠️  Fichier JSON non généré"
    fi

    if [ -f "$MINDMAP_FILE" ]; then
        log "🗺️  Mind Map générée: $MINDMAP_FILE"
    fi

    if [ -f "$SQLITE_FILE" ]; then
        log "💾 Base SQLite générée: $SQLITE_FILE"

        # Exécuter des requêtes d'analyse si sqlite3 est disponible
        if command -v sqlite3 &> /dev/null; then
            log "📊 Analyse SQLite:"

            # Compter les entrées
            FILES_COUNT=$(sqlite3 "$SQLITE_FILE" "SELECT COUNT(*) FROM files;" 2>/dev/null || echo "0")
            FUNCTIONS_COUNT=$(sqlite3 "$SQLITE_FILE" "SELECT COUNT(*) FROM functions;" 2>/dev/null || echo "0")
            CLASSES_COUNT=$(sqlite3 "$SQLITE_FILE" "SELECT COUNT(*) FROM classes;" 2>/dev/null || echo "0")
            IMPORTS_COUNT=$(sqlite3 "$SQLITE_FILE" "SELECT COUNT(*) FROM import_relations;" 2>/dev/null || echo "0")

            log "   Fichiers dans DB: $FILES_COUNT"
            log "   Fonctions dans DB: $FUNCTIONS_COUNT"
            log "   Classes dans DB: $CLASSES_COUNT"
            log "   Relations d'imports dans DB: $IMPORTS_COUNT"

            # Qualité moyenne dans la base
            AVG_QUALITY=$(sqlite3 "$SQLITE_FILE" "SELECT AVG(quality) FROM files;" 2>/dev/null || echo "0")
            log "   Qualité moyenne (DB): $(echo "$AVG_QUALITY" | awk '{printf "%.3f", $1}')"
        fi
    fi

    # Générer un rapport de synthèse
    log "📋 Génération du rapport de synthèse..."
    cat > "$SUMMARY_FILE" << EOF
# Rapport d'audit périodique
- **Date**: $(date '+%Y-%m-%d %H:%M:%S')
- **Durée d'exécution**: ${DURATION}s
- **Script**: cron-audit.sh
- **Projet**: $(basename "$SCRIPT_DIR")

## Métriques du projet
- **Fichiers totaux**: $TOTAL_FILES
- **Fichiers de code**: $CODE_FILES
- **Fonctions**: $FUNCTIONS
- **Classes**: $CLASSES
- **Imports**: $IMPORTS
- **Appels**: $CALLS
- **Qualité moyenne**: $(echo "$QUALITY_AVG" | awk '{printf "%.3f", $1}')

## État du dépôt Git
- **Branche**: $CURRENT_BRANCH
- **Dernier commit**: $LAST_COMMIT
- **Nombre de commits**: $COMMIT_COUNT
- **Modifications non commitées**: $UNCOMMITTED_CHANGES

## Fichiers générés
- \`code_map.json\`: Cartographie JSON complète ($(stat -c%s "$JSON_FILE" 2>/dev/null || echo "0") octets)
- \`code_map.mm\`: Mind Map FreeMind ($(stat -c%s "$MINDMAP_FILE" 2>/dev/null || echo "0") octets)
- \`code_map.db\`: Base de données SQLite ($(stat -c%s "$SQLITE_FILE" 2>/dev/null || echo "0") octets)

## Alertes
$(if [ "$LOW_QUALITY_COUNT" -gt 0 ]; then
    echo "- ⚠️  **$LOW_QUALITY_COUNT fichiers avec qualité faible (< 0.5)**"
    echo "$LOW_QUALITY_FILES" | head -10 | while read -r file; do
        echo "  - $file"
    done
    if [ "$LOW_QUALITY_COUNT" -gt 10 ]; then
        echo "  - ... et $(($LOW_QUALITY_COUNT - 10)) autres"
    fi
else
    echo "- ✅ Aucun fichier avec qualité faible"
fi)

## Recommandations
1. Examiner les fichiers avec qualité faible
2. Réduire la complexité des fichiers identifiés
3. Mettre à jour la documentation si nécessaire
4. Planifier des refactorings si la qualité diminue

## Historique
Pour suivre l'évolution de la qualité :
\`\`\`sql
SELECT
  strftime('%Y-%m-%d', created_at) as date,
  COUNT(*) as files,
  AVG(quality) as avg_quality,
  MIN(quality) as min_quality,
  MAX(quality) as max_quality
FROM files
GROUP BY strftime('%Y-%m-%d', created_at)
ORDER BY date DESC;
\`\`\`

## Prochaine exécution
L'audit périodique s'exécutera selon la configuration cron.

---
*Généré automatiquement par cron-audit.sh*
EOF

    log "📄 Rapport de synthèse: $SUMMARY_FILE"

else
    log "❌ Audit périodique échoué après ${DURATION}s"
    log "📝 Sortie d'erreur:"
    echo "$AUDIT_OUTPUT" | while read -r line; do
        log "   $line"
    done

    # Générer un rapport d'erreur
    ERROR_FILE="$LOG_DIR/cron_error_${TIMESTAMP}.md"
    cat > "$ERROR_FILE" << EOF
# Erreur d'audit périodique
- **Date**: $(date '+%Y-%m-%d %H:%M:%S')
- **Durée d'exécution**: ${DURATION}s
- **Code de sortie**: $AUDIT_EXIT_CODE

## Détails de l'erreur
\`\`\`
$AUDIT_OUTPUT
\`\`\`

## Actions recommandées
1. Vérifier les dépendances (Node.js, TypeScript, tsx)
2. Vérifier les permissions d'accès aux fichiers
3. Examiner les logs détaillés: $LOG_FILE
4. Tester manuellement: \`npx tsx scripts/code-mapper.ts --output-all\`

## Informations système
- **OS**: $(uname -s)
- **Architecture**: $(uname -m)
- **Node.js**: $(node --version 2>/dev/null || echo 'non disponible')
- **npm**: $(npm --version 2>/dev/null || echo 'non disponible')

---
*Généré automatiquement par cron-audit.sh*
EOF

    log "📄 Rapport d'erreur: $ERROR_FILE"
    error "L'audit périodique a échoué. Voir $LOG_FILE pour les détails."
fi

log "✅ Audit périodique terminé avec succès"
log "📁 Logs détaillés: $LOG_FILE"
log "📄 Rapport de synthèse: $SUMMARY_FILE"

exit 0
