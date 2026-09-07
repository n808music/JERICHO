# Entity-Formation Gate Question Defect

**Date:** 2026-08-26
**Status:** OPEN — identified 2026-08-26, not yet fixed in code
**Scope:** Shared elicitation pickSets whose option labels are specific to one consuming field

---

## Defect

The Structure survey's project-scoped legal-formation question asks a
**gating/prerequisite** question but renders **current-status** answer options.

Question — `src/domain/elicitation/reprobes.js:88-93`, gate code
`PROJECT_LEGAL_FORMATION_MISSING`:

> "Does this project require the owning entity to be legally formed (LLC,
> corporation, etc.) before work can proceed?"

Options — `src/domain/elicitation/elicitationEngine.js:177-185`, pickSet
`yesNoOptions`:

```js
{ id: true,  label: 'Yes, legally formed (registered)' }
{ id: false, label: 'No, not yet legally formed' }
```

Neither real answer to the question as written is representable:

- "No, formation is not a prerequisite — work can proceed regardless of entity
  status" has no option.
- "Yes, formation is required before work starts" — as a policy, independent of
  current status — has no option.

The operator is answering a status question while the engine records a gate
answer. `requiresLegalFormation` therefore carries undeclared meaning, and
`computeLegalFormationBarriers` presumes a gate that was never actually
evaluated.

Same defect class as the Contract Admission "measurable outcome" bug: a question
is asked whose options don't capture what the question claims to determine,
silently breaking downstream logic that presumes the gate was evaluated.

---

## Root cause — this is a label bug, not a schema bug

The gate field and the status field are **already correctly separated**. Both
exist, with distinct owners, gate codes, detects, and storage:

| | field | owner | gate code | declared at |
|---|---|---|---|---|
| Gate (prerequisite) | `requiresLegalFormation` | project | `PROJECT_LEGAL_FORMATION_MISSING` | `slots/projectSlot.js:53-58` |
| Status (current) | `legallyFormed` | entity | `ENTITY_LEGAL_STATUS_MISSING` | `entitySlot.ts:115-120` |

The downstream barrier rule is also already correct —
`src/state/identityCompute.js:16667-16678`:

```js
if (entity.legallyFormed === true) continue;          // 16670 — formed: no barrier
...
if (project.requiresLegalFormation !== true) continue; // 16678 — not a prerequisite: no barrier
```

So "if the gate answer is No, no formation blocking issue can be generated for
this Project" is **already implemented and live**. No schema change is required.

The single defect is that **one shared pickSet carries labels specific to one of
its two consumers**. `yesNoOptions` is generically named but its labels are
hardcoded to formation *status*, and it is consumed by both:

- `entitySlot.ts:119` → field `legallyFormed` (status) — labels correct
- `projectSlot.js:57` → field `requiresLegalFormation` (gate) — labels wrong

---

## Fix

1. Add a dedicated pickSet in `elicitationEngine.js` — e.g.
   `legalFormationPrerequisiteOptions`:
   - `{ id: true,  label: 'Yes — required before work starts' }`
   - `{ id: false, label: 'No — work can proceed regardless of formation status' }`
2. Point `projectSlot.js:57` and `reprobes.js:91` at the new pickSet. Leave
   `entitySlot.ts:119` on `yesNoOptions` (its labels are correct for status), or
   rename that pickSet to `legalFormationStatusOptions` so neither name implies
   general reuse.
3. Add a test pinning gate-vs-status label separation, so a future shared-pickSet
   edit cannot silently re-conflate them. Precedent for enforcement-by-test:
   `src/domain/masterGrid/disclosureStandardGates.test.js`.

No change to `requiresLegalFormation`, `legallyFormed`, or
`computeLegalFormationBarriers`.

---

## Audit scope

The generator of this bug class is **a reusable pickSet carrying
question-specific labels**, so the audit targets shared pickSet consumers rather
than question text generally:

- Enumerate every consumer of `yesNoOptions` and confirm each one's field means
  what the labels say.
- Apply the same check to the other shared pickSets in `elicitationEngine.js`
  (`formationStateOptions`, `initiativeOwnerOptions`, role-tag sets).
- `entityReprobes.ts:119` ("Is this entity formally registered? (LLC,
  corporation, other legal entity)") is a third phrasing of the status question
  — confirm it binds to `legallyFormed` and not to a gate field.

Do not treat this item as resolved until that audit is done.

---

## Note on cited precedents

Two standards referenced when this defect was raised are **not** established in
this repo, and should not be cited as binding until they are:

- **Action-Over-Metrics** — appears once across the repo, in
  `.remember/today-2026-08-26.md`, the rolling session buffer. The
  `successMetric` → `description` rename landed; the doctrine note was never
  written.
- **Internal Meaning Standard** — one passing mention, in
  `docs/superpowers/specs/2026-08-23-e15-phase-assignment-rule.md:48`.

Established standards in this repo are enforced by tests and cited at the point
of enforcement — see **Disclosure Standard**
(`src/domain/masterGrid/disclosureStandardGates.test.js`) and **Attestation
Contract** (`src/domain/product/resolveBlockPlainLanguage.attestationContract.test.js`).
Both patterns are the bar for "locked in doctrine."
