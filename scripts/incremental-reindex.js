#!/usr/bin/env node

// Script de production pour la réindexation incrémentale basée sur Git diff
//
// Usage:
//   node scripts/incremental-reindex.js <project-path> [options]
//
// Options:
//   --chunk-size <number>     Taille des chunks (défaut: 1000)
//   --chunk-overlap <number>  Chevauchement des chunks (défaut: 200)
//   --file-patterns <glob>   Patterns de fichiers (défaut: **/*.{js,ts,py,md,txt,json,yaml,yml,html,css,scss})
//   --dry-run                Simulation sans modifications
//   --verbose                Mode verbeux
//   --help                   Afficher l'aide

import fs from 'fs';
import path from 'path';
import { updateProject } from '../build/rag/indexer.js';

// Fonction pour afficher l'aide
function showHelp() {
  console.log(`
📦 Script de réindexation incrémentale RAG

Usage:
  node scripts/incremental-reindex.js <project-path> [options]

Arguments:
  <project-path>            Chemin du projet à réindexer (obligatoire)

Options:
  --chunk-size <number>     Taille des chunks en tokens (défaut: 1000)
  --chunk-overlap <number>  Chevauchement des chunks en tokens (défaut: 200)
  --file-patterns <glob>    Patterns de fichiers (séparés par des virgules)
  --dry-run                 Simulation sans modifications à la base de données
  --verbose                 Mode verbeux avec plus de détails
  --help                    Afficher cette aide

Exemples:
  # Réindexation incrémentale standard
  node scripts/incremental-reindex.js /chemin/vers/projet

  # Avec options personnalisées
  node scripts/incremental-reindex.js /chemin/vers/projet \\
    --chunk-size 500 \\
    --chunk-overlap 100 \\
    --file-patterns "**/*.{js,ts,py}"

  # Simulation (dry-run)
  node scripts/incremental-reindex.js /chemin/vers/projet --dry-run

  # Mode verbeux
  node scripts/incremental-reindex.js /chemin/vers/projet --verbose
`);
}

// Fonction pour parser les arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    projectPath: null,
    chunkSize: 1000,
    chunkOverlap: 200,
    filePatterns: ["**/*.{js,ts,py,md,txt,json,yaml,yml,html,css,scss}"],
    dryRun: false,
    verbose: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
      return result;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      result.verbose = true;
    } else if (arg === '--chunk-size' && i + 1 < args.length) {
      result.chunkSize = parseInt(args[++i]);
    } else if (arg === '--chunk-overlap' && i + 1 < args.length) {
      result.chunkOverlap = parseInt(args[++i]);
    } else if (arg === '--file-patterns' && i + 1 < args.length) {
      result.filePatterns = args[++i].split(',').map(p => p.trim());
    } else if (!arg.startsWith('--') && !result.projectPath) {
      result.projectPath = path.resolve(arg);
    }
  }

  return result;
}

// Fonction principale
async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    return;
  }

  if (!args.projectPath) {
    console.error('❌ Erreur: Chemin du projet manquant');
    console.error('Utilisez --help pour voir l\'aide');
    process.exit(1);
  }

  if (!fs.existsSync(args.projectPath)) {
    console.error(`❌ Erreur: Le chemin ${args.projectPath} n'existe pas`);
    process.exit(1);
  }

  console.log('🚀 Démarrage de la réindexation incrémentale');
  console.log('='.repeat(60));
  console.log(`📁 Projet: ${args.projectPath}`);
  console.log(`⚙️  Options:`);
  console.log(`  • Chunk size: ${args.chunkSize}`);
  console.log(`  • Chunk overlap: ${args.chunkOverlap}`);
  console.log(`  • File patterns: ${args.filePatterns.join(', ')}`);
  // stdout: JSON strict sans icônes
  console.log(JSON.stringify({
    message: 'Configuration options',
    options: {
      dry_run: args.dryRun,
      verbose: args.verbose,
      chunk_size: args.chunkSize,
      chunk_overlap: args.chunkOverlap,
      file_patterns: args.filePatterns
    }
  }));

  // stderr: texte enrichi avec icônes (pour les logs humains)
  console.error(`  • Dry run: ${args.dryRun ? '✅ Oui' : '❌ Non'}`);
  console.error(`  • Verbose: ${args.verbose ? '✅ Oui' : '❌ Non'}`);
  console.log();

  if (args.dryRun) {
    console.log('🔍 Mode simulation activé - aucune modification ne sera effectuée');
    console.log();
  }

  try {
    // Vérifier si c'est un dépôt Git
    const gitDir = path.join(args.projectPath, '.git');
    if (!fs.existsSync(gitDir)) {
      console.warn('⚠️  Attention: Le projet n\'est pas un dépôt Git');
      console.warn('  La réindexation incrémentale nécessite Git pour détecter les changements');
      console.warn('  Le système effectuera une réindexation complète à la place');
      console.log();
    }

    // Exécuter la réindexation incrémentale
    const startTime = Date.now();

    if (args.dryRun) {
      console.log('📊 Simulation de réindexation incrémentale:');
      console.log('  • Détection des fichiers modifiés via Git diff');
      console.log('  • Analyse des changements depuis le dernier commit');
      console.log('  • Identification des fichiers ajoutés, modifiés, supprimés');
      console.log('  • Calcul des statistiques sans modifications réelles');
      console.log();
      console.log('✅ Simulation terminée (mode dry-run)');
    } else {
      const stats = await updateProject(args.projectPath, {
        chunkSize: args.chunkSize,
        chunkOverlap: args.chunkOverlap,
        filePatterns: args.filePatterns,
        recursive: true
      });

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      console.log('✅ Réindexation incrémentale terminée');
      console.log(`⏱️  Durée: ${duration} secondes`);
      console.log();
      console.log('📊 Statistiques détaillées:');
      console.log(`  • Fichiers totaux: ${stats.totalFiles}`);
      console.log(`  • Fichiers indexés: ${stats.indexedFiles}`);
      console.log(`  • Fichiers modifiés/ajoutés: ${stats.modifiedFiles}`);
      console.log(`  • Fichiers supprimés: ${stats.deletedFiles}`);
      console.log(`  • Fichiers inchangés: ${stats.unchangedFiles}`);
      console.log(`  • Chunks créés: ${stats.chunksCreated}`);
      console.log(`  • Fichiers ignorés: ${stats.ignoredFiles}`);
      console.log(`  • Erreurs: ${stats.errors}`);
      console.log();

      // Analyse des résultats
      console.log('📈 Analyse des résultats:');

      if (stats.modifiedFiles === 0 && stats.deletedFiles === 0) {
        console.log('  • ✅ Aucun changement détecté dans le dépôt Git');
        console.log('  • ✅ L\'index est à jour');
      } else {
        if (stats.modifiedFiles > 0) {
          console.log(`  • 🔄 ${stats.modifiedFiles} fichiers réindexés`);
          console.log(`    → Optimisation: ${((stats.modifiedFiles / stats.totalFiles) * 100).toFixed(1)}% des fichiers traités`);
        }

        if (stats.deletedFiles > 0) {
          console.log(`  • 🗑️  ${stats.deletedFiles} fichiers supprimés de l'index`);
        }

        if (stats.unchangedFiles > 0) {
          console.log(`  • ✅ ${stats.unchangedFiles} fichiers inchangés (non traités)`);
          console.log(`    → Gain de performance: ${((stats.unchangedFiles / stats.totalFiles) * 100).toFixed(1)}%`);
        }
      }

      // Recommandations
      console.log();
      console.log('💡 Recommandations:');

      if (stats.errors > 0) {
        console.log(`  • ⚠️  ${stats.errors} erreurs détectées`);
        console.log('    → Vérifier les logs pour plus de détails');
      }

      if (stats.ignoredFiles > 0) {
        console.log(`  • ℹ️  ${stats.ignoredFiles} fichiers ignorés`);
        console.log('    → Vérifier les règles d\'exclusion dans .ragignore');
      }

      if (stats.modifiedFiles > 50) {
        console.log('  • 📈 Nombre important de modifications');
        console.log('    → Considérer une réindexation complète périodique');
      }

      // Performance
      const chunksPerSecond = stats.chunksCreated > 0 ? (stats.chunksCreated / duration).toFixed(1) : 0;
      console.log();
      console.log('⚡ Performance:');
      console.log(`  • Chunks par seconde: ${chunksPerSecond}`);
      console.log(`  • Durée totale: ${duration}s`);
      console.log(`  • Efficacité: ${stats.unchangedFiles > 0 ? 'Haute' : 'Moyenne'}`);
    }

    console.log();
    console.log('='.repeat(60));
    console.log('🎉 Réindexation incrémentale terminée avec succès');

  } catch (error) {
    console.error('❌ Erreur lors de la réindexation incrémentale:', error.message);

    if (args.verbose) {
      console.error('Détails de l\'erreur:', error);
    }

    process.exit(1);
  }
}

// Gestion des erreurs non capturées
process.on('unhandledRejection', (error) => {
  console.error('❌ Erreur non capturée:', error);
  process.exit(1);
});

// Exécuter le script
main().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
