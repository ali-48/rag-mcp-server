// test/phase0-analyzer/rag-guards.test.ts
// Tests unitaires pour rag-guards refactoré
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkJobRequirements, checkRagPhase, formatGuardError, getNextPhase, getPhaseAnalysis, isPhaseReady, requireEmbed, requireIndex, requireInit, requirePrepare, requireQueryReady, requireScan } from '../../src/rag/guards/rag-guards-refactored.js';
// Mocks
vi.mock('../../src/core/logger.js', () => ({
    logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));
vi.mock('../../src/rag/phase0/rag-state.js', () => ({
    getRagState: vi.fn()
}));
vi.mock('../../src/rag/errors/rag-usage-error.js', () => ({
    RagUsageError: class MockRagUsageError extends Error {
        code;
        requiredAction;
        details;
        constructor(message, code, options) {
            super(message);
            this.code = code;
            this.requiredAction = options?.requiredAction;
            this.details = options?.details;
        }
    }
}));
describe('rag-guards (refactored)', () => {
    const mockProjectPath = '/test/project';
    let mockState;
    beforeEach(() => {
        vi.clearAllMocks();
        mockState = {
            initialized: false,
            scanCompleted: false,
            prepareCompleted: false,
            embedCompleted: false,
            indexCompleted: false
        };
    });
    describe('checkRagPhase', () => {
        it('should pass when project is initialized', async () => {
            mockState.initialized = true;
            const { getRagState } = await import('../../src/rag/phase0/rag-state.js');
            getRagState.mockResolvedValue(mockState);
            const requirements = { initialized: true };
            const result = await checkRagPhase(mockProjectPath, requirements);
            expect(result.passed).toBe(true);
            expect(result.error).toBeUndefined();
            expect(result.state).toEqual(mockState);
        });
        it('should fail when project is not initialized', async () => {
            const { getRagState } = await import('../../src/rag/phase0/rag-state.js');
            getRagState.mockResolvedValue(mockState);
            const requirements = { initialized: true };
            const result = await checkRagPhase(mockProjectPath, requirements);
            expect(result.passed).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('Prérequis RAG non satisfaits');
            expect(result.recommendations).toContain('Exécutez `init_rag` pour initialiser le projet');
        });
        it('should include MCP format when failing', async () => {
            const { getRagState } = await import('../../src/rag/phase0/rag-state.js');
            getRagState.mockResolvedValue(mockState);
            const requirements = { initialized: true };
            const result = await checkRagPhase(mockProjectPath, requirements);
            expect(result.mcpFormat).toBeDefined();
            expect(result.mcpFormat?.status).toBe('error');
            expect(result.mcpFormat?.error).toBe('RAG_PHASE_REQUIREMENTS_NOT_MET');
        });
        it('should handle errors when getting RAG state', async () => {
            const { getRagState } = await import('../../src/rag/phase0/rag-state.js');
            getRagState.mockRejectedValue(new Error('Database connection failed'));
            const requirements = { initialized: true };
            const result = await checkRagPhase(mockProjectPath, requirements);
            expect(result.passed).toBe(false);
            expect(result.error?.message).toBe('Impossible de vérifier l\'état RAG');
            expect(result.error?.code).toBe('RAG_STATE_CHECK_FAILED');
        });
    });
    describe('specific guards', () => {
        beforeEach(() => {
            const { getRagState } = require('../../src/rag/phase0/rag-state.js');
            getRagState.mockResolvedValue(mockState);
        });
        it('requireInit should check initialization', async () => {
            const result = await requireInit(mockProjectPath);
            expect(result.passed).toBe(false);
            expect(result.error?.requiredAction).toBe('init_rag');
        });
        it('requireScan should check scan completion', async () => {
            mockState.initialized = true;
            const result = await requireScan(mockProjectPath);
            expect(result.passed).toBe(false);
            expect(result.error?.requiredAction).toBe('scan_rag');
        });
        it('requirePrepare should check preparation completion', async () => {
            mockState.initialized = true;
            const result = await requirePrepare(mockProjectPath);
            expect(result.passed).toBe(false);
            expect(result.error?.requiredAction).toBe('prepare_rag');
        });
        it('requireEmbed should check embedding completion', async () => {
            mockState.initialized = true;
            const result = await requireEmbed(mockProjectPath);
            expect(result.passed).toBe(false);
            expect(result.error?.requiredAction).toBe('embed_rag');
        });
        it('requireIndex should check indexing completion', async () => {
            mockState.initialized = true;
            const result = await requireIndex(mockProjectPath);
            expect(result.passed).toBe(false);
            expect(result.error?.requiredAction).toBe('index_rag');
        });
        it('requireQueryReady should check full pipeline completion', async () => {
            mockState.initialized = true;
            const result = await requireQueryReady(mockProjectPath);
            expect(result.passed).toBe(false);
            expect(result.error?.requiredAction).toContain('init_rag → scan_rag → prepare_rag → embed_rag → index_rag');
        });
    });
    describe('checkJobRequirements', () => {
        beforeEach(() => {
            const { getRagState } = require('../../src/rag/phase0/rag-state.js');
            getRagState.mockResolvedValue(mockState);
        });
        it('should return requireInit for scan job', async () => {
            const result = await checkJobRequirements(mockProjectPath, 'scan');
            expect(result.error?.requiredAction).toBe('init_rag');
        });
        it('should return requireScan for prepare job', async () => {
            const result = await checkJobRequirements(mockProjectPath, 'prepare');
            expect(result.error?.requiredAction).toBe('scan_rag');
        });
        it('should return requirePrepare for embed job', async () => {
            const result = await checkJobRequirements(mockProjectPath, 'embed');
            expect(result.error?.requiredAction).toBe('prepare_rag');
        });
        it('should return requireEmbed for index job', async () => {
            const result = await checkJobRequirements(mockProjectPath, 'index');
            expect(result.error?.requiredAction).toBe('embed_rag');
        });
        it('should return requireQueryReady for query job', async () => {
            const result = await checkJobRequirements(mockProjectPath, 'query');
            expect(result.error?.requiredAction).toContain('init_rag → scan_rag → prepare_rag → embed_rag → index_rag');
        });
        it('should return error for unknown job type', async () => {
            const result = await checkJobRequirements(mockProjectPath, 'unknown');
            expect(result.passed).toBe(false);
            expect(result.error?.code).toBe('UNKNOWN_JOB_TYPE');
        });
    });
    describe('formatGuardError', () => {
        it('should format error without icons (R3 compliance)', () => {
            const { RagUsageError } = require('../../src/rag/errors/rag-usage-error.js');
            const error = new RagUsageError('Test error message', 'TEST_ERROR', {
                requiredAction: 'test_action',
                details: {
                    recommendations: ['Recommendation 1', 'Recommendation 2']
                }
            });
            const formatted = formatGuardError(error);
            // Should not contain icons
            expect(formatted).not.toContain('❌');
            expect(formatted).not.toContain('📋');
            expect(formatted).not.toContain('🎯');
            // Should contain text elements
            expect(formatted).toContain('Erreur: Test error message');
            expect(formatted).toContain('Code: TEST_ERROR');
            expect(formatted).toContain('Action requise:');
            expect(formatted).toContain('Recommandations:');
        });
    });
    describe('isPhaseReady', () => {
        it('should return false for uninitialized project', async () => {
            const ready = await isPhaseReady(mockProjectPath, 'scan');
            expect(ready).toBe(false);
        });
        it('should delegate to checkJobRequirements', async () => {
            const { checkJobRequirements } = await import('../../src/rag/guards/rag-guards-refactored.js');
            const mockResult = { passed: true };
            vi.mocked(checkJobRequirements).mockResolvedValue(mockResult);
            const ready = await isPhaseReady(mockProjectPath, 'scan');
            expect(ready).toBe(true);
        });
    });
    describe('getPhaseAnalysis and getNextPhase', () => {
        it('should delegate to analyzePhases', async () => {
            const { analyzePhases } = await import('../../src/rag/guards/modules/phase-analyzer.js');
            const mockAnalysis = {
                current_phase: 'init',
                current_status: 'pending',
                next_phase: 'init',
                phases: [],
                recommended_actions: [],
                notes_for_ai: []
            };
            vi.mocked(analyzePhases).mockResolvedValue(mockAnalysis);
            const analysis = await getPhaseAnalysis(mockProjectPath);
            expect(analysis).toEqual(mockAnalysis);
        });
        it('should delegate to getNextPhaseToExecute', async () => {
            const { getNextPhaseToExecute } = await import('../../src/rag/guards/modules/phase-analyzer.js');
            vi.mocked(getNextPhaseToExecute).mockResolvedValue('scan');
            const nextPhase = await getNextPhase(mockProjectPath);
            expect(nextPhase).toBe('scan');
        });
    });
});
//# sourceMappingURL=rag-guards.test.js.map