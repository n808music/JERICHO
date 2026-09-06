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

// elicitationEngine.js:380 resolves a probe's pickSet as:
//     const pickKind = gateEntry?.pickSet || base.pickSet;
// The GATE's pickSet wins over the reprobe's base.pickSet. That precedence is
// correct and deliberate — the gate is the authority on what it is asking for.
//
// Same ledger shape as above, keyed by gate CODE, for gates whose reprobe
// declares a different kind. The gate's kind is what renders; the reprobe's is
// dead text. Both entries below declare a gate-side *BoundaryTypeOptions kind
// against a reprobe-side 'boundaryTypeOptions'.
const KNOWN_PICKSET_DRIFT = ['PROJECT_BOUNDARY_TYPE_MISSING', 'INITIATIVE_BOUNDARY_TYPE_MISSING'];

// The kinds elicitationEngine.buildPickSet() (elicitationEngine.js:156-320)
// actually implements. Every other kind falls through to the tail
// `return { kind, items: [] }`.
const IMPLEMENTED_PICKSET_KINDS = [
  'declaredEntities',
  'declaredSources',
  'roleTagOptions',
  'formationStateOptions',
  'yesNoOptions',
  'legalFormationPrerequisiteOptions',
  'initiativeOwnerOptions',
  'initiativeRoleTagOptions',
  'systemOwnerOptions',
  'producingProjectOptions',
  'declaredNodeOptions',
  'dependencyTypeOptions',
  'allDeclaredNodeOptions',
  'convergenceSourceOptions',
  'unprofiledInitiativeOptions',
  'resourceDimensionOptions',
  'bootstrapCandidateOptions',
];

// KNOWN_UNHANDLED_PICKSET_KINDS — declared kinds buildPickSet does not implement.
//
// BLOCKER CLASS (2026-09-05). Soft-fail, not a crash: an unimplemented kind
// yields items: [], which sets probe.dependencyGap = true
// (elicitationEngine.js:383-385), and MatrixIntake.jsx:1584 gates rendering on
// `probe.pickSet && !probe.dependencyGap`. The operator is therefore told a
// PREREQUISITE IS MISSING when the truth is the pickSet kind was never built.
// A false diagnosis is worse than an empty list — it sends the operator to fix
// a dependency that is not broken.
//
// Fix scope is the ENGINE, not the reprobe registry. Adding reprobe entries
// cannot clear any line below. Blocks Test 1 entry.
//
// Compounding: slot:initiative sits on BOTH failure classes — an unauthored
// reprobe (KNOWN_UNAUTHORED) and two dead pickSets (function, boundary_type).
// The function gate is the first pick an operator reaches, so Initiative is
// the worst entry point in the ladder.
//
// Same one-way rule as the other ledgers: it may only shrink.
const KNOWN_UNHANDLED_PICKSET_KINDS = [
  'declaredProjects', // deliverableSlot.js:39 (gate) + deliverableReprobes.js:29
  'declaredInitiatives', // projectSlot.js:52 (gate) + reprobes.js:135 — Item 1
  'projectBoundaryTypeOptions', // projectSlot.js:59 (gate) — Item 1
  'initiativeBoundaryTypeOptions', // initiativeSlot.ts:232 (gate) — Item 2
  'initiativeFunctionOptions', // initiativeReprobes.ts:156 — Item 2
  'artifactSatisfactionModeOptions', // artifactSlot.ts:93 (gate) + artifactReprobes.ts:69 — Item 3
  'boundaryTypeOptions', // reprobes.js:141, initiativeReprobes.ts:161 — reprobe side, loses to gate
];

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

  it('every declared pickSet kind is either implemented or on the debt ledger', () => {
    // Collect every kind the registry can hand to buildPickSet: gate-side
    // (which wins) and reprobe-side (which renders when the gate declares none).
    const declared = new Set();
    for (const slot of ALL_SLOTS) {
      for (const g of slot.gate) if (g?.pickSet) declared.add(g.pickSet);
    }
    for (const entry of Object.values(REPROBES)) {
      if (entry?.pickSet) declared.add(entry.pickSet);
    }

    const unaccounted = [...declared]
      .filter((kind) => !IMPLEMENTED_PICKSET_KINDS.includes(kind))
      .filter((kind) => !KNOWN_UNHANDLED_PICKSET_KINDS.includes(kind));

    expect(
      unaccounted,
      `pickSet kinds with no buildPickSet branch and no ledger entry: ${unaccounted.join(', ')}. ` +
        `Either implement the kind in elicitationEngine.buildPickSet() or the probe renders a ` +
        `false dependency gap.`
    ).toEqual([]);
  });

  it('the unhandled-kind ledger carries no stale entries', () => {
    // One-way rule enforcement in the other direction: once a kind is
    // implemented or its last declaration is deleted, its ledger line must go.
    const declared = new Set();
    for (const slot of ALL_SLOTS) {
      for (const g of slot.gate) if (g?.pickSet) declared.add(g.pickSet);
    }
    for (const entry of Object.values(REPROBES)) {
      if (entry?.pickSet) declared.add(entry.pickSet);
    }

    const stale = KNOWN_UNHANDLED_PICKSET_KINDS.filter(
      (kind) => IMPLEMENTED_PICKSET_KINDS.includes(kind) || !declared.has(kind)
    );
    expect(stale, `ledger entries that no longer describe a live gap: ${stale.join(', ')}`).toEqual(
      []
    );
  });

  // The System slot is the one this contract was written for. It carries no
  // exemptions, and must never acquire one.
  it('slot:system claims no entry in any debt ledger', () => {
    const systemCodes = SYSTEM_SLOT.gate.map((g) => g.code);
    for (const code of [...KNOWN_UNAUTHORED, ...KNOWN_PICKSET_DRIFT]) {
      expect(systemCodes, `${code} must not be exempted for slot:system`).not.toContain(code);
    }
    const systemKinds = SYSTEM_SLOT.gate.map((g) => g?.pickSet).filter(Boolean);
    for (const kind of systemKinds) {
      expect(
        KNOWN_UNHANDLED_PICKSET_KINDS,
        `slot:system declares ${kind}, which is on the unhandled-kind ledger`
      ).not.toContain(kind);
    }
  });
});
