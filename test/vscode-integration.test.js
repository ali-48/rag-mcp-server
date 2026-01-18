// Tests d'intégration VSCode
// Teste l'intégration du trigger d'audit avec VSCode

const { describe, it, expect, beforeEach, afterEach, vi } = require("vitest");
const fs = require("fs").promises;
const path = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");

const execAsync = promisify(exec);

// Importer le trigger VSCode
const {
  VSCodeAuditTrigger,
  checkAndRunInitialAudit,
  getVSCodeTriggerStatus,
  VSCODE_TRIGGER_CONFIG,
} = require("../scripts/vscode-audit-trigger.js");

// Dossier temporaire pour les tests
const TEST_WORKSPACE_DIR = path.join(__dirname, "temp-vscode-test");

describe("VSCode Integration Tests", () => {
  let trigger;

  beforeEach(async () => {
    // Créer le dossier de test s'il n'existe pas
    try {
      await fs.mkdir(TEST_WORKSPACE_DIR, { recursive: true });
    } catch (error) {
      // Le dossier existe peut-être déjà
    }

    // Créer un fichier .vscode/tasks.json de test
    const vscodeDir = path.join(TEST_WORKSPACE_DIR, ".vscode");
    await fs.mkdir(vscodeDir, { recursive: true });

    const testTasks = {
      version: "2.0.0",
      tasks: [
        {
          label: "test-audit",
          type: "shell",
          command: "echo",
          args: ["VSCode task executed"],
          runOptions: {
            runOn: "folderOpen",
          },
        },
      ],
    };

    await fs.writeFile(
      path.join(vscodeDir, "tasks.json"),
      JSON.stringify(testTasks, null, 2),
      "utf8",
    );

    // Créer quelques fichiers de test
    await fs.writeFile(
      path.join(TEST_WORKSPACE_DIR, "test-file.js"),
      "// Fichier de test",
      "utf8",
    );

    await fs.writeFile(
      path.join(TEST_WORKSPACE_DIR, "test-file.ts"),
      "// Fichier TypeScript de test",
      "utf8",
    );
  });

  afterEach(async () => {
    // Nettoyer le trigger
    if (trigger) {
      try {
        await trigger.stopWatcher();
      } catch (error) {
        // Ignorer les erreurs
      }
      trigger = null;
    }

    // Nettoyer le dossier de test
    try {
      const files = await fs.readdir(TEST_WORKSPACE_DIR);
      for (const file of files) {
        const filePath = path.join(TEST_WORKSPACE_DIR, file);
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) {
          const subFiles = await fs.readdir(filePath);
          for (const subFile of subFiles) {
            await fs.unlink(path.join(filePath, subFile));
          }
          await fs.rmdir(filePath);
        } else {
          await fs.unlink(filePath);
        }
      }
      await fs.rmdir(TEST_WORKSPACE_DIR);
    } catch (error) {
      // Ignorer les erreurs de nettoyage
    }
  });

  describe("VSCodeAuditTrigger Class", () => {
    it("devrait créer une instance avec configuration par défaut", () => {
      trigger = new VSCodeAuditTrigger({
        cacheDir: path.join(TEST_WORKSPACE_DIR, "audit-cache"),
      });

      expect(trigger).toBeDefined();
      expect(trigger.config.cacheDir).toBe(
        path.join(TEST_WORKSPACE_DIR, "audit-cache"),
      );
      expect(trigger.config.enableWatcherAfterAudit).toBe(true);
      expect(trigger.config.startupDelay).toBe(10000);
    });

    it("devrait initialiser correctement", async () => {
      trigger = new VSCodeAuditTrigger({
        cacheDir: path.join(TEST_WORKSPACE_DIR, "audit-cache"),
        enableWatcherAfterAudit: false,
      });

      await trigger.initialize();

      expect(trigger.isInitialAuditDone).toBe(false); // Pas de marqueur d'audit
      expect(trigger.auditInProgress).toBe(false);
    });

    it("devrait vérifier si l'audit initial a été fait", async () => {
      const cacheDir = path.join(TEST_WORKSPACE_DIR, "audit-cache");
      trigger = new VSCodeAuditTrigger({ cacheDir });

      // Créer un marqueur d'audit
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(
        path.join(cacheDir, "initial_audit_done.json"),
        JSON.stringify({
          timestamp: Date.now(),
          projectPath: TEST_WORKSPACE_DIR,
          version: "1.0.0",
        }),
        "utf8",
      );

      await trigger.initialize();
      expect(trigger.isInitialAuditDone).toBe(true);
    });

    it("devrait détecter un audit initial expiré", async () => {
      const cacheDir = path.join(TEST_WORKSPACE_DIR, "audit-cache");
      trigger = new VSCodeAuditTrigger({ cacheDir });

      // Créer un marqueur d'audit expiré (il y a 8 jours)
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(
        path.join(cacheDir, "initial_audit_done.json"),
        JSON.stringify({
          timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 jours
          projectPath: TEST_WORKSPACE_DIR,
          version: "1.0.0",
        }),
        "utf8",
      );

      await trigger.initialize();
      expect(trigger.isInitialAuditDone).toBe(false); // Audit expiré
    });
  });

  describe("checkAndRunInitialAudit Function", () => {
    it("devrait retourner alreadyDone si l'audit a déjà été fait", async () => {
      const cacheDir = path.join(TEST_WORKSPACE_DIR, "audit-cache");

      // Créer un marqueur d'audit
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(
        path.join(cacheDir, "initial_audit_done.json"),
        JSON.stringify({
          timestamp: Date.now(),
          projectPath: TEST_WORKSPACE_DIR,
          version: "1.0.0",
        }),
        "utf8",
      );

      const result = await checkAndRunInitialAudit({
        cacheDir,
        enableWatcherAfterAudit: false,
        startupDelay: 100, // Réduire le délai pour les tests
      });

      expect(result.alreadyDone).toBe(true);
      expect(result.watcherStarted).toBe(false);
    });

    it("devrait exécuter un audit initial si nécessaire", async () => {
      // Mock auditFilesIncremental pour éviter l'exécution réelle
      const originalAuditFilesIncremental =
        require("../scripts/audit-incremental.js").auditFilesIncremental;
      require("../scripts/audit-incremental.js").auditFilesIncremental = vi
        .fn()
        .mockResolvedValue({
          statistics: {
            totalFiles: 2,
            modifiedFiles: 2,
            newFiles: 2,
            unchangedFiles: 0,
          },
        });

      const result = await checkAndRunInitialAudit({
        cacheDir: path.join(TEST_WORKSPACE_DIR, "audit-cache"),
        enableWatcherAfterAudit: false,
        startupDelay: 100, // Réduire le délai pour les tests
        watcherConfig: {
          watchPath: TEST_WORKSPACE_DIR,
          enableAutoAudit: false,
        },
      });

      // Restaurer la fonction originale
      require("../scripts/audit-incremental.js").auditFilesIncremental =
        originalAuditFilesIncremental;

      expect(result.success).toBe(true);
      expect(result.filesAudited).toBeGreaterThan(0);
    });

    it("devrait gérer les erreurs lors de l'audit initial", async () => {
      // Mock auditFilesIncremental pour simuler une erreur
      const originalAuditFilesIncremental =
        require("../scripts/audit-incremental.js").auditFilesIncremental;
      require("../scripts/audit-incremental.js").auditFilesIncremental = vi
        .fn()
        .mockRejectedValue(new Error("Erreur d'audit"));

      const result = await checkAndRunInitialAudit({
        cacheDir: path.join(TEST_WORKSPACE_DIR, "audit-cache"),
        enableWatcherAfterAudit: false,
        startupDelay: 100,
      });

      // Restaurer la fonction originale
      require("../scripts/audit-incremental.js").auditFilesIncremental =
        originalAuditFilesIncremental;

      expect(result.success).toBe(false);
      expect(result.error).toBe("Erreur d'audit");
    });
  });

  describe("File Detection and Filtering", () => {
    it("devrait détecter les fichiers à inclure", async () => {
      trigger = new VSCodeAuditTrigger({
        cacheDir: path.join(TEST_WORKSPACE_DIR, "audit-cache"),
        includePatterns: ["**/*.js", "**/*.ts"],
        excludePatterns: ["**/node_modules/**"],
      });

      await trigger.initialize();
      const files = await trigger.getFilesForInitialAudit();

      // Les fichiers devraient être détectés
      expect(files).toContain(path.join(TEST_WORKSPACE_DIR, "test-file.js"));
      expect(files).toContain(path.join(TEST_WORKSPACE_DIR, "test-file.ts"));
    });

    it("devrait exclure les fichiers selon les patterns", async () => {
      // Créer un fichier qui devrait être exclu
      await fs.mkdir(
        path.join(TEST_WORKSPACE_DIR, "node_modules", "test-pkg"),
        { recursive: true },
      );
      await fs.writeFile(
        path.join(TEST_WORKSPACE_DIR, "node_modules", "test-pkg", "index.js"),
        "// Fichier dans node_modules",
        "utf8",
      );

      trigger = new VSCodeAuditTrigger({
        cacheDir: path.join(TEST_WORKSPACE_DIR, "audit-cache"),
        includePatterns: ["**/*.js"],
        excludePatterns: ["**/node_modules/**"],
      });

      await trigger.initialize();
      const files = await trigger.getFilesForInitialAudit();

      // Le fichier dans node_modules ne devrait pas être inclus
      const nodeModulesFile = path.join(
        TEST_WORKSPACE_DIR,
        "node_modules",
        "test-pkg",
        "index.js",
      );
      expect(files).not.toContain(nodeModulesFile);
    });
  });

  describe("Watcher Integration", () => {
    it("devrait démarrer le watcher après l'audit initial", async () => {
      // Mock auditFilesIncremental
      const originalAuditFilesIncremental =
        require("../scripts/audit-incremental.js").auditFilesIncremental;
      require("../scripts/audit-incremental.js").auditFilesIncremental = vi
        .fn()
        .mockResolvedValue({
          statistics: {
            totalFiles: 2,
            modifiedFiles: 2,
            newFiles: 2,
            unchangedFiles: 0,
          },
        });

      trigger = new VSCodeAuditTrigger({
        cacheDir: path.join(TEST_WORKSPACE_DIR, "audit-cache"),
        enableWatcherAfterAudit: true,
        startupDelay: 100,
        watcherConfig: {
          watchPath: TEST_WORKSPACE_DIR,
          enableAutoAudit: false,
          verbose: false,
        },
      });

      await trigger.initialize();
      const result = await trigger.checkAndRunInitialAudit();

      // Restaurer la fonction originale
      require("../scripts/audit-incremental.js").auditFilesIncremental =
        originalAuditFilesIncremental;

      expect(result.success).toBe(true);
      expect(result.watcherStarted).toBe(true);
      expect(trigger.watcherService).toBeDefined();
    });

    it("devrait obtenir le statut du trigger", async () => {
      trigger = new VSCodeAuditTrigger({
        cacheDir: path.join(TEST_WORKSPACE_DIR, "audit-cache"),
        enableWatcherAfterAudit: false,
      });

      await trigger.initialize();
      const status = trigger.getStatus();

      expect(status.isInitialAuditDone).toBe(false);
      expect(status.auditInProgress).toBe(false);
      expect(status.watcherRunning).toBe(false);
      expect(status.config.cacheDir).toBe(
        path.join(TEST_WORKSPACE_DIR, "audit-cache"),
      );
    });
  });

  describe("VSCode Tasks Integration", () => {
    it("devrait vérifier que le fichier tasks.json existe", async () => {
      const tasksPath = path.join(TEST_WORKSPACE_DIR, ".vscode", "tasks.json");
      const exists = await fs
        .access(tasksPath)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);

      const tasksContent = JSON.parse(await fs.readFile(tasksPath, "utf8"));
      expect(tasksContent.version).toBe("2.0.0");
      expect(tasksContent.tasks).toBeDefined();
      expect(tasksContent.tasks[0].label).toBe("test-audit");
    });

    it("devrait vérifier la configuration runOn: folderOpen", async () => {
      const tasksPath = path.join(TEST_WORKSPACE_DIR, ".vscode", "tasks.json");
      const tasksContent = JSON.parse(await fs.readFile(tasksPath, "utf8"));

      expect(tasksContent.tasks[0].runOptions.runOn).toBe("folderOpen");
    });
  });

  describe("Force Initial Audit", () => {
    it("devrait forcer un nouvel audit même avec un marqueur existant", async () => {
      const cacheDir = path.join(TEST_WORKSPACE_DIR, "audit-cache");

      // Créer un marqueur d'audit
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(
        path.join(cacheDir, "initial_audit_done.json"),
        JSON.stringify({
          timestamp: Date.now(),
          projectPath: TEST_WORKSPACE_DIR,
          version: "1.0.0",
        }),
        "utf8",
      );

      trigger = new VSCodeAuditTrigger({ cacheDir });
      await trigger.initialize();

      // Vérifier que l'audit est marqué comme fait
      expect(trigger.isInitialAuditDone).toBe(true);

      // Forcer un nouvel audit
      await trigger.forceInitialAudit();

      // L'audit devrait être marqué comme non fait
      expect(trigger.isInitialAuditDone).toBe(false);
    });
  });
});
