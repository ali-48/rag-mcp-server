/**
 * Segmenter IA pour suggestions de segmentation optimale
 *
 * Ce module utilise Cline ou un modèle léger pour analyser le contenu
 * et suggérer des points de segmentation optimaux pour le chunking.
 */
import { getRagConfigManager } from '../config/rag-config.js';
import { preprocessCode } from './code-preprocessor.js';
import { getLlmCache } from './llm-cache.js';
import { LlmService } from './llm-service.js';
/**
 * Analyse un contenu pour suggérer des points de segmentation optimaux
 *
 * @param content Contenu à analyser
 * @param filePath Chemin du fichier
 * @param contentType Type de contenu
 * @param language Langage de programmation (si code)
 * @returns Analyse de segmentation avec suggestions
 */
export async function analyzeSegmentation(content, filePath, contentType, language) {
    const configManager = getRagConfigManager();
    // Vérifier si l'analyse LLM est activée
    if (configManager.isLlmAnalysisEnabled()) {
        try {
            console.log(`🧠 Analyse LLM activée pour ${filePath} (${contentType})`);
            // Vérifier le cache d'abord
            const cache = getLlmCache();
            const cacheKey = `${filePath}:${contentType}:suggest_structure`;
            const cachedAnalysis = cache.get(content, filePath, 'suggest_structure', contentType);
            if (cachedAnalysis) {
                console.log(`✅ Utilisation du cache pour ${filePath}`);
                return parseLlmAnalysis(cachedAnalysis, content, contentType, language);
            }
            // Si pas dans le cache, appeler le service LLM
            const llmService = new LlmService();
            const llmAnalysis = await llmService.analyzeContent(content, filePath, contentType, 'suggest_structure');
            // Stocker dans le cache
            cache.set(content, filePath, 'suggest_structure', llmAnalysis, contentType);
            console.log(`💾 Analyse LLM mise en cache pour ${filePath}`);
            // Parser la réponse LLM en suggestions
            return parseLlmAnalysis(llmAnalysis, content, contentType, language);
        }
        catch (error) {
            console.error(`❌ Analyse LLM échouée, fallback aux règles: ${error}`);
            // Fallback aux règles heuristiques
        }
    }
    // Analyse basique (règles heuristiques)
    const lines = content.split('\n');
    const suggestions = [];
    // Analyse basée sur le type de contenu
    switch (contentType) {
        case 'code':
            return analyzeCodeSegmentation(content, language, filePath);
        case 'doc':
            return analyzeDocumentationSegmentation(content, filePath);
        case 'config':
            return analyzeConfigSegmentation(content, filePath);
        default:
            return analyzeGenericSegmentation(content, filePath);
    }
}
/**
 * Analyse la segmentation pour le code
 */
async function analyzeCodeSegmentation(content, language, filePath) {
    const suggestions = [];
    try {
        // Utiliser le pré-processeur pour extraire la structure
        if (language && (language === 'javascript' || language === 'typescript' || language === 'python')) {
            const result = preprocessCode(content, language);
            // Suggestions basées sur les fonctions
            for (const func of result.structure.functions) {
                suggestions.push({
                    startLine: func.startLine,
                    endLine: func.endLine,
                    type: 'function',
                    confidence: 0.9,
                    reason: `Fonction ${func.name} avec ${func.parameters.length} paramètres`,
                    contentPreview: func.signature.substring(0, 100),
                });
            }
            // Suggestions basées sur les classes
            for (const cls of result.structure.classes) {
                suggestions.push({
                    startLine: cls.startLine,
                    endLine: cls.endLine,
                    type: 'class',
                    confidence: 0.8,
                    reason: `Classe ${cls.name} avec ${cls.methods.length} méthodes`,
                    contentPreview: `class ${cls.name}`,
                });
            }
            // Analyser la complexité
            const complexityScore = calculateCodeComplexity(result);
            return {
                suggestions,
                optimalChunkSize: complexityScore > 0.7 ? 800 : 1200,
                recommendedStrategy: suggestions.length > 0 ? 'structural' : 'semantic',
                complexityScore,
            };
        }
    }
    catch (error) {
        console.error(`Erreur lors de l'analyse de segmentation du code: ${error.message}`);
    }
    // Fallback: analyse générique
    return analyzeGenericSegmentation(content, filePath || 'unknown');
}
/**
 * Calcule la complexité du code
 */
function calculateCodeComplexity(result) {
    const lines = result.originalContent.split('\n').length;
    const functions = result.metadata.totalFunctions;
    const classes = result.metadata.totalClasses;
    // Métrique simple: densité de structures par ligne
    const structureDensity = (functions + classes) / Math.max(lines, 1);
    // Normaliser entre 0 et 1
    return Math.min(1, structureDensity * 10);
}
/**
 * Analyse la segmentation pour la documentation
 */
async function analyzeDocumentationSegmentation(content, filePath) {
    const suggestions = [];
    const lines = content.split('\n');
    let currentSectionStart = 0;
    let currentSectionLevel = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Détection des en-têtes Markdown
        const headerMatch = line.match(/^(#{1,6})\s+(.+)/);
        if (headerMatch) {
            const level = headerMatch[1].length;
            // Sauvegarder la section précédente
            if (currentSectionStart < i && i - currentSectionStart > 1) {
                suggestions.push({
                    startLine: currentSectionStart + 1,
                    endLine: i,
                    type: 'section',
                    confidence: 0.7,
                    reason: `Section niveau ${currentSectionLevel}`,
                    contentPreview: lines[currentSectionStart]?.substring(0, 100) || '',
                });
            }
            currentSectionStart = i;
            currentSectionLevel = level;
        }
        // Détection des paragraphes (lignes vides)
        if (line.trim() === '' && i > 0 && lines[i - 1].trim() !== '') {
            const paragraphStart = findParagraphStart(lines, i);
            if (paragraphStart < i - 1) {
                suggestions.push({
                    startLine: paragraphStart + 1,
                    endLine: i,
                    type: 'paragraph',
                    confidence: 0.6,
                    reason: 'Paragraphe cohérent',
                    contentPreview: lines[paragraphStart]?.substring(0, 100) || '',
                });
            }
        }
    }
    // Dernière section
    if (currentSectionStart < lines.length - 1) {
        suggestions.push({
            startLine: currentSectionStart + 1,
            endLine: lines.length,
            type: 'section',
            confidence: 0.7,
            reason: `Section niveau ${currentSectionLevel}`,
            contentPreview: lines[currentSectionStart]?.substring(0, 100) || '',
        });
    }
    // Analyser la densité de contenu
    const contentDensity = calculateContentDensity(content);
    return {
        suggestions,
        optimalChunkSize: contentDensity > 0.5 ? 600 : 1000,
        recommendedStrategy: suggestions.length > 2 ? 'structural' : 'semantic',
        complexityScore: contentDensity,
    };
}
/**
 * Trouve le début d'un paragraphe
 */
function findParagraphStart(lines, currentIndex) {
    for (let i = currentIndex - 1; i >= 0; i--) {
        if (lines[i].trim() === '') {
            return i + 1;
        }
    }
    return 0;
}
/**
 * Calcule la densité de contenu
 */
function calculateContentDensity(content) {
    const lines = content.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim().length > 0).length;
    const avgLineLength = lines.reduce((sum, line) => sum + line.length, 0) / Math.max(lines.length, 1);
    // Métrique combinée
    return Math.min(1, (nonEmptyLines / Math.max(lines.length, 1)) * (avgLineLength / 100));
}
/**
 * Analyse la segmentation pour la configuration
 */
async function analyzeConfigSegmentation(content, filePath) {
    const suggestions = [];
    // Pour JSON
    if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
        try {
            const parsed = JSON.parse(content);
            // Fonction récursive pour analyser la structure
            function analyzeObject(obj, path = '', depth = 0) {
                if (Array.isArray(obj)) {
                    if (obj.length > 5 && depth < 3) {
                        suggestions.push({
                            startLine: 0, // Approximation
                            endLine: 0,
                            type: 'logical_block',
                            confidence: 0.7,
                            reason: `Tableau avec ${obj.length} éléments${path ? ` dans ${path}` : ''}`,
                            contentPreview: `[${obj.length} éléments]`,
                        });
                    }
                }
                else if (typeof obj === 'object' && obj !== null) {
                    const keys = Object.keys(obj);
                    if (keys.length > 3 && depth < 2) {
                        suggestions.push({
                            startLine: 0,
                            endLine: 0,
                            type: 'logical_block',
                            confidence: 0.8,
                            reason: `Objet avec ${keys.length} propriétés${path ? `: ${path}` : ''}`,
                            contentPreview: `{${keys.slice(0, 3).join(', ')}...}`,
                        });
                    }
                    // Analyser les sous-objets
                    for (const [key, value] of Object.entries(obj)) {
                        analyzeObject(value, path ? `${path}.${key}` : key, depth + 1);
                    }
                }
            }
            analyzeObject(parsed);
        }
        catch (error) {
            // JSON invalide
        }
    }
    // Pour YAML
    if (content.includes('---\n')) {
        const yamlDocs = content.split('---\n').filter(doc => doc.trim());
        yamlDocs.forEach((doc, index) => {
            suggestions.push({
                startLine: 0,
                endLine: 0,
                type: 'logical_block',
                confidence: 0.9,
                reason: `Document YAML ${index + 1}/${yamlDocs.length}`,
                contentPreview: doc.split('\n')[0]?.substring(0, 100) || '',
            });
        });
    }
    const structureScore = suggestions.length > 0 ? 0.7 : 0.3;
    return {
        suggestions,
        optimalChunkSize: 800,
        recommendedStrategy: suggestions.length > 0 ? 'structural' : 'semantic',
        complexityScore: structureScore,
    };
}
/**
 * Analyse générique pour contenu non spécifique
 */
async function analyzeGenericSegmentation(content, filePath) {
    const suggestions = [];
    const lines = content.split('\n');
    // Détection des blocs logiques (lignes vides)
    let currentBlockStart = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '' && i > currentBlockStart) {
            if (i - currentBlockStart > 1) {
                suggestions.push({
                    startLine: currentBlockStart + 1,
                    endLine: i,
                    type: 'logical_block',
                    confidence: 0.5,
                    reason: 'Bloc logique détecté',
                    contentPreview: lines[currentBlockStart]?.substring(0, 100) || '',
                });
            }
            currentBlockStart = i + 1;
        }
    }
    // Dernier bloc
    if (currentBlockStart < lines.length - 1) {
        suggestions.push({
            startLine: currentBlockStart + 1,
            endLine: lines.length,
            type: 'logical_block',
            confidence: 0.5,
            reason: 'Dernier bloc logique',
            contentPreview: lines[currentBlockStart]?.substring(0, 100) || '',
        });
    }
    const density = calculateContentDensity(content);
    return {
        suggestions,
        optimalChunkSize: density > 0.4 ? 700 : 1200,
        recommendedStrategy: 'semantic',
        complexityScore: density,
    };
}
/**
 * Parse la réponse LLM en suggestions de segmentation
 */
function parseLlmAnalysis(llmAnalysis, content, contentType, language) {
    const lines = content.split('\n');
    const suggestions = [];
    try {
        // Essayer de parser la réponse LLM (format attendu: JSON ou texte structuré)
        if (llmAnalysis.includes('{') && llmAnalysis.includes('}')) {
            // Essayer d'extraire du JSON
            const jsonMatch = llmAnalysis.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
                    parsed.suggestions.forEach((suggestion) => {
                        suggestions.push({
                            startLine: suggestion.startLine || 1,
                            endLine: suggestion.endLine || lines.length,
                            type: suggestion.type || 'logical_block',
                            confidence: suggestion.confidence || 0.7,
                            reason: suggestion.reason || 'Suggestion LLM',
                            contentPreview: suggestion.contentPreview || lines.slice((suggestion.startLine || 1) - 1, (suggestion.endLine || lines.length)).join('\n').substring(0, 100)
                        });
                    });
                }
            }
        }
        // Si pas de JSON, essayer de parser du texte structuré
        if (suggestions.length === 0) {
            const linesAnalysis = llmAnalysis.split('\n');
            let currentSuggestion = null;
            for (const line of linesAnalysis) {
                if (line.includes('Ligne') || line.includes('line') || line.includes('start')) {
                    const lineMatch = line.match(/(\d+)[^\d]*(\d+)?/);
                    if (lineMatch) {
                        if (currentSuggestion) {
                            suggestions.push(currentSuggestion);
                        }
                        currentSuggestion = {
                            startLine: parseInt(lineMatch[1]),
                            endLine: lineMatch[2] ? parseInt(lineMatch[2]) : parseInt(lineMatch[1]) + 10,
                            type: 'logical_block',
                            confidence: 0.6,
                            reason: 'Détection LLM',
                            contentPreview: ''
                        };
                    }
                }
            }
            if (currentSuggestion) {
                suggestions.push(currentSuggestion);
            }
        }
    }
    catch (error) {
        console.error(`❌ Erreur parsing réponse LLM: ${error}`);
    }
    // Si aucune suggestion LLM, créer une suggestion générique
    if (suggestions.length === 0) {
        suggestions.push({
            startLine: 1,
            endLine: Math.min(20, lines.length),
            type: 'logical_block',
            confidence: 0.5,
            reason: 'Analyse LLM générique',
            contentPreview: lines.slice(0, 3).join('\n').substring(0, 100)
        });
    }
    // Calculer la complexité basée sur le type de contenu
    let complexityScore = 0.5;
    if (contentType === 'code')
        complexityScore = 0.7;
    if (contentType === 'config')
        complexityScore = 0.6;
    if (contentType === 'doc')
        complexityScore = 0.4;
    return {
        suggestions,
        optimalChunkSize: complexityScore > 0.6 ? 800 : 1200,
        recommendedStrategy: suggestions.length > 2 ? 'structural' : 'hybrid',
        complexityScore
    };
}
/**
 * Utilise Cline pour obtenir des suggestions de segmentation avancées
 *
 * @param content Contenu à analyser
 * @param filePath Chemin du fichier
 * @param contentType Type de contenu
 * @returns Suggestions IA avancées
 */
export async function getClineSegmentationSuggestions(content, filePath, contentType) {
    // Pour l'instant, utiliser le service LLM
    console.log(`🧠 Utilisation du service LLM pour ${filePath}`);
    const analysis = await analyzeSegmentation(content, filePath, contentType);
    return analysis.suggestions;
}
/**
 * Optimise les chunks existants basé sur les suggestions IA
 *
 * @param chunks Chunks existants
 * @param suggestions Suggestions de segmentation
 * @returns Chunks optimisés
 */
export function optimizeChunksWithSuggestions(chunks, suggestions, originalContent) {
    if (suggestions.length === 0 || chunks.length <= 1) {
        return chunks;
    }
    const lines = originalContent.split('\n');
    const optimizedChunks = [];
    // Pour chaque suggestion, essayer de créer un chunk optimisé
    for (const suggestion of suggestions) {
        if (suggestion.confidence > 0.6 && suggestion.startLine > 0 && suggestion.endLine > suggestion.startLine) {
            const chunkContent = lines.slice(suggestion.startLine - 1, suggestion.endLine).join('\n');
            if (chunkContent.length > 50 && chunkContent.length < 2000) {
                optimizedChunks.push(chunkContent);
            }
        }
    }
    // Si on a des chunks optimisés, les utiliser
    if (optimizedChunks.length > 0) {
        return optimizedChunks;
    }
    // Sinon, garder les chunks originaux
    return chunks;
}
//# sourceMappingURL=ai-segmenter.js.map