# FLAG 1: AUTHORITATIVE BASELINE DIFF

## Summary

| Metric | Pre-Baseline (8fc4607) | Current (f62a88f) | Delta |
|--------|-----------|---------|-------|
| **Failing Tests** | **46** | **142** | **+96** |
| Passed Tests | 4,463 | 4,318 | -145 |
| Total Tests | 4,509 | 4,460 | -49 |

## Categorization

- **Carried Over:** 45 tests (pre-existing failures, not from items 1–3)
- **Newly Failing:** 97 tests (real regressions introduced by items 1–3)
- **Fixed:** 1 test (by fixture updates: convergence_step3_comprehensive.test.js)

**Math:** 46 + 97 - 1 = 142 ✓

## The 97 Newly Failing Tests (Items 1–3 Regressions)

These tests were passing at 8fc4607 but are now failing at f62a88f (after items 1–3 intake implementations).

### Phase Grid Failures (9)
- phaseGridFromStore.test.js >> phaseGridFromStore — phase classification at ingest > absent raw phase with NO derivation → residual sentinel (E16: Initiative.phase removed)
- phaseGridFromStore.test.js >> phaseGridFromStore — phase classification at ingest > present-but-invalid phase ("7") → treated as absent (null), grid renders without throwing
- phaseGridFromStore.test.js >> phaseGridFromStore — phase classification at ingest > present-but-invalid phase ("banana") → treated as absent, grid renders without throwing
- phaseGridFromStore.test.js >> phaseGridFromStore → sortByPhase (③④⑤ from canonical store) > ③ phase 1 — demoV2 order, canonical titles
- phaseGridFromStore.test.js >> phaseGridFromStore → sortByPhase (③④⑤ from canonical store) > ③ phase 2 + phase 3 — demoV2 order, canonical titles
- phaseGridFromStore.test.js >> phaseGridFromStore → sortByPhase (③④⑤ from canonical store) > ④ residual = exactly 3 phase-null questions (Energy Gum, Smoke Pens, Academy #1)
- phaseGridFromStore.test.js >> phaseGridFromStore → sortByPhase (③④⑤ from canonical store) > ⑤ the Oct-17 milestone stars exactly its four lanes
- phaseGridFromStore.test.js >> selectGridNodes — grid default-tier rule (allProjects ∪ promoted lane deliverables) > CAUSALITY: Patent is in the grid BECAUSE it is a lane whose parent is already claimed
- phaseGridFromStore.test.js >> selectGridNodes — grid default-tier rule (allProjects ∪ promoted lane deliverables) > derives exactly 18 from the reference store: 17 projects + the Patent deliverable

### Convergence Detection Failures (9)
- convergence_detection_pass.test.js >> Convergence Detection Pass > should delete questions when source is removed
- convergence_detection_pass.test.js >> Convergence Detection Pass > should delete questions when targetDate changes on a source
- convergence_detection_pass.test.js >> Convergence Detection Pass > should generate same questionId for same cluster across runs
- convergence_detection_pass.test.js >> Convergence Detection Pass > should not create duplicate questions if same cluster detected again
- convergence_detection_pass.test.js >> Convergence Detection Pass > should prune pending questions that are subsets of other pending questions
- convergence_detection_pass.test.js >> Convergence Detection Pass > should prune smaller clusters when larger clusters with same members are detected
- convergence_detection_pass.test.js >> Convergence Detection Pass > should record DeadlineAlignment disposition and never re-ask
- convergence_detection_pass.test.js >> Convergence Detection Pass > should set navigation intent on Declared without creating edge
- convergence_detection_pass.test.js >> Convergence Detection Pass > should surface each shared-deadline cluster exactly once

### Elicitation Engine Slot Failures (53)

#### Artifact Slot (8)
- elicitationEngine.artifactSlot.test.js >> Elicitation Engine — Artifact slot: DECLARE_ARTIFACT dispatch > auto-generates an id from the name as a slug
- elicitationEngine.artifactSlot.test.js >> Elicitation Engine — Artifact slot: DECLARE_ARTIFACT dispatch > dispatches with type DECLARE_ARTIFACT and all 6 required payload fields
- elicitationEngine.artifactSlot.test.js >> Elicitation Engine — Artifact slot: gate sequence > drives the full gate sequence: name → producingProjectId → completionEvidence → verificationSourceId → operatorAttestationMethod
- elicitationEngine.artifactSlot.test.js >> Elicitation Engine — Artifact slot: matrix landing > artifact lands in matrix.artifactsById with all required fields
- elicitationEngine.artifactSlot.test.js >> Elicitation Engine — Artifact slot: optional fields > dispatches without consumingProjectIds or notes (reducer defaults apply)
- elicitationEngine.artifactSlot.test.js >> Elicitation Engine — Artifact slot: producingProjectOptions pickSet > contains only declared projects and no VS records
- elicitationEngine.artifactSlot.test.js >> Elicitation Engine — Artifact slot: structural > gate fieldNames follow reducer-derived order
- elicitationEngine.artifactSlot.test.js >> Elicitation Engine — Artifact slot: structural > gate ladder has exactly 9 gates

#### Bootstrap Slot (1)
- elicitationEngine.bootstrapSlot.test.js >> bootstrap — DECLARE_BOOTSTRAP reducer > stores selectedNodeId and candidates in matrix.bootstrap

#### Convergence Slot (18)
- elicitationEngine.convergenceSlot.test.js >> Convergence slot: allDeclaredNodeOptions cross-registry > items carry nodeType labels per registry
- elicitationEngine.convergenceSlot.test.js >> Convergence slot: allDeclaredNodeOptions cross-registry > pickSet includes nodes from entity, system, and artifact registries
- elicitationEngine.convergenceSlot.test.js >> Convergence slot: broken edge is first-class > broken defaults to false when not specified
- elicitationEngine.convergenceSlot.test.js >> Convergence slot: broken edge is first-class > broken: true with substantive gives succeeds and stores broken: true
- elicitationEngine.convergenceSlot.test.js >> Convergence slot: gate sequence > binds later questions to the destination name (subject binding)
- elicitationEngine.convergenceSlot.test.js >> Convergence slot: gate sequence > drives the full gate sequence: toNodeId → fromNodeId → gives
- elicitationEngine.convergenceSlot.test.js >> Convergence slot: gate sequence > emits CONVERGENCE_FROM_UNRESOLVED for unknown fromNodeId
- elicitationEngine.convergenceSlot.test.js >> Convergence slot: gate sequence > emits CONVERGENCE_GIVES_MISSING when gives absent
- elicitationEngine.convergenceSlot.test.js >> Convergence slot: loops are legal (inverse of dependency cycle guard) > 2-cycle (A→B and B→A) both succeed via reducer — no cycle guard
- elicitationEngine.convergenceSlot.test.js >> Convergence slot: loops are legal (inverse of dependency cycle guard) > 3-cycle (A→B→C→A) all succeed — the master flywheel is valid
- elicitationEngine.convergenceSlot.test.js >> Convergence slot: loops are legal (inverse of dependency cycle guard) > engine does not emit a cycle gate code for B→A after A→B is declared
- elicitationEngine.convergenceSlot.test.js >> Convergence slot: loops are legal (inverse of dependency cycle guard) > mutual (A⇄B) succeeds — bidirectional is valid
- elicitationEngine.convergenceSlot.test.js >> Convergence slot: self-edge rejection > CONVERGENCE_SELF_EDGE fires when a source equals the destination (via engine)
- elicitationEngine.convergenceSlot.test.js >> DECLARE_CONVERGENCE reducer > accepts endpoint from entity registry (cross-registry)
- elicitationEngine.convergenceSlot.test.js >> DECLARE_CONVERGENCE reducer > accepts endpoint from system registry (cross-registry)
- elicitationEngine.convergenceSlot.test.js >> DECLARE_CONVERGENCE reducer > rejects self-edge
- elicitationEngine.convergenceSlot.test.js >> DECLARE_CONVERGENCE reducer > rejects unknown toNodeId
- elicitationEngine.convergenceSlot.test.js >> DECLARE_CONVERGENCE reducer > stores edge in convergenceEdgesById with all fields

#### Dependency Slot (10)
- elicitationEngine.dependencySlot.test.js >> Dependency slot: DECLARE_DEPENDENCY dispatch > auto-generates id as dep-{upstream}-to-{downstream}
- elicitationEngine.dependencySlot.test.js >> Dependency slot: DECLARE_DEPENDENCY dispatch > dispatches DECLARE_DEPENDENCY with correct payload fields
- elicitationEngine.dependencySlot.test.js >> Dependency slot: DECLARE_DEPENDENCY dispatch > label defaults to null when not provided
- elicitationEngine.dependencySlot.test.js >> Dependency slot: declaredNodeOptions pickSet > contains declared artifacts with nodeType: artifact
- elicitationEngine.dependencySlot.test.js >> Dependency slot: gate sequence > drives the full gate sequence: downstreamId → upstreamId → type
- elicitationEngine.dependencySlot.test.js >> Dependency slot: matrix landing > edge lands in matrix.dependenciesById with all required fields
- elicitationEngine.dependencySlot.test.js >> Dependency slot: reducer cycle guard (last-line-of-defense) > reducer accepts a valid legal edge
- elicitationEngine.dependencySlot.test.js >> Dependency slot: reducer cycle guard (last-line-of-defense) > reducer rejects a direct cycle via DEPENDENCY_CYCLE in lastPlanError
- elicitationEngine.dependencySlot.test.js >> Dependency slot: reducer cycle guard (last-line-of-defense) > reducer rejects a transitive cycle (A→B→C, attempt C→A)
- elicitationEngine.dependencySlot.test.js >> Dependency slot: reducer cycle guard (last-line-of-defense) > reducer rejects self-edge

#### Resource Slot (13)
- elicitationEngine.resourceSlot.test.js >> Binding constraint slot: dispatch and matrix landing > binding constraint lands in matrix.bindingConstraint
- elicitationEngine.resourceSlot.test.js >> Binding constraint slot: dispatch and matrix landing > dispatches DECLARE_BINDING_CONSTRAINT with valid dimension and substantive rationale
- elicitationEngine.resourceSlot.test.js >> Binding constraint slot: gate behavior > BINDING_COVERAGE_INCOMPLETE does not fire when all initiatives profiled
- elicitationEngine.resourceSlot.test.js >> Resource profile slot: NO_GAP_SENTINEL handling > jargon gap (not sentinel) fails substance gate
- elicitationEngine.resourceSlot.test.js >> Resource profile slot: NO_GAP_SENTINEL handling > sentinel "none" passes the gap substance gate and stores as null
- elicitationEngine.resourceSlot.test.js >> Resource profile slot: dispatch and matrix landing > dispatches DECLARE_RESOURCE_PROFILE after all nine fields captured
- elicitationEngine.resourceSlot.test.js >> Resource profile slot: dispatch and matrix landing > profile lands in matrix.resourceProfilesById keyed by initiativeId
- elicitationEngine.resourceSlot.test.js >> Resource profile slot: per-dimension gate sequencing > asks initiative first, then money need, gap, then time need, gap, then skills, tech
- elicitationEngine.resourceSlot.test.js >> Resource profile slot: per-dimension gate sequencing > re-asks money need when jargon-shell answer given
- elicitationEngine.resourceSlot.test.js >> Resource profile slot: unprofiledInitiativeOptions > returns all initiative ids when none profiled
- elicitationEngine.resourceSlot.test.js >> Resource profile slot: unprofiledInitiativeOptions > shrinks after one profile: 3 initiatives → 2 remaining after first profile
- elicitationEngine.resourceSlot.test.js >> isSection9Complete: coverage invariant > returns true when all 3 initiatives are profiled
- elicitationEngine.resourceSlot.test.js >> isSection9Complete: coverage invariant > transitions from false to true upon profiling the last initiative

#### Legal Formation & Project Slot (3)
- elicitationEngine.legalFormationLabels.test.js >> Legal Formation Gate vs Status Label Separation > PROJECT_LEGAL_FORMATION_MISSING gate uses legalFormationPrerequisiteOptions pickSet
- elicitationEngine.projectSlot.requiresLegal.test.js >> Project slot — requiresLegalFormation field capture > captures requiresLegalFormation=false when declared
- elicitationEngine.projectSlot.requiresLegal.test.js >> Project slot — requiresLegalFormation field capture > captures requiresLegalFormation=true when declared

#### Readback (5)
- elicitationReadback.test.js >> Elicitation Engine — read-back step > confirmed:false+reopen clears only the named field and re-probes it, preserving siblings
- elicitationReadback.test.js >> Elicitation Engine — read-back step > confirmed:true dispatches DECLARE_PROJECT and the engine is done
- elicitationReadback.test.js >> Elicitation Engine — read-back step > halts at readback when all project slot gates pass (does not dispatch or finish)
- elicitationReadback.test.js >> Elicitation Engine — read-back step > re-answering after reject re-emits readback with updated sentence, then confirms cleanly
- elicitationReadback.test.js >> Elicitation Engine — read-back step > readback sentence is byte-identical across two runs with the same inputs

#### Acceptance & Compound Tests (3)
- elicitationEngine.acceptance.test.js >> Elicitation Engine — acceptance criterion #1: deterministic replay > emits a byte-identical probe sequence and identical DECLARE_* payloads across two runs of the same script
- elicitationEngine.acceptance.test.js >> Elicitation Engine — acceptance criterion #4: extract-not-recall > after the engine completes a project, every populated field traces to a captured answer (none from seed)
- elicitationEngine.compoundReadback.test.js >> project readback — compound-attestation advisory > does NOT flag a single-check record (coordinator on one side only)
- elicitationEngine.compoundReadback.test.js >> project readback — compound-attestation advisory > flags when BOTH metric and source join two things with a coordinator
- elicitationEngine.compoundReadback.test.js >> project readback — reopening verificationSource re-asks it > reopen cascades to the resolved id, so the source question actually returns

### Matrix & Reference Failures (8)
- matrix.gridFields.test.js >> matrix grid fields > artifact carries producedByEntityId resolved to a declared entity
- matrix.projects.test.js >> MATRIX SECTION 5 — DECLARE / UPDATE / REMOVE PROJECT > DECLARE_PROJECT adds a project when all required fields are present and cross-references resolve
- matrix.projects.test.js >> MATRIX SECTION 5 — DECLARE / UPDATE / REMOVE PROJECT > UPDATE_PROJECT patches an existing project but cannot dangle owningEntityId
- matrix.referenceEdges.test.js >> loadReferenceMatrix edges + milestone (Gate 5 data layer) > declares typed relational links (ships_with / soundtrack_of) referencing declared nodes
- matrix.referenceSeed.test.js >> loadReferenceMatrix > declares all nodes from the corrected matrix v3.0 with proper breakdown
- matrix.referenceSeed.test.js >> loadReferenceMatrix > preserves node names byte-identical to the fixture, for every node it declares
- matrix.referenceSeed.test.js >> loadReferenceMatrix > resolves entity owners correctly to declared entities

### UI & Integration Failures (9)
- MatrixIntake.resumeAfterRulesChange.test.jsx >> MatrixIntake — resume when restored slot now passes all gates > Back steps into the previous answered field; Next confirms and declares, then advances to Mission B
- MatrixIntake.resumeAfterRulesChange.test.jsx >> MatrixIntake — resume when restored slot now passes all gates > lands ON the in-flight question, answer prefilled, nothing auto-declared
- MatrixIntake.resumeIntoReadback.test.jsx >> MatrixIntake — resume into a readback keeps its buttons alive > confirm responds: the project is declared and fan-out advances
- MatrixIntake.resumeIntoReadback.test.jsx >> MatrixIntake — resume into a readback keeps its buttons alive > reopen chip responds: clicking description re-asks the deliverable question
- masterGrid.acceptance.test.jsx >> Master Grid acceptance > AC1: seed renders exactly 53 rows with 7/11/17/12/6
- masterGrid.acceptance.test.jsx >> Master Grid acceptance > AC2: names byte-identical to the seed file
- masterGrid.acceptance.test.jsx >> Master Grid acceptance > AC6: kill/relaunch — 53 survive a localStorage round-trip
- message-format.proof.test.js >> Barrier message format — PROOF > produces exact locked message format: "BARRIER — {Entity}: not legally formed. {Project} requires legal formation to proceed. This step cannot proceed until resolved."

### Barrier & Legal Failures (2)
- legalFormation.detection.test.js >> Barrier detection — legal formation prerequisites > emits a CONSTRAINT barrier when unformed entity owns a legal-formation-required project

---

## Implications

The 97 newly failing tests reveal systematic issues in how items 1–3 (Project/Initiative/Artifact intake fields) integrate with:
1. **Phase grid derivation** (9 failures) — phase computation from new fields broken
2. **Convergence detection** (9 failures) — deadline/source tracking broken
3. **Elicitation slots** (53 failures) — slot gate logic, dispatch payload, matrix binding broken
4. **Matrix & references** (8 failures) — cross-reference resolution broken
5. **UI integration** (9 failures) — MatrixIntake, grid, barrier logic broken

**Next steps**:
- Fix the 97 regressions (grouped above)
- Verify the fixture edits (commit f62a88f) didn't hide other real defects
- Re-baseline at completion

## Related Files

- [Baseline: 142 failures at f62a88f](baseline-f62a88f-142-failures.md) — current state
- [Pre-baseline: 46 failures at 8fc4607](baseline-8fc4607-46-failures.md) — comparison (not stored yet, available on branch)
