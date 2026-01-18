// scripts/cache-utils/cache-directory-utils.ts
// Utilitaires pour la gestion des répertoires de cache
import * as fs from 'fs';
import * as path from 'path';
/**
 * Options par défaut pour le cache AST
 */
export const DEFAULT_AST_CACHE_OPTIONS = {
    rootDir: 'audit',
    cacheDirName: 'ast-cache',
    createGitignore: true,
    createReadme: true,
    gitignoreContent: '# Cache AST\nast-cache/\n',
    readmeContent: undefined // Utilisera le contenu par défaut
};
/**
 * Crée la structure de répertoires pour un cache
 */
export function createCacheDirectories(options) {
    const createdDirs = [];
    // Créer le répertoire racine
    if (!fs.existsSync(options.rootDir)) {
        fs.mkdirSync(options.rootDir, { recursive: true });
        createdDirs.push(options.rootDir);
        console.log(`✅ Répertoire racine créé: ${options.rootDir}`);
    }
    // Créer le répertoire de cache
    const cacheDir = path.join(options.rootDir, options.cacheDirName);
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
        createdDirs.push(cacheDir);
        console.log(`✅ Répertoire de cache créé: ${cacheDir}`);
    }
    // Créer les sous-répertoires de cache
    const subDirs = ['entries', 'index', 'stats', 'temp'];
    for (const subDir of subDirs) {
        const fullPath = path.join(cacheDir, subDir);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
            createdDirs.push(fullPath);
            console.log(`✅ Sous-répertoire créé: ${fullPath}`);
        }
    }
    return createdDirs;
}
/**
 * Configure le fichier .gitignore pour un cache
 */
export function setupGitignoreForCache(options) {
    const gitignorePath = path.join(options.rootDir, '.gitignore');
    let gitignoreContent = '';
    // Lire le contenu existant
    if (fs.existsSync(gitignorePath)) {
        gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    }
    // Vérifier si le cache est déjà ignoré
    const cacheIgnorePattern = `${options.cacheDirName}/`;
    if (gitignoreContent.includes(cacheIgnorePattern)) {
        console.log(`✅ Cache déjà ignoré dans: ${gitignorePath}`);
        return false;
    }
    // Ajouter le contenu au .gitignore
    const contentToAdd = options.gitignoreContent || `# Cache ${options.cacheDirName}\n${cacheIgnorePattern}\n`;
    gitignoreContent += '\n' + contentToAdd;
    // Sauvegarder le fichier
    fs.writeFileSync(gitignorePath, gitignoreContent, 'utf8');
    console.log(`✅ Fichier .gitignore mis à jour: ${gitignorePath}`);
    return true;
}
/**
 * Génère le contenu du README par défaut pour le cache AST
 */
export function generateDefaultASTCacheReadme() {
    return `# Cache AST - Documentation

## Introduction

Le cache AST permet d'optimiser les analyses de code en stockant les résultats d'analyse AST (Abstract Syntax Tree) entre les exécutions. Il réduit considérablement le temps d'analyse pour les fichiers inchangés.

## Fonctionnalités

### Stockage persistant
- **Cache sur disque** : Structure hiérarchique basée sur les hashs
- **Index rapide** : Recherche O(1) par chemin de fichier
- **Compression** : Suppression des données AST pour les entrées anciennes
- **Validation** : Vérification d'intégrité via hash, taille et date

### Gestion intelligente
- **Invalidation automatique** : Lorsque les fichiers changent
- **Propagation des dépendances** : Invalidation des fichiers dépendants
- **Nettoyage automatique** : Entrées obsolètes et fichiers supprimés
- **Limites configurables** : Nombre maximum d'entrées et durée de vie

### Performance
- **Réduction du temps d'analyse** : Jusqu'à 90% pour les fichiers inchangés
- **Faible surcharge** : Validation légère, stockage efficace
- **Statistiques détaillées** : Taux de succès, distribution, recommandations

## Utilisation

### Activation
\`\`\`typescript
import { createASTCache } from './ast-cache';

const astCache = createASTCache({
  enabled: true,
  cacheDir: 'audit/ast-cache',
  maxEntries: 1000,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours
  compression: true,
  validation: {
    checkHash: true,
    checkSize: true,
    checkMtime: true
  }
});
\`\`\`

### Utilisation du cache
\`\`\`typescript
// Vérifier si le cache contient une entrée valide
const cachedEntry = astCache.get(filePath);
if (cachedEntry) {
  // Utiliser les données AST du cache
  console.log('✅ Données récupérées du cache');
  return cachedEntry.astData;
}

// Analyser le fichier (opération coûteuse)
const astData = analyzeFile(filePath);
const dependencies = extractDependencies(astData);

// Sauvegarder dans le cache
astCache.save(filePath, astData, dependencies);
console.log('💾 Données sauvegardées dans le cache');
\`\`\`

### Gestion des dépendances
\`\`\`typescript
// Invalider un fichier et ses dépendants
astCache.invalidate(filePath);

// Obtenir la liste des fichiers dépendants invalidés
const invalidated = astCache.invalidateDependents(filePath);
console.log(\`Invalidés: \${invalidated.length} fichiers\`);
\`\`\`

### Maintenance
\`\`\`typescript
// Nettoyer les entrées anciennes
astCache.cleanupOldEntries();

// Compresser le cache (supprimer les données AST)
astCache.compress();

// Vider complètement le cache
astCache.clear();

// Générer un rapport
const report = astCache.generateReport();
console.log(report);
\`\`\`

## Options de configuration

### ASTCacheOptions
\`\`\`typescript
interface ASTCacheOptions {
  enabled: boolean;           // Activer/désactiver le cache
  cacheDir: string;          // Répertoire de stockage
  maxEntries: number;        // Nombre maximum d'entrées
  maxAge: number;            // Durée de vie maximale (ms)
  compression: boolean;      // Activer la compression
  validation: {              // Validation d'intégrité
    checkHash: boolean;      // Vérifier le hash du contenu
    checkSize: boolean;      // Vérifier la taille du fichier
    checkMtime: boolean;     // Vérifier la date de modification
  };
}
\`\`\`

### Valeurs par défaut
\`\`\`typescript
{
  enabled: true,
  cacheDir: 'audit/ast-cache',
  maxEntries: 1000,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours
  compression: true,
  validation: {
    checkHash: true,
    checkSize: true,
    checkMtime: true
  }
}
\`\`\`

## Intégration avec le code-mapper

### Workflow typique
1. **Initialisation** : Créer l'instance ASTCache
2. **Analyse de fichier** : Vérifier d'abord le cache
3. **Cache hit** : Utiliser les données du cache
4. **Cache miss** : Analyser le fichier et sauvegarder
5. **Gestion des dépendances** : Mettre à jour les relations
6. **Maintenance** : Nettoyage et compression périodiques

### Exemple d'intégration complète
\`\`\`typescript
async function analyzeFileWithCache(filePath: string, astCache: ASTCache) {
  // 1. Vérifier le cache
  const cachedEntry = astCache.get(filePath);
  if (cachedEntry) {
    return {
      source: 'cache',
      data: cachedEntry.astData,
      dependencies: cachedEntry.dependencies
    };
  }

  // 2. Analyser le fichier (opération coûteuse)
  const astData = await analyzeFileExpensive(filePath);
  const dependencies = extractDependencies(astData);

  // 3. Sauvegarder dans le cache
  astCache.save(filePath, astData, dependencies);

  return {
    source: 'analysis',
    data: astData,
    dependencies
  };
}

async function analyzeProjectWithCache() {
  const astCache = createASTCache();
  const files = await scanFiles('src/', ['**/*.ts']);

  const results = [];
  for (const file of files) {
    const result = await analyzeFileWithCache(file, astCache);
    results.push({
      file,
      source: result.source,
      dependencies: result.dependencies.length
    });
  }

  // Générer un rapport de performance
  const stats = astCache.getStats();
  console.log(\`Taux de succès: \${stats.hitRate}\`);
  console.log(\`Économie: \${stats.hits} analyses évitées\`);

  return results;
}
\`\`\`

## Commandes CLI

### Intégration
\`\`\`bash
# Créer la structure
npx tsx scripts/integrate-ast-cache.ts structure

# Patcher code-mapper
npx tsx scripts/integrate-ast-cache.ts patch

# Tester le système
npx tsx scripts/integrate-ast-cache.ts test

# Tout exécuter
npx tsx scripts/integrate-ast-cache.ts all
\`\`\`

### Gestion du cache
\`\`\`bash
# Voir les statistiques
npx tsx -e "import('./scripts/ast-cache').then(m => console.log(new m.ASTCache().getStats()))"

# Générer un rapport
npx tsx -e "import('./scripts/ast-cache').then(m => console.log(new m.ASTCache().generateReport()))"

# Vider le cache
npx tsx -e "import('./scripts/ast-cache').then(m => new m.ASTCache().clear())"

# Compresser le cache
npx tsx -e "import('./scripts/ast-cache').then(m => new m.ASTCache().compress())"
\`\`\`

## Dépannage

### Problèmes courants

#### 1. Cache corrompu
\`\`\`bash
# Supprimer et réinitialiser
rm -rf audit/ast-cache
npx tsx scripts/code-mapper.ts --full
\`\`\`

#### 2. Taux de succès faible
\`\`\`typescript
// Ajuster la validation
const astCache = createASTCache({
  validation: {
    checkHash: true,
    checkSize: false,  // Désactiver la vérification de taille
    checkMtime: false  // Désactiver la vérification de date
  }
});
\`\`\`

#### 3. Utilisation mémoire élevée
\`\`\`typescript
// Réduire la taille du cache
const astCache = createASTCache({
  maxEntries: 500,     // Réduire le nombre d'entrées
  compression: true    // Activer la compression
});
\`\`\`

### Diagnostic
\`\`\`bash
# Analyser l'intégrité du cache
npx tsx -e "
  import { createASTCache } from './scripts/ast-cache';
  const cache = createASTCache();
  const stats = cache.getStats();
  console.log('Entrées:', stats.entries);
  console.log('Taux de succès:', stats.hitRate);
  console.log('Invalidations:', stats.invalidations);
"

# Vérifier une entrée spécifique
npx tsx -e "
  import { computeFileHash } from './scripts/ast-cache';
  console.log(computeFileHash('src/index.ts'));
"
\`\`\`

## Performance

### Métriques typiques
- **Petit projet (50 fichiers)** : 80-90% de réduction du temps d'analyse
- **Moyen projet (500 fichiers)** : 70-85% de réduction
- **Grand projet (5000+ fichiers)** : 60-80% de réduction

### Facteurs influençant la performance
1. **Stabilité du code** : Moins de changements = plus d'économies
2. **Complexité de l'analyse** : Analyses coûteuses = plus d'économies
3. **Taille des fichiers** : Fichiers plus grands = plus d'économies
4. **Fréquence des analyses** : Analyses fréquentes = plus d'économies

## Bonnes pratiques

### 1. Configuration de validation
- **Environnements stables** : Utiliser toutes les validations
- **Environnements dynamiques** : Désactiver certaines validations
- **Performance critique** : Désactiver checkMtime pour plus de vitesse

### 2. Gestion de la taille
- **Ajuster maxEntries** selon la taille du projet
- **Activer la compression** pour les projets volumineux
- **Nettoyer périodiquement** les entrées anciennes

### 3. Intégration
- **Vérifier d'abord le cache** avant toute analyse
- **Sauvegarder après analyse** même en cas d'erreur partielle
- **Gérer les dépendances** pour l'invalidation correcte

### 4. Monitoring
- **Suivre le taux de succès** : Cible > 70%
- **Surveiller la taille du cache** : Éviter la croissance excessive
- **Journaliser les invalidations** : Détecter les patterns de changement

## Limitations

### Fichiers très dynamiques
Pour les fichiers qui changent très fréquemment :
- Désactiver le cache pour ces fichiers spécifiques
- Utiliser une durée de vie plus courte
- Désactiver certaines validations

### Synchronisation distribuée
Pour les environnements multi-machines :
- Synchroniser le répertoire de cache
- Utiliser un cache distribué (Redis, etc.)
- Implémenter une invalidation distribuée

### Fichiers binaires
Le cache AST fonctionne mieux avec les fichiers texte :
- Exclure les fichiers binaires du cache
- Utiliser des métadonnées uniquement
- Implémenter un cache séparé pour les binaires

## Évolution future

### Améliorations planifiées
1. **Cache distribué** : Support Redis, Memcached
2. **Compression avancée** : Gzip, Brotli pour les données AST
3. **Pré-chargement** : Chargement anticipé des entrées fréquentes
4. **API REST** : Gestion du cache via HTTP
5. **Visualisation** : Interface graphique des statistiques

### Roadmap
- **v1.0** : Fonctionnalités de base
- **v1.1** : Optimisation performance
- **v1.2** : Support multi-langages
- **v2.0** : Cache distribué
`;
}
/**
 * Crée un fichier README pour un cache
 */
export function createCacheReadme(options) {
    const readmePath = path.join(options.rootDir, 'README_AST_CACHE.md');
    // Vérifier si le fichier existe déjà
    if (fs.existsSync(readmePath)) {
        console.log(`✅ Fichier README déjà existant: ${readmePath}`);
        return false;
    }
    // Générer le contenu
    const readmeContent = options.readmeContent || generateDefaultASTCacheReadme();
    // Sauvegarder le fichier
    fs.writeFileSync(readmePath, readmeContent, 'utf8');
    console.log(`✅ Fichier README créé: ${readmePath}`);
    return true;
}
/**
 * Crée la structure complète pour un cache AST
 */
export function createASTCacheStructure(options = DEFAULT_AST_CACHE_OPTIONS) {
    console.log('🔧 Création de la structure de cache AST...');
    // 1. Créer les répertoires
    const directories = createCacheDirectories(options);
    // 2. Configurer le .gitignore
    const gitignoreUpdated = options.createGitignore
        ? setupGitignoreForCache(options)
        : false;
    // 3. Créer le README
    const readmeCreated = options.createReadme
        ? createCacheReadme(options)
        : false;
    console.log('✅ Structure de cache AST créée avec succès');
    console.log(`  - Répertoires créés: ${directories.length}`);
    console.log(`  - .gitignore mis à jour: ${gitignoreUpdated}`);
    console.log(`  - README créé: ${readmeCreated}`);
    return {
        directories,
        gitignoreUpdated,
        readmeCreated
    };
}
//# sourceMappingURL=cache-directory-utils.js.map