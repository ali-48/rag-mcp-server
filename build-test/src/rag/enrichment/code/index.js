// src/rag/enrichment/code/index.ts
// Point d'entrée pour l'analyseur de code structurel
import { CodeAnalyzer } from './analyzer';
export * from './analyzer';
/**
 * Fonction principale pour enrichir un codebase
 * Cette fonction est conçue pour être intégrée dans le pipeline RAG
 */
export async function enrichCodebase(input) {
    const analyzer = new CodeAnalyzer({
        verbose: input.verbose || false
    });
    const codeMap = await analyzer.analyzeProject(input.rootPath);
    // Transformer la carte de code en format enrichi pour le RAG
    const enriched = {
        files: codeMap.files.map((file) => ({
            id: file.id,
            path: file.path,
            type: file.type,
            language: file.language,
            lines: file.lines,
            size: file.size,
            score: file.score
        })),
        symbols: [
            ...codeMap.files.flatMap((file) => file.functions.map((fn) => ({
                type: 'function',
                id: fn.id,
                name: fn.name,
                fileId: file.id,
                visibility: fn.visibility,
                lines: fn.lines,
                complexity: fn.complexity
            }))),
            ...codeMap.files.flatMap((file) => file.classes.map((cls) => ({
                type: 'class',
                id: cls.id,
                name: cls.name,
                fileId: file.id,
                methods: cls.methods.length,
                properties: cls.properties.length,
                lines: cls.lines
            })))
        ],
        relations: [
            ...codeMap.relations.imports.map((imp) => ({
                type: 'import',
                from: imp.from,
                to: imp.to,
                importType: imp.type
            })),
            ...codeMap.relations.calls.map((call) => ({
                type: 'call',
                caller: call.caller,
                callee: call.callee,
                file: call.file
            })),
            ...codeMap.relations.inheritance.map((inh) => ({
                type: 'inheritance',
                child: inh.child,
                parent: inh.parent
            }))
        ],
        metrics: codeMap.files.map((file) => ({
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
export function summarizeArchitecture(codeMap) {
    // Détecter les hotspots (fichiers complexes)
    const hotspots = codeMap.files
        .filter((file) => file.score.complexity > 0.7)
        .map((file) => ({
        fileId: file.id,
        path: file.path,
        complexity: file.score.complexity
    }))
        .sort((a, b) => b.complexity - a.complexity)
        .slice(0, 10);
    // Détecter les risques (fichiers de faible qualité)
    const risks = codeMap.files
        .filter((file) => file.score.quality < 0.5)
        .map((file) => ({
        fileId: file.id,
        path: file.path,
        quality: file.score.quality
    }))
        .sort((a, b) => a.quality - b.quality)
        .slice(0, 10);
    // Cartographier les responsabilités
    const responsibilities = codeMap.files
        .filter((file) => file.functions.length > 0 || file.classes.length > 0)
        .map((file) => ({
        fileId: file.id,
        path: file.path,
        functions: file.functions.length,
        classes: file.classes.length
    }))
        .sort((a, b) => (b.functions + b.classes) - (a.functions + a.classes))
        .slice(0, 20);
    return { hotspots, risks, responsibilities };
}
//# sourceMappingURL=index.js.map