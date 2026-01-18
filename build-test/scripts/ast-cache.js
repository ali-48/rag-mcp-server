/**
 * Module de cache intermédiaire pour les résultats AST
 * Stocke les résultats d'analyse AST, les réutilise entre exécutions
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
const DEFAULT_OPTIONS = {
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
};
export class ASTCache {
    options;
    cache = new Map();
    index = new Map(); // hash -> filePath
    stats = {
        hits: 0,
        misses: 0,
        saves: 0,
        invalidations: 0,
        compressions: 0
    };
    constructor(options) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.loadCache();
    }
    /**
     * Charge le cache depuis le disque
     */
    loadCache() {
        if (!this.options.enabled) {
            return;
        }
        try {
            // Créer le répertoire de cache si nécessaire
            if (!fs.existsSync(this.options.cacheDir)) {
                fs.mkdirSync(this.options.cacheDir, { recursive: true });
                return;
            }
            // Charger l'index
            const indexPath = path.join(this.options.cacheDir, 'index.json');
            if (fs.existsSync(indexPath)) {
                const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
                this.index = new Map(Object.entries(indexData));
            }
            // Charger les entrées de cache
            const now = Date.now();
            let loadedCount = 0;
            for (const [hash, filePath] of this.index.entries()) {
                const cachePath = this.getCacheFilePath(hash);
                if (!fs.existsSync(cachePath)) {
                    this.index.delete(hash);
                    continue;
                }
                try {
                    const entryData = fs.readFileSync(cachePath, 'utf8');
                    const entry = JSON.parse(entryData);
                    // Vérifier l'âge de l'entrée
                    if (now - entry.timestamp > this.options.maxAge) {
                        fs.unlinkSync(cachePath);
                        this.index.delete(hash);
                        this.stats.invalidations++;
                        continue;
                    }
                    // Vérifier que le fichier existe toujours
                    if (!fs.existsSync(filePath)) {
                        fs.unlinkSync(cachePath);
                        this.index.delete(hash);
                        this.stats.invalidations++;
                        continue;
                    }
                    this.cache.set(filePath, entry);
                    loadedCount++;
                }
                catch (error) {
                    // Entrée corrompue, la supprimer
                    try {
                        fs.unlinkSync(cachePath);
                    }
                    catch { }
                    this.index.delete(hash);
                    this.stats.invalidations++;
                }
            }
            console.log(`📦 Cache AST chargé: ${loadedCount} entrées valides`);
            // Sauvegarder l'index mis à jour
            this.saveIndex();
        }
        catch (error) {
            console.error('❌ Erreur lors du chargement du cache AST:', error);
        }
    }
    /**
     * Sauvegarde l'index du cache
     */
    saveIndex() {
        if (!this.options.enabled) {
            return;
        }
        try {
            const indexPath = path.join(this.options.cacheDir, 'index.json');
            const indexObj = Object.fromEntries(this.index);
            fs.writeFileSync(indexPath, JSON.stringify(indexObj, null, 2), 'utf8');
        }
        catch (error) {
            console.error('❌ Erreur lors de la sauvegarde de l index du cache:', error);
        }
    }
    /**
     * Obtient le chemin du fichier de cache pour un hash
     */
    getCacheFilePath(hash) {
        // Utiliser les 2 premiers caractères du hash comme sous-répertoire
        const subDir = hash.substring(0, 2);
        const cacheDir = path.join(this.options.cacheDir, subDir);
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
        return path.join(cacheDir, `${hash}.json`);
    }
    /**
     * Calcule le hash d'un fichier
     */
    computeFileHash(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const hash = crypto.createHash('sha256');
            hash.update(content);
            return hash.digest('hex');
        }
        catch (error) {
            console.error(`❌ Erreur lors du calcul du hash pour ${filePath}:`, error);
            return '';
        }
    }
    /**
     * Obtient les métadonnées d'un fichier
     */
    getFileMetadata(filePath) {
        try {
            const stats = fs.statSync(filePath);
            const ext = path.extname(filePath).toLowerCase();
            // Déterminer le langage basé sur l'extension
            let language = 'unknown';
            let fileType = 'text';
            if (['.ts', '.js', '.jsx', '.tsx'].includes(ext)) {
                language = 'typescript';
                fileType = 'code';
            }
            else if (['.py'].includes(ext)) {
                language = 'python';
                fileType = 'code';
            }
            else if (['.java'].includes(ext)) {
                language = 'java';
                fileType = 'code';
            }
            else if (['.md', '.txt'].includes(ext)) {
                language = 'markdown';
                fileType = 'documentation';
            }
            else if (['.json', '.yml', '.yaml'].includes(ext)) {
                language = 'config';
                fileType = 'configuration';
            }
            return {
                size: stats.size,
                mtime: stats.mtimeMs,
                language,
                fileType
            };
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Vérifie si une entrée de cache est valide
     */
    isCacheEntryValid(filePath, entry) {
        const metadata = this.getFileMetadata(filePath);
        if (!metadata) {
            return false; // Fichier inaccessible
        }
        // Vérifier le hash si demandé
        if (this.options.validation.checkHash) {
            const currentHash = this.computeFileHash(filePath);
            if (currentHash !== entry.hash) {
                return false;
            }
        }
        // Vérifier la taille si demandé
        if (this.options.validation.checkSize && metadata.size !== entry.metadata.size) {
            return false;
        }
        // Vérifier la date de modification si demandé
        if (this.options.validation.checkMtime && metadata.mtime !== entry.metadata.mtime) {
            return false;
        }
        return true;
    }
    /**
     * Obtient une entrée du cache
     */
    get(filePath) {
        if (!this.options.enabled) {
            this.stats.misses++;
            return null;
        }
        const entry = this.cache.get(filePath);
        if (!entry) {
            this.stats.misses++;
            return null;
        }
        // Vérifier la validité de l'entrée
        if (!this.isCacheEntryValid(filePath, entry)) {
            this.invalidate(filePath);
            this.stats.misses++;
            return null;
        }
        this.stats.hits++;
        return entry;
    }
    /**
     * Sauvegarde une entrée dans le cache
     */
    save(filePath, astData, dependencies = []) {
        if (!this.options.enabled) {
            return;
        }
        try {
            const metadata = this.getFileMetadata(filePath);
            if (!metadata) {
                return;
            }
            const hash = this.computeFileHash(filePath);
            if (!hash) {
                return;
            }
            // Vérifier si nous avons atteint la limite d'entrées
            if (this.cache.size >= this.options.maxEntries) {
                this.cleanupOldEntries();
            }
            const entry = {
                filePath,
                hash,
                timestamp: Date.now(),
                astData,
                dependencies,
                metadata
            };
            // Sauvegarder sur le disque
            const cachePath = this.getCacheFilePath(hash);
            fs.writeFileSync(cachePath, JSON.stringify(entry, null, 2), 'utf8');
            // Mettre à jour les structures en mémoire
            this.cache.set(filePath, entry);
            this.index.set(hash, filePath);
            this.stats.saves++;
            // Sauvegarder l'index périodiquement
            if (this.stats.saves % 10 === 0) {
                this.saveIndex();
            }
        }
        catch (error) {
            console.error(`❌ Erreur lors de la sauvegarde dans le cache pour ${filePath}:`, error);
        }
    }
    /**
     * Invalide une entrée du cache
     */
    invalidate(filePath) {
        if (!this.options.enabled) {
            return;
        }
        const entry = this.cache.get(filePath);
        if (!entry) {
            return;
        }
        // Supprimer le fichier de cache
        const cachePath = this.getCacheFilePath(entry.hash);
        try {
            if (fs.existsSync(cachePath)) {
                fs.unlinkSync(cachePath);
            }
        }
        catch (error) {
            // Ignorer les erreurs de suppression
        }
        // Supprimer des structures en mémoire
        this.cache.delete(filePath);
        this.index.delete(entry.hash);
        this.stats.invalidations++;
        this.saveIndex();
    }
    /**
     * Invalide les entrées dépendantes d'un fichier
     */
    invalidateDependents(filePath) {
        if (!this.options.enabled) {
            return [];
        }
        const invalidated = [];
        // Trouver tous les fichiers qui dépendent de ce fichier
        for (const [cachedFilePath, entry] of this.cache.entries()) {
            if (entry.dependencies.includes(filePath)) {
                this.invalidate(cachedFilePath);
                invalidated.push(cachedFilePath);
            }
        }
        return invalidated;
    }
    /**
     * Nettoie les entrées anciennes
     */
    cleanupOldEntries() {
        if (!this.options.enabled) {
            return;
        }
        const now = Date.now();
        const entriesToRemove = [];
        // Identifier les entrées trop anciennes
        for (const [filePath, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.options.maxAge) {
                entriesToRemove.push(filePath);
            }
        }
        // Supprimer les entrées identifiées
        for (const filePath of entriesToRemove) {
            this.invalidate(filePath);
        }
        // Si nous avons encore trop d'entrées, supprimer les plus anciennes
        if (this.cache.size > this.options.maxEntries) {
            const sortedEntries = Array.from(this.cache.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp);
            const toRemove = sortedEntries.slice(0, this.cache.size - this.options.maxEntries);
            for (const [filePath] of toRemove) {
                this.invalidate(filePath);
            }
        }
    }
    /**
     * Compresse le cache (supprime les données AST tout en gardant les métadonnées)
     */
    compress() {
        if (!this.options.enabled || !this.options.compression) {
            return;
        }
        let compressedCount = 0;
        const now = Date.now();
        const compressionThreshold = 7 * 24 * 60 * 60 * 1000; // 7 jours
        for (const [filePath, entry] of this.cache.entries()) {
            // Ne compresser que les entrées anciennes
            if (now - entry.timestamp > compressionThreshold) {
                // Créer une version compressée (sans astData)
                const compressedEntry = {
                    ...entry,
                    astData: null, // Supprimer les données AST
                    metadata: {
                        ...entry.metadata
                    }
                };
                // Sauvegarder la version compressée
                const cachePath = this.getCacheFilePath(entry.hash);
                fs.writeFileSync(cachePath, JSON.stringify(compressedEntry, null, 2), 'utf8');
                // Mettre à jour l'entrée en mémoire
                this.cache.set(filePath, compressedEntry);
                compressedCount++;
            }
        }
        this.stats.compressions += compressedCount;
        console.log(`📦 Cache compressé: ${compressedCount} entrées`);
    }
    /**
     * Vide complètement le cache
     */
    clear() {
        if (!this.options.enabled) {
            return;
        }
        // Supprimer tous les fichiers de cache
        try {
            if (fs.existsSync(this.options.cacheDir)) {
                fs.rmSync(this.options.cacheDir, { recursive: true, force: true });
            }
        }
        catch (error) {
            console.error('❌ Erreur lors du vidage du cache:', error);
        }
        // Réinitialiser les structures en mémoire
        this.cache.clear();
        this.index.clear();
        // Réinitialiser les statistiques
        this.stats = {
            hits: 0,
            misses: 0,
            saves: 0,
            invalidations: 0,
            compressions: 0
        };
        console.log('✅ Cache AST vidé');
    }
    /**
     * Génère un rapport de statistiques
     */
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
            : '0.00';
        return {
            entries: this.cache.size,
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate: `${hitRate}%`,
            saves: this.stats.saves,
            invalidations: this.stats.invalidations,
            compressions: this.stats.compressions,
            memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
            options: this.options
        };
    }
    /**
     * Génère des recommandations basées sur les statistiques
     */
    generateRecommendations(stats, ageDistribution) {
        const recommendations = [];
        // Taux de succès
        const hitRate = parseFloat(stats.hitRate);
        if (hitRate < 50) {
            recommendations.push('⚠️ **Taux de succès faible** (< 50%): Vérifiez la configuration de validation ou augmentez la durée de vie du cache.');
        }
        else if (hitRate > 80) {
            recommendations.push('✅ **Taux de succès excellent** (> 80%): Le cache fonctionne efficacement.');
        }
        // Entrées anciennes
        const oldEntries = ageDistribution['plus de 30 jours'];
        if (oldEntries > stats.entries * 0.3) {
            recommendations.push('⚠️ **Trop d\'entrées anciennes** (> 30%): Considérez une compression ou un nettoyage plus fréquent.');
        }
        // Utilisation mémoire
        if (stats.memoryUsage > 100) {
            recommendations.push('⚠️ **Utilisation mémoire élevée** (> 100MB): Activez la compression ou réduisez maxEntries.');
        }
        // Invalidations fréquentes
        if (stats.invalidations > stats.saves * 0.5) {
            recommendations.push('⚠️ **Invalidations fréquentes**: Les fichiers changent souvent, réduisez maxAge ou désactivez certaines validations.');
        }
        // Cache presque plein
        if (stats.entries > this.options.maxEntries * 0.8) {
            recommendations.push('⚠️ **Cache presque plein** (> 80%): Augmentez maxEntries ou activez la compression automatique.');
        }
        if (recommendations.length === 0) {
            recommendations.push('✅ **Cache en bonne santé**: Aucune action nécessaire.');
        }
        return recommendations.join('\n');
    }
    /**
     * Génère un rapport détaillé
     */
    generateReport() {
        const stats = this.getStats();
        const now = Date.now();
        // Analyser la distribution des âges
        const ageDistribution = {
            'moins d\'un jour': 0,
            '1-7 jours': 0,
            '7-30 jours': 0,
            'plus de 30 jours': 0
        };
        for (const entry of this.cache.values()) {
            const age = now - entry.timestamp;
            const ageDays = age / (24 * 60 * 60 * 1000);
            if (ageDays < 1) {
                ageDistribution['moins d\'un jour']++;
            }
            else if (ageDays < 7) {
                ageDistribution['1-7 jours']++;
            }
            else if (ageDays < 30) {
                ageDistribution['7-30 jours']++;
            }
            else {
                ageDistribution['plus de 30 jours']++;
            }
        }
        // Analyser la distribution des langages
        const languageDistribution = {};
        for (const entry of this.cache.values()) {
            const lang = entry.metadata.language;
            languageDistribution[lang] = (languageDistribution[lang] || 0) + 1;
        }
        return `# Rapport du Cache AST
- **Version**: 1.0.0
- **Date**: ${new Date().toISOString()}

## Statistiques
- **Entrées dans le cache**: ${stats.entries}
- **Taux de succès**: ${stats.hitRate}
- **Accès réussis**: ${stats.hits}
- **Accès échoués**: ${stats.misses}
- **Sauvegardes**: ${stats.saves}
- **Invalidations**: ${stats.invalidations}
- **Compressions**: ${stats.compressions}
- **Utilisation mémoire**: ${stats.memoryUsage.toFixed(2)} MB

## Distribution par âge
${Object.entries(ageDistribution).map(([range, count]) => `- **${range}**: ${count} entrées`).join('\n')}

## Distribution par langage
${Object.entries(languageDistribution).map(([lang, count]) => `- **${lang}**: ${count} entrées`).join('\n')}

## Recommandations
${this.generateRecommendations(stats, ageDistribution)}
`;
    }
}
// Fonctions utilitaires exportées
export function createASTCache(options) {
    return new ASTCache(options);
}
export function computeFileHash(filePath, algorithm = 'sha256') {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const hash = crypto.createHash(algorithm);
        hash.update(content);
        return hash.digest('hex');
    }
    catch (error) {
        console.error(`❌ Erreur lors du calcul du hash pour ${filePath}:`, error);
        return '';
    }
}
export function shouldUseCache(filePath, cache, options = {}) {
    if (!cache['options'].enabled) {
        return false;
    }
    const entry = cache.get(filePath);
    if (!entry) {
        return false;
    }
    // Vérifier les dépendances si demandé
    if (options.checkDependencies !== false) {
        const dependents = cache.invalidateDependents(filePath);
        if (dependents.length > 0) {
            return false; // Dépendances invalides, ne pas utiliser le cache
        }
    }
    return true;
}
//# sourceMappingURL=ast-cache.js.map