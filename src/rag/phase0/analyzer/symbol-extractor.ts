// src/rag/phase0/analyzer/symbol-extractor.ts
// Extraction des symboles (fonctions, classes, méthodes, etc.) depuis l'AST

import { ParseResult } from '../parser/tree-sitter/parse-file.js';
import {
  ASTNodeInfo,
  extractAssociatedComment,
  extractNodeInfo,
  findNodesByType
} from './ast-utils.js';

// Import des modules refactorés
import { enrichSymbolMetadata } from './symbol-extraction/symbol-metadata-enricher.js';
import { cleanComment, extractSymbolName } from './symbol-extraction/symbol-name-extractor.js';
import { getNodeTypeMap } from './symbol-extraction/symbol-type-maps.js';

/**
 * Type de symbole extrait
 */
export type SymbolType =
  | 'function'
  | 'class'
  | 'method'
  | 'interface'
  | 'type_alias'
  | 'variable'
  | 'constant'
  | 'import'
  | 'export'
  | 'enum'
  | 'property'
  | 'unknown';

/**
 * Symbole extrait du code source
 */
export interface ExtractedSymbol {
  /** Type de symbole */
  type: SymbolType;

  /** Nom du symbole (si disponible) */
  name: string;

  /** Langage source (typescript, javascript, python, etc.) */
  language: string;

  /** Fichier source */
  filePath: string;

  /** Position dans le fichier */
  position: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };

  /** Plage de texte */
  range: {
    startIndex: number;
    endIndex: number;
  };

  /** Code source du symbole */
  code: string;

  /** Commentaire associé (docstring, JSDoc, etc.) */
  comment?: string;

  /** Métadonnées spécifiques au type */
  metadata: {
    /** Pour les fonctions/méthodes : paramètres */
    parameters?: string[];

    /** Pour les fonctions/méthodes : type de retour */
    returnType?: string;

    /** Pour les classes : méthodes */
    methods?: string[];

    /** Pour les classes : propriétés */
    properties?: string[];

    /** Pour les imports : modules importés */
    imports?: string[];

    /** Pour les exports : ce qui est exporté */
    exports?: string[];

    /** Complexité cyclomatique (pour les fonctions) */
    complexity?: number;

    /** Visibilité (public, private, protected) */
    visibility?: 'public' | 'private' | 'protected';

    /** Est statique ? */
    isStatic?: boolean;

    /** Est asynchrone ? */
    isAsync?: boolean;
  };

  /** Informations sur le nœud AST */
  astInfo: ASTNodeInfo;
}

/**
 * Configuration de l'extraction
 */
export interface ExtractionConfig {
  /** Extraire les commentaires */
  extractComments?: boolean;

  /** Calculer la complexité */
  calculateComplexity?: boolean;

  /** Types de symboles à extraire */
  symbolTypes?: SymbolType[];

  /** Niveau de détail */
  detailLevel?: 'minimal' | 'standard' | 'full';
}

/**
 * Résultat de l'extraction
 */
export interface ExtractionResult {
  /** Fichier source */
  filePath: string;

  /** Langage */
  language: string;

  /** Symboles extraits */
  symbols: ExtractedSymbol[];

  /** Statistiques */
  stats: {
    totalSymbols: number;
    byType: Record<SymbolType, number>;
    extractionTime: number;
  };
}

/**
 * Extrait les symboles d'un résultat de parsing
 */
export function extractSymbols(
  parseResult: ParseResult,
  config: ExtractionConfig = {}
): ExtractionResult {
  const startTime = Date.now();
  const { filePath, language, ast, sourceCode } = parseResult;

  const defaultConfig: ExtractionConfig = {
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
        byType: {} as Record<SymbolType, number>,
        extractionTime: Date.now() - startTime,
      },
    };
  }

  const symbols: ExtractedSymbol[] = [];
  const byType: Record<SymbolType, number> = {} as Record<SymbolType, number>;

  // Définir les types de nœuds à extraire par langage
  const nodeTypeMap = getNodeTypeMap(language);

  // Extraire chaque type de symbole
  for (const [symbolType, nodeTypes] of Object.entries(nodeTypeMap)) {
    if (!finalConfig.symbolTypes?.includes(symbolType as SymbolType)) {
      continue;
    }

    for (const nodeType of nodeTypes) {
      const nodes = findNodesByType(ast, nodeType);

      for (const node of nodes) {
        const symbol = extractSymbolFromNode(
          node,
          symbolType as SymbolType,
          language,
          filePath,
          sourceCode,
          finalConfig
        );

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
function extractSymbolFromNode(
  node: any,
  symbolType: SymbolType,
  language: string,
  filePath: string,
  sourceCode: string,
  config: ExtractionConfig
): ExtractedSymbol | null {
  try {
    const astInfo = extractNodeInfo(node, sourceCode);

    // Extraire le nom du symbole
    const name = extractSymbolName(node, symbolType, language) || 'anonymous';

    // Extraire le commentaire associé
    let comment: string | undefined;
    if (config.extractComments) {
      const rawComment = extractAssociatedComment(node, sourceCode);
      if (rawComment) {
        comment = cleanComment(rawComment, language);
      }
    }

    // Construire le symbole
    const symbol: ExtractedSymbol = {
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

  } catch (error) {
    console.warn(`Erreur lors de l'extraction du symbole: ${error}`);
    return null;
  }
}
