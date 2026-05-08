import { describe, expect, it } from 'vitest';
import {
  classifyGapTier,
  computeReEngagement,
  applyResume,
  applyClose,
  generateRestructureProposal,
  generateEvidenceSummary,
  PROHIBITED_RECAP_PHRASES,
} from '../../src/domain/live/reEngagement.ts';
import type {
  ReEngagementInput,
  HardGateMissed,
  GapEvent,
} from '../../src/domain/live/reEngagement.ts';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeBlock(id: string, dayISO: string, blockType = 'execution') {
  return {
    id,
    title: `Session ${id}`,
    actionId: id,
    startISO: `${dayISO}T15:00:00.000Z`,
    endISO: `${dayISO}T15:30:00.000Z`,
    blockType,
  };
}

function makeCapitalGate(id: string, dayISO: string) {
  return {
    id,
    title: 'MOQ production deposit',
    actionId: id,
    startISO: `${dayISO}T16:00:00.000Z`,
    endISO: `${dayISO}T16:30:00.000Z`,
    blockType: 'capital_checkpoint',
    capitalGateId: 'moq_production_deposit',
  };
}

function makeWaitBlock(id: string, startISO: string, endISO: string) {
  return {
    id,
    title: 'Manufacturer initial response and quote wait',
    actionId: id,
    startISO,
    endISO,
    blockType: 'waiting_period',
    waitType: 'manufacturer_initial_response',
    minimumDurationBusinessDays: 15,
    parallelWorkSuggestions: [],
  };
}

/** Minimal plan for tests that just need some blocks within a date range */
function makePlan(blocks: ReturnType<typeof makeBlock>[]) {
  return { scheduledBlocks: blocks, summary: {} };
}

const MISSED_MOQ_GATE: HardGateMissed = {
  gateId: 'moq_production_deposit',
  gateTitle: 'MOQ production deposit',
  missedAt: '2026-01-15',
  recoverableAlternative: null,
};

const MISSED_GATE_WITH_RECOVERY: HardGateMissed = {
  gateId: 'moq_production_deposit',
  gateTitle: 'MOQ production deposit',
  missedAt: '2026-01-15',
  recoverableAlternative: 'Crowdfund pivot',
};

// ---------------------------------------------------------------------------
// 1. Gap tier classification
// ---------------------------------------------------------------------------

describe('gap tier classification', () => {
  it('classifies 4 days as SHORT', () => {
    expect(classifyGapTier(4)).toBe('SHORT');
  });

  it('classifies 14 days as SHORT (upper boundary)', () => {
    expect(classifyGapTier(14)).toBe('SHORT');
  });

  it('classifies 15 days as MEDIUM (lower boundary)', () => {
    expect(classifyGapTier(15)).toBe('MEDIUM');
  });

  it('classifies 30 days as MEDIUM (upper boundary)', () => {
    expect(classifyGapTier(30)).toBe('MEDIUM');
  });

  it('classifies 31 days as LONG (lower boundary)', () => {
    expect(classifyGapTier(31)).toBe('LONG');
  });

  it('classifies 90 days as LONG (upper boundary)', () => {
    expect(classifyGapTier(90)).toBe('LONG');
  });

  it('classifies 91 days as EXTENDED (lower boundary)', () => {
    expect(classifyGapTier(91)).toBe('EXTENDED');
  });
});

// ---------------------------------------------------------------------------
// 2. Gap event ordering
// ---------------------------------------------------------------------------

describe('gap event ordering', () => {
  it('surfaces positive events before negative events in eventsWhileAway', () => {
    const negativeEvent: GapEvent = {
      eventType: 'session_scheduled_not_completed',
      title: 'Session missed',
      occurredAt: '2026-01-05',
      isPositive: false,
      detail: 'A session was scheduled and not completed.',
    };
    const positiveEvent: GapEvent = {
      eventType: 'wait_period_completed',
      title: 'Wait period completed',
      occurredAt: '2026-01-10',
      isPositive: true,
      detail: 'The wait period completed during the gap.',
    };

    const input: ReEngagementInput = {
      plan: makePlan([makeBlock('s1', '2026-01-15')]),
      asOf: '2026-01-20T12:00:00.000Z',
      lastCheckInISO: '2026-01-01T00:00:00.000Z',
      completionLog: [],
      additionalGapEvents: [negativeEvent, positiveEvent],
    };

    const result = computeReEngagement(input);
    const events = result.gap.eventsWhileAway;
    const firstNegIdx = events.findIndex((e) => !e.isPositive);
    const lastPosIdx = events.map((e) => e.isPositive).lastIndexOf(true);

    if (firstNegIdx !== -1 && lastPosIdx !== -1) {
      expect(lastPosIdx).toBeLessThan(firstNegIdx);
    } else {
      // All events are one polarity — ordering constraint trivially satisfied
      expect(events.length).toBeGreaterThan(0);
    }
  });

  it('marks wait_period_completed events as positive', () => {
    const waitBlock = makeWaitBlock('wait-1', '2026-01-02T00:00:00.000Z', '2026-01-12T00:00:00.000Z');
    const input: ReEngagementInput = {
      plan: makePlan([waitBlock as any, makeBlock('s1', '2026-01-20')]),
      asOf: '2026-01-20T12:00:00.000Z',
      lastCheckInISO: '2026-01-01T00:00:00.000Z',
      completionLog: [],
    };

    const result = computeReEngagement(input);
    const waitCompleted = result.gap.eventsWhileAway.find(
      (e) => e.eventType === 'wait_period_completed'
    );
    expect(waitCompleted).toBeDefined();
    expect(waitCompleted!.isPositive).toBe(true);
  });

  it('marks manufacturer_responded events as positive and surfaces them first', () => {
    const input: ReEngagementInput = {
      plan: makePlan([makeBlock('s1', '2026-01-20')]),
      asOf: '2026-01-20T12:00:00.000Z',
      lastCheckInISO: '2026-01-01T00:00:00.000Z',
      completionLog: [],
      runtimeEvents: [
        {
          kind: 'manufacturer_response',
          manufacturerName: 'GumBase Co',
          respondedAt: '2026-01-10T09:00:00.000Z',
        },
      ],
      additionalGapEvents: [
        {
          eventType: 'session_scheduled_not_completed',
          title: 'Missed session',
          occurredAt: '2026-01-05',
          isPositive: false,
          detail: 'A session was not completed.',
        },
      ],
    };

    const result = computeReEngagement(input);
    const events = result.gap.eventsWhileAway;
    expect(events[0].isPositive).toBe(true);
    expect(events[0].eventType).toBe('manufacturer_responded');
  });

  it('orders within positive group chronologically', () => {
    const input: ReEngagementInput = {
      plan: makePlan([makeBlock('s1', '2026-01-20')]),
      asOf: '2026-01-20T12:00:00.000Z',
      lastCheckInISO: '2026-01-01T00:00:00.000Z',
      completionLog: [],
      additionalGapEvents: [
        {
          eventType: 'presale_order_received',
          title: '5 presale orders received',
          occurredAt: '2026-01-12',
          isPositive: true,
          detail: '5 orders received on 2026-01-12.',
        },
        {
          eventType: 'manufacturer_responded',
          title: 'Manufacturer responded',
          occurredAt: '2026-01-08',
          isPositive: true,
          detail: 'Manufacturer responded on 2026-01-08.',
        },
      ],
    };

    const result = computeReEngagement(input);
    const positiveEvents = result.gap.eventsWhileAway.filter((e) => e.isPositive);
    expect(positiveEvents[0].occurredAt.localeCompare(positiveEvents[1].occurredAt)).toBeLessThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Resume availability
// ---------------------------------------------------------------------------

describe('resume availability', () => {
  it('RESUME is available when no hard gate missed and buffer is positive', () => {
    const input: ReEngagementInput = {
      plan: makePlan([makeBlock('s1', '2026-01-15'), makeBlock('s2', '2026-01-20')]),
      asOf: '2026-01-10T12:00:00.000Z',
      lastCheckInISO: '2026-01-01T00:00:00.000Z',
      completionLog: [],
      bufferRemainingWeeksOverride: 8,
    };

    const result = computeReEngagement(input);
    const resume = result.options.find((o) => o.kind === 'RESUME');
    expect(resume?.available).toBe(true);
    expect(resume?.unavailableReason).toBeNull();
  });

  it('RESUME is unavailable when a hard gate was missed with no recoverable alternative', () => {
    const input: ReEngagementInput = {
      plan: makePlan([makeBlock('s1', '2026-01-15'), makeCapitalGate('gate-1', '2026-06-15') as any]),
      asOf: '2026-02-01T12:00:00.000Z',
      lastCheckInISO: '2026-01-01T00:00:00.000Z',
      completionLog: [],
      bufferRemainingWeeksOverride: 8,
      hardGatesMissed: [MISSED_MOQ_GATE],
    };

    const result = computeReEngagement(input);
    const resume = result.options.find((o) => o.kind === 'RESUME');
    expect(resume?.available).toBe(false);
    expect(resume?.unavailableReason).toBeTruthy();
  });

  it('RESUME is unavailable when productionSlotLost is true', () => {
    const input: ReEngagementInput = {
      plan: makePlan([makeBlock('s1', '2026-01-15')]),
      asOf: '2026-02-01T12:00:00.000Z',
      lastCheckInISO: '2026-01-01T00:00:00.000Z',
      completionLog: [],
      bufferRemainingWeeksOverride: 8,
      hardGatesMissed: [MISSED_GATE_WITH_RECOVERY],
      productionSlotLost: true,
    };

    const result = computeReEngagement(input);
    const resume = result.options.find((o) => o.kind === 'RESUME');
    expect(resume?.available).toBe(false);
  });

  it('RESUME is unavailable when buffer is exhausted (bufferRemainingWeeksOverride < 0)', () => {
    const input: ReEngagementInput = {
      plan: makePlan([makeBlock('s1', '2026-01-15')]),
      asOf: '2026-02-01T12:00:00.000Z',
      lastCheckInISO: '2026-01-01T00:00:00.000Z',
      completionLog: [],
      bufferRemainingWeeksOverride: -1,
    };

    const result = computeReEngagement(input);
    const resume = result.options.find((o) => o.kind === 'RESUME');
    expect(resume?.available).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Restructure
// ---------------------------------------------------------------------------

describe('restructure', () => {
  it('RESTRUCTURE is always available', () => {
    const input: ReEngagementInput = {
      plan: makePlan([makeBlock('s1', '2026-01-15')]),
      asOf: '2026-04-01T12:00:00.000Z',
      lastCheckInISO: '2026-01-01T00:00:00.000Z',
      completionLog: [],
      hardGatesMissed: [MISSED_MOQ_GATE],
      productionSlotLost: true,
      bufferRemainingWeeksOverride: -5,
    };

    const result = computeReEngagement(input);
    const restructure = result.options.find((o) => o.kind === 'RESTRUCTURE');
    expect(restructure?.available).toBe(true);
  });

  it('generateRestructureProposal returns requiresUserApproval: true — plan does not mutate until approved', () => {
    const input: ReEngagementInput = {
      plan: makePlan([makeBlock('s1', '2026-01-15'), makeCapitalGate('gate-1', '2026-06-15') as any]),
      asOf: '2026-02-01T12:00:00.000Z',
      lastCheckInISO: '2026-01-01T00:00:00.000Z',
      completionLog: [
        { id: 'entry-1', blockId: 's1', kind: 'complete', completed: true, dateISO: '2026-01-15' },
      ],
      hardGatesMissed: [MISSED_MOQ_GATE],
    };

    const originalLogLength = input.completionLog!.length;
    const proposal = generateRestructureProposal(input, [MISSED_MOQ_GATE]);

    expect(proposal.requiresUserApproval).toBe(true);
    // Completion log is not mutated in place — original remains unchanged
    expect(input.completionLog!.length).toBe(originalLogLength);
    // Proposal includes gate options
    expect(proposal.gates.length).toBe(1);
    expect(proposal.gates[0].gateId).toBe('moq_production_deposit');
    expect(proposal.gates[0].optionA).toBeDefined();
    expect(proposal.gates[0].optionB).toBeDefined();
    expect(proposal.gates[0].optionC).toBeDefined();
  });

  it('restructure proposal includes optionC with null newCompletionDate for descope path', () => {
    const proposal = generateRestructureProposal(
      {
        plan: makePlan([makeBlock('s1', '2026-01-15')]),
        asOf: '2026-02-01T12:00:00.000Z',
        lastCheckInISO: '2026-01-01T00:00:00.000Z',
        completionLog: [],
        hardGatesMissed: [MISSED_MOQ_GATE],
      },
      [MISSED_MOQ_GATE]
    );

    expect(proposal.gates[0].optionC.newCompletionDate).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. Close / archive
// ---------------------------------------------------------------------------

describe('close and archive', () => {
  it('CLOSE is always available', () => {
    const input: ReEngagementInput = {
      plan: makePlan([makeBlock('s1', '2026-01-15')]),
      asOf: '2026-04-01T12:00:00.000Z',
      lastCheckInISO: '2026-01-01T00:00:00.000Z',
      completionLog: [],
    };

    const result = computeReEngagement(input);
    const closeOpt = result.options.find((o) => o.kind === 'CLOSE');
    expect(closeOpt?.available).toBe(true);
  });

  it('generateEvidenceSummary returns sessionsCompleted count matching completion log', () => {
    const input: ReEngagementInput = {
      plan: makePlan([makeBlock('s1', '2026-01-02'), makeBlock('s2', '2026-01-05'), makeBlock('s3', '2026-01-08')]),
      asOf: '2026-02-01T12:00:00.000Z',
      lastCheckInISO: '2026-01-01T00:00:00.000Z',
      completionLog: [
        { id: 'e1', blockId: 's1', kind: 'complete', completed: true, dateISO: '2026-01-02' },
        { id: 'e2', blockId: 's2', kind: 'complete', completed: true, dateISO: '2026-01-05' },
      ],
    };

    const summary = generateEvidenceSummary(input);
    expect(summary.sessionsCompleted).toBe(2);
    expect(Array.isArray(summary.keyDecisions)).toBe(true);
    expect(Array.isArray(summary.whatWasLearned)).toBe(true);
  });

  it('applyClose appends an archive entry to the log without mutating the original', () => {
    const originalLog = [
      { id: 'e1', blockId: 's1', kind: 'complete' as const, completed: true, dateISO: '2026-01-02' },
    ];
    const input: ReEngagementInput = {
      plan: makePlan([makeBlock('s1', '2026-01-02')]),
      asOf: '2026-02-01T12:00:00.000Z',
      lastCheckInISO: '2026-01-01T00:00:00.000Z',
      completionLog: originalLog,
    };

    const newLog = applyClose(input);

    // Original not mutated
    expect(originalLog.length).toBe(1);
    // New log has archive entry appended
    expect(newLog.length).toBe(2);
    const archiveEntry = newLog[newLog.length - 1];
    expect(archiveEntry.status).toBe('archived');
    expect(archiveEntry.canonicalTitle).toMatch(/CLOSE/i);
  });
});

// ---------------------------------------------------------------------------
// 6. Judgment language regression guard
// ---------------------------------------------------------------------------

describe('judgment language guard', () => {
  const COMMON_INPUT: ReEngagementInput = {
    plan: makePlan([
      makeBlock('s1', '2026-01-05'),
      makeBlock('s2', '2026-01-10'),
      makeBlock('s3', '2026-01-15'),
    ]),
    asOf: '2026-02-01T12:00:00.000Z',
    lastCheckInISO: '2026-01-01T00:00:00.000Z',
    completionLog: [],
    sessionsSkippedOverride: 3,
  };

  for (const phrase of PROHIBITED_RECAP_PHRASES) {
    it(`recap does not contain prohibited phrase: "${phrase}"`, () => {
      const result = computeReEngagement(COMMON_INPUT);
      expect(result.gap.recapText.toLowerCase()).not.toContain(phrase.toLowerCase());
    });
  }

  it('recap ends with "Here is where you are now."', () => {
    const result = computeReEngagement(COMMON_INPUT);
    expect(result.gap.recapText.endsWith('Here is where you are now.')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Completion log integrity (append-only)
// ---------------------------------------------------------------------------

describe('completion log integrity', () => {
  it('applyResume returns a new array and does not mutate the original log', () => {
    const original = [
      { id: 'e1', blockId: 's1', kind: 'complete' as const, completed: true, dateISO: '2026-01-02' },
    ];
    const input: ReEngagementInput = {
      plan: makePlan([makeBlock('s1', '2026-01-02'), makeBlock('s2', '2026-01-10')]),
      asOf: '2026-01-20T12:00:00.000Z',
      lastCheckInISO: '2026-01-01T00:00:00.000Z',
      completionLog: original,
    };

    const result = applyResume(input);
    expect(result).not.toBe(original);
    expect(original.length).toBe(1);
    expect(result.length).toBeGreaterThan(original.length);
  });

  it('applyResume log contains a re_engaged status entry', () => {
    const input: ReEngagementInput = {
      plan: makePlan([makeBlock('s1', '2026-01-05')]),
      asOf: '2026-01-20T12:00:00.000Z',
      lastCheckInISO: '2026-01-01T00:00:00.000Z',
      completionLog: [],
    };

    const result = applyResume(input);
    expect(result.some((e) => e.status === 're_engaged')).toBe(true);
  });

  it('applyClose log contains an archived status entry appended after existing entries', () => {
    const original = [
      { id: 'e1', blockId: 's1', kind: 'complete' as const, completed: true, dateISO: '2026-01-02' },
      { id: 'e2', blockId: 's2', kind: 'complete' as const, completed: true, dateISO: '2026-01-05' },
    ];
    const input: ReEngagementInput = {
      plan: makePlan([makeBlock('s1', '2026-01-02'), makeBlock('s2', '2026-01-05')]),
      asOf: '2026-02-01T12:00:00.000Z',
      lastCheckInISO: '2026-01-01T00:00:00.000Z',
      completionLog: original,
    };

    const result = applyClose(input);
    // First two entries are the original entries
    expect(result[0].id).toBe('e1');
    expect(result[1].id).toBe('e2');
    // Last entry is the close entry
    expect(result[result.length - 1].status).toBe('archived');
  });

  it('neither applyResume nor applyClose modifies existing entries in the log', () => {
    const original = [
      { id: 'entry-1', blockId: 's1', kind: 'complete' as const, completed: true, dateISO: '2026-01-02', canonicalTitle: 'Session 1' },
    ];
    const input: ReEngagementInput = {
      plan: makePlan([makeBlock('s1', '2026-01-02')]),
      asOf: '2026-02-01T12:00:00.000Z',
      lastCheckInISO: '2026-01-01T00:00:00.000Z',
      completionLog: original,
    };

    const resumeLog = applyResume(input);
    const closeLog = applyClose(input);

    // Original entry preserved as-is in both
    expect(resumeLog[0]).toEqual(original[0]);
    expect(closeLog[0]).toEqual(original[0]);
  });
});

// ---------------------------------------------------------------------------
// 8. Three gum goal acceptance moments
// ---------------------------------------------------------------------------

describe('gum goal acceptance moments', () => {
  /**
   * MOMENT A: 18-day gap (MEDIUM), manufacturer responded, enough buffer → RESUME
   * Today action: catalog review
   */
  it('MOMENT A — 18-day gap, manufacturer responded, recommends RESUME with catalog review', () => {
    const lastCheckIn = '2026-01-01T00:00:00.000Z';
    const asOf = '2026-01-19T12:00:00.000Z';

    const input: ReEngagementInput = {
      plan: makePlan([
        makeBlock('s1', '2026-01-03'),
        makeBlock('s2', '2026-01-06'),
        makeBlock('s3', '2026-01-09'),
        makeBlock('s4', '2026-01-12'),
        makeBlock('s5', '2026-01-25'),
        makeCapitalGate('gate-1', '2026-06-15') as any,
      ]),
      asOf,
      lastCheckInISO: lastCheckIn,
      completionLog: [
        { id: 'e1', blockId: 's1', kind: 'complete', completed: true, dateISO: '2026-01-03' },
      ],
      runtimeEvents: [
        {
          kind: 'manufacturer_response',
          manufacturerName: 'GumBase Co',
          respondedAt: '2026-01-10T09:00:00.000Z',
        },
      ],
      bufferRemainingWeeksOverride: 10,
    };

    const result = computeReEngagement(input);

    // Gap tier: 18 days → MEDIUM
    expect(result.gap.gapTier).toBe('MEDIUM');

    // Manufacturer responded event is present and positive
    const mfrEvent = result.gap.eventsWhileAway.find((e) => e.eventType === 'manufacturer_responded');
    expect(mfrEvent).toBeDefined();
    expect(mfrEvent!.isPositive).toBe(true);

    // RESUME is available with enough buffer
    const resume = result.options.find((o) => o.kind === 'RESUME');
    expect(resume?.available).toBe(true);

    // Recommended: RESUME (buffer > 4 weeks)
    expect(result.recommendedOption).toBe('RESUME');

    // Today action: catalog review (manufacturer responded)
    expect(result.todayFirstAction.actionType).toBe('catalog_review');
    expect(result.todayFirstAction.title).toMatch(/GumBase Co/);
  });

  /**
   * MOMENT B: 45-day gap (LONG), presale stalled, low buffer → RESTRUCTURE
   * RESUME available but buffer ≤ 4 weeks → RESTRUCTURE recommended
   */
  it('MOMENT B — 45-day gap, presale stalled, recommends RESTRUCTURE', () => {
    const lastCheckIn = '2026-01-01T00:00:00.000Z';
    const asOf = '2026-02-15T12:00:00.000Z';

    const input: ReEngagementInput = {
      plan: {
        scheduledBlocks: [
          makeBlock('s1', '2026-01-05'),
          makeBlock('s2', '2026-01-10'),
          makeBlock('s3', '2026-01-15'),
          makeBlock('s4', '2026-01-20'),
          makeBlock('s5', '2026-01-25'),
          makeBlock('s6', '2026-01-30'),
          makeBlock('s7', '2026-02-05'),
          makeBlock('s8', '2026-02-10'),
          makeBlock('s9', '2026-03-01'),
          makeCapitalGate('gate-1', '2026-06-15') as any,
        ],
        summary: {
          capitalAcquisitionFeasibility: {
            capitalAcquisitionPath: { presaleMath: { audienceConversionRequired: 0.0087 } },
          },
        },
      },
      asOf,
      lastCheckInISO: lastCheckIn,
      completionLog: [
        { id: 'e1', blockId: 's1', kind: 'complete', completed: true, dateISO: '2026-01-05' },
      ],
      runtimeEvents: [
        {
          kind: 'presale_update',
          recordedAt: '2026-02-10T12:00:00.000Z',
          orderCount: 3,
          conversionRate: 0.0001,
          balance: 120,
        },
      ],
      // Low buffer → RESTRUCTURE recommended over RESUME
      bufferRemainingWeeksOverride: 2,
      sessionsSkippedOverride: 7,
    };

    const result = computeReEngagement(input);

    // Gap tier: 45 days → LONG
    expect(result.gap.gapTier).toBe('LONG');

    // Sessions skipped counted
    expect(result.gap.sessionsSkipped).toBe(7);

    // RESTRUCTURE recommended (buffer ≤ 4 weeks)
    expect(result.recommendedOption).toBe('RESTRUCTURE');

    // RESTRUCTURE always available
    const restructure = result.options.find((o) => o.kind === 'RESTRUCTURE');
    expect(restructure?.available).toBe(true);
  });

  /**
   * MOMENT C: 95-day gap (EXTENDED), MOQ gate missed, no recovery path
   * RESUME unavailable, RESTRUCTURE recommended, no CLOSE forced
   */
  it('MOMENT C — 95-day gap, MOQ gate missed, RESUME unavailable, RESTRUCTURE recommended', () => {
    const lastCheckIn = '2026-01-01T00:00:00.000Z';
    const asOf = '2026-04-06T12:00:00.000Z';

    const input: ReEngagementInput = {
      plan: makePlan([
        makeBlock('s1', '2026-01-05'),
        makeBlock('s2', '2026-01-10'),
        makeBlock('s3', '2026-04-10'),
        makeCapitalGate('gate-1', '2026-03-01') as any,
      ]),
      asOf,
      lastCheckInISO: lastCheckIn,
      completionLog: [
        { id: 'e1', blockId: 's1', kind: 'complete', completed: true, dateISO: '2026-01-05' },
      ],
      hardGatesMissed: [MISSED_MOQ_GATE],
      bufferRemainingWeeksOverride: 6,
    };

    const result = computeReEngagement(input);

    // Gap tier: 95 days → EXTENDED
    expect(result.gap.gapTier).toBe('EXTENDED');

    // RESUME is unavailable (hard gate missed, no recovery alternative)
    const resume = result.options.find((o) => o.kind === 'RESUME');
    expect(resume?.available).toBe(false);

    // RESTRUCTURE is recommended
    expect(result.recommendedOption).toBe('RESTRUCTURE');

    // Today action is a restructure session targeting the missed gate
    expect(result.todayFirstAction.actionType).toBe('restructure_session');
    expect(result.todayFirstAction.title).toMatch(/MOQ/i);

    // CLOSE remains available
    const closeOpt = result.options.find((o) => o.kind === 'CLOSE');
    expect(closeOpt?.available).toBe(true);

    // Recap does not contain prohibited phrases
    for (const phrase of PROHIBITED_RECAP_PHRASES) {
      expect(result.gap.recapText.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });
});
