# Documentation Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize ~140 accumulated working documents into a navigable, AI-loadable reference structure with a clean archive for historical artifacts.

**Architecture:** All historical docs move to `docs/archive/` in one mechanical pass. Live docs are promoted or synthesized into `docs/architecture/` (structural decisions) and `docs/reference/` (invariant contracts). Six new synthesis docs are written from code + archived specs.

**Tech Stack:** Git (file moves), Markdown

---

## File Map

**Created:**
- `docs/archive/root/` — ~80 root-level `.md` files
- `docs/archive/docs-root/` — non-promoted `docs/` root files + retired architecture files
- `docs/archive/phases/` — `docs/phases/` contents
- `docs/archive/modules/` — `docs/modules/` contents
- `docs/archive/misc/` — open-questions, freeze, loose audit docs
- `docs/archive/README.md` — one-liner explaining the archive
- `docs/architecture/execution-model.md` — new synthesis
- `docs/architecture/authority-maps.md` — merged from two source files
- `docs/architecture/scheduling-semantics.md` — promoted from `docs/scheduling_contract.md`
- `docs/architecture/source-of-truth.md` — promoted from `docs/source-of-truth-ownership.md`
- `docs/reference/pos-trust-state.md` — new synthesis
- `docs/reference/plan-quality-gate.md` — new synthesis
- `docs/reference/terminal-endpoint-rules.md` — new synthesis
- `docs/reference/goal-admission-policy.md` — new synthesis
- `docs/reference/execution-event-ledger.md` — promoted from `docs/execution-events.md`
- `docs/reference/goal-to-deliverable.md` — promoted from `docs/GOAL_TO_DELIVERABLE_COMPILER_CONTRACT.md`
- `docs/README.md` — new master index (replaces existing)

**Archived (git mv'd, not deleted):**
- All ~80 root-level `.md` files
- All non-promoted `docs/` root files
- All `docs/architecture/` files except `UI_AUTHORITY_MAP.md` + `PROBABILITY_AUTHORITY_MAP.md` (used in merge then archived)
- `docs/phases/`, `docs/modules/`, `docs/open-questions/`, `docs/freeze/`

---

## Task 1: Create archive directory structure

**Files:**
- Create: `docs/archive/root/`, `docs/archive/docs-root/`, `docs/archive/phases/`, `docs/archive/modules/`, `docs/archive/misc/`

- [ ] **Step 1: Create archive subdirectories**

```bash
mkdir -p docs/archive/root docs/archive/docs-root docs/archive/phases docs/archive/modules docs/archive/misc
```

- [ ] **Step 2: Verify directories exist**

```bash
ls docs/archive/
```
Expected output:
```
docs-root  misc  modules  phases  root
```

---

## Task 2: Archive all root-level `.md` files

Everything at the repo root except `README.md` and `CLAUDE.md`.

**Files:**
- Modify: ~80 files moved via `git mv`

- [ ] **Step 1: Move all root-level docs to archive**

```bash
find . -maxdepth 1 -name "*.md" ! -name "README.md" ! -name "CLAUDE.md" | while read f; do git mv "$f" docs/archive/root/; done
```

- [ ] **Step 2: Verify root is clean**

```bash
ls *.md
```
Expected output:
```
CLAUDE.md  README.md
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(docs): archive all root-level working documents"
```

---

## Task 3: Archive historical `docs/` root files

These are the non-promoted files currently sitting in `docs/` root. The four files being promoted (scheduling_contract.md, source-of-truth-ownership.md, execution-events.md, GOAL_TO_DELIVERABLE_COMPILER_CONTRACT.md) are left in place for Task 5.

**Files:**
- Modify: ~35 files moved via `git mv`

- [ ] **Step 1: Move non-promoted docs/ root files to archive**

```bash
cd docs && for f in \
  ARCHETYPE_EXECUTION_SPEC_MATRIX_1.0.md \
  ARCHETYPE_RULE_EVALUATION_PHASE_B.md \
  ARCHETYPE_RULE_EVALUATION_PHASE_B5_LIVE_TRACES.md \
  COMPILER_SCORECARD_INTEGRATION_PASS.md \
  FREEZE_1.0_DECISION_ARTIFACT.md \
  FULL_MATRIX_EXECUTION_PASS_1.md \
  GOAL_TO_DELIVERABLE_BASELINE_AUDIT.md \
  GUM_CHAIN_REFERENCE_LANE_FREEZE.md \
  JERICHO_AGENT_INTEGRATION_ASSESSMENT.md \
  JERICHO_AGENT_INTEGRATION_DOCTRINE.md \
  JERICHO_AGENT_INTEGRATION_PATTERN_ROLE_A.md \
  JERICHO_AGENT_MINIMAL_IMPLEMENTATION_PLAN.md \
  JERICHO_CANONICAL_45_FAMILY_ROLLOUT_PLAN.md \
  JERICHO_CANONICAL_45_HARDENING_MATRIX.md \
  JERICHO_CLASSIFICATION_CONFIDENCE_PLAN.md \
  JERICHO_CONTEXT_ADMISSION_MATRIX_1.0.md \
  JERICHO_COURSE_CORRECTION_MATRIX_1.0.md \
  JERICHO_PHASE1_BASELINE.md \
  JERICHO_PHASE_A_CLOSURE.md \
  JERICHO_PHASE_B_CLOSURE.md \
  JERICHO_PHASE_C_CLOSURE.md \
  JERICHO_PHASE_C_COMPOSITION_PLAN.md \
  JERICHO_PHASE_D_CLOSURE.md \
  JERICHO_PHASE_D_E2E_VALIDATION_PLAN.md \
  JERICHO_POS_ACCEPTANCE_PLAN.md \
  JERICHO_POS_HARDENING_SPEC.md \
  JERICHO_POS_WAVE2_IMPLEMENTATION_NOTES.md \
  JERICHO_POS_WAVE3_ACCEPTANCE_PLAN.md \
  JERICHO_POS_WAVE3_SCOPE.md \
  JERICHO_ROLE_B_ADMISSION_CRITERIA.md \
  PHASE_C_MIGRATION_AUDIT.md \
  PHASE_F_ROLE_A_FREEZE_PACKAGE.md \
  RECOVERY_OPERATIONALIZATION_PASS_1.md \
  SCHEDULING_SEMANTICS_CONTRACT.md \
  SCHEDULING_SEMANTIC_AUDIT.md \
  architecture.md \
  cycle-end-ux-notes.md \
  cycle-ux-audit.md \
  runtime-verification-1.0.6.2.md \
  typo-audit.md; do
  [ -f "$f" ] && git mv "$f" archive/docs-root/
done
cd ..
```

- [ ] **Step 2: Move docs/api/ to archive**

```bash
git mv docs/api docs/archive/docs-root/api
```

- [ ] **Step 3: Verify — only expected files remain in docs/ root**

```bash
ls docs/*.md
```
Expected (files being promoted + existing README.md):
```
docs/GOAL_TO_DELIVERABLE_COMPILER_CONTRACT.md
docs/README.md
docs/execution-events.md
docs/scheduling_contract.md
docs/source-of-truth-ownership.md
```

---

## Task 4: Archive `docs/phases/`, `docs/modules/`, `docs/open-questions/`, `docs/freeze/`

**Files:**
- Modify: ~25 files moved via `git mv`

- [ ] **Step 1: Move phases, modules, open-questions, freeze to archive**

```bash
git mv docs/phases docs/archive/phases
git mv docs/modules docs/archive/modules
git mv docs/open-questions docs/archive/misc/open-questions
git mv docs/freeze docs/archive/misc/freeze
```

- [ ] **Step 2: Verify directories are gone from docs/**

```bash
ls docs/
```
Expected: `GOAL_TO_DELIVERABLE_COMPILER_CONTRACT.md  README.md  architecture  development  execution-events.md  scheduling_contract.md  source-of-truth-ownership.md  superpowers`

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(docs): archive historical docs — phases, modules, open-questions, freeze, docs-root"
```

---

## Task 5: Archive retired `docs/architecture/` files

Keep `UI_AUTHORITY_MAP.md` and `PROBABILITY_AUTHORITY_MAP.md` in place temporarily — they're the sources for the Task 6 merge.

**Files:**
- Modify: 5 `docs/architecture/` files moved

- [ ] **Step 1: Move retired architecture files to archive**

```bash
git mv docs/architecture/EXECUTION_PLAN.md docs/archive/docs-root/
git mv docs/architecture/MVP3_AUDIT_NOTES.md docs/archive/docs-root/
git mv docs/architecture/STRUCTURE_TAB_REDESIGN.md docs/archive/docs-root/
git mv docs/architecture/UI_AUDIT_REPORT.md docs/archive/docs-root/
git mv docs/architecture/README.md docs/archive/docs-root/architecture-README.md
```

- [ ] **Step 2: Verify — only source files remain in docs/architecture/**

```bash
ls docs/architecture/
```
Expected:
```
PROBABILITY_AUTHORITY_MAP.md  UI_AUTHORITY_MAP.md  probabilitySpec.md
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(docs): archive retired architecture docs"
```

---

## Task 6: Promote four files and write the authority-maps merge

**Files:**
- Create: `docs/architecture/scheduling-semantics.md`, `docs/architecture/source-of-truth.md`, `docs/architecture/authority-maps.md`
- Create: `docs/reference/execution-event-ledger.md`, `docs/reference/goal-to-deliverable.md`
- Create: `docs/reference/` directory
- Archive: `docs/architecture/UI_AUTHORITY_MAP.md`, `docs/architecture/PROBABILITY_AUTHORITY_MAP.md`, `docs/architecture/probabilitySpec.md`

- [ ] **Step 1: Create docs/reference/ directory**

```bash
mkdir -p docs/reference
```

- [ ] **Step 2: Promote four straight-promotion files**

```bash
git mv docs/scheduling_contract.md docs/architecture/scheduling-semantics.md
git mv docs/source-of-truth-ownership.md docs/architecture/source-of-truth.md
git mv docs/execution-events.md docs/reference/execution-event-ledger.md
git mv docs/GOAL_TO_DELIVERABLE_COMPILER_CONTRACT.md docs/reference/goal-to-deliverable.md
```

- [ ] **Step 3: Update H1 titles (remove phase-version stamps)**

In `docs/architecture/scheduling-semantics.md`, change the first line from:
```
# Scheduling Contract (Jericho 1.0.6.1)
```
to:
```
# Scheduling Semantics
```

In `docs/architecture/source-of-truth.md`, change the first line from:
```
# Source Of Truth Ownership (Phase 1.0.6.3)
```
to:
```
# Source of Truth Ownership
```

- [ ] **Step 4: Write `docs/architecture/authority-maps.md`**

Merge of `UI_AUTHORITY_MAP.md` and `PROBABILITY_AUTHORITY_MAP.md` + `probabilitySpec.md`. Create the file with this content:

```markdown
# Authority Maps

## UI Authority

Classifies every UI panel and control by write authority. A component must not write to store state above its authority level.

**Legend:**
- `AUTHORITATIVE` — writes to source-of-truth (state/events)
- `ADVISORY` — configures suggestions/behavior, does not write unless explicitly applied
- `REFLECTIVE` — read-only derived display; never writes

| ID | Label | Authority | Unit | Scope | Writes | Enforced By |
|---|---|---|---|---|---|---|
| goal.intake.family | Goal family selector | AUTHORITATIVE | goal.family | cycle | identityStore:compileGoalEquation | goalEquation:compileGoalEquationPlan |
| goal.intake.target | Goal target value | AUTHORITATIVE | goal.target | cycle | identityStore:compileGoalEquation | goalEquation:compileGoalEquationPlan |
| goal.intake.deadline | Goal deadline | AUTHORITATIVE | dayKey | cycle | identityStore:compileGoalEquation | goalEquation:compileGoalEquationPlan |
| goal.intake.constraints | Goal constraints + non-negotiables | AUTHORITATIVE | constraint flags | cycle | identityStore:compileGoalEquation | goalEquation:compileGoalEquationPlan |
| goal.intake.submit | Compile goal equation | AUTHORITATIVE | plan proof | cycle | identityStore:compileGoalEquation | goalEquation:compileGoalEquationPlan |
| tabs.structure | Structure tab | AUTHORITATIVE | — | ui | ZionDashboard:setZionView | — |
| today.block.complete | Block complete button | AUTHORITATIVE | execution event | day | identityStore:appendExecutionEvent | executionContract:canEmitExecutionEvent |
| today.block.create | Add block (Today) | AUTHORITATIVE | execution event | day | identityStore:appendExecutionEvent | executionContract:canEmitExecutionEvent |
| today.block.reschedule | Reschedule block | AUTHORITATIVE | execution event | day | identityStore:appendExecutionEvent | executionContract:canEmitExecutionEvent |
| schedule.apply | Apply draft schedule | AUTHORITATIVE | committed blocks | cycle | identityStore:APPLY_DRAFT_SCHEDULE | — |
| deliverable.edit | Edit deliverable | AUTHORITATIVE | deliverable | cycle | identityStore:UPDATE_DELIVERABLE | — |
| pos.display | POS score panel | REFLECTIVE | score display | cycle | — | probabilityScore:derivePosDisplayPolicy |
| feasibility.display | Feasibility indicator | REFLECTIVE | feasibility | cycle | — | feasibility:computeFeasibility |
| plan.quality.gate | Plan quality gate indicator | REFLECTIVE | gate status | cycle | — | evaluatePlanQualityGate |
| suggestion.stream | Suggestion cards | ADVISORY | suggestions | day | identityStore:acceptSuggestion (if applied) | suggestionFilters |

The full canonical list is in `src/contracts/uiAuthorityMap.ts`. This table covers the primary write surfaces.

## Probability Authority

The POS score is the single authoritative probability signal per goal. It is computed deterministically in `src/state/engine/probabilityScore.ts` and must not be overridden by UI inputs.

**Unit of prediction:** per goal

**Horizon:** rolling 7-day window (`src/state/engine/probabilityWindow.ts`)

**Output shape:**
- `value`: number `[0, 1]` or `null`
- `status`: `'INFEASIBLE' | 'UNSCHEDULABLE' | 'ELIGIBLE' | 'INELIGIBLE' | 'NO_EVIDENCE'`
- `trustState`: `'withheld' | 'provisional' | 'trusted'` (see `docs/reference/pos-trust-state.md`)
- `reasons`: reason codes
- `evidenceSummary`: event counts only (never raw events)

**Hard invariants:**
- Deterministic given the same input state + `nowISO`
- `cycle.metrics.posScore` is the canonical field; `state.planPreview.feasibilityConfidence` is a legacy read-only adapter
- The score is computed by `applyCycleScoring` in `src/state/identityCompute.js`; never mutated by UI
- Evidence summary exposes counts only — raw execution events are never passed to display components
```

- [ ] **Step 5: Archive the two source authority files and probabilitySpec**

```bash
git mv docs/architecture/UI_AUTHORITY_MAP.md docs/archive/docs-root/
git mv docs/architecture/PROBABILITY_AUTHORITY_MAP.md docs/archive/docs-root/
git mv docs/architecture/probabilitySpec.md docs/archive/docs-root/
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: promote scheduling-semantics, source-of-truth, execution-event-ledger, goal-to-deliverable; write authority-maps"
```

---

## Task 7: Write `docs/architecture/execution-model.md`

New synthesis doc covering the end-to-end deterministic pipeline.

**Files:**
- Create: `docs/architecture/execution-model.md`

- [ ] **Step 1: Write the file**

```markdown
# Execution Model

JERICHO transforms a goal contract into a scheduled plan and tracks execution against it deterministically — no LLM calls at runtime, no randomness in plan generation.

## Pipeline

```
Goal Intake
  └─ GoalAdmissionPolicy.ts        — hard gate: 7 validation phases, all must pass
  └─ GoalIntakeContract.ts         — structured intake form (multi-step UI flow)
  └─ GoalExecutionContract.ts      — typed contract written to state on admission

Auto-Generation
  └─ autoStrategy.ts               — detects goal archetype (15+ types), generates StrategyDeliverables
  └─ mechanismClass.ts             — classifies goal text into 6 MechanismClasses (CREATE/PUBLISH/MARKET/LEARN/OPS/REVIEW)
  └─ autoDeliverables.ts           — generates deliverable lists from MechanismClass templates
  └─ goalToDeliverables.ts         — maps goal contract to deliverable + action graph

Plan Generation
  └─ deterministicPlanGenerator.ts — produces reproducible block schedules (same inputs → same blocks)
  └─ deadline.ts                   — deadline arithmetic; workable day counting
  └─ planProof.ts                  — slack/intensity ratio from equation inputs

Plan Quality Gate
  └─ evaluatePlanQualityGate.ts    — validates plan structure before activation (see docs/reference/plan-quality-gate.md)

Derived State (re-run on every mutation)
  └─ identityCompute.js            — computeDerivedState: calls all downstream computations
  └─ feasibility.ts                — FEASIBLE/REQUIRED/INFEASIBLE from remaining blocks vs workable days
  └─ probabilityScore.ts           — POS score + trust state (see docs/reference/pos-trust-state.md)
  └─ fullHorizonScheduleExpansion  — expands master plan into calendar blocks

Execution
  └─ todayAuthority.ts             — immutable execution event ledger (see docs/reference/execution-event-ledger.md)
  └─ executionContract.ts          — guards canEmitExecutionEvent before any log append
  └─ profileExecutionContainment.ts — friction events for missed/skipped blocks
```

## Key Invariants

**Determinism.** Same goal contract + same `nowISO` always produces identical deliverables, block schedule, feasibility result, and POS inputs. No random values anywhere in the generation path.

**Immutable event ledger.** `executionEvents` is append-only. No derived projection (today blocks, weekly summaries) may be mutated and replayed back into the ledger. See `docs/reference/execution-event-ledger.md`.

**Engine authority.** `src/state/invariants/engineAuthority.ts` exports `assertEngineAuthority`. Any new engine computation must call this to prevent derived fields from being written directly from UI. See `docs/architecture/authority-maps.md`.

**Plan quality gate.** A plan must pass `evaluatePlanQualityGate` before POS is computed as `trusted`. Gate failures return typed `PlanQualityFailureCode` values. See `docs/reference/plan-quality-gate.md`.

**One write path per artifact.** `docs/architecture/source-of-truth.md` is the runtime ownership lock. No mirror field may be mutated; mirrors are read-only adapters only.

## State Persistence

- **Primary:** LocalStorage via `identityStore.js` — the browser is the single source of truth for local development.
- **Secondary:** Backend sync via `src/services/syncService.js` — debounced push on state change, pull on mount. Sync uses device-ID-based JWT auth (`/api/auth/device`). State blob is stored as JSON in `UserState` model.
- The backend is authoritative only for restoring state across devices/browser resets; LocalStorage takes precedence during a session.

## Domain Subdirectories

| Directory | Responsibility |
|---|---|
| `src/domain/goal/` | Goal admission, rejection codes, intake contract, terminal endpoint detection |
| `src/domain/masterPlan/` | Full-horizon schedule expansion, coverage audit, render-truth audit |
| `src/domain/planQuality/` | Plan quality gate and all sub-detectors |
| `src/domain/autoStrategy.ts` | Goal-type detection + deliverable template generation |
| `src/state/engine/` | Feasibility, POS scoring, execution events, execution contract |
| `src/core/` | Mechanism class, auto-deliverables, deterministic plan generator, deadline math |
```

- [ ] **Step 2: Commit**

```bash
git add docs/architecture/execution-model.md
git commit -m "docs: add execution-model architecture doc"
```

---

## Task 8: Write `docs/reference/pos-trust-state.md`

**Files:**
- Create: `docs/reference/pos-trust-state.md`

- [ ] **Step 1: Write the file**

```markdown
# POS Trust State

The probability-of-success score flows through three trust states before a numeric value is displayed. The trust state controls both whether a score is shown and what qualifier text appears.

**Canonical location:** `src/state/engine/probabilityScore.ts`

## States

| State | Meaning | Display |
|---|---|---|
| `withheld` | Score suppressed; preconditions not met | `—` (no number) |
| `provisional` | Score computed but capped; external goal awaiting third-party evidence | Numeric value + qualifier text |
| `trusted` | Full live score; all trust conditions met | Numeric value, no qualifier |

## Trust State Resolution (`deriveTrustState`)

Evaluated in priority order:

1. `scoringStatus === 'INFEASIBLE'` → **withheld**
2. `eligibilityStatus === 'disabled'` → **withheld**
3. `eligibilityStatus === 'insufficient_evidence'` → **withheld**
4. `scoringStatus === 'ELIGIBLE'`:
   - Resolve authority: `outcomeAuthorityClass` (from `terminalOutcomeAuthority.ts`) takes precedence over `familyClass`
   - If effectively externally-mediated AND `qualifyingExternalEvidenceCount === 0` → **provisional**
   - Otherwise → **trusted**
5. Default → **provisional**

A goal is "effectively externally mediated" when `outcomeAuthorityClass` is `'externally_mediated'` or `'mixed'`, or (fallback only) when `familyClass === 'externally_mediated'`.

## QUALIFYING_EXTERNAL_STAGES

Authoritative list in `probabilityScore.ts`. Only third-party-initiated responses count; user preparation actions do not.

| Archetype | Qualifying stage keys |
|---|---|
| `JobSearchPipeline` | `recruiter_reply`, `interview_invite`, `screening_scheduled`, `offer_received` |
| `SalesPipeline` | `qualified_response`, `discovery_call_booked`, `proposal_requested`, `deal_advanced` |
| `Fundraising` | `investor_reply`, `meeting_booked`, `diligence_request`, `commitment_received` |

To add a new externally-mediated archetype: add a key + `Set<string>` to `QUALIFYING_EXTERNAL_STAGES` in `probabilityScore.ts`.

## Display Policy (`derivePosDisplayPolicy`)

| `posTrustState` | `showScore` | `displayValue` | `qualifierText` |
|---|---|---|---|
| `withheld` | `false` | `'—'` | `null` |
| `provisional` | `true` if finite | `'N%'` | qualifier string if present |
| `trusted` | `true` if finite | `'N%'` | `null` |
| `null` (legacy) | `true` if finite | `'N%'` | `null` |

## Provisional Qualifier Text

When an externally-mediated goal is `provisional`, the qualifier shown to the user is:

> "Reflects execution quality of preparation activities. External response evidence not yet received."

Constant: `EXTERNALLY_MEDIATED_PROVISIONAL_QUALIFIER` in `probabilityScore.ts`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/reference/pos-trust-state.md
git commit -m "docs: add pos-trust-state reference doc"
```

---

## Task 9: Write `docs/reference/plan-quality-gate.md`

**Files:**
- Create: `docs/reference/plan-quality-gate.md`

- [ ] **Step 1: Write the file**

```markdown
# Plan Quality Gate

The plan quality gate runs before POS is computed as `trusted`. A plan that fails the gate has `PlanQualityGateStatus = 'PLAN_QUALITY_WITHHELD'` and the failure codes explain why.

**Canonical location:** `src/domain/planQuality/evaluatePlanQualityGate.ts`
**Types:** `src/domain/planQuality/planQualityTypes.ts`

## Gate Input

```typescript
{
  goalText?: string;
  verificationText?: string;
  deliverables?: PlanDeliverable[];
  actions?: PlanAction[];
  proposedBlocks?: PlanArtifact[];
  committedBlocks?: PlanArtifact[];
  branchCoverageSummary?: { declaredBranches: string[] };
  temporalContext?: {
    contractStartDayKey?: string | null;
    contractEndDayKey?: string | null;
    isRecurring?: boolean;
    earlyCompletionJustification?: string | null;
  };
}
```

## Gate Output

```typescript
{
  status: 'PLAN_QUALITY_PASSED' | 'PLAN_QUALITY_WITHHELD';
  failureCodes: PlanQualityFailureCode[];
  reasonCodes: string[];
  meta?: { ... };  // diagnostic details (weak deliverable IDs, missing branches, etc.)
}
```

## Checks

### 1. Structural coverage
- `PLAN_COVERAGE_MISSING_MAJOR_COMPONENT` — expected episode numbers detected in goal text but not found in deliverable/block titles
- `PLAN_COVERAGE_MISSING_DELIVERABLE_BRANCH` — a declared branch (from `branchCoverageSummary.declaredBranches`) has no blocks
- `PLAN_COVERAGE_MISSING_EXECUTION_DESCENDANTS` — a deliverable has no actions and no blocks

### 2. Deliverable quality
- `DELIVERABLE_OBJECT_MISSING` — title matches a known hollow-object pattern
- `DELIVERABLE_TOO_GENERIC` — title matches a known generic-planning-phase pattern
- `DELIVERABLE_GOAL_DISCONNECTED` — title shares no semantic tokens with the goal text
- `DELIVERABLE_SEMANTIC_HOLLOWNESS` — title is shell-heavy (mostly shell tokens, no concrete object)

### 3. Block and lineage quality
- `ACTION_LINEAGE_BROKEN` — action's deliverableId references a non-existent deliverable
- `BLOCK_LINEAGE_BROKEN` — block's deliverableId references a non-existent deliverable
- `BLOCK_TOO_GENERIC` — block title matches a known generic-session pattern
- `BLOCK_GOAL_OBJECT_MISSING` — block title shares no semantic tokens with the goal
- `LINEAGE_VISIBLE_MEANING_LOSS` — block title is a bare session label (e.g., "production session")

### 4. Outcome coverage (externally-mediated goals)
- `OUTCOME_COVERAGE_PREP_ONLY` — goal has contact-stage deliverable but no terminal-stage deliverable
- `OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING` — terminal stage deliverable required but absent
- `OUTCOME_ENDPOINT_MISSING` — externally-mediated/mixed goal with no detectable terminal event
- `OUTCOME_SPLIT_DIMENSION_UNCOVERED` — split goal (`status === 'split'` from `terminalEndpointDetector`) whose secondary endpoint has no coverage

### 5. Long-horizon temporal distribution (goals ≥ 180 days, non-recurring)
- `LONG_HORIZON_TEMPORAL_COMPRESSION` — blocks clustered too early; insufficient late-horizon coverage
- `LONG_HORIZON_UNJUSTIFIED_TAIL_GAP` — excessive unscheduled tail without early-completion justification
- `LONG_HORIZON_SPARSE_CADENCE` — average blocks/week below required threshold
- `LONG_HORIZON_WORK_GAPS` — inter-block gap exceeds allowed maximum

### 6. Commercial product launch (when `isCommercialProductLaunchGoal` is true)
- `COMMERCIAL_BLOCK_SPECIFICITY_WEAK` — repeated shell block titles with only session-ordinal variation
- `COMMERCIAL_WORK_WINDOW_UNDERUSED` — work window capacity underutilized relative to block count
- `TERMINAL_OBJECT_DRIFT` — block titles drift away from the goal's terminal object
- `COMMERCIAL_READINESS_MISSING` — commercial readiness semantic family not covered
- `PURCHASE_PATH_MISSING` — purchase/checkout semantic family not covered
- `FIRST_SALES_CORRIDOR_MISSING` — first-sale corridor semantic family not covered
- `BRAND_LAUNCH_SUBSTITUTED_FOR_PRODUCT_LAUNCH` — brand launch artifacts substituted for product-launch requirement
- `TERMINAL_EVENT_EVIDENCE_MISSING` — no terminal event evidence blocks present

## Adding a New Check

1. Add the failure code to `PlanQualityFailureCode` union in `planQualityTypes.ts`
2. Add the detection logic in `evaluatePlanQualityGate.ts` — call `failureCodes.add(...)` when the condition fires
3. Add a test in the plan quality gate test suite
4. If the check introduces a new sub-detector, create it as a separate file in `src/domain/planQuality/` with its own test file
```

- [ ] **Step 2: Commit**

```bash
git add docs/reference/plan-quality-gate.md
git commit -m "docs: add plan-quality-gate reference doc"
```

---

## Task 10: Write `docs/reference/terminal-endpoint-rules.md`

**Files:**
- Create: `docs/reference/terminal-endpoint-rules.md`

- [ ] **Step 1: Write the file**

```markdown
# Terminal Endpoint Rules

The terminal endpoint detector answers: "What exact event counts as this goal being finished?" It is the upstream truth surface that Outcome Validity and corridor-stage enforcement reason about.

**Canonical location:** `src/domain/goal/terminalEndpointDetector.ts`

## Output Types

```typescript
type TerminalEndpointStatus =
  | 'clear_explicit'   // endpoint directly stated; terminal object found in text
  | 'clear_inferred'   // endpoint canonically inferred from lane + framing verb
  | 'ambiguous'        // multiple plausible endpoints; cannot resolve primary
  | 'missing'          // no reliable endpoint detectable
  | 'split';           // multiple distinct terminal outcomes named (LT-02 pattern)

type TerminalEndpointObject =
  | 'offer_received'        // JobSearch: employer extends offer
  | 'hired'                 // JobSearch: hired implies offer + acceptance
  | 'capital_secured'       // Fundraising: funds received / wire confirmed
  | 'signed_commitment'     // Fundraising: investor signs (pre-wire)
  | 'published_live'        // Release/Podcast: content is live/distributed
  | 'certification_earned'  // Qualification: externally administered credential
  | 'first_sale_completed'  // Commercial launch: first real sale / first order
  | 'revenue_threshold'     // Market-dependent: $MRR / revenue target
  | 'audience_threshold'    // Market-dependent: listener/subscriber count
  | 'artifact_complete'     // Fully controllable: artifact in final verifiable form
  | 'unknown';              // Fallback when no object can be named
```

## Binding Invariant

Endpoint recognition is anchored on terminal **objects** and **events**, not on generic completion verbs. A pattern must have a named load-bearing terminal object. If the pattern fires when that object is removed from the text, it is over-broad.

## Contamination Rule

Verification text contains endpoint evidence AND supporting artifacts AND process metrics. The terminal endpoint is the state change that:
- (a) cannot be reversed
- (b) is not a deliverable the user executes alone

**Excluded even when present in verification text:** process metrics ("15 applications per week"), artifact descriptions ("portfolio contains 3 projects"). These are not terminal endpoints.

## Relationship to Other Detectors

- `terminalEndpointDetector.ts` — identifies the target event (what counts as finished)
- `terminalOutcomeAuthority.ts` — classifies who controls the outcome (`fully_controllable` / `externally_mediated` / `market_dependent` / `mixed`)
- `terminalStageDetector.ts` — checks whether the *plan* has a terminal-stage deliverable
- `contactStageDetector.ts` — checks whether the *plan* has a contact/outreach-stage deliverable

These four operate independently. Do not merge them.

## Plan Quality Gate Integration

When the detector returns `status === 'missing'` on an externally-mediated or mixed goal → `OUTCOME_ENDPOINT_MISSING` failure code.

When `status === 'split'` and the secondary endpoint has no block coverage → `OUTCOME_SPLIT_DIMENSION_UNCOVERED` failure code.

See `docs/reference/plan-quality-gate.md`.

## Scope Constraint

The detector runs detection only. It does not enforce gates, change trust state, or block plan activation directly. Those are responsibilities of the plan quality gate and POS scoring layers.
```

- [ ] **Step 2: Commit**

```bash
git add docs/reference/terminal-endpoint-rules.md
git commit -m "docs: add terminal-endpoint-rules reference doc"
```

---

## Task 11: Write `docs/reference/goal-admission-policy.md`

**Files:**
- Create: `docs/reference/goal-admission-policy.md`

- [ ] **Step 1: Write the file**

```markdown
# Goal Admission Policy

The goal admission gate is binary: a contract either passes all hard validations or it does not. No warnings, no overrides, no "close enough."

**Canonical location:** `src/domain/goal/GoalAdmissionPolicy.ts`
**Rejection codes:** `src/domain/goal/GoalRejectionCode.ts`
**Intake contract shape:** `src/domain/goal/GoalIntakeContract.ts`

## Validation Phases (in order)

Validations run in priority order — most likely to fail first.

### Phase 0: Plan generation mechanism
| Code | Condition |
|---|---|
| `PLAN_GENERATION_MECHANISM_MISSING` | `contract.planGenerationMechanismClass` is absent |
| `PLAN_GENERATION_MECHANISM_UNSUPPORTED` | mechanism not in v1 allowlist: `['GENERIC_DETERMINISTIC', 'LLM_TYPED']` |
| `REJECT_DISCLOSURE_REQUIRED` | `contract.commitmentDisclosureAccepted` is falsy |

### Phase 1: Inscription integrity
| Code | Condition |
|---|---|
| `INSCRIPTION_MISSING` | `contract.inscription` is absent |
| `INSCRIPTION_NOT_IMMUTABLE` | SHA-256 hash of contract fields does not match stored inscription hash |

### Phase 2: Terminal outcome
| Code | Condition |
|---|---|
| `TERMINAL_OUTCOME_MISSING` | `terminalOutcome` field absent or empty |
| `TERMINAL_OUTCOME_VAGUE` | outcome text fails concreteness check |
| `TERMINAL_OUTCOME_IMMEASURABLE` | outcome cannot be verified at deadline |

### Phase 3: Deadline
| Code | Condition |
|---|---|
| `DEADLINE_MISSING` | `deadlineISO` absent |
| `DEADLINE_IN_PAST` | `deadlineISO` is before `nowISO` |
| `DEADLINE_TOO_SOON` | fewer than 3 days from now |
| `START_DAY_BEFORE_ACTIVE_DAY` | inferred start date precedes app active day |

### Phase 4: Temporal binding
| Code | Condition |
|---|---|
| `NO_WORK_WINDOWS` | no work windows declared |
| `TEMPORAL_BINDING_INVALID` | no recurring schedule commitment |
| `TEMPORAL_BINDING_INSUFFICIENT` | committed days < 3 per week |

### Phase 5: Sacrifice declaration
| Code | Condition |
|---|---|
| `SACRIFICE_MISSING` | no sacrifice declared |
| `SACRIFICE_VAGUE` | sacrifice text is not specific/quantified |
| `SACRIFICE_NOT_BINDING` | declared cost is trivial |

### Phase 6: Causal chain
| Code | Condition |
|---|---|
| `CAUSAL_CHAIN_INCOMPLETE` | no steps from now to outcome |
| `CAUSAL_CHAIN_CIRCULAR` | chain contains a loop |

### Phase 7: Reinforcement
| Code | Condition |
|---|---|
| `REINFORCEMENT_NOT_DECLARED` | user denies daily exposure and no alternate mechanism given |
| `REINFORCEMENT_CONTRADICTION` | claims daily visibility but provides no anchor |

### Phase 8: Meta
| Code | Condition |
|---|---|
| `ASPIRATIONAL_ONLY` | user marks goal as aspiration; admission blocked |
| `DUPLICATE_ACTIVE` | same outcome (by SHA-256 hash) already active |

## Admission Result Shape

```typescript
type GoalAdmissionResult = {
  admitted: boolean;
  rejectionCodes: GoalRejectionCode[];
};
```

All rejection codes are hard failures — `admitted` is `false` if any code is present.

## UI Flow

The multi-step intake flow (`src/ui/goalAdmission/GoalAdmissionFlow.tsx`) collects the fields required by this gate in sequence. The gate is evaluated in `identityStore.js` via `validateGoalAdmission` on form submission.
```

- [ ] **Step 2: Commit**

```bash
git add docs/reference/goal-admission-policy.md
git commit -m "docs: add goal-admission-policy reference doc"
```

---

## Task 12: Write `docs/README.md` and `docs/archive/README.md`

**Files:**
- Create/Replace: `docs/README.md`
- Create: `docs/archive/README.md`

- [ ] **Step 1: Write `docs/archive/README.md`**

```markdown
# Archive

Historical working documents — briefs, freeze packages, acceptance plans, phase closures, and audit artifacts accumulated during development phases A–F.

These files are preserved for reference. They are not maintained. For current architecture and invariant documentation, see `docs/README.md`.
```

- [ ] **Step 2: Write `docs/README.md`** (replaces the existing file)

```markdown
# Documentation

## Architecture

Structural decisions and the execution model. Load these when working on plan generation, scheduling, or state wiring.

| Document | What it covers |
|---|---|
| [Execution Model](architecture/execution-model.md) | End-to-end pipeline: goal intake → deliverables → blocks → execution → POS |
| [Authority Maps](architecture/authority-maps.md) | UI write-authority classification + probability authority invariants |
| [Scheduling Semantics](architecture/scheduling-semantics.md) | Canonical Generate → Propose → Apply → Render contract; scheduler inputs/outputs |
| [Source of Truth Ownership](architecture/source-of-truth.md) | Runtime ownership lock: which field is canonical, who writes it, what the mirrors are |

## Reference

Invariant contracts. Load these when working in the domain or engine layers.

| Document | What it covers |
|---|---|
| [POS Trust State](reference/pos-trust-state.md) | withheld / provisional / trusted rules; QUALIFYING_EXTERNAL_STAGES; display policy |
| [Plan Quality Gate](reference/plan-quality-gate.md) | evaluatePlanQualityGate checks, failure codes, and how to add new checks |
| [Terminal Endpoint Rules](reference/terminal-endpoint-rules.md) | What counts as "finished"; binding invariant; contamination rule |
| [Goal Admission Policy](reference/goal-admission-policy.md) | 8-phase hard gate; all GoalRejectionCode values and conditions |
| [Execution Event Ledger](reference/execution-event-ledger.md) | Append-only log invariants; event schema; what may and may not replay into the ledger |
| [Goal-to-Deliverable Contract](reference/goal-to-deliverable.md) | Canonical planning semantics: goal → deliverables → actions → sessions → blocks |

## Development

| Document | What it covers |
|---|---|
| [Setup](development/SETUP.md) | Dev environment setup |
| [Testing](development/TESTING.md) | Test patterns and practices |
| [Contributing](development/CONTRIBUTING.md) | Contribution guidelines |
| [CI/CD](development/CI-CD.md) | Pipeline configuration |

## Archive

[docs/archive/](archive/) — historical working documents (briefs, freeze packages, phase closures). Not maintained.
```

- [ ] **Step 3: Commit**

```bash
git add docs/README.md docs/archive/README.md
git commit -m "docs: add master index and archive README — documentation refactor complete"
```

---

## Verification

- [ ] **Verify repo root is clean**

```bash
ls *.md
```
Expected: `CLAUDE.md  README.md`

- [ ] **Verify docs/ structure**

```bash
find docs -name "*.md" ! -path "*/archive/*" ! -path "*/superpowers/*" | sort
```
Expected:
```
docs/README.md
docs/architecture/authority-maps.md
docs/architecture/execution-model.md
docs/architecture/scheduling-semantics.md
docs/architecture/source-of-truth.md
docs/development/CI-CD.md
docs/development/CONTRIBUTING.md
docs/development/README.md
docs/development/SETUP.md
docs/development/TESTING.md
docs/reference/execution-event-ledger.md
docs/reference/goal-admission-policy.md
docs/reference/goal-to-deliverable.md
docs/reference/plan-quality-gate.md
docs/reference/pos-trust-state.md
docs/reference/terminal-endpoint-rules.md
```

- [ ] **Verify archive has a README**

```bash
cat docs/archive/README.md
```
Expected: short explanation that this holds historical documents.
