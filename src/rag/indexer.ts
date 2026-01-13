import fg from "fast-glob";
import fs from "fs";
import { getRagConfigManager } from "../config/rag-config.js";
import { analyzeSegmentation, optimizeChunksWithSuggestions } from "./ai-segmenter.js";
import { preprocessCode } from "./code-preprocessor.js";
import { ContentType, ProgrammingLanguage, detectContentType } from "./content-detector.js";
import { shouldIgnoreFile } from "./ignore-filter.js";
import { getLlmCache } from "./llm-cache.js";
import { initLLMEnricher } from "./phase0/llm-enrichment/index.js";
import { IndexOptions } from "./types.js";
import { embedAndStore } from "./vector-store.js";

// Fonction pour découper le texte en chunks de manière intelligente
async function chunkIntelligently(
  text: string,
  filePath: string,
  contentType: ContentType,
  language?: ProgrammingLanguage,
  chunkSize: number = 1000,
  overlap: number = 200
): Promise<string[]> {
  const chunks: string[] = [];

  // Si le texte est court, retourner le texte entier
  if (text.length <= chunkSize * 4) { // Estimation basée sur caractères
    return [text];
  }

  // Chunking basé sur le type de contenu
  switch (contentType) {
    case 'code':
      return await chunkCodeIntelligently(text, language, chunkSize, overlap);

    case 'doc':
      return chunkDocumentationIntelligently(text, chunkSize, overlap);

    case 'config':
      // Pour les fichiers de config, garder ensemble si possible
      if (text.length <= chunkSize * 8) {
        return [text];
      }
      // Sinon, découper par sections logiques
      return chunkConfigIntelligently(text, chunkSize, overlap);

    default:
      // Fallback au chunking par mots
      return chunkByWords(text, chunkSize, overlap);
  }
}

// Découpage intelligent pour le code
async function chunkCodeIntelligently(
  text: string,
  language?: ProgrammingLanguage,
  chunkSize: number = 1000,
  overlap: number = 200
): Promise<string[]> {
  const chunks: string[] = [];

  try {
    // Utiliser le pré-processeur pour extraire la structure
    if (language && (language === 'javascript' || language === 'typescript' || language === 'python')) {
      const result = preprocessCode(text, language);

      // Créer des chunks par fonction
      for (const func of result.structure.functions) {
        const chunk = func.body;
        if (chunk.length > 50 && chunk.length < chunkSize * 4) {
          chunks.push(chunk);
        } else if (chunk.length >= chunkSize * 4) {
          // Fonction trop longue, découper par sous-blocs
          const subChunks = chunkByWords(chunk, chunkSize, overlap);
          chunks.push(...subChunks);
        }
      }

      // Créer des chunks par classe
      for (const cls of result.structure.classes) {
        const chunk = text.substring(
          text.indexOf(cls.name, cls.startLine),
          text.length // Approximation
        );
        if (chunk.length > 50 && chunk.length < chunkSize * 4) {
          chunks.push(chunk);
        } else if (chunk.length >= chunkSize * 4) {
          const subChunks = chunkByWords(chunk, chunkSize, overlap);
          chunks.push(...subChunks);
        }
      }

      // Si on a trouvé des chunks structurels, les retourner
      if (chunks.length > 0) {
        // Optimiser avec les suggestions IA
        try {
          const analysis = await analyzeSegmentation(text, 'unknown', 'code', language);
          return optimizeChunksWithSuggestions(chunks, analysis.suggestions, text);
        } catch (aiError) {
          // Si l'analyse IA échoue, retourner les chunks originaux
          console.error(`Erreur lors de l'analyse IA: ${(aiError as Error).message}`);
          return chunks;
        }
      }
    }
  } catch (error) {
    console.error(`Erreur lors du pré-traitement du code: ${(error as Error).message}`);
    // Fallback au chunking par mots
  }

  // Fallback: découpage par blocs logiques (basé sur les lignes vides)
  return chunkByLogicalBlocks(text, chunkSize, overlap);
}

// Découpage intelligent pour la documentation
function chunkDocumentationIntelligently(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
  const chunks: string[] = [];
  const lines = text.split('\n');

  let currentChunk: string[] = [];
  let currentSize = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineSize = line.length + 1; // +1 pour le saut de ligne

    // Détection des sections Markdown (##, ###, etc.)
    const isSectionHeader = line.match(/^#{1,6}\s+.+/);

    if (isSectionHeader && currentSize > 0) {
      // Nouvelle section, sauvegarder le chunk actuel
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
        currentSize = 0;
      }
    }

    // Ajouter la ligne au chunk actuel
    currentChunk.push(line);
    currentSize += lineSize;

    // Si le chunk atteint la taille maximale, le sauvegarder
    if (currentSize >= chunkSize) {
      chunks.push(currentChunk.join('\n'));
      currentChunk = [];
      currentSize = 0;

      // Ajouter un chevauchement si nécessaire
      if (overlap > 0 && i < lines.length - 1) {
        const overlapLines = Math.min(overlap / 50, 5); // Estimation: ~50 caractères par ligne
        for (let j = Math.max(0, i - overlapLines + 1); j <= i; j++) {
          currentChunk.push(lines[j]);
          currentSize += lines[j].length + 1;
        }
      }
    }
  }

  // Ajouter le dernier chunk s'il n'est pas vide
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n'));
  }

  return chunks.length > 0 ? chunks : chunkByWords(text, chunkSize, overlap);
}

// Découpage intelligent pour la configuration
function chunkConfigIntelligently(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
  // Pour JSON, essayer de découper par objets/tableaux
  if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
    try {
      // Essayer de parser comme JSON
      const parsed = JSON.parse(text);
      const chunks: string[] = [];

      // Fonction récursive pour extraire des chunks
      function extractChunks(obj: any, path: string = ''): void {
        const jsonStr = JSON.stringify(obj, null, 2);
        if (jsonStr.length <= chunkSize) {
          chunks.push(jsonStr);
        } else if (Array.isArray(obj)) {
          // Pour les tableaux, découper par éléments
          for (let i = 0; i < obj.length; i++) {
            extractChunks(obj[i], `${path}[${i}]`);
          }
        } else if (typeof obj === 'object' && obj !== null) {
          // Pour les objets, découper par propriétés
          for (const [key, value] of Object.entries(obj)) {
            extractChunks(value, path ? `${path}.${key}` : key);
          }
        }
      }

      extractChunks(parsed);
      if (chunks.length > 0) {
        return chunks;
      }
    } catch (error) {
      // JSON invalide, fallback
    }
  }

  // Pour YAML, découper par documents (---)
  if (text.includes('---\n')) {
    const yamlDocs = text.split('---\n').filter(doc => doc.trim());
    const chunks: string[] = [];

    for (const doc of yamlDocs) {
      if (doc.length <= chunkSize) {
        chunks.push(doc);
      } else {
        // Découper par sections (basé sur l'indentation)
        const subChunks = chunkByLogicalBlocks(doc, chunkSize, overlap);
        chunks.push(...subChunks);
      }
    }

    if (chunks.length > 0) {
      return chunks;
    }
  }

  // Fallback: découpage par blocs logiques
  return chunkByLogicalBlocks(text, chunkSize, overlap);
}

// Découpage par blocs logiques (lignes vides)
function chunkByLogicalBlocks(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/);

  let currentChunk: string[] = [];
  let currentSize = 0;

  for (const paragraph of paragraphs) {
    const paragraphSize = paragraph.length + 2; // +2 pour les sauts de ligne

    if (currentSize + paragraphSize > chunkSize && currentSize > 0) {
      // Sauvegarder le chunk actuel
      chunks.push(currentChunk.join('\n\n'));
      currentChunk = [];
      currentSize = 0;
    }

    currentChunk.push(paragraph);
    currentSize += paragraphSize;
  }

  // Ajouter le dernier chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n\n'));
  }

  return chunks.length > 0 ? chunks : chunkByWords(text, chunkSize, overlap);
}

// Découpage par mots (fallback)
function chunkByWords(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
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

// Fonction legacy pour compatibilité
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  return chunkByWords(text, chunkSize, overlap);
}

// Exporter les fonctions de chunking pour les tests
export { chunkIntelligently };

export async function indexProject(
  projectPath: string,
  options: IndexOptions = {}
): Promise<{
  totalFiles: number;
  indexedFiles: number;
  ignoredFiles: number;
  errors: number;
  chunksCreated: number;
  phase03Metrics?: any;
}> {
  const {
    filePatterns = ["**/*.{js,ts,py,md,txt,json,yaml,yml,html,css,scss}"],
    recursive = true,
    chunkSize = 1000,
    chunkOverlap = 200,
  } = options;

  // Initialiser le cache LLM
  const llmCache = getLlmCache();
  console.log(`🧠 Cache LLM initialisé: TTL=${llmCache.getStats().maxSize} entrées max`);

  // Initialiser le service LLM Enricher (Phase 0.3)
  const configManager = getRagConfigManager();
  const config = configManager.getConfig();
  const phase03Config = (config as any).phase0_3 || { enabled: false };

  const llmEnricher = initLLMEnricher({
    enabled: phase03Config.enabled || false,
    provider: phase03Config.provider || 'ollama',
    model: phase03Config.model || 'llama3.1:latest',
    temperature: phase03Config.temperature || 0.1,
    maxTokens: phase03Config.max_tokens || 1000,
    timeoutMs: phase03Config.timeout_ms || 30000,
    batchSize: phase03Config.batch_size || 5,
    features: phase03Config.features || ['summary', 'keywords', 'entities'],
    cacheEnabled: phase03Config.cache_enabled || true,
    cacheTtlSeconds: phase03Config.cache_ttl_seconds || 3600,
  });

  if (llmEnricher.isEnrichmentEnabled()) {
    console.log(`🧠 Phase 0.3 - LLM Enrichment ACTIVÉ: ${phase03Config.provider}/${phase03Config.model}`);
  } else {
    console.log(`🧠 Phase 0.3 - LLM Enrichment DÉSACTIVÉ (feature flag)`);
  }

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

        // Détecter le type de contenu et le langage
        const detection = detectContentType(filePath, content);
        const contentType = detection.contentType;
        const language = detection.language;

        // Découper en chunks de manière intelligente
        const chunks = chunkSize > 0
          ? await chunkIntelligently(content, filePath, contentType, language, chunkSize, chunkOverlap)
          : [content];

        // Phase 0.3 - Enrichissement LLM optionnel
        const enrichedChunks: Array<{ id: string; content: string; metadata: any }> = [];

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const chunkId = `${filePath}#chunk${i}`;

          enrichedChunks.push({
            id: chunkId,
            content: chunk,
            metadata: {
              language,
              fileType: contentType,
              filePath,
              projectPath,
              chunkIndex: i,
              totalChunks: chunks.length,
              role: contentType === 'code' ? 'core' :
                contentType === 'doc' ? 'example' :
                  contentType === 'config' ? 'template' : 'other',
              contentType,
            }
          });
        }

        // Enrichir les chunks si Phase 0.3 activée
        let enrichedResults = null;
        if (llmEnricher.isEnrichmentEnabled() && enrichedChunks.length > 0) {
          try {
            console.log(`🧠 Phase 0.3 - Enrichissement de ${enrichedChunks.length} chunks...`);
            enrichedResults = await llmEnricher.enrichBatch(enrichedChunks);
            console.log(`🧠 Phase 0.3 - Enrichissement terminé: ${enrichedResults.filter(r => r !== null).length}/${enrichedChunks.length} succès`);
          } catch (enrichmentError) {
            console.error(`❌ Erreur Phase 0.3: ${enrichmentError instanceof Error ? enrichmentError.message : String(enrichmentError)}`);
            enrichedResults = null;
          }
        }

        // Stocker chaque chunk dans le vector store avec métadonnées
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const chunkFilePath = chunks.length > 1 ? `${filePath}#chunk${i}` : filePath;

          // Utiliser le contenu enrichi si disponible, sinon le contenu original
          let chunkContent = chunk;
          let enrichmentMetadata = {};

          if (enrichedResults && enrichedResults[i]) {
            const enriched = enrichedResults[i];
            if (enriched) {
              chunkContent = enriched.enrichedContent;
              enrichmentMetadata = {
                enrichment_summary: enriched.metadata.summary,
                enrichment_keywords: enriched.metadata.keywords,
                enrichment_entities: enriched.metadata.entities,
                enrichment_complexity: enriched.metadata.complexity,
                enrichment_category: enriched.metadata.category,
                enrichment_language: enriched.metadata.language,
                enrichment_confidence: enriched.metadata.confidence,
                enrichment_model: enriched.modelUsed,
                enrichment_time_ms: enriched.enrichmentTimeMs,
              };
            }
          }

          await embedAndStore(projectPath, chunkFilePath, chunkContent, {
            chunkIndex: i,
            totalChunks: chunks.length,
            contentType: contentType,
            language: language,
            fileExtension: filePath.split('.').pop() || undefined,
            linesCount: chunkContent.split('\n').length,
            role: contentType === 'code' ? 'core' :
              contentType === 'doc' ? 'example' :
                contentType === 'config' ? 'template' : 'other',
            ...enrichmentMetadata,
          });

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

    // Afficher les statistiques du cache
    const cacheStats = llmCache.getStats();
    console.error(`📊 Statistiques cache LLM: ${cacheStats.hits} hits, ${cacheStats.misses} misses, ratio: ${(cacheStats.hitRatio * 100).toFixed(1)}%`);

    // Récupérer les métriques Phase 0.3
    const phase03Metrics = llmEnricher.getStats();
    if (llmEnricher.isEnrichmentEnabled()) {
      console.error(`🧠 Phase 0.3 Métriques:`);
      console.error(`  Chunks traités: ${phase03Metrics.totalProcessed}`);
      console.error(`  Chunks enrichis: ${phase03Metrics.totalEnriched}`);
      console.error(`  Taux succès: ${(phase03Metrics.successRate * 100).toFixed(1)}%`);
      console.error(`  Temps moyen: ${phase03Metrics.averageTimeMs.toFixed(0)}ms`);
      console.error(`  Erreurs: ${phase03Metrics.errors}`);
    }

    console.error(`Indexation terminée pour ${projectPath}`);
    console.error(`  Total fichiers: ${stats.totalFiles}`);
    console.error(`  Indexés: ${stats.indexedFiles}`);
    console.error(`  Chunks créés: ${stats.chunksCreated}`);
    console.error(`  Ignorés: ${stats.ignoredFiles}`);
    console.error(`  Erreurs: ${stats.errors}`);

    return {
      ...stats,
      phase03Metrics: llmEnricher.isEnrichmentEnabled() ? phase03Metrics : undefined
    };
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
  modifiedFiles: number;
  deletedFiles: number;
  unchangedFiles: number;
  phase03Metrics?: any;
}> {
  const {
    filePatterns = ["**/*.{js,ts,py,md,txt,json,yaml,yml,html,css,scss}"],
    recursive = true,
    chunkSize = 1000,
    chunkOverlap = 200,
  } = options;

  // Initialiser le service LLM Enricher (Phase 0.3)
  const configManager = getRagConfigManager();
  const config = configManager.getConfig();
  const phase03Config = (config as any).phase0_3 || { enabled: false };

  const llmEnricher = initLLMEnricher({
    enabled: phase03Config.enabled || false,
    provider: phase03Config.provider || 'ollama',
    model: phase03Config.model || 'llama3.1:latest',
    temperature: phase03Config.temperature || 0.1,
    maxTokens: phase03Config.max_tokens || 1000,
    timeoutMs: phase03Config.timeout_ms || 30000,
    batchSize: phase03Config.batch_size || 5,
    features: phase03Config.features || ['summary', 'keywords', 'entities'],
    cacheEnabled: phase03Config.cache_enabled || true,
    cacheTtlSeconds: phase03Config.cache_ttl_seconds || 3600,
  });

  const stats = {
    totalFiles: 0,
    indexedFiles: 0,
    ignoredFiles: 0,
    errors: 0,
    chunksCreated: 0,
    modifiedFiles: 0,
    deletedFiles: 0,
    unchangedFiles: 0,
  };

  try {
    // Vérifier que le projet existe
    if (!fs.existsSync(projectPath)) {
      throw new Error(`Project path does not exist: ${projectPath}`);
    }

    // Vérifier si c'est un dépôt Git
    const isGitRepo = await isGitRepository(projectPath);
    if (!isGitRepo) {
      console.error(`Project ${projectPath} is not a Git repository, performing full reindex`);
      const fullStats = await indexProject(projectPath, options);
      return {
        ...fullStats,
        modifiedFiles: fullStats.indexedFiles,
        deletedFiles: 0,
        unchangedFiles: 0,
      };
    }

    // Récupérer les fichiers modifiés depuis le dernier commit
    const changedFiles = await getChangedFiles(projectPath);

    // Récupérer tous les fichiers du projet
    const allFiles = await fg(filePatterns, {
      cwd: projectPath,
      absolute: true,
      dot: false,
      onlyFiles: true,
      followSymbolicLinks: false,
      ...(recursive ? {} : { deep: 1 }),
    });

    stats.totalFiles = allFiles.length;

    // Traiter les fichiers supprimés
    const deletedFiles = changedFiles.deleted || [];
    for (const filePath of deletedFiles) {
      try {
        await deleteFileFromIndex(projectPath, filePath);
        stats.deletedFiles++;
        console.error(`Deleted from index: ${filePath}`);
      } catch (error) {
        console.error(`Error deleting file ${filePath} from index:`, error);
        stats.errors++;
      }
    }

    // Traiter les fichiers modifiés et ajoutés
    const filesToProcess = [...(changedFiles.modified || []), ...(changedFiles.added || [])];

    for (const filePath of filesToProcess) {
      try {
        // Vérifier si le fichier doit être ignoré
        if (shouldIgnoreFile(filePath, projectPath)) {
          stats.ignoredFiles++;
          continue;
        }

        // Vérifier si le fichier existe toujours
        if (!fs.existsSync(filePath)) {
          stats.deletedFiles++;
          await deleteFileFromIndex(projectPath, filePath);
          continue;
        }

        // Lire le contenu du fichier
        const content = fs.readFileSync(filePath, "utf8");

        // Ignorer les fichiers vides ou trop petits
        if (content.trim().length < 10) {
          stats.ignoredFiles++;
          continue;
        }

        // Détecter le type de contenu et le langage
        const detection = detectContentType(filePath, content);
        const contentType = detection.contentType;
        const language = detection.language;

        // Découper en chunks de manière intelligente
        const chunks = chunkSize > 0
          ? await chunkIntelligently(content, filePath, contentType, language, chunkSize, chunkOverlap)
          : [content];

        // Phase 0.3 - Enrichissement LLM optionnel
        const enrichedChunks: Array<{ id: string; content: string; metadata: any }> = [];

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const chunkId = `${filePath}#chunk${i}`;

          enrichedChunks.push({
            id: chunkId,
            content: chunk,
            metadata: {
              language,
              fileType: contentType,
              filePath,
              projectPath,
              chunkIndex: i,
              totalChunks: chunks.length,
              role: contentType === 'code' ? 'core' :
                contentType === 'doc' ? 'example' :
                  contentType === 'config' ? 'template' : 'other',
              contentType,
            }
          });
        }

        // Enrichir les chunks si Phase 0.3 activée
        let enrichedResults = null;
        if (llmEnricher.isEnrichmentEnabled() && enrichedChunks.length > 0) {
          try {
            console.log(`🧠 Phase 0.3 - Enrichissement de ${enrichedChunks.length} chunks...`);
            enrichedResults = await llmEnricher.enrichBatch(enrichedChunks);
            console.log(`🧠 Phase 0.3 - Enrichissement terminé: ${enrichedResults.filter(r => r !== null).length}/${enrichedChunks.length} succès`);
          } catch (enrichmentError) {
            console.error(`❌ Erreur Phase 0.3: ${enrichmentError instanceof Error ? enrichmentError.message : String(enrichmentError)}`);
            enrichedResults = null;
          }
        }

        // Supprimer les anciens chunks de ce fichier
        await deleteFileFromIndex(projectPath, filePath);

        // Stocker chaque chunk dans le vector store avec métadonnées
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const chunkFilePath = chunks.length > 1 ? `${filePath}#chunk${i}` : filePath;

          // Utiliser le contenu enrichi si disponible, sinon le contenu original
          let chunkContent = chunk;
          let enrichmentMetadata = {};

          if (enrichedResults && enrichedResults[i]) {
            const enriched = enrichedResults[i];
            if (enriched) {
              chunkContent = enriched.enrichedContent;
              enrichmentMetadata = {
                enrichment_summary: enriched.metadata.summary,
                enrichment_keywords: enriched.metadata.keywords,
                enrichment_entities: enriched.metadata.entities,
                enrichment_complexity: enriched.metadata.complexity,
                enrichment_category: enriched.metadata.category,
                enrichment_language: enriched.metadata.language,
                enrichment_confidence: enriched.metadata.confidence,
                enrichment_model: enriched.modelUsed,
                enrichment_time_ms: enriched.enrichmentTimeMs,
              };
            }
          }

          await embedAndStore(projectPath, chunkFilePath, chunkContent, {
            chunkIndex: i,
            totalChunks: chunks.length,
            contentType: contentType,
            language: language,
            fileExtension: filePath.split('.').pop() || undefined,
            linesCount: chunkContent.split('\n').length,
            role: contentType === 'code' ? 'core' :
              contentType === 'doc' ? 'example' :
                contentType === 'config' ? 'template' : 'other',
            ...enrichmentMetadata,
          });

          stats.chunksCreated++;
        }

        stats.indexedFiles++;
        stats.modifiedFiles++;

        // Log progress
        if (stats.indexedFiles % 10 === 0) {
          console.error(`Indexed ${stats.indexedFiles}/${filesToProcess.length} changed files, ${stats.chunksCreated} chunks...`);
        }
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
        stats.errors++;
      }
    }

    // Compter les fichiers inchangés
    stats.unchangedFiles = stats.totalFiles - (stats.modifiedFiles + stats.deletedFiles + stats.ignoredFiles);

    // Récupérer les métriques Phase 0.3
    const phase03Metrics = llmEnricher.getStats();
    if (llmEnricher.isEnrichmentEnabled()) {
      console.error(`🧠 Phase 0.3 Métriques:`);
      console.error(`  Chunks traités: ${phase03Metrics.totalProcessed}`);
      console.error(`  Chunks enrichis: ${phase03Metrics.totalEnriched}`);
      console.error(`  Taux succès: ${(phase03Metrics.successRate * 100).toFixed(1)}%`);
      console.error(`  Temps moyen: ${phase03Metrics.averageTimeMs.toFixed(0)}ms`);
      console.error(`  Erreurs: ${phase03Metrics.errors}`);
    }

    console.error(`Incremental reindex completed for ${projectPath}`);
    console.error(`  Total files: ${stats.totalFiles}`);
    console.error(`  Modified/added: ${stats.modifiedFiles}`);
    console.error(`  Deleted: ${stats.deletedFiles}`);
    console.error(`  Unchanged: ${stats.unchangedFiles}`);
    console.error(`  Chunks created: ${stats.chunksCreated}`);
    console.error(`  Ignored: ${stats.ignoredFiles}`);
    console.error(`  Errors: ${stats.errors}`);

    return {
      ...stats,
      phase03Metrics: llmEnricher.isEnrichmentEnabled() ? phase03Metrics : undefined
    };
  } catch (error) {
    console.error(`Error updating project ${projectPath}:`, error);
    throw error;
  }
}

// Fonction pour vérifier si un répertoire est un dépôt Git
async function isGitRepository(path: string): Promise<boolean> {
  try {
    const gitDir = `${path}/.git`;
    return fs.existsSync(gitDir);
  } catch (error) {
    return false;
  }
}

// Fonction pour récupérer les fichiers modifiés depuis le dernier commit
async function getChangedFiles(projectPath: string): Promise<{
  added: string[];
  modified: string[];
  deleted: string[];
}> {
  const result = {
    added: [] as string[],
    modified: [] as string[],
    deleted: [] as string[],
  };

  try {
    // Exécuter git status pour voir les changements
    const { execSync } = await import('child_process');

    // Récupérer les fichiers modifiés dans le working directory
    const statusOutput = execSync('git status --porcelain', {
      cwd: projectPath,
      encoding: 'utf8'
    });

    const lines = statusOutput.trim().split('\n').filter(line => line.trim());

    for (const line of lines) {
      const status = line.substring(0, 2).trim();
      const filePath = line.substring(3);
      const absolutePath = `${projectPath}/${filePath}`;

      // Classer selon le statut Git
      if (status === 'A' || status === '??') {
        // Ajouté ou nouveau fichier non suivi
        result.added.push(absolutePath);
      } else if (status === 'M') {
        // Modifié
        result.modified.push(absolutePath);
      } else if (status === 'D') {
        // Supprimé
        result.deleted.push(absolutePath);
      } else if (status === 'R') {
        // Renommé (traiter comme supprimé + ajouté)
        const parts = filePath.split(' -> ');
        if (parts.length === 2) {
          result.deleted.push(`${projectPath}/${parts[0]}`);
          result.added.push(`${projectPath}/${parts[1]}`);
        }
      }
    }

    // Récupérer également les fichiers modifiés depuis le dernier commit
    try {
      const diffOutput = execSync('git diff --name-only HEAD~1 HEAD', {
        cwd: projectPath,
        encoding: 'utf8'
      });

      const diffFiles = diffOutput.trim().split('\n').filter(line => line.trim());

      for (const filePath of diffFiles) {
        const absolutePath = `${projectPath}/${filePath}`;
        // Ne pas ajouter en double
        if (!result.modified.includes(absolutePath) && !result.added.includes(absolutePath)) {
          result.modified.push(absolutePath);
        }
      }
    } catch (diffError) {
      // Ignorer si pas de commit précédent
      console.error(`Could not get diff from previous commit: ${diffError}`);
    }

    console.error(`Git changes detected: ${result.added.length} added, ${result.modified.length} modified, ${result.deleted.length} deleted`);

  } catch (error) {
    console.error(`Error getting changed files from Git: ${error}`);
    // En cas d'erreur, retourner des listes vides
  }

  return result;
}

// Fonction pour supprimer un fichier de l'index
async function deleteFileFromIndex(projectPath: string, filePath: string): Promise<void> {
  try {
    const { Pool } = await import('pg');

    const pool = new Pool({
      host: "localhost",
      port: 16432,
      database: "rag_mcp_dedicated",
      user: "rag_user",
      password: "secure_rag_password",
    });

    // Vérifier quelle table utiliser
    const useV2 = await checkV2TableExists();
    const tableName = useV2 ? 'rag_store_v2' : 'rag_store';

    // Construire le pattern pour le fichier (avec ou sans chunks)
    const filePattern = `${projectPath}:${filePath}%`;

    await pool.query(
      `DELETE FROM ${tableName} WHERE id LIKE $1`,
      [filePattern]
    );

    await pool.end();
  } catch (error) {
    console.error(`Error deleting file ${filePath} from index:`, error);
    throw error;
  }
}

// Fonction pour vérifier si la table v2 existe
async function checkV2TableExists(): Promise<boolean> {
  try {
    const { Pool } = await import('pg');

    const pool = new Pool({
      host: "localhost",
      port: 16432,
      database: "rag_mcp_dedicated",
      user: "rag_user",
      password: "secure_rag_password",
    });

    const result = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'rag_store_v2'
      )`
    );

    await pool.end();
    return result.rows[0].exists;
  } catch (error) {
    console.error('Error checking for rag_store_v2 table:', error);
    return false;
  }
}
