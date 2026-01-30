// src/rag/phase0/chunker/chunker-intelligent.ts
// Chunker intelligent basé sur l'AST Tree-sitter
import { ChunkFactory, ChunkValidator } from './chunk-schema.js';
/**
 * Chunker intelligent
 */
export class IntelligentChunker {
    config;
    rules;
    functionTypes;
    classTypes;
    blockTypes;
    constructor(config = {}) {
        // Initialiser les propriétés avec des valeurs par défaut
        this.functionTypes = new Set();
        this.classTypes = new Set();
        this.blockTypes = new Set();
        const defaultConfig = {
            granularity: 'atomic',
            chunkTypes: ['function', 'class', 'method', 'interface', 'import', 'export', 'type_definition'],
            maxChunkSize: 1000,
            minChunkSize: 50,
            chunkOverlap: 100,
            includeDocumentation: true,
            includeContext: false,
            calculateQualityScores: true,
            extractRelations: true,
            detailLevel: 'standard',
            rules: {
                neverSplitFunctions: true,
                neverSplitClasses: true,
                neverMixCodeAndText: true,
                respectSemanticBoundaries: true,
                groupImports: true,
                groupExports: true,
                collapseLargeFunctions: true,
                collapseLargeClasses: true,
                preferFunctions: true,
            },
        };
        this.config = { ...defaultConfig, ...config };
        this.rules = this.initializeRules();
        this.initializeNodeTypes();
    }
    /**
     * Initialise les types de nœuds par langage (inspiré de QwenRag)
     */
    initializeNodeTypes() {
        // Types de nœuds pour les fonctions (multi-langages) - AMÉLIORÉ
        this.functionTypes = new Set([
            // TypeScript/JavaScript - Types étendus
            'function_declaration', 'function_expression', 'arrow_function',
            'method_definition', 'generator_function', 'async_function_declaration',
            'async_arrow_function', 'async_function_expression', 'method_declaration',
            'constructor_definition', 'getter', 'setter',
            // Python - Types étendus
            'function_definition', 'async_function_definition', 'lambda',
            'decorated_definition', 'decorator',
            // Java
            'method_declaration', 'constructor_declaration',
            // C/C++
            'function_definition', 'function_declarator',
            // Rust
            'function_item', 'method_declaration',
            // Go
            'function_declaration', 'method_declaration',
            // C#
            'method_declaration', 'constructor_declaration',
            // Générique
            'function', 'method', 'constructor'
        ]);
        // Types de nœuds pour les classes (multi-langages) - AMÉLIORÉ
        this.classTypes = new Set([
            // TypeScript/JavaScript - Types étendus
            'class_declaration', 'class_expression', 'abstract_class_declaration',
            'interface_declaration', 'type_alias_declaration', 'enum_declaration',
            'type_parameter', 'generic_type',
            // Python - Types étendus
            'class_definition', 'decorated_class',
            // Java
            'class_declaration', 'interface_declaration',
            // C/C++
            'class_specifier', 'struct_specifier',
            // Rust
            'struct_item', 'impl_item', 'trait_item', 'enum_item',
            // Go
            'type_spec', 'struct_type', 'interface_type',
            // C#
            'class_declaration', 'struct_declaration', 'interface_declaration',
            // Générique
            'class', 'interface', 'struct', 'enum', 'trait'
        ]);
        // Types de nœuds pour les blocs - AMÉLIORÉ
        this.blockTypes = new Set([
            'block', 'statement_block', 'compound_statement',
            'function_body', 'class_body', 'declaration_list',
            // Blocs conditionnels et de contrôle
            'if_statement', 'else_clause', 'for_statement', 'while_statement',
            'do_statement', 'switch_statement', 'case_clause', 'default_clause',
            'try_statement', 'catch_clause', 'finally_clause',
            // Python spécifique
            'with_statement', 'match_statement', 'try_statement',
            // Imports et exports
            'import_statement', 'import_declaration', 'import_from_statement',
            'export_statement', 'export_declaration', 'namespace_import', 'named_imports'
        ]);
    }
    /**
     * Initialise les règles de chunking
     */
    initializeRules() {
        return [
            // Règle 1: Fonctions complètes
            {
                name: 'function_chunk',
                description: 'Extrait les fonctions complètes comme chunks atomiques',
                condition: (node, context) => {
                    const functionTypes = ['function_declaration', 'arrow_function', 'function_expression'];
                    return functionTypes.includes(node.type) &&
                        context.config.rules?.neverSplitFunctions === true;
                },
                action: (node, context) => {
                    const sourceCode = context.parseResult.sourceCode;
                    const code = sourceCode.substring(node.startIndex, node.endIndex);
                    return [ChunkFactory.createChunk('function', 'atomic', code, {
                            tags: ['function', 'atomic', context.parseResult.language],
                            complexity: this.estimateComplexity(node),
                            typeSpecific: {
                                function: {
                                    parameters: this.extractParameters(node, context.parseResult.language),
                                    returnType: this.extractReturnType(node, context.parseResult.language),
                                    isAsync: this.isAsync(node, context.parseResult.language),
                                    isStatic: this.isStatic(node, context.parseResult.language),
                                    visibility: this.extractVisibility(node, context.parseResult.language),
                                },
                            },
                        }, context.parseResult.filePath, context.parseResult.language, {
                            startLine: node.startPosition.row + 1,
                            startColumn: node.startPosition.column + 1,
                            endLine: node.endPosition.row + 1,
                            endColumn: node.endPosition.column + 1,
                        })];
                },
                priority: 100,
            },
            // Règle 2: Classes complètes (mode atomique)
            {
                name: 'class_chunk',
                description: 'Extrait les classes complètes comme chunks atomiques',
                condition: (node, context) => {
                    const classTypes = ['class_declaration', 'class_definition'];
                    return classTypes.includes(node.type) &&
                        context.config.rules?.neverSplitClasses === true;
                },
                action: (node, context) => {
                    const sourceCode = context.parseResult.sourceCode;
                    const code = sourceCode.substring(node.startIndex, node.endIndex);
                    return [ChunkFactory.createChunk('class', 'atomic', code, {
                            tags: ['class', 'atomic', context.parseResult.language],
                            complexity: this.estimateComplexity(node),
                            typeSpecific: {
                                class: {
                                    methods: this.extractClassMethods(node, context.parseResult.language),
                                    properties: this.extractClassProperties(node, context.parseResult.language),
                                    extends: this.extractExtends(node, context.parseResult.language),
                                    implements: this.extractImplements(node, context.parseResult.language),
                                },
                            },
                        }, context.parseResult.filePath, context.parseResult.language, {
                            startLine: node.startPosition.row + 1,
                            startColumn: node.startPosition.column + 1,
                            endLine: node.endPosition.row + 1,
                            endColumn: node.endPosition.column + 1,
                        })];
                },
                priority: 90,
            },
            // Règle 2b: Classes hiérarchiques (1 classe = N chunks)
            {
                name: 'class_hierarchical_chunk',
                description: 'Divise les classes complexes en chunks hiérarchiques',
                condition: (node, context) => {
                    const classTypes = ['class_declaration', 'class_definition'];
                    return classTypes.includes(node.type) &&
                        context.config.rules?.neverSplitClasses === false &&
                        this.shouldSplitClass(node, context.parseResult.language);
                },
                action: (node, context) => {
                    const sourceCode = context.parseResult.sourceCode;
                    const chunks = [];
                    // 1. Chunk pour la définition de classe
                    const classDefinition = this.extractClassDefinition(node, sourceCode);
                    if (classDefinition) {
                        chunks.push(ChunkFactory.createChunk('class', 'atomic', classDefinition, {
                            tags: ['class', 'definition', 'atomic', context.parseResult.language],
                            complexity: this.estimateComplexity(node),
                            typeSpecific: {
                                class: {
                                    methods: this.extractClassMethods(node, context.parseResult.language),
                                    properties: this.extractClassProperties(node, context.parseResult.language),
                                    extends: this.extractExtends(node, context.parseResult.language),
                                    implements: this.extractImplements(node, context.parseResult.language),
                                },
                            },
                        }, context.parseResult.filePath, context.parseResult.language, {
                            startLine: node.startPosition.row + 1,
                            startColumn: node.startPosition.column + 1,
                            endLine: node.startPosition.row + 3, // Juste la définition
                            endColumn: node.startPosition.column + classDefinition.split('\n')[0].length,
                        }));
                    }
                    // 2. Chunks pour les méthodes (groupées par visibilité)
                    const methods = this.extractClassMethodsWithDetails(node, context.parseResult.language, sourceCode);
                    const groupedMethods = this.groupMethodsByVisibility(methods);
                    for (const [visibility, methodGroup] of Object.entries(groupedMethods)) {
                        if (methodGroup.length > 0) {
                            const methodChunks = this.createMethodGroupChunks(methodGroup, context.parseResult.filePath, context.parseResult.language, visibility);
                            chunks.push(...methodChunks);
                        }
                    }
                    // 3. Chunk pour les propriétés
                    const properties = this.extractClassPropertiesWithDetails(node, context.parseResult.language, sourceCode);
                    if (properties.length > 0) {
                        const propertyChunk = this.createPropertyGroupChunk(properties, context.parseResult.filePath, context.parseResult.language);
                        chunks.push(propertyChunk);
                    }
                    return chunks;
                },
                priority: 85,
            },
            // Règle 3: Imports groupés
            {
                name: 'import_chunk',
                description: 'Regroupe les imports en un seul chunk',
                condition: (node, context) => {
                    const importTypes = ['import_statement', 'import_declaration', 'import_from_statement'];
                    return importTypes.includes(node.type) &&
                        context.config.rules?.groupImports === true;
                },
                action: (node, context) => {
                    const sourceCode = context.parseResult.sourceCode;
                    const code = sourceCode.substring(node.startIndex, node.endIndex);
                    return [ChunkFactory.createChunk('import', 'logical', code, {
                            tags: ['import', 'dependency', context.parseResult.language],
                            typeSpecific: {
                                import: {
                                    modules: this.extractImportModules(node, context.parseResult.language),
                                    isRelative: this.isRelativeImport(code),
                                    importType: this.determineImportType(code),
                                },
                            },
                        }, context.parseResult.filePath, context.parseResult.language, {
                            startLine: node.startPosition.row + 1,
                            startColumn: node.startPosition.column + 1,
                            endLine: node.endPosition.row + 1,
                            endColumn: node.endPosition.column + 1,
                        })];
                },
                priority: 80,
            },
            // Règle 4: Interfaces
            {
                name: 'interface_chunk',
                description: 'Extrait les interfaces complètes',
                condition: (node, context) => {
                    return node.type === 'interface_declaration';
                },
                action: (node, context) => {
                    const sourceCode = context.parseResult.sourceCode;
                    const code = sourceCode.substring(node.startIndex, node.endIndex);
                    return [ChunkFactory.createChunk('interface', 'atomic', code, {
                            tags: ['interface', 'type', 'atomic', context.parseResult.language],
                        }, context.parseResult.filePath, context.parseResult.language, {
                            startLine: node.startPosition.row + 1,
                            startColumn: node.startPosition.column + 1,
                            endLine: node.endPosition.row + 1,
                            endColumn: node.endPosition.column + 1,
                        })];
                },
                priority: 70,
            },
            // Règle 5: Exports
            {
                name: 'export_chunk',
                description: 'Extrait les exports',
                condition: (node, context) => {
                    const exportTypes = ['export_statement', 'export_declaration'];
                    return exportTypes.includes(node.type);
                },
                action: (node, context) => {
                    const sourceCode = context.parseResult.sourceCode;
                    const code = sourceCode.substring(node.startIndex, node.endIndex);
                    return [ChunkFactory.createChunk('export', 'logical', code, {
                            tags: ['export', 'module', context.parseResult.language],
                        }, context.parseResult.filePath, context.parseResult.language, {
                            startLine: node.startPosition.row + 1,
                            startColumn: node.startPosition.column + 1,
                            endLine: node.endPosition.row + 1,
                            endColumn: node.endPosition.column + 1,
                        })];
                },
                priority: 60,
            },
            // Règle 6: Blocs logiques (if, for, while, etc.)
            {
                name: 'block_chunk',
                description: 'Extrait les blocs logiques importants',
                condition: (node, context) => {
                    const blockTypes = [
                        'if_statement', 'for_statement', 'while_statement',
                        'try_statement', 'switch_statement', 'with_statement'
                    ];
                    return blockTypes.includes(node.type) &&
                        context.config.granularity === 'logical';
                },
                action: (node, context) => {
                    const sourceCode = context.parseResult.sourceCode;
                    const code = sourceCode.substring(node.startIndex, node.endIndex);
                    const blockType = this.determineBlockType(node.type);
                    return [ChunkFactory.createChunk('block', 'logical', code, {
                            tags: ['block', blockType, 'logical', context.parseResult.language],
                            complexity: this.estimateComplexity(node),
                        }, context.parseResult.filePath, context.parseResult.language, {
                            startLine: node.startPosition.row + 1,
                            startColumn: node.startPosition.column + 1,
                            endLine: node.endPosition.row + 1,
                            endColumn: node.endPosition.column + 1,
                        })];
                },
                priority: 50,
            },
            // Règle 7: Commentaires/documentation importants
            {
                name: 'comment_chunk',
                description: 'Extrait les commentaires et documentation importants',
                condition: (node, context) => {
                    const commentTypes = ['comment', 'block_comment', 'line_comment', 'docstring'];
                    return commentTypes.includes(node.type) &&
                        context.config.includeDocumentation === true;
                },
                action: (node, context) => {
                    const sourceCode = context.parseResult.sourceCode;
                    const code = sourceCode.substring(node.startIndex, node.endIndex);
                    // Ignorer les commentaires trop courts
                    if (code.length < 50)
                        return [];
                    return [ChunkFactory.createChunk('comment', 'atomic', code, {
                            tags: ['documentation', 'comment', context.parseResult.language],
                        }, context.parseResult.filePath, context.parseResult.language, {
                            startLine: node.startPosition.row + 1,
                            startColumn: node.startPosition.column + 1,
                            endLine: node.endPosition.row + 1,
                            endColumn: node.endPosition.column + 1,
                        })];
                },
                priority: 40,
            },
            // Règle 8: Définitions de type
            {
                name: 'type_definition_chunk',
                description: 'Extrait les définitions de type (type alias, enum, etc.)',
                condition: (node, context) => {
                    const typeTypes = ['type_alias_declaration', 'enum_declaration'];
                    return typeTypes.includes(node.type);
                },
                action: (node, context) => {
                    const sourceCode = context.parseResult.sourceCode;
                    const code = sourceCode.substring(node.startIndex, node.endIndex);
                    return [ChunkFactory.createChunk('type_definition', 'atomic', code, {
                            tags: ['type', 'definition', 'atomic', context.parseResult.language],
                        }, context.parseResult.filePath, context.parseResult.language, {
                            startLine: node.startPosition.row + 1,
                            startColumn: node.startPosition.column + 1,
                            endLine: node.endPosition.row + 1,
                            endColumn: node.endPosition.column + 1,
                        })];
                },
                priority: 30,
            },
        ];
    }
    /**
     * Exécute le chunking sur un résultat de parsing
     */
    async chunk(parseResult, semanticUnits) {
        const startTime = Date.now();
        const { filePath, language, ast, sourceCode } = parseResult;
        if (!ast) {
            return this.createEmptyResult(filePath, language);
        }
        // DEBUG: Log l'AST
        console.log(`[DEBUG CHUNKER] AST pour ${filePath}:`, {
            type: ast.rootNode?.type || 'unknown',
            hasRootNode: !!ast.rootNode,
            childCount: ast.rootNode?.childCount || 0,
            textLength: sourceCode.length
        });
        // Initialiser le contexte
        const context = {
            parseResult,
            semanticUnits,
            config: this.config,
            state: {
                chunks: [],
                currentPosition: 0,
                accumulatedContext: [],
                detectedRelations: new Map(),
            },
        };
        // Obtenir le nœud racine de l'AST
        const rootNode = ast.rootNode;
        if (!rootNode) {
            console.warn(`[DEBUG CHUNKER] Pas de rootNode dans AST, retour résultat vide`);
            return this.createEmptyResult(filePath, language);
        }
        // DEBUG: Log le root node
        console.log(`[DEBUG CHUNKER] Root node:`, {
            type: rootNode.type,
            childCount: rootNode.childCount,
            startPosition: rootNode.startPosition,
            endPosition: rootNode.endPosition
        });
        // Appliquer les règles sur l'AST
        this.applyRulesToAST(rootNode, context);
        // DEBUG: Log les chunks après application des règles
        console.log(`[DEBUG CHUNKER] Chunks après applyRulesToAST:`, context.state.chunks.length);
        // Appliquer les règles non négociables
        this.applyNonNegotiableRules(context);
        // Trier les chunks par position
        context.state.chunks.sort((a, b) => a.metadata.provenance.position.startLine - b.metadata.provenance.position.startLine);
        // Extraire les relations si configuré
        if (this.config.extractRelations) {
            this.extractRelations(context);
        }
        // Calculer les statistiques
        const stats = this.calculateStats(context.state.chunks, Date.now() - startTime);
        const qualityMetrics = this.calculateQualityMetrics(context.state.chunks);
        return {
            filePath,
            language,
            chunks: context.state.chunks,
            stats,
            qualityMetrics,
        };
    }
    /**
     * Applique les règles non négociables
     */
    applyNonNegotiableRules(context) {
        const chunks = context.state.chunks;
        const newChunks = [];
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            // Règle 1: Vérifier qu'aucun chunk ne mélange code et texte
            if (this.config.rules?.neverMixCodeAndText === true) {
                if (this.isMixedCodeAndText(chunk)) {
                    console.warn(`Chunk ${chunk.id} mélange code et texte - il sera ignoré`);
                    continue;
                }
            }
            // Règle 2: Vérifier que les fonctions ne sont pas coupées
            if (chunk.type === 'function' && this.config.rules?.neverSplitFunctions === true) {
                if (this.isFunctionSplit(chunk, context)) {
                    console.warn(`Chunk ${chunk.id} semble être une fonction coupée - il sera ignoré`);
                    continue;
                }
            }
            // Règle 3: Vérifier que les classes ne sont pas coupées
            if (chunk.type === 'class' && this.config.rules?.neverSplitClasses === true) {
                if (this.isClassSplit(chunk, context)) {
                    console.warn(`Chunk ${chunk.id} semble être une classe coupée - il sera ignoré`);
                    continue;
                }
            }
            // Règle 4: Vérifier que chaque chunk représente une intention logique unique
            if (this.config.rules?.respectSemanticBoundaries === true) {
                if (!this.hasSingleLogicalIntent(chunk)) {
                    console.warn(`Chunk ${chunk.id} a plusieurs intentions logiques - il sera ignoré`);
                    continue;
                }
            }
            newChunks.push(chunk);
        }
        context.state.chunks = newChunks;
    }
    /**
     * Vérifie si un chunk mélange code et texte
     */
    isMixedCodeAndText(chunk) {
        const code = chunk.content.code;
        // Compter les lignes de code vs commentaires
        const lines = code.split('\n');
        let codeLines = 0;
        let commentLines = 0;
        let textLines = 0;
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length === 0) {
                continue;
            }
            // Détecter les commentaires
            if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') ||
                trimmed.startsWith('#') || trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
                commentLines++;
            }
            // Détecter le texte (lignes sans caractères de code typiques)
            else if (!this.containsCodeCharacters(trimmed)) {
                textLines++;
            }
            else {
                codeLines++;
            }
        }
        // Si on a à la fois du code et du texte (hors commentaires), c'est un mélange
        return codeLines > 0 && textLines > 0;
    }
    /**
     * Vérifie si une ligne contient des caractères de code
     */
    containsCodeCharacters(line) {
        // Caractères typiques du code
        const codeChars = ['{', '}', '(', ')', '[', ']', '=', ':', ';', '<', '>', '+', '-', '*', '/', '%', '&', '|', '!', '?', '.'];
        return codeChars.some(char => line.includes(char));
    }
    /**
     * Vérifie si une fonction est coupée
     */
    isFunctionSplit(chunk, context) {
        const code = chunk.content.code;
        // Vérifier les balises d'ouverture/fermeture de fonction
        const hasOpeningBrace = code.includes('{');
        const hasClosingBrace = code.includes('}');
        // Pour les fonctions Python
        const hasDef = code.includes('def ');
        const hasColon = code.includes(':');
        if (chunk.metadata.language === 'python') {
            return hasDef && (!hasColon || !this.hasProperIndentation(code));
        }
        else {
            return (hasOpeningBrace && !hasClosingBrace) || (!hasOpeningBrace && hasClosingBrace);
        }
    }
    /**
     * Vérifie si une classe est coupée
     */
    isClassSplit(chunk, context) {
        const code = chunk.content.code;
        // Vérifier les balises d'ouverture/fermeture de classe
        const hasOpeningBrace = code.includes('{');
        const hasClosingBrace = code.includes('}');
        // Pour les classes Python
        const hasClass = code.includes('class ');
        const hasColon = code.includes(':');
        if (chunk.metadata.language === 'python') {
            return hasClass && (!hasColon || !this.hasProperIndentation(code));
        }
        else {
            return (hasOpeningBrace && !hasClosingBrace) || (!hasOpeningBrace && hasClosingBrace);
        }
    }
    /**
     * Vérifie l'indentation correcte pour Python
     */
    hasProperIndentation(code) {
        const lines = code.split('\n');
        if (lines.length < 2)
            return true;
        // Vérifier que la première ligne a moins d'indentation que les suivantes
        const firstLineIndent = this.countIndentation(lines[0]);
        const secondLineIndent = this.countIndentation(lines[1]);
        return secondLineIndent > firstLineIndent;
    }
    /**
     * Compte l'indentation d'une ligne
     */
    countIndentation(line) {
        let count = 0;
        for (const char of line) {
            if (char === ' ' || char === '\t') {
                count++;
            }
            else {
                break;
            }
        }
        return count;
    }
    /**
     * Vérifie si un chunk a une seule intention logique
     */
    hasSingleLogicalIntent(chunk) {
        const code = chunk.content.code;
        const lines = code.split('\n').filter(line => line.trim().length > 0);
        if (lines.length === 0)
            return false;
        // Analyser la structure du chunk
        const firstLine = lines[0].trim();
        // Déterminer le type d'intention basé sur la première ligne
        const intentType = this.determineIntentType(firstLine, chunk.metadata.language);
        // Pour les fonctions et classes, le code interne peut être varié mais c'est une seule intention
        if (intentType === 'function' || intentType === 'class') {
            return true; // Les fonctions et classes ont toujours une intention unique
        }
        // Vérifier que toutes les lignes suivantes sont cohérentes avec cette intention
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!this.isLineConsistentWithIntent(line, intentType, chunk.metadata.language)) {
                return false;
            }
        }
        return true;
    }
    /**
     * Détermine le type d'intention d'une ligne
     */
    determineIntentType(line, language) {
        if (language === 'typescript' || language === 'javascript') {
            if (line.startsWith('function ') || line.startsWith('async function '))
                return 'function';
            if (line.startsWith('class '))
                return 'class';
            if (line.startsWith('interface '))
                return 'interface';
            if (line.startsWith('import '))
                return 'import';
            if (line.startsWith('export '))
                return 'export';
            if (line.startsWith('type '))
                return 'type';
            if (line.startsWith('const ') || line.startsWith('let ') || line.startsWith('var '))
                return 'variable';
        }
        else if (language === 'python') {
            if (line.startsWith('def ') || line.startsWith('async def '))
                return 'function';
            if (line.startsWith('class '))
                return 'class';
            if (line.startsWith('import ') || line.startsWith('from '))
                return 'import';
        }
        return 'unknown';
    }
    /**
     * Vérifie si une ligne est cohérente avec une intention
     */
    isLineConsistentWithIntent(line, intentType, language) {
        if (intentType === 'function' || intentType === 'class') {
            // Pour les fonctions/classes, vérifier que la ligne n'est pas une nouvelle déclaration
            const newIntent = this.determineIntentType(line, language);
            return newIntent === 'unknown' || newIntent === intentType;
        }
        if (intentType === 'import') {
            // Pour les imports, vérifier que la ligne est un import ou un commentaire
            return line.startsWith('import ') || line.startsWith('from ') ||
                line.startsWith('#') || line.startsWith('//') || line.startsWith('/*');
        }
        return true;
    }
    /**
     * Applique les règles à l'AST
     */
    applyRulesToAST(node, context) {
        // Trier les règles par priorité (décroissante)
        const sortedRules = [...this.rules].sort((a, b) => b.priority - a.priority);
        // Vérifier chaque règle
        for (const rule of sortedRules) {
            if (rule.condition(node, context)) {
                const chunks = rule.action(node, context);
                // Ajouter les chunks valides
                for (const chunk of chunks) {
                    const validation = ChunkValidator.validate(chunk);
                    if (validation.valid) {
                        context.state.chunks.push(chunk);
                    }
                    else {
                        console.warn(`Chunk invalide ignoré: ${validation.errors.join(', ')}`);
                    }
                }
                // Ne pas continuer à traiter les enfants si la règle a consommé le nœud
                if (this.shouldSkipChildren(rule, node)) {
                    return;
                }
            }
        }
        // Traiter récursivement les enfants
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child) {
                this.applyRulesToAST(child, context);
            }
        }
    }
    /**
     * Détermine si les enfants doivent être ignorés
     */
    shouldSkipChildren(rule, node) {
        // Pour les règles atomiques (fonctions, classes), ignorer les enfants
        const atomicRules = ['function_chunk', 'class_chunk', 'interface_chunk', 'type_definition_chunk'];
        return atomicRules.includes(rule.name);
    }
    /**
     * Extrait les relations entre chunks
     */
    extractRelations(context) {
        const { chunks } = context.state;
        const sourceCode = context.parseResult.sourceCode;
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const relations = {
                parents: [],
                children: [],
                dependencies: [],
                references: [],
            };
            // Détecter les dépendances (imports)
            if (chunk.type === 'function' || chunk.type === 'class') {
                const dependencies = this.detectDependencies(chunk.content.code, context.parseResult.language);
                relations.dependencies = dependencies;
            }
            // Détecter les références (appels de fonctions, utilisations de classes)
            if (chunk.type !== 'import' && chunk.type !== 'export') {
                const references = this.detectReferences(chunk, chunks, sourceCode);
                relations.references = references;
            }
            // Mettre à jour les métadonnées du chunk
            chunk.metadata.relations = relations;
        }
    }
    /**
     * Détecte les dépendances dans le code
     */
    detectDependencies(code, language) {
        const dependencies = [];
        if (language === 'typescript' || language === 'javascript') {
            const importRegex = /from\s+['"]([^'"]+)['"]/g;
            let match;
            while ((match = importRegex.exec(code)) !== null) {
                dependencies.push(match[1]);
            }
        }
        else if (language === 'python') {
            const importRegex = /import\s+([\w.]+)/g;
            const fromRegex = /from\s+([\w.]+)\s+import/g;
            let match;
            while ((match = importRegex.exec(code)) !== null) {
                dependencies.push(match[1]);
            }
            while ((match = fromRegex.exec(code)) !== null) {
                dependencies.push(match[1]);
            }
        }
        return Array.from(new Set(dependencies)); // Éliminer les doublons
    }
    /**
     * Détecte les références entre chunks
     */
    detectReferences(chunk, allChunks, sourceCode) {
        const references = [];
        const chunkCode = chunk.content.code.toLowerCase();
        for (const otherChunk of allChunks) {
            if (otherChunk.id === chunk.id)
                continue;
            // Vérifier si le chunk référence un autre chunk
            if (chunkCode.includes(otherChunk.metadata.provenance.filePath.toLowerCase())) {
                references.push(otherChunk.id);
            }
            // Vérifier les références par nom (simplifié)
            if (otherChunk.metadata.typeSpecific?.function?.parameters) {
                for (const param of otherChunk.metadata.typeSpecific.function.parameters) {
                    if (chunkCode.includes(param.toLowerCase())) {
                        references.push(otherChunk.id);
                    }
                }
            }
        }
        return references;
    }
    /**
     * Calcule les statistiques
     */
    calculateStats(chunks, chunkingTime) {
        const byType = {};
        const byGranularity = {};
        let totalQuality = 0;
        let totalRelevance = 0;
        let totalTokens = 0;
        let minTokens = chunks.length > 0 ? Number.MAX_SAFE_INTEGER : 0;
        let maxTokens = 0;
        for (const chunk of chunks) {
            byType[chunk.type] = (byType[chunk.type] || 0) + 1;
            byGranularity[chunk.granularity] = (byGranularity[chunk.granularity] || 0) + 1;
            totalQuality += chunk.qualityScore;
            totalRelevance += chunk.relevanceScore;
            const tokens = chunk.metadata.metrics.tokens;
            totalTokens += tokens;
            if (tokens < minTokens)
                minTokens = tokens;
            if (tokens > maxTokens)
                maxTokens = tokens;
        }
        const avgTokens = chunks.length > 0 ? totalTokens / chunks.length : 0;
        const avgLines = chunks.length > 0 ?
            chunks.reduce((sum, chunk) => sum + chunk.metadata.metrics.lines, 0) / chunks.length : 0;
        return {
            totalChunks: chunks.length,
            chunksPerFile: chunks.length, // alias pour compatibilité
            byType,
            byGranularity,
            averageQuality: chunks.length > 0 ? totalQuality / chunks.length : 0,
            averageRelevance: chunks.length > 0 ? totalRelevance / chunks.length : 0,
            chunkingTime,
            tokenStats: {
                average: Math.round(avgTokens * 100) / 100,
                min: minTokens === Number.MAX_SAFE_INTEGER ? 0 : minTokens,
                max: maxTokens,
                total: totalTokens,
            },
            lineStats: {
                average: Math.round(avgLines * 100) / 100,
                total: chunks.reduce((sum, chunk) => sum + chunk.metadata.metrics.lines, 0),
            },
            sizeStats: {
                avgChunkSize: Math.round(avgTokens), // pour compatibilité avec la tâche T3.4
                minChunkSize: minTokens === Number.MAX_SAFE_INTEGER ? 0 : minTokens,
                maxChunkSize: maxTokens,
            },
        };
    }
    /**
     * Calcule les métriques de qualité
     */
    calculateQualityMetrics(chunks) {
        if (chunks.length === 0) {
            return {
                atomicRate: 0,
                documentedRate: 0,
                relatedRate: 0,
                semanticCoherence: 0,
            };
        }
        let atomicCount = 0;
        let documentedCount = 0;
        let relatedCount = 0;
        for (const chunk of chunks) {
            if (chunk.granularity === 'atomic')
                atomicCount++;
            if (chunk.content.documentation && chunk.content.documentation.length > 0)
                documentedCount++;
            const relationCount = chunk.metadata.relations.parents.length +
                chunk.metadata.relations.children.length +
                chunk.metadata.relations.dependencies.length +
                chunk.metadata.relations.references.length;
            if (relationCount > 0)
                relatedCount++;
        }
        return {
            atomicRate: (atomicCount / chunks.length) * 100,
            documentedRate: (documentedCount / chunks.length) * 100,
            relatedRate: (relatedCount / chunks.length) * 100,
            semanticCoherence: this.calculateSemanticCoherence(chunks),
        };
    }
    /**
     * Calcule la cohérence sémantique
     */
    calculateSemanticCoherence(chunks) {
        if (chunks.length <= 1)
            return 100;
        let coherenceScore = 0;
        const totalComparisons = (chunks.length * (chunks.length - 1)) / 2;
        for (let i = 0; i < chunks.length; i++) {
            for (let j = i + 1; j < chunks.length; j++) {
                const chunkA = chunks[i];
                const chunkB = chunks[j];
                // Vérifier la proximité dans le fichier
                const lineDistance = Math.abs(chunkA.metadata.provenance.position.startLine -
                    chunkB.metadata.provenance.position.startLine);
                // Vérifier les relations
                const hasRelation = chunkA.metadata.relations.references.includes(chunkB.id) ||
                    chunkB.metadata.relations.references.includes(chunkA.id) ||
                    chunkA.metadata.relations.dependencies.some(dep => chunkB.metadata.relations.dependencies.includes(dep));
                // Calculer le score de cohérence
                if (lineDistance < 50 || hasRelation) {
                    coherenceScore += 1;
                }
                else if (lineDistance < 200) {
                    coherenceScore += 0.5;
                }
            }
        }
        return totalComparisons > 0 ? (coherenceScore / totalComparisons) * 100 : 100;
    }
    /**
     * Crée un résultat vide
     */
    createEmptyResult(filePath, language) {
        return {
            filePath,
            language,
            chunks: [],
            stats: {
                totalChunks: 0,
                byType: {},
                byGranularity: {},
                averageQuality: 0,
                averageRelevance: 0,
                chunkingTime: 0,
            },
            qualityMetrics: {
                atomicRate: 0,
                documentedRate: 0,
                relatedRate: 0,
                semanticCoherence: 0,
            },
        };
    }
    /**
     * Estime la complexité d'un nœud
     */
    estimateComplexity(node) {
        // Logique simplifiée : compter les nœuds enfants
        let count = 0;
        const traverse = (n) => {
            count++;
            for (let i = 0; i < n.childCount; i++) {
                const child = n.child(i);
                if (child)
                    traverse(child);
            }
        };
        traverse(node);
        return Math.min(Math.ceil(count / 10), 10); // Normaliser entre 1 et 10
    }
    /**
     * Extrait les paramètres d'une fonction
     */
    extractParameters(node, language) {
        const parameters = [];
        const traverse = (n) => {
            if (n.type.includes('parameter') || n.type === 'formal_parameter') {
                // Chercher un identifiant
                for (let i = 0; i < n.childCount; i++) {
                    const child = n.child(i);
                    if (child && (child.type === 'identifier' || child.type === 'variable_name')) {
                        parameters.push(child.text || 'unknown');
                        break;
                    }
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
     * Extrait le type de retour
     */
    extractReturnType(node, language) {
        if (language === 'typescript') {
            const traverse = (n) => {
                if (n.type === 'type_annotation' || n.type === 'return_type') {
                    return n.text;
                }
                for (let i = 0; i < n.childCount; i++) {
                    const child = n.child(i);
                    if (child) {
                        const result = traverse(child);
                        if (result)
                            return result;
                    }
                }
                return undefined;
            };
            return traverse(node);
        }
        return undefined;
    }
    /**
     * Vérifie si une fonction est asynchrone
     */
    isAsync(node, language) {
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
     * Vérifie si une fonction est statique
     */
    isStatic(node, language) {
        const text = node.text || '';
        if (language === 'typescript' || language === 'javascript') {
            return text.includes('static');
        }
        if (language === 'python') {
            return text.includes('@staticmethod') || text.includes('@classmethod');
        }
        return false;
    }
    /**
     * Extrait la visibilité
     */
    extractVisibility(node, language) {
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
            const name = this.extractName(node, language);
            if (name?.startsWith('__'))
                return 'private';
        }
        return 'public';
    }
    /**
     * Extrait le nom d'un nœud
     */
    extractName(node, language) {
        const traverse = (n) => {
            if (n.type === 'identifier' || n.type === 'name' || n.type === 'variable_name') {
                return n.text;
            }
            for (let i = 0; i < n.childCount; i++) {
                const child = n.child(i);
                if (child) {
                    const result = traverse(child);
                    if (result)
                        return result;
                }
            }
            return undefined;
        };
        return traverse(node);
    }
    /**
     * Extrait les méthodes d'une classe
     */
    extractClassMethods(node, language) {
        const methods = [];
        const traverse = (n) => {
            if (n.type === 'method_definition' ||
                (language === 'python' && n.type === 'function_definition')) {
                const name = this.extractName(n, language);
                if (name)
                    methods.push(name);
            }
            for (let i = 0; i < n.childCount; i++) {
                const child = n.child(i);
                if (child)
                    traverse(child);
            }
        };
        traverse(node);
        return methods;
    }
    /**
     * Extrait les propriétés d'une classe
     */
    extractClassProperties(node, language) {
        const properties = [];
        const traverse = (n) => {
            if (n.type === 'property_definition' || n.type === 'field_definition') {
                const name = this.extractName(n, language);
                if (name)
                    properties.push(name);
            }
            for (let i = 0; i < n.childCount; i++) {
                const child = n.child(i);
                if (child)
                    traverse(child);
            }
        };
        traverse(node);
        return properties;
    }
    /**
     * Extrait l'héritage (extends)
     */
    extractExtends(node, language) {
        const text = node.text || '';
        if (language === 'typescript' || language === 'javascript') {
            const match = text.match(/extends\s+(\w+)/);
            return match ? match[1] : undefined;
        }
        return undefined;
    }
    /**
     * Extrait les implémentations (implements)
     */
    extractImplements(node, language) {
        const text = node.text || '';
        if (language === 'typescript' || language === 'javascript') {
            const match = text.match(/implements\s+([^{]+)/);
            if (match) {
                return match[1].split(',').map((s) => s.trim()).filter((s) => s.length > 0);
            }
        }
        return [];
    }
    /**
     * Extrait les modules importés
     */
    extractImportModules(node, language) {
        const text = node.text || '';
        const modules = [];
        if (language === 'typescript' || language === 'javascript') {
            const fromMatch = text.match(/from\s+['"]([^'"]+)['"]/);
            if (fromMatch)
                modules.push(fromMatch[1]);
        }
        else if (language === 'python') {
            const importMatch = text.match(/import\s+([\w., ]+)/);
            if (importMatch) {
                modules.push(...importMatch[1].split(',').map((s) => s.trim()));
            }
            const fromMatch = text.match(/from\s+([\w.]+)\s+import/);
            if (fromMatch)
                modules.push(fromMatch[1]);
        }
        return modules;
    }
    /**
     * Vérifie si un import est relatif
     */
    isRelativeImport(code) {
        return code.startsWith('.') || code.startsWith('./') || code.startsWith('../');
    }
    /**
     * Détermine le type d'import
     */
    determineImportType(code) {
        if (code.includes('import *'))
            return 'namespace';
        if (code.includes('import {') || code.includes('from'))
            return 'named';
        return 'default';
    }
    /**
     * Détermine le type de bloc
     */
    determineBlockType(nodeType) {
        const typeMap = {
            'if_statement': 'conditional',
            'for_statement': 'loop',
            'while_statement': 'loop',
            'try_statement': 'try',
            'switch_statement': 'switch',
            'with_statement': 'with',
        };
        return typeMap[nodeType] || 'block';
    }
    /**
     * Méthodes inspirées de QwenRag pour améliorer le chunking
     */
    /**
     * Estime le nombre de tokens (méthode QwenRag : 1 token ≈ 4 caractères)
     */
    estimateTokenCount(text) {
        return Math.ceil(text.length / 4);
    }
    /**
     * Crée une version réduite d'une fonction trop grande (collapsing)
     */
    createCollapsedFunction(code, language) {
        const lines = code.split('\n');
        if (lines.length <= 5)
            return code;
        // Garder la signature et quelques lignes
        const signatureLines = [];
        let bodyStartIdx = 0;
        for (let i = 0; i < lines.length; i++) {
            signatureLines.push(lines[i]);
            // Détecter le début du corps de fonction
            if (language === 'python') {
                if (lines[i].includes(':')) {
                    bodyStartIdx = i + 1;
                    break;
                }
            }
            else {
                if (lines[i].includes('{')) {
                    bodyStartIdx = i + 1;
                    break;
                }
            }
        }
        // Ajouter l'indicateur de corps réduit
        if (bodyStartIdx < lines.length) {
            if (language === 'python') {
                signatureLines.push('    # ... function body ...');
            }
            else {
                signatureLines.push('    // ... function body ...');
            }
            // Ajouter la dernière ligne (accolade fermante ou return)
            if (lines[lines.length - 1].trim()) {
                signatureLines.push(lines[lines.length - 1]);
            }
        }
        return signatureLines.join('\n');
    }
    /**
     * Crée une version réduite d'une classe trop grande (collapsing)
     */
    createCollapsedClass(code, language) {
        const lines = code.split('\n');
        if (lines.length <= 10)
            return code;
        // Garder la définition et les signatures des méthodes
        const resultLines = [];
        let inClassBody = false;
        for (let i = 0; i < Math.min(lines.length, 15); i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (trimmed.startsWith('class ') || trimmed.startsWith('interface ') || trimmed.startsWith('struct ')) {
                resultLines.push(line);
                inClassBody = true;
            }
            else if (inClassBody && (trimmed.startsWith('def ') || trimmed.startsWith('async def ') ||
                trimmed.startsWith('function ') || trimmed.startsWith('async function ') ||
                trimmed.includes('(') && trimmed.includes(')') && trimmed.includes('{') ||
                trimmed.includes('(') && trimmed.includes(')') && trimmed.includes(':'))) {
                resultLines.push(line);
            }
            else if (trimmed === '' && resultLines.length > 0) {
                resultLines.push(line);
            }
        }
        if (lines.length > 15) {
            if (language === 'python') {
                resultLines.push('    # ... class body ...');
            }
            else {
                resultLines.push('    // ... class body ...');
            }
        }
        return resultLines.join('\n');
    }
    /**
     * Fallback textuel simple quand l'AST échoue (inspiré de QwenRag)
     */
    simpleTextChunking(filePath, content) {
        const chunks = [];
        const lines = content.split('\n');
        let currentChunk = [];
        let currentTokens = 0;
        let startLine = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineTokens = this.estimateTokenCount(line);
            if (currentTokens + lineTokens > this.config.maxChunkSize && currentChunk.length > 0) {
                // Créer un chunk du contenu actuel
                const chunkContent = currentChunk.join('\n');
                const chunk = ChunkFactory.createChunk('mixed', 'section', chunkContent, {
                    tags: ['fallback', 'text', 'simple'],
                    complexity: 1,
                }, filePath, 'unknown', {
                    startLine: startLine + 1,
                    startColumn: 1,
                    endLine: i,
                    endColumn: lines[i - 1]?.length || 1,
                });
                chunks.push(chunk);
                // Commencer un nouveau chunk
                currentChunk = [line];
                currentTokens = lineTokens;
                startLine = i;
            }
            else {
                currentChunk.push(line);
                currentTokens += lineTokens;
            }
        }
        // Ajouter le dernier chunk
        if (currentChunk.length > 0) {
            const chunkContent = currentChunk.join('\n');
            const chunk = ChunkFactory.createChunk('mixed', 'section', chunkContent, {
                tags: ['fallback', 'text', 'simple'],
                complexity: 1,
            }, filePath, 'unknown', {
                startLine: startLine + 1,
                startColumn: 1,
                endLine: lines.length,
                endColumn: lines[lines.length - 1]?.length || 1,
            });
            chunks.push(chunk);
        }
        return chunks;
    }
    /**
     * Vérifie si un chunk est trop grand et applique le collapsing si configuré
     */
    applyCollapsingIfNeeded(chunk) {
        const tokenCount = this.estimateTokenCount(chunk.content.code);
        if (tokenCount <= this.config.maxChunkSize) {
            return chunk;
        }
        // Appliquer le collapsing selon le type
        let collapsedCode = chunk.content.code;
        if (chunk.type === 'function' && this.config.rules?.collapseLargeFunctions) {
            collapsedCode = this.createCollapsedFunction(chunk.content.code, chunk.metadata.language);
        }
        else if (chunk.type === 'class' && this.config.rules?.collapseLargeClasses) {
            collapsedCode = this.createCollapsedClass(chunk.content.code, chunk.metadata.language);
        }
        // Créer un nouveau chunk avec le code réduit
        return {
            ...chunk,
            content: {
                ...chunk.content,
                code: collapsedCode,
            },
            metadata: {
                ...chunk.metadata,
                metrics: {
                    ...chunk.metadata.metrics,
                    tokens: this.estimateTokenCount(collapsedCode),
                },
            },
        };
    }
    // ============================================
    // Méthodes pour le chunking hiérarchique des classes
    // ============================================
    /**
     * Détermine si une classe doit être divisée
     */
    shouldSplitClass(node, language) {
        // Diviser les classes avec plus de 3 méthodes ou plus de 5 propriétés
        const methodCount = this.extractClassMethods(node, language).length;
        const propertyCount = this.extractClassProperties(node, language).length;
        return methodCount > 3 || propertyCount > 5 || this.estimateComplexity(node) > 5;
    }
    /**
     * Extrait la définition de classe (premières lignes)
     */
    extractClassDefinition(node, sourceCode) {
        const startLine = node.startPosition.row;
        const endLine = Math.min(node.startPosition.row + 3, node.endPosition.row);
        const lines = sourceCode.split('\n');
        const definitionLines = lines.slice(startLine, endLine + 1);
        return definitionLines.join('\n');
    }
    /**
     * Extrait les méthodes avec détails
     */
    extractClassMethodsWithDetails(node, language, sourceCode) {
        const methods = [];
        const traverse = (n) => {
            if (n.type === 'method_definition' ||
                (language === 'python' && n.type === 'function_definition')) {
                const name = this.extractName(n, language);
                if (name) {
                    const code = sourceCode.substring(n.startIndex, n.endIndex);
                    const visibility = this.extractVisibility(n, language);
                    methods.push({
                        name,
                        code,
                        startLine: n.startPosition.row,
                        endLine: n.endPosition.row,
                        visibility
                    });
                }
            }
            for (let i = 0; i < n.childCount; i++) {
                const child = n.child(i);
                if (child)
                    traverse(child);
            }
        };
        traverse(node);
        return methods;
    }
    /**
     * Groupe les méthodes par visibilité
     */
    groupMethodsByVisibility(methods) {
        const grouped = {
            public: [],
            private: [],
            protected: []
        };
        for (const method of methods) {
            grouped[method.visibility].push(method);
        }
        return grouped;
    }
    /**
     * Crée des chunks pour un groupe de méthodes
     */
    createMethodGroupChunks(methods, filePath, language, visibility) {
        const chunks = [];
        // Grouper les méthodes par lots de 3 maximum
        const batchSize = 3;
        for (let i = 0; i < methods.length; i += batchSize) {
            const batch = methods.slice(i, i + batchSize);
            const batchCode = batch.map(m => m.code).join('\n\n');
            const startLine = batch[0].startLine;
            const endLine = batch[batch.length - 1].endLine;
            chunks.push(ChunkFactory.createChunk('method', 'logical', batchCode, {
                tags: ['method', 'group', visibility, language],
                complexity: this.estimateComplexityFromMethods(batch),
            }, filePath, language, {
                startLine: startLine + 1,
                startColumn: 1,
                endLine: endLine + 1,
                endColumn: batch[batch.length - 1].code.split('\n').pop()?.length || 1,
            }));
        }
        return chunks;
    }
    /**
     * Extrait les propriétés avec détails
     */
    extractClassPropertiesWithDetails(node, language, sourceCode) {
        const properties = [];
        const traverse = (n) => {
            if (n.type === 'property_definition' || n.type === 'field_definition') {
                const name = this.extractName(n, language);
                if (name) {
                    const code = sourceCode.substring(n.startIndex, n.endIndex);
                    properties.push({
                        name,
                        code,
                        startLine: n.startPosition.row,
                        endLine: n.endPosition.row
                    });
                }
            }
            for (let i = 0; i < n.childCount; i++) {
                const child = n.child(i);
                if (child)
                    traverse(child);
            }
        };
        traverse(node);
        return properties;
    }
    /**
     * Crée un chunk pour un groupe de propriétés
     */
    createPropertyGroupChunk(properties, filePath, language) {
        const propertyCode = properties.map(p => p.code).join('\n');
        const startLine = properties[0].startLine;
        const endLine = properties[properties.length - 1].endLine;
        return ChunkFactory.createChunk('type_definition', 'logical', propertyCode, {
            tags: ['property', 'group', language],
            complexity: Math.min(properties.length, 10),
        }, filePath, language, {
            startLine: startLine + 1,
            startColumn: 1,
            endLine: endLine + 1,
            endColumn: properties[properties.length - 1].code.split('\n').pop()?.length || 1,
        });
    }
    /**
     * Estime la complexité à partir d'un groupe de méthodes
     */
    estimateComplexityFromMethods(methods) {
        let totalComplexity = 0;
        for (const method of methods) {
            // Estimation simplifiée : 1 point par 10 lignes
            const lines = method.code.split('\n').length;
            totalComplexity += Math.ceil(lines / 10);
        }
        return Math.min(totalComplexity, 10);
    }
}
//# sourceMappingURL=chunker-intelligent.js.map