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
  const titleHaystack = normalizeLower(
    [block?.displayTitle, block?.title, block?.label, block?.laneLabel, block?.laneName, explicitInitiative, normalizedLane].join(
      ' '
    )
  );

  if (explicitInitiative) {
    return {
      initiative: explicitInitiative,
      lane: normalizedLane || explicitInitiative,
    };
  }
  if (/jericho system|app platform|onboarding|product platform/.test(titleHaystack)) {
    return { initiative: 'Jericho System', lane: 'Product / Software' };
  }
  if (/album|release engine|blackman|d8 n8|our fearless leader|romance riot/.test(titleHaystack)) {
    return { initiative: 'Release Engine', lane: 'Creative / Music' };
  }
  if (/podcast|media narrative|help yourself|state of control|content pipeline/.test(titleHaystack)) {
    return { initiative: 'Content Engine', lane: 'Media / Content' };
  }
  if (/services revenue|revenue bridge|offer|sales/.test(titleHaystack)) {
    return { initiative: 'Revenue Bridge', lane: 'Revenue' };
  }
  if (/studio operations|operator checklist|operating system/.test(titleHaystack)) {
    return { initiative: 'Operating System', lane: 'Operations' };
  }
  if (/institution|apprenticeship|school/.test(titleHaystack)) {
    return { initiative: 'Institution', lane: 'Institution' };
  }
  if (/real estate|district|civic|corridor|property|site/.test(titleHaystack)) {
    return { initiative: 'Real Estate', lane: 'Real Estate' };
  }
  if (/patent|ip|trademark|legal/.test(titleHaystack)) {
    return { initiative: 'Capital / IP', lane: 'Capital / IP' };
  }
  return {
    initiative: normalizedLane || 'Unspecified Initiative',
    lane: normalizedLane,
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
    doneWhen: 'The onboarding path works without a blocker, or the blocker is clearly documented for repair.',
    artifact: defaultArtifact(block, initiativeDisplay),
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
  };
}

function genericBreakdown(block, hierarchy, initiativeDisplay) {
  const cleanedTitle = stripOperationEndgamePhrasing(block?.title || block?.label || block?.displayTitle);
  const initiativeName = initiativeDisplay?.initiative || hierarchy?.initiative || hierarchy?.lane || 'the current initiative';
  return {
    intent: cleanedTitle
      ? `${cleanedTitle.charAt(0).toUpperCase()}${cleanedTitle.slice(1)}.`
      : `Advance ${initiativeName} with this scheduled block.`,
    plainAction: `Move ${initiativeName} forward by completing the work described in this block and recording the result.`,
    steps: [
      'Review the formal title and hierarchy for context.',
      'Complete the concrete work needed to move this block forward.',
      'Capture the result, blocker, or evidence produced by the work.',
    ],
    doneWhen: 'The scheduled work is completed or the blocking condition is clearly recorded.',
    artifact: defaultArtifact(block, initiativeDisplay),
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'inferred',
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

  return { ...baseResult, expectedOutput: baseResult.artifact, quality: computeMolecularQuality(block) };
}

export default resolveBlockPlainLanguage;
