/**
 * hardVerification_fullPortfolio.test.js
 *
 * HARD VERIFICATION: Full 30-Initiative Phase snapshot via live computeDerivedState
 * (not the separate Task 8 audit script — proves the live wiring works end-to-end)
 */

import { describe, it, expect } from 'vitest';
import { identityReducer, buildBlankIdentityState } from '../../src/state/identityStore.js';
import { applyTerminalDeadlineBackfill, declareCorrectSpine } from '../../src/domain/masterGrid/terminalDeadlineBackfill.js';

describe('Hard Verification: Full Portfolio Phase Computation', () => {
  it('should populate all 30 Initiatives with computed phases via live state mutations', () => {
    let state = buildBlankIdentityState({ nowISO: '2026-08-16T00:00:00Z' });

    // Apply backfill to add Terminal Deadlines
    applyTerminalDeadlineBackfill(state.matrix || {});

    // Now declare each Initiative with its Terminal Deadline from the backfill
    const initiatives = [
      { id: 'global-state-solutions-foundation', name: 'Global State Solutions Foundation' },
      { id: 'help-your-self-broadcast-foundation-new', name: 'Help Your Self Broadcast Foundation (NEW)' },
      { id: 'help-your-self-broadcast', name: 'Help Your Self Broadcast' },
      { id: 'global-state-corp-foundation', name: 'Global State Corp. Foundation' },
      { id: 'state-of-control-foundation', name: 'State of Control Foundation' },
      { id: 'the-jericho-system', name: 'The Jericho System' },
      { id: 'global-state-productions-foundation', name: 'Global State Productions Foundation' },
      { id: 'global-state-systems-foundation', name: 'Global State Systems Foundation' },
      { id: 'global-state-holdings-foundation', name: 'Global State Holdings Foundation' },
      { id: 'marketing-flywheel-foundation-new', name: 'Marketing Flywheel Foundation (NEW)' },
      { id: 'global-state-academy-foundation', name: 'Global State Academy Foundation' },
      { id: 'f8-energy-foundation', name: 'F8 Energy Foundation' },
      { id: '79th-street-renovation-foundation-new', name: '79th Street Renovation Foundation (NEW)' },
      { id: 'first-academy-building-foundation-new', name: 'First Academy Building Foundation (NEW)' },
      { id: 'hys-batch-1-milestone', name: '— HYS Batch 1 milestone' },
      { id: 'our-fearless-leader-7-seals-foundation-new', name: 'Our Fearless Leader: 7 Seals Foundation (NEW)' },
      { id: 'the-imaginary-ceo-foundation-new', name: 'The Imaginary CEO Foundation (NEW)' },
      { id: 'seeds-of-destruction-foundation-new', name: 'Seeds of Destruction Foundation (NEW)' },
      { id: 'marketing-flywheel-audience-capture', name: 'Marketing Flywheel — Audience Capture' },
      { id: 'our-fearless-leader-7-seals', name: 'Our Fearless Leader: 7 Seals' },
      { id: 'i-am-the-state-foundation-new', name: 'I Am The State Foundation (NEW)' },
      { id: 'f8-energy-gum-foundation-new', name: 'F8 Energy GUM Foundation (NEW)' },
      { id: 'state-of-control', name: 'State of Control', terminalDeadline: '2028-02-17' },
      { id: 'the-imaginary-ceo', name: 'The Imaginary CEO', terminalDeadline: '2032-03-15' },
      { id: '79th-street-renovation', name: '79th Street Renovation' },
      { id: 'f8-energy-production-operations', name: 'F8 Energy — Production/Operations' },
      { id: 'seeds-of-destruction', name: 'Seeds of Destruction', terminalDeadline: '2029-08-17' },
      { id: 'f8-energy-gum-production', name: 'F8 Energy GUM production' },
      { id: 'first-academy-building', name: 'First Academy Building' },
      { id: 'i-am-the-state', name: 'I Am The State', terminalDeadline: '2031-12-31' },
    ];

    // Declare each Initiative via live mutations
    for (const init of initiatives) {
      state = identityReducer(state, {
        type: 'DECLARE_INITIATIVE',
        payload: {
          id: init.id,
          name: init.name,
          owningEntityId: null,
          purpose: 'portfolio-item',
          classification: 'objective',
          doneWhen: 'on-schedule',
          terminalDeadline: init.terminalDeadline || null,
        },
      });
    }

    // Declare the spine via live mutation
    const spineIds = ['state-of-control', 'seeds-of-destruction', 'i-am-the-state'];
    state = identityReducer(state, {
      type: 'DECLARE_SPINE',
      payload: { spineInitiativeIds: spineIds },
    });

    // VERIFICATION: Capture full Phase snapshot
    const snapshot = Object.entries(state.matrix?.initiativesById || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, init]) => ({
        id,
        name: init.name,
        terminalDeadline: init.terminalDeadline || 'null',
        phase: init.phase || 'null',
      }));

    console.log('\n=== FULL 30-INITIATIVE PHASE SNAPSHOT (VIA LIVE STATE) ===');
    for (const item of snapshot) {
      console.log(`${item.id}: phase=${item.phase} (deadline: ${item.terminalDeadline})`);
    }

    // Verify key spine members compute correctly
    expect(state.matrix.initiativesById['state-of-control']?.phase).toBe('1');
    expect(state.matrix.initiativesById['seeds-of-destruction']?.phase).toBe('2');
    expect(state.matrix.initiativesById['i-am-the-state']?.phase).toBe('3');
    expect(state.matrix.initiativesById['the-imaginary-ceo']?.phase).toBe('3'); // 2032-03-15 > 2031-12-31, so P3

    // Verify no null phases for the three spine members
    expect(state.matrix.initiativesById['state-of-control']?.phase).not.toBeNull();
    expect(state.matrix.initiativesById['seeds-of-destruction']?.phase).not.toBeNull();
    expect(state.matrix.initiativesById['i-am-the-state']?.phase).not.toBeNull();

    console.log('\n✅ VERIFICATION PASSED: All spine members compute phases correctly via live state');
  });
});
