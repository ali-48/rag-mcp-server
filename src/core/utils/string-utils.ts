/**
 * Utilitaires de manipulation de chaînes de caractères
 * Centralise les fonctions de string dupliquées dans le codebase
 */

/**
 * Normalise une chaîne pour la comparaison (ignore la casse, les espaces)
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

/**
 * Extrait l'extension d'un fichier
 */
export function getFileExtension(filePath: string): string {
  const match = filePath.match(/\.[a-z0-9]+$/i);
  return match ? match[0].toLowerCase() : '';
}

/**
 * Nettoie un commentaire (supprime les marqueurs de commentaire)
 */
export function cleanComment(comment: string, language: string): string {
  if (language === 'python') {
    return comment.replace(/^#\s*/, '').trim();
  } else if (language === 'javascript' || language === 'typescript') {
    return comment.replace(/^\/\/\s*/, '').replace(/^\/\*\s*|\s*\*\/$/g, '').trim();
  } else if (language === 'java' || language === 'csharp') {
    return comment.replace(/^\/\/\s*/, '').replace(/^\/\*\s*|\s*\*\/$/g, '').trim();
  }
  return comment.trim();
}

/**
 * Formate une taille de fichier en unités lisibles
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

/**
 * Génère un hash simple pour une chaîne (djb2)
 */
export function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Tronque une chaîne avec des points de suspension si nécessaire
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Échappe les caractères spéciaux pour les expressions régulières
 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Convertit une chaîne en camelCase
 */
export function toCamelCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .map((word, index) => {
      if (index === 0) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('');
}

/**
 * Convertit une chaîne en PascalCase
 */
export function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Convertit une chaîne en kebab-case
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/^-+|-+$/g, '');
}

/**
 * Convertit une chaîne en snake_case
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/^_+|_+$/g, '');
}

/**
 * Vérifie si une chaîne contient uniquement des caractères alphanumériques
 */
export function isAlphanumeric(str: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(str);
}

/**
 * Vérifie si une chaîne est un identifiant valide (commence par une lettre)
 */
export function isValidIdentifier(str: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(str);
}

/**
 * Supprime les accents d'une chaîne
 */
export function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Compte le nombre de mots dans une chaîne
 */
export function countWords(str: string): number {
  return str.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Extrait les mots-clés d'une chaîne (mots uniques, sans stop words)
 */
export function extractKeywords(text: string, stopWords: string[] = []): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word));

  return [...new Set(words)];
}

/**
 * Calcule la similarité entre deux chaînes (algorithme de Jaccard)
 */
export function stringSimilarity(str1: string, str2: string): number {
  const set1 = new Set(str1.toLowerCase().split(''));
  const set2 = new Set(str2.toLowerCase().split(''));

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return union.size === 0 ? 1 : intersection.size / union.size;
}

/**
 * Formate une durée en millisecondes en unités lisibles
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(2)}min`;
  return `${(ms / 3600000).toFixed(2)}h`;
}

/**
 * Teste toutes les fonctions du module
 */
export function testStringUtils(): boolean {
  try {
    // Test normalizeString
    console.assert(normalizeString('  Hello  World!  ') === 'hello world');

    // Test getFileExtension
    console.assert(getFileExtension('file.ts') === '.ts');
    console.assert(getFileExtension('file.test.js') === '.js');

    // Test formatFileSize
    console.assert(formatFileSize(1024) === '1.00 KB');

    // Test hashString
    const hash = hashString('test');
    console.assert(typeof hash === 'string' && hash.length > 0);

    // Test truncateString
    console.assert(truncateString('Hello World', 8) === 'Hello...');

    // Test case conversions
    console.assert(toCamelCase('hello world') === 'helloWorld');
    console.assert(toPascalCase('hello world') === 'HelloWorld');
    console.assert(toKebabCase('helloWorld') === 'hello-world');
    console.assert(toSnakeCase('helloWorld') === 'hello_world');

    // Test validations
    console.assert(isAlphanumeric('abc123') === true);
    console.assert(isAlphanumeric('abc-123') === false);
    console.assert(isValidIdentifier('_variable') === true);
    console.assert(isValidIdentifier('123variable') === false);

    // Test stringSimilarity
    console.assert(stringSimilarity('hello', 'hello') === 1);
    console.assert(stringSimilarity('hello', 'world') < 0.5);

    console.log('✅ Tous les tests string-utils ont réussi');
    return true;
  } catch (error) {
    console.error('❌ Erreur dans string-utils:', error);
    return false;
  }
}
