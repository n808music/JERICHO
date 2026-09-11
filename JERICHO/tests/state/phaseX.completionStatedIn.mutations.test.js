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
});
