#!/bin/bash
# Script d'installation automatique pour la configuration crontab de l'audit périodique

set -e

echo "🔧 Installation de la configuration crontab pour l'audit périodique..."

# Déterminer le chemin absolu
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRON_SCRIPT="$SCRIPT_DIR/scripts/cron-audit.sh"

# Vérifier que le script existe
if [ ! -f "$CRON_SCRIPT" ]; then
    echo "❌ Script cron-audit.sh non trouvé: $CRON_SCRIPT"
    echo "💡 Exécutez d'abord: ./scripts/cron-audit.sh pour le créer"
    exit 1
fi

# Vérifier que le script est exécutable
if [ ! -x "$CRON_SCRIPT" ]; then
    echo "⚠️  Le script n'est pas exécutable, correction en cours..."
    chmod +x "$CRON_SCRIPT"
    echo "✅ Script rendu exécutable"
fi

# Vérifier les dépendances
echo "🔍 Vérification des dépendances..."

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé"
    echo "💡 Installez Node.js: https://nodejs.org/"
    exit 1
else
    echo "✅ Node.js: $(node --version)"
fi

# Vérifier npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm n'est pas installé"
    exit 1
else
    echo "✅ npm: $(npm --version)"
fi

# Vérifier TypeScript
if ! npx tsc --version &> /dev/null; then
    echo "⚠️  TypeScript n'est pas installé globalement"
    echo "💡 Installation en cours..."
    npm install -g typescript
    echo "✅ TypeScript installé"
else
    echo "✅ TypeScript: $(npx tsc --version)"
fi

# Vérifier tsx
if ! npx tsx --version &> /dev/null 2>&1; then
    echo "⚠️  tsx n'est pas installé"
    echo "💡 Installation en cours..."
    npm install -g tsx
    echo "✅ tsx installé"
else
    echo "✅ tsx disponible"
fi

# Vérifier jq (optionnel mais recommandé)
if command -v jq &> /dev/null; then
    echo "✅ jq: $(jq --version)"
else
    echo "⚠️  jq n'est pas installé (optionnel pour l'analyse avancée)"
    echo "💡 Installation recommandée: sudo apt-get install jq"
fi

# Vérifier sqlite3 (optionnel)
if command -v sqlite3 &> /dev/null; then
    echo "✅ sqlite3: $(sqlite3 --version)"
else
    echo "⚠️  sqlite3 n'est pas installé (optionnel pour l'analyse SQLite)"
fi

# Créer la configuration crontab
echo "📝 Création de la configuration crontab..."

CRON_CONFIG="# ============================================
# Configuration pour l'audit périodique du codebase
# Installé le: $(date '+%Y-%m-%d %H:%M:%S')
# Projet: $(basename "$SCRIPT_DIR")
# Script: $CRON_SCRIPT
# ============================================

# Tous les jours à 2h du matin (audit quotidien complet)
0 2 * * * cd '$SCRIPT_DIR' && '$CRON_SCRIPT' >> '$SCRIPT_DIR/audit/logs/cron-daily.log' 2>&1"

# Sauvegarder l'ancienne configuration
BACKUP_FILE="$HOME/crontab-backup-$(date +%Y%m%d_%H%M%S).bak"
echo "📁 Sauvegarde de l'ancienne configuration dans: $BACKUP_FILE"
crontab -l > "$BACKUP_FILE" 2>/dev/null || echo "⚠️  Pas d'ancienne configuration à sauvegarder"

# Vérifier s'il y a déjà une configuration pour ce script
EXISTING_CONFIG=$(crontab -l 2>/dev/null | grep -c "$CRON_SCRIPT" || true)
if [ "$EXISTING_CONFIG" -gt 0 ]; then
    echo "⚠️  Une configuration existe déjà pour ce script"
    echo "📋 Configuration actuelle:"
    crontab -l | grep -A2 -B2 "$CRON_SCRIPT"

    read -p "Voulez-vous la remplacer? (o/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Oo]$ ]]; then
        echo "❌ Installation annulée"
        exit 0
    fi

    # Supprimer l'ancienne configuration
    echo "🗑️  Suppression de l'ancienne configuration..."
    TEMP_FILE=$(mktemp)
    crontab -l 2>/dev/null | grep -v "$CRON_SCRIPT" > "$TEMP_FILE" || true
    crontab "$TEMP_FILE"
    rm "$TEMP_FILE"
    echo "✅ Ancienne configuration supprimée"
fi

# Appliquer la nouvelle configuration
echo "🚀 Application de la nouvelle configuration..."
echo "$CRON_CONFIG" | crontab -

# Vérifier l'installation
echo "✅ Configuration appliquée avec succès!"
echo ""
echo "📋 Résumé de l'installation:"
echo "   - Projet: $(basename "$SCRIPT_DIR")"
echo "   - Dossier: $SCRIPT_DIR"
echo "   - Script: $CRON_SCRIPT"
echo "   - Backup: $BACKUP_FILE"
echo ""
echo "⏰ Planification configurée:"
echo "   • Tous les jours à 2h du matin (audit quotidien complet)"
echo ""
echo "📁 Structure des logs:"
echo "   - audit/logs/cron-daily.log     (exécutions quotidiennes)"
echo "   - audit/logs/cron_*.log         (logs détaillés par exécution)"
echo "   - audit/logs/cron_summary_*.md  (rapports de synthèse)"
echo ""
echo "🔧 Commandes utiles:"
echo "   # Vérifier la configuration"
echo "   crontab -l"
echo ""
echo "   # Modifier la configuration"
echo "   crontab -e"
echo ""
echo "   # Surveiller les logs système"
echo "   tail -f /var/log/syslog | grep CRON"
echo ""
echo "   # Surveiller les logs d'audit"
echo "   tail -f audit/logs/cron-daily.log"
echo ""
echo "   # Tester manuellement"
echo "   ./scripts/cron-audit.sh"
echo ""
echo "   # Désinstaller"
echo "   crontab -l | grep -v '$CRON_SCRIPT' | crontab -"
echo ""
echo "👀 Pour vérifier que tout fonctionne:"
echo "   1. Attendez 2h du matin (ou testez manuellement)"
echo "   2. Vérifiez les logs: tail -f audit/logs/cron-daily.log"
echo "   3. Vérifiez les fichiers générés: ls -la audit/logs/cron_*.log"
echo ""
echo "📚 Documentation:"
echo "   - scripts/crontab-configuration.md (guide complet)"
echo "   - README_AUDIT.md (documentation générale)"
echo ""
echo "🎉 Installation terminée avec succès!"

# Tester le script immédiatement (optionnel)
read -p "Voulez-vous tester le script maintenant? (cela prendra ~1 minute) (o/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Oo]$ ]]; then
    echo "🧪 Test du script en cours..."
    cd "$SCRIPT_DIR"
    if ./scripts/cron-audit.sh; then
        echo "✅ Test réussi!"
        echo "📁 Fichiers générés:"
        ls -la audit/code_map.* 2>/dev/null || echo "   (fichiers en cours de génération)"
        echo "📄 Dernier rapport:"
        ls -t audit/logs/cron_summary_*.md 2>/dev/null | head -1 | xargs cat 2>/dev/null | head -20 || echo "   (rapport en cours de génération)"
    else
        echo "❌ Test échoué, vérifiez les erreurs ci-dessus"
        echo "💡 Conseils de dépannage:"
        echo "   - Vérifiez les dépendances: node, npm, typescript, tsx"
        echo "   - Vérifiez les permissions: chmod +x scripts/cron-audit.sh"
        echo "   - Exécutez manuellement: ./scripts/cron-audit.sh"
    fi
fi

exit 0
