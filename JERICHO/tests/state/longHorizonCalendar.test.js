/**
 * Broad integration sweep for long-horizon behavior.
 *
 * This file is intentionally no longer the fast validation surface. Focused
 * responsibility tests live in:
 * - longHorizon.blockGeneration.test.js
 * - longHorizon.mergeBehavior.test.js
 * - longHorizon.visibilityModes.test.js
 * - longHorizon.phaseCoverage.test.js
 * - longHorizon.countStability.test.js
 */

import { describe, expect, it } from 'vitest';

import {
  buildFiveYearPlanState,
  buildFreshMasterPlanCycleState,
  getBlocksByPhase,
  getCalendarBlocks,
  getForecastBlocks,
  getPlan,
  setHorizonMode,
} from '../helpers/longHorizonHarness.js';

describe('long-horizon calendar integration sweep', () => {
  it('preserves the end-to-end horizon contract across current, expanded, and fresh-cycle states', () => {
    const base = buildFiveYearPlanState();
    const plan = getPlan(base);
    const threeYear = setHorizonMode(base, '3_year');
    const full = setHorizonMode(base, 'full_horizon');
    const collapsed = setHorizonMode(full, 'current_cycle');
    const fresh = buildFreshMasterPlanCycleState();
    const freshExpanded = setHorizonMode(fresh, 'full_horizon');

    expect(plan?.fullHorizonEndDayKey).toBe('2031-05-11');
    expect(base.selectedHorizonMode).toBe('current_cycle');
    expect(base.strategicHorizonEndDayKey).toBe(plan?.fullHorizonEndDayKey);

    expect(getCalendarBlocks(threeYear).length).toBeGreaterThan(getCalendarBlocks(base).length);
    expect(getForecastBlocks(full).length).toBeGreaterThan(0);
    expect(getBlocksByPhase(full, 'P2').length).toBeGreaterThan(0);
    expect(getBlocksByPhase(full, 'P3').length).toBeGreaterThan(0);
    expect(getCalendarBlocks(full).some((block) => String(block?.dayKey || block?.date || '').startsWith('2031-05'))).toBe(true);

    expect(getForecastBlocks(collapsed)).toHaveLength(0);
    expect(collapsed.selectedHorizonMode).toBe('current_cycle');

    expect(fresh.scheduleLifecycle).toBe('no_schedule');
    expect(fresh.scheduleLifecycleState).toBe('inter_cycle');
    expect(fresh.calendarDisplayBlocks).toEqual([]);
    expect(freshExpanded.calendarDisplayBlocks).toEqual([]);
    expect((freshExpanded.fullHorizonScheduleBlocks || []).length).toBeGreaterThan(0);
  });
});
