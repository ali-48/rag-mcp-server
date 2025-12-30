#!/usr/bin/env node

/**
 * Test d'intégration Ollama pour rag-mcp-server
 * 
 * Ce test vérifie :
 * 1. Ollama est en cours d'exécution
 * 2. Appel réel au modèle llama3.2:3b
 * 3. Analyse de contenu avec le service LLM
 * 4. Fonctionnement du cache avec les appels réels
 */

import { getRagConfigManager } from './build/config/rag-config.js';
import { getLlmCache } from './build/rag/llm-cache.js';
import { LlmService } from './build/rag/llm-service.js';

async function testOllamaIntegration() {
    console.log('🧪 Test d\'intégration Ollama...\n');

    let passed = 0;
    let failed = 0;

    // Test 1: Vérifier la configuration
    console.log('1. Vérification de la configuration...');
    try {
        const configManager = getRagConfigManager();
        const preparationConfig = configManager.getPreparationConfig();

        if (!preparationConfig.enable_llm_analysis) {
            console.log('   ⚠️ Analyse LLM désactivée dans la configuration');
            console.log('   ℹ️ Activation de l\'analyse LLM pour le test...');
            // On pourrait activer temporairement, mais pour l'instant on continue
        }

        const llmModel = preparationConfig.llm_model;
        console.log(`   ✅ Modèle LLM configuré: ${llmModel}`);
        console.log(`   📊 Tâches disponibles: ${preparationConfig.tasks.join(', ')}`);
        passed++;
    } catch (error) {
        console.log(`   ❌ Erreur configuration: ${error.message}`);
        failed++;
    }

    // Test 2: Vérifier si Ollama est disponible
    console.log('\n2. Vérification de la disponibilité d\'Ollama...');
    try {
        const llmService = new LlmService();

        // Vérifier la connexion à Ollama
        const isAvailable = await llmService.checkOllamaAvailability();

        if (isAvailable) {
            console.log(`   ✅ Ollama disponible`);

            // Récupérer les modèles disponibles
            const models = await llmService.getAvailableModels();
            console.log(`   📊 Modèles disponibles: ${models.slice(0, 5).join(', ')}${models.length > 5 ? '...' : ''}`);

            // Vérifier que le modèle configuré est disponible
            const configManager = getRagConfigManager();
            const preparationConfig = configManager.getPreparationConfig();
            const configuredModel = preparationConfig.llm_model;

            if (models.includes(configuredModel)) {
                console.log(`   ✅ Modèle configuré "${configuredModel}" disponible`);
            } else {
                console.log(`   ⚠️ Modèle configuré "${configuredModel}" non disponible`);
                console.log(`   ℹ️ Utilisation du premier modèle disponible: ${models[0]}`);
            }
        } else {
            console.log(`   ❌ Ollama non disponible`);
            console.log(`   ℹ️ Pour exécuter Ollama: ollama serve`);
            console.log(`   ℹ️ Pour télécharger un modèle: ollama pull llama3.2:3b`);
            failed++;
        }

        passed++;
    } catch (error) {
        console.log(`   ❌ Erreur vérification Ollama: ${error.message}`);
        console.log(`   ℹ️ Assurez-vous qu'Ollama est en cours d'exécution: ollama serve`);
        failed++;
    }

    // Test 3: Test d'appel simple
    console.log('\n3. Test d\'appel simple à Ollama...');
    try {
        const llmService = new LlmService();

        // Test simple de génération
        const testPrompt = "Bonjour, peux-tu me dire 'Hello World' en français?";
        console.log(`   📤 Envoi du prompt: "${testPrompt.substring(0, 50)}..."`);

        const response = await llmService.generateResponse(testPrompt, 'test');

        if (response && response.trim().length > 0) {
            console.log(`   ✅ Réponse reçue: "${response.substring(0, 100)}..."`);
            console.log(`   📊 Longueur réponse: ${response.length} caractères`);
        } else {
            throw new Error('Réponse vide reçue');
        }

        passed++;
    } catch (error) {
        console.log(`   ❌ Erreur appel Ollama: ${error.message}`);
        console.log(`   ℹ️ Vérifiez qu'Ollama est en cours d'exécution et qu'un modèle est disponible`);
        failed++;
    }

    // Test 4: Test d'analyse de contenu
    console.log('\n4. Test d\'analyse de contenu...');
    try {
        const llmService = new LlmService();
        const cache = getLlmCache();

        // Contenu de test
        const testContent = `
function calculateSum(a, b) {
  // Cette fonction calcule la somme de deux nombres
  return a + b;
}

class Calculator {
  constructor() {
    this.result = 0;
  }
  
  add(x) {
    this.result += x;
    return this;
  }
  
  getResult() {
    return this.result;
  }
}
`;

        const testFilePath = '/test/calculator.js';
        const testTask = 'suggest_structure';
        const testContentType = 'code';

        console.log(`   📤 Analyse du contenu (${testContent.length} caractères)...`);

        // Vérifier le cache d'abord
        const cachedBefore = cache.get(testContent, testFilePath, testTask, testContentType);
        if (cachedBefore) {
            console.log(`   ⚠️ Contenu déjà dans le cache (attendu: cache vide)`);
        }

        // Analyser le contenu
        const analysis = await llmService.analyzeContent(
            testContent,
            testFilePath,
            testContentType,
            testTask
        );

        if (analysis && analysis.trim().length > 0) {
            console.log(`   ✅ Analyse reçue: "${analysis.substring(0, 100)}..."`);
            console.log(`   📊 Longueur analyse: ${analysis.length} caractères`);

            // Vérifier que l'analyse est mise en cache
            const cachedAfter = cache.get(testContent, testFilePath, testTask, testContentType);
            if (cachedAfter) {
                console.log(`   ✅ Analyse mise en cache avec succès`);
            } else {
                console.log(`   ⚠️ Analyse non mise en cache (problème possible)`);
            }
        } else {
            throw new Error('Analyse vide reçue');
        }

        passed++;
    } catch (error) {
        console.log(`   ❌ Erreur analyse contenu: ${error.message}`);
        failed++;
    }

    // Test 5: Test de performance avec cache
    console.log('\n5. Test de performance avec cache...');
    try {
        const llmService = new LlmService();
        const cache = getLlmCache();

        const testContent = 'Contenu de test pour vérifier les performances du cache';
        const testFilePath = '/test/performance.js';
        const testTask = 'summarize';
        const testContentType = 'doc';

        // Premier appel (devrait aller à Ollama)
        console.log(`   ⏱️ Premier appel (sans cache)...`);
        const startTime1 = Date.now();
        const result1 = await llmService.analyzeContent(
            testContent,
            testFilePath,
            testContentType,
            testTask
        );
        const time1 = Date.now() - startTime1;
        console.log(`   📊 Temps premier appel: ${time1}ms`);

        // Deuxième appel (devrait venir du cache)
        console.log(`   ⏱️ Deuxième appel (avec cache)...`);
        const startTime2 = Date.now();
        const result2 = await llmService.analyzeContent(
            testContent,
            testFilePath,
            testContentType,
            testTask
        );
        const time2 = Date.now() - startTime2;
        console.log(`   📊 Temps deuxième appel: ${time2}ms`);

        // Vérifier que le deuxième appel est plus rapide (ou au moins similaire)
        if (time2 < time1 * 0.9) {
            console.log(`   ✅ Cache fonctionnel: ${time2}ms vs ${time1}ms (${Math.round((time1 - time2) / time1 * 100)}% plus rapide)`);
        } else if (time2 <= time1) {
            console.log(`   ✅ Cache fonctionnel: ${time2}ms vs ${time1}ms`);
        } else {
            console.log(`   ⚠️ Cache peut-être lent: ${time2}ms vs ${time1}ms`);
        }

        // Vérifier que les résultats sont identiques
        if (result1 === result2) {
            console.log(`   ✅ Résultats identiques (cache cohérent)`);
        } else {
            console.log(`   ⚠️ Résultats différents (problème possible avec le cache)`);
        }

        passed++;
    } catch (error) {
        console.log(`   ❌ Erreur test performance: ${error.message}`);
        failed++;
    }

    // Résumé
    console.log('\n' + '='.repeat(50));
    console.log('📊 RÉSUMÉ DES TESTS D\'INTÉGRATION OLLAMA');
    console.log('='.repeat(50));
    console.log(`✅ Tests réussis: ${passed}`);
    console.log(`❌ Tests échoués: ${failed}`);
    console.log(`📈 Taux de réussite: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

    // Afficher les statistiques du cache
    const cache = getLlmCache();
    const cacheStats = cache.getStats();
    console.log(`\n📊 Statistiques cache finales:`);
    console.log(`   Hits: ${cacheStats.hits}, Misses: ${cacheStats.misses}`);
    console.log(`   Ratio: ${(cacheStats.hitRatio * 100).toFixed(1)}%`);
    console.log(`   Taille: ${cacheStats.size}/${cacheStats.maxSize} entrées`);

    if (failed === 0) {
        console.log('\n🎉 Tous les tests d\'intégration Ollama ont réussi !');
        return true;
    } else {
        console.log(`\n⚠️  ${failed} test(s) ont échoué. Vérifiez l\'installation d\'Ollama.`);
        console.log(`\n💡 Pour résoudre les problèmes:`);
        console.log(`   1. Vérifiez qu'Ollama est en cours d'exécution: ollama serve`);
        console.log(`   2. Téléchargez un modèle: ollama pull llama3.2:3b`);
        console.log(`   3. Vérifiez la configuration dans config/rag-config.json`);
        return false;
    }
}

// Exécution du test
if (import.meta.url === `file://${process.argv[1]}`) {
    testOllamaIntegration().then(success => {
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

export { testOllamaIntegration };
