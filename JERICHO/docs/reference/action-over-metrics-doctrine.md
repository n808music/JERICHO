# Action-Over-Metrics Doctrine

**Date:** 2026-08-26
**Status:** PARTIALLY ENFORCED — one site RESOLVED-VERIFIED; two sites confirmed in-scope and open; four sites verified OUT OF SCOPE against the test below
**Supersedes:** an earlier draft claiming "no metric field may exist anywhere in the schema." That version was checked against live code and found false as an absolute — `goalContract.ts`, the default seed, and the artifact-integrity report all carry metric shapes. This version narrows the claim to what it actually means.

---

## Principle

A goal's stated objective may be numeric — a dollar figure, a target date, a
count. Declaring "$3.5B" as an objective is no different in kind from declaring
a Terminal Date; it's a fact about what's being aimed at, not a thing the system
tracks over time.

What Jericho does not do is **hold, compute, or trust a running numeric figure
as its own representation of progress toward a goal.** The system's job is to
close the gap between a stated objective and a plan: decompose the objective into
Initiatives → Projects → Deliverables, each verified only as done or not-done
against an externally-checkable source (Attestation Contract: done-when +
acceptance-evidence). It does not ask "are we at $2.1B of $3.5B" and it does not
store a field meant to answer that question — because answering it requires
either trusting a self-reported number (non-verifiable) or the system performing
accounting computation it has no authority or design basis to audit. Human
integrity already covers that role at full fidelity; re-implementing it in-system
is pure overhead with a worse trust model than the operator's own record.

**Test for any field or question:** does this ask the system to hold, track, or
validate a number as the representation of progress-toward-goal? If yes,
violation — retire it, or push it out to a calculator/spreadsheet outside
Jericho's scope. If the number is a one-time stated objective, or an internal
scheduling/derivation computation not surfaced as operator-facing progress, it is
not in scope for this doctrine.

This is a scope and utility boundary, not a rule against numbers existing
anywhere in the codebase.

---

## RESOLVED-VERIFIED

**Project intake / Contract Admission** (`domain/elicitation/slots/projectSlot.js`)
— the survey no longer asks for a numeric "measurable outcome" with no field to
hold it. It asks what the project produces or ships, populating `description`.

- Source rename: `c7c8786` — note this commit's own subject is
  `CHECKPOINT (UNVERIFIED): two intermixed work streams — do not treat as done`.
  It is the commit that changed the schema (16 files); cite it, not only the
  cleanup.
- Fixture completion + 2 silent source bugs: `3582826` (20 files).
- Orphan module deletion (`isQuantifiableMetric`): `c8383cf`.
- `successMetric`: **0 hits in src, 0 in tests** across 1,044 scanned files.
  Rename complete.
- **No migration needed for in-flight sessions.** `buildProjectDeclarePayload`
  (`projectSlot.js:76-85`) whitelists its six output fields rather than spreading
  `captured`, so a stale `captured.successMetric` from a pre-`c7c8786` persisted
  session cannot reach `DECLARE_PROJECT` and cannot trigger the payload rejection
  that emptied the reference matrix in 3582826. On resume,
  `detect: (captured) => !captured?.description` fires and the survey re-asks that
  one question.

---

## OPEN — in scope, verified reachable

**1. Default goal seed carries a live revenue threshold**
`state/identityStore.js:68-82`, `buildDefaultSeedGoalArtifacts`:

```js
success: [{ metricType: 'threshold', metricName: 'revenue', targetValue: 10000, ... }]
```

Two live callers — `identityStore.js:946` (seed state) and `identityStore.js:2817`
(repair path). Every fresh profile is therefore seeded with a tracked numeric
revenue target. The out-of-the-box example is itself the violation. **This is the
strongest remaining site.**

**2. `SuccessCondition` permits three non-binary metric variants**
`state/contracts/goalContract.ts:5-16`:

```ts
export type MetricType = 'binary' | 'threshold' | 'cumulative' | 'comparative';
export type SuccessCondition = { metricType; metricName; targetValue: number | boolean; ... };
```

Verified construction sites:
- `'binary'` — `identityCompute.js:11545` and `:11826`, `targetValue: true`. The
  production path. Doctrine-compliant.
- `'threshold'` — **only** the seed at site 1.
- `'cumulative'` / `'comparative'` — **zero constructions anywhere in src or
  tests.** Type-declaration only; dead variants.

Sites 1 and 2 are one defect. Fix the seed to `binary`, and all three non-binary
variants become unused and deletable in the same change. `targetValue` narrows to
`boolean`.

---

## Verified OUT OF SCOPE — do not re-sweep these into the claim

**3. `artifactDependencyIntegrity.js:435,551` — `gateCriteriaCoverage`**
Requires `gateCriteria.metricName && gateCriteria.threshold && evidenceArtifactId`
to report `'complete'`. **Produced but never consumed** — the only reference
outside its own definition is an assertion in
`artifactDependencyIntegrity.test.js:162`. Nothing branches on it; it gates
nothing. It encodes a metric expectation in a diagnostic string, which is worth
revisiting for consistency, but it is not an enforced schema requirement and does
not track progress.

**4. `GoalExecutionContract.ts:38` `quantifiedImpact` / `GoalRejectionCode.ts:78`
`SACRIFICE_VAGUE`**
`quantifiedImpact` is a **string** ("8 hours/week"), operator-typed free text in
`SacrificeDeclarationPanel.tsx:73`, describing the cost of a sacrifice — not
progress toward the goal. It is stated once and never tracked or numerically
validated. `SACRIFICE_VAGUE` is declared and given a message string but is
**never emitted** — no reference in `GoalPolicy.ts` or `GoalAdmissionPolicy.ts`,
or anywhere else in src. Out of scope under the test; the unemitted rejection code
is separate dead-code cleanup.

**5. `terminalEndpointDetector.ts:50` `'revenue_threshold'`**
A string literal in the `TerminalEndpointObject` union — an endpoint
*classification label*. Assigned at line 272 from
`hasRevenueThreshold = hasAnyPattern(REVENUE_THRESHOLD_EXPLICIT, combined)`
(line 248), a pure text-pattern match against goal text. `TerminalEndpointResult`
carries the label plus reasons and confidence. **No figure is captured, stored,
or tracked.** It records what kind of endpoint the goal names. Out of scope, as
the draft hypothesized.

**6. `feasibilityDerivation.ts:87-89` conversion thresholds**
`PRESALE_CONVERSION_LOW_THRESHOLD` (0.005), `_MODERATE_` (0.015),
`MARKET_ENGAGEMENT_REVISION_THRESHOLD` (0.3) are module-level derivation
constants that bucket a derived rate into a `RiskRating` enum
(`LOW`/`MODERATE`/`HIGH`) at lines 195-201. The output is an enum, not a number,
and the trace at line 438 labels these `sourceType: 'derivation_logic'` as
distinct from `'intake_field'`. Internal derivation, same category as POS being a
numeric feasibility score. Out of scope.

*Caveat worth naming:* this module does read operator-supplied numbers from
intake — `intake.capitalAvailable` (line 180), `spotifyListeners` (181),
`getAudienceSize` (426). Those are one-time stated capacity facts feeding a
classification, not progress tracking, so they pass the test — but they are
operator-facing numeric fields and should be re-checked if the test is ever
tightened.

**7. `isExternallyVerifiable.ts:19`** — a comment endorsing "quantified public
metrics" as a verifiability model. Commentary, not a field. Worth revisiting for
consistency; not a schema violation.

---

## To reach ENFORCED

This note is currently a written record only — the same gap it was created to
close. Per the standard set by **Disclosure Standard**
(`domain/masterGrid/disclosureStandardGates.test.js`) and **Attestation Contract**
(`domain/product/resolveBlockPlainLanguage.attestationContract.test.js`), doctrine
in this repo is a doctrine statement **plus an enforcing test file plus a
code-comment citation at the enforcement point**. Until sites 1-2 are fixed and a
test pins `metricType` to `binary`, this is a directive, not doctrine.
