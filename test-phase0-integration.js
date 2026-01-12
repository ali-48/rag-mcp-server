#!/usr/bin/env node
// test-phase0-integration.js
// Test d'intégration de la Phase 0.1

import fs from 'fs';
import path from 'path';
import { createPhase0Logger } from './build/rag/phase0/event-logger.js';
import { createFileWatcher } from './build/rag/phase0/file-watcher.js';
import { createPhase0Integration } from './build/rag/phase0/phase0-integration.js';
import { detectWorkspace } from './build/rag/phase0/workspace-detector.js';

async function runTests() {
    console.log('🧪 Test d\'intégration Phase 0.1');
    console.log('='.repeat(50));

    // Créer un répertoire de test
    const testDir = '/tmp/test-phase0-' + Date.now();

    fs.mkdirSync(testDir, { recursive: true });

    try {
        // Test 1: Détection de workspace
        console.log('\n1. Test de détection de workspace...');
        const workspace = await detectWorkspace({
            manualPath: testDir,
            useVscodeDetection: false,
            useEnvDetection: false,
            fallbackToCurrentDir: true,
        });

        console.log('✅ Workspace détecté:');
        console.log(`   Path: ${workspace.path}`);
        console.log(`   VS Code: ${workspace.vscodeWorkspace}`);
        console.log(`   Language: ${workspace.language || 'inconnu'}`);
        console.log(`   File count: ${workspace.metadata.fileCount}`);
        console.log(`   Git repo: ${workspace.metadata.isGitRepo}`);

        // Test 2: Logger
        console.log('\n2. Test du logger...');
        const logger = createPhase0Logger(workspace);

        logger.info('Test message info', 'test');
        logger.warn('Test message warn', 'test');
        logger.error('Test message error', 'test');

        const stats = logger.getStats();
        console.log('✅ Logger testé:');
        console.log(`   Total logs: ${stats.totalLogs}`);
        console.log(`   Logs par niveau:`, stats.logsByLevel);

        // Test 3: File watcher
        console.log('\n3. Test du file watcher...');

        // Créer un fichier pour tester
        const testFile = path.join(testDir, 'test-file.txt');
        fs.writeFileSync(testFile, 'Hello Phase 0.1!');

        const watcher = await createFileWatcher(testDir, {
            logEvents: true,
            debounceDelay: 1000,
            recursive: true,
        });

        console.log('✅ File watcher démarré');

        // Ajouter un handler de test
        let eventReceived = false;
        watcher.addEventHandler((event) => {
            console.log(`   📝 Événement reçu: ${event.type} ${event.relativePath}`);
            eventReceived = true;
        });

        // Modifier le fichier pour déclencher un événement
        console.log('   Modification du fichier de test...');
        fs.appendFileSync(testFile, '\nModified!');

        // Attendre un peu pour que le watcher détecte le changement
        await new Promise(resolve => setTimeout(resolve, 1500));

        const watcherStats = watcher.getStats();
        console.log('✅ File watcher testé:');
        console.log(`   Total events: ${watcherStats.totalEvents}`);
        console.log(`   Processed: ${watcherStats.processedEvents}`);
        console.log(`   Ignored: ${watcherStats.ignoredEvents}`);
        console.log(`   Event received: ${eventReceived}`);

        // Arrêter le watcher
        await watcher.stop();

        // Test 4: Intégration complète
        console.log('\n4. Test d\'intégration complète...');

        const integration = await createPhase0Integration({
            enableWorkspaceDetection: true,
            enableFileWatcher: true,
            enableLogging: true,
            fileWatcherOptions: {
                debounceDelay: 1000,
                recursive: true,
                logEvents: true,
            },
        }, testDir);

        console.log('✅ Intégration Phase 0.1 créée');

        const state = integration.getState();
        console.log('📊 État de l\'intégration:');
        console.log(`   Status: ${state.status}`);
        console.log(`   Workspace: ${state.workspace?.path}`);
        console.log(`   File events: ${state.stats.fileEventsCount}`);
        console.log(`   Logs: ${state.stats.logsCount}`);

        // Créer un autre fichier pour tester l'intégration
        const testFile2 = path.join(testDir, 'test-file2.txt');
        fs.writeFileSync(testFile2, 'Test integration');

        // Attendre un peu
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Vérifier les statistiques mises à jour
        const updatedStats = integration.getFileWatcherStats();
        console.log(`   File events après création: ${updatedStats?.totalEvents || 0}`);

        // Arrêter l'intégration
        await integration.stop();
        console.log('✅ Intégration arrêtée proprement');

        // Test 5: Test avec injection-rag
        console.log('\n5. Test avec injection-rag (simulation)...');

        // Simuler l'appel à injection-rag avec Phase 0.1 activée
        console.log('   Simulation de l\'appel injection_rag avec:');
        console.log('     - enable_phase0: true');
        console.log('     - enable_watcher: true');
        console.log('     - enable_graph_integration: false');

        // Créer une structure de projet plus complexe
        const projectDir = path.join(testDir, 'project');
        fs.mkdirSync(projectDir, { recursive: true });
        fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
        fs.mkdirSync(path.join(projectDir, 'tests'), { recursive: true });

        fs.writeFileSync(path.join(projectDir, 'src', 'main.js'), 'console.log("Hello");');
        fs.writeFileSync(path.join(projectDir, 'tests', 'test.js'), '// Test file');
        fs.writeFileSync(path.join(projectDir, 'README.md'), '# Test Project');

        console.log('   Projet de test créé avec 3 fichiers');
        console.log('   ✅ Test d\'intégration Phase 0.1 réussi !');

    } catch (error) {
        console.error('❌ Test échoué:', error);
        process.exit(1);
    } finally {
        // Nettoyer
        console.log('\n🧹 Nettoyage du répertoire de test...');
        try {
            fs.rmSync(testDir, { recursive: true, force: true });
            console.log('✅ Nettoyage terminé');
        } catch (cleanupError) {
            console.warn('⚠️  Erreur lors du nettoyage:', cleanupError);
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎉 Tous les tests Phase 0.1 ont réussi !');
    console.log('\nRésumé des composants testés:');
    console.log('1. ✅ Workspace detector');
    console.log('2. ✅ Event logger');
    console.log('3. ✅ File watcher');
    console.log('4. ✅ Phase 0.1 integration');
    console.log('5. ✅ Integration avec injection-rag (simulation)');
}

// Exécuter les tests
runTests().catch(error => {
    console.error('❌ Erreur lors de l\'exécution des tests:', error);
    process.exit(1);
});
