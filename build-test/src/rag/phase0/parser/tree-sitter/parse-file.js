// src/rag/phase0/parser/tree-sitter/parse-file.ts
// Parser de fichiers avec Tree-sitter
import * as fs from 'fs/promises';
/**
 * Parse un fichier et retourne son AST
 */
export async function parseFile(filePath, initializedLanguages) {
    const startTime = Date.now();
    const timestamp = new Date();
    try {
        // Lire le fichier
        const sourceCode = await fs.readFile(filePath, 'utf-8');
        const fileSize = (await fs.stat(filePath)).size;
        const lineCount = sourceCode.split('\n').length;
        // Détecter le langage
        const extension = filePath.toLowerCase().match(/\.[^.]+$/)?.[0];
        let language;
        // Itération compatible avec downlevelIteration
        const langIds = Array.from(initializedLanguages.keys());
        for (const langId of langIds) {
            const langConfig = initializedLanguages.get(langId);
            if (langConfig && langConfig.extensions.includes(extension || '')) {
                language = langConfig;
                break;
            }
        }
        if (!language) {
            return {
                filePath,
                language: 'unknown',
                ast: null,
                sourceCode,
                metadata: {
                    parseTime: Date.now() - startTime,
                    fileSize,
                    lineCount,
                    success: false,
                    timestamp,
                },
                error: `Langage non supporté pour l'extension ${extension}`,
            };
        }
        // Parser le code
        const ast = language.parser.parse(sourceCode);
        return {
            filePath,
            language: language.id,
            ast,
            sourceCode,
            metadata: {
                parseTime: Date.now() - startTime,
                fileSize,
                lineCount,
                success: true,
                timestamp,
            },
        };
    }
    catch (error) {
        return {
            filePath,
            language: 'unknown',
            ast: null,
            sourceCode: '',
            metadata: {
                parseTime: Date.now() - startTime,
                fileSize: 0,
                lineCount: 0,
                success: false,
                timestamp,
            },
            error: error instanceof Error ? error.message : 'Erreur inconnue',
        };
    }
}
/**
 * Parse du code source directement
 */
export async function parseSourceCode(sourceCode, language) {
    const startTime = Date.now();
    const timestamp = new Date();
    try {
        const ast = language.parser.parse(sourceCode);
        const lineCount = sourceCode.split('\n').length;
        return {
            filePath: 'inline',
            language: language.id,
            ast,
            sourceCode,
            metadata: {
                parseTime: Date.now() - startTime,
                fileSize: Buffer.byteLength(sourceCode, 'utf-8'),
                lineCount,
                success: true,
                timestamp,
            },
        };
    }
    catch (error) {
        return {
            filePath: 'inline',
            language: language.id,
            ast: null,
            sourceCode,
            metadata: {
                parseTime: Date.now() - startTime,
                fileSize: Buffer.byteLength(sourceCode, 'utf-8'),
                lineCount: sourceCode.split('\n').length,
                success: false,
                timestamp,
            },
            error: error instanceof Error ? error.message : 'Erreur inconnue',
        };
    }
}
/**
 * Utilitaires pour manipuler l'AST
 */
export var ASTUtils;
(function (ASTUtils) {
    /**
     * Parcourt l'AST et exécute un callback sur chaque nœud
     */
    function traverseAST(ast, callback) {
        if (!ast || !ast.rootNode)
            return;
        const traverse = (node) => {
            callback(node);
            for (let i = 0; i < node.childCount; i++) {
                const child = node.child(i);
                if (child)
                    traverse(child);
            }
        };
        traverse(ast.rootNode);
    }
    ASTUtils.traverseAST = traverseAST;
    /**
     * Recherche des nœuds par type
     */
    function findNodesByType(ast, nodeType) {
        const nodes = [];
        traverseAST(ast, (node) => {
            if (node.type === nodeType) {
                nodes.push(node);
            }
        });
        return nodes;
    }
    ASTUtils.findNodesByType = findNodesByType;
    /**
     * Extrait le texte d'un nœud
     */
    function getNodeText(node, sourceCode) {
        return sourceCode.substring(node.startIndex, node.endIndex);
    }
    ASTUtils.getNodeText = getNodeText;
    /**
     * Obtient la position d'un nœud (ligne, colonne)
     */
    function getNodePosition(node) {
        return {
            line: node.startPosition.row + 1,
            column: node.startPosition.column + 1,
        };
    }
    ASTUtils.getNodePosition = getNodePosition;
    /**
     * Vérifie si un nœud contient un autre nœud
     */
    function containsNode(parent, child) {
        return (child.startIndex >= parent.startIndex &&
            child.endIndex <= parent.endIndex);
    }
    ASTUtils.containsNode = containsNode;
})(ASTUtils || (ASTUtils = {}));
/**
 * Types de nœuds communs pour différents langages
 */
export const COMMON_NODE_TYPES = {
    // TypeScript/JavaScript
    FUNCTION_DECLARATION: 'function_declaration',
    CLASS_DECLARATION: 'class_declaration',
    METHOD_DEFINITION: 'method_definition',
    VARIABLE_DECLARATION: 'variable_declaration',
    IMPORT_STATEMENT: 'import_statement',
    EXPORT_STATEMENT: 'export_statement',
    CALL_EXPRESSION: 'call_expression',
    // Python
    FUNCTION_DEFINITION: 'function_definition',
    CLASS_DEFINITION: 'class_definition',
    IMPORT_STATEMENT_PY: 'import_statement',
    IMPORT_FROM_STATEMENT: 'import_from_statement',
    // Commun
    COMMENT: 'comment',
    STRING: 'string',
    IDENTIFIER: 'identifier',
};
/**
 * Formate un résultat de parsing pour l'affichage
 */
export function formatParseResult(result) {
    const { filePath, language, metadata, error } = result;
    const success = metadata.success ? '✅' : '❌';
    let output = `${success} ${filePath}\n`;
    output += `  Langage: ${language}\n`;
    output += `  Temps: ${metadata.parseTime}ms\n`;
    output += `  Taille: ${metadata.fileSize} octets\n`;
    output += `  Lignes: ${metadata.lineCount}\n`;
    if (error) {
        output += `  Erreur: ${error}\n`;
    }
    if (result.ast) {
        const rootNode = result.ast.rootNode;
        output += `  AST: ${rootNode.type} (${rootNode.childCount} enfants)\n`;
    }
    return output;
}
//# sourceMappingURL=parse-file.js.map