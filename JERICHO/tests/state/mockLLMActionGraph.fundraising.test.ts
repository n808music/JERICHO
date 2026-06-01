import { describe, expect, it } from 'vitest';

import { callClaudeForActionGraph } from '../../src/state/mockLLMActionGraph.ts';

describe('mockLLMActionGraph Fundraising builder path', () => {
  it('derives fundraising actions from admitted contract deliverables', async () => {
    const result = await callClaudeForActionGraph(
      {
        executionType: 'Fundraising',
        goalText:
          'Raise a seed round in 60 days with a thesis, deck, diligence room, investor list, outreach, meetings, terms, and close workflow completed.',
      },
      {
        executionType: 'Fundraising',
        terminalOutcome: {
          text: 'Raise a seed round in 60 days with a thesis, deck, diligence room, investor list, outreach, meetings, terms, and close workflow completed.',
          verificationCriteria: 'Active investor conversations move through diligence and term discussion toward close',
        },
      },
      'Fundraising',
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const titles = result.graph.actions.map((action) => String(action?.title || '').toLowerCase());
    expect(titles).toEqual(
      expect.arrayContaining([
        expect.stringContaining('use-of-funds'),
        expect.stringContaining('deck arc'),
        expect.stringContaining('data-room structure'),
        expect.stringContaining('fit scoring'),
        expect.stringContaining('outreach messaging'),
        expect.stringContaining('meeting agenda'),
        expect.stringContaining('diligence responses'),
        expect.stringContaining('commitment tracker'),
        expect.stringContaining('signature flow'),
      ])
    );
    expect(
      (result.graph.diagnostics?.notes || []).some((note) =>
        note.includes('Mock graph for Fundraising goals derived from admitted contract deliverables.')
      )
    ).toBe(true);
  });

  it('keeps package-preparation fundraising goals out of live raise execution branches', async () => {
    const result = await callClaudeForActionGraph(
      {
        executionType: 'Fundraising',
        goalText:
          'Prepare a friends-and-family fundraising package for Jericho in 21 days so I have a clear pitch, financial ask, use-of-funds story, and investor-ready materials.',
      },
      {
        executionType: 'Fundraising',
        terminalOutcome: {
          text: 'Prepare a friends-and-family fundraising package for Jericho in 21 days so I have a clear pitch, financial ask, use-of-funds story, and investor-ready materials.',
          verificationCriteria: 'Investor-ready package, scripts, and materials are complete and ready to send',
        },
      },
      'Fundraising',
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const titles = result.graph.actions.map((action) => String(action?.title || '').toLowerCase());

    expect(titles).toEqual(
      expect.arrayContaining([
        expect.stringContaining('use-of-funds'),
        expect.stringContaining('pitch deck'),
        expect.stringContaining('financial package'),
        expect.stringContaining('send-package checklist'),
        expect.stringContaining('objection handling'),
        expect.stringContaining('investor-ready materials'),
      ])
    );
    expect(titles.join(' ')).not.toMatch(
      /\bmeeting agenda\b|\bdiligence responses\b|\bcommitment tracker\b|\bsignature flow\b|\blegal close\b/
    );
  });
});
