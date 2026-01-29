# RAG MCP Extension for VS Code

A VS Code extension for interacting with RAG MCP Server.

## Features

- **Dashboard**: Interactive dashboard showing RAG system status
- **Initialize RAG Projects**: Initialize RAG infrastructure for any project
- **Activate RAG Pipeline**: Run RAG pipeline with different modes (full, incremental, analyze_only, watch)
- **Query RAG**: Semantic search across indexed files with advanced filters
- **System Status**: Get real-time status of RAG MCP Server

## Commands

| Command                           | Description                      |
| --------------------------------- | -------------------------------- |
| `RAG MCP: Show Dashboard`         | Opens interactive dashboard      |
| `RAG MCP: Initialize RAG Project` | Initialize RAG for a project     |
| `RAG MCP: Activate RAG Pipeline`  | Run RAG pipeline on a project    |
| `RAG MCP: Query RAG`              | Semantic search in indexed files |
| `RAG MCP: Get System Status`      | Get RAG system status            |

## Configuration

Configure the extension in VS Code settings:

```json
{
  "rag-mcp.serverUrl": "ws://localhost:3000",
  "rag-mcp.timeout": 30000,
  "rag-mcp.autoRefresh": true
}
```

## Development

### Prerequisites

- Node.js 18+
- VS Code 1.96+

### Setup

```bash
cd extension-rag
npm install
npm run compile
```

### Debug

1. Open this folder in VS Code
2. Press F5 to start debugging
3. Use the "Run Extension" configuration

### Package for Distribution

```bash
npm run package
```

## Architecture

- `src/extension.ts` - Main entry point
- `src/services/McpClient.ts` - MCP WebSocket client
- `package.json` - Extension manifest
- `tsconfig.json` - TypeScript configuration

## License

MIT
