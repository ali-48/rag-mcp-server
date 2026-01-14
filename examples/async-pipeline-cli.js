#!/usr/bin/env node

/**
 * Exemple CLI d'utilisation du pipeline RAG asynchrone
 * 
 * Ce script peut être exécuté directement avec Node.js
 * Il montre comment utiliser les outils depuis un terminal
 */

const { toolRegistry } = require('../build/src/core/tool-registry.js');
const { StateManager } = require('../build/src/rag/state-manager.js');

/**
 * Fonction utilitaire pour afficher une barre de progression
 */
function showProgressBar(progress, width = 40) {
    const filled = Math.round(width * progress / 100);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `[${bar}] ${progress}%`;
}

/**
 * Fonction principale
 */
async function main() {
    console.log('🚀 Démonstration CLI du pipeline RAG asynchrone\n');

    // Demander le chemin du projet
    const projectPath = process.argv[2] || process.cwd();
    console.log(`📁 Projet : ${projectPath}\n`);

    const stateManager = StateManager.getInstance();

    try {
        // Étape 1 : Vérifier l'initialisation
        console.log('🔍 Vérification de l\'initialisation RAG...');
        const initialized = await stateManager.isInitialized(projectPath);

        if (!initialized) {
            console.log('❌ Projet non initialisé');
            console.log('🔧 Initialisation en cours...');

            const initResult = await toolRegistry.execute('init_rag', {
                project_path: projectPath,
                mode: 'default',
                verbose: false
            });

            if (initResult.status !== 'success') {
                console.error('💥 Échec de l\'initialisation:', initResult.message);
                process.exit(1);
            }

            console.log('✅ Projet initialisé avec succès');
        } else {
            console.log('✅ Projet déjà initialisé');
        }

        // Étape 2 : Démarrer l'indexation
        console.log('\n🚀 Démarrage de l\'indexation asynchrone...');
        const indexResult = await toolRegistry.execute('index_rag', {
            project_path: projectPath,
            mode: 'full',
            file_patterns: ['**/*.ts', '**/*.js', '**/*.md'],
            chunking_strategy: 'logical',
            max_chunk_size: 1000,
            chunk_overlap: 200
        });

        if (!indexResult.task_id) {
            console.error('💥 Échec de création de la tâche:', indexResult);
            process.exit(1);
        }

        const taskId = indexResult.task_id;
        console.log(`✅ Tâche créée : ${taskId}`);
        console.log(`📊 État initial : ${indexResult.status?.state || 'unknown'}`);

        // Étape 3 : Suivre la progression
        console.log('\n📈 Suivi de la progression :\n');

        let isCompleted = false;
        let lastProgress = 0;

        while (!isCompleted) {
            await new Promise(resolve => setTimeout(resolve, 2000));

            const status = await toolRegistry.execute('get_task_status', {
                task_id: taskId
            });

            // Afficher la barre de progression
            if (status.progress !== lastProgress) {
                console.clear();
                console.log('🚀 Indexation RAG en cours...\n');
                console.log(`📝 Task ID : ${taskId}`);
                console.log(`📊 État    : ${status.state}`);
                console.log(`🔧 Étape   : ${status.step}`);
                console.log(`⏱️  ETA     : ${status.eta || 'calcul...'}`);
                console.log(`\n${showProgressBar(status.progress)}`);

                if (status.stats) {
                    console.log(`\n📊 Statistiques :`);
                    console.log(`   📄 Fichiers traités : ${status.stats.files_processed || 0}`);
                    console.log(`   🧩 Chunks créés     : ${status.stats.chunks_created || 0}`);
                    console.log(`   ⚡ Temps écoulé     : ${status.stats.elapsed_time || 0}s`);
                }

                lastProgress = status.progress;
            }

            // Vérifier si terminé
            if (status.state === 'completed') {
                isCompleted = true;
                console.clear();
                console.log('🎉 INDEXATION TERMINÉE AVEC SUCCÈS !\n');
                console.log('📊 Statistiques finales :');
                console.log(JSON.stringify(status.stats, null, 2));

                // Afficher un résumé
                if (status.stats) {
                    console.log(`\n📈 RÉSUMÉ :`);
                    console.log(`   ✅ Fichiers traités : ${status.stats.files_processed || 0}`);
                    console.log(`   ✅ Chunks créés     : ${status.stats.chunks_created || 0}`);
                    console.log(`   ✅ Temps total      : ${status.stats.elapsed_time || 0} secondes`);
                    console.log(`   ✅ Taux de traitement : ${status.stats.files_per_second || 0} fichiers/sec`);
                }

            } else if (status.state === 'failed') {
                isCompleted = true;
                console.error('\n💥 INDEXATION ÉCHOUÉE');
                console.error('Erreur :', status.error?.message || 'Erreur inconnue');

                if (status.error?.code === 'EMBEDDING_FAILED') {
                    console.log('\n💡 CONSEIL : Vérifiez que Ollama est en cours d\'exécution');
                    console.log('   Commande : ollama serve');
                }
                process.exit(1);

            } else if (status.state === 'cancelled') {
                isCompleted = true;
                console.log('\n⚠️ INDEXATION ANNULÉE');
            }
        }

        // Étape 4 : Tester la recherche
        console.log('\n🔍 Test de recherche sémantique...');
        const searchResult = await toolRegistry.execute('recherche_rag', {
            query: 'fonction utilitaire',
            scope: 'project',
            project_filter: projectPath,
            top_k: 3,
            threshold: 0.3
        });

        console.log(`\n📊 ${searchResult.results?.length || 0} résultats trouvés :`);

        if (searchResult.results && searchResult.results.length > 0) {
            searchResult.results.forEach((result, index) => {
                console.log(`\n--- Résultat ${index + 1} ---`);
                console.log(`📄 Fichier : ${result.file_path}`);
                console.log(`📝 Type    : ${result.content_type}`);
                console.log(`⭐ Score   : ${result.score.toFixed(3)}`);
                console.log(`📋 Extrait : ${result.content?.substring(0, 150)}...`);
            });
        }

        console.log('\n✅ DÉMONSTRATION TERMINÉE AVEC SUCCÈS !');

    } catch (error) {
        console.error('💥 ERREUR CRITIQUE :', error.message);
        console.error('Stack trace :', error.stack);
        process.exit(1);
    }
}

// Gestion des arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
Usage: node async-pipeline-cli.js [project-path]

Options:
  --help, -h     Affiche cette aide
  project-path   Chemin vers le projet à indexer (défaut: répertoire courant)

Exemples:
  node async-pipeline-cli.js /chemin/vers/mon/projet
  node async-pipeline-cli.js .  (indexe le répertoire courant)
    `);
    process.exit(0);
}

// Exécuter le script
main().catch(error => {
    console.error('💥 Erreur non gérée :', error);
    process.exit(1);
});
