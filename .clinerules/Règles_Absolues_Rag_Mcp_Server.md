# 📜 Règles absolues pour développer un **RAG MCP Server**

> **Ce document définit les règles NON NÉGOCIABLES** à respecter pour concevoir, développer et maintenir un système RAG (Retrieval-Augmented Generation) intégré à un **MCP Server**.
>
> Toute violation de ces règles entraîne : instabilité, erreurs JSON, hallucinations, corruption mémoire ou impossibilité d’orchestration LLM.

---

## 1️⃣ RèGLES FONDAMENTALES (AXIOMES)

### 1.1 Séparation stricte des responsabilités

| Élément        | Rôle                  | Interdiction absolue          |
| -------------- | --------------------- | ----------------------------- |
| `init_rag`     | Initialisation projet | ❌ Aucune exécution RAG        |
| `activate_rag` | Pipeline RAG runtime  | ❌ Aucune création de fichiers |
| MCP Server     | Orchestration         | ❌ Log texte dans stdout       |
| LLM (Ollama)   | Raisonnement          | ❌ Accès direct aux fichiers   |

👉 **Un module = une responsabilité = un contrat clair**

---

### 1.2 JSON STRICT ou RIEN

> **Tout ce qui transite vers MCP / LLM = JSON strict**

#### ✅ Autorisé

```json
{ "status": "ok", "step": "init_rag" }
```

#### ❌ Interdit

```
[init_rag] Détails : création DB...
```

📌 Les logs humains doivent **TOUJOURS** être redirigés vers :

* un fichier `.log`
* ou `stderr`

---

## 2️⃣ ARCHITECTURE RAG OBLIGATOIRE

### 2.1 Structure de fichiers standard

```text
/rag/
 ├─ db/
 │   ├─ memory.sqlite
 │   ├─ vectors.sqlite
 │   └─ metadata.sqlite
 │
 ├─ config/
 │   ├─ rag.config.json
 │   ├─ db.config.json
 │   └─ embedding.config.json
 │
 ├─ logs/
 │   └─ rag.log
 │
 ├─ .ragignore
 └─ state.json
```

🚫 Aucun autre emplacement n’est autorisé

---

### 2.2 Rôle EXCLUSIF de `init_rag`

`init_rag` **DOIT** :

1. Créer les répertoires `/rag/db` et `/rag/config`
2. Générer les fichiers de configuration par défaut
3. Initialiser les bases SQLite (tables vides)
4. Créer `.ragignore`
5. Enregistrer le projet dans la mémoire MCP
6. Retourner **UN SEUL JSON FINAL**

🚫 `init_rag` ne doit JAMAIS :

* analyser des fichiers
* générer des embeddings
* appeler un LLM

---

### 2.3 Rôle EXCLUSIF de `activate_rag`

`activate_rag` **DOIT** :

1. Vérifier que `init_rag` a été exécuté
2. Charger la configuration
3. Exécuter le pipeline RAG :

   * Analyse
   * Chunking
   * Embeddings
   * Indexation
   * Retrieval

🚫 `activate_rag` ne doit JAMAIS :

* créer de fichiers système
* modifier la configuration

---

## 3️⃣ BASE DE DONNÉES (RÈGLES STRICTES)

### 3.1 Backend par défaut

```json
{
  "type": "sqlite",
  "mode": "local",
  "vector_extension": false
}
```

📌 PostgreSQL est **OPTIONNEL**, jamais hardcodé

---

### 3.2 Interdictions absolues

* ❌ Aucun backend hardcodé
* ❌ Aucun `if (postgres)` dans le code
* ❌ Aucune dépendance système obligatoire

👉 Le backend est **CHOISI UNIQUEMENT via config**

---

## 4️⃣ LLM & MCP : RÈGLES D’OR

### 4.1 Ollama (ou autre LLM)

* ❌ N’analyse JAMAIS de fichiers directement
* ❌ Ne lit PAS le filesystem
* ✅ Reçoit UNIQUEMENT :

  * texte
  * JSON
  * chunks préparés

👉 Toute analyse de fichier passe par un **outil MCP**

---

### 4.2 Analyse poussée par LLM (optionnelle)

```json
"deep_llm_analysis": false
```

* Désactivée par défaut
* Activée explicitement
* Exécutée **AVANT embeddings**
* Jamais bloquante

---

## 5️⃣ LOGGING (RÈGLE CRITIQUE)

### 5.1 Séparation des flux

| Flux      | Contenu                 |
| --------- | ----------------------- |
| `stdout`  | JSON machine uniquement |
| `stderr`  | erreurs techniques      |
| `rag.log` | logs humains            |

---

### 5.2 Structure de log recommandée

```json
{
  "module": "rag.init",
  "action": "create_db",
  "status": "success",
  "timestamp": "ISO-8601"
}
```

---

## 6️⃣ RAG PIPELINE — ORDRE NON MODIFIABLE

```text
1. Scan fichiers
2. Filtrage (.ragignore)
3. Analyse structurelle
4. (Optionnel) Analyse LLM
5. Chunking
6. Embeddings
7. Indexation
8. Retrieval
```

🚫 Changer l’ordre = RAG instable

---

## 7️⃣ GESTION D’ÉTAT

### 7.1 `state.json` obligatoire

Contient :

* version RAG
* backend DB
* état d’indexation
* date dernière mise à jour

---

## 8️⃣ RÈGLES DE SURVIE (SYNTHÈSE)

* 🧠 **Un LLM ne fait PAS du système**
* 🗂️ **Le filesystem n’est jamais implicite**
* 📄 **JSON strict ou crash**
* 🔌 **Pas de service externe obligatoire**
* 🧱 **Initialisation ≠ Exécution**

---

## ✅ CONCLUSION

> Un RAG MCP Server est un **système distribué**, pas un script.

Respecter ces règles garantit :

* stabilité
* auditabilité
* extensibilité
* zéro hallucination structurelle

🚀 Toute implémentation future **DOIT** se conformer à ce document.
