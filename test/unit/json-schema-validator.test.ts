/**
 * Tests unitaires pour json-schema-validator.ts
 * Couverture complète du validateur de schémas JSON pour MCP
 */

import { describe, expect, it } from "vitest";
import {
  JSONSchema,
  JSONSchemaValidator,
  validateJsonSchema,
  ValidatorConfig,
} from "../../src/core/json-schema-validator.js";

describe("json-schema-validator", () => {
  describe("JSONSchemaValidator class", () => {
    describe("constructor", () => {
      it("should initialize with default configuration", () => {
        const validator = new JSONSchemaValidator();
        // Vérifier que les valeurs par défaut sont correctes
        expect(validator).toBeInstanceOf(JSONSchemaValidator);
      });

      it("should initialize with custom configuration", () => {
        const config: ValidatorConfig = {
          validateFormats: false,
          validateEnums: false,
          logLevel: "warn",
          throwOnError: true,
        };

        const validator = new JSONSchemaValidator(config);
        expect(validator).toBeInstanceOf(JSONSchemaValidator);
      });
    });

    describe("validate - basic types", () => {
      const validator = new JSONSchemaValidator();

      it("should validate string type", () => {
        const schema: JSONSchema = { type: "string" };

        expect(validator.validate("hello", schema).valid).toBe(true);
        expect(validator.validate(123, schema).valid).toBe(false);
        expect(validator.validate(true, schema).valid).toBe(false);
        expect(validator.validate(null, schema).valid).toBe(false);
        expect(validator.validate([], schema).valid).toBe(false);
        expect(validator.validate({}, schema).valid).toBe(false);
      });

      it("should validate number type", () => {
        const schema: JSONSchema = { type: "number" };

        expect(validator.validate(123, schema).valid).toBe(true);
        expect(validator.validate(123.45, schema).valid).toBe(true);
        expect(validator.validate("123", schema).valid).toBe(false);
        expect(validator.validate(true, schema).valid).toBe(false);
      });

      it("should validate boolean type", () => {
        const schema: JSONSchema = { type: "boolean" };

        expect(validator.validate(true, schema).valid).toBe(true);
        expect(validator.validate(false, schema).valid).toBe(true);
        expect(validator.validate("true", schema).valid).toBe(false);
        expect(validator.validate(1, schema).valid).toBe(false);
      });

      it("should validate null type", () => {
        const schema: JSONSchema = { type: "null" };

        expect(validator.validate(null, schema).valid).toBe(true);
        expect(validator.validate(undefined, schema).valid).toBe(false);
        expect(validator.validate("null", schema).valid).toBe(false);
        expect(validator.validate(0, schema).valid).toBe(false);
      });

      it("should validate array type", () => {
        const schema: JSONSchema = { type: "array" };

        expect(validator.validate([], schema).valid).toBe(true);
        expect(validator.validate([1, 2, 3], schema).valid).toBe(true);
        expect(validator.validate({}, schema).valid).toBe(false);
        expect(validator.validate("array", schema).valid).toBe(false);
      });

      it("should validate object type", () => {
        const schema: JSONSchema = { type: "object" };

        expect(validator.validate({}, schema).valid).toBe(true);
        expect(validator.validate({ key: "value" }, schema).valid).toBe(true);
        expect(validator.validate([], schema).valid).toBe(false);
        expect(validator.validate("object", schema).valid).toBe(false);
        expect(validator.validate(null, schema).valid).toBe(false);
      });
    });

    describe("validate - string constraints", () => {
      const validator = new JSONSchemaValidator();

      it("should validate minLength", () => {
        const schema: JSONSchema = { type: "string", minLength: 3 };

        expect(validator.validate("abc", schema).valid).toBe(true);
        expect(validator.validate("abcd", schema).valid).toBe(true);
        expect(validator.validate("ab", schema).valid).toBe(false);
      });

      it("should validate maxLength", () => {
        const schema: JSONSchema = { type: "string", maxLength: 5 };

        expect(validator.validate("abc", schema).valid).toBe(true);
        expect(validator.validate("abcde", schema).valid).toBe(true);
        expect(validator.validate("abcdef", schema).valid).toBe(false);
      });

      it("should validate pattern", () => {
        const schema: JSONSchema = { type: "string", pattern: "^[a-z]+$" };

        expect(validator.validate("abc", schema).valid).toBe(true);
        expect(validator.validate("abc123", schema).valid).toBe(false);
        expect(validator.validate("ABC", schema).valid).toBe(false);
      });

      it("should validate enum", () => {
        const schema: JSONSchema = {
          type: "string",
          enum: ["red", "green", "blue"],
        };

        expect(validator.validate("red", schema).valid).toBe(true);
        expect(validator.validate("green", schema).valid).toBe(true);
        expect(validator.validate("blue", schema).valid).toBe(true);
        expect(validator.validate("yellow", schema).valid).toBe(false);
      });

      it("should validate const", () => {
        const schema: JSONSchema = { type: "string", const: "fixed-value" };

        expect(validator.validate("fixed-value", schema).valid).toBe(true);
        expect(validator.validate("other-value", schema).valid).toBe(false);
      });
    });

    describe("validate - number constraints", () => {
      const validator = new JSONSchemaValidator();

      it("should validate minimum", () => {
        const schema: JSONSchema = { type: "number", minimum: 10 };

        expect(validator.validate(10, schema).valid).toBe(true);
        expect(validator.validate(15, schema).valid).toBe(true);
        expect(validator.validate(5, schema).valid).toBe(false);
      });

      it("should validate maximum", () => {
        const schema: JSONSchema = { type: "number", maximum: 100 };

        expect(validator.validate(100, schema).valid).toBe(true);
        expect(validator.validate(50, schema).valid).toBe(true);
        expect(validator.validate(150, schema).valid).toBe(false);
      });
    });

    describe("validate - object constraints", () => {
      const validator = new JSONSchemaValidator();

      it("should validate required properties", () => {
        const schema: JSONSchema = {
          type: "object",
          properties: {
            name: { type: "string" },
            age: { type: "number" },
          },
          required: ["name"],
        };

        expect(validator.validate({ name: "John" }, schema).valid).toBe(true);
        expect(
          validator.validate({ name: "John", age: 30 }, schema).valid,
        ).toBe(true);
        expect(validator.validate({ age: 30 }, schema).valid).toBe(false);
        expect(validator.validate({}, schema).valid).toBe(false);
      });

      it("should validate nested properties", () => {
        const schema: JSONSchema = {
          type: "object",
          properties: {
            user: {
              type: "object",
              properties: {
                name: { type: "string" },
                email: { type: "string" },
              },
              required: ["name"],
            },
          },
        };

        expect(
          validator.validate({ user: { name: "John" } }, schema).valid,
        ).toBe(true);
        expect(
          validator.validate(
            { user: { name: "John", email: "john@example.com" } },
            schema,
          ).valid,
        ).toBe(true);
        expect(
          validator.validate({ user: { email: "john@example.com" } }, schema)
            .valid,
        ).toBe(false);
      });

      it("should validate additionalProperties: false", () => {
        const schema: JSONSchema = {
          type: "object",
          properties: {
            name: { type: "string" },
          },
          additionalProperties: false,
        };

        expect(validator.validate({ name: "John" }, schema).valid).toBe(true);
        expect(
          validator.validate({ name: "John", extra: "value" }, schema).valid,
        ).toBe(false);
      });

      it("should validate additionalProperties: schema", () => {
        const schema: JSONSchema = {
          type: "object",
          properties: {
            name: { type: "string" },
          },
          additionalProperties: { type: "number" },
        };

        expect(
          validator.validate({ name: "John", count: 5 }, schema).valid,
        ).toBe(true);
        expect(
          validator.validate({ name: "John", extra: "value" }, schema).valid,
        ).toBe(false);
      });
    });

    describe("validate - array constraints", () => {
      const validator = new JSONSchemaValidator();

      it("should validate array items", () => {
        const schema: JSONSchema = {
          type: "array",
          items: { type: "string" },
        };

        expect(validator.validate([], schema).valid).toBe(true);
        expect(validator.validate(["a", "b", "c"], schema).valid).toBe(true);
        expect(validator.validate(["a", 1, "c"], schema).valid).toBe(false);
      });

      it("should validate minLength for arrays", () => {
        const schema: JSONSchema = {
          type: "array",
          items: { type: "string" },
          minLength: 2,
        };

        expect(validator.validate(["a", "b"], schema).valid).toBe(true);
        expect(validator.validate(["a", "b", "c"], schema).valid).toBe(true);
        expect(validator.validate(["a"], schema).valid).toBe(false);
        expect(validator.validate([], schema).valid).toBe(false);
      });

      it("should validate maxLength for arrays", () => {
        const schema: JSONSchema = {
          type: "array",
          items: { type: "string" },
          maxLength: 3,
        };

        expect(validator.validate(["a", "b"], schema).valid).toBe(true);
        expect(validator.validate(["a", "b", "c"], schema).valid).toBe(true);
        expect(validator.validate(["a", "b", "c", "d"], schema).valid).toBe(
          false,
        );
      });
    });

    describe("validate - logical combinations", () => {
      const validator = new JSONSchemaValidator();

      it("should validate oneOf", () => {
        const schema: JSONSchema = {
          type: "string",
          oneOf: [
            { type: "string", const: "red" },
            { type: "string", const: "green" },
            { type: "string", const: "blue" },
          ],
        };

        expect(validator.validate("red", schema).valid).toBe(true);
        expect(validator.validate("green", schema).valid).toBe(true);
        expect(validator.validate("blue", schema).valid).toBe(true);
        expect(validator.validate("yellow", schema).valid).toBe(false);
      });

      it("should validate anyOf", () => {
        const schema: JSONSchema = {
          type: "string",
          anyOf: [
            { type: "string", pattern: "^[a-z]+$" },
            { type: "string", pattern: "^[0-9]+$" },
          ],
        };

        expect(validator.validate("abc", schema).valid).toBe(true);
        expect(validator.validate("123", schema).valid).toBe(true);
        expect(validator.validate("abc123", schema).valid).toBe(false);
      });

      it("should validate allOf", () => {
        const schema: JSONSchema = {
          type: "string",
          allOf: [
            { type: "string", minLength: 3 },
            { type: "string", maxLength: 5 },
            { type: "string", pattern: "^[a-z]+$" },
          ],
        };

        expect(validator.validate("abc", schema).valid).toBe(true);
        expect(validator.validate("abcd", schema).valid).toBe(true);
        expect(validator.validate("ab", schema).valid).toBe(false); // trop court
        expect(validator.validate("abcdef", schema).valid).toBe(false); // trop long
        expect(validator.validate("abc123", schema).valid).toBe(false); // pattern invalide
      });

      it("should validate not", () => {
        const schema: JSONSchema = {
          type: "string",
          not: { type: "string", const: "forbidden" },
        };

        expect(validator.validate("allowed", schema).valid).toBe(true);
        expect(validator.validate("forbidden", schema).valid).toBe(false);
      });
    });

    describe("validate - formats", () => {
      const validator = new JSONSchemaValidator({ validateFormats: true });

      it("should validate email format", () => {
        const schema: JSONSchema = { type: "string", format: "email" };

        expect(validator.validate("test@example.com", schema).valid).toBe(true);
        expect(validator.validate("invalid-email", schema).valid).toBe(false);
        expect(validator.validate("test@", schema).valid).toBe(false);
      });

      it("should validate uri format", () => {
        const schema: JSONSchema = { type: "string", format: "uri" };

        expect(validator.validate("https://example.com", schema).valid).toBe(
          true,
        );
        expect(validator.validate("http://localhost:3000", schema).valid).toBe(
          true,
        );
        expect(validator.validate("not-a-uri", schema).valid).toBe(false);
      });

      it("should validate date-time format", () => {
        const schema: JSONSchema = { type: "string", format: "date-time" };

        expect(validator.validate("2024-01-01T12:00:00Z", schema).valid).toBe(
          true,
        );
        expect(
          validator.validate("2024-01-01T12:00:00+01:00", schema).valid,
        ).toBe(true);
        expect(validator.validate("2024-01-01", schema).valid).toBe(false);
        expect(validator.validate("invalid-date", schema).valid).toBe(false);
      });

      it("should validate uuid format", () => {
        const schema: JSONSchema = { type: "string", format: "uuid" };

        expect(
          validator.validate("123e4567-e89b-12d3-a456-426614174000", schema)
            .valid,
        ).toBe(true);
        expect(validator.validate("invalid-uuid", schema).valid).toBe(false);
        expect(
          validator.validate("123e4567-e89b-12d3-a456-42661417400", schema)
            .valid,
        ).toBe(false); // trop court
      });
    });

    describe("validate - configuration options", () => {
      it("should respect validateFormats: false", () => {
        const validator = new JSONSchemaValidator({ validateFormats: false });
        const schema: JSONSchema = { type: "string", format: "email" };

        // Avec validateFormats: false, le format n'est pas validé
        expect(validator.validate("invalid-email", schema).valid).toBe(true);
      });

      it("should respect validateEnums: false", () => {
        const validator = new JSONSchemaValidator({ validateEnums: false });
        const schema: JSONSchema = {
          type: "string",
          enum: ["red", "green", "blue"],
        };

        // Avec validateEnums: false, l'enum n'est pas validé
        expect(validator.validate("yellow", schema).valid).toBe(true);
      });

      it("should throw on error when throwOnError is true", () => {
        const validator = new JSONSchemaValidator({ throwOnError: true });
        const schema: JSONSchema = { type: "string" };

        expect(() => validator.validate(123, schema)).toThrow();
      });

      it("should not throw on error when throwOnError is false", () => {
        const validator = new JSONSchemaValidator({ throwOnError: false });
        const schema: JSONSchema = { type: "string" };

        expect(() => validator.validate(123, schema)).not.toThrow();
      });
    });

    describe("validate - error messages", () => {
      const validator = new JSONSchemaValidator();

      it("should return detailed error information", () => {
        const schema: JSONSchema = {
          type: "object",
          properties: {
            name: { type: "string", minLength: 3 },
            age: { type: "number", minimum: 0 },
          },
          required: ["name"],
        };

        const result = validator.validate({ age: -5 }, schema);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(2);

        // Vérifier les erreurs
        const errorPaths = result.errors.map((e) => e.path);
        expect(errorPaths).toContain("name");
        expect(errorPaths).toContain("age");

        const errorMessages = result.errors.map((e) => e.message);
        expect(errorMessages).toContain("Required property 'name' is missing");
        expect(errorMessages).toContain("Value -5 is less than minimum 0");
      });

      it("should include path information for nested errors", () => {
        const schema: JSONSchema = {
          type: "object",
          properties: {
            user: {
              type: "object",
              properties: {
                profile: {
                  type: "object",
                  properties: {
                    email: { type: "string", format: "email" },
                  },
                },
              },
            },
          },
        };

        const result = validator.validate(
          {
            user: {
              profile: {
                email: "invalid-email",
              },
            },
          },
          schema,
        );

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].path).toBe("user.profile.email");
        expect(result.errors[0].message).toBe("Invalid email format");
      });
    });
  });

  describe("validateJsonSchema utility function", () => {
    it("should validate and return simple result", () => {
      const schema: JSONSchema = { type: "string" };

      const validResult = validateJsonSchema("test", schema);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toEqual([]);

      const invalidResult = validateJsonSchema(123, schema);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toHaveLength(1);
    });

    it("should return error messages in result", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        required: ["name"],
      };

      const result = validateJsonSchema({}, schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toContain("name:");
    });
  });
});
