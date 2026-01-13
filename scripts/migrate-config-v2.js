#!/usr/bin/env node

/**
 * Script de migration de la configuration RAG v1.0.0 vers v2.0.0
 * 
 * Ce script migre l'ancienne configuration vers la nouvelle structure
 * tout en préservant les paramètres personnalisés de l'utilisateur.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chemins des fichiers
const OLD_CONFIG_PATH = path.join(__dirname, '..', 'config', 'rag-config.json');
const NEW_CONFIG_PATH = path.join(__dirname, '..', 'config', 'rag-config-v2.json');
const BACKUP_PATH = path.join(__dirname, '..', 'config', 'rag-config.json.backup');

console.log('🔧 Migration de la configuration RAG v1.0.0 vers v2.0.0');
console.log('════════════════════════════════════════════════════════');

// Vérifier si l'ancienne configuration existe
if (!fs.existsSync(OLD_CONFIG_PATH)) {
    console.error('❌ Fichier de configuration v1.0.0 non trouvé:', OLD_CONFIG_PATH);
    process.exit(1);
}

// Vérifier si la nouvelle configuration existe
if (!fs.existsSync(NEW_CONFIG_PATH)) {
    console.error('❌ Fichier de configuration v2.0.0 non trouvé:', NEW_CONFIG_PATH);
    process.exit(1);
}

try {
    // Lire les configurations
    const oldConfig = JSON.parse(fs.readFileSync(OLD_CONFIG_PATH, 'utf8'));
    const newConfig = JSON.parse(fs.readFileSync(NEW_CONFIG_PATH, 'utf8'));

    console.log('📋 Configuration v1.0.0 détectée:');
    console.log(`   Version: ${oldConfig.version}`);
    console.log(`   Dernière mise à jour: ${oldConfig.last_updated}`);
    console.log();

    // Créer une sauvegarde de l'ancienne configuration
    fs.copyFileSync(OLD_CONFIG_PATH, BACKUP_PATH);
    console.log(`✅ Sauvegarde créée: ${BACKUP_PATH}`);

    // Fusionner les configurations
    console.log('🔄 Fusion des configurations...');

    // 1. Préserver les paramètres personnalisés de l'utilisateur
    const mergedConfig = { ...newConfig };

    // 2. Migrer les paramètres par défaut
    if (oldConfig.defaults) {
        mergedConfig.defaults = {
            ...mergedConfig.defaults,
            ...oldConfig.defaults
        };
        console.log('   ✓ Paramètres par défaut migrés');
    }

    // 3. Migrer les fournisseurs d'embeddings
    if (oldConfig.providers) {
        mergedConfig.embedding_models.providers = {
            ...mergedConfig.embedding_models.providers,
            ...oldConfig.providers
        };
        console.log('   ✓ Fournisseurs d\'embeddings migrés');
    }

    // 4. Migrer les fournisseurs LLM
    if (oldConfig.llm_providers) {
        // Conserver les fournisseurs LLM dans la nouvelle structure
        mergedConfig.phase0.components.llm_enrichment = {
            ...mergedConfig.phase0.components.llm_enrichment,
            provider: oldConfig.llm_providers.ollama?.provider || 'ollama',
            model: oldConfig.llm_providers.ollama?.default_model || 'llama3.1:latest',
            temperature: oldConfig.llm_providers.ollama?.temperature || 0.1,
            max_tokens: oldConfig.llm_providers.ollama?.max_tokens || 1000,
            timeout_ms: oldConfig.llm_providers.ollama?.timeout_ms || 30000
        };
        console.log('   ✓ Fournisseurs LLM migrés');
    }

    // 5. Migrer la préparation LLM
    if (oldConfig.preparation) {
        mergedConfig.phase0.components.llm_enrichment.enabled = oldConfig.preparation.enable_llm_analysis || false;
        mergedConfig.phase0.components.llm_enrichment.cache_enabled = oldConfig.preparation.cache_enabled || true;
        mergedConfig.phase0.components.llm_enrichment.cache_ttl_seconds = oldConfig.preparation.cache_ttl_seconds || 3600;
        mergedConfig.phase0.components.llm_enrichment.batch_size = oldConfig.preparation.batch_size || 5;
        console.log('   ✓ Configuration de préparation migrée');
    }

    // 6. Migrer Phase 0.3
    if (oldConfig.phase0_3) {
        mergedConfig.phase0.components.llm_enrichment = {
            ...mergedConfig.phase0.components.llm_enrichment,
            ...oldConfig.phase0_3
        };
        console.log('   ✓ Configuration Phase 0.3 migrée');
    }

    // 7. Migrer les limites
    if (oldConfig.limits) {
        mergedConfig.limits = {
            ...mergedConfig.limits,
            ...oldConfig.limits
        };
        console.log('   ✓ Limites migrées');
    }

    // 8. Migrer la gestion des fichiers
    if (oldConfig.file_handling) {
        mergedConfig.file_handling = {
            ...mergedConfig.file_handling,
            ...oldConfig.file_handling
        };
        console.log('   ✓ Gestion des fichiers migrée');
    }

    // 9. Migrer l'indexation
    if (oldConfig.indexing) {
        mergedConfig.indexing = {
            ...mergedConfig.indexing,
            ...oldConfig.indexing
        };
        console.log('   ✓ Configuration d\'indexation migrée');
    }

    // 10. Migrer la recherche
    if (oldConfig.search) {
        mergedConfig.search = {
            ...mergedConfig.search,
            ...oldConfig.search
        };
        console.log('   ✓ Configuration de recherche migrée');
    }

    // 11. Migrer les environnements
    if (oldConfig.environments) {
        mergedConfig.environments = {
            ...mergedConfig.environments,
            ...oldConfig.environments
        };
        console.log('   ✓ Environnements migrés');
    }

    // 12. Mettre à jour les métadonnées de migration
    mergedConfig.migration = {
        ...mergedConfig.migration,
        migrated_from: oldConfig.version,
        migrated_at: new Date().toISOString(),
        backup_location: BACKUP_PATH
    };

    // 13. Écrire la configuration fusionnée
    const mergedConfigPath = path.join(__dirname, '..', 'config', 'rag-config.json');
    fs.writeFileSync(
        mergedConfigPath,
        JSON.stringify(mergedConfig, null, 2),
        'utf8'
    );

    console.log();
    console.log('✅ Migration terminée avec succès !');
    console.log('════════════════════════════════════════════════════════');
    console.log('📊 Résumé de la migration:');
    console.log(`   Nouveau fichier: ${mergedConfigPath}`);
    console.log(`   Version: ${mergedConfig.version}`);
    console.log(`   Outils exposés: ${mergedConfig.system.exposed_tools.join(', ')}`);
    console.log(`   Mode legacy: ${mergedConfig.system.legacy_mode ? 'activé' : 'désactivé'}`);
    console.log(`   Phase 0: ${mergedConfig.phase0.enabled ? 'activée' : 'désactivée'}`);
    console.log();
    console.log('📋 Actions recommandées après migration:');
    console.log('   1. Vérifier la nouvelle configuration dans config/rag-config.json');
    console.log('   2. Tester les nouveaux outils: activated_rag et recherche_rag');
    console.log('   3. Vérifier la rétrocompatibilité avec les anciens outils');
    console.log('   4. Supprimer l\'ancienne sauvegarde si tout fonctionne correctement');
    console.log();
    console.log('⚠️  Note: L\'ancienne configuration a été sauvegardée dans:');
    console.log(`   ${BACKUP_PATH}`);

} catch (error) {
    console.error('❌ Erreur lors de la migration:', error.message);
    console.error(error.stack);
    process.exit(1);
}
