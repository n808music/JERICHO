# Bug A — Live Migration Spec: Deliverables & Artifacts into `state_blob`

**Status:** DRAFT — for n8 review and approval. No code changed, no DB written, no fixture modified.
**Date:** 2026-08-29
**Scope:** Getting real Deliverable and Artifact records into the live app's `state_blob`, as a separate track from the test-only `loadReferenceMatrix.js` loader fix.

---

## 0. Executive summary

The loader fix (`CLASS_SEQUENCE` + Deliverable-dispatch correction) is test-only and changes nothing in the running app. This spec covers the separate live-data work.

Three things surfaced while writing this spec that change the shape of the task. All three are stated as blocking. Two of them were not in the original precondition list.

1. **The `initiativesById` 30-vs-41 gap is not a gap.** It is fully reconciled below. Live is a deduplicated, abbreviation-expanded version of the fixture. **The fixture is stale relative to live, not the other way round.** This inverts the direction of the naming work.
2. **All 46 `owningInitiativeId` references in the live `projectsById` are dangling** — they carry a `project-` prefix where the initiative ids use `initiative-`. This is live breakage in Task 1's own output, and it hard-blocks this migration because `declareMatrixDeliverable` validates that reference.
3. **The fixture models Artifact→Deliverable; the reducer models Artifact→Project.** A grain mismatch that has to be resolved before 122 Artifacts can be written.

---

## 1. Scope of the write

### 1.1 Target row

`backend/jericho_dev.db`, table `user_states`, `user_id = 5` (`client_updated_at` `2026-08-29T07:56:09.994Z`, blob length 246,091). Rows 1–4 are stale or empty and are out of scope; if they are meant to be migrated too, that is a separate decision.

### 1.2 Slot-by-slot changes

Current live state of `matrix` (all five rows show `0` for the bottom three):

| Slot | Live now | Target | Change |
|---|---|---|---|
| `entitiesById` | 7 | 7 | none |
| `initiativesById` | 30 | 30 | none (see §1.3) |
| `projectsById` | 60 | 60 | repair `owningInitiativeId` on 46 (see §1.4) |
| `deliverablesById` | **0** | **64** | full population |
| `artifactsById` | **0** | **122** | full population |
| `systemsById` | 0 | 10 (?) | **unresolved — see §6** |

Note the earlier finding that `artifactsById` holds 64 misfiled Deliverables applies to the **test** load path only. In live, `artifactsById` is empty, so there is nothing to displace. The "replace the 64 currently-misfiled Deliverables" framing in the task prompt is true of the fixture/test track, not of live.

### 1.3 The `initiativesById` 30-vs-41 gap — RESOLVED, not blocking

The counts reconcile exactly:

```
fixture Initiative nodes:              41
  minus 3 lost to Case-1 slug collisions  -> 38 distinct slugs
  minus 7 "(NEW)" duplicate variants       -> 31
  minus 1 F8 "Production/Operations" dup   -> 30
live initiativesById:                  30   ✓
```

The 7 `(NEW)` variants absent from live: `79th-street-renovation-foundation-new`, `first-academy-building-foundation-new`, `i-am-the-state-foundation-new`, `marketing-flywheel-foundation-new`, `our-fearless-leader-7-seals-foundation-new`, `seeds-of-destruction-foundation-new`, `the-imaginary-ceo-foundation-new`. Plus `f8-energy-production-operations` (`F8 Energy – Production/Operations`), which live folds into `initiative-f8-energy-company-operations`.

Live also already carries the naming doctrine this project is about to apply to the fixture:

| Fixture | Live |
|---|---|
| `ofl 7 seals foundation` | `Our Fearless Leader 7 Seals Foundation` |
| `â HYS Batch 1 milestone` | `Help Yourself Batch 1 milestone` |
| `Global State Corp. Foundation` | `Global State Corporation Foundation` |
| `Marketing Flywheel – Audience Capture` | `Marketing Flywheel Audience Capture` |
| `f8 energy gum foundation` | `F8 Energy Gum Foundation` |

**Confidence caveat, stated plainly:** the live blob shares **zero keys** with the fixture (live uses `initiative-<slug>`, the loader uses bare `<slug>`), so this correspondence is inferred from *names*, not proven by *provenance*. The arithmetic reconciles exactly and the naming pattern is consistent, which is strong but not conclusive. **Before the migration runs, this should be confirmed against whatever path actually seeded row 5** (`declaredAtISO` on the sample project reads `2026-08-24T16:40:50.785Z`, which predates the Task 1 work and points at an intake/UI origin). I am flagging this rather than asserting provenance I have not verified.

Live has its own minor hygiene defects worth folding into the same cleanup: `HelpYourself Broadcast` (missing space), `79th Street Renovation  Foundation` (double space), `I AM THE STATE` (all-caps).

### 1.4 BLOCKING DEFECT — 46 dangling `owningInitiativeId` references

Live sample record:

```json
{
  "id": "project-global-state-solutions-business-plan",
  "owningEntityId": "entity-global-state-solutions",
  "owningInitiativeId": "project-global-state-solutions-foundation",   <-- WRONG PREFIX
  ...
}
```

The referenced initiative exists as `initiative-global-state-solutions-foundation`. Measured across the row: **60 projects, 46 with `owningInitiativeId`, 46 of 46 dangling.** Not one resolves.

This was recorded in memory as a Task 1 success ("46/60 have owningInitiativeId"). The count was right; the references were never resolution-checked.

It blocks this migration directly. `declareMatrixDeliverable` (`identityCompute.js:16746`) rejects any Deliverable whose `owningInitiativeId` is not present in `initiativesById`, with `DELIVERABLE_OWNING_INITIATIVE_UNKNOWN`. Deriving a Deliverable's `owningInitiativeId` from its parent Project — the obvious approach — would propagate all 46 broken references and fail every affected Deliverable.

**Required before migration:** repair the 46 to the `initiative-` prefix, verify 0 dangling, and screen-verify that Projects render their owning Initiative correctly.

### 1.5 ID convention — must match live, not the loader

Live convention is `<class>-<slug>`:

```
entitiesById            entity-global-state-solutions
initiativesById         initiative-global-state-solutions-foundation
projectsById            project-global-state-solutions-business-plan
verificationSourcesById src-global-state-solutions-drive
```

`loadReferenceMatrix.js:5` produces **bare slugs** with no prefix. Migration records must therefore use `deliverable-<slug>` and `artifact-<slug>`, **not** the loader's id scheme. Reusing loader ids would create a second, unreachable id namespace in live — the same class of defect as §1.4.

The `deliverable-`/`artifact-` prefixes are an inference from the established pattern; confirm against a UI-declared Deliverable if one can be produced, before committing to them.

### 1.6 Grain mismatch — Artifact's parent

The fixture gives Artifacts `parent_deliverable` (null on all 122). `declareArtifact` (`identityCompute.js:16791`, `16814`) requires **`producingProjectId`** and validates it against `projectsById` — a Project, not a Deliverable.

So "add `parent_deliverable` linkage to the fixture" does not by itself satisfy the reducer. Either the linkage is authored at Project grain, or the migration derives Project from Deliverable via the Deliverable's `parent_project`. The second is mechanical but only works once every Artifact has *some* parent. This needs a decision before authoring.

### 1.7 Required field shapes

**Deliverable** — `declareMatrixDeliverable`, all four required or the record is rejected:

| Field | Required | Source |
|---|---|---|
| `id` | yes | `deliverable-<slug>` |
| `name` | yes | fixture `name` |
| `owningProjectId` | yes | fixture `parent_project` → live project id |
| `owningInitiativeId` | yes | parent project's repaired `owningInitiativeId` (§1.4) |
| `successCriteria` | no | fixture `what_ships` |
| `targetDate` | no | fixture `target_date` |
| `reviewStatus` | no | fixture `status`, must be `CONFIRMED`/`NEEDS_REVIEW`/`DRAFT` |

No stored `phase` — Deliverables copy their parent Project's computed Phase at read time (E16 doctrine, comment at `identityCompute.js:16760`).

**Artifact** — `declareArtifact`, six required:

| Field | Required | Source |
|---|---|---|
| `id` | yes | `artifact-<slug>` |
| `name` | yes | fixture `name` |
| `producingProjectId` | yes | **unresolved — §1.6** |
| `completionEvidence` | yes | fixture `what_ships` — **empty string on all 122** |
| `verificationSourceId` | yes | must exist in `verificationSourcesById` (7 live) |
| `operatorAttestationMethod` | yes | not present in fixture at all |
| `producedByEntityId` | no | null on all 122 |

**Three of the six required Artifact fields have no fixture source.** `completionEvidence` is empty, `operatorAttestationMethod` does not exist as a field, and `producingProjectId` is unresolved. The 122 Artifacts cannot be authored from the current fixture without new content. This is the single largest piece of work behind this migration and it is authoring, not engineering.

---

## 2. Preconditions — all blocking

The migration must not run until every one of these has landed and been verified on the fixture/test track.

| # | Precondition | Status |
|---|---|---|
| P1 | Loader fix (`CLASS_SEQUENCE` + Deliverable-dispatch) committed and passing | not started — can proceed now, independent |
| P2 | Bug B Case-1 merges: the original 3, plus the OFL-family duplicate surfaced in §1.3 | not started |
| P3 | No-abbreviation renames (OFL, HYS) with mojibake fix bundled; n8's casing call resolved | not started — **but see note below** |
| P4 | `parent_deliverable` (or Project-grain) linkage for 122 Artifacts | not started — blocked on §1.6 decision |
| P5 | 39-file `artifactsById` consumer sweep | not started |
| P6 | **46 dangling `owningInitiativeId` repaired and verified 0-dangling** | **new — §1.4** |
| P7 | **Artifact `completionEvidence` + `operatorAttestationMethod` content authored** | **new — §1.7** |
| P8 | Live-blob provenance for row 5 confirmed (§1.3 caveat) | new — investigation |

**Writing to live before these land would carry today's mess into production data.** Specifically: without P6 every Deliverable write fails validation; without P7 every Artifact write fails validation; without P4 the Artifacts land unparented or not at all.

**Note on P3 direction.** Because live already has the expanded names (§1.3), the naming work is a *fixture catch-up to live*, not a live migration. The migration must **not** import fixture names over live cleaned names. If it did, it would regress `Our Fearless Leader 7 Seals Foundation` back to `ofl 7 seals foundation`. Deliverable and Artifact names are new to live so they can come from the fixture, but only *after* the fixture renames land — otherwise abbreviations enter live for the first time through this migration.

---

## 3. Write procedure

Follows the standing manual-DB-write protocol established 2026-08-29 (`direct-db-writes-need-client-updated-at`). Stated as steps, not by reference.

**Step 1 — Close the browser tab completely.** Not backgrounded, not refreshed. An open tab holds a debounced push that will overwrite the write (`syncService.js:71-77`).

**Step 2 — Snapshot.** Copy `backend/jericho_dev.db` to a timestamped backup outside the repo. Record `length(state_blob)` and `client_updated_at` for row 5. This is the rollback artifact (§4).

**Step 3 — Read, transform, write in one transaction.** Read `state_blob`, parse, mutate `matrix.deliverablesById` / `matrix.artifactsById` / repaired `projectsById`, re-serialize, write back **together with an advanced `client_updated_at`**. The mount-pull comparison at `identityStore.js:2295` is strictly-greater, so the new stamp must exceed `2026-08-29T07:56:09.994Z` (or whatever the value is at write time — re-read it, do not hardcode from this document).

**Step 4 — No schema-foreign sentinel keys.** Do not add a probe key to detect adoption; an unknown key fails `rehydratePersistedState` and the whole blob is rejected. Verify using fields the schema already defines — the record counts themselves.

**Step 5 — Verify after a genuine remount.** Re-open the tab fresh and read the counts from the *app*, not from the writing connection. A query against the DB proves the write landed; it does not prove the app adopted it.

**Step 6 — Re-query the DB after the app has been open for at least one debounce cycle**, to confirm the app has not pushed an empty blob back over the write.

---

## 4. Rollback

This write touches ~186 new records across two slots plus 46 repairs, against a prior maximum of 60 in a single migration.

**Failure modes and detection:**

| Mode | Detection |
|---|---|
| Partial write — some Deliverables rejected by validation | post-write count < 64; `state.lastPlanError` populated |
| Blob rejected wholesale by `rehydratePersistedState` | app shows empty matrix after remount; counts revert to 0 |
| App overwrites with pre-migration state | post-remount DB re-query shows old `client_updated_at` and old counts |
| Dangling refs introduced (wrong prefix, §1.5) | resolution check: every `owningProjectId`/`producingProjectId` present in its target slot |
| Silent partial — records written but not rendering | screen check shows fewer rows than the count query |

**Reversal:** restore the Step 2 backup file wholesale with the tab closed, then remount and confirm counts return to the pre-migration baseline (`deliverablesById` 0, `artifactsById` 0, `projectsById` 60). Because the write is a single blob replacement, there is no partial-rollback case — the row is either the new blob or the old one.

**Do not attempt in-place surgical reversal.** Restore the whole file.

---

## 5. Verification — what "done" means

Per the RESOLVED-VERIFIED amendment, query results alone are not sufficient.

**Tier 1 — data (query, after genuine remount):**

```
deliverablesById  == 64
artifactsById     == 122
projectsById      == 60
initiativesById   == 30
dangling owningInitiativeId  == 0   (of 46)
dangling owningProjectId     == 0   (of 64)
dangling producingProjectId  == 0   (of 122)
dangling verificationSourceId == 0  (of 122)
```

**Tier 2 — screen, in the running app:**

- Master Grid renders Deliverable rows under their parent Projects, with dates matching the fixture's `target_date`.
- A Project with known Deliverables shows them nested, not as a flat or empty list.
- Artifacts appear under their producing Project.
- Phase column still reads correctly for all 60 Projects — Deliverables copy the parent's computed Phase, so a wrong parent link shows as a wrong or blank Phase.
- `MasterGridTab.jsx:222` (an `artifactsById` consumer) renders without error.

**Tier 3 — named test diff, not a pass/fail count.** Full suite before and after, compared by test *name* against the current baseline. Per `open-flake-zion-today-execution-controls`, exact counts are unreliable on this project; only a name-level diff is admissible.

**Tier 4 — no regression in Phase computation.** The before/after Phase diff across all 60 Projects must show zero change. Deliverables entering `deliverablesById` for the first time will activate the Ongoing-project `phaseAnchor` derivation from 80d3377, which has had nothing to read until now. **This is a real risk of unintended Phase movement** and is the single most likely source of surprise in this migration.

---

## 6. Cannot spec confidently — flagged rather than guessed

1. **`systemsById` is 0 live, 10 in the fixture.** Out of the stated scope of this task, but it is the same defect class and will need the same treatment. Not specced here. Needs a decision on whether it joins this migration or gets its own.
2. **Artifact content authoring (P7).** `completionEvidence` and `operatorAttestationMethod` do not exist in the fixture for any of the 122. I cannot specify their values — that is operator content, not a transform.
3. **Artifact parent grain (§1.6).** Project-grain authoring versus derivation through the Deliverable is a modeling decision.
4. **Row-5 provenance (§1.3).** The reconciliation is arithmetic and naming-based. I have not traced what actually wrote that row.
5. **`deliverable-`/`artifact-` id prefixes (§1.5).** Inferred from the established pattern, not observed — no live record of either class exists to confirm against.
6. **Rows 1–4.** Out of scope by assumption, not by instruction.
