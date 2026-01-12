// src/rag/phase0/chunker/chunk-schema.ts
// Schéma définitif des chunks sémantiques

import { SemanticUnit } from '../analyzer/code-analyzer.js';
import { ParseResult } from '../parser/tree-sitter/parse-file.js';

/**
 * Type de chunk sémantique
 */
export type ChunkType =
    | 'function'          // Fonction complète
    | 'class'             // Classe complète
    | 'method'            // Méthode complète
    | 'interface'         // Interface complète
    | 'module'           // Module/namespace
    | 'block'            // Bloc logique (if, for, while, etc.)
    | 'comment'          // Commentaire/documentation
    | 'import'           // Import/dépendance
    | 'export'           // Export
    | 'type_definition'  // Définition de type
    | 'configuration'    // Configuration
    | 'test'             // Test unitaire
    | 'documentation'    // Documentation externe
    | 'mixed'            // Contenu mixte (code + texte)
    | 'unknown';         // Type inconnu

/**
 * Niveau de granularité du chunk
 */
export type GranularityLevel =
    | 'atomic'      // Élément indivisible (fonction, classe)
    | 'logical'     // Bloc logique (if, for, try)
    | 'section'     // Section de code (groupe de fonctions)
    | 'file'        // Fichier complet
    | 'module';     // Module/package

/**
 * Métadonnées de chunk
 */
export interface ChunkMetadata {
    /** Langage source */
    language: string;

    /** Type de chunk */
    chunkType: ChunkType;

    /** Granularité */
    granularity: GranularityLevel;

    /** Complexité estimée (1-10) */
    complexity?: number;

    /** Tags sémantiques */
    tags: string[];

    /** Relations avec d'autres chunks */
    relations: {
        /** Chunks parents */
        parents: string[];

        /** Chunks enfants */
        children: string[];

        /** Dépendances */
        dependencies: string[];

        /** Références */
        references: string[];
    };

    /** Métriques */
    metrics: {
        /** Nombre de lignes */
        lines: number;

        /** Nombre de tokens (estimation) */
        tokens: number;

        /** Taux de commentaires (%) */
        commentRatio: number;

        /** Densité de code (tokens/ligne) */
        codeDensity: number;
    };

    /** Informations de provenance */
    provenance: {
        /** Fichier source */
        filePath: string;

        /** Position dans le fichier */
        position: {
            startLine: number;
            startColumn: number;
            endLine: number;
            endColumn: number;
        };

        /** Timestamp d'extraction */
        extractedAt: string;

        /** Version du chunker */
        chunkerVersion: string;
    };

    /** Métadonnées spécifiques au type */
    typeSpecific?: {
        /** Pour les fonctions/méthodes */
        function?: {
            parameters: string[];
            returnType?: string;
            isAsync: boolean;
            isStatic: boolean;
            visibility: 'public' | 'private' | 'protected';
        };

        /** Pour les classes */
        class?: {
            methods: string[];
            properties: string[];
            extends?: string;
            implements?: string[];
        };

        /** Pour les imports */
        import?: {
            modules: string[];
            isRelative: boolean;
            importType: 'default' | 'named' | 'namespace';
        };

        /** Pour les tests */
        test?: {
            framework: string;
            testType: 'unit' | 'integration' | 'e2e';
            description?: string;
        };
    };
}

/**
 * Chunk sémantique
 */
export interface SemanticChunk {
    /** Identifiant unique */
    id: string;

    /** Type de chunk */
    type: ChunkType;

    /** Granularité */
    granularity: GranularityLevel;

    /** Contenu du chunk */
    content: {
        /** Code source */
        code: string;

        /** Documentation/commentaire */
        documentation?: string;

        /** Résumé sémantique */
        summary?: string;

        /** Contexte (lignes avant/après) */
        context?: {
            before: string;
            after: string;
        };
    };

    /** Métadonnées */
    metadata: ChunkMetadata;

    /** Score de qualité (0-100) */
    qualityScore: number;

    /** Score de pertinence (0-100) */
    relevanceScore: number;

    /** Timestamp de création */
    createdAt: string;

    /** Version du schéma */
    schemaVersion: string;
}

/**
 * Résultat de chunking
 */
export interface ChunkingResult {
    /** Fichier source */
    filePath: string;

    /** Langage */
    language: string;

    /** Chunks générés */
    chunks: SemanticChunk[];

    /** Statistiques */
    stats: {
        totalChunks: number;
        byType: Record<ChunkType, number>;
        byGranularity: Record<GranularityLevel, number>;
        averageQuality: number;
        averageRelevance: number;
        chunkingTime: number;
    };

    /** Métriques de qualité */
    qualityMetrics: {
        /** Taux de chunks atomiques */
        atomicRate: number;

        /** Taux de chunks bien documentés */
        documentedRate: number;

        /** Taux de chunks avec relations */
        relatedRate: number;

        /** Cohérence sémantique (0-100) */
        semanticCoherence: number;
    };
}

/**
 * Configuration du chunker
 */
export interface ChunkerConfig {
    /** Niveau de granularité */
    granularity?: GranularityLevel;

    /** Types de chunks à extraire */
    chunkTypes?: ChunkType[];

    /** Taille maximale du chunk (en tokens) */
    maxChunkSize?: number;

    /** Taille minimale du chunk (en tokens) */
    minChunkSize?: number;

    /** Chevauchement entre chunks (en tokens) */
    chunkOverlap?: number;

    /** Inclure la documentation */
    includeDocumentation?: boolean;

    /** Inclure le contexte */
    includeContext?: boolean;

    /** Calculer les scores de qualité */
    calculateQualityScores?: boolean;

    /** Extraire les relations */
    extractRelations?: boolean;

    /** Niveau de détail */
    detailLevel?: 'minimal' | 'standard' | 'comprehensive';

    /** Règles spécifiques */
    rules?: {
        /** Ne jamais couper une fonction */
        neverSplitFunctions?: boolean;

        /** Ne jamais couper une classe */
        neverSplitClasses?: boolean;

        /** Ne jamais mélanger code et texte */
        neverMixCodeAndText?: boolean;

        /** Respecter les limites sémantiques */
        respectSemanticBoundaries?: boolean;

        /** Regrouper les imports */
        groupImports?: boolean;

        /** Regrouper les exports */
        groupExports?: boolean;
    };
}

/**
 * Règle de chunking
 */
export interface ChunkingRule {
    /** Nom de la règle */
    name: string;

    /** Description */
    description: string;

    /** Condition d'application */
    condition: (node: any, context: ChunkingContext) => boolean;

    /** Action à exécuter */
    action: (node: any, context: ChunkingContext) => SemanticChunk[];

    /** Priorité (plus élevé = appliqué en premier) */
    priority: number;
}

/**
 * Contexte de chunking
 */
export interface ChunkingContext {
    /** Résultat de parsing */
    parseResult: ParseResult;

    /** Unités sémantiques extraites */
    semanticUnits?: SemanticUnit[];

    /** Configuration */
    config: ChunkerConfig;

    /** État du chunker */
    state: {
        /** Chunks générés */
        chunks: SemanticChunk[];

        /** Position actuelle */
        currentPosition: number;

        /** Contexte accumulé */
        accumulatedContext: string[];

        /** Relations détectées */
        detectedRelations: Map<string, string[]>;
    };
}

/**
 * Factory de chunks
 */
export class ChunkFactory {
    private static schemaVersion = '1.0.0';
    private static chunkerVersion = '0.2.3';

    /**
     * Crée un chunk sémantique
     */
    static createChunk(
        type: ChunkType,
        granularity: GranularityLevel,
        content: string,
        metadata: Partial<ChunkMetadata>,
        filePath: string,
        language: string,
        position: { startLine: number; startColumn: number; endLine: number; endColumn: number }
    ): SemanticChunk {
        const id = this.generateChunkId(filePath, type, position.startLine);

        // Métriques par défaut
        const lines = content.split('\n').length;
        const tokens = this.estimateTokens(content);
        const commentRatio = this.calculateCommentRatio(content, language);

        // Métadonnées complètes
        const fullMetadata: ChunkMetadata = {
            language,
            chunkType: type,
            granularity,
            tags: metadata.tags || [],
            relations: {
                parents: metadata.relations?.parents || [],
                children: metadata.relations?.children || [],
                dependencies: metadata.relations?.dependencies || [],
                references: metadata.relations?.references || [],
            },
            metrics: {
                lines,
                tokens,
                commentRatio,
                codeDensity: tokens / Math.max(lines, 1),
            },
            provenance: {
                filePath,
                position,
                extractedAt: new Date().toISOString(),
                chunkerVersion: this.chunkerVersion,
            },
            typeSpecific: metadata.typeSpecific,
            complexity: metadata.complexity,
        };

        // Calcul des scores
        const qualityScore = this.calculateQualityScore(fullMetadata, content);
        const relevanceScore = this.calculateRelevanceScore(fullMetadata);

        return {
            id,
            type,
            granularity,
            content: {
                code: content,
                documentation: metadata.provenance?.filePath ? this.extractDocumentation(content, language) : undefined,
                summary: this.generateSummary(content, type, language),
            },
            metadata: fullMetadata,
            qualityScore,
            relevanceScore,
            createdAt: new Date().toISOString(),
            schemaVersion: this.schemaVersion,
        };
    }

    /**
     * Génère un ID unique pour un chunk
     */
    private static generateChunkId(
        filePath: string,
        type: ChunkType,
        startLine: number
    ): string {
        const normalizedPath = filePath.replace(/[^a-zA-Z0-9]/g, '_');
        const timestamp = Date.now().toString(36);
        return `chunk_${normalizedPath}_${type}_${startLine}_${timestamp}`;
    }

    /**
     * Estime le nombre de tokens
     */
    private static estimateTokens(text: string): number {
        // Estimation simple : 1 token ≈ 4 caractères
        return Math.ceil(text.length / 4);
    }

    /**
     * Calcule le taux de commentaires
     */
    private static calculateCommentRatio(text: string, language: string): number {
        const lines = text.split('\n');
        let commentLines = 0;

        for (const line of lines) {
            const trimmed = line.trim();
            if (language === 'python') {
                if (trimmed.startsWith('#') || trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
                    commentLines++;
                }
            } else if (language === 'typescript' || language === 'javascript') {
                if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
                    commentLines++;
                }
            }
        }

        return lines.length > 0 ? (commentLines / lines.length) * 100 : 0;
    }

    /**
     * Extrait la documentation
     */
    private static extractDocumentation(text: string, language: string): string | undefined {
        // Logique simplifiée d'extraction de documentation
        if (language === 'python') {
            const docstringMatch = text.match(/['"]{3}(.*?)['"]{3}/s);
            if (docstringMatch) return docstringMatch[1].trim();
        } else if (language === 'typescript' || language === 'javascript') {
            const jsdocMatch = text.match(/\/\*\*\s*\n(.*?)\n\s*\*\//s);
            if (jsdocMatch) return jsdocMatch[1].trim();
        }

        return undefined;
    }

    /**
     * Génère un résumé
     */
    private static generateSummary(text: string, type: ChunkType, language: string): string {
        const firstLine = text.split('\n')[0] || '';

        switch (type) {
            case 'function':
                return `Fonction: ${firstLine.substring(0, 100)}`;
            case 'class':
                return `Classe: ${firstLine.substring(0, 100)}`;
            case 'method':
                return `Méthode: ${firstLine.substring(0, 100)}`;
            case 'interface':
                return `Interface: ${firstLine.substring(0, 100)}`;
            case 'import':
                return `Import: ${firstLine.substring(0, 100)}`;
            case 'export':
                return `Export: ${firstLine.substring(0, 100)}`;
            default:
                return `${type}: ${firstLine.substring(0, 100)}`;
        }
    }

    /**
     * Calcule le score de qualité
     */
    private static calculateQualityScore(metadata: ChunkMetadata, content: string): number {
        let score = 50; // Score de base

        // Bonus pour documentation
        if (metadata.metrics.commentRatio > 20) {
            score += 20;
        } else if (metadata.metrics.commentRatio > 10) {
            score += 10;
        }

        // Bonus pour granularité atomique
        if (metadata.granularity === 'atomic') {
            score += 15;
        }

        // Bonus pour relations
        const relationCount =
            metadata.relations.parents.length +
            metadata.relations.children.length +
            metadata.relations.dependencies.length +
            metadata.relations.references.length;

        if (relationCount > 0) {
            score += Math.min(relationCount * 5, 15);
        }

        // Malus pour taille excessive
        if (metadata.metrics.tokens > 1000) {
            score -= 10;
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Calcule le score de pertinence
     */
    private static calculateRelevanceScore(metadata: ChunkMetadata): number {
        let score = 60; // Score de base

        // Bonus pour types importants
        const importantTypes: ChunkType[] = ['function', 'class', 'interface', 'type_definition'];
        if (importantTypes.includes(metadata.chunkType)) {
            score += 20;
        }

        // Bonus pour complexité modérée
        if (metadata.complexity && metadata.complexity >= 3 && metadata.complexity <= 7) {
            score += 10;
        }

        // Bonus pour bonne densité de code
        if (metadata.metrics.codeDensity >= 5 && metadata.metrics.codeDensity <= 15) {
            score += 10;
        }

        return Math.max(0, Math.min(100, score));
    }
}

/**
 * Validateur de chunks
 */
export class ChunkValidator {
    /**
     * Valide un chunk
     */
    static validate(chunk: SemanticChunk): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Validation de base
        if (!chunk.id) errors.push('ID manquant');
        if (!chunk.type) errors.push('Type manquant');
        if (!chunk.content?.code) errors.push('Code manquant');
        if (!chunk.metadata?.language) errors.push('Langage manquant');
        if (!chunk.metadata?.provenance?.filePath) errors.push('Chemin de fichier manquant');

        // Validation des métriques
        if (chunk.metadata.metrics.tokens <= 0) errors.push('Nombre de tokens invalide');
        if (chunk.metadata.metrics.lines <= 0) errors.push('Nombre de lignes invalide');

        // Validation des scores
        if (chunk.qualityScore < 0 || chunk.qualityScore > 100) {
            errors.push('Score de qualité invalide');
        }
        if (chunk.relevanceScore < 0 || chunk.relevanceScore > 100) {
            errors.push('Score de pertinence invalide');
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Valide un résultat de chunking
     */
    static validateResult(result: ChunkingResult): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!result.filePath) errors.push('Chemin de fichier manquant');
        if (!result.language) errors.push('Langage manquant');
        if (!Array.isArray(result.chunks)) errors.push('Chunks invalides');

        // Valider chaque chunk
        for (const chunk of result.chunks) {
            const validation = this.validate(chunk);
            if (!validation.valid) {
                errors.push(...validation.errors.map(e => `Chunk ${chunk.id}: ${e}`));
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }
}
