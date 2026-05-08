import { describe, expect, it } from 'vitest';
import { deriveDailyCheckIn } from './dailyCheckIn';
import { appendCompletionLogEntries, deriveAutonomousStateChanges } from './liveStateEngine';

function makePlan() {
  return {
    scheduledBlocks: [
      {
        id: 'wait-1',
        title: 'Manufacturer initial response and quote wait',
        actionId: 'wait-1',
        startISO: '2026-05-01T09:00:00.000Z',
        endISO: '2026-05-21T09:00:00.000Z',
        blockType: 'waiting_period',
        waitType: 'manufacturer_initial_response',
        minimumDurationBusinessDays: 15,
        parallelWorkSuggestions: ['Founder Journey content', 'compliance research'],
      },
      {
        id: 'session-1',
        title: 'Request stock formula catalog from Manufacturer 3',
        actionId: 'session-1',
        startISO: '2026-05-12T15:00:00.000Z',
        endISO: '2026-05-12T15:45:00.000Z',
        blockType: 'execution',
      },
      {
        id: 'gate-1',
        title: 'Capital checkpoint 4 - MOQ production deposit',
        actionId: 'gate-1',
        startISO: '2026-08-01T09:00:00.000Z',
        endISO: '2026-08-01T09:30:00.000Z',
        blockType: 'capital_checkpoint',
        capitalGateId: 'moq_production_deposit',
      },
    ],
    summary: {
      capitalAcquisitionFeasibility: {
        capitalAcquisitionPath: { presaleMath: { audienceConversionRequired: 0.0087 } },
      },
    },
  };
}

describe('dailyCheckIn', () => {
  it('renders sections in state -> signals -> action -> check-in order', () => {
    const view = deriveDailyCheckIn({
      plan: makePlan(),
      asOf: '2026-05-12T12:00:00.000Z',
      completionLog: [],
      intake: { capitalAcquisitionRequired: true, capitalAvailable: 0 } as any,
    });
    expect(view.sections.map((section) => section.key)).toEqual([
      'where_you_are',
      'what_the_system_noticed',
      'todays_action',
      'check_in_prompt',
    ]);
  });

  it('surfaces a full gap recap after 4+ days away', () => {
    const view = deriveDailyCheckIn({
      plan: makePlan(),
      asOf: '2026-05-20T12:00:00.000Z',
      lastCheckInISO: '2026-05-02T12:00:00.000Z',
      completionLog: [],
      runtimeEvents: [
        {
          kind: 'manufacturer_response',
          manufacturerName: 'Manufacturer B',
          respondedAt: '2026-05-15T12:00:00.000Z',
          detail: 'a catalog',
        },
      ],
      intake: { capitalAcquisitionRequired: true, capitalAvailable: 0 } as any,
    });
    expect(view.gapRecap[0].message).toMatch(/18 days since your last check-in/i);
    expect(view.gapRecap.some((event) => /Manufacturer B responded/i.test(event.message))).toBe(true);
  });

  it('offers re-engagement options after a 31+ day gap and hides resume when a hard gate is missed', () => {
    const view = deriveDailyCheckIn({
      plan: {
        scheduledBlocks: [
          {
            id: 'gate-1',
            title: 'Capital checkpoint 4 - MOQ production deposit',
            actionId: 'gate-1',
            startISO: '2026-05-01T09:00:00.000Z',
            endISO: '2026-05-01T09:30:00.000Z',
            blockType: 'capital_checkpoint',
            capitalGateId: 'moq_production_deposit',
          },
        ],
      },
      asOf: '2026-06-15T12:00:00.000Z',
      lastCheckInISO: '2026-05-01T12:00:00.000Z',
      completionLog: [],
      intake: { capitalAcquisitionRequired: true, capitalAvailable: 0 } as any,
    });
    expect(view.reengagementOptions).toEqual(['RESTRUCTURE', 'CLOSE']);
  });

  it('keeps the completion log append-only', () => {
    const log = appendCompletionLogEntries([{ blockId: 'a', kind: 'complete' as const }], [
      { blockId: 'b', kind: 'complete' as const },
    ]);
    expect(log).toHaveLength(2);
    expect(log[0].blockId).toBe('a');
    expect(log[1].blockId).toBe('b');
  });

  it('logs autonomous updates with timestamp and reason', () => {
    const changes = deriveAutonomousStateChanges({
      plan: makePlan(),
      asOf: '2026-05-20T12:00:00.000Z',
      completionLog: [],
      intake: { capitalAcquisitionRequired: true, capitalAvailable: 0 } as any,
    });
    expect(changes.every((change) => Boolean(change.timestamp) && Boolean(change.reason))).toBe(true);
  });
});

