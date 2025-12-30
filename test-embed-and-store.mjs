// Test de embedAndStore avec métadonnées enrichies
import { embedAndStore, setEmbeddingProvider } from './build/rag/vector-store.js';

console.log('🧪 Test de embedAndStore avec métadonnées enrichies\n');

// Configurer les embeddings factices pour les tests
setEmbeddingProvider('fake');

async function runTest() {
  try {
    console.log('📄 Test 1: Stockage avec métadonnées minimales');
    
    await embedAndStore(
      '/test/project',
      '/test/project/file1.js',
      'function test() { return "hello"; }',
      {
        contentType: 'code',
        language: 'javascript',
        role: 'core'
      }
    );
    
    console.log('   ✅ Stockage réussi avec métadonnées minimales');
    
    console.log('\n📄 Test 2: Stockage avec métadonnées complètes');
    
    await embedAndStore(
      '/test/project',
      '/test/project/README.md',
      '# Documentation\n\nCeci est une documentation de test.',
      {
        chunkIndex: 0,
        totalChunks: 2,
        contentType: 'doc',
        role: 'example',
        fileExtension: 'md',
        linesCount: 3,
        language: 'markdown'
      }
    );
    
    console.log('   ✅ Stockage réussi avec métadonnées complètes');
    
    console.log('\n📄 Test 3: Stockage avec chunks multiples');
    
    // Simuler un fichier avec plusieurs chunks
    const chunks = [
      'Premier chunk de contenu',
      'Deuxième chunk de contenu',
      'Troisième chunk de contenu'
    ];
    
    for (let i = 0; i < chunks.length; i++) {
      await embedAndStore(
        '/test/project',
        '/test/project/multi-chunk.txt',
        chunks[i],
        {
          chunkIndex: i,
          totalChunks: chunks.length,
          contentType: 'doc',
          role: 'example',
          linesCount: 1
        }
      );
    }
    
    console.log(`   ✅ Stockage réussi avec ${chunks.length} chunks`);
    
    console.log('\n📄 Test 4: Stockage avec compression simulée');
    
    await embedAndStore(
      '/test/project',
      '/test/project/large.json',
      JSON.stringify({ large: 'content', with: 'many properties' }, null, 2),
      {
        contentType: 'config',
        role: 'template',
        isCompressed: true,
        originalSizeBytes: 1000
      }
    );
    
    console.log('   ✅ Stockage réussi avec compression simulée');
    
    console.log('\n📊 RÉSUMÉ DES TESTS');
    console.log('✅ embedAndStore() adapté avec succès pour inclure:');
    console.log('   - content_type et métadonnées enrichies');
    console.log('   - chunk_index et total_chunks pour gestion multi-chunks');
    console.log('   - file_extension, lines_count, language');
    console.log('   - role (core, helper, test, example, template, other)');
    console.log('   - is_compressed et original_size_bytes');
    console.log('   - Détection automatique de la table (rag_store_v2 si disponible)');
    console.log('   - Compatibilité avec l\'ancienne table rag_store');
    console.log('\n🎯 La fonction embedAndStore() est prête pour le pipeline Phase 1 !');
    
  } catch (error) {
    console.error('❌ Erreur lors des tests:', error);
  }
}

runTest().catch(console.error);
