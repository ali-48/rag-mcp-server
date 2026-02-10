/**
 * Tests unitaires pour WorkspaceListener
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as vscode from 'vscode';
import { EventFilter } from '../filters/event.filter.js';
import { EventNormalizer } from '../normalizers/event.normalizer.js';
import { WorkspaceListener } from './workspace.listener.js';

// Mocks
jest.mock('../normalizers/event.normalizer.js');
jest.mock('../filters/event.filter.js');

describe('WorkspaceListener', () => {
  let listener: WorkspaceListener;
  let mockEventNormalizer: jest.Mocked<EventNormalizer>;
  let mockEventFilter: jest.Mocked<EventFilter>;
  let mockOnDidChangeWorkspaceFolders: vscode.EventEmitter<vscode.WorkspaceFoldersChangeEvent>;
  let mockCallback: jest.Mock;

  beforeEach(() => {
    // Réinitialiser les mocks
    jest.clearAllMocks();

    // Créer les mocks
    mockEventNormalizer = {
      normalize: jest.fn().mockReturnValue({
        event_uuid: 'test-uuid',
        event_type: 'workspace',
        timestamp: '2024-01-01T00:00:00.000Z',
        project_id: 'test-project',
        workspace_id: 'test-workspace',
        source: 'vscode',
        version: '1.0.0',
        payload: {
          workspace: {
            folders: [
              {
                name: 'test-folder',
                path: '/test/path',
                index: 0
              }
            ],
            total_folders: 1,
            change_type: 'added'
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

    // Créer le mock d'événement
    mockOnDidChangeWorkspaceFolders = new vscode.EventEmitter<vscode.WorkspaceFoldersChangeEvent>();
    const mockWorkspace = {
      onDidChangeWorkspaceFolders: mockOnDidChangeWorkspaceFolders.event,
      workspaceFolders: [
        {
          name: 'test-folder',
          uri: vscode.Uri.file('/test/path'),
          index: 0
        }
      ]
    } as unknown as typeof vscode.workspace;

    // Mock vscode.workspace
    jest.spyOn(vscode, 'workspace', 'get').mockReturnValue(mockWorkspace);

    // Créer le callback mock
    mockCallback = jest.fn();

    // Créer le listener
    listener = new WorkspaceListener(mockEventFilter, mockEventNormalizer);
  });

  afterEach(() => {
    listener.dispose();
    mockOnDidChangeWorkspaceFolders.dispose();
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

    it('should handle workspace folder added event', async () => {
      // Simuler un événement d'ajout de dossier
      const mockEvent: vscode.WorkspaceFoldersChangeEvent = {
        added: [
          {
            name: 'new-folder',
            uri: vscode.Uri.file('/new/path'),
            index: 1
          }
        ],
        removed: []
      };

      // Déclencher l'événement
      mockOnDidChangeWorkspaceFolders.fire(mockEvent);

      // Attendre le traitement asynchrone
      await new Promise(resolve => setTimeout(resolve, 100));

      // Vérifications
      expect(mockEventFilter.filter).toHaveBeenCalled();
      expect(mockEventNormalizer.normalize).toHaveBeenCalledWith(
        'workspace',
        expect.objectContaining({
          event: mockEvent,
          workspaceFolders: expect.any(Array)
        }),
        'vscode'
      );
      expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
        event_type: 'workspace'
      }));
    });

    it('should handle workspace folder removed event', async () => {
      // Simuler un événement de suppression de dossier
      const mockEvent: vscode.WorkspaceFoldersChangeEvent = {
        added: [],
        removed: [
          {
            name: 'removed-folder',
            uri: vscode.Uri.file('/removed/path'),
            index: 0
          }
        ]
      };

      mockOnDidChangeWorkspaceFolders.fire(mockEvent);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockEventFilter.filter).toHaveBeenCalled();
      expect(mockEventNormalizer.normalize).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalled();
    });

    it('should handle workspace folder changed event', async () => {
      // Simuler un événement de changement de dossier (ajout + suppression)
      const mockEvent: vscode.WorkspaceFoldersChangeEvent = {
        added: [
          {
            name: 'new-folder',
            uri: vscode.Uri.file('/new/path'),
            index: 1
          }
        ],
        removed: [
          {
            name: 'old-folder',
            uri: vscode.Uri.file('/old/path'),
            index: 0
          }
        ]
      };

      mockOnDidChangeWorkspaceFolders.fire(mockEvent);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockEventFilter.filter).toHaveBeenCalled();
      expect(mockEventNormalizer.normalize).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalled();
    });

    it('should ignore event if filtered out', async () => {
      // Configurer le filtre pour rejeter l'événement
      mockEventFilter.filter.mockReturnValue(false);

      const mockEvent: vscode.WorkspaceFoldersChangeEvent = {
        added: [
          {
            name: 'new-folder',
            uri: vscode.Uri.file('/new/path'),
            index: 1
          }
        ],
        removed: []
      };

      mockOnDidChangeWorkspaceFolders.fire(mockEvent);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockEventFilter.filter).toHaveBeenCalled();
      expect(mockEventNormalizer.normalize).not.toHaveBeenCalled();
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Configurer le normalisateur pour lancer une erreur
      mockEventNormalizer.normalize.mockReturnValue(null);

      const mockEvent: vscode.WorkspaceFoldersChangeEvent = {
        added: [
          {
            name: 'new-folder',
            uri: vscode.Uri.file('/new/path'),
            index: 1
          }
        ],
        removed: []
      };

      mockOnDidChangeWorkspaceFolders.fire(mockEvent);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Le callback ne devrait pas être appelé en cas d'erreur
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle empty workspace', async () => {
      // Simuler un workspace vide
      const mockWorkspace = {
        onDidChangeWorkspaceFolders: mockOnDidChangeWorkspaceFolders.event,
        workspaceFolders: []
      } as unknown as typeof vscode.workspace;

      jest.spyOn(vscode, 'workspace', 'get').mockReturnValue(mockWorkspace);

      const mockEvent: vscode.WorkspaceFoldersChangeEvent = {
        added: [
          {
            name: 'first-folder',
            uri: vscode.Uri.file('/first/path'),
            index: 0
          }
        ],
        removed: []
      };

      mockOnDidChangeWorkspaceFolders.fire(mockEvent);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockEventFilter.filter).toHaveBeenCalled();
      expect(mockEventNormalizer.normalize).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalled();
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
        event_type: 'workspace',
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
