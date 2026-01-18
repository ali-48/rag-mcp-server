// scripts/dashboard-utils/dashboard-stats-utils.js
// Utilitaires pour les statistiques du dashboard RAG

import { existsSync, readdirSync } from 'fs';

/**
 * Scanner un répertoire et compter les fichiers par type
 */
export function scanProjectDirectory(projectPath) {
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

/**
 * Créer une barre de progression
 */
export function createProgressBar(value, max, width = 30) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const filledWidth = Math.round((percentage / 100) * width);
  const emptyWidth = width - filledWidth;

  const filledBar = '█'.repeat(filledWidth);
  const emptyBar = '░'.repeat(emptyWidth);

  return `${filledBar}${emptyBar} ${percentage.toFixed(1)}%`;
}

/**
 * Formatter les nombres
 */
export function formatNumber(num) {
  return num.toLocaleString('fr-FR');
}

/**
 * Charger dynamiquement les modules RAG
 */
export async function loadRAGModules() {
  const { getProjectStats, listProjects } = await import('../build/rag/vector-store.js');
  return { getProjectStats, listProjects };
}

/**
 * Calculer les statistiques globales à partir des projets
 */
export function calculateGlobalStats(projectStats) {
  let totalIndexedFiles = 0;
  let totalIndexedChunks = 0;
  let totalScannedFiles = 0;

  for (const project of projectStats) {
    totalIndexedFiles += project.indexedStats.totalFiles;
    totalIndexedChunks += project.indexedStats.totalChunks;
    totalScannedFiles += project.scannedFiles.total;
  }

  const coveragePercentage = totalScannedFiles > 0
    ? (totalIndexedFiles / totalScannedFiles) * 100
    : 0;

  return {
    totalIndexedFiles,
    totalIndexedChunks,
    totalScannedFiles,
    coveragePercentage
  };
}

/**
 * Calculer les statistiques par type de contenu
 */
export function calculateContentTypeStats(projectStats) {
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

  return typeStats;
}

/**
 * Calculer les fichiers manquants par projet
 */
export function calculateMissingFiles(projectStats) {
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

  return missingFiles;
}

/**
 * Identifier les projets obsolètes (non mis à jour depuis plus de 30 jours)
 */
export function identifyStaleProjects(projectStats) {
  const staleProjects = [];

  for (const project of projectStats) {
    if (!project.indexedStats.lastUpdated) {
      staleProjects.push(project);
      continue;
    }

    const daysAgo = (Date.now() - project.indexedStats.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
    if (daysAgo > 30) {
      staleProjects.push(project);
    }
  }

  return staleProjects;
}

/**
 * Générer des recommandations basées sur les statistiques
 */
export function generateRecommendations(globalStats, staleProjectsCount) {
  const recommendations = [];

  if (globalStats.coveragePercentage < 50) {
    recommendations.push('❌ Couverture faible (< 50%). Recommandation: Indexer plus de fichiers.');
  } else if (globalStats.coveragePercentage < 80) {
    recommendations.push('⚠️  Couverture modérée (50-80%). Recommandation: Améliorer la couverture.');
  } else {
    recommendations.push('✅ Excellente couverture (> 80%). Bon travail!');
  }

  if (staleProjectsCount > 0) {
    recommendations.push(`🕒 ${staleProjectsCount} projet(s) n'ont pas été mis à jour depuis plus de 30 jours. Recommandation: Exécuter une réindexation.`);
  }

  return recommendations;
}
