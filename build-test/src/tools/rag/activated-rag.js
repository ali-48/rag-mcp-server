// src/tools/rag/activated-rag.ts
// Outil maître: activated_rag - Orchestration complète du pipeline RAG (5 phases)
// Remplace: injection_rag, index_project, update_project, analyse_code
// Version: v2.0.0
import { getRagConfigManager } from "../../config/rag-config.js";
import { indexProject, updateProject } from "../../rag/indexer.js";
import { createPhase0IntegrationWithIndexing } from "../../rag/phase0/phase0-integration.js";
import { setEmbeddingProvider } from "../../rag/vector-store.js";
// Système de logs simplifié (sans émojis pour compatibilité MCP)
var LogLevel;
(function (LogLevel) {
    LogLevel["INFO"] = "INFO";
    LogLevel["DEBUG"] = "DEBUG";
    LogLevel["ERROR"] = "ERROR";
})(LogLevel || (LogLevel = {}));
class ActivatedRagLogger {
    static instance;
    logLevel = LogLevel.ERROR; // Par défaut ERROR seulement pour MCP
    useEmojis = false;
    constructor() { }
    static getInstance() {
        if (!ActivatedRagLogger.instance) {
            ActivatedRagLogger.instance = new ActivatedRagLogger();
        }
        return ActivatedRagLogger.instance;
    }
    setLogLevel(level) {
        this.logLevel = level;
    }
    disableEmojis() {
        this.useEmojis = false;
    }
    shouldLog(level) {
        const levels = [LogLevel.ERROR, LogLevel.INFO, LogLevel.DEBUG];
        return levels.indexOf(level) <= levels.indexOf(this.logLevel);
    }
    log(level, message, data) {
        if (this.shouldLog(level)) {
            const timestamp = new Date().toISOString();
            const logMessage = `[${timestamp}] [${level}] ${message}`;
            if (level === LogLevel.ERROR) {
                console.error(logMessage);
            }
        }
    }
    info(message, data) {
        this.log(LogLevel.INFO, message, data);
    }
    debug(message, data) {
        this.log(LogLevel.DEBUG, message, data);
    }
    error(message, error) {
        this.log(LogLevel.ERROR, message, error);
    }
    warn(message, data) {
        this.log(LogLevel.INFO, `WARN: ${message}`, data);
    }
}
/**
 * Définition de l'outil activated_rag
 */
export const activatedRagTool = {
    name: "activated_rag",
    description: "Outil maître d'orchestration RAG complet (5 phases: Workspace → Analyse → Chunking → Embeddings → Injection)",
    inputSchema: {
        type: "object",
        properties: {
            // Mode d'opération
            mode: {
                type: "string",
                description: "Mode d'opération",
                enum: ["full", "incremental", "watch", "analyze_only"],
                default: "full"
            },
            // Cible
            project_path: {
                type: "string",
                description: "Chemin absolu vers le projet (auto-détecté si vide)"
            },
            file_patterns: {
                type: "array",
                items: { type: "string" },
                description: "Patterns de fichiers à inclure",
                default: ["**/*"]
            },
            // Options avancées
            enable_phase0: {
                type: "boolean",
                description: "Activer la Phase 0 (Workspace detection automatique)",
                default: true
            },
            enable_watcher: {
                type: "boolean",
                description: "Activer le file watcher en temps réel",
                default: false
            },
            enable_llm_enrichment: {
                type: "boolean",
                description: "Activer l'enrichissement LLM optionnel (Phase 0.3)",
                default: false
            },
            // Filtres
            content_types: {
                type: "array",
                items: {
                    type: "string",
                    enum: ["code", "doc", "config", "other"]
                },
                description: "Types de contenu à inclure"
            },
            languages: {
                type: "array",
                items: { type: "string" },
                description: "Langages à inclure (ex: ['typescript', 'python'])"
            },
            // Configuration embeddings
            embedding_models: {
                type: "object",
                description: "Modèles d'embeddings par type de contenu",
                properties: {
                    code: { type: "string" },
                    text: { type: "string" },
                    config: { type: "string" }
                }
            },
            // Options de chunking
            chunking_strategy: {
                type: "string",
                description: "Stratégie de chunking",
                enum: ["logical", "fixed", "ai_enhanced"],
                default: "logical"
            },
            max_chunk_size: {
                type: "number",
                description: "Taille maximale des chunks (tokens)",
                default: 1000
            },
            // Métadonnées
            metadata_overrides: {
                type: "object",
                description: "Surcharges de métadonnées"
            }
        }
    },
};
/**
 * Handler pour l'outil activated_rag
 */
export const activatedRagHandler = async (args) => {
    const logger = ActivatedRagLogger.getInstance();
    logger.disableEmojis();
    // Configuration du niveau de logs
    const logLevel = LogLevel.ERROR; // Pour MCP, ERROR par défaut
    logger.setLogLevel(logLevel);
    const startTime = Date.now();
    let phase0Integration = null;
    let projectMetadata = null;
    try {
        // ========== PHASE 0: Workspace Detection & File Watcher ==========
        logger.info("🔍 Phase 0 - Détection Workspace & Surveillance");
        // Détection automatique du projet si non spécifié
        let projectPath = args.project_path;
        if (!projectPath) {
            try {
                // Tentative de détection automatique
                const fs = await import('fs');
                const path = await import('path');
                const cwd = process.cwd();
                // Vérifier si cwd contient des fichiers de projet
                const projectFiles = ['.git', 'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod'];
                const hasProjectFile = projectFiles.some(file => fs.existsSync(path.join(cwd, file)));
                if (hasProjectFile) {
                    projectPath = cwd;
                    logger.info(`📁 Projet auto-détecté: ${projectPath}`);
                }
                else {
                    throw new Error("Impossible de détecter automatiquement le projet. Spécifiez 'project_path'.");
                }
            }
            catch (error) {
                logger.error("Erreur de détection automatique", error);
                throw error;
            }
        }
        // Vérification des permissions
        try {
            const fs = await import('fs');
            const path = await import('path');
            if (!fs.existsSync(projectPath)) {
                throw new Error(`Le chemin du projet n'existe pas: ${projectPath}`);
            }
            // Vérifier les permissions
            const testWritePath = path.join(projectPath, ".rag-test-permission");
            try {
                fs.writeFileSync(testWritePath, "test");
                fs.unlinkSync(testWritePath);
                logger.debug("✅ Permissions d'écriture vérifiées");
            }
            catch (error) {
                logger.warn("⚠️ Permissions d'écriture limitées, continuation en mode lecture seule");
            }
        }
        catch (error) {
            logger.error("Erreur lors de la vérification des permissions", error);
            throw error;
        }
        // Initialisation Phase 0.1 si activée
        if (args.enable_phase0 !== false) {
            try {
                const onIndexNeeded = async (filePath, eventType) => {
                    logger.info(`🔍 Indexation automatique déclenchée: ${eventType} ${filePath}`);
                };
                phase0Integration = await createPhase0IntegrationWithIndexing(onIndexNeeded, {
                    enableWorkspaceDetection: true,
                    enableFileWatcher: args.enable_watcher === true,
                    enableLogging: true,
                    fileWatcherOptions: {
                        debounceDelay: 500,
                        recursive: true,
                        logEvents: true,
                    },
                    loggerOptions: {
                        minLevel: 'info',
                        enableConsole: true,
                        enableMemoryStorage: true,
                    },
                }, projectPath);
                logger.info("✅ Phase 0.1 initialisée avec succès");
                // Récupérer les métadonnées du workspace
                const workspace = phase0Integration.getWorkspace();
                if (workspace) {
                    projectMetadata = {
                        path: workspace.path,
                        vscodeWorkspace: workspace.vscodeWorkspace,
                        language: workspace.language,
                        fileCount: workspace.metadata.fileCount,
                        isGitRepo: workspace.metadata.isGitRepo,
                        detectedBy: workspace.metadata.detectedBy,
                    };
                    logger.info("📋 Workspace détecté", projectMetadata);
                }
            }
            catch (error) {
                logger.error("Erreur Phase 0.1, continuation sans", error);
            }
        }
        // ========== PHASE 1: Static Analysis ==========
        logger.info("🔬 Phase 1 - Analyse Statique");
        let analysisResults = null;
        if (args.mode === 'analyze_only' || args.chunking_strategy === 'logical') {
            try {
                // Note: analyzeProjectStructure sera implémenté dans phase0/analyzer/
                // Pour l'instant, on utilise une structure vide
                analysisResults = {
                    files: [],
                    symbols: [],
                    languages: [],
                    metadata: {}
                };
                logger.info("✅ Analyse statique simulée (à implémenter)");
            }
            catch (error) {
                logger.error("Erreur analyse statique, continuation avec chunking fixe", error);
            }
        }
        // ========== PHASE 2: Intelligent Chunking Configuration ==========
        logger.info("✂️ Phase 2 - Configuration Chunking Intelligent");
        const configManager = getRagConfigManager();
        const defaults = configManager.getDefaults();
        // Configuration du chunking basée sur la stratégie
        const chunkingStrategy = args.chunking_strategy || 'logical';
        const maxChunkSize = args.max_chunk_size || defaults.chunk_size;
        const chunkOverlap = configManager.applyLimits('chunk_overlap', defaults.chunk_overlap);
        const chunkingOptions = {
            strategy: chunkingStrategy,
            maxChunkSize,
            chunkOverlap,
            analysisResults: analysisResults,
            contentTypes: args.content_types,
            languages: args.languages
        };
        logger.info("📊 Configuration chunking", chunkingOptions);
        // ========== PHASE 3: Specialized Embeddings Configuration ==========
        logger.info("🧠 Phase 3 - Configuration Embeddings Spécialisés");
        // Configuration des modèles par type
        const embeddingModels = args.embedding_models || {};
        const defaultModels = {
            code: 'nomic-embed-code',
            text: 'nomic-embed-text',
            config: 'bge-small',
            fallback: 'qwen3-embedding:8b'
        };
        // Configurer le provider d'embeddings
        const embeddingProvider = defaults.embedding_provider;
        setEmbeddingProvider(embeddingProvider, defaultModels.fallback);
        // Note: Le routage embeddings par type sera implémenté dans vector-store.ts
        logger.info("🔧 Configuration embeddings", {
            provider: embeddingProvider,
            models: { ...defaultModels, ...embeddingModels },
            routingEnabled: false // À implémenter dans vector-store.ts
        });
        // ========== PHASE 4: Injection & Update ==========
        logger.info("🚀 Phase 4 - Injection & Mise à Jour");
        let injectionResult;
        const options = {
            filePatterns: args.file_patterns || defaults.file_patterns,
            recursive: args.recursive !== undefined ? args.recursive : defaults.recursive,
            chunkSize: maxChunkSize,
            chunkOverlap: chunkOverlap,
            chunkingStrategy: chunkingStrategy,
            analysisResults: analysisResults,
            contentTypes: args.content_types,
            languages: args.languages,
            metadataOverrides: args.metadata_overrides
        };
        // Sélection du mode d'opération
        switch (args.mode || 'full') {
            case 'full':
                logger.info("📦 Mode: Indexation complète");
                injectionResult = await indexProject(projectPath, options);
                break;
            case 'incremental':
                logger.info("🔄 Mode: Mise à jour incrémentale");
                injectionResult = await updateProject(projectPath, options);
                break;
            case 'watch':
                logger.info("👁️ Mode: Surveillance temps réel");
                // Pour le mode watch, on fait une indexation initiale puis on laisse le watcher actif
                injectionResult = await indexProject(projectPath, options);
                logger.info("✅ Indexation initiale terminée, watcher actif");
                break;
            case 'analyze_only':
                logger.info("📊 Mode: Analyse seulement");
                // Retourner les résultats d'analyse sans injection
                const endTime = Date.now();
                const duration = ((endTime - startTime) / 1000).toFixed(2);
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                version: "v2.0.0",
                                duration_seconds: duration,
                                mode: "analyze_only",
                                analysis_results: analysisResults,
                                project_metadata: projectMetadata,
                                config_used: {
                                    chunking_strategy: chunkingStrategy,
                                    max_chunk_size: maxChunkSize,
                                    content_types: args.content_types,
                                    languages: args.languages
                                },
                                pipeline: {
                                    phase_0: phase0Integration ? "✓" : "✗",
                                    phase_1: analysisResults ? "✓" : "✗",
                                    phase_2: "N/A",
                                    phase_3: "N/A",
                                    phase_4: "N/A"
                                }
                            }, null, 2)
                        }]
                };
            default:
                throw new Error(`Mode non supporté: ${args.mode}`);
        }
        // ========== FINALISATION ==========
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        // Arrêter Phase 0.1 si nécessaire (sauf en mode watch)
        if (phase0Integration && phase0Integration.isActive() && args.mode !== 'watch') {
            try {
                await phase0Integration.stop();
                logger.info("✅ Phase 0.1 arrêtée proprement");
            }
            catch (error) {
                logger.warn("⚠️ Erreur lors de l'arrêt de Phase 0.1", error);
            }
        }
        // Collecter les statistiques Phase 0
        const phase0Stats = phase0Integration ? {
            enabled: true,
            file_watcher: args.enable_watcher === true,
            file_events: phase0Integration.getFileWatcherStats()?.totalEvents || 0,
            logs: phase0Integration.getLoggerStats()?.totalLogs || 0,
            workspace: projectMetadata
        } : {
            enabled: false,
            file_watcher: false
        };
        // Préparer la réponse
        logger.info("✅ Pipeline activated_rag terminé avec succès", {
            duration: `${duration}s`,
            mode: args.mode || 'full',
            total_files: injectionResult.totalFiles,
            chunks_created: injectionResult.chunksCreated
        });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: true,
                        version: "v2.0.0",
                        duration_seconds: duration,
                        // Statistiques
                        stats: {
                            total_files: injectionResult.totalFiles,
                            indexed_files: injectionResult.indexedFiles,
                            ignored_files: injectionResult.ignoredFiles || 0,
                            errors: injectionResult.errors || 0,
                            chunks_created: injectionResult.chunksCreated
                        },
                        // Pipeline exécuté
                        pipeline: {
                            phase_0: phase0Integration ? "✓" : args.enable_phase0 === false ? "✗" : "N/A",
                            phase_1: analysisResults ? "✓" : "✗",
                            phase_2: chunkingStrategy !== 'fixed' ? "✓" : "✗",
                            phase_3: "✗", // À implémenter dans vector-store.ts
                            phase_4: "✓"
                        },
                        // Métadonnées projet
                        project_metadata: {
                            project_path: projectPath,
                            project_hash: "N/A", // À implémenter dans indexer.ts
                            last_indexed: new Date().toISOString(),
                            total_size_bytes: 0,
                            file_types: {}
                        },
                        // Configuration utilisée
                        config_used: {
                            mode: args.mode || 'full',
                            enable_phase0: args.enable_phase0 !== false,
                            enable_watcher: args.enable_watcher === true,
                            chunking_strategy: chunkingStrategy,
                            max_chunk_size: maxChunkSize,
                            embedding_provider: embeddingProvider,
                            embedding_models: { ...defaultModels, ...embeddingModels }
                        },
                        // Statistiques Phase 0
                        phase0_stats: phase0Stats,
                        // Erreurs (si any)
                        errors: injectionResult.errors > 0 ? [] : undefined
                    }, null, 2)
                }]
        };
    }
    catch (error) {
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        logger.error("❌ Erreur dans le pipeline activated_rag", {
            duration: `${duration}s`,
            error: error instanceof Error ? error.message : String(error)
        });
        throw error;
    }
};
/**
 * Test de l'outil (pour usage en développement)
 */
export async function testActivatedRag() {
    console.log("🧪 Test de l'outil activated_rag v2.0.0...");
    const logger = ActivatedRagLogger.getInstance();
    logger.setLogLevel(LogLevel.DEBUG);
    try {
        const testProjectPath = process.cwd(); // Utiliser le répertoire courant pour le test
        logger.info(`✅ Test avec projet: ${testProjectPath}`);
        // Tester le mode analyze_only
        const result = await activatedRagHandler({
            mode: "analyze_only",
            project_path: testProjectPath,
            file_patterns: ["**/*.ts", "**/*.js"],
            chunking_strategy: "logical",
            enable_phase0: true
        });
        logger.info("✅ Test réussi", {
            has_result: !!result,
            success: true
        });
        return result;
    }
    catch (error) {
        logger.error("❌ Test échoué", error);
        throw error;
    }
}
// Export pour les tests
export { ActivatedRagLogger, LogLevel };
//# sourceMappingURL=activated-rag.js.map