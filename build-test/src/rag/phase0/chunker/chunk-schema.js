// src/rag/phase0/chunker/chunk-schema.ts
// Schéma définitif des chunks sémantiques
/**
 * Factory de chunks
 */
export class ChunkFactory {
    static schemaVersion = '1.0.0';
    static chunkerVersion = '0.2.3';
    /**
     * Crée un chunk sémantique
     */
    static createChunk(type, granularity, content, metadata, filePath, language, position) {
        const id = this.generateChunkId(filePath, type, position.startLine);
        // Métriques par défaut
        const lines = content.split('\n').length;
        const tokens = this.estimateTokens(content);
        const commentRatio = this.calculateCommentRatio(content, language);
        // Métadonnées complètes
        const fullMetadata = {
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
    static generateChunkId(filePath, type, startLine) {
        const normalizedPath = filePath.replace(/[^a-zA-Z0-9]/g, '_');
        const timestamp = Date.now().toString(36);
        return `chunk_${normalizedPath}_${type}_${startLine}_${timestamp}`;
    }
    /**
     * Estime le nombre de tokens
     */
    static estimateTokens(text) {
        // Estimation simple : 1 token ≈ 4 caractères
        return Math.ceil(text.length / 4);
    }
    /**
     * Calcule le taux de commentaires
     */
    static calculateCommentRatio(text, language) {
        const lines = text.split('\n');
        let commentLines = 0;
        for (const line of lines) {
            const trimmed = line.trim();
            if (language === 'python') {
                if (trimmed.startsWith('#') || trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
                    commentLines++;
                }
            }
            else if (language === 'typescript' || language === 'javascript') {
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
    static extractDocumentation(text, language) {
        // Logique simplifiée d'extraction de documentation
        if (language === 'python') {
            const docstringMatch = text.match(/['"]{3}(.*?)['"]{3}/s);
            if (docstringMatch)
                return docstringMatch[1].trim();
        }
        else if (language === 'typescript' || language === 'javascript') {
            const jsdocMatch = text.match(/\/\*\*\s*\n(.*?)\n\s*\*\//s);
            if (jsdocMatch)
                return jsdocMatch[1].trim();
        }
        return undefined;
    }
    /**
     * Génère un résumé
     */
    static generateSummary(text, type, language) {
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
    static calculateQualityScore(metadata, content) {
        let score = 50; // Score de base
        // Bonus pour documentation
        if (metadata.metrics.commentRatio > 20) {
            score += 20;
        }
        else if (metadata.metrics.commentRatio > 10) {
            score += 10;
        }
        // Bonus pour granularité atomique
        if (metadata.granularity === 'atomic') {
            score += 15;
        }
        // Bonus pour relations
        const relationCount = metadata.relations.parents.length +
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
    static calculateRelevanceScore(metadata) {
        let score = 60; // Score de base
        // Bonus pour types importants
        const importantTypes = ['function', 'class', 'interface', 'type_definition'];
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
    static validate(chunk) {
        const errors = [];
        // Validation de base
        if (!chunk.id)
            errors.push('ID manquant');
        if (!chunk.type)
            errors.push('Type manquant');
        if (!chunk.content?.code)
            errors.push('Code manquant');
        if (!chunk.metadata?.language)
            errors.push('Langage manquant');
        if (!chunk.metadata?.provenance?.filePath)
            errors.push('Chemin de fichier manquant');
        // Validation des métriques
        if (chunk.metadata.metrics.tokens <= 0)
            errors.push('Nombre de tokens invalide');
        if (chunk.metadata.metrics.lines <= 0)
            errors.push('Nombre de lignes invalide');
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
    static validateResult(result) {
        const errors = [];
        if (!result.filePath)
            errors.push('Chemin de fichier manquant');
        if (!result.language)
            errors.push('Langage manquant');
        if (!Array.isArray(result.chunks))
            errors.push('Chunks invalides');
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
//# sourceMappingURL=chunk-schema.js.map