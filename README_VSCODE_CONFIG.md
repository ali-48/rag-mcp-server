# 🚀 RAG MCP Server - VS Code Configuration Guide

**Version:** 1.0.0 | **Last Updated:** 2026-01-16

## 📋 Overview

This guide explains how to set up and use the optimized VS Code configuration for RAG MCP Server development. The configuration includes:

- **Extensions** categorized by importance (Essential, Recommended, Optional)
- **Database connections** for SQLite and PostgreSQL
- **Tasks** for RAG pipeline operations (ingest, index, query)
- **Debug configurations** for Node.js and tests
- **Scripts** for automated setup and database initialization

## 🎯 Quick Start

### 1. Clone and Open Workspace

```bash
git clone <repository-url>
cd rag-mcp-server
code rag-mcp-server.code-workspace
```

### 2. Install Extensions (Automatic)

Run the installation script:

```bash
chmod +x .vscode/install-extensions.sh
./.vscode/install-extensions.sh
```

Or install manually from `.vscode/extensions.json`.

### 3. Initialize Databases

```bash
chmod +x .vscode/init-databases.sh
./.vscode/init-databases.sh
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Build and Run

```bash
npm run build
npm run dev
```

## 🔧 Extension Categories

### Level 1 - Essential (Always Enabled)

- **ESLint** (`dbaeumer.vscode-eslint`) - JavaScript/TypeScript linting
- **Prettier** (`esbenp.prettier-vscode`) - Code formatting
- **GitLens** (`eamodio.gitlens`) - Git visualization
- **MCP Extension** (`block.vscode-mcp-extension`) - Model Context Protocol support
- **SQLTools** (`mtxr.sqltools`) - Database management
- **EditorConfig** (`editorconfig.editorconfig`) - Code style consistency
- **YAML** (`redhat.vscode-yaml`) - YAML language support

### Level 2 - Recommended (Enabled by Default)

- **npm Intellisense** - Auto-complete npm modules
- **PostgreSQL** - PostgreSQL database management
- **Redis** - Redis database management
- **Project Manager** - Easy project switching
- **Code Spell Checker** - Spelling verification
- **Error Lens** - Inline error display
- **Pretty TypeScript Errors** - Better error messages
- **IntelliCode** - AI-assisted development
- **Todo Tree** - TODO management
- **Better Comments** - Comment highlighting
- **Even Better TOML** - TOML language support

### Level 3 - Optional (Enable as Needed)

- **Docker** - Container management
- **GitHub Pull Requests** - GitHub integration
- **Git Graph** - Git visualization
- **MySQL** - MySQL database client

## 🗄️ Database Configuration

### SQLite Connections (Auto-configured)

1. **RAG Memory SQLite** - `rag/db/memory/rag_memory.sqlite`
   - Stores conversation history and context
2. **RAG Vectors SQLite** - `rag/db/vector/rag_vectors.sqlite`
   - Stores vector embeddings and search index
3. **Test Database** - `rag/db/sqlite/test.db`
   - Copy of project test database

### PostgreSQL (Optional)

- **Configuration**: `config/postgres-config.json`
- **Initialization**: `scripts/init-postgres.sql`
- **Default**: `localhost:5432/rag_db` (user: `rag_user`, password: `rag_password`)

### Accessing Databases in VS Code

1. Open Command Palette (`Ctrl+Shift+P`)
2. Search for "SQLTools: Focus on Connections"
3. Select a database connection
4. Run SQL queries directly in VS Code

## ⚡ RAG Pipeline Tasks

### Available Tasks (F1 → Tasks: Run Task)

| Task                          | Command                             | Description                    |
| ----------------------------- | ----------------------------------- | ------------------------------ |
| **RAG: Ingest Documents**     | `node build/index.js --mode=ingest` | Ingest documents into pipeline |
| **RAG: Index Vectors**        | `node build/index.js --mode=index`  | Create vector embeddings       |
| **RAG: Query**                | `node build/index.js --mode=query`  | Semantic search query          |
| **RAG: Clean Cache**          | `rm -rf rag/cache rag/temp`         | Clean temporary files          |
| **RAG: Initialize Databases** | `./.vscode/init-databases.sh`       | Setup databases                |
| **RAG: Monitor Logs**         | `tail -f logs/rag-server.log`       | Real-time log monitoring       |

### Keyboard Shortcuts

- `Ctrl+Shift+B` - Build project
- `Ctrl+Shift+T` - Run tests
- `F5` - Start debugging
- `Ctrl+Shift+P` → "Tasks: Run Task" - Run any task

## 🐛 Debugging

### Available Debug Configurations

1. **Debug RAG MCP Server**

   - TypeScript source maps enabled
   - Auto-restart on changes
   - Environment variables: `NODE_ENV=development`, `DEBUG=rag-mcp-server:*`

2. **Debug Tests Vitest**

   - Breakpoints in test files
   - Watch mode support
   - Environment: `NODE_ENV=test`

3. **Attach to Node Process**
   - Attach to running Node.js process on port 9229
   - Useful for production debugging

### Debug Workflow

1. Set breakpoints in TypeScript files
2. Press `F5` to start debugging
3. Use Debug Console for evaluation
4. Check Variables panel for state inspection

## 📊 Monitoring and Logs

### Log Files Location

- **Application Logs**: `logs/rag-server.log`
- **Error Logs**: `logs/error.log`
- **Database Logs**: `logs/db.log`

### Real-time Monitoring

```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: Monitor logs
tail -f logs/rag-server.log

# Terminal 3: Monitor errors
tail -f logs/error.log
```

### VS Code Log Viewer

1. Open Output panel (`Ctrl+Shift+U`)
2. Select "RAG MCP Server" from dropdown
3. View real-time server output

## 🔄 Version Control and Reproducibility

### Lock Files

- **`.vscode/extensions.lock.json`** - Exact extension versions
- **`package-lock.json`** - npm dependencies
- **`rag/db/schema/*.sql`** - Database schemas

### Reproducing Environment

```bash
# 1. Install extensions from lock file
./.vscode/install-extensions.sh

# 2. Initialize databases
./.vscode/init-databases.sh

# 3. Install npm dependencies
npm ci  # Uses package-lock.json

# 4. Apply database schemas
sqlite3 rag/db/memory/rag_memory.sqlite < rag/db/memory/rag_memory_schema.sql
sqlite3 rag/db/vector/rag_vectors.sqlite < rag/db/vector/rag_vectors_schema.sql
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Extensions Not Installing

```bash
# Check VS Code installation
code --version

# Install manually
code --install-extension <extension-id>
```

#### 2. Database Connection Issues

```bash
# Check SQLite installation
sqlite3 --version

# Create missing directories
mkdir -p rag/db/{memory,vector,sqlite}
```

#### 3. TypeScript Errors

```bash
# Clean and rebuild
npm run clean
npm run build

# Check TypeScript version
npx tsc --version
```

#### 4. RAG Pipeline Errors

```bash
# Check configuration
cat config/rag-config.json

# Run with verbose logging
node build/index.js --mode=full --verbose
```

### Getting Help

1. Check `VSCODE_CONFIGURATION_RAG_MCP.md` for detailed configuration
2. Review `CONTRIBUTING.md` for development guidelines
3. Check GitHub Issues for known problems
4. Enable debug logging: `DEBUG=rag-mcp-server:* npm run dev`

## 📈 Performance Optimization

### VS Code Settings

- **TypeScript Memory**: Increased to 4GB (`typescript.tsserver.maxTsServerMemory`)
- **File Watching**: Optimized for large projects
- **Exclusions**: Node modules, build directories excluded from search

### RAG Pipeline

- **Incremental Indexing**: Only process changed files
- **Cache Layer**: SQLite-based caching for embeddings
- **Batch Processing**: Parallel document processing

### Database Optimization

- **SQLite WAL Mode**: Write-Ahead Logging for better concurrency
- **Indexes**: Optimized indexes for common queries
- **Connection Pooling**: PostgreSQL connection reuse

## 🔒 Security Considerations

### Disabled Features

- **GitHub Copilot**: Disabled for offline/secure development
- **Telemetry**: All telemetry disabled
- **Auto-updates**: Controlled update schedule

### Secure Configuration

- **No hardcoded secrets** in configuration files
- **Environment variables** for sensitive data
- **SQLite file permissions** set to user-only access
- **PostgreSQL SSL** support configured

### Audit Commands

```bash
# Security audit
npm audit

# Dependency check
npx depcheck

# License compliance
npx license-checker
```

## 📚 Additional Resources

### Documentation

- **Project Docs**: `docs/` directory
- **API Reference**: `docs/api/` (generated via `npm run docs`)
- **Configuration Guide**: `VSCODE_CONFIGURATION_RAG_MCP.md`

### Useful Commands

```bash
# Format all code
npm run format

# Lint and fix
npm run lint:fix

# Run all tests
npm test

# Build for production
npm run build:prod

# Generate documentation
npm run docs
```

### VS Code Tips

- Use `Ctrl+Shift+P` for command palette
- `Ctrl+` to toggle sidebar
- `Ctrl+B` to toggle file explorer
- `Ctrl+Shift+E` for search across files

---

## 🎉 Configuration Complete

Your VS Code environment is now fully configured for RAG MCP Server development with:

✅ **Optimized extensions** for TypeScript/Node.js development
✅ **Database connections** for SQLite and PostgreSQL
✅ **RAG pipeline tasks** for ingest, index, and query operations
✅ **Debug configurations** for server and tests
✅ **Automated scripts** for setup and initialization
✅ **Comprehensive documentation** for troubleshooting

**Next Steps:**

1. Explore the workspace settings in `.vscode/`
2. Try running a RAG pipeline task
3. Connect to a database using SQLTools
4. Set breakpoints and start debugging

Happy coding! 🚀
