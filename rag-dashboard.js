#!/usr/bin/env node

/**
 * Dashboard CLI pour visualiser la couverture RAG
 * Affiche les statistiques par projet, type de contenu, et fichiers manquants
 */

import { existsSync, readdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Fonction pour charger dynamiquement les modules RAG
async function loadRAGModules() {
    const { getProjectStats, listProjects } = await import('./build/rag/vector-store.js');
    return { getProjectStats, listProjects };
}

// Fonction pour scanner un répertoire et compter les fichiers par type
function scanProjectDirectory(projectPath) {
    const fileTypes = {
        code: 0,
        doc: 0,
        config: 0,
        other: 0,
        total: 0
    };

    const extensionsMap = {
        // Code
        '.ts': 'code', '.js': 'code', '.py': 'code', '.java': 'code', '.cpp': 'code', '.c': 'code',
        '.go': 'code', '.rs': 'code', '.php': 'code', '.rb': 'code', '.swift': 'code', '.kt': 'code',
        '.scala': 'code', '.hs': 'code', '.lua': 'code', '.sh': 'code', '.bash': 'code',
        // Documentation
        '.md': 'doc', '.txt': 'doc', '.rst': 'doc', '.tex': 'doc', '.adoc': 'doc',
        // Configuration
        '.json': 'config', '.yaml': 'config', '.yml': 'config', '.toml': 'config', '.ini': 'config',
        '.xml': 'config', '.properties': 'config', '.env': 'config',
        // Autres
        '.html': 'other', '.css': 'other', '.scss': 'other', '.less': 'other', '.sql': 'other',
        '.csv': 'other', '.tsv': 'other', '.log': 'other'
    };

    function scanDir(dirPath) {
        try {
            const items = readdirSync(dirPath, { withFileTypes: true });

            for (const item of items) {
                const fullPath = `${dirPath}/${item.name}`;

                // Ignorer les dossiers cachés et node_modules
                if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === 'build' || item.name === 'dist') {
                    continue;
                }

                if (item.isDirectory()) {
                    scanDir(fullPath);
                } else if (item.isFile()) {
                    fileTypes.total++;

                    const ext = item.name.substring(item.name.lastIndexOf('.')).toLowerCase();
                    const type = extensionsMap[ext] || 'other';
                    fileTypes[type]++;
                }
            }
        } catch (error) {
            console.error(`Erreur lors du scan de ${dirPath}:`, error.message);
        }
    }

    if (existsSync(projectPath)) {
        scanDir(projectPath);
    }

    return fileTypes;
}

// Fonction pour créer une barre de progression
function createProgressBar(value, max, width = 30) {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    const filledWidth = Math.round((percentage / 100) * width);
    const emptyWidth = width - filledWidth;

    const filledBar = '█'.repeat(filledWidth);
    const emptyBar = '░'.repeat(emptyWidth);

    return `${filledBar}${emptyBar} ${percentage.toFixed(1)}%`;
}

// Fonction pour formatter les nombres
function formatNumber(num) {
    return num.toLocaleString('fr-FR');
}

// Fonction pour afficher le dashboard principal
async function displayDashboard() {
    const { getProjectStats, listProjects } = await loadRAGModules();

    console.clear();
    console.log('='.repeat(80));
    console.log('📊 DASHBOARD COUVERTURE RAG');
    console.log('='.repeat(80));
    console.log(`Date: ${new Date().toLocaleString('fr-FR')}`);
    console.log();

    try {
        // Récupérer la liste des projets indexés
        const indexedProjects = await listProjects();

        console.log(`📁 Projets indexés: ${indexedProjects.length}`);
        console.log();

        let totalIndexedFiles = 0;
        let totalIndexedChunks = 0;
        let totalScannedFiles = 0;

        const projectStats = [];

        // Analyser chaque projet
        for (const projectPath of indexedProjects) {
            try {
                // Statistiques d'indexation
                const stats = await getProjectStats(projectPath);

                // Scanner le répertoire pour les fichiers réels
                const scannedFiles = scanProjectDirectory(projectPath);

                projectStats.push({
                    path: projectPath,
                    indexedStats: stats,
                    scannedFiles
                });

                totalIndexedFiles += stats.totalFiles;
                totalIndexedChunks += stats.totalChunks;
                totalScannedFiles += scannedFiles.total;

            } catch (error) {
                console.error(`❌ Erreur lors de l'analyse du projet ${projectPath}:`, error.message);
            }
        }

        // Afficher les statistiques globales
        console.log('📈 STATISTIQUES GLOBALES:');
        console.log(`  • Fichiers indexés: ${formatNumber(totalIndexedFiles)}`);
        console.log(`  • Chunks indexés: ${formatNumber(totalIndexedChunks)}`);
        console.log(`  • Fichiers scannés: ${formatNumber(totalScannedFiles)}`);

        const coveragePercentage = totalScannedFiles > 0
            ? (totalIndexedFiles / totalScannedFiles) * 100
            : 0;

        console.log(`  • Couverture: ${createProgressBar(totalIndexedFiles, totalScannedFiles)}`);
        console.log();

        // Afficher les statistiques par type de contenu
        console.log('🎨 RÉPARTITION PAR TYPE DE CONTENU:');

        const typeStats = {
            code: { indexed: 0, scanned: 0 },
            doc: { indexed: 0, scanned: 0 },
            config: { indexed: 0, scanned: 0 },
            other: { indexed: 0, scanned: 0 }
        };

        // Agréger les statistiques par type
        for (const project of projectStats) {
            // Types indexés
            Object.entries(project.indexedStats.contentTypes || {}).forEach(([type, count]) => {
                const normalizedType = type.toLowerCase();
                if (typeStats[normalizedType]) {
                    typeStats[normalizedType].indexed += count;
                } else {
                    typeStats.other.indexed += count;
                }
            });

            // Types scannés
            Object.entries(project.scannedFiles).forEach(([type, count]) => {
                if (type !== 'total' && typeStats[type]) {
                    typeStats[type].scanned += count;
                }
            });
        }

        // Afficher chaque type
        Object.entries(typeStats).forEach(([type, stats]) => {
            if (stats.scanned > 0 || stats.indexed > 0) {
                const coverage = stats.scanned > 0 ? (stats.indexed / stats.scanned) * 100 : 0;
                console.log(`  • ${type.toUpperCase()}:`);
                console.log(`      Indexés: ${formatNumber(stats.indexed)} / Scannés: ${formatNumber(stats.scanned)}`);
                console.log(`      Couverture: ${createProgressBar(stats.indexed, stats.scanned)}`);
            }
        });

        console.log();

        // Afficher les détails par projet
        console.log('📋 DÉTAILS PAR PROJET:');
        console.log();

        for (const project of projectStats) {
            const shortPath = project.path.split('/').slice(-2).join('/');
            console.log(`🔹 ${shortPath}`);

            const indexed = project.indexedStats.totalFiles;
            const scanned = project.scannedFiles.total;
            const missing = Math.max(0, scanned - indexed);

            console.log(`   Fichiers: ${formatNumber(indexed)}/${formatNumber(scanned)} indexés`);
            console.log(`   Chunks: ${formatNumber(project.indexedStats.totalChunks)}`);
            console.log(`   Manquants: ${formatNumber(missing)} fichiers`);

            // Afficher les types indexés
            if (project.indexedStats.contentTypes && Object.keys(project.indexedStats.contentTypes).length > 0) {
                const typesStr = Object.entries(project.indexedStats.contentTypes)
                    .map(([type, count]) => `${type}:${count}`)
                    .join(', ');
                console.log(`   Types: ${typesStr}`);
            }

            // Afficher la fraîcheur
            if (project.indexedStats.lastUpdated) {
                const daysAgo = Math.floor((Date.now() - project.indexedStats.lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
                const freshness = daysAgo === 0 ? 'Aujourd\'hui' :
                    daysAgo === 1 ? 'Hier' :
                        `Il y a ${daysAgo} jours`;
                console.log(`   Dernière mise à jour: ${freshness}`);
            }

            console.log();
        }

        // Afficher les fichiers manquants (top 10)
        console.log('⚠️  FICHIERS MANQUANTS (TOP 10):');
        console.log();

        const missingFiles = [];

        for (const project of projectStats) {
            const missingCount = Math.max(0, project.scannedFiles.total - project.indexedStats.totalFiles);
            if (missingCount > 0) {
                missingFiles.push({
                    project: project.path,
                    missingCount,
                    coverage: project.indexedStats.totalFiles / project.scannedFiles.total
                });
            }
        }

        // Trier par nombre de fichiers manquants
        missingFiles.sort((a, b) => b.missingCount - a.missingCount);

        if (missingFiles.length === 0) {
            console.log('✅ Tous les fichiers sont indexés!');
        } else {
            missingFiles.slice(0, 10).forEach((file, index) => {
                const shortPath = file.project.split('/').slice(-2).join('/');
                const coveragePercent = (file.coverage * 100).toFixed(1);
                console.log(`${index + 1}. ${shortPath}`);
                console.log(`   ${formatNumber(file.missingCount)} fichiers manquants (${coveragePercent}% de couverture)`);
            });
        }

        console.log();

        // Recommandations
        console.log('💡 RECOMMANDATIONS:');

        if (coveragePercentage < 50) {
            console.log('❌ Couverture faible (< 50%). Recommandation: Indexer plus de fichiers.');
        } else if (coveragePercentage < 80) {
            console.log('⚠️  Couverture modérée (50-80%). Recommandation: Améliorer la couverture.');
        } else {
            console.log('✅ Excellente couverture (> 80%). Bon travail!');
        }

        // Vérifier la fraîcheur des données
        const staleProjects = projectStats.filter(p => {
            if (!p.indexedStats.lastUpdated) return true;
            const daysAgo = (Date.now() - p.indexedStats.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
            return daysAgo > 30;
        });

        if (staleProjects.length > 0) {
            console.log(`🕒 ${staleProjects.length} projet(s) n'ont pas été mis à jour depuis plus de 30 jours.`);
            console.log('   Recommandation: Exécuter une réindexation.');
        }

        console.log();
        console.log('='.repeat(80));
        console.log('📝 Commandes disponibles:');
        console.log('  • node rag-dashboard.js stats  - Afficher les statistiques détaillées');
        console.log('  • node rag-dashboard.js missing - Lister tous les fichiers manquants');
        console.log('  • node rag-dashboard.js types   - Afficher la répartition par type');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('❌ Erreur lors de l\'affichage du dashboard:', error.message);
        console.error('Assurez-vous que la base de données RAG est accessible.');
    }
}

// Fonction pour afficher les statistiques détaillées
async function displayDetailedStats() {
    const { getProjectStats, listProjects } = await loadRAGModules();

    console.log('📊 STATISTIQUES DÉTAILLÉES RAG');
    console.log('='.repeat(80));

    try {
        const projects = await listProjects();

        for (const projectPath of projects) {
            console.log();
            console.log(`🔹 ${projectPath}`);
            console.log('-'.repeat(80));

            const stats = await getProjectStats(projectPath);

            console.log(`Fichiers: ${stats.totalFiles}`);
            console.log(`Chunks: ${stats.totalChunks}`);
            console.log(`Indexé le: ${stats.indexedAt ? stats.indexedAt.toLocaleString('fr-FR') : 'N/A'}`);
            console.log(`Dernière mise à jour: ${stats.lastUpdated ? stats.lastUpdated.toLocaleString('fr-FR') : 'N/A'}`);

            if (stats.contentTypes && Object.keys(stats.contentTypes).length > 0) {
                console.log('Types de contenu:');
                Object.entries(stats.contentTypes).forEach(([type, count]) => {
                    console.log(`  • ${type}: ${count} chunks`);
                });
            }
        }

    } catch (error) {
        console.error('Erreur:', error.message);
    }
}

// Fonction principale
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'dashboard';

    switch (command) {
        case 'dashboard':
            await displayDashboard();
            break;
        case 'stats':
            await displayDetailedStats();
            break;
        case 'missing':
            console.log('Fonctionnalité "missing" à implémenter');
            break;
        case 'types':
            console.log('Fonctionnalité "types" à implémenter');
            break;
        default:
            console.log(`Commande inconnue: ${command}`);
            console.log('Utilisation: node rag-dashboard.js [dashboard|stats|missing|types]');
            break;
    }
}

// Exécuter le script principal
main().catch(error => {
    console.error('❌ Erreur lors de l\'exécution du dashboard:', error);
    process.exit(1);
});
