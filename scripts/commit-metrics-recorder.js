// Enregistreur de métriques pour les commits
// Enregistre les métriques d'audit dans la base SQLite pour chaque commit

import { exec } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Configuration de l'enregistreur de métriques
 */
const COMMIT_METRICS_CONFIG = {
  // Chemin vers la base de données SQLite
  dbPath: path.join(process.cwd(), "audit", "code_map.db"),

  // Dossier des logs
  logsDir: path.join(process.cwd(), "audit", "logs", "commit-metrics"),

  // Fichier JSON d'audit
  auditJsonPath: path.join(process.cwd(), "audit", "code_map.json"),

  // Activer le logging détaillé
  verbose: true,

  // Types de métriques à enregistrer
  metricTypes: [
    "quality_score",
    "complexity_score",
    "maintainability_score",
    "documentation_score",
    "duplication_score",
    "test_coverage_score",
    "security_score",
    "performance_score",
  ],

  // Seuils pour les alertes
  alertThresholds: {
    quality: 0.4,
    complexity: 0.7,
    maintainability: 0.5,
    documentation: 0.3,
    duplication: 0.8,
    test_coverage: 0.2,
    security: 0.6,
    performance: 0.5,
  },
};

/**
 * Classe pour enregistrer les métriques de commit
 */
class CommitMetricsRecorder {
  constructor(config = {}) {
    this.config = { ...COMMIT_METRICS_CONFIG, ...config };
    this.db = null;
    this.commitHash = null;
    this.metrics = {};
    this.alerts = [];
  }

  /**
   * Initialiser l'enregistreur
   */
  async initialize() {
    if (this.config.verbose) {
      console.log("[CommitMetricsRecorder] Initialisation...");
    }

    // Créer le dossier de logs si nécessaire
    await this.ensureLogsDir();

    // Ouvrir la base de données
    await this.openDatabase();

    // Vérifier que la table commit_metrics existe
    await this.ensureTableExists();

    return this;
  }

  /**
   * Enregistrer les métriques pour un commit
   * @param {string} commitHash - Hash du commit
   * @param {Object} options - Options supplémentaires
   * @returns {Promise<Object>} - Résultat de l'enregistrement
   */
  async recordCommitMetrics(commitHash, options = {}) {
    this.commitHash = commitHash;

    if (this.config.verbose) {
      console.log(
        `[CommitMetricsRecorder] Enregistrement des métriques pour le commit: ${commitHash}`,
      );
    }

    try {
      // 1. Obtenir les informations du commit
      const commitInfo = await this.getCommitInfo(commitHash);

      // 2. Lire les métriques d'audit depuis le fichier JSON
      const auditMetrics = await this.readAuditMetrics();

      // 3. Calculer les métriques agrégées
      const aggregatedMetrics = this.aggregateMetrics(auditMetrics);

      // 4. Générer les alertes si nécessaire
      this.generateAlerts(aggregatedMetrics);

      // 5. Enregistrer dans la base de données
      const dbResult = await this.saveToDatabase(commitInfo, aggregatedMetrics);

      // 6. Générer un rapport
      const report = this.generateReport(
        commitInfo,
        aggregatedMetrics,
        dbResult,
      );

      // 7. Sauvegarder le rapport dans les logs
      await this.saveReportToLogs(report);

      if (this.config.verbose) {
        console.log(
          `[CommitMetricsRecorder] Métriques enregistrées avec succès pour le commit: ${commitHash}`,
        );
      }

      return {
        success: true,
        commitHash,
        metricsRecorded: Object.keys(aggregatedMetrics).length,
        alerts: this.alerts.length,
        reportPath: report.reportPath,
        databaseId: dbResult.lastID,
      };
    } catch (error) {
      console.error(
        `[CommitMetricsRecorder] Erreur lors de l'enregistrement des métriques:`,
        error,
      );

      return {
        success: false,
        commitHash,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Obtenir les informations d'un commit
   */
  async getCommitInfo(commitHash) {
    try {
      const { stdout } = await execAsync(
        `git show --no-patch --format="%H|%an|%ae|%ad|%s" ${commitHash}`,
      );
      const [hash, author, email, date, message] = stdout.trim().split("|");

      return {
        hash,
        author,
        email,
        date: new Date(date).toISOString(),
        message,
        branch: await this.getCurrentBranch(),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // Si le commit n'existe pas encore (pre-commit), utiliser des informations par défaut
      return {
        hash: commitHash,
        author: "Unknown",
        email: "unknown@example.com",
        date: new Date().toISOString(),
        message: "Pre-commit audit",
        branch: await this.getCurrentBranch(),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Obtenir la branche courante
   */
  async getCurrentBranch() {
    try {
      const { stdout } = await execAsync("git branch --show-current");
      return stdout.trim();
    } catch (error) {
      return "unknown";
    }
  }

  /**
   * Lire les métriques d'audit depuis le fichier JSON
   */
  async readAuditMetrics() {
    try {
      const content = await fs.readFile(this.config.auditJsonPath, "utf8");
      const auditData = JSON.parse(content);

      if (!auditData.files || !Array.isArray(auditData.files)) {
        throw new Error(
          "Format de fichier d'audit invalide: propriété 'files' manquante",
        );
      }

      return auditData;
    } catch (error) {
      console.warn(
        `[CommitMetricsRecorder] Impossible de lire le fichier d'audit: ${error.message}`,
      );

      // Retourner des données vides
      return {
        files: [],
        summary: {
          totalFiles: 0,
          averageQuality: 0,
          averageComplexity: 0,
          averageMaintainability: 0,
        },
      };
    }
  }

  /**
   * Agréger les métriques des fichiers
   */
  aggregateMetrics(auditData) {
    const files = auditData.files || [];
    const summary = auditData.summary || {};

    if (files.length === 0) {
      // Utiliser les métriques du summary si disponibles
      return {
        quality_score: summary.averageQuality || 0,
        complexity_score: summary.averageComplexity || 0,
        maintainability_score: summary.averageMaintainability || 0,
        documentation_score: summary.averageDocumentation || 0.5,
        duplication_score: summary.duplicationRate || 0.1,
        test_coverage_score: summary.testCoverage || 0,
        security_score: summary.securityScore || 0.5,
        performance_score: summary.performanceScore || 0.5,
        total_files: summary.totalFiles || 0,
        analyzed_files: files.length,
      };
    }

    // Calculer les moyennes
    const metrics = {
      quality_score: 0,
      complexity_score: 0,
      maintainability_score: 0,
      documentation_score: 0,
      duplication_score: 0,
      test_coverage_score: 0,
      security_score: 0,
      performance_score: 0,
    };

    let counts = {
      quality: 0,
      complexity: 0,
      maintainability: 0,
      documentation: 0,
      duplication: 0,
      test_coverage: 0,
      security: 0,
      performance: 0,
    };

    // Parcourir tous les fichiers
    for (const file of files) {
      const score = file.score || {};

      if (typeof score.quality === "number") {
        metrics.quality_score += score.quality;
        counts.quality++;
      }

      if (typeof score.complexity === "number") {
        metrics.complexity_score += score.complexity;
        counts.complexity++;
      }

      if (typeof score.maintainability === "number") {
        metrics.maintainability_score += score.maintainability;
        counts.maintainability++;
      }

      if (typeof score.documentation === "number") {
        metrics.documentation_score += score.documentation;
        counts.documentation++;
      }

      if (typeof score.duplication === "number") {
        metrics.duplication_score += score.duplication;
        counts.duplication++;
      }

      if (typeof score.testCoverage === "number") {
        metrics.test_coverage_score += score.testCoverage;
        counts.testCoverage++;
      }

      if (typeof score.security === "number") {
        metrics.security_score += score.security;
        counts.security++;
      }

      if (typeof score.performance === "number") {
        metrics.performance_score += score.performance;
        counts.performance++;
      }
    }

    // Calculer les moyennes
    for (const [key, value] of Object.entries(metrics)) {
      const countKey = key.replace("_score", "");
      const count = counts[countKey] || 1;
      metrics[key] = count > 0 ? value / count : 0;
    }

    // Ajouter les métriques supplémentaires
    metrics.total_files = summary.totalFiles || files.length;
    metrics.analyzed_files = files.length;
    metrics.low_quality_files = files.filter(
      (f) => (f.score?.quality || 0) < 0.4,
    ).length;
    metrics.high_complexity_files = files.filter(
      (f) => (f.score?.complexity || 0) > 0.7,
    ).length;

    return metrics;
  }

  /**
   * Générer des alertes basées sur les seuils
   */
  generateAlerts(metrics) {
    this.alerts = [];

    for (const [metric, value] of Object.entries(metrics)) {
      if (metric.endsWith("_score")) {
        const metricName = metric.replace("_score", "");
        const threshold = this.config.alertThresholds[metricName];

        if (threshold !== undefined) {
          // Pour la qualité, documentation, test_coverage, security, performance: alerte si trop bas
          // Pour la complexité et duplication: alerte si trop haut
          if (
            [
              "quality",
              "documentation",
              "test_coverage",
              "security",
              "performance",
            ].includes(metricName)
          ) {
            if (value < threshold) {
              this.alerts.push({
                metric: metricName,
                value,
                threshold,
                severity: value < threshold * 0.5 ? "high" : "medium",
                message: `${metricName} trop bas: ${value.toFixed(2)} < ${threshold}`,
              });
            }
          } else if (["complexity", "duplication"].includes(metricName)) {
            if (value > threshold) {
              this.alerts.push({
                metric: metricName,
                value,
                threshold,
                severity: value > threshold * 1.5 ? "high" : "medium",
                message: `${metricName} trop haut: ${value.toFixed(2)} > ${threshold}`,
              });
            }
          } else if (metricName === "maintainability") {
            if (value < threshold) {
              this.alerts.push({
                metric: metricName,
                value,
                threshold,
                severity: value < threshold * 0.5 ? "high" : "medium",
                message: `${metricName} trop bas: ${value.toFixed(2)} < ${threshold}`,
              });
            }
          }
        }
      }
    }

    // Alerte spéciale pour les fichiers de faible qualité
    if (metrics.low_quality_files > 0) {
      this.alerts.push({
        metric: "low_quality_files",
        value: metrics.low_quality_files,
        threshold: 0,
        severity: metrics.low_quality_files > 5 ? "high" : "medium",
        message: `${metrics.low_quality_files} fichiers avec qualité < 0.4`,
      });
    }

    // Alerte spéciale pour les fichiers de haute complexité
    if (metrics.high_complexity_files > 0) {
      this.alerts.push({
        metric: "high_complexity_files",
        value: metrics.high_complexity_files,
        threshold: 0,
        severity: metrics.high_complexity_files > 3 ? "high" : "medium",
        message: `${metrics.high_complexity_files} fichiers avec complexité > 0.7`,
      });
    }
  }

  /**
   * Enregistrer dans la base de données
   */
  async saveToDatabase(commitInfo, metrics) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO commit_metrics (
          commit_hash, author, author_email, commit_date, commit_message,
          branch, quality_score, complexity_score, maintainability_score,
          documentation_score, duplication_score, test_coverage_score,
          security_score, performance_score, total_files, analyzed_files,
          low_quality_files, high_complexity_files, alerts_count,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        commitInfo.hash,
        commitInfo.author,
        commitInfo.email,
        commitInfo.date,
        commitInfo.message,
        commitInfo.branch,
        metrics.quality_score,
        metrics.complexity_score,
        metrics.maintainability_score,
        metrics.documentation_score,
        metrics.duplication_score,
        metrics.test_coverage_score,
        metrics.security_score,
        metrics.performance_score,
        metrics.total_files,
        metrics.analyzed_files,
        metrics.low_quality_files || 0,
        metrics.high_complexity_files || 0,
        this.alerts.length,
        new Date().toISOString(),
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({ lastID: this.lastID, changes: this.changes });
          }
        },
      );

      stmt.finalize();
    });
  }

  /**
   * Générer un rapport
   */
  generateReport(commitInfo, metrics, dbResult) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const reportPath = path.join(
      this.config.logsDir,
      `commit_${commitInfo.hash}_${timestamp}.json`,
    );

    const report = {
      metadata: {
        generated_at: new Date().toISOString(),
        commit_hash: commitInfo.hash,
        database_id: dbResult.lastID,
        recorder_version: "1.0.0",
      },
      commit_info: commitInfo,
      metrics: metrics,
      alerts: this.alerts,
      summary: {
        total_metrics: Object.keys(metrics).length,
        alerts_count: this.alerts.length,
        alerts_by_severity: this.alerts.reduce((acc, alert) => {
          acc[alert.severity] = (acc[alert.severity] || 0) + 1;
          return acc;
        }, {}),
        quality_status:
          metrics.quality_score >= this.config.alertThresholds.quality
            ? "good"
            : "needs_improvement",
        overall_status:
          this.alerts.length === 0
            ? "good"
            : this.alerts.filter((a) => a.severity === "high").length > 0
              ? "needs_attention"
              : "acceptable",
      },
    };

    return {
      report,
      reportPath,
    };
  }

  /**
   * Sauvegarder le rapport dans les logs
   */
  async saveReportToLogs(reportData) {
    const { report, reportPath } = reportData;

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

    if (this.config.verbose) {
      console.log(`[CommitMetricsRecorder] Rapport sauvegardé: ${reportPath}`);
    }

    return reportPath;
  }

  /**
   * Ouvrir la base de données
   */
  openDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(
        this.config.dbPath,
        sqlite3.OPEN_READWRITE,
        (err) => {
          if (err) {
            reject(
              new Error(
                `Impossible d'ouvrir la base de données: ${err.message}`,
              ),
            );
          } else {
            if (this.config.verbose) {
              console.log(
                `[CommitMetricsRecorder] Base de données ouverte: ${this.config.dbPath}`,
              );
            }
            resolve();
          }
        },
      );
    });
  }

  /**
   * S'assurer que la table existe
   */
  async ensureTableExists() {
    return new Promise((resolve, reject) => {
      this.db.run(
        `
        CREATE TABLE IF NOT EXISTS commit_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          commit_hash TEXT NOT NULL,
          author TEXT NOT NULL,
          author_email TEXT,
          commit_date TEXT NOT NULL,
          commit_message TEXT,
          branch TEXT,
          quality_score REAL DEFAULT 0,
          complexity_score REAL DEFAULT 0,
          maintainability_score REAL DEFAULT 0,
          documentation_score REAL DEFAULT 0,
          duplication_score REAL DEFAULT 0,
          test_coverage_score REAL DEFAULT 0,
          security_score REAL DEFAULT 0,
          performance_score REAL DEFAULT 0,
          total_files INTEGER DEFAULT 0,
          analyzed_files INTEGER DEFAULT 0,
          low_quality_files INTEGER DEFAULT 0,
          high_complexity_files INTEGER DEFAULT 0,
          alerts_count INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT
        )
      `,
        (err) => {
          if (err) {
            reject(err);
          } else {
            if (this.config.verbose) {
              console.log(
                "[CommitMetricsRecorder] Table commit_metrics vérifiée/créée",
              );
            }
            resolve();
          }
        },
      );
    });
  }

  /**
   * Créer le dossier de logs si nécessaire
   */
  async ensureLogsDir() {
    try {
      await fs.mkdir(this.config.logsDir, { recursive: true });
      if (this.config.verbose) {
        console.log(
          `[CommitMetricsRecorder] Dossier de logs créé: ${this.config.logsDir}`,
        );
      }
    } catch (error) {
      console.warn(
        `[CommitMetricsRecorder] Impossible de créer le dossier de logs: ${error.message}`,
      );
    }
  }

  /**
   * Fermer la base de données
   */
  async close() {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            if (this.config.verbose) {
              console.log("[CommitMetricsRecorder] Base de données fermée");
            }
            this.db = null;
            resolve();
          }
        });
      });
    }
  }

  /**
   * Obtenir les métriques d'un commit spécifique
   */
  async getCommitMetrics(commitHash) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM commit_metrics WHERE commit_hash = ?`,
        [commitHash],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row || null);
          }
        },
      );
    });
  }

  /**
   * Obtenir les métriques récentes (limite optionnelle)
   */
  async getRecentMetrics(limit = 10) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM commit_metrics ORDER BY created_at DESC LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        },
      );
    });
  }

  /**
   * Obtenir les statistiques globales
   */
  async getGlobalStats() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT
          COUNT(*) as total_commits,
          AVG(quality_score) as avg_quality,
          AVG(complexity_score) as avg_complexity,
          AVG(maintainability_score) as avg_maintainability,
          AVG(documentation_score) as avg_documentation,
          SUM(alerts_count) as total_alerts,
          MIN(created_at) as first_commit,
          MAX(created_at) as last_commit
        FROM commit_metrics`,
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows[0] || {});
          }
        },
      );
    });
  }

  /**
   * Fonction d'export pour une utilisation simple
   */
  static async recordCommitMetrics(commitHash, config = {}) {
    const recorder = new CommitMetricsRecorder(config);
    try {
      await recorder.initialize();
      const result = await recorder.recordCommitMetrics(commitHash);
      await recorder.close();
      return result;
    } catch (error) {
      try {
        await recorder.close();
      } catch (closeError) {
        // Ignorer les erreurs de fermeture
      }
      throw error;
    }
  }
}

/**
 * Fonction principale pour l'export
 */
export { COMMIT_METRICS_CONFIG, CommitMetricsRecorder };

export const recordCommitMetrics = CommitMetricsRecorder.recordCommitMetrics;
