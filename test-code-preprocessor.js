// Test du pré-processeur de code
import { preprocessCode } from './build/rag/code-preprocessor.js';

console.log('🧪 Test du pré-processeur de code\n');

const testCases = [
  {
    name: 'JavaScript simple',
    language: 'javascript',
    content: `
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
}
`
  },
  {
    name: 'TypeScript avec types',
    language: 'typescript',
    content: `
interface User {
  id: number;
  name: string;
}

export function getUser(id: number): User {
  return { id, name: 'John' };
}

export class ApiClient {
  private baseUrl: string;
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
  
  async fetchData(): Promise<any> {
    return fetch(this.baseUrl);
  }
}
`
  },
  {
    name: 'Python simple',
    language: 'python',
    content: `
# Commentaire Python
import os
from typing import List

def calculate_sum(numbers: List[int]) -> int:
    """Calcule la somme d'une liste de nombres."""
    total = 0
    for num in numbers:
        total += num
    return total

class DataProcessor:
    def __init__(self, data):
        self.data = data
    
    def process(self):
        return [x * 2 for x in self.data]
`
  }
];

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  console.log(`📄 Test: ${testCase.name}`);
  console.log(`   Langage: ${testCase.language}`);
  
  try {
    const result = preprocessCode(testCase.content, testCase.language);
    
    console.log(`   ✅ Pré-traitement réussi`);
    console.log(`   📊 Métadonnées:`);
    console.log(`      - Fonctions: ${result.metadata.totalFunctions}`);
    console.log(`      - Classes: ${result.metadata.totalClasses}`);
    console.log(`      - Imports: ${result.metadata.totalImports}`);
    console.log(`      - Commentaires: ${result.metadata.totalComments}`);
    
    // Vérifications basiques
    if (result.structure.functions.length === result.metadata.totalFunctions &&
        result.structure.classes.length === result.metadata.totalClasses &&
        result.structure.imports.length === result.metadata.totalImports &&
        result.structure.comments.length === result.metadata.totalComments) {
      console.log('   ✅ Structure cohérente\n');
      passed++;
    } else {
      console.log('   ❌ Incohérence dans la structure\n');
      failed++;
    }
    
    // Afficher quelques détails
    if (result.structure.functions.length > 0) {
      const func = result.structure.functions[0];
      console.log(`   📝 Exemple de fonction: ${func.name}`);
      console.log(`      Signature: ${func.signature.substring(0, 50)}...`);
      console.log(`      Paramètres: ${func.parameters.length}`);
    }
    
    if (result.structure.imports.length > 0) {
      const imp = result.structure.imports[0];
      console.log(`   📦 Exemple d'import: ${imp.module}`);
      console.log(`      Éléments: ${imp.imports.join(', ') || 'aucun'}`);
    }
    
    console.log();
    
  } catch (error) {
    console.log(`   ❌ Erreur: ${error.message}\n`);
    failed++;
  }
}

// Test avec un fichier réel du projet
console.log('🧪 Test avec un fichier réel du projet\n');

try {
  const fs = await import('fs');
  const path = await import('path');
  
  // Lire un fichier TypeScript du projet
  const testFile = path.join(process.cwd(), 'src/rag/content-detector.ts');
  if (fs.existsSync(testFile)) {
    const content = fs.readFileSync(testFile, 'utf-8');
    const result = preprocessCode(content, 'typescript');
    
    console.log(`📄 Fichier: ${testFile}`);
    console.log(`   ✅ Pré-traitement réussi`);
    console.log(`   📊 Résultats:`);
    console.log(`      - Fonctions détectées: ${result.metadata.totalFunctions}`);
    console.log(`      - Commentaires détectés: ${result.metadata.totalComments}`);
    console.log(`      - Imports détectés: ${result.metadata.totalImports}`);
    
    // Lister les fonctions détectées
    console.log(`   📝 Fonctions détectées:`);
    result.structure.functions.slice(0, 3).forEach((func, i) => {
      console.log(`      ${i + 1}. ${func.name} (lignes ${func.startLine}-${func.endLine})`);
    });
    
    if (result.metadata.totalFunctions > 0) {
      console.log('   ✅ Test réussi\n');
      passed++;
    } else {
      console.log('   ⚠️ Aucune fonction détectée (peut être normal)\n');
    }
  } else {
    console.log('   ⚠️ Fichier de test non trouvé\n');
  }
} catch (error) {
  console.log(`   ❌ Erreur: ${error.message}\n`);
  failed++;
}

// Résumé
console.log('\n📊 RÉSUMÉ DES TESTS');
console.log(`✅ Tests réussis: ${passed}`);
console.log(`❌ Tests échoués: ${failed}`);
console.log(`📈 Taux de réussite: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

process.exit(failed > 0 ? 1 : 0);
