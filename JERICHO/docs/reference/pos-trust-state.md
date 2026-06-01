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
