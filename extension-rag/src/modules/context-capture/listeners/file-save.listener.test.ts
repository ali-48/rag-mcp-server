/**
 * Tests unitaires pour FileSaveListener
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as vscode from 'vscode';
import { EventFilter } from '../filters/event.filter.js';
import { EventNormalizer } from '../normalizers/event.normalizer.js';
import { FileHasher } from '../utils/file-hasher.js';
import { FileSaveListener } from './file-save.listener.js';

// Mocks
jest.mock('../normalizers/event.normalizer.js');
jest.mock('../filters/event.filter.js');
jest.mock('../utils/file-hasher.js');

describe('FileSaveListener', () => {
  let listener: FileSaveListener;
  let mockEventNormalizer: jest.Mocked<EventNormalizer>;
  let mockEventFilter: jest.Mocked<EventFilter>;
  let mockFileHasher: jest.Mocked<FileHasher>;
  let mockOnDidSaveTextDocument: vscode.EventEmitter<vscode.TextDocument>;
  let mockCallback: jest.Mock;

  beforeEach(() => {
    // Réinitialiser les mocks
    jest.clearAllMocks();

    // Créer les mocks
    mockEventNormalizer = {
      normalize: jest.fn().mockReturnValue({
        event_uuid: 'test-uuid',
        event_type: 'file_save',
        timestamp: '2024-01-01T00:00:00.000Z',
        project_id: 'test-project',
        workspace_id: 'test-workspace',
        source: 'vscode',
        version: '1.0.0',
        payload: {
          file: {
            path: '/test/file.ts',
            language: 'typescript',
            line_count: 100,
            is_untitled: false
          }
        },
        metadata: {
          normalized_at: '2024-01-01T00:00:00.000Z',
          normalizer_version: '1.0.0',
          source_timestamp: 1704067200000
        }
      })
    } as unknown as jest.Mocked<EventNormalizer>;

    mockEventFilter = {
      filter: jest.fn().mockReturnValue(true)
    } as unknown as jest.Mocked<EventFilter>;

    mockFileHasher = {
      getCachedHash: jest.fn().mockReturnValue(null),
      hasFileChanged: jest.fn().mockResolvedValue(true),
      computeHash: jest.fn().mockResolvedValue({
        filePath: '/test/file.ts',
        hash: 'abc123',
        size: 1024,
        lastModified: 1704067200000,
        algorithm: 'sha256',
        computedAt: '2024-01-01T00:00:00.000Z'
      })
    } as unknown as jest.Mocked<FileHasher>;

    // Créer le mock d'événement
    mockOnDidSaveTextDocument = new vscode.EventEmitter<vscode.TextDocument>();
    const mockWorkspace = {
      onDidSaveTextDocument: mockOnDidSaveTextDocument.event
    } as unknown as typeof vscode.workspace;

    // Mock vscode.workspace
    jest.spyOn(vscode, 'workspace', 'get').mockReturnValue(mockWorkspace);

    // Créer le callback mock
    mockCallback = jest.fn();

    // Créer le listener
    listener = new FileSaveListener(mockEventFilter, mockEventNormalizer, mockFileHasher);
  });

  afterEach(() => {
    listener.dispose();
    mockOnDidSaveTextDocument.dispose();
  });

  describe('initialization', () => {
    it('should start successfully', async () => {
      await listener.start();
      expect(listener.isActive()).toBe(true);
    });

    it('should add callback when onEventCaptured is called', () => {
      listener.onEventCaptured(mockCallback);
      const stats = listener.getStats();
      expect(stats.total_callbacks).toBe(1);
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      await listener.start();
      listener.onEventCaptured(mockCallback);
    });

    it('should handle file save event', async () => {
      // Simuler un document
      const mockDocument = {
        uri: {
          fsPath: '/test/file.ts'
        },
        languageId: 'typescript',
        lineCount: 100,
        isUntitled: false,
        getText: () => 'console.log("test");'
      } as unknown as vscode.TextDocument;

      // Déclencher l'événement
      mockOnDidSaveTextDocument.fire(mockDocument);

      // Attendre le traitement asynchrone
      await new Promise(resolve => setTimeout(resolve, 100));

      // Vérifications
      expect(mockFileHasher.hasFileChanged).toHaveBeenCalledWith('/test/file.ts', null);
      expect(mockEventFilter.filter).toHaveBeenCalled();
      expect(mockEventNormalizer.normalize).toHaveBeenCalledWith(
        'file_save',
        expect.objectContaining({
          document: mockDocument
        }),
        'vscode'
      );
      expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
        event_type: 'file_save'
      }));
    });

    it('should ignore event if file has not changed', async () => {
      // Configurer le mock pour retourner false (fichier non changé)
      mockFileHasher.hasFileChanged.mockResolvedValue(false);

      const mockDocument = {
        uri: {
          fsPath: '/test/file.ts'
        },
        languageId: 'typescript',
        lineCount: 100,
        isUntitled: false
      } as unknown as vscode.TextDocument;

      mockOnDidSaveTextDocument.fire(mockDocument);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockFileHasher.hasFileChanged).toHaveBeenCalled();
      expect(mockEventFilter.filter).not.toHaveBeenCalled();
      expect(mockEventNormalizer.normalize).not.toHaveBeenCalled();
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should ignore event if filtered out', async () => {
      // Configurer le filtre pour rejeter l'événement
      mockEventFilter.filter.mockReturnValue(false);

      const mockDocument = {
        uri: {
          fsPath: '/test/file.ts'
        },
        languageId: 'typescript',
        lineCount: 100,
        isUntitled: false
      } as unknown as vscode.TextDocument;

      mockOnDidSaveTextDocument.fire(mockDocument);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockFileHasher.hasFileChanged).toHaveBeenCalled();
      expect(mockEventFilter.filter).toHaveBeenCalled();
      expect(mockEventNormalizer.normalize).not.toHaveBeenCalled();
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Configurer le hasher pour lancer une erreur
      mockFileHasher.hasFileChanged.mockRejectedValue(new Error('Hash error'));

      const mockDocument = {
        uri: {
          fsPath: '/test/file.ts'
        },
        languageId: 'typescript',
        lineCount: 100,
        isUntitled: false
      } as unknown as vscode.TextDocument;

      // Ne devrait pas lancer d'erreur
      mockOnDidSaveTextDocument.fire(mockDocument);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Le callback ne devrait pas être appelé en cas d'erreur
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('disposal', () => {
    it('should dispose resources', async () => {
      await listener.start();
      expect(listener.isActive()).toBe(true);
      listener.dispose();
      expect(listener.isActive()).toBe(false);
    });

    it('should handle multiple disposals', () => {
      listener.dispose();
      listener.dispose(); // Deuxième appel ne devrait pas lancer d'erreur
      expect(() => listener.dispose()).not.toThrow();
    });
  });

  describe('statistics', () => {
    it('should return statistics', async () => {
      await listener.start();
      listener.onEventCaptured(mockCallback);

      const stats = listener.getStats();
      expect(stats).toEqual({
        is_active: true,
        event_type: 'file_save',
        total_callbacks: 1,
        total_disposables: 1
      });
    });

    it('should update statistics after adding multiple callbacks', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();

      listener.onEventCaptured(callback1);
      listener.onEventCaptured(callback2);
      listener.onEventCaptured(callback3);

      const stats = listener.getStats();
      expect(stats.total_callbacks).toBe(3);
    });

    it('should clear callbacks after stop', async () => {
      await listener.start();
      listener.onEventCaptured(mockCallback);

      expect(listener.getStats().total_callbacks).toBe(1);

      await listener.stop();

      const stats = listener.getStats();
      expect(stats.total_callbacks).toBe(0);
      expect(stats.is_active).toBe(false);
    });
  });
});
