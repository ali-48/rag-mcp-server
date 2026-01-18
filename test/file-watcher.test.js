// Tests d'intégration pour le file watcher
// Teste le service de surveillance de fichiers avec chokidar et l'audit incrémental

const { describe, it, expect, beforeEach, afterEach, vi } = require("vitest");
const fs = require("fs").promises;
const path = require("path");
const {
  createFileWatcherService,
  FileChangeEvent,
} = require("../scripts/file-watcher-service.js");

// Dossier temporaire pour les tests
const TEST_WATCH_DIR = path.join(__dirname, "temp-watcher-test");

describe("FileWatcherService - Tests d'intégration", () => {
  let watcherService;

  beforeEach(async () => {
    // Créer le dossier de test s'il n'existe pas
    try {
      await fs.mkdir(TEST_WATCH_DIR, { recursive: true });
    } catch (error) {
      // Le dossier existe peut-être déjà
    }

    // Nettoyer les fichiers existants dans le dossier de test
    const files = await fs.readdir(TEST_WATCH_DIR);
    for (const file of files) {
      await fs.unlink(path.join(TEST_WATCH_DIR, file));
    }
  });

  afterEach(async () => {
    // Arrêter le watcher s'il est en cours d'exécution
    if (watcherService) {
      try {
        await watcherService.stop();
      } catch (error) {
        // Ignorer les erreurs d'arrêt
      }
      watcherService = null;
    }

    // Nettoyer le dossier de test
    try {
      const files = await fs.readdir(TEST_WATCH_DIR);
      for (const file of files) {
        await fs.unlink(path.join(TEST_WATCH_DIR, file));
      }
      await fs.rmdir(TEST_WATCH_DIR);
    } catch (error) {
      // Ignorer les erreurs de nettoyage
    }
  });

  describe("Création et configuration", () => {
    it("devrait créer une instance de FileWatcherService avec configuration par défaut", () => {
      watcherService = createFileWatcherService({
        watchPath: TEST_WATCH_DIR,
        verbose: false,
        enableAutoAudit: false, // Désactiver l'audit automatique pour les tests
      });

      expect(watcherService).toBeDefined();
      expect(watcherService.config.watchPath).toBe(TEST_WATCH_DIR);
      expect(watcherService.config.debounceDelay).toBe(3000);
      expect(watcherService.config.enableAutoAudit).toBe(false);
    });

    it("devrait accepter une configuration personnalisée", () => {
      const customConfig = {
        watchPath: TEST_WATCH_DIR,
        debounceDelay: 1000,
        maxBatchSize: 10,
        enableAutoAudit: false,
        verbose: false,
      };

      watcherService = createFileWatcherService(customConfig);

      expect(watcherService.config.watchPath).toBe(TEST_WATCH_DIR);
      expect(watcherService.config.debounceDelay).toBe(1000);
      expect(watcherService.config.maxBatchSize).toBe(10);
    });
  });

  describe("Démarrage et arrêt", () => {
    it("devrait démarrer et arrêter correctement le watcher", async () => {
      watcherService = createFileWatcherService({
        watchPath: TEST_WATCH_DIR,
        verbose: false,
        enableAutoAudit: false,
      });

      // Démarrer le watcher
      const startResult = await watcherService.start();
      expect(startResult).toBe(true);
      expect(watcherService.isWatching).toBe(true);

      // Vérifier l'état
      const status = watcherService.getStatus();
      expect(status.isWatching).toBe(true);
      expect(status.watchPath).toBe(TEST_WATCH_DIR);

      // Arrêter le watcher
      const stopResult = await watcherService.stop();
      expect(stopResult).toBe(true);
      expect(watcherService.isWatching).toBe(false);
    });

    it("devrait gérer les erreurs de démarrage avec un chemin inexistant", async () => {
      const nonExistentPath = path.join(TEST_WATCH_DIR, "non-existent-subdir");

      watcherService = createFileWatcherService({
        watchPath: nonExistentPath,
        verbose: false,
        enableAutoAudit: false,
      });

      // Le démarrage devrait échouer
      await expect(watcherService.start()).rejects.toThrow();
      expect(watcherService.isWatching).toBe(false);
    });

    it("devrait ignorer les appels multiples à start()", async () => {
      watcherService = createFileWatcherService({
        watchPath: TEST_WATCH_DIR,
        verbose: false,
        enableAutoAudit: false,
      });

      // Premier démarrage
      const firstStart = await watcherService.start();
      expect(firstStart).toBe(true);

      // Deuxième démarrage (devrait retourner true sans erreur)
      const secondStart = await watcherService.start();
      expect(secondStart).toBe(true);

      await watcherService.stop();
    });

    it("devrait ignorer les appels à stop() quand non démarré", async () => {
      watcherService = createFileWatcherService({
        watchPath: TEST_WATCH_DIR,
        verbose: false,
        enableAutoAudit: false,
      });

      // Arrêter sans avoir démarré
      const stopResult = await watcherService.stop();
      expect(stopResult).toBe(true);
    });
  });

  describe("Détection de changements de fichiers", () => {
    it("devrait détecter l'ajout d'un fichier", async () => {
      return new Promise(async (resolve, reject) => {
        const testFileName = "test-add-file.js";
        const testFilePath = path.join(TEST_WATCH_DIR, testFileName);
        const testContent = "// Fichier de test ajouté";

        watcherService = createFileWatcherService({
          watchPath: TEST_WATCH_DIR,
          verbose: false,
          enableAutoAudit: false,
          debounceDelay: 100, // Réduire le délai pour les tests
        });

        // Écouter l'événement 'add'
        let addEventReceived = false;
        watcherService.on(FileChangeEvent.ADD, (data) => {
          try {
            expect(data.filePath).toBe(testFilePath);
            expect(data.relativePath).toBe(testFileName);
            expect(data.eventType).toBe(FileChangeEvent.ADD);
            addEventReceived = true;
          } catch (error) {
            reject(error);
          }
        });

        // Démarrer le watcher
        await watcherService.start();

        // Attendre un peu pour que le watcher soit prêt
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Créer un fichier
        await fs.writeFile(testFilePath, testContent, "utf8");

        // Attendre la détection
        setTimeout(async () => {
          try {
            expect(addEventReceived).toBe(true);
            await watcherService.stop();
            resolve();
          } catch (error) {
            reject(error);
          }
        }, 1000);
      });
    });

    it("devrait détecter la modification d'un fichier", async () => {
      return new Promise(async (resolve, reject) => {
        const testFileName = "test-modify-file.js";
        const testFilePath = path.join(TEST_WATCH_DIR, testFileName);
        const initialContent = "// Contenu initial";
        const modifiedContent = "// Contenu modifié";

        // Créer le fichier initial
        await fs.writeFile(testFilePath, initialContent, "utf8");

        watcherService = createFileWatcherService({
          watchPath: TEST_WATCH_DIR,
          verbose: false,
          enableAutoAudit: false,
          debounceDelay: 100,
        });

        // Écouter l'événement 'change'
        let changeEventReceived = false;
        watcherService.on(FileChangeEvent.CHANGE, (data) => {
          try {
            expect(data.filePath).toBe(testFilePath);
            expect(data.relativePath).toBe(testFileName);
            expect(data.eventType).toBe(FileChangeEvent.CHANGE);
            changeEventReceived = true;
          } catch (error) {
            reject(error);
          }
        });

        // Démarrer le watcher
        await watcherService.start();

        // Attendre un peu pour que le watcher soit prêt
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Modifier le fichier
        await fs.writeFile(testFilePath, modifiedContent, "utf8");

        // Attendre la détection
        setTimeout(async () => {
          try {
            expect(changeEventReceived).toBe(true);
            await watcherService.stop();
            resolve();
          } catch (error) {
            reject(error);
          }
        }, 1000);
      });
    });

    it("devrait détecter la suppression d'un fichier", async () => {
      return new Promise(async (resolve, reject) => {
        const testFileName = "test-delete-file.js";
        const testFilePath = path.join(TEST_WATCH_DIR, testFileName);
        const testContent = "// Fichier à supprimer";

        // Créer le fichier initial
        await fs.writeFile(testFilePath, testContent, "utf8");

        watcherService = createFileWatcherService({
          watchPath: TEST_WATCH_DIR,
          verbose: false,
          enableAutoAudit: false,
          debounceDelay: 100,
        });

        // Écouter l'événement 'unlink'
        let unlinkEventReceived = false;
        watcherService.on(FileChangeEvent.UNLINK, (data) => {
          try {
            expect(data.filePath).toBe(testFilePath);
            expect(data.relativePath).toBe(testFileName);
            expect(data.eventType).toBe(FileChangeEvent.UNLINK);
            unlinkEventReceived = true;
          } catch (error) {
            reject(error);
          }
        });

        // Démarrer le watcher
        await watcherService.start();

        // Attendre un peu pour que le watcher soit prêt
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Supprimer le fichier
        await fs.unlink(testFilePath);

        // Attendre la détection
        setTimeout(async () => {
          try {
            expect(unlinkEventReceived).toBe(true);
            await watcherService.stop();
            resolve();
          } catch (error) {
            reject(error);
          }
        }, 1000);
      });
    });

    it("devrait ignorer les fichiers exclus par les patterns", async () => {
      return new Promise(async (resolve, reject) => {
        const testFileName = "test-ignored.test.js"; // Fichier .test.js devrait être ignoré
        const testFilePath = path.join(TEST_WATCH_DIR, testFileName);
        const testContent = "// Fichier ignoré";

        watcherService = createFileWatcherService({
          watchPath: TEST_WATCH_DIR,
          verbose: false,
          enableAutoAudit: false,
          debounceDelay: 100,
          excludePatterns: ["**/*.test.js"], // Exclure les fichiers .test.js
        });

        // Écouter l'événement 'add'
        let addEventReceived = false;
        watcherService.on(FileChangeEvent.ADD, () => {
          addEventReceived = true; // Ne devrait pas être appelé
        });

        // Démarrer le watcher
        await watcherService.start();

        // Attendre un peu pour que le watcher soit prêt
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Créer un fichier qui devrait être ignoré
        await fs.writeFile(testFilePath, testContent, "utf8");

        // Attendre et vérifier qu'aucun événement n'a été reçu
        setTimeout(async () => {
          try {
            expect(addEventReceived).toBe(false); // Aucun événement ne devrait être reçu
            await watcherService.stop();
            resolve();
          } catch (error) {
            reject(error);
          }
        }, 1000);
      });
    });
  });

  describe("Débouncing et traitement par lots", () => {
    it("devrait regrouper plusieurs changements avec débouncing", async () => {
      return new Promise(async (resolve, reject) => {
        const fileCount = 5;
        const files = [];

        watcherService = createFileWatcherService({
          watchPath: TEST_WATCH_DIR,
          verbose: false,
          enableAutoAudit: false,
          debounceDelay: 500, // Délai de débouncing
          maxBatchDelay: 1000,
        });

        // Compter les événements de changement
        let changeCount = 0;
        watcherService.on(FileChangeEvent.ADD, () => {
          changeCount++;
        });

        // Démarrer le watcher
        await watcherService.start();

        // Attendre un peu pour que le watcher soit prêt
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Créer plusieurs fichiers rapidement (dans la même fenêtre de débouncing)
        for (let i = 0; i < fileCount; i++) {
          const fileName = `test-batch-${i}.js`;
          const filePath = path.join(TEST_WATCH_DIR, fileName);
          files.push(filePath);
          await fs.writeFile(filePath, `// Fichier ${i}`, "utf8");
        }

        // Attendre que le débouncing se déclenche
        setTimeout(async () => {
          try {
            // Tous les fichiers devraient avoir été détectés
            expect(changeCount).toBe(fileCount);

            // Vérifier la file d'attente
            const status = watcherService.getStatus();
            expect(status.changeQueueSize).toBe(0); // La file devrait être vidée après traitement

            await watcherService.stop();
            resolve();
          } catch (error) {
            reject(error);
          }
        }, 1500); // Attendre plus longtemps que le délai de débouncing
      });
    });

    it("devrait traiter immédiatement quand la taille du lot est atteinte", async () => {
      return new Promise(async (resolve, reject) => {
        const maxBatchSize = 3;
        const fileCount = 5;

        watcherService = createFileWatcherService({
          watchPath: TEST_WATCH_DIR,
          verbose: false,
          enableAutoAudit: false,
          debounceDelay: 2000, // Délai long
          maxBatchSize: maxBatchSize,
        });

        // Compter les événements de changement
        let changeCount = 0;
        watcherService.on(FileChangeEvent.ADD, () => {
          changeCount++;
        });

        // Démarrer le watcher
        await watcherService.start();

        // Attendre un peu pour que le watcher soit prêt
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Créer plus de fichiers que la taille maximale du lot
        for (let i = 0; i < fileCount; i++) {
          const fileName = `test-maxbatch-${i}.js`;
          const filePath = path.join(TEST_WATCH_DIR, fileName);
          await fs.writeFile(filePath, `// Fichier ${i}`, "utf8");
        }

        // Attendre un peu (moins que le délai de débouncing)
        setTimeout(async () => {
          try {
            // Le traitement devrait avoir été déclenché immédiatement quand maxBatchSize a été atteint
            expect(changeCount).toBe(fileCount);

            await watcherService.stop();
            resolve();
          } catch (error) {
            reject(error);
          }
        }, 1000); // Attendre moins que le délai de débouncing
      });
    });
  });

  describe("Audit incrémental automatique", () => {
    it("devrait déclencher un audit incrémental sur changement de fichier", async () => {
      return new Promise(async (resolve, reject) => {
        const testFileName = "test-audit-trigger.js";
        const testFilePath = path.join(TEST_WATCH_DIR, testFileName);
        const testContent = "// Fichier pour tester l'audit";

        watcherService = createFileWatcherService({
          watchPath: TEST_WATCH_DIR,
          verbose: false,
          enableAutoAudit: true, // Activer l'audit automatique
          debounceDelay: 100,
        });

        // Écouter l'événement d'audit complet
        let auditCompleteReceived = false;
        watcherService.on("auditComplete", (data) => {
          try {
            expect(data.files).toContain(testFilePath);
            expect(data.result).toBeDefined();
            expect(data.result.filesAnalyzed).toContain(testFilePath);
            auditCompleteReceived = true;
          } catch (error) {
            reject(error);
          }
        });

        // Démarrer le watcher
        await watcherService.start();

        // Attendre un peu pour que le watcher soit prêt
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Créer un fichier
        await fs.writeFile(testFilePath, testContent, "utf8");

        // Attendre l'audit
        setTimeout(async () => {
          try {
            expect(auditCompleteReceived).toBe(true);
            await watcherService.stop();
            resolve();
          } catch (error) {
            reject(error);
          }
        }, 2000); // Donner plus de temps pour l'audit
      });
    });

    it("devrait gérer les erreurs d'audit", async () => {
      return new Promise(async (resolve, reject) => {
        const testFileName = "test-audit-error.js";
        const testFilePath = path.join(TEST_WATCH_DIR, testFileName);
        const testContent = "// Fichier pour tester les erreurs d'audit";

        // Mock auditFilesIncremental pour simuler une erreur
        const originalAuditFilesIncremental =
          require("../scripts/audit-incremental.js").auditFilesIncremental;
        require("../scripts/audit-incremental.js").auditFilesIncremental = vi
          .fn()
          .mockRejectedValue(new Error("Erreur d'audit simulée"));

        watcherService = createFileWatcherService({
          watchPath: TEST_WATCH_DIR,
          verbose: false,
          enableAutoAudit: true,
          debounceDelay: 100,
        });

        // Écouter l'événement d'erreur d'audit
        let auditErrorReceived = false;
        watcherService.on("auditError", (data) => {
          try {
            expect(data.error.message).toBe("Erreur d'audit simulée");
            expect(data.files).toContain(testFilePath);
            auditErrorReceived = true;
          } catch (error) {
            reject(error);
          }
        });

        // Démarrer le watcher
        await watcherService.start();

        // Attendre un peu pour que le watcher soit prêt
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Créer un fichier
        await fs.writeFile(testFilePath, testContent, "utf8");

        // Attendre l'erreur d'audit
        setTimeout(async () => {
          try {
            expect(auditErrorReceived).toBe(true);

            // Restaurer la fonction originale
            require("../scripts/audit-incremental.js").auditFilesIncremental =
              originalAuditFilesIncremental;

            await watcherService.stop();
            resolve();
          } catch (error) {
            // Restaurer la fonction originale en cas d'erreur
            require("../scripts/audit-incremental.js").auditFilesIncremental =
              originalAuditFilesIncremental;
            reject(error);
          }
        }, 2000);
      });
    });
  });

  describe("Méthodes utilitaires", () => {
    it("devrait retourner l'état du watcher", async () => {
      watcherService = createFileWatcherService({
        watchPath: TEST_WATCH_DIR,
        verbose: false,
        enableAutoAudit: false,
      });

      const status = watcherService.getStatus();

      expect(status.isWatching).toBe(false);
      expect(status.watchPath).toBe(TEST_WATCH_DIR);
      expect(status.changeQueueSize).toBe(0);
      expect(status.config).toBeDefined();
    });

    it("devrait vider la file d'attente des changements", async () => {
      watcherService = createFileWatcherService({
        watchPath: TEST_WATCH_DIR,
        verbose: false,
        enableAutoAudit: false,
      });

      // Ajouter des fichiers fictifs à la file d'attente
      watcherService.changeQueue.set("fake-file-1.js", {
        filePath: "fake-file-1.js",
        eventType: "add",
        timestamp: Date.now(),
        count: 1,
      });
      watcherService.changeQueue.set("fake-file-2.js", {
        filePath: "fake-file-2.js",
        eventType: "change",
        timestamp: Date.now(),
        count: 1,
      });

      expect(watcherService.changeQueue.size).toBe(2);

      // Vider la file d'attente
      watcherService.clearChangeQueue();

      expect(watcherService.changeQueue.size).toBe(0);
    });

    it("devrait forcer un audit immédiat", async () => {
      // Créer quelques fichiers de test
      const testFiles = [];
      for (let i = 0; i < 3; i++) {
        const fileName = `test-force-audit-${i}.js`;
        const filePath = path.join(TEST_WATCH_DIR, fileName);
        await fs.writeFile(filePath, `// Fichier ${i}`, "utf8");
        testFiles.push(filePath);
      }

      watcherService = createFileWatcherService({
        watchPath: TEST_WATCH_DIR,
        verbose: false,
        enableAutoAudit: false,
      });

      // Démarrer le watcher
      await watcherService.start();

      // Forcer un audit
      const auditResult = await watcherService.forceAudit(testFiles);

      expect(auditResult).toBeDefined();
      expect(auditResult.filesAnalyzed).toEqual(
        expect.arrayContaining(testFiles),
      );

      await watcherService.stop();
    });

    it("devrait obtenir la liste des fichiers surveillés", async () => {
      // Créer quelques fichiers de test
      const testFiles = [];
      for (let i = 0; i < 2; i++) {
        const fileName = `test-watched-${i}.js`;
        const filePath = path.join(TEST_WATCH_DIR, fileName);
        await fs.writeFile(filePath, `// Fichier ${i}`, "utf8");
        testFiles.push(filePath);
      }

      watcherService = createFileWatcherService({
        watchPath: TEST_WATCH_DIR,
        verbose: false,
        enableAutoAudit: false,
      });

      // Démarrer le watcher
      await watcherService.start();

      // Attendre que le watcher détecte les fichiers
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Obtenir les fichiers surveillés
      const watchedFiles = await watcherService.getWatchedFiles();

      // Les fichiers devraient être dans la liste (chemins complets)
      testFiles.forEach((filePath) => {
        expect(watchedFiles).toContain(filePath);
      });

      await watcherService.stop();
    });
  });
});
