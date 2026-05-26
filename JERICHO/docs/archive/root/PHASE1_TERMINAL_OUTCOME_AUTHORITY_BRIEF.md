# PHASE1_TERMINAL_OUTCOME_AUTHORITY_BRIEF.md

## Objective

Add `terminalOutcomeAuthority` as a canonical, inspectable field on
`GoalIntakeContract`. No gate enforcement. No trust-state changes. Detection
only. This is the canonical truth surface that all later phases depend on.

**Freeze criterion:**
> "Authority is computed correctly and stored canonically, without altering
> existing gate behavior."

If Phase 1 changes a single existing gate verdict or trust state, it has
overstepped.

---

## Scope

### In scope

1. New file: `src/domain/goal/terminalOutcomeAuthority.ts`
   — single canonical home for all authority classification logic

2. New types: `TerminalOutcomeAuthority`, `TerminalOutcomeAuthorityReason`,
   `TerminalOutcomeAuthorityResult`

3. One exported function: `deriveTerminalOutcomeAuthority(goalText, verificationText)`
   — deterministic, pure, no side effects

4. One new field on `GoalIntakeContract`: `terminalOutcomeAuthority`

5. One call site in `buildGoalIntakeContract` that populates that field

6. Acceptance tests asserting correct classification across the full audit pack

### Out of scope (explicit non-goals)

- Gate behavior changes of any kind
- Trust state changes of any kind (`posTrust`, `feasibility`, `planQuality`)
- New failure codes on `evaluatePlanQualityGate`
- UI changes
- `provisional_external` / `provisional_market` trust state variants
- Verification text clause parsing (RC-25 Phase 2 dependency)
- Corridor coverage logic
- Anything touching `autoStrategy.ts`, `autoDeliverables.ts`, or
  `mechanismClass.ts`
- RC-21 fix (starting state vocabulary split) — separate work
- RC-22 fix (verification text contamination) — separate work
- RC-24 fix (archetype ID divergence) — separate work

**Hard non-goal:** terminal event wording vs. evidence wording separation.
Verification text contains both "what does success look like" (evidence
language) and "what terminal state is required" (outcome language). Phase 1
must not attempt to parse these apart. Detection heuristics run on combined
goal text + verification text and accept the noise. RC-22 is a known
contamination risk — do not try to solve it in Phase 1 or the scope will reopen.

---

## Canonical file: `terminalOutcomeAuthority.ts`

**Path:** `src/domain/goal/terminalOutcomeAuthority.ts`

**Ownership:** all authority classification logic lives here and only here.
No parallel computation in autoStrategy, autoDeliverables, GoalPolicy, or
GoalIntakeContract itself beyond the single call to `deriveTerminalOutcomeAuthority`.

**Exports:**

```typescript
export type TerminalOutcomeAuthority =
  | 'fully_controllable'
  | 'externally_mediated'
  | 'market_dependent'
  | 'mixed'
  | 'unknown';

export type TerminalOutcomeAuthorityReason =
  | 'EXTERNAL_ACTOR_NAMED'          // named human decision-maker in verification text
  | 'RECEIVED_LANGUAGE'             // "received", "accepted", "signed", "approved"
  | 'THRESHOLD_METRIC_DETECTED'     // quantity threshold in verification text
  | 'SELF_CERTIFYING_ENDPOINT'      // binary artifact the user creates/publishes
  | 'MULTIPLE_AUTHORITY_CLASSES'    // mixed: >1 authority class detected
  | 'INSUFFICIENT_SIGNAL';          // could not classify with confidence

export type TerminalOutcomeAuthorityResult = {
  authority: TerminalOutcomeAuthority;
  reasons: TerminalOutcomeAuthorityReason[];
  confidence: 'high' | 'medium' | 'low';
};

export function deriveTerminalOutcomeAuthority(
  goalText: string,
  verificationText: string
): TerminalOutcomeAuthorityResult;
```

---

## Detection heuristics

### `externally_mediated` signals

Check combined text (goalText + verificationText):

**Received/accepted/approved language** — strong signal:
```
/\b(received|accepted|signed|approved|offered|admitted|placed|selected|committed)\b/i
```

**Named external human actor** — strong signal:
```
/\b(employer|investor|publisher|editor|client|customer|committee|board|recruiter|
    hiring manager|venture capital|vc|angel)\b/i
```

**Offer/commitment terminal nouns** — strong signal:
```
/\b(offer letter|job offer|term sheet|investment agreement|signed agreement|
    letter of intent|acceptance letter|contract signed|purchase order)\b/i
```

**Goal-text framing patterns** — medium signal:
```
/\b(land a|get hired|raise from|close with|secure from|accepted by|
    placed with|funded by|signed by)\b/i
```

**Wire/transfer/payment confirmation** — strong signal (presence of verified
financial event):
```
/\b(wire transfer|payment received|funds received|wire confirmed)\b/i
```

`externally_mediated` fires if ≥ 1 strong signal OR ≥ 2 medium signals.

### `market_dependent` signals

**Quantity threshold in verification text** — strong signal:
```
/\b\d+[\s,]*(monthly\s+)?(listeners?|followers?|subscribers?|customers?|users?|
    leads?|sign.?ups?|downloads?|views?|visitors?)\b/i
```

**Revenue threshold** — strong signal:
```
/\$[\d,]+\s*(mrr|arr|\/month|monthly|annual|recurring)/i
```

**Growth framing in goal text** — medium signal:
```
/\b(grow to|reach \d|acquire \d|generate \d|get to \d)\b/i
```

`market_dependent` fires if ≥ 1 strong signal.

### `fully_controllable` signals

**Self-certifying completion language in verification text** — strong signal:
```
/\b(deployed|published|submitted|built|completed|launched|released|
    delivered|passed|finished|live|done)\b/i
```

**Absence of external actor and threshold signals** — residual classification.

`fully_controllable` fires if: self-certifying language present AND no
`externally_mediated` or `market_dependent` strong signals.

### `mixed` classification

`mixed` fires when both of the following are true:
1. `externally_mediated` signals are present
2. `market_dependent` OR `fully_controllable` signals are also present on
   distinct clauses

For Phase 1, "distinct clauses" is approximated by sentence boundary detection
(split on `.` and check each part independently). Full clause parsing is
deferred.

### `unknown`

`unknown` fires when no signals from any class are detected with sufficient
confidence. Should be rare for well-formed goal text.

### Priority order

When both `externally_mediated` and `market_dependent` signals fire:
result is `mixed`.

When `externally_mediated` fires with any `fully_controllable` signal:
result is `mixed` (the controllable part is preparation, not the terminal event).

When only `fully_controllable` fires: result is `fully_controllable`.

When only `market_dependent` fires: result is `market_dependent`.

When only `externally_mediated` fires: result is `externally_mediated`.

---

## Contract attachment

### `GoalIntakeContract` type extension

Add one field:

```typescript
terminalOutcomeAuthority: TerminalOutcomeAuthorityResult;
```

Type is the full `TerminalOutcomeAuthorityResult` (not just the authority
string) so that reasons and confidence are stored alongside the classification.
Downstream readers can check `.authority` for the class and `.reasons` for
inspectability.

### `buildGoalIntakeContract` call site

At the point where `combinedText` is available (after `rawGoalText` and
`verificationCriteria` are normalized), call:

```typescript
const terminalOutcomeAuthority = deriveTerminalOutcomeAuthority(
  rawGoalText || '',
  verificationCriteria || ''
);
```

Return it in the contract object alongside the existing fields. No other
logic in `buildGoalIntakeContract` should reference `terminalOutcomeAuthority`
in Phase 1 — no branching, no downstream effects.

---

## Selector / read path

All downstream reads of `terminalOutcomeAuthority` must go through the contract
field. No recomputation at the call site.

Pattern:
```typescript
// correct
const authority = intakeContract.terminalOutcomeAuthority.authority;

// forbidden
const authority = deriveTerminalOutcomeAuthority(goalText, verificationText).authority;
// (recomputation outside buildGoalIntakeContract)
```

In Phase 1, there are no downstream reads beyond the acceptance tests and the
contract field itself. This rule becomes binding in Phase 2 when gate logic
begins consuming the field.

---

## Acceptance tests

**File:** `src/domain/goal/terminalOutcomeAuthority.test.ts`

### Audit pack verification matrix

```
ST-01 (landing page):         fully_controllable   (deployed page, self-certifying)
ST-02 (fitness goal):         fully_controllable   (benchmark reached by user)
ST-03 (brand launch):         mixed                (page live = fc, 50 sign-ups = market)
LT-01 (podcast):              mixed                (publish = fc, 1K listeners = market)
LT-02 (fullstack + job):      mixed                (portfolio = fc, offer letter = externally_mediated)
LT-03 (job search):           externally_mediated  (offer letter from employer)
LT-04 (fundraising):          externally_mediated  (signed investment + wire from investor)
```

### Additional targeted tests

- Goal with only self-certifying language → `fully_controllable`
- Goal with only "offer letter received" → `externally_mediated`
- Goal with only "reach 1,000 followers" → `market_dependent`
- Goal with "build portfolio AND land job offer" → `mixed`
- Goal with empty text → `unknown` (confidence: low)
- Goal with ambiguous language, no strong signals → `unknown` (confidence: low)

### Confidence tests

- "Signed investment agreement received from investor" → `externally_mediated`,
  confidence: `high` (multiple strong signals)
- "Build a website" → `fully_controllable`, confidence: `medium` (self-certifying
  but weak)
- "Do something great" → `unknown`, confidence: `low`

---

## Freeze criteria

Phase 1 is complete when:

1. `terminalOutcomeAuthority.ts` exists with a single exported
   `deriveTerminalOutcomeAuthority` function
2. All 7 audit pack goals classify correctly per the verification matrix
3. All targeted unit tests pass
4. `GoalIntakeContract` type includes `terminalOutcomeAuthority: TerminalOutcomeAuthorityResult`
5. `buildGoalIntakeContract` returns `terminalOutcomeAuthority` on every call
6. Zero existing tests broken
7. Zero gate behavior changed
8. Zero trust state changed

**Explicit failure condition:** if any existing `audit_lt*.test.ts` or
`GoalPolicy.test.ts` test changes its assertion outcome as a result of Phase 1
work, Phase 1 has overstepped.

---

## Implementation order

1. Write `terminalOutcomeAuthority.ts` — types and detection function only
2. Write `terminalOutcomeAuthority.test.ts` — all acceptance tests, run against
   the function directly (not through the contract)
3. Attach to `GoalIntakeContract` type
4. Wire call in `buildGoalIntakeContract`
5. Run full test suite — confirm zero regressions
6. Update audit probe tests to assert `terminalOutcomeAuthority.authority` from
   intake contract where it adds signal (LT-03, LT-04 probes)

Step 6 is observational — it adds assertions to existing probe tests without
changing any existing assertion. The new assertions confirm the field is
populated correctly on the contract path that audit probes already exercise.
