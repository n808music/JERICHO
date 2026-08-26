// Wave 2 Gate 1 — end-to-end phase flow. Drives the REAL elicitation engine over the project
// slot (through the verification-source spawn and the readback) and proves the §5 phase probe
// fires in sequence and the attested phase lands on the node IN THE STORE (read back from
// state.matrix.projectsById, not inferred). Complements projectPhase.test.js, which exercises the
// slot contract + the direct declare path; this one exercises the full engine drive.
import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../../../src/state/identityStore.js';
import { computeDerivedState } from '../../../src/state/identityCompute.js';
import { createElicitationEngine, PROJECT_SLOT_ID } from '../../../src/domain/elicitation/elicitationEngine.js';

// Adaptive answer table keyed by the probe code the engine is currently asking. Answers are
// field-bag objects (the engine merges them), matching the real slot-driving contract.
const ANSWER_BY_CODE = {
  PROJECT_NAME_MISSING: { name: 'Romance Riot' },
  PROJECT_OWNER_MISSING: { owningEntityId: 'ent-gs-corp' },
  PROJECT_DESCRIPTION_MISSING: { description: '10,000 streams' },
  // The source answer carries `verificationSource` (the label) — this spawns the Section 1A
  // verification-source sub-slot with `source` pre-captured, so only its domain is asked next.
  PROJECT_VERIFICATION_LOCATION_MISSING: { verificationSource: 'Spotify for Artists' },
  VERIFICATION_SOURCE_SOURCE_MISSING: { source: 'Spotify for Artists' },
  VERIFICATION_SOURCE_DOMAIN_MISSING: { domain: 'streams' },
  PROJECT_PHASE_UNATTESTED: { phase: '2' },
  // Legal formation gate — music projects typically don't require legal formation
  PROJECT_LEGAL_FORMATION_MISSING: { requiresLegalFormation: false },
};

function driveProjectSlot() {
  let state = buildBlankIdentityState({});
  // Pre-declare the owning entity so the project reducer accepts the eventual DECLARE_PROJECT.
  state = computeDerivedState(state, {
    type: 'DECLARE_ENTITY',
    payload: {
      id: 'ent-gs-corp', name: 'Global State Corp.', roleTags: ['business'],
      purpose: 'Holding entity for the enterprise', formationState: 'functioning',
      statusEvidence: 'Operating across verticals',
    },
  });

  let engine = createElicitationEngine({ goalType: 'musician', matrixSnapshot: state.matrix, scope: [PROJECT_SLOT_ID] });
  let step = engine.openingStep();
  const probeCodes = [];
  let phaseProbe = null;
  let safety = 0;
  while (!step.done) {
    if (safety++ > 40) throw new Error('engine did not terminate; codes=' + probeCodes.join(','));
    if (step.readback) {
      const result = engine.confirmReadback({ confirmed: true });
      engine = result.engine;
      for (const action of result.dispatches || []) state = computeDerivedState(state, action);
      engine = engine.refreshMatrix(state.matrix);
      step = engine.nextStep();
      continue;
    }
    const { code } = step.probe;
    probeCodes.push(code);
    if (code === 'PROJECT_PHASE_UNATTESTED') phaseProbe = step.probe;
    const answer = ANSWER_BY_CODE[code];
    if (!answer) throw new Error(`no scripted answer for probe ${code}; codes so far: ${probeCodes.join(',')}`);
    const result = engine.consumeAnswer(answer);
    engine = result.engine;
    for (const action of result.dispatches || []) state = computeDerivedState(state, action);
    engine = engine.refreshMatrix(state.matrix);
    step = engine.nextStep();
  }
  const project = Object.values(state.matrix.projectsById || {}).find((p) => p.name === 'Romance Riot');
  return { probeCodes, phaseProbe, project };
}

describe('Elicitation Engine — §5 phase probe fires in the real flow and lands in the store', () => {
  it('emits PROJECT_PHASE_UNATTESTED after the verification source, before dispatch', () => {
    const { probeCodes } = driveProjectSlot();
    const sourceIdx = probeCodes.indexOf('PROJECT_VERIFICATION_LOCATION_MISSING');
    const phaseIdx = probeCodes.indexOf('PROJECT_PHASE_UNATTESTED');
    expect(phaseIdx).toBeGreaterThan(-1);          // the probe fires
    expect(phaseIdx).toBeGreaterThan(sourceIdx);   // in the right order (after source)
  });

  it('shows the Disclosure-compliant, referent-bound phase copy at the probe', () => {
    const { phaseProbe } = driveProjectSlot();
    expect(phaseProbe.spine).toMatch(/beginning|middle|end/i);
    expect(phaseProbe.spine).toContain('Romance Riot'); // subject token bound to the node name
  });

  it('writes the attested phase onto the node (read back from the store)', () => {
    const { project } = driveProjectSlot();
    expect(project).toBeTruthy();
    expect(String(project.phase)).toBe('2');
  });
});
