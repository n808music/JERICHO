import { generateTasksForCycle } from '../../src/core/task-generator.js';

const goal = { outcome: 'Test goal' };

function gap(domain = 'execution', capability = 'execution') {
  return { domain, capability, weightedGap: 1, requirementId: `${domain}.${capability}` };
}

describe('task generator edge cases', () => {
  it('returns tasks even at integrity 0 (red band)', () => {
    const tasks = generateTasksForCycle(goal, [gap()], { integrityScore: 0, maxTasks: 2 });
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((t) => t.tier === 'T1')).toBe(true);
  });

  it('keeps tier progression for higher integrity', () => {
    const tasks = generateTasksForCycle(goal, [gap()], { integrityScore: 80, maxTasks: 2 });
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.some((t) => t.tier === 'T2' || t.tier === 'T3')).toBe(true);
  });
});
