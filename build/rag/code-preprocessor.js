/**
 * Pré-processeur IA pour extraction intelligente des signatures de fonctions,
 * commentaires et structures pour les fichiers code.
 *
 * Ce module améliore la qualité des chunks en extrayant les informations
 * structurelles importantes des fichiers code avant le chunking.
 */
/**
 * Extrait les commentaires d'un fichier code
 */
function extractComments(content, language) {
    const comments = [];
    const lines = content.split('\n');
    // Patterns de commentaires par langage
    const commentPatterns = {
        javascript: { single: /^\s*\/\//, multiStart: /^\s*\/\*/, multiEnd: /\*\// },
        typescript: { single: /^\s*\/\//, multiStart: /^\s*\/\*/, multiEnd: /\*\// },
        python: { single: /^\s*#/, multiStart: /^\s*"""/, multiEnd: /"""/ },
    };
    const patterns = commentPatterns[language] || commentPatterns.javascript;
    let inMultiLineComment = false;
    let currentComment = '';
    let startLine = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (inMultiLineComment) {
            currentComment += line + '\n';
            if (patterns.multiEnd.test(line)) {
                comments.push({
                    type: 'multi-line',
                    content: currentComment.trim(),
                    line: startLine + 1,
                });
                inMultiLineComment = false;
                currentComment = '';
            }
        }
        else if (patterns.multiStart.test(line)) {
            inMultiLineComment = true;
            startLine = i;
            currentComment = line + '\n';
            if (patterns.multiEnd.test(line)) {
                comments.push({
                    type: 'multi-line',
                    content: currentComment.trim(),
                    line: startLine + 1,
                });
                inMultiLineComment = false;
                currentComment = '';
            }
        }
        else if (patterns.single.test(line)) {
            const commentContent = line.replace(patterns.single, '').trim();
            comments.push({
                type: 'single-line',
                content: commentContent,
                line: i + 1,
            });
        }
        // Détection JSDoc/TSDoc
        if (line.includes('/**') && line.includes('*/')) {
            comments.push({
                type: 'jsdoc',
                content: line.trim(),
                line: i + 1,
            });
        }
    }
    return comments;
}
/**
 * Extrait les imports d'un fichier JavaScript/TypeScript
 */
function extractJavaScriptImports(content) {
    const imports = [];
    const lines = content.split('\n');
    const importPatterns = [
        // import { x, y } from 'module'
        /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/,
        // import x from 'module'
        /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/,
        // import * as x from 'module'
        /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/,
        // import 'module'
        /import\s+['"]([^'"]+)['"]/,
    ];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pattern of importPatterns) {
            const match = line.match(pattern);
            if (match) {
                if (pattern.toString().includes('{')) {
                    // import { x, y } from 'module'
                    const importsList = match[1].split(',').map(s => s.trim());
                    imports.push({
                        module: match[2],
                        imports: importsList,
                        isDefault: false,
                        line: i + 1,
                    });
                }
                else if (pattern.toString().includes('* as')) {
                    // import * as x from 'module'
                    imports.push({
                        module: match[2],
                        imports: [match[1]],
                        isDefault: false,
                        line: i + 1,
                    });
                }
                else if (match[2]) {
                    // import x from 'module'
                    imports.push({
                        module: match[2],
                        imports: [match[1]],
                        isDefault: true,
                        line: i + 1,
                    });
                }
                else {
                    // import 'module'
                    imports.push({
                        module: match[1],
                        imports: [],
                        isDefault: false,
                        line: i + 1,
                    });
                }
                break;
            }
        }
    }
    return imports;
}
/**
 * Extrait les imports d'un fichier Python
 */
function extractPythonImports(content) {
    const imports = [];
    const lines = content.split('\n');
    const importPatterns = [
        // import module
        /^import\s+([\w.,\s]+)/,
        // from module import x, y
        /^from\s+([\w.]+)\s+import\s+([\w*,\s]+)/,
    ];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pattern of importPatterns) {
            const match = line.match(pattern);
            if (match) {
                if (pattern.toString().includes('from')) {
                    // from module import x, y
                    const importsList = match[2].split(',').map(s => s.trim());
                    imports.push({
                        module: match[1],
                        imports: importsList,
                        isDefault: false,
                        line: i + 1,
                    });
                }
                else {
                    // import module
                    const modules = match[1].split(',').map(s => s.trim());
                    modules.forEach(module => {
                        imports.push({
                            module,
                            imports: [],
                            isDefault: false,
                            line: i + 1,
                        });
                    });
                }
                break;
            }
        }
    }
    return imports;
}
/**
 * Extrait les fonctions d'un fichier JavaScript/TypeScript
 */
function extractJavaScriptFunctions(content) {
    const functions = [];
    const lines = content.split('\n');
    // Patterns pour les fonctions
    const functionPatterns = [
        // function name(params) { ... }
        /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/,
        // const name = (params) => { ... }
        /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/,
        // const name = function(params) { ... }
        /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function\s*\(([^)]*)\)/,
    ];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pattern of functionPatterns) {
            const match = line.match(pattern);
            if (match) {
                const functionName = match[1];
                const params = match[2] || '';
                // Extraction des paramètres
                const parameters = params.split(',').map(param => {
                    const paramMatch = param.trim().match(/^(\w+)(?::\s*(.+))?(?:\s*=\s*(.+))?$/);
                    if (paramMatch) {
                        return {
                            name: paramMatch[1],
                            type: paramMatch[2],
                            defaultValue: paramMatch[3],
                        };
                    }
                    return { name: param.trim() };
                }).filter(p => p.name);
                // Trouver le corps de la fonction (simplifié)
                let body = line + '\n';
                let braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
                let j = i + 1;
                while (j < lines.length && braceCount > 0) {
                    body += lines[j] + '\n';
                    braceCount += (lines[j].match(/{/g) || []).length;
                    braceCount -= (lines[j].match(/}/g) || []).length;
                    j++;
                }
                functions.push({
                    name: functionName,
                    signature: line.trim(),
                    parameters,
                    body: body.trim(),
                    startLine: i + 1,
                    endLine: j,
                    isAsync: line.includes('async'),
                });
                break;
            }
        }
    }
    return functions;
}
/**
 * Extrait les fonctions d'un fichier Python
 */
function extractPythonFunctions(content) {
    const functions = [];
    const lines = content.split('\n');
    // Pattern pour les fonctions Python
    const functionPattern = /^\s*(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?/;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(functionPattern);
        if (match) {
            const functionName = match[1];
            const params = match[2] || '';
            const returnType = match[3];
            // Extraction des paramètres Python
            const parameters = params.split(',').map(param => {
                const paramMatch = param.trim().match(/^(\w+)(?:\s*:\s*(.+))?(?:\s*=\s*(.+))?$/);
                if (paramMatch) {
                    return {
                        name: paramMatch[1],
                        type: paramMatch[2],
                        defaultValue: paramMatch[3],
                    };
                }
                return { name: param.trim() };
            }).filter(p => p.name);
            // Trouver le corps de la fonction (basé sur l'indentation)
            const startIndent = line.match(/^\s*/)?.[0].length || 0;
            let body = line + '\n';
            let j = i + 1;
            while (j < lines.length) {
                const currentLine = lines[j];
                const currentIndent = currentLine.match(/^\s*/)?.[0].length || 0;
                if (currentIndent > startIndent || currentLine.trim() === '') {
                    body += currentLine + '\n';
                    j++;
                }
                else {
                    break;
                }
            }
            functions.push({
                name: functionName,
                signature: line.trim(),
                returnType,
                parameters,
                body: body.trim(),
                startLine: i + 1,
                endLine: j,
                isAsync: line.includes('async'),
            });
        }
    }
    return functions;
}
/**
 * Extrait les classes d'un fichier JavaScript/TypeScript
 */
function extractJavaScriptClasses(content) {
    const classes = [];
    const lines = content.split('\n');
    // Patterns pour les classes
    const classPattern = /^\s*(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?/;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(classPattern);
        if (match) {
            const className = match[1];
            const extendsClass = match[2];
            // Trouver le corps de la classe
            let body = line + '\n';
            let braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
            let j = i + 1;
            const methods = [];
            while (j < lines.length && braceCount > 0) {
                const currentLine = lines[j];
                body += currentLine + '\n';
                // Détection des méthodes
                const methodMatch = currentLine.match(/^\s*(\w+)\s*\(([^)]*)\)\s*{/);
                if (methodMatch) {
                    const methodName = methodMatch[1];
                    methods.push({
                        name: methodName,
                        signature: currentLine.trim(),
                        visibility: methodName.startsWith('_') ? 'private' : 'public',
                        isStatic: currentLine.includes('static'),
                    });
                }
                braceCount += (currentLine.match(/{/g) || []).length;
                braceCount -= (currentLine.match(/}/g) || []).length;
                j++;
            }
            classes.push({
                name: className,
                extends: extendsClass,
                methods,
                startLine: i + 1,
                endLine: j,
            });
        }
    }
    return classes;
}
/**
 * Extrait les classes d'un fichier Python
 */
function extractPythonClasses(content) {
    const classes = [];
    const lines = content.split('\n');
    // Pattern pour les classes Python
    const classPattern = /^\s*class\s+(\w+)(?:\s*\(([^)]*)\))?/;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(classPattern);
        if (match) {
            const className = match[1];
            const extendsClass = match[2];
            // Trouver le corps de la classe (basé sur l'indentation)
            const startIndent = line.match(/^\s*/)?.[0].length || 0;
            let body = line + '\n';
            let j = i + 1;
            const methods = [];
            while (j < lines.length) {
                const currentLine = lines[j];
                const currentIndent = currentLine.match(/^\s*/)?.[0].length || 0;
                if (currentIndent > startIndent || currentLine.trim() === '') {
                    body += currentLine + '\n';
                    // Détection des méthodes
                    const methodMatch = currentLine.match(/^\s*def\s+(\w+)\s*\(([^)]*)\)/);
                    if (methodMatch) {
                        const methodName = methodMatch[1];
                        methods.push({
                            name: methodName,
                            signature: currentLine.trim(),
                            visibility: methodName.startsWith('_') ? 'private' : 'public',
                            isStatic: currentLine.includes('@staticmethod'),
                        });
                    }
                    j++;
                }
                else {
                    break;
                }
            }
            classes.push({
                name: className,
                extends: extendsClass,
                methods,
                startLine: i + 1,
                endLine: j,
            });
        }
    }
    return classes;
}
/**
 * Prétraite un fichier code pour en extraire la structure
 */
export function preprocessCode(content, language) {
    // Extraire les différents éléments
    const comments = extractComments(content, language);
    const functions = language === 'python'
        ? extractPythonFunctions(content)
        : extractJavaScriptFunctions(content);
    const classes = language === 'python'
        ? extractPythonClasses(content)
        : extractJavaScriptClasses(content);
    const imports = language === 'python'
        ? extractPythonImports(content)
        : extractJavaScriptImports(content);
    // Créer le contenu traité (avec métadonnées enrichies)
    const processedContent = content; // Pour l'instant, on retourne le contenu original
    // Structure complète
    const structure = {
        functions,
        classes,
        imports,
        comments,
    };
    // Métadonnées
    const metadata = {
        language,
        totalFunctions: functions.length,
        totalClasses: classes.length,
        totalImports: imports.length,
        totalComments: comments.length,
    };
    return {
        originalContent: content,
        processedContent,
        structure,
        metadata,
    };
}
