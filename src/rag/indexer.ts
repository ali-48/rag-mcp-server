import fg from "fast-glob";
import fs from "fs";
import { shouldIgnoreFile } from "./ignore-filter.js";
import { IndexOptions } from "./types.js";
import { embedAndStore } from "./vector-store.js";

// Fonction pour découper le texte en chunks
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  const words = text.split(/\s+/);
  
  if (words.length <= chunkSize) {
    return [text];
  }
  
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    const chunk = words.slice(start, end).join(' ');
    chunks.push(chunk);
    
    if (end >= words.length) break;
    start = end - overlap;
  }
  
  return chunks;
}

export async function indexProject(
  projectPath: string,
  options: IndexOptions = {}
): Promise<{
  totalFiles: number;
  indexedFiles: number;
  ignoredFiles: number;
  errors: number;
  chunksCreated: number;
}> {
  const {
    filePatterns = ["**/*.{js,ts,py,md,txt,json,yaml,yml,html,css,scss}"],
    recursive = true,
    chunkSize = 1000,
    chunkOverlap = 200,
  } = options;

  const stats = {
    totalFiles: 0,
    indexedFiles: 0,
    ignoredFiles: 0,
    errors: 0,
    chunksCreated: 0,
  };

  try {
    // Vérifier que le projet existe
    if (!fs.existsSync(projectPath)) {
      throw new Error(`Project path does not exist: ${projectPath}`);
    }

    // Récupérer tous les fichiers
    const files = await fg(filePatterns, {
      cwd: projectPath,
      absolute: true,
      dot: false,
      onlyFiles: true,
      followSymbolicLinks: false,
      ...(recursive ? {} : { deep: 1 }),
    });

    stats.totalFiles = files.length;

    // Traiter chaque fichier
    for (const filePath of files) {
      try {
        // Vérifier si le fichier doit être ignoré
        if (shouldIgnoreFile(filePath, projectPath)) {
          stats.ignoredFiles++;
          continue;
        }

        // Lire le contenu du fichier
        const content = fs.readFileSync(filePath, "utf8");
        
        // Ignorer les fichiers vides ou trop petits
        if (content.trim().length < 10) {
          stats.ignoredFiles++;
          continue;
        }

        // Découper en chunks si nécessaire
        const chunks = chunkSize > 0 ? chunkText(content, chunkSize, chunkOverlap) : [content];
        
        // Stocker chaque chunk dans le vector store
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const chunkFilePath = chunks.length > 1 ? `${filePath}#chunk${i}` : filePath;
          await embedAndStore(projectPath, chunkFilePath, chunk);
          stats.chunksCreated++;
        }
        
        stats.indexedFiles++;

        // Log progress
        if (stats.indexedFiles % 10 === 0) {
          console.error(`Indexed ${stats.indexedFiles}/${files.length} files, ${stats.chunksCreated} chunks...`);
        }
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
        stats.errors++;
      }
    }

    console.error(`Indexation terminée pour ${projectPath}`);
    console.error(`  Total fichiers: ${stats.totalFiles}`);
    console.error(`  Indexés: ${stats.indexedFiles}`);
    console.error(`  Chunks créés: ${stats.chunksCreated}`);
    console.error(`  Ignorés: ${stats.ignoredFiles}`);
    console.error(`  Erreurs: ${stats.errors}`);

    return stats;
  } catch (error) {
    console.error(`Error indexing project ${projectPath}:`, error);
    throw error;
  }
}

export async function updateProject(
  projectPath: string,
  options: IndexOptions = {}
): Promise<{
  totalFiles: number;
  indexedFiles: number;
  ignoredFiles: number;
  errors: number;
  chunksCreated: number;
}> {
  // Pour l'instant, même implémentation que indexProject
  // Plus tard: implémenter l'indexation incrémentale avec Git diff
  console.error(`Mise à jour du projet ${projectPath} (indexation complète)`);
  return indexProject(projectPath, options);
}
