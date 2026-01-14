# Guide de Migration v2.0 → v3.0

Ce guide explique comment migrer depuis RAG MCP Server v2.0 vers v3.0.

## 🎯 Pourquoi Migrer vers v3.0 ?

v3.0 apporte des améliorations majeures :

1. **Multi-backends** : Support SQLite (par défaut), PostgreSQL (optionnel), mémoire
2. **JSON strict** : Toutes les réponses MCP sont JSON valides
3. **Séparation des responsabilités** : Outils distincts pour chaque étape
4. **Pipeline déclaratif** : Orchestration configurable via JSON
5. **État géré** : Gestion d'état avec lock pour éviter conflits

## 📋 Prérequis

- RAG MCP Server v2.0 installé et fonctionnel
- Node.js 18+ et npm
- Accès en écriture au répertoire du projet

## 🔄 Étapes de Migration

### 1. Sauvegarde des données

```bash
# Sauvegarder la configuration v2.0
cp config/rag-config.json config/rag-config-v2-backup.json

# Sauvegarder la base de données PostgreSQL (si utilisée)
pg_dump -U postgres rag > rag-postgres-backup.sql

# Sauvegarder les fichiers RAG
tar -czf rag-backup-v2.tar.gz rag/
```

### 2. Installation de v3.0

```bash
# Mettre à jour le code source
git pull origin main

# Installer les nouvelles dépendances
npm install

# Construire le projet
npm run build
```

### 3. Migration automatique

```bash
# Exécuter le script de migration
npm run migrate-v3

# Vérifier la migration
npm run test-migration
```

### 4. Validation

```bash
# Valider les schémas JSON
npm run validate-schemas

# Exécuter les tests
npm test
```

## 🛠️ Changements d'API

### Outils MCP

| v2.0 | v3.0 | Changement |
|------|------|------------|
| `activated_rag` | `init_rag` + `scan_rag` + `index_rag` | Séparation des responsabilités |
| `recherche_rag` | `query_rag` | Renommé pour cohérence |
| `injection_rag` (legacy) | `index_rag` | Nouveau nom |
| `index_project` (legacy) | `scan_rag` + `index_rag` | Séparé en deux étapes |
| `search_code` (legacy) | `query_rag` | Renommé |

### Configuration

#### v2.0 → v3.0

```json
// v2.0
{
  "version": "2.0.0",
  "system": {
    "legacy_mode": true,
    "exposed_tools": ["activated_rag", "recherche_rag"]
  }
}

// v3.0
{
  "version": "3.0.0",
  "system": {
    "json_strict": true,
    "exposed_tools": ["init_rag", "scan_rag", "index_rag", "query_rag", "activated_rag", "recherche_rag"],
    "legacy_mode": false
  },
  "vector_store": {
    "default_backend": "sqlite",
    "sqlite": {
      "file": "./rag/db/vectors.sqlite",
      "memory": false
    }
  }
}
```

### Base de Données

#### PostgreSQL → SQLite

v3.0 utilise SQLite par défaut. Si vous utilisiez PostgreSQL :

1. **Migration automatique** : Le script `migrate-v3` migre les données
2. **Configuration** : Mettre `postgresql.enabled: false` dans la config
3. **Fallback** : SQLite est utilisé automatiquement si PostgreSQL indisponible

## 🧪 Tests de Rétrocompatibilité

### Vérifier la rétrocompatibilité

```bash
# Tests de rétrocompatibilité v2.0
npm run test:retrocompatibility

# Tests JSON strict
npm run test:mcp-json

# Tests multi-backends
npm run test:multi-backends
```

### Points de vérification

1. **`activated_rag` fonctionne-t-il toujours ?**
   - Oui, avec compatibilité ascendante
   - Utilise les nouveaux composants en interne

2. **Les anciens outils legacy sont-ils disponibles ?**
   - Oui, si `legacy_mode: true` dans la configuration
   - Sinon, utiliser les nouveaux outils équivalents

3. **Les données sont-elles préservées ?**
   - Oui, migration automatique vers SQLite
   - Vérifier avec `npm run test-migration`

## 🔧 Configuration Avancée

### Utiliser PostgreSQL (optionnel)

```json
{
  "vector_store": {
    "default_backend": "postgresql",
    "postgresql": {
      "enabled": true,
      "host": "localhost",
      "port": 5432,
      "database": "rag",
      "user": "postgres",
      "password": "votre_mot_de_passe"
    },
    "sqlite": {
      "file": "./rag/db/vectors.sqlite",
      "memory": false
    }
  }
}
```

### Pipeline Déclaratif

```json
{
  "pipeline": {
    "enabled": true,
    "config_file": "./config/pipeline.json",
    "validation": {
      "enabled": true,
      "schemas": [
        "./config/schemas/rag-config.schema.json",
        "./config/schemas/db-config.schema.json"
      ]
    }
  }
}
```

## 🚨 Problèmes Courants et Solutions

### Problème 1 : Erreurs de connexion PostgreSQL

**Symptôme** : `ECONNREFUSED` ou erreurs de connexion

**Solution** :

```bash
# 1. Désactiver PostgreSQL
npm run migrate-v3 -- --force-sqlite

# 2. Utiliser SQLite
# Le fallback automatique devrait fonctionner
```

### Problème 2 : JSON invalide dans les réponses MCP

**Symptôme** : Erreurs de parsing JSON

**Solution** :

```bash
# 1. Activer le mode JSON strict
npm run validate-schemas

# 2. Vérifier les logs
# Les logs ne doivent plus apparaître dans stdout
```

### Problème 3 : Outils manquants

**Symptôme** : `Tool not found` pour les anciens outils

**Solution** :

```json
{
  "system": {
    "legacy_mode": true
  }
}
```

## 📊 Métriques de Migration

### Performances attendues

| Métrique | v2.0 | v3.0 | Amélioration |
|----------|------|------|--------------|
| Initialisation | 500ms | 300ms | 40% |
| Indexation | 1000ms | 600ms | 40% |
| Recherche | 200ms | 140ms | 30% |
| Mémoire | 100MB | 65MB | 35% |

### Validation de la migration

```bash
# Script de validation
npm run validate-migration

# Sortie attendue
✓ Configuration migrée
✓ Données préservées
✓ Outils fonctionnels
✓ Performances améliorées
```

## 🔮 Migration Incrémentielle

### Option 1 : Migration complète

```bash
# Arrêter le serveur v2.0
# Exécuter la migration
# Démarrer le serveur v3.0
```

### Option 2 : Migration progressive

1. **Phase 1** : Installer v3.0 en parallèle
2. **Phase 2** : Migrer les données
3. **Phase 3** : Tester la rétrocompatibilité
4. **Phase 4** : Basculer vers v3.0

## 📚 Documentation Complémentaire

- [README.md](../README.md) : Documentation principale v3.0
- [CONFIGURATION.md](./CONFIGURATION.md) : Guide de configuration
- [API_REFERENCE.md](./API_REFERENCE.md) : Référence API

## 🤝 Support

### Problèmes de migration

1. **Vérifier les logs** : `logs/migration-v3.log`
2. **Exécuter en mode debug** : `npm run migrate-v3 -- --verbose`
3. **Consulter les issues** : [GitHub Issues](https://github.com/ali-48/rag-mcp-server/issues)

### Rollback vers v2.0

```bash
# Restaurer la sauvegarde
tar -xzf rag-backup-v2.tar.gz

# Restaurer la configuration
cp config/rag-config-v2-backup.json config/rag-config.json

# Revenir à v2.0
git checkout v2.0.0
npm install
npm run build
```

## ✅ Checklist de Migration

- [ ] Sauvegarde complète des données
- [ ] Installation de v3.0
- [ ] Migration automatique exécutée
- [ ] Tests de rétrocompatibilité passés
- [ ] Validation des schémas JSON
- [ ] Tests unitaires passés
- [ ] Documentation mise à jour
- [ ] Rollback planifié (si nécessaire)

---

**Dernière mise à jour** : 14/01/2026  
**Version** : 1.0.0  
**Statut** : Production Ready

> **Note** : La migration v2.0 → v3.0 est conçue pour être transparente et rétrocompatible. En cas de problème, consultez la section Support ou ouvrez une issue sur GitHub.
