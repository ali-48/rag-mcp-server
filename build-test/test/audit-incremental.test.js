// Tests unitaires pour l'audit incrémental
import { existsSync } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAstCacheManager } from "../scripts/ast-cache-manager.js";
import { auditFileIncremental, auditFilesIncremental, } from "../scripts/audit-incremental.js";
import { getFileHash } from "../scripts/utils/file-hasher.js";
// Dossier temporaire pour les tests
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DIR = path.join(__dirname, "temp-test-files");
describe("Audit Incrémental", () => {
    beforeEach(async () => {
        // Créer le dossier de test s'il n'existe pas
        if (!existsSync(TEST_DIR)) {
            await mkdir(TEST_DIR, { recursive: true });
        }
        // Nettoyer les fichiers temporaires existants
        // (dans un vrai environnement, on utiliserait des mocks)
    });
    afterEach(async () => {
        // Nettoyer les fichiers temporaires
        // (dans un vrai environnement, on supprimerait les fichiers créés)
    });
    describe("Fonction auditFilesIncremental", () => {
        it("devrait retourner un résultat avec les propriétés attendues", async () => {
            // Créer un fichier de test temporaire
            const testFilePath = path.join(TEST_DIR, "test-file-1.ts");
            const testContent = `
        // Fichier de test TypeScript
        export function testFunction(): string {
          return "Hello, World!";
        }

        export class TestClass {
          private value: string;

          constructor(value: string) {
            this.value = value;
          }

          public getValue(): string {
            return this.value;
          }
        }
      `;
            await writeFile(testFilePath, testContent, "utf8");
            // Exécuter l'audit
            const result = await auditFilesIncremental([testFilePath], {
                useAstCache: false, // Désactiver le cache pour les tests
                generateRecommendations: false,
                exportJson: false,
            });
            // Vérifier les propriétés de base
            expect(result).toBeDefined();
            expect(result.auditId).toBeDefined();
            expect(result.startTime).toBeInstanceOf(Date);
            expect(result.endTime).toBeInstanceOf(Date);
            expect(result.durationMs).toBeGreaterThanOrEqual(0);
            expect(result.filesAnalyzed).toContain(testFilePath);
            expect(result.totalFiles).toBe(1);
            expect(result.fileChanges).toBeInstanceOf(Array);
            expect(result.statistics).toBeDefined();
            expect(result.recommendations).toBeInstanceOf(Array);
            expect(result.metadata).toBeDefined();
            // Vérifier les statistiques
            expect(result.statistics.addedFiles).toBeGreaterThanOrEqual(0);
            expect(result.statistics.modifiedFiles).toBeGreaterThanOrEqual(0);
            expect(result.statistics.deletedFiles).toBeGreaterThanOrEqual(0);
            expect(result.statistics.unchangedFiles).toBeGreaterThanOrEqual(0);
            // Nettoyer
            await unlink(testFilePath);
        });
        it("devrait détecter un fichier ajouté", async () => {
            const testFilePath = path.join(TEST_DIR, "new-file.ts");
            const testContent = "// Nouveau fichier";
            await writeFile(testFilePath, testContent, "utf8");
            const result = await auditFilesIncremental([testFilePath], {
                useAstCache: false,
                generateRecommendations: false,
            });
            // Le fichier devrait être détecté comme ajouté (car pas dans le cache)
            expect(result.fileChanges).toHaveLength(1);
            expect(result.fileChanges[0].filePath).toBe(testFilePath);
            expect(result.fileChanges[0].changeType).toBe("added");
            await unlink(testFilePath);
        });
        it("devrait gérer les fichiers inexistants", async () => {
            const nonExistentFile = path.join(TEST_DIR, "non-existent-file.ts");
            const result = await auditFilesIncremental([nonExistentFile], {
                useAstCache: false,
                generateRecommendations: false,
            });
            // Le fichier inexistant ne devrait pas être dans la liste analysée
            expect(result.filesAnalyzed).not.toContain(nonExistentFile);
            expect(result.totalFiles).toBe(0);
        });
    });
    describe("Fonction auditFileIncremental", () => {
        it("devrait auditer un seul fichier", async () => {
            const testFilePath = path.join(TEST_DIR, "single-file.ts");
            const testContent = "export const x = 42;";
            await writeFile(testFilePath, testContent, "utf8");
            const result = await auditFileIncremental(testFilePath, {
                useAstCache: false,
                generateRecommendations: false,
            });
            expect(result).toBeDefined();
            expect(result.filesAnalyzed).toContain(testFilePath);
            expect(result.totalFiles).toBe(1);
            await unlink(testFilePath);
        });
        it("devrait retourner un résultat vide pour un fichier inexistant", async () => {
            const nonExistentFile = path.join(TEST_DIR, "does-not-exist.ts");
            const result = await auditFileIncremental(nonExistentFile, {
                useAstCache: false,
                generateRecommendations: false,
            });
            expect(result.filesAnalyzed).not.toContain(nonExistentFile);
            expect(result.totalFiles).toBe(0);
        });
    });
    describe("Cache AST", () => {
        it("devrait utiliser le cache pour détecter les fichiers inchangés", async () => {
            const testFilePath = path.join(TEST_DIR, "cached-file.ts");
            const testContent = 'export const cachedValue = "test";';
            await writeFile(testFilePath, testContent, "utf8");
            // Premier audit - devrait détecter comme ajouté
            const firstResult = await auditFilesIncremental([testFilePath], {
                useAstCache: true,
                generateRecommendations: false,
            });
            expect(firstResult.fileChanges[0].changeType).toBe("added");
            // Deuxième audit avec le même fichier - devrait détecter comme inchangé
            const secondResult = await auditFilesIncremental([testFilePath], {
                useAstCache: true,
                generateRecommendations: false,
            });
            // Le fichier devrait être inchangé (ou expiré selon la configuration)
            expect(secondResult.fileChanges[0].changeType).toBe("unchanged");
            await unlink(testFilePath);
        });
        it("devrait détecter les fichiers modifiés", async () => {
            const testFilePath = path.join(TEST_DIR, "modified-file.ts");
            const initialContent = "export const v1 = 1;";
            const modifiedContent = "export const v2 = 2;";
            // Créer le fichier avec le contenu initial
            await writeFile(testFilePath, initialContent, "utf8");
            // Premier audit
            await auditFilesIncremental([testFilePath], {
                useAstCache: true,
                generateRecommendations: false,
            });
            // Modifier le fichier
            await writeFile(testFilePath, modifiedContent, "utf8");
            // Deuxième audit
            const result = await auditFilesIncremental([testFilePath], {
                useAstCache: true,
                generateRecommendations: false,
            });
            // Devrait détecter comme modifié
            expect(result.fileChanges[0].changeType).toBe("modified");
            await unlink(testFilePath);
        });
    });
    describe("Gestionnaire de cache AST", () => {
        it("devrait créer une instance de cache manager", () => {
            const cacheManager = createAstCacheManager({
                enabled: true,
                cacheDir: path.join(TEST_DIR, "test-cache"),
            });
            expect(cacheManager).toBeDefined();
            expect(cacheManager.get).toBeInstanceOf(Function);
            expect(cacheManager.set).toBeInstanceOf(Function);
            expect(cacheManager.compare).toBeInstanceOf(Function);
        });
        it("devrait sauvegarder et récupérer des entrées du cache", async () => {
            const cacheManager = createAstCacheManager({
                enabled: true,
                cacheDir: path.join(TEST_DIR, "test-cache-2"),
            });
            const testFilePath = path.join(TEST_DIR, "cache-test.ts");
            const testContent = 'export const test = "cache";';
            await writeFile(testFilePath, testContent, "utf8");
            // Sauvegarder dans le cache
            const saveResult = await cacheManager.set(testFilePath, '{"type": "Program"}', [{ name: "test", type: "variable", startLine: 1, endLine: 1 }], { qualityScore: 0.8 });
            expect(saveResult).toBe(true);
            // Récupérer du cache
            const cachedEntry = await cacheManager.get(testFilePath);
            expect(cachedEntry).toBeDefined();
            expect(cachedEntry?.filePath).toBe(testFilePath);
            expect(cachedEntry?.astJson).toBe('{"type": "Program"}');
            expect(cachedEntry?.symbols).toHaveLength(1);
            expect(cachedEntry?.qualityMetrics.qualityScore).toBe(0.8);
            await unlink(testFilePath);
        });
        it("devrait comparer les fichiers avec le cache", async () => {
            const cacheManager = createAstCacheManager({
                enabled: true,
                cacheDir: path.join(TEST_DIR, "test-cache-3"),
            });
            const testFilePath = path.join(TEST_DIR, "compare-test.ts");
            const testContent = 'export const compare = "test";';
            await writeFile(testFilePath, testContent, "utf8");
            // Sauvegarder dans le cache
            await cacheManager.set(testFilePath, "{}", [], { qualityScore: 0.5 });
            // Comparer (fichier inchangé)
            const comparison = await cacheManager.compare(testFilePath);
            expect(comparison).toBeDefined();
            expect(comparison.status).toBe("hit");
            expect(comparison.isModified).toBe(false);
            expect(comparison.currentHash).toBeDefined();
            expect(comparison.cachedHash).toBeDefined();
            // Modifier le fichier
            await writeFile(testFilePath, 'export const compare = "modified";', "utf8");
            // Comparer à nouveau (fichier modifié)
            const modifiedComparison = await cacheManager.compare(testFilePath);
            expect(modifiedComparison.isModified).toBe(true);
            expect(modifiedComparison.status).toBe("stale");
            await unlink(testFilePath);
        });
    });
    describe("Fonction de hash de fichier", () => {
        it("devrait calculer le hash MD5 d'un fichier", async () => {
            const testFilePath = path.join(TEST_DIR, "hash-test.txt");
            const testContent = "Contenu de test pour le hash";
            await writeFile(testFilePath, testContent, "utf8");
            const hash = await getFileHash(testFilePath);
            expect(hash).toBeDefined();
            expect(typeof hash).toBe("string");
            expect(hash?.length).toBe(32); // MD5 hash length
            // Le hash devrait être le même pour le même contenu
            const hash2 = await getFileHash(testFilePath);
            expect(hash).toBe(hash2);
            await unlink(testFilePath);
        });
        it("devrait retourner null pour un fichier inexistant", async () => {
            const nonExistentFile = path.join(TEST_DIR, "non-existent-hash.txt");
            const hash = await getFileHash(nonExistentFile);
            expect(hash).toBeNull();
        });
    });
    describe("Recommandations", () => {
        it("devrait générer des recommandations basées sur les changements", async () => {
            const testFilePath = path.join(TEST_DIR, "recommendation-test.ts");
            const testContent = `
        // Fichier avec plusieurs symboles
        export function func1() {}
        export function func2() {}
        export class Class1 {}
        export interface Interface1 {}
      `;
            await writeFile(testFilePath, testContent, "utf8");
            const result = await auditFilesIncremental([testFilePath], {
                useAstCache: false,
                generateRecommendations: true,
            });
            expect(result.recommendations).toBeInstanceOf(Array);
            // Vérifier la structure des recommandations
            if (result.recommendations.length > 0) {
                const recommendation = result.recommendations[0];
                expect(recommendation.priority).toBeDefined();
                expect(recommendation.category).toBeDefined();
                expect(recommendation.description).toBeDefined();
                expect(recommendation.affectedFiles).toBeInstanceOf(Array);
                expect(recommendation.suggestedActions).toBeInstanceOf(Array);
            }
            await unlink(testFilePath);
        });
        it("devrait générer des recommandations pour les fichiers modifiés", async () => {
            // Créer plusieurs fichiers pour tester les recommandations
            const files = [];
            for (let i = 0; i < 6; i++) {
                const filePath = path.join(TEST_DIR, `multi-file-${i}.ts`);
                const content = `export const value${i} = ${i};`;
                await writeFile(filePath, content, "utf8");
                files.push(filePath);
            }
            const result = await auditFilesIncremental(files, {
                useAstCache: false,
                generateRecommendations: true,
            });
            // Devrait avoir des recommandations (au moins pour les fichiers ajoutés)
            expect(result.recommendations.length).toBeGreaterThan(0);
            // Nettoyer
            for (const file of files) {
                await unlink(file);
            }
        });
    });
    describe("Performance", () => {
        it("devrait auditer plusieurs fichiers rapidement", async () => {
            const files = [];
            const startTime = Date.now();
            // Créer 10 fichiers de test
            for (let i = 0; i < 10; i++) {
                const filePath = path.join(TEST_DIR, `perf-test-${i}.ts`);
                const content = `// Fichier de test ${i}\nexport const value${i} = ${i};`;
                await writeFile(filePath, content, "utf8");
                files.push(filePath);
            }
            const result = await auditFilesIncremental(files, {
                useAstCache: false,
                generateRecommendations: false,
            });
            const endTime = Date.now();
            const duration = endTime - startTime;
            // L'audit devrait prendre moins de 5 secondes pour 10 fichiers
            expect(duration).toBeLessThan(5000);
            expect(result.totalFiles).toBe(10);
            // Nettoyer
            for (const file of files) {
                await unlink(file);
            }
        });
    });
    describe("Configuration", () => {
        it("devrait accepter une configuration personnalisée", async () => {
            const testFilePath = path.join(TEST_DIR, "config-test.ts");
            await writeFile(testFilePath, "export const test = 1;", "utf8");
            const customConfig = {
                useAstCache: false,
                similarityThreshold: 0.9,
                trackedSymbolTypes: ["function", "class"],
                ignoreMinorChanges: true,
                generateRecommendations: false,
                exportJson: false,
            };
            const result = await auditFilesIncremental([testFilePath], customConfig);
            expect(result).toBeDefined();
            expect(result.metadata.config).toMatchObject(customConfig);
            await unlink(testFilePath);
        });
        it("devrait utiliser les valeurs par défaut lorsque la configuration est partielle", async () => {
            const testFilePath = path.join(TEST_DIR, "default-config-test.ts");
            await writeFile(testFilePath, "export const test = 1;", "utf8");
            const partialConfig = {
                useAstCache: false,
                generateRecommendations: false,
            };
            const result = await auditFilesIncremental([testFilePath], partialConfig);
            expect(result.metadata.config.useAstCache).toBe(false);
            expect(result.metadata.config.generateRecommendations).toBe(false);
            // Les autres valeurs devraient être les valeurs par défaut
            expect(result.metadata.config.similarityThreshold).toBe(0.8);
            expect(result.metadata.config.exportJson).toBe(false);
            await unlink(testFilePath);
        });
    });
});
//# sourceMappingURL=audit-incremental.test.js.map