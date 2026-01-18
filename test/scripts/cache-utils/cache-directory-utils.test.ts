// test/scripts/cache-utils/cache-directory-utils.test.ts
// Tests unitaires pour cache-directory-utils

import * as fs from 'fs';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CacheStructureOptions,
  createASTCacheStructure,
  createCacheDirectories,
  createCacheReadme,
  DEFAULT_AST_CACHE_OPTIONS,
  generateDefaultASTCacheReadme,
  setupGitignoreForCache
} from '../../../scripts/cache-utils/cache-directory-utils';

// Mocks
vi.mock('fs');
vi.mock('path');

describe('cache-directory-utils', () => {
  const mockOptions: CacheStructureOptions = {
    rootDir: 'test-audit',
    cacheDirName: 'test-cache',
    createGitignore: true,
    createReadme: true,
    gitignoreContent: '# Test cache\ntest-cache/\n'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Nettoyer les mocks
    vi.resetAllMocks();
  });

  describe('createCacheDirectories', () => {
    it('should create root directory when it does not exist', () => {
      const existsSyncMock = vi.mocked(fs.existsSync);
      const mkdirSyncMock = vi.mocked(fs.mkdirSync);

      existsSyncMock.mockReturnValue(false);

      const result = createCacheDirectories(mockOptions);

      expect(mkdirSyncMock).toHaveBeenCalledWith(mockOptions.rootDir, { recursive: true });
      expect(result).toContain(mockOptions.rootDir);
    });

    it('should create cache directory when it does not exist', () => {
      const existsSyncMock = vi.mocked(fs.existsSync);
      const mkdirSyncMock = vi.mocked(fs.mkdirSync);

      // Simuler que le répertoire racine existe mais pas le cache
      existsSyncMock.mockReturnValueOnce(true).mockReturnValueOnce(false);

      const result = createCacheDirectories(mockOptions);

      const cacheDir = `${mockOptions.rootDir}/${mockOptions.cacheDirName}`;
      expect(mkdirSyncMock).toHaveBeenCalledWith(cacheDir, { recursive: true });
      expect(result).toContain(cacheDir);
    });

    it('should create subdirectories for cache', () => {
      const existsSyncMock = vi.mocked(fs.existsSync);
      const mkdirSyncMock = vi.mocked(fs.mkdirSync);

      // Simuler que les répertoires existent déjà
      existsSyncMock.mockReturnValue(true);

      const result = createCacheDirectories(mockOptions);

      // Ne devrait pas créer de répertoires s'ils existent déjà
      expect(mkdirSyncMock).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('setupGitignoreForCache', () => {
    it('should create gitignore file when it does not exist', () => {
      const existsSyncMock = vi.mocked(fs.existsSync);
      const readFileSyncMock = vi.mocked(fs.readFileSync);
      const writeFileSyncMock = vi.mocked(fs.writeFileSync);

      existsSyncMock.mockReturnValue(false);
      readFileSyncMock.mockReturnValue('');

      const result = setupGitignoreForCache(mockOptions);

      const gitignorePath = path.join(mockOptions.rootDir, '.gitignore');
      expect(writeFileSyncMock).toHaveBeenCalledWith(
        gitignorePath,
        expect.stringContaining('# Test cache'),
        'utf8'
      );
      expect(result).toBe(true);
    });

    it('should not update gitignore when cache is already ignored', () => {
      const existsSyncMock = vi.mocked(fs.existsSync);
      const readFileSyncMock = vi.mocked(fs.readFileSync);
      const writeFileSyncMock = vi.mocked(fs.writeFileSync);

      existsSyncMock.mockReturnValue(true);
      readFileSyncMock.mockReturnValue('# Test cache\ntest-cache/\n');

      const result = setupGitignoreForCache(mockOptions);

      expect(writeFileSyncMock).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should append to existing gitignore content', () => {
      const existsSyncMock = vi.mocked(fs.existsSync);
      const readFileSyncMock = vi.mocked(fs.readFileSync);
      const writeFileSyncMock = vi.mocked(fs.writeFileSync);

      existsSyncMock.mockReturnValue(true);
      readFileSyncMock.mockReturnValue('# Existing content\nnode_modules/\n');

      const result = setupGitignoreForCache(mockOptions);

      expect(writeFileSyncMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('# Existing content'),
        'utf8'
      );
      expect(writeFileSyncMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('# Test cache'),
        'utf8'
      );
      expect(result).toBe(true);
    });
  });

  describe('createCacheReadme', () => {
    it('should create README file when it does not exist', () => {
      const existsSyncMock = vi.mocked(fs.existsSync);
      const writeFileSyncMock = vi.mocked(fs.writeFileSync);

      existsSyncMock.mockReturnValue(false);

      const result = createCacheReadme(mockOptions);

      const readmePath = path.join(mockOptions.rootDir, 'README_AST_CACHE.md');
      expect(writeFileSyncMock).toHaveBeenCalledWith(
        readmePath,
        expect.stringContaining('# Cache AST - Documentation'),
        'utf8'
      );
      expect(result).toBe(true);
    });

    it('should not create README file when it already exists', () => {
      const existsSyncMock = vi.mocked(fs.existsSync);
      const writeFileSyncMock = vi.mocked(fs.writeFileSync);

      existsSyncMock.mockReturnValue(true);

      const result = createCacheReadme(mockOptions);

      expect(writeFileSyncMock).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('generateDefaultASTCacheReadme', () => {
    it('should generate README content with expected sections', () => {
      const content = generateDefaultASTCacheReadme();

      expect(content).toContain('# Cache AST - Documentation');
      expect(content).toContain('## Introduction');
      expect(content).toContain('## Fonctionnalités');
      expect(content).toContain('## Utilisation');
      expect(content).toContain('## Options de configuration');
      expect(content).toContain('## Intégration avec le code-mapper');
      expect(content).toContain('## Commandes CLI');
      expect(content).toContain('## Dépannage');
      expect(content).toContain('## Performance');
      expect(content).toContain('## Bonnes pratiques');
      expect(content).toContain('## Limitations');
      expect(content).toContain('## Évolution future');
    });

    it('should include TypeScript code examples', () => {
      const content = generateDefaultASTCacheReadme();

      expect(content).toContain('```typescript');
      expect(content).toContain('createASTCache');
      expect(content).toContain('astCache.get');
      expect(content).toContain('astCache.save');
    });

    it('should include CLI command examples', () => {
      const content = generateDefaultASTCacheReadme();

      expect(content).toContain('```bash');
      expect(content).toContain('npx tsx scripts/integrate-ast-cache.ts');
    });
  });

  describe('createASTCacheStructure', () => {
    it('should call all three functions when options are enabled', () => {
      const createCacheDirectoriesSpy = vi.spyOn(
        require('../../../scripts/cache-utils/cache-directory-utils'),
        'createCacheDirectories'
      );
      const setupGitignoreForCacheSpy = vi.spyOn(
        require('../../../scripts/cache-utils/cache-directory-utils'),
        'setupGitignoreForCache'
      );
      const createCacheReadmeSpy = vi.spyOn(
        require('../../../scripts/cache-utils/cache-directory-utils'),
        'createCacheReadme'
      );

      createCacheDirectoriesSpy.mockReturnValue(['dir1', 'dir2']);
      setupGitignoreForCacheSpy.mockReturnValue(true);
      createCacheReadmeSpy.mockReturnValue(true);

      const result = createASTCacheStructure(mockOptions);

      expect(createCacheDirectoriesSpy).toHaveBeenCalledWith(mockOptions);
      expect(setupGitignoreForCacheSpy).toHaveBeenCalledWith(mockOptions);
      expect(createCacheReadmeSpy).toHaveBeenCalledWith(mockOptions);

      expect(result).toEqual({
        directories: ['dir1', 'dir2'],
        gitignoreUpdated: true,
        readmeCreated: true
      });

      createCacheDirectoriesSpy.mockRestore();
      setupGitignoreForCacheSpy.mockRestore();
      createCacheReadmeSpy.mockRestore();
    });

    it('should skip gitignore when createGitignore is false', () => {
      const options: CacheStructureOptions = {
        ...mockOptions,
        createGitignore: false
      };

      const createCacheDirectoriesSpy = vi.spyOn(
        require('../../../scripts/cache-utils/cache-directory-utils'),
        'createCacheDirectories'
      );
      const setupGitignoreForCacheSpy = vi.spyOn(
        require('../../../scripts/cache-utils/cache-directory-utils'),
        'setupGitignoreForCache'
      );
      const createCacheReadmeSpy = vi.spyOn(
        require('../../../scripts/cache-utils/cache-directory-utils'),
        'createCacheReadme'
      );

      createCacheDirectoriesSpy.mockReturnValue(['dir1']);
      createCacheReadmeSpy.mockReturnValue(false);

      const result = createASTCacheStructure(options);

      expect(createCacheDirectoriesSpy).toHaveBeenCalledWith(options);
      expect(setupGitignoreForCacheSpy).not.toHaveBeenCalled();
      expect(createCacheReadmeSpy).toHaveBeenCalledWith(options);

      expect(result.gitignoreUpdated).toBe(false);

      createCacheDirectoriesSpy.mockRestore();
      setupGitignoreForCacheSpy.mockRestore();
      createCacheReadmeSpy.mockRestore();
    });

    it('should skip readme when createReadme is false', () => {
      const options: CacheStructureOptions = {
        ...mockOptions,
        createReadme: false
      };

      const createCacheDirectoriesSpy = vi.spyOn(
        require('../../../scripts/cache-utils/cache-directory-utils'),
        'createCacheDirectories'
      );
      const setupGitignoreForCacheSpy = vi.spyOn(
        require('../../../scripts/cache-utils/cache-directory-utils'),
        'setupGitignoreForCache'
      );
      const createCacheReadmeSpy = vi.spyOn(
        require('../../../scripts/cache-utils/cache-directory-utils'),
        'createCacheReadme'
      );

      createCacheDirectoriesSpy.mockReturnValue(['dir1']);
      setupGitignoreForCacheSpy.mockReturnValue(true);

      const result = createASTCacheStructure(options);

      expect(createCacheDirectoriesSpy).toHaveBeenCalledWith(options);
      expect(setupGitignoreForCacheSpy).toHaveBeenCalledWith(options);
      expect(createCacheReadmeSpy).not.toHaveBeenCalled();

      expect(result.readmeCreated).toBe(false);

      createCacheDirectoriesSpy.mockRestore();
      setupGitignoreForCacheSpy.mockRestore();
      createCacheReadmeSpy.mockRestore();
    });
  });

  describe('DEFAULT_AST_CACHE_OPTIONS', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_AST_CACHE_OPTIONS).toEqual({
        rootDir: 'audit',
        cacheDirName: 'ast-cache',
        createGitignore: true,
        createReadme: true,
        gitignoreContent: '# Cache AST\nast-cache/\n',
        readmeContent: undefined
      });
    });
  });
});
