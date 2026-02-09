/**
 * Interfaces TypeScript pour les événements VS Code
 * Correspondant aux schémas JSON définis dans event-schemas.ts
 */

/**
 * Événement de base commun à tous les types
 */
export interface BaseEvent {
  source: "vscode";
  type: string;
  timestamp: string; // ISO-8601
  project_id: string;
  file?: {
    path: string;
    language?: string;
    hash: string; // SHA-256
  };
  payload: any;
}

/**
 * Événement : Sauvegarde de fichier (onFileSave)
 */
export interface FileSaveEvent extends BaseEvent {
  type: "file_save";
  payload: {
    content_preview: string; // Premiers 1000 caractères
    line_count: number;
    symbol_count?: number;
    diagnostics?: Diagnostic[];
    has_errors: boolean;
    has_warnings: boolean;
  };
}

/**
 * Événement : Diagnostic (erreurs, avertissements)
 */
export interface DiagnosticEvent extends BaseEvent {
  type: "diagnostic";
  payload: {
    diagnostic_type: "error" | "warning" | "info" | "hint";
    message: string;
    code?: string; // Ex: 'TS2322'
    source?: string; // Ex: 'typescript', 'eslint'
    line: number;
    column?: number;
    is_new: boolean;
    was_fixed?: boolean;
  };
}

/**
 * Événement : Changement workspace
 */
export interface WorkspaceEvent extends BaseEvent {
  type: "workspace";
  payload: {
    change_type: "created" | "deleted" | "renamed" | "moved";
    old_path?: string;
    file_type?: string; // Extension
    is_config_file?: boolean;
    config_files_affected?: string[];
  };
}

/**
 * Événement : Erreur système
 */
export interface ErrorEvent extends BaseEvent {
  type: "error";
  payload: {
    error_type: "build" | "test" | "runtime" | "extension" | "system";
    error_message: string;
    stack_trace?: string;
    exit_code?: number;
    command?: string;
    duration_ms?: number;
    retry_count?: number;
  };
}

/**
 * Diagnostic individuel
 */
export interface Diagnostic {
  severity: "error" | "warning" | "info" | "hint";
  message: string;
  line: number;
  column?: number;
}

/**
 * Union de tous les types d'événements
 */
export type VSCodeEvent = FileSaveEvent | DiagnosticEvent | WorkspaceEvent | ErrorEvent;

/**
 * Type guard pour vérifier le type d'événement
 */
export function isFileSaveEvent(event: VSCodeEvent): event is FileSaveEvent {
  return event.type === "file_save";
}

export function isDiagnosticEvent(event: VSCodeEvent): event is DiagnosticEvent {
  return event.type === "diagnostic";
}

export function isWorkspaceEvent(event: VSCodeEvent): event is WorkspaceEvent {
  return event.type === "workspace";
}

export function isErrorEvent(event: VSCodeEvent): event is ErrorEvent {
  return event.type === "error";
}

/**
 * Helper pour créer un événement de base
 */
export function createBaseEvent<T extends VSCodeEvent["type"]>(
  type: T,
  projectId: string,
  file?: { path: string; language?: string; hash: string }
): Omit<BaseEvent, "payload"> & { type: T } {
  return {
    source: "vscode",
    type,
    timestamp: new Date().toISOString(),
    project_id: projectId,
    file
  };
}

/**
 * Helper pour créer un événement de sauvegarde de fichier
 */
export function createFileSaveEvent(
  projectId: string,
  file: { path: string; language?: string; hash: string },
  payload: Omit<FileSaveEvent["payload"], "has_errors" | "has_warnings">
): FileSaveEvent {
  const has_errors = payload.diagnostics?.some(d => d.severity === "error") || false;
  const has_warnings = payload.diagnostics?.some(d => d.severity === "warning") || false;

  return {
    ...createBaseEvent("file_save", projectId, file),
    payload: {
      ...payload,
      has_errors,
      has_warnings
    }
  };
}

/**
 * Helper pour créer un événement de diagnostic
 */
export function createDiagnosticEvent(
  projectId: string,
  file: { path: string; language?: string; hash: string },
  payload: DiagnosticEvent["payload"]
): DiagnosticEvent {
  return {
    ...createBaseEvent("diagnostic", projectId, file),
    payload
  };
}

/**
 * Helper pour créer un événement de workspace
 */
export function createWorkspaceEvent(
  projectId: string,
  file: { path: string },
  payload: WorkspaceEvent["payload"]
): WorkspaceEvent {
  return {
    ...createBaseEvent("workspace", projectId, { ...file, hash: "" }), // Pas de hash pour les événements workspace
    payload
  };
}

/**
 * Helper pour créer un événement d'erreur
 */
export function createErrorEvent(
  projectId: string,
  payload: ErrorEvent["payload"],
  file?: { path: string; language?: string; hash: string }
): ErrorEvent {
  return {
    ...createBaseEvent("error", projectId, file),
    payload
  };
}
