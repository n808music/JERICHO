# JERICHO_TERMINAL_ENDPOINT_RECOGNITION_FREEZE.md

## Status

**Frozen — Terminal Endpoint Recognition v1**
Depends on: JERICHO_TERMINAL_ENDPOINT_RECOGNITION_BRIEF.md
Upstream of: Outcome Validity Package (frozen v1)
Date: 2026-04-06

---

## What this document records

This document freezes the Terminal Endpoint Recognition detector and its
contract attachment. It is the authoritative record of what was built in
Phases B and C and what is now stable.

Future work that depends on endpoint recognition as a truth surface must
reference this document and state explicitly what phase of enforcement
or integration it is adding.

---

## Package boundary

### Canonical files

| File | Role |
|------|------|
| `src/domain/goal/terminalEndpointDetector.ts` | Single canonical detector — `detectTerminalEndpoint(goalText, verificationText): TerminalEndpointResult` |
| `src/domain/goal/terminalEndpointDetector.test.ts` | 60 unit tests — Phase B |
| `src/domain/goal/audit_endpoint_recognition_probe.test.ts` | 38 Phase C probe tests — audit pack matrix, all five status classes, contamination doctrine, invariant, regression surface |

### Contract attachment

`GoalIntakeContract.terminalEndpoint: TerminalEndpointResult`

Populated by a single call in `buildGoalIntakeContract`, placed after
`terminalOutcomeAuthority`. All downstream reads must go through this field.
No recomputation at call sites.

### What is NOT in this package

- No gate enforcement (zero `failureCodes` emitted based on `terminalEndpoint`)
- No trust state changes
- No modification to `completionBoundary` or podcast-domain logic
- No Outcome Validity gate changes — the frozen Outcome Validity package
  continues to use its own corridor lane patterns independently

---

## Status taxonomy (frozen)

```typescript
type TerminalEndpointStatus =
  | 'clear_explicit'  // terminal object directly stated in goal/verification text
  | 'clear_inferred'  // endpoint inferred from framing verb + lane context
  | 'ambiguous'       // multiple plausible endpoints, cannot resolve primary
  | 'missing'         // no reliable endpoint detectable
  | 'split';          // multiple distinct terminal outcomes (different authority classes)
```

**`split` is not a weaker form of `ambiguous`.** `split` means two clearly
identified endpoints with distinct authority classes. `ambiguous` means a
single primary endpoint cannot be resolved. These are structurally different.

---

## Audit pack verification matrix

All 7 audit goals verified through the contract path in
`audit_endpoint_recognition_probe.test.ts`:

| Goal | Status | Primary endpoint | Secondary |
|------|--------|-----------------|-----------|
| ST-01 (landing page) | `clear_explicit` | `artifact_complete` | — |
| ST-02 (fitness goal) | `clear_explicit` or `missing` (phrasing-dependent) | not externally mediated | — |
| ST-03 (brand launch) | `split` | `artifact_complete` | `audience_threshold` |
| LT-01 (podcast) | `split` | `published_live` | `audience_threshold` |
| LT-02 (fullstack + job) | `split` | `artifact_complete` | `offer_received` |
| LT-03 (job search) | `clear_explicit` | `offer_received` | — |
| LT-04 (fundraising) | `clear_explicit` | `capital_secured` | — |

**LT-02 is the canonical `split` proof case.** It establishes the pattern of
a compound goal with two distinct terminal outcomes across different authority
classes (artifact_complete = fc, offer_received = externally_mediated).

---

## Binding invariant (frozen)

**Terminal-stage detection is anchored on lane-specific terminal objects and
events, not on generic completion verbs.**

Generic verbs — `finalize`, `coordinate`, `manage`, `complete`, `get`,
`achieve` — do not independently confer terminal endpoint recognition.

Every pattern must have a named load-bearing terminal object. If the object
is removed from the matched text and the pattern still fires, it is over-broad.

**Object map by lane (initial, frozen):**

| Lane | Terminal objects |
|------|-----------------|
| JobSearch | `offer`, `offer letter`, `hired-as`, `employment confirmed` |
| Fundraising | `wire transfer`, `funds received`, `signed investment/commitment`, `term sheet`, `close round`, `legal close` |
| Release/Podcast | `published live`, `episodes published`, `go live`, `released publicly` |
| Artifact (fc) | `(artifact noun) is live/deployed/launched/released` |
| Qualification | `certification earned`, `exam passed`, `degree completed` |
| Market | `N listeners/subscribers/sign-ups`, `$N MRR/ARR` |

---

## Contamination doctrine (frozen)

Verification text contains endpoint evidence AND supporting artifacts AND
process metrics. The terminal endpoint is the state change that:

1. Cannot be reversed
2. Is not a deliverable the user executes alone

**Does not fire:**
- Application volume: "15 applications submitted" (process metric)
- Interview count: "5 interviews completed" (Stage 2 metric)
- Portfolio artifact without completion state: "portfolio contains 3 projects"
- Outreach volume: "50 investor emails sent" (process metric)
- Diligence deliverable: "pitch deck complete, data room built" (Stage 0/2)
- "Record 5 episodes" without publish/live state (Stage 0)

**Does fire even alongside metrics:**
- "offer letter received from target employer" in verification text containing
  application counts → `offer_received` wins as the terminal clause
- "Raise $50,000" in goal text → `capital_secured` even if verification text
  describes only preparation milestones

---

## Key doctrinal distinction confirmed in Phase C

**"Full-time role" / "full-time position" are job-type labels, not terminal events.**

These phrases describe the kind of job sought. The terminal event is the
offer received and accepted, which is inferred from the framing. Detection
is `clear_inferred`, not `clear_explicit`.

This distinction matters because treating job-type labels as explicit terminal
events would cause every job-search goal mentioning a role type to appear
more resolved than it is. The actual binary terminal event is the hiring
decision by the external party.

---

## Pattern fixes applied during implementation

These were discovered under test. Each fix is semantically faithful to the
underlying terminal object:

| Issue | Fix | Rationale |
|-------|-----|-----------|
| `\w+` blocked hyphenated words ("full-stack") | `[\w-]+` in intervening-word slots | Hyphenated adjectives are single semantic units |
| `\boffer\b` blocked plural ("offers") | `\boffers?\b` | Plural form is same terminal object |
| `\bepisode\b` blocked plural ("episodes") | `\bepisodes?\b` | Same object in plural |
| `sign-ups` not in audience threshold | Added `sign.?ups?` pattern | "Sign-ups" is equivalent to "subscribers" as audience metric |
| Split compound check missing `artifactEndpointPresent + marketEndpointPresent` | Unified into `releaseOrArtifactPresent` | Both represent the same fc/release category for split detection |

---

## Test surface

| File | Tests | Role |
|------|-------|------|
| `src/domain/goal/terminalEndpointDetector.test.ts` | 60 | Phase B — unit tests for all pattern classes |
| `src/domain/goal/audit_endpoint_recognition_probe.test.ts` | 38 | Phase C — audit pack contract path, status classes, contamination, invariant, regression |
| `audit_lt02_probe.test.ts` Probe 3 | +2 assertions | LT-02 canonical split proof — contract path |
| `audit_lt03_probe.test.ts` Probe 3 | +3 assertions | LT-03 offer_received — contract path |
| `audit_lt04_probe.test.ts` Probe 3 | +3 assertions | LT-04 capital_secured — contract path |

Total package-specific tests: 98 assertions across detector and probe files.
Full suite: **1659/1659 tests, 340 files — zero regressions.**

---

## Dependency relationship to Outcome Validity

The Outcome Validity package (frozen v1) uses corridor lane patterns and
terminal-stage patterns derived from audit-pack knowledge of what endpoints
look like. It does **not** yet consume `terminalEndpoint` from the contract.

This is intentional for the Phase B/C freeze. The two packages coexist
independently:

- Outcome Validity: checks whether the plan traverses the required corridor stages
- Terminal Endpoint Recognition: identifies what event the corridor is traversing toward

A future phase may integrate them — deriving terminal-stage patterns from
the canonical endpoint object rather than hard-coded lane vocabularies.
That work requires a new brief and a new freeze for Outcome Validity.

---

## What this package does not address

1. **Gate enforcement** — no failure code is emitted based on `terminalEndpoint`
   status. `missing` or `ambiguous` endpoints do not yet withhold the gate.
   Phase D (enforcement brief) is the next step.

2. **Endpoint correction UX** — when endpoint is `missing` or `ambiguous`,
   there is no mechanism to prompt the user for clarification. This is a
   product concern outside this spec.

3. **Split-endpoint enforcement** — `split` goals are recognized but not
   yet checked for per-dimension corridor coverage. Outcome Validity handles
   one primary lane; mixed-authority decomposition per endpoint is deferred.

4. **Clause-level parsing of verification text** — the contamination doctrine
   is enforced through pattern specificity, not by parsing sentences into
   clauses. Full clause extraction remains deferred.

5. **`completionBoundary` integration** — `completionBoundary` remains
   podcast-domain only and is not connected to `terminalEndpoint`. Potential
   future unification would require a new integration brief.

---

## Freeze criteria (all met)

1. `terminalEndpointDetector.ts` exists with one exported `detectTerminalEndpoint`
2. All 7 audit pack goals produce correct status and primaryEndpoint per the probe matrix
3. `GoalIntakeContract` type includes `terminalEndpoint: TerminalEndpointResult`
4. `buildGoalIntakeContract` returns `terminalEndpoint` on every call
5. All five status classes (`clear_explicit`, `clear_inferred`, `split`, `ambiguous`,
   `missing`) are exercised with targeted positive cases
6. Contamination doctrine confirmed: process metrics and supporting artifacts do not
   fire as terminal endpoints
7. Object-over-verb invariant confirmed: generic verbs without terminal objects rejected
8. Regression surface confirmed: unrelated domain goals do not misclassify
9. Zero existing tests broken — 1659/1659, 340 files
10. Zero gate behavior changed
11. Zero trust state changed

---

## Reopening criteria

This freeze is invalidated and a new brief is required if:

1. A new terminal object is added to any lane pattern without a negative test
   confirming non-terminal artifacts in the same lane do not fire
2. A pattern fires without a named terminal object (invariant violation)
3. `terminalEndpoint` is recomputed outside `buildGoalIntakeContract`
4. Enforcement logic is added before a Phase D brief is written and reviewed
5. `completionBoundary` logic is modified to depend on `terminalEndpoint`
   (or vice versa) without a new integration brief
6. A new lane is added to the detector without its own audit probe file
