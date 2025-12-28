import { Pool } from "pg";
// Configuration de la connexion PostgreSQL
const pool = new Pool({
    host: "localhost",
    port: 16432,
    database: "rag_mcp_dedicated",
    user: "rag_user",
    password: "secure_rag_password",
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
// Configuration des embeddings
let embeddingProvider = "fake";
let embeddingModel = "nomic-embed-text";
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
// Embeddings avec Ollama
async function generateOllamaEmbedding(text) {
    console.error(`Generating embedding with Ollama (${embeddingModel}): ${text.substring(0, 50)}...`);
    try {
        const response = await fetch('http://localhost:11434/api/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: embeddingModel,
                prompt: text,
            }),
        });
        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (!data.embedding || !Array.isArray(data.embedding)) {
            throw new Error('Invalid response from Ollama API: missing embedding array');
        }
        return data.embedding;
    }
    catch (error) {
        console.error(`Failed to get embedding from Ollama: ${error}. Falling back to fake embeddings.`);
        // Fallback sur les embeddings factices en cas d'erreur
        return generateFakeEmbedding(text);
    }
}
// Embeddings avec Sentence Transformers (à implémenter)
async function generateSentenceTransformerEmbedding(text) {
    console.error(`Generating embedding with Sentence Transformers: ${text.substring(0, 50)}...`);
    // TODO: Implémenter avec @xenova/transformers
    // Pour l'instant, retourner des embeddings factices
    return generateFakeEmbedding(text);
}
export async function embedAndStore(projectPath, filePath, content) {
    const id = `${projectPath}:${filePath}`;
    const vector = await generateEmbedding(content);
    try {
        // Convertir le tableau en chaîne de tableau PostgreSQL
        const vectorStr = `[${vector.join(',')}]`;
        await pool.query(`INSERT INTO rag_store (id, project_path, file_path, content, vector, updated_at)
       VALUES ($1, $2, $3, $4, $5::vector, NOW())
       ON CONFLICT (id) DO UPDATE SET
         content = EXCLUDED.content,
         vector = EXCLUDED.vector,
         updated_at = NOW()`, [id, projectPath, filePath, content, vectorStr]);
    }
    catch (error) {
        console.error(`Error storing document ${id}:`, error);
        throw error;
    }
}
/**
 * Calcule un seuil de similarité dynamique basé sur la distribution des scores.
 * Cette fonction résout le problème des "scores uniformément élevés" en adaptant
 * le seuil à la distribution réelle des similarités.
 *
 * Principe: seuil = moyenne + 0.5 * écart-type
 * - Pour les scores uniformément élevés (faible écart-type), le seuil sera élevé
 * - Pour les scores bien distribués, le seuil s'adapte à la distribution
 * - Limité entre 0.1 et 0.8 pour éviter les valeurs extrêmes
 *
 * @param scores - Tableau de scores de similarité (cosinus)
 * @returns Seuil adaptatif entre 0.1 et 0.8
 */
function calculateDynamicThreshold(scores) {
    if (scores.length === 0)
        return 0.3; // Valeur par défaut
    // Calculer la moyenne et l'écart-type
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / scores.length;
    const std = Math.sqrt(variance);
    // Seuil = moyenne + 0.5 * écart-type (pour capturer les scores significatifs)
    const threshold = mean + 0.5 * std;
    // Limiter entre 0.1 et 0.8 pour éviter les valeurs extrêmes
    return Math.max(0.1, Math.min(0.8, threshold));
}
export async function semanticSearch(query, options = {}) {
    const { projectFilter, limit = 10, threshold = 0.3, // Changé de 0.0 à 0.3 (valeur par défaut raisonnable)
    dynamicThreshold = false } = options;
    const queryVector = await generateEmbedding(query);
    const queryVectorStr = `[${queryVector.join(',')}]`;
    // Requête initiale sans seuil pour calculer la distribution si dynamicThreshold est activé
    let initialThreshold = threshold;
    if (dynamicThreshold) {
        try {
            // D'abord, récupérer plus de résultats pour analyser la distribution
            const distributionSql = `
        SELECT (1 - (vector <=> $1::vector)) as similarity
        FROM rag_store
        ${projectFilter ? 'WHERE project_path = $2' : ''}
        ORDER BY similarity DESC
        LIMIT 50
      `;
            const distributionParams = [queryVectorStr];
            if (projectFilter) {
                distributionParams.push(projectFilter);
            }
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
    let sql = `
    SELECT id, project_path, file_path, content,
           (1 - (vector <=> $1::vector)) as similarity
    FROM rag_store
    WHERE (1 - (vector <=> $1::vector)) >= $2
  `;
    const params = [queryVectorStr, initialThreshold];
    if (projectFilter) {
        sql += ` AND project_path = $${params.length + 1}`;
        params.push(projectFilter);
    }
    sql += ` ORDER BY similarity DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    try {
        const result = await pool.query(sql, params);
        return result.rows.map(row => ({
            id: row.id,
            filePath: row.file_path,
            content: row.content,
            score: row.similarity,
            metadata: {
                projectPath: row.project_path,
                fileSize: row.content.length,
                lines: row.content.split('\n').length,
            },
        }));
    }
    catch (error) {
        console.error("Error in semantic search:", error);
        throw error;
    }
}
export async function getProjectStats(projectPath) {
    try {
        const result = await pool.query(`SELECT 
         COUNT(*) as total_files,
         MIN(created_at) as indexed_at,
         MAX(updated_at) as last_updated
       FROM rag_store
       WHERE project_path = $1`, [projectPath]);
        const row = result.rows[0];
        return {
            totalFiles: parseInt(row.total_files) || 0,
            totalChunks: parseInt(row.total_files) || 0, // Même valeur pour l'instant
            indexedAt: row.indexed_at ? new Date(row.indexed_at) : null,
            lastUpdated: row.last_updated ? new Date(row.last_updated) : null,
        };
    }
    catch (error) {
        console.error(`Error getting stats for project ${projectPath}:`, error);
        throw error;
    }
}
export async function listProjects() {
    try {
        const result = await pool.query(`SELECT DISTINCT project_path FROM rag_store ORDER BY project_path`);
        return result.rows.map(row => row.project_path);
    }
    catch (error) {
        console.error("Error listing projects:", error);
        throw error;
    }
}
// Fermer le pool à la fin
process.on('SIGINT', async () => {
    await pool.end();
    process.exit(0);
});
