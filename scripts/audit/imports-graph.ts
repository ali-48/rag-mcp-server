#!/usr/bin/env node
/**
 * Script d'audit : Imports Graph
 * Analyse les imports du projet et génère un graphe de dépendances
 *
 * Usage: npx tsx scripts/audit/imports-graph.ts
 */

import fs from 'fs';
import path from 'path';
import madge from 'madge';

interface ImportNode {
  id: string;
  path: string;
  name: string;
  type: 'file' | 'module';
  dependencies: string[];
  dependents: string[];
  size?: number;
  extension: string;
}

interface ImportEdge {
  source: string;
  target: string;
  type: 'import' | 'require' | 'dynamic';
  count: number;
}

interface ImportsGraph {
  nodes: ImportNode[];
  edges: ImportEdge[];
  stats: {
    totalFiles: number;
    totalImports: number;
    circularDependencies: string[][];
    orphanFiles: string[];
    mostImported: Array<{ file: string; count: number }>;
