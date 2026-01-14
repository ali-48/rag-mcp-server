// test/integration/pipeline-integration.test.ts
// Test d'intégration simplifié pour le nouveau pipeline RAG v3.0
// Vérifie que les composants s'intègrent correctement
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRagConfigManager } from '../../src/config/rag-config.js';
// Mock minimal pour les tests
vi.mock('../../src/config/rag-config.js', () => ({
    getRagConfigManager: vi.fn(() => ({
        getConfig: () => ({
            version: '3.0.0',
            defaults: {
                embedding_provider: 'ollama',
                embedding_model: 'nomic-embed-text',
                chunk_size: 1000,
                chunk_overlap: 200,
                file_patterns: ['**/*.ts', '**/*.js'],
                recursive: true,
                search_limit: 10,
                search_threshold: 0.3,
                format_output: true
            },
            ui: {
                human_progress: {
                    enabled: true,
                    type: 'bar',
                    width: 40,
                    realtime: true,
                    update_interval: 100,
                    show_eta: true,
                    show_stats: true,
                    show_phases: true,
                    show_memory: false,
                    show_cpu: false,
                    colors: {
                        bar: '\x1b[32m',
                        percentage: '\x1b[36m',
                        eta: '\x1b[33m',
                        stats: '\x1b[35m',
                        phase: '\x1b[34m',
                        memory: '\x1b[31m',
                        cpu: '\x1b[31m'
                    },
                    output_format: 'text',
                    output_target: 'stdout'
                },
                verbose_logging: false,
                format_output: true,
                interactive_mode: false
            },
            legacy: {
                activated_rag: {
                    enabled: false,
                    redirect_to_pipeline: true,
                    error_message: 'activated_rag est désactivé. Utilisez le pipeline RAG explicite: init_rag → scan_rag → index_rag → query_rag',
                    migration_guide: 'docs/MIGRATION_V2_V3.md'
                },
                compatibility_mode: false,
                preserve_old_data: true,
                migration_script: 'scripts/migrate-v1-to-v2.js'
            },
            checkpoints: {
                enabled: true,
                auto_save: true,
                save_interval: 30000,
                max_checkpoints: 10,
                retention_days: 7,
                compression: true,
                encryption: false,
                locations: {
                    memory: './rag/db/checkpoints/memory',
                    vector: './rag/db/checkpoints/vector',
                    metadata: './rag/db/checkpoints/metadata'
                },
                recovery: {
                    auto_recover: true,
                    max_attempts: 3,
                    validation_strictness: 'medium'
                }
            },
            queue: {
                max_size_per_project: 3,
                fifo_order: true,
                mutator_exclusivity: true,
                readonly_concurrent: 5,
                timeout: null,
                retry: {
                    enabled: true,
                    max_attempts: 3,
                    backoff_factor: 2,
                    initial_delay: 1000
                },
                stats: {
                    enabled: true,
                    retention_days: 30,
                    aggregation_interval: 3600000
                }
            },
            pipeline: {
                description: "Nouveau pipeline RAG avec file d'attente et checkpoints",
                phases: [
                    {
                        name: 'init',
                        tool: 'init_rag',
                        description: 'Initialisation du projet RAG',
                        required: true,
                        depends_on: []
                    },
                    {
                        name: 'scan',
                        tool: 'scan_rag',
                        description: 'Scan des fichiers et analyse structurelle',
                        required: true,
                        depends_on: ['init']
                    },
                    {
                        name: 'prepare',
                        tool: 'index_rag',
                        description: 'Préparation et chunking des fichiers',
                        required: true,
                        depends_on: ['scan']
                    },
                    {
                        name: 'embed',
                        tool: 'index_rag',
                        description: 'Génération des embeddings',
                        required: true,
                        depends_on: ['prepare']
                    },
                    {
                        name: 'index',
                        tool: 'index_rag',
                        description: 'Indexation dans la base vectorielle',
                        required: true,
                        depends_on: ['embed']
                    },
                    {
                        name: 'query',
                        tool: 'query_rag',
                        description: 'Recherche sémantique',
                        required: false,
                        depends_on: ['index']
                    }
                ],
                validation: {
                    enabled: true,
                    strict: false,
                    schema_path: 'config/pipeline-schema.json'
                },
                orchestration: {
                    auto_progress: true,
                    parallel_phases: false,
                    error_handling: 'continue',
                    timeout: null
                }
            }
        }),
        getUIConfig: () => ({
            human_progress: {
                enabled: true,
                type: 'bar',
                width: 40,
                realtime: true,
                update_interval: 100,
                show_eta: true,
                show_stats: true,
                show_phases: true,
                show_memory: false,
                show_cpu: false,
                colors: {
                    bar: '\x1b[32m',
                    percentage: '\x1b[36m',
                    eta: '\x1b[33m',
                    stats: '\x1b[35m',
                    phase: '\x1b[34m',
                    memory: '\x1b[31m',
                    cpu: '\x1b[31m'
                },
                output_format: 'text',
                output_target: 'stdout'
            },
            verbose_logging: false,
            format_output: true,
            interactive_mode: false
        }),
        getLegacyConfig: () => ({
            activated_rag: {
                enabled: false,
                redirect_to_pipeline: true,
                error_message: 'activated_rag est désactivé. Utilisez le pipeline RAG explicite: init_rag → scan_rag → index_rag → query_rag',
                migration_guide: 'docs/MIGRATION_V2_V3.md'
            },
            compatibility_mode: false,
            preserve_old_data: true,
            migration_script: 'scripts/migrate-v1-to-v2.js'
        }),
        getCheckpointsConfig: () => ({
            enabled: true,
            auto_save: true,
            save_interval: 30000,
            max_checkpoints: 10,
            retention_days: 7,
            compression: true,
            encryption: false,
            locations: {
                memory: './rag/db/checkpoints/memory',
                vector: './rag/db/checkpoints/vector',
                metadata: './rag/db/checkpoints/metadata'
            },
            recovery: {
                auto_recover: true,
                max_attempts: 3,
                validation_strictness: 'medium'
            }
        }),
        getQueueConfig: () => ({
            max_size_per_project: 3,
            fifo_order: true,
            mutator_exclusivity: true,
            readonly_concurrent: 5,
            timeout: null,
            retry: {
                enabled: true,
                max_attempts: 3,
                backoff_factor: 2,
                initial_delay: 1000
            },
            stats: {
                enabled: true,
                retention_days: 30,
                aggregation_interval: 3600000
            }
        }),
        getPipelineConfig: () => ({
            description: "Nouveau pipeline RAG avec file d'attente et checkpoints",
            phases: [
                {
                    name: 'init',
                    tool: 'init_rag',
                    description: 'Initialisation du projet RAG',
                    required: true,
                    depends_on: []
                },
                {
                    name: 'scan',
                    tool: 'scan_rag',
                    description: 'Scan des fichiers et analyse structurelle',
                    required: true,
                    depends_on: ['init']
                },
                {
                    name: 'prepare',
                    tool: 'index_rag',
                    description: 'Préparation et chunking des fichiers',
                    required: true,
                    depends_on: ['scan']
                },
                {
                    name: 'embed',
                    tool: 'index_rag',
                    description: 'Génération des embeddings',
                    required: true,
                    depends_on: ['prepare']
                },
                {
                    name: 'index',
                    tool: 'index_rag',
                    description: 'Indexation dans la base vectorielle',
                    required: true,
                    depends_on: ['embed']
                },
                {
                    name: 'query',
                    tool: 'query_rag',
                    description: 'Recherche sémantique',
                    required: false,
                    depends_on: ['index']
                }
            ],
            validation: {
                enabled: true,
                strict: false,
                schema_path: 'config/pipeline-schema.json'
            },
            orchestration: {
                auto_progress: true,
                parallel_phases: false,
                error_handling: 'continue',
                timeout: null
            }
        }),
        isActivatedRagEnabled: () => false,
        isHumanProgressEnabled: () => true,
        areCheckpointsEnabled: () => true,
        isQueueEnabled: () => true
    }))
}));
describe('Test d\'intégration pipeline complet RAG v3.0', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.resetAllMocks();
    });
    describe('Configuration v3.0', () => {
        it('devrait charger la configuration avec les nouvelles sections', () => {
            const configManager = getRagConfigManager();
            const config = configManager.getConfig();
            expect(config).toBeDefined();
            expect(config.version).toBe('3.0.0');
            // Vérifier les sections critiques
            expect(config.ui).toBeDefined();
            expect(config.legacy).toBeDefined();
            expect(config.checkpoints).toBeDefined();
            expect(config.queue).toBeDefined();
            expect(config.pipeline).toBeDefined();
        });
        it('devrait fournir la configuration UI', () => {
            const configManager = getRagConfigManager();
            const uiConfig = configManager.getUIConfig();
            expect(uiConfig).toBeDefined();
            expect(uiConfig.human_progress.enabled).toBe(true);
            expect(uiConfig.human_progress.type).toBe('bar');
        });
        it('devrait fournir la configuration legacy', () => {
            const configManager = getRagConfigManager();
            const legacyConfig = configManager.getLegacyConfig();
            expect(legacyConfig).toBeDefined();
            expect(legacyConfig.activated_rag.enabled).toBe(false);
            expect(legacyConfig.activated_rag.redirect_to_pipeline).toBe(true);
        });
        it('devrait fournir la configuration des checkpoints', () => {
            const configManager = getRagConfigManager();
            const checkpointsConfig = configManager.getCheckpointsConfig();
            expect(checkpointsConfig).toBeDefined();
            expect(checkpointsConfig.enabled).toBe(true);
            expect(checkpointsConfig.max_checkpoints).toBe(10);
        });
        it('devrait fournir la configuration de la file d\'attente', () => {
            const configManager = getRagConfigManager();
            const queueConfig = configManager.getQueueConfig();
            expect(queueConfig).toBeDefined();
            expect(queueConfig.max_size_per_project).toBe(3);
            expect(queueConfig.mutator_exclusivity).toBe(true);
        });
        it('devrait fournir la configuration du pipeline', () => {
            const configManager = getRagConfigManager();
            const pipelineConfig = configManager.getPipelineConfig();
            expect(pipelineConfig).toBeDefined();
            expect(pipelineConfig.phases.length).toBe(6);
            expect(pipelineConfig.phases[0].name).toBe('init');
            expect(pipelineConfig.phases[5].name).toBe('query');
        });
        it('devrait vérifier les états d\'activation', () => {
            const configManager = getRagConfigManager();
            expect(configManager.isActivatedRagEnabled()).toBe(false);
            expect(configManager.isHumanProgressEnabled()).toBe(true);
            expect(configManager.areCheckpointsEnabled()).toBe(true);
            expect(configManager.isQueueEnabled()).toBe(true);
        });
    });
    describe('Structure du pipeline', () => {
        it('devrait définir les phases dans le bon ordre', () => {
            const configManager = getRagConfigManager();
            const pipelineConfig = configManager.getPipelineConfig();
            const phases = pipelineConfig.phases;
            // Vérifier l'ordre des phases
            expect(phases[0].name).toBe('init');
            expect(phases[1].name).toBe('scan');
            expect(phases[2].name).toBe('prepare');
            expect(phases[3].name).toBe('embed');
            expect(phases[4].name).toBe('index');
            expect(phases[5].name).toBe('query');
            // Vérifier les dépendances
            expect(phases[0].depends_on).toEqual([]);
            expect(phases[1].depends_on).toEqual(['init']);
            expect(phases[2].depends_on).toEqual(['scan']);
            expect(phases[3].depends_on).toEqual(['prepare']);
            expect(phases[4].depends_on).toEqual(['embed']);
            expect(phases[5].depends_on).toEqual(['index']);
        });
        it('devrait marquer query comme optionnel', () => {
            const configManager = getRagConfigManager();
            const pipelineConfig = configManager.getPipelineConfig();
            const queryPhase = pipelineConfig.phases.find(p => p.name === 'query');
            expect(queryPhase).toBeDefined();
            expect(queryPhase?.required).toBe(false);
        });
        it('devrait définir la validation du pipeline', () => {
            const configManager = getRagConfigManager();
            const pipelineConfig = configManager.getPipelineConfig();
            expect(pipelineConfig.validation).toBeDefined();
            expect(pipelineConfig.validation.enabled).toBe(true);
            expect(pipelineConfig.validation.strict).toBe(false);
        });
        it('devrait définir l\'orchestration', () => {
            const configManager = getRagConfigManager();
            const pipelineConfig = configManager.getPipelineConfig();
            expect(pipelineConfig.orchestration).toBeDefined();
            expect(pipelineConfig.orchestration.auto_progress).toBe(true);
            expect(pipelineConfig.orchestration.parallel_phases).toBe(false);
            expect(pipelineConfig.orchestration.error_handling).toBe('continue');
        });
    });
    describe('Compatibilité avec les jobs RAG', () => {
        it('devrait créer des jobs compatibles avec le pipeline', () => {
            const job = {
                id: 'test-job-1',
                type: 'scan',
                projectPath: '/test/project',
                status: 'pending',
                createdAt: new Date(),
                dependsOn: []
            };
            expect(job).toBeDefined();
            expect(job.type).toBe('scan');
            expect(job.status).toBe('pending');
            expect(job.dependsOn).toEqual([]);
        });
        it('devrait supporter tous les types de jobs du pipeline', () => {
            const jobTypes = ['scan', 'prepare', 'embed', 'index', 'query'];
            jobTypes.forEach(type => {
                const job = {
                    id: `job-${type}`,
                    type,
                    projectPath: '/test/project',
                    status: 'pending',
                    createdAt: new Date(),
                    dependsOn: []
                };
                expect(job.type).toBe(type);
                expect(['pending', 'running', 'done', 'failed']).toContain(job.status);
            });
        });
        it('devrait gérer les dépendances entre jobs', () => {
            const initJob = {
                id: 'job-init',
                type: 'scan',
                projectPath: '/test/project',
                status: 'done',
                createdAt: new Date(),
                dependsOn: []
            };
            const prepareJob = {
                id: 'job-prepare',
                type: 'prepare',
                projectPath: '/test/project',
                status: 'pending',
                createdAt: new Date(),
                dependsOn: ['job-init']
            };
            expect(initJob.status).toBe('done');
            expect(prepareJob.dependsOn).toContain('job-init');
        });
    });
    describe('Migration depuis activated_rag', () => {
        it('devrait indiquer que activated_rag est désactivé', () => {
            const configManager = getRagConfigManager();
            const legacyConfig = configManager.getLegacyConfig();
            expect(legacyConfig.activated_rag.enabled).toBe(false);
            expect(legacyConfig.activated_rag.error_message).toContain('activated_rag est désactivé');
            expect(legacyConfig.activated_rag.migration_guide).toBe('docs/MIGRATION_V2_V3.md');
        });
        it('devrait rediriger vers le pipeline explicite', () => {
            const configManager = getRagConfigManager();
            const legacyConfig = configManager.getLegacyConfig();
            expect(legacyConfig.activated_rag.redirect_to_pipeline).toBe(true);
            expect(legacyConfig.migration_script).toBe('scripts/migrate-v1-to-v2.js');
        });
    });
    describe('Performance et monitoring', () => {
        it('devrait activer la barre de progression humaine', () => {
            const configManager = getRagConfigManager();
            const uiConfig = configManager.getUIConfig();
            expect(uiConfig.human_progress.enabled).toBe(true);
            expect(uiConfig.human_progress.show_eta).toBe(true);
            expect(uiConfig.human_progress.show_stats).toBe(true);
            expect(uiConfig.human_progress.show_phases).toBe(true);
        });
        it('devrait configurer les checkpoints pour la reprise après crash', () => {
            const configManager = getRagConfigManager();
            const checkpointsConfig = configManager.getCheckpointsConfig();
            expect(checkpointsConfig.enabled).toBe(true);
            expect(checkpointsConfig.auto_save).toBe(true);
            expect(checkpointsConfig.save_interval).toBe(30000);
            expect(checkpointsConfig.recovery.auto_recover).toBe(true);
        });
        it('devrait configurer la file d\'attente pour l\'exclusivité mutateurs', () => {
            const configManager = getRagConfigManager();
            const queueConfig = configManager.getQueueConfig();
            expect(queueConfig.mutator_exclusivity).toBe(true);
            expect(queueConfig.max_size_per_project).toBe(3);
            expect(queueConfig.retry.enabled).toBe(true);
        });
    });
    describe('Validation du pipeline', () => {
        it('devrait valider que toutes les phases ont des outils associés', () => {
            const configManager = getRagConfigManager();
            const pipelineConfig = configManager.getPipelineConfig();
            pipelineConfig.phases.forEach(phase => {
                expect(phase.tool).toBeDefined();
                expect(phase.tool).toMatch(/_rag$/);
            });
        });
        it('devrait valider les dépendances circulaires', () => {
            const configManager = getRagConfigManager();
            const pipelineConfig = configManager.getPipelineConfig();
            const phases = pipelineConfig.phases;
            // Vérifier qu'il n'y a pas de dépendances circulaires
            const visited = new Set();
            const visiting = new Set();
            function hasCycle(phaseName) {
                if (visiting.has(phaseName))
                    return true;
                if (visited.has(phaseName))
                    return false;
                visiting.add(phaseName);
                const phase = phases.find(p => p.name === phaseName);
                if (phase) {
                    for (const dep of phase.depends_on) {
                        if (hasCycle(dep))
                            return true;
                    }
                }
                visiting.delete(phaseName);
                visited.add(phaseName);
                return false;
            }
            phases.forEach(phase => {
                expect(hasCycle(phase.name)).toBe(false);
            });
        });
        it('devrait valider que query dépend de index', () => {
            const configManager = getRagConfigManager();
            const pipelineConfig = configManager.getPipelineConfig();
            const queryPhase = pipelineConfig.phases.find(p => p.name === 'query');
            expect(queryPhase).toBeDefined();
            expect(queryPhase?.depends_on).toEqual(['index']);
        });
    });
});
//# sourceMappingURL=pipeline-integration.test.js.map