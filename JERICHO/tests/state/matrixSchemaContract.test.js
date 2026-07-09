import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const contract = JSON.parse(fs.readFileSync(path.resolve('jericho_matrix_schema.json'), 'utf8'));

describe('jericho_matrix_schema.json contract', () => {
  it('defines all five node classes', () => {
    expect(Object.keys(contract.nodeClasses).sort())
      .toEqual(['Deliverable', 'Entity', 'Initiative', 'Project', 'System']);
  });

  it('reviewStatus enum uses underscore form on every class', () => {
    for (const cls of Object.values(contract.nodeClasses)) {
      expect(cls.fields.reviewStatus.enum).toEqual(['CONFIRMED', 'NEEDS_REVIEW', 'DRAFT']);
    }
  });

  it('Deliverable carries producedByEntityId and work_state', () => {
    const d = contract.nodeClasses.Deliverable.fields;
    expect(d.producedByEntityId).toBeDefined();
    expect(d.work_state).toBeDefined();
  });
});
