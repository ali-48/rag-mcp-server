/**
 * Exemple basique d'utilisation du pipeline RAG asynchrone
 * 
 * Ce fichier montre comment utiliser les nouveaux outils asynchrones :
 * - index_rag : Indexation asynchrone avec task_id
 * - get_task_status : Suivi de progression
 * - recherche_rag : Recherche sémantique
 */

import { toolRegistry } from '../src/core/tool-registry';
import { StateManager } from '../src/rag/state-manager';

/**
 * Exemple 1 : Workflow complet d'initialisation et indexation asynchrone
 */
async function exampleBasicWorkflow() {
    const projectPath = '/chemin/vers/votre/projet';
    const stateManager = StateManager.getInstance();

    console.log('🚀 Démarrage du workflow RAG asynchrone');
    console.log(`📁 Projet : ${projectPath}`);

    // Étape 1 : Vérifier si le projet est initialisé
    console.log('\n🔍 Vérification de l\'initialisation RAG...');
    const initialized = await stateManager.isInitialized(projectPath);

    if (!initialized) {
        console.log('🔧 Initialisation du projet...');
        const initResult = await toolRegistry.execute('init_rag', {
            project_path: projectPath,
            mode: 'default',
            verbose: true
        });

        if (initResult.status !== 'success') {
            console.error('❌ Échec de l\'initialisation:', initResult.message);
            return;
        }

        console.log('✅ Projet initialisé avec succès');
        console.log(`📊 ID du projet : ${initResult.data?.project_id}`);
    } else {
        console.log('✅ Projet déjà initialisé');
    }

    // Étape 2 : Récupérer l'état actuel
    console.log('\n📊 Récupération de l\'état RAG...');
    const state = await stateManager.loadState(projectPath);
    console.log('État RAG :', JSON.stringify(state, null, 2));

    // Étape 3 : Démarrer l'indexation asynchrone
    console.log('\n🚀 Démarrage de l\'indexation asynchrone...');
    const indexResult = await toolRegistry.execute('index_rag', {
        project_path: projectPath,
        mode: 'full',
        file_patterns: ['**/*.ts', '**/*.js', '**/*.md', '**/*.json'],
        chunking_strategy: 'logical',
        max_chunk_size: 1000,
        chunk_overlap: 200,
        embedding_model: 'nomic-embed-text',
        enable_llm_enrichment: false
    });

    // Vérifier que la tâche a été créée
    if (!indexResult.task_id) {
        console.error('❌ Échec de création de la tâche:', indexResult);
        return;
    }

    const taskId = indexResult.task_id;
    console.log(`✅ Tâche créée avec succès`);
    console.log(`📝 Task ID : ${taskId}`);
    console.log(`📊 État initial : ${indexResult.status?.state || 'unknown'}`);
    console.log(`📈 Progression initiale : ${indexResult.status?.progress || 0}%`);

    // Étape 4 : Suivre la progression
    console.log('\n📈 Suivi de la progression...');
    let isCompleted = false;
    let lastProgress = 0;

    while (!isCompleted) {
        // Attendre 2 secondes entre chaque vérification
        await new Promise(resolve => setTimeout(resolve, 2000));

        const status = await toolRegistry.execute('get_task_status', {
            task_id: taskId
        });

        // Afficher la progression seulement si elle a changé
        if (status.progress !== lastProgress) {
            console.log(`📊 Progression : ${status.progress}% | État : ${status.state} | Étape : ${status.step}`);
            lastProgress = status.progress;
        }

        // Vérifier si la tâche est terminée
        if (status.state === 'completed') {
            isCompleted = true;
            console.log('\n🎉 Indexation terminée avec succès !');
            console.log('📊 Statistiques :', status.stats);
        } else if (status.state === 'failed') {
            isCompleted = true;
            console.error('\n❌ Indexation échouée :', status.error);
        } else if (status.state === 'cancelled') {
            isCompleted = true;
            console.log('\n⚠️ Indexation annulée');
        }
    }

    // Étape 5 : Effectuer une recherche
    console.log('\n🔍 Exécution d\'une recherche sémantique...');
    const searchResult = await toolRegistry.execute('recherche_rag', {
        query: 'comment implémenter l\'authentification utilisateur',
        scope: 'project',
        project_filter: projectPath,
        content_types: ['code', 'doc'],
        top_k: 5,
        threshold: 0.3
    });

    console.log(`\n📊 Résultats de recherche (${searchResult.results?.length || 0} trouvés) :`);

    if (searchResult.results && searchResult.results.length > 0) {
        searchResult.results.forEach((result: any, index: number) => {
            console.log(`\n--- Résultat ${index + 1} ---`);
            console.log(`📄 Fichier : ${result.file_path}`);
            console.log(`📝 Type : ${result.content_type}`);
            console.log(`⭐ Score : ${result.score.toFixed(3)}`);
            console.log(`📋 Extrait : ${result.content?.substring(0, 200)}...`);
        });
    } else {
        console.log('Aucun résultat trouvé');
    }

    console.log('\n✅ Workflow terminé avec succès !');
}

/**
 * Exemple 2 : Indexation incrémentale
 */
async function exampleIncrementalIndexing() {
    const projectPath = '/chemin/vers/votre/projet';

    console.log('\n\n🔄 Démarrage de l\'indexation incrémentale...');

    const result = await toolRegistry.execute('index_rag', {
        project_path: projectPath,
        mode: 'incremental',
        file_patterns: ['**/*.ts', '**/*.js'],
        chunking_strategy: 'logical'
    });

    console.log(`✅ Tâche incrémentale créée : ${result.task_id}`);
    console.log(`📊 État : ${result.status?.state}`);

    // Suivi simplifié
    const status = await toolRegistry.execute('get_task_status', {
        task_id: result.task_id
    });

    console.log('Progression finale :', status.progress, '%');
    console.log('Statistiques :', status.stats);
}

/**
 * Fonction principale
 */
async function main() {
    try {
        console.log('========================================');
        console.log('   EXEMPLES PIPELINE RAG ASYNCHRONE    ');
        console.log('========================================\n');

        // Exécuter l'exemple basique
        await exampleBasicWorkflow();

        // Exécuter l'exemple d'indexation incrémentale
        // await exampleIncrementalIndexing();

    } catch (error) {
        console.error('❌ Erreur dans l\'exécution des exemples:', error);
    }
}

// Exécuter le script si appelé directement
if (require.main === module) {
    main().catch(console.error);
}

export { exampleBasicWorkflow, exampleIncrementalIndexing };
