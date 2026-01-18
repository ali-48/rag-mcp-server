// src/rag/phase0/analyzer/symbol-extraction/symbol-type-maps.ts
// Mappings des types de nœuds AST par langage et type de symbole

import { SymbolType } from '../symbol-extractor.js';

/**
 * Map des types de nœuds par langage et type de symbole
 */
export function getNodeTypeMap(language: string): Record<SymbolType, string[]> {
  const maps: Record<string, Record<SymbolType, string[]>> = {
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
export const SUPPORTED_LANGUAGES = ['typescript', 'javascript', 'python'] as const;

/**
 * Types de symboles supportés par langage
 */
export const SYMBOL_TYPES_BY_LANGUAGE: Record<string, SymbolType[]> = {
  typescript: ['function', 'class', 'method', 'interface', 'type_alias', 'variable', 'constant', 'import', 'export', 'enum'],
  javascript: ['function', 'class', 'method', 'variable', 'constant', 'import', 'export'],
  python: ['function', 'class', 'method', 'variable', 'constant', 'import'],
};

/**
 * Vérifie si un langage est supporté
 */
export function isLanguageSupported(language: string): boolean {
  return SUPPORTED_LANGUAGES.includes(language as any);
}

/**
 * Obtient les types de symboles supportés pour un langage
 */
export function getSupportedSymbolTypes(language: string): SymbolType[] {
  return SYMBOL_TYPES_BY_LANGUAGE[language] || [];
}

/**
 * Obtient les types de nœuds AST pour un type de symbole et un langage spécifiques
 */
export function getNodeTypesForSymbol(symbolType: SymbolType, language: string): string[] {
  const map = getNodeTypeMap(language);
  return map[symbolType] || [];
}
