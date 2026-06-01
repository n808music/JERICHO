import { describe, expect, it } from 'vitest';

import { callClaudeForActionGraph } from '../../src/state/mockLLMActionGraph.ts';

describe('mockLLMActionGraph VentureLaunch builder path', () => {
  it('derives service-launch venture actions from admitted contract deliverables', async () => {
    const result = await callClaudeForActionGraph(
      {
        executionType: 'VentureLaunch',
        goalText:
          'Launch a project management consulting service in 30 days with offer, pricing, onboarding materials, and first 15 prospect outreaches completed.',
      },
      {
        executionType: 'VentureLaunch',
        terminalOutcome: {
          text: 'Launch a project management consulting service in 30 days with offer, pricing, onboarding materials, and first 15 prospect outreaches completed.',
          verificationCriteria: 'Offer defined and first clients acquired',
        },
      },
      'VentureLaunch',
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const titles = result.graph.actions.map((action) => String(action?.title || '').toLowerCase());
    expect(titles).toEqual(
      expect.arrayContaining([
        expect.stringContaining('project management consulting service offer'),
        expect.stringContaining('pricing tiers'),
        expect.stringContaining('onboarding workflow'),
        expect.stringContaining('outreach scripts'),
        expect.stringContaining('discovery calls'),
      ])
    );
    expect(
      (result.graph.diagnostics?.notes || []).some((note) =>
        note.includes('Mock graph for VentureLaunch goals derived from admitted contract deliverables.')
      )
    ).toBe(true);
  });

  it('derives product-launch venture actions from admitted contract deliverables', async () => {
    const result = await callClaudeForActionGraph(
      {
        executionType: 'VentureLaunch',
        goalText:
          'Launch a habit tracking app in 45 days with landing page, waitlist, first 25 user interviews, and traction review completed.',
      },
      {
        executionType: 'VentureLaunch',
        terminalOutcome: {
          text: 'Launch a habit tracking app in 45 days with landing page, waitlist, first 25 user interviews, and traction review completed.',
          verificationCriteria: 'Landing page live, first users interviewed, and traction review documented',
        },
      },
      'VentureLaunch',
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const titles = result.graph.actions.map((action) => String(action?.title || '').toLowerCase());
    expect(titles).toEqual(
      expect.arrayContaining([
        'capture target customer, core pain point, and promise for habit tracking app value proposition and target customer',
        'build habit tracking app landing page, waitlist flow, and first-user funnel',
        'prepare habit tracking app customer outreach list and interview script',
        'run habit tracking app first-user validation and feedback loop',
        'compile habit tracking app traction evidence and launch next-step review',
      ])
    );
    expect(titles.some((title) => title.includes('landing page headline and body copy'))).toBe(false);
  });
});
