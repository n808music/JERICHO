function normalizeDayKey(value) {
  if (!value) {
    return null;
  }
  return String(value).trim().slice(0, 10) || null;
}

function parseDayKey(value) {
  const dayKey = normalizeDayKey(value);
  return dayKey ? new Date(`${dayKey}T12:00:00.000Z`) : null;
}

function addDaysToDayKey(value, days) {
  const date = parseDayKey(value);
  if (!date) {
    return null;
  }
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function dayDistanceInclusive(startValue, endValue) {
  const start = parseDayKey(startValue);
  const end = parseDayKey(endValue);
  if (!start || !end) {
    return 0;
  }
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

function titleCaseWords(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getTemporalDayKey(item) {
  return normalizeDayKey(item?.dayKey || item?.targetDate || item?.date || item?.startISO || item?.start);
}

function getFirstFixedAnchor(anchors) {
  return (
    [...(Array.isArray(anchors) ? anchors : [])]
      .filter((anchor) => normalizeDayKey(anchor?.date))
      .sort((left, right) => String(left?.date || '').localeCompare(String(right?.date || '')))
      .find((anchor) => anchor?.isFixed) ||
    [...(Array.isArray(anchors) ? anchors : [])]
      .filter((anchor) => normalizeDayKey(anchor?.date))
      .sort((left, right) => String(left?.date || '').localeCompare(String(right?.date || '')))[0] ||
    null
  );
}

function inferLaneFamily(lane) {
  const domain = String(lane?.domain || '')
    .trim()
    .toLowerCase();
  const title = String(lane?.title || '')
    .trim()
    .toLowerCase();

  if (domain === 'product' || title.includes('app') || title.includes('software')) {
    return 'product_software';
  }
  if (domain === 'creative' || title.includes('album') || title.includes('release') || title.includes('music')) {
    return 'creative_media';
  }
  if (domain === 'media' || title.includes('podcast') || title.includes('content')) {
    return 'media_channel';
  }
  if (domain === 'brand' || title.includes('company') || title.includes('agency') || title.includes('studio')) {
    return 'company_operations';
  }
  if (domain === 'income' || title.includes('income') || title.includes('revenue')) {
    return 'income_stream';
  }
  if (domain === 'capital' || domain === 'real_estate' || title.includes('real estate') || title.includes('property')) {
    return 'capital_real_estate';
  }
  if (domain === 'institution' || domain === 'education' || title.includes('school') || title.includes('franchise')) {
    return 'institution_education';
  }
  if (domain === 'civic' || domain === 'district' || title.includes('district') || title.includes('community')) {
    return 'civic_development';
  }
  return domain || 'general';
}

function classifyAnchorRole(anchor, plan) {
  const anchorDayKey = normalizeDayKey(anchor?.date);
  const horizonEnd = normalizeDayKey(plan?.horizonEnd);
  const label = String(anchor?.label || '')
    .trim()
    .toLowerCase();

  if (!anchorDayKey) {
    return { role: 'milestone', rationale: 'Undated anchor defaults to milestone.' };
  }
  if (horizonEnd && anchorDayKey === horizonEnd) {
    return { role: 'terminal_endpoint', rationale: 'Anchor lands on the declared horizon end.' };
  }
  if (label.includes('review') || label.includes('reassess')) {
    return { role: 'review_gate', rationale: 'Anchor language indicates a review or reassessment gate.' };
  }
  if (label.includes('phase') && (label.includes('end') || label.includes('close'))) {
    return { role: 'phase_boundary', rationale: 'Anchor language explicitly marks a phase boundary.' };
  }
  if (anchor?.isFixed) {
    return {
      role: 'convergence_event',
      rationale: 'Fixed multi-lane anchor is treated as a convergence event until evidence closes the phase.',
    };
  }
  return { role: 'milestone', rationale: 'Anchor remains a milestone inside the active phase.' };
}

function buildAnchorClassifications({ anchors, plan }) {
  return (Array.isArray(anchors) ? anchors : []).map((anchor) => {
    const classification = classifyAnchorRole(anchor, plan);
    return {
      id: anchor.id,
      label: anchor.label,
      date: normalizeDayKey(anchor.date),
      isFixed: Boolean(anchor.isFixed),
      role: classification.role,
      rationale: classification.rationale,
    };
  });
}

function buildSequencingCritiques({ plan, lanes, milestones, anchorClassifications }) {
  const firstAnchor = anchorClassifications.find((anchor) => anchor.role === 'convergence_event') || anchorClassifications[0] || null;
  const firstAnchorDayKey = normalizeDayKey(firstAnchor?.date);
  const critiques = [];

  const hasPostAnchorMilestone = (laneId) =>
    milestones.some((milestone) => {
      const dayKey = getTemporalDayKey(milestone);
      return milestone?.laneId === laneId && dayKey && firstAnchorDayKey && dayKey > firstAnchorDayKey;
    });

  lanes.forEach((lane) => {
    const family = inferLaneFamily(lane);
    const activation = String(lane?.activationState || '')
      .trim()
      .toLowerCase();

    if (family === 'creative_media' && !hasPostAnchorMilestone(lane.id)) {
      critiques.push({
        issueCode: 'POST_RELEASE_STRATEGY_MISSING',
        severity: 'high',
        affectedLane: lane.id,
        originalUserIntent: lane.title,
        critique: `${lane.title} currently peaks at the launch anchor without visible post-release conversion or evidence capture.`,
        correction: 'Add post-release conversion, audience capture, and evidence review work before treating the drop as sufficient proof.',
        schedulingEffect: 'Prioritize release-week conversion and post-release evidence review inside P1.',
      });
    }

    if (family === 'product_software' && !hasPostAnchorMilestone(lane.id)) {
      critiques.push({
        issueCode: 'LAUNCH_WITHOUT_CONVERSION_PATH',
        severity: 'high',
        affectedLane: lane.id,
        originalUserIntent: lane.title,
        critique: `${lane.title} is launch-oriented but does not yet show enough post-launch onboarding or conversion architecture.`,
        correction: 'Insert onboarding, user-capture, and first-conversion proof tasks before wider scaling.',
        schedulingEffect: 'Keep launch work active in P1, but gate public scaling until first user/conversion evidence exists.',
      });
    }

    if (family === 'capital_real_estate' && ['active', 'incubating'].includes(activation)) {
      critiques.push({
        issueCode: 'REAL_ESTATE_LANE_PREMATURE',
        severity: 'high',
        affectedLane: lane.id,
        originalUserIntent: lane.title,
        critique: `${lane.title} appears too early for direct execution without proof, capital, and activation criteria.`,
        correction: 'Reduce this lane to thesis definition, dependency mapping, and activation criteria until later-phase gates clear.',
        schedulingEffect: 'Mark direct real-estate execution as gated and schedule only research/thesis work before P3.',
      });
    }

    if (family === 'institution_education' && ['active', 'incubating'].includes(activation)) {
      critiques.push({
        issueCode: 'INSTITUTION_LANE_PREMATURE',
        severity: 'high',
        affectedLane: lane.id,
        originalUserIntent: lane.title,
        critique: `${lane.title} requires legal, capital, and traction substrate that is unlikely to belong in the first phase.`,
        correction: 'Limit early work to institution model definition, requirements mapping, and gate criteria.',
        schedulingEffect: 'Defer institution execution and keep only model-definition work visible before P3.',
      });
    }

    if (family === 'civic_development' && ['active', 'incubating'].includes(activation)) {
      critiques.push({
        issueCode: 'LANE_ACTIVATED_TOO_EARLY',
        severity: 'medium',
        affectedLane: lane.id,
        originalUserIntent: lane.title,
        critique: `${lane.title} depends on credibility, traction, and capital pathways that are not yet proven.`,
        correction: 'Keep the lane visible but treat it as deferred or research-only until later evidence exists.',
        schedulingEffect: 'Prevent direct civic execution in P1 and surface only dependency research.',
      });
    }
  });

  if (firstAnchorDayKey) {
    const postAnchorMilestonesExist = milestones.some((milestone) => {
      const dayKey = getTemporalDayKey(milestone);
      return dayKey && dayKey > firstAnchorDayKey;
    });
    if (!postAnchorMilestonesExist) {
      critiques.push({
        issueCode: 'ANCHOR_TREATED_AS_TERMINAL',
        severity: 'high',
        affectedLane: null,
        originalUserIntent: firstAnchor?.label || 'first hard anchor',
        critique: 'The current strategy appears to stop at the first major anchor instead of carrying through post-anchor proof.',
        correction: 'Extend P1 beyond the anchor to include proof capture, conversion review, and next-phase readiness assessment.',
        schedulingEffect: 'Keep the anchor inside P1 and add post-anchor evidence work before unlocking P2.',
      });
    }
  }

  return critiques;
}

function getPhaseBlueprints() {
  return [
    {
      id: 'P1',
      name: 'Foundation / Launch Proof',
      phaseObjective: 'Build the launch substrate, execute the convergence anchor, and capture the first proof window.',
      unlockCriteria: [
        'Launch assets and operating cadence are validated.',
        'Post-anchor proof exists for audience, users, or revenue.',
        'The next-phase lane priorities are evidence-backed.',
      ],
      nextPhaseImplications:
        'P2 becomes executable only after post-anchor proof identifies which lanes deserve repeatable operating investment.',
    },
    {
      id: 'P2',
      name: 'Conversion / Operating System',
      phaseObjective: 'Convert launch proof into repeatable cadence, conversion pathways, and stable execution loops.',
      unlockCriteria: [
        'Revenue or conversion architecture is proving repeatable.',
        'Execution consistency is strong enough to widen schedule commitment.',
        'Expansion lanes have cleared their evidence and dependency gates.',
      ],
      nextPhaseImplications:
        'P3 should scale only the validated lanes that survive conversion, cadence, and gate review.',
    },
    {
      id: 'P3',
      name: 'Scale / Terminal Readiness',
      phaseObjective: 'Scale validated lanes toward the success standard and assess terminal-readiness against the outcome target.',
      unlockCriteria: [
        'Validated lanes can support larger capital, institutional, or expansion moves.',
        'Delegation or systems cadence can absorb wider scale.',
        'Terminal review has enough evidence to compare mission success against the target horizon.',
      ],
      nextPhaseImplications:
        'Terminal review compares the living engine against the success standard and determines the next horizon.',
    },
  ];
}

function deriveLanePhaseStatus(lane, phaseIndex, sequencingCritiquesByLane) {
  const activation = String(lane?.activationState || '')
    .trim()
    .toLowerCase();
  const family = inferLaneFamily(lane);
  const critiqueCodes = sequencingCritiquesByLane[lane.id] || [];

  if (activation === 'parked') {
    return 'deferred';
  }
  if (
    critiqueCodes.includes('REAL_ESTATE_LANE_PREMATURE') ||
    critiqueCodes.includes('INSTITUTION_LANE_PREMATURE') ||
    critiqueCodes.includes('LANE_ACTIVATED_TOO_EARLY')
  ) {
    if (phaseIndex === 0) {
      return 'gated';
    }
    if (phaseIndex === 1) {
      return family === 'capital_real_estate' || family === 'institution_education' || family === 'civic_development'
        ? 'gated'
        : 'dependent';
    }
    return 'active';
  }
  if (activation === 'incubating') {
    return phaseIndex === 0 ? 'gated' : phaseIndex === 1 ? 'dependent' : 'active';
  }
  return 'active';
}

function derivePhaseSegments({ plan, anchorClassifications }) {
  const horizonStart = normalizeDayKey(plan?.horizonStart);
  const horizonEnd = normalizeDayKey(plan?.horizonEnd);
  if (!horizonStart || !horizonEnd) {
    return [];
  }

  const totalDays = dayDistanceInclusive(horizonStart, horizonEnd);
  const firstAnchor = anchorClassifications.find((anchor) => anchor.role === 'convergence_event') || anchorClassifications[0] || null;
  const firstAnchorDayKey = normalizeDayKey(firstAnchor?.date);

  if (firstAnchorDayKey && firstAnchorDayKey > horizonStart && firstAnchorDayKey < horizonEnd) {
    const proofCaptureDays = clamp(Math.round(totalDays * 0.12), 45, 180);
    const latestP1End = addDaysToDayKey(horizonEnd, -2);
    const p1CandidateEnd = addDaysToDayKey(firstAnchorDayKey, proofCaptureDays);
    const normalizedP1End =
      latestP1End && p1CandidateEnd && p1CandidateEnd > latestP1End ? latestP1End : p1CandidateEnd || latestP1End || horizonEnd;
    const remainingStart = addDaysToDayKey(normalizedP1End, 1);
    if (!remainingStart || remainingStart > horizonEnd) {
      const fallbackP1End = addDaysToDayKey(horizonStart, Math.max(0, Math.floor(totalDays / 2) - 1));
      const fallbackP2Start = addDaysToDayKey(fallbackP1End, 1);
      const fallbackP2End = fallbackP2Start ? addDaysToDayKey(fallbackP2Start, Math.max(0, Math.floor((totalDays - 1) / 3) - 1)) : null;
      return [
        { start: horizonStart, end: fallbackP1End || horizonEnd, containsPrimaryAnchor: true },
        { start: fallbackP2Start || horizonEnd, end: fallbackP2End || horizonEnd },
        { start: addDaysToDayKey(fallbackP2End || horizonEnd, 1) || horizonEnd, end: horizonEnd },
      ].filter((segment) => segment.start && segment.end && segment.start <= segment.end);
    }
    const remainingDays = dayDistanceInclusive(remainingStart, horizonEnd);
    const p2Days = remainingDays <= 2 ? 1 : clamp(Math.round(remainingDays * 0.45), 1, remainingDays - 1);
    const p2End = remainingDays > 1 ? addDaysToDayKey(remainingStart, p2Days - 1) : horizonEnd;
    return [
      { start: horizonStart, end: normalizedP1End, containsPrimaryAnchor: true },
      { start: remainingStart, end: p2End || horizonEnd },
      { start: addDaysToDayKey(p2End || horizonEnd, 1) || horizonEnd, end: horizonEnd },
    ].filter((segment) => segment.start && segment.end && segment.start <= segment.end);
  }

  const firstSegmentDays = clamp(Math.round(totalDays * 0.34), 30, Math.max(30, totalDays - 60));
  const secondSegmentDays = clamp(Math.round(totalDays * 0.33), 30, Math.max(30, totalDays - firstSegmentDays - 1));
  const p1End = addDaysToDayKey(horizonStart, firstSegmentDays - 1);
  const p2Start = addDaysToDayKey(p1End, 1);
  const p2End = p2Start ? addDaysToDayKey(p2Start, secondSegmentDays - 1) : null;
  return [
    { start: horizonStart, end: p1End },
    { start: p2Start, end: p2End },
    { start: addDaysToDayKey(p2End, 1), end: horizonEnd },
  ].filter((segment) => segment.start && segment.end && segment.start <= segment.end);
}

function buildStatusReport({
  phase,
  committedBlocks,
  phaseMilestones,
  laneParticipation,
  criticQuestions,
  phaseCritiques,
  activeCycle,
}) {
  const evidenceCount = Array.isArray(activeCycle?.executionEvents) ? activeCycle.executionEvents.length : 0;
  const unresolvedAssumptions = criticQuestions.length;
  const critiqueBlockers = phaseCritiques.filter((issue) => issue.severity === 'high');
  const completedMilestones = phaseMilestones.filter(
    (milestone) => String(milestone?.status || '').trim().toLowerCase() === 'complete'
  ).length;
  const blockers = [
    ...critiqueBlockers.map((issue) => issue.issueCode),
    ...criticQuestions.map((question) => question?.reasonCode || question?.question || null).filter(Boolean),
    ...phaseMilestones
      .filter((milestone) => String(milestone?.status || '').trim().toLowerCase() === 'at_risk')
      .map((milestone) => milestone.title),
  ];
  const nextPhaseReadiness =
    blockers.length > 0
      ? 'blocked'
      : evidenceCount > 0 || committedBlocks.length > 0 || completedMilestones > 0
        ? 'partial'
        : 'unknown';
  const recommendedCorrection =
    nextPhaseReadiness === 'blocked'
      ? 'Resolve sequencing or dependency blockers before widening commitment.'
      : nextPhaseReadiness === 'partial'
        ? 'Continue active-phase execution, capture proof, and reassess before unlocking the next phase.'
        : 'Collect enough execution evidence to evaluate whether this phase is earning the next unlock.';

  return {
    phaseProgress: `${completedMilestones}/${phaseMilestones.length || 0} milestones completed`,
    evidenceStatus:
      evidenceCount > 0
        ? `${evidenceCount} execution evidence event${evidenceCount === 1 ? '' : 's'} recorded`
        : 'Execution evidence is still insufficient for next-phase authority.',
    unresolvedAssumptions,
    blockers,
    nextPhaseReadiness,
    recommendedCorrection,
    summary:
      phase.activeState === 'active'
        ? `Execution data from ${phase.label} determines whether ${phase.nextPhaseLabel || 'the next phase'} can unlock.`
        : `This phase remains visible but not executable until the prior phase earns it.`,
    laneParticipationCount: laneParticipation.length,
  };
}

function buildHorizonVisibility(plan) {
  const start = normalizeDayKey(plan?.horizonStart);
  const end = normalizeDayKey(plan?.horizonEnd);
  if (!start || !end) {
    return null;
  }
  return {
    oneYearEnd: addDaysToDayKey(start, 364),
    threeYearEnd: addDaysToDayKey(start, 365 * 3 - 1),
    fullEnd: end,
  };
}

export function deriveMasterPlanPhaseModel({
  plan,
  lanes = [],
  milestones = [],
  anchors = [],
  planCycle = null,
  committedBlocks = [],
  criticQuestionsByLane = {},
}) {
  if (!plan) {
    return {
      phases: [],
      activePhase: null,
      nextPhase: null,
      activePhaseIndex: -1,
      nextUnlockSummary: 'No phase plan yet.',
      critiques: [],
      anchorClassifications: [],
      horizonVisibility: null,
    };
  }

  const blueprints = getPhaseBlueprints();
  const anchorClassifications = buildAnchorClassifications({ anchors, plan });
  const critiques = buildSequencingCritiques({ plan, lanes, milestones, anchorClassifications });
  const sequencingCritiquesByLane = critiques.reduce((acc, issue) => {
    if (issue.affectedLane) {
      if (!acc[issue.affectedLane]) {
        acc[issue.affectedLane] = [];
      }
      acc[issue.affectedLane].push(issue.issueCode);
    }
    return acc;
  }, {});
  const segments = derivePhaseSegments({ plan, anchorClassifications });
  const horizonVisibility = buildHorizonVisibility(plan);
  const activeStart = normalizeDayKey(planCycle?.startedAtDayKey || committedBlocks?.[0]?.dayKey || plan?.horizonStart);
  let activePhaseIndex = Math.max(
    0,
    segments.findIndex((segment) => activeStart && segment.start && segment.end && activeStart >= segment.start && activeStart <= segment.end)
  );
  if (segments.length === 0) {
    activePhaseIndex = -1;
  }

  const phases = segments.map((segment, index) => {
    const blueprint = blueprints[Math.min(index, blueprints.length - 1)] || blueprints[blueprints.length - 1];
    const phaseMilestones = milestones.filter((milestone) => {
      const dayKey = getTemporalDayKey(milestone);
      return dayKey && dayKey >= segment.start && dayKey <= segment.end;
    });
    const phaseCommittedBlocks = committedBlocks.filter((block) => {
      const dayKey = getTemporalDayKey(block);
      return dayKey && dayKey >= segment.start && dayKey <= segment.end;
    });
    const anchorsInPhase = anchorClassifications.filter(
      (anchor) => anchor.date && anchor.date >= segment.start && anchor.date <= segment.end
    );
    const laneParticipation = lanes
      .map((lane) => ({
        laneId: lane.id,
        laneTitle: lane.title,
        domain: lane.domain,
        status: deriveLanePhaseStatus(lane, index, sequencingCritiquesByLane),
      }))
      .filter((lane) =>
        phaseMilestones.some((milestone) => milestone?.laneId === lane.laneId) ||
        phaseCommittedBlocks.some((block) => block?.masterPlanLaneId === lane.laneId) ||
        anchorsInPhase.some((anchor) => Array.isArray(anchor?.affectedLaneIds) && anchor.affectedLaneIds.includes(lane.laneId)) ||
        lane.status !== 'deferred'
      );
    const criticQuestions = laneParticipation.flatMap((lane) => criticQuestionsByLane[lane.laneId] || []);
    const dependencyGates = [
      ...phaseMilestones
        .filter((milestone) => String(milestone?.milestoneType || '').trim().toLowerCase() === 'gate')
        .map((milestone) => milestone.title),
      ...anchorsInPhase.filter((anchor) => anchor.role === 'review_gate').map((anchor) => anchor.label),
    ];
    const evidenceRequirements =
      index === 0
        ? ['launch-readiness proof', 'post-anchor audience or user signal', 'first conversion or cadence evidence']
        : index === 1
          ? ['repeatable conversion signal', 'operating cadence stability', 'lane-priority evidence review']
          : ['scaling proof', 'capital or partnership gate clearance', 'terminal-readiness evidence'];
    const commitmentState = index === 0 ? 'committed' : index === 1 ? 'forecast' : 'strategic';
    let activeState = 'locked';
    if (index < activePhaseIndex) {
      activeState = 'completed';
    } else if (index === activePhaseIndex) {
      activeState = 'active';
    }

    const phaseCritiques = critiques.filter((issue) => {
      if (!issue.affectedLane) {
        return index === 0;
      }
      return laneParticipation.some((lane) => lane.laneId === issue.affectedLane);
    });

    const phase = {
      id: `${plan.id}:${blueprint.id.toLowerCase()}`,
      label: blueprint.id,
      name: blueprint.name,
      phaseObjective: blueprint.phaseObjective,
      startBoundary: segment.start,
      endBoundary: segment.end,
      milestones: phaseMilestones,
      unlockCriteria: blueprint.unlockCriteria,
      executionScheduleStatus:
        index === activePhaseIndex
          ? phaseCommittedBlocks.length > 0
            ? 'scheduled'
            : 'not_generated'
          : 'visible_but_not_executable',
      nextPhaseImplications: blueprint.nextPhaseImplications,
      nextPhaseLabel: blueprints[index + 1]?.id || 'terminal review',
      laneParticipation,
      dependencyGates,
      evidenceRequirements,
      commitmentState,
      activeState,
      anchorRole:
        anchorsInPhase.find((anchor) => anchor.role === 'phase_boundary')?.role ||
        anchorsInPhase.find((anchor) => anchor.role === 'convergence_event')?.role ||
        'milestone',
      anchorsInPhase,
      critiques: phaseCritiques,
    };

    phase.statusReport = buildStatusReport({
      phase,
      committedBlocks: phaseCommittedBlocks,
      phaseMilestones,
      laneParticipation,
      criticQuestions,
      phaseCritiques,
      activeCycle: planCycle,
    });
    return phase;
  });

  const activePhase = activePhaseIndex >= 0 ? phases[activePhaseIndex] || null : null;
  const nextPhase = activePhaseIndex >= 0 ? phases[activePhaseIndex + 1] || null : null;
  const nextUnlockSummary = activePhase
    ? `${activePhase.label} unlocks ${nextPhase?.label || 'terminal review'} when ${activePhase.unlockCriteria[0] || 'execution evidence supports the next phase'}.`
    : 'Start an execution cycle to activate the first phase.';

  return {
    phases,
    activePhase,
    nextPhase,
    activePhaseIndex,
    nextUnlockSummary,
    critiques,
    anchorClassifications,
    horizonVisibility,
  };
}

export { normalizeDayKey, parseDayKey, addDaysToDayKey, dayDistanceInclusive, getFirstFixedAnchor, titleCaseWords };
