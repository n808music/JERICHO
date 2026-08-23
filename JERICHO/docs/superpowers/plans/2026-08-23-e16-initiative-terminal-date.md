# E16 — Initiative Terminal Date: Add Field vs. Derive From Projects

**Status:** RESOLVED — Option (c), refined. Decision recorded 2026-08-23; write-path deletion applied same day (see §5). Read-path deletion is a defined follow-up, not yet applied (§6).
**Opened:** 2026-08-23
**Resolves:** E15 Phase 2b, read-sites 2–3 — *by deletion, not migration*
**Does not block:** E15 Phase 2b sites 1/4 (Project), which have a separate prerequisite

---

## 1. Why this exists

E15 Phase 2b planned four read-site migrations to `computeSpineWindowPhase()`.
Sites 2–3 were drafted against `initiative.terminalDeadline`.

**That field does not exist.** A whole-tree scan (523 source files under `src/`,
1384 files repo-wide) found `terminalDeadline` in exactly two places, neither of
them a node field:

| Location | What it actually is |
|---|---|
| `src/domain/masterGrid/computeSpineWindowPhase.ts:77` | The function's own **parameter name** |
| `src/domain/masterGrid/referencePhaseMatrix.js:10` | `meta: { terminalDeadline: '2031' }` — **fixture metadata**, portfolio-level, bare-year string |

`frontend/` contains zero references to `terminalDeadline` or `initiativesById`;
the matrix lives only under `src/`.

Had sites 2–3 been applied, they would have read `undefined` and returned `null`
phase permanently — a silent, always-on residual with no error surface.

## 2. The actual Initiative node shape

`src/state/identityCompute.js:16396–16417` — the sole Initiative construction site:

```
id, name, owningEntityId, owningEntityIds, crossCutting, purpose,
purposeFor, purposeCompletion, purposeOngoing, classification, doneWhen,
phase, roleTags, reviewStatus, declaredAtISO, source, confirmedAt,
confirmedBy, confirmationSource, laneId, riskClassification
```

**No date field of any kind.** By contrast, `targetDate` is a real per-node,
operator-declared field on the three sibling classes:

- Project — `identityCompute.js:16595`
- Deliverable — `identityCompute.js:16773`
- Artifact — `identityCompute.js:16874`

Initiative is the only one of the four without a date.

## 3. The options as posed

### Option A — Add a terminal date field to the Initiative node

Give Initiative a real date field, populated at declaration like its siblings.

- **For:** Makes Initiative symmetric with Project/Deliverable/Artifact. Gives
  `computeSpineWindowPhase()` the per-node terminal date its signature asks for
  (`@param terminalDeadline — ISO date string of the node's terminal date`,
  `computeSpineWindowPhase.ts:63`).
- **Against:** New required-ish intake surface. E15 Phase 2a just *removed* phase
  elicitation from intake; adding a date question re-opens intake scope, which
  needs to be a deliberate call rather than a side effect of a migration.
- **Open:** Is it operator-declared, or inherited from the portfolio terminal?

### Option B — Derive Initiative phase from its owned Projects

Roll up from the Projects an Initiative owns (max/latest `targetDate`, or an
existing phase rollup).

- **For:** No intake change. Consistent with the live-store doctrine that phase is
  derived — `phaseGridFromStore.js:57–58`: *"Phase is DERIVED, not entered: a real
  intake store leaves project.phase near-always-null and expresses order through
  dependency edges."*
- **Against — CYCLE RISK (flagged, unverified):** `phaseGridFromStore.js:75` already
  resolves a **Project's** phase by falling back to
  `initiatives[node.owningInitiativeId]?.phase`. Deriving Initiative phase *from*
  Projects runs that dependency in the opposite direction. Whether this closes a
  real cycle depends on resolution order and has **not** been traced — it must be
  before Option B is chosen.

### Option C — Leave Initiative unphased

Accept `null` phase for Initiatives; they surface as residual by design.

- **For:** No new field, no cycle risk. Consistent with "no signal anywhere → null →
  residual (a legitimate unknown, surfaced as a question)"
  (`phaseGridFromStore.js:62–63`).
- **Against:** Sites 2–3 then have nothing to migrate — E15 Phase 2b closes at two
  sites, not four, and the spec should say so explicitly rather than leaving them
  listed as pending.

---

## 4. Decision `[DOCTRINE-DECISION, 2026-08-23]`

**Option (c), refined — and permanent, not "pending further design."**

> **An Initiative has no Phase.** No stored `initiative.phase` field. No computed
> value derived from Projects and written back. No terminal-date field added to the
> Initiative node. Initiative is structurally phase-less.

Three clauses follow from it:

1. **No write path.** Nothing may set a phase value on an Initiative — not a
   dispatcher, not a declaration payload, not a fixture loader. A hand-set
   Initiative phase is the exact anti-pattern this whole item exists to remove;
   giving Initiative an inferred-or-settable phase would recreate the attestation
   path one grain up the tree.
2. **Children copy their parent Project, not their Initiative.** With Initiative
   phase-less, "pure-copy parent Initiative's Phase" has no source to copy from.
   Deliverables/Artifacts copy their parent **Project's** Phase — now the only
   real per-node computed value below Initiative.
3. **Initiative-level Phase display is a live rollup, never a value.** An
   Initiative may still *show* an aggregate (earliest computed sub-unit Phase) over
   the Projects it owns, computed at read time. That aggregate is never persisted,
   never stored as `initiative.phase`, and never attestable. This is the same
   shape Item 6 must adopt for aggregation generally — drill-down, never a stored
   terminal value — applied one level earlier.

**Why not A:** re-opens the intake surface E15 Phase 2a just closed, and the
"operator-declared vs. inherited" question was never answered.

**Why not B:** the cycle risk against `phaseGridFromStore.js:75` remains untraced,
and — more decisively — B still produces a value called Initiative Phase, which
clause 1 rejects on doctrine grounds regardless of whether the cycle is real. The
cycle question is therefore **moot, not resolved**; it is not carried forward as
an open item.

## 5. Consequences applied `[CODE-VERIFIED, 2026-08-23]`

Write-path closure. Removing the dispatcher alone was **not** sufficient — a
second write path was found during implementation:

| Site | Action |
|---|---|
| `identityCompute.js:1238-1240` — `case 'SET_INITIATIVE_PHASE'` | removed |
| `identityCompute.js:16432-16454` — `setInitiativePhase()` + its `INITIATIVE_PHASE_INVALID` / `INITIATIVE_UNKNOWN` errors | removed |
| `identityCompute.js:16408` — `phase:` in the `declareInitiative()` node shape | **removed** — `DECLARE_INITIATIVE` accepted a `phase` payload key, so the dispatcher was not the only writer |
| `loadReferenceMatrix.js:68` — `phase: n.phase ?? null` in the shared `common` payload | left in place; now inert for Initiatives (still meaningful for Project/Deliverable/Artifact, which share `common`) |
| `src/state/__tests__/setInitiativePhase.test.js` (6 tests) | deleted — tests a removed dispatcher |
| `tests/state/matrix.gridFields.test.js:16-34` | assertions updated: Initiative records carry no `phase` key |

## 6. Follow-up: read-path deletion (defined, not yet applied)

`initiative.phase` reads still exist and are now permanently unreachable-or-wrong.
They are a **deletion**, and deliberately not bundled into the write-path commit —
they change advisory output and touch five test files, so they need their own
verified step:

| Read site | Disposition |
|---|---|
| `phaseFromDependencies.js:173-176` — `deriveEffectiveProjectPhases()` tier 3 (initiative fallback) | delete the tier; two tiers remain (dependency-derived, then project's own) |
| `phaseGridFromStore.js:75` — `initiatives[...]?.phase` display fallback | delete the fallback rung |
| `phaseFromDependencies.js:245-263` — Gate 3 `PHASE_DATA_CORRUPTED` on initiative phase | delete — validates a field that cannot be set |
| `phaseFromDependencies.js:265-277` — `PROJECT_PHASE_CONTRADICTS_INITIATIVE` | delete — there is no Initiative phase to contradict |
| `phaseFromDependencies.js:295-313` — `INITIATIVE_NO_PHASE_DECLARED` | delete — **actively wrong now**: it instructs the operator to "Set phase to 1/2/3" on an Initiative, an action that no longer exists. This is the highest-priority item in this table. |

Test files affected: `phaseFromDependencies.test.js`, `disclosureStandardGates.test.js`,
`MasterGridTab.test.jsx`, `phaseGridFromStore.test.js`, plus `causalChainFromMatrix.js`'s
doc comment (`:32`) and `phaseFromDependencies.js`'s tier-list comment (`:135-151`),
both of which still describe `SET_INITIATIVE_PHASE` as a live mechanism.

## 7. Exit criteria

- [x] Decide A, B, or C. → **(c), refined** (§4)
- [x] ~~If B: trace the `phaseGridFromStore.js:75` fallback direction and prove no cycle.~~ Moot — B rejected on doctrine, not on the cycle question.
- [x] Update the E15 spec to reflect the chosen path for sites 2–3. → Sites 2–3 disposition rewritten from *hard blocked* to *resolved: deletion, no migration*.
- [x] Unblock E15 Phase 2b sites 2–3. → Unblocked as deletions (§6). Sites 1/4 remain the only migration work in Phase 2b.

## 8. Provenance

§§1–3 findings verified 2026-08-23 by Node filesystem walks reading file contents
directly. Sandboxed `ctx_execute(language:"shell")` grep was found to return
false negatives for strings that demonstrably exist in this repo and was **not**
used as evidence for any claim in this document. §§5–6 site tables were produced
the same way (1454-file walk) and each line/range was confirmed by direct file
read before being listed.
