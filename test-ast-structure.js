// Test de la structure de l'AST
import { TreeSitterManager } from './build/rag/phase0/parser/tree-sitter/index.js';

async function testASTStructure() {
    console.log('🔍 Test de la structure de l\'AST');
    console.log('==================================================\n');

    // Initialiser Tree-sitter
    const manager = new TreeSitterManager();
    await manager.initialize();
    
    // Test simple
    const simpleCode = `function hello() { return "world"; }`;
    
    console.log('1. Parsing du code:');
    console.log(`   Code: ${simpleCode}`);
    const result = await manager.parseSourceCode(simpleCode, 'javascript', 'test.js');
    
    console.log(`   Parsing réussi: ${result.ast ? '✅' : '❌'}`);
    console.log(`   Langage: ${result.language}`);
    
    if (result.ast) {
        console.log('\n2. Structure de l\'AST:');
        console.log(`   Type de ast: ${typeof result.ast}`);
        console.log(`   ast est null: ${result.ast === null}`);
        console.log(`   ast est undefined: ${result.ast === undefined}`);
        
        // Afficher toutes les propriétés de l'AST
        console.log('\n3. Propriétés de l\'AST:');
        const astProps = Object.getOwnPropertyNames(result.ast);
        console.log(`   Propriétés: ${astProps.join(', ')}`);
        
        // Vérifier rootNode
        if (result.ast.rootNode) {
            console.log('\n4. rootNode existe:');
            console.log(`   Type de rootNode: ${typeof result.ast.rootNode}`);
            const rootProps = Object.getOwnPropertyNames(result.ast.rootNode);
            console.log(`   Propriétés de rootNode: ${rootProps.join(', ')}`);
            
            if (result.ast.rootNode.type) {
                console.log(`   rootNode.type: ${result.ast.rootNode.type}`);
            }
            if (result.ast.rootNode.childCount !== undefined) {
                console.log(`   rootNode.childCount: ${result.ast.rootNode.childCount}`);
            }
            
            // Afficher les enfants
            console.log('\n5. Enfants de rootNode:');
            for (let i = 0; i < Math.min(result.ast.rootNode.childCount || 0, 5); i++) {
                const child = result.ast.rootNode.child(i);
                if (child) {
                    console.log(`   Enfant ${i}: type=${child.type}, text=${child.text ? child.text.substring(0, 30) : 'N/A'}`);
                }
            }
        } else {
            console.log('\n4. rootNode n\'existe pas');
            // Peut-être que l'AST est déjà le rootNode
            console.log('   Vérification directe:');
            console.log(`   ast.type: ${result.ast.type}`);
            console.log(`   ast.childCount: ${result.ast.childCount}`);
            console.log(`   ast.text: ${result.ast.text ? result.ast.text.substring(0, 30) : 'N/A'}`);
        }
        
        // Vérifier si c'est un Tree-sitter Tree
        console.log('\n6. Vérification Tree-sitter:');
        console.log(`   ast.constructor.name: ${result.ast.constructor.name}`);
        console.log(`   ast.constructor === Tree: ${result.ast.constructor.name === 'Tree'}`);
    }
    
    console.log('\n7. Test avec un autre code:');
    const multiCode = `const x = 5; function test() { return x * 2; }`;
    const multiResult = await manager.parseSourceCode(multiCode, 'javascript', 'test2.js');
    
    if (multiResult.ast) {
        console.log(`   AST généré: ${multiResult.ast ? 'oui' : 'non'}`);
        if (multiResult.ast.rootNode) {
            console.log(`   rootNode.type: ${multiResult.ast.rootNode.type}`);
            console.log(`   rootNode.childCount: ${multiResult.ast.rootNode.childCount}`);
        }
    }
    
    // Arrêter le manager
    await manager.shutdown();
    console.log('\n==================================================');
    console.log('🔍 Test terminé');
}

// Exécuter le test
testASTStructure().catch(console.error);
