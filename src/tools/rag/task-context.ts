// src/tools/rag/task-context.ts
// Outil MCP pour récupérer le contexte sémantique d'une tâche depuis le RAG
// Version: v1.0.0

import { logger } from "../../core/logger.js";
import { ToolDefinition, ToolHandler } from "../../core/tool-registry.js";
import { semanticSearch } from "../../rag/vector-store.js";

/**
 * Interface pour le contexte d'une tâche
 */
interface TaskContext {
  task_id: string;
  context_type: 'semantic' | 'historical' | 'similar' | 'all';
  context_data: {
    // Contexte sémantique (décisions similaires)
    semantic_context?: Array<{
      decision_id: string;
      task_id: string;
      decision_type: string;
      decision_by: string;
      decision_timestamp: string;
      similarity_score: number;
      content_preview: string;
      metadata?: Record<string, any>;
    }>;

    // Contexte historique (décisions de la même tâche)
    historical_context?: Array<{
      decision_id: string;
      decision_type: string;
      decision_timestamp: string;
      decision_by: string;
      result_preview?: string;
      error?: string;
      duration_ms?: number;
    }>;

    // Contexte similaire (tâches similaires)
    similar_tasks?: Array<{
      task_id: string;
      title?: string;
      description?: string;
      similarity_score: number;
      decision_count: number;
      first_decision: string;
      last_decision: string;
    }>;

    // Statistiques
    statistics?: {
      total_decisions: number;
      decision_types: Record<string, number>;
      decision_by: Record<string, number>;
      avg_duration_ms?: number;
      success_rate: number;
    };

    // Recommandations basées sur le contexte
    recommendations?: Array<{
      type: 'similar_solution' | 'avoid_error' | 'optimize_duration' | 'best_practice';
      description: string;
      confidence: number;
      source_decision_id?: string;
    }>;
  };
  retrieved_at: string;
  search_parameters: {
    semantic_query?: string;
    limit: number;
    similarity_threshold: number;
  };
}

/**
 * Service de contexte de tâche
 */
class TaskContextService {
  private projectPath: string = process.cwd();

  /**
   * Récupère le contexte sémantique d'une tâche
   */
  async getTaskContext(
    taskId: string,
    contextType: 'semantic' | 'historical' | 'similar' | 'all' = 'all',
    limit: number = 10,
    similarityThreshold: number = 0.3
  ): Promise<TaskContext> {
    const startTime = Date.now();

    try {
      logger.info('task.context.get.start', 'Début de récupération du contexte de tâche', {
        taskId,
        contextType,
        limit,
        similarityThreshold
      });

      const contextData: TaskContext['context_data'] = {};

      // Recherche sémantique pour les décisions similaires
      if (contextType === 'semantic' || contextType === 'all') {
        const semanticQuery = `Tâche ${taskId} décision contexte`;
        const semanticResults = await semanticSearch(semanticQuery, {
          limit: limit,
          contentTypeFilter: 'decision',
          roleFilter: 'task_decision',
          threshold: similarityThreshold
        });

        contextData.semantic_context = semanticResults.map(result => ({
          decision_id: this.extractDecisionIdFromMetadata(result.metadata) || result.id,
          task_id: this.extractTaskIdFromMetadata(result.metadata) || 'unknown',
          decision_type: this.extractDecisionTypeFromMetadata(result.metadata) || 'unknown',
          decision_by: this.extractDecisionByFromMetadata(result.metadata) || 'unknown',
          decision_timestamp: this.extractDecisionTimestampFromMetadata(result.metadata) || new Date().toISOString(),
          similarity_score: result.score || 0,
          content_preview: result.content?.substring(0, 200) + '...' || '',
          metadata: result.metadata
        }));
      }

      // Contexte historique (décisions de la même tâche)
      if (contextType === 'historical' || contextType === 'all') {
        const historicalQuery = `task_id:${taskId}`;
        const historicalResults = await semanticSearch(historicalQuery, {
          limit: limit * 2, // Plus de résultats pour filtrer par tâche
          contentTypeFilter: 'decision',
          roleFilter: 'task_decision'
        });

        // Filtrer pour ne garder que les décisions de la même tâche
        const taskDecisions = historicalResults.filter(result => {
          const resultTaskId = this.extractTaskIdFromMetadata(result.metadata);
          return resultTaskId === taskId;
        });

        contextData.historical_context = taskDecisions.map(result => ({
          decision_id: result.metadata?.decision_id || result.id,
          decision_type: result.metadata?.decision_type || 'unknown',
          decision_timestamp: result.metadata?.decision_timestamp || new Date().toISOString(),
          decision_by: result.metadata?.decision_by || 'unknown',
          result_preview: result.metadata?.result ? JSON.stringify(result.metadata.result).substring(0, 100) + '...' : undefined,
          error: result.metadata?.error,
          duration_ms: result.metadata?.duration_ms
        }));

        // Calculer les statistiques
        if (taskDecisions.length > 0) {
          contextData.statistics = this.calculateStatistics(taskDecisions);
        }
      }

      // Tâches similaires
      if (contextType === 'similar' || contextType === 'all') {
        const similarTasks = await this.findSimilarTasks(taskId, limit, similarityThreshold);
        contextData.similar_tasks = similarTasks;
      }

      // Générer des recommandations
      if (contextData.historical_context && contextData.historical_context.length > 0) {
        contextData.recommendations = this.generateRecommendations(contextData);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      logger.info('task.context.get.success', 'Contexte de tâche récupéré avec succès', {
        taskId,
        duration_ms: duration,
        semantic_context_count: contextData.semantic_context?.length || 0,
        historical_context_count: contextData.historical_context?.length || 0,
        similar_tasks_count: contextData.similar_tasks?.length || 0
      });

      return {
        task_id: taskId,
        context_type: contextType,
        context_data: contextData,
        retrieved_at: new Date().toISOString(),
        search_parameters: {
          semantic_query: contextType === 'semantic' || contextType === 'all' ? `Tâche ${taskId} décision contexte` : undefined,
          limit,
          similarity_threshold: similarityThreshold
        }
      };

    } catch (error: any) {
      logger.error('task.context.get.error', 'Erreur lors de la récupération du contexte de tâche', {
        taskId,
        error: error.message,
        stack: error.stack
      });

      // Retourner un contexte vide en cas d'erreur
      return {
        task_id: taskId,
        context_type: contextType,
        context_data: {},
        retrieved_at: new Date().toISOString(),
        search_parameters: {
          limit,
          similarity_threshold: similarityThreshold
        }
      };
    }
  }

  /**
   * Extrait l'ID de tâche des métadonnées
   */
  private extractTaskIdFromMetadata(metadata: any): string | undefined {
    if (!metadata) return undefined;

    // Essayer différents formats de métadonnées
    if (metadata.task_id) return metadata.task_id;
    if (metadata.taskId) return metadata.taskId;
    if (metadata.id && metadata.id.startsWith('task-')) return metadata.id;

    // Essayer d'extraire de l'ID de décision
    if (metadata.decision_id && metadata.decision_id.includes('-')) {
      const parts = metadata.decision_id.split('-');
      if (parts.length >= 2 && parts[0] === 'decision') {
        return parts[1];
      }
    }

    return undefined;
  }

  /**
   * Extrait l'ID de décision des métadonnées
   */
  private extractDecisionIdFromMetadata(metadata: any): string | undefined {
    if (!metadata) return undefined;
    return metadata.decision_id || metadata.id;
  }

  /**
   * Extrait le type de décision des métadonnées
   */
  private extractDecisionTypeFromMetadata(metadata: any): string | undefined {
    if (!metadata) return undefined;
    return metadata.decision_type || metadata.type;
  }

  /**
   * Extrait qui a pris la décision des métadonnées
   */
  private extractDecisionByFromMetadata(metadata: any): string | undefined {
    if (!metadata) return undefined;
    return metadata.decision_by || metadata.by || metadata.author;
  }

  /**
   * Extrait le timestamp de décision des métadonnées
   */
  private extractDecisionTimestampFromMetadata(metadata: any): string | undefined {
    if (!metadata) return undefined;
    return metadata.decision_timestamp || metadata.timestamp || metadata.created_at;
  }

  /**
   * Extrait le titre des métadonnées
   */
  private extractTitleFromMetadata(metadata: any): string | undefined {
    if (!metadata) return undefined;
    return metadata.title || metadata.name || metadata.task_title;
  }

  /**
   * Extrait la description des métadonnées
   */
  private extractDescriptionFromMetadata(metadata: any): string | undefined {
    if (!metadata) return undefined;
    return metadata.description || metadata.desc || metadata.task_description;
  }

  /**
   * Calcule les statistiques des décisions
   */
  private calculateStatistics(decisions: any[]): TaskContext['context_data']['statistics'] {
    const statistics: TaskContext['context_data']['statistics'] = {
      total_decisions: decisions.length,
      decision_types: {},
      decision_by: {},
      success_rate: 0
    };

    let totalDuration = 0;
    let durationCount = 0;
    let successCount = 0;

    decisions.forEach(decision => {
      // Compter les types de décision
      const decisionType = decision.metadata?.decision_type || 'unknown';
      statistics.decision_types[decisionType] = (statistics.decision_types[decisionType] || 0) + 1;

      // Compter qui a pris la décision
      const decisionBy = decision.metadata?.decision_by || 'unknown';
      statistics.decision_by[decisionBy] = (statistics.decision_by[decisionBy] || 0) + 1;

      // Calculer la durée
      if (decision.metadata?.duration_ms) {
        totalDuration += decision.metadata.duration_ms;
        durationCount++;
      }

      // Compter les succès (décisions complétées sans erreur)
      if (decisionType === 'completed' && !decision.metadata?.error) {
        successCount++;
      }
    });

    // Calculer la durée moyenne
    if (durationCount > 0) {
      statistics.avg_duration_ms = Math.round(totalDuration / durationCount);
    }

    // Calculer le taux de succès
    if (decisions.length > 0) {
      statistics.success_rate = Math.round((successCount / decisions.length) * 100);
    }

    return statistics;
  }

  /**
   * Trouve des tâches similaires
   */
  private async findSimilarTasks(
    taskId: string,
    limit: number,
    similarityThreshold: number
  ): Promise<TaskContext['context_data']['similar_tasks']> {
    try {
      // Rechercher des décisions similaires
      const similarDecisions = await semanticSearch(`tâche ${taskId} similaire`, {
        limit: limit * 3, // Plus de résultats pour regrouper par tâche
        contentTypeFilter: 'decision',
        roleFilter: 'task_decision',
        threshold: similarityThreshold
      });

      // Grouper par tâche
      const tasksMap = new Map<string, {
        task_id: string;
        title?: string;
        description?: string;
        decisions: any[];
        similarity_scores: number[];
      }>();

      similarDecisions.forEach(decision => {
        const taskId = this.extractTaskIdFromMetadata(decision.metadata);
        if (!taskId) return;

        if (!tasksMap.has(taskId)) {
          tasksMap.set(taskId, {
            task_id: taskId,
            title: this.extractTitleFromMetadata(decision.metadata),
            description: this.extractDescriptionFromMetadata(decision.metadata),
            decisions: [],
            similarity_scores: []
          });
        }

        const task = tasksMap.get(taskId)!;
        task.decisions.push(decision);
        task.similarity_scores.push(decision.score || 0);
      });

      // Convertir en tableau et calculer les scores moyens
      const similarTasks: TaskContext['context_data']['similar_tasks'] = Array.from(tasksMap.values())
        .filter(task => task.task_id !== taskId) // Exclure la tâche actuelle
        .map(task => {
          const avgScore = task.similarity_scores.length > 0
            ? task.similarity_scores.reduce((a, b) => a + b, 0) / task.similarity_scores.length
            : 0;

          // Trier les décisions par date
          const sortedDecisions = task.decisions.sort((a, b) => {
            const dateA = new Date(a.metadata?.decision_timestamp || 0).getTime();
            const dateB = new Date(b.metadata?.decision_timestamp || 0).getTime();
            return dateA - dateB;
          });

          return {
            task_id: task.task_id,
            title: task.title,
            description: task.description,
            similarity_score: avgScore,
            decision_count: task.decisions.length,
            first_decision: sortedDecisions[0]?.metadata?.decision_timestamp || '',
            last_decision: sortedDecisions[sortedDecisions.length - 1]?.metadata?.decision_timestamp || ''
          };
        })
        .sort((a, b) => b.similarity_score - a.similarity_score) // Trier par similarité
        .slice(0, limit); // Limiter le nombre de résultats

      return similarTasks;

    } catch (error) {
      logger.warn('task.context.similar.error', 'Erreur lors de la recherche de tâches similaires', {
        taskId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Génère des recommandations basées sur le contexte
   */
  private generateRecommendations(contextData: TaskContext['context_data']): TaskContext['context_data']['recommendations'] {
    const recommendations: TaskContext['context_data']['recommendations'] = [];

    // Analyser les décisions historiques pour générer des recommandations
    if (contextData.historical_context && contextData.historical_context.length > 0) {
      const decisions = contextData.historical_context;

      // Recommandation basée sur les erreurs passées
      const errorDecisions = decisions.filter(d => d.error);
      if (errorDecisions.length > 0) {
        const latestError = errorDecisions[errorDecisions.length - 1];
        recommendations.push({
          type: 'avoid_error',
          description: `Éviter l'erreur: "${latestError.error?.substring(0, 100)}..."`,
          confidence: 0.8,
          source_decision_id: latestError.decision_id
        });
      }

      // Recommandation basée sur la durée
      const completedDecisions = decisions.filter(d => d.decision_type === 'completed' && d.duration_ms);
      if (completedDecisions.length >= 3) {
        const avgDuration = completedDecisions.reduce((sum, d) => sum + (d.duration_ms || 0), 0) / completedDecisions.length;
        const longestDecision = completedDecisions.reduce((longest, d) =>
          (d.duration_ms || 0) > (longest.duration_ms || 0) ? d : longest
        );

        if (longestDecision.duration_ms && longestDecision.duration_ms > avgDuration * 1.5) {
          recommendations.push({
            type: 'optimize_duration',
            description: `Optimiser la durée: la décision la plus longue a pris ${longestDecision.duration_ms}ms (moyenne: ${Math.round(avgDuration)}ms)`,
            confidence: 0.7,
            source_decision_id: longestDecision.decision_id
          });
        }
      }

      // Recommandation basée sur les meilleures pratiques
      const successfulDecisions = decisions.filter(d =>
        d.decision_type === 'completed' && !d.error && d.duration_ms && d.duration_ms < 10000
      );

      if (successfulDecisions.length > 0) {
        recommendations.push({
          type: 'best_practice',
          description: `Suivre les ${successfulDecisions.length} décisions réussies comme meilleure pratique`,
          confidence: 0.9
        });
      }
    }

    // Recommandations basées sur les tâches similaires
    if (contextData.similar_tasks && contextData.similar_tasks.length > 0) {
      const mostSimilarTask = contextData.similar_tasks[0];
      if (mostSimilarTask.similarity_score > 0.7) {
        recommendations.push({
          type: 'similar_solution',
          description: `Consulter la tâche similaire "${mostSimilarTask.title || mostSimilarTask.task_id}" (similarité: ${Math.round(mostSimilarTask.similarity_score * 100)}%)`,
          confidence: mostSimilarTask.similarity_score,
          source_decision_id: undefined
        });
      }
    }

    return recommendations.slice(0, 5); // Limiter à 5 recommandations
  }
}

/**
 * Instance singleton du service de contexte de tâche
 */
const taskContextService = new TaskContextService();

/**
 * Définition de l'outil get_task_context
 */
export const getTaskContextTool: ToolDefinition = {
  name: "get_task_context",
  description: "Récupère le contexte sémantique d'une tâche depuis le RAG (décisions similaires, historique, recommandations)",
  inputSchema: {
    type: "object",
    properties: {
      task_id: {
        type: "string",
        description: "ID de la tâche pour laquelle récupérer le contexte",
        minLength: 1
      },
      context_type: {
        type: "string",
        description: "Type de contexte à récupérer",
        enum: ["semantic", "historical", "similar", "all"],
        default: "all"
      },
      limit: {
        type: "number",
        description: "Nombre maximum de résultats par type de contexte",
        default: 10,
        minimum: 1,
        maximum: 50
      },
      similarity_threshold: {
        type: "number",
        description: "Seuil de similarité minimum pour les résultats sémantiques (0.0-1.0)",
        default: 0.3,
        minimum: 0,
        maximum: 1
      }
    },
    required: ["task_id"]
  },
};

/**
 * Handler pour l'outil get_task_context
 */
export const getTaskContextHandler: ToolHandler = async (args) => {
  const startTime = Date.now();

  try {
    logger.info('task.context.request', 'Demande de contexte de tâche', {
      taskId: args.task_id,
      contextType: args.context_type
    });

    // Récupérer le contexte de la tâche
    const context = await taskContextService.getTaskContext(
      args.task_id,
      args.context_type || 'all',
      args.limit || 10,
      args.similarity_threshold || 0.3
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    const response = {
      success: true,
      task_context: context,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      notes_for_ai: [
        "Contexte de tâche récupéré avec succès",
        `ID de tâche: ${args.task_id}`,
        `Type de contexte: ${args.context_type || 'all'}`,
        `Décisions sémantiques: ${context.context_data.semantic_context?.length || 0}`,
        `Décisions historiques: ${context.context_data.historical_context?.length || 0}`,
        `Tâches similaires: ${context.context_data.similar_tasks?.length || 0}`,
        `Recommandations: ${context.context_data.recommendations?.length || 0}`,
        "Utiliser ce contexte pour prendre des décisions éclairées"
      ]
    };

    logger.info('task.context.response', 'Réponse de contexte de tâche', {
      taskId: args.task_id,
      success: true,
      duration_ms: duration,
      semanticCount: context.context_data.semantic_context?.length || 0,
      historicalCount: context.context_data.historical_context?.length || 0
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

    logger.error('task.context.error', 'Erreur lors de la récupération du contexte de tâche', {
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
          error: "GET_TASK_CONTEXT_ERROR",
          message: error.message,
          duration_ms: duration,
          timestamp: new Date().toISOString(),
          notes_for_ai: [
            "Erreur lors de la récupération du contexte de tâche",
            `ID de tâche: ${args.task_id}`,
            "Vérifier que la tâche existe et a des décisions indexées",
            "Consulter les logs pour plus de détails"
          ]
        }, null, 2)
      }]
    };
  }
};

/**
 * Teste le service de contexte de tâche
 */
export async function testTaskContextService(): Promise<boolean> {
  try {
    const testTaskId = `test-context-${Date.now()}`;

    logger.info('task.context.test.start', 'Début du test du service de contexte de tâche', {
      testTaskId
    });

    // Tester la récupération de contexte (même si vide)
    const context = await taskContextService.getTaskContext(testTaskId, 'all', 5, 0.3);

    // Vérifier la structure de la réponse
    if (!context || typeof context !== 'object') {
      throw new Error('La réponse du service de contexte n\'est pas un objet');
    }

    if (context.task_id !== testTaskId) {
      throw new Error(`L'ID de tâche dans la réponse ne correspond pas: ${context.task_id} vs ${testTaskId}`);
    }

    logger.info('task.context.test.success', 'Test du service de contexte de tâche réussi', {
      testTaskId,
      contextType: context.context_type
    });

    return true;

  } catch (error: any) {
    logger.error('task.context.test.failed', 'Test du service de contexte de tâche échoué', {
      error: error.message,
      stack: error.stack
    });
    return false;
  }
}

// Exécution automatique si ce fichier est exécuté directement
if (typeof require !== 'undefined' && require.main === module) {
  testTaskContextService().then(success => {
    if (success) {
      logger.info('task.context.test.cli', 'Service de contexte de tâche testé avec succès', {
        success: true,
        message: 'Service de contexte de tâche testé avec succès'
      });
      process.exit(0);
    } else {
      logger.error('task.context.test.cli', 'Échec du test du service de contexte de tâche', {
        success: false,
        message: 'Échec du test du service de contexte de tâche'
      });
      process.exit(1);
    }
  });
}
