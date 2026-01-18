#!/usr/bin/env node

/**
 * Dashboard CLI pour visualiser la couverture RAG (version refactorée)
 * Affiche les statistiques par projet, type de contenu, et fichiers manquants
 */

import { dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  displayDashboard,
  displayDetailedStats
} from './scripts/dashboard-utils/dashboard-display-utils.js';
import {
  loadRAGModules,
  scanProjectDirectory
} from './scripts/dashboard-utils/dashboard-stats-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Collecter les statistiques de tous les projets
 */
async function collectProjectStats() {
  const { getProjectStats, listProjects } = await loadRAGModules();
  const indexedProjects = await listProjects();

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

    } catch (error) {
      console.error(`❌ Erreur lors de l'analyse du projet ${projectPath}:`, error.message);
    }
  }

  return projectStats;
}

/**
 * Fonction principale refactorée
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'dashboard';

  try {
    const projectStats = await collectProjectStats();

    switch (command) {
      case 'dashboard':
        await displayDashboard(projectStats);
        break;

      case 'stats':
        displayDetailedStats(projectStats);
        break;

      case 'missing':
        console.log('Fonctionnalité "missing" à implémenter');
        break;

      case 'types':
        console.log('Fonctionnalité "types" à implémenter');
        break;

      default:
        console.log(`Commande inconnue: ${command}`);
        console.log('Utilisation: node rag-dashboard-refactored.js [dashboard|stats|missing|types]');
        break;
    }

  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution du dashboard:', error.message);
    console.error('Assurez-vous que la base de données RAG est accessible.');
    process.exit(1);
  }
}

// Exécuter le script principal
main().catch(error => {
  console.error('❌ Erreur lors de l\'exécution du dashboard:', error);
  process.exit(1);
});
