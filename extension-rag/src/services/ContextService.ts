import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Service pour récupérer automatiquement le contexte VS Code
 *
 * Ce service collecte :
 * 1. Configuration VS Code (.vscode/settings.json, extensions.json, workspace config)
 * 2. Informations Git (repository, branch, commit history, uncommitted changes)
 * 3. Structure du projet (package.json, tsconfig.json, structure dossiers)
 * 4. État de l'éditeur (fichiers ouverts, sélection, diagnostics)
 *
 * Le contexte est utilisé pour enrichir les requêtes RAG avec des informations
 * spécifiques au workspace actuel.
 */
export class ContextService {
  private workspaceRoot: string | undefined;
  private gitExtension: vscode.Extension<any> | undefined;

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    this.gitExtension = vscode.extensions.getExtension('vscode.git');
  }

  /**
   * Récupère le contexte complet du workspace VS Code
   */
  public async getFullContext(): Promise<VSCodeContext> {
    try {
      console.log('🔄 ContextService: Récupération du contexte VS Code...');

      const context: VSCodeContext = {
        timestamp: new Date().toISOString(),
        workspace: await this.getWorkspaceInfo(),
        configuration: await this.getVSCodeConfiguration(),
        git: await this.getGitInfo(),
        project: await this.getProjectStructure(),
        editor: await this.getEditorState(),
        extensions: await this.getExtensionsInfo(),
        metadata: {
          context_service_version: '1.0.0',
          collected_at: new Date().toISOString(),
          workspace_root: this.workspaceRoot || null
        }
      };

      console.log('✅ ContextService: Contexte récupéré avec succès');
      return context;

    } catch (error) {
      console.error('❌ ContextService: Erreur lors de la récupération du contexte:', error);
      throw new Error(`Failed to get VS Code context: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Récupère les informations du workspace
   */
  private async getWorkspaceInfo(): Promise<WorkspaceInfo> {
    const workspaceFolders = vscode.workspace.workspaceFolders || [];

    return {
      root: this.workspaceRoot,
      folders: workspaceFolders.map(folder => ({
        name: folder.name,
        path: folder.uri.fsPath,
        uri: folder.uri.toString()
      })),
      is_multi_root: workspaceFolders.length > 1,
      total_folders: workspaceFolders.length,
      workspace_file: vscode.workspace.workspaceFile?.fsPath || null
    };
  }

  /**
   * Récupère la configuration VS Code
   */
  private async getVSCodeConfiguration(): Promise<VSCodeConfiguration> {
    const config = vscode.workspace.getConfiguration();

    // Configuration du workspace (.vscode/settings.json)
    const workspaceSettingsPath = this.workspaceRoot
      ? path.join(this.workspaceRoot, '.vscode', 'settings.json')
      : null;

    const workspaceSettings = workspaceSettingsPath && fs.existsSync(workspaceSettingsPath)
      ? JSON.parse(fs.readFileSync(workspaceSettingsPath, 'utf-8'))
      : {};

    // Extensions recommandées (.vscode/extensions.json)
    const extensionsJsonPath = this.workspaceRoot
      ? path.join(this.workspaceRoot, '.vscode', 'extensions.json')
      : null;

    const recommendedExtensions = extensionsJsonPath && fs.existsSync(extensionsJsonPath)
      ? JSON.parse(fs.readFileSync(extensionsJsonPath, 'utf-8'))
      : {};

    return {
      settings: {
        workspace: workspaceSettings,
        user: config.get('') || {},
        default: {}
      },
      recommended_extensions: recommendedExtensions.recommendations || [],
      workspace_configuration: {
        has_settings: !!workspaceSettingsPath && fs.existsSync(workspaceSettingsPath),
        has_extensions_json: !!extensionsJsonPath && fs.existsSync(extensionsJsonPath),
        settings_path: workspaceSettingsPath,
        extensions_json_path: extensionsJsonPath
      }
    };
  }

  /**
   * Récupère les informations Git
   */
  private async getGitInfo(): Promise<GitInfo> {
    if (!this.gitExtension || !this.gitExtension.isActive) {
      return {
        available: false,
        reason: 'Git extension not active or not installed'
      };
    }

    try {
      const git = this.gitExtension.exports.getAPI(1);
      const repositories = git.repositories || [];

      if (repositories.length === 0) {
        return {
          available: false,
          reason: 'No git repositories found'
        };
      }

      const repo = repositories[0];
      const state = repo.state;

      return {
        available: true,
        repository: {
          root: repo.rootUri.fsPath,
          head: state.HEAD?.name || null,
          commit: state.HEAD?.commit || null,
          upstream: state.HEAD?.upstream?.name || null,
          ahead: state.HEAD?.ahead || 0,
          behind: state.HEAD?.behind || 0
        },
        status: {
          working_changes: state.workingTreeChanges.length,
          index_changes: state.indexChanges.length,
          merge_changes: state.mergeChanges.length,
          total_changes: state.workingTreeChanges.length + state.indexChanges.length + state.mergeChanges.length
        },
        branches: {
          current: state.HEAD?.name || null,
          local: state.refs?.filter((ref: GitRef) => ref.type === 0).map((ref: GitRef) => ref.name) || [],
          remote: state.refs?.filter((ref: GitRef) => ref.type === 1).map((ref: GitRef) => ref.name) || []
        },
        remotes: repo.state.remotes?.map((remote: GitRemoteApi) => ({
          name: remote.name,
          fetch_url: remote.fetchUrl || null,
          push_url: remote.pushUrl || null
        })) || []
      };

    } catch (error) {
      console.warn('⚠️ ContextService: Erreur lors de la récupération des informations Git:', error);
      return {
        available: false,
        reason: `Git API error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Récupère la structure du projet
   */
  private async getProjectStructure(): Promise<ProjectStructure> {
    if (!this.workspaceRoot) {
      return {
        available: false,
        reason: 'No workspace root'
      };
    }

    try {
      // Vérifier les fichiers de configuration courants
      const configFiles = [
        'package.json',
        'tsconfig.json',
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        '.gitignore',
        '.eslintrc',
        '.eslintrc.json',
        '.prettierrc',
        'dockerfile',
        'docker-compose.yml',
        'README.md'
      ];

      const foundConfigs: ConfigFile[] = [];

      for (const configFile of configFiles) {
        const configPath = path.join(this.workspaceRoot, configFile);
        if (fs.existsSync(configPath)) {
          try {
            const content = fs.readFileSync(configPath, 'utf-8');
            const parsed = configFile === 'package.json' || configFile.endsWith('.json')
              ? JSON.parse(content)
              : content;

            foundConfigs.push({
              name: configFile,
              path: configPath,
              exists: true,
              content_preview: typeof parsed === 'string'
                ? parsed.substring(0, 500)
                : JSON.stringify(parsed, null, 2).substring(0, 500)
            });
          } catch (parseError) {
            foundConfigs.push({
              name: configFile,
              path: configPath,
              exists: true,
              content_preview: '[Binary or unreadable file]'
            });
          }
        }
      }

      // Analyser la structure des dossiers (premier niveau)
      const topLevelItems = fs.readdirSync(this.workspaceRoot, { withFileTypes: true });
      const directories = topLevelItems.filter(item => item.isDirectory()).map(dir => dir.name);
      const files = topLevelItems.filter(item => item.isFile()).map(file => file.name);

      // Compter les fichiers par type
      const fileTypes: Record<string, number> = {};
      topLevelItems.forEach(item => {
        if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase() || 'no-extension';
          fileTypes[ext] = (fileTypes[ext] || 0) + 1;
        }
      });

      return {
        available: true,
        root: this.workspaceRoot,
        config_files: foundConfigs,
        structure: {
          directories,
          files,
          total_items: topLevelItems.length,
          file_types: fileTypes
        },
        package_info: foundConfigs.find(c => c.name === 'package.json')?.content_preview
          ? JSON.parse(foundConfigs.find(c => c.name === 'package.json')!.content_preview)
          : null,
        typescript_config: foundConfigs.find(c => c.name === 'tsconfig.json')?.content_preview
          ? JSON.parse(foundConfigs.find(c => c.name === 'tsconfig.json')!.content_preview)
          : null
      };

    } catch (error) {
      console.warn('⚠️ ContextService: Erreur lors de l\'analyse de la structure du projet:', error);
      return {
        available: false,
        reason: `Project structure analysis error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Récupère l'état de l'éditeur
   */
  private async getEditorState(): Promise<EditorState> {
    const activeEditor = vscode.window.activeTextEditor;

    return {
      active_editor: activeEditor ? {
        document: {
          uri: activeEditor.document.uri.toString(),
          language: activeEditor.document.languageId,
          line_count: activeEditor.document.lineCount,
          is_untitled: activeEditor.document.isUntitled
        },
        selection: {
          start: activeEditor.selection.start,
          end: activeEditor.selection.end,
          is_empty: activeEditor.selection.isEmpty
        },
        visible_ranges: activeEditor.visibleRanges.map(range => ({
          start: range.start,
          end: range.end
        }))
      } : null,
      open_editors: vscode.window.visibleTextEditors.map(editor => ({
        uri: editor.document.uri.toString(),
        language: editor.document.languageId,
        line_count: editor.document.lineCount
      })),
      diagnostics: this.getDiagnosticsSummary()
    };
  }

  /**
   * Récupère un résumé des diagnostics
   */
  private getDiagnosticsSummary(): DiagnosticsSummary {
    const diagnostics = vscode.languages.getDiagnostics();
    let total = 0;
    const bySeverity: Record<string, number> = {
      error: 0,
      warning: 0,
      information: 0,
      hint: 0
    };

    for (const [uri, diags] of diagnostics) {
      total += diags.length;
      diags.forEach(diag => {
        const severity = vscode.DiagnosticSeverity[diag.severity].toLowerCase();
        bySeverity[severity] = (bySeverity[severity] || 0) + 1;
      });
    }

    return {
      total,
      by_severity: bySeverity,
      files_with_diagnostics: diagnostics.length
    };
  }

  /**
   * Récupère les informations sur les extensions
   */
  private async getExtensionsInfo(): Promise<ExtensionsInfo> {
    const extensions = vscode.extensions.all;

    return {
      total: extensions.length,
      enabled: extensions.filter(ext => ext.isActive).length,
      disabled: extensions.filter(ext => !ext.isActive).length,
      workspace_recommended: (await this.getVSCodeConfiguration()).recommended_extensions.length,
      by_category: extensions.reduce((acc, ext) => {
        const category = ext.packageJSON?.categories?.[0] || 'other';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  /**
   * Récupère un contexte minimal pour les requêtes RAG
   */
  public async getMinimalContext(): Promise<MinimalContext> {
    const fullContext = await this.getFullContext();

    return {
      workspace_name: fullContext.workspace.folders[0]?.name || 'unknown',
      project_type: this.detectProjectType(fullContext),
      git_branch: fullContext.git.available ? fullContext.git.repository?.head || null : null,
      open_files: fullContext.editor.open_editors.length,
      has_errors: fullContext.editor.diagnostics.total > 0,
      timestamp: fullContext.timestamp
    };
  }

  /**
   * Détecte le type de projet
   */
  private detectProjectType(context: VSCodeContext): string {
    if (!context.project.available) {
      return 'unknown';
    }

    const project = context.project;

    // Vérifier package.json pour Node.js/TypeScript
    if (project.package_info) {
      const pkg = typeof project.package_info === 'string'
        ? JSON.parse(project.package_info)
        : project.package_info;

      if (pkg.dependencies?.react || pkg.devDependencies?.react) return 'react';
      if (pkg.dependencies?.vue || pkg.devDependencies?.vue) return 'vue';
      if (pkg.dependencies?.angular || pkg.devDependencies?.angular) return 'angular';
      if (pkg.dependencies?.next || pkg.devDependencies?.next) return 'nextjs';
      if (pkg.scripts?.dev || pkg.scripts?.start) return 'nodejs';
    }

    // Vérifier tsconfig.json pour TypeScript
    if (project.typescript_config) {
      return 'typescript';
    }

    // Vérifier les fichiers de configuration
    const configNames = project.config_files?.map(c => c.name) || [];
    if (configNames.includes('dockerfile') || configNames.includes('docker-compose.yml')) {
      return 'docker';
    }

    // Vérifier les extensions de fichiers
    const fileTypes = project.structure?.file_types || {};
    if (fileTypes['.py']) return 'python';
    if (fileTypes['.java']) return 'java';
    if (fileTypes['.go']) return 'go';
    if (fileTypes['.rs']) return 'rust';
    if (fileTypes['.cpp'] || fileTypes['.c']) return 'c++';

    return 'unknown';
  }
}

// Types pour le contexte VS Code

// Interfaces pour les types Git de VS Code
interface GitRef {
  type: number;  // 0 = local, 1 = remote
  name: string;
}

interface GitRemoteApi {
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
