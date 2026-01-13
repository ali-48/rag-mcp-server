import { Pool } from "pg";
import { promisify } from "util";
import { gunzip, gzip } from "zlib";
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
// Configuration de la connexion PostgreSQL
const pool = new Pool({
    host: "localhost",
    port: 5432,
    database: "rag_db",
    user: "rag_user",
    password: "rag_password",
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
// Configuration du provider
let embeddingProvider = "fake";
let embeddingModels = {
    code: 'nomic-embed-code',
    text: 'nomic-embed-text',
    config: 'bge-small',
    fallback: 'qwen3-embedding:8b'
};
// Dimensions par type (pour référence)
const embeddingDimensions = {
    code: 768,
    text: 768,
    config: 384,
    fallback: 1024
};
const embeddingCache = new Map();
const CACHE_MAX_SIZE = 1000;
const CACHE_TTL = 3600 * 1000; // 1 heure en millisecondes
// Statistiques de cache
let cacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    byModel: {}
};
// File d'attente pour batching Ollama
let ollamaBatchQueue = [];
let batchTimeout = null;
const BATCH_DELAY_MS = 50;
const BATCH_MAX_SIZE = 10;
// ========== FONCTIONS DE CONFIGURATION ==========
/**
 * Configure le fournisseur d'embeddings avec support multi-modèles
 */
export function setEmbeddingProvider(provider, defaultModel = 'qwen3-embedding:8b', modelConfig) {
    embeddingProvider = provider;
    // Configuration par défaut
    const defaultModels = {
        code: 'nomic-embed-code',
        text: 'nomic-embed-text',
        config: 'bge-small',
        fallback: defaultModel
    };
    // Fusionner avec la configuration fournie
    embeddingModels = { ...defaultModels, ...modelConfig };
    console.error(`Embedding provider configured: ${provider}`);
    console.error(`Models: ${JSON.stringify(embeddingModels)}`);
}
/**
 * Configure uniquement les modèles (sans changer le provider)
 */
export function setEmbeddingModels(models) {
    embeddingModels = { ...embeddingModels, ...models };
    console.error(`Embedding models updated: ${JSON.stringify(embeddingModels)}`);
}
/**
 * Détermine le modèle approprié pour un type de contenu
 */
export function getEmbeddingModelForContentType(contentType, language) {
    // Normaliser le type de contenu
    const normalizedType = contentType.toLowerCase();
    // Routage basé sur le type
    switch (normalizedType) {
        case 'code':
        case 'source':
        case 'program':
            return embeddingModels.code;
        case 'doc':
        case 'text':
        case 'documentation':
        case 'markdown':
        case 'readme':
            return embeddingModels.text;
        case 'config':
        case 'configuration':
        case 'json':
        case 'yaml':
        case 'toml':
        case 'ini':
            return embeddingModels.config;
        default:
            return embeddingModels.fallback;
    }
}
/**
 * Obtient la dimension attendue pour un modèle
 */
export function getEmbeddingDimensionForModel(model) {
    // Chercher dans la configuration
    for (const [type, modelName] of Object.entries(embeddingModels)) {
        if (modelName === model) {
            return embeddingDimensions[type];
        }
    }
    // Fallback
    return embeddingDimensions.fallback;
}
// ========== GESTION DU CACHE ==========
/**
 * Génère une clé de cache unique
 */
function getCacheKey(text, model) {
    // Hash simple du texte
    let hash = 0;
    for (let i = 0; i < Math.min(text.length, 1000); i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return `${model}:${hash}:${text.length}`;
}
/**
 * Récupère un embedding depuis le cache
 */
function getCachedEmbedding(text, model) {
    const key = getCacheKey(text, model);
    const entry = embeddingCache.get(key);
    if (!entry) {
        cacheStats.misses++;
        return null;
    }
    // Vérifier la validité du cache
    if (Date.now() - entry.timestamp > CACHE_TTL) {
        embeddingCache.delete(key);
        cacheStats.misses++;
        return null;
    }
    // Mettre à jour les statistiques
    cacheStats.hits++;
    cacheStats.byModel[model] = (cacheStats.byModel[model] || 0) + 1;
    return entry.vector;
}
/**
 * Met un embedding en cache
 */
function cacheEmbedding(text, vector, model, contentType, language) {
    const key = getCacheKey(text, model);
    embeddingCache.set(key, {
        vector,
        model,
        timestamp: Date.now(),
        contentType,
        language
    });
    // Gérer la taille du cache (LRU simple)
    if (embeddingCache.size > CACHE_MAX_SIZE) {
        const firstKey = embeddingCache.keys().next().value;
        if (firstKey) {
            embeddingCache.delete(firstKey);
            cacheStats.evictions++;
        }
    }
}
/**
 * Vide le cache des embeddings
 */
export function clearEmbeddingCache() {
    embeddingCache.clear();
    cacheStats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        byModel: {}
    };
    console.error("Embedding cache cleared");
}
/**
 * Obtient les statistiques du cache
 */
export function getEmbeddingCacheStats() {
    const totalRequests = cacheStats.hits + cacheStats.misses;
    const hitRate = totalRequests > 0 ? (cacheStats.hits / totalRequests) * 100 : 0;
    return {
        totalEntries: embeddingCache.size,
        byModel: { ...cacheStats.byModel },
        hitRate,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        evictions: cacheStats.evictions
    };
}
// ========== GÉNÉRATION D'EMBEDDINGS AVEC ROUTAGE ==========
/**
 * Normalise un vecteur selon la norme L2
 */
function normalizeL2(vector) {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0)
        return vector;
    return vector.map(val => val / norm);
}
/**
 * Génère un embedding avec routage automatique par type de contenu
 */
export async function generateEmbeddingForContent(text, contentType = 'other', language) {
    // 1. Déterminer le modèle approprié
    const model = getEmbeddingModelForContentType(contentType, language);
    // 2. Vérifier le cache
    const cached = getCachedEmbedding(text, model);
    if (cached) {
        console.error(`Using cached embedding (${model}) for: ${text.substring(0, 50)}...`);
        return cached;
    }
    // 3. Générer l'embedding avec le modèle approprié
    console.error(`Generating embedding with ${model} for ${contentType}: ${text.substring(0, 50)}...`);
    const vector = await generateEmbeddingWithModel(text, model);
    // 4. Normaliser
    const normalizedVector = normalizeL2(vector);
    // 5. Mettre en cache
    cacheEmbedding(text, normalizedVector, model, contentType, language);
    return normalizedVector;
}
/**
 * Génère un embedding avec un modèle spécifique (compatibilité)
 */
async function generateEmbeddingWithModel(text, model) {
    switch (embeddingProvider) {
        case "ollama":
            return await generateOllamaEmbedding(text, model);
        case "sentence-transformers":
            return await generateSentenceTransformerEmbedding(text, model);
        case "fake":
        default:
            return generateFakeEmbedding(text, model);
    }
}
/**
 * Génère des embeddings factices améliorés
 */
function generateFakeEmbedding(text, model) {
    // Déterminer la dimension basée sur le modèle
    const dimension = getEmbeddingDimensionForModel(model);
    // Seed basée sur le texte et le modèle
    const seed = simpleHash(text + model);
    return Array(dimension).fill(0).map((_, i) => {
        const base = Math.sin(seed * 0.01 + i * 0.017) * 0.3;
        const variation = Math.cos(seed * 0.007 + i * 0.023) * 0.2;
        const noise = (Math.random() - 0.5) * 0.1;
        return base + variation + noise;
    });
}
/**
 * Fonction de hachage simple
 */
function simpleHash(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}
// ========== OLLAMA EMBEDDINGS AVEC SUPPORT MULTI-MODÈLES ==========
/**
 * Génère un embedding avec Ollama (version avec cache et batching)
 */
async function generateOllamaEmbedding(text, model) {
    // Si le provider n'est pas Ollama, utiliser les embeddings factices
    if (embeddingProvider !== "ollama") {
        return generateFakeEmbedding(text, model);
    }
    console.error(`Queueing Ollama embedding (${model}): ${text.substring(0, 50)}...`);
    // Retourner une promesse qui sera résolue par le batch
    return new Promise((resolve, reject) => {
        ollamaBatchQueue.push({ text, model, resolve, reject });
        // Démarrer le traitement du batch si nécessaire
        if (!batchTimeout) {
            batchTimeout = setTimeout(processOllamaBatch, BATCH_DELAY_MS);
        }
        // Traiter immédiatement si le batch est plein
        if (ollamaBatchQueue.length >= BATCH_MAX_SIZE) {
            if (batchTimeout) {
                clearTimeout(batchTimeout);
                batchTimeout = null;
            }
            processOllamaBatch();
        }
    });
}
/**
 * Traite un batch de requêtes Ollama
 */
async function processOllamaBatch() {
    if (batchTimeout) {
        clearTimeout(batchTimeout);
        batchTimeout = null;
    }
    if (ollamaBatchQueue.length === 0) {
        return;
    }
    // Grouper par modèle pour des batches optimisés
    const batchesByModel = new Map();
    ollamaBatchQueue.forEach(item => {
        if (!batchesByModel.has(item.model)) {
            batchesByModel.set(item.model, []);
        }
        batchesByModel.get(item.model).push({
            text: item.text,
            resolve: item.resolve,
            reject: item.reject
        });
    });
    // Vider la file d'attente
    ollamaBatchQueue = [];
    // Traiter chaque batch par modèle
    for (const [model, batch] of batchesByModel) {
        await processOllamaBatchForModel(model, batch);
    }
}
/**
 * Traite un batch pour un modèle spécifique
 */
async function processOllamaBatchForModel(model, batch) {
    const texts = batch.map(item => item.text);
    console.error(`Processing Ollama batch for ${model} (${texts.length} texts)`);
    try {
        const response = await fetch('http://localhost:11434/api/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model,
                input: texts,
            }),
        });
        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (!data.embeddings || !Array.isArray(data.embeddings)) {
            // Fallback: traiter chaque texte individuellement
            console.error('Ollama batch API not supported, falling back to individual requests');
            await processIndividualOllamaRequests(model, batch);
            return;
        }
        // Vérifier que nous avons le bon nombre d'embeddings
        if (data.embeddings.length !== texts.length) {
            throw new Error(`Ollama batch API returned ${data.embeddings.length} embeddings, expected ${texts.length}`);
        }
        // Distribuer les résultats
        for (let i = 0; i < batch.length; i++) {
            const embedding = data.embeddings[i];
            const { text, resolve } = batch[i];
            if (!embedding || !Array.isArray(embedding)) {
                resolve(generateFakeEmbedding(text, model));
            }
            else {
                resolve(embedding);
            }
        }
    }
    catch (error) {
        console.error(`Failed to process Ollama batch for ${model}: ${error}. Falling back to individual requests.`);
        await processIndividualOllamaRequests(model, batch);
    }
}
/**
 * Traite les requêtes Ollama individuellement (fallback)
 */
async function processIndividualOllamaRequests(model, batch) {
    for (const item of batch) {
        try {
            const response = await fetch('http://localhost:11434/api/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: model,
                    prompt: item.text,
                }),
            });
            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            if (!data.embedding || !Array.isArray(data.embedding)) {
                throw new Error('Invalid response from Ollama API: missing embedding array');
            }
            item.resolve(data.embedding);
        }
        catch (error) {
            console.error(`Failed to get embedding from Ollama for individual request: ${error}. Falling back to fake embeddings.`);
            // Fallback sur les embeddings factices
            item.resolve(generateFakeEmbedding(item.text, model));
        }
    }
}
// ========== SENTENCE TRANSFORMERS (À IMPLÉMENTER) ==========
async function generateSentenceTransformerEmbedding(text, model) {
    console.error(`Generating embedding with Sentence Transformers (${model}): ${text.substring(0, 50)}...`);
    // TODO: Implémenter avec @xenova/transformers
    return generateFakeEmbedding(text, model);
}
/**
 * Fonction pour nettoyer le filePath
 */
function cleanFilePath(filePath) {
    return filePath.replace(/#chunk\d+$/, '');
}
/**
 * Stocke un document avec son embedding (version mise à jour avec routage)
 */
export async function embedAndStore(projectPath, filePath, content, options = {}) {
    const { chunkIndex = 0, totalChunks = 1, contentType = 'other', role = null, fileExtension = null, language = null, linesCount = null, isCompressed = false } = options;
    // Nettoyer le filePath pour éviter les duplications de #chunk
    const cleanedFilePath = cleanFilePath(filePath);
    // Générer l'ID unique avec chunk index si nécessaire
    const id = totalChunks > 1
        ? `${projectPath}:${cleanedFilePath}#chunk${chunkIndex}`
        : `${projectPath}:${cleanedFilePath}`;
    // Générer l'embedding avec routage automatique par type de contenu
    const vector = await generateEmbeddingForContent(content, contentType, language || undefined);
    try {
        // Convertir le tableau en chaîne de tableau PostgreSQL
        const vectorStr = `[${vector.join(',')}]`;
        // Calculer les métadonnées automatiquement si non fournies
        const finalFileExtension = fileExtension || filePath.split('.').pop() || null;
        const finalLinesCount = linesCount || content.split('\n').length;
        // Gestion de la compression automatique
        let finalContent = content;
        let finalIsCompressed = isCompressed;
        let finalFileSizeBytes = content.length;
        let finalOriginalSizeBytes = content.length;
        // Compresser automatiquement si le contenu dépasse le seuil
        if (shouldCompress(content) && !isCompressed) {
            try {
                const { compressed, compressionRatio } = await compressContent(content);
                finalContent = compressed.toString('base64'); // Stocker en base64
                finalIsCompressed = true;
                finalFileSizeBytes = compressed.length;
                finalOriginalSizeBytes = content.length;
                console.error(`Compressed content for ${filePath}: ${finalOriginalSizeBytes} -> ${finalFileSizeBytes} bytes (${compressionRatio.toFixed(1)}% compression)`);
            }
            catch (compressionError) {
                console.error(`Failed to compress content for ${filePath}:`, compressionError);
                // Continuer sans compression
            }
        }
        else {
            finalFileSizeBytes = content.length;
            finalOriginalSizeBytes = isCompressed ? Buffer.from(content).length : content.length;
        }
        // Utiliser la table rag_store_v2 si elle existe, sinon rag_store (compatibilité)
        const tableName = await checkV2TableExists() ? 'rag_store_v2' : 'rag_store';
        if (tableName === 'rag_store_v2') {
            await pool.query(`INSERT INTO rag_store_v2 (
          id, project_path, file_path, chunk_index, total_chunks,
          content, content_type, role, file_extension, file_size_bytes,
          lines_count, language, vector, is_compressed, original_size_bytes,
          version, created_at, updated_at, indexed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::vector, $14, $15, 1, NOW(), NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          content = EXCLUDED.content,
          content_type = EXCLUDED.content_type,
          role = EXCLUDED.role,
          file_extension = EXCLUDED.file_extension,
          file_size_bytes = EXCLUDED.file_size_bytes,
          lines_count = EXCLUDED.lines_count,
          language = EXCLUDED.language,
          vector = EXCLUDED.vector,
          is_compressed = EXCLUDED.is_compressed,
          original_size_bytes = EXCLUDED.original_size_bytes,
          updated_at = NOW()`, [
                id, projectPath, filePath, chunkIndex, totalChunks,
                finalContent, contentType, role, finalFileExtension, finalFileSizeBytes,
                finalLinesCount, language, vectorStr, finalIsCompressed, finalOriginalSizeBytes
            ]);
        }
        else {
            // Fallback à l'ancienne table
            await pool.query(`INSERT INTO rag_store (id, project_path, file_path, content, vector, updated_at)
         VALUES ($1, $2, $3, $4, $5::vector, NOW())
         ON CONFLICT (id) DO UPDATE SET
           content = EXCLUDED.content,
           vector = EXCLUDED.vector,
           updated_at = NOW()`, [id, projectPath, filePath, content, vectorStr]);
        }
    }
    catch (error) {
        console.error(`Error storing document ${id}:`, error);
        throw error;
    }
}
// ========== FONCTIONS UTILITAIRES POUR LA COMPRESSION ==========
const COMPRESSION_THRESHOLD = 10 * 1024; // 10KB
/**
 * Détermine si le contenu doit être compressé
 */
function shouldCompress(content) {
    return Buffer.byteLength(content, 'utf8') > COMPRESSION_THRESHOLD;
}
/**
 * Compresse le contenu avec gzip
 */
async function compressContent(content) {
    const originalSize = Buffer.byteLength(content, 'utf8');
    const compressed = await gzipAsync(content);
    const compressionRatio = (compressed.length / originalSize) * 100;
    return { compressed, compressionRatio };
}
/**
 * Décompresse le contenu avec gzip
 */
async function decompressContent(compressed) {
    const decompressed = await gunzipAsync(compressed);
    return decompressed.toString('utf8');
}
/**
 * Vérifie si la table rag_store_v2 existe
 */
async function checkV2TableExists() {
    try {
        const result = await pool.query(`SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'rag_store_v2'
            )`);
        return result.rows[0].exists;
    }
    catch (error) {
        console.error('Error checking for rag_store_v2 table:', error);
        return false;
    }
}
/**
 * Décompresse le contenu si nécessaire
 */
async function decompressIfNeeded(content, isCompressed) {
    if (!isCompressed) {
        return content;
    }
    try {
        // Le contenu compressé est stocké en base64
        const compressedBuffer = Buffer.from(content, 'base64');
        return await decompressContent(compressedBuffer);
    }
    catch (error) {
        console.error('Failed to decompress content:', error);
        return content; // Retourner le contenu tel quel en cas d'erreur
    }
}
/**
 * Poids par défaut pour le re-ranking
 */
const DEFAULT_RERANKING_WEIGHTS = {
    semanticWeight: 0.7,
    freshnessWeight: 0.15,
    fileSizeWeight: 0.05,
    contentTypeWeight: 0.05,
    roleWeight: 0.03,
    languageWeight: 0.02,
    preferRecent: true,
    preferSmallerFiles: true,
    priorityContentTypes: ['code', 'doc'],
    priorityRoles: ['core', 'main'],
    priorityLanguages: ['typescript', 'javascript', 'python']
};
// ========== FONCTIONS DE RECHERCHE (MISES À JOUR POUR MULTI-MODÈLES) ==========
/**
 * Re-classe les résultats de recherche basé sur les métadonnées
 */
function rerankResults(results, weights = {}) {
    if (results.length === 0)
        return results;
    // Fusionner avec les poids par défaut
    const finalWeights = { ...DEFAULT_RERANKING_WEIGHTS, ...weights };
    // Normaliser les poids pour qu'ils somment à 1
    const totalWeight = finalWeights.semanticWeight +
        finalWeights.freshnessWeight +
        finalWeights.fileSizeWeight +
        finalWeights.contentTypeWeight +
        finalWeights.roleWeight +
        finalWeights.languageWeight;
    const normalizedWeights = {
        semanticWeight: finalWeights.semanticWeight / totalWeight,
        freshnessWeight: finalWeights.freshnessWeight / totalWeight,
        fileSizeWeight: finalWeights.fileSizeWeight / totalWeight,
        contentTypeWeight: finalWeights.contentTypeWeight / totalWeight,
        roleWeight: finalWeights.roleWeight / totalWeight,
        languageWeight: finalWeights.languageWeight / totalWeight,
        preferRecent: finalWeights.preferRecent,
        preferSmallerFiles: finalWeights.preferSmallerFiles,
        priorityContentTypes: finalWeights.priorityContentTypes,
        priorityRoles: finalWeights.priorityRoles,
        priorityLanguages: finalWeights.priorityLanguages
    };
    // Calculer les scores de re-ranking pour chaque résultat
    const reranked = results.map(result => {
        const metadata = result.metadata;
        let rerankScore = 0;
        // 1. Score sémantique (pondéré)
        rerankScore += result.score * normalizedWeights.semanticWeight;
        // 2. Score de fraîcheur (basé sur updatedAt)
        if (metadata.updatedAt) {
            const freshnessDays = (Date.now() - metadata.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
            const maxFreshnessDays = 365; // 1 an
            const freshnessScore = Math.max(0, 1 - (freshnessDays / maxFreshnessDays));
            if (normalizedWeights.preferRecent) {
                rerankScore += freshnessScore * normalizedWeights.freshnessWeight;
            }
            else {
                // Préférer les anciens fichiers
                rerankScore += (1 - freshnessScore) * normalizedWeights.freshnessWeight;
            }
        }
        // 3. Score de taille de fichier
        if (metadata.fileSize) {
            const maxFileSize = 1024 * 1024; // 1MB
            const sizeScore = Math.min(1, metadata.fileSize / maxFileSize);
            if (normalizedWeights.preferSmallerFiles) {
                rerankScore += (1 - sizeScore) * normalizedWeights.fileSizeWeight;
            }
            else {
                // Préférer les fichiers plus grands
                rerankScore += sizeScore * normalizedWeights.fileSizeWeight;
            }
        }
        // 4. Score de type de contenu
        if (metadata.contentType) {
            let contentTypeScore = 0.5; // Valeur par défaut
            if (normalizedWeights.priorityContentTypes.includes(metadata.contentType.toLowerCase())) {
                contentTypeScore = 1.0; // Bonus pour les types prioritaires
            }
            rerankScore += contentTypeScore * normalizedWeights.contentTypeWeight;
        }
        // 5. Score de rôle
        if (metadata.role) {
            let roleScore = 0.5; // Valeur par défaut
            if (normalizedWeights.priorityRoles.includes(metadata.role.toLowerCase())) {
                roleScore = 1.0; // Bonus pour les rôles prioritaires
            }
            rerankScore += roleScore * normalizedWeights.roleWeight;
        }
        // 6. Score de langage
        if (metadata.language) {
            let languageScore = 0.5; // Valeur par défaut
            if (normalizedWeights.priorityLanguages.includes(metadata.language.toLowerCase())) {
                languageScore = 1.0; // Bonus pour les langages prioritaires
            }
            rerankScore += languageScore * normalizedWeights.languageWeight;
        }
        return {
            ...result,
            rerankScore,
            originalScore: result.score
        };
    });
    // Trier par score de re-ranking (décroissant)
    return reranked
        .sort((a, b) => b.rerankScore - a.rerankScore)
        .map(({ rerankScore, originalScore, ...rest }) => ({
        ...rest,
        score: rerankScore, // Remplacer le score original par le score de re-ranking
        metadata: {
            ...rest.metadata,
            originalScore, // Conserver le score original dans les métadonnées
            rerankScore
        }
    }));
}
/**
 * Recherche sémantique avec support multi-modèles
 */
export async function semanticSearch(query, options = {}) {
    const { projectFilter, limit = 10, threshold = 0.3, dynamicThreshold = false, contentTypeFilter, roleFilter, fileExtensionFilter, languageFilter, minFileSizeBytes, maxFileSizeBytes, minLinesCount, maxLinesCount, dateFrom, dateTo, includeCompressed, excludeCompressed, enableReranking = false, rerankingWeights = {} } = options;
    // Générer l'embedding pour la requête (utilise generateEmbeddingForContent avec type 'other')
    const queryVector = await generateEmbeddingForContent(query, 'other');
    const queryVectorStr = `[${queryVector.join(',')}]`;
    // Vérifier quelle table utiliser
    const useV2 = await checkV2TableExists();
    const tableName = useV2 ? 'rag_store_v2' : 'rag_store';
    // Construire la requête SQL
    let sql = '';
    const params = [queryVectorStr, threshold];
    let paramIndex = 3;
    if (useV2) {
        sql = `
            SELECT id, project_path, file_path, content, content_type, role,
                   file_extension, lines_count, language, is_compressed, original_size_bytes,
                   created_at, updated_at,
                   (1 - (vector <=> $1::vector)) as similarity
            FROM rag_store_v2
            WHERE (1 - (vector <=> $1::vector)) >= $2::float
        `;
    }
    else {
        sql = `
            SELECT id, project_path, file_path, content,
                   (1 - (vector <=> $1::vector)) as similarity
            FROM rag_store
            WHERE (1 - (vector <=> $1::vector)) >= $2::float
        `;
    }
    // Appliquer tous les filtres
    paramIndex = applyFiltersToQuery(sql, params, paramIndex, {
        projectFilter,
        contentTypeFilter,
        roleFilter,
        fileExtensionFilter,
        languageFilter,
        minFileSizeBytes,
        maxFileSizeBytes,
        minLinesCount,
        maxLinesCount,
        dateFrom,
        dateTo,
        includeCompressed,
        excludeCompressed
    }, useV2);
    sql += ` ORDER BY similarity DESC LIMIT $${paramIndex}::int`;
    params.push(limit);
    try {
        const result = await pool.query(sql, params);
        // Traiter chaque ligne pour décompresser si nécessaire
        const processedRows = await Promise.all(result.rows.map(async (row) => {
            let content = row.content;
            let fileSize = row.content.length;
            let originalSize = row.content.length;
            // Décompresser si nécessaire (seulement pour rag_store_v2)
            if (useV2 && row.is_compressed) {
                try {
                    content = await decompressIfNeeded(row.content, true);
                    fileSize = row.original_size_bytes || row.content.length;
                    originalSize = row.original_size_bytes || row.content.length;
                }
                catch (error) {
                    console.error(`Failed to decompress content for ${row.id}:`, error);
                    // Garder le contenu compressé en cas d'erreur
                }
            }
            return {
                id: row.id,
                filePath: row.file_path,
                content,
                score: row.similarity,
                metadata: {
                    projectPath: row.project_path,
                    fileSize,
                    originalSize: useV2 ? (row.original_size_bytes || fileSize) : fileSize,
                    lines: content.split('\n').length,
                    contentType: row.content_type || null,
                    role: row.role || null,
                    fileExtension: row.file_extension || null,
                    language: row.language || null,
                    linesCount: row.lines_count || null,
                    isCompressed: useV2 ? row.is_compressed : false,
                    compressionRatio: useV2 && row.is_compressed && row.original_size_bytes
                        ? ((row.content.length / row.original_size_bytes) * 100).toFixed(1) + '%'
                        : null,
                    createdAt: row.created_at ? new Date(row.created_at) : null,
                    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
                },
            };
        }));
        // Appliquer le re-ranking si activé
        if (enableReranking && processedRows.length > 0) {
            console.error(`Applying re-ranking to ${processedRows.length} results`);
            const rerankedResults = rerankResults(processedRows, rerankingWeights);
            // Log des scores avant/après pour débogage
            if (rerankedResults.length > 0) {
                const firstResult = rerankedResults[0];
                const lastResult = rerankedResults[rerankedResults.length - 1];
                console.error(`Re-ranking complete: ${rerankedResults.length} results, top score: ${firstResult.score.toFixed(3)}, bottom score: ${lastResult.score.toFixed(3)}`);
            }
            return rerankedResults;
        }
        return processedRows;
    }
    catch (error) {
        console.error("Error in semantic search:", error);
        throw error;
    }
}
/**
 * Applique les filtres à une requête SQL en construction
 */
function applyFiltersToQuery(sql, params, paramIndex, filters, useV2) {
    let currentParamIndex = paramIndex;
    // Filtre par projet
    if (filters.projectFilter) {
        sql += ` AND project_path = $${currentParamIndex}::text`;
        params.push(filters.projectFilter);
        currentParamIndex++;
    }
    // Filtres spécifiques à rag_store_v2
    if (useV2) {
        // Filtre par type de contenu (simple ou multiple)
        if (filters.contentTypeFilter) {
            if (Array.isArray(filters.contentTypeFilter)) {
                if (filters.contentTypeFilter.length > 0) {
                    const placeholders = filters.contentTypeFilter.map((_, i) => `$${currentParamIndex + i}::text`).join(', ');
                    sql += ` AND content_type IN (${placeholders})`;
                    params.push(...filters.contentTypeFilter);
                    currentParamIndex += filters.contentTypeFilter.length;
                }
            }
            else {
                sql += ` AND content_type = $${currentParamIndex}::text`;
                params.push(filters.contentTypeFilter);
                currentParamIndex++;
            }
        }
        // Filtre par rôle (simple ou multiple)
        if (filters.roleFilter) {
            if (Array.isArray(filters.roleFilter)) {
                if (filters.roleFilter.length > 0) {
                    const placeholders = filters.roleFilter.map((_, i) => `$${currentParamIndex + i}::text`).join(', ');
                    sql += ` AND role IN (${placeholders})`;
                    params.push(...filters.roleFilter);
                    currentParamIndex += filters.roleFilter.length;
                }
            }
            else {
                sql += ` AND role = $${currentParamIndex}::text`;
                params.push(filters.roleFilter);
                currentParamIndex++;
            }
        }
        // Filtre par extension de fichier (simple ou multiple)
        if (filters.fileExtensionFilter) {
            if (Array.isArray(filters.fileExtensionFilter)) {
                if (filters.fileExtensionFilter.length > 0) {
                    const placeholders = filters.fileExtensionFilter.map((_, i) => `$${currentParamIndex + i}::text`).join(', ');
                    sql += ` AND file_extension IN (${placeholders})`;
                    params.push(...filters.fileExtensionFilter);
                    currentParamIndex += filters.fileExtensionFilter.length;
                }
            }
            else {
                sql += ` AND file_extension = $${currentParamIndex}::text`;
                params.push(filters.fileExtensionFilter);
                currentParamIndex++;
            }
        }
        // Filtre par langage (simple ou multiple)
        if (filters.languageFilter) {
            if (Array.isArray(filters.languageFilter)) {
                if (filters.languageFilter.length > 0) {
                    const placeholders = filters.languageFilter.map((_, i) => `$${currentParamIndex + i}::text`).join(', ');
                    sql += ` AND language IN (${placeholders})`;
                    params.push(...filters.languageFilter);
                    currentParamIndex += filters.languageFilter.length;
                }
            }
            else {
                sql += ` AND language = $${currentParamIndex}::text`;
                params.push(filters.languageFilter);
                currentParamIndex++;
            }
        }
        // Filtres par taille de fichier
        if (filters.minFileSizeBytes !== undefined) {
            sql += ` AND file_size_bytes >= $${currentParamIndex}::int`;
            params.push(filters.minFileSizeBytes);
            currentParamIndex++;
        }
        if (filters.maxFileSizeBytes !== undefined) {
            sql += ` AND file_size_bytes <= $${currentParamIndex}::int`;
            params.push(filters.maxFileSizeBytes);
            currentParamIndex++;
        }
        // Filtres par nombre de lignes
        if (filters.minLinesCount !== undefined) {
            sql += ` AND lines_count >= $${currentParamIndex}::int`;
            params.push(filters.minLinesCount);
            currentParamIndex++;
        }
        if (filters.maxLinesCount !== undefined) {
            sql += ` AND lines_count <= $${currentParamIndex}::int`;
            params.push(filters.maxLinesCount);
            currentParamIndex++;
        }
        // Filtres par date
        if (filters.dateFrom) {
            sql += ` AND created_at >= $${currentParamIndex}::timestamp`;
            params.push(filters.dateFrom);
            currentParamIndex++;
        }
        if (filters.dateTo) {
            sql += ` AND created_at <= $${currentParamIndex}::timestamp`;
            params.push(filters.dateTo);
            currentParamIndex++;
        }
        // Filtres par compression
        if (filters.includeCompressed !== undefined) {
            sql += ` AND is_compressed = $${currentParamIndex}::boolean`;
            params.push(filters.includeCompressed);
            currentParamIndex++;
        }
        if (filters.excludeCompressed !== undefined && filters.excludeCompressed) {
            sql += ` AND is_compressed = false`;
        }
    }
    return currentParamIndex;
}
// ========== FONCTIONS DE GESTION DE PROJET ==========
/**
 * Obtient les statistiques d'un projet
 */
export async function getProjectStats(projectPath) {
    try {
        const useV2 = await checkV2TableExists();
        const tableName = useV2 ? 'rag_store_v2' : 'rag_store';
        // Statistiques de base
        const statsResult = await pool.query(`SELECT
                COUNT(*) as total_chunks,
                MIN(created_at) as indexed_at,
                MAX(updated_at) as last_updated
            FROM ${tableName}
            WHERE project_path = $1::text`, [projectPath]);
        const row = statsResult.rows[0];
        const totalChunks = parseInt(row.total_chunks) || 0;
        // Compter les fichiers uniques (approximation basée sur file_path sans chunk index)
        let totalFiles = 0;
        if (useV2) {
            const filesResult = await pool.query(`SELECT COUNT(DISTINCT 
                    CASE 
                        WHEN POSITION('#chunk' IN file_path) > 0 
                        THEN SUBSTRING(file_path FROM 1 FOR POSITION('#chunk' IN file_path) - 1)
                        ELSE file_path 
                    END
                ) as total_files
                FROM rag_store_v2
                WHERE project_path = $1`, [projectPath]);
            totalFiles = parseInt(filesResult.rows[0].total_files) || 0;
        }
        else {
            totalFiles = totalChunks; // Approximation pour l'ancienne table
        }
        // Distribution par type de contenu (si v2)
        let contentTypes = {};
        if (useV2) {
            const typesResult = await pool.query(`SELECT content_type, COUNT(*) as count
                FROM rag_store_v2
                WHERE project_path = $1
                GROUP BY content_type`, [projectPath]);
            typesResult.rows.forEach(typeRow => {
                contentTypes[typeRow.content_type] = parseInt(typeRow.count);
            });
        }
        return {
            totalFiles,
            totalChunks,
            indexedAt: row.indexed_at ? new Date(row.indexed_at) : null,
            lastUpdated: row.last_updated ? new Date(row.last_updated) : null,
            contentTypes,
        };
    }
    catch (error) {
        console.error(`Error getting stats for project ${projectPath}: `, error);
        throw error;
    }
}
/**
 * Liste tous les projets indexés
 */
export async function listProjects() {
    try {
        const useV2 = await checkV2TableExists();
        const tableName = useV2 ? 'rag_store_v2' : 'rag_store';
        const result = await pool.query(`SELECT DISTINCT project_path FROM ${tableName} ORDER BY project_path`);
        return result.rows.map(row => row.project_path);
    }
    catch (error) {
        console.error("Error listing projects:", error);
        throw error;
    }
}
/**
 * Obtient l'historique d'un chunk
 */
export async function getChunkHistory(chunkId, limit = 10) {
    try {
        const useV2 = await checkV2TableExists();
        if (!useV2) {
            throw new Error('Version history requires rag_store_v2 table');
        }
        const result = await pool.query(`SELECT * FROM get_chunk_history($1, $2)`, [chunkId, limit]);
        return result.rows.map(row => ({
            historyId: row.history_id,
            version: row.version,
            content: row.content,
            changedAt: new Date(row.changed_at),
            changeType: row.change_type,
            changeReason: row.change_reason,
            metadata: row.metadata || {}
        }));
    }
    catch (error) {
        console.error(`Error getting history for chunk ${chunkId}: `, error);
        throw error;
    }
}
/**
 * Compare deux versions d'un chunk
 */
export async function compareChunkVersions(chunkId, version1, version2) {
    try {
        const useV2 = await checkV2TableExists();
        if (!useV2) {
            throw new Error('Version comparison requires rag_store_v2 table');
        }
        const result = await pool.query(`SELECT * FROM compare_chunk_versions($1, $2, $3)`, [chunkId, version1, version2]);
        return result.rows.map(row => ({
            fieldName: row.field_name,
            version1Value: row.version1_value,
            version2Value: row.version2_value,
            hasChanged: row.has_changed
        }));
    }
    catch (error) {
        console.error(`Error comparing versions ${version1} and ${version2} for chunk ${chunkId}: `, error);
        throw error;
    }
}
/**
 * Obtient les statistiques de versionnement
 */
export async function getVersionStats(chunkId) {
    try {
        const useV2 = await checkV2TableExists();
        if (!useV2) {
            throw new Error('Version stats require rag_store_v2 table');
        }
        let sql = 'SELECT * FROM rag_store_v2_version_stats';
        const params = [];
        if (chunkId) {
            sql += ' WHERE chunk_id = $1::text';
            params.push(chunkId);
        }
        sql += ' ORDER BY total_versions DESC';
        const result = await pool.query(sql, params);
        return result.rows.map(row => ({
            chunkId: row.chunk_id,
            totalVersions: parseInt(row.total_versions),
            firstVersion: new Date(row.first_version),
            lastVersion: new Date(row.last_version),
            createdCount: parseInt(row.created_count),
            updatedCount: parseInt(row.updated_count),
            deletedCount: parseInt(row.deleted_count),
            avgChangePercentage: parseFloat(row.avg_change_percentage) || 0
        }));
    }
    catch (error) {
        console.error('Error getting version stats:', error);
        throw error;
    }
}
/**
 * Détecte les changements significatifs entre deux versions
 */
export function detectSignificantChange(oldContent, newContent, thresholdPercentage = 10) {
    const oldLength = oldContent.length;
    const newLength = newContent.length;
    const lengthChange = Math.abs(newLength - oldLength);
    const changePercentage = oldLength > 0 ? (lengthChange / oldLength) * 100 : 100;
    const hasSignificantChange = changePercentage >= thresholdPercentage;
    const details = {
        oldLength,
        newLength,
        lengthChange,
        changePercentage,
        oldLines: oldContent.split('\n').length,
        newLines: newContent.split('\n').length,
        linesChange: Math.abs(newContent.split('\n').length - oldContent.split('\n').length)
    };
    return { hasSignificantChange, changePercentage, details };
}
// ========== FERMETURE DU POOL ==========
/**
 * Ferme le pool de connexions PostgreSQL
 */
export async function closePool() {
    await pool.end();
}
// Fermer le pool à la fin
process.on('SIGINT', async () => {
    await closePool();
    process.exit(0);
});
