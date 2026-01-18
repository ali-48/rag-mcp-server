// src/rag/phase0/analyzer/symbol-extractor.ts
// Extraction des symboles (fonctions, classes, méthodes, etc.) depuis l'AST
import { extractAssociatedComment, extractNodeInfo, findNodesByType } from './ast-utils.js';
// Import des modules refactorés
import { enrichSymbolMetadata } from './symbol-extraction/symbol-metadata-enricher.js';
import { cleanComment, extractSymbolName } from './symbol-extraction/symbol-name-extractor.js';
import { getNodeTypeMap } from './symbol-extraction/symbol-type-maps.js';
/**
 * Extrait les symboles d'un résultat de parsing
 */
export function extractSymbols(parseResult, config = {}) {
    const startTime = Date.now();
    const { filePath, language, ast, sourceCode } = parseResult;
    const defaultConfig = {
        extractComments: true,
        calculateComplexity: true,
        symbolTypes: ['function', 'class', 'method', 'interface', 'import', 'export'],
        detailLevel: 'standard',
    };
    const finalConfig = { ...defaultConfig, ...config };
    if (!ast) {
        return {
            filePath,
            language,
            symbols: [],
            stats: {
                totalSymbols: 0,
                byType: {},
                extractionTime: Date.now() - startTime,
            },
        };
    }
    const symbols = [];
    const byType = {};
    // Définir les types de nœuds à extraire par langage
    const nodeTypeMap = getNodeTypeMap(language);
    // Extraire chaque type de symbole
    for (const [symbolType, nodeTypes] of Object.entries(nodeTypeMap)) {
        if (!finalConfig.symbolTypes?.includes(symbolType)) {
            continue;
        }
        for (const nodeType of nodeTypes) {
            const nodes = findNodesByType(ast, nodeType);
            for (const node of nodes) {
                const symbol = extractSymbolFromNode(node, symbolType, language, filePath, sourceCode, finalConfig);
                if (symbol) {
                    symbols.push(symbol);
                    byType[symbol.type] = (byType[symbol.type] || 0) + 1;
                }
            }
        }
    }
    return {
        filePath,
        language,
        symbols,
        stats: {
            totalSymbols: symbols.length,
            byType,
            extractionTime: Date.now() - startTime,
        },
    };
}
/**
 * Extrait un symbole spécifique depuis un nœud AST
 */
function extractSymbolFromNode(node, symbolType, language, filePath, sourceCode, config) {
    try {
        const astInfo = extractNodeInfo(node, sourceCode);
        // Extraire le nom du symbole
        const name = extractSymbolName(node, symbolType, language) || 'anonymous';
        // Extraire le commentaire associé
        let comment;
        if (config.extractComments) {
            const rawComment = extractAssociatedComment(node, sourceCode);
            if (rawComment) {
                comment = cleanComment(rawComment, language);
            }
        }
        // Construire le symbole
        const symbol = {
            type: symbolType,
            name,
            language,
            filePath,
            position: astInfo.position,
            range: astInfo.range,
            code: astInfo.text || sourceCode.substring(node.startIndex, node.endIndex),
            comment,
            metadata: {},
            astInfo,
        };
        // Ajouter les métadonnées spécifiques
        enrichSymbolMetadata(symbol, node, sourceCode, config);
        return symbol;
    }
    catch (error) {
        console.warn(`Erreur lors de l'extraction du symbole: ${error}`);
        return null;
    }
}
//# sourceMappingURL=symbol-extractor.js.map