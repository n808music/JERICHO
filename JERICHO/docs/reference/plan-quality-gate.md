---
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
---
