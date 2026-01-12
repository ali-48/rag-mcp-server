// Test final du chunker avec différentes configurations
import { IntelligentChunker } from './build/rag/phase0/chunker/chunker-intelligent.js';
import { TreeSitterManager } from './build/rag/phase0/parser/tree-sitter/index.js';

async function testFinalChunker() {
    console.log('🧪 Test final du chunker intelligent');
    console.log('==================================================\n');

    // Initialiser Tree-sitter
    const manager = new TreeSitterManager();
    await manager.initialize();
    
    // Test 1: Configuration par défaut (règles strictes)
    console.log('1. Configuration par défaut (règles strictes):');
    const chunkerStrict = new IntelligentChunker();
    
    const code1 = `function hello() { return "world"; }`;
    const result1 = await manager.parseSourceCode(code1, 'javascript', 'test1.js');
    const chunks1 = await chunkerStrict.chunk(result1);
    
    console.log(`   Code: ${code1}`);
    console.log(`   Chunks générés: ${chunks1.chunks.length}`);
    console.log(`   Types: ${chunks1.chunks.map(c => c.type).join(', ')}`);
    console.log(`   ✅ Fonction extraite: ${chunks1.chunks.length === 1 && chunks1.chunks[0].type === 'function' ? 'OUI' : 'NON'}`);
    
    // Test 2: Configuration permissive
    console.log('\n2. Configuration permissive (toutes règles désactivées):');
    const chunkerPermissive = new IntelligentChunker({
        rules: {
            neverSplitFunctions: false,
            neverSplitClasses: false,
            neverMixCodeAndText: false,
            respectSemanticBoundaries: false,
        }
    });
    
    const code2 = `const x = 5; function test() { return x * 2; }`;
    const result2 = await manager.parseSourceCode(code2, 'javascript', 'test2.js');
    const chunks2 = await chunkerPermissive.chunk(result2);
    
    console.log(`   Code: ${code2}`);
    console.log(`   Chunks générés: ${chunks2.chunks.length}`);
    console.log(`   Types: ${chunks2.chunks.map(c => c.type).join(', ')}`);
    
    // Test 3: Code complexe TypeScript
    console.log('\n3. Code TypeScript complexe:');
    const code3 = `
import { Component } from 'react';

interface Props {
    name: string;
}

export class HelloComponent extends Component<Props> {
    render() {
        return <div>Hello {this.props.name}</div>;
    }
}
`;
    const result3 = await manager.parseSourceCode(code3, 'typescript', 'test3.ts');
    const chunks3 = await chunkerStrict.chunk(result3);
    
    console.log(`   Chunks générés: ${chunks3.chunks.length}`);
    console.log(`   Types: ${chunks3.chunks.map(c => c.type).join(', ')}`);
    console.log(`   ✅ Import extrait: ${chunks3.chunks.some(c => c.type === 'import') ? 'OUI' : 'NON'}`);
    console.log(`   ✅ Interface extraite: ${chunks3.chunks.some(c => c.type === 'interface') ? 'OUI' : 'NON'}`);
    console.log(`   ✅ Classe extraite: ${chunks3.chunks.some(c => c.type === 'class') ? 'OUI' : 'NON'}`);
    
    // Test 4: Code Python
    console.log('\n4. Code Python:');
    const code4 = `
import os
from typing import List

class DataProcessor:
    def __init__(self, data: List[str]):
        self.data = data
    
    def process(self) -> List[str]:
        return [item.upper() for item in self.data]
`;
    const result4 = await manager.parseSourceCode(code4, 'python', 'test4.py');
    const chunks4 = await chunkerStrict.chunk(result4);
    
    console.log(`   Chunks générés: ${chunks4.chunks.length}`);
    console.log(`   Types: ${chunks4.chunks.map(c => c.type).join(', ')}`);
    console.log(`   ✅ Imports extraits: ${chunks4.chunks.filter(c => c.type === 'import').length === 2 ? 'OUI' : 'NON'}`);
    console.log(`   ✅ Classe extraite: ${chunks4.chunks.some(c => c.type === 'class') ? 'OUI' : 'NON'}`);
    console.log(`   ✅ Méthodes extraites: ${chunks4.chunks.filter(c => c.type === 'function').length >= 2 ? 'OUI' : 'NON'}`);
    
    // Statistiques finales
    console.log('\n�� Statistiques finales:');
    const allChunks = [...chunks1.chunks, ...chunks2.chunks, ...chunks3.chunks, ...chunks4.chunks];
    const byType = {};
    allChunks.forEach(chunk => {
        byType[chunk.type] = (byType[chunk.type] || 0) + 1;
    });
    
    console.log(`   Total chunks générés: ${allChunks.length}`);
    console.log(`   Répartition par type:`);
    Object.entries(byType).forEach(([type, count]) => {
        console.log(`     ${type}: ${count}`);
    });
    
    // Arrêter le manager
    await manager.shutdown();
    console.log('\n==================================================');
    console.log('🎉 Test final terminé avec succès !');
}

// Exécuter le test
testFinalChunker().catch(console.error);
