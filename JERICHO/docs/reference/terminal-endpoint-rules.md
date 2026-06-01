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
