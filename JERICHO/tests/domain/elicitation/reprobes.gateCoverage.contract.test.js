import { describe, it, expect } from 'vitest';
import { REPROBES } from '../../../src/domain/elicitation/reprobes.js';

import { PROJECT_SLOT } from '../../../src/domain/elicitation/slots/projectSlot.js';
import { DELIVERABLE_SLOT } from '../../../src/domain/elicitation/slots/deliverableSlot.js';
import { VERIFICATION_SOURCE_SLOT } from '../../../src/domain/elicitation/slots/verificationSourceSlot.js';
import { ENTITY_SLOT } from '../../../src/domain/elicitation/entitySlot.ts';
import { INITIATIVE_SLOT } from '../../../src/domain/elicitation/initiativeSlot.ts';
import { SYSTEM_SLOT } from '../../../src/domain/elicitation/systemSlot.ts';
import { ARTIFACT_SLOT } from '../../../src/domain/elicitation/artifactSlot.ts';
import { DEPENDENCY_SLOT } from '../../../src/domain/elicitation/dependencySlot.ts';
import { CONVERGENCE_SLOT } from '../../../src/domain/elicitation/convergenceSlot.ts';
import { BOOTSTRAP_SLOT } from '../../../src/domain/elicitation/bootstrapSlot.ts';
import {
  RESOURCE_PROFILE_SLOT,
  BINDING_CONSTRAINT_SLOT,
} from '../../../src/domain/elicitation/resourceProfileSlot.ts';

// PRICING_STRATEGY_SLOT is deliberately absent. It is not a gate-ladder slot —
// it carries { name, probes } rather than { slotId, gate }, never reaches
// probeFor(), and so cannot produce the failure this contract guards.

// Gate/reprobe coverage contract (2026-09-05).
//
// probeFor() throws `No reprobe authored for code: X` when a slot gate emits a
// code the registry does not author. That throw is uncatchable by the operator
// — the elicitation flow dies mid-intake with a stack trace, not a probe.
//
// This shipped for real: 18a59c1 rewrote the System gate ladder
// (owner/mechanism/feeds) without updating systemReprobes.ts, so every
// cross-cutting system declaration crashed on the owner gate. Renaming a gate
// code is a two-file edit, and nothing enforced the second file.
//
// This guard walks every declared slot and asserts each gate code resolves.

const ALL_SLOTS = [
  PROJECT_SLOT,
  DELIVERABLE_SLOT,
  VERIFICATION_SOURCE_SLOT,
  ENTITY_SLOT,
  INITIATIVE_SLOT,
  SYSTEM_SLOT,
  ARTIFACT_SLOT,
  DEPENDENCY_SLOT,
  CONVERGENCE_SLOT,
  BOOTSTRAP_SLOT,
  RESOURCE_PROFILE_SLOT,
  BINDING_CONSTRAINT_SLOT,
];

// Pre-existing gaps, found by this guard on the day it was written and left
// standing because each belongs to a slot outside the Step 4 System scope.
// This list is a debt ledger, not a permission slip: it may only shrink. A new
// entry here means someone shipped the 18a59c1 defect again.
//
//   INITIATIVE_COMPLETION_VALUE_ONGOING_OUTPUT_MISMATCH — Step 3 Item 2
//     pairing gate. probeFor() throws when an Initiative supplies both a
//     completion_value and an ongoing_output.
//   ARTIFACT_SLUG_EMPTY — Gate C (2026-09-04). probeFor() throws when an
//     artifact name slugifies to the empty string.
const KNOWN_UNAUTHORED = [
  'INITIATIVE_COMPLETION_VALUE_ONGOING_OUTPUT_MISMATCH',
  'ARTIFACT_SLUG_EMPTY',
];

// Same ledger, for gate/reprobe pickSet disagreement. probeFor() returns the
// REPROBE's pickSet and discards the gate's, so both of these resolve to
// 'boundaryTypeOptions' — a kind elicitationEngine does not handle at all, so
// the boundary-type pick renders with no options in either slot.
const KNOWN_PICKSET_DRIFT = ['PROJECT_BOUNDARY_TYPE_MISSING', 'INITIATIVE_BOUNDARY_TYPE_MISSING'];

describe('reprobe registry — gate coverage contract', () => {
  it('every slot in the inventory is defined and carries a gate ladder', () => {
    for (const slot of ALL_SLOTS) {
      expect(slot, 'slot import resolved to undefined').toBeTruthy();
      expect(Array.isArray(slot.gate), `${slot?.slotId}: gate is not an array`).toBe(true);
    }
  });

  it.each(ALL_SLOTS.map((slot) => [slot.slotId, slot]))(
    '%s: every gate code has an authored reprobe',
    (slotId, slot) => {
      const unauthored = slot.gate
        .map((g) => g?.code)
        .filter(Boolean)
        .filter((code) => !REPROBES[code])
        .filter((code) => !KNOWN_UNAUTHORED.includes(code));
      expect(unauthored, `${slotId} emits codes with no reprobe: ${unauthored.join(', ')}`).toEqual(
        []
      );
    }
  );

  it.each(ALL_SLOTS.map((slot) => [slot.slotId, slot]))(
    '%s: every gate pickSet is mirrored on its reprobe entry',
    (slotId, slot) => {
      // A gate that declares a pickSet but whose reprobe omits it renders as a
      // free-text probe: the operator types a name the resolver never matches.
      const drift = slot.gate
        .filter((g) => g?.code && g?.pickSet && REPROBES[g.code])
        .filter((g) => REPROBES[g.code].pickSet !== g.pickSet)
        .filter((g) => !KNOWN_PICKSET_DRIFT.includes(g.code))
        .map((g) => `${g.code} (gate: ${g.pickSet}, reprobe: ${REPROBES[g.code].pickSet})`);
      expect(drift, `${slotId} pickSet drift: ${drift.join('; ')}`).toEqual([]);
    }
  );

  // The System slot is the one this contract was written for. It carries no
  // exemptions, and must never acquire one.
  it('slot:system claims no entry in either debt ledger', () => {
    const systemCodes = SYSTEM_SLOT.gate.map((g) => g.code);
    for (const code of [...KNOWN_UNAUTHORED, ...KNOWN_PICKSET_DRIFT]) {
      expect(systemCodes, `${code} must not be exempted for slot:system`).not.toContain(code);
    }
  });
});
