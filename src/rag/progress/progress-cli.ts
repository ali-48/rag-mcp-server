// src/rag/progress/progress-cli.ts
// Barre de progression optionnelle pour interface CLI humaine
// Version: v1.0.0
// Responsabilités: Affichage progress bars, ETA, stats, activation conditionnelle

import { logger } from '../../core/logger.js';
import type { ProgressState } from './progress-state.js';

/**
 * Options de configuration de la barre de progression
 */
export interface ProgressCLIOptions {
    /** Activer la barre de progression */
    enabled: boolean;

    /** Type de barre de progression */
    type: 'bar' | 'spinner' | 'dots' | 'percentage';

    /** Largeur de la barre (caractères) */
    width: number;

    /** Caractères de la barre */
    barChars: {
        complete: string;
        incomplete: string;
        start: string;
        end: string;
    };

    /** Mettre à jour en temps réel */
    realtime: boolean;

    /** Intervalle de mise à jour (ms) */
    updateInterval: number;

    /** Afficher l'ETA */
    showETA: boolean;

    /** Afficher les statistiques */
    showStats: boolean;

    /** Afficher les phases */
    showPhases: boolean;

    /** Afficher l'utilisation mémoire */
    showMemory: boolean;

    /** Afficher l'utilisation CPU */
    showCPU: boolean;

    /** Couleurs */
    colors: {
        bar: string;
        percentage: string;
        eta: string;
        stats: string;
        phase: string;
        memory: string;
        cpu: string;
    };

    /** Format de sortie */
    outputFormat: 'text' | 'json' | 'both';

    /** Cible de sortie */
    outputTarget: 'stdout' | 'stderr' | 'file';

    /** Fichier de sortie (si outputTarget = 'file') */
    outputFile?: string;
}

/**
 * État de la barre de progression
 */
export interface ProgressCLIState {
    /** ID unique */
    id: string;

    /** Titre */
    title: string;

    /** Description */
    description?: string;

    /** Progression actuelle (0-100) */
    progress: number;

    /** Progression précédente */
    previousProgress: number;

    /** Vitesse de progression (pourcentage/seconde) */
    speed: number;

    /** Temps écoulé (ms) */
    elapsedTime: number;

    /** Temps estimé restant (ms) */
    estimatedRemaining: number;

    /** Heure de début */
    startTime: Date;

    /** Heure de dernière mise à jour */
    lastUpdateTime: Date;

    /** Phases */
    phases: Array<{
        name: string;
        progress: number;
        status: string;
    }>;

    /** Statistiques */
    stats: {
        itemsProcessed: number;
        itemsTotal: number;
        itemsPerSecond: number;
        successRate: number;
        failureRate: number;
    };

    /** Métriques système */
    systemMetrics: {
        memoryUsage: number;
        cpuUsage: number;
        heapUsed: number;
        heapTotal: number;
    };

    /** Messages */
    messages: Array<{
        timestamp: Date;
        level: 'info' | 'warn' | 'error' | 'debug';
        message: string;
    }>;

    /** État de la barre */
    barState: {
        currentWidth: number;
        completeChars: number;
        incompleteChars: number;
        percentageText: string;
    };
}

/**
 * Classe pour la barre de progression CLI
 */
export class ProgressCLI {
    private options: Required<ProgressCLIOptions>;
    private state: ProgressCLIState;
    private isRunning = false;
    private updateIntervalId?: NodeJS.Timeout;
    private lastRenderTime = 0;
    private renderThrottle = 100; // ms entre les rendus
    private outputStream: NodeJS.WriteStream;

    /**
     * Constructeur
     */
    constructor(options?: Partial<ProgressCLIOptions>) {
        this.options = {
            enabled: options?.enabled ?? true,
            type: options?.type || 'bar',
            width: options?.width || 40,
            barChars: {
                complete: options?.barChars?.complete || '█',
                incomplete: options?.barChars?.incomplete || '░',
                start: options?.barChars?.start || '[',
                end: options?.barChars?.end || ']',
            },
            realtime: options?.realtime ?? true,
            updateInterval: options?.updateInterval || 100,
            showETA: options?.showETA ?? true,
            showStats: options?.showStats ?? true,
            showPhases: options?.showPhases ?? true,
            showMemory: options?.showMemory ?? false,
            showCPU: options?.showCPU ?? false,
            colors: {
                bar: options?.colors?.bar || '\x1b[32m', // Vert
                percentage: options?.colors?.percentage || '\x1b[36m', // Cyan
                eta: options?.colors?.eta || '\x1b[33m', // Jaune
                stats: options?.colors?.stats || '\x1b[35m', // Magenta
                phase: options?.colors?.phase || '\x1b[34m', // Bleu
                memory: options?.colors?.memory || '\x1b[31m', // Rouge
                cpu: options?.colors?.cpu || '\x1b[31m', // Rouge
            },
            outputFormat: options?.outputFormat || 'text',
            outputTarget: options?.outputTarget || 'stdout',
            outputFile: options?.outputFile || '',
        };

        // Déterminer le flux de sortie
        if (this.options.outputTarget === 'stderr') {
            this.outputStream = process.stderr;
        } else if (this.options.outputTarget === 'file' && this.options.outputFile) {
            // Pour l'instant, on utilise stdout
            this.outputStream = process.stdout;
        } else {
            this.outputStream = process.stdout;
        }

        // État initial
        this.state = {
            id: `progress-cli-${Date.now()}`,
            title: 'Initialisation...',
            progress: 0,
            previousProgress: 0,
            speed: 0,
            elapsedTime: 0,
            estimatedRemaining: 0,
            startTime: new Date(),
            lastUpdateTime: new Date(),
            phases: [],
            stats: {
                itemsProcessed: 0,
                itemsTotal: 0,
                itemsPerSecond: 0,
                successRate: 1.0,
                failureRate: 0.0,
            },
            systemMetrics: {
                memoryUsage: 0,
                cpuUsage: 0,
                heapUsed: 0,
                heapTotal: 0,
            },
            messages: [],
            barState: {
                currentWidth: 0,
                completeChars: 0,
                incompleteChars: 0,
                percentageText: '0%',
            },
        };

        // Initialiser les couleurs si non supportées
        if (!this.supportsColors()) {
            this.disableColors();
        }
    }

    /**
     * Vérifie si le terminal supporte les couleurs
     */
    private supportsColors(): boolean {
        return process.stdout.isTTY && process.stdout.hasColors?.() || false;
    }

    /**
     * Désactive les couleurs
     */
    private disableColors(): void {
        Object.keys(this.options.colors).forEach(key => {
            this.options.colors[key as keyof typeof this.options.colors] = '';
        });
    }

    /**
     * Démarre la barre de progression
     */
    start(title: string, description?: string): void {
        if (!this.options.enabled) {
            return;
        }

        if (this.isRunning) {
            this.stop();
        }

        this.state = {
            ...this.state,
            id: `progress-cli-${Date.now()}`,
            title,
            description,
            progress: 0,
            previousProgress: 0,
            speed: 0,
            elapsedTime: 0,
            estimatedRemaining: 0,
            startTime: new Date(),
            lastUpdateTime: new Date(),
            phases: [],
            messages: [],
        };

        this.isRunning = true;

        // Effacer la ligne actuelle
        this.clearLine();

        // Démarrer l'intervalle de mise à jour
        if (this.options.realtime) {
            this.updateIntervalId = setInterval(() => {
                this.update();
                this.render();
            }, this.options.updateInterval);
        }

        logger.debug('progress.cli.start', 'Barre de progression démarrée', {
            title,
            options: this.options,
        });
    }

    /**
     * Met à jour la progression
     */
    updateProgress(progress: number, stats?: Partial<ProgressCLIState['stats']>): void {
        if (!this.isRunning || !this.options.enabled) {
            return;
        }

        const now = new Date();
        const timeDiff = now.getTime() - this.state.lastUpdateTime.getTime();

        // Calculer la vitesse
        if (timeDiff > 0) {
            const progressDiff = progress - this.state.previousProgress;
            this.state.speed = (progressDiff / timeDiff) * 1000; // %/seconde
        }

        // Mettre à jour l'état
        this.state.previousProgress = this.state.progress;
        this.state.progress = Math.max(0, Math.min(100, progress));
        this.state.lastUpdateTime = now;
        this.state.elapsedTime = now.getTime() - this.state.startTime.getTime();

        // Calculer le temps restant
        if (this.state.speed > 0) {
            const remainingProgress = 100 - this.state.progress;
            this.state.estimatedRemaining = (remainingProgress / this.state.speed) * 1000;
        }

        // Mettre à jour les statistiques
        if (stats) {
            this.state.stats = { ...this.state.stats, ...stats };
        }

        // Mettre à jour les métriques système
        this.updateSystemMetrics();

        // Mettre à jour la barre
        this.updateBarState();

        // Forcer le rendu si pas en temps réel
        if (!this.options.realtime) {
            this.render();
        }
    }

    /**
     * Met à jour les phases
     */
    updatePhases(phases: Array<{ name: string; progress: number; status: string }>): void {
        if (!this.isRunning || !this.options.enabled) {
            return;
        }

        this.state.phases = phases;
    }

    /**
     * Ajoute un message
     */
    addMessage(message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info'): void {
        if (!this.isRunning || !this.options.enabled) {
            return;
        }

        this.state.messages.push({
            timestamp: new Date(),
            level,
            message,
        });

        // Garder seulement les 10 derniers messages
        if (this.state.messages.length > 10) {
            this.state.messages = this.state.messages.slice(-10);
        }
    }

    /**
     * Met à jour à partir d'un ProgressState
     */
    updateFromProgressState(progressState: ProgressState): void {
        if (!this.isRunning || !this.options.enabled) {
            return;
        }

        // Mettre à jour la progression globale
        this.updateProgress(progressState.overallProgress, {
            itemsProcessed: progressState.globalMetrics.totalFilesProcessed,
            itemsTotal: progressState.globalMetrics.totalFiles,
            itemsPerSecond: progressState.globalMetrics.overallProcessingRate,
            successRate: progressState.performanceStats.successRate,
            failureRate: progressState.performanceStats.failureRate,
        });

        // Mettre à jour les phases
        const phases = progressState.phases.map(phase => ({
            name: phase.name,
            progress: phase.progress,
            status: phase.status,
        }));
        this.updatePhases(phases);

        // Mettre à jour le titre
        if (progressState.currentPhase) {
            this.state.title = `${progressState.currentPhase.name} - ${progressState.jobType}`;
            if (progressState.currentPhase.description) {
                this.state.description = progressState.currentPhase.description;
            }
        }

        // Ajouter des messages pour les alertes
        if (progressState.monitoringData.alerts.length > 0) {
            const recentAlerts = progressState.monitoringData.alerts.slice(-3);
            recentAlerts.forEach(alert => {
                if (!alert.resolved) {
                    this.addMessage(alert.message, alert.type as 'info' | 'warn' | 'error');
                }
            });
        }
    }

    /**
     * Met à jour les métriques système
     */
    private updateSystemMetrics(): void {
        if (typeof process !== 'undefined' && process.memoryUsage) {
            const memoryUsage = process.memoryUsage();
            this.state.systemMetrics = {
                memoryUsage: memoryUsage.heapUsed / 1024 / 1024, // MB
                cpuUsage: 0, // Non disponible sans module supplémentaire
                heapUsed: memoryUsage.heapUsed,
                heapTotal: memoryUsage.heapTotal,
            };
        }
    }

    /**
     * Met à jour l'état de la barre
     */
    private updateBarState(): void {
        const progress = this.state.progress;
        const width = this.options.width;
        const completeChars = Math.floor((progress / 100) * width);
        const incompleteChars = width - completeChars;

        this.state.barState = {
            currentWidth: width,
            completeChars,
            incompleteChars,
            percentageText: `${progress.toFixed(1)}%`,
        };
    }

    /**
     * Met à jour l'affichage (appelé par l'intervalle)
     */
    private update(): void {
        // Mettre à jour les métriques système
        this.updateSystemMetrics();

        // Mettre à jour la barre
        this.updateBarState();
    }

    /**
     * Affiche la barre de progression
     */
    private render(): void {
        // Limiter la fréquence de rendu
        const now = Date.now();
        if (now - this.lastRenderTime < this.renderThrottle) {
            return;
        }
        this.lastRenderTime = now;

        // Effacer la ligne précédente
        this.clearLine();

        // Construire la sortie
        let output = '';

        if (this.options.outputFormat === 'text' || this.options.outputFormat === 'both') {
            output += this.renderText();
        }

        if (this.options.outputFormat === 'json' || this.options.outputFormat === 'both') {
            if (this.options.outputFormat === 'both') {
                output += '\n';
            }
            output += this.renderJSON();
        }

        // Afficher
        this.outputStream.write(output);
    }

    /**
     * Rendu texte
     */
    private renderText(): string {
        const { colors } = this.options;
        const { barState, progress, title, stats, phases, systemMetrics } = this.state;

        let output = '';

        // Titre
        output += `${colors.phase}${title}\x1b[0m\n`;

        // Description
        if (this.state.description) {
            output += `${this.state.description}\n`;
        }

        // Barre de progression
        if (this.options.type === 'bar') {
            const bar = this.options.barChars.start +
                colors.bar +
                this.options.barChars.complete.repeat(barState.completeChars) +
                '\x1b[0m' +
                this.options.barChars.incomplete.repeat(barState.incompleteChars) +
                this.options.barChars.end;

            output += `${bar} ${colors.percentage}${barState.percentageText}\x1b[0m\n`;
        } else if (this.options.type === 'percentage') {
            output += `${colors.percentage}${barState.percentageText}\x1b[0m\n`;
        } else if (this.options.type === 'spinner') {
            const spinners = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
            const spinnerIndex = Math.floor(Date.now() / 100) % spinners.length;
            output += `${spinners[spinnerIndex]} ${colors.percentage}${barState.percentageText}\x1b[0m\n`;
        }

        // ETA
        if (this.options.showETA && this.state.estimatedRemaining > 0) {
            const etaSeconds = Math.ceil(this.state.estimatedRemaining / 1000);
            const etaMinutes = Math.floor(etaSeconds / 60);
            const etaHours = Math.floor(etaMinutes / 60);

            let etaText = '';
            if (etaHours > 0) {
                etaText += `${etaHours}h `;
            }
            if (etaMinutes > 0) {
                etaText += `${etaMinutes % 60}m `;
            }
            etaText += `${etaSeconds % 60}s`;

            output += `${colors.eta}ETA: ${etaText}\x1b[0m\n`;
        }

        // Statistiques
        if (this.options.showStats) {
            output += `${colors.stats}`;
            output += `Processed: ${stats.itemsProcessed}/${stats.itemsTotal} `;
            output += `(${stats.itemsPerSecond.toFixed(1)}/s) `;
            output += `Success: ${(stats.successRate * 100).toFixed(1)}%`;
            output += `\x1b[0m\n`;
        }

        // Phases
        if (this.options.showPhases && phases.length > 0) {
            output += `${colors.phase}Phases:\x1b[0m\n`;
            phases.forEach(phase => {
                const phaseBarWidth = 10;
                const phaseComplete = Math.floor((phase.progress / 100) * phaseBarWidth);
                const phaseIncomplete = phaseBarWidth - phaseComplete;
                const phaseBar = '█'.repeat(phaseComplete) + '░'.repeat(phaseIncomplete);
                output += `  ${phase.name}: ${phaseBar} ${phase.progress.toFixed(1)}% (${phase.status})\n`;
            });
        }

        // Utilisation mémoire
        if (this.options.showMemory && systemMetrics.memoryUsage > 0) {
            output += `${colors.memory}Memory: ${systemMetrics.memoryUsage.toFixed(1)}MB\x1b[0m\n`;
        }

        // Utilisation CPU
        if (this.options.showCPU && systemMetrics.cpuUsage > 0) {
            output += `${colors.cpu}CPU: ${systemMetrics.cpuUsage.toFixed(1)}%\x1b[0m\n`;
        }

        // Messages récents
        if (this.state.messages.length > 0) {
            const recentMessages = this.state.messages.slice(-3);
            output += `Messages:\n`;
            recentMessages.forEach(msg => {
                const time = msg.timestamp.toLocaleTimeString();
                const levelChar = msg.level === 'error' ? '❌' :
                    msg.level === 'warn' ? '⚠️' :
                        msg.level === 'info' ? 'ℹ️' : '🔍';
                output += `  ${time} ${levelChar} ${msg.message}\n`;
            });
        }

        return output;
    }

    /**
     * Rendu JSON
     */
    private renderJSON(): string {
        return JSON.stringify({
            id: this.state.id,
            title: this.state.title,
            progress: this.state.progress,
            speed: this.state.speed,
            elapsedTime: this.state.elapsedTime,
            estimatedRemaining: this.state.estimatedRemaining,
            stats: this.state.stats,
            phases: this.state.phases,
            systemMetrics: this.state.systemMetrics,
            timestamp: new Date().toISOString(),
        }, null, 2);
    }

    /**
     * Efface la ligne actuelle
     */
    private clearLine(): void {
        if (this.outputStream.isTTY) {
            this.outputStream.write('\x1b[2K\r');
        }
    }

    /**
     * Arrête la barre de progression
     */
    stop(): void {
        if (!this.isRunning) {
            return;
        }

        // Arrêter l'intervalle
        if (this.updateIntervalId) {
            clearInterval(this.updateIntervalId);
            this.updateIntervalId = undefined;
        }

        // Finaliser l'affichage
        this.updateProgress(100);
        this.render();

        // Nouvelle ligne
        this.outputStream.write('\n');

        this.isRunning = false;

        logger.debug('progress.cli.stop', 'Barre de progression arrêtée', {
            title: this.state.title,
            elapsedTime: this.state.elapsedTime,
            finalProgress: this.state.progress,
        });
    }

    /**
     * Termine avec succès
     */
    complete(message?: string): void {
        if (!this.isRunning) {
            return;
        }

        if (message) {
            this.addMessage(message, 'info');
        }

        this.updateProgress(100);
        this.stop();

        // Afficher un message de succès
        this.clearLine();
        this.outputStream.write(`✅ ${this.state.title} - Terminé avec succès!\n`);
        if (message) {
            this.outputStream.write(`   ${message}\n`);
        }
    }

    /**
     * Termine avec erreur
     */
    error(message: string, error?: Error): void {
        if (!this.isRunning) {
            return;
        }

        this.addMessage(message, 'error');
        if (error) {
            this.addMessage(error.message, 'error');
        }

        this.stop();

        // Afficher un message d'erreur
        this.clearLine();
        this.outputStream.write(`❌ ${this.state.title} - Échec!\n`);
        this.outputStream.write(`   ${message}\n`);
        if (error) {
            this.outputStream.write(`   Erreur: ${error.message}\n`);
        }
    }

    /**
     * Récupère l'état actuel
     */
    getState(): ProgressCLIState {
        return { ...this.state };
    }

    /**
     * Récupère les options
     */
    getOptions(): ProgressCLIOptions {
        return { ...this.options };
    }

    /**
     * Teste le ProgressCLI
     */
    static async test(): Promise<boolean> {
        try {
            logger.info('progress.cli.test.start', 'Début test ProgressCLI');

            // Créer un ProgressCLI de test
            const progress = new ProgressCLI({
                enabled: true,
                type: 'bar',
                width: 30,
                realtime: true,
                showETA: true,
                showStats: true,
                showPhases: true,
                outputFormat: 'text',
            });

            // Démarrer
            progress.start('Test ProgressCLI', 'Test de la barre de progression');

            // Simuler une progression
            for (let i = 0; i <= 100; i += 10) {
                await new Promise(resolve => setTimeout(resolve, 200));
                progress.updateProgress(i, {
                    itemsProcessed: i * 10,
                    itemsTotal: 1000,
                    itemsPerSecond: 50,
                    successRate: 0.95,
                    failureRate: 0.05,
                });

                // Mettre à jour les phases
                if (i === 30) {
                    progress.updatePhases([
                        { name: 'Phase 1', progress: 100, status: 'completed' },
                        { name: 'Phase 2', progress: 50, status: 'running' },
                        { name: 'Phase 3', progress: 0, status: 'pending' },
                    ]);
                }

                // Ajouter des messages
                if (i === 50) {
                    progress.addMessage('Mi-parcours atteinte', 'info');
                }
            }

            // Terminer
            progress.complete('Test terminé avec succès');

            // Vérifier l'état final
            const state = progress.getState();
            if (state.progress !== 100) {
                throw new Error('Progression finale incorrecte');
            }

            if (state.phases.length !== 3) {
                throw new Error('Phases incorrectes');
            }

            logger.info('progress.cli.test.success', 'Test ProgressCLI réussi');
            return true;

        } catch (error) {
            logger.error('progress.cli.test.failed', 'Test ProgressCLI échoué', {
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }
}

/**
 * Instance singleton de ProgressCLI
 */
let progressCLIInstance: ProgressCLI | null = null;

/**
 * Obtient l'instance singleton de ProgressCLI
 */
export function getProgressCLI(options?: Partial<ProgressCLIOptions>): ProgressCLI {
    if (!progressCLIInstance) {
        progressCLIInstance = new ProgressCLI(options);
    }
    return progressCLIInstance;
}

/**
 * Crée une barre de progression temporaire
 */
export function createProgressBar(title: string, options?: Partial<ProgressCLIOptions>): ProgressCLI {
    const progress = new ProgressCLI(options);
    progress.start(title);
    return progress;
}

/**
 * Teste le module ProgressCLI
 */
export async function testProgressCLIModule(): Promise<boolean> {
    return ProgressCLI.test();
}

// Exécution automatique si ce fichier est exécuté directement
if (typeof require !== 'undefined' && require.main === module) {
    testProgressCLIModule().then(success => {
        if (success) {
            console.log(JSON.stringify({
                success: true,
                message: 'ProgressCLI testé avec succès'
            }, null, 2));
            process.exit(0);
        } else {
            console.error(JSON.stringify({
                success: false,
                message: 'Échec du test ProgressCLI'
            }, null, 2));
            process.exit(1);
        }
    });
}
