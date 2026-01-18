// Audit incrémental de fichiers
// Analyse uniquement les fichiers qui ont changé depuis la dernière analyse
import { createAstCacheManager } from "./ast-cache-manager.js";
import { getFileHash } from "./utils/file-hasher.js";
// Note: Le code-mapper n'est pas encore exporté comme module ES6
// On utilisera une approche différente pour l'analyse de fichiers
import { stat } from "node:fs/promises";
/**
 * Configuration par défaut pour l'audit incrémental
 */
const DEFAULT_CONFIG = {
    rootDir: process.cwd(),
    useAstCache: true,
    similarityThreshold: 0.8,
    trackedSymbolTypes: [
        "function",
        "class",
        "interface",
        "type",
        "enum",
        "method",
    ],
    ignoreMinorChanges: false,
    generateRecommendations: true,
    exportJson: false,
    jsonExportPath: "audit/incremental-results.json",
};
/**
 * Classe principale pour l'audit incrémental
 */
export class IncrementalAuditor {
    config;
    cacheManager;
    auditId;
    constructor(config) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.cacheManager = createAstCacheManager({
            enabled: this.config.useAstCache,
            cacheDir: "audit/ast-cache",
        });
        this.auditId = this.generateAuditId();
    }
    /**
     * Génère un ID unique pour l'audit
     */
    generateAuditId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 10);
        return `audit_${timestamp}_${random}`;
    }
    /**
     * Fonction principale d'audit incrémental
     * @param files Liste des fichiers à auditer
     * @returns Résultat de l'audit incrémental
     */
    async auditFilesIncremental(files) {
        const startTime = new Date();
        console.log(`🔍 Début de l'audit incrémental (ID: ${this.auditId})`);
        console.log(`📁 Fichiers à analyser: ${files.length}`);
        // Filtrer les fichiers existants
        const existingFiles = await this.filterExistingFiles(files);
        console.log(`📁 Fichiers existants: ${existingFiles.length}`);
        // Analyser les changements de fichiers
        const fileChanges = await this.analyzeFileChanges(existingFiles);
        console.log(`📊 Changements détectés: ${fileChanges.filter((c) => c.changeType !== "unchanged").length}`);
        // Analyser les fichiers modifiés/ajoutés
        const filesToAnalyze = fileChanges
            .filter((change) => change.changeType === "added" || change.changeType === "modified")
            .map((change) => change.filePath);
        console.log(`🔧 Fichiers à analyser en détail: ${filesToAnalyze.length}`);
        // Analyser les fichiers (si nécessaire)
        if (filesToAnalyze.length > 0) {
            await this.analyzeFilesInDetail(filesToAnalyze, fileChanges);
        }
        // Générer les statistiques
        const statistics = this.generateStatistics(fileChanges);
        // Générer les recommandations
        const recommendations = this.config.generateRecommendations
            ? this.generateRecommendations(fileChanges, statistics)
            : [];
        const endTime = new Date();
        const durationMs = endTime.getTime() - startTime.getTime();
        const result = {
            auditId: this.auditId,
            startTime,
            endTime,
            durationMs,
            filesAnalyzed: existingFiles,
            totalFiles: existingFiles.length,
            fileChanges,
            statistics,
            recommendations,
            metadata: {
                config: this.config,
                cacheStats: this.cacheManager.getStats(),
            },
        };
        // Exporter les résultats si demandé
        if (this.config.exportJson && this.config.jsonExportPath) {
            await this.exportResults(result);
        }
        console.log(`✅ Audit incrémental terminé en ${durationMs}ms`);
        console.log(`📈 Score de qualité: ${statistics.currentQualityScore?.toFixed(2) || "N/A"}`);
        return result;
    }
    /**
     * Filtre les fichiers existants
     */
    async filterExistingFiles(files) {
        const existingFiles = [];
        const promises = files.map(async (filePath) => {
            try {
                await stat(filePath);
                existingFiles.push(filePath);
            }
            catch {
                // Fichier non trouvé, ignoré
            }
        });
        await Promise.all(promises);
        return existingFiles;
    }
    /**
     * Analyse les changements de fichiers
     */
    async analyzeFileChanges(files) {
        const fileChanges = [];
        const promises = files.map(async (filePath) => {
            const change = await this.analyzeFileChange(filePath);
            fileChanges.push(change);
        });
        await Promise.all(promises);
        return fileChanges;
    }
    /**
     * Analyse le changement d'un fichier spécifique
     */
    async analyzeFileChange(filePath) {
        try {
            // Obtenir les métadonnées actuelles
            const currentHash = await getFileHash(filePath);
            const fileStats = await stat(filePath);
            if (currentHash === null) {
                // Fichier inaccessible
                return {
                    filePath,
                    changeType: "unchanged",
                    symbolDiffs: [],
                    oldQuality: undefined,
                    newQuality: undefined,
                };
            }
            // Comparer avec le cache
            const cacheComparison = await this.cacheManager.compare(filePath);
            // Déterminer le type de changement
            let changeType = "unchanged";
            let oldHash;
            let oldSize;
            let oldModified;
            let oldQuality;
            if (cacheComparison.status === "miss") {
                // Fichier non présent dans le cache
                changeType = "added";
            }
            else if (cacheComparison.isModified) {
                // Fichier modifié
                changeType = "modified";
                if (cacheComparison.cachedEntry) {
                    oldHash = cacheComparison.cachedHash;
                    oldSize = cacheComparison.cachedEntry.fileSize;
                    oldModified = cacheComparison.cachedEntry.lastModified;
                    oldQuality = cacheComparison.cachedEntry.qualityMetrics;
                }
            }
            else if (cacheComparison.status === "expired") {
                // Cache expiré mais fichier inchangé
                changeType = "unchanged";
            }
            // Pour l'instant, on initialise les symbolDiffs vides
            // Ils seront remplis lors de l'analyse détaillée
            const symbolDiffs = [];
            return {
                filePath,
                changeType,
                oldHash,
                newHash: currentHash,
                oldSize,
                newSize: fileStats.size,
                oldModified,
                newModified: fileStats.mtime,
                symbolDiffs,
                oldQuality,
                newQuality: undefined, // Sera rempli lors de l'analyse détaillée
            };
        }
        catch (error) {
            console.error(`[IncrementalAuditor] Erreur lors de l'analyse du changement pour ${filePath}:`, error);
            return {
                filePath,
                changeType: "unchanged",
                symbolDiffs: [],
                oldQuality: undefined,
                newQuality: undefined,
            };
        }
    }
    /**
     * Analyse les fichiers en détail (extraction des symboles, métriques de qualité)
     */
    async analyzeFilesInDetail(files, fileChanges) {
        const fileChangeMap = new Map();
        fileChanges.forEach((change) => fileChangeMap.set(change.filePath, change));
        const promises = files.map(async (filePath) => {
            try {
                // Analyser le fichier avec le code-mapper
                const analysisResult = await this.analyzeFileWithCodeMapper(filePath);
                // Mettre à jour le FileChange correspondant
                const fileChange = fileChangeMap.get(filePath);
                if (fileChange && analysisResult) {
                    fileChange.newQuality = analysisResult.qualityMetrics;
                    fileChange.symbolDiffs = await this.compareSymbols(filePath, analysisResult.symbols);
                    // Mettre à jour le cache
                    if (this.config.useAstCache) {
                        await this.cacheManager.set(filePath, analysisResult.astJson, analysisResult.symbols, analysisResult.qualityMetrics, analysisResult.dependencies || []);
                    }
                }
            }
            catch (error) {
                console.error(`[IncrementalAuditor] Erreur lors de l'analyse détaillée de ${filePath}:`, error);
            }
        });
        await Promise.all(promises);
    }
    /**
     * Analyse un fichier avec le code-mapper
     */
    async analyzeFileWithCodeMapper(filePath) {
        try {
            // Utiliser le code-mapper existant pour analyser le fichier
            // Note: Cette partie dépend de l'implémentation exacte du code-mapper
            // Pour l'instant, on retourne un objet mock
            // Dans une implémentation réelle, on appellerait:
            // const result = await codeMapper.analyzeFile(filePath);
            return {
                astJson: "{}",
                symbols: [],
                qualityMetrics: {
                    qualityScore: 0.5,
                    complexity: 1,
                    maintainability: 80,
                    linesOfCode: 100,
                    symbolCount: 10,
                    dependencyCount: 2,
                    documentationCoverage: 50,
                    ruleViolations: 0,
                    technicalDebt: 0,
                },
                dependencies: [],
            };
        }
        catch (error) {
            console.error(`[IncrementalAuditor] Erreur avec code-mapper pour ${filePath}:`, error);
            return null;
        }
    }
    /**
     * Compare les symboles actuels avec ceux du cache
     */
    async compareSymbols(filePath, currentSymbols) {
        if (!this.config.useAstCache) {
            return [];
        }
        try {
            const cachedEntry = await this.cacheManager.get(filePath);
            if (!cachedEntry ||
                !cachedEntry.symbols ||
                cachedEntry.symbols.length === 0) {
                // Pas de symboles en cache, tous les symboles sont nouveaux
                return currentSymbols.map((symbol) => ({
                    changeType: "added",
                    newSymbol: symbol,
                    severity: "minor",
                    description: `Symbole ajouté: ${symbol.name} (${symbol.type})`,
                    qualityImpact: 0.1,
                }));
            }
            const cachedSymbols = cachedEntry.symbols;
            const diffs = [];
            // Créer des maps pour la comparaison
            const currentSymbolMap = new Map();
            const cachedSymbolMap = new Map();
            currentSymbols.forEach((s) => currentSymbolMap.set(this.getSymbolKey(s), s));
            cachedSymbols.forEach((s) => cachedSymbolMap.set(this.getSymbolKey(s), s));
            // Identifier les symboles ajoutés
            for (const [key, symbol] of currentSymbolMap) {
                if (!cachedSymbolMap.has(key)) {
                    diffs.push({
                        changeType: "added",
                        newSymbol: symbol,
                        severity: this.getSymbolChangeSeverity("added", symbol),
                        description: `Symbole ajouté: ${symbol.name} (${symbol.type})`,
                        qualityImpact: 0.1,
                    });
                }
            }
            // Identifier les symboles supprimés
            for (const [key, symbol] of cachedSymbolMap) {
                if (!currentSymbolMap.has(key)) {
                    diffs.push({
                        changeType: "deleted",
                        oldSymbol: symbol,
                        severity: this.getSymbolChangeSeverity("deleted", symbol),
                        description: `Symbole supprimé: ${symbol.name} (${symbol.type})`,
                        qualityImpact: -0.1,
                    });
                }
            }
            // Identifier les symboles modifiés (pour une implémentation simple, on considère que les symboles avec la même clé mais des propriétés différentes)
            for (const [key, currentSymbol] of currentSymbolMap) {
                const cachedSymbol = cachedSymbolMap.get(key);
                if (cachedSymbol &&
                    this.areSymbolsDifferent(currentSymbol, cachedSymbol)) {
                    diffs.push({
                        changeType: "modified",
                        oldSymbol: cachedSymbol,
                        newSymbol: currentSymbol,
                        severity: this.getSymbolChangeSeverity("modified", currentSymbol, cachedSymbol),
                        description: `Symbole modifié: ${currentSymbol.name} (${currentSymbol.type})`,
                        qualityImpact: 0,
                    });
                }
            }
            return diffs;
        }
        catch (error) {
            console.error(`[IncrementalAuditor] Erreur lors de la comparaison des symboles pour ${filePath}:`, error);
            return [];
        }
    }
    /**
     * Génère une clé unique pour un symbole
     */
    getSymbolKey(symbol) {
        return `${symbol.type}:${symbol.name}:${symbol.startLine}:${symbol.endLine}`;
    }
    /**
     * Détermine si deux symboles sont différents
     */
    areSymbolsDifferent(symbol1, symbol2) {
        // Comparaison simple basée sur les propriétés principales
        return (symbol1.name !== symbol2.name ||
            symbol1.type !== symbol2.type ||
            symbol1.startLine !== symbol2.startLine ||
            symbol1.endLine !== symbol2.endLine ||
            symbol1.returnType !== symbol2.returnType);
    }
    /**
     * Détermine la sévérité d'un changement de symbole
     */
    getSymbolChangeSeverity(changeType, newSymbol, oldSymbol) {
        if (changeType === "added") {
            return newSymbol?.type === "function" || newSymbol?.type === "class"
                ? "major"
                : "minor";
        }
        else if (changeType === "deleted") {
            return oldSymbol?.type === "function" || oldSymbol?.type === "class"
                ? "breaking"
                : "major";
        }
        else {
            // modified
            if (newSymbol?.type === "function" || newSymbol?.type === "class") {
                return "major";
            }
            return "minor";
        }
    }
    /**
     * Génère les statistiques globales
     */
    generateStatistics(fileChanges) {
        const addedFiles = fileChanges.filter((c) => c.changeType === "added").length;
        const modifiedFiles = fileChanges.filter((c) => c.changeType === "modified").length;
        const deletedFiles = fileChanges.filter((c) => c.changeType === "deleted").length;
        const unchangedFiles = fileChanges.filter((c) => c.changeType === "unchanged").length;
        let addedSymbols = 0;
        let modifiedSymbols = 0;
        let deletedSymbols = 0;
        let totalQualityImpact = 0;
        let qualityImpactCount = 0;
        fileChanges.forEach((change) => {
            change.symbolDiffs.forEach((diff) => {
                if (diff.changeType === "added")
                    addedSymbols++;
                if (diff.changeType === "modified")
                    modifiedSymbols++;
                if (diff.changeType === "deleted")
                    deletedSymbols++;
                totalQualityImpact += diff.qualityImpact;
                qualityImpactCount++;
            });
        });
        const averageQualityImpact = qualityImpactCount > 0 ? totalQualityImpact / qualityImpactCount : 0;
        // Calculer les scores de qualité (simplifié)
        let previousQualityScore = 0;
        let currentQualityScore = 0;
        let qualityScoreCount = 0;
        fileChanges.forEach((change) => {
            if (change.oldQuality) {
                previousQualityScore += change.oldQuality.qualityScore;
                qualityScoreCount++;
            }
            if (change.newQuality) {
                currentQualityScore += change.newQuality.qualityScore;
            }
        });
        const previousAvg = qualityScoreCount > 0 ? previousQualityScore / qualityScoreCount : 0;
        const currentAvg = qualityScoreCount > 0 ? currentQualityScore / qualityScoreCount : 0;
        return {
            addedFiles,
            modifiedFiles,
            deletedFiles,
            unchangedFiles,
            addedSymbols,
            modifiedSymbols,
            deletedSymbols,
            totalQualityImpact: averageQualityImpact,
            previousQualityScore: qualityScoreCount > 0 ? previousAvg : undefined,
            currentQualityScore: qualityScoreCount > 0 ? currentAvg : undefined,
            qualityScoreDelta: qualityScoreCount > 0 ? currentAvg - previousAvg : undefined,
        };
    }
    /**
     * Génère des recommandations basées sur les changements
     */
    generateRecommendations(fileChanges, statistics) {
        const recommendations = [];
        // Recommandation basée sur les fichiers modifiés
        if (statistics.modifiedFiles > 5) {
            recommendations.push({
                priority: "medium",
                category: "maintainability",
                description: `Trop de fichiers modifiés (${statistics.modifiedFiles}). Considérez de diviser les changements en plusieurs commits.`,
                affectedFiles: fileChanges
                    .filter((c) => c.changeType === "modified")
                    .map((c) => c.filePath)
                    .slice(0, 10), // Limiter à 10 fichiers pour la lisibilité
                suggestedActions: [
                    "Diviser les changements en commits logiques",
                    "Ajouter des tests pour les modifications",
                    "Documenter les changements majeurs",
                ],
            });
        }
        // Recommandation basée sur les symboles supprimés
        if (statistics.deletedSymbols > 0) {
            recommendations.push({
                priority: "high",
                category: "refactoring",
                description: `${statistics.deletedSymbols} symboles supprimés. Vérifiez les impacts sur les dépendances.`,
                affectedFiles: fileChanges
                    .filter((c) => c.symbolDiffs.some((d) => d.changeType === "deleted"))
                    .map((c) => c.filePath),
                suggestedActions: [
                    "Vérifier les appels aux symboles supprimés",
                    "Mettre à jour la documentation",
                    "Exécuter les tests d'intégration",
                ],
            });
        }
        // Recommandation basée sur la qualité
        if (statistics.qualityScoreDelta !== undefined &&
            statistics.qualityScoreDelta < -0.1) {
            recommendations.push({
                priority: "critical",
                category: "best-practice",
                description: `Dégradation de la qualité détectée (Δ=${statistics.qualityScoreDelta.toFixed(2)}).`,
                affectedFiles: fileChanges
                    .filter((c) => c.newQuality &&
                    c.oldQuality &&
                    c.newQuality.qualityScore < c.oldQuality.qualityScore - 0.1)
                    .map((c) => c.filePath),
                suggestedActions: [
                    "Revoir les changements récents",
                    "Ajouter des tests unitaires",
                    "Améliorer la couverture de documentation",
                ],
            });
        }
        // Recommandation basée sur les fichiers ajoutés
        if (statistics.addedFiles > 3) {
            recommendations.push({
                priority: "low",
                category: "best-practice",
                description: `${statistics.addedFiles} nouveaux fichiers ajoutés. Assurez-vous qu'ils suivent les conventions du projet.`,
                affectedFiles: fileChanges
                    .filter((c) => c.changeType === "added")
                    .map((c) => c.filePath),
                suggestedActions: [
                    "Vérifier les conventions de nommage",
                    "Ajouter des en-têtes de fichier",
                    "Documenter le but de chaque nouveau fichier",
                ],
            });
        }
        return recommendations;
    }
    /**
     * Exporte les résultats au format JSON
     */
    async exportResults(result) {
        try {
            const fs = await import("node:fs/promises");
            const path = await import("node:path");
            // Créer le répertoire si nécessaire
            const exportDir = path.dirname(this.config.jsonExportPath);
            await fs.mkdir(exportDir, { recursive: true });
            // Convertir les dates en chaînes pour la sérialisation JSON
            const serializableResult = {
                ...result,
                startTime: result.startTime.toISOString(),
                endTime: result.endTime.toISOString(),
                fileChanges: result.fileChanges.map((change) => ({
                    ...change,
                    oldModified: change.oldModified?.toISOString(),
                    newModified: change.newModified?.toISOString(),
                    symbolDiffs: change.symbolDiffs.map((diff) => ({
                        ...diff,
                        oldSymbol: diff.oldSymbol
                            ? {
                                ...diff.oldSymbol,
                                // Nettoyer les propriétés circulaires si nécessaire
                            }
                            : undefined,
                        newSymbol: diff.newSymbol
                            ? {
                                ...diff.newSymbol,
                                // Nettoyer les propriétés circulaires si nécessaire
                            }
                            : undefined,
                    })),
                })),
            };
            await fs.writeFile(this.config.jsonExportPath, JSON.stringify(serializableResult, null, 2), "utf8");
            console.log(`📄 Résultats exportés vers: ${this.config.jsonExportPath}`);
        }
        catch (error) {
            console.error(`[IncrementalAuditor] Erreur lors de l'export des résultats:`, error);
        }
    }
    /**
     * Obtient les statistiques du cache
     */
    getCacheStats() {
        return this.cacheManager.getStats();
    }
    /**
     * Vide le cache
     */
    clearCache() {
        this.cacheManager.clear();
    }
    /**
     * Nettoie le cache (supprime les entrées anciennes)
     */
    cleanupCache() {
        this.cacheManager.cleanup();
    }
}
/**
 * Fonction principale exportée pour l'audit incrémental
 */
export async function auditFilesIncremental(files, config) {
    const auditor = new IncrementalAuditor(config);
    return auditor.auditFilesIncremental(files);
}
/**
 * Fonction utilitaire pour auditer un seul fichier
 */
export async function auditFileIncremental(filePath, config) {
    return auditFilesIncremental([filePath], config);
}
/**
 * Fonction utilitaire pour auditer tous les fichiers d'un répertoire
 */
export async function auditDirectoryIncremental(directoryPath, config) {
    // Cette fonctionnalité serait à implémenter avec glob
    console.log(`[auditDirectoryIncremental] Non implémenté pour ${directoryPath}`);
    // Pour l'instant, retourner un résultat vide
    return {
        auditId: `dir_audit_${Date.now()}`,
        startTime: new Date(),
        endTime: new Date(),
        durationMs: 0,
        filesAnalyzed: [],
        totalFiles: 0,
        fileChanges: [],
        statistics: {
            addedFiles: 0,
            modifiedFiles: 0,
            deletedFiles: 0,
            unchangedFiles: 0,
            addedSymbols: 0,
            modifiedSymbols: 0,
            deletedSymbols: 0,
            totalQualityImpact: 0,
        },
        recommendations: [],
    };
}
