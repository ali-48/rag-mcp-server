import { IntelligentChunker } from './build-test/src/rag/phase0/chunker/chunker-intelligent.js';

// Test simple
const chunker = new IntelligentChunker();

// Code TypeScript simple
const sourceCode = `
function hello(name: string): string {
    return \`Hello \${name}!\`;
}
`;

// Créer un faux AST pour le débogage
const mockAst = {
  type: 'program',
  text: sourceCode,
  startIndex: 0,
  endIndex: sourceCode.length,
  startPosition: { row: 0, column: 0 },
  endPosition: { row: 3, column: 0 },
  childCount: 1,
  child: (i) => {
    if (i === 0) {
      return {
        type: 'function_declaration',
        text: sourceCode,
        startIndex: 0,
        endIndex: sourceCode.length,
        startPosition: { row: 1, column: 0 },
        endPosition: { row: 3, column: 0 },
        childCount: 3,
        child: (j) => {
          if (j === 0) return { type: 'identifier', text: 'hello', childCount: 0 };
          if (j === 1) return { type: 'formal_parameters', text: '(name: string)', childCount: 0 };
          if (j === 2) return { type: 'statement_block', text: '{\n    return \`Hello \${name}!\`;\n}', childCount: 0 };
          return null;
        }
      };
    }
    return null;
  }
};

const parseResult = {
  filePath: '/tmp/test.ts',
  language: 'typescript',
  sourceCode,
  ast: mockAst,
  metadata: {
    parseTime: 10,
    fileSize: sourceCode.length,
    lineCount: sourceCode.split('\n').length,
    success: true,
    timestamp: new Date()
  }
};

console.log('=== DÉBUT DÉBOGAGE CHUNKER ===');

// Inspecter les règles du chunker
console.log('Config du chunker:', chunker.getConfig ? chunker.getConfig() : 'getConfig non disponible');

// Vérifier si le chunker a des règles
console.log('Le chunker a-t-il des règles?', chunker.rules ? 'Oui' : 'Non');

// Appeler chunk
async function test() {
  try {
    const result = await chunker.chunk(parseResult);
    console.log('Résultat chunk:', {
      chunksCount: result.chunks.length,
      chunks: result.chunks.map(c => ({
        type: c.type,
        id: c.id,
        contentLength: c.content.code.length
      })),
      stats: result.stats
    });
  } catch (error) {
    console.error('Erreur lors du chunking:', error);
  }
}

test().then(() => {
  console.log('=== FIN DÉBOGAGE ===');
});
