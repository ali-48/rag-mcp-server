/**
 * Module pour le mode incrémental de l'audit de code
 * Ne traite que les fichiers modifiés, utilise hash de contenu
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface FileHash {
  filePath: string;
  hash: string;
  size: number;
  mtime: number;
  lastAnalyzed: number;
}

export interface IncrementalState {
  version: string;
  lastRun: number;
  fileHashes: Record<string, FileHash>;
  dependencies: Record<string, string[]>; // file -> dépendants
  analysisResults: Record<string, any>; // file -> résultats d'analyse
}

export interface IncrementalOptions {
  enabled: boolean;
  stateFile: string;
  hashAlgorithm: string;
  checkDependencies: boolean;
  maxStateAge: number; // en millisecondes
  cleanupOldEntries: boolean;
}

const DEFAULT_OPTIONS: IncrementalOptions = {
  enabled: true,
  stateFile: 'audit/incremental-state.json',
  hashAlgorithm: 'sha256',
  checkDependencies: true,
  maxStateAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
  cleanupOldEntries: true
};

export class IncrementalMode {
  private options: IncrementalOptions;
  private state: IncrementalState;
  private changedFiles: Set<string> = new Set();
  private deletedFiles: Set<string> = new Set();
  private dependenciesChanged: Set<string> = new Set();

  constructor(options?: Partial<IncrementalOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.state = this.loadState();
  }

  /**
   * Charge l'état incrémental depuis le fichier
   */
  private loadState(): IncrementalState {
    const defaultState: IncrementalState = {
      version: '1.0.0',
      lastRun: 0,
      fileHashes: {},
      dependencies: {},
      analysisResults: {}
    };

    try {
      if (fs.existsSync(this.options.stateFile)) {
        const content = fs.readFileSync(this.options.stateFile, 'utf8');
        const savedState = JSON.parse(content);

        // Vérifier l'âge de l'état
        const stateAge = Date.now() - savedState.lastRun;
        if (stateAge > this.options.maxStateAge) {
          console.log(`⚠️ État incrémental trop ancien (${Math.round(stateAge / (24 * 60 * 60 * 1000))} jours), réinitialisation`);
          return defaultState;
        }

        return { ...defaultState, ...savedState };
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement de l état incrémental:', error);
    }

    return defaultState;
  }

  /**
   * Sauvegarde l'état incrémental dans le fichier
   */
  private saveState(): void {
    try {
      // Créer le répertoire si nécessaire
      const dir = path.dirname(this.options.stateFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.state.lastRun = Date.now();
      fs.writeFileSync(
        this.options.stateFile,
        JSON.stringify(this.state, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde de l état incrémental:', error);
    }
  }

  /**
   * Calcule le hash d'un fichier
   */
  private computeFileHash(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const hash = crypto.createHash(this.options.hashAlgorithm);
      hash.update(content);
      return hash.digest('hex');
    } catch (error) {
      console.error(`❌ Erreur lors du calcul du hash pour ${filePath}:`, error);
      return '';
    }
  }

  /**
   * Obtient les métadonnées d'un fichier
   */
  private getFileMetadata(filePath: string): { size: number; mtime: number } | null {
    try {
      const stats = fs.statSync(filePath);
      return {
        size: stats.size,
        mtime: stats.mtimeMs
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Vérifie si un fichier a changé
   */
  private hasFileChanged(filePath: string, currentHash: string, metadata: { size: number; mtime: number }): boolean {
    const previousHash = this.state.fileHashes[filePath];

    if (!previousHash) {
      return true; // Nouveau fichier
    }

    // Vérifier le hash
    if (previousHash.hash !== currentHash) {
      return true;
    }

    // Vérifier la taille (sécurité supplémentaire)
    if (previousHash.size !== metadata.size) {
      return true;
    }

    // Vérifier la date de modification
    if (previousHash.mtime !== metadata.mtime) {
      return true;
    }

    return false;
  }

  /**
   * Identifie les fichiers modifiés
   */
  identifyChangedFiles(filePaths: string[]): {
    changed: string[];
    unchanged: string[];
    deleted: string[];
  } {
    if (!this.options.enabled) {
      return {
        changed: filePaths,
        unchanged: [],
        deleted: []
      };
    }

    const changed: string[] = [];
    const unchanged: string[] = [];
    const deleted: string[] = [];

    // Vérifier les fichiers existants
    for (const filePath of filePaths) {
      const metadata = this.getFileMetadata(filePath);

      if (!metadata) {
        // Fichier supprimé ou inaccessible
        deleted.push(filePath);
        continue;
      }

      const hash = this.computeFileHash(filePath);
      if (!hash) {
        // Erreur de lecture, traiter comme changé
        changed.push(filePath);
        continue;
      }

      if (this.hasFileChanged(filePath, hash, metadata)) {
        changed.push(filePath);
        this.changedFiles.add(filePath);
      } else {
        unchanged.push(filePath);
      }
    }

    // Identifier les fichiers supprimés (dans l'état mais pas dans la liste)
    for (const storedPath of Object.keys(this.state.fileHashes)) {
      if (!filePaths.includes(storedPath) && fs.existsSync(storedPath)) {
        // Fichier toujours existant mais exclu de cette analyse
        continue;
      }

      if (!filePaths.includes(storedPath)) {
        deleted.push(storedPath);
        this.deletedFiles.add(storedPath);
      }
    }

    return { changed, unchanged, deleted };
  }

  /**
   * Met à jour les dépendances d'un fichier
   */
  updateDependencies(filePath: string, dependencies: string[]): void {
    if (!this.options.enabled || !this.options.checkDependencies) {
      return;
    }

    this.state.dependencies[filePath] = dependencies;

    // Vérifier si des fichiers dépendants doivent être réanalysés
    for (const [dependentFile, deps] of Object.entries(this.state.dependencies)) {
      if (deps.includes(filePath) && !this.changedFiles.has(dependentFile)) {
        this.dependenciesChanged.add(dependentFile);
      }
    }
  }

  /**
   * Obtient les fichiers à réanalyser à cause des dépendances
   */
  getFilesAffectedByDependencies(): string[] {
    return Array.from(this.dependenciesChanged);
  }

  /**
   * Enregistre les résultats d'analyse d'un fichier
   */
  recordAnalysisResults(filePath: string, results: any): void {
    if (!this.options.enabled) {
      return;
    }

    const metadata = this.getFileMetadata(filePath);
    if (!metadata) {
      return;
    }

    const hash = this.computeFileHash(filePath);
    if (!hash) {
      return;
    }

    this.state.fileHashes[filePath] = {
      filePath,
      hash,
      size: metadata.size,
      mtime: metadata.mtime,
      lastAnalyzed: Date.now()
    };

    this.state.analysisResults[filePath] = results;
  }

  /**
   * Obtient les résultats d'analyse précédents d'un fichier
   */
  getPreviousAnalysisResults(filePath: string): any | null {
    if (!this.options.enabled) {
      return null;
    }

    return this.state.analysisResults[filePath] || null;
  }

  /**
   * Nettoie les entrées obsolètes
   */
  cleanupOldEntries(): void {
    if (!this.options.enabled || !this.options.cleanupOldEntries) {
      return;
    }

    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 jours

    // Nettoyer les fichiers qui n'existent plus
    for (const filePath of Object.keys(this.state.fileHashes)) {
      if (!fs.existsSync(filePath)) {
        delete this.state.fileHashes[filePath];
        delete this.state.dependencies[filePath];
        delete this.state.analysisResults[filePath];
      }
    }

    // Nettoyer les entrées trop anciennes
    for (const [filePath, fileHash] of Object.entries(this.state.fileHashes)) {
      if (now - fileHash.lastAnalyzed > maxAge) {
        delete this.state.fileHashes[filePath];
        delete this.state.dependencies[filePath];
        delete this.state.analysisResults[filePath];
      }
    }
  }

  /**
   * Finalise l'exécution incrémentale
   */
  finalize(): void {
    if (!this.options.enabled) {
      return;
    }

    this.cleanupOldEntries();
    this.saveState();

    console.log('📊 Statistiques incrémentales:');
    console.log(`  - Fichiers modifiés: ${this.changedFiles.size}`);
    console.log(`  - Fichiers supprimés: ${this.deletedFiles.size}`);
    console.log(`  - Dépendances affectées: ${this.dependenciesChanged.size}`);
    console.log(`  - Total dans l état: ${Object.keys(this.state.fileHashes).length}`);
  }

  /**
   * Réinitialise l'état incrémental
   */
  reset(): void {
    this.state = {
      version: '1.0.0',
      lastRun: 0,
      fileHashes: {},
      dependencies: {},
      analysisResults: {}
    };

    this.changedFiles.clear();
    this.deletedFiles.clear();
    this.dependenciesChanged.clear();

    this.saveState();
    console.log('✅ État incrémental réinitialisé');
  }

  /**
   * Génère un rapport d'état
   */
  generateReport(): string {
    const totalFiles = Object.keys(this.state.fileHashes).length;
    const changedCount = this.changedFiles.size;
    const deletedCount = this.deletedFiles.size;
    const dependenciesCount = this.dependenciesChanged.size;

    const now = Date.now();
    const lastRunAge = this.state.lastRun ? Math.round((now - this.state.lastRun) / (60 * 60 * 1000)) : -1;

    return `# Rapport du Mode Incrémental
- **Version**: ${this.state.version}
- **Dernière exécution**: ${this.state.lastRun ? new Date(this.state.lastRun).toISOString() : 'Jamais'}
- **Âge de l état**: ${lastRunAge >= 0 ? `${lastRunAge} heures` : 'N/A'}

## Statistiques
- **Fichiers suivis**: ${totalFiles}
- **Fichiers modifiés cette exécution**: ${changedCount}
- **Fichiers supprimés cette exécution**: ${deletedCount}
- **Dépendances affectées**: ${dependenciesCount}

## Économies de traitement
${this.calculateSavingsReport()}

## Fichiers modifiés
${changedCount > 0 ? Array.from(this.changedFiles).slice(0, 10).map(f => `- ${f}`).join('\n') : 'Aucun'}
${changedCount > 10 ? `... et ${changedCount - 10} autres` : ''}

## Recommandations
${this.generateRecommendations()}
`;
  }

  /**
   * Calcule les économies de traitement
   */
  private calculateSavingsReport(): string {
    const totalTracked = Object.keys(this.state.fileHashes).length;
    const changed = this.changedFiles.size;

    if (totalTracked === 0) {
      return 'Aucune donnée historique disponible.';
    }

    const unchanged = totalTracked - changed;
    const savingsPercent = totalTracked > 0 ? Math.round((unchanged / totalTracked) * 100) : 0;

    return `- **Fichiers inchangés**: ${unchanged}/${totalTracked} (${savingsPercent}%)
- **Économie de traitement**: ${savingsPercent}% des fichiers évités
- **Performance estimée**: ${savingsPercent >= 50 ? 'Excellente' : savingsPercent >= 25 ? 'Bonne' : 'Modérée'}`;
  }

  /**
   * Génère des recommandations
   */
  private generateRecommendations(): string {
    const recommendations: string[] = [];

    if (this.state.lastRun === 0) {
      recommendations.push('⚠️ Premier exécution: l état incrémental sera créé après cette analyse.');
    }

    const now = Date.now();
    const stateAge = now - this.state.lastRun;

    if (stateAge > 30 * 24 * 60 * 60 * 1000) {
      recommendations.push('⚠️ État très ancien (plus de 30 jours): considérez une réinitialisation complète.');
    }

    if (this.changedFiles.size === 0 && this.deletedFiles.size === 0) {
      recommendations.push('✅ Aucun changement détecté: analyse complète évitée.');
    }

    if (this.dependenciesChanged.size > this.changedFiles.size * 2) {
      recommendations.push('⚠️ Nombre élevé de dépendances affectées: vérifiez la granularité des fichiers.');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ État incrémental sain: continuez comme ça !');
    }

    return recommendations.join('\n');
  }

  /**
   * Exporte l'état pour le débogage
   */
  exportState(): IncrementalState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Importe un état (pour migration ou restauration)
   */
  importState(state: Partial<IncrementalState>): void {
    this.state = {
      version: state.version || '1.0.0',
      lastRun: state.lastRun || Date.now(),
      fileHashes: state.fileHashes || {},
      dependencies: state.dependencies || {},
      analysisResults: state.analysisResults || {}
    };

    this.saveState();
    console.log('✅ État importé avec succès');
  }
}

// Fonctions utilitaires exportées
export function createIncrementalMode(options?: Partial<IncrementalOptions>): IncrementalMode {
  return new IncrementalMode(options);
}

export function computeFileHash(filePath: string, algorithm: string = 'sha256'): string {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const hash = crypto.createHash(algorithm);
    hash.update(content);
    return hash.digest('hex');
  } catch (error) {
    console.error(`❌ Erreur lors du calcul du hash pour ${filePath}:`, error);
    return '';
  }
}

export function shouldProcessFile(
  filePath: string,
  previousHash: string,
  currentHash: string,
  options: { checkSize?: boolean; checkMtime?: boolean } = {}
): boolean {
  if (!previousHash) {
    return true;
  }

  if (previousHash !== currentHash) {
    return true;
  }

  const { checkSize = true, checkMtime = true } = options;

  if (checkSize || checkMtime) {
    try {
      const stats = fs.statSync(filePath);

      if (checkSize) {
        // La taille est déjà implicitement vérifiée via le hash
        // Mais on peut ajouter des vérifications supplémentaires ici
      }

      if (checkMtime) {
        // La date de modification n'est pas stockée dans le hash
        // On pourrait la stocker séparément si nécessaire
      }
    } catch (error) {
      // Erreur de stat, traiter comme changé
      return true;
    }
  }

  return false;
}
