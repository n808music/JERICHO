# JERICHO_PHASE_D_ENDPOINT_GATE_CONSEQUENCE_BRIEF.md

## Status

**Draft — doctrine brief**
Upstream of: JERICHO_TERMINAL_ENDPOINT_RECOGNITION_FREEZE.md
Downstream of: Outcome Validity Package (frozen v1), Terminal Endpoint Recognition (frozen v1)
Date: 2026-04-06

---

## The core question

What should the gate do when terminal endpoint recognition returns each status?

The frozen upstream truth now exists. Phase D defines the consequences of that
truth. It is the first phase that connects endpoint recognition to gate behavior.

---

## Objective

Add endpoint-status-aware gate checks to `evaluatePlanQualityGate`. The gate
will call `detectTerminalEndpoint` (same pattern as Phase 2/3 calling
`deriveTerminalOutcomeAuthority` and `detectCorridorLane`), then apply
consequence logic based on the returned status.

**Freeze criterion:**
> "Endpoint status drives gate consequences correctly for in-scope cases,
> without affecting fully_controllable or market_dependent goals, and without
> duplicating existing Outcome Validity checks."

---

## Implementation constraint: gate input path

`evaluatePlanQualityGate` receives `goalText` and `verificationText` directly,
not the `GoalIntakeContract`. Phases 2 and 3 already call authority and lane
detectors inline from those strings. Phase D follows the same pattern:

```typescript
// Phase D (new)
const terminalEndpoint = detectTerminalEndpoint(goalText, verificationText);
```

This is consistent with the existing gate architecture. The canonical contract
field `GoalIntakeContract.terminalEndpoint` is for external readers and probes.
The gate calls the detector directly to stay self-contained.

**No contract threading is needed.**

---

## Scope

### In scope

1. New failure code: `OUTCOME_ENDPOINT_MISSING` — emitted when the goal has
   no detectable terminal event and the authority class makes that gap material

2. New failure code: `OUTCOME_SPLIT_DIMENSION_UNCOVERED` — emitted when the
   goal is a compound split goal and the plan covers only one terminal dimension

3. Gate check block in `evaluatePlanQualityGate.ts` — Phase D block after
   Phase 3 block, consuming `detectTerminalEndpoint` result

4. New failure codes added to `PlanQualityFailureCode` union in
   `planQualityTypes.ts`

5. Acceptance tests — new detector probe against known audit cases

### Out of scope (explicit non-goals)

- `OUTCOME_ENDPOINT_AMBIGUOUS` failure code — deferred (see §Ambiguous below)
- Trust state changes of any kind
- `provisional_external` / `provisional_market` state variants
- Clause-level parsing of verification text
- New terminal endpoint patterns or lane additions
- Mixed-authority decomposition beyond split-dimension check
- Market-dependent endpoint enforcement (dist channel, audience corridor)
- Modifications to `terminalEndpointDetector.ts` patterns
- Any change to Outcome Validity frozen package behavior

---

## Status → gate consequence mapping

| Status | Scope condition | Gate consequence |
|--------|----------------|-----------------|
| `clear_explicit` | any | No additional consequence |
| `clear_inferred` | any | No additional consequence |
| `missing` | authority is `externally_mediated` or `mixed` | Emit `OUTCOME_ENDPOINT_MISSING` — withhold |
| `missing` | authority is `fully_controllable` or `market_dependent` | No consequence (endpoint optional for fc/md) |
| `missing` | authority is `unknown` | No consequence |
| `ambiguous` | any | No consequence in Phase D — deferred |
| `split` | secondary dimension has no plan coverage | Emit `OUTCOME_SPLIT_DIMENSION_UNCOVERED` — withhold |
| `split` | secondary dimension has plan coverage | No additional consequence |

---

## `OUTCOME_ENDPOINT_MISSING`

### When it fires

Authority class is `externally_mediated` or `mixed`, AND endpoint status is
`missing`.

### Why this scope

For `externally_mediated` and `mixed` goals, the terminal event is controlled
by an external party. If that event cannot be identified, the gate cannot
reason about whether the plan reaches it. The plan may be structurally sound
while targeting nothing verifiable.

For `fully_controllable` goals, a missing endpoint is less critical because the
user controls the completion. A vague fc goal is an intake concern, not
necessarily a plan quality failure at the gate level.

For `market_dependent` goals, the threshold metric is the endpoint, and the
authority classifier already detects its presence separately. If threshold
detection succeeds (THRESHOLD_METRIC_DETECTED), endpoint recognition may still
return `missing` because no lane-specific terminal object fired — but the
authority detection covers the meaningful check. Applying `OUTCOME_ENDPOINT_MISSING`
here would double-penalize valid market-dependent goals. Excluded.

### Relationship to existing checks

This does not overlap with `OUTCOME_COVERAGE_PREP_ONLY` (Phase 2) or
`OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING` (Phase 3). Those checks fire when
the endpoint is known but the plan doesn't reach it. `OUTCOME_ENDPOINT_MISSING`
fires when the endpoint cannot be identified in the first place.

A plan can receive all three codes simultaneously:
- endpoint unknown (Phase D)
- plan has no contact stage (Phase 2)
- plan has no terminal stage (Phase 3)

These are independent insufficiencies.

### Example triggers

```
Goal: "Get a developer job somehow"
Verification: "Applied to many companies and had interviews"
authority: externally_mediated
endpoint.status: missing (no offer/hired language)
→ OUTCOME_ENDPOINT_MISSING fires
```

```
Goal: "Raise some funding for my startup"
Verification: "Pitch deck complete and investor meetings scheduled"
authority: externally_mediated
endpoint.status: missing (no capital/signed/wire language)
→ OUTCOME_ENDPOINT_MISSING fires
```

### Example non-triggers

```
Goal: "Build and deploy a landing page"
Verification: "Page is live at a public URL"
authority: fully_controllable
endpoint.status: clear_explicit (artifact_complete)
→ does not fire (fc, and endpoint is present anyway)
```

```
Goal: "Grow my podcast to 1,000 listeners"
Verification: "1,000 monthly listeners confirmed"
authority: market_dependent
endpoint.status: clear_explicit (audience_threshold)
→ does not fire (md, and endpoint is present anyway)
```

---

## `OUTCOME_SPLIT_DIMENSION_UNCOVERED`

### The problem: LT-02 compound goal blind spot

LT-02 is the canonical case: "Learn full-stack web development AND land a
junior software engineer job." The goal has `split` endpoint status:
- Primary: `artifact_complete` (portfolio deployed)
- Secondary: `offer_received` (job offer)

Outcome Validity Phases 2 and 3 check the primary corridor lane. For LT-02,
if the authority class is `mixed`, the externally_mediated corridor check
fires — but only against the deliverable set as a whole. If the plan is a
SkillAcquisition plan (artifact-only deliverables), Phase 2 withholds because
no contact stage exists. That catches the contamination path.

What Phase D adds: for `split` goals, check whether the plan has SOME coverage
of the secondary endpoint dimension — not corridor completeness, just presence.
This is a lighter check than the Phase 2/3 checks. It fires only when the plan
has zero deliverables with semantic overlap to the secondary endpoint type.

### Secondary endpoint coverage check

For each `split` goal, the secondary endpoint type determines what "some
coverage" means:

| Secondary endpoint | Coverage indicator |
|-------------------|-------------------|
| `offer_received` / `hired` | At least one deliverable contains job-pipeline vocabulary (apply, submit, interview, outreach to employer, offer) |
| `capital_secured` / `signed_commitment` | At least one deliverable contains fundraising vocabulary (investor, pitch, outreach to investor, raise, close, term) |
| `published_live` | At least one deliverable contains publish/release vocabulary |
| `artifact_complete` | At least one deliverable contains artifact-build vocabulary (build, create, deploy, launch) |
| `audience_threshold` / `revenue_threshold` | At least one deliverable contains distribution/growth vocabulary |
| `certification_earned` | At least one deliverable contains qualification vocabulary |

**Detection authority:** a new function `hasSecondaryEndpointCoverage(
  secondaryEndpoint: TerminalEndpointObject,
  deliverableTitles: string[]
): boolean` in a new module `src/domain/planQuality/splitEndpointCoverageDetector.ts`.

This module follows the same ownership and invariant rules as the other
planQuality detectors. One canonical home, no parallel detection.

### Severity rationale

`OUTCOME_SPLIT_DIMENSION_UNCOVERED` withholds because a plan that covers
zero deliverables for one terminal dimension is not a plan for the whole goal.
The user said they want BOTH outcomes. A plan addressing only one is
structurally incomplete for the stated goal, not just degraded.

This is different from intermediate stage absence (degradation). This is
one entire terminal outcome having zero representation in the plan.

### What it does NOT require

Phase D does NOT require the secondary dimension to satisfy full corridor
coverage (contact stage + terminal stage). That would be Phase 3 applied to
the secondary dimension — which requires a separate corridor lane to be defined
for the secondary endpoint. Phase D only asks: is the secondary dimension
represented at all?

The check is:
```
hasSecondaryEndpointCoverage(secondaryEndpoint, deliverableTitles)
  → true if at least one deliverable is semantically related to the secondary endpoint type
  → false if zero deliverables have any relationship to that dimension
```

### Example triggers

```
Goal: "Build a portfolio and get a job offer" (split: artifact_complete + offer_received)
Plan: skill/portfolio deliverables only, no job-search pipeline deliverables
→ OUTCOME_SPLIT_DIMENSION_UNCOVERED fires (secondary offer_received has zero coverage)
```

```
Goal: "Launch my SaaS and hit $1K MRR" (split: artifact_complete + revenue_threshold)
Plan: product-build deliverables only, no growth/distribution/marketing deliverables
→ OUTCOME_SPLIT_DIMENSION_UNCOVERED fires (secondary revenue_threshold has zero coverage)
```

### Example non-triggers

```
Goal: "Build a portfolio and get a job offer" (split: artifact_complete + offer_received)
Plan: portfolio deliverables + "Submit applications to target employers" + "Interview at target companies"
→ does not fire (secondary offer_received has job-pipeline coverage)
```

```
Goal: LT-02 full pipeline (split: artifact_complete + offer_received)
Plan: portfolio projects + job search pipeline deliverables including application and interview stages
→ does not fire (both dimensions represented)
```

---

## Ambiguous status: deferred

`ambiguous` means two plausible endpoints exist without a clear primary. In
practice this is rare — the detector tests showed that same-authority-class
signals collapse into a single category rather than producing `ambiguous`.

Phase D defers `ambiguous` consequences because:

1. The real-world frequency is low based on audit evidence
2. The correct consequence is unclear: should the gate ask for clarification?
   Withhold? Degrade? That requires UX design that is out of scope here.
3. Any `ambiguous` goal that is also `externally_mediated` will already receive
   `OUTCOME_ENDPOINT_MISSING` via the missing-check path if the detector couldn't
   resolve a primary endpoint — so the worst cases are covered by that code.

A future brief should address `ambiguous` if it proves common enough to matter.

---

## Interaction with Outcome Validity (no-overlap rule)

Phase D gate checks must not duplicate existing checks. The interaction rules:

| Scenario | What fires |
|----------|-----------|
| Prep-only plan, externally_mediated, no endpoint | Phase 2: `OUTCOME_COVERAGE_PREP_ONLY`, Phase D: `OUTCOME_ENDPOINT_MISSING` |
| Plan with contact stage but no terminal stage, endpoint known | Phase 3: `OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING` only |
| Split goal, both dimensions present | Phase 2/3 check primary lane; Phase D: no additional code |
| Split goal, secondary dimension absent | Phase D: `OUTCOME_SPLIT_DIMENSION_UNCOVERED` (Phase 2/3 may also fire on primary lane) |
| Missing endpoint, fc goal | No code from any phase |
| Clear endpoint, full corridor coverage | No codes |

**Rule:** Phase D checks test endpoint-level truth (is the goal's terminal event
recognizable, and for split goals is both dimensions represented). Phase 2/3 check
corridor-level truth (does the plan traverse the corridor toward the known endpoint).
These are distinct layers. They may co-fire but do not overlap semantically.

---

## New failure codes

```typescript
type PlanQualityFailureCode =
  // existing codes ...
  | 'OUTCOME_COVERAGE_PREP_ONLY'               // Phase 2
  | 'OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING'  // Phase 3
  | 'OUTCOME_ENDPOINT_MISSING'                 // Phase D: no detectable terminal event (em/mixed)
  | 'OUTCOME_SPLIT_DIMENSION_UNCOVERED';       // Phase D: split goal, one dimension has zero coverage
```

---

## Gate integration

### Call sequence in `evaluatePlanQualityGate.ts`

Phase D check block follows Phase 3:

```typescript
// Phase D: endpoint-status-aware gate checks
// Runs after Phase 2/3. Consumes detectTerminalEndpoint inline (same pattern as
// Phase 2 consuming deriveTerminalOutcomeAuthority).
const terminalEndpoint = detectTerminalEndpoint(goalText, verificationText);

// D1: missing endpoint for externally mediated goals
if (
  terminalEndpoint.status === 'missing' &&
  (outcomeAuthority.authority === 'externally_mediated' ||
    outcomeAuthority.authority === 'mixed')
) {
  failureCodes.add('OUTCOME_ENDPOINT_MISSING');
  reasonCodes.add('OUTCOME_ENDPOINT_MISSING');
}

// D2: split goal secondary dimension coverage check
if (terminalEndpoint.status === 'split' && terminalEndpoint.secondaryEndpoint) {
  const deliverableTitles = deliverables.map((d) => normalizeText(d?.title));
  if (!hasSecondaryEndpointCoverage(terminalEndpoint.secondaryEndpoint, deliverableTitles)) {
    failureCodes.add('OUTCOME_SPLIT_DIMENSION_UNCOVERED');
    reasonCodes.add('OUTCOME_SPLIT_DIMENSION_UNCOVERED');
  }
}
```

**Implementation note:** `deliverableTitles` is already computed in Phase 2/3
and should be hoisted above the Phase 2 block to avoid recomputation across all
phases. This is a refactor within the gate block, not a behavioral change.

---

## New module: `splitEndpointCoverageDetector.ts`

**Path:** `src/domain/planQuality/splitEndpointCoverageDetector.ts`

**Export:**

```typescript
import type { TerminalEndpointObject } from '../goal/terminalEndpointDetector';

export function hasSecondaryEndpointCoverage(
  secondaryEndpoint: TerminalEndpointObject,
  deliverableTitles: string[],
): boolean
```

**Coverage patterns by endpoint type (initial vocabulary):**

`offer_received` / `hired`:
- Apply/submit/application, interview, outreach to employer, offer, job pipeline, target roles,
  target companies, resume/portfolio for roles — any deliverable semantically in the hiring corridor

`capital_secured` / `signed_commitment`:
- Investor, pitch, fundraising, raise, outreach to investor, meetings with investor, diligence,
  term, close — any deliverable in the fundraising corridor

`published_live`:
- Publish, release, episode, content live, distribute — release corridor vocabulary

`artifact_complete`:
- Build, create, develop, deploy, launch, product, page, app, portfolio project — artifact build vocabulary

`audience_threshold` / `revenue_threshold`:
- Growth, distribution, marketing, channel, reach, launch to market, promote, MRR, revenue,
  subscribers, listeners, audience — distribution and growth vocabulary

`certification_earned`:
- Study, exam, course, practice, certification preparation, test — qualification corridor vocabulary

`unknown`:
- Returns `true` (no check applied for unknown endpoint type)

**Invariant:** Coverage patterns here are intentionally broader than terminal-stage
patterns. They check for DIMENSION PRESENCE, not terminal-stage sufficiency.
A deliverable that mentions "outreach workflow" covers the hiring dimension even
though it doesn't satisfy Phase 3's terminal-stage check. The goal is to detect
zero coverage, not to re-enforce corridor completeness.

---

## Acceptance tests

### `OUTCOME_ENDPOINT_MISSING` cases

**Fires:**
- Externally mediated goal, no offer/commitment language anywhere:
  "Get a developer job" + "Applied to companies and had interviews" → fires
- Mixed-authority goal with fc endpoint only, no external terminal clause:
  "Build a portfolio and eventually get hired" (if "get hired" doesn't resolve) → fires

**Does not fire:**
- Fully controllable goal with missing endpoint: "Build a website for my business" → no fire
- Market-dependent goal: "Grow my podcast" → no fire (md scope excluded)
- Any goal where endpoint is `clear_explicit` or `clear_inferred`

### `OUTCOME_SPLIT_DIMENSION_UNCOVERED` cases

**Fires:**
- LT-02 split, skill-only plan (no job pipeline deliverables):
  `split` (artifact_complete + offer_received), plan = portfolio deliverables only → fires
- SaaS + MRR split, product-only plan (no growth/distribution deliverables):
  `split` (artifact_complete + revenue_threshold), plan = build deliverables only → fires

**Does not fire:**
- LT-02 split, full plan (both skill and job pipeline deliverables) → no fire
- Non-split goal (status is `clear_explicit`) → no fire
- Split goal where secondary is `unknown` → no fire (unknown endpoint no-op)

### Regression cases (must not fire)

- LT-04 full pipeline (externally_mediated, clear_explicit, capital_secured) → no new codes
- LT-03 full pipeline (externally_mediated, clear_explicit, offer_received) → no new codes
- Podcast goal (market_dependent, split) → no new codes (md excluded from missing check;
  split check depends on secondary endpoint having coverage in plan)
- Landing page goal (fc, clear_explicit) → no new codes
- Any goal with endpoint `ambiguous` → no codes from Phase D

---

## Freeze criteria

Phase D is complete when:

1. `splitEndpointCoverageDetector.ts` exists with one exported
   `hasSecondaryEndpointCoverage` function
2. `OUTCOME_ENDPOINT_MISSING` and `OUTCOME_SPLIT_DIMENSION_UNCOVERED` added to
   `PlanQualityFailureCode` union
3. Phase D gate check block wired into `evaluatePlanQualityGate.ts` after Phase 3
4. `detectTerminalEndpoint` import added to gate file
5. All acceptance tests pass for both new failure codes
6. Regression cases confirmed: LT-03/04 full pipelines unchanged, fc goals unchanged
7. `OUTCOME_ENDPOINT_MISSING` fires only for `externally_mediated` and `mixed` authority
8. `OUTCOME_SPLIT_DIMENSION_UNCOVERED` fires only when `terminalEndpoint.status === 'split'`
   AND secondary dimension has zero plan coverage
9. Zero trust state changes
10. Zero regressions — full suite passes

**Explicit failure conditions:**

- `OUTCOME_ENDPOINT_MISSING` fires on a fully_controllable goal → authority filter bug
- `OUTCOME_SPLIT_DIMENSION_UNCOVERED` fires on a non-split goal → status filter bug
- LT-04 full pipeline receives a new failure code → regression
- Any existing test changes its gate verdict outside intended Phase D scope → regression

---

## Reopening criteria

A new brief is required if:

1. `ambiguous` status consequences are defined (adds a third code, changes severity model)
2. Coverage patterns in `splitEndpointCoverageDetector.ts` are tightened to corridor-level
   precision (changes from dimension-presence to corridor-completeness — that is Phase 3
   applied to the secondary dimension, requiring a new brief)
3. The gate check block is split or moved outside the existing Phase 2/3 block structure
4. `detectTerminalEndpoint` is called more than once in the gate function
5. Trust state changes are added that depend on Phase D failure codes

---

## Implementation order

1. Write `splitEndpointCoverageDetector.ts` — `hasSecondaryEndpointCoverage` only.
   No gate wiring yet.

2. Write `splitEndpointCoverageDetector.test.ts` — coverage detection tests per
   endpoint type. True positives (each dimension covered), true negatives (dimension
   absent). Full-plan tests against LT-02 skill-only vs full-pipeline shapes.

3. Add `OUTCOME_ENDPOINT_MISSING` and `OUTCOME_SPLIT_DIMENSION_UNCOVERED` to
   `PlanQualityFailureCode` in `planQualityTypes.ts`.

4. Wire Phase D check block into `evaluatePlanQualityGate.ts`:
   - Import `detectTerminalEndpoint` and `hasSecondaryEndpointCoverage`
   - Hoist `deliverableTitles` above Phase 2 block (shared across phases)
   - Add Phase D block after Phase 3 block

5. Run full test suite — verify zero regressions.

6. Update audit probe tests where Phase D changes gate output:
   - LT-02 probe: skill-only plan now also emits `OUTCOME_SPLIT_DIMENSION_UNCOVERED`
   - Note: probe gate assertions are observational (console.log), so no assertion breaks

Step 6 is documentation cleanup, following the established probe update pattern.
