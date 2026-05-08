import { describe, expect, it } from 'vitest';

import { callClaudeForActionGraph } from '../../src/state/mockLLMActionGraph.ts';

describe('mockLLMActionGraph SalesPipeline builder path', () => {
  it('derives sales pipeline actions from admitted contract deliverables', async () => {
    const result = await callClaudeForActionGraph(
      {
        executionType: 'SalesPipeline',
        goalText:
          'Build a B2B sales pipeline in 45 days with an offer, ICP, outreach system, CRM flow, discovery calls, proposals, and closed-won handoff completed.',
      },
      {
        executionType: 'SalesPipeline',
        terminalOutcome: {
          text: 'Build a B2B sales pipeline in 45 days with an offer, ICP, outreach system, CRM flow, discovery calls, proposals, and closed-won handoff completed.',
          verificationCriteria: 'Qualified opportunities are active and closed-won handoff is ready',
        },
      },
      'SalesPipeline',
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const titles = result.graph.actions.map((action) => String(action?.title || '').toLowerCase());
    expect(titles).toEqual(
      expect.arrayContaining([
        expect.stringContaining('pricing logic'),
        expect.stringContaining('target account'),
        expect.stringContaining('outreach messaging'),
        expect.stringContaining('crm stages'),
        expect.stringContaining('discovery agenda'),
        expect.stringContaining('proposal structure'),
        expect.stringContaining('negotiation plan'),
        expect.stringContaining('onboarding summary'),
      ])
    );
    expect(
      (result.graph.diagnostics?.notes || []).some((note) =>
        note.includes('Mock graph for SalesPipeline goals derived from admitted contract deliverables.')
      )
    ).toBe(true);
  });
});
