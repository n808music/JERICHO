# Master Grid Allocation System — Complete Design Package (CORRECTED)

**Scope:** Three integrated operational fixes + Global Priority Engine design.
**Status:** Proposal only. No implementation authorized. Operator sign-off required for Phase 5.
**Investigation basis:** Diagnostic phases 0–4, schema audits, macro-deadline verification.
**Correction note:** This version fixes 7 issues found in operator review of the prior draft — 2 fabricated claims (an unsourced "Operation Endgame" event name, a borrowed/mismatched timestamp on F8 Capacity), 1 architectural regression (Artifact silently collapsed back under the Deliverable display class), and 4 secondary issues (wrong entity reference, duplicate provenance field, unexplained enum change, ambiguous ranking semantics). All corrections are marked inline as **[CORRECTED]**. Two additional consistency fixes applied during final review (Artifact enum alignment, Task 2 traversal direction flagged for implementation).

---

# EXECUTIVE SUMMARY

## Three Operational Issues Addressed

| Issue | Status | Solution |
|---|---|---|
| **Item 1:** Deliverable ingestion unimplemented; no code reads Deliverables tab | Design complete (Part A) | Introduce Deliverable node class as first-class matrix entity, distinct from and visibly separate from Artifact; link blocks to deliverables via optional FK; compute Demand (aggregated block duration) as source for allocation |
| **Item 2:** Loan artifacts (business-loan, property-bank-loan) CONFIRMED but provenance opaque | Disposition decided (Part B) | Retain as legacy-unattested Artifacts; no fabricated Deliverable parents; no synthetic confirmation events; future remediation via re-run intake for **Head Quarters / Global State Holdings [CORRECTED — was incorrectly "F8 Energy"]** |
| **Item 3:** F8 Capacity DRAFT with opaque "carried_forward" source | Disclosure remediated (Part C) | Rewrite causal narrative honestly: origin unknown, no fabricated event name, real (or explicitly null) attestation timestamp, source classification; remove opaque sourcing language without replacing it with an invented one |

## Four Strategic Tasks

| Task | Purpose | Key Design | Operator Role |
|---|---|---|---|
| **Task 1** | Compute raw Demand per Deliverable | Aggregated block-duration figure; supporting data, not the display order **[CLARIFIED]** | Informational input to Task 2 |
| **Task 2** | Rank by urgency and surface to operator | Transitive closure (blocking-chain traversal) + Initiative↔Lane macro-deadline context; **this urgency-band order is what the operator actually sees as "the priority list" [CLARIFIED]** | Selector for chains flagged urgent; can override ranking |
| **Task 3** | Link ranking to daily execution | Score-boost signal fed to `computeNextBestMove()`; visible CONSTRAINT/INTENT/ADVISORY tags | Retains override authority; sees claim source in UI |
| **Task 4** | Prevent domination by long-lead items | Non-domination hard rule; background-capacity allocation (10 hrs/week default); items spread across calendar with ADVISORY tag | Human-tunable parameters; operator vetoes final schedule |

## Governing Principle

Reason like a competent project manager working from goal/structure/gaps. The Priority Engine is a recommender, not a decider. Operator retains sequencing authority at all times.

---

# PART A: DELIVERABLE INGESTION SOLUTION

## Problem

No code path currently reads Deliverables tab data into the matrix. Blocks exist; Deliverable-level aggregation does not.

## Design: Two-Tier Deliverable/Artifact Model

### 1. Conceptual Foundation

**Distinct tiers:**
- **Deliverable:** Represents work scope; phase-linked; produces one or more Artifacts as evidence of completion.
- **Artifact:** Tangible evidence (document, measurement, delivered code, attested outcome); completion/verification data; tagged with producer type and creation timestamp.

Deliverables live in `matrix.deliverablesById`; Artifacts in `matrix.artifactsById`. **Both are first-class matrix entities with their own distinct, visible class in the Master Grid roster — neither is displayed under the other's label. [CORRECTED — see Class Order below]**

### 2. Schema Changes

#### New Deliverable Node Class

```typescript
interface Deliverable {
  id: string;
  name: string;
  phase?: string | null;
  reviewStatus: 'DRAFT' | 'NEEDS_REVIEW' | 'CONFIRMED';  // [CORRECTED — reverted to original 3-state enum; 'ARCHIVED' was an unexplained addition and 'NEEDS_REVIEW' was dropped without justification in the prior draft. If archival is genuinely needed later, propose it separately with rationale.]

  // Linkage
  owningProjectId: string;           // FK to projectsById (REQUIRED)
  owningInitiativeId?: string | null; // FK to initiativesById (computed from owning project)

  // Definition
  successCriteria?: string;           // description of done
  targetDate?: string | null;         // ISO date

  // Provenance
  declaredAtISO?: string;

  // Confirmation evidence (Part D) — single source of truth for provenance;
  // [CORRECTED — removed the separate 'source: operator | generated' field from the prior draft,
  // which duplicated confirmationSource below. One provenance concept, not two.]
  confirmedAt?: string | null;
  confirmedBy?: string | null;
  confirmationSource?: string | null;
}
```

**Master Grid row:** Deliverable shows as `primaryClass='Deliverable'`, inherits Entity/Project owner from owningProject; sorts below Projects, above Artifacts in class order.

#### Existing Artifact Node (Unchanged fields, corrected display class)

```typescript
interface Artifact {
  id: string;
  name: string;
  reviewStatus: 'DRAFT' | 'NEEDS_REVIEW' | 'CONFIRMED';  // [CORRECTED — was written as a 2-state enum ('DRAFT' | 'CONFIRMED') in the prior pass, inconsistent with Deliverable's corrected enum and with Phase 3's own evidence that all declare*() paths, including declareArtifact(), validate against the same 3-state enum. Every node class uses one consistent enum.]

  // WHO produced it
  producedByType: 'Deliverable' | 'Project' | 'Initiative';  // discriminator
  producedById: string;                                        // FK to that entity

  // WHAT it evidences
  completionEvidence?: string;
  targetDate?: string | null;

  // Provenance
  declaredAtISO?: string;

  // Confirmation evidence (Part D)
  confirmedAt?: string | null;
  confirmedBy?: string | null;
  confirmationSource?: string | null;
}
```

**Master Grid row: [CORRECTED] Artifact shows as its own distinct `primaryClass='Artifact'`** — it does NOT render under the Deliverable label or class row. This is the exact distinction the two-tier redesign exists to enforce; collapsing Artifact into Deliverable's display name would recreate the original bug (code internally distinguishing the two concepts while the UI shows only one label).

### 3. Block Linkage (Demand Source)

New **optional** field on blocks:

```typescript
interface PlanBlock {
  // ... existing fields ...
  deliverableId?: string | null;  // NEW: FK to deliverablesById
}
```

**Migration strategy:** Leave existing blocks unmigrated (null); new blocks can optionally link. No retroactive guessing or backfill.

**Demand computation (Task 1's output — supporting data, not the operator-facing sort order):**

```typescript
function computeDeliverableDemand(deliverableId: string, state: State): number {
  const blocks = Object.values(state.planBlocks || {});
  const totalMinutes = blocks
    .filter(b => b.deliverableId === deliverableId)
    .reduce((sum, b) => sum + (b.durationMinutes || 0), 0);
  return totalMinutes;
}
```

Live computation; no stored `estimatedWeeks` field (uses existing block data).

### 4. Class Order (Master Grid Roster) — [CORRECTED]

Update `CLASS_ORDER` constant:

```typescript
const CLASS_ORDER = [
  'Entity',
  'Initiative',
  'Project',
  'Deliverable',  // NEW: between Project and Artifact
  'Artifact',     // NEW: [CORRECTED] — Artifact gets its own class row, distinct from Deliverable
  'System'
];
```

**Selector logic:** `selectMasterGridRows()` iterates all six classes; Deliverables sort by phase, then name; Artifacts sort by their `producedByType`/`producedById` linkage, then name. Both classes render as their own distinct rows in the flat roster — consistent with the operator's flat-roster decision (one row per node, both tiers visibly distinct, no nesting and no label-collapsing).

---

# PART B: LOAN ARTIFACT DISPOSITION

## Problem

Two existing loan artifacts (business-loan, property-bank-loan) carry CONFIRMED status but have no confirmation mechanism or provenance. Intake session was destroyed during batch conversion; cannot recover original operator evidence.

## Decision: Retain as Legacy-Unattested

### What Stays

- **Artifact records remain in `matrix.artifactsById`** unchanged.
- CONFIRMED status is preserved (data integrity: reflect what the state says, not what we wish it said).
- Blocks linking to these artifacts continue to work.

### What Changes

- **Confirmation fields populated with legacy marker** (see Part D, Option A backfill):
  - `confirmedAt`: ISO timestamp when node was initially created (already stored in state: `2026-07-10T16:25:39.263Z`)
  - `confirmedBy`: `'legacy-unattested'` (explicit constant; no auth system involved)
  - `confirmationSource`: `'legacy-intake-artifact'` (plain string, not enum; operator classifies as needed)

This makes the uncertainty **visible and inspectable**, not silent.

### No Fabrication

- No synthetic Deliverable parent invented.
- No retroactive linkage to Projects guessed.
- No synthetic confirmation event created.
- Nodes stand as-is: legacy outputs of a destroyed intake session, confirmed in system state, unattested provenance.

### Impact

- **Master Grid:** Both artifacts render as their own Artifact-class rows (via `producedByType: 'Project'`, linked to Head Quarters), distinct from the Deliverable class.
- **Baseline:** No change in test count or test results; this is a data-structure clarification, not a functional change.

### Future Remediation Path — [CORRECTED]

If the operator wants full attestation, re-run intake for **Head Quarters / Global State Holdings** (the project these artifacts actually belong to), explicitly confirm each node, capture the operator identifier (`confirmedBy` field). Legacy nodes then acquire proper provenance in a second intake cycle.

---

# PART C: F8 CAPACITY DISCLOSURE REWRITE

## Problem

F8 Energy Capacity record is DRAFT with opaque "carried_forward" source. Operator has never reviewed this node; system offers no visibility into its causal origin.

## Solution: Honest Disclosure — [CORRECTED, no fabricated event name]

Rewrite the node's source narrative and disclosure fields to state only what is actually known:

**Node changes (in UI and backend state):**

```typescript
interface Capacity {
  // ... existing fields ...
  source: 'carried_forward',  // [CORRECTED — kept as-is; the literal stored value. Do not invent a replacement event name.]
  notes: 'Origin unknown. No source event, run, or process could be identified in available data. This record predates the current investigation; treat as unattested until reviewed.'

  // Confirmation evidence (Part D) — [CORRECTED]
  confirmedAt: null,   // [CORRECTED — was fabricated as the loan artifacts' timestamp, a different, unrelated record. F8 Capacity has no confirmation timestamp of its own; this must be null, not borrowed.]
  confirmedBy: 'legacy-unattested',
  confirmationSource: 'legacy-unknown'
}
```

**Disclosure gate (disclosure standard compliance):**

Whenever this Capacity node is loaded or displayed:
1. **Rule:** Capacity value is DRAFT, unreviewed, and its origin cannot currently be traced.
2. **Violation (original):** Node carried DRAFT status with an opaque "carried_forward" term and no further context.
3. **Evidence:** Actual stored values (45 hrs/week, 1 block/day max, 3 blocks/week max) displayed directly; origin honestly stated as unknown rather than attributed to an invented event.
4. **Compliant example:** "F8 Energy Capacity (DRAFT) — 45 hrs/week (9 hrs/day, Mon–Fri), 3 blocks/week max, 1 block/day max. Origin unknown; no source event identified. Confirmed by: legacy-unattested. Operator review required to confirm or adjust."

**No functional change.** Node continues to store capacity data; blocks continue to consume it. Clarity is the only output — and clarity means stating the gap honestly, not filling it with a plausible-sounding but unverified label.

---

# PART D: SCHEMA-WIDE CONFIRMATION PROVENANCE

## Problem

All 7 code paths setting `reviewStatus='CONFIRMED'` capture zero operator evidence. Schema has no fields for confirmation attestation. Loan and F8 nodes are only the visible symptoms; system-wide gap affects all 182 existing CONFIRMED nodes.

## Solution: New Fields + Option A Backfill

### New Schema Fields (All Node Classes)

Add to Entity, Initiative, Project, Deliverable, Artifact, System, and Capacity:

```typescript
interface BaseNode {
  // ... existing fields ...

  // NEW confirmation provenance fields — the single source of truth for provenance
  // across every node class; no node class should carry a second, separate provenance
  // field alongside these (see Part A correction above).
  confirmedAt?: string | null;        // ISO timestamp when confirmed
  confirmedBy?: string | null;        // operator identifier
  confirmationSource?: string | null; // plain string classifying source
}
```

**Operator-identifier strategy:** Do not invent an auth system. Use constants:
- `'legacy-unattested'` — pre-existing nodes with unknown confirmation origin
- `'operator'` — human operator via UI (no user-id tracking needed for a solo-operator system)
- `'system'` — generated via deterministic gate or rule

### Backfill Strategy: Option A (Explicit Legacy Marker)

**For all existing CONFIRMED nodes (182 nodes):**

```javascript
if (node.reviewStatus === 'CONFIRMED' && !node.confirmedAt) {
  node.confirmedAt = null;  // [CORRECTED — do not backfill a best-guess timestamp like node.declaredAtISO or a placeholder date; if the real confirmation moment is unknown, the field must be null, not a plausible-looking substitute]
  node.confirmedBy = 'legacy-unattested';
  node.confirmationSource = 'legacy-unknown';  // categorize further only where real evidence supports a more specific classification
}
```

**Cost:** Single bulk-update pass; no per-node investigation. Legacy marker is permanent (data integrity: preserve historical uncertainty as-is, do not manufacture false precision).

### Going Forward

All new CONFIRMED events capture:
1. When (real ISO timestamp, only when actually known)
2. Who (operator/system constant)
3. Why (confirmationSource classification)

---

# TASK 1: DEMAND COMPUTATION (SUPPORTING DATA, NOT THE DISPLAY ORDER)

## Design — [CLARIFIED]

### Purpose

Task 1 computes raw Demand (aggregated block duration) per Deliverable. **This is input data for Task 2's urgency ranking — it is not itself the priority order the operator sees.** Sorting purely by raw Demand would rank the single largest time-cost item first regardless of urgency, which risks recreating the exact "the biggest item looks most important just because it's big" problem raised earlier in this investigation.

```typescript
function computeDeliverableDemand(state: State, deliverableId: string): number {
  const blocks = Object.values(state.planBlocks || {});
  return blocks
    .filter(b => b.deliverableId === deliverableId)
    .reduce((sum, b) => sum + (b.durationMinutes || 0), 0);
}

function computeAllDemands(state: State): Record<string, number> {
  const deliverables = Object.values(state.matrix.deliverablesById || {});
  const result: Record<string, number> = {};
  for (const d of deliverables) {
    result[d.id] = computeDeliverableDemand(state, d.id);
  }
  return result;
}
```

### Single Scope, No Micro-Segmentation

- Demand is computed across all Deliverables from all entities, all initiatives — Jericho, Music, Academy, Head Quarters, 79th Street, F8 Energy, Imaginary CEO.
- No separate computation per entity or per initiative; there is one shared operator execution capacity, not independent per-entity pools.
- This raw Demand figure is displayed alongside each Deliverable as supporting context, but **Task 2's urgency band is the actual sort order the operator sees.**

---

# TASK 2: CROSS-LANE TRANSITIVE CLOSURE + MACRO-DEADLINE CONTEXT (THE OPERATOR-FACING PRIORITY ORDER)

## Design

### Macro-Deadline Linkage (Corrected)

**Prerequisite schema addition:**

Each Initiative links directly to its own Lane (1:1):

```typescript
interface Initiative {
  // ... existing fields ...
  laneId?: string | null;  // FK to masterPlanLanesById
}
```

**Rationale:** Each Initiative IS a lane in the master plan (confirmed with operator). Linking to the overall MasterPlan would only expose the far-distant `horizonEnd` (the overall plan's end date), not the Initiative's own near-term milestones. The 1:1 Initiative↔Lane FK gives direct access to that lane's `laneEnd` and its Milestones' `targetDate` values.

### Urgency Computation: Blocking-Chain Traversal

For each Deliverable, compute urgency — **this is the actual sort order shown to the operator as "the priority list," with Task 1's raw Demand figure shown alongside as supporting data, not as the primary sort key:**

```typescript
function computeBlockingChainUrgency(
  deliverable: Deliverable,
  state: State
): {
  urgencyBand: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  daysToDeadline: number;
  chainDepth: number;
  blockedItems: string[];
  demandMinutes: number;  // Task 1's figure, shown as context
} {
  // [FLAGGED FOR IMPLEMENTATION] traverseBFS traverses DOWNSTREAM from the deliverable
  // (what depends on this item, not what blocks it). Verify direction during implementation.
  // Variable naming 'blockedItems' refers to "items blocked waiting for this deliverable",
  // i.e., the urgent downstream consequences. If urgency should instead walk upstream
  // (what must complete before this), flip the traversal direction.
  const blockedItems = traverseBFS(deliverable.id, state.matrix.dependenciesById);

  const initiatives = new Set(
    blockedItems
      .map(itemId => findOwningInitiative(itemId, state.matrix))
      .filter(Boolean)
  );

  const deadlines = Array.from(initiatives)
    .map(initiativeId => {
      const initiative = state.matrix.initiativesById[initiativeId];
      const laneId = initiative?.laneId;
      if (!laneId) return null;

      const lane = state.masterPlanLanesById[laneId];
      if (!lane) return null;

      const milestoneDates = Object.values(state.masterPlanMilestonesById || {})
        .filter(m => m.laneIds?.includes(laneId))
        .map(m => m.date)
        .filter(Boolean)
        .sort();

      return milestoneDates.length ? milestoneDates[milestoneDates.length - 1] : lane.laneEnd;
    })
    .filter(Boolean)
    .sort();

  const now = new Date(state.appTime?.nowISO || new Date().toISOString());
  const nearestDeadline = deadlines.length ? new Date(deadlines[0]) : null;
  const demandMinutes = computeDeliverableDemand(state, deliverable.id);

  if (!nearestDeadline) {
    return { urgencyBand: 'LOW', daysToDeadline: Infinity, chainDepth: blockedItems.length, blockedItems, demandMinutes };
  }

  const daysRemaining = (nearestDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  let urgencyBand: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  if (daysRemaining <= 7) urgencyBand = 'CRITICAL';
  else if (daysRemaining <= 21) urgencyBand = 'HIGH';
  else if (daysRemaining <= 60) urgencyBand = 'MEDIUM';
  else urgencyBand = 'LOW';

  return {
    urgencyBand,
    daysToDeadline: Math.max(0, daysRemaining),
    chainDepth: blockedItems.length,
    blockedItems,
    demandMinutes,
  };
}

function rankDeliverablesForOperator(state: State): Array<ReturnType<typeof computeBlockingChainUrgency> & { deliverableId: string }> {
  const deliverables = Object.values(state.matrix.deliverablesById || {})
    .filter(d => d.reviewStatus === 'CONFIRMED');

  return deliverables
    .map(d => ({ deliverableId: d.id, ...computeBlockingChainUrgency(d, state) }))
    .sort((a, b) => {
      const bandOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      if (bandOrder[a.urgencyBand] !== bandOrder[b.urgencyBand]) {
        return bandOrder[a.urgencyBand] - bandOrder[b.urgencyBand];
      }
      // Within the same urgency band, higher Demand breaks ties
      return b.demandMinutes - a.demandMinutes;
    });
}
```

### Output: Urgent Deliverables + Broken Edges

1. **Emit to operator:** "Deliverable X is CRITICAL (chains to Y, Z blocking path for Initiative ABC, deadline 2026-08-15); recommend Task 3 CONSTRAINT."
2. **Surfacing:** In Strategic Priority Recommender component (new), show urgent chains prominently, with each Deliverable's Demand figure shown as supporting context, not as the headline sort key.
3. **Broken edges:** If any `dependenciesById` edge points to a deleted/archived node or has null endpoints (e.g., the previously-found `dep-business-loan-to-property-bank-loan` orphaned record), flag for operator review rather than silently skipping.

### Operator Authority

Operator can:
- Ignore ranking order and pull urgent items to front (CONSTRAINT override).
- Accept ranking as-is (no action needed).
- Defer urgent items if justified by other factors (sequencing authority intact).

Urgent computation is advisory; operator decides sequencing.

---

# TASK 3: EXECUTION LINKAGE (TACTICAL SCORING)

## Design

### Score-Boost Signal from Ranking

After Task 2's urgency computation, feed results to `computeNextBestMove()` in `aimCompute.js`.

**Current behavior:** `computeNextBestMove()` returns a single daily block recommendation with `urgencyBand` based on `daysRemaining` (block-level TTL).

**New behavior:**

1. When selecting candidate blocks for the day, boost score for blocks linked to Deliverables in Task 2's urgent chains (CRITICAL/HIGH).
2. Append a `claimType` field to the returned recommendation:

```typescript
interface BlockRecommendation {
  blockId: string;
  domain: string;
  durationMinutes: number;
  urgencyBand: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  rationale: string[];
  doneWhen: string;

  claimType: 'CONSTRAINT' | 'INTENT' | 'ADVISORY';
  claimSource?: string;  // e.g., "Task 2 urgent chain (Initiative ABC, deadline 2026-08-15)"
}
```

### Semantics

| Claim Type | Meaning | Operator Authority |
|---|---|---|
| **CONSTRAINT** | Ranked CRITICAL/HIGH by Task 2 AND blocks a critical chain | Operator CAN override (sequencing authority stands), but visible friction cost |
| **INTENT** | Ranked MEDIUM by Task 2; advances a non-urgent deliverable | Operator can reorder freely |
| **ADVISORY** | Long-lead item (distributed via Task 4), background-capacity allocation | Operator can defer or ignore |

### UI Surface (NextBestMoveCard.jsx Enhancement)

```
Today's recommendation:
[Block Title] — X minutes — CRITICAL

Why: Completes Deliverable ABC
  - Deliverable advances Initiative XYZ (deadline 2026-08-15)
  - 3 downstream items blocked waiting for this work

Claim type: CONSTRAINT (ranked urgent)
You can override, but this item has high leverage.
```

Operator sees:
- What the ranking decided (CONSTRAINT/INTENT/ADVISORY)
- Why (which Initiative, which deadline)
- Retains full override authority (this is advisory, not mandatory)

### No Score Manipulation at Block Level

Do NOT change block `durationMinutes` or other fields. Score boost is internal to `computeNextBestMove()` logic; output remains transparent and inspectable.

---

# TASK 4: LONG-HORIZON ITEM DISTRIBUTION

## Problem

Long-lead Deliverables (work beginning far in advance, targeting distant deadlines) can dominate the near-term critical path if surfaced without restraint. E.g., a 60-hour advanced-planning task could pull focus away from imminent deadlines if not deliberately bounded.

## Solution: Non-Domination Hard Rule + Background-Capacity Allocation

### Non-Domination Hard Rule

**Definition:** A Deliverable whose earliest required block is >90 days away MUST NOT appear in daily recommendations (Task 3) unless:
1. Operator explicitly adds a CONSTRAINT override, OR
2. All CRITICAL/HIGH urgency chains are already satisfied (fallback to distribute long-lead work).

```javascript
const candidates = planBlocks.filter(block => {
  const daysUntilBlock = (new Date(block.scheduledDate) - now) / (1000 * 60 * 60 * 24);

  if (daysUntilBlock > 90) {
    const deliverable = state.matrix.deliverablesById?.[block.deliverableId];
    if (deliverable && isLongLeadItem(deliverable)) {
      if (!hasConstraintOverride(deliverable.id)) {
        return false;
      }
    }
  }

  return true;
});
```

### Background-Capacity Allocation

Reserve a fixed fraction of weekly execution capacity for long-lead items:

**Default:** 10 hours/week — treated as a canonical starting baseline, calibrated with real usage over time, same as the staleness thresholds.

**Distribution:**
- Identify all long-lead Deliverables (>90 days out, Demand > 0).
- Spread blocks evenly across remaining calendar (e.g., 2 hours/week per item if 5 items).
- Tag with `claimType: 'ADVISORY'`.

**Effect:**
- Long-lead items make steady progress without dominating daily focus.
- Operator can adjust the 10-hour cap.
- Critical path remains in foreground (Task 3 CONSTRAINT/INTENT blocks).

### Surfacing

In Strategic Priority Recommender component:

**Section 1: Urgent Chains (CRITICAL)** — Task 2's blocking chains; deadlines, dependencies, block recommendations.
**Section 2: Ranked Deliverables (INTENT tier)** — Task 2's normal-priority items; blocks scattered across calendar.
**Section 3: Background Work (ADVISORY)** — Long-lead items; scheduled via background-capacity cap.

### Operator Tuning

Exposed parameters (operator-editable):
- **`backgroundCapacityHoursPerWeek`** (default: 10, provisional baseline)
- **`longLeadThresholdDays`** (default: 90, provisional baseline)

Changes take effect on next `computeNextBestMove()` evaluation; no system restart.

---

# GOVERNING PRINCIPLE

**Reason like a competent project manager working from goal/structure/gaps.**

1. Map work (Deliverables) to outcomes (Initiatives).
2. Aggregate demand (block hours per deliverable) as supporting context.
3. Identify blocking chains and macro deadlines — this, not raw size, drives the priority order.
4. Surface urgent paths to operator.
5. Allocate capacity fairly (avoid long-lead domination).
6. Respect operator's sequencing authority (recommendations, not mandates).

The Priority Engine is a **lens,** not a **law.** Operator sees clearly and decides freely.

---

# STATUS

**Nothing in this proposal has been implemented, resolved, fixed, or closed.**

This is a design-only package submitted for operator review and Phase 5 authorization decision. All 7 corrections from operator review have been applied and are marked inline above. Two additional consistency corrections applied during final review (Artifact enum alignment to match Deliverable and all other node classes; Task 2 traversal direction flagged for implementation verification).

Intake pass remains suspended per prior directive ("Hold — do not run the intake pass").

**Next step:** Operator issues Phase 5 sign-off directive (approval or revision requests), authorizing or deferring implementation.
