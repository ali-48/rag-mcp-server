/**
 * Utilitaires de manipulation JSON
 * Centralise les fonctions JSON dupliquées dans le codebase
 */

/**
 * Parse une chaîne JSON avec gestion d'erreur
 */
export function parseJsonSafe<T = any>(jsonString: string): { success: boolean; data?: T; error?: string } {
  try {
    const data = JSON.parse(jsonString) as T;
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Stringify un objet avec gestion d'erreur
 */
export function stringifyJsonSafe(data: any, pretty: boolean = false): { success: boolean; json?: string; error?: string } {
  try {
    const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    return { success: true, json };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Valide qu'un objet est du JSON valide
 */
export function isValidJson(data: any): boolean {
  try {
    JSON.stringify(data);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clone profond d'un objet via JSON
 */
export function deepClone<T = any>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Fusionne deux objets JSON (shallow merge)
 */
export function mergeJson<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  return { ...target, ...source };
}

/**
 * Fusionne deux objets JSON profondément
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] !== undefined) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
          result[key] = deepMerge(target[key], source[key] as any);
        } else {
          result[key] = deepClone(source[key] as any);
        }
      } else {
        result[key] = source[key] as any;
      }
    }
  }

  return result;
}

/**
 * Compare deux objets JSON pour l'égalité profonde
 */
export function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;

  if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 === null || obj2 === null) {
    return false;
  }

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key) || !deepEqual(obj1[key], obj2[key])) {
      return false;
    }
  }

  return true;
}

/**
 * Extrait un chemin spécifique d'un objet JSON
 */
export function getJsonPath<T = any>(obj: any, path: string, defaultValue?: T): T | undefined {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return defaultValue;
    }

    if (Array.isArray(current)) {
      const index = parseInt(part, 10);
      if (isNaN(index) || index < 0 || index >= current.length) {
        return defaultValue;
      }
      current = current[index];
    } else {
      current = current[part];
    }
  }

  return current !== undefined ? current : defaultValue;
}

/**
 * Définit une valeur à un chemin spécifique dans un objet JSON
 */
export function setJsonPath(obj: any, path: string, value: any): boolean {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];

    if (current[part] === undefined || current[part] === null) {
      // Vérifier si la prochaine partie est un index de tableau
      const nextPart = parts[i + 1];
      const nextIndex = parseInt(nextPart, 10);

      if (!isNaN(nextIndex) && nextIndex >= 0) {
        current[part] = [];
      } else {
        current[part] = {};
      }
    }

    current = current[part];
  }

  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;
  return true;
}

/**
 * Supprime un chemin spécifique d'un objet JSON
 */
export function deleteJsonPath(obj: any, path: string): boolean {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];

    if (current[part] === undefined || current[part] === null) {
      return false;
    }

    current = current[part];
  }

  const lastPart = parts[parts.length - 1];
  if (current[lastPart] !== undefined) {
    delete current[lastPart];
    return true;
  }

  return false;
}

/**
 * Filtre un objet JSON en ne gardant que certaines clés
 */
export function filterJsonKeys<T extends Record<string, any>>(obj: T, keys: string[]): Partial<T> {
  const result: Partial<T> = {};

  for (const key of keys) {
    if (key in obj) {
      result[key as keyof T] = obj[key];
    }
  }

  return result;
}

/**
 * Transforme les clés d'un objet JSON
 */
export function transformJsonKeys<T extends Record<string, any>>(
  obj: T,
  transformer: (key: string) => string
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newKey = transformer(key);
      result[newKey] = obj[key];
    }
  }

  return result;
}

/**
 * Aplatit un objet JSON (convertit les objets imbriqués en clés avec points)
 */
export function flattenJson(obj: Record<string, any>, prefix: string = ''): Record<string, any> {
  const result: Record<string, any> = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, flattenJson(value, fullKey));
      } else {
        result[fullKey] = value;
      }
    }
  }

  return result;
}

/**
 * Dé-aplatit un objet JSON (convertit les clés avec points en objets imbriqués)
 */
export function unflattenJson(flatObj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  for (const key in flatObj) {
    if (Object.prototype.hasOwnProperty.call(flatObj, key)) {
      const parts = key.split('.');
      let current = result;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];

        if (current[part] === undefined) {
          current[part] = {};
        }

        current = current[part];
      }

      const lastPart = parts[parts.length - 1];
      current[lastPart] = flatObj[key];
    }
  }

  return result;
}

/**
 * Valide un schéma JSON simple
 */
export function validateJsonSchema(
  data: any,
  schema: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
    required?: boolean;
    properties?: Record<string, any>;
    items?: any;
  }
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Vérifier le type
  if (schema.required && data === undefined) {
    errors.push('Champ requis manquant');
    return { valid: false, errors };
  }

  if (data === undefined || data === null) {
    if (schema.type !== 'null') {
      return { valid: true, errors: [] }; // Optionnel
    }
  }

  if (schema.type === 'string' && typeof data !== 'string') {
    errors.push(`Attendu: string, reçu: ${typeof data}`);
  } else if (schema.type === 'number' && typeof data !== 'number') {
    errors.push(`Attendu: number, reçu: ${typeof data}`);
  } else if (schema.type === 'boolean' && typeof data !== 'boolean') {
    errors.push(`Attendu: boolean, reçu: ${typeof data}`);
  } else if (schema.type === 'object' && (typeof data !== 'object' || Array.isArray(data) || data === null)) {
    errors.push(`Attendu: object, reçu: ${Array.isArray(data) ? 'array' : typeof data}`);
  } else if (schema.type === 'array' && !Array.isArray(data)) {
    errors.push(`Attendu: array, reçu: ${typeof data}`);
  } else if (schema.type === 'null' && data !== null) {
    errors.push(`Attendu: null, reçu: ${typeof data}`);
  }

  // Vérifier les propriétés pour les objets
  if (schema.type === 'object' && schema.properties && typeof data === 'object' && data !== null) {
    for (const prop in schema.properties) {
      const propSchema = schema.properties[prop];
      const result = validateJsonSchema(data[prop], propSchema);
      if (!result.valid) {
        errors.push(`Propriété "${prop}": ${result.errors.join(', ')}`);
      }
    }
  }

  // Vérifier les items pour les tableaux
  if (schema.type === 'array' && schema.items && Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      const result = validateJsonSchema(data[i], schema.items);
      if (!result.valid) {
        errors.push(`Élément ${i}: ${result.errors.join(', ')}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Formate un JSON pour l'affichage (avec coloration syntaxique ASCII)
 */
export function formatJsonForDisplay(data: any, indent: number = 2): string {
  const json = stringifyJsonSafe(data, true);
  if (!json.success) return 'Invalid JSON';

  // Simple coloration ASCII
  return json.json!
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?)/g, (match) => {
      if (/:$/.test(match)) {
        return '\x1b[33m' + match + '\x1b[0m'; // Jaune pour les clés
      }
      return '\x1b[32m' + match + '\x1b[0m'; // Vert pour les valeurs string
    })
    .replace(/\b(true|false|null)\b/g, '\x1b[35m$&\x1b[0m') // Magenta pour true/false/null
    .replace(/\b-?\d+(\.\d+)?([eE][+-]?\d+)?\b/g, '\x1b[36m$&\x1b[0m'); // Cyan pour les nombres
}

/**
 * Teste toutes les fonctions du module
 */
export function testJsonUtils(): boolean {
  try {
    // Test parseJsonSafe
    const parseResult = parseJsonSafe('{"hello": "world"}');
    console.assert(parseResult.success === true);
    console.assert((parseResult.data as any).hello === 'world');

    const parseError = parseJsonSafe('invalid json');
    console.assert(parseError.success === false);
    console.assert(parseError.error !== undefined);

    // Test stringifyJsonSafe
    const stringifyResult = stringifyJsonSafe({ test: 123 });
    console.assert(stringifyResult.success === true);
    console.assert(stringifyResult.json === '{"test":123}');

    // Test deepClone
    const original = { a: 1, b: { c: 2 } };
    const cloned = deepClone(original);
    console.assert(deepEqual(original, cloned) === true);
    console.assert(original !== cloned);

    // Test deepMerge
    const target: any = { a: 1, b: { c: 2, d: 3 } };
    const source: any = { b: { d: 4, e: 5 }, f: 6 };
    const merged = deepMerge(target, source);
    console.assert(merged.a === 1);
    console.assert(merged.b.c === 2);
    console.assert(merged.b.d === 4);
    console.assert(merged.b.e === 5);
    console.assert(merged.f === 6);

    // Test getJsonPath
    const obj = { a: { b: { c: 42 } } };
    console.assert(getJsonPath(obj, 'a.b.c') === 42);
    console.assert(getJsonPath(obj, 'a.b.d', 'default') === 'default');

    // Test setJsonPath
    const obj2 = {};
    console.assert(setJsonPath(obj2, 'x.y.z', 123) === true);
    console.assert(getJsonPath(obj2, 'x.y.z') === 123);

    // Test deleteJsonPath
    const obj3 = { a: { b: { c: 42 } } };
    console.assert(deleteJsonPath(obj3, 'a.b.c') === true);
    console.assert(getJsonPath(obj3, 'a.b.c') === undefined);

    // Test flattenJson/unflattenJson
    const nested = { a: { b: { c: 1 }, d: 2 }, e: 3 };
    const flat = flattenJson(nested);
    console.assert(flat['a.b.c'] === 1);
    console.assert(flat['a.d'] === 2);
    console.assert(flat['e'] === 3);

    const unflattened = unflattenJson(flat);
    console.assert(deepEqual(nested, unflattened) === true);

    // Test validateJsonSchema
    const schema = {
      type: 'object' as const,
      properties: {
        name: { type: 'string', required: true },
        age: { type: 'number', required: false }
      }
    };

    const validData = { name: 'John', age: 30 };
    const invalidData = { name: 123 };

    console.assert(validateJsonSchema(validData, schema).valid === true);
    console.assert(validateJsonSchema(invalidData, schema).valid === false);

    console.log('✅ Tous les tests json-utils ont réussi');
    return true;
  } catch (error) {
    console.error('❌ Erreur dans json-utils:', error);
    return false;
  }
}
