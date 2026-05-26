# JERICHO_PHASE_3_TERMINAL_CORRIDOR_COMPLETENESS_BRIEF.md

## Status

**Draft — implementation brief**
Depends on: Phase 2 complete, `OUTCOME_COVERAGE_PREP_ONLY` gate check active
Grounded in: audit pack evidence LT-03, LT-04
Date: 2026-04-06

---

## Objective

Extend the outcome validity gate to detect terminal corridor incompleteness in
externally mediated and mixed-authority goals. Phase 2 established the first
non-prep threshold: a plan must cross from preparation into external engagement.
Phase 3 establishes the second threshold: a plan that has crossed into external
engagement must also reach the terminal corridor stage — the deliverable layer
that directly precedes or represents the external decision event.

**Phase 3 question:**
> "Does the plan include at least one deliverable representing the terminal
> approach stage — the point at which the external party's decision becomes
> the blocking event?"

**Freeze criterion:**
> "Terminal-stage coverage is enforced for known lanes, with zero false positives
> on valid full-corridor plans and zero regressions on fully_controllable and
> market_dependent goals."

---

## Phase ordering rationale

`JERICHO_OUTCOME_VALIDITY_GATE_SPEC.md` labeled corridor completeness as Phase 4
and `OUTCOME_VERIFICATION_TEXT_NOT_COVERED` as Phase 3. This brief inverts that
order for two reasons:

1. **Bounded vocabulary vs. clause parsing.** Corridor completeness uses bounded
   pattern matching over deliverable titles — the same class of detection as
   Phase 2. Clause parsing of verification text requires robust sentence boundary
   detection and semantic overlap evaluation, which is more fragile at current
   system scope.

2. **Proven audit evidence.** LT-03 and LT-04 already provide two confirmed
   terminal-corridor gaps. The deliverable title vocabulary for both lanes is
   well-characterized by the audit pack. Implementing clause parsing on the same
   evidence base would require a separate extraction layer that may introduce
   more noise than value at this stage.

The spec's Phase 3 (`OUTCOME_VERIFICATION_TEXT_NOT_COVERED`) is deferred to
Phase 4 in the implementation sequence. All phase numbering in this brief uses
the implementation sequence, not the spec's sequence.

---

## Scope

### In scope

1. Two new files:
   - `src/domain/planQuality/corridorLaneDetector.ts` — determines which
     corridor lane applies given goal text and authority result
   - `src/domain/planQuality/terminalStageDetector.ts` — per-lane terminal
     stage pattern matching

2. One new failure code: `OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING`
   added to `PlanQualityFailureCode`

3. Gate wiring in `evaluatePlanQualityGate.ts`:
   - detect lane after Phase 2 check completes
   - if lane known and authority is `externally_mediated` or `mixed`:
     check terminal-stage coverage
   - emit `OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING` if missing

4. Acceptance tests for both lane detectors and terminal stage detectors
   (`terminalStageDetector.test.ts`)

5. Probe test updates where behavior changes are expected (see §10)

### Out of scope (explicit non-goals)

- Trust state changes of any kind
- `provisional_external` / `provisional_market` trust state variants
- Clause parsing of verification text (`OUTCOME_VERIFICATION_TEXT_NOT_COVERED`)
- Intermediate stage enforcement (diligence, evaluation, follow-up) —
  Phase 3 requires terminal stage only; intermediate stages are not mandated
- Mixed-authority decomposition beyond authority filter
- Any new lanes beyond JobSearch and Fundraising
- Probability scoring changes
- Response/rejection management encoding (RC-20 residual — separate work)
- Market-dependent corridor completeness (distribution stage check)
- `OUTCOME_EXTERNAL_DEPENDENCY_UNREPRESENTED` (Phase 4 or later)
- `OUTCOME_AUTHORITY_UNACKNOWLEDGED` (requires plan representation layer)
- Any modification to `contactStageDetector.ts` or Phase 2 behavior

**Hard non-goal:** full corridor stage validation. Phase 3 requires only
terminal-stage presence. A plan that has contact-stage coverage and terminal-stage
coverage but skips diligence/evaluation deliverables is NOT rejected by Phase 3.
Stage compression is a valid plan shape. Intermediate stage enforcement is deferred.

---

## Canonical corridor stage map

### Stage taxonomy

Each corridor has four conceptual stages:

```
Stage 0 — Preparation:  controllable artifacts enabling external engagement
Stage 1 — Contact:      direct external engagement begins (Phase 2 enforces)
Stage 2 — Evaluation:   external party conducts due diligence or assessment
Stage 3 — Terminal:     external party's decision is the blocking event
```

Phase 2 enforces: Stage 1 must be present.
Phase 3 enforces: Stage 3 must be present.

Stages 0 and 2 are structurally expected but not individually mandated by either
phase. A plan may legitimately compress Stage 2 into Stage 1 or Stage 3.

### Corridor map — JobSearch lane

**Terminal event:** employer extends and user accepts a job offer

| Stage | Description | Example deliverables |
|-------|-------------|---------------------|
| 0 | Preparation | Tailor resume, build company list, prepare interview story bank |
| 1 | Contact | Submit applications, apply to target companies |
| 2 | Evaluation | Interview at/with target companies, phone screens, technical assessments |
| 3 | Terminal | Receive and evaluate job offer, accept position, sign offer letter |

**Stage 3 required indicators** (at least one must be present):

```
/\b(job\s+offer|offer\s+letter)\b/i
/\b(receive|evaluate|accept|negotiate|sign|respond\s+to).{0,25}\b(offer|position|role)\b/i
/\b(offer|position|role).{0,25}\b(received|accepted|evaluated|negotiated|signed)\b/i
/\b(employment\s+confirmed|confirm\s+start\s+date|onboard)\b/i
/\b(accepted\s+(the\s+)?(position|role|offer))\b/i
```

**Explicit Stage 2 exclusions — do NOT satisfy Stage 3:**
- "Prepare interview story bank and answer framework" → Stage 0 (internal prep)
- "Run mock interviews and follow-up practice" → Stage 0 (internal prep)
- "Log responses and manage active interview stages" → tracking, not terminal
- "Complete interviews at target companies" → Stage 2 only; "complete" without
  offer context does not reach Stage 3

**Stage compression rules:**
- One deliverable may satisfy both Stage 2 and Stage 3 if it explicitly names
  both interview process AND offer evaluation:
  "Complete interview process and receive and evaluate job offers" → satisfies Stage 3
- "Interview at target companies" alone satisfies Stage 2 but not Stage 3

### Corridor map — Fundraising lane

**Terminal event:** investor signs and transfers funds

| Stage | Description | Example deliverables |
|-------|-------------|---------------------|
| 0 | Preparation | Deck, thesis, investor list, diligence checklist, outreach scripts |
| 1 | Contact | Investor outreach and meetings |
| 2 | Evaluation | Follow-up materials, diligence requests, investor Q&A |
| 3 | Terminal | Term discussions, signed commitments, close, wire confirmation |

**Stage 3 required indicators** (at least one must be present):

```
/\bterm\s+(sheet|discussions?|negotiation|review|agreement)\b/i
/\bclose\s+(round|the\s+round|process|documentation)\b/i
/\bclose\s+round\b/i
/\b(signed|received)\s+(commitment|investment|agreement|term)\b/i
/\bcommitment\s+tracking\b/i
/\bwire\s+(transfer|confirmation|confirmed|transfer\s+confirmed)\b/i
/\bfinal\s+(close|documentation|sign)\b/i
/\blegal\s+close\b/i
/\bfunds?\s+(received|confirmed|transferred)\b/i
/\binvestment\s+(confirmed|closed|signed|received)\b/i
```

**Rationale for `commitment tracking` as Stage 3:**
"Commitment tracking" in a fundraising context indicates the plan reaches the
stage where investor commitments exist to be tracked. Unlike "pipeline tracking"
(generic management), "commitment tracking" is terminal-stage vocabulary because
commitments do not precede investor engagement — they follow the decision to invest.

**Stage compression rules:**
- "Coordinate term discussions and commitment tracking" satisfies Stage 3 via
  "term discussions" — term discussions occur only after investor conditional
  acceptance, making this a terminal-corridor indicator
- "Manage close process and legal documentation" satisfies Stage 3 via "close
  process" — this is the wire/signature stage

**Explicit exclusions — do NOT satisfy Stage 3:**
- "Deliver follow-up materials and manage diligence requests" → Stage 2
- "Prepare outreach sequences and intro request scripts" → Stage 0
- "Run fundraising readiness review" → Stage 0 (internal)
- "Coordinate" alone without "term" or "commitment" context → process management

---

## Detection invariant: object-over-verb

**Terminal-stage detection must be anchored primarily on lane-specific terminal
objects and events, not on generic completion verbs.**

This invariant is binding for all Phase 3 pattern additions and all future lane
additions.

**Why this matters:**

Generic late-stage verbs — `finalize`, `coordinate`, `manage`, `complete`,
`wrap up`, `close out` — appear at every corridor stage. They carry no
terminal-stage signal on their own. A deliverable like "Finalize preparation
materials" contains `finalize` and is Stage 0. A deliverable like "Coordinate
investor feedback loop" contains `coordinate` and is Stage 2.

If terminal-stage detection is verb-driven, it replicates the RC-23 fragility
(where REVIEW fired on "polished" and MARKET fired on "reach" in "outreach")
in a new layer.

**The rule:**

A deliverable title satisfies terminal-stage detection when it contains a
**lane-specific terminal noun or object phrase** — regardless of which verb
precedes it.

| Lane | Terminal objects | Examples |
|------|-----------------|----------|
| JobSearch | `offer`, `offer letter` | "Receive offer", "Evaluate offer letter", "Sign offer" |
| Fundraising | `term sheet`, `commitment`, `signed agreement`, `wire transfer`, `close`, `legal close` | "Finalize term sheet", "Coordinate term discussions", "Confirm wire transfer" |

Generic verbs that accompany these objects are tolerated but do not extend
detection to titles lacking the terminal object:

```
// correct: fires on terminal object "term sheet"
"Finalize term sheet and manage signature workflow"  → terminal

// correct: does not fire; "finalize" without terminal object
"Finalize pitch deck for investor review"            → not terminal (Stage 0)

// correct: fires on terminal object "offer"
"Evaluate and respond to job offers"                 → terminal

// correct: does not fire; "evaluate" without terminal object
"Evaluate interview performance and identify gaps"   → not terminal (Stage 2)
```

**Implementation constraint:**

Pattern authors must be able to identify which terminal object in the pattern
text is load-bearing. If a pattern would fire on a title where the terminal
object is removed, the pattern is over-broad and must be tightened.

---

## Lane detection

### Purpose

The corridor lane detector determines which Stage 3 pattern set to apply.
If neither lane fires, Phase 3 check is skipped. Unknown-lane goals receive no
terminal-stage check in this phase.

### Module: `corridorLaneDetector.ts`

```typescript
export type CorridorLane = 'JobSearch' | 'Fundraising' | 'unknown';

export function detectCorridorLane(
  goalText: string,
  verificationText: string
): CorridorLane
```

**JobSearch lane trigger patterns:**

Goal text or verification text must contain at least one strong signal:
```
/\b(get\s+(a|the|hired|full.?time|part.?time)|land\s+(a|the)\s+(job|role|position)|hired\s+(as|at|by))\b/i
/\b(job\s+offer|offer\s+letter|full.?time\s+(role|position|job|employment))\b/i
/\b(junior|senior|mid.?level).{0,25}\b(developer|engineer|designer|analyst|manager)\b/i
/\b(full.?time\s+employment|full.?time\s+job)\b/i
```

**Fundraising lane trigger patterns:**

Goal text or verification text must contain at least one strong signal:
```
/\b(raise\s+\$[\d,]+|raising\s+\$[\d,]+|raise\s+(seed|series|funding|capital))\b/i
/\b(investor|investment|venture\s+capital|vc|angel\s+investor)\b/i
/\b(funding\s+round|seed\s+round|series\s+[abc]|pre.?seed)\b/i
/\bsigned\s+investment\s+agreement\b/i
```

**Priority:** JobSearch takes precedence when both could fire (unlikely in practice
but possible for mixed goals). If goal is `mixed` authority and both lanes are
detected, check both lane terminal-stage patterns — the plan must satisfy at
least one terminal stage.

**Unknown:** If neither JobSearch nor Fundraising patterns fire, return `'unknown'`
and skip Phase 3 gate check. Do not apply default corridor assumptions.

---

## Terminal stage detection

### Module: `terminalStageDetector.ts`

```typescript
export function hasTerminalStageDeliverable(
  lane: CorridorLane,
  deliverableTitles: string[]
): boolean
```

This function is the direct analogue of `hasContactStageDeliverable` from Phase 2.
It returns `true` if any deliverable title in the set matches the terminal-stage
patterns for the given lane. Returns `true` immediately for `'unknown'` lane
(no check applies).

**Bounded vocabulary rule:** the same discipline as `contactStageDetector.ts`
applies here. Additions to terminal-stage patterns require:
1. Explicit justification
2. A negative-case test confirming no false positives on Stage 0/1/2 deliverables

---

## Failure code

### New code: `OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING`

```typescript
type PlanQualityFailureCode =
  // existing codes ...
  | 'OUTCOME_COVERAGE_PREP_ONLY'               // Phase 2: never left prep
  | 'OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING'  // Phase 3: left prep, no terminal
```

**Distinction from `OUTCOME_COVERAGE_PREP_ONLY`:**

| Code | Condition | Meaning |
|------|-----------|---------|
| `OUTCOME_COVERAGE_PREP_ONLY` | No contact-stage deliverable | Plan never engaged the external party |
| `OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING` | Contact-stage present, no terminal-stage deliverable | Plan engaged the external party but did not model the corridor to the decision event |

These codes do not fire simultaneously on the same plan. If `OUTCOME_COVERAGE_PREP_ONLY`
fires (contact stage absent), the terminal-stage check is still run independently
but would also fire since a prep-only plan also lacks terminal coverage. Both may
appear in `failureCodes` together for a prep-only plan — this is correct because
the plan has two distinct insufficiencies. The gate does not short-circuit after
the first outcome code.

**Relationship to spec:** `JERICHO_OUTCOME_VALIDITY_GATE_SPEC.md` defines
`OUTCOME_COVERAGE_MISSING_TERMINAL_CORRIDOR` as the broad corridor-level code.
`OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING` is the Phase 3 scoped variant — it
fires only on the terminal stage absence. When the full outcome validity gate
layer is implemented, this code may be subsumed into the spec's broader code or
kept as a sub-code with the spec code as an umbrella. For now, they coexist in
the `PlanQualityFailureCode` union.

---

## Gate integration

### Call sequence in `evaluatePlanQualityGate.ts`

Phase 3 check runs after Phase 2 check:

```typescript
// Phase 2 (existing)
const outcomeAuthority = deriveTerminalOutcomeAuthority(goalText, verificationText);
if (outcomeAuthority.authority === 'externally_mediated' || outcomeAuthority.authority === 'mixed') {
  const deliverableTitles = deliverables.map((d) => normalizeText(d?.title));
  if (!hasContactStageDeliverable(deliverableTitles)) {
    failureCodes.add('OUTCOME_COVERAGE_PREP_ONLY');
    reasonCodes.add('OUTCOME_COVERAGE_PREP_ONLY');
  }
}

// Phase 3 (new)
if (outcomeAuthority.authority === 'externally_mediated' || outcomeAuthority.authority === 'mixed') {
  const lane = detectCorridorLane(goalText, verificationText);
  if (lane !== 'unknown') {
    const deliverableTitles = deliverables.map((d) => normalizeText(d?.title));
    if (!hasTerminalStageDeliverable(lane, deliverableTitles)) {
      failureCodes.add('OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING');
      reasonCodes.add('OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING');
    }
  }
}
```

**Implementation note:** `deliverableTitles` is derived once and reused. The
authority result from Phase 2 is shared with Phase 3 — no recomputation.

---

## Expected probe test behavior changes

Phase 3 changes gate behavior for two probe scenarios that currently pass or emit
only Phase 2 codes. Both probe test gate assertions are observational (console.log
only, no `expect` on status). No existing assertions break.

However, the probe test console output will change:

### LT-03: `job_search_pipeline gate with bootstrapped actions`

**Before Phase 3:**
```
status: PLAN_QUALITY_PASSED
failureCodes: []
```

**After Phase 3:**
```
status: PLAN_QUALITY_WITHHELD
failureCodes: ["OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING"]
```

**Why:** The LT-03 probe pipeline (define target → tailor → company list →
tracker → submit batch → interview story bank → mock interviews → log responses)
has no offer-stage deliverable. "Log responses and manage active interview stages"
is tracking, not terminal. Phase 3 correctly identifies this gap.

**Consequence:** The current probe pipeline represents a known incomplete plan.
This is the correct gate verdict. The probe's descriptive comment at line 189
("Gate does not probe whether any deliverable is contingent on employer decision")
should be updated to note that Phase 3 now withholds for this plan shape.

### LT-03: `skill_acquisition contamination gate`

**Before Phase 3:**
```
status: PLAN_QUALITY_WITHHELD
failureCodes: ["OUTCOME_COVERAGE_PREP_ONLY"]
```

**After Phase 3:**
```
status: PLAN_QUALITY_WITHHELD
failureCodes: ["OUTCOME_COVERAGE_PREP_ONLY", "OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING"]
```

**Why:** Skill deliverables have no contact stage (Phase 2 fires) AND no
terminal stage (Phase 3 also fires). Both codes are correct. Neither fires
erroneously.

### LT-04: `fundraising full pipeline gate`

**No change.** "Coordinate term discussions and commitment tracking" satisfies
Stage 3 via "term discussions." The full pipeline continues to pass.

### LT-04: `fundraising packagePrepMode gate`

**No change from Phase 2 state.** Already withheld with `OUTCOME_COVERAGE_PREP_ONLY`.
Phase 3 would also fire `OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING` (no terminal
stage, consistent with prep-only plan). Both codes appear together.

---

## Acceptance tests

**File:** `src/domain/planQuality/terminalStageDetector.test.ts`

### Lane detection tests

```
JobSearch: "Get a full-time junior full-stack developer job within 6 months"
  → detectCorridorLane → 'JobSearch'

Fundraising: "Raise $50,000 in funding for my startup within 9 months"
  → detectCorridorLane → 'Fundraising'

Fully controllable: "Launch a landing page for my app"
  → detectCorridorLane → 'unknown'

Market-dependent: "Grow my podcast to 1,000 listeners"
  → detectCorridorLane → 'unknown'
```

### Terminal stage true positives — JobSearch

```
"Receive and evaluate job offer from target employer"    → true
"Accept position and confirm start date"                → true
"Evaluate and respond to job offers"                    → true
"Sign offer letter and negotiate start terms"           → true
"Offer letter received and accepted"                    → true
```

### Terminal stage true negatives — JobSearch

```
"Submit first tailored application batch"               → false (Stage 1)
"Interview at target companies"                         → false (Stage 2)
"Prepare interview story bank and answer framework"     → false (Stage 0)
"Run mock interviews and follow-up practice"            → false (Stage 0)
"Log responses and manage active interview stages"      → false (tracking)
"Complete interviews at target companies"               → false (Stage 2 only)
```

### Terminal stage true positives — Fundraising

```
"Coordinate term discussions and commitment tracking"   → true
"Receive signed investment commitments and manage close"→ true
"Execute legal close process and wire confirmation"     → true
"Finalize term sheet and manage signature workflow"     → true
"Close funding round and confirm wire transfer"         → true
"Manage close documentation and commitment sign-off"   → true
```

### Terminal stage true negatives — Fundraising

```
"Run first wave of investor outreach and meetings"      → false (Stage 1)
"Deliver follow-up materials and manage diligence"      → false (Stage 2)
"Build target investor list and fit scoring model"      → false (Stage 0)
"Prepare outreach sequences and intro request scripts"  → false (Stage 0)
"Run fundraising readiness review"                      → false (Stage 0)
"Create diligence checklist and data room structure"    → false (Stage 0)
```

### Full-plan tests: `hasTerminalStageDeliverable`

**LT-04 full pipeline — has terminal stage (term discussions)**
```typescript
const titles = [
  'Define raise objective, use-of-funds, and investor thesis',
  'Build fundraising narrative and deck storyline',
  'Create diligence checklist and data room structure',
  'Build target investor list and fit scoring model',
  'Prepare outreach sequences and intro request scripts',
  'Run first wave of investor outreach and meetings',
  'Deliver follow-up materials and manage diligence requests',
  'Coordinate term discussions and commitment tracking',  // ← terminal
];
expect(hasTerminalStageDeliverable('Fundraising', titles)).toBe(true);
```

**LT-04 packagePrepMode — NO terminal stage**
```typescript
const titles = [
  'Define raise objective, use-of-funds, and investor thesis',
  'Build fundraising narrative, pitch deck, and financial ask storyline',
  'Create diligence checklist, financial package, and data room structure',
  'Build target investor list and fit scoring model',
  'Prepare outreach sequences, intro request scripts, and send package checklist',
  'Run fundraising readiness review, objection handling, and investor-ready materials check',
];
expect(hasTerminalStageDeliverable('Fundraising', titles)).toBe(false);
```

**LT-04 contact-only hypothetical — NO terminal stage**
```typescript
const titles = [
  'Run first wave of investor outreach and meetings',  // contact (Phase 2)
  'Deliver follow-up materials and manage diligence',  // evaluation
];
// Has contact, no terminal
expect(hasTerminalStageDeliverable('Fundraising', titles)).toBe(false);
```

**LT-03 current probe pipeline — NO terminal stage (confirmed gap)**
```typescript
const titles = [
  'Define target role family and search criteria',
  'Tailor resume and portfolio for target roles',
  'Build target company list and prioritization model',
  'Create application pipeline tracking and outreach workflow',
  'Submit first tailored application batch',         // contact (Phase 2)
  'Prepare interview story bank and answer framework',
  'Run mock interviews and follow-up practice',
  'Log responses and manage active interview stages',
];
expect(hasTerminalStageDeliverable('JobSearch', titles)).toBe(false);
```

**LT-03 complete pipeline hypothetical — has terminal stage**
```typescript
const titles = [
  // ... (same as above) ...
  'Receive and evaluate job offers from target employers',  // ← terminal
];
expect(hasTerminalStageDeliverable('JobSearch', titles)).toBe(true);
```

**Fully controllable goal (podcast) — lane unknown, no check**
```typescript
expect(detectCorridorLane('Launch a podcast and reach 1,000 listeners', '')).toBe('unknown');
// Phase 3 check is skipped — no terminal stage assertion needed
```

---

## Freeze criteria

Phase 3 is complete when:

1. `corridorLaneDetector.ts` exists with one exported `detectCorridorLane` function
2. `terminalStageDetector.ts` exists with one exported `hasTerminalStageDeliverable` function
3. `OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING` added to `PlanQualityFailureCode` union
4. Gate wiring in `evaluatePlanQualityGate.ts` emits the new code correctly
5. Both lane detectors classify correctly:
   - LT-03 goal → `'JobSearch'`
   - LT-04 goal → `'Fundraising'`
   - Podcast/landing page goals → `'unknown'`
6. All positive and negative terminal stage pattern tests pass
7. LT-04 full pipeline gate continues to pass (no regression)
8. LT-04 packagePrepMode gate withholds (Phase 2 behavior preserved; both Phase 2
   and Phase 3 codes may appear)
9. LT-03 current probe pipeline withholds with `OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING`
   (correct identification of the existing gap)
10. No trust state changes
11. No regressions on fully_controllable and market_dependent goals
12. Full test suite passes

**Explicit failure conditions:**

- A fully_controllable goal (podcast, landing page) triggers
  `OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING` → Phase 3 has overstepped (authority
  filter must prevent this)
- A market_dependent goal triggers terminal stage check → authority filter bug
- A known-lane fully valid pipeline fails because an intermediate stage is required
  → Phase 3 is over-enforcing (must require terminal stage only, not all stages)
- Any existing test that does not involve an externally_mediated or mixed goal
  changes its gate verdict → regression

---

## Implementation order

1. Write `corridorLaneDetector.ts` — `detectCorridorLane` only. No gate wiring yet.

2. Write `terminalStageDetector.ts` — `hasTerminalStageDeliverable` for both lanes.
   Return `true` for `'unknown'` lane.

3. Write `terminalStageDetector.test.ts` — all lane detection tests, true positives,
   true negatives, and full-plan tests. Run against the detector functions directly
   (not through the gate).

4. Add `'OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING'` to `PlanQualityFailureCode` in
   `planQualityTypes.ts`.

5. Wire into `evaluatePlanQualityGate.ts` — import both new modules, add Phase 3
   check block after Phase 2 check block.

6. Run full test suite. Verify:
   - New terminal stage detector tests: all pass
   - LT-04 probe: full pipeline still passes, packagePrepMode withholds
   - LT-03 probe: current pipeline now withholds with `OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING`
   - Existing structural gate tests: zero regressions

7. Update LT-03 probe test comments at lines 189–191 to reflect Phase 3 behavior.
   (No assertion changes required — probe gate tests are observational only.)

Step 7 is documentation cleanup, not behavior change. The probe test assertions
remain observational. The console.log output now reflects Phase 3 gate behavior.
