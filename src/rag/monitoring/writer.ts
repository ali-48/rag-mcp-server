// src/rag/monitoring/writer.ts
// MonitoringWriter avec méthodes write-only strict
// Conformité règle #25 : Anti-duplication stricte

import fs from 'fs';
import path from 'path';
import {
  DEFAULT_MONITORING_CONFIG,
  HealthStatus,
  MonitoringConfig,
  MonitoringEvent,
  PerformanceMetrics,
  ProjectMetrics,
  QueueMetrics,
  SystemMetrics,
  TaskProgress
} from './types';

/**
 * MonitoringWriter - Classe write-only strict
 *
 * PRINCIPE : Le moteur écrit les métriques, ne les lit pas
 * CONFORMITÉ : Règle #25 (anti-duplication) + séparation stricte monitoring/moteur
 *
 * ❌ INTERDIT : Toute méthode de lecture (get*, read*, load*)
 * ✅ AUTORISÉ : Uniquement méthodes d'écriture (write*, record*)
 */
export class MonitoringWriter {
  private config: MonitoringConfig;
  private eventBuffer: MonitoringEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private basePath: string;

  constructor(config?: Partial<MonitoringConfig>, basePath: string = process.cwd()) {
    this.config = { ...DEFAULT_MONITORING_CONFIG, ...config };
    this.basePath = basePath;

    // Initialiser les répertoires
    this.ensureDirectories();

    // Démarrer le timer de flush
    this.startFlushTimer();
  }

  /**
   * WRITE-ONLY: Écrire les métriques système
   */
  public writeSystemMetrics(metrics: SystemMetrics): void {
    try {
      const fullPath = this.resolvePath(this.config.metrics_path);
      const data = this.readExistingMetrics(fullPath);

      // Mettre à jour les métriques système
      data.system = metrics;
      data.last_updated = new Date().toISOString();

      // Écrire de manière atomique
      this.writeAtomic(fullPath, data);

      this.recordEvent({
        type: 'info',
        message: `Métriques système mises à jour: CPU=${metrics.cpu_usage_percent}%, Mémoire=${metrics.memory_usage_percent}%`,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error(`❌ Erreur écriture métriques système:`, error.message);
    }
  }

  /**
   * WRITE-ONLY: Écrire les métriques de performance
   */
  public writePerformanceMetrics(metrics: PerformanceMetrics): void {
    try {
      const fullPath = this.resolvePath(this.config.metrics_path);
      const data = this.readExistingMetrics(fullPath);

      // Mettre à jour les métriques de performance
      data.performance = metrics;
      data.last_updated = new Date().toISOString();

      // Écrire de manière atomique
      this.writeAtomic(fullPath, data);
    } catch (error: any) {
      console.error(`❌ Erreur écriture métriques performance:`, error.message);
    }
  }

  /**
   * WRITE-ONLY: Écrire les métriques de file d'attente
   */
  public writeQueueMetrics(metrics: QueueMetrics): void {
    try {
      const fullPath = this.resolvePath(this.config.metrics_path);
      const data = this.readExistingMetrics(fullPath);

      // Mettre à jour les métriques de file
      data.queue = metrics;
      data.last_updated = new Date().toISOString();

      // Écrire de manière atomique
      this.writeAtomic(fullPath, data);
    } catch (error: any) {
      console.error(`❌ Erreur écriture métriques file:`, error.message);
    }
  }

  /**
   * WRITE-ONLY: Écrire les métriques d'un projet
   */
  public writeProjectMetrics(projectId: string, metrics: ProjectMetrics): void {
    try {
      const fullPath = this.resolvePath(this.config.metrics_path);
      const data = this.readExistingMetrics(fullPath);

      // Mettre à jour les métriques du projet
      if (!data.projects) {
        data.projects = {};
      }
      data.projects[projectId] = metrics;
      data.last_updated = new Date().toISOString();

      // Écrire de manière atomique
      this.writeAtomic(fullPath, data);

      this.recordEvent({
        type: 'info',
        message: `Métriques projet ${projectId} mises à jour: ${metrics.total_files} fichiers`,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error(`❌ Erreur écriture métriques projet ${projectId}:`, error.message);
    }
  }

  /**
   * WRITE-ONLY: Enregistrer un événement (bufferisé)
   */
  public recordEvent(event: MonitoringEvent): void {
    // Ajouter un timestamp si manquant
    if (!event.timestamp) {
      event.timestamp = new Date().toISOString();
    }

    // Ajouter au buffer
    this.eventBuffer.push(event);

    // Flush si buffer plein
    if (this.eventBuffer.length >= this.config.write_buffer_size) {
      this.flushEvents();
    }
  }

  /**
   * WRITE-ONLY: Écrire le statut de santé
   */
  public writeHealthStatus(health: HealthStatus): void {
    try {
      const healthDir = this.resolvePath(this.config.health_dir);
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const fileName = `health_${timestamp}.json`;
      const fullPath = path.join(healthDir, fileName);

      // Écrire le fichier de santé
      this.writeAtomic(fullPath, health);

      // Créer un lien symbolique vers latest.json
      const latestPath = path.join(healthDir, 'latest.json');
      try {
        if (fs.existsSync(latestPath)) {
          fs.unlinkSync(latestPath);
        }
        fs.symlinkSync(fileName, latestPath);
      } catch (error: any) {
        // Ignorer les erreurs de symlink (peut ne pas être supporté)
      }

      this.recordEvent({
        type: 'info',
        message: `Statut de santé mis à jour: ${health.status}`,
        timestamp: new Date().toISOString(),
        metadata: { status: health.status }
      });
    } catch (error: any) {
      console.error(`❌ Erreur écriture statut santé:`, error.message);
    }
  }

  /**
   * WRITE-ONLY: Écrire la progression d'une tâche
   */
  public writeTaskProgress(progress: TaskProgress): void {
    try {
      const progressDir = this.resolvePath(this.config.progress_dir);
      const fileName = `progress_${progress.task_id}.json`;
      const fullPath = path.join(progressDir, fileName);

      // Écrire la progression
      this.writeAtomic(fullPath, progress);

      // Enregistrer un événement pour les progressions significatives
      if (progress.progress_percent % 10 === 0 || progress.progress_percent === 100) {
        this.recordEvent({
          type: 'phase_started',
          task_id: progress.task_id,
          phase: progress.phase,
          message: `Progression ${progress.task_id}: ${progress.progress_percent}% (${progress.phase})`,
          timestamp: progress.timestamp
        });
      }
    } catch (error: any) {
      console.error(`❌ Erreur écriture progression tâche ${progress.task_id}:`, error.message);
    }
  }

  /**
   * WRITE-ONLY: Nettoyer la progression d'une tâche terminée
   */
  public cleanupTaskProgress(taskId: string): void {
    try {
      const progressDir = this.resolvePath(this.config.progress_dir);
      const fileName = `progress_${taskId}.json`;
      const fullPath = path.join(progressDir, fileName);

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (error: any) {
      // Ignorer les erreurs de nettoyage
    }
  }

  /**
   * WRITE-ONLY: Flusher les événements bufferisés
   */
  public flushEvents(): void {
    if (this.eventBuffer.length === 0) {
      return;
    }

    try {
      const eventsDir = this.resolvePath(this.config.events_dir);
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const fileName = `events_${today}.json`;
      const fullPath = path.join(eventsDir, fileName);

      // Lire les événements existants
      let existingEvents: MonitoringEvent[] = [];
      if (fs.existsSync(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          existingEvents = JSON.parse(content);
        } catch (error: any) {
          console.warn(`⚠️  Impossible de lire les événements existants:`, error.message);
        }
      }

      // Ajouter les nouveaux événements
      const allEvents = [...existingEvents, ...this.eventBuffer];

      // Trier par timestamp
      allEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Limiter le nombre d'événements par fichier
      if (allEvents.length > this.config.max_events_per_file) {
        const excess = allEvents.length - this.config.max_events_per_file;
        allEvents.splice(0, excess);
      }

      // Écrire de manière atomique
      this.writeAtomic(fullPath, allEvents);

      // Vider le buffer
      this.eventBuffer = [];

      // Nettoyer les anciens fichiers d'événements
      this.cleanupOldEventFiles();

    } catch (error: any) {
      console.error(`❌ Erreur flush événements:`, error.message);
    }
  }

  /**
   * WRITE-ONLY: Arrêter le writer (nettoyage)
   */
  public shutdown(): void {
    // Flusher les événements restants
    this.flushEvents();

    // Arrêter le timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    this.recordEvent({
      type: 'info',
      message: 'MonitoringWriter arrêté',
      timestamp: new Date().toISOString()
    });

    // Flusher un dernier fois
    this.flushEvents();
  }

  // ============================================================================
  // MÉTHODES PRIVÉES (interne au writer, pas exposées)
  // ============================================================================

  /**
   * Résoudre un chemin relatif
   */
  private resolvePath(relativePath: string): string {
    // Si le chemin commence par /rag/, le traiter comme relatif à basePath
    if (relativePath.startsWith('/rag/')) {
      return path.join(this.basePath, relativePath);
    }
    return relativePath;
  }

  /**
   * S'assurer que les répertoires existent
   */
  private ensureDirectories(): void {
    const dirs = [
      this.resolvePath(this.config.events_dir),
      this.resolvePath(this.config.health_dir),
      this.resolvePath(this.config.progress_dir),
      path.dirname(this.resolvePath(this.config.metrics_path))
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Lire les métriques existantes (usage interne uniquement)
   */
  private readExistingMetrics(filePath: string): any {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
      }
    } catch (error: any) {
      console.warn(`⚠️  Impossible de lire les métriques existantes:`, error.message);
    }

    // Retourner une structure vide par défaut
    return {
      system: {},
      performance: {},
      queue: {},
      projects: {},
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Écrire de manière atomique (write + rename)
   */
  private writeAtomic(filePath: string, data: any): void {
    const tempPath = `${filePath}.tmp`;

    try {
      // Écrire dans un fichier temporaire
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');

      // Renommer atomiquement
      fs.renameSync(tempPath, filePath);
    } catch (error: any) {
      // Nettoyer le fichier temporaire en cas d'erreur
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch (cleanupError: any) {
        // Ignorer les erreurs de nettoyage
      }
      throw error;
    }
  }

  /**
   * Nettoyer les anciens fichiers d'événements
   */
  private cleanupOldEventFiles(): void {
    try {
      const eventsDir = this.resolvePath(this.config.events_dir);
      const files = fs.readdirSync(eventsDir);

      // Filtrer les fichiers d'événements
      const eventFiles = files.filter(f => f.startsWith('events_') && f.endsWith('.json'));

      // Trier par date (le plus récent en premier)
      eventFiles.sort().reverse();

      // Supprimer les fichiers excédentaires
      if (eventFiles.length > this.config.max_event_files) {
        const filesToDelete = eventFiles.slice(this.config.max_event_files);

        for (const file of filesToDelete) {
          const filePath = path.join(eventsDir, file);
          fs.unlinkSync(filePath);
        }
      }

      // Nettoyer les fichiers trop anciens
      const retentionDate = new Date();
      retentionDate.setDate(retentionDate.getDate() - this.config.event_retention_days);

      for (const file of eventFiles) {
        // Extraire la date du nom de fichier
        const dateStr = file.replace('events_', '').replace('.json', '');
        const fileDate = new Date(dateStr);

        if (fileDate < retentionDate) {
          const filePath = path.join(eventsDir, file);
          fs.unlinkSync(filePath);
        }
      }

    } catch (error: any) {
      // Ignorer les erreurs de nettoyage
    }
  }

  /**
   * Démarrer le timer de flush automatique
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flushEvents();
    }, this.config.flush_interval_ms);
  }
}

/**
 * Factory pour créer un MonitoringWriter
 */
export function createMonitoringWriter(
  config?: Partial<MonitoringConfig>,
  basePath?: string
): MonitoringWriter {
  return new MonitoringWriter(config, basePath);
}
