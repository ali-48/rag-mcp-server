// test/phase0-analyzer/symbol-extraction/symbol-name-extractor.test.ts
// Tests unitaires pour symbol-name-extractor

import { describe, expect, it } from 'vitest';
import {
  cleanComment,
  extractImportExportName,
  extractSymbolName,
  findChildByType,
  findNameNode
} from '../../../src/rag/phase0/analyzer/symbol-extraction/symbol-name-extractor.js';

describe('symbol-name-extractor', () => {
  describe('extractSymbolName', () => {
    it('should extract function name from TypeScript AST node', () => {
      const mockNode = {
        type: 'function_declaration',
        text: 'function myFunction() {}',
        childCount: 3,
        child: (i: number) => {
          if (i === 0) return { type: 'identifier', text: 'myFunction' };
          return null;
        }
      };

      const name = extractSymbolName(mockNode, 'function', 'typescript');
      expect(name).toBe('myFunction');
    });

    it('should extract class name from JavaScript AST node', () => {
      const mockNode = {
        type: 'class_declaration',
        text: 'class MyClass {}',
        childCount: 2,
        child: (i: number) => {
          if (i === 0) return { type: 'identifier', text: 'MyClass' };
          return null;
        }
      };

      const name = extractSymbolName(mockNode, 'class', 'javascript');
      expect(name).toBe('MyClass');
    });

    it('should return null for unknown symbol type', () => {
      const mockNode = { type: 'unknown', text: '', childCount: 0 };
      const name = extractSymbolName(mockNode, 'unknown' as any, 'typescript');
      expect(name).toBeNull();
    });
  });

  describe('findNameNode', () => {
    it('should find identifier node in AST', () => {
      const mockNode = {
        type: 'function_declaration',
        childCount: 2,
        child: (i: number) => {
          if (i === 0) return { type: 'identifier', text: 'myFunc', childCount: 0 };
          return null;
        }
      };

      const nameNode = findNameNode(mockNode, 'typescript');
      expect(nameNode).toBeDefined();
      expect(nameNode?.type).toBe('identifier');
      expect(nameNode?.text).toBe('myFunc');
    });

    it('should return null if no name node found', () => {
      const mockNode = {
        type: 'empty_statement',
        childCount: 0
      };

      const nameNode = findNameNode(mockNode, 'typescript');
      expect(nameNode).toBeNull();
    });
  });

  describe('findChildByType', () => {
    it('should find child by type', () => {
      const mockNode = {
        childCount: 3,
        child: (i: number) => {
          const children = [
            { type: 'comment', text: '// comment' },
            { type: 'identifier', text: 'myVar' },
            { type: 'literal', text: '42' }
          ];
          return children[i] || null;
        }
      };

      const child = findChildByType(mockNode, ['identifier']);
      expect(child).toBeDefined();
      expect(child?.type).toBe('identifier');
      expect(child?.text).toBe('myVar');
    });

    it('should return null if no matching child', () => {
      const mockNode = {
        childCount: 2,
        child: (i: number) => {
          const children = [
            { type: 'comment', text: '// comment' },
            { type: 'literal', text: '42' }
          ];
          return children[i] || null;
        }
      };

      const child = findChildByType(mockNode, ['identifier']);
      expect(child).toBeNull();
    });
  });

  describe('extractImportExportName', () => {
    it('should extract import module name from TypeScript', () => {
      const mockNode = {
        text: "import { Component } from '@angular/core';"
      };

      const name = extractImportExportName(mockNode, 'typescript');
      expect(name).toBe('@angular/core');
    });

    it('should extract export name from JavaScript', () => {
      const mockNode = {
        text: 'export const MY_CONSTANT = 42;'
      };

      const name = extractImportExportName(mockNode, 'javascript');
      expect(name).toBe('MY_CONSTANT');
    });

    it('should extract import name from Python', () => {
      const mockNode = {
        text: 'import numpy as np'
      };

      const name = extractImportExportName(mockNode, 'python');
      expect(name).toBe('numpy');
    });

    it('should return "unknown" for unrecognized pattern', () => {
      const mockNode = {
        text: 'invalid statement'
      };

      const name = extractImportExportName(mockNode, 'typescript');
      expect(name).toBe('unknown');
    });
  });

  describe('cleanComment', () => {
    it('should clean Python docstring', () => {
      const comment = '"""\nThis is a docstring.\n"""';
      const cleaned = cleanComment(comment, 'python');
      expect(cleaned).toBe('This is a docstring.');
    });

    it('should clean Python single-line comment', () => {
      const comment = '# This is a comment';
      const cleaned = cleanComment(comment, 'python');
      expect(cleaned).toBe('This is a comment');
    });

    it('should clean TypeScript JSDoc comment', () => {
      const comment = '/**\n * This is a JSDoc comment.\n */';
      const cleaned = cleanComment(comment, 'typescript');
      expect(cleaned).toBe('This is a JSDoc comment.');
    });

    it('should clean JavaScript single-line comment', () => {
      const comment = '// This is a comment';
      const cleaned = cleanComment(comment, 'javascript');
      expect(cleaned).toBe('This is a comment');
    });

    it('should trim whitespace for unknown language', () => {
      const comment = '  Some comment  ';
      const cleaned = cleanComment(comment, 'unknown');
      expect(cleaned).toBe('Some comment');
    });
  });
});
