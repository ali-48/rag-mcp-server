// Test réel avec le chunker intelligent

const fs = require('fs');
const path = require('path');

// Importer le chunker intelligent
const { IntelligentChunker } = require('/home/ali/Documents/Cline/MCP/rag-mcp-server/build/rag/phase0/chunker/chunker-intelligent.js');

// Configuration optimisée (plus conservatrice)
const OPTIMIZED_CONFIG = {
    granularity: 'logical',
    chunkTypes: ['function', 'class', 'method', 'interface', 'import', 'export'],
    maxChunkSize: 1500,
    minChunkSize: 100,
    chunkOverlap: 200,
    includeDocumentation: true,
    includeContext: true,
    calculateQualityScores: true,
    extractRelations: true,
    detailLevel: 'comprehensive',

    rules: {
        neverSplitFunctions: true,
        neverSplitClasses: false, // Permet de diviser les classes complexes
        neverMixCodeAndText: true,
        respectSemanticBoundaries: true,
        groupImports: true,
        groupExports: true,
        collapseLargeFunctions: true,
        collapseLargeClasses: true,
        preferFunctions: true,

        // Règles ajustées pour être plus conservatrices
        splitLargeClasses: true,
        maxMethodsPerChunk: 8, // Augmenté de 5 à 8
        groupByVisibility: false, // Désactivé pour simplifier
        extractDecorators: true,
        calculateComplexity: true
    }
};

// Configuration classique
const CLASSIC_CONFIG = {
    granularity: 'atomic',
    chunkTypes: ['function', 'class', 'method', 'interface', 'import', 'export'],
    maxChunkSize: 1000,
    minChunkSize: 50,
    chunkOverlap: 100,
    includeDocumentation: true,
    includeContext: false,
    calculateQualityScores: true,
    extractRelations: true,
    detailLevel: 'standard',

    rules: {
        neverSplitFunctions: true,
        neverSplitClasses: true, // Ne divise pas les classes
        neverMixCodeAndText: true,
        respectSemanticBoundaries: true,
        groupImports: true,
        groupExports: true,
        collapseLargeFunctions: true,
        collapseLargeClasses: true,
        preferFunctions: true
    }
};

async function runRealTest() {
    console.log('=== Test Réel du Chunking Intelligent ===\n');

    const testFiles = [
        { path: 'test-typescript.ts', language: 'typescript' },
        { path: 'test-python.py', language: 'python' },
        { path: 'test-javascript.js', language: 'javascript' }
    ];

    const results = [];

    for (const testFile of testFiles) {
        const filePath = path.join(__dirname, testFile.path);
        const content = fs.readFileSync(filePath, 'utf-8');

        console.log(`\n📁 Test sur ${testFile.path} (${testFile.language}):`);
        console.log('='.repeat(60));

        // Analyser la structure du fichier
        const structure = analyzeFileStructure(content, testFile.language);

        // Créer un parseResult simulé
        const parseResult = {
            filePath,
            language: testFile.language,
            sourceCode: content,
            ast: createMockAST(content, testFile.language)
        };

        // Tester le chunking classique
        const classicChunker = new IntelligentChunker(CLASSIC_CONFIG);
        const classicResult = await classicChunker.chunk(parseResult);

        // Tester le chunking optimisé
        const optimizedChunker = new IntelligentChunker(OPTIMIZED_CONFIG);
        const optimizedResult = await optimizedChunker.chunk(parseResult);

        // Analyser les résultats
        const analysis = analyzeResults(classicResult, optimizedResult, structure);

        results.push({
            file: testFile.path,
            language: testFile.language,
            structure,
            classicResult,
            optimizedResult,
            analysis
        });

        // Afficher les résultats
        displayRealResults(structure, classicResult, optimizedResult, analysis);
    }

    // Afficher le résumé global
    displayRealSummary(results);
}

function analyzeFileStructure(content, language) {
    const lines = content.split('\n');

    let functionCount = 0;
    let classCount = 0;
    let methodCount = 0;
    let propertyCount = 0;
    let importCount = 0;
    let exportCount = 0;
    let interfaceCount = 0;

    for (const line of lines) {
        const trimmed = line.trim();

        if (language === 'typescript' || language === 'javascript') {
            if (trimmed.startsWith('function ') || trimmed.startsWith('async function ')) functionCount++;
            if (trimmed.startsWith('class ')) classCount++;
            if (trimmed.includes('(') && trimmed.includes(')') && trimmed.includes('{') &&
                !trimmed.startsWith('function ') && !trimmed.startsWith('async function ')) methodCount++;
            if (trimmed.startsWith('import ')) importCount++;
            if (trimmed.startsWith('export ')) exportCount++;
            if (trimmed.startsWith('interface ')) interfaceCount++;
            if (trimmed.includes('=') && trimmed.includes(';') && !trimmed.includes('function')) propertyCount++;
        } else if (language === 'python') {
            if (trimmed.startsWith('def ') || trimmed.startsWith('async def ')) {
                if (trimmed.includes('def ') && trimmed.includes('(') && trimmed.includes(')')) {
                    if (trimmed.includes('self') || trimmed.includes('cls')) {
                        methodCount++;
                    } else {
                        functionCount++;
                    }
                }
            }
            if (trimmed.startsWith('class ')) classCount++;
            if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) importCount++;
            if (trimmed.includes('=') && !trimmed.includes('def ') && !trimmed.includes('class ')) propertyCount++;
        }
    }

    return {
        functionCount,
        classCount,
        methodCount,
        propertyCount,
        importCount,
        exportCount,
        interfaceCount,
        totalLines: lines.length
    };
}

function createMockAST(content, language) {
    // Créer un AST mock simple pour le test
    return {
        rootNode: {
            type: 'program',
            text: content,
            startIndex: 0,
            endIndex: content.length,
            startPosition: { row: 0, column: 0 },
            endPosition: { row: content.split('\n').length - 1, column: 0 },
            childCount: 0,
            child: () => null
        }
    };
}

function analyzeResults(classicResult, optimizedResult, structure) {
    const classicChunks = classicResult.chunks || [];
    const optimizedChunks = optimizedResult.chunks || [];

    // Analyser la distribution par type
    const classicByType = analyzeChunksByType(classicChunks);
    const optimizedByType = analyzeChunksByType(optimizedChunks);

    // Analyser la granularité
    const classicByGranularity = analyzeChunksByGranularity(classicChunks);
    const optimizedByGranularity = analyzeChunksByGranularity(optimizedChunks);

    // Calculer les améliorations
    const chunkReduction = classicChunks.length - optimizedChunks.length;
    const reductionPercentage = classicChunks.length > 0 ?
        (chunkReduction / classicChunks.length) * 100 : 0;

    // Analyser la qualité
    const classicQuality = classicResult.qualityMetrics || {};
    const optimizedQuality = optimizedResult.qualityMetrics || {};

    return {
        classicChunks: classicChunks.length,
        optimizedChunks: optimizedChunks.length,
        chunkReduction,
        reductionPercentage,
        classicByType,
        optimizedByType,
        classicByGranularity,
        optimizedByGranularity,
        classicQuality,
        optimizedQuality,
        qualityImprovement: calculateQualityImprovement(classicQuality, optimizedQuality)
    };
}

function analyzeChunksByType(chunks) {
    const byType = {};

    for (const chunk of chunks) {
        const type = chunk.type || 'unknown';
        byType[type] = (byType[type] || 0) + 1;
    }

    return byType;
}

function analyzeChunksByGranularity(chunks) {
    const byGranularity = { atomic: 0, logical: 0, section: 0 };

    for (const chunk of chunks) {
        const granularity = chunk.granularity || 'logical';
        byGranularity[granularity] = (byGranularity[granularity] || 0) + 1;
    }

    return byGranularity;
}

function calculateQualityImprovement(classicQuality, optimizedQuality) {
    const improvements = {};

    // Comparer les métriques de qualité
    const metrics = ['atomicRate', 'documentedRate', 'relatedRate', 'semanticCoherence'];

    for (const metric of metrics) {
        const classicValue = classicQuality[metric] || 0;
        const optimizedValue = optimizedQuality[metric] || 0;

        if (classicValue > 0) {
            improvements[metric] = {
                classic: classicValue,
                optimized: optimizedValue,
                improvement: optimizedValue - classicValue,
                improvementPercentage: ((optimizedValue - classicValue) / classicValue) * 100
            };
        }
    }

    return improvements;
}

function displayRealResults(structure, classicResult, optimizedResult, analysis) {
    console.log('📊 Structure du fichier:');
    console.log(`   Fonctions: ${structure.functionCount}`);
    console.log(`   Classes: ${structure.classCount}`);
    console.log(`   Méthodes: ${structure.methodCount}`);
    console.log(`   Propriétés: ${structure.propertyCount}`);
    console.log(`   Lignes totales: ${structure.totalLines}`);

    console.log('\n🧮 Chunking Classique:');
    console.log(`   Chunks totaux: ${analysis.classicChunks}`);
    console.log(`   Par type:`, JSON.stringify(analysis.classicByType, null, 2).split('\n').slice(1, -1).join('\n   '));
    console.log(`   Par granularité:`, JSON.stringify(analysis.classicByGranularity, null, 2).split('\n').slice(1, -1).join('\n   '));
    console.log(`   Qualité:`, JSON.stringify(analysis.classicQuality, null, 2).split('\n').slice(1, -1).join('\n   '));

    console.log('\n🚀 Chunking Optimisé:');
    console.log(`   Chunks totaux: ${analysis.optimizedChunks}`);
    console.log(`   Par type:`, JSON.stringify(analysis.optimizedByType, null, 2).split('\n').slice(1, -1).join('\n   '));
    console.log(`   Par granularité:`, JSON.stringify(analysis.optimizedByGranularity, null, 2).split('\n').slice(1, -1).join('\n   '));
    console.log(`   Qualité:`, JSON.stringify(analysis.optimizedQuality, null, 2).split('\n').slice(1, -1).join('\n   '));

    console.log('\n📈 Améliorations:');
    console.log(`   Réduction chunks: ${analysis.chunkReduction} (${analysis.reductionPercentage.toFixed(1)}%)`);

    // Afficher les améliorations de qualité
    console.log(`   Améliorations qualité:`);
    for (const [metric, data] of Object.entries(analysis.qualityImprovement)) {
        console.log(`     ${metric}: ${data.classic.toFixed(1)}% → ${data.optimized.toFixed(1)}% (${data.improvementPercentage.toFixed(1)}%)`);
    }

    // Évaluation
    console.log('\n🎯 ÉVALUATION:');

    if (analysis.chunkReduction > 0 && analysis.reductionPercentage >= 10) {
        console.log('✅ SUCCÈS: Réduction significative du nombre de chunks');
        if (analysis.qualityImprovement.atomicRate && analysis.qualityImprovement.atomicRate.improvement > 0) {
            console.log('   → Amélioration de l\'atomicité');
        }
        if (analysis.qualityImprovement.semanticCoherence && analysis.qualityImprovement.semanticCoherence.improvement > 0) {
            console.log('   → Amélioration de la cohérence sémantique');
        }
    } else if (analysis.chunkReduction > 0) {
        console.log('📊 MODESTE: Légère réduction du nombre de chunks');
    } else if (analysis.chunkReduction === 0) {
        console.log('⚖️  NEUTRE: Même nombre de chunks');
    } else {
        console.log('⚠️  À AMÉLIORER: Augmentation du nombre de chunks');
        console.log('   → Revoir les règles de division des classes');
        console.log('   → Ajuster les seuils de complexité');
    }

    // Afficher des exemples de chunks
    if (optimizedResult.chunks && optimizedResult.chunks.length > 0) {
        console.log('\n🔍 Exemples de chunks optimisés:');
        const sampleChunks = optimizedResult.chunks.slice(0, 3);

        for (let i = 0; i < sampleChunks.length; i++) {
            const chunk = sampleChunks[i];
            console.log(`\n   Chunk ${i + 1} (${chunk.type}/${chunk.granularity}):`);
            console.log(`     Tags: ${chunk.metadata.tags?.join(', ') || 'none'}`);
            console.log(`     Complexité: ${chunk.metadata.complexity || 'N/A'}`);
            console.log(`     Lignes: ${chunk.metadata.provenance.position.startLine}-${chunk.metadata.provenance.position.endLine}`);

            // Afficher un extrait du code
            const codePreview = chunk.content.code.substring(0, 100).replace(/\n/g, ' ');
            console.log(`     Extrait: ${codePreview}...`);
        }
    }
}

function displayRealSummary(results) {
    console.log('\n' + '='.repeat(60));
    console.log('📋 RÉSUMÉ GLOBAL DES TESTS RÉELS');
    console.log('='.repeat(60));

    let totalClassicChunks = 0;
    let totalOptimizedChunks = 0;
    let totalReduction = 0;
    let totalStructures = 0;
    let qualityImprovements = [];

    for (const result of results) {
        totalClassicChunks += result.analysis.classicChunks;
        totalOptimizedChunks += result.analysis.optimizedChunks;
        totalReduction += result.analysis.chunkReduction;
        totalStructures += result.structure.functionCount + result.structure.classCount;

        // Collecter les améliorations de qualité
        for (const [metric, data] of Object.entries(result.analysis.qualityImprovement)) {
            qualityImprovements.push({
                metric,
                improvement: data.improvementPercentage
            });
        }

        console.log(`\n${result.file}:`);
        console.log(`   Classique: ${result.analysis.classicChunks} chunks`);
        console.log(`   Optimisé: ${result.analysis.optimizedChunks} chunks`);
        console.log(`   Réduction: ${result.analysis.chunkReduction} (${result.analysis.reductionPercentage.toFixed(1)}%)`);
    }

    const overallReduction = totalClassicChunks - totalOptimizedChunks;
    const overallPercentage = totalClassicChunks > 0 ?
        (overallReduction / totalClassicChunks) * 100 : 0;

    // Calculer la moyenne des améliorations de qualité
    const avgQualityImprovement = qualityImprovements.length > 0 ?
        qualityImprovements.reduce((sum, item) => sum + item.improvement, 0) / qualityImprovements.length : 0;

    console.log('\n' + '='.repeat(60));
    console.log('🎯 RÉSULTATS FINAUX:');
    console.log('='.repeat(60));
    console.log(`Total chunks classique: ${totalClassicChunks}`);
    console.log(`Total chunks optimisé: ${totalOptimizedChunks}`);
    console.log(`Réduction totale: ${overallReduction} chunks (${overallPercentage.toFixed(1)}%)`);
    console.log(`Structures analysées: ${totalStructures}`);
    console.log(`Chunks/structure (classique): ${(totalClassicChunks / totalStructures).toFixed(2)}`);
    console.log(`Chunks/structure (optimisé): ${(totalOptimizedChunks / totalStructures).toFixed(2)}`);
    console.log(`Amélioration qualité moyenne: ${avgQualityImprovement.toFixed(1)}%`);

    // Recommandations basées sur les résultats
    console.log('\n💡 RECOMMANDATIONS FINALES:');

    if (overallPercentage >= 15 && avgQualityImprovement >= 5) {
        console.log('✅ EXCELLENT: Les optimisations sont TRÈS EFFICACES');
        console.log('   → Implémenter toutes les améliorations');
        console.log('   → Étendre à d\'autres langages');
    } else if (overallPercentage >= 5 || avgQualityImprovement >= 10) {
        console.log('👍 BON: Les optimisations sont EFFICACES');
        console.log('   → Implémenter les améliorations principales');
        console.log('   → Ajuster les paramètres pour plus d\'efficacité');
    } else if (overallPercentage > 0 || avgQualityImprovement > 0) {
        console.log('📊 MODESTE: Les optimisations sont MODESTES');
        console.log('   → Cibler les améliorations les plus impactantes');
        console.log('   → Revoir les règles de chunking hiérarchique');
    } else {
        console.log('⚠️  Les optimisations NÉCESSITENT DES AJUSTEMENTS');
        console.log('   → Revoir les règles de division des classes');
        console.log('   → Ajuster les seuils de complexité');
        console.log('   → Tester avec des configurations différentes');
    }

    console.log('\n🔧 Prochaines étapes:');
    console.log('1. Implémenter le chunking hiérarchique des classes');
    console.log('2. Améliorer l\'extraction des métadonnées');
    console.log('3. Optimiser la détection des types de nœuds');
    console.log('4. Tester sur des projets réels');
    console.log('5. Ajuster les paramètres basés sur les résultats');
}

// Exécuter le test
runRealTest().catch(console.error);
