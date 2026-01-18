// src/rag/phase0/analyzer/symbol-extraction/symbol-metadata-enricher.ts
// Enrichissement des métadonnées des symboles
import { estimateCyclomaticComplexity } from '../ast-utils.js';
/**
 * Enrichit les métadonnées d'un symbole
 */
export function enrichSymbolMetadata(symbol, node, sourceCode, config) {
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
export function extractParameters(node, language) {
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
export function extractReturnType(node, language) {
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
export function extractVisibility(node, language) {
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
export function isStatic(node, language) {
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
export function isAsync(node, language) {
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
export function extractClassMembers(node, memberType, language) {
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
export function extractImports(node, language) {
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
export function extractExports(node, language) {
    const exports = [];
    const text = node.text || '';
    if (language === 'typescript' || language === 'javascript') {
        const exportMatch = text.match(/export\s+(?:const|let|var|function|class|interface)\s+(\w+)/);
        if (exportMatch)
            exports.push(exportMatch[1]);
    }
    return exports;
}
// Fonctions utilitaires importées depuis symbol-name-extractor
import { extractSymbolName, findChildByType, findNameNode } from './symbol-name-extractor.js';
//# sourceMappingURL=symbol-metadata-enricher.js.map