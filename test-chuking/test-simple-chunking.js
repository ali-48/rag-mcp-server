// Test simple du chunking intelligent

const fs = require('fs');
const path = require('path');

// Importer le chunker intelligent
const { IntelligentChunker } = require('/home/ali/Documents/Cline/MCP/rag-mcp-server/build/rag/phase0/chunker/chunker-intelligent.js');

// Configuration simple
const SIMPLE_CONFIG = {
    granularity: 'atomic',
    chunkTypes: ['function', 'class'],
    maxChunkSize: 1000,
    minChunkSize: 50,
    includeDocumentation: true,

    rules: {
        neverSplitFunctions: true,
        neverSplitClasses: true,
        neverMixCodeAndText: true,
        respectSemanticBoundaries: true
    }
};

async function testSimpleChunking() {
    console.log('=== Test Simple du Chunking Intelligent ===\n');

    // Code TypeScript simple pour tester
    const testCode = `
// Test function
function calculateSum(a: number, b: number): number {
    return a + b;
}

// Test class
class Calculator {
    private value: number = 0;
    
    add(x: number): void {
        this.value += x;
    }
    
    getValue(): number {
        return this.value;
    }
}

// Another function
function multiply(a: number, b: number): number {
    return a * b;
}
`;

    console.log('Code de test:');
    console.log(testCode);
    console.log('='.repeat(60));

    // Créer un parseResult simulé avec un AST simple
    const parseResult = {
        filePath: '/tmp/test.ts',
        language: 'typescript',
        sourceCode: testCode,
        ast: createSimpleAST(testCode)
    };

    // Créer le chunker
    const chunker = new IntelligentChunker(SIMPLE_CONFIG);

    try {
        // Exécuter le chunking
        const result = await chunker.chunk(parseResult);

        console.log('\n📊 Résultats du chunking:');
        console.log(`Nombre de chunks: ${result.chunks.length}`);
        console.log(`Statistiques:`, JSON.stringify(result.stats, null, 2));
        console.log(`Métriques de qualité:`, JSON.stringify(result.qualityMetrics, null, 2));

        // Afficher les chunks
        console.log('\n🔍 Chunks générés:');
        for (let i = 0; i < result.chunks.length; i++) {
            const chunk = result.chunks[i];
            console.log(`\nChunk ${i + 1}:`);
            console.log(`  Type: ${chunk.type}`);
            console.log(`  Granularité: ${chunk.granularity}`);
            console.log(`  Tags: ${chunk.metadata.tags?.join(', ') || 'none'}`);
            console.log(`  Complexité: ${chunk.metadata.complexity || 'N/A'}`);
            console.log(`  Lignes: ${chunk.metadata.provenance.position.startLine}-${chunk.metadata.provenance.position.endLine}`);

            // Afficher un extrait du code
            const codePreview = chunk.content.code.substring(0, 80).replace(/\n/g, ' ');
            console.log(`  Extrait: ${codePreview}...`);
        }

        // Analyser les résultats
        console.log('\n🎯 Analyse:');
        if (result.chunks.length >= 3) {
            console.log('✅ SUCCÈS: Le chunker a détecté les fonctions et classes');
            console.log(`   → ${result.chunks.filter(c => c.type === 'function').length} fonctions détectées`);
            console.log(`   → ${result.chunks.filter(c => c.type === 'class').length} classes détectées`);
        } else {
            console.log('⚠️  PROBLÈME: Le chunker n\'a pas détecté toutes les structures');
            console.log('   → Vérifier la détection des types de nœuds');
            console.log('   → Vérifier les règles de chunking');
        }

    } catch (error) {
        console.error('❌ ERREUR lors du chunking:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

function createSimpleAST(code) {
    // Créer un AST simple avec les nœuds nécessaires
    const lines = code.split('\n');

    // Trouver les positions des fonctions et classes
    const functionPositions = [];
    const classPositions = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('function ') && line.includes('(')) {
            functionPositions.push({
                startLine: i,
                endLine: findMatchingBrace(lines, i)
            });
        } else if (line.includes('class ') && line.includes('{')) {
            classPositions.push({
                startLine: i,
                endLine: findMatchingBrace(lines, i)
            });
        }
    }

    // Créer un AST mock avec les nœuds détectés
    const nodes = [];

    // Ajouter les nœuds de fonction
    functionPositions.forEach((pos, index) => {
        nodes.push({
            type: 'function_declaration',
            text: lines.slice(pos.startLine, pos.endLine + 1).join('\n'),
            startIndex: code.indexOf(lines[pos.startLine]),
            endIndex: code.indexOf(lines[pos.endLine]) + lines[pos.endLine].length,
            startPosition: { row: pos.startLine, column: 0 },
            endPosition: { row: pos.endLine, column: lines[pos.endLine].length },
            childCount: 0,
            child: () => null
        });
    });

    // Ajouter les nœuds de classe
    classPositions.forEach((pos, index) => {
        nodes.push({
            type: 'class_declaration',
            text: lines.slice(pos.startLine, pos.endLine + 1).join('\n'),
            startIndex: code.indexOf(lines[pos.startLine]),
            endIndex: code.indexOf(lines[pos.endLine]) + lines[pos.endLine].length,
            startPosition: { row: pos.startLine, column: 0 },
            endPosition: { row: pos.endLine, column: lines[pos.endLine].length },
            childCount: 0,
            child: () => null
        });
    });

    // Créer le nœud racine
    return {
        rootNode: {
            type: 'program',
            text: code,
            startIndex: 0,
            endIndex: code.length,
            startPosition: { row: 0, column: 0 },
            endPosition: { row: lines.length - 1, column: 0 },
            childCount: nodes.length,
            child: (index) => nodes[index] || null
        }
    };
}

function findMatchingBrace(lines, startLine) {
    let braceCount = 0;
    let inFunction = false;

    for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];

        // Compter les accolades ouvrantes
        const openBraces = (line.match(/{/g) || []).length;
        const closeBraces = (line.match(/}/g) || []).length;

        braceCount += openBraces - closeBraces;

        // Si on a trouvé la première accolade, on est dans la fonction/classe
        if (openBraces > 0 && !inFunction) {
            inFunction = true;
        }

        // Si toutes les accolades sont fermées et on était dans la fonction/classe
        if (braceCount === 0 && inFunction) {
            return i;
        }
    }

    // Si on ne trouve pas l'accolade fermante, retourner la dernière ligne
    return lines.length - 1;
}

// Exécuter le test
testSimpleChunking().catch(console.error);
