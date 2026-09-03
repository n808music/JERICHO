# Constraint 1 Revert Confirmation — 2026-09-03

## What was reverted

Two commits were made attempting Constraint 1 (builder/loader ID-scheme
alignment across the six declaration classes):

1. `615fbee` — "fix: Align loader Deliverable ID scheme with intake builder
   (deliverable- prefix)" — Deliverable-only scope.
2. `6e57ad7` — "refactor: Align all six classes with type-prefix ID scheme
   (full scope implementation)" — all six classes, but landed with an
   unresolved entity-owner-resolution test failure.

`615fbee` was already cleanly reverted in-branch by `3b43801` before this
session began. Verified:

```
git diff e19e7a9 3b43801 --stat   →  (empty)
```

So `3b43801`'s tree was already byte-identical to `e19e7a9`. Only `6e57ad7`
(the newest, "unnamed" commit at session start) required a new revert.

## The revert

```
git revert --no-edit 6e57ad7   →   518f009
```

## Confirmation: tree identity, not just test-count parity

The strongest form of "symmetric difference" is not a test-name diff — it's
the source diff itself:

```
git diff e19e7a9 HEAD --stat   →  (empty)
```

**HEAD (`518f009`) is byte-identical to `e19e7a9`.** There is no residual
difference of any kind — nothing "came along for the ride." This is a
stronger confirmation than the boundaryType-revert precedent (77→46 with a
matching named list), because it rules out drift at the source level, not
just at the test-outcome level.

## e19e7a9's real number, finally named

Prior sessions recorded "46 failures baseline confirmed" as a **count**
only (`.remember` archive, 2026-09-02). Since HEAD is now proven
tree-identical to `e19e7a9`, this run's result *is* `e19e7a9`'s result —
and this is the first time it has been captured **by name**.

```
Test Files  26 failed | 629 passed (655)
Tests       46 failed | 4444 passed | 7 skipped (4497)
Duration    269.53s
```

### The 46 named failures

```
tests/state/autoAsanaPlan.distribution.spread.test.ts > autoAsanaPlan deterministic day distribution > uses concrete session titles from action sequences instead of repeated parent action shells
tests/state/autoAsanaPlan.distribution.spread.test.ts > autoAsanaPlan deterministic day distribution > rewrites commercial family-shell action titles into operational block titles
tests/state/autoAsanaPlan.distribution.spread.test.ts > autoAsanaPlan deterministic day distribution > rewrites explicit session-plan family shells before rendering blocks
tests/components/ZionDashboard.pos.afterAdmit.test.jsx > ZionDashboard POS after admit > starts the first execution cycle directly from Structure when no active cycle exists
src/state/__tests__/autoAsana.scheduler.v1_1.test.js > autoAsana scheduler v1.1 > prefers deliverable titles over generic session titles when placing explicit session plans
src/state/__tests__/autoAsana.scheduler.v1_1.test.js > autoAsana scheduler v1.1 > prefers deliverable titles over generic action labels when expanding action sequences
tests/state/schedule.generate.nonSilent.test.js > schedule generation non-silent deterministic behavior > emits NO_ADMISSIBLE_PROPOSED_BLOCKS when generated blocks exist but all fail admission
tests/state/jerichoLoop.creativeProduction.ep.e2e.test.ts > jericho creative production ep loop e2e regression > generalizes the first complete loop from planning through execution evidence for an EP release
tests/state/regulatedConsumable.energyGum.acceptance.test.ts > regulated consumable energy gum founder acceptance > generates the Illinois white-label founder plan instead of a generic regulated consumable plan
tests/domain/elicitation/elicitationEngine.acceptance.test.js > Elicitation Engine — Project slot (§9 worked trace, Law 2 proving ground) > runs the full §9 worked trace end-to-end and dispatches DECLARE_PROJECT
tests/state/masterPlanAtomicBlocks.test.js > atomic block decomposition — product gate app store split > app store screenshots appear as a standalone block
tests/state/masterPlanDepth.blockExpansion.test.js > master-plan cadence density — active lanes generate recurring work > each active primary lane generates at least 2 cadence blocks per month for the first 3 months
tests/components/BlockDetailsPanel.hierarchyDisplay.test.jsx > BlockDetailsPanel hierarchy display > resolves raw lane ids to canonical enterprise labels instead of showing Lane: Missing
tests/components/BlockDetailsPanel.hierarchyDisplay.test.jsx > BlockDetailsPanel hierarchy display > renders hard-anchor protection work with concrete explanation, validation work type, and completed artifact language
tests/components/BlockDetailsPanel.hierarchyDisplay.test.jsx > BlockDetailsPanel hierarchy display > shows explicit P1 justification for future-phase prerequisite governance work
tests/state/gumGoal.liveParity.test.ts > gum goal live/test parity > materializes a commercially continuous long-horizon schedule for the exact gum goal text
tests/state/dailyCheckIn.energyGum.acceptance.test.ts > daily check-in energy gum acceptance > surfaces week-6 on-track manufacturer outreach state honestly
src/state/__tests__/convergence_step3_forward_declaration.test.js > Convergence Step 3: Forward Declaration > Step 3.1: Name Requirement > should accept convergence edge with name
src/state/__tests__/convergence_step3_forward_declaration.test.js > Convergence Step 3: Forward Declaration > Step 3.2: Dependency-Chain Exclusion (Hard Block) > should reject if two sources are sequentially dependent
src/state/__tests__/convergence_step3_forward_declaration.test.js > Convergence Step 3: Forward Declaration > Step 3.2: Dependency-Chain Exclusion (Hard Block) > should accept if sources are truly parallel (no sequential dependency)
src/state/__tests__/convergence_step3_forward_declaration.test.js > Convergence Step 3: Forward Declaration > Step 3.3: Deliverable Walkdown > should discover and store owned deliverables from sources
src/state/__tests__/convergence_step3_forward_declaration.test.js > Convergence Step 3: Forward Declaration > Step 3.4: TargetDate Assignment > should assign targetDate to discovered deliverables
tests/state/jerichoLoop.gum.e2e.test.ts > jericho gum loop e2e regression > freezes the first complete loop from initial feasibility through first execution evidence
tests/components/MasterPlanTimeline.render.test.jsx > MasterPlanTimeline rendering > renders lanes, anchors, milestones, and first-cycle preview from canonical master-plan state
src/state/__tests__/convergence_step3_comprehensive.test.js > Convergence Step 3: Comprehensive Multi-Part Test > walkdown discovers deliverables, name is editable, destination validation works
src/state/__tests__/convergence_step3_e2e_walkdown.test.js > Convergence Step 3: Real End-to-End Declaration > declares convergence edge with name and targetDate, validates sources correctly
src/state/__tests__/convergence_step3_e2e_walkdown.test.js > Convergence Step 3: Real End-to-End Declaration > hard-blocks convergence with sequential dependencies
tests/state/podcast.fullPlan.apply.test.js > podcast full-plan apply > commits the full generated proposal set across the horizon
tests/state/masterPlanBlockDisplayProjection.test.js > master-plan block display projection > attaches display titles to generated full-horizon blocks without changing canonical titles
tests/state/masterPlanBlockDisplayProjection.test.js > master-plan block display projection > calendar month projection retains display and detail fields for drill-down inspection
tests/state/masterPlanBlockDisplayProjection.test.js > master-plan block display projection > quality evaluation continues to trust canonical titles even if display titles are compressed further
tests/state/masterGrid.acceptance.test.jsx > Master Grid acceptance > AC7: seed fidelity — every non-Initiative reference node phase is carried verbatim
tests/domain/elicitation/elicitationEngine.projectPhaseFlow.test.js > Elicitation Engine — §5 phase probe fires in the real flow and lands in the store > emits PROJECT_PHASE_UNATTESTED after the verification source, before dispatch
tests/domain/elicitation/elicitationEngine.projectPhaseFlow.test.js > Elicitation Engine — §5 phase probe fires in the real flow and lands in the store > shows the Disclosure-compliant, referent-bound phase copy at the probe
tests/domain/elicitation/elicitationEngine.projectPhaseFlow.test.js > Elicitation Engine — §5 phase probe fires in the real flow and lands in the store > writes the attested phase onto the node (read back from the store)
tests/domain/elicitation/elicitationEngine.projectPhase.test.js > project slot — phase attestation (the gap, before the fix) > elicits phase: phase is a captured field of the project slot
tests/domain/elicitation/elicitationEngine.projectPhase.test.js > project slot — phase attestation (the gap, before the fix) > has a phase-unattested gate that fires when phase is absent
tests/domain/elicitation/elicitationEngine.projectPhase.test.js > project slot — phase attestation (the gap, before the fix) > has a non-canonical phase gate (validated through the single classifyPhase, not a second validator)
tests/domain/elicitation/elicitationEngine.projectPhase.test.js > project slot — phase attestation (the gap, before the fix) > carries phase through to the DECLARE_PROJECT payload (canonical number)
tests/domain/elicitation/elicitationEngine.projectPhase.test.js > project slot — phase attestation (the gap, before the fix) > ships a Disclosure-compliant phase probe (beginning/middle/end spine)
tests/domain/elicitation/elicitationEngine.projectPhase.test.js > project slot — phase lands on the node end-to-end (real declare path) > an attested phase reaches node.phase via DECLARE_PROJECT (verified in the store)
tests/domain/elicitation/elicitationEngine.projectPhase.test.js > project slot — phase lands on the node end-to-end (real declare path) > an absent phase still stores null (residual bucket) — not fabricated
src/state/__tests__/suggestion.accept.idempotence.test.js > suggestion accept idempotence > accepting the same suggestion twice creates one committed block
tests/state/masterPlanFullHorizon.coverage.test.js > master-plan full-horizon coverage audit > passes fullHorizonCovered when meaningful work reaches through May 2031
tests/components/AppShell.onboardingToGoalAdmission.flow.test.jsx > AppShell structure entry without an active cycle > lands in the review-mode Structure shell and offers starting a new cycle
tests/components/AppShell.onboardingToGoalAdmission.flow.test.jsx > AppShell structure entry without an active cycle > starts a new coherent profile in the true blank lifecycle state
```

**None of these 46 failures mention ID/prefix/entity-resolution defects.**
They are pre-existing, unrelated failures (phase attestation gap work,
convergence step-3 fixture wiring, autoAsana title distribution, etc.) —
none of which Constraint 1 work touches. This is the clean, honest floor
Constraint 1 implementation starts from.

## Conclusion

- Revert confirmed at the strongest possible level: zero source diff from
  `e19e7a9`.
- `e19e7a9`'s failing-test baseline is now named for the first time: 46
  failures, listed above, none Constraint-1-related.
- Full six-class Constraint 1 implementation may now proceed from a
  verified, named floor. Any new failure introduced by that work will be
  visible against this exact list — and any test in this list whose name
  or assertion must change to reflect a corrected ID scheme is expected
  movement, not regression.
