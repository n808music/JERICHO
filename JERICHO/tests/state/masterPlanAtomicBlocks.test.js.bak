/**
 * Atomic block decomposition tests
 *
 * Doctrine: one scheduled block = one executable unit with one completion truth.
 * Composite / clustered titles must not survive into proposedBlocks.
 *
 * Covers:
 *  1. Numeric range "(episodes 1–3)" decomposes into 3 separate blocks
 *  2. Media lane generates individually titled episode milestones
 *  3. Product gate: app store screenshots and metadata are separate blocks
 *  4. Creative gate: distribution files and artwork are separate blocks
 *  5. Valid package artifact preserved as one block
 *  6. Completion truth: each decomposed block has a unique key/id
 *  7. No composite "(episodes N–M)" title survives into proposedBlocks
 */

import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState, DEFAULT_PROFILE_ID } from '../../src/state/identityStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { applyMasterPlanAction } from '../../src/state/masterPlanStore.js';

// ─── Shared fixture builders ──────────────────────────────────────────────────

function buildMediaLanePlanState({ nowISO = '2026-05-11T10:00:00.000Z', todayDate = '2026-05-11' } = {}) {
  const state = buildBlankIdentityState({ timeZone: 'UTC', nowISO, todayDate });
  state.masterPlanIntake = {
    status: 'in-progress', phase: 4, step: 13, profileId: DEFAULT_PROFILE_ID,
    answers: {
      step_2: 'Build a 5-year multi-venture platform with a podcast launch',
      step_3: { horizonEnd: '2031-05-11', months: 60, label: 'May 2031' },
      step_5: { exists: true, urgency: 'high', notes: '' },
      step_6: 'Execute.',
      lane_0_description: 'Podcast in pre-concept stage, no episodes recorded yet.',
      lane_0_system_assessment: { assessedStage: 'pre-concept', assessedConfidence: 'high', assessmentNotes: '' },
      lane_0_activation: 'active',
      lane_0_clarifying_0: 'no episodes recorded yet',
    },
    extractedLanes: [{ title: 'Podcast launch', domain: 'media', role: 'proof-artifact' }],
    anchors: [{ id: 'anchor-oct17', date: '2026-10-17', label: 'Oct 17 launch', isFixed: true, affectedLaneIds: [], priority: 0 }],
    currentLaneIdx: 0, clarifyingQuestionIdx: 0, draft: null, errorMessage: null,
  };
  applyMasterPlanAction(state, { type: 'MASTER_PLAN_INTAKE_COMPLETE', nowISO });
  const established = computeDerivedState(state, { type: 'NO_OP' });
  const planId = established.masterPlanIntake.draft.masterPlanId;

  const started = computeDerivedState(established, { type: 'START_NEW_CYCLE_WITH_DECISION', payload: { mode: 'archive' } });
  const reassessed = computeDerivedState(started, { type: 'COMPLETE_CYCLE_REASSESSMENT', cycleId: started.activeCycleId });
  const constrained = computeDerivedState(reassessed, {
    type: 'UPDATE_WORK_WINDOWS',
    payload: {
      cycleId: reassessed.activeCycleId,
      workWindows: {
        mon: [{ start: '09:00', end: '17:00' }], tue: [{ start: '09:00', end: '17:00' }],
        wed: [{ start: '09:00', end: '17:00' }], thu: [{ start: '09:00', end: '17:00' }],
        fri: [{ start: '09:00', end: '17:00' }], sat: [], sun: [],
      },
    },
  });
  const generated = computeDerivedState(constrained, {
    type: 'GENERATE_PLAN',
    payload: { masterPlanId: planId, source: 'MASTER_PLAN_FIRST_CYCLE' },
  });
  return generated;
}

function buildProductLanePlanState({ nowISO = '2026-05-11T10:00:00.000Z', todayDate = '2026-05-11' } = {}) {
  const state = buildBlankIdentityState({ timeZone: 'UTC', nowISO, todayDate });
  state.masterPlanIntake = {
    status: 'in-progress', phase: 4, step: 13, profileId: DEFAULT_PROFILE_ID,
    answers: {
      step_2: 'Build a 5-year platform with an app launch',
      step_3: { horizonEnd: '2031-05-11', months: 60, label: 'May 2031' },
      step_5: { exists: true, urgency: 'high', notes: '' },
      step_6: 'Execute.',
      lane_0_description: 'App 7 months into development, approaching app store submission.',
      lane_0_system_assessment: { assessedStage: 'in-development', assessedConfidence: 'high', assessmentNotes: '' },
      lane_0_activation: 'active',
      lane_0_clarifying_0: 'beta testing almost complete',
    },
    extractedLanes: [{ title: 'App launch', domain: 'product', role: 'revenue-engine' }],
    anchors: [{ id: 'anchor-oct17', date: '2026-10-17', label: 'Oct 17 launch', isFixed: true, affectedLaneIds: [], priority: 0 }],
    currentLaneIdx: 0, clarifyingQuestionIdx: 0, draft: null, errorMessage: null,
  };
  applyMasterPlanAction(state, { type: 'MASTER_PLAN_INTAKE_COMPLETE', nowISO });
  const established = computeDerivedState(state, { type: 'NO_OP' });
  const planId = established.masterPlanIntake.draft.masterPlanId;

  const started = computeDerivedState(established, { type: 'START_NEW_CYCLE_WITH_DECISION', payload: { mode: 'archive' } });
  const reassessed = computeDerivedState(started, { type: 'COMPLETE_CYCLE_REASSESSMENT', cycleId: started.activeCycleId });
  const constrained = computeDerivedState(reassessed, {
    type: 'UPDATE_WORK_WINDOWS',
    payload: {
      cycleId: reassessed.activeCycleId,
      workWindows: {
        mon: [{ start: '09:00', end: '17:00' }], tue: [{ start: '09:00', end: '17:00' }],
        wed: [{ start: '09:00', end: '17:00' }], thu: [{ start: '09:00', end: '17:00' }],
        fri: [{ start: '09:00', end: '17:00' }], sat: [], sun: [],
      },
    },
  });
  return computeDerivedState(constrained, {
    type: 'GENERATE_PLAN',
    payload: { masterPlanId: planId, source: 'MASTER_PLAN_FIRST_CYCLE' },
  });
}

// ─── Suite 1: Numeric range composite decomposition ───────────────────────────

describe('atomic block decomposition — numeric range (episodes 1–3)', () => {
  it('no proposedBlock title contains a parenthetical numeric episode range', () => {
    const generated = buildMediaLanePlanState();
    const compositeBlocks = generated.proposedBlocks.filter((b) =>
      /\(episodes?\s+\d+\s*[–\-]\s*\d+\)/i.test(String(b?.title || ''))
    );
    expect(compositeBlocks).toHaveLength(0);
  });

  it('no proposedBlock title contains an inline episode range like "episodes 1–3"', () => {
    const generated = buildMediaLanePlanState();
    const compositeBlocks = generated.proposedBlocks.filter((b) =>
      /\bepisodes?\s+\d+\s*[–\-]\s*\d+/i.test(String(b?.title || ''))
    );
    expect(compositeBlocks).toHaveLength(0);
  });

  it('media pre-concept lane produces at least 3 individually titled pilot episode blocks', () => {
    const generated = buildMediaLanePlanState();
    const ep1 = generated.proposedBlocks.filter((b) =>
      /episode\s+1\b/i.test(String(b?.title || ''))
    );
    const ep2 = generated.proposedBlocks.filter((b) =>
      /episode\s+2\b/i.test(String(b?.title || ''))
    );
    const ep3 = generated.proposedBlocks.filter((b) =>
      /episode\s+3\b/i.test(String(b?.title || ''))
    );
    expect(ep1.length).toBeGreaterThanOrEqual(1);
    expect(ep2.length).toBeGreaterThanOrEqual(1);
    expect(ep3.length).toBeGreaterThanOrEqual(1);
  });

  it('each pilot episode block has a unique id', () => {
    const generated = buildMediaLanePlanState();
    const episodeBlocks = generated.proposedBlocks.filter((b) =>
      /pilot episode \d/i.test(String(b?.title || ''))
    );
    expect(episodeBlocks.length).toBeGreaterThanOrEqual(3);
    const ids = episodeBlocks.map((b) => b.id || b.identityKey);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ─── Suite 2: Product gate — app store split ──────────────────────────────────

describe('atomic block decomposition — product gate app store split', () => {
  it('no proposedBlock title bundles screenshots, metadata, and description together', () => {
    const generated = buildProductLanePlanState();
    const composite = generated.proposedBlocks.filter((b) => {
      const t = String(b?.title || '').toLowerCase();
      return t.includes('screenshots') && t.includes('metadata') && t.includes('description');
    });
    expect(composite).toHaveLength(0);
  });

  it('app store screenshots appear as a standalone block', () => {
    const generated = buildProductLanePlanState();
    const screenshotBlocks = generated.proposedBlocks.filter((b) =>
      /screenshots?/i.test(String(b?.title || '')) &&
      !/metadata|description/i.test(String(b?.title || ''))
    );
    expect(screenshotBlocks.length).toBeGreaterThanOrEqual(1);
  });

  it('app store metadata / description appears as a standalone block', () => {
    const generated = buildProductLanePlanState();
    const metaBlocks = generated.proposedBlocks.filter((b) =>
      /metadata|description/i.test(String(b?.title || '')) &&
      /app store|store listing/i.test(String(b?.title || ''))
    );
    expect(metaBlocks.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Suite 3: Creative gate — distribution files + artwork split ──────────────

describe('atomic block decomposition — creative gate distribution split', () => {
  it('no proposedBlock title bundles files, metadata, and artwork for submission', () => {
    // Two-lane plan to get a creative lane with a gate milestone
    const state = buildBlankIdentityState({ timeZone: 'UTC', nowISO: '2026-05-11T10:00:00.000Z', todayDate: '2026-05-11' });
    state.masterPlanIntake = {
      status: 'in-progress', phase: 4, step: 13, profileId: DEFAULT_PROFILE_ID,
      answers: {
        step_2: 'Album release for anchor Oct 17',
        step_3: { horizonEnd: '2031-05-11', months: 60, label: 'May 2031' },
        step_5: { exists: false, urgency: 'low', notes: '' },
        step_6: 'Execute.',
        lane_0_description: 'Album assets ready for distribution.',
        lane_0_system_assessment: { assessedStage: 'pre-launch', assessedConfidence: 'high', assessmentNotes: '' },
        lane_0_activation: 'active',
        lane_0_clarifying_0: 'masters done',
      },
      extractedLanes: [{ title: 'Album rollout', domain: 'creative', role: 'proof-artifact' }],
      anchors: [{ id: 'anchor-oct17', date: '2026-10-17', label: 'Oct 17', isFixed: true, affectedLaneIds: [], priority: 0 }],
      currentLaneIdx: 0, clarifyingQuestionIdx: 0, draft: null, errorMessage: null,
    };
    applyMasterPlanAction(state, { type: 'MASTER_PLAN_INTAKE_COMPLETE', nowISO: '2026-05-11T10:00:00.000Z' });
    const established = computeDerivedState(state, { type: 'NO_OP' });
    const planId = established.masterPlanIntake.draft.masterPlanId;
    const started = computeDerivedState(established, { type: 'START_NEW_CYCLE_WITH_DECISION', payload: { mode: 'archive' } });
    const reassessed = computeDerivedState(started, { type: 'COMPLETE_CYCLE_REASSESSMENT', cycleId: started.activeCycleId });
    const constrained = computeDerivedState(reassessed, {
      type: 'UPDATE_WORK_WINDOWS',
      payload: {
        cycleId: reassessed.activeCycleId,
        workWindows: { mon:[{start:'09:00',end:'17:00'}],tue:[{start:'09:00',end:'17:00'}],wed:[{start:'09:00',end:'17:00'}],thu:[{start:'09:00',end:'17:00'}],fri:[{start:'09:00',end:'17:00'}],sat:[],sun:[] },
      },
    });
    const generated = computeDerivedState(constrained, {
      type: 'GENERATE_PLAN',
      payload: { masterPlanId: planId, source: 'MASTER_PLAN_FIRST_CYCLE' },
    });

    const composite = generated.proposedBlocks.filter((b) => {
      const t = String(b?.title || '').toLowerCase();
      return t.includes('files') && t.includes('metadata') && t.includes('artwork');
    });
    expect(composite).toHaveLength(0);
  });
});

// ─── Suite 4: Package artifact preservation ───────────────────────────────────

describe('atomic block decomposition — valid package artifacts preserved', () => {
  it('"Prepare release asset package" stays as one block when present', () => {
    // Package artifacts are unified deliverables — they must NOT be split.
    // This is a property test: if any block contains "asset package", it is NOT split.
    const generated = buildMediaLanePlanState();
    const pkgBlocks = generated.proposedBlocks.filter((b) =>
      /asset package/i.test(String(b?.title || ''))
    );
    // Each "asset package" block should appear exactly once (no phantom duplicates from over-splitting)
    const titles = pkgBlocks.map((b) => b.title);
    const unique = new Set(titles);
    // Every asset-package title maps to exactly one block (no duplication from splitting)
    expect(unique.size).toBe(titles.length);
  });

  it('"Finalize and upload launch content package" stays as one block (anchor expansion)', () => {
    const generated = buildMediaLanePlanState();
    const contentPkgBlocks = generated.proposedBlocks.filter((b) =>
      /launch content package/i.test(String(b?.title || ''))
    );
    // Should be 0 or 1 — never split into parts
    expect(contentPkgBlocks.length).toBeLessThanOrEqual(1);
  });
});

// ─── Suite 5: Completion truth — each decomposed block has a unique key ───────

describe('atomic block decomposition — completion truth', () => {
  it('all proposedBlock ids are unique', () => {
    const generated = buildMediaLanePlanState();
    const ids = generated.proposedBlocks.map((b) => b.id).filter(Boolean);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('episode 1, 2, 3 blocks have distinct ids from each other', () => {
    const generated = buildMediaLanePlanState();
    const epBlocks = generated.proposedBlocks.filter((b) =>
      /episode\s+[123]\b/i.test(String(b?.title || ''))
    );
    expect(epBlocks.length).toBeGreaterThanOrEqual(3);
    const epIds = epBlocks.map((b) => b.id || b.identityKey);
    const unique = new Set(epIds);
    expect(unique.size).toBe(epIds.length);
  });
});

// ─── Suite 6: Global — no composite executable title survives ─────────────────

describe('atomic block decomposition — composite title quarantine (full plan)', () => {
  it('no proposedBlock title uses a numeric episode range pattern', () => {
    const generated = buildMediaLanePlanState();
    generated.proposedBlocks.forEach((b) => {
      const t = String(b?.title || '');
      expect(t).not.toMatch(/episodes?\s+\d+\s*[–\-]\s*\d+/i);
    });
  });

  it('no proposedBlock title bundles "screenshots, metadata, and description"', () => {
    const generated = buildProductLanePlanState();
    generated.proposedBlocks.forEach((b) => {
      const t = String(b?.title || '').toLowerCase();
      const hasScreenshots = t.includes('screenshot');
      const hasMetadata = t.includes('metadata');
      const hasDescription = t.includes('description');
      // A title MAY contain one of these but not all three bundled
      expect(hasScreenshots && hasMetadata && hasDescription).toBe(false);
    });
  });

  it('no proposedBlock title bundles "files, metadata, and artwork" as a submission bundle', () => {
    const generated = buildMediaLanePlanState();
    generated.proposedBlocks.forEach((b) => {
      const t = String(b?.title || '').toLowerCase();
      expect(t.includes('files') && t.includes('metadata') && t.includes('artwork')).toBe(false);
    });
  });
});
