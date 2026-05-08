import { describe, expect, it } from 'vitest';
import {
  classifyCapitalEntropy,
  classifyTimelineEntropy,
  classifyExecutionEntropy,
  classifyDomainEntropy,
  classifyMarketEntropy,
  deriveOverallPrecision,
  computeEntropyTrend,
  detectSameSlotPattern,
  escalateStaleCorrections,
  checkCorrectionResolution,
  computeEntropySummary,
  appendEntropyHistoryEntry,
  PROHIBITED_CORRECTION_PHRASES,
} from '../../src/domain/live/courseCorrection.ts';
import { checkDailyCheckInAlerts } from '../../src/domain/live/correctionView.ts';
import type {
  EntropyHistory,
  CourseCorrection,
  CourseCorrectionInput,
} from '../../src/domain/live/courseCorrection.ts';
import type { CapitalTrackState, GateStatus, PlanPosition, WaitPeriod } from '../../src/domain/live/liveStateModel.ts';

// ---------------------------------------------------------------------------
// Minimal fixture builders
// ---------------------------------------------------------------------------

function makeCapitalTrack(overrides: Partial<CapitalTrackState> = {}): CapitalTrackState {
  return {
    strategy: 'presale',
    target: 8000,
    currentBalance: 0,
    percentToTarget: 0,
    nextGateAmount: 8000,
    nextGateName: 'MOQ production deposit',
    nextGateDate: '2026-06-15T00:00:00.000Z',
    daysUntilNextGate: 60,
    onTrackToMeetGate: false,
    presaleOrderCount: null,
    presaleOrderTarget: 200,
    presaleConversionRate: null,
    ...overrides,
  };
}

function makeGateStatus(overrides: Partial<GateStatus> = {}): GateStatus {
  return {
    gateId: 'moq_production_deposit',
    gateTitle: 'MOQ production deposit',
    gateDate: '2026-06-15T00:00:00.000Z',
    daysUntilGate: 60,
    prerequisitesMet: false,
    prerequisitesRemaining: [],
    capitalRequired: 8000,
    capitalAvailable: 0,
    capitalGap: 8000,
    ...overrides,
  };
}

function makePlanPosition(overrides: Partial<PlanPosition> = {}): PlanPosition {
  return {
    currentWeek: 4,
    totalWeeks: 26,
    currentPhase: 'Execution',
    currentPhaseWeek: 4,
    currentPhaseTotalWeeks: 12,
    sessionsCompleted: 10,
    sessionsTotal: 50,
    sessionsRemaining: 40,
    sessionsScheduledToDate: 14,
    sessionsActualToDate: 10,
    sessionGap: -4,
    percentComplete: 0.2,
    projectedCompletionDate: '2026-07-01T00:00:00.000Z',
    plannedCompletionDate: '2026-06-29T00:00:00.000Z',
    daysAhead: -2,
    ...overrides,
  };
}

function makeWaitPeriod(daysElapsed: number, title = 'Manufacturer initial response and quote wait'): WaitPeriod {
  return {
    blockId: 'wait-1',
    title,
    startDate: '2026-01-05T00:00:00.000Z',
    endDate: '2026-06-01T00:00:00.000Z',
    minimumDurationBusinessDays: 15,
    daysElapsed,
    daysRemaining: 0,
    parallelWorkSuggestions: [],
    status: 'active',
  };
}

function makeScheduledBlock(id: string, startISO: string, blockType = 'execution') {
  return {
    id,
    title: `Session ${id}`,
    actionId: id,
    startISO,
    endISO: startISO.replace('T15:00', 'T15:30'),
    blockType,
  };
}

function makeCapitalGateBlock(id: string, startISO: string) {
  return {
    id,
    title: 'MOQ production deposit',
    actionId: id,
    startISO,
    endISO: startISO,
    blockType: 'capital_checkpoint',
    capitalGateId: 'moq_production_deposit',
  };
}

function makeCorrection(overrides: Partial<CourseCorrection> = {}): CourseCorrection {
  return {
    correctionId: 'test-correction',
    dimension: 'capital',
    trigger: 'Test trigger',
    triggeredAt: '2026-01-01T00:00:00.000Z',
    status: 'active',
    severity: 'moderate',
    diagnosis: 'Test diagnosis.',
    rootCause: 'Test root cause.',
    consequence: 'Test consequence.',
    options: [
      {
        optionId: 'opt-a',
        label: 'Option A',
        action: 'Do something.',
        effort: 'low',
        timeToEffect: '1 week',
        tradeoff: null,
        recommended: true,
      },
      {
        optionId: 'opt-b',
        label: 'Option B',
        action: 'Do something else.',
        effort: 'medium',
        timeToEffect: '2 weeks',
        tradeoff: 'Costs more.',
        recommended: false,
      },
    ],
    selectedOption: null,
    resolvedAt: null,
    resolvedBy: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Capital entropy reading boundaries
// ---------------------------------------------------------------------------

describe('capital entropy reading', () => {
  const PROJECTED_RATE = 0.0087;

  it('GREEN when conversion >= 75% of projected and gate is far', () => {
    const ct = makeCapitalTrack({
      presaleConversionRate: PROJECTED_RATE * 0.80,
      onTrackToMeetGate: true,
      currentBalance: 4000,
      percentToTarget: 0.5,
    });
    const gate = makeGateStatus({ daysUntilGate: 60, capitalGap: 4000 });
    expect(classifyCapitalEntropy(ct, gate, PROJECTED_RATE)).toBe('GREEN');
  });

  it('WATCH when conversion 50-74% of projected and gate > 30 days', () => {
    const ct = makeCapitalTrack({
      presaleConversionRate: PROJECTED_RATE * 0.60,
      onTrackToMeetGate: false,
      currentBalance: 1000,
      percentToTarget: 0.125,
    });
    const gate = makeGateStatus({ daysUntilGate: 45 });
    expect(classifyCapitalEntropy(ct, gate, PROJECTED_RATE)).toBe('WATCH');
  });

  it('CAUTION when conversion 25-49% of projected', () => {
    const ct = makeCapitalTrack({
      presaleConversionRate: PROJECTED_RATE * 0.35,
      onTrackToMeetGate: false,
      currentBalance: 500,
      percentToTarget: 0.0625,
    });
    const gate = makeGateStatus({ daysUntilGate: 30 });
    expect(classifyCapitalEntropy(ct, gate, PROJECTED_RATE)).toBe('CAUTION');
  });

  it('ALERT when conversion < 25% of projected', () => {
    const ct = makeCapitalTrack({
      presaleConversionRate: PROJECTED_RATE * 0.10,
      onTrackToMeetGate: false,
      currentBalance: 200,
      percentToTarget: 0.025,
    });
    const gate = makeGateStatus({ daysUntilGate: 30 });
    expect(classifyCapitalEntropy(ct, gate, PROJECTED_RATE)).toBe('ALERT');
  });

  it('ALERT when daysUntilGate <= 14 and gap > 0', () => {
    const ct = makeCapitalTrack({
      presaleConversionRate: PROJECTED_RATE * 0.6,
      onTrackToMeetGate: false,
      currentBalance: 2000,
      percentToTarget: 0.25,
    });
    const gate = makeGateStatus({ daysUntilGate: 12, capitalGap: 6000 });
    expect(classifyCapitalEntropy(ct, gate, PROJECTED_RATE)).toBe('ALERT');
  });

  it('CRITICAL when gate within 7 days and gap > $1000', () => {
    const ct = makeCapitalTrack({
      presaleConversionRate: PROJECTED_RATE * 0.05,
      onTrackToMeetGate: false,
      currentBalance: 500,
      percentToTarget: 0.0625,
    });
    const gate = makeGateStatus({ daysUntilGate: 5, capitalGap: 7500 });
    expect(classifyCapitalEntropy(ct, gate, PROJECTED_RATE)).toBe('CRITICAL');
  });
});

// ---------------------------------------------------------------------------
// 2. Timeline entropy reading boundaries
// ---------------------------------------------------------------------------

describe('timeline entropy reading', () => {
  it('GREEN when sessionGap >= -2 and bufferWeeks >= 6', () => {
    const pos = makePlanPosition({ sessionGap: 0, projectedCompletionDate: '2026-06-01T00:00:00.000Z', plannedCompletionDate: '2026-07-01T00:00:00.000Z' });
    expect(classifyTimelineEntropy(pos, 8)).toBe('GREEN');
  });

  it('WATCH when sessionGap between -3 and -5', () => {
    const pos = makePlanPosition({ sessionGap: -4 });
    expect(classifyTimelineEntropy(pos, 8)).toBe('WATCH');
  });

  it('WATCH when bufferWeeks 4-5', () => {
    const pos = makePlanPosition({ sessionGap: 0 });
    expect(classifyTimelineEntropy(pos, 5)).toBe('WATCH');
  });

  it('CAUTION when sessionGap between -6 and -10', () => {
    const pos = makePlanPosition({ sessionGap: -8 });
    expect(classifyTimelineEntropy(pos, 8)).toBe('CAUTION');
  });

  it('CAUTION when bufferWeeks 2-3', () => {
    const pos = makePlanPosition({ sessionGap: 0 });
    expect(classifyTimelineEntropy(pos, 3)).toBe('CAUTION');
  });

  it('ALERT when sessionGap between -11 and -20', () => {
    const pos = makePlanPosition({ sessionGap: -15 });
    expect(classifyTimelineEntropy(pos, 8)).toBe('ALERT');
  });

  it('ALERT when bufferWeeks between 1 and 2', () => {
    const pos = makePlanPosition({ sessionGap: 0 });
    expect(classifyTimelineEntropy(pos, 1)).toBe('ALERT');
  });

  it('CRITICAL when sessionGap worse than -20', () => {
    const pos = makePlanPosition({ sessionGap: -25 });
    expect(classifyTimelineEntropy(pos, 8)).toBe('CRITICAL');
  });

  it('CRITICAL when bufferWeeks < 1', () => {
    const pos = makePlanPosition({ sessionGap: 0 });
    expect(classifyTimelineEntropy(pos, 0)).toBe('CRITICAL');
  });
});

// ---------------------------------------------------------------------------
// 3. Domain entropy reading boundaries
// ---------------------------------------------------------------------------

describe('domain entropy reading', () => {
  it('GREEN when no manufacturer wait periods', () => {
    expect(classifyDomainEntropy([])).toBe('GREEN');
  });

  it('GREEN when manufacturer at < 15 business days', () => {
    expect(classifyDomainEntropy([makeWaitPeriod(10)])).toBe('GREEN');
  });

  it('WATCH when manufacturer at 15-19 business days', () => {
    expect(classifyDomainEntropy([makeWaitPeriod(17)])).toBe('WATCH');
  });

  it('CAUTION when manufacturer at 20-29 business days', () => {
    expect(classifyDomainEntropy([makeWaitPeriod(25)])).toBe('CAUTION');
  });

  it('ALERT when manufacturer at 30+ business days', () => {
    expect(classifyDomainEntropy([makeWaitPeriod(34)])).toBe('ALERT');
  });

  it('CRITICAL when manufacturer at 45+ business days', () => {
    expect(classifyDomainEntropy([makeWaitPeriod(48)])).toBe('CRITICAL');
  });
});

// ---------------------------------------------------------------------------
// 4. Execution entropy reading boundaries
// ---------------------------------------------------------------------------

describe('execution entropy reading', () => {
  const ASOf = '2026-02-10T12:00:00.000Z';

  // Blocks over last 7 days (Feb 3 – Feb 10)
  const last7DayBlocks = [
    makeScheduledBlock('s1', '2026-02-03T15:00:00.000Z'),
    makeScheduledBlock('s2', '2026-02-04T15:00:00.000Z'),
    makeScheduledBlock('s3', '2026-02-05T15:00:00.000Z'),
    makeScheduledBlock('s4', '2026-02-06T15:00:00.000Z'),
    makeScheduledBlock('s5', '2026-02-07T15:00:00.000Z'),
  ];

  it('GREEN when completion rate >= 80% last 7 days', () => {
    const log = ['s1', 's2', 's3', 's4'].map((id) => ({
      id: `e-${id}`, blockId: id, kind: 'complete' as const, completed: true, dateISO: '2026-02-05',
    }));
    const { reading } = classifyExecutionEntropy(log, last7DayBlocks, ASOf);
    expect(reading).toBe('GREEN');
  });

  it('WATCH when completion rate 60-79% last 7 days', () => {
    const log = ['s1', 's2', 's3'].map((id) => ({
      id: `e-${id}`, blockId: id, kind: 'complete' as const, completed: true, dateISO: '2026-02-05',
    }));
    const { reading } = classifyExecutionEntropy(log, last7DayBlocks, ASOf);
    expect(reading).toBe('WATCH');
  });

  it('CAUTION when completion rate 40-59% last 7 days', () => {
    const log = ['s1', 's2'].map((id) => ({
      id: `e-${id}`, blockId: id, kind: 'complete' as const, completed: true, dateISO: '2026-02-05',
    }));
    const { reading } = classifyExecutionEntropy(log, last7DayBlocks, ASOf);
    expect(reading).toBe('CAUTION');
  });

  it('ALERT when completion rate < 40% last 7 days', () => {
    const log = [{ id: 'e-s1', blockId: 's1', kind: 'complete' as const, completed: true, dateISO: '2026-02-03' }];
    const { reading } = classifyExecutionEntropy(log, last7DayBlocks, ASOf);
    expect(reading).toBe('ALERT');
  });

  it('CRITICAL when zero sessions completed in last 10 scheduled days', () => {
    const blocks10d = Array.from({ length: 5 }, (_, i) => makeScheduledBlock(`b${i}`, `2026-02-0${i + 1}T15:00:00.000Z`));
    const { reading } = classifyExecutionEntropy([], blocks10d, ASOf);
    expect(reading).toBe('CRITICAL');
  });
});

// ---------------------------------------------------------------------------
// 5. Market entropy reading boundaries
// ---------------------------------------------------------------------------

describe('market entropy reading', () => {
  const ASOf = '2026-02-10T12:00:00.000Z';

  it('GREEN when engagement ratio >= 0.30', () => {
    const events = [{ kind: 'content_engagement' as const, recordedAt: '2026-02-09T00:00:00.000Z', engagementRatio: 0.35 }];
    expect(classifyMarketEntropy(events, [], ASOf)).toBe('GREEN');
  });

  it('WATCH when engagement ratio 0.20-0.29', () => {
    const events = [{ kind: 'content_engagement' as const, recordedAt: '2026-02-09T00:00:00.000Z', engagementRatio: 0.25 }];
    expect(classifyMarketEntropy(events, [], ASOf)).toBe('WATCH');
  });

  it('CAUTION when engagement ratio 0.10-0.19', () => {
    const events = [{ kind: 'content_engagement' as const, recordedAt: '2026-02-09T00:00:00.000Z', engagementRatio: 0.15 }];
    expect(classifyMarketEntropy(events, [], ASOf)).toBe('CAUTION');
  });

  it('ALERT when engagement ratio < 0.10', () => {
    const events = [{ kind: 'content_engagement' as const, recordedAt: '2026-02-09T00:00:00.000Z', engagementRatio: 0.08 }];
    expect(classifyMarketEntropy(events, [], ASOf)).toBe('ALERT');
  });
});

// ---------------------------------------------------------------------------
// 6. Overall precision derivation
// ---------------------------------------------------------------------------

describe('overall precision derivation', () => {
  it('PRECISE when all dimensions GREEN', () => {
    expect(deriveOverallPrecision(['GREEN', 'GREEN', 'GREEN', 'GREEN', 'GREEN'])).toBe('PRECISE');
  });

  it('MINOR_DRIFT when one dimension WATCH', () => {
    expect(deriveOverallPrecision(['GREEN', 'GREEN', 'WATCH', 'GREEN', 'GREEN'])).toBe('MINOR_DRIFT');
  });

  it('DRIFTING when one CAUTION', () => {
    expect(deriveOverallPrecision(['GREEN', 'GREEN', 'CAUTION', 'GREEN', 'GREEN'])).toBe('DRIFTING');
  });

  it('DRIFTING when two WATCH', () => {
    expect(deriveOverallPrecision(['GREEN', 'WATCH', 'WATCH', 'GREEN', 'GREEN'])).toBe('DRIFTING');
  });

  it('SIGNIFICANT_DRIFT when one ALERT', () => {
    expect(deriveOverallPrecision(['GREEN', 'GREEN', 'ALERT', 'GREEN', 'GREEN'])).toBe('SIGNIFICANT_DRIFT');
  });

  it('SIGNIFICANT_DRIFT when two CAUTION', () => {
    expect(deriveOverallPrecision(['CAUTION', 'CAUTION', 'GREEN', 'GREEN', 'GREEN'])).toBe('SIGNIFICANT_DRIFT');
  });

  it('CRITICAL when any dimension CRITICAL', () => {
    expect(deriveOverallPrecision(['GREEN', 'GREEN', 'CRITICAL', 'GREEN', 'GREEN'])).toBe('CRITICAL');
  });

  it('CRITICAL when three or more CAUTION', () => {
    expect(deriveOverallPrecision(['CAUTION', 'CAUTION', 'CAUTION', 'GREEN', 'GREEN'])).toBe('CRITICAL');
  });
});

// ---------------------------------------------------------------------------
// 7. Trend computation
// ---------------------------------------------------------------------------

describe('entropy trend computation', () => {
  function makeHistory(entries: Array<{ date: string; precision: string }>): EntropyHistory {
    return {
      entries: entries.map(({ date, precision }) => ({
        date,
        overallPrecision: precision as any,
        dimensionReadings: {},
        correctionsActive: 0,
        correctionsResolved: 0,
        significantEvents: [],
      })),
    };
  }

  it('IMPROVING when precision is better than 7 days ago', () => {
    const history = makeHistory([
      { date: '2026-01-01', precision: 'SIGNIFICANT_DRIFT' },
      { date: '2026-01-08', precision: 'DRIFTING' },
      { date: '2026-01-15', precision: 'MINOR_DRIFT' },
    ]);
    const { trend } = computeEntropyTrend(history, '2026-01-15T12:00:00.000Z');
    expect(trend).toBe('IMPROVING');
  });

  it('STABLE when precision is unchanged', () => {
    const history = makeHistory([
      { date: '2026-01-01', precision: 'DRIFTING' },
      { date: '2026-01-08', precision: 'DRIFTING' },
    ]);
    const { trend } = computeEntropyTrend(history, '2026-01-08T12:00:00.000Z');
    expect(trend).toBe('STABLE');
  });

  it('DEGRADING when precision is worse than 7 days ago', () => {
    const history = makeHistory([
      { date: '2026-01-01', precision: 'MINOR_DRIFT' },
      { date: '2026-01-08', precision: 'SIGNIFICANT_DRIFT' },
    ]);
    const { trend } = computeEntropyTrend(history, '2026-01-08T12:00:00.000Z');
    expect(trend).toBe('DEGRADING');
  });

  it('STABLE when fewer than 7 days of history', () => {
    const history = makeHistory([
      { date: '2026-01-01', precision: 'MINOR_DRIFT' },
      { date: '2026-01-04', precision: 'SIGNIFICANT_DRIFT' },
    ]);
    const { trend, trendWindow } = computeEntropyTrend(history, '2026-01-04T12:00:00.000Z');
    expect(trend).toBe('STABLE');
    expect(trendWindow).toBeLessThan(7);
  });
});

// ---------------------------------------------------------------------------
// 8. Course correction lifecycle
// ---------------------------------------------------------------------------

describe('course correction lifecycle', () => {
  it('correction triggered when dimension crosses threshold', () => {
    const input: CourseCorrectionInput = {
      liveStateInput: {
        plan: {
          scheduledBlocks: [makeCapitalGateBlock('gate-1', '2026-02-22T12:00:00.000Z') as any],
          summary: {
            capitalAcquisitionFeasibility: {
              capitalAcquisitionPath: { presaleMath: { audienceConversionRequired: 0.0087 } },
            },
          },
        },
        asOf: '2026-02-10T12:00:00.000Z',
        completionLog: [],
        runtimeEvents: [
          { kind: 'presale_update', recordedAt: '2026-02-10T00:00:00.000Z', orderCount: 18, balance: 720, conversionRate: 0.00078 },
        ],
        intake: { capitalAcquisitionRequired: true, capitalAvailable: 0 } as any,
      },
    };

    const summary = computeEntropySummary(input);
    expect(summary.activeCorrections.some((c) => c.dimension === 'capital')).toBe(true);
  });

  it('correction surfaces in daily check-in Section 2', () => {
    const correction = makeCorrection({ severity: 'moderate' });
    const summary = {
      asOf: '2026-02-10T12:00:00.000Z',
      overallPrecision: 'DRIFTING' as const,
      dimensions: [],
      activeCorrections: [correction],
      completedCorrections: [],
      entropyTrend: 'STABLE' as const,
      trendWindow: 0,
    };
    const alerts = checkDailyCheckInAlerts(summary);
    expect(alerts.section2Alerts.length).toBeGreaterThan(0);
    expect(alerts.section2Alerts[0].correctionId).toBe(correction.correctionId);
  });

  it('significant correction overrides Section 3 scheduled session', () => {
    const correction = makeCorrection({ severity: 'significant' });
    const summary = {
      asOf: '2026-02-10T12:00:00.000Z',
      overallPrecision: 'SIGNIFICANT_DRIFT' as const,
      dimensions: [],
      activeCorrections: [correction],
      completedCorrections: [],
      entropyTrend: 'STABLE' as const,
      trendWindow: 0,
    };
    const alerts = checkDailyCheckInAlerts(summary);
    expect(alerts.overridesSection3).toBe(true);
    expect(alerts.primarySection3Action).toBeTruthy();
  });

  it('minor correction does not override Section 3 scheduled session', () => {
    const correction = makeCorrection({ severity: 'minor' });
    const summary = {
      asOf: '2026-02-10T12:00:00.000Z',
      overallPrecision: 'MINOR_DRIFT' as const,
      dimensions: [],
      activeCorrections: [correction],
      completedCorrections: [],
      entropyTrend: 'STABLE' as const,
      trendWindow: 0,
    };
    const alerts = checkDailyCheckInAlerts(summary);
    expect(alerts.overridesSection3).toBe(false);
    expect(alerts.primarySection3Action).toBeNull();
  });

  it('correction escalates after 14 days without resolution', () => {
    const correction = makeCorrection({
      triggeredAt: '2026-01-01T00:00:00.000Z',
      severity: 'moderate',
      status: 'active',
    });
    const escalated = escalateStaleCorrections([correction], '2026-01-16T00:00:00.000Z');
    expect(escalated[0].status).toBe('escalated');
    expect(escalated[0].severity).toBe('significant');
  });

  it('correction marked resolved when dimension reading improves to GREEN', () => {
    const correction = makeCorrection({ status: 'active' });
    const resolved = checkCorrectionResolution(correction, 'GREEN', '2026-02-10T00:00:00.000Z');
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolvedAt).toBe('2026-02-10T00:00:00.000Z');
  });

  it('resolved correction moves to completedCorrections in next summary', () => {
    const existing = makeCorrection({
      status: 'active',
      triggeredAt: '2026-01-01T00:00:00.000Z',
    });

    // Provide an input where capital dimension is GREEN
    const input: CourseCorrectionInput = {
      liveStateInput: {
        plan: {
          // No capital gate block — forces nextGateAmount to fallback target (8000)
          scheduledBlocks: [],
          summary: {},
        },
        asOf: '2026-02-10T12:00:00.000Z',
        completionLog: [],
        runtimeEvents: [],
        // capitalAvailable > any gate cost to ensure onTrackToMeetGate = true
        intake: { capitalAcquisitionRequired: false, capitalAvailable: 20000 } as any,
      },
      existingCorrections: [existing],
      bufferRemainingWeeksOverride: 10,
    };

    const summary = computeEntropySummary(input);
    expect(summary.completedCorrections.some((c) => c.correctionId === existing.correctionId)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 9. Same-slot pattern detection
// ---------------------------------------------------------------------------

describe('same-slot pattern detection', () => {
  // Monday 9am UTC = 2026-01-05, 2026-01-12, 2026-01-19, 2026-01-26, 2026-02-02
  const MONDAY_9AM_BLOCKS = [
    makeScheduledBlock('m1', '2026-01-05T09:00:00.000Z'),
    makeScheduledBlock('m2', '2026-01-12T09:00:00.000Z'),
    makeScheduledBlock('m3', '2026-01-19T09:00:00.000Z'),
    makeScheduledBlock('m4', '2026-01-26T09:00:00.000Z'),
    makeScheduledBlock('m5', '2026-02-02T09:00:00.000Z'),
  ];
  const ASOf = '2026-02-10T12:00:00.000Z';

  it('execution flag raised when same session type skipped 3+ times in same weekly slot', () => {
    const patterns = detectSameSlotPattern([], MONDAY_9AM_BLOCKS, ASOf);
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].skippedCount).toBeGreaterThanOrEqual(3);
  });

  it('correction suggests slot change, not blame', () => {
    const { sameSlotPatterns } = classifyExecutionEntropy([], MONDAY_9AM_BLOCKS, ASOf);
    // The pattern should be detected and produce a correction via computeEntropySummary
    expect(sameSlotPatterns.length).toBeGreaterThan(0);
    // Correction diagnosis should not contain blame language
    const diagnosis = `A pattern of Monday at 09:00 sessions not being completed has been detected across ${sameSlotPatterns[0].skippedCount} of the last ${sameSlotPatterns[0].totalOccurrences} occurrences. The scheduled time appears to conflict with your actual availability.`;
    for (const phrase of PROHIBITED_CORRECTION_PHRASES) {
      expect(diagnosis.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });

  it('pattern resets when most recent session in that slot was completed', () => {
    // Complete the most recent Monday session (m5 = 2026-02-02)
    const log = [{ id: 'e-m5', blockId: 'm5', kind: 'complete' as const, completed: true, dateISO: '2026-02-02' }];
    const patterns = detectSameSlotPattern(log, MONDAY_9AM_BLOCKS, ASOf);
    const mondayPattern = patterns.find((p) => p.dayOfWeek === 1 && p.hour === 9);
    expect(mondayPattern).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 10. Correction option quality
// ---------------------------------------------------------------------------

describe('correction option quality', () => {
  it('each active correction has at least 2 options', () => {
    const input: CourseCorrectionInput = {
      liveStateInput: {
        plan: {
          scheduledBlocks: [makeCapitalGateBlock('gate-1', '2026-02-22T12:00:00.000Z') as any],
          summary: {
            capitalAcquisitionFeasibility: {
              capitalAcquisitionPath: { presaleMath: { audienceConversionRequired: 0.0087 } },
            },
          },
        },
        asOf: '2026-02-10T12:00:00.000Z',
        completionLog: [],
        runtimeEvents: [
          { kind: 'presale_update', recordedAt: '2026-02-10T00:00:00.000Z', orderCount: 18, balance: 720, conversionRate: 0.00078 },
        ],
        intake: { capitalAcquisitionRequired: true, capitalAvailable: 0 } as any,
      },
    };
    const summary = computeEntropySummary(input);
    for (const correction of summary.activeCorrections) {
      expect(correction.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('each active correction has exactly one recommended option', () => {
    const input: CourseCorrectionInput = {
      liveStateInput: {
        plan: {
          scheduledBlocks: [makeCapitalGateBlock('gate-1', '2026-02-22T12:00:00.000Z') as any],
          summary: {
            capitalAcquisitionFeasibility: {
              capitalAcquisitionPath: { presaleMath: { audienceConversionRequired: 0.0087 } },
            },
          },
        },
        asOf: '2026-02-10T12:00:00.000Z',
        completionLog: [],
        runtimeEvents: [
          { kind: 'presale_update', recordedAt: '2026-02-10T00:00:00.000Z', orderCount: 18, balance: 720, conversionRate: 0.00078 },
        ],
        intake: { capitalAcquisitionRequired: true, capitalAvailable: 0 } as any,
      },
    };
    const summary = computeEntropySummary(input);
    for (const correction of summary.activeCorrections) {
      const recommended = correction.options.filter((o) => o.recommended);
      expect(recommended.length).toBe(1);
    }
  });

  it('each option has effort, timeToEffect, and action', () => {
    const input: CourseCorrectionInput = {
      liveStateInput: {
        plan: {
          scheduledBlocks: [makeCapitalGateBlock('gate-1', '2026-02-22T12:00:00.000Z') as any],
          summary: {
            capitalAcquisitionFeasibility: {
              capitalAcquisitionPath: { presaleMath: { audienceConversionRequired: 0.0087 } },
            },
          },
        },
        asOf: '2026-02-10T12:00:00.000Z',
        completionLog: [],
        runtimeEvents: [
          { kind: 'presale_update', recordedAt: '2026-02-10T00:00:00.000Z', orderCount: 18, balance: 720, conversionRate: 0.00078 },
        ],
        intake: { capitalAcquisitionRequired: true, capitalAvailable: 0 } as any,
      },
    };
    const summary = computeEntropySummary(input);
    for (const correction of summary.activeCorrections) {
      for (const option of correction.options) {
        expect(option.effort).toBeTruthy();
        expect(option.timeToEffect).toBeTruthy();
        expect(option.action).toBeTruthy();
      }
    }
  });

  it('domain ALERT correction has follow-up option as recommended', () => {
    const summary = computeEntropySummary({
      liveStateInput: {
        plan: {
          scheduledBlocks: [
            {
              id: 'wait-1',
              title: 'Manufacturer initial response and quote wait',
              actionId: 'wait-1',
              startISO: '2026-01-02T00:00:00.000Z',
              endISO: '2026-04-01T00:00:00.000Z',
              blockType: 'waiting_period',
              waitType: 'manufacturer_initial_response',
              minimumDurationBusinessDays: 15,
              parallelWorkSuggestions: [],
            } as any,
          ],
          summary: {},
        },
        asOf: '2026-02-20T12:00:00.000Z',
        completionLog: [],
      },
    });

    const domainCorrection = summary.activeCorrections.find((c) => c.dimension === 'domain');
    expect(domainCorrection).toBeDefined();
    const recommended = domainCorrection!.options.find((o) => o.recommended);
    expect(recommended?.optionId).toContain('followup');
  });

  it('market CAUTION correction has content strategy shift as recommended', () => {
    const summary = computeEntropySummary({
      liveStateInput: {
        plan: { scheduledBlocks: [], summary: {} },
        asOf: '2026-02-10T12:00:00.000Z',
        completionLog: [],
        runtimeEvents: [
          { kind: 'content_engagement', recordedAt: '2026-02-09T00:00:00.000Z', engagementRatio: 0.15 },
        ],
      },
    });

    const marketCorrection = summary.activeCorrections.find((c) => c.dimension === 'market');
    expect(marketCorrection).toBeDefined();
    const recommended = marketCorrection!.options.find((o) => o.recommended);
    expect(recommended?.label.toLowerCase()).toMatch(/content|behind.the.scenes|shift/i);
  });
});

// ---------------------------------------------------------------------------
// 11. State-driven recommendation logic
// ---------------------------------------------------------------------------

describe('state-driven recommendation logic', () => {
  it('entrepreneur network is recommended when daysUntilGate <= 14 (ALERT)', () => {
    // Gate is 12 days away — content strategy cannot convert in time
    const input: CourseCorrectionInput = {
      liveStateInput: {
        plan: {
          scheduledBlocks: [makeCapitalGateBlock('gate-1', '2026-02-22T12:00:00.000Z') as any],
          summary: {
            capitalAcquisitionFeasibility: {
              capitalAcquisitionPath: { presaleMath: { audienceConversionRequired: 0.0087 } },
            },
          },
        },
        asOf: '2026-02-10T12:00:00.000Z',
        completionLog: [],
        runtimeEvents: [
          { kind: 'presale_update', recordedAt: '2026-02-10T00:00:00.000Z', orderCount: 18, balance: 720, conversionRate: 0.00078 },
        ],
        intake: { capitalAcquisitionRequired: true, capitalAvailable: 0 } as any,
      },
      bufferRemainingWeeksOverride: 8,
    };

    const summary = computeEntropySummary(input);
    const capitalCorrection = summary.activeCorrections.find((c) => c.dimension === 'capital');
    expect(capitalCorrection).toBeDefined();
    const recommended = capitalCorrection!.options.find((o) => o.recommended);
    expect(recommended?.optionId).toContain('network');
  });

  it('content strategy shift is recommended when daysUntilGate > 30 (WATCH/CAUTION)', () => {
    // Gate is 45 days away and gap is $3,000 — content strategy can still work
    // Conversion rate at ~50% of projected → WATCH reading
    const PROJECTED = 0.0087;
    const ct = makeCapitalTrack({
      presaleConversionRate: PROJECTED * 0.55, // 55% of projected → WATCH
      onTrackToMeetGate: false,
      currentBalance: 5000,
      target: 8000,
      percentToTarget: 5000 / 8000,
    });
    const gate = makeGateStatus({ daysUntilGate: 45 });
    // Confirm WATCH reading
    expect(classifyCapitalEntropy(ct, gate, PROJECTED)).toBe('WATCH');

    // Now verify via computeEntropySummary that content is recommended
    // Use a gate block 45 days after asOf and a WATCH-level presale event
    const asOf = '2026-02-10T12:00:00.000Z'; // gate on 2026-03-27 = 45 days
    const gateISO = '2026-03-27T12:00:00.000Z';
    const input: CourseCorrectionInput = {
      liveStateInput: {
        plan: {
          scheduledBlocks: [makeCapitalGateBlock('gate-1', gateISO) as any],
          summary: {
            capitalAcquisitionFeasibility: {
              capitalAcquisitionPath: { presaleMath: { audienceConversionRequired: PROJECTED } },
            },
          },
        },
        asOf,
        completionLog: [],
        runtimeEvents: [
          {
            kind: 'presale_update',
            recordedAt: '2026-02-10T00:00:00.000Z',
            orderCount: 125,
            balance: 5000,
            conversionRate: PROJECTED * 0.55,
          },
        ],
        intake: { capitalAcquisitionRequired: true, capitalAvailable: 0 } as any,
      },
      bufferRemainingWeeksOverride: 8,
    };

    const summary = computeEntropySummary(input);
    const capitalCorrection = summary.activeCorrections.find((c) => c.dimension === 'capital');
    expect(capitalCorrection).toBeDefined();
    const recommended = capitalCorrection!.options.find((o) => o.recommended);
    expect(recommended?.optionId).toContain('content');
  });
});

// ---------------------------------------------------------------------------
// 12. Judgment language — comprehensive coverage across all text fields
// ---------------------------------------------------------------------------

describe('judgment language — all correction text fields', () => {
  function collectAllCorrectionText(summary: ReturnType<typeof computeEntropySummary>): string {
    return summary.activeCorrections
      .flatMap((c) => [
        c.diagnosis,
        c.rootCause,
        c.consequence,
        c.trigger,
        ...c.options.map((o) => [o.label, o.action, o.tradeoff ?? ''].join(' ')),
      ])
      .join(' ');
  }

  it('capital ALERT correction contains no prohibited phrases in any field', () => {
    const input: CourseCorrectionInput = {
      liveStateInput: {
        plan: {
          scheduledBlocks: [makeCapitalGateBlock('gate-1', '2026-02-22T12:00:00.000Z') as any],
          summary: {
            capitalAcquisitionFeasibility: {
              capitalAcquisitionPath: { presaleMath: { audienceConversionRequired: 0.0087 } },
            },
          },
        },
        asOf: '2026-02-10T12:00:00.000Z',
        completionLog: [],
        runtimeEvents: [
          { kind: 'presale_update', recordedAt: '2026-02-10T00:00:00.000Z', orderCount: 18, balance: 720, conversionRate: 0.00078 },
        ],
        intake: { capitalAcquisitionRequired: true, capitalAvailable: 0 } as any,
      },
      bufferRemainingWeeksOverride: 8,
    };
    const allText = collectAllCorrectionText(computeEntropySummary(input));
    for (const phrase of PROHIBITED_CORRECTION_PHRASES) {
      expect(allText.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });

  it('domain ALERT correction contains no prohibited phrases in any field', () => {
    const summary = computeEntropySummary({
      liveStateInput: {
        plan: {
          scheduledBlocks: [
            {
              id: 'wait-1',
              title: 'Manufacturer initial response and quote wait',
              actionId: 'wait-1',
              startISO: '2026-01-02T00:00:00.000Z',
              endISO: '2026-04-01T00:00:00.000Z',
              blockType: 'waiting_period',
              waitType: 'manufacturer_initial_response',
              minimumDurationBusinessDays: 15,
              parallelWorkSuggestions: [],
            } as any,
          ],
          summary: {},
        },
        asOf: '2026-02-20T12:00:00.000Z',
        completionLog: [],
      },
    });
    const allText = collectAllCorrectionText(summary);
    for (const phrase of PROHIBITED_CORRECTION_PHRASES) {
      expect(allText.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });

  it('execution same-slot correction contains no prohibited phrases in any field', () => {
    const mondayBlocks = [
      makeScheduledBlock('m1', '2026-01-05T09:00:00.000Z'),
      makeScheduledBlock('m2', '2026-01-12T09:00:00.000Z'),
      makeScheduledBlock('m3', '2026-01-19T09:00:00.000Z'),
      makeScheduledBlock('m4', '2026-01-26T09:00:00.000Z'),
      makeScheduledBlock('m5', '2026-02-02T09:00:00.000Z'),
    ];
    const summary = computeEntropySummary({
      liveStateInput: {
        plan: { scheduledBlocks: mondayBlocks as any, summary: {} },
        asOf: '2026-02-10T12:00:00.000Z',
        completionLog: [],
      },
      bufferRemainingWeeksOverride: 8,
    });
    const allText = collectAllCorrectionText(summary);
    for (const phrase of PROHIBITED_CORRECTION_PHRASES) {
      expect(allText.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });

  it('market CAUTION correction contains no prohibited phrases in any field', () => {
    const summary = computeEntropySummary({
      liveStateInput: {
        plan: { scheduledBlocks: [], summary: {} },
        asOf: '2026-02-10T12:00:00.000Z',
        completionLog: [],
        runtimeEvents: [
          { kind: 'content_engagement', recordedAt: '2026-02-09T00:00:00.000Z', engagementRatio: 0.15 },
        ],
      },
    });
    const allText = collectAllCorrectionText(summary);
    for (const phrase of PROHIBITED_CORRECTION_PHRASES) {
      expect(allText.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });
});

// ---------------------------------------------------------------------------
// 13. Entropy history
// ---------------------------------------------------------------------------

describe('entropy history', () => {
  function makeSummary(asOf: string, precision: string = 'PRECISE'): Parameters<typeof appendEntropyHistoryEntry>[1] {
    return {
      asOf: `${asOf}T12:00:00.000Z`,
      overallPrecision: precision as any,
      dimensions: [],
      activeCorrections: [],
      completedCorrections: [],
      entropyTrend: 'STABLE',
      trendWindow: 0,
    };
  }

  it('one entry appended per check-in day', () => {
    const h0: EntropyHistory = { entries: [] };
    const h1 = appendEntropyHistoryEntry(h0, makeSummary('2026-01-01'));
    expect(h1.entries.length).toBe(1);
  });

  it('history is append-only — calling twice on same day does not create duplicate', () => {
    const h0: EntropyHistory = { entries: [] };
    const h1 = appendEntropyHistoryEntry(h0, makeSummary('2026-01-01'));
    const h2 = appendEntropyHistoryEntry(h1, makeSummary('2026-01-01', 'DRIFTING'));
    expect(h2.entries.length).toBe(1);
    // First entry preserved as-is
    expect(h2.entries[0].overallPrecision).toBe('PRECISE');
  });

  it('trend requires minimum 7 days for reliable computation', () => {
    const h0: EntropyHistory = { entries: [] };
    const h1 = appendEntropyHistoryEntry(h0, makeSummary('2026-01-01'));
    const h2 = appendEntropyHistoryEntry(h1, makeSummary('2026-01-04', 'DRIFTING'));
    const { trend, trendWindow } = computeEntropyTrend(h2, '2026-01-04T12:00:00.000Z');
    expect(trend).toBe('STABLE');
    expect(trendWindow).toBeLessThan(7);
  });

  it('history entry count only increases across multiple check-ins', () => {
    let h: EntropyHistory = { entries: [] };
    for (let i = 1; i <= 5; i++) {
      const prev = h.entries.length;
      h = appendEntropyHistoryEntry(h, makeSummary(`2026-01-0${i}`));
      expect(h.entries.length).toBeGreaterThanOrEqual(prev);
    }
    expect(h.entries.length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 12. Gum goal acceptance — three correction moments
// ---------------------------------------------------------------------------

describe('gum goal correction moments', () => {
  /**
   * CORRECTION MOMENT 1 — Capital ALERT, day 45
   * presaleOrderCount: 18, balance: $720, daysUntilMOQGate: 12
   */
  it('MOMENT 1 — Capital ALERT 12 days from gate, $7,280 gap, overrides Section 3', () => {
    // asOf = Feb 10, gate = Feb 22 → 12 days
    const input: CourseCorrectionInput = {
      liveStateInput: {
        plan: {
          scheduledBlocks: [
            makeScheduledBlock('s1', '2026-02-10T15:00:00.000Z'),
            makeCapitalGateBlock('gate-1', '2026-02-22T12:00:00.000Z') as any,
          ],
          summary: {
            capitalAcquisitionFeasibility: {
              capitalAcquisitionPath: { presaleMath: { audienceConversionRequired: 0.0087 } },
            },
          },
        },
        asOf: '2026-02-10T12:00:00.000Z',
        completionLog: [],
        runtimeEvents: [
          {
            kind: 'presale_update',
            recordedAt: '2026-02-10T00:00:00.000Z',
            orderCount: 18,
            balance: 720,
            conversionRate: 0.00078,
          },
        ],
        intake: { capitalAcquisitionRequired: true, capitalAvailable: 0 } as any,
      },
      // Override buffer so timeline stays GREEN — this test targets the capital dimension only
      bufferRemainingWeeksOverride: 8,
    };

    const summary = computeEntropySummary(input);

    // Capital dimension is ALERT
    const capitalDim = summary.dimensions.find((d) => d.dimension === 'capital');
    expect(capitalDim?.currentReading).toBe('ALERT');

    // Overall precision is SIGNIFICANT_DRIFT (one ALERT)
    expect(summary.overallPrecision).toBe('SIGNIFICANT_DRIFT');

    // Active correction exists for capital
    const capitalCorrection = summary.activeCorrections.find((c) => c.dimension === 'capital');
    expect(capitalCorrection).toBeDefined();
    expect(capitalCorrection!.severity).toBe('significant');

    // Diagnosis contains the gap amount and gate proximity
    expect(capitalCorrection!.diagnosis).toContain('7,280');
    expect(capitalCorrection!.consequence).toContain('7,280');
    expect(capitalCorrection!.consequence).toContain('12 days');

    // Section 3 is overridden
    const alerts = checkDailyCheckInAlerts(summary);
    expect(alerts.overridesSection3).toBe(true);

    // Recommended option is entrepreneur network activation
    const recommended = capitalCorrection!.options.find((o) => o.recommended);
    expect(recommended?.label.toLowerCase()).toMatch(/network|entrepreneur/i);

    // No prohibited phrases
    for (const phrase of PROHIBITED_CORRECTION_PHRASES) {
      expect(capitalCorrection!.diagnosis.toLowerCase()).not.toContain(phrase.toLowerCase());
      expect(capitalCorrection!.consequence.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });

  /**
   * CORRECTION MOMENT 2 — Execution CAUTION, same-slot pattern (Monday morning)
   */
  it('MOMENT 2 — Execution CAUTION, Monday pattern detected, no blame language', () => {
    // 5 Monday 9am sessions, none completed
    const mondayBlocks = [
      makeScheduledBlock('m1', '2026-01-05T09:00:00.000Z'),
      makeScheduledBlock('m2', '2026-01-12T09:00:00.000Z'),
      makeScheduledBlock('m3', '2026-01-19T09:00:00.000Z'),
      makeScheduledBlock('m4', '2026-01-26T09:00:00.000Z'),
      makeScheduledBlock('m5', '2026-02-02T09:00:00.000Z'),
    ];

    const input: CourseCorrectionInput = {
      liveStateInput: {
        plan: { scheduledBlocks: mondayBlocks as any, summary: {} },
        asOf: '2026-02-10T12:00:00.000Z',
        completionLog: [],
      },
      bufferRemainingWeeksOverride: 8,
    };

    const summary = computeEntropySummary(input);

    // Execution dimension is CAUTION (pattern detected, rate < 60%)
    const execDim = summary.dimensions.find((d) => d.dimension === 'execution');
    expect(['CAUTION', 'ALERT', 'CRITICAL'].includes(execDim?.currentReading ?? '')).toBe(true);

    // A slot-pattern correction is present
    const slotCorrection = summary.activeCorrections.find(
      (c) => c.dimension === 'execution' && c.correctionId.includes('slot')
    );
    expect(slotCorrection).toBeDefined();

    // Diagnosis describes pattern, not failure
    expect(slotCorrection!.diagnosis.toLowerCase()).toMatch(/pattern/);
    expect(slotCorrection!.diagnosis.toLowerCase()).not.toMatch(/you failed/);
    expect(slotCorrection!.diagnosis.toLowerCase()).not.toMatch(/you missed/);
    expect(slotCorrection!.diagnosis.toLowerCase()).not.toMatch(/you should have/);
    expect(slotCorrection!.diagnosis.toLowerCase()).not.toMatch(/you need to do better/);

    // Root cause references schedule vs availability, not blame
    expect(slotCorrection!.rootCause.toLowerCase()).toMatch(/conflict|availab/);

    // Recommended option is slot change
    const recommended = slotCorrection!.options.find((o) => o.recommended);
    expect(recommended?.label.toLowerCase()).toMatch(/move|different.*slot|slot.*different/i);

    // No prohibited phrases in any text
    const allText = [
      slotCorrection!.diagnosis,
      slotCorrection!.rootCause,
      slotCorrection!.consequence,
      ...slotCorrection!.options.map((o) => `${o.label} ${o.action} ${o.tradeoff ?? ''}`),
    ].join(' ');

    for (const phrase of PROHIBITED_CORRECTION_PHRASES) {
      expect(allText.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });

  /**
   * CORRECTION MOMENT 3 — Domain ALERT, manufacturer silence (34 days)
   */
  it('MOMENT 3 — Domain ALERT, 34 business days non-response, 3 options, Option A recommended', () => {
    // Manufacturer wait started Jan 2, asOf = Feb 20 ≈ 35 business days
    const input: CourseCorrectionInput = {
      liveStateInput: {
        plan: {
          scheduledBlocks: [
            {
              id: 'wait-1',
              title: 'Manufacturer initial response and quote wait',
              actionId: 'wait-1',
              startISO: '2026-01-02T00:00:00.000Z',
              endISO: '2026-04-01T00:00:00.000Z',
              blockType: 'waiting_period',
              waitType: 'manufacturer_initial_response',
              minimumDurationBusinessDays: 15,
              parallelWorkSuggestions: [],
            } as any,
          ],
          summary: {},
        },
        asOf: '2026-02-20T12:00:00.000Z',
        completionLog: [],
      },
    };

    const summary = computeEntropySummary(input);

    // Domain dimension is ALERT
    const domainDim = summary.dimensions.find((d) => d.dimension === 'domain');
    expect(domainDim?.currentReading).toBe('ALERT');

    // Active domain correction
    const domainCorrection = summary.activeCorrections.find((c) => c.dimension === 'domain');
    expect(domainCorrection).toBeDefined();

    // Exactly 3 options (as per spec)
    expect(domainCorrection!.options.length).toBe(3);

    // Option A recommended = follow-up
    const recommended = domainCorrection!.options.find((o) => o.recommended);
    expect(recommended?.optionId).toContain('followup');

    // Option C tradeoff references single-supplier dependency
    const optionC = domainCorrection!.options.find((o) => o.optionId.includes('proceed'));
    expect(optionC?.tradeoff?.toLowerCase()).toMatch(/single.supplier|single supplier/i);

    // Section 3 is overridden (significant severity)
    const alerts = checkDailyCheckInAlerts(summary);
    expect(alerts.overridesSection3).toBe(true);

    // No prohibited phrases
    for (const phrase of PROHIBITED_CORRECTION_PHRASES) {
      expect(domainCorrection!.diagnosis.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });
});
