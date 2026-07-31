# Investigation Finding — Initiative Subject-Binding Defect (Step 1)

Run date of failure: 2026-07-06. Investigation: read-only, no data mutated.

## ⚠️ CORRECTION (2026-07-06, after live localStorage dump)

**The original persistence classification below was WRONG and is RETRACTED.** It
was a code-trace inference, not verified against data (backend was stale, browser
was unreachable at the time). The live dump falsifies it:

- `matrix.initiativesById` = `{}` (EMPTY) — zero committed initiatives.
- Blob is 156,612 chars with 97 top-level keys — lots of state exists, just not
  the §3 initiatives the operator typed.
- `intakeSessionByCycleId` is present in the key list → the roster was almost
  certainly captured into **in-flight session state and never committed to the
  canonical matrix.**

**There are TWO defects, not one:**
1. **CONFIRMED — rendering / token mismatch** (spine says "this undertaking",
   binder searches "this initiative"). Still real. Details below.
2. **THE PRIMARY DEFECT — capture-to-canonical commit failure** (persistence).
   The §3 roster was captured but zero `DECLARE_INITIATIVE` records reached
   `matrix.initiativesById`. This is the actual Gap-2 shape and directly explains
   §10 "no options" and the Master Plan gate — **no cascade logic needed, the
   map is simply empty.** Reclassifies as **(a) ABSENT** (never persisted) or
   **(c) MISFILED** (sitting in `intakeSessionByCycleId` / another key), TBD once
   the full blob is inspected.

Structural fact established from source: `store.matrix` IS `state.matrix`
(identityStore.js:1976-2065, `store = { ...state, matrixDispatch }`), and
`matrixDispatch = dispatch(action)`. So the reducer and the UI share one matrix;
an accepted `DECLARE_INITIATIVE` would have persisted (persistState on every
state change, L1949-1951). Since `initiativesById` is `{}`, **no initiative
dispatch was ever accepted** — the loss is upstream of the reducer write
(fan-out never completed a commit, or every dispatch was rejected
`INITIATIVE_INVALID`), OR no dispatch was produced at all.

Everything below the line is the ORIGINAL finding, preserved for the record.
Treat its (b)/(c) "persistence is sound" conclusions as FALSIFIED.

---

## DISPOSAL (Step 2 — approved & executed 2026-07-06)

Purge of `localStorage['jericho-identity']`, human-approved. Proof:
- BEFORE: key present, 156,612 chars, matrix `{entities:7, initiatives:0,
  systems:4, projects:0, artifacts:0}`.
- AFTER: `key present: false | value: null`.
- Preserved keys: `jericho-account`, `jericho-session`, `jericho-device-id`
  (auth/device — session intact).
- Backend `jericho_dev.db` untouched (held no failure-run data).
- Crime-scene copy retained at `~/Downloads/failure-run-2026-07-06.json`.

## FIX & VERIFICATION (Step 4 — 2026-07-07)

TDD, both defects. Tests written first, watched fail for the right reason, then
minimal fixes, then full + cold-clone suites.

**Tests (RED first):**
- `tests/state/intakeSession.persistence.test.js` — new `describe('matrix intake
  completion — commit boundary guard')`: (1) a session with uncommitted answers
  is preserved + flagged on completion (never silent-deleted); (2) a clean
  name-only session is retired. Both failed RED (`MARK_MATRIX_INTAKE_COMPLETE`
  did not exist → `matrixIntakeComplete` undefined).
- `tests/domain/elicitation/elicitationEngine.referentBinding.test.js` — replaced
  the vacuous initiative case (tautology gated on the never-true `this initiative`
  token) with two real assertions: the owner probe names the captured initiative;
  distinct names yield distinct spines. Failed RED (spine still "this
  undertaking", no name bound).

**Fixes (GREEN):**
- `src/domain/elicitation/elicitationEngine.js` — `REFERENT_PLACEHOLDER[INITIATIVE_SLOT_ID]`
  `'this initiative'` → `'this undertaking'` (matches authored spines; subject now binds).
- `src/state/identityCompute.js` — new `MARK_MATRIX_INTAKE_COMPLETE` reducer case:
  sets the complete flag, and retires the session ONLY if it holds no uncommitted
  answers (any captured field beyond `name`). Uncommitted → session preserved +
  `state.intakeCommitWarning = { cycleId, code: 'UNCOMMITTED_SESSION_RETAINED' }`.
- `src/state/identityStore.js` — `markMatrixIntakeComplete` hook now dispatches the
  pure action instead of a `[state]`-closure `structuredClone`+`delete`+
  `APPLY_NEXT_STATE` (also removes the flagged stale-closure rollback hazard).

**Verification (pasted counts):**
- Working tree full suite: 3681 total, **3654 passed, 27 failed, 1 failed suite**
  — frozen baseline exactly; 4 new tests green; zero failures in touched files.
- Clean-clone cold run (fresh `git clone` of `execution-readiness-wip` + patch +
  `npm ci` 579 pkgs + full suite): **3681 / 3654 passed / 27 failed / 1 failed
  suite** — identical; the 4 new tests PASSED cold; no touched-area failures.

**Scope honesty:** the guard STOPS silent loss (preserve + warn) and the token
fix lets the operator answer §3 with a named subject — together addressing the
data-loss root cause. It does NOT force-commit partial answers (a half-answered
initiative still fails its gates, by design). Recommended follow-ups (not in this
fix): (1) surface `intakeCommitWarning` as a visible UI banner (fail-loud in the
UI, not just state); (2) consider gating `done` so completion with uncommitted
work prompts rather than proceeds. Step 5 live acceptance is the human re-run.

## AMENDED FINDING (data-verified against failure-run-2026-07-06.json)

### Classification: (a) ABSENT

Verified from the 156,612-char blob (97 top-level keys):

| Section | Map | Count | source |
|---------|-----|-------|--------|
| §2 Entities | `entitiesById` | **7** | all `operator_declared`, stamp `2026-07-06T17:45:22.121Z` |
| §4 Systems | `systemsById` | **4** | all `operator_declared`, same stamp |
| §3 Initiatives | `initiativesById` | **0** | — |
| §5 Projects | `projectsById` | **0** | — |
| §6 Artifacts | `artifactsById` | **0** | — |
| §7 Dependencies | `dependenciesById` | **0** | — |
| §8 Convergences | `convergencesById` | **0** | — |
| §9 Resource profiles | `resourceProfilesById` | **0** | — |

- `intakeSessionByCycleId` = `{}` (EMPTY).
- `lastPlanError` = `null` (no `INITIATIVE_INVALID` — no dispatch was rejected).
- §3 name search (OFL/Romance/Seeds/Jericho/tape/album/…) = **0 hits** anywhere.
- `matrixIntakeComplete` = **`true`**; cycle Active; goal = the Global State
  Solutions enterprise goal; `proposedBlocks`/workspace deliverables = 0 (→ the
  Master Plan "complete intake first" and goal-card "thin" messages).

§2 and §4 committed (operator-typed, incremental `DECLARE_*`). §3 and everything
below it never reached canonical state. The §3 answers are gone — not orphaned,
not misfiled, not in session state. **Absent.**

### The data-destroying step (found)

`src/state/identityStore.js:1925-1934` — `markMatrixIntakeComplete`:

```
const markMatrixIntakeComplete = useCallback(() => {
  const cycleId = state.activeCycleId;
  if (!cycleId || !state.cyclesById?.[cycleId]) return;
  const draft = structuredClone(state);
  draft.cyclesById[cycleId].matrixIntakeComplete = true;
  if (draft.intakeSessionByCycleId) delete draft.intakeSessionByCycleId[cycleId]; // <-- DESTROYS in-flight session
  const nextState = computeDerivedState(draft, { type: 'NO_OP' });
  dispatch({ type: 'APPLY_NEXT_STATE', nextState });
}, [state]);
```

Called from `src/ui/masterPlan/MatrixIntake.jsx:823-825` when `phase === 'done'`.
`matrixIntakeComplete` is `true` in the blob → this ran. It **unconditionally
deletes the intake session** with no check that any of the session's captured
answers were committed to the matrix first.

### Why "done" is reachable with §3 empty (no commit guard)

`MatrixIntake.jsx` `enterQueue` (L614-657) and the per-screen "Skip this section"
(`advanceSlot`, L693-703; RosterScreen `onSkip`, L500-502; probe skip, L1150-1159)
walk the queue and, when it empties, `setPhase('done')` (L655-656) — with **no
assertion that any record was committed**. So a run that skipped/abandoned §3
(plausibly *because* the subject-less questions gave the operator nothing to
anchor on — defect #2) proceeds straight to `done` → `markMatrixIntakeComplete`
→ session deleted. Silent. This is the A-predicate violation: uncommitted state
cleared without a loud failure.

### Commit model (for the record)

There is **no bulk "session→matrix commit" step**. Each node commits
incrementally: a completed slot's `consumeAnswer` →
`finalizeCompletedSlots` (elicitationEngine.js:475-533) emits a `DECLARE_*`
dispatch → `MatrixIntake.handleSubmit` (L876-880) calls
`store.matrixDispatch(action)` → reducer writes `state.matrix.*ById`. `store.matrix`
IS `state.matrix` (identityStore.js:1976), and `persistState` fires on every state
change (L1949-1951). So a completed §3 item would have left an afternoon-stamped
record. Zero exist → **no §3 item ever completed its 5-gate fan-out.**

### Secondary latent hazard (flag, not root cause here)

`APPLY_NEXT_STATE` (identityStore.js:1600-1603) wholesale-replaces state with a
`nextState` that several callbacks (`markMatrixIntakeComplete`,
`attemptGoalAdmission`) build from a `[state]`-closure snapshot. After a burst of
rapid `matrixDispatch` calls (the fan-out), such a callback can hold a STALE
`state` and roll back records committed after its snapshot. Not proven as the
cause of THIS loss (morning records predate any afternoon callback and survived),
but it is a real second-order data-loss risk on the same boundary and should be
hardened alongside the primary fix.

### Test reconciliation (protocol Step 3)

**No existing failing test covers this defect. An existing PASSING test gives
false coverage of it.**

- `tests/domain/elicitation/elicitationEngine.referentBinding.test.js:91-112`
  (initiative case) is **structurally vacuous**: its only assertion is guarded by
  `if (step.probe.spine.includes('this initiative'))`, which is NEVER true (spines
  say "this undertaking"), and the test ends in `expect(true).toBe(true)`. It
  passes green while binding is fully broken. The entity case (L26-37) genuinely
  asserts (`toContain('Global State Corp.')`) and passes — because entity spines
  DO contain "this entity". So the drift is invisible to the suite.
- **No test** asserts the commit boundary: that `markMatrixIntakeComplete` /
  reaching `done` is only legal after the session's captured answers are
  committed, or that clearing a non-empty uncommitted session is forbidden. The
  primary defect is entirely uncovered.
- Relevant suites that exist but don't cover it: `MatrixIntake.roster.test.jsx`
  (Defect E fan-out UI), `intakeSession.persistence.test.js`,
  `masterPlanStore.intakeComplete.test.js`, `elicitationEngine.initiativeSlot.test.js`.

### Two defects, ranked

1. **PRIMARY — commit-boundary / silent session destruction.**
   `markMatrixIntakeComplete` deletes an uncommitted intake session
   (identityStore.js:1931) and `done` is reachable with nothing committed
   (MatrixIntake enterQueue). Data-loss class. Uncovered by tests.
2. **SECONDARY — referent token drift.** Binder searches `"this initiative"`
   (elicitationEngine.js:288); spines say `"this undertaking"`
   (initiativeReprobes.ts). Subject never renders → drives the §3 abandonment
   that the primary defect then silently discards. False-covered by a vacuous test.

---

## Summary (classification) — ⚠️ ORIGINAL, PERSISTENCE CLAIM FALSIFIED

The defect is a **RENDERING / probe-generation defect**, not a persistence
corruption. It is a *silent token mismatch* between the referent-binding table
and the authored initiative spines. Against the three hypotheses:

- **(a) ABSENT** — not the root cause. The write path is intact.
- **(b) UNBOUND** — **NO.** Persisted initiative records are correctly bound by
  their own `initiative-<name-slug>` id; nothing is orphaned or stamped on the
  first item.
- **(c) MISFILED** — **NO.** Records land in `matrix.initiativesById` under the
  correct per-item key, exactly where downstream readers look.

> RETRACTED: the live dump shows `matrix.initiativesById` = `{}`. The above three
> bullets are wrong — see the CORRECTION block at the top.

**Root cause:** the fan-out *asks* the right per-initiative questions and *stores*
them correctly, but the **question text never names its subject**, because the
referent-binding substitution looks for the literal string `"this initiative"`
while every authored initiative spine says `"this undertaking"`. The substitution
matches nothing and returns the spine unchanged — so each probe reads
"Which entity owns this undertaking?" with no initiative named.

> PARTIALLY RETRACTED: "stores them correctly" is false. The rendering bug is
> real; the persistence claim is not.

## The exact bug

`src/domain/elicitation/elicitationEngine.js:286-292` — the binding table:

```
const REFERENT_PLACEHOLDER = {
  [ENTITY_SLOT_ID]:     'this entity',
  [INITIATIVE_SLOT_ID]: 'this initiative',   // <-- token the code searches for
  [SYSTEM_SLOT_ID]:     'this system',
  [PROJECT_SLOT_ID]:    'this project',
  [ARTIFACT_SLOT_ID]:   'this artifact',
};
```

`elicitationEngine.js:294-301` — the substitution (no-op when token absent):

```
function applyReferentBinding(spine, slotId, captured) {
  const placeholder = REFERENT_PLACEHOLDER[slotId];
  if (!placeholder) return spine;
  const capturedName = String(captured?.name || '').trim();
  if (!capturedName) return spine;
  return spine.split(placeholder).join(capturedName);   // split on 'this initiative' -> no match
}
```

`src/domain/elicitation/initiativeReprobes.ts` — authored spines use **"this
undertaking"**, never "this initiative":

- L14 `INITIATIVE_NAME_MISSING`: "What's this undertaking called…"
- L34 `INITIATIVE_OWNER_UNRESOLVED`: "Which entity owns this undertaking?…"
- L39 `INITIATIVE_PURPOSE_MISSING`: "What is this undertaking for?…"
- L70 `INITIATIVE_DONEWHEN_MISSING`: "When is this undertaking done?…"

### Token audit — proves the selective failure

| Slot | Binding token | Word authored in spines | Binds? |
|------|--------------|-------------------------|--------|
| Entity §2 | `this entity` | "this entity" (entityReprobes.ts:38,50,71) | ✅ |
| Initiative §3 | `this initiative` | **"this undertaking"** (0 matches) | ❌ |
| System §4 | `this system` | "this system" (systemReprobes.ts:26,51,62) | ✅ |
| Artifact §6 | `this artifact` | "this artifact" (artifactReprobes.ts:3,21,26,44,49) | ✅ |

Entity/System/Artifact spines contain their exact placeholder token, so their
subject binds. Only initiative drifted to a synonym. That is precisely why the
failure is *selective* — §3 loses its subject and the sibling node sections do
not.

## Write path (capture → fan-out → persistence)

- **List capture (names → array):** `src/ui/masterPlan/MatrixIntake.jsx`
  - `RosterScreen` L433-506 — chip roster, names as an array (Defect E fix).
  - `NODE_ROSTER_SLOTS` L123-129 — initiative is a rostered node slot.
- **Per-item fan-out:** `MatrixIntake.jsx`
  - `seedNodeEngine(matrix, slotId, name)` L134-145 — seeds a single-slot engine
    with `captured: { name }` so the fan-out drives the remaining fields.
  - `beginFanOut(names)` L708-727 — one seeded engine per name.
  - `pendingRefresh` effect L784-820 — on slot completion advances to the next
    name (`rosterIndex + 1`) or finishes the section.
- **Probe generation:** `elicitationEngine.js`
  - `buildProbe` L304-327 → `applyReferentBinding` L294-301 (the failing bind).
  - `nextProbeForCurrentSlot` L329-353.
- **Rendering:** `MatrixIntake.jsx` L1053-1162 — renders `displaySpine`
  (L1051/1084-1086) and a generic `SectionPill`/`framing`. **No element renders
  `rosterNames[rosterIndex]`,** so even the raw item name is never shown as a
  header. (Secondary gap: even a corrected token only fixes probes whose spine
  contains it — a subject header on the fan-out screen would be belt-and-braces.)
- **Persistence (bound, correct):** `elicitationEngine.js:375-379`
  (`DECLARE_INITIATIVE`) → `src/domain/elicitation/initiativeSlot.ts:123-141`
  (`buildInitiativeDeclarePayload`, id = `initiative-<name-slug>`) →
  `src/state/identityCompute.js:15560-15589` (`declareInitiative`, stores under
  `matrix.initiativesById[id]`, rejects only incomplete records with
  `INITIATIVE_INVALID`).

## Why §5/§8 render chips but §10 / Master Plan fail

- §5/§8 chips are **pickSet OPTION lists**, built by `buildPickSet` reading
  already-declared nodes from the matrix (`elicitationEngine.js` L136/163/182/247).
  Entities and systems declared as chips persisted fine, so those option chips
  populate. This is a *different mechanism* from subject binding and is unaffected.
- §10 Bootstrap options derive from the chain **artifact → project →
  initiative** (`src/domain/elicitation/bootstrapSlot.ts:26,35`
  `proj?.owningInitiativeId`). If initiatives (and the projects/artifacts that
  hang off them) are thin — the practical outcome of an abandoned §3 fan-out —
  the chain yields nothing → "No options available yet."
- Master Plan (`src/ui/masterPlan/MasterPlanTimeline.jsx:622`) and the goal-card
  "canonical truth thin" advisory both key off a populated matrix; a thin §3
  cascades into both.

So the readers are not "not looking in the right place" — the initiative records
that *would* feed them are sparse because the subject-less questions drove an
incomplete §3 pass.

## Raw dumps

### Backend (SQLite `backend/jericho_dev.db`, mtime Jun 28 — pre-failure)
Sync is opt-in/secondary. `user_states` holds only `{"test":true}` and a stale
`vector/lenses` blob. **No initiative data, no failure-run data.** The failure-run
canonical state exists ONLY in the browser localStorage.

### Client (localStorage key `jericho-identity`, shape: top-level `state.matrix`)
Cannot be read from the tooling here — it lives in your browser. Paste the output
of this console snippet (DevTools console on the running app) to finalize whether
§3 came out thin, partial, or fully-but-confusingly declared:

```js
(() => {
  const s = JSON.parse(localStorage.getItem('jericho-identity') || '{}');
  const m = s.matrix || {};
  const n = o => Object.keys(o || {}).length;
  console.log('localStorage keys:', Object.keys(localStorage));
  console.log('matrix counts:', {
    entities: n(m.entitiesById), initiatives: n(m.initiativesById),
    systems: n(m.systemsById), projects: n(m.projectsById),
    artifacts: n(m.artifactsById),
  });
  console.log('initiativesById:', JSON.stringify(m.initiativesById || {}, null, 2));
  console.log('in-flight sessions:', JSON.stringify(s.intakeSessionByCycleId || {}, null, 2));
})();
```

The counts + `initiativesById` dump distinguish: **thin** (0-1 records →
abandoned fan-out), vs **complete-but-confusing** (N records, all fields present
→ pure rendering bug, no data problem). Either way the fix is the same token
correction; the dump only decides Step 2 disposal.
