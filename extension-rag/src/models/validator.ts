/**
 * Validateur JSON Schema avec Ajv
 * Conforme aux règles absolues RAG MCP Server
 *
 * Règles appliquées :
 * - R3 : JSON strict (validation stricte des schémas)
 * - R17 : Séparation JSON métier / logs
 */

import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { getEventSchema } from './event-schemas';
import { JSONSchema } from './json-schemas';

/**
 * Instance Ajv configurée pour validation stricte
 */
const ajv = new Ajv({
  allErrors: true,           // Retourner toutes les erreurs
  strict: true,              // Mode strict
  strictSchema: true,        // Validation stricte des schémas
  strictTypes: true,         // Validation stricte des types
  strictTuples: true,        // Validation stricte des tuples
  allowUnionTypes: true,     // Permettre les union types
  verbose: true,             // Messages d'erreur détaillés
  coerceTypes: false,        // Pas de coercition automatique
  removeAdditional: false,   // Ne pas supprimer les propriétés supplémentaires
  useDefaults: false,        // Ne pas utiliser les valeurs par défaut
  messages: true,            // Activer les messages d'erreur
  code: {
    es5: true,
    lines: true,
    source: true,
    optimize: true
  }
});

// Ajouter les formats standards (date-time, etc.)
addFormats(ajv);

/**
 * Cache des fonctions de validation compilées
 */
const validationCache = new Map<string, ValidateFunction>();

/**
 * Valider un objet contre un schéma JSON
 */
export function validateJson<T = any>(data: any, schema: JSONSchema): { valid: boolean; errors: string[]; data?: T } {
  try {
    // Générer une clé de cache basée sur le schéma
    const cacheKey = JSON.stringify(schema);

    // Récupérer ou compiler la fonction de validation
    let validate: ValidateFunction;
    if (validationCache.has(cacheKey)) {
      validate = validationCache.get(cacheKey)!;
    } else {
      validate = ajv.compile(schema);
      validationCache.set(cacheKey, validate);
    }

    // Valider les données
    const valid = validate(data);

    if (valid) {
      return {
        valid: true,
        errors: [],
        data: data as T
      };
    } else {
      // Formater les erreurs de validation
      const errors = validate.errors?.map(error => {
        const path = error.instancePath ? ` à ${error.instancePath}` : '';
        return `${error.message}${path}`;
      }) || ['Erreur de validation inconnue'];

      return {
        valid: false,
        errors
      };
    }
  } catch (error) {
    return {
      valid: false,
      errors: [`Erreur lors de la validation: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}

/**
 * Valider un événement VS Code contre son schéma
 */
export function validateVSCodeEvent(event: any): { valid: boolean; errors: string[]; eventType?: string } {
  try {
    // Vérifier la structure de base
    if (!event || typeof event !== 'object') {
      return { valid: false, errors: ['L\'événement doit être un objet'] };
    }

    // Vérifier le type d'événement
    if (!event.type || typeof event.type !== 'string') {
      return { valid: false, errors: ['Le type d\'événement est requis'] };
    }

    // Vérifier la source
    if (event.source !== 'vscode') {
      return { valid: false, errors: [`Source invalide: ${event.source}, doit être 'vscode'`] };
    }

    // Obtenir le schéma correspondant
    const schema = getEventSchema(event.type);
    if (!schema) {
      return { valid: false, errors: [`Type d'événement non supporté: ${event.type}`] };
    }

    // Valider contre le schéma
    const result = validateJson(event, schema);

    return {
      valid: result.valid,
      errors: result.errors,
      eventType: event.type
    };
  } catch (error) {
    return {
      valid: false,
      errors: [`Erreur lors de la validation de l'événement: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}

/**
 * Valider un tableau d'événements
 */
export function validateVSCodeEvents(events: any[]): {
  valid: boolean;
  errors: string[];
  validEvents: any[];
  invalidEvents: Array<{ event: any; errors: string[] }>;
} {
  const validEvents: any[] = [];
  const invalidEvents: Array<{ event: any; errors: string[] }> = [];
  const allErrors: string[] = [];

  for (const event of events) {
    const result = validateVSCodeEvent(event);
    if (result.valid) {
      validEvents.push(event);
    } else {
      invalidEvents.push({ event, errors: result.errors });
      allErrors.push(...result.errors.map(err => `[${event.type || 'unknown'}] ${err}`));
    }
  }

  return {
    valid: invalidEvents.length === 0,
    errors: allErrors,
    validEvents,
    invalidEvents
  };
}

/**
 * Créer un validateur pour un schéma spécifique
 */
export function createValidator<T = any>(schema: JSONSchema): (data: any) => { valid: boolean; errors: string[]; data?: T } {
  return (data: any) => validateJson<T>(data, schema);
}

/**
 * Exporter les fonctions de validation pour les tests
 */
export const validator = {
  validateJson,
  validateVSCodeEvent,
  validateVSCodeEvents,
  createValidator,
  ajvInstance: ajv
};

/**
 * Exemple d'utilisation :
 *
 * ```typescript
 * import { validateVSCodeEvent } from './validator';
 *
 * const event = {
 *   source: 'vscode',
 *   type: 'file_save',
 *   timestamp: '2024-01-01T00:00:00Z',
 *   project_id: 'proj_123',
 *   file: { path: 'src/test.ts', hash: 'abc123' },
 *   payload: { content_preview: 'test', line_count: 10, has_errors: false, has_warnings: false }
 * };
 *
 * const result = validateVSCodeEvent(event);
 * if (result.valid) {
 *   console.log('Événement valide');
 * } else {
 *   console.error('Erreurs:', result.errors);
 * }
 * ```
 */
