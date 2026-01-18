/**
 * Tests unitaires pour string-utils.ts
 * Couverture complète des 18 fonctions utilitaires
 */
import { describe, expect, it } from "vitest";
import { cleanComment, countWords, escapeRegExp, extractKeywords, formatDuration, formatFileSize, getFileExtension, hashString, isAlphanumeric, isValidIdentifier, normalizeString, removeAccents, stringSimilarity, testStringUtils, toCamelCase, toKebabCase, toPascalCase, toSnakeCase, truncateString, } from "../../src/core/utils/string-utils.js";
describe("string-utils", () => {
    describe("normalizeString", () => {
        it("should normalize string with spaces and special characters", () => {
            expect(normalizeString("  Hello  World!  ")).toBe("hello world");
            expect(normalizeString("Test-String_123")).toBe("test string 123");
        });
        it("should handle empty string", () => {
            expect(normalizeString("")).toBe("");
        });
    });
    describe("getFileExtension", () => {
        it("should extract file extension", () => {
            expect(getFileExtension("file.ts")).toBe(".ts");
            expect(getFileExtension("file.test.js")).toBe(".js");
            expect(getFileExtension("document.pdf")).toBe(".pdf");
        });
        it("should handle files without extension", () => {
            expect(getFileExtension("README")).toBe("");
            expect(getFileExtension("file.")).toBe("");
        });
        it("should handle hidden files", () => {
            expect(getFileExtension(".gitignore")).toBe("");
            expect(getFileExtension(".env.local")).toBe(".local");
        });
    });
    describe("cleanComment", () => {
        it("should clean Python comments", () => {
            expect(cleanComment("# This is a comment", "python")).toBe("This is a comment");
            expect(cleanComment("#   indented comment", "python")).toBe("indented comment");
        });
        it("should clean JavaScript/TypeScript comments", () => {
            expect(cleanComment("// This is a comment", "javascript")).toBe("This is a comment");
            expect(cleanComment("/* Multi-line comment */", "typescript")).toBe("Multi-line comment");
            expect(cleanComment("/**\n * Doc comment\n */", "javascript")).toBe("Doc comment");
        });
        it("should handle unknown language", () => {
            expect(cleanComment("  some text  ", "unknown")).toBe("some text");
        });
    });
    describe("formatFileSize", () => {
        it("should format bytes", () => {
            expect(formatFileSize(0)).toBe("0 B");
            expect(formatFileSize(500)).toBe("500.00 B");
            expect(formatFileSize(1024)).toBe("1.00 KB");
            expect(formatFileSize(1024 * 1024)).toBe("1.00 MB");
            expect(formatFileSize(1024 * 1024 * 1024)).toBe("1.00 GB");
        });
        it("should handle large sizes", () => {
            expect(formatFileSize(1024 * 1024 * 1024 * 5)).toBe("5.00 GB");
        });
    });
    describe("hashString", () => {
        it("should generate consistent hash", () => {
            const hash1 = hashString("test string");
            const hash2 = hashString("test string");
            expect(hash1).toBe(hash2);
            expect(typeof hash1).toBe("string");
            expect(hash1.length).toBeGreaterThan(0);
        });
        it("should generate different hashes for different strings", () => {
            const hash1 = hashString("string1");
            const hash2 = hashString("string2");
            expect(hash1).not.toBe(hash2);
        });
    });
    describe("truncateString", () => {
        it("should truncate long strings", () => {
            expect(truncateString("Hello World", 8)).toBe("Hello...");
            expect(truncateString("Short", 10)).toBe("Short");
            expect(truncateString("ExactlyTen", 10)).toBe("ExactlyTen");
        });
        it("should handle edge cases", () => {
            expect(truncateString("", 5)).toBe("");
            expect(truncateString("1234567890", 3)).toBe("...");
        });
    });
    describe("escapeRegExp", () => {
        it("should escape regex special characters", () => {
            expect(escapeRegExp("test.*+?^${}()|[]\\")).toBe("test\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\");
            expect(escapeRegExp("simple")).toBe("simple");
        });
    });
    describe("case conversions", () => {
        it("should convert to camelCase", () => {
            expect(toCamelCase("hello world")).toBe("helloWorld");
            expect(toCamelCase("Hello World")).toBe("helloWorld");
            expect(toCamelCase("hello-world")).toBe("helloWorld");
            expect(toCamelCase("hello_world")).toBe("helloWorld");
        });
        it("should convert to PascalCase", () => {
            expect(toPascalCase("hello world")).toBe("HelloWorld");
            expect(toPascalCase("hello-world")).toBe("HelloWorld");
            expect(toPascalCase("hello_world")).toBe("HelloWorld");
        });
        it("should convert to kebab-case", () => {
            expect(toKebabCase("helloWorld")).toBe("hello-world");
            expect(toKebabCase("HelloWorld")).toBe("hello-world");
            expect(toKebabCase("hello world")).toBe("hello-world");
            expect(toKebabCase("hello_world")).toBe("hello-world");
        });
        it("should convert to snake_case", () => {
            expect(toSnakeCase("helloWorld")).toBe("hello_world");
            expect(toSnakeCase("HelloWorld")).toBe("hello_world");
            expect(toSnakeCase("hello world")).toBe("hello_world");
            expect(toSnakeCase("hello-world")).toBe("hello_world");
        });
    });
    describe("validation functions", () => {
        it("should check alphanumeric strings", () => {
            expect(isAlphanumeric("abc123")).toBe(true);
            expect(isAlphanumeric("ABC123")).toBe(true);
            expect(isAlphanumeric("abc-123")).toBe(false);
            expect(isAlphanumeric("abc 123")).toBe(false);
            expect(isAlphanumeric("")).toBe(false);
        });
        it("should check valid identifiers", () => {
            expect(isValidIdentifier("variable")).toBe(true);
            expect(isValidIdentifier("_variable")).toBe(true);
            expect(isValidIdentifier("variable123")).toBe(true);
            expect(isValidIdentifier("123variable")).toBe(false);
            expect(isValidIdentifier("var-name")).toBe(false);
            expect(isValidIdentifier("var name")).toBe(false);
        });
    });
    describe("removeAccents", () => {
        it("should remove accents from strings", () => {
            expect(removeAccents("café")).toBe("cafe");
            expect(removeAccents("naïve")).toBe("naive");
            expect(removeAccents("résumé")).toBe("resume");
            expect(removeAccents("hello")).toBe("hello");
        });
    });
    describe("countWords", () => {
        it("should count words in string", () => {
            expect(countWords("Hello world")).toBe(2);
            expect(countWords("  Multiple   spaces   between   words  ")).toBe(4);
            expect(countWords("")).toBe(0);
            expect(countWords("   ")).toBe(0);
            expect(countWords("Single")).toBe(1);
        });
    });
    describe("extractKeywords", () => {
        it("should extract unique keywords", () => {
            const text = "Hello world hello again world";
            const keywords = extractKeywords(text);
            expect(keywords.sort()).toEqual(["again", "hello", "world"]);
        });
        it("should filter stop words", () => {
            const text = "This is a test of the keyword extraction system";
            const stopWords = ["this", "is", "a", "of", "the"];
            const keywords = extractKeywords(text, stopWords);
            expect(keywords.sort()).toEqual([
                "extraction",
                "keyword",
                "system",
                "test",
            ]);
        });
        it("should ignore short words", () => {
            const text = "a an the it be";
            const keywords = extractKeywords(text);
            expect(keywords).toEqual([]);
        });
    });
    describe("stringSimilarity", () => {
        it("should calculate similarity between strings", () => {
            expect(stringSimilarity("hello", "hello")).toBe(1);
            expect(stringSimilarity("hello", "world")).toBe(0.2); // 'l' en commun
            expect(stringSimilarity("hello", "hell")).toBeGreaterThan(0.8);
            expect(stringSimilarity("abc", "def")).toBe(0);
        });
        it("should handle empty strings", () => {
            expect(stringSimilarity("", "")).toBe(1);
            expect(stringSimilarity("hello", "")).toBe(0);
        });
    });
    describe("formatDuration", () => {
        it("should format milliseconds", () => {
            expect(formatDuration(500)).toBe("500ms");
            expect(formatDuration(1500)).toBe("1.50s");
            expect(formatDuration(90000)).toBe("1.50min");
            expect(formatDuration(7200000)).toBe("2.00h");
        });
        it("should handle edge cases", () => {
            expect(formatDuration(0)).toBe("0ms");
            expect(formatDuration(999)).toBe("999ms");
            expect(formatDuration(59999)).toBe("59.99s");
        });
    });
    describe("testStringUtils", () => {
        it("should run self-test successfully", () => {
            const result = testStringUtils();
            expect(result).toBe(true);
        });
    });
    // Tests d'intégration
    describe("integration tests", () => {
        it("should work together in realistic scenarios", () => {
            // Scenario 1: File processing
            const fileName = "test-file.ts";
            const extension = getFileExtension(fileName);
            expect(extension).toBe(".ts");
            const normalized = normalizeString(fileName);
            expect(normalized).toBe("test file ts");
            const kebab = toKebabCase(normalized);
            expect(kebab).toBe("test-file-ts");
            // Scenario 2: Comment processing
            const comment = "// This is a TypeScript comment";
            const cleaned = cleanComment(comment, "typescript");
            expect(cleaned).toBe("This is a TypeScript comment");
            const wordCount = countWords(cleaned);
            expect(wordCount).toBe(5);
            // Scenario 3: String manipulation pipeline
            const input = "  Héllo_Wörld-Example  ";
            const noAccents = removeAccents(input);
            const camel = toCamelCase(noAccents);
            expect(camel).toBe("helloWorldExample");
            const isValid = isValidIdentifier(camel);
            expect(isValid).toBe(true);
        });
    });
});
//# sourceMappingURL=string-utils.test.js.map