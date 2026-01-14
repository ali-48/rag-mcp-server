// src/rag/phase0/analyzer/symbol-extractor.ts
// Extraction des symboles (fonctions, classes, méthodes, etc.) depuis l'AST
import { estimateCyclomaticComplexity, extractAssociatedComment, extractNodeInfo, findNodesByType } from './ast-utils.js';
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
/**
 * Extrait le nom d'un symbole depuis un nœud AST
 */
function extractSymbolName(node, symbolType, language) {
    // Rechercher le nom selon le type de symbole et le langage
    switch (symbolType) {
        case 'function':
        case 'method':
        case 'class':
        case 'interface':
        case 'type_alias':
        case 'enum':
            // Rechercher un nœud 'identifier' ou 'name' dans le nœud
            const nameNode = findNameNode(node, language);
            return nameNode?.text || null;
        case 'variable':
        case 'constant':
            // Pour les déclarations de variables
            const declarationNode = findChildByType(node, ['identifier', 'variable_name']);
            return declarationNode?.text || null;
        case 'import':
        case 'export':
            // Pour les imports/exports, utiliser le module ou l'élément exporté
            return extractImportExportName(node, language);
        default:
            return null;
    }
}
/**
 * Recherche le nœud contenant le nom
 */
function findNameNode(node, language) {
    // Recherche récursive d'un nœud 'identifier', 'name', ou similaire
    const nameNodeTypes = ['identifier', 'name', 'variable_name', 'function_name'];
    const traverse = (n) => {
        if (nameNodeTypes.includes(n.type)) {
            return n;
        }
        for (let i = 0; i < n.childCount; i++) {
            const child = n.child(i);
            if (child) {
                const result = traverse(child);
                if (result)
                    return result;
            }
        }
        return null;
    };
    return traverse(node);
}
/**
 * Recherche un enfant par type
 */
function findChildByType(node, types) {
    for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child && types.includes(child.type)) {
            return child;
        }
    }
    return null;
}
/**
 * Extrait le nom d'un import/export
 */
function extractImportExportName(node, language) {
    // Essayer d'extraire le module ou l'élément importé/exporté
    const text = node.text || '';
    if (language === 'typescript' || language === 'javascript') {
        // Extraire le chemin du module ou le nom de l'export
        const importMatch = text.match(/from\s+['"]([^'"]+)['"]/);
        if (importMatch)
            return importMatch[1];
        const exportMatch = text.match(/export\s+(?:const|let|var|function|class|interface)\s+(\w+)/);
        if (exportMatch)
            return exportMatch[1];
    }
    if (language === 'python') {
        const importMatch = text.match(/import\s+(\w+)/);
        if (importMatch)
            return importMatch[1];
        const fromMatch = text.match(/from\s+([\w.]+)\s+import/);
        if (fromMatch)
            return fromMatch[1];
    }
    return 'unknown';
}
/**
 * Nettoie un commentaire (enlève les marqueurs de commentaire)
 */
function cleanComment(comment, language) {
    if (language === 'python') {
        // Enlever les triples quotes et les #
        return comment
            .replace(/^['"]{3}/g, '')
            .replace(/['"]{3}$/g, '')
            .replace(/^#\s?/gm, '')
            .trim();
    }
    if (language === 'typescript' || language === 'javascript') {
        // Enlever les /*, */, //, et les étoiles de JSDoc
        return comment
            .replace(/^\/\*\*?\s?/g, '')
            .replace(/\s?\*\/$/g, '')
            .replace(/^\s*\*\s?/gm, '')
            .replace(/^\/\/\s?/gm, '')
            .trim();
    }
    return comment.trim();
}
/**
 * Enrichit les métadonnées d'un symbole
 */
function enrichSymbolMetadata(symbol, node, sourceCode, config) {
    const { type, language } = symbol;
    switch (type) {
        case 'function':
        case 'method':
            // Paramètres et type de retour
            symbol.metadata.parameters = extractParameters(node, language);
            symbol.metadata.returnType = extractReturnType(node, language);
            // Complexité cyclomatique
            if (config.calculateComplexity) {
                symbol.metadata.complexity = estimateCyclomaticComplexity(node);
            }
            // Visibilité et modificateurs
            symbol.metadata.visibility = extractVisibility(node, language);
            symbol.metadata.isStatic = isStatic(node, language);
            symbol.metadata.isAsync = isAsync(node, language);
            break;
        case 'class':
            // Méthodes et propriétés
            symbol.metadata.methods = extractClassMembers(node, 'method', language);
            symbol.metadata.properties = extractClassMembers(node, 'property', language);
            symbol.metadata.visibility = extractVisibility(node, language);
            break;
        case 'import':
            // Modules importés
            symbol.metadata.imports = extractImports(node, language);
            break;
        case 'export':
            // Éléments exportés
            symbol.metadata.exports = extractExports(node, language);
            break;
    }
}
/**
 * Extrait les paramètres d'une fonction/méthode
 */
function extractParameters(node, language) {
    const parameters = [];
    const traverse = (n) => {
        if (n.type.includes('parameter') || n.type === 'formal_parameter') {
            const paramName = findNameNode(n, language);
            if (paramName?.text) {
                parameters.push(paramName.text);
            }
        }
        for (let i = 0; i < n.childCount; i++) {
            const child = n.child(i);
            if (child)
                traverse(child);
        }
    };
    traverse(node);
    return parameters;
}
/**
 * Extrait le type de retour d'une fonction/méthode
 */
function extractReturnType(node, language) {
    if (language === 'typescript') {
        const returnTypeNode = findChildByType(node, ['type_annotation', 'return_type']);
        return returnTypeNode?.text;
    }
    // Pour Python, chercher des annotations de type
    if (language === 'python') {
        const annotationNode = findChildByType(node, ['type']);
        return annotationNode?.text;
    }
    return undefined;
}
/**
 * Extrait la visibilité d'un symbole
 */
function extractVisibility(node, language) {
    const text = node.text || '';
    if (language === 'typescript' || language === 'javascript') {
        if (text.includes('private'))
            return 'private';
        if (text.includes('protected'))
            return 'protected';
        if (text.includes('public'))
            return 'public';
    }
    if (language === 'python') {
        // En Python, les méthodes commençant par __ sont privées
        const name = extractSymbolName(node, 'method', language);
        if (name?.startsWith('__'))
            return 'private';
    }
    return 'public'; // Par défaut
}
/**
 * Vérifie si un symbole est statique
 */
function isStatic(node, language) {
    const text = node.text || '';
    if (language === 'typescript' || language === 'javascript') {
        return text.includes('static');
    }
    if (language === 'python') {
        // En Python, vérifier les décorateurs @staticmethod ou @classmethod
        return text.includes('@staticmethod') || text.includes('@classmethod');
    }
    return false;
}
/**
 * Vérifie si une fonction est asynchrone
 */
function isAsync(node, language) {
    const text = node.text || '';
    if (language === 'typescript' || language === 'javascript') {
        return text.includes('async');
    }
    if (language === 'python') {
        return text.includes('async def');
    }
    return false;
}
/**
 * Extrait les membres d'une classe
 */
function extractClassMembers(node, memberType, language) {
    const members = [];
    const memberNodeTypes = memberType === 'method'
        ? ['method_definition', 'function_definition', 'method']
        : ['property_definition', 'field_definition', 'property'];
    const traverse = (n) => {
        if (memberNodeTypes.includes(n.type)) {
            const name = extractSymbolName(n, memberType, language);
            if (name)
                members.push(name);
        }
        for (let i = 0; i < n.childCount; i++) {
            const child = n.child(i);
            if (child)
                traverse(child);
        }
    };
    traverse(node);
    return members;
}
/**
 * Extrait les imports
 */
function extractImports(node, language) {
    const imports = [];
    const text = node.text || '';
    if (language === 'typescript' || language === 'javascript') {
        const importMatch = text.match(/from\s+['"]([^'"]+)['"]/);
        if (importMatch)
            imports.push(importMatch[1]);
    }
    if (language === 'python') {
        const importMatch = text.match(/import\s+([\w., ]+)/);
        if (importMatch) {
            imports.push(...importMatch[1].split(',').map((s) => s.trim()));
        }
        const fromMatch = text.match(/from\s+([\w.]+)\s+import/);
        if (fromMatch)
            imports.push(fromMatch[1]);
    }
    return imports;
}
/**
 * Extrait les exports
 */
function extractExports(node, language) {
    const exports = [];
    const text = node.text || '';
    if (language === 'typescript' || language === 'javascript') {
        const exportMatch = text.match(/export\s+(?:const|let|var|function|class|interface)\s+(\w+)/);
        if (exportMatch)
            exports.push(exportMatch[1]);
    }
    return exports;
}
/**
 * Map des types de nœuds par langage et type de symbole
 */
function getNodeTypeMap(language) {
    const maps = {
        typescript: {
            function: ['function_declaration', 'arrow_function', 'function_expression'],
            class: ['class_declaration'],
            method: ['method_definition'],
            interface: ['interface_declaration'],
            type_alias: ['type_alias_declaration'],
            variable: ['variable_declaration', 'lexical_declaration'],
            constant: ['variable_declaration'],
            import: ['import_statement', 'import_declaration'],
            export: ['export_statement', 'export_declaration'],
            enum: ['enum_declaration'],
            property: [],
            unknown: [],
        },
        javascript: {
            function: ['function_declaration', 'arrow_function', 'function_expression'],
            class: ['class_declaration'],
            method: ['method_definition'],
            interface: [],
            type_alias: [],
            variable: ['variable_declaration', 'lexical_declaration'],
            constant: ['variable_declaration'],
            import: ['import_statement'],
            export: ['export_statement'],
            enum: [],
            property: [],
            unknown: [],
        },
        python: {
            function: ['function_definition'],
            class: ['class_definition'],
            method: ['function_definition'],
            interface: [],
            type_alias: [],
            variable: ['assignment'],
            constant: ['assignment'],
            import: ['import_statement', 'import_from_statement'],
            export: [],
            enum: [],
            property: [],
            unknown: [],
        },
    };
    return maps[language] || maps.typescript;
}
//# sourceMappingURL=symbol-extractor.js.map