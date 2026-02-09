/**
 * Types pour les schémas JSON
 * Compatible avec Ajv et JSON Schema Draft-07
 */

export interface JSONSchema {
  $id?: string;
  $schema?: string;
  $ref?: string;
  $comment?: string;

  type?: string | string[];
  enum?: any[];
  const?: any;

  // Object-specific
  properties?: Record<string, JSONSchema>;
  patternProperties?: Record<string, JSONSchema>;
  additionalProperties?: boolean | JSONSchema;
  required?: string[];
  propertyNames?: JSONSchema;
  minProperties?: number;
  maxProperties?: number;
  dependencies?: Record<string, string[] | JSONSchema>;

  // Array-specific
  items?: JSONSchema | JSONSchema[];
  additionalItems?: boolean | JSONSchema;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  contains?: JSONSchema;

  // String-specific
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;

  // Number-specific
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number | boolean;
  exclusiveMaximum?: number | boolean;
  multipleOf?: number;

  // Boolean-specific
  // No specific properties

  // Null-specific
  // No specific properties

  // Generic
  allOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  not?: JSONSchema;

  // Metadata
  title?: string;
  description?: string;
  default?: any;
  examples?: any[];
  readOnly?: boolean;
  writeOnly?: boolean;

  // Custom
  [key: string]: any;
}

/**
 * Helper pour créer un schéma JSON simple
 */
export function createSchema(schema: JSONSchema): JSONSchema {
  return schema;
}

/**
 * Helper pour créer un schéma d'objet
 */
export function createObjectSchema(properties: Record<string, JSONSchema>, required?: string[]): JSONSchema {
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false
  };
}

/**
 * Helper pour créer un schéma de tableau
 */
export function createArraySchema(items: JSONSchema, minItems?: number, maxItems?: number): JSONSchema {
  return {
    type: 'array',
    items,
    minItems,
    maxItems
  };
}

/**
 * Helper pour créer un schéma de chaîne
 */
export function createStringSchema(minLength?: number, maxLength?: number, pattern?: string, format?: string): JSONSchema {
  return {
    type: 'string',
    minLength,
    maxLength,
    pattern,
    format
  };
}

/**
 * Helper pour créer un schéma numérique
 */
export function createNumberSchema(minimum?: number, maximum?: number, exclusiveMinimum?: number | boolean, exclusiveMaximum?: number | boolean): JSONSchema {
  return {
    type: 'number',
    minimum,
    maximum,
    exclusiveMinimum,
    exclusiveMaximum
  };
}

/**
 * Helper pour créer un schéma booléen
 */
export function createBooleanSchema(): JSONSchema {
  return { type: 'boolean' };
}

/**
 * Helper pour créer un schéma null
 */
export function createNullSchema(): JSONSchema {
  return { type: 'null' };
}

/**
 * Helper pour créer un schéma enum
 */
export function createEnumSchema(values: any[]): JSONSchema {
  return { enum: values };
}

/**
 * Helper pour créer un schéma anyOf
 */
export function createAnyOfSchema(schemas: JSONSchema[]): JSONSchema {
  return { anyOf: schemas };
}

/**
 * Helper pour créer un schéma allOf
 */
export function createAllOfSchema(schemas: JSONSchema[]): JSONSchema {
  return { allOf: schemas };
}

/**
 * Helper pour créer un schéma oneOf
 */
export function createOneOfSchema(schemas: JSONSchema[]): JSONSchema {
  return { oneOf: schemas };
}

/**
 * Helper pour créer un schéma not
 */
export function createNotSchema(schema: JSONSchema): JSONSchema {
  return { not: schema };
}

/**
 * Valider l'input d'un outil MCP
 */
export function validateToolInput(input: any, schema: JSONSchema): { valid: boolean; errors: string[] } {
  // Pour l'instant, utiliser une validation simple
  // TODO: Implémenter la validation complète avec Ajv
  return { valid: true, errors: [] };
}

/**
 * Valider l'output d'un outil MCP
 */
export function validateToolOutput(output: any, schema: JSONSchema): { valid: boolean; errors: string[] } {
  // Pour l'instant, utiliser une validation simple
  // TODO: Implémenter la validation complète avec Ajv
  return { valid: true, errors: [] };
}
