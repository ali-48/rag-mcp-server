// src/rag/enrichment/code/analyzer.ts
// Analyseur de code structurel interne (transformé depuis code-mapper.ts)
import fs from 'fs';
import path from 'path';
import { Project } from 'ts-morph';
// ============================================================================
// CONFIGURATION PAR DÉFAUT
// ============================================================================
/**
 * Dossiers à exclure de l'analyse
 */
const DEFAULT_EXCLUDED_DIRS = [
    'node_modules',
    '.git',
    'build',
    'build-test',
    'dist',
    'coverage',
    '.nyc_output',
    '.vscode',
    'logs',
    'audit',
    'test',
    'test-data',
    'test-chuking',
    'archived-tests'
];
/**
 * Fichiers à exclure de l'analyse
 */
const DEFAULT_EXCLUDED_FILES = [
    '.DS_Store',
    'Thumbs.db',
    '*.log',
    '*.tmp',
    '*.temp',
    '*.map',
    '*.d.ts'
];
/**
 * Extensions de fichiers incluses
 */
const DEFAULT_INCLUDED_EXTENSIONS = [
    '.ts', '.js', '.json', '.md', '.yml', '.yaml', '.toml',
    '.sql', '.sh', '.txt', '.html', '.css'
];
/**
 * Mappage extension → langage
 */
const EXTENSION_TO_LANGUAGE = {
    '.ts': 'ts',
    '.js': 'js',
    '.json': 'json',
    '.md': 'md',
    '.yml': 'yml',
    '.yaml': 'yaml',
    '.toml': 'toml',
    '.sql': 'sql',
    '.sh': 'sh',
    '.txt': 'txt',
    '.html': 'html',
    '.css': 'css'
};
/**
 * Mappage extension → type de fichier
 */
const EXTENSION_TO_TYPE = {
    '.ts': 'code',
    '.js': 'code',
    '.json': 'config',
    '.yml': 'config',
    '.yaml': 'config',
    '.toml': 'config',
    '.md': 'doc',
    '.txt': 'doc',
    '.sql': 'code',
    '.sh': 'code',
    '.html': 'code',
    '.css': 'code'
};
// ============================================================================
// CLASSE PRINCIPALE
// ============================================================================
/**
 * Analyseur de code structurel
 */
export class CodeAnalyzer {
    config;
    project;
    fileIndex = 0;
    functionIndex = 0;
    classIndex = 0;
    constructor(config) {
        this.config = {
            excludedDirs: DEFAULT_EXCLUDED_DIRS,
            excludedFiles: DEFAULT_EXCLUDED_FILES,
            includedExtensions: DEFAULT_INCLUDED_EXTENSIONS,
            verbose: false,
            ...config
        };
        this.project = new Project();
    }
    /**
     * Analyse un projet et génère une carte de code
     */
    async analyzeProject(rootDir) {
        const startTime = Date.now();
        if (this.config.verbose) {
            console.log(`🚀 Analyse du projet: ${rootDir}`);
        }
        // 1. Scanner les fichiers
        const files = await this.scanFiles(rootDir);
        // 2. Analyser les fichiers TypeScript
        await this.analyzeTypeScriptFiles(files);
        // 3. Construire les relations
        const relations = await this.buildRelations(files);
        // 4. Calculer les métriques
        await this.calculateMetrics(files);
        // 5. Générer le résumé
        const summary = this.generateSummary(files, relations);
        const duration = Date.now() - startTime;
        if (this.config.verbose) {
            console.log(`✅ Analyse terminée en ${duration}ms`);
            console.log(`📊 Résumé: ${summary.totalFiles} fichiers, ${summary.functions} fonctions, ${summary.classes} classes`);
        }
        return {
            project: {
                name: path.basename(rootDir),
                path: rootDir,
                date: new Date().toISOString(),
                language: 'TypeScript/JavaScript'
            },
            summary,
            files,
            relations
        };
    }
    /**
     * Scanne récursivement les fichiers du projet
     */
    async scanFiles(rootDir) {
        const files = [];
        this.fileIndex = 0;
        const scanDirectory = (dirPath) => {
            try {
                const items = fs.readdirSync(dirPath);
                for (const item of items) {
                    const fullPath = path.join(dirPath, item);
                    const relativePath = path.relative(rootDir, fullPath);
                    try {
                        const stat = fs.statSync(fullPath);
                        const isDirectory = stat.isDirectory();
                        // Vérifier si l'élément doit être exclu
                        if (this.shouldExclude(fullPath, isDirectory)) {
                            continue;
                        }
                        if (isDirectory) {
                            // Scanner récursivement les sous-dossiers
                            scanDirectory(fullPath);
                        }
                        else {
                            // Analyser le fichier
                            this.fileIndex++;
                            const fileInfo = this.analyzeFile(fullPath, relativePath, this.fileIndex, stat);
                            files.push(fileInfo);
                            // Afficher la progression
                            if (this.config.verbose && this.fileIndex % 20 === 0) {
                                console.log(`  📄 ${this.fileIndex} fichiers scannés...`);
                            }
                        }
                    }
                    catch (error) {
                        if (this.config.verbose) {
                            console.warn(`⚠️  Impossible d'accéder à ${fullPath}:`, error.message);
                        }
                    }
                }
            }
            catch (error) {
                if (this.config.verbose) {
                    console.error(`❌ Erreur lors du scan de ${dirPath}:`, error.message);
                }
            }
        };
        // Démarrer le scan
        scanDirectory(rootDir);
        if (this.config.verbose) {
            console.log(`✅ ${files.length} fichiers trouvés et analysés`);
        }
        return files;
    }
    /**
     * Vérifie si un fichier/dossier doit être exclu
     */
    shouldExclude(filePath, isDirectory) {
        const name = path.basename(filePath);
        const dir = path.dirname(filePath);
        // Vérifier les dossiers exclus
        if (isDirectory && this.config.excludedDirs.includes(name)) {
            return true;
        }
        // Vérifier les fichiers exclus
        if (!isDirectory) {
            for (const pattern of this.config.excludedFiles) {
                if (pattern.includes('*')) {
                    const regex = new RegExp(pattern.replace('*', '.*'));
                    if (regex.test(name))
                        return true;
                }
                else if (name === pattern) {
                    return true;
                }
            }
            // Vérifier les extensions incluses
            const ext = path.extname(name).toLowerCase();
            if (ext && !this.config.includedExtensions.includes(ext)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Analyse un fichier individuel et extrait ses métadonnées
     */
    analyzeFile(filePath, relativePath, index, stat) {
        // Lire le contenu pour compter les lignes
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').length;
        // Déterminer le type et le langage
        const fileType = this.getFileType(filePath);
        const language = this.getLanguage(filePath);
        // Générer l'ID unique
        const id = this.generateFileId(index);
        // Créer l'objet FileInfo
        const fileInfo = {
            id,
            path: relativePath,
            type: fileType,
            language,
            lines,
            size: stat.size,
            imports: [], // Rempli par analyse TypeScript
            exports: [], // Rempli par analyse TypeScript
            functions: [], // Rempli par analyse TypeScript
            classes: [], // Rempli par analyse TypeScript
            score: {
                complexity: 0,
                maintainability: 0,
                quality: 0
            }
        };
        return fileInfo;
    }
    /**
     * Détermine le type de fichier basé sur l'extension
     */
    getFileType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return EXTENSION_TO_TYPE[ext] || 'other';
    }
    /**
     * Détermine le langage basé sur l'extension
     */
    getLanguage(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return EXTENSION_TO_LANGUAGE[ext];
    }
    /**
     * Génère un ID unique pour un fichier
     */
    generateFileId(index) {
        return `file_${String(index).padStart(3, '0')}`;
    }
    /**
     * Génère un ID unique pour une fonction
     */
    generateFunctionId(index) {
        return `fn_${String(index).padStart(3, '0')}`;
    }
    /**
     * Génère un ID unique pour une classe
     */
    generateClassId(index) {
        return `cls_${String(index).padStart(3, '0')}`;
    }
    /**
     * Analyse les fichiers TypeScript avec ts-morph
     */
    async analyzeTypeScriptFiles(files) {
        if (this.config.verbose) {
            console.log('🔍 Analyse TypeScript...');
        }
        this.functionIndex = 0;
        this.classIndex = 0;
        // Filtrer les fichiers TypeScript
        const tsFiles = files.filter(file => file.language === 'ts' || file.language === 'js');
        if (this.config.verbose) {
            console.log(`  📄 ${tsFiles.length} fichiers TypeScript à analyser`);
        }
        for (const file of tsFiles) {
            try {
                const sourceFile = this.project.addSourceFileAtPath(path.join(process.cwd(), file.path));
                // 1. Analyser les imports
                const imports = this.extractImports(sourceFile);
                file.imports = imports;
                // 2. Analyser les exports
                const exports = this.extractExports(sourceFile);
                file.exports = exports;
                // 3. Analyser les fonctions
                const functions = this.extractFunctions(sourceFile, this.functionIndex);
                file.functions = functions;
                this.functionIndex += functions.length;
                // 4. Analyser les classes
                const classes = this.extractClasses(sourceFile, this.classIndex);
                file.classes = classes;
                this.classIndex += classes.length;
                this.project.removeSourceFile(sourceFile);
            }
            catch (error) {
                if (this.config.verbose) {
                    console.warn(`⚠️  Impossible d'analyser ${file.path}:`, error.message);
                }
            }
        }
        if (this.config.verbose) {
            console.log(`✅ Analyse TypeScript terminée : ${this.functionIndex} fonctions, ${this.classIndex} classes`);
        }
    }
    /**
     * Extrait les imports d'un fichier TypeScript
     */
    extractImports(sourceFile) {
        const imports = [];
        // Imports ES6
        const importDeclarations = sourceFile.getImportDeclarations();
        for (const importDecl of importDeclarations) {
            const moduleSpecifier = importDecl.getModuleSpecifierValue();
            const namedImports = importDecl.getNamedImports();
            const defaultImport = importDecl.getDefaultImport();
            const namespaceImport = importDecl.getNamespaceImport();
            const names = [];
            if (defaultImport)
                names.push(defaultImport.getText());
            if (namespaceImport)
                names.push(`${namespaceImport.getText()}.*`);
            if (namedImports.length > 0) {
                namedImports.forEach((imp) => names.push(imp.getName()));
            }
            imports.push({
                module: moduleSpecifier,
                type: 'import',
                names: names.length > 0 ? names : undefined
            });
        }
        // Requires CommonJS (analyse basique)
        sourceFile.forEachDescendant((node) => {
            if (node.getKindName() === 'CallExpression') {
                const expr = node.getExpression();
                if (expr.getText() === 'require') {
                    const args = node.getArguments();
                    if (args.length > 0) {
                        const moduleSpecifier = args[0].getText().replace(/['"]/g, '');
                        imports.push({
                            module: moduleSpecifier,
                            type: 'require',
                            names: undefined
                        });
                    }
                }
            }
        });
        return imports;
    }
    /**
     * Extrait les exports d'un fichier TypeScript
     */
    extractExports(sourceFile) {
        const exports = [];
        // Fonction pour déterminer le type d'un nœud
        const getNodeType = (node) => {
            const kindName = node.getKindName();
            if (kindName.includes('Function'))
                return 'function';
            if (kindName.includes('Class'))
                return 'class';
            if (kindName.includes('Interface'))
                return 'interface';
            if (kindName.includes('TypeAlias'))
                return 'type';
            if (kindName.includes('Variable'))
                return 'variable';
            if (kindName.includes('Enum'))
                return 'enum';
            if (kindName.includes('Module'))
                return 'namespace';
            return 'function'; // fallback
        };
        // Fonction pour déterminer la visibilité
        const getVisibility = (node) => {
            const modifiers = node.getModifiers();
            const isExported = node.isExported();
            const isDefaultExport = node.isDefaultExport();
            if (isExported || isDefaultExport)
                return 'public';
            // Vérifier les modificateurs TypeScript
            for (const mod of modifiers) {
                const text = mod.getText();
                if (text === 'private')
                    return 'private';
                if (text === 'protected')
                    return 'protected';
            }
            return 'private';
        };
        // Fonction pour compter les lignes
        const countLines = (node) => {
            const start = node.getStartLineNumber();
            const end = node.getEndLineNumber();
            return end - start + 1;
        };
        // Exports nommés
        const exportDeclarations = sourceFile.getExportDeclarations();
        for (const exportDecl of exportDeclarations) {
            const namedExports = exportDecl.getNamedExports();
            if (namedExports) {
                namedExports.forEach((exp) => {
                    const name = exp.getName();
                    // Chercher la déclaration correspondante
                    const symbol = exp.getSymbol();
                    if (symbol) {
                        const declarations = symbol.getDeclarations();
                        if (declarations.length > 0) {
                            const decl = declarations[0];
                            exports.push({
                                name,
                                type: getNodeType(decl),
                                visibility: 'public', // Les exports nommés sont toujours publics
                                lines: countLines(decl)
                            });
                        }
                    }
                });
            }
        }
        // Exports par défaut
        const defaultExport = sourceFile.getDefaultExportSymbol();
        if (defaultExport) {
            const declarations = defaultExport.getDeclarations();
            if (declarations.length > 0) {
                const decl = declarations[0];
                exports.push({
                    name: 'default',
                    type: getNodeType(decl),
                    visibility: 'public',
                    lines: countLines(decl)
                });
            }
        }
        // Exports de déclarations exportées directement
        sourceFile.forEachDescendant((node) => {
            const kindName = node.getKindName();
            if (kindName.includes('Export')) {
                const symbol = node.getSymbol();
                if (symbol) {
                    const name = symbol.getName();
                    exports.push({
                        name,
                        type: getNodeType(node),
                        visibility: getVisibility(node),
                        lines: countLines(node)
                    });
                }
            }
        });
        // Éliminer les doublons basés sur le nom
        const uniqueExports = [];
        const seenNames = new Set();
        for (const exp of exports) {
            if (!seenNames.has(exp.name)) {
                seenNames.add(exp.name);
                uniqueExports.push(exp);
            }
        }
        return uniqueExports;
    }
    /**
     * Extrait les fonctions d'un fichier TypeScript
     */
    extractFunctions(sourceFile, startIndex) {
        const functions = [];
        let currentIndex = startIndex;
        // Fonction pour compter les lignes
        const countLines = (node) => {
            const start = node.getStartLineNumber();
            const end = node.getEndLineNumber();
            return end - start + 1;
        };
        // Fonctions déclarées
        const functionDeclarations = sourceFile.getFunctions();
        for (const funcDecl of functionDeclarations) {
            const name = funcDecl.getName() || 'anonymous';
            const isExported = funcDecl.isExported();
            const isDefaultExport = funcDecl.isDefaultExport();
            functions.push({
                id: this.generateFunctionId(currentIndex),
                name,
                visibility: isExported || isDefaultExport ? 'public' : 'private',
                lines: countLines(funcDecl),
                complexity: 1, // À améliorer avec calcul de complexité cyclomatique
                calls: [] // Rempli plus tard par analyse des appels
            });
            currentIndex++;
        }
        return functions;
    }
    /**
     * Extrait les classes d'un fichier TypeScript
     */
    extractClasses(sourceFile, startIndex) {
        const classes = [];
        let currentIndex = startIndex;
        // Fonction pour compter les lignes
        const countLines = (node) => {
            const start = node.getStartLineNumber();
            const end = node.getEndLineNumber();
            return end - start + 1;
        };
        const classDeclarations = sourceFile.getClasses();
        for (const classDecl of classDeclarations) {
            const name = classDecl.getName() || 'anonymous';
            const isExported = classDecl.isExported();
            const isDefaultExport = classDecl.isDefaultExport();
            // Méthodes
            const methods = classDecl.getMethods().map((method) => method.getName());
            // Propriétés
            const properties = classDecl.getProperties().map((prop) => prop.getName());
            // Héritage
            const extendsClause = classDecl.getExtends();
            const extendsName = extendsClause ? extendsClause.getText() : undefined;
            // Implémentation d'interfaces
            const implementsClauses = classDecl.getImplements();
            const implementsNames = implementsClauses ? implementsClauses.map((impl) => impl.getText()) : [];
            classes.push({
                id: this.generateClassId(currentIndex),
                name,
                methods,
                properties,
                lines: countLines(classDecl),
                extends: extendsName,
                implements: implementsNames
            });
            currentIndex++;
        }
        return classes;
    }
    /**
     * Construit les relations entre fichiers et symboles
     */
    async buildRelations(files) {
        if (this.config.verbose) {
            console.log('🧩 Construction des relations...');
        }
        const imports = [];
        const calls = [];
        const inheritance = [];
        // 1. Construire les relations d'imports
        if (this.config.verbose) {
            console.log('  🔗 Analyse des imports...');
        }
        // Créer un mapping chemin de fichier → ID
        const filePathToId = new Map();
        for (const file of files) {
            filePathToId.set(file.path, file.id);
        }
        // Créer un mapping nom de fichier sans extension → ID(s)
        const fileNameToIds = new Map();
        for (const file of files) {
            const fileName = path.basename(file.path, path.extname(file.path));
            if (!fileNameToIds.has(fileName)) {
                fileNameToIds.set(fileName, []);
            }
            fileNameToIds.get(fileName).push(file.id);
        }
        // Analyser les imports de chaque fichier
        for (const file of files) {
            for (const importInfo of file.imports) {
                const moduleName = importInfo.module;
                // Essayer de trouver le fichier cible
                let targetFileId;
                // Cas 1: Import relatif (commence par ./ ou ../)
                if (moduleName.startsWith('./') || moduleName.startsWith('../')) {
                    // Résoudre le chemin relatif
                    const dir = path.dirname(file.path);
                    const resolvedPath = path.resolve('/', dir, moduleName);
                    const relativePath = path.relative('/', resolvedPath).replace(/^\//, '');
                    // Chercher le fichier exact
                    if (filePathToId.has(relativePath)) {
                        targetFileId = filePathToId.get(relativePath);
                    }
                    else {
                        // Chercher avec extensions courantes
                        const extensions = ['.ts', '.js', '.tsx', '.jsx', '.json'];
                        for (const ext of extensions) {
                            const pathWithExt = relativePath + ext;
                            if (filePathToId.has(pathWithExt)) {
                                targetFileId = filePathToId.get(pathWithExt);
                                break;
                            }
                        }
                    }
                }
                // Cas 2: Import de module (pas de ./ ou ../)
                else {
                    // Chercher par nom de fichier (sans extension)
                    const baseName = moduleName.split('/').pop() || moduleName;
                    const possibleIds = fileNameToIds.get(baseName);
                    if (possibleIds && possibleIds.length === 1) {
                        targetFileId = possibleIds[0];
                    }
                    // Si plusieurs fichiers avec le même nom, on ne peut pas déterminer
                }
                imports.push({
                    from: file.id,
                    to: targetFileId || moduleName, // Si pas trouvé, garder le nom du module
                    type: importInfo.type
                });
            }
        }
        if (this.config.verbose) {
            console.log(`  ✅ ${imports.length} relations d'imports trouvées`);
        }
        // 2. Construire les relations d'appels
        if (this.config.verbose) {
            console.log('  📞 Analyse des appels...');
        }
        // Créer un mapping nom de fonction → ID(s)
        const functionNameToIds = new Map();
        for (const file of files) {
            for (const func of file.functions) {
                if (!functionNameToIds.has(func.name)) {
                    functionNameToIds.set(func.name, []);
                }
                functionNameToIds.get(func.name).push(func.id);
            }
        }
        // Analyser les appels dans chaque fonction
        for (const file of files) {
            for (const func of file.functions) {
                // Pour l'instant, nous n'avons pas d'analyse AST des appels
                // Nous allons utiliser une approche simplifiée : analyser les imports
                // et considérer que les fonctions importées sont appelées
                // Pour chaque import, si des noms spécifiques sont importés,
                // considérer qu'ils sont appelés
                for (const importInfo of file.imports) {
                    if (importInfo.names && importInfo.names.length > 0) {
                        for (const importedName of importInfo.names) {
                            // Nettoyer le nom (enlever ".*" pour les imports namespace)
                            const cleanName = importedName.replace(/\.\*$/, '');
                            const possibleIds = functionNameToIds.get(cleanName);
                            if (possibleIds && possibleIds.length === 1) {
                                calls.push({
                                    caller: func.id,
                                    callee: possibleIds[0],
                                    file: file.id
                                });
                            }
                        }
                    }
                }
                // Ajouter les appels internes (fonctions dans le même fichier)
                for (const otherFunc of file.functions) {
                    if (otherFunc.id !== func.id) {
                        // Pour l'instant, nous considérons que toutes les fonctions
                        // dans le même fichier s'appellent mutuellement (simplification)
                        // À améliorer avec une analyse AST réelle
                        calls.push({
                            caller: func.id,
                            callee: otherFunc.id,
                            file: file.id
                        });
                    }
                }
            }
        }
        if (this.config.verbose) {
            console.log(`  ✅ ${calls.length} relations d'appels trouvées`);
        }
        // 3. Construire les relations d'héritage
        if (this.config.verbose) {
            console.log('  🏛️  Analyse de l\'héritage...');
        }
        // Créer un mapping nom de classe → ID(s)
        const classNameToIds = new Map();
        for (const file of files) {
            for (const cls of file.classes) {
                if (!classNameToIds.has(cls.name)) {
                    classNameToIds.set(cls.name, []);
                }
                classNameToIds.get(cls.name).push(cls.id);
            }
        }
        // Analyser l'héritage de chaque classe
        for (const file of files) {
            for (const cls of file.classes) {
                // Héritage (extends)
                if (cls.extends) {
                    const parentName = cls.extends;
                    const possibleIds = classNameToIds.get(parentName);
                    if (possibleIds && possibleIds.length === 1) {
                        inheritance.push({
                            child: cls.id,
                            parent: possibleIds[0]
                        });
                    }
                    else {
                        // Si pas trouvé, garder le nom du parent (peut être externe)
                        inheritance.push({
                            child: cls.id,
                            parent: parentName
                        });
                    }
                }
                // Implémentation d'interfaces (implements)
                if (cls.implements && cls.implements.length > 0) {
                    for (const interfaceName of cls.implements) {
                        const possibleIds = classNameToIds.get(interfaceName);
                        if (possibleIds && possibleIds.length === 1) {
                            inheritance.push({
                                child: cls.id,
                                parent: possibleIds[0]
                            });
                        }
                        else {
                            // Si pas trouvé, garder le nom de l'interface (peut être externe)
                            inheritance.push({
                                child: cls.id,
                                parent: interfaceName
                            });
                        }
                    }
                }
            }
        }
        if (this.config.verbose) {
            console.log(`  ✅ ${inheritance.length} relations d'héritage trouvées`);
        }
        return { imports, calls, inheritance };
    }
    /**
     * Calcule les métriques de qualité
     */
    async calculateMetrics(files) {
        if (this.config.verbose) {
            console.log('📊 Calcul des métriques...');
        }
        for (const file of files) {
            // 1. Complexité cyclomatique (simplifiée)
            let complexity = 0;
            // Pour les fichiers de code, calculer la complexité basée sur les fonctions
            if (file.type === 'code') {
                // Complexité basée sur le nombre de fonctions
                const functionCount = file.functions.length;
                const classCount = file.classes.length;
                // Complexité basée sur la taille du fichier
                const sizeComplexity = Math.min(file.lines / 100, 1.0); // 0-1
                // Complexité basée sur les imports
                const importComplexity = Math.min(file.imports.length / 20, 1.0); // 0-1
                // Calcul final de la complexité (0-1)
                complexity = Math.min((sizeComplexity * 0.4) +
                    (importComplexity * 0.3) +
                    ((functionCount + classCount) / 10 * 0.3), 1.0);
            }
            else {
                // Pour les fichiers non-code, complexité faible
                complexity = Math.min(file.lines / 200, 0.5);
            }
            // 2. Maintenabilité (inverse de la complexité, avec bonus pour documentation)
            let maintainability = 1.0 - complexity;
            // Bonus pour les fichiers de documentation
            if (file.type === 'doc') {
                maintainability = Math.min(maintainability + 0.2, 1.0);
            }
            // Bonus pour les fichiers de configuration
            if (file.type === 'config') {
                maintainability = Math.min(maintainability + 0.1, 1.0);
            }
            // Pénalité pour les fichiers très longs
            if (file.lines > 500) {
                maintainability = Math.max(maintainability - 0.2, 0.1);
            }
            // 3. Score de qualité global
            const quality = Math.min((maintainability * 0.6) +
                ((1.0 - complexity) * 0.4), 1.0);
            // Mettre à jour les scores du fichier
            file.score = {
                complexity,
                maintainability,
                quality
            };
            // Mettre à jour la complexité des fonctions
            for (const func of file.functions) {
                // Complexité de fonction basée sur le nombre de lignes
                const funcComplexity = Math.min(func.lines / 50, 1.0);
                func.complexity = funcComplexity;
            }
        }
        if (this.config.verbose) {
            console.log(`✅ Métriques calculées pour ${files.length} fichiers`);
        }
    }
    /**
     * Génère le résumé des statistiques
     */
    generateSummary(files, relations) {
        const totalFiles = files.length;
        const codeFiles = files.filter(f => f.type === 'code').length;
        const configFiles = files.filter(f => f.type === 'config').length;
        const docFiles = files.filter(f => f.type === 'doc').length;
        const functions = files.reduce((sum, f) => sum + f.functions.length, 0);
        const classes = files.reduce((sum, f) => sum + f.classes.length, 0);
        const imports = relations.imports.length;
        const calls = relations.calls.length;
        // Compter les interfaces (simplifié: classes qui implémentent des interfaces)
        const interfaces = files.reduce((sum, file) => {
            return sum + file.classes.reduce((clsSum, cls) => {
                return clsSum + (cls.implements ? cls.implements.length : 0);
            }, 0);
        }, 0);
        return {
            totalFiles,
            codeFiles,
            configFiles,
            docFiles,
            functions,
            classes,
            interfaces,
            imports,
            calls
        };
    }
}
//# sourceMappingURL=analyzer.js.map