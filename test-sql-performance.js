#!/usr/bin/env node

/**
 * Script de benchmark pour les performances d'ingestion SQL
 * Teste différentes stratégies d'insertion et volumes de données
 */

import { randomBytes } from 'crypto';
import { performance } from 'perf_hooks';
import { Pool } from 'pg';

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

// Fonction pour générer du contenu de test
function generateTestContent(sizeInKB) {
    const sizeInBytes = sizeInKB * 1024;
    const content = randomBytes(sizeInBytes).toString('base64');
    return content.substring(0, sizeInBytes); // Assurer la taille exacte
}

// Fonction pour générer un embedding factice
function generateFakeEmbedding(dimension = 768) {
    return Array(dimension).fill(0).map(() => Math.random() * 2 - 1);
}

// Fonction pour formater le temps
function formatTime(ms) {
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}min`;
}

// Fonction pour formater la taille
function formatSize(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

// Test 1: Insertion individuelle (baseline)
async function testIndividualInsertions(count, contentSizeKB = 1) {
    console.log(`\n=== Test 1: Insertion individuelle (${count} enregistrements, ${contentSizeKB}KB chacun) ===`);

    const results = {
        totalTime: 0,
        successful: 0,
        failed: 0,
        totalSize: 0
    };

    const startTime = performance.now();

    for (let i = 0; i < count; i++) {
        try {
            const content = generateTestContent(contentSizeKB);
            const vector = generateFakeEmbedding(4096);
            const vectorStr = `[${vector.join(',')}]`;

            await pool.query(
                `INSERT INTO rag_store_v2 (
          id, project_path, file_path, chunk_index, total_chunks,
          content, content_type, role, file_extension, file_size_bytes,
          lines_count, language, vector, is_compressed, original_size_bytes,
          version, created_at, updated_at, indexed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::vector, $14, $15, 1, NOW(), NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          content = EXCLUDED.content,
          updated_at = NOW()`,
                [
                    `test:file${i}.txt`,
                    '/test/project',
                    `/test/file${i}.txt`,
                    0,
                    1,
                    content,
                    'other',
                    'test',
                    'txt',
                    content.length,
                    content.split('\n').length,
                    null,
                    vectorStr,
                    false,
                    content.length
                ]
            );

            results.successful++;
            results.totalSize += content.length;

            // Afficher la progression
            if ((i + 1) % Math.max(1, Math.floor(count / 10)) === 0) {
                console.log(`  Progression: ${i + 1}/${count} (${Math.round((i + 1) * 100 / count)}%)`);
            }
        } catch (error) {
            console.error(`  Erreur sur l'enregistrement ${i}:`, error.message);
            results.failed++;
        }
    }

    results.totalTime = performance.now() - startTime;

    return results;
}

// Test 2: Insertion par batch (optimisation)
async function testBatchInsertions(count, contentSizeKB = 1, batchSize = 100) {
    console.log(`\n=== Test 2: Insertion par batch (${count} enregistrements, batch de ${batchSize}, ${contentSizeKB}KB chacun) ===`);

    const results = {
        totalTime: 0,
        successful: 0,
        failed: 0,
        totalSize: 0,
        batches: 0
    };

    const startTime = performance.now();

    for (let batchStart = 0; batchStart < count; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, count);
        const batchCount = batchEnd - batchStart;

        try {
            // Préparer les valeurs du batch
            const values = [];
            const params = [];
            let paramIndex = 1;

            for (let i = batchStart; i < batchEnd; i++) {
                const content = generateTestContent(contentSizeKB);
                const vector = generateFakeEmbedding(4096);
                const vectorStr = `[${vector.join(',')}]`;

                values.push(`(
          $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++},
          $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++},
          $${paramIndex++}, $${paramIndex++}, $${paramIndex++}::vector, $${paramIndex++}, $${paramIndex++},
          1, NOW(), NOW(), NOW()
        )`);

                params.push(
                    `test:file${i}.txt`,
                    '/test/project',
                    `/test/file${i}.txt`,
                    0,
                    1,
                    content,
                    'other',
                    'test',
                    'txt',
                    content.length,
                    content.split('\n').length,
                    null,
                    vectorStr,
                    false,
                    content.length
                );

                results.successful++;
                results.totalSize += content.length;
            }

            // Exécuter le batch
            await pool.query(
                `INSERT INTO rag_store_v2 (
          id, project_path, file_path, chunk_index, total_chunks,
          content, content_type, role, file_extension, file_size_bytes,
          lines_count, language, vector, is_compressed, original_size_bytes,
          version, created_at, updated_at, indexed_at
        ) VALUES ${values.join(', ')}
        ON CONFLICT (id) DO UPDATE SET
          content = EXCLUDED.content,
          updated_at = NOW()`,
                params
            );

            results.batches++;

            // Afficher la progression
            console.log(`  Batch ${results.batches}: ${batchStart}-${batchEnd - 1} (${Math.round(batchEnd * 100 / count)}%)`);

        } catch (error) {
            console.error(`  Erreur sur le batch ${results.batches + 1}:`, error.message);
            results.failed += batchCount;
        }
    }

    results.totalTime = performance.now() - startTime;

    return results;
}

// Test 3: Insertion avec transaction (optimisation)
async function testTransactionInsertions(count, contentSizeKB = 1) {
    console.log(`\n=== Test 3: Insertion avec transaction (${count} enregistrements, ${contentSizeKB}KB chacun) ===`);

    const results = {
        totalTime: 0,
        successful: 0,
        failed: 0,
        totalSize: 0
    };

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const startTime = performance.now();

        for (let i = 0; i < count; i++) {
            try {
                const content = generateTestContent(contentSizeKB);
                const vector = generateFakeEmbedding(4096);
                const vectorStr = `[${vector.join(',')}]`;

                await client.query(
                    `INSERT INTO rag_store_v2 (
            id, project_path, file_path, chunk_index, total_chunks,
            content, content_type, role, file_extension, file_size_bytes,
            lines_count, language, vector, is_compressed, original_size_bytes,
            version, created_at, updated_at, indexed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::vector, $14, $15, 1, NOW(), NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            content = EXCLUDED.content,
            updated_at = NOW()`,
                    [
                        `test:file${i}.txt`,
                        '/test/project',
                        `/test/file${i}.txt`,
                        0,
                        1,
                        content,
                        'other',
                        'test',
                        'txt',
                        content.length,
                        content.split('\n').length,
                        null,
                        vectorStr,
                        false,
                        content.length
                    ]
                );

                results.successful++;
                results.totalSize += content.length;

                // Afficher la progression
                if ((i + 1) % Math.max(1, Math.floor(count / 10)) === 0) {
                    console.log(`  Progression: ${i + 1}/${count} (${Math.round((i + 1) * 100 / count)}%)`);
                }
            } catch (error) {
                console.error(`  Erreur sur l'enregistrement ${i}:`, error.message);
                results.failed++;
            }
        }

        await client.query('COMMIT');
        results.totalTime = performance.now() - startTime;

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('  Transaction annulée:', error.message);
        results.failed = count - results.successful;
    } finally {
        client.release();
    }

    return results;
}

// Test 4: Performance avec compression
async function testCompressionPerformance(count, contentSizeKB = 50) {
    console.log(`\n=== Test 4: Performance avec compression (${count} enregistrements, ${contentSizeKB}KB chacun) ===`);

    const results = {
        totalTime: 0,
        successful: 0,
        failed: 0,
        totalSize: 0,
        compressedSize: 0
    };

    const startTime = performance.now();

    for (let i = 0; i < count; i++) {
        try {
            const content = generateTestContent(contentSizeKB);
            const vector = generateFakeEmbedding(4096);
            const vectorStr = `[${vector.join(',')}]`;

            // Simuler la compression (stockage en base64 pour simuler la compression)
            const compressedContent = Buffer.from(content).toString('base64');
            const compressedSize = compressedContent.length;

            await pool.query(
                `INSERT INTO rag_store_v2 (
          id, project_path, file_path, chunk_index, total_chunks,
          content, content_type, role, file_extension, file_size_bytes,
          lines_count, language, vector, is_compressed, original_size_bytes,
          version, created_at, updated_at, indexed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::vector, $14, $15, 1, NOW(), NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          content = EXCLUDED.content,
          updated_at = NOW()`,
                [
                    `test:compressed${i}.txt`,
                    '/test/project',
                    `/test/compressed${i}.txt`,
                    0,
                    1,
                    compressedContent,
                    'other',
                    'test',
                    'txt',
                    compressedSize,
                    content.split('\n').length,
                    null,
                    vectorStr,
                    true,
                    content.length
                ]
            );

            results.successful++;
            results.totalSize += content.length;
            results.compressedSize += compressedSize;

            // Afficher la progression
            if ((i + 1) % Math.max(1, Math.floor(count / 10)) === 0) {
                console.log(`  Progression: ${i + 1}/${count} (${Math.round((i + 1) * 100 / count)}%)`);
            }
        } catch (error) {
            console.error(`  Erreur sur l'enregistrement ${i}:`, error.message);
            results.failed++;
        }
    }

    results.totalTime = performance.now() - startTime;

    return results;
}

// Fonction pour afficher les résultats
function displayResults(testName, results) {
    console.log(`\n📊 Résultats - ${testName}:`);
    console.log(`  Temps total: ${formatTime(results.totalTime)}`);
    console.log(`  Enregistrements: ${results.successful} réussis, ${results.failed} échoués`);
    console.log(`  Taille totale: ${formatSize(results.totalSize)}`);

    if (results.batches) {
        console.log(`  Batchs exécutés: ${results.batches}`);
    }

    if (results.compressedSize) {
        const compressionRatio = ((results.totalSize - results.compressedSize) * 100 / results.totalSize).toFixed(1);
        console.log(`  Taille compressée: ${formatSize(results.compressedSize)}`);
        console.log(`  Ratio de compression: ${compressionRatio}%`);
    }

    if (results.successful > 0) {
        const recordsPerSecond = (results.successful / (results.totalTime / 1000)).toFixed(2);
        const bytesPerSecond = (results.totalSize / (results.totalTime / 1000)).toFixed(2);
        console.log(`  Débit: ${recordsPerSecond} enregistrements/sec (${formatSize(bytesPerSecond)}/sec)`);
        console.log(`  Temps moyen par enregistrement: ${formatTime(results.totalTime / results.successful)}`);
    }
}

// Fonction principale
async function main() {
    console.log('🚀 Démarrage des tests de performance SQL');
    console.log('==========================================');

    try {
        // Vérifier la connexion
        await pool.query('SELECT 1');
        console.log('✅ Connexion PostgreSQL établie');

        // Nettoyer les données de test précédentes
        console.log('\n🧹 Nettoyage des données de test précédentes...');
        await pool.query("DELETE FROM rag_store_v2 WHERE project_path = '/test/project'");
        console.log('✅ Données de test nettoyées');

        // Test avec différents volumes
        const testConfigs = [
            { count: 100, sizeKB: 1, batchSize: 50 },
            { count: 500, sizeKB: 2, batchSize: 100 },
            { count: 1000, sizeKB: 5, batchSize: 200 },
        ];

        const allResults = [];

        for (const config of testConfigs) {
            console.log(`\n📈 Configuration: ${config.count} enregistrements de ${config.sizeKB}KB`);
            console.log('='.repeat(50));

            // Test 1: Insertion individuelle
            const result1 = await testIndividualInsertions(config.count, config.sizeKB);
            displayResults('Insertion individuelle', result1);
            allResults.push({ test: 'Individuelle', config, result: result1 });

            // Test 2: Insertion par batch
            const result2 = await testBatchInsertions(config.count, config.sizeKB, config.batchSize);
            displayResults('Insertion par batch', result2);
            allResults.push({ test: 'Batch', config, result: result2 });

            // Test 3: Insertion avec transaction
            const result3 = await testTransactionInsertions(config.count, config.sizeKB);
            displayResults('Insertion avec transaction', result3);
            allResults.push({ test: 'Transaction', config, result: result3 });

            // Nettoyer entre les tests
            await pool.query("DELETE FROM rag_store_v2 WHERE project_path = '/test/project'");
        }

        // Test 4: Performance avec compression (contenus volumineux)
        console.log('\n📦 Test avec compression (contenus volumineux)');
        console.log('='.repeat(50));
        const result4 = await testCompressionPerformance(50, 50); // 50 enregistrements de 50KB
        displayResults('Performance avec compression', result4);
        allResults.push({ test: 'Compression', config: { count: 50, sizeKB: 50 }, result: result4 });

        // Générer un rapport de synthèse
        console.log('\n📋 RAPPORT DE SYNTHÈSE');
        console.log('='.repeat(50));

        console.log('\nComparaison des performances:');
        console.log('┌─────────────────┬────────────┬────────────┬────────────┬────────────┐');
        console.log('│ Test            │ Enr./sec   │ Débit      │ Temps/enr  │ Succès     │');
        console.log('├─────────────────┼────────────┼────────────┼────────────┼────────────┤');

        for (const item of allResults) {
            if (item.result.successful > 0) {
                const recordsPerSecond = (item.result.successful / (item.result.totalTime / 1000)).toFixed(2);
                const bytesPerSecond = (item.result.totalSize / (item.result.totalTime / 1000)).toFixed(2);
                const avgTimePerRecord = formatTime(item.result.totalTime / item.result.successful);
                const successRate = ((item.result.successful / (item.result.successful + item.result.failed)) * 100).toFixed(1);

                console.log(`│ ${item.test.padEnd(15)} │ ${recordsPerSecond.padStart(10)} │ ${formatSize(bytesPerSecond).padStart(10)} │ ${avgTimePerRecord.padStart(10)} │ ${successRate}%`.padEnd(10) + ' │');
            } else {
                console.log(`│ ${item.test.padEnd(15)} │ ${'N/A'.padStart(10)} │ ${'N/A'.padStart(10)} │ ${'N/A'.padStart(10)} │ ${'0%'.padStart(10)} │`);
            }
        }

        console.log('└─────────────────┴────────────┴────────────┴────────────┴────────────┘');

        // Recommandations d'optimisation
        console.log('\n💡 RECOMMANDATIONS D\'OPTIMISATION:');
        console.log('='.repeat(50));

        // Analyser les résultats pour générer des recommandations
        const batchResults = allResults.filter(r => r.test === 'Batch');
        const individualResults = allResults.filter(r => r.test === 'Individuelle');
        const transactionResults = allResults.filter(r => r.test === 'Transaction');

        if (batchResults.length > 0 && individualResults.length > 0) {
            const batchAvg = batchResults.reduce((sum, r) => sum + (r.result.successful / (r.result.totalTime / 1000)), 0) / batchResults.length;
            const individualAvg = individualResults.reduce((sum, r) => sum + (r.result.successful / (r.result.totalTime / 1000)), 0) / individualResults.length;

            const improvement = ((batchAvg - individualAvg) / individualAvg * 100).toFixed(1);
            console.log(`✅ Batch insertion: ${improvement}% plus rapide que insertion individuelle`);
            console.log(`   → Recommandation: Utiliser batch size 100-200 pour ingestion massive`);
        }

        if (transactionResults.length > 0) {
            console.log(`✅ Transactions: Améliore la cohérence des données`);
            console.log(`   → Recommandation: Utiliser transactions pour ingestion critique`);
        }

        // Recommandations générales
        console.log('\n🔧 CONFIGURATION OPTIMALE:');
        console.log('   • Batch size: 100-200 enregistrements');
        console.log('   • Compression: Activer pour contenus > 10KB');
        console.log('   • Transactions: Pour ingestion critique');
        console.log('   • Index: Vérifier les indexes PostgreSQL régulièrement');
        console.log('   • Pool de connexions: 10-20 connexions maximum');

        // Nettoyer les données de test finales
        console.log('\n🧹 Nettoyage final des données de test...');
        await pool.query("DELETE FROM rag_store_v2 WHERE project_path = '/test/project'");
        console.log('✅ Données de test nettoyées');

    } catch (error) {
        console.error('❌ Erreur lors des tests:', error);
    } finally {
        // Fermer le pool de connexions
        await pool.end();
        console.log('\n🔌 Connexion PostgreSQL fermée');
    }
}

// Exécuter les tests
main().catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
});
