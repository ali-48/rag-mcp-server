// src/rag/phase0/analyzer/ast-utils.ts
// Utilitaires pour manipuler les AST Tree-sitter
/**
 * Extrait les informations d'un nœud AST
 */
export function extractNodeInfo(node, sourceCode) {
    const info = {
        type: node.type,
        position: {
            startLine: node.startPosition.row + 1,
            startColumn: node.startPosition.column + 1,
            endLine: node.endPosition.row + 1,
            endColumn: node.endPosition.column + 1,
        },
        range: {
            startIndex: node.startIndex,
            endIndex: node.endIndex,
        },
        childCount: node.childCount,
        properties: {},
    };
    // Extraire le texte si le code source est fourni
    if (sourceCode && node.startIndex !== undefined && node.endIndex !== undefined) {
        info.text = sourceCode.substring(node.startIndex, node.endIndex);
    }
    // Extraire les propriétés spécifiques selon le type de nœud
    extractNodeProperties(node, info.properties);
    return info;
}
/**
 * Extrait les propriétés spécifiques d'un nœud
 */
function extractNodeProperties(node, properties) {
    // Propriétés communes
    if (node.name) {
        properties.name = node.name.text || node.name;
    }
    if (node.value) {
        properties.value = node.value.text || node.value;
    }
    // Propriétés spécifiques aux fonctions
    if (node.type.includes('function') || node.type.includes('method')) {
        extractFunctionProperties(node, properties);
    }
    // Propriétés spécifiques aux classes
    if (node.type.includes('class')) {
        extractClassProperties(node, properties);
    }
    // Propriétés spécifiques aux imports
    if (node.type.includes('import')) {
        extractImportProperties(node, properties);
    }
}
/**
 * Extrait les propriétés d'une fonction/méthode
 */
function extractFunctionProperties(node, properties) {
    properties.kind = 'function';
    // Rechercher les paramètres
    const parameters = [];
    const returnType = [];
    const traverse = (n) => {
        if (n.type === 'formal_parameters' || n.type === 'parameters') {
            properties.hasParameters = true;
        }
        if (n.type === 'identifier' && n.parent?.type?.includes('parameter')) {
            parameters.push(n.text || n.type);
        }
        if (n.type === 'type_annotation' || n.type === 'return_type') {
            returnType.push(n.text || n.type);
        }
        for (let i = 0; i < n.childCount; i++) {
            const child = n.child(i);
            if (child)
                traverse(child);
        }
    };
    traverse(node);
    if (parameters.length > 0) {
        properties.parameters = parameters;
    }
    if (returnType.length > 0) {
        properties.returnType = returnType.join(' ');
    }
}
/**
 * Extrait les propriétés d'une classe
 */
function extractClassProperties(node, properties) {
    properties.kind = 'class';
    // Rechercher les méthodes et propriétés
    const methods = [];
    const propertiesList = [];
    const traverse = (n) => {
        if (n.type.includes('method')) {
            methods.push(n.name?.text || 'anonymous');
        }
        if (n.type.includes('property') || n.type === 'field_definition') {
            propertiesList.push(n.name?.text || 'anonymous');
        }
        for (let i = 0; i < n.childCount; i++) {
            const child = n.child(i);
            if (child)
                traverse(child);
        }
    };
    traverse(node);
    if (methods.length > 0) {
        properties.methods = methods;
    }
    if (propertiesList.length > 0) {
        properties.classProperties = propertiesList;
    }
}
/**
 * Extrait les propriétés d'un import
 */
function extractImportProperties(node, properties) {
    properties.kind = 'import';
    // Extraire le module importé
    const imports = [];
    const traverse = (n) => {
        if (n.type === 'string' || n.type === 'import_source') {
            const importText = n.text || '';
            if (importText) {
                imports.push(importText.replace(/['"]/g, ''));
            }
        }
        if (n.type === 'identifier' && n.parent?.type?.includes('import')) {
            imports.push(n.text || n.type);
        }
        for (let i = 0; i < n.childCount; i++) {
            const child = n.child(i);
            if (child)
                traverse(child);
        }
    };
    traverse(node);
    if (imports.length > 0) {
        properties.imports = imports;
    }
}
/**
 * Parcourt l'AST et exécute un callback sur chaque nœud
 */
export function traverseAST(ast, callback) {
    if (!ast || !ast.rootNode)
        return;
    const traverse = (node, depth) => {
        callback(node, depth);
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child)
                traverse(child, depth + 1);
        }
    };
    traverse(ast.rootNode, 0);
}
/**
 * Recherche des nœuds par type
 */
export function findNodesByType(ast, nodeType) {
    const nodes = [];
    const types = Array.isArray(nodeType) ? nodeType : [nodeType];
    traverseAST(ast, (node) => {
        if (types.includes(node.type)) {
            nodes.push(node);
        }
    });
    return nodes;
}
/**
 * Recherche des nœuds par plage de texte
 */
export function findNodesInRange(ast, range) {
    const nodes = [];
    traverseAST(ast, (node) => {
        if (node.startIndex >= range.startIndex &&
            node.endIndex <= range.endIndex) {
            nodes.push(node);
        }
    });
    return nodes;
}
/**
 * Obtient le nœud parent d'un type spécifique
 */
export function getParentOfType(node, parentType) {
    let current = node.parent;
    while (current) {
        if (current.type === parentType) {
            return current;
        }
        current = current.parent;
    }
    return null;
}
/**
 * Vérifie si un nœud contient un commentaire
 */
export function hasComment(node, sourceCode) {
    // Rechercher les commentaires avant le nœud
    const commentTypes = ['comment', 'block_comment', 'line_comment'];
    let current = node.prevSibling;
    while (current) {
        if (commentTypes.includes(current.type)) {
            return true;
        }
        current = current.prevSibling;
    }
    // Vérifier les commentaires dans le nœud lui-même
    const nodes = findNodesByType({ rootNode: node }, commentTypes);
    return nodes.length > 0;
}
/**
 * Extrait le commentaire associé à un nœud
 */
export function extractAssociatedComment(node, sourceCode) {
    const commentTypes = ['comment', 'block_comment', 'line_comment'];
    // Rechercher le commentaire précédent immédiat
    let current = node.prevSibling;
    while (current) {
        if (commentTypes.includes(current.type)) {
            return sourceCode.substring(current.startIndex, current.endIndex);
        }
        current = current.prevSibling;
    }
    return null;
}
/**
 * Calcule la complexité cyclomatique d'une fonction (approximation)
 */
export function estimateCyclomaticComplexity(functionNode) {
    let complexity = 1; // Base complexity
    const controlFlowTypes = [
        'if_statement',
        'else_clause',
        'for_statement',
        'while_statement',
        'do_statement',
        'switch_statement',
        'case_clause',
        'catch_clause',
        'conditional_expression',
        'logical_operator',
    ];
    traverseAST({ rootNode: functionNode }, (node) => {
        if (controlFlowTypes.includes(node.type)) {
            complexity++;
        }
    });
    return complexity;
}
//# sourceMappingURL=ast-utils.js.map