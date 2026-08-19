// tests/state/matrix.gridFields.test.js
import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../../src/state/identityStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';

// Canonical harness (matches tests/state/matrix.nodes.test.js): blank identity
// state + computeDerivedState reducer. Matrix DECLARE_* cases live in computeDerivedState.
function runMatrix(actions) {
  let state = buildBlankIdentityState();
  state.appTime = { ...(state.appTime || {}), nowISO: '2026-07-08T00:00:00.000Z' };
  for (const a of actions) {state = computeDerivedState(state, a);}
  return state;
}

describe('matrix grid fields', () => {
  it('initiative declaration defaults reviewStatus=DRAFT, phase=null, roleTags=[]', () => {
    const s = runMatrix([
      { type: 'DECLARE_INITIATIVE', payload: { id: 'i1', name: 'Jericho System', purpose: 'x', classification: 'objective', doneWhen: 'y' } },
    ]);
    const rec = s.matrix.initiativesById.i1;
    expect(rec.reviewStatus).toBe('DRAFT');
    expect(rec.phase).toBe(null);
    expect(rec.roleTags).toEqual([]);
  });

  it('declared values persist (reviewStatus/phase/roleTags)', () => {
    const s = runMatrix([
      { type: 'DECLARE_INITIATIVE', payload: { id: 'i2', name: 'F8 ENERGY GUM', purpose: 'x', classification: 'objective', doneWhen: 'y', reviewStatus: 'CONFIRMED', phase: '1', roleTags: ['income'] } },
    ]);
    const rec = s.matrix.initiativesById.i2;
    expect(rec.reviewStatus).toBe('CONFIRMED');
    expect(rec.phase).toBe('1');
    expect(rec.roleTags).toEqual(['income']);
  });

  it('artifact carries producedByEntityId resolved to a declared entity', () => {
    const s = runMatrix([
      { type: 'DECLARE_ENTITY', payload: { id: 'e1', name: 'Global State Corp.', roleTags: ['corp'], purpose: 'p', formationState: 'formed', statusEvidence: 'ev' } },
      { type: 'DECLARE_ENTITY', payload: { id: 'e2', name: 'Global State Productions', roleTags: ['corp'], purpose: 'p', formationState: 'formed', statusEvidence: 'ev' } },
      { type: 'DECLARE_INITIATIVE', payload: { id: 'i3', name: 'Romance Riot', purpose: 'x', classification: 'objective', doneWhen: 'y' } },
      { type: 'DECLARE_VERIFICATION_SOURCE', payload: { id: 'v1', domain: 'src', source: 'm' } },
      { type: 'DECLARE_PROJECT', payload: { id: 'p1', name: 'OUR FEARLESS LEADER 3', owningEntityId: 'e1', owningInitiativeId: 'i3', successMetric: 'sm', verificationSourceId: 'v1' } },
      { type: 'DECLARE_ARTIFACT', payload: { id: 'a1', name: 'OFL 3: Romance Riot — tape/album', producingProjectId: 'p1', producedByEntityId: 'e2', completionEvidence: 'ce', verificationSourceId: 'v1', operatorAttestationMethod: 'am' } },
    ]);
    expect(s.matrix.artifactsById.a1.producedByEntityId).toBe('e2');
    expect(s.matrix.artifactsById.a1.reviewStatus).toBe('DRAFT');
  });
});
