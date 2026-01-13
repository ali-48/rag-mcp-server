-- SQL Schema Template for RAG Store v2
-- Version: 2.0.0
-- Generated: {{generated_at}}

-- ========== PROJECTS TABLE ==========
CREATE TABLE IF NOT EXISTS rag_projects_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL UNIQUE,
    project_path TEXT NOT NULL,
    project_name TEXT,
    initialized_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_indexed TIMESTAMP,
    config_hash TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    metadata JSON,
    
    -- Indexes
    INDEX idx_projects_project_id (project_id),
    INDEX idx_projects_project_path (project_path),
    INDEX idx_projects_status (status),
    INDEX idx_projects_initialized_at (initialized_at)
);

-- ========== CHUNKS TABLE ==========
CREATE TABLE IF NOT EXISTS rag_chunks_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    chunk_id TEXT NOT NULL UNIQUE,
    file_path TEXT NOT NULL,
    relative_path TEXT,
    content_hash TEXT NOT NULL,
    content TEXT NOT NULL,
    content_type TEXT NOT NULL, -- 'code', 'doc', 'config', 'other'
    language TEXT, -- 'typescript', 'javascript', 'python', etc.
    role TEXT, -- 'core', 'example', 'template', 'test'
    tags JSON, -- Array of tags
    metadata JSON NOT NULL,
    
    -- Chunking metadata
    chunk_index INTEGER NOT NULL,
    total_chunks INTEGER NOT NULL,
    chunk_size INTEGER NOT NULL,
    atomicity_score REAL,
    coherence_score REAL,
    
    -- File metadata
    file_size INTEGER,
    file_modified TIMESTAMP,
    file_created TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key
    FOREIGN KEY (project_id) REFERENCES rag_projects_v2(project_id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_chunks_project_id (project_id),
    INDEX idx_chunks_file_path (file_path),
    INDEX idx_chunks_content_type (content_type),
    INDEX idx_chunks_language (language),
    INDEX idx_chunks_content_hash (content_hash),
    INDEX idx_chunks_created_at (created_at),
    UNIQUE (project_id, file_path, chunk_index)
);

-- ========== EMBEDDINGS TABLE ==========
CREATE TABLE IF NOT EXISTS rag_embeddings_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chunk_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    embedding BLOB NOT NULL, -- Vector embedding as binary
    dimensions INTEGER NOT NULL,
    generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata
    model_version TEXT,
    provider TEXT, -- 'ollama', 'sentence-transformers', 'openai'
    
    -- Foreign keys
    FOREIGN KEY (chunk_id) REFERENCES rag_chunks_v2(chunk_id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES rag_projects_v2(project_id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_embeddings_chunk_id (chunk_id),
    INDEX idx_embeddings_project_id (project_id),
    INDEX idx_embeddings_model_name (model_name),
    INDEX idx_embeddings_generated_at (generated_at),
    UNIQUE (chunk_id, model_name)
);

-- ========== METADATA TABLE ==========
CREATE TABLE IF NOT EXISTS rag_metadata_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    value_type TEXT NOT NULL, -- 'string', 'number', 'boolean', 'json', 'array'
    category TEXT, -- 'project', 'file', 'chunk', 'system'
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key
    FOREIGN KEY (project_id) REFERENCES rag_projects_v2(project_id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_metadata_project_id (project_id),
    INDEX idx_metadata_key (key),
    INDEX idx_metadata_category (category),
    INDEX idx_metadata_created_at (created_at),
    UNIQUE (project_id, key)
);

-- ========== INDEXES TABLE ==========
CREATE TABLE IF NOT EXISTS rag_indexes_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    index_type TEXT NOT NULL, -- 'fulltext', 'vector', 'composite'
    index_name TEXT NOT NULL,
    table_name TEXT NOT NULL,
    column_names TEXT NOT NULL, -- JSON array
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP,
    usage_count INTEGER DEFAULT 0,
    
    -- Foreign key
    FOREIGN KEY (project_id) REFERENCES rag_projects_v2(project_id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_indexes_project_id (project_id),
    INDEX idx_indexes_index_type (index_type),
    INDEX idx_indexes_table_name (table_name),
    UNIQUE (project_id, index_name)
);

-- ========== STATISTICS TABLE ==========
CREATE TABLE IF NOT EXISTS rag_statistics_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metric_unit TEXT,
    category TEXT NOT NULL, -- 'performance', 'quality', 'storage', 'usage'
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    period TEXT, -- 'instant', 'daily', 'weekly', 'monthly'
    
    -- Foreign key
    FOREIGN KEY (project_id) REFERENCES rag_projects_v2(project_id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_statistics_project_id (project_id),
    INDEX idx_statistics_metric_name (metric_name),
    INDEX idx_statistics_category (category),
    INDEX idx_statistics_recorded_at (recorded_at)
);

-- ========== TRIGGERS ==========

-- Update updated_at timestamp for chunks
CREATE TRIGGER IF NOT EXISTS update_chunks_timestamp 
AFTER UPDATE ON rag_chunks_v2
BEGIN
    UPDATE rag_chunks_v2 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

-- Update updated_at timestamp for metadata
CREATE TRIGGER IF NOT EXISTS update_metadata_timestamp 
AFTER UPDATE ON rag_metadata_v2
BEGIN
    UPDATE rag_metadata_v2 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

-- ========== VIEWS ==========

-- Project summary view
CREATE VIEW IF NOT EXISTS v_project_summary AS
SELECT 
    p.project_id,
    p.project_path,
    p.project_name,
    p.initialized_at,
    p.last_indexed,
    p.status,
    COUNT(DISTINCT c.file_path) as total_files,
    COUNT(c.id) as total_chunks,
    COUNT(DISTINCT e.model_name) as embedding_models,
    MAX(c.updated_at) as last_chunk_update
FROM rag_projects_v2 p
LEFT JOIN rag_chunks_v2 c ON p.project_id = c.project_id
LEFT JOIN rag_embeddings_v2 e ON c.chunk_id = e.chunk_id
GROUP BY p.project_id;

-- Chunk statistics view
CREATE VIEW IF NOT EXISTS v_chunk_statistics AS
SELECT 
    project_id,
    content_type,
    language,
    COUNT(*) as chunk_count,
    AVG(chunk_size) as avg_chunk_size,
    MIN(chunk_size) as min_chunk_size,
    MAX(chunk_size) as max_chunk_size,
    AVG(atomicity_score) as avg_atomicity,
    AVG(coherence_score) as avg_coherence
FROM rag_chunks_v2
GROUP BY project_id, content_type, language;

-- ========== COMMENTS ==========
COMMENT ON TABLE rag_projects_v2 IS 'Stores RAG project metadata and configuration';
COMMENT ON TABLE rag_chunks_v2 IS 'Stores content chunks with metadata and quality scores';
COMMENT ON TABLE rag_embeddings_v2 IS 'Stores vector embeddings for chunks';
COMMENT ON TABLE rag_metadata_v2 IS 'Stores additional metadata for projects and chunks';
COMMENT ON TABLE rag_indexes_v2 IS 'Tracks database indexes for optimization';
COMMENT ON TABLE rag_statistics_v2 IS 'Stores performance and quality metrics';

-- ========== END OF SCHEMA ==========
