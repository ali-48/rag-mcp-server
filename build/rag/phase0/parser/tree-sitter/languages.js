// src/rag/phase0/parser/tree-sitter/languages.ts
// Configuration des langages supportés par Tree-sitter
import { createRequire as _createRequire } from "module";
const __require = _createRequire(import.meta.url);
const Parser = __require("tree-sitter");
const JavaScript = __require("tree-sitter-javascript");
const Python = __require("tree-sitter-python");
const TypeScript = __require("tree-sitter-typescript");
/**
 * Langages supportés par défaut
 */
export const SUPPORTED_LANGUAGES = [
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
export function detectLanguageFromPath(filePath) {
    const extension = filePath.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (!extension)
        return undefined;
    return SUPPORTED_LANGUAGES.find(lang => lang.extensions.includes(extension));
}
/**
 * Initialise un parser pour un langage spécifique
 */
export function initializeLanguage(languageId) {
    const language = SUPPORTED_LANGUAGES.find(lang => lang.id === languageId);
    if (!language)
        return undefined;
    try {
        language.parser.setLanguage(language.grammar);
        return language;
    }
    catch (error) {
        console.error(`Erreur lors de l'initialisation du langage ${languageId}:`, error);
        return undefined;
    }
}
/**
 * Initialise tous les langages supportés
 */
export function initializeAllLanguages() {
    const initialized = new Map();
    for (const language of SUPPORTED_LANGUAGES) {
        try {
            language.parser.setLanguage(language.grammar);
            initialized.set(language.id, language);
            console.log(`✅ Langage ${language.name} initialisé`);
        }
        catch (error) {
            console.error(`❌ Erreur lors de l'initialisation de ${language.name}:`, error);
        }
    }
    return initialized;
}
/**
 * Liste des langages disponibles
 */
export function getAvailableLanguages() {
    return SUPPORTED_LANGUAGES.map(lang => ({
        id: lang.id,
        name: lang.name,
        extensions: lang.extensions,
    }));
}
