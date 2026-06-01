import { describe, expect, it } from 'vitest';
import { callClaudeForActionGraph } from '../../src/state/mockLLMActionGraph';

const NEW_ARCHETYPES = ['CreativeProduction', 'BrandLaunch', 'SalesPipeline', 'Fundraising'];

describe('mock LLM compile coverage for newly added execution types', () => {
  NEW_ARCHETYPES.forEach((executionType) => {
    it(`compiles ${executionType} with a validator-compliant action graph`, async () => {
      const result = await callClaudeForActionGraph(
        {
          executionType,
          goalText: `Run a ${executionType} goal with concrete outputs by deadline`,
          goalLabel: `${executionType} goal`,
        },
        {
          executionType,
          terminalOutcome: { text: `Complete ${executionType} outcomes with measurable progress.` },
        },
        executionType,
        'dev-mock-key'
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.graph.actions.length).toBeGreaterThanOrEqual(8);
      expect(Array.isArray(result.graph.templates)).toBe(true);
      expect(result.graph.diagnostics).toBeTruthy();
      expect(result.graph.actions.some((action) => String(action?.title || '').trim().length > 0)).toBe(true);
      const notes = result.graph.diagnostics.notes || [];
      const expectedNoteFragment =
        executionType === 'BrandLaunch'
          ? 'Mock graph for BrandLaunch goals derived from admitted contract deliverables.'
          : executionType === 'SalesPipeline'
            ? 'Mock graph for SalesPipeline goals derived from admitted contract deliverables.'
            : executionType === 'Fundraising'
              ? 'Mock graph for Fundraising goals derived from admitted contract deliverables.'
              : `Mock graph for ${executionType}.`;
      expect(notes.some((note) => note.includes(expectedNoteFragment))).toBe(true);
    });
  });
});
