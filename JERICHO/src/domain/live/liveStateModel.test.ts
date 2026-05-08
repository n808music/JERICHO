import { describe, expect, it } from 'vitest';
import { deriveLiveState } from './liveStateModel';
import { deriveAutonomousStateChanges } from './liveStateEngine';

function makeExecutionBlock(id: string, day: string) {
  return {
    id,
    title: `Session ${id}`,
    actionId: id,
    startISO: `${day}T15:00:00.000Z`,
    endISO: `${day}T15:30:00.000Z`,
    blockType: 'execution',
  };
}

function makeCapitalGate(id: string, day: string) {
  return {
    id,
    title: `Capital checkpoint ${id}`,
    actionId: id,
    startISO: `${day}T16:00:00.000Z`,
    endISO: `${day}T16:30:00.000Z`,
    blockType: 'capital_checkpoint',
    capitalGateId: 'moq_production_deposit',
  };
}

function makePlan() {
  return {
    scheduledBlocks: [
      makeExecutionBlock('s1', '2026-05-01'),
      makeExecutionBlock('s2', '2026-05-02'),
      makeExecutionBlock('s3', '2026-05-03'),
      makeExecutionBlock('s4', '2026-05-04'),
      makeExecutionBlock('s5', '2026-05-05'),
      makeExecutionBlock('s6', '2026-05-06'),
      makeExecutionBlock('s7', '2026-05-07'),
      makeExecutionBlock('s8', '2026-05-08'),
      makeExecutionBlock('s9', '2026-05-09'),
      makeExecutionBlock('s10', '2026-05-10'),
      makeCapitalGate('gate-1', '2026-06-15'),
    ],
    summary: {},
  };
}

function complete(ids: string[]) {
  return ids.map((id) => ({
    blockId: id,
    kind: 'complete' as const,
    completed: true,
    dateISO: `2026-05-${String(Number(id.slice(1))).padStart(2, '0')}T18:00:00.000Z`,
  }));
}

describe('liveStateModel', () => {
  it('classifies live status across session-gap boundaries', () => {
    const plan = makePlan();

    expect(
      deriveLiveState({
        plan,
        asOf: '2026-05-05T12:00:00.000Z',
        completionLog: complete(['s1', 's2', 's3', 's4']),
      }).liveStatus
    ).toBe('ON_TRACK');

    expect(
      deriveLiveState({
        plan,
        asOf: '2026-05-08T12:00:00.000Z',
        completionLog: complete(['s1', 's2', 's3']),
      }).liveStatus
    ).toBe('DRIFTING');

    expect(
      deriveLiveState({
        plan,
        asOf: '2026-05-10T12:00:00.000Z',
        completionLog: complete(['s1']),
      }).liveStatus
    ).toBe('RECOVERABLE_SLIP');

    expect(
      deriveLiveState({
        plan,
        asOf: '2026-06-14T12:00:00.000Z',
        completionLog: [],
      }).liveStatus
    ).toBe('AT_RISK');
  });

  it('raises gate-approach logs at the defined thresholds', () => {
    const plan = makePlan();
    const changes = deriveAutonomousStateChanges({
      plan,
      asOf: '2026-05-25T12:00:00.000Z',
      completionLog: [],
    });
    expect(changes.some((change) => change.type === 'GATE_APPROACH' && /21 days/.test(change.reason))).toBe(true);
  });

  it('raises manufacturer timeout flags at caution and alert thresholds', () => {
    const plan = {
      scheduledBlocks: [
        {
          id: 'wait-1',
          title: 'Manufacturer initial response and quote wait',
          actionId: 'wait-1',
          startISO: '2026-05-01T09:00:00.000Z',
          endISO: '2026-05-31T09:00:00.000Z',
          blockType: 'waiting_period',
          waitType: 'manufacturer_initial_response',
          minimumDurationBusinessDays: 15,
          parallelWorkSuggestions: ['Founder Journey content'],
        },
      ],
      summary: {},
    };

    const caution = deriveLiveState({ plan, asOf: '2026-05-29T12:00:00.000Z', completionLog: [] });
    expect(caution.dimensionFlags.some((flag) => flag.dimension === 'domain' && flag.severity === 'caution')).toBe(true);

    const alert = deriveLiveState({ plan, asOf: '2026-06-12T12:00:00.000Z', completionLog: [] });
    expect(alert.dimensionFlags.some((flag) => flag.dimension === 'domain' && flag.severity === 'alert')).toBe(true);
  });

  it('raises presale aging flags when actual conversion materially trails projected', () => {
    const plan = {
      scheduledBlocks: [
        {
          id: 'presale-1',
          title: 'Presale campaign launch',
          actionId: 'presale-1',
          startISO: '2026-05-01T09:00:00.000Z',
          endISO: '2026-05-01T09:30:00.000Z',
          blockType: 'execution',
        },
        makeCapitalGate('gate-1', '2026-06-15'),
      ],
      summary: {
        capitalAcquisitionFeasibility: {
          capitalAcquisitionPath: { presaleMath: { audienceConversionRequired: 0.0087 } },
        },
      },
    };
    const live = deriveLiveState({
      plan,
      asOf: '2026-06-05T12:00:00.000Z',
      completionLog: [],
      runtimeEvents: [{ kind: 'presale_update', recordedAt: '2026-06-05T12:00:00.000Z', orderCount: 18, conversionRate: 0.0009 }],
      intake: { capitalAcquisitionRequired: true, capitalAvailable: 0 } as any,
    });
    expect(live.dimensionFlags.some((flag) => flag.dimension === 'capital' && flag.severity === 'alert')).toBe(true);
  });

  it('is deterministic for the same source data', () => {
    const input = {
      plan: makePlan(),
      asOf: '2026-05-08T12:00:00.000Z',
      completionLog: complete(['s1', 's2', 's3']),
    };
    expect(deriveLiveState(input)).toEqual(deriveLiveState(input));
  });
});

