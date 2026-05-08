import { describe, expect, it, vi } from 'vitest';
import {
  LLM_CALL_PROFILES,
  callClaudeForActionGraph,
  callClaudeForSessionPlan,
} from '../../src/state/llmActionGraph.ts';

describe('LLM token budget enforcement', () => {
  it('pins token caps to 2000/500 contract', () => {
    expect(LLM_CALL_PROFILES.PLAN_ACTION_GRAPH.maxTokens).toBe(2000);
    expect(LLM_CALL_PROFILES.PLAN_SESSIONS.maxTokens).toBe(2000);
    expect(LLM_CALL_PROFILES.PLAN_SINGLE_BLOCK.maxTokens).toBe(500);
  });

  it('sends max_tokens from call profile for action graph and session plan calls', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (_url: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body || '{}'));
        if (body?.messages?.[0]?.content?.includes('jericho_action_graph_v1')) {
          return {
            ok: true,
            json: async () => ({
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    version: 'jericho_action_graph_v1',
                    executionType: 'GenericStructured',
                    actions: [
                      {
                        id: 'phase:001:a',
                        title: 'Action A',
                        label: 'Action A',
                        deliverable: 'D1',
                        definitionOfDone: 'Done A',
                        estimateMin: 30,
                        category: 'CREATIVE_PRODUCTION',
                        dependencies: [],
                      },
                      {
                        id: 'phase:002:b',
                        title: 'Action B',
                        label: 'Action B',
                        deliverable: 'D2',
                        definitionOfDone: 'Done B',
                        estimateMin: 30,
                        category: 'CREATIVE_PRODUCTION',
                        dependencies: ['phase:001:a'],
                      },
                      {
                        id: 'phase:003:c',
                        title: 'Action C',
                        label: 'Action C',
                        deliverable: 'D3',
                        definitionOfDone: 'Done C',
                        estimateMin: 30,
                        category: 'CREATIVE_PRODUCTION',
                        dependencies: ['phase:002:b'],
                      },
                      {
                        id: 'phase:004:d',
                        title: 'Action D',
                        label: 'Action D',
                        deliverable: 'D4',
                        definitionOfDone: 'Done D',
                        estimateMin: 30,
                        category: 'CREATIVE_PRODUCTION',
                        dependencies: ['phase:003:c'],
                      },
                      {
                        id: 'phase:005:e',
                        title: 'Action E',
                        label: 'Action E',
                        deliverable: 'D5',
                        definitionOfDone: 'Done E',
                        estimateMin: 30,
                        category: 'CREATIVE_PRODUCTION',
                        dependencies: ['phase:004:d'],
                      },
                      {
                        id: 'phase:006:f',
                        title: 'Action F',
                        label: 'Action F',
                        deliverable: 'D6',
                        definitionOfDone: 'Done F',
                        estimateMin: 30,
                        category: 'CREATIVE_PRODUCTION',
                        dependencies: ['phase:005:e'],
                      },
                    ],
                    templates: [
                      {
                        title: 'Support habit',
                        domain: 'Focus',
                        durationMinutes: 20,
                        frequency: 'daily',
                        reason: 'Keep momentum',
                      },
                    ],
                    diagnostics: {
                      actionCount: 6,
                      totalEstimateMin: 180,
                      requiredWeeklyMinutes: 45,
                      weeklyCapMinutes: 300,
                      weeklyGapMinutes: 255,
                      reasonCodes: ['ON_TRACK'],
                      notes: [],
                    },
                  }),
                },
              ],
            }),
          } as Response;
        }
        return {
          ok: true,
          json: async () => ({
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  version: 'jericho_session_plan_v1',
                  sessions: [
                    {
                      date: '2026-03-12',
                      startTime: '09:00',
                      durationMinutes: 60,
                      actionSteps: ['Review objective', 'Execute work', 'Record output'],
                      completionCondition: 'Output logged',
                      deliverableId: 'deliv-1',
                      actionId: 'phase:001:a',
                    },
                  ],
                }),
              },
            ],
          }),
        } as Response;
      });

    const actionResult = await callClaudeForActionGraph(
      { goalText: 'Test goal' },
      { deadline: { dayKey: '2026-06-30' } },
      'GenericStructured',
      'test-key'
    );
    expect(actionResult.ok).toBe(true);

    const sessionResult = await callClaudeForSessionPlan({
      executionType: 'GenericStructured',
      contract: { startDayKey: '2026-03-12', deadline: { dayKey: '2026-06-30' } },
      actions: [
        {
          id: 'phase:001:a',
          title: 'Action A',
          label: 'Action A',
          deliverable: 'D1',
          definitionOfDone: 'Done',
          estimateMin: 30,
          category: 'CREATIVE_PRODUCTION',
          dependencies: [],
        },
      ],
      apiKey: 'test-key',
    });
    expect(sessionResult.ok).toBe(true);

    const bodies = fetchSpy.mock.calls.map((call) => JSON.parse(String(call[1]?.body || '{}')));
    expect(bodies[0].max_tokens).toBe(2000);
    expect(bodies[1].max_tokens).toBe(2000);

    fetchSpy.mockRestore();
  });
});
