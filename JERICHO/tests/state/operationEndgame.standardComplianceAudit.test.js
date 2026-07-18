import { describe, expect, it } from 'vitest';

import { buildOperationEndgameFixtureState } from '../../src/dev/operationEndgameRestore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import {
  deriveOperationEndgameStandardAuditInput,
  formatOperationEndgameStandardAuditReport,
  runOperationEndgameStandardComplianceAudit,
} from '../../src/domain/planQuality/operationEndgameStandardAudit.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildGeneratedOperationEndgameState() {
  const fixture = buildOperationEndgameFixtureState({
    appNowISO: '2026-06-21T12:00:00.000Z',
    appTodayDate: '2026-06-21',
  });
  fixture.cyclesById = {};
  if (fixture.activeGoalId && fixture.goalsById?.[fixture.activeGoalId]) {
    fixture.goalsById[fixture.activeGoalId].activeCycleId = null;
  }
  fixture.activeCycleId = null;
  fixture.goalExecutionContract = null;
  fixture.scheduleLifecycle = 'no_schedule';
  fixture.scheduleLifecycleState = 'goal_admitted';
  fixture.proposedBlocks = [];
  fixture.scheduleReviewBlocks = [];
  fixture.lastPlanError = null;
  const planId = fixture?.profilesById?.[fixture.activeProfileId]?.activeMasterPlanId;
  let generated = computeDerivedState(fixture, {
    type: 'GENERATE_PLAN',
    payload: { masterPlanId: planId, source: 'MASTER_PLAN_FIRST_CYCLE' },
  });
  if (generated.lastPlanError?.code === 'CURRENT_STATE_REASSESSMENT_REQUIRED' && generated.activeCycleId) {
    let next = computeDerivedState(generated, {
      type: 'COMPLETE_CYCLE_REASSESSMENT',
      cycleId: generated.activeCycleId,
    });
    next = computeDerivedState(next, {
      type: 'UPDATE_WORK_WINDOWS',
      payload: {
        cycleId: next.activeCycleId,
        workWindows: clone(next.availabilityPolicy?.workWindows || {}),
      },
    });
    generated = computeDerivedState(next, {
      type: 'GENERATE_PLAN',
      payload: { masterPlanId: planId, source: 'MASTER_PLAN_FIRST_CYCLE' },
    });
  }
  const applied = computeDerivedState(generated, { type: 'APPLY_PLAN' });
  return { fixture, generated, applied };
}

let cachedBaselineBundle = null;

function getBaselineBundle() {
  if (!cachedBaselineBundle) {
    cachedBaselineBundle = buildGeneratedOperationEndgameState();
  }
  return {
    fixture: clone(cachedBaselineBundle.fixture),
    generated: clone(cachedBaselineBundle.generated),
    applied: clone(cachedBaselineBundle.applied),
  };
}

function auditActualOperationEndgame() {
  const { generated, applied } = getBaselineBundle();
  const derived = deriveOperationEndgameStandardAuditInput(applied);
  const activeScheduledBlocks =
    (Array.isArray(applied.scheduleReviewBlocks) && applied.scheduleReviewBlocks.length > 0
      ? applied.scheduleReviewBlocks
      : Array.isArray(applied.cycle)
        ? applied.cycle.flatMap((day) => (Array.isArray(day?.blocks) ? day.blocks : []))
        : []) || [];
  const auditInput = {
    ...derived,
    activeScheduledBlocks: clone(activeScheduledBlocks),
    proposedBlocks: clone(derived.proposedBlocks || []),
  };
  return {
    generated,
    applied,
    auditInput,
    report: runOperationEndgameStandardComplianceAudit(auditInput),
  };
}

function buildStandardCompliantCandidateInput() {
  const { auditInput } = auditActualOperationEndgame();
  const makeBlock = (overrides) => ({
    cycleId: auditInput.cycleId,
    status: 'planned',
    origin: 'schedule_review',
    scheduleLifecycle: 'applied_review',
    owner: 'Local Profile',
    executionOwner: 'Local Profile',
    requiredSystemBlock: true,
    ...overrides,
  });
  return {
    ...clone(auditInput),
    proposedBlocks: [],
    forecastBlocks: [],
    lastPlanError: null,
    activeScheduledBlocks: [
      makeBlock({
        title: 'Define first app launch readiness gate',
        label: 'Define first app launch readiness gate',
        displayTitle: 'Define first app launch readiness gate',
        entityLabel: 'Global State Systems',
        projectLabel: 'Jericho System',
        initiativeLabel: 'Jericho System',
        laneId: 'product_platform',
        laneLabel: 'Operation Endgame product platform',
        workType: 'Planning',
        phaseLabel: 'P1',
        startISO: '2026-06-23T09:00:00.000Z',
        endISO: '2026-06-23T09:45:00.000Z',
        start: '2026-06-23T09:00:00.000Z',
        end: '2026-06-23T09:45:00.000Z',
        dayKey: '2026-06-23',
        producesArtifact: 'Launch readiness gate definition with scope, decision rules, and excluded cases',
        passEvidence: 'Saved launch readiness gate definition with scope, decision rules, excluded cases, and owner approval notes.',
      }),
      makeBlock({
        title: 'Document album launch asset inventory',
        label: 'Document album launch asset inventory',
        displayTitle: 'Document album launch asset inventory',
        entityLabel: 'Global State Corp.',
        projectLabel: 'Release Engine',
        initiativeLabel: 'Release Engine',
        laneId: 'album_release_engine',
        laneLabel: 'Operation Endgame album release engine',
        workType: 'Planning',
        phaseLabel: 'P1',
        startISO: '2026-06-24T09:00:00.000Z',
        endISO: '2026-06-24T09:45:00.000Z',
        start: '2026-06-24T09:00:00.000Z',
        end: '2026-06-24T09:45:00.000Z',
        dayKey: '2026-06-24',
        producesArtifact: 'Documented album launch asset inventory with ownership map',
        passEvidence: 'Saved album asset inventory with status, owner, storage location, and next action for each launch asset.',
      }),
      makeBlock({
        title: 'Validate Operation Endgame hard-anchor protection rules',
        label: 'Validate Operation Endgame hard-anchor protection rules',
        displayTitle: 'Validate Operation Endgame hard-anchor protection rules',
        entityLabel: 'Global State Solutions',
        projectLabel: 'Operating System',
        initiativeLabel: 'Operating System',
        laneId: 'studio_operations_system',
        laneLabel: 'Operation Endgame studio operations system',
        workType: 'Validation',
        phaseLabel: 'P1',
        startISO: '2026-06-25T09:00:00.000Z',
        endISO: '2026-06-25T09:45:00.000Z',
        start: '2026-06-25T09:00:00.000Z',
        end: '2026-06-25T09:45:00.000Z',
        dayKey: '2026-06-25',
        producesArtifact: 'Validated hard-anchor rule set',
        passEvidence: 'Written hard-anchor protection checklist linked to fixed anchors, allowed reflow boundaries, and preserved mandatory work.',
      }),
      makeBlock({
        title: 'Validate first-cycle milestone dependency sequence',
        label: 'Validate first-cycle milestone dependency sequence',
        displayTitle: 'Validate first-cycle milestone dependency sequence',
        entityLabel: 'Global State Solutions',
        projectLabel: 'Operating System',
        initiativeLabel: 'Operating System',
        laneId: 'studio_operations_system',
        laneLabel: 'Operation Endgame studio operations system',
        workType: 'Validation',
        phaseLabel: 'P1',
        startISO: '2026-06-26T09:00:00.000Z',
        endISO: '2026-06-26T09:45:00.000Z',
        start: '2026-06-26T09:00:00.000Z',
        end: '2026-06-26T09:45:00.000Z',
        dayKey: '2026-06-26',
        producesArtifact: 'Milestone dependency validation record with confirmed first-cycle sequence',
        passEvidence:
          'Saved milestone dependency validation record showing milestone order, prerequisite links, confirmed handoffs, and blocking gaps.',
      }),
    ],
    fullHorizonPlanQuality: { state: 'trusted', reasonCodes: [] },
    fullHorizonCoverageAudit: { fullHorizonCovered: true },
  };
}

function mutateFirstActiveBlock(reportableState, mutator) {
  const next = clone(reportableState);
  next.activeScheduledBlocks = Array.isArray(next.activeScheduledBlocks) ? next.activeScheduledBlocks : [];
  const first = next.activeScheduledBlocks?.[0];
  if (!first) {
    throw new Error('Expected at least one active scheduled block.');
  }
  mutator(first);
  return next;
}

function buildSingleActiveInput(overrides = {}) {
  const base = buildStandardCompliantCandidateInput();
  const template = clone(base.activeScheduledBlocks[0]);
  const block = {
    ...template,
    ...overrides,
  };
  return {
    ...base,
    activeScheduledBlocks: [block],
  };
}

describe('Operation Endgame standard compliance audit', () => {
  it('shows the current Operation Endgame generated baseline now reaches STANDARD_COMPLIANT without surfaced hard failures or proposal debt', () => {
    const { report } = auditActualOperationEndgame();

    expect(report.verdict).toBe('STANDARD_COMPLIANT');
    expect(report.browserCertificationBlocked).toBe(false);
    expect(report.activeScheduleHardFailures).toEqual([]);
    expect(report.activeScheduledBlocksAudited).toBeGreaterThan(0);
    expect(report.failureCountsByReasonCode).toEqual({});
  });

  it('reaches STANDARD_COMPLIANT only after the generated output contains no surfaced hard failures and no withheld proposal debt', () => {
    const report = runOperationEndgameStandardComplianceAudit(buildStandardCompliantCandidateInput());

    expect(report.activeScheduleHardFailures).toEqual([]);
    expect(report.verdict).toBe('STANDARD_COMPLIANT');
    expect(report.browserCertificationBlocked).toBe(false);
    expect(report.cognitiveSampleState).toBe('STANDARD_COMPLIANT');
  });

  it('representative sample output includes all required fields', () => {
    const { report } = auditActualOperationEndgame();
    const sample = report.representativeSampleReport.samples[0];

    expect(sample).toBeDefined();
    expect(sample.title).toBeTruthy();
    expect(sample.startISO || sample.dayKey).toBeTruthy();
    expect(sample.entityLabel).toBeTruthy();
    expect(sample.projectLabel).toBeTruthy();
    expect(sample.laneLabel).toBeTruthy();
    expect(sample.workType).toBeTruthy();
    expect(sample.phaseLabel).toBeTruthy();
    expect(sample.phaseJustification).not.toBeUndefined();
    expect(sample.meaning).toBeTruthy();
    expect(sample.whyThisExists).toBeTruthy();
    expect(sample.doThis).toBeTruthy();
    expect(sample.doneWhen).toBeTruthy();
    expect(sample.produces).toBeTruthy();
    expect(sample.acceptanceEvidence).toBeTruthy();
    expect(sample.completionAssertion).toBeTruthy();
    expect(Array.isArray(sample.reasonCodes)).toBe(true);
    expect(Array.isArray(sample.cognitiveIssues)).toBe(true);
    expect(sample.admissionStatus).toBeTruthy();
  });

  it('marks representative samples for repair when action, artifact, and evidence collapse into generic filler', () => {
    const report = runOperationEndgameStandardComplianceAudit(
      buildSingleActiveInput({
        title: 'Move launch work forward',
        label: 'Move launch work forward',
        entityLabel: 'Global State Corp.',
        projectLabel: 'Release Engine',
        initiativeLabel: 'Release Engine',
        laneId: 'album_release_engine',
        laneLabel: 'Operation Endgame album release engine',
        workType: 'Execution',
        phaseLabel: 'P1',
      })
    );

    const sample = report.representativeSampleReport.samples[0];
    expect(report.cognitiveSampleState).toBe('REPAIR_REQUIRED');
    expect(sample.cognitiveIssues.length).toBeGreaterThan(0);
  });

  it('blocks browser certification unless the audit verdict is STANDARD_COMPLIANT', () => {
    const { auditInput } = auditActualOperationEndgame();
    const broken = mutateFirstActiveBlock(auditInput, (block) => {
      block.laneId = '';
      block.laneLabel = '';
      block.title = 'Unspecified Initiative';
      block.label = 'Unspecified Initiative';
    });
    const report = runOperationEndgameStandardComplianceAudit(broken);

    expect(report.verdict).not.toBe('STANDARD_COMPLIANT');
    expect(report.browserCertificationBlocked).toBe(true);
  });

  it('fails when an active scheduled block has a hard failure', () => {
    const report = runOperationEndgameStandardComplianceAudit(
      buildSingleActiveInput({
        title: 'Review',
        label: 'Review',
        laneId: '',
        laneLabel: '',
      })
    );

    expect(report.verdict).toBe('REJECT_FOR_BROWSER_CERTIFICATION');
    expect(report.activeScheduleHardFailures.length).toBeGreaterThan(0);
    expect(report.failureCountsByReasonCode.ACTIVE_BLOCK_UNKNOWN_LANE).toBeGreaterThan(0);
  });

  it('fails when a block has missing lane, entity, and project context', () => {
    const report = runOperationEndgameStandardComplianceAudit(
      buildSingleActiveInput({
        title: 'Review',
        label: 'Review',
        laneId: '',
        laneLabel: '',
      })
    );

    expect(report.verdict).toBe('REJECT_FOR_BROWSER_CERTIFICATION');
    expect(report.failureCountsByReasonCode.ACTIVE_BLOCK_UNKNOWN_LANE).toBeGreaterThan(0);
    expect(report.failureCountsByReasonCode.ACTIVE_BLOCK_UNKNOWN_ENTITY).toBeGreaterThan(0);
    expect(report.failureCountsByReasonCode.PROJECT_CONTEXT_MISSING).toBeGreaterThan(0);
  });

  it('fails when Unspecified Initiative appears in the active schedule', () => {
    const report = runOperationEndgameStandardComplianceAudit(
      buildSingleActiveInput({
        title: 'Unspecified Initiative',
        label: 'Unspecified Initiative',
        laneId: '',
        laneLabel: '',
      })
    );

    expect(report.verdict).toBe('REJECT_FOR_BROWSER_CERTIFICATION');
    expect((report.failureCountsByReasonCode.ACTIVE_BLOCK_UNKNOWN_LANE || 0)).toBeGreaterThan(0);
  });

  it('fails when an album block commands recording work despite intake completion', () => {
    const report = runOperationEndgameStandardComplianceAudit(
      buildSingleActiveInput({
        title: 'Record and mix final album masters',
        label: 'Record and mix final album masters',
        laneId: 'creative',
        laneLabel: 'Operation Endgame album release engine',
        phaseLabel: 'P1',
      })
    );

    expect(report.verdict).toBe('REJECT_FOR_BROWSER_CERTIFICATION');
    expect(report.failureCountsByReasonCode.INTAKE_FACT_CONTRADICTION).toBeGreaterThan(0);
  });

  it('fails when a milestone label becomes an execution block', () => {
    const report = runOperationEndgameStandardComplianceAudit(
      buildSingleActiveInput({
        title: 'Stakeholder map created',
        label: 'Stakeholder map created',
        laneId: 'brand',
        laneLabel: 'Operation Endgame studio operations system',
      })
    );

    expect(report.verdict).toBe('REJECT_FOR_BROWSER_CERTIFICATION');
    expect(report.failureCountsByReasonCode.MILESTONE_RENDERED_AS_EXECUTION_BLOCK).toBeGreaterThan(0);
  });

  it('fails when P2/P3 or deferred work enters P1 without explicit phase-energy permission', () => {
    const broken = mutateFirstActiveBlock(buildStandardCompliantCandidateInput(), (block) => {
      block.title = 'Define institution launch charter';
      block.label = 'Define institution launch charter';
      block.phaseLabel = 'P1';
      block.laneId = 'institution';
      block.laneLabel = 'Operation Endgame apprenticeship institution design';
      block.executionContext = { laneFamily: 'institution', laneStatus: 'incubating' };
    });
    const report = runOperationEndgameStandardComplianceAudit(broken);

    expect(report.verdict).toBe('REJECT_FOR_BROWSER_CERTIFICATION');
    expect(report.failureCountsByReasonCode.PHASE_SCOPE_CONFLICT).toBeGreaterThan(0);
    expect(report.failureCountsByReasonCode.DEFERRED_LANE_SCHEDULED_WITHOUT_JUSTIFICATION).toBeGreaterThan(0);
  });

  it('fails when support or runway work is assigned to F8 without doctrine', () => {
    const broken = mutateFirstActiveBlock(buildStandardCompliantCandidateInput(), (block) => {
      block.title = 'Map job-search and income demands against the execution calendar for the energy gym lane';
      block.label = 'Map job-search and income demands against the execution calendar for the energy gym lane';
      block.phaseLabel = 'P1';
      block.laneId = 'energy_gym';
      block.laneLabel = 'F8 Energy Co. energy systems';
      block.executionContext = { laneFamily: 'energy_gym', laneStatus: 'incubating' };
    });
    const report = runOperationEndgameStandardComplianceAudit(broken);

    expect(report.verdict).toBe('REJECT_FOR_BROWSER_CERTIFICATION');
    expect(
      (report.failureCountsByReasonCode.ENTITY_DOCTRINE_UNRESOLVED || 0) +
        (report.failureCountsByReasonCode.PHASE_SCOPE_CONFLICT || 0)
    ).toBeGreaterThan(0);
  });

  it('fails when Tuesday and Wednesday clustering exceeds threshold without explanation', () => {
    const broken = clone(buildStandardCompliantCandidateInput());
    const seedBlocks = clone(broken.activeScheduledBlocks || []);
    while ((broken.activeScheduledBlocks || []).length < 6 && seedBlocks.length > 0) {
      const template = clone(seedBlocks[(broken.activeScheduledBlocks || []).length % seedBlocks.length]);
      broken.activeScheduledBlocks.push({
        ...template,
        title: `${template.title} copy ${(broken.activeScheduledBlocks || []).length + 1}`,
        label: `${template.label} copy ${(broken.activeScheduledBlocks || []).length + 1}`,
      });
    }
    const baseStart = '2026-06-23T09:00:00.000Z';
    const altStart = '2026-06-24T09:00:00.000Z';
    (broken.activeScheduledBlocks || []).forEach((block, index) => {
      const startISO = index % 2 === 0 ? baseStart : altStart;
      const dayKey = startISO.slice(0, 10);
      block.startISO = startISO;
      block.start = startISO;
      block.dayKey = dayKey;
      block.startDayKey = dayKey;
    });
    const report = runOperationEndgameStandardComplianceAudit(broken);

    expect(report.verdict).toBe('REJECT_FOR_BROWSER_CERTIFICATION');
    expect(report.weekdayDistributionRatio).toBeGreaterThanOrEqual(0.75);
    expect(report.failureCountsByReasonCode.SCHEDULE_DISTRIBUTION_CLUSTER_UNJUSTIFIED).toBeGreaterThan(0);
  });

  it('distinguishes forecast debt from active schedule failure', () => {
    const broken = clone(buildStandardCompliantCandidateInput());
    const acceptedOnly = (broken.proposedBlocks || []).filter((block) => block?.status === 'accepted');
    broken.proposedBlocks = acceptedOnly;
    broken.lastPlanError = null;
    broken.fullHorizonPlanQuality = {
      ...(broken.fullHorizonPlanQuality || {}),
      state: 'degraded',
      reasonCodes: ['FORECAST_DEBT_PRESENT'],
    };
    const report = runOperationEndgameStandardComplianceAudit(broken);

    expect(report.activeScheduleHardFailures).toEqual([]);
    expect(report.forecastDebt.fullHorizonPlanQualityState).toBe('degraded');
    expect(report.verdict).toBe('REPAIR_REQUIRED');
  });

  it('treats accepted-only proposal residue as consistent with NO_PROPOSED_BLOCKS', () => {
    const { auditInput } = auditActualOperationEndgame();
    const broken = clone(auditInput);
    broken.proposedBlocks = (broken.proposedBlocks || []).filter((block) => block?.status === 'accepted');
    broken.lastPlanError = {
      code: 'NO_PROPOSED_BLOCKS',
      reason: 'contradiction probe',
      reasonCodes: [],
    };
    const report = runOperationEndgameStandardComplianceAudit(broken);

    expect(report.proposalTrace.state).toBe('no_proposals_generated');
    expect(report.proposalTrace.acceptedCount).toBeGreaterThan(0);
    expect(report.proposalTrace.consistent).toBe(true);
  });

  it('fails when proposal trace claims NO_PROPOSED_BLOCKS while reviewable proposals still exist', () => {
    const { auditInput } = auditActualOperationEndgame();
    const broken = clone(auditInput);
    broken.proposedBlocks = clone(broken.proposedBlocks || []);
    if (broken.proposedBlocks[0]) {
      broken.proposedBlocks[0].status = 'suggested';
    }
    broken.lastPlanError = {
      code: 'NO_PROPOSED_BLOCKS',
      reason: 'contradiction probe',
      reasonCodes: [],
    };
    const report = runOperationEndgameStandardComplianceAudit(broken);

    expect(report.proposalTrace.consistent).toBe(false);
    expect(report.verdict).toBe('REJECT_FOR_BROWSER_CERTIFICATION');
  });

  it('fails browser-reviewed duplicate and plumbing fixtures even when shell output is repaired', () => {
    const base = buildStandardCompliantCandidateInput();
    const fixtureBlocks = [
      {
        ...clone(base.activeScheduledBlocks[0]),
        title: 'Document positioning brief and next outreach move for Operation Endgame brand and operations system',
        label: 'Document positioning brief and next outreach move for Operation Endgame brand and operations system',
        displayTitle: 'Document positioning brief and next outreach move for Operation Endgame brand and operations system',
        entityLabel: 'Global State Solutions',
        projectLabel: 'Operating System',
        initiativeLabel: 'Operating System',
        laneId: 'studio_operations_system',
        laneLabel: 'Operation Endgame studio operations system',
        workType: 'Planning',
        dayKey: '2026-06-23',
        producesArtifact: 'Documented positioning brief and next outreach move for Operation Endgame brand and operations system',
        passEvidence: 'Proof that documented positioning brief and next outreach move for Operation Endgame brand and operations system exists and is linked to the downstream owner.',
      },
      {
        ...clone(base.activeScheduledBlocks[1]),
        title: 'Review stakeholder and partner tracker for Operation Endgame brand and operations system',
        label: 'Review stakeholder and partner tracker for Operation Endgame brand and operations system',
        displayTitle: 'Review stakeholder and partner tracker for Operation Endgame brand and operations system',
        entityLabel: 'Global State Solutions',
        projectLabel: 'Operating System',
        initiativeLabel: 'Operating System',
        laneId: 'studio_operations_system',
        laneLabel: 'Operation Endgame studio operations system',
        workType: 'Planning',
        dayKey: '2026-06-24',
        producesArtifact: 'Reviewed stakeholder and partner tracker for Operation Endgame brand and operations system',
        passEvidence: 'Reviewed stakeholder and partner tracker for Operation Endgame brand and operations system.',
      },
      {
        ...clone(base.activeScheduledBlocks[2]),
        title: 'Document positioning brief and next outreach move for Operation Endgame brand and operations system',
        label: 'Document positioning brief and next outreach move for Operation Endgame brand and operations system',
        displayTitle: 'Document positioning brief and next outreach move for Operation Endgame brand and operations system',
        entityLabel: 'Global State Solutions',
        projectLabel: 'Operating System',
        initiativeLabel: 'Operating System',
        laneId: 'studio_operations_system',
        laneLabel: 'Operation Endgame studio operations system',
        workType: 'Planning',
        dayKey: '2026-06-26',
        producesArtifact: 'Documented positioning brief and next outreach move for Operation Endgame brand and operations system',
        passEvidence: 'Documented positioning brief and next outreach move for Operation Endgame brand and operations system.',
      },
      {
        ...clone(base.activeScheduledBlocks[3]),
        title: 'Define outreach handoff notes for Operation Endgame brand and operations system',
        label: 'Define outreach handoff notes for Operation Endgame brand and operations system',
        displayTitle: 'Define outreach handoff notes for Operation Endgame brand and operations system',
        entityLabel: 'Global State Solutions',
        projectLabel: 'Operating System',
        initiativeLabel: 'Operating System',
        laneId: 'studio_operations_system',
        laneLabel: 'Operation Endgame studio operations system',
        workType: 'Planning',
        dayKey: '2026-06-27',
        acceptanceEvidence:
          'Saved outreach handoff note that explains the next contact, talking point, and open dependency, then link the result to master plan lane-lane-123e4567-e89b-12d3-a456-426614174000.',
      },
    ];
    const report = runOperationEndgameStandardComplianceAudit({
      ...base,
      activeScheduledBlocks: fixtureBlocks,
      proposedBlocks: [],
      forecastBlocks: [],
    });

    expect(report.verdict).toBe('REJECT_FOR_BROWSER_CERTIFICATION');
    expect(report.failureCountsByReasonCode.DUPLICATE_BLOCK_TITLE).toBeGreaterThan(0);
    expect(report.failureCountsByReasonCode.CONJUGATION_SHELL_COMPLIANCE || 0).toBe(0);
    expect(report.failureCountsByReasonCode.PRODUCES_TITLE_SHELL || 0).toBe(0);
    expect(report.failureCountsByReasonCode.FORBIDDEN_SYSTEM_PLUMBING_LANGUAGE).toBeGreaterThan(0);
    expect(report.failureCountsByReasonCode.FORBIDDEN_GENERIC_OWNER_LANGUAGE || 0).toBe(0);
    expect(report.coverageIntegrity.distinctBlockCount).toBeLessThan(fixtureBlocks.length);
  });

  it('prints a backend audit report for the actual Operation Endgame output', () => {
    const { report } = auditActualOperationEndgame();
    const output = formatOperationEndgameStandardAuditReport(report);

    expect(output).toMatch(/Operation Endgame Standard Compliance Audit/);
    expect(output).toMatch(/Final verdict: STANDARD_COMPLIANT/);
    expect(output).toMatch(/Top failure codes:/);
    expect(output).toMatch(/Failures by entity:/);
    expect(output).toMatch(/Failures by project\/program:/);
    expect(output).toMatch(/Representative sample failures:/);
    expect(output).toMatch(/Verdict: STANDARD_COMPLIANT/);
    expect(output).toMatch(/Representative samples:/);
    console.log(`\n${output}`);
  });

  it('exposes a structured repair summary for the next audit-driven plan repair pass', () => {
    const { report } = auditActualOperationEndgame();

    expect(Array.isArray(report.repairSummary.topFailureCodes)).toBe(true);
    expect(Array.isArray(report.repairSummary.failuresByEntity)).toBe(true);
    expect(Array.isArray(report.repairSummary.failuresByProjectProgram)).toBe(true);
    expect(Array.isArray(report.repairSummary.representativeSampleFailures)).toBe(true);
    expect(report.repairSummary.representativeSampleFailures.length).toBeGreaterThanOrEqual(0);
  });
});
