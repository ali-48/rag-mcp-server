/**
 * Tests unitaires pour le script validate-rules.js
 *
 * Ces tests vérifient que le script de validation des règles absolues
 * fonctionne correctement et détecte les violations appropriées.
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Mock des modules
vi.mock("fs/promises");
vi.mock("path");
vi.mock("url");
describe("validate-rules.js", () => {
    const mockProjectRoot = "/mock/project";
    const mockRulesContent = `# 📜 Règles absolues pour développer un **RAG MCP Server**

> Version: 3.0.0 | Dernière mise à jour: 2026-01-16

## 🔥 RÈGLE ABSOLUE #1 : Base décisionnelle immuable`;
    beforeEach(() => {
        vi.resetAllMocks();
        // Mock de fileURLToPath
        const fileURLToPathMock = vi.mocked(fileURLToPath);
        fileURLToPathMock.mockReturnValue("/mock/scripts/validate-rules.js");
        // Mock de path.dirname
        const dirnameMock = vi.mocked(path.dirname);
        dirnameMock.mockReturnValue("/mock/scripts");
        // Mock de path.join
        const joinMock = vi.mocked(path.join);
        joinMock.mockImplementation((...args) => args.join("/"));
        // Mock de path.relative
        const relativeMock = vi.mocked(path.relative);
        relativeMock.mockReturnValue("relative/path");
        // Mock de path.extname
        const extnameMock = vi.mocked(path.extname);
        extnameMock.mockReturnValue(".ts");
    });
    afterEach(() => {
        vi.clearAllMocks();
    });
    describe("Validation de la règle 1", () => {
        it("devrait passer quand le fichier des règles existe et a la version correcte", async () => {
            // Mock fs.readFile pour retourner le contenu des règles
            const readFileMock = vi.mocked(fs.readFile);
            readFileMock.mockResolvedValue(mockRulesContent);
            // Mock fs.readdir pour retourner des fichiers sources
            const readdirMock = vi.mocked(fs.readdir);
            readdirMock.mockResolvedValue([
                { name: "file1.ts", isDirectory: () => false, isFile: () => true },
                { name: "file2.ts", isDirectory: () => false, isFile: () => true },
            ]);
            // Mock fs.stat pour retourner une taille de fichier valide
            const statMock = vi.mocked(fs.stat);
            statMock.mockResolvedValue({ size: 1000 });
            // Mock fs.access pour simuler l'existence des fichiers
            const accessMock = vi.mocked(fs.access);
            accessMock.mockResolvedValue(undefined);
            // Importer le module après les mocks
            const { validateRule1 } = await import("../../scripts/validate-rules.js");
            const result = await validateRule1();
            expect(result.ruleNumber).toBe(1);
            expect(result.ruleName).toBe("Base décisionnelle immuable");
            expect(result.violations).toHaveLength(0);
        });
        it("devrait échouer quand la version des règles est incorrecte", async () => {
            const readFileMock = vi.mocked(fs.readFile);
            readFileMock.mockResolvedValue("Version: 2.0.0"); // Version incorrecte
            const { validateRule1 } = await import("../../scripts/validate-rules.js");
            const result = await validateRule1();
            expect(result.violations).toContain("Version des règles non trouvée ou incorrecte");
        });
        it("devrait générer un warning quand peu de références aux règles sont trouvées", async () => {
            const readFileMock = vi.mocked(fs.readFile);
            readFileMock.mockResolvedValue(mockRulesContent);
            const readdirMock = vi.mocked(fs.readdir);
            readdirMock.mockResolvedValue([
                { name: "file1.ts", isDirectory: () => false, isFile: () => true },
            ]);
            const statMock = vi.mocked(fs.stat);
            statMock.mockResolvedValue({ size: 1000 });
            const accessMock = vi.mocked(fs.access);
            accessMock.mockResolvedValue(undefined);
            const { validateRule1 } = await import("../../scripts/validate-rules.js");
            const result = await validateRule1();
            expect(result.warnings).toContain(expect.stringContaining("Seulement"));
        });
    });
    describe("Validation de la règle 3", () => {
        it("devrait détecter les icônes dans le JSON métier", async () => {
            const readFileMock = vi.mocked(fs.readFile);
            readFileMock.mockResolvedValue(`
        return JSON.stringify({
          status: "✅ success",
          result: { "📁 files": 42 }
        });
      `);
            const accessMock = vi.mocked(fs.access);
            accessMock.mockResolvedValue(undefined);
            const { validateRule3 } = await import("../../scripts/validate-rules.js");
            const result = await validateRule3();
            // Le script devrait détecter les icônes
            expect(result.violations.length).toBeGreaterThan(0);
        });
        it("devrait passer quand le JSON est strict (sans icônes)", async () => {
            const readFileMock = vi.mocked(fs.readFile);
            readFileMock.mockResolvedValue(`
        return JSON.stringify({
          status: "success",
          result: { files: 42 }
        });
      `);
            const accessMock = vi.mocked(fs.access);
            accessMock.mockResolvedValue(undefined);
            const { validateRule3 } = await import("../../scripts/validate-rules.js");
            const result = await validateRule3();
            expect(result.violations).toHaveLength(0);
        });
    });
    describe("Validation de la règle 25", () => {
        it('devrait détecter les fichiers avec "refactored" dans le nom', async () => {
            const readdirMock = vi.mocked(fs.readdir);
            readdirMock.mockResolvedValue([
                {
                    name: "vector-store-refactored.ts",
                    isDirectory: () => false,
                    isFile: () => true,
                },
                {
                    name: "rag-guards-refactored.ts",
                    isDirectory: () => false,
                    isFile: () => true,
                },
                {
                    name: "normal-file.ts",
                    isDirectory: () => false,
                    isFile: () => true,
                },
            ]);
            const statMock = vi.mocked(fs.stat);
            statMock.mockResolvedValue({
                isDirectory: () => false,
                size: 1000,
            });
            const accessMock = vi.mocked(fs.access);
            accessMock.mockResolvedValue(undefined);
            const { validateRule25 } = await import("../../scripts/validate-rules.js");
            const result = await validateRule25();
            expect(result.warnings).toContain(expect.stringContaining('fichiers avec "refactored"'));
        });
        it("devrait détecter l'absence du scanner de duplication", async () => {
            const accessMock = vi.mocked(fs.access);
            accessMock.mockRejectedValue(new Error("Fichier non trouvé"));
            const { validateRule25 } = await import("../../scripts/validate-rules.js");
            const result = await validateRule25();
            expect(result.violations).toContain(expect.stringContaining("Scanner de duplication non trouvé"));
        });
    });
    describe("Fonctions utilitaires", () => {
        it("fileExists devrait retourner true quand le fichier existe", async () => {
            const accessMock = vi.mocked(fs.access);
            accessMock.mockResolvedValue(undefined);
            const { fileExists } = await import("../../scripts/validate-rules.js");
            const exists = await fileExists("/some/file.ts");
            expect(exists).toBe(true);
        });
        it("fileExists devrait retourner false quand le fichier n'existe pas", async () => {
            const accessMock = vi.mocked(fs.access);
            accessMock.mockRejectedValue(new Error("Fichier non trouvé"));
            const { fileExists } = await import("../../scripts/validate-rules.js");
            const exists = await fileExists("/some/file.ts");
            expect(exists).toBe(false);
        });
    });
});
//# sourceMappingURL=validate-rules.test.js.map