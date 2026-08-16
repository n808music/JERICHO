/**
 * testPhaseComputationDirect.test.js
 *
 * Test the phase computation functions directly without going through the reducer
 */

import { describe, it, expect } from 'vitest';
import { computeSpineWindows, computeInitiativePhase } from '../../src/domain/masterGrid/spinePhaseComputation.js';

describe('Direct Phase Computation', () => {
  it('should compute spine windows correctly', () => {
    const spineInitiatives = [
      { id: 'init1', terminalDeadline: '2028-02-17' },
      { id: 'init2', terminalDeadline: '2029-08-17' },
      { id: 'init3', terminalDeadline: '2031-12-31' },
    ];

    const windows = computeSpineWindows(spineInitiatives);

    console.log('\n=== SPINE WINDOWS ===');
    for (const w of windows) {
      console.log(`Phase ${w.phaseNumber}: ${w.startBoundary} to ${w.endBoundary}`);
    }

    expect(windows.length).toBe(3);
    expect(windows[0].phaseNumber).toBe(1);
    expect(windows[1].phaseNumber).toBe(2);
    expect(windows[2].phaseNumber).toBe(3);
  });

  it('should compute initiative phases from windows', () => {
    const spineInitiatives = [
      { id: 'init1', terminalDeadline: '2028-02-17' },
      { id: 'init2', terminalDeadline: '2029-08-17' },
      { id: 'init3', terminalDeadline: '2031-12-31' },
    ];

    const windows = computeSpineWindows(spineInitiatives);

    const initiatives = [
      { id: 'state-of-control', terminalDeadline: '2028-02-17' },
      { id: 'seeds-of-destruction', terminalDeadline: '2029-08-17' },
      { id: 'i-am-the-state', terminalDeadline: '2031-12-31' },
      { id: 'future-init', terminalDeadline: '2035-01-01' },
    ];

    console.log('\n=== COMPUTED PHASES ===');
    for (const init of initiatives) {
      const phase = computeInitiativePhase(init, windows);
      console.log(`${init.id} (${init.terminalDeadline}): Phase ${phase}`);
      expect(phase).not.toBeNull();
    }

    const phase1 = computeInitiativePhase(initiatives[0], windows);
    const phase2 = computeInitiativePhase(initiatives[1], windows);
    const phase3 = computeInitiativePhase(initiatives[2], windows);
    const phase4 = computeInitiativePhase(initiatives[3], windows);

    expect(phase1).toBe(1);
    expect(phase2).toBe(2);
    expect(phase3).toBe(3);
    expect(phase4).toBe(3); // Beyond last boundary, so P3
  });
});
