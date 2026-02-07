-- Script de création de la base de données metadata.sqlite
-- Version: 1.0.0
-- Date: 07/02/2026
-- Auteur: RAG MCP Server

-- metadata.sqlite : Base de données centralisée pour les métadonnées des projets
-- Emplacement: /rag/db/metadata.sqlite

-- Table des projets
CREATE TABLE IF NOT EXISTS projects (
  -- Identifiant unique du projet (hash du chemin)
  id TEXT PRIMARY KEY,

  -- Informations sur le projet
  path TEXT UNIQUE NOT NULL,
  name TEXT,
  type TEXT CHECK (type IN ('workspace', 'folder', 'git', 'node', 'python', 'rust', 'go', 'other')),

  -- État du projet
  status TEXT CHECK (status IN ('pending', 'initializing', 'active', 'inactive', 'failed')) DEFAULT 'pending',

  -- Métadonnées d'indexation
  first_indexed_at TIMESTAMP,
  last_indexed_at TIMESTAMP,
  last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Statistiques d'indexation
  total_files_indexed INTEGER DEFAULT 0,
  total_chunks_indexed INTEGER DEFAULT 0,
  total_size_bytes BIGINT DEFAULT 0,

  -- Configuration
  config_hash TEXT,
  embedding_model_used TEXT,
  chunking_strategy_used TEXT,

  -- Métadonnées supplémentaires
  description TEXT,
  tags TEXT,
  metadata_json TEXT DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des fichiers
CREATE TABLE IF NOT EXISTS files (
  -- Identifiant unique du fichier (hash du chemin)
  id TEXT PRIMARY KEY,

  -- Référence au projet
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Informations sur le fichier
  path TEXT NOT NULL,
  name TEXT,
  extension TEXT,

  -- Métriques du fichier
  size_bytes INTEGER NOT NULL,
  lines_count INTEGER,
  character_count INTEGER,

  -- Typage du contenu
  content_type TEXT CHECK (content_type IN ('code', 'doc', 'config', 'other')) DEFAULT 'other',
  language TEXT,
  role TEXT CHECK (role IN ('core', 'helper', 'test', 'example', 'template', 'other')) DEFAULT 'core',

  -- État d'indexation
  indexed BOOLEAN DEFAULT FALSE,
  indexed_at TIMESTAMP,
  index_version INTEGER DEFAULT 1,

  -- Métadonnées d'analyse
  complexity_score REAL,
  quality_score REAL,
  has_errors BOOLEAN DEFAULT FALSE,

  -- Métadonnées supplémentaires
  metadata_json TEXT DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Contraintes
  UNIQUE(project_id, path)
);

-- Table de suivi d'indexation
CREATE TABLE IF NOT EXISTS index_status (
  -- Référence au projet
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,

  -- État d'indexation
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'partial')) DEFAULT 'pending',
  progress_percent INTEGER DEFAULT 0,

  -- Détails de l'indexation
  last_indexed TIMESTAMP,
  indexing_duration_ms INTEGER,
  indexing_strategy TEXT,

  -- Statistiques
  files_processed INTEGER DEFAULT 0,
  files_total INTEGER DEFAULT 0,
  chunks_created INTEGER DEFAULT 0,

  -- Erreurs et warnings
  error_message TEXT,
  warning_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,

  -- Métadonnées
  metadata_json TEXT DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des relations entre fichiers (imports, dépendances)
CREATE TABLE IF NOT EXISTS file_relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Fichier source
  source_file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,

  -- Fichier cible
  target_file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,

  -- Type de relation
  relation_type TEXT CHECK (relation_type IN ('import', 'require', 'include', 'reference', 'dependency', 'call')) NOT NULL,

  -- Détails de la relation
  line_number INTEGER,
  column_number INTEGER,
  context TEXT,

  -- Force de la relation
  strength REAL DEFAULT 1.0,

  -- Métadonnées
  metadata_json TEXT DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Contraintes
  UNIQUE(source_file_id, target_file_id, relation_type, line_number)
);

-- Table des symboles (fonctions, classes, variables)
CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Fichier contenant le symbole
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,

  -- Informations sur le symbole
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('function', 'class', 'method', 'variable', 'constant', 'import', 'type')) NOT NULL,
  kind TEXT,

  -- Position dans le fichier
  line_start INTEGER NOT NULL,
  line_end INTEGER,
  column_start INTEGER,
  column_end INTEGER,

  -- Métadonnées du symbole
  visibility TEXT CHECK (visibility IN ('public', 'private', 'protected', 'internal')) DEFAULT 'public',
  is_exported BOOLEAN DEFAULT FALSE,
  is_async BOOLEAN DEFAULT FALSE,

  -- Documentation
  docstring TEXT,
  comments TEXT,

  -- Métriques
  complexity_score REAL,
  parameter_count INTEGER DEFAULT 0,

  -- Métadonnées supplémentaires
  metadata_json TEXT DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Contraintes
  UNIQUE(file_id, name, type, line_start)
);

-- Table des appels entre symboles
CREATE TABLE IF NOT EXISTS symbol_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Symbole appelant
  caller_symbol_id INTEGER NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,

  -- Symbole appelé
  callee_symbol_id INTEGER NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,

  -- Informations sur l'appel
  call_type TEXT CHECK (call_type IN ('function', 'method', 'constructor', 'getter', 'setter')) DEFAULT 'function',
  line_number INTEGER,

  -- Métadonnées
  metadata_json TEXT DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Contraintes
  UNIQUE(caller_symbol_id, callee_symbol_id, line_number)
);

-- Table des métriques de qualité
CREATE TABLE IF NOT EXISTS quality_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Référence au projet ou fichier
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  file_id TEXT REFERENCES files(id) ON DELETE CASCADE,

  -- Type de métrique
  metric_type TEXT CHECK (metric_type IN ('cyclomatic', 'cognitive', 'halstead', 'maintainability', 'duplication', 'size')) NOT NULL,

  -- Valeurs de la métrique
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  metric_unit TEXT,

  -- Seuils
  threshold_warning REAL,
  threshold_error REAL,
  is_within_threshold BOOLEAN DEFAULT TRUE,

  -- Métadonnées
  metadata_json TEXT DEFAULT '{}',

  -- Timestamps
  measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Contraintes
  CHECK((project_id IS NOT NULL) OR (file_id IS NOT NULL))
);

-- Table d'audit des opérations
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Type d'opération
  operation_type TEXT CHECK (operation_type IN ('create', 'update', 'delete', 'index', 'search', 'analyze')) NOT NULL,

  -- Cible de l'opération
  target_type TEXT CHECK (target_type IN ('project', 'file', 'index', 'symbol')) NOT NULL,
  target_id TEXT NOT NULL,

  -- Utilisateur/système
  actor_type TEXT CHECK (actor_type IN ('system', 'user', 'ai', 'daemon')) DEFAULT 'system',
  actor_id TEXT,

  -- Détails de l'opération
  description TEXT NOT NULL,
  parameters_json TEXT DEFAULT '{}',
  result_json TEXT DEFAULT '{}',

  -- État
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  duration_ms INTEGER,

  -- Timestamps
  performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_last_accessed ON projects(last_accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_files_project_id ON files(project_id);
CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
CREATE INDEX IF NOT EXISTS idx_files_content_type ON files(content_type);
CREATE INDEX IF NOT EXISTS idx_files_indexed ON files(indexed) WHERE indexed = TRUE;

CREATE INDEX IF NOT EXISTS idx_index_status_project_id ON index_status(project_id);
CREATE INDEX IF NOT EXISTS idx_index_status_status ON index_status(status);

CREATE INDEX IF NOT EXISTS idx_file_relations_source ON file_relations(source_file_id);
CREATE INDEX IF NOT EXISTS idx_file_relations_target ON file_relations(target_file_id);
CREATE INDEX IF NOT EXISTS idx_file_relations_type ON file_relations(relation_type);

CREATE INDEX IF NOT EXISTS idx_symbols_file_id ON symbols(file_id);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbols_type ON symbols(type);

CREATE INDEX IF NOT EXISTS idx_symbol_calls_caller ON symbol_calls(caller_symbol_id);
CREATE INDEX IF NOT EXISTS idx_symbol_calls_callee ON symbol_calls(callee_symbol_id);

CREATE INDEX IF NOT EXISTS idx_quality_metrics_project ON quality_metrics(project_id);
CREATE INDEX IF NOT EXISTS idx_quality_metrics_file ON quality_metrics(file_id);
CREATE INDEX IF NOT EXISTS idx_quality_metrics_type ON quality_metrics(metric_type);

CREATE INDEX IF NOT EXISTS idx_audit_log_performed_at ON audit_log(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_operation_type ON audit_log(operation_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON audit_log(target_type, target_id);

-- Triggers pour updated_at
CREATE TRIGGER IF NOT EXISTS update_projects_updated_at
AFTER UPDATE ON projects
FOR EACH ROW
BEGIN
  UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_files_updated_at
AFTER UPDATE ON files
FOR EACH ROW
BEGIN
  UPDATE files SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_index_status_updated_at
AFTER UPDATE ON index_status
FOR EACH ROW
BEGIN
  UPDATE index_status SET updated_at = CURRENT_TIMESTAMP WHERE project_id = NEW.project_id;
END;

-- Vue pour les statistiques des projets
CREATE VIEW IF NOT EXISTS project_stats AS
SELECT
  p.id,
  p.path,
  p.name,
  p.status,
  p.total_files_indexed,
  p.total_chunks_indexed,
  p.total_size_bytes,
  p.last_indexed_at,
  p.last_accessed_at,
  COUNT(DISTINCT f.id) as files_count,
  COUNT(DISTINCT s.id) as symbols_count,
  AVG(qm.metric_value) as avg_quality_score
FROM projects p
LEFT JOIN files f ON p.id = f.project_id
LEFT JOIN symbols s ON f.id = s.file_id
LEFT JOIN quality_metrics qm ON p.id = qm.project_id AND qm.metric_type = 'maintainability'
GROUP BY p.id;

-- Vue pour les dépendances entre fichiers
CREATE VIEW IF NOT EXISTS file_dependencies AS
SELECT
  sf.path as source_file,
  tf.path as target_file,
  fr.relation_type,
  COUNT(*) as relation_count
FROM file_relations fr
JOIN files sf ON fr.source_file_id = sf.id
JOIN files tf ON fr.target_file_id = tf.id
GROUP BY sf.path, tf.path, fr.relation_type;

-- Vue pour l'analyse de complexité
CREATE VIEW IF NOT EXISTS complexity_analysis AS
SELECT
  f.path,
  f.lines_count,
  f.complexity_score,
  COUNT(DISTINCT s.id) as symbols_count,
  COUNT(DISTINCT sc.id) as calls_count,
  AVG(qm.metric_value) as avg_complexity
FROM files f
LEFT JOIN symbols s ON f.id = s.file_id
LEFT JOIN symbol_calls sc ON s.id = sc.caller_symbol_id
LEFT JOIN quality_metrics qm ON f.id = qm.file_id AND qm.metric_type = 'cyclomatic'
WHERE f.content_type = 'code'
GROUP BY f.id;

-- Message de confirmation
SELECT 'metadata.sqlite schema created successfully' as message;
SELECT COUNT(*) as tables_created FROM sqlite_master WHERE type = 'table';
SELECT name as table_names FROM sqlite_master WHERE type = 'table' ORDER BY name;
