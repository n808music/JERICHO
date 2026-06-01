import { describe, expect, it } from 'vitest';
import { callClaudeForActionGraph } from '../../src/state/mockLLMActionGraph';

describe('mockLLMActionGraph CreativeProduction builder path', () => {
  it('routes non-podcast CreativeProduction goals through deliverable-derived video actions', async () => {
    const result = await callClaudeForActionGraph(
      {
        executionType: 'CreativeProduction',
        goalText: 'Produce and release a short documentary film about neighborhood businesses',
        goalLabel: 'Short documentary film',
      },
      {
        executionType: 'CreativeProduction',
        terminalOutcome: {
          text: 'Produce and release a short documentary film about neighborhood businesses',
          verificationCriteria:
            'Documentary film is edited, packaged, and published with a release checklist complete.',
        },
        deadline: { dayKey: '2026-06-12', isHardDeadline: true },
      },
      'CreativeProduction',
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const titles = result.graph.actions.map((action) => String(action?.title || '').toLowerCase());

    expect(titles).toEqual(
      expect.arrayContaining([
        'capture audience, narrative direction, and success criteria for video production concept, outline, and audience brief',
        'define video production concept, outline, and audience brief',
        'map scenes, required assets, and production checklist for video production shot plan, production checklist, and asset list',
        'produce first cut and rough edit for video production',
        'complete final edit, sound polish, and graphics for video production',
        'prepare video production release package and publication checklist',
      ])
    );

    expect(titles.some((title) => title.includes('draft creative brief and narrative intent'))).toBe(false);
    expect(titles.some((title) => title.includes('produce first full draft of core artifact'))).toBe(false);
    expect(
      (result.graph.diagnostics?.notes || []).some((note) => note.includes('Mock graph for CreativeProduction'))
    ).toBe(true);
  });
});
