-- Script de création de la table rag_store_v2 pour le pipeline RAG avancé
-- Version: 2.0.0
-- Date: 28/12/2025
-- Auteur: Cline AI Assistant

-- Supprimer la table si elle existe déjà (pour le développement)
DROP TABLE IF EXISTS rag_store_v2 CASCADE;

-- Créer la table principale avec colonnes étendues
CREATE TABLE rag_store_v2 (
  -- Identifiant unique : projet:fichier#chunkIndex
  id TEXT PRIMARY KEY,
  
  -- Informations sur le projet et le fichier
  project_path TEXT NOT NULL,
  file_path TEXT NOT NULL,
  
  -- Gestion des chunks
  chunk_index INTEGER NOT NULL DEFAULT 0,
  total_chunks INTEGER NOT NULL DEFAULT 1,
  
  -- Contenu et typage
  content TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('code', 'doc', 'config', 'other')),
  role TEXT CHECK (role IN ('core', 'helper', 'test', 'example', 'template', 'other')),
  
  -- Métadonnées enrichies
  file_extension TEXT,
  file_size_bytes INTEGER,
  lines_count INTEGER,
  language TEXT,
  
  -- Embedding vector (dimension 4096 pour Qwen3-Embedding)
  vector VECTOR(4096) NOT NULL,
  
  -- Métadonnées de compression pour contenus volumineux
  is_compressed BOOLEAN DEFAULT FALSE,
  original_size_bytes INTEGER,
  
  -- Gestion de version
  version INTEGER DEFAULT 1,
  parent_id TEXT REFERENCES rag_store_v2(id),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Index pour performances
  CONSTRAINT valid_chunk_index CHECK (chunk_index >= 0),
  CONSTRAINT valid_total_chunks CHECK (total_chunks >= 1 AND chunk_index < total_chunks)
);

-- Index pour performances de recherche
CREATE INDEX idx_rag_store_v2_project_path ON rag_store_v2(project_path);
CREATE INDEX idx_rag_store_v2_content_type ON rag_store_v2(content_type);
CREATE INDEX idx_rag_store_v2_role ON rag_store_v2(role);
CREATE INDEX idx_rag_store_v2_file_extension ON rag_store_v2(file_extension);
CREATE INDEX idx_rag_store_v2_created_at ON rag_store_v2(created_at);
CREATE INDEX idx_rag_store_v2_updated_at ON rag_store_v2(updated_at);

-- Index pour recherche vectorielle (pgvector)
CREATE INDEX idx_rag_store_v2_vector ON rag_store_v2 USING ivfflat (vector vector_cosine_ops)
WITH (lists = 100);

-- Index composite pour recherches fréquentes
CREATE INDEX idx_rag_store_v2_project_content_type ON rag_store_v2(project_path, content_type);
CREATE INDEX idx_rag_store_v2_project_file ON rag_store_v2(project_path, file_path);

-- Index optimisés pour recherche par type
CREATE INDEX idx_rag_store_v2_content_type_role ON rag_store_v2(content_type, role);
CREATE INDEX idx_rag_store_v2_language ON rag_store_v2(language) WHERE language IS NOT NULL;
CREATE INDEX idx_rag_store_v2_file_extension_language ON rag_store_v2(file_extension, language) 
  WHERE file_extension IS NOT NULL AND language IS NOT NULL;

-- Index partiels pour types spécifiques (améliore les performances pour les requêtes filtrées)
CREATE INDEX idx_rag_store_v2_code_type ON rag_store_v2(id, project_path, file_path, content_type)
  WHERE content_type = 'code';
CREATE INDEX idx_rag_store_v2_doc_type ON rag_store_v2(id, project_path, file_path, content_type)
  WHERE content_type = 'doc';
CREATE INDEX idx_rag_store_v2_config_type ON rag_store_v2(id, project_path, file_path, content_type)
  WHERE content_type = 'config';

-- Index pour recherches temporelles par type
CREATE INDEX idx_rag_store_v2_content_type_updated ON rag_store_v2(content_type, updated_at);
CREATE INDEX idx_rag_store_v2_project_content_type_updated ON rag_store_v2(project_path, content_type, updated_at);

-- Vue pour statistiques
CREATE OR REPLACE VIEW rag_store_v2_stats AS
SELECT 
  project_path,
  content_type,
  role,
  COUNT(*) as total_chunks,
  COUNT(DISTINCT file_path) as total_files,
  AVG(LENGTH(content)) as avg_content_length,
  MIN(created_at) as first_indexed,
  MAX(updated_at) as last_updated,
  SUM(CASE WHEN is_compressed THEN 1 ELSE 0 END) as compressed_chunks
FROM rag_store_v2
GROUP BY project_path, content_type, role;

-- Vue pour monitoring de couverture
CREATE OR REPLACE VIEW rag_store_v2_coverage AS
SELECT 
  project_path,
  COUNT(DISTINCT file_path) as indexed_files,
  SUM(total_chunks) as total_chunks,
  MAX(updated_at) as last_indexed,
  -- Pourcentage estimé de couverture (à calculer avec script externe)
  0 as estimated_coverage_percent
FROM rag_store_v2
GROUP BY project_path;

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour updated_at
CREATE TRIGGER update_rag_store_v2_updated_at
  BEFORE UPDATE ON rag_store_v2
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Fonction pour calculer la similarité avec filtres
CREATE OR REPLACE FUNCTION search_rag_store_v2(
  query_vector VECTOR(4096),
  p_project_path TEXT DEFAULT NULL,
  p_content_type TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10,
  p_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id TEXT,
  project_path TEXT,
  file_path TEXT,
  chunk_index INTEGER,
  content TEXT,
  content_type TEXT,
  role TEXT,
  similarity FLOAT,
  file_extension TEXT,
  lines_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rs.id,
    rs.project_path,
    rs.file_path,
    rs.chunk_index,
    rs.content,
    rs.content_type,
    rs.role,
    1 - (rs.vector <=> query_vector) as similarity,
    rs.file_extension,
    rs.lines_count
  FROM rag_store_v2 rs
  WHERE 
    (1 - (rs.vector <=> query_vector)) >= p_threshold
    AND (p_project_path IS NULL OR rs.project_path = p_project_path)
    AND (p_content_type IS NULL OR rs.content_type = p_content_type)
    AND (p_role IS NULL OR rs.role = p_role)
  ORDER BY similarity DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Table pour l'historique des modifications (versionnement)
CREATE TABLE IF NOT EXISTS rag_store_v2_history (
  id SERIAL PRIMARY KEY,
  chunk_id TEXT NOT NULL REFERENCES rag_store_v2(id),
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  vector VECTOR(4096) NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  change_type TEXT CHECK (change_type IN ('created', 'updated', 'deleted')),
  change_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index pour l'historique
CREATE INDEX idx_rag_store_v2_history_chunk_id ON rag_store_v2_history(chunk_id);
CREATE INDEX idx_rag_store_v2_history_version ON rag_store_v2_history(version);
CREATE INDEX idx_rag_store_v2_history_changed_at ON rag_store_v2_history(changed_at);
CREATE INDEX idx_rag_store_v2_history_change_type ON rag_store_v2_history(change_type);

-- Fonction pour calculer la différence entre deux versions
CREATE OR REPLACE FUNCTION calculate_content_diff(
  old_content TEXT,
  new_content TEXT
) RETURNS JSONB AS $$
DECLARE
  diff JSONB;
BEGIN
  -- Calcul simple: longueur, nombre de lignes, pourcentage de changement
  diff = jsonb_build_object(
    'old_length', LENGTH(old_content),
    'new_length', LENGTH(new_content),
    'length_change', LENGTH(new_content) - LENGTH(old_content),
    'old_lines', (LENGTH(old_content) - LENGTH(REPLACE(old_content, E'\n', '')) + 1),
    'new_lines', (LENGTH(new_content) - LENGTH(REPLACE(new_content, E'\n', '')) + 1),
    'lines_change', (LENGTH(new_content) - LENGTH(REPLACE(new_content, E'\n', '')) + 1) - 
                    (LENGTH(old_content) - LENGTH(REPLACE(old_content, E'\n', '')) + 1),
    'change_percentage', CASE 
      WHEN LENGTH(old_content) = 0 THEN 100.0
      ELSE ABS(LENGTH(new_content) - LENGTH(old_content)) * 100.0 / LENGTH(old_content)
    END,
    'has_significant_change', CASE
      WHEN ABS(LENGTH(new_content) - LENGTH(old_content)) > LENGTH(old_content) * 0.1 THEN true
      ELSE false
    END
  );
  
  RETURN diff;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour enregistrer une version dans l'historique
CREATE OR REPLACE FUNCTION record_version_history()
RETURNS TRIGGER AS $$
DECLARE
  current_version INTEGER;
  change_type_text TEXT;
  change_reason_text TEXT;
  diff_metadata JSONB;
BEGIN
  -- Déterminer le type de changement
  IF TG_OP = 'INSERT' THEN
    change_type_text := 'created';
    change_reason_text := 'Initial creation';
    current_version := 1;
    diff_metadata := '{}'::jsonb;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Vérifier si le contenu a réellement changé
    IF OLD.content IS DISTINCT FROM NEW.content OR OLD.vector IS DISTINCT FROM NEW.vector THEN
      change_type_text := 'updated';
      change_reason_text := 'Content or embedding updated';
      
      -- Récupérer la version actuelle
      SELECT COALESCE(MAX(version), 0) + 1 INTO current_version
      FROM rag_store_v2_history
      WHERE chunk_id = NEW.id;
      
      -- Calculer la différence
      diff_metadata := calculate_content_diff(OLD.content, NEW.content);
    ELSE
      -- Pas de changement significatif, ne pas enregistrer de version
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    change_type_text := 'deleted';
    change_reason_text := 'Record deleted';
    
    -- Pour DELETE, on utilise la dernière version + 1
    SELECT COALESCE(MAX(version), 0) + 1 INTO current_version
    FROM rag_store_v2_history
    WHERE chunk_id = OLD.id;
    
    diff_metadata := jsonb_build_object(
      'deleted_at', NOW(),
      'final_content_length', LENGTH(OLD.content)
    );
    
    -- Pour DELETE, on insère dans l'historique avant la suppression
    INSERT INTO rag_store_v2_history (
      chunk_id, version, content, vector, changed_at, 
      change_type, change_reason, metadata
    ) VALUES (
      OLD.id, current_version, OLD.content, OLD.vector, NOW(),
      change_type_text, change_reason_text, diff_metadata
    );
    
    RETURN OLD;
  END IF;
  
  -- Pour INSERT et UPDATE, enregistrer la nouvelle version
  INSERT INTO rag_store_v2_history (
    chunk_id, version, content, vector, changed_at, 
    change_type, change_reason, metadata
  ) VALUES (
    NEW.id, current_version, NEW.content, NEW.vector, NOW(),
    change_type_text, change_reason_text, diff_metadata
  );
  
  -- Mettre à jour le numéro de version dans la table principale
  NEW.version := current_version;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour le versionnement automatique
CREATE TRIGGER rag_store_v2_versioning_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON rag_store_v2
  FOR EACH ROW
  EXECUTE FUNCTION record_version_history();

-- Fonction pour récupérer l'historique d'un chunk
CREATE OR REPLACE FUNCTION get_chunk_history(
  p_chunk_id TEXT,
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  history_id INTEGER,
  version INTEGER,
  content TEXT,
  changed_at TIMESTAMP WITH TIME ZONE,
  change_type TEXT,
  change_reason TEXT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.id as history_id,
    h.version,
    h.content,
    h.changed_at,
    h.change_type,
    h.change_reason,
    h.metadata
  FROM rag_store_v2_history h
  WHERE h.chunk_id = p_chunk_id
  ORDER BY h.version DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour comparer deux versions d'un chunk
CREATE OR REPLACE FUNCTION compare_chunk_versions(
  p_chunk_id TEXT,
  p_version1 INTEGER,
  p_version2 INTEGER
) RETURNS TABLE (
  field_name TEXT,
  version1_value TEXT,
  version2_value TEXT,
  has_changed BOOLEAN
) AS $$
DECLARE
  v1 RECORD;
  v2 RECORD;
BEGIN
  -- Récupérer les deux versions
  SELECT * INTO v1 FROM rag_store_v2_history 
  WHERE chunk_id = p_chunk_id AND version = p_version1;
  
  SELECT * INTO v2 FROM rag_store_v2_history 
  WHERE chunk_id = p_chunk_id AND version = p_version2;
  
  -- Retourner la comparaison
  RETURN QUERY
  SELECT 
    'content' as field_name,
    LEFT(v1.content, 100) as version1_value,
    LEFT(v2.content, 100) as version2_value,
    v1.content IS DISTINCT FROM v2.content as has_changed
  UNION ALL
  SELECT 
    'content_length' as field_name,
    LENGTH(v1.content)::TEXT as version1_value,
    LENGTH(v2.content)::TEXT as version2_value,
    LENGTH(v1.content) != LENGTH(v2.content) as has_changed
  UNION ALL
  SELECT 
    'change_type' as field_name,
    v1.change_type as version1_value,
    v2.change_type as version2_value,
    v1.change_type != v2.change_type as has_changed
  UNION ALL
  SELECT 
    'changed_at' as field_name,
    v1.changed_at::TEXT as version1_value,
    v2.changed_at::TEXT as version2_value,
    v1.changed_at != v2.changed_at as has_changed;
END;
$$ LANGUAGE plpgsql;

-- Vue pour les statistiques de versionnement
CREATE OR REPLACE VIEW rag_store_v2_version_stats AS
SELECT 
  chunk_id,
  COUNT(*) as total_versions,
  MIN(changed_at) as first_version,
  MAX(changed_at) as last_version,
  SUM(CASE WHEN change_type = 'created' THEN 1 ELSE 0 END) as created_count,
  SUM(CASE WHEN change_type = 'updated' THEN 1 ELSE 0 END) as updated_count,
  SUM(CASE WHEN change_type = 'deleted' THEN 1 ELSE 0 END) as deleted_count,
  AVG((metadata->>'change_percentage')::FLOAT) as avg_change_percentage
FROM rag_store_v2_history
GROUP BY chunk_id;

-- Vues matérialisées pour les statistiques (amélioration des performances)
-- Ces vues stockent physiquement les résultats et peuvent être rafraîchies périodiquement

-- Vue matérialisée pour les statistiques par projet et type de contenu
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_rag_store_v2_project_stats AS
SELECT 
  project_path,
  content_type,
  COUNT(*) as total_chunks,
  COUNT(DISTINCT file_path) as total_files,
  AVG(LENGTH(content)) as avg_content_length,
  AVG(file_size_bytes) as avg_file_size_bytes,
  SUM(CASE WHEN is_compressed THEN 1 ELSE 0 END) as compressed_chunks,
  AVG(CASE WHEN is_compressed THEN (original_size_bytes - file_size_bytes) * 100.0 / original_size_bytes ELSE 0 END) as avg_compression_ratio,
  MIN(created_at) as first_indexed,
  MAX(updated_at) as last_updated,
  COUNT(DISTINCT language) as distinct_languages,
  COUNT(DISTINCT file_extension) as distinct_file_extensions
FROM rag_store_v2
GROUP BY project_path, content_type
WITH DATA;

-- Index pour la vue matérialisée
CREATE UNIQUE INDEX idx_mv_project_stats_key ON mv_rag_store_v2_project_stats(project_path, content_type);
CREATE INDEX idx_mv_project_stats_total_chunks ON mv_rag_store_v2_project_stats(total_chunks DESC);
CREATE INDEX idx_mv_project_stats_last_updated ON mv_rag_store_v2_project_stats(last_updated DESC);

-- Vue matérialisée pour la distribution de taille des chunks
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_rag_store_v2_size_distribution AS
SELECT 
  content_type,
  CASE 
    WHEN file_size_bytes < 1024 THEN '0-1KB'
    WHEN file_size_bytes < 10240 THEN '1-10KB'
    WHEN file_size_bytes < 102400 THEN '10-100KB'
    WHEN file_size_bytes < 1048576 THEN '100KB-1MB'
    ELSE '1MB+'
  END as size_bucket,
  COUNT(*) as chunk_count,
  AVG(file_size_bytes) as avg_size_bytes,
  MIN(file_size_bytes) as min_size_bytes,
  MAX(file_size_bytes) as max_size_bytes,
  SUM(file_size_bytes) as total_size_bytes
FROM rag_store_v2
GROUP BY content_type, 
  CASE 
    WHEN file_size_bytes < 1024 THEN '0-1KB'
    WHEN file_size_bytes < 10240 THEN '1-10KB'
    WHEN file_size_bytes < 102400 THEN '10-100KB'
    WHEN file_size_bytes < 1048576 THEN '100KB-1MB'
    ELSE '1MB+'
  END
WITH DATA;

-- Index pour la vue matérialisée de distribution
CREATE UNIQUE INDEX idx_mv_size_distribution_key ON mv_rag_store_v2_size_distribution(content_type, size_bucket);

-- Vue matérialisée pour la couverture temporelle
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_rag_store_v2_temporal_coverage AS
SELECT 
  project_path,
  DATE(created_at) as index_date,
  COUNT(*) as chunks_indexed,
  COUNT(DISTINCT file_path) as files_indexed,
  AVG(LENGTH(content)) as avg_chunk_size,
  SUM(CASE WHEN is_compressed THEN 1 ELSE 0 END) as compressed_chunks
FROM rag_store_v2
GROUP BY project_path, DATE(created_at)
WITH DATA;

-- Index pour la vue matérialisée temporelle
CREATE UNIQUE INDEX idx_mv_temporal_coverage_key ON mv_rag_store_v2_temporal_coverage(project_path, index_date);
CREATE INDEX idx_mv_temporal_coverage_date ON mv_rag_store_v2_temporal_coverage(index_date DESC);

-- Vue matérialisée pour les statistiques de compression
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_rag_store_v2_compression_stats AS
SELECT 
  project_path,
  content_type,
  is_compressed,
  COUNT(*) as chunk_count,
  AVG(file_size_bytes) as avg_compressed_size,
  AVG(original_size_bytes) as avg_original_size,
  AVG((original_size_bytes - file_size_bytes) * 100.0 / original_size_bytes) as avg_compression_ratio,
  SUM(file_size_bytes) as total_compressed_size,
  SUM(original_size_bytes) as total_original_size,
  (SUM(original_size_bytes) - SUM(file_size_bytes)) as total_space_saved
FROM rag_store_v2
WHERE is_compressed = true
GROUP BY project_path, content_type, is_compressed
WITH DATA;

-- Index pour la vue matérialisée de compression
CREATE UNIQUE INDEX idx_mv_compression_stats_key ON mv_rag_store_v2_compression_stats(project_path, content_type, is_compressed);

-- Fonction pour rafraîchir toutes les vues matérialisées
CREATE OR REPLACE FUNCTION refresh_rag_store_v2_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rag_store_v2_project_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rag_store_v2_size_distribution;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rag_store_v2_temporal_coverage;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rag_store_v2_compression_stats;
  
  RAISE NOTICE 'All materialized views refreshed successfully';
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir les statistiques de performance
CREATE OR REPLACE FUNCTION get_rag_store_v2_performance_stats()
RETURNS TABLE (
  total_chunks BIGINT,
  total_files BIGINT,
  total_projects BIGINT,
  avg_chunk_size_bytes NUMERIC,
  total_compressed_chunks BIGINT,
  total_space_saved_bytes BIGINT,
  compression_ratio_percent NUMERIC,
  last_refresh_time TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM rag_store_v2) as total_chunks,
    (SELECT COUNT(DISTINCT file_path) FROM rag_store_v2) as total_files,
    (SELECT COUNT(DISTINCT project_path) FROM rag_store_v2) as total_projects,
    (SELECT AVG(file_size_bytes) FROM rag_store_v2) as avg_chunk_size_bytes,
    (SELECT COUNT(*) FROM rag_store_v2 WHERE is_compressed = true) as total_compressed_chunks,
    (SELECT SUM(original_size_bytes - file_size_bytes) FROM rag_store_v2 WHERE is_compressed = true) as total_space_saved_bytes,
    (SELECT AVG((original_size_bytes - file_size_bytes) * 100.0 / original_size_bytes) FROM rag_store_v2 WHERE is_compressed = true) as compression_ratio_percent,
    NOW() as last_refresh_time;
END;
$$ LANGUAGE plpgsql;

-- Script de migration depuis rag_store (ancienne version)
-- À exécuter après création de rag_store_v2
DO $$ 
BEGIN
  -- Vérifier si l'ancienne table existe
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'rag_store') THEN
    -- Insérer les données avec valeurs par défaut
    INSERT INTO rag_store_v2 (
      id, project_path, file_path, content, vector, created_at, updated_at,
      chunk_index, total_chunks, content_type, role, file_extension,
      file_size_bytes, lines_count, is_compressed, original_size_bytes
    )
    SELECT 
      id, project_path, file_path, content, vector, created_at, updated_at,
      0 as chunk_index, -- Par défaut, pas de chunking
      1 as total_chunks,
      CASE 
        WHEN file_path LIKE '%.md' OR file_path LIKE '%.txt' THEN 'doc'
        WHEN file_path LIKE '%.js' OR file_path LIKE '%.ts' OR file_path LIKE '%.py' THEN 'code'
        WHEN file_path LIKE '%.json' OR file_path LIKE '%.yaml' OR file_path LIKE '%.yml' THEN 'config'
        ELSE 'other'
      END as content_type,
      NULL as role, -- À déterminer plus tard
      -- Extraire l'extension du fichier
      SUBSTRING(file_path FROM '\.([^\.]+)$') as file_extension,
      LENGTH(content) as file_size_bytes,
      (LENGTH(content) - LENGTH(REPLACE(content, E'\n', '')) + 1) as lines_count,
      FALSE as is_compressed,
      LENGTH(content) as original_size_bytes
    FROM rag_store;
    
    RAISE NOTICE 'Migration terminée: % lignes migrées de rag_store vers rag_store_v2', (SELECT COUNT(*) FROM rag_store);
  ELSE
    RAISE NOTICE 'Table rag_store non trouvée, pas de migration nécessaire';
  END IF;
END $$;

-- Message de confirmation
COMMENT ON TABLE rag_store_v2 IS 'Table principale pour le stockage RAG avancé avec typage de contenu et métadonnées enrichies';
COMMENT ON COLUMN rag_store_v2.content_type IS 'Type de contenu: code, doc, config, other';
COMMENT ON COLUMN rag_store_v2.role IS 'Rôle du chunk: core, helper, test, example, template, other';

-- Afficher un résumé
SELECT 'Table rag_store_v2 créée avec succès' as message;
SELECT COUNT(*) as tables_created FROM information_schema.tables WHERE table_name LIKE 'rag_store_v2%';
