# Configuration Crontab pour Audit Périodique

Ce document explique comment configurer l'exécution périodique du script d'audit `cron-audit.sh` via crontab.

## 📋 Prérequis

1. **Script exécutable** : `scripts/cron-audit.sh` doit être exécutable

   ```bash
   chmod +x scripts/cron-audit.sh
   ```

2. **Dépendances** : Node.js, TypeScript, tsx doivent être installés

   ```bash
   node --version
   npx tsc --version
   ```

3. **Permissions** : L'utilisateur doit avoir les droits d'exécution

## 🚀 Installation de la configuration crontab

### Méthode 1 : Éditer directement le crontab

```bash
# Éditer le crontab de l'utilisateur courant
crontab -e
```

### Méthode 2 : Créer un fichier de configuration

```bash
# Créer un fichier de configuration
cat > ~/code-audit-crontab.txt << 'EOF'
# Configuration pour l'audit périodique du codebase
# Toutes les heures à la minute 0
0 * * * * /home/ali/Documents/Cline/MCP/rag-mcp-server/scripts/cron-audit.sh

# Tous les jours à 2h du matin
0 2 * * * /home/ali/Documents/Cline/MCP/rag-mcp-server/scripts/cron-audit.sh

# Tous les lundis à 3h du matin
0 3 * * 1 /home/ali/Documents/Cline/MCP/rag-mcp-server/scripts/cron-audit.sh
EOF

# Appliquer la configuration
crontab ~/code-audit-crontab.txt
```

### Méthode 3 : Script d'installation automatique

```bash
# Exécuter le script d'installation
./scripts/install-cron-audit.sh
```

## ⏰ Exemples de configurations

### 1. Toutes les heures (à la minute 0)

```cron
0 * * * * /chemin/absolu/vers/scripts/cron-audit.sh
```

### 2. Tous les jours à 2h du matin

```cron
0 2 * * * /chemin/absolu/vers/scripts/cron-audit.sh
```

### 3. Toutes les 6 heures (0, 6, 12, 18h)

```cron
0 0,6,12,18 * * * /chemin/absolu/vers/scripts/cron-audit.sh
```

### 4. Tous les lundis à 3h du matin

```cron
0 3 * * 1 /chemin/absolu/vers/scripts/cron-audit.sh
```

### 5. Toutes les 30 minutes

```cron
*/30 * * * * /chemin/absolu/vers/scripts/cron-audit.sh
```

### 6. Tous les jours ouvrables (lundi-vendredi) à 8h

```cron
0 8 * * 1-5 /chemin/absolu/vers/scripts/cron-audit.sh
```

### 7. Le premier jour de chaque mois à minuit

```cron
0 0 1 * * /chemin/absolu/vers/scripts/cron-audit.sh
```

## 🔧 Configuration avancée

### Avec redirection des logs

```cron
0 * * * * /chemin/absolu/vers/scripts/cron-audit.sh >> /var/log/code-audit.log 2>&1
```

### Avec variables d'environnement

```cron
0 * * * * cd /chemin/absolu/vers && PATH=/usr/local/bin:$PATH ./scripts/cron-audit.sh
```

### Avec notification par email

```cron
0 2 * * * /chemin/absolu/vers/scripts/cron-audit.sh | mail -s "Rapport d'audit quotidien" admin@example.com
```

### Avec exécution conditionnelle (seulement si Git a des changements)

```cron
0 * * * * cd /chemin/absolu/vers && git status --porcelain | grep -q . && ./scripts/cron-audit.sh
```

## 📊 Surveillance des exécutions

### Vérifier les jobs cron actifs

```bash
# Lister tous les jobs cron
crontab -l

# Vérifier les logs système
grep CRON /var/log/syslog | tail -20

# Vérifier les logs spécifiques
tail -f /var/log/code-audit.log
```

### Vérifier l'historique d'exécution

```bash
# Vérifier les fichiers de logs générés
ls -la audit/logs/cron_*.log

# Vérifier les rapports générés
ls -la audit/logs/cron_summary_*.md

# Afficher le dernier rapport
cat $(ls -t audit/logs/cron_summary_*.md | head -1)
```

### Surveiller l'utilisation des ressources

```bash
# Vérifier la consommation mémoire
ps aux | grep cron-audit

# Vérifier le temps d'exécution
grep "Audit périodique réussi en" audit/logs/cron_*.log | tail -5
```

## 🔧 Dépannage

### Problème : Cron ne s'exécute pas

```bash
# 1. Vérifier que cron est actif
sudo systemctl status cron

# 2. Vérifier les permissions du script
ls -la scripts/cron-audit.sh

# 3. Vérifier le chemin absolu
which bash
readlink -f scripts/cron-audit.sh

# 4. Tester manuellement
./scripts/cron-audit.sh

# 5. Vérifier les logs cron
grep CRON /var/log/syslog | grep -i error
```

### Problème : Variables d'environnement manquantes

```bash
# Ajouter les variables dans le crontab
PATH=/usr/local/bin:/usr/bin:/bin
NODE_ENV=production
```

### Problème : Permissions insuffisantes

```bash
# Donner les permissions d'exécution
chmod +x scripts/cron-audit.sh

# Vérifier les permissions du dossier
ls -la scripts/

# Exécuter en tant qu'utilisateur approprié
sudo -u www-data crontab -e
```

### Problème : Script trop long

```bash
# Réduire la fréquence
# De toutes les heures à tous les jours
0 2 * * * /chemin/absolu/vers/scripts/cron-audit.sh

# Ou utiliser l'option --fast
0 * * * * /chemin/absolu/vers/scripts/cron-audit.sh --fast
```

## 📈 Optimisation des performances

### Configuration recommandée pour les grands projets

```cron
# Exécution nocturne (2h du matin) pour éviter l'impact sur les performances
0 2 * * * /chemin/absolu/vers/scripts/cron-audit.sh

# Ou le week-end seulement
0 3 * * 6 /chemin/absolu/vers/scripts/cron-audit.sh
```

### Avec limitation des ressources

```cron
0 2 * * * /usr/bin/timeout 300 /chemin/absolu/vers/scripts/cron-audit.sh
```

### Avec priorité basse

```cron
0 2 * * * nice -n 19 /chemin/absolu/vers/scripts/cron-audit.sh
```

## 🔄 Intégration avec d'autres systèmes

### Avec monitoring (Prometheus)

```bash
# Exporter les métriques
./scripts/cron-audit.sh --export-metrics /var/lib/node_exporter/code_audit.prom
```

### Avec alerting (Slack/Email)

```bash
# Script wrapper avec notifications
0 2 * * * /chemin/absolu/vers/scripts/cron-audit-with-notifications.sh
```

### Avec archivage automatique

```cron
0 3 * * * /chemin/absolu/vers/scripts/cron-audit.sh && /chemin/absolu/vers/scripts/archive-old-reports.sh
```

## 📝 Script d'installation automatique

### Créer un script d'installation

```bash
#!/bin/bash
# scripts/install-cron-audit.sh

set -e

echo "🔧 Installation de la configuration crontab pour l'audit périodique..."

# Déterminer le chemin absolu
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRON_SCRIPT="$SCRIPT_DIR/scripts/cron-audit.sh"

# Vérifier que le script existe
if [ ! -f "$CRON_SCRIPT" ]; then
    echo "❌ Script cron-audit.sh non trouvé: $CRON_SCRIPT"
    exit 1
fi

# Rendre le script exécutable
chmod +x "$CRON_SCRIPT"

# Créer la configuration crontab
CRON_CONFIG="# Audit périodique du codebase - $(date '+%Y-%m-%d')
# Toutes les heures à la minute 0
0 * * * * $CRON_SCRIPT
# Tous les jours à 2h du matin
0 2 * * * $CRON_SCRIPT"

# Sauvegarder l'ancienne configuration
BACKUP_FILE="$HOME/crontab-backup-$(date +%Y%m%d_%H%M%S).bak"
crontab -l > "$BACKUP_FILE" 2>/dev/null || true
echo "📁 Ancienne configuration sauvegardée: $BACKUP_FILE"

# Appliquer la nouvelle configuration
echo "$CRON_CONFIG" | crontab -

# Vérifier l'installation
echo "✅ Configuration appliquée:"
crontab -l | grep -A2 -B2 "cron-audit"

echo ""
echo "📋 Résumé:"
echo "   - Script: $CRON_SCRIPT"
echo "   - Exécution: Toutes les heures (minute 0) et tous les jours à 2h"
echo "   - Logs: audit/logs/cron_*.log"
echo "   - Rapports: audit/logs/cron_summary_*.md"
echo ""
echo "🔧 Pour modifier la configuration:"
echo "   crontab -e"
echo ""
echo "👀 Pour surveiller les exécutions:"
echo "   tail -f audit/logs/cron_*.log"
```

### Exécuter l'installation

```bash
chmod +x scripts/install-cron-audit.sh
./scripts/install-cron-audit.sh
```

## 🚨 Bonnes pratiques

1. **Utiliser des chemins absolus** dans crontab
2. **Rediriger les sorties** vers des fichiers de log
3. **Tester manuellement** avant de déployer en cron
4. **Surveiller les ressources** (CPU, mémoire, disque)
5. **Archiver les anciens logs** régulièrement
6. **Configurer des alertes** en cas d'échec
7. **Documenter la configuration** dans le README
8. **Réviser périodiquement** la fréquence d'exécution

## 📊 Métriques de surveillance

### À surveiller régulièrement

- Temps d'exécution moyen
- Taille des fichiers générés
- Nombre de fichiers analysés
- Qualité moyenne du code
- Taux d'échec des exécutions

### Alertes à configurer

- Temps d'exécution > 5 minutes
- Qualité moyenne < 0.6
- Échec d'exécution consécutif
- Espace disque insuffisant

## 🔮 Évolutions futures

- [ ] Interface web de monitoring
- [ ] Notifications push (Slack, Teams)
- [ ] Intégration avec Grafana
- [ ] Analyse comparative historique
- [ ] Optimisation incrémentale
- [ ] Support multi-projets

---

_Document généré automatiquement - Dernière mise à jour: $(date '+%Y-%m-%d %H:%M:%S')_
