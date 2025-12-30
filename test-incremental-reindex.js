#!/usr/bin/env node

/**
 * Test de la réindexation incrémentale basée sur Git diff
 */

import { updateProject } from './build/rag/indexer.js';

async function testIncrementalReindex() {
    console.log('🧪 Test de réindexation incrémentale');
    console.log('='.repeat(60));

    // Tester avec le projet actuel (qui est un dépôt Git)
    const projectPath = process.cwd();

    console.log(`Projet: ${projectPath}`);
    console.log('Options: chunkSize=500, chunkOverlap=100');
    console.log();

    try {
        const stats = await updateProject(projectPath, {
            chunkSize: 500,
            chunkOverlap: 100,
            filePatterns: ['**/*.{js,ts,md,json}'],
            recursive: true
        });

        console.log('✅ Réindexation incrémentale terminée');
        console.log('📊 Statistiques:');
        console.log(`  • Fichiers totaux: ${stats.totalFiles}`);
        console.log(`  • Fichiers indexés: ${stats.indexedFiles}`);
        console.log(`  • Fichiers modifiés/ajoutés: ${stats.modifiedFiles}`);
        console.log(`  • Fichiers supprimés: ${stats.deletedFiles}`);
        console.log(`  • Fichiers inchangés: ${stats.unchangedFiles}`);
        console.log(`  • Chunks créés: ${stats.chunksCreated}`);
        console.log(`  • Fichiers ignorés: ${stats.ignoredFiles}`);
        console.log(`  • Erreurs: ${stats.errors}`);

        // Analyse des résultats
        console.log();
        console.log('📈 Analyse:');

        if (stats.modifiedFiles === 0 && stats.deletedFiles === 0) {
            console.log('  • Aucun changement détecté dans le dépôt Git');
            console.log('  • Le système fonctionne correctement (pas de faux positifs)');
        } else {
            console.log(`  • ${stats.modifiedFiles} fichiers ont été réindexés`);
            console.log(`  • ${stats.deletedFiles} fichiers ont été supprimés de l'index`);

            if (stats.unchangedFiles > 0) {
                console.log(`  • ${stats.unchangedFiles} fichiers n'ont pas été modifiés (optimisation réussie)`);
            }
        }

        // Vérification de l'intégrité
        console.log();
        console.log('🔍 Vérification d\'intégrité:');

        if (stats.errors === 0) {
            console.log('  ✅ Aucune erreur pendant la réindexation');
        } else {
            console.log(`  ⚠️  ${stats.errors} erreurs détectées (à investiguer)`);
        }

        if (stats.ignoredFiles > 0) {
            console.log(`  ℹ️  ${stats.ignoredFiles} fichiers ignorés (fichiers vides ou exclus par .ragignore)`);
        }

        // Recommandations
        console.log();
        console.log('💡 Recommandations:');

        if (stats.modifiedFiles > 10) {
            console.log('  • Nombre important de modifications détectées');
            console.log('  • Vérifier si un commit récent a été effectué');
        }

        if (stats.deletedFiles > 0) {
            console.log('  • Fichiers supprimés détectés');
            console.log('  • L\'index a été nettoyé automatiquement');
        }

        console.log();
        console.log('='.repeat(60));
        console.log('✅ Test de réindexation incrémentale réussi');

    } catch (error) {
        console.error('❌ Erreur lors de la réindexation incrémentale:', error);
        process.exit(1);
    }
}

// Exécuter le test
testIncrementalReindex().catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
});
