// src/rag/phase0/parser/tree-sitter/languages.ts
// Configuration des langages supportés par Tree-sitter

import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';
import TypeScript from 'tree-sitter-typescript';

/**
 * Configuration d'un langage Tree-sitter
 */
export interface LanguageConfig {
    /** Identifiant du langage (ex: 'typescript', 'javascript', 'python') */
    id: string;

    /** Extensions de fichiers associées */
    extensions: string[];

    /** Instance du parser Tree-sitter */
    parser: Parser;

    /** Grammaire Tree-sitter */
    grammar: any;

    /** Nom d'affichage */
    name: string;
}

/**
 * Langages supportés par défaut
 */
export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
    {
        id: 'typescript',
        name: 'TypeScript',
        extensions: ['.ts', '.tsx'],
        parser: new Parser(),
        grammar: TypeScript.typescript,
    },
    {
        id: 'javascript',
        name: 'JavaScript',
        extensions: ['.js', '.jsx', '.mjs', '.cjs'],
        parser: new Parser(),
        grammar: JavaScript,
    },
    {
        id: 'python',
        name: 'Python',
        extensions: ['.py', '.pyw'],
        parser: new Parser(),
        grammar: Python,
    },
];

/**
 * Détecte le langage d'un fichier basé sur son extension
 */
export function detectLanguageFromPath(filePath: string): LanguageConfig | undefined {
    const extension = filePath.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (!extension) return undefined;

    return SUPPORTED_LANGUAGES.find(lang =>
        lang.extensions.includes(extension)
    );
}

/**
 * Initialise un parser pour un langage spécifique
 */
export function initializeLanguage(languageId: string): LanguageConfig | undefined {
    const language = SUPPORTED_LANGUAGES.find(lang => lang.id === languageId);
    if (!language) return undefined;

    try {
        language.parser.setLanguage(language.grammar);
        return language;
    } catch (error) {
        console.error(`Erreur lors de l'initialisation du langage ${languageId}:`, error);
        return undefined;
    }
}

/**
 * Initialise tous les langages supportés
 */
export function initializeAllLanguages(): Map<string, LanguageConfig> {
    const initialized = new Map<string, LanguageConfig>();

    for (const language of SUPPORTED_LANGUAGES) {
        try {
            language.parser.setLanguage(language.grammar);
            initialized.set(language.id, language);
            console.log(`✅ Langage ${language.name} initialisé`);
        } catch (error) {
            console.error(`❌ Erreur lors de l'initialisation de ${language.name}:`, error);
        }
    }

    return initialized;
}

/**
 * Liste des langages disponibles
 */
export function getAvailableLanguages(): Array<{ id: string, name: string, extensions: string[] }> {
    return SUPPORTED_LANGUAGES.map(lang => ({
        id: lang.id,
        name: lang.name,
        extensions: lang.extensions,
    }));
}
