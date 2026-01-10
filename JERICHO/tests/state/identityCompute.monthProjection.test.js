import { describe, it, expect } from 'vitest';
import { projectMonthDays } from '../../src/state/identityCompute.js';

function iso(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00.000Z`;
}

function makeBlock({ id, start, end, practice = 'Focus', label = 'Outreach', status = 'planned' } = {}) {
  return { id, practice, label, start, end, status };
}

describe('identityCompute.projectMonthDays (Month projection)', () => {
  it('projects a padded month grid and marks inMonth correctly', () => {
    const days = projectMonthDays({ monthKey: '2025-12-15', blocks: [], includePadding: true });
    expect(days.length % 7).toBe(0);
    expect(days.some((d) => d.inMonth === true)).toBe(true);
    days.forEach((d) => {
      expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isFinite(d.plannedMinutes)).toBe(true);
      expect(Number.isFinite(d.completedMinutes)).toBe(true);
      expect(Number.isFinite(d.completionRate)).toBe(true);
      expect(d.completionRate).toBeGreaterThanOrEqual(0);
      expect(d.completionRate).toBeLessThanOrEqual(1);
    });
  });

  it('places blocks by start.slice(0,10) day key (UTC semantics)', () => {
    const block = makeBlock({
      id: 'b1',
      start: iso('2025-12-03', '14:00'),
      end: iso('2025-12-03', '15:00'),
      status: 'planned'
    });
    const days = projectMonthDays({ monthKey: '2025-12-15', blocks: [block], includePadding: true });
    const day = days.find((d) => d.date === '2025-12-03');
    expect(day).toBeTruthy();
    expect(day.blocks.some((b) => b.id === 'b1')).toBe(true);
    expect(Math.round(day.plannedMinutes)).toBe(60);
    expect(Math.round(day.completedMinutes || 0)).toBe(0);
    expect(day.completionRate).toBe(0);
  });

  it('planned=0 yields CR=0 (finite) rather than NaN/Infinity', () => {
    const block = makeBlock({
      id: 'z',
      start: iso('2025-12-03', '14:00'),
      end: iso('2025-12-03', '14:00'),
      status: 'planned'
    });
    const day = projectMonthDays({ monthKey: '2025-12-15', blocks: [block], includePadding: true }).find((d) => d.date === '2025-12-03');
    expect(day).toBeTruthy();
    expect(Math.round(day.plannedMinutes)).toBe(0);
    expect(Math.round(day.completedMinutes || 0)).toBe(0);
    expect(Number.isFinite(day.completionRate)).toBe(true);
    expect(day.completionRate).toBe(0);
  });

  it('cross-midnight ISO duration computes 60m (23:30→00:30)', () => {
    const block = makeBlock({
      id: 'x',
      start: iso('2025-12-03', '23:30'),
      end: iso('2025-12-04', '00:30'),
      status: 'planned'
    });
    const day = projectMonthDays({ monthKey: '2025-12-15', blocks: [block], includePadding: true }).find((d) => d.date === '2025-12-03');
    expect(day).toBeTruthy();
    expect(day.blocks.some((b) => b.id === 'x')).toBe(true);
    expect(Math.round(day.plannedMinutes)).toBe(60);
  });

  it('completed block counts toward completedMinutes and CR', () => {
    const block = makeBlock({
      id: 'c1',
      start: iso('2025-12-03', '14:00'),
      end: iso('2025-12-03', '15:00'),
      status: 'completed'
    });
    const day = projectMonthDays({ monthKey: '2025-12-15', blocks: [block], includePadding: true }).find((d) => d.date === '2025-12-03');
    expect(day).toBeTruthy();
    expect(Math.round(day.plannedMinutes)).toBe(60);
    expect(Math.round(day.completedMinutes)).toBe(60);
    expect(day.completionRate).toBe(1);
  });
});
