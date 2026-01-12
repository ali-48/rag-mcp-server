// Test de débogage détaillé du chunker
import { IntelligentChunker } from './build/rag/phase0/chunker/chunker-intelligent.js';
import { TreeSitterManager } from './build/rag/phase0/parser/tree-sitter/index.js';

async function testChunkerDebug() {
    console.log('🔍 Test de débogage détaillé du chunker');
    console.log('==================================================\n');

    // Initialiser Tree-sitter
    const manager = new TreeSitterManager();
    await manager.initialize();
    
    // Créer le chunker avec logging activé
    const chunker = new IntelligentChunker({
        rules: {
            neverSplitFunctions: true,
            neverSplitClasses: true,
            neverMixCodeAndText: false,  // Désactiver pour le test
            respectSemanticBoundaries: false,
        }
    });

    // Test simple
    console.log('1. Test avec une fonction JavaScript:');
    const simpleCode = `function hello() { return "world"; }`;
    
    const result = await manager.parseSourceCode(simpleCode, 'javascript', 'test.js');
    console.log(`   AST généré: ${result.ast ? '✅' : '❌'}`);
    
    if (result.ast) {
        const rootNode = result.ast.rootNode;
        console.log(`   rootNode.type: ${rootNode.type}`);
        console.log(`   rootNode.childCount: ${rootNode.childCount}`);
        
        // Afficher les enfants
        for (let i = 0; i < rootNode.childCount; i++) {
            const child = rootNode.child(i);
            if (child) {
                console.log(`   Enfant ${i}: type=${child.type}, text=${child.text ? child.text.substring(0, 50) : 'N/A'}`);
            }
        }
        
        // Monkey-patch pour ajouter des logs
        const originalApplyRules = chunker.applyRulesToAST;
        let ruleCount = 0;
        chunker.applyRulesToAST = function(node, context) {
            ruleCount++;
            console.log(`\n   Règle ${ruleCount} - Nœud: type=${node.type}, children=${node.childCount}`);
            
            // Appeler l'original
            return originalApplyRules.call(this, node, context);
        };
        
        // Monkey-patch pour loguer les chunks générés
        const originalAction = chunker.rules[0].action;
        chunker.rules[0].action = function(node, context) {
            console.log(`   Action de la règle function_chunk appelée!`);
            console.log(`   Node type: ${node.type}`);
            console.log(`   Node text: ${node.text ? node.text.substring(0, 50) : 'N/A'}`);
            return originalAction.call(chunker, node, context);
        };
        
        // Exécuter le chunking
        console.log('\n   Exécution du chunking...');
        const chunks = await chunker.chunk(result);
        
        console.log(`\n   Résultat:`);
        console.log(`   Chunks générés: ${chunks.chunks.length}`);
        
        if (chunks.chunks.length > 0) {
            console.log('   Détail des chunks:');
            chunks.chunks.forEach((chunk, i) => {
                console.log(`   [${i}] Type: ${chunk.type}, Granularité: ${chunk.granularity}`);
                console.log(`       ID: ${chunk.id}`);
                console.log(`       Lignes: ${chunk.metadata.provenance.position.startLine}-${chunk.metadata.provenance.position.endLine}`);
                console.log(`       Code (premières 50 chars): ${chunk.content.code.substring(0, 50)}...`);
            });
        } else {
            console.log('   ❌ Aucun chunk généré');
            
            // Vérifier les règles
            console.log('\n   Vérification des règles:');
            console.log(`   Nombre de règles: ${chunker.rules.length}`);
            chunker.rules.forEach((rule, i) => {
                console.log(`   Règle ${i}: ${rule.name} (priorité: ${rule.priority})`);
            });
        }
    }
    
    console.log('\n2. Test avec validation manuelle:');
    // Créer un chunk manuellement pour tester la validation
    const ChunkFactory = (await import('./build/rag/phase0/chunker/chunk-schema.js')).ChunkFactory;
    const ChunkValidator = (await import('./build/rag/phase0/chunker/chunk-schema.js')).ChunkValidator;
    
    const manualChunk = ChunkFactory.createChunk(
        'function',
        'atomic',
        'function test() { return 1; }',
        {
            tags: ['function', 'atomic', 'javascript'],
            complexity: 5,
        },
        'test.js',
        'javascript',
        { startLine: 1, startColumn: 1, endLine: 1, endColumn: 30 }
    );
    
    const validation = ChunkValidator.validate(manualChunk);
    console.log(`   Validation manuelle: ${validation.valid ? '✅' : '❌'}`);
    if (!validation.valid) {
        console.log(`   Erreurs: ${validation.errors.join(', ')}`);
    }
    
    // Arrêter le manager
    await manager.shutdown();
    console.log('\n==================================================');
    console.log('🔍 Test de débogage terminé');
}

// Exécuter le test
testChunkerDebug().catch(console.error);
