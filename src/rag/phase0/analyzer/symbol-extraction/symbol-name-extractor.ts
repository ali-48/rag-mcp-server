// src/rag/phase0/analyzer/symbol-extraction/symbol-name-extractor.ts
// Extraction des noms de symboles depuis les nœuds AST

import { cleanComment } from '../../../../core/utils/string-utils.js';
import { SymbolType } from '../symbol-extractor.js';

export { cleanComment };

/**
 * Extrait le nom d'un symbole depuis un nœud AST
 */
export function extractSymbolName(node: any, symbolType: SymbolType, language: string): string | null {
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
export function findNameNode(node: any, language: string): any | null {
  // Recherche récursive d'un nœud 'identifier', 'name', ou similaire
  const nameNodeTypes = ['identifier', 'name', 'variable_name', 'function_name'];

  const traverse = (n: any): any | null => {
    if (nameNodeTypes.includes(n.type)) {
      return n;
    }

    for (let i = 0; i < n.childCount; i++) {
      const child = n.child(i);
      if (child) {
        const result = traverse(child);
        if (result) return result;
      }
    }

    return null;
  };

  return traverse(node);
}

/**
 * Recherche un enfant par type
 */
export function findChildByType(node: any, types: string[]): any | null {
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
export function extractImportExportName(node: any, language: string): string {
  // Essayer d'extraire le module ou l'élément importé/exporté
  const text = node.text || '';

  if (language === 'typescript' || language === 'javascript') {
    // Extraire le chemin du module ou le nom de l'export
    const importMatch = text.match(/from\s+['"]([^'"]+)['"]/);
    if (importMatch) return importMatch[1];

    const exportMatch = text.match(/export\s+(?:const|let|var|function|class|interface)\s+(\w+)/);
    if (exportMatch) return exportMatch[1];
  }

  if (language === 'python') {
    const importMatch = text.match(/import\s+(\w+)/);
    if (importMatch) return importMatch[1];

    const fromMatch = text.match(/from\s+([\w.]+)\s+import/);
    if (fromMatch) return fromMatch[1];
  }

  return 'unknown';
}
