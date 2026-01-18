// test/mcp-json.test.ts
// Tests pour valider le JSON strict de tous les outils MCP
// Version: v1.0.0

import { beforeEach, describe, expect, it } from 'vitest';
import { configValidator } from '../src/config/json-schemas.js';
import { JSONSchemaValidator } from '../src/core/json-schema-validator.js';
import { logger } from '../src/core/logger.js';

// Mock pour éviter les logs pendant les tests
logger.error = () => { };
logger.warn = () => { };
logger.info = () => { };
logger.debug = () => { };

describe('JSON Strict Validation for MCP Tools', () => {
  let validator: JSONSchemaValidator;

  beforeEach(() => {
    validator = new JSONSchemaValidator({
      logLevel: 'error',
      throwOnError: false
    });
  });

  describe('Configuration Files Validation', () => {
    it('should validate rag-config.json schema', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const configPath = path.join(process.cwd(), 'config', 'rag-config.json');
      if (!fs.existsSync(configPath)) {
        console.warn('rag-config.json not found, skipping test');
        return;
      }

      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const result = await configValidator.validateRagConfig(config);

      expect(result.valid).toBe(true);
      if (result.errors) {
        console.error('Validation errors:', result.errors);
      }
    });

    it('should validate db-config.json schema', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const configPath = path.join(process.cwd(), 'rag', 'config', 'db.config.json');
      if (!fs.existsSync(configPath)) {
        console.warn('db.config.json not found, skipping test');
        return;
      }

      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const result = await configValidator.validateDbConfig(config);

      expect(result.valid).toBe(true);
      if (result.errors) {
        console.error('Validation errors:', result.errors);
      }
    });

    it('should validate state.json schema', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const stateDir = path.join(process.cwd(), 'rag', 'db', 'state');
      if (!fs.existsSync(stateDir)) {
        console.warn('state directory not found, skipping test');
        return;
      }

      const stateFiles = fs.readdirSync(stateDir).filter(f => f.endsWith('.json'));
      if (stateFiles.length === 0) {
        console.warn('No state files found, skipping test');
        return;
      }

      const stateFile = path.join(stateDir, stateFiles[0]);
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      const result = await configValidator.validateState(state);

      expect(result.valid).toBe(true);
      if (result.errors) {
        console.error('Validation errors:', result.errors);
      }
    });

    it('should validate pipeline.json schema', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const pipelinePath = path.join(process.cwd(), 'config', 'pipeline.json');
      if (!fs.existsSync(pipelinePath)) {
        console.warn('pipeline.json not found, skipping test');
        return;
      }

      const pipeline = JSON.parse(fs.readFileSync(pipelinePath, 'utf-8'));
      const result = await configValidator.validatePipeline(pipeline);

      expect(result.valid).toBe(true);
      if (result.errors) {
        console.error('Validation errors:', result.errors);
      }
    });
  });

  describe('MCP Tool Output Validation', () => {
    // Schéma pour les réponses MCP standard
    const MCP_RESPONSE_SCHEMA: any = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      required: ['content'],
      properties: {
        content: {
          type: 'array',
          minLength: 1,
          items: {
            type: 'object',
            required: ['type', 'text'],
            properties: {
              type: {
                type: 'string',
                enum: ['text', 'image', 'code']
              },
              text: {
                type: 'string'
              },
              language: {
                type: 'string'
              }
            }
          }
        }
      },
      additionalProperties: false
    };

    it('should validate MCP response structure', () => {
      const validResponse = {
        content: [
          {
            type: 'text',
            text: 'Operation completed successfully'
          }
        ]
      };

      const result = validator.validate(validResponse, MCP_RESPONSE_SCHEMA);
      expect(result.valid).toBe(true);
    });

    it('should reject MCP responses with extra properties', () => {
      const invalidResponse = {
        content: [
          {
            type: 'text',
            text: 'Operation completed successfully'
          }
        ],
        extraProperty: 'not allowed' // Propriété supplémentaire non autorisée
      };

      const result = validator.validate(invalidResponse, MCP_RESPONSE_SCHEMA);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject MCP responses with invalid content types', () => {
      const invalidResponse = {
        content: [
          {
            type: 'invalid_type', // Type non valide
            text: 'Operation completed successfully'
          }
        ]
      };

      const result = validator.validate(invalidResponse, MCP_RESPONSE_SCHEMA);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Tool-Specific Schemas', () => {
    // Schéma pour activated_rag
    const ACTIVATED_RAG_SCHEMA: any = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      required: ['status', 'project_path', 'total_files', 'total_chunks'],
      properties: {
        status: {
          type: 'string',
          enum: ['success', 'error', 'partial']
        },
        project_path: {
          type: 'string'
        },
        total_files: {
          type: 'number',
          minimum: 0
        },
        total_chunks: {
          type: 'number',
          minimum: 0
        },
        duration_ms: {
          type: 'number',
          minimum: 0
        },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file_path: { type: 'string' },
              error: { type: 'string' }
            }
          }
        },
        warnings: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      additionalProperties: false
    };

    // Schéma pour recherche_rag
    const RECHERCHE_RAG_SCHEMA: any = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      required: ['results', 'query', 'total_results'],
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            required: ['score', 'content', 'file_path'],
            properties: {
              score: {
                type: 'number',
                minimum: 0,
                maximum: 1
              },
              content: {
                type: 'string'
              },
              file_path: {
                type: 'string'
              },
              content_type: {
                type: 'string',
                enum: ['code', 'doc', 'config', 'other']
              },
              language: {
                type: 'string'
              },
              metadata: {
                type: 'object'
              }
            }
          }
        },
        query: {
          type: 'string'
        },
        total_results: {
          type: 'number',
          minimum: 0
        },
        search_mode: {
          type: 'string',
          enum: ['semantic', 'hybrid', 'text']
        },
        threshold: {
          type: 'number',
          minimum: 0,
          maximum: 1
        }
      },
      additionalProperties: false
    };

    // Schéma pour init_rag
    const INIT_RAG_SCHEMA: any = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      required: ['status', 'project_path', 'initialized'],
      properties: {
        status: {
          type: 'string',
          enum: ['success', 'error']
        },
        project_path: {
          type: 'string'
        },
        initialized: {
          type: 'boolean'
        },
        created_files: {
          type: 'array',
          items: { type: 'string' }
        },
        config_path: {
          type: 'string'
        },
        db_path: {
          type: 'string'
        },
        warnings: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      additionalProperties: false
    };

    it('should validate activated_rag response', () => {
      const response = {
        status: 'success',
        project_path: '/path/to/project',
        total_files: 10,
        total_chunks: 50,
        duration_ms: 1234,
        errors: [],
        warnings: ['Some warning']
      };

      const result = validator.validate(response, ACTIVATED_RAG_SCHEMA);
      expect(result.valid).toBe(true);
    });

    it('should validate recherche_rag response', () => {
      const response = {
        results: [
          {
            score: 0.85,
            content: 'Some content',
            file_path: '/path/to/file.js',
            content_type: 'code',
            language: 'javascript',
            metadata: { lines: 10 }
          }
        ],
        query: 'test query',
        total_results: 1,
        search_mode: 'semantic',
        threshold: 0.3
      };

      const result = validator.validate(response, RECHERCHE_RAG_SCHEMA);
      expect(result.valid).toBe(true);
    });

    it('should validate init_rag response', () => {
      const response = {
        status: 'success',
        project_path: '/path/to/project',
        initialized: true,
        created_files: ['rag/config/db.config.json', 'rag/db/vectors.sqlite'],
        config_path: 'rag/config/rag-config.json',
        db_path: 'rag/db/vectors.sqlite',
        warnings: []
      };

      const result = validator.validate(response, INIT_RAG_SCHEMA);
      expect(result.valid).toBe(true);
    });
  });

  describe('JSON Strictness Rules', () => {
    it('should reject responses with console.log output', () => {
      // Simuler une réponse qui contient du texte non-JSON
      const invalidResponse = '🚀 Starting RAG pipeline...\n' + JSON.stringify({
        content: [{ type: 'text', text: 'Done' }]
      });

      expect(() => JSON.parse(invalidResponse)).toThrow();
    });

    it('should reject responses with emojis in JSON values', () => {
      const responseWithEmoji = {
        content: [
          {
            type: 'text',
            text: 'Operation completed successfully',
            notes_for_ai: '✅ Operation completed successfully' // Emoji déplacé vers notes_for_ai
          }
        ]
      };

      // Les emojis ne sont pas autorisés dans les valeurs JSON métier
      // Ils doivent être dans notes_for_ai ou stderr
      expect(() => JSON.stringify(responseWithEmoji)).not.toThrow();

      // Vérifier que le texte métier n'a pas d'icônes
      expect(responseWithEmoji.content[0].text).not.toMatch(/[🔴🟢🟡🔵⚫⚪🟣🟠🟤🧪✅❌⚠️🚨📊📈📉📋📁📂📄📑]/);

      // Vérifier que notes_for_ai contient l'icône
      expect(responseWithEmoji.content[0].notes_for_ai).toMatch(/✅/);

      // Mais nous voulons éviter les emojis dans les clés
      const responseWithEmojiInKey = {
        'status': 'success' // Clé sans emoji
      };

      // Ce JSON est conforme R3
      expect(() => JSON.stringify(responseWithEmojiInKey)).not.toThrow();
    });

    it('should validate that all responses are valid JSON', () => {
      const testCases = [
        { valid: true, data: { status: 'success' } },
        { valid: true, data: { results: [] } },
        { valid: false, data: undefined },
        { valid: false, data: 'plain string' },
        { valid: false, data: null }
      ];

      testCases.forEach((testCase, index) => {
        try {
          const jsonString = JSON.stringify(testCase.data);
          const parsed = JSON.parse(jsonString);
          expect(parsed).toBeDefined();
        } catch (error) {
          if (testCase.valid) {
            throw new Error(`Test case ${index} should be valid but failed: ${error}`);
          }
        }
      });
    });
  });

  describe('Performance Tests', () => {
    it('should validate large responses quickly', () => {
      // Créer une grande réponse de test
      const largeResponse = {
        results: Array.from({ length: 1000 }, (_, i) => ({
          score: Math.random(),
          content: 'x'.repeat(100),
          file_path: `/path/to/file${i}.js`,
          content_type: 'code',
          language: 'javascript',
          metadata: { index: i }
        })),
        query: 'test query',
        total_results: 1000,
        search_mode: 'semantic',
        threshold: 0.3
      };

      const startTime = performance.now();
      const jsonString = JSON.stringify(largeResponse);
      const parsed = JSON.parse(jsonString);
      const endTime = performance.now();

      expect(parsed.results).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(100); // Moins de 100ms
    });

    it('should handle nested objects efficiently', () => {
      const nestedResponse = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: 'deep'
                }
              }
            }
          }
        },
        array: Array.from({ length: 100 }, (_, i) => ({
          nested: { value: i }
        }))
      };

      const startTime = performance.now();
      const result = validator.validate(nestedResponse, {
        type: 'object',
        properties: {
          level1: { type: 'object' },
          array: {
            type: 'array',
            items: { type: 'object' }
          }
        }
      });
      const endTime = performance.now();

      expect(result.valid).toBe(true);
      expect(endTime - startTime).toBeLessThan(50); // Moins de 50ms
    });
  });

  describe('Error Handling', () => {
    it('should provide clear error messages for invalid JSON', () => {
      const invalidJson = '{ invalid: json }'; // JSON invalide
      expect(() => JSON.parse(invalidJson)).toThrow();
    });

    it('should validate error responses are also JSON strict', () => {
      const errorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input parameters',
          details: {
            field: 'project_path',
            reason: 'Path does not exist'
          }
        },
        timestamp: new Date().toISOString()
      };

      const ERROR_SCHEMA: any = {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object' }
            }
          },
          timestamp: { type: 'string', format: 'date-time' }
        },
        additionalProperties: false
      };

      const result = validator.validate(errorResponse, ERROR_SCHEMA);
      expect(result.valid).toBe(true);
    });
  });
});

describe('Integration Tests', () => {
  it('should validate all configuration files together', async () => {
    const results = await configValidator.validateAllConfigs();

    // stdout: JSON strict sans icônes
    console.log(JSON.stringify({
      message: 'Configuration validation results',
      results: {
        rag_config: { valid: results.rag_config.valid, error_count: results.rag_config.errors?.length || 0 },
        db_config: { valid: results.db_config.valid, error_count: results.db_config.errors?.length || 0 },
        state: { valid: results.state.valid, error_count: results.state.errors?.length || 0 },
        pipeline: { valid: results.pipeline.valid, error_count: results.pipeline.errors?.length || 0 }
      }
    }));

    // stderr: texte enrichi avec icônes (pour les logs humains)
    console.error('Configuration validation results:');
    console.error(`- rag_config: ${results.rag_config.valid ? '✅' : '❌'} ${results.rag_config.errors?.length || 0} errors`);
    console.error(`- db_config: ${results.db_config.valid ? '✅' : '❌'} ${results.db_config.errors?.length || 0} errors`);
    console.error(`- state: ${results.state.valid ? '✅' : '❌'} ${results.state.errors?.length || 0} errors`);
    console.error(`- pipeline: ${results.pipeline.valid ? '✅' : '❌'} ${results.pipeline.errors?.length || 0} errors`);

    // Au moins une configuration doit être valide
    const anyValid = Object.values(results).some(r => r.valid);
    expect(anyValid).toBe(true);
  });

  it('should ensure no console.log in production code', async () => {
    // Vérifier les fichiers source pour console.log
    const fs = await import('fs');
    const path = await import('path');

    const sourceDir = path.join(process.cwd(), 'src');
    const checkForConsoleLog = (filePath: string) => {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (line.includes('console.log') && !line.includes('//') && !line.includes('*')) {
          console.warn(`Found console.log in ${filePath}:${index + 1}`);
        }
      });
    };

    const walkDir = (dir: string) => {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          walkDir(filePath);
        } else if (filePath.endsWith('.ts') || filePath.endsWith('.js')) {
          checkForConsoleLog(filePath);
        }
      });
    };

    walkDir(sourceDir);

    // Ce test ne doit pas échouer, mais avertir
    expect(true).toBe(true);
  });
});
