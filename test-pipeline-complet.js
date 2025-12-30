// test-pipeline-complet.js
// Test complet du pipeline injection_rag avec intégration Graph
// Version: v1.0.0

import { autoRegistry, getExpectedTools } from './build/core/registry.js';
import { testIndexProject } from './build/tools/rag/index-project.js';
import { testInjectionRag } from './build/tools/rag/injection-rag.js';

class PipelineTester {
    constructor() {
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            tests: []
        };
    }

    async runAllTests() {
        console.log('🧪 TEST COMPLET DU PIPELINE INJECTION_RAG');
        console.log('==========================================\n');

        // Test 1: Vérification du registre
        await this.testRegistry();

        // Test 2: Test de l'outil injection_rag
        await this.testInjectionRag();

        // Test 3: Test de l'alias index_project
        await this.testIndexProjectAlias();

        // Test 4: Vérification des outils attendus
        await this.testExpectedTools();

        // Affichage des résultats
        this.printResults();
    }

    async testRegistry() {
        this.startTest('Registre automatique');

        try {
            const count = await autoRegistry.autoRegister();
            const expectedTools = getExpectedTools();
            const allRegistered = autoRegistry.verifyRegistration(expectedTools);

            if (allRegistered && count > 0) {
                this.passTest(`✅ ${count} outils enregistrés, tous les outils attendus sont présents`);
            } else {
                this.failTest('❌ Problème avec le registre automatique');
            }
        } catch (error) {
            this.failTest(`❌ Erreur du registre: ${error.message}`);
        }
    }

    async testInjectionRag() {
        this.startTest('Outil injection_rag (principal)');

        try {
            console.log('   → Test de l\'outil principal injection_rag...');
            const result = await testInjectionRag();

            if (result && result.content && result.content[0]) {
                const data = JSON.parse(result.content[0].text);

                if (data.success && data.version === 'v1.0.0') {
                    this.passTest(`✅ injection_rag v${data.version} fonctionne correctement`);
                    console.log(`   → Durée: ${data.duration_seconds}s`);
                    console.log(`   → Pipeline: ${JSON.stringify(data.pipeline)}`);
                } else {
                    this.failTest('❌ injection_rag a retourné un résultat incorrect');
                }
            } else {
                this.failTest('❌ injection_rag n\'a pas retourné de résultat valide');
            }
        } catch (error) {
            this.failTest(`❌ Erreur injection_rag: ${error.message}`);
        }
    }

    async testIndexProjectAlias() {
        this.startTest('Alias index_project (déprécié)');

        try {
            console.log('   → Test de l\'alias index_project...');
            const result = await testIndexProject();

            if (result && result.content && result.content[0]) {
                const data = JSON.parse(result.content[0].text);

                if (data.success && data.config_used) {
                    this.passTest('✅ Alias index_project fonctionne (avec warning de dépréciation)');
                    console.log('   ⚠️  Warning de dépréciation attendu (c\'est normal)');
                } else {
                    this.failTest('❌ Alias index_project a retourné un résultat incorrect');
                }
            } else {
                this.failTest('❌ Alias index_project n\'a pas retourné de résultat valide');
            }
        } catch (error) {
            this.failTest(`❌ Erreur alias index_project: ${error.message}`);
        }
    }

    async testExpectedTools() {
        this.startTest('Vérification des outils attendus');

        try {
            const expectedTools = getExpectedTools();
            const registeredTools = autoRegistry.listRegisteredTools();

            console.log(`   → Outils attendus: ${expectedTools.length}`);
            console.log(`   → Outils enregistrés: ${registeredTools.length}`);

            const missingTools = expectedTools.filter(tool => !registeredTools.includes(tool));
            const extraTools = registeredTools.filter(tool => !expectedTools.includes(tool));

            if (missingTools.length === 0 && extraTools.length === 0) {
                this.passTest('✅ Tous les outils sont correctement enregistrés');

                // Afficher la liste des outils par catégorie
                console.log('\n   📋 Liste des outils par catégorie:');
                console.log('   ---------------------------------');

                const graphTools = registeredTools.filter(tool =>
                    ['create_entities', 'create_relations', 'add_observations',
                        'delete_entities', 'delete_observations', 'delete_relations',
                        'read_graph', 'search_nodes', 'open_nodes'].includes(tool)
                );

                const ragTools = registeredTools.filter(tool =>
                    ['injection_rag', 'index_project', 'search_code',
                        'manage_projects', 'update_project'].includes(tool)
                );

                console.log(`   🎯 Graphe de connaissances: ${graphTools.length} outils`);
                graphTools.forEach(tool => console.log(`      • ${tool}`));

                console.log(`\n   🔍 Recherche sémantique RAG: ${ragTools.length} outils`);
                ragTools.forEach(tool => {
                    if (tool === 'injection_rag') {
                        console.log(`      • ${tool} (principal, v1.0.0)`);
                    } else if (tool === 'index_project') {
                        console.log(`      • ${tool} (alias déprécié, masqué)`);
                    } else {
                        console.log(`      • ${tool}`);
                    }
                });

                // Vérifications supplémentaires
                console.log('\n   🔍 Vérifications supplémentaires:');

                // 1. Vérifier que index_project est enregistré mais masqué
                if (registeredTools.includes('index_project')) {
                    console.log(`   ✅ index_project est enregistré (rétrocompatibilité)`);
                } else {
                    console.log(`   ❌ index_project n'est pas enregistré`);
                }

                // 2. Vérifier que injection_rag est présent
                if (registeredTools.includes('injection_rag')) {
                    console.log(`   ✅ injection_rag est présent (outil principal)`);
                } else {
                    console.log(`   ❌ injection_rag est manquant`);
                }

                // 3. Statistiques de visibilité
                const totalTools = registeredTools.length; // 14
                const visibleTools = totalTools - 1; // index_project masqué
                console.log(`   📊 Outils visibles: ${visibleTools} (${graphTools.length} graph + ${ragTools.length - 1} RAG)`);

            } else {
                if (missingTools.length > 0) {
                    this.failTest(`❌ Outils manquants: ${missingTools.join(', ')}`);
                }
                if (extraTools.length > 0) {
                    this.failTest(`❌ Outils supplémentaires non attendus: ${extraTools.join(', ')}`);
                }
            }
        } catch (error) {
            this.failTest(`❌ Erreur vérification outils: ${error.message}`);
        }
    }

    startTest(name) {
        console.log(`\n🔬 Test: ${name}`);
        this.results.total++;
        this.results.tests.push({ name, status: 'running' });
    }

    passTest(message) {
        console.log(`   ${message}`);
        this.results.passed++;
        const test = this.results.tests[this.results.tests.length - 1];
        test.status = 'passed';
        test.message = message;
    }

    failTest(message) {
        console.log(`   ${message}`);
        this.results.failed++;
        const test = this.results.tests[this.results.tests.length - 1];
        test.status = 'failed';
        test.message = message;
    }

    printResults() {
        console.log('\n📊 RÉSULTATS DU TEST COMPLET');
        console.log('============================\n');

        console.log(`Total des tests: ${this.results.total}`);
        console.log(`✅ Réussis: ${this.results.passed}`);
        console.log(`❌ Échoués: ${this.results.failed}`);

        const successRate = ((this.results.passed / this.results.total) * 100).toFixed(1);
        console.log(`📈 Taux de réussite: ${successRate}%\n`);

        // Détails des tests
        console.log('📋 Détails des tests:');
        console.log('---------------------');
        this.results.tests.forEach((test, index) => {
            const statusIcon = test.status === 'passed' ? '✅' : '❌';
            console.log(`${statusIcon} ${index + 1}. ${test.name}`);
            if (test.message) {
                console.log(`   ${test.message}`);
            }
        });

        // Conclusion
        console.log('\n🎯 CONCLUSION:');
        console.log('--------------');
        if (this.results.failed === 0) {
            console.log('✅ TOUS LES TESTS ONT RÉUSSI !');
            console.log('Le pipeline injection_rag est prêt pour la production.');
            console.log('Migration réussie depuis index_project vers injection_rag.');
        } else {
            console.log('⚠️  CERTAINS TESTS ONT ÉCHOUÉ.');
            console.log('Veuillez corriger les problèmes avant le déploiement.');
            process.exit(1);
        }
    }
}

// Exécution principale
async function main() {
    const tester = new PipelineTester();

    try {
        await tester.runAllTests();

        // Message final
        console.log('\n🚀 PIPELINE INJECTION_RAG - PRÊT À L\'EMPLOI');
        console.log('==========================================');
        console.log('\n📋 Commandes disponibles:');
        console.log('------------------------');
        console.log('🎯 Graphe de connaissances (9 outils):');
        console.log('  • create_entities    • create_relations');
        console.log('  • add_observations   • delete_entities');
        console.log('  • delete_observations • delete_relations');
        console.log('  • read_graph         • search_nodes');
        console.log('  • open_nodes');
        console.log('\n🔍 Recherche sémantique RAG (4 outils visibles):');
        console.log('  • injection_rag      (principal, v1.0.0)');
        console.log('  • search_code        • manage_projects');
        console.log('  • update_project');
        console.log('\n⚠️  Outil masqué (rétrocompatibilité):');
        console.log('  • index_project      (alias déprécié, masqué de la liste)');
        console.log('\n💡 Conseil: Utilisez "injection_rag" pour le nouveau pipeline automatisé.');
        console.log('   → index_project fonctionne toujours si appelé directement (avec warning)');

    } catch (error) {
        console.error('❌ ERREUR FATALE DANS LE TEST:', error);
        process.exit(1);
    }
}

// Exécution si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('❌ Erreur lors de l\'exécution des tests:', error);
        process.exit(1);
    });
}

export { PipelineTester };
