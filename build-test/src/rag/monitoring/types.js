// src/rag/monitoring/types.ts
// Types de données pour le monitoring write-only strict
/**
 * Configuration par défaut
 */
export const DEFAULT_MONITORING_CONFIG = {
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
//# sourceMappingURL=types.js.map