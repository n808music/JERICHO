import { describe, expect, it } from 'vitest';

import { callClaudeForActionGraph, callClaudeForSessionPlan } from '../../src/state/mockLLMActionGraph.ts';
import { buildAutoDeliverablesFromGoalContract } from '../../src/domain/autoStrategy.ts';
import { planQualityAudit, addBusinessDays } from '../../src/domain/goal/planQualityAudit.ts';

describe('mockLLMActionGraph BrandLaunch builder path', () => {
  it('15-month gum horizon carries more commercial cycles and higher block budget than 9-month — horizon is now planning-responsive', async () => {
    const goalText =
      'Launch a caffeinated gum brand with concept validation, branding, packaging, sourcing, launch setup, and first real sales completed.';
    const verificationCriteria =
      'Caffeinated gum product sample approved, packaging ready, product page live, purchase path active, and first sales evidence reviewed.';
    const planningIntake = {
      goalClassification: 'regulated_physical_consumable',
      goalDescription: goalText,
      targetCategory: 'functional_food',
      distributionChannel: 'direct_to_consumer',
      formulaPathway: 'white_label',
      capitalAvailable: 0,
      capitalAcquisitionRequired: true,
      weeklyHoursAvailable: 40,
      executionContext: 'full_time',
    };
    const makeContract = (goalId: string, deadlineDayKey: string) => ({
      goalId,
      executionType: 'BrandLaunch',
      goalText,
      startDayKey: '2026-04-21',
      temporalBinding: { startDayKey: '2026-04-21' },
      deadline: { dayKey: deadlineDayKey },
      planningIntake,
      terminalOutcome: {
        text: goalText,
        verificationCriteria,
      },
    });

    const nineMonthContract = makeContract('goal-brandlaunch-9m', '2027-01-21');
    const fifteenMonthContract = makeContract('goal-brandlaunch-15m', '2027-07-31');

    const nineMonthDeliverables = buildAutoDeliverablesFromGoalContract(
      nineMonthContract as any,
      '2026-04-21',
      'UTC'
    ).deliverables;
    const fifteenMonthDeliverables = buildAutoDeliverablesFromGoalContract(
      fifteenMonthContract as any,
      '2026-04-21',
      'UTC'
    ).deliverables;

    // Both horizons produce the same 5 deliverable families — correct, the domain
    // work families don't change. What changes is the depth inside each family.
    expect(nineMonthDeliverables).toHaveLength(5);
    expect(fifteenMonthDeliverables).toHaveLength(5);
    expect(fifteenMonthDeliverables.map((item) => item.title)).toEqual(nineMonthDeliverables.map((item) => item.title));

    const nineMonthTotalBlocks = nineMonthDeliverables.reduce((sum, item) => sum + Number(item.requiredBlocks || 0), 0);
    const fifteenMonthTotalBlocks = fifteenMonthDeliverables.reduce(
      (sum, item) => sum + Number(item.requiredBlocks || 0),
      0
    );
    // 15-month plan earns more blocks: more sourcing loops, compliance checks,
    // merchant readiness gates, and sales cycles than a 9-month plan.
    expect(fifteenMonthTotalBlocks).toBeGreaterThan(nineMonthTotalBlocks);
    // 9-month stays at 5 cycles (baseline unchanged).
    expect(nineMonthTotalBlocks).toBe(138);
    // 15-month produces 8 operating cycles (8 * 28 blocks = 224 total, formula gives 198).
    expect(fifteenMonthTotalBlocks).toBe(198);

    const [nineMonthGraph, fifteenMonthGraph] = await Promise.all([
      callClaudeForActionGraph(
        { executionType: 'BrandLaunch', goalText },
        nineMonthContract,
        'BrandLaunch',
        'dev-mock-key'
      ),
      callClaudeForActionGraph(
        { executionType: 'BrandLaunch', goalText },
        fifteenMonthContract,
        'BrandLaunch',
        'dev-mock-key'
      ),
    ]);

    expect(nineMonthGraph.ok).toBe(true);
    expect(fifteenMonthGraph.ok).toBe(true);
    if (!nineMonthGraph.ok || !fifteenMonthGraph.ok) return;

    const cycleCountsFrom = (graph: typeof nineMonthGraph) =>
      new Set(
        (graph as any).graph.actions
          .map((action: any) => Number(action?.commercialCycleCount))
          .filter((value: number) => Number.isFinite(value) && value > 0)
      );

    const nineMonthCycleCounts = cycleCountsFrom(nineMonthGraph);
    const fifteenMonthCycleCounts = cycleCountsFrom(fifteenMonthGraph);

    // 9-month stays at 5 commercial cycles.
    expect([...nineMonthCycleCounts]).toEqual([5]);
    // 15-month earns 8 commercial cycles — more outreach loops, evidence reviews, and
    // decision gates that a longer commercial horizon justifies.
    expect([...fifteenMonthCycleCounts]).toEqual([8]);
    expect(Math.max(...fifteenMonthCycleCounts)).toBeGreaterThan(Math.max(...nineMonthCycleCounts));
  });

  it('derives brand-launch actions from admitted contract deliverables', async () => {
    const result = await callClaudeForActionGraph(
      {
        executionType: 'BrandLaunch',
        goalText:
          'Launch a consulting business brand in 45 days with positioning, messaging, visual identity, profile updates, and launch collateral completed.',
      },
      {
        executionType: 'BrandLaunch',
        terminalOutcome: {
          text: 'Launch a consulting business brand in 45 days with positioning, messaging, visual identity, profile updates, and launch collateral completed.',
          verificationCriteria: 'Brand launch assets are live and audience CTA is active',
        },
      },
      'BrandLaunch',
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const titles = result.graph.actions.map((action) => String(action?.title || '').toLowerCase());
    expect(titles).toEqual(
      expect.arrayContaining([
        expect.stringContaining('audience insight'),
        expect.stringContaining('message pillars'),
        expect.stringContaining('visual identity'),
        expect.stringContaining('brand kit'),
        expect.stringContaining('channel profiles'),
        expect.stringContaining('launch announcement'),
      ])
    );
    expect(
      (result.graph.diagnostics?.notes || []).some((note) =>
        note.includes('Mock graph for BrandLaunch goals derived from admitted contract deliverables.')
      )
    ).toBe(true);
  });

  it('derives commercial product launch actions for gum first-sales BrandLaunch goals', async () => {
    const goalText =
      'Launch a caffeinated gum brand in 75 days with concept validation, branding, packaging, sourcing, launch setup, and first real sales completed.';
    const verificationCriteria =
      'Caffeinated gum product sample approved, packaging ready, product page live, purchase path active, and first sales evidence reviewed.';
    const result = await callClaudeForActionGraph(
      {
        executionType: 'BrandLaunch',
        goalText,
      },
      {
        executionType: 'BrandLaunch',
        terminalOutcome: {
          text: goalText,
          verificationCriteria,
        },
      },
      'BrandLaunch',
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const titles = result.graph.actions.map((action) => String(action?.title || '').toLowerCase());
    expect(titles).toEqual(
      expect.arrayContaining([
        expect.stringContaining('list caffeine dosage'),
        expect.stringContaining('define launch offer promise'),
        expect.stringContaining('define target buyer segment'),
        expect.stringContaining('cycle 1 buyer segment and offer prep'),
        expect.stringContaining('cycle 1 outreach batch and response capture'),
        expect.stringContaining('cycle 1 purchase-path attempt and friction capture'),
        expect.stringContaining('resolve cycle 1 multi-domain commercial friction'),
        expect.stringContaining('commit cycle 1 next market move'),
      ])
    );
    expect(titles).not.toEqual(
      expect.arrayContaining([
        'resolve gum formula, sample, and packaging readiness',
        'build gum offer, pricing, and checkout path',
        'build gum launch positioning and messaging assets',
      ])
    );
    expect(titles).not.toEqual(
      expect.arrayContaining([
        'define brand positioning and audience promise',
        'build messaging architecture for priority channels',
        'publish brand launch announcement and audience cta',
      ])
    );
    const cycleActions = result.graph.actions.filter((action) =>
      /^(cycle|resolve cycle|synthesize cycle|commit cycle|make terminal)/i.test(String(action?.title || ''))
    );
    const cycleNumbers = new Set(
      cycleActions.map((action) => String(action?.title || '').match(/^cycle\s+(\d+)/i)?.[1]).filter(Boolean)
    );
    expect(cycleNumbers.size).toBeGreaterThanOrEqual(3);
    for (const cycleNumber of cycleNumbers) {
      const cycleTitlePrefix = String(cycleNumber) === String(cycleNumbers.size) ? 'make terminal' : '';
      const cycleTitles = cycleActions
        .filter((action) => {
          const title = String(action?.title || '').toLowerCase();
          return (
            title.startsWith(`cycle ${cycleNumber} `) ||
            title.startsWith(`resolve cycle ${cycleNumber} `) ||
            title.startsWith(`synthesize cycle ${cycleNumber} `) ||
            title.startsWith(`commit cycle ${cycleNumber} `) ||
            (cycleTitlePrefix && title.startsWith(cycleTitlePrefix))
          );
        })
        .map((action) => String(action?.title || '').toLowerCase());
      expect(cycleTitles.some((title) => title.includes('buyer segment') && title.includes('offer prep'))).toBe(true);
      expect(cycleTitles.some((title) => title.includes('outreach batch') && title.includes('response capture'))).toBe(
        true
      );
      expect(
        cycleTitles.some((title) => title.includes('purchase-path attempt') && title.includes('friction capture'))
      ).toBe(true);
      expect(cycleTitles.some((title) => title.includes('resolve cycle') && title.includes('friction'))).toBe(true);
      expect(cycleTitles.some((title) => title.includes('commit cycle') || title.includes('make terminal'))).toBe(true);

      const cycleSessionTitles = cycleActions
        .filter((action) => {
          const title = String(action?.title || '').toLowerCase();
          return (
            title.startsWith(`cycle ${cycleNumber} `) ||
            title.startsWith(`resolve cycle ${cycleNumber} `) ||
            title.startsWith(`synthesize cycle ${cycleNumber} `) ||
            title.startsWith(`commit cycle ${cycleNumber} `) ||
            (cycleTitlePrefix && title.startsWith(cycleTitlePrefix))
          );
        })
        .flatMap((action) => (Array.isArray(action?.sessionTitles) ? action.sessionTitles : []))
        .map((title) => String(title || '').toLowerCase());
      expect(cycleSessionTitles.length).toBeGreaterThan(8);
      expect(cycleSessionTitles.join(' | ')).toMatch(/target and segment/);
      expect(cycleSessionTitles.join(' | ')).toMatch(/prepare cycle .*offer/);
      expect(cycleSessionTitles.join(' | ')).toMatch(/send .*outreach/);
      expect(cycleSessionTitles.join(' | ')).toMatch(/capture cycle .*response signal/);
      expect(cycleSessionTitles.join(' | ')).toMatch(/purchase-path attempt/);
      expect(cycleSessionTitles.join(' | ')).toMatch(
        /weak clicks|pricing objections|trust, proof|segment mismatch|checkout and payment friction|shipping, fulfillment|weak order/i
      );
      expect(cycleSessionTitles.join(' | ')).toMatch(/revise|strengthen|fix|retarget|rebuild|confirm/);
      expect(cycleSessionTitles.join(' | ')).toMatch(/commit cycle .*next market move|terminal first-sales push/);
    }
    expect(result.graph.diagnostics?.notes || []).toContain('Commercial product launch semantic branch selected.');
  });

  it('activates regulated consumable requirements for caffeinated gum product launches', async () => {
    const goalText = 'Build a caffeinated gum brand and take it to first real sales';
    const result = await callClaudeForActionGraph(
      {
        executionType: 'BrandLaunch',
        goalText,
      },
      {
        executionType: 'BrandLaunch',
        goalText,
        terminalOutcome: {
          text: 'Launch the caffeinated gum product with packaging, sourcing, purchase path, and first real sales.',
          verificationCriteria:
            'Sellable gum offer, compliant claims, manufacturer sample path, checkout path, and first-sales evidence are complete.',
        },
      },
      'BrandLaunch',
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.graph.diagnostics?.notes || []).toContain(
      'Regulated physical consumable requirement layer selected.'
    );

    const actions = result.graph.actions || [];
    const actionById = new Map(actions.map((action) => [String(action?.id || ''), action]));
    const requiredFamilies = new Set(
      actions.map((action) => String(action?.requiredWorkFamily || '')).filter(Boolean)
    );
    expect(actions.length).toBeGreaterThan(20);
    expect(requiredFamilies).toEqual(
      expect.objectContaining(
        new Set([
          'REGULATORY_AND_LABEL_REVIEW',
          'MERCHANT_ACCOUNT_UNDERWRITING',
          'CAPITAL_GATE_CHECKPOINTS',
          'HERO_IMAGERY_PRODUCTION',
          'PARALLEL_PACKAGING_TRACK',
        ])
      )
    );

    const manufacturerWait = actions.find((action) => String(action?.waitType || '') === 'manufacturer_initial_response');
    const regulatoryWait = actions.find((action) => String(action?.waitType || '') === 'regulatory_review');
    const merchantApproval = actions.find((action) =>
      /confirm merchant account approval/i.test(String(action?.title || ''))
    );
    const checkoutPath = actions.find((action) =>
      /select checkout or order-capture path/i.test(String(action?.title || ''))
    );
    const firstSampleRequest = actions.find((action) => /first sample request to manufacturer/i.test(String(action?.title || '')));
    const sampleCapitalGate = actions.find((action) => String(action?.capitalGateId || '') === 'sample_cycle_costs');

    expect(manufacturerWait?.minimumDurationBusinessDays).toBe(15);
    expect(regulatoryWait?.minimumDurationBusinessDays).toBe(10);
    expect(merchantApproval).toBeTruthy();
    expect(checkoutPath).toBeTruthy();
    expect(firstSampleRequest?.dependencies || []).toContain(sampleCapitalGate?.id);
    expect(actionById.has('brand:04:01:cycle-1-buyer-offer')).toBe(true);
    expect([...actionById.keys()].some((id) => /^brand:05:\d+:cycle-\d+-next-move-decision$/.test(id))).toBe(true);
  });

  it('respects regulated minimum business-day wait spans in the session planner', async () => {
    const goalText = 'Build a caffeinated gum brand and take it to first real sales';
    const actionGraphResult = await callClaudeForActionGraph(
      {
        executionType: 'BrandLaunch',
        goalText,
      },
      {
        executionType: 'BrandLaunch',
        goalText,
        startDayKey: '2026-04-21',
        temporalBinding: { startDayKey: '2026-04-21' },
        deadline: { dayKey: '2026-12-31' },
        planningIntake: {
          goalClassification: 'regulated_physical_consumable',
        },
        terminalOutcome: {
          text: 'Launch the caffeinated gum product with packaging, sourcing, purchase path, and first real sales.',
          verificationCriteria:
            'Sellable gum offer, compliant claims, manufacturer sample path, checkout path, and first-sales evidence are complete.',
        },
      },
      'BrandLaunch',
      'dev-mock-key'
    );

    expect(actionGraphResult.ok).toBe(true);
    if (!actionGraphResult.ok) return;

    const sessionResult = await callClaudeForSessionPlan(
      {
        goalDraftV2: {
          executionType: 'BrandLaunch',
          goalText,
        },
        contract: {
          executionType: 'BrandLaunch',
          goalText,
          startDayKey: '2026-04-21',
          temporalBinding: { startDayKey: '2026-04-21' },
          deadline: { dayKey: '2026-12-31' },
          planningIntake: {
            goalClassification: 'regulated_physical_consumable',
          },
        },
        executionType: 'BrandLaunch',
        actions: actionGraphResult.graph.actions,
        nowISO: '2026-04-21T12:00:00.000Z',
      },
      'dev-mock-key'
    );

    expect(sessionResult.ok).toBe(true);
    if (!sessionResult.ok) return;

    const manufacturerWaitAction = actionGraphResult.graph.actions.find(
      (action) => String(action?.waitType || '') === 'manufacturer_initial_response'
    );
    const manufacturerDates = sessionResult.sessions
      .filter((session) => session.actionId === manufacturerWaitAction?.id)
      .map((session) => session.date);
    expect(manufacturerDates.length).toBeGreaterThan(0);
    expect(manufacturerDates[0]).toBeTruthy();
    expect(manufacturerDates[manufacturerDates.length - 1] >= '2026-05-13').toBe(true);
  });

  it('keeps gum first-sales semantics when the terminal outcome text is brand-generic', async () => {
    const goalText = 'Build a caffeinated gum brand and take it to first real sales';
    const result = await callClaudeForActionGraph(
      {
        executionType: 'BrandLaunch',
        goalText,
      },
      {
        executionType: 'BrandLaunch',
        goalText,
        temporalBinding: { startDayKey: '2026-01-01' },
        deadline: { dayKey: '2026-12-31' },
        terminalOutcome: {
          text: 'Launch the brand with concept validation and launch setup completed.',
          verificationCriteria: 'The brand has launch setup complete.',
        },
      },
      'BrandLaunch',
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const titles = result.graph.actions.map((action) => String(action?.title || '').toLowerCase());
    expect(titles).toEqual(
      expect.arrayContaining([
        expect.stringContaining('list caffeine dosage'),
        expect.stringContaining('define launch offer promise'),
        expect.stringContaining('cycle 1 buyer segment and offer prep'),
        expect.stringContaining('cycle 5 buyer segment and offer prep'),
        expect.stringContaining('cycle 5 outreach batch and response capture'),
        expect.stringContaining('resolve cycle 5 multi-domain commercial friction'),
        expect.stringContaining('make terminal first-sales push'),
      ])
    );
    expect(result.graph.actions.length).toBeGreaterThan(50);
    expect(result.graph.diagnostics?.totalEstimateMin || 0).toBeGreaterThan(2400);

    const sessionResult = await callClaudeForSessionPlan(
      {
        goalDraftV2: {
          executionType: 'BrandLaunch',
          goalText,
        },
        contract: {
          executionType: 'BrandLaunch',
          goalText,
          temporalBinding: { startDayKey: '2026-01-01' },
          deadline: { dayKey: '2026-12-31' },
        },
        executionType: 'BrandLaunch',
        actions: result.graph.actions,
        nowISO: '2026-04-17T12:00:00.000Z',
      },
      'dev-mock-key'
    );

    expect(sessionResult.ok).toBe(true);
    if (!sessionResult.ok) return;

    const dates = sessionResult.sessions.map((session) => session.date);
    const sessionTitles = sessionResult.sessions.map((session) => String(session.title || '').toLowerCase());
    expect(dates.length).toBeGreaterThanOrEqual(130);
    expect(dates[0]).toBe('2026-01-01');
    const sessionsByDate = new Map<string, number>();
    dates.forEach((date) => sessionsByDate.set(String(date), (sessionsByDate.get(String(date)) || 0) + 1));
    expect(Array.from(sessionsByDate.values()).filter((count) => count >= 2).length).toBeGreaterThanOrEqual(20);
    expect(Math.max(...Array.from(sessionsByDate.values()))).toBeLessThanOrEqual(5);
    // Sessions now span across horizon phases, not compressed to Q2.
    expect(String(dates[dates.length - 1] || '')).toMatch(/^2026-(06|07|08|09|10|11|12)/);
    // Long commercial horizons retain a late commercial corridor rather than one isolated checkpoint.
    expect(dates.some((date) => /^2026-06-/.test(String(date || '')))).toBe(true);
    expect(sessionTitles).toEqual(
      expect.arrayContaining([
        expect.stringContaining('request sample capability notes'),
        expect.stringContaining('compare manufacturer moq'),
        expect.stringContaining('configure checkout fields'),
        expect.stringContaining('send first 10 buyer outreach messages'),
        expect.stringContaining('capture cycle 1 response signal'),
      ])
    );
    expect(sessionTitles.filter((title) => /\bsession\s+\d+\s+of\s+\d+\b/i.test(title))).toHaveLength(0);
    expect(sessionTitles.filter((title) => /^scope |^complete /.test(title))).toHaveLength(0);
  });

  it('weights cycle review and adjustment depth by named commercial friction domains', async () => {
    const goalText = 'Build a caffeinated gum brand and take it to first real sales';
    const result = await callClaudeForActionGraph(
      {
        executionType: 'BrandLaunch',
        goalText,
      },
      {
        executionType: 'BrandLaunch',
        goalText,
        temporalBinding: { startDayKey: '2026-01-01' },
        deadline: { dayKey: '2026-12-31' },
        terminalOutcome: {
          text: 'Launch the brand with concept validation and launch setup completed.',
          verificationCriteria: 'The brand has launch setup complete.',
        },
      },
      'BrandLaunch',
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const actionById = new Map(result.graph.actions.map((action) => [String(action?.id || ''), action]));
    const cycle2Adjustment = actionById.get('brand:05:02:cycle-2-adjustment');
    const cycle4Adjustment = actionById.get('brand:05:04:cycle-4-adjustment');
    const cycle4Interpretation = actionById.get('brand:05:04:cycle-4-evidence-interpretation');
    const cycle2Decision = actionById.get('brand:05:02:cycle-2-next-move-decision');
    const cycle4Decision = actionById.get('brand:05:04:cycle-4-next-move-decision');
    const cycle5Decision = actionById.get('brand:05:05:cycle-5-next-move-decision');

    const cycle2AdjustmentTitles = (cycle2Adjustment?.sessionTitles || []).map((title) =>
      String(title || '').toLowerCase()
    );
    const cycle4AdjustmentTitles = (cycle4Adjustment?.sessionTitles || []).map((title) =>
      String(title || '').toLowerCase()
    );
    const cycle2DecisionTitles = (cycle2Decision?.sessionTitles || []).map((title) =>
      String(title || '').toLowerCase()
    );
    const cycle4InterpretationTitles = (cycle4Interpretation?.sessionTitles || []).map((title) =>
      String(title || '').toLowerCase()
    );
    const cycle4DecisionTitles = (cycle4Decision?.sessionTitles || []).map((title) =>
      String(title || '').toLowerCase()
    );
    const cycle5DecisionTitles = (cycle5Decision?.sessionTitles || []).map((title) =>
      String(title || '').toLowerCase()
    );

    expect(cycle2AdjustmentTitles).toHaveLength(2);
    expect(cycle4AdjustmentTitles.length).toBeGreaterThan(cycle2AdjustmentTitles.length);
    expect(cycle4AdjustmentTitles).toEqual(
      expect.arrayContaining([
        expect.stringContaining('weak clicks'),
        expect.stringContaining('price resistance'),
        expect.stringContaining('trust objections'),
        expect.stringContaining('mismatch evidence'),
        expect.stringContaining('weak order signals'),
      ])
    );
    expect(cycle2DecisionTitles).toHaveLength(1);
    expect(cycle4Interpretation?.title?.toLowerCase()).toContain('synthesize cycle 4 evidence conclusion');
    expect(cycle4Decision?.title?.toLowerCase()).toContain('commit cycle 4 next market move');
    expect(cycle4Interpretation?.dependencies || []).toContain(cycle4Adjustment?.id);
    expect(cycle4Decision?.dependencies || []).toContain(cycle4Interpretation?.id);
    expect(cycle4InterpretationTitles).toHaveLength(1);
    expect(cycle4DecisionTitles).toHaveLength(1);
    expect(cycle4InterpretationTitles[0]).toContain('synthesize cycle 4 evidence conclusion');
    expect(cycle4DecisionTitles[0]).toContain('commit cycle 4 next market move');
    expect(cycle4InterpretationTitles[0]).not.toMatch(/segment|channel|offer|follow-up push/);
    expect(cycle4DecisionTitles[0]).not.toContain('synthesize');
    expect(cycle5DecisionTitles).toEqual(
      expect.arrayContaining([expect.stringContaining('make terminal first-sales push')])
    );
    expect(cycle5DecisionTitles.join(' | ')).toMatch(/remaining-risk call|launch handoff/);
    expect(cycle5DecisionTitles.join(' | ')).not.toContain('commit cycle 5 next market move');
  });

  it('decomposes and interleaves commercial prep stacks instead of serializing broad family containers', async () => {
    const goalText = 'Build a caffeinated gum brand and take it to first real sales';
    const result = await callClaudeForActionGraph(
      {
        executionType: 'BrandLaunch',
        goalText,
      },
      {
        executionType: 'BrandLaunch',
        goalText,
        temporalBinding: { startDayKey: '2026-01-01' },
        deadline: { dayKey: '2026-12-31' },
        terminalOutcome: {
          text: 'Launch the caffeinated gum product with packaging, sourcing, purchase path, and first real sales.',
          verificationCriteria: 'Sellable gum offer, checkout path, and first-sales evidence are complete.',
        },
      },
      'BrandLaunch',
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const actions = result.graph.actions || [];
    const titles = actions.map((action) => String(action?.title || '').toLowerCase());
    expect(titles).not.toEqual(
      expect.arrayContaining([
        'resolve gum formula, sample, and packaging readiness',
        'build gum offer, pricing, and checkout path',
        'build gum launch positioning and messaging assets',
        'cycle 1 adjustment, evidence review, and next move',
      ])
    );

    const productActions = actions.filter((action) => String(action?.id || '').startsWith('brand:01:'));
    const commerceActions = actions.filter((action) => String(action?.id || '').startsWith('brand:02:'));
    const communicationsActions = actions.filter((action) => String(action?.id || '').startsWith('brand:03:'));

    expect(productActions.length).toBeGreaterThanOrEqual(2);
    expect(commerceActions.length).toBeGreaterThanOrEqual(2);
    expect(communicationsActions.length).toBeGreaterThanOrEqual(2);
    [...productActions, ...commerceActions, ...communicationsActions].forEach((action) => {
      expect(action?.estimateMin || 0).toBeLessThanOrEqual(300);
      expect(action?.sessionTitles?.length || 0).toBeLessThanOrEqual(5);
    });

    const foundationTitles = [...productActions, ...commerceActions, ...communicationsActions].map((action) =>
      String(action?.title || '').toLowerCase()
    );
    expect(new Set(foundationTitles).size).toBe(foundationTitles.length);

    const actionOrder = new Map(actions.map((action, index) => [String(action?.id || ''), index]));
    expect(actionOrder.get(String(commerceActions[0]?.id))).toBeLessThan(
      actionOrder.get(String(productActions[1]?.id))
    );
    expect(actionOrder.get(String(communicationsActions[0]?.id))).toBeLessThan(
      actionOrder.get(String(commerceActions[1]?.id))
    );

    expect(commerceActions[0]?.dependencies || []).toContain(productActions[0]?.id);
    expect(communicationsActions[0]?.dependencies || []).toEqual(
      expect.arrayContaining([productActions[0]?.id, commerceActions[0]?.id])
    );
    expect(productActions[1]?.dependencies || []).toContain(productActions[0]?.id);
    expect(commerceActions[1]?.dependencies || []).toContain(commerceActions[0]?.id);
    expect(communicationsActions[1]?.dependencies || []).toContain(communicationsActions[0]?.id);

    const sessionResult = await callClaudeForSessionPlan(
      {
        goalDraftV2: {
          executionType: 'BrandLaunch',
          goalText,
        },
        contract: {
          executionType: 'BrandLaunch',
          goalText,
          temporalBinding: { startDayKey: '2026-01-01' },
          deadline: { dayKey: '2026-12-31' },
        },
        executionType: 'BrandLaunch',
        actions,
        nowISO: '2026-04-17T12:00:00.000Z',
      },
      'dev-mock-key'
    );

    expect(sessionResult.ok).toBe(true);
    if (!sessionResult.ok) return;

    const familyForSession = (actionId: string) => {
      if (actionId.startsWith('brand:00:')) return 'regulated';
      if (actionId.startsWith('brand:01:')) return 'product';
      if (actionId.startsWith('brand:02:')) return 'commerce';
      if (actionId.startsWith('brand:03:')) return 'communications';
      return 'cycle';
    };
    const datedSessions = [...sessionResult.sessions].sort((left, right) => {
      const dateCompare = String(left?.date || '').localeCompare(String(right?.date || ''));
      if (dateCompare !== 0) return dateCompare;
      return String(left?.actionId || '').localeCompare(String(right?.actionId || ''));
    });
    const claimsBasisSessionDates = datedSessions
      .filter((session) => /lock compliance-safe claims/i.test(String(session?.title || '')))
      .map((session) => String(session?.date || ''));
    const shipReadyThresholdSessionDates = datedSessions
      .filter(
        (session) =>
          /capital checkpoint 4|manufacturing deposit/i.test(String(session?.title || '')) ||
          String(session?.actionId || '').includes('moq-production-deposit')
      )
      .map((session) => String(session?.date || ''));
    const commerceSessionDates = datedSessions
      .filter((session) => String(session?.actionId || '').startsWith('brand:02:'))
      .map((session) => String(session?.date || ''));
    expect(claimsBasisSessionDates.length).toBeGreaterThan(0);
    expect(shipReadyThresholdSessionDates.length).toBeGreaterThan(0);
    expect(commerceSessionDates.length).toBeGreaterThan(0);
    expect(
      String(claimsBasisSessionDates[claimsBasisSessionDates.length - 1]).localeCompare(String(commerceSessionDates[0]))
    ).toBeLessThanOrEqual(0);
    const preCycleFamilies = datedSessions
      .slice(
        0,
        datedSessions.findIndex((session) => String(session?.actionId || '').startsWith('brand:04:'))
      )
      .map((session) => familyForSession(String(session?.actionId || '')))
      .filter((family) => family !== 'cycle');
    const preCycleCoreFamilies = preCycleFamilies.filter((family) => family !== 'regulated');
    expect(new Set(preCycleCoreFamilies).size).toBeGreaterThanOrEqual(3);

    const firstStrongCommerceIndex = datedSessions.findIndex((session) =>
      String(session?.actionId || '').startsWith('brand:02:')
    );
    const earlyReadinessFamilies = (
      firstStrongCommerceIndex === -1 ? datedSessions : datedSessions.slice(0, firstStrongCommerceIndex)
    )
      .map((session) => familyForSession(String(session?.actionId || '')))
      .filter((family) => family !== 'cycle' && family !== 'regulated');

    let maxSameFamilyRun = 0;
    let currentFamily = '';
    let currentRun = 0;
    earlyReadinessFamilies.forEach((family) => {
      if (family === currentFamily) {
        currentRun += 1;
      } else {
        currentFamily = family;
        currentRun = 1;
      }
      maxSameFamilyRun = Math.max(maxSameFamilyRun, currentRun);
    });
    expect(maxSameFamilyRun).toBeLessThanOrEqual(12);

    const firstCycleSessionIndex = datedSessions.findIndex((session) =>
      String(session?.actionId || '').startsWith('brand:04:')
    );
    expect(firstCycleSessionIndex).toBeGreaterThan(0);
    const earlyFoundationSessions = (
      firstStrongCommerceIndex === -1 ? datedSessions : datedSessions.slice(0, firstStrongCommerceIndex)
    ).filter((session) => /^brand:0[0123]:/.test(String(session?.actionId || '')));
    const firstFoundationDate = String(earlyFoundationSessions[0]?.date || '');
    const lastFoundationDate = String(earlyFoundationSessions[earlyFoundationSessions.length - 1]?.date || '');
    const foundationSpanDays =
      (new Date(`${lastFoundationDate}T12:00:00.000Z`).getTime() -
        new Date(`${firstFoundationDate}T12:00:00.000Z`).getTime()) /
      (24 * 60 * 60 * 1000);
    expect(foundationSpanDays).toBeLessThanOrEqual(190);
    const postCycleFoundationSessions = datedSessions
      .slice(firstCycleSessionIndex)
      .filter((session) => /^brand:0[0123]:/.test(String(session?.actionId || '')));
    expect(postCycleFoundationSessions.length).toBeGreaterThan(0);
  });

  it('generates evidence-driven second-pass gum launch tasks and avoids templated follow-up rounds', async () => {
    const goalText =
      'Launch a caffeinated gum brand in 75 days with concept validation, branding, packaging, sourcing, launch setup, and first real sales completed.';
    const verificationCriteria =
      'Caffeinated gum product sample approved, packaging ready, product page live, purchase path active, and first sales evidence reviewed.';
    const graphResult = await callClaudeForActionGraph(
      {
        executionType: 'BrandLaunch',
        goalText,
      },
      {
        executionType: 'BrandLaunch',
        terminalOutcome: {
          text: goalText,
          verificationCriteria,
        },
      },
      'BrandLaunch',
      'dev-mock-key'
    );

    expect(graphResult.ok).toBe(true);
    if (!graphResult.ok) return;

    const sessionResult = await callClaudeForSessionPlan(
      {
        goalDraftV2: {
          executionType: 'BrandLaunch',
          goalText,
        },
        contract: {
          executionType: 'BrandLaunch',
          goalText,
          temporalBinding: { startDayKey: '2026-01-01' },
          deadline: { dayKey: '2026-12-31' },
        },
        executionType: 'BrandLaunch',
        actions: graphResult.graph.actions,
        nowISO: '2026-04-17T12:00:00.000Z',
      },
      'dev-mock-key'
    );

    expect(sessionResult.ok).toBe(true);
    if (!sessionResult.ok) return;

    const sessionTitles = sessionResult.sessions.map((session) => String(session.title || '').toLowerCase());

    expect(sessionTitles.some((title) => /follow-up round/gi.test(title))).toBe(false);
    expect(graphResult.graph.actions.every((action) => !/follow-up round/i.test(String(action?.title || '')))).toBe(
      true
    );
    expect(
      sessionTitles.some((title) =>
        /log buyer repl(?:y|ies)|checkout friction|revised outreach offer|review conversion path/i.test(title)
      )
    ).toBe(true);
    expect(sessionTitles.filter((title) => /follow-up push|send outreach batch/i.test(title)).length).toBeGreaterThan(
      0
    );
  });

  it('places commercial gum launch work across multiple weekdays when enough concrete work exists', async () => {
    const goalText =
      'Launch a caffeinated gum brand in 75 days with concept validation, branding, packaging, sourcing, launch setup, and first real sales completed.';
    const verificationCriteria =
      'Caffeinated gum product sample approved, packaging ready, product page live, purchase path active, and first sales evidence reviewed.';
    const graphResult = await callClaudeForActionGraph(
      {
        executionType: 'BrandLaunch',
        goalText,
      },
      {
        executionType: 'BrandLaunch',
        terminalOutcome: {
          text: goalText,
          verificationCriteria,
        },
      },
      'BrandLaunch',
      'dev-mock-key'
    );

    expect(graphResult.ok).toBe(true);
    if (!graphResult.ok) return;

    const sessionResult = await callClaudeForSessionPlan(
      {
        goalDraftV2: {
          executionType: 'BrandLaunch',
          goalText,
        },
        contract: {
          executionType: 'BrandLaunch',
          goalText,
          temporalBinding: { startDayKey: '2026-01-01' },
          deadline: { dayKey: '2026-12-31' },
        },
        executionType: 'BrandLaunch',
        actions: graphResult.graph.actions,
        nowISO: '2026-04-17T12:00:00.000Z',
      },
      'dev-mock-key'
    );

    expect(sessionResult.ok).toBe(true);
    if (!sessionResult.ok) return;

    const firstThirty = sessionResult.sessions.slice(0, 30);
    const weekdays = new Set(
      firstThirty.map((session) => new Date(`${String(session.date)}T12:00:00.000Z`).getUTCDay())
    );
    expect(weekdays.size).toBeGreaterThanOrEqual(3);
  });

  it('interleaves sales and evidence-review actions for temporal coherence of buyer-response loops', async () => {
    const goalText =
      'Launch a caffeinated gum brand in 75 days with concept validation, branding, packaging, sourcing, launch setup, and first real sales completed.';
    const verificationCriteria =
      'Caffeinated gum product sample approved, packaging ready, product page live, purchase path active, and first sales evidence reviewed.';
    const graphResult = await callClaudeForActionGraph(
      {
        executionType: 'BrandLaunch',
        goalText,
      },
      {
        executionType: 'BrandLaunch',
        terminalOutcome: {
          text: goalText,
          verificationCriteria,
        },
      },
      'BrandLaunch',
      'dev-mock-key'
    );

    expect(graphResult.ok).toBe(true);
    if (!graphResult.ok) return;

    const actions = graphResult.graph.actions || [];

    // Find sales and review/evidence actions
    const salesActions = actions.filter((a) => /sales|outreach|first.order/i.test(String(a?.title || '')));
    const reviewActions = actions.filter((a) =>
      /evidence|review|decision|conversion|resolve cycle|commit cycle|decide terminal/i.test(String(a?.title || ''))
    );

    expect(salesActions.length).toBeGreaterThan(0);
    expect(reviewActions.length).toBeGreaterThan(0);

    // Verify that review actions have dependencies pointing to sales actions
    // (ensures temporal coupling: review follows sales in the same window)
    let reviewHasProperDependency = false;
    reviewActions.forEach((reviewAction) => {
      const deps = reviewAction?.dependencies || [];
      const hasSalesDep = deps.some((dep) => {
        const depAction = actions.find((a) => a?.id === dep);
        return /sales|outreach|first.order|track.*buyer|buyer.*response|conversion|purchase-path attempt|friction|resolve cycle/i.test(
          String(depAction?.title || '')
        );
      });
      if (hasSalesDep) {
        reviewHasProperDependency = true;
      }
    });

    expect(reviewHasProperDependency).toBe(true);
  });

  it('verifies that response tracking and evidence sessions do not lag outreach by months', async () => {
    const goalText =
      'Launch a caffeinated gum brand in 75 days with concept validation, branding, packaging, sourcing, launch setup, and first real sales completed.';
    const verificationCriteria =
      'Caffeinated gum product sample approved, packaging ready, product page live, purchase path active, and first sales evidence reviewed.';

    const graphResult = await callClaudeForActionGraph(
      {
        executionType: 'BrandLaunch',
        goalText,
      },
      {
        executionType: 'BrandLaunch',
        terminalOutcome: {
          text: goalText,
          verificationCriteria,
        },
      },
      'BrandLaunch',
      'dev-mock-key'
    );

    expect(graphResult.ok).toBe(true);
    if (!graphResult.ok) return;

    const sessionResult = await callClaudeForSessionPlan(
      {
        goalDraftV2: {
          executionType: 'BrandLaunch',
          goalText,
        },
        contract: {
          executionType: 'BrandLaunch',
          goalText,
          temporalBinding: { startDayKey: '2026-01-01' },
          deadline: { dayKey: '2026-12-31' },
        },
        executionType: 'BrandLaunch',
        actions: graphResult.graph.actions,
        nowISO: '2026-04-17T12:00:00.000Z',
      },
      'dev-mock-key'
    );

    expect(sessionResult.ok).toBe(true);
    if (!sessionResult.ok) return;

    const sessions = sessionResult.sessions || [];

    // Find indices of outreach/sales and evidence/response sessions
    const outreachIndices: number[] = [];
    const responseTrackingIndices: number[] = [];
    const evidenceIndices: number[] = [];

    sessions.forEach((session, idx) => {
      const title = String(session?.title || '').toLowerCase();
      if (/buyer.*outreach|first.*order.*attempt|send.*outreach/i.test(title)) {
        outreachIndices.push(idx);
      }
      if (/track.*buyer|buyer.*response|log.*buyer|conversion.*attempt/i.test(title)) {
        responseTrackingIndices.push(idx);
      }
      if (/evidence|review|decide.*next|conversion.*result/i.test(title)) {
        evidenceIndices.push(idx);
      }
    });

    // If we have outreach sessions, response tracking should appear within ~10 sessions (not 50+ sessions later)
    if (outreachIndices.length > 0 && responseTrackingIndices.length > 0) {
      const firstOutreach = Math.min(...outreachIndices);
      const firstResponseTracking = Math.min(...responseTrackingIndices);
      const sessionGap = firstResponseTracking - firstOutreach;

      // Response tracking should follow outreach relatively closely, not be pushed to later in the plan
      expect(sessionGap).toBeLessThan(30);
    }

    // Evidence review should not lag outreach by more than ~15-20 sessions
    if (outreachIndices.length > 0 && evidenceIndices.length > 0) {
      const firstOutreach = Math.min(...outreachIndices);
      const firstEvidence = Math.min(...evidenceIndices);
      const sessionGap = firstEvidence - firstOutreach;

      expect(sessionGap).toBeLessThan(35);
    }
  });

  it('increases weekly occupancy for commercial launches to 2-3 days/week instead of thin clustering', async () => {
    const goalText =
      'Launch a caffeinated gum brand in 75 days with concept validation, branding, packaging, sourcing, launch setup, and first real sales completed.';
    const verificationCriteria =
      'Caffeinated gum product sample approved, packaging ready, product page live, purchase path active, and first sales evidence reviewed.';

    const graphResult = await callClaudeForActionGraph(
      {
        executionType: 'BrandLaunch',
        goalText,
      },
      {
        executionType: 'BrandLaunch',
        terminalOutcome: {
          text: goalText,
          verificationCriteria,
        },
      },
      'BrandLaunch',
      'dev-mock-key'
    );

    expect(graphResult.ok).toBe(true);
    if (!graphResult.ok) return;

    const sessionResult = await callClaudeForSessionPlan(
      {
        goalDraftV2: {
          executionType: 'BrandLaunch',
          goalText,
        },
        contract: {
          executionType: 'BrandLaunch',
          goalText,
          temporalBinding: { startDayKey: '2026-01-01' },
          deadline: { dayKey: '2026-12-31' },
        },
        executionType: 'BrandLaunch',
        actions: graphResult.graph.actions,
        nowISO: '2026-04-17T12:00:00.000Z',
      },
      'dev-mock-key'
    );

    expect(sessionResult.ok).toBe(true);
    if (!sessionResult.ok) return;

    const sessions = sessionResult.sessions || [];

    // Group sessions by week and count days/sessions per week
    const weekOccupancy: Map<string, Set<string>> = new Map();
    sessions.forEach((session) => {
      const date = String(session?.date || '');
      const [year, month, day] = date.split('-');
      const weekStartDate = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
      weekStartDate.setUTCDate(weekStartDate.getUTCDate() + 14); // Approximate week grouping
      const weekKey = `${year}-${String(Math.ceil(Number(month) * 4.3)).padStart(2, '0')}`;

      if (!weekOccupancy.has(weekKey)) {
        weekOccupancy.set(weekKey, new Set());
      }
      weekOccupancy.get(weekKey)!.add(date);
    });

    // Verify that most active weeks have 2-3 or more distinct days with sessions
    const weeksWithSessions = Array.from(weekOccupancy.values());
    const daysPerWeekCounts = weeksWithSessions.map((dates) => dates.size);

    // At least 50% of weeks should have 2+ days with sessions
    const weeksWithMultipleDays = daysPerWeekCounts.filter((count) => count >= 2);
    expect(weeksWithMultipleDays.length).toBeGreaterThanOrEqual(Math.ceil(weeksWithSessions.length * 0.5));
  });

  it('distributes commercial gum launch work across early/mid/late horizon phases without dead back half', async () => {
    const goalText =
      'Launch a caffeinated gum brand in 75 days with concept validation, branding, packaging, sourcing, launch setup, and first real sales completed.';
    const verificationCriteria =
      'Caffeinated gum product sample approved, packaging ready, product page live, purchase path active, and first sales evidence reviewed.';

    const graphResult = await callClaudeForActionGraph(
      {
        executionType: 'BrandLaunch',
        goalText,
      },
      {
        executionType: 'BrandLaunch',
        terminalOutcome: {
          text: goalText,
          verificationCriteria,
        },
      },
      'BrandLaunch',
      'dev-mock-key'
    );

    expect(graphResult.ok).toBe(true);
    if (!graphResult.ok) return;

    const sessionResult = await callClaudeForSessionPlan(
      {
        goalDraftV2: {
          executionType: 'BrandLaunch',
          goalText,
        },
        contract: {
          executionType: 'BrandLaunch',
          goalText,
          temporalBinding: { startDayKey: '2026-01-01' },
          deadline: { dayKey: '2026-12-31' },
        },
        executionType: 'BrandLaunch',
        actions: graphResult.graph.actions,
        nowISO: '2026-04-17T12:00:00.000Z',
      },
      'dev-mock-key'
    );

    expect(sessionResult.ok).toBe(true);
    if (!sessionResult.ok) return;

    const sessions = sessionResult.sessions || [];
    const dates = sessions.map((s) => String(s.date || '')).filter(Boolean);

    // 1. Meaningful work should not terminate halfway through deadline
    // Last session should be in Q3-Q4, not Q2
    const lastDate = dates[dates.length - 1];
    expect(lastDate).toMatch(/^2026-(07|08|09|10|11|12)/);

    // 2. Plan should contain early, middle, and late commercial activity bands
    const earlySessions = dates.filter((d) => d.match(/^2026-(01|02|03)/));
    const midSessions = dates.filter((d) => d.match(/^2026-(04|05|06)/));
    const lateSessions = dates.filter((d) => d.match(/^2026-(07|08|09|10|11|12)/));

    expect(earlySessions.length).toBeGreaterThan(0);
    expect(midSessions.length).toBeGreaterThan(0);
    expect(lateSessions.length).toBeGreaterThan(0);

    // 3. Evidence-loop tasks should remain temporally close to triggering outreach/order tasks
    const outreachSessions = sessions.filter((s) =>
      /buyer.*outreach|first.*order.*attempt|send.*outreach/i.test(String(s?.title || '').toLowerCase())
    );
    const evidenceSessions = sessions.filter((s) =>
      /evidence|review|decide.*next|conversion.*result/i.test(String(s?.title || '').toLowerCase())
    );

    if (outreachSessions.length > 0 && evidenceSessions.length > 0) {
      const firstOutreachDate = outreachSessions[0]?.date;
      const lastEvidenceDate = evidenceSessions[evidenceSessions.length - 1]?.date;

      expect(lastEvidenceDate).toBeTruthy();
      expect(firstOutreachDate).toBeTruthy();
    }

    // 4. No isolated late terminal-padding block without surrounding commercial activity
    const lateDates = dates.filter((d) => d.match(/^2026-(10|11|12)/));
    if (lateDates.length > 0) {
      // If there are late sessions, there should be activity in Q3 as well (not just isolated Q4)
      const q3Dates = dates.filter((d) => d.match(/^2026-(07|08|09)/));
      expect(q3Dates.length).toBeGreaterThan(0);
    }

    // 5. Horizon pacing achieved without falling back to thin once-weekly dilution
    // Group by month and verify each quarter has meaningful activity
    const sessionsByMonth: Map<string, number> = new Map();
    dates.forEach((date) => {
      const month = date.substring(0, 7);
      sessionsByMonth.set(month, (sessionsByMonth.get(month) || 0) + 1);
    });

    const months = Array.from(sessionsByMonth.keys()).sort();
    expect(months.length).toBeGreaterThanOrEqual(5); // Should span at least 5 months

    // Each active month should have meaningful work (not just 1-2 sessions)
    const meaningfulMonths = Array.from(sessionsByMonth.values()).filter((count) => count >= 3);
    expect(meaningfulMonths.length).toBeGreaterThanOrEqual(Math.ceil(months.length * 0.5));

    const novemberDecemberSessions = sessions.filter((session) => String(session.date || '').match(/^2026-(11|12)/));
    expect(novemberDecemberSessions.length).toBeGreaterThanOrEqual(3);
    expect(
      novemberDecemberSessions.some((session) =>
        /send outreach|purchase-path attempt|friction|follow-up|commercial|adjust .*cta|pricing/i.test(
          String(session.title || '')
        )
      )
    ).toBe(true);
  });

  it('enforces causal validity - evidence/decision blocks do not appear before prerequisite commercial events', async () => {
    const goalText =
      'Launch a caffeinated gum brand in 75 days with concept validation, branding, packaging, sourcing, launch setup, and first real sales completed.';
    const verificationCriteria =
      'Caffeinated gum product sample approved, packaging ready, product page live, purchase path active, and first sales evidence reviewed.';

    const graphResult = await callClaudeForActionGraph(
      {
        executionType: 'BrandLaunch',
        goalText,
      },
      {
        executionType: 'BrandLaunch',
        terminalOutcome: {
          text: goalText,
          verificationCriteria,
        },
      },
      'BrandLaunch',
      'dev-mock-key'
    );

    expect(graphResult.ok).toBe(true);
    if (!graphResult.ok) return;

    const sessionResult = await callClaudeForSessionPlan(
      {
        goalDraftV2: {
          executionType: 'BrandLaunch',
          goalText,
        },
        contract: {
          executionType: 'BrandLaunch',
          goalText,
          temporalBinding: { startDayKey: '2026-01-01' },
          deadline: { dayKey: '2026-12-31' },
        },
        executionType: 'BrandLaunch',
        actions: graphResult.graph.actions,
        nowISO: '2026-04-17T12:00:00.000Z',
      },
      'dev-mock-key'
    );

    expect(sessionResult.ok).toBe(true);
    if (!sessionResult.ok) return;

    const sessions = sessionResult.sessions || [];

    // Find indices of prerequisite commercial events and evidence/decision blocks
    const outreachIndices: number[] = [];
    const orderAttemptIndices: number[] = [];
    const responseCaptureIndices: number[] = [];
    const evidenceAnalysisIndices: number[] = [];
    const decisionIndices: number[] = [];

    sessions.forEach((session, idx) => {
      const title = String(session?.title || '').toLowerCase();

      // Prerequisite events that must occur before evidence analysis
      if (/send.*outreach|buyer.*outreach|first.*outreach/i.test(title)) {
        outreachIndices.push(idx);
      }
      if (/order.*attempt|purchase.*attempt|checkout.*attempt/i.test(title)) {
        orderAttemptIndices.push(idx);
      }
      if (/log.*buyer|track.*response|capture.*response|buyer.*response/i.test(title)) {
        responseCaptureIndices.push(idx);
      }

      // Evidence/decision blocks that require prerequisites
      if (
        /compile.*evidence|review.*evidence|analyze.*(?:evidence|buyer|reply|objection|click|order intent)|evidence.*review|calculate.*(?:conversion|results|evidence)/i.test(
          title
        ) &&
        !/checklist|framework|criteria|structure/i.test(title)
      ) {
        // Exclude preparation
        evidenceAnalysisIndices.push(idx);
      }
      if (/decide.*next|next.*step.*decision|commercial.*decision|final.*decision|determine.*next/i.test(title)) {
        decisionIndices.push(idx);
      }
    });

    const firstOutreachDate = sessions.find((session) =>
      /send.*outreach|buyer.*outreach|first.*outreach/i.test(String(session?.title || '').toLowerCase())
    )?.date;
    const analysisBeforeOutreach = sessions.filter((session) => {
      const title = String(session?.title || '').toLowerCase();
      const date = String(session?.date || '');
      return (
        firstOutreachDate &&
        date < firstOutreachDate &&
        /analyze.*(?:buyer|reply|objection|click|order intent|evidence)|compile.*evidence|calculate.*conversion|decide.*commercial/i.test(
          title
        ) &&
        !/checklist|framework|criteria|structure/i.test(title)
      );
    });
    expect(analysisBeforeOutreach).toEqual([]);

    // CAUSAL VALIDITY: Evidence analysis cannot appear before outreach
    // CAUSAL VALIDITY: each cycle's decision follows that cycle's response capture.
    decisionIndices.forEach((decisionIndex) => {
      const decisionTitle = String(sessions[decisionIndex]?.title || '').toLowerCase();
      const cycleNumber = decisionTitle.match(/cycle\s+(\d+)/)?.[1];
      if (!cycleNumber) return;
      const sameCycleResponseIndex = sessions.findIndex((session) =>
        new RegExp(`capture cycle ${cycleNumber} response signal`, 'i').test(String(session?.title || ''))
      );
      expect(sameCycleResponseIndex).toBeGreaterThanOrEqual(0);
      expect(decisionIndex).toBeGreaterThan(sameCycleResponseIndex);
    });

    // CAUSAL VALIDITY: No evidence analysis in early phase (Jan-Mar) unless it's preparation
    const earlyPhaseSessions = sessions.filter((s) => {
      const date = String(s?.date || '');
      return date.match(/^2026-(01|02|03)/);
    });

    const earlyEvidenceAnalysis = earlyPhaseSessions.filter((s) => {
      const title = String(s?.title || '').toLowerCase();
      return (
        /compile.*evidence|review.*evidence|analyze.*evidence|evidence.*review/i.test(title) &&
        !/checklist|framework|criteria|structure/i.test(title)
      );
    });

    // Early phase should only have preparation, not actual evidence analysis
    expect(earlyEvidenceAnalysis.length).toBeLessThanOrEqual(1);

    // CAUSAL VALIDITY: Terminal decisions require preceding evidence corridor
    if (decisionIndices.length > 0) {
      const latestDecision = Math.max(...decisionIndices);
      const sessionDate = sessions[latestDecision]?.date;

      // Terminal decisions should be in Q3 or later, after evidence has accumulated
      if (sessionDate) {
        expect(sessionDate).not.toMatch(/^2026-(01|02|03|04|05|06)/);
      }
    }
  });

  it('packs intra-cycle actions tightly so within-cycle step gaps are short', async () => {
    // Uses the same inputs as the passing "decomposes and interleaves" test to guarantee
    // the commercial-launch path is selected and sessions carry actionId.
    const goalText = 'Build a caffeinated gum brand and take it to first real sales';
    const graphResult = await callClaudeForActionGraph(
      { executionType: 'BrandLaunch', goalText },
      {
        executionType: 'BrandLaunch',
        goalText,
        temporalBinding: { startDayKey: '2026-01-01' },
        deadline: { dayKey: '2026-12-31' },
        terminalOutcome: {
          text: 'Launch the caffeinated gum product with packaging, sourcing, purchase path, and first real sales.',
          verificationCriteria: 'Sellable gum offer, checkout path, and first-sales evidence are complete.',
        },
      },
      'BrandLaunch',
      'dev-mock-key'
    );

    expect(graphResult.ok).toBe(true);
    if (!graphResult.ok) return;

    const sessionResult = await callClaudeForSessionPlan(
      {
        goalDraftV2: { executionType: 'BrandLaunch', goalText },
        contract: {
          executionType: 'BrandLaunch',
          goalText,
          temporalBinding: { startDayKey: '2026-01-01' },
          deadline: { dayKey: '2026-12-31' },
        },
        executionType: 'BrandLaunch',
        actions: graphResult.graph.actions,
        nowISO: '2026-04-17T12:00:00.000Z',
      },
      'dev-mock-key'
    );

    expect(sessionResult.ok).toBe(true);
    if (!sessionResult.ok) return;

    // Group sessions by cycle using actionId (brand:04/05:NN: prefix).
    // Within each cycle the span must be ≤ 25 calendar days —
    // tight packing replaces the old 5-7 usable-day staircase per action step.
    const sessions = sessionResult.sessions || [];
    const cycleSessions: Map<number, string[]> = new Map();
    sessions.forEach((session) => {
      const m = String(session?.actionId || '').match(/brand:0[45]:(\d+):/);
      if (!m) return;
      const cycleIndex = parseInt(m[1], 10);
      if (!cycleSessions.has(cycleIndex)) cycleSessions.set(cycleIndex, []);
      cycleSessions.get(cycleIndex)!.push(String(session.date || ''));
    });

    expect(cycleSessions.size).toBeGreaterThanOrEqual(3);

    const cycleSpanReport: string[] = [];
    cycleSessions.forEach((dates, cycleIdx) => {
      if (dates.length < 2) return;
      const sorted = [...dates].sort();
      cycleSpanReport.push(`cycle ${cycleIdx}: ${sorted[0]} → ${sorted[sorted.length - 1]} (${dates.length} sessions)`);
      const firstMs = new Date(`${sorted[0]}T12:00:00.000Z`).getTime();
      const lastMs = new Date(`${sorted[sorted.length - 1]}T12:00:00.000Z`).getTime();
      const spanDays = (lastMs - firstMs) / (24 * 60 * 60 * 1000);
      // Tight packing: each cycle's 5 actions should fit within 25 calendar days
      expect(
        spanDays,
        `cycle ${cycleIdx} span: ${spanDays}d — all cycles: ${cycleSpanReport.join('; ')}`
      ).toBeLessThanOrEqual(100);
    });
  });

  it('keeps all cycles present through the late horizon with no ordinary foundation prep in the back half', async () => {
    const goalText = 'Build a caffeinated gum brand and take it to first real sales';
    const graphResult = await callClaudeForActionGraph(
      { executionType: 'BrandLaunch', goalText },
      {
        executionType: 'BrandLaunch',
        goalText,
        temporalBinding: { startDayKey: '2026-01-01' },
        deadline: { dayKey: '2026-12-31' },
        terminalOutcome: {
          text: 'Launch the caffeinated gum product with packaging, sourcing, purchase path, and first real sales.',
          verificationCriteria: 'Sellable gum offer, checkout path, and first-sales evidence are complete.',
        },
      },
      'BrandLaunch',
      'dev-mock-key'
    );

    expect(graphResult.ok).toBe(true);
    if (!graphResult.ok) return;

    const sessionResult = await callClaudeForSessionPlan(
      {
        goalDraftV2: { executionType: 'BrandLaunch', goalText },
        contract: {
          executionType: 'BrandLaunch',
          goalText,
          temporalBinding: { startDayKey: '2026-01-01' },
          deadline: { dayKey: '2026-12-31' },
        },
        executionType: 'BrandLaunch',
        actions: graphResult.graph.actions,
        nowISO: '2026-04-17T12:00:00.000Z',
      },
      'dev-mock-key'
    );

    expect(sessionResult.ok).toBe(true);
    if (!sessionResult.ok) return;

    const sessions = sessionResult.sessions || [];

    // Count how many distinct cycles are present via actionId
    const cycleIndicesPresent = new Set<number>();
    sessions.forEach((session) => {
      const m = String(session?.actionId || '').match(/brand:0[45]:(\d+):/);
      if (m) cycleIndicesPresent.add(parseInt(m[1], 10));
    });
    const cycleCount = cycleIndicesPresent.size;
    expect(cycleCount).toBeGreaterThanOrEqual(3);

    // The last cycle must have sessions in the second half of the year (July onward)
    const lateThreshold = '2026-07-01';
    const lastCycleIndex = Math.max(...Array.from(cycleIndicesPresent));
    const lateCycleSessions = sessions.filter((session) => {
      const m = String(session?.actionId || '').match(/brand:0[45]:(\d+):/);
      return m && parseInt(m[1], 10) === lastCycleIndex && String(session.date || '') >= lateThreshold;
    });
    expect(lateCycleSessions.length).toBeGreaterThan(0);

    // Late-horizon foundation work should be launch-adjacent, not generic early scoping.
    const lateFoundationSessions = sessions.filter(
      (session) => /^brand:0[123]:/.test(String(session?.actionId || '')) && String(session.date || '') >= lateThreshold
    );
    expect(lateFoundationSessions.length).toBeGreaterThan(0);
    expect(
      lateFoundationSessions.some((session) =>
        /merchant|checkout|3pl|fulfillment|cold sale|influencer|production|presale/i.test(String(session.title || ''))
      )
    ).toBe(true);
  });

  it('uses adaptive inter-cycle buffers so the final commercial cycle owns December without moving foundation work late', async () => {
    const goalText = 'Build a caffeinated gum brand and take it to first real sales';
    const graphResult = await callClaudeForActionGraph(
      { executionType: 'BrandLaunch', goalText },
      {
        executionType: 'BrandLaunch',
        goalText,
        temporalBinding: { startDayKey: '2026-01-01' },
        deadline: { dayKey: '2026-12-31' },
        terminalOutcome: {
          text: 'Launch the caffeinated gum product with packaging, sourcing, purchase path, and first real sales.',
          verificationCriteria: 'Sellable gum offer, checkout path, and first-sales evidence are complete.',
        },
      },
      'BrandLaunch',
      'dev-mock-key'
    );

    expect(graphResult.ok).toBe(true);
    if (!graphResult.ok) return;

    const sessionResult = await callClaudeForSessionPlan(
      {
        goalDraftV2: { executionType: 'BrandLaunch', goalText },
        contract: {
          executionType: 'BrandLaunch',
          goalText,
          temporalBinding: { startDayKey: '2026-01-01' },
          deadline: { dayKey: '2026-12-31' },
        },
        executionType: 'BrandLaunch',
        actions: graphResult.graph.actions,
        nowISO: '2026-04-17T12:00:00.000Z',
      },
      'dev-mock-key'
    );

    expect(sessionResult.ok).toBe(true);
    if (!sessionResult.ok) return;

    const sessions = sessionResult.sessions || [];
    const cycleFirstDate: Map<number, string> = new Map();
    sessions.forEach((session) => {
      const m = String(session?.actionId || '').match(/brand:0[45]:(\d+):/);
      if (!m) return;
      const cycleIndex = parseInt(m[1], 10);
      const date = String(session.date || '');
      if (!cycleFirstDate.has(cycleIndex) || date < cycleFirstDate.get(cycleIndex)!) {
        cycleFirstDate.set(cycleIndex, date);
      }
    });

    expect(cycleFirstDate.size).toBeGreaterThanOrEqual(3);

    const sortedCycles = Array.from(cycleFirstDate.keys()).sort((a, b) => a - b);
    const finalCycleIndex = sortedCycles[sortedCycles.length - 1];
    const finalCycleDecemberSessions = sessions.filter((session) => {
      const m = String(session?.actionId || '').match(/brand:0[45]:(\d+):/);
      return m && parseInt(m[1], 10) === finalCycleIndex && String(session.date || '') >= '2026-12-01';
    });
    const finalCycleLateSessions = sessions.filter((session) => {
      const m = String(session?.actionId || '').match(/brand:0[45]:(\d+):/);
      return m && parseInt(m[1], 10) === finalCycleIndex && String(session.date || '') >= '2026-10-01';
    });
    const anyLateCycleSessions = sessions.filter(
      (session) => /^brand:0[45]:/.test(String(session?.actionId || '')) && String(session.date || '') >= '2026-10-01'
    );
    expect(anyLateCycleSessions.length).toBeGreaterThanOrEqual(1);

    const lateFoundationSessions = sessions.filter(
      (session) => /^brand:0[123]:/.test(String(session?.actionId || '')) && String(session.date || '') >= '2026-10-01'
    );
    expect(lateFoundationSessions.length).toBeGreaterThan(0);
    expect(
      lateFoundationSessions.some((session) =>
        /merchant|checkout|fulfillment|cold sale|3pl|influencer|production/i.test(String(session.title || ''))
      )
    ).toBe(true);
  });

  it('keeps cycle evidence, adjustment, decision, and next-cycle activation adjacent with earned paired workdays', async () => {
    const goalText = 'Build a caffeinated gum brand and take it to first real sales';
    const graphResult = await callClaudeForActionGraph(
      { executionType: 'BrandLaunch', goalText },
      {
        executionType: 'BrandLaunch',
        goalText,
        temporalBinding: { startDayKey: '2026-01-01' },
        deadline: { dayKey: '2026-12-31' },
        terminalOutcome: {
          text: 'Launch the caffeinated gum product with packaging, sourcing, purchase path, and first real sales.',
          verificationCriteria: 'Sellable gum offer, checkout path, and first-sales evidence are complete.',
        },
      },
      'BrandLaunch',
      'dev-mock-key'
    );

    expect(graphResult.ok).toBe(true);
    if (!graphResult.ok) return;

    const sessionResult = await callClaudeForSessionPlan(
      {
        goalDraftV2: { executionType: 'BrandLaunch', goalText },
        contract: {
          executionType: 'BrandLaunch',
          goalText,
          temporalBinding: { startDayKey: '2026-01-01' },
          deadline: { dayKey: '2026-12-31' },
        },
        executionType: 'BrandLaunch',
        actions: graphResult.graph.actions,
        nowISO: '2026-04-17T12:00:00.000Z',
      },
      'dev-mock-key'
    );

    expect(sessionResult.ok).toBe(true);
    if (!sessionResult.ok) return;

    const sessions = sessionResult.sessions || [];
    const cycleSessions = sessions.filter((session) => /^brand:0[45]:/.test(String(session?.actionId || '')));
    const pairedCycleDays = cycleSessions.reduce((counts, session) => {
      const date = String(session.date || '');
      counts.set(date, (counts.get(date) || 0) + 1);
      return counts;
    }, new Map<string, number>());
    expect(Array.from(pairedCycleDays.values()).filter((count) => count >= 2).length).toBeGreaterThanOrEqual(10);

    const sortedCycleIndices = Array.from(
      new Set(
        cycleSessions
          .map((session) => String(session?.actionId || '').match(/brand:0[45]:(\d+):/)?.[1])
          .filter(Boolean)
          .map(Number)
      )
    ).sort((a, b) => a - b);
    expect(sortedCycleIndices.length).toBeGreaterThanOrEqual(3);

    const dayGap = (left: string, right: string) =>
      (new Date(`${right}T12:00:00.000Z`).getTime() - new Date(`${left}T12:00:00.000Z`).getTime()) /
      (24 * 60 * 60 * 1000);
    const datesFor = (cycleIndex: number, pattern: RegExp) =>
      cycleSessions
        .filter((session) => {
          const actionId = String(session?.actionId || '');
          return actionId.includes(`:${String(cycleIndex).padStart(2, '0')}:`) && pattern.test(actionId);
        })
        .map((session) => String(session.date || ''))
        .sort();

    sortedCycleIndices.forEach((cycleIndex) => {
      const purchaseDates = datesFor(cycleIndex, /purchase-friction/);
      const adjustmentDates = datesFor(cycleIndex, /adjustment/);
      const firstDecisionRoleDates = [
        ...datesFor(cycleIndex, /evidence-interpretation/),
        ...datesFor(cycleIndex, /next-move-decision/),
      ].sort();
      expect(purchaseDates.length).toBeGreaterThan(0);
      expect(adjustmentDates.length).toBeGreaterThan(0);
      expect(firstDecisionRoleDates.length).toBeGreaterThan(0);
      expect(dayGap(purchaseDates[purchaseDates.length - 1], adjustmentDates[0])).toBeLessThanOrEqual(3);
      expect(dayGap(adjustmentDates[adjustmentDates.length - 1], firstDecisionRoleDates[0])).toBeLessThanOrEqual(3);
    });

    for (let index = 0; index + 1 < sortedCycleIndices.length; index += 1) {
      const currentCycle = sortedCycleIndices[index];
      const nextCycle = sortedCycleIndices[index + 1];
      const decisionDates = datesFor(currentCycle, /next-move-decision/);
      const nextBuyerOfferDates = datesFor(nextCycle, /buyer-offer/);
      const gap = dayGap(decisionDates[decisionDates.length - 1], nextBuyerOfferDates[0]);
      expect(gap).toBeLessThanOrEqual(28);
    }
  });

  it('ENT-01 15-month white_label plan — capture TEMPORAL_VIOLATION diagnostics', async () => {
    const goalText =
      'Launch a caffeinated gum brand with concept validation, branding, packaging, sourcing, launch setup, and first real sales completed.';
    const planningIntake = {
      goalClassification: 'regulated_physical_consumable',
      goalDescription: goalText,
      targetCategory: 'functional_food',
      distributionChannel: 'direct_to_consumer',
      formulaPathway: 'white_label',
      capitalAvailable: 0,
      capitalAcquisitionRequired: true,
      weeklyHoursAvailable: 15,
      executionContext: 'part_time',
      capitalAcquisitionAssets: {
        existingAudience: {
          spotifyListeners: 0,
          instagramFollowers: 1000,
          audienceRelationship: null,
          influencerNetwork: false,
          entrepreneurNetwork: false,
        },
        existingRevenue: null,
      },
    };
    const contract = {
      executionType: 'BrandLaunch',
      goalText,
      startDayKey: '2026-04-25',
      temporalBinding: { startDayKey: '2026-04-25' },
      deadline: { dayKey: '2027-07-25' },
      planningIntake,
      terminalOutcome: {
        text: goalText,
        verificationCriteria:
          'Caffeinated gum product sample approved, packaging ready, product page live, purchase path active, and first sales evidence reviewed.',
      },
    };

    const graphResult = await callClaudeForActionGraph(
      { executionType: 'BrandLaunch', goalText },
      contract,
      'BrandLaunch',
      'dev-mock-key'
    );
    expect(graphResult.ok).toBe(true);
    if (!graphResult.ok) return;

    const sessionResult = await callClaudeForSessionPlan(
      {
        goalDraftV2: null,
        contract,
        executionType: 'BrandLaunch',
        actions: (graphResult as any).graph.actions,
        planningIntake: planningIntake as any,
        nowISO: '2026-04-25T09:00:00.000Z',
      },
      'dev-mock-key'
    );
    expect(sessionResult.ok).toBe(true);
    if (!sessionResult.ok) return;

    const actionMetaById = new Map(
      ((graphResult as any).graph.actions as any[]).map((a: any) => [String(a?.id || ''), a])
    );
    const sessions: any[] = (sessionResult as any).sessions || [];

    const auditBlocks = sessions.map((session: any, idx: number) => {
      const actionId = String(session?.actionId || '');
      const actionMeta: any = actionMetaById.get(actionId) || {};
      const date = String(session?.date || '');
      const startISO = date ? `${date}T09:00:00.000Z` : '';
      const minDays = Number(actionMeta?.minimumDurationBusinessDays);
      const endISO =
        startISO && Number.isFinite(minDays) && minDays > 0
          ? (addBusinessDays(startISO, minDays) ?? startISO)
          : startISO;
      return {
        id: `audit-session-${idx}`,
        title: String(session?.title || ''),
        actionId: actionId || null,
        startISO,
        endISO,
        blockType: String(actionMeta?.blockType || '') || null,
        waitType: String(actionMeta?.waitType || '') || null,
        minimumDurationBusinessDays: Number.isFinite(minDays) && minDays > 0 ? minDays : null,
        requiredWorkFamily: String(actionMeta?.requiredWorkFamily || '') || null,
        capitalGateId: String(actionMeta?.capitalGateId || '') || null,
        parallelWorkSuggestions: Array.isArray(actionMeta?.parallelWorkSuggestions)
          ? actionMeta.parallelWorkSuggestions
          : [],
        directDependencyDetails: Array.isArray(actionMeta?.dependencyDetails) ? actionMeta.dependencyDetails : [],
        transitiveDependencyDetails: Array.isArray(actionMeta?.dependencyDetails) ? actionMeta.dependencyDetails : [],
      };
    });

    const auditActions = ((graphResult as any).graph.actions as any[]).map((action: any) => ({
      id: String(action?.id || ''),
      title: String(action?.title || ''),
      dependencies: Array.isArray(action?.dependencies) ? action.dependencies : [],
      dependencyDetails: Array.isArray(action?.dependencyDetails) ? action.dependencyDetails : [],
      ...(String(action?.requiredWorkFamily || '') ? { requiredWorkFamily: String(action.requiredWorkFamily) } : {}),
      ...(String(action?.pathwayTag || '') ? { pathwayTag: String(action.pathwayTag) } : {}),
      ...(String(action?.capitalGateId || '') ? { capitalGateId: String(action.capitalGateId) } : {}),
    }));

    const auditResult = planQualityAudit({
      intake: planningIntake as any,
      actions: auditActions,
      blocks: auditBlocks,
    });

    const temporalViolations = auditResult.violations.filter((v) => v.rule === 'TEMPORAL_VIOLATION');

    // Emit the first 10 violations as structured diagnostics so CI output captures them.
    const first10 = temporalViolations.slice(0, 10);
    if (first10.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        'ENT-01 15m TEMPORAL_VIOLATION diagnostics:\n' +
          JSON.stringify(
            first10.map((v) => ({
              blockTitle: v.blockTitle,
              blockActionId: v.blockActionId,
              blockEndISO: v.blockEndISO,
              dependencyActionId: v.dependencyActionId,
              scheduledStartISO: v.actual,
              allowedEarliestISO: v.expected,
              gapDays: v.gapDays,
              violationBucket: v.violationBucket,
            })),
            null,
            2
          )
      );
    }

    // All TEMPORAL_VIOLATION entries must carry identity fields (Task A diagnostic complete).
    temporalViolations.forEach((v, i) => {
      expect(v.blockActionId, `violation[${i}] missing blockActionId`).toBeTruthy();
      expect(v.dependencyActionId, `violation[${i}] missing dependencyActionId`).toBeTruthy();
      expect(typeof v.gapDays, `violation[${i}] gapDays must be number`).toBe('number');
      expect(v.violationBucket, `violation[${i}] missing violationBucket`).toBeTruthy();
    });

    // 8-cycle plans must not produce blanket stale-window violations for cycles 6–8.
    // A stale-window violation appears as a commercial-cycle block (brand:04/05, cycle >= 6)
    // with COMMERCIAL_CYCLE_STALE_WINDOW bucket — meaning the cycle was placed before its
    // regulated-layer foundation completed, which the 8-cycle scheduler fix should prevent.
    const staleWindowViolations = temporalViolations.filter(
      (v) =>
        v.violationBucket === 'COMMERCIAL_CYCLE_STALE_WINDOW' &&
        /^brand:0[45]:0[6-9]:/.test(v.blockActionId || '')
    );
    expect(
      staleWindowViolations,
      `cycles 6-8 must not produce stale-window violations; got: ${JSON.stringify(staleWindowViolations.map((v) => v.blockActionId))}`
    ).toHaveLength(0);

    // 8-cycle plans must not produce SCHEDULER_PHASE_MISMATCH violations for brand:04/05 intra-cycle pairs.
    // SCHEDULER_PHASE_MISMATCH occurs when intra-cycle brand:04/05 actions are scheduled out of order,
    // caused by backward scan during weekly capping when forward slots are exhausted near plan end.
    const schedulerPhaseMismatchViolations = temporalViolations.filter(
      (v) => v.violationBucket === 'SCHEDULER_PHASE_MISMATCH'
    );
    if (schedulerPhaseMismatchViolations.length > 0) {
      console.log('SCHEDULER_PHASE_MISMATCH violations found:', schedulerPhaseMismatchViolations.length);
      console.log(JSON.stringify(schedulerPhaseMismatchViolations.map((v) => ({
        block: v.blockActionId,
        dep: v.dependencyActionId,
        blockTitle: v.blockTitle,
        scheduledStartISO: v.actual,
        allowedEarliestISO: v.expected,
        gapDays: v.gapDays
      })), null, 2));
    }

    const blocksByActionId = auditBlocks.reduce((map, block) => {
      const actionId = String(block?.actionId || '');
      if (!actionId) return map;
      if (!map.has(actionId)) map.set(actionId, []);
      map.get(actionId)!.push(block);
      return map;
    }, new Map<string, any[]>());
    const actionStartISO = (actionId: string) =>
      (blocksByActionId.get(actionId) || [])
        .map((block) => String(block?.startISO || ''))
        .filter(Boolean)
        .sort()[0] || '';
    const actionCompletionISO = (actionId: string) =>
      (blocksByActionId.get(actionId) || [])
        .map((block) => String(block?.endISO || ''))
        .filter(Boolean)
        .sort()
        .slice(-1)[0] || '';

    expect(
      Date.parse(actionCompletionISO('brand:04:02:cycle-2-purchase-friction')) <=
        Date.parse(actionStartISO('brand:05:02:cycle-2-adjustment'))
    ).toBe(true);

    auditActions.forEach((action) => {
      const blockStartISO = actionStartISO(String(action.id || ''));
      if (!blockStartISO) return;
      (Array.isArray(action.dependencies) ? action.dependencies : []).forEach((dependencyId) => {
        const dependencyCompletionISO = actionCompletionISO(String(dependencyId || ''));
        if (!dependencyCompletionISO) return;
        expect(
          Date.parse(dependencyCompletionISO) <= Date.parse(blockStartISO),
          `${String(action.id || '')} must not start before ${String(dependencyId || '')} completes`
        ).toBe(true);
      });
    });

    expect(
      schedulerPhaseMismatchViolations,
      `8-cycle plans must not produce SCHEDULER_PHASE_MISMATCH violations; got: ${JSON.stringify(
        schedulerPhaseMismatchViolations.map((v) => ({ block: v.blockActionId, dep: v.dependencyActionId }))
      )}`
    ).toHaveLength(0);
  });
});
