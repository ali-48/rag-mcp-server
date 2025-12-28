import { setEmbeddingProvider, embedAndStore, semanticSearch } from './build/rag/vector-store.js';

async function test() {
  // Configurer Ollama avec nomic-embed-text (768 dimensions)
  setEmbeddingProvider('ollama', 'nomic-embed-text');
  
  // Indexer quelques documents
  const docs = [
    { path: '/tmp/test1.txt', content: 'Le chat est un animal domestique' },
    { path: '/tmp/test2.txt', content: 'PostgreSQL est une base de données relationnelle' },
    { path: '/tmp/test3.txt', content: 'React est une librairie JavaScript pour le frontend' }
  ];
  
  console.log('Indexing documents...');
  for (const doc of docs) {
    await embedAndStore('/tmp/test_project', doc.path, doc.content);
    console.log(`Indexed: ${doc.path}`);
  }
  
  // Rechercher
  console.log('\nSearching for "animal"...');
  const results = await semanticSearch('animal', {
    projectFilter: '/tmp/test_project',
    limit: 5,
    threshold: 0
  });
  
  console.log('Results:');
  results.forEach((r, i) => {
    console.log(`${i+1}. ${r.filePath}: ${r.score.toFixed(4)} - "${r.content.trim()}"`);
  });
  
  // Calculer les distances entre les vecteurs
  console.log('\nCalculating distances...');
  const { Pool } = await import('pg');
  const pool = new Pool({
    host: "localhost",
    port: 16432,
    database: "rag_mcp_dedicated",
    user: "rag_user",
    password: "secure_rag_password",
  });
  
  const res = await pool.query(`
    SELECT 
      a.file_path as file1,
      b.file_path as file2,
      a.vector <=> b.vector as distance
    FROM rag_store a, rag_store b 
    WHERE a.id < b.id AND a.project_path = '/tmp/test_project' AND b.project_path = '/tmp/test_project'
    ORDER BY distance;
  `);
  
  console.log('Distances between documents:');
  res.rows.forEach(row => {
    console.log(`${row.file1} <-> ${row.file2}: ${row.distance.toFixed(4)}`);
  });
  
  await pool.end();
}

test().catch(console.error);
