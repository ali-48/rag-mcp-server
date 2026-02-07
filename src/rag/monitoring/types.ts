// src/rag/monitoring/types.ts
// Types de données pour le monitoring write-only strict

/**
 * Métriques système
 */
export interface SystemMetrics {
  timestamp: string;  // ISO 8601
  memory_usage_percent: number;  // 0-100
  cpu_usage_percent: number;     // 0-100
  active_threads: number;
  disk_usage_percent?: number;   // 0-100
  network_io_bytes_per_second?: number;
  uptime_seconds: number;
}

/**
 * Événement de monitoring
 */
export interface MonitoringEvent {
  type: 'task_started' | 'task_completed' | 'task_failed' | 'task_cancelled' |
  'error' | 'warning' | 'info' | 'debug' | 'phase_started' | 'phase_completed';
  task_id?: string;
  phase?: string;
  message: string;
  timestamp: string;  // ISO 8601
  metadata?: Record<string, any>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Statut de santé
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;  // ISO 8601
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warning';
    duration_ms: number;
    message?: string;
    last_check: string;  // ISO 8601
  }>;
  overall_message?: string;
}

/**
 * Progression de tâche
 */
export interface TaskProgress {
  task_id: string;
  phase: string;
  progress_percent: number;  // 0-100
  estimated_seconds_remaining?: number;
  files_processed?: number;
  total_files?: number;
  chunks_processed?: number;
  total_chunks?: number;
  embeddings_generated?: number;
  total_embeddings?: number;
  timestamp: string;  // ISO 8601
  message?: string;
}

/**
 * Métriques de performance
 */
export interface PerformanceMetrics {
  timestamp: string;  // ISO 8601
  avg_response_time_ms: number;
  requests_per_second: number;
  error_rate_percent: number;  // 0-100
  cache_hit_rate_percent?: number;  // 0-100
  embedding_generation_time_ms?: number;
  indexing_time_ms?: number;
  query_processing_time_ms?: number;
}

/**
 * Métriques par projet
 */
export interface ProjectMetrics {
  project_id: string;
  timestamp: string;  // ISO 8601
  total_files: number;
  code_files: number;
  config_files: number;
  doc_files: number;
  functions: number;
  classes: number;
  imports: number;
  calls: number;
  avg_complexity: number;  // 0-1
  avg_quality: number;     // 0-1
  hotspots_count: number;
  risks_count: number;
}

/**
 * Métriques de file d'attente
 */
export interface QueueMetrics {
  timestamp: string;  // ISO 8601
  pending_tasks: number;
  active_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  cancelled_tasks: number;
  avg_wait_time_seconds: number;
  avg_processing_time_seconds: number;
}

/**
 * Configuration du monitoring
 */
export interface MonitoringConfig {
  // Chemins des fichiers
  metrics_path: string;
  events_dir: string;
  health_dir: string;
  progress_dir: string;

  // Limites
  max_events_per_file: number;  // Nombre max d'événements par fichier
  max_event_files: number;       // Nombre max de fichiers d'événements
  event_retention_days: number;  // Jours de rétention des événements

  // Rotation
  rotate_metrics_hours: number;  // Rotation des métriques (heures)
  rotate_health_hours: number;   // Rotation des statuts de santé

  // Performance
  write_buffer_size: number;     // Taille du buffer d'écriture
  flush_interval_ms: number;     // Intervalle de flush
}

/**
 * Configuration par défaut
 */
export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  metrics_path: '/rag/monitoring/metrics.json',
  events_dir: '/rag/monitoring/events',
  health_dir: '/rag/monitoring/health',
  progress_dir: '/rag/monitoring/progress',

  max_events_per_file: 1000,
  max_event_files: 30,
  event_retention_days: 7,

  rotate_metrics_hours: 24,
  rotate_health_hours: 1,

  write_buffer_size: 100,
  flush_interval_ms: 5000
};

/**
 * Données complètes de monitoring
 */
export interface MonitoringData {
  system: SystemMetrics;
  performance: PerformanceMetrics;
  queue: QueueMetrics;
  projects: Record<string, ProjectMetrics>;
  last_updated: string;
}
