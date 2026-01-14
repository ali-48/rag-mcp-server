// src/rag/streaming/file-streamer.ts
// Streaming fichier par fichier avec estimation workload et gestion de mémoire
// Version: v1.0.0
// Responsabilités: Lecture incrémentale, estimation charge, checkpoints, OOM protection

import { createReadStream, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { createInterface } from 'readline';
import { logger } from '../../core/logger.js';
import type { CheckpointManager } from '../checkpoints/checkpoint-manager.js';

/**
 * Interface pour les métriques de streaming
 */
export interface StreamingMetrics {
    /** Fichiers traités */
    filesProcessed: number;

    /** Fichiers totaux */
    filesTotal: number;

    /** Octets traités */
    bytesProcessed: number;

    /** Octets totaux */
    bytesTotal: number;

    /** Progression (0-100) */
    progress: number;

    /** Taux de traitement (octets/seconde) */
    bytesPerSecond: number;

    /** Taux de traitement (fichiers/seconde) */
    filesPerSecond: number;

    /** Utilisation mémoire actuelle (MB) */
    memoryUsage: number;

    /** Temps écoulé (ms) */
    elapsedTime: number;

    /** Temps estimé restant (ms) */
    estimatedRemaining: number;
}

/**
 * Interface pour les options de FileStreamer
 */
export interface FileStreamerOptions {
    /** Chemin du projet à streamer */
    projectPath: string;

    /** Patterns de fichiers à inclure (glob) */
    includePatterns?: string[];

    /** Patterns de fichiers à exclure (glob) */
    excludePatterns?: string[];

    /** Taille maximale de fichier (octets) */
    maxFileSize?: number;

    /** Taille maximale de batch (octets) */
    maxBatchSize?: number;

    /** Délai entre les fichiers (ms) */
    delayBetweenFiles?: number;

    /** Activer les checkpoints */
    enableCheckpoints?: boolean;

    /** Intervalle de checkpoint (fichiers) */
    checkpointInterval?: number;

    /** Limite mémoire (MB) */
    memoryLimit?: number;

    /** Callback de progression */
    onProgress?: (metrics: StreamingMetrics) => void;

    /** Callback pour chaque fichier */
    onFile?: (filePath: string, content: string, stats: FileStats) => void;

    /** Callback d'erreur */
    onError?: (error: Error, filePath: string) => void;

    /** Callback de complétion */
    onComplete?: (metrics: StreamingMetrics) => void;
}

/**
 * Statistiques de fichier
 */
export interface FileStats {
    /** Chemin relatif */
    path: string;

    /** Chemin absolu */
    absolutePath: string;

    /** Taille en octets */
    size: number;

    /** Date de modification */
    modified: Date;

    /** Date de création */
    created: Date;

    /** Type de fichier */
    type: 'file' | 'directory' | 'symlink';

    /** Extension */
    extension: string;

    /** Langage détecté */
    language?: string;

    /** Complexité estimée (1-10) */
    complexity?: number;
}

/**
 * État de checkpoint
 */
export interface StreamingCheckpoint {
    /** ID du checkpoint */
    id: string;

    /** Fichier courant */
    currentFile: string;

    /** Fichiers traités */
    filesProcessed: number;

    /** Octets traités */
    bytesProcessed: number;

    /** Date du checkpoint */
    timestamp: Date;

    /** Métriques au moment du checkpoint */
    metrics: StreamingMetrics;

    /** Liste des fichiers restants */
    remainingFiles: string[];
}

/**
 * Classe principale pour le streaming de fichiers
 */
export class FileStreamer {
    private options: Required<FileStreamerOptions>;
    private metrics: StreamingMetrics;
    private startTime: Date;
    private isRunning = false;
    private isPaused = false;
    private checkpointManager?: CheckpointManager;
    private currentCheckpoint?: StreamingCheckpoint;

    /**
     * Constructeur
     */
    constructor(options: FileStreamerOptions) {
        this.options = {
            includePatterns: options.includePatterns || ['**/*'],
            excludePatterns: options.excludePatterns || [],
            maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
            maxBatchSize: options.maxBatchSize || 5 * 1024 * 1024, // 5MB
            delayBetweenFiles: options.delayBetweenFiles || 0,
            enableCheckpoints: options.enableCheckpoints ?? true,
            checkpointInterval: options.checkpointInterval || 100,
            memoryLimit: options.memoryLimit || 500, // 500MB
            onProgress: options.onProgress || (() => { }),
            onFile: options.onFile || (() => { }),
            onError: options.onError || (() => { }),
            onComplete: options.onComplete || (() => { }),
            ...options
        };

        this.metrics = {
            filesProcessed: 0,
            filesTotal: 0,
            bytesProcessed: 0,
            bytesTotal: 0,
            progress: 0,
            bytesPerSecond: 0,
            filesPerSecond: 0,
            memoryUsage: 0,
            elapsedTime: 0,
            estimatedRemaining: 0
        };

        this.startTime = new Date();
    }

    /**
     * Définit le CheckpointManager
     */
    setCheckpointManager(manager: CheckpointManager): void {
        this.checkpointManager = manager;
    }

    /**
     * Charge un checkpoint existant
     */
    async loadCheckpoint(checkpointId: string): Promise<boolean> {
        if (!this.checkpointManager) {
            logger.warn('file.streamer.checkpoint.no_manager', 'CheckpointManager non défini');
            return false;
        }

        try {
            const result = await this.checkpointManager.loadCheckpoint<StreamingCheckpoint>(checkpointId);
            if (!result.success || !result.state) {
                return false;
            }

            this.currentCheckpoint = result.state;
            this.metrics = result.state.metrics;
            this.metrics.filesProcessed = result.state.filesProcessed;
            this.metrics.bytesProcessed = result.state.bytesProcessed;

            logger.info('file.streamer.checkpoint.loaded', `Checkpoint chargé: ${checkpointId}`, {
                checkpointId,
                filesProcessed: result.state.filesProcessed,
                bytesProcessed: result.state.bytesProcessed
            });

            return true;

        } catch (error) {
            logger.error('file.streamer.checkpoint.load_failed', `Échec chargement checkpoint: ${checkpointId}`, {
                checkpointId,
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }

    /**
     * Scanne les fichiers du projet
     */
    private scanFiles(): FileStats[] {
        const files: FileStats[] = [];
        const { projectPath, includePatterns, excludePatterns, maxFileSize } = this.options;

        logger.info('file.streamer.scan.start', `Début scan: ${projectPath}`, {
            projectPath,
            includePatterns,
            excludePatterns,
            maxFileSize
        });

        // Pour simplifier, on utilise une approche récursive simple
        // En production, utiliser glob ou fast-glob
        const scanDir = (dir: string): void => {
            try {
                const entries = readdirSync(dir, { withFileTypes: true });

                for (const entry of entries) {
                    const fullPath = join(dir, entry.name);
                    const relPath = relative(projectPath, fullPath);

                    // Vérifier les exclusions
                    if (this.isExcluded(relPath)) {
                        continue;
                    }

                    if (entry.isDirectory()) {
                        // Scanner récursivement
                        scanDir(fullPath);

                    } else if (entry.isFile()) {
                        try {
                            const stats = statSync(fullPath);

                            // Vérifier la taille
                            if (stats.size > maxFileSize) {
                                logger.debug('file.streamer.scan.skip_size', `Fichier trop grand: ${relPath}`, {
                                    path: relPath,
                                    size: stats.size,
                                    limit: maxFileSize
                                });
                                continue;
                            }

                            // Vérifier les inclusions
                            if (!this.isIncluded(relPath)) {
                                continue;
                            }

                            const extension = entry.name.includes('.')
                                ? entry.name.split('.').pop() || ''
                                : '';

                            const fileStats: FileStats = {
                                path: relPath,
                                absolutePath: fullPath,
                                size: stats.size,
                                modified: stats.mtime,
                                created: stats.birthtime,
                                type: 'file',
                                extension,
                                language: this.detectLanguage(entry.name, extension),
                                complexity: this.estimateComplexity(extension, stats.size)
                            };

                            files.push(fileStats);

                        } catch (error) {
                            logger.warn('file.streamer.scan.file_error', `Erreur fichier: ${relPath}`, {
                                path: relPath,
                                error: error instanceof Error ? error.message : String(error)
                            });
                        }
                    }
                }

            } catch (error) {
                logger.error('file.streamer.scan.dir_error', `Erreur répertoire: ${dir}`, {
                    dir,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        };

        scanDir(projectPath);

        // Trier par taille (petits fichiers d'abord pour meilleure progression)
        files.sort((a, b) => a.size - b.size);

        this.metrics.filesTotal = files.length;
        this.metrics.bytesTotal = files.reduce((sum, file) => sum + file.size, 0);

        logger.info('file.streamer.scan.complete', `Scan terminé: ${files.length} fichiers`, {
            filesCount: files.length,
            totalBytes: this.metrics.bytesTotal,
            estimatedTime: this.estimateProcessingTime(files)
        });

        return files;
    }

    /**
     * Vérifie si un fichier est exclu
     */
    private isExcluded(path: string): boolean {
        const { excludePatterns } = this.options;

        for (const pattern of excludePatterns) {
            // Implémentation simplifiée - utiliser minimatch en production
            if (pattern === '**/node_modules/**' && path.includes('node_modules')) {
                return true;
            }
            if (pattern === '**/.git/**' && path.includes('.git')) {
                return true;
            }
            if (pattern.startsWith('*.') && path.endsWith(pattern.substring(1))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Vérifie si un fichier est inclus
     */
    private isIncluded(path: string): boolean {
        const { includePatterns } = this.options;

        // Si aucun pattern spécifique, tout inclure
        if (includePatterns.length === 0 || includePatterns.includes('**/*')) {
            return true;
        }

        for (const pattern of includePatterns) {
            // Implémentation simplifiée
            if (pattern.startsWith('*.') && path.endsWith(pattern.substring(1))) {
                return true;
            }
            if (pattern.includes('/') && path.includes(pattern)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Détecte le langage d'un fichier
     */
    private detectLanguage(filename: string, extension: string): string | undefined {
        const languageMap: Record<string, string> = {
            '.ts': 'typescript',
            '.js': 'javascript',
            '.py': 'python',
            '.java': 'java',
            '.cpp': 'cpp',
            '.c': 'c',
            '.go': 'go',
            '.rs': 'rust',
            '.rb': 'ruby',
            '.php': 'php',
            '.html': 'html',
            '.css': 'css',
            '.json': 'json',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.md': 'markdown',
            '.txt': 'text'
        };

        const ext = extension ? `.${extension}` : '';
        return languageMap[ext] || languageMap[`.${extension}`] || undefined;
    }

    /**
     * Estime la complexité d'un fichier
     */
    private estimateComplexity(extension: string, size: number): number {
        // Estimation basique basée sur l'extension et la taille
        const complexExtensions = ['.ts', '.js', '.py', '.java', '.cpp'];
        const mediumExtensions = ['.go', '.rs', '.rb', '.php'];

        let baseComplexity = 1;

        if (complexExtensions.includes(`.${extension}`)) {
            baseComplexity = 5;
        } else if (mediumExtensions.includes(`.${extension}`)) {
            baseComplexity = 3;
        }

        // Ajuster par taille (logarithmique)
        const sizeComplexity = Math.min(5, Math.log10(size + 1));

        return Math.min(10, baseComplexity + sizeComplexity);
    }

    /**
     * Estime le temps de traitement
     */
    private estimateProcessingTime(files: FileStats[]): number {
        // Estimation basée sur la taille totale et un taux moyen
        const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
        const averageSpeed = 1024 * 1024; // 1MB/s
        return Math.round(totalBytes / averageSpeed);
    }

    /**
     * Lit un fichier en streaming
     */
    private async readFileStream(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const chunks: string[] = [];
            const stream = createReadStream(filePath, { encoding: 'utf8' });
            const rl = createInterface({ input: stream });

            rl.on('line', (line) => {
                chunks.push(line);

                // Vérifier la limite mémoire
                if (this.checkMemoryLimit()) {
                    rl.close();
                    stream.destroy();
                    reject(new Error(`Limite mémoire dépassée lors de la lecture: ${filePath}`));
                }
            });

            rl.on('close', () => {
                resolve(chunks.join('\n'));
            });

            rl.on('error', (error) => {
                reject(error);
            });

            stream.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Vérifie la limite mémoire
     */
    private checkMemoryLimit(): boolean {
        if (typeof process !== 'undefined' && process.memoryUsage) {
            const memoryUsage = process.memoryUsage();
            const usedMB = memoryUsage.heapUsed / 1024 / 1024;

            this.metrics.memoryUsage = usedMB;

            if (usedMB > this.options.memoryLimit) {
                logger.warn('file.streamer.memory.limit', `Limite mémoire approchée: ${usedMB}MB`, {
                    usedMB,
                    limit: this.options.memoryLimit
                });
                return true;
            }
        }

        return false;
    }

    /**
     * Met à jour les métriques
     */
    private updateMetrics(): void {
        const now = new Date();
        this.metrics.elapsedTime = now.getTime() - this.startTime.getTime();

        // Calculer la progression
        if (this.metrics.filesTotal > 0) {
            this.metrics.progress = Math.min(100, Math.round((this.metrics.filesProcessed / this.metrics.filesTotal) * 100));
        }

        if (this.metrics.elapsedTime > 0) {
            this.metrics.bytesPerSecond = this.metrics.bytesProcessed / (this.metrics.elapsedTime / 1000);
            this.metrics.filesPerSecond = this.metrics.filesProcessed / (this.metrics.elapsedTime / 1000);
        }

        if (this.metrics.bytesPerSecond > 0) {
            const remainingBytes = this.metrics.bytesTotal - this.metrics.bytesProcessed;
            this.metrics.estimatedRemaining = remainingBytes / this.metrics.bytesPerSecond * 1000;
        }

        // Appeler le callback de progression
        this.options.onProgress(this.metrics);
    }

    /**
     * Crée un checkpoint
     */
    private async createCheckpoint(currentFile: string, remainingFiles: string[]): Promise<void> {
        if (!this.options.enableCheckpoints || !this.checkpointManager) {
            return;
        }

        // Vérifier l'intervalle
        if (this.metrics.filesProcessed % this.options.checkpointInterval !== 0) {
            return;
        }

        const checkpoint: StreamingCheckpoint = {
            id: `stream-${Date.now()}-${this.metrics.filesProcessed}`,
            currentFile,
            filesProcessed: this.metrics.filesProcessed,
            bytesProcessed: this.metrics.bytesProcessed,
            timestamp: new Date(),
            metrics: { ...this.metrics },
            remainingFiles
        };

        try {
            await this.checkpointManager.saveCheckpoint(checkpoint.id, checkpoint);
            this.currentCheckpoint = checkpoint;

            logger.debug('file.streamer.checkpoint.saved', `Checkpoint créé: ${checkpoint.id}`, {
                checkpointId: checkpoint.id,
                filesProcessed: checkpoint.filesProcessed,
                bytesProcessed: checkpoint.bytesProcessed
            });

        } catch (error) {
            logger.error('file.streamer.checkpoint.save_failed', `Échec sauvegarde checkpoint`, {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Démarre le streaming
     */
    async start(): Promise<StreamingMetrics> {
        if (this.isRunning) {
            throw new Error('FileStreamer déjà en cours d\'exécution');
        }

        this.isRunning = true;
        this.startTime = new Date();

        try {
            // Scanner les fichiers
            const files = this.scanFiles();
            const remainingFiles = files.map(f => f.absolutePath);

            // Si un checkpoint existe, reprendre à partir de là
            if (this.currentCheckpoint) {
                const checkpointIndex = remainingFiles.indexOf(this.currentCheckpoint.currentFile);
                if (checkpointIndex !== -1) {
                    remainingFiles.splice(0, checkpointIndex);
                    logger.info('file.streamer.resume', `Reprise depuis checkpoint: ${this.currentCheckpoint.currentFile}`, {
                        checkpointId: this.currentCheckpoint.id,
                        filesRemaining: remainingFiles.length
                    });
                }
            }

            // Traiter chaque fichier
            for (const file of files) {
                if (!this.isRunning || this.isPaused) {
                    break;
                }

                try {
                    // Lire le fichier en streaming
                    const content = await this.readFileStream(file.absolutePath);

                    // Mettre à jour les métriques
                    this.metrics.filesProcessed++;
                    this.metrics.bytesProcessed += file.size;
                    this.updateMetrics();

                    // Appeler le callback
                    this.options.onFile(file.absolutePath, content, file);

                    // Créer un checkpoint si nécessaire
                    await this.createCheckpoint(file.absolutePath, remainingFiles);

                    // Délai entre les fichiers
                    if (this.options.delayBetweenFiles > 0) {
                        await new Promise(resolve => setTimeout(resolve, this.options.delayBetweenFiles));
                    }

                } catch (error) {
                    this.options.onError(error instanceof Error ? error : new Error(String(error)), file.absolutePath);
                    logger.warn('file.streamer.file_error', `Erreur traitement fichier: ${file.path}`, {
                        path: file.path,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }

            // Marquer comme terminé
            this.isRunning = false;
            this.options.onComplete(this.metrics);

            logger.info('file.streamer.complete', 'Streaming terminé', {
                filesProcessed: this.metrics.filesProcessed,
                bytesProcessed: this.metrics.bytesProcessed,
                elapsedTime: this.metrics.elapsedTime,
                averageSpeed: this.metrics.bytesPerSecond
            });

            return this.metrics;

        } catch (error) {
            this.isRunning = false;
            logger.error('file.streamer.fatal_error', 'Erreur fatale lors du streaming', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Met en pause le streaming
     */
    pause(): void {
        this.isPaused = true;
        logger.info('file.streamer.pause', 'Streaming mis en pause', {
            filesProcessed: this.metrics.filesProcessed,
            bytesProcessed: this.metrics.bytesProcessed
        });
    }

    /**
     * Reprend le streaming
     */
    resume(): void {
        this.isPaused = false;
        logger.info('file.streamer.resume', 'Streaming repris', {
            filesProcessed: this.metrics.filesProcessed,
            bytesProcessed: this.metrics.bytesProcessed
        });
    }

    /**
     * Arrête le streaming
     */
    stop(): void {
        this.isRunning = false;
        this.isPaused = false;
        logger.info('file.streamer.stop', 'Streaming arrêté', {
            filesProcessed: this.metrics.filesProcessed,
            bytesProcessed: this.metrics.bytesProcessed,
            elapsedTime: this.metrics.elapsedTime
        });
    }

    /**
     * Récupère les métriques actuelles
     */
    getMetrics(): StreamingMetrics {
        return { ...this.metrics };
    }

    /**
     * Teste le FileStreamer
     */
    static async test(): Promise<boolean> {
        try {
            logger.info('file.streamer.test.start', 'Début test FileStreamer');

            // Créer un streamer de test
            const streamer = new FileStreamer({
                projectPath: '.',
                includePatterns: ['*.ts', '*.js'],
                excludePatterns: ['node_modules/**'],
                maxFileSize: 1024 * 1024, // 1MB
                enableCheckpoints: false,
                memoryLimit: 100 // 100MB
            });

            // Variables pour collecter les résultats
            let filesProcessed = 0;
            let totalBytes = 0;

            streamer.options.onFile = (filePath, content, stats) => {
                filesProcessed++;
                totalBytes += stats.size;
                logger.debug('file.streamer.test.file', `Fichier traité: ${stats.path}`, {
                    path: stats.path,
                    size: stats.size,
                    language: stats.language
                });
            };

            streamer.options.onProgress = (metrics) => {
                logger.debug('file.streamer.test.progress', `Progression: ${metrics.progress}%`, {
                    progress: metrics.progress,
                    filesProcessed: metrics.filesProcessed,
                    bytesProcessed: metrics.bytesProcessed
                });
            };

            // Démarrer le streaming
            const metrics = await streamer.start();

            if (filesProcessed === 0 && metrics.filesTotal > 0) {
                throw new Error('Aucun fichier traité');
            }

            logger.info('file.streamer.test.success', 'Test FileStreamer réussi', {
                filesProcessed,
                totalBytes,
                elapsedTime: metrics.elapsedTime,
                averageSpeed: metrics.bytesPerSecond
            });

            return true;

        } catch (error) {
            logger.error('file.streamer.test.failed', 'Test FileStreamer échoué', {
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }
}

/**
 * Instance singleton de FileStreamer
 */
let fileStreamerInstance: FileStreamer | null = null;

/**
 * Obtient l'instance singleton de FileStreamer
 */
export function getFileStreamer(options: FileStreamerOptions): FileStreamer {
    if (!fileStreamerInstance) {
        fileStreamerInstance = new FileStreamer(options);
    }
    return fileStreamerInstance;
}

/**
 * Teste le module FileStreamer
 */
export async function testFileStreamerModule(): Promise<boolean> {
    return FileStreamer.test();
}

// Exécution automatique si ce fichier est exécuté directement
if (typeof require !== 'undefined' && require.main === module) {
    testFileStreamerModule().then(success => {
        if (success) {
            console.log(JSON.stringify({
                success: true,
                message: 'FileStreamer testé avec succès'
            }, null, 2));
            process.exit(0);
        } else {
            console.error(JSON.stringify({
                success: false,
                message: 'Échec du test FileStreamer'
            }, null, 2));
            process.exit(1);
        }
    });
}
