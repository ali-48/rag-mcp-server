// src/rag/vector-store-interface.ts
// Interface abstraite pour le stockage vectoriel RAG
// Supporte SQLite, PostgreSQL, et autres backends via implémentation

import { logger } from '../core/logger.js';

/**
 * Options pour le stockage d'embeddings
 */
export interface EmbedAndStoreOptions {
    chunkIndex?: number;
    totalChunks?: number;
    contentType?: string;
    role?: string;
    fileExtension?: string;
    language?: string;
    linesCount?: number;
    isCompressed?: boolean;
}

/**
 * Options pour la recherche sémantique
 */
export interface SemanticSearchOptions {
    projectFilter?: string;
    limit?: number;
    threshold?: number;
    dynamicThreshold?: boolean;
    contentTypeFilter?: string | string[];
    roleFilter?: string | string[];
    fileExtensionFilter?: string | string[];
    languageFilter?: string | string[];
    minFileSizeBytes?: number;
    maxFileSizeBytes?: number;
    minLinesCount?: number;
    maxLinesCount?: number;
    dateFrom?: Date;
    dateTo?: Date;
    includeCompressed?: boolean;
    excludeCompressed?: boolean;
    enableReranking?: boolean;
}

/**
 * Résultat de recherche sémantique
 */
export interface SearchResult {
    id: string;
    filePath: string;
    content: string;
    score: number;
    metadata: {
        projectPath: string;
        fileSize: number;
        originalSize: number;
        lines: number;
        contentType: string | null;
        role: string | null;
        fileExtension: string | null;
        language: string | null;
        linesCount: number | null;
        isCompressed: boolean;
        compressionRatio: string | null;
        createdAt: Date | null;
        updatedAt: Date | null;
    };
}

/**
 * Statistiques d'un projet
 */
export interface ProjectStats {
    totalFiles: number;
    totalChunks: number;
    indexedAt: Date | null;
    lastUpdated: Date | null;
    contentTypes: Record<string, number>;
}

/**
 * Statistiques du vector store
 */
export interface StoreStats {
    totalDocuments: number;
    totalProjects: number;
    totalSizeBytes: number;
    averageVectorDimension: number;
    lastUpdated: Date | null;
}

/**
 * Interface principale pour le stockage vectoriel RAG
 * 
 * Cette interface définit le contrat que tous les backends vectoriels
 * doivent implémenter (SQLite, PostgreSQL, etc.)
 */
export interface IVectorStore {
    // ========== OPÉRATIONS DE BASE ==========

    /**
     * Stocke un document avec son embedding
     * @param projectPath Chemin du projet
     * @param filePath Chemin du fichier
     * @param content Contenu du document
     * @param embedding Vecteur d'embedding
     * @param options Options de stockage
     */
    embedAndStore(
        projectPath: string,
        filePath: string,
        content: string,
        embedding: number[],
        options?: EmbedAndStoreOptions
    ): Promise<void>;

    /**
     * Recherche sémantique par similarité cosinus
     * @param queryEmbedding Vecteur de requête
     * @param options Options de recherche
     * @returns Résultats de recherche triés par score
     */
    semanticSearch(
        queryEmbedding: number[],
        options?: SemanticSearchOptions
    ): Promise<SearchResult[]>;

    /**
     * Supprime un document par son ID
     * @param id ID du document
     * @returns true si supprimé, false si non trouvé
     */
    deleteDocument(id: string): Promise<boolean>;

    /**
     * Supprime les documents correspondant à un pattern (LIKE)
     * @param pattern Pattern SQL LIKE
     * @returns Nombre de documents supprimés
     */
    deleteDocumentsByPattern(pattern: string): Promise<number>;

    // ========== OPÉRATIONS DE GESTION ==========

    /**
     * Obtient les statistiques d'un projet spécifique
     * @param projectPath Chemin du projet
     */
    getProjectStats(projectPath: string): Promise<ProjectStats>;

    /**
     * Liste tous les projets indexés
     */
    listProjects(): Promise<string[]>;

    /**
     * Obtient les statistiques globales du store
     */
    getStats(): Promise<StoreStats>;

    /**
     * Vide complètement le store (pour les tests)
     */
    clearAll(): Promise<void>;

    /**
     * Initialise les tables/schémas si nécessaire
     */
    initialize(): Promise<void>;

    /**
     * Vérifie la connectivité au backend
     */
    testConnection(): Promise<boolean>;

    // ========== OPÉRATIONS AVANCÉES ==========

    /**
     * Met à jour un document existant
     * @param id ID du document
     * @param updates Mises à jour à appliquer
     */
    updateDocument(
        id: string,
        updates: Partial<{
            content: string;
            embedding: number[];
            metadata: Partial<EmbedAndStoreOptions>;
        }>
    ): Promise<boolean>;

    /**
     * Recherche hybride (sémantique + textuelle)
     * @param queryEmbedding Vecteur de requête
     * @param textQuery Requête textuelle
     * @param options Options de recherche
     */
    hybridSearch?(
        queryEmbedding: number[],
        textQuery: string,
        options?: SemanticSearchOptions & {
            semanticWeight?: number;
            textWeight?: number;
        }
    ): Promise<SearchResult[]>;

    /**
     * Recherche par métadonnées
     * @param filters Filtres de métadonnées
     */
    searchByMetadata?(
        filters: Partial<EmbedAndStoreOptions> & {
            projectPath?: string;
            dateRange?: { from?: Date; to?: Date };
        }
    ): Promise<SearchResult[]>;
}

/**
 * Configuration pour un backend vectoriel
 */
export interface VectorStoreConfig {
    type: 'sqlite' | 'postgresql' | 'memory';

    // Configuration SQLite
    sqlite?: {
        file: string;
        memory?: boolean;
        readonly?: boolean;
    };

    // Configuration PostgreSQL
    postgresql?: {
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
        ssl?: boolean;
        poolSize?: number;
    };

    // Configuration mémoire
    memory?: {
        maxDocuments?: number;
        persistToFile?: string;
    };

    // Options communes
    options?: {
        enableCompression?: boolean;
        compressionThreshold?: number;
        enableCache?: boolean;
        cacheSize?: number;
        vectorDimension?: number;
        similarityFunction?: 'cosine' | 'euclidean' | 'dot';
    };
}

/**
 * Erreurs spécifiques au vector store
 */
export class VectorStoreError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly context?: Record<string, any>
    ) {
        super(message);
        this.name = 'VectorStoreError';
    }
}

/**
 * Factory pour créer des instances de vector store
 * (sera implémentée dans vector-store-factory.ts)
 */
export type VectorStoreFactory = (config: VectorStoreConfig) => IVectorStore;

/**
 * Valide une configuration de vector store
 */
export function validateVectorStoreConfig(config: VectorStoreConfig): string[] {
    const errors: string[] = [];

    if (!config.type) {
        errors.push('Le type de backend est requis');
    }

    switch (config.type) {
        case 'sqlite':
            if (!config.sqlite?.file) {
                errors.push('Le fichier SQLite est requis pour le backend SQLite');
            }
            break;

        case 'postgresql':
            if (!config.postgresql?.host || !config.postgresql?.database) {
                errors.push('L\'hôte et la base de données sont requis pour PostgreSQL');
            }
            break;

        case 'memory':
            // Pas de validation spécifique pour memory
            break;

        default:
            errors.push(`Type de backend non supporté: ${config.type}`);
    }

    return errors;
}

/**
 * Crée un ID unique pour un document
 */
export function createDocumentId(
    projectPath: string,
    filePath: string,
    chunkIndex?: number
): string {
    const cleanFilePath = filePath.replace(/#chunk\d+$/, '');

    if (chunkIndex !== undefined) {
        return `${projectPath}:${cleanFilePath}#chunk${chunkIndex}`;
    }

    return `${projectPath}:${cleanFilePath}`;
}

/**
 * Extrait les informations d'un ID de document
 */
export function parseDocumentId(id: string): {
    projectPath: string;
    filePath: string;
    chunkIndex?: number;
} {
    const [projectPath, rest] = id.split(':', 2);

    if (!rest) {
        throw new VectorStoreError(
            `ID de document invalide: ${id}`,
            'INVALID_DOCUMENT_ID'
        );
    }

    const chunkMatch = rest.match(/#chunk(\d+)$/);

    if (chunkMatch) {
        const filePath = rest.replace(/#chunk\d+$/, '');
        const chunkIndex = parseInt(chunkMatch[1], 10);

        return {
            projectPath,
            filePath,
            chunkIndex
        };
    }

    return {
        projectPath,
        filePath: rest
    };
}

/**
 * Wrapper de logger pour le vector store
 */
export class VectorStoreLogger {
    static info(operation: string, message: string, context?: Record<string, any>) {
        logger.info(`rag.vectorstore.${operation}`, message, context);
    }

    static error(operation: string, message: string, error?: Error, context?: Record<string, any>) {
        logger.error(`rag.vectorstore.${operation}.error`, message, {
            ...context,
            error: error?.message || String(error)
        });
    }

    static warn(operation: string, message: string, context?: Record<string, any>) {
        logger.warn(`rag.vectorstore.${operation}.warning`, message, context);
    }

    static debug(operation: string, message: string, context?: Record<string, any>) {
        logger.debug(`rag.vectorstore.${operation}.debug`, message, context);
    }
}
