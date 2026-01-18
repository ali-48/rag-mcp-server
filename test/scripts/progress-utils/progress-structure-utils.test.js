// test/scripts/progress-utils/progress-structure-utils.test.js
// Tests unitaires pour progress-structure-utils

import { describe, expect, it } from 'vitest';
import {
  createDefaultExecutionConfig,
  createInitialExecutionDetails,
  createInitialGlobalMetrics,
  createInitializationPhase,
  createInitialMetadata,
  createInitialMonitoringData,
  createInitialPerformanceStats,
  createInitialWorkloadScore,
  createJobSpecificPhases,
  initializeProgressStructure
} from '../../../scripts/progress-utils/progress-structure-utils.js';

describe('progress-structure-utils', () => {
  const mockJob = {
    id: 'test-job-123',
    type: 'scan',
    projectPath: '/test/project'
  };

  const mockNow = new Date('2024-01-01T00:00:00.000Z');

  describe('createInitialWorkloadScore', () => {
    it('should create initial workload score with default values', () => {
      const result = createInitialWorkloadScore();

      expect(result.overall).toBe(0);
      expect(result.complexity).toBe(0);
      expect(result.volume).toBe(0);
      expect(result.performance).toBe(0);
      expect(result.risk).toBe(0);
      expect(result.factors.fileCount).toBe(0);
      expect(result.factors.totalSize).toBe(0);
      expect(result.factors.averageComplexity).toBe(0);
      expect(result.factors.fileTypes).toEqual({});
      expect(result.factors.languages).toEqual({});
      expect(result.factors.dependencies).toEqual([]);
      expect(result.recommendations).toHaveLength(2);
      expect(result.recommendations).toContain('Analyse initiale en cours...');
    });
  });

  describe('createInitializationPhase', () => {
    it('should create initialization phase with completed status', () => {
      const result = createInitializationPhase(mockNow);

      expect(result.id).toBe('phase-initialization');
      expect(result.name).toBe('Initialisation');
      expect(result.description).toBe('Préparation de l\'environnement d\'exécution');
      expect(result.type).toBe('custom');
      expect(result.status).toBe('completed');
      expect(result.progress).toBe(100);
      expect(result.metrics.filesProcessed).toBe(0);
      expect(result.metrics.filesTotal).toBe(0);
      expect(result.metrics.elapsedTime).toBe(0);
      expect(result.startedAt).toBe(mockNow);
      expect(result.completedAt).toBe(mockNow);
    });
  });

  describe('createJobSpecificPhases', () => {
    it('should create scan phase for scan job type', () => {
      const result = createJobSpecificPhases('scan');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('phase-scan');
      expect(result[0].name).toBe('Scan des fichiers');
      expect(result[0].description).toBe('Analyse des fichiers du projet');
      expect(result[0].type).toBe('scan');
      expect(result[0].status).toBe('pending');
      expect(result[0].progress).toBe(0);
    });

    it('should create prepare phase for prepare job type', () => {
      const result = createJobSpecificPhases('prepare');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('phase-prepare');
      expect(result[0].name).toBe('Préparation des chunks');
      expect(result[0].description).toBe('Découpage intelligent des fichiers');
      expect(result[0].type).toBe('prepare');
    });

    it('should create embed phase for embed job type', () => {
      const result = createJobSpecificPhases('embed');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('phase-embed');
      expect(result[0].name).toBe('Génération d\'embeddings');
      expect(result[0].description).toBe('Création des vecteurs sémantiques');
      expect(result[0].type).toBe('embed');
    });

    it('should create index phase for index job type', () => {
      const result = createJobSpecificPhases('index');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('phase-index');
      expect(result[0].name).toBe('Indexation');
      expect(result[0].description).toBe('Stockage et organisation des embeddings');
      expect(result[0].type).toBe('index');
    });

    it('should create query phase for query job type', () => {
      const result = createJobSpecificPhases('query');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('phase-query');
      expect(result[0].name).toBe('Recherche');
      expect(result[0].description).toBe('Recherche sémantique dans les index');
      expect(result[0].type).toBe('query');
    });

    it('should return empty array for unknown job type', () => {
      const result = createJobSpecificPhases('unknown');

      expect(result).toEqual([]);
    });
  });

  describe('createInitialGlobalMetrics', () => {
    it('should create initial global metrics with zero values', () => {
      const result = createInitialGlobalMetrics();

      expect(result.totalFilesProcessed).toBe(0);
      expect(result.totalFiles).toBe(0);
      expect(result.overallProcessingRate).toBe(0);
      expect(result.totalElapsedTime).toBe(0);
      expect(result.averageMemoryUsage).toBe(0);
      expect(result.averageCpuUsage).toBe(0);
      expect(result.checkpointsSaved).toBe(0);
      expect(result.totalErrors).toBe(0);
      expect(result.totalWarnings).toBe(0);
    });
  });

  describe('createInitialExecutionDetails', () => {
    it('should create execution details with current timestamp', () => {
      const result = createInitialExecutionDetails(mockNow);

      expect(result.startedAt).toBe(mockNow);
      expect(result.updatedAt).toBe(mockNow);
    });
  });

  describe('createDefaultExecutionConfig', () => {
    it('should create default execution configuration', () => {
      const result = createDefaultExecutionConfig();

      expect(result.mode).toBe('full');
      expect(result.chunkingStrategy).toBe('logical');
      expect(result.embeddingModel).toBe('nomic-embed-text');
      expect(result.maxChunkSize).toBe(1000);
      expect(result.chunkOverlap).toBe(200);
      expect(result.enableLLMEnrichment).toBe(false);
      expect(result.enableCheckpoints).toBe(true);
      expect(result.checkpointInterval).toBe(60);
    });
  });

  describe('createInitialPerformanceStats', () => {
    it('should create initial performance stats with zero values', () => {
      const result = createInitialPerformanceStats();

      expect(result.averageFileProcessingTime).toBe(0);
      expect(result.averageEmbeddingTime).toBe(0);
      expect(result.successRate).toBe(0);
      expect(result.failureRate).toBe(0);
      expect(result.averageWaitTime).toBe(0);
      expect(result.averageCpuTime).toBe(0);
      expect(result.averageIoTime).toBe(0);
    });
  });

  describe('createInitialMonitoringData', () => {
    it('should create initial monitoring data with empty arrays', () => {
      const result = createInitialMonitoringData();

      expect(result.memoryUsageHistory).toEqual([]);
      expect(result.cpuUsageHistory).toEqual([]);
      expect(result.processingRateHistory).toEqual([]);
      expect(result.progressHistory).toEqual([]);
      expect(result.alerts).toEqual([]);
    });
  });

  describe('createInitialMetadata', () => {
    it('should create initial metadata with environment info', () => {
      const result = createInitialMetadata();

      expect(result.version).toBe('1.0.0');
      expect(result.environment.nodeVersion).toBe(process.version);
      expect(result.environment.os).toBe(process.platform);
      expect(result.environment.architecture).toBe(process.arch);
      expect(result.environment.totalMemory).toBe(0);
      expect(result.environment.availableCpus).toBe(0);
      expect(result.loadedPlugins).toEqual([]);
      expect(result.enabledExtensions).toEqual([]);
    });
  });

  describe('initializeProgressStructure', () => {
    it('should initialize complete progress structure for scan job', () => {
      const result = initializeProgressStructure(mockJob, mockNow);

      expect(result.id).toContain('progress-test-job-123-');
      expect(result.jobId).toBe('test-job-123');
      expect(result.jobType).toBe('scan');
      expect(result.projectPath).toBe('/test/project');
      expect(result.status).toBe('initializing');
      expect(result.phases).toHaveLength(2);
      expect(result.phases[0].id).toBe('phase-initialization');
      expect(result.phases[1].id).toBe('phase-scan');
      expect(result.currentPhase).toEqual(result.phases[0]);
      expect(result.overallProgress).toBe(0);
      expect(result.workloadScore.overall).toBe(0);
      expect(result.globalMetrics.totalFilesProcessed).toBe(0);
      expect(result.executionDetails.startedAt).toBe(mockNow);
      expect(result.executionConfig.mode).toBe('full');
      expect(result.performanceStats.averageFileProcessingTime).toBe(0);
      expect(result.monitoringData.memoryUsageHistory).toEqual([]);
      expect(result.metadata.version).toBe('1.0.0');
    });

    it('should initialize progress structure for embed job', () => {
      const embedJob = { ...mockJob, type: 'embed' };
      const result = initializeProgressStructure(embedJob, mockNow);

      expect(result.jobType).toBe('embed');
      expect(result.phases).toHaveLength(2);
      expect(result.phases[1].id).toBe('phase-embed');
    });

    it('should generate unique ID for each initialization', () => {
      const result1 = initializeProgressStructure(mockJob, mockNow);
      const result2 = initializeProgressStructure(mockJob, mockNow);

      expect(result1.id).not.toBe(result2.id);
      expect(result1.id).toContain('progress-test-job-123-');
      expect(result2.id).toContain('progress-test-job-123-');
    });
  });
});
