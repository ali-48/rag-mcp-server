// test/scripts/dashboard-utils/dashboard-stats-utils.test.js
// Tests unitaires pour dashboard-stats-utils

import * as fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calculateContentTypeStats,
  calculateGlobalStats,
  calculateMissingFiles,
  createProgressBar,
  formatNumber,
  generateRecommendations,
  identifyStaleProjects,
  scanProjectDirectory
} from '../../../scripts/dashboard-utils/dashboard-stats-utils.js';

// Mocks
vi.mock('fs');
vi.mock('path');

describe('dashboard-stats-utils', () => {
  const mockProjectStats = [
    {
      path: '/project1',
      indexedStats: {
        totalFiles: 50,
        totalChunks: 200,
        contentTypes: { code: 30, doc: 15, config: 5 },
        lastUpdated: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) // 15 jours
      },
      scannedFiles: {
        code: 40,
        doc: 20,
        config: 10,
        other: 5,
        total: 75
      }
    },
    {
      path: '/project2',
      indexedStats: {
        totalFiles: 30,
        totalChunks: 120,
        contentTypes: { code: 20, doc: 8, other: 2 },
        lastUpdated: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) // 40 jours
      },
      scannedFiles: {
        code: 25,
        doc: 10,
        config: 5,
        other: 3,
        total: 43
      }
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('formatNumber', () => {
    it('should format numbers with French locale', () => {
      expect(formatNumber(1000)).toBe('1 000');
      expect(formatNumber(1234567)).toBe('1 234 567');
      expect(formatNumber(42)).toBe('42');
    });
  });

  describe('createProgressBar', () => {
    it('should create progress bar with correct percentage', () => {
      const bar = createProgressBar(75, 100, 30);
      expect(bar).toContain('75.0%');
      expect(bar).toContain('█');
      expect(bar).toContain('░');
    });

    it('should handle zero max value', () => {
      const bar = createProgressBar(0, 0, 30);
      expect(bar).toContain('0.0%');
    });

    it('should handle partial progress', () => {
      const bar = createProgressBar(33, 100, 30);
      expect(bar).toContain('33.0%');
    });
  });

  describe('scanProjectDirectory', () => {
    it('should scan directory and count files by type', () => {
      const existsSyncMock = vi.mocked(fs.existsSync);
      const readdirSyncMock = vi.mocked(fs.readdirSync);

      existsSyncMock.mockReturnValue(true);
      readdirSyncMock.mockReturnValue([
        { name: 'file1.ts', isDirectory: () => false, isFile: () => true },
        { name: 'file2.md', isDirectory: () => false, isFile: () => true },
        { name: 'file3.json', isDirectory: () => false, isFile: () => true },
        { name: 'file4.txt', isDirectory: () => false, isFile: () => true },
        { name: 'node_modules', isDirectory: () => true, isFile: () => false },
        { name: '.git', isDirectory: () => true, isFile: () => false },
        { name: 'build', isDirectory: () => true, isFile: () => false }
      ]);

      const result = scanProjectDirectory('/test/project');

      expect(result).toEqual({
        code: 1, // .ts
        doc: 2,  // .md + .txt
        config: 1, // .json
        other: 0,
        total: 4
      });
    });

    it('should handle non-existent directory', () => {
      const existsSyncMock = vi.mocked(fs.existsSync);
      existsSyncMock.mockReturnValue(false);

      const result = scanProjectDirectory('/non/existent');

      expect(result).toEqual({
        code: 0,
        doc: 0,
        config: 0,
        other: 0,
        total: 0
      });
    });
  });

  describe('calculateGlobalStats', () => {
    it('should calculate global statistics correctly', () => {
      const result = calculateGlobalStats(mockProjectStats);

      expect(result.totalIndexedFiles).toBe(80); // 50 + 30
      expect(result.totalIndexedChunks).toBe(320); // 200 + 120
      expect(result.totalScannedFiles).toBe(118); // 75 + 43
      expect(result.coveragePercentage).toBeCloseTo((80 / 118) * 100);
    });

    it('should handle empty project stats', () => {
      const result = calculateGlobalStats([]);

      expect(result.totalIndexedFiles).toBe(0);
      expect(result.totalIndexedChunks).toBe(0);
      expect(result.totalScannedFiles).toBe(0);
      expect(result.coveragePercentage).toBe(0);
    });
  });

  describe('calculateContentTypeStats', () => {
    it('should aggregate content type statistics', () => {
      const result = calculateContentTypeStats(mockProjectStats);

      expect(result.code.indexed).toBe(50); // 30 + 20
      expect(result.code.scanned).toBe(65); // 40 + 25
      expect(result.doc.indexed).toBe(23); // 15 + 8
      expect(result.doc.scanned).toBe(30); // 20 + 10
      expect(result.config.indexed).toBe(5); // 5 + 0
      expect(result.config.scanned).toBe(15); // 10 + 5
      expect(result.other.indexed).toBe(2); // 0 + 2
      expect(result.other.scanned).toBe(8); // 5 + 3
    });
  });

  describe('calculateMissingFiles', () => {
    it('should calculate missing files per project', () => {
      const result = calculateMissingFiles(mockProjectStats);

      expect(result).toHaveLength(2);
      expect(result[0].project).toBe('/project2');
      expect(result[0].missingCount).toBe(13); // 43 - 30
      expect(result[0].coverage).toBeCloseTo(30 / 43);

      expect(result[1].project).toBe('/project1');
      expect(result[1].missingCount).toBe(25); // 75 - 50
      expect(result[1].coverage).toBeCloseTo(50 / 75);
    });

    it('should sort by missing count descending', () => {
      const result = calculateMissingFiles(mockProjectStats);

      // project2 should come first (13 missing) then project1 (25 missing)
      expect(result[0].missingCount).toBe(13);
      expect(result[1].missingCount).toBe(25);
    });

    it('should handle projects with no missing files', () => {
      const stats = [{
        path: '/project3',
        indexedStats: { totalFiles: 100 },
        scannedFiles: { total: 100 }
      }];

      const result = calculateMissingFiles(stats);
      expect(result).toHaveLength(0);
    });
  });

  describe('identifyStaleProjects', () => {
    it('should identify projects not updated for more than 30 days', () => {
      const result = identifyStaleProjects(mockProjectStats);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('/project2');
    });

    it('should include projects with no lastUpdated date', () => {
      const stats = [{
        path: '/project3',
        indexedStats: { totalFiles: 10, lastUpdated: null },
        scannedFiles: { total: 10 }
      }];

      const result = identifyStaleProjects(stats);
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('/project3');
    });

    it('should exclude recently updated projects', () => {
      const stats = [{
        path: '/project4',
        indexedStats: {
          totalFiles: 10,
          lastUpdated: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 jours
        },
        scannedFiles: { total: 10 }
      }];

      const result = identifyStaleProjects(stats);
      expect(result).toHaveLength(0);
    });
  });

  describe('generateRecommendations', () => {
    it('should generate low coverage recommendation', () => {
      const globalStats = { coveragePercentage: 40 };
      const result = generateRecommendations(globalStats, 0);

      expect(result).toContain('❌ Couverture faible (< 50%). Recommandation: Indexer plus de fichiers.');
    });

    it('should generate moderate coverage recommendation', () => {
      const globalStats = { coveragePercentage: 65 };
      const result = generateRecommendations(globalStats, 0);

      expect(result).toContain('⚠️  Couverture modérée (50-80%). Recommandation: Améliorer la couverture.');
    });

    it('should generate excellent coverage recommendation', () => {
      const globalStats = { coveragePercentage: 90 };
      const result = generateRecommendations(globalStats, 0);

      expect(result).toContain('✅ Excellente couverture (> 80%). Bon travail!');
    });

    it('should include stale projects recommendation', () => {
      const globalStats = { coveragePercentage: 90 };
      const result = generateRecommendations(globalStats, 3);

      expect(result).toContain('🕒 3 projet(s) n\'ont pas été mis à jour depuis plus de 30 jours. Recommandation: Exécuter une réindexation.');
    });

    it('should combine multiple recommendations', () => {
      const globalStats = { coveragePercentage: 40 };
      const result = generateRecommendations(globalStats, 2);

      expect(result).toHaveLength(2);
      expect(result[0]).toContain('❌ Couverture faible (< 50%)');
      expect(result[1]).toContain('🕒 2 projet(s)');
    });
  });
});
