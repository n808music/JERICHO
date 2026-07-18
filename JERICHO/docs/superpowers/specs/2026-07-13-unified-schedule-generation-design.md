# Design Spec — Unified Schedule Generation

Date: 2026-07-13
Status: §5/§5.5/§7.1/§7.2/§7.4 IMPLEMENTED (interim, inside the existing
`generateColdPlanForCycle`). §6 STAGE 1 (foundation) IMPLEMENTED: the
`PARTIAL`/`capacityViolation` contract fix and a real, additive `cycle.schedule`
(canonical `ScheduledBlock[]`) now exist alongside `cycle.coldPlan` — see §6.1. §6 STAGE 2
REVISED AND IMPLEMENTED in its revised form: investigation found `generatePlan` is not a
redundant twin of `generateColdPlanForCycle` (it delegates to `compileAutoAsanaPlan`, a much
richer engine entangled with deferred recovery/feasibility machinery) — retiring it would be
a capability regression, not a unification. Built instead: `GENERATE_SCHEDULE`, a routing
consolidation that picks the right *existing, unmodified* engine per cycle instead of the
choice being which UI button was pressed — see §6.2. §6.3 (2026-07-13, same day, follow-up):
closed a real gap surfaced by tracing the live admission flow — every real cycle in this app
routes through Matrix intake only (no live path ever populates `generatePlan`'s action graph),
so the matrix-engine fallback isn't an edge case, it's the only thing that ever runs; but its
output (`cycle.schedule`) had no visible surface on the dashboard's Review/Apply screen. Now
bridged into `state.proposedBlocks` so Generate → Review → Apply → Activate is a real,
working, end-to-end loop for the matrix-driven path. §6.4 (2026-07-13, same day, second
follow-up): closed the phasing scalability gap — pairwise Project dependency declaration (§5.5)
doesn't scale at the operator's real portfolio size (18 CONFIRMED Projects, largely unrelated
content lines). `SET_INITIATIVE_PHASE` lets phase be declared once per Initiative (~10
decisions); `deriveEffectiveProjectPhases` merges dependency-derived phase, then a Project's own
hand-typed phase, then its owning Initiative's declared phase, in that order of specificity;
`SequencingPanel.jsx` gained an initiative-phase selector; the Project-level dependency form
stays as an optional finer override. Master Plan bridge fold-in (§7.1) and a from-scratch
review/apply lifecycle rewrite remain not done and are no longer planned in their original
form, now that full algorithm unification has been abandoned — §6.3 reused the existing
lifecycle unmodified instead.
Depends on: `feat(masterGrid): causal chain from matrix` (2026-07-13, already shipped —
`generateColdPlanForCycle` now derives `causalChainSteps` from CONFIRMED matrix Projects
when no manual causal chain exists).

**Implemented this pass:** `Capacity` node class (`jericho_matrix_schema.json`,
`capacityById`, shared pool per entity per §5/§7.2); `seedCapacityFromLegacyConstraints`
(`src/domain/masterGrid/capacityFromLegacy.js`) carries forward
`goalContract.workWindows`/`availabilityPolicy`/`strategy.constraints` into a DRAFT row,
idempotently, no re-entry; `CONFIRM_CAPACITY` reducer action — one click, no elicitation
survey; `buildConstraintsFromMatrix` (`src/domain/masterGrid/constraintsFromMatrix.js`)
translates a CONFIRMED row into `generateDeterministicPlan`'s constraints shape and is now
wired into `generateColdPlanForCycle` with the same explicit-wins-else-matrix precedence as
the causal chain; `CapacityConfirmPanel.jsx` gives a one-click UI next to (not inside)
`MasterGridTab`, which stays read-only per its existing AC4 contract. All covered by tests
(`capacityFromLegacy.test.js`, `constraintsFromMatrix.test.js`,
`capacitySeed.integration.test.js`, `confirmCapacity.test.js`,
`generateColdPlan.matrixCapacity.test.js`, `CapacityConfirmPanel.test.jsx`).

**Implemented this pass (2):** Phase 1/2/3 derivation from dependency structure (§5.5) —
`declareDependency` generalized from artifact-only to Project/Initiative/Artifact
(`identityCompute.js`, `findDependencyNodeSlice`); `deriveProjectPhasesFromDependencies`
and `buildPhaseReorganizationRecommendations`
(`src/domain/masterGrid/phaseFromDependencies.js`) turn the declared "X before Y" graph
into topological Phase 1/2/3 buckets and plain-language reorganization flags; wired into
`buildCausalChainStepsFromMatrix`'s sort precedence (derived phase beats the raw,
near-always-empty `phase` field); `SequencingPanel.jsx` gives a one-click "declare what
must happen before what" UI next to (not inside) `MasterGridTab`. All covered by tests
(`phaseFromDependencies.test.js`, `declareDependency.test.js`,
`causalChainFromMatrix.test.js`, `SequencingPanel.test.jsx`).

## 1. Problem, restated precisely

Intake (Master Grid — entities/initiatives/projects/systems, CONFIRMED + Ready=YES) is
now solid. Plan quality (`evaluatePlanQualityGate.ts`) is the next gate to reconfirm, and
per direction from the operator: **course correction, initial feasibility, and live
probability of success are explicitly deferred until plan quality is reconfirmed against
real matrix-driven schedules.** This spec covers only what comes immediately before that:
the schedule generator itself, and where time-constraints are captured.

Tracing the live code turned up more duplication than the single seam fixed on
2026-07-13. There are currently **two schedule generators** and **three constraint
representations**, none of which talk to each other or to the matrix:

**Generator A — `GENERATE_COLD_PLAN` / `REBASE_COLD_PLAN`**
`generateColdPlanForCycle` (`identityCompute.js:4026`) → `generateDeterministicPlan`
(`core/deterministicPlanGenerator.ts`). Reads `cycle.strategy.constraints`
(`maxBlocksPerDay`/`maxBlocksPerWeek`/`preferredDaysOfWeek`/`blackoutDayKeys`) and, as of
today, `causalChainSteps` (manual, or matrix-derived). Writes
`cycle.coldPlan.forecastByDayKey` — a day-bucketed *count* per deliverable id, no ISO
times, no calendar identity. Triggered by: the legacy Strategy panel
(`Workspace.jsx` → `onGenerate`/`onRebase`), goal admission's auto-run
(`identityStore.js:2997`), and classic onboarding cycle creation.

**Generator B — `GENERATE_PLAN` / `REBUILD_SCHEDULE`**
`generatePlan` (`identityCompute.js:11942`) branches into either
`generateMasterPlanFirstCycle` (a "Master Plan" lanes/milestones bridge,
`identityCompute.js:6758`) or an action-graph continuation that reads
`cycle.actions`/`cycle.llmActionGraph`/`recoverCanonicalContractForCycle`. Both branches
validate work-windows/capacity via `deriveCycleSchedulingAuthority`
(`identityCompute.js:3215`) *at generate time*, gating with `WORK_WINDOWS_UNSAVED` /
`CONSTRAINTS_STALE` / `CAPACITY_INSUFFICIENT`. Writes concrete calendar blocks
(`state.proposedBlocks`, `cycle.scheduleReviewBlocks`, eventually committed via
`createBlock`, `identityCompute.js:15041`) with real `startISO`/`endISO`,
`entityId`/`laneId`, `deliverableId`. Triggered by: the actual dashboard button —
`ZionDashboard.jsx`'s `handleGenerateSchedule` → `generateScheduleForActiveCycle`.

Neither generator's "required capacity" estimate reads the matrix either —
`estimateCycleRequiredWeeklyMinutes` (`identityCompute.js:3152`) counts `cycle.actions`
length × 45 minutes, or master-plan proposal minutes. So confirmed Project scope
(`successMetric`, `targetDate`) has no bearing on how much time the system thinks the
work needs. That is a second, related gap this design should close at the same time,
since it's the same "generator doesn't read the matrix" disease in a different organ.

**Three constraint representations, captured last, separately:**

| Representation | Shape | Set by | Read by |
|---|---|---|---|
| `cycle.strategy.constraints` | `{maxBlocksPerDay, maxBlocksPerWeek, preferredDaysOfWeek, blackoutDayKeys, tz}` | `SET_STRATEGY`, admission defaults | Generator A only |
| `cycle.goalContract.workWindows` | `{mon:[{start,end}], tue:[...], ...}` | `WorkWindowsEditor.tsx` on the **Structure** page, dispatched via `updateWorkWindows` — a UI panel entirely separate from Master Grid intake | Generator B (`deriveCycleSchedulingAuthority`) |
| `state.availabilityPolicy` | same shape as above, global fallback | (settings, not intake) | Generator B fallback only |

This is exactly the pattern named in the game plan: constraints are a generate-time
defense (`unsaved`/`stale`/`insufficient` errors thrown *after* the operator has already
tried to generate) instead of an intake-time fact that's confirmed once and trusted
after.

## 2. Target layered model

```
 MATRIX (confirmed)            CAPACITY (confirmed, new)
 entities/initiatives/  ─┐      workWindows + blackout +
 projects (Ready=YES)    │      per-day/week caps
                         ▼                ▼
                  ┌─────────────────────────────┐
                  │   generateSchedule(state)    │   <- single engine,
                  │   spine × capacity → blocks   │      replaces A + B
                  └───────────────┬─────────────┘
                                  ▼
                        Schedule (canonical shape,
                        §3 below) — one artifact,
                        one lifecycle
                                  ▼
                  evaluatePlanQualityGate  (reconfirm next,
                                             before touching §5)
                                  ▼
        [deferred] feasibility · course correction · live P.O.S.
```

Spine and capacity are peers, both intake-time, both CONFIRMED-gated, both feeding one
generator. The generator's only job is "strategy meets constraints" — no validation,
no gating, no fallback-inventing. Validation happens once, at intake, on the way to
CONFIRMED.

## 3. Canonical Schedule / Block shape

Generator A's output (`forecastByDayKey`: counts only) is strictly weaker than what the
app already renders and reviews (Generator B's blocks, and `createBlock`'s persisted
shape). Unifying means standardizing on the **richer** shape and generating it directly,
not through a "forecast" intermediate that has to be re-expanded into real blocks later.

Proposed canonical unit — `ScheduledBlock`:

```ts
type ScheduledBlock = {
  id: string;                 // deterministic, e.g. `sched-${cycleId}-${n}`
  cycleId: string;
  goalId: string | null;
  dayKey: string;              // YYYY-MM-DD
  startISO: string;
  endISO: string;
  durationMinutes: number;
  origin: 'schedule_generation';
  status: 'proposed' | 'committed';   // review/apply lifecycle, unchanged
  deliverableId: string;        // ties back to a matrix Project (or manual deliverable)
  deliverableTitle: string;     // verbatim Project name — no more generic labels
  entityId: string | null;      // owningEntityId of the Project
  entityLabel: string | null;
  initiativeId: string | null;  // owningInitiativeId, carried for lane/rollup grouping
  laneId: string | null;        // = initiativeId today; kept distinct in case that changes
  laneLabel: string | null;
  kind: 'PLANNING' | 'CORE' | 'VERIFICATION';
  order: number;                // position within its deliverable's block sequence
};
```

This is a superset of both existing shapes: it satisfies `evaluatePlanQualityGate`'s
`proposedBlocks`/`committedBlocks` input contract (array of block-like objects — the gate
only reads a handful of fields per §4 cross-check below), and it satisfies `createBlock`'s
persisted fields (`entityId`, `laneId`, `deliverableId`, `startISO`/`endISO`) directly, so
"propose → review → commit" becomes a status flip, not a re-derivation.

`cycle.coldPlan` as a concept goes away. `cycle.schedule = { version, generatorVersion,
strategyId, assumptionsHash, createdAtISO, blocks: ScheduledBlock[], infeasible? }`
replaces it. A `forecastByDayKey`-shaped view can be derived from `blocks` with a pure
selector for any UI that still wants the day-bucketed count — cheap to keep as a
projection, expensive to keep as a second source of truth.

## 4. Cross-check against real consumers (no silent regressions)

- **`evaluatePlanQualityGate`** (`domain/planQuality/evaluatePlanQualityGate.ts:1450`)
  takes `deliverables`, `actions`, `proposedBlocks`, `committedBlocks` as arrays and
  filters `Boolean` — it doesn't require the old `ProposedBlock` shape specifically, it
  reads generic fields off each item (titles, counts, dates) across its ~13 sub-checks
  (`substanceGate`, `actionTitle`, `artifactSpecificity`, `blockDetailAuthority`, etc. —
  one test file per check under `src/domain/planQuality/`). `ScheduledBlock` is a strict
  superset of what those tests construct today, so this is additive, not breaking — but
  each of those ~13 test files should be re-run against the new shape as part of the
  plan-quality reconfirmation phase (§6, Phase 4), not assumed clean.
- **`createBlock`** (`identityCompute.js:15041`) — persisted block already has
  `entityId`/`entityLabel`/`laneId`/`laneLabel`/`deliverableId`/`goalId`/`cycleId`. The
  canonical shape mirrors these field names on purpose so "commit a proposed
  `ScheduledBlock`" is a direct field copy into `createBlock`'s payload, not a
  translation layer.
- **Review/apply lifecycle** (`scheduleReviewBlocks` → `applyDraftSchedule`,
  `identityCompute.js:12953`) — currently operates on Generator B's block shape. Needs
  updating to read `cycle.schedule.blocks` instead, same status-flip semantics
  (`proposed` → `committed`), no new lifecycle states introduced.
- **Master Plan bridge** (`generateMasterPlanFirstCycle`) — this is a distinct,
  lanes/milestones-based planning mode with its own admission path (`masterPlansById`).
  Recommendation: fold it in as a *second spine source* (lanes/milestones instead of
  matrix Projects) feeding the same single generator, rather than special-casing it
  forever. Flagged as an open decision in §7 — it's real scope, not free.

## 5. Constraints in intake — where capacity lives

Recommendation: a new matrix-adjacent slice, `capacityById`, following the exact same
contract shape every other node class already uses (`reviewStatus`, gated CONFIRMED
before the generator will trust it) — reusing a pattern the operator has already been
running for weeks instead of inventing a new one:

```json
"Capacity": {
  "storeSlice": "capacityById",
  "fields": {
    "id": { "type": "string", "required": true },
    "owningEntityId": { "type": "string", "required": true },
    "workWindows": { "type": "object", "required": true },
    "blackoutDayKeys": { "type": "string[]", "default": [] },
    "maxBlocksPerDay": { "type": "number", "default": 4 },
    "maxBlocksPerWeek": { "type": "number", "default": 16 },
    "reviewStatus": { "type": "enum", "enum": ["CONFIRMED", "NEEDS_REVIEW", "DRAFT"], "default": "DRAFT" }
  }
}
```

Keyed by `owningEntityId` rather than a global singleton so multi-entity setups (the
Master Grid already supports multiple Entities in one matrix) can carry different
capacities per entity — a solo operator just gets one `capacityById` row. This collapses
today's three representations (`strategy.constraints`, `goalContract.workWindows`,
`availabilityPolicy`) into one, captured once during intake, confirmed like everything
else, and the `WorkWindowsEditor.tsx` panel on the Structure page becomes the *editor for
this matrix row* instead of a separate save-then-go-stale artifact living outside intake.
`deriveCycleSchedulingAuthority`'s `unsaved`/`stale`/`insufficient` gate logic doesn't
disappear — it moves from "generate-time defense" to "intake-time validation," the same
promotion the causal chain just went through.

**Capacity is a shared pool, not a per-lane budget.** Per-entity does not mean the
operator allocates time to each initiative/lane individually — they don't decide how much
time Initiative A gets vs. Initiative B. They declare one pool of available time for the
entity (`capacityById[entityId]`); the generator evaluates every CONFIRMED causal step
under that entity equally against that single pool and decides allocation and priority
order itself (earliest-first by phase, same ordering `buildCausalChainStepsFromMatrix`
already produces). Lane/initiative identity rides along on each block for
grouping/display (`laneId`/`laneLabel` in the `ScheduledBlock` shape, §3) — it is not an
input to how much time that lane gets.

**Insufficient capacity must be a visible flag, not a silent trim.** Auditing
`generateDeterministicPlan`'s current allocation loop
(`core/deterministicPlanGenerator.ts:278-350`) surfaced a real defect worth carrying into
this design rather than repeating: today, `targetBlocks = Math.min(totalBlocksRequired,
maxBlocksForPeriod)` caps silently, the allocation loop stops once it hits that cap, and
the result still reports `status: 'SUCCESS'` — whatever didn't fit just never appears,
with no error, no reason code, nothing surfaced to the operator. That is exactly the
"quiet data loss" shape the 2026-07-06 initiative-binding investigation flagged in a
different part of this system, and it must not ship again here. The unified generator's
contract changes to: `status: 'SUCCESS'` only when every CONFIRMED causal step fit;
otherwise `status: 'PARTIAL'` with an explicit `capacityViolation` payload — which
causal-chain steps (by id/title/owning initiative) got cut, how many minutes over
capacity, and per-entity breakdown when more than one entity is in play. `PARTIAL` is
schedulable (the blocks that *did* fit are still real and usable) but must render as a
flagged, acknowledgeable state in the UI — never a silent `SUCCESS`.

**Status update (2026-07-13, §6.1): fixed.** The `PARTIAL`/`capacityViolation` contract
described above is now implemented in `deterministicPlanGenerator.ts` — see §6.1. A
capacity row too small for confirmed scope now returns `status: 'PARTIAL'` with a
`capacityViolation` payload (`requiredBlocks`, `availableBlocks`, `overageMinutes`,
`cutSteps`), surfaced onto both `cycle.coldPlan.capacityViolation` and the new
top-level `state.lastPlanWarning` (deliberately separate from `state.lastPlanError`, which
still only fires on zero-blocks/true infeasibility). The blocks that *did* fit are still
real and schedulable — this is a visible flag, not a blocking failure.

## 5.5 Phase — derived from dependency structure, not entered

Live-app screenshot on 2026-07-13 surfaced a gap this design hadn't covered: Master Grid
showed all 44 matrix nodes with a **blank `phase` column**. `buildCausalChainStepsFromMatrix`
(§ above `generateColdPlanForCycle` already relied on) sorts by `project.phase` first — with
every row null, the sort silently fell through to alphabetical order, which is structurally
meaningless (a plan reading "Alpha Project, Zebra Project" in that order tells the operator
nothing about beginning/middle/end). Operator's framing: *"there can't be a successful full
schedule generation without this skill"* — phasing (Phase 1/2/3, beginning/middle/end) is
canonical, not optional metadata.

**Rejected approach: ask the operator to type a phase number per project.** This is exactly
the "machine I want, not the one I need" failure mode the operator flagged directly:
*"building the machine i need not the one i want. which is the machine that considers my
phasing in the intake and if needed recommends reorganization."* A free-text phase field is
one more thing to keep consistent by hand, with no way for the system to catch a contradiction
(e.g. Phase 1 project depends on a Phase 2 project) or an omission (a project nobody sequenced
at all). Phase has to be **derived from structure the operator already declares**, with the
system flagging gaps/contradictions rather than silently guessing or trusting an unchecked
label.

**Rejected reuse: the existing intake "Dependency" question (§7).** `dependencySlot.ts`'s
`declaredNodeIds()` scoped candidate nodes to `artifactsById` only — a leftover from when
Dependency was answered only about Deliverables. This operator's data has 2 Deliverables vs.
18 Projects, so reusing the slot as-is could never carry real Project/Initiative sequencing
regardless of how completely it was answered. Fix had to generalize the underlying mechanism,
not just point a UI at it.

**What was built:**

1. **`declareDependency` generalized** (`identityCompute.js`) from artifact-only to
   `DEPENDENCY_NODE_SLICES = ['projectsById', 'initiativesById', 'artifactsById']` via
   `findDependencyNodeSlice(state, id)`. Same validation as before (self-edge rejection, cycle
   guard via `reachesDependency` BFS, `hard_gate`/`directional`/`informational` type
   validation) — only the node-lookup scope changed. Edges still store as
   `matrix.dependenciesById[id] = {id, downstreamId, upstreamId, type, label, declaredAtISO}`,
   convention unchanged: downstream *requires* upstream.
2. **`deriveProjectPhasesFromDependencies(matrix)`**
   (`src/domain/masterGrid/phaseFromDependencies.js`) — takes every CONFIRMED project
   connected by at least one `hard_gate`/`directional` edge (`informational` edges are
   annotation-only and don't order anything), computes an iterative longest-path topological
   layering (`computeLayers`, fixed-point with a `nodes.length + 1` iteration cap as cycle
   defense), then proportionally buckets layers into Phase 1/2/3 across the observed range
   (`bucketLayersToPhases` — single-layer graphs collapse to all Phase 1). Returns
   `Record<projectId, 1|2|3>`, silently omitting nodes that don't participate in any
   qualifying edge (they keep whatever raw `phase` they had, or none).
3. **`buildPhaseReorganizationRecommendations(matrix)`** (same file) — the "recommends
   reorganization" half of the directive. Three codes: `NO_DECLARED_SEQUENCE` (a CONFIRMED
   project with zero dependency edges — an orphan the operator hasn't placed in the story yet),
   `DECLARED_PHASE_CONTRADICTS_DEPENDENCIES` (a hand-typed `phase` field disagrees with what
   the graph derives), `UNRESOLVABLE_SEQUENCE` (participates in edges but got excluded from
   `derivedPhases` — in practice, a cycle the BFS guard didn't block at declare-time but the
   layering pass still can't resolve). These render as plain-language rows, not silent drops.
4. **`buildCausalChainStepsFromMatrix` sort precedence updated** (§ above) — derived phase now
   wins over the raw `phase` field per project
   (`effectivePhase = derivedPhases[id] ?? project.phase`); a project with no dependency signal
   at all keeps its hand-typed phase as a fallback rather than being dropped to the end.
5. **`SequencingPanel.jsx`** — write-capable sibling of `MasterGridTab` (same
   read-only-by-contract pattern as `CapacityConfirmPanel`, per `MasterGridTab`'s own AC4 test:
   "never calls matrixDispatch"). Renders nothing until CONFIRMED projects exist; otherwise a
   "this must happen before this" select-pair form dispatching `DECLARE_DEPENDENCY`, a
   recommendations block, and a derived-phase grouping (Phase 1 — Beginning / Phase 2 — Middle
   / Phase 3 — End) so the operator sees the effect of each declaration immediately. Wired into
   `ZionDashboard.jsx`'s `mastergrid` view alongside `CapacityConfirmPanel`.

**Relationship to §3's `ScheduledBlock.kind`.** `kind: 'PLANNING' | 'CORE' | 'VERIFICATION'`
in the canonical block shape is a *per-deliverable* execution-step label (still tied to
`buildAutoDeliverables`'s 3-tier default breakdown of a single project's work), not the same
axis as Phase 1/2/3 here, which orders *projects relative to each other* across the whole
spine. Both survive in the unified engine: Phase determines a project's position in the causal
chain; `kind` determines how that project's own deliverables break down once scheduled. No
collision, no field to rename.

**Not yet done:** Initiative-level phase derivation (edges declared directly between
Initiatives) is supported by the generalized reducer but has no derivation function yet —
`deriveProjectPhasesFromDependencies` only reads Project-level edges today. `SequencingPanel`
only offers Project-to-Project declaration in its UI. Extending both to Initiatives is
scoped-but-not-built if the operator's data turns out to need cross-initiative sequencing
that doesn't decompose to individual Project edges.

## 6. Consolidated engine

## 6.1 Stage 1 — foundation (2026-07-13, implemented)

Before retiring either existing generator, the two prerequisites §5 already flagged had to
exist for real: a non-silent capacity contract, and a canonical block shape. Both landed
this pass, additive only — nothing existing was removed or rewired yet, so this stage
carries zero regression risk to Generator A or Generator B.

1. **`PARTIAL`/`capacityViolation` contract** (`src/core/deterministicPlanGenerator.ts`).
   `DeterministicPlanResult.status` gained a third value, `'PARTIAL'`, returned whenever
   `proposedBlocks.length < totalBlocksRequired` — i.e., confirmed scope needed more than
   confirmed capacity could hold. The payload names exactly what happened:
   `{ requiredBlocks, availableBlocks, overageMinutes, cutSteps: [{deliverableId,
   deliverableTitle}] }`. Blocks that did fit are still returned and still schedulable —
   `PARTIAL` is not a failure state, it's a flagged one. One pre-existing test
   (`'tight but valid goal still uses fraction of cap'`) turned out to be silently
   encoding the exact bug this closes — 10 blocks required, only 8 available, previously
   asserted as plain `SUCCESS`. Updated to assert `PARTIAL`, not worked around.
2. **Propagation into the reducer** (`identityCompute.js`). `adaptDeterministicResultToColdPlan`
   carries `capacityViolation` onto `cycle.coldPlan`. `generateColdPlanForCycle` sets a new
   top-level `state.lastPlanWarning` (`code: 'CAPACITY_VIOLATION'`) when present —
   deliberately separate from `state.lastPlanError`, which still only fires on
   zero-blocks/true infeasibility. The action-seeding guard
   (`deterministicResult.status === 'SUCCESS'`) was widened to include `'PARTIAL'` — blocks
   that fit still need actions.
3. **`projectId` pass-through** (`causalChainFromMatrix.js`, `deterministicPlanGenerator.ts`).
   `buildCausalChainStepsFromMatrix` now includes `projectId` on each step, carried opaquely
   through `buildAutoDeliverables` (`sourceProjectId` on `AutoDeliverable`) and the block
   allocation loop (`sourceProjectId` on `ProposedBlock`) — undefined for manually-authored
   causal chains and the generic 3-tier fallback, since those have no matrix Project to
   trace back to. The generic generator does not interpret this field; it only carries it.
4. **Canonical `ScheduledBlock` builder** (`src/domain/masterGrid/scheduledBlocksFromDeterministicResult.js`,
   pure function). Adapts `DeterministicPlanResult.proposedBlocks` into real `ScheduledBlock[]`
   per §3: resolves `entityId`/`entityLabel`/`initiativeId`/`laneId`/`laneLabel` from the
   matrix via `sourceProjectId` (null when absent — no guessing), stacks same-day blocks
   back-to-back with real `startISO`/`endISO` starting at a configurable `dayStartTime`
   (default 09:00 local), and always sets `status: 'proposed'` regardless of `SUCCESS` vs
   `PARTIAL` (commit is a later, separate lifecycle step, §4).
5. **`cycle.schedule` wired in, additive** (`generateColdPlanForCycle`). Alongside the
   existing `cycle.coldPlan` (not replacing it yet), every generate now also produces
   `cycle.schedule = { version, generatorVersion, strategyId, assumptionsHash,
   createdAtISO, blocks: ScheduledBlock[], infeasible?, capacityViolation? }` from the exact
   same matrix-derived spine and capacity already driving `coldPlan`. Nothing reads
   `cycle.schedule` yet — it exists so Stage 2 has a real, tested foundation to point
   consumers at rather than building the shape and the rewiring in the same step.

All covered by tests: `deterministicPlanGenerator.test.ts` (capacity-violation contract +
projectId pass-through, 34 tests), `causalChainFromMatrix.test.js` (projectId traceability,
11 tests), `scheduledBlocksFromDeterministicResult.test.js` (10 tests),
`generateColdPlan.canonicalSchedule.test.js` (4 integration tests via `computeDerivedState`),
plus a full regression sweep of every file touched in the capacity/phase stages (141 tests
total this pass, zero failures).

## 6.2 Stage 2 — revised after investigation (2026-07-13): do NOT retire `generatePlan`

Reading `generatePlan` end to end (`identityCompute.js:12054`) before touching it surfaced
a finding that changes this section's plan. It is not a redundant twin of
`generateColdPlanForCycle` — it is a load-bearing production system this design's original
framing ("two schedule generators... none of which talk to each other") undersold:

- Its real block-allocation work is delegated to `compileAutoAsanaPlan`, a substantially
  richer engine than `generateDeterministicPlan`: LLM-derived action graphs, session-plan
  pacing (weekly-hours-available → derived-sessions-per-week with sustainable-pace capping),
  dependency chains (`directDependencyIds`/`transitiveDependencyIds`), capital gates,
  pathway tags, commerce-readiness levels, and an extensive pre-flight gate taxonomy
  (`CURRENT_STATE_REASSESSMENT_REQUIRED`, `REGENERATE_BLOCKED_ACTIVE_SCHEDULE`,
  `GOAL_NOT_ADMITTED`, intake-readiness gates, recovery snapshots) that has nothing to do
  with which algorithm places blocks on a calendar.
- Its constraint resolution (`resolveCycleScopedConstraints` → `resolveCycleCapacityPerDay`)
  feeds directly into `deriveRecoveryAnalysis` — i.e., touching how this path resolves
  capacity is touching course-correction/recovery machinery, which the operator explicitly
  deferred until plan quality is reconfirmed (§8, phase 5). This is a real coupling, not an
  incidental one.

Replacing this with Stage 1's simpler, matrix-driven engine would be a capability
regression, not a unification — `generateColdPlanForCycle`'s `GENERIC_DETERMINISTIC` path
is the right, deliberately simpler tool for cycles with matrix intake but no admitted
goal/action-graph yet; `generatePlan` is the right tool once a goal is admitted and has a
real action graph. **They are not the same job.** The design doc's original premise that
these should merge into one algorithm does not survive contact with the actual code, and
forcing that merge would either delete tested, working capability or silently re-implement
a large fraction of `compileAutoAsanaPlan` under a new name — neither is "alignment."

**What genuinely is duplicated and still worth fixing:** which generator runs today is
decided by *which UI button the operator presses* (`Workspace.jsx`'s legacy Strategy panel
dispatches `GENERATE_COLD_PLAN`; `ZionDashboard.jsx`'s real dashboard button dispatches
`GENERATE_PLAN`/`REBUILD_SCHEDULE`), not by inspecting the cycle's own state the way
`generatePlan` already internally branches to `generateMasterPlanFirstCycle` via
`shouldUseMasterPlanBridge`. A single `GENERATE_SCHEDULE` entry point that inspects
`cycle.goalContract?.planGenerationMechanismClass` and the admission/action-graph state to
route to the correct *existing, unmodified* internal engine — the same pattern the code
already uses for the Master Plan branch — would close that real gap without touching either
engine's internals or its deferred-system coupling. This is a routing consolidation, not an
algorithm merge, and is the only form of "Stage 2" that's actually safe to build.

Flagged back to the operator (2026-07-13) rather than executed unilaterally, since it
reverses part of the original Stage 2 scope agreed earlier in this design. Operator's
decision: **routing consolidation only** — build the `GENERATE_SCHEDULE` entry point
described above; do not touch either engine's internals; leave the "nothing more for now"
and "touch the recovery coupling too" options on the table but unexercised.

**Implemented (2026-07-13):** `routeGenerateSchedule` (`identityCompute.js`, added
immediately before `generatePlan`) and a new `case 'GENERATE_SCHEDULE'` in the reducer
switch. It calls `generatePlan` first, completely unmodified — every cycle that already
works today (admitted goal, real action graph, Master Plan bridge) behaves identically to
dispatching `GENERATE_PLAN` directly. Only when `generatePlan` itself reports its own
existing `NO_ACTION_GRAPH` signal (no admitted contract, or no action graph/planProof yet)
does the router fall back to `generateColdPlanForCycle`'s matrix-driven engine, also
completely unmodified. Every other `generatePlan` gate (`CYCLE_READ_ONLY`,
`GOAL_NOT_ADMITTED`, intake-readiness codes, `CURRENT_STATE_REASSESSMENT_REQUIRED`,
`REGENERATE_BLOCKED_ACTIVE_SCHEDULE`, ...) is a real block and is left standing — the
router does not attempt a fallback in those cases, since a fallback would silently
override a legitimate gate rather than serve an unready cycle.

`identityStore.js`'s `generateScheduleForActiveCycle` — the function `ZionDashboard.jsx`'s
actual Generate button calls — now dispatches `GENERATE_SCHEDULE` instead of `GENERATE_PLAN`
directly. This is a strict improvement with no behavior change for the common case (admitted
goal + action graph → identical result) and a new capability for the previously-dead-end
case (matrix-only cycle, no admitted goal yet → now produces a real schedule instead of
erroring with `NO_ACTION_GRAPH` and nothing else happening). `Workspace.jsx`'s legacy
Strategy panel (dispatching `GENERATE_COLD_PLAN` directly) was deliberately left unchanged —
rerouting it through `generatePlan` first could change what that specific legacy button does
for a cycle that happens to have both matrix data and an admitted action graph, and that
behavior change wasn't part of the safe, additive story here.

`GENERATE_COLD_PLAN`/`REBASE_COLD_PLAN`/`GENERATE_PLAN`/`REBUILD_SCHEDULE` are NOT retired —
they still work exactly as before for any caller that dispatches them directly (many existing
tests do). `GENERATE_SCHEDULE` is additive: a new, smarter entry point layered on top, not a
replacement for the four underlying actions.

Covered by tests: `generateSchedule.routing.test.js` (3 tests — action-graph cycle routes
through `generatePlan` unchanged, matrix-only cycle falls back and produces a real
`cycle.schedule`, a blocked cycle's specific error is preserved with no fallback attempted),
plus a full regression sweep of `generateApply.integration.test.js`,
`generateApply.gating.test.js`, `forecast_and_commit_do_not_mix.test.js`, and the
`ZionDashboard.generateSchedule.dispatch.test.jsx` UI smoke test — all passing. (One
unrelated pre-existing failure, `suggestion.accept.idempotence.test.js`, was found and
confirmed via a HEAD-vs-working-tree comparison to already fail at the base commit, before
any change in this design's scope — not a regression from this work.)

The originally-imagined single `generateSchedule(state, { mode })` function that would
"replace" `generateColdPlanForCycle`, `generatePlan`, and `generateMasterPlanFirstCycle`
outright (retiring `GENERATE_COLD_PLAN`/`REBASE_COLD_PLAN`/`GENERATE_PLAN`/`REBUILD_SCHEDULE`
into one action) is **abandoned**, superseded by the routing approach above, per the finding
at the top of this section. The canonical `ScheduledBlock` shape (§3) and `cycle.schedule`
(§6.1) remain real and in use on the matrix-driven path; they were never extended to the
`generatePlan`/`compileAutoAsanaPlan` path, and per this section's finding, should not be.

The Master Plan lanes/milestones bridge is the one piece not fully absorbed by this pass
(see §7) — short-term, `generateSchedule` can detect `shouldUseMasterPlanBridge` the same
way `generatePlan` does today and delegate, so nothing currently working on that path
regresses; it's just not unified yet.

## 6.3 Closing the loop: the matrix engine had nowhere to surface (2026-07-13, same day)

Operator question, verbatim: "if the matrix intake is not an automatic feature and is
conditional, what triggers a matrix intake process vs the alternative intake process." Tracing
the actual live admission flow (not just the reducer logic) to answer this precisely turned up
something that changes how §6.2 should be understood in practice:

- `MatrixIntake.jsx`'s `GoalEntryScreen` → `handleGoalAdmit` → `attemptGoalAdmission` is the
  only reachable admission path in the shipped app. It unconditionally sets
  `newCycle.matrixIntakeComplete = false` on every admitted cycle — there is no branch, no
  condition, no alternative. Every real goal goes through Matrix intake.
- Three candidate "alternatives" were checked and none are live: `GoalAdmissionPage.tsx` is
  imported by nothing else in the app (orphaned); `COMPLETE_ONBOARDING`+`COMPILE_GOAL_EQUATION`
  (the fixture this design's own tests use to exercise `generatePlan`'s action-graph path) is
  dispatched only from test files, nowhere in `src/components`; `generatePlanWithLLM` (a real,
  fully-wired mechanism that would populate a genuine LLM action graph, even referenced in
  `ZionDashboard.jsx`) is dead in practice — `handleGenerateSchedule`'s `typeof
  actions.generateScheduleForActiveCycle === 'function'` check always short-circuits before it.

**Consequence for §6.2:** the "fallback to the matrix engine" isn't an edge case triggered only
when a goal lacks an action graph — given the above, it is the only thing `routeGenerateSchedule`
will ever actually execute, for every cycle, always. Which surfaced the real gap: the fallback
(`generateColdPlanForCycle`) wrote `cycle.coldPlan`/`cycle.schedule` but never
`state.proposedBlocks` — the one thing the dashboard's Review/Apply screen and
`applyDraftSchedule`/`activateSchedule` actually read (confirmed via `grep`: `cycle.coldPlan`/
`forecastByDayKey` are rendered only by `Workspace.jsx`, which is imported but never mounted
anywhere live). The matrix engine was computing a real, correct schedule with no way for the
operator to see or act on it.

**Fix, additive, no changes to the review/apply pipeline itself:**
`src/domain/masterGrid/proposedBlocksFromSchedule.js` — pure function
`buildProposedBlocksFromSchedule(scheduledBlocks, opts)` adapts canonical `ScheduledBlock[]`
into the 'suggested' proposal shape `generatePlan`'s `compileAutoAsanaPlan` path already
produces (`title` instead of `deliverableTitle`, `status: 'suggested'`, `source:
'matrix_schedule_generation'` so its origin is distinguishable). This works because
`buildScheduleReviewBlock` (the function that turns a proposal into a review block) only ever
hard-required `item.startISO` to be present — everything else is defensively defaulted — and
every Stage-1 `ScheduledBlock` already has a real `startISO`/`endISO`. Wired into
`routeGenerateSchedule`'s fallback branch: after `generateColdPlanForCycle` runs, its
`cycle.schedule.blocks` are adapted and written via `setCycleProposedBlocks`, the same
normalizer `generatePlan` itself calls.

Verified end to end, not just at the seam: `generateSchedule.routing.test.js` gained a test
that runs `GENERATE_SCHEDULE` → `APPLY_DRAFT_SCHEDULE` → `ACTIVATE_SCHEDULE` on a matrix-only
cycle and confirms real committed blocks come out the other end — `cycle.scheduleReviewBlocks`
populated at `applied_review`, then `active_schedule` after activation, with execution-create
events emitted for every block. One finding worth recording as its own regression test
(`zzz_debug_activate.test.js`): a multi-day generated schedule commits across every day it
spans, but `state.today.blocks` only ever reflects the current day's share of that — don't
mistake a day-scoped view for the full commit count when auditing activation (this cost real
debugging time before the day-boundary explanation was found).

Not touched, deliberately: `applyDraftSchedule`, `activateSchedule`, `buildScheduleReviewBlock`,
`createBlock` — all reused exactly as they already existed for `generatePlan`'s output. This is
the same "reuse the existing engine, only bridge the gap" discipline as §6.2's routing fix, not
a new lifecycle built for the matrix path.

## 6.4 Initiative-level phase declaration — closing the phasing scalability gap (2026-07-13, same day)

Operator feedback after seeing the live `SequencingPanel` with all 18 CONFIRMED Projects
flagged `NO_DECLARED_SEQUENCE`, verbatim: "the matrix intake being the only intake makes sense
... but if it ain't broke don't fix it ... phasing is still open. even if this is right in
principle its not practical in this situation at this point to sequence OFL through I AM THE
STATE." Pairwise Project-to-Project dependency declaration (§5.5) is structurally sound but
doesn't scale once a portfolio holds many unrelated content lines — the operator's actual
portfolio is ~18 CONFIRMED Projects across ~10 Initiatives, most with no meaningful pairwise
relationship to declare (a franchise entry like "OUR FEARLESS LEADER 3" has nothing to say
about "I AM THE STATE"). ~153 possible pairwise combinations at that scale is not a
declaration UI, it's a chore.

**Resolution, confirmed with the operator before building:** declare phase once per
Initiative (~10 decisions instead of 18+ Projects or ~153 pairwise edges); Projects inherit
their owning Initiative's declared phase by default. The existing Project-level dependency
mechanism (§5.5) is kept, unmodified, as an optional finer-grained override for the cases
where within-initiative ordering is actually meaningful.

**Built, additive, no changes to existing dependency-derivation behavior:**

- `Initiative.phase` already existed in `jericho_matrix_schema.json` (same shape as
  `Project.phase`, `string|null`) — no schema change needed, confirmed by reading the schema
  before writing any code.
- `SET_INITIATIVE_PHASE` reducer action (`identityCompute.js`, `setInitiativePhase`) — a
  direct one-field set (`{id, phase}`), deliberately as simple as `CONFIRM_CAPACITY`: no
  survey, no graph edge, just a declared value with existence validation
  (`INITIATIVE_UNKNOWN`/`INITIATIVE_PHASE_INVALID` on `state.lastPlanError` for bad input).
- `deriveEffectiveProjectPhases(matrix)` (`src/domain/masterGrid/phaseFromDependencies.js`) —
  merges every phase signal for a CONFIRMED Project, most specific first: (1)
  dependency-derived phase (existing `deriveProjectPhasesFromDependencies`, most specific —
  the project actually participates in a declared sequence), (2) the project's own
  hand-typed `phase` field (existing fallback), (3) its owning Initiative's declared phase
  (new — the coarse default). A project with none of the three is left out of the result
  entirely, same "don't guess" discipline as the underlying dependency derivation.
- `buildPhaseReorganizationRecommendations` refined: `NO_DECLARED_SEQUENCE` no longer fires
  for a Project whose owning Initiative already has a declared phase (inheritance is now a
  legitimate phase source, not a gap); added `PROJECT_PHASE_CONTRADICTS_INITIATIVE` (a
  Project's dependency-derived phase disagrees with its Initiative's declared phase — surfaces
  the same class of contradiction `DECLARED_PHASE_CONTRADICTS_DEPENDENCIES` already catches at
  the Project's own hand-typed field) and `INITIATIVE_NO_PHASE_DECLARED` (an Initiative owns
  CONFIRMED Projects but has never had its phase declared at all — the new "recommend
  reorganization" surface, moved to the more natural altitude of ~10 Initiatives instead of
  18+ Projects).
- `buildCausalChainStepsFromMatrix` (`causalChainFromMatrix.js`) now sorts on
  `deriveEffectiveProjectPhases` directly instead of a two-tier
  own-phase-then-initiative-phase-as-tiebreak split — Initiative-inherited phase is now a
  first-class phase value, not merely a tiebreaker among projects with no signal at all. This
  legitimately changes ordering for a project that has no own phase but does have an
  Initiative-declared one (it now ties with a project that has the *same* phase typed
  directly, rather than always sorting after it) — the pre-existing
  `causalChainFromMatrix.test.js` case encoding the old two-tier assumption was updated to
  assert the new tie-grouping instead of a specific intra-tie order (which was always
  arbitrary/alphabetical, per the existing "ties break alphabetically" test).
- `SequencingPanel.jsx` — new "Declare phase once per initiative" section above the existing
  dependency-declaration form (now labeled "optional — only needed for finer within-initiative
  ordering"): lists every Initiative that owns a CONFIRMED Project with a Phase 1/2/3
  selector, dispatching `SET_INITIATIVE_PHASE`. The derived-phase grouping display and
  recommendations list both now read `deriveEffectiveProjectPhases`/the refined
  recommendations, so a Project inheriting its phase from its Initiative shows up in the
  Phase 1/2/3 groupings exactly like a Project with its own dependency-derived or hand-typed
  phase.

Covered by tests: `setInitiativePhase.test.js` (6, reducer), `phaseFromDependencies.test.js`
(28, including 7 new for `deriveEffectiveProjectPhases` and 8 new for the refined/added
recommendation codes), `causalChainFromMatrix.test.js` (11, including the updated
inheritance-tie-grouping case), `SequencingPanel.test.jsx` (12, including 6 new for the
initiative-phase UI). Full regression sweep across `src/domain/masterGrid`,
`src/components/zion`, and the `identityCompute.js`-dependent `src/state/__tests__` /
`tests/state`, `tests/components` suites confirmed no other consumer of the touched functions
exists and no pre-existing test broke (two unrelated pre-existing failures —
`autoAsana.scheduler.v1_1.test.js`'s title-formatting assertions and
`suggestion.accept.idempotence.test.js` — were already failing at HEAD, confirmed unrelated to
any file touched in this pass).

## 7. Decisions

1. **Master Plan bridge — RESOLVED: fold into the unified spine.** Lanes/milestones
   become a second spine source alongside matrix Projects, feeding the same
   `generateSchedule`. No permanent special-case branch. This is the larger lift in the
   Plan doc — `buildMasterPlanFirstCycleProposals` has its own milestone-expansion logic
   (`identityCompute.js:6303-6746`) that needs to be reconciled with
   `buildCausalChainStepsFromMatrix`'s ordering rather than living beside it.
2. **Capacity granularity — RESOLVED: per entity, shared pool.** One `capacityById` row
   per owning entity; the generator allocates every CONFIRMED causal step under that
   entity against the one pool and flags `PARTIAL`/`capacityViolation` when confirmed
   scope exceeds it (§5). No per-lane/per-initiative time budgeting by the operator.
3. **Migration of existing cycles — RESOLVED, implemented.** Not a multi-tenant migration
   problem — there is one operator, one active dataset, and the "legacy" fields
   (`goalContract.workWindows`, `availabilityPolicy`, `strategy.constraints`) are just
   today's data sitting in today's field names, entered through today's Structure-page UI.
   Resolution: `seedCapacityFromLegacyConstraints` reads whichever of those already has
   data and carries it forward *as-is* — no re-entry, no new intake survey — into a new
   `capacityById` row landed as **DRAFT**, not auto-CONFIRMED, consistent with how every
   other matrix row already treats unverified data. `CONFIRM_CAPACITY` is the one-click
   promotion (`CapacityConfirmPanel.jsx`), deliberately not routed through the bulk
   `MARK_MATRIX_INTAKE_COMPLETE` readback promotion (which only touches
   entities/initiatives/projects/artifacts/systems by design) — capacity requires its own
   explicit confirmation so the operator can observe the effect of confirming it, per
   their explicit request, rather than it silently riding along with an unrelated intake
   completion.
4. **Phase — RESOLVED, implemented (§5.5).** Not operator-entered. Derived from a
   generalized dependency graph (`declareDependency`, now Project/Initiative/Artifact) via
   topological layering (`deriveProjectPhasesFromDependencies`), with gaps and
   contradictions surfaced as explicit reorganization recommendations
   (`buildPhaseReorganizationRecommendations`) rather than silently guessed or trusted from
   an unchecked hand-typed field. Matches the operator's directive to build "the machine
   that considers my phasing in the intake and if needed recommends reorganization," not
   one that asks them to type a phase number per project.

## 8. Sequencing (per operator direction)

1. This design — done.
2. Interim capacity plumbing (§5, §7.2, §7.3) — **done**: schema, seed-from-legacy,
   one-click confirm, matrix→constraints translation wired into the existing
   `generateColdPlanForCycle`. Observable now: confirm a carried-forward capacity row in
   the running app and re-generate to see the schedule change.
2b. Phase/sequencing (§5.5, §7.4) — **done**: generalized dependency declaration,
   dependency-graph-derived Phase 1/2/3, reorganization recommendations, wired into causal
   chain ordering, `SequencingPanel` UI. Observable now: declare "X before Y" between
   CONFIRMED projects in the running app and see the derived phase groupings and any
   reorganization flags update immediately, with the causal chain (and therefore the
   generated schedule's ordering) reflecting the declared sequence instead of alphabetical
   fallback.
3. Full `generateSchedule` engine (§6) — **Stage 1 (§6.1) done**: `PARTIAL`/
   `capacityViolation` contract fix, `projectId` pass-through, canonical `ScheduledBlock`
   builder, and an additive `cycle.schedule` built alongside `cycle.coldPlan` on every
   generate. Observable now: `cycle.schedule.blocks` on the active cycle carries real
   `startISO`/`endISO` and entity/lane identity, and a too-small confirmed capacity now
   flags `state.lastPlanWarning`/`cycle.coldPlan.capacityViolation` instead of silently
   truncating. **Stage 2 (§6.2) done, in its revised form**: investigation found
   `generatePlan` is not a redundant twin (it delegates to `compileAutoAsanaPlan`, entangled
   with deferred recovery machinery) — full algorithm unification was abandoned as a
   capability regression. Built instead: `GENERATE_SCHEDULE`, a routing consolidation
   (`routeGenerateSchedule` in `identityCompute.js`) that tries `generatePlan` unmodified
   first, falling back to `generateColdPlanForCycle` unmodified only on `generatePlan`'s own
   `NO_ACTION_GRAPH` signal. `identityStore.js`'s `generateScheduleForActiveCycle` (the real
   dashboard button) now dispatches this. **§6.3 (2026-07-13, same day) done**: closed the
   loop between the matrix engine's output and the dashboard's Review/Apply screen —
   `buildProposedBlocksFromSchedule` bridges `cycle.schedule.blocks` into
   `state.proposedBlocks`, verified end to end through `APPLY_DRAFT_SCHEDULE` →
   `ACTIVATE_SCHEDULE` with real committed blocks coming out the other end, no changes to
   the review/apply pipeline itself. Given the matrix engine is, in practice, the only path
   that ever runs (see §6.3), this was the load-bearing gap, not a nice-to-have. **Not done,
   and no longer planned in original form**: Master Plan bridge fold-in (§7.1), a rewrite of
   the review/apply lifecycle for its own sake (reuse turned out to be sufficient), retiring
   the four legacy actions. **§6.4 (2026-07-13, same day) done**: closed the phasing
   scalability gap — `SET_INITIATIVE_PHASE` + `deriveEffectiveProjectPhases` let phase be
   declared once per Initiative and inherited by its Projects, with the existing
   Project-level dependency mechanism kept as an optional finer override. Observable now:
   set a phase on an Initiative in `SequencingPanel` and see every CONFIRMED Project under it
   (that has no more specific signal of its own) join that phase's grouping and drop out of
   the `NO_DECLARED_SEQUENCE` recommendations immediately.
4. Re-run and reconfirm `evaluatePlanQualityGate`'s full suite against real matrix-driven
   schedules (not synthetic fixtures) — this is the explicit checkpoint before phase 5.
   This no longer depends on a Stage 2 that isn't happening in its original form; it can
   proceed against the matrix-driven `cycle.schedule` path (Stage 1/§6.3) whenever the
   operator is ready, since `generatePlan`'s path was never going to be touched by this
   design.
5. Only after 4 passes clean: course correction (`applyExecutionCorrection`), initial
   feasibility (`applyFeasibility`), and live probability of success
   (`applyProbabilityScoring`/`applyProbabilityEligibility`) get the same audit-and-wire
   treatment — tracing what they actually key off today, the way this whole effort began
   with the schedule generator.
