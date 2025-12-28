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
