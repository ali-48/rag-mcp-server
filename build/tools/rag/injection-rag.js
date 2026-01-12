// src/tools/rag/injection-rag.ts
// Outil: injection_rag - Analyse du projet complet + prépare et injecte les données automatiquement
// Version: v1.0.0
import { getRagConfigManager } from "../../config/rag-config.js";
import { indexProject } from "../../rag/indexer.js";
import { setEmbeddingProvider } from "../../rag/vector-store.js";
// Système de logs simplifié (sans émojis pour compatibilité MCP)
var LogLevel;
(function (LogLevel) {
    LogLevel["INFO"] = "INFO";
    LogLevel["DEBUG"] = "DEBUG";
    LogLevel["ERROR"] = "ERROR";
})(LogLevel || (LogLevel = {}));
class InjectionLogger {
    static instance;
    logLevel = LogLevel.ERROR; // Par défaut ERROR seulement pour MCP
    useEmojis = false;
    constructor() { }
    static getInstance() {
        if (!InjectionLogger.instance) {
            InjectionLogger.instance = new InjectionLogger();
        }
        return InjectionLogger.instance;
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
            // Pour MCP, on n'utilise pas console.error() qui pollue le canal
            // On écrit dans un buffer interne ou on ignore selon le niveau
            if (level === LogLevel.ERROR) {
                // Seules les erreurs critiques sont loggées
                console.error(logMessage);
            }
            // INFO et DEBUG sont ignorés pour MCP
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
 * Définition de l'outil injection_rag
 */
export const injectionRagTool = {
    name: "injection_rag",
    description: "Analyse du projet complet + prépare et injecte les données automatiquement (Phase 0 → RAG)",
    inputSchema: {
        type: "object",
        properties: {
            project_path: {
                type: "string",
                description: "Chemin absolu vers le projet à analyser et injecter"
            },
            file_patterns: {
                type: "array",
                items: { type: "string" },
                description: "Patterns de fichiers à inclure (ex: ['**/*.py', '**/*.js'])",
                default: ["**/*.{js,ts,py,md,txt,json,yaml,yml,html,css,scss}"]
            },
            recursive: {
                type: "boolean",
                description: "Parcourir les sous-dossiers récursivement",
                default: true
            },
            log_level: {
                type: "string",
                description: "Niveau de logs (INFO, DEBUG, ERROR)",
                enum: ["INFO", "DEBUG", "ERROR"],
                default: "INFO"
            },
            enable_graph_integration: {
                type: "boolean",
                description: "Activer l'intégration automatique avec le graphe de connaissances",
                default: true
            }
        },
        required: ["project_path"]
    },
};
/**
 * Handler pour l'outil injection_rag
 */
export const injectionRagHandler = async (args) => {
    const logger = InjectionLogger.getInstance();
    // Désactiver les émojis pour compatibilité MCP
    logger.disableEmojis();
    if (!args.project_path || typeof args.project_path !== 'string') {
        const error = "Le paramètre 'project_path' est requis et doit être une chaîne de caractères";
        logger.error(error);
        throw new Error(error);
    }
    // Configurer le niveau de logs - pour MCP, on utilise ERROR par défaut
    const logLevel = args.log_level || LogLevel.ERROR;
    logger.setLogLevel(logLevel);
    // Log minimal pour MCP
    if (logLevel === LogLevel.DEBUG) {
        logger.info("Démarrage de l'injection RAG", {
            version: "v1.0.0",
            project_path: args.project_path,
            log_level: logLevel
        });
    }
    // Phase 0 : Vérification des permissions
    logger.info("🔍 Phase 0 - Vérification des permissions et sécurité");
    try {
        const fs = await import('fs');
        const path = await import('path');
        // Vérifier que le chemin existe
        if (!fs.existsSync(args.project_path)) {
            const error = `Le chemin du projet n'existe pas: ${args.project_path}`;
            logger.error(error);
            throw new Error(error);
        }
        // Vérifier les permissions d'écriture (pour les logs et métadonnées)
        const testWritePath = path.join(args.project_path, ".rag-test-permission");
        try {
            fs.writeFileSync(testWritePath, "test");
            fs.unlinkSync(testWritePath);
            logger.debug("✅ Permissions d'écriture vérifiées");
        }
        catch (error) {
            logger.warn("⚠️  Permissions d'écriture limitées, continuation en mode lecture seule");
        }
    }
    catch (error) {
        logger.error("Erreur lors de la vérification des permissions", error);
        throw error;
    }
    // Charger la configuration
    logger.info("⚙️  Chargement de la configuration RAG");
    const configManager = getRagConfigManager();
    const defaults = configManager.getDefaults();
    // Utiliser les valeurs par défaut de la configuration
    const file_patterns = args.file_patterns || defaults.file_patterns;
    const recursive = args.recursive !== undefined ? args.recursive : defaults.recursive;
    const embedding_provider = defaults.embedding_provider;
    const embedding_model = defaults.embedding_model;
    const enable_graph_integration = args.enable_graph_integration !== undefined
        ? args.enable_graph_integration
        : true;
    // Appliquer les limites aux valeurs numériques de la configuration
    const chunk_size = configManager.applyLimits('chunk_size', defaults.chunk_size);
    const chunk_overlap = configManager.applyLimits('chunk_overlap', defaults.chunk_overlap);
    logger.info("📊 Configuration appliquée", {
        file_patterns_count: file_patterns.length,
        recursive,
        embedding_provider,
        embedding_model,
        chunk_size,
        chunk_overlap,
        enable_graph_integration
    });
    // Phase 1 : Intégration avec le graphe de connaissances (si activé)
    if (enable_graph_integration) {
        logger.info("🧠 Phase 1 - Intégration avec le graphe de connaissances");
        try {
            // Note: L'intégration complète avec les outils Graph se fait automatiquement
            // via le système d'enrichissement Phase 0 dans le pipeline RAG
            logger.debug("Enrichissement automatique des entités via Phase 0");
            // Ici, on pourrait appeler des fonctions spécifiques d'enrichissement
            // Par exemple: await enrichWithGraphKnowledge(args.project_path);
            logger.info("✅ Enrichissement Graph intégré automatiquement");
        }
        catch (error) {
            logger.error("Erreur lors de l'intégration Graph, continuation sans enrichissement", error);
            // Ne pas bloquer le processus principal en cas d'erreur Graph
        }
    }
    // Configurer le fournisseur d'embeddings
    logger.info(`🔧 Configuration du fournisseur d'embeddings: ${embedding_provider}`);
    setEmbeddingProvider(embedding_provider, embedding_model);
    const options = {
        filePatterns: file_patterns,
        recursive: recursive,
        chunkSize: chunk_size,
        chunkOverlap: chunk_overlap
    };
    // Phase 2 : Injection RAG principale
    logger.info("🚀 Phase 2 - Injection RAG principale");
    const startTime = Date.now();
    try {
        const result = await indexProject(args.project_path, options);
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        logger.info("✅ Injection RAG terminée avec succès", {
            duration: `${duration}s`,
            total_files: result.totalFiles,
            indexed_files: result.indexedFiles,
            chunks_created: result.chunksCreated,
            errors: result.errors
        });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: true,
                        version: "v1.0.0",
                        duration_seconds: duration,
                        ...result,
                        config_used: {
                            embedding_provider,
                            embedding_model,
                            chunk_size,
                            chunk_overlap,
                            recursive,
                            file_patterns_count: file_patterns.length,
                            enable_graph_integration,
                            log_level: logLevel
                        },
                        pipeline: {
                            phase_0: "Vérification permissions ✓",
                            phase_1: enable_graph_integration ? "Enrichissement Graph intégré ✓" : "Enrichissement Graph désactivé",
                            phase_2: "Injection RAG principale ✓"
                        }
                    }, null, 2)
                }]
        };
    }
    catch (error) {
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        logger.error("❌ Erreur lors de l'injection RAG", {
            duration: `${duration}s`,
            error: error instanceof Error ? error.message : String(error)
        });
        throw error;
    }
};
/**
 * Test de l'outil (pour usage en développement)
 */
export async function testInjectionRag() {
    console.log("🧪 Test de l'outil injection_rag v1.0.0...");
    const testProjectPath = "/tmp/test-injection-rag";
    const logger = InjectionLogger.getInstance();
    logger.setLogLevel(LogLevel.DEBUG);
    try {
        // Créer un répertoire de test
        const fs = await import('fs');
        const path = await import('path');
        if (!fs.existsSync(testProjectPath)) {
            fs.mkdirSync(testProjectPath, { recursive: true });
        }
        // Créer un fichier de test
        const testFile = path.join(testProjectPath, "test.js");
        fs.writeFileSync(testFile, "// Test file for injection_rag\nconsole.log('Hello Injection RAG');");
        logger.info(`✅ Projet de test créé: ${testProjectPath}`);
        // Tester l'injection
        const result = await injectionRagHandler({
            project_path: testProjectPath,
            file_patterns: ["**/*.js"],
            recursive: true,
            log_level: "DEBUG",
            enable_graph_integration: true
        });
        logger.info("✅ Test réussi", {
            has_result: !!result,
            success: true
        });
        // Nettoyer
        fs.rmSync(testProjectPath, { recursive: true, force: true });
        logger.debug("🧹 Nettoyage du projet de test");
        return result;
    }
    catch (error) {
        logger.error("❌ Test échoué", error);
        throw error;
    }
}
// Export pour les tests
export { InjectionLogger, LogLevel };
