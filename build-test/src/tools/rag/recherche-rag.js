// src/tools/rag/recherche-rag.ts
// Outil: recherche_rag - Recherche RAG avancée avec filtres et rétrocompatibilité
// Remplace: search_code avec fonctionnalités étendues
// Version: v2.0.0
import { getRagConfigManager } from "../../config/rag-config.js";
import { hybridSearch, semanticSearch, setEmbeddingProvider } from "../../rag/vector-store.js";
// Système de logs simplifié
var LogLevel;
(function (LogLevel) {
    LogLevel["INFO"] = "INFO";
    LogLevel["DEBUG"] = "DEBUG";
    LogLevel["ERROR"] = "ERROR";
})(LogLevel || (LogLevel = {}));
class RechercheRagLogger {
    static instance;
    logLevel = LogLevel.ERROR;
    constructor() { }
    static getInstance() {
        if (!RechercheRagLogger.instance) {
            RechercheRagLogger.instance = new RechercheRagLogger();
        }
        return RechercheRagLogger.instance;
    }
    setLogLevel(level) {
        this.logLevel = level;
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
}
/**
 * Définition de l'outil recherche_rag
 */
export const rechercheRagTool = {
    name: "recherche_rag",
    description: "Recherche RAG avancée avec filtres par type/langage, scope project/global, et options de re-ranking",
    inputSchema: {
        type: "object",
        properties: {
            // Requête
            query: {
                type: "string",
                description: "Requête de recherche sémantique"
            },
            // Scope
            scope: {
                type: "string",
                description: "Scope de recherche",
                enum: ["project", "global"],
                default: "project"
            },
            project_filter: {
                type: "string",
                description: "Filtrer par chemin de projet spécifique (requis si scope=project)"
            },
            // Filtres avancés
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
            file_extensions: {
                type: "array",
                items: { type: "string" },
                description: "Extensions de fichier à inclure (ex: ['.ts', '.py'])"
            },
            roles: {
                type: "array",
                items: { type: "string" },
                description: "Rôles à inclure (ex: ['core', 'example', 'template'])"
            },
            // Options de recherche
            top_k: {
                type: "number",
                description: "Nombre maximum de résultats à retourner",
                default: 10,
                minimum: 1,
                maximum: 100
            },
            threshold: {
                type: "number",
                description: "Seuil de similarité minimum (0.0-1.0)",
                default: 0.3,
                minimum: 0.0,
                maximum: 1.0
            },
            dynamic_threshold: {
                type: "boolean",
                description: "Activer le seuil dynamique basé sur la distribution des scores",
                default: false
            },
            // Options de recherche hybride
            search_mode: {
                type: "string",
                description: "Mode de recherche",
                enum: ["semantic", "hybrid", "text"],
                default: "semantic"
            },
            text_query: {
                type: "string",
                description: "Requête textuelle pour la recherche hybride"
            },
            semantic_weight: {
                type: "number",
                description: "Poids pour la recherche sémantique (0.0-1.0)",
                default: 0.7,
                minimum: 0.0,
                maximum: 1.0
            },
            text_weight: {
                type: "number",
                description: "Poids pour la recherche textuelle (0.0-1.0)",
                default: 0.3,
                minimum: 0.0,
                maximum: 1.0
            },
            // Options de re-ranking
            enable_reranking: {
                type: "boolean",
                description: "Activer le re-ranking basé sur les métadonnées",
                default: false
            },
            prefer_recent: {
                type: "boolean",
                description: "Préférer les fichiers récents dans le re-ranking",
                default: true
            },
            prefer_smaller_files: {
                type: "boolean",
                description: "Préférer les fichiers plus petits dans le re-ranking",
                default: true
            },
            priority_content_types: {
                type: "array",
                items: { type: "string" },
                description: "Types de contenu prioritaires pour le re-ranking",
                default: ["code", "doc"]
            },
            // Options de sortie
            format_output: {
                type: "boolean",
                description: "Formater la sortie pour une lecture humaine",
                default: true
            },
            include_metadata: {
                type: "boolean",
                description: "Inclure les métadonnées complètes dans la sortie",
                default: false
            },
            include_content: {
                type: "boolean",
                description: "Inclure le contenu complet dans la sortie",
                default: true
            },
            max_content_length: {
                type: "number",
                description: "Longueur maximale du contenu à inclure (caractères)",
                default: 500
            },
            // Rétrocompatibilité
            legacy_mode: {
                type: "boolean",
                description: "Activer le mode rétrocompatible avec search_code",
                default: false
            }
        },
        required: ["query"]
    },
};
/**
 * Handler pour l'outil recherche_rag
 */
export const rechercheRagHandler = async (args) => {
    const logger = RechercheRagLogger.getInstance();
    logger.setLogLevel(LogLevel.ERROR);
    const startTime = Date.now();
    try {
        // Validation des paramètres
        if (!args.query || typeof args.query !== 'string') {
            throw new Error("Le paramètre 'query' est requis et doit être une chaîne de caractères");
        }
        if (args.scope === 'project' && !args.project_filter) {
            throw new Error("Le paramètre 'project_filter' est requis lorsque scope='project'");
        }
        // Charger la configuration
        const configManager = getRagConfigManager();
        const defaults = configManager.getDefaults();
        const searchDefaults = configManager.getSearchDefaults();
        // Configuration des embeddings
        const embeddingProvider = defaults.embedding_provider;
        const embeddingModel = defaults.embedding_model;
        setEmbeddingProvider(embeddingProvider, embeddingModel);
        // Appliquer les limites de configuration
        const limit = configManager.applyLimits('search_limit', args.top_k || searchDefaults.limit);
        const threshold = configManager.applyLimits('search_threshold', args.threshold || searchDefaults.threshold);
        // Préparer les options de recherche
        const searchOptions = {
            projectFilter: args.scope === 'project' ? args.project_filter : undefined,
            limit: limit,
            threshold: threshold,
            dynamicThreshold: args.dynamic_threshold || false,
            enableReranking: args.enable_reranking || false,
            rerankingWeights: {
                preferRecent: args.prefer_recent !== false,
                preferSmallerFiles: args.prefer_smaller_files !== false,
                priorityContentTypes: args.priority_content_types || ['code', 'doc']
            }
        };
        // Appliquer les filtres avancés
        if (args.content_types && Array.isArray(args.content_types) && args.content_types.length > 0) {
            searchOptions.contentTypeFilter = args.content_types;
        }
        if (args.languages && Array.isArray(args.languages) && args.languages.length > 0) {
            searchOptions.languageFilter = args.languages;
        }
        if (args.file_extensions && Array.isArray(args.file_extensions) && args.file_extensions.length > 0) {
            searchOptions.fileExtensionFilter = args.file_extensions;
        }
        if (args.roles && Array.isArray(args.roles) && args.roles.length > 0) {
            searchOptions.roleFilter = args.roles;
        }
        // Mode rétrocompatible avec search_code
        if (args.legacy_mode === true) {
            logger.info("Mode rétrocompatible activé (compatibilité search_code)");
            // Simplifier les options pour correspondre à l'ancienne API
            delete searchOptions.dynamicThreshold;
            delete searchOptions.enableReranking;
            delete searchOptions.rerankingWeights;
        }
        let searchResults;
        const searchMode = args.search_mode || 'semantic';
        // Exécuter la recherche selon le mode
        switch (searchMode) {
            case 'semantic':
                logger.info(`Recherche sémantique: "${args.query}"`);
                searchResults = await semanticSearch(args.query, searchOptions);
                break;
            case 'hybrid':
                logger.info(`Recherche hybride: "${args.query}"`);
                const hybridOptions = {
                    ...searchOptions,
                    semanticWeight: args.semantic_weight || 0.7,
                    textWeight: args.text_weight || 0.3,
                    textQuery: args.text_query || args.query
                };
                searchResults = await hybridSearch(args.query, hybridOptions);
                break;
            case 'text':
                logger.info(`Recherche textuelle: "${args.text_query || args.query}"`);
                // Note: La recherche textuelle pure nécessiterait une implémentation séparée
                // Pour l'instant, on utilise la recherche sémantique comme fallback
                searchResults = await semanticSearch(args.text_query || args.query, searchOptions);
                break;
            default:
                throw new Error(`Mode de recherche non supporté: ${searchMode}`);
        }
        const endTime = Date.now();
        const executionTime = endTime - startTime;
        // Préparer la réponse
        const response = prepareResponse(args, searchResults, {
            query: args.query,
            scope: args.scope,
            projectFilter: args.project_filter,
            searchMode,
            embeddingProvider,
            embeddingModel,
            limit,
            threshold,
            dynamicThreshold: args.dynamic_threshold,
            executionTime,
            totalResults: searchResults.length
        }, logger);
        logger.info(`Recherche terminée: ${searchResults.length} résultats en ${executionTime}ms`);
        return response;
    }
    catch (error) {
        const endTime = Date.now();
        const executionTime = endTime - startTime;
        logger.error(`Erreur dans recherche_rag: ${error instanceof Error ? error.message : String(error)}`, {
            executionTime: `${executionTime}ms`,
            query: args.query
        });
        throw error;
    }
};
/**
 * Prépare la réponse formatée
 */
function prepareResponse(args, searchResults, metadata, logger) {
    const formatOutput = args.format_output !== false;
    const includeMetadata = args.include_metadata === true;
    const includeContent = args.include_content !== false;
    const maxContentLength = args.max_content_length || 500;
    // Mode rétrocompatible
    if (args.legacy_mode === true) {
        return prepareLegacyResponse(searchResults, metadata, logger);
    }
    // Formatage humain
    if (formatOutput) {
        const formatted = formatHumanReadable(searchResults, metadata, {
            includeContent,
            maxContentLength,
            includeMetadata
        });
        return {
            content: [{ type: "text", text: formatted }]
        };
    }
    // Format JSON structuré
    const structuredResults = searchResults.map(result => {
        const baseResult = {
            id: result.id,
            filePath: result.filePath,
            score: result.score,
            metadata: result.metadata
        };
        if (includeContent) {
            return {
                ...baseResult,
                content: result.content.length > maxContentLength
                    ? result.content.substring(0, maxContentLength) + '...'
                    : result.content
            };
        }
        return baseResult;
    });
    const responseData = {
        success: true,
        query: metadata.query,
        scope: metadata.scope,
        search_mode: metadata.searchMode,
        config_used: {
            embedding_provider: metadata.embeddingProvider,
            embedding_model: metadata.embeddingModel,
            limit: metadata.limit,
            threshold: metadata.threshold,
            dynamic_threshold: metadata.dynamicThreshold
        },
        stats: {
            total_results: metadata.totalResults,
            execution_time_ms: metadata.executionTime,
            average_score: searchResults.length > 0
                ? searchResults.reduce((sum, r) => sum + r.score, 0) / searchResults.length
                : 0
        },
        results: structuredResults
    };
    return {
        content: [{
                type: "text",
                text: JSON.stringify(responseData, null, 2)
            }]
    };
}
/**
 * Prépare la réponse rétrocompatible avec search_code
 */
function prepareLegacyResponse(searchResults, metadata, logger) {
    logger.info("Formatage de la réponse en mode rétrocompatible");
    const formatted = `Recherche RAG: "${metadata.query}"\n` +
        `Configuration: provider=${metadata.embeddingProvider}, model=${metadata.embeddingModel}\n` +
        `Résultats: ${metadata.totalResults}\n` +
        `Temps d'exécution: ${metadata.executionTime}ms\n` +
        `Projets scannés: 1\n` +
        `Limite: ${metadata.limit}, Seuil: ${metadata.threshold}\n\n` +
        searchResults.map((r, i) => `${i + 1}. ${r.filePath} (score: ${(r.score * 100).toFixed(2)}%)\n` +
            `   Projet: ${r.metadata?.projectPath || 'N/A'}\n` +
            `   Contenu: ${r.content?.substring(0, 100) || ''}...`).join('\n\n');
    return { content: [{ type: "text", text: formatted }] };
}
/**
 * Formatage pour une lecture humaine
 */
function formatHumanReadable(results, metadata, options) {
    let output = `🔍 Recherche RAG - ${metadata.searchMode.toUpperCase()}\n`;
    output += `════════════════════════════════════════\n\n`;
    output += `📋 Requête: "${metadata.query}"\n`;
    output += `📁 Scope: ${metadata.scope}${metadata.projectFilter ? ` (${metadata.projectFilter})` : ''}\n`;
    output += `⚙️  Configuration: ${metadata.embeddingProvider}/${metadata.embeddingModel}\n`;
    output += `📊 Résultats: ${metadata.totalResults} trouvés (limite: ${metadata.limit})\n`;
    output += `⏱️  Temps d'exécution: ${metadata.executionTime}ms\n\n`;
    if (results.length === 0) {
        output += `❌ Aucun résultat trouvé pour cette requête.\n`;
        output += `💡 Suggestions: Essayez avec des termes plus généraux ou vérifiez les filtres.\n`;
        return output;
    }
    output += `📄 Résultats (triés par pertinence):\n`;
    output += `════════════════════════════════════════\n\n`;
    results.forEach((result, index) => {
        output += `${index + 1}. 📍 ${result.filePath}\n`;
        output += `   ⭐ Score: ${(result.score * 100).toFixed(2)}%\n`;
        if (result.metadata) {
            output += `   📂 Projet: ${result.metadata.projectPath || 'N/A'}\n`;
            output += `   🏷️  Type: ${result.metadata.contentType || 'N/A'}`;
            if (result.metadata.language)
                output += ` (${result.metadata.language})`;
            output += `\n`;
            if (result.metadata.role) {
                output += `   🎭 Rôle: ${result.metadata.role}\n`;
            }
            if (result.metadata.linesCount) {
                output += `   📏 Lignes: ${result.metadata.linesCount}\n`;
            }
            if (result.metadata.updatedAt) {
                const updatedDate = new Date(result.metadata.updatedAt);
                output += `   📅 Mis à jour: ${updatedDate.toLocaleDateString()}\n`;
            }
        }
        if (options.includeContent && result.content) {
            const content = result.content.length > options.maxContentLength
                ? result.content.substring(0, options.maxContentLength) + '...'
                : result.content;
            output += `   📝 Contenu:\n`;
            output += `   ${'─'.repeat(40)}\n`;
            output += `   ${content.split('\n').join('\n   ')}\n`;
            output += `   ${'─'.repeat(40)}\n`;
        }
        if (options.includeMetadata && result.metadata) {
            output += `   🔧 Métadonnées complètes:\n`;
            Object.entries(result.metadata).forEach(([key, value]) => {
                if (typeof value === 'object') {
                    output += `      ${key}: ${JSON.stringify(value)}\n`;
                }
                else {
                    output += `      ${key}: ${value}\n`;
                }
            });
        }
        output += `\n`;
    });
    output += `════════════════════════════════════════\n`;
    return output;
}
//# sourceMappingURL=recherche-rag.js.map