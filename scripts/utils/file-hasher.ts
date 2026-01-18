// Utilitaire pour calculer le hash MD5 des fichiers
// Utilisé pour détecter les changements de fichiers dans l'audit incrémental

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

/**
 * Calcule le hash MD5 d'un fichier
 * @param filePath Chemin absolu ou relatif du fichier
 * @returns Hash MD5 en hexadécimal, ou null si le fichier n'existe pas ou ne peut pas être lu
 */
export async function getFileHash(filePath: string): Promise<string | null> {
  try {
    // Vérifier que le fichier existe et est accessible
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      console.warn(
        `[file-hasher] Le chemin ${filePath} n'est pas un fichier régulier`,
      );
      return null;
    }

    // Lire le contenu du fichier
    const fileBuffer = await readFile(filePath);

    // Calculer le hash MD5
    const hash = createHash("md5");
    hash.update(fileBuffer);

    return hash.digest("hex");
  } catch (error) {
    if (error instanceof Error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        console.warn(`[file-hasher] Fichier non trouvé: ${filePath}`);
      } else {
        console.error(
          `[file-hasher] Erreur lors du calcul du hash pour ${filePath}:`,
          error.message,
        );
      }
    } else {
      console.error(`[file-hasher] Erreur inconnue pour ${filePath}:`, error);
    }
    return null;
  }
}

/**
 * Calcule le hash MD5 d'une chaîne de caractères
 * @param content Contenu à hasher
 * @returns Hash MD5 en hexadécimal
 */
export function getStringHash(content: string): string {
  const hash = createHash("md5");
  hash.update(content, "utf8");
  return hash.digest("hex");
}

/**
 * Calcule le hash MD5 d'un buffer
 * @param buffer Buffer à hasher
 * @returns Hash MD5 en hexadécimal
 */
export function getBufferHash(buffer: Buffer): string {
  const hash = createHash("md5");
  hash.update(buffer);
  return hash.digest("hex");
}

/**
 * Interface pour les métadonnées d'un fichier avec son hash
 */
export interface FileHashResult {
  /** Chemin du fichier */
  filePath: string;
  /** Hash MD5 du fichier */
  hash: string;
  /** Taille du fichier en octets */
  size: number;
  /** Date de dernière modification */
  lastModified: Date;
  /** Date de calcul du hash */
  computedAt: Date;
}

/**
 * Calcule le hash et les métadonnées d'un fichier
 * @param filePath Chemin du fichier
 * @returns Résultat complet avec métadonnées, ou null en cas d'erreur
 */
export async function getFileHashWithMetadata(
  filePath: string,
): Promise<FileHashResult | null> {
  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      return null;
    }

    const hash = await getFileHash(filePath);
    if (!hash) {
      return null;
    }

    return {
      filePath,
      hash,
      size: fileStats.size,
      lastModified: fileStats.mtime,
      computedAt: new Date(),
    };
  } catch (error) {
    console.error(
      `[file-hasher] Erreur lors du calcul du hash avec métadonnées pour ${filePath}:`,
      error,
    );
    return null;
  }
}

/**
 * Compare deux fichiers par leur hash
 * @param filePath1 Chemin du premier fichier
 * @param filePath2 Chemin du deuxième fichier
 * @returns true si les fichiers ont le même contenu (même hash), false sinon
 */
export async function compareFilesByHash(
  filePath1: string,
  filePath2: string,
): Promise<boolean> {
  try {
    const [hash1, hash2] = await Promise.all([
      getFileHash(filePath1),
      getFileHash(filePath2),
    ]);

    // Si l'un des hashs est null, les fichiers ne sont pas comparables
    if (hash1 === null || hash2 === null) {
      return false;
    }

    return hash1 === hash2;
  } catch (error) {
    console.error(
      `[file-hasher] Erreur lors de la comparaison des fichiers ${filePath1} et ${filePath2}:`,
      error,
    );
    return false;
  }
}

/**
 * Vérifie si un fichier a changé depuis la dernière fois
 * @param filePath Chemin du fichier
 * @param previousHash Hash précédent du fichier
 * @returns Résultat de la comparaison avec le hash actuel
 */
export async function checkFileChange(
  filePath: string,
  previousHash: string,
): Promise<{
  changed: boolean;
  currentHash: string | null;
  sameHash: boolean;
}> {
  const currentHash = await getFileHash(filePath);

  if (currentHash === null) {
    return { changed: true, currentHash: null, sameHash: false };
  }

  const sameHash = currentHash === previousHash;
  return { changed: !sameHash, currentHash, sameHash };
}

/**
 * Calcule les hashs de plusieurs fichiers en parallèle
 * @param filePaths Liste des chemins de fichiers
 * @returns Map des chemins vers leurs hashs (fichiers non trouvés exclus)
 */
export async function getFileHashesBatch(
  filePaths: string[],
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  // Créer toutes les promesses en parallèle
  const promises = filePaths.map(async (filePath) => {
    const hash = await getFileHash(filePath);
    if (hash !== null) {
      results.set(filePath, hash);
    }
  });

  await Promise.all(promises);
  return results;
}

/**
 * Calcule les hashs avec métadonnées de plusieurs fichiers en parallèle
 * @param filePaths Liste des chemins de fichiers
 * @returns Liste des résultats complets
 */
export async function getFileHashesWithMetadataBatch(
  filePaths: string[],
): Promise<FileHashResult[]> {
  const promises = filePaths.map((filePath) =>
    getFileHashWithMetadata(filePath),
  );
  const results = await Promise.all(promises);

  // Filtrer les résultats null
  return results.filter((result): result is FileHashResult => result !== null);
}
