/**
 * Tests unitaires pour file-utils.ts
 * Couverture complète des 30 fonctions utilitaires de manipulation de fichiers
 */

import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  changeExtension,
  copyDirectory,
  copyFile,
  deleteDirectorySafe,
  deleteFileSafe,
  ensureDirectory,
  getDirectorySize,
  getFileNameWithoutExtension,
  getFileSize,
  hasExtension,
  isDirectory,
  isFile,
  listDirectories,
  listFiles,
  makeAbsolute,
  makeRelative,
  normalizePath,
  pathExists,
  readFileSafe,
  readJsonFile,
  walkDirectory,
  writeFileSafe
} from "../../src/core/utils/file-utils.js";

describe("file-utils", () => {
  const testBaseDir = path.join(process.cwd(), ".test-file-utils");
  const testFile = path.join(testBaseDir, "test.txt");
  const testJsonFile = path.join(testBaseDir, "test.json");
  const testSubDir = path.join(testBaseDir, "subdir");
  const testNestedFile = path.join(testSubDir, "nested.txt");

  beforeEach(() => {
    // Nettoyer avant chaque test
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Nettoyer après chaque test
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  describe("pathExists", () => {
    it("should return true for existing file", () => {
      fs.mkdirSync(testBaseDir, { recursive: true });
      fs.writeFileSync(testFile, "test");
      expect(pathExists(testFile)).toBe(true);
    });

    it("should return true for existing directory", () => {
      fs.mkdirSync(testBaseDir, { recursive: true });
      expect(pathExists(testBaseDir)).toBe(true);
    });

    it("should return false for non-existent path", () => {
      expect(pathExists("/non/existent/path")).toBe(false);
    });
  });

  describe("isFile", () => {
    it("should return true for file", () => {
      fs.mkdirSync(testBaseDir, { recursive: true });
      fs.writeFileSync(testFile, "test");
      expect(isFile(testFile)).toBe(true);
    });

    it("should return false for directory", () => {
      fs.mkdirSync(testBaseDir, { recursive: true });
      expect(isFile(testBaseDir)).toBe(false);
    });

    it("should return false for non-existent path", () => {
      expect(isFile("/non/existent/file")).toBe(false);
    });
  });

  describe("isDirectory", () => {
    it("should return true for directory", () => {
      fs.mkdirSync(testBaseDir, { recursive: true });
      expect(isDirectory(testBaseDir)).toBe(true);
    });

    it("should return false for file", () => {
      fs.mkdirSync(testBaseDir, { recursive: true });
      fs.writeFileSync(testFile, "test");
      expect(isDirectory(testFile)).toBe(false);
    });

    it("should return false for non-existent path", () => {
      expect(isDirectory("/non/existent/dir")).toBe(false);
    });
  });

  describe("ensureDirectory", () => {
    it("should create directory if it does not exist", () => {
      expect(pathExists(testBaseDir)).toBe(false);
      ensureDirectory(testBaseDir);
      expect(pathExists(testBaseDir)).toBe(true);
      expect(isDirectory(testBaseDir)).toBe(true);
    });

    it("should not error if directory already exists", () => {
      fs.mkdirSync(testBaseDir, { recursive: true });
      expect(() => ensureDirectory(testBaseDir)).not.toThrow();
    });

    it("should create nested directories", () => {
      const nestedDir = path.join(testBaseDir, "nested", "deep");
      ensureDirectory(nestedDir);
      expect(isDirectory(nestedDir)).toBe(true);
    });
  });

  describe("readFileSafe", () => {
    it("should read file content", () => {
      fs.mkdirSync(testBaseDir, { recursive: true });
      fs.writeFileSync(testFile, "Hello World", "utf8");
      expect(readFileSafe(testFile)).toBe("Hello World");
    });

    it("should return null for non-existent file", () => {
      expect(readFileSafe("/non/existent/file")).toBe(null);
    });

    it("should use specified encoding", () => {
      fs.mkdirSync(testBaseDir, { recursive: true });
      const binaryContent = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
      fs.writeFileSync(testFile, binaryContent);
      expect(readFileSafe(testFile, "binary")).toBe(
        binaryContent.toString("binary"),
      );
    });
  });

  describe("writeFileSafe", () => {
    it("should write file and create directories", () => {
      expect(writeFileSafe(testFile, "Test content")).toBe(true);
      expect(pathExists(testFile)).toBe(true);
      expect(fs.readFileSync(testFile, "utf8")).toBe("Test content");
    });

    it("should return false on write error", () => {
      // Essayer d'écrire dans un chemin invalide
      const invalidPath = "/root/invalid/file.txt";
      expect(writeFileSafe(invalidPath, "content")).toBe(false);
    });

    it("should use specified encoding", () => {
      const binaryContent = "Hello";
      expect(writeFileSafe(testFile, binaryContent, "binary")).toBe(true);
      expect(fs.readFileSync(testFile, "binary")).toBe(binaryContent);
    });
  });

  describe("deleteFileSafe", () => {
    it("should delete existing file", () => {
      fs.mkdirSync(testBaseDir, { recursive: true });
      fs.writeFileSync(testFile, "test");
      expect(pathExists(testFile)).toBe(true);
      expect(deleteFileSafe(testFile)).toBe(true);
      expect(pathExists(testFile)).toBe(false);
    });

    it("should return false for non-existent file", () => {
      expect(deleteFileSafe("/non/existent/file")).toBe(false);
    });

    it("should return false for directory", () => {
      fs.mkdirSync(testBaseDir, { recursive: true });
      expect(deleteFileSafe(testBaseDir)).toBe(false);
    });
  });

  describe("deleteDirectorySafe", () => {
    it("should delete existing directory", () => {
      fs.mkdirSync(testBaseDir, { recursive: true });
      fs.writeFileSync(testFile, "test");
      expect(pathExists(testBaseDir)).toBe(true);
      expect(deleteDirectorySafe(testBaseDir)).toBe(true);
      expect(pathExists(testBaseDir)).toBe(false);
    });

    it("should return false for non-existent directory", () => {
      expect(deleteDirectorySafe("/non/existent/dir")).toBe(false);
    });

    it("should return false for file", () => {
      fs.mkdirSync(testBaseDir, { recursive: true });
      fs.writeFileSync(testFile, "test");
      expect(deleteDirectorySafe(testFile)).toBe(false);
    });
  });

  describe("listFiles", () => {
    beforeEach(() => {
      fs.mkdirSync(testBaseDir, { recursive: true });
      fs.writeFileSync(path.join(testBaseDir, "file1.txt"), "test");
      fs.writeFileSync(path.join(testBaseDir, "file2.js"), "test");
      fs.writeFileSync(path.join(testBaseDir, "file3.ts"), "test");
      fs.mkdirSync(path.join(testBaseDir, "subdir"), { recursive: true });
    });

    it("should list all files without filter", () => {
      const files = listFiles(testBaseDir);
      expect(files).toHaveLength(3);
      expect(files.every((file) => isFile(file))).toBe(true);
    });

    it("should filter by extension", () => {
      const txtFiles = listFiles(testBaseDir, [".txt"]);
      expect(txtFiles).toHaveLength(1);
      expect(txtFiles[0]).toMatch(/\.txt$/);

      const jsFiles = listFiles(testBaseDir, [".js"]);
      expect(jsFiles).toHaveLength(1);
      expect(jsFiles[0]).toMatch(/\.js$/);
    });

    it("should return empty array for non-existent directory", () => {
      expect(listFiles("/non/existent/dir")).toEqual([]);
    });

    it("should return empty array for file path", () => {
      expect(listFiles(testFile)).toEqual([]);
    });
  });

  describe("listDirectories", () => {
    beforeEach(() => {
      fs.mkdirSync(testBaseDir, { recursive: true });
      fs.mkdirSync(path.join(testBaseDir, "dir1"), { recursive: true });
      fs.mkdirSync(path.join(testBaseDir, "dir2"), { recursive: true });
      fs.writeFileSync(path.join(testBaseDir, "file.txt"), "test");
    });

    it("should list directories", () => {
      const dirs = listDirectories(testBaseDir);
      expect(dirs).toHaveLength(2);
      expect(dirs.every((dir) => isDirectory(dir))).toBe(true);
    });

    it("should return empty array for non-existent directory", () => {
      expect(listDirectories("/non/existent/dir")).toEqual([]);
    });

    it("should return empty array for file path", () => {
      expect(listDirectories(path.join(testBaseDir, "file.txt"))).toEqual([]);
    });
  });

  describe("walkDirectory", () => {
    beforeEach(() => {
      fs.mkdirSync(testBaseDir, { recursive: true });
      fs.mkdirSync(testSubDir, { recursive: true });
      fs.writeFileSync(testFile, "test");
      fs.writeFileSync(testNestedFile, "nested");
      fs.writeFileSync(path.join(testBaseDir, "file2.txt"), "test2");
    });

    it("should list all files recursively", () => {
      const files = walkDirectory(testBaseDir);
      expect(files).toHaveLength(3);
      expect(files).toContain(testFile);
      expect(files).toContain(testNestedFile);
    });

    it("should filter files", () => {
      const txtFiles = walkDirectory(testBaseDir, (filePath) =>
        filePath.endsWith(".txt"),
      );
      expect(txtFiles).toHaveLength(3); // Tous les fichiers sont .txt
    });

    it("should return empty array for non-existent directory", () => {
      expect(walkDirectory("/non/existent/dir")).toEqual([]);
    });

    it("should return empty array for file path", () => {
      expect(walkDirectory(testFile)).toEqual([]);
    });
  });

  describe("getFileSize", () => {
    it("should return file size", () => {
      fs.mkdirSync(testBaseDir, { recursive: true });
      const content = "Hello World";
      fs.writeFileSync(testFile, content);
      expect(getFileSize(testFile)).toBe(Buffer.byteLength(content));
    });

    it("should return 0 for non-existent file", () => {
      expect(getFileSize("/non/existent/file")).toBe(0);
    });
  });

  describe("getDirectorySize", () => {
    beforeEach(() => {
      fs.mkdirSync(testBaseDir, { recursive: true });
      fs.mkdirSync(testSubDir, { recursive: true });
      fs.writeFileSync(testFile, "test content");
      fs.writeFileSync(testNestedFile, "nested content");
    });

    it("should calculate total directory size", () => {
      const size1 = Buffer.byteLength("test content");
      const size2 = Buffer.byteLength("nested content");
      const totalSize = getDirectorySize(testBaseDir);
      expect(totalSize).toBe(size1 + size2);
    });

    it("should return 0 for non-existent directory", () => {
      expect(getDirectorySize("/non/existent/dir")).toBe(0);
    });

    it("should return 0 for empty directory", () => {
      const emptyDir = path.join(testBaseDir, "empty");
      fs.mkdirSync(emptyDir, { recursive: true });
      expect(getDirectorySize(emptyDir)).toBe(0);
    });
  });

  describe("copyFile", () => {
    beforeEach(() => {
      fs.mkdirSync(testBaseDir, { recursive: true });
      fs.writeFileSync(testFile, "original content");
    });

    it("should copy file to new location", () => {
      const destFile = path.join(testBaseDir, "copy.txt");
      expect(copyFile(testFile, destFile)).toBe(true);
      expect(pathExists(destFile)).toBe(true);
      expect(fs.readFileSync(destFile, "utf8")).toBe("original content");
    });

    it("should create destination directory", () => {
      const destFile = path.join(testBaseDir, "nested", "copy.txt");
      expect(copyFile(testFile, destFile)).toBe(true);
      expect(pathExists(destFile)).toBe(true);
    });

    it("should return false for non-existent source", () => {
      expect(copyFile("/non/existent/source", testFile)).toBe(false);
    });
  });

  describe("copyDirectory", () => {
    beforeEach(() => {
      fs.mkdirSync(testBaseDir, { recursive: true });
      fs.mkdirSync(testSubDir, { recursive: true });
      fs.writeFileSync(testFile, "file1");
      fs.writeFileSync(testNestedFile, "file2");
    });

    it("should copy directory recursively", () => {
      const destDir = path.join(process.cwd(), ".test-copy-dest");
      deleteDirectorySafe(destDir);

      expect(copyDirectory(testBaseDir, destDir)).toBe(true);
      expect(pathExists(destDir)).toBe(true);
      expect(pathExists(path.join(destDir, "test.txt"))).toBe(true);
      expect(pathExists(path.join(destDir, "subdir", "nested.txt"))).toBe(true);

      deleteDirectorySafe(destDir);
    });

    it("should return false for non-existent source", () => {
      expect(copyDirectory("/non/existent/source", testBaseDir)).toBe(false);
    });

    it("should return false for file source", () => {
      expect(copyDirectory(testFile, testBaseDir)).toBe(false);
    });
  });

  describe("normalizePath", () => {
    it("should normalize path with ..", () => {
      expect(normalizePath("/a/b/../c")).toBe("/a/c");
    });

    it("should normalize path with .", () => {
      expect(normalizePath("/a/./b")).toBe("/a/b");
    });

    it("should handle mixed separators", () => {
      expect(normalizePath("a\\b/c")).toBe("a/b/c");
    });
  });

  describe("makeRelative", () => {
    it("should make path relative", () => {
      expect(makeRelative("/a/b", "/a/b/c/file.txt")).toBe("c/file.txt");
    });

    it("should handle same directory", () => {
      expect(makeRelative("/a/b", "/a/b")).toBe("");
    });
  });

  describe("makeAbsolute", () => {
    it("should make relative path absolute", () => {
      const relativePath = "test.txt";
      const absolutePath = makeAbsolute(relativePath, testBaseDir);
      expect(path.isAbsolute(absolutePath)).toBe(true);
      expect(absolutePath).toBe(path.join(testBaseDir, relativePath));
    });

    it("should not change absolute path", () => {
      const absolutePath = "/absolute/path";
      expect(makeAbsolute(absolutePath)).toBe(absolutePath);
    });

    it("should use current directory if no base", () => {
      const relativePath = "test.txt";
      const absolutePath = makeAbsolute(relativePath);
      expect(absolutePath).toBe(path.resolve(process.cwd(), relativePath));
    });
  });

  describe("getFileNameWithoutExtension", () => {
    it("should remove extension", () => {
      expect(getFileNameWithoutExtension("/path/to/file.txt")).toBe("file");
      expect(getFileNameWithoutExtension("file.js")).toBe("file");
      expect(getFileNameWithoutExtension("file")).toBe("file");
    });

    it("should handle multiple dots", () => {
      expect(getFileNameWithoutExtension("file.test.js")).toBe("file.test");
    });
  });

  describe("hasExtension", () => {
    it("should check extension", () => {
      expect(hasExtension("file.txt", ".txt")).toBe(true);
      expect(hasExtension("file.txt", ".js")).toBe(false);
      expect(hasExtension("file", ".txt")).toBe(false);
    });

    it("should be case insensitive", () => {
      expect(hasExtension("file.TXT", ".txt")).toBe(true);
      expect(hasExtension("file.txt", ".TXT")).toBe(true);
    });
  });

  describe("changeExtension", () => {
    it("should change extension", () => {
      expect(changeExtension("file.txt", ".js")).toBe("file.js");
      expect(changeExtension("/path/to/file.txt", ".json")).toBe(
        "/path/to/file.json",
      );
    });

    it("should add extension if none", () => {
      expect(changeExtension("file", ".txt")).toBe("file.txt");
    });
  });

  describe("readJsonFile", () => {
    beforeEach(() => {
      fs.mkdirSync(testBaseDir, { recursive: true });
      fs.writeFileSync(
        testJsonFile,
        JSON.stringify({ key: "value", number: 42 }),
      );
    });

    it("should read JSON file", () => {
      const data = readJsonFile(testJsonFile);
      expect(data).toEqual({ key: "value", number: 42 });
    });

    it("should return null for non-existent file", () => {
      expect(readJsonFile("/non/existent/file.json")).toBe(null);
    });

    it("should return null for invalid JSON", () => {
      fs.writeFileSync(testJsonFile, "invalid json");
      expect(readJsonFile(testJsonFile)).toBe(null);
    });
  });
});
