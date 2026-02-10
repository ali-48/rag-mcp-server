/**
 * Tests unitaires pour EventNormalizer
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { EventNormalizer } from './event.normalizer.js';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid-1234')
}));

// Mock logger
jest.mock('../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('EventNormalizer', () => {
  let normalizer: EventNormalizer;

  beforeEach(() => {
    // Réinitialiser les mocks
    jest.clearAllMocks();

    // Créer le normalisateur
    normalizer = new EventNormalizer();
  });

  afterEach(() => {
    // Réinitialiser le normalisateur
    normalizer.reset();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await normalizer.initialize();
      expect(normalizer.isReady()).toBe(true);

      const ids = normalizer.getIds();
      expect(ids.projectId).toBeTruthy();
      expect(ids.workspaceId).toBeTruthy();
      expect(ids.workspaceId).toBe('test-uuid-1234'); // UUID mocké
    });

    it('should generate different project IDs for different paths', async () => {
      // Sauvegarder le cwd original
      const originalCwd = process.cwd;

      try {
        // Mock process.cwd pour retourner différents chemins
        (process.cwd as jest.Mock) = jest.fn()
          .mockReturnValueOnce('/path/to/project1')
          .mockReturnValueOnce('/path/to/project2');

        // Créer deux normalisateurs
        const normalizer1 = new EventNormalizer();
        const normalizer2 = new EventNormalizer();

        await normalizer1.initialize();
        await normalizer2.initialize();

        const ids1 = normalizer1.getIds();
        const ids2 = normalizer2.getIds();

        expect(ids1.projectId).not.toBe(ids2.projectId);
        expect(ids1.workspaceId).not.toBe(ids2.workspaceId);

      } finally {
        // Restaurer le cwd original
        process.cwd = originalCwd;
      }
    });

    it('should not normalize before initialization', () => {
      const result = normalizer.normalize('test', {});
      expect(result).toBeNull();
    });
  });

  describe('normalization', () => {
    beforeEach(async () => {
      await normalizer.initialize();
    });

    it('should normalize file_save event', () => {
      const rawData = {
        document: {
          uri: { fsPath: '/test/file.ts' },
          languageId: 'typescript',
          lineCount: 100,
          isUntitled: false
        },
        selection: { start: { line: 0, character: 0 } },
        visibleRanges: [{ start: { line: 0, character: 0 }, end: { line: 10, character: 0 } }],
        workspaceRoot: '/test'
      };

      const result = normalizer.normalize('file_save', rawData);

      expect(result).not.toBeNull();
      expect(result?.event_type).toBe('file_save');
      expect(result?.event_uuid).toBe('test-uuid-1234');
      expect(result?.source).toBe('vscode');
      expect(result?.version).toBe('1.0.0');
      expect(result?.payload.file.path).toBe('/test/file.ts');
      expect(result?.payload.file.language).toBe('typescript');
      expect(result?.payload.file.line_count).toBe(100);
      expect(result?.payload.file.is_untitled).toBe(false);
      expect(result?.payload.workspace.root).toBe('/test');
      expect(result?.metadata.normalizer_version).toBe('1.0.0');
    });

    it('should normalize diagnostic event', () => {
      const rawData = {
        diagnostic: {
          severity: 1,
          message: 'Test error',
          code: 'TS1234',
          source: 'typescript',
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 10 }
          }
        },
        uri: { fsPath: '/test/file.ts' },
        languageId: 'typescript',
        workspaceRoot: '/test'
      };

      const result = normalizer.normalize('diagnostic', rawData);

      expect(result).not.toBeNull();
      expect(result?.event_type).toBe('diagnostic');
      expect(result?.payload.diagnostic.severity).toBe(1);
      expect(result?.payload.diagnostic.message).toBe('Test error');
      expect(result?.payload.diagnostic.code).toBe('TS1234');
      expect(result?.payload.diagnostic.source).toBe('typescript');
      expect(result?.payload.file.path).toBe('/test/file.ts');
      expect(result?.payload.file.language).toBe('typescript');
    });

    it('should normalize workspace event', () => {
      const rawData = {
        added: [
          {
            name: 'new-folder',
            uri: { fsPath: '/new/path', toString: () => 'file:///new/path' }
          }
        ],
        removed: [
          {
            name: 'old-folder',
            uri: { fsPath: '/old/path', toString: () => 'file:///old/path' }
          }
        ],
        total: 2
      };

      const result = normalizer.normalize('workspace', rawData);

      expect(result).not.toBeNull();
      expect(result?.event_type).toBe('workspace');
      expect(result?.payload.workspace.added).toHaveLength(1);
      expect(result?.payload.workspace.added[0].name).toBe('new-folder');
      expect(result?.payload.workspace.added[0].path).toBe('/new/path');
      expect(result?.payload.workspace.removed).toHaveLength(1);
      expect(result?.payload.workspace.removed[0].name).toBe('old-folder');
      expect(result?.payload.workspace.removed[0].path).toBe('/old/path');
      expect(result?.payload.workspace.total).toBe(2);
    });

    it('should normalize generic event', () => {
      const rawData = {
        test: 'data',
        number: 123,
        nested: { key: 'value' }
      };

      const result = normalizer.normalize('unknown_type', rawData);

      expect(result).not.toBeNull();
      expect(result?.event_type).toBe('unknown_type');
      expect(result?.payload.raw_data.test).toBe('data');
      expect(result?.payload.raw_data.number).toBe(123);
      expect(result?.payload.raw_data.nested.key).toBe('value');
      expect(result?.payload.data_type).toBe('object');
      expect(result?.payload.data_keys).toEqual(['test', 'number', 'nested']);
    });

    it('should handle null/undefined data', () => {
      const result = normalizer.normalize('test', null);
      expect(result).not.toBeNull();
      expect(result?.payload.raw_data).toBeNull();
    });

    it('should sanitize sensitive data', () => {
      const rawData = {
        path: '/home/user/secret/file.ts',
        token: 'secret-token-123',
        password: 'my-password',
        apiKey: 'api-key-456',
        normalData: 'safe'
      };

      const result = normalizer.normalize('test', rawData);

      expect(result).not.toBeNull();
      expect(result?.payload.raw_data.path).toBe('~/secret/file.ts'); // Masqué
      expect(result?.payload.raw_data.token).toBe('[REDACTED]');
      expect(result?.payload.raw_data.password).toBe('[REDACTED]');
      expect(result?.payload.raw_data.apiKey).toBe('[REDACTED]');
      expect(result?.payload.raw_data.normalData).toBe('safe'); // Non masqué
    });

    it('should handle sanitization errors gracefully', () => {
      // Créer un objet circulaire pour provoquer une erreur de JSON.stringify
      const circularData: any = { test: 'data' };
      circularData.self = circularData;

      const result = normalizer.normalize('test', circularData);

      expect(result).not.toBeNull();
      expect(result?.payload.raw_data.error).toBe('unable_to_sanitize');
    });

    it('should accept custom source', () => {
      const rawData = { test: 'data' };
      const result = normalizer.normalize('test', rawData, 'custom-source');

      expect(result?.source).toBe('custom-source');
    });
  });

  describe('edge cases', () => {
    beforeEach(async () => {
      await normalizer.initialize();
    });

    it('should handle missing document in file_save', () => {
      const result = normalizer.normalize('file_save', {});
      expect(result?.payload.file.path).toBe('');
      expect(result?.payload.file.language).toBe('');
      expect(result?.payload.file.line_count).toBe(0);
      expect(result?.payload.file.is_untitled).toBe(false);
    });

    it('should handle missing diagnostic in diagnostic event', () => {
      const result = normalizer.normalize('diagnostic', {});
      expect(result?.payload.diagnostic.severity).toBe(0);
      expect(result?.payload.diagnostic.message).toBe('');
      expect(result?.payload.diagnostic.code).toBe('');
      expect(result?.payload.diagnostic.source).toBe('');
      expect(result?.payload.diagnostic.range).toBeNull();
    });

    it('should handle missing workspace data', () => {
      const result = normalizer.normalize('workspace', {});
      expect(result?.payload.workspace.added).toEqual([]);
      expect(result?.payload.workspace.removed).toEqual([]);
      expect(result?.payload.workspace.total).toBe(0);
    });

    it('should handle partial workspace data', () => {
      const rawData = {
        added: [{ name: 'folder', uri: { fsPath: '/path' } }]
        // removed manquant
      };

      const result = normalizer.normalize('workspace', rawData);
      expect(result?.payload.workspace.added).toHaveLength(1);
      expect(result?.payload.workspace.removed).toEqual([]);
    });
  });

  describe('reset', () => {
    it('should reset the normalizer', async () => {
      await normalizer.initialize();
      expect(normalizer.isReady()).toBe(true);

      const idsBefore = normalizer.getIds();
      expect(idsBefore.projectId).toBeTruthy();
      expect(idsBefore.workspaceId).toBeTruthy();

      normalizer.reset();

      expect(normalizer.isReady()).toBe(false);
      expect(normalizer.getIds().projectId).toBe('');
      expect(normalizer.getIds().workspaceId).toBe('');
    });

    it('should not normalize after reset', async () => {
      await normalizer.initialize();
      normalizer.reset();

      const result = normalizer.normalize('test', {});
      expect(result).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle initialization errors', async () => {
      // Mock uuid.v4 pour lancer une erreur
      const { v4 } = require('uuid');
      v4.mockImplementationOnce(() => {
        throw new Error('UUID generation failed');
      });

      const newNormalizer = new EventNormalizer();
      await expect(newNormalizer.initialize()).rejects.toThrow('UUID generation failed');
    });

    it('should handle normalization errors gracefully', () => {
      // Mock uuid.v4 pour lancer une erreur lors de la normalisation
      const { v4 } = require('uuid');
      v4.mockImplementationOnce(() => {
        throw new Error('UUID generation failed');
      });

      const result = normalizer.normalize('test', {});
      expect(result).toBeNull();
    });
  });

  describe('timestamp generation', () => {
    it('should generate valid timestamps', () => {
      const before = new Date().toISOString();
      const result = normalizer.normalize('test', {});
      const after = new Date().toISOString();

      expect(result?.timestamp).toBeTruthy();
      expect(result?.metadata.normalized_at).toBeTruthy();
      expect(result?.metadata.source_timestamp).toBeGreaterThan(0);

      // Vérifier que le timestamp est dans une plage raisonnable
      const eventTime = new Date(result!.timestamp).getTime();
      const beforeTime = new Date(before).getTime();
      const afterTime = new Date(after).getTime();

      expect(eventTime).toBeGreaterThanOrEqual(beforeTime - 1000); // Marge d'erreur
      expect(eventTime).toBeLessThanOrEqual(afterTime + 1000); // Marge d'erreur
    });
  });
});
