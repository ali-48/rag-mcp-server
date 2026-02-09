/**
 * Validateur JSON Schema pour les événements VS Code
 * Utilise Ajv pour valider les événements contre les schémas définis
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { logger } from '../utils/structured-logger.js';

// Schémas JSON pour les événements VS Code
import { eventSchemas } from '../../extension-rag/src/models/event-schemas.js';

/**
 * Instance Ajv configurée
 */
const ajv = new Ajv({
  allErrors: true,
  strict: true,
  coerceTypes: false,
  useDefaults: true,
  removeAdditional: true,
  messages: true,
  verbose: true
});

// Ajout des formats standards (date-time, email, etc.)
addFormats(ajv);

// Compilation des schémas
const compiledSchemas: Record<string, any> = {};

try {
  // Compiler chaque schéma
  for (const [eventType, schema] of Object.entries(eventSchemas)) {
    compiledSchemas[eventType] = ajv.compile(schema);
    logger.debug(`Schéma ${eventType} compilé avec succès`);
  }
} catch (error) {
  logger.error('Erreur lors de la compilation des schémas', { error: error instanceof Error ? error.message : String(error) });
  throw error;
}

/**
 * Interface pour le résultat de validation
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  normalizedData?: any;
}

/**
 * Valide un événement VS Code contre le schéma correspondant
 */
export async function validateVSCodeEvent(event: any): Promise<ValidationResult> {
  const startTime = Date.now();

  try {
    // Vérifier que l'événement a un type
    if (!event || typeof event !== 'object') {
      return {
        valid: false,
        errors: ['Événement invalide: doit être un objet']
      };
    }

    const eventType = event.type;
    if (!eventType) {
      return {
        valid: false,
        errors: ['Événement invalide: propriété "type" manquante']
      };
    }

    // Vérifier que le type est supporté
    const validator = compiledSchemas[eventType];
    if (!validator) {
      return {
        valid: false,
        errors: [`Type d'événement non supporté: ${eventType}`]
      };
    }

    // Valider l'événement
    const isValid = validator(event);

    // Préparer le résultat
    const result: ValidationResult = {
      valid: isValid,
      normalizedData: event // Données déjà normalisées par Ajv (removeAdditional)
    };

    // Extraire les erreurs si invalide
    if (!isValid && validator.errors) {
      result.errors = validator.errors.map(err => {
        const path = err.instancePath ? ` à ${err.instancePath}` : '';
        return `${err.message}${path}`;
      });

      logger.debug('Événement invalide', {
        event_type: eventType,
        errors: result.errors,
        project_id: event.project_id
      });
    } else if (isValid) {
      logger.debug('Événement validé avec succès', {
        event_type: eventType,
        project_id: event.project_id
      });
    }

    // Log des performances
    const duration = Date.now() - startTime;
    logger.debug('Validation JSON Schema terminée', {
      event_type: eventType,
      duration_ms: duration,
      valid: isValid
    });

    return result;

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Erreur lors de la validation JSON Schema', {
      error: errorMessage,
      duration_ms: duration,
      event_type: event?.type
    });

    return {
      valid: false,
      errors: [`Erreur de validation: ${errorMessage}`]
    };
  }
}

/**
 * Valide un tableau d'événements
 */
export async function validateVSCodeEvents(events: any[]): Promise<ValidationResult[]> {
  const results = [];

  for (const event of events) {
    results.push(await validateVSCodeEvent(event));
  }

  return results;
}

/**
 * Vérifie si un événement est valide sans lever d'exception
 */
export async function isValidVSCodeEvent(event: any): Promise<boolean> {
  const result = await validateVSCodeEvent(event);
  return result.valid;
}

/**
 * Obtient les schémas compilés (pour les tests)
 */
export function getCompiledSchemas(): Record<string, any> {
  return { ...compiledSchemas };
}

export default {
  validateVSCodeEvent,
  validateVSCodeEvents,
  isValidVSCodeEvent,
  getCompiledSchemas
};
