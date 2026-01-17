# Métriques d'Exécution

## Structure des Métriques

Les fichiers de métriques sont organisés comme suit :

### Format des fichiers
- `metrics_TIMESTAMP.json` - Métriques complètes au format JSON
- `.gitignore` - Exclusion des métriques du versioning

### Métriques collectées

#### Métriques Temporelles
- **Durée totale d'exécution** : Temps total en millisecondes
- **Début/Fin** : Timestamps de début et fin d'exécution

#### Métriques de Volume
- **Fichiers traités** : Nombre de fichiers analysés avec succès
- **Fichiers ignorés** : Nombre de fichiers ignorés (exclusions)
- **Fichiers échoués** : Nombre de fichiers ayant échoué l'analyse

#### Métriques de Taille
- **Taille totale d'entrée** : Somme des tailles de tous les fichiers analysés
- **Taille totale de sortie** : Somme des tailles des fichiers générés
- **Fichiers de sortie** : Liste des fichiers générés avec leur taille et format

#### Métriques de Performance
- **Fichiers par seconde** : Vitesse de traitement
- **Bytes par seconde** : Débit de traitement
- **Taille moyenne des fichiers** : Taille moyenne des fichiers analysés

#### Métriques de Qualité
- **Score minimum** : Score de qualité le plus bas
- **Score maximum** : Score de qualité le plus élevé
- **Score moyen** : Moyenne des scores de qualité
- **Score médian** : Médiane des scores de qualité

#### Métriques de Complexité
- **Fonctions totales** : Nombre total de fonctions analysées
- **Classes totales** : Nombre total de classes analysées
- **Imports totaux** : Nombre total d'imports détectés
- **Appels totaux** : Nombre total d'appels de fonctions
- **Complexité cyclomatique moyenne** : Complexité moyenne du code

#### Métriques Système
- **Utilisation mémoire heap** : Mémoire utilisée par le processus
- **Mémoire heap totale** : Mémoire totale allouée
- **Mémoire RSS** : Resident Set Size (mémoire physique utilisée)

#### Métriques d'Erreurs
- **Types d'erreurs** : Classification des erreurs rencontrées
- **Nombre d'occurrences** : Fréquence de chaque type d'erreur
- **Fichiers concernés** : Liste des fichiers ayant généré des erreurs

## Utilisation

### Intégration dans le code
```typescript
import { MetricsCollector } from './execution-metrics';

// Initialisation
const metricsCollector = new MetricsCollector({
  enabled: true,
  logMetrics: true,
  saveToFile: true,
  outputDir: 'audit/metrics',
  collectMemory: true,
  collectQuality: true,
  collectComplexity: true
});

// Démarrage du timer
metricsCollector.startTimer('operationName');

// Enregistrement des métriques
metricsCollector.recordInputFile(filePath, fileSize);
metricsCollector.recordQualityScore(score);
metricsCollector.recordError('type', filePath);

// Finalisation
const metrics = metricsCollector.finalize();
const report = metricsCollector.generateReport();
```

### Commandes de surveillance
```bash
# Lister les fichiers de métriques
ls -la audit/metrics/

# Voir le dernier rapport
tail -n 50 audit/metrics/metrics_*.json | jq '.'

# Analyser les tendances
grep "filesPerSecond" audit/metrics/*.json | awk -F: '{print $2}' | sort -n

# Calculer la moyenne des durées
grep "totalDuration" audit/metrics/*.json | awk -F: '{sum+=$2} END {print "Average:", sum/NR, "ms"}'
```

## Recommandations Basées sur les Métriques

Le système génère automatiquement des recommandations basées sur les seuils :

### Performance
- **< 10 fichiers/seconde** : Optimisation recommandée
- **> 500MB mémoire utilisée** : Vérification des fuites mémoire

### Qualité
- **< 0.5 score moyen** : Amélioration de la qualité du code

### Erreurs
- **> 10 erreurs** : Vérification de la configuration
- **> 10% fichiers échoués** : Vérification des permissions/formats

### Complexité
- **> 10 complexité cyclomatique moyenne** : Simplification du code

### Taille
- **> 1MB taille moyenne des fichiers** : Division des fichiers recommandée

## Configuration

### Options du collecteur
```typescript
interface MetricsCollectorOptions {
  enabled: boolean;           // Activer/désactiver la collecte
  logMetrics: boolean;        // Logger les métriques dans la console
  saveToFile: boolean;        // Sauvegarder les métriques dans un fichier
  outputDir: string;          // Répertoire de sortie
  collectMemory: boolean;     // Collecter l'utilisation mémoire
  collectQuality: boolean;    // Collecter les scores de qualité
  collectComplexity: boolean; // Collecter les métriques de complexité
}
```

### Personnalisation
Pour personnaliser les seuils et comportements, étendez la classe `MetricsCollector` :
```typescript
class CustomMetricsCollector extends MetricsCollector {
  // Surcharger les méthodes pour personnaliser
}
```

## Dépannage

### Problèmes courants
1. **Pas de métriques générées** : Vérifier que `enabled = true`
2. **Fichiers non sauvegardés** : Vérifier les permissions d'écriture
3. **Métriques incomplètes** : Vérifier que tous les types de collecte sont activés
4. **Performances dégradées** : Désactiver certaines collectes si nécessaire

### Commandes de diagnostic
```bash
# Vérifier l'espace disque
du -sh audit/metrics/

# Vérifier les permissions
ls -la audit/metrics/

# Tester le collecteur
npx tsx scripts/test-metrics.ts
```

## Intégration avec les Logs

Les métriques sont complémentaires aux logs :
- **Logs** : Détails d'exécution, erreurs, warnings
- **Métriques** : Statistiques agrégées, performances, tendances

Utilisez les deux pour une observabilité complète :
```bash
# Corréler logs et métriques
grep "duration" audit/logs/*.log | tail -5
tail -1 audit/metrics/*.json | jq '.totalDuration'
```
