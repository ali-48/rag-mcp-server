// Trigger d'audit au démarrage de VSCode
// Vérifie si un audit initial est nécessaire et l'exécute si besoin

import { exec } from "child_process";
import { promises as fs } from "fs";
import { createRequire } from "module";
import path from "path";
import { promisify } from "util";

const require = createRequire(import.meta.url);
// Note: audit-incremental.ts est un fichier TypeScript, on utilise createRequire pour l'importer
const { auditFilesIncremental } = require("./audit-incremental.js");
// file-watcher-service.js est maintenant un ES module, on l'importe directement
import { createFileWatcherService } from "./file-watcher-service.js";

const execAsync = promisify(exec);

/**
 * Configuration du trigger VSCode
 */
const VSCODE_TRIGGER_CONFIG = {
  // Dossier de cache pour les métadonnées VSCode
  cacheDir: path.join(process.cwd(), "audit", "vscode-cache"),

  // Fichier de marqueur d'audit initial
  initialAuditMarker: "initial_audit_done.json",

  // Délai avant exécution de l'audit (ms)
  startupDelay: 10000, // 10 secondes

  // Activer le watcher après l'audit initial
  enableWatcherAfterAudit: true,

  // Configuration du watcher
  watcherConfig: {
    watchPath: process.cwd(),
    verbose: true,
    enableAutoAudit: true,
    debounceDelay: 3000,
  },

  // Patterns de fichiers à inclure dans l'audit initial
  includePatterns: [
    "**/*.ts",
    "**/*.js",
    "**/*.tsx",
    "**/*.jsx",
    "**/*.json",
    "**/*.md",
  ],

  // Patterns de fichiers à exclure
  excludePatterns: [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/*.test.ts",
    "**/*.test.js",
    "**/*.spec.ts",
    "**/*.spec.js",
    "**/audit/**",
    "**/logs/**",
  ],
};

/**
 * Classe pour gérer le trigger d'audit VSCode
 */
class VSCodeAuditTrigger {
  constructor(config = {}) {
    this.config = { ...VSCODE_TRIGGER_CONFIG, ...config };
    this.watcherService = null;
    this.isInitialAuditDone = false;
    this.auditInProgress = false;
  }

  /**
   * Initialiser le trigger
   */
  async initialize() {
    console.log("[VSCodeAuditTrigger] Initialisation...");

    // Créer le dossier de cache si nécessaire
    await this.ensureCacheDir();

    // Vérifier si l'audit initial a déjà été fait
    this.isInitialAuditDone = await this.checkInitialAuditDone();

    if (this.isInitialAuditDone) {
      console.log("[VSCodeAuditTrigger] Audit initial déjà effectué");
    } else {
      console.log("[VSCodeAuditTrigger] Audit initial nécessaire");
    }

    return this;
  }

  /**
   * Vérifier et exécuter l'audit initial si nécessaire
   */
  async checkAndRunInitialAudit() {
    if (this.auditInProgress) {
      console.log("[VSCodeAuditTrigger] Audit déjà en cours");
      return { alreadyRunning: true };
    }

    if (this.isInitialAuditDone) {
      console.log(
        "[VSCodeAuditTrigger] Audit initial déjà effectué, démarrage du watcher...",
      );

      // Démarrer le watcher si configuré
      if (this.config.enableWatcherAfterAudit) {
        await this.startWatcher();
      }

      return {
        alreadyDone: true,
        watcherStarted: this.config.enableWatcherAfterAudit,
      };
    }

    console.log("[VSCodeAuditTrigger] Démarrage de l'audit initial...");
    this.auditInProgress = true;

    try {
      // Attendre un délai au démarrage pour éviter de surcharger le système
      console.log(
        `[VSCodeAuditTrigger] Attente de ${this.config.startupDelay}ms avant l'audit...`,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, this.config.startupDelay),
      );

      // Obtenir la liste des fichiers à auditer
      const filesToAudit = await this.getFilesForInitialAudit();
      console.log(
        `[VSCodeAuditTrigger] ${filesToAudit.length} fichiers à auditer`,
      );

      if (filesToAudit.length === 0) {
        console.log("[VSCodeAuditTrigger] Aucun fichier à auditer");
        this.markInitialAuditDone();
        this.auditInProgress = false;
        return { noFiles: true };
      }

      // Exécuter l'audit incrémental
      console.log("[VSCodeAuditTrigger] Exécution de l'audit incrémental...");
      const auditResult = await auditFilesIncremental(filesToAudit, {
        useAstCache: true,
        generateRecommendations: true,
        exportJson: true,
        outputPath: path.join(
          this.config.cacheDir,
          "initial_audit_result.json",
        ),
      });

      console.log(
        `[VSCodeAuditTrigger] Audit terminé: ${auditResult.statistics.totalFiles} fichiers analysés`,
      );

      // Marquer l'audit initial comme terminé
      await this.markInitialAuditDone();
      this.isInitialAuditDone = true;

      // Démarrer le watcher si configuré
      let watcherStarted = false;
      if (this.config.enableWatcherAfterAudit) {
        await this.startWatcher();
        watcherStarted = true;
      }

      this.auditInProgress = false;

      return {
        success: true,
        filesAudited: filesToAudit.length,
        auditResult: auditResult.statistics,
        watcherStarted,
      };
    } catch (error) {
      console.error(
        "[VSCodeAuditTrigger] Erreur lors de l'audit initial:",
        error,
      );
      this.auditInProgress = false;

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Obtenir la liste des fichiers pour l'audit initial
   */
  async getFilesForInitialAudit() {
    const files = [];
    const rootDir = process.cwd();

    // Utiliser find pour obtenir les fichiers (plus rapide que Node.js pour les gros projets)
    try {
      const { stdout } = await execAsync(
        `find "${rootDir}" -type f ` +
        this.config.includePatterns
          .map((pattern) => `-name "${pattern.replace("**/*", "*")}"`)
          .join(" -o ") +
        this.config.excludePatterns
          .map((pattern) => ` -not -path "${pattern}"`)
          .join(""),
      );

      files.push(
        ...stdout
          .trim()
          .split("\n")
          .filter((f) => f),
      );
    } catch (error) {
      // Fallback: utiliser une méthode Node.js plus lente
      console.log(
        "[VSCodeAuditTrigger] Fallback à la méthode Node.js pour la recherche de fichiers",
      );
      files.push(...(await this.findFilesRecursive(rootDir)));
    }

    return files;
  }

  /**
   * Recherche récursive de fichiers (fallback)
   */
  async findFilesRecursive(dir, allFiles = []) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Vérifier les exclusions
      if (this.shouldExcludeFile(fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.findFilesRecursive(fullPath, allFiles);
      } else if (this.shouldIncludeFile(fullPath)) {
        allFiles.push(fullPath);
      }
    }

    return allFiles;
  }

  /**
   * Vérifier si un fichier doit être inclus
   */
  shouldIncludeFile(filePath) {
    const relativePath = path.relative(process.cwd(), filePath);

    // Vérifier les patterns d'inclusion
    for (const pattern of this.config.includePatterns) {
      const minimatch = require("minimatch");
      if (minimatch(relativePath, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Vérifier si un fichier doit être exclu
   */
  shouldExcludeFile(filePath) {
    const relativePath = path.relative(process.cwd(), filePath);

    // Vérifier les patterns d'exclusion
    for (const pattern of this.config.excludePatterns) {
      const minimatch = require("minimatch");
      if (minimatch(relativePath, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Vérifier si l'audit initial a déjà été fait
   */
  async checkInitialAuditDone() {
    try {
      const markerPath = path.join(
        this.config.cacheDir,
        this.config.initialAuditMarker,
      );
      await fs.access(markerPath);

      // Lire et vérifier le contenu du marqueur
      const markerContent = JSON.parse(await fs.readFile(markerPath, "utf8"));

      // Vérifier la date (si l'audit a plus de 7 jours, on le refait)
      if (markerContent.timestamp) {
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (markerContent.timestamp < sevenDaysAgo) {
          console.log(
            "[VSCodeAuditTrigger] Audit initial expiré (plus de 7 jours)",
          );
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Marquer l'audit initial comme terminé
   */
  async markInitialAuditDone() {
    const markerPath = path.join(
      this.config.cacheDir,
      this.config.initialAuditMarker,
    );
    const markerContent = {
      timestamp: Date.now(),
      projectPath: process.cwd(),
      version: "1.0.0",
    };

    await fs.writeFile(
      markerPath,
      JSON.stringify(markerContent, null, 2),
      "utf8",
    );
    console.log("[VSCodeAuditTrigger] Audit initial marqué comme terminé");
  }

  /**
   * Démarrer le watcher de fichiers
   */
  async startWatcher() {
    if (this.watcherService) {
      console.log("[VSCodeAuditTrigger] Watcher déjà démarré");
      return true;
    }

    try {
      console.log("[VSCodeAuditTrigger] Démarrage du watcher...");
      this.watcherService = createFileWatcherService(this.config.watcherConfig);

      // Écouter les événements du watcher
      this.setupWatcherListeners();

      await this.watcherService.start();
      console.log("[VSCodeAuditTrigger] Watcher démarré avec succès");

      return true;
    } catch (error) {
      console.error(
        "[VSCodeAuditTrigger] Erreur lors du démarrage du watcher:",
        error,
      );
      this.watcherService = null;
      return false;
    }
  }

  /**
   * Configurer les écouteurs du watcher
   */
  setupWatcherListeners() {
    if (!this.watcherService) return;

    this.watcherService.on("auditComplete", (data) => {
      console.log(
        `[VSCodeAuditTrigger] Audit incrémental terminé: ${data.result.statistics.modifiedFiles} fichiers modifiés`,
      );
    });

    this.watcherService.on("auditError", (data) => {
      console.error(
        `[VSCodeAuditTrigger] Erreur d'audit: ${data.error.message}`,
      );
    });
  }

  /**
   * Arrêter le watcher
   */
  async stopWatcher() {
    if (!this.watcherService) {
      return true;
    }

    try {
      await this.watcherService.stop();
      this.watcherService = null;
      console.log("[VSCodeAuditTrigger] Watcher arrêté");
      return true;
    } catch (error) {
      console.error(
        "[VSCodeAuditTrigger] Erreur lors de l'arrêt du watcher:",
        error,
      );
      return false;
    }
  }

  /**
   * S'assurer que le dossier de cache existe
   */
  async ensureCacheDir() {
    try {
      await fs.mkdir(this.config.cacheDir, { recursive: true });
    } catch (error) {
      // Le dossier existe peut-être déjà
    }
  }

  /**
   * Obtenir l'état du trigger
   */
  getStatus() {
    return {
      isInitialAuditDone: this.isInitialAuditDone,
      auditInProgress: this.auditInProgress,
      watcherRunning: !!this.watcherService,
      config: {
        cacheDir: this.config.cacheDir,
        enableWatcherAfterAudit: this.config.enableWatcherAfterAudit,
        startupDelay: this.config.startupDelay,
      },
    };
  }

  /**
   * Forcer un nouvel audit initial (ignorer le marqueur)
   */
  async forceInitialAudit() {
    // Supprimer le marqueur d'audit initial
    try {
      const markerPath = path.join(
        this.config.cacheDir,
        this.config.initialAuditMarker,
      );
      await fs.unlink(markerPath);
    } catch (error) {
      // Le fichier n'existe peut-être pas
    }

    this.isInitialAuditDone = false;

    // Exécuter l'audit initial
    return this.checkAndRunInitialAudit();
  }
}

/**
 * Fonction principale pour vérifier et exécuter l'audit initial
 * @param {Object} config - Configuration optionnelle
 * @returns {Promise<Object>} - Résultat de l'audit
 */
async function checkAndRunInitialAudit(config = {}) {
  const trigger = new VSCodeAuditTrigger(config);
  await trigger.initialize();
  return trigger.checkAndRunInitialAudit();
}

/**
 * Fonction pour démarrer uniquement le watcher (sans audit initial)
 * @param {Object} config - Configuration optionnelle
 * @returns {Promise<boolean>} - Succès du démarrage
 */
async function startVSCodeWatcher(config = {}) {
  const trigger = new VSCodeAuditTrigger(config);
  await trigger.initialize();
  return trigger.startWatcher();
}

/**
 * Fonction pour arrêter le watcher
 * @returns {Promise<boolean>} - Succès de l'arrêt
 */
async function stopVSCodeWatcher() {
  // Cette fonction nécessite une instance existante, donc limitée
  console.warn(
    "[VSCodeAuditTrigger] stopVSCodeWatcher() nécessite une instance existante",
  );
  return false;
}

/**
 * Fonction pour obtenir l'état du trigger
 * @param {Object} config - Configuration optionnelle
 * @returns {Promise<Object>} - État du trigger
 */
async function getVSCodeTriggerStatus(config = {}) {
  const trigger = new VSCodeAuditTrigger(config);
  await trigger.initialize();
  return trigger.getStatus();
}

// Exports
export {
  checkAndRunInitialAudit,
  getVSCodeTriggerStatus,
  startVSCodeWatcher,
  stopVSCodeWatcher,
  VSCODE_TRIGGER_CONFIG,
  VSCodeAuditTrigger
};

// Exécution automatique si le script est appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    console.log("[VSCodeAuditTrigger] Démarrage automatique...");

    try {
      const result = await checkAndRunInitialAudit();
      console.log("[VSCodeAuditTrigger] Résultat:", result);

      if (result.success || result.alreadyDone) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    } catch (error) {
      console.error("[VSCodeAuditTrigger] Erreur:", error);
      process.exit(1);
    }
  })();
}
