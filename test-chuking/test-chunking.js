// Test script for intelligent chunking optimization

const fs = require('fs');
const path = require('path');

// Mock the necessary imports for testing
const mockParseResult = (filePath, content, language) => ({
    filePath,
    language,
    sourceCode: content,
    ast: null // We'll mock this later
});

// Simple test to analyze current chunking behavior
async function testChunking() {
    console.log('=== Testing Intelligent Chunking Optimization ===\n');

    // Read test files
    const testFiles = [
        { path: 'test-typescript.ts', language: 'typescript' },
        { path: 'test-python.py', language: 'python' },
        { path: 'test-javascript.js', language: 'javascript' }
    ];

    for (const testFile of testFiles) {
        const filePath = path.join(__dirname, testFile.path);
        const content = fs.readFileSync(filePath, 'utf-8');

        console.log(`\n📁 Testing ${testFile.path} (${testFile.language}):`);
        console.log('='.repeat(50));

        // Analyze file structure
        analyzeFileStructure(content, testFile.language);

        // Simulate chunking (we'll implement actual chunking later)
        simulateChunking(content, testFile.language);
    }
}

function analyzeFileStructure(content, language) {
    const lines = content.split('\n');

    // Count different structures
    let functionCount = 0;
    let classCount = 0;
    let importCount = 0;
    let exportCount = 0;
    let interfaceCount = 0;
    let commentCount = 0;

    for (const line of lines) {
        const trimmed = line.trim();

        if (language === 'typescript' || language === 'javascript') {
            if (trimmed.startsWith('function ') || trimmed.startsWith('async function ')) functionCount++;
            if (trimmed.startsWith('class ')) classCount++;
            if (trimmed.startsWith('import ')) importCount++;
            if (trimmed.startsWith('export ')) exportCount++;
            if (trimmed.startsWith('interface ')) interfaceCount++;
            if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) commentCount++;
        } else if (language === 'python') {
            if (trimmed.startsWith('def ') || trimmed.startsWith('async def ')) functionCount++;
            if (trimmed.startsWith('class ')) classCount++;
            if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) importCount++;
            if (trimmed.startsWith('#') || trimmed.startsWith('"""') || trimmed.startsWith("'''")) commentCount++;
        }
    }

    console.log(`📊 File Analysis:`);
    console.log(`   Functions: ${functionCount}`);
    console.log(`   Classes: ${classCount}`);
    console.log(`   Imports: ${importCount}`);
    console.log(`   Exports: ${exportCount}`);
    console.log(`   Interfaces: ${interfaceCount}`);
    console.log(`   Comments: ${commentCount}`);
    console.log(`   Total Lines: ${lines.length}`);
}

function simulateChunking(content, language) {
    console.log(`\n🧠 Simulated Chunking Strategy:`);

    // Based on the current chunker-intelligent.ts logic
    const config = {
        granularity: 'atomic',
        rules: {
            neverSplitFunctions: true,
            neverSplitClasses: true,
            groupImports: true,
            groupExports: true
        }
    };

    const lines = content.split('\n');
    let currentChunk = [];
    let inFunction = false;
    let inClass = false;
    let chunkCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Detect function start
        if ((language === 'typescript' || language === 'javascript') &&
            (trimmed.startsWith('function ') || trimmed.startsWith('async function ') ||
                trimmed.includes('=>') && trimmed.includes('{') && !trimmed.endsWith(';'))) {
            if (currentChunk.length > 0 && config.rules.neverSplitFunctions) {
                chunkCount++;
                currentChunk = [];
            }
            inFunction = true;
        } else if (language === 'python' && trimmed.startsWith('def ')) {
            if (currentChunk.length > 0 && config.rules.neverSplitFunctions) {
                chunkCount++;
                currentChunk = [];
            }
            inFunction = true;
        }

        // Detect class start
        if (trimmed.startsWith('class ')) {
            if (currentChunk.length > 0 && config.rules.neverSplitClasses) {
                chunkCount++;
                currentChunk = [];
            }
            inClass = true;
        }

        // Detect imports (group them)
        if ((language === 'typescript' || language === 'javascript') && trimmed.startsWith('import ')) {
            if (config.rules.groupImports) {
                // Group imports together
                if (!currentChunk.some(l => l.trim().startsWith('import '))) {
                    if (currentChunk.length > 0) {
                        chunkCount++;
                        currentChunk = [];
                    }
                }
            }
        } else if (language === 'python' && (trimmed.startsWith('import ') || trimmed.startsWith('from '))) {
            if (config.rules.groupImports) {
                if (!currentChunk.some(l => l.trim().startsWith('import ') || l.trim().startsWith('from '))) {
                    if (currentChunk.length > 0) {
                        chunkCount++;
                        currentChunk = [];
                    }
                }
            }
        }

        currentChunk.push(line);

        // Detect function/class end (simplified)
        if (inFunction && trimmed.includes('}') && language !== 'python') {
            inFunction = false;
            chunkCount++;
            currentChunk = [];
        } else if (inFunction && language === 'python' &&
            trimmed.length > 0 && i < lines.length - 1 &&
            lines[i + 1].trim().length > 0 &&
            lines[i + 1].search(/\S/) <= line.search(/\S/)) {
            // Python: function ends when indentation decreases
            inFunction = false;
            chunkCount++;
            currentChunk = [];
        }

        if (inClass && trimmed.includes('}') && language !== 'python') {
            inClass = false;
            chunkCount++;
            currentChunk = [];
        } else if (inClass && language === 'python' &&
            trimmed.length > 0 && i < lines.length - 1 &&
            lines[i + 1].trim().length > 0 &&
            lines[i + 1].search(/\S/) <= line.search(/\S/)) {
            // Python: class ends when indentation decreases
            inClass = false;
            chunkCount++;
            currentChunk = [];
        }
    }

    // Count remaining chunk
    if (currentChunk.length > 0) {
        chunkCount++;
    }

    console.log(`   Estimated chunks: ${chunkCount}`);
    console.log(`   Strategy: ${config.granularity} granularity`);
    console.log(`   Rules: ${Object.keys(config.rules).filter(k => config.rules[k]).join(', ')}`);
}

// Run the test
testChunking().catch(console.error);
