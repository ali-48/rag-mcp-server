// src/rag/phase0/analyzer/symbol-extractor.ts
// Extraction des symboles (fonctions, classes, méthodes, etc.) depuis l'AST

import { ParseResult } from '../parser/tree-sitter/parse-file.js';
import {
    ASTNodeInfo,
    estimateCyclomaticComplexity,
    extractAssociatedComment,
    extractNodeInfo,
    findNodesByType
} from './ast-utils.js';

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

/**
 * Extrait le nom d'un symbole depuis un nœud AST
 */
function extractSymbolName(node: any, symbolType: SymbolType, language: string): string | null {
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
function findNameNode(node: any, language: string): any | null {
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
function findChildByType(node: any, types: string[]): any | null {
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
function extractImportExportName(node: any, language: string): string {
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

/**
 * Nettoie un commentaire (enlève les marqueurs de commentaire)
 */
function cleanComment(comment: string, language: string): string {
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
function enrichSymbolMetadata(
    symbol: ExtractedSymbol,
    node: any,
    sourceCode: string,
    config: ExtractionConfig
): void {
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
function extractParameters(node: any, language: string): string[] {
    const parameters: string[] = [];

    const traverse = (n: any) => {
        if (n.type.includes('parameter') || n.type === 'formal_parameter') {
            const paramName = findNameNode(n, language);
            if (paramName?.text) {
                parameters.push(paramName.text);
            }
        }

        for (let i = 0; i < n.childCount; i++) {
            const child = n.child(i);
            if (child) traverse(child);
        }
    };

    traverse(node);
    return parameters;
}

/**
 * Extrait le type de retour d'une fonction/méthode
 */
function extractReturnType(node: any, language: string): string | undefined {
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
function extractVisibility(node: any, language: string): 'public' | 'private' | 'protected' {
    const text = node.text || '';

    if (language === 'typescript' || language === 'javascript') {
        if (text.includes('private')) return 'private';
        if (text.includes('protected')) return 'protected';
        if (text.includes('public')) return 'public';
    }

    if (language === 'python') {
        // En Python, les méthodes commençant par __ sont privées
        const name = extractSymbolName(node, 'method', language);
        if (name?.startsWith('__')) return 'private';
    }

    return 'public'; // Par défaut
}

/**
 * Vérifie si un symbole est statique
 */
function isStatic(node: any, language: string): boolean {
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
function isAsync(node: any, language: string): boolean {
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
function extractClassMembers(node: any, memberType: 'method' | 'property', language: string): string[] {
    const members: string[] = [];
    const memberNodeTypes = memberType === 'method'
        ? ['method_definition', 'function_definition', 'method']
        : ['property_definition', 'field_definition', 'property'];

    const traverse = (n: any) => {
        if (memberNodeTypes.includes(n.type)) {
            const name = extractSymbolName(n, memberType, language);
            if (name) members.push(name);
        }

        for (let i = 0; i < n.childCount; i++) {
            const child = n.child(i);
            if (child) traverse(child);
        }
    };

    traverse(node);
    return members;
}

/**
 * Extrait les imports
 */
function extractImports(node: any, language: string): string[] {
    const imports: string[] = [];
    const text = node.text || '';

    if (language === 'typescript' || language === 'javascript') {
        const importMatch = text.match(/from\s+['"]([^'"]+)['"]/);
        if (importMatch) imports.push(importMatch[1]);
    }

    if (language === 'python') {
        const importMatch = text.match(/import\s+([\w., ]+)/);
        if (importMatch) {
            imports.push(...importMatch[1].split(',').map((s: string) => s.trim()));
        }

        const fromMatch = text.match(/from\s+([\w.]+)\s+import/);
        if (fromMatch) imports.push(fromMatch[1]);
    }

    return imports;
}

/**
 * Extrait les exports
 */
function extractExports(node: any, language: string): string[] {
    const exports: string[] = [];
    const text = node.text || '';

    if (language === 'typescript' || language === 'javascript') {
        const exportMatch = text.match(/export\s+(?:const|let|var|function|class|interface)\s+(\w+)/);
        if (exportMatch) exports.push(exportMatch[1]);
    }

    return exports;
}

/**
 * Map des types de nœuds par langage et type de symbole
 */
function getNodeTypeMap(language: string): Record<SymbolType, string[]> {
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
