// src/core/json-schema-validator.ts
// Validateur JSON Schema pour les outils MCP
// Garantit que les entrées et sorties des outils respectent les schémas définis
import { logger } from './logger.js';
/**
 * Fonction utilitaire pour valider un objet contre un schéma JSON
 */
export function validateJsonSchema(value, schema) {
    const validator = new JSONSchemaValidator();
    const result = validator.validate(value, schema);
    return {
        valid: result.valid,
        errors: result.errors.map(e => `${e.path}: ${e.message}`)
    };
}
/**
 * Validateur JSON Schema
 */
export class JSONSchemaValidator {
    config;
    constructor(config = {}) {
        this.config = {
            validateFormats: true,
            validateEnums: true,
            validateTypes: true,
            validateSizes: true,
            validateRequired: true,
            validateAdditionalProperties: true,
            logLevel: 'error',
            throwOnError: false,
            ...config
        };
    }
    /**
     * Valide une valeur contre un schéma JSON
     */
    validate(value, schema, path = '') {
        const errors = [];
        const warnings = [];
        // Valider le type de base
        if (this.config.validateTypes) {
            this.validateType(value, schema, path, errors);
        }
        // Valider les contraintes spécifiques au type
        if (schema.type === 'object') {
            this.validateObject(value, schema, path, errors, warnings);
        }
        else if (schema.type === 'array') {
            this.validateArray(value, schema, path, errors, warnings);
        }
        else if (schema.type === 'string') {
            this.validateString(value, schema, path, errors);
        }
        else if (schema.type === 'number') {
            this.validateNumber(value, schema, path, errors);
        }
        else if (schema.type === 'boolean') {
            this.validateBoolean(value, schema, path, errors);
        }
        else if (schema.type === 'null') {
            this.validateNull(value, schema, path, errors);
        }
        // Valider les contraintes globales
        if (schema.enum && this.config.validateEnums) {
            this.validateEnum(value, schema, path, errors);
        }
        if (schema.const !== undefined) {
            this.validateConst(value, schema, path, errors);
        }
        // Valider les combinaisons logiques
        if (schema.oneOf) {
            this.validateOneOf(value, schema, path, errors);
        }
        if (schema.anyOf) {
            this.validateAnyOf(value, schema, path, errors);
        }
        if (schema.allOf) {
            this.validateAllOf(value, schema, path, errors);
        }
        if (schema.not) {
            this.validateNot(value, schema, path, errors);
        }
        // Loguer les erreurs si nécessaire
        if (errors.length > 0 && this.config.logLevel) {
            this.logValidationErrors(errors, path, value, schema);
        }
        // Lancer une exception si demandé
        if (errors.length > 0 && this.config.throwOnError) {
            throw new Error(`Validation failed for ${path}: ${errors.map(e => e.message).join(', ')}`);
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
    /**
     * Valide le type de base
     */
    validateType(value, schema, path, errors) {
        const expectedType = schema.type;
        if (expectedType === 'null') {
            if (value !== null) {
                errors.push({
                    path,
                    message: `Expected null, got ${typeof value}`,
                    value,
                    schema
                });
            }
            return;
        }
        if (expectedType === 'array' && !Array.isArray(value)) {
            errors.push({
                path,
                message: `Expected array, got ${typeof value}`,
                value,
                schema
            });
            return;
        }
        if (expectedType === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
            errors.push({
                path,
                message: `Expected object, got ${typeof value}`,
                value,
                schema
            });
            return;
        }
        if (expectedType === 'string' && typeof value !== 'string') {
            errors.push({
                path,
                message: `Expected string, got ${typeof value}`,
                value,
                schema
            });
            return;
        }
        if (expectedType === 'number' && typeof value !== 'number') {
            errors.push({
                path,
                message: `Expected number, got ${typeof value}`,
                value,
                schema
            });
            return;
        }
        if (expectedType === 'boolean' && typeof value !== 'boolean') {
            errors.push({
                path,
                message: `Expected boolean, got ${typeof value}`,
                value,
                schema
            });
            return;
        }
    }
    /**
     * Valide un objet
     */
    validateObject(value, schema, path, errors, warnings) {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            return; // Déjà géré par validateType
        }
        // Valider les propriétés requises
        if (this.config.validateRequired && schema.required) {
            for (const requiredProp of schema.required) {
                if (!(requiredProp in value)) {
                    errors.push({
                        path: path ? `${path}.${requiredProp}` : requiredProp,
                        message: `Required property '${requiredProp}' is missing`,
                        value: undefined,
                        schema
                    });
                }
            }
        }
        // Valider les propriétés définies
        if (schema.properties) {
            for (const [propName, propSchema] of Object.entries(schema.properties)) {
                if (propName in value) {
                    const propValue = value[propName];
                    const propPath = path ? `${path}.${propName}` : propName;
                    const result = this.validate(propValue, propSchema, propPath);
                    errors.push(...result.errors);
                    warnings.push(...result.warnings);
                }
            }
        }
        // Valider les propriétés additionnelles
        if (this.config.validateAdditionalProperties && schema.additionalProperties !== undefined) {
            const allowedProperties = schema.properties ? Object.keys(schema.properties) : [];
            for (const propName of Object.keys(value)) {
                if (!allowedProperties.includes(propName)) {
                    if (schema.additionalProperties === false) {
                        errors.push({
                            path: path ? `${path}.${propName}` : propName,
                            message: `Additional property '${propName}' is not allowed`,
                            value: value[propName],
                            schema
                        });
                    }
                    else if (typeof schema.additionalProperties === 'object') {
                        const propPath = path ? `${path}.${propName}` : propName;
                        const result = this.validate(value[propName], schema.additionalProperties, propPath);
                        errors.push(...result.errors);
                        warnings.push(...result.warnings);
                    }
                }
            }
        }
    }
    /**
     * Valide un tableau
     */
    validateArray(value, schema, path, errors, warnings) {
        if (!Array.isArray(value)) {
            return; // Déjà géré par validateType
        }
        // Valider chaque élément
        if (schema.items) {
            for (let i = 0; i < value.length; i++) {
                const itemPath = `${path}[${i}]`;
                const result = this.validate(value[i], schema.items, itemPath);
                errors.push(...result.errors);
                warnings.push(...result.warnings);
            }
        }
        // Valider les contraintes de taille
        if (this.config.validateSizes) {
            if (schema.minLength !== undefined && value.length < schema.minLength) {
                errors.push({
                    path,
                    message: `Array length ${value.length} is less than minimum ${schema.minLength}`,
                    value: value.length,
                    schema
                });
            }
            if (schema.maxLength !== undefined && value.length > schema.maxLength) {
                errors.push({
                    path,
                    message: `Array length ${value.length} is greater than maximum ${schema.maxLength}`,
                    value: value.length,
                    schema
                });
            }
        }
    }
    /**
     * Valide une chaîne de caractères
     */
    validateString(value, schema, path, errors) {
        if (typeof value !== 'string') {
            return; // Déjà géré par validateType
        }
        // Valider les contraintes de taille
        if (this.config.validateSizes) {
            if (schema.minLength !== undefined && value.length < schema.minLength) {
                errors.push({
                    path,
                    message: `String length ${value.length} is less than minimum ${schema.minLength}`,
                    value: value.length,
                    schema
                });
            }
            if (schema.maxLength !== undefined && value.length > schema.maxLength) {
                errors.push({
                    path,
                    message: `String length ${value.length} is greater than maximum ${schema.maxLength}`,
                    value: value.length,
                    schema
                });
            }
        }
        // Valider le pattern regex
        if (schema.pattern) {
            const regex = new RegExp(schema.pattern);
            if (!regex.test(value)) {
                errors.push({
                    path,
                    message: `String does not match pattern ${schema.pattern}`,
                    value,
                    schema
                });
            }
        }
        // Valider le format
        if (this.config.validateFormats && schema.format) {
            this.validateFormat(value, schema.format, path, errors);
        }
    }
    /**
     * Valide un nombre
     */
    validateNumber(value, schema, path, errors) {
        if (typeof value !== 'number') {
            return; // Déjà géré par validateType
        }
        // Valider les contraintes de valeur
        if (this.config.validateSizes) {
            if (schema.minimum !== undefined && value < schema.minimum) {
                errors.push({
                    path,
                    message: `Value ${value} is less than minimum ${schema.minimum}`,
                    value,
                    schema
                });
            }
            if (schema.maximum !== undefined && value > schema.maximum) {
                errors.push({
                    path,
                    message: `Value ${value} is greater than maximum ${schema.maximum}`,
                    value,
                    schema
                });
            }
        }
    }
    /**
     * Valide un booléen
     */
    validateBoolean(value, schema, path, errors) {
        if (typeof value !== 'boolean') {
            return; // Déjà géré par validateType
        }
    }
    /**
     * Valide null
     */
    validateNull(value, schema, path, errors) {
        if (value !== null) {
            return; // Déjà géré par validateType
        }
    }
    /**
     * Valide une valeur enum
     */
    validateEnum(value, schema, path, errors) {
        if (!schema.enum)
            return;
        if (!schema.enum.includes(value)) {
            errors.push({
                path,
                message: `Value '${value}' is not one of the allowed values: ${schema.enum.join(', ')}`,
                value,
                schema
            });
        }
    }
    /**
     * Valide une valeur constante
     */
    validateConst(value, schema, path, errors) {
        if (schema.const === undefined)
            return;
        if (value !== schema.const) {
            errors.push({
                path,
                message: `Value must be exactly '${schema.const}'`,
                value,
                schema
            });
        }
    }
    /**
     * Valide oneOf
     */
    validateOneOf(value, schema, path, errors) {
        if (!schema.oneOf)
            return;
        let validCount = 0;
        for (const subSchema of schema.oneOf) {
            const result = this.validate(value, subSchema, path);
            if (result.valid) {
                validCount++;
            }
        }
        if (validCount !== 1) {
            errors.push({
                path,
                message: `Value must match exactly one schema, matched ${validCount}`,
                value,
                schema
            });
        }
    }
    /**
     * Valide anyOf
     */
    validateAnyOf(value, schema, path, errors) {
        if (!schema.anyOf)
            return;
        let valid = false;
        for (const subSchema of schema.anyOf) {
            const result = this.validate(value, subSchema, path);
            if (result.valid) {
                valid = true;
                break;
            }
        }
        if (!valid) {
            errors.push({
                path,
                message: 'Value must match at least one schema',
                value,
                schema
            });
        }
    }
    /**
     * Valide allOf
     */
    validateAllOf(value, schema, path, errors) {
        if (!schema.allOf)
            return;
        for (const subSchema of schema.allOf) {
            const result = this.validate(value, subSchema, path);
            if (!result.valid) {
                errors.push({
                    path,
                    message: 'Value must match all schemas',
                    value,
                    schema
                });
                break;
            }
        }
    }
    /**
     * Valide not
     */
    validateNot(value, schema, path, errors) {
        if (!schema.not)
            return;
        const result = this.validate(value, schema.not, path);
        if (result.valid) {
            errors.push({
                path,
                message: 'Value must not match the schema',
                value,
                schema
            });
        }
    }
    /**
     * Valide un format
     */
    validateFormat(value, format, path, errors) {
        switch (format) {
            case 'email':
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    errors.push({
                        path,
                        message: 'Invalid email format',
                        value,
                        schema: { type: 'string', format }
                    });
                }
                break;
            case 'uri':
                try {
                    new URL(value);
                }
                catch {
                    errors.push({
                        path,
                        message: 'Invalid URI format',
                        value,
                        schema: { type: 'string', format }
                    });
                }
                break;
            case 'date-time':
                if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
                    errors.push({
                        path,
                        message: 'Invalid date-time format',
                        value,
                        schema: { type: 'string', format }
                    });
                }
                break;
            case 'date':
                if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                    errors.push({
                        path,
                        message: 'Invalid date format',
                        value,
                        schema: { type: 'string', format }
                    });
                }
                break;
            case 'time':
                if (!/^\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)) {
                    errors.push({
                        path,
                        message: 'Invalid time format',
                        value,
                        schema: { type: 'string', format }
                    });
                }
                break;
            case 'uuid':
                if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
                    errors.push({
                        path,
                        message: 'Invalid UUID format',
                        value,
                        schema: { type: 'string', format }
                    });
                }
                break;
        }
    }
    /**
     * Logue les erreurs de validation
     */
    logValidationErrors(errors, path, value, schema) {
        const errorMessages = errors.map(e => `${e.path}: ${e.message}`).join(', ');
        switch (this.config.logLevel) {
            case 'error':
                logger.error('json.schema.validation.error', `Validation failed for ${path}: ${errorMessages}`, {
                    path,
                    value,
                    schema,
                    errors: errors.map(e => ({ path: e.path, message: e.message }))
                });
                break;
            case 'warn':
                logger.warn('json.schema.validation.warn', `Validation warnings for ${path}: ${errorMessages}`, {
                    path,
                    value,
                    schema,
                    errors: errors.map(e => ({ path: e.path, message: e.message }))
                });
                break;
            case 'info':
                logger.info('json.schema.validation.info', `Validation info for ${path}: ${errorMessages}`, {
                    path,
                    value,
                    schema,
                    errors: errors.map(e => ({ path: e.path, message: e.message }))
                });
                break;
            case 'debug':
                logger.debug('json.schema.validation.debug', `Validation debug for ${path}: ${errorMessages}`, {
                    path,
                    value,
                    schema,
                    errors: errors.map(e => ({ path: e.path, message: e.message }))
                });
                break;
        }
    }
}
//# sourceMappingURL=json-schema-validator.js.map