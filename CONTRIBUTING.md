# Guide de Contribution - RAG MCP Server

## 📋 Checklist de Validation Avant Commit

Avant de soumettre un commit, vérifiez que votre code respecte les **10 règles absolues** d'architecture définies dans `RAG_ARCHITECTURE_RULES.md` (v3.0.0).

### ✅ Checklist Complète (10 Règles)

#### Règle 1 : Séparation stricte des responsabilités

- [ ] `init_rag` ne fait que de l'initialisation (pas d'exécution RAG)
- [ ] `activated_rag` ne crée pas de fichiers système
- [ ] Chaque module a une responsabilité unique et claire

#### Règle 2 : JSON strict ou rien

- [ ] Toutes les réponses MCP sont en JSON strict
- [ ] Aucun `console.log` dans le code de production
- [ ] Les logs humains vont vers `rag.log`, pas vers `stdout`

#### Règle 3 : Pipeline RAG immuable

- [ ] L'ordre du pipeline est respecté : Scan → Filtrage → Analyse → Chunking → Embeddings → Indexation → Retrieval
- [ ] Les guards (`requireInit`, `requireScan`, etc.) garantissent l'ordre

#### Règle 4 : Backend configurable uniquement

- [ ] Aucun backend hardcodé (pas de `if (postgres)` dans le code)
- [ ] Le backend est choisi uniquement via configuration (`rag-config-v3.json`)
- [ ] SQLite est le fallback par défaut

#### Règle 5 : État explicite et observable

- [ ] `state.json` est présent dans `/rag/` et à jour
- [ ] `ProgressTracker` est utilisé pour toute tâche longue
- [ ] Les checkpoints sont activés pour les opérations longues

#### Règle 6 : Aucune duplication de code

- [ ] Aucun doublon de fichier créé
- [ ] Les fichiers similaires ont été fusionnés
- [ ] Les fichiers obsolètes sont archivés avec suffixe `.backup`

#### Règle 7 : Minimalisme MCP

- [ ] Les outils MCP sont limités aux 5 essentiels : `activated_rag`, `get_status`, `query_rag`, `init_rag`, `cancel_task`
- [ ] Aucun outil redondant n'est exposé
- [ ] Les outils internes sont masqués (`hidden: true`)

#### Règle 8 : Messages IA-first

- [ ] Toutes les réponses MCP incluent `notes_for_ai`
- [ ] Toutes les réponses MCP incluent `allowed_actions`
- [ ] Toutes les réponses MCP incluent `next_steps`

#### Règle 9 : Configuration unique v3

- [ ] Tous les outils lisent `rag-config-v3.json`
- [ ] Aucune configuration éparpillée dans multiple fichiers
- [ ] Aucun hardcoding de valeurs configurables

#### Règle 10 : Schémas MCP complets

- [ ] Tous les outils ont des schémas input/output dans `mcp-schemas.ts`
- [ ] Les schémas sont validés par les tests (`npm run test:mcp-schemas`)
- [ ] Les schémas incluent des exemples valides

### 🧪 Tests Automatisés

Exécutez les tests de validation avant de soumettre :

```bash
# Vérification JSON strict
npm run test:json-strict

# Vérification séparation responsabilités
npm run test:responsibilities

# Vérification pipeline ordre
npm run test:pipeline-order

# Vérification backend configurable
npm run test:backend-config

# Vérification absence de doublons
npm run test:no-duplicates

# Vérification messages IA-first
npm run test:ia-first-messages

# Vérification schémas MCP
npm run test:mcp-schemas

# Tous les tests
npm test
```

### 🔍 Vérifications Supplémentaires

- [ ] Aucune référence brisée aux fichiers archivés
- [ ] Tous les imports sont à jour
- [ ] La documentation est mise à jour
- [ ] Les changements sont documentés dans le CHANGELOG

### 📚 Documentation des Règles

Pour plus de détails sur chaque règle, consultez :

- [Règles d'architecture RAG MCP Server](./RAG_ARCHITECTURE_RULES.md) (10 règles complètes)
- [Règles d'exécution RAG asynchrone](./RAG_EXECUTION_RULES.md)
- [Guide nouveaux outils V2](./GUIDE-NOUVEAUX-OUTILS-V2.md)

### 🚨 Conséquences des Violations

Les violations des règles peuvent entraîner :

- **Instabilité** : Crash MCP, résultats incorrects
- **Non-scalabilité** : Impossible migration, timeout systématique
- **Incohérence structurelle** : Maintenance impossible
- **Échec gouvernance** : Perte de confiance dans le système

### 🤝 Processus de Contribution

1. **Planifier** : Utiliser le workflow défini dans `.clinerules/workflows/Workflow_Développement_RAG-MCP-Server.md`
2. **Développer** : Respecter les 10 règles d'architecture
3. **Tester** : Exécuter tous les tests automatisés
4. **Vérifier** : Utiliser cette checklist avant commit
5. **Documenter** : Mettre à jour la documentation associée
6. **Soumettre** : Créer une Pull Request avec description détaillée

### 📞 Support

Pour toute question sur les règles ou le processus de contribution :

- Consultez la documentation complète
- Ouvrez une issue sur GitHub
- Contactez l'équipe de maintenance

---

**Dernière mise à jour** : 16/01/2026  
**Version** : 1.0.0  
**Aligné avec** : RAG_ARCHITECTURE_RULES.md v3.0.0
