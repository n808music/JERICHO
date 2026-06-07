import { applyScheduleValidityProjection } from './scheduleValidityProjection.js';
import { applyArtifactDependencyIntegrity } from './artifactDependencyIntegrity.js';
import { CROSS_LANE_DEPENDENCIES } from './crossLaneArtifactDependencies.js';
import { defaultOwnerForLaneFamily } from './ownerLabels.js';

export function applyCrossLaneArtifactDependencies(blocks, lanes = []) {
  // Build laneId → canonical family map from lane.domain. Domain values are
  // single tokens ('income', 'capital'); CROSS_LANE_DEPENDENCIES uses suffixed
  // names ('income_stream', 'capital_real_estate'). Map between them.
  const DOMAIN_TO_FAMILY = {
    product: 'product_software',
    software: 'product_software',
    creative: 'creative_media',
    media: 'media_channel',
    brand: 'company_operations',
    operations: 'company_operations',
    company: 'company_operations',
    income: 'income_stream',
    revenue: 'income_stream',
    capital: 'capital_real_estate',
    institution: 'institution_education',
    civic: 'civic_development',
  };
  const laneIdToFamily = new Map();
  for (const lane of lanes) {
    const d = String(lane?.domain || '').toLowerCase();
    const family = DOMAIN_TO_FAMILY[d] || null;
    if (lane?.id && family) laneIdToFamily.set(lane.id, family);
    if (lane?.laneId && family) laneIdToFamily.set(lane.laneId, family);
  }
  function familyForBlock(b) {
    return laneIdToFamily.get(b.laneId) || null;
  }
  const byKey = new Map();
  for (const b of blocks) {
    const family = familyForBlock(b);
    if (!family) continue;
    const stageKey = b.lifecycleStage || b.commercialStage;
    if (!stageKey) continue;
    const key = `${family}|${b.phaseLabel}|${stageKey}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(b);
  }

  const compareBlockOrder = (left, right) => {
    const leftDay = String(left?.dayKey || left?.date || '');
    const rightDay = String(right?.dayKey || right?.date || '');
    if (leftDay !== rightDay) return leftDay.localeCompare(rightDay);
    const leftStart = String(left?.startISO || left?.start || '');
    const rightStart = String(right?.startISO || right?.start || '');
    if (leftStart !== rightStart) return leftStart.localeCompare(rightStart);
    return String(left?.id || '').localeCompare(String(right?.id || ''));
  };

  for (const consumer of blocks) {
    const consumerFamily = familyForBlock(consumer);
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
    const nextConsumed = Array.isArray(consumer.consumedArtifactIds) ? [...consumer.consumedArtifactIds] : [];
    const nextDeps = Array.isArray(consumer.dependsOnBlockIds) ? [...consumer.dependsOnBlockIds] : [];
    for (const dep of matchingDeps) {
      const upstreamKeys = dep.upstreamStage
        ? [`${dep.upstreamFamily}|P1|${dep.upstreamStage}`, `${dep.upstreamFamily}|P2|${dep.upstreamStage}`, `${dep.upstreamFamily}|P3|${dep.upstreamStage}`]
        : Array.from(byKey.keys()).filter((key) => key.startsWith(`${dep.upstreamFamily}|`));
      const upstreamCandidates = upstreamKeys.flatMap((key) => byKey.get(key) || []);
      const earlierCandidates = upstreamCandidates
        .filter((candidate) => compareBlockOrder(candidate, consumer) < 0)
        .sort(compareBlockOrder);
      const upstream = earlierCandidates[earlierCandidates.length - 1] || null;
      const upstreamArtifactId = String(upstream?.outputArtifactId || '').trim();
      if (upstream && upstreamArtifactId && !nextConsumed.includes(upstreamArtifactId)) {
        nextConsumed.push(upstreamArtifactId);
        if (!nextDeps.includes(upstream.id)) nextDeps.push(upstream.id);
      }
    }
    consumer.consumedArtifactIds = nextConsumed;
    consumer.dependsOnBlockIds = nextDeps;
  }
  return blocks;
}

function mkId(planId, phaseLabel, laneId, dayKey, idx) {
  return `fh-${planId || 'plan'}-${phaseLabel || 'phase'}-${laneId || 'lane'}-${dayKey}-${idx}`;
}

function clampKey(key) {
  return String(key || '').slice(0, 10);
}

function maxDayKey(left, right) {
  if (!left) return right || null;
  if (!right) return left || null;
  return left > right ? left : right;
}

function minDayKey(left, right) {
  if (!left) return right || null;
  if (!right) return left || null;
  return left < right ? left : right;
}

function nextDayKey(dayKey, days) {
  const d = new Date(`${dayKey}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Day-of-week offset from Monday (ISO week). Used for workday rotation.
const DOW_OFFSET_FROM_MON = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };

/**
 * Place a block on a specific workday within the ISO week that contains `cursor`,
 * rotating through `workDays` by `rotationIdx`. If the rotated day falls before
 * `cursor` (backward placement), advance one week so time only moves forward.
 */
function placementDayForBlock(cursor, workDays, rotationIdx) {
  if (!workDays || workDays.length === 0) return cursor;
  const d = new Date(`${cursor}T12:00:00.000Z`);
  const utcDow = d.getUTCDay(); // 0=Sun, 1=Mon, …, 6=Sat
  const daysToMon = utcDow === 0 ? -6 : 1 - utcDow;
  const monDate = new Date(d);
  monDate.setUTCDate(d.getUTCDate() + daysToMon);
  const targetDow = workDays[Math.abs(rotationIdx) % workDays.length];
  const offsetFromMon = DOW_OFFSET_FROM_MON[targetDow] ?? 0;
  const targetDate = new Date(monDate);
  targetDate.setUTCDate(monDate.getUTCDate() + offsetFromMon);
  let placementKey = targetDate.toISOString().slice(0, 10);
  if (placementKey < cursor) {
    targetDate.setUTCDate(targetDate.getUTCDate() + 7);
    placementKey = targetDate.toISOString().slice(0, 10);
  }
  return placementKey;
}

function hasWord(text, pattern) {
  return new RegExp(`\\b${pattern}\\b`, 'i').test(String(text || ''));
}

function inferLaneFamily(lane) {
  const domain = String(lane?.domain || '')
    .trim()
    .toLowerCase();
  const title = String(lane?.title || lane?.laneTitle || '')
    .trim()
    .toLowerCase();

  if (domain === 'product' || hasWord(title, 'app') || title.includes('software')) return 'product_software';
  if (domain === 'creative' || title.includes('album') || title.includes('release') || title.includes('music')) {
    return 'creative_media';
  }
  if (domain === 'media' || title.includes('podcast') || title.includes('content')) return 'media_channel';
  if (domain === 'brand' || title.includes('company') || title.includes('operations') || title.includes('studio')) {
    return 'company_operations';
  }
  if (domain === 'income' || title.includes('income') || title.includes('revenue') || title.includes('services')) {
    return 'income_stream';
  }
  if (domain === 'capital' || domain === 'real_estate' || title.includes('real estate') || title.includes('property')) {
    return 'capital_real_estate';
  }
  if (domain === 'institution' || domain === 'education' || title.includes('institution') || title.includes('education')) {
    return 'institution_education';
  }
  if (domain === 'civic' || title.includes('district') || title.includes('civic') || title.includes('community')) {
    return 'civic_development';
  }
  return domain || 'general';
}

function getLaneTitle(lane) {
  return lane?.title || lane?.laneTitle || 'primary lane';
}

function getLaneLabel(lane) {
  const family = inferLaneFamily(lane);
  const labels = {
    product_software: 'product/software lane',
    creative_media: 'creative project lane',
    media_channel: 'media/content lane',
    company_operations: 'company/operations lane',
    income_stream: 'income stream lane',
    capital_real_estate: 'capital/real-estate lane',
    institution_education: 'institution/education lane',
    civic_development: 'civic/district lane',
    general: 'primary lane',
  };
  return labels[family] || labels.general;
}

function getPhaseLaneStatus(phase, lane) {
  const laneId = lane?.id || lane?.laneId || null;
  const participation = (phase?.laneParticipation || []).find((item) => item?.laneId === laneId);
  const phaseStatus = String(participation?.status || '').trim().toLowerCase();
  const laneStatus = String(lane?.activationState || 'active').trim().toLowerCase();
  // Phase-level participation can demote a lane's status (active → gated when
  // upstream proof isn't ready in this phase), but it cannot promote a lane
  // whose own activationState says incubating/blocked — that promotion would
  // bypass the lane's own preconditions (e.g., capital availability).
  if ((laneStatus === 'incubating' || laneStatus === 'blocked') && phaseStatus === 'active') {
    return laneStatus;
  }
  return phaseStatus || laneStatus || 'active';
}

function inferPlanOrientation(plan) {
  const text = [plan?.successStandard, plan?.outcomeTarget, plan?.northStarOutcome, plan?.coreMission]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/\bsingle profitable product\b|\bsingle product line\b|\bsingle-product\b/.test(text)) {
    return 'single_product';
  }
  if (/\becosystem\b|\bmulti-lane\b|\bdistrict\b|\binstitution\b/.test(text)) {
    return 'ecosystem';
  }
  return 'balanced';
}

function isSupportExpansionLane(laneFamily) {
  return ['capital_real_estate', 'institution_education', 'civic_development'].includes(laneFamily);
}

function resolveCadenceDays(phaseLabel, laneStatus, planOrientation, laneFamily, dayKey, horizonEndDayKey) {
  const narrowSupportLane = planOrientation === 'single_product' && isSupportExpansionLane(laneFamily);

  if (phaseLabel === 'P1') {
    if (narrowSupportLane) return 28;
    if (laneStatus === 'gated' || laneStatus === 'dependent') return 14;
    return 7;
  }
  if (phaseLabel === 'P2') {
    if (narrowSupportLane) return laneStatus === 'gated' || laneStatus === 'dependent' ? 75 : 60;
    if (laneStatus === 'gated') return 30;
    if (planOrientation === 'single_product' && !['product_software', 'income_stream', 'company_operations'].includes(laneFamily)) {
      return 42;
    }
    return 14;
  }
  if (phaseLabel === 'P3') {
    if (narrowSupportLane) return 60;
    if (laneStatus === 'gated') return 90;
    const remainingDays = dayKey && horizonEndDayKey ? Math.max(0, Math.round((new Date(`${horizonEndDayKey}T12:00:00.000Z`) - new Date(`${dayKey}T12:00:00.000Z`)) / (1000 * 60 * 60 * 24))) : null;
    if (remainingDays !== null) {
      if (remainingDays <= 180) return 12;
      if (remainingDays <= 365) return 14;
      if (remainingDays <= 730) return 20;
    }
    if (planOrientation === 'single_product' && ['institution_education', 'civic_development'].includes(laneFamily)) {
      return 120;
    }
    return 30;
  }
  return 30;
}

function resolveTimeEstimateMinutes(blockType) {
  switch (blockType) {
    case 'gate':
    case 'review':
    case 'terminal-readiness':
      return 90;
    case 'audit':
    case 'validation':
    case 'readiness':
      return 75;
    default:
      return 60;
  }
}

function parseDayKey(dayKey) {
  const value = clampKey(dayKey);
  return value ? new Date(`${value}T12:00:00.000Z`) : null;
}

function formatMonthYear(dayKey) {
  const date = parseDayKey(dayKey);
  if (!date) {
    return 'current review window';
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatQuarterYear(dayKey) {
  const date = parseDayKey(dayKey);
  if (!date) {
    return 'current quarter';
  }
  return `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`;
}

function getReviewWindowLabel(phaseLabel, dayKey) {
  if (phaseLabel === 'P3') {
    return formatQuarterYear(dayKey);
  }
  return formatMonthYear(dayKey);
}

function getOccurrenceFocusOptions(family, phaseLabel, laneTitle) {
  const genericLane = laneTitle || 'this lane';
  const byFamily = {
    product_software: {
      P1: [
        'beta onboarding proof',
        'launch blocker clearance',
        'activation instrumentation coverage',
        'first-user feedback evidence',
      ],
      P2: [
        'first-cohort completion data',
        'activation-to-retention evidence',
        'release instrumentation quality',
        'support-friction evidence',
        'conversion threshold proof',
        'repeat usage evidence',
      ],
      P3: [
        'delegation control coverage',
        'scale-entry risk controls',
        'terminal product evidence',
        'operating-system resilience proof',
      ],
    },
    creative_media: {
      P1: [
        'release asset completion',
        'audience-capture proof',
        'distribution readiness',
        'post-launch conversion evidence',
      ],
      P2: [
        'catalog replay evidence',
        'merch-to-listener conversion proof',
        'creative spend efficiency data',
        'repeat release-system evidence',
      ],
      P3: [
        'long-tail monetization proof',
        'catalog resilience evidence',
        'terminal creative package quality',
        'delegated release-system evidence',
      ],
    },
    media_channel: {
      P1: [
        'distribution consistency proof',
        'capture-to-conversion bridge evidence',
        'anchor-story alignment',
        'editorial cadence readiness',
      ],
      P2: [
        'audience growth loop data',
        'episode completion evidence',
        'sponsor-readiness proof',
        'cross-channel conversion evidence',
      ],
      P3: [
        'scale distribution resilience',
        'delegated editorial controls',
        'terminal audience evidence',
        'partner-system durability',
      ],
    },
    company_operations: {
      P1: [
        'operator checklist coverage',
        'handoff rhythm proof',
        'meeting-control discipline',
        'execution risk controls',
      ],
      P2: [
        'dashboard review discipline',
        'delegation bottleneck evidence',
        'staffing gate readiness',
        'cross-lane operating cadence proof',
      ],
      P3: [
        'delegation readiness evidence',
        'systemization durability',
        'scale-governance controls',
        'terminal operating-system evidence',
      ],
    },
    income_stream: {
      P1: [
        'cashflow protection proof',
        'offer bridge viability',
        'urgent revenue signal',
        'runway protection evidence',
      ],
      P2: [
        'margin-readiness evidence',
        'repeatable close-rate proof',
        'conversion quality threshold',
        'offer-system durability',
      ],
      P3: [
        'scale economics evidence',
        'delegated revenue controls',
        'terminal monetization package',
        'recurring revenue resilience',
      ],
    },
    capital_real_estate: {
      P1: [
        'capital-readiness prerequisites',
        'property-action gate dependencies',
        'financing blocker evidence',
        'proof-before-expansion controls',
      ],
      P2: [
        'acquisition thesis evidence',
        'financing prerequisite quality',
        'asset-readiness proof',
        'capital stack viability',
      ],
      P3: [
        'scale-entry gate evidence',
        'terminal capital-readiness proof',
        'asset expansion controls',
        'risk-managed financing path',
      ],
    },
    institution_education: {
      P1: [
        'institution model assumptions',
        'legal prerequisite proof',
        'proof-before-charter controls',
        'program dependency mapping',
      ],
      P2: [
        'program viability evidence',
        'partner-readiness proof',
        'operating charter quality',
        'curriculum system readiness',
      ],
      P3: [
        'institutional scale-readiness',
        'delegated program governance',
        'terminal institutional evidence',
        'charter durability controls',
      ],
    },
    civic_development: {
      P1: [
        'credibility dependency map',
        'coalition prerequisite proof',
        'capital-before-district controls',
        'public-trust dependencies',
      ],
      P2: [
        'district opportunity criteria',
        'coalition-readiness evidence',
        'public-interest proof quality',
        'partner viability controls',
      ],
      P3: [
        'civic scale-readiness',
        'terminal coalition evidence',
        'delegated district governance',
        'public-partnership durability',
      ],
    },
    general: {
      P1: [`${genericLane} proof sequence`],
      P2: [`${genericLane} operating cadence`],
      P3: [`${genericLane} terminal evidence`],
    },
  };

  return byFamily[family]?.[phaseLabel] || byFamily.general[phaseLabel] || byFamily.general.P2;
}

function getArtifactLabel(family, phaseLabel, blockType, laneTitle) {
  const genericLane = laneTitle || 'this lane';
  const byFamily = {
    product_software: {
      P1: 'launch-proof packet',
      P2: blockType === 'audit' ? 'funnel audit memo' : 'conversion operating brief',
      P3: 'terminal product evidence package',
    },
    creative_media: {
      P1: 'release-proof packet',
      P2: 'creative conversion brief',
      P3: 'terminal creative evidence package',
    },
    media_channel: {
      P1: 'distribution proof log',
      P2: 'audience operating brief',
      P3: 'terminal media evidence package',
    },
    company_operations: {
      P1: 'operator control sheet',
      P2: 'operating cadence brief',
      P3: 'terminal operating-system package',
    },
    income_stream: {
      P1: 'revenue protection brief',
      P2: 'conversion margin brief',
      P3: 'terminal revenue evidence package',
    },
    capital_real_estate: {
      P1: 'capital gate memo',
      P2: 'asset-readiness brief',
      P3: 'terminal capital-readiness package',
    },
    institution_education: {
      P1: 'institution dependency brief',
      P2: 'program viability brief',
      P3: 'terminal institutional evidence package',
    },
    civic_development: {
      P1: 'coalition dependency brief',
      P2: 'district-readiness brief',
      P3: 'terminal civic evidence package',
    },
    general: {
      P1: `${genericLane} proof brief`,
      P2: `${genericLane} operating brief`,
      P3: `${genericLane} terminal brief`,
    },
  };

  return byFamily[family]?.[phaseLabel] || byFamily.general[phaseLabel] || `${genericLane} evidence package`;
}

function decorateDescriptorForOccurrence({ descriptor, phaseLabel, lane, dayKey, idx }) {
  const laneTitle = getLaneTitle(lane);
  const family = inferLaneFamily(lane);
  const reviewWindow = getReviewWindowLabel(phaseLabel, dayKey);
  const focusOptions = getOccurrenceFocusOptions(family, phaseLabel, laneTitle);
  const focus = focusOptions[idx % focusOptions.length] || `${laneTitle} evidence`;
  const artifact = getArtifactLabel(family, phaseLabel, descriptor.blockType, laneTitle);
  const titleWindowLabel =
    phaseLabel === 'P3' ? `${reviewWindow} scale review window` : `${reviewWindow} review window`;

  // RTG Finding 2: descriptor.expectedOutput may be a noun phrase ("revenue
  // protection brief") or a sentence/clause ("Direct expansion gate with unmet
  // dependencies"). Concatenating " Deliver X with Y…" onto a clause produces
  // garbled text downstream (especially in gate criteria). Detect the shape and
  // either replace (clause case) or extend (noun case) so the resulting
  // expectedOutput reads as a single sentence.
  const baseOutput = String(descriptor.expectedOutput || '').trim();
  const looksLikeSentenceShell = /\s(gate|review|audit)\b/i.test(baseOutput) && /^[A-Z]/.test(baseOutput);
  const deliverableSentence = `Deliver ${artifact} with ${focus}, explicit owner, and next gate timing for ${reviewWindow}.`;
  const decoratedOutput = looksLikeSentenceShell ? deliverableSentence : `${baseOutput}. ${deliverableSentence}`;

  return {
    ...descriptor,
    title: `${descriptor.title} using ${focus} for the ${titleWindowLabel}`,
    expectedOutput: decoratedOutput,
    derivationReason: `${descriptor.derivationReason} Occurrence tuned to ${focus} for ${reviewWindow}.`,
  };
}

function createDescriptor({ phaseLabel, lane, laneStatus, planOrientation }) {
  const laneTitle = getLaneTitle(lane);
  const laneLabel = getLaneLabel(lane);
  const family = inferLaneFamily(lane);
  // Gating filter: any lane that lacks the conditions for direct execution
  // (gated/dependent on upstream proof, or still incubating its preconditions,
  // or explicitly blocked) drops action-type descriptors. Pre-Phase-5 the
  // descriptor pools for these families were already readiness/audit/gate-only,
  // so the filter rarely fired; Phase 5 added BD-mechanic actions to several
  // pools, so the filter must now recognize 'incubating' and 'blocked' too.
  const gated =
    laneStatus === 'gated'
    || laneStatus === 'dependent'
    || laneStatus === 'incubating'
    || laneStatus === 'blocked';
  const narrowPlan = planOrientation === 'single_product';

  const byFamily = {
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
      P3: [
        [`Review scale-readiness controls for ${laneTitle} in P3 product/software lane`, 'review', 'Scale-readiness review with delegation constraints', 'p3_product_scale_readiness_controls'],
        [`Validate terminal product evidence for ${laneTitle} against success standard`, 'terminal-readiness', 'Terminal product evidence summary tied to success standard', 'p3_product_terminal_evidence'],
        [`Stress-test retention and conversion durability for ${laneTitle} in P3 product/software lane`, 'audit', 'Retention and conversion durability test with failure modes', 'p3_product_retention_durability'],
        [`Package product proof for capital and institution review for ${laneTitle}`, 'action', 'Product proof package prepared for downstream capital and institution review', 'p3_product_proof_packaging'],
        [`Reconcile unresolved product blockers for ${laneTitle} before horizon close`, 'review', 'Resolved product blocker register with owners and deadlines', 'p3_product_blocker_reconciliation'],
        [`Confirm operating handoff readiness for ${laneTitle} in P3 product/software lane`, 'readiness', 'Operating handoff readiness decision with support coverage', 'p3_product_handoff_readiness'],
        [`Define automation and delegation coverage for ${laneTitle} to sustain scale without key-person dependency`, 'action', 'Automation and delegation brief with coverage map, escalation paths, and handoff schedule', 'p3_product_automation_delegation'],
        [`Build repeatable operating dashboard for ${laneTitle} tracking scale signals and owner accountability`, 'action', 'Operating dashboard spec with KPIs, owner assignments, and decision triggers', 'p3_product_operating_dashboard'],
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
      ],
    },
    creative_media: {
      P1: [
        [`Sequence release asset completion for ${laneTitle} in P1 creative project lane`, 'milestone', 'Release asset list with dated ownership'],
        [`Review audience-capture proof after ${laneTitle} anchor in creative project lane`, 'review', 'Audience-capture proof memo and next-cycle ask'],
        [`Validate post-release conversion loop for ${laneTitle} in P1 creative project lane`, 'validation', 'Validated post-release conversion loop'],
        [`Produce next release asset increment for ${laneTitle} in P1 creative project lane`, 'action', 'Release asset increment produced and ready for distribution'],
        [`Ship distribution push for ${laneTitle} in P1 creative project lane`, 'action', 'Distribution push executed with reach metrics captured'],
      ],
      P2: [
        [`Assess catalog conversion cadence for ${laneTitle} in P2 creative project lane`, 'audit', 'Catalog conversion audit with repeatability score'],
        [`Define operating-system handoff for ${laneTitle} in P2 creative project lane`, 'action', 'Operating-system handoff plan for recurring releases'],
        [`Evaluate gate for additional creative spend in ${laneTitle} until proof quality improves`, 'gate', 'Creative spend gate decision with evidence threshold'],
      ],
      P3: [
        [`Review long-tail audience monetization readiness for ${laneTitle} in P3 creative project lane`, 'readiness', 'Long-tail monetization readiness decision', 'p3_creative_monetization_readiness'],
        [`Validate terminal creative-proof package for ${laneTitle} against success standard`, 'terminal-readiness', 'Terminal creative-proof package with evidence index', 'p3_creative_terminal_proof'],
        [`Audit catalog conversion durability for ${laneTitle} in P3 creative project lane`, 'audit', 'Catalog conversion durability audit with replay risks', 'p3_creative_catalog_durability'],
        [`Package creative and IP proof for institutional leverage for ${laneTitle}`, 'action', 'Creative and IP proof package organized for institutional leverage', 'p3_creative_ip_packaging'],
        [`Reconcile release-to-demand evidence for ${laneTitle} before terminal review`, 'review', 'Release-to-demand evidence reconciled with remaining demand gaps', 'p3_creative_release_demand_reconciliation'],
        [`Confirm post-release operating cadence for ${laneTitle} in P3 creative project lane`, 'validation', 'Post-release operating cadence validated for long-tail execution', 'p3_creative_operating_cadence'],
        [`Produce scale-cycle release asset for ${laneTitle} in P3 creative project lane`, 'action', 'Scale-cycle release asset produced with distribution path defined', 'p3_creative_scale_release_asset'],
        [`Ship long-tail monetization activation for ${laneTitle} in P3 creative project lane`, 'action', 'Long-tail monetization activation shipped with revenue tracking enabled', 'p3_creative_longtail_monetization'],
      ],
    },
    media_channel: {
      P1: [
        [
          `Plan content pipeline proof sequence for ${laneTitle} in P1 media/content lane`,
          'action',
          'Content proof sequence mapped to anchor dates',
          null,
          {
            sequencingRole: 'content_pipeline_proof',
            dependencyGate: 'offer_clarity',
            evidenceRequired: 'offer_clarity',
            isProofSeeking: true,
            isExpansionAction: false,
            isScaleAction: false,
          },
        ],
        [
          `Audit distribution consistency for ${laneTitle} in P1 media/content lane`,
          'audit',
          'Distribution consistency audit with weak points',
          null,
          {
            sequencingRole: 'distribution_proof',
            dependencyGate: 'offer_clarity',
            evidenceRequired: 'offer_clarity',
            isProofSeeking: true,
            isExpansionAction: false,
            isScaleAction: false,
          },
        ],
        [
          `Validate capture-to-conversion bridge for ${laneTitle} in P1 media/content lane`,
          'validation',
          'Capture-to-conversion bridge with measurable targets',
          null,
          {
            sequencingRole: 'offer_bridge_proof',
            dependencyGate: 'offer_clarity',
            evidenceRequired: 'offer_clarity',
            isProofSeeking: true,
            isExpansionAction: false,
            isScaleAction: false,
          },
        ],
        [`Publish next content episode or post for ${laneTitle} in P1 media/content lane`, 'action', 'Content episode or post published with distribution channel and reach baseline'],
        [`Run distribution push to grow audience for ${laneTitle} in P1 media/content lane`, 'action', 'Distribution push executed with reach metrics and conversion signal captured'],
        [`Collect audience feedback signals for ${laneTitle} in P1 media/content lane`, 'action', 'Audience feedback signals captured with response themes and follow-up backlog'],
      ],
      P2: [
        [`Review repeatable audience growth loop for ${laneTitle} in P2 media/content lane`, 'review', 'Audience growth loop review with stop/continue decisions'],
        [`Define editorial operating cadence for ${laneTitle} in P2 media/content lane`, 'action', 'Editorial operating cadence with roles and recurrence'],
        [`Assess sponsor or partner readiness for ${laneTitle} in P2 media/content lane`, 'readiness', 'Sponsor readiness decision tied to proof data'],
        [`Publish next content series increment for ${laneTitle} in P2 media/content lane`, 'action', 'Content series increment published with distribution and reach plan'],
        [`Ship audience growth experiment for ${laneTitle} in P2 media/content lane`, 'action', 'Audience growth experiment shipped with measurement window and decision criteria'],
      ],
      P3: [
        [
          `Audit scale distribution resilience for ${laneTitle} in P3 media/content lane`,
          'audit',
          'Scale distribution resilience audit',
          'p3_media_distribution_resilience',
          {
            sequencingRole: 'distribution_scale_action',
            dependencyGate: 'offer_clarity',
            evidenceRequired: 'offer_clarity',
            isProofSeeking: false,
            isExpansionAction: true,
            isScaleAction: true,
          },
        ],
        [`Validate terminal media-proof package for ${laneTitle} against outcome target`, 'terminal-readiness', 'Terminal media-proof package mapped to outcome target', 'p3_media_terminal_proof'],
        [`Stress-test audience-to-demand conversion for ${laneTitle} in P3 media/content lane`, 'validation', 'Audience-to-demand conversion stress test with weak-point list', 'p3_media_conversion_stress_test'],
        [`Package narrative channel proof for ${laneTitle} before terminal review`, 'action', 'Narrative channel proof package assembled for terminal review', 'p3_media_channel_packaging'],
        [`Reconcile sponsor and partner readiness for ${laneTitle} in P3 media/content lane`, 'review', 'Sponsor and partner readiness reconciled with outstanding blockers', 'p3_media_partner_readiness'],
        [`Confirm editorial operating continuity for ${laneTitle} through horizon close`, 'readiness', 'Editorial operating continuity decision with delegated owner coverage', 'p3_media_editorial_continuity'],
        [`Publish scale-cycle content increment for ${laneTitle} in P3 media/content lane`, 'action', 'Scale-cycle content increment published with distribution and reach metrics', 'p3_media_scale_content_increment'],
        [`Activate sponsor or partner monetization for ${laneTitle} in P3 media/content lane`, 'action', 'Sponsor or partner monetization activated with contract terms recorded', 'p3_media_sponsor_activation'],
      ],
    },
    company_operations: {
      P1: [
        [`Define operator checklist for ${laneTitle} in P1 company/operations lane`, 'action', 'Operator checklist with owner coverage'],
        [`Review execution risk controls for ${laneTitle} in P1 company/operations lane`, 'review', 'Execution risk controls review with fixes'],
        [`Validate meeting and handoff rhythm for ${laneTitle} in P1 company/operations lane`, 'validation', 'Meeting and handoff rhythm validated against active work'],
        [`Implement next operating-system control for ${laneTitle} in P1 company/operations lane`, 'action', 'Operating-system control implemented with owner, trigger, and escalation path'],
        [`Ship tooling upgrade for ${laneTitle} in P1 company/operations lane`, 'action', 'Tooling upgrade landed with rollback plan and adoption checklist'],
      ],
      P2: [
        [`Audit operating-system bottlenecks for ${laneTitle} in P2 company/operations lane`, 'audit', 'Operating-system bottleneck audit'],
        [`Evaluate gate for staffing or contractor expansion in ${laneTitle} until proof is stable`, 'gate', 'Expansion gate with staffing criteria'],
        [`Define dashboard review cadence for ${laneTitle} in P2 company/operations lane`, 'action', 'Dashboard cadence and decision protocol'],
        [`Implement bottleneck-clearing change for ${laneTitle} in P2 company/operations lane`, 'action', 'Bottleneck-clearing operating change shipped with metric baseline'],
        [`Establish delegation runbook for ${laneTitle} in P2 company/operations lane`, 'action', 'Delegation runbook shipped with owner mapping and decision rights'],
      ],
      P3: [
        [`Assess delegation readiness for ${laneTitle} in P3 company/operations lane`, 'readiness', 'Delegation readiness decision with missing controls', 'p3_ops_delegation_readiness'],
        [`Validate terminal operating-system evidence for ${laneTitle} against success standard`, 'terminal-readiness', 'Terminal operating-system evidence mapped to success standard', 'p3_ops_terminal_evidence'],
        [`Stress-test operator capacity for ${laneTitle} in P3 company/operations lane`, 'audit', 'Operator capacity stress test with escalation paths', 'p3_ops_capacity_stress_test'],
        [`Package SOP and control proof for ${laneTitle} before terminal review`, 'action', 'SOP and control proof package prepared for terminal review', 'p3_ops_sop_packaging'],
        [`Reconcile handoff risks for ${laneTitle} across the operating system`, 'review', 'Handoff risk register reconciled with mitigations and owners', 'p3_ops_handoff_reconciliation'],
        [`Confirm review cadence durability for ${laneTitle} in P3 company/operations lane`, 'validation', 'Review cadence durability validated against delegated operating load', 'p3_ops_cadence_durability'],
        [`Execute scale-cycle operating change for ${laneTitle} in P3 company/operations lane`, 'action', 'Scale-cycle operating change executed with adoption metrics and rollback path', 'p3_ops_scale_operating_change'],
        [`Implement delegation handoff for ${laneTitle} in P3 company/operations lane`, 'action', 'Delegation handoff implemented with owner training and shadow period', 'p3_ops_delegation_handoff'],
      ],
    },
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
      P2: [
        [`Audit repeatable conversion signals for ${laneTitle} in P2 income stream lane`, 'audit', 'Repeatable conversion audit with proof thresholds'],
        [`Assess margin-readiness for ${laneTitle} in P2 income stream lane`, 'readiness', 'Margin-readiness decision and next revisions'],
        [`Evaluate gate for expansion of ${laneTitle} until revenue quality clears criteria`, 'gate', 'Revenue quality gate with criteria outcome'],
        [`Execute scaled outreach to broader prospect cohort for ${laneTitle} in P2 income stream lane`, 'action', 'Scaled outreach campaign with cohort size, conversion rate, and follow-up cadence', null, { isExternalBdMechanic: true, isExternalStakeholderTouchpoint: true }],
        [`Finalize recurring or expansion contract for ${laneTitle} in P2 income stream lane`, 'action', 'Recurring or expansion contract finalized with scope, term, and pricing', null, { isExternalBdMechanic: true, isExternalStakeholderTouchpoint: true }],
      ],
      P3: [
        [`Review scale economics for ${laneTitle} in P3 income stream lane`, 'review', 'Scale economics review mapped to horizon target', 'p3_income_scale_economics'],
        [`Validate terminal revenue evidence for ${laneTitle} against outcome target`, 'terminal-readiness', 'Terminal revenue evidence package', 'p3_income_terminal_evidence'],
        [`Stress-test margin durability for ${laneTitle} in P3 income stream lane`, 'audit', 'Margin durability stress test with correction plan', 'p3_income_margin_durability'],
        [`Package recurring revenue proof for ${laneTitle} before terminal review`, 'action', 'Recurring revenue proof package assembled for terminal review', 'p3_income_recurring_revenue_packaging'],
        [`Reconcile cashflow risk for ${laneTitle} across the scale window`, 'review', 'Cashflow risk reconciled with downside scenarios and safeguards', 'p3_income_cashflow_reconciliation'],
        [`Confirm repeatable conversion system for ${laneTitle} in P3 income stream lane`, 'validation', 'Repeatable conversion system validated against final-horizon targets', 'p3_income_conversion_system'],
        [`Define margin protection and revenue diversification plan for ${laneTitle} in P3 income stream lane`, 'action', 'Margin protection brief with diversification priorities, risk floor targets, and owner cadence', 'p3_income_margin_protection'],
      ],
    },
    capital_real_estate: {
      P1: [
        [
          `Define capital-readiness criteria for ${laneTitle} in P1 capital/real-estate lane`,
          'readiness',
          'Capital-readiness criteria with blocked dependencies',
          null,
          {
            sequencingRole: 'capital_readiness_research',
            prerequisiteType: 'conversion_evidence',
            dependencyGate: 'conversion_evidence',
            evidenceRequired: 'conversion_evidence',
            isReadinessOnly: true,
            isExpansionAction: false,
            isScaleAction: false,
          },
        ],
        [
          `Audit dependency gates before property action for ${laneTitle} in capital/real-estate lane`,
          'audit',
          'Dependency gate audit before direct action',
          null,
          {
            sequencingRole: 'capital_dependency_audit',
            prerequisiteType: 'conversion_evidence',
            dependencyGate: 'conversion_evidence',
            evidenceRequired: 'conversion_evidence',
            isReadinessOnly: true,
            isExpansionAction: false,
            isScaleAction: false,
          },
        ],
        [
          `Evaluate gate for direct expansion in ${laneTitle} until proof, capital, and operations clear`,
          'gate',
          'Direct expansion gate with unmet dependencies',
          null,
          {
            sequencingRole: 'capital_expansion_gate',
            prerequisiteType: 'conversion_evidence',
            dependencyGate: 'conversion_evidence',
            evidenceRequired: 'conversion_evidence',
            isReadinessOnly: true,
            isExpansionAction: false,
            isScaleAction: false,
          },
        ],
        [
          `Draft capital budget memo for ${laneTitle} in P1 capital/real-estate lane`,
          'readiness',
          'Capital budget memo with $ amount or range per candidate path, or explicit unknown-budget flag requiring resolution',
          null,
          { isExternalBdMechanic: true, commercialStage: 'capital_memo' },
        ],
        [
          `Build investor or lender prospect list for ${laneTitle} in P1 capital/real-estate lane`,
          'readiness',
          'Investor/lender/partner prospect list with at least 10 named targets and channel of contact',
          null,
          { isExternalBdMechanic: true, commercialStage: 'target_list' },
        ],
        [
          `Submit outreach to funding or stakeholder targets for ${laneTitle} in P1 capital/real-estate lane`,
          'readiness',
          'Outreach log to investor/lender/partner targets with reply status and next-step commitment',
          null,
          { isExternalBdMechanic: true, isExternalStakeholderTouchpoint: true, commercialStage: 'outreach_batch' },
        ],
          [`Define capital target segment and ICP for ${laneTitle} in P1 capital/real-estate lane`, 'readiness', 'ICP and target segment brief for capital partners', null, { commercialStage: 'segment_definition' }],
          [`Define capital target criteria with disqualification rules for ${laneTitle}`, 'readiness', 'Target criteria document with disqualification rules for capital sourcing', null, { commercialStage: 'target_criteria' }],
          [`Source candidate capital partners and lenders for ${laneTitle} P1 pipeline`, 'readiness', 'Capital partner source list with channel notes', null, { commercialStage: 'lead_sourcing' }],
          [`Build capital outreach asset set (memo, deck, brief) for ${laneTitle}`, 'readiness', 'Capital outreach asset set reviewed for tone and target alignment', null, { commercialStage: 'outreach_asset' }],
          [`Draft capital readiness memo with traction evidence for ${laneTitle}`, 'readiness', 'Capital readiness memo citing traction artifacts', null, { commercialStage: 'proposal_prep' }],
      ],
      P2: [
        [
          `Review acquisition thesis quality for ${laneTitle} in P2 capital/real-estate lane`,
          'review',
          'Acquisition thesis review with evidence requirements',
          null,
          {
            sequencingRole: 'acquisition_thesis_development',
            prerequisiteType: 'conversion_evidence',
            dependencyGate: 'conversion_evidence',
            evidenceRequired: 'conversion_evidence',
            isReadinessOnly: true,
            isExpansionAction: false,
            isScaleAction: false,
          },
        ],
        [
          `Validate financing prerequisites for ${laneTitle} in P2 capital/real-estate lane`,
          'validation',
          'Financing prerequisites checklist with pass/fail status',
          null,
          {
            sequencingRole: 'financing_prerequisite_review',
            prerequisiteType: 'conversion_evidence',
            dependencyGate: 'conversion_evidence',
            evidenceRequired: 'conversion_evidence',
            isReadinessOnly: true,
            isExpansionAction: false,
            isScaleAction: false,
          },
        ],
        [
          `Assess asset-readiness for ${laneTitle} before widening capital commitment`,
          'readiness',
          'Asset-readiness decision tied to capital proof',
          null,
          {
            sequencingRole: 'asset_readiness_review',
            prerequisiteType: 'conversion_evidence',
            dependencyGate: 'conversion_evidence',
            evidenceRequired: 'conversion_evidence',
            isReadinessOnly: true,
            isExpansionAction: false,
            isScaleAction: false,
          },
        ],
        [`Draft preliminary capital memo for ${laneTitle} in P2 capital/real-estate lane`, 'readiness', 'Preliminary capital memo with $ amount or range, financing path options, and risk model'],
        [`Run lender or partner discovery for ${laneTitle} in P2 capital/real-estate lane`, 'readiness', 'Lender or partner discovery notes with capital appetite and term ranges', null, { isExternalBdMechanic: true, isExternalStakeholderTouchpoint: true, commercialStage: 'discovery' }],
        [`Update asset shortlist for ${laneTitle} in P2 capital/real-estate lane`, 'readiness', 'Updated asset shortlist with deal scoring, capital fit, and next-step owner'],
          [`Qualify candidate capital partners for ${laneTitle} P2 pipeline`, 'readiness', 'Capital partner qualification scorecard', null, { commercialStage: 'qualification' }],
          [`Run discovery conversation with qualified capital partner for ${laneTitle}`, 'readiness', 'Discovery notes from capital partner conversation', null, { commercialStage: 'discovery_call' }],
          [`Run needs analysis on qualified ${laneTitle} capital partner`, 'readiness', 'Needs analysis with prioritized partner requirements', null, { commercialStage: 'needs_analysis' }],
          [`Assemble capital diligence packet for ${laneTitle} qualified partner`, 'readiness', 'Capital diligence packet with answers to standard partner questions', null, { commercialStage: 'diligence_packet' }],
      ],
      P3: [
        [`Audit scale-entry gates for ${laneTitle} in P3 capital/real-estate lane`, 'audit', 'Scale-entry gate audit with unresolved constraints', 'p3_capital_scale_entry_gates'],
        [`Validate terminal capital-readiness evidence for ${laneTitle} against success standard`, 'terminal-readiness', 'Terminal capital-readiness evidence package', 'p3_capital_terminal_evidence'],
        [`Stress-test financing prerequisites for ${laneTitle} in P3 capital/real-estate lane`, 'validation', 'Financing prerequisites stress test with blocked dependencies', 'p3_capital_financing_prerequisites'],
        [`Package acquisition and capital proof for ${laneTitle} before terminal review`, 'review', 'Acquisition and capital proof package prepared for terminal review', 'p3_capital_proof_packaging'],
        [`Reconcile risk controls for ${laneTitle} across the capital path`, 'review', 'Capital-path risk controls reconciled with owner coverage', 'p3_capital_risk_reconciliation'],
        [`Confirm capital deployment readiness for ${laneTitle} in P3 capital/real-estate lane`, 'readiness', 'Capital deployment readiness decision with remaining gating criteria', 'p3_capital_deployment_readiness'],
        [`Execute capital deployment for ${laneTitle} in P3 capital/real-estate lane`, 'action', 'Capital deployment executed with $ amount, asset path, and counterparty recorded', 'p3_capital_deployment_execution'],
        [`Finalize first acquisition or asset commitment for ${laneTitle} in P3 capital/real-estate lane`, 'action', 'Acquisition or asset commitment closed with signed terms and capital committed', 'p3_capital_first_acquisition'],
        [`Run acquired asset operating cadence for ${laneTitle} in P3 capital/real-estate lane`, 'action', 'Acquired asset operating cadence run with revenue, cost, and risk reporting on schedule', 'p3_capital_asset_operations'],
          [`Prepare capital proposal with terms for ${laneTitle} P3 partner pipeline`, 'action', 'Capital proposal draft with scope, terms, and pricing', null, { commercialStage: 'proposal_prep' }],
          [`Execute follow-up cadence with ${laneTitle} P3 capital pipeline`, 'action', 'Capital follow-up tracker with next-touch dates', null, { commercialStage: 'follow_up' }],
          [`Close capital decision with ${laneTitle} P3 qualified partner`, 'action', 'Capital close decision recorded with terms and start date', null, { commercialStage: 'close_decision' }],
          [`Update capital pipeline status for ${laneTitle} P3 cycle`, 'review', 'Capital pipeline report with stage transitions', null, { commercialStage: 'crm_pipeline_update' }],
      ],
    },
    institution_education: {
      P1: [
        [`Define institution model assumptions for ${laneTitle} in P1 institution/education lane`, 'action', 'Institution model assumptions with gating list'],
        [`Review legal and operating prerequisites for ${laneTitle} in institution/education lane`, 'review', 'Prerequisite review with blocked items'],
        [`Evaluate gate for early execution in ${laneTitle} until proof and capital dependencies clear`, 'gate', 'Early execution gate with explicit dependencies'],
        [`Map stakeholders and partner targets for ${laneTitle} in P1 institution/education lane`, 'readiness', 'Stakeholder map with named partner/agency targets, decision authority, and access path', null, { isExternalBdMechanic: true }],
        [`Submit meeting requests to partner targets for ${laneTitle} in P1 institution/education lane`, 'readiness', 'Meeting request log with target list, reply status, and scheduled discovery sessions', null, { isExternalBdMechanic: true, isExternalStakeholderTouchpoint: true }],
        [`Draft pilot scope or partnership proposal for ${laneTitle} in P1 institution/education lane`, 'readiness', 'Pilot scope or partnership proposal with deliverables, term, and signature path', null, { isExternalBdMechanic: true, isExternalStakeholderTouchpoint: true }],
          [`Define ${laneTitle} institutional target segment and ICP`, 'readiness', 'Institutional ICP and target segment brief', null, { commercialStage: 'segment_definition' }],
          [`Qualify ${laneTitle} institutional partners against pilot criteria`, 'readiness', 'Institutional partner qualification scorecard', null, { commercialStage: 'qualification' }],
          [`Prepare ${laneTitle} institutional pilot proposal with scope and terms`, 'readiness', 'Institutional pilot proposal with scope and terms', null, { commercialStage: 'proposal_prep' }],
      ],
      P2: [
        [`Audit curriculum or program viability for ${laneTitle} in P2 institution/education lane`, 'audit', 'Program viability audit with next experiments'],
        [`Assess partner-readiness for ${laneTitle} in P2 institution/education lane`, 'readiness', 'Partner-readiness decision with dependency status'],
        [`Validate operating charter for ${laneTitle} in P2 institution/education lane`, 'validation', 'Operating charter aligned to proof data'],
        [`Run pilot program iteration for ${laneTitle} in P2 institution/education lane`, 'action', 'Pilot program iteration run with enrollment data and outcome metrics captured', null, { isExternalStakeholderTouchpoint: true }],
        [`Finalize partnership terms with institutional counterparty for ${laneTitle} in P2 institution/education lane`, 'action', 'Signed partnership terms with institutional counterparty including scope and term', null, { isExternalBdMechanic: true, isExternalStakeholderTouchpoint: true }],
        [`Revise pilot curriculum or program design for ${laneTitle} in P2 institution/education lane`, 'action', 'Pilot curriculum or program design iterated with feedback and next-version delivery plan'],
          [`Define ${laneTitle} institutional target segment and ICP`, 'readiness', 'Institutional ICP and target segment brief', null, { commercialStage: 'segment_definition' }],
          [`Qualify ${laneTitle} institutional partners against pilot criteria`, 'readiness', 'Institutional partner qualification scorecard', null, { commercialStage: 'qualification' }],
          [`Prepare ${laneTitle} institutional pilot proposal with scope and terms`, 'readiness', 'Institutional pilot proposal with scope and terms', null, { commercialStage: 'proposal_prep' }],
      ],
      P3: [
        [`Review institutional scale-readiness for ${laneTitle} in P3 institution/education lane`, 'review', 'Institutional scale-readiness review', 'p3_institution_scale_readiness'],
        [`Validate terminal institutional evidence for ${laneTitle} against outcome target`, 'terminal-readiness', 'Terminal institutional evidence package', 'p3_institution_terminal_evidence'],
        [`Stress-test program and partner viability for ${laneTitle} in P3 institution/education lane`, 'audit', 'Program and partner viability stress test with gating gaps', 'p3_institution_program_viability'],
        [`Package operating charter proof for ${laneTitle} before terminal review`, 'review', 'Operating charter proof package assembled for terminal review', 'p3_institution_charter_packaging'],
        [`Reconcile compliance and legitimacy risks for ${laneTitle} across P3`, 'review', 'Compliance and legitimacy risks reconciled with evidence owners', 'p3_institution_compliance_reconciliation'],
        [`Confirm institution launch readiness for ${laneTitle} in P3 institution/education lane`, 'readiness', 'Institution launch readiness decision with open prerequisites noted', 'p3_institution_launch_readiness'],
        [`Launch institution program cohort for ${laneTitle} in P3 institution/education lane`, 'action', 'Institution program cohort launched with enrollment, curriculum delivery, and outcomes plan', 'p3_institution_cohort_launch'],
        [`Execute scale partnership agreement for ${laneTitle} in P3 institution/education lane`, 'action', 'Scale partnership agreement executed with deliverables and milestone schedule', 'p3_institution_scale_partnership'],
        [`Run institution outcome measurement cycle for ${laneTitle} in P3 institution/education lane`, 'action', 'Institution outcome measurement cycle run with student or beneficiary outcomes reported', 'p3_institution_outcome_measurement'],
          [`Define ${laneTitle} institutional target segment and ICP`, 'readiness', 'Institutional ICP and target segment brief', null, { commercialStage: 'segment_definition' }],
          [`Qualify ${laneTitle} institutional partners against pilot criteria`, 'readiness', 'Institutional partner qualification scorecard', null, { commercialStage: 'qualification' }],
          [`Prepare ${laneTitle} institutional pilot proposal with scope and terms`, 'readiness', 'Institutional pilot proposal with scope and terms', null, { commercialStage: 'proposal_prep' }],
      ],
    },
    civic_development: {
      P1: [
        [`Map credibility dependencies for ${laneTitle} in P1 civic/district lane`, 'action', 'Credibility dependency map for later activation'],
        [`Review coalition prerequisites for ${laneTitle} in civic/district lane`, 'review', 'Coalition prerequisite review with blocked paths'],
        [`Evaluate gate for direct district execution in ${laneTitle} until proof and capital stack exist`, 'gate', 'Direct district execution gate with unmet prerequisites'],
        [`Map agency and coalition targets for ${laneTitle} in P1 civic/district lane`, 'readiness', 'Agency and coalition target list with named contacts, decision authority, and access path', null, { isExternalBdMechanic: true }],
        [`Submit meeting requests to agency or coalition targets for ${laneTitle} in P1 civic/district lane`, 'readiness', 'Meeting request log with reply status and scheduled discovery sessions', null, { isExternalBdMechanic: true, isExternalStakeholderTouchpoint: true }],
        [`Draft partnership or pilot proposal for ${laneTitle} in P1 civic/district lane`, 'readiness', 'Partnership or pilot proposal with public-interest case, deliverables, and signature path', null, { isExternalBdMechanic: true, isExternalStakeholderTouchpoint: true }],
          [`Define ${laneTitle} civic stakeholder target segment and criteria`, 'readiness', 'Civic stakeholder segment and target criteria brief', null, { commercialStage: 'segment_definition' }],
          [`Qualify ${laneTitle} civic partners against engagement criteria`, 'readiness', 'Civic partner qualification scorecard', null, { commercialStage: 'qualification' }],
          [`Draft ${laneTitle} civic partnership proposal with scope and outcomes`, 'readiness', 'Civic partnership proposal with scope and outcomes', null, { commercialStage: 'proposal_prep' }],
      ],
      P2: [
        [`Audit district opportunity criteria for ${laneTitle} in P2 civic/district lane`, 'audit', 'District opportunity criteria audit'],
        [`Assess coalition-readiness for ${laneTitle} in P2 civic/district lane`, 'readiness', 'Coalition-readiness decision with partner gaps'],
        [`Validate public-interest case for ${laneTitle} in P2 civic/district lane`, 'validation', 'Public-interest case validated against strategy'],
        [`Run pilot civic engagement for ${laneTitle} in P2 civic/district lane`, 'action', 'Pilot civic engagement run with stakeholder turnout and outcome notes captured', null, { isExternalStakeholderTouchpoint: true }],
        [`Finalize coalition memorandum for ${laneTitle} in P2 civic/district lane`, 'action', 'Coalition memorandum negotiated with partners and signed terms recorded', null, { isExternalBdMechanic: true, isExternalStakeholderTouchpoint: true }],
        [`Revise public-interest case for ${laneTitle} in P2 civic/district lane`, 'action', 'Public-interest case iterated with stakeholder feedback and decision-maker review notes'],
          [`Define ${laneTitle} civic stakeholder target segment and criteria`, 'readiness', 'Civic stakeholder segment and target criteria brief', null, { commercialStage: 'segment_definition' }],
          [`Qualify ${laneTitle} civic partners against engagement criteria`, 'readiness', 'Civic partner qualification scorecard', null, { commercialStage: 'qualification' }],
          [`Draft ${laneTitle} civic partnership proposal with scope and outcomes`, 'readiness', 'Civic partnership proposal with scope and outcomes', null, { commercialStage: 'proposal_prep' }],
      ],
      P3: [
        [`Review civic scale-readiness for ${laneTitle} in P3 civic/district lane`, 'review', 'Civic scale-readiness review with dependency status', 'p3_civic_scale_readiness'],
        [`Validate terminal civic evidence for ${laneTitle} against success standard`, 'terminal-readiness', 'Terminal civic evidence package', 'p3_civic_terminal_evidence'],
        [`Stress-test coalition durability for ${laneTitle} in P3 civic/district lane`, 'audit', 'Coalition durability stress test with risk conditions', 'p3_civic_coalition_durability'],
        [`Package public-interest proof for ${laneTitle} before terminal review`, 'review', 'Public-interest proof package assembled for terminal review', 'p3_civic_public_interest_packaging'],
        [`Reconcile partner and risk gates for ${laneTitle} across the civic path`, 'review', 'Partner and risk gates reconciled with remaining blockers', 'p3_civic_partner_gate_reconciliation'],
        [`Confirm civic execution readiness for ${laneTitle} in P3 civic/district lane`, 'readiness', 'Civic execution readiness decision with prerequisite coverage', 'p3_civic_execution_readiness'],
        [`Execute civic scale initiative for ${laneTitle} in P3 civic/district lane`, 'action', 'Civic scale initiative executed with public outcome metrics and partner reporting', 'p3_civic_scale_initiative'],
        [`Finalize coalition memorandum or pilot agreement for ${laneTitle} in P3 civic/district lane`, 'action', 'Coalition memorandum or pilot agreement signed with deliverables and accountability', 'p3_civic_coalition_signed'],
        [`Deploy civic operating cadence for ${laneTitle} in P3 civic/district lane`, 'action', 'Civic operating cadence deployed with stakeholder reporting and review schedule', 'p3_civic_operating_cadence'],
          [`Define ${laneTitle} civic stakeholder target segment and criteria`, 'readiness', 'Civic stakeholder segment and target criteria brief', null, { commercialStage: 'segment_definition' }],
          [`Qualify ${laneTitle} civic partners against engagement criteria`, 'readiness', 'Civic partner qualification scorecard', null, { commercialStage: 'qualification' }],
          [`Draft ${laneTitle} civic partnership proposal with scope and outcomes`, 'readiness', 'Civic partnership proposal with scope and outcomes', null, { commercialStage: 'proposal_prep' }],
      ],
    },
    general: {
      P1: [[`Define P1 proof sequence for ${laneTitle} in ${laneLabel}`, 'action', 'P1 proof sequence with ordered milestones, dependencies, and completion criteria for each phase goal', 'p1_general_proof_sequence']],
      P2: [[`Review P2 operating cadence for ${laneTitle} in ${laneLabel}`, 'review', 'P2 operating cadence review with stop/continue decisions and owner coverage', 'p2_general_operating_cadence']],
      P3: [
        [`Review terminal readiness for ${laneTitle} in ${laneLabel}`, 'review', 'Terminal readiness review with final evidence checklist and gap summary', 'p3_general_terminal_readiness'],
        [`Validate terminal evidence for ${laneTitle} in ${laneLabel}`, 'terminal-readiness', 'Terminal evidence package with success-standard comparison and horizon close decision', 'p3_general_terminal_evidence'],
        [`Package final proof for ${laneTitle} in ${laneLabel}`, 'action', 'Final proof package with outcome evidence, success-standard comparison, and horizon close decision', 'p3_general_final_proof_packaging'],
        [`Confirm handoff readiness for ${laneTitle} in ${laneLabel}`, 'readiness', 'Handoff readiness decision with delegated owner coverage and support gaps noted', 'p3_general_handoff_readiness'],
      ],
    },
  };

  let descriptors = (byFamily[family] || byFamily.general)[phaseLabel] || byFamily.general[phaseLabel] || [];

  if (gated) {
    descriptors = descriptors.filter((item) => item[1] !== 'action');
  }

  if (narrowPlan && ['institution_education', 'civic_development', 'capital_real_estate'].includes(family)) {
    descriptors = descriptors.filter((item) => item[1] !== 'action').slice(0, 1);
  }

  const supportException = laneStatus !== 'active' ? ` This occurrence is generated for a support lane with ${laneStatus} status and preserves documented density exception.` : '';

  // Phase 6 — interleave action-class descriptors with review-class descriptors
  // so round-robin scheduling never produces 4+ consecutive review-class blocks
  // without action interleaving. Original descriptor order is preserved within
  // each class; only the cross-class interleaving order changes.
  const ACTION_CLASS = new Set(['action', 'milestone']);
  const actions = descriptors.filter((d) => ACTION_CLASS.has(d[1]));
  const others = descriptors.filter((d) => !ACTION_CLASS.has(d[1]));
  if (actions.length > 0 && others.length > 0) {
    const ratio = others.length / actions.length;
    const reviewsPerActionSegment = Math.max(1, Math.ceil(ratio));
    const interleaved = [];
    let oi = 0;
    for (const act of actions) {
      interleaved.push(act);
      for (let k = 0; k < reviewsPerActionSegment && oi < others.length; k++) {
        interleaved.push(others[oi++]);
      }
    }
    while (oi < others.length) interleaved.push(others[oi++]);
    descriptors = interleaved;
  }

  return descriptors.map(([title, blockType, expectedOutput, titleFamily = null, sequencing = {}]) => ({
    title,
    blockType,
    titleFamily,
    expectedOutput,
    lifecycleStage: sequencing.lifecycleStage || null,
    commercialStage: sequencing.commercialStage || null,
    sequencingRole: sequencing.sequencingRole || null,
    prerequisiteType: sequencing.prerequisiteType || null,
    dependencyGate: sequencing.dependencyGate || null,
    unlockRequirement: sequencing.unlockRequirement || null,
    evidenceRequired: sequencing.evidenceRequired
      || (['review', 'audit', 'validation', 'readiness'].includes(blockType)
        ? `Upstream ${family.replace(/_/g, ' ')} artifacts produced earlier in ${phaseLabel} (e.g., ${expectedOutput})`
        : null),
    isReadinessOnly: sequencing.isReadinessOnly === true,
    isExpansionAction: sequencing.isExpansionAction === true,
    isProofSeeking: sequencing.isProofSeeking === true,
    isScaleAction: sequencing.isScaleAction === true,
    isExternalBdMechanic: sequencing.isExternalBdMechanic === true,
    isExternalStakeholderTouchpoint: sequencing.isExternalStakeholderTouchpoint === true,
    derivationReason: `${phaseLabel} ${blockType} derived for ${laneLabel} from phase objective and lane role.${supportException}`,
    riskOrConstraintAddressed: gated
      ? `Execution remains gated for ${laneLabel} until prior proof, dependency, or capital constraints clear.${supportException}`
      : `Protects ${laneLabel} against vague long-horizon filler by tying work to the active phase objective.${supportException}`,
    successCriterionServed:
      phaseLabel === 'P1'
        ? 'Launch proof and post-anchor evidence'
        : phaseLabel === 'P2'
          ? 'Repeatable conversion and operating-system proof'
          : 'Scale-readiness and terminal-readiness evidence',
    unlocks:
      phaseLabel === 'P1'
        ? [`phase:P2`, `lane:${lane?.id || lane?.laneId || 'unknown'}:conversion-readiness`]
        : phaseLabel === 'P2'
          ? [`phase:P3`, `lane:${lane?.id || lane?.laneId || 'unknown'}:scale-readiness`]
          : [`terminal-review:${lane?.id || lane?.laneId || 'unknown'}`],
  }));
}

function resolveBlockOwner(blockType, laneFamily = null) {
  if (blockType === 'waiting_period') {
    return 'TBD — must be resolved before activation';
  }
  return defaultOwnerForLaneFamily(laneFamily);
}

function resolvePassEvidence(blockType, descriptor) {
  switch (blockType) {
    case 'action': return descriptor?.expectedOutput || 'Completed artifact matching expected output';
    case 'review': return 'Written review with pass/fail determination and evidence summary';
    case 'audit': return 'Audit report with findings, gaps, and status determination';
    case 'validation': return 'Validation result with evidence collected and criteria checked';
    case 'readiness': return 'Readiness checklist with binary go/no-go decision';
    case 'gate': return 'Gate passed: all upstream evidence collected and pass/fail criteria met';
    case 'terminal-review': return 'Terminal review conclusion with outcome verdict and final decision';
    case 'terminal-readiness': return 'Terminal-readiness evidence package with final horizon decision';
    case 'milestone': return descriptor?.expectedOutput || 'Release asset list with items dated, owned, and confirmed ready for distribution';
    default: return 'Work product matching expected output';
  }
}

// Phase 4 — gate criteria + failure-branch substrate. Every gate block must
// declare what pass means, what fail means, what evidence is required to
// decide, who decides, and the downstream branch on either outcome. Derived
// deterministically from the descriptor title, phase, and lane so the
// expansion engine and forecast emitter both produce the same substrate.
// RTG Finding 2: pass/fail criteria must read as plain English regardless of
// whether the descriptor's expectedOutput is a noun phrase ("gate evidence
// packet") or a clause ("Direct expansion gate with unmet dependencies").
// Previous implementation stitched expectedOutput directly into the sentence,
// producing ungrammatical text like "Direct expansion gate with unmet
// dependencies demonstrates upstream proof threshold cleared for X". The
// current implementation places the descriptor evidence in a parenthetical
// reference so the surrounding sentence reads cleanly regardless of phrasing.
function resolveGateCriteria({ descriptor, phase, lane }) {
  const phaseLabel = phase?.label || null;
  const laneId = lane?.id || lane?.laneId || 'unknown';
  const laneTitle = getLaneTitle(lane) || 'lane';
  const expectedOutput = descriptor?.expectedOutput || 'gate evidence packet';
  const nextPhase = phaseLabel === 'P1' ? 'P2' : phaseLabel === 'P2' ? 'P3' : 'terminal-review';
  const nextLabel = nextPhase === 'terminal-review' ? 'terminal review' : nextPhase;
  const gateName = `${phaseLabel || 'phase'}→${nextPhase} gate: ${laneTitle}`;
  const evidence = String(descriptor?.evidenceRequired || expectedOutput).toLowerCase().replace(/\.\s*$/, '');
  return {
    gateName,
    passCriteria: `Upstream proof threshold for ${laneTitle} is met — advance to ${nextLabel}. Required evidence: ${evidence}.`,
    failCriteria: `Upstream proof threshold for ${laneTitle} is not met — hold and remediate the gap before reattempting. Missing or weak evidence: ${evidence}.`,
    evidenceRequired: descriptor?.evidenceRequired || expectedOutput || `Documented ${laneTitle} proof package supporting gate decision`,
    decisionAuthority: 'Operator',
    passBranch: nextPhase === 'terminal-review'
      ? `advance:terminal-review:${laneId}`
      : `advance:phase:${nextPhase}:${laneId}`,
    failBranch: `hold:${phaseLabel || 'phase'}:${laneId}:remediate-upstream`,
  };
}

// Derives a machine-verifiable downstream reference from the block's primary unlock entry.
// consumedBy carries the human-readable label; consumedByRef carries the typed reference.
function deriveConsumedByRef(occurrenceDescriptor) {
  const unlocks = occurrenceDescriptor.unlocks || [];
  const primary = unlocks[0];
  if (!primary) return null;
  if (primary.startsWith('phase:')) return { type: 'phaseObjective', id: primary.slice(6) };
  if (primary.startsWith('terminal-review:')) return { type: 'terminalOutcome', id: primary.slice(16) };
  if (primary.startsWith('lane:')) return { type: 'laneOutcome', id: primary.slice(5) };
  return { type: 'block', id: primary };
}

function buildBlock({
  planId,
  phase,
  lane,
  laneStatus,
  descriptor,
  dayKey,
  idDayKey = null,
  idx,
  plan,
}) {
  const laneId = lane?.id || lane?.laneId || null;
  const blockType = descriptor.blockType;
  const occurrenceDescriptor = decorateDescriptorForOccurrence({
    descriptor,
    phaseLabel: phase?.label || null,
    lane,
    dayKey,
    idx,
  });
  const commitmentState =
    occurrenceDescriptor.blockType === 'gate'
      ? 'review-required'
      : occurrenceDescriptor.blockType === 'terminal-readiness'
        ? 'terminal-readiness'
        : phase?.label === 'P1'
          ? 'forecast'
          : phase?.label === 'P2'
            ? 'forecast'
            : 'strategic';
  const idKey = idDayKey || dayKey;
  const family = inferLaneFamily(lane);
  const laneTitle = getLaneTitle(lane);
  const gateCriteria = blockType === 'gate' ? resolveGateCriteria({ descriptor: occurrenceDescriptor, phase, lane }) : null;

  return {
    id: mkId(planId, phase?.label, laneId || 'lane', idKey, idx),
    title: occurrenceDescriptor.title,
    date: dayKey,
    dayKey,
    start: `${dayKey}T09:00:00.000Z`,
    end: `${dayKey}T10:00:00.000Z`,
    phaseId: phase?.id || null,
    phaseLabel: phase?.label || null,
    phaseName: phase?.phaseTitle || phase?.title || phase?.label || null,
    laneId,
    laneId,
    laneLabel: getLaneTitle(lane),
    deliverableId: laneId ? `masterplan-deliverable:${laneId}` : null,
    blockType: occurrenceDescriptor.blockType,
    titleFamily: occurrenceDescriptor.titleFamily || null,
    commitmentState,
    executionEligibility: 'locked',
    executionLockReason:
      'Full-horizon substrate is inspectable but not executable. Future work must remain locked until committed in Today.',
    source: 'derived',
    expectedOutput: occurrenceDescriptor.expectedOutput,
    derivationReason: occurrenceDescriptor.derivationReason,
    timeEstimateMinutes: resolveTimeEstimateMinutes(blockType),
    predecessors: (lane?.dependsOnLaneIds || []).map((dependencyId) => `lane:${dependencyId}`),
    sourceInputs: [
      `plan:${planId}`,
      phase?.id ? `phase:${phase.id}` : null,
      laneId ? `lane:${laneId}` : null,
      ...(Array.isArray(plan?.anchors) ? plan.anchors.slice(0, 3).map((anchor) => `anchor:${anchor.id || anchor.date}`) : []),
      plan?.successStandard ? `success:${String(plan.successStandard).slice(0, 80)}` : null,
    ].filter(Boolean),
    dependsOn: [
      ...(phase?.label === 'P2' ? ['phase:P1'] : []),
      ...(phase?.label === 'P3' ? ['phase:P2'] : []),
      ...((lane?.dependsOnLaneIds || []).map((dependencyId) => `lane:${dependencyId}`)),
    ],
    unlocks: occurrenceDescriptor.unlocks,
    riskOrConstraintAddressed: occurrenceDescriptor.riskOrConstraintAddressed,
    successCriterionServed: occurrenceDescriptor.successCriterionServed,
    sequencingRole: occurrenceDescriptor.sequencingRole || null,
    lifecycleStage: occurrenceDescriptor.lifecycleStage || null,
    commercialStage: occurrenceDescriptor.commercialStage || null,
    prerequisiteType: occurrenceDescriptor.prerequisiteType || null,
    dependencyGate: occurrenceDescriptor.dependencyGate || null,
    unlockRequirement: occurrenceDescriptor.unlockRequirement || null,
    evidenceRequired: (gateCriteria && gateCriteria.evidenceRequired) || occurrenceDescriptor.evidenceRequired || null,
    gateName: gateCriteria ? gateCriteria.gateName : null,
    passCriteria: gateCriteria ? gateCriteria.passCriteria : null,
    failCriteria: gateCriteria ? gateCriteria.failCriteria : null,
    decisionAuthority: gateCriteria ? gateCriteria.decisionAuthority : null,
    passBranch: gateCriteria ? gateCriteria.passBranch : null,
    failBranch: gateCriteria ? gateCriteria.failBranch : null,
    isReadinessOnly: occurrenceDescriptor.isReadinessOnly === true,
    isExpansionAction: occurrenceDescriptor.isExpansionAction === true,
    isProofSeeking: occurrenceDescriptor.isProofSeeking === true,
    isScaleAction: occurrenceDescriptor.isScaleAction === true,
    isExternalBdMechanic: occurrenceDescriptor.isExternalBdMechanic === true,
    isExternalStakeholderTouchpoint: occurrenceDescriptor.isExternalStakeholderTouchpoint === true,
    durationMinutes: resolveTimeEstimateMinutes(blockType),
    producesArtifact: occurrenceDescriptor.isExternalBdMechanic
      ? (occurrenceDescriptor.expectedOutput || getArtifactLabel(family, phase?.label || null, blockType, laneTitle) || null)
      : (getArtifactLabel(family, phase?.label || null, blockType, laneTitle) || occurrenceDescriptor.expectedOutput || null),
    consumedBy: occurrenceDescriptor.unlocks || [],
    consumedByRef: deriveConsumedByRef(occurrenceDescriptor),
    dependsOnBlockIds: [],
    owner: resolveBlockOwner(blockType, family),
    passEvidence: resolvePassEvidence(blockType, occurrenceDescriptor),
    executionContext: {
      laneStatus,
      planOrientation: inferPlanOrientation(plan),
      laneFamily: inferLaneFamily(lane),
    },
  };
}

function buildGlobalTerminalBlock({ planId, phase, horizonEndDayKey, plan }) {
  const dayKey = clampKey(horizonEndDayKey || phase?.endBoundary);
  if (!dayKey || phase?.label !== 'P3') return null;
  return {
    id: mkId(planId, phase?.label, 'terminal', dayKey, 999),
    title: `Assess terminal-readiness evidence for the cross-lane Operation Endgame review against the success standard and outcome target in ${formatQuarterYear(dayKey)}`,
    date: dayKey,
    dayKey,
    start: `${dayKey}T15:00:00.000Z`,
    end: `${dayKey}T16:30:00.000Z`,
    phaseId: phase?.id || null,
    phaseLabel: phase?.label || null,
    phaseName: phase?.phaseTitle || phase?.title || phase?.label || null,
    laneId: 'cross_lane_terminal_review',
    laneLabel: 'cross-lane terminal review',
    deliverableId: 'masterplan-deliverable:cross-lane-terminal-review',
    blockType: 'terminal-readiness',
    titleFamily: 'p3_cross_lane_terminal_review',
    commitmentState: 'terminal-readiness',
    executionEligibility: 'locked',
    executionLockReason:
      'Terminal-readiness review is inspectable for the strategic horizon but cannot mutate execution state.',
    source: 'derived',
    expectedOutput:
      'Terminal-readiness evidence package updated for the cross-lane Operation Endgame review with current proof, remaining gaps, and final horizon decision.',
    derivationReason:
      `Derived from P3 success standard comparison against the declared outcome target for the ${formatQuarterYear(dayKey)} terminal review window.`,
    timeEstimateMinutes: 120,
    predecessors: [],
    sourceInputs: [
      `plan:${planId}`,
      phase?.id ? `phase:${phase.id}` : null,
      plan?.successStandard ? `success:${String(plan.successStandard).slice(0, 80)}` : null,
      plan?.outcomeTarget ? `outcome:${String(plan.outcomeTarget).slice(0, 80)}` : null,
    ].filter(Boolean),
    dependsOn: ['phase:P2'],
    unlocks: ['terminal-review:cross-lane'],
    durationMinutes: 120,
    producesArtifact: 'Terminal-readiness evidence package with cross-lane proof index and outcome decision',
    consumedBy: ['terminal-review:cross-lane'],
    owner: 'Operator',
    passEvidence: 'Terminal-readiness evidence package with final horizon decision and success-standard comparison',
    riskOrConstraintAddressed: 'Prevents a five-year schedule from ending without explicit terminal-readiness inspection.',
    successCriterionServed: 'Terminal-readiness evidence compared to success standard and outcome target',
    sequencingRole: 'terminal_validation',
    prerequisiteType: 'phase_p2_proof',
    dependencyGate: 'phase:P2',
    unlockRequirement: 'terminal_review',
    evidenceRequired: 'terminal_evidence',
    isReadinessOnly: false,
    isExpansionAction: false,
    isProofSeeking: false,
    isScaleAction: false,
  };
}

export function expandFullHorizonSchedule({
  plan = {},
  phaseModel = null,
  horizonStartDayKey = null,
  horizonEndDayKey = null,
  lanes = [],
  existingForecastBlocks = [],
  committedBlocks = [],
  workDays = [],
  workWindows = null,
  timeZone = 'UTC',
} = {}) {
  const result = [];
  if (!phaseModel?.phases?.length || !horizonStartDayKey || !horizonEndDayKey) {
    return existingForecastBlocks || [];
  }

  const planId = plan.id || plan.planId || 'plan';
  const planOrientation = inferPlanOrientation(plan);
  const targetLanes = Array.isArray(lanes) && lanes.length ? lanes : [null];

  for (const phase of phaseModel.phases) {
    const phaseLabel = phase.label || 'phase';
    const phaseStart = maxDayKey(clampKey(phase.startBoundary || null), horizonStartDayKey);
    const phaseEnd = minDayKey(clampKey(phase.endBoundary || null), horizonEndDayKey);
    if (!phaseStart || !phaseEnd || phaseStart > horizonEndDayKey) continue;

    const visiblePhaseEnd = phaseEnd < horizonEndDayKey ? phaseEnd : horizonEndDayKey;

    for (let laneIndex = 0; laneIndex < targetLanes.length; laneIndex++) {
      const lane = targetLanes[laneIndex];
      const laneStatus = getPhaseLaneStatus(phase, lane);
      if (!lane && phaseLabel !== 'P3') continue;
      if (laneStatus === 'deferred') continue;

      const laneFamily = inferLaneFamily(lane);
      const descriptors = createDescriptor({ phaseLabel, lane, laneStatus, planOrientation });
      if (!descriptors.length) continue;

      // Offset each lane's rotation so lanes don't pile up on the same weekday.
      const laneRotationBase = laneIndex * 2;

      let cursor = phaseStart;
      let idx = 0;
      let rotationIdx = laneRotationBase;
      while (cursor && cursor <= visiblePhaseEnd) {
        const cadenceDays = resolveCadenceDays(phaseLabel, laneStatus, planOrientation, laneFamily, cursor, visiblePhaseEnd);
        const descriptor = descriptors[idx % descriptors.length];
        const placementKey = workDays.length > 0
          ? placementDayForBlock(cursor, workDays, rotationIdx)
          : cursor;
        result.push(
          buildBlock({
            planId,
            phase,
            lane,
            laneStatus,
            descriptor,
            dayKey: placementKey,
            idDayKey: cursor,
            idx,
            plan,
          })
        );
        cursor = nextDayKey(cursor, cadenceDays);
        idx += 1;
        rotationIdx += 1;
      }
    }

    const terminalBlock = buildGlobalTerminalBlock({ planId, phase, horizonEndDayKey: visiblePhaseEnd, plan });
    if (terminalBlock) {
      result.push(terminalBlock);
    }
  }

  const inVisibleRange = (block) => {
    const dayKey = String(block?.dayKey || block?.date || '').slice(0, 10);
    if (!dayKey) return false;
    return dayKey >= horizonStartDayKey && dayKey <= horizonEndDayKey;
  };

  const merged = [...committedBlocks, ...existingForecastBlocks, ...result].filter(inVisibleRange);
  const seen = new Set();
  const dedup = [];
  for (const block of merged) {
    if (!block?.id || seen.has(block.id)) continue;
    seen.add(block.id);
    dedup.push(block);
  }
  const scheduled = applyScheduleValidityProjection(dedup, {
    workWindows,
    timeZone,
    horizonEndDayKey,
  });
  const integrityApplied = applyArtifactDependencyIntegrity(scheduled);
  const crossLaneApplied = applyCrossLaneArtifactDependencies(integrityApplied.blocks, lanes);

  return crossLaneApplied.sort((left, right) => {
    const leftKey = String(left?.dayKey || left?.date || '');
    const rightKey = String(right?.dayKey || right?.date || '');
    if (leftKey !== rightKey) return leftKey.localeCompare(rightKey);
    const leftStart = String(left?.startISO || left?.start || '');
    const rightStart = String(right?.startISO || right?.start || '');
    if (leftStart !== rightStart) return leftStart.localeCompare(rightStart);
    return String(left?.title || '').localeCompare(String(right?.title || ''));
  });
}

export default expandFullHorizonSchedule;
