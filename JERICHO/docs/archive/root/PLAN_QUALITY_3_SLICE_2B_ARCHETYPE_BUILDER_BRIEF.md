# PLAN_QUALITY_3_SLICE_2B_ARCHETYPE_BUILDER_BRIEF.md

## Status

Ready to implement.

This brief defines the next bounded Plan Quality 3 slice after:

- PQ1 doctrine freeze
- PQ2 object-chain freeze
- PQ2 coverage freeze
- PQ3 slice 1 freeze
- PQ3 slice 2A freeze

The admission doctrine is unchanged.

---

## Purpose

Improve plan substance upstream by strengthening archetype-local deliverable
builders in selected high-value lanes.

The goal of this slice is to reduce plan-quality gate failures by producing
better lane-native deliverable titles and branch structure before the evaluator
runs.

This is a generation-quality improvement pass, not a gate rewrite.

---

## Core Rule

Replace weak archetype-local fallback titles with bounded object-aware builder
outputs in selected high-value lanes, without adding evaluator logic or widening
the seam.

---

## Doctrine

Unchanged:

- generation quality upstream
- coverage and meaning evaluation at the gate
- feasibility/P.O.S. only after admissibility

This slice must make more plans pass because generation is better, not because
evaluation becomes softer.

---

## Scope

This slice is limited to archetype-local builder quality in selected lanes that
still rely on generic staged/padding behavior.

Target outcome:

- stronger archetype-native deliverable titles
- stronger preservation of branch identity
- stronger preservation of the goal object in lane-specific outputs
- fewer avoidable gate failures caused by thin fallback substance

---

## Non-Goals

Do not:

- relax the evaluator
- add new evaluator codes
- refactor the whole planner
- broaden into cross-cutting scoring work
- redesign the admission seam
- introduce freeform semantic/NLP adjudication

---

## Candidate Lanes

Priority should go to lanes that are:

- high-value in real use
- still likely to emit generic fallback deliverables
- structurally easy to improve with bounded builder rules

Recommended first-pass selection:

- episodic production fallback paths
- business/service launch fallback paths
- skill acquisition fallback paths
- any lane still depending on stage labels more than object-aware titles

Lane selection should remain bounded for this slice. Do not attempt all
archetypes at once.

---

## Implementation Focus

### 1. Archetype-local builder quality

Improve builder outputs where lane-specific deliverables still compress into
weak titles such as:

- generic process shells
- branch labels that lose the underlying object
- staged placeholders that could belong to many unrelated goals

### 2. Goal-object preservation

Ensure titles keep the concrete object of work visible in the archetype builder
output itself.

Examples of the intended direction:

- not just `Finalize workflow`
- but `Finalize podcast recording workflow`

- not just `Prepare release package`
- but `Prepare podcast release package`

- not just `Practice plan`
- but `Build React practice plan for portfolio projects`

### 3. Branch identity preservation

Ensure major branch identity survives in builder outputs:

- episode branch stays episode-specific
- client/offer branch stays client/offer-specific
- proof/review branch stays tied to the correct artifact or goal object

---

## Minimal Blast Radius

Preferred implementation shape:

- improve selected archetype builder functions only
- keep store shape unchanged unless a builder-local extension is necessary
- do not spread logic into unrelated reducers/selectors
- let the existing evaluator decide whether the improved outputs now pass

The builder is the primary seam for this slice.

---

## Acceptance Standard

Plans should pass because builder outputs are more complete and specific, not
because the gate became permissive.

The slice succeeds only if:

- selected lanes emit stronger object-aware deliverables
- surfaced downstream labels preserve that stronger substance
- existing withholding behavior still holds for genuinely weak plans

---

## Verification

Use a small targeted matrix centered on builder output quality.

### Required checks

1. selected lane emits object-aware deliverable titles
2. selected lane preserves branch identity across deliverables
3. downstream scheduled block titles remain aligned with improved builder
   outputs
4. unchanged weak lanes or intentionally weak fixtures still withhold under the
   current evaluator

### Verification mode

- targeted tests first
- full repo verification after implementation
- freeze only after clean verification

---

## Expected Artifact Behavior

After this slice:

- more archetype-native plans should pass the existing gate honestly
- fewer plans should fail for avoidable fallback-title weakness
- evaluator doctrine should remain exactly as frozen

---

## Deferred Scope

Still out of scope for this slice:

- evaluator expansion
- new plan-quality codes
- broad planner rewrites
- scoring/P.O.S. changes
- UI-specific gate surfacing changes
- cross-lane normalization work beyond selected builders

---

## Milestone Conclusion

Plan Quality 3 slice 2B is the next bounded generation-quality pass.

Its purpose is to improve archetype-native builder outputs in selected
high-value lanes so that:

- the goal object survives more naturally
- branch identity survives more naturally
- plans pass the existing gate for the right reason

The admission seam remains unchanged.
