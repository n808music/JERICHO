import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadReferenceMatrix } from '../../src/domain/masterGrid/loadReferenceMatrix.js';

const fixture = JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/reference_matrix_v3_1.json'), 'utf8'));

describe('Phase X: completion_stated_in validation mutations', () => {
  it('rejects Children with completion_value', () => {
    const mutated = JSON.parse(JSON.stringify(fixture));
    // Find a Children row and add a completion_value
    const childrenInit = mutated.nodes.find((n) => 
      n.class === 'Initiative' && n.completion_stated_in === 'Children'
    );
    if (childrenInit) {
      childrenInit.completion_value = 'arbitrary value';
    }
    
    const m = loadReferenceMatrix(mutated, { nowISO: '2026-08-28T00:00:00Z' });
    expect(m.lastPlanError?.code).toBe('INITIATIVE_COMPLETION_VALUE_FORBIDDEN');
    expect(m.lastPlanError?.reason).toContain('Children');
  });

  it('rejects This Row with blank completion_value', () => {
    const mutated = JSON.parse(JSON.stringify(fixture));
    // Find a This Row row and clear its completion_value
    const thisRowInit = mutated.nodes.find((n) => 
      n.class === 'Initiative' && n.completion_stated_in === 'This Row'
    );
    if (thisRowInit) {
      thisRowInit.completion_value = '';
    }
    
    const m = loadReferenceMatrix(mutated, { nowISO: '2026-08-28T00:00:00Z' });
    expect(m.lastPlanError?.code).toBe('INITIATIVE_COMPLETION_VALUE_MISSING');
    expect(m.lastPlanError?.reason).toContain('This Row');
  });

  it('rejects Does Not Complete with completion_value', () => {
    const mutated = JSON.parse(JSON.stringify(fixture));
    // Find a Does Not Complete row and add a completion_value
    const doesNotCompleteInit = mutated.nodes.find((n) => 
      n.class === 'Initiative' && n.completion_stated_in === 'Does Not Complete'
    );
    if (doesNotCompleteInit) {
      doesNotCompleteInit.completion_value = 'arbitrary value';
    }
    
    const m = loadReferenceMatrix(mutated, { nowISO: '2026-08-28T00:00:00Z' });
    expect(m.lastPlanError?.code).toBe('INITIATIVE_COMPLETION_VALUE_FORBIDDEN');
    expect(m.lastPlanError?.reason).toContain('Ongoing');
  });

  it('rejects Does Not Complete with blank ongoing_output', () => {
    const mutated = JSON.parse(JSON.stringify(fixture));
    // Find a Does Not Complete row and clear its ongoing_output
    const doesNotCompleteInit = mutated.nodes.find((n) =>
      n.class === 'Initiative' && n.completion_stated_in === 'Does Not Complete'
    );
    if (doesNotCompleteInit) {
      doesNotCompleteInit.ongoing_output = '';
    }

    const m = loadReferenceMatrix(mutated, { nowISO: '2026-08-28T00:00:00Z' });
    expect(m.lastPlanError?.code).toBe('INITIATIVE_ONGOING_OUTPUT_MISSING');
    expect(m.lastPlanError?.reason).toContain('Does Not Complete');
  });

  // The positive case, and the reason an inverted gate shipped green on its own
  // suite: all four mutations above assert REJECTION, so a gate that rejected every
  // row satisfied every one of them. 18 of the 29 fixture Initiatives are Children
  // lanes carrying no completion_value; before the gate branched on the token they
  // were all rejected, which zeroed every entity, because each entity resolves its
  // foundation_initiative against a Foundation lane.
  it('accepts the unmutated fixture: Children lanes load with blank completion_value', () => {
    const m = loadReferenceMatrix(fixture, { nowISO: '2026-08-28T00:00:00Z' });
    expect(m.lastPlanError).toBeNull();
    expect(Object.keys(m.matrix?.initiativesById || {})).toHaveLength(29);
    // Entities are the canary for this defect: rejecting the Foundation lanes takes
    // all 7 with it, which is how the gate presented as a total entity-load failure.
    expect(Object.keys(m.matrix?.entitiesById || {})).toHaveLength(7);
  });

  it('accepts This Row when completion_value is present', () => {
    const mutated = JSON.parse(JSON.stringify(fixture));
    const thisRowInit = mutated.nodes.find((n) =>
      n.class === 'Initiative' && n.completion_stated_in === 'This Row'
    );
    if (!thisRowInit) throw new Error('fixture invariant broken: no "This Row" Initiative');
    thisRowInit.completion_value = 'Completion criterion for this row';

    const m = loadReferenceMatrix(mutated, { nowISO: '2026-08-28T00:00:00Z' });
    expect(m.lastPlanError).toBeNull();
    expect(Object.keys(m.matrix?.initiativesById || {})).toHaveLength(29);
  });
});
