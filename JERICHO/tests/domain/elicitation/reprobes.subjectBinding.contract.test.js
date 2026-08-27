import { describe, it, expect } from 'vitest';
import { REPROBES } from '../../../src/domain/elicitation/reprobes.js';
import { ENTITY_REPROBES } from '../../../src/domain/elicitation/entityReprobes.ts';
import { INITIATIVE_REPROBES } from '../../../src/domain/elicitation/initiativeReprobes.ts';
import { SYSTEM_REPROBES } from '../../../src/domain/elicitation/systemReprobes.ts';
import { ARTIFACT_REPROBES } from '../../../src/domain/elicitation/artifactReprobes.ts';

// Subject-binding contract (2026-07-10). Referent binding replaces the
// placeholder token ('this project', 'this undertaking', ...) with the item's
// captured name. A spine WITHOUT its token silently never binds — the operator
// answering a fan-out sees "Which part of your operation owns this?" with no
// clue which of five projects "this" is (live defect, twice: §3 owner on
// 2026-07-06, §5 owner on 2026-07-10). Ownership/parent-pick questions are
// where a lost subject assigns the wrong parent, so they MUST carry the token.

const OWNER_SPINES = [
  { code: 'PROJECT_OWNER_MISSING', token: 'this project', spine: () => lookup('PROJECT_OWNER_MISSING') },
  { code: 'INITIATIVE_OWNER_UNRESOLVED', token: 'this undertaking', spine: () => INITIATIVE_REPROBES.INITIATIVE_OWNER_UNRESOLVED.spine },
  { code: 'SYSTEM_OWNER_UNRESOLVED', token: 'this system', spine: () => SYSTEM_REPROBES.SYSTEM_OWNER_UNRESOLVED.spine },
  { code: 'ARTIFACT_PRODUCING_PROJECT_UNRESOLVED', token: 'this artifact', spine: () => ARTIFACT_REPROBES.ARTIFACT_PRODUCING_PROJECT_UNRESOLVED.spine },
];

function lookup(code) {
  const entry = REPROBES[code] || ENTITY_REPROBES[code];
  return entry?.spine;
}

describe('reprobe spines — subject-binding contract for owner/parent picks', () => {
  it.each(OWNER_SPINES)('$code spine contains its binder token', ({ token, spine }) => {
    const text = spine();
    expect(text, `spine missing for token check`).toBeTruthy();
    expect(text).toContain(token);
  });

  // INITIATIVE_CLASSIFICATION_MISSING was removed with initiative classification
  // (Item 6 Phase 4) — an Initiative carries no objective|constraint field. The
  // dangling-subject contract still applies to the remaining first-ask spines.
  it('first-ask spines with a dangling subject carry their token (cycle)', () => {
    expect(SYSTEM_REPROBES.SYSTEM_CYCLE_MISSING.spine).toContain('this system');
  });

  it('no initiative-classification reprobe survives the Phase 4 removal', () => {
    expect(INITIATIVE_REPROBES.INITIATIVE_CLASSIFICATION_MISSING).toBeUndefined();
    expect(INITIATIVE_REPROBES.INITIATIVE_CLASSIFICATION_INVALID).toBeUndefined();
  });
});
