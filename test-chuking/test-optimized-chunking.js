// Test pour évaluer les améliorations du chunking intelligent

const fs = require('fs');
const path = require('path');

// Importer le chunker intelligent (version compilée)
const { IntelligentChunker } = require('/home/ali/Documents/Cline/MCP/rag-mcp-server/build/rag/phase0/chunker/chunker-intelligent.js');

// Configuration optimisée pour le test
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

        // Nouvelles règles
        splitLargeClasses: true,
        maxMethodsPerChunk: 5,
        groupByVisibility: true,
        extractDecorators: true,
        calculateComplexity: true
    }
};

// Configuration classique (avant optimisation)
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

async function runTest() {
    console.log('=== Test d\'Optimisation du Chunking Intelligent ===\n');

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

        // Simuler le chunking classique
        const classicEstimate = simulateClassicChunking(content, testFile.language);

        // Simuler le chunking optimisé
        const optimizedEstimate = simulateOptimizedChunking(content, testFile.language);

        // Calculer les améliorations
        const improvement = calculateImprovement(classicEstimate, optimizedEstimate, structure);

        results.push({
            file: testFile.path,
            language: testFile.language,
            structure,
            classicEstimate,
            optimizedEstimate,
            improvement
        });

        // Afficher les résultats
        displayResults(structure, classicEstimate, optimizedEstimate, improvement);
    }

    // Afficher le résumé global
    displaySummary(results);
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

function simulateClassicChunking(content, language) {
    // Simulation du chunking classique (1 fonction = 1 chunk, 1 classe = 1 chunk)
    const structure = analyzeFileStructure(content, language);

    let chunkCount = 0;

    // Chunks pour les fonctions
    chunkCount += structure.functionCount;

    // Chunks pour les classes (1 par classe)
    chunkCount += structure.classCount;

    // Chunks pour les interfaces
    chunkCount += structure.interfaceCount;

    // Chunks pour les imports (groupés)
    if (structure.importCount > 0) chunkCount += 1;

    // Chunks pour les exports (groupés)
    if (structure.exportCount > 0) chunkCount += 1;

    // Chunks pour le code restant (estimation)
    const remainingLines = structure.totalLines -
        (structure.functionCount * 10 + structure.classCount * 20 +
            structure.interfaceCount * 5 + structure.importCount * 2 +
            structure.exportCount * 2);

    if (remainingLines > 0) {
        chunkCount += Math.ceil(remainingLines / 30); // ~30 lignes par chunk
    }

    return {
        chunkCount,
        atomicChunks: structure.functionCount + structure.classCount + structure.interfaceCount,
        logicalChunks: chunkCount - (structure.functionCount + structure.classCount + structure.interfaceCount),
        estimatedTokens: Math.ceil(content.length / 4)
    };
}

function simulateOptimizedChunking(content, language) {
    // Simulation du chunking optimisé (1 fonction = 1 chunk, 1 classe = N chunks)
    const structure = analyzeFileStructure(content, language);

    let chunkCount = 0;

    // Chunks pour les fonctions (1 par fonction)
    chunkCount += structure.functionCount;

    // Chunks pour les classes (divisées si complexes)
    for (let i = 0; i < structure.classCount; i++) {
        // Estimation : classes avec méthodes divisées en chunks
        const methodsPerClass = Math.ceil(structure.methodCount / Math.max(structure.classCount, 1));

        if (methodsPerClass <= 3 && structure.propertyCount <= 5) {
            // Petite classe : 1 chunk
            chunkCount += 1;
        } else {
            // Grande classe : définition + groupes de méthodes + propriétés
            chunkCount += 1; // Définition
            chunkCount += Math.ceil(methodsPerClass / 3); // Groupes de méthodes (max 3 par chunk)
            if (structure.propertyCount > 0) {
                chunkCount += 1; // Groupe de propriétés
            }
        }
    }

    // Chunks pour les interfaces (1 par interface)
    chunkCount += structure.interfaceCount;

    // Chunks pour les imports (groupés)
    if (structure.importCount > 0) chunkCount += 1;

    // Chunks pour les exports (groupés)
    if (structure.exportCount > 0) chunkCount += 1;

    // Chunks pour les méthodes isolées (hors classes)
    const standaloneMethods = structure.methodCount -
        (structure.classCount * Math.ceil(structure.methodCount / Math.max(structure.classCount, 1)));

    if (standaloneMethods > 0) {
        chunkCount += Math.ceil(standaloneMethods / 3); // Groupes de 3 méthodes
    }

    return {
        chunkCount,
        atomicChunks: structure.functionCount + structure.interfaceCount,
        hierarchicalChunks: chunkCount - (structure.functionCount + structure.interfaceCount),
        estimatedTokens: Math.ceil(content.length / 4),
        classChunks: structure.classCount > 0 ?
            `1 classe = ${Math.ceil(chunkCount / Math.max(structure.classCount, 1))} chunks en moyenne` : 'N/A'
    };
}

function calculateImprovement(classic, optimized, structure) {
    const chunkReduction = classic.chunkCount - optimized.chunkCount;
    const reductionPercentage = classic.chunkCount > 0 ?
        (chunkReduction / classic.chunkCount) * 100 : 0;

    const atomicityImprovement = optimized.atomicChunks > classic.atomicChunks ?
        optimized.atomicChunks - classic.atomicChunks : 0;

    return {
        chunkReduction,
        reductionPercentage,
        atomicityImprovement,
        efficiency: classic.chunkCount > 0 ?
            optimized.chunkCount / classic.chunkCount : 1,
        chunksPerStructure: {
            classic: structure.functionCount + structure.classCount > 0 ?
                classic.chunkCount / (structure.functionCount + structure.classCount) : 0,
            optimized: structure.functionCount + structure.classCount > 0 ?
                optimized.chunkCount / (structure.functionCount + structure.classCount) : 0
        }
    };
}

function displayResults(structure, classic, optimized, improvement) {
    console.log('📊 Structure du fichier:');
    console.log(`   Fonctions: ${structure.functionCount}`);
    console.log(`   Classes: ${structure.classCount}`);
    console.log(`   Méthodes: ${structure.methodCount}`);
    console.log(`   Propriétés: ${structure.propertyCount}`);
    console.log(`   Imports: ${structure.importCount}`);
    console.log(`   Exports: ${structure.exportCount}`);
    console.log(`   Interfaces: ${structure.interfaceCount}`);
    console.log(`   Lignes totales: ${structure.totalLines}`);

    console.log('\n🧮 Chunking Classique:');
    console.log(`   Chunks totaux: ${classic.chunkCount}`);
    console.log(`   Chunks atomiques: ${classic.atomicChunks}`);
    console.log(`   Chunks logiques: ${classic.logicalChunks}`);
    console.log(`   Tokens estimés: ${classic.estimatedTokens}`);

    console.log('\n🚀 Chunking Optimisé:');
    console.log(`   Chunks totaux: ${optimized.chunkCount}`);
    console.log(`   Chunks atomiques: ${optimized.atomicChunks}`);
    console.log(`   Chunks hiérarchiques: ${optimized.hierarchicalChunks}`);
    console.log(`   Tokens estimés: ${optimized.estimatedTokens}`);
    if (optimized.classChunks) {
        console.log(`   ${optimized.classChunks}`);
    }

    console.log('\n📈 Améliorations:');
    console.log(`   Réduction chunks: ${improvement.chunkReduction} (${improvement.reductionPercentage.toFixed(1)}%)`);
    console.log(`   Amélioration atomicité: +${improvement.atomicityImprovement}`);
    console.log(`   Efficacité: ${(improvement.efficiency * 100).toFixed(1)}%`);
    console.log(`   Chunks/structure: ${improvement.chunksPerStructure.classic.toFixed(1)} → ${improvement.chunksPerStructure.optimized.toFixed(1)}`);

    // Évaluation
    if (improvement.reductionPercentage >= 30) {
        console.log('✅ EXCELLENT: Réduction significative du nombre de chunks');
    } else if (improvement.reductionPercentage >= 15) {
        console.log('👍 BON: Réduction notable du nombre de chunks');
    } else if (improvement.reductionPercentage > 0) {
        console.log('📊 MODESTE: Légère amélioration');
    } else {
        console.log('⚠️  À AMÉLIORER: Pas de réduction ou augmentation');
    }
}

function displaySummary(results) {
    console.log('\n' + '='.repeat(60));
    console.log('📋 RÉSUMÉ GLOBAL DES TESTS');
    console.log('='.repeat(60));

    let totalClassicChunks = 0;
    let totalOptimizedChunks = 0;
    let totalReduction = 0;
    let totalStructures = 0;

    for (const result of results) {
        totalClassicChunks += result.classicEstimate.chunkCount;
        totalOptimizedChunks += result.optimizedEstimate.chunkCount;
        totalReduction += result.improvement.chunkReduction;
        totalStructures += result.structure.functionCount + result.structure.classCount;

        console.log(`\n${result.file}:`);
        console.log(`   Classique: ${result.classicEstimate.chunkCount} chunks`);
        console.log(`   Optimisé: ${result.optimizedEstimate.chunkCount} chunks`);
        console.log(`   Réduction: ${result.improvement.chunkReduction} (${result.improvement.reductionPercentage.toFixed(1)}%)`);
    }

    const overallReduction = totalClassicChunks - totalOptimizedChunks;
    const overallPercentage = totalClassicChunks > 0 ?
        (overallReduction / totalClassicChunks) * 100 : 0;

    console.log('\n' + '='.repeat(60));
    console.log('🎯 RÉSULTATS FINAUX:');
    console.log('='.repeat(60));
    console.log(`Total chunks classique: ${totalClassicChunks}`);
    console.log(`Total chunks optimisé: ${totalOptimizedChunks}`);
    console.log(`Réduction totale: ${overallReduction} chunks (${overallPercentage.toFixed(1)}%)`);
    console.log(`Structures analysées: ${totalStructures}`);
    console.log(`Chunks/structure (classique): ${(totalClassicChunks / totalStructures).toFixed(2)}`);
    console.log(`Chunks/structure (optimisé): ${(totalOptimizedChunks / totalStructures).toFixed(2)}`);

    // Recommandations
    console.log('\n💡 RECOMMANDATIONS:');

    if (overallPercentage >= 30) {
        console.log('✅ Les optimisations sont TRÈS EFFICACES');
        console.log('   → Implémenter toutes les améliorations proposées');
    } else if (overallPercentage >= 15) {
        console.log('👍 Les optimisations sont EFFICACES');
        console.log('   → Implémenter les améliorations principales');
    } else if (overallPercentage > 0) {
        console.log('📊 Les optimisations sont MODESTES');
        console.log('   → Cibler les améliorations les plus impactantes');
    } else {
        console.log('⚠️  Les optimisations NÉCESSITENT DES AJUSTEMENTS');
        console.log('   → Revoir les règles de chunking hiérarchique');
    }

    console.log('\n🔧 Prochaines étapes:');
    console.log('1. Implémenter le chunking hiérarchique des classes');
    console.log('2. Améliorer l\'extraction des métadonnées');
    console.log('3. Optimiser la détection des types de nœuds');
    console.log('4. Tester sur des projets réels');
}

// Exécuter le test
runTest().catch(console.error);
