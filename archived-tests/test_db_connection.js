import { Pool } from 'pg';

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

async function testConnection() {
    try {
        const client = await pool.connect();
        console.log('✅ Connexion à la base de données réussie');

        const result = await client.query('SELECT 1 as test');
        console.log('✅ Requête test réussie:', result.rows[0]);

        // Vérifier si la table rag_store_v2 existe
        const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'rag_store_v2'
      )
    `);

        console.log('✅ Table rag_store_v2 existe:', tableCheck.rows[0].exists);

        client.release();
        await pool.end();
    } catch (error) {
        console.error('❌ Erreur de connexion:', error);
    }
}

testConnection();
