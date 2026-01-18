// src/rag/vector-store-sqlite.ts
// Backend SQLite pour le stockage vectoriel RAG - Implémente IVectorStore
import { getDbConfigManager } from "../config/db-config.js";
import { VectorStoreLogger, createDocumentId, } from "./vector-store-interface.js";
/**
 * Classe principale pour le backend SQLite vectoriel
 * Implémente l'interface IVectorStore pour l'abstraction
 */
export class VectorStoreSQLite {
    db;
    dbConfigManager = getDbConfigManager();
    config;
    constructor(config) {
        if (config) {
            this.config = config;
            // Utiliser la configuration fournie
            if (config.sqlite?.file) {
                // Charger sqlite3 dynamiquement
                const sqlite3 = this.loadSqlite3();
                this.db = new sqlite3.Database(config.sqlite.file);
            }
            else {
                // Fallback à la configuration existante
                this.db = this.dbConfigManager.getSqliteConnection("vectors");
            }
        }
        else {
            // Compatibilité avec l'ancien code
            this.db = this.dbConfigManager.getSqliteConnection("vectors");
            this.config = {
                type: "sqlite",
                sqlite: { file: ":memory:" }, // Valeur par défaut
            };
        }
        this.initializeTable();
    }
    async deleteDocumentsByPattern(pattern) {
        try {
            // Utiliser LIKE pour les patterns SQL
            // Le pattern peut contenir % pour n'importe quelle séquence de caractères
            // et _ pour un seul caractère
            const result = await this.runQuery("DELETE FROM rag_vectors WHERE id LIKE ? OR file_path LIKE ? OR project_path LIKE ?", [pattern, pattern, pattern]);
            const deletedCount = result.changes;
            VectorStoreLogger.info("deleteByPattern", `${deletedCount} documents supprimés avec le pattern: ${pattern}`, {
                pattern,
                deletedCount,
            });
            return deletedCount;
        }
        catch (error) {
            VectorStoreLogger.error("deleteByPattern", `Erreur lors de la suppression avec pattern: ${pattern}`, error, {
                pattern,
            });
            throw error;
        }
    }
    async getStats() {
        try {
            // Récupérer les statistiques globales
            const statsResult = await this.getQuery(`SELECT
          COUNT(*) as total_documents,
          COUNT(DISTINCT project_path) as total_projects,
          SUM(file_size_bytes) as total_size_bytes,
          MAX(updated_at) as last_updated
        FROM rag_vectors`);
            // Calculer la dimension moyenne des vecteurs
            const dimensionResult = await this.getQuery(`SELECT
          AVG(LENGTH(embedding) / 4) as avg_dimension
        FROM rag_vectors
        WHERE embedding IS NOT NULL`);
            const totalDocuments = parseInt(statsResult.total_documents) || 0;
            const totalProjects = parseInt(statsResult.total_projects) || 0;
            const totalSizeBytes = parseInt(statsResult.total_size_bytes) || 0;
            const averageVectorDimension = parseFloat(dimensionResult.avg_dimension) || 0;
            const lastUpdated = statsResult.last_updated
                ? new Date(statsResult.last_updated)
                : null;
            const stats = {
                totalDocuments,
                totalProjects,
                totalSizeBytes,
                averageVectorDimension,
                lastUpdated,
            };
            VectorStoreLogger.info("getStats", "Statistiques globales récupérées", {
                totalDocuments,
                totalProjects,
                totalSizeBytes: `${(totalSizeBytes / 1024 / 1024).toFixed(2)} MB`,
                averageVectorDimension: averageVectorDimension.toFixed(2),
                lastUpdated,
            });
            return stats;
        }
        catch (error) {
            VectorStoreLogger.error("getStats", "Erreur lors de la récupération des statistiques globales", error);
            throw error;
        }
    }
    async initialize() {
        try {
            // Appeler la méthode d'initialisation existante
            this.initializeTable();
            // Vérifier que les tables existent
            const tableCheck = await this.getQuery("SELECT name FROM sqlite_master WHERE type='table' AND name='rag_vectors'");
            if (!tableCheck) {
                throw new Error("La table rag_vectors n'a pas été créée");
            }
            VectorStoreLogger.info("initialize", "Vector store SQLite initialisé avec succès");
        }
        catch (error) {
            VectorStoreLogger.error("initialize", "Erreur lors de l'initialisation du vector store", error);
            throw error;
        }
    }
    async testConnection() {
        try {
            // Exécuter une requête simple pour tester la connexion
            const result = await this.getQuery("SELECT 1 as test_value");
            // Vérifier que le résultat est correct
            const connectionOk = result && result.test_value === 1;
            if (connectionOk) {
                VectorStoreLogger.info("testConnection", "Connexion SQLite testée avec succès");
            }
            else {
                VectorStoreLogger.warn("testConnection", "Connexion SQLite testée mais résultat inattendu", {
                    result,
                });
            }
            return connectionOk;
        }
        catch (error) {
            VectorStoreLogger.error("testConnection", "Erreur lors du test de connexion SQLite", error);
            return false;
        }
    }
    async updateDocument(id, updates) {
        try {
            // Vérifier que le document existe
            const existingDoc = await this.getQuery("SELECT id FROM rag_vectors WHERE id = ?", [id]);
            if (!existingDoc) {
                VectorStoreLogger.warn("updateDocument", `Document non trouvé: ${id}`, {
                    id,
                });
                return false;
            }
            // Construire dynamiquement la requête UPDATE
            const updateFields = [];
            const params = [];
            // Mettre à jour le contenu si fourni
            if (updates.content !== undefined) {
                updateFields.push("content = ?");
                params.push(updates.content);
                // Mettre à jour la taille du fichier si le contenu change
                updateFields.push("file_size_bytes = ?");
                params.push(updates.content.length);
                // Mettre à jour le nombre de lignes
                updateFields.push("lines_count = ?");
                params.push(updates.content.split("\n").length);
            }
            // Mettre à jour l'embedding si fourni
            if (updates.embedding !== undefined) {
                updateFields.push("embedding = ?");
                const embeddingBuffer = Buffer.from(new Float32Array(updates.embedding).buffer);
                params.push(embeddingBuffer);
            }
            // Mettre à jour les métadonnées si fournies
            if (updates.metadata) {
                const { metadata } = updates;
                if (metadata.contentType !== undefined) {
                    updateFields.push("content_type = ?");
                    params.push(metadata.contentType);
                }
                if (metadata.role !== undefined) {
                    updateFields.push("role = ?");
                    params.push(metadata.role);
                }
                if (metadata.fileExtension !== undefined) {
                    updateFields.push("file_extension = ?");
                    params.push(metadata.fileExtension);
                }
                if (metadata.language !== undefined) {
                    updateFields.push("language = ?");
                    params.push(metadata.language);
                }
                if (metadata.linesCount !== undefined) {
                    updateFields.push("lines_count = ?");
                    params.push(metadata.linesCount);
                }
                if (metadata.isCompressed !== undefined) {
                    updateFields.push("is_compressed = ?");
                    params.push(metadata.isCompressed ? 1 : 0);
                    // Mettre à jour la taille originale si compression
                    if (metadata.isCompressed && updates.content !== undefined) {
                        updateFields.push("original_size_bytes = ?");
                        params.push(Buffer.from(updates.content).length);
                    }
                }
            }
            // Toujours mettre à jour la date de mise à jour
            updateFields.push("updated_at = CURRENT_TIMESTAMP");
            // Si aucun champ à mettre à jour
            if (updateFields.length === 1) {
                // Seulement updated_at
                VectorStoreLogger.warn("updateDocument", `Aucune mise à jour à appliquer pour: ${id}`, { id });
                return true; // Document existe mais pas de changements
            }
            // Construire la requête SQL
            const sql = `UPDATE rag_vectors SET ${updateFields.join(", ")} WHERE id = ?`;
            params.push(id);
            // Exécuter la mise à jour
            const result = await this.runQuery(sql, params);
            const updated = result.changes > 0;
            if (updated) {
                VectorStoreLogger.info("updateDocument", `Document mis à jour: ${id}`, {
                    id,
                    updatedFields: updateFields.filter((f) => f !== "updated_at = CURRENT_TIMESTAMP"),
                });
            }
            else {
                VectorStoreLogger.warn("updateDocument", `Aucune ligne mise à jour pour: ${id}`, { id });
            }
            return updated;
        }
        catch (error) {
            VectorStoreLogger.error("updateDocument", `Erreur lors de la mise à jour du document ${id}`, error, { id });
            throw error;
        }
    }
    async hybridSearch(queryEmbedding, textQuery, options) {
        try {
            // Pondérations par défaut
            const semanticWeight = options?.semanticWeight ?? 0.7;
            const textWeight = options?.textWeight ?? 0.3;
            // Valider les pondérations
            if (semanticWeight + textWeight !== 1.0) {
                VectorStoreLogger.warn("hybridSearch", `Somme des pondérations != 1.0 (semantic=${semanticWeight}, text=${textWeight}). Normalisation automatique.`, { semanticWeight, textWeight });
            }
            // 1. Recherche sémantique
            const semanticResults = await this.semanticSearch(queryEmbedding, options);
            // 2. Recherche textuelle (LIKE sur le contenu)
            let textResults = [];
            if (textQuery.trim()) {
                // Recherche textuelle simple avec LIKE
                const sql = `
          SELECT id, project_path, file_path, content, content_type, role,
                 file_extension, lines_count, language, is_compressed, original_size_bytes,
                 embedding, created_at, updated_at
          FROM rag_vectors
          WHERE content LIKE ?
          ${options?.projectFilter ? "AND project_path = ?" : ""}
          ${options?.contentTypeFilter
                    ? Array.isArray(options.contentTypeFilter)
                        ? `AND content_type IN (${options.contentTypeFilter.map(() => "?").join(", ")})`
                        : "AND content_type = ?"
                    : ""}
          LIMIT ?
        `;
                const params = [`%${textQuery}%`];
                if (options?.projectFilter)
                    params.push(options.projectFilter);
                if (options?.contentTypeFilter) {
                    if (Array.isArray(options.contentTypeFilter)) {
                        params.push(...options.contentTypeFilter);
                    }
                    else {
                        params.push(options.contentTypeFilter);
                    }
                }
                params.push(options?.limit || 50); // Plus de résultats pour le scoring
                const rows = await this.allQuery(sql, params);
                // Calculer un score textuel basé sur la fréquence des mots
                const queryWords = textQuery
                    .toLowerCase()
                    .split(/\s+/)
                    .filter((w) => w.length > 2);
                textResults = rows.map((row) => {
                    const content = row.content.toLowerCase();
                    let textScore = 0;
                    if (queryWords.length > 0) {
                        // Score basé sur la fréquence des mots
                        queryWords.forEach((word) => {
                            const regex = new RegExp(`\\b${word}\\b`, "gi");
                            const matches = content.match(regex);
                            if (matches) {
                                textScore += matches.length;
                            }
                        });
                        // Normaliser le score
                        textScore = Math.min(1.0, textScore / 10);
                    }
                    else {
                        // Si la requête est trop courte, utiliser un score basé sur la présence
                        textScore = content.includes(textQuery.toLowerCase()) ? 0.5 : 0.1;
                    }
                    // Convertir l'embedding si nécessaire pour la cohérence
                    const embeddingBuffer = row.embedding;
                    const storedEmbedding = Array.from(new Float32Array(embeddingBuffer.buffer));
                    return {
                        id: row.id,
                        filePath: row.file_path,
                        content: row.content,
                        score: textScore, // Score temporaire
                        textScore,
                        metadata: {
                            projectPath: row.project_path,
                            fileSize: row.file_size_bytes,
                            originalSize: row.original_size_bytes || row.file_size_bytes,
                            lines: row.content.split("\n").length,
                            contentType: row.content_type || null,
                            role: row.role || null,
                            fileExtension: row.file_extension || null,
                            language: row.language || null,
                            linesCount: row.lines_count || null,
                            isCompressed: row.is_compressed === 1,
                            compressionRatio: row.is_compressed === 1 && row.original_size_bytes
                                ? ((row.content.length / row.original_size_bytes) *
                                    100).toFixed(1) + "%"
                                : null,
                            createdAt: row.created_at ? new Date(row.created_at) : null,
                            updatedAt: row.updated_at ? new Date(row.updated_at) : null,
                        },
                    };
                });
                // Trier par score textuel
                textResults.sort((a, b) => b.textScore - a.textScore);
            }
            // 3. Combiner les résultats
            const allResults = new Map();
            // Ajouter les résultats sémantiques
            semanticResults.forEach((result) => {
                allResults.set(result.id, {
                    ...result,
                    semanticScore: result.score,
                    textScore: 0,
                });
            });
            // Ajouter ou mettre à jour avec les résultats textuels
            textResults.forEach((result) => {
                const existing = allResults.get(result.id);
                if (existing) {
                    // Mettre à jour le score textuel
                    existing.textScore = result.textScore;
                }
                else {
                    // Ajouter le résultat textuel
                    allResults.set(result.id, {
                        ...result,
                        semanticScore: 0,
                        textScore: result.textScore,
                    });
                }
            });
            // 4. Calculer le score hybride
            const hybridResults = Array.from(allResults.values()).map((result) => {
                // Normaliser les scores si nécessaire
                const normalizedSemantic = result.semanticScore || 0;
                const normalizedText = result.textScore || 0;
                // Score hybride pondéré
                const hybridScore = normalizedSemantic * semanticWeight + normalizedText * textWeight;
                return {
                    ...result,
                    score: hybridScore,
                };
            });
            // 5. Trier par score hybride et limiter
            hybridResults.sort((a, b) => b.score - a.score);
            const limit = options?.limit || 10;
            const finalResults = hybridResults.slice(0, limit);
            VectorStoreLogger.info("hybridSearch", "Recherche hybride terminée", {
                semanticResults: semanticResults.length,
                textResults: textResults.length,
                combinedResults: allResults.size,
                finalResults: finalResults.length,
                semanticWeight,
                textWeight,
                queryLength: textQuery.length,
            });
            return finalResults;
        }
        catch (error) {
            VectorStoreLogger.error("hybridSearch", "Erreur lors de la recherche hybride", error, {
                textQueryLength: textQuery?.length,
            });
            throw error;
        }
    }
    async searchByMetadata(filters) {
        try {
            // Construire dynamiquement la requête SQL
            let sql = `
        SELECT id, project_path, file_path, content, content_type, role,
               file_extension, lines_count, language, is_compressed, original_size_bytes,
               embedding, created_at, updated_at
        FROM rag_vectors
        WHERE 1=1
      `;
            const params = [];
            // Filtres de base
            if (filters.projectPath) {
                sql += " AND project_path = ?";
                params.push(filters.projectPath);
            }
            // Filtres de métadonnées
            if (filters.contentType) {
                sql += " AND content_type = ?";
                params.push(filters.contentType);
            }
            if (filters.role) {
                sql += " AND role = ?";
                params.push(filters.role);
            }
            if (filters.fileExtension) {
                sql += " AND file_extension = ?";
                params.push(filters.fileExtension);
            }
            if (filters.language) {
                sql += " AND language = ?";
                params.push(filters.language);
            }
            if (filters.linesCount !== undefined) {
                sql += " AND lines_count = ?";
                params.push(filters.linesCount);
            }
            if (filters.isCompressed !== undefined) {
                sql += " AND is_compressed = ?";
                params.push(filters.isCompressed ? 1 : 0);
            }
            // Filtres de plage de dates
            if (filters.dateRange) {
                const { from, to } = filters.dateRange;
                if (from) {
                    sql += " AND created_at >= ?";
                    params.push(from.toISOString());
                }
                if (to) {
                    sql += " AND created_at <= ?";
                    params.push(to.toISOString());
                }
            }
            // Note: fileSizeBytes n'est pas dans EmbedAndStoreOptions, donc on ne peut pas le filtrer directement
            // Si besoin, utiliser SemanticSearchOptions à la place
            // Filtres de chunk (si disponibles)
            if (filters.chunkIndex !== undefined) {
                sql += " AND chunk_index = ?";
                params.push(filters.chunkIndex);
            }
            if (filters.totalChunks !== undefined) {
                sql += " AND total_chunks = ?";
                params.push(filters.totalChunks);
            }
            // Trier par date de création (plus récent d'abord)
            sql += " ORDER BY created_at DESC";
            // Limiter les résultats (par défaut 100)
            sql += " LIMIT 100";
            // Exécuter la requête
            const rows = await this.allQuery(sql, params);
            // Convertir les résultats au format SearchResult
            const results = rows.map((row) => {
                // Convertir l'embedding si nécessaire pour la cohérence
                const embeddingBuffer = row.embedding;
                const storedEmbedding = Array.from(new Float32Array(embeddingBuffer.buffer));
                return {
                    id: row.id,
                    filePath: row.file_path,
                    content: row.content,
                    score: 1.0, // Score par défaut pour les recherches par métadonnées
                    metadata: {
                        projectPath: row.project_path,
                        fileSize: row.file_size_bytes,
                        originalSize: row.original_size_bytes || row.file_size_bytes,
                        lines: row.content.split("\n").length,
                        contentType: row.content_type || null,
                        role: row.role || null,
                        fileExtension: row.file_extension || null,
                        language: row.language || null,
                        linesCount: row.lines_count || null,
                        isCompressed: row.is_compressed === 1,
                        compressionRatio: row.is_compressed === 1 && row.original_size_bytes
                            ? ((row.content.length / row.original_size_bytes) *
                                100).toFixed(1) + "%"
                            : null,
                        createdAt: row.created_at ? new Date(row.created_at) : null,
                        updatedAt: row.updated_at ? new Date(row.updated_at) : null,
                    },
                };
            });
            VectorStoreLogger.info("searchByMetadata", "Recherche par métadonnées terminée", {
                filters: Object.keys(filters).filter((key) => {
                    // Vérifier si la clé existe et a une valeur définie
                    const value = filters[key];
                    return value !== undefined;
                }),
                resultsCount: results.length,
                hasDateRange: !!filters.dateRange,
            });
            return results;
        }
        catch (error) {
            VectorStoreLogger.error("searchByMetadata", "Erreur lors de la recherche par métadonnées", error, {
                filters: Object.keys(filters).filter((key) => {
                    // Vérifier si la clé existe et a une valeur définie
                    const value = filters[key];
                    return value !== undefined;
                }),
            });
            throw error;
        }
    }
    /**
     * Charge sqlite3 dynamiquement
     */
    loadSqlite3() {
        try {
            // Utiliser require pour compatibilité
            return require("sqlite3");
        }
        catch (error) {
            // Fallback pour les tests
            return {
                Database: class MockDatabase {
                    constructor(path) { }
                    exec(sql) { }
                    run(sql, params, callback) {
                        if (callback)
                            callback(null);
                        return { changes: 0 };
                    }
                    all(sql, params, callback) {
                        if (callback)
                            callback(null, []);
                    }
                    get(sql, params, callback) {
                        if (callback)
                            callback(null, {});
                    }
                },
            };
        }
    }
    /**
     * Initialise la table si elle n'existe pas
     */
    initializeTable() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS rag_vectors (
                id TEXT PRIMARY KEY,
                project_path TEXT NOT NULL,
                file_path TEXT NOT NULL,
                chunk_index INTEGER NOT NULL,
                total_chunks INTEGER NOT NULL,
                content TEXT NOT NULL,
                content_type TEXT NOT NULL,
                role TEXT,
                file_extension TEXT,
                file_size_bytes INTEGER NOT NULL,
                lines_count INTEGER,
                language TEXT,
                embedding BLOB NOT NULL,
                is_compressed BOOLEAN DEFAULT FALSE,
                original_size_bytes INTEGER,
                version INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_rag_vectors_project ON rag_vectors(project_path);
            CREATE INDEX IF NOT EXISTS idx_rag_vectors_file ON rag_vectors(file_path);
            CREATE INDEX IF NOT EXISTS idx_rag_vectors_content_type ON rag_vectors(content_type);
            CREATE INDEX IF NOT EXISTS idx_rag_vectors_language ON rag_vectors(language);
            CREATE INDEX IF NOT EXISTS idx_rag_vectors_created ON rag_vectors(created_at);
            CREATE INDEX IF NOT EXISTS idx_rag_vectors_updated ON rag_vectors(updated_at);
        `);
        VectorStoreLogger.info("init", "Table rag_vectors initialisée");
    }
    /**
     * Normalise la longueur des vecteurs pour qu'ils aient la même dimension
     * - Si les vecteurs ont la même longueur, les retourner tels quels
     * - Sinon, pad le vecteur plus court avec des zéros et tronquer le plus long
     */
    normalizeVectorLength(vec1, vec2) {
        if (vec1.length === vec2.length) {
            return [vec1, vec2];
        }
        const targetLength = Math.max(vec1.length, vec2.length);
        const normalize = (vec, length) => {
            if (vec.length === length) {
                return vec;
            }
            const result = new Array(length).fill(0);
            const copyLength = Math.min(vec.length, length);
            for (let i = 0; i < copyLength; i++) {
                result[i] = vec[i];
            }
            return result;
        };
        return [normalize(vec1, targetLength), normalize(vec2, targetLength)];
    }
    /**
     * Calcule la similarité cosinus entre deux vecteurs
     * Gère les vecteurs de dimensions différentes en les normalisant
     */
    cosineSimilarity(vec1, vec2) {
        // Normaliser les longueurs si nécessaire
        const [normalizedVec1, normalizedVec2] = this.normalizeVectorLength(vec1, vec2);
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;
        for (let i = 0; i < normalizedVec1.length; i++) {
            dotProduct += normalizedVec1[i] * normalizedVec2[i];
            norm1 += normalizedVec1[i] * normalizedVec1[i];
            norm2 += normalizedVec2[i] * normalizedVec2[i];
        }
        if (norm1 === 0 || norm2 === 0) {
            return 0;
        }
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }
    /**
     * Stocke un document avec son embedding
     * Implémentation de IVectorStore.embedAndStore
     */
    async embedAndStore(projectPath, filePath, content, embedding, options = {}) {
        const { chunkIndex = 0, totalChunks = 1, contentType = "other", role = null, fileExtension = null, language = null, linesCount = null, isCompressed = false, } = options;
        // Utiliser la fonction utilitaire pour créer l'ID
        const id = createDocumentId(projectPath, filePath, chunkIndex);
        // Calculer les métadonnées automatiquement si non fournies
        const finalFileExtension = fileExtension || filePath.split(".").pop() || null;
        const finalLinesCount = linesCount || content.split("\n").length;
        const fileSizeBytes = content.length;
        const originalSizeBytes = isCompressed
            ? Buffer.from(content).length
            : content.length;
        // Convertir l'embedding en Buffer pour stockage BLOB
        const embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer);
        try {
            await this.runQuery(`INSERT INTO rag_vectors (
                    id, project_path, file_path, chunk_index, total_chunks,
                    content, content_type, role, file_extension, file_size_bytes,
                    lines_count, language, embedding, is_compressed, original_size_bytes,
                    version, created_at, updated_at, indexed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET
                    content = excluded.content,
                    content_type = excluded.content_type,
                    role = excluded.role,
                    file_extension = excluded.file_extension,
                    file_size_bytes = excluded.file_size_bytes,
                    lines_count = excluded.lines_count,
                    language = excluded.language,
                    embedding = excluded.embedding,
                    is_compressed = excluded.is_compressed,
                    original_size_bytes = excluded.original_size_bytes,
                    updated_at = CURRENT_TIMESTAMP`, [
                id,
                projectPath,
                filePath,
                chunkIndex,
                totalChunks,
                content,
                contentType,
                role,
                finalFileExtension,
                fileSizeBytes,
                finalLinesCount,
                language,
                embeddingBuffer,
                isCompressed ? 1 : 0,
                originalSizeBytes,
            ]);
            VectorStoreLogger.info("store", `Document stocké: ${id}`, {
                projectPath,
                filePath,
                contentType,
                chunkIndex,
                totalChunks,
            });
        }
        catch (error) {
            VectorStoreLogger.error("store", `Erreur lors du stockage du document ${id}`, error, {
                projectPath,
                filePath,
            });
            throw error;
        }
    }
    /**
     * Recherche sémantique avec similarité cosinus
     * Implémentation de IVectorStore.semanticSearch
     */
    async semanticSearch(queryEmbedding, options = {}) {
        const { projectFilter, limit = 10, threshold = 0.3, contentTypeFilter, roleFilter, languageFilter, minFileSizeBytes, maxFileSizeBytes, minLinesCount, maxLinesCount, dateFrom, dateTo, } = options;
        // Récupérer tous les vecteurs avec leurs métadonnées
        // Note: Pour les grandes bases, il faudrait implémenter un index vectoriel
        // Pour l'instant, on calcule la similarité en mémoire
        let sql = `
            SELECT id, project_path, file_path, content, content_type, role,
                   file_extension, lines_count, language, is_compressed, original_size_bytes,
                   embedding, created_at, updated_at
            FROM rag_vectors
            WHERE 1=1
        `;
        const params = [];
        // Appliquer les filtres
        if (projectFilter) {
            sql += " AND project_path = ?";
            params.push(projectFilter);
        }
        if (contentTypeFilter) {
            if (Array.isArray(contentTypeFilter)) {
                if (contentTypeFilter.length > 0) {
                    const placeholders = contentTypeFilter.map(() => "?").join(", ");
                    sql += ` AND content_type IN (${placeholders})`;
                    params.push(...contentTypeFilter);
                }
            }
            else {
                sql += " AND content_type = ?";
                params.push(contentTypeFilter);
            }
        }
        if (roleFilter) {
            if (Array.isArray(roleFilter)) {
                if (roleFilter.length > 0) {
                    const placeholders = roleFilter.map(() => "?").join(", ");
                    sql += ` AND role IN (${placeholders})`;
                    params.push(...roleFilter);
                }
            }
            else {
                sql += " AND role = ?";
                params.push(roleFilter);
            }
        }
        if (languageFilter) {
            if (Array.isArray(languageFilter)) {
                if (languageFilter.length > 0) {
                    const placeholders = languageFilter.map(() => "?").join(", ");
                    sql += ` AND language IN (${placeholders})`;
                    params.push(...languageFilter);
                }
            }
            else {
                sql += " AND language = ?";
                params.push(languageFilter);
            }
        }
        if (minFileSizeBytes !== undefined) {
            sql += " AND file_size_bytes >= ?";
            params.push(minFileSizeBytes);
        }
        if (maxFileSizeBytes !== undefined) {
            sql += " AND file_size_bytes <= ?";
            params.push(maxFileSizeBytes);
        }
        if (minLinesCount !== undefined) {
            sql += " AND lines_count >= ?";
            params.push(minLinesCount);
        }
        if (maxLinesCount !== undefined) {
            sql += " AND lines_count <= ?";
            params.push(maxLinesCount);
        }
        if (dateFrom) {
            sql += " AND created_at >= ?";
            params.push(dateFrom.toISOString());
        }
        if (dateTo) {
            sql += " AND created_at <= ?";
            params.push(dateTo.toISOString());
        }
        try {
            const rows = await this.allQuery(sql, params);
            const results = [];
            // Calculer la similarité pour chaque résultat
            for (const row of rows) {
                // Convertir le BLOB en tableau de nombres
                const embeddingBuffer = row.embedding;
                const storedEmbedding = Array.from(new Float32Array(embeddingBuffer.buffer));
                // Calculer la similarité cosinus
                const similarity = this.cosineSimilarity(queryEmbedding, storedEmbedding);
                if (similarity >= threshold) {
                    results.push({
                        id: row.id,
                        filePath: row.file_path,
                        content: row.content,
                        score: similarity,
                        similarity,
                        metadata: {
                            projectPath: row.project_path,
                            fileSize: row.file_size_bytes,
                            originalSize: row.original_size_bytes || row.file_size_bytes,
                            lines: row.content.split("\n").length,
                            contentType: row.content_type || null,
                            role: row.role || null,
                            fileExtension: row.file_extension || null,
                            language: row.language || null,
                            linesCount: row.lines_count || null,
                            isCompressed: row.is_compressed === 1,
                            compressionRatio: row.is_compressed === 1 && row.original_size_bytes
                                ? ((row.content.length / row.original_size_bytes) *
                                    100).toFixed(1) + "%"
                                : null,
                            createdAt: row.created_at ? new Date(row.created_at) : null,
                            updatedAt: row.updated_at ? new Date(row.updated_at) : null,
                        },
                    });
                }
            }
            // Trier par similarité (décroissant) et limiter
            results.sort((a, b) => b.similarity - a.similarity);
            const limitedResults = results.slice(0, limit);
            VectorStoreLogger.info("search", `Recherche terminée: ${limitedResults.length} résultats`, {
                totalCandidates: rows.length,
                filteredResults: results.length,
                finalResults: limitedResults.length,
                threshold,
            });
            return limitedResults;
        }
        catch (error) {
            VectorStoreLogger.error("search", "Erreur lors de la recherche sémantique", error);
            throw error;
        }
    }
    /**
     * Obtient les statistiques d'un projet
     * Implémentation de IVectorStore.getProjectStats
     */
    async getProjectStats(projectPath) {
        try {
            // Statistiques de base
            const statsResult = await this.getQuery(`SELECT
                    COUNT(*) as total_chunks,
                    MIN(created_at) as indexed_at,
                    MAX(updated_at) as last_updated
                FROM rag_vectors
                WHERE project_path = ?`, [projectPath]);
            const totalChunks = parseInt(statsResult.total_chunks) || 0;
            // Compter les fichiers uniques (approximation basée sur file_path sans chunk index)
            const filesResult = await this.getQuery(`SELECT COUNT(DISTINCT
                    CASE
                        WHEN INSTR(file_path, '#chunk') > 0
                        THEN SUBSTR(file_path, 1, INSTR(file_path, '#chunk') - 1)
                        ELSE file_path
                    END
                ) as total_files
                FROM rag_vectors
                WHERE project_path = ?`, [projectPath]);
            const totalFiles = parseInt(filesResult.total_files) || 0;
            // Distribution par type de contenu
            const typesResult = await this.allQuery(`SELECT content_type, COUNT(*) as count
                FROM rag_vectors
                WHERE project_path = ?
                GROUP BY content_type`, [projectPath]);
            const contentTypes = {};
            typesResult.forEach((typeRow) => {
                contentTypes[typeRow.content_type] = parseInt(typeRow.count);
            });
            return {
                totalFiles,
                totalChunks,
                indexedAt: statsResult.indexed_at
                    ? new Date(statsResult.indexed_at)
                    : null,
                lastUpdated: statsResult.last_updated
                    ? new Date(statsResult.last_updated)
                    : null,
                contentTypes,
            };
        }
        catch (error) {
            VectorStoreLogger.error("stats", `Erreur lors de la récupération des stats pour ${projectPath}`, error);
            throw error;
        }
    }
    /**
     * Liste tous les projets indexés
     * Implémentation de IVectorStore.listProjects
     */
    async listProjects() {
        try {
            const result = await this.allQuery(`SELECT DISTINCT project_path FROM rag_vectors ORDER BY project_path`);
            return result.map((row) => row.project_path);
        }
        catch (error) {
            VectorStoreLogger.error("list", "Erreur lors du listing des projets", error);
            throw error;
        }
    }
    /**
     * Supprime un document par son ID
     * Implémentation de IVectorStore.deleteDocument
     */
    async deleteDocument(id) {
        try {
            const result = await this.runQuery("DELETE FROM rag_vectors WHERE id = ?", [id]);
            const deleted = result.changes > 0;
            if (deleted) {
                VectorStoreLogger.info("delete", `Document supprimé: ${id}`);
            }
            return deleted;
        }
        catch (error) {
            VectorStoreLogger.error("delete", `Erreur lors de la suppression du document ${id}`, error);
            throw error;
        }
    }
    /**
     * Vide la table (pour les tests)
     * Implémentation de IVectorStore.clearAll
     */
    async clearAll() {
        try {
            await this.runQuery("DELETE FROM rag_vectors");
            VectorStoreLogger.info("clear", "Tous les documents ont été supprimés");
        }
        catch (error) {
            VectorStoreLogger.error("clear", "Erreur lors du vidage de la table", error);
            throw error;
        }
    }
    /**
     * Exécute une requête SQL et retourne le résultat
     */
    runQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve({ changes: this.changes || 0 });
                }
            });
        });
    }
    /**
     * Exécute une requête SQL et retourne toutes les lignes
     */
    allQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(rows);
                }
            });
        });
    }
    /**
     * Exécute une requête SQL et retourne une seule ligne
     */
    getQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(row);
                }
            });
        });
    }
}
//# sourceMappingURL=vector-store-sqlite.js.map