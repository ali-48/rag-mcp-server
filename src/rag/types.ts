// Types pour le système RAG

export interface RAGDocument {
  id: string;
  projectPath: string;
  filePath: string;
  content: string;
  vector: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchResult {
  id: string;
  filePath: string;
  content: string;
  score: number;
  metadata: {
    projectPath: string;
    fileSize: number;
    lines: number;
    originalSize?: number;
    contentType?: string | null;
    role?: string | null;
    fileExtension?: string | null;
    language?: string | null;
    linesCount?: number | null;
    isCompressed?: boolean;
    compressionRatio?: string | null;
    createdAt?: Date | null;
    updatedAt?: Date | null;
    originalScore?: number;
    rerankScore?: number;
    semanticScore?: number;
    weightedSemanticScore?: number;
    textScore?: number;
    weightedTextScore?: number;
    combinedScore?: number;
  };
}

export interface IndexOptions {
  filePatterns?: string[];
  recursive?: boolean;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface SearchOptions {
  projectFilter?: string;
  limit?: number;
  threshold?: number;
}

export interface ProjectStats {
  projectPath: string;
  totalFiles: number;
  totalChunks: number;
  indexedAt: Date;
  lastUpdated: Date;
}
