import { describe, it, expect } from 'vitest';
import { stripEmbeddedPlanTitle } from '../../src/state/identityStore.js';

// Ordering pin for the Gap 4 profile-contamination fix.
//
// stripEmbeddedPlanTitle removes a "Name / PlanTitle" suffix from a profile
// displayName, but it can only recognise the suffix as a plan title by MATCHING
// it against masterPlansById. RESET_IDENTITY (identityStore.js ~1202) therefore
// MUST read the still-populated masterPlansById and strip BEFORE the reset
// clears the plan map. If the order is inverted — clear the plans first, strip
// second — the map is empty, nothing matches, and the plan title contaminates
// the profile name. This test pins that ordering by exercising both maps.

const DISPLAY_NAME = 'Jamie / Launch the Q3 Campaign';
const POPULATED = { 'plan-1': { title: 'Launch the Q3 Campaign' } };
const CLEARED = {}; // masterPlansById after a reset that ran too early

describe('stripEmbeddedPlanTitle — ordering dependency on masterPlansById', () => {
  it('CORRECT order (strip against populated masterPlansById): plan title is stripped', () => {
    expect(stripEmbeddedPlanTitle(DISPLAY_NAME, POPULATED)).toBe('Jamie');
  });

  it('WRONG order (masterPlansById already cleared): plan title is NOT stripped — contamination survives', () => {
    // This is the failure the ordering guards against: with an empty map the
    // suffix cannot be recognised as a plan title, so it stays on the name.
    expect(stripEmbeddedPlanTitle(DISPLAY_NAME, CLEARED)).toBe(DISPLAY_NAME);
  });

  it('a " / " suffix that is NOT a known plan title is preserved (only plan titles are stripped)', () => {
    const name = 'Jamie / Chief of Staff';
    expect(stripEmbeddedPlanTitle(name, POPULATED)).toBe(name);
  });

  it('no separator: name passes through unchanged regardless of map', () => {
    expect(stripEmbeddedPlanTitle('Jamie', POPULATED)).toBe('Jamie');
    expect(stripEmbeddedPlanTitle('Jamie', CLEARED)).toBe('Jamie');
  });
});
