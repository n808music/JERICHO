# Test Baseline: f62a88f (142 failures) — SUPERSEDED, DO NOT USE

> **SUPERSEDED 2026-09-05 by [`baseline-72c717a-REFERENCE.md`](baseline-72c717a-REFERENCE.md).**
>
> This baseline is not valid. It was measured on a tree that could not fully
> collect. `f62a88f` itself introduced 19 duplicated commas (`,,`) into fixture
> object literals across 9 test files, which are parse errors. Those 9 files
> failed to collect, so their tests were absent from the run rather than counted.
>
> The `4460 total` recorded below is the tell: the true total at the immediately
> preceding commit `72c717a` is **4509**. The missing 49 tests are the contents of
> the 9 files `f62a88f` broke. Every failure count in this document was taken
> against a suite that was 49 tests short, so it cannot be compared against any
> run that collects cleanly.
>
> Retained for history only. Use `72c717a` (4509 total, 185 failing) as the
> reference for all diffs.

**Commit**: f62a88f6f8b712f4ffeef883545ca913eca490d0
**Date**: 2026-09-05 06:21 UTC
**Command**: `npx vitest run --reporter=json`
**Result**: 142 failed | 4318 passed | 7 skipped (4460 total) — measured on a tree with 9 files failing collection

## Failing Tests by File (142 total, 43 files)

### AppShell.onboardingToGoalAdmission.flow.test.jsx (2)
- AppShell structure entry without an active cycle > lands in the review-mode Structure shell and offers starting a new cycle
- AppShell structure entry without an active cycle > starts a new coherent profile in the true blank lifecycle state

### autoAsana.scheduler.v1_1.test.js (2)
- autoAsana scheduler v1.1 > prefers deliverable titles over generic action labels when expanding action sequences
- autoAsana scheduler v1.1 > prefers deliverable titles over generic session titles when placing explicit session plans

### autoAsanaPlan.distribution.spread.test.ts (3)
- autoAsanaPlan deterministic day distribution > rewrites commercial family-shell action titles into operational block titles
- autoAsanaPlan deterministic day distribution > rewrites explicit session-plan family shells before rendering blocks
- autoAsanaPlan deterministic day distribution > uses concrete session titles from action sequences instead of repeated parent action shells

### BlockDetailsPanel.hierarchyDisplay.test.jsx (3)
- BlockDetailsPanel hierarchy display > renders hard-anchor protection work with concrete explanation, validation work type, and completed artifact language
- BlockDetailsPanel hierarchy display > resolves raw lane ids to canonical enterprise labels instead of showing Lane: Missing
- BlockDetailsPanel hierarchy display > shows explicit P1 justification for future-phase prerequisite governance work

### convergence_detection_pass.test.js (9)
- Convergence Detection Pass > should delete questions when source is removed
- Convergence Detection Pass > should delete questions when targetDate changes on a source
- Convergence Detection Pass > should generate same questionId for same cluster across runs
- Convergence Detection Pass > should not create duplicate questions if same cluster detected again
- Convergence Detection Pass > should prune pending questions that are subsets of other pending questions
- Convergence Detection Pass > should prune smaller clusters when larger clusters with same members are detected
- Convergence Detection Pass > should record DeadlineAlignment disposition and never re-ask
- Convergence Detection Pass > should set navigation intent on Declared without creating edge
- Convergence Detection Pass > should surface each shared-deadline cluster exactly once

### convergence_step3_e2e_walkdown.test.js (2)
- Convergence Step 3: Real End-to-End Declaration > declares convergence edge with name and targetDate, validates sources correctly
- Convergence Step 3: Real End-to-End Declaration > hard-blocks convergence with sequential dependencies

### convergence_step3_forward_declaration.test.js (5)
- Convergence Step 3: Forward Declaration > Step 3.1: Name Requirement > should accept convergence edge with name
- Convergence Step 3: Forward Declaration > Step 3.2: Dependency-Chain Exclusion (Hard Block) > should accept if sources are truly parallel (no sequential dependency)
- Convergence Step 3: Forward Declaration > Step 3.2: Dependency-Chain Exclusion (Hard Block) > should reject if two sources are sequentially dependent
- Convergence Step 3: Forward Declaration > Step 3.3: Deliverable Walkdown > should discover and store owned deliverables from sources
- Convergence Step 3: Forward Declaration > Step 3.4: TargetDate Assignment > should assign targetDate to discovered deliverables

### dailyCheckIn.energyGum.acceptance.test.ts (1)
- daily check-in energy gum acceptance > surfaces week-6 on-track manufacturer outreach state honestly

### elicitationEngine.acceptance.test.js (3)
- Elicitation Engine — acceptance criterion #1: deterministic replay > emits a byte-identical probe sequence and identical DECLARE_* payloads across two runs of the same script
- Elicitation Engine — acceptance criterion #4: extract-not-recall > after the engine completes a project, every populated field traces to a captured answer (none from seed)
- Elicitation Engine — Project slot (§9 worked trace, Law 2 proving ground) > runs the full §9 worked trace end-to-end and dispatches DECLARE_PROJECT

### elicitationEngine.artifactSlot.test.js (8)
- Elicitation Engine — Artifact slot: DECLARE_ARTIFACT dispatch > auto-generates an id from the name as a slug
- Elicitation Engine — Artifact slot: DECLARE_ARTIFACT dispatch > dispatches with type DECLARE_ARTIFACT and all 6 required payload fields
- Elicitation Engine — Artifact slot: gate sequence > drives the full gate sequence: name → producingProjectId → completionEvidence → verificationSourceId → operatorAttestationMethod
- Elicitation Engine — Artifact slot: matrix landing > artifact lands in matrix.artifactsById with all required fields
- Elicitation Engine — Artifact slot: optional fields > dispatches without consumingProjectIds or notes (reducer defaults apply)
- Elicitation Engine — Artifact slot: producingProjectOptions pickSet > contains only declared projects and no VS records
- Elicitation Engine — Artifact slot: structural > gate fieldNames follow reducer-derived order
- Elicitation Engine — Artifact slot: structural > gate ladder has exactly 9 gates

### elicitationEngine.bootstrapSlot.test.js (1)
- bootstrap — DECLARE_BOOTSTRAP reducer > stores selectedNodeId and candidates in matrix.bootstrap

### elicitationEngine.compoundReadback.test.js (3)
- project readback — compound-attestation advisory > does NOT flag a single-check record (coordinator on one side only)
- project readback — compound-attestation advisory > flags when BOTH metric and source join two things with a coordinator
- project readback — reopening verificationSource re-asks it > reopen cascades to the resolved id, so the source question actually returns

### elicitationEngine.convergenceSlot.test.js (18)
- Convergence slot: allDeclaredNodeOptions cross-registry > items carry nodeType labels per registry
- Convergence slot: allDeclaredNodeOptions cross-registry > pickSet includes nodes from entity, system, and artifact registries
- Convergence slot: broken edge is first-class > broken defaults to false when not specified
- Convergence slot: broken edge is first-class > broken: true with substantive gives succeeds and stores broken: true
- Convergence slot: gate sequence > binds later questions to the destination name (subject binding)
- Convergence slot: gate sequence > drives the full gate sequence: toNodeId → fromNodeId → gives
- Convergence slot: gate sequence > emits CONVERGENCE_FROM_UNRESOLVED for unknown fromNodeId
- Convergence slot: gate sequence > emits CONVERGENCE_GIVES_MISSING when gives absent
- Convergence slot: loops are legal (inverse of dependency cycle guard) > 2-cycle (A→B and B→A) both succeed via reducer — no cycle guard
- Convergence slot: loops are legal (inverse of dependency cycle guard) > 3-cycle (A→B→C→A) all succeed — the master flywheel is valid
- Convergence slot: loops are legal (inverse of dependency cycle guard) > engine does not emit a cycle gate code for B→A after A→B is declared
- Convergence slot: loops are legal (inverse of dependency cycle guard) > mutual (A⇄B) succeeds — bidirectional is valid
- Convergence slot: self-edge rejection > CONVERGENCE_SELF_EDGE fires when a source equals the destination (via engine)
- DECLARE_CONVERGENCE reducer > accepts endpoint from entity registry (cross-registry)
- DECLARE_CONVERGENCE reducer > accepts endpoint from system registry (cross-registry)
- DECLARE_CONVERGENCE reducer > rejects self-edge
- DECLARE_CONVERGENCE reducer > rejects unknown toNodeId
- DECLARE_CONVERGENCE reducer > stores edge in convergenceEdgesById with all fields

### elicitationEngine.dependencySlot.test.js (10)
- Dependency slot: DECLARE_DEPENDENCY dispatch > auto-generates id as dep-{upstream}-to-{downstream}
- Dependency slot: DECLARE_DEPENDENCY dispatch > dispatches DECLARE_DEPENDENCY with correct payload fields
- Dependency slot: DECLARE_DEPENDENCY dispatch > label defaults to null when not provided
- Dependency slot: declaredNodeOptions pickSet > contains declared artifacts with nodeType: artifact
- Dependency slot: gate sequence > drives the full gate sequence: downstreamId → upstreamId → type
- Dependency slot: matrix landing > edge lands in matrix.dependenciesById with all required fields
- Dependency slot: reducer cycle guard (last-line-of-defense) > reducer accepts a valid legal edge
- Dependency slot: reducer cycle guard (last-line-of-defense) > reducer rejects a direct cycle via DEPENDENCY_CYCLE in lastPlanError
- Dependency slot: reducer cycle guard (last-line-of-defense) > reducer rejects a transitive cycle (A→B→C, attempt C→A)
- Dependency slot: reducer cycle guard (last-line-of-defense) > reducer rejects self-edge

### elicitationEngine.legalFormationLabels.test.js (1)
- Legal Formation Gate vs Status Label Separation > PROJECT_LEGAL_FORMATION_MISSING gate uses legalFormationPrerequisiteOptions pickSet

### elicitationEngine.projectPhase.test.js (7)
- project slot — phase attestation (the gap, before the fix) > carries phase through to the DECLARE_PROJECT payload (canonical number)
- project slot — phase attestation (the gap, before the fix) > elicits phase: phase is a captured field of the project slot
- project slot — phase attestation (the gap, before the fix) > has a non-canonical phase gate (validated through the single classifyPhase, not a second validator)
- project slot — phase attestation (the gap, before the fix) > has a phase-unattested gate that fires when phase is absent
- project slot — phase attestation (the gap, before the fix) > ships a Disclosure-compliant phase probe (beginning/middle/end spine)
- project slot — phase lands on the node end-to-end (real declare path) > an absent phase still stores null (residual bucket) — not fabricated
- project slot — phase lands on the node end-to-end (real declare path) > an attested phase reaches node.phase via DECLARE_PROJECT (verified in the store)

### elicitationEngine.projectPhaseFlow.test.js (3)
- Elicitation Engine — §5 phase probe fires in the real flow and lands in the store > emits PROJECT_PHASE_UNATTESTED after the verification source, before dispatch
- Elicitation Engine — §5 phase probe fires in the real flow and lands in the store > shows the Disclosure-compliant, referent-bound phase copy at the probe
- Elicitation Engine — §5 phase probe fires in the real flow and lands in the store > writes the attested phase onto the node (read back from the store)

### elicitationEngine.projectSlot.requiresLegal.test.js (2)
- Project slot — requiresLegalFormation field capture > captures requiresLegalFormation=false when declared
- Project slot — requiresLegalFormation field capture > captures requiresLegalFormation=true when declared

### elicitationEngine.resourceSlot.test.js (13)
- Binding constraint slot: dispatch and matrix landing > binding constraint lands in matrix.bindingConstraint
- Binding constraint slot: dispatch and matrix landing > dispatches DECLARE_BINDING_CONSTRAINT with valid dimension and substantive rationale
- Binding constraint slot: gate behavior > BINDING_COVERAGE_INCOMPLETE does not fire when all initiatives profiled
- isSection9Complete: coverage invariant > returns true when all 3 initiatives are profiled
- isSection9Complete: coverage invariant > transitions from false to true upon profiling the last initiative
- Resource profile slot: dispatch and matrix landing > dispatches DECLARE_RESOURCE_PROFILE after all nine fields captured
- Resource profile slot: dispatch and matrix landing > profile lands in matrix.resourceProfilesById keyed by initiativeId
- Resource profile slot: NO_GAP_SENTINEL handling > jargon gap (not sentinel) fails substance gate
- Resource profile slot: NO_GAP_SENTINEL handling > sentinel "none" passes the gap substance gate and stores as null
- Resource profile slot: per-dimension gate sequencing > asks initiative first, then money need, gap, then time need, gap, then skills, tech
- Resource profile slot: per-dimension gate sequencing > re-asks money need when jargon-shell answer given
- Resource profile slot: unprofiledInitiativeOptions > returns all initiative ids when none profiled
- Resource profile slot: unprofiledInitiativeOptions > shrinks after one profile: 3 initiatives → 2 remaining after first profile

### elicitationReadback.test.js (5)
- Elicitation Engine — read-back step > confirmed:false+reopen clears only the named field and re-probes it, preserving siblings
- Elicitation Engine — read-back step > confirmed:true dispatches DECLARE_PROJECT and the engine is done
- Elicitation Engine — read-back step > halts at readback when all project slot gates pass (does not dispatch or finish)
- Elicitation Engine — read-back step > re-answering after reject re-emits readback with updated sentence, then confirms cleanly
- Elicitation Engine — read-back step > readback sentence is byte-identical across two runs with the same inputs

### gumGoal.liveParity.test.ts (1)
- gum goal live/test parity > materializes a commercially continuous long-horizon schedule for the exact gum goal text

### jerichoLoop.creativeProduction.ep.e2e.test.ts (1)
- jericho creative production ep loop e2e regression > generalizes the first complete loop from planning through execution evidence for an EP release

### jerichoLoop.gum.e2e.test.ts (1)
- jericho gum loop e2e regression > freezes the first complete loop from initial feasibility through first execution evidence

### legalFormation.detection.test.js (2)
- Barrier detection — legal formation prerequisites > clears the barrier when entity becomes legally formed
- Barrier detection — legal formation prerequisites > emits a CONSTRAINT barrier when unformed entity owns a legal-formation-required project

### masterGrid.acceptance.test.jsx (3)
- Master Grid acceptance > AC1: seed renders exactly 53 rows with 7/11/17/12/6
- Master Grid acceptance > AC2: names byte-identical to the seed file
- Master Grid acceptance > AC6: kill/relaunch — 53 survive a localStorage round-trip

### masterPlanAtomicBlocks.test.js (1)
- atomic block decomposition — product gate app store split > app store screenshots appear as a standalone block

### masterPlanBlockDisplayProjection.test.js (3)
- master-plan block display projection > attaches display titles to generated full-horizon blocks without changing canonical titles
- master-plan block display projection > calendar month projection retains display and detail fields for drill-down inspection
- master-plan block display projection > quality evaluation continues to trust canonical titles even if display titles are compressed further

### masterPlanDepth.blockExpansion.test.js (1)
- master-plan cadence density — active lanes generate recurring work > each active primary lane generates at least 2 cadence blocks per month for the first 3 months

### masterPlanFullHorizon.coverage.test.js (1)
- master-plan full-horizon coverage audit > passes fullHorizonCovered when meaningful work reaches through May 2031

### MasterPlanTimeline.render.test.jsx (1)
- MasterPlanTimeline rendering > renders lanes, anchors, milestones, and first-cycle preview from canonical master-plan state

### matrix.gridFields.test.js (1)
- matrix grid fields > artifact carries producedByEntityId resolved to a declared entity

### matrix.projects.test.js (2)
- MATRIX SECTION 5 — DECLARE / UPDATE / REMOVE PROJECT > DECLARE_PROJECT adds a project when all required fields are present and cross-references resolve
- MATRIX SECTION 5 — DECLARE / UPDATE / REMOVE PROJECT > UPDATE_PROJECT patches an existing project but cannot dangle owningEntityId

### matrix.referenceEdges.test.js (1)
- loadReferenceMatrix edges + milestone (Gate 5 data layer) > declares typed relational links (ships_with / soundtrack_of) referencing declared nodes

### matrix.referenceSeed.test.js (3)
- loadReferenceMatrix > declares all nodes from the corrected matrix v3.0 with proper breakdown
- loadReferenceMatrix > preserves node names byte-identical to the fixture, for every node it declares
- loadReferenceMatrix > resolves entity owners correctly to declared entities

### MatrixIntake.resumeAfterRulesChange.test.jsx (2)
- MatrixIntake — resume when restored slot now passes all gates > Back steps into the previous answered field; Next confirms and declares, then advances to Mission B
- MatrixIntake — resume when restored slot now passes all gates > lands ON the in-flight question, answer prefilled, nothing auto-declared

### MatrixIntake.resumeIntoReadback.test.jsx (2)
- MatrixIntake — resume into a readback keeps its buttons alive > confirm responds: the project is declared and fan-out advances
- MatrixIntake — resume into a readback keeps its buttons alive > reopen chip responds: clicking description re-asks the deliverable question

### message-format.proof.test.js (1)
- Barrier message format — PROOF > produces exact locked message format: "BARRIER — {Entity}: not legally formed. {Project} requires legal formation to proceed. This step cannot proceed until resolved."

### phaseGridFromStore.test.js (9)
- phaseGridFromStore — phase classification at ingest > absent raw phase with NO derivation → residual sentinel (E16: Initiative.phase removed)
- phaseGridFromStore — phase classification at ingest > present-but-invalid phase ("7") → treated as absent (null), grid renders without throwing
- phaseGridFromStore — phase classification at ingest > present-but-invalid phase ("banana") → treated as absent, grid renders without throwing
- phaseGridFromStore → sortByPhase (③④⑤ from canonical store) > ③ phase 1 — demoV2 order, canonical titles
- phaseGridFromStore → sortByPhase (③④⑤ from canonical store) > ③ phase 2 + phase 3 — demoV2 order, canonical titles
- phaseGridFromStore → sortByPhase (③④⑤ from canonical store) > ④ residual = exactly 3 phase-null questions (Energy Gum, Smoke Pens, Academy #1)
- phaseGridFromStore → sortByPhase (③④⑤ from canonical store) > ⑤ the Oct-17 milestone stars exactly its four lanes
- selectGridNodes — grid default-tier rule (allProjects ∪ promoted lane deliverables) > CAUSALITY: Patent is in the grid BECAUSE it is a lane whose parent is already claimed
- selectGridNodes — grid default-tier rule (allProjects ∪ promoted lane deliverables) > derives exactly 18 from the reference store: 17 projects + the Patent deliverable

### podcast.fullPlan.apply.test.js (1)
- podcast full-plan apply > commits the full generated proposal set across the horizon

### regulatedConsumable.energyGum.acceptance.test.ts (1)
- regulated consumable energy gum founder acceptance > generates the Illinois white-label founder plan instead of a generic regulated consumable plan

### schedule.generate.nonSilent.test.js (1)
- schedule generation non-silent deterministic behavior > emits NO_ADMISSIBLE_PROPOSED_BLOCKS when generated blocks exist but all fail admission

### suggestion.accept.idempotence.test.js (1)
- suggestion accept idempotence > accepting the same suggestion twice creates one committed block

### ZionDashboard.pos.afterAdmit.test.jsx (1)
- ZionDashboard POS after admit > starts the first execution cycle directly from Structure when no active cycle exists
