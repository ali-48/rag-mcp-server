// src/rag/phase0/parser/tree-sitter/index.ts
// Point d'entrée principal du module Tree-sitter

import {
    LanguageConfig,
    SUPPORTED_LANGUAGES,
    detectLanguageFromPath,
    getAvailableLanguages,
    initializeAllLanguages,
    initializeLanguage
} from './languages.js';
import { ParseResult, parseFile, parseSourceCode } from './parse-file.js';

/**
 * Configuration du parser Tree-sitter
 */
export interface TreeSitterConfig {
    /** Initialiser automatiquement tous les langages au démarrage */
    autoInitialize?: boolean;

    /** Langages à initialiser (si autoInitialize = false) */
    languagesToInitialize?: string[];

    /** Niveau de logs */
    logLevel?: 'silent' | 'info' | 'debug';
}

/**
 * Gestionnaire principal Tree-sitter
 */
export class TreeSitterManager {
    private config: TreeSitterConfig;
    private initializedLanguages: Map<string, LanguageConfig>;
    private isInitialized: boolean = false;

    constructor(config: TreeSitterConfig = {}) {
        this.config = {
            autoInitialize: true,
            logLevel: 'info',
            ...config,
        };
        this.initializedLanguages = new Map();
    }

    /**
     * Initialise le gestionnaire Tree-sitter
     */
    async initialize(): Promise<boolean> {
        if (this.isInitialized) {
            this.log('info', 'Tree-sitter déjà initialisé');
            return true;
        }

        this.log('info', 'Initialisation de Tree-sitter...');

        try {
            if (this.config.autoInitialize) {
                this.initializedLanguages = initializeAllLanguages();
            } else if (this.config.languagesToInitialize?.length) {
                for (const langId of this.config.languagesToInitialize) {
                    const language = initializeLanguage(langId);
                    if (language) {
                        this.initializedLanguages.set(langId, language);
                    }
                }
            }

            this.isInitialized = true;
            this.log('info', `✅ Tree-sitter initialisé avec ${this.initializedLanguages.size} langages`);
            return true;
        } catch (error) {
            this.log('error', `❌ Erreur lors de l'initialisation de Tree-sitter: ${error}`);
            return false;
        }
    }

    /**
     * Parse un fichier et retourne son AST
     */
    async parseFile(filePath: string): Promise<ParseResult | null> {
        if (!this.isInitialized) {
            const initialized = await this.initialize();
            if (!initialized) return null;
        }

        try {
            const result = await parseFile(filePath, this.initializedLanguages);
            this.log('debug', `Fichier parsé: ${filePath} (${result.language})`);
            return result;
        } catch (error) {
            this.log('error', `Erreur lors du parsing de ${filePath}: ${error}`);
            return null;
        }
    }

    /**
     * Parse du code source directement
     */
    async parseSourceCode(sourceCode: string, languageId: string): Promise<ParseResult | null> {
        if (!this.isInitialized) {
            const initialized = await this.initialize();
            if (!initialized) return null;
        }

        const language = this.initializedLanguages.get(languageId);
        if (!language) {
            this.log('error', `Langage non initialisé: ${languageId}`);
            return null;
        }

        try {
            const result = await parseSourceCode(sourceCode, language);
            this.log('debug', `Code source parsé (${languageId}, ${result.ast ? 'AST généré' : 'pas d\'AST'})`);
            return result;
        } catch (error) {
            this.log('error', `Erreur lors du parsing du code source (${languageId}): ${error}`);
            return null;
        }
    }

    /**
     * Détecte le langage d'un fichier
     */
    detectLanguage(filePath: string): LanguageConfig | undefined {
        return detectLanguageFromPath(filePath);
    }

    /**
     * Liste des langages disponibles
     */
    getAvailableLanguages() {
        return getAvailableLanguages();
    }

    /**
     * Liste des langages initialisés
     */
    getInitializedLanguages(): string[] {
        return Array.from(this.initializedLanguages.keys());
    }

    /**
     * Vérifie si un langage est supporté
     */
    isLanguageSupported(languageId: string): boolean {
        return SUPPORTED_LANGUAGES.some(lang => lang.id === languageId);
    }

    /**
     * Vérifie si un langage est initialisé
     */
    isLanguageInitialized(languageId: string): boolean {
        return this.initializedLanguages.has(languageId);
    }

    /**
     * Obtient la configuration d'un langage
     */
    getLanguageConfig(languageId: string): LanguageConfig | undefined {
        return this.initializedLanguages.get(languageId);
    }

    /**
     * Journalisation
     */
    private log(level: 'info' | 'debug' | 'error', message: string) {
        if (this.config.logLevel === 'silent') return;
        if (this.config.logLevel === 'info' && level === 'debug') return;

        const prefix = '🌳 [Tree-sitter]';
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];

        switch (level) {
            case 'info':
                console.log(`${prefix} ${timestamp} ℹ️  ${message}`);
                break;
            case 'debug':
                console.debug(`${prefix} ${timestamp} 🔍 ${message}`);
                break;
            case 'error':
                console.error(`${prefix} ${timestamp} ❌ ${message}`);
                break;
        }
    }

    /**
     * Arrête le gestionnaire (nettoyage)
     */
    async shutdown(): Promise<void> {
        this.log('info', 'Arrêt de Tree-sitter...');
        this.initializedLanguages.clear();
        this.isInitialized = false;
        this.log('info', '✅ Tree-sitter arrêté');
    }
}

/**
 * Instance singleton par défaut
 */
let defaultInstance: TreeSitterManager | null = null;

/**
 * Obtient l'instance singleton de TreeSitterManager
 */
export function getTreeSitterManager(config?: TreeSitterConfig): TreeSitterManager {
    if (!defaultInstance) {
        defaultInstance = new TreeSitterManager(config);
    }
    return defaultInstance;
}

/**
 * Initialise Tree-sitter avec la configuration par défaut
 */
export async function initializeTreeSitter(config?: TreeSitterConfig): Promise<TreeSitterManager> {
    const manager = getTreeSitterManager(config);
    await manager.initialize();
    return manager;
}

/**
 * Parse un fichier avec l'instance par défaut
 */
export async function parseFileWithDefault(filePath: string): Promise<ParseResult | null> {
    const manager = getTreeSitterManager();
    return manager.parseFile(filePath);
}

/**
 * Parse du code source avec l'instance par défaut
 */
export async function parseSourceCodeWithDefault(sourceCode: string, languageId: string): Promise<ParseResult | null> {
    const manager = getTreeSitterManager();
    return manager.parseSourceCode(sourceCode, languageId);
}
