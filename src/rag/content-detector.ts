/**
 * Détecteur de type de contenu pour le pipeline RAG Phase 0
 * 
 * Ce module classe les fichiers en catégories (code, doc, config, other)
 * basé sur l'extension du fichier et l'analyse du contenu.
 */

export type ContentType = 'code' | 'doc' | 'config' | 'other';
export type ProgrammingLanguage = 'javascript' | 'typescript' | 'python' | 'bash' | 'html' | 'css' | 'scss' | 'json' | 'yaml' | 'unknown';

export interface ContentDetectionResult {
  contentType: ContentType;
  language?: ProgrammingLanguage;
  confidence: number; // 0.0 à 1.0
  detectedBy: 'extension' | 'content' | 'mixed';
  metadata: {
    hasCodePatterns?: boolean;
    hasMarkdownHeaders?: boolean;
    hasJsonStructure?: boolean;
    hasYamlStructure?: boolean;
    lineCount?: number;
    avgLineLength?: number;
  };
}

/**
 * Mappage des extensions de fichiers vers les types de contenu
 */
const EXTENSION_TO_CONTENT_TYPE: Record<string, ContentType> = {
  // Code
  '.js': 'code',
  '.ts': 'code',
  '.jsx': 'code',
  '.tsx': 'code',
  '.py': 'code',
  '.java': 'code',
  '.cpp': 'code',
  '.c': 'code',
  '.cs': 'code',
  '.go': 'code',
  '.rs': 'code',
  '.php': 'code',
  '.rb': 'code',
  '.sh': 'code',
  '.bash': 'code',
  '.html': 'code',
  '.css': 'code',
  '.scss': 'code',
  '.sass': 'code',
  '.less': 'code',
  '.sql': 'code',
  '.r': 'code',
  '.m': 'code',
  '.swift': 'code',
  '.kt': 'code',
  '.scala': 'code',
  '.lua': 'code',
  '.pl': 'code',
  '.pm': 'code',
  
  // Documentation
  '.md': 'doc',
  '.txt': 'doc',
  '.rst': 'doc',
  '.tex': 'doc',
  '.adoc': 'doc',
  '.asciidoc': 'doc',
  '.wiki': 'doc',
  '.rtf': 'doc',
  
  // Configuration
  '.json': 'config',
  '.yaml': 'config',
  '.yml': 'config',
  '.toml': 'config',
  '.ini': 'config',
  '.cfg': 'config',
  '.conf': 'config',
  '.properties': 'config',
  '.env': 'config',
  '.xml': 'config',
  
  // Autres (à classifier par contenu)
  '.csv': 'other',
  '.tsv': 'other',
  '.log': 'other',
  '.lock': 'other',
};

/**
 * Mappage des extensions vers les langages de programmation
 */
const EXTENSION_TO_LANGUAGE: Record<string, ProgrammingLanguage> = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.sh': 'bash',
  '.bash': 'bash',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'scss',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
};

/**
 * Patterns pour détection par contenu
 */
const CONTENT_PATTERNS = {
  // Patterns de code
  CODE: {
    FUNCTION_DECLARATION: /\b(function|def|class|interface|enum|const|let|var)\s+\w+/,
    IMPORT_STATEMENT: /\b(import|from|require|include)\b/,
    CONTROL_FLOW: /\b(if|else|for|while|switch|case|break|continue|return)\b/,
    COMMENTS: /(\/\/|\/\*|\*\/|#)/,
    BRACES: /[{}()\[\]]/,
  },
  
  // Patterns de documentation
  DOC: {
    MARKDOWN_HEADERS: /^#{1,6}\s+.+/m,
    MARKDOWN_LISTS: /^[\s]*[-*+]\s+.+/m,
    MARKDOWN_LINKS: /\[[^\]]+\]\([^)]+\)/,
    SENTENCE_END: /[.!?]\s+/,
    PARAGRAPH_BREAK: /\n\s*\n/,
  },
  
  // Patterns de configuration
  CONFIG: {
    JSON_START: /^\s*[\{\[]/,
    YAML_DASH: /^---$/m,
    KEY_VALUE: /^\s*[\w\-]+\s*[:=]/m,
    ENV_VAR: /^\s*[A-Z_][A-Z0-9_]*\s*=/m,
  },
};

/**
 * Détecte le type de contenu basé sur l'extension du fichier
 */
function detectByExtension(filePath: string): { contentType: ContentType; language?: ProgrammingLanguage; confidence: number } {
  const extension = filePath.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || '';
  
  if (EXTENSION_TO_CONTENT_TYPE[extension]) {
    return {
      contentType: EXTENSION_TO_CONTENT_TYPE[extension],
      language: EXTENSION_TO_LANGUAGE[extension],
      confidence: 0.9, // Haute confiance pour les extensions connues
    };
  }
  
  return {
    contentType: 'other',
    confidence: 0.3, // Faible confiance pour extension inconnue
  };
}

/**
 * Analyse le contenu pour détecter des patterns spécifiques
 */
function analyzeContent(content: string): {
  codeScore: number;
  docScore: number;
  configScore: number;
  metadata: ContentDetectionResult['metadata'];
} {
  const lines = content.split('\n');
  const lineCount = lines.length;
  const avgLineLength = content.length / Math.max(lineCount, 1);
  
  let codeScore = 0;
  let docScore = 0;
  let configScore = 0;
  
  const metadata: ContentDetectionResult['metadata'] = {
    lineCount,
    avgLineLength,
    hasCodePatterns: false,
    hasMarkdownHeaders: false,
    hasJsonStructure: false,
    hasYamlStructure: false,
  };
  
  // Vérifier les patterns de code
  if (CONTENT_PATTERNS.CODE.FUNCTION_DECLARATION.test(content)) {
    codeScore += 2;
    metadata.hasCodePatterns = true;
  }
  if (CONTENT_PATTERNS.CODE.IMPORT_STATEMENT.test(content)) {
    codeScore += 1.5;
    metadata.hasCodePatterns = true;
  }
  if (CONTENT_PATTERNS.CODE.CONTROL_FLOW.test(content)) {
    codeScore += 1;
    metadata.hasCodePatterns = true;
  }
  if (CONTENT_PATTERNS.CODE.COMMENTS.test(content)) {
    codeScore += 0.5;
  }
  if (CONTENT_PATTERNS.CODE.BRACES.test(content)) {
    codeScore += 0.5;
  }
  
  // Vérifier les patterns de documentation
  if (CONTENT_PATTERNS.DOC.MARKDOWN_HEADERS.test(content)) {
    docScore += 3;
    metadata.hasMarkdownHeaders = true;
  }
  if (CONTENT_PATTERNS.DOC.MARKDOWN_LISTS.test(content)) {
    docScore += 1.5;
  }
  if (CONTENT_PATTERNS.DOC.MARKDOWN_LINKS.test(content)) {
    docScore += 1;
  }
  if (CONTENT_PATTERNS.DOC.SENTENCE_END.test(content)) {
    docScore += 0.5;
  }
  if (CONTENT_PATTERNS.DOC.PARAGRAPH_BREAK.test(content)) {
    docScore += 0.5;
  }
  
  // Vérifier les patterns de configuration
  if (CONTENT_PATTERNS.CONFIG.JSON_START.test(content)) {
    configScore += 3;
    metadata.hasJsonStructure = true;
  }
  if (CONTENT_PATTERNS.CONFIG.YAML_DASH.test(content)) {
    configScore += 2;
    metadata.hasYamlStructure = true;
  }
  if (CONTENT_PATTERNS.CONFIG.KEY_VALUE.test(content)) {
    configScore += 1;
  }
  if (CONTENT_PATTERNS.CONFIG.ENV_VAR.test(content)) {
    configScore += 1;
  }
  
  // Normaliser les scores par longueur de contenu
  const normalizationFactor = Math.min(100, lineCount) / 100;
  codeScore *= normalizationFactor;
  docScore *= normalizationFactor;
  configScore *= normalizationFactor;
  
  return { codeScore, docScore, configScore, metadata };
}

/**
 * Détecte le langage de programmation basé sur le contenu
 */
function detectLanguageByContent(content: string): ProgrammingLanguage | undefined {
  // Patterns spécifiques aux langages
  const languagePatterns: Array<{ pattern: RegExp; language: ProgrammingLanguage }> = [
    { pattern: /\bconsole\.log|function\s+\w+\s*\(|const\s+\w+\s*=/, language: 'javascript' },
    { pattern: /\binterface\s+\w+|type\s+\w+\s*=/, language: 'typescript' },
    { pattern: /\bdef\s+\w+\s*\(|import\s+\w+|from\s+\w+\s+import/, language: 'python' },
    { pattern: /^#!\/bin\/(bash|sh)|echo\s+"/, language: 'bash' },
    { pattern: /<!DOCTYPE html>|<html|<head|<body/, language: 'html' },
    { pattern: /\.selector\s*\{|@media|#id\s*\{/, language: 'css' },
    { pattern: /\$[a-z-]+:|@mixin|@include/, language: 'scss' },
    { pattern: /^\s*\{|^\s*\[/, language: 'json' },
    { pattern: /^---$|^[a-z_]+:/m, language: 'yaml' },
  ];
  
  for (const { pattern, language } of languagePatterns) {
    if (pattern.test(content)) {
      return language;
    }
  }
  
  return undefined;
}

/**
 * Détecte le type de contenu d'un fichier
 * 
 * @param filePath Chemin du fichier
 * @param content Contenu du fichier (optionnel, pour analyse plus précise)
 * @returns Résultat de la détection
 */
export function detectContentType(
  filePath: string,
  content?: string
): ContentDetectionResult {
  // Détection basée sur l'extension
  const extensionDetection = detectByExtension(filePath);
  
  // Si pas de contenu fourni, retourner la détection par extension
  if (!content) {
    return {
      contentType: extensionDetection.contentType,
      language: extensionDetection.language,
      confidence: extensionDetection.confidence,
      detectedBy: 'extension',
      metadata: {},
    };
  }
  
  // Analyse du contenu
  const { codeScore, docScore, configScore, metadata } = analyzeContent(content);
  const languageFromContent = detectLanguageByContent(content);
  
  // Détection par contenu
  let contentTypeByContent: ContentType = 'other';
  let confidenceByContent = 0.5;
  
  const maxScore = Math.max(codeScore, docScore, configScore);
  if (maxScore > 1) {
    if (maxScore === codeScore) {
      contentTypeByContent = 'code';
      confidenceByContent = Math.min(0.9, maxScore / 5);
    } else if (maxScore === docScore) {
      contentTypeByContent = 'doc';
      confidenceByContent = Math.min(0.9, maxScore / 5);
    } else if (maxScore === configScore) {
      contentTypeByContent = 'config';
      confidenceByContent = Math.min(0.9, maxScore / 5);
    }
  }
  
  // Fusionner les résultats (extension + contenu)
  let finalContentType: ContentType;
  let finalConfidence: number;
  let detectedBy: 'extension' | 'content' | 'mixed' = 'mixed';
  
  if (extensionDetection.confidence > 0.8) {
    // Haute confiance dans l'extension
    finalContentType = extensionDetection.contentType;
    finalConfidence = extensionDetection.confidence;
    detectedBy = 'extension';
    
    // Vérifier si le contenu confirme
    if (contentTypeByContent === extensionDetection.contentType) {
      finalConfidence = Math.min(0.95, finalConfidence + 0.1);
    } else if (confidenceByContent > 0.7) {
      // Contenu suggère un type différent avec haute confiance
      finalContentType = contentTypeByContent;
      finalConfidence = confidenceByContent;
      detectedBy = 'content';
    }
  } else {
    // Faible confiance dans l'extension, utiliser le contenu
    if (confidenceByContent > 0.6) {
      finalContentType = contentTypeByContent;
      finalConfidence = confidenceByContent;
      detectedBy = 'content';
    } else {
      finalContentType = extensionDetection.contentType;
      finalConfidence = extensionDetection.confidence;
      detectedBy = 'extension';
    }
  }
  
  // Déterminer le langage
  let language = extensionDetection.language || languageFromContent;
  
  // Si c'est du code mais pas de langage détecté, essayer de deviner
  if (finalContentType === 'code' && !language) {
    const ext = filePath.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
    language = EXTENSION_TO_LANGUAGE[ext || ''] || 'unknown';
  }
  
  return {
    contentType: finalContentType,
    language,
    confidence: finalConfidence,
    detectedBy,
    metadata,
  };
}

/**
 * Détecte le rôle d'un chunk de code
 * 
 * @param content Contenu du chunk
 * @param contentType Type de contenu
 * @param filePath Chemin du fichier
 * @returns Rôle probable ('core', 'helper', 'test', 'example', 'template', 'other')
 */
export function detectRole(
  content: string,
  contentType: ContentType,
  filePath: string
): 'core' | 'helper' | 'test' | 'example' | 'template' | 'other' {
  const lowerContent = content.toLowerCase();
  const lowerFilePath = filePath.toLowerCase();
  
  // Détection basée sur le chemin du fichier
  if (lowerFilePath.includes('test') || lowerFilePath.includes('spec')) {
    return 'test';
  }
  
  if (lowerFilePath.includes('example') || lowerFilePath.includes('demo')) {
    return 'example';
  }
  
  if (lowerFilePath.includes('template') || lowerFilePath.includes('boilerplate')) {
    return 'template';
  }
  
  if (lowerFilePath.includes('util') || lowerFilePath.includes('helper') || lowerFilePath.includes('common')) {
    return 'helper';
  }
  
  // Détection basée sur le contenu
  if (contentType === 'code') {
    // Patterns pour les tests
    if (lowerContent.includes('describe(') || lowerContent.includes('it(') || 
        lowerContent.includes('test(') || lowerContent.includes('assert') ||
        lowerContent.includes('expect(')) {
      return 'test';
    }
    
    // Patterns pour les exemples
    if (lowerContent.includes('example') || lowerContent.includes('demo') ||
        lowerContent.includes('// example') || lowerContent.includes('# example')) {
      return 'example';
    }
    
    // Patterns pour les utilitaires/helpers
    if (lowerContent.includes('export function') || lowerContent.includes('export const') ||
        lowerContent.includes('export class') || lowerContent.includes('export default')) {
      // Vérifier si c'est une fonction utilitaire
      const utilityPatterns = [
        /\butils?\b/, /\bhelpers?\b/, /\bcommon\b/, /\btools?\b/,
        /\bformat\b/, /\bparse\b/, /\bvalidate\b/, /\bcalculate\b/,
      ];
      
      for (const pattern of utilityPatterns) {
        if (pattern.test(lowerContent)) {
          return 'helper';
        }
      }
      
      return 'core';
    }
  }
  
  // Par défaut
  return contentType === 'code' ? 'core' : 'other';
}

/**
 * Extrait l'extension d'un fichier
 */
export function getFileExtension(filePath: string): string {
  const match = filePath.match(/\.[a-z0-9]+$/i);
  return match ? match[0].toLowerCase() : '';
}

/**
 * Détecte le langage de programmation basé sur l'extension
 */
export function detectLanguageByExtension(filePath: string): ProgrammingLanguage | undefined {
  const extension = getFileExtension(filePath);
  return EXTENSION_TO_LANGUAGE[extension];
}
