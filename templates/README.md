# Templates .ragignore

Ce dossier contient des templates de fichiers `.ragignore` pré-configurés pour différents types de projets.

## 📁 Fichiers disponibles

### 1. `nodejs.ragignore` - Pour projets Node.js

**Utilisation recommandée pour :**

- Applications Node.js/Express
- Packages npm
- Applications React/Vue/Angular avec Node.js backend
- Outils CLI Node.js

**Caractéristiques :**

- Exclut `node_modules/`, `.npm/`, `.yarn/`
- Exclut les fichiers de build (`dist/`, `build/`)
- Exclut les fichiers de logs et de lock
- Inclut les fichiers de configuration importants

### 2. `python.ragignore` - Pour projets Python

**Utilisation recommandée pour :**

- Applications Django/Flask/FastAPI
- Scripts Python
- Projets data science/machine learning
- Packages Python

**Caractéristiques :**

- Exclut les environnements virtuels (`venv/`, `.venv/`)
- Exclut le cache Python (`__pycache__/`)
- Exclut les fichiers de distribution
- Exclut les gros fichiers de données et modèles ML

### 3. `web.ragignore` - Pour projets Web

**Utilisation recommandée pour :**

- Sites web statiques (HTML/CSS/JS)
- Applications frontend
- Projets avec beaucoup d'assets
- Sites JAMstack

**Caractéristiques :**

- Exclut les assets médias (images, fonts, vidéos)
- Exclut les fichiers de build
- Inclut les fichiers source (HTML, CSS, JS)
- Supporte les frameworks modernes (React, Vue, etc.)

## 🚀 Comment utiliser ces templates

### Méthode 1 : Copie manuelle

```bash
# Pour un projet Node.js
cp templates/nodejs.ragignore /chemin/vers/projet/.ragignore

# Pour un projet Python
cp templates/python.ragignore /chemin/vers/projet/.ragignore

# Pour un projet web
cp templates/web.ragignore /chemin/vers/projet/.ragignore
```

### Méthode 2 : Utilisation avec le script d'indexation

Le script `manual-index.js` détecte automatiquement si un fichier `.ragignore` existe dans votre projet.

### Méthode 3 : Personnalisation

1. Copiez le template approprié dans votre projet
2. Modifiez-le selon vos besoins
3. Testez avec : `node scripts/manual-index.js --test-ignore`

## 🔧 Personnalisation des templates

### Ajouter des règles spécifiques

```bash
# Exemple : ajouter une règle pour exclure un dossier spécifique
echo "mon-dossier-specifique/" >> .ragignore

# Exemple : exclure un type de fichier spécifique
echo "*.backup" >> .ragignore
```

### Inclure des fichiers malgré les règles

```bash
# Exemple : inclure un fichier important malgré une règle générale
echo "!fichier-important.js" >> .ragignore
```

### Tester vos règles

```bash
# Tester sans indexer
node scripts/manual-index.js /chemin/vers/projet --test-ignore

# Voir les fichiers ignorés pendant l'indexation
node scripts/manual-index.js /chemin/vers/projet --verbose
```

## 📚 Bonnes pratiques

### 1. **Versionnez votre `.ragignore`**

Ajoutez `.ragignore` à votre dépôt Git pour partager les règles avec votre équipe.

### 2. **Adaptez aux besoins de votre projet**

- Les projets data science : excluez les gros fichiers de données
- Les projets web : excluez les assets médias
- Les projets backend : excluez les fichiers de logs

### 3. **Testez régulièrement**

Utilisez `--test-ignore` pour vérifier que les bons fichiers sont indexés.

### 4. **Documentez les exceptions**

Ajoutez des commentaires dans votre `.ragignore` pour expliquer pourquoi certaines règles existent.

## 🐛 Dépannage

### Problème : Trop de fichiers sont ignorés

**Solution :** Vérifiez vos règles et utilisez `!` pour inclure des fichiers importants.

### Problème : Pas assez de fichiers sont ignorés

**Solution :** Ajoutez des règles plus spécifiques pour les fichiers que vous ne voulez pas indexer.

### Problème : Le fichier `.ragignore` n'est pas détecté

**Solution :** Assurez-vous qu'il est à la racine de votre projet et nommé exactement `.ragignore`.

## 🔗 Ressources

- [Documentation principale](../README-RAG.md)
- [Syntaxe .gitignore (identique à .ragignore)](https://git-scm.com/docs/gitignore)
- [Guide d'indexation manuelle](../scripts/manual-index.js)

## 📄 Licence

Ces templates sont fournis sous licence MIT. Utilisez-les librement dans vos projets.
