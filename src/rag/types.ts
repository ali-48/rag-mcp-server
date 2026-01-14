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

// ==================== STATUS INTERFACES ====================

export type StatusScope = 'global' | 'project' | 'task';

export interface GlobalStatus {
  status: 'ok' | 'error';
  scope: 'global';
  rag_state: {
    initialized: boolean;
    active_jobs: number;
    queued_jobs: number;
    total_projects: number;
  };
  projects: Array<{
    project_id: string;
    current_phase: string;
    locked: boolean;
    last_updated: Date;
  }>;
  notes_for_ai: string[];
  allowed_actions?: string[];
  required_action?: string;
}

export interface ProjectStatus {
  status: 'ok' | 'error';
  scope: 'project';
  project_id: string;
  pipeline: {
    init_rag: 'done' | 'running' | 'pending' | 'error';
    scan_rag: 'done' | 'running' | 'pending' | 'error';
    prepare_rag: 'done' | 'running' | 'pending' | 'error';
    embed_rag: 'done' | 'running' | 'pending' | 'error';
    index_rag: 'done' | 'running' | 'pending' | 'error';
  };
  current_task?: {
    task_id: string;
    action: string;
    progress: {
      percent: number;
      files_processed: number;
      files_total: number;
      eta_seconds: number;
    };
  };
  notes_for_ai: string[];
  allowed_actions: string[];
  required_action?: string;
}

export interface TaskStatus {
  status: 'ok' | 'error';
  scope: 'task';
  task_id: string;
  action: string;
  state: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    phase: string;
    percent: number;
    eta_seconds: number;
    details?: Record<string, any>;
  };
  project_locked: boolean;
  notes_for_ai: string[];
  allowed_actions: string[];
  required_action?: string;
}

export interface GetStatusResponse {
  status: 'ok' | 'error';
  scope: StatusScope;
  data: GlobalStatus | ProjectStatus | TaskStatus;
  notes_for_ai: string[];
  allowed_actions?: string[];
  required_action?: string;
}

export interface AsyncRagResponse {
  status: 'accepted' | 'rejected';
  action: string;
  task_id: string;
  execution: 'background' | 'immediate';
  message: string;
  next_action: 'get_status';
  notes_for_ai: string[];
}
