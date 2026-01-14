// src/rag/phase0/analyzer/code-analyzer.ts
// Analyseur de code principal - orchestration de l'extraction sémantique
import { findNodesByType } from './ast-utils.js';
import { extractSymbols } from './symbol-extractor.js';
/**
 * Analyseur de code principal
 */
export class CodeAnalyzer {
    config;
    constructor(config = {}) {
        const defaultConfig = {
            extractSymbols: true,
            extractSemanticUnits: true,
            buildDependencyGraph: true,
            calculateMetrics: true,
            detailLevel: 'standard',
            symbolExtraction: {
                extractComments: true,
                calculateComplexity: true,
                symbolTypes: ['function', 'class', 'method', 'interface', 'import', 'export'],
                detailLevel: 'standard',
            },
        };
        this.config = { ...defaultConfig, ...config };
    }
    /**
     * Analyse un résultat de parsing
     */
    async analyze(parseResult) {
        const startTime = Date.now();
        const { filePath, language, ast, sourceCode } = parseResult;
        // Résultats initiaux
        let symbols;
        let semanticUnits = [];
        let dependencyGraph = { nodes: [], edges: [] };
        // 1. Extraction des symboles
        if (this.config.extractSymbols && ast) {
            symbols = extractSymbols(parseResult, this.config.symbolExtraction);
        }
        // 2. Extraction des unités sémantiques
        if (this.config.extractSemanticUnits && ast) {
            semanticUnits = this.extractSemanticUnits(parseResult, symbols);
        }
        // 3. Construction du graphe de dépendances
        if (this.config.buildDependencyGraph && ast) {
            dependencyGraph = this.buildDependencyGraph(semanticUnits, symbols);
        }
        // 4. Calcul des métriques
        const metrics = this.config.calculateMetrics
            ? this.calculateMetrics(semanticUnits, symbols, parseResult)
            : {
                totalUnits: semanticUnits.length,
                unitDistribution: {},
                averageComplexity: 0,
                averageSize: 0,
                documentationRate: 0,
                analysisTime: Date.now() - startTime,
            };
        return {
            filePath,
            language,
            semanticUnits,
            symbols: symbols || {
                filePath,
                language,
                symbols: [],
                stats: { totalSymbols: 0, byType: {}, extractionTime: 0 },
            },
            metrics: {
                ...metrics,
                analysisTime: Date.now() - startTime,
            },
            dependencyGraph,
        };
    }
    /**
     * Extrait les unités sémantiques
     */
    extractSemanticUnits(parseResult, symbols) {
        const { filePath, language, ast, sourceCode } = parseResult;
        const units = [];
        if (!ast)
            return units;
        // Utiliser les symboles comme base pour les unités sémantiques
        if (symbols) {
            for (const symbol of symbols.symbols) {
                const unit = this.convertSymbolToSemanticUnit(symbol, parseResult);
                if (unit) {
                    units.push(unit);
                }
            }
        }
        // Extraire les blocs de code supplémentaires (boucles, conditions, etc.)
        const blockTypes = this.getBlockNodeTypes(language);
        const blockNodes = findNodesByType(ast, blockTypes);
        for (const node of blockNodes) {
            const unit = this.extractBlockUnit(node, parseResult);
            if (unit) {
                units.push(unit);
            }
        }
        // Extraire les commentaires importants
        if (this.config.detailLevel === 'comprehensive') {
            const commentUnits = this.extractCommentUnits(parseResult);
            units.push(...commentUnits);
        }
        return units;
    }
    /**
     * Convertit un symbole en unité sémantique
     */
    convertSymbolToSemanticUnit(symbol, parseResult) {
        const { filePath, language } = parseResult;
        // Générer un ID unique
        const id = `${filePath}:${symbol.type}:${symbol.name}:${symbol.position.startLine}`;
        // Déterminer le type d'unité sémantique
        let unitType;
        switch (symbol.type) {
            case 'function':
            case 'method':
                unitType = symbol.type === 'method' ? 'method' : 'function';
                break;
            case 'class':
                unitType = 'class';
                break;
            case 'interface':
                unitType = 'interface';
                break;
            case 'import':
            case 'export':
                unitType = 'module';
                break;
            default:
                return null;
        }
        // Construire l'unité sémantique
        const unit = {
            type: unitType,
            id,
            name: symbol.name,
            language,
            filePath,
            position: symbol.position,
            code: symbol.code,
            documentation: symbol.comment,
            metadata: {
                ...symbol.metadata,
                symbolType: symbol.type,
            },
            relations: {
                dependencies: symbol.metadata.imports || [],
                references: [],
                parent: this.findParentUnit(symbol, parseResult),
                children: [],
            },
            complexity: symbol.metadata.complexity,
            tags: this.generateSemanticTags(symbol),
        };
        return unit;
    }
    /**
     * Extrait une unité de bloc (boucle, condition, etc.)
     */
    extractBlockUnit(node, parseResult) {
        const { filePath, language, sourceCode } = parseResult;
        // Déterminer le type de bloc
        const blockType = this.getBlockType(node.type, language);
        if (!blockType)
            return null;
        // Générer un ID unique
        const id = `${filePath}:block:${blockType}:${node.startPosition.row + 1}`;
        // Extraire le code
        const code = sourceCode.substring(node.startIndex, node.endIndex);
        // Extraire la complexité (simple pour les blocs)
        const complexity = this.estimateBlockComplexity(node);
        const unit = {
            type: 'block',
            id,
            name: `${blockType}_block`,
            language,
            filePath,
            position: {
                startLine: node.startPosition.row + 1,
                startColumn: node.startPosition.column + 1,
                endLine: node.endPosition.row + 1,
                endColumn: node.endPosition.column + 1,
            },
            code,
            metadata: {
                blockType: node.type,
                nodeCount: node.childCount,
            },
            relations: {
                dependencies: [],
                references: [],
                parent: this.findBlockParent(node, parseResult),
                children: [],
            },
            complexity,
            tags: [`block:${blockType}`, `language:${language}`],
        };
        return unit;
    }
    /**
     * Extrait les unités de commentaires
     */
    extractCommentUnits(parseResult) {
        const { filePath, language, ast, sourceCode } = parseResult;
        const units = [];
        if (!ast)
            return units;
        const commentTypes = ['comment', 'block_comment', 'line_comment', 'docstring'];
        const commentNodes = findNodesByType(ast, commentTypes);
        for (const node of commentNodes) {
            const commentText = sourceCode.substring(node.startIndex, node.endIndex);
            // Ignorer les commentaires trop courts
            if (commentText.length < 20)
                continue;
            const id = `${filePath}:comment:${node.startPosition.row + 1}`;
            const unit = {
                type: 'comment',
                id,
                name: 'documentation',
                language,
                filePath,
                position: {
                    startLine: node.startPosition.row + 1,
                    startColumn: node.startPosition.column + 1,
                    endLine: node.endPosition.row + 1,
                    endColumn: node.endPosition.column + 1,
                },
                code: commentText,
                documentation: commentText,
                metadata: {
                    commentType: node.type,
                    length: commentText.length,
                },
                relations: {
                    dependencies: [],
                    references: [],
                    parent: this.findCommentParent(node, parseResult),
                    children: [],
                },
                tags: ['documentation', `comment-type:${node.type}`],
            };
            units.push(unit);
        }
        return units;
    }
    /**
     * Trouve l'unité parente d'un symbole
     */
    findParentUnit(symbol, parseResult) {
        // Logique simplifiée : chercher la classe parente pour les méthodes
        if (symbol.type === 'method') {
            // Dans une vraie implémentation, on parcourrait l'AST pour trouver la classe parente
            return undefined;
        }
        return undefined;
    }
    /**
     * Trouve le parent d'un bloc
     */
    findBlockParent(node, parseResult) {
        // Logique simplifiée
        return undefined;
    }
    /**
     * Trouve le parent d'un commentaire
     */
    findCommentParent(node, parseResult) {
        // Logique simplifiée : chercher le nœud suivant (fonction/classe documentée)
        return undefined;
    }
    /**
     * Génère des tags sémantiques pour un symbole
     */
    generateSemanticTags(symbol) {
        const tags = [];
        // Tags basés sur le type
        tags.push(`type:${symbol.type}`);
        tags.push(`language:${symbol.language}`);
        // Tags basés sur les métadonnées
        if (symbol.metadata.visibility) {
            tags.push(`visibility:${symbol.metadata.visibility}`);
        }
        if (symbol.metadata.isStatic) {
            tags.push('modifier:static');
        }
        if (symbol.metadata.isAsync) {
            tags.push('modifier:async');
        }
        // Tags de complexité
        if (symbol.metadata.complexity) {
            if (symbol.metadata.complexity > 10) {
                tags.push('complexity:high');
            }
            else if (symbol.metadata.complexity > 5) {
                tags.push('complexity:medium');
            }
            else {
                tags.push('complexity:low');
            }
        }
        return tags;
    }
    /**
     * Obtient les types de nœuds de bloc par langage
     */
    getBlockNodeTypes(language) {
        const blockTypes = {
            typescript: [
                'if_statement',
                'for_statement',
                'while_statement',
                'do_statement',
                'switch_statement',
                'try_statement',
                'catch_clause',
            ],
            javascript: [
                'if_statement',
                'for_statement',
                'while_statement',
                'do_statement',
                'switch_statement',
                'try_statement',
                'catch_clause',
            ],
            python: [
                'if_statement',
                'for_statement',
                'while_statement',
                'try_statement',
                'except_clause',
                'with_statement',
            ],
        };
        return blockTypes[language] || [];
    }
    /**
     * Détermine le type de bloc
     */
    getBlockType(nodeType, language) {
        const typeMap = {
            'if_statement': 'conditional',
            'for_statement': 'loop',
            'while_statement': 'loop',
            'do_statement': 'loop',
            'switch_statement': 'switch',
            'try_statement': 'try',
            'catch_clause': 'catch',
            'except_clause': 'except',
            'with_statement': 'with',
        };
        return typeMap[nodeType] || null;
    }
    /**
     * Estime la complexité d'un bloc
     */
    estimateBlockComplexity(node) {
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
        return Math.min(count / 10, 10); // Normaliser entre 0 et 10
    }
    /**
     * Construit le graphe de dépendances
     */
    buildDependencyGraph(units, symbols) {
        const nodes = units.map(unit => ({
            id: unit.id,
            type: unit.type,
            name: unit.name,
        }));
        const edges = [];
        // Ajouter les relations de dépendance
        for (const unit of units) {
            for (const dep of unit.relations.dependencies) {
                edges.push({
                    source: unit.id,
                    target: dep,
                    type: 'depends_on',
                });
            }
            if (unit.relations.parent) {
                edges.push({
                    source: unit.id,
                    target: unit.relations.parent,
                    type: 'child_of',
                });
            }
        }
        return { nodes, edges };
    }
    /**
     * Calcule les métriques d'analyse
     */
    calculateMetrics(units, symbols, parseResult) {
        const { sourceCode } = parseResult;
        // Distribution par type
        const unitDistribution = {};
        for (const unit of units) {
            unitDistribution[unit.type] = (unitDistribution[unit.type] || 0) + 1;
        }
        // Complexité moyenne
        const unitsWithComplexity = units.filter(u => u.complexity !== undefined);
        const averageComplexity = unitsWithComplexity.length > 0
            ? unitsWithComplexity.reduce((sum, unit) => sum + (unit.complexity || 0), 0) / unitsWithComplexity.length
            : 0;
        // Taille moyenne du code (lignes)
        const totalLines = units.reduce((sum, unit) => {
            const lines = unit.code.split('\n').length;
            return sum + lines;
        }, 0);
        const averageSize = units.length > 0 ? totalLines / units.length : 0;
        // Taux de documentation
        const unitsWithDocumentation = units.filter(u => u.documentation && u.documentation.length > 0).length;
        const documentationRate = units.length > 0 ? (unitsWithDocumentation / units.length) * 100 : 0;
        return {
            totalUnits: units.length,
            unitDistribution,
            averageComplexity,
            averageSize,
            documentationRate,
            analysisTime: 0, // Sera remplacé par l'appelant
        };
    }
}
//# sourceMappingURL=code-analyzer.js.map