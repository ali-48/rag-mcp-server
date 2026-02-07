-- Script de création de la base de données memory.sqlite
-- Version: 1.0.0
-- Date: 07/02/2026
-- Auteur: RAG MCP Server

-- memory.sqlite : Base de données centralisée pour le cache mémoire et le contexte
-- Emplacement: /rag/db/memory.sqlite

-- Table du cache mémoire
CREATE TABLE IF NOT EXISTS cache (
  -- Clé unique du cache (hash du contenu ou identifiant)
  key TEXT PRIMARY KEY,

  -- Valeur du cache (JSON ou texte)
  value TEXT NOT NULL,

  -- Type de contenu
  content_type TEXT CHECK (content_type IN ('json', 'text', 'binary', 'object')) DEFAULT 'json',

  -- Métadonnées du cache
  size_bytes INTEGER NOT NULL,
  compression_ratio REAL,
  is_compressed BOOLEAN DEFAULT FALSE,

  -- Gestion du cache
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  access_count INTEGER DEFAULT 0,

  -- Stratégie de cache
  cache_strategy TEXT CHECK (cache_strategy IN ('lru', 'lfu', 'fifo', 'ttl', 'manual')) DEFAULT 'ttl',
  priority INTEGER DEFAULT 1,

  -- Métadonnées supplémentaires
  tags TEXT,
  metadata_json TEXT DEFAULT '{}',

  -- Relations (optionnel)
  project_id TEXT,
  session_id TEXT,
  user_id TEXT
);

-- Table de l'historique de contexte
CREATE TABLE IF NOT EXISTS context_history (
  -- Identifiant unique de l'entrée de contexte
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Session ou conversation
  session_id TEXT NOT NULL,
  conversation_id TEXT,

  -- Type de contexte
  context_type TEXT CHECK (context_type IN ('chat', 'command', 'query', 'analysis', 'decision', 'error')) DEFAULT 'chat',

  -- Contenu du contexte
  content TEXT NOT NULL,
  content_summary TEXT,

  -- Métadonnées du contenu
  content_length INTEGER NOT NULL,
  token_count INTEGER,
  language TEXT DEFAULT 'fr',

  -- Source du contexte
  source_type TEXT CHECK (source_type IN ('user', 'ai', 'system', 'tool', 'external')) DEFAULT 'user',
  source_id TEXT,

  -- Relations
  parent_context_id INTEGER REFERENCES context_history(id),
  project_id TEXT,
  file_id TEXT,

  -- Importance et pertinence
  importance_score REAL DEFAULT 1.0,
  relevance_score REAL DEFAULT 1.0,
  is_pinned BOOLEAN DEFAULT FALSE,

  -- Métadonnées temporelles
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,

  -- Métadonnées supplémentaires
  metadata_json TEXT DEFAULT '{}'
);

-- Table des embeddings de contexte
CREATE TABLE IF NOT EXISTS context_embeddings (
  -- Identifiant unique de l'embedding
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Référence au contexte
  context_id INTEGER NOT NULL REFERENCES context_history(id) ON DELETE CASCADE,

  -- Embedding vector (JSON array ou BLOB)
  embedding_json TEXT NOT NULL,
  embedding_dimension INTEGER NOT NULL,

  -- Modèle utilisé
  model_name TEXT NOT NULL,
  model_version TEXT,

  -- Métriques de qualité
  quality_score REAL,
  confidence_score REAL DEFAULT 1.0,

  -- Métadonnées
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT DEFAULT '{}'
);

-- Table des similarités de contexte
CREATE TABLE IF NOT EXISTS context_similarities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Contextes comparés
  context_id_1 INTEGER NOT NULL REFERENCES context_history(id) ON DELETE CASCADE,
  context_id_2 INTEGER NOT NULL REFERENCES context_history(id) ON DELETE CASCADE,

  -- Métrique de similarité
  similarity_type TEXT CHECK (similarity_type IN ('cosine', 'euclidean', 'dot', 'jaccard')) DEFAULT 'cosine',
  similarity_score REAL NOT NULL,

  -- Seuils
  is_above_threshold BOOLEAN DEFAULT FALSE,
  threshold_used REAL DEFAULT 0.7,

  -- Métadonnées
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT DEFAULT '{}',

  -- Contraintes
  UNIQUE(context_id_1, context_id_2, similarity_type)
);

-- Table des décisions IA
CREATE TABLE IF NOT EXISTS ai_decisions (
  -- Identifiant unique de la décision
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Contexte de la décision
  decision_context TEXT NOT NULL,
  decision_type TEXT CHECK (decision_type IN ('action', 'analysis', 'recommendation', 'validation', 'correction')) DEFAULT 'action',

  -- Décision prise
  decision_made TEXT NOT NULL,
  decision_confidence REAL DEFAULT 1.0,

  -- Alternatives considérées
  alternatives_json TEXT DEFAULT '[]',

  -- Résultat de la décision
  result_json TEXT DEFAULT '{}',
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,

  -- Métadonnées
  model_used TEXT,
  temperature_used REAL,
  max_tokens_used INTEGER,

  -- Timestamps
  decided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  executed_at TIMESTAMP,

  -- Relations
  parent_decision_id INTEGER REFERENCES ai_decisions(id),
  project_id TEXT,
  task_id TEXT,

  -- Métadonnées supplémentaires
  metadata_json TEXT DEFAULT '{}'
);

-- Table des patterns d'apprentissage
CREATE TABLE IF NOT EXISTS learning_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Pattern identifié
  pattern_type TEXT CHECK (pattern_type IN ('behavior', 'preference', 'error', 'success', 'efficiency')) NOT NULL,
  pattern_name TEXT NOT NULL,
  pattern_description TEXT,

  -- Données du pattern
  pattern_data_json TEXT NOT NULL,
  pattern_frequency INTEGER DEFAULT 1,

  -- Confiance et validité
  confidence_score REAL DEFAULT 1.0,
  is_validated BOOLEAN DEFAULT FALSE,
  validation_count INTEGER DEFAULT 0,

  -- Application
  can_be_applied BOOLEAN DEFAULT TRUE,
  application_count INTEGER DEFAULT 0,
  last_applied_at TIMESTAMP,

  -- Métadonnées
  discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,

  -- Relations
  project_id TEXT,
  user_id TEXT,

  -- Métadonnées supplémentaires
  metadata_json TEXT DEFAULT '{}'
);

-- Table des sessions actives
CREATE TABLE IF NOT EXISTS active_sessions (
  -- Identifiant de session
  session_id TEXT PRIMARY KEY,

  -- Informations sur la session
  session_type TEXT CHECK (session_type IN ('chat', 'analysis', 'indexing', 'monitoring', 'maintenance')) DEFAULT 'chat',
  session_name TEXT,

  -- État de la session
  is_active BOOLEAN DEFAULT TRUE,
  status TEXT CHECK (status IN ('active', 'paused', 'completed', 'failed', 'timeout')) DEFAULT 'active',

  -- Métadonnées de la session
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,

  -- Statistiques
  message_count INTEGER DEFAULT 0,
  token_count INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,

  -- Utilisateur et projet
  user_id TEXT,
  project_id TEXT,

  -- Configuration
  config_json TEXT DEFAULT '{}',

  -- Métadonnées supplémentaires
  metadata_json TEXT DEFAULT '{}'
);

-- Table des messages de session
CREATE TABLE IF NOT EXISTS session_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Session parente
  session_id TEXT NOT NULL REFERENCES active_sessions(session_id) ON DELETE CASCADE,

  -- Message
  message_type TEXT CHECK (message_type IN ('user', 'assistant', 'system', 'tool', 'error')) DEFAULT 'user',
  content TEXT NOT NULL,

  -- Métadonnées du message
  content_length INTEGER NOT NULL,
  token_count INTEGER,
  language TEXT DEFAULT 'fr',

  -- Timing
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processing_time_ms INTEGER,

  -- Références
  parent_message_id INTEGER REFERENCES session_messages(id),
  tool_call_id TEXT,

  -- État
  is_processed BOOLEAN DEFAULT TRUE,
  has_error BOOLEAN DEFAULT FALSE,
  error_message TEXT,

  -- Métadonnées supplémentaires
  metadata_json TEXT DEFAULT '{}'
);

-- Table des états de conversation
CREATE TABLE IF NOT EXISTS conversation_states (
  -- Identifiant de la conversation
  conversation_id TEXT PRIMARY KEY,

  -- Session parente
  session_id TEXT NOT NULL REFERENCES active_sessions(session_id) ON DELETE CASCADE,

  -- État courant
  current_state TEXT NOT NULL,
  state_type TEXT CHECK (state_type IN ('initial', 'processing', 'waiting', 'completed', 'error')) DEFAULT 'processing',

  -- Données d'état
  state_data_json TEXT DEFAULT '{}',
  state_history_json TEXT DEFAULT '[]',

  -- Transitions
  previous_state TEXT,
  next_state TEXT,

  -- Métadonnées temporelles
  entered_state_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  state_duration_seconds INTEGER DEFAULT 0,

  -- Métadonnées supplémentaires
  metadata_json TEXT DEFAULT '{}'
);

-- Table des verrous distribués
CREATE TABLE IF NOT EXISTS distributed_locks (
  -- Nom du verrou
  lock_name TEXT PRIMARY KEY,

  -- Propriétaire du verrou
  owner_id TEXT NOT NULL,
  owner_type TEXT CHECK (owner_type IN ('process', 'thread', 'service', 'user')) DEFAULT 'process',

  -- État du verrou
  is_locked BOOLEAN DEFAULT TRUE,
  acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Timeout et expiration
  timeout_seconds INTEGER DEFAULT 30,
  expires_at TIMESTAMP,

  -- Métadonnées
  metadata_json TEXT DEFAULT '{}',

  -- Contraintes
  CHECK((is_locked = TRUE AND expires_at > CURRENT_TIMESTAMP) OR is_locked = FALSE)
);

-- Table des métriques de performance mémoire
CREATE TABLE IF NOT EXISTS memory_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Type de métrique
  metric_type TEXT CHECK (metric_type IN ('cache_hit', 'cache_miss', 'cache_size', 'response_time', 'memory_usage')) NOT NULL,
  metric_name TEXT NOT NULL,

  -- Valeurs
  metric_value REAL NOT NULL,
  metric_unit TEXT,

  -- Seuils
  threshold_warning REAL,
  threshold_error REAL,
  is_within_threshold BOOLEAN DEFAULT TRUE,

  -- Contexte
  measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  time_window_seconds INTEGER,

  -- Relations
  session_id TEXT,
  project_id TEXT,

  -- Métadonnées
  metadata_json TEXT DEFAULT '{}'
);

-- Table de nettoyage automatique
CREATE TABLE IF NOT EXISTS cleanup_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Type de nettoyage
  cleanup_type TEXT CHECK (cleanup_type IN ('cache', 'context', 'sessions', 'metrics', 'all')) NOT NULL,

  -- Planification
  schedule_cron TEXT,
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,

  -- Résultats
  items_cleaned INTEGER DEFAULT 0,
  space_freed_bytes INTEGER DEFAULT 0,
  duration_ms INTEGER,

  -- État
  is_enabled BOOLEAN DEFAULT TRUE,
  error_message TEXT,

  -- Configuration
  config_json TEXT DEFAULT '{}',

  -- Métadonnées
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_cache_key ON cache(key);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cache_last_accessed ON cache(last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_cache_project ON cache(project_id) WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_context_history_session ON context_history(session_id);
CREATE INDEX IF NOT EXISTS idx_context_history_created ON context_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_context_history_expires ON context_history(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_context_history_importance ON context_history(importance_score DESC);

CREATE INDEX IF NOT EXISTS idx_context_embeddings_context ON context_embeddings(context_id);
CREATE INDEX IF NOT EXISTS idx_context_embeddings_model ON context_embeddings(model_name);

CREATE INDEX IF NOT EXISTS idx_context_similarities_pair ON context_similarities(context_id_1, context_id_2);
CREATE INDEX IF NOT EXISTS idx_context_similarities_score ON context_similarities(similarity_score DESC);

CREATE INDEX IF NOT EXISTS idx_ai_decisions_decided ON ai_decisions(decided_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_project ON ai_decisions(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_decisions_task ON ai_decisions(task_id) WHERE task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_learning_patterns_type ON learning_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_frequency ON learning_patterns(pattern_frequency DESC);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_discovered ON learning_patterns(discovered_at DESC);

CREATE INDEX IF NOT EXISTS idx_active_sessions_status ON active_sessions(status);
CREATE INDEX IF NOT EXISTS idx_active_sessions_last_activity ON active_sessions(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires ON active_sessions(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_session_messages_session ON session_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_session_messages_created ON session_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_messages_type ON session_messages(message_type);

CREATE INDEX IF NOT EXISTS idx_conversation_states_session ON conversation_states(session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_states_state ON conversation_states(current_state);

CREATE INDEX IF NOT EXISTS idx_distributed_locks_expires ON distributed_locks(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_distributed_locks_owner ON distributed_locks(owner_id);

CREATE INDEX IF NOT EXISTS idx_memory_metrics_measured ON memory_metrics(measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_metrics_type ON memory_metrics(metric_type);

CREATE INDEX IF NOT EXISTS idx_cleanup_schedule_next_run ON cleanup_schedule(next_run_at) WHERE is_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_cleanup_schedule_type ON cleanup_schedule(cleanup_type);

-- Triggers pour la maintenance automatique
CREATE TRIGGER IF NOT EXISTS update_cache_access
AFTER UPDATE OF last_accessed_at ON cache
FOR EACH ROW
BEGIN
  UPDATE cache SET access_count = access_count + 1 WHERE key = NEW.key;
END;

CREATE TRIGGER IF NOT EXISTS update_context_history_access
AFTER UPDATE OF accessed_at ON context_history
FOR EACH ROW
BEGIN
  UPDATE context_history
  SET importance_score = importance_score * 0.95 + 0.05
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS cleanup_expired_cache
AFTER INSERT ON cache
BEGIN
  DELETE FROM cache WHERE expires_at < CURRENT_TIMESTAMP;
END;

CREATE TRIGGER IF NOT EXISTS cleanup_expired_context
AFTER INSERT ON context_history
BEGIN
  DELETE FROM context_history WHERE expires_at < CURRENT_TIMESTAMP;
END;

CREATE TRIGGER IF NOT EXISTS update_active_sessions_activity
AFTER INSERT ON session_messages
FOR EACH ROW
BEGIN
  UPDATE active_sessions
  SET last_activity_at = CURRENT_TIMESTAMP,
      message_count = message_count + 1
  WHERE session_id = NEW.session_id;
END;

-- Vues pour l'analyse

-- Vue des statistiques de cache
CREATE VIEW IF NOT EXISTS cache_stats AS
SELECT
  COUNT(*) as total_entries,
  SUM(size_bytes) as total_size_bytes,
  AVG(access_count) as avg_access_count,
  SUM(CASE WHEN expires_at < CURRENT_TIMESTAMP THEN 1 ELSE 0 END) as expired_entries,
  SUM(CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END) as permanent_entries,
  AVG(compression_ratio) as avg_compression_ratio
FROM cache;

-- Vue des sessions actives avec statistiques
CREATE VIEW IF NOT EXISTS active_sessions_stats AS
SELECT
  s.session_id,
  s.session_type,
  s.session_name,
  s.is_active,
  s.status,
  s.created_at,
  s.last_activity_at,
  s.message_count,
  s.token_count,
  s.duration_seconds,
  COUNT(DISTINCT m.id) as actual_message_count,
  MAX(m.created_at) as last_message_at
FROM active_sessions s
LEFT JOIN session_messages m ON s.session_id = m.session_id
GROUP BY s.session_id;

-- Vue des patterns d'apprentissage fréquents
CREATE VIEW IF NOT EXISTS frequent_learning_patterns AS
SELECT
  pattern_type,
  pattern_name,
  COUNT(*) as occurrence_count,
  AVG(confidence_score) as avg_confidence,
  MAX(discovered_at) as last_discovered,
  GROUP_CONCAT(DISTINCT project_id) as projects
FROM learning_patterns
WHERE is_validated = TRUE
GROUP BY pattern_type, pattern_name
HAVING COUNT(*) >= 3
ORDER BY occurrence_count DESC;

-- Vue des décisions IA récentes
CREATE VIEW IF NOT EXISTS recent_ai_decisions AS
SELECT
  id,
  decision_type,
  decision_made,
  decision_confidence,
  success,
  decided_at,
  executed_at,
  project_id,
  task_id,
  LENGTH(decision_context) as context_length
FROM ai_decisions
ORDER BY decided_at DESC
LIMIT 100;

-- Vue des métriques de performance mémoire récentes
CREATE VIEW IF NOT EXISTS recent_memory_metrics AS
SELECT
  metric_type,
  metric_name,
  metric_value,
  metric_unit,
  measured_at,
  session_id,
  project_id
FROM memory_metrics
ORDER BY measured_at DESC
LIMIT 100;

-- Vue du nettoyage planifié
CREATE VIEW IF NOT EXISTS scheduled_cleanup AS
SELECT
  cleanup_type,
  last_run_at,
  next_run_at,
  is_enabled,
  items_cleaned,
  space_freed_bytes
FROM cleanup_schedule
WHERE is_enabled = TRUE
ORDER BY next_run_at;

-- Message de confirmation
SELECT 'memory.sqlite schema created successfully' as message;
SELECT COUNT(*) as tables_created FROM sqlite_master WHERE type = 'table';
SELECT name as table_names FROM sqlite_master WHERE type = 'table' ORDER BY name;
