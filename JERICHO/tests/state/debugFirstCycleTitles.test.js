import { it } from 'vitest';
import { buildBlankIdentityState, DEFAULT_PROFILE_ID } from '../../src/state/identityStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { evaluatePlanQualityGate } from '../../src/domain/planQuality/evaluatePlanQualityGate.ts';
import { ACTION_VERB_SET } from '../../src/domain/planQuality/actionVerbs.ts';
import { applyMasterPlanAction } from '../../src/state/masterPlanStore.js';

function buildIntakeDraftState() {
  const state = buildBlankIdentityState({
    timeZone: 'UTC',
    nowISO: '2026-05-04T12:00:00.000Z',
    todayDate: '2026-05-04',
  });
  state.masterPlanIntake = {
    status: 'in-progress',
    phase: 4,
    step: 13,
    profileId: DEFAULT_PROFILE_ID,
    answers: {
      step_2: 'Release the EP and grow the PM company',
      step_3: { horizonEnd: '2026-11-01', months: 6, label: 'Oct 17' },
      step_5: { exists: true, urgency: 'immediate', notes: 'Need revenue this year.' },
      lane_0_description: 'Album is ready to launch with final masters complete.',
      lane_0_system_assessment: {
        assessedStage: 'ready-to-launch',
        assessedConfidence: 'high',
        assessmentNotes: 'Ready for release.',
      },
      lane_0_activation: 'active',
      lane_1_description: 'Starting from scratch on positioning and client outreach.',
      lane_1_system_assessment: {
        assessedStage: 'pre-concept',
        assessedConfidence: 'medium',
        assessmentNotes: 'Early lane.',
      },
      lane_1_activation: 'incubating',
    },
    extractedLanes: [
      { title: 'EP release', domain: 'creative', role: 'proof-artifact' },
      { title: 'PM company', domain: 'brand', role: 'revenue-engine' },
    ],
    anchors: [
      { id: 'anchor-oct17', date: '2026-10-17', label: 'Oct 17 drop', isFixed: true, affectedLaneIds: [], priority: 0 },
    ],
    currentLaneIdx: 0,
    clarifyingQuestionIdx: 0,
    draft: null,
    errorMessage: null,
  };
  return state;
}

it('debug first-cycle titles', () => {
  const draft = buildIntakeDraftState();
  applyMasterPlanAction(draft, { type: 'MASTER_PLAN_INTAKE_COMPLETE', nowISO: '2026-05-04T12:00:00.000Z' });
  const planId = draft.masterPlanIntake.draft.masterPlanId;
  const started = computeDerivedState(draft, { type: 'START_NEW_CYCLE_WITH_DECISION', payload: { mode: 'archive' } });
  const reassessed = computeDerivedState(started, { type: 'COMPLETE_CYCLE_REASSESSMENT', cycleId: started.activeCycleId });
  const constrained = computeDerivedState(reassessed, { type: 'UPDATE_WORK_WINDOWS', payload: { cycleId: reassessed.activeCycleId, workWindows: { mon: [{ start: '09:00', end: '12:00' }], tue: [{ start: '09:00', end: '12:00' }], wed: [{ start: '09:00', end: '12:00' }], thu: [{ start: '09:00', end: '12:00' }], fri: [{ start: '09:00', end: '12:00' }], sat: [], sun: [] } } });
  const generated = computeDerivedState(constrained, { type: 'GENERATE_PLAN', payload: { masterPlanId: planId, source: 'MASTER_PLAN_FIRST_CYCLE' } });
  const titles = generated.proposedBlocks.map((b) => ({ title: b.title, blockType: b.blockType, owner: b.owner, durationMinutes: b.durationMinutes, actionId: b.actionId, laneId: b.laneId }));
  console.log(JSON.stringify(titles, null, 2));
  const gateResult = evaluatePlanQualityGate({
    goalText: 'Dummy goal',
    verificationText: 'Dummy verification',
    proposedBlocks: generated.proposedBlocks,
    committedBlocks: [],
  });
  console.log('gateResult', JSON.stringify(gateResult, null, 2));
  const bad = generated.proposedBlocks
    .map((block) => {
      const title = String(block.title || '').trim();
      const words = title.split(/\s+/).filter(Boolean);
      const first = String(words[0] || '').toLowerCase().replace(/[^a-z-]/g, '');
      const fragmentary = words.length < 3;
      const question = title.includes('?') || new Set(['what', 'how', 'why', 'when', 'where', 'who', 'which', 'is', 'are', 'does', 'do', 'can', 'should', 'will', 'would', 'could']).has(first);
      const nonActionable = words.length >= 3 && !ACTION_VERB_SET.has(first);
      return { id: block.id, title, first, words: words.length, fragmentary, question, nonActionable };
    })
    .filter((item) => item.fragmentary || item.question || item.nonActionable);
  console.log('titleAudit', JSON.stringify(bad, null, 2));
});
