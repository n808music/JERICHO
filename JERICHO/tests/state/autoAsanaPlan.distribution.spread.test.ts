import { describe, expect, it } from 'vitest';
import { compileAutoAsanaPlan } from '../../src/state/engine/autoAsanaPlan.ts';

describe('autoAsanaPlan deterministic day distribution', () => {
  it('spreads sessions across equally valid days before reusing a day', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-spread-1',
      cycleId: 'cycle-spread-1',
      planProof: {
        workableDaysRemaining: 7,
        totalRequiredUnits: 5,
        requiredPacePerDay: 1,
        maxPerDay: 10,
        maxPerWeek: 50,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 0.25,
      },
      constraints: {
        timezone: 'UTC',
        weeklyWindows: {
          MON: [{ startHHMM: '09:00', endHHMM: '10:00' }],
          TUE: [{ startHHMM: '09:00', endHHMM: '10:00' }],
          WED: [{ startHHMM: '09:00', endHHMM: '10:00' }],
          THU: [{ startHHMM: '09:00', endHHMM: '10:00' }],
          FRI: [{ startHHMM: '09:00', endHHMM: '10:00' }],
        },
        cycleStartDayKey: '2026-03-09',
        cycleEndDayKey: '2026-03-13',
      },
      nowISO: '2026-03-09T12:00:00.000Z',
      horizonDays: 7,
      acceptedBlocks: [],
      sessionPlan: Array.from({ length: 5 }, (_, index) => ({
        date: '2026-03-09',
        startTime: '09:00',
        durationMinutes: 60,
        actionSteps: [`Step ${index + 1}`],
        completionCondition: `Session ${index + 1} complete`,
        deliverableId: `deliv-${index + 1}`,
        actionId: `act-${index + 1}`,
        title: `Session ${index + 1}`,
      })),
    });

    expect(plan.horizonBlocks).toHaveLength(5);
    expect(plan.horizonBlocks.map((block) => block.dayKey)).toEqual([
      '2026-03-09',
      '2026-03-10',
      '2026-03-11',
      '2026-03-12',
      '2026-03-13',
    ]);
  });

  it('breaks ties by earliest valid calendar day', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-spread-2',
      cycleId: 'cycle-spread-2',
      planProof: {
        workableDaysRemaining: 3,
        totalRequiredUnits: 1,
        requiredPacePerDay: 1,
        maxPerDay: 10,
        maxPerWeek: 50,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 0.25,
      },
      constraints: {
        timezone: 'UTC',
        weeklyWindows: {
          MON: [{ startHHMM: '09:00', endHHMM: '12:00' }],
          TUE: [{ startHHMM: '09:00', endHHMM: '12:00' }],
        },
        cycleStartDayKey: '2026-03-09',
        cycleEndDayKey: '2026-03-10',
      },
      nowISO: '2026-03-09T12:00:00.000Z',
      horizonDays: 3,
      acceptedBlocks: [
        {
          id: 'accepted-mon',
          startISO: '2026-03-09T10:00:00.000Z',
          durationMinutes: 60,
        },
        {
          id: 'accepted-tue',
          startISO: '2026-03-10T10:00:00.000Z',
          durationMinutes: 60,
        },
      ],
      sessionPlan: [
        {
          date: '2026-03-09',
          startTime: '09:00',
          durationMinutes: 60,
          actionSteps: ['Step 1'],
          completionCondition: 'Session complete',
          deliverableId: 'deliv-1',
          actionId: 'act-1',
          title: 'Tie break test',
        },
      ],
    });

    expect(plan.horizonBlocks).toHaveLength(1);
    expect(plan.horizonBlocks[0].dayKey).toBe('2026-03-09');
  });

  it('keeps all sessions on one day when only one day is legal', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-spread-3',
      cycleId: 'cycle-spread-3',
      planProof: {
        workableDaysRemaining: 3,
        totalRequiredUnits: 3,
        requiredPacePerDay: 1,
        maxPerDay: 10,
        maxPerWeek: 50,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 0.25,
      },
      constraints: {
        timezone: 'UTC',
        weeklyWindows: {
          MON: [{ startHHMM: '09:00', endHHMM: '12:00' }],
        },
        cycleStartDayKey: '2026-03-09',
        cycleEndDayKey: '2026-03-11',
      },
      nowISO: '2026-03-09T12:00:00.000Z',
      horizonDays: 3,
      acceptedBlocks: [],
      sessionPlan: [
        {
          date: '2026-03-09',
          startTime: '09:00',
          durationMinutes: 60,
          actionSteps: ['Step 1'],
          completionCondition: 'Session 1 complete',
          deliverableId: 'deliv-1',
          actionId: 'act-1',
          title: 'Single day 1',
        },
        {
          date: '2026-03-09',
          startTime: '09:00',
          durationMinutes: 60,
          actionSteps: ['Step 2'],
          completionCondition: 'Session 2 complete',
          deliverableId: 'deliv-2',
          actionId: 'act-2',
          title: 'Single day 2',
        },
        {
          date: '2026-03-09',
          startTime: '09:00',
          durationMinutes: 60,
          actionSteps: ['Step 3'],
          completionCondition: 'Session 3 complete',
          deliverableId: 'deliv-3',
          actionId: 'act-3',
          title: 'Single day 3',
        },
      ],
    });

    expect(plan.horizonBlocks).toHaveLength(3);
    expect(new Set(plan.horizonBlocks.map((block) => block.dayKey)).size).toBe(1);
    expect(plan.horizonBlocks.every((block) => block.dayKey === '2026-03-09')).toBe(true);
  });

  it('spreads sparse long-horizon action sequences beyond the opening months', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-long-horizon-1',
      cycleId: 'cycle-long-horizon-1',
      planProof: {
        workableDaysRemaining: 260,
        totalRequiredUnits: 12,
        requiredPacePerDay: 1,
        maxPerDay: 2,
        maxPerWeek: 5,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 0.25,
      },
      constraints: {
        timezone: 'UTC',
        weeklyWindows: {
          MON: [{ startHHMM: '09:00', endHHMM: '11:00' }],
          TUE: [{ startHHMM: '09:00', endHHMM: '11:00' }],
          WED: [{ startHHMM: '09:00', endHHMM: '11:00' }],
          THU: [{ startHHMM: '09:00', endHHMM: '11:00' }],
          FRI: [{ startHHMM: '09:00', endHHMM: '11:00' }],
        },
        cycleStartDayKey: '2026-01-05',
        cycleEndDayKey: '2027-01-04',
      },
      nowISO: '2026-01-05T12:00:00.000Z',
      horizonDays: 365,
      acceptedBlocks: [],
      actionSequence: Array.from({ length: 12 }, (_, index) => ({
        id: `action-${index + 1}`,
        title: `Long horizon checkpoint ${index + 1}`,
        estimateMin: 60,
        deliverableId: `deliverable-${index + 1}`,
        deliverableTitle: `Long horizon checkpoint ${index + 1}`,
      })),
    });

    expect(plan.horizonBlocks).toHaveLength(12);

    const blockDayKeys = plan.horizonBlocks.map((block) => block.dayKey).sort();
    const lastBlockDayKey = blockDayKeys[blockDayKeys.length - 1];
    const occupiedMonths = new Set(blockDayKeys.map((dayKey) => dayKey.slice(0, 7)));

    expect(lastBlockDayKey >= '2026-09-01').toBe(true);
    expect(occupiedMonths.size).toBeGreaterThanOrEqual(8);
  });

  it('distributes dense long-horizon action sequences across the full contract instead of packing early weeks', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-long-horizon-dense',
      cycleId: 'cycle-long-horizon-dense',
      planProof: {
        workableDaysRemaining: 260,
        totalRequiredUnits: 110,
        requiredPacePerDay: 1,
        maxPerDay: 3,
        maxPerWeek: 15,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 0.25,
      },
      constraints: {
        timezone: 'UTC',
        weeklyWindows: {
          MON: [{ startHHMM: '09:00', endHHMM: '12:00' }],
          TUE: [{ startHHMM: '09:00', endHHMM: '12:00' }],
          WED: [{ startHHMM: '09:00', endHHMM: '12:00' }],
          THU: [{ startHHMM: '09:00', endHHMM: '12:00' }],
          FRI: [{ startHHMM: '09:00', endHHMM: '12:00' }],
        },
        cycleStartDayKey: '2026-01-05',
        cycleEndDayKey: '2027-01-04',
      },
      nowISO: '2026-01-05T12:00:00.000Z',
      horizonDays: 365,
      acceptedBlocks: [],
      actionSequence: Array.from({ length: 110 }, (_, index) => ({
        id: `action-${index + 1}`,
        title: `Commercial launch family work ${index + 1}`,
        estimateMin: 60,
        deliverableId: `deliverable-${(index % 5) + 1}`,
        deliverableTitle: `Commercial launch family ${(index % 5) + 1}`,
      })),
    });

    expect(plan.horizonBlocks).toHaveLength(110);

    const blockDayKeys = plan.horizonBlocks.map((block) => block.dayKey).sort();
    const lastBlockDayKey = blockDayKeys[blockDayKeys.length - 1];
    const occupiedMonths = new Set(blockDayKeys.map((dayKey) => dayKey.slice(0, 7)));

    expect(lastBlockDayKey >= '2026-12-01').toBe(true);
    expect(occupiedMonths.size).toBeGreaterThanOrEqual(12);
  });

  it('uses concrete session titles from action sequences instead of repeated parent action shells', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-commercial-specificity',
      cycleId: 'cycle-commercial-specificity',
      planProof: {
        workableDaysRemaining: 30,
        totalRequiredUnits: 3,
        requiredPacePerDay: 1,
        maxPerDay: 2,
        maxPerWeek: 6,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 0.25,
      },
      constraints: {
        timezone: 'UTC',
        weeklyWindows: {
          MON: [{ startHHMM: '09:00', endHHMM: '12:00' }],
          TUE: [{ startHHMM: '09:00', endHHMM: '12:00' }],
          WED: [{ startHHMM: '09:00', endHHMM: '12:00' }],
        },
        cycleStartDayKey: '2026-01-05',
        cycleEndDayKey: '2026-02-05',
      },
      nowISO: '2026-01-05T12:00:00.000Z',
      horizonDays: 32,
      acceptedBlocks: [],
      actionSequence: [
        {
          id: 'action-gum-readiness',
          title: 'Resolve gum formula, sample, and packaging readiness',
          estimateMin: 180,
          deliverableId: 'deliverable-gum-readiness',
          deliverableTitle: 'Finalize caffeinated gum formula and packaging readiness',
          sessionTitles: [
            'Shortlist viable stimulant dosage and gum base formulation options',
            'Compare manufacturer MOQ, lead time, certifications, and sample cost',
            'Define packaging format, count size, label claims, and required warnings',
          ],
        },
      ],
    });

    expect(plan.horizonBlocks.map((block) => block.title)).toEqual([
      'Shortlist viable stimulant dosage and gum base formulation options',
      'Compare manufacturer MOQ, lead time, certifications, and sample cost',
      'Define packaging format, count size, label claims, and required warnings',
    ]);
  });

  it('rewrites commercial family-shell action titles into operational block titles', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-commercial-shell-rewrite',
      cycleId: 'cycle-commercial-shell-rewrite',
      planProof: {
        workableDaysRemaining: 30,
        totalRequiredUnits: 3,
        requiredPacePerDay: 1,
        maxPerDay: 2,
        maxPerWeek: 6,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 0.25,
      },
      constraints: {
        timezone: 'UTC',
        weeklyWindows: {
          MON: [{ startHHMM: '09:00', endHHMM: '12:00' }],
          TUE: [{ startHHMM: '09:00', endHHMM: '12:00' }],
          WED: [{ startHHMM: '09:00', endHHMM: '12:00' }],
        },
        cycleStartDayKey: '2026-01-05',
        cycleEndDayKey: '2026-02-05',
      },
      nowISO: '2026-01-05T12:00:00.000Z',
      horizonDays: 32,
      acceptedBlocks: [],
      actionSequence: [
        {
          id: 'action-gum-readiness',
          title: 'Resolve gum formula, sample, and packaging readiness',
          estimateMin: 180,
          deliverableId: 'deliverable-gum-readiness',
          deliverableTitle: 'Finalize caffeinated gum formula and packaging readiness',
        },
      ],
    });

    expect(plan.horizonBlocks.map((block) => block.title)).toEqual([
      'List caffeine dosage, flavor, texture, and compliance assumptions for the gum formula',
      'Shortlist viable stimulant dosage and gum base formulation options',
      'Request sample capability notes from two gum manufacturers',
    ]);
    expect(plan.horizonBlocks.some((block) => /session\s+\d+\s+of\s+\d+/i.test(block.title))).toBe(false);
  });

  it('rewrites explicit session-plan family shells before rendering blocks', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-commercial-session-shell-rewrite',
      cycleId: 'cycle-commercial-session-shell-rewrite',
      planProof: {
        workableDaysRemaining: 30,
        totalRequiredUnits: 3,
        requiredPacePerDay: 1,
        maxPerDay: 2,
        maxPerWeek: 6,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 0.25,
      },
      constraints: {
        timezone: 'UTC',
        weeklyWindows: {
          MON: [{ startHHMM: '09:00', endHHMM: '12:00' }],
          TUE: [{ startHHMM: '09:00', endHHMM: '12:00' }],
          WED: [{ startHHMM: '09:00', endHHMM: '12:00' }],
        },
        cycleStartDayKey: '2026-01-05',
        cycleEndDayKey: '2026-02-05',
      },
      nowISO: '2026-01-05T12:00:00.000Z',
      horizonDays: 32,
      acceptedBlocks: [],
      actionSequence: [
        {
          id: 'action-checkout',
          title: 'Build gum offer, pricing, and checkout path',
          estimateMin: 180,
          deliverableId: 'deliverable-checkout',
          deliverableTitle:
            'Set caffeinated gum offer, pricing, product page, checkout, ordering, and fulfillment path',
        },
      ],
      sessionPlan: [
        {
          date: '2026-01-05',
          startTime: '09:00',
          durationMinutes: 60,
          actionId: 'action-checkout',
          deliverableId: 'deliverable-checkout',
          title: 'Build gum offer, pricing, and checkout path — Session 1 of 9',
        },
        {
          date: '2026-01-06',
          startTime: '09:00',
          durationMinutes: 60,
          actionId: 'action-checkout',
          deliverableId: 'deliverable-checkout',
          title: 'Build gum offer, pricing, and checkout path — Session 2 of 9',
        },
      ],
    });

    expect(plan.horizonBlocks.map((block) => block.title)).toEqual([
      'Define launch offer promise, pack size, price hypothesis, and buyer guarantee',
      'Compare unit economics using formula, packaging, shipping, and platform fees',
    ]);
    expect(plan.horizonBlocks.some((block) => /build gum offer/i.test(block.title))).toBe(false);
  });

  it('keeps commercial product-launch readiness compact in the action-sequence scheduling path', () => {
    const commercialFoundationActions = [
      {
        id: 'brand:01:01:gum-product-readiness',
        title: 'List caffeine dosage, flavor, texture, and compliance assumptions for the gum formula',
        deliverableId: 'deliverable-product',
        deliverableTitle: 'Finalize caffeinated gum formula, sample, packaging, sourcing, and sellable unit readiness',
        estimateMin: 480,
        sessionTitles: [
          'List caffeine dosage, flavor, texture, and compliance assumptions for the gum formula',
          'Shortlist viable stimulant dosage and gum base formulation options',
          'Request sample capability notes from two gum manufacturers',
          'Compare manufacturer MOQ, lead time, certifications, and sample cost',
          'Choose initial formula direction and sample acceptance criteria',
          'Define packaging format, count size, label claims, and required warnings',
          'Request packaging quote and dieline requirements from supplier A',
          'Compare packaging costs, lead times, minimums, and print constraints',
        ],
      },
      {
        id: 'brand:02:01:gum-commerce-readiness',
        title: 'Define launch offer promise, pack size, price hypothesis, and buyer guarantee',
        deliverableId: 'deliverable-commerce',
        deliverableTitle: 'Set caffeinated gum offer, pricing, product page, checkout, ordering, and fulfillment path',
        estimateMin: 480,
        sessionTitles: [
          'Define launch offer promise, pack size, price hypothesis, and buyer guarantee',
          'Compare unit economics using formula, packaging, shipping, and platform fees',
          'Draft pricing test assumptions and minimum viable margin threshold',
          'Outline product page sections for benefits, ingredients, usage, and proof',
          'Write product page copy for caffeine benefit, flavor, safety, and buyer fit',
          'Select checkout or order-capture path for first real sales',
          'Configure checkout fields, payment method, tax/shipping assumptions, and confirmation flow',
          'Define fulfillment handling for paid orders, samples, backorders, and refunds',
        ],
      },
      {
        id: 'brand:03:01:gum-messaging-readiness',
        title: 'Define target buyer segment and strongest caffeinated gum use case',
        deliverableId: 'deliverable-messaging',
        deliverableTitle: 'Create caffeinated gum positioning, launch messaging, campaign assets, and sales CTA',
        estimateMin: 480,
        sessionTitles: [
          'Define target buyer segment and strongest caffeinated gum use case',
          'Write positioning statement tied to energy, convenience, taste, and trust',
          'Draft three message pillars for product benefit, safety, and buying reason',
          'Create product proof points from formula, packaging, sourcing, and offer assumptions',
          'Draft launch CTA tied to real purchase or order attempt',
          'Build product page hero copy and buyer objection answers',
          'Draft outreach message variant for early buyers',
          'Draft channel announcement variant with purchase-path link',
        ],
      },
    ];
    const commercialCycleActions = Array.from({ length: 5 }, (_, index) => {
      const cycleNumber = index + 1;
      return [
        {
          id: `brand:04:${String(cycleNumber).padStart(2, '0')}:cycle-${cycleNumber}-buyer-offer`,
          title: `Cycle ${cycleNumber} buyer segment and offer prep`,
          deliverableId: 'deliverable-sales',
          deliverableTitle:
            'Activate caffeinated gum first-sales outreach to initial buyers and track first order attempts',
          estimateMin: 180,
          sessionTitles: [
            `Target and segment cycle ${cycleNumber} buyers by urgency, fit, and purchase likelihood`,
            `Prepare cycle ${cycleNumber} offer with CTA, proof, price angle, guarantee, and purchase path`,
            `Confirm cycle ${cycleNumber} buyer list and send plan`,
          ],
        },
        {
          id: `brand:04:${String(cycleNumber).padStart(2, '0')}:cycle-${cycleNumber}-outreach-response`,
          title: `Cycle ${cycleNumber} outreach batch and response capture`,
          deliverableId: 'deliverable-sales',
          deliverableTitle:
            'Activate caffeinated gum first-sales outreach to initial buyers and track first order attempts',
          estimateMin: 180,
          sessionTitles: [
            `Send cycle ${cycleNumber} outreach batch with purchase-path CTA`,
            `Capture cycle ${cycleNumber} response signal from replies, clicks, objections, and order intent`,
            `Log cycle ${cycleNumber} buyer questions and silence patterns`,
          ],
        },
        {
          id: `brand:05:${String(cycleNumber).padStart(2, '0')}:cycle-${cycleNumber}-adjustment`,
          title: `Adjust cycle ${cycleNumber} CTA, proof, pricing, targeting, and purchase path`,
          deliverableId: 'deliverable-review',
          deliverableTitle: 'Review caffeinated gum first-sales evidence, conversion results, and next-step decision',
          estimateMin: 180,
          sessionTitles: [
            `Adjust cycle ${cycleNumber} CTA and proof after weak clicks, trust gaps, and buyer questions`,
            `Adjust cycle ${cycleNumber} pricing, guarantee, and pack-size angle after objection review`,
            `Decide cycle ${cycleNumber} next move from response quality and purchase-path friction`,
          ],
        },
      ];
    }).flat();

    const plan = compileAutoAsanaPlan({
      goalId: 'goal-commercial-readiness-compact',
      cycleId: 'cycle-commercial-readiness-compact',
      planProof: {
        workableDaysRemaining: 190,
        totalRequiredUnits: 69,
        requiredPacePerDay: 1,
        maxPerDay: 5,
        maxPerWeek: 20,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 0.25,
      },
      constraints: {
        timezone: 'UTC',
        weeklyWindows: {
          MON: [{ startHHMM: '09:00', endHHMM: '14:00' }],
          TUE: [{ startHHMM: '09:00', endHHMM: '14:00' }],
          WED: [{ startHHMM: '09:00', endHHMM: '14:00' }],
          THU: [{ startHHMM: '09:00', endHHMM: '14:00' }],
          FRI: [{ startHHMM: '09:00', endHHMM: '14:00' }],
        },
        cycleStartDayKey: '2026-04-20',
        cycleEndDayKey: '2027-01-20',
      },
      nowISO: '2026-04-20T12:00:00.000Z',
      horizonDays: 276,
      acceptedBlocks: [],
      actionSequence: [...commercialFoundationActions, ...commercialCycleActions],
    });

    expect(plan.horizonBlocks.length).toBeGreaterThan(60);

    const foundationBlocks = plan.horizonBlocks.filter((block) => /^brand:0[123]:/.test(String(block.actionId || '')));
    const cycleBlocks = plan.horizonBlocks.filter((block) => /^brand:0[45]:/.test(String(block.actionId || '')));
    const foundationDayKeys = foundationBlocks.map((block) => block.dayKey).sort();
    const cycleDayKeys = cycleBlocks.map((block) => block.dayKey).sort();
    const foundationSpanDays =
      (new Date(`${foundationDayKeys[foundationDayKeys.length - 1]}T12:00:00.000Z`).getTime() -
        new Date(`${foundationDayKeys[0]}T12:00:00.000Z`).getTime()) /
      (24 * 60 * 60 * 1000);

    expect(foundationSpanDays).toBeLessThanOrEqual(45);
    expect(foundationDayKeys[foundationDayKeys.length - 1] < cycleDayKeys[0]).toBe(true);
    expect(cycleDayKeys[cycleDayKeys.length - 1]).toMatch(/^2026-(10|11|12)|^2027-01/);
  });

  it('preserves valid session-plan dates and falls back to compact packing when session-plan date violates hard-gate floor', () => {
    const actions = [
      {
        id: 'brand:01:01:gum-product-readiness',
        title: 'List caffeine dosage, flavor, texture, and compliance assumptions for the gum formula',
        deliverableId: 'deliverable-product',
        deliverableTitle: 'Finalize caffeinated gum formula, sample, packaging, sourcing, and sellable unit readiness',
        estimateMin: 60,
      },
      {
        id: 'brand:02:01:gum-commerce-readiness',
        title: 'Define launch offer promise, pack size, price hypothesis, and buyer guarantee',
        deliverableId: 'deliverable-commerce',
        deliverableTitle: 'Set caffeinated gum offer, pricing, product page, checkout, ordering, and fulfillment path',
        estimateMin: 60,
        dependencies: ['brand:01:01:gum-product-readiness'],
      },
      {
        id: 'brand:04:01:cycle-1-buyer-offer',
        title: 'Cycle 1 buyer segment and offer prep',
        deliverableId: 'deliverable-sales',
        deliverableTitle:
          'Activate caffeinated gum first-sales outreach to initial buyers and track first order attempts',
        estimateMin: 60,
        dependencies: ['brand:02:01:gum-commerce-readiness'],
      },
    ];

    const compilePlan = (sessionPlan) =>
      compileAutoAsanaPlan({
        goalId: 'goal-commercial-session-compact',
        cycleId: 'cycle-commercial-session-compact',
        planProof: {
          workableDaysRemaining: 190,
          totalRequiredUnits: Math.max(1, Array.isArray(sessionPlan) && sessionPlan.length > 0 ? sessionPlan.length : actions.length),
          requiredPacePerDay: 1,
          maxPerDay: 5,
          maxPerWeek: 20,
          slackUnits: 0,
          slackRatio: 0,
          intensityRatio: 0.25,
        },
        constraints: {
          timezone: 'UTC',
          weeklyWindows: {
            MON: [{ startHHMM: '09:00', endHHMM: '14:00' }],
            TUE: [{ startHHMM: '09:00', endHHMM: '14:00' }],
            WED: [{ startHHMM: '09:00', endHHMM: '14:00' }],
            THU: [{ startHHMM: '09:00', endHHMM: '14:00' }],
            FRI: [{ startHHMM: '09:00', endHHMM: '14:00' }],
          },
          cycleStartDayKey: '2026-04-20',
          cycleEndDayKey: '2027-01-20',
        },
        nowISO: '2026-04-20T12:00:00.000Z',
        horizonDays: 276,
        acceptedBlocks: [],
        actionSequence: actions,
        sessionPlan,
      });

    const preservedSessionPlan = [
      {
        date: '2026-04-22',
        startTime: '09:00',
        durationMinutes: 60,
        actionId: 'brand:01:01:gum-product-readiness',
        deliverableId: 'deliverable-product',
        title: 'List caffeine dosage, flavor, texture, and compliance assumptions for the gum formula',
      },
      {
        date: '2026-06-08',
        startTime: '09:00',
        durationMinutes: 60,
        actionId: 'brand:02:01:gum-commerce-readiness',
        deliverableId: 'deliverable-commerce',
        title: 'Define launch offer promise, pack size, price hypothesis, and buyer guarantee',
      },
      {
        date: '2026-09-21',
        startTime: '09:00',
        durationMinutes: 60,
        actionId: 'brand:04:01:cycle-1-buyer-offer',
        deliverableId: 'deliverable-sales',
        title: 'Target and segment cycle 1 buyers by urgency, fit, and purchase likelihood',
      },
    ];
    const preservedPlan = compilePlan(preservedSessionPlan);
    expect(
      preservedPlan.horizonBlocks.find((block) => block.actionId === 'brand:02:01:gum-commerce-readiness')?.dayKey
    ).toBe('2026-06-08');
    expect(
      preservedPlan.horizonBlocks.find((block) => block.actionId === 'brand:04:01:cycle-1-buyer-offer')?.dayKey
    ).toBe('2026-09-21');

    const compactFallbackPlan = compilePlan([]);
    const compactCycleDayKey =
      compactFallbackPlan.horizonBlocks.find((block) => block.actionId === 'brand:04:01:cycle-1-buyer-offer')?.dayKey ||
      null;
    expect(compactCycleDayKey).toBeTruthy();

    const violatingSessionPlan = [
      preservedSessionPlan[0],
      preservedSessionPlan[1],
      {
        date: '2026-04-20',
        startTime: '09:00',
        durationMinutes: 60,
        actionId: 'brand:04:01:cycle-1-buyer-offer',
        deliverableId: 'deliverable-sales',
        title: 'Target and segment cycle 1 buyers by urgency, fit, and purchase likelihood',
      },
    ];
    const violatingPlan = compilePlan(violatingSessionPlan);
    const violatingCycleBlock = violatingPlan.horizonBlocks.find(
      (block) => block.actionId === 'brand:04:01:cycle-1-buyer-offer'
    );

    expect(violatingCycleBlock?.dayKey).toBe(compactCycleDayKey);
    expect(String(violatingCycleBlock?.dayKey || '') >= '2026-06-08').toBe(true);
  });
});
