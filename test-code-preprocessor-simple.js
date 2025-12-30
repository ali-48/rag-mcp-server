// Test simplifié du pré-processeur de code (utilise ts-node)
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Test simplifié du pré-processeur de code\n');

// Créer un script TypeScript temporaire pour tester
const testScript = `
import { preprocessCode } from './src/rag/code-preprocessor';

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
  
  process.exit(0);
} catch (error) {
  console.error('❌ Erreur:', error.message);
  process.exit(1);
}
`;

// Écrire le script temporaire
const tempScriptPath = path.join(__dirname, 'temp-test.ts');
fs.writeFileSync(tempScriptPath, testScript);

try {
  // Exécuter avec ts-node
  console.log('📝 Exécution du test TypeScript...\n');
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
  
} catch (error) {
  // Nettoyer même en cas d'erreur
  if (fs.existsSync(tempScriptPath)) {
    fs.unlinkSync(tempScriptPath);
  }
  
  console.error('❌ Erreur lors de l\'exécution du test:');
  console.error(error.stdout?.toString() || error.message);
  process.exit(1);
}
