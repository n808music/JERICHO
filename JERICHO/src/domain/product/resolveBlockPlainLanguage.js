import { projectEnterpriseDisplay } from '../enterprise/enterpriseDisplayProjection';

function normalizeText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

const GENERIC_DETAIL_TOKENS = new Set(['', '—', 'tbd', 'todo', 'n/a', 'unspecified']);

function isGenericDetail(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return GENERIC_DETAIL_TOKENS.has(normalized);
}

function computeMolecularQuality(block) {
  const failureCodes = [];
  if (isGenericDetail(block?.expectedOutput) || isGenericDetail(block?.acceptanceEvidence)) {
    failureCodes.push('BLOCK_DETAIL_TOO_ABSTRACT');
  }
  const hasPlainAction = !isGenericDetail(block?.plainAction);
  const hasSteps = Array.isArray(block?.steps) && block.steps.length > 0;
  if (!hasPlainAction && !hasSteps) failureCodes.push('BLOCK_DETAIL_DO_THIS_EMPTY');
  if (isGenericDetail(block?.doneWhen)) failureCodes.push('BLOCK_DETAIL_DONE_WHEN_EMPTY');
  return {
    status: failureCodes.length > 0 ? 'under_specified' : 'passes',
    failureCodes,
  };
}

function ensureSentence(text) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return '';
  }
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function startsWithActionVerb(text) {
  return /^(advance|build|close|complete|confirm|coordinate|define|document|evaluate|execute|finalize|map|prepare|publish|review|run|submit|test|validate|verify)\b/i.test(
    normalizeText(text)
  );
}

function stripTitlePrefix(text) {
  return normalizeText(text)
    .replace(/^Milestone checkpoint:\s*/i, '')
    .replace(/^First-cycle readiness work:\s*/i, '')
    .replace(/^Concrete progress documented for:\s*/i, '')
    .trim();
}

function formatDependencyLabel(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }
  if (/^masterplan-action:/i.test(normalized)) {
    return normalized.replace(/^masterplan-action:/i, 'upstream milestone ');
  }
  if (/^masterPlanLane:/i.test(normalized)) {
    return normalized.replace(/^masterPlanLane:/i, 'master plan lane ');
  }
  return normalized;
}

function resolveConsumerLabels(block = {}, initiativeDisplay = {}) {
  const labels = [];
  const laneLabel = normalizeText(initiativeDisplay?.lane || block?.laneLabel || block?.lane);
  const initiativeLabel = normalizeText(initiativeDisplay?.initiative || '');
  const consumedByRefType = normalizeText(block?.consumedByRef?.type).toLowerCase();
  if (consumedByRefType === 'masterplanlane' || consumedByRefType === 'masterplanlane'.toLowerCase()) {
    if (laneLabel) {
      labels.push(`${laneLabel} lane`);
    }
  } else if (consumedByRefType === 'masterplan') {
    labels.push('master plan');
  }
  (Array.isArray(block?.consumedBy) ? block.consumedBy : [])
    .map(formatDependencyLabel)
    .filter(Boolean)
    .forEach((label) => {
      if (!labels.includes(label)) {
        labels.push(label);
      }
    });
  if (labels.length === 0 && initiativeLabel) {
    labels.push(`${initiativeLabel} execution plan`);
  }
  return labels;
}

function resolveDependencyLabels(block = {}) {
  const labels = [];
  const details = Array.isArray(block?.directDependencyDetails) ? block.directDependencyDetails : [];
  details.forEach((detail) => {
    const dependencyLabel = formatDependencyLabel(detail?.actionId);
    if (dependencyLabel) {
      labels.push(dependencyLabel);
    }
  });
  (Array.isArray(block?.directDependencyIds) ? block.directDependencyIds : [])
    .map(formatDependencyLabel)
    .filter(Boolean)
    .forEach((label) => {
      if (!labels.includes(label)) {
        labels.push(label);
      }
    });
  return labels;
}

function resolveArtifact(block = {}, initiativeDisplay = {}) {
  const raw = normalizeText(
    block?.producesArtifact ||
      block?.expectedOutput ||
      block?.artifactLabel ||
      block?.outputArtifact ||
      block?.outputLabel ||
      block?.deliverableLabel
  );
  if (raw) {
    return stripTitlePrefix(raw);
  }
  return defaultArtifact(block, initiativeDisplay);
}

function resolveEvidence(block = {}, artifact = '', title = '') {
  const raw = normalizeText(block?.acceptanceEvidence || block?.passEvidence);
  if (raw) {
    return stripTitlePrefix(raw);
  }
  const fallbackTitle = stripTitlePrefix(title);
  if (artifact) {
    return `Proof that ${artifact} exists, is reviewed, and is linked to the next consumer`;
  }
  return `Proof that ${fallbackTitle || 'the scheduled work'} is complete`;
}

function resolveWhyThisExists(block = {}, consumers = []) {
  const reason = normalizeText(block?.passEvidence || block?.missConsequence);
  if (reason) {
    return ensureSentence(reason);
  }
  if (consumers.length > 0) {
    return ensureSentence(`This block exists so ${consumers.join(', ')} can proceed without a missing handoff`);
  }
  return '';
}

function stripOperationEndgamePhrasing(title) {
  return normalizeText(title)
    .replace(/\bfor Operation Endgame [^,]+/gi, '')
    .replace(/\bin P\d [^,]+ lane/gi, '')
    .replace(/\busing [^,]+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractReviewWindow(text) {
  const match = normalizeText(text).match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}\s+(review window|operating cycle|sprint)\b/i
  );
  return match ? normalizeText(match[0]) : '';
}

function monthYearFromDayKey(dayKey) {
  const normalized = normalizeText(dayKey);
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(normalized);
  if (!match) {
    return '';
  }
  const [, year, month] = match;
  const monthLabels = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${monthLabels[Number(month) - 1] || month} ${year}`;
}

function currentWindowLabel(block, hierarchy = {}) {
  const explicit = normalizeText(hierarchy?.operatingCycle || hierarchy?.sprint || hierarchy?.currentWindow);
  if (explicit) {
    return explicit;
  }
  return monthYearFromDayKey(block?.startDayKey || String(block?.start || '').slice(0, 10));
}

function normalizeLaneLabel(rawLane) {
  const lane = normalizeText(rawLane);
  const haystack = lane.toLowerCase();
  if (!haystack) {
    return '';
  }
  if (/district|civic|corridor|physical footprint|real estate|site control|property|acquisition thesis/.test(haystack)) {
    return 'Real Estate';
  }
  if (/app platform|product\/software|software|product platform|jericho/.test(haystack)) {
    return 'Product / Software';
  }
  if (/album|creative|entertainment|record label|release engine|music/.test(haystack)) {
    return 'Creative / Music';
  }
  if (/media|content|podcast|narrative/.test(haystack)) {
    return 'Media / Content';
  }
  if (/revenue|income|sales|commercial/.test(haystack)) {
    return 'Revenue';
  }
  if (/operations|systems|operator|company/.test(haystack)) {
    return 'Operations';
  }
  if (/institution|education|school|apprenticeship/.test(haystack)) {
    return 'Institution';
  }
  if (/capital|ip|legal|patent/.test(haystack)) {
    return 'Capital / IP';
  }
  return lane;
}

function resolveInitiativeDisplay(block = {}, hierarchy = {}) {
  const enterpriseProjection = projectEnterpriseDisplay({
    laneId: normalizeText(block?.laneId || block?.masterPlanLaneId || hierarchy?.lane),
    laneLabel: normalizeText(hierarchy?.lane || block?.laneLabel || block?.laneName || block?.lane),
    intakeSignals: { goalText: '', declaredLaneIds: [] },
  });
  const explicitInitiative = normalizeText(
    hierarchy?.initiative ||
      block?.initiativeName ||
      block?.projectName ||
      block?.ventureName ||
      block?.initiativeTitle ||
      block?.initiativeLabel ||
      block?.initiative
  );
  const normalizedLane = normalizeLaneLabel(hierarchy?.lane || block?.laneLabel || block?.laneName || block?.lane);
  const canonicalLane = enterpriseProjection?.displayName || normalizedLane;
  const titleHaystack = normalizeLower(
    [block?.displayTitle, block?.title, block?.label, block?.laneLabel, block?.laneName, explicitInitiative, normalizedLane].join(
      ' '
    )
  );

  if (explicitInitiative) {
    return {
      initiative: explicitInitiative,
      lane: canonicalLane || explicitInitiative,
    };
  }
  if (/jericho system|app platform|onboarding|product platform/.test(titleHaystack)) {
    return { initiative: 'Jericho System', lane: canonicalLane || 'Product / Software' };
  }
  if (/album|release engine|blackman|d8 n8|our fearless leader|romance riot/.test(titleHaystack)) {
    return { initiative: 'Release Engine', lane: canonicalLane || 'Creative / Music' };
  }
  if (/podcast|media narrative|help yourself|state of control|content pipeline/.test(titleHaystack)) {
    return { initiative: 'Content Engine', lane: canonicalLane || 'Media / Content' };
  }
  if (/services revenue|revenue bridge|offer|sales/.test(titleHaystack)) {
    return { initiative: 'Revenue Bridge', lane: canonicalLane || 'Revenue' };
  }
  if (/studio operations|operator checklist|operating system/.test(titleHaystack)) {
    return { initiative: 'Operating System', lane: canonicalLane || 'Operations' };
  }
  if (/institution|apprenticeship|school/.test(titleHaystack)) {
    return { initiative: 'Institution', lane: canonicalLane || 'Institution' };
  }
  if (/real estate|district|civic|corridor|property|site/.test(titleHaystack)) {
    return { initiative: 'Real Estate', lane: canonicalLane || 'Real Estate' };
  }
  if (/patent|ip|trademark|legal/.test(titleHaystack)) {
    return { initiative: 'Capital / IP', lane: canonicalLane || 'Capital / IP' };
  }
  return {
    initiative: canonicalLane || 'Unspecified Initiative',
    lane: canonicalLane,
  };
}

function defaultArtifact(block, initiativeDisplay) {
  return (
    normalizeText(block?.expectedOutput || block?.artifactLabel || block?.outputLabel || block?.deliverableLabel) ||
    (initiativeDisplay?.initiative && initiativeDisplay.initiative !== initiativeDisplay.lane
      ? `${initiativeDisplay.initiative} progress note`
      : 'Progress note or blocker report')
  );
}

function onboardingBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = resolveArtifact(block, initiativeDisplay);
  const acceptanceEvidence = resolveEvidence(block, artifact, block?.title || block?.label);
  return {
    intent: 'Test Jericho onboarding and login behavior enough to clear the current launch blocker.',
    plainAction: 'Run the product like a user and verify the onboarding path works end to end.',
    steps: [
      'Open the app as a user.',
      'Sign in and confirm access succeeds.',
      'Refresh and verify profile restoration still lands in the correct context.',
      'Confirm the expected goal or initiative loads without a blocker.',
      'Record any blocker that prevents activation or use.',
    ],
    doneWhen: `The onboarding path works without a blocker, or the blocker is clearly documented with ${artifact.toLowerCase()}.`,
    artifact,
    acceptanceEvidence,
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists: resolveWhyThisExists(block),
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Execution block',
  };
}

function genericBreakdown(block, hierarchy, initiativeDisplay) {
  const cleanedTitle = stripOperationEndgamePhrasing(block?.title || block?.label || block?.displayTitle);
  const actionTitle = stripTitlePrefix(cleanedTitle);
  const initiativeName = initiativeDisplay?.initiative || hierarchy?.initiative || hierarchy?.lane || 'the current initiative';
  const artifact = resolveArtifact(block, initiativeDisplay);
  const acceptanceEvidence = resolveEvidence(block, artifact, actionTitle);
  const dependencies = resolveDependencyLabels(block);
  const consumers = resolveConsumerLabels(block, initiativeDisplay);
  const canonicalAction = actionTitle || `Advance ${initiativeName}`;
  const durationLabel = Number.isFinite(Number(block?.durationMinutes)) ? `${Number(block.durationMinutes)}-minute` : 'scheduled';
  const explicitSteps = Array.isArray(block?.steps)
    ? block.steps.map(normalizeText).filter(Boolean)
    : [];
  const inferredSteps = [
    `Use this ${durationLabel} block to complete: ${canonicalAction}.`,
    dependencies.length > 0 ? `Verify the required upstream inputs are ready: ${dependencies.join(', ')}.` : '',
    artifact ? `Create or update ${artifact}.` : '',
    consumers.length > 0 ? `Attach or hand off the output to ${consumers.join(', ')}.` : '',
    acceptanceEvidence ? `Capture completion proof: ${acceptanceEvidence}.` : '',
  ].filter(Boolean);
  const plainAction =
    normalizeText(block?.plainAction) ||
    (startsWithActionVerb(canonicalAction)
      ? `${canonicalAction} and produce ${artifact}.`
      : `Complete ${canonicalAction} and produce ${artifact}.`);
  const doneWhen =
    normalizeText(block?.doneWhen) ||
    `The block output exists as ${artifact} and the completion proof is recorded: ${acceptanceEvidence}.`;
  return {
    intent: actionTitle
      ? ensureSentence(`${actionTitle} to advance ${initiativeName}`)
      : `Advance ${initiativeName} with this scheduled block.`,
    plainAction: ensureSentence(plainAction),
    steps: explicitSteps.length > 0 ? explicitSteps.map(ensureSentence) : inferredSteps.map(ensureSentence),
    doneWhen: ensureSentence(doneWhen),
    artifact,
    acceptanceEvidence: ensureSentence(acceptanceEvidence),
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'inferred',
    whyThisExists: resolveWhyThisExists(block, consumers),
    dependencies: {
      requires: dependencies,
      unlocks: consumers,
    },
    workType: block?.milestoneType ? `Milestone ${normalizeText(block.milestoneType)}` : 'Execution block',
  };
}

export function resolveBlockPlainLanguage(block = {}, context = {}) {
  const hierarchy = context?.hierarchy || {};
  const initiativeDisplay = resolveInitiativeDisplay(block, {
    initiative: hierarchy?.initiative,
    lane: hierarchy?.lane,
  });
  const title = normalizeText(block?.title || block?.label || block?.displayTitle).toLowerCase();

  const baseResult = (
    /(onboarding|sign-in|sign in|login|log in|profile restoration|launch blocker)/i.test(title) ||
    (title.includes('app platform') && title.includes('onboarding'))
  )
    ? onboardingBreakdown(block, hierarchy, initiativeDisplay)
    : genericBreakdown(block, hierarchy, initiativeDisplay);

  return {
    ...baseResult,
    laneLabel: initiativeDisplay?.lane || '',
    initiativeLabel: initiativeDisplay?.initiative || '',
    expectedOutput: baseResult.artifact,
    quality: computeMolecularQuality({
      expectedOutput: baseResult.artifact,
      acceptanceEvidence: baseResult.acceptanceEvidence,
      plainAction: baseResult.plainAction,
      steps: baseResult.steps,
      doneWhen: baseResult.doneWhen,
    }),
  };
}

export default resolveBlockPlainLanguage;
