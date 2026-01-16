#!/bin/bash
# RAG MCP Server - Database Initialization Script
# Generated: 2026-01-16
# This script initializes SQLite and PostgreSQL databases for RAG MCP Server

set -e

echo "========================================="
echo "RAG MCP Server - Database Initialization"
echo "========================================="

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAG_DB_DIR="$PROJECT_ROOT/rag/db"
SQLITE_DB_DIR="$RAG_DB_DIR/sqlite"
MEMORY_DB_DIR="$RAG_DB_DIR/memory"
VECTOR_DB_DIR="$RAG_DB_DIR/vector"

echo "Project root: $PROJECT_ROOT"
echo ""

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p "$SQLITE_DB_DIR"
mkdir -p "$MEMORY_DB_DIR"
mkdir -p "$VECTOR_DB_DIR"
mkdir -p "$PROJECT_ROOT/logs"

echo "✅ Directories created:"
echo "   - $SQLITE_DB_DIR"
echo "   - $MEMORY_DB_DIR"
echo "   - $VECTOR_DB_DIR"
echo "   - $PROJECT_ROOT/logs"

# Initialize SQLite databases
echo ""
echo "🗄️  Initializing SQLite databases..."

# 1. RAG Memory SQLite
RAG_MEMORY_DB="$MEMORY_DB_DIR/rag_memory.sqlite"
if [ -f "$RAG_MEMORY_DB" ]; then
    echo "   ✅ RAG Memory SQLite already exists: $RAG_MEMORY_DB"
else
    echo "   Creating RAG Memory SQLite..."
    sqlite3 "$RAG_MEMORY_DB" "VACUUM;"
    echo "   ✅ Created: $RAG_MEMORY_DB"
fi

# 2. RAG Vectors SQLite
RAG_VECTORS_DB="$VECTOR_DB_DIR/rag_vectors.sqlite"
if [ -f "$RAG_VECTORS_DB" ]; then
    echo "   ✅ RAG Vectors SQLite already exists: $RAG_VECTORS_DB"
else
    echo "   Creating RAG Vectors SQLite..."
    sqlite3 "$RAG_VECTORS_DB" "VACUUM;"
    echo "   ✅ Created: $RAG_VECTORS_DB"
fi

# 3. Test Database (copy from project root)
TEST_DB_SOURCE="$PROJECT_ROOT/test.db"
TEST_DB_DEST="$SQLITE_DB_DIR/test.db"
if [ -f "$TEST_DB_SOURCE" ]; then
    if [ ! -f "$TEST_DB_DEST" ]; then
        echo "   Copying test database..."
        cp "$TEST_DB_SOURCE" "$TEST_DB_DEST"
        echo "   ✅ Copied test database to: $TEST_DB_DEST"
    else
        echo "   ✅ Test database already exists: $TEST_DB_DEST"
    fi
else
    echo "   ⚠️  Test database not found at: $TEST_DB_SOURCE"
    echo "   Creating empty test database..."
    sqlite3 "$TEST_DB_DEST" "VACUUM;"
    echo "   ✅ Created empty test database: $TEST_DB_DEST"
fi

# Create SQL schema for RAG databases
echo ""
echo "📋 Creating RAG database schemas..."

# Schema for RAG Memory
cat > "$MEMORY_DB_DIR/rag_memory_schema.sql" << 'EOF'
-- RAG Memory SQLite Schema
-- Stores conversation history, context, and memory chunks

CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    tokens INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memory_chunks (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    chunk_text TEXT NOT NULL,
    embedding BLOB,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_memory_chunks_conversation ON memory_chunks(conversation_id);

-- Triggers for updated_at
CREATE TRIGGER IF NOT EXISTS update_conversations_timestamp
AFTER UPDATE ON conversations
BEGIN
    UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
EOF

# Schema for RAG Vectors
cat > "$VECTOR_DB_DIR/rag_vectors_schema.sql" << 'EOF'
-- RAG Vectors SQLite Schema
-- Stores vector embeddings and semantic search index

CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    content_type TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    tokens INTEGER NOT NULL,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(file_path, chunk_index)
);

CREATE TABLE IF NOT EXISTS embeddings (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    embedding BLOB NOT NULL,
    dimension INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS search_index (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    search_text TEXT NOT NULL,
    tags JSON,
    relevance_score REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_documents_file_path ON documents(file_path);
CREATE INDEX IF NOT EXISTS idx_documents_content_type ON documents(content_type);
CREATE INDEX IF NOT EXISTS idx_embeddings_document ON embeddings(document_id);
CREATE INDEX IF NOT EXISTS idx_search_index_document ON search_index(document_id);
CREATE INDEX IF NOT EXISTS idx_search_index_tags ON search_index(tags);

-- Vector similarity search (requires sqlite-vec extension)
CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(
    embedding FLOAT[1536]
);

-- Triggers for updated_at
CREATE TRIGGER IF NOT EXISTS update_documents_timestamp
AFTER UPDATE ON documents
BEGIN
    UPDATE documents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
EOF

echo "✅ Database schemas created:"
echo "   - $MEMORY_DB_DIR/rag_memory_schema.sql"
echo "   - $VECTOR_DB_DIR/rag_vectors_schema.sql"

# PostgreSQL configuration (optional)
echo ""
echo "🐘 PostgreSQL Configuration (Optional)"
echo "======================================"

POSTGRES_CONFIG="$PROJECT_ROOT/config/postgres-config.json"
if [ ! -f "$POSTGRES_CONFIG" ]; then
    cat > "$POSTGRES_CONFIG" << 'EOF'
{
  "host": "localhost",
  "port": 5432,
  "database": "rag_db",
  "username": "rag_user",
  "password": "rag_password",
  "ssl": false,
  "max": 20,
  "idleTimeoutMillis": 30000,
  "connectionTimeoutMillis": 2000
}
EOF
    echo "✅ PostgreSQL configuration created: $POSTGRES_CONFIG"
    echo "   ⚠️  Please update with your actual PostgreSQL credentials"
else
    echo "✅ PostgreSQL configuration already exists: $POSTGRES_CONFIG"
fi

# Create database initialization script for PostgreSQL
cat > "$PROJECT_ROOT/scripts/init-postgres.sql" << 'EOF'
-- PostgreSQL Initialization for RAG MCP Server
-- Run: psql -U postgres -f init-postgres.sql

-- Create database
CREATE DATABASE rag_db;

-- Connect to database
\c rag_db;

-- Create user
CREATE USER rag_user WITH PASSWORD 'rag_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE rag_db TO rag_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO rag_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO rag_user;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Create tables
CREATE TABLE IF NOT EXISTS rag_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_path TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    content_type TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    tokens INTEGER NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(file_path, chunk_index)
);

CREATE TABLE IF NOT EXISTS rag_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
    model_name TEXT NOT NULL,
    embedding vector(1536) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rag_search_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
    search_text TEXT NOT NULL,
    tags JSONB,
    relevance_score REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_rag_documents_file_path ON rag_documents(file_path);
CREATE INDEX idx_rag_documents_content_type ON rag_documents(content_type);
CREATE INDEX idx_rag_embeddings_document ON rag_embeddings(document_id);
CREATE INDEX idx_rag_search_index_document ON rag_search_index(document_id);
CREATE INDEX idx_rag_search_index_tags ON rag_search_index USING gin(tags);
CREATE INDEX idx_rag_search_index_search_text ON rag_search_index USING gin(search_text gin_trgm_ops);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to rag_documents
CREATE TRIGGER update_rag_documents_updated_at
    BEFORE UPDATE ON rag_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions to user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO rag_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO rag_user;

-- Sample data (optional)
INSERT INTO rag_documents (file_path, file_hash, content_type, chunk_index, chunk_text, tokens, metadata)
VALUES
    ('README.md', 'abc123', 'markdown', 0, '# RAG MCP Server\nA Retrieval-Augmented Generation MCP Server for VS Code.', 12, '{"role": "documentation", "language": "en"}'),
    ('src/index.ts', 'def456', 'typescript', 0, 'export class RAGServer {', 4, '{"role": "code", "language": "typescript"}')
ON CONFLICT DO NOTHING;

-- Create search function
CREATE OR REPLACE FUNCTION semantic_search(
    query_embedding vector(1536),
    similarity_threshold float DEFAULT 0.3,
    match_count int DEFAULT 10
)
RETURNS TABLE(
    document_id UUID,
    file_path TEXT,
    chunk_text TEXT,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.file_path,
        d.chunk_text,
        1 - (e.embedding <=> query_embedding) as similarity
    FROM rag_embeddings e
    JOIN rag_documents d ON e.document_id = d.id
    WHERE 1 - (e.embedding <=> query_embedding) > similarity_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION semantic_search TO rag_user;

EOF

echo "✅ PostgreSQL initialization script created: $PROJECT_ROOT/scripts/init-postgres.sql"

# Final summary
echo ""
echo "========================================="
echo "✅ DATABASE INITIALIZATION COMPLETE"
echo "========================================="
echo ""
echo "Summary:"
echo "1. SQLite databases initialized in:"
echo "   - $RAG_MEMORY_DB"
echo "   - $RAG_VECTORS_DB"
echo "   - $TEST_DB_DEST"
echo ""
echo "2. Database schemas created:"
echo "   - RAG Memory Schema: $MEMORY_DB_DIR/rag_memory_schema.sql"
echo "   - RAG Vectors Schema: $VECTOR_DB_DIR/rag_vectors_schema.sql"
echo ""
echo "3. PostgreSQL configuration:"
echo "   - Config: $POSTGRES_CONFIG"
echo "   - Init script: $PROJECT_ROOT/scripts/init-postgres.sql"
echo ""
echo "Next steps:"
echo "1. Apply SQLite schemas:"
echo "   sqlite3 $RAG_MEMORY_DB < $MEMORY_DB_DIR/rag_memory_schema.sql"
echo "   sqlite3 $RAG_VECTORS_DB < $VECTOR_DB_DIR/rag_vectors_schema.sql"
echo ""
echo "2. For PostgreSQL:"
echo "   Update credentials in $POSTGRES_CONFIG"
echo "   Run: psql -U postgres -f $PROJECT_ROOT/scripts/init-postgres.sql"
echo ""
echo "3. Configure VS Code SQLTools connections"
echo "   The connections are already defined in .vscode/settings.json"
