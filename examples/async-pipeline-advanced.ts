/**
 * Exemple avancé d'utilisation du pipeline RAG asynchrone
 * 
 * Ce fichier montre des fonctionnalités avancées :
 * - Gestion d'erreurs avec ErrorHandler
 * - Annulation de tâches avec cancel_task
 * - Utilisation de ProgressCLI pour l'affichage
 * - Gestion des checkpoints
 * - Tests de performance
 */

import { toolRegistry } from '../src/core/tool-registry';
import { ErrorHandler } from '../src/rag/errors/error-handler';
import { ProgressCLI } from '../src/rag/progress/progress-cli';
import { StateManager } from '../src/rag/state-manager';

/**
 * Exemple 1 : Workflow avec gestion d'erreurs et annulation
 */
async function exampleErrorHandlingAndCancellation() {
    const projectPath = '/chemin/vers/votre/projet';
    const stateManager = StateManager.getInstance();
    const errorHandler = new ErrorHandler();
    const progressCLI = new ProgressCLI();

    console.log('🚀 Démarrage du workflow avancé avec gestion d\'erreurs');
    console.log(`📁 Projet : ${projectPath}`);

    try {
        // Étape 1 : Vérifier l'initialisation avec gestion d'erreurs
        console.log('\n🔍 Vérification de l\'initialisation...');
        let initialized = false;

        try {
            initialized = await stateManager.isInitialized(projectPath);
        } catch (error) {
            const formattedError = errorHandler.formatForMCP(error);
            console.error('❌ Erreur lors de la vérification:', formattedError);

            // Tentative de récupération
            console.log('🔄 Tentative de récupération...');
            initialized = false;
        }

        if (!initialized) {
            console.log('🔧 Initialisation du projet...');
            const initResult = await toolRegistry.execute('init_rag', {
                project_path: projectPath,
                mode: 'default'
            });

            if (initResult.status !== 'success') {
                throw new Error(`Échec de l'initialisation: ${initResult.message}`);
            }
            console.log('✅ Projet initialisé');
        }

        // Étape 2 : Démarrer l'indexation avec timeout
        console.log('\n🚀 Démarrage de l\'indexation avec timeout de 30 secondes...');
        const indexResult = await toolRegistry.execute('index_rag', {
            project_path: projectPath,
            mode: 'full',
            file_patterns: ['**/*.ts', '**/*.js', '**/*.md'],
            chunking_strategy: 'logical',
            max_chunk_size: 800,
            chunk_overlap: 150,
            enable_llm_enrichment: true
        });

        const taskId = indexResult.task_id;
        console.log(`✅ Tâche créée: ${taskId}`);

        // Étape 3 : Suivi avec ProgressCLI
        console.log('\n📈 Activation du suivi visuel...');
        progressCLI.enable();

        let isCompleted = false;
        let shouldCancel = false;
        const startTime = Date.now();
        const timeoutMs = 30000; // 30 secondes

        // Simuler une décision d'annulation après 10 secondes
        setTimeout(() => {
            console.log('\n⏰ Timeout atteint, annulation de la tâche...');
            shouldCancel = true;
        }, 10000);

        while (!isCompleted && (Date.now() - startTime) < timeoutMs) {
            if (shouldCancel) {
                console.log('\n🛑 Annulation de la tâche...');
                const cancelResult = await toolRegistry.execute('cancel_task', {
                    task_id: taskId
                });

                if (cancelResult.success) {
                    console.log('✅ Tâche annulée avec succès');
                } else {
                    console.error('❌ Échec de l\'annulation:', cancelResult.error);
                }
                break;
            }

            // Récupérer le statut
            const status = await toolRegistry.execute('get_task_status', {
                task_id: taskId
            });

            // Mettre à jour la barre de progression
            progressCLI.update({
                taskId,
                progress: status.progress,
                state: status.state,
                step: status.step,
                eta: status.eta
            });

            // Vérifier l'état
            if (status.state === 'completed') {
                isCompleted = true;
                progressCLI.complete();
                console.log('\n🎉 Indexation terminée avec succès !');
                console.log('📊 Statistiques détaillées:', status.stats);
            } else if (status.state === 'failed') {
                isCompleted = true;
                progressCLI.fail();

                const formattedError = errorHandler.formatForMCP(status.error);
                console.error('\n❌ Indexation échouée:', formattedError);

                // Suggestions de résolution
                if (status.error?.code === 'EMBEDDING_FAILED') {
                    console.log('💡 Suggestion: Vérifiez que Ollama est en cours d\'exécution');
                    console.log('💡 Commande: ollama serve');
                }
            } else if (status.state === 'cancelled') {
                isCompleted = true;
                progressCLI.cancel();
                console.log('\n⚠️ Indexation annulée par l\'utilisateur');
            }

            // Attendre 1 seconde
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (!isCompleted) {
            console.log('\n⏰ Timeout global atteint');
            progressCLI.fail();
        }

        // Étape 4 : Vérifier l'état après traitement
        console.log('\n🔍 Vérification de l\'état final...');
        const finalState = await stateManager.loadState(projectPath);
        console.log('État final:', JSON.stringify(finalState, null, 2));

    } catch (error) {
        const formattedError = errorHandler.formatForMCP(error);
        console.error('\n💥 ERREUR CRITIQUE:', formattedError);

        // Log pour débogage
        console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');

        // Suggestions générales
        console.log('\n🔧 Suggestions de dépannage:');
        console.log('1. Vérifiez que le chemin du projet existe');
        console.log('2. Assurez-vous d\'avoir les permissions d\'écriture');
        console.log('3. Vérifiez les logs: tail -f logs/rag.log');
        console.log('4. Essayez avec mode="memory-only" pour les tests');
    } finally {
        // Désactiver ProgressCLI
        progressCLI.disable();
    }
}

/**
 * Exemple 2 : Indexation avec checkpoints et reprise
 */
async function exampleCheckpointsAndResume() {
    const projectPath = '/chemin/vers/votre/projet';

    console.log('\n\n🔄 Démarrage de l\'exemple checkpoints et reprise...');

    // Simuler un crash après 5 secondes
    console.log('⚠️ Simulation d\'un crash après 5 secondes...');

    const indexResult = await toolRegistry.execute('index_rag', {
        project_path: projectPath,
        mode: 'full',
        chunking_strategy: 'logical',
        enable_checkpoints: true,
        checkpoint_interval: 10 // Checkpoint tous les 10 fichiers
    });

    const taskId = indexResult.task_id;
    console.log(`✅ Tâche créée: ${taskId}`);

    // Attendre 5 secondes puis simuler un crash
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('💥 Simulation d\'un crash...');
    console.log('(Dans un scénario réel, le système détecterait le crash et reprendrait depuis le dernier checkpoint)');

    // Récupérer l'état de la tâche
    const status = await toolRegistry.execute('get_task_status', {
        task_id: taskId
    });

    console.log('État après crash simulé:');
    console.log('- Progression:', status.progress, '%');
    console.log('- Étape:', status.step);
    console.log('- Checkpoints:', status.checkpoints || 'Aucun');

    // Dans un scénario réel, le système reprendrait automatiquement
    console.log('\n🔄 Le système reprendrait automatiquement depuis le dernier checkpoint');
}

/**
 * Exemple 3 : Tests de performance
 */
async function examplePerformanceTesting() {
    const projectPath = '/chemin/vers/votre/projet';

    console.log('\n\n📊 Démarrage des tests de performance...');

    // Mesurer le temps d'initialisation
    console.log('⏱️  Test 1: Temps d\'initialisation');
    const initStart = Date.now();

    const initResult = await toolRegistry.execute('init_rag', {
        project_path: projectPath,
        mode: 'memory-only' // Mode plus rapide pour les tests
    });

    const initTime = Date.now() - initStart;
    console.log(`✅ Initialisation terminée en ${initTime}ms`);

    // Mesurer le temps de création de tâche
    console.log('\n⏱️  Test 2: Temps de création de tâche');
    const taskStart = Date.now();

    const indexResult = await toolRegistry.execute('index_rag', {
        project_path: projectPath,
        mode: 'full',
        file_patterns: ['**/*.ts'],
        max_chunk_size: 500 // Taille réduite pour les tests
    });

    const taskTime = Date.now() - taskStart;
    console.log(`✅ Tâche créée en ${taskTime}ms`);
    console.log(`📝 Task ID: ${indexResult.task_id}`);

    // Mesurer le temps de première progression
    console.log('\n⏱️  Test 3: Temps de première progression');
    const progressStart = Date.now();

    let status = null;
    let attempts = 0;
    const maxAttempts = 10;

    while (!status?.progress && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        status = await toolRegistry.execute('get_task_status', {
            task_id: indexResult.task_id
        });
        attempts++;
    }

    const progressTime = Date.now() - progressStart;
    console.log(`✅ Première progression en ${progressTime}ms (${attempts} tentatives)`);
    console.log(`📊 Progression initiale: ${status?.progress || 0}%`);

    // Annuler la tâche pour nettoyer
    console.log('\n🧹 Nettoyage: Annulation de la tâche de test...');
    await toolRegistry.execute('cancel_task', {
        task_id: indexResult.task_id
    });

    console.log('✅ Tests de performance terminés');
}

/**
 * Fonction principale
 */
async function main() {
    try {
        console.log('==============================================');
        console.log('   EXEMPLES AVANCÉS PIPELINE RAG ASYNCHRONE  ');
        console.log('==============================================\n');

        // Exécuter les exemples
        await exampleErrorHandlingAndCancellation();
        await exampleCheckpointsAndResume();
        await examplePerformanceTesting();

        console.log('\n✅ Tous les exemples avancés terminés avec succès !');

    } catch (error) {
        console.error('❌ Erreur dans l\'exécution des exemples avancés:', error);
    }
}

// Exécuter le script si appelé directement
if (require.main === module) {
    main().catch(console.error);
}

export {
    exampleCheckpointsAndResume, exampleErrorHandlingAndCancellation, examplePerformanceTesting
};

