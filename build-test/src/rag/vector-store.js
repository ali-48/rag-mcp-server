import { Pool } from "pg";
import { promisify } from "util";
import { gunzip, gzip } from "zlib";
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
// Configuration de la connexion PostgreSQL
const pool = new Pool({
    host: "localhost",
    port: 16432,
    database: "rag_mcp_memory",
    user: "rag_user",
    password: "secure_rag_password",
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
// Configuration des embeddings
let embeddingProvider = "fake";
let embeddingModel = "nomic-embed-text";
// Cache pour embeddings (évite de regénérer les mêmes embeddings)
const embeddingCache = new Map();
const CACHE_MAX_SIZE = 1000;
// File d'attente pour batching Ollama
let ollamaBatchQueue = [];
let batchTimeout = null;
const BATCH_DELAY_MS = 50; // Délai avant traitement du batch
const BATCH_MAX_SIZE = 10; // Taille maximale du batch
// Fonction pour configurer le fournisseur d'embeddings
export function setEmbeddingProvider(provider, model = "nomic-embed-text") {
    embeddingProvider = provider;
    embeddingModel = model;
    console.error(`Embedding provider configured: ${provider}, model: ${model}`);
}
/**
 * Normalise un vecteur selon la norme L2 (norme unitaire).
 * Cette normalisation est essentielle pour la similarité cosinus car elle garantit
 * que les vecteurs ont une norme de 1, ce qui rend la similarité cosinus égale au produit scalaire.
 *
 * @param vector - Vecteur à normaliser
 * @returns Vecteur normalisé (norme = 1.0)
 */
function normalizeL2(vector) {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0)
        return vector;
    return vector.map(val => val / norm);
}
// Fonction pour générer des embeddings selon le fournisseur configuré
async function generateEmbedding(text) {
    let embedding;
    switch (embeddingProvider) {
        case "ollama":
            embedding = await generateOllamaEmbedding(text);
            break;
        case "sentence-transformers":
            embedding = await generateSentenceTransformerEmbedding(text);
            break;
        case "fake":
        default:
            embedding = generateFakeEmbedding(text);
            break;
    }
    // Normaliser l'embedding pour une meilleure similarité cosinus
    return normalizeL2(embedding);
}
/**
 * Génère des embeddings factices améliorés pour les tests.
 * Cette version améliorée résout le problème des "scores uniformément élevés" en:
 * 1. Utilisant une combinaison de fonctions sin/cos pour réduire la corrélation linéaire
 * 2. Ajoutant une variation basée sur un hash du texte pour plus d'unicité
 * 3. Incluant un bruit aléatoire contrôlé pour éviter les patterns trop réguliers
 *
 * Résultat: Distribution plus réaliste avec écart-type > 0.1 et plage étendue.
 *
 * @param text - Texte à encoder
 * @returns Vecteur d'embedding de dimension 768
 */
function generateFakeEmbedding(text) {
    // Embedding factice de dimension 768 avec meilleure distribution
    const seed = text.length;
    const hash = simpleHash(text);
    return Array(768).fill(0).map((_, i) => {
        // Utiliser une combinaison de fonctions pour réduire la corrélation
        const base = Math.sin(hash * 0.01 + i * 0.017) * 0.3;
        const variation = Math.cos(hash * 0.007 + i * 0.023) * 0.2;
        const noise = (Math.random() - 0.5) * 0.1;
        // Combinaison non-linéaire pour réduire la corrélation linéaire
        return base + variation + noise;
    });
}
// Fonction de hachage simple pour générer une seed unique à partir du texte
function simpleHash(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convertir en entier 32-bit
    }
    return Math.abs(hash);
}
// Fonction de hachage simple pour le cache
function hashText(text) {
    // Hash simple mais efficace pour le cache
    let hash = 0;
    for (let i = 0; i < Math.min(text.length, 1000); i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return `${embeddingModel}:${hash}:${text.length}`;
}
// Vérifier le cache
function getCachedEmbedding(text) {
    const key = hashText(text);
    return embeddingCache.get(key) || null;
}
// Mettre en cache un embedding
function cacheEmbedding(text, embedding) {
    const key = hashText(text);
    embeddingCache.set(key, embedding);
    // Gérer la taille du cache (LRU simple)
    if (embeddingCache.size > CACHE_MAX_SIZE) {
        const firstKey = embeddingCache.keys().next().value;
        if (firstKey) {
            embeddingCache.delete(firstKey);
        }
    }
}
// Embeddings avec Ollama (version avec cache et batching)
async function generateOllamaEmbedding(text) {
    // Vérifier le cache d'abord
    const cached = getCachedEmbedding(text);
    if (cached) {
        console.error(`Using cached embedding for: ${text.substring(0, 50)}...`);
        return cached;
    }
    // Si le provider n'est pas Ollama, utiliser les embeddings factices
    if (embeddingProvider !== "ollama") {
        return generateFakeEmbedding(text);
    }
    console.error(`Queueing embedding for Ollama (${embeddingModel}): ${text.substring(0, 50)}...`);
    // Retourner une promesse qui sera résolue par le batch
    return new Promise((resolve, reject) => {
        ollamaBatchQueue.push({ text, resolve, reject });
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
// Traiter un batch de requêtes Ollama
async function processOllamaBatch() {
    if (batchTimeout) {
        clearTimeout(batchTimeout);
        batchTimeout = null;
    }
    if (ollamaBatchQueue.length === 0) {
        return;
    }
    const batch = ollamaBatchQueue.splice(0, BATCH_MAX_SIZE);
    const texts = batch.map(item => item.text);
    console.error(`Processing Ollama batch of ${texts.length} texts`);
    try {
        const response = await fetch('http://localhost:11434/api/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: embeddingModel,
                input: texts, // Ollama supporte le batching avec le champ 'input'
            }),
        });
        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (!data.embeddings || !Array.isArray(data.embeddings)) {
            // Fallback: traiter chaque texte individuellement
            console.error('Ollama batch API not supported, falling back to individual requests');
            await processIndividualOllamaRequests(batch);
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
                resolve(generateFakeEmbedding(text));
            }
            else {
                // Mettre en cache et retourner
                cacheEmbedding(text, embedding);
                resolve(embedding);
            }
        }
    }
    catch (error) {
        console.error(`Failed to process Ollama batch: ${error}. Falling back to individual requests.`);
        // Fallback: traiter chaque texte individuellement
        await processIndividualOllamaRequests(batch);
    }
}
// Traiter les requêtes Ollama individuellement (fallback)
async function processIndividualOllamaRequests(batch) {
    for (const item of batch) {
        try {
            const response = await fetch('http://localhost:11434/api/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: embeddingModel,
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
            // Mettre en cache et résoudre
            cacheEmbedding(item.text, data.embedding);
            item.resolve(data.embedding);
        }
        catch (error) {
            console.error(`Failed to get embedding from Ollama for individual request: ${error}. Falling back to fake embeddings.`);
            // Fallback sur les embeddings factices
            const fakeEmbedding = generateFakeEmbedding(item.text);
            cacheEmbedding(item.text, fakeEmbedding);
            item.resolve(fakeEmbedding);
        }
    }
}
// Embeddings avec Sentence Transformers (à implémenter)
async function generateSentenceTransformerEmbedding(text) {
    console.error(`Generating embedding with Sentence Transformers: ${text.substring(0, 50)}...`);
    // TODO: Implémenter avec @xenova/transformers
    // Pour l'instant, retourner des embeddings factices
    return generateFakeEmbedding(text);
}
// Fonction pour nettoyer le filePath en enlevant les suffixes #chunk existants
function cleanFilePath(filePath) {
    // Supprimer les suffixes #chunk\d+ à la fin du chemin
    return filePath.replace(/#chunk\d+$/, '');
}
export async function embedAndStore(projectPath, filePath, content, options = {}) {
    const { chunkIndex = 0, totalChunks = 1, contentType = 'other', role = null, fileExtension = null, language = null, linesCount = null, isCompressed = false } = options;
    // Nettoyer le filePath pour éviter les duplications de #chunk
    const cleanedFilePath = cleanFilePath(filePath);
    // Générer l'ID unique avec chunk index si nécessaire
    const id = totalChunks > 1
        ? `${projectPath}:${cleanedFilePath}#chunk${chunkIndex}`
        : `${projectPath}:${cleanedFilePath}`;
    const vector = await generateEmbedding(content);
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
// Vérifier si la table rag_store_v2 existe
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
 * Paramètres par défaut pour chaque type de contenu
 */
const DEFAULT_THRESHOLD_PARAMS = {
    // Code: distributions plus serrées, besoin de seuils plus stricts
    'code': {
        stdMultiplier: 0.7, // Plus strict pour le code
        minThreshold: 0.2, // Seuil minimum plus élevé
        maxThreshold: 0.85, // Seuil maximum plus élevé
        defaultThreshold: 0.4, // Valeur par défaut plus élevée
        minSamples: 3, // Moins de samples nécessaires (code plus homogène)
        learningRate: 0.15 // Apprentissage plus rapide
    },
    // Documentation: distributions plus larges
    'doc': {
        stdMultiplier: 0.4, // Plus permissif pour la documentation
        minThreshold: 0.15, // Seuil minimum plus bas
        maxThreshold: 0.75, // Seuil maximum plus bas
        defaultThreshold: 0.35, // Valeur par défaut moyenne
        minSamples: 5,
        learningRate: 0.1
    },
    // Configuration: distributions variables
    'config': {
        stdMultiplier: 0.6,
        minThreshold: 0.18,
        maxThreshold: 0.8,
        defaultThreshold: 0.38,
        minSamples: 4,
        learningRate: 0.12
    },
    // Autres types: paramètres génériques
    'other': {
        stdMultiplier: 0.5,
        minThreshold: 0.1,
        maxThreshold: 0.8,
        defaultThreshold: 0.3,
        minSamples: 5,
        learningRate: 0.1
    }
};
/**
 * Cache pour les statistiques d'apprentissage
 */
const thresholdStatsCache = new Map();
/**
 * Calcule un seuil de similarité dynamique basé sur la distribution des scores,
 * avec des paramètres adaptés au type de contenu.
 *
 * Principe amélioré: seuil = moyenne + (multiplier * écart-type)
 * - Paramètres différents selon le type de contenu (code, doc, config, etc.)
 * - Apprentissage adaptatif basé sur l'historique
 * - Limites configurables par type
 *
 * @param scores - Tableau de scores de similarité (cosinus)
 * @param contentType - Type de contenu (code, doc, config, other)
 * @returns Seuil adaptatif adapté au type de contenu
 */
function calculateDynamicThreshold(scores, contentType = 'other') {
    if (scores.length === 0) {
        return getDefaultThreshold(contentType);
    }
    // Récupérer les paramètres pour ce type de contenu
    const params = getThresholdParameters(contentType);
    // Si pas assez d'échantillons, retourner la valeur par défaut
    if (scores.length < params.minSamples) {
        return params.defaultThreshold;
    }
    // Calculer la moyenne et l'écart-type
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / scores.length;
    const std = Math.sqrt(variance);
    // Calculer le seuil avec le multiplicateur spécifique au type
    const threshold = mean + (params.stdMultiplier * std);
    // Limiter selon les bornes spécifiques au type
    const boundedThreshold = Math.max(params.minThreshold, Math.min(params.maxThreshold, threshold));
    // Mettre à jour les statistiques d'apprentissage
    updateThresholdStats(contentType, mean, std, boundedThreshold, scores.length);
    // Ajuster les paramètres si l'apprentissage est activé
    if (shouldAdjustParameters(contentType)) {
        adjustThresholdParameters(contentType, mean, std, boundedThreshold);
    }
    console.error(`Dynamic threshold for ${contentType}: ${boundedThreshold.toFixed(3)} (mean: ${mean.toFixed(3)}, std: ${std.toFixed(3)}, multiplier: ${params.stdMultiplier})`);
    return boundedThreshold;
}
/**
 * Récupère les paramètres de seuil pour un type de contenu donné
 */
function getThresholdParameters(contentType) {
    // Normaliser le type de contenu
    const normalizedType = contentType.toLowerCase();
    // Retourner les paramètres spécifiques ou les paramètres par défaut
    return DEFAULT_THRESHOLD_PARAMS[normalizedType] || DEFAULT_THRESHOLD_PARAMS['other'];
}
/**
 * Récupère le seuil par défaut pour un type de contenu
 */
function getDefaultThreshold(contentType) {
    const params = getThresholdParameters(contentType);
    return params.defaultThreshold;
}
/**
 * Met à jour les statistiques d'apprentissage pour un type de contenu
 */
function updateThresholdStats(contentType, mean, std, threshold, sampleCount) {
    const key = contentType.toLowerCase();
    let stats = thresholdStatsCache.get(key);
    if (!stats) {
        stats = {
            contentType: key,
            meanHistory: [],
            stdHistory: [],
            thresholdHistory: [],
            sampleCount: 0,
            lastUpdated: new Date()
        };
        thresholdStatsCache.set(key, stats);
    }
    // Garder un historique limité (derniers 100 échantillons)
    stats.meanHistory.push(mean);
    stats.stdHistory.push(std);
    stats.thresholdHistory.push(threshold);
    stats.sampleCount += sampleCount;
    stats.lastUpdated = new Date();
    // Limiter la taille de l'historique
    const maxHistory = 100;
    if (stats.meanHistory.length > maxHistory) {
        stats.meanHistory.shift();
        stats.stdHistory.shift();
        stats.thresholdHistory.shift();
    }
}
/**
 * Détermine si les paramètres doivent être ajustés pour un type de contenu
 */
function shouldAdjustParameters(contentType) {
    const stats = thresholdStatsCache.get(contentType.toLowerCase());
    if (!stats)
        return false;
    // Ajuster après au moins 20 échantillons
    return stats.sampleCount >= 20 && stats.meanHistory.length >= 10;
}
/**
 * Ajuste les paramètres de seuil basé sur l'historique d'apprentissage
 */
function adjustThresholdParameters(contentType, currentMean, currentStd, currentThreshold) {
    const normalizedType = contentType.toLowerCase();
    const params = getThresholdParameters(normalizedType);
    const stats = thresholdStatsCache.get(normalizedType);
    if (!stats || stats.meanHistory.length < 5)
        return;
    // Calculer les moyennes historiques
    const historicalMean = stats.meanHistory.reduce((a, b) => a + b, 0) / stats.meanHistory.length;
    const historicalStd = stats.stdHistory.reduce((a, b) => a + b, 0) / stats.stdHistory.length;
    const historicalThreshold = stats.thresholdHistory.reduce((a, b) => a + b, 0) / stats.thresholdHistory.length;
    // Ajuster le multiplicateur basé sur la stabilité des scores
    const meanStability = Math.abs(currentMean - historicalMean) / historicalMean;
    const stdStability = Math.abs(currentStd - historicalStd) / historicalStd;
    // Si la distribution est stable, on peut ajuster le multiplicateur
    if (meanStability < 0.2 && stdStability < 0.3) {
        // Ajustement basé sur la performance du seuil historique
        const performanceRatio = historicalThreshold / currentThreshold;
        // Ajuster doucement le multiplicateur
        const adjustment = (performanceRatio - 1) * params.learningRate;
        const newMultiplier = params.stdMultiplier * (1 + adjustment);
        // Limiter les ajustements
        const boundedMultiplier = Math.max(0.2, Math.min(1.5, newMultiplier));
        // Mettre à jour les paramètres (en mémoire seulement)
        DEFAULT_THRESHOLD_PARAMS[normalizedType] = {
            ...params,
            stdMultiplier: boundedMultiplier
        };
        console.error(`Adjusted threshold parameters for ${contentType}: multiplier ${params.stdMultiplier.toFixed(3)} -> ${boundedMultiplier.toFixed(3)}`);
    }
}
/**
 * Récupère les statistiques d'apprentissage pour un type de contenu
 */
export function getThresholdStats(contentType) {
    if (contentType) {
        const stats = thresholdStatsCache.get(contentType.toLowerCase());
        return stats ? {
            contentType: stats.contentType,
            meanHistory: stats.meanHistory,
            stdHistory: stats.stdHistory,
            thresholdHistory: stats.thresholdHistory,
            sampleCount: stats.sampleCount,
            lastUpdated: stats.lastUpdated,
            currentParams: getThresholdParameters(contentType)
        } : {};
    }
    // Retourner toutes les statistiques
    const allStats = {};
    thresholdStatsCache.forEach((stats, key) => {
        allStats[key] = {
            contentType: stats.contentType,
            meanHistory: stats.meanHistory,
            stdHistory: stats.stdHistory,
            thresholdHistory: stats.thresholdHistory,
            sampleCount: stats.sampleCount,
            lastUpdated: stats.lastUpdated,
            currentParams: getThresholdParameters(key)
        };
    });
    return allStats;
}
/**
 * Réinitialise les paramètres d'apprentissage pour un type de contenu
 */
export function resetThresholdLearning(contentType) {
    if (contentType) {
        thresholdStatsCache.delete(contentType.toLowerCase());
        // Réinitialiser aux valeurs par défaut
        const defaultParams = DEFAULT_THRESHOLD_PARAMS['other'];
        DEFAULT_THRESHOLD_PARAMS[contentType.toLowerCase()] = { ...defaultParams };
    }
    else {
        thresholdStatsCache.clear();
        // Réinitialiser tous les paramètres aux valeurs par défaut
        Object.keys(DEFAULT_THRESHOLD_PARAMS).forEach(key => {
            if (key !== 'other') {
                DEFAULT_THRESHOLD_PARAMS[key] = { ...DEFAULT_THRESHOLD_PARAMS['other'] };
            }
        });
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
/**
 * Re-classe les résultats de recherche basé sur les métadonnées
 * @param results - Résultats de la recherche sémantique
 * @param weights - Poids pour le re-ranking
 * @returns Résultats re-classés
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
 * Recherche hybride combinant similarité sémantique et recherche textuelle avec filtres booléens
 * @param query - Requête pour la recherche sémantique
 * @param options - Options de recherche hybride
 * @returns Résultats combinés et classés
 */
export async function hybridSearch(query, options = {}) {
    const { semanticWeight = 0.7, textWeight = 0.3, textQuery, textOperator = 'OR', textField = 'content', prefixSearch = false, suffixSearch = false, substringSearch = true, caseSensitive = false, ...semanticOptions } = options;
    // Normaliser les poids pour qu'ils somment à 1
    const totalWeight = semanticWeight + textWeight;
    const normalizedSemanticWeight = semanticWeight / totalWeight;
    const normalizedTextWeight = textWeight / totalWeight;
    const results = [];
    const resultMap = new Map();
    // 1. Recherche sémantique si le poids est > 0
    if (normalizedSemanticWeight > 0) {
        try {
            const semanticResults = await semanticSearch(query, semanticOptions);
            // Pondérer les scores sémantiques
            semanticResults.forEach(result => {
                const weightedResult = {
                    ...result,
                    score: result.score * normalizedSemanticWeight,
                    metadata: {
                        ...result.metadata,
                        semanticScore: result.score,
                        weightedSemanticScore: result.score * normalizedSemanticWeight
                    }
                };
                resultMap.set(result.id, weightedResult);
                results.push(weightedResult);
            });
            console.error(`Semantic search returned ${semanticResults.length} results (weight: ${normalizedSemanticWeight.toFixed(2)})`);
        }
        catch (error) {
            console.error('Error in semantic search part of hybrid search:', error);
            // Continuer avec la recherche textuelle seulement
        }
    }
    // 2. Recherche textuelle si le poids est > 0 et si textQuery est fourni
    if (normalizedTextWeight > 0 && textQuery && textQuery.trim()) {
        try {
            const textResults = await textSearch(textQuery, {
                ...semanticOptions,
                textOperator,
                textField,
                prefixSearch,
                suffixSearch,
                substringSearch,
                caseSensitive
            });
            // Pondérer les scores textuels et combiner avec les résultats sémantiques
            textResults.forEach(result => {
                const existingResult = resultMap.get(result.id);
                if (existingResult) {
                    // Combiner les scores: score sémantique + score textuel
                    existingResult.score += result.score * normalizedTextWeight;
                    existingResult.metadata = {
                        ...existingResult.metadata,
                        textScore: result.score,
                        weightedTextScore: result.score * normalizedTextWeight,
                        combinedScore: existingResult.score
                    };
                }
                else {
                    // Nouveau résultat textuel seulement
                    const weightedResult = {
                        ...result,
                        score: result.score * normalizedTextWeight,
                        metadata: {
                            ...result.metadata,
                            textScore: result.score,
                            weightedTextScore: result.score * normalizedTextWeight,
                            semanticScore: 0
                        }
                    };
                    resultMap.set(result.id, weightedResult);
                    results.push(weightedResult);
                }
            });
            console.error(`Text search returned ${textResults.length} results (weight: ${normalizedTextWeight.toFixed(2)})`);
        }
        catch (error) {
            console.error('Error in text search part of hybrid search:', error);
            // Continuer avec les résultats sémantiques seulement
        }
    }
    // 3. Trier par score combiné (décroissant)
    const sortedResults = results.sort((a, b) => b.score - a.score);
    // 4. Limiter les résultats si nécessaire
    const limit = semanticOptions.limit || 10;
    const limitedResults = sortedResults.slice(0, limit);
    // 5. Appliquer le re-ranking si activé
    if (semanticOptions.enableReranking && limitedResults.length > 0) {
        console.error(`Applying re-ranking to ${limitedResults.length} hybrid results`);
        const rerankedResults = rerankResults(limitedResults, semanticOptions.rerankingWeights);
        // Log des scores avant/après pour débogage
        if (rerankedResults.length > 0) {
            const firstResult = rerankedResults[0];
            const lastResult = rerankedResults[rerankedResults.length - 1];
            console.error(`Hybrid re-ranking complete: ${rerankedResults.length} results, top score: ${firstResult.score.toFixed(3)}, bottom score: ${lastResult.score.toFixed(3)}`);
        }
        return rerankedResults;
    }
    return limitedResults;
}
/**
 * Recherche textuelle avec filtres booléens
 * @param query - Requête textuelle
 * @param options - Options de recherche textuelle
 * @returns Résultats de recherche textuelle
 */
async function textSearch(query, options = {}) {
    const { projectFilter, limit = 10, contentTypeFilter, roleFilter, fileExtensionFilter, languageFilter, minFileSizeBytes, maxFileSizeBytes, minLinesCount, maxLinesCount, dateFrom, dateTo, includeCompressed, excludeCompressed, textOperator = 'OR', textField = 'content', prefixSearch = false, suffixSearch = false, substringSearch = true, caseSensitive = false } = options;
    // Vérifier quelle table utiliser
    const useV2 = await checkV2TableExists();
    const tableName = useV2 ? 'rag_store_v2' : 'rag_store';
    // Construire la requête textuelle
    let sql = '';
    const params = [];
    let paramIndex = 1;
    if (useV2) {
        sql = `
      SELECT id, project_path, file_path, content, content_type, role,
             file_extension, lines_count, language, is_compressed, original_size_bytes,
             created_at, updated_at,
             1.0 as similarity
      FROM rag_store_v2
      WHERE 1=1
    `;
    }
    else {
        sql = `
      SELECT id, project_path, file_path, content,
             1.0 as similarity
      FROM rag_store
      WHERE 1=1
    `;
    }
    // Ajouter la condition de recherche textuelle
    if (query && query.trim()) {
        const searchTerms = query.trim().split(/\s+/).filter(term => term.length > 0);
        if (searchTerms.length > 0) {
            const conditions = [];
            searchTerms.forEach((term, index) => {
                const paramName = `$${paramIndex + index}`;
                params.push(prepareTextSearchTerm(term, prefixSearch, suffixSearch, substringSearch, caseSensitive));
                const fieldConditions = [];
                if (textField === 'content' || textField === 'both') {
                    fieldConditions.push(`content ILIKE ${paramName}`);
                }
                if (textField === 'file_path' || textField === 'both') {
                    fieldConditions.push(`file_path ILIKE ${paramName}`);
                }
                if (fieldConditions.length > 0) {
                    conditions.push(`(${fieldConditions.join(' OR ')})`);
                }
            });
            if (conditions.length > 0) {
                const operator = textOperator === 'AND' ? ' AND ' : ' OR ';
                sql += ` AND (${conditions.join(operator)})`;
                paramIndex += searchTerms.length;
            }
        }
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
    // Pour la recherche textuelle, nous utilisons un score basé sur le nombre de correspondances
    // et la pertinence (simplifié pour l'exemple)
    sql += ` ORDER BY similarity DESC LIMIT $${paramIndex}`;
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
            // Calculer un score textuel basé sur le nombre de correspondances
            const textScore = calculateTextScore(content, query, {
                prefixSearch,
                suffixSearch,
                substringSearch,
                caseSensitive
            });
            return {
                id: row.id,
                filePath: row.file_path,
                content,
                score: textScore,
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
        return processedRows;
    }
    catch (error) {
        console.error("Error in text search:", error);
        throw error;
    }
}
/**
 * Prépare un terme de recherche textuelle pour SQL LIKE
 */
function prepareTextSearchTerm(term, prefixSearch, suffixSearch, substringSearch, caseSensitive) {
    let searchTerm = term;
    if (!caseSensitive) {
        searchTerm = searchTerm.toLowerCase();
    }
    // Échapper les caractères spéciaux pour LIKE
    searchTerm = searchTerm.replace(/[%_]/g, '\\$&');
    // Ajouter les wildcards selon les options
    if (prefixSearch && suffixSearch) {
        return `%${searchTerm}%`;
    }
    else if (prefixSearch) {
        return `${searchTerm}%`;
    }
    else if (suffixSearch) {
        return `%${searchTerm}`;
    }
    else if (substringSearch) {
        return `%${searchTerm}%`;
    }
    else {
        // Recherche exacte
        return searchTerm;
    }
}
/**
 * Calcule un score textuel basé sur le nombre de correspondances
 */
function calculateTextScore(content, query, options) {
    const searchContent = options.caseSensitive ? content : content.toLowerCase();
    const searchQuery = options.caseSensitive ? query : query.toLowerCase();
    const terms = searchQuery.split(/\s+/).filter(term => term.length > 0);
    if (terms.length === 0) {
        return 0;
    }
    let totalMatches = 0;
    let maxPossibleMatches = terms.length;
    terms.forEach(term => {
        if (searchContent.includes(term)) {
            totalMatches++;
            // Bonus pour les correspondances multiples
            const matchCount = (searchContent.match(new RegExp(term, 'g')) || []).length;
            if (matchCount > 1) {
                totalMatches += Math.min(matchCount - 1, 3) * 0.1; // Bonus limité
            }
        }
    });
    // Score basé sur le pourcentage de termes correspondants
    const baseScore = totalMatches / maxPossibleMatches;
    // Bonus pour la position (début du contenu)
    const firstMatchIndex = Math.min(...terms.map(term => searchContent.indexOf(term)).filter(index => index !== -1));
    const positionBonus = firstMatchIndex !== Infinity && firstMatchIndex < 100 ? 0.2 : 0;
    // Bonus pour la densité (termes proches les uns des autres)
    const densityBonus = totalMatches > 1 ? 0.1 : 0;
    return Math.min(1.0, baseScore + positionBonus + densityBonus);
}
export async function semanticSearch(query, options = {}) {
    const { projectFilter, limit = 10, threshold = 0.3, dynamicThreshold = false, contentTypeFilter, roleFilter, fileExtensionFilter, languageFilter, minFileSizeBytes, maxFileSizeBytes, minLinesCount, maxLinesCount, dateFrom, dateTo, includeCompressed, excludeCompressed, enableReranking = false, rerankingWeights = {} } = options;
    const queryVector = await generateEmbedding(query);
    const queryVectorStr = `[${queryVector.join(',')}]`;
    // Vérifier quelle table utiliser
    const useV2 = await checkV2TableExists();
    const tableName = useV2 ? 'rag_store_v2' : 'rag_store';
    // Requête initiale sans seuil pour calculer la distribution si dynamicThreshold est activé
    let initialThreshold = threshold;
    if (dynamicThreshold) {
        try {
            // D'abord, récupérer plus de résultats pour analyser la distribution
            let distributionSql = `
        SELECT (1 - (vector <=> $1::vector)) as similarity
        FROM ${tableName}
        WHERE 1=1
      `;
            const distributionParams = [queryVectorStr];
            let paramIndex = 2;
            // Appliquer les mêmes filtres que la requête principale pour une distribution réaliste
            paramIndex = applyFiltersToQuery(distributionSql, distributionParams, paramIndex, {
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
            distributionSql += ` ORDER BY similarity DESC LIMIT 50`;
            const distributionResult = await pool.query(distributionSql, distributionParams);
            const scores = distributionResult.rows.map(row => row.similarity);
            if (scores.length > 0) {
                initialThreshold = calculateDynamicThreshold(scores);
                console.error(`Dynamic threshold calculated: ${initialThreshold.toFixed(3)} from ${scores.length} scores`);
            }
        }
        catch (error) {
            console.error("Error calculating dynamic threshold, using default:", error);
        }
    }
    // Construire la requête principale
    let sql = '';
    const params = [queryVectorStr, initialThreshold];
    let paramIndex = 3;
    if (useV2) {
        sql = `
      SELECT id, project_path, file_path, content, content_type, role,
             file_extension, lines_count, language, is_compressed, original_size_bytes,
             created_at, updated_at,
             (1 - (vector <=> $1::vector)) as similarity
      FROM rag_store_v2
      WHERE (1 - (vector <=> $1::vector)) >= $2
    `;
    }
    else {
        sql = `
      SELECT id, project_path, file_path, content,
             (1 - (vector <=> $1::vector)) as similarity
      FROM rag_store
      WHERE (1 - (vector <=> $1::vector)) >= $2
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
    sql += ` ORDER BY similarity DESC LIMIT $${paramIndex}`;
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
 * @param sql - Requête SQL en construction (modifiée par référence)
 * @param params - Paramètres de la requête (modifiés par référence)
 * @param paramIndex - Index actuel des paramètres
 * @param filters - Filtres à appliquer
 * @param useV2 - Si la table v2 est utilisée
 * @returns Nouvel index des paramètres
 */
function applyFiltersToQuery(sql, params, paramIndex, filters, useV2) {
    let currentParamIndex = paramIndex;
    // Filtre par projet
    if (filters.projectFilter) {
        sql += ` AND project_path = $${currentParamIndex}`;
        params.push(filters.projectFilter);
        currentParamIndex++;
    }
    // Filtres spécifiques à rag_store_v2
    if (useV2) {
        // Filtre par type de contenu (simple ou multiple)
        if (filters.contentTypeFilter) {
            if (Array.isArray(filters.contentTypeFilter)) {
                if (filters.contentTypeFilter.length > 0) {
                    const placeholders = filters.contentTypeFilter.map((_, i) => `$${currentParamIndex + i}`).join(', ');
                    sql += ` AND content_type IN (${placeholders})`;
                    params.push(...filters.contentTypeFilter);
                    currentParamIndex += filters.contentTypeFilter.length;
                }
            }
            else {
                sql += ` AND content_type = $${currentParamIndex}`;
                params.push(filters.contentTypeFilter);
                currentParamIndex++;
            }
        }
        // Filtre par rôle (simple ou multiple)
        if (filters.roleFilter) {
            if (Array.isArray(filters.roleFilter)) {
                if (filters.roleFilter.length > 0) {
                    const placeholders = filters.roleFilter.map((_, i) => `$${currentParamIndex + i}`).join(', ');
                    sql += ` AND role IN (${placeholders})`;
                    params.push(...filters.roleFilter);
                    currentParamIndex += filters.roleFilter.length;
                }
            }
            else {
                sql += ` AND role = $${currentParamIndex}`;
                params.push(filters.roleFilter);
                currentParamIndex++;
            }
        }
        // Filtre par extension de fichier (simple ou multiple)
        if (filters.fileExtensionFilter) {
            if (Array.isArray(filters.fileExtensionFilter)) {
                if (filters.fileExtensionFilter.length > 0) {
                    const placeholders = filters.fileExtensionFilter.map((_, i) => `$${currentParamIndex + i}`).join(', ');
                    sql += ` AND file_extension IN (${placeholders})`;
                    params.push(...filters.fileExtensionFilter);
                    currentParamIndex += filters.fileExtensionFilter.length;
                }
            }
            else {
                sql += ` AND file_extension = $${currentParamIndex}`;
                params.push(filters.fileExtensionFilter);
                currentParamIndex++;
            }
        }
        // Filtre par langage (simple ou multiple)
        if (filters.languageFilter) {
            if (Array.isArray(filters.languageFilter)) {
                if (filters.languageFilter.length > 0) {
                    const placeholders = filters.languageFilter.map((_, i) => `$${currentParamIndex + i}`).join(', ');
                    sql += ` AND language IN (${placeholders})`;
                    params.push(...filters.languageFilter);
                    currentParamIndex += filters.languageFilter.length;
                }
            }
            else {
                sql += ` AND language = $${currentParamIndex}`;
                params.push(filters.languageFilter);
                currentParamIndex++;
            }
        }
        // Filtres par taille de fichier
        if (filters.minFileSizeBytes !== undefined) {
            sql += ` AND file_size_bytes >= $${currentParamIndex}`;
            params.push(filters.minFileSizeBytes);
            currentParamIndex++;
        }
        if (filters.maxFileSizeBytes !== undefined) {
            sql += ` AND file_size_bytes <= $${currentParamIndex}`;
            params.push(filters.maxFileSizeBytes);
            currentParamIndex++;
        }
        // Filtres par nombre de lignes
        if (filters.minLinesCount !== undefined) {
            sql += ` AND lines_count >= $${currentParamIndex}`;
            params.push(filters.minLinesCount);
            currentParamIndex++;
        }
        if (filters.maxLinesCount !== undefined) {
            sql += ` AND lines_count <= $${currentParamIndex}`;
            params.push(filters.maxLinesCount);
            currentParamIndex++;
        }
        // Filtres par date
        if (filters.dateFrom) {
            sql += ` AND created_at >= $${currentParamIndex}`;
            params.push(filters.dateFrom);
            currentParamIndex++;
        }
        if (filters.dateTo) {
            sql += ` AND created_at <= $${currentParamIndex}`;
            params.push(filters.dateTo);
            currentParamIndex++;
        }
        // Filtres par compression
        if (filters.includeCompressed !== undefined) {
            sql += ` AND is_compressed = $${currentParamIndex}`;
            params.push(filters.includeCompressed);
            currentParamIndex++;
        }
        if (filters.excludeCompressed !== undefined && filters.excludeCompressed) {
            sql += ` AND is_compressed = false`;
        }
    }
    return currentParamIndex;
}
// Fonctions utilitaires pour la compression (définies avant leur utilisation)
const COMPRESSION_THRESHOLD = 10 * 1024; // 10KB
async function compressContent(content) {
    const originalSize = Buffer.byteLength(content, 'utf8');
    const compressed = await gzipAsync(content);
    const compressionRatio = (compressed.length / originalSize) * 100;
    return { compressed, compressionRatio };
}
async function decompressContent(compressed) {
    const decompressed = await gunzipAsync(compressed);
    return decompressed.toString('utf8');
}
function shouldCompress(content) {
    return Buffer.byteLength(content, 'utf8') > COMPRESSION_THRESHOLD;
}
// Fonction pour décompresser le contenu si nécessaire
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
       WHERE project_path = $1`, [projectPath]);
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
export async function getVersionStats(chunkId) {
    try {
        const useV2 = await checkV2TableExists();
        if (!useV2) {
            throw new Error('Version stats require rag_store_v2 table');
        }
        let sql = 'SELECT * FROM rag_store_v2_version_stats';
        const params = [];
        if (chunkId) {
            sql += ' WHERE chunk_id = $1';
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
// Fonction pour détecter les changements significatifs
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
// Fermer le pool à la fin
process.on('SIGINT', async () => {
    await pool.end();
    process.exit(0);
});
//# sourceMappingURL=vector-store.js.map