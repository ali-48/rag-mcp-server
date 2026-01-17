#!/usr/bin/env node
/**
 * Script d'audit : Code Mapper
 * Génère une cartographie technique complète du codebase
 * Formats : JSON canonique, FreeMind Mind Map, SQLite database
 *
 * Usage: npx tsx scripts/code-mapper.ts [--json] [--mm] [--sql] [--output-dir <path>]
 */

import * as fs from 'fs';
import * as path from 'path';
import { Project } from 'ts-morph';

// ============================================================================
// TYPES ET INTERFACES
// ============================================================================

/**
 * Type de fichier
 */
type FileType = 'code' | 'doc' | 'config' | 'other';

/**
 * Langage de programmation
 */
type Language = 'ts' | 'js' | 'json' | 'md' | 'yml' | 'yaml' | 'toml' | 'sql' | 'sh' | 'txt' | 'html' | 'css' | 'unknown';

/**
 * Visibilité d'un symbole
 */
type Visibility = 'public' | 'private' | 'protected';

/**
 * Type de symbole
 */
type SymbolKind = 'function' | 'class' | 'interface' | 'type' | 'variable' | 'enum' | 'namespace';

/**
 * Type d'import
 */
type ImportType = 'import' | 'require' | 'dynamic';

/**
 * Type d'appel
 */
type CallType = 'function' | 'method' | 'constructor' | 'async';

/**
 * Informations sur un fichier
 */
interface FileInfo {
  id: string;           // file_001, file_002, etc.
  path: string;         // Chemin relatif depuis la racine
  type: FileType;
  language?: Language;
  lines: number;
  size: number;
  imports: ImportInfo[];
  exports: ExportInfo[];    // Informations détaillées sur les exports
  functions: FunctionInfo[];
  classes: ClassInfo[];
  score: FileScore;
}

/**
 * Informations sur un import
 */
interface ImportInfo {
  module: string;       // Nom du module importé
  type: ImportType;
  names?: string[];     // Noms spécifiques importés
}

/**
 * Informations sur un export
 */
interface ExportInfo {
  name: string;
  type: SymbolKind;
  visibility: Visibility;
  lines: number;
}

/**
 * Informations sur une fonction
 */
interface FunctionInfo {
  id: string;           // fn_001, fn_002, etc.
  name: string;
  visibility: Visibility;
  lines: number;
  complexity: number;
  calls: string[];      // IDs des fonctions appelées
}

/**
 * Informations sur une classe
 */
interface ClassInfo {
  id: string;           // cls_001, cls_002, etc.
  name: string;
  methods: string[];
  properties: string[];
  lines: number;
  extends?: string;     // Classe parente
  implements?: string[]; // Interfaces implémentées
}

/**
 * Score de qualité d'un fichier
 */
interface FileScore {
  complexity: number;     // 0-1 (0 = simple, 1 = complexe)
  maintainability: number; // 0-1 (0 = difficile, 1 = facile)
  quality: number;        // 0-1 (0 = mauvaise, 1 = excellente)
}

/**
 * Relation d'import
 */
interface ImportRelation {
  from: string;         // ID du fichier source
  to: string;           // ID du fichier cible ou nom du module externe
  type: ImportType;
}

/**
 * Relation d'appel
 */
interface CallRelation {
  caller: string;       // ID de la fonction appelante
  callee: string;       // ID de la fonction appelée
  file: string;         // ID du fichier contenant l'appel
}

/**
 * Relation d'héritage
 */
interface InheritanceRelation {
  child: string;        // ID de la classe enfant
  parent: string;       // ID de la classe parente ou nom du module externe
}

/**
 * Carte de code complète
 */
interface CodeMap {
  project: {
    name: string;
    path: string;
    date: string;
    language: string;
  };
  summary: {
    totalFiles: number;
    codeFiles: number;
    configFiles: number;
    docFiles: number;
    functions: number;
    classes: number;
    interfaces: number;
    imports: number;
    calls: number;
  };
  files: FileInfo[];
  relations: {
    imports: ImportRelation[];
    calls: CallRelation[];
    inheritance: InheritanceRelation[];
  };
}

/**
 * Options pour l'exécution du Code Mapper
 */
interface RunCodeMapperOptions {
  /** Dossier racine à analyser (par défaut: process.cwd()) */
  rootDir?: string;
  /** Dossier de sortie pour les fichiers générés (par défaut: `${rootDir}/audit`) */
  outputDir?: string;
  /** Générer le fichier JSON (par défaut: true) */
  outputJson?: boolean;
  /** Générer le fichier FreeMind Mind Map (par défaut: true) */
  outputMindMap?: boolean;
  /** Générer la base de données SQLite (par défaut: true) */
  outputSqlite?: boolean;
  /** Nom du fichier JSON (par défaut: 'code_map.json') */
  jsonFileName?: string;
  /** Nom du fichier Mind Map (par défaut: 'code_map.mm') */
  mindMapFileName?: string;
  /** Nom du fichier SQLite (par défaut: 'code_map.db') */
  sqliteFileName?: string;
  /** Niveau de verbosité des logs (par défaut: 'normal') */
  verbose?: 'silent' | 'normal' | 'detailed';
  /** Forcer la régénération même si les fichiers existent (par défaut: false) */
  force?: boolean;
  /** Démarrer le watcher au lieu d'une exécution unique (par défaut: false) */
  watch?: boolean;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Dossiers à exclure de l'analyse
 */
const EXCLUDED_DIRS = [
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
const EXCLUDED_FILES = [
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
const INCLUDED_EXTENSIONS = [
  '.ts', '.js', '.json', '.md', '.yml', '.yaml', '.toml',
  '.sql', '.sh', '.txt', '.html', '.css'
];

/**
 * Mappage extension → langage
 */
const EXTENSION_TO_LANGUAGE: Record<string, Language> = {
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
const EXTENSION_TO_TYPE: Record<string, FileType> = {
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
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Vérifie si un fichier/dossier doit être exclu
 */
function shouldExclude(filePath: string, isDirectory: boolean): boolean {
  const name = path.basename(filePath);
  const dir = path.dirname(filePath);

  // Vérifier les dossiers exclus
  if (isDirectory && EXCLUDED_DIRS.includes(name)) {
    return true;
  }

  // Vérifier les fichiers exclus
  if (!isDirectory) {
    for (const pattern of EXCLUDED_FILES) {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        if (regex.test(name)) return true;
      } else if (name === pattern) {
        return true;
      }
    }

    // Vérifier les extensions incluses
    const ext = path.extname(name).toLowerCase();
    if (ext && !INCLUDED_EXTENSIONS.includes(ext)) {
      return true;
    }
  }

  return false;
}

/**
 * Détermine le type de fichier basé sur l'extension
 */
function getFileType(filePath: string): FileType {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_TO_TYPE[ext] || 'other';
}

/**
 * Détermine le langage basé sur l'extension
 */
function getLanguage(filePath: string): Language | undefined {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_TO_LANGUAGE[ext];
}

/**
 * Génère un ID unique pour un fichier
 */
function generateFileId(index: number): string {
  return `file_${String(index).padStart(3, '0')}`;
}

/**
 * Génère un ID unique pour une fonction
 */
function generateFunctionId(index: number): string {
  return `fn_${String(index).padStart(3, '0')}`;
}

/**
 * Génère un ID unique pour une classe
 */
function generateClassId(index: number): string {
  return `cls_${String(index).padStart(3, '0')}`;
}

// ============================================================================
// FONCTIONS PRINCIPALES
// ============================================================================

/**
 * Scanne récursivement les fichiers du projet
 */
async function scanFiles(rootDir: string): Promise<FileInfo[]> {
  console.log('📁 Scan des fichiers...');

  const files: FileInfo[] = [];
  let fileIndex = 0;

  function scanDirectory(dirPath: string): void {
    try {
      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const relativePath = path.relative(rootDir, fullPath);

        try {
          const stat = fs.statSync(fullPath);
          const isDirectory = stat.isDirectory();

          // Vérifier si l'élément doit être exclu
          if (shouldExclude(fullPath, isDirectory)) {
            continue;
          }

          if (isDirectory) {
            // Scanner récursivement les sous-dossiers
            scanDirectory(fullPath);
          } else {
            // Analyser le fichier
            fileIndex++;
            const fileInfo = analyzeFile(fullPath, relativePath, fileIndex, stat);
            files.push(fileInfo);

            // Afficher la progression
            if (fileIndex % 20 === 0) {
              console.log(`  📄 ${fileIndex} fichiers scannés...`);
            }
          }
        } catch (error: any) {
          console.warn(`⚠️  Impossible d'accéder à ${fullPath}:`, error.message);
        }
      }
    } catch (error: any) {
      console.error(`❌ Erreur lors du scan de ${dirPath}:`, error.message);
    }
  }

  // Démarrer le scan
  scanDirectory(rootDir);

  console.log(`✅ ${files.length} fichiers trouvés et analysés`);
  return files;
}

/**
 * Analyse un fichier individuel et extrait ses métadonnées
 */
function analyzeFile(
  filePath: string,
  relativePath: string,
  index: number,
  stat: fs.Stats
): FileInfo {
  // Lire le contenu pour compter les lignes
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').length;

  // Déterminer le type et le langage
  const fileType = getFileType(filePath);
  const language = getLanguage(filePath);

  // Générer l'ID unique
  const id = generateFileId(index);

  // Créer l'objet FileInfo
  const fileInfo: FileInfo = {
    id,
    path: relativePath,
    type: fileType,
    language,
    lines,
    size: stat.size,
    imports: [],      // Rempli par analyse TypeScript
    exports: [],      // Rempli par analyse TypeScript
    functions: [],    // Rempli par analyse TypeScript
    classes: [],      // Rempli par analyse TypeScript
    score: {
      complexity: 0,
      maintainability: 0,
      quality: 0
    }
  };

  return fileInfo;
}

/**
 * Analyse les fichiers TypeScript avec ts-morph
 */
async function analyzeTypeScriptFiles(files: FileInfo[], project: Project): Promise<void> {
  console.log('🔍 Analyse TypeScript...');

  let functionIndex = 0;
  let classIndex = 0;

  // Filtrer les fichiers TypeScript
  const tsFiles = files.filter(file => file.language === 'ts' || file.language === 'js');
  console.log(`  📄 ${tsFiles.length} fichiers TypeScript à analyser`);

  for (const file of tsFiles) {
    try {
      const sourceFile = project.addSourceFileAtPath(path.join(process.cwd(), file.path));

      // 1. Analyser les imports
      const imports = extractImports(sourceFile);
      file.imports = imports;

      // 2. Analyser les exports
      const exports = extractExports(sourceFile);
      file.exports = exports;

      // 3. Analyser les fonctions
      const functions = extractFunctions(sourceFile, functionIndex);
      file.functions = functions;
      functionIndex += functions.length;

      // 4. Analyser les classes
      const classes = extractClasses(sourceFile, classIndex);
      file.classes = classes;
      classIndex += classes.length;

      project.removeSourceFile(sourceFile);

    } catch (error: any) {
      console.warn(`⚠️  Impossible d'analyser ${file.path}:`, error.message);
    }
  }

  console.log(`✅ Analyse TypeScript terminée : ${functionIndex} fonctions, ${classIndex} classes`);
}

/**
 * Extrait les imports d'un fichier TypeScript
 */
function extractImports(sourceFile: any): ImportInfo[] {
  const imports: ImportInfo[] = [];

  // Imports ES6
  const importDeclarations = sourceFile.getImportDeclarations();
  for (const importDecl of importDeclarations) {
    const moduleSpecifier = importDecl.getModuleSpecifierValue();
    const namedImports = importDecl.getNamedImports();
    const defaultImport = importDecl.getDefaultImport();
    const namespaceImport = importDecl.getNamespaceImport();

    const names: string[] = [];
    if (defaultImport) names.push(defaultImport.getText());
    if (namespaceImport) names.push(`${namespaceImport.getText()}.*`);
    if (namedImports.length > 0) {
      namedImports.forEach((imp: any) => names.push(imp.getName()));
    }

    imports.push({
      module: moduleSpecifier,
      type: 'import',
      names: names.length > 0 ? names : undefined
    });
  }

  // Requires CommonJS (analyse basique)
  sourceFile.forEachDescendant((node: any) => {
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
 * Extrait les fonctions d'un fichier TypeScript
 */
function extractFunctions(sourceFile: any, startIndex: number): FunctionInfo[] {
  const functions: FunctionInfo[] = [];
  let currentIndex = startIndex;

  // Fonctions déclarées
  const functionDeclarations = sourceFile.getFunctions();
  for (const funcDecl of functionDeclarations) {
    const name = funcDecl.getName() || 'anonymous';
    const isExported = funcDecl.isExported();
    const isDefaultExport = funcDecl.isDefaultExport();

    functions.push({
      id: generateFunctionId(currentIndex),
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
function extractClasses(sourceFile: any, startIndex: number): ClassInfo[] {
  const classes: ClassInfo[] = [];
  let currentIndex = startIndex;

  const classDeclarations = sourceFile.getClasses();
  for (const classDecl of classDeclarations) {
    const name = classDecl.getName() || 'anonymous';
    const isExported = classDecl.isExported();
    const isDefaultExport = classDecl.isDefaultExport();

    // Méthodes
    const methods = classDecl.getMethods().map((method: any) => method.getName());

    // Propriétés
    const properties = classDecl.getProperties().map((prop: any) => prop.getName());

    // Héritage
    const extendsClause = classDecl.getExtends();
    const extendsName = extendsClause ? extendsClause.getText() : undefined;


    // Implémentation d'interfaces
    const implementsClauses = classDecl.getImplements();
    const implementsNames = implementsClauses ? implementsClauses.map((impl: any) => impl.getText()) : [];

    classes.push({
      id: generateClassId(currentIndex),
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
 * Compte le nombre de lignes d'un nœud AST
 */
function countLines(node: any): number {
  const start = node.getStartLineNumber();
  const end = node.getEndLineNumber();
  return end - start + 1;
}

/**
 * Construit les relations entre fichiers et symboles
 */
async function buildRelations(files: FileInfo[]): Promise<{
  imports: ImportRelation[];
  calls: CallRelation[];
  inheritance: InheritanceRelation[];
}> {
  console.log('🧩 Construction des relations...');

  const imports: ImportRelation[] = [];
  const calls: CallRelation[] = [];
  const inheritance: InheritanceRelation[] = [];

  // 1. Construire les relations d'imports
  console.log('  🔗 Analyse des imports...');

  // Créer un mapping chemin de fichier → ID
  const filePathToId = new Map<string, string>();
  for (const file of files) {
    filePathToId.set(file.path, file.id);
  }

  // Créer un mapping nom de fichier sans extension → ID(s)
  const fileNameToIds = new Map<string, string[]>();
  for (const file of files) {
    const fileName = path.basename(file.path, path.extname(file.path));
    if (!fileNameToIds.has(fileName)) {
      fileNameToIds.set(fileName, []);
    }
    fileNameToIds.get(fileName)!.push(file.id);
  }

  // Analyser les imports de chaque fichier
  for (const file of files) {
    for (const importInfo of file.imports) {
      const moduleName = importInfo.module;

      // Essayer de trouver le fichier cible
      let targetFileId: string | undefined;

      // Cas 1: Import relatif (commence par ./ ou ../)
      if (moduleName.startsWith('./') || moduleName.startsWith('../')) {
        // Résoudre le chemin relatif
        const dir = path.dirname(file.path);
        const resolvedPath = path.resolve('/', dir, moduleName);
        const relativePath = path.relative('/', resolvedPath).replace(/^\//, '');

        // Chercher le fichier exact
        if (filePathToId.has(relativePath)) {
          targetFileId = filePathToId.get(relativePath);
        } else {
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

  console.log(`  ✅ ${imports.length} relations d'imports trouvées`);

  // 2. Construire les relations d'appels
  console.log('  📞 Analyse des appels...');

  // Créer un mapping nom de fonction → ID(s)
  const functionNameToIds = new Map<string, string[]>();
  for (const file of files) {
    for (const func of file.functions) {
      if (!functionNameToIds.has(func.name)) {
        functionNameToIds.set(func.name, []);
      }
      functionNameToIds.get(func.name)!.push(func.id);
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

  console.log(`  ✅ ${calls.length} relations d'appels trouvées`);

  // 3. Construire les relations d'héritage
  console.log('  🏛️  Analyse de l\'héritage...');

  // Créer un mapping nom de classe → ID(s)
  const classNameToIds = new Map<string, string[]>();
  for (const file of files) {
    for (const cls of file.classes) {
      if (!classNameToIds.has(cls.name)) {
        classNameToIds.set(cls.name, []);
      }
      classNameToIds.get(cls.name)!.push(cls.id);
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
        } else {
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
          } else {
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

  console.log(`  ✅ ${inheritance.length} relations d'héritage trouvées`);

  return { imports, calls, inheritance };
}

/**
 * Calcule les métriques de qualité
 */
async function calculateMetrics(files: FileInfo[]): Promise<void> {
  console.log('📊 Calcul des métriques...');

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
      complexity = Math.min(
        (sizeComplexity * 0.4) +
        (importComplexity * 0.3) +
        ((functionCount + classCount) / 10 * 0.3),
        1.0
      );
    } else {
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
    const quality = Math.min(
      (maintainability * 0.6) +
      ((1.0 - complexity) * 0.4),
      1.0
    );

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

  console.log(`✅ Métriques calculées pour ${files.length} fichiers`);
}

/**
 * Génère le fichier JSON canonique
 */
async function generateJsonCodeMap(
  files: FileInfo[],
  relations: { imports: ImportRelation[]; calls: CallRelation[]; inheritance: InheritanceRelation[] },
  outputPath: string
): Promise<void> {
  console.log('📄 Génération JSON...');

  // Compter les statistiques
  const totalFiles = files.length;
  const codeFiles = files.filter(f => f.type === 'code').length;
  const configFiles = files.filter(f => f.type === 'config').length;
  const docFiles = files.filter(f => f.type === 'doc').length;
  const totalFunctions = files.reduce((sum, f) => sum + f.functions.length, 0);
  const totalClasses = files.reduce((sum, f) => sum + f.classes.length, 0);
  const totalImports = relations.imports.length;
  const totalCalls = relations.calls.length;

  // Créer l'objet CodeMap
  const codeMap: CodeMap = {
    project: {
      name: path.basename(process.cwd()),
      path: process.cwd(),
      date: new Date().toISOString(),
      language: 'TypeScript/JavaScript'
    },
    summary: {
      totalFiles,
      codeFiles,
      configFiles,
      docFiles,
      functions: totalFunctions,
      classes: totalClasses,
      interfaces: 0, // À calculer si nécessaire
      imports: totalImports,
      calls: totalCalls
    },
    files: files.map(file => ({
      ...file,
      // S'assurer que les fonctions ont leurs appels mis à jour
      functions: file.functions.map(func => ({
        ...func,
        // Mettre à jour les appels avec les relations trouvées
        calls: relations.calls
          .filter(call => call.caller === func.id)
          .map(call => call.callee)
      }))
    })),
    relations
  };

  // Écrire le fichier JSON
  const jsonContent = JSON.stringify(codeMap, null, 2);
  fs.writeFileSync(outputPath, jsonContent, 'utf8');

  console.log(`✅ JSON généré : ${outputPath} (${jsonContent.length} octets)`);
}

/**
 * Génère le fichier FreeMind Mind Map
 */
async function generateFreeMindMap(
  files: FileInfo[],
  relations: { imports: ImportRelation[]; calls: CallRelation[]; inheritance: InheritanceRelation[] },
  outputPath: string
): Promise<void> {
  console.log('🗺️ Génération Mind Map...');

  // Fonction pour échapper les caractères XML
  function escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
  // Fonction pour créer un nœud FreeMind
  function createNode(text: string, attributes: Record<string, string> = {}): string {
    const attrs = Object.entries(attributes)
      .map(([key, value]) => `${key}="${escapeXml(value)}"`)
      .join(' ');

    return `<node ${attrs}><![CDATA[${text}]]></node>`;
  }

  // Fonction pour créer un nœud avec score de couleur
  function createScoreNode(score: number, label: string): string {
    // Déterminer la couleur basée sur le score (0-1)
    let color: string;
    if (score >= 0.8) color = '#00FF00'; // Vert
    else if (score >= 0.6) color = '#FFFF00'; // Jaune
    else if (score >= 0.4) color = '#FFA500'; // Orange
    else color = '#FF0000'; // Rouge

    return createNode(`${label}: ${score.toFixed(2)}`, { COLOR: color });
  }

  // Construire le XML
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.0.1">
  ${createNode('Code Map', { CREATED: Date.now().toString() })}
`;

  // Ajouter le nœud racine
  const rootNode = createNode('Projet', { FOLDED: 'false' });
  xml += `  <node TEXT="Projet" FOLDED="false">\n`;

  // 1. Statistiques du projet
  const totalFiles = files.length;
  const totalFunctions = files.reduce((sum, f) => sum + f.functions.length, 0);
  const totalClasses = files.reduce((sum, f) => sum + f.classes.length, 0);
  const totalImports = relations.imports.length;
  const totalCalls = relations.calls.length;

  xml += `    ${createNode('Statistiques')}\n`;
  xml += `      ${createNode(`Fichiers: ${totalFiles}`)}\n`;
  xml += `      ${createNode(`Fonctions: ${totalFunctions}`)}\n`;
  xml += `      ${createNode(`Classes: ${totalClasses}`)}\n`;
  xml += `      ${createNode(`Imports: ${totalImports}`)}\n`;
  xml += `      ${createNode(`Appels: ${totalCalls}`)}\n`;

  // 2. Fichiers par type
  const filesByType = files.reduce((acc, file) => {
    acc[file.type] = (acc[file.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  xml += `    ${createNode('Fichiers par type')}\n`;
  for (const [type, count] of Object.entries(filesByType)) {
    xml += `      ${createNode(`${type}: ${count}`)}\n`;
  }

  // 3. Hiérarchie des fichiers
  xml += `    ${createNode('Fichiers', { FOLDED: 'true' })}\n`;

  for (const file of files) {
    // Déterminer l'icône basée sur le type de fichier
    let icon = 'folder';
    if (file.type === 'code') icon = 'code';
    else if (file.type === 'config') icon = 'config';
    else if (file.type === 'doc') icon = 'doc';

    xml += `      ${createNode(file.path, { FOLDED: 'true', ICON: icon })}\n`;

    // Métriques du fichier
    xml += `        ${createScoreNode(file.score.quality, 'Qualité')}\n`;
    xml += `        ${createScoreNode(file.score.maintainability, 'Maintenabilité')}\n`;
    xml += `        ${createScoreNode(file.score.complexity, 'Complexité')}\n`;
    xml += `        ${createNode(`Lignes: ${file.lines}`)}\n`;
    xml += `        ${createNode(`Taille: ${file.size} octets`)}\n`;

    // Fonctions du fichier
    if (file.functions.length > 0) {
      xml += `        ${createNode('Fonctions', { FOLDED: 'true' })}\n`;
      for (const func of file.functions) {
        xml += `          ${createNode(func.name, { FOLDED: 'true' })}\n`;
        xml += `            ${createNode(`Visibilité: ${func.visibility}`)}\n`;
        xml += `            ${createNode(`Lignes: ${func.lines}`)}\n`;
        xml += `            ${createScoreNode(func.complexity, 'Complexité')}\n`;
        xml += `            ${createNode(`Appels: ${func.calls.length}`)}\n`;
      }
    }

    // Classes du fichier
    if (file.classes.length > 0) {
      xml += `        ${createNode('Classes', { FOLDED: 'true' })}\n`;
      for (const cls of file.classes) {
        xml += `          ${createNode(cls.name, { FOLDED: 'true' })}\n`;
        xml += `            ${createNode(`Méthodes: ${cls.methods.length}`)}\n`;
        xml += `            ${createNode(`Propriétés: ${cls.properties.length}`)}\n`;
        xml += `            ${createNode(`Lignes: ${cls.lines}`)}\n`;
        if (cls.extends) {
          xml += `            ${createNode(`Extends: ${cls.extends}`)}\n`;
        }
        if (cls.implements && cls.implements.length > 0) {
          xml += `            ${createNode(`Implements: ${cls.implements.join(', ')}`)}\n`;
        }
      }
    }
  }

  // 4. Relations
  xml += `    ${createNode('Relations', { FOLDED: 'true' })}\n`;

  // Imports
  if (relations.imports.length > 0) {
    xml += `      ${createNode('Imports', { FOLDED: 'true' })}\n`;
    for (const imp of relations.imports.slice(0, 20)) { // Limiter à 20 pour éviter un fichier trop gros
      xml += `        ${createNode(`${imp.from} → ${imp.to}`)}\n`;
    }
    if (relations.imports.length > 20) {
      xml += `        ${createNode(`... et ${relations.imports.length - 20} autres`)}\n`;
    }
  }

  // Appels
  if (relations.calls.length > 0) {
    xml += `      ${createNode('Appels', { FOLDED: 'true' })}\n`;
    for (const call of relations.calls.slice(0, 20)) { // Limiter à 20
      xml += `        ${createNode(`${call.caller} → ${call.callee}`)}\n`;
    }
    if (relations.calls.length > 20) {
      xml += `        ${createNode(`... et ${relations.calls.length - 20} autres`)}\n`;
    }
  }

  // Héritage
  if (relations.inheritance.length > 0) {
    xml += `      ${createNode('Héritage', { FOLDED: 'true' })}\n`;
    for (const inh of relations.inheritance.slice(0, 20)) { // Limiter à 20
      xml += `        ${createNode(`${inh.child} → ${inh.parent}`)}\n`;
    }
    if (relations.inheritance.length > 20) {
      xml += `        ${createNode(`... et ${relations.inheritance.length - 20} autres`)}\n`;
    }
  }

  // Fermer les balises
  xml += `  </node>\n`;
  xml += `</map>`;

  // Écrire le fichier
  fs.writeFileSync(outputPath, xml, 'utf8');

  console.log(`✅ Mind Map générée : ${outputPath} (${xml.length} octets)`);
}

/**
 * Génère la base de données SQLite
 */
async function generateSqliteDatabase(
  files: FileInfo[],
  relations: { imports: ImportRelation[]; calls: CallRelation[]; inheritance: InheritanceRelation[] },
  outputPath: string
): Promise<void> {
  console.log('💾 Génération base SQLite...');

  // Importer sqlite3 (CommonJS) dans un module ES
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const sqlite3 = require('sqlite3');

  // Créer/ouvrir la base de données
  const db = new sqlite3.Database(outputPath);

  // Activer les clés étrangères
  db.run('PRAGMA foreign_keys = ON');

  // Supprimer les tables existantes (pour éviter les contraintes d'unicité)
  await new Promise<void>((resolve, reject) => {
    db.serialize(() => {
      db.run('DROP TABLE IF EXISTS inheritance');
      db.run('DROP TABLE IF EXISTS calls');
      db.run('DROP TABLE IF EXISTS imports');
      db.run('DROP TABLE IF EXISTS classes');
      db.run('DROP TABLE IF EXISTS functions');
      db.run('DROP TABLE IF EXISTS files');
      resolve();
    });
  });

  // Créer les tables
  await new Promise<void>((resolve, reject) => {
    db.serialize(() => {
      // Table des fichiers
      db.run(`
        CREATE TABLE files (
          id TEXT PRIMARY KEY,
          path TEXT NOT NULL,
          type TEXT NOT NULL,
          language TEXT,
          lines INTEGER NOT NULL,
          size INTEGER NOT NULL,
          complexity REAL NOT NULL,
          maintainability REAL NOT NULL,
          quality REAL NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Table des fonctions
      db.run(`
        CREATE TABLE functions (
          id TEXT PRIMARY KEY,
          file_id TEXT NOT NULL,
          name TEXT NOT NULL,
          visibility TEXT NOT NULL,
          lines INTEGER NOT NULL,
          complexity REAL NOT NULL,
          FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
        )
      `);

      // Table des classes
      db.run(`
        CREATE TABLE classes (
          id TEXT PRIMARY KEY,
          file_id TEXT NOT NULL,
          name TEXT NOT NULL,
          methods_count INTEGER NOT NULL,
          properties_count INTEGER NOT NULL,
          lines INTEGER NOT NULL,
          extends TEXT,
          implements TEXT,
          FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
        )
      `);

      // Table des imports
      db.run(`
        CREATE TABLE imports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          from_file_id TEXT NOT NULL,
          to_file_id TEXT,
          module TEXT NOT NULL,
          type TEXT NOT NULL,
          FOREIGN KEY (from_file_id) REFERENCES files(id) ON DELETE CASCADE,
          FOREIGN KEY (to_file_id) REFERENCES files(id) ON DELETE CASCADE
        )
      `);

      // Table des appels
      db.run(`
        CREATE TABLE calls (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          caller_id TEXT NOT NULL,
          callee_id TEXT NOT NULL,
          file_id TEXT NOT NULL,
          FOREIGN KEY (caller_id) REFERENCES functions(id) ON DELETE CASCADE,
          FOREIGN KEY (callee_id) REFERENCES functions(id) ON DELETE CASCADE,
          FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
        )
      `);

      // Table d'héritage
      db.run(`
        CREATE TABLE inheritance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          child_id TEXT NOT NULL,
          parent_id TEXT,
          parent_name TEXT,
          FOREIGN KEY (child_id) REFERENCES classes(id) ON DELETE CASCADE,
          FOREIGN KEY (parent_id) REFERENCES classes(id) ON DELETE CASCADE
        )
      `);

      // Créer les index pour améliorer les performances
      db.run('CREATE INDEX idx_files_type ON files(type)');
      db.run('CREATE INDEX idx_functions_file_id ON functions(file_id)');
      db.run('CREATE INDEX idx_classes_file_id ON classes(file_id)');
      db.run('CREATE INDEX idx_imports_from ON imports(from_file_id)');
      db.run('CREATE INDEX idx_imports_to ON imports(to_file_id)');
      db.run('CREATE INDEX idx_calls_caller ON calls(caller_id)');
      db.run('CREATE INDEX idx_calls_callee ON calls(callee_id)');
      db.run('CREATE INDEX idx_inheritance_child ON inheritance(child_id)');
      db.run('CREATE INDEX idx_inheritance_parent ON inheritance(parent_id)');

      resolve();
    });
  });

  // Remplir les tables
  console.log('  📊 Insertion des données...');

  // 1. Insérer les fichiers
  for (const file of files) {
    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO files (id, path, type, language, lines, size, complexity, maintainability, quality)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          file.id,
          file.path,
          file.type,
          file.language || null,
          file.lines,
          file.size,
          file.score.complexity,
          file.score.maintainability,
          file.score.quality
        ],
        (err: any) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // 2. Insérer les fonctions
  for (const file of files) {
    for (const func of file.functions) {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO functions (id, file_id, name, visibility, lines, complexity)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            func.id,
            file.id,
            func.name,
            func.visibility,
            func.lines,
            func.complexity
          ],
          (err: any) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
  }

  // 3. Insérer les classes
  for (const file of files) {
    for (const cls of file.classes) {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO classes (id, file_id, name, methods_count, properties_count, lines, extends, implements)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            cls.id,
            file.id,
            cls.name,
            cls.methods.length,
            cls.properties.length,
            cls.lines,
            cls.extends || null,
            cls.implements ? cls.implements.join(', ') : null
          ],
          (err: any) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
  }

  // 4. Insérer les imports
  for (const imp of relations.imports) {
    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO imports (from_file_id, to_file_id, module, type)
         VALUES (?, ?, ?, ?)`,
        [
          imp.from,
          imp.to.startsWith('file_') ? imp.to : null,
          imp.to.startsWith('file_') ? imp.to : 'external',
          imp.type
        ],
        (err: any) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // 5. Insérer les appels
  for (const call of relations.calls) {
    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO calls (caller_id, callee_id, file_id)
         VALUES (?, ?, ?)`,
        [call.caller, call.callee, call.file],
        (err: any) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // 6. Insérer l'héritage
  for (const inh of relations.inheritance) {
    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO inheritance (child_id, parent_id, parent_name)
         VALUES (?, ?, ?)`,
        [
          inh.child,
          inh.parent.startsWith('cls_') ? inh.parent : null,
          inh.parent.startsWith('cls_') ? null : inh.parent
        ],
        (err: any) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // Fermer la base de données
  await new Promise<void>((resolve, reject) => {
    db.close((err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });

  console.log(`✅ Base SQLite générée : ${outputPath}`);
}

/**
 * Fonction principale réutilisable pour exécuter le Code Mapper
 */
async function runCodeMapper(options: RunCodeMapperOptions = {}): Promise<{
  success: boolean;
  files?: FileInfo[];
  relations?: {
    imports: ImportRelation[];
    calls: CallRelation[];
    inheritance: InheritanceRelation[];
  };
  generatedFiles?: string[];
  error?: Error;
  exitCode?: number;
}> {
  const startTime = Date.now();
  const logsDir = path.join(options.outputDir || path.join(options.rootDir || process.cwd(), 'audit'), 'logs');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFileName = `audit_${timestamp}.log`;
  const logFilePath = path.join(logsDir, logFileName);

  // Configuration par défaut
  const config: Required<RunCodeMapperOptions> = {
    rootDir: options.rootDir || process.cwd(),
    outputDir: options.outputDir || path.join(options.rootDir || process.cwd(), 'audit'),
    outputJson: options.outputJson !== undefined ? options.outputJson : true,
    outputMindMap: options.outputMindMap !== undefined ? options.outputMindMap : true,
    outputSqlite: options.outputSqlite !== undefined ? options.outputSqlite : true,
    jsonFileName: options.jsonFileName || 'code_map.json',
    mindMapFileName: options.mindMapFileName || 'code_map.mm',
    sqliteFileName: options.sqliteFileName || 'code_map.db',
    verbose: options.verbose || 'normal',
    force: options.force || false,
    watch: options.watch || false
  };

  // Fonction pour écrire dans le fichier de log
  const writeToLogFile = (level: string, message: string, data?: any) => {
    try {
      // Créer le dossier de logs si nécessaire
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        data: data ? JSON.stringify(data, null, 2) : undefined
      };
      const logLine = JSON.stringify(logEntry) + '\n';
      fs.appendFileSync(logFilePath, logLine, 'utf8');
    } catch (error) {
      // Si on ne peut pas écrire dans le fichier de log, on ignore silencieusement
    }
  };

  // Fonction de log conditionnelle
  const log = (message: string, level: 'info' | 'warn' | 'error' = 'info', data?: any) => {
    // Écrire dans le fichier de log
    writeToLogFile(level, message, data);

    // Afficher dans la console selon le niveau de verbosité
    if (config.verbose === 'silent') return;
    if (config.verbose === 'detailed' || level !== 'info') {
      const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️';
      console.log(`${prefix} ${message}`);
      if (data && config.verbose === 'detailed') {
        console.log(JSON.stringify(data, null, 2));
      }
    } else if (level === 'info') {
      console.log(message);
    }
  };

  // Fonction pour capturer les erreurs silencieusement
  const captureError = (error: Error, context: string, exitCode = 1): { success: false; error: Error; exitCode: number } => {
    log(`Erreur dans ${context}: ${error.message}`, 'error', {
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    });

    return {
      success: false,
      error,
      exitCode
    };
  };

  try {
    log('🚀 Démarrage du Code Mapper...');

    // Créer le dossier de sortie
    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true });
      log(`📁 Dossier de sortie créé : ${config.outputDir}`);
    }

    // 1. Scanner les fichiers
    const files = await scanFiles(config.rootDir);

    // 2. Initialiser ts-morph
    const project = new Project();

    // 3. Analyser les fichiers TypeScript
    await analyzeTypeScriptFiles(files, project);

    // 4. Construire les relations
    const relations = await buildRelations(files);

    // 5. Calculer les métriques
    await calculateMetrics(files);

    // 6. Générer les fichiers de sortie
    const generatedFiles: string[] = [];

    if (config.outputJson) {
      const jsonPath = path.join(config.outputDir, config.jsonFileName);
      await generateJsonCodeMap(files, relations, jsonPath);
      generatedFiles.push(jsonPath);
    }

    if (config.outputMindMap) {
      const mindMapPath = path.join(config.outputDir, config.mindMapFileName);
      await generateFreeMindMap(files, relations, mindMapPath);
      generatedFiles.push(mindMapPath);
    }

    if (config.outputSqlite) {
      const sqlitePath = path.join(config.outputDir, config.sqliteFileName);
      await generateSqliteDatabase(files, relations, sqlitePath);
      generatedFiles.push(sqlitePath);
    }

    const duration = Date.now() - startTime;
    log(`🎉 Code Mapper terminé avec succès en ${duration}ms !`);
    log(`📁 Fichiers générés dans : ${config.outputDir}`);

    return {
      success: true,
      files,
      relations,
      generatedFiles
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    log(`❌ Code Mapper échoué après ${duration}ms : ${error.message}`, 'error');

    return {
      success: false,
      error,
      generatedFiles: []
    };
  }
}

/**
 * Parse les arguments CLI
 */
function parseCliArgs(): RunCodeMapperOptions {
  const args = process.argv.slice(2);
  const options: RunCodeMapperOptions = {};

  // Flags pour les formats de sortie
  let outputJson: boolean | undefined;
  let outputMindMap: boolean | undefined;
  let outputSqlite: boolean | undefined;

  // Flags pour l'automatisation
  let autoMode = false;

  // Analyser les arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);

      case '--version':
      case '-v':
        showVersion();
        process.exit(0);

      case '--output-all':
        outputJson = true;
        outputMindMap = true;
        outputSqlite = true;
        break;

      case '--output-json':
        outputJson = true;
        break;

      case '--output-mindmap':
        outputMindMap = true;
        break;

      case '--output-sqlite':
        outputSqlite = true;
        break;

      case '--auto':
        autoMode = true;
        break;

      case '--verbose':
        options.verbose = 'detailed';
        break;

      case '--silent':
        options.verbose = 'silent';
        break;

      case '--force':
        options.force = true;
        break;

      case '--output-dir':
        if (i + 1 < args.length) {
          options.outputDir = args[++i];
        } else {
          console.error('❌ Erreur: --output-dir nécessite un chemin');
          process.exit(1);
        }
        break;

      case '--root-dir':
        if (i + 1 < args.length) {
          options.rootDir = args[++i];
        } else {
          console.error('❌ Erreur: --root-dir nécessite un chemin');
          process.exit(1);
        }
        break;

      case '--watch':
        options.watch = true;
        break;

      default:
        if (arg.startsWith('--')) {
          console.warn(`⚠️  Avertissement: option inconnue '${arg}'`);
        }
        break;
    }
  }

  // Mode auto: générer tous les formats
  if (autoMode) {
    outputJson = true;
    outputMindMap = true;
    outputSqlite = true;
  }

  // Si aucun format spécifié, utiliser tous par défaut
  if (outputJson === undefined && outputMindMap === undefined && outputSqlite === undefined) {
    outputJson = true;
    outputMindMap = true;
    outputSqlite = true;
  }

  // Appliquer les formats (si un format est spécifié, les autres sont désactivés par défaut)
  if (outputJson !== undefined) {
    options.outputJson = outputJson;
    // Si outputJson est true et que les autres ne sont pas spécifiés, les désactiver
    if (outputJson && outputMindMap === undefined && outputSqlite === undefined) {
      options.outputMindMap = false;
      options.outputSqlite = false;
    }
  }

  if (outputMindMap !== undefined) {
    options.outputMindMap = outputMindMap;
    // Si outputMindMap est true et que les autres ne sont pas spécifiés, les désactiver
    if (outputMindMap && outputJson === undefined && outputSqlite === undefined) {
      options.outputJson = false;
      options.outputSqlite = false;
    }
  }

  if (outputSqlite !== undefined) {
    options.outputSqlite = outputSqlite;
    // Si outputSqlite est true et que les autres ne sont pas spécifiés, les désactiver
    if (outputSqlite && outputJson === undefined && outputMindMap === undefined) {
      options.outputJson = false;
      options.outputMindMap = false;
    }
  }

  return options;
}

/**
 * Affiche l'aide
 */
function showHelp(): void {
  console.log(`
Usage: npx tsx scripts/code-mapper.ts [options]

Options:
  --help, -h                Affiche cette aide
  --version, -v             Affiche la version
  --output-all              Génère tous les formats (JSON, Mind Map, SQLite)
  --output-json             Génère uniquement le fichier JSON
  --output-mindmap          Génère uniquement le fichier Mind Map
  --output-sqlite           Génère uniquement la base SQLite
  --auto                    Mode automatique (équivalent à --output-all)
  --verbose                 Affiche les logs détaillés
  --silent                  Mode silencieux (pas de logs)
  --force                   Force la régénération même si les fichiers existent
  --output-dir <path>       Dossier de sortie (par défaut: ./audit)
  --root-dir <path>         Dossier racine à analyser (par défaut: .)
  --watch                   Démarrer le watcher au lieu d'une exécution unique

Exemples:
  npx tsx scripts/code-mapper.ts --output-json
  npx tsx scripts/code-mapper.ts --output-all --verbose
  npx tsx scripts/code-mapper.ts --auto --silent
  npx tsx scripts/code-mapper.ts --output-dir ./reports --root-dir ../other-project
  npx tsx scripts/code-mapper.ts --watch --verbose
`);
}

/**
 * Affiche la version
 */
function showVersion(): void {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  console.log(`Code Mapper v${packageJson.version}`);
}

/**
 * Fonction principale (compatibilité ascendante)
 */
async function main(): Promise<void> {
  // Analyser les arguments CLI
  const options = parseCliArgs();

  // Si l'option --watch est activée, démarrer le watcher
  if (options.watch) {
    await startWatcher(options);
    return;
  }

  // Sinon, exécuter le Code Mapper normalement
  const result = await runCodeMapper(options);

  if (!result.success) {
    console.error('❌ Erreur fatale:', result.error);
    process.exit(result.exitCode || 1);
  }
}

// Exécuter le script
main().catch(error => {
  console.error('❌ Erreur fatale non capturée:', error);
  process.exit(1);
});

/**
 * Démarre un watcher pour surveiller les changements de fichiers
 */
async function startWatcher(options: RunCodeMapperOptions = {}): Promise<void> {
  const config: Required<RunCodeMapperOptions> = {
    rootDir: options.rootDir || process.cwd(),
    outputDir: options.outputDir || path.join(options.rootDir || process.cwd(), 'audit'),
    outputJson: options.outputJson !== undefined ? options.outputJson : true,
    outputMindMap: options.outputMindMap !== undefined ? options.outputMindMap : true,
    outputSqlite: options.outputSqlite !== undefined ? options.outputSqlite : true,
    jsonFileName: options.jsonFileName || 'code_map.json',
    mindMapFileName: options.mindMapFileName || 'code_map.mm',
    sqliteFileName: options.sqliteFileName || 'code_map.db',
    verbose: options.verbose || 'normal',
    force: options.force || false,
    watch: options.watch || false
  };

  console.log('👁️  Démarrage du watcher...');
  console.log(`📁 Surveillance du dossier : ${config.rootDir}`);
  console.log('⏳ Le watcher est actif. Appuyez sur Ctrl+C pour arrêter.');

  // Débouncing pour éviter les exécutions multiples
  let debounceTimer: NodeJS.Timeout | null = null;
  const DEBOUNCE_DELAY = 2000; // 2 secondes

  // Fonction pour exécuter le Code Mapper
  const executeCodeMapper = async () => {
    console.log('🔄 Changement détecté, exécution du Code Mapper...');
    try {
      const result = await runCodeMapper(config);
      if (result.success) {
        console.log('✅ Code Mapper exécuté avec succès !');
      } else {
        console.error('❌ Code Mapper échoué :', result.error?.message);
      }
    } catch (error: any) {
      console.error('❌ Erreur lors de l\'exécution du Code Mapper :', error.message);
    }
  };

  // Configurer le watcher avec chokidar
  const chokidar = await import('chokidar');

  const watcher = chokidar.watch(config.rootDir, {
    ignored: [
      /(^|[\/\\])\../, // Fichiers cachés
      '**/node_modules/**',
      '**/.git/**',
      '**/build/**',
      '**/build-test/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.nyc_output/**',
      '**/.vscode/**',
      '**/logs/**',
      '**/audit/**',
      '**/test/**',
      '**/test-data/**',
      '**/test-chuking/**',
      '**/archived-tests/**'
    ],
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 100
    }
  });

  // Écouter les événements
  watcher
    .on('add', (path) => {
      console.log(`📄 Fichier ajouté : ${path}`);
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(executeCodeMapper, DEBOUNCE_DELAY);
    })
    .on('change', (path) => {
      console.log(`✏️  Fichier modifié : ${path}`);
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(executeCodeMapper, DEBOUNCE_DELAY);
    })
    .on('unlink', (path) => {
      console.log(`🗑️  Fichier supprimé : ${path}`);
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(executeCodeMapper, DEBOUNCE_DELAY);
    })
    .on('error', (error) => {
      console.error('❌ Erreur du watcher :', error);
    });

  // Gérer l'arrêt propre
  process.on('SIGINT', () => {
    console.log('\n👋 Arrêt du watcher...');
    watcher.close().then(() => {
      console.log('✅ Watcher arrêté proprement.');
      process.exit(0);
    });
  });

  // Attendre indéfiniment
  await new Promise(() => { });
}

/**
 * Extrait les exports d'un fichier TypeScript
 */
function extractExports(sourceFile: any): ExportInfo[] {
  const exports: ExportInfo[] = [];

  // Fonction pour déterminer le type d'un nœud
  function getNodeType(node: any): SymbolKind {
    const kindName = node.getKindName();
    if (kindName.includes('Function')) return 'function';
    if (kindName.includes('Class')) return 'class';
    if (kindName.includes('Interface')) return 'interface';
    if (kindName.includes('TypeAlias')) return 'type';
    if (kindName.includes('Variable')) return 'variable';
    if (kindName.includes('Enum')) return 'enum';
    if (kindName.includes('Module')) return 'namespace';
    return 'function'; // fallback
  }

  // Fonction pour déterminer la visibilité
  function getVisibility(node: any): Visibility {
    const modifiers = node.getModifiers();
    const isExported = node.isExported();
    const isDefaultExport = node.isDefaultExport();

    if (isExported || isDefaultExport) return 'public';

    // Vérifier les modificateurs TypeScript
    for (const mod of modifiers) {
      const text = mod.getText();
      if (text === 'private') return 'private';
      if (text === 'protected') return 'protected';
    }

    return 'private';
  }

  // Exports nommés
  const exportDeclarations = sourceFile.getExportDeclarations();
  for (const exportDecl of exportDeclarations) {
    const namedExports = exportDecl.getNamedExports();
    if (namedExports) {
      namedExports.forEach((exp: any) => {
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
  sourceFile.forEachDescendant((node: any) => {
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
