import { describe, expect, it } from 'vitest';

import { buildBlankIdentityState, DEFAULT_PROFILE_ID } from '../../src/state/identityStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { applyMasterPlanAction } from '../../src/state/masterPlanStore.js';

// Bare token titles that must never appear as executable calendar block titles.
const VAGUE_TITLE_TOKENS = ['DROP', 'LAUNCH'];

function buildTwoLaneIntakeState({ nowISO = '2026-05-04T12:00:00.000Z', todayDate = '2026-05-04' } = {}) {
  const state = buildBlankIdentityState({ timeZone: 'UTC', nowISO, todayDate });
  state.masterPlanIntake = {
    status: 'in-progress',
    phase: 4,
    step: 13,
    profileId: DEFAULT_PROFILE_ID,
    answers: {
      step_2: 'Build and coordinate Operation Endgame through a multi-lane master plan',
      step_3: { horizonEnd: '2026-11-01', months: 6, label: 'Oct 17' },
      step_5: { exists: true, urgency: 'high', notes: 'Near-term capacity and revenue clarity needed.' },
      step_6: 'Ownership and execution discipline cannot slip.',
      lane_0_description: 'Album assets exist and release prep is underway.',
      lane_0_system_assessment: {
        assessedStage: 'ready-to-launch',
        assessedConfidence: 'high',
        assessmentNotes: 'Creative lane is launch-adjacent.',
      },
      lane_0_activation: 'active',
      lane_0_clarifying_0: 'masters and artwork are in progress',
      lane_1_description: '7 months into development, core architecture working.',
      lane_1_system_assessment: {
        assessedStage: 'in-development',
        assessedConfidence: 'high',
        assessmentNotes: 'Product lane is mid-build.',
      },
      lane_1_activation: 'active',
      lane_1_clarifying_0: 'local app works but beta gate still needs definition',
    },
    extractedLanes: [
      { title: 'Album rollout', domain: 'creative', role: 'proof-artifact' },
      { title: 'App launch', domain: 'product', role: 'revenue-engine' },
    ],
    anchors: [
      {
        id: 'anchor-oct17',
        date: '2026-10-17',
        label: 'Oct 17 launch target',
        isFixed: true,
        affectedLaneIds: [],
        priority: 0,
      },
    ],
    currentLaneIdx: 0,
    clarifyingQuestionIdx: 0,
    draft: null,
    errorMessage: null,
  };
  applyMasterPlanAction(state, { type: 'MASTER_PLAN_INTAKE_COMPLETE', nowISO });
  return computeDerivedState(state, { type: 'NO_OP' });
}

function buildGeneratedPlanState(opts = {}) {
  const established = buildTwoLaneIntakeState(opts);
  const planId = established.masterPlanIntake.draft.masterPlanId;

  const started = computeDerivedState(established, {
    type: 'START_NEW_CYCLE_WITH_DECISION',
    payload: { mode: 'archive' },
  });
  const reassessed = computeDerivedState(started, {
    type: 'COMPLETE_CYCLE_REASSESSMENT',
    cycleId: started.activeCycleId,
  });
  const constrained = computeDerivedState(reassessed, {
    type: 'UPDATE_WORK_WINDOWS',
    payload: {
      cycleId: reassessed.activeCycleId,
      workWindows: {
        mon: [{ start: '09:00', end: '17:00' }],
        tue: [{ start: '09:00', end: '17:00' }],
        wed: [{ start: '09:00', end: '17:00' }],
        thu: [{ start: '09:00', end: '17:00' }],
        fri: [{ start: '09:00', end: '17:00' }],
        sat: [],
        sun: [],
      },
    },
  });
  const generated = computeDerivedState(constrained, {
    type: 'GENERATE_PLAN',
    payload: { masterPlanId: planId, source: 'MASTER_PLAN_FIRST_CYCLE' },
  });
  return { generated, planId };
}

describe('master-plan block expansion — plan depth regression suite', () => {
  it('generates a non-empty proposed schedule after completing the two-lane intake flow', () => {
    const { generated } = buildGeneratedPlanState();
    expect(generated.lastPlanError).toBeNull();
    expect(generated.proposedBlocks.length).toBeGreaterThan(0);
  });

  it('produces no bare DROP or LAUNCH tokens as executable block titles', () => {
    const { generated } = buildGeneratedPlanState();
    const vagueBlocks = generated.proposedBlocks.filter((block) =>
      VAGUE_TITLE_TOKENS.some((token) => String(block?.title || '').trim().toUpperCase() === token)
    );
    expect(vagueBlocks).toHaveLength(0);
  });

  it('includes expansion candidates (derivedFrom starting with "expanded:") for anchor milestones', () => {
    const { generated } = buildGeneratedPlanState();
    const expansionBlocks = generated.proposedBlocks.filter((block) =>
      String(block?.derivedFrom || '').startsWith('expanded:')
    );
    expect(expansionBlocks.length).toBeGreaterThan(0);
  });

  it('expansion block titles are verb+object format, not question-form or bare tokens', () => {
    const { generated } = buildGeneratedPlanState();
    const expansionBlocks = generated.proposedBlocks.filter((block) =>
      String(block?.derivedFrom || '').startsWith('expanded:')
    );
    // Every expansion block must have a non-trivial title that is not a bare vague token.
    expansionBlocks.forEach((block) => {
      const title = String(block?.title || '').trim();
      expect(title.length).toBeGreaterThan(10);
      VAGUE_TITLE_TOKENS.forEach((token) => {
        expect(title.toUpperCase()).not.toBe(token);
      });
    });
  });

  it('creative anchor generates at least 3 expansion work candidates', () => {
    const { generated } = buildGeneratedPlanState();
    // Creative anchor templates define 3 prep entries (offsetDays: -5, -2, 0).
    // The expansion titles embed the lane title ("Album rollout") from the template functions.
    const creativeExpansionBlocks = generated.proposedBlocks.filter(
      (block) =>
        String(block?.derivedFrom || '').startsWith('expanded:') &&
        String(block?.title || '').toLowerCase().includes('album rollout')
    );
    expect(creativeExpansionBlocks.length).toBeGreaterThanOrEqual(3);
  });

  it('product anchor generates at least 3 expansion work candidates', () => {
    const { generated } = buildGeneratedPlanState();
    // Product anchor templates define 3 prep entries (offsetDays: -4, -2, 0).
    // The expansion titles embed the lane title ("App launch") from the template functions.
    const productExpansionBlocks = generated.proposedBlocks.filter(
      (block) =>
        String(block?.derivedFrom || '').startsWith('expanded:') &&
        String(block?.title || '').toLowerCase().includes('app launch')
    );
    expect(productExpansionBlocks.length).toBeGreaterThanOrEqual(3);
  });

  it('launch anchor month (October) contains more than 2 proposed blocks', () => {
    const { generated } = buildGeneratedPlanState();
    const octoberBlocks = generated.proposedBlocks.filter((block) =>
      String(block?.dayKey || '').startsWith('2026-10')
    );
    // With creative anchor + product anchor + their expansions, October must have > 2 blocks.
    expect(octoberBlocks.length).toBeGreaterThan(2);
  });

  it('expansion blocks each have a valid ISO startISO on a weekday within the scheduling window', () => {
    const { generated } = buildGeneratedPlanState();
    const expansionBlocks = generated.proposedBlocks.filter((block) =>
      String(block?.derivedFrom || '').startsWith('expanded:')
    );
    expansionBlocks.forEach((block) => {
      expect(block.startISO).toBeTruthy();
      expect(Number.isFinite(Date.parse(String(block.startISO)))).toBe(true);
      // Must be scheduled on or after intake date and on or before horizon anchor.
      expect(String(block.dayKey || '') >= '2026-05-04').toBe(true);
      expect(String(block.dayKey || '') <= '2026-10-17').toBe(true);
    });
  });
});

// ─── Legacy milestone title safety net ───────────────────────────────────────

// Builds a raw (Immer-unfrozen) state with milestone title overridden before computeDerivedState,
// so the safety-net normalization inside buildMasterPlanFirstCycleProposals is the only guard.
function buildLegacyMilestonePlanState(legacyTitle) {
  const nowISO = '2026-05-04T12:00:00.000Z';
  const state = buildBlankIdentityState({ timeZone: 'UTC', nowISO, todayDate: '2026-05-04' });
  state.masterPlanIntake = {
    status: 'in-progress',
    phase: 4,
    step: 13,
    profileId: DEFAULT_PROFILE_ID,
    answers: {
      step_2: 'Build and coordinate Operation Endgame through a multi-lane master plan',
      step_3: { horizonEnd: '2026-11-01', months: 6, label: 'Oct 17' },
      step_5: { exists: true, urgency: 'high', notes: '' },
      step_6: 'Stay focused.',
      lane_0_description: 'Album assets ready.',
      lane_0_system_assessment: { assessedStage: 'ready-to-launch', assessedConfidence: 'high', assessmentNotes: '' },
      lane_0_activation: 'active',
      lane_0_clarifying_0: 'masters complete',
    },
    extractedLanes: [{ title: 'Album rollout', domain: 'creative', role: 'proof-artifact' }],
    anchors: [{ id: 'anchor-oct17', date: '2026-10-17', label: 'Oct 17 launch target', isFixed: true, affectedLaneIds: [], priority: 0 }],
    currentLaneIdx: 0,
    clarifyingQuestionIdx: 0,
    draft: null,
    errorMessage: null,
  };
  // Complete intake on the raw mutable state (before Immer freezing).
  applyMasterPlanAction(state, { type: 'MASTER_PLAN_INTAKE_COMPLETE', nowISO });
  // Inject legacy un-normalized title on the raw state BEFORE computeDerivedState freezes it.
  const milestoneIds = Object.keys(state.masterPlanMilestonesById || {});
  if (milestoneIds.length > 0) {
    state.masterPlanMilestonesById[milestoneIds[0]].title = legacyTitle;
  }
  return computeDerivedState(state, { type: 'NO_OP' });
}

function buildGeneratedFromLegacy(legacyTitle) {
  const established = buildLegacyMilestonePlanState(legacyTitle);
  const planId = established.masterPlanIntake.draft.masterPlanId;
  const started = computeDerivedState(established, {
    type: 'START_NEW_CYCLE_WITH_DECISION',
    payload: { mode: 'archive' },
  });
  const reassessed = computeDerivedState(started, {
    type: 'COMPLETE_CYCLE_REASSESSMENT',
    cycleId: started.activeCycleId,
  });
  const constrained = computeDerivedState(reassessed, {
    type: 'UPDATE_WORK_WINDOWS',
    payload: {
      cycleId: reassessed.activeCycleId,
      workWindows: {
        mon: [{ start: '09:00', end: '17:00' }],
        tue: [{ start: '09:00', end: '17:00' }],
        wed: [{ start: '09:00', end: '17:00' }],
        thu: [{ start: '09:00', end: '17:00' }],
        fri: [{ start: '09:00', end: '17:00' }],
        sat: [],
        sun: [],
      },
    },
  });
  return computeDerivedState(constrained, {
    type: 'GENERATE_PLAN',
    payload: { masterPlanId: planId, source: 'MASTER_PLAN_FIRST_CYCLE' },
  });
}

describe('master-plan block scheduling — legacy DROP/LAUNCH milestone title safety net', () => {
  it('a milestone with un-normalized DROP title does not produce a scheduled block titled "DROP"', () => {
    const generated = buildGeneratedFromLegacy('DROP');
    const dropBlocks = generated.proposedBlocks.filter(
      (block) => String(block?.title || '').trim().toUpperCase() === 'DROP'
    );
    expect(dropBlocks).toHaveLength(0);
  });

  it('a milestone with un-normalized LAUNCH title does not produce a scheduled block titled "LAUNCH"', () => {
    const generated = buildGeneratedFromLegacy('LAUNCH');
    const launchBlocks = generated.proposedBlocks.filter(
      (block) => String(block?.title || '').trim().toUpperCase() === 'LAUNCH'
    );
    expect(launchBlocks).toHaveLength(0);
  });
});

// ─── Cadence density tests ────────────────────────────────────────────────────

describe('master-plan cadence density — active lanes generate recurring work', () => {
  it('cadence candidates are generated for active lanes (derivedFrom cadence:)', () => {
    const { generated } = buildGeneratedPlanState();
    const cadenceBlocks = generated.proposedBlocks.filter((block) =>
      String(block?.derivedFrom || '').startsWith('cadence:')
    );
    expect(cadenceBlocks.length).toBeGreaterThan(0);
  });

  it('cadence block titles are domain-specific verb+object phrases', () => {
    const { generated } = buildGeneratedPlanState();
    const cadenceBlocks = generated.proposedBlocks.filter((block) =>
      String(block?.derivedFrom || '').startsWith('cadence:')
    );
    cadenceBlocks.forEach((block) => {
      const title = String(block?.title || '').trim();
      expect(title.length).toBeGreaterThan(15);
      expect(title.toUpperCase()).not.toBe('DROP');
      expect(title.toUpperCase()).not.toBe('LAUNCH');
    });
  });

  it('each active primary lane generates at least 2 cadence blocks per month for the first 3 months', () => {
    const { generated } = buildGeneratedPlanState();
    // Window: 2026-05-04 to 2026-10-17. Two active lanes (creative: "Album rollout", product: "App launch").
    // Each lane uses LANE_CADENCE_INTERVAL_DAYS = 14 days, starting 7 days after today.
    // Over 3 months (May-July), each lane produces ~6 blocks → 2/month per lane.
    const months = ['2026-05', '2026-06', '2026-07'];
    for (const month of months) {
      const creativeMonthBlocks = generated.proposedBlocks.filter(
        (block) =>
          String(block?.dayKey || '').startsWith(month) &&
          String(block?.derivedFrom || '').startsWith('cadence:') &&
          String(block?.title || '').toLowerCase().includes('album rollout')
      );
      expect(creativeMonthBlocks.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('total proposed blocks for 2-lane plan over 5.5 months significantly exceeds 20', () => {
    const { generated } = buildGeneratedPlanState();
    // With cadence + milestones + expansions, a 2-lane plan should generate > 30 blocks.
    expect(generated.proposedBlocks.length).toBeGreaterThan(20);
  });
});
