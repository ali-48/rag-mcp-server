/**
 * Tests d'intégration pour le flux complet de capture
 *
 * Teste l'intégration entre les écouteurs, le filtre et le normalisateur
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as vscode from 'vscode';
import { EventFilter } from './filters/event.filter.js';
import { DiagnosticsListener } from './listeners/diagnostics.listener.js';
import { FileSaveListener } from './listeners/file-save.listener.js';
import { WorkspaceListener } from './listeners/workspace.listener.js';
import { EventNormalizer } from './normalizers/event.normalizer.js';
import { FileHasher } from './utils/file-hasher.js';

// Mocks
jest.mock('./normalizers/event.normalizer.js');
jest.mock('./filters/event.filter.js');
jest.mock('./utils/file-hasher.js');
jest.mock('./utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Capture Flow Integration', () => {
  let mockEventNormalizer: jest.Mocked<EventNormalizer>;
  let mockEventFilter: jest.Mocked<EventFilter>;
  let mockFileHasher: jest.Mocked<FileHasher>;
  let mockOnDidSaveTextDocument: vscode.EventEmitter<vscode.TextDocument>;
  let mockOnDidChangeDiagnostics: vscode.EventEmitter<vscode.Uri>;
  let mockOnDidChangeWorkspaceFolders: vscode.EventEmitter<vscode.WorkspaceFoldersChangeEvent>;

  beforeEach(() => {
    // Réinitialiser les mocks
    jest.clearAllMocks();

    // Créer les mocks
    mockEventNormalizer = {
      initialize: jest.fn().mockResolvedValue(undefined),
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
      }),
      isReady: jest.fn().mockReturnValue(true),
      getIds: jest.fn().mockReturnValue({
        projectId: 'test-project',
        workspaceId: 'test-workspace'
      }),
      reset: jest.fn()
    } as unknown as jest.Mocked<EventNormalizer>;

    mockEventFilter = {
      filter: jest.fn().mockReturnValue(true),
      reset: jest.fn(),
      getStats: jest.fn().mockReturnValue({
        total_event_types: 3,
        ignored_event_types: 4,
        last_event_times: {}
      })
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

    // Créer les mocks d'événements
    mockOnDidSaveTextDocument = new vscode.EventEmitter<vscode.TextDocument>();
    mockOnDidChangeDiagnostics = new vscode.EventEmitter<vscode.Uri>();
    mockOnDidChangeWorkspaceFolders = new vscode.EventEmitter<vscode.WorkspaceFoldersChangeEvent>();

    // Mock vscode.workspace
    const mockWorkspace = {
      onDidSaveTextDocument: mockOnDidSaveTextDocument.event,
      onDidChangeDiagnostics: mockOnDidChangeDiagnostics.event,
      onDidChangeWorkspaceFolders: mockOnDidChangeWorkspaceFolders.event,
      workspaceFolders: [
        {
          name: 'test-folder',
          uri: vscode.Uri.file('/test/path'),
          index: 0
        }
      ]
    } as unknown as typeof vscode.workspace;

    // Mock vscode.languages
    const mockLanguages = {
      getLanguages: jest.fn().mockReturnValue(['typescript', 'javascript']),
      getDiagnostics: jest.fn().mockReturnValue([
        [vscode.Uri.file('/test/file.ts'), [{
          severity: vscode.DiagnosticSeverity.Error,
          message: 'Test error',
          code: 'TS1234',
          source: 'typescript',
          range: new vscode.Range(0, 0, 0, 10)
        }]]
      ])
    };

    jest.spyOn(vscode, 'workspace', 'get').mockReturnValue(mockWorkspace);
    jest.spyOn(vscode, 'languages', 'get').mockReturnValue(mockLanguages);
  });

  afterEach(() => {
    mockOnDidSaveTextDocument.dispose();
    mockOnDidChangeDiagnostics.dispose();
    mockOnDidChangeWorkspaceFolders.dispose();
  });

  describe('complete capture flow', () => {
    it('should capture and normalize file_save event', async () => {
      // Créer les écouteurs
      const fileSaveListener = new FileSaveListener(mockEventFilter, mockEventNormalizer, mockFileHasher);
      const capturedEvents: any[] = [];

      // Initialiser le normalisateur
      await mockEventNormalizer.initialize();

      // Démarrer l'écouteur
      await fileSaveListener.start();
      fileSaveListener.onEventCaptured((event) => {
        capturedEvents.push(event);
      });

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
      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].event_type).toBe('file_save');
      expect(capturedEvents[0].payload.file.path).toBe('/test/file.ts');

      // Nettoyer
      fileSaveListener.dispose();
    });

    it('should capture and normalize diagnostic event', async () => {
      // Créer l'écouteur
      const diagnosticsListener = new DiagnosticsListener(mockEventFilter, mockEventNormalizer);
      const capturedEvents: any[] = [];

      // Initialiser le normalisateur
      await mockEventNormalizer.initialize();

      // Démarrer l'écouteur
      await diagnosticsListener.start();
      diagnosticsListener.onEventCaptured((event) => {
        capturedEvents.push(event);
      });

      // Déclencher l'événement
      mockOnDidChangeDiagnostics.fire(vscode.Uri.file('/test/file.ts'));

      // Attendre le traitement asynchrone
      await new Promise(resolve => setTimeout(resolve, 100));

      // Vérifications
      expect(mockEventFilter.filter).toHaveBeenCalled();
      expect(mockEventNormalizer.normalize).toHaveBeenCalledWith(
        'diagnostic',
        expect.objectContaining({
          diagnostic: expect.objectContaining({
            severity: 1,
            message: 'Test error'
          })
        }),
        'vscode'
      );
      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].event_type).toBe('diagnostic');

      // Nettoyer
      diagnosticsListener.dispose();
    });

    it('should capture and normalize workspace event', async () => {
      // Créer l'écouteur
      const workspaceListener = new WorkspaceListener(mockEventFilter, mockEventNormalizer);
      const capturedEvents: any[] = [];

      // Initialiser le normalisateur
      await mockEventNormalizer.initialize();

      // Démarrer l'écouteur
      await workspaceListener.start();
      workspaceListener.onEventCaptured((event) => {
        capturedEvents.push(event);
      });

      // Simuler un événement workspace
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
      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].event_type).toBe('workspace');

      // Nettoyer
      workspaceListener.dispose();
    });
  });

  describe('filter integration', () => {
    it('should filter out insignificant events', async () => {
      // Configurer le filtre pour rejeter l'événement
      mockEventFilter.filter.mockReturnValue(false);

      // Créer l'écouteur
      const fileSaveListener = new FileSaveListener(mockEventFilter, mockEventNormalizer, mockFileHasher);
      const capturedEvents: any[] = [];

      // Initialiser le normalisateur
      await mockEventNormalizer.initialize();

      // Démarrer l'écouteur
      await fileSaveListener.start();
      fileSaveListener.onEventCaptured((event) => {
        capturedEvents.push(event);
      });

      // Simuler un document
      const mockDocument = {
        uri: {
          fsPath: '/test/file.ts'
        },
        languageId: 'typescript',
        lineCount: 100,
        isUntitled: false
      } as unknown as vscode.TextDocument;

      // Déclencher l'événement
      mockOnDidSaveTextDocument.fire(mockDocument);

      // Attendre le traitement asynchrone
      await new Promise(resolve => setTimeout(resolve, 100));

      // Vérifications
      expect(mockEventFilter.filter).toHaveBeenCalled();
      expect(mockEventNormalizer.normalize).not.toHaveBeenCalled(); // Ne devrait pas normaliser
      expect(capturedEvents).toHaveLength(0); // Ne devrait pas capturer

      // Nettoyer
      fileSaveListener.dispose();
    });

    it('should filter out unchanged files', async () => {
      // Configurer le hasher pour indiquer que le fichier n'a pas changé
      mockFileHasher.hasFileChanged.mockResolvedValue(false);

      // Créer l'écouteur
      const fileSaveListener = new FileSaveListener(mockEventFilter, mockEventNormalizer, mockFileHasher);
      const capturedEvents: any[] = [];

      // Initialiser le normalisateur
      await mockEventNormalizer.initialize();

      // Démarrer l'écouteur
      await fileSaveListener.start();
      fileSaveListener.onEventCaptured((event) => {
        capturedEvents.push(event);
      });

      // Simuler un document
      const mockDocument = {
        uri: {
          fsPath: '/test/file.ts'
        },
        languageId: 'typescript',
        lineCount: 100,
        isUntitled: false
      } as unknown as vscode.TextDocument;

      // Déclencher l'événement
      mockOnDidSaveTextDocument.fire(mockDocument);

      // Attendre le traitement asynchrone
      await new Promise(resolve => setTimeout(resolve, 100));

      // Vérifications
      expect(mockFileHasher.hasFileChanged).toHaveBeenCalled();
      expect(mockEventFilter.filter).not.toHaveBeenCalled(); // Ne devrait pas filtrer
      expect(mockEventNormalizer.normalize).not.toHaveBeenCalled(); // Ne devrait pas normaliser
      expect(capturedEvents).toHaveLength(0); // Ne devrait pas capturer

      // Nettoyer
      fileSaveListener.dispose();
    });
  });

  describe('error handling in flow', () => {
    it('should handle normalization errors gracefully', async () => {
      // Configurer le normalisateur pour lancer une erreur
      mockEventNormalizer.normalize.mockReturnValue(null);

      // Créer l'écouteur
      const fileSaveListener = new FileSaveListener(mockEventFilter, mockEventNormalizer, mockFileHasher);
      const capturedEvents: any[] = [];

      // Initialiser le normalisateur
      await mockEventNormalizer.initialize();

      // Démarrer l'écouteur
      await fileSaveListener.start();
      fileSaveListener.onEventCaptured((event) => {
        capturedEvents.push(event);
      });

      // Simuler un document
      const mockDocument = {
        uri: {
          fsPath: '/test/file.ts'
        },
        languageId: 'typescript',
        lineCount: 100,
        isUntitled: false
      } as unknown as vscode.TextDocument;

      // Déclencher l'événement
      mockOnDidSaveTextDocument.fire(mockDocument);

      // Attendre le traitement asynchrone
      await new Promise(resolve => setTimeout(resolve, 100));

      // Vérifications
      expect(mockFileHasher.hasFileChanged).toHaveBeenCalled();
      expect(mockEventFilter.filter).toHaveBeenCalled();
      expect(mockEventNormalizer.normalize).toHaveBeenCalled();
      expect(capturedEvents).toHaveLength(0); // Ne devrait pas capturer en cas d'erreur

      // Nettoyer
      fileSaveListener.dispose();
    });

    it('should handle filter errors gracefully', async () => {
      // Configurer le filtre pour lancer une erreur
      mockEventFilter.filter.mockImplementation(() => {
        throw new Error('Filter error');
      });

      // Créer l'écouteur
      const fileSaveListener = new FileSaveListener(mockEventFilter, mockEventNormalizer, mockFileHasher);
      const capturedEvents: any[] = [];

      // Initialiser le normalisateur
      await mockEventNormalizer.initialize();

      // Démarrer l'écouteur
      await fileSaveListener.start();
      fileSaveListener.onEventCaptured((event) => {
        capturedEvents.push(event);
      });

      // Simuler un document
      const mockDocument = {
        uri: {
          fsPath: '/test/file.ts'
        },
        languageId: 'typescript',
        lineCount: 100,
        isUntitled: false
      } as unknown as vscode.TextDocument;

      // Déclencher l'événement
      mockOnDidSaveTextDocument.fire(mockDocument);

      // Attendre le traitement asynchrone
      await new Promise(resolve => setTimeout(resolve, 100));

      // Vérifications
      expect(mockFileHasher.hasFileChanged).toHaveBeenCalled();
      expect(mockEventFilter.filter).toHaveBeenCalled();
      expect(mockEventNormalizer.normalize).not.toHaveBeenCalled(); // Ne devrait pas normaliser
      expect(capturedEvents).toHaveLength(0); // Ne devrait pas capturer

      // Nettoyer
      fileSaveListener.dispose();
    });

    it('should handle file hasher errors gracefully', async () => {
      // Configurer le hasher pour lancer une erreur
      mockFileHasher.hasFileChanged.mockRejectedValue(new Error('Hasher error'));

      // Créer l'écouteur
      const fileSaveListener = new FileSaveListener(mockEventFilter, mockEventNormalizer, mockFileHasher);
      const capturedEvents: any[] = [];

      // Initialiser le normalisateur
      await mockEventNormalizer.initialize();

      // Démarrer l'écouteur
      await fileSaveListener.start();
      fileSaveListener.onEventCaptured((event) => {
        capturedEvents.push(event);
      });

      // Simuler un document
      const mockDocument = {
        uri: {
          fsPath: '/test/file.ts'
        },
        languageId: 'typescript',
        lineCount: 100,
        isUntitled: false
      } as unknown as vscode.TextDocument;

      // Déclencher l'événement
      mockOnDidSaveTextDocument.fire(mockDocument);

      // Attendre le traitement asynchrone
      await new Promise(resolve => setTimeout(resolve, 100));

      // Vérifications
      expect(mockFileHasher.hasFileChanged).toHaveBeenCalled();
      expect(mockEventFilter.filter).not.toHaveBeenCalled(); // Ne devrait pas filtrer
      expect(mockEventNormalizer.normalize).not.toHaveBeenCalled(); // Ne devrait pas normaliser
      expect(capturedEvents).toHaveLength(0); // Ne devrait pas capturer

      // Nettoyer
      fileSaveListener.dispose();
    });
  });

  describe('multiple listeners integration', () => {
    it('should handle multiple event types simultaneously', async () => {
      // Créer tous les écouteurs
      const fileSaveListener = new FileSaveListener(mockEventFilter, mockEventNormalizer, mockFileHasher);
      const diagnosticsListener = new DiagnosticsListener(mockEventFilter, mockEventNormalizer);
      const workspaceListener = new WorkspaceListener(mockEventFilter, mockEventNormalizer);

      const capturedEvents: any[] = [];

      // Initialiser le normalisateur
      await mockEventNormalizer.initialize();

      // Démarrer tous les écouteurs
      await fileSaveListener.start();
      await diagnosticsListener.start();
      await workspaceListener.start();

      // S'abonner aux événements capturés
      fileSaveListener.onEventCaptured((event) => capturedEvents.push(event));
      diagnosticsListener.onEventCaptured((event) => capturedEvents.push(event));
      workspaceListener.onEventCaptured((event) => capturedEvents.push(event));

      // Simuler un document
      const mockDocument = {
        uri: {
          fsPath: '/test/file.ts'
        },
        languageId: 'typescript',
        lineCount: 100,
        isUntitled: false
      } as unknown as vscode.TextDocument;

      // Simuler un événement workspace
      const mockWorkspaceEvent: vscode.WorkspaceFoldersChangeEvent = {
        added: [
          {
            name: 'new-folder',
            uri: vscode.Uri.file('/new/path'),
            index: 1
          }
        ],
        removed: []
      };

      // Déclencher tous les événements
      mockOnDidSaveTextDocument.fire(mockDocument);
      mockOnDidChangeDiagnostics.fire(vscode.Uri.file('/test/file.ts'));
      mockOnDidChangeWorkspaceFolders.fire(mockWorkspaceEvent);

      // Attendre le traitement asynchrone
      await new Promise(resolve => setTimeout(resolve, 200));

      // Vérifications
      expect(capturedEvents).toHaveLength(3);
      expect(capturedEvents[0].event_type).toBe('file_save');
      expect(capturedEvents[1].event_type).toBe('diagnostic');
      expect(capturedEvents[2].event_type).toBe('workspace');

      // Vérifier que chaque composant a été appelé
      expect(mockFileHasher.hasFileChanged).toHaveBeenCalled();
      expect(mockEventFilter.filter).toHaveBeenCalledTimes(3);
      expect(mockEventNormalizer.normalize).toHaveBeenCalledTimes(3);

      // Nettoyer
      fileSaveListener.dispose();
      diagnosticsListener.dispose();
      workspaceListener.dispose();
    });
  });

  describe('performance and timing', () => {
    it('should handle rapid succession of events', async () => {
      // Créer l'écouteur
      const fileSaveListener = new FileSaveListener(mockEventFilter, mockEventNormalizer, mockFileHasher);
      const capturedEvents: any[] = [];

      // Initialiser le normalisateur
      await mockEventNormalizer.initialize();

      // Démarrer l'écouteur
      await fileSaveListener.start();
      fileSaveListener.onEventCaptured((event) => {
        capturedEvents.push(event);
      });

      // Simuler plusieurs documents rapidement
      const mockDocuments = [
        {
          uri: {
            fsPath: '/test/file1.ts'
          },
          languageId: 'typescript',
          lineCount: 100,
          isUntitled: false
        },
        {
          uri: {
            fsPath: '/test/file2.ts'
          },
          languageId: 'typescript',
          lineCount: 200,
          isUntitled: false
        },
        {
          uri: {
            fsPath: '/test/file3.ts'
          },
          languageId: 'typescript',
          lineCount: 300,
          isUntitled: false
        }
      ] as unknown as vscode.TextDocument[];

      // Déclencher les événements rapidement
      mockDocuments.forEach(doc => {
        mockOnDidSaveTextDocument.fire(doc);
      });

      // Attendre le traitement asynchrone
      await new Promise(resolve => setTimeout(resolve, 300));

      // Vérifications
      expect(capturedEvents).toHaveLength(3);
      expect(mockFileHasher.hasFileChanged).toHaveBeenCalledTimes(3);
      expect(mockEventFilter.filter).toHaveBeenCalledTimes(3);
      expect(mockEventNormalizer.normalize).toHaveBeenCalledTimes(3);

      // Nettoyer
      fileSaveListener.dispose();
    });
  });
});
