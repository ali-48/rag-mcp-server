// scripts/dashboard-utils/dashboard-display-utils.js
// Utilitaires pour l'affichage du dashboard RAG

import {
  calculateContentTypeStats,
  calculateGlobalStats,
  calculateMissingFiles,
  createProgressBar,
  formatNumber,
  generateRecommendations,
  identifyStaleProjects
} from './dashboard-stats-utils.js';

/**
 * Afficher l'en-tête du dashboard
 */
export function displayDashboardHeader() {
  console.clear();
  console.log('='.repeat(80));
  console.log('📊 DASHBOARD COUVERTURE RAG');
  console.log('='.repeat(80));
  console.log(`Date: ${new Date().toLocaleString('fr-FR')}`);
  console.log();
}

/**
 * Afficher les statistiques globales
 */
export function displayGlobalStats(globalStats) {
  console.log('📈 STATISTIQUES GLOBALES:');
  console.log(`  • Fichiers indexés: ${formatNumber(globalStats.totalIndexedFiles)}`);
  console.log(`  • Chunks indexés: ${formatNumber(globalStats.totalIndexedChunks)}`);
  console.log(`  • Fichiers scannés: ${formatNumber(globalStats.totalScannedFiles)}`);
  console.log(`  • Couverture: ${createProgressBar(globalStats.totalIndexedFiles, globalStats.totalScannedFiles)}`);
  console.log();
}

/**
 * Afficher la répartition par type de contenu
 */
export function displayContentTypeDistribution(typeStats) {
  console.log('🎨 RÉPARTITION PAR TYPE DE CONTENU:');

  Object.entries(typeStats).forEach(([type, stats]) => {
    if (stats.scanned > 0 || stats.indexed > 0) {
      console.log(`  • ${type.toUpperCase()}:`);
      console.log(`      Indexés: ${formatNumber(stats.indexed)} / Scannés: ${formatNumber(stats.scanned)}`);
      console.log(`      Couverture: ${createProgressBar(stats.indexed, stats.scanned)}`);
    }
  });

  console.log();
}

/**
 * Afficher les détails par projet
 */
export function displayProjectDetails(projectStats) {
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
}

/**
 * Afficher les fichiers manquants (top 10)
 */
export function displayMissingFiles(missingFiles) {
  console.log('⚠️  FICHIERS MANQUANTS (TOP 10):');
  console.log();

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
}

/**
 * Afficher les recommandations
 */
export function displayRecommendations(recommendations) {
  console.log('💡 RECOMMANDATIONS:');

  recommendations.forEach(recommendation => {
    console.log(recommendation);
  });

  console.log();
}

/**
 * Afficher le pied de page du dashboard
 */
export function displayDashboardFooter() {
  console.log('='.repeat(80));
  console.log('📝 Commandes disponibles:');
  console.log('  • node rag-dashboard.js stats  - Afficher les statistiques détaillées');
  console.log('  • node rag-dashboard.js missing - Lister tous les fichiers manquants');
  console.log('  • node rag-dashboard.js types   - Afficher la répartition par type');
  console.log('='.repeat(80));
}

/**
 * Afficher les statistiques détaillées
 */
export function displayDetailedStats(projectStats) {
  console.log('📊 STATISTIQUES DÉTAILLÉES RAG');
  console.log('='.repeat(80));

  for (const project of projectStats) {
    console.log();
    console.log(`🔹 ${project.path}`);
    console.log('-'.repeat(80));

    const stats = project.indexedStats;

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
}

/**
 * Fonction principale d'affichage du dashboard
 */
export async function displayDashboard(projectStats) {
  displayDashboardHeader();

  // Calculer les statistiques
  const globalStats = calculateGlobalStats(projectStats);
  const typeStats = calculateContentTypeStats(projectStats);
  const missingFiles = calculateMissingFiles(projectStats);
  const staleProjects = identifyStaleProjects(projectStats);
  const recommendations = generateRecommendations(globalStats, staleProjects.length);

  // Afficher les sections
  displayGlobalStats(globalStats);
  displayContentTypeDistribution(typeStats);
  displayProjectDetails(projectStats);
  displayMissingFiles(missingFiles);
  displayRecommendations(recommendations);
  displayDashboardFooter();
}
