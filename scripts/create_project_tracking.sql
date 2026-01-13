-- Script de création de la table de suivi des projets pour Phase 0.4 Chat Cline
-- Version: 1.0.0
-- Date: 13/01/2026
-- Auteur: Cline AI Assistant

-- Table pour le suivi des projets
CREATE TABLE IF NOT EXISTS project_tracking (
  -- Identifiant unique du projet
  project_id SERIAL PRIMARY KEY,
  
  -- Informations sur le projet
  project_path TEXT NOT NULL UNIQUE,
  project_name TEXT,
  project_type TEXT CHECK (project_type IN ('workspace', 'folder', 'git', 'other')),
  
  -- Métadonnées d'indexation
  first_indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Statistiques d'indexation
  total_files_indexed INTEGER DEFAULT 0,
  total_chunks_indexed INTEGER DEFAULT 0,
  total_size_bytes BIGINT DEFAULT 0,
  
  -- État du projet
  is_active BOOLEAN DEFAULT TRUE,
  indexing_status TEXT CHECK (indexing_status IN ('pending', 'in_progress', 'completed', 'failed', 'partial')) DEFAULT 'pending',
  indexing_progress_percent INTEGER DEFAULT 0,
  
  -- Configuration du projet
  config_hash TEXT,
  embedding_model_used TEXT,
  chunking_strategy_used TEXT,
  
  -- Métadonnées supplémentaires
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour la liaison message → projet
CREATE TABLE IF NOT EXISTS message_project_link (
  -- Identifiant unique du message
  message_id SERIAL PRIMARY KEY,
  
  -- Référence au projet
  project_id INTEGER REFERENCES project_tracking(project_id) ON DELETE CASCADE,
  
  -- Informations sur le message
  message_content TEXT NOT NULL,
  message_type TEXT CHECK (message_type IN ('query', 'command', 'response', 'error', 'info')) DEFAULT 'query',
  message_source TEXT CHECK (message_source IN ('chat', 'cli', 'api', 'web', 'other')) DEFAULT 'chat',
  
  -- Métadonnées du message
  user_id TEXT,
  session_id TEXT,
  conversation_id TEXT,
  
  -- Analyse du message
  detected_intent TEXT,
  detected_language TEXT,
  confidence_score FLOAT DEFAULT 0.0,
  
  -- Résultats de la liaison
  is_project_related BOOLEAN DEFAULT TRUE,
  relevance_score FLOAT DEFAULT 0.0,
  match_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour l'historique des interactions par projet
CREATE TABLE IF NOT EXISTS project_interaction_history (
  -- Identifiant unique de l'interaction
  interaction_id SERIAL PRIMARY KEY,
  
  -- Référence au projet
  project_id INTEGER REFERENCES project_tracking(project_id) ON DELETE CASCADE,
  
  -- Type d'interaction
  interaction_type TEXT CHECK (interaction_type IN ('index', 'search', 'update', 'query', 'analysis', 'other')) DEFAULT 'query',
  
  -- Détails de l'interaction
  action_description TEXT NOT NULL,
  action_parameters JSONB DEFAULT '{}'::jsonb,
  action_result JSONB DEFAULT '{}'::jsonb,
  
  -- Métriques de performance
  duration_ms INTEGER,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  
  -- Métadonnées
  user_id TEXT,
  session_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour le cache temporaire des projets actifs
CREATE TABLE IF NOT EXISTS active_project_cache (
  -- Identifiant unique du cache
  cache_id SERIAL PRIMARY KEY,
  
  -- Référence au projet
  project_id INTEGER REFERENCES project_tracking(project_id) ON DELETE CASCADE,
  
  -- Données du cache
  cache_key TEXT NOT NULL,
  cache_data JSONB NOT NULL,
  cache_type TEXT CHECK (cache_type IN ('embeddings', 'analysis', 'metadata', 'other')) DEFAULT 'metadata',
  
  -- Gestion du cache
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  access_count INTEGER DEFAULT 0,
  
  -- Métadonnées
  size_bytes INTEGER,
  compression_ratio FLOAT,
  
  -- Index pour performances
  UNIQUE(project_id, cache_key, cache_type)
);

-- Index pour performances
CREATE INDEX idx_project_tracking_project_path ON project_tracking(project_path);
CREATE INDEX idx_project_tracking_last_accessed ON project_tracking(last_accessed_at DESC);
CREATE INDEX idx_project_tracking_is_active ON project_tracking(is_active) WHERE is_active = TRUE;

CREATE INDEX idx_message_project_link_project_id ON message_project_link(project_id);
CREATE INDEX idx_message_project_link_created_at ON message_project_link(created_at DESC);
CREATE INDEX idx_message_project_link_is_project_related ON message_project_link(is_project_related) WHERE is_project_related = TRUE;
CREATE INDEX idx_message_project_link_relevance_score ON message_project_link(relevance_score DESC);

CREATE INDEX idx_project_interaction_history_project_id ON project_interaction_history(project_id);
CREATE INDEX idx_project_interaction_history_created_at ON project_interaction_history(created_at DESC);
CREATE INDEX idx_project_interaction_history_interaction_type ON project_interaction_history(interaction_type);

CREATE INDEX idx_active_project_cache_project_id ON active_project_cache(project_id);
CREATE INDEX idx_active_project_cache_expires_at ON active_project_cache(expires_at);
CREATE INDEX idx_active_project_cache_cache_key ON active_project_cache(cache_key);
CREATE INDEX idx_active_project_cache_last_accessed ON active_project_cache(last_accessed_at DESC);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_project_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour updated_at
CREATE TRIGGER update_project_tracking_updated_at
  BEFORE UPDATE ON project_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_project_tracking_updated_at();

-- Fonction pour enregistrer une nouvelle interaction
CREATE OR REPLACE FUNCTION record_project_interaction(
  p_project_path TEXT,
  p_interaction_type TEXT,
  p_action_description TEXT,
  p_action_parameters JSONB DEFAULT '{}'::jsonb,
  p_user_id TEXT DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_project_id INTEGER;
  v_interaction_id INTEGER;
BEGIN
  -- Trouver ou créer le projet
  SELECT project_id INTO v_project_id
  FROM project_tracking
  WHERE project_path = p_project_path;
  
  IF v_project_id IS NULL THEN
    -- Créer un nouveau projet
    INSERT INTO project_tracking (project_path, project_name, indexing_status)
    VALUES (
      p_project_path,
      SUBSTRING(p_project_path FROM '/([^/]+)/?$'),
      'partial'
    )
    RETURNING project_id INTO v_project_id;
  END IF;
  
  -- Mettre à jour last_accessed_at
  UPDATE project_tracking
  SET last_accessed_at = NOW()
  WHERE project_id = v_project_id;
  
  -- Enregistrer l'interaction
  INSERT INTO project_interaction_history (
    project_id,
    interaction_type,
    action_description,
    action_parameters,
    user_id,
    session_id
  ) VALUES (
    v_project_id,
    p_interaction_type,
    p_action_description,
    p_action_parameters,
    p_user_id,
    p_session_id
  )
  RETURNING interaction_id INTO v_interaction_id;
  
  RETURN v_interaction_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour lier un message à un projet
CREATE OR REPLACE FUNCTION link_message_to_project(
  p_message_content TEXT,
  p_project_path TEXT,
  p_message_type TEXT DEFAULT 'query',
  p_message_source TEXT DEFAULT 'chat',
  p_user_id TEXT DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL,
  p_conversation_id TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_project_id INTEGER;
  v_message_id INTEGER;
  v_relevance_score FLOAT;
  v_match_reason TEXT;
BEGIN
  -- Trouver ou créer le projet
  SELECT project_id INTO v_project_id
  FROM project_tracking
  WHERE project_path = p_project_path;
  
  IF v_project_id IS NULL THEN
    -- Créer un nouveau projet
    INSERT INTO project_tracking (project_path, project_name)
    VALUES (
      p_project_path,
      SUBSTRING(p_project_path FROM '/([^/]+)/?$')
    )
    RETURNING project_id INTO v_project_id;
  END IF;
  
  -- Analyser la pertinence du message (algorithme simple)
  -- Ici, on pourrait utiliser une analyse plus sophistiquée
  v_relevance_score := CASE 
    WHEN p_message_content ILIKE '%' || (SELECT project_name FROM project_tracking WHERE project_id = v_project_id) || '%' THEN 0.9
    WHEN p_message_content ILIKE '%project%' OR p_message_content ILIKE '%code%' OR p_message_content ILIKE '%file%' THEN 0.7
    ELSE 0.5
  END;
  
  v_match_reason := CASE 
    WHEN v_relevance_score >= 0.8 THEN 'Project name mentioned'
    WHEN v_relevance_score >= 0.6 THEN 'Technical content detected'
    ELSE 'Generic message'
  END;
  
  -- Enregistrer le lien message-projet
  INSERT INTO message_project_link (
    project_id,
    message_content,
    message_type,
    message_source,
    user_id,
    session_id,
    conversation_id,
    relevance_score,
    match_reason,
    is_project_related
  ) VALUES (
    v_project_id,
    p_message_content,
    p_message_type,
    p_message_source,
    p_user_id,
    p_session_id,
    p_conversation_id,
    v_relevance_score,
    v_match_reason,
    v_relevance_score >= 0.3
  )
  RETURNING message_id INTO v_message_id;
  
  -- Mettre à jour last_accessed_at du projet
  UPDATE project_tracking
  SET last_accessed_at = NOW()
  WHERE project_id = v_project_id;
  
  RETURN v_message_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir les projets récemment utilisés
CREATE OR REPLACE FUNCTION get_recent_projects(
  p_limit INTEGER DEFAULT 10,
  p_user_id TEXT DEFAULT NULL
) RETURNS TABLE (
  project_id INTEGER,
  project_path TEXT,
  project_name TEXT,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  total_interactions BIGINT,
  last_interaction_type TEXT,
  last_interaction_time TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pt.project_id,
    pt.project_path,
    pt.project_name,
    pt.last_accessed_at,
    COUNT(pih.interaction_id) as total_interactions,
    (SELECT interaction_type FROM project_interaction_history 
     WHERE project_id = pt.project_id 
     ORDER BY created_at DESC LIMIT 1) as last_interaction_type,
    MAX(pih.created_at) as last_interaction_time
  FROM project_tracking pt
  LEFT JOIN project_interaction_history pih ON pt.project_id = pih.project_id
  WHERE pt.is_active = TRUE
    AND (p_user_id IS NULL OR pih.user_id = p_user_id)
  GROUP BY pt.project_id, pt.project_path, pt.project_name, pt.last_accessed_at
  ORDER BY pt.last_accessed_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour nettoyer le cache expiré
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM active_project_cache
  WHERE expires_at < NOW()
  RETURNING COUNT(*) INTO v_deleted_count;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Vue pour les statistiques de liaison message-projet
CREATE OR REPLACE VIEW message_project_stats AS
SELECT 
  pt.project_path,
  pt.project_name,
  COUNT(mpl.message_id) as total_messages,
  COUNT(CASE WHEN mpl.is_project_related THEN 1 END) as related_messages,
  AVG(mpl.relevance_score) as avg_relevance_score,
  MIN(mpl.created_at) as first_message,
  MAX(mpl.created_at) as last_message,
  COUNT(DISTINCT mpl.user_id) as unique_users,
  COUNT(DISTINCT mpl.session_id) as unique_sessions
FROM project_tracking pt
LEFT JOIN message_project_link mpl ON pt.project_id = mpl.project_id
GROUP BY pt.project_id, pt.project_path, pt.project_name;

-- Vue pour les statistiques d'interaction par projet
CREATE OR REPLACE VIEW project_interaction_stats AS
SELECT 
  pt.project_path,
  pt.project_name,
  COUNT(pih.interaction_id) as total_interactions,
  COUNT(DISTINCT pih.interaction_type) as unique_interaction_types,
  AVG(pih.duration_ms) as avg_duration_ms,
  SUM(CASE WHEN pih.success THEN 1 ELSE 0 END) as successful_interactions,
  SUM(CASE WHEN NOT pih.success THEN 1 ELSE 0 END) as failed_interactions,
  MIN(pih.created_at) as first_interaction,
  MAX(pih.created_at) as last_interaction
FROM project_tracking pt
LEFT JOIN project_interaction_history pih ON pt.project_id = pih.project_id
GROUP BY pt.project_id, pt.project_path, pt.project_name;

-- Fonction pour initialiser les données de suivi à partir de rag_store_v2
CREATE OR REPLACE FUNCTION initialize_project_tracking_from_rag()
RETURNS INTEGER AS $$
DECLARE
  v_project_count INTEGER;
BEGIN
  -- Insérer les projets existants depuis rag_store_v2
  INSERT INTO project_tracking (
    project_path,
    project_name,
    project_type,
    first_indexed_at,
    last_indexed_at,
    total_files_indexed,
    total_chunks_indexed,
    total_size_bytes,
    indexing_status,
    indexing_progress_percent
  )
  SELECT 
    DISTINCT project_path,
    SUBSTRING(project_path FROM '/([^/]+)/?$') as project_name,
    'workspace' as project_type,
    MIN(created_at) as first_indexed_at,
    MAX(updated_at) as last_indexed_at,
    COUNT(DISTINCT file_path) as total_files_indexed,
    COUNT(*) as total_chunks_indexed,
    SUM(LENGTH(content)) as total_size_bytes,
    'completed' as indexing_status,
    100 as indexing_progress_percent
  FROM rag_store_v2
  GROUP BY project_path
  ON CONFLICT (project_path) DO UPDATE SET
    last_indexed_at = EXCLUDED.last_indexed_at,
    total_files_indexed = EXCLUDED.total_files_indexed,
    total_chunks_indexed = EXCLUDED.total_chunks_indexed,
    total_size_bytes = EXCLUDED.total_size_bytes,
    updated_at = NOW();
  
  GET DIAGNOSTICS v_project_count = ROW_COUNT;
  
  RETURN v_project_count;
END;
$$ LANGUAGE plpgsql;

-- Exécuter l'initialisation
SELECT initialize_project_tracking_from_rag() as projects_initialized;

-- Afficher un résumé
SELECT 'Tables de suivi des projets créées avec succès' as message;
SELECT COUNT(*) as project_tracking_count FROM project_tracking;
SELECT COUNT(*) as message_project_link_count FROM message_project_link;
SELECT COUNT(*) as project_interaction_history_count FROM project_interaction_history;
SELECT COUNT(*) as active_project_cache_count FROM active_project_cache;
