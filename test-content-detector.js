// Test du détecteur de type de contenu
import { detectContentType, detectLanguageByExtension, detectRole } from './build/rag/content-detector.js';

console.log('🧪 Test du détecteur de type de contenu\n');

const testCases = [
  {
    file: 'src/index.js',
    content: 'function main() { console.log("Hello"); }',
    expectedType: 'code',
    expectedLanguage: 'javascript'
  },
  {
    file: 'README.md',
    content: '# Title\n\nSome documentation here.',
    expectedType: 'doc',
    expectedLanguage: undefined
  },
  {
    file: 'config.json',
    content: '{"version": "1.0.0", "name": "test"}',
    expectedType: 'config',
    expectedLanguage: 'json'
  },
  {
    file: 'package.yaml',
    content: 'name: test\nversion: 1.0.0',
    expectedType: 'config',
    expectedLanguage: 'yaml'
  },
  {
    file: 'test.py',
    content: 'def hello():\n    print("Hello")',
    expectedType: 'code',
    expectedLanguage: 'python'
  },
  {
    file: 'unknown.txt',
    content: 'Just some random text',
    expectedType: 'doc',
    expectedLanguage: undefined
  }
];

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  console.log(`📄 Fichier: ${testCase.file}`);
  const result = detectContentType(testCase.file, testCase.content);
  
  console.log(`   Type détecté: ${result.contentType} (attendu: ${testCase.expectedType})`);
  console.log(`   Langage: ${result.language || 'none'} (attendu: ${testCase.expectedLanguage || 'none'})`);
  console.log(`   Confiance: ${result.confidence.toFixed(2)}`);
  console.log(`   Détecté par: ${result.detectedBy}`);
  
  const typeOk = result.contentType === testCase.expectedType;
  const langOk = result.language === testCase.expectedLanguage;
  
  if (typeOk && langOk) {
    console.log('   ✅ PASS\n');
    passed++;
  } else {
    console.log('   ❌ FAIL\n');
    failed++;
  }
}

// Test de détection de rôle
console.log('\n🧪 Test de détection de rôle\n');

const roleTestCases = [
  {
    file: 'src/utils/helper.js',
    content: 'export function formatDate(date) { return date.toISOString(); }',
    contentType: 'code',
    expectedRole: 'helper'
  },
  {
    file: 'src/test/index.spec.js',
    content: 'describe("test suite", () => { it("should work", () => {}); })',
    contentType: 'code',
    expectedRole: 'test'
  },
  {
    file: 'examples/demo.js',
    content: '// Example usage\nconst example = new Example();',
    contentType: 'code',
    expectedRole: 'example'
  },
  {
    file: 'templates/base.js',
    content: 'class Template { /* template code */ }',
    contentType: 'code',
    expectedRole: 'template'
  },
  {
    file: 'src/core/app.js',
    content: 'class App { main() { /* core logic */ } }',
    contentType: 'code',
    expectedRole: 'core'
  }
];

for (const testCase of roleTestCases) {
  console.log(`📄 Fichier: ${testCase.file}`);
  const role = detectRole(testCase.content, testCase.contentType, testCase.file);
  
  console.log(`   Rôle détecté: ${role} (attendu: ${testCase.expectedRole})`);
  
  if (role === testCase.expectedRole) {
    console.log('   ✅ PASS\n');
    passed++;
  } else {
    console.log('   ❌ FAIL\n');
    failed++;
  }
}

// Test de détection par extension
console.log('\n🧪 Test de détection par extension\n');

const extensionTestCases = [
  { file: 'script.js', expectedLanguage: 'javascript' },
  { file: 'component.tsx', expectedLanguage: 'typescript' },
  { file: 'module.py', expectedLanguage: 'python' },
  { file: 'style.scss', expectedLanguage: 'scss' },
  { file: 'unknown.xyz', expectedLanguage: undefined }
];

for (const testCase of extensionTestCases) {
  console.log(`📄 Fichier: ${testCase.file}`);
  const language = detectLanguageByExtension(testCase.file);
  
  console.log(`   Langage détecté: ${language || 'none'} (attendu: ${testCase.expectedLanguage || 'none'})`);
  
  if (language === testCase.expectedLanguage) {
    console.log('   ✅ PASS\n');
    passed++;
  } else {
    console.log('   ❌ FAIL\n');
    failed++;
  }
}

// Résumé
console.log('\n📊 RÉSUMÉ DES TESTS');
console.log(`✅ Tests réussis: ${passed}`);
console.log(`❌ Tests échoués: ${failed}`);
console.log(`📈 Taux de réussite: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

process.exit(failed > 0 ? 1 : 0);
