/**
 * Tests unitaires pour json-utils.ts
 * Couverture complète des 20 fonctions utilitaires de manipulation JSON
 */

import { describe, expect, it } from "vitest";
import {
  deepClone,
  deepEqual,
  deepMerge,
  deleteJsonPath,
  filterJsonKeys,
  flattenJson,
  formatJsonForDisplay,
  getJsonPath,
  isValidJson,
  mergeJson,
  parseJsonSafe,
  setJsonPath,
  stringifyJsonSafe,
  testJsonUtils,
  transformJsonKeys,
  unflattenJson,
  validateJsonSchema,
} from "../../src/core/utils/json-utils.js";

describe("json-utils", () => {
  describe("parseJsonSafe", () => {
    it("should parse valid JSON", () => {
      const result = parseJsonSafe('{"key": "value", "number": 42}');
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ key: "value", number: 42 });
      expect(result.error).toBeUndefined();
    });

    it("should handle invalid JSON", () => {
      const result = parseJsonSafe("invalid json");
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBeDefined();
    });

    it("should parse empty object", () => {
      const result = parseJsonSafe("{}");
      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
    });

    it("should parse array", () => {
      const result = parseJsonSafe("[1, 2, 3]");
      expect(result.success).toBe(true);
      expect(result.data).toEqual([1, 2, 3]);
    });

    it("should parse null", () => {
      const result = parseJsonSafe("null");
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe("stringifyJsonSafe", () => {
    it("should stringify object", () => {
      const data = { key: "value", number: 42 };
      const result = stringifyJsonSafe(data);
      expect(result.success).toBe(true);
      expect(result.json).toBe('{"key":"value","number":42}');
      expect(result.error).toBeUndefined();
    });

    it("should stringify with pretty formatting", () => {
      const data = { key: "value" };
      const result = stringifyJsonSafe(data, true);
      expect(result.success).toBe(true);
      expect(result.json).toContain("\n");
      expect(JSON.parse(result.json!)).toEqual(data);
    });

    it("should handle circular reference error", () => {
      const circular: any = { key: "value" };
      circular.self = circular;
      const result = stringifyJsonSafe(circular);
      expect(result.success).toBe(false);
      expect(result.json).toBeUndefined();
      expect(result.error).toBeDefined();
    });

    it("should stringify array", () => {
      const data = [1, 2, 3];
      const result = stringifyJsonSafe(data);
      expect(result.success).toBe(true);
      expect(result.json).toBe("[1,2,3]");
    });

    it("should stringify null", () => {
      const result = stringifyJsonSafe(null);
      expect(result.success).toBe(true);
      expect(result.json).toBe("null");
    });
  });

  describe("isValidJson", () => {
    it("should return true for valid object", () => {
      expect(isValidJson({ key: "value" })).toBe(true);
    });

    it("should return true for array", () => {
      expect(isValidJson([1, 2, 3])).toBe(true);
    });

    it("should return true for string", () => {
      expect(isValidJson("test")).toBe(true);
    });

    it("should return false for circular reference", () => {
      const circular: any = { key: "value" };
      circular.self = circular;
      expect(isValidJson(circular)).toBe(false);
    });

    it("should return true for null", () => {
      expect(isValidJson(null)).toBe(true);
    });
  });

  describe("deepClone", () => {
    it("should clone object deeply", () => {
      const original = { a: 1, b: { c: 2, d: [3, 4] } };
      const cloned = deepClone(original);
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.b).not.toBe(original.b);
      expect(cloned.b.d).not.toBe(original.b.d);
    });

    it("should clone array", () => {
      const original = [1, { a: 2 }, [3, 4]];
      const cloned = deepClone(original);
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned[1]).not.toBe(original[1]);
      expect(cloned[2]).not.toBe(original[2]);
    });

    it("should handle null", () => {
      expect(deepClone(null)).toBeNull();
    });

    it("should handle primitive values", () => {
      expect(deepClone(42)).toBe(42);
      expect(deepClone("test")).toBe("test");
      expect(deepClone(true)).toBe(true);
    });
  });

  describe("mergeJson", () => {
    it("should merge objects shallowly", () => {
      const target = { a: 1, b: 2 };
      const source = { b: 3, c: 4 };
      const result = mergeJson(target, source);
      expect(result).toEqual({ a: 1, b: 3, c: 4 });
      expect(result).not.toBe(target);
    });

    it("should not modify original objects", () => {
      const target = { a: 1 };
      const source = { a: 2 }; // Même clé pour être Partial<T>
      const result = mergeJson(target, source);
      expect(target).toEqual({ a: 1 });
      expect(source).toEqual({ a: 2 });
      expect(result).toEqual({ a: 2 });
    });

    it("should handle empty objects", () => {
      expect(mergeJson({}, {})).toEqual({});
      expect(mergeJson({ a: 1 }, {})).toEqual({ a: 1 });
      expect(mergeJson({} as Record<string, any>, { b: 2 })).toEqual({ b: 2 });
    });
  });

  describe("deepMerge", () => {
    it("should merge objects deeply", () => {
      const target: any = { a: 1, b: { c: 2, d: 3 } };
      const source: any = { b: { d: 4, e: 5 }, f: 6 };
      const result = deepMerge(target, source);
      expect(result).toEqual({
        a: 1,
        b: { c: 2, d: 4, e: 5 },
        f: 6,
      });
    });

    it("should handle nested arrays", () => {
      const target: any = { a: [1, 2], b: { c: [3, 4] } };
      const source: any = { a: [5, 6], b: { c: [7, 8] } };
      const result = deepMerge(target, source);
      expect(result.a).toEqual([5, 6]); // Arrays are replaced, not merged
      expect(result.b.c).toEqual([7, 8]);
    });

    it("should handle undefined values", () => {
      const target = { a: 1, b: 2 };
      const source = { b: undefined };
      const result = deepMerge(target, source);
      expect(result).toEqual({ a: 1, b: undefined });
    });
  });

  describe("deepEqual", () => {
    it("should compare objects deeply", () => {
      const obj1 = { a: 1, b: { c: 2, d: [3, 4] } };
      const obj2 = { a: 1, b: { c: 2, d: [3, 4] } };
      const obj3 = { a: 1, b: { c: 2, d: [3, 5] } };
      expect(deepEqual(obj1, obj2)).toBe(true);
      expect(deepEqual(obj1, obj3)).toBe(false);
    });

    it("should handle arrays", () => {
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
      expect(deepEqual([1, 2, 3], [1, 2])).toBe(false);
    });

    it("should handle primitive values", () => {
      expect(deepEqual(42, 42)).toBe(true);
      expect(deepEqual(42, 43)).toBe(false);
      expect(deepEqual("test", "test")).toBe(true);
      expect(deepEqual("test", "test2")).toBe(false);
      expect(deepEqual(true, true)).toBe(true);
      expect(deepEqual(true, false)).toBe(false);
      expect(deepEqual(null, null)).toBe(true);
      expect(deepEqual(null, undefined)).toBe(false);
    });

    it("should handle different types", () => {
      expect(deepEqual({}, [])).toBe(false);
      expect(deepEqual(0, false)).toBe(false);
      expect(deepEqual("0", 0)).toBe(false);
    });
  });

  describe("getJsonPath", () => {
    const testObj = {
      a: {
        b: {
          c: 42,
          d: [1, 2, { e: 3 }],
        },
      },
      f: "test",
    };

    it("should get nested value", () => {
      expect(getJsonPath(testObj, "a.b.c")).toBe(42);
      expect(getJsonPath(testObj, "a.b.d.2.e")).toBe(3);
      expect(getJsonPath(testObj, "f")).toBe("test");
    });

    it("should return default value for non-existent path", () => {
      expect(getJsonPath(testObj, "a.b.x")).toBeUndefined();
      expect(getJsonPath(testObj, "a.b.x", "default")).toBe("default");
      expect(getJsonPath(testObj, "non.existent.path", 123)).toBe(123);
    });

    it("should handle array indices", () => {
      expect(getJsonPath(testObj, "a.b.d.0")).toBe(1);
      expect(getJsonPath(testObj, "a.b.d.1")).toBe(2);
      expect(getJsonPath(testObj, "a.b.d.10")).toBeUndefined();
    });

    it("should handle null/undefined objects", () => {
      expect(getJsonPath(null, "a.b.c", "default")).toBe("default");
      expect(getJsonPath(undefined, "a.b.c", "default")).toBe("default");
      expect(getJsonPath({}, "a.b.c")).toBeUndefined();
    });
  });

  describe("setJsonPath", () => {
    it("should set nested value", () => {
      const obj: any = {};
      expect(setJsonPath(obj, "a.b.c", 42)).toBe(true);
      expect(obj.a.b.c).toBe(42);
    });

    it("should create arrays for numeric indices", () => {
      const obj: any = {};
      expect(setJsonPath(obj, "arr.0", "first")).toBe(true);
      expect(Array.isArray(obj.arr)).toBe(true);
      expect(obj.arr[0]).toBe("first");
    });

    it("should overwrite existing values", () => {
      const obj: any = { a: { b: { c: 1 } } };
      expect(setJsonPath(obj, "a.b.c", 2)).toBe(true);
      expect(obj.a.b.c).toBe(2);
    });

    it("should handle complex paths", () => {
      const obj: any = {};
      expect(setJsonPath(obj, "x.y.z.w", "deep")).toBe(true);
      expect(obj.x.y.z.w).toBe("deep");
    });
  });

  describe("deleteJsonPath", () => {
    it("should delete nested value", () => {
      const obj = { a: { b: { c: 42, d: 99 } } };
      expect(deleteJsonPath(obj, "a.b.c")).toBe(true);
      expect(obj.a.b.c).toBeUndefined();
      expect(obj.a.b.d).toBe(99);
    });

    it("should return false for non-existent path", () => {
      const obj = { a: { b: { c: 42 } } };
      expect(deleteJsonPath(obj, "a.b.x")).toBe(false);
      expect(deleteJsonPath(obj, "x.y.z")).toBe(false);
    });

    it("should handle root level deletion", () => {
      const obj = { a: 1, b: 2 };
      expect(deleteJsonPath(obj, "a")).toBe(true);
      expect(obj.a).toBeUndefined();
      expect(obj.b).toBe(2);
    });
  });

  describe("filterJsonKeys", () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 };

    it("should filter specified keys", () => {
      expect(filterJsonKeys(obj, ["a", "c"])).toEqual({ a: 1, c: 3 });
      expect(filterJsonKeys(obj, ["b", "d"])).toEqual({ b: 2, d: 4 });
    });

    it("should ignore non-existent keys", () => {
      expect(filterJsonKeys(obj, ["a", "x", "y"])).toEqual({ a: 1 });
    });

    it("should return empty object for no matches", () => {
      expect(filterJsonKeys(obj, ["x", "y", "z"])).toEqual({});
    });

    it("should handle empty keys array", () => {
      expect(filterJsonKeys(obj, [])).toEqual({});
    });
  });

  describe("transformJsonKeys", () => {
    const obj = { firstName: "John", lastName: "Doe", age: 30 };

    it("should transform keys", () => {
      const result = transformJsonKeys(obj, (key) => key.toUpperCase());
      expect(result).toEqual({
        FIRSTNAME: "John",
        LASTNAME: "Doe",
        AGE: 30,
      });
    });

    it("should add prefix to keys", () => {
      const result = transformJsonKeys(obj, (key) => `user_${key}`);
      expect(result).toEqual({
        user_firstName: "John",
        user_lastName: "Doe",
        user_age: 30,
      });
    });

    it("should handle empty object", () => {
      expect(transformJsonKeys({}, (key) => key)).toEqual({});
    });
  });

  describe("flattenJson", () => {
    it("should flatten nested object", () => {
      const obj = {
        a: {
          b: {
            c: 1,
            d: 2,
          },
          e: 3,
        },
        f: 4,
      };
      expect(flattenJson(obj)).toEqual({
        "a.b.c": 1,
        "a.b.d": 2,
        "a.e": 3,
        f: 4,
      });
    });

    it("should handle arrays", () => {
      const obj = {
        a: {
          b: [1, 2, 3],
        },
      };
      expect(flattenJson(obj)).toEqual({
        "a.b": [1, 2, 3],
      });
    });

    it("should handle empty object", () => {
      expect(flattenJson({})).toEqual({});
    });

    it("should use custom prefix", () => {
      const obj = { a: { b: 1 } };
      expect(flattenJson(obj, "prefix")).toEqual({
        "prefix.a.b": 1,
      });
    });
  });

  describe("unflattenJson", () => {
    it("should unflatten object", () => {
      const flat = {
        "a.b.c": 1,
        "a.b.d": 2,
        "a.e": 3,
        f: 4,
      };
      expect(unflattenJson(flat)).toEqual({
        a: {
          b: {
            c: 1,
            d: 2,
          },
          e: 3,
        },
        f: 4,
      });
    });

    it("should handle arrays in paths", () => {
      const flat = {
        "a.b.0": 1,
        "a.b.1": 2,
        "a.b.2": 3,
      };
      expect(unflattenJson(flat)).toEqual({
        a: {
          b: [1, 2, 3],
        },
      });
    });

    it("should handle empty object", () => {
      expect(unflattenJson({})).toEqual({});
    });

    it("should be inverse of flattenJson", () => {
      const original = {
        a: {
          b: {
            c: 1,
            d: [2, 3, { e: 4 }],
          },
          f: "test",
        },
        g: null,
      };
      const flat = flattenJson(original);
      const unflattened = unflattenJson(flat);
      expect(unflattened).toEqual(original);
    });
  });

  describe("validateJsonSchema", () => {
    it("should validate simple schema", () => {
      const schema = {
        type: "object" as const,
        properties: {
          name: { type: "string", required: true },
          age: { type: "number", required: false },
        },
      };

      const valid = { name: "John", age: 30 };
      const invalid = { name: 123 };
      const missing = { age: 30 };

      expect(validateJsonSchema(valid, schema).valid).toBe(true);
      expect(validateJsonSchema(invalid, schema).valid).toBe(false);
      expect(validateJsonSchema(missing, schema).valid).toBe(false);
    });

    it("should validate nested schema", () => {
      const schema = {
        type: "object" as const,
        properties: {
          user: {
            type: "object",
            properties: {
              name: { type: "string", required: true },
              address: {
                type: "object",
                properties: {
                  street: { type: "string", required: true },
                  city: { type: "string", required: true },
                },
              },
            },
          },
        },
      };

      const valid = {
        user: {
          name: "John",
          address: {
            street: "123 Main St",
            city: "Paris",
          },
        },
      };

      const invalid = {
        user: {
          name: "John",
          address: {
            street: 123, // should be string
            city: "Paris",
          },
        },
      };

      expect(validateJsonSchema(valid, schema).valid).toBe(true);
      expect(validateJsonSchema(invalid, schema).valid).toBe(false);
    });

    it("should validate array schema", () => {
      const schema = {
        type: "array" as const,
        items: {
          type: "object",
          properties: {
            id: { type: "number", required: true },
            name: { type: "string", required: true },
          },
        },
      };

      const valid = [
        { id: 1, name: "Item 1" },
        { id: 2, name: "Item 2" },
      ];

      const invalid = [
        { id: 1, name: "Item 1" },
        { id: "2", name: "Item 2" }, // id should be number
      ];

      expect(validateJsonSchema(valid, schema).valid).toBe(true);
      expect(validateJsonSchema(invalid, schema).valid).toBe(false);
    });

    it("should handle optional fields", () => {
      const schema = {
        type: "object" as const,
        properties: {
          name: { type: "string", required: true },
          email: { type: "string", required: false },
        },
      };

      const withEmail = { name: "John", email: "john@example.com" };
      const withoutEmail = { name: "John" };

      expect(validateJsonSchema(withEmail, schema).valid).toBe(true);
      expect(validateJsonSchema(withoutEmail, schema).valid).toBe(true);
    });
  });

  describe("formatJsonForDisplay", () => {
    it("should format JSON with colors", () => {
      const data = { key: "value", number: 42, bool: true, null: null };
      const result = formatJsonForDisplay(data);

      // Should contain ANSI color codes
      expect(result).toContain("\x1b[");
      expect(result).toContain('"key"');
      expect(result).toContain('"value"');
      expect(result).toContain("42");
    });

    it("should handle invalid JSON gracefully", () => {
      const circular: any = { key: "value" };
      circular.self = circular;
      const result = formatJsonForDisplay(circular);
      expect(result).toBe("Invalid JSON");
    });

    it("should format with pretty indentation", () => {
      const data = { a: 1, b: { c: 2 } };
      const result = formatJsonForDisplay(data, 2);
      expect(result).toContain("\n");
      expect(result).toContain("  "); // indentation
    });
  });

  describe("testJsonUtils", () => {
    it("should run all tests successfully", () => {
      // Mock console.log to capture output
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (msg: string) => logs.push(msg);

      const result = testJsonUtils();

      console.log = originalLog;

      expect(result).toBe(true);
      expect(logs).toContain("✅ Tous les tests json-utils ont réussi");
    });
  });
});
