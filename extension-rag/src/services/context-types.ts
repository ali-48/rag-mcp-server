/**
 * Types de contexte VS Code
 *
 * Ces types sont exportés depuis l'ancien ContextService
 * pour maintenir la compatibilité avec le code existant.
 */

import * as vscode from 'vscode';

// Interfaces pour les types Git de VS Code
export interface GitRef {
  type: number;  // 0 = local, 1 = remote
  name: string;
}

export interface GitRemoteApi {
  name: string;
  fetchUrl?: string;
  pushUrl?: string;
}

export interface VSCodeContext {
  timestamp: string;
  workspace: WorkspaceInfo;
  configuration: VSCodeConfiguration;
  git: GitInfo;
  project: ProjectStructure;
  editor: EditorState;
  extensions: ExtensionsInfo;
  metadata: ContextMetadata;
}

export interface WorkspaceInfo {
  root: string | undefined;
  folders: WorkspaceFolder[];
  is_multi_root: boolean;
  total_folders: number;
  workspace_file: string | null;
}

export interface WorkspaceFolder {
  name: string;
  path: string;
  uri: string;
}

export interface VSCodeConfiguration {
  settings: {
    workspace: any;
    user: any;
    default: any;
  };
  recommended_extensions: string[];
  workspace_configuration: {
    has_settings: boolean;
    has_extensions_json: boolean;
    settings_path: string | null;
    extensions_json_path: string | null;
  };
}

export interface GitInfo {
  available: boolean;
  reason?: string;
  repository?: {
    root: string;
    head: string | null;
    commit: string | null;
    upstream: string | null;
    ahead: number;
    behind: number;
  };
  status?: {
    working_changes: number;
    index_changes: number;
    merge_changes: number;
    total_changes: number;
  };
  branches?: {
    current: string | null;
    local: string[];
    remote: string[];
  };
  remotes?: GitRemote[];
}

export interface GitRemote {
  name: string;
  fetch_url: string | null;
  push_url: string | null;
}

export interface ProjectStructure {
  available: boolean;
  reason?: string;
  root?: string;
  config_files?: ConfigFile[];
  structure?: {
    directories: string[];
    files: string[];
    total_items: number;
    file_types: Record<string, number>;
  };
  package_info?: any;
  typescript_config?: any;
}

export interface ConfigFile {
  name: string;
  path: string;
  exists: boolean;
  content_preview: string;
}

export interface EditorState {
  active_editor: ActiveEditor | null;
  open_editors: OpenEditor[];
  diagnostics: DiagnosticsSummary;
}

export interface ActiveEditor {
  document: {
    uri: string;
    language: string;
    line_count: number;
    is_untitled: boolean;
  };
  selection: {
    start: vscode.Position;
    end: vscode.Position;
    is_empty: boolean;
  };
  visible_ranges: VisibleRange[];
}

export interface OpenEditor {
  uri: string;
  language: string;
  line_count: number;
}

export interface VisibleRange {
  start: vscode.Position;
  end: vscode.Position;
}

export interface DiagnosticsSummary {
  total: number;
  by_severity: Record<string, number>;
  files_with_diagnostics: number;
}

export interface ExtensionsInfo {
  total: number;
  enabled: number;
  disabled: number;
  workspace_recommended: number;
  by_category: Record<string, number>;
}

export interface ContextMetadata {
  context_service_version: string;
  collected_at: string;
  workspace_root: string | null;
}

export interface MinimalContext {
  workspace_name: string;
  project_type: string;
  git_branch: string | null;
  open_files: number;
  has_errors: boolean;
  timestamp: string;
}
