function mkId(planId, phaseLabel, laneId, dayKey, idx) {
  return `fh-${planId || 'plan'}-${phaseLabel || 'phase'}-${laneId || 'lane'}-${dayKey}-${idx}`;
}

function clampKey(key) {
  return String(key || '').slice(0, 10);
}

function nextDayKey(dayKey, days) {
  const d = new Date(`${dayKey}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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
  return String(participation?.status || lane?.activationState || 'active')
    .trim()
    .toLowerCase();
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

  return {
    ...descriptor,
    title: `${descriptor.title} using ${focus} for the ${titleWindowLabel}`,
    expectedOutput: `${descriptor.expectedOutput} Deliver ${artifact} with ${focus}, explicit owner, and next gate timing for ${reviewWindow}.`,
    derivationReason: `${descriptor.derivationReason} Occurrence tuned to ${focus} for ${reviewWindow}.`,
  };
}

function createDescriptor({ phaseLabel, lane, laneStatus, planOrientation }) {
  const laneTitle = getLaneTitle(lane);
  const laneLabel = getLaneLabel(lane);
  const family = inferLaneFamily(lane);
  const gated = laneStatus === 'gated' || laneStatus === 'dependent';
  const narrowPlan = planOrientation === 'single_product';

  const byFamily = {
    product_software: {
      P1: [
        ['Validate onboarding path for Operation Endgame app launch in product/software lane', 'validation', 'Onboarding checklist with proof gaps logged'],
        [`Ship beta evidence review for ${laneTitle} in P1 product/software lane`, 'review', 'Beta evidence review with launch blockers ranked'],
        [`Prepare post-anchor conversion instrumentation for ${laneTitle} in product/software lane`, 'action', 'Conversion instrumentation plan for the next proof window'],
      ],
      P2: [
        [`Assess product/software onboarding evidence against P2 conversion-readiness criteria for ${laneTitle}`, 'readiness', 'Conversion-readiness decision with next-cycle scope'],
        [`Audit activation-to-retention funnel for ${laneTitle} in P2 product/software lane`, 'audit', 'Funnel audit with retention risks and fixes'],
        [`Define repeatable release cadence for ${laneTitle} in P2 product/software lane`, 'action', 'Release cadence standard with owner and review rhythm'],
      ],
      P3: [
        [`Review scale-readiness controls for ${laneTitle} in P3 product/software lane`, 'review', 'Scale-readiness review with delegation constraints', 'p3_product_scale_readiness_controls'],
        [`Validate terminal product evidence for ${laneTitle} against success standard`, 'terminal-readiness', 'Terminal product evidence summary tied to success standard', 'p3_product_terminal_evidence'],
        [`Stress-test retention and conversion durability for ${laneTitle} in P3 product/software lane`, 'audit', 'Retention and conversion durability test with failure modes', 'p3_product_retention_durability'],
        [`Package product proof for capital and institution review for ${laneTitle}`, 'action', 'Product proof package prepared for downstream capital and institution review', 'p3_product_proof_packaging'],
        [`Reconcile unresolved product blockers for ${laneTitle} before horizon close`, 'review', 'Resolved product blocker register with owners and deadlines', 'p3_product_blocker_reconciliation'],
        [`Confirm operating handoff readiness for ${laneTitle} in P3 product/software lane`, 'readiness', 'Operating handoff readiness decision with support coverage', 'p3_product_handoff_readiness'],
      ],
    },
    creative_media: {
      P1: [
        [`Sequence release asset completion for ${laneTitle} in P1 creative project lane`, 'milestone', 'Release asset list with dated ownership'],
        [`Review audience-capture proof after ${laneTitle} anchor in creative project lane`, 'review', 'Audience-capture proof memo and next-cycle ask'],
        [`Validate post-release conversion loop for ${laneTitle} in P1 creative project lane`, 'validation', 'Validated post-release conversion loop'],
      ],
      P2: [
        [`Assess catalog conversion cadence for ${laneTitle} in P2 creative project lane`, 'audit', 'Catalog conversion audit with repeatability score'],
        [`Define operating-system handoff for ${laneTitle} in P2 creative project lane`, 'action', 'Operating-system handoff plan for recurring releases'],
        [`Gate additional creative spend for ${laneTitle} until proof quality improves`, 'gate', 'Creative spend gate decision with evidence threshold'],
      ],
      P3: [
        [`Review long-tail audience monetization readiness for ${laneTitle} in P3 creative project lane`, 'readiness', 'Long-tail monetization readiness decision', 'p3_creative_monetization_readiness'],
        [`Validate terminal creative-proof package for ${laneTitle} against success standard`, 'terminal-readiness', 'Terminal creative-proof package with evidence index', 'p3_creative_terminal_proof'],
        [`Audit catalog conversion durability for ${laneTitle} in P3 creative project lane`, 'audit', 'Catalog conversion durability audit with replay risks', 'p3_creative_catalog_durability'],
        [`Package creative and IP proof for institutional leverage for ${laneTitle}`, 'action', 'Creative and IP proof package organized for institutional leverage', 'p3_creative_ip_packaging'],
        [`Reconcile release-to-demand evidence for ${laneTitle} before terminal review`, 'review', 'Release-to-demand evidence reconciled with remaining demand gaps', 'p3_creative_release_demand_reconciliation'],
        [`Confirm post-release operating cadence for ${laneTitle} in P3 creative project lane`, 'validation', 'Post-release operating cadence validated for long-tail execution', 'p3_creative_operating_cadence'],
      ],
    },
    media_channel: {
      P1: [
        [`Plan content pipeline proof sequence for ${laneTitle} in P1 media/content lane`, 'action', 'Content proof sequence mapped to anchor dates'],
        [`Audit distribution consistency for ${laneTitle} in P1 media/content lane`, 'audit', 'Distribution consistency audit with weak points'],
        [`Validate capture-to-conversion bridge for ${laneTitle} in P1 media/content lane`, 'validation', 'Capture-to-conversion bridge with measurable targets'],
      ],
      P2: [
        [`Review repeatable audience growth loop for ${laneTitle} in P2 media/content lane`, 'review', 'Audience growth loop review with stop/continue decisions'],
        [`Define editorial operating cadence for ${laneTitle} in P2 media/content lane`, 'action', 'Editorial operating cadence with roles and recurrence'],
        [`Assess sponsor or partner readiness for ${laneTitle} in P2 media/content lane`, 'readiness', 'Sponsor readiness decision tied to proof data'],
      ],
      P3: [
        [`Audit scale distribution resilience for ${laneTitle} in P3 media/content lane`, 'audit', 'Scale distribution resilience audit', 'p3_media_distribution_resilience'],
        [`Validate terminal media-proof package for ${laneTitle} against outcome target`, 'terminal-readiness', 'Terminal media-proof package mapped to outcome target', 'p3_media_terminal_proof'],
        [`Stress-test audience-to-demand conversion for ${laneTitle} in P3 media/content lane`, 'validation', 'Audience-to-demand conversion stress test with weak-point list', 'p3_media_conversion_stress_test'],
        [`Package narrative channel proof for ${laneTitle} before terminal review`, 'action', 'Narrative channel proof package assembled for terminal review', 'p3_media_channel_packaging'],
        [`Reconcile sponsor and partner readiness for ${laneTitle} in P3 media/content lane`, 'review', 'Sponsor and partner readiness reconciled with outstanding blockers', 'p3_media_partner_readiness'],
        [`Confirm editorial operating continuity for ${laneTitle} through horizon close`, 'readiness', 'Editorial operating continuity decision with delegated owner coverage', 'p3_media_editorial_continuity'],
      ],
    },
    company_operations: {
      P1: [
        [`Define operator checklist for ${laneTitle} in P1 company/operations lane`, 'action', 'Operator checklist with owner coverage'],
        [`Review execution risk controls for ${laneTitle} in P1 company/operations lane`, 'review', 'Execution risk controls review with fixes'],
        [`Validate meeting and handoff rhythm for ${laneTitle} in P1 company/operations lane`, 'validation', 'Meeting and handoff rhythm validated against active work'],
      ],
      P2: [
        [`Audit operating-system bottlenecks for ${laneTitle} in P2 company/operations lane`, 'audit', 'Operating-system bottleneck audit'],
        [`Gate staffing or contractor expansion for ${laneTitle} until proof is stable`, 'gate', 'Expansion gate with staffing criteria'],
        [`Define dashboard review cadence for ${laneTitle} in P2 company/operations lane`, 'action', 'Dashboard cadence and decision protocol'],
      ],
      P3: [
        [`Assess delegation readiness for ${laneTitle} in P3 company/operations lane`, 'readiness', 'Delegation readiness decision with missing controls', 'p3_ops_delegation_readiness'],
        [`Validate terminal operating-system evidence for ${laneTitle} against success standard`, 'terminal-readiness', 'Terminal operating-system evidence mapped to success standard', 'p3_ops_terminal_evidence'],
        [`Stress-test operator capacity for ${laneTitle} in P3 company/operations lane`, 'audit', 'Operator capacity stress test with escalation paths', 'p3_ops_capacity_stress_test'],
        [`Package SOP and control proof for ${laneTitle} before terminal review`, 'action', 'SOP and control proof package prepared for terminal review', 'p3_ops_sop_packaging'],
        [`Reconcile handoff risks for ${laneTitle} across the operating system`, 'review', 'Handoff risk register reconciled with mitigations and owners', 'p3_ops_handoff_reconciliation'],
        [`Confirm review cadence durability for ${laneTitle} in P3 company/operations lane`, 'validation', 'Review cadence durability validated against delegated operating load', 'p3_ops_cadence_durability'],
      ],
    },
    income_stream: {
      P1: [
        [`Validate immediate revenue path for ${laneTitle} in P1 income stream lane`, 'validation', 'Immediate revenue path with proof assumptions logged'],
        [`Review cashflow protection steps for ${laneTitle} in P1 income stream lane`, 'review', 'Cashflow protection review with deadlines'],
        [`Define service-to-recurring offer bridge for ${laneTitle} in P1 income stream lane`, 'action', 'Offer bridge linking near-term cash to long-term engine'],
      ],
      P2: [
        [`Audit repeatable conversion signals for ${laneTitle} in P2 income stream lane`, 'audit', 'Repeatable conversion audit with proof thresholds'],
        [`Assess margin-readiness for ${laneTitle} in P2 income stream lane`, 'readiness', 'Margin-readiness decision and next revisions'],
        [`Gate expansion of ${laneTitle} until revenue quality clears criteria`, 'gate', 'Revenue quality gate with criteria outcome'],
      ],
      P3: [
        [`Review scale economics for ${laneTitle} in P3 income stream lane`, 'review', 'Scale economics review mapped to horizon target', 'p3_income_scale_economics'],
        [`Validate terminal revenue evidence for ${laneTitle} against outcome target`, 'terminal-readiness', 'Terminal revenue evidence package', 'p3_income_terminal_evidence'],
        [`Stress-test margin durability for ${laneTitle} in P3 income stream lane`, 'audit', 'Margin durability stress test with correction plan', 'p3_income_margin_durability'],
        [`Package recurring revenue proof for ${laneTitle} before terminal review`, 'action', 'Recurring revenue proof package assembled for terminal review', 'p3_income_recurring_revenue_packaging'],
        [`Reconcile cashflow risk for ${laneTitle} across the scale window`, 'review', 'Cashflow risk reconciled with downside scenarios and safeguards', 'p3_income_cashflow_reconciliation'],
        [`Confirm repeatable conversion system for ${laneTitle} in P3 income stream lane`, 'validation', 'Repeatable conversion system validated against final-horizon targets', 'p3_income_conversion_system'],
      ],
    },
    capital_real_estate: {
      P1: [
        [`Define capital-readiness criteria for ${laneTitle} in P1 capital/real-estate lane`, 'readiness', 'Capital-readiness criteria with blocked dependencies'],
        [`Audit dependency gates before property action for ${laneTitle} in capital/real-estate lane`, 'audit', 'Dependency gate audit before direct action'],
        [`Gate direct expansion in ${laneTitle} until proof, capital, and operations clear`, 'gate', 'Direct expansion gate with unmet dependencies'],
      ],
      P2: [
        [`Review acquisition thesis quality for ${laneTitle} in P2 capital/real-estate lane`, 'review', 'Acquisition thesis review with evidence requirements'],
        [`Validate financing prerequisites for ${laneTitle} in P2 capital/real-estate lane`, 'validation', 'Financing prerequisites checklist with pass/fail status'],
        [`Assess asset-readiness for ${laneTitle} before widening capital commitment`, 'readiness', 'Asset-readiness decision tied to capital proof'],
      ],
      P3: [
        [`Audit scale-entry gates for ${laneTitle} in P3 capital/real-estate lane`, 'audit', 'Scale-entry gate audit with unresolved constraints', 'p3_capital_scale_entry_gates'],
        [`Validate terminal capital-readiness evidence for ${laneTitle} against success standard`, 'terminal-readiness', 'Terminal capital-readiness evidence package', 'p3_capital_terminal_evidence'],
        [`Stress-test financing prerequisites for ${laneTitle} in P3 capital/real-estate lane`, 'validation', 'Financing prerequisites stress test with blocked dependencies', 'p3_capital_financing_prerequisites'],
        [`Package acquisition and capital proof for ${laneTitle} before terminal review`, 'review', 'Acquisition and capital proof package prepared for terminal review', 'p3_capital_proof_packaging'],
        [`Reconcile risk controls for ${laneTitle} across the capital path`, 'review', 'Capital-path risk controls reconciled with owner coverage', 'p3_capital_risk_reconciliation'],
        [`Confirm capital deployment readiness for ${laneTitle} in P3 capital/real-estate lane`, 'readiness', 'Capital deployment readiness decision with remaining gating criteria', 'p3_capital_deployment_readiness'],
      ],
    },
    institution_education: {
      P1: [
        [`Define institution model assumptions for ${laneTitle} in P1 institution/education lane`, 'action', 'Institution model assumptions with gating list'],
        [`Review legal and operating prerequisites for ${laneTitle} in institution/education lane`, 'review', 'Prerequisite review with blocked items'],
        [`Gate early execution in ${laneTitle} until proof and capital dependencies clear`, 'gate', 'Early execution gate with explicit dependencies'],
      ],
      P2: [
        [`Audit curriculum or program viability for ${laneTitle} in P2 institution/education lane`, 'audit', 'Program viability audit with next experiments'],
        [`Assess partner-readiness for ${laneTitle} in P2 institution/education lane`, 'readiness', 'Partner-readiness decision with dependency status'],
        [`Validate operating charter for ${laneTitle} in P2 institution/education lane`, 'validation', 'Operating charter aligned to proof data'],
      ],
      P3: [
        [`Review institutional scale-readiness for ${laneTitle} in P3 institution/education lane`, 'review', 'Institutional scale-readiness review', 'p3_institution_scale_readiness'],
        [`Validate terminal institutional evidence for ${laneTitle} against outcome target`, 'terminal-readiness', 'Terminal institutional evidence package', 'p3_institution_terminal_evidence'],
        [`Stress-test program and partner viability for ${laneTitle} in P3 institution/education lane`, 'audit', 'Program and partner viability stress test with gating gaps', 'p3_institution_program_viability'],
        [`Package operating charter proof for ${laneTitle} before terminal review`, 'review', 'Operating charter proof package assembled for terminal review', 'p3_institution_charter_packaging'],
        [`Reconcile compliance and legitimacy risks for ${laneTitle} across P3`, 'review', 'Compliance and legitimacy risks reconciled with evidence owners', 'p3_institution_compliance_reconciliation'],
        [`Confirm institution launch readiness for ${laneTitle} in P3 institution/education lane`, 'readiness', 'Institution launch readiness decision with open prerequisites noted', 'p3_institution_launch_readiness'],
      ],
    },
    civic_development: {
      P1: [
        [`Map credibility dependencies for ${laneTitle} in P1 civic/district lane`, 'action', 'Credibility dependency map for later activation'],
        [`Review coalition prerequisites for ${laneTitle} in civic/district lane`, 'review', 'Coalition prerequisite review with blocked paths'],
        [`Gate direct district execution in ${laneTitle} until proof and capital stack exist`, 'gate', 'Direct district execution gate with unmet prerequisites'],
      ],
      P2: [
        [`Audit district opportunity criteria for ${laneTitle} in P2 civic/district lane`, 'audit', 'District opportunity criteria audit'],
        [`Assess coalition-readiness for ${laneTitle} in P2 civic/district lane`, 'readiness', 'Coalition-readiness decision with partner gaps'],
        [`Validate public-interest case for ${laneTitle} in P2 civic/district lane`, 'validation', 'Public-interest case validated against strategy'],
      ],
      P3: [
        [`Review civic scale-readiness for ${laneTitle} in P3 civic/district lane`, 'review', 'Civic scale-readiness review with dependency status', 'p3_civic_scale_readiness'],
        [`Validate terminal civic evidence for ${laneTitle} against success standard`, 'terminal-readiness', 'Terminal civic evidence package', 'p3_civic_terminal_evidence'],
        [`Stress-test coalition durability for ${laneTitle} in P3 civic/district lane`, 'audit', 'Coalition durability stress test with risk conditions', 'p3_civic_coalition_durability'],
        [`Package public-interest proof for ${laneTitle} before terminal review`, 'review', 'Public-interest proof package assembled for terminal review', 'p3_civic_public_interest_packaging'],
        [`Reconcile partner and risk gates for ${laneTitle} across the civic path`, 'review', 'Partner and risk gates reconciled with remaining blockers', 'p3_civic_partner_gate_reconciliation'],
        [`Confirm civic execution readiness for ${laneTitle} in P3 civic/district lane`, 'readiness', 'Civic execution readiness decision with prerequisite coverage', 'p3_civic_execution_readiness'],
      ],
    },
    general: {
      P1: [[`Define P1 proof sequence for ${laneTitle} in ${laneLabel}`, 'action', 'P1 proof sequence defined', 'p1_general_proof_sequence']],
      P2: [[`Review P2 operating cadence for ${laneTitle} in ${laneLabel}`, 'review', 'P2 operating cadence review', 'p2_general_operating_cadence']],
      P3: [
        [`Review terminal readiness for ${laneTitle} in ${laneLabel}`, 'review', 'Terminal readiness review', 'p3_general_terminal_readiness'],
        [`Validate terminal evidence for ${laneTitle} in ${laneLabel}`, 'terminal-readiness', 'Terminal evidence package', 'p3_general_terminal_evidence'],
        [`Package final proof for ${laneTitle} in ${laneLabel}`, 'action', 'Final proof package assembled', 'p3_general_final_proof_packaging'],
        [`Confirm handoff readiness for ${laneTitle} in ${laneLabel}`, 'readiness', 'Handoff readiness decision', 'p3_general_handoff_readiness'],
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

  return descriptors.map(([title, blockType, expectedOutput, titleFamily = null]) => ({
    title,
    blockType,
    titleFamily,
    expectedOutput,
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

function buildBlock({
  planId,
  phase,
  lane,
  laneStatus,
  descriptor,
  dayKey,
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

  return {
    id: mkId(planId, phase?.label, laneId || 'lane', dayKey, idx),
    title: occurrenceDescriptor.title,
    date: dayKey,
    dayKey,
    start: `${dayKey}T09:00:00.000Z`,
    end: `${dayKey}T10:00:00.000Z`,
    phaseId: phase?.id || null,
    phaseLabel: phase?.label || null,
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
    laneId: null,
    laneLabel: 'cross-lane terminal review',
    deliverableId: null,
    blockType: 'terminal-readiness',
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
    riskOrConstraintAddressed: 'Prevents a five-year schedule from ending without explicit terminal-readiness inspection.',
    successCriterionServed: 'Terminal-readiness evidence compared to success standard and outcome target',
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
    const phaseStart = clampKey(phase.startBoundary || horizonStartDayKey);
    const phaseEnd = clampKey(phase.endBoundary || horizonEndDayKey);
    if (!phaseStart || !phaseEnd || phaseStart > horizonEndDayKey) continue;

    const visiblePhaseEnd = phaseEnd < horizonEndDayKey ? phaseEnd : horizonEndDayKey;

    for (const lane of targetLanes) {
      const laneStatus = getPhaseLaneStatus(phase, lane);
      if (!lane && phaseLabel !== 'P3') continue;
      if (laneStatus === 'deferred') continue;

      const laneFamily = inferLaneFamily(lane);
      const descriptors = createDescriptor({ phaseLabel, lane, laneStatus, planOrientation });
      if (!descriptors.length) continue;

      let cursor = phaseStart;
      let idx = 0;
      while (cursor && cursor <= visiblePhaseEnd) {
        const cadenceDays = resolveCadenceDays(phaseLabel, laneStatus, planOrientation, laneFamily, cursor, visiblePhaseEnd);
        const descriptor = descriptors[idx % descriptors.length];
        result.push(
          buildBlock({
            planId,
            phase,
            lane,
            laneStatus,
            descriptor,
            dayKey: cursor,
            idx,
            plan,
          })
        );
        cursor = nextDayKey(cursor, cadenceDays);
        idx += 1;
      }
    }

    const terminalBlock = buildGlobalTerminalBlock({ planId, phase, horizonEndDayKey: visiblePhaseEnd, plan });
    if (terminalBlock) {
      result.push(terminalBlock);
    }
  }

  const merged = [...committedBlocks, ...existingForecastBlocks, ...result];
  const seen = new Set();
  const dedup = [];
  for (const block of merged) {
    if (!block?.id || seen.has(block.id)) continue;
    seen.add(block.id);
    dedup.push(block);
  }
  return dedup.sort((left, right) => {
    const leftKey = String(left?.dayKey || left?.date || '');
    const rightKey = String(right?.dayKey || right?.date || '');
    if (leftKey !== rightKey) return leftKey.localeCompare(rightKey);
    return String(left?.title || '').localeCompare(String(right?.title || ''));
  });
}

export default expandFullHorizonSchedule;
