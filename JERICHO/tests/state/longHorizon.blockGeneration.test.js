import { describe, expect, it } from 'vitest';

import { deriveForecastBlocks, validateBlockTitle } from '../../src/domain/masterPlan/forecastBlockDerivation.js';

describe('long-horizon block generation', () => {
  it('forecast block derivation produces locked deterministic blocks from a minimal phase substrate', () => {
    const plan = {
      id: 'plan-test',
      horizonStart: '2026-05-11',
      fullHorizonEndDayKey: '2031-05-11',
      northStarOutcome: 'Build 5-year platform',
    };
    const phase = {
      id: 'plan-test:p2',
      label: 'P2',
      name: 'Conversion / Operating System',
      startBoundary: '2027-06-01',
      endBoundary: '2029-06-01',
      phaseObjective: 'Convert launch proof into repeatable cadence.',
      activeState: 'locked',
      commitmentState: 'forecast',
      laneParticipation: [{ laneId: 'lane-1', laneTitle: 'App launch', domain: 'product', status: 'active' }],
      evidenceRequirements: ['repeatable conversion signal', 'operating cadence stability'],
      unlockCriteria: ['Revenue or conversion architecture is proving repeatable.'],
    };

    const blocks = deriveForecastBlocks({ plan, phase, horizonEndDayKey: '2031-05-11' });
    expect(blocks.length).toBeGreaterThan(0);
    blocks.forEach((block) => {
      expect(block.id).toBeTruthy();
      expect(block.phaseLabel).toBe('P2');
      expect(block.source).toBe('derived');
      expect(block.executionEligibility).toBe('locked');
      expect(validateBlockTitle(block.title)).toBe(true);
    });
  });
});
