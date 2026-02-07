// extension-rag/src/services/MonitoringReader.ts
// Service read-only pour lire les fichiers de monitoring
// Conformité : Lecture seule, pas d'interaction avec le moteur RAG

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface SystemMetrics {
  started_at: string;
  uptime_seconds: number;
  memory_usage_percent: number;
  cpu_usage_percent: number;
  active_threads: number;
}

export interface QueueMetrics {
  pending_tasks: number;
  active_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
}

export interface PerformanceMetrics {
  avg_response_time_ms: number;
  requests_per_second: number;
  error_rate_percent: number;
}

export interface ProjectMetrics {
  total_files: number;
  indexed_files: number;
  chunks_created: number;
  last_indexed: string;
  status: 'idle' | 'indexing' | 'error';
}

export interface MonitoringData {
  system: SystemMetrics;
  queue: QueueMetrics;
  performance: PerformanceMetrics;
  projects: Record<string, ProjectMetrics>;
  last_updated: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warning';
    message: string;
    timestamp: string;
  }>;
  timestamp: string;
}

export interface MonitoringEvent {
  type: string;
  message: string;
  timestamp: string;
  task_id?: string;
  phase?: string;
  metadata?: Record<string, any>;
}

export class MonitoringReader {
  private workspaceRoot: string;

  constructor(workspaceRoot?: string) {
    this.workspaceRoot = workspaceRoot || this.detectWorkspaceRoot();
  }

  /**
   * Détecte la racine du workspace
   */
  private detectWorkspaceRoot(): string {
    try {
      // Essayer d'utiliser VS Code API si disponible
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders && workspaceFolders.length > 0) {
        return workspaceFolders[0].uri.fsPath;
      }
    } catch (error) {
      // VS Code n'est pas disponible, utiliser process.cwd()
    }
    return process.cwd();
  }

  /**
   * Lit les métriques système depuis metrics.json
   */
  public async readMetrics(): Promise<MonitoringData | null> {
    try {
      const metricsPath = this.getMonitoringPath('metrics.json');
      if (!fs.existsSync(metricsPath)) {
        return null;
      }

      const content = await fs.promises.readFile(metricsPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Erreur lecture métriques:', error);
      return null;
    }
  }

  /**
   * Lit le statut de santé depuis latest.json
   */
  public async readHealthStatus(): Promise<HealthStatus | null> {
    try {
      const healthPath = this.getMonitoringPath('health/latest.json');
      if (!fs.existsSync(healthPath)) {
        return null;
      }

      const content = await fs.promises.readFile(healthPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Erreur lecture statut santé:', error);
      return null;
    }
  }

  /**
   * Lit les événements du jour
   */
  public async readTodayEvents(): Promise<MonitoringEvent[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const eventsPath = this.getMonitoringPath(`events/events_${today}.json`);

      if (!fs.existsSync(eventsPath)) {
        return [];
      }

      const content = await fs.promises.readFile(eventsPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Erreur lecture événements:', error);
      return [];
    }
  }

  /**
   * Lit la progression d'une tâche spécifique
   */
  public async readTaskProgress(taskId: string): Promise<any | null> {
    try {
      const progressPath = this.getMonitoringPath(`progress/progress_${taskId}.json`);
      if (!fs.existsSync(progressPath)) {
        return null;
      }

      const content = await fs.promises.readFile(progressPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Erreur lecture progression tâche ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Liste toutes les tâches en cours
   */
  public async listActiveTasks(): Promise<string[]> {
    try {
      const progressDir = this.getMonitoringPath('progress');
      if (!fs.existsSync(progressDir)) {
        return [];
      }

      const files = await fs.promises.readdir(progressDir);
      return files
        .filter(file => file.startsWith('progress_') && file.endsWith('.json'))
        .map(file => file.replace('progress_', '').replace('.json', ''));
    } catch (error) {
      console.error('Erreur liste tâches actives:', error);
      return [];
    }
  }

  /**
   * Vérifie si le monitoring est disponible
   */
  public async isMonitoringAvailable(): Promise<boolean> {
    const metricsPath = this.getMonitoringPath('metrics.json');
    return fs.existsSync(metricsPath);
  }

  /**
   * Obtient le chemin complet d'un fichier de monitoring
   */
  private getMonitoringPath(relativePath: string): string {
    return path.join(this.workspaceRoot, 'rag', 'monitoring', relativePath);
  }

  /**
   * Formate les métriques pour l'affichage
   */
  public formatMetrics(metrics: MonitoringData): string {
    const lines: string[] = [];

    lines.push('📊 **Métriques RAG MCP**');
    lines.push(`Dernière mise à jour: ${new Date(metrics.last_updated).toLocaleString()}`);
    lines.push('');

    lines.push('**Système**');
    lines.push(`• Démarrage: ${new Date(metrics.system.started_at).toLocaleString()}`);
    lines.push(`• Uptime: ${Math.floor(metrics.system.uptime_seconds / 3600)}h ${Math.floor((metrics.system.uptime_seconds % 3600) / 60)}m`);
    lines.push(`• CPU: ${metrics.system.cpu_usage_percent}%`);
    lines.push(`• Mémoire: ${metrics.system.memory_usage_percent}%`);
    lines.push(`• Threads actifs: ${metrics.system.active_threads}`);
    lines.push('');

    lines.push('**File d\'attente**');
    lines.push(`• Tâches en attente: ${metrics.queue.pending_tasks}`);
    lines.push(`• Tâches actives: ${metrics.queue.active_tasks}`);
    lines.push(`• Tâches terminées: ${metrics.queue.completed_tasks}`);
    lines.push(`• Tâches échouées: ${metrics.queue.failed_tasks}`);
    lines.push('');

    lines.push('**Performance**');
    lines.push(`• Temps réponse moyen: ${metrics.performance.avg_response_time_ms}ms`);
    lines.push(`• Requêtes/seconde: ${metrics.performance.requests_per_second}`);
    lines.push(`• Taux d'erreur: ${metrics.performance.error_rate_percent}%`);
    lines.push('');

    lines.push('**Projets**');
    const projectCount = Object.keys(metrics.projects || {}).length;
    lines.push(`• Nombre de projets: ${projectCount}`);

    if (metrics.projects) {
      Object.entries(metrics.projects).forEach(([projectId, project]) => {
        lines.push(`  • ${projectId}: ${project.total_files} fichiers, ${project.status}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Formate le statut de santé
   */
  public formatHealthStatus(health: HealthStatus): string {
    const lines: string[] = [];

    lines.push('🏥 **Statut de Santé RAG MCP**');
    lines.push(`Statut: ${this.getHealthStatusEmoji(health.status)} ${health.status.toUpperCase()}`);
    lines.push(`Dernière vérification: ${new Date(health.timestamp).toLocaleString()}`);
    lines.push('');

    lines.push('**Vérifications**');
    health.checks.forEach(check => {
      const emoji = check.status === 'pass' ? '✅' : check.status === 'warning' ? '⚠️' : '❌';
      lines.push(`${emoji} ${check.name}: ${check.message}`);
    });

    return lines.join('\n');
  }

  /**
   * Formate les événements
   */
  public formatEvents(events: MonitoringEvent[]): string {
    const lines: string[] = [];

    lines.push('📝 **Événements Récents**');
    lines.push(`Nombre d'événements: ${events.length}`);
    lines.push('');

    // Afficher les 10 derniers événements
    const recentEvents = events.slice(-10).reverse();

    recentEvents.forEach(event => {
      const time = new Date(event.timestamp).toLocaleTimeString();
      const emoji = this.getEventTypeEmoji(event.type);
      lines.push(`${emoji} [${time}] ${event.message}`);
    });

    return lines.join('\n');
  }

  /**
   * Obtient l'emoji pour le type d'événement
   */
  private getEventTypeEmoji(type: string): string {
    const emojiMap: Record<string, string> = {
      'info': 'ℹ️',
      'warning': '⚠️',
      'error': '❌',
      'phase_started': '🚀',
      'phase_completed': '✅',
      'task_started': '▶️',
      'task_completed': '🏁',
      'task_failed': '💥'
    };

    return emojiMap[type] || '📌';
  }

  /**
   * Obtient l'emoji pour le statut de santé
   */
  private getHealthStatusEmoji(status: string): string {
    const emojiMap: Record<string, string> = {
      'healthy': '✅',
      'degraded': '⚠️',
      'unhealthy': '❌'
    };

    return emojiMap[status] || '❓';
  }
}
