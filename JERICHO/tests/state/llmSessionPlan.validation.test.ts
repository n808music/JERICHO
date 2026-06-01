import { describe, expect, it } from 'vitest';
import { parseLLMSessionPlan, validateSessionPlan } from '../../src/state/llmActionGraph.ts';

describe('session plan schema enforcement', () => {
  it('rejects malformed sessions before scheduler writes', () => {
    const result = validateSessionPlan(
      [
        {
          date: '2026-03-10',
          startTime: '09:00',
          durationMinutes: 60,
          actionSteps: ['only one step'],
          completionCondition: '',
          deliverableId: '',
          actionId: 'act-1',
        },
      ],
      {
        actionIds: ['act-1'],
        startDayKey: '2026-03-10',
        endDayKey: '2026-03-31',
      }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SESSION_PLAN_INVALID_STEPS');
    }
  });

  it('parses valid JSON payload and returns normalized sessions', () => {
    const parsed = parseLLMSessionPlan(
      JSON.stringify({
        version: 'jericho_session_plan_v1',
        sessions: [
          {
            date: '2026-03-10',
            startTime: '09:00',
            durationMinutes: 60,
            actionSteps: ['Review objective', 'Execute focused work', 'Log output'],
            completionCondition: 'Output logged in tracker',
            deliverableId: 'deliv-1',
            actionId: 'act-1',
          },
        ],
      }),
      {
        actionIds: ['act-1'],
        startDayKey: '2026-03-10',
        endDayKey: '2026-03-31',
      }
    );

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.sessions).toHaveLength(1);
      expect(parsed.sessions[0].deliverableId).toBe('deliv-1');
      expect(parsed.sessions[0].actionId).toBe('act-1');
    }
  });
});
