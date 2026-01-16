import { injectionRagHandler } from './build/tools/rag/injection-rag.js';

async function testInjection() {
    try {
        console.log('🧪 Test de injection_rag avec fournisseur fake...');

        const result = await injectionRagHandler({
            project_path: '/home/ali/Documents/Cline/MCP/rag-mcp-server',
            file_patterns: ['**/*.js', '**/*.ts', '**/*.json'],
            recursive: true,
            log_level: 'INFO',
            enable_graph_integration: false
        });

        console.log('✅ Résultat:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('❌ Erreur:', error);
    }
}

testInjection();
