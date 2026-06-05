import { describe, expect, it } from 'vitest';

import { resolveHorizonEndForMode } from '../../src/domain/masterPlan/forecastBlockDerivation.js';

const HORIZON_VISIBILITY = {
  currentCycleEnd: '2026-10-17',
  oneYearEnd: '2027-05-11',
  twoYearEnd: '2028-05-11',
  threeYearEnd: '2029-05-11',
  fourYearEnd: '2030-05-11',
  fiveYearEnd: '2031-05-11',
  fullEnd: '2031-05-11',
};

const BLOCKS = [
  { id: 'committed-p1', dayKey: '2026-09-01', phaseLabel: 'P1', source: 'committed' },
  { id: 'forecast-p1', dayKey: '2027-03-10', phaseLabel: 'P1', source: 'derived' },
  { id: 'forecast-p2', dayKey: '2028-08-10', phaseLabel: 'P2', source: 'derived' },
  { id: 'forecast-p3', dayKey: '2030-11-10', phaseLabel: 'P3', source: 'derived' },
];

function visibleBlocks(mode) {
  const end = resolveHorizonEndForMode(HORIZON_VISIBILITY, mode, HORIZON_VISIBILITY.currentCycleEnd);
  return BLOCKS.filter((block) => block.dayKey <= end);
}

describe('long-horizon visibility modes', () => {
  it('current_cycle starts with no derived forecast blocks', () => {
    const forecastBlocks = visibleBlocks('current_cycle').filter((block) => block.source === 'derived');
    expect(forecastBlocks).toHaveLength(0);
  });

  it('expanded horizon modes monotonically increase visible block coverage', () => {
    expect(visibleBlocks('1_year').length).toBeGreaterThan(visibleBlocks('current_cycle').length);
    expect(visibleBlocks('2_year').length).toBeGreaterThanOrEqual(visibleBlocks('1_year').length);
    expect(visibleBlocks('3_year').length).toBeGreaterThanOrEqual(visibleBlocks('2_year').length);
    expect(visibleBlocks('5_year').length).toBeGreaterThanOrEqual(visibleBlocks('3_year').length);
  });

  it('collapsed current_cycle hides P2/P3 forecast visibility after expansion', () => {
    const collapsed = visibleBlocks('current_cycle');
    expect(collapsed.filter((block) => block.source === 'derived')).toHaveLength(0);
    expect(collapsed.filter((block) => block.phaseLabel === 'P2')).toHaveLength(0);
    expect(collapsed.filter((block) => block.phaseLabel === 'P3')).toHaveLength(0);
  });
});
