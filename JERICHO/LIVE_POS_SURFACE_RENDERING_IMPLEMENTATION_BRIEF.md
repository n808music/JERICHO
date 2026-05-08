# LIVE_POS_SURFACE_RENDERING_IMPLEMENTATION_BRIEF

## 1. Purpose and Boundary

This stage is the final Live P.O.S. presentation layer only.

Its purpose is to render the frozen canonical Live P.O.S. outputs so they are visible, legible, and non-misleading to the user.

This stage does not change:
- policy computation
- canonical inputs
- eligibility / withholding
- live-state semantics
- score math

The governing rule for this stage is:

**The surface reads canonical outputs and translates them for readability, but does not generate new semantics.**

---

## 2. Canonical Inputs

The surface may render only canonical Live P.O.S. outputs already computed in the policy layer.

Required canonical fields:
- `livePos.state`
- `livePos.reasonCodes`
- `livePos.liveState`
- `livePos.liveStateReasonCodes`
- `livePos.score.state`
- `livePos.score.value`
- `livePos.score.reasonCodes`
- `livePos.score.capped`
- `livePos.score.evidenceDensity`
- `livePos.score.lowerBound`
- `livePos.score.upperBound`

The surface may also render frozen adjacent context for separation only:
- feasibility state
- trust state

But those are not inputs to Live P.O.S. semantics. They are neighboring outputs only.

---

## 3. Ownership

Live P.O.S. surface ownership must be explicit.

This brief requires:
- one dedicated Live P.O.S. surface or panel
- one canonical selector/path for reading Live P.O.S. output
- explicit placement relative to feasibility and trust

The surface must read from the canonical goal policy path, not from alternate score stores or UI-local reconstructions.

Canonical source of truth:
- [GoalPolicy.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/goal/GoalPolicy.ts)
- surfaced through policy state in the existing canonical data path

No component may compute its own Live P.O.S. meaning.

---

## 4. Withheld-State Presentation

When `livePos.state = withheld`, the UI must render that intentionally.

Rules:
- do not leave the score area blank in a way that looks broken
- do not imply a missing fetch or failed render
- explicitly indicate that Live P.O.S. is withheld
- surface withholding reasons in readable mapped form

The surface should answer:
- why Live P.O.S. is not available yet
- whether the cause is no evidence, no live schedule, unlinked evidence, or thin canonical truth

Withheld presentation must feel deliberate, not absent.

---

## 5. Available-State Presentation

When `livePos.state = eligible`, the surface must present the canonical available outputs clearly.

Required visible elements:
- a first-class live-state label for:
  - `activating`
  - `stable`
  - `at_risk`
  - `recovering`
- the bounded numeric score
- cap indication when `capped = true`
- evidence-density indication
- score range visibility from `lowerBound` / `upperBound`
- mapped canonical reason support

The state label must not be hidden behind the number.

The score is downstream of the state and must be shown that way.

---

## 6. Score / Range / Cap Display Rules

The UI must preserve the bounded nature of the canonical score.

Rules:
- do not display the score as unconstrained certainty
- show that the score lives within a bounded range when bounds are available
- visibly indicate when the score is capped
- do not present the score with fake precision
- do not imply that the score is directly comparable to feasibility

Acceptable forms may include:
- score plus bounded range
- score plus cap marker
- score plus evidence-strength context

The display must make clear that this is a live bounded score from evidence.

---

## 7. Reason-Code Mapping Rules

Reason-code ownership remains canonical.

The UI may map canonical reason codes into readable text, but it may not reinterpret them.

Rules:
- explanation text must be driven from canonical reason codes
- the UI may provide a short primary explanation and expandable detail
- the UI must not invent new diagnostic meaning not present in the canonical codes
- raw codes may remain inspectable if useful, but they should not be the primary user-facing surface

State reasons and score reasons must remain distinguishable where useful.

---

## 8. Separation From Feasibility and Trust

Live P.O.S. must remain visibly and semantically distinct from feasibility and trust.

Rules:
- do not present feasibility and Live P.O.S. as two versions of the same metric
- do not reuse trust styling or labels as the Live P.O.S. surface
- do not let feasibility explanation bleed into live evidence explanation

The surface should communicate the distinction clearly:
- feasibility = pre-execution support truth
- Live P.O.S. = post-execution evidence truth

Separation may require:
- distinct card or section boundaries
- distinct labels
- distinct explanation language

---

## 9. Explicit UI Non-Goals

The Live P.O.S. surface must not:
- recompute state
- recompute score
- use alternate scoring paths
- blend feasibility into live score semantics
- generate UI-side state transitions
- infer optimism or pessimism beyond canonical outputs
- collapse withheld, state, and score into one generic status label

This stage is translation only, not interpretation.

---

## 10. Acceptance Criteria

The brief is complete when:
- component ownership is explicit
- canonical fields to render are explicit
- withheld-state presentation rules are explicit
- available-state presentation rules are explicit
- score/range/cap display rules are explicit
- reason-code mapping rules are explicit
- separation from feasibility and trust is explicit
- UI non-goals are explicit
- the brief can drive the rendering pass without inviting semantic drift

---

## 11. Freeze and Reopening Criteria

This presentation layer must be reopened if a future change:
- reinterprets canonical Live P.O.S. semantics in the UI
- adds new required semantic fields not present in the frozen canonical stack
- changes score display rules in a way that alters semantic meaning
- blends feasibility or trust into Live P.O.S. meaning
- introduces UI-authored explanations that contradict canonical reason-code ownership
- starts computing Live P.O.S. state or score outside the canonical policy path

If any of these occur, the surface layer is no longer a pure rendering layer and must be re-evaluated.

---

## 12. Minimal Implementation Order

The rollout order for this stage should be:

1. define the owning component and canonical selector/path
2. render the withheld state intentionally
3. render the available state with first-class live-state label
4. render bounded score, range, cap, and evidence density
5. map canonical reason codes into readable explanation
6. verify visible separation from feasibility and trust
7. freeze the presentation layer once canonical fidelity is confirmed
