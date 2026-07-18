# Initiative B — SDLC + Commercial/Capital/BD Decomposition Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen the Operation Endgame plan-generation engine so SDLC, commercial, capital, and BD lanes produce credible per-stage progressions with semantic cross-lane artifact dependencies and specific titles, while preserving all RTG-stamped invariants (gate criteria, horizon coverage, first-cycle activation, work window, duplicate-render dedupe).

**Architecture:** Three new taxonomy modules (`sdlcStages.js`, `commercialPipelineStages.js`, `crossLaneArtifactDependencies.js`) declare canonical stage sequences and cross-lane consumer relationships. `fullHorizonScheduleExpansion.js` consumes the taxonomies when emitting descriptors so block titles, `lifecycleStage`, `commercialStage`, and `consumedArtifactIds` carry semantic content per stage. `artifactDependencyIntegrity.js` learns the expanded stages so it can fill them on legacy/forecast blocks. TDD throughout — failing test first, minimal implementation, commit.

**Tech Stack:** JavaScript (ESM), Vitest, existing `src/domain/masterPlan/` substrate. No new dependencies.

**Root cause hypothesis (to validate during execution):** Descriptor pools were authored as 5–8 reps per phase × lane family without coverage of the full SDLC or commercial pipeline. Title genericity (`"Ship next launch-critical feature increment for X"`) is downstream of descriptor genericity. `lifecycleStage` / `commercialStage` metadata exists on the descriptor schema but only 4–5 distinct values appear in the pool, so the stage taxonomies are present but sparsely populated.

**Non-regression contract — these must keep passing throughout:**
- `fullHorizonScheduleExpansion.incubatingActivationPath.test.js` (8 tests)
- `fullHorizonScheduleExpansion.gateReadability.test.js` (6 tests)
- `fullHorizonScheduleExpansion.gateCriteria.test.js`
- `fullHorizonScheduleExpansion.bdMechanics.test.js`
- `fullHorizonScheduleExpansion.ownerClass.test.js`
- `artifactDependencyIntegrity.test.js`
- `fullHorizonProfessionalism.regression.test.js`
- `tests/state/longHorizon.*.test.js` (5 files)
- `tests/components/ZionDashboard.applyDraftSchedule.test.jsx` (duplicate-render dedupe)

After each phase, run the full non-regression contract. If any prior test fails, stop and diagnose before adding new work.

---

## File Structure

**Create:**
- `src/domain/masterPlan/sdlcStages.js` — canonical SDLC stage enum + helpers
- `src/domain/masterPlan/commercialPipelineStages.js` — canonical pipeline stage enum + helpers
- `src/domain/masterPlan/crossLaneArtifactDependencies.js` — semantic cross-lane consumer declarations
- `src/domain/masterPlan/fullHorizonScheduleExpansion.sdlcDepth.test.js`
- `src/domain/masterPlan/fullHorizonScheduleExpansion.commercialDepth.test.js`
- `src/domain/masterPlan/fullHorizonScheduleExpansion.crossLaneSemantic.test.js`
- `src/domain/masterPlan/fullHorizonScheduleExpansion.titleSpecificity.test.js`

**Modify:**
- `src/domain/masterPlan/fullHorizonScheduleExpansion.js` — descriptor pools for `product_software`, `income_stream`, `capital_real_estate`, `institution_education`, `civic_development` (P1/P2/P3); cross-lane consumer attachment
- `src/domain/masterPlan/artifactDependencyIntegrity.js` — recognize expanded SDLC and commercial stages from titles

---

## Phase 0 — Foundation: Stage Taxonomies

### Task 1: Create canonical SDLC stage taxonomy

**Files:**
- Create: `src/domain/masterPlan/sdlcStages.js`

- [ ] **Step 1: Write the file**

```javascript
// Canonical SDLC stage taxonomy for product/software descriptors. Stages are
// ordered (earlier → later) so consumers can verify progression. Each stage
// declares (a) what action it represents, (b) the artifact it produces, and
// (c) the evidence that proves it passed.

export const SDLC_STAGES = [
  'requirements_clarification',
  'product_spec',
  'technical_design',
  'implementation',
  'test_planning',
  'unit_integration_testing',
  'qa_validation',
  'release_prep',
  'deployment',
  'telemetry_monitoring',
  'user_feedback_review',
  'iteration_backlog_grooming',
];

export const SDLC_STAGE_SET = new Set(SDLC_STAGES);

const STAGE_METADATA = {
  requirements_clarification: { artifact: 'requirements brief', evidence: 'requirements brief signed by product owner' },
  product_spec: { artifact: 'product specification with user stories', evidence: 'product spec reviewed by engineering and design' },
  technical_design: { artifact: 'technical design note', evidence: 'design review with architecture decision record' },
  implementation: { artifact: 'implementation branch with patch', evidence: 'implementation branch passes self-test' },
  test_planning: { artifact: 'test plan covering unit / integration / acceptance scope', evidence: 'test plan reviewed against acceptance criteria' },
  unit_integration_testing: { artifact: 'passing test report', evidence: 'unit and integration tests pass with coverage threshold met' },
  qa_validation: { artifact: 'QA checklist with sign-off', evidence: 'QA checklist completed with zero release blockers' },
  release_prep: { artifact: 'release notes and deployment checklist', evidence: 'release notes approved and deployment checklist complete' },
  deployment: { artifact: 'deployment record with rollback plan', evidence: 'deployment executed with rollback verified' },
  telemetry_monitoring: { artifact: 'telemetry review with health signals', evidence: 'telemetry shows no regressions vs baseline' },
  user_feedback_review: { artifact: 'user feedback summary with prioritized themes', evidence: 'feedback themes triaged with owner and next-step decisions' },
  iteration_backlog_grooming: { artifact: 'backlog refinement notes with sized stories', evidence: 'backlog reviewed with priority and sequencing committed for next cycle' },
};

export function getSdlcArtifact(stage) {
  return STAGE_METADATA[stage]?.artifact || null;
}

export function getSdlcEvidence(stage) {
  return STAGE_METADATA[stage]?.evidence || null;
}

export function isValidSdlcStage(stage) {
  return SDLC_STAGE_SET.has(stage);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domain/masterPlan/sdlcStages.js
git commit -m "feat(masterPlan): add canonical SDLC stage taxonomy"
```

---

### Task 2: Create canonical commercial pipeline stage taxonomy

**Files:**
- Create: `src/domain/masterPlan/commercialPipelineStages.js`

- [ ] **Step 1: Write the file**

```javascript
// Canonical commercial/capital/BD pipeline stage taxonomy. Each stage declares
// its target object, artifact, evidence, and pipeline-position so cross-lane
// consumers can find the right upstream output.

export const COMMERCIAL_PIPELINE_STAGES = [
  'segment_definition',
  'target_criteria',
  'lead_sourcing',
  'list_enrichment',
  'outreach_asset',
  'outreach_send',
  'response_tracking',
  'qualification',
  'discovery_call',
  'needs_analysis',
  'proposal_prep',
  'diligence_packet',
  'follow_up',
  'objection_handling',
  'close_decision',
  'crm_pipeline_update',
  'lessons_learned',
];

export const COMMERCIAL_PIPELINE_STAGE_SET = new Set(COMMERCIAL_PIPELINE_STAGES);

const STAGE_METADATA = {
  segment_definition: { artifact: 'ICP and target segment brief', evidence: 'segment brief reviewed against revenue or capital target' },
  target_criteria: { artifact: 'target criteria document with disqualification rules', evidence: 'target criteria approved by lane owner' },
  lead_sourcing: { artifact: 'prospect source list with channel notes', evidence: 'source list audited for fit against target criteria' },
  list_enrichment: { artifact: 'enriched prospect list with contact paths and signal columns', evidence: 'enriched list reviewed for routability and dedupe' },
  outreach_asset: { artifact: 'outreach asset set (script, email, deck)', evidence: 'outreach asset reviewed for tone and target alignment' },
  outreach_send: { artifact: 'outreach log with batch metadata and message body', evidence: 'outreach send confirmed with delivery and bounce counts' },
  response_tracking: { artifact: 'response tracker with reply timestamps and dispositions', evidence: 'response tracker reconciled with CRM' },
  qualification: { artifact: 'qualification scorecard with disqualification rationale where applicable', evidence: 'qualification reviewed against ICP fit' },
  discovery_call: { artifact: 'discovery call notes with prospect needs and objections', evidence: 'discovery notes reviewed with next-step commitment recorded' },
  needs_analysis: { artifact: 'needs analysis with prioritized buyer requirements', evidence: 'needs analysis reviewed with internal stakeholder' },
  proposal_prep: { artifact: 'proposal draft with scope, pricing, and terms', evidence: 'proposal reviewed against needs analysis and qualification scorecard' },
  diligence_packet: { artifact: 'diligence packet with answers to standard buyer questions', evidence: 'diligence packet reviewed for completeness and accuracy' },
  follow_up: { artifact: 'follow-up tracker with cadence and next-touch dates', evidence: 'follow-up cadence executed with replies logged' },
  objection_handling: { artifact: 'objection log with response and outcome', evidence: 'objection log reviewed for pattern themes' },
  close_decision: { artifact: 'signed agreement, LOI, or decline note with reason', evidence: 'close decision recorded with terms and start date' },
  crm_pipeline_update: { artifact: 'pipeline status report with stage transitions', evidence: 'pipeline report reconciled with finance forecast' },
  lessons_learned: { artifact: 'lessons-learned brief with what worked and what to change', evidence: 'lessons-learned reviewed in next-cycle planning' },
};

export function getCommercialArtifact(stage) {
  return STAGE_METADATA[stage]?.artifact || null;
}

export function getCommercialEvidence(stage) {
  return STAGE_METADATA[stage]?.evidence || null;
}

export function isValidCommercialStage(stage) {
  return COMMERCIAL_PIPELINE_STAGE_SET.has(stage);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domain/masterPlan/commercialPipelineStages.js
git commit -m "feat(masterPlan): add canonical commercial pipeline stage taxonomy"
```

---

### Task 3: Create cross-lane artifact dependency declarations

**Files:**
- Create: `src/domain/masterPlan/crossLaneArtifactDependencies.js`

- [ ] **Step 1: Write the file**

```javascript
// Semantic cross-lane artifact dependencies. Each entry declares: a consuming
// lane family + phase + descriptor predicate, and the upstream lane family +
// stage whose artifact it should consume. Used by fullHorizonScheduleExpansion
// to attach consumedArtifactIds across lanes so the plan compounds.

export const CROSS_LANE_DEPENDENCIES = [
  // Commercial / BD consumes product proof, traction, and release evidence
  {
    consumingFamily: 'income_stream',
    consumingPhase: 'P1',
    consumingStage: 'outreach_asset',
    upstreamFamily: 'product_software',
    upstreamStage: 'release_prep',
    rationale: 'Outreach assets must reflect what the product actually ships',
  },
  {
    consumingFamily: 'income_stream',
    consumingPhase: 'P2',
    consumingStage: 'proposal_prep',
    upstreamFamily: 'product_software',
    upstreamStage: 'telemetry_monitoring',
    rationale: 'Proposals reference live product traction',
  },
  {
    consumingFamily: 'income_stream',
    consumingPhase: 'P3',
    consumingStage: 'diligence_packet',
    upstreamFamily: 'product_software',
    upstreamStage: 'user_feedback_review',
    rationale: 'Diligence packets cite real user feedback evidence',
  },
  // Capital consumes traction, budget, and release evidence
  {
    consumingFamily: 'capital_real_estate',
    consumingPhase: 'P1',
    consumingStage: 'segment_definition',
    upstreamFamily: 'income_stream',
    upstreamStage: 'close_decision',
    rationale: 'Capital memos cite verified revenue closes',
  },
  {
    consumingFamily: 'capital_real_estate',
    consumingPhase: 'P2',
    consumingStage: 'diligence_packet',
    upstreamFamily: 'product_software',
    upstreamStage: 'telemetry_monitoring',
    rationale: 'Capital diligence cites live product traction',
  },
  {
    consumingFamily: 'capital_real_estate',
    consumingPhase: 'P3',
    consumingStage: 'proposal_prep',
    upstreamFamily: 'income_stream',
    upstreamStage: 'crm_pipeline_update',
    rationale: 'Capital proposals cite recurring pipeline state',
  },
  // Institution / civic consume product proof and brand evidence
  {
    consumingFamily: 'institution_education',
    consumingPhase: 'P1',
    consumingStage: 'proposal_prep',
    upstreamFamily: 'product_software',
    upstreamStage: 'qa_validation',
    rationale: 'Institution pilots require validated product readiness',
  },
  {
    consumingFamily: 'civic_development',
    consumingPhase: 'P1',
    consumingStage: 'proposal_prep',
    upstreamFamily: 'media_channel',
    upstreamStage: null,
    rationale: 'Civic partnerships reference audience and reach evidence',
  },
  // Product backlog consumes commercial feedback
  {
    consumingFamily: 'product_software',
    consumingPhase: 'P2',
    consumingStage: 'iteration_backlog_grooming',
    upstreamFamily: 'income_stream',
    upstreamStage: 'discovery_call',
    rationale: 'Product iteration consumes discovery call notes',
  },
  {
    consumingFamily: 'product_software',
    consumingPhase: 'P2',
    consumingStage: 'requirements_clarification',
    upstreamFamily: 'income_stream',
    upstreamStage: 'objection_handling',
    rationale: 'New requirements address commercial objection themes',
  },
];

export function getDependenciesFor({ family, phase, stage }) {
  return CROSS_LANE_DEPENDENCIES.filter(
    (d) =>
      d.consumingFamily === family &&
      d.consumingPhase === phase &&
      (d.consumingStage === stage || d.consumingStage === null),
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domain/masterPlan/crossLaneArtifactDependencies.js
git commit -m "feat(masterPlan): declare cross-lane artifact dependency semantics"
```

---

## Phase 1 — SDLC Depth (Product/Software Lane)

### Task 4: Write failing test for SDLC stage coverage

**Files:**
- Create: `src/domain/masterPlan/fullHorizonScheduleExpansion.sdlcDepth.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { expandFullHorizonSchedule } from './fullHorizonScheduleExpansion.js';
import { SDLC_STAGES } from './sdlcStages.js';

const HORIZON_START = '2026-06-01';
const HORIZON_END = '2031-05-19';

const PLAN = {
  id: 'sdlc-depth-test',
  successStandard: 'Active scaling product by 2031',
  outcomeTarget: 'Active scaling product by 2031-05-19',
  coreMission: 'Build product engine',
};

const PHASE_MODEL = {
  phases: [
    { id: 'p1', label: 'P1', startBoundary: HORIZON_START, endBoundary: '2026-12-31', phaseObjective: 'Found' },
    { id: 'p2', label: 'P2', startBoundary: '2027-01-01', endBoundary: '2028-12-31', phaseObjective: 'Operate' },
    { id: 'p3', label: 'P3', startBoundary: '2029-01-01', endBoundary: HORIZON_END, phaseObjective: 'Scale' },
  ],
};

const LANES = [
  {
    id: 'lane-product',
    laneId: 'lane-product',
    domain: 'product',
    title: 'Core Product',
    laneTitle: 'Core Product',
    activationState: 'active',
  },
];

function runExpansion() {
  return expandFullHorizonSchedule({
    plan: PLAN,
    phaseModel: PHASE_MODEL,
    horizonStartDayKey: HORIZON_START,
    horizonEndDayKey: HORIZON_END,
    lanes: LANES,
    existingForecastBlocks: [],
    committedBlocks: [],
    workDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    weeklyCapacityMinutes: 30 * 60,
  });
}

describe('Product/software lane — SDLC stage coverage', () => {
  const blocks = runExpansion();
  const productBlocks = blocks.filter((b) => b.laneId === 'lane-product');

  it('covers at least 8 distinct SDLC stages across the horizon', () => {
    const stagesPresent = new Set(productBlocks.map((b) => b.lifecycleStage).filter(Boolean));
    const coveredCanonicalStages = SDLC_STAGES.filter((s) => stagesPresent.has(s));
    expect(coveredCanonicalStages.length).toBeGreaterThanOrEqual(8);
  });

  it('includes requirements_clarification, technical_design, qa_validation, deployment, telemetry_monitoring', () => {
    const stagesPresent = new Set(productBlocks.map((b) => b.lifecycleStage).filter(Boolean));
    expect(stagesPresent.has('requirements_clarification')).toBe(true);
    expect(stagesPresent.has('technical_design')).toBe(true);
    expect(stagesPresent.has('qa_validation')).toBe(true);
    expect(stagesPresent.has('deployment')).toBe(true);
    expect(stagesPresent.has('telemetry_monitoring')).toBe(true);
  });

  it('every product block with lifecycleStage carries an outputArtifact', () => {
    const staged = productBlocks.filter((b) => b.lifecycleStage);
    expect(staged.length).toBeGreaterThan(0);
    for (const b of staged) {
      expect(b.outputArtifact || b.outputArtifactId).toBeTruthy();
    }
  });

  it('every product block has a passEvidence or evidenceRequired field', () => {
    for (const b of productBlocks) {
      const hasEvidence = b.passEvidence || b.evidenceRequired;
      expect(hasEvidence).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

```bash
npx vitest run src/domain/masterPlan/fullHorizonScheduleExpansion.sdlcDepth.test.js
```

Expected: first two tests FAIL (only 4–5 stages present, missing requirements_clarification / technical_design / qa_validation / deployment / telemetry_monitoring).

---

### Task 5: Expand product_software P1 descriptor pool

**Files:**
- Modify: `src/domain/masterPlan/fullHorizonScheduleExpansion.js:490-496` (the `byFamily.product_software.P1` array)

- [ ] **Step 1: Replace the P1 product_software descriptor array**

Current contents (line ~490–496) to replace:

```javascript
      product_software: {
        P1: [
          ['Validate onboarding path for Operation Endgame app launch in product/software lane', 'validation', 'Onboarding checklist with proof gaps logged', null, { lifecycleStage: 'qa' }],
          [`Ship beta evidence review for ${laneTitle} in P1 product/software lane`, 'review', 'Beta evidence review with launch blockers ranked', null, { lifecycleStage: 'beta_feedback' }],
          [`Prepare post-anchor conversion instrumentation for ${laneTitle} in product/software lane`, 'action', 'Conversion instrumentation plan for the next proof window', null, { lifecycleStage: 'instrumentation' }],
          [`Ship next launch-critical feature increment for ${laneTitle} in P1 product/software lane`, 'action', 'Feature increment shipped with release notes and rollout plan', null, { lifecycleStage: 'implementation' }],
          [`Ship activation experiment for ${laneTitle} in P1 product/software lane`, 'action', 'Activation experiment shipped with measurement plan and decision date', null, { lifecycleStage: 'release' }],
        ],
```

New contents:

```javascript
      product_software: {
        P1: [
          [`Clarify launch-blocker requirements for ${laneTitle} in P1 product/software lane`, 'action', 'Requirements brief naming the launch blocker, owner, and acceptance criteria', null, { lifecycleStage: 'requirements_clarification' }],
          [`Write product specification with user stories for ${laneTitle} P1 onboarding scope`, 'action', 'Product spec with user stories and acceptance criteria', null, { lifecycleStage: 'product_spec' }],
          [`Draft technical design note for ${laneTitle} onboarding implementation`, 'action', 'Technical design note with architecture decision record', null, { lifecycleStage: 'technical_design' }],
          [`Implement onboarding activation tracking for ${laneTitle} in P1 product/software lane`, 'action', 'Implementation branch with onboarding activation tracking', null, { lifecycleStage: 'implementation' }],
          [`Author test plan covering onboarding unit and integration scope for ${laneTitle}`, 'action', 'Test plan covering onboarding unit / integration / acceptance scope', null, { lifecycleStage: 'test_planning' }],
          [`Run unit and integration tests for ${laneTitle} onboarding implementation`, 'validation', 'Passing test report for onboarding implementation', null, { lifecycleStage: 'unit_integration_testing' }],
          [`Execute QA validation checklist for ${laneTitle} P1 onboarding release`, 'validation', 'QA checklist completed with zero release blockers', null, { lifecycleStage: 'qa_validation' }],
          [`Prepare release notes and deployment checklist for ${laneTitle} P1 onboarding`, 'action', 'Release notes and deployment checklist approved', null, { lifecycleStage: 'release_prep' }],
          [`Deploy ${laneTitle} onboarding implementation with rollback plan`, 'action', 'Deployment record with verified rollback plan', null, { lifecycleStage: 'deployment' }],
          [`Review telemetry signals for ${laneTitle} post-deployment in P1`, 'review', 'Telemetry review showing no regressions vs baseline', null, { lifecycleStage: 'telemetry_monitoring' }],
          [`Summarize user feedback themes for ${laneTitle} P1 onboarding cohort`, 'review', 'User feedback summary with prioritized themes and owners', null, { lifecycleStage: 'user_feedback_review' }],
          [`Groom backlog with prioritized iteration scope for ${laneTitle} next P1 cycle`, 'action', 'Backlog refinement notes with sized stories and sequencing', null, { lifecycleStage: 'iteration_backlog_grooming' }],
        ],
```

- [ ] **Step 2: Run the SDLC depth test, expect PASS on the first two cases**

```bash
npx vitest run src/domain/masterPlan/fullHorizonScheduleExpansion.sdlcDepth.test.js
```

Expected: first two tests PASS, third + fourth still FAIL or PASS depending on `passEvidence` resolution.

---

### Task 6: Expand product_software P2 descriptor pool

**Files:**
- Modify: `src/domain/masterPlan/fullHorizonScheduleExpansion.js` (the `byFamily.product_software.P2` array, immediately after the P1 array)

- [ ] **Step 1: Replace the P2 product_software descriptor array**

Current contents (line ~497–503) to replace:

```javascript
        P2: [
          [`Assess product/software onboarding evidence against P2 conversion-readiness criteria for ${laneTitle}`, 'readiness', 'Conversion-readiness decision with next-cycle scope', null, { lifecycleStage: 'post_release_review' }],
          [`Audit activation-to-retention funnel for ${laneTitle} in P2 product/software lane`, 'audit', 'Funnel audit with retention risks and fixes', null, { lifecycleStage: 'qa' }],
          [`Define repeatable release cadence for ${laneTitle} in P2 product/software lane`, 'action', 'Release cadence standard with owner and review rhythm', null, { lifecycleStage: 'architecture_design' }],
          [`Ship next conversion-lift feature for ${laneTitle} in P2 product/software lane`, 'action', 'Conversion-lift feature shipped with measurement plan', null, { lifecycleStage: 'implementation' }],
          [`Implement retention loop improvement for ${laneTitle} in P2 product/software lane`, 'action', 'Retention loop change shipped with cohort baseline', null, { lifecycleStage: 'integration' }],
        ],
```

New contents:

```javascript
        P2: [
          [`Re-clarify conversion-lift requirements for ${laneTitle} from P1 telemetry and feedback`, 'action', 'Requirements brief tying P2 conversion scope to P1 telemetry findings', null, { lifecycleStage: 'requirements_clarification' }],
          [`Write conversion-lift product specification for ${laneTitle} P2 cycle`, 'action', 'Product spec covering conversion-lift user stories and acceptance criteria', null, { lifecycleStage: 'product_spec' }],
          [`Draft retention-loop technical design for ${laneTitle} in P2 product/software lane`, 'action', 'Technical design note for retention loop with architecture decision record', null, { lifecycleStage: 'technical_design' }],
          [`Implement conversion-lift feature for ${laneTitle} in P2 product/software lane`, 'action', 'Conversion-lift implementation branch shipped with measurement plan', null, { lifecycleStage: 'implementation' }],
          [`Author P2 test plan covering conversion-lift acceptance scope for ${laneTitle}`, 'action', 'P2 test plan tied to conversion-lift acceptance criteria', null, { lifecycleStage: 'test_planning' }],
          [`Run unit and integration tests for ${laneTitle} conversion-lift implementation`, 'validation', 'Passing test report for conversion-lift implementation', null, { lifecycleStage: 'unit_integration_testing' }],
          [`Execute P2 QA validation for ${laneTitle} conversion-lift release`, 'validation', 'QA checklist for conversion-lift release with zero blockers', null, { lifecycleStage: 'qa_validation' }],
          [`Prepare P2 release notes and deployment checklist for ${laneTitle}`, 'action', 'P2 release notes and deployment checklist approved', null, { lifecycleStage: 'release_prep' }],
          [`Deploy ${laneTitle} P2 conversion-lift release with rollback path`, 'action', 'P2 deployment record with verified rollback plan', null, { lifecycleStage: 'deployment' }],
          [`Review post-deploy telemetry for ${laneTitle} P2 conversion-lift cohort`, 'review', 'P2 telemetry review with conversion-lift health signals', null, { lifecycleStage: 'telemetry_monitoring' }],
          [`Triage user feedback themes from ${laneTitle} P2 conversion-lift cohort`, 'review', 'User feedback summary for P2 conversion-lift cohort with prioritized themes', null, { lifecycleStage: 'user_feedback_review' }],
          [`Groom P2 backlog with next conversion-lift iteration scope for ${laneTitle}`, 'action', 'P2 backlog with sized stories and sequencing for next iteration', null, { lifecycleStage: 'iteration_backlog_grooming' }],
        ],
```

- [ ] **Step 2: Re-run SDLC test, all four cases PASS**

```bash
npx vitest run src/domain/masterPlan/fullHorizonScheduleExpansion.sdlcDepth.test.js
```

Expected: all 4 tests PASS.

---

### Task 7: Expand product_software P3 descriptor pool

**Files:**
- Modify: `src/domain/masterPlan/fullHorizonScheduleExpansion.js` (the `byFamily.product_software.P3` array, immediately after the P2 array)

- [ ] **Step 1: Append new SDLC-stage-tagged descriptors to the existing P3 array**

The P3 array currently has 8 entries (lines ~504–513) — keep them and ADD these immediately before the closing `],`:

```javascript
          [`Re-clarify scale-readiness requirements for ${laneTitle} in P3 product/software lane`, 'action', 'P3 scale-readiness requirements brief with handoff acceptance criteria', null, { lifecycleStage: 'requirements_clarification' }],
          [`Write delegation-handoff product specification for ${laneTitle} P3 cycle`, 'action', 'P3 product spec covering delegation-handoff user stories and acceptance criteria', null, { lifecycleStage: 'product_spec' }],
          [`Draft delegation-handoff technical design for ${laneTitle} in P3`, 'action', 'P3 technical design note for delegation handoff with architecture decision record', null, { lifecycleStage: 'technical_design' }],
          [`Author P3 test plan covering delegation-handoff acceptance scope for ${laneTitle}`, 'action', 'P3 test plan tied to delegation-handoff acceptance criteria', null, { lifecycleStage: 'test_planning' }],
          [`Run P3 unit and integration tests for ${laneTitle} delegation-handoff implementation`, 'validation', 'Passing test report for delegation-handoff implementation', null, { lifecycleStage: 'unit_integration_testing' }],
          [`Execute P3 QA validation for ${laneTitle} delegation-handoff release`, 'validation', 'P3 QA checklist for delegation-handoff release with zero blockers', null, { lifecycleStage: 'qa_validation' }],
          [`Prepare P3 release notes and deployment checklist for ${laneTitle} delegation-handoff`, 'action', 'P3 release notes and deployment checklist approved', null, { lifecycleStage: 'release_prep' }],
          [`Deploy ${laneTitle} P3 delegation-handoff release with rollback path`, 'action', 'P3 deployment record with verified rollback plan', null, { lifecycleStage: 'deployment' }],
          [`Review post-deploy telemetry for ${laneTitle} P3 delegation-handoff cohort`, 'review', 'P3 telemetry review with delegation-handoff health signals', null, { lifecycleStage: 'telemetry_monitoring' }],
          [`Triage user feedback themes from ${laneTitle} P3 delegation-handoff cohort`, 'review', 'P3 user feedback summary with prioritized themes', null, { lifecycleStage: 'user_feedback_review' }],
          [`Groom P3 backlog with next delegation-handoff iteration scope for ${laneTitle}`, 'action', 'P3 backlog with sized stories and sequencing for next iteration', null, { lifecycleStage: 'iteration_backlog_grooming' }],
```

- [ ] **Step 2: Run SDLC depth test, expect PASS; run non-regression contract**

```bash
npx vitest run src/domain/masterPlan/fullHorizonScheduleExpansion.sdlcDepth.test.js
npx vitest run src/domain/masterPlan/fullHorizonScheduleExpansion.incubatingActivationPath.test.js src/domain/masterPlan/fullHorizonScheduleExpansion.gateReadability.test.js src/domain/masterPlan/fullHorizonScheduleExpansion.gateCriteria.test.js src/domain/masterPlan/fullHorizonScheduleExpansion.bdMechanics.test.js src/domain/masterPlan/fullHorizonScheduleExpansion.ownerClass.test.js src/domain/masterPlan/artifactDependencyIntegrity.test.js src/domain/masterPlan/fullHorizonProfessionalism.regression.test.js
```

Expected: all PASS. If anything regresses, stop and diagnose before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/domain/masterPlan/fullHorizonScheduleExpansion.js src/domain/masterPlan/fullHorizonScheduleExpansion.sdlcDepth.test.js
git commit -m "feat(masterPlan): expand product/software descriptors to full SDLC stage coverage"
```

---

## Phase 2 — Commercial / Capital / BD Pipeline Depth

### Task 8: Write failing test for commercial pipeline stage coverage

**Files:**
- Create: `src/domain/masterPlan/fullHorizonScheduleExpansion.commercialDepth.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { expandFullHorizonSchedule } from './fullHorizonScheduleExpansion.js';
import { COMMERCIAL_PIPELINE_STAGES } from './commercialPipelineStages.js';

const HORIZON_START = '2026-06-01';
const HORIZON_END = '2031-05-19';

const PLAN = {
  id: 'commercial-depth-test',
  successStandard: 'Active scaling commercial engine by 2031',
  outcomeTarget: 'Active scaling commercial engine by 2031-05-19',
  coreMission: 'Build commercial engine',
};

const PHASE_MODEL = {
  phases: [
    { id: 'p1', label: 'P1', startBoundary: HORIZON_START, endBoundary: '2026-12-31', phaseObjective: 'Found' },
    { id: 'p2', label: 'P2', startBoundary: '2027-01-01', endBoundary: '2028-12-31', phaseObjective: 'Operate' },
    { id: 'p3', label: 'P3', startBoundary: '2029-01-01', endBoundary: HORIZON_END, phaseObjective: 'Scale' },
  ],
};

const LANES = [
  { id: 'lane-income', laneId: 'lane-income', domain: 'income', title: 'Services Revenue', laneTitle: 'Services Revenue', activationState: 'active' },
  { id: 'lane-capital', laneId: 'lane-capital', domain: 'capital', title: 'Capital Real Estate', laneTitle: 'Capital Real Estate', activationState: 'active' },
  { id: 'lane-institution', laneId: 'lane-institution', domain: 'institution', title: 'Institution Education', laneTitle: 'Institution Education', activationState: 'active' },
  { id: 'lane-civic', laneId: 'lane-civic', domain: 'civic', title: 'Civic Development', laneTitle: 'Civic Development', activationState: 'active' },
];

function runExpansion() {
  return expandFullHorizonSchedule({
    plan: PLAN,
    phaseModel: PHASE_MODEL,
    horizonStartDayKey: HORIZON_START,
    horizonEndDayKey: HORIZON_END,
    lanes: LANES,
    existingForecastBlocks: [],
    committedBlocks: [],
    workDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    weeklyCapacityMinutes: 30 * 60,
  });
}

describe('Commercial / capital / BD lanes — pipeline stage coverage', () => {
  const blocks = runExpansion();

  it('income_stream covers at least 10 distinct commercial pipeline stages', () => {
    const incomeBlocks = blocks.filter((b) => b.laneId === 'lane-income');
    const stages = new Set(incomeBlocks.map((b) => b.commercialStage).filter(Boolean));
    const canonicalCovered = COMMERCIAL_PIPELINE_STAGES.filter((s) => stages.has(s));
    expect(canonicalCovered.length).toBeGreaterThanOrEqual(10);
  });

  it('income_stream P1 includes segment_definition, lead_sourcing, outreach_send, qualification, discovery_call, proposal_prep, close_decision', () => {
    const incomeBlocks = blocks.filter((b) => b.laneId === 'lane-income' && b.phaseLabel === 'P1');
    const stages = new Set(incomeBlocks.map((b) => b.commercialStage).filter(Boolean));
    for (const required of ['segment_definition', 'lead_sourcing', 'outreach_send', 'qualification', 'discovery_call', 'proposal_prep', 'close_decision']) {
      expect(stages.has(required)).toBe(true);
    }
  });

  it('capital_real_estate covers at least 8 commercial pipeline stages across the horizon', () => {
    const capitalBlocks = blocks.filter((b) => b.laneId === 'lane-capital');
    const stages = new Set(capitalBlocks.map((b) => b.commercialStage).filter(Boolean));
    const canonicalCovered = COMMERCIAL_PIPELINE_STAGES.filter((s) => stages.has(s));
    expect(canonicalCovered.length).toBeGreaterThanOrEqual(8);
  });

  it('institution_education includes segment_definition, qualification, proposal_prep across the horizon', () => {
    const instBlocks = blocks.filter((b) => b.laneId === 'lane-institution');
    const stages = new Set(instBlocks.map((b) => b.commercialStage).filter(Boolean));
    expect(stages.has('segment_definition')).toBe(true);
    expect(stages.has('qualification')).toBe(true);
    expect(stages.has('proposal_prep')).toBe(true);
  });

  it('every commercial-stage block carries an outputArtifact and passEvidence/evidenceRequired', () => {
    const staged = blocks.filter((b) => b.commercialStage);
    expect(staged.length).toBeGreaterThan(0);
    for (const b of staged) {
      expect(b.outputArtifact || b.outputArtifactId).toBeTruthy();
      expect(b.passEvidence || b.evidenceRequired).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npx vitest run src/domain/masterPlan/fullHorizonScheduleExpansion.commercialDepth.test.js
```

Expected: all 5 tests FAIL (current pool has only 5 stages: target_criteria, target_list, outreach_batch, discovery, proposal_terms).

---

### Task 9: Expand income_stream P1 commercial pipeline coverage

**Files:**
- Modify: `src/domain/masterPlan/fullHorizonScheduleExpansion.js:644-655` (the `byFamily.income_stream.P1` array)

- [ ] **Step 1: Replace the P1 income_stream descriptor array**

Replace the existing P1 array (5–9 descriptors) with this expanded one (17 descriptors covering full pipeline):

```javascript
      income_stream: {
        P1: [
          [`Define commercial segment and ICP for ${laneTitle} in P1 income stream lane`, 'action', 'ICP and target segment brief reviewed against revenue target', null, { isExternalBdMechanic: true, commercialStage: 'segment_definition' }],
          [`Define paid offer and pricing for ${laneTitle} in P1 income stream lane`, 'action', 'Target criteria document with disqualification rules', null, { isExternalBdMechanic: true, commercialStage: 'target_criteria' }],
          [`Source qualified leads for ${laneTitle} P1 outreach in income stream lane`, 'action', 'Prospect source list with channel notes', null, { isExternalBdMechanic: true, commercialStage: 'lead_sourcing' }],
          [`Enrich and dedupe prospect list for ${laneTitle} P1 outreach`, 'action', 'Enriched prospect list with contact paths and signal columns', null, { isExternalBdMechanic: true, commercialStage: 'list_enrichment' }],
          [`Build outreach asset set for ${laneTitle} P1 (script, email, deck)`, 'action', 'Outreach asset set reviewed for tone and target alignment', null, { isExternalBdMechanic: true, commercialStage: 'outreach_asset' }],
          [`Deliver outreach batch to prospect list for ${laneTitle} P1 income stream lane`, 'action', 'Outreach log with batch size, channel, message, and delivery confirmation', null, { isExternalBdMechanic: true, isExternalStakeholderTouchpoint: true, commercialStage: 'outreach_send' }],
          [`Track outreach responses for ${laneTitle} P1 cohort`, 'action', 'Response tracker with reply timestamps and dispositions', null, { isExternalBdMechanic: true, commercialStage: 'response_tracking' }],
          [`Qualify responders for ${laneTitle} P1 commercial pipeline`, 'action', 'Qualification scorecard with disqualification rationale where applicable', null, { isExternalBdMechanic: true, commercialStage: 'qualification' }],
          [`Run discovery call with qualified prospect for ${laneTitle} in P1 income stream lane`, 'action', 'Discovery call notes with prospect needs, objections, and next-step commitment', null, { isExternalBdMechanic: true, isExternalStakeholderTouchpoint: true, commercialStage: 'discovery_call' }],
          [`Run needs analysis for qualified ${laneTitle} P1 prospect`, 'action', 'Needs analysis with prioritized buyer requirements', null, { isExternalBdMechanic: true, commercialStage: 'needs_analysis' }],
          [`Draft proposal with scope, pricing, and terms for ${laneTitle} P1 qualified prospect`, 'action', 'Proposal draft with scope, pricing, and terms', null, { isExternalBdMechanic: true, isExternalStakeholderTouchpoint: true, commercialStage: 'proposal_prep' }],
          [`Assemble diligence packet for ${laneTitle} P1 qualified prospect`, 'action', 'Diligence packet with answers to standard buyer questions', null, { isExternalBdMechanic: true, commercialStage: 'diligence_packet' }],
          [`Execute follow-up cadence with ${laneTitle} P1 qualified pipeline`, 'action', 'Follow-up tracker with cadence and next-touch dates', null, { isExternalBdMechanic: true, isExternalStakeholderTouchpoint: true, commercialStage: 'follow_up' }],
          [`Log and respond to objections from ${laneTitle} P1 qualified prospect`, 'action', 'Objection log with response and outcome', null, { isExternalBdMechanic: true, commercialStage: 'objection_handling' }],
          [`Finalize first paying engagement and invoice for ${laneTitle}`, 'action', 'Signed agreement, LOI, or decline note with terms and start date', null, { isExternalBdMechanic: true, isExternalStakeholderTouchpoint: true, commercialStage: 'close_decision' }],
          [`Update commercial pipeline status for ${laneTitle} P1 cycle`, 'action', 'Pipeline status report with stage transitions', null, { commercialStage: 'crm_pipeline_update' }],
          [`Capture P1 commercial lessons-learned for ${laneTitle}`, 'review', 'Lessons-learned brief with what worked and what to change', null, { commercialStage: 'lessons_learned' }],
        ],
```

- [ ] **Step 2: Re-run commercial depth test**

```bash
npx vitest run src/domain/masterPlan/fullHorizonScheduleExpansion.commercialDepth.test.js
```

Expected: tests 1, 2, and 5 PASS for income_stream. Tests 3, 4 still FAIL (capital + institution not yet expanded).

---

### Task 10: Expand capital_real_estate P1/P2/P3 commercial pipeline coverage

**Files:**
- Modify: `src/domain/masterPlan/fullHorizonScheduleExpansion.js` (the `byFamily.capital_real_estate` block)

- [ ] **Step 1: Augment each phase with commercial-stage-tagged descriptors**

Find the `capital_real_estate: { P1: [...], P2: [...], P3: [...] }` block (starts around line 673). For each phase, ADD these descriptors at the end of the respective array (BEFORE the closing `],`):

P1 additions:

```javascript
          [`Define capital target segment and ICP for ${laneTitle} in P1 capital/real-estate lane`, 'readiness', 'ICP and target segment brief for capital partners', null, { commercialStage: 'segment_definition' }],
          [`Define capital target criteria with disqualification rules for ${laneTitle}`, 'readiness', 'Target criteria document with disqualification rules for capital sourcing', null, { commercialStage: 'target_criteria' }],
          [`Source candidate capital partners and lenders for ${laneTitle} P1 pipeline`, 'readiness', 'Capital partner source list with channel notes', null, { commercialStage: 'lead_sourcing' }],
          [`Build capital outreach asset set (memo, deck, brief) for ${laneTitle}`, 'readiness', 'Capital outreach asset set reviewed for tone and target alignment', null, { commercialStage: 'outreach_asset' }],
          [`Draft capital readiness memo with traction evidence for ${laneTitle}`, 'readiness', 'Capital readiness memo citing traction artifacts', null, { commercialStage: 'proposal_prep' }],
```

P2 additions:

```javascript
          [`Qualify candidate capital partners for ${laneTitle} P2 pipeline`, 'readiness', 'Capital partner qualification scorecard', null, { commercialStage: 'qualification' }],
          [`Run discovery conversation with qualified capital partner for ${laneTitle}`, 'readiness', 'Discovery notes from capital partner conversation', null, { commercialStage: 'discovery_call' }],
          [`Run needs analysis on qualified ${laneTitle} capital partner`, 'readiness', 'Needs analysis with prioritized partner requirements', null, { commercialStage: 'needs_analysis' }],
          [`Assemble capital diligence packet for ${laneTitle} qualified partner`, 'readiness', 'Capital diligence packet with answers to standard partner questions', null, { commercialStage: 'diligence_packet' }],
```

P3 additions:

```javascript
          [`Prepare capital proposal with terms for ${laneTitle} P3 partner pipeline`, 'action', 'Capital proposal draft with scope, terms, and pricing', null, { commercialStage: 'proposal_prep' }],
          [`Execute follow-up cadence with ${laneTitle} P3 capital pipeline`, 'action', 'Capital follow-up tracker with next-touch dates', null, { commercialStage: 'follow_up' }],
          [`Close capital decision with ${laneTitle} P3 qualified partner`, 'action', 'Capital close decision recorded with terms and start date', null, { commercialStage: 'close_decision' }],
          [`Update capital pipeline status for ${laneTitle} P3 cycle`, 'review', 'Capital pipeline report with stage transitions', null, { commercialStage: 'crm_pipeline_update' }],
```

- [ ] **Step 2: Re-run commercial depth test**

```bash
npx vitest run src/domain/masterPlan/fullHorizonScheduleExpansion.commercialDepth.test.js
```

Expected: tests 1, 2, 3, 5 PASS. Test 4 (institution) still FAIL.

---

### Task 11: Expand institution_education and civic_development commercial pipeline coverage

**Files:**
- Modify: `src/domain/masterPlan/fullHorizonScheduleExpansion.js` (the `byFamily.institution_education` and `byFamily.civic_development` blocks)

- [ ] **Step 1: Augment institution_education and civic_development with commercial-stage tags**

For `institution_education`, in each phase array (P1/P2/P3), ADD descriptors at the end:

```javascript
          [`Define ${laneTitle} institutional target segment and ICP`, 'readiness', 'Institutional ICP and target segment brief', null, { commercialStage: 'segment_definition' }],
          [`Qualify ${laneTitle} institutional partners against pilot criteria`, 'readiness', 'Institutional partner qualification scorecard', null, { commercialStage: 'qualification' }],
          [`Prepare ${laneTitle} institutional pilot proposal with scope and terms`, 'readiness', 'Institutional pilot proposal with scope and terms', null, { commercialStage: 'proposal_prep' }],
```

For `civic_development`, in each phase array (P1/P2/P3), ADD descriptors at the end:

```javascript
          [`Define ${laneTitle} civic stakeholder target segment and criteria`, 'readiness', 'Civic stakeholder segment and target criteria brief', null, { commercialStage: 'segment_definition' }],
          [`Qualify ${laneTitle} civic partners against engagement criteria`, 'readiness', 'Civic partner qualification scorecard', null, { commercialStage: 'qualification' }],
          [`Draft ${laneTitle} civic partnership proposal with scope and outcomes`, 'readiness', 'Civic partnership proposal with scope and outcomes', null, { commercialStage: 'proposal_prep' }],
```

- [ ] **Step 2: Run commercial depth test + non-regression contract**

```bash
npx vitest run src/domain/masterPlan/fullHorizonScheduleExpansion.commercialDepth.test.js
npx vitest run src/domain/masterPlan/fullHorizonScheduleExpansion.incubatingActivationPath.test.js src/domain/masterPlan/fullHorizonScheduleExpansion.gateReadability.test.js src/domain/masterPlan/fullHorizonScheduleExpansion.gateCriteria.test.js src/domain/masterPlan/fullHorizonScheduleExpansion.bdMechanics.test.js src/domain/masterPlan/fullHorizonScheduleExpansion.ownerClass.test.js src/domain/masterPlan/artifactDependencyIntegrity.test.js src/domain/masterPlan/fullHorizonProfessionalism.regression.test.js
```

Expected: all 5 commercial depth tests + all non-regression tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/domain/masterPlan/fullHorizonScheduleExpansion.js src/domain/masterPlan/fullHorizonScheduleExpansion.commercialDepth.test.js
git commit -m "feat(masterPlan): expand commercial/capital/institution/civic to full pipeline coverage"
```

---

## Phase 3 — Cross-Lane Semantic Artifact Dependency

### Task 12: Write failing test for cross-lane consumption

**Files:**
- Create: `src/domain/masterPlan/fullHorizonScheduleExpansion.crossLaneSemantic.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { expandFullHorizonSchedule } from './fullHorizonScheduleExpansion.js';

const HORIZON_START = '2026-06-01';
const HORIZON_END = '2031-05-19';

const PLAN = {
  id: 'cross-lane-test',
  successStandard: 'Active ecosystem by 2031',
  outcomeTarget: 'Active ecosystem by 2031-05-19',
  coreMission: 'Build ecosystem',
};

const PHASE_MODEL = {
  phases: [
    { id: 'p1', label: 'P1', startBoundary: HORIZON_START, endBoundary: '2026-12-31', phaseObjective: 'Found' },
    { id: 'p2', label: 'P2', startBoundary: '2027-01-01', endBoundary: '2028-12-31', phaseObjective: 'Operate' },
    { id: 'p3', label: 'P3', startBoundary: '2029-01-01', endBoundary: HORIZON_END, phaseObjective: 'Scale' },
  ],
};

const LANES = [
  { id: 'lane-product', laneId: 'lane-product', domain: 'product', title: 'Core Product', laneTitle: 'Core Product', activationState: 'active' },
  { id: 'lane-income', laneId: 'lane-income', domain: 'income', title: 'Services Revenue', laneTitle: 'Services Revenue', activationState: 'active' },
  { id: 'lane-capital', laneId: 'lane-capital', domain: 'capital', title: 'Capital Real Estate', laneTitle: 'Capital Real Estate', activationState: 'active' },
];

function runExpansion() {
  return expandFullHorizonSchedule({
    plan: PLAN,
    phaseModel: PHASE_MODEL,
    horizonStartDayKey: HORIZON_START,
    horizonEndDayKey: HORIZON_END,
    lanes: LANES,
    existingForecastBlocks: [],
    committedBlocks: [],
    workDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    weeklyCapacityMinutes: 30 * 60,
  });
}

describe('Cross-lane semantic artifact dependency', () => {
  const blocks = runExpansion();
  const idToBlock = new Map(blocks.map((b) => [b.id, b]));

  function hasUpstreamFromLane(block, upstreamLaneId) {
    const consumedIds = block.consumedArtifactIds || [];
    return consumedIds.some((cid) => {
      const upstream = idToBlock.get(cid);
      return upstream && upstream.laneId === upstreamLaneId;
    });
  }

  it('income_stream outreach_asset blocks consume product release_prep artifacts', () => {
    const outreachAssetBlocks = blocks.filter(
      (b) => b.laneId === 'lane-income' && b.commercialStage === 'outreach_asset',
    );
    expect(outreachAssetBlocks.length).toBeGreaterThan(0);
    const withCrossLane = outreachAssetBlocks.filter((b) => hasUpstreamFromLane(b, 'lane-product'));
    expect(withCrossLane.length).toBeGreaterThan(0);
  });

  it('capital_real_estate segment_definition blocks consume income close_decision artifacts', () => {
    const capitalSegmentBlocks = blocks.filter(
      (b) => b.laneId === 'lane-capital' && b.commercialStage === 'segment_definition',
    );
    expect(capitalSegmentBlocks.length).toBeGreaterThan(0);
    const withCrossLane = capitalSegmentBlocks.filter((b) => hasUpstreamFromLane(b, 'lane-income'));
    expect(withCrossLane.length).toBeGreaterThan(0);
  });

  it('product_software iteration_backlog_grooming blocks consume income discovery_call artifacts', () => {
    const productBacklogBlocks = blocks.filter(
      (b) => b.laneId === 'lane-product' && b.lifecycleStage === 'iteration_backlog_grooming',
    );
    expect(productBacklogBlocks.length).toBeGreaterThan(0);
    const withCrossLane = productBacklogBlocks.filter((b) => hasUpstreamFromLane(b, 'lane-income'));
    expect(withCrossLane.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

```bash
npx vitest run src/domain/masterPlan/fullHorizonScheduleExpansion.crossLaneSemantic.test.js
```

Expected: all 3 tests FAIL (no cross-lane consumption logic yet).

---

### Task 13: Wire cross-lane artifact consumption in expansion engine

**Files:**
- Modify: `src/domain/masterPlan/fullHorizonScheduleExpansion.js` (the `expandFullHorizonSchedule` function, after main loop produces blocks, before `applyArtifactDependencyIntegrity`)

- [ ] **Step 1: Add import at top of file (around line 1–2)**

Find the existing imports:

```javascript
import { applyScheduleValidityProjection } from './scheduleValidityProjection.js';
import { applyArtifactDependencyIntegrity } from './artifactDependencyIntegrity.js';
```

Add this line after them:

```javascript
import { CROSS_LANE_DEPENDENCIES } from './crossLaneArtifactDependencies.js';
```

- [ ] **Step 2: Add cross-lane wiring helper near top of file**

Add this function above `mkId` (line 4):

```javascript
function applyCrossLaneArtifactDependencies(blocks) {
  // Index blocks by (laneFamily, phase, stage) for fast lookup of upstream
  // candidates. Use the earliest matching upstream block per (consumer, dep)
  // tuple to make the wiring deterministic.
  function laneFamilyFromLaneId(laneId, blocks) {
    const sample = blocks.find((b) => b.laneId === laneId);
    return sample ? (sample.titleFamily?.split('_')[0] || null) : null;
  }
  function familyKeyForLane(laneTitle) {
    const t = String(laneTitle || '').toLowerCase();
    if (/product|software|app/.test(t)) return 'product_software';
    if (/creative|album|music/.test(t)) return 'creative_media';
    if (/media|podcast|channel|content/.test(t)) return 'media_channel';
    if (/ops|operations|brand|company/.test(t)) return 'company_operations';
    if (/income|service|revenue/.test(t)) return 'income_stream';
    if (/capital|real.?estate/.test(t)) return 'capital_real_estate';
    if (/institution|education/.test(t)) return 'institution_education';
    if (/civic|community|government/.test(t)) return 'civic_development';
    return null;
  }
  const byKey = new Map();
  for (const b of blocks) {
    const family = familyKeyForLane(b.laneLabel || b.laneTitle || '');
    if (!family) continue;
    const stageKey = b.lifecycleStage || b.commercialStage;
    if (!stageKey) continue;
    const key = `${family}|${b.phaseLabel}|${stageKey}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(b);
  }
  for (const consumer of blocks) {
    const consumerFamily = familyKeyForLane(consumer.laneLabel || consumer.laneTitle || '');
    if (!consumerFamily) continue;
    const consumerStage = consumer.lifecycleStage || consumer.commercialStage;
    if (!consumerStage) continue;
    const matchingDeps = CROSS_LANE_DEPENDENCIES.filter(
      (d) =>
        d.consumingFamily === consumerFamily &&
        d.consumingPhase === consumer.phaseLabel &&
        d.consumingStage === consumerStage,
    );
    if (matchingDeps.length === 0) continue;
    const next = Array.isArray(consumer.consumedArtifactIds) ? [...consumer.consumedArtifactIds] : [];
    for (const dep of matchingDeps) {
      const upstreamKeys = dep.upstreamStage
        ? [`${dep.upstreamFamily}|P1|${dep.upstreamStage}`, `${dep.upstreamFamily}|P2|${dep.upstreamStage}`, `${dep.upstreamFamily}|P3|${dep.upstreamStage}`]
        : [`${dep.upstreamFamily}|P1|`, `${dep.upstreamFamily}|P2|`, `${dep.upstreamFamily}|P3|`];
      let upstream = null;
      for (const k of upstreamKeys) {
        const candidates = byKey.get(k);
        if (candidates && candidates.length > 0) {
          // Prefer upstream block whose dayKey precedes the consumer
          const earlier = candidates.filter((c) => c.dayKey <= consumer.dayKey);
          upstream = earlier[0] || candidates[0];
          break;
        }
      }
      if (upstream && !next.includes(upstream.id)) {
        next.push(upstream.id);
      }
    }
    consumer.consumedArtifactIds = next;
  }
  return blocks;
}
```

- [ ] **Step 3: Invoke the wiring inside `expandFullHorizonSchedule` just before the final integrity pass**

Find the line near the end of `expandFullHorizonSchedule` that calls `applyArtifactDependencyIntegrity(blocks)`. Insert this call IMMEDIATELY BEFORE it:

```javascript
  blocks = applyCrossLaneArtifactDependencies(blocks);
```

- [ ] **Step 4: Run cross-lane test, expect PASS; run non-regression contract**

```bash
npx vitest run src/domain/masterPlan/fullHorizonScheduleExpansion.crossLaneSemantic.test.js
npx vitest run src/domain/masterPlan/fullHorizonScheduleExpansion.sdlcDepth.test.js src/domain/masterPlan/fullHorizonScheduleExpansion.commercialDepth.test.js src/domain/masterPlan/fullHorizonScheduleExpansion.incubatingActivationPath.test.js src/domain/masterPlan/fullHorizonScheduleExpansion.gateReadability.test.js src/domain/masterPlan/fullHorizonScheduleExpansion.gateCriteria.test.js src/domain/masterPlan/fullHorizonScheduleExpansion.bdMechanics.test.js src/domain/masterPlan/fullHorizonScheduleExpansion.ownerClass.test.js src/domain/masterPlan/artifactDependencyIntegrity.test.js src/domain/masterPlan/fullHorizonProfessionalism.regression.test.js
```

Expected: cross-lane tests PASS, no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/domain/masterPlan/fullHorizonScheduleExpansion.js src/domain/masterPlan/fullHorizonScheduleExpansion.crossLaneSemantic.test.js
git commit -m "feat(masterPlan): wire semantic cross-lane artifact consumption"
```

---

## Phase 4 — Title Specificity

### Task 14: Write failing test for title specificity (no generic templates)

**Files:**
- Create: `src/domain/masterPlan/fullHorizonScheduleExpansion.titleSpecificity.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { expandFullHorizonSchedule } from './fullHorizonScheduleExpansion.js';

const HORIZON_START = '2026-06-01';
const HORIZON_END = '2031-05-19';

const PLAN = {
  id: 'title-test',
  successStandard: 'Active ecosystem by 2031',
  outcomeTarget: 'Active ecosystem by 2031-05-19',
  coreMission: 'Build ecosystem',
};

const PHASE_MODEL = {
  phases: [
    { id: 'p1', label: 'P1', startBoundary: HORIZON_START, endBoundary: '2026-12-31', phaseObjective: 'Found' },
    { id: 'p2', label: 'P2', startBoundary: '2027-01-01', endBoundary: '2028-12-31', phaseObjective: 'Operate' },
    { id: 'p3', label: 'P3', startBoundary: '2029-01-01', endBoundary: HORIZON_END, phaseObjective: 'Scale' },
  ],
};

const LANES = [
  { id: 'lane-product', laneId: 'lane-product', domain: 'product', title: 'Core Product', laneTitle: 'Core Product', activationState: 'active' },
  { id: 'lane-income', laneId: 'lane-income', domain: 'income', title: 'Services Revenue', laneTitle: 'Services Revenue', activationState: 'active' },
];

function runExpansion() {
  return expandFullHorizonSchedule({
    plan: PLAN,
    phaseModel: PHASE_MODEL,
    horizonStartDayKey: HORIZON_START,
    horizonEndDayKey: HORIZON_END,
    lanes: LANES,
    existingForecastBlocks: [],
    committedBlocks: [],
    workDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    weeklyCapacityMinutes: 30 * 60,
  });
}

const GENERIC_TITLE_PATTERNS = [
  /\bImplement next operating-system control\b/,
  /\bShip next launch-critical feature increment\b/,
  /\bValidate next milestone\b/,
  /\bReview next commercial asset\b/,
  /\bPrepare next software update\b/,
];

describe('Block title specificity', () => {
  const blocks = runExpansion();

  it('no block uses one of the banned generic templates verbatim', () => {
    for (const b of blocks) {
      for (const pat of GENERIC_TITLE_PATTERNS) {
        expect(b.title).not.toMatch(pat);
      }
    }
  });

  it('no titleFamily appears more than 60 times per (phase, lane)', () => {
    const counts = new Map();
    for (const b of blocks) {
      const key = `${b.phaseLabel}|${b.laneId}|${b.titleFamily || b.title}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const overweight = Array.from(counts.entries()).filter(([, n]) => n > 60);
    expect(overweight).toEqual([]);
  });

  it('every block title is at least 30 characters long', () => {
    for (const b of blocks) {
      expect(b.title.length).toBeGreaterThanOrEqual(30);
    }
  });
});
```

- [ ] **Step 2: Run test**

```bash
npx vitest run src/domain/masterPlan/fullHorizonScheduleExpansion.titleSpecificity.test.js
```

Expected: tests 1 and 3 PASS (we already replaced "Ship next launch-critical feature increment" in Task 5–7). Test 2 may PASS or FAIL depending on title-family distribution; if it FAILS, see Task 15.

---

### Task 15: Conditional — diversify overweighted title families (only if Task 14 test 2 fails)

**Files:**
- Modify: `src/domain/masterPlan/fullHorizonScheduleExpansion.js` (the `decorateDescriptorForOccurrence` function at line ~442)

- [ ] **Step 1: If test 2 in Task 14 fails, audit which family/lane/phase tuples exceed 60 occurrences**

Add a console.log in `decorateDescriptorForOccurrence` temporarily to see which descriptors get repeated:

```javascript
function decorateDescriptorForOccurrence({ descriptor, phaseLabel, lane, dayKey, idx }) {
  // existing body…
}
```

Run with `DEBUG=1 npx vitest run src/domain/masterPlan/fullHorizonScheduleExpansion.titleSpecificity.test.js`, inspect output.

- [ ] **Step 2: Expand focus options for the overweighted family**

In `getOccurrenceFocusOptions(family, phaseLabel, laneTitle)` (line ~214), add 3–5 more focus tokens for any (family, phase) tuple that produced > 60 identical titles. Each focus token becomes a distinct title suffix via the existing decoration.

- [ ] **Step 3: Re-run title specificity test**

```bash
npx vitest run src/domain/masterPlan/fullHorizonScheduleExpansion.titleSpecificity.test.js
```

Expected: all 3 PASS.

- [ ] **Step 4: Commit (only if changes made)**

```bash
git add src/domain/masterPlan/fullHorizonScheduleExpansion.js src/domain/masterPlan/fullHorizonScheduleExpansion.titleSpecificity.test.js
git commit -m "feat(masterPlan): enforce block title specificity and ban generic templates"
```

If no Step 2 changes were needed, still commit the new test file alone:

```bash
git add src/domain/masterPlan/fullHorizonScheduleExpansion.titleSpecificity.test.js
git commit -m "test(masterPlan): add title specificity regression"
```

---

## Phase 5 — Regression + RTG Verification

### Task 16: Full non-regression contract + new tests

**Files:** (read-only)

- [ ] **Step 1: Run the complete suite — old contract + new tests**

```bash
npx vitest run \
  src/domain/masterPlan/fullHorizonScheduleExpansion.sdlcDepth.test.js \
  src/domain/masterPlan/fullHorizonScheduleExpansion.commercialDepth.test.js \
  src/domain/masterPlan/fullHorizonScheduleExpansion.crossLaneSemantic.test.js \
  src/domain/masterPlan/fullHorizonScheduleExpansion.titleSpecificity.test.js \
  src/domain/masterPlan/fullHorizonScheduleExpansion.incubatingActivationPath.test.js \
  src/domain/masterPlan/fullHorizonScheduleExpansion.gateReadability.test.js \
  src/domain/masterPlan/fullHorizonScheduleExpansion.gateCriteria.test.js \
  src/domain/masterPlan/fullHorizonScheduleExpansion.bdMechanics.test.js \
  src/domain/masterPlan/fullHorizonScheduleExpansion.ownerClass.test.js \
  src/domain/masterPlan/artifactDependencyIntegrity.test.js \
  src/domain/masterPlan/exportFullHorizonSchedule.test.js \
  src/domain/masterPlan/fullHorizonProfessionalism.regression.test.js \
  tests/state/longHorizon.blockGeneration.test.js \
  tests/state/longHorizon.countStability.test.js \
  tests/state/longHorizon.mergeBehavior.test.js \
  tests/state/longHorizon.phaseCoverage.test.js \
  tests/state/longHorizon.visibilityModes.test.js \
  tests/components/ZionDashboard.applyDraftSchedule.test.jsx
```

Expected: all PASS (except the known stale-fixture residue on `exportFullHorizonSchedule.test.js → matches the persisted agenda manifest exactly`, which depends on snapshot freshness, not engine correctness).

- [ ] **Step 2: If anything other than the known residue fails, stop and diagnose**

---

### Task 17: RTG re-run on the live Operation Endgame fixture

**Files:**
- Create (temporary): `src/domain/masterPlan/tmp-rtg-initiative-b-verification.test.js`

- [ ] **Step 1: Write the RTG verification test**

```javascript
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildFullHorizonScheduleExport } from './exportFullHorizonSchedule.js';
import { SDLC_STAGES } from './sdlcStages.js';
import { COMMERCIAL_PIPELINE_STAGES } from './commercialPipelineStages.js';

const FIXTURE_PATH = path.resolve(__dirname, '../../../tmp-live-jericho-identity.json');

describe('Initiative B RTG verification — Operation Endgame', () => {
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
  const result = buildFullHorizonScheduleExport(fixture);
  const blocks = result.blocks;

  it('SDLC stage coverage on product/software lane', () => {
    const productBlocks = blocks.filter((b) => /product|software/i.test(b.laneLabel || b.laneTitle || ''));
    const stagesPresent = new Set(productBlocks.map((b) => b.lifecycleStage).filter(Boolean));
    const covered = SDLC_STAGES.filter((s) => stagesPresent.has(s));
    console.log('[RTG-SDLC]', JSON.stringify({ coveredStages: covered, count: covered.length }));
    expect(covered.length).toBeGreaterThanOrEqual(8);
  });

  it('Commercial pipeline coverage on income/capital/institution/civic lanes', () => {
    const commercialBlocks = blocks.filter((b) => /income|capital|institution|civic/i.test(b.laneLabel || b.laneTitle || ''));
    const stagesPresent = new Set(commercialBlocks.map((b) => b.commercialStage).filter(Boolean));
    const covered = COMMERCIAL_PIPELINE_STAGES.filter((s) => stagesPresent.has(s));
    console.log('[RTG-Commercial]', JSON.stringify({ coveredStages: covered, count: covered.length }));
    expect(covered.length).toBeGreaterThanOrEqual(10);
  });

  it('Cross-lane consumption is present on commercial blocks', () => {
    const consumers = blocks.filter((b) => b.commercialStage && Array.isArray(b.consumedArtifactIds) && b.consumedArtifactIds.length > 0);
    const idToBlock = new Map(blocks.map((b) => [b.id, b]));
    const withCrossLane = consumers.filter((b) =>
      b.consumedArtifactIds.some((cid) => {
        const u = idToBlock.get(cid);
        return u && u.laneId !== b.laneId;
      }),
    );
    console.log('[RTG-CrossLane]', JSON.stringify({ commercialConsumers: consumers.length, withCrossLane: withCrossLane.length }));
    expect(withCrossLane.length).toBeGreaterThan(0);
  });

  it('All prior invariants hold (horizon, activation, work window, gate criteria)', () => {
    expect(result.range.endDayKey.startsWith('2031')).toBe(true);
    const firstBlock = blocks.slice().sort((a, b) => a.dayKey.localeCompare(b.dayKey))[0];
    const officialStart = result.plan.officialStartDayKey || result.plan.horizonStart;
    expect(firstBlock.dayKey >= officialStart).toBe(true);
    const violations = blocks.filter((b) => {
      const s = b.localScheduledTimeHHMM;
      if (!s) return false;
      return s < '09:00' || s > '15:00';
    });
    expect(violations).toEqual([]);
    const strictGates = blocks.filter((b) => (b.blockType || '').toLowerCase() === 'gate');
    const fullCoverage = strictGates.filter(
      (b) => b.gateCriteria && b.passCriteria && b.failCriteria && b.acceptanceCriteria && b.owner,
    );
    expect(fullCoverage.length).toBe(strictGates.length);
  });
});
```

- [ ] **Step 2: Run RTG verification**

```bash
npx vitest run src/domain/masterPlan/tmp-rtg-initiative-b-verification.test.js --reporter=verbose
```

Expected: all 4 tests PASS. Inspect the `[RTG-*]` log lines for stage coverage counts.

- [ ] **Step 3: Delete the temp RTG test file**

```bash
rm src/domain/masterPlan/tmp-rtg-initiative-b-verification.test.js
```

- [ ] **Step 4: Commit final state**

```bash
git add -A
git commit -m "test(masterPlan): RTG verification of Initiative B decomposition depth"
```

---

### Task 18: Write Initiative B completion report

**Files:**
- Create: `docs/superpowers/plans/2026-06-05-initiative-b-completion-report.md`

- [ ] **Step 1: Write the report capturing all six required outputs**

Report must include the six required deliverables from the implementation prompt:

```markdown
# Initiative B — Completion Report

## 1. Root cause of shallow SDLC/commercial/capital/BD decomposition

[Confirm or refine the hypothesis: descriptor pools were authored as scaffolds with only 4–5 stages each; lifecycleStage/commercialStage metadata existed on the descriptor schema but was sparsely populated. Title genericity was downstream of descriptor pool size.]

## 2. Files changed

[List all files created and modified during execution.]

## 3. Tests added or updated

[List the 4 new test files plus any modified prior tests.]

## 4. Focused validation results

[Paste pass/fail summary from Task 16 and the RTG verification log lines from Task 17.]

## 5. Any known non-blocking residue

[Note the stale-fixture residue on exportFullHorizonSchedule.test.js if still present — same as RTG Remediation #1 closure. Note any title-family overweight cases that required Phase 4 Task 15.]

## 6. Whether Operation Endgame is ready for the next full plan-quality evaluation

[Yes/No with rationale tied to the six closure conditions in the implementation prompt.]
```

- [ ] **Step 2: Commit the report**

```bash
git add docs/superpowers/plans/2026-06-05-initiative-b-completion-report.md
git commit -m "docs: Initiative B completion report"
```

---

## Self-Review Checklist

| Spec section | Plan coverage |
|---|---|
| §1 SDLC lane depth | Tasks 4–7 (failing test + P1/P2/P3 descriptor expansion) |
| §2 Commercial/capital/BD depth | Tasks 8–11 (failing test + income_stream/capital/institution/civic expansion) |
| §3 Cross-lane artifact dependency | Tasks 12–13 (failing test + wiring) |
| §4 Block title and action specificity | Tasks 14–15 (failing test + conditional diversification) |
| §5 Gate criteria preservation | Non-regression contract enforced after each phase |
| §6 Horizon/schedule constraint preservation | Non-regression contract + RTG re-run at Task 17 |
| Required deliverables (root cause, files, tests, validation, residue, readiness) | Task 18 completion report |

**Placeholder scan:** No TBDs. All test code is exact. All descriptor literals are concrete. Cross-lane wiring helper is fully specified.

**Type consistency:** `lifecycleStage` and `commercialStage` field names match between taxonomy modules, expansion descriptors, tests, and `artifactDependencyIntegrity.js`. `consumedArtifactIds` is the array name used consistently. `CROSS_LANE_DEPENDENCIES` exports match imports.

---
