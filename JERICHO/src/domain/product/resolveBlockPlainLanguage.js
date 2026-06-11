function normalizeText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

const BLOCK_PLAIN_LANGUAGE_CACHE = new Map();
const BLOCK_PLAIN_LANGUAGE_CACHE_LIMIT = 5000;

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(normalizeText).filter(Boolean))];
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return uniqueStrings(value);
  }
  const text = normalizeText(value);
  if (!text) {
    return [];
  }
  return uniqueStrings(text.split(/[|,;\n]/g));
}

function extractRefId(ref) {
  if (!ref) {
    return '';
  }
  if (typeof ref === 'string') {
    return normalizeText(ref);
  }
  if (typeof ref === 'object') {
    return normalizeText(ref.id || ref.ref || ref.label || ref.title || ref.name);
  }
  return '';
}

function normalizeRefList(value) {
  if (Array.isArray(value)) {
    return uniqueStrings(value.map(extractRefId));
  }
  return uniqueStrings([extractRefId(value)]);
}

function serializeCacheValue(value) {
  if (Array.isArray(value)) {
    return value.map(serializeCacheValue).join('|');
  }
  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return normalizeText(value);
}

function buildPlainLanguageCacheKey(block = {}, hierarchy = {}) {
  return [
    block?.id,
    block?.title,
    block?.label,
    block?.displayTitle,
    block?.blockType,
    block?.phaseLabel,
    block?.laneId,
    block?.laneLabel,
    block?.laneName,
    block?.initiativeName,
    block?.initiativeTitle,
    block?.initiativeLabel,
    block?.projectName,
    block?.ventureName,
    block?.expectedOutput,
    block?.artifactLabel,
    block?.outputLabel,
    block?.deliverableLabel,
    block?.passEvidence,
    block?.acceptanceEvidence,
    block?.requiredEvidence,
    block?.evidenceLabel,
    serializeCacheValue(block?.dependsOn),
    serializeCacheValue(block?.requires),
    serializeCacheValue(block?.dependencyRefs),
    serializeCacheValue(block?.consumedBy),
    serializeCacheValue(block?.consumedByRef),
    serializeCacheValue(block?.unlocks),
    serializeCacheValue(block?.serves),
    hierarchy?.phase,
    hierarchy?.lane,
    hierarchy?.initiative,
    hierarchy?.operatingCycle,
    hierarchy?.sprint,
    hierarchy?.currentWindow,
  ]
    .map(serializeCacheValue)
    .join('::');
}

function inferWorkType(block = {}) {
  const blockType = normalizeLower(block?.blockType);
  const title = normalizeLower(block?.title || block?.label || block?.displayTitle);

  if (blockType.includes('gate') || title.includes('gate ') || title.includes('readiness decision')) {
    return 'gate decision';
  }
  if (title.includes('wait') || title.includes('cooldown') || title.includes('holding period')) {
    return 'waiting period';
  }
  if (title.includes('dependency') || title.includes('prerequisite') || title.includes('unlock')) {
    return 'dependency resolution';
  }
  if (title.includes('review') || title.includes('audit') || title.includes('reassess') || title.includes('validate')) {
    return 'review';
  }
  if (
    title.includes('define ') ||
    title.includes('prepare ') ||
    title.includes('clarify ') ||
    title.includes('map ') ||
    title.includes('sequence ')
  ) {
    return 'preparation';
  }
  return 'execution';
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
  if (
    /district|civic|corridor|physical footprint|real estate|site control|property|acquisition thesis/.test(haystack)
  ) {
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
    [
      block?.displayTitle,
      block?.title,
      block?.label,
      block?.laneLabel,
      block?.laneName,
      explicitInitiative,
      normalizedLane,
    ].join(' ')
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

function titleWithoutBoilerplate(block = {}) {
  return normalizeText(block?.title || block?.label || block?.displayTitle)
    .replace(/\bfor Operation Endgame\b/gi, '')
    .replace(/\bin P\d [^,]+ lane\b/gi, '')
    .replace(/\busing [^,]+review window\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function defaultArtifact(block, initiativeDisplay) {
  return normalizeText(block?.expectedOutput || block?.artifactLabel || block?.outputLabel || block?.deliverableLabel) ||
    (initiativeDisplay?.initiative ? `${initiativeDisplay.initiative} execution artifact` : '');
}

function defaultAcceptanceEvidence(block) {
  return normalizeText(block?.passEvidence || block?.acceptanceEvidence || block?.requiredEvidence || block?.evidenceLabel);
}

function resolveDependencies(block = {}) {
  const requires = uniqueStrings([
    ...normalizeRefList(block?.dependsOn),
    ...normalizeRefList(block?.requires),
    ...normalizeRefList(block?.dependencyRefs),
  ]);
  const unlocks = uniqueStrings([
    ...normalizeRefList(block?.consumedBy),
    ...normalizeRefList(block?.consumedByRef),
    ...normalizeRefList(block?.unlocks),
    ...normalizeRefList(block?.serves),
  ]);
  return { requires, unlocks };
}

const GENERIC_DETAIL_TOKENS = new Set(['', '—', 'tbd', 'todo', 'n/a', 'unspecified']);

function isGenericDetail(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return GENERIC_DETAIL_TOKENS.has(normalized);
}

/**
 * Evaluates the five molecular block sections for concreteness.
 * Only fields that are explicitly provided (not undefined) are evaluated.
 * Returns { status: 'passes' | 'under_specified', failureCodes: string[] }.
 */
function computeMolecularQuality({ expectedOutput, acceptanceEvidence, plainAction, steps, doneWhen }) {
  const failureCodes = [];
  if (expectedOutput !== undefined && isGenericDetail(expectedOutput)) {
    failureCodes.push('BLOCK_DETAIL_TOO_ABSTRACT');
  }
  if (
    acceptanceEvidence !== undefined &&
    isGenericDetail(acceptanceEvidence) &&
    !failureCodes.includes('BLOCK_DETAIL_TOO_ABSTRACT')
  ) {
    failureCodes.push('BLOCK_DETAIL_TOO_ABSTRACT');
  }
  const hasPlainAction = plainAction !== undefined ? !isGenericDetail(plainAction) : true;
  const hasSteps = steps !== undefined ? (Array.isArray(steps) && steps.length > 0) : true;
  if (!hasPlainAction && !hasSteps) {
    failureCodes.push('BLOCK_DETAIL_DO_THIS_EMPTY');
  }
  if (doneWhen !== undefined && isGenericDetail(doneWhen)) {
    failureCodes.push('BLOCK_DETAIL_DONE_WHEN_EMPTY');
  }
  return {
    status: failureCodes.length > 0 ? 'under_specified' : 'passes',
    failureCodes,
  };
}

function hasP1RealEstateJustification(block = {}) {
  const haystack = normalizeLower(
    [
      block?.title,
      block?.label,
      block?.displayTitle,
      block?.derivationReason,
      block?.expectedOutput,
      block?.passEvidence,
    ].join(' ')
  );
  return /legal|ip|capital|fundraise|fundraise|revenue opportunity|partnership|deadline|sequencing dependency|prerequisite/.test(
    haystack
  );
}

function buildResult(block, hierarchy, initiativeDisplay, details = {}) {
  const dependencies = resolveDependencies(block);
  const expectedOutput = normalizeText(details.expectedOutput || defaultArtifact(block, initiativeDisplay));
  const acceptanceEvidence = normalizeText(details.acceptanceEvidence || defaultAcceptanceEvidence(block));
  const workType = normalizeText(details.workType || inferWorkType(block));
  const result = {
    initiativeLabel: normalizeText(details.initiativeLabel || initiativeDisplay.initiative),
    laneLabel: normalizeText(details.laneLabel || initiativeDisplay.lane),
    workType,
    intent: normalizeText(details.intent),
    plainAction: normalizeText(details.plainAction),
    steps: uniqueStrings(details.steps || []),
    expectedOutput,
    acceptanceEvidence,
    dependencies,
    whyThisExists: normalizeText(details.whyThisExists || details.intent),
    doneWhen: normalizeText(details.doneWhen || acceptanceEvidence),
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: normalizeText(details.confidence || 'high'),
    quality: {
      status: 'passed',
      failureCodes: [],
    },
  };

  if (normalizeLower(result.intent) === normalizeLower(titleWithoutBoilerplate(block))) {
    result.quality.failureCodes.push('TITLE_REPEATED_AS_EXPLANATION');
  }
  if (!result.laneLabel) {
    result.quality.failureCodes.push('INITIATIVE_LABEL_MISSING');
    result.quality.failureCodes.push('LANE_CONTEXT_NOT_APPLIED');
  }
  if (!result.expectedOutput) {
    result.quality.failureCodes.push('MISSING_EXPECTED_OUTPUT');
  }
  if (!result.acceptanceEvidence) {
    result.quality.failureCodes.push('MISSING_ACCEPTANCE_EVIDENCE');
  }

  if (/progress note|artifact|report/i.test(result.expectedOutput) && result.expectedOutput.split(' ').length < 4) {
    result.quality.failureCodes.push('OUTPUT_ARTIFACT_TOO_VAGUE');
  }
  if (/completed|done|finished/i.test(result.doneWhen) && result.doneWhen.split(' ').length < 5) {
    result.quality.failureCodes.push('COMPLETION_STANDARD_TOO_VAGUE');
  }
  if (!result.intent || !result.plainAction || result.steps.length === 0) {
    result.quality.failureCodes.push('BLOCK_DETAIL_AMBIGUOUS');
  }
  if (/\bdecide whether\b/.test(normalizeLower(block?.title || block?.label || block?.displayTitle))) {
    result.quality.failureCodes.push('USER_DECISION_DUMPING');
  }
  if (result.quality.failureCodes.length) {
    result.quality.status = 'under_specified';
  }
  return result;
}

function buildSoftwareTestBreakdown(block, hierarchy, initiativeDisplay) {
  return buildResult(block, hierarchy, initiativeDisplay, {
    laneLabel: 'Product / Software',
    initiativeLabel: 'Jericho System',
    workType: 'execution',
    intent: 'Verify that Jericho onboarding and profile restoration are solid enough to remove a launch blocker.',
    plainAction: 'Run the live onboarding path like a real user and document whether activation-critical behavior holds.',
    steps: [
      'Open the app and complete the sign-in flow.',
      'Refresh the app and confirm profile restoration returns to the correct context.',
      'Verify the user reaches the correct Operation Endgame state without a blocker.',
      'Capture any failing step with a blocker note, screenshot, or reproducible error.',
    ],
    expectedOutput: normalizeText(block?.expectedOutput) || 'Onboarding test report with pass/fail status and blocker list',
    acceptanceEvidence:
      normalizeText(block?.passEvidence) ||
      'A passing onboarding test report or a blocker log that names the exact failing step and reproduction path',
    doneWhen:
      'The onboarding path passes end to end, or the blocking failure is documented tightly enough to hand directly to repair work.',
    whyThisExists: 'P1 product proof depends on a working user entry path before launch-facing execution can be trusted.',
    confidence: 'high',
  });
}

function buildCreativeBreakdown(block, hierarchy, initiativeDisplay) {
  return buildResult(block, hierarchy, initiativeDisplay, {
    laneLabel: 'Creative / Music',
    initiativeLabel: initiativeDisplay.initiative || 'Release Engine',
    workType: normalizeLower(block?.title).includes('review') ? 'review' : 'execution',
    intent: 'Advance the release asset that supports public launch proof for the music lane.',
    plainAction: 'Create or finalize the specific release asset so it can move into packaging, review, or release sequencing.',
    steps: [
      'Open the active song, artwork, or release asset for this block.',
      'Complete the named revision, packaging, or sequencing task.',
      'Export the updated asset in the format required for the next release step.',
      'Record any missing asset, rights issue, or packaging blocker immediately.',
    ],
    expectedOutput: normalizeText(block?.expectedOutput) || 'Updated release asset package ready for the next creative checkpoint',
    acceptanceEvidence:
      normalizeText(block?.passEvidence) ||
      'An exported asset package, revision file, or release-ready draft that the next creative step can consume',
    doneWhen:
      'The release asset exists in the required format and the next creative or distribution step can consume it without translation.',
    whyThisExists: 'P1 launch proof requires specific creative assets, not only general progress on the catalog.',
    confidence: 'high',
  });
}

function buildMediaBreakdown(block, hierarchy, initiativeDisplay) {
  return buildResult(block, hierarchy, initiativeDisplay, {
    laneLabel: 'Media / Content',
    initiativeLabel: initiativeDisplay.initiative || 'Content Engine',
    workType: normalizeLower(block?.title).includes('audit') ? 'review' : 'execution',
    intent: 'Strengthen the content pipeline that supports launch visibility and downstream conversion.',
    plainAction: 'Produce or review the specific episode, post, or distribution step named in the block.',
    steps: [
      'Open the content asset, script, or publishing workspace tied to this block.',
      'Complete the named proof, sequencing, or distribution task.',
      'Publish or stage the artifact where the next media step can consume it.',
      'Log any missing content dependency or channel blocker.',
    ],
    expectedOutput: normalizeText(block?.expectedOutput) || 'Published or staged content artifact with channel-ready metadata',
    acceptanceEvidence:
      normalizeText(block?.passEvidence) ||
      'A published/staged content artifact plus the link, file, or checklist showing it is ready for distribution or review',
    doneWhen:
      'The content artifact is staged or published with enough metadata and packaging for the next distribution step to proceed.',
    whyThisExists: 'Media proof in P1 must demonstrate reliable content flow, not just abstract narrative intent.',
    confidence: 'high',
  });
}

function buildRevenueBreakdown(block, hierarchy, initiativeDisplay) {
  return buildResult(block, hierarchy, initiativeDisplay, {
    laneLabel: 'Revenue',
    initiativeLabel: initiativeDisplay.initiative || 'Revenue Bridge',
    workType: normalizeLower(block?.title).includes('review') ? 'review' : 'execution',
    intent: 'Move the immediate revenue path closer to proof so runway is protected during P1.',
    plainAction: 'Advance the offer, client path, or commercial mechanism named in the block until it produces a concrete revenue artifact.',
    steps: [
      'Open the offer, client list, commercial script, or pricing artifact named by this block.',
      'Complete the next commercial action: validate the offer, update the asset, or prepare the outreach package.',
      'Capture the artifact that proves the revenue path moved forward.',
      'Record any blocker that prevents the next sales or delivery action.',
    ],
    expectedOutput: normalizeText(block?.expectedOutput) || 'Offer validation artifact or revenue-path execution package',
    acceptanceEvidence:
      normalizeText(block?.passEvidence) ||
      'A concrete commercial artifact such as an offer sheet, outreach package, signed note, or validation log that the next step can consume',
    doneWhen:
      'A specific revenue artifact exists and the next commercial action is materially easier or immediately available.',
    whyThisExists: 'Revenue bridge work is part of P1 proof because it protects runway while product and launch evidence mature.',
    confidence: 'high',
  });
}

function buildOperationsBreakdown(block, hierarchy, initiativeDisplay) {
  return buildResult(block, hierarchy, initiativeDisplay, {
    laneLabel: 'Operations',
    initiativeLabel: initiativeDisplay.initiative || 'Operating System',
    workType: normalizeLower(block?.title).includes('review') ? 'review' : 'preparation',
    intent: 'Define or verify an operating control that keeps execution disciplined as the plan scales.',
    plainAction: 'Build or review the checklist, control, or cadence mechanism named in the block so the operator can use it directly.',
    steps: [
      'Open the current checklist, SOP, or operating-control artifact.',
      'Add or revise the control named in the block.',
      'Test that the control is usable in the current operating cycle.',
      'Record any missing dependency that prevents the control from being adopted.',
    ],
    expectedOutput: normalizeText(block?.expectedOutput) || 'Usable operating checklist or control artifact',
    acceptanceEvidence:
      normalizeText(block?.passEvidence) ||
      'A checklist, SOP, or control artifact that an operator can execute immediately without inventing missing steps',
    doneWhen:
      'The control exists in a usable form and the operator can run it during the current operating cycle.',
    whyThisExists: 'P1 proof is fragile without explicit operating controls that keep execution repeatable.',
    confidence: 'high',
  });
}

function buildCapitalIpBreakdown(block, hierarchy, initiativeDisplay) {
  return buildResult(block, hierarchy, initiativeDisplay, {
    laneLabel: 'Capital / IP',
    initiativeLabel: initiativeDisplay.initiative || 'Capital / IP',
    workType: normalizeLower(block?.title).includes('review') ? 'review' : 'preparation',
    intent: 'Advance a legal, IP, or capital-readiness prerequisite that protects the launch corridor.',
    plainAction: 'Complete the specific protection, filing, or capital-readiness task named in the block and document the resulting artifact.',
    steps: [
      'Open the filing, legal memo, capital note, or rights artifact tied to this block.',
      'Complete the named protection or readiness task.',
      'Export the resulting memo, filing packet, or decision artifact.',
      'Record any external dependency that prevents completion.',
    ],
    expectedOutput: normalizeText(block?.expectedOutput) || 'Legal, IP, or capital-readiness artifact',
    acceptanceEvidence:
      normalizeText(block?.passEvidence) ||
      'A filing packet, memo, signed note, or readiness artifact that proves the prerequisite is materially closed',
    doneWhen:
      'The legal or capital prerequisite is closed enough that downstream launch or finance work can rely on it without guesswork.',
    whyThisExists: 'Operation Endgame cannot trust launch-facing proof if required protection or capital-readiness work stays implicit.',
    confidence: 'high',
  });
}

function buildInstitutionBreakdown(block, hierarchy, initiativeDisplay) {
  return buildResult(block, hierarchy, initiativeDisplay, {
    laneLabel: 'Institution',
    initiativeLabel: initiativeDisplay.initiative || 'Institution',
    workType: normalizeLower(block?.title).includes('review') ? 'review' : 'preparation',
    intent: 'Clarify the institution model enough that it remains strategically stable without becoming premature active execution.',
    plainAction: 'Define the named model assumption, operating rule, or proof prerequisite for the institution lane.',
    steps: [
      'Open the institution model artifact or planning document referenced by this block.',
      'Write the named assumption, rule, or dependency clearly enough for later execution planning.',
      'Link the model decision to the phase objective or later institutional milestone it supports.',
      'Record any prerequisite still missing before active institution execution should begin.',
    ],
    expectedOutput: normalizeText(block?.expectedOutput) || 'Institution model note with named assumptions and dependencies',
    acceptanceEvidence:
      normalizeText(block?.passEvidence) ||
      'A model note or planning artifact that names the assumption, the supported milestone, and the prerequisite chain',
    doneWhen:
      'The institution decision is explicit enough to preserve strategic structure without forcing premature execution.',
    whyThisExists: 'Institution work belongs in the long-horizon structure, but only explicit modeling keeps it from becoming vague filler.',
    confidence: 'high',
  });
}

function buildRealEstateBreakdown(block, hierarchy, initiativeDisplay) {
  const result = buildResult(block, hierarchy, initiativeDisplay, {
    laneLabel: 'Real Estate',
    initiativeLabel: 'Real Estate',
    workType: normalizeLower(block?.title).includes('gate') ? 'gate decision' : normalizeLower(block?.title).includes('review') ? 'review' : 'dependency resolution',
    intent: 'Keep the real-estate lane structurally present while only advancing prerequisites that are justified by proof, capital, or external timing.',
    plainAction: 'Confirm or close the specific real-estate prerequisite named in the block instead of treating the lane as free-floating execution.',
    steps: [
      'Open the corridor, property, or site-control note tied to this block.',
      'Verify the named prerequisite: legal, capital, revenue, partnership, or sequencing dependency.',
      'Document the exact gating condition and the artifact that proves it is satisfied or still blocked.',
      'Leave the lane deferred if the prerequisite is not met; do not convert it into generic active work.',
    ],
    expectedOutput: normalizeText(block?.expectedOutput) || 'Real-estate prerequisite memo with gating status and next dependency',
    acceptanceEvidence:
      normalizeText(block?.passEvidence) ||
      'A gating memo that names the prerequisite, the evidence it is met or unmet, and the next dependency that becomes available',
    doneWhen:
      'The real-estate lane is either explicitly deferred with a named blocker or advanced through a concrete prerequisite artifact.',
    whyThisExists: 'Real Estate is a long-horizon strategic lane and should only surface in active work when a real prerequisite or deadline justifies it.',
    confidence: 'high',
  });

  if (
    normalizeText(block?.phaseLabel).toUpperCase() === 'P1' &&
    (!hasP1RealEstateJustification(block) ||
      /\bdecide whether\b/.test(normalizeLower(block?.title || block?.label || block?.displayTitle)))
  ) {
    result.quality.failureCodes.push('LANE_CONTEXT_NOT_APPLIED');
    result.quality.failureCodes.push('BLOCK_DETAIL_AMBIGUOUS');
    result.quality.failureCodes.push('PREMATURE_INITIATIVE_ACTIVATION');
    result.quality.failureCodes.push('DEFERRED_LANE_SCHEDULED_AS_ACTIVE');
    result.quality.failureCodes.push('LONG_HORIZON_LANE_OVERWEIGHTED_IN_P1');
    result.quality.failureCodes.push('PHASE_PRIORITY_MISCLASSIFIED');
    result.quality.status = 'under_specified';
  }
  return result;
}

function buildGenericUnderSpecifiedBreakdown(block, hierarchy, initiativeDisplay) {
  const title = titleWithoutBoilerplate(block);
  const dependencies = resolveDependencies(block);
  return {
    initiativeLabel: initiativeDisplay.initiative || 'Unspecified Initiative',
    laneLabel: initiativeDisplay.lane || '',
    workType: inferWorkType(block),
    intent: title ? `The block title is present, but the system does not yet have enough lane-specific structure to explain why "${title}" exists.` : '',
    plainAction: '',
    steps: [],
    expectedOutput: normalizeText(block?.expectedOutput || ''),
    acceptanceEvidence: defaultAcceptanceEvidence(block),
    dependencies,
    whyThisExists: '',
    doneWhen: '',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'low',
    quality: {
      status: 'under_specified',
      failureCodes: uniqueStrings([
        !initiativeDisplay.lane ? 'INITIATIVE_LABEL_MISSING' : '',
        !initiativeDisplay.lane ? 'LANE_CONTEXT_NOT_APPLIED' : '',
        !title ? 'BLOCK_DETAIL_AMBIGUOUS' : '',
        title && normalizeLower(title) === normalizeLower(titleWithoutBoilerplate(block)) ? 'TITLE_REPEATED_AS_EXPLANATION' : '',
        'GENERIC_EXECUTION_INSTRUCTION',
        !normalizeText(block?.expectedOutput) ? 'MISSING_EXPECTED_OUTPUT' : '',
        !defaultAcceptanceEvidence(block) ? 'MISSING_ACCEPTANCE_EVIDENCE' : '',
        dependencies.requires.length || dependencies.unlocks.length ? '' : 'MISSING_DEPENDENCY_CONTEXT',
      ]),
    },
  };
}

export function resolveBlockPlainLanguage(block = {}, context = {}) {
  const hierarchy = context?.hierarchy || {};
  const cacheKey = buildPlainLanguageCacheKey(block, hierarchy);
  if (BLOCK_PLAIN_LANGUAGE_CACHE.has(cacheKey)) {
    return BLOCK_PLAIN_LANGUAGE_CACHE.get(cacheKey);
  }
  const initiativeDisplay = resolveInitiativeDisplay(block, hierarchy);
  const title = normalizeLower(block?.title || block?.label || block?.displayTitle);
  const lane = normalizeLower(initiativeDisplay.lane);
  let result = null;

  if (/\b(onboarding|sign-in|sign in|login|log in|profile restoration|launch blocker|app platform)\b/.test(title) || lane.includes('product')) {
    result = buildSoftwareTestBreakdown(block, hierarchy, initiativeDisplay);
  } else if (
    /\b(album|release asset|song|mix|master|track|creative|music|release engine)\b/.test(title) ||
    lane.includes('creative')
  ) {
    result = buildCreativeBreakdown(block, hierarchy, initiativeDisplay);
  } else if (/\b(podcast|content|episode|distribution|media|narrative|pipeline)\b/.test(title) || lane.includes('media')) {
    result = buildMediaBreakdown(block, hierarchy, initiativeDisplay);
  } else if (/\b(revenue|commercial|offer|sales|client|runway)\b/.test(title) || lane.includes('revenue')) {
    result = buildRevenueBreakdown(block, hierarchy, initiativeDisplay);
  } else if (/\b(operations|operator|checklist|control|system)\b/.test(title) || lane.includes('operations')) {
    result = buildOperationsBreakdown(block, hierarchy, initiativeDisplay);
  } else if (/\b(patent|trademark|legal|ip|capital|fundraise|financing)\b/.test(title) || lane.includes('capital')) {
    result = buildCapitalIpBreakdown(block, hierarchy, initiativeDisplay);
  } else if (/\b(institution|school|apprenticeship|education)\b/.test(title) || lane.includes('institution')) {
    result = buildInstitutionBreakdown(block, hierarchy, initiativeDisplay);
  } else if (/\b(real estate|district|civic|corridor|property|site)\b/.test(title) || lane === 'real estate') {
    result = buildRealEstateBreakdown(block, hierarchy, initiativeDisplay);
  } else {
    result = buildGenericUnderSpecifiedBreakdown(block, hierarchy, initiativeDisplay);
  }

  // Evaluate molecular quality from raw block fields (only fields explicitly provided on the block).
  const molecularQuality = computeMolecularQuality({
    expectedOutput: 'expectedOutput' in block ? block.expectedOutput : undefined,
    acceptanceEvidence: 'acceptanceEvidence' in block ? block.acceptanceEvidence : undefined,
    plainAction: 'plainAction' in block ? block.plainAction : undefined,
    steps: 'steps' in block ? block.steps : undefined,
    doneWhen: 'doneWhen' in block ? block.doneWhen : undefined,
  });

  if (result.quality) {
    const existingQuality = result.quality;
    result.quality = {
      ...existingQuality,
      status:
        existingQuality.status === 'under_specified' || molecularQuality.status === 'under_specified'
          ? 'under_specified'
          : existingQuality.status,
      failureCodes: [
        ...(existingQuality.failureCodes || []),
        ...molecularQuality.failureCodes.filter(
          (code) => !(existingQuality.failureCodes || []).includes(code),
        ),
      ],
    };
  } else {
    result.quality = molecularQuality;
  }

  if (BLOCK_PLAIN_LANGUAGE_CACHE.size >= BLOCK_PLAIN_LANGUAGE_CACHE_LIMIT) {
    const oldestKey = BLOCK_PLAIN_LANGUAGE_CACHE.keys().next().value;
    BLOCK_PLAIN_LANGUAGE_CACHE.delete(oldestKey);
  }
  BLOCK_PLAIN_LANGUAGE_CACHE.set(cacheKey, result);
  return result;
}

export default resolveBlockPlainLanguage;
