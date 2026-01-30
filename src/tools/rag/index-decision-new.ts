// src/tools/rag/index-decision-new.ts
// Outil MCP pour indexer les décisions du Task Manager dans le RAG
// Version: v2.0.0 - Version réelle avec vector store
// Responsabilités: Indexer les décisions de tâches dans le vector store RAG

import { logger } from "../../core/logger.js";
import { ToolDefinition, ToolHandler } from "../../core/tool-registry.js";
import {
  embedAndStore,
  generateEmbeddingForContent,
  semanticSearch,
  getProjectStats,
  listProjects,
  deleteDocument,
  clearAll,
  getStats,
  testConnection,
  updateDocument,
  hybridSearch,
  searchByMetadata,
  deleteDocumentsByPattern,
  initialize,
  close,
  clearEmbeddingCache,
  getEmbeddingCacheStats,
  getEmbeddingDimensionForModel,
  getEmbeddingModelForContentType,
  setEmbeddingModels,
  setEmbeddingProvider,
  VectorStoreLogger
} from "../../rag/vector-store.js";
import { getDefaultEmbeddingService } from "../../rag/embedding-service.js";

/**
 * Interface pour une décision de tâche
 */
interface TaskDecision {
  task_id: string;
  decision_type: 'created' | 'completed' | 'failed' | 'cancelled' | 'approved' | 'rejected';
  decision_timestamp: string;
  decision_by: string; // 'task_manager' | 'user' | 'ai' | 'system'
  decision_data: {
    title?: string;
    description?: string;
    metadata?: Record<string, any>;
    result?: any;
    error?: string;
    duration_ms?: number;
  };
  context?: {
    project_path?: string;
    workspace?: string;
    git_branch?: string;
    git_commit?: string;
    vscode_context?: Record<string, any>;
  };
}

/**
 * Interface pour un chunk de décision
 */
interface DecisionChunk {
  id: string;
  task_id: string;
  decision_type: string;
  content: string;
  metadata: Record<string, any>;
  embedding?: number[];
  created_at: string;
}

/**
 * Gestionnaire de décisions pour le RAG - Version réelle avec vector store
 */
class RealDecisionIndexer {
  private decisions: Map<string, TaskDecision> = new Map();
  private chunks: Map<string, DecisionChunk[]> = new Map();
  private projectPath: string = process.cwd();

  /**
   * Indexe une décision dans le RAG
   */
  async indexDecision(decision: TaskDecision): Promise<{
    success: boolean;
    decision_id: string;
    chunks_created: number;
    indexed_at: string;
  }> {
    const startTime = Date.now();
    const decisionId = `decision-${decision.task_id}-${Date.now()}`;

    try {
      logger.info('decision.index.start', 'Début de l\'indexation de décision', {
        decisionId,
        taskId: decision.task_id,
        decisionType: decision.decision_type
      });

      // 1. Stocker la décision
      this.decisions.set(decisionId, decision);

      // 2. Créer des chunks à partir de la décision
      const chunks = this.createChunksFromDecision(decision, decisionId);
      this.chunks.set(decisionId, chunks);

      // 3. Indexer chaque chunk dans le vector store
      const indexedCount = await this.indexChunksInVectorStore(chunks);

      const endTime = Date.now();
      const duration = endTime - startTime;

      logger.info('decision.index.success', 'Décision indexée avec succès', {
        decisionId,
        taskId: decision.task_id,
        chunksCreated: chunks.length,
        indexedCount,
        duration_ms: duration
      });

      return {
        success: true,
        decision_id: decisionId,
        chunks_created: chunks.length,
        indexed_at: new Date().toISOString()
      };

    } catch (error: any) {
      logger.error('decision.index.error', 'Erreur lors de l\'indexation de décision', {
        decisionId,
        taskId: decision.task_id,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        decision_id: decisionId,
        chunks_created: 0,
        indexed_at: new Date().toISOString()
      };
    }
  }

  /**
   * Crée des chunks à partir d'une décision
   */
  private createChunksFromDecision(decision: TaskDecision, decisionId: string): DecisionChunk[] {
    const chunks: DecisionChunk[] = [];

    // Chunk 1: Métadonnées de la décision
    const metadataChunk: DecisionChunk = {
      id: `${decisionId}-metadata`,
      task_id: decision.task_id,
      decision_type: decision.decision_type,
      content: this.createMetadataContent(decision),
      metadata: {
        chunk_type: 'metadata',
        decision_type: decision.decision_type,
        decision_by: decision.decision_by,
        task_id: decision.task_id,
        timestamp: decision.decision_timestamp,
        source: 'task_decision',
        content_type: 'decision_metadata'
      },
      created_at: new Date().toISOString()
    };
    chunks.push(metadataChunk);

    // Chunk 2: Contenu de la décision
    const contentChunk: DecisionChunk = {
      id: `${decisionId}-content`,
      task_id: decision.task_id,
      decision_type: decision.decision_type,
      content: this.createContentContent(decision),
      metadata: {
        chunk_type: 'content',
        decision_type: decision.decision_type,
        has_title: !!decision.decision_data.title,
        has_description: !!decision.decision_data.description,
        has_result: !!decision.decision_data.result,
        has_error: !!decision.decision_data.error,
        source: 'task_decision',
        content_type: 'decision_content'
      },
      created_at: new Date().toISOString()
    };
    chunks.push(contentChunk);

    // Chunk 3: Contexte de la décision (si disponible)
    if (decision.context) {
      const contextChunk: DecisionChunk = {
        id: `${decisionId}-context`,
        task_id: decision.task_id,
        decision_type: decision.decision_type,
        content: this.createContextContent(decision),
        metadata: {
          chunk_type: 'context',
          has_project: !!decision.context.project_path,
          has_git: !!(decision.context.git_branch || decision.context.git_commit),
          has_vscode: !!decision.context.vscode_context,
          source: 'task_decision',
          content_type: 'decision_context'
        },
        created_at: new Date().toISOString()
      };
      chunks.push(contextChunk);
    }

    return chunks;
  }

  /**
   * Crée le contenu pour le chunk de métadonnées
   */
  private createMetadataContent(decision: TaskDecision): string {
    return `Décision de tâche:
- ID de tâche: ${decision.task_id}
- Type de décision: ${decision.decision_type}
- Prise par: ${decision.decision_by}
- Date: ${decision.decision_timestamp}
- Durée: ${decision.decision_data.duration_ms ? `${decision.decision_data.duration_ms}ms` : 'N/A'}`;
  }

  /**
   * Crée le contenu pour le chunk de contenu
   */
  private createContentContent(decision: TaskDecision): string {
    const parts: string[] = [];

    if (decision.decision_data.title) {
      parts.push(`Titre: ${decision.decision_data.title}`);
    }

    if (decision.decision_data.description) {
      parts.push(`Description: ${decision.decision_data.description}`);
    }

    if (decision.decision_data.result) {
      parts.push(`Résultat: ${JSON.stringify(decision.decision_data.result, null, 2)}`);
    }

    if (decision.decision_data.error) {
      parts.push(`Erreur: ${decision.decision_data.error}`);
    }

    if (decision.decision_data.metadata) {
      parts.push(`Métadonnées: ${JSON.stringify(decision.decision_data.metadata, null, 2)}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Crée le contenu pour le chunk de contexte
   */
  private createContextContent(decision: TaskDecision): string {
    const parts: string[] = [];

    if (decision.context?.project_path) {
      parts.push(`Projet: ${decision.context.project_path}`);
    }

    if (decision.context?.workspace) {
      parts.push(`Workspace: ${decision.context.workspace}`);
    }

    if (decision.context?.git_branch) {
      parts.push(`Branche Git: ${decision.context.git_branch}`);
    }

    if (decision.context?.git_commit) {
      parts.push(`Commit Git: ${decision.context.git_commit}`);
    }

    if (decision.context?.vscode_context) {
      parts.push(`Contexte VS Code: ${JSON.stringify(decision.context.vscode_context, null, 2)}`);
    }

    return parts.length > 0 ? `Contexte:\n${parts.join('\n')}` : 'Aucun contexte disponible';
  }

  /**
   * Indexe les chunks dans le vector store
   */
  private async indexChunksInVectorStore(chunks: DecisionChunk[]): Promise<number> {
    let indexedCount = 0;

    for (const chunk of chunks) {
      try {
        // Utiliser le chemin du projet comme filePath pour les décisions
        const filePath = `task-decisions/${chunk.task_id}/${chunk.id}.json`;

        // Indexer dans le vector store
        await embedAndStore(
          this.projectPath,
          filePath,
          chunk.content,
          {
            metadata: {
              ...chunk.metadata,
              source: 'task_decision',
              content_type: 'decision',
              decision_type: chunk.decision_type,
              task_id: chunk.task_id,
              chunk_id: chunk.id,
              indexed_at: new Date().toISOString()
            }
          }
        );

        indexedCount++;
        logger.debug('decision.chunk.indexed', 'Chunk de décision indexé', {
          chunkId: chunk.id,
          taskId: chunk.task_id
        });

      } catch (error: any) {
        logger.error('decision.chunk.index.error', 'Erreur lors de l\'indexation du chunk', {
          chunkId: chunk.id,
          taskId: chunk.task_id,
          error: error.message
        });
        // Continuer avec les autres chunks même si un échoue
      }
    }

    return indexedCount;
  }

  /**
   * Récupère une décision par son ID
   */
  getDecision(decisionId: string): TaskDecision | undefined {
    return this.decisions.get(decisionId);
  }

  /**
   * Récupère les chunks d'une décision
   */
  getDecisionChunks(decisionId: string): DecisionChunk[] {
    return this.chunks.get(decisionId) || [];
  }

  /**
   * Recherche des décisions similaires
   */
  async searchSimilarDecisions(query: string, limit: number = 10): Promise<DecisionChunk[]> {
    try {
      logger.debug('decision.search.similar', 'Recherche de décisions similaires', {
        query,
        limit
      });

      // Recherche sémantique dans le vector store
      const searchResults = await semanticSearch(query, {
        top_k: limit,
        filters: {
          metadata: {
            source: 'task_decision'
          }
        }
      });

      // Convertir les résultats en DecisionChunk
      const chunks: DecisionChunk[] = searchResults.map(result => ({
        id: result.metadata?.chunk_id || `search-${Date.now()}`,
        task_id: result.metadata?.task_id || 'unknown',
        decision_type: result.metadata?.decision_type || 'unknown',
        content: result.content || '',
        metadata: result.metadata || {},
        created_at: result.metadata?.indexed_at || new Date().toISOString()
      }));

      return chunks;

    } catch (error: any) {
      logger.error('decision.search.error', 'Erreur lors de la recherche de décisions similaires', {
        query,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Récupère les statistiques
   */
  getStats(): {
    total_decisions: number;
    total_chunks: number;
    by_decision_type: Record<string, number>;
    by_decision_by: Record<string, number>;
  } {
    const stats = {
      total_decisions: this.decisions.size,
      total_chunks: 0,
      by_decision_type: {} as Record<string, number>,
      by_decision_by: {} as Record<string, number>
    };

    // Compter les chunks et les décisions par type
    for (const decision of this.decisions.values()) {
      stats.total_chunks += this.chunks.get(decision.task_id)?.length || 0;

      // Par type de décision
      stats.by_decision_type[decision.decision_type] =
        (stats.by_decision_type[decision.decision_type] || 0) + 1;

      // Par auteur de décision
      stats.by_decision_by[decision.decision_by] =
        (stats.by_decision_by[decision.decision_by] || 0) + 1;
    }

    return stats;
  }
}

/**
 * Instance singleton de l'indexeur de décisions
 */
const decisionIndexer = new RealDecisionIndexer();

/**
 * Définition de l'outil index_decision
 */
export const indexDecisionTool: ToolDefinition = {
  name: "index_decision",
  description: "Indexe une décision de Task Manager dans le RAG pour recherche sémantique future",
  inputSchema: {
    type: "object",
    properties: {
      task_id: {
        type: "string",
        description: "ID de la tâche concernée par la décision",
        minLength: 1
      },
      decision_type: {
        type: "string",
        description: "Type de décision",
        enum: ["created", "completed", "failed", "cancelled", "approved", "rejected"],
        default: "completed"
      },
      decision_by: {
        type: "string",
        description: "Qui a pris la décision",
        enum: ["task_manager", "user", "ai", "system"],
        default: "task_manager"
      },
      title: {
        type: "string",
        description: "Titre de la tâche (optionnel)"
      },
      description: {
        type: "string",
        description: "Description de la tâche (optionnel)"
      },
      result: {
        type: "object",
        description: "Résultat de la tâche (optionnel)"
      },
      error: {
        type: "string",
        description: "Erreur si la tâche a échoué (optionnel)"
      },
      metadata: {
        type: "object",
        description: "Métadonnées supplémentaires (optionnel)"
      },
      duration_ms: {
        type: "number",
        description: "Durée d'exécution en millisecondes (optionnel)"
      },
      project_path: {
        type: "string",
        description: "Chemin du projet (optionnel)"
      },
      workspace: {
        type: "string",
        description: "Workspace VS Code (optionnel)"
      },
      git_branch: {
        type: "string",
        description: "Branche Git (optionnel)"
      },
      git_commit: {
        type: "string",
        description: "Commit Git (optionnel)"
      },
      vscode_context: {
        type: "object",
        description: "Contexte VS Code (optionnel)"
      }
    },
    required: ["task_id"]
  },
};

/**
 * Handler pour l'outil index_decision
 */
export const indexDecisionHandler: ToolHandler = async (args) => {
  const startTime = Date.now();

  try {
    logger.info('decision.index.request', 'Demande d\'indexation de décision', {
      taskId: args.task_id,
      decisionType: args.decision_type
    });

    // Construire l'objet décision
    const decision: TaskDecision = {
      task_id: args.task_id,
      decision_type: args.decision_type || 'completed',
      decision_by: args.decision_by || 'task_manager',
      decision_timestamp: new Date().toISOString(),
      decision_data: {
        title: args.title,
        description: args.description,
        result: args.result,
        error: args.error,
        metadata: args.metadata,
        duration_ms: args.duration_ms
      },
      context: {
        project_path: args.project_path,
        workspace: args.workspace,
        git_branch: args.git_branch,
        git_commit: args.git_commit,
        vscode_context: args.vscode_context
      }
    };

    // Indexer la décision
    const result = await decisionIndexer.indexDecision(decision);

    const endTime = Date.now();
    const duration = endTime - startTime;

    const response = {
      success: result.success,
      decision: {
        task_id: decision.task_id,
        decision_type: decision.decision_type,
        decision_by: decision.decision_by,
        decision_timestamp: decision.decision_timestamp
      },
      indexing_result: result,
      stats: decisionIndexer.getStats(),
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      notes_for_ai: [
        "Décision indexée dans le RAG",
        `ID de tâche: ${decision.task_id}`,
        `Type de décision: ${decision.decision_type}`,
        `Prise par: ${decision.decision_by}`,
        `Chunks créés: ${result.chunks_created}`,
        "La décision est maintenant disponible pour recherche sémantique"
