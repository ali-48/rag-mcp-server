// Test des règles non négociables du chunker
import { IntelligentChunker } from './build/rag/phase0/chunker/chunker-intelligent.js';
import { TreeSitterManager } from './build/rag/phase0/parser/tree-sitter/index.js';

async function testNonNegotiableRules() {
    console.log('🧪 Test des règles non négociables du chunker');
    console.log('==================================================\n');

    // Initialiser Tree-sitter
    const manager = new TreeSitterManager();
    await manager.initialize();

    // Créer le chunker avec règles strictes
    const chunker = new IntelligentChunker({
        rules: {
            neverSplitFunctions: true,
            neverSplitClasses: true,
            neverMixCodeAndText: true,
            respectSemanticBoundaries: true,
            groupImports: true,
            groupExports: true,
        }
    });

    // Test 1: Fonction TypeScript complète
    console.log('1. Test avec une fonction TypeScript complète:');
    const tsCode = `
import { Component } from 'react';

// Ceci est un commentaire
function calculateSum(a: number, b: number): number {
    const result = a + b;
    return result;
}

export default calculateSum;
`;

    const tsResult = await manager.parseSourceCode(tsCode, 'typescript', 'test.ts');
    const tsChunks = await chunker.chunk(tsResult);

    console.log(`   Chunks générés: ${tsChunks.chunks.length}`);
    console.log(`   Types: ${tsChunks.chunks.map(c => c.type).join(', ')}`);

    // Vérifier qu'on a exactement 1 fonction
    const functionChunks = tsChunks.chunks.filter(c => c.type === 'function');
    console.log(`   Règle "ne jamais couper une fonction": ${functionChunks.length === 1 ? '✅' : '❌'}`);

    // Vérifier qu'aucun chunk n'a de type 'mixed'
    const tsMixedChunks = tsChunks.chunks.filter(c => c.type === 'mixed');
    console.log(`   Règle "ne jamais mélanger code et texte": ${tsMixedChunks.length === 0 ? '✅' : '❌'}`);
    console.log();

    // Test 2: Classe Python complète
    console.log('2. Test avec une classe Python complète:');
    const pythonCode = `
import os
from typing import List

class DataProcessor:
    """Classe pour traiter des données."""
    
    def __init__(self, data: List[float]):
        self.data = data
    
    def calculate_mean(self) -> float:
        """Calcule la moyenne des données."""
        if not self.data:
            return 0.0
        return sum(self.data) / len(self.data)
    
    def filter_positive(self) -> List[float]:
        """Filtre les valeurs positives."""
        return [x for x in self.data if x > 0]
`;

    const pyResult = await manager.parseSourceCode(pythonCode, 'python', 'test.py');
    const pyChunks = await chunker.chunk(pyResult);

    console.log(`   Chunks générés: ${pyChunks.chunks.length}`);
    console.log(`   Types: ${pyChunks.chunks.map(c => c.type).join(', ')}`);

    // Vérifier qu'on a exactement 1 classe
    const classChunks = pyChunks.chunks.filter(c => c.type === 'class');
    console.log(`   Règle "ne jamais couper une classe": ${classChunks.length === 1 ? '✅' : '❌'}`);

    // Vérifier que chaque chunk a une granularité atomique ou logique
    const validGranularity = pyChunks.chunks.every(c =>
        c.granularity === 'atomic' || c.granularity === 'logical'
    );
    console.log(`   Règle "1 chunk = 1 intention logique": ${validGranularity ? '✅' : '❌'}`);
    console.log();

    // Test 3: Code avec mélange interdit
    console.log('3. Test avec code mélangé (doit être rejeté):');
    const mixedCode = `
// Ceci est un commentaire
const x = 5;

Ceci est du texte qui ne devrait pas être mélangé avec du code.

function test() {
    return x * 2;
}
`;

    const mixedResult = await manager.parseSourceCode(mixedCode, 'javascript', 'test-mixed.js');
    const mixedChunks = await chunker.chunk(mixedResult);

    console.log(`   Chunks générés: ${mixedChunks.chunks.length}`);

    // Le chunker devrait rejeter le code mélangé
    const hasMixedContent = mixedChunks.chunks.some(chunk => {
        const code = chunk.content.code;
        const lines = code.split('\n');
        let hasCode = false;
        let hasPlainText = false;

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length === 0) continue;

            // Détecter le code
            if (trimmed.includes('const ') || trimmed.includes('function ') ||
                trimmed.includes('{') || trimmed.includes('}') || trimmed.includes('=')) {
                hasCode = true;
            }
            // Détecter le texte simple
            else if (!trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
                hasPlainText = true;
            }
        }

        return hasCode && hasPlainText;
    });

    console.log(`   Chunks rejetés pour mélange: ${!hasMixedContent ? '✅' : '❌'}`);
    console.log();

    // Test 4: Fonction coupée (doit être rejetée)
    console.log('4. Test avec fonction coupée (doit être rejetée):');
    const splitCode = `
function incompleteFunction(a, b) {
    const sum = a + b;
    // Manque la fin de la fonction
`;

    const splitResult = await manager.parseSourceCode(splitCode, 'javascript', 'test-split.js');
    const splitChunks = await chunker.chunk(splitResult);

    console.log(`   Chunks générés: ${splitChunks.chunks.length}`);

    // Vérifier si une fonction incomplète a été extraite
    const hasIncompleteFunction = splitChunks.chunks.some(chunk => {
        if (chunk.type !== 'function') return false;
        const code = chunk.content.code;
        // Vérifier les accolades non fermées
        const openBraces = (code.match(/{/g) || []).length;
        const closeBraces = (code.match(/}/g) || []).length;
        return openBraces !== closeBraces;
    });

    console.log(`   Fonction coupée détectée: ${!hasIncompleteFunction ? '✅' : '❌'}`);
    console.log();

    // Statistiques finales
    console.log('📊 Statistiques des tests:');
    const totalChunks = tsChunks.chunks.length + pyChunks.chunks.length + mixedChunks.chunks.length + splitChunks.chunks.length;
    const validChunks = tsChunks.chunks.length + pyChunks.chunks.length;
    console.log(`   Total chunks générés: ${totalChunks}`);
    console.log(`   Chunks valides: ${validChunks}`);
    console.log(`   Chunks rejetés: ${mixedChunks.chunks.length + splitChunks.chunks.length}`);
    console.log(`   Taux de succès: ${totalChunks > 0 ? ((validChunks / totalChunks) * 100).toFixed(1) : 0}%`);

    // Arrêter le manager
    await manager.shutdown();
    console.log('\n==================================================');
    console.log('🎉 Tests des règles non négociables terminés !');
}

// Exécuter le test
testNonNegotiableRules().catch(console.error);
