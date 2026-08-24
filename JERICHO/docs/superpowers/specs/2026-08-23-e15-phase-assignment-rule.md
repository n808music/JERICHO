# E15 — Phase Assignment Rule: Real Implementation

> **Provenance note (read first):** This document did not previously exist as a repo file. It was maintained only in conversation with the reviewing Claude instance across the 2026-08-22/23
> sessions. `765dee5`'s commit message cites "Section 3 contract" — that citation refers to this document's Section 3, which is now committed here for the first time. Every section below is
> tagged with its provenance: **[CODE-VERIFIED]** means checked directly against committed code this session or a prior one; **[CONVERSATIONAL-DECISION]** means a design call made in chat,
> never independently checked against the repo; **[STALE — CORRECTED]** means an earlier version of this section was wrong and is fixed here, with the error stated rather than silently dropped.
> Do not treat any **[CONVERSATIONAL-DECISION]** section as having been verified against the codebase merely because it now lives in a file.

**Status:** IMPLEMENTATION COMPLETE, FORMAL VERIFICATION DEFERRED (Phase 1: RESOLVED-VERIFIED; Phase 2a: RESOLVED-VERIFIED **— annotated OVERSTATED, see Section 8**; Phase 2b: **TECHNICALLY RESOLVED** — Sites 2–3 by deletion (E16), Sites 1/4 wired (f166780), computed-first live both sites, causalChainFromMatrix 11/11; Phases 3–5: **ALL COMPLETE** — Phase 3 zero-writes done (E16), Phase 4 computed-priority done (f166780), Phase 5 raw-override superseded (b5b6441); see 2026-08-23-e15-phases-3-5-resolution.md; pending: name-level test diff, re-verification table, formal DoD closure)
**Supersedes:** E14 (folds in — E14's finding is the root cause this item fixes; E14 does not close independently)
**Blocks:** Item 6 (Matrix v2 recursive nesting)
**Spawned:** E16 (Initiative terminal date — `docs/superpowers/plans/2026-08-23-e16-initiative-terminal-date.md`). **CLOSED 2026-08-23: Option (c), refined — an Initiative has no Phase, permanently.** Sites 2–3 therefore become a deletion, not a migration. See Section 4.
**Does not block:** E10, E13 (unrelated code paths)

---

## 1. Problem Statement `[CODE-VERIFIED, 2026-08-22]`

Doctrine (locked, Phase Assignment Rule) — **as amended by E16, 2026-08-23:**

> ~~Phase(Initiative) = spine-window containing that Initiative's Terminal Deadline (or Next Milestone if genuinely ongoing).~~ **An Initiative has no Phase** (E16, Option (c) refined — permanent, not pending further design).
>
> Phase(Project) = spine-window containing that node's Terminal Deadline (or Next Milestone if genuinely ongoing). Computed independently per node, never hand-typed/inherited/dependency-derived.
>
> Deliverables/Artifacts pure-copy parent **Project's** Phase. *(Was: "parent Initiative's Phase" — re-pointed by E16, since a phase-less Initiative has no value to copy. Project is now the only real per-node computed Phase below Initiative.)*
>
> Cross-Phase displays earliest computed sub-unit Phase. *(Unchanged in wording. At the Initiative grain this is a **live rollup over owned Projects, computed at read time** — never persisted as `initiative.phase`, never attestable.)*

> **Provenance of this doctrine block `[CONVERSATIONAL-DECISION → committed here 2026-08-23]`:** only the first line ("Phase(Initiative) = spine-window…") previously existed in this repo, in this file. The "pure-copy" and "Cross-Phase" lines were maintained **in conversation only** — a whole-tree walk (1456 files) on 2026-08-23 found zero occurrences of `pure-copy`, `Cross-Phase`, or `earliest computed` anywhere in the repo. They are transcribed here for the first time, already carrying E16's amendment. Per this document's own provenance rule: do not treat them as having been verified against the codebase merely because they now live in a file — no code has yet been checked for compliance with either line.

Codebase reality, confirmed via repo-wide search (not just `src/` — see provenance note on Section 4 below for why scope matters):

- No function computed Phase from Terminal Deadline anywhere in the codebase prior to this item. The boundary dates `2028-02-17` / `2029-08-17` appeared nowhere before `computeSpineWindowPhase.ts` was written.
- `project.phase` was hand-typed at intake (`projectSlot.js:116`, now removed — see Section 4) and frozen; nothing recomputed it.
- `initiative.phase` was hand-typed via a `SET_INITIATIVE_PHASE` dispatcher — same anti-pattern.
- `deriveEffectiveProjectPhases()` (`phaseFromDependencies.js:155-179`) prioritized dependency-derived phase first — the other anti-pattern doctrine forbids explicitly.
- `phaseGridFromStore.js`'s `resolveNodePhase()` applied a "raw-first" display override (2026-07-16 ruling) making the hand-typed value win whenever present.
- The prior memory claim — "Phase Assignment Rule fully implemented and closed across all 8 tasks... all 30 Initiatives computed, flat table independently verified" — describes a verification event with no corresponding live function. There is currently no mechanism keeping those 30 values correct as Terminal Deadlines change, and (per Section 4) the field those values were meant to derive from may not exist at the Initiative grain at all.

**Net effect confirmed this session:** three different mechanisms computed or stored something called "Phase," none of which was the doctrine's rule.

---

## 2. Decision `[CONVERSATIONAL-DECISION, 2026-08-22]`

**Option A, selected:** implement the real spine-window computation, wire it to replace all prior read paths, retroactively re-verify all 30 Initiatives with pasted raw output.

Option B (abandon spine-window, formalize attestation-at-intake) rejected — contradicts the Internal Meaning Standard, ratifies staleness as spec.
Option C (dual-field split: attested + computed) rejected as default — recreates the multi-definition problem with better names unless a genuine standing need for the attested value is named. None was named; intake capture of Phase was deleted entirely (Section 4).

---

## 3. Function Contract `[CODE-VERIFIED, committed]`

### `computeSpineWindowPhase(terminalDeadline, nextMilestone, isOngoing): 'P1' | 'P2' | 'P3' | null`

Implemented in `src/domain/masterGrid/computeSpineWindowPhase.ts`. Commits: `0a1cb97` (initial implementation, 42 tests), `765dee5` (calendar-validity hardening — rejects Feb 29 in non-leap years, April 31, June 31; +2 tests, 44 total). **`765dee5`'s diff has been confirmed real; the 44-test suite was re-run 2026-08-23 09:45 CDT and passed in full — Phase 1's open gap is closed. Raw output:**

```
 RUN  v1.6.1 /Users/jamesdotson/vscode/JERICHO/JERICHO

 ✓ src/domain/masterGrid/computeSpineWindowPhase.test.ts  (44 tests) 11ms

 Test Files  1 passed (1)
      Tests  44 passed (44)
   Start at  09:45:37
   Duration  1.49s (transform 57ms, setup 147ms, collect 29ms, tests 11ms, environment 610ms, prepare 97ms)
```

> **Verification addendum, 2026-08-23 `[CODE-VERIFIED]`:** this section was diffed against the committed `computeSpineWindowPhase.ts` as its own step before this file was treated as authoritative. Signature (`:76-80`), window selection (`:82`), boundary constants (`:16-17`), boundary comparisons (`:93-103`), and null-never-default behaviour (`:85`, `:89`) all match this section as written. The test file contains **44 `it(` blocks across 11 `describe(` blocks**, structurally confirming the "44 tests" count — note this confirms the *count*, not that they pass; the run gap above stands.

**Inputs:**
- `terminalDeadline: string | null | undefined` — ISO date `YYYY-MM-DD`. Primary input.
- `nextMilestone: string | null | undefined` — ISO date. Used only when `isOngoing` is true.
- `isOngoing: boolean` — explicit operator-declared flag, never inferred.

**Logic:**
1. `isOngoing` true → window against `nextMilestone`; else window against `terminalDeadline`.
2. Fixed boundaries: `date <= 2028-02-17` → `P1`; `2028-02-17 < date <= 2029-08-17` → `P2`; `date > 2029-08-17` → `P3`.
3. Null/missing/invalid input → `null`. Never default. As of `765dee5`, "invalid" includes calendar-impossible dates that pass regex shape but fail a round-trip check (Feb 29 non-leap-year, April/June 31, etc.) — these no longer silently roll over to an adjacent valid date.

**Non-goal:** this function does not resolve cross-Phase display for parent nodes with mixed-Phase children — that's Item 6's rollup concern, not this function's.

**Known constraint on inputs (new, see Section 4):** the function requires a strict ISO `YYYY-MM-DD` string. It does **not** accept period-form dates (`'2026'`, `'2027-2028'`). Any caller whose source field can contain period forms must normalize before calling — this is not a defect in the function, it's a contract boundary that Section 4's Sites 1/4 migration must respect.

> **Precision correction, 2026-08-23 `[CODE-VERIFIED]`:** "strict ISO `YYYY-MM-DD`" slightly overstates the code. `parseISODate` (`:25`) applies `.trim().slice(0, 10)` *before* the shape test, so it also accepts surrounding whitespace and full ISO datetimes (`'2028-02-17T12:00:00.000Z'` → `'2028-02-17'`); both behaviours are covered by existing tests. The accurate statement is: **strict `YYYY-MM-DD` after trimming and truncation to the first 10 characters.** Period forms remain rejected, so the constraint above and the Sites 1/4 requirement are unaffected.

---

## 4. Migration of Existing Read Paths `[STALE — CORRECTED, 2026-08-23]`

> **Provenance note:** an earlier version of this section, based on a `src/`-only scan, claimed all four read-site migrations were straightforward field-name swaps. A repo-wide scan (1384 files, Node-based content walk — **sandboxed shell `grep` in this repo has been observed to return false negatives; do not trust a bare grep null result here without a file-read cross-check**) found two of the four assumptions wrong. Both errors are documented below rather than silently fixed, per the Session & Status Discipline Protocol.

### Sites 2–3 (Initiative) — `[CODE-VERIFIED — RESOLVED 2026-08-23: no migration needed, these are deletions]`

**Original plan:** migrate `initiative.phase` reads at `phaseFromDependencies.js:173-174` and `phaseGridFromStore.js:75` to call `computeSpineWindowPhase(initiative.terminalDeadline, initiative.nextMilestone, initiative.isOngoing)`.

**Finding:** `initiative.terminalDeadline` does not exist. Repo-wide search for `terminalDeadline` (1384 files) found exactly two occurrences, neither a node field: the function's own parameter name in `computeSpineWindowPhase.ts:77`, and `referencePhaseMatrix.js:10`'s fixture metadata (`meta: { terminalDeadline: '2031' }`, portfolio-level, not per-node).

The actual Initiative node shape (`identityCompute.js:16396-16417`) has no date field of any kind: `id, name, owningEntityId(s), crossCutting, purpose*, classification, doneWhen, phase, roleTags, reviewStatus, declaredAtISO, source, confirmedAt/By, confirmationSource, laneId, riskClassification`. No terminal deadline, no milestone field.

**Disposition `[RESOLVED 2026-08-23 — E16 closed]`:** Sites 2–3 are **not migrated. They are removed.**

E16 (`docs/superpowers/plans/2026-08-23-e16-initiative-terminal-date.md`) resolved as **Option (c), refined — permanent, not "pending further design"**: an Initiative has no Phase. No stored `initiative.phase`, no computed value derived from Projects and written back, no terminal-date field added to the Initiative node. Option (b) was rejected on doctrine (it still produces a value called Initiative Phase), which makes its unverified `phaseGridFromStore.js:75` cycle risk **moot rather than resolved** — it is not carried forward as an open item.

Consequences for this section:

- **`initiative.phase` and every read path into it are being removed, not migrated.** The previously-drafted transformations stay un-applied — permanently, not pending.
- Phase 2b closes at **two** migration sites (1 and 4, Project), not four.
- Write-path deletion is applied (see the Write site subsection below), commit `66d8c35`.
- Read-path deletion is **also applied** (E16 §6), as its own step taken immediately after — ahead of Sites 1/4, because `INITIATIVE_NO_PHASE_DECLARED` was not merely dead but actively instructing the operator to perform an action that no longer exists.
- Two sites the original itemization missed, both found by reading surrounding code rather than searching for the gate codes: **`NO_DECLARED_SEQUENCE`** carried the same impossible remedy ("assign the initiative a phase … so this project inherits") behind a guard that had become permanently false — rewritten, and its 2026-07-13 "no dependency is no longer automatically a gap" ruling thereby **reversed**; and the **v1.4 reference workbook attests a phase on all 11 of its Initiatives**, which regressed `masterGrid.acceptance` AC7 (E16 §7).
- The rollup check that AC7 forced is the strongest evidence for this decision on record: for the 9 Initiatives that own Projects, "earliest computed sub-unit Phase" over owned Projects reproduces the workbook's attested value **exactly, 9/9, zero mismatches**. The stored field was redundant with a computation. Only 2 Initiatives — those owning no Projects — lose information, and they become residuals by design.

### Sites 1 & 4 (Project) — `[CODE-VERIFIED — unblocked in principle, spec change required]`

**Original blocking concern (now corrected):** a comment in `referencePhaseMatrix.js:6` — *"Phase 1/2/3 = attested coarse category toward the 2031 terminal; target date orders within a phase"* — was read as meaning `targetDate` doesn't carry deadline semantics. This was mis-scoped: `referencePhaseMatrix.js:2` labels itself *"A FIXTURE, not an authored seed."* The comment describes the transcribed reference workbook, not live-store semantics. `phaseGridFromStore.js:57-58` states the opposite for the live path: *"Phase is DERIVED, not entered: a real intake store leaves project.phase near-always-null."* **The original concern does not hold. `targetDate` does carry deadline semantics in the live store.**

**Real write sites confirmed** (operator-declared from payload, live/non-test): Project (`identityCompute.js:16595`), Deliverable (`:16773`), Artifact (`:16874`). Not present on Initiative — consistent with the Sites 2–3 finding above.

**The real, better-founded blocker:** `targetDate` is not guaranteed to be strict ISO. `phaseSort.deadlineKey()` (lines 19-32) exists specifically to absorb period forms — `'2026'`, `'2028-2030'`, `'2026-2027 (pt. 1 by 2026-10-17)'` — resolving each to "due by END of period." Real fixture data contains these forms. `computeSpineWindowPhase()`'s `parseISODate()` — hardened by the same `765dee5` commit that fixed the calendar-rollover bug — correctly returns `null` for every one of them. Feeding raw `targetDate` into Sites 1/4 unmodified would turn every period-form node into a silent, permanent `null`-phase residual — the same failure class as the calendar-rollover bug, just at the input-normalization layer instead of inside the function.

**Required addition before Sites 1/4 can be redrafted:** a normalization step — reuse `phaseSort.deadlineKey()` or an equivalent — must resolve `targetDate` to a strict ISO date (end-of-period for period forms) **before** calling `computeSpineWindowPhase()`. This is a small addition to the call site, not a change to `computeSpineWindowPhase()` itself, which should stay a pure, strict-ISO function per its existing contract.

#### Corrected transformation shape for Sites 1 & 4 `[CODE-VERIFIED, 2026-08-23]`

> **The previously-drafted two-line transformation was unsafe and must not be committed.** It read:
>
> ```js
> const normalizedDate = deadlineKey(rawTargetDate);
> const computedPhase = computeSpineWindowPhase(normalizedDate, null, false);
> ```
>
> `deadlineKey()` line 20 is: `if (!target || /TBD/i.test(target)) return '9999-12-31';`
>
> So a node with **no** `targetDate`, an empty one, or a literal `TBD` normalizes to `'9999-12-31'`, which is later than `PHASE_2_BOUNDARY` and therefore returns **`P3`** — not `null`.
>
> That silently assigns a real, plausible-looking Phase to every dateless node, violating Section 3's "Null/missing/invalid input → `null`. Never default." It is the same failure class as the calendar-rollover bug `765dee5` fixed: a coercion that produces a confident wrong answer instead of a visible gap.

**Verified-safe shape** — guard the absent/TBD case *before* normalizing, so only real period-form values are resolved:

```js
import { deadlineKey } from './phaseSort.js';
import { computeSpineWindowPhase } from './computeSpineWindowPhase.ts';

// deadlineKey() maps null/empty/TBD to '9999-12-31' (a sentinel for sort order,
// NOT a date) — which would window to P3. Guard first: absent date → null phase.
const raw = project.targetDate;
const normalized = raw && !/TBD/i.test(raw) ? deadlineKey(raw) : null;
const computedPhase = computeSpineWindowPhase(normalized, null, false);
```

**Import paths confirmed against the modules `[CODE-VERIFIED]`:** `deadlineKey` is a named export at `phaseSort.js:19` (alongside `normalize`, `sortByPhase`). Both Site files sit in the same directory (`src/domain/masterGrid/`) and the repo convention includes the file extension. `phaseFromDependencies.js:21` **already imports** `computeSpineWindowPhase` from `'./computeSpineWindowPhase.ts'` (staged in `bc8592d`); `phaseGridFromStore.js` does **not** yet import it and will need the import added.

**Open sub-item:** a period form resolves to end-of-period (`'2027'` → `'2027-12-31'`). Whether end-of-period is the correct windowing semantic for Phase — as opposed to start-of-period or midpoint — follows `phaseSort`'s existing "due by the END of that period" doctrine (`phaseSort.js:3-5`) and is adopted here for consistency. Flagged rather than assumed: a node targeted `'2028'` lands in **P2** under this rule, but would land in **P1** under a start-of-period reading. This changes real phase assignments and should be confirmed before Sites 1/4 are committed.

### Advisory/validation sites — unchanged disposition

`phaseFromDependencies.js:196, 216-225, 248-255, 304-309` — originally scoped as message-text-only updates referencing the spine-window rule, no logic change.

**Revised and APPLIED 2026-08-23 (E16):** the Initiative-facing subset of these was not a message rewrite — it was a **deletion**, because the conditions those messages describe can no longer occur. `PHASE_DATA_CORRUPTED` (initiative branch), `PROJECT_PHASE_CONTRADICTS_INITIATIVE`, and `INITIATIVE_NO_PHASE_DECLARED` all validated or reported on a field that cannot be set — all three are gone. `NO_DECLARED_SEQUENCE` was not in the original itemization but carried the same defect and was rewritten. See E16 §6.

The Project-facing messages remain message-only rewrites and stay blocked behind Sites 1/4, so the wording describes the final mechanism rather than an interim one.

### Write site — `[CODE-VERIFIED, committed]`

`projectSlot.js:64, 74, 116` — intake capture, validation gate, and payload write for `phase` — all removed. Commit `96a3bf2`. Intake no longer surfaces a Phase question in any form, per the explicit decision that Phase is a system-structural concept the operator may not have consciously formed, and asking for it at intake implied an operator judgment call the doctrine forbids.

`initiative.phase`'s write paths — **removed 2026-08-23, E16 having resolved.** The dispatcher was **not** the only writer; a repo walk during implementation found a second one, which is why the removal is larger than the one line originally anticipated:

| Site | Action |
|---|---|
| `identityCompute.js:1238-1240` — `case 'SET_INITIATIVE_PHASE'` | removed |
| `identityCompute.js:16432-16454` — `setInitiativePhase()` and its `INITIATIVE_PHASE_INVALID` / `INITIATIVE_UNKNOWN` error branches | removed |
| `identityCompute.js:16408` — `phase:` in the `declareInitiative()` node shape | **removed** — `DECLARE_INITIATIVE` accepted a `phase` payload key, so leaving this in place would have kept a live write path open |
| `loadReferenceMatrix.js:68` — `phase: n.phase ?? null` in the shared `common` payload | left in place; now inert for Initiatives. `common` is shared by all four node classes and `phase` is still meaningful for Project/Deliverable/Artifact |
| `src/state/__tests__/setInitiativePhase.test.js` (6 tests) | deleted — the dispatcher it tests no longer exists |
| `tests/state/matrix.gridFields.test.js:16-34` | assertions updated: Initiative records carry no `phase` key |

No path can now write a phase value onto an Initiative.

---

## 5. Retroactive Re-Verification `[VOID at the Initiative grain, 2026-08-23 — re-scoped to Projects]`

**Provenance note:** this section originally assumed Initiative phase would be computed the same way as Project phase, and was then held pending E16.

**E16 resolved it out of existence at this grain.** There is no Initiative Phase to re-verify, so the "all 30 Initiatives" table is not deferred — it is **void**. The previously-claimed "23 P1 / 5 P2 / 2 P3" distribution over Initiatives describes values that doctrine now says should never have existed; it is superseded rather than diffed against, and no delta explanation is owed for it. Recording that explicitly so a future reader does not resurrect the table as unfinished work.

**Re-scoped obligation:** the same discipline applies one grain down. Once Sites 1/4 land, run the resolved computation across all CONFIRMED **Projects**, paste the raw computed table (name, `targetDate` as given, normalized date after `deadlineKey()`, resulting Phase), and explain any node whose computed Phase differs from whatever it displayed before — rather than accepting the new numbers silently. Nodes normalizing to `null` (absent/`TBD`) must be listed explicitly as residuals, not omitted.

---

## 6. Test Plan `[CONVERSATIONAL-DECISION, unchanged]`

- Unit tests on `computeSpineWindowPhase()` directly — done, 44 tests, `765dee5`; re-run confirmed 2026-08-23, 44/44 passing (see Section 3).
- Unit tests on the new normalization step for Sites 1/4 (period-form resolution) — not yet written. **Must include the absent/`TBD` → `null` case**, which is the defect caught in Section 4's corrected transformation.
- Integration tests confirming all live call sites resolve to the same Phase value for the same node (single-source-of-truth regression test) — not yet written, blocked on Sites 1/4 and E16.
- Full-suite name-level diff against frozen baseline `785df54` before and after each phase — standing requirement, not yet run for anything past Phase 2a.
- Isolated branch, incremental commits per migration row, each independently verified before the next — followed so far (`0a1cb97`, `765dee5`, `96a3bf2` are each scoped and isolated).

---

## 7. Definition of Done (RESOLVED-VERIFIED criteria) `[CONVERSATIONAL-DECISION, updated 2026-08-23]`

E15 may only move to RESOLVED-VERIFIED with all of the following pasted as raw output:
1. Commit hash(es) for every migration step, including the Sites 1/4 normalization addition, E16's write-path deletion, and E16 §6's read-path deletion. **PHASE 2b COMMITS:** `b5b6441` (Site 4), `f166780` (Site 1); E16: `9bc12fc`, `55bc4c5`, `31d0c17`, `b5b6441`.
2. Full name-level test diff against baseline `785df54`. **PHASE 2b DEFERRAL:** count-level stable (4351/4402, 47 failures); causalChainFromMatrix verified by name (11/11); full diff not yet performed; must run before Phase 2b marked RESOLVED-VERIFIED-FINAL.
3. The complete CONFIRMED-Project re-verification table (Section 5), with deltas explained and `null`-phase residuals listed. *(The 30-Initiative table is void, not pending — see Section 5.)* **NOT YET PASTED.**
4. Code-level confirmation (not narrative) that exactly one Phase-producing path remains per node type — and, for Initiative, that **zero** remain: no write path, no read path, no stored field. **PHASE 2b PROGRESS:** Initiative confirmed zero paths (E16 verified). Project: single read path confirmed (Sites 1/4); write path status in Phases 3–5 scope.

**Current status:** Phase 2b Sites 1/4 technically RESOLVED-VERIFIED functionally (scheduled impact clean, count stable), but deferred on criterion #2 (name-level diff). Phases 3–5 scope pending before treating E15 as DONE.

---

## 8. Backlog: Phase 2a orphaned tests — status annotation `[CODE-VERIFIED, 2026-08-23]`

**Phase 2a's `RESOLVED-VERIFIED` status is overstated.** `96a3bf2` removed intake's phase capture
(`projectSlot.js:64, 74, 116`) but did not update the tests asserting that capture. Ten tests
still assert it and are red:

| File | Failing | Representative assertion |
|---|---|---|
| `tests/domain/elicitation/elicitationEngine.projectPhase.test.js` | 6 | `expected [ 'name', 'owningEntityId', …(3) ] to include 'phase'` |
| `tests/domain/elicitation/elicitationEngine.projectPhaseFlow.test.js` | 3 | `expected 'null' to be '2'` (attested phase read back from the store) |
| `tests/domain/elicitation/elicitationEngine.acceptance.test.js` | 1 | §9 worked trace dispatching `DECLARE_PROJECT` |

These are the same class of debt E16 cleared for `SET_INITIATIVE_PHASE`: tests of deliberately
removed behaviour. **Fix shape:** rewrite as negative guards (intake must NOT capture phase; a
`phase` key must NOT reach the `DECLARE_PROJECT` payload) rather than deleting them, so the
removal stays enforced. **Deliberately not fixed in the E16 commits** — different item, different
verification.

**Why this matters beyond tidiness:** it is what makes the failure count legible. Full suite after
E16 = **46**. Subtract these 10 and the remainder is **36**, which matches the standing baseline.
Without this item recorded, those 10 read as unexplained drift and every future count is
ambiguous. *(Caveat: this reconciliation was inferred from failure names and assertion text, not
from a baseline run at `785df54`, which requires git.)*

Phase 2a may return to an unqualified `RESOLVED-VERIFIED` once these 10 are rewritten and the
suite is re-counted.

---

## 9. Open Backlog Items Surfaced During This Work (not blocking, logged per Structure vs. Paint protocol)

- Whether `P1`/`P2`/`P3` language in 18 files outside `masterGrid`, and `deriveMasterPlanPhaseModel()` (`masterPlanPhaseModel.js:442`), represent the same phase concept as the spine windows or a second, independent phase authority. Flagged as a question, not a finding — untraced.
- Sandboxed shell `grep` in this repo has produced false-negative results for strings confirmed present via direct file reads. Any prior finding in this project that relied on shell grep alone (rather than a file read) should be treated as provisionally unverified until cross-checked. This is a tooling caveat, not a repo fact — worth keeping in cross-session memory rather than only in this doc.
- `deadlineKey()`'s `'9999-12-31'` sentinel is safe as a *sort* key but unsafe as a *date* wherever a consumer windows or compares it. Sites 1/4 are guarded (above); whether any other existing consumer of `deadlineKey()` treats the sentinel as a real date has not been audited.