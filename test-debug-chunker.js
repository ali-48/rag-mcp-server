// Test de débogage du chunker
import { IntelligentChunker } from './build/rag/phase0/chunker/chunker-intelligent.js';
import { TreeSitterManager } from './build/rag/phase0/parser/tree-sitter/index.js';

async function debugChunker() {
    console.log('🔍 Débogage du chunker');
    console.log('==================================================\n');

    // Initialiser Tree-sitter
    const manager = new TreeSitterManager();
    await manager.initialize();
    
    // Créer le chunker avec règles moins strictes pour le débogage
    const chunker = new IntelligentChunker({
        rules: {
            neverSplitFunctions: false,  // Désactiver pour voir si ça fonctionne
            neverSplitClasses: false,
            neverMixCodeAndText: false,
            respectSemanticBoundaries: false,
        }
    });

    // Test simple: une fonction JavaScript basique
    console.log('1. Test avec une fonction JavaScript simple:');
    const simpleCode = `function hello() { return "world"; }`;
    
    console.log(`   Code: ${simpleCode}`);
    const result = await manager.parseSourceCode(simpleCode, 'javascript', 'test.js');
    
    console.log(`   Parsing réussi: ${result.ast ? '✅' : '❌'}`);
    console.log(`   Langage: ${result.language}`);
    console.log(`   Taille AST: ${result.ast ? 'oui' : 'non'}`);
    
    if (result.ast) {
        console.log(`   Type racine AST: ${result.ast.type}`);
        console.log(`   Nombre d'enfants: ${result.ast.childCount}`);
        
        // Afficher les enfants
        for (let i = 0; i < Math.min(result.ast.childCount, 5); i++) {
            const child = result.ast.child(i);
            if (child) {
                console.log(`   Enfant ${i}: ${child.type} (${child.startPosition.row}:${child.startPosition.column})`);
            }
        }
    }
    
    // Essayer de chunker
    const chunks = await chunker.chunk(result);
    console.log(`   Chunks générés: ${chunks.chunks.length}`);
    
    if (chunks.chunks.length > 0) {
        console.log('   Détail des chunks:');
        chunks.chunks.forEach((chunk, i) => {
            console.log(`   [${i}] Type: ${chunk.type}, Granularité: ${chunk.granularity}`);
            console.log(`       Lignes: ${chunk.metadata.provenance.position.startLine}-${chunk.metadata.provenance.position.endLine}`);
            console.log(`       Code: ${chunk.content.code.substring(0, 50)}...`);
        });
    } else {
        console.log('   ❌ Aucun chunk généré - vérifiez les règles');
    }
    
    console.log();

    // Test 2: Code avec plusieurs éléments
    console.log('2. Test avec code multi-éléments:');
    const multiCode = `
const x = 5;
function test() { return x * 2; }
class MyClass { method() {} }
`;
    
    const multiResult = await manager.parseSourceCode(multiCode, 'javascript', 'test2.js');
    const multiChunks = await chunker.chunk(multiResult);
    
    console.log(`   Chunks générés: ${multiChunks.chunks.length}`);
    console.log(`   Types: ${multiChunks.chunks.map(c => c.type).join(', ')}`);
    
    // Vérifier les statistiques
    console.log(`   Stats: total=${multiChunks.stats.totalChunks}, par type=${JSON.stringify(multiChunks.stats.byType)}`);
    
    console.log();

    // Arrêter le manager
    await manager.shutdown();
    console.log('==================================================');
    console.log('🔍 Débogage terminé');
}

// Exécuter le test
debugChunker().catch(console.error);
