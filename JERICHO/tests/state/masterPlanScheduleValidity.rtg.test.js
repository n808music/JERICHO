import { describe, expect, it } from 'vitest';

import { computeDerivedState } from '../../src/state/identityCompute.js';
import { buildFullHorizonMultiLaneFixtureState, setHorizonMode } from '../helpers/masterPlanFullHorizonScenario.js';

const NINE_AM = 9 * 60;
const THREE_PM = 15 * 60;

function formatLocalParts(iso, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  return parts.reduce((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});
}

function localMinutesForISO(iso, timeZone) {
  const parts = formatLocalParts(iso, timeZone);
  return Number(parts.hour || 0) * 60 + Number(parts.minute || 0);
}

function buildChicagoWindowState() {
  const base = buildFullHorizonMultiLaneFixtureState({
    nowISO: '2026-06-04T15:00:00.000Z',
    todayDate: '2026-06-04',
  });
  const state = {
    ...base,
    appTime: {
      ...base.appTime,
      timeZone: 'America/Chicago',
    },
    goalExecutionContract: {
      ...base.goalExecutionContract,
      workWindows: {
        mon: [{ start: '09:00', end: '15:00' }],
        tue: [{ start: '09:00', end: '15:00' }],
        wed: [{ start: '09:00', end: '15:00' }],
        thu: [{ start: '09:00', end: '15:00' }],
        fri: [{ start: '09:00', end: '15:00' }],
        sat: [],
        sun: [],
      },
      workWindowsSource: 'user_defined',
    },
  };
  if (state.activeCycleId && state.cyclesById?.[state.activeCycleId]) {
    state.cyclesById[state.activeCycleId].goalContract = {
      ...state.cyclesById[state.activeCycleId].goalContract,
      workWindows: state.goalExecutionContract.workWindows,
      workWindowsSource: 'user_defined',
    };
  }
  return setHorizonMode(computeDerivedState(state, { type: 'NO_OP' }), 'full_horizon');
}

describe('RTG schedule validity and projection fidelity', () => {
  it('keeps Operation Endgame full-horizon blocks inside the saved 9:00 AM to 3:00 PM window without timestamp collisions', () => {
    const state = buildChicagoWindowState();
    const timeZone = state.appTime.timeZone;
    const blocks = state.fullHorizonScheduleBlocks || [];

    expect(blocks.length).toBeGreaterThan(1000);

    const timedBlocks = blocks.filter((block) => block?.startISO || block?.start);
    const startSet = new Set();
    const duplicateStarts = [];
    const outOfWindow = [];

    timedBlocks.forEach((block) => {
      const startISO = block.startISO || block.start;
      const startMin = localMinutesForISO(startISO, timeZone);
      const endMin = startMin + Math.max(15, Number(block.durationMinutes || block.timeEstimateMinutes || 0));
      if (startMin < NINE_AM || endMin > THREE_PM) {
        outOfWindow.push({ id: block.id, startISO, startMin, endMin });
      }
      if (startSet.has(startISO)) {
        duplicateStarts.push(startISO);
      }
      startSet.add(startISO);
    });

    expect(outOfWindow).toEqual([]);
    expect(duplicateStarts).toEqual([]);
  });

  it('retains typed, owned, lineage-bearing full-horizon blocks for Operation Endgame', () => {
    const state = buildChicagoWindowState();
    const blocks = state.fullHorizonScheduleBlocks || [];

    const missingType = blocks.filter((block) => !String(block.blockType || '').trim());
    const missingOwner = blocks.filter((block) => !String(block.owner || '').trim());
    const missingLineage = blocks.filter(
      (block) => !String(block.derivationReason || '').trim() && !(Array.isArray(block.sourceInputs) && block.sourceInputs.length > 0)
    );
    const repeatedTitles = blocks.reduce((acc, block) => {
      const title = String(block.displayTitle || block.title || '').trim();
      if (!title) {
        return acc;
      }
      acc[title] = (acc[title] || 0) + 1;
      return acc;
    }, {});

    expect(missingType).toEqual([]);
    expect(missingOwner).toEqual([]);
    expect(missingLineage).toEqual([]);
    expect(Math.max(...Object.values(repeatedTitles))).toBe(1);
  });
});
