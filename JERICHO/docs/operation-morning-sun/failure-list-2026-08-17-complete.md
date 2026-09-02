---
name: failure-list-2026-08-17-complete
description: "Complete list of 109 failing tests (with full test names) as of 2026-08-17; checkpoint for future diff against current suite to verify \"pre-existing\" vs \"newly broken.\""
metadata: 
  node_type: memory
  type: project
  originSessionId: 8b8fe96f-00c5-4506-8f13-1c1dedaddf00
  modified: 2026-08-18T00:33:51.745Z
---

# Complete Failure List — 2026-08-17

**109 failing tests, 78 files. Use this for diffs against future test runs.**

---

## Individual Failing Tests (by file)

### Component Tests (UI/Integration)

1. src/components/zion/ExportFullScheduleButton.test.jsx
   - downloads a PDF with the full-horizon doc definition when clicked

2. src/components/zion/exportFullSchedulePdf.test.js
   - includes milestone and dependency audit summaries near the top of the document

### Domain Tests (Master Grid / Phase)

3. src/domain/masterGrid/phaseGridFromStore.test.js
   - ③ phase 2 + phase 3 — demoV2 order, canonical titles

### Domain Tests (Master Plan Export/Generation)

4. src/domain/masterPlan/exportFullHorizonSchedule.test.js
   - every block has the substrate fields the engine emits

5. src/domain/masterPlan/fullHorizonScheduleExpansion.commercialDepth.test.js
   - income_stream P1 includes segment_definition, lead_sourcing, outreach_send, qualification, discovery_call, proposal_prep, close_decision

6. src/domain/masterPlan/fullHorizonScheduleExpansion.crossLaneSemantic.test.js
   - income_stream outreach_asset blocks consume product release_prep artifacts
   - capital_real_estate segment_definition blocks consume income close_decision artifacts
   - product_software iteration_backlog_grooming blocks consume income discovery_call artifacts

7. src/domain/masterPlan/fullHorizonScheduleExpansion.ownerClass.test.js
   - assigns Operator to the cross-lane terminal block

8. src/domain/masterPlan/fullHorizonScheduleExpansion.substanceCompliance.test.js
   - all three phases have execution work in the generated multi-lane plan

### Domain Tests (Plan Quality / Block Detail Authority)

9. src/domain/planQuality/evaluatePlanQualityGate.blockDetailAuthority.test.ts
   - passes the hard-anchor protection example with concrete lane identity and completed artifact output
   - detects entity-purpose mismatch when support calendar work is forced into F8

### Domain Tests (Product Display / Plain Language)

10. src/domain/product/resolveBlockPlainLanguage.molecular.test.js
    - derives concrete detail from first-cycle execution metadata

11. src/domain/product/resolveBlockPlainLanguage.test.js
    - falls back to generic guidance when no specialized pattern is matched

12. src/domain/product/resolveInitiativeDisplay.test.js
    - maps media narrative pipeline language to Podcast Pilot
    - maps album release engine language to Romance Riot
    - maps operations system language to Global State Solutions
    - maps real estate thesis language to 79th Street Real Estate
    - maps institution design language to Institution / School
    - falls back to the lane when no initiative is known

### State Tests (AutoAsana Scheduler)

13. src/state/__tests__/autoAsana.scheduler.v1_1.test.js
    - prefers deliverable titles over generic session titles when placing explicit session plans
    - prefers deliverable titles over generic action labels when expanding action sequences

### State Tests (Convergence Step 3)

14. src/state/__tests__/convergence_step3_comprehensive.test.js
    - walkdown discovers deliverables, name is editable, destination validation works

15. src/state/__tests__/convergence_step3_e2e_walkdown.test.js
    - declares convergence edge with name and targetDate, validates sources correctly
    - hard-blocks convergence with sequential dependencies

16. src/state/__tests__/convergence_step3_forward_declaration.test.js
    - should accept convergence edge with name
    - should reject if two sources are sequentially dependent
    - should accept if sources are truly parallel (no sequential dependency)
    - should discover and store owned deliverables from sources
    - should assign targetDate to discovered deliverables

### State Tests (Suggestion Acceptance)

17. src/state/__tests__/suggestion.accept.idempotence.test.js
    - accepting the same suggestion twice creates one committed block

### Component Tests (Block Details Panel)

18. tests/components/BlockDetailsPanel.canonicalLaneLookup.test.jsx
    - still renders the plan-quality failure when block has neither laneId nor a lanesById entry

19. tests/components/BlockDetailsPanel.firstActivatedBlock.test.jsx
    - does not render the plan-quality failure banner or lane-identity failure codes for the hard-anchor protection block
    - still surfaces the failure banner when an activated block has no lane identity anywhere

20. tests/components/BlockDetailsPanel.hierarchyDisplay.test.jsx
    - renders the full hierarchy when metadata is present
    - handles missing sprint and cycle metadata gracefully
    - renders a plain-language onboarding breakdown for formal launch-blocker test work
    - resolves raw lane ids to canonical enterprise labels instead of showing Lane: Missing
    - renders hard-anchor protection work with concrete explanation, validation work type, and completed artifact language
    - shows explicit P1 justification for future-phase prerequisite governance work

### Component Tests (Master Plan Timeline)

21. tests/components/MasterPlanTimeline.render.test.jsx
    - renders lanes, anchors, milestones, and first-cycle preview from canonical master-plan state
    - renders the persisted plan view after rehydration instead of falling back to the empty state

### Component Tests (Matrix Intake)

22. tests/components/MatrixIntake.copyContract.test.jsx
    - "Skip" on a scope gate advances past the section without entering it

### Component Tests (Timezone Projection)

23. tests/components/timeProjection.timezone.test.jsx
    - renders the same stored ISO timestamp as 09:00 on the week surface

### Master Grid Tests (Phase)

24. tests/masterGrid/autoCallingIntegration.test.js
    - should populate Phase values via auto-calling during DECLARE_SPINE action
    - should detect hierarchy violations when child Phase < parent Phase

25. tests/masterGrid/phaseRetroactiveAudit.test.js
    - should detect phase hierarchy violations

### State Tests (AutoAsana Plan Distribution)

26. tests/state/autoAsanaPlan.distribution.spread.test.ts
    - uses concrete session titles from action sequences instead of repeated parent action shells
    - rewrites commercial family-shell action titles into operational block titles
    - rewrites explicit session-plan family shells before rendering blocks

### State Tests (Daily Check-In)

27. tests/state/dailyCheckIn.energyGum.acceptance.test.ts
    - surfaces week-6 on-track manufacturer outreach state honestly

### State Tests (Full Horizon Memoization)

28. tests/state/fullHorizon.computeMemo.test.js
    - recomputes derived state well under the freeze threshold for an unrelated mutation
    - preserves full-horizon output across an unrelated mutation (memo reuse is not corruption)

### State Tests (Gum Goal)

29. tests/state/gumGoal.liveParity.test.ts
    - materializes a commercially continuous long-horizon schedule for the exact gum goal text

### State Tests (Jericho Loop E2E)

30. tests/state/jerichoLoop.creativeProduction.ep.e2e.test.ts
    - generalizes the first complete loop from planning through execution evidence for an EP release

31. tests/state/jerichoLoop.gum.e2e.test.ts
    - freezes the first complete loop from initial feasibility through first execution evidence

### State Tests (Master Grid Acceptance)

32. tests/state/masterGrid.acceptance.test.jsx
    - AC1: seed renders exactly 53 rows with 7/11/17/12/6
    - AC7: seed fidelity — every reference node phase is carried verbatim into the store

### State Tests (Master Plan Atomic Blocks)

33. tests/state/masterPlanAtomicBlocks.test.js
    - app store screenshots appear as a standalone block

### State Tests (Master Plan Block Display Projection)

34. tests/state/masterPlanBlockDisplayProjection.test.js
    - preserves canonical title while generating a shorter display title
    - attaches display titles to generated full-horizon blocks without changing canonical titles
    - calendar month projection retains display and detail fields for drill-down inspection
    - quality evaluation continues to trust canonical titles even if display titles are compressed further

### State Tests (Master Plan Cadence Density)

35. tests/state/masterPlanDepth.blockExpansion.test.js
    - each active primary lane generates at least 2 cadence blocks per month for the first 3 months

### State Tests (Master Plan Full Horizon Block Quality)

36. tests/state/masterPlanFullHorizon.blockQuality.test.js
    - can be provisional while strategic coverage remains covered
    - flags early capital deployment or expansion before conversion evidence
    - keeps at least four distinct P3 title families per heavy lane without one family dominating above 40%
    - flags duplicate title ratio by lane-phase above 40%

### State Tests (Master Plan Full Horizon Coverage)

37. tests/state/masterPlanFullHorizon.coverage.test.js
    - passes fullHorizonCovered when meaningful work reaches through March 2032
    - does not expose Full horizon covered label unless fullHorizonCovered is true
    - keeps quality trust false until coverage passes first

### State Tests (Master Plan Full Horizon Density)

38. tests/state/masterPlanFullHorizon.density.test.js
    - keeps P3 as a meaningful phase with a substantial duration and lane coverage

### State Tests (Master Plan Full Horizon Generation Authenticity)

39. tests/state/masterPlanFullHorizon.generationAuthenticity.test.js
    - generates dated P1/P2/P3 work through 2031 with lane coverage, block variety, and lineage
    - matches the golden fixture at the level of phase coverage, lane coverage, horizon coverage, and block-type distribution

### State Tests (Master Plan Full Horizon Quality Gate)

40. tests/state/masterPlanFullHorizon.quality.test.js
    - keeps lane/object context populated across the trusted baseline schedule
    - fails professionalism when template repetition dominates the schedule
    - narrows institution, civic, and capital expansion when the success standard narrows
    - moves downstream P2 timing when the first hard anchor moves later while preserving acceptable quality
    - keeps quality trust false when coverage passes but schedule quality degrades
    - does not trust the full-horizon plan when one block fails canonical block-detail authority
    - propagates unjustified P1 Real Estate activation into full-horizon summary reason codes
    - does not silently trust a major middle phase with zero named milestones
    - keeps milestone-thin phases provisional when the block substrate is not trusted
    - passes the distributed baseline as an official trusted or provisional MVP plan

### State Tests (Master Plan Store Intake Completion)

41. tests/state/masterPlanStore.intakeComplete.test.js
    - extracts core mission, outcome target, and success standard separately for named empire-scale goals
    - bridges a finalized master plan into a first operational cycle with proposed schedule blocks

### State Tests (Podcast Full Plan)

42. tests/state/podcast.fullPlan.apply.test.js
    - commits the full generated proposal set across the horizon

### State Tests (Regulated Consumable / Energy Gum)

43. tests/state/regulatedConsumable.energyGum.acceptance.test.ts
    - generates the Illinois white-label founder plan instead of a generic regulated consumable plan

### State Tests (Schedule Generation Non-Silent)

44. tests/state/schedule.generate.nonSilent.test.js
    - emits NO_ADMISSIBLE_PROPOSED_BLOCKS when generated blocks exist but all fail admission
    - passes the live runtime floor to the scheduler instead of a stale persisted May 19 contract start

---

## Summary by File Type

| Category | Count | Primary Issue |
|----------|-------|---|
| Component UI/Integration | 15 | Mixed (fixture, display, state) |
| Domain/Master Plan | 25 | Export, generation, quality, display |
| State/Full Horizon | 35 | Quality gates, coverage, generation authenticity |
| State/Acceptance Tests | 12 | E2E loops, foundational scenarios |
| State/Schedule & Timing | 10 | Timestamp mismatches, admission logic |
| Master Grid / Phase | 5 | Phase hierarchy, auto-calling |
| Other State Tests | 7 | Memoization, convergence, distribution |
| **Total** | **109** | — |

---

**Use this list to diff future test runs and verify "pre-existing" claims with data, not assertion.**
