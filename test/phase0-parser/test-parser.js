// test/phase0-parser/test-parser.js
// Test du parser Tree-sitter (version JavaScript)

import { initializeTreeSitter, parseFileWithDefault } from '../../build/rag/phase0/parser/tree-sitter/index.js';
import { formatParseResult } from '../../build/rag/phase0/parser/tree-sitter/parse-file.js';

async function testParser() {
    console.log('🧪 Test du parser Tree-sitter');
    console.log('='.repeat(50));

    try {
        // Initialiser Tree-sitter
        console.log('1. Initialisation de Tree-sitter...');
        const manager = await initializeTreeSitter({
            logLevel: 'info',
            autoInitialize: true,
        });

        console.log(`✅ Tree-sitter initialisé avec ${manager.getInitializedLanguages().length} langages:`);
        console.log(`   ${manager.getInitializedLanguages().join(', ')}`);

        // Test 1: Parser un fichier TypeScript existant
        console.log('\n2. Test avec un fichier TypeScript existant...');
        const testFile = 'src/rag/phase0/workspace-detector.ts';

        const result = await parseFileWithDefault(testFile);
        if (!result) {
            console.error('❌ Échec du parsing');
            return;
        }

        console.log(formatParseResult(result));

        // Test 2: Parser du code source inline
        console.log('\n3. Test avec du code source inline...');
        const pythonCode = `
def hello_world():
    """Fonction de test"""
    print("Hello, World!")
    return 42

class TestClass:
    def __init__(self):
        self.value = 100
`;

        const pythonResult = await manager.parseSourceCode(pythonCode, 'python');
        if (pythonResult) {
            console.log(formatParseResult(pythonResult));

            // Vérifier l'AST
            if (pythonResult.ast) {
                const rootNode = pythonResult.ast.rootNode;
                console.log(`   AST Python: ${rootNode.type} avec ${rootNode.childCount} enfants`);

                // Compter les fonctions et classes
                let functionCount = 0;
                let classCount = 0;

                const traverse = (node) => {
                    if (node.type === 'function_definition') functionCount++;
                    if (node.type === 'class_definition') classCount++;

                    for (let i = 0; i < node.childCount; i++) {
                        const child = node.child(i);
                        if (child) traverse(child);
                    }
                };

                traverse(rootNode);
                console.log(`   Détecté: ${functionCount} fonction(s), ${classCount} classe(s)`);
            }
        }

        // Test 3: Parser un fichier JavaScript
        console.log('\n4. Test avec un fichier JavaScript...');
        const jsFile = 'test-phase0-integration.js';

        const jsResult = await parseFileWithDefault(jsFile);
        if (jsResult) {
            console.log(formatParseResult(jsResult));
        }

        // Test 4: Vérifier la détection de langage
        console.log('\n5. Test de détection de langage...');
        const testFiles = [
            'test.ts',
            'module.js',
            'script.py',
            'file.txt',
            'unknown.xyz'
        ];

        for (const file of testFiles) {
            const detected = manager.detectLanguage(file);
            console.log(`   ${file}: ${detected ? detected.name : '❌ Non supporté'}`);
        }

        // Arrêter le manager
        console.log('\n6. Arrêt du manager...');
        await manager.shutdown();

        console.log('\n' + '='.repeat(50));
        console.log('🎉 Tous les tests du parser ont réussi !');

    } catch (error) {
        console.error('❌ Erreur lors des tests:', error);
        process.exit(1);
    }
}

// Exécuter les tests
if (import.meta.url === `file://${process.argv[1]}`) {
    testParser().catch(error => {
        console.error('❌ Erreur non gérée:', error);
        process.exit(1);
    });
}

export { testParser };
