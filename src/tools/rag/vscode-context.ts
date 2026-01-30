// src/tools/rag/vscode-context.ts
// Outil MCP pour accepter et stocker le contexte VS Code dans le RAG
// Version: v1.0.0
// Responsabilités: Stocker le contexte VS Code pour enrichir les requêtes RAG

import { logger } from "../../core/logger.js";
import { ToolDefinition, ToolHandler } from "../../core/tool-registry.js";
import {
  embedAndStore
} from "../../rag/vector-store.js";

/**
 * Interface pour le contexte VS Code complet
 */
interface VSCodeContext {
  // Informations workspace
  workspace?: {
    root?: string;
    folders?: Array<{
      name: string;
      path: string;
    }>;
    workspace_file?: string | null;
  };

  // Configuration VS Code
  configuration?: {
    settings?: {
      workspace?: any;
      user?: any;
      default?: any;
    };
    recommended_extensions?: string[];
    workspace_configuration?: {
      has_settings?: boolean;
      has_extensions_json?: boolean;
      settings_path?: string | null;
      extensions_json_path?: string | null;
    };
  };

  // Informations Git
  git?: {
    available?: boolean;
    reason?: string;
    repository?: {
      root?: string;
      head?: string | null;
      commit?: string | null;
      upstream?: string | null;
      ahead?: number;
      behind?: number;
    };
    status?: {
      working_changes?: number;
      index_changes?: number;
      merge_changes?: number;
      total_changes?: number;
    };
    branches?: {
      current?: string | null;
      local?: string[];
      remote?: string[];
    };
    remotes?: Array<{
      name?: string;
      fetch_url?: string | null;
      push_url?: string | null;
    }>;
  };

  // Structure projet
  project?: {
    available?: boolean;
    reason?: string;
    root?: string;
    config_files?: Array<{
      name?: string;
      path?: string;
      exists?: boolean;
      content_preview?: string;
    }>;
    structure?: {
      directories?: string[];
      files?: string[];
      total_items?: number;
      file_types?: Record<string, number>;
    };
    package_info?: any;
    typescript_config?: any;
    project_type?: string;
  };

  // État éditeur
  editor?: {
    active_file?: {
      path?: string;
      language?: string;
      line_count?: number;
      selection?: {
        start_line?: number;
        start_column?: number;
        end_line?: number;
        end_column?: number;
      };
    };
    open_files?: Array<{
      path?: string;
      language?: string;
      is_active?: boolean;
    }>;
    diagnostics?: {
      errors?: number;
      warnings?: number;
      infos?: number;
    };
  };

  // Extensions
  extensions?: {
    installed?: Array<{
      id?: string;
      name?: string;
      version?: string;
      publisher?: string;
      enabled?: boolean;
    }>;
    recommended?: string[];
    categories?: Record<string, number>;
  };

  // Métadonnées
  metadata?: {
    timestamp?: string;
    vscode_version?: string;
    extension_version?: string;
    os?: string;
    language?: string;
    timezone?: string;
  };
}

/**
 * Gestionnaire de contexte VS Code pour le RAG
 */
class VSCodeContextManager {
  private projectPath: string = process.cwd();

  /**
   * Stocke le contexte VS Code dans le RAG
   */
  async storeContext(context: VSCodeContext): Promise<{
    success: boolean;
    context_id: string;
    chunks_created: number;
    indexed_at: string;
  }> {
    const startTime = Date.now();
    const contextId = `vscode-context-${Date.now()}`;

    try {
      logger.info('vscode.context.store.start', 'Début du stockage du contexte VS Code', {
        contextId,
        hasWorkspace: !!context.workspace,
        hasGit: !!context.git,
        hasProject: !!context.project
      });

      // 1. Créer des chunks à partir du contexte
      const chunks = this.createChunksFromContext(context, contextId);

      // 2. Indexer chaque chunk dans le vector store
      const indexedCount = await this.indexChunksInVectorStore(chunks);

      const endTime = Date.now();
      const duration = endTime - startTime;

      logger.info('vscode.context.store.success', 'Contexte VS Code stocké avec succès', {
        contextId,
        chunksCreated: chunks.length,
        indexedCount,
        duration_ms: duration
      });

      return {
        success: true,
        context_id: contextId,
        chunks_created: chunks.length,
        indexed_at: new Date().toISOString()
      };

    } catch (error: any) {
      logger.error('vscode.context.store.error', 'Erreur lors du stockage du contexte VS Code', {
        contextId,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        context_id: contextId,
        chunks_created: 0,
        indexed_at: new Date().toISOString()
      };
    }
  }

  /**
   * Crée des chunks à partir du contexte VS Code
   */
  private createChunksFromContext(context: VSCodeContext, contextId: string): Array<{
    id: string;
    content: string;
    metadata: Record<string, any>;
  }> {
    const chunks: Array<{
      id: string;
      content: string;
      metadata: Record<string, any>;
    }> = [];

    // Chunk 1: Métadonnées du contexte
    const metadataChunk = {
      id: `${contextId}-metadata`,
      content: this.createMetadataContent(context),
      metadata: {
        chunk_type: 'context_metadata',
        source: 'vscode_context',
        content_type: 'context_metadata',
        timestamp: context.metadata?.timestamp || new Date().toISOString(),
        vscode_version: context.metadata?.vscode_version,
        extension_version: context.metadata?.extension_version
      }
    };
    chunks.push(metadataChunk);

    // Chunk 2: Workspace
    if (context.workspace) {
      const workspaceChunk = {
        id: `${contextId}-workspace`,
        content: this.createWorkspaceContent(context.workspace),
        metadata: {
          chunk_type: 'workspace_info',
          source: 'vscode_context',
          content_type: 'workspace_info',
          has_root: !!context.workspace.root,
          folder_count: context.workspace.folders?.length || 0,
          has_workspace_file: !!context.workspace.workspace_file
        }
      };
      chunks.push(workspaceChunk);
    }

    // Chunk 3: Configuration VS Code
    if (context.configuration) {
      const configChunk = {
        id: `${contextId}-configuration`,
        content: this.createConfigurationContent(context.configuration),
        metadata: {
          chunk_type: 'vscode_configuration',
          source: 'vscode_context',
          content_type: 'vscode_configuration',
          has_settings: !!context.configuration.settings,
          has_recommended_extensions: !!context.configuration.recommended_extensions?.length,
          has_workspace_config: !!context.configuration.workspace_configuration
        }
      };
      chunks.push(configChunk);
    }

    // Chunk 4: Informations Git
    if (context.git?.available) {
      const gitChunk = {
        id: `${contextId}-git`,
        content: this.createGitContent(context.git),
        metadata: {
          chunk_type: 'git_info',
          source: 'vscode_context',
          content_type: 'git_info',
          has_repository: !!context.git.repository,
          has_changes: !!context.git.status?.total_changes,
          branch_count: (context.git.branches?.local?.length || 0) + (context.git.branches?.remote?.length || 0)
        }
      };
      chunks.push(gitChunk);
    }

    // Chunk 5: Structure projet
    if (context.project?.available) {
      const projectChunk = {
        id: `${contextId}-project`,
        content: this.createProjectContent(context.project),
        metadata: {
          chunk_type: 'project_structure',
          source: 'vscode_context',
          content_type: 'project_structure',
          project_type: context.project.project_type,
          config_file_count: context.project.config_files?.length || 0,
          directory_count: context.project.structure?.directories?.length || 0,
          file_count: context.project.structure?.files?.length || 0
        }
      };
      chunks.push(projectChunk);
    }

    // Chunk 6: État éditeur
    if (context.editor) {
      const editorChunk = {
        id: `${contextId}-editor`,
        content: this.createEditorContent(context.editor),
        metadata: {
          chunk_type: 'editor_state',
          source: 'vscode_context',
          content_type: 'editor_state',
          has_active_file: !!context.editor.active_file,
          open_files_count: context.editor.open_files?.length || 0,
          has_diagnostics: !!(context.editor.diagnostics?.errors || context.editor.diagnostics?.warnings || context.editor.diagnostics?.infos)
        }
      };
      chunks.push(editorChunk);
    }

    // Chunk 7: Extensions
    if (context.extensions) {
      const extensionsChunk = {
        id: `${contextId}-extensions`,
        content: this.createExtensionsContent(context.extensions),
        metadata: {
          chunk_type: 'extensions_info',
          source: 'vscode_context',
          content_type: 'extensions_info',
          installed_count: context.extensions.installed?.length || 0,
          recommended_count: context.extensions.recommended?.length || 0,
          category_count: Object.keys(context.extensions.categories || {}).length
        }
      };
      chunks.push(extensionsChunk);
    }

    return chunks;
  }

  /**
   * Indexe les chunks dans le vector store
   */
  private async indexChunksInVectorStore(chunks: Array<{
    id: string;
    content: string;
    metadata: Record<string, any>;
  }>): Promise<number> {
    let indexedCount = 0;

    for (const chunk of chunks) {
      try {
        // Utiliser les propriétés d'EmbedAndStoreOptions pour stocker les métadonnées
        await embedAndStore(
          this.projectPath,
          chunk.id,
          chunk.content,
          {
            contentType: chunk.metadata.content_type || 'other',
            language: 'typescript',
            role: chunk.metadata.chunk_type,
            fileExtension: '.txt' // Extension fictive pour le contexte
          }
        );
        indexedCount++;
      } catch (error: any) {
        logger.warn('vscode.context.chunk.index.error', 'Erreur lors de l\'indexation d\'un chunk', {
          chunkId: chunk.id,
          error: error.message
        });
      }
    }

    return indexedCount;
  }

  /**
   * Crée le contenu pour les métadonnées
   */
  private createMetadataContent(context: VSCodeContext): string {
    const lines: string[] = [];
    lines.push('# Contexte VS Code - Métadonnées');
    lines.push('');

    if (context.metadata) {
      lines.push('## Informations système');
      lines.push(`- Timestamp: ${context.metadata.timestamp || new Date().toISOString()}`);
      if (context.metadata.vscode_version) lines.push(`- VS Code version: ${context.metadata.vscode_version}`);
      if (context.metadata.extension_version) lines.push(`- Extension version: ${context.metadata.extension_version}`);
      if (context.metadata.os) lines.push(`- Système d'exploitation: ${context.metadata.os}`);
      if (context.metadata.language) lines.push(`- Langue: ${context.metadata.language}`);
      if (context.metadata.timezone) lines.push(`- Fuseau horaire: ${context.metadata.timezone}`);
    }

    lines.push('');
    lines.push('## Présence des données');
    lines.push(`- Workspace: ${context.workspace ? 'Oui' : 'Non'}`);
    lines.push(`- Configuration: ${context.configuration ? 'Oui' : 'Non'}`);
    lines.push(`- Git: ${context.git?.available ? 'Oui' : 'Non'}`);
    lines.push(`- Projet: ${context.project?.available ? 'Oui' : 'Non'}`);
    lines.push(`- Éditeur: ${context.editor ? 'Oui' : 'Non'}`);
    lines.push(`- Extensions: ${context.extensions ? 'Oui' : 'Non'}`);

    return lines.join('\n');
  }

  /**
   * Crée le contenu pour le workspace
   */
  private createWorkspaceContent(workspace: VSCodeContext['workspace']): string {
    const lines: string[] = [];
    lines.push('# Contexte VS Code - Workspace');
    lines.push('');

    if (workspace?.root) {
      lines.push(`## Racine du workspace`);
      lines.push(`- Chemin: ${workspace.root}`);
      lines.push('');
    }

    if (workspace?.folders?.length) {
      lines.push(`## Dossiers du workspace (${workspace.folders.length})`);
      workspace.folders.forEach((folder, index) => {
        lines.push(`${index + 1}. ${folder.name} → ${folder.path}`);
      });
      lines.push('');
    }

    if (workspace?.workspace_file) {
      lines.push(`## Fichier workspace`);
      lines.push(`- Chemin: ${workspace.workspace_file}`);
    }

    return lines.join('\n');
  }

  /**
   * Crée le contenu pour la configuration
   */
  private createConfigurationContent(configuration: VSCodeContext['configuration']): string {
    const lines: string[] = [];
    lines.push('# Contexte VS Code - Configuration');
    lines.push('');

    if (configuration?.settings) {
      lines.push('## Paramètres');
      if (configuration.settings.workspace) lines.push('- Workspace settings: Présents');
      if (configuration.settings.user) lines.push('- User settings: Présents');
      if (configuration.settings.default) lines.push('- Default settings: Présents');
      lines.push('');
    }

    if (configuration?.recommended_extensions?.length) {
      lines.push(`## Extensions recommandées (${configuration.recommended_extensions.length})`);
      configuration.recommended_extensions.forEach((ext, index) => {
        lines.push(`${index + 1}. ${ext}`);
      });
      lines.push('');
    }

    if (configuration?.workspace_configuration) {
      lines.push('## Configuration workspace');
      const wc = configuration.workspace_configuration;
      lines.push(`- Fichier settings.json: ${wc.has_settings ? 'Présent' : 'Absent'}`);
      lines.push(`- Fichier extensions.json: ${wc.has_extensions_json ? 'Présent' : 'Absent'}`);
      if (wc.settings_path) lines.push(`- Chemin settings.json: ${wc.settings_path}`);
      if (wc.extensions_json_path) lines.push(`- Chemin extensions.json: ${wc.extensions_json_path}`);
    }

    return lines.join('\n');
  }

  /**
   * Crée le contenu pour Git
   */
  private createGitContent(git: VSCodeContext['git']): string {
    const lines: string[] = [];
    lines.push('# Contexte VS Code - Git');
    lines.push('');

    if (!git?.available) {
      lines.push('Git non disponible');
      if (git?.reason) lines.push(`Raison: ${git.reason}`);
      return lines.join('\n');
    }

    if (git.repository) {
      lines.push('## Repository');
      const repo = git.repository;
      if (repo.root) lines.push(`- Racine: ${repo.root}`);
      if (repo.head) lines.push(`- Branche courante: ${repo.head}`);
      if (repo.commit) lines.push(`- Commit: ${repo.commit?.substring(0, 8) || 'N/A'}`);
      if (repo.upstream) lines.push(`- Upstream: ${repo.upstream}`);
      if (repo.ahead || repo.behind) lines.push(`- Ahead/Behind: ${repo.ahead || 0} ahead, ${repo.behind || 0} behind`);
      lines.push('');
    }

    if (git.status) {
      lines.push('## État des changements');
      const status = git.status;
      lines.push(`- Working changes: ${status.working_changes || 0}`);
      lines.push(`- Index changes: ${status.index_changes || 0}`);
      lines.push(`- Merge changes: ${status.merge_changes || 0}`);
      lines.push(`- Total changes: ${status.total_changes || 0}`);
      lines.push('');
    }

    if (git.branches) {
      lines.push('## Branches');
      const branches = git.branches;
      if (branches.current) lines.push(`- Branche courante: ${branches.current}`);
      if (branches.local?.length) {
        lines.push(`- Branches locales (${branches.local.length}):`);
        branches.local.slice(0, 5).forEach(branch => lines.push(`  * ${branch}`));
        if (branches.local.length > 5) lines.push(`  * ... et ${branches.local.length - 5} autres`);
      }
      if (branches.remote?.length) {
        lines.push(`- Branches distantes (${branches.remote.length}):`);
        branches.remote.slice(0, 3).forEach(branch => lines.push(`  * ${branch}`));
        if (branches.remote.length > 3) lines.push(`  * ... et ${branches.remote.length - 3} autres`);
      }
      lines.push('');
    }

    if (git.remotes?.length) {
      lines.push('## Remotes');
      git.remotes.forEach((remote, index) => {
        lines.push(`${index + 1}. ${remote.name || 'unnamed'}:`);
        if (remote.fetch_url) lines.push(`   Fetch: ${remote.fetch_url}`);
        if (remote.push_url) lines.push(`   Push: ${remote.push_url}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Crée le contenu pour la structure projet
   */
  private createProjectContent(project: VSCodeContext['project']): string {
    const lines: string[] = [];
    lines.push('# Contexte VS Code - Structure projet');
    lines.push('');

    if (!project?.available) {
      lines.push('Structure projet non disponible');
      if (project?.reason) lines.push(`Raison: ${project.reason}`);
      return lines.join('\n');
    }

    if (project.root) {
      lines.push(`## Racine du projet`);
      lines.push(`- Chemin: ${project.root}`);
      lines.push('');
    }

    if (project.project_type) {
      lines.push(`## Type de projet`);
      lines.push(`- ${project.project_type}`);
      lines.push('');
    }

    if (project.config_files?.length) {
      lines.push(`## Fichiers de configuration (${project.config_files.length})`);
      project.config_files.forEach((file, index) => {
        lines.push(`${index + 1}. ${file.name || 'unnamed'}:`);
        lines.push(`   - Chemin: ${file.path || 'N/A'}`);
        lines.push(`   - Existe: ${file.exists ? 'Oui' : 'Non'}`);
        if (file.content_preview) {
          lines.push(`   - Aperçu: ${file.content_preview.substring(0, 100)}${file.content_preview.length > 100 ? '...' : ''}`);
        }
      });
      lines.push('');
    }

    if (project.structure) {
      lines.push('## Structure du projet');
      const structure = project.structure;
      lines.push(`- Dossiers: ${structure.directories?.length || 0}`);
      lines.push(`- Fichiers: ${structure.files?.length || 0}`);
      lines.push(`- Total: ${structure.total_items || 0}`);

      if (structure.file_types && Object.keys(structure.file_types).length > 0) {
        lines.push(`- Types de fichiers:`);
        Object.entries(structure.file_types).forEach(([type, count]) => {
          lines.push(`  * ${type}: ${count}`);
        });
      }
      lines.push('');
    }

    if (project.package_info) {
      lines.push('## Informations package.json');
      lines.push(JSON.stringify(project.package_info, null, 2).substring(0, 500));
      if (JSON.stringify(project.package_info).length > 500) lines.push('...');
      lines.push('');
    }

    if (project.typescript_config) {
      lines.push('## Configuration TypeScript');
      lines.push(JSON.stringify(project.typescript_config, null, 2).substring(0, 500));
      if (JSON.stringify(project.typescript_config).length > 500) lines.push('...');
    }

    return lines.join('\n');
  }

  /**
   * Crée le contenu pour l'état éditeur
   */
  private createEditorContent(editor: VSCodeContext['editor']): string {
    const lines: string[] = [];
    lines.push('# Contexte VS Code - État éditeur');
    lines.push('');

    if (editor.active_file) {
      lines.push('## Fichier actif');
      const active = editor.active_file;
      lines.push(`- Chemin: ${active.path || 'N/A'}`);
      lines.push(`- Langage: ${active.language || 'N/A'}`);
      lines.push(`- Lignes: ${active.line_count || 'N/A'}`);
      if (active.selection) {
        lines.push(`- Sélection: L${active.selection.start_line || 0}:C${active.selection.start_column || 0} à L${active.selection.end_line || 0}:C${active.selection.end_column || 0}`);
      }
      lines.push('');
    }

    if (editor.open_files?.length) {
      lines.push(`## Fichiers ouverts (${editor.open_files.length})`);
      editor.open_files.slice(0, 10).forEach((file, index) => {
        lines.push(`${index + 1}. ${file.path || 'N/A'} (${file.language || 'N/A'})${file.is_active ? ' [ACTIF]' : ''}`);
      });
      if (editor.open_files.length > 10) {
        lines.push(`... et ${editor.open_files.length - 10} autres fichiers`);
      }
      lines.push('');
    }

    if (editor.diagnostics) {
      lines.push('## Diagnostics');
      const diag = editor.diagnostics;
      lines.push(`- Erreurs: ${diag.errors || 0}`);
      lines.push(`- Avertissements: ${diag.warnings || 0}`);
      lines.push(`- Informations: ${diag.infos || 0}`);
      lines.push(`- Total: ${(diag.errors || 0) + (diag.warnings || 0) + (diag.infos || 0)}`);
    }

    return lines.join('\n');
  }

  /**
   * Crée le contenu pour les extensions
   */
  private createExtensionsContent(extensions: VSCodeContext['extensions']): string {
    const lines: string[] = [];
    lines.push('# Contexte VS Code - Extensions');
    lines.push('');

    if (extensions.installed?.length) {
      lines.push(`## Extensions installées (${extensions.installed.length})`);
      extensions.installed.slice(0, 15).forEach((ext, index) => {
        lines.push(`${index + 1}. ${ext.name || 'unnamed'} (${ext.id || 'N/A'})`);
        lines.push(`   - Version: ${ext.version || 'N/A'}`);
        lines.push(`   - Éditeur: ${ext.publisher || 'N/A'}`);
        lines.push(`   - Activée: ${ext.enabled ? 'Oui' : 'Non'}`);
      });
      if (extensions.installed.length > 15) {
        lines.push(`... et ${extensions.installed.length - 15} autres extensions`);
      }
      lines.push('');
    }

    if (extensions.recommended?.length) {
      lines.push(`## Extensions recommandées (${extensions.recommended.length})`);
      extensions.recommended.forEach((ext, index) => {
        lines.push(`${index + 1}. ${ext}`);
      });
      lines.push('');
    }

    if (extensions.categories && Object.keys(extensions.categories).length > 0) {
      lines.push('## Catégories d\'extensions');
      Object.entries(extensions.categories).forEach(([category, count]) => {
        lines.push(`- ${category}: ${count}`);
      });
    }

    return lines.join('\n');
  }
}

/**
 * Définition de l'outil MCP pour stocker le contexte VS Code
 */
export const vscodeContextTool: ToolDefinition = {
  name: 'store_vscode_context',
  description: 'Stocke le contexte VS Code (workspace, git, configuration, etc.) dans le RAG pour enrichir les requêtes',
  inputSchema: {
    type: 'object',
    properties: {
      context: {
        type: 'object',
        description: 'Contexte VS Code complet à stocker',
        properties: {
          workspace: {
            type: 'object',
            description: 'Informations workspace',
            properties: {
              root: { type: 'string', description: 'Racine du workspace' },
              folders: {
                type: 'array',
                description: 'Dossiers du workspace',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    path: { type: 'string' }
                  }
                }
              },
              workspace_file: { type: 'string', description: 'Fichier workspace (.code-workspace)' }
            }
          },
          configuration: {
            type: 'object',
            description: 'Configuration VS Code',
            properties: {
              settings: {
                type: 'object',
                description: 'Paramètres VS Code',
                properties: {
                  workspace: { type: 'object' },
                  user: { type: 'object' },
                  default: { type: 'object' }
                }
              },
              recommended_extensions: {
                type: 'array',
                description: 'Extensions recommandées',
                items: { type: 'string' }
              },
              workspace_configuration: {
                type: 'object',
                description: 'Configuration workspace',
                properties: {
                  has_settings: { type: 'boolean' },
                  has_extensions_json: { type: 'boolean' },
                  settings_path: { type: 'string' },
                  extensions_json_path: { type: 'string' }
                }
              }
            }
          },
          git: {
            type: 'object',
            description: 'Informations Git',
            properties: {
              available: { type: 'boolean' },
              reason: { type: 'string' },
              repository: {
                type: 'object',
                properties: {
                  root: { type: 'string' },
                  head: { type: 'string' },
                  commit: { type: 'string' },
                  upstream: { type: 'string' },
                  ahead: { type: 'number' },
                  behind: { type: 'number' }
                }
              },
              status: {
                type: 'object',
                properties: {
                  working_changes: { type: 'number' },
                  index_changes: { type: 'number' },
                  merge_changes: { type: 'number' },
                  total_changes: { type: 'number' }
                }
              },
              branches: {
                type: 'object',
                properties: {
                  current: { type: 'string' },
                  local: { type: 'array', items: { type: 'string' } },
                  remote: { type: 'array', items: { type: 'string' } }
                }
              },
              remotes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    fetch_url: { type: 'string' },
                    push_url: { type: 'string' }
                  }
                }
              }
            }
          },
          project: {
            type: 'object',
            description: 'Structure projet',
            properties: {
              available: { type: 'boolean' },
              reason: { type: 'string' },
              root: { type: 'string' },
              config_files: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    path: { type: 'string' },
                    exists: { type: 'boolean' },
                    content_preview: { type: 'string' }
                  }
                }
              },
              structure: {
                type: 'object',
                properties: {
                  directories: { type: 'array', items: { type: 'string' } },
                  files: { type: 'array', items: { type: 'string' } },
                  total_items: { type: 'number' },
                  file_types: { type: 'object' }
                }
              },
              package_info: { type: 'object' },
              typescript_config: { type: 'object' },
              project_type: { type: 'string' }
            }
          },
          editor: {
            type: 'object',
            description: 'État éditeur',
            properties: {
              active_file: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  language: { type: 'string' },
                  line_count: { type: 'number' },
                  selection: {
                    type: 'object',
                    properties: {
                      start_line: { type: 'number' },
                      start_column: { type: 'number' },
                      end_line: { type: 'number' },
                      end_column: { type: 'number' }
                    }
                  }
                }
              },
              open_files: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    path: { type: 'string' },
                    language: { type: 'string' },
                    is_active: { type: 'boolean' }
                  }
                }
              },
              diagnostics: {
                type: 'object',
                properties: {
                  errors: { type: 'number' },
                  warnings: { type: 'number' },
                  infos: { type: 'number' }
                }
              }
            }
          },
          extensions: {
            type: 'object',
            description: 'Extensions VS Code',
            properties: {
              installed: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    version: { type: 'string' },
                    publisher: { type: 'string' },
                    enabled: { type: 'boolean' }
                  }
                }
              },
              recommended: { type: 'array', items: { type: 'string' } },
              categories: { type: 'object' }
            }
          },
          metadata: {
            type: 'object',
            description: 'Métadonnées du contexte',
            properties: {
              timestamp: { type: 'string', description: 'Timestamp ISO du contexte' },
              vscode_version: { type: 'string', description: 'Version de VS Code' },
              extension_version: { type: 'string', description: 'Version de l\'extension' },
              os: { type: 'string', description: 'Système d\'exploitation' },
              language: { type: 'string', description: 'Langue de VS Code' },
              timezone: { type: 'string', description: 'Fuseau horaire' }
            }
          }
        },
        required: ['context']
      }
    }
  }
}

/**
 * Handler pour l'outil MCP de stockage de contexte VS Code
 */
export const vscodeContextHandler: ToolHandler = async (args: any) => {
  try {
    const { context } = args;

    if (!context) {
      throw new Error('Le paramètre "context" est requis');
    }

    const manager = new VSCodeContextManager();
    const result = await manager.storeContext(context);

    return {
      success: result.success,
      context_id: result.context_id,
      chunks_created: result.chunks_created,
      indexed_at: result.indexed_at,
      message: result.success
        ? `Contexte VS Code stocké avec succès (${result.chunks_created} chunks)`
        : 'Échec du stockage du contexte VS Code'
    };

  } catch (error: any) {
    return {
      success: false,
      context_id: `error-${Date.now()}`,
      chunks_created: 0,
      indexed_at: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    };
  }
};

/**
 * Fonction utilitaire pour tester l'outil
 */
export async function testVSCodeContextTool(): Promise<void> {
  const testContext: VSCodeContext = {
    metadata: {
      timestamp: new Date().toISOString(),
      vscode_version: '1.90.0',
      extension_version: '1.0.0',
      os: 'Linux',
      language: 'fr',
      timezone: 'Europe/Paris'
    },
    workspace: {
      root: '/home/user/project',
      folders: [
        { name: 'src', path: '/home/user/project/src' },
        { name: 'docs', path: '/home/user/project/docs' }
      ],
      workspace_file: '/home/user/project/project.code-workspace'
    },
    git: {
      available: true,
      repository: {
        root: '/home/user/project',
        head: 'main',
        commit: 'abc123def',
        upstream: 'origin/main',
        ahead: 2,
        behind: 0
      },
      status: {
        working_changes: 3,
        index_changes: 1,
        merge_changes: 0,
        total_changes: 4
      },
      branches: {
        current: 'main',
        local: ['main', 'feature-1', 'feature-2'],
        remote: ['origin/main', 'origin/feature-1']
      },
      remotes: [
        { name: 'origin', fetch_url: 'git@github.com:user/project.git', push_url: 'git@github.com:user/project.git' }
      ]
    },
    project: {
      available: true,
      root: '/home/user/project',
      config_files: [
        { name: 'package.json', path: '/home/user/project/package.json', exists: true, content_preview: '{"name": "my-project", "version": "1.0.0"}' },
        { name: 'tsconfig.json', path: '/home/user/project/tsconfig.json', exists: true, content_preview: '{"compilerOptions": {"target": "es2020"}}' }
      ],
      structure: {
        directories: ['src', 'docs', 'test'],
        files: ['package.json', 'tsconfig.json', 'README.md'],
        total_items: 6,
        file_types: { '.json': 2, '.md': 1, '.ts': 10 }
      },
      project_type: 'TypeScript Node.js'
    },
    editor: {
      active_file: {
        path: '/home/user/project/src/main.ts',
        language: 'typescript',
        line_count: 150,
        selection: { start_line: 10, start_column: 5, end_line: 12, end_column: 20 }
      },
      open_files: [
        { path: '/home/user/project/src/main.ts', language: 'typescript', is_active: true },
        { path: '/home/user/project/package.json', language: 'json', is_active: false }
      ],
      diagnostics: { errors: 0, warnings: 3, infos: 5 }
    },
    extensions: {
      installed: [
        { id: 'ms-vscode.vscode-typescript-next', name: 'TypeScript', version: '5.5.0', publisher: 'Microsoft', enabled: true },
        { id: 'esbenp.prettier-vscode', name: 'Prettier', version: '10.0.0', publisher: 'Prettier', enabled: true }
      ],
      recommended: ['dbaeumer.vscode-eslint', 'ms-vscode.vscode-git'],
      categories: { 'Programming Languages': 5, 'Formatters': 3, 'Linters': 2 }
    }
  };

  const result = await vscodeContextHandler({ context: testContext });
  console.log('Test result:', result);
}

// Exécution du test si ce fichier est exécuté directement
// Note: import.meta n'est pas disponible en CommonJS, donc on utilise une vérification alternative
if (typeof require !== 'undefined' && require.main === module) {
  testVSCodeContextTool().catch(console.error);
}
