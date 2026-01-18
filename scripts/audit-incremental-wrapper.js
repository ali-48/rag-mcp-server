// Wrapper pour audit-incremental.ts
// Permet aux fichiers JavaScript d'importer les fonctions d'audit incrémental

import { exec } from "child_process";
import { promises as fs } from "fs";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

/**
 * Exécute audit-incremental.ts avec tsx
 * @param {string[]} files - Liste des fichiers à auditer
 * @param {Object} config - Configuration optionnelle
 * @returns {Promise<Object>} - Résultat de l'audit
 */
export async function auditFilesIncremental(files, config = {}) {
  if (!files || files.length === 0) {
    return {
      statistics: {
        totalFiles: 0,
        modifiedFiles: 0,
        addedFiles: 0,
        deletedFiles: 0,
        unchangedFiles: 0,
      },
      fileChanges: [],
      recommendations: [],
    };
  }

  // Écrire la liste des fichiers dans un fichier temporaire
  const tempDir = path.join(process.cwd(), "audit", "temp");
  await fs.mkdir(tempDir, { recursive: true });

  const tempFile = path.join(tempDir, `files_${Date.now()}.txt`);
  await fs.writeFile(tempFile, files.join("\n"));

  try {
    // Construire la commande
    const configArgs = [];
    if (config.useAstCache !== undefined) {
      configArgs.push(`--use-ast-cache=${config.useAstCache}`);
    }
    if (config.generateRecommendations !== undefined) {
      configArgs.push(`--generate-recommendations=${config.generateRecommendations}`);
    }
    if (config.exportJson !== undefined && config.outputPath) {
      configArgs.push(`--export-json=${config.outputPath}`);
    }

    const command = `npx tsx "${path.join(__dirname, "audit-incremental.ts")}" --files "${tempFile}" ${configArgs.join(" ")}`;

    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      timeout: 300000, // 5 minutes
    });

    // Essayer de parser le résultat JSON
    try {
      // Chercher le JSON dans la sortie
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      // Si le parsing échoue, retourner un résultat par défaut
    }

    return {
      statistics: {
        totalFiles: files.length,
        modifiedFiles: 0,
        addedFiles: 0,
        deletedFiles: 0,
        unchangedFiles: files.length,
      },
      fileChanges: files.map(filePath => ({
        filePath,
        changeType: "unchanged",
        symbolDiffs: [],
      })),
      recommendations: [],
      stdout: stdout.substring(0, 1000),
      stderr: stderr.substring(0, 1000),
    };
  } catch (error) {
    console.error(`[audit-incremental-wrapper] Erreur: ${error.message}`);

    return {
      statistics: {
        totalFiles: files.length,
        modifiedFiles: 0,
