import { Pool } from "pg";
import { SearchResult } from "./types.js";

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
let embeddingProvider: string = "fake";
let embeddingModel: string = "nomic-embed-text";

// Fonction pour configurer le fournisseur d'embeddings
export function setEmbeddingProvider(provider: string, model: string = "nomic-embed-text"): void {
  embeddingProvider = provider;
  embeddingModel = model;
  console.error(`Embedding provider configured: ${provider}, model: ${model}`);
}

// Fonction pour générer des embeddings selon le fournisseur configuré
async function generateEmbedding(text: string): Promise<number[]> {
  switch (embeddingProvider) {
    case "ollama":
      return await generateOllamaEmbedding(text);
    case "sentence-transformers":
      return await generateSentenceTransformerEmbedding(text);
    case "fake":
    default:
      return generateFakeEmbedding(text);
  }
}

// Embeddings factices (pour tests)
function generateFakeEmbedding(text: string): number[] {
  // Embedding factice de dimension 768
  const seed = text.length;
  return Array(768).fill(0).map((_, i) => {
    const x = Math.sin(seed + i * 0.1) * 0.5;
    return x + (Math.random() * 0.1 - 0.05);
  });
}

// Embeddings avec Ollama (à implémenter)
async function generateOllamaEmbedding(text: string): Promise<number[]> {
  console.error(`Generating embedding with Ollama (${embeddingModel}): ${text.substring(0, 50)}...`);
  // TODO: Implémenter l'appel à l'API Ollama
  // Pour l'instant, retourner des embeddings factices
  return generateFakeEmbedding(text);
}

// Embeddings avec Sentence Transformers (à implémenter)
async function generateSentenceTransformerEmbedding(text: string): Promise<number[]> {
  console.error(`Generating embedding with Sentence Transformers: ${text.substring(0, 50)}...`);
  // TODO: Implémenter avec @xenova/transformers
  // Pour l'instant, retourner des embeddings factices
  return generateFakeEmbedding(text);
}

export async function embedAndStore(
  projectPath: string,
  filePath: string,
  content: string
): Promise<void> {
  const id = `${projectPath}:${filePath}`;
  const vector = await generateEmbedding(content);
  
  try {
    // Convertir le tableau en chaîne de tableau PostgreSQL
    const vectorStr = `[${vector.join(',')}]`;
    await pool.query(
      `INSERT INTO rag_store (id, project_path, file_path, content, vector, updated_at)
       VALUES ($1, $2, $3, $4, $5::vector, NOW())
       ON CONFLICT (id) DO UPDATE SET
         content = EXCLUDED.content,
         vector = EXCLUDED.vector,
         updated_at = NOW()`,
      [id, projectPath, filePath, content, vectorStr]
    );
  } catch (error) {
    console.error(`Error storing document ${id}:`, error);
    throw error;
  }
}

export async function semanticSearch(
  query: string,
  options: {
    projectFilter?: string;
    limit?: number;
    threshold?: number;
  } = {}
): Promise<SearchResult[]> {
  const { projectFilter, limit = 10, threshold = 0.0 } = options;
  const queryVector = await generateEmbedding(query);
  const queryVectorStr = `[${queryVector.join(',')}]`;
  
  let sql = `
    SELECT id, project_path, file_path, content,
           (1 - (vector <=> $1::vector)) as similarity
    FROM rag_store
    WHERE (1 - (vector <=> $1::vector)) >= $2
  `;
  
  const params: any[] = [queryVectorStr, threshold];
  
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
  } catch (error) {
    console.error("Error in semantic search:", error);
    throw error;
  }
}

export async function getProjectStats(projectPath: string): Promise<{
  totalFiles: number;
  totalChunks: number;
  indexedAt: Date | null;
  lastUpdated: Date | null;
}> {
  try {
    const result = await pool.query(
      `SELECT 
         COUNT(*) as total_files,
         MIN(created_at) as indexed_at,
         MAX(updated_at) as last_updated
       FROM rag_store
       WHERE project_path = $1`,
      [projectPath]
    );
    
    const row = result.rows[0];
    return {
      totalFiles: parseInt(row.total_files) || 0,
      totalChunks: parseInt(row.total_files) || 0, // Même valeur pour l'instant
      indexedAt: row.indexed_at ? new Date(row.indexed_at) : null,
      lastUpdated: row.last_updated ? new Date(row.last_updated) : null,
    };
  } catch (error) {
    console.error(`Error getting stats for project ${projectPath}:`, error);
    throw error;
  }
}

export async function listProjects(): Promise<string[]> {
  try {
    const result = await pool.query(
      `SELECT DISTINCT project_path FROM rag_store ORDER BY project_path`
    );
    
    return result.rows.map(row => row.project_path);
  } catch (error) {
    console.error("Error listing projects:", error);
    throw error;
  }
}

// Fermer le pool à la fin
process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});
