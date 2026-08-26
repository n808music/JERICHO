import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../../../src/state/identityStore.js';
import { computeDerivedState } from '../../../src/state/identityCompute.js';
import { createElicitationEngine, PROJECT_SLOT_ID } from '../../../src/domain/elicitation/elicitationEngine.js';
import { PROJECT_SLOT, buildProjectDeclarePayload } from '../../../src/domain/elicitation/slots/projectSlot.js';
import { REPROBES } from '../../../src/domain/elicitation/reprobes.js';

// WAVE 2 GATE 1 — Phase elicitation. These tests demonstrate the gap FIRST:
// the project slot never elicits phase, so DECLARE_PROJECT never carries it and
// node.phase is always null. They pass once §5 raw-phase attestation is wired
// (probe + gate validated via the shared classifyPhase + payload + copy).

describe('project slot — phase attestation (the gap, before the fix)', () => {
  it('elicits phase: phase is a captured field of the project slot', () => {
    expect(PROJECT_SLOT.matrixBinding.fields).toContain('phase');
  });

  it('has a phase-unattested gate that fires when phase is absent', () => {
    const g = PROJECT_SLOT.gate.find((x) => x.fieldName === 'phase' && /UNATTESTED|MISSING/.test(x.code));
    expect(g).toBeTruthy();
    expect(g.detect({ name: 'Romance Riot', owningEntityId: 'e1', description: '10k', verificationSourceId: 'v1' })).toBe(true);
    expect(g.detect({ name: 'Romance Riot', phase: '2' })).toBe(false);
  });

  it('has a non-canonical phase gate (validated through the single classifyPhase, not a second validator)', () => {
    const g = PROJECT_SLOT.gate.find((x) => x.fieldName === 'phase' && /NON_CANONICAL|INVALID/.test(x.code));
    expect(g).toBeTruthy();
    expect(g.detect({ name: 'X', phase: '7' })).toBe(true);       // present-but-invalid → rejected
    expect(g.detect({ name: 'X', phase: 'banana' })).toBe(true);
    expect(g.detect({ name: 'X', phase: '2' })).toBe(false);      // canonical → passes
  });

  it('carries phase through to the DECLARE_PROJECT payload (canonical number)', () => {
    const payload = buildProjectDeclarePayload({
      name: 'Romance Riot', owningEntityId: 'e1', description: '10k streams', verificationSourceId: 'v1', phase: '2',
    });
    expect(payload.phase).toBe(2);
  });

  it('ships a Disclosure-compliant phase probe (beginning/middle/end spine)', () => {
    const code = PROJECT_SLOT.gate.find((x) => x.fieldName === 'phase' && /UNATTESTED|MISSING/.test(x.code))?.code;
    expect(code).toBeTruthy();
    const probe = REPROBES[code];
    expect(probe?.spine).toMatch(/beginning|middle|end/i);
    expect(probe?.examples).toBeTruthy();
  });
});

describe('project slot — phase lands on the node end-to-end (real declare path)', () => {
  // The project reducer rejects unless the owning entity + verification source pre-exist.
  function seedContext() {
    let state = buildBlankIdentityState({});
    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'ent-gs-corp', name: 'Global State Corp.', roleTags: ['business'],
        purpose: 'Holding entity', formationState: 'functioning', statusEvidence: 'Operating',
      },
    });
    state = computeDerivedState(state, {
      type: 'DECLARE_VERIFICATION_SOURCE',
      payload: { id: 'vs-1', domain: 'streams', source: 'Spotify for Artists' },
    });
    return state;
  }

  it('an attested phase reaches node.phase via DECLARE_PROJECT (verified in the store)', () => {
    let state = seedContext();
    // The exact payload the slot builds from a captured phase answer, through the real reducer.
    const payload = buildProjectDeclarePayload({
      name: 'Romance Riot', owningEntityId: 'ent-gs-corp', description: '10,000 streams',
      verificationSourceId: 'vs-1', phase: '2',
    });
    state = computeDerivedState(state, { type: 'DECLARE_PROJECT', payload });
    const project = Object.values(state.matrix.projectsById || {}).find((p) => p.name === 'Romance Riot');
    expect(project).toBeTruthy();
    expect(String(project.phase)).toBe('2'); // was null before the slot captured phase
  });

  it('an absent phase still stores null (residual bucket) — not fabricated', () => {
    let state = seedContext();
    const payload = buildProjectDeclarePayload({
      name: 'Unphased', owningEntityId: 'ent-gs-corp', description: '1 launch', verificationSourceId: 'vs-1',
    });
    state = computeDerivedState(state, { type: 'DECLARE_PROJECT', payload });
    const project = Object.values(state.matrix.projectsById || {}).find((p) => p.name === 'Unphased');
    expect(project).toBeTruthy();
    expect(project.phase).toBeNull();
  });
});
