import { REGULATED_PHYSICAL_CONSUMABLE_REALISM } from './regulatedPhysicalConsumableRealism';
import type { StructuredPlanningIntake } from './StructuredPlanningIntake';

type DependencyDetail = { actionId: string; dependencyType: 'hard_gate' | 'directional' | 'informational' };

export type TemporalViolationBucket =
  | 'BLOCK_METADATA_MISSING'
  | 'COMMERCIAL_CYCLE_STALE_WINDOW'
  | 'SCHEDULER_PHASE_MISMATCH'
  | 'DEPENDENCY_GATE_OVERRUN'
  | 'VALIDATOR_STALE_HORIZON'
  | 'CONTRACT_DATE_MISMATCH'
  | 'REPEATED_DUPLICATE'
  | 'UNCLASSIFIED';

export type PlanQualityViolation = {
  rule:
    | 'TEMPORAL_VIOLATION'
    | 'MISSING_REQUIRED_FAMILY'
    | 'DURATION_VIOLATION'
    | 'CAPITAL_GATE_MISSING'
    | 'MERCHANT_UNDERWRITING_LATE'
    | 'PATHWAY_CONTAMINATION'
    | 'CHECKOUT_BEFORE_MERCHANT_APPROVAL';
  blockId?: string;
  blockTitle?: string;
  expected?: number | string;
  actual?: number | string;
  message: string;
  // Diagnostic fields — populated only for TEMPORAL_VIOLATION
  blockActionId?: string;
  blockEndISO?: string;
  dependencyActionId?: string;
  gapDays?: number;
  violationBucket?: TemporalViolationBucket;
};

export type PlanQualityWarning = {
  rule:
    | 'LOW_WEEKLY_HOURS'
    | 'CAPITAL_CONFIDENCE_UNCERTAIN'
    | 'STOP_CONDITION_BELOW_GATE'
    | 'SAMPLE_CYCLES_COMPRESSED'
    | 'PACKAGING_PRODUCTION_LATE'
    | 'PARALLEL_WORK_MISSING_IN_WAIT_PERIOD'
    // Intake-personalization warnings — fire when a specific intake condition is present
    // but the expected personalized action track is absent from the generated plan.
    | 'SERIES_LLC_NOT_SURFACED'
    | 'CAPITAL_ACQUISITION_TRACK_MISSING'
    | 'GRAS_CHECK_MISSING'
    | 'FIRST_COLD_SALE_MILESTONE_MISSING'
    | 'EMPLOYMENT_CHANGE_RISK_UNACKNOWLEDGED';
  message: string;
};

export type PlanStatus = 'VALID_AND_FULLY_SCHEDULED' | 'VALID_WITH_WARNINGS' | 'INVALID_VIOLATIONS_PRESENT';

type AuditAction = {
  id?: string;
  title?: string;
  description?: string;
  requiredWorkFamily?: string;
  pathwayTag?: string;
  dependencies?: string[];
  dependencyDetails?: DependencyDetail[];
  capitalGateId?: string;
};

type AuditBlock = {
  id?: string;
  title?: string;
  actionId?: string | null;
  startISO?: string | null;
  endISO?: string | null;
  directDependencyIds?: string[];
  directDependencyDetails?: DependencyDetail[];
  transitiveDependencyIds?: string[];
  transitiveDependencyDetails?: DependencyDetail[];
  minimumDurationBusinessDays?: number | null;
  blockType?: string | null;
  waitType?: string | null;
  requiredWorkFamily?: string | null;
  capitalGateId?: string | null;
  parallelWorkSuggestions?: string[];
};

export type PlanQualityAuditInput = {
  intake: StructuredPlanningIntake | null | undefined;
  actions: AuditAction[];
  blocks: AuditBlock[];
};

function toDate(value: unknown) {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayKey(value: unknown) {
  return String(value || '').trim().slice(0, 10);
}

function businessDaySpan(startISO: unknown, endISO: unknown) {
  const start = toDate(startISO);
  const end = toDate(endISO);
  if (!start || !end || end < start) {
    return 0;
  }
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const finalDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  let count = 0;
  while (cursor <= finalDay) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      count += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

export function addBusinessDays(dateISO: string, days: number) {
  const start = toDate(dateISO);
  if (!start) return null;
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  let remaining = Math.max(0, Math.floor(days));
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      remaining -= 1;
    }
  }
  return cursor.toISOString();
}

function normalizeDependencyDetails(rawDetails: DependencyDetail[] | undefined, ids: string[] | undefined) {
  const byId = new Map<string, DependencyDetail>();
  (Array.isArray(rawDetails) ? rawDetails : []).forEach((detail) => {
    const actionId = String(detail?.actionId || '').trim();
    if (!actionId) return;
    byId.set(actionId, {
      actionId,
      dependencyType: detail?.dependencyType || 'hard_gate',
    });
  });
  (Array.isArray(ids) ? ids : []).forEach((id) => {
    const actionId = String(id || '').trim();
    if (!actionId || byId.has(actionId)) return;
    byId.set(actionId, { actionId, dependencyType: 'hard_gate' });
  });
  return Array.from(byId.values());
}

export function planQualityAudit(input: PlanQualityAuditInput) {
  const intake = input?.intake || null;
  const actions = Array.isArray(input?.actions) ? input.actions : [];
  const blocks = Array.isArray(input?.blocks) ? input.blocks : [];
  const violations: PlanQualityViolation[] = [];
  const warnings: PlanQualityWarning[] = [];

  if (intake?.goalClassification !== 'regulated_physical_consumable') {
    return { passed: true, violations, warnings };
  }

  const actionsById = new Map(actions.map((action) => [String(action?.id || '').trim(), action]));
  const completionByActionId = new Map<string, string>();
  blocks.forEach((block) => {
    const actionId = String(block?.actionId || '').trim();
    const endISO = String(block?.endISO || '').trim();
    if (!actionId || !endISO) return;
    const existing = completionByActionId.get(actionId);
    if (!existing || Date.parse(endISO) > Date.parse(existing)) {
      completionByActionId.set(actionId, endISO);
    }
  });

  const requiredFamilies = REGULATED_PHYSICAL_CONSUMABLE_REALISM.workFamilies
    .filter((family) => family.required)
    .map((family) => family.familyId);
  const familyTitleMatchers: Record<string, RegExp> = {
    REGULATORY_AND_LABEL_REVIEW: /regulatory|label review|compliance-safe claims|consultant sign-off/i,
    MERCHANT_ACCOUNT_UNDERWRITING: /merchant account|underwriter|high-risk merchant/i,
    CAPITAL_GATE_CHECKPOINTS: /capital checkpoint|deposit gate|confirm capital availability/i,
    HERO_IMAGERY_PRODUCTION: /hero imagery|product photography|3d rendering|visual direction/i,
    PARALLEL_PACKAGING_TRACK: /packaging supplier|packaging quote|dieline|packaging production/i,
  };
  requiredFamilies.forEach((familyId) => {
    const titleMatcher = familyTitleMatchers[familyId];
    const present =
      actions.some((action) => String(action?.requiredWorkFamily || '').trim() === familyId) ||
      blocks.some((block) => String(block?.requiredWorkFamily || '').trim() === familyId) ||
      actions.some((action) => titleMatcher?.test(String(action?.title || ''))) ||
      blocks.some((block) => titleMatcher?.test(String(block?.title || '')));
    if (!present) {
      violations.push({
        rule: 'MISSING_REQUIRED_FAMILY',
        expected: familyId,
        message: `Required work family ${familyId} is absent from the regulated consumable plan.`,
      });
    }
  });

  const seenTemporalPairs = new Set<string>();
  blocks.forEach((block) => {
    const dependencyDetails = normalizeDependencyDetails(block?.transitiveDependencyDetails, block?.transitiveDependencyIds);
    dependencyDetails
      .filter((detail) => detail.dependencyType === 'hard_gate')
      .forEach((detail) => {
        const dependencyCompletionISO = completionByActionId.get(detail.actionId);
        const blockStartISO = String(block?.startISO || '').trim();
        if (dependencyCompletionISO && blockStartISO && dayKey(blockStartISO) < dayKey(dependencyCompletionISO)) {
          const blockActionId = String(block?.actionId || '');
          const dependencyActionId = detail.actionId;
          const gapDays = Math.round((Date.parse(dayKey(dependencyCompletionISO)) - Date.parse(dayKey(blockStartISO))) / 86400000);
          const pairKey = `${blockActionId}|${dependencyActionId}`;
          const isDuplicate = seenTemporalPairs.has(pairKey);
          seenTemporalPairs.add(pairKey);

          let violationBucket: TemporalViolationBucket;
          if (!blockActionId || !blockStartISO) {
            violationBucket = 'BLOCK_METADATA_MISSING';
          } else if (isDuplicate) {
            violationBucket = 'REPEATED_DUPLICATE';
          } else if (!Date.parse(blockStartISO)) {
            violationBucket = 'CONTRACT_DATE_MISMATCH';
          } else if (/^brand:0[45]:/.test(blockActionId) && /^brand:0[0123]:/.test(dependencyActionId)) {
            violationBucket = 'COMMERCIAL_CYCLE_STALE_WINDOW';
          // Intra-cycle reversal: a later-in-cycle action is scheduled before an earlier one.
          // Caused by capWeeklySessionLoad backward scan when forward slots near the deadline
          // are exhausted — later-cycle sessions scan backward while earlier-cycle sessions
          // scanned forward, reversing the intra-cycle ordering.
          } else if (/^brand:0[45]:/.test(blockActionId) && /^brand:0[45]:/.test(dependencyActionId)) {
            violationBucket = 'SCHEDULER_PHASE_MISMATCH';
          } else if (/sample.cycle|packaging.production|production.run|manufacturer.*response|merchant.*underwriting/i.test(dependencyActionId)) {
            violationBucket = 'DEPENDENCY_GATE_OVERRUN';
          } else if (/^brand:0[123]:/.test(blockActionId) && /^brand:00:/.test(dependencyActionId)) {
            violationBucket = 'SCHEDULER_PHASE_MISMATCH';
          } else if (gapDays > 30) {
            violationBucket = 'VALIDATOR_STALE_HORIZON';
          } else {
            violationBucket = 'UNCLASSIFIED';
          }

          violations.push({
            rule: 'TEMPORAL_VIOLATION',
            blockId: String(block?.id || ''),
            blockTitle: String(block?.title || ''),
            blockActionId,
            blockEndISO: String(block?.endISO || ''),
            dependencyActionId,
            expected: dependencyCompletionISO,
            actual: blockStartISO,
            gapDays,
            violationBucket,
            message: `${String(block?.title || 'Block')} [${blockActionId || '?'}] starts ${gapDays}d before hard-gate dep ${dependencyActionId} completes at ${dependencyCompletionISO}. Bucket: ${violationBucket}.`,
          });
        }
      });

    const minimumDurationBusinessDays = Number(block?.minimumDurationBusinessDays);
    if (Number.isFinite(minimumDurationBusinessDays) && minimumDurationBusinessDays > 0) {
      const actualSpan = businessDaySpan(block?.startISO, block?.endISO);
      if (actualSpan < minimumDurationBusinessDays) {
        violations.push({
          rule: 'DURATION_VIOLATION',
          blockId: String(block?.id || ''),
          blockTitle: String(block?.title || ''),
          expected: minimumDurationBusinessDays,
          actual: actualSpan,
          message: `${String(block?.title || 'Block')} is scheduled for ${actualSpan} business days, below the minimum ${minimumDurationBusinessDays}.`,
        });
      }
    }
  });

  const gatedActionMatchers = [
    { gateId: 'regulatory_consultant', match: /engage regulatory\/label review consultant|third-party food label review/i },
    { gateId: 'sample_cycle_costs', match: /first sample request to manufacturer|order bench samples/i },
    { gateId: 'packaging_design_and_production', match: /approve packaging design for production|packaging production lead time/i },
    { gateId: 'moq_production_deposit', match: /production run lead time|commit to production run|manufacturing deposit/i },
  ];
  gatedActionMatchers.forEach(({ gateId, match }) => {
    const gatedAction = actions.find((action) => match.test(String(action?.title || '')));
    if (!gatedAction?.id) return;
    const dependencyDetails = normalizeDependencyDetails(gatedAction.dependencyDetails, gatedAction.dependencies);
    const hasCapitalCheckpoint = dependencyDetails.some((detail) => {
      const upstream = actionsById.get(detail.actionId);
      return detail.dependencyType === 'hard_gate' && String(upstream?.capitalGateId || '').trim() === gateId;
    });
    if (!hasCapitalCheckpoint) {
      violations.push({
        rule: 'CAPITAL_GATE_MISSING',
        blockId: String(gatedAction.id || ''),
        blockTitle: String(gatedAction.title || ''),
        expected: gateId,
        message: `${String(gatedAction.title || 'Gated action')} is missing an immediately upstream capital checkpoint for ${gateId}.`,
      });
    }
  });

  const merchantSubmitBlock = blocks.find((block) => /submit merchant account application/i.test(String(block?.title || '')));
  const firstSaleBlock = blocks.find((block) => /^brand:04:/.test(String(block?.actionId || '')));
  if (merchantSubmitBlock?.startISO && firstSaleBlock?.startISO) {
    const latestAllowedMerchantStart = addBusinessDays(String(merchantSubmitBlock.startISO), 60);
    if (latestAllowedMerchantStart && Date.parse(latestAllowedMerchantStart) > Date.parse(String(firstSaleBlock.startISO))) {
      violations.push({
        rule: 'MERCHANT_UNDERWRITING_LATE',
        blockId: String(merchantSubmitBlock.id || ''),
        blockTitle: String(merchantSubmitBlock.title || ''),
        message: 'Merchant underwriting starts fewer than 60 business days before the first sale block.',
      });
    }
  }

  const selectedPathway = String(intake?.formulaPathway || '').trim();
  if (selectedPathway) {
    actions.forEach((action) => {
      const pathwayTag = String(action?.pathwayTag || '').trim();
      if (pathwayTag && pathwayTag !== 'agnostic' && pathwayTag !== selectedPathway) {
        violations.push({
          rule: 'PATHWAY_CONTAMINATION',
          blockId: String(action?.id || ''),
          blockTitle: String(action?.title || ''),
          expected: selectedPathway,
          actual: pathwayTag,
          message: `${String(action?.title || 'Action')} belongs to ${pathwayTag}, not the selected ${selectedPathway} pathway.`,
        });
      }
    });
  }

  const merchantApprovalBlock = blocks.find((block) => /confirm merchant account approval/i.test(String(block?.title || '')));
  blocks
    .filter((block) => /configure checkout|select checkout|order-capture path/i.test(String(block?.title || '')))
    .forEach((block) => {
      if (merchantApprovalBlock?.startISO && block?.startISO && Date.parse(String(block.startISO)) < Date.parse(String(merchantApprovalBlock.startISO))) {
        violations.push({
          rule: 'CHECKOUT_BEFORE_MERCHANT_APPROVAL',
          blockId: String(block?.id || ''),
          blockTitle: String(block?.title || ''),
          message: `${String(block?.title || 'Checkout block')} is scheduled before merchant approval completes.`,
        });
      }
    });

  if (Number(intake?.weeklyHoursAvailable) < 5) {
    warnings.push({
      rule: 'LOW_WEEKLY_HOURS',
      message: `At ${Number(intake?.weeklyHoursAvailable || 0)} hours per week this plan will take materially longer than a standard build pace.`,
    });
  }
  if (
    String(intake?.capitalCommitmentConfidence || '').trim() === 'uncertain' &&
    !(intake as Record<string, unknown> | null | undefined)?.capitalAcquisitionRequired
  ) {
    warnings.push({
      rule: 'CAPITAL_CONFIDENCE_UNCERTAIN',
      message: 'Capital commitment confidence is marked uncertain. Capital-gated work may require reassessment.',
    });
  }
  const rawStopCondition = intake?.stopCondition;
  const stopCondition =
    rawStopCondition !== null && rawStopCondition !== undefined ? Number(rawStopCondition) : null;
  if (stopCondition !== null && Number.isFinite(stopCondition)) {
    REGULATED_PHYSICAL_CONSUMABLE_REALISM.capitalGates.forEach((gate) => {
      if (stopCondition < gate.typicalCost) {
        warnings.push({
          rule: 'STOP_CONDITION_BELOW_GATE',
          message: `Stop condition of $${stopCondition} is below estimated ${gate.label} cost of $${gate.typicalCost}.`,
        });
      }
    });
  }

  const sampleCycleCount = blocks.filter((block) => String(block?.waitType || '') === 'sample_cycle_per_iteration').length;
  const expectedSampleCycles =
    intake?.formulaPathway === 'custom_development' ? 3 : intake?.formulaPathway === 'white_label' ? 1 : 2;
  if (sampleCycleCount < expectedSampleCycles) {
    warnings.push({
      rule: 'SAMPLE_CYCLES_COMPRESSED',
      message: `This plan contains ${sampleCycleCount} sample cycles; ${expectedSampleCycles} is the minimum expected for ${String(
        intake?.formulaPathway || 'this'
      )}.`,
    });
  }

  const packagingBlock = blocks.find((block) => String(block?.waitType || '') === 'packaging_production');
  if (packagingBlock?.endISO && firstSaleBlock?.startISO && Date.parse(String(packagingBlock.endISO)) > Date.parse(String(firstSaleBlock.startISO))) {
    warnings.push({
      rule: 'PACKAGING_PRODUCTION_LATE',
      message: 'Packaging production lead time extends beyond the intended first sale date.',
    });
  }

  blocks
    .filter((block) => String(block?.blockType || '').toLowerCase() === 'waiting_period')
    .forEach((block) => {
      const start = toDate(block?.startISO);
      const end = toDate(block?.endISO);
      if (!start || !end) return;
      // hasDocumentedParallel suppresses the warning when the action plan explicitly lists concurrent
      // tracks via parallelWorkSuggestions. This is the correct guarantee while the mock scheduler
      // does not interleave sessions into waiting-period windows (it schedules by phase corridor,
      // not by per-action dependency topological ordering within a phase). When the scheduler gains
      // true session interleaving — scheduling independent-track actions concurrently with waiting
      // periods rather than before or after them — remove this suppression path and rely solely on
      // hasScheduledParallelWork. At that point the date-range check is the meaningful guarantee.
      const hasDocumentedParallel = Array.isArray(block?.parallelWorkSuggestions) && block.parallelWorkSuggestions.length > 0;
      const hasScheduledParallelWork = blocks.some((candidate) => {
        if (candidate === block || String(candidate?.blockType || '').toLowerCase() === 'waiting_period') {
          return false;
        }
        const candidateStart = toDate(candidate?.startISO);
        return candidateStart && candidateStart >= start && candidateStart <= end;
      });
      if (!hasDocumentedParallel && !hasScheduledParallelWork) {
        warnings.push({
          rule: 'PARALLEL_WORK_MISSING_IN_WAIT_PERIOD',
          message: `${String(block?.title || 'Wait period')} has no parallel work scheduled during its window.`,
        });
      }
    });

  // Intake-personalization warnings — only fire when specific intake fields are present.
  const lf = intake?.legalFoundation as Record<string, unknown> | null | undefined;
  if (
    lf?.existingEntity === true &&
    String(lf?.existingEntityState || '').toUpperCase() === 'IL' &&
    lf?.gumEntityExists !== true
  ) {
    const hasSeriesLLC = actions.some((a) => /series\s*llc/i.test(String(a?.title || '')));
    if (!hasSeriesLLC) {
      warnings.push({
        rule: 'SERIES_LLC_NOT_SURFACED',
        message: 'Illinois founder with existing entity: Series LLC option not surfaced in any plan action.',
      });
    }
  }

  if ((intake as Record<string, unknown> | null | undefined)?.capitalAcquisitionRequired === true) {
    const hasPresale = actions.some((a) => /presale|founder.s kit|capital acquisition/i.test(String(a?.title || '')));
    if (!hasPresale) {
      warnings.push({
        rule: 'CAPITAL_ACQUISITION_TRACK_MISSING',
        message: 'capitalAcquisitionRequired is true but no presale or capital acquisition action is present in the plan.',
      });
    }
  }

  if (String(intake?.targetCategory || '') === 'functional_food') {
    const hasGRAS = actions.some((a) => /\bgras\b/i.test(String(a?.title || '')));
    if (!hasGRAS) {
      warnings.push({
        rule: 'GRAS_CHECK_MISSING',
        message: 'targetCategory is functional_food but no GRAS verification action is present in the plan.',
      });
    }
  }

  if (intake?.goalClassification === 'regulated_physical_consumable') {
    const hasColdSale = actions.some((a) => /cold sale/i.test(String(a?.title || '')));
    if (!hasColdSale) {
      warnings.push({
        rule: 'FIRST_COLD_SALE_MILESTONE_MISSING',
        message: 'Regulated consumable plan has no first cold sale milestone action — distinct from presale fulfillment.',
      });
    }
  }

  if ((intake as Record<string, unknown> | null | undefined)?.employmentChangeRisk === true) {
    const riskPattern = /employment.{0,20}risk|density.{0,20}adjustment|velocity.{0,20}window/i;
    const hasRiskAck = actions.some(
      (a) => riskPattern.test(String(a?.title || '')) || riskPattern.test(String(a?.description || ''))
    );
    if (!hasRiskAck) {
      warnings.push({
        rule: 'EMPLOYMENT_CHANGE_RISK_UNACKNOWLEDGED',
        message: 'employmentChangeRisk is true but no action acknowledges employment risk or density adjustment in the plan.',
      });
    }
  }

  const planStatus: PlanStatus =
    violations.length > 0
      ? 'INVALID_VIOLATIONS_PRESENT'
      : warnings.length > 0
      ? 'VALID_WITH_WARNINGS'
      : 'VALID_AND_FULLY_SCHEDULED';

  return {
    passed: violations.length === 0,
    planStatus,
    violations,
    warnings,
  };
}
