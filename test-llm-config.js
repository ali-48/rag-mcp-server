#!/usr/bin/env node

/**
 * Test de la configuration LLM pour rag-mcp-server
 * 
 * Ce test vérifie :
 * 1. Chargement de la configuration LLM depuis rag-config.json
 * 2. Fonctionnement de RagConfigManager avec les nouvelles propriétés LLM
 * 3. Création du service LLM
 * 4. Fonctionnement du cache LLM
 */

import { getRagConfigManager, testRagConfig } from './build/config/rag-config.js';
import { getLlmCache } from './build/rag/llm-cache.js';
import { LlmService } from './build/rag/llm-service.js';

async function testLlmConfiguration() {
    console.log('🧪 Test de la configuration LLM...\n');

    let passed = 0;
    let failed = 0;

    // Test 1: Chargement de la configuration
    console.log('1. Test du chargement de la configuration...');
    try {
        const configManager = getRagConfigManager();
        const config = configManager.getConfig();

        if (!config.version) {
            throw new Error('Version manquante dans la configuration');
        }

        console.log(`   ✅ Configuration chargée: version ${config.version}`);
        console.log(`   📊 Dernière mise à jour: ${config.last_updated}`);
        passed++;
    } catch (error) {
        console.log(`   ❌ Erreur chargement configuration: ${error.message}`);
        failed++;
    }

    // Test 2: Configuration LLM
    console.log('\n2. Test de la configuration LLM...');
    try {
        const configManager = getRagConfigManager();

        // Vérifier les fournisseurs LLM
        const llmProviders = configManager.getConfig().llm_providers;
        if (!llmProviders) {
            throw new Error('Section llm_providers manquante');
        }

        const ollamaConfig = llmProviders.ollama;
        if (!ollamaConfig) {
            throw new Error('Configuration Ollama manquante dans llm_providers');
        }

        console.log(`   ✅ Fournisseurs LLM trouvés: ${Object.keys(llmProviders).join(', ')}`);
        console.log(`   📊 Modèles Ollama disponibles: ${ollamaConfig.models.slice(0, 3).join(', ')}...`);
        console.log(`   📊 Modèle par défaut: ${ollamaConfig.default_model}`);
        passed++;
    } catch (error) {
        console.log(`   ❌ Erreur configuration LLM: ${error.message}`);
        failed++;
    }

    // Test 3: Configuration de préparation
    console.log('\n3. Test de la configuration de préparation...');
    try {
        const configManager = getRagConfigManager();
        const preparationConfig = configManager.getPreparationConfig();

        if (!preparationConfig) {
            throw new Error('Configuration de préparation manquante');
        }

        console.log(`   ✅ Configuration de préparation chargée`);
        console.log(`   📊 Analyse LLM activée: ${preparationConfig.enable_llm_analysis}`);
        console.log(`   📊 Modèle LLM: ${preparationConfig.llm_model}`);
        console.log(`   📊 Tâches disponibles: ${preparationConfig.tasks.slice(0, 3).join(', ')}...`);
        console.log(`   📊 Cache activé: ${preparationConfig.cache_enabled} (TTL: ${preparationConfig.cache_ttl_seconds}s)`);
        passed++;
    } catch (error) {
        console.log(`   ❌ Erreur configuration préparation: ${error.message}`);
        failed++;
    }

    // Test 4: Service LLM
    console.log('\n4. Test du service LLM...');
    try {
        const llmService = new LlmService();

        // Vérifier que le service est créé
        if (!llmService) {
            throw new Error('Service LLM non créé');
        }

        console.log(`   ✅ Service LLM créé avec succès`);

        // Vérifier la configuration interne
        const configManager = getRagConfigManager();
        const preparationConfig = configManager.getPreparationConfig();

        if (preparationConfig.enable_llm_analysis) {
            console.log(`   📊 Analyse LLM activée dans la configuration`);
        } else {
            console.log(`   ⚠️ Analyse LLM désactivée dans la configuration`);
        }

        passed++;
    } catch (error) {
        console.log(`   ❌ Erreur service LLM: ${error.message}`);
        failed++;
    }

    // Test 5: Cache LLM
    console.log('\n5. Test du cache LLM...');
    try {
        const cache = getLlmCache();

        // Vérifier que le cache est créé
        if (!cache) {
            throw new Error('Cache LLM non créé');
        }

        const stats = cache.getStats();
        console.log(`   ✅ Cache LLM créé avec succès`);
        console.log(`   📊 Taille max: ${stats.maxSize} entrées`);
        console.log(`   📊 Taille actuelle: ${stats.size} entrées`);

        // Tester le cache
        const testContent = 'Ceci est un test de contenu';
        const testFilePath = '/test/file.js';
        const testTask = 'summarize';
        const testContentType = 'code';

        // Vérifier que le cache est vide au début
        const cachedBefore = cache.get(testContent, testFilePath, testTask, testContentType);
        if (cachedBefore) {
            console.log(`   ⚠️ Cache non vide au début (attendu: null)`);
        } else {
            console.log(`   ✅ Cache vide au début (comportement attendu)`);
        }

        // Ajouter au cache
        cache.set(testContent, testFilePath, testTask, 'Résumé de test', testContentType);
        console.log(`   ✅ Élément ajouté au cache`);

        // Récupérer du cache
        const cachedAfter = cache.get(testContent, testFilePath, testTask, testContentType);
        if (cachedAfter === 'Résumé de test') {
            console.log(`   ✅ Élément récupéré du cache avec succès`);
        } else {
            throw new Error(`Élément non trouvé dans le cache: ${cachedAfter}`);
        }

        // Vérifier les statistiques
        const statsAfter = cache.getStats();
        console.log(`   📊 Statistiques: ${statsAfter.hits} hits, ${statsAfter.misses} misses`);

        passed++;
    } catch (error) {
        console.log(`   ❌ Erreur cache LLM: ${error.message}`);
        failed++;
    }

    // Test 6: Configuration complète RAG
    console.log('\n6. Test de la configuration RAG complète...');
    try {
        const success = await testRagConfig();
        if (success) {
            console.log(`   ✅ Test de configuration RAG réussi`);
            passed++;
        } else {
            throw new Error('Test de configuration RAG échoué');
        }
    } catch (error) {
        console.log(`   ❌ Erreur test configuration RAG: ${error.message}`);
        failed++;
    }

    // Résumé
    console.log('\n' + '='.repeat(50));
    console.log('📊 RÉSUMÉ DES TESTS');
    console.log('='.repeat(50));
    console.log(`✅ Tests réussis: ${passed}`);
    console.log(`❌ Tests échoués: ${failed}`);
    console.log(`📈 Taux de réussite: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

    if (failed === 0) {
        console.log('\n🎉 Tous les tests de configuration LLM ont réussi !');
        return true;
    } else {
        console.log(`\n⚠️  ${failed} test(s) ont échoué. Vérifiez la configuration.`);
        return false;
    }
}

// Exécution du test
if (import.meta.url === `file://${process.argv[1]}`) {
    testLlmConfiguration().then(success => {
        if (success) {
            process.exit(0);
        } else {
            process.exit(1);
        }
    }).catch(error => {
        console.error('❌ Erreur lors de l\'exécution des tests:', error);
        process.exit(1);
    });
}

export { testLlmConfiguration };
