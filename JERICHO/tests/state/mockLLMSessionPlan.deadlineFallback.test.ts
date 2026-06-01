import { describe, expect, it } from 'vitest';
import { callClaudeForSessionPlan } from '../../src/state/mockLLMActionGraph.ts';

describe('mock LLM session plan deadline fallback', () => {
  it('uses contract.endDayKey when deadlineISO is absent', async () => {
    const actions = Array.from({ length: 10 }).map((_, index) => ({
      id: `act-${index + 1}`,
      title: `Action ${index + 1}`,
      deliverableId: `deliv-${index + 1}`,
      estimateMin: 60,
    }));

    const result = await callClaudeForSessionPlan(
      {
        goalDraftV2: { goalText: 'Raise 25k', executionType: 'Fundraising' },
        contract: {
          startDayKey: '2026-03-12',
          endDayKey: '2026-06-30',
        },
        executionType: 'Fundraising',
        actions,
        cycleId: 'cycle-1',
        nowISO: '2026-03-12T12:00:00.000Z',
      },
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const dates = result.sessions.map((session) => session.date).sort();
    expect(dates[0]).toBe('2026-03-12');
    expect(dates.every((date) => date <= '2026-06-30')).toBe(true);
  });

  it('packs sessions into earlier working weeks instead of smearing them across the full horizon', async () => {
    const actions = Array.from({ length: 17 }).map((_, index) => ({
      id: `act-${index + 1}`,
      title: `Action ${index + 1}`,
      deliverableId: `deliv-${index + 1}`,
      estimateMin: 60,
    }));

    const result = await callClaudeForSessionPlan(
      {
        goalDraftV2: { goalText: 'Launch collection', executionType: 'ContentProduction' },
        contract: {
          startDayKey: '2026-03-20',
          endDayKey: '2026-06-30',
        },
        executionType: 'ContentProduction',
        actions,
        cycleId: 'cycle-2',
        nowISO: '2026-03-20T12:00:00.000Z',
      },
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const dates = result.sessions.map((session) => session.date);
    const aprilSessions = dates.filter((date) => String(date || '').startsWith('2026-04-'));
    const uniqueMarchDates = Array.from(new Set(dates.filter((date) => String(date || '').startsWith('2026-03-'))));

    expect(dates[0]).toBe('2026-03-20');
    expect(uniqueMarchDates.length).toBeGreaterThanOrEqual(2);
    expect(aprilSessions.length).toBeGreaterThanOrEqual(4);
    expect(dates[dates.length - 1] < '2026-06-15').toBe(true);
  });

  it('uses temporalBinding start and keeps long-horizon sessions inside the deadline corridor', async () => {
    const actions = Array.from({ length: 40 }).map((_, index) => ({
      id: `act-${index + 1}`,
      title: `Action ${index + 1}`,
      deliverableId: `deliv-${index + 1}`,
      estimateMin: 60,
    }));

    const result = await callClaudeForSessionPlan(
      {
        goalDraftV2: { goalText: 'Build a caffeinated gum brand and take it to first real sales' },
        contract: {
          temporalBinding: { startDayKey: '2026-01-01' },
          deadline: { dayKey: '2026-12-31' },
        },
        executionType: 'BrandLaunch',
        actions,
        cycleId: 'cycle-3',
        nowISO: '2026-04-17T12:00:00.000Z',
      },
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const dates = result.sessions.map((session) => session.date);
    expect(dates[0]).toBe('2026-01-01');
    expect(dates[dates.length - 1] <= '2026-12-31').toBe(true);
    expect(dates[dates.length - 1] >= '2026-02-01').toBe(true);
  });
});
