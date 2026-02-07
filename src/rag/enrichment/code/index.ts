// src/rag/enrichment/code/index.ts
// Point d'entrée pour l'analyseur de code structurel

import { CallRelation, ClassInfo, CodeAnalyzer, CodeMap, FileInfo, FunctionInfo, ImportRelation, InheritanceRelation } from './analyzer';

export * from './analyzer';

/**
 * Fonction principale pour enrichir un codebase
 * Cette fonction est conçue pour être intégrée dans le pipeline RAG
 */
export async function enrichCodebase(input: {
  rootPath: string;
  mode: 'light' | 'full';
  verbose?: boolean;
}): Promise<{
  files: Array<{
    id: string;
    path: string;
    type: string;
    language?: string;
    lines: number;
    size: number;
    score: { complexity: number; maintainability: number; quality: number };
  }>;
  symbols: Array<{
    type: 'function' | 'class';
    id: string;
    name: string;
    fileId: string;
    visibility?: string;
    lines: number;
    complexity?: number;
    methods?: number;
    properties?: number;
  }>;
  relations: Array<{
    type: 'import' | 'call' | 'inheritance';
    from?: string;
    to?: string;
    importType?: string;
    caller?: string;
    callee?: string;
    file?: string;
    child?: string;
    parent?: string;
  }>;
  metrics: Array<{
    fileId: string;
    complexity: number;
    maintainability: number;
    quality: number;
  }>;
  timestamp: string;
}> {
  const analyzer = new CodeAnalyzer({
    verbose: input.verbose || false
  });

  const codeMap = await analyzer.analyzeProject(input.rootPath);

  // Transformer la carte de code en format enrichi pour le RAG
  const enriched = {
    files: codeMap.files.map((file: FileInfo) => ({
      id: file.id,
      path: file.path,
      type: file.type,
      language: file.language,
      lines: file.lines,
      size: file.size,
      score: file.score
    })),
    symbols: [
      ...codeMap.files.flatMap((file: FileInfo) =>
        file.functions.map((fn: FunctionInfo) => ({
          type: 'function' as const,
          id: fn.id,
          name: fn.name,
          fileId: file.id,
          visibility: fn.visibility,
          lines: fn.lines,
          complexity: fn.complexity
        }))
      ),
      ...codeMap.files.flatMap((file: FileInfo) =>
        file.classes.map((cls: ClassInfo) => ({
          type: 'class' as const,
          id: cls.id,
          name: cls.name,
          fileId: file.id,
          methods: cls.methods.length,
          properties: cls.properties.length,
          lines: cls.lines
        }))
      )
    ],
    relations: [
      ...codeMap.relations.imports.map((imp: ImportRelation) => ({
        type: 'import' as const,
        from: imp.from,
        to: imp.to,
        importType: imp.type
      })),
      ...codeMap.relations.calls.map((call: CallRelation) => ({
        type: 'call' as const,
        caller: call.caller,
        callee: call.callee,
        file: call.file
      })),
      ...codeMap.relations.inheritance.map((inh: InheritanceRelation) => ({
        type: 'inheritance' as const,
        child: inh.child,
        parent: inh.parent
      }))
    ],
    metrics: codeMap.files.map((file: FileInfo) => ({
      fileId: file.id,
      complexity: file.score.complexity,
      maintainability: file.score.maintainability,
      quality: file.score.quality
    })),
    timestamp: codeMap.project.date
  };

  return enriched;
}

/**
 * Fonction utilitaire pour résumer l'architecture
 */
export function summarizeArchitecture(codeMap: CodeMap): {
  hotspots: Array<{ fileId: string; path: string; complexity: number }>;
  risks: Array<{ fileId: string; path: string; quality: number }>;
  responsibilities: Array<{ fileId: string; path: string; functions: number; classes: number }>;
} {
  // Détecter les hotspots (fichiers complexes)
  const hotspots = codeMap.files
    .filter((file: FileInfo) => file.score.complexity > 0.7)
    .map((file: FileInfo) => ({
      fileId: file.id,
      path: file.path,
      complexity: file.score.complexity
    }))
    .sort((a: { complexity: number }, b: { complexity: number }) => b.complexity - a.complexity)
    .slice(0, 10);

  // Détecter les risques (fichiers de faible qualité)
  const risks = codeMap.files
    .filter((file: FileInfo) => file.score.quality < 0.5)
    .map((file: FileInfo) => ({
      fileId: file.id,
      path: file.path,
      quality: file.score.quality
    }))
    .sort((a: { quality: number }, b: { quality: number }) => a.quality - b.quality)
    .slice(0, 10);

  // Cartographier les responsabilités
  const responsibilities = codeMap.files
    .filter((file: FileInfo) => file.functions.length > 0 || file.classes.length > 0)
    .map((file: FileInfo) => ({
      fileId: file.id,
      path: file.path,
      functions: file.functions.length,
      classes: file.classes.length
    }))
    .sort((a: { functions: number; classes: number }, b: { functions: number; classes: number }) =>
      (b.functions + b.classes) - (a.functions + a.classes))
    .slice(0, 20);

  return { hotspots, risks, responsibilities };
}
