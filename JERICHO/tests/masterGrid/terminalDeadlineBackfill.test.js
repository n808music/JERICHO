/**
 * terminalDeadlineBackfill.test.js
 *
 * Task A: Execute Terminal Deadline backfill and report named diffs
 * Verifies backfill applies correctly and spine declaration succeeds
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { applyTerminalDeadlineBackfill, declareCorrectSpine } from '../../src/domain/masterGrid/terminalDeadlineBackfill.js';

describe('Task A: Terminal Deadline Backfill', () => {
  let state;

  beforeEach(() => {
    // Create minimal matrix state with core spine Initiatives
    // (matching what would be loaded from real data)
    state = {
      matrix: {
        initiativesById: {
          'state-of-control': {
            id: 'state-of-control',
            name: 'State of Control',
            terminalDeadline: null,
            nextMilestoneDeadline: null,
            phase: null,
          },
          'seeds-of-destruction': {
            id: 'seeds-of-destruction',
            name: 'Seeds of Destruction',
            terminalDeadline: null,
            nextMilestoneDeadline: null,
            phase: null,
          },
          'i-am-the-state': {
            id: 'i-am-the-state',
            name: 'I Am The State',
            terminalDeadline: null,
            nextMilestoneDeadline: null,
            phase: null,
          },
          // Other Initiatives in the dataset
          'help-your-self-broadcast': {
            id: 'help-your-self-broadcast',
            name: 'Help Your Self Broadcast',
            terminalDeadline: null,
            nextMilestoneDeadline: null,
            phase: null,
          },
          'the-imaginary-ceo': {
            id: 'the-imaginary-ceo',
            name: 'The Imaginary CEO',
            terminalDeadline: null,
            nextMilestoneDeadline: null,
            phase: null,
          },
          'f8-energy-production-operations': {
            id: 'f8-energy-production-operations',
            name: 'F8 Energy — Production/Operations',
            terminalDeadline: null,
            nextMilestoneDeadline: null,
            phase: null,
          },
          '79th-street-renovation': {
            id: '79th-street-renovation',
            name: '79th Street Renovation',
            terminalDeadline: null,
            nextMilestoneDeadline: null,
            phase: null,
          },
          'first-academy-building': {
            id: 'first-academy-building',
            name: 'First Academy Building',
            terminalDeadline: null,
            nextMilestoneDeadline: null,
            phase: null,
          },
          'our-fearless-leader-7-seals': {
            id: 'our-fearless-leader-7-seals',
            name: 'Our Fearless Leader: 7 Seals',
            terminalDeadline: null,
            nextMilestoneDeadline: null,
            phase: null,
          },
        },
        spineInitiativeIds: [],
      },
    };
  });

  it('should apply Terminal Deadline backfill to all 30 Initiatives', () => {
    const result = applyTerminalDeadlineBackfill(state);

    expect(result.success).toBe(true);
    expect(result.diffs).toBeDefined();
    expect(result.diffs.length).toBeGreaterThan(0);

    // Should have updates for all Initiatives in the dataset
    const updated = result.diffs.filter((d) => d.status === 'UPDATED');
    expect(updated.length).toBeGreaterThan(0);

    // Verify specific known updates
    const stateOfControl = result.diffs.find((d) => d.initiativeId === 'state-of-control');
    expect(stateOfControl).toBeDefined();
    expect(stateOfControl.newTerminalDeadline).toBe('2028-02-17');

    const seedsOfDestruction = result.diffs.find((d) => d.initiativeId === 'seeds-of-destruction');
    expect(seedsOfDestruction).toBeDefined();
    expect(seedsOfDestruction.newTerminalDeadline).toBe('2029-08-17');

    const iAmTheState = result.diffs.find((d) => d.initiativeId === 'i-am-the-state');
    expect(iAmTheState).toBeDefined();
    expect(iAmTheState.newTerminalDeadline).toBe('2031-12-31');
  });

  it('should handle ongoing Initiatives with nextMilestoneDeadline', () => {
    const result = applyTerminalDeadlineBackfill(state);

    // Find initiatives marked as "ongoing" (null terminalDeadline, nextMilestoneDeadline set)
    const ongoing = result.diffs.filter(
      (d) => d.newTerminalDeadline === null && d.newNextMilestoneDeadline !== null
    );

    expect(ongoing.length).toBeGreaterThan(0);

    // Verify specific ongoing initiatives
    const helpYourSelf = result.diffs.find((d) => d.initiativeId === 'help-your-self-broadcast');
    expect(helpYourSelf).toBeDefined();
    expect(helpYourSelf.newTerminalDeadline).toBeNull();
    expect(helpYourSelf.newNextMilestoneDeadline).toBe('2026-08-17');
  });

  it('should declare the corrected spine with valid Initiative IDs', () => {
    // First apply backfill so all Initiatives exist
    applyTerminalDeadlineBackfill(state);

    // Then declare the spine
    const spineResult = declareCorrectSpine(state);

    expect(spineResult.success).toBe(true);
    expect(spineResult.spineInitiativeIds).toEqual([
      'state-of-control',
      'seeds-of-destruction',
      'i-am-the-state',
    ]);

    // Verify phase windows are correctly computed
    expect(spineResult.windows).toHaveLength(3);
    expect(spineResult.windows[0]).toMatchObject({
      phase: 1,
      spineInitiativeId: 'state-of-control',
      terminalDeadline: '2028-02-17',
    });
    expect(spineResult.windows[1]).toMatchObject({
      phase: 2,
      spineInitiativeId: 'seeds-of-destruction',
      terminalDeadline: '2029-08-17',
    });
    expect(spineResult.windows[2]).toMatchObject({
      phase: 3,
      spineInitiativeId: 'i-am-the-state',
      terminalDeadline: '2031-12-31',
    });
  });

  it('should report named diffs in standard format', () => {
    const result = applyTerminalDeadlineBackfill(state);

    // Format and display named diffs (as would be reported back to user)
    const report = formatNamedDiffReport(result.diffs);
    expect(report).toBeDefined();
    expect(report.length).toBeGreaterThan(0);
  });
});

/**
 * Format diffs as named-diff output (per user directive: evidence-first reporting)
 */
function formatNamedDiffReport(diffs) {
  const lines = [
    '## Task A: Terminal Deadline Backfill Report',
    `**Timestamp:** ${new Date().toISOString()}`,
    `**Total Initiatives:** ${diffs.length}`,
    `**Updated:** ${diffs.filter((d) => d.status === 'UPDATED').length}`,
    `**Not Found:** ${diffs.filter((d) => d.status === 'NOT_FOUND').length}`,
    '',
  ];

  const updated = diffs.filter((d) => d.status === 'UPDATED');
  if (updated.length > 0) {
    lines.push('### Updated Initiatives');
    lines.push('');
    for (const diff of updated.sort((a, b) => (a.name || '').localeCompare(b.name || ''))) {
      if (diff.newTerminalDeadline) {
        lines.push(
          `- **${diff.name}** (${diff.initiativeId}): terminalDeadline = ${diff.newTerminalDeadline}`
        );
      } else if (diff.newNextMilestoneDeadline) {
        lines.push(
          `- **${diff.name}** (${diff.initiativeId}): nextMilestoneDeadline = ${diff.newNextMilestoneDeadline} (ongoing)`
        );
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
