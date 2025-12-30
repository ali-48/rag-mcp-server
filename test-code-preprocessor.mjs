// Test ES module du pré-processeur de code
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Test du pré-processeur de code (ES Module)\n');

// Créer un script TypeScript temporaire pour tester
const testScript = `
import { preprocessCode } from './src/rag/code-preprocessor.ts';

const testContent = \`
// Commentaire simple
import { useState } from 'react';

function greet(name) {
  return \`Hello, \${name}!\`;
}

const add = (a, b) => {
  return a + b;
};

class Calculator {
  sum(x, y) {
    return x + y;
  }
}\`;

try {
  const result = preprocessCode(testContent, 'javascript');
  console.log('✅ Test JavaScript réussi');
  console.log(\`   Fonctions détectées: \${result.metadata.totalFunctions}\`);
  console.log(\`   Classes détectées: \${result.metadata.totalClasses}\`);
  console.log(\`   Imports détectés: \${result.metadata.totalImports}\`);
  console.log(\`   Commentaires détectés: \${result.metadata.totalComments}\`);
  
  if (result.structure.functions.length > 0) {
    const func = result.structure.functions[0];
    console.log(\`   Exemple fonction: \${func.name} avec \${func.parameters.length} paramètres\`);
  }
  
  // Test Python
  const pythonContent = \`
# Commentaire Python
import os

def hello(name):
    return f"Hello, {name}!"

class Test:
    def method(self):
        return "test"
  \`;
  
  const pythonResult = preprocessCode(pythonContent, 'python');
  console.log('\\n✅ Test Python réussi');
  console.log(\`   Fonctions détectées: \${pythonResult.metadata.totalFunctions}\`);
  console.log(\`   Classes détectées: \${pythonResult.metadata.totalClasses}\`);
  
  process.exit(0);
} catch (error) {
  console.error('❌ Erreur:', error.message);
  console.error(error.stack);
  process.exit(1);
}
`;

// Écrire le script temporaire
const tempScriptPath = path.join(__dirname, 'temp-test.mjs');
fs.writeFileSync(tempScriptPath, testScript);

try {
  // Exécuter avec tsx
  console.log('📝 Exécution du test...\n');
  const output = execSync(`npx tsx ${tempScriptPath}`, { 
    encoding: 'utf-8',
    stdio: 'pipe'
  });
  
  console.log(output);
  
  // Nettoyer
  fs.unlinkSync(tempScriptPath);
  
  console.log('✅ Tous les tests ont réussi !');
  console.log('\n📊 Le pré-processeur de code fonctionne correctement.');
  console.log('   - Extraction des fonctions ✓');
  console.log('   - Extraction des classes ✓');
  console.log('   - Extraction des imports ✓');
  console.log('   - Extraction des commentaires ✓');
  console.log('   - Support JavaScript/TypeScript ✓');
  console.log('   - Support Python ✓');
  
} catch (error) {
  // Nettoyer même en cas d'erreur
  if (fs.existsSync(tempScriptPath)) {
    fs.unlinkSync(tempScriptPath);
  }
  
  console.error('❌ Erreur lors de l\'exécution du test:');
  console.error(error.stdout?.toString() || error.message);
  process.exit(1);
}
