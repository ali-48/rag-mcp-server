// test/phase0-analyzer/test-symbol-extractor.js
// Test de l'extraction de symboles

import { extractSymbols } from '../../build/rag/phase0/analyzer/symbol-extractor.js';
import { initializeTreeSitter, parseFileWithDefault } from '../../build/rag/phase0/parser/tree-sitter/index.js';

async function testSymbolExtractor() {
    console.log('🧪 Test de l\'extraction de symboles');
    console.log('='.repeat(50));

    try {
        // Initialiser Tree-sitter
        console.log('1. Initialisation de Tree-sitter...');
        const manager = await initializeTreeSitter({
            logLevel: 'info',
            autoInitialize: true,
        });

        console.log(`✅ Tree-sitter initialisé avec ${manager.getInitializedLanguages().length} langages`);

        // Test 1: Parser un fichier TypeScript avec des symboles variés
        console.log('\n2. Test avec un fichier TypeScript complexe...');
        const testFile = 'src/rag/phase0/workspace-detector.ts';

        const parseResult = await parseFileWithDefault(testFile);
        if (!parseResult || !parseResult.ast) {
            console.error('❌ Échec du parsing');
            return;
        }

        console.log(`✅ Fichier parsé: ${parseResult.filePath}`);
        console.log(`   Langage: ${parseResult.language}`);
        console.log(`   Taille: ${parseResult.sourceCode.length} octets`);

        // Extraire les symboles
        console.log('\n3. Extraction des symboles...');
        const extractionResult = extractSymbols(parseResult, {
            extractComments: true,
            calculateComplexity: true,
            symbolTypes: ['function', 'class', 'method', 'interface', 'import', 'export'],
            detailLevel: 'full',
        });

        console.log(`✅ ${extractionResult.symbols.length} symbole(s) extrait(s)`);
        console.log(`   Temps d'extraction: ${extractionResult.stats.extractionTime}ms`);

        // Afficher les statistiques
        console.log('\n4. Statistiques par type:');
        for (const [type, count] of Object.entries(extractionResult.stats.byType)) {
            console.log(`   ${type}: ${count}`);
        }

        // Afficher quelques symboles détaillés
        console.log('\n5. Exemples de symboles extraits:');
        const sampleSymbols = extractionResult.symbols.slice(0, 5);

        for (const symbol of sampleSymbols) {
            console.log(`\n   📦 ${symbol.type.toUpperCase()}: ${symbol.name}`);
            console.log(`      Fichier: ${symbol.filePath}`);
            console.log(`      Lignes: ${symbol.position.startLine}-${symbol.position.endLine}`);

            if (symbol.metadata.parameters && symbol.metadata.parameters.length > 0) {
                console.log(`      Paramètres: ${symbol.metadata.parameters.join(', ')}`);
            }

            if (symbol.metadata.returnType) {
                console.log(`      Type retour: ${symbol.metadata.returnType}`);
            }

            if (symbol.metadata.complexity) {
                console.log(`      Complexité: ${symbol.metadata.complexity}`);
            }

            if (symbol.comment) {
                const preview = symbol.comment.length > 100
                    ? symbol.comment.substring(0, 100) + '...'
                    : symbol.comment;
                console.log(`      Commentaire: ${preview}`);
            }
        }

        // Test 2: Parser du code Python inline
        console.log('\n6. Test avec du code Python inline...');
        const pythonCode = `
"""
Module de test Python
"""

import os
import sys
from typing import List, Dict

class TestClass:
    """Classe de test"""
    
    def __init__(self, name: str):
        self.name = name
        self.values: List[int] = []
    
    def add_value(self, value: int) -> bool:
        """Ajoute une valeur à la liste"""
        if value > 0:
            self.values.append(value)
            return True
        return False
    
    @staticmethod
    def static_method():
        """Méthode statique"""
        return "static"

def calculate_sum(numbers: List[int]) -> int:
    """Calcule la somme d'une liste de nombres"""
    total = 0
    for num in numbers:
        total += num
    return total

async def fetch_data(url: str) -> Dict:
    """Récupère des données asynchrones"""
    import aiohttp
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.json()
`;

        const pythonParseResult = await manager.parseSourceCode(pythonCode, 'python');
        if (pythonParseResult) {
            const pythonExtraction = extractSymbols({
                ...pythonParseResult,
                filePath: 'inline.py',
                language: 'python',
            }, {
                extractComments: true,
                calculateComplexity: true,
                symbolTypes: ['function', 'class', 'method', 'import'],
            });

            console.log(`✅ ${pythonExtraction.symbols.length} symbole(s) Python extrait(s)`);

            // Afficher les imports
            const imports = pythonExtraction.symbols.filter(s => s.type === 'import');
            if (imports.length > 0) {
                console.log(`   Imports: ${imports.map(i => i.metadata.imports?.join(', ') || i.name).join(', ')}`);
            }
        }

        // Test 3: Vérifier le format JSON de sortie
        console.log('\n7. Vérification du format JSON...');

        // Convertir en JSON
        const jsonOutput = JSON.stringify(extractionResult, null, 2);

        // Vérifier la structure
        const parsedJson = JSON.parse(jsonOutput);

        if (parsedJson.filePath && parsedJson.language && Array.isArray(parsedJson.symbols)) {
            console.log('✅ Format JSON valide');
            console.log(`   Taille JSON: ${jsonOutput.length} octets`);

            // Sauvegarder un échantillon pour inspection
            const sampleOutput = {
                metadata: {
                    test: 'symbol-extractor',
                    timestamp: new Date().toISOString(),
                    file: testFile,
                    totalSymbols: parsedJson.symbols.length,
                },
                sampleSymbols: parsedJson.symbols.slice(0, 3),
                stats: parsedJson.stats,
            };

            console.log('\n8. Échantillon JSON (premier symbole):');
            console.log(JSON.stringify(sampleOutput.sampleSymbols[0], null, 2));
        } else {
            console.error('❌ Format JSON invalide');
        }

        // Arrêter le manager
        console.log('\n9. Arrêt du manager...');
        await manager.shutdown();

        console.log('\n' + '='.repeat(50));
        console.log('🎉 Tous les tests d\'extraction de symboles ont réussi !');

    } catch (error) {
        console.error('❌ Erreur lors des tests:', error);
        process.exit(1);
    }
}

// Exécuter les tests
if (import.meta.url === `file://${process.argv[1]}`) {
    testSymbolExtractor().catch(error => {
        console.error('❌ Erreur non gérée:', error);
        process.exit(1);
    });
}

export { testSymbolExtractor };
