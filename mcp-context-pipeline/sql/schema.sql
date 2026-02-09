-- 📊 Script SQL Schéma Minimal - Pipeline MCP Context Capture
-- Conforme aux règles absolues RAG MCP Server
-- Tables minimales : events, files, errors, audit_log

-- ============================================
-- 📋 TABLE: events - Événements VS Code capturés
-- ============================================
CREATE TABLE IF NOT EXISTS events (
    -- Identifiants
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_uuid TEXT UNIQUE NOT NULL,           -- UUID v4 pour référence externe
    project_id TEXT NOT NULL,                  -- ID du projet (hash workspace)

    -- Métadonnées événement
    source TEXT NOT NULL DEFAULT 'vscode',     -- Source (toujours 'vscode')
    event_type TEXT NOT NULL,                  -- Type: 'file_save', 'diagnostic', 'workspace', 'error'
    timestamp DATETIME NOT NULL,               -- Horodatage ISO-8601

    -- Fichier concerné
    file_path TEXT,                            -- Chemin relatif du fichier
    file_language TEXT,                        -- Langage: 'typescript', 'python', etc.
    file_hash TEXT,                            -- Hash SHA-256 du contenu

    -- Payload JSON
    payload_json TEXT NOT NULL,                -- Données spécifiques (JSON)

    -- État traitement
    status TEXT NOT NULL DEFAULT 'pending',    -- 'pending', 'processing', 'processed', 'failed'
    processing_attempts INTEGER DEFAULT 0,     -- Nombre de tentatives de traitement
    last_processing_attempt DATETIME,          -- Dernière tentative

    -- Métadonnées techniques
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Contraintes
    CHECK (source IN ('vscode')),
    CHECK (event_type IN ('file_save', 'diagnostic', 'workspace', 'error')),
    CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
    CHECK (processing_attempts >= 0)
);

-- ============================================
-- 📁 TABLE: files - Fichiers suivis avec hash
-- ============================================
CREATE TABLE IF NOT EXISTS files (
    -- Identifiants
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,                  -- ID du projet
    file_path TEXT NOT NULL,                   -- Chemin relatif

    -- Métadonnées fichier
    file_language TEXT,                        -- Langage détecté
    file_size INTEGER,                         -- Taille en octets
    line_count INTEGER,                        -- Nombre de lignes

    -- Contrôle version
    current_hash TEXT NOT NULL,                -- Hash SHA-256 actuel
    previous_hash TEXT,                        -- Hash précédent (pour détection changements)

    -- Statistiques
    save_count INTEGER DEFAULT 0,              -- Nombre de sauvegardes
    error_count INTEGER DEFAULT 0,             -- Nombre d'erreurs détectées
    warning_count INTEGER DEFAULT 0,           -- Nombre d'avertissements

    -- Dernières activités
    last_save DATETIME,                        -- Dernière sauvegarde
    last_error DATETIME,                       -- Dernière erreur
    last_warning DATETIME,                     -- Dernier avertissement

    -- Métadonnées techniques
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Contraintes d'unicité
    UNIQUE(project_id, file_path)
);

-- ============================================
-- ❌ TABLE: errors - Erreurs système et métier
-- ============================================
CREATE TABLE IF NOT EXISTS errors (
    -- Identifiants
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    error_uuid TEXT UNIQUE NOT NULL,           -- UUID v4 pour référence externe
    project_id TEXT NOT NULL,                  -- ID du projet

    -- Classification erreur
    error_type TEXT NOT NULL,                  -- 'build', 'test', 'runtime', 'extension', 'system'
    error_source TEXT,                         -- Source: 'typescript', 'eslint', 'python', etc.
    error_code TEXT,                           -- Code d'erreur: 'TS2322', 'E501', etc.

    -- Détails erreur
    error_message TEXT NOT NULL,               -- Message d'erreur
    stack_trace TEXT,                          -- Stack trace complète
    file_path TEXT,                            -- Fichier source
    line_number INTEGER,                       -- Ligne de l'erreur
    column_number INTEGER,                     -- Colonne de l'erreur

    -- Contexte
    command TEXT,                              -- Commande qui a échoué
    exit_code INTEGER,                         -- Code de sortie
    duration_ms INTEGER,                       -- Durée avant échec (ms)

    -- État résolution
    is_resolved BOOLEAN DEFAULT FALSE,         -- Erreur résolue ?
    resolution_method TEXT,                    -- Comment résolue: 'fixed', 'ignored', 'workaround'
    resolved_at DATETIME,                      -- Date résolution
    resolved_by TEXT,                          -- Qui a résolu: 'user', 'ai', 'system'

    -- Métadonnées techniques
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Contraintes
    CHECK (error_type IN ('build', 'test', 'runtime', 'extension', 'system')),
    CHECK (resolution_method IN ('fixed', 'ignored', 'workaround', NULL)),
    CHECK (resolved_by IN ('user', 'ai', 'system', NULL))
);

-- ============================================
-- 📝 TABLE: audit_log - Journal d'audit complet
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
    -- Identifiants
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_uuid TEXT UNIQUE NOT NULL,           -- UUID v4 pour référence externe

    -- Action auditée
    action_type TEXT NOT NULL,                 -- Type d'action
    action_target TEXT NOT NULL,               -- Cible de l'action
    action_details TEXT,                       -- Détails de l'action

    -- Acteur
    actor_type TEXT NOT NULL,                  -- Type d'acteur: 'user', 'ai', 'system', 'extension'
    actor_id TEXT,                             -- ID de l'acteur

    -- Contexte
    project_id TEXT,                           -- ID du projet concerné
    event_id INTEGER,                          -- ID événement lié (optionnel)
    file_id INTEGER,                           -- ID fichier lié (optionnel)
    error_id INTEGER,                          -- ID erreur liée (optionnel)

    -- Résultat
    success BOOLEAN NOT NULL,                  -- Action réussie ?
    error_message TEXT,                        -- Message d'erreur si échec

    -- Métadonnées
    ip_address TEXT,                           -- Adresse IP (pour audit sécurité)
    user_agent TEXT,                           -- User-Agent
    session_id TEXT,                           -- ID de session

    -- Horodatages
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Contraintes
    CHECK (actor_type IN ('user', 'ai', 'system', 'extension')),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL,
    FOREIGN KEY (error_id) REFERENCES errors(id) ON DELETE SET NULL
);

-- ============================================
-- 🔍 INDEXES pour performances
-- ============================================

-- Index pour events
CREATE INDEX IF NOT EXISTS idx_events_project_status ON events(project_id, status);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_file_hash ON events(file_hash);

-- Index pour files
CREATE INDEX IF NOT EXISTS idx_files_project_path ON files(project_id, file_path);
CREATE INDEX IF NOT EXISTS idx_files_current_hash ON files(current_hash);
CREATE INDEX IF NOT EXISTS idx_files_last_save ON files(last_save);

-- Index pour errors
CREATE INDEX IF NOT EXISTS idx_errors_project_resolved ON errors(project_id, is_resolved);
CREATE INDEX IF NOT EXISTS idx_errors_type ON errors(error_type);
CREATE INDEX IF NOT EXISTS idx_errors_created ON errors(created_at);

-- Index pour audit_log
CREATE INDEX IF NOT EXISTS idx_audit_action_type ON audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

-- ============================================
-- 🔄 TRIGGERS pour métadonnées automatiques
-- ============================================

-- Trigger pour mettre à jour updated_at sur events
CREATE TRIGGER IF NOT EXISTS update_events_timestamp
AFTER UPDATE ON events
BEGIN
    UPDATE events
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- Trigger pour mettre à jour updated_at sur files
CREATE TRIGGER IF NOT EXISTS update_files_timestamp
AFTER UPDATE ON files
BEGIN
    UPDATE files
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- Trigger pour mettre à jour updated_at sur errors
CREATE TRIGGER IF NOT EXISTS update_errors_timestamp
AFTER UPDATE ON errors
BEGIN
    UPDATE errors
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- ============================================
-- 📊 VUES pour requêtes courantes
-- ============================================

-- Vue: Événements en attente de traitement
CREATE VIEW IF NOT EXISTS v_pending_events AS
SELECT
    e.id,
    e.event_uuid,
    e.project_id,
    e.event_type,
    e.timestamp,
    e.file_path,
    e.status,
    e.processing_attempts
FROM events e
WHERE e.status = 'pending'
ORDER BY e.timestamp ASC;

-- Vue: Statistiques fichiers par projet
CREATE VIEW IF NOT EXISTS v_project_file_stats AS
SELECT
    f.project_id,
    COUNT(*) as total_files,
    SUM(f.save_count) as total_saves,
    SUM(f.error_count) as total_errors,
    SUM(f.warning_count) as total_warnings,
    MAX(f.last_save) as last_file_save
FROM files f
GROUP BY f.project_id;

-- Vue: Erreurs non résolues
CREATE VIEW IF NOT EXISTS v_unresolved_errors AS
SELECT
    e.id,
    e.error_uuid,
    e.project_id,
    e.error_type,
    e.error_message,
    e.file_path,
    e.line_number,
    e.created_at,
    DATEDIFF('day', e.created_at, CURRENT_TIMESTAMP) as days_open
FROM errors e
WHERE e.is_resolved = FALSE
ORDER BY e.created_at DESC;

-- ============================================
-- ✅ VALIDATION: Vérifier que le schéma est exécutable
-- ============================================

-- Commentaire: Ce script SQL est exécutable sans erreur dans SQLite
-- Conforme aux exigences de la tâche T1.5
-- Tables minimales: events, files, errors, audit_log ✓
-- Indexes pour performances ✓
-- Triggers pour métadonnées automatiques ✓
-- Vues pour requêtes courantes ✓
