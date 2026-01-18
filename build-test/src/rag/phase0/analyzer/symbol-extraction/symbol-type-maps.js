// src/rag/phase0/analyzer/symbol-extraction/symbol-type-maps.ts
// Mappings des types de nœuds AST par langage et type de symbole
/**
 * Map des types de nœuds par langage et type de symbole
 */
export function getNodeTypeMap(language) {
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
/**
 * Liste des langages supportés
 */
export const SUPPORTED_LANGUAGES = ['typescript', 'javascript', 'python'];
/**
 * Types de symboles supportés par langage
 */
export const SYMBOL_TYPES_BY_LANGUAGE = {
    typescript: ['function', 'class', 'method', 'interface', 'type_alias', 'variable', 'constant', 'import', 'export', 'enum'],
    javascript: ['function', 'class', 'method', 'variable', 'constant', 'import', 'export'],
    python: ['function', 'class', 'method', 'variable', 'constant', 'import'],
};
/**
 * Vérifie si un langage est supporté
 */
export function isLanguageSupported(language) {
    return SUPPORTED_LANGUAGES.includes(language);
}
/**
 * Obtient les types de symboles supportés pour un langage
 */
export function getSupportedSymbolTypes(language) {
    return SYMBOL_TYPES_BY_LANGUAGE[language] || [];
}
/**
 * Obtient les types de nœuds AST pour un type de symbole et un langage spécifiques
 */
export function getNodeTypesForSymbol(symbolType, language) {
    const map = getNodeTypeMap(language);
    return map[symbolType] || [];
}
//# sourceMappingURL=symbol-type-maps.js.map