# MCP Context Pipeline

Pipeline MCP pour réception et traitement des événements VS Code en temps réel.

## 📋 Description

Ce pipeline reçoit les événements VS Code capturés passivement par l'extension, les valide, les enrichit, les stocke dans SQLite et les indexe dans le RAG Server.

## 🏗️ Architecture

```
VS Code Extension (capture passive)
        ↓
MCP Tool: receive-vscode-context
        ↓
Validation JSON Schema (Ajv)
        ↓
Normalisation technique
        ↓
Enrichissement (fichiers, erreurs)
        ↓
Stockage SQLite (events, files, errors, audit_log)
        ↓
Indexation différée dans RAG Server
```

## 📁 Structure des dossiers

```
mcp-context-pipeline/
├── src/
│   ├── tools/              # Outils MCP
│   ├── validators/         # Validation JSON Schema
│   ├── normalizers/        # Normalisation technique
│   ├── enrichers/          # Enrichissement données
│   ├── storage/           # DAO SQLite
│   └── utils/             # Utilitaires
├── sql/                   # Scripts SQL
├── package.json          # Dépendances
├── tsconfig.json        # Configuration TypeScript
└── jest.config.js       # Configuration tests
```

## 🚀 Installation

```bash
cd mcp-context-pipeline
npm install
npm run build
```

## 🧪 Tests

```bash
npm test
npm run test:coverage
```

## 📊 Base de données

Le schéma SQL est défini dans `sql/schema.sql` :

- `events` : Événements VS Code capturés
- `files` : Fichiers suivis avec hash
- `errors` : Erreurs système et métier
- `audit_log` : Journal d'audit complet

## 🔧 Configuration

Copier `.env.example` vers `.env` et configurer :

```env
NODE_ENV=development
DATABASE_PATH=./data/context.db
LOG_LEVEL=info
RAG_SERVER_URL=http://localhost:3000
```

## 📄 Licence

MIT
