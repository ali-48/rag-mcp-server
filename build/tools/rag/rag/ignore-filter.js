import fs from "fs";
import ignore from "ignore";
import path from "path";
// Cache pour les filtres par projet (optimisation des performances)
const filterCache = new Map();
export function createIgnoreFilter(projectPath) {
    // Vérifier le cache
    const cachedFilter = filterCache.get(projectPath);
    if (cachedFilter) {
        return cachedFilter;
    }
    const ig = ignore();
    // Règles par défaut - plus complètes
    const defaultRules = `
# Dossiers de dépendances
node_modules/
.npm/
.yarn/
.pnpm/
venv/
env/
.venv/
__pycache__/

# Fichiers de build et distribution
dist/
build/
out/
coverage/
*.egg-info/

# Fichiers de logs
*.log
logs/

# Fichiers média et binaires
*.png
*.jpg
*.jpeg
*.gif
*.svg
*.ico
*.exe
*.dll
*.so
*.dylib

# Fichiers système
.git/
.DS_Store
Thumbs.db
*.swp
*.swo

# Fichiers de configuration sensible
.env
.env.local
.env.production
secrets/
keys/

# Fichiers minifiés
*.min.js
*.min.css

# Fichiers de lock
package-lock.json
yarn.lock
pnpm-lock.yaml

# Fichiers de données volumineux
*.csv
*.jsonl
*.parquet
*.feather
*.h5
*.pkl
*.pickle
  `.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    ig.add(defaultRules);
    // Charger .ragignore du projet si existe
    const ragIgnorePath = path.join(projectPath, '.ragignore');
    if (fs.existsSync(ragIgnorePath)) {
        try {
            const projectRules = fs.readFileSync(ragIgnorePath, 'utf8');
            const ruleCount = projectRules.split('\n').filter(line => line.trim() && !line.startsWith('#')).length;
            ig.add(projectRules);
            console.error(`Loaded ${ruleCount} rules from project .ragignore: ${ragIgnorePath}`);
        }
        catch (error) {
            console.error(`Warning: Could not read .ragignore at ${ragIgnorePath}:`, error);
        }
    }
    else {
        console.error(`No .ragignore found in project: ${projectPath}`);
    }
    // Charger .ragignore global si existe (dans le dossier memory-mcp)
    const globalRagIgnorePath = path.join(new URL('.', import.meta.url).pathname, '..', '.ragignore');
    if (fs.existsSync(globalRagIgnorePath)) {
        try {
            const globalRules = fs.readFileSync(globalRagIgnorePath, 'utf8');
            const ruleCount = globalRules.split('\n').filter(line => line.trim() && !line.startsWith('#')).length;
            ig.add(globalRules);
            console.error(`Loaded ${ruleCount} rules from global .ragignore: ${globalRagIgnorePath}`);
        }
        catch (error) {
            console.error(`Warning: Could not read global .ragignore:`, error);
        }
    }
    // Mettre en cache le filtre
    filterCache.set(projectPath, ig);
    return ig;
}
export function shouldIgnoreFile(filePath, projectPath) {
    const ig = createIgnoreFilter(projectPath);
    const relativePath = path.relative(projectPath, filePath);
    // Ne pas ignorer les fichiers à la racine du projet (comme .ragignore lui-même)
    if (relativePath === '.ragignore') {
        return false;
    }
    const shouldIgnore = ig.ignores(relativePath);
    // Log de débogage pour les fichiers ignorés (optionnel)
    if (shouldIgnore) {
        console.error(`Ignoring file: ${relativePath} (matches .ragignore rules)`);
    }
    return shouldIgnore;
}
// Fonction utilitaire pour vérifier quels fichiers seront ignorés
export function testIgnoreRules(projectPath, testFiles) {
    const ig = createIgnoreFilter(projectPath);
    const results = {};
    for (const testFile of testFiles) {
        const relativePath = path.relative(projectPath, testFile);
        results[testFile] = ig.ignores(relativePath);
    }
    return results;
}
