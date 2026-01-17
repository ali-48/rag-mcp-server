# Logs d'Audit de Code

## Structure des Logs

Les fichiers de logs sont organisés comme suit :

### Format des fichiers
- `audit_YYYYMMDD_HHMMSS.log` - Logs principaux avec timestamp
- `summary_TIMESTAMP.json` - Résumés d'exécution
- `.gitignore` - Exclusion des logs du versioning

### Niveaux de Log
- **INFO** : Informations générales sur l'exécution
- **WARN** : Avertissements (problèmes non critiques)
- **ERROR** : Erreurs critiques
- **DEBUG** : Informations de débogage détaillées

### Contenu des Logs
Chaque ligne de log contient :
```
[timestamp] [LEVEL] message (duration: Xms)
```

Exemple :
```
[2025-01-17T02:30:45.123Z] [INFO] Starting code audit (duration: 1500ms)
```

## Gestion des Logs

### Rotation automatique
- Maximum 30 fichiers de logs
- Taille maximale par fichier : 10MB
- Les anciens fichiers sont automatiquement supprimés

### Nettoyage
Pour nettoyer manuellement les logs :
```bash
rm -rf audit/logs/*.log
```

### Surveillance
Pour surveiller les logs en temps réel :
```bash
tail -f audit/logs/audit_*.log
```

## Intégration

Les logs sont intégrés dans :
1. **Script principal** : `code-mapper.ts`
2. **Hooks Git** : pre-commit, post-commit, post-merge
3. **Script cron** : `cron-audit.sh`
4. **GitHub Actions** : Workflow d'audit

## Dépannage

### Problèmes courants
1. **Pas de logs générés** : Vérifier que `logging.enabled = true`
2. **Logs trop volumineux** : Ajuster `maxFileSize` et `maxFiles`
3. **Niveau de log trop bas** : Ajuster `logLevel` (INFO, WARN, ERROR, DEBUG)

### Commandes utiles
```bash
# Compter les erreurs
grep -c "[ERROR]" audit/logs/*.log

# Voir les 10 dernières erreurs
grep "[ERROR]" audit/logs/*.log | tail -10

# Analyser les performances
grep "duration:" audit/logs/*.log | awk '{sum+=$4} END {print "Average:", sum/NR, "ms"}'
```

## Configuration

La configuration se trouve dans :
- `scripts/logging-utils.ts` - Configuration par défaut
- `code-mapper.ts` - Options de logging

Pour personnaliser :
```typescript
import { initLogger } from './logging-utils';

const logger = initLogger({
  logLevel: 'DEBUG',
  maxFiles: 50,
  includeConsole: false
});
```
