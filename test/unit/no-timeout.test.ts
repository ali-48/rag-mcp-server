// test/unit/no-timeout.test.ts
// Tests pour vérifier l'absence de timeout dans les outils RAG
// Exception: query_rag conserve le timeout

import { readFileSync, readdirSync, statSync } from 'fs';
import { extname, join } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * Liste des fichiers/dossiers à exclure de la vérification
 */
const EXCLUDED_PATHS = [
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    'test',
    'logs',
    'examples',
    'templates',
    'design',
    'docs',
    'refactoring',
    'scripts',
    'test-data',
    'test-chuking',
    'build-test'
];

/**
 * Liste des fichiers spécifiques autorisés à contenir 'timeout'
 * (query_rag est autorisé à conserver le timeout)
 */
const ALLOWED_TIMEOUT_FILES = [
    'src/tools/rag/query-rag.ts',
    'src/tools/rag/query-rag.js',
    'src/rag/response-formatter.ts', // Peut contenir des références à timeout
    'src/rag/types.ts', // Peut contenir des types pour timeout
    'src/config/rag-config.ts', // Contient l'interface avec timeout_ms optionnel
    'config/rag-config-v3.json' // Contient timeout_ms null
];

/**
 * Extensions de fichiers à vérifier
 */
const CHECKED_EXTENSIONS = ['.ts', '.js', '.json'];

/**
 * Termes à rechercher qui indiquent la présence de timeout
 */
const TIMEOUT_TERMS = [
    'timeout',
    'timeout_ms',
    'timeoutMs',
    'timeout-ms',
    'setTimeout',
    'clearTimeout',
    'AbortSignal.timeout' // Node.js 18+
];

/**
 * Récursivement liste tous les fichiers dans un répertoire
 */
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    const files = readdirSync(dirPath);

    files.forEach((file) => {
        const fullPath = join(dirPath, file);

        // Vérifier si le chemin est exclu
        const relativePath = fullPath.replace(process.cwd() + '/', '');
        if (EXCLUDED_PATHS.some(excluded => relativePath.startsWith(excluded))) {
            return;
        }

        if (statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
            // Vérifier l'extension
            const ext = extname(file).toLowerCase();
            if (CHECKED_EXTENSIONS.includes(ext)) {
                arrayOfFiles.push(fullPath);
            }
        }
    });

    return arrayOfFiles;
}

/**
 * Vérifie si un fichier contient des termes de timeout
 */
function checkFileForTimeout(filePath: string): { hasTimeout: boolean; lines: string[] } {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const timeoutLines: string[] = [];

    lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const lowerLine = line.toLowerCase();

        // Vérifier chaque terme de timeout
        for (const term of TIMEOUT_TERMS) {
            if (lowerLine.includes(term.toLowerCase())) {
                // Ignorer les commentaires (sauf si c'est un commentaire documentant l'absence de timeout)
                if (!line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.trim().startsWith('/*')) {
                    // Vérifier si c'est une chaîne de caractères (entre guillemets)
                    const inString = (line.includes(`'${term}'`) || line.includes(`"${term}"`) || line.includes(`\`${term}\``));
                    if (!inString) {
                        timeoutLines.push(`${filePath}:${lineNumber}: ${line.trim()}`);
                    }
                }
            }
        }
    });

    return {
        hasTimeout: timeoutLines.length > 0,
        lines: timeoutLines
    };
}

describe('Vérification de l\'absence de timeout dans les outils RAG', () => {
    const projectRoot = process.cwd();
    const allFiles = getAllFiles(projectRoot);

    it('ne devrait pas trouver de timeout dans les fichiers RAG (sauf exceptions)', () => {
        const violations: string[] = [];

        allFiles.forEach((filePath) => {
            const relativePath = filePath.replace(projectRoot + '/', '');

            // Vérifier si le fichier est dans la liste des exceptions
            const isAllowed = ALLOWED_TIMEOUT_FILES.some(allowed =>
                relativePath.includes(allowed) || filePath.includes(allowed)
            );

            if (!isAllowed) {
                const result = checkFileForTimeout(filePath);
                if (result.hasTimeout) {
                    violations.push(...result.lines);
                }
            }
        });

        // Afficher les violations si elles existent
        if (violations.length > 0) {
            console.error(`\n❌ ${violations.length} violations de timeout trouvées:\n`);
            violations.forEach(violation => console.error(`  ${violation}`));
            console.error('\n');
        }

        expect(violations.length).toBe(0);
    });

    it('devrait permettre les timeout dans query_rag', () => {
        const queryRagFiles = allFiles.filter(file =>
            file.includes('query-rag') && (file.endsWith('.ts') || file.endsWith('.js'))
        );

        expect(queryRagFiles.length).toBeGreaterThan(0);

        queryRagFiles.forEach(filePath => {
            const result = checkFileForTimeout(filePath);
            // query_rag devrait contenir des timeout
            expect(result.hasTimeout).toBe(true);
        });
    });

    it('devrait vérifier les fichiers spécifiques des outils RAG', () => {
        const ragToolFiles = [
            'src/tools/rag/scan-rag.ts',
            'src/tools/rag/index-rag.ts',
            'src/tools/rag/init-rag.ts',
            'src/tools/rag/activated-rag.ts',
            'src/tools/rag/get-status.ts',
            'src/rag/llm-service.ts',
            'src/rag/phase0/llm-enrichment/config.ts',
            'src/rag/phase0/llm-enrichment/index.ts',
            'src/rag/phase0/tree-sitter-parser.ts',
            'src/rag/phase0/file-analyzer.ts'
        ];

        ragToolFiles.forEach(filePath => {
            const fullPath = join(projectRoot, filePath);
            if (statSync(fullPath, { throwIfNoEntry: false })) {
                const result = checkFileForTimeout(fullPath);
                expect(result.hasTimeout, `${filePath} ne devrait pas contenir de timeout`).toBe(false);
            }
        });
    });

    it('devrait vérifier que timeout_ms est null dans la config v3', () => {
        const configPath = join(projectRoot, 'config/rag-config-v3.json');
        if (statSync(configPath, { throwIfNoEntry: false })) {
            const content = readFileSync(configPath, 'utf-8');
            const config = JSON.parse(content);

            // Vérifier que timeout_ms est null ou absent
            const checkTimeout = (obj: any, path: string) => {
                if (obj && typeof obj === 'object') {
                    for (const key in obj) {
                        if (key === 'timeout_ms') {
                            expect(obj[key], `${path}.${key} devrait être null`).toBeNull();
                        } else {
                            checkTimeout(obj[key], `${path}.${key}`);
                        }
                    }
                }
            };

            checkTimeout(config, 'config');
        }
    });

    it('devrait vérifier que RagConfig interface a timeout_ms optionnel', () => {
        const configPath = join(projectRoot, 'src/config/rag-config.ts');
        if (statSync(configPath, { throwIfNoEntry: false })) {
            const content = readFileSync(configPath, 'utf-8');

            // Vérifier que l'interface contient timeout_ms?: number | null
            const hasOptionalTimeout = content.includes('timeout_ms?:') ||
                content.includes('timeout_ms? :') ||
                content.includes('timeout_ms ?:');

            expect(hasOptionalTimeout, 'RagConfig devrait avoir timeout_ms optionnel').toBe(true);
        }
    });

    describe('Analyse détaillée par composant', () => {
        const components = [
            {
                name: 'LLM Service',
                files: ['src/rag/llm-service.ts'],
                description: 'Ne devrait pas avoir de timeout dans les appels LLM'
            },
            {
                name: 'Phase0 Components',
                files: [
                    'src/rag/phase0/llm-enrichment/config.ts',
                    'src/rag/phase0/llm-enrichment/index.ts',
                    'src/rag/phase0/tree-sitter-parser.ts',
                    'src/rag/phase0/file-analyzer.ts'
                ],
                description: 'Ne devrait pas avoir de timeout_ms dans la configuration'
            },
            {
                name: 'Handlers asynchrones',
                files: [
                    'src/tools/rag/scan-rag.ts',
                    'src/tools/rag/index-rag.ts'
                ],
                description: 'Ne devrait pas avoir de timeout dans les handlers'
            },
            {
                name: 'Guards RAG',
                files: ['src/rag/guards/rag-guards.ts'],
                description: 'Ne devrait pas avoir de timeout dans les vérifications'
            }
        ];

        components.forEach(component => {
            it(`devrait vérifier ${component.name}: ${component.description}`, () => {
                component.files.forEach(filePath => {
                    const fullPath = join(projectRoot, filePath);
                    if (statSync(fullPath, { throwIfNoEntry: false })) {
                        const result = checkFileForTimeout(fullPath);
                        expect(result.hasTimeout, `${filePath} ne devrait pas contenir de timeout`).toBe(false);
                    }
                });
            });
        });
    });

    describe('Exceptions documentées', () => {
        it('devrait documenter pourquoi query_rag conserve le timeout', () => {
            const queryRagPath = join(projectRoot, 'src/tools/rag/query-rag.ts');
            if (statSync(queryRagPath, { throwIfNoEntry: false })) {
                const content = readFileSync(queryRagPath, 'utf-8');

                // Vérifier que le fichier contient une explication
                const hasExplanation = content.includes('timeout') &&
                    (content.includes('exception') ||
                        content.includes('conservé') ||
                        content.includes('garder'));

                expect(hasExplanation, 'query_rag devrait documenter pourquoi il conserve le timeout').toBe(true);
            }
        });

        it('devrait documenter que timeout_ms est optionnel dans RagConfig', () => {
            const configPath = join(projectRoot, 'src/config/rag-config.ts');
            if (statSync(configPath, { throwIfNoEntry: false })) {
                const content = readFileSync(configPath, 'utf-8');

                // Vérifier qu'il y a un commentaire expliquant que timeout_ms est optionnel
                const hasComment = content.includes('//') &&
                    content.includes('timeout_ms') &&
                    content.includes('optionnel');

                expect(hasComment, 'RagConfig devrait avoir un commentaire expliquant que timeout_ms est optionnel').toBe(true);
            }
        });
    });
});
