/**
 * Tests unitaires pour DiagnosticsListener
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as vscode from 'vscode';
import { EventFilter } from '../filters/event.filter.js';
import { EventNormalizer } from '../normalizers/event.normalizer.js';
import { DiagnosticsListener } from './diagnostics.listener.js';

// Mocks
jest.mock('../normalizers/event.normalizer.js');
jest.mock('../filters/event.filter.js');

describe('DiagnosticsListener', () => {
  let listener: DiagnosticsListener;
  let mockEventNormalizer: jest.Mocked<EventNormalizer>;
  let mockEventFilter: jest.Mocked<EventFilter>;
  let mockOnDidChangeDiagnostics: vscode.EventEmitter<vscode.Uri>;
  let mockCallback: jest.Mock;

  beforeEach(() => {
    // Réinitialiser les mocks
    jest.clearAllMocks();

    // Créer les mocks
    mockEventNormalizer = {
      normalize: jest.fn().mockReturnValue({
        event_uuid: 'test-uuid',
        event_type: 'diagnostic',
        timestamp: '2024-01-01T00:00:00.000Z',
        project_id: 'test-project',
        workspace_id: 'test-workspace',
        source: 'vscode',
        version: '1.0.0',
        payload: {
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
          file: {
            path: '/test/file.ts',
            language: 'typescript'
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
    mockOnDidChangeDiagnostics = new vscode.EventEmitter<vscode.Uri>();
    const mockLanguages = {
      getLanguages: jest.fn().mockReturnValue(['typescript', 'javascript'])
    };

    const mockWorkspace = {
      onDidChangeDiagnostics: mockOnDidChangeDiagnostics.event
    } as unknown as typeof vscode.workspace;

    // Mock vscode.workspace et vscode.languages
    jest.spyOn(vscode, 'workspace', 'get').mockReturnValue(mockWorkspace);
    jest.spyOn(vscode, 'languages', 'get').mockReturnValue(mockLanguages);

    // Mock diagnostics - getDiagnostics retourne un tableau de [Uri, Diagnostic[]]
    const mockDiagnostics: vscode.Diagnostic[] = [
      {
        severity: vscode.DiagnosticSeverity.Error,
        message: 'Test error',
        code: 'TS1234',
        source: 'typescript',
        range: new vscode.Range(0, 0, 0, 10)
      }
    ];

    jest.spyOn(vscode.languages, 'getDiagnostics').mockReturnValue([
      [vscode.Uri.file('/test/file.ts'), mockDiagnostics]
    ]);

    // Créer le callback mock
    mockCallback = jest.fn();

    // Créer le listener
    listener = new DiagnosticsListener(mockEventFilter, mockEventNormalizer);
  });

  afterEach(() => {
    listener.dispose();
    mockOnDidChangeDiagnostics.dispose();
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

    it('should handle diagnostics change event', async () => {
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
      expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
        event_type: 'diagnostic'
      }));
    });

    it('should ignore event if filtered out', async () => {
      // Configurer le filtre pour rejeter l'événement
      mockEventFilter.filter.mockReturnValue(false);

      mockOnDidChangeDiagnostics.fire(vscode.Uri.file('/test/file.ts'));
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockEventFilter.filter).toHaveBeenCalled();
      expect(mockEventNormalizer.normalize).not.toHaveBeenCalled();
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Configurer le normalisateur pour lancer une erreur
      mockEventNormalizer.normalize.mockReturnValue(null);

      mockOnDidChangeDiagnostics.fire(vscode.Uri.file('/test/file.ts'));
      await new Promise(resolve => setTimeout(resolve, 100));

      // Le callback ne devrait pas être appelé en cas d'erreur
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should filter by language', async () => {
      // Configurer les diagnostics pour un langage non supporté
      jest.spyOn(vscode.languages, 'getDiagnostics').mockReturnValue([
        [vscode.Uri.file('/test/file.txt'), [{
          severity: vscode.DiagnosticSeverity.Error,
          message: 'Test error',
          range: new vscode.Range(0, 0, 0, 10)
        }]]
      ]);

      mockOnDidChangeDiagnostics.fire(vscode.Uri.file('/test/file.txt'));
      await new Promise(resolve => setTimeout(resolve, 100));

      // Ne devrait pas appeler le filtre pour les langages non supportés
      expect(mockEventFilter.filter).not.toHaveBeenCalled();
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should filter by severity', async () => {
      // Configurer les diagnostics avec un hint (sévérité 4)
      jest.spyOn(vscode.languages, 'getDiagnostics').mockReturnValue([
        [vscode.Uri.file('/test/file.ts'), [{
          severity: vscode.DiagnosticSeverity.Hint,
          message: 'Test hint',
          range: new vscode.Range(0, 0, 0, 10)
        }]]
      ]);

      mockOnDidChangeDiagnostics.fire(vscode.Uri.file('/test/file.ts'));
      await new Promise(resolve => setTimeout(resolve, 100));

      // Ne devrait pas appeler le filtre pour les hints
      expect(mockEventFilter.filter).not.toHaveBeenCalled();
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
        event_type: 'diagnostic',
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
