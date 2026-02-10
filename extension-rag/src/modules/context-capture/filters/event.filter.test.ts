/**
 * Tests unitaires pour EventFilter
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { EventFilter, RawVSCodeEvent } from './event.filter.js';

// Mock logger
jest.mock('../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('EventFilter', () => {
  let filter: EventFilter;

  beforeEach(() => {
    // Réinitialiser les mocks
    jest.clearAllMocks();

    // Créer le filtre
    filter = new EventFilter();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const stats = filter.getStats();
      expect(stats.total_event_types).toBe(3); // file_save, diagnostic, workspace
      expect(stats.ignored_event_types).toBe(4); // 4 types ignorés par défaut
      expect(stats.last_event_times).toEqual({});
    });

    it('should have correct minimum intervals', () => {
      // Les intervalles sont configurés dans le constructeur
      // On ne peut pas les vérifier directement car ils sont privés
      // Mais on peut vérifier le comportement via le filtrage
      const event: RawVSCodeEvent = {
        type: 'file_save',
        timestamp: 1000,
        data: { document: { uri: { fsPath: '/test/file.ts' } } },
        source: 'vscode'
      };

      // Premier événement devrait être accepté
      expect(filter.filter(event)).toBe(true);

      // Deuxième événement trop tôt devrait être rejeté
      const eventTooSoon: RawVSCodeEvent = {
        ...event,
        timestamp: 1500 // 500ms après, intervalle min = 1000ms
      };
      expect(filter.filter(eventTooSoon)).toBe(false);
    });
  });

  describe('event filtering', () => {
    it('should accept valid file_save event', () => {
      const event: RawVSCodeEvent = {
        type: 'file_save',
        timestamp: 1000,
        data: {
          document: {
            uri: { fsPath: '/test/file.ts' }
          }
        },
        source: 'vscode'
      };

      expect(filter.filter(event)).toBe(true);
    });

    it('should accept valid diagnostic event', () => {
      const event: RawVSCodeEvent = {
        type: 'diagnostic',
        timestamp: 1000,
        data: {
          diagnostic: {
            severity: 2 // Warning ou plus
          }
        },
        source: 'vscode'
      };

      expect(filter.filter(event)).toBe(true);
    });

    it('should accept valid workspace event', () => {
      const event: RawVSCodeEvent = {
        type: 'workspace',
        timestamp: 1000,
        data: {
          added: [{ name: 'folder', uri: { fsPath: '/test' } }]
        },
        source: 'vscode'
      };

      expect(filter.filter(event)).toBe(true);
    });

    it('should accept unknown event types', () => {
      const event: RawVSCodeEvent = {
        type: 'unknown_type',
        timestamp: 1000,
        data: { test: 'data' },
        source: 'vscode'
      };

      expect(filter.filter(event)).toBe(true);
    });
  });

  describe('ignored event types', () => {
    const ignoredTypes = [
      'textEditorSelectionChange',
      'textEditorVisibleRangesChange',
      'textEditorViewColumnChange',
      'windowStateChange'
    ];

    ignoredTypes.forEach(eventType => {
      it(`should ignore ${eventType} events`, () => {
        const event: RawVSCodeEvent = {
          type: eventType,
          timestamp: 1000,
          data: { test: 'data' },
          source: 'vscode'
        };

        expect(filter.filter(event)).toBe(false);
      });
    });
  });

  describe('minimum interval filtering', () => {
    it('should enforce minimum interval for file_save events', () => {
      const event1: RawVSCodeEvent = {
        type: 'file_save',
        timestamp: 1000,
        data: { document: { uri: { fsPath: '/test/file.ts' } } },
        source: 'vscode'
      };

      const event2: RawVSCodeEvent = {
        ...event1,
        timestamp: 1500 // 500ms après, intervalle min = 1000ms
      };

      expect(filter.filter(event1)).toBe(true); // Accepté
      expect(filter.filter(event2)).toBe(false); // Rejeté (trop tôt)
    });

    it('should enforce minimum interval for diagnostic events', () => {
      const event1: RawVSCodeEvent = {
        type: 'diagnostic',
        timestamp: 1000,
        data: { diagnostic: { severity: 2 } },
        source: 'vscode'
      };

      const event2: RawVSCodeEvent = {
        ...event1,
        timestamp: 2500 // 1500ms après, intervalle min = 2000ms
      };

      expect(filter.filter(event1)).toBe(true); // Accepté
      expect(filter.filter(event2)).toBe(false); // Rejeté (trop tôt)
    });

    it('should enforce minimum interval for workspace events', () => {
      const event1: RawVSCodeEvent = {
        type: 'workspace',
        timestamp: 1000,
        data: { added: [{ name: 'folder', uri: { fsPath: '/test' } }] },
        source: 'vscode'
      };

      const event2: RawVSCodeEvent = {
        ...event1,
        timestamp: 4000 // 3000ms après, intervalle min = 5000ms
      };

      expect(filter.filter(event1)).toBe(true); // Accepté
      expect(filter.filter(event2)).toBe(false); // Rejeté (trop tôt)
    });

    it('should accept events after minimum interval', () => {
      const event1: RawVSCodeEvent = {
        type: 'file_save',
        timestamp: 1000,
        data: { document: { uri: { fsPath: '/test/file.ts' } } },
        source: 'vscode'
      };

      const event2: RawVSCodeEvent = {
        ...event1,
        timestamp: 2500 // 1500ms après, intervalle min = 1000ms
      };

      expect(filter.filter(event1)).toBe(true); // Accepté
      expect(filter.filter(event2)).toBe(true); // Accepté (assez de temps écoulé)
    });
  });

  describe('significant event checking', () => {
    describe('file_save events', () => {
      it('should reject file_save for ignored file patterns', () => {
        const ignoredPaths = [
          '/test/file.tmp',
          '/test/debug.log',
          '/test/node_modules/package.json',
          '/test/.vscode/settings.json',
          '/test/.git/config'
        ];

        ignoredPaths.forEach(filePath => {
          const event: RawVSCodeEvent = {
            type: 'file_save',
            timestamp: 1000,
            data: {
              document: {
                uri: { fsPath: filePath }
              }
            },
            source: 'vscode'
          };

          expect(filter.filter(event)).toBe(false);
        });
      });

      it('should accept file_save for normal files', () => {
        const normalPaths = [
          '/test/file.ts',
          '/test/script.js',
          '/test/README.md',
          '/test/src/index.ts'
        ];

        normalPaths.forEach(filePath => {
          const event: RawVSCodeEvent = {
            type: 'file_save',
            timestamp: 1000,
            data: {
              document: {
                uri: { fsPath: filePath }
              }
            },
            source: 'vscode'
          };

          expect(filter.filter(event)).toBe(true);
        });
      });
    });

    describe('diagnostic events', () => {
      it('should reject diagnostic events with low severity', () => {
        const lowSeverities = [3, 4]; // Hint (4), Information (3)

        lowSeverities.forEach(severity => {
          const event: RawVSCodeEvent = {
            type: 'diagnostic',
            timestamp: 1000,
            data: {
              diagnostic: { severity }
            },
            source: 'vscode'
          };

          expect(filter.filter(event)).toBe(false);
        });
      });

      it('should accept diagnostic events with high severity', () => {
        const highSeverities = [1, 2]; // Error (1), Warning (2)

        highSeverities.forEach(severity => {
          const event: RawVSCodeEvent = {
            type: 'diagnostic',
            timestamp: 1000,
            data: {
              diagnostic: { severity }
            },
            source: 'vscode'
          };

          expect(filter.filter(event)).toBe(true);
        });
      });

      it('should handle missing severity', () => {
        const event: RawVSCodeEvent = {
          type: 'diagnostic',
          timestamp: 1000,
          data: {
            diagnostic: {} // Pas de sévérité
          },
          source: 'vscode'
        };

        expect(filter.filter(event)).toBe(false); // Sécurité par défaut
      });
    });

    describe('workspace events', () => {
      it('should always accept workspace events', () => {
        const events: RawVSCodeEvent[] = [
          {
            type: 'workspace',
            timestamp: 1000,
            data: { added: [], removed: [] },
            source: 'vscode'
          },
          {
            type: 'workspace',
            timestamp: 2000,
            data: null,
            source: 'vscode'
          },
          {
            type: 'workspace',
            timestamp: 3000,
            data: undefined,
            source: 'vscode'
          }
        ];

        events.forEach(event => {
          expect(filter.filter(event)).toBe(true);
        });
      });
    });
  });

  describe('error handling', () => {
    it('should handle filtering errors gracefully', () => {
      // Créer un événement qui va provoquer une erreur
      const event: RawVSCodeEvent = {
        type: 'file_save',
        timestamp: 1000,
        data: {
          // Données qui vont provoquer une erreur dans isSignificantFileSave
          document: {
            uri: {
              fsPath: {
                test: 'circular' // Objet qui va causer une erreur dans RegExp.test
              }
            }
          }
        },
        source: 'vscode'
      };

      // Le filtre devrait retourner false en cas d'erreur
      expect(filter.filter(event)).toBe(false);
    });

    it('should handle null/undefined data', () => {
      const events: RawVSCodeEvent[] = [
        {
          type: 'file_save',
          timestamp: 1000,
          data: null,
          source: 'vscode'
        },
        {
          type: 'file_save',
          timestamp: 2000,
          data: undefined,
          source: 'vscode'
        }
      ];

      events.forEach(event => {
        expect(filter.filter(event)).toBe(false); // Pas de document, donc rejeté
      });
    });
  });

  describe('reset', () => {
    it('should reset the filter', () => {
      // Ajouter un événement pour avoir un historique
      const event: RawVSCodeEvent = {
        type: 'file_save',
        timestamp: 1000,
        data: { document: { uri: { fsPath: '/test/file.ts' } } },
        source: 'vscode'
      };

      filter.filter(event);

      // Vérifier que l'historique n'est pas vide
      const statsBefore = filter.getStats();
      expect(Object.keys(statsBefore.last_event_times)).toHaveLength(1);

      // Réinitialiser
      filter.reset();

      // Vérifier que l'historique est vide
      const statsAfter = filter.getStats();
      expect(Object.keys(statsAfter.last_event_times)).toHaveLength(0);
    });
  });

  describe('statistics', () => {
    it('should return correct statistics', () => {
      const stats = filter.getStats();

      expect(stats).toEqual({
        total_event_types: 3,
        ignored_event_types: 4,
        last_event_times: {}
      });
    });

    it('should update statistics after filtering events', () => {
      const events: RawVSCodeEvent[] = [
        {
          type: 'file_save',
          timestamp: 1000,
          data: { document: { uri: { fsPath: '/test/file.ts' } } },
          source: 'vscode'
        },
        {
          type: 'diagnostic',
          timestamp: 2000,
          data: { diagnostic: { severity: 2 } },
          source: 'vscode'
        }
      ];

      events.forEach(event => filter.filter(event));

      const stats = filter.getStats();
      expect(Object.keys(stats.last_event_times)).toHaveLength(2);
      expect(stats.last_event_times['file_save']).toBe(1000);
      expect(stats.last_event_times['diagnostic']).toBe(2000);
    });
  });
});
