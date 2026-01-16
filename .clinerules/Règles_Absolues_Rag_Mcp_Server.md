# 📜 Règles absolues compressées — RAG MCP Server

> Version: 3.0.0 | Dernière mise à jour: 2026-01-16

---

## 🔹 R1 : Base décisionnelle immuable

- Toutes décisions = règles existantes
- Modif règles → validation Conseil d'Architecture
- Processus : proposition → analyse → review → implémentation → doc

## 🔹 R2 : Séparation des responsabilités

| Module       | Rôle                     | Interdit                   |
| ------------ | ----------------------- | -------------------------- |
| init_rag     | Initialisation projet    | Exécution RAG              |
| activated_rag| Pipeline RAG             | Création fichiers          |
| MCP Server   | Orchestration            | Log texte stdout           |
| LLM          | Raisonnement             | Accès direct fichiers      |

## 🔹 R3 : JSON strict

- ✅ JSON pur pour MCP (`result`, `status`…)  
- ❌ Pas d’icônes ni décorations dans JSON métier  
- ✅ Icônes seulement dans
- ✅ Logs humains séparés (`stderr` ou `rag.log`)

## 🔹 R4 : Architecture RAG standard

- `/rag/db/` : SQLite / vecteurs  
- `/rag/config/` : JSON configs  
- `/rag/logs/` : logs structurés  
- `.ragignore`, `state.json` obligatoire  
- `init_rag` = création, config, DB  
- `activated_rag` = pipeline complet  
- Pipeline RAG : Scan → Filtrage → Analyse → Chunking → Embedding → Indexation → Retrieval

## 🔹 R5 : Backend configurable uniquement

- Default SQLite local  
- PostgreSQL / Pinecone / Weaviate / Qdrant optionnel via config  
- ❌ Pas de hardcode DB  

## 🔹 R6 : LLM & MCP

- LLM = pas d’accès direct aux fichiers  
- Analyse fichier → outil MCP  
- Minimalisme MCP : max 5 outils essentiels  
- Messages IA-first obligatoires  
- Schémas input/output validés

## 🔹 R7 : Usage unique des commandes MCP

- `init_rag` & `activated_rag` = 1 seule exécution  
- Répétition = `command_already_executed`

## 🔹 R8 : Ordre / Séquence outils MCP

1. init_rag → 1 fois  
2. activated_rag → 1 fois  
3. get_status → illimité  
4. query_rag → illimité  
5. cancel_task → optionnel  

- Validation ordre automatique avant exécution  

## 🔹 R9 : Processus background sans timeout

- ❌ Pas de setTimeout / AbortController / kill  
- ✅ Reprise via checkpoint  
- ✅ Annulation uniquement `cancel_task`

## 🔹 R10 : Affichage temps réel + logs

| Flux      | Contenu                    | Format       |
| ----------| -------------------------- | ------------|
| stdout    | JSON MCP                   | JSON strict |
| stderr    | Progression humaine        | Texte enrichi|
| rag.log   | Logs structurés            | JSON structuré |

## 🔹 R11 : Cache mémoire + récupération contexte

- Embeddings, chunks, requêtes, décisions IA  
- Historique chat Cline automatiquement injecté  
- Stockage SQLite `/rag/db/memory.sqlite`  

## 🔹 R12 : Automatisation en boucle continue

- Pipeline RAG automatisé ou déclenchement événementiel  
- ❌ Pas de rappel `init_rag` / `activated_rag`  
- ✅ Utilisation cache et mémoire interne  
- Reprise sans intervention humaine  

## 🔹 R13 : Observabilité totale + logs structurés

- Phase par phase, sous-processus, cache, erreurs, décisions IA  
- Logs JSON consultables via `get_status` (`detailed:true`)  
- Alertes sur anomalies  

## 🔹 R14 : Gouvernance stricte

- Modifs règles = validation Conseil Architecture  
- Review commits obligatoire  
- Checklist review : conformité R1-R14, tests, messages IA-first, schémas MCP

## 🔹 R15 : Non-réentrance commandes MCP

- Commande usage unique = jamais relançable  
- ❌ Retry automatique, boucle, crash, redémarrage  
- État persistant `command_executed=true` dans `state.json`

## 🔹 R16 : JSON MCP unique par stdout

- ✅ 1 JSON final = réponse MCP  
- ❌ Pas de JSON intermédiaires sur stdout  
- Progression via `stderr` ou `get_status`

## 🔹 R17 : Séparation JSON métier / logs

- `stdout` = JSON MCP contractuel  
- `rag.log` = JSON observabilité  
- ❌ Jamais interchanger ou réutiliser

## 🔹 R18 : Immutabilité `state.json`

- Modifiable uniquement par moteur RAG  
- ❌ Pas d'édition manuelle ou "fix IA"  
- Toute mutation = trace log obligatoire

## 🔹 R19 : IA ≠ décision architecturale

- IA peut : proposer, analyser, suggérer  
- IA ne peut pas : choisir backend, modifier pipeline, changer règles

## 🔹 R20 : Réentrance sous-fonctions internes

- Sous-fonctions (scan, chunk, embedding…) = réentrantes et idempotentes  
- Survie crash, reprise checkpoint  
- ≠ Commandes MCP globales (non réentrantes)

## 🔹 R21 : Contexte Cline en lecture seule

- Injection contexte = lecture seule  
- ❌ Pas de modification historique  
- ❌ Pas de "correction" du passé

## 🔹 R22 : Zéro effet de bord non déclaré

- Commande MCP = effets déclarés uniquement  
- ❌ Création fichier cachée, écriture DB hors pipeline  
- Audit automatique des effets

## 🔹 R23 : Versionnage runtime obligatoire

- `state.json` contient : `rules_version`, `architecture_version`  
- Validation compatibilité versions au démarrage  
- Incohérence = warning critique

## 🔹 R24 : IA ≠ humain (sorties dédiées)

- Sortie IA = JSON structuré, déterministe, parsable  
- Sortie humain = texte enrichi, émotions, contexte  
- ❌ Emojis dans JSON métier (sauf `notes_for_ai`)

---

## ⚠️ Synthèse pour IA

```json
{
  "rules_version": "3.0.0",
  "mandatory": [
    "R1-Base décisionnelle",
    "R2-Séparation responsabilités",
    "R3-JSON strict",
    "R4-Architecture RAG standard",
    "R5-Backend configurable",
    "R6-LLM & MCP",
    "R7-Usage unique MCP",
    "R8-Ordre outils MCP",
    "R9-Processus sans timeout",
    "R10-Affichage temps réel",
    "R11-Cache mémoire",
    "R12-Automatisation boucle",
    "R13-Observabilité",
    "R14-Gouvernance",
    "R15-Non-réentrance commandes MCP",
    "R16-JSON MCP unique par stdout",
    "R17-Séparation JSON métier/logs",
    "R18-Immutabilité state.json",
    "R19-IA ≠ décision architecturale",
    "R20-Réentrance sous-fonctions internes",
    "R21-Contexte Cline lecture seule",
    "R22-Zéro effet de bord non déclaré",
    "R23-Versionnage runtime obligatoire",
    "R24-IA ≠ humain (sorties dédiées)"
  ]
}
