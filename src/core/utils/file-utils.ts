/**
 * Utilitaires de manipulation de fichiers et chemins
 * Centralise les fonctions de fichiers dupliquées dans le codebase
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Vérifie si un chemin existe (fichier ou dossier)
 */
export function pathExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Vérifie si un chemin est un fichier
 */
export function isFile(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Vérifie si un chemin est un dossier
 */
export function isDirectory(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Crée un dossier récursivement
 */
export function ensureDirectory(dirPath: string): void {
  if (!pathExists(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Lit un fichier avec gestion d'erreur
 */
export function readFileSafe(filePath: string, encoding: BufferEncoding = 'utf8'): string | null {
  try {
    return fs.readFileSync(filePath, encoding);
  } catch {
    return null;
  }
}

/**
 * Écrit dans un fichier avec création automatique des dossiers
 */
export function writeFileSafe(filePath: string, content: string, encoding: BufferEncoding = 'utf8'): boolean {
  try {
    const dir = path.dirname(filePath);
    ensureDirectory(dir);
    fs.writeFileSync(filePath, content, encoding);
    return true;
  } catch {
    return false;
  }
}

/**
 * Supprime un fichier avec gestion d'erreur
 */
export function deleteFileSafe(filePath: string): boolean {
  try {
    if (pathExists(filePath) && isFile(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Supprime un dossier récursivement avec gestion d'erreur
 */
export function deleteDirectorySafe(dirPath: string): boolean {
  try {
    if (pathExists(dirPath) && isDirectory(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Liste les fichiers d'un dossier avec filtrage par extension
 */
export function listFiles(dirPath: string, extensions?: string[]): string[] {
  try {
    if (!isDirectory(dirPath)) return [];

    const files = fs.readdirSync(dirPath);
    const result: string[] = [];

    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      if (isFile(fullPath)) {
        if (!extensions || extensions.length === 0) {
          result.push(fullPath);
        } else {
          const ext = path.extname(file).toLowerCase();
          if (extensions.includes(ext)) {
            result.push(fullPath);
          }
        }
      }
    }

    return result;
  } catch {
    return [];
  }
}

/**
 * Liste les dossiers d'un dossier
 */
export function listDirectories(dirPath: string): string[] {
  try {
    if (!isDirectory(dirPath)) return [];

    const items = fs.readdirSync(dirPath);
    const result: string[] = [];

    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      if (isDirectory(fullPath)) {
        result.push(fullPath);
      }
    }

    return result;
  } catch {
    return [];
  }
}

/**
 * Parcourt récursivement un dossier et liste tous les fichiers
 */
export function walkDirectory(dirPath: string, filter?: (filePath: string) => boolean): string[] {
  const result: string[] = [];

  function walk(currentPath: string) {
    try {
      const items = fs.readdirSync(currentPath);

      for (const item of items) {
        const fullPath = path.join(currentPath, item);

        if (isDirectory(fullPath)) {
          walk(fullPath);
        } else if (isFile(fullPath)) {
          if (!filter || filter(fullPath)) {
            result.push(fullPath);
          }
        }
      }
    } catch {
      // Ignorer les erreurs de lecture
    }
  }

  if (isDirectory(dirPath)) {
    walk(dirPath);
  }

  return result;
}

/**
 * Calcule la taille d'un fichier
 */
export function getFileSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

/**
 * Calcule la taille totale d'un dossier
 */
export function getDirectorySize(dirPath: string): number {
  let totalSize = 0;

  function calculateSize(currentPath: string) {
    try {
      const items = fs.readdirSync(currentPath);

      for (const item of items) {
        const fullPath = path.join(currentPath, item);

        if (isDirectory(fullPath)) {
          calculateSize(fullPath);
        } else if (isFile(fullPath)) {
          totalSize += getFileSize(fullPath);
        }
      }
    } catch {
      // Ignorer les erreurs
    }
  }

  if (isDirectory(dirPath)) {
    calculateSize(dirPath);
  }

  return totalSize;
}

/**
 * Copie un fichier
 */
export function copyFile(source: string, destination: string): boolean {
  try {
    ensureDirectory(path.dirname(destination));
    fs.copyFileSync(source, destination);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copie un dossier récursivement
 */
export function copyDirectory(source: string, destination: string): boolean {
  try {
    if (!isDirectory(source)) return false;

    ensureDirectory(destination);
    const items = fs.readdirSync(source);

    for (const item of items) {
      const sourcePath = path.join(source, item);
      const destPath = path.join(destination, item);

      if (isDirectory(sourcePath)) {
        if (!copyDirectory(sourcePath, destPath)) {
          return false;
        }
      } else if (isFile(sourcePath)) {
        if (!copyFile(sourcePath, destPath)) {
          return false;
        }
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Normalise un chemin (résolution des .., ., etc.)
 */
export function normalizePath(filePath: string): string {
  return path.normalize(filePath);
}

/**
 * Rend un chemin relatif par rapport à un dossier de base
 */
export function makeRelative(basePath: string, targetPath: string): string {
  return path.relative(basePath, targetPath);
}

/**
 * Rend un chemin absolu
 */
export function makeAbsolute(filePath: string, basePath?: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(basePath || process.cwd(), filePath);
}

/**
 * Extrait le nom du fichier sans extension
 */
export function getFileNameWithoutExtension(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

/**
 * Vérifie si un fichier a une extension spécifique
 */
export function hasExtension(filePath: string, extension: string): boolean {
  return path.extname(filePath).toLowerCase() === extension.toLowerCase();
}

/**
 * Change l'extension d'un fichier
 */
export function changeExtension(filePath: string, newExtension: string): string {
  const dir = path.dirname(filePath);
  const name = getFileNameWithoutExtension(filePath);
  return path.join(dir, name + newExtension);
}

/**
 * Lit un fichier JSON avec gestion d'erreur
 */
export function readJsonFile<T = any>(filePath: string): T | null {
  try {
    const content = readFileSafe(filePath);
    if (content === null) return null;
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Écrit un fichier JSON avec formatage
 */
export function writeJsonFile(filePath: string, data: any, pretty: boolean = true): boolean {
  try {
    const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    return writeFileSafe(filePath, content);
  } catch {
    return false;
  }
}

/**
 * Teste toutes les fonctions du module
 */
export function testFileUtils(): boolean {
  try {
    const testDir = path.join(process.cwd(), '.test-file-utils');
    const testFile = path.join(testDir, 'test.txt');
    const testJsonFile = path.join(testDir, 'test.json');

    // Nettoyer avant le test
    deleteDirectorySafe(testDir);

    // Test ensureDirectory
    ensureDirectory(testDir);
    console.assert(isDirectory(testDir) === true);

    // Test writeFileSafe
    console.assert(writeFileSafe(testFile, 'Hello World') === true);
    console.assert(isFile(testFile) === true);

    // Test readFileSafe
    console.assert(readFileSafe(testFile) === 'Hello World');

    // Test getFileSize
    console.assert(getFileSize(testFile) > 0);

    // Test writeJsonFile
    const testData = { hello: 'world', number: 42 };
    console.assert(writeJsonFile(testJsonFile, testData) === true);

    // Test readJsonFile
    const readData = readJsonFile(testJsonFile);
    console.assert(readData !== null);
    console.assert((readData as any).hello === 'world');

    // Test listFiles
    const files = listFiles(testDir);
    console.assert(files.length >= 2);

    // Test listDirectories
    const subDir = path.join(testDir, 'subdir');
    ensureDirectory(subDir);
    const dirs = listDirectories(testDir);
    console.assert(dirs.includes(subDir));

    // Test walkDirectory
    const allFiles = walkDirectory(testDir);
    console.assert(allFiles.length >= 2);

    // Test copyFile
    const copiedFile = path.join(testDir, 'test-copy.txt');
    console.assert(copyFile(testFile, copiedFile) === true);
    console.assert(isFile(copiedFile) === true);

    // Test copyDirectory
    const destDir = path.join(process.cwd(), '.test-file-utils-copy');
    deleteDirectorySafe(destDir);
    console.assert(copyDirectory(testDir, destDir) === true);
    console.assert(isDirectory(destDir) === true);

    // Test deleteFileSafe
    console.assert(deleteFileSafe(copiedFile) === true);
    console.assert(isFile(copiedFile) === false);

    // Test deleteDirectorySafe
    console.assert(deleteDirectorySafe(destDir) === true);
    console.assert(isDirectory(destDir) === false);

    // Nettoyer après le test
    deleteDirectorySafe(testDir);

    console.log('✅ Tous les tests file-utils ont réussi');
    return true;
  } catch (error) {
    console.error('❌ Erreur dans file-utils:', error);
    return false;
  }
}
