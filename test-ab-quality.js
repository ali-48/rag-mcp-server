#!/usr/bin/env node

/**
 * Script de tests A/B pour évaluer la qualité des résultats RAG
 * Compare les résultats avec et sans Phase 0 (pré-traitement intelligent)
 */

import { writeFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const TEST_QUERIES = [
    {
        query: "Comment utiliser useState dans React?",
        expectedTypes: ['code', 'doc'],
        expectedKeywords: ['useState', 'React', 'hook', 'function']
    },
    {
        query: "Configuration de la base de données PostgreSQL",
        expectedTypes: ['config', 'doc'],
        expectedKeywords: ['PostgreSQL', 'database', 'config', 'connection']
    },
    {
        query: "Fonction pour parser du JSON en TypeScript",
        expectedTypes: ['code'],
        expectedKeywords: ['JSON', 'parse', 'TypeScript', 'interface']
    },
    {
        query: "Documentation sur les embeddings sémantiques",
        expectedTypes: ['doc'],
        expectedKeywords: ['embedding', 'semantic', 'vector', 'similarity']
    },
    {
        query: "Middleware d'authentification avec JWT",
        expectedTypes: ['code', 'doc'],
        expectedKeywords: ['authentication', 'JWT', 'middleware', 'token']
    }
];

const TEST_PROJECTS = [
    '/home/ali/Documents/Cline/MCP/rag-mcp-server',
    '/home/ali/Documents/Cline/MCP/e2b-mcp-server'
];

// Fonction pour charger dynamiquement les modules
async function loadRAGModules() {
    const { setEmbeddingProvider, semanticSearch, hybridSearch } = await import('./build/rag/vector-store.js');
    const { indexProject } = await import('./build/tools/rag/index-project.js');

    return { setEmbeddingProvider, semanticSearch, hybridSearch, indexProject };
}

// Fonction pour évaluer la pertinence d'un résultat
function evaluateRelevance(result, query, expectedTypes, expectedKeywords) {
    let score = 0;
    const maxScore = 100;

    // 1. Score basé sur le type de contenu (30 points)
    if (result.metadata.contentType && expectedTypes.includes(result.metadata.contentType)) {
        score += 30;
    }

    // 2. Score basé sur les mots-clés dans le contenu (40 points)
    const content = result.content.toLowerCase();
    const queryLower = query.toLowerCase();

    // Vérifier la présence des mots-clés attendus
    expectedKeywords.forEach(keyword => {
        if (content.includes(keyword.toLowerCase())) {
            score += 10; // 10 points par mot-clé trouvé, max 40
        }
    });

    // 3. Score basé sur la similarité sémantique (20 points)
    // Normaliser le score de similarité (0-1) vers 0-20 points
    score += Math.min(20, result.score * 20);

    // 4. Bonus pour les fichiers récents (10 points)
    if (result.metadata.updatedAt) {
        const daysOld = (Date.now() - result.metadata.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysOld < 30) {
            score += 10; // Fichiers de moins de 30 jours
        } else if (daysOld < 90) {
            score += 5; // Fichiers de moins de 90 jours
        }
    }

    return Math.min(maxScore, score);
}

// Fonction pour exécuter un test A/B
async function runABTest(queryConfig, usePhase0 = true) {
    const { setEmbeddingProvider, semanticSearch, hybridSearch } = await loadRAGModules();

    // Configurer le fournisseur d'embeddings
    setEmbeddingProvider('fake'); // Utiliser fake pour les tests

    const results = [];

    for (const project of TEST_PROJECTS) {
        try {
            // Recherche sémantique avec différentes configurations
            const searchOptions = {
                projectFilter: project,
                limit: 5,
                dynamicThreshold: true,
                enableReranking: usePhase0,
                contentTypeFilter: queryConfig.expectedTypes
            };

            // Exécuter la recherche
            const searchResults = await semanticSearch(queryConfig.query, searchOptions);

            // Évaluer chaque résultat
            const evaluatedResults = searchResults.map(result => ({
                ...result,
                relevanceScore: evaluateRelevance(result, queryConfig.query, queryConfig.expectedTypes, queryConfig.expectedKeywords),
                project
            }));

            results.push(...evaluatedResults);

        } catch (error) {
            console.error(`Erreur lors de la recherche pour le projet ${project}:`, error.message);
        }
    }

    // Trier par score de pertinence
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return {
        query: queryConfig.query,
        totalResults: results.length,
        topResults: results.slice(0, 10),
        averageRelevance: results.length > 0
            ? results.reduce((sum, r) => sum + r.relevanceScore, 0) / results.length
            : 0,
        maxRelevance: results.length > 0 ? Math.max(...results.map(r => r.relevanceScore)) : 0
    };
}

// Fonction pour générer un rapport
function generateReport(phase0Results, baselineResults) {
    const report = {
        timestamp: new Date().toISOString(),
        totalQueries: TEST_QUERIES.length,
        metrics: {
            phase0: {
                averageRelevance: 0,
                maxRelevance: 0,
                totalResults: 0
            },
            baseline: {
                averageRelevance: 0,
                maxRelevance: 0,
                totalResults: 0
            },
            improvement: {
                relevanceGain: 0,
                resultCountGain: 0
            }
        },
        detailedResults: []
    };

    // Calculer les métriques agrégées
    TEST_QUERIES.forEach((query, index) => {
        const phase0 = phase0Results[index];
        const baseline = baselineResults[index];

        report.detailedResults.push({
            query: query.query,
            phase0: {
                averageRelevance: phase0.averageRelevance,
                maxRelevance: phase0.maxRelevance,
                totalResults: phase0.totalResults
            },
            baseline: {
                averageRelevance: baseline.averageRelevance,
                maxRelevance: baseline.maxRelevance,
                totalResults: baseline.totalResults
            },
            improvement: {
                relevanceGain: phase0.averageRelevance - baseline.averageRelevance,
                resultCountGain: phase0.totalResults - baseline.totalResults
            }
        });

        // Agrégation
        report.metrics.phase0.averageRelevance += phase0.averageRelevance;
        report.metrics.phase0.maxRelevance += phase0.maxRelevance;
        report.metrics.phase0.totalResults += phase0.totalResults;

        report.metrics.baseline.averageRelevance += baseline.averageRelevance;
        report.metrics.baseline.maxRelevance += baseline.maxRelevance;
        report.metrics.baseline.totalResults += baseline.totalResults;
    });

    // Moyennes
    report.metrics.phase0.averageRelevance /= TEST_QUERIES.length;
    report.metrics.phase0.maxRelevance /= TEST_QUERIES.length;

    report.metrics.baseline.averageRelevance /= TEST_QUERIES.length;
    report.metrics.baseline.maxRelevance /= TEST_QUERIES.length;

    // Améliorations
    report.metrics.improvement.relevanceGain =
        report.metrics.phase0.averageRelevance - report.metrics.baseline.averageRelevance;
    report.metrics.improvement.resultCountGain =
        report.metrics.phase0.totalResults - report.metrics.baseline.totalResults;

    return report;
}

// Fonction pour afficher le rapport
function displayReport(report) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 RAPPORT DE TESTS A/B - QUALITÉ DES RÉSULTATS RAG');
    console.log('='.repeat(80));
    console.log(`Date: ${new Date(report.timestamp).toLocaleString()}`);
    console.log(`Nombre de requêtes testées: ${report.totalQueries}`);
    console.log('\n' + '-'.repeat(80));

    console.log('\n📈 MÉTRIQUES GLOBALES:');
    console.log('Phase 0 (avec pré-traitement intelligent):');
    console.log(`  • Pertinence moyenne: ${report.metrics.phase0.averageRelevance.toFixed(2)}/100`);
    console.log(`  • Pertinence max moyenne: ${report.metrics.phase0.maxRelevance.toFixed(2)}/100`);
    console.log(`  • Total résultats: ${report.metrics.phase0.totalResults}`);

    console.log('\nBaseline (sans Phase 0):');
    console.log(`  • Pertinence moyenne: ${report.metrics.baseline.averageRelevance.toFixed(2)}/100`);
    console.log(`  • Pertinence max moyenne: ${report.metrics.baseline.maxRelevance.toFixed(2)}/100`);
    console.log(`  • Total résultats: ${report.metrics.baseline.totalResults}`);

    console.log('\n🚀 AMÉLIORATIONS:');
    console.log(`  • Gain de pertinence: ${report.metrics.improvement.relevanceGain.toFixed(2)} points`);
    console.log(`  • Gain de résultats: ${report.metrics.improvement.resultCountGain} résultats`);

    const relevanceImprovementPercent = report.metrics.baseline.averageRelevance > 0
        ? (report.metrics.improvement.relevanceGain / report.metrics.baseline.averageRelevance * 100).toFixed(1)
        : 'N/A';

    console.log(`  • Amélioration relative: ${relevanceImprovementPercent}%`);

    console.log('\n' + '-'.repeat(80));
    console.log('\n🔍 RÉSULTATS DÉTAILLÉS PAR REQUÊTE:\n');

    report.detailedResults.forEach((result, index) => {
        console.log(`${index + 1}. "${result.query}"`);
        console.log(`   Phase 0: ${result.phase0.averageRelevance.toFixed(2)}/100 (${result.phase0.totalResults} résultats)`);
        console.log(`   Baseline: ${result.baseline.averageRelevance.toFixed(2)}/100 (${result.baseline.totalResults} résultats)`);
        console.log(`   Amélioration: ${result.improvement.relevanceGain.toFixed(2)} points`);
        console.log();
    });

    console.log('='.repeat(80));

    // Recommandations basées sur les résultats
    console.log('\n💡 RECOMMANDATIONS:');

    if (report.metrics.improvement.relevanceGain > 10) {
        console.log('✅ Phase 0 apporte une amélioration SIGNIFICATIVE de la qualité des résultats.');
        console.log('   Recommandation: Activer Phase 0 en production.');
    } else if (report.metrics.improvement.relevanceGain > 0) {
        console.log('⚠️  Phase 0 apporte une amélioration MODESTE de la qualité.');
        console.log('   Recommandation: Évaluer le coût/performance avant activation en production.');
    } else {
        console.log('❌ Phase 0 n\'apporte pas d\'amélioration mesurable.');
        console.log('   Recommandation: Revoir l\'implémentation de Phase 0.');
    }

    console.log('\n' + '='.repeat(80));
}

// Fonction principale
async function main() {
    console.log('🚀 Démarrage des tests A/B de qualité RAG...');
    console.log(`Nombre de requêtes de test: ${TEST_QUERIES.length}`);
    console.log(`Projets testés: ${TEST_PROJECTS.length}`);

    const phase0Results = [];
    const baselineResults = [];

    // Exécuter les tests avec Phase 0
    console.log('\n🔧 Exécution des tests AVEC Phase 0 (pré-traitement intelligent)...');
    for (let i = 0; i < TEST_QUERIES.length; i++) {
        console.log(`  Requête ${i + 1}/${TEST_QUERIES.length}: "${TEST_QUERIES[i].query}"`);
        const result = await runABTest(TEST_QUERIES[i], true);
        phase0Results.push(result);
    }

    // Exécuter les tests sans Phase 0 (baseline)
    console.log('\n📊 Exécution des tests SANS Phase 0 (baseline)...');
    for (let i = 0; i < TEST_QUERIES.length; i++) {
        console.log(`  Requête ${i + 1}/${TEST_QUERIES.length}: "${TEST_QUERIES[i].query}"`);
        const result = await runABTest(TEST_QUERIES[i], false);
        baselineResults.push(result);
    }

    // Générer et afficher le rapport
    console.log('\n📈 Génération du rapport...');
    const report = generateReport(phase0Results, baselineResults);
    displayReport(report);

    // Sauvegarder le rapport dans un fichier
    const reportFile = 'rag-ab-test-report.json';
    writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`\n💾 Rapport sauvegardé dans: ${reportFile}`);

    // Sauvegarder également en format texte lisible
    const textReportFile = 'rag-ab-test-report.txt';
    const originalConsoleLog = console.log;
    const logMessages = [];

    console.log = function (...args) {
        logMessages.push(args.join(' '));
    };

    displayReport(report);
    console.log = originalConsoleLog;

    writeFileSync(textReportFile, logMessages.join('\n'));
    console.log(`📝 Rapport texte sauvegardé dans: ${textReportFile}`);

    console.log('\n✅ Tests A/B terminés avec succès!');
}

// Exécuter le script principal
main().catch(error => {
    console.error('❌ Erreur lors des tests A/B:', error);
    process.exit(1);
});
