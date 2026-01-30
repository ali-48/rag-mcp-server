// src/tools/rag/index-decision-simple.ts
// Outil MCP simple pour indexer les décisions du Task Manager dans le RAG
// Version: v1.0.0 - Version simplifiée et fonctionnelle

import { logger } from "../../core/logger.js";
import { ToolDefinition, ToolHandler } from "../../core/tool-registry.js";
import { embedAndStore, semanticSearch } from "../../rag/vector-store.js";

/**
 * Interface pour une décision de tâche
 */
interface TaskDecision {
  task_id: string;
  decision_type: 'created' | 'completed' | 'failed' | 'cancelled' | 'approved' | 'rejected';
  decision_timestamp: string;
  decision_by: string;
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
 * Indexeur de décisions simple
 */
class SimpleDecisionIndexer {
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

      // Créer le contenu de la décision
      const content = this.createDecisionContent(decision);

      // Indexer dans le vector store
      await embedAndStore(
        this.projectPath,
        `task-decisions/${decision.task_id}/${decisionId}.json`,
        content,
        {
          contentType: 'decision',
          role: 'task_decision',
          language: 'fr',
          // Les métadonnées sont stockées dans les propriétés de l'interface
          chunkIndex: 0,
          totalChunks: 1,
          fileExtension: '.json',
          linesCount: content.split('\n').length,
          isCompressed: false
        }
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      logger.info('decision.index.success', 'Décision indexée avec succès', {
        decisionId,
        taskId: decision.task_id,
        duration_ms: duration
      });

      return {
        success: true,
        decision_id: decisionId,
        chunks_created: 1, // Une seule décision indexée
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
   * Crée le contenu de la décision
   */
  private createDecisionContent(decision: TaskDecision): string {
    const parts: string[] = [];

    // En-tête de la décision
    parts.push(`DÉCISION DE TÂCHE`);
    parts.push(`=================`);
    parts.push(`ID de tâche: ${decision.task_id}`);
    parts.push(`Type de décision: ${decision.decision_type}`);
    parts.push(`Prise par: ${decision.decision_by}`);
    parts.push(`Date: ${decision.decision_timestamp}`);

    if (decision.decision_data.duration_ms) {
      parts.push(`Durée: ${decision.decision_data.duration_ms}ms`);
    }

    // Titre et description
    if (decision.decision_data.title) {
      parts.push(`\nTitre: ${decision.decision_data.title}`);
    }

    if (decision.decision_data.description) {
      parts.push(`Description: ${decision.decision_data.description}`);
    }

    // Résultat ou erreur
    if (decision.decision_data.result) {
      parts.push(`\nRésultat: ${JSON.stringify(decision.decision_data.result, null, 2)}`);
    }

    if (decision.decision_data.error) {
      parts.push(`\nErreur: ${decision.decision_data.error}`);
    }

    // Métadonnées
    if (decision.decision_data.metadata) {
      parts.push(`\nMétadonnées: ${JSON.stringify(decision.decision_data.metadata, null, 2)}`);
    }

    // Contexte
    if (decision.context) {
      parts.push(`\nCONTEXTE`);
      parts.push(`========`);

      if (decision.context.project_path) {
        parts.push(`Projet: ${decision.context.project_path}`);
      }

      if (decision.context.workspace) {
        parts.push(`Workspace: ${decision.context.workspace}`);
      }

      if (decision.context.git_branch) {
        parts.push(`Branche Git: ${decision.context.git_branch}`);
      }

      if (decision.context.git_commit) {
        parts.push(`Commit Git: ${decision.context.git_commit}`);
      }

      if (decision.context.vscode_context) {
        parts.push(`Contexte VS Code: ${JSON.stringify(decision.context.vscode_context, null, 2)}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Recherche des décisions similaires
   */
  async searchSimilarDecisions(query: string, limit: number = 10): Promise<any[]> {
    try {
      logger.debug('decision.search.similar', 'Recherche de décisions similaires', {
        query,
        limit
      });

      // Recherche sémantique dans le vector store
      const searchResults = await semanticSearch(query, {
        limit: limit,
        contentTypeFilter: 'decision',
        roleFilter: 'task_decision'
      });

      return searchResults;

    } catch (error: any) {
      logger.error('decision.search.error', 'Erreur lors de la recherche de décisions similaires', {
        query,
        error: error.message
      });
      return [];
    }
  }
}

/**
 * Instance singleton de l'indexeur de décisions
 */
const decisionIndexer = new SimpleDecisionIndexer();

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
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      notes_for_ai: [
        "Décision indexée dans le RAG",
        `ID de tâche: ${decision.task_id}`,
        `Type de décision: ${decision.decision_type}`,
        `Prise par: ${decision.decision_by}`,
        `Chunks créés: ${result.chunks_created}`,
        "La décision est maintenant disponible pour recherche sémantique"
      ]
    };

    logger.info('decision.index.response', 'Réponse d\'indexation de décision', {
      taskId: args.task_id,
      success: result.success,
      chunksCreated: result.chunks_created,
      duration_ms: duration
    });

    return {
      content: [{
        type: "text",
        text: JSON.stringify(response, null, 2)
      }]
    };

  } catch (error: any) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    logger.error('decision.index.error', 'Erreur lors de l\'indexation de décision', {
      taskId: args.task_id,
      error: error.message,
      stack: error.stack,
      duration_ms: duration
    });

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: false,
          error: "INDEX_DECISION_ERROR",
          message: error.message,
          duration_ms: duration,
          timestamp: new Date().toISOString(),
          notes_for_ai: [
            "Erreur lors de l'indexation de la décision",
            `ID de tâche: ${args.task_id}`,
            "Vérifier les paramètres d'entrée",
            "Consulter les logs pour plus de détails"
          ]
        }, null, 2)
      }]
    };
  }
};

/**
 * Teste l'indexeur de décisions
 */
export async function testDecisionIndexer(): Promise<boolean> {
  try {
    const testTaskId = `test-decision-${Date.now()}`;

    logger.info('decision.index.test.start', 'Début du test de l\'indexeur de décisions', {
      testTaskId
    });

    // Créer une décision de test
    const testDecision: TaskDecision = {
      task_id: testTaskId,
      decision_type: 'completed',
      decision_by: 'task_manager',
      decision_timestamp: new Date().toISOString(),
      decision_data: {
        title: 'Test Task Decision',
        description: 'Ceci est une décision de test pour valider l\'indexeur',
        result: { success: true, message: 'Test réussi' },
        duration_ms: 1500
      },
      context: {
        project_path: '/test/project',
        workspace: 'test-workspace',
        git_branch: 'main',
        git_commit: 'abc123'
      }
    };

    // Indexer la décision
    const result = await decisionIndexer.indexDecision(testDecision);

    if (!result.success) {
      throw new Error('L\'indexation de la décision de test a échoué');
    }

    // Vérifier la recherche sémantique
    const similarDecisions = await decisionIndexer.searchSimilarDecisions('test decision', 5);
    if (!Array.isArray(similarDecisions)) {
      throw new Error('La recherche sémantique n\'a pas retourné un tableau');
    }

    logger.info('decision.index.test.success', 'Test de l\'indexeur de décisions réussi', {
      testTaskId,
      decisionId: result.decision_id,
      searchResults: similarDecisions.length
    });

    return true;

  } catch (error: any) {
    logger.error('decision.index.test.failed', 'Test de l\'indexeur de décisions échoué', {
      error: error.message,
      stack: error.stack
    });
    return false;
  }
}

// Exécution automatique si ce fichier est exécuté directement
if (typeof require !== 'undefined' && require.main === module) {
  testDecisionIndexer().then(success => {
    if (success) {
      logger.info('decision.index.test.cli', 'Indexeur de décisions testé avec succès', {
        success: true,
        message: 'Indexeur de décisions testé avec succès'
      });
      process.exit(0);
    } else {
      logger.error('decision.index.test.cli', 'Échec du test de l\'indexeur de décisions', {
        success: false,
        message: 'Échec du test de l\'indexeur de décisions'
      });
      process.exit(1);
    }
  });
}
