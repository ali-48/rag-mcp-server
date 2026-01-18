/**
 * Déclarations TypeScript pour le script validate-rules.js
 */

export interface ValidationResult {
  ruleName: string;
  ruleNumber: number;
  violations: string[];
  warnings: string[];
}

export interface ValidationResults {
  timestamp: string;
  totalRules: number;
  rulesValidated: number;
  violations: Array<{
    rule: number;
    name: string;
    violations: string[];
  }>;
  warnings: Array<{
    rule: number;
    name: string;
    warnings: string[];
  }>;
  summary: {
    passed: number;
    failed: number;
    warnings: number;
  };
}

// Fonctions de validation
export function validateRule1(): Promise<ValidationResult>;
export function validateRule2(): Promise<ValidationResult>;
export function validateRule3(): Promise<ValidationResult>;
export function validateRule4(): Promise<ValidationResult>;
export function validateRule5(): Promise<ValidationResult>;
export function validateRule25(): Promise<ValidationResult>;

// Fonctions utilitaires
export function fileExists(filePath: string): Promise<boolean>;
export function directoryExists(dirPath: string): Promise<boolean>;
export function getAllSourceFiles(): Promise<string[]>;
export function getAllFiles(dir: string): Promise<string[]>;
