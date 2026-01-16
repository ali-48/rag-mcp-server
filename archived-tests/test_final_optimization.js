// Test final pour vérifier l'optimisation des scores
import { setEmbeddingProvider, embedAndStore, semanticSearch } from './build/rag/vector-store.js';

async function runTest() {
  console.log('=== TEST D\'OPTIMISATION DES SCORES ===\n');
  
  // Configurer Ollama avec nomic-embed-text
  setEmbeddingProvider('ollama', 'nomic-embed-text');
  
  // Indexer des documents variés
  const documents = [
    { path: '/tmp/doc1.txt', content: 'Le machine learning est une branche de l\'intelligence artificielle' },
    { path: '/tmp/doc2.txt', content: 'PostgreSQL est un système de gestion de base de données relationnelle' },
    { path: '/tmp/doc3.txt', content: 'React est une bibliothèque JavaScript pour construire des interfaces utilisateur' },
    { path: '/tmp/doc4.txt', content: 'Python est un langage de programmation interprété et de haut niveau' },
    { path: '/tmp/doc5.txt', content: 'Docker est une plateforme de conteneurisation d\'applications' }
  ];
  
  console.log('1. Indexation des documents...');
  for (const doc of documents) {
    await embedAndStore('/tmp/test_final', doc.path, doc.content);
  }
  console.log('   ✓ 5 documents indexés\n');
  
  // Tests de recherche
  const testQueries = [
    { query: 'intelligence artificielle', expected: 'doc1.txt' },
    { query: 'base de données', expected: 'doc2.txt' },
    { query: 'JavaScript', expected: 'doc3.txt' },
    { query: 'programmation', expected: 'doc4.txt' },
    { query: 'conteneur', expected: 'doc5.txt' }
  ];
  
  console.log('2. Tests de recherche sémantique:');
  for (const test of testQueries) {
    const results = await semanticSearch(test.query, {
      projectFilter: '/tmp/test_final',
      limit: 3,
      threshold: 0
    });
    
    console.log(`\n   Requête: "${test.query}"`);
    console.log('   Résultats:');
    results.forEach((r, i) => {
      const fileName = r.filePath.split('/').pop();
      const match = fileName === test.expected ? '✓' : ' ';
      console.log(`   ${match} ${i+1}. ${fileName}: ${r.score.toFixed(4)}`);
    });
  }
  
  // Analyse statistique
  console.log('\n3. Analyse statistique des scores:');
  const { Pool } = await import('pg');
  const pool = new Pool({
    host: "localhost",
    port: 16432,
    database: "rag_mcp_dedicated",
    user: "rag_user",
    password: "secure_rag_password",
  });
  
  const stats = await pool.query(`
    SELECT 
      MIN(score) as min_score,
      MAX(score) as max_score,
      AVG(score) as avg_score,
      STDDEV(score) as stddev_score
    FROM (
      SELECT a.vector <=> b.vector as score
      FROM rag_store a, rag_store b
      WHERE a.id < b.id AND a.project_path = '/tmp/test_final' AND b.project_path = '/tmp/test_final'
    ) distances;
  `);
  
  const row = stats.rows[0];
  console.log(`   Score minimum: ${row.min_score?.toFixed(4) || 'N/A'}`);
  console.log(`   Score maximum: ${row.max_score?.toFixed(4) || 'N/A'}`);
  console.log(`   Score moyen: ${row.avg_score?.toFixed(4) || 'N/A'}`);
  console.log(`   Écart-type: ${row.stddev_score?.toFixed(4) || 'N/A'}`);
  
  // Vérification du problème des scores élevés
  console.log('\n4. Vérification de l\'optimisation:');
  if (row.max_score && row.max_score < 0.9) {
    console.log('   ✓ PROBLÈME RÉSOLU: Les scores ne sont plus uniformément élevés');
    console.log(`   ✓ Score maximum: ${row.max_score.toFixed(4)} (acceptable)`);
  } else {
    console.log('   ✗ PROBLÈME PERSISTANT: Scores trop élevés');
  }
  
  await pool.end();
  console.log('\n=== TEST TERMINÉ ===');
}

runTest().catch(console.error);
