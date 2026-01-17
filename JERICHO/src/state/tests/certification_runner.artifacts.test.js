import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { computeDerivedState } from '../identityCompute.js';
import { buildBlankState, FIXED_DAY, NOW_ISO, addCompletedEventsForBlocks, localStartISOForHour } from './freeze_helpers.js';
import { dayKeyFromISO } from '../time/time.ts';

const WRITE_ARTIFACTS = process.env.JERICHO_WRITE_ARTIFACTS === '1';
const OUT_DIR = path.join(process.cwd(), 'artifacts', 'certification');

async function writeArtifact(filename, payload) {
  if (!WRITE_ARTIFACTS) return;
  await fs.mkdir(OUT_DIR, { recursive: true });
  const fullPath = path.join(OUT_DIR, filename);
  await fs.writeFile(fullPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function stableSortByKey(list, key) {
  return [...list].sort((a, b) => {
    const aKey = a?.[key] || '';
    const bKey = b?.[key] || '';
    if (aKey < bKey) return -1;
    if (aKey > bKey) return 1;
    return String(a?.id || '').localeCompare(String(b?.id || ''));
  });
}

function snapshotCommittedBlocks(blocks = []) {
  return stableSortByKey(blocks, 'start').map((b) => ({
    id: b.id,
    dayKey: b.start ? dayKeyFromISO(b.start, 'UTC') : null,
    startISO: b.start,
    durationMinutes: b.durationMinutes || b.duration || 0,
    goalId: b.goalId || null,
    deliverableId: b.deliverableId || null,
    criterionId: b.criterionId || null
  }));
}

function snapshotProposedSummary(suggestions = []) {
  const proposed = suggestions.filter((s) => s && s.status === 'suggested');
  const dayKeys = proposed
    .map((s) => (s.startISO ? dayKeyFromISO(s.startISO, 'UTC') : null))
    .filter(Boolean);
  const sortedDayKeys = [...new Set(dayKeys)].sort();
  return {
    count: proposed.length,
    dayKeys: sortedDayKeys,
    startDayKey: sortedDayKeys[0] || null,
    endDayKey: sortedDayKeys[sortedDayKeys.length - 1] || null
  };
}

describe('Certification runner (artifacts)', () => {
  it('produces deterministic certification artifacts when enabled', async () => {
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
    expect(cycleId).toBeTruthy();

    state = computeDerivedState(state, {
      type: 'COMPILE_GOAL_EQUATION',
      payload: {
        equation: {
          label: 'Certification Goal',
          family: 'SKILL',
          mechanismClass: 'THROUGHPUT',
          objective: 'PRACTICE_HOURS_TOTAL',
          objectiveValue: 20,
          deadlineDayKey: '2026-02-08',
          deadlineType: 'HARD',
          workingFullTime: true,
          workDaysPerWeek: 4,
          workStartWindow: 'MID',
          workEndWindow: 'MID',
          minSleepHours: 8,
          sleepFixedWindow: false,
          sleepStartWindow: 'LATE',
          sleepEndWindow: 'EARLY',
          hasWeeklyRestDay: true,
          restDay: 0,
          blackoutBlocks: [],
          hasGymAccess: true,
          canCookMostDays: true,
          hasTransportLimitation: false,
          currentlyInjured: false,
          beginnerLevel: false,
          maxDailyWorkMinutes: 120,
          noEveningWork: false,
          noMorningWork: false,
          weekendsAllowed: true,
          travelThisPeriod: 'NONE',
          acceptsDailyMinimum: true,
          acceptsFixedSchedule: true,
          acceptsNoRenegotiation7d: true,
          acceptsAutomaticCatchUp: true
        }
      }
    });

    state = computeDerivedState(state, { type: 'GENERATE_PLAN' });
    const proposedSummary = snapshotProposedSummary(state.suggestedBlocks || []);
    expect(proposedSummary.count).toBeGreaterThan(0);

    state = computeDerivedState(state, { type: 'APPLY_PLAN' });

    let committedBlocks = snapshotCommittedBlocks(state.today?.blocks || []);
    if (committedBlocks.length === 0) {
      state = computeDerivedState(state, {
        type: 'CREATE_BLOCK',
        payload: {
          start: localStartISOForHour(9),
          durationMinutes: 30,
          domain: 'CREATION',
          title: 'Certification Manual Block',
          timeZone: 'UTC',
          linkToGoal: true
        }
      });
      committedBlocks = snapshotCommittedBlocks(state.today?.blocks || []);
    }
    expect(committedBlocks.length).toBeGreaterThan(0);

    addCompletedEventsForBlocks(state, state.today?.blocks || []);
    const executionEvents = stableSortByKey(state.executionEvents || [], 'atISO');
    state = computeDerivedState(state, { type: 'END_CYCLE', cycleId });

    const cycle = state.cyclesById?.[cycleId] || {};
    const planProof = cycle?.goalPlan?.planProof || cycle?.planProof || null;
    const cycleSummary = cycle?.summary || null;

    expect(planProof).toBeTruthy();
    expect(cycleSummary).toBeTruthy();
    expect(executionEvents.length).toBeGreaterThan(0);

    const committedSchedule = {
      dayKey: FIXED_DAY,
      blocks: committedBlocks
    };

    const planProofPayload = {
      planProof,
      P_end: cycle?.convergenceReport?.P_end || null
    };

    await writeArtifact('planProof.json', planProofPayload);
    await writeArtifact('proposedSchedule.json', proposedSummary);
    await writeArtifact('committedSchedule.json', committedSchedule);
    await writeArtifact('executionEvents.json', executionEvents);
    await writeArtifact('cycleSummary.json', cycleSummary);
    await writeArtifact('certificationMeta.json', {
      cycleId,
      nowISO: NOW_ISO,
      dayKey: FIXED_DAY,
      generatedAtISO: NOW_ISO
    });
  });
});
