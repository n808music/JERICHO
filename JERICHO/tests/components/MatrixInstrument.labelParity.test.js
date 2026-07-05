import { describe, it, expect } from 'vitest';
import { ROLE_TAG_DISPLAY_LABELS } from '../../src/domain/enterprise/entityRoleTags.ts';
import { ROLE_TAG_DISPLAY_LABELS as CHIP_DISPLAY_LABELS } from '../../src/ui/masterPlan/MatrixInstrument.jsx';

describe('MatrixInstrument RoleTagChips label parity', () => {
  it('inline map in MatrixInstrument deep-equals ROLE_TAG_DISPLAY_LABELS from entityRoleTags', () => {
    expect(CHIP_DISPLAY_LABELS).toEqual(ROLE_TAG_DISPLAY_LABELS);
  });
});
