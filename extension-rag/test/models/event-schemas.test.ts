/**
 * Tests unitaires pour les schémas JSON d'événements VS Code
 *
 * Objectif : Valider la conformité des schémas aux règles absolues
 */

import {
  diagnosticEventSchema,
  errorEventSchema,
  fileSaveEventSchema,
  validateEvent,
  workspaceEventSchema
} from '../../src/models/event-schemas';
import { validateVSCodeEvent } from '../../src/models/validator';

describe('Schémas JSON d\'événements VS Code', () => {

  describe('Schéma de base', () => {
    test('doit avoir une structure valide', () => {
      expect(fileSaveEventSchema).toBeDefined();
      expect(diagnosticEventSchema).toBeDefined();
      expect(workspaceEventSchema).toBeDefined();
      expect(errorEventSchema).toBeDefined();
    });

    test('doit avoir les propriétés requises', () => {
      const requiredProps = ['source', 'type', 'timestamp', 'project_id', 'payload'];
      requiredProps.forEach(prop => {
        expect(fileSaveEventSchema.required).toContain(prop);
        expect(diagnosticEventSchema.required).toContain(prop);
        expect(workspaceEventSchema.required).toContain(prop);
        expect(errorEventSchema.required).toContain(prop);
      });
    });
  });

  describe('Événement file_save', () => {
    const validFileSaveEvent = {
      source: 'vscode',
      type: 'file_save',
      timestamp: '2024-01-01T00:00:00.000Z',
      project_id: 'proj_1234567890abcdef',
      file: {
        path: 'src/test.ts',
        language: 'typescript',
        hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' // SHA-256 de ""
      },
      payload: {
        content_preview: 'console.log("test");',
        line_count: 10,
        symbol_count: 2,
        has_errors: false,
        has_warnings: false
      }
    };

    test('doit valider un événement valide', () => {
      const result = validateEvent(validFileSaveEvent, 'file_save');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('doit rejeter un événement sans source vscode', () => {
      const invalidEvent = { ...validFileSaveEvent, source: 'invalid' };
      const result = validateEvent(invalidEvent, 'file_save');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('doit rejeter un événement avec hash invalide', () => {
      const invalidEvent = {
        ...validFileSaveEvent,
        file: { ...validFileSaveEvent.file, hash: 'invalid-hash' }
      };
      const result = validateEvent(invalidEvent, 'file_save');
      expect(result.valid).toBe(false);
      expect(result.errors.some(err => err.includes('hash'))).toBe(true);
    });

    test('doit valider avec diagnostics optionnels', () => {
      const eventWithDiagnostics = {
        ...validFileSaveEvent,
        payload: {
          ...validFileSaveEvent.payload,
          diagnostics: [
            {
              severity: 'error',
              message: 'Type error',
              line: 5,
              column: 10
            }
          ],
          has_errors: true
        }
      };
      const result = validateEvent(eventWithDiagnostics, 'file_save');
      expect(result.valid).toBe(true);
    });
  });

  describe('Événement diagnostic', () => {
    const validDiagnosticEvent = {
      source: 'vscode',
      type: 'diagnostic',
      timestamp: '2024-01-01T00:00:00.000Z',
      project_id: 'proj_1234567890abcdef',
      file: {
        path: 'src/test.ts',
        language: 'typescript',
        hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' // SHA-256 de ""
      },
      payload: {
        diagnostic_type: 'error',
        message: 'Type error: string is not assignable to number',
        code: 'TS2322',
        source: 'typescript',
        line: 10,
        column: 5,
        is_new: true,
        was_fixed: false
      }
    };

    test('doit valider un événement diagnostic valide', () => {
      const result = validateEvent(validDiagnosticEvent, 'diagnostic');
      expect(result.valid).toBe(true);
    });

    test('doit rejeter un diagnostic sans message', () => {
      const invalidEvent = {
        ...validDiagnosticEvent,
        payload: { ...validDiagnosticEvent.payload, message: '' }
      };
      const result = validateEvent(invalidEvent, 'diagnostic');
      expect(result.valid).toBe(false);
    });

    test('doit valider avec colonne optionnelle', () => {
      const eventWithoutColumn = {
        ...validDiagnosticEvent,
        payload: { ...validDiagnosticEvent.payload, column: undefined }
      };
      const result = validateEvent(eventWithoutColumn, 'diagnostic');
      expect(result.valid).toBe(true);
    });
  });

  describe('Événement workspace', () => {
    const validWorkspaceEvent = {
      source: 'vscode',
      type: 'workspace',
      timestamp: '2024-01-01T00:00:00.000Z',
      project_id: 'proj_1234567890abcdef',
      file: {
        path: 'src/new-file.ts',
        hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' // SHA-256 de ""
      },
      payload: {
        change_type: 'created',
        file_type: '.ts',
        is_config_file: false
      }
    };

    test('doit valider un événement workspace valide', () => {
      const result = validateEvent(validWorkspaceEvent, 'workspace');
      expect(result.valid).toBe(true);
    });

    test('doit valider un rename avec old_path', () => {
      const renameEvent = {
        ...validWorkspaceEvent,
        payload: {
          change_type: 'renamed',
          old_path: 'src/old-file.ts',
          file_type: '.ts'
        }
      };
      const result = validateEvent(renameEvent, 'workspace');
      expect(result.valid).toBe(true);
    });

    test('doit rejeter un change_type invalide', () => {
      const invalidEvent = {
        ...validWorkspaceEvent,
        payload: { ...validWorkspaceEvent.payload, change_type: 'invalid' }
      };
      const result = validateEvent(invalidEvent, 'workspace');
      expect(result.valid).toBe(false);
    });
  });

  describe('Événement error', () => {
    const validErrorEvent = {
      source: 'vscode',
      type: 'error',
      timestamp: '2024-01-01T00:00:00.000Z',
      project_id: 'proj_1234567890abcdef',
      payload: {
        error_type: 'build',
        error_message: 'Build failed with exit code 1',
        exit_code: 1,
        command: 'npm run build',
        duration_ms: 5000
      }
    };

    test('doit valider un événement error valide', () => {
      const result = validateEvent(validErrorEvent, 'error');
      expect(result.valid).toBe(true);
    });

    test('doit valider avec stack_trace optionnel', () => {
      const eventWithStackTrace = {
        ...validErrorEvent,
        payload: {
          ...validErrorEvent.payload,
          stack_trace: 'Error: Build failed\n    at compile (builder.js:10:15)'
        }
      };
      const result = validateEvent(eventWithStackTrace, 'error');
      expect(result.valid).toBe(true);
    });

    test('doit rejeter un error_type invalide', () => {
      const invalidEvent = {
        ...validErrorEvent,
        payload: { ...validErrorEvent.payload, error_type: 'invalid' }
      };
      const result = validateEvent(invalidEvent, 'error');
      expect(result.valid).toBe(false);
    });
  });

  describe('Validateur intégré validateVSCodeEvent', () => {
    test('doit valider un événement file_save complet', () => {
      const event = {
        source: 'vscode',
        type: 'file_save',
        timestamp: '2024-01-01T00:00:00.000Z',
        project_id: 'proj_test',
        file: {
          path: 'src/test.ts',
          hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' // SHA-256 de ""
        },
        payload: {
          content_preview: 'test',
          line_count: 1,
          has_errors: false,
          has_warnings: false
        }
      };

      const result = validateVSCodeEvent(event);
      expect(result.valid).toBe(true);
      expect(result.eventType).toBe('file_save');
    });

    test('doit rejeter un événement avec type inconnu', () => {
      const event = {
        source: 'vscode',
        type: 'unknown_type',
        timestamp: '2024-01-01T00:00:00.000Z',
        project_id: 'proj_test',
        payload: {}
      };

      const result = validateVSCodeEvent(event);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Type d\'événement non supporté');
    });

    test('doit rejeter un événement sans source vscode', () => {
      const event = {
        source: 'invalid',
        type: 'file_save',
        timestamp: '2024-01-01T00:00:00.000Z',
        project_id: 'proj_test',
        payload: {}
      };

      const result = validateVSCodeEvent(event);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Source invalide');
    });
  });

  describe('Conformité aux règles absolues', () => {
    test('R3: JSON strict - pas d\'icônes dans les schémas', () => {
      // Vérifier qu'aucun schéma ne contient d'icônes dans les descriptions
      const schemas = [fileSaveEventSchema, diagnosticEventSchema, workspaceEventSchema, errorEventSchema];

      schemas.forEach(schema => {
        const schemaStr = JSON.stringify(schema);
        // Vérifier qu'il n'y a pas d'emojis ou d'icônes Unicode
        expect(schemaStr).not.toMatch(/[\u{1F300}-\u{1F9FF}]/u);
        expect(schemaStr).not.toMatch(/[\u{2600}-\u{26FF}]/u);
        expect(schemaStr).not.toMatch(/[\u{2700}-\u{27BF}]/u);
      });
    });

    test('R4: Architecture standard - schémas bien structurés', () => {
      expect(fileSaveEventSchema.type).toBe('object');
      expect(fileSaveEventSchema.additionalProperties).toBe(false);
      expect(fileSaveEventSchema.properties).toBeDefined();
      expect(fileSaveEventSchema.required).toBeDefined();
    });

    test('R16: JSON MCP unique - schémas compatibles MCP', () => {
      // Vérifier que les schémas peuvent être sérialisés en JSON
      const schemas = [fileSaveEventSchema, diagnosticEventSchema, workspaceEventSchema, errorEventSchema];

      schemas.forEach(schema => {
        expect(() => JSON.stringify(schema)).not.toThrow();
        const serialized = JSON.stringify(schema);
        expect(typeof serialized).toBe('string');
        expect(serialized.length).toBeGreaterThan(0);
      });
    });
  });
});
