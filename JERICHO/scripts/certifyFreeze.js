import fs from 'node:fs/promises';
import path from 'node:path';
import { computeDerivedState } from '../src/state/identityCompute.js';
import {
  addCompletedEventsForBlocks,
  buildBlankState,
  FIXED_DAY,
  localStartISOForHour,
  NOW_ISO
} from '../src/state/tests/freeze_helpers.js';

const OUT_DIR = path.join(process.cwd(), 'docs', 'certification');

async function writeJson(filename, payload) {
  const fullPath = path.join(OUT_DIR, filename);
  const data = JSON.stringify(payload, null, 2);
  await fs.writeFile(fullPath, `${data}\n`, 'utf8');
}

function ensureDeliverableId(state, cycleId) {
  const workspace = state.deliverablesByCycleId?.[cycleId];
  if (workspace?.[0]?.id) return workspace[0].id;
  if (workspace?.deliverables?.[0]?.id) return workspace.deliverables[0].id;
  return null;
}

function buildCertifiedState() {
  let state = buildBlankState();

  state = computeDerivedState(state, {
    type: 'COMPLETE_ONBOARDING',
    onboarding: {
      direction: 'Freeze Certification',
      goalText: 'Certification goal',
      horizon: '30d',
      narrative: 'Freeze certification run',
      focusAreas: ['Creation'],
      successDefinition: 'Deliverables done',
      minimumDaysPerWeek: 3
    }
  });

  const cycleId = state.activeCycleId;
  if (!cycleId) {
    throw new Error('No active cycle created during certification run.');
  }

  state = computeDerivedState(state, {
    type: 'CREATE_DELIVERABLE',
    payload: { cycleId, title: 'Certification Deliverable', requiredBlocks: 2 }
  });

  state = computeDerivedState(state, { type: 'GENERATE_COLD_PLAN' });
  const firstSuggestion = (state.suggestedBlocks || []).find((s) => s && s.status === 'suggested');
  if (firstSuggestion) {
    state = computeDerivedState(state, { type: 'ACCEPT_SUGGESTED_BLOCK', proposalId: firstSuggestion.id });
  }

  const deliverableId = ensureDeliverableId(state, cycleId);
  const manualStartISO = localStartISOForHour(9);
  state = computeDerivedState(state, {
    type: 'CREATE_BLOCK',
    payload: {
      start: manualStartISO,
      durationMinutes: 30,
      domain: 'CREATION',
      title: 'Certification Manual Block',
      timeZone: 'UTC',
      linkToGoal: true,
      deliverableId
    }
  });

  const committedBlocks = [...(state.today?.blocks || [])];
  addCompletedEventsForBlocks(state, committedBlocks);
  state = computeDerivedState(state, { type: 'END_CYCLE', cycleId });

  return { state, cycleId };
}

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const { state, cycleId } = buildCertifiedState();
  const cycle = state.cyclesById?.[cycleId] || {};
  const planProof = cycle?.goalPlan?.planProof || cycle?.planProof || null;
  const cycleSummary = cycle?.summary || null;
  const committedSchedule = {
    today: state.today || null,
    currentWeek: state.currentWeek || null,
    cycleDays: state.cycle || []
  };
  const eventLog = state.executionEvents || [];

  await writeJson('planProof.json', planProof);
  await writeJson('committedSchedule.json', committedSchedule);
  await writeJson('eventLog.json', eventLog);
  await writeJson('cycleSummary.json', cycleSummary);

  await writeJson('certificationMeta.json', {
    cycleId,
    nowISO: NOW_ISO,
    dayKey: FIXED_DAY,
    generatedAtISO: NOW_ISO
  });

  console.log(`Certification snapshots written to ${OUT_DIR}`);
}

run().catch((err) => {
  console.error('Certification runner failed:', err);
  process.exit(1);
});
