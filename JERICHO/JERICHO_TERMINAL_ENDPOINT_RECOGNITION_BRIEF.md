# JERICHO_TERMINAL_ENDPOINT_RECOGNITION_BRIEF.md

## Status

**Draft — doctrine brief**
Upstream of: Outcome Validity Package (frozen v1)
Adjacent to: `completionBoundary` (podcast-domain only, existing)
Grounded in: audit pack evidence ST-01 through LT-04, RC-13 documented
Date: 2026-04-06

---

## The core question

**What exact event counts as this goal being finished?**

Outcome Validity asks: does the plan reach the endpoint, and who controls it?
Terminal endpoint recognition asks: what is the endpoint?

These are adjacent but independent. A system can classify authority correctly
and still be reasoning about the wrong endpoint. A system can enforce terminal-stage
coverage for the wrong terminal event.

The current system has this gap. Outcome Validity is frozen on a stable authority
model and corridor-stage enforcement — but the endpoint each plan is measured
against is not canonically derived. It is implied from goal text, authority
classification, and lane detection, without an explicit endpoint contract.

This brief defines the work to close that gap.

---

## Relationship to `completionBoundary`

`completionBoundary` is the existing endpoint concept. It is **podcast-domain
only**. The type is:

```typescript
export type CompletionBoundary =
  | 'recorded' | 'edited' | 'publish_ready' | 'published' | 'distributed'
  | 'approved' | 'custom';
```

For all 6 non-podcast audit goals, `completionBoundaryStatus: 'missing'`. This
is RC-13: endpoint recognition fails for all non-podcast lanes because the existing
mechanism was never generalized.

Terminal endpoint recognition is not a replacement for `completionBoundary`. It
is the upstream generalization — the layer that defines what "done" means across
all goal types, not just the podcast domain. Once implemented:

* `completionBoundary` remains the podcast-domain mechanism (unchanged)
* `terminalEndpoint` is the cross-domain canonical truth surface
* The two may eventually share a resolution path, but that is deferred

**What completion boundary does vs. what endpoint recognition does:**

| | `completionBoundary` | `terminalEndpoint` |
|-|---------------------|-------------------|
| Scope | Podcast domain only | All goal types |
| Resolution | Verb-driven + user-confirmed | Object-anchored, lane-aware |
| Status classes | resolved / ambiguous / missing | clear_explicit / clear_inferred / ambiguous / missing / split |
| Gate consequence | Blocks intake if ambiguous | Phase B — detection only, no gate change |
| Primary question | "At what production stage is this episode done?" | "What real-world event constitutes this goal being achieved?" |

---

## Why endpoint recognition is upstream of Outcome Validity

Outcome Validity Phase 2 asks: does the plan cross from preparation into external
engagement? Phase 3 asks: does it reach a terminal-stage deliverable?

But the terminal-stage patterns in Phase 3 were derived by reasoning about the
terminal event for each lane from the audit pack directly. That reasoning was
sound for the audited lanes. It is not guaranteed to remain sound as new lanes
are added, as mixed-authority goals become more common, or as goal text uses
less canonical phrasing.

Terminal endpoint recognition makes that reasoning **canonical and inspectable**:
instead of implying the endpoint from lane patterns, the system derives it
explicitly from goal text and verification text, stores it on the contract, and
exposes it to all downstream consumers.

The analogy to Phase 1 of Outcome Validity is direct:
* Phase 1 made authority classification canonical before gate enforcement
* Terminal endpoint recognition makes endpoint derivation canonical before
  endpoint-dependent gate enforcement

---

## Endpoint status taxonomy

Recognition produces one of five statuses:

### `clear_explicit`

The terminal event is directly stated in goal text or verification text using
unambiguous endpoint language.

Examples:
- "Get a job offer from a target employer" → terminal event: offer received
- "Raise $50,000 — verified by signed investment agreement and wire confirmation"
  → terminal events: signed agreement + wire (two events, one goal, both clear)
- "Publish and launch a podcast episode" → terminal event: published/live
- "Earn my PMP certification" → terminal event: certification earned

Recognition is anchored on the terminal object, not the framing verb.

### `clear_inferred`

The terminal event is not literally named but can be canonically inferred from
the goal structure, authority class, and lane context.

Examples:
- "Land a junior software engineering role within 6 months" — "land" implies
  offer+acceptance; endpoint inferred as offer received even without explicit
  "offer letter" phrasing
- "Close a seed round" — "close" in fundraising context canonically implies
  signed commitments + funds received
- "Get hired as a backend engineer" — "hired" implies offer received + accepted

Inference is allowed when:
1. The framing verb has a canonical terminal object in the lane's endpoint map
2. The goal authority class confirms the inference is coherent
3. No competing endpoint candidates exist

### `ambiguous`

Multiple plausible endpoints exist and the text does not clearly privilege one.

Examples:
- "Build a portfolio and get noticed by employers" — "get noticed" is not a
  binary terminal event; the endpoint is unclear
- "Grow my skills and eventually get hired" — "eventually" decouples preparation
  from a specific terminal event
- "Launch my startup and start generating revenue" — "launch" (fc endpoint) and
  "generating revenue" (market_dependent endpoint) are both plausible primaries

`ambiguous` does not mean the goal is ill-formed. It means endpoint recognition
cannot resolve a single governing terminal event.

### `missing`

No reliable endpoint is detectable. The goal text describes a direction, process,
or capability without naming a completion state.

Examples:
- "Become a better developer" — no binary terminal event
- "Work on my fitness" — no endpoint clause
- "Improve my presentation skills" — no completion marker

`missing` is the RC-13 state for non-podcast goals in the current system.
Not every `missing` endpoint is a user error — some goals are intentionally
open-ended. But `missing` must be distinguishable from `clear_explicit` to make
downstream gate logic honest.

### `split`

The goal text names more than one distinct terminal outcome, each representing
a separate completion event with potentially different authority classes.

This is the LT-02 pattern: "Become a full-stack developer AND land a junior
software engineering job." The split recognition status makes explicit what the
authority classifier calls `mixed` — there are two endpoints, not one.

Examples:
- "Build three portfolio projects and receive a job offer" → split:
  artifact-complete (fc) + offer received (externally_mediated)
- "Launch my SaaS and hit $1K MRR" → split:
  product live (fc) + revenue threshold (market_dependent)

`split` is distinct from `ambiguous`. `split` means there are multiple clearly
recognized endpoints. `ambiguous` means a single endpoint cannot be clearly
resolved.

---

## Object-over-verb invariant (binding)

The same invariant from terminal-stage detection applies here:

**Endpoint recognition is anchored on terminal objects and events, not on
generic completion verbs.**

Generic verbs like `get`, `land`, `achieve`, `reach`, `become`, `complete` are
widespread and do not identify endpoints. They must be paired with a recognized
terminal object to trigger recognition.

**Allowed inference chain:**

```
"land" + job-search lane + "role" → infer "offer received" (canonical terminal object)
"close" + fundraising lane + "round" → infer "signed commitment / funds received"
"publish" + release lane → endpoint object: published/live
```

**Not allowed:**

```
"achieve" alone → no terminal object
"get better at" → no terminal object
"become" alone → no terminal object (unless followed by a terminal-object noun)
```

**Pattern authors must name the terminal object.** If a pattern fires without
a named terminal object in the matched text, it is over-broad.

---

## Terminal object map (initial, by lane)

These are the canonical terminal objects per lane. This map is the starting
vocabulary for the detector. Additions require explicit justification and a
negative test.

### JobSearch lane

| Object | Endpoint implied |
|--------|-----------------|
| `offer` / `offer letter` | Employer decision to hire — externally mediated |
| `hired` / `get hired` / `hired as` | Same — accept/offer implied |
| `land (a/the) role/position/job` | Same — "land" canonically implies offer in this lane |
| `start date confirmed` / `onboarding` | Post-offer confirmation (still externally mediated) |

**Does NOT qualify as terminal object:**
- `application`, `interview`, `portfolio`, `resume`, `story bank` — these are
  corridor artifacts, not terminal events

### Fundraising lane

| Object | Endpoint implied |
|--------|-----------------|
| `signed investment agreement` / `signed commitment` | Investor decision — externally mediated |
| `wire transfer confirmed` / `funds received` | Capital secured — externally mediated |
| `term sheet` (in close context) | Near-terminal — investor conditional acceptance |
| `raise $[amount]` / `raising $[amount]` | Framing verb implies capital-secured endpoint |
| `close round` / `legal close` | Terminal close event — externally mediated |
| `funded` / `fund my startup` | Capital secured implied |

**Does NOT qualify as terminal object:**
- `deck`, `pitch`, `investor list`, `diligence checklist`, `outreach`, `meetings`
  — these are corridor artifacts, not terminal events

### Podcast / Release lane

| Object | Endpoint implied |
|--------|-----------------|
| `published` / `publish` (+ episode/content) | Production terminal — self-certifying |
| `live` (+ episode/content) | Same |
| `released` / `release` | Same |
| `distributed` (+ episode/content) | Same |
| `recorded` | Stage 0-1 completion, not full terminal unless `completionBoundary: recorded` |

### Skill / Qualification lane

| Object | Endpoint implied |
|--------|-----------------|
| `certification earned` / `certified` | Externally administered endpoint |
| `exam passed` / `passed` (+ exam noun) | Same |
| `license obtained` | Same |
| `degree completed` / `graduated` | Same |
| `able to [do X]` | Capability endpoint — self-certifying, not externally administered |

**Does NOT qualify as terminal object:**
- `studying`, `completing coursework`, `practice`, `portfolio built` — preparation,
  not terminal event

---

## Endpoint recognition vs. verification text contamination

Verification text often contains both endpoint language AND supporting artifact
language. Endpoint recognition must distinguish them.

**RC-22 principle (established in LT-03/LT-04 audits):**

Verification text contains:
1. Endpoint evidence clauses — "offer letter received and signed"
2. Supporting artifact clauses — "tailored resume submitted to 20+ roles"
3. Process metrics — "15+ applications per week over the final month"

Endpoint recognition targets (1). It must not fire on (2) or (3).

**Contamination patterns to exclude:**

- Numeric thresholds in verification text that describe process volume, not
  endpoint status: "submitted 15 applications" is a metric, not an endpoint
- Artifact completion described in verification text: "portfolio contains 3 projects"
  is a supporting artifact, not the terminal event for a job-search goal
- Temporal/frequency language: "weekly outreach for 3 months" is a process
  requirement, not an endpoint

**The resolution rule:**
When multiple clauses exist in verification text, the terminal endpoint is the
clause that describes the state change that cannot be reversed and is not a
deliverable the user executes alone.

For `externally_mediated` goals: the terminal clause is the one that names
what the external party must do.
For `fully_controllable` goals: the terminal clause is the final state of the
artifact the user produces.
For `market_dependent` goals: the terminal clause is the threshold metric
that must be independently confirmed.

---

## Canonical module

**Path:** `src/domain/goal/terminalEndpointDetector.ts`

This is the single canonical home for all endpoint recognition logic. No parallel
detection in autoStrategy, autoDeliverables, GoalIntakeContract, or gate logic.

**Exports:**

```typescript
export type TerminalEndpointStatus =
  | 'clear_explicit'   // endpoint directly stated, terminal object found
  | 'clear_inferred'   // endpoint canonically inferred from lane + framing verb
  | 'ambiguous'        // multiple plausible endpoints, cannot resolve primary
  | 'missing'          // no reliable endpoint detectable
  | 'split';           // multiple distinct terminal outcomes named

export type TerminalEndpointObject =
  | 'offer_received'               // JobSearch
  | 'hired'                        // JobSearch (implies offer+acceptance)
  | 'capital_secured'              // Fundraising
  | 'signed_commitment'            // Fundraising
  | 'published_live'               // Release/Podcast
  | 'certification_earned'         // Qualification
  | 'revenue_threshold'            // Market-dependent
  | 'audience_threshold'           // Market-dependent
  | 'artifact_complete'            // Fully controllable artifact
  | 'unknown';                     // Fallback

export type TerminalEndpointRecognitionReason =
  | 'TERMINAL_OBJECT_FOUND'        // explicit terminal object matched in text
  | 'FRAMING_VERB_INFERRED'        // framing verb + lane → canonical inference
  | 'AUTHORITY_CLASS_CONFIRMED'    // authority class supports inference
  | 'MULTIPLE_CANDIDATES_FOUND'    // led to ambiguous or split status
  | 'NO_TERMINAL_OBJECT'           // no terminal object found in text
  | 'VERIFICATION_CLAUSE_PRIMARY'  // endpoint resolved from verification text clause
  | 'GOAL_TEXT_CLAUSE_PRIMARY';    // endpoint resolved from goal text clause

export type TerminalEndpointResult = {
  status: TerminalEndpointStatus;
  primaryEndpoint: TerminalEndpointObject;
  secondaryEndpoint?: TerminalEndpointObject; // present when status is 'split'
  reasons: TerminalEndpointRecognitionReason[];
  confidence: 'high' | 'medium' | 'low';
};

export function detectTerminalEndpoint(
  goalText: string,
  verificationText: string,
): TerminalEndpointResult;
```

---

## Contract attachment

Add one field to `GoalIntakeContract`:

```typescript
terminalEndpoint: TerminalEndpointResult;
```

Populated by a single call in `buildGoalIntakeContract` after authority
classification:

```typescript
const terminalEndpoint = detectTerminalEndpoint(
  rawGoalText || '',
  verificationCriteria || '',
);
```

All downstream reads go through this contract field. No recomputation at call
sites. Same discipline as `terminalOutcomeAuthority`.

---

## Audit pack probe matrix

Phase B acceptance tests must assert the correct endpoint for each audit goal:

| Goal | Expected status | Expected endpoint object |
|------|----------------|-------------------------|
| ST-01 (landing page) | clear_explicit | artifact_complete |
| ST-02 (fitness goal) | clear_explicit | artifact_complete |
| ST-03 (brand launch) | split | artifact_complete + audience_threshold |
| LT-01 (podcast) | split | published_live + audience_threshold |
| LT-02 (fullstack + job) | split | artifact_complete + offer_received |
| LT-03 (job search) | clear_explicit | offer_received |
| LT-04 (fundraising) | clear_explicit | capital_secured |

These probe assertions are observational in Phase B — no gate behavior changes
until the detector is frozen.

---

## Non-goals (explicit)

- No gate behavior changes in Phase B (detection only)
- No trust state changes
- No modification to `completionBoundary` or podcast-domain logic
- No attempt to parse multi-sentence verification text into clause trees
  (heuristic clause detection only; full parser is deferred)
- No probability or feasibility changes
- No new failure codes in Phase B
- No enforcement of "endpoint must be present" in Phase B
- No changes to Outcome Validity package (which remains frozen on its current
  terminal-stage pattern matching)

---

## Relationship to Outcome Validity (frozen package)

Phase B of this work is purely observational. The Outcome Validity frozen package
is not modified.

In a future phase (after endpoint detection is frozen and audited), the Outcome
Validity package may be extended to:

1. Derive terminal-stage patterns from the canonical endpoint object rather
   than from hard-coded lane patterns
2. Emit `OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING` based on endpoint object
   mismatch rather than pattern absence
3. Validate that the plan's terminal-stage deliverable actually addresses the
   canonical endpoint object

That would make Outcome Validity and Endpoint Recognition properly integrated.
But that work requires a new brief and a new freeze, and it cannot start until
the endpoint detector is stable.

Until then, the two subsystems coexist independently:
- Outcome Validity uses its frozen corridor lane + terminal-stage patterns
- Terminal endpoint recognition adds canonical endpoint derivation to the contract
- They do not interfere because Phase B adds no gate enforcement

---

## Freeze criteria

Phase B (detection phase) is complete when:

1. `terminalEndpointDetector.ts` exists with one exported `detectTerminalEndpoint` function
2. All 7 audit pack goals produce correct `status` and `primaryEndpoint` per the probe matrix
3. `GoalIntakeContract` type includes `terminalEndpoint: TerminalEndpointResult`
4. `buildGoalIntakeContract` returns `terminalEndpoint` on every call
5. All audit probe tests updated with observational assertions
6. Zero existing tests broken
7. Zero gate behavior changed
8. Zero trust state changed
9. Probe audit tests confirm `terminalEndpoint.status !== 'missing'` for all goals with
   explicit endpoint language, and `=== 'missing'` for goals without

**Explicit failure condition:** if any existing test changes its gate verdict or
trust state as a result of Phase B work, Phase B has overstepped.

---

## Reopening criteria

This package is reopened (new brief required) if:

1. A new terminal object is added to the map without a negative test confirming
   non-terminal artifacts in the same lane do not fire
2. A pattern fires without a named terminal object (invariant violation)
3. The detector is called outside `buildGoalIntakeContract` (recomputation at
   call site)
4. Enforcement logic is added before the detector is frozen (Phase B constraint
   violated)
5. `completionBoundary` logic is modified to depend on `terminalEndpoint`
   (or vice versa) without a new integration brief

---

## Implementation order

1. Write `terminalEndpointDetector.ts` — types and detection function only

2. Write `terminalEndpointDetector.test.ts`:
   - Audit pack probe matrix (7 goals, observational assertions)
   - True positives per lane (explicit endpoint objects)
   - True negatives (corridor artifacts that must not fire)
   - Contamination tests (verification text process metrics, supporting artifacts)
   - Split-goal detection (LT-02 pattern, ST-03 pattern)
   - Ambiguous goal detection (open-ended goal text)
   - Missing endpoint detection

3. Attach to `GoalIntakeContract` type

4. Wire call in `buildGoalIntakeContract` after `terminalOutcomeAuthority` call

5. Run full test suite — confirm zero regressions

6. Update audit probe tests (LT-02, LT-03, LT-04) to assert `terminalEndpoint`
   from contract path — observational only, no new gate assertions

Step 6 follows the Phase 1 Outcome Validity pattern exactly: new contract field
assertions on existing probes, no behavior change.
