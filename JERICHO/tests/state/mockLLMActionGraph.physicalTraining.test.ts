import { describe, expect, it } from 'vitest';

import { callClaudeForActionGraph } from '../../src/state/mockLLMActionGraph.ts';

describe('mockLLMActionGraph PhysicalTraining builder path', () => {
  it('derives physical training actions from admitted contract deliverables', async () => {
    const result = await callClaudeForActionGraph(
      {
        executionType: 'PhysicalTraining',
        goalText:
          'Train for a half marathon in 12 weeks with pacing benchmark, endurance progression, and race-readiness review completed.',
      },
      {
        executionType: 'PhysicalTraining',
        terminalOutcome: {
          text: 'Train for a half marathon in 12 weeks with pacing benchmark, endurance progression, and race-readiness review completed.',
          verificationCriteria: 'Benchmark improved and target race completed with pacing plan followed',
        },
      },
      'PhysicalTraining',
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const titles = result.graph.actions.map((action) => String(action?.title || '').toLowerCase());
    expect(titles).toEqual(
      expect.arrayContaining([
        expect.stringContaining('baseline run benchmark'),
        expect.stringContaining('weekly endurance blocks'),
        expect.stringContaining('training block sequence'),
        expect.stringContaining('benchmark re-test protocol'),
      ])
    );
    expect(
      (result.graph.diagnostics?.notes || []).some((note) =>
        note.includes('Mock graph for PhysicalTraining goals derived from admitted contract deliverables.')
      )
    ).toBe(true);
  });

  it('derives explicit exercise and adherence actions for body-composition goals', async () => {
    const result = await callClaudeForActionGraph(
      {
        executionType: 'PhysicalTraining',
        goalText: 'Lose 10 pounds and improve conditioning in 10 weeks.',
      },
      {
        executionType: 'PhysicalTraining',
        terminalOutcome: {
          text: 'Lose 10 pounds and improve conditioning in 10 weeks.',
          verificationCriteria:
            '10 pounds lost with conditioning sessions complete, weigh-in trend recorded, and final adjustment review complete',
        },
      },
      'PhysicalTraining',
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const titles = result.graph.actions.map((action) => String(action?.title || '').toLowerCase());
    expect(titles).toEqual(
      expect.arrayContaining([
        expect.stringContaining('calorie target'),
        expect.stringContaining('weekly conditioning sessions'),
        expect.stringContaining('strength sessions'),
        expect.stringContaining('nutrition adherence rules'),
        expect.stringContaining('weigh-in cadence'),
        expect.stringContaining('body composition trend'),
      ])
    );
    expect(titles.join(' | ')).not.toContain('nutrition guardrails');
    expect(titles.join(' | ')).not.toContain('nutrition cadence');
  });

  it('carries preparation and execution types through the physical training builder path', async () => {
    const result = await callClaudeForActionGraph(
      {
        executionType: 'PhysicalTraining',
        goalText: 'Lose 10 pounds and improve conditioning in 10 weeks.',
      },
      {
        executionType: 'PhysicalTraining',
        terminalOutcome: {
          text: 'Lose 10 pounds and improve conditioning in 10 weeks.',
          verificationCriteria:
            '10 pounds lost with conditioning sessions complete, weigh-in trend recorded, and final adjustment review complete',
        },
      },
      'PhysicalTraining',
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const actionByTitle = new Map(result.graph.actions.map((action) => [String(action.title || ''), action]));
    expect(
      actionByTitle.get(
        'Plan weekly conditioning sessions, strength sessions, and progression targets for weekly conditioning and strength sessions'
      )?.actionType
    ).toBe('preparation');
    expect(actionByTitle.get('Complete weekly conditioning and strength sessions')?.actionType).toBe('execution');
    expect(
      actionByTitle.get(
        'Review weigh-in trend, nutrition adherence, and adjustment signals for nutrition adherence and weigh-in tracking block'
      )?.actionType
    ).toBe('preparation');
  });
});
