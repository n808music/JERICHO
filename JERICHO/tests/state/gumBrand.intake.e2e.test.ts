/**
 * gumBrand.intake.e2e.test.ts
 *
 * Acceptance test for Prompt 4: Illinois founder, caffeinated functional energy gum,
 * zero capital, 23k Spotify listeners.
 *
 * Acceptance criterion: would a first-time founder in IL with 23k Spotify listeners
 * and $0 know exactly what to do on day 1?
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { callClaudeForActionGraph, callClaudeForSessionPlan } from '../../src/state/mockLLMActionGraph.ts';
import { planQualityAudit, addBusinessDays } from '../../src/domain/goal/planQualityAudit.ts';
import { prePlanFeasibility } from '../../src/domain/goal/prePlanFeasibility.ts';
import { deriveFeasibilitySubstrateLevel } from '../../src/domain/feasibility/feasibilitySubstrateLevel.ts';
import type { StructuredPlanningIntake } from '../../src/domain/goal/StructuredPlanningIntake.ts';

// ---------------------------------------------------------------------------
// Fixture — white_label inferred from zero capital + capitalAcquisitionRequired
// ---------------------------------------------------------------------------

const ILLINOIS_GUM_INTAKE: StructuredPlanningIntake = {
  goalClassification: 'regulated_physical_consumable',
  goalDescription: 'launch a caffeinated functional energy gum brand',
  executionContext: 'full_time',
  weeklyHoursAvailable: 40,
  capitalAvailable: 0,
  capitalCommitmentConfidence: 'uncertain',
  capitalAcquisitionRequired: true,
  capitalAcquisitionAssets: {
    existingAudience: {
      spotifyListeners: 23000,
      instagramFollowers: 0,
      audienceRelationship: 'music_fans_familiar_with_founder',
      influencerNetwork: false,
      entrepreneurNetwork: true,
    },
    existingRevenue: null,
  },
  legalFoundation: {
    existingEntity: true,
    existingEntityType: 'LLC',
    existingEntityState: 'IL',
    existingEntityPurpose: 'music_and_creative_projects',
    gumEntityExists: false,
  },
  // zero capital + capitalAcquisitionRequired → white_label is the inferred pathway
  formulaPathway: 'white_label',
  formulaDirection: { undecided: true },
  targetCategory: 'functional_food',
  distributionChannel: 'direct_to_consumer',
  hardDeadline: null,
  existingDomainRelationships: [],
  blackoutPeriods: [],
  stopCondition: null,
  recommendedTimeline: '15_months',
  employmentStatus: 'voluntarily_unemployed',
  employmentChangeRisk: true,
  timelineSensitivity: 'high',
  industryExperience: 'none',
  location: { state: 'IL', country: 'US' },
  personalProfile: { firstTimeFounder: true },
  startDayKey: '2026-05-01',
  workWindows: null,
};

const GOAL_DRAFT_V2 = {
  executionType: 'BrandLaunch',
  goalLabel: 'Launch caffeinated functional energy gum brand',
  goalText: 'Launch a caffeinated functional energy gum brand',
};

const CONTRACT = {
  executionType: 'BrandLaunch',
  goalText: 'Launch a caffeinated functional energy gum brand',
  terminalOutcome: {
    text: 'Caffeinated energy gum product launched with validated formula, packaging, presale completed, and first real sales.',
    verificationCriteria:
      'Presale campaign closed at or above $8,000 target. Product ships. First cold sale confirmed.',
  },
  startDayKey: '2026-05-01',
  endDayKey: '2027-08-01',
  planningIntake: ILLINOIS_GUM_INTAKE,
};

// ---------------------------------------------------------------------------
// Block builder from sessions (mirrors buildAuditBlocks in planQualityAudit.e2e.test.ts)
// ---------------------------------------------------------------------------

function buildAuditBlocks(sessions: unknown[], actions: unknown[]): unknown[] {
  const metaById = new Map(
    (actions as Array<Record<string, unknown>>).map((a) => [String(a.id || ''), a])
  );
  const datesByAction = new Map<string, string[]>();
  for (const session of sessions as Array<Record<string, unknown>>) {
    const actionId = String(session.actionId || '');
    const date = String(session.date || '');
    if (!actionId || !date) continue;
    if (!datesByAction.has(actionId)) datesByAction.set(actionId, []);
    datesByAction.get(actionId)!.push(date);
  }
  let blockIdx = 0;
  const blocks: unknown[] = [];
  for (const [actionId, dates] of datesByAction) {
    const meta = metaById.get(actionId) || {};
    const sorted = [...dates].sort();
    const firstDate = sorted[0] || '';
    const startISO = firstDate ? `${firstDate}T09:00:00.000Z` : '';
    const blockType = String(meta.blockType || '');
    const minDays = Number(meta.minimumDurationBusinessDays);
    const isCalendarBlock = blockType === 'waiting_period' || blockType === 'capital_checkpoint';
    const endISO =
      isCalendarBlock && startISO && Number.isFinite(minDays) && minDays > 0
        ? (addBusinessDays(startISO, minDays) ?? startISO)
        : startISO;
    blocks.push({
      id: `b${blockIdx++}`,
      title: String((meta.sessionTitles as string[] | undefined)?.[0] || meta.title || actionId),
      actionId: actionId || null,
      startISO,
      endISO,
      blockType: blockType || null,
      waitType: String(meta.waitType || '') || null,
      minimumDurationBusinessDays: Number.isFinite(minDays) && minDays > 0 ? minDays : null,
      requiredWorkFamily: String(meta.requiredWorkFamily || '') || null,
      capitalGateId: String(meta.capitalGateId || '') || null,
      parallelWorkSuggestions: Array.isArray(meta.parallelWorkSuggestions)
        ? (meta.parallelWorkSuggestions as string[])
        : [],
      directDependencyDetails: Array.isArray(meta.dependencyDetails)
        ? (meta.dependencyDetails as Array<{ actionId: string; dependencyType: 'hard_gate' | 'directional' | 'informational' }>)
        : [],
      transitiveDependencyDetails: Array.isArray(meta.dependencyDetails)
        ? (meta.dependencyDetails as Array<{ actionId: string; dependencyType: 'hard_gate' | 'directional' | 'informational' }>)
        : [],
    });
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// Pipeline state — shared across all test blocks
// ---------------------------------------------------------------------------

let graphActions: any[] = [];
let auditResult: ReturnType<typeof planQualityAudit>;

beforeAll(async () => {
  const graphResult = await callClaudeForActionGraph(GOAL_DRAFT_V2, CONTRACT, 'BrandLaunch', 'dev-mock-key');
  if (!graphResult.ok) throw new Error(`Graph failed: ${JSON.stringify(graphResult.error)}`);

  graphActions = graphResult.graph.actions as any[];

  const sessionResult = await callClaudeForSessionPlan(
    {
      goalDraftV2: GOAL_DRAFT_V2,
      contract: CONTRACT,
      executionType: 'BrandLaunch',
      actions: graphActions as Parameters<typeof callClaudeForSessionPlan>[0]['actions'],
      nowISO: '2026-05-01T09:00:00.000Z',
      planningIntake: ILLINOIS_GUM_INTAKE,
    },
    'dev-mock-key'
  );
  if (!sessionResult.ok) throw new Error(`Session plan failed`);

  const sessions = Array.isArray(sessionResult.sessions) ? sessionResult.sessions : [];
  const auditBlocks = buildAuditBlocks(sessions, graphActions);

  auditResult = planQualityAudit({
    intake: ILLINOIS_GUM_INTAKE,
    actions: graphActions,
    blocks: auditBlocks as Parameters<typeof planQualityAudit>[0]['blocks'],
  });
});

// ---------------------------------------------------------------------------
// Box 1–8: feasibility report (sync — no pipeline required)
// ---------------------------------------------------------------------------

describe('feasibility report', () => {
  let report: ReturnType<typeof prePlanFeasibility>;

  beforeAll(() => {
    report = prePlanFeasibility(ILLINOIS_GUM_INTAKE);
  });

  // Box 1
  it('status is VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED', () => {
    expect(report.status).toBe('VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED');
  });

  // Box 2
  it('recommends white_label pathway', () => {
    expect(report.recommendedPathway).toBe('white_label');
  });

  // Box 3
  it('pathwayReasoning explains why custom development is wrong for zero capital', () => {
    expect(report.pathwayReasoning).toMatch(/custom development/i);
    expect(report.pathwayReasoning).toMatch(/white.label/i);
  });

  // Box 4
  it('capitalAcquisitionPath uses presale_campaign as primary strategy', () => {
    expect(report.capitalAcquisitionPath).toBeDefined();
    expect(report.capitalAcquisitionPath!.primaryStrategy).toBe('presale_campaign');
  });

  // Box 5
  it('presaleMath targets $8,000 from 23k listeners at <1% conversion', () => {
    const math = report.capitalAcquisitionPath?.presaleMath;
    expect(math).toBeDefined();
    expect(math!.target).toBe(8000);
    expect(math!.suggestedUnitPrice).toBe(40);
    expect(math!.unitsRequired).toBe(200);
    expect(math!.audienceConversionRequired).toBeLessThan(0.01);
    expect(math!.interpretation).toMatch(/23,000/);
  });

  // Box 6
  it('capitalRequired has all critical phase keys', () => {
    const keys = Object.keys(report.capitalRequired);
    expect(keys).toContain('phase1_entity_and_insurance');
    expect(keys).toContain('phase2_samples');
    expect(keys).toContain('phase3_label_review');
    expect(keys).toContain('phase4_moq_deposit');
  });

  // Box 7
  it('phase3_label_review description calls out Illinois food labeling requirements', () => {
    expect(report.capitalRequired.phase3_label_review.description).toMatch(/illinois/i);
  });

  // Box 8
  it('velocityAsset acknowledges voluntarily unemployed full-time window', () => {
    expect(report.velocityAsset).toBeDefined();
    expect(report.velocityAsset).toMatch(/unemployed/i);
    expect(report.velocityAsset).toMatch(/velocity window/i);
  });
});

// ---------------------------------------------------------------------------
// Box 9–14: action graph — Illinois personalized path
// ---------------------------------------------------------------------------

describe('action graph — Illinois personalized path', () => {
  // Box 9
  it('Illinois gum founder path is selected (40+ personalized actions)', () => {
    expect(graphActions.length).toBeGreaterThanOrEqual(40);
    const ids = graphActions.map((a: any) => String(a?.id || ''));
    expect(ids.some((id) => id.includes('illinois-series-llc') || id.includes('series-llc'))).toBe(true);
  });

  // Box 10
  it('plan includes GRAS status confirmation action', () => {
    const grasAction = graphActions.find(
      (a: any) =>
        String(a?.id || '').includes('gras') ||
        String(a?.title || '').toLowerCase().includes('gras')
    );
    expect(grasAction).toBeDefined();
  });

  // Box 11
  it('plan includes Illinois Series LLC investigation action', () => {
    const seriesAction = graphActions.find(
      (a: any) =>
        String(a?.id || '').includes('series-llc') ||
        String(a?.title || '').toLowerCase().includes('series llc')
    );
    expect(seriesAction).toBeDefined();
  });

  // Box 12
  it('plan includes presale campaign launch with $8,000 acceptance gate', () => {
    // brand:00:26 is the launch action; brand:00:12 is the offer build — only the launch has acceptanceNote
    const presaleLaunchAction = graphActions.find(
      (a: any) =>
        String(a?.id || '').includes('presale-campaign-launch') ||
        /presale campaign launch/i.test(String(a?.title || ''))
    );
    expect(presaleLaunchAction).toBeDefined();
    const noteText = String(presaleLaunchAction?.acceptanceNote || '');
    expect(noteText).toMatch(/8[,.]?000/);
  });

  // Box 13
  it('plan includes first cold sale tracking action', () => {
    const firstSaleAction = graphActions.find(
      (a: any) =>
        String(a?.id || '').includes('first-cold-sale') ||
        String(a?.title || '').toLowerCase().includes('cold sale')
    );
    expect(firstSaleAction).toBeDefined();
  });

  // Box 14
  it('plan has at least one sample_cycle_per_iteration action (white_label minimum)', () => {
    const sampleAction = graphActions.find(
      (a: any) => String(a?.waitType || '') === 'sample_cycle_per_iteration'
    );
    expect(sampleAction).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Box 15–17: audit result
// ---------------------------------------------------------------------------

describe('plan quality audit', () => {
  // Box 15
  it('planQualityAudit has no violations', () => {
    const rules = auditResult.violations.map((v) => v.rule);
    expect(rules, `Unexpected violations: ${JSON.stringify(auditResult.violations)}`).toHaveLength(0);
  });

  // Box 16
  it('planStatus is VALID_AND_FULLY_SCHEDULED', () => {
    expect(
      auditResult.planStatus,
      `Warnings: ${JSON.stringify(auditResult.warnings)}`
    ).toBe('VALID_AND_FULLY_SCHEDULED');
  });

  // Box 17
  it('none of the 5 intake-personalization warnings fire', () => {
    const intakeWarningRules = [
      'SERIES_LLC_NOT_SURFACED',
      'CAPITAL_ACQUISITION_TRACK_MISSING',
      'GRAS_CHECK_MISSING',
      'FIRST_COLD_SALE_MILESTONE_MISSING',
      'EMPLOYMENT_CHANGE_RISK_UNACKNOWLEDGED',
    ];
    const firedRules = auditResult.warnings.map((w) => w.rule);
    for (const rule of intakeWarningRules) {
      expect(firedRules, `Expected ${rule} not to fire`).not.toContain(rule);
    }
  });
});

// ---------------------------------------------------------------------------
// Box 18: feasibility timeline
// ---------------------------------------------------------------------------

describe('feasibility timeline', () => {
  it('standardPathCompletionMonths reflects 15-month recommended timeline', () => {
    const report = prePlanFeasibility(ILLINOIS_GUM_INTAKE);
    expect(report.standardPathCompletionMonths).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// Box 19–21: feasibility substrate level
// ---------------------------------------------------------------------------

describe('feasibility substrate level', () => {
  // Box 19: gum plan at full quality → trusted_feasibility
  it('gum plan substrate is trusted_feasibility (no violations, no warnings, quality gate passed)', () => {
    const planAudit = {
      planStatus: auditResult.planStatus ?? 'VALID_AND_FULLY_SCHEDULED',
      violationCount: auditResult.violations.length,
      warningCount: auditResult.warnings.length,
    };
    const substrate = deriveFeasibilitySubstrateLevel(
      planAudit,
      { status: 'PLAN_QUALITY_PASSED' }
    );
    expect(substrate.level).toBe('trusted_feasibility');
    expect(substrate.feasibilityEligible).toBe(true);
  });

  // Box 20: violations present → withheld
  it('substrate is withheld when plan has violations', () => {
    const substrate = deriveFeasibilitySubstrateLevel(
      { planStatus: 'INVALID_VIOLATIONS_PRESENT', violationCount: 1, warningCount: 0 },
      { status: 'PLAN_QUALITY_PASSED' }
    );
    expect(substrate.level).toBe('withheld');
    expect(substrate.feasibilityEligible).toBe(false);
  });

  // Box 21: quality gate withheld → withheld (even if audit passes)
  it('substrate is withheld when quality gate is PLAN_QUALITY_WITHHELD', () => {
    const substrate = deriveFeasibilitySubstrateLevel(
      { planStatus: 'VALID_AND_FULLY_SCHEDULED', violationCount: 0, warningCount: 0 },
      { status: 'PLAN_QUALITY_WITHHELD' }
    );
    expect(substrate.level).toBe('withheld');
    expect(substrate.feasibilityEligible).toBe(false);
  });
});
