// src/rag/phase0/chunker-integration.ts
// Intégration du chunker intelligent avec Phase 0.1
import { CodeAnalyzer } from './analyzer/code-analyzer.js';
import { IntelligentChunker } from './chunker/chunker-intelligent.js';
import { TreeSitterManager } from './parser/tree-sitter/index.js';
/**
 * Intégration du chunker avec Phase 0.1
 */
export class ChunkerIntegration {
    options;
    treeSitterManager;
    codeAnalyzer;
    chunker;
    chunkHandlers = [];
    isInitialized = false;
    constructor(options = {}) {
        this.options = {
            enableSemanticAnalysis: options.enableSemanticAnalysis ?? true,
            enableChunking: options.enableChunking ?? true,
            enableEventEmission: options.enableEventEmission ?? true,
            chunkerConfig: options.chunkerConfig ?? {
                granularity: 'atomic',
                chunkTypes: ['function', 'class', 'method', 'interface', 'import', 'export', 'type_definition'],
                maxChunkSize: 1000,
                minChunkSize: 50,
                includeDocumentation: true,
                includeContext: false,
                rules: {
                    neverSplitFunctions: true,
                    neverSplitClasses: true,
                    neverMixCodeAndText: true,
                    respectSemanticBoundaries: true,
                },
            },
            analyzerConfig: options.analyzerConfig ?? {
                extractSymbols: true,
                extractSemanticUnits: true,
                buildDependencyGraph: true,
                calculateMetrics: true,
                detailLevel: 'standard',
            },
            fileFilters: options.fileFilters ?? {
                extensions: ['.ts', '.js', '.py', '.java', '.cpp', '.c', '.go', '.rs', '.php'],
                ignorePatterns: [],
                maxFileSize: 10 * 1024 * 1024, // 10 MB
            },
        };
        // Initialiser les composants
        this.treeSitterManager = new TreeSitterManager();
        this.codeAnalyzer = new CodeAnalyzer(this.options.analyzerConfig);
        this.chunker = new IntelligentChunker(this.options.chunkerConfig);
    }
    /**
     * Initialise l'intégration
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        // Log silencieux pour MCP
        try {
            // Initialiser Tree-sitter
            await this.treeSitterManager.initialize();
            // Log silencieux pour MCP
            this.isInitialized = true;
            // Log silencieux pour MCP
        }
        catch (error) {
            // Log silencieux pour MCP
            throw error;
        }
    }
    /**
     * Vérifie si un fichier doit être traité
     */
    shouldProcessFile(filePath) {
        const { extensions, ignorePatterns, maxFileSize } = this.options.fileFilters;
        // Vérifier l'extension
        const extension = filePath.toLowerCase().match(/\.[^.]+$/)?.[0];
        if (!extension || !extensions?.includes(extension)) {
            return false;
        }
        // Vérifier les patterns ignorés
        if (ignorePatterns) {
            for (const pattern of ignorePatterns) {
                if (typeof pattern === 'string') {
                    if (filePath.includes(pattern)) {
                        return false;
                    }
                }
                else if (pattern.test(filePath)) {
                    return false;
                }
            }
        }
        // Vérifier la taille du fichier
        if (maxFileSize) {
            try {
                const fs = require('fs');
                const stats = fs.statSync(filePath);
                if (stats.size > maxFileSize) {
                    console.warn(`⚠️  Fichier trop volumineux ignoré: ${filePath} (${stats.size} octets)`);
                    return false;
                }
            }
            catch (error) {
                // Si on ne peut pas lire la taille, on continue
            }
        }
        return true;
    }
    /**
     * Traite un événement de fichier
     */
    async processFileEvent(event) {
        const startTime = Date.now();
        if (!this.isInitialized) {
            throw new Error('ChunkerIntegration non initialisé');
        }
        // Vérifier si le fichier doit être traité
        if (!this.shouldProcessFile(event.path)) {
            // Log silencieux pour MCP
            return [];
        }
        // Log silencieux pour MCP
        try {
            // 1. Parser le fichier
            const parseResult = await this.treeSitterManager.parseSourceCode(event.path, this.detectLanguage(event.path));
            if (!parseResult || !parseResult.ast) {
                console.warn(`⚠️  Impossible de parser le fichier: ${event.relativePath}`);
                return [];
            }
            // 2. Analyser le code (optionnel)
            let semanticUnits;
            if (this.options.enableSemanticAnalysis) {
                const analysisResult = await this.codeAnalyzer.analyze(parseResult);
                semanticUnits = analysisResult.semanticUnits;
            }
            // 3. Générer les chunks
            const chunkingResult = await this.chunker.chunk(parseResult, semanticUnits);
            // Log silencieux pour MCP
            // 4. Émettre les événements de chunks
            const chunkEvents = [];
            for (const chunk of chunkingResult.chunks) {
                const chunkEvent = {
                    type: this.mapFileEventToChunkEvent(event.type),
                    chunk,
                    sourceEvent: event,
                    timestamp: new Date(),
                    metadata: {
                        processingTime: Date.now() - startTime,
                        totalChunks: chunkingResult.chunks.length,
                        chunkingStats: chunkingResult.stats,
                    },
                };
                chunkEvents.push(chunkEvent);
                // Émettre l'événement si activé
                if (this.options.enableEventEmission) {
                    await this.emitChunkEvent(chunkEvent);
                }
            }
            return chunkEvents;
        }
        catch (error) {
            console.error(`❌ Erreur lors du traitement de ${event.relativePath}:`, error);
            throw error;
        }
    }
    /**
     * Détecte le langage d'un fichier
     */
    detectLanguage(filePath) {
        const extension = filePath.toLowerCase().match(/\.[^.]+$/)?.[0];
        const languageMap = {
            '.ts': 'typescript',
            '.js': 'javascript',
            '.py': 'python',
            '.java': 'java',
            '.cpp': 'cpp',
            '.c': 'c',
            '.go': 'go',
            '.rs': 'rust',
            '.php': 'php',
        };
        return languageMap[extension || ''] || 'unknown';
    }
    /**
     * Mappe un événement de fichier à un événement de chunk
     */
    mapFileEventToChunkEvent(fileEventType) {
        const eventMap = {
            'add': 'chunk_created',
            'change': 'chunk_updated',
            'unlink': 'chunk_deleted',
            'addDir': 'chunk_created',
            'unlinkDir': 'chunk_deleted',
        };
        return eventMap[fileEventType] || 'chunk_created';
    }
    /**
     * Émet un événement de chunk
     */
    async emitChunkEvent(event) {
        for (const handler of this.chunkHandlers) {
            try {
                await handler(event);
            }
            catch (error) {
                // Log silencieux pour MCP
            }
        }
    }
    /**
     * Ajoute un handler d'événements de chunks
     */
    addChunkEventHandler(handler) {
        this.chunkHandlers.push(handler);
    }
    /**
     * Supprime un handler d'événements de chunks
     */
    removeChunkEventHandler(handler) {
        const index = this.chunkHandlers.indexOf(handler);
        if (index !== -1) {
            this.chunkHandlers.splice(index, 1);
        }
    }
    /**
     * Crée un handler pour le file watcher
     */
    createFileWatcherHandler() {
        return async (event) => {
            try {
                await this.processFileEvent(event);
            }
            catch (error) {
                // Log silencieux pour MCP
            }
        };
    }
    /**
     * Arrête l'intégration
     */
    async shutdown() {
        // Log silencieux pour MCP
        try {
            await this.treeSitterManager.shutdown();
            // Log silencieux pour MCP
            this.isInitialized = false;
            // Log silencieux pour MCP
        }
        catch (error) {
            // Log silencieux pour MCP
            throw error;
        }
    }
    /**
     * Vérifie si l'intégration est initialisée
     */
    isReady() {
        return this.isInitialized;
    }
    /**
     * Obtient les options de configuration
     */
    getOptions() {
        return this.options;
    }
    /**
     * Obtient le chunker
     */
    getChunker() {
        return this.chunker;
    }
    /**
     * Obtient l'analyseur de code
     */
    getCodeAnalyzer() {
        return this.codeAnalyzer;
    }
    /**
     * Obtient le manager Tree-sitter
     */
    getTreeSitterManager() {
        return this.treeSitterManager;
    }
}
/**
 * Factory pour créer une intégration de chunker
 */
export async function createChunkerIntegration(options) {
    const integration = new ChunkerIntegration(options);
    await integration.initialize();
    return integration;
}
/**
 * Utilitaire : Crée un handler de logging pour les événements de chunks
 */
export function createChunkLoggingHandler(prefix = 'CHUNKER') {
    return (event) => {
        // Log silencieux pour MCP
    };
}
/**
 * Utilitaire : Crée un handler qui enregistre les chunks dans un store
 */
export function createChunkStorageHandler(storage) {
    return async (event) => {
        try {
            await storage.saveChunk(event.chunk, event.type);
            // Log silencieux pour MCP
        }
        catch (error) {
            // Log silencieux pour MCP
        }
    };
}
// Test unitaire si exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
    // Log silencieux pour MCP
    async function runTest() {
        try {
            // Créer un fichier de test
            const testDir = '/tmp/test-chunker-integration-' + Date.now();
            const fs = require('fs');
            const path = require('path');
            fs.mkdirSync(testDir, { recursive: true });
            // Créer un fichier TypeScript de test
            const testFile = path.join(testDir, 'test.ts');
            const testCode = `
import { Component } from 'react';

interface Props {
    name: string;
}

export class HelloComponent extends Component<Props> {
    render() {
        return <div>Hello {this.props.name}</div>;
    }
}
`;
            fs.writeFileSync(testFile, testCode);
            // Créer l'intégration
            const integration = await createChunkerIntegration({
                enableSemanticAnalysis: true,
                enableChunking: true,
                enableEventEmission: true,
                chunkerConfig: {
                    granularity: 'atomic',
                    rules: {
                        neverSplitFunctions: true,
                        neverSplitClasses: true,
                        neverMixCodeAndText: true,
                        respectSemanticBoundaries: true,
                    },
                },
            });
            // Log silencieux pour MCP
            // Ajouter un handler de logging
            integration.addChunkEventHandler(createChunkLoggingHandler('TEST'));
            // Simuler un événement de fichier
            const mockEvent = {
                type: 'add',
                path: testFile,
                relativePath: 'test.ts',
                timestamp: new Date(),
                metadata: {
                    ignored: false,
                    extension: 'ts',
                    size: fs.statSync(testFile).size,
                },
            };
            // Traiter l'événement
            // Log silencieux pour MCP
            const chunkEvents = await integration.processFileEvent(mockEvent);
            // Log silencieux pour MCP
            // Afficher un résumé
            if (chunkEvents.length > 0) {
                // Log silencieux pour MCP
                const byType = {};
                chunkEvents.forEach(event => {
                    byType[event.chunk.type] = (byType[event.chunk.type] || 0) + 1;
                });
                Object.entries(byType).forEach(([type, count]) => {
                    // Log silencieux pour MCP
                });
            }
            // Arrêter l'intégration
            await integration.shutdown();
            // Nettoyer
            fs.rmSync(testDir, { recursive: true, force: true });
            // Log silencieux pour MCP
            // Log silencieux pour MCP
        }
        catch (error) {
            // Log silencieux pour MCP
            process.exit(1);
        }
    }
    runTest().catch(() => { });
}
//# sourceMappingURL=chunker-integration.js.map