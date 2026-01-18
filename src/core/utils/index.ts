/**
 * Index des utilitaires communs
 * Exporte tous les modules d'utilitaires pour une importation facile
 * Note: Utilisez les imports directs pour éviter les problèmes de moduleResolution
 */

// Export des fonctions individuelles via ré-exports
export * from './file-utils.js';
export * from './json-utils.js';
export * from './string-utils.js';

/**
 * Teste tous les modules d'utilitaires
 */
export function testAllUtils(): boolean {
  const results = [
    require('./string-utils.js').testStringUtils(),
    require('./file-utils.js').testFileUtils(),
    require('./json-utils.js').testJsonUtils(),
  ];

  const allPassed = results.every(result => result === true);

  if (allPassed) {
    console.log('✅ Tous les tests d\'utilitaires ont réussi');
  } else {
    console.error('❌ Certains tests d\'utilitaires ont échoué');
  }

  return allPassed;
}
