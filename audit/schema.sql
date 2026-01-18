-- Schéma d'extension pour l'audit incrémental et le cache AST
-- Ce fichier étend la base de données code_map.db existante

-- Table pour stocker les métriques de chaque commit
CREATE TABLE IF NOT EXISTS commit_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    commit_hash TEXT NOT NULL,
    commit_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_files INTEGER NOT NULL,
    changed_files INTEGER NOT NULL,
    added_files INTEGER NOT NULL,
    modified_files INTEGER NOT NULL,
    deleted_files INTEGER NOT NULL,
    quality_score REAL,
    audit_duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour recherche rapide par commit hash
CREATE INDEX IF NOT EXISTS idx_commit_metrics_hash ON commit_metrics(commit_hash);
CREATE INDEX IF NOT EXISTS idx_commit_metrics_timestamp ON commit_metrics(commit_timestamp);

-- Table pour le cache AST des fichiers
CREATE TABLE IF NOT EXISTS ast_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL UNIQUE,
    file_hash TEXT NOT NULL,  -- Hash MD5 du contenu du fichier
    ast_json TEXT NOT NULL,    -- AST sérialisé en JSON
    file_size INTEGER NOT NULL,
    last_modified TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour recherche rapide par chemin de fichier
CREATE INDEX IF NOT EXISTS idx_ast_cache_path ON ast_cache(file_path);
CREATE INDEX IF NOT EXISTS idx_ast_cache_hash ON ast_cache(file_hash);

-- Table pour suivre les changements de fichiers détectés par le watcher
CREATE TABLE IF NOT EXISTS file_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    change_type TEXT NOT NULL,  -- 'added', 'modified', 'deleted'
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    audit_result TEXT  -- Résultat de l'audit incrémental (JSON)
);

-- Index pour les changements non traités
CREATE INDEX IF NOT EXISTS idx_file_changes_unprocessed ON file_changes(processed) WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_file_changes_detected ON file_changes(detected_at);

-- Table pour les métriques d'audit par fichier (liée à commit_metrics)
CREATE TABLE IF NOT EXISTS file_audit_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    commit_metric_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    quality_score REAL,
    complexity REAL,
    maintainability REAL,
    symbol_count INTEGER,
    FOREIGN KEY (commit_metric_id) REFERENCES commit_metrics(id) ON DELETE CASCADE
);

-- Index pour recherche par commit et fichier
CREATE INDEX IF NOT EXISTS idx_file_audit_metrics_commit ON file_audit_metrics(commit_metric_id);
CREATE INDEX IF NOT EXISTS idx_file_audit_metrics_path ON file_audit_metrics(file_path);

-- Vue pour obtenir un rapport complet des métriques de commit
CREATE VIEW IF NOT EXISTS commit_metrics_report AS
SELECT
    cm.commit_hash,
    cm.commit_timestamp,
    cm.total_files,
    cm.changed_files,
    cm.added_files,
    cm.modified_files,
    cm.deleted_files,
    cm.quality_score,
    cm.audit_duration_ms,
    COUNT(fam.id) as files_audited
FROM commit_metrics cm
LEFT JOIN file_audit_metrics fam ON cm.id = fam.commit_metric_id
GROUP BY cm.id;

-- Vue pour les fichiers avec cache AST expiré (modifiés depuis la dernière mise en cache)
CREATE VIEW IF NOT EXISTS expired_ast_cache AS
SELECT
    ac.file_path,
    ac.file_hash as cached_hash,
    ac.last_modified as cached_last_modified,
    f.size as current_size,
    f.modified_at as current_last_modified
FROM ast_cache ac
LEFT JOIN (
    SELECT path, size, MAX(modified_at) as modified_at
    FROM files
    GROUP BY path
) f ON ac.file_path = f.path
WHERE f.modified_at > ac.last_modified OR f.size != ac.file_size;
