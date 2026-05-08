# TARGET_UNIT_TAXONOMY_ALIGNMENT_FREEZE_PACKAGE.md

## Status

Closed.

Canonical verification is clean on the current tree.

### Final verification

- `npm run check-all`
- Result: pass
- `331` test files passed
- `1353` tests passed
- Duration: `233.94s`

---

## Scope of this slice

This slice implemented bounded intake measurement alignment so Jericho can
represent the user’s stated success metric before planning begins.

This slice fixed:

- target-unit taxonomy gaps for the first anchor lanes
- deterministic goal-native unit preselection for strong cases
- canonical persistence of the count/unit pair through intake state
- manual fallback when taxonomy is insufficient

This slice did **not**:

- reopen builder doctrine
- modify evaluator logic
- change UI truth-surface doctrine
- broaden into cross-lane planning refactors

---

## Source-of-truth path audited

The audited intake path was:

### Lane-specific unit options

- [OnboardingScreen.jsx](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/components/OnboardingScreen.jsx)

### Canonical intake contract build / persistence

- [GoalIntakeContract.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/goal/GoalIntakeContract.ts)

### Downstream display of admitted target pair

- [StructurePageConsolidated.jsx](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/components/zion/StructurePageConsolidated.jsx)

Key finding:

- onboarding already stored `goalContract.target.unit`
- but canonical intake contract logic did not preserve target unit as
  first-class contract data
- unit taxonomy and intent inference were also local to the onboarding form

---

## Root implementation change

This slice moved target-unit taxonomy and inference into a shared deterministic
source:

- [targetUnitTaxonomy.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/goal/targetUnitTaxonomy.ts)

Then it wired onboarding and canonical intake persistence to use that shared
source.

That means target-unit handling is now:

- lane-aware
- goal-aware
- deterministic
- canonically preserved

---

## Exact files changed

- [targetUnitTaxonomy.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/goal/targetUnitTaxonomy.ts)
- [OnboardingScreen.jsx](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/components/OnboardingScreen.jsx)
- [GoalIntakeContract.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/goal/GoalIntakeContract.ts)
- [OnboardingScreen.test.jsx](/Users/jamesdotson/vscode/JERICHO/JERICHO/tests/components/OnboardingScreen.test.jsx)
- [GoalIntakeContract.test.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/goal/GoalIntakeContract.test.ts)

---

## Taxonomy additions

### PhysicalTraining

Added outcome-aware units:

- `pounds lost`
- `pounds gained`

Preserved process units:

- training sessions completed
- workout blocks completed
- benchmark checks completed
- conditioning blocks completed

### Fundraising

Added package-prep units:

- `fundraising packages prepared`
- `investor-ready packages completed`
- `investor materials packages completed`

Preserved execution-stage units where appropriate:

- fundraising dollars committed
- commitments secured
- qualified meetings completed
- outreach messages sent

---

## Deterministic inference rules

### PhysicalTraining

Strong rules:

- `lose|drop|cut <n> pounds` -> target count `<n>`, target unit `pounds lost`
- `gain|add|put on <n> pounds` -> target count `<n>`, target unit
  `pounds gained`

### Fundraising

Strong rules:

- explicit package-prep phrasing such as:
  - fundraising package
  - investor-ready package
  - investor-ready materials
  - friends-and-family package
- `prepare|build|create ... package/materials` -> target unit
  `fundraising packages prepared`
- singular package-prep phrasing infers target count `1`

### Rule posture

Inference is:

- deterministic
- conservative
- only applied when the target fields are still blank

No freeform semantic guessing was added.

---

## Manual fallback behavior

This slice added a bounded `Other / custom unit` path in onboarding.

### Behavior

- user can select `Other / custom unit`
- user enters the exact unit string
- that custom unit is stored canonically in the goal contract
- it is preserved through intake rather than treated as display-only text

This prevents the system from forcing a bad proxy when taxonomy is incomplete.

---

## Canonical persistence through GoalIntakeContract

[GoalIntakeContract.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/goal/GoalIntakeContract.ts)
now preserves:

- `targetCount`
- `targetUnit`

The selected, inferred, or custom unit now survives into canonical intake state
instead of remaining only a UI-form value.

This is the key contract repair in the slice.

---

## Before / after examples

### PhysicalTraining

#### Before

Goal:

- `Lose 10 pounds`

Available units:

- training sessions completed
- workout blocks completed
- benchmark checks completed
- conditioning blocks completed

Problem:

- user was forced into a process proxy

#### After

Goal:

- `Lose 10 pounds`

Intake result:

- target count `10`
- target unit `pounds lost`

### Fundraising

#### Before

Goal:

- `Prepare a friends-and-family fundraising package for Jericho`

Available units skewed toward:

- dollars committed
- meetings completed
- commitments secured

Problem:

- user was forced into live-raise execution grammar

#### After

Goal:

- `Prepare a friends-and-family fundraising package for Jericho`

Intake result:

- target count `1`
- target unit `fundraising packages prepared`

---

## Focused tests

### Updated files

- [OnboardingScreen.test.jsx](/Users/jamesdotson/vscode/JERICHO/JERICHO/tests/components/OnboardingScreen.test.jsx)
- [GoalIntakeContract.test.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/goal/GoalIntakeContract.test.ts)

### Focused verification

- `npm run test -- tests/components/OnboardingScreen.test.jsx src/domain/goal/GoalIntakeContract.test.ts --reporter=verbose`
- Result: pass
- `16` tests passed

### What these tests prove

- PhysicalTraining exposes `pounds lost`
- Fundraising exposes package-prep units
- deterministic preselection works for strong cases
- custom fallback units are preserved canonically
- target count stays paired with the correct unit

---

## Deferred scope

This slice intentionally deferred:

- broader cross-lane unit expansion beyond the two anchor lanes
- richer freeform parsing beyond the bounded deterministic rules
- builder/evaluator changes beyond consuming the corrected count/unit already
  preserved at intake
- larger intake UI redesign

---

## Milestone conclusion

The target-unit taxonomy alignment slice is closed.

Intake can now represent goal-native outcome units for the first anchor lanes,
with deterministic preselection for strong cases and a canonical manual fallback
when taxonomy is insufficient. The corrected count/unit pair is preserved
through the intake contract, and canonical verification is clean.
