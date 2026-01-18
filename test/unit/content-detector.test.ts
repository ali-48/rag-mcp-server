/**
 * Tests unitaires pour content-detector.ts
 * Couverture complète des fonctions de détection de contenu RAG
 */

import { describe, expect, it } from "vitest";
import {
  detectContentType,
  detectLanguageByExtension,
  detectRole
} from "../../src/rag/content-detector.js";

describe("content-detector", () => {
  describe("detectContentType", () => {
    it("should detect TypeScript files by extension", () => {
      const result = detectContentType("src/index.ts");
      expect(result.contentType).toBe("code");
      expect(result.language).toBe("typescript");
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.detectedBy).toBe("extension");
    });

    it("should detect JavaScript files by extension", () => {
      const result = detectContentType("src/index.js");
      expect(result.contentType).toBe("code");
      expect(result.language).toBe("javascript");
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("should detect Python files by extension", () => {
      const result = detectContentType("script.py");
      expect(result.contentType).toBe("code");
      expect(result.language).toBe("python");
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("should detect Markdown files by extension", () => {
      const result = detectContentType("README.md");
      expect(result.contentType).toBe("doc");
      expect(result.language).toBeUndefined();
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("should detect JSON files by extension", () => {
      const result = detectContentType("config.json");
      expect(result.contentType).toBe("config");
      expect(result.language).toBe("json");
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("should detect YAML files by extension", () => {
      const result = detectContentType("docker-compose.yml");
      expect(result.contentType).toBe("config");
      expect(result.language).toBe("yaml");
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("should detect unknown extensions as 'other'", () => {
      const result = detectContentType("file.unknown");
      expect(result.contentType).toBe("other");
      expect(result.confidence).toBeLessThan(0.5);
    });

    it("should detect code content with function declaration", () => {
      const content = `function hello() {
  console.log("Hello World");
}`;
      const result = detectContentType("unknown.txt", content);
      expect(result.contentType).toBe("code");
      expect(result.detectedBy).toBe("content");
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.metadata.hasCodePatterns).toBe(true);
    });

    it("should detect markdown content with headers", () => {
      const content = `# Title
## Subtitle
This is a paragraph.`;
      const result = detectContentType("unknown.txt", content);
      expect(result.contentType).toBe("doc");
      expect(result.metadata.hasMarkdownHeaders).toBe(true);
    });

    it("should detect JSON content", () => {
      const content = `{
  "name": "test",
  "value": 42
}`;
      const result = detectContentType("unknown.txt", content);
      expect(result.contentType).toBe("config");
      expect(result.metadata.hasJsonStructure).toBe(true);
    });

    it("should detect YAML content", () => {
      const content = `---
name: test
value: 42
---`;
      const result = detectContentType("unknown.txt", content);
      expect(result.contentType).toBe("config");
      expect(result.metadata.hasYamlStructure).toBe(true);
    });

    it("should combine extension and content detection", () => {
      const content = `function test() {}`;
      const result = detectContentType("file.js", content);
      expect(result.contentType).toBe("code");
      expect(result.detectedBy).toBe("extension");
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("should override extension with high-confidence content detection", () => {
      const content = `# Title
This is markdown content`;
      const result = detectContentType("file.txt", content);
      expect(result.contentType).toBe("doc");
      expect(result.detectedBy).toBe("content");
      expect(result.confidence).toBeGreaterThan(0.6);
    });
  });

  describe("detectRole", () => {
    it("should detect test role from file path", () => {
      const role = detectRole("", "code", "src/test/my-test.ts");
      expect(role).toBe("test");
    });

    it("should detect example role from file path", () => {
      const role = detectRole("", "code", "examples/demo.js");
      expect(role).toBe("example");
    });

    it("should detect template role from file path", () => {
      const role = detectRole("", "code", "templates/boilerplate.ts");
      expect(role).toBe("template");
    });

    it("should detect helper role from file path", () => {
      const role = detectRole("", "code", "src/utils/helpers.js");
      expect(role).toBe("helper");
    });

    it("should detect test role from content", () => {
      const content = `describe("my test", () => {
  it("should work", () => {
    expect(true).toBe(true);
  });
});`;
      const role = detectRole(content, "code", "src/my-file.ts");
      expect(role).toBe("test");
    });

    it("should detect example role from content", () => {
      const content = `// Example usage:
// const result = myFunction();`;
      const role = detectRole(content, "code", "src/my-file.ts");
      expect(role).toBe("example");
    });

    it("should detect helper role from content", () => {
      const content = `export function formatDate(date) {
  return date.toISOString();
}`;
      const role = detectRole(content, "code", "src/my-file.ts");
      expect(role).toBe("helper");
    });

    it("should detect core role for regular code", () => {
      const content = `class MyClass {
  constructor() {
    this.value = 42;
  }
}`;
      const role = detectRole(content, "code", "src/core/my-class.ts");
      expect(role).toBe("core");
    });

    it("should return 'other' for non-code content", () => {
      const role = detectRole("Some text", "doc", "README.md");
      expect(role).toBe("other");
    });
  });

  describe("detectLanguageByExtension", () => {
    it("should detect TypeScript", () => {
      const lang = detectLanguageByExtension("file.ts");
      expect(lang).toBe("typescript");
    });

    it("should detect JavaScript", () => {
      const lang = detectLanguageByExtension("file.js");
      expect(lang).toBe("javascript");
    });

    it("should detect Python", () => {
      const lang = detectLanguageByExtension("script.py");
      expect(lang).toBe("python");
    });

    it("should detect Bash", () => {
      const lang = detectLanguageByExtension("script.sh");
      expect(lang).toBe("bash");
    });

    it("should detect HTML", () => {
      const lang = detectLanguageByExtension("index.html");
      expect(lang).toBe("html");
    });

    it("should detect CSS", () => {
      const lang = detectLanguageByExtension("styles.css");
      expect(lang).toBe("css");
    });

    it("should detect SCSS", () => {
      const lang = detectLanguageByExtension("styles.scss");
      expect(lang).toBe("scss");
    });

    it("should detect JSON", () => {
      const lang = detectLanguageByExtension("data.json");
      expect(lang).toBe("json");
    });

    it("should detect YAML", () => {
      const lang = detectLanguageByExtension("config.yaml");
      expect(lang).toBe("yaml");
    });

    it("should return undefined for unknown extension", () => {
      const lang = detectLanguageByExtension("file.unknown");
      expect(lang).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("should handle empty content", () => {
      const result = detectContentType("file.js", "");
      expect(result.contentType).toBe("code");
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("should handle very short content", () => {
      const result = detectContentType("file.txt", "a");
      expect(result.contentType).toBe("doc");
    });

    it("should handle mixed content types", () => {
      const content = `# Documentation
\`\`\`javascript
function test() {}
\`\`\``;
      const result = detectContentType("file.md", content);
      expect(result.contentType).toBe("doc");
      expect(result.metadata.hasMarkdownHeaders).toBe(true);
    });

    it("should handle file paths with directories", () => {
      const result = detectContentType("src/components/Button.tsx");
      expect(result.contentType).toBe("code");
      expect(result.language).toBe("typescript");
    });

    it("should handle file paths with multiple dots", () => {
      const result = detectContentType("config.production.json");
      expect(result.contentType).toBe("config");
      expect(result.language).toBe("json");
    });
  });
});
