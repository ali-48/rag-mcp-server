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
import { Project, SyntaxKind } from 'ts-morph';

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
 * Informations sur un export
 */
interface ExportInfo {
  name: string;
  type: SymbolKind;
  visibility: Visibility;
  lines: number;
}
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
 * Extrait les exports d'un fichier TypeScript
 */
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
  // À implémenter dans T007-T008
  return { imports: [], calls: [], inheritance: [] };
}

/**
 * Calcule les métriques de qualité
 */
async function calculateMetrics(files: FileInfo[]): Promise<void> {
  console.log('📊 Calcul des métriques...');
  // À implémenter dans T009
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
  // À implémenter dans T010
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
  // À implémenter dans T011
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
  // À implémenter dans T012
}

/**
 * Fonction principale
 */
async function main(): Promise<void> {
  console.log('🚀 Démarrage du Code Mapper...');
  
  // Configuration
  const rootDir = process.cwd();
  const outputDir = path.join(rootDir, 'audit');
  
  // Créer le dossier de sortie
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // 1. Scanner les fichiers
  const files = await scanFiles(rootDir);
  
  // 2. Initialiser ts-morph
  const project = new Project();
  
  // 3. Analyser les fichiers TypeScript
  await analyzeTypeScriptFiles(files, project);
  
  // 4. Construire les relations
  const relations = await buildRelations(files);
  
  // 5. Calculer les métriques
  await calculateMetrics(files);
  
  // 6. Générer les fichiers de sortie
  await generateJsonCodeMap(files, relations, path.join(outputDir, 'code_map.json'));
  await generateFreeMindMap(files, relations, path.join(outputDir, 'code_map.mm'));
  await generateSqliteDatabase(files, relations, path.join(outputDir, 'code_map.db'));
  
  console.log('🎉 Code Mapper terminé avec succès !');
  console.log(`📁 Fichiers générés dans : ${outputDir}`);
}

// Exécuter le script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
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
