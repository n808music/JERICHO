import { describe, expect, it } from 'vitest';

import fixture from '../fixtures/masterPlan/operationEndgame.fullHorizonSchedule.json';

describe('long-horizon phase/date coverage', () => {
  it('P2 fixture blocks stay within the expected P2 window', () => {
    const blocks = fixture.filter((block) => block.phaseLabel === 'P2');
    expect(blocks.length).toBeGreaterThan(0);
    blocks.forEach((block) => {
      const dayKey = block.dayKey || block.date;
      expect(dayKey >= '2027-01-01').toBe(true);
      expect(dayKey <= '2029-03-31').toBe(true);
    });
  });

  it('P3 fixture blocks stay within the expected P3 window and reach May 2031', () => {
    const blocks = fixture.filter((block) => block.phaseLabel === 'P3');
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.some((block) => String(block.dayKey || block.date || '').startsWith('2031-05'))).toBe(true);
    blocks.forEach((block) => {
      const dayKey = block.dayKey || block.date;
      expect(dayKey >= '2029-04-01').toBe(true);
      expect(dayKey <= '2031-05-11').toBe(true);
    });
  });
});
