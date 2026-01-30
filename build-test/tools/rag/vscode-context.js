"use strict";
// src/tools/rag/vscode-context.ts
// Outil MCP pour accepter et stocker le contexte VS Code dans le RAG
// Version: v1.0.0
// Responsabilités: Stocker le contexte VS Code pour enrichir les requêtes RAG
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.vscodeContextHandler = exports.vscodeContextTool = void 0;
exports.testVSCodeContextTool = testVSCodeContextTool;
var logger_js_1 = require("../../core/logger.js");
var vector_store_js_1 = require("../../rag/vector-store.js");
/**
 * Gestionnaire de contexte VS Code pour le RAG
 */
var VSCodeContextManager = /** @class */ (function () {
    function VSCodeContextManager() {
        this.projectPath = process.cwd();
    }
    /**
     * Stocke le contexte VS Code dans le RAG
     */
    VSCodeContextManager.prototype.storeContext = function (context) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, contextId, chunks, indexedCount, endTime, duration, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = Date.now();
                        contextId = "vscode-context-".concat(Date.now());
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        logger_js_1.logger.info('vscode.context.store.start', 'Début du stockage du contexte VS Code', {
                            contextId: contextId,
                            hasWorkspace: !!context.workspace,
                            hasGit: !!context.git,
                            hasProject: !!context.project
                        });
                        chunks = this.createChunksFromContext(context, contextId);
                        return [4 /*yield*/, this.indexChunksInVectorStore(chunks)];
                    case 2:
                        indexedCount = _a.sent();
                        endTime = Date.now();
                        duration = endTime - startTime;
                        logger_js_1.logger.info('vscode.context.store.success', 'Contexte VS Code stocké avec succès', {
                            contextId: contextId,
                            chunksCreated: chunks.length,
                            indexedCount: indexedCount,
                            duration_ms: duration
                        });
                        return [2 /*return*/, {
                                success: true,
                                context_id: contextId,
                                chunks_created: chunks.length,
                                indexed_at: new Date().toISOString()
                            }];
                    case 3:
                        error_1 = _a.sent();
                        logger_js_1.logger.error('vscode.context.store.error', 'Erreur lors du stockage du contexte VS Code', {
                            contextId: contextId,
                            error: error_1.message,
                            stack: error_1.stack
                        });
                        return [2 /*return*/, {
                                success: false,
                                context_id: contextId,
                                chunks_created: 0,
                                indexed_at: new Date().toISOString()
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Crée des chunks à partir du contexte VS Code
     */
    VSCodeContextManager.prototype.createChunksFromContext = function (context, contextId) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
        var chunks = [];
        // Chunk 1: Métadonnées du contexte
        var metadataChunk = {
            id: "".concat(contextId, "-metadata"),
            content: this.createMetadataContent(context),
            metadata: {
                chunk_type: 'context_metadata',
                source: 'vscode_context',
                content_type: 'context_metadata',
                timestamp: ((_a = context.metadata) === null || _a === void 0 ? void 0 : _a.timestamp) || new Date().toISOString(),
                vscode_version: (_b = context.metadata) === null || _b === void 0 ? void 0 : _b.vscode_version,
                extension_version: (_c = context.metadata) === null || _c === void 0 ? void 0 : _c.extension_version
            }
        };
        chunks.push(metadataChunk);
        // Chunk 2: Workspace
        if (context.workspace) {
            var workspaceChunk = {
                id: "".concat(contextId, "-workspace"),
                content: this.createWorkspaceContent(context.workspace),
                metadata: {
                    chunk_type: 'workspace_info',
                    source: 'vscode_context',
                    content_type: 'workspace_info',
                    has_root: !!context.workspace.root,
                    folder_count: ((_d = context.workspace.folders) === null || _d === void 0 ? void 0 : _d.length) || 0,
                    has_workspace_file: !!context.workspace.workspace_file
                }
            };
            chunks.push(workspaceChunk);
        }
        // Chunk 3: Configuration VS Code
        if (context.configuration) {
            var configChunk = {
                id: "".concat(contextId, "-configuration"),
                content: this.createConfigurationContent(context.configuration),
                metadata: {
                    chunk_type: 'vscode_configuration',
                    source: 'vscode_context',
                    content_type: 'vscode_configuration',
                    has_settings: !!context.configuration.settings,
                    has_recommended_extensions: !!((_e = context.configuration.recommended_extensions) === null || _e === void 0 ? void 0 : _e.length),
                    has_workspace_config: !!context.configuration.workspace_configuration
                }
            };
            chunks.push(configChunk);
        }
        // Chunk 4: Informations Git
        if ((_f = context.git) === null || _f === void 0 ? void 0 : _f.available) {
            var gitChunk = {
                id: "".concat(contextId, "-git"),
                content: this.createGitContent(context.git),
                metadata: {
                    chunk_type: 'git_info',
                    source: 'vscode_context',
                    content_type: 'git_info',
                    has_repository: !!context.git.repository,
                    has_changes: !!((_g = context.git.status) === null || _g === void 0 ? void 0 : _g.total_changes),
                    branch_count: (((_j = (_h = context.git.branches) === null || _h === void 0 ? void 0 : _h.local) === null || _j === void 0 ? void 0 : _j.length) || 0) + (((_l = (_k = context.git.branches) === null || _k === void 0 ? void 0 : _k.remote) === null || _l === void 0 ? void 0 : _l.length) || 0)
                }
            };
            chunks.push(gitChunk);
        }
        // Chunk 5: Structure projet
        if ((_m = context.project) === null || _m === void 0 ? void 0 : _m.available) {
            var projectChunk = {
                id: "".concat(contextId, "-project"),
                content: this.createProjectContent(context.project),
                metadata: {
                    chunk_type: 'project_structure',
                    source: 'vscode_context',
                    content_type: 'project_structure',
                    project_type: context.project.project_type,
                    config_file_count: ((_o = context.project.config_files) === null || _o === void 0 ? void 0 : _o.length) || 0,
                    directory_count: ((_q = (_p = context.project.structure) === null || _p === void 0 ? void 0 : _p.directories) === null || _q === void 0 ? void 0 : _q.length) || 0,
                    file_count: ((_s = (_r = context.project.structure) === null || _r === void 0 ? void 0 : _r.files) === null || _s === void 0 ? void 0 : _s.length) || 0
                }
            };
            chunks.push(projectChunk);
        }
        // Chunk 6: État éditeur
        if (context.editor) {
            var editorChunk = {
                id: "".concat(contextId, "-editor"),
                content: this.createEditorContent(context.editor),
                metadata: {
                    chunk_type: 'editor_state',
                    source: 'vscode_context',
                    content_type: 'editor_state',
                    has_active_file: !!context.editor.active_file,
                    open_files_count: ((_t = context.editor.open_files) === null || _t === void 0 ? void 0 : _t.length) || 0,
                    has_diagnostics: !!(((_u = context.editor.diagnostics) === null || _u === void 0 ? void 0 : _u.errors) || ((_v = context.editor.diagnostics) === null || _v === void 0 ? void 0 : _v.warnings) || ((_w = context.editor.diagnostics) === null || _w === void 0 ? void 0 : _w.infos))
                }
            };
            chunks.push(editorChunk);
        }
        // Chunk 7: Extensions
        if (context.extensions) {
            var extensionsChunk = {
                id: "".concat(contextId, "-extensions"),
                content: this.createExtensionsContent(context.extensions),
                metadata: {
                    chunk_type: 'extensions_info',
                    source: 'vscode_context',
                    content_type: 'extensions_info',
                    installed_count: ((_x = context.extensions.installed) === null || _x === void 0 ? void 0 : _x.length) || 0,
                    recommended_count: ((_y = context.extensions.recommended) === null || _y === void 0 ? void 0 : _y.length) || 0,
                    category_count: Object.keys(context.extensions.categories || {}).length
                }
            };
            chunks.push(extensionsChunk);
        }
        return chunks;
    };
    /**
     * Indexe les chunks dans le vector store
     */
    VSCodeContextManager.prototype.indexChunksInVectorStore = function (chunks) {
        return __awaiter(this, void 0, void 0, function () {
            var indexedCount, _i, chunks_1, chunk, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        indexedCount = 0;
                        _i = 0, chunks_1 = chunks;
                        _a.label = 1;
                    case 1:
                        if (!(_i < chunks_1.length)) return [3 /*break*/, 6];
                        chunk = chunks_1[_i];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        // Utiliser les propriétés d'EmbedAndStoreOptions pour stocker les métadonnées
                        return [4 /*yield*/, (0, vector_store_js_1.embedAndStore)(this.projectPath, chunk.id, chunk.content, {
                                contentType: chunk.metadata.content_type || 'other',
                                language: 'typescript',
                                role: chunk.metadata.chunk_type,
                                fileExtension: '.txt' // Extension fictive pour le contexte
                            })];
                    case 3:
                        // Utiliser les propriétés d'EmbedAndStoreOptions pour stocker les métadonnées
                        _a.sent();
                        indexedCount++;
                        return [3 /*break*/, 5];
                    case 4:
                        error_2 = _a.sent();
                        logger_js_1.logger.warn('vscode.context.chunk.index.error', 'Erreur lors de l\'indexation d\'un chunk', {
                            chunkId: chunk.id,
                            error: error_2.message
                        });
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/, indexedCount];
                }
            });
        });
    };
    /**
     * Crée le contenu pour les métadonnées
     */
    VSCodeContextManager.prototype.createMetadataContent = function (context) {
        var _a, _b;
        var lines = [];
        lines.push('# Contexte VS Code - Métadonnées');
        lines.push('');
        if (context.metadata) {
            lines.push('## Informations système');
            lines.push("- Timestamp: ".concat(context.metadata.timestamp || new Date().toISOString()));
            if (context.metadata.vscode_version)
                lines.push("- VS Code version: ".concat(context.metadata.vscode_version));
            if (context.metadata.extension_version)
                lines.push("- Extension version: ".concat(context.metadata.extension_version));
            if (context.metadata.os)
                lines.push("- Syst\u00E8me d'exploitation: ".concat(context.metadata.os));
            if (context.metadata.language)
                lines.push("- Langue: ".concat(context.metadata.language));
            if (context.metadata.timezone)
                lines.push("- Fuseau horaire: ".concat(context.metadata.timezone));
        }
        lines.push('');
        lines.push('## Présence des données');
        lines.push("- Workspace: ".concat(context.workspace ? 'Oui' : 'Non'));
        lines.push("- Configuration: ".concat(context.configuration ? 'Oui' : 'Non'));
        lines.push("- Git: ".concat(((_a = context.git) === null || _a === void 0 ? void 0 : _a.available) ? 'Oui' : 'Non'));
        lines.push("- Projet: ".concat(((_b = context.project) === null || _b === void 0 ? void 0 : _b.available) ? 'Oui' : 'Non'));
        lines.push("- \u00C9diteur: ".concat(context.editor ? 'Oui' : 'Non'));
        lines.push("- Extensions: ".concat(context.extensions ? 'Oui' : 'Non'));
        return lines.join('\n');
    };
    /**
     * Crée le contenu pour le workspace
     */
    VSCodeContextManager.prototype.createWorkspaceContent = function (workspace) {
        var _a;
        var lines = [];
        lines.push('# Contexte VS Code - Workspace');
        lines.push('');
        if (workspace === null || workspace === void 0 ? void 0 : workspace.root) {
            lines.push("## Racine du workspace");
            lines.push("- Chemin: ".concat(workspace.root));
            lines.push('');
        }
        if ((_a = workspace === null || workspace === void 0 ? void 0 : workspace.folders) === null || _a === void 0 ? void 0 : _a.length) {
            lines.push("## Dossiers du workspace (".concat(workspace.folders.length, ")"));
            workspace.folders.forEach(function (folder, index) {
                lines.push("".concat(index + 1, ". ").concat(folder.name, " \u2192 ").concat(folder.path));
            });
            lines.push('');
        }
        if (workspace === null || workspace === void 0 ? void 0 : workspace.workspace_file) {
            lines.push("## Fichier workspace");
            lines.push("- Chemin: ".concat(workspace.workspace_file));
        }
        return lines.join('\n');
    };
    /**
     * Crée le contenu pour la configuration
     */
    VSCodeContextManager.prototype.createConfigurationContent = function (configuration) {
        var _a;
        var lines = [];
        lines.push('# Contexte VS Code - Configuration');
        lines.push('');
        if (configuration === null || configuration === void 0 ? void 0 : configuration.settings) {
            lines.push('## Paramètres');
            if (configuration.settings.workspace)
                lines.push('- Workspace settings: Présents');
            if (configuration.settings.user)
                lines.push('- User settings: Présents');
            if (configuration.settings.default)
                lines.push('- Default settings: Présents');
            lines.push('');
        }
        if ((_a = configuration === null || configuration === void 0 ? void 0 : configuration.recommended_extensions) === null || _a === void 0 ? void 0 : _a.length) {
            lines.push("## Extensions recommand\u00E9es (".concat(configuration.recommended_extensions.length, ")"));
            configuration.recommended_extensions.forEach(function (ext, index) {
                lines.push("".concat(index + 1, ". ").concat(ext));
            });
            lines.push('');
        }
        if (configuration === null || configuration === void 0 ? void 0 : configuration.workspace_configuration) {
            lines.push('## Configuration workspace');
            var wc = configuration.workspace_configuration;
            lines.push("- Fichier settings.json: ".concat(wc.has_settings ? 'Présent' : 'Absent'));
            lines.push("- Fichier extensions.json: ".concat(wc.has_extensions_json ? 'Présent' : 'Absent'));
            if (wc.settings_path)
                lines.push("- Chemin settings.json: ".concat(wc.settings_path));
            if (wc.extensions_json_path)
                lines.push("- Chemin extensions.json: ".concat(wc.extensions_json_path));
        }
        return lines.join('\n');
    };
    /**
     * Crée le contenu pour Git
     */
    VSCodeContextManager.prototype.createGitContent = function (git) {
        var _a, _b, _c, _d;
        var lines = [];
        lines.push('# Contexte VS Code - Git');
        lines.push('');
        if (!(git === null || git === void 0 ? void 0 : git.available)) {
            lines.push('Git non disponible');
            if (git === null || git === void 0 ? void 0 : git.reason)
                lines.push("Raison: ".concat(git.reason));
            return lines.join('\n');
        }
        if (git.repository) {
            lines.push('## Repository');
            var repo = git.repository;
            if (repo.root)
                lines.push("- Racine: ".concat(repo.root));
            if (repo.head)
                lines.push("- Branche courante: ".concat(repo.head));
            if (repo.commit)
                lines.push("- Commit: ".concat(((_a = repo.commit) === null || _a === void 0 ? void 0 : _a.substring(0, 8)) || 'N/A'));
            if (repo.upstream)
                lines.push("- Upstream: ".concat(repo.upstream));
            if (repo.ahead || repo.behind)
                lines.push("- Ahead/Behind: ".concat(repo.ahead || 0, " ahead, ").concat(repo.behind || 0, " behind"));
            lines.push('');
        }
        if (git.status) {
            lines.push('## État des changements');
            var status_1 = git.status;
            lines.push("- Working changes: ".concat(status_1.working_changes || 0));
            lines.push("- Index changes: ".concat(status_1.index_changes || 0));
            lines.push("- Merge changes: ".concat(status_1.merge_changes || 0));
            lines.push("- Total changes: ".concat(status_1.total_changes || 0));
            lines.push('');
        }
        if (git.branches) {
            lines.push('## Branches');
            var branches = git.branches;
            if (branches.current)
                lines.push("- Branche courante: ".concat(branches.current));
            if ((_b = branches.local) === null || _b === void 0 ? void 0 : _b.length) {
                lines.push("- Branches locales (".concat(branches.local.length, "):"));
                branches.local.slice(0, 5).forEach(function (branch) { return lines.push("  * ".concat(branch)); });
                if (branches.local.length > 5)
                    lines.push("  * ... et ".concat(branches.local.length - 5, " autres"));
            }
            if ((_c = branches.remote) === null || _c === void 0 ? void 0 : _c.length) {
                lines.push("- Branches distantes (".concat(branches.remote.length, "):"));
                branches.remote.slice(0, 3).forEach(function (branch) { return lines.push("  * ".concat(branch)); });
                if (branches.remote.length > 3)
                    lines.push("  * ... et ".concat(branches.remote.length - 3, " autres"));
            }
            lines.push('');
        }
        if ((_d = git.remotes) === null || _d === void 0 ? void 0 : _d.length) {
            lines.push('## Remotes');
            git.remotes.forEach(function (remote, index) {
                lines.push("".concat(index + 1, ". ").concat(remote.name || 'unnamed', ":"));
                if (remote.fetch_url)
                    lines.push("   Fetch: ".concat(remote.fetch_url));
                if (remote.push_url)
                    lines.push("   Push: ".concat(remote.push_url));
            });
        }
        return lines.join('\n');
    };
    /**
     * Crée le contenu pour la structure projet
     */
    VSCodeContextManager.prototype.createProjectContent = function (project) {
        var _a, _b, _c;
        var lines = [];
        lines.push('# Contexte VS Code - Structure projet');
        lines.push('');
        if (!(project === null || project === void 0 ? void 0 : project.available)) {
            lines.push('Structure projet non disponible');
            if (project === null || project === void 0 ? void 0 : project.reason)
                lines.push("Raison: ".concat(project.reason));
            return lines.join('\n');
        }
        if (project.root) {
            lines.push("## Racine du projet");
            lines.push("- Chemin: ".concat(project.root));
            lines.push('');
        }
        if (project.project_type) {
            lines.push("## Type de projet");
            lines.push("- ".concat(project.project_type));
            lines.push('');
        }
        if ((_a = project.config_files) === null || _a === void 0 ? void 0 : _a.length) {
            lines.push("## Fichiers de configuration (".concat(project.config_files.length, ")"));
            project.config_files.forEach(function (file, index) {
                lines.push("".concat(index + 1, ". ").concat(file.name || 'unnamed', ":"));
                lines.push("   - Chemin: ".concat(file.path || 'N/A'));
                lines.push("   - Existe: ".concat(file.exists ? 'Oui' : 'Non'));
                if (file.content_preview) {
                    lines.push("   - Aper\u00E7u: ".concat(file.content_preview.substring(0, 100)).concat(file.content_preview.length > 100 ? '...' : ''));
                }
            });
            lines.push('');
        }
        if (project.structure) {
            lines.push('## Structure du projet');
            var structure = project.structure;
            lines.push("- Dossiers: ".concat(((_b = structure.directories) === null || _b === void 0 ? void 0 : _b.length) || 0));
            lines.push("- Fichiers: ".concat(((_c = structure.files) === null || _c === void 0 ? void 0 : _c.length) || 0));
            lines.push("- Total: ".concat(structure.total_items || 0));
            if (structure.file_types && Object.keys(structure.file_types).length > 0) {
                lines.push("- Types de fichiers:");
                Object.entries(structure.file_types).forEach(function (_a) {
                    var type = _a[0], count = _a[1];
                    lines.push("  * ".concat(type, ": ").concat(count));
                });
            }
            lines.push('');
        }
        if (project.package_info) {
            lines.push('## Informations package.json');
            lines.push(JSON.stringify(project.package_info, null, 2).substring(0, 500));
            if (JSON.stringify(project.package_info).length > 500)
                lines.push('...');
            lines.push('');
        }
        if (project.typescript_config) {
            lines.push('## Configuration TypeScript');
            lines.push(JSON.stringify(project.typescript_config, null, 2).substring(0, 500));
            if (JSON.stringify(project.typescript_config).length > 500)
                lines.push('...');
        }
        return lines.join('\n');
    };
    /**
     * Crée le contenu pour l'état éditeur
     */
    VSCodeContextManager.prototype.createEditorContent = function (editor) {
        var _a;
        var lines = [];
        lines.push('# Contexte VS Code - État éditeur');
        lines.push('');
        if (editor.active_file) {
            lines.push('## Fichier actif');
            var active = editor.active_file;
            lines.push("- Chemin: ".concat(active.path || 'N/A'));
            lines.push("- Langage: ".concat(active.language || 'N/A'));
            lines.push("- Lignes: ".concat(active.line_count || 'N/A'));
            if (active.selection) {
                lines.push("- S\u00E9lection: L".concat(active.selection.start_line || 0, ":C").concat(active.selection.start_column || 0, " \u00E0 L").concat(active.selection.end_line || 0, ":C").concat(active.selection.end_column || 0));
            }
            lines.push('');
        }
        if ((_a = editor.open_files) === null || _a === void 0 ? void 0 : _a.length) {
            lines.push("## Fichiers ouverts (".concat(editor.open_files.length, ")"));
            editor.open_files.slice(0, 10).forEach(function (file, index) {
                lines.push("".concat(index + 1, ". ").concat(file.path || 'N/A', " (").concat(file.language || 'N/A', ")").concat(file.is_active ? ' [ACTIF]' : ''));
            });
            if (editor.open_files.length > 10) {
                lines.push("... et ".concat(editor.open_files.length - 10, " autres fichiers"));
            }
            lines.push('');
        }
        if (editor.diagnostics) {
            lines.push('## Diagnostics');
            var diag = editor.diagnostics;
            lines.push("- Erreurs: ".concat(diag.errors || 0));
            lines.push("- Avertissements: ".concat(diag.warnings || 0));
            lines.push("- Informations: ".concat(diag.infos || 0));
            lines.push("- Total: ".concat((diag.errors || 0) + (diag.warnings || 0) + (diag.infos || 0)));
        }
        return lines.join('\n');
    };
    /**
     * Crée le contenu pour les extensions
     */
    VSCodeContextManager.prototype.createExtensionsContent = function (extensions) {
        var _a, _b;
        var lines = [];
        lines.push('# Contexte VS Code - Extensions');
        lines.push('');
        if ((_a = extensions.installed) === null || _a === void 0 ? void 0 : _a.length) {
            lines.push("## Extensions install\u00E9es (".concat(extensions.installed.length, ")"));
            extensions.installed.slice(0, 15).forEach(function (ext, index) {
                lines.push("".concat(index + 1, ". ").concat(ext.name || 'unnamed', " (").concat(ext.id || 'N/A', ")"));
                lines.push("   - Version: ".concat(ext.version || 'N/A'));
                lines.push("   - \u00C9diteur: ".concat(ext.publisher || 'N/A'));
                lines.push("   - Activ\u00E9e: ".concat(ext.enabled ? 'Oui' : 'Non'));
            });
            if (extensions.installed.length > 15) {
                lines.push("... et ".concat(extensions.installed.length - 15, " autres extensions"));
            }
            lines.push('');
        }
        if ((_b = extensions.recommended) === null || _b === void 0 ? void 0 : _b.length) {
            lines.push("## Extensions recommand\u00E9es (".concat(extensions.recommended.length, ")"));
            extensions.recommended.forEach(function (ext, index) {
                lines.push("".concat(index + 1, ". ").concat(ext));
            });
            lines.push('');
        }
        if (extensions.categories && Object.keys(extensions.categories).length > 0) {
            lines.push('## Catégories d\'extensions');
            Object.entries(extensions.categories).forEach(function (_a) {
                var category = _a[0], count = _a[1];
                lines.push("- ".concat(category, ": ").concat(count));
            });
        }
        return lines.join('\n');
    };
    return VSCodeContextManager;
}());
/**
 * Définition de l'outil MCP pour stocker le contexte VS Code
 */
exports.vscodeContextTool = {
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
};
/**
 * Handler pour l'outil MCP de stockage de contexte VS Code
 */
var vscodeContextHandler = function (args) { return __awaiter(void 0, void 0, void 0, function () {
    var context, manager, result, error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                context = args.context;
                if (!context) {
                    throw new Error('Le paramètre "context" est requis');
                }
                manager = new VSCodeContextManager();
                return [4 /*yield*/, manager.storeContext(context)];
            case 1:
                result = _a.sent();
                return [2 /*return*/, {
                        success: result.success,
                        context_id: result.context_id,
                        chunks_created: result.chunks_created,
                        indexed_at: result.indexed_at,
                        message: result.success
                            ? "Contexte VS Code stock\u00E9 avec succ\u00E8s (".concat(result.chunks_created, " chunks)")
                            : 'Échec du stockage du contexte VS Code'
                    }];
            case 2:
                error_3 = _a.sent();
                return [2 /*return*/, {
                        success: false,
                        context_id: "error-".concat(Date.now()),
                        chunks_created: 0,
                        indexed_at: new Date().toISOString(),
                        error: error_3.message,
                        stack: error_3.stack
                    }];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.vscodeContextHandler = vscodeContextHandler;
/**
 * Fonction utilitaire pour tester l'outil
 */
function testVSCodeContextTool() {
    return __awaiter(this, void 0, void 0, function () {
        var testContext, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    testContext = {
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
                    return [4 /*yield*/, (0, exports.vscodeContextHandler)({ context: testContext })];
                case 1:
                    result = _a.sent();
                    console.log('Test result:', result);
                    return [2 /*return*/];
            }
        });
    });
}
// Exécution du test si ce fichier est exécuté directement
// Note: import.meta n'est pas disponible en CommonJS, donc on utilise une vérification alternative
if (typeof require !== 'undefined' && require.main === module) {
    testVSCodeContextTool().catch(console.error);
}
