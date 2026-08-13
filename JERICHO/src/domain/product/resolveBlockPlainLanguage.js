import { projectEnterpriseDisplay } from '../enterprise/enterpriseDisplayProjection';
import { isHoldableNoun } from '../planQuality/isHoldableNoun';

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

function looksGenericNarrativeReason(value) {
  const normalized = normalizeComparableText(value);
  if (!normalized) {
    return true;
  }
  return (
    /consistent execution in .* supports launch readiness/.test(normalized) ||
    /written review with pass\/fail determination and evidence summary/.test(normalized) ||
    /audit report with findings gaps and status determination/.test(normalized) ||
    /validation result with evidence collected and criteria checked/.test(normalized) ||
    /readiness checklist with binary go\/no-go decision/.test(normalized) ||
    /expansion remains abstract without a specific asset path/.test(normalized)
  );
}

function normalizeComparableText(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[.?!,:;]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleRepeated(candidate, title) {
  const normalizedCandidate = normalizeComparableText(candidate);
  const normalizedTitle = normalizeComparableText(title);
  return Boolean(normalizedCandidate && normalizedTitle && normalizedCandidate === normalizedTitle);
}

function tokenizeComparable(value) {
  return normalizeComparableText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);
}

function computeTextOverlap(a, b) {
  const left = tokenizeComparable(a);
  const right = tokenizeComparable(b);
  if (left.length === 0 || right.length === 0) {
    return 0;
  }
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let shared = 0;
  leftSet.forEach((token) => {
    if (rightSet.has(token)) {
      shared += 1;
    }
  });
  return shared / Math.max(leftSet.size, rightSet.size, 1);
}

function fieldsCollapse(a, b, threshold = 0.85) {
  const left = normalizeComparableText(a);
  const right = normalizeComparableText(b);
  if (!left || !right) {
    return false;
  }
  if (left === right) {
    return true;
  }
  return computeTextOverlap(left, right) >= threshold;
}

function hasCompletedArtifactShape(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return false;
  }
  if (/\bcompletion record\b/i.test(normalized)) {
    return false;
  }
  if (startsWithActionVerb(normalized)) {
    return false;
  }
  if (
    /^(advanced|built|closed|completed|confirmed|coordinated|defined|documented|edited|established|evaluated|executed|finalized|mapped|planned|prepared|prioritized|proven|published|recorded|reviewed|run|selected|stabilized|submitted|tested|updated|validated|verified|widened)\b/i.test(
      normalized
    ) &&
    normalized.split(/\s+/).length >= 3
  ) {
    return true;
  }
  return /\b(report|record|memo|rules?|rule set|inventory|checklist|spec|brief|artifact|log|dashboard|plan|decision|decisions|mapping|matrix|proof|resolution|summary|worksheet|package|packet|sheet|register|profile|finding|findings|agreement|charter|commitment|asset|result)\b/i.test(
    normalized
  );
}

function meaningLooksAbstract(value, title) {
  const normalized = normalizeComparableText(value);
  if (!normalized) {
    return true;
  }
  if (titleRepeated(value, title)) {
    return true;
  }
  return /^(advance|complete|handle|move forward|work on|make progress on)\b/i.test(normalized);
}

function isExplicitlyMissing(value) {
  return isGenericDetail(value) || normalizeText(value) === '';
}

function isGenericWorkType(value) {
  const normalized = normalizeLower(value);
  return !normalized || /^(unknown|execution block|work block|action)$/i.test(normalized);
}

function titleLooksGeneric(value) {
  const normalized = normalizeLower(value);
  if (!normalized) {
    return false;
  }
  return (
    /^(clarify|figure out|handle|work on|make progress on)\b/.test(normalized) ||
    /^decide whether\b/.test(normalized) ||
    /\bnext move\b/.test(normalized)
  );
}

function computeMolecularQuality(block) {
  const failureCodes = [];
  const isForecastBlock = Boolean(block?.isForecastBlock);
  const placeholderText = [
    block?.intent,
    block?.plainAction,
    block?.doneWhen,
    block?.acceptanceEvidence,
    block?.expectedOutput,
  ]
    .map(normalizeComparableText)
    .join(' ');
  const synthesizedExpectedOutputMissing = isGenericDetail(block?.expectedOutput);
  const synthesizedAcceptanceEvidenceMissing = isGenericDetail(block?.acceptanceEvidence);
  const rawExpectedOutputMissing = !isForecastBlock && isExplicitlyMissing(block?.rawExpectedOutput);
  const rawAcceptanceEvidenceMissing = !isForecastBlock && isExplicitlyMissing(block?.rawAcceptanceEvidence);
  if (
    (!isForecastBlock && isExplicitlyMissing(block?.rawLaneLabel) && isExplicitlyMissing(block?.rawLaneId)) ||
    isGenericDetail(block?.laneLabel) ||
    /^(unknown|missing|unassigned)$/i.test(String(block?.laneLabel || '').trim())
  ) {
    failureCodes.push('UNKNOWN_LANE_IDENTITY');
    failureCodes.push('LANE_CONTEXT_NOT_APPLIED');
  }
  if ((!isForecastBlock && isGenericWorkType(block?.rawWorkType || block?.workType)) || /^unknown$/i.test(String(block?.workType || '').trim())) {
    failureCodes.push('UNKNOWN_WORK_TYPE');
  }
  if (!isForecastBlock && titleLooksGeneric(block?.title)) {
    failureCodes.push('GENERIC_EXECUTION_INSTRUCTION');
    failureCodes.push('INITIATIVE_LABEL_MISSING');
    failureCodes.push('ABSTRACT_BLOCK_MEANING');
    failureCodes.push('BLOCK_DETAIL_AMBIGUOUS');
  }
  if (meaningLooksAbstract(block?.intent, block?.title)) {
    failureCodes.push('ABSTRACT_BLOCK_MEANING');
    failureCodes.push('BLOCK_DETAIL_AMBIGUOUS');
  }
  if (titleRepeated(block?.plainAction, block?.title)) {
    failureCodes.push('TITLE_REPEATED_IN_DO_THIS');
    failureCodes.push('GENERIC_EXECUTION_INSTRUCTION');
  }
  if (titleRepeated(block?.doneWhen, block?.title)) {
    failureCodes.push('TITLE_REPEATED_IN_DONE_WHEN');
    failureCodes.push('COMPLETION_STANDARD_TOO_VAGUE');
  }
  if (titleRepeated(block?.expectedOutput, block?.title)) {
    failureCodes.push('TITLE_REPEATED_IN_PRODUCES');
    failureCodes.push('OUTPUT_ARTIFACT_TOO_VAGUE');
  }
  if (/progress note/.test(normalizeComparableText(block?.expectedOutput))) {
    failureCodes.push('GENERIC_PROGRESS_NOTE_ARTIFACT');
    failureCodes.push('OUTPUT_ARTIFACT_TOO_VAGUE');
  }
  if (
    /unspecified initiative|progress note|execution plan\b|next consumer|usable artifact/.test(placeholderText) ||
    /move [a-z0-9 /-]+ forward/.test(placeholderText)
  ) {
    failureCodes.push('PLACEHOLDER_EXECUTION_LANGUAGE');
  }
  if (/^(first revenue event|growth milestone)$/i.test(normalizeText(block?.title || ''))) {
    failureCodes.push('MILESTONE_RENDERED_AS_EXECUTION_BLOCK');
    failureCodes.push('BLOCK_DETAIL_AMBIGUOUS');
  }
  if (synthesizedExpectedOutputMissing || (rawExpectedOutputMissing && synthesizedExpectedOutputMissing)) {
    failureCodes.push('MISSING_EXPECTED_OUTPUT');
  }
  if (!hasCompletedArtifactShape(block?.expectedOutput)) {
    failureCodes.push('MISSING_COMPLETED_ARTIFACT');
  }
  // R3: the named artifact must be a concrete noun, not a verb phrase or participle.
  const rawProducesArtifact = normalizeText(block?.producesArtifact);
  if (rawProducesArtifact && !isHoldableNoun(rawProducesArtifact)) {
    failureCodes.push('OUTPUT_ARTIFACT_TOO_VAGUE');
  }
  if (synthesizedAcceptanceEvidenceMissing || (rawAcceptanceEvidenceMissing && synthesizedAcceptanceEvidenceMissing)) {
    failureCodes.push('MISSING_ACCEPTANCE_EVIDENCE');
  }
  if (
    synthesizedExpectedOutputMissing ||
    synthesizedAcceptanceEvidenceMissing ||
    (rawExpectedOutputMissing && synthesizedExpectedOutputMissing) ||
    (rawAcceptanceEvidenceMissing && synthesizedAcceptanceEvidenceMissing)
  ) {
    failureCodes.push('BLOCK_DETAIL_TOO_ABSTRACT');
  }
  const hasPlainAction = !isGenericDetail(block?.plainAction);
  const hasSteps = Array.isArray(block?.steps) && block.steps.length > 0;
  if (!hasPlainAction && !hasSteps) {failureCodes.push('BLOCK_DETAIL_DO_THIS_EMPTY');}
  if (isGenericDetail(block?.doneWhen)) {failureCodes.push('BLOCK_DETAIL_DONE_WHEN_EMPTY');}
  if (isGenericDetail(block?.completionAssertion)) {failureCodes.push('MISSING_COMPLETION_ASSERTION');}
  // ATTESTATION CONTRACT (Truth Communication layer).
  // Per the contract: "Any measurable target entered into the system must be
  // accompanied by Target + Verification Source + Operator Attestation."
  // The gate enforces the triple precisely on the unit the contract names —
  // the TARGET. A block without an explicit `target` field is not making a
  // measurable claim and the triple is not required. A block that declares a
  // target MUST also declare verificationSource and operatorAttestation. The
  // resolver never synthesizes the triple, so these codes fire whenever a
  // claim-bearing block lacks the canonical fields.
  const hasTarget = !isExplicitlyMissing(block?.target);
  if (hasTarget && isExplicitlyMissing(block?.verificationSource)) {
    failureCodes.push('MISSING_VERIFICATION_SOURCE');
  }
  if (hasTarget && isExplicitlyMissing(block?.operatorAttestation)) {
    failureCodes.push('MISSING_OPERATOR_ATTESTATION');
  }
  // MATRIX SECTION 1A — the verification source named on the block must
  // appear in the operator-declared registry (state.matrix.verificationSourcesById).
  // Soft mode: when the registry is empty (day 1, no sources declared yet),
  // we do not enforce membership — only the canonical-presence codes above fire.
  // Once the operator declares ≥1 source, every block that names a source
  // outside the registry fails this code.
  const declaredSourceLabels = Array.isArray(block?.declaredVerificationSourceLabels)
    ? block.declaredVerificationSourceLabels
    : [];
  if (
    declaredSourceLabels.length > 0 &&
    !isExplicitlyMissing(block?.verificationSource) &&
    !declaredSourceLabels
      .map((label) => String(label || '').trim().toLowerCase())
      .includes(String(block?.verificationSource || '').trim().toLowerCase())
  ) {
    failureCodes.push('UNDECLARED_VERIFICATION_SOURCE');
  }
  // MATRIX SECTION 2 — every block that claims membership in an entity
  // (block.entityId) must point at an id present in the operator-declared
  // node registry (state.matrix.entitiesById). Soft mode: empty registry
  // or absent entityId is not punished — the gate only fires when a block
  // is making a claim and the claim points at a ghost entity.
  const declaredEntityIds = Array.isArray(block?.declaredEntityIds)
    ? block.declaredEntityIds
    : [];
  const claimedEntityId = String(block?.entityId || '').trim();
  if (
    declaredEntityIds.length > 0 &&
    claimedEntityId &&
    !declaredEntityIds.includes(claimedEntityId)
  ) {
    failureCodes.push('UNDECLARED_NODE');
  }
  // MATRIX SECTION 5 — block.projectId must resolve in the declared
  // projects registry when the registry has ≥1 entry.
  const declaredProjectIds = Array.isArray(block?.declaredProjectIds)
    ? block.declaredProjectIds
    : [];
  const claimedProjectId = String(block?.projectId || '').trim();
  if (
    declaredProjectIds.length > 0 &&
    claimedProjectId &&
    !declaredProjectIds.includes(claimedProjectId)
  ) {
    failureCodes.push('UNDECLARED_PROJECT');
  }
  // MATRIX SECTION 6 — block.producesArtifactId must resolve in the declared
  // artifacts registry when the registry has ≥1 entry.
  const declaredArtifactIds = Array.isArray(block?.declaredArtifactIds)
    ? block.declaredArtifactIds
    : [];
  const claimedArtifactId = String(block?.producesArtifactId || '').trim();
  if (
    declaredArtifactIds.length > 0 &&
    claimedArtifactId &&
    !declaredArtifactIds.includes(claimedArtifactId)
  ) {
    failureCodes.push('UNDECLARED_ARTIFACT');
  }
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

const COMPLETED_ARTIFACT_PREFIX = new Map([
  ['advance', 'Advanced'],
  ['build', 'Built'],
  ['close', 'Closed'],
  ['complete', 'Completed'],
  ['confirm', 'Confirmed'],
  ['coordinate', 'Coordinated'],
  ['define', 'Defined'],
  ['document', 'Documented'],
  ['edit', 'Edited'],
  ['establish', 'Established'],
  ['evaluate', 'Evaluated'],
  ['execute', 'Executed'],
  ['finalize', 'Finalized'],
  ['map', 'Mapped'],
  ['plan', 'Planned'],
  ['prepare', 'Prepared'],
  ['prove', 'Proven'],
  ['publish', 'Published'],
  ['record', 'Recorded'],
  ['review', 'Reviewed'],
  ['run', 'Run'],
  ['select', 'Selected'],
  ['stabilize', 'Stabilized'],
  ['submit', 'Submitted'],
  ['test', 'Tested'],
  ['update', 'Updated'],
  ['validate', 'Validated'],
  ['verify', 'Verified'],
  ['widen', 'Widened'],
]);

function toCompletedArtifactLabel(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }
  const match = normalized.match(/^([A-Za-z]+)\b(.*)$/);
  if (!match) {
    return normalized;
  }
  const [, verb, remainder] = match;
  const completedPrefix = COMPLETED_ARTIFACT_PREFIX.get(verb.toLowerCase());
  if (!completedPrefix) {
    return normalized;
  }
  const trimmedRemainder = remainder.trim();
  return trimmedRemainder ? `${completedPrefix} ${trimmedRemainder}` : completedPrefix;
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
    const stripped = stripTitlePrefix(raw);
    return startsWithActionVerb(stripped) ? toCompletedArtifactLabel(stripped) : stripped;
  }
  return defaultArtifact(block, initiativeDisplay);
}

function resolveEvidence(block = {}, artifact = '', title = '') {
  const raw = normalizeText(block?.acceptanceEvidence || block?.passEvidence);
  if (raw && !looksGenericNarrativeReason(raw)) {
    return stripTitlePrefix(raw);
  }
  const fallbackTitle = stripTitlePrefix(title);
  if (artifact) {
    return `${artifact} is saved, reviewable, and shows the completed change or decision.`;
  }
  return `${fallbackTitle || 'The scheduled work'} is complete and the result is visible in a saved artifact.`;
}

function resolveWhyThisExists(block = {}, consumers = []) {
  const reason = normalizeText(block?.missConsequence);
  if (reason && !looksGenericNarrativeReason(reason) && /\b(because|so that|to)\b/i.test(reason)) {
    return ensureSentence(reason);
  }
  if (consumers.length > 0) {
    return 'So that later scheduled work can proceed without a missing prerequisite or open question, this block records the current decision or proof.';
  }
  return '';
}

function hasPurposeGrammar(value) {
  const normalized = normalizeComparableText(value);
  return Boolean(normalized) && /\b(because|so that|so [a-z]|to [a-z])/i.test(normalized) && !/^proof that\b/i.test(normalized);
}

function isCompletedTitleShell(value, actionTitle = '') {
  const normalizedValue = normalizeComparableText(value);
  const normalizedTitle = normalizeComparableText(actionTitle);
  if (!normalizedValue || !normalizedTitle) {
    return false;
  }
  const completedShell = normalizeComparableText(toCompletedArtifactLabel(actionTitle));
  return normalizedValue === normalizedTitle || (completedShell && normalizedValue === completedShell);
}

function isGenericArtifactShell(value) {
  const normalized = normalizeComparableText(value);
  return (
    !normalized ||
    /^documented( [a-z0-9 /-]+)? status record with blocker list$/.test(normalized) ||
    /^completed work result with completion record$/.test(normalized)
  );
}

function resolveCompletionAssertion(block = {}, artifact = '', doneWhen = '') {
  const explicit =
    normalizeText(block?.completionAssertion) ||
    normalizeText(block?.completionAttestation) ||
    normalizeText(block?.completingThisAsserts);
  if (explicit) {
    return ensureSentence(explicit);
  }
  if (artifact) {
    return ensureSentence(`Completing this asserts the operator produced ${artifact} and it meets the stated completion condition.`);
  }
  if (doneWhen) {
    return ensureSentence(`Completing this asserts the operator verified: ${doneWhen.replace(/[.!?]+$/g, '')}.`);
  }
  return 'Completing this asserts the operator completed the scheduled work and can point to the result.';
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
  if (/\bcapital\b|\bip\b|legal|patent/.test(haystack)) {
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
  const canonicalEntity =
    enterpriseProjection?.provenanceStatus === 'unsupported' || normalizeText(enterpriseProjection?.displayName) === 'Unknown'
      ? ''
      : enterpriseProjection?.displayName || '';
  const canonicalLaneLabel =
    normalizeText(block?.laneLabel || block?.laneName || hierarchy?.lane) || normalizedLane || canonicalEntity;
  const titleHaystack = normalizeLower(
    [block?.displayTitle, block?.title, block?.label, block?.laneLabel, block?.laneName, explicitInitiative, normalizedLane].join(
      ' '
    )
  );

  if (/jericho system|app platform|onboarding|product platform/.test(titleHaystack)) {
    return {
      initiative: 'Jericho System',
      lane: canonicalLaneLabel || 'Operation Endgame app platform',
      entity: canonicalEntity || 'Global State Systems',
    };
  }
  if (/album|release engine|blackman|d8 n8|our fearless leader|romance riot/.test(titleHaystack)) {
    return {
      initiative: 'Release Engine',
      lane: canonicalLaneLabel || 'Operation Endgame album release engine',
      entity: canonicalEntity || 'Global State Corp.',
    };
  }
  if (/podcast|media narrative|help yourself|state of control|content pipeline/.test(titleHaystack)) {
    return {
      initiative: /help yourself|imaginary ceo/.test(titleHaystack) ? 'Podcast Pilot' : 'Media Narrative Pipeline',
      lane: canonicalLaneLabel || 'Operation Endgame media narrative pipeline',
      entity: canonicalEntity || 'Global State Productions',
    };
  }
  if (/timing-slip|non-negotiables|hard-anchor|dependency sequence|schedule churn|governance/.test(titleHaystack)) {
    return {
      initiative: 'Operating System',
      lane: 'Operation Endgame studio operations system',
      entity: 'Global State Solutions',
    };
  }
  if (/job-search|income demands|runway pressure|execution calendar/.test(titleHaystack)) {
    return {
      initiative: 'Runway Plan',
      lane: canonicalLaneLabel || 'Operation Endgame runway and income support',
      entity: 'Capital Path or Revenue Engine',
    };
  }
  if (/services revenue|revenue bridge|offer|sales/.test(titleHaystack)) {
    return {
      initiative: /buyer|offer|qualification|proposal|discovery|sales|segment|icp/.test(titleHaystack)
        ? 'First Offer'
        : 'Revenue Bridge',
      lane: canonicalLaneLabel || 'Operation Endgame services revenue bridge',
      entity: /f8|energy gum|energy gym/.test(titleHaystack) ? 'F8 Energy Co.' : 'Capital Path or Revenue Engine',
    };
  }
  if (/studio operations|operator checklist|operating system/.test(titleHaystack)) {
    return {
      initiative: 'Operating System',
      lane: canonicalLaneLabel || 'Operation Endgame studio operations system',
      entity: canonicalEntity || 'Global State Solutions',
    };
  }
  if (/institution|apprenticeship|school/.test(titleHaystack)) {
    return {
      initiative: /curriculum|compliance/.test(titleHaystack) ? 'Curriculum and Compliance Readiness' : 'Institutional Product',
      lane: canonicalLaneLabel || 'Operation Endgame apprenticeship institution design',
      entity: canonicalEntity || 'Global State Academy',
    };
  }
  if (/real estate|district|civic|corridor|property|site/.test(titleHaystack)) {
    return {
      initiative: /stakeholder|coalition|agency|partner/.test(titleHaystack) ? 'Stakeholder Map' : 'Real Estate Readiness',
      lane: canonicalLaneLabel || 'Operation Endgame district coalition development',
      entity: canonicalEntity || 'Global State Holdings',
    };
  }
  if (/patent|\bip\b|trademark|legal/.test(titleHaystack)) {
    return {
      initiative: 'Capital / IP',
      lane: canonicalLaneLabel || 'Operation Endgame capital stack',
      entity: canonicalEntity || 'Capital Path or Revenue Engine',
    };
  }
  if (explicitInitiative) {
    return {
      initiative: explicitInitiative,
      lane: canonicalLaneLabel || canonicalEntity || explicitInitiative,
      entity: canonicalEntity || canonicalLaneLabel || explicitInitiative,
    };
  }
  return {
    initiative: canonicalLaneLabel || canonicalEntity || 'Unspecified Initiative',
    lane: canonicalLaneLabel || canonicalEntity,
    entity: canonicalEntity || canonicalLaneLabel,
  };
}

function defaultArtifact(block, initiativeDisplay) {
  return (
    normalizeText(block?.expectedOutput || block?.artifactLabel || block?.outputLabel || block?.deliverableLabel) ||
    (initiativeDisplay?.initiative && initiativeDisplay.initiative !== initiativeDisplay.lane
      ? `Documented ${initiativeDisplay.initiative} status record with blocker list`
      : 'Documented status record with blocker list')
  );
}

function buildRoleSafeArtifact(parts, initiativeName) {
  const subject = normalizeText(parts?.subject || initiativeName || 'current work');
  if (/^document$/.test(parts?.verb)) {
    return `Documented ${subject} record with status, gaps, and next actions`;
  }
  if (/^define$/.test(parts?.verb)) {
    return `Defined ${subject} standard with scope and decision boundaries`;
  }
  if (/^(validate|verify|test)$/.test(parts?.verb)) {
    return `Validated ${subject} record with findings and next corrections`;
  }
  if (/^(review|evaluate)$/.test(parts?.verb)) {
    return `Reviewed ${subject} record with findings and next actions`;
  }
  if (/^map$/.test(parts?.verb)) {
    return `Mapped ${subject} with dependencies, conflicts, and protected windows`;
  }
  if (/^prepare$/.test(parts?.verb)) {
    return `Prepared ${subject} package with required inputs`;
  }
  if (/^record$/.test(parts?.verb)) {
    return `Recorded ${subject} source asset with session notes`;
  }
  if (/^(complete|edit|publish|update|finalize|build|execute|run|submit)$/.test(parts?.verb)) {
    return `${toCompletedArtifactLabel(parts?.actionTitle || subject)} with handoff record`;
  }
  return `${toCompletedArtifactLabel(parts?.actionTitle || subject) || 'Completed work result'} with completion record`;
}

function buildRoleSafeDoneWhen(parts, initiativeName) {
  const subject = normalizeText(parts?.subject || initiativeName || 'current work');
  if (/^document$/.test(parts?.verb)) {
    return `A current record for ${subject} lists the facts, open gaps, and next actions in one reviewable place.`;
  }
  if (/^define$/.test(parts?.verb)) {
    return `The standard for ${subject} is written with clear scope, decision rules, and boundary notes the operator can apply without guessing.`;
  }
  if (/^(validate|verify|test)$/.test(parts?.verb)) {
    return `${subject} has explicit check results, any failed condition is logged, and the accepted next correction or confirmation is recorded.`;
  }
  if (/^(review|evaluate)$/.test(parts?.verb)) {
    return `The review for ${subject} names the current state, the meaningful issue or finding, and the next decision or follow-up action.`;
  }
  if (/^map$/.test(parts?.verb)) {
    return `A usable map shows ${subject}, the active constraints, and the dependency or conflict points the schedule must respect.`;
  }
  if (/^prepare$/.test(parts?.verb)) {
    return `The package for ${subject} contains every required input and each missing item is either resolved or explicitly flagged.`;
  }
  return `The completed result for ${subject} is visible, usable by the next step, and paired with a recorded follow-up or handoff note.`;
}

function buildRoleSafeEvidence(parts, initiativeName) {
  const subject = normalizeText(parts?.subject || initiativeName || 'current work');
  if (/^document$/.test(parts?.verb)) {
    return `Saved ${subject} record with timestamp, current facts, open gaps, and named next-action owners.`;
  }
  if (/^define$/.test(parts?.verb)) {
    return `Saved ${subject} standard with scope notes, decision boundaries, and the operator-facing rule set.`;
  }
  if (/^(validate|verify|test)$/.test(parts?.verb)) {
    return `Saved validation record for ${subject} with criteria checked, findings, blocking gaps, and the next correction or confirmation.`;
  }
  if (/^(review|evaluate)$/.test(parts?.verb)) {
    return `Saved review record for ${subject} with the current state, named findings, and the chosen next move or owner.`;
  }
  if (/^map$/.test(parts?.verb)) {
    return `Saved map of ${subject} with named constraints, conflict notes, dependency points, and protected windows.`;
  }
  if (/^prepare$/.test(parts?.verb)) {
    return `Saved prepared package for ${subject} with included inputs, metadata checks, and any remaining missing-item notes.`;
  }
  return `Saved completed result for ${subject} with location, timestamp, and the next handoff or follow-up note.`;
}

function alignWorkTypeToVerb(verb, currentWorkType = '') {
  const normalizedCurrent = normalizeText(currentWorkType);
  const inferred = inferWorkTypeFromVerb(verb, '');
  if (!inferred) {
    return normalizedCurrent;
  }
  if (!normalizedCurrent || /^(unknown|execution block|work block|action|distribution)$/i.test(normalizedCurrent)) {
    return inferred;
  }
  if (
    (/^(validate|verify|test|review|evaluate)$/.test(verb) && normalizedCurrent !== 'Validation') ||
    (/^(document|map|define|prepare)$/.test(verb) && normalizedCurrent !== 'Planning') ||
    (/^(build|close|complete|coordinate|edit|execute|finalize|publish|record|run|submit|update)$/.test(verb) &&
      normalizedCurrent !== 'Execution')
  ) {
    return inferred;
  }
  return normalizedCurrent;
}

function stabilizeResolvedDetailRoles(result, block, hierarchy, initiativeDisplay) {
  const parts = inferActionParts(block);
  const initiativeName = initiativeDisplay?.initiative || hierarchy?.initiative || hierarchy?.lane || 'the current initiative';
  const fallbackIntent = buildFallbackIntent(parts.actionTitle, initiativeName);
  const fallbackPurpose = buildFallbackPurpose(parts.verb, parts.subject || initiativeName, initiativeName);
  const fallbackAction = buildFallbackPlainAction(parts.verb, parts.subject || initiativeName, initiativeName);
  const rawArtifact = normalizeText(result?.artifact || result?.expectedOutput);
  const rawAcceptanceEvidence = normalizeText(result?.acceptanceEvidence);
  const artifactNeedsRewrite =
    isGenericArtifactShell(rawArtifact) ||
    (isCompletedTitleShell(rawArtifact, parts.actionTitle) &&
      (!rawAcceptanceEvidence || fieldsCollapse(rawAcceptanceEvidence, rawArtifact) || /^proof that\b/i.test(normalizeComparableText(rawAcceptanceEvidence))));
  const artifact =
    artifactNeedsRewrite
      ? buildRoleSafeArtifact(parts, initiativeName)
      : rawArtifact;
  const rawMeaning = normalizeText(result?.intent);
  const meaning =
    !rawMeaning || meaningLooksAbstract(rawMeaning, parts.actionTitle) || fieldsCollapse(rawMeaning, result?.plainAction)
      ? ensureSentence(fallbackIntent)
      : ensureSentence(rawMeaning);
  const rawWhy = normalizeText(result?.whyThisExists);
  const whyThisExists =
    !hasPurposeGrammar(rawWhy) ||
    /^this block exists so\b/i.test(rawWhy) ||
    fieldsCollapse(rawWhy, result?.plainAction) ||
    fieldsCollapse(rawWhy, result?.doneWhen) ||
    fieldsCollapse(rawWhy, result?.acceptanceEvidence)
      ? ensureSentence(fallbackPurpose)
      : ensureSentence(rawWhy);
  const rawPlainAction = normalizeText(result?.plainAction);
  const plainAction =
    !rawPlainAction || titleRepeated(rawPlainAction, parts.actionTitle) || fieldsCollapse(rawPlainAction, whyThisExists)
      ? ensureSentence(fallbackAction)
      : ensureSentence(rawPlainAction);
  const rawDoneWhen = normalizeText(result?.doneWhen);
  const doneWhen =
    !rawDoneWhen ||
    /the scheduled work is complete/i.test(rawDoneWhen) ||
    titleRepeated(rawDoneWhen, parts.actionTitle) ||
    fieldsCollapse(rawDoneWhen, artifact) ||
    fieldsCollapse(rawDoneWhen, result?.acceptanceEvidence)
      ? ensureSentence(buildRoleSafeDoneWhen(parts, initiativeName))
      : ensureSentence(rawDoneWhen);
  const acceptanceEvidence =
    !rawAcceptanceEvidence ||
    looksGenericNarrativeReason(rawAcceptanceEvidence) ||
    /is saved, reviewable, and shows the completed change or decision/i.test(rawAcceptanceEvidence) ||
    fieldsCollapse(rawAcceptanceEvidence, artifact) ||
    fieldsCollapse(rawAcceptanceEvidence, whyThisExists) ||
    fieldsCollapse(rawAcceptanceEvidence, doneWhen) ||
    /^proof that\b/i.test(normalizeComparableText(rawAcceptanceEvidence))
      ? ensureSentence(buildRoleSafeEvidence(parts, initiativeName))
      : ensureSentence(rawAcceptanceEvidence);

  return {
    ...result,
    intent: meaning,
    whyThisExists,
    plainAction,
    doneWhen,
    artifact,
    expectedOutput: artifact,
    acceptanceEvidence,
    workType: alignWorkTypeToVerb(parts.verb, result?.workType || block?.workType || ''),
    completionAssertion: resolveCompletionAssertion(block, artifact, doneWhen),
  };
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

function hardAnchorProtectionBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact =
    resolveArtifact(block, initiativeDisplay) ||
    'Validated hard-anchor rule set';
  const acceptanceEvidence =
    resolveEvidence(block, artifact, block?.title || block?.label) ||
    'Written hard-anchor protection rules linked to the active cycle and fixed anchors.';
  return {
    intent:
      'Define and verify the rules that keep fixed Operation Endgame anchors from moving while reassessment reorganizes live schedule dates around them.',
    plainAction:
      'Review each fixed anchor, document what cannot move, and mark which schedule dates may reflow without deleting owed work.',
    steps: [
      'List the hard anchors that must stay fixed in the current Operation Endgame phase.',
      'Write the protection rule for each anchor, including what may move and what may not move.',
      'Check that mandatory work and prerequisite gates still exist after reassessment.',
      'Record the reassessment trigger that forces regeneration instead of silent activation.',
    ],
    doneWhen:
      'Every fixed anchor has a written protection rule, the allowed reflow boundary is explicit, and owed mandatory work is still traceable in the plan.',
    artifact: 'Validated hard-anchor rule set',
    acceptanceEvidence:
      'Written hard-anchor protection rule set or checklist linked to the active cycle, fixed anchors, and preserved mandatory work.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so reassessment can reorganize live dates without silently moving fixed anchors or dropping owed work.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Validation',
  };
}

function inferActionParts(block = {}) {
  const cleanedTitle = stripOperationEndgamePhrasing(block?.title || block?.label || block?.displayTitle);
  const actionTitle = stripTitlePrefix(cleanedTitle);
  const match = actionTitle.match(
    /^(advance|build|close|complete|confirm|coordinate|define|document|evaluate|execute|finalize|map|prepare|publish|review|run|submit|test|validate|verify)\b\s*(.*)$/i
  );
  return {
    actionTitle,
    verb: match ? match[1].toLowerCase() : '',
    subject: match ? normalizeText(match[2]) : actionTitle,
  };
}

function inferWorkTypeFromVerb(verb, fallback = '') {
  const normalizedFallback = normalizeText(fallback);
  if (normalizedFallback && !/^Execution$/i.test(normalizedFallback)) {
    return normalizedFallback;
  }
  if (/^(validate|verify|test|review|evaluate)$/.test(verb)) {
    return 'Validation';
  }
  if (/^(document|map|define|prepare)$/.test(verb)) {
    return 'Planning';
  }
  return 'Execution';
}

function buildFallbackPurpose(verb, subjectReference, initiativeName) {
  const subject = normalizeText(subjectReference || initiativeName || 'the current work');
  if (/^(document|map|define|prepare)$/.test(verb)) {
    return `So that later execution can proceed without ambiguity, this block records the concrete scope, status, or inputs for ${subject}.`;
  }
  if (/^(review|evaluate|validate|verify|test)$/.test(verb)) {
    return `Because later execution would rely on an unchecked assumption, this block verifies the current state of ${subject} before the next step commits to it.`;
  }
  if (/^(record|publish|build|complete|update|finalize)$/.test(verb)) {
    return `To protect the next scheduled step, this block produces a concrete result for ${subject} that can be reviewed and used immediately.`;
  }
  return `So that ${subject} has a concrete next-state record instead of implied progress, this block creates an observable result.`;
}

function buildFallbackIntent(actionTitle, initiativeName) {
  if (actionTitle) {
    return `Translate ${actionTitle} into plain operator work with a concrete result and observable completion standard.`;
  }
  return `Explain the next concrete operator move for ${initiativeName} in plain language.`;
}

function buildFallbackPlainAction(verb, subjectReference, initiativeName) {
  const subject = normalizeText(subjectReference || initiativeName || 'the current work');
  if (/^review$/.test(verb)) {
    return `Open the current ${subject}, check what changed, and record the specific update, risk, or next move that follows from that review.`;
  }
  if (/^prepare$/.test(verb)) {
    return `Gather the required inputs for ${subject}, fill the obvious gaps, and assemble the package needed for the next execution step.`;
  }
  if (/^document$/.test(verb)) {
    return `Write the current facts about ${subject}, organize them into a usable record, and call out the unresolved gap or next move.`;
  }
  if (/^define$/.test(verb)) {
    return `Write the scope, decision rule, and boundary for ${subject}, then record what is in and out of scope.`;
  }
  return `Complete the concrete operator work for ${subject} and save the resulting artifact or decision record.`;
}

function buildFallbackDoneWhen(verb, subjectReference, artifact) {
  const subject = normalizeText(subjectReference || 'the scheduled work');
  if (/^review$/.test(verb)) {
    return `The review for ${subject} records the current state, the specific issue or decision found, and the next action that follows from it.`;
  }
  if (/^prepare$/.test(verb)) {
    return `The package for ${subject} is assembled, the missing inputs are identified, and ${artifact.toLowerCase()} is ready for the next execution step.`;
  }
  return `${artifact} exists, is specific enough to use, and the completion condition for ${subject} is visible in the saved result.`;
}

function buildStakeholderTrackerReviewBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Updated stakeholder and partner tracker with next-contact decisions';
  return {
    intent:
      'Translate the stakeholder and partner tracker into a current operating view so the next outreach move is based on live relationships instead of stale assumptions.',
    plainAction:
      'Open the current stakeholder tracker, review each priority contact, update status and dependency notes, and decide the next contact move for every active relationship.',
    steps: [
      'Open the current stakeholder and partner tracker.',
      'Review each priority contact, its current status, and the last meaningful movement.',
      'Update dependency notes, risk notes, and the next contact move for every active relationship.',
      'Flag the relationships that block the next outreach or operating milestone.',
    ],
    doneWhen:
      'The tracker shows current status, dependency notes, and a decided next contact move for each priority stakeholder or partner.',
    artifact,
    acceptanceEvidence:
      'Saved stakeholder tracker with updated status notes, dependency flags, and next-contact decisions for each priority relationship.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'Because outreach and dependency decisions degrade when relationship status goes stale, this block refreshes the tracker the next move depends on.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Validation',
  };
}

function buildDistributionUploadBreakdown(block, hierarchy, initiativeDisplay) {
  const normalizedTitle = normalizeLower(block?.title || block?.label);
  const isPrimarySubmission = normalizedTitle.includes('primary distribution submission');
  const isStatusVerification = normalizedTitle.includes('distribution status verification');
  const artifact = isPrimarySubmission
    ? 'Primary distribution submission package with verified release files and metadata'
    : isStatusVerification
      ? 'Distribution status verification record with current submission outcome and next release action'
      : 'Distribution upload package with verified release files and metadata';
  return {
    intent: isPrimarySubmission
      ? 'Convert release readiness into one verified primary-distribution submission so launch timing depends on a confirmed handoff instead of an assumed upload.'
      : isStatusVerification
        ? 'Check the current distribution submission state so release operations react to the real platform outcome instead of treating an older upload as still valid.'
        : 'Translate release-file upload into a concrete distribution package so release operations depend on a verified asset set instead of an implied handoff.',
    plainAction: isPrimarySubmission
      ? 'Collect the final release files, confirm the primary-platform metadata, submit the package to the main distribution target, and record any blocking submission issue immediately.'
      : isStatusVerification
        ? 'Open the current distribution submission, verify the live platform status, capture any rejection or missing requirement, and record the exact next release follow-up.'
        : 'Collect the final release files, confirm the required metadata, upload the package to the distribution target, and record any blocking submission issue.',
    steps: isPrimarySubmission
      ? [
          'Gather the final audio, artwork, and metadata required for the primary distribution target.',
          'Verify that filenames, versions, territories, and metadata fields match the intended release package.',
          'Submit the package to the main distribution platform and capture any submission issue immediately.',
          'Record the submission confirmation, blocker, and next release follow-up.',
        ]
      : isStatusVerification
        ? [
            'Open the current distribution submission record and confirm the latest platform status.',
            'Check whether the package is accepted, pending, rejected, or missing required release inputs.',
            'Capture the exact rejection reason, metadata gap, or approval evidence from the platform.',
            'Record the next release action required to clear or monitor the submission.',
          ]
        : [
            'Gather the final audio, artwork, and metadata required for distribution.',
            'Verify that filenames, versions, and metadata fields match the intended release package.',
            'Upload the package to the distribution target and capture any submission issue immediately.',
            'Record the resulting package status and the next release follow-up.',
          ],
    doneWhen: isPrimarySubmission
      ? 'The primary distribution package is submitted with verified release assets and metadata, or a specific submission blocker is recorded with the exact missing requirement.'
      : isStatusVerification
        ? 'The live distribution status is verified and the current submission outcome, blocker, or next release action is saved in the release record.'
        : 'A verified distribution package is uploaded or a specific blocking submission issue is recorded with the exact asset or metadata gap.',
    artifact,
    acceptanceEvidence: isPrimarySubmission
      ? 'Saved primary submission record with uploaded files, verified metadata, platform confirmation or rejection details, and the next release follow-up.'
      : isStatusVerification
        ? 'Saved submission-status record with platform outcome, rejection or approval evidence, named blocker if present, and the next release action.'
        : 'Saved distribution package record with uploaded files, verified metadata, submission status, and the next release follow-up or blocker.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists: isPrimarySubmission
      ? 'Because launch timing breaks when the main distributor handoff is only assumed, this block creates the verified primary submission the release path depends on.'
      : isStatusVerification
        ? 'Because an earlier upload can still fail after submission, this block confirms the live platform outcome before the release path is treated as clear.'
        : 'Because release timing breaks when file submission is assumed instead of verified, this block creates the distribution package the launch path depends on.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Distribution',
  };
}

function buildBrandPositioningBriefBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Updated positioning brief with prioritized outreach move and message rationale';
  return {
    intent:
      'Turn the current brand positioning into one explicit outreach move so narrative work produces a live market-facing action instead of a static note.',
    plainAction:
      'Review the current positioning brief, tighten the message for the next audience or partner target, and record the exact outreach move that should happen next.',
    steps: [
      'Open the latest positioning brief and identify the audience, message angle, and current gap.',
      'Update the brief so the core message, proof point, and audience hook are explicit.',
      'Choose the next outreach move that best tests or advances that positioning.',
      'Record the owner, target, and timing for that next outreach move.',
    ],
    doneWhen:
      'A current positioning brief states the message rationale, the target audience or partner, and the specific next outreach move to run.',
    artifact,
    acceptanceEvidence:
      'Saved positioning brief with updated message rationale, target audience or partner, chosen outreach move, owner, and timing.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'Because positioning only matters when it informs a real next market move, this block turns narrative work into a specific outreach action.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Planning',
  };
}

function buildReleaseCopyReviewBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Reviewed release rollout package with approved copy, asset fixes, and metadata actions';
  return {
    intent:
      'Check the release-facing copy, visuals, and store metadata together so rollout quality depends on one coherent package instead of disconnected review passes.',
    plainAction:
      'Review the current release copy, visual rollout assets, and store metadata, then record the exact approval, correction, or missing item for each release-facing surface.',
    steps: [
      'Open the current release copy, visuals, and store metadata package being treated as launch-ready.',
      'Check each surface for correctness, consistency, and missing release information.',
      'Record which items are approved now and which ones still require correction.',
      'Save the next action for every blocking copy, visual, or metadata issue.',
    ],
    doneWhen:
      'One reviewed rollout package shows approved items, blocking issues, and the exact next action for each copy, visual, or metadata gap.',
    artifact,
    acceptanceEvidence:
      'Saved rollout package review with approved copy, visual asset fixes, metadata actions, and named next steps for every blocker.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'Because release readiness breaks when copy, visuals, and metadata drift apart, this block forces one coherent rollout-quality check before launch sequencing depends on it.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Validation',
  };
}

function buildProductFeedbackPrioritizationBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Prioritized beta feedback review with next development cycle decisions';
  return {
    intent:
      'Turn current beta feedback into a concrete next-cycle decision set so product iteration follows observed user evidence instead of unranked commentary.',
    plainAction:
      'Review the live beta feedback, group the strongest signals, and decide which fixes, features, or flow changes should enter the next development cycle first.',
    steps: [
      'Collect the current beta feedback signals, issues, and feature requests affecting the product lane.',
      'Group the feedback by severity, frequency, and user-flow impact.',
      'Choose the changes that most deserve the next development-cycle focus.',
      'Record which feedback stays deferred and why it lost priority.',
    ],
    doneWhen:
      'A next-cycle decision set shows the highest-priority beta findings, the chosen follow-up changes, and the items deliberately deferred.',
    artifact,
    acceptanceEvidence:
      'Saved beta feedback prioritization with grouped findings, ranked next-cycle changes, deferred items, and the rationale for each decision.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'Because beta feedback only improves the product when it becomes a ranked decision set, this block turns live user signals into next-cycle priorities.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Validation',
  };
}

function buildPromoMaterialBatchBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Prepared promo material batch with approved social, press, and visual assets';
  return {
    intent:
      'Assemble the next release-promotion asset batch so rollout execution depends on a ready campaign package instead of scattered creative pieces.',
    plainAction:
      'Prepare the current social, press, and visual promo assets, confirm what is approved, and package the batch for the next release-promotion move.',
    steps: [
      'List the social, press, and visual assets required for the next promotion window.',
      'Prepare or update each asset so the message, format, and release references are correct.',
      'Mark which assets are approved now and which still need revision.',
      'Package the approved batch and record the next promotion use or missing-item blocker.',
    ],
    doneWhen:
      'A promotion batch exists with approved social, press, and visual assets plus a clear record of any asset still blocking the next rollout move.',
    artifact,
    acceptanceEvidence:
      'Saved promo material batch with approved social, press, and visual assets, remaining revision items, and the next promotion use noted.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'Because promotion work stalls when assets stay scattered or half-approved, this block packages the next release-facing asset batch into one usable campaign set.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Planning',
  };
}

function buildLaunchAssetInventoryBreakdown(block, hierarchy, initiativeDisplay, parts) {
  const assetScope = parts.subject.replace(/\s*launch asset inventory$/i, '').trim() || 'launch';
  const artifact = 'Documented launch asset inventory with status and ownership map';
  return {
    intent: ensureSentence(
      `Explain which ${assetScope} launch assets already exist, which are missing, and what still needs preparation before release work can move`
    ),
    plainAction:
      'List every album, app, and podcast launch asset, note where it lives, mark its current status, and assign the next action for anything missing or outdated.',
    steps: [
      'Create one inventory covering album, app, and podcast launch assets.',
      'For each asset, record owner, storage location, current status, and release dependency.',
      'Flag missing, outdated, or unapproved assets and assign the next corrective action.',
      'Highlight the assets that block launch sequencing if they stay incomplete.',
    ],
    doneWhen:
      'A single inventory shows each album, app, and podcast asset with its status, owner, location, dependency, and next action.',
    artifact,
    acceptanceEvidence:
      'Saved launch asset inventory covering album, app, and podcast assets with status labels, owners, missing-item flags, and next actions.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so launch sequencing decisions are based on a current asset list instead of assumptions about what is already ready.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Planning',
  };
}

function buildDependencySequenceBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Validated first-cycle milestone dependency sequence';
  return {
    intent:
      'Check that the first-cycle milestone order is correct so downstream work starts only after its required predecessors are actually ready.',
    plainAction:
      'Review the first-cycle milestones in order, confirm each prerequisite handoff, and record any dependency that is missing, reversed, or timed too late.',
    steps: [
      'List the first-cycle milestones in the order they are supposed to happen.',
      'Verify the prerequisite for each milestone and identify what proves that prerequisite is complete.',
      'Mark dependency gaps, timing conflicts, or reversed sequencing.',
      'Update the sequence record so the next planning pass uses the corrected order.',
    ],
    doneWhen:
      'The first-cycle milestone sequence has a checked prerequisite chain and every broken dependency is explicitly flagged for correction.',
    artifact,
    acceptanceEvidence:
      'Saved first-cycle dependency sequence showing milestone order, prerequisite links, confirmed handoffs, and any blocking gaps.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so the cycle does not activate downstream milestones on top of missing upstream work.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Validation',
  };
}

function buildCalendarMappingBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Mapped job-search and income demand calendar alignment';
  return {
    intent:
      'Show how job-search and income obligations fit against the execution calendar so survival work and plan work can coexist without hidden collisions.',
    plainAction:
      'Map every job-search and income obligation onto the execution calendar, identify time conflicts, and mark the non-negotiable windows that constrain schedule decisions.',
    steps: [
      'List recurring and one-off job-search obligations.',
      'List income-producing commitments, deadlines, and required prep time.',
      'Place those demands against the execution calendar and mark collisions or overload days.',
      'Document the protected windows the live schedule must respect.',
    ],
    doneWhen:
      'The calendar shows job-search and income demands, conflict zones, and protected windows that must shape execution planning.',
    artifact,
    acceptanceEvidence:
      'Saved calendar map showing job-search obligations, income commitments, conflict notes, and protected execution windows.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so execution planning accounts for survival constraints instead of scheduling around an imaginary open calendar.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Planning',
  };
}

function buildTimingSlipNonNegotiablesBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Defined timing-slip non-negotiable rule set';
  return {
    intent:
      'Identify which anchors, obligations, and proof requirements cannot be sacrificed if timing slips so reassessment does not quietly trade away the real mission.',
    plainAction:
      'List the constraints that must survive a timing slip, explain why each one is protected, and note what may flex without breaking the phase.',
    steps: [
      'List the dates, deliverables, or obligations that must remain intact if the schedule moves.',
      'Write why each protected item is non-negotiable and what failure it prevents.',
      'Separate protected items from work that may slide, compress, or re-sequence.',
      'Record the trigger that forces reassessment instead of silent compromise.',
    ],
    doneWhen:
      'A written rule set identifies the protected items, the allowed flex zone, and the reassessment trigger for timing slips.',
    artifact,
    acceptanceEvidence:
      'Saved timing-slip non-negotiable rule set with protected anchors, allowed flex items, and reassessment triggers.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so schedule pressure does not erase the commitments that make the current phase credible.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Planning',
    phaseJustification: 'Hard-anchor protection',
  };
}

function buildStakeholderMapBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Documented stakeholder map with asks and next-contact plan';
  return {
    intent:
      'Show who matters to this lane, what each stakeholder controls, and what ask or follow-up is required next.',
    plainAction:
      'List the relevant stakeholders, note their role and leverage, capture the current relationship state, and assign the next outreach or follow-up step.',
    steps: [
      'List the people, partners, or institutions that materially affect this lane.',
      'Record what each stakeholder controls, why they matter, and the current relationship status.',
      'Define the next ask, contact path, or dependency tied to each stakeholder.',
      'Flag any stakeholder gap that blocks the next phase move.',
    ],
    doneWhen:
      'A stakeholder map exists with names, roles, leverage, current status, next ask, and follow-up owner.',
    artifact,
    acceptanceEvidence:
      'Saved stakeholder map showing each stakeholder, role, leverage, current status, next ask, and follow-up owner.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so external dependencies are managed deliberately instead of remaining an unnamed source of schedule drift.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Planning',
  };
}

function buildRealEstateAssetThesisBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Validated asset or real-estate thesis memo with prerequisite proof';
  return {
    intent:
      'Check whether the asset or real-estate thesis is real enough to inform planning without pulling deferred lane work into execution prematurely.',
    plainAction:
      'Review the thesis assumptions, confirm the prerequisite proof that exists today, and record what is still missing before active execution is justified.',
    steps: [
      'Summarize the asset or real-estate thesis in one concrete statement.',
      'List the prerequisite proof already available, including legal, capital, runway, or dependency evidence.',
      'Mark which assumptions are still unproven and what gate blocks active execution.',
      'Record whether the thesis stays forecast-only or qualifies as prerequisite proof work.',
    ],
    doneWhen:
      'A thesis memo states the current proof, the missing proof, and whether this work remains deferred or qualifies as prerequisite-only preparation.',
    artifact,
    acceptanceEvidence:
      'Saved thesis memo with prerequisite proof evidence, missing-proof list, and explicit forecast-versus-prerequisite classification.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so deferred real-estate or asset work is not mistaken for immediate execution without real prerequisite proof.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Validation',
    phaseJustification: 'Prerequisite proof',
  };
}

function buildMediaEpisodeBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Recorded media narrative episode source session';
  return {
    intent:
      'Capture the next publishable source session for the media narrative pipeline so the content lane keeps moving with a real episode asset.',
    plainAction:
      'Record the next episode source session, cover the planned topic, and save the raw take with enough structure for edit and release follow-through.',
    steps: [
      'Confirm the episode topic, audience purpose, and required segments before recording.',
      'Record the full source session with the planned talking points or interview flow.',
      'Save the raw take, title it clearly, and note the edit or distribution follow-up.',
      'Log any missing segment or retake required before publication.',
    ],
    doneWhen:
      'A clearly saved raw episode session exists with topic coverage, usable source audio, and the next edit or release step logged.',
    artifact,
    acceptanceEvidence:
      'Saved raw episode recording with topic label, session notes, and the next edit or distribution follow-up recorded.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so the media lane advances through a real recorded asset, not a placeholder title about future content.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Execution',
  };
}

function buildProductSprintBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Completed product sprint change set with verified next release target';
  return {
    intent:
      'Deliver one concrete product change instead of treating the sprint as an abstract progress bucket.',
    plainAction:
      'Choose the next highest-value product change, implement it, verify the result, and record the remaining blocker or next release target.',
    steps: [
      'Name the single feature, fix, or integration this sprint is supposed to finish.',
      'Implement the change and note any dependency or blocker discovered during the work.',
      'Run the relevant checks or direct product verification for the changed path.',
      'Record the shipped result and the next release target or remaining blocker.',
    ],
    doneWhen:
      'One concrete product change is finished, verified, and logged with the next release target or blocker.',
    artifact,
    acceptanceEvidence:
      'Saved sprint result showing the completed change, verification result, owner, and next release target or blocker.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so the product lane advances through a real shipped change instead of a generic sprint placeholder.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Execution',
  };
}

function buildAlbumReleaseExecutionBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Completed release-engine session with next release dependency logged';
  return {
    intent:
      'Complete one concrete recording or release-prep session that produces a usable album release asset.',
    plainAction:
      'Complete the scheduled recording or release-prep session, save the asset produced, and log the next dependency required for release.',
    steps: [
      'Name the exact recording, edit, or release-prep asset this session is supposed to finish.',
      'Run the session and save the resulting audio, asset package, or release-prep output.',
      'Check whether the finished asset clears or exposes the next release dependency.',
      'Record the next release dependency, owner, and timing.',
    ],
    doneWhen:
      'A concrete album release asset or prep result is finished, saved, and linked to the next release dependency.',
    artifact,
    acceptanceEvidence:
      'Saved session output with asset name, completion status, storage location, and next release dependency logged.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so album rollout progress is tied to a real release asset instead of an abstract push toward release.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Execution',
  };
}

function buildBrandPositioningOutreachBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Updated positioning and outreach tracker with next relationship move';
  return {
    intent:
      'Complete one concrete positioning or partnership move instead of leaving brand progress as a vague relationship label.',
    plainAction:
      'Review the current positioning narrative and active relationship targets, then complete the next outreach or positioning move that matters most.',
    steps: [
      'Name the target relationship, audience, or positioning change this block is meant to advance.',
      'Update the relevant message, asset, or outreach note needed for that move.',
      'Send or record the next outreach step, or finalize the positioning change for immediate use.',
      'Log the response state, blocker, or next relationship move.',
    ],
    doneWhen:
      'A concrete positioning or partnership move is completed and the next relationship step is logged.',
    artifact,
    acceptanceEvidence:
      'Saved positioning or outreach tracker showing the completed move, target, response state, and next step.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so visibility and partnership progress are measured through real moves, not generic momentum language.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Execution',
  };
}

function buildRunwayPipelineExecutionBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Updated revenue pipeline tracker with completed outreach and next close action';
  return {
    intent:
      'Complete the next concrete outreach or follow-up actions that can move a live deal closer to revenue.',
    plainAction:
      'Work the active leads and offers, complete the next outreach or follow-up steps, and record the next action most likely to protect runway.',
    steps: [
      'Review the live leads, offers, and pending follow-ups in the revenue pipeline.',
      'Complete the highest-priority outreach or follow-up actions for the current cycle.',
      'Update the stage, blocker, and owner for each touched opportunity.',
      'Record the next close-oriented action that most directly protects runway.',
    ],
    doneWhen:
      'The revenue pipeline shows the completed outreach work, updated stages, and the next close-oriented action.',
    artifact,
    acceptanceEvidence:
      'Saved pipeline tracker with touched opportunities, completed outreach or follow-ups, updated stage labels, and the next close action.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so runway protection is driven by completed deal work instead of a generic sense of pipeline progress.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Execution',
  };
}

function buildIncomeProgressBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Evaluated income progress with next high-leverage runway action';
  return {
    intent:
      'Check current income progress so the runway bridge can choose the single next action with the best near-term leverage.',
    plainAction:
      'Review the current income signals, compare the live revenue options, and record the next high-leverage action most likely to protect runway.',
    steps: [
      'Review the current income generated, pending opportunities, and immediate runway pressure.',
      'Compare the live options that could improve income inside the current cycle.',
      'Choose the next high-leverage action and state why it beats the alternatives.',
      'Assign the owner and timing for the chosen action.',
    ],
    doneWhen:
      'An income progress review names the current state, the best next action, and the owner and timing for that move.',
    artifact,
    acceptanceEvidence:
      'Saved income progress review with current income state, compared options, chosen high-leverage action, owner, and timing.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so runway decisions are tied to one explicit next move instead of a vague sense of income momentum.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Validation',
  };
}

function buildMediaEditPublishBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Edited and published media narrative episode with release record';
  return {
    intent:
      'Finish the latest media narrative episode through publication so the media lane advances with a real released asset.',
    plainAction:
      'Edit the latest episode, publish it to the intended channel, and record the release details needed for follow-through.',
    steps: [
      'Open the latest raw episode and complete the required edit pass.',
      'Export the publishable asset and upload it to the intended channel or platform.',
      'Record the title, publish link, and any release notes or distribution metadata.',
      'Log the next promotion or metrics-review follow-up.',
    ],
    doneWhen:
      'A publishable episode is edited, released, and logged with its release details and next follow-up.',
    artifact,
    acceptanceEvidence:
      'Saved publish record with episode title, release link, release timestamp, and next promotion or metrics follow-up.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so the podcast pilot advances through a released episode, not an abstract publish intention.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Execution',
  };
}

function buildMediaPlanningBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Planned next media content outline with production structure';
  return {
    intent:
      'Define the next media episode or content unit clearly enough that production can start without inventing the structure on the fly.',
    plainAction:
      'Choose the next topic, outline the structure, and record the production notes needed to create the next content asset.',
    steps: [
      'Select the next topic or narrative thread the content should cover.',
      'Outline the segment flow, talking points, or production structure.',
      'Note any research, guest, or asset dependency needed before recording.',
      'Assign the next production step and timing.',
    ],
    doneWhen:
      'A content outline exists with topic, structure, dependencies, and the next production step.',
    artifact,
    acceptanceEvidence:
      'Saved content outline with topic choice, structure, dependencies, and named next production step.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so media production starts from a concrete outline instead of improvising the next content unit from scratch.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Planning',
  };
}

function buildAppStoreMetadataBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Updated app store listing package with current metadata and landing page copy';
  return {
    intent:
      'Refresh the product platform listing surfaces so launch-facing metadata and landing copy match the current product state.',
    plainAction:
      'Update the app store listing, metadata fields, and landing page copy, then record the version that should ship next.',
    steps: [
      'Review the current app state, positioning, and any new release details that must appear publicly.',
      'Update the listing copy, metadata fields, screenshots, or supporting landing-page text.',
      'Check that the public-facing information is consistent across listing and landing surfaces.',
      'Record the version ready for the next submission or launch window.',
    ],
    doneWhen:
      'The listing package is updated and the next shippable metadata version is recorded.',
    artifact,
    acceptanceEvidence:
      'Saved listing package with updated metadata, public copy, screenshots or links, and the next submission-ready version noted.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so public product surfaces reflect the real product state instead of stale launch metadata.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Execution',
  };
}

function buildLaunchReadinessCadenceBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Updated launch readiness check with current blocker and go-live status';
  return {
    intent:
      'Assess launch readiness against the current blocker, stability, and go-live conditions so the product lane does not drift into premature launch language.',
    plainAction:
      'Review the current stability state, monitoring signals, and go-live blocker list, then record the next readiness move or blocker to clear.',
    steps: [
      'Check the current blocker list, stability issues, and monitoring signals tied to go-live.',
      'Confirm what is already ready versus what still prevents launch.',
      'Record the next readiness action or blocker-clearing task with owner and timing.',
      'Update the go-live status for the next cycle decision.',
    ],
    doneWhen:
      'A readiness check states the current go-live status, open blockers, and the next readiness move.',
    artifact,
    acceptanceEvidence:
      'Saved launch readiness check with blocker list, current status, owner, and next go-live action.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so launch readiness is governed by real blocker status instead of a generic push toward go-live.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Validation',
  };
}

function buildReleasePromotionBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Updated release promotion package with next distribution action';
  return {
    intent:
      'Complete the next concrete distribution or pre-save setup step needed for the album rollout.',
    plainAction:
      'Update the distribution setup, pre-save campaign, or promotion assets that are next in line, then record the next distribution action.',
    steps: [
      'Review the current distribution setup and promotion checklist for the release.',
      'Complete the next missing distribution, pre-save, or promotion task.',
      'Save the updated asset, link, or checklist result in the release package.',
      'Record the next distribution action or blocker still open.',
    ],
    doneWhen:
      'A concrete distribution or promotion step is completed and the next release action is recorded.',
    artifact,
    acceptanceEvidence:
      'Saved release promotion package showing the completed setup step, updated assets or links, and the next distribution action.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so release promotion progress is tied to a finished distribution step instead of a generic push toward promotion.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Execution',
  };
}

function buildContentPipelineProofBreakdown(block, hierarchy, initiativeDisplay) {
  const normalizedTitle = normalizeLower(block?.title || block?.label);
  const artifact = 'Documented podcast pilot distribution proof log';
  return {
    intent:
      'Show whether the podcast pilot content pipeline is consistently producing, packaging, and moving content toward distribution proof.',
    plainAction:
      'Review the current content pipeline sequence, check each handoff from capture through distribution, and log the stage that is blocking repeatable output.',
    steps: [
      'List the current episode or content items moving through the pipeline.',
      'Check capture, edit, packaging, and distribution handoffs for each item.',
      'Record which handoff is complete, blocked, late, or still missing an owner.',
      'Log the next correction that will improve repeatable distribution proof.',
    ],
    doneWhen:
      'A proof log shows the current content item stages, the blocked handoffs, the responsible owner, and the next action required for repeatable distribution.',
    artifact,
    acceptanceEvidence:
      'Saved distribution proof log with current episode stages, missing handoffs, named owners, and the next corrective action for pipeline consistency.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so the media lane can prove repeatable distribution behavior instead of relying on vague content momentum.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: /^plan\b/.test(normalizedTitle) ? 'Planning' : /audit|review|validate/.test(normalizedTitle) ? 'Validation' : 'Planning',
  };
}

function buildCapitalOpportunityBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Selected first capital-ready opportunity with underwriting notes';
  return {
    intent:
      'Choose the first capital-ready opportunity that is concrete enough to pursue without spreading attention across speculative options.',
    plainAction:
      'Compare the current candidate opportunities, score them against capital-readiness criteria, and record why the selected option wins now.',
    steps: [
      'List the live opportunity candidates still under consideration.',
      'Score each candidate for proof status, capital fit, dependency risk, and time-to-move.',
      'Select the top opportunity and record the disqualifying reason for the others.',
      'Write the immediate next step required to move the chosen opportunity forward.',
    ],
    doneWhen:
      'One opportunity is selected with a written score rationale, disqualified alternatives, and a named next step for pursuit.',
    artifact,
    acceptanceEvidence:
      'Saved underwriting notes showing candidate scores, the selected opportunity, the rejected options, and the next pursuit step.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so the capital path narrows to one concrete opportunity instead of staying abstract.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Validation',
  };
}

function buildCoalitionPrerequisiteBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Coalition prerequisite proof memo with blocked paths';
  return {
    intent:
      'Check whether the civic or real-estate path has enough prerequisite proof to remain visible without being mistaken for active execution.',
    plainAction:
      'Review the current coalition prerequisites, mark what proof exists today, and list the missing dependencies that keep the path deferred.',
    steps: [
      'List the coalition, civic, or property-path prerequisites that must clear before execution.',
      'Mark which prerequisites have real proof and which remain assumptions.',
      'Record the dependency gaps that keep the lane forecast-only.',
      'Classify the work as prerequisite proof rather than active execution if the gaps remain open.',
    ],
    doneWhen:
      'A prerequisite memo states the current proof, the missing proof, and the reason the lane remains deferred or becomes eligible for a later phase.',
    artifact,
    acceptanceEvidence:
      'Saved coalition prerequisite memo with proof status, dependency gaps, and explicit deferred-versus-later-phase classification.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so deferred property or coalition work stays tied to proof requirements instead of quietly entering execution.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Validation',
    phaseJustification: 'Prerequisite proof',
  };
}

function buildInstitutionPrerequisiteBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Institution prerequisite proof memo with gating list';
  return {
    intent:
      'Check the legal and operating prerequisites for the institutional path without treating the institution lane as current-phase execution.',
    plainAction:
      'Review the legal, operating, and proof prerequisites for the institutional path, then record what is missing before the lane can become active.',
    steps: [
      'List the legal, operating, credibility, and proof prerequisites for the institutional path.',
      'Mark which prerequisites are already satisfied and which remain missing.',
      'Write the gating list that still keeps the lane deferred.',
      'Record the next proof step required before the lane can move into a later active phase.',
    ],
    doneWhen:
      'A prerequisite memo identifies the satisfied conditions, the missing conditions, and the gating list that keeps the institutional path deferred until later proof exists.',
    artifact,
    acceptanceEvidence:
      'Saved institutional prerequisite memo with satisfied conditions, missing conditions, and the gating list tied to later-phase activation.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so the institutional path stays disciplined around prerequisite proof instead of consuming P1 energy as speculative execution.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Validation',
    phaseJustification: 'Prerequisite proof',
  };
}

function buildFuturePhaseGateBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Prerequisite gate decision with unmet dependencies';
  return {
    intent:
      'Decide whether this future-phase lane has enough prerequisite proof to stay visible in P1 without being treated as active execution.',
    plainAction:
      'Review the prerequisite evidence for this lane, compare it to the gate criteria, and record whether the lane stays deferred or qualifies for later-phase movement.',
    steps: [
      'List the prerequisite proof this lane must show before direct execution is allowed.',
      'Compare the current evidence to the gate criteria and mark what is still missing.',
      'Record the gate outcome as deferred, blocked, or later-phase ready.',
      'Write the next proof step required before this lane can consume more phase energy.',
    ],
    doneWhen:
      'A gate decision states the current evidence, the missing dependencies, and whether the lane remains deferred or becomes eligible for later-phase activation.',
    artifact,
    acceptanceEvidence:
      'Saved gate decision with prerequisite evidence, missing dependencies, and explicit deferred-versus-later-phase outcome.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so future-phase lanes stay governed by proof requirements instead of quietly absorbing current-phase execution energy.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Validation',
    phaseJustification: 'Prerequisite proof',
  };
}

function buildRevenuePipelineReviewBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Reviewed revenue pipeline with next revenue actions';
  return {
    intent:
      'Check the current revenue pipeline so the runway bridge advances through the next concrete revenue action instead of a vague commercial status.',
    plainAction:
      'Review the active revenue leads, offers, and follow-ups, then record the next revenue action that most directly protects runway.',
    steps: [
      'List the active revenue opportunities or offer threads in play.',
      'Mark each one by current stage, blocker, and likely next move.',
      'Choose the next revenue action that best protects runway in the current cycle.',
      'Assign the owner and timing for that next action.',
    ],
    doneWhen:
      'A reviewed pipeline shows the active revenue opportunities, their blockers, and the next revenue action chosen for the current cycle.',
    artifact,
    acceptanceEvidence:
      'Saved revenue pipeline review with stage labels, blockers, chosen next action, owner, and target timing.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so runway protection is driven by one clear next revenue move rather than a generic sense of pipeline progress.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Validation',
  };
}

function buildOfferDefinitionBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Updated first-offer definition and pricing brief';
  return {
    intent:
      'Refine the current first-offer definition and pricing so buyer outreach is tied to one concrete commercial package.',
    plainAction:
      'Review the current offer definition, update the pricing logic, and record the exact version that should be used for the next buyer conversation.',
    steps: [
      'Review the current offer scope, buyer promise, and pricing assumptions.',
      'Adjust the pricing or packaging where the current version is unclear or weak.',
      'Record the final offer definition to use in the next outreach cycle.',
      'Note any unresolved pricing risk that still needs evidence.',
    ],
    doneWhen:
      'A current offer brief states the offer scope, pricing, buyer promise, and the next outreach-ready version to use.',
    artifact,
    acceptanceEvidence:
      'Saved first-offer brief with updated scope, pricing, buyer promise, and the version approved for next outreach.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so revenue outreach uses one coherent offer instead of inconsistent packaging or pricing.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Validation',
  };
}

function buildAlbumAssetReviewBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Reviewed album launch asset package with release-ready status';
  return {
    intent:
      'Check whether the album mastering, mix, and artwork assets are actually release-ready before launch sequencing depends on them.',
    plainAction:
      'Review the current mastering, mix, and artwork assets, confirm what is final, and record any asset that still blocks release readiness.',
    steps: [
      'Open the current mastering, mix, and artwork assets being treated as final.',
      'Confirm which assets are approved, missing, outdated, or still awaiting revision.',
      'Record the release blocker for any asset that is not actually ready.',
      'Save the release-ready status package for the next launch-planning handoff.',
    ],
    doneWhen:
      'A release-ready status package shows which album assets are final, which still block release, and what next correction is required.',
    artifact,
    acceptanceEvidence:
      'Saved album asset review package with approval status, blocking gaps, and the next correction for any non-final asset.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so launch planning depends on verified album assets instead of assumed readiness.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Validation',
  };
}

function buildListenerMetricsBreakdown(block, hierarchy, initiativeDisplay) {
  const artifact = 'Reviewed listener metrics with content strategy adjustment';
  return {
    intent:
      'Use real listener metrics to decide what content adjustment should happen next in the podcast pilot.',
    plainAction:
      'Review the latest listener metrics, identify the strongest and weakest performance signals, and record the next content strategy adjustment to test.',
    steps: [
      'Open the most recent listener or audience metrics for the current content cycle.',
      'Identify the strongest signal, weakest signal, and the likely reason for each.',
      'Choose one concrete strategy adjustment to test next.',
      'Record the owner and timing for that adjustment.',
    ],
    doneWhen:
      'A listener-metrics review records the meaningful signals, the strategy adjustment chosen, and the owner for the next test.',
    artifact,
    acceptanceEvidence:
      'Saved metrics review with audience signals, the selected strategy adjustment, and the owner and timing for the next test.',
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
    whyThisExists:
      'This block exists so content strategy changes are driven by observed audience behavior instead of intuition alone.',
    dependencies: {
      requires: resolveDependencyLabels(block),
      unlocks: resolveConsumerLabels(block, initiativeDisplay),
    },
    workType: 'Validation',
  };
}

function buildVerbAwareBreakdown(block, hierarchy, initiativeDisplay, parts) {
  const initiativeName = initiativeDisplay?.initiative || hierarchy?.initiative || hierarchy?.lane || 'the current initiative';
  const artifact = resolveArtifact(block, initiativeDisplay);
  const acceptanceEvidence = resolveEvidence(block, artifact, parts.actionTitle);
  const dependencies = resolveDependencyLabels(block);
  const consumers = resolveConsumerLabels(block, initiativeDisplay);
  const subjectLower = parts.subject.toLowerCase();
  const subjectReference = subjectLower || initiativeName.toLowerCase();

  const templates = {
    document: {
      intent: `Explain the current state of ${subjectReference} in plain operational terms so the operator can act from a real record.`,
      plainAction: `Capture the important facts about ${subjectReference}, organize them into a usable record, and call out anything incomplete or unresolved.`,
      doneWhen: `A usable record explains ${subjectReference}, its current state, and any open gaps or follow-up actions.`,
      whyThisExists:
        'This block exists so the workstream can work from a current written record instead of memory or scattered notes.',
    },
    define: {
      intent: `Set the operating definition for ${subjectReference} so later work uses one clear standard.`,
      plainAction: `Write the scope, rules, and decision boundaries for ${subjectReference}, then note what is in and out of scope.`,
      doneWhen: `The definition for ${subjectReference} is written clearly enough that the operator can apply it without guessing.`,
      whyThisExists: 'This block exists so downstream execution uses a stable definition instead of conflicting interpretations.',
    },
    validate: {
      intent: `Confirm that ${subjectReference} is correct before execution depends on it.`,
      plainAction: `Check ${subjectReference} against the governing rules, note any mismatch, and record what must be corrected.`,
      doneWhen: `${parts.subject || 'The target'} has been checked, any mismatch is recorded, and the accepted version is explicit.`,
      whyThisExists: 'This block exists so execution does not proceed on an unverified assumption.',
    },
    map: {
      intent: `Make the relationship between ${subjectReference} visible enough to plan against.`,
      plainAction: `Lay out ${subjectReference}, show where it connects to the active schedule, and mark the conflicts or dependency points that matter.`,
      doneWhen: `A working map shows ${subjectReference} and the conflicts, dependencies, or protected windows it creates.`,
      whyThisExists: 'This block exists so schedule decisions reflect the real constraint map.',
    },
    prepare: {
      intent: `Assemble the inputs needed to move ${subjectReference} into the next executable state.`,
      plainAction: `Gather the required inputs for ${subjectReference}, fill obvious gaps, and package the result for the next execution step.`,
      doneWhen: `${parts.subject || 'The work package'} is assembled with the inputs the next execution step needs to proceed.`,
      whyThisExists: 'This block exists so the next execution step starts with a complete package instead of partial inputs.',
    },
  };

  const template = templates[parts.verb] || null;
  const fallbackIntent = `Capture one concrete update for ${initiativeName} so the operator can see what changed, what exists, and what still needs action`;
  const fallbackPlainAction = `Use this block to make one concrete update for ${initiativeName} and save a written record the operator can inspect`;
  const fallbackDoneWhen = `A concrete update for ${initiativeName} is saved, ${artifact} exists, and completion proof is recorded.`;
  const fallbackWhyThisExists =
    resolveWhyThisExists(block, consumers) || `This block exists so ${initiativeName} keeps moving with a concrete recorded output instead of an implied status.`;
  const explicitSteps = Array.isArray(block?.steps) ? block.steps.map(normalizeText).filter(Boolean) : [];
  const inferredSteps = [
    template ? template.plainAction : fallbackPlainAction,
    dependencies.length > 0 ? `Verify upstream inputs are ready: ${dependencies.join(', ')}.` : '',
    artifact ? `Create or update ${artifact}.` : '',
    consumers.length > 0 ? `Note which later work will use this result: ${consumers.join(', ')}.` : '',
    acceptanceEvidence ? `Capture completion proof: ${acceptanceEvidence}.` : '',
  ].filter(Boolean);
  const resolvedDoneWhen = ensureSentence(
    template?.doneWhen || (parts.actionTitle ? `The scheduled work is complete, ${artifact} exists, and completion proof is recorded.` : fallbackDoneWhen)
  );

  return {
    intent: ensureSentence(template?.intent || buildFallbackIntent(parts.actionTitle, initiativeName) || fallbackIntent),
    plainAction: ensureSentence(template?.plainAction || buildFallbackPlainAction(parts.verb, subjectReference, initiativeName) || fallbackPlainAction),
    steps: explicitSteps.length > 0 ? explicitSteps.map(ensureSentence) : inferredSteps.map(ensureSentence),
    doneWhen: resolvedDoneWhen,
    artifact,
    acceptanceEvidence: ensureSentence(acceptanceEvidence),
    completionAssertion: resolveCompletionAssertion(block, artifact, resolvedDoneWhen),
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: template ? 'high' : 'inferred',
    whyThisExists: ensureSentence(
      template?.whyThisExists || resolveWhyThisExists(block, consumers) || buildFallbackPurpose(parts.verb, subjectReference, initiativeName) || fallbackWhyThisExists
    ),
    dependencies: {
      requires: dependencies,
      unlocks: consumers,
    },
    workType: inferWorkTypeFromVerb(parts.verb, block?.milestoneType ? `Milestone ${normalizeText(block.milestoneType)}` : ''),
  };
}

function genericBreakdown(block, hierarchy, initiativeDisplay) {
  const parts = inferActionParts(block);
  const subjectLower = parts.subject.toLowerCase();
  const actionLower = parts.actionTitle.toLowerCase();
  if (/timing-slip non-negotiables/.test(actionLower)) {
    return buildTimingSlipNonNegotiablesBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/stakeholder map created/.test(actionLower)) {
    return buildStakeholderMapBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/real-estate or asset thesis validated/.test(actionLower)) {
    return buildRealEstateAssetThesisBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/content pipeline proof sequence|distribution consistency/.test(actionLower)) {
    return buildContentPipelineProofBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/record next .*media narrative pipeline episode/.test(actionLower)) {
    return buildMediaEpisodeBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/complete .*product platform development sprint/.test(actionLower)) {
    return buildProductSprintBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/complete recording session and advance .*album release engine toward release/.test(actionLower)) {
    return buildAlbumReleaseExecutionBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/advance .*brand and operations system partnerships and positioning/.test(actionLower)) {
    return buildBrandPositioningOutreachBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/advance .*runway bridge revenue pipeline/.test(actionLower)) {
    return buildRunwayPipelineExecutionBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/evaluate .*income progress and identify next high-leverage action/.test(actionLower)) {
    return buildIncomeProgressBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/complete edit and publish latest .*media narrative pipeline episode|edit and publish latest .*media narrative pipeline episode/.test(actionLower)) {
    return buildMediaEditPublishBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/plan next .*media narrative pipeline content/.test(actionLower)) {
    return buildMediaPlanningBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/update .*product platform app store listing, metadata, and landing page/.test(actionLower)) {
    return buildAppStoreMetadataBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/advance .*product platform launch readiness/.test(actionLower)) {
    return buildLaunchReadinessCadenceBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/advance .*album release engine distribution setup, pre-save campaign, and promotion/.test(actionLower)) {
    return buildReleasePromotionBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/capital-ready opportunity selected/.test(actionLower)) {
    return buildCapitalOpportunityBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/review .*revenue pipeline and identify next revenue actions/.test(actionLower)) {
    return buildRevenuePipelineReviewBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/review stakeholder and partner tracker/.test(actionLower)) {
    return buildStakeholderTrackerReviewBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/offer definition and pricing/.test(actionLower)) {
    return buildOfferDefinitionBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/document positioning brief and next outreach move/.test(actionLower)) {
    return buildBrandPositioningBriefBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/review release copy, visual rollout assets, and store metadata/.test(actionLower)) {
    return buildReleaseCopyReviewBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/review .*beta feedback and prioritize next development cycle/.test(actionLower)) {
    return buildProductFeedbackPrioritizationBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/prepare .*promo material batch/.test(actionLower)) {
    return buildPromoMaterialBatchBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/prepare and upload release files for distribution|prepare and upload release files for primary distribution submission|prepare and upload release files for distribution status verification/.test(actionLower)) {
    return buildDistributionUploadBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/review and finalize .*mastering, mix, and artwork assets/.test(actionLower)) {
    return buildAlbumAssetReviewBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/listener metrics and adjust content strategy/.test(actionLower)) {
    return buildListenerMetricsBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/coalition prerequisites/.test(actionLower)) {
    return buildCoalitionPrerequisiteBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/legal and operating prerequisites/.test(actionLower)) {
    return buildInstitutionPrerequisiteBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (/evaluate gate for early execution|evaluate gate for direct district execution/.test(actionLower)) {
    return buildFuturePhaseGateBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (parts.verb === 'document' && /launch asset inventory/.test(subjectLower)) {
    return buildLaunchAssetInventoryBreakdown(block, hierarchy, initiativeDisplay, parts);
  }
  if (parts.verb === 'validate' && /milestone dependency sequence/.test(subjectLower)) {
    return buildDependencySequenceBreakdown(block, hierarchy, initiativeDisplay);
  }
  if (parts.verb === 'map' && /job-search|income demands|execution calendar/.test(subjectLower)) {
    return buildCalendarMappingBreakdown(block, hierarchy, initiativeDisplay);
  }
  const fallback = buildVerbAwareBreakdown(block, hierarchy, initiativeDisplay, parts);
  if (/institution model assumptions|credibility dependencies|stakeholder target|agency and coalition targets/.test(actionLower)) {
    return {
      ...fallback,
      phaseJustification: 'Prerequisite proof',
    };
  }
  return fallback;
}

export function resolveBlockPlainLanguage(block = {}, context = {}) {
  const hierarchy = context?.hierarchy || {};
  // Matrix Section 1A — caller passes the operator-declared verification
  // source registry. The resolver derives the membership-check vocabulary
  // here so computeMolecularQuality stays a pure function over its input.
  const verificationSourcesById =
    (context?.matrix && context.matrix.verificationSourcesById) || {};
  const declaredVerificationSourceLabels = Object.values(verificationSourcesById)
    .map((entry) => String(entry?.source || '').trim())
    .filter(Boolean);
  // Matrix Section 2 — the declared registry of nodes / entities. The gate
  // uses this to enforce that block.entityId points at a real entity.
  const entitiesById = (context?.matrix && context.matrix.entitiesById) || {};
  const declaredEntityIds = Object.keys(entitiesById);
  // Matrix Section 5 — the declared registry of projects. Block.projectId
  // (when set) must resolve. Soft mode for empty registry.
  const projectsById = (context?.matrix && context.matrix.projectsById) || {};
  const declaredProjectIds = Object.keys(projectsById);
  // Matrix Section 6 — the declared registry of artifacts. Block.producesArtifactId
  // (when set) must resolve. Soft mode for empty registry.
  const artifactsById = (context?.matrix && context.matrix.artifactsById) || {};
  const declaredArtifactIds = Object.keys(artifactsById);
  const initiativeDisplay = resolveInitiativeDisplay(block, {
    initiative: hierarchy?.initiative,
    lane: hierarchy?.lane,
  });
  const title = normalizeText(block?.title || block?.label || block?.displayTitle).toLowerCase();

  const baseResult =
    /legal and operating prerequisites|evaluate gate for early execution|evaluate gate for direct district execution|review coalition prerequisites/.test(
      title
    )
      ? genericBreakdown(block, hierarchy, initiativeDisplay)
      : /hard-anchor protection rules|hard anchor protection rules|hard-anchor/.test(title)
      ? hardAnchorProtectionBreakdown(block, hierarchy, initiativeDisplay)
      : /(onboarding|sign-in|sign in|login|log in|profile restoration|launch blocker)/i.test(title) ||
          (title.includes('app platform') && title.includes('onboarding'))
        ? onboardingBreakdown(block, hierarchy, initiativeDisplay)
        : genericBreakdown(block, hierarchy, initiativeDisplay);
  const stabilizedResult = stabilizeResolvedDetailRoles(baseResult, block, hierarchy, initiativeDisplay);

  // ATTESTATION TRIPLE (Truth Communication contract — canonical-only).
  // These three fields MUST come from the block itself. The resolver does
  // not synthesize them. If absent, the block surfaces "Missing" in the
  // panel and the gate emits MISSING_VERIFICATION_SOURCE /
  // MISSING_OPERATOR_ATTESTATION. The legacy synthesized doneWhen /
  // acceptanceEvidence / completionAssertion remain available on the
  // result for the "Operator instructions (suggested)" panel section —
  // they are NOT promoted into the canonical triple.
  const canonicalTarget = normalizeText(block?.target || '');
  const canonicalVerificationSource = normalizeText(block?.verificationSource || '');
  const canonicalOperatorAttestation = normalizeText(block?.operatorAttestation || '');
  return {
    ...stabilizedResult,
    laneLabel: initiativeDisplay?.lane || '',
    entityLabel: initiativeDisplay?.entity || '',
    initiativeLabel: initiativeDisplay?.initiative || '',
    projectLabel: initiativeDisplay?.initiative || '',
    expectedOutput: stabilizedResult.artifact,
    completionAssertion:
      stabilizedResult.completionAssertion || resolveCompletionAssertion(block, stabilizedResult.artifact, stabilizedResult.doneWhen),
    phaseJustification: stabilizedResult.phaseJustification || '',
    target: canonicalTarget,
    verificationSource: canonicalVerificationSource,
    operatorAttestation: canonicalOperatorAttestation,
    quality: computeMolecularQuality({
      title: block?.title || block?.label || block?.displayTitle || '',
      isForecastBlock: Boolean(block?.masterPlanId || block?.masterPlanLaneId || block?.derivationReason),
      // hierarchy.lane / hierarchy.initiative are the canonical hierarchy
      // projection the panel passes in from its hierarchyContext (active
      // master plan / cycle / lane). Using them as fallbacks closes the gap
      // for activated blocks whose own lane fields were stripped during the
      // schedule_active transformation. This is not title-text inference —
      // the gate still rejects blocks with no canonical hierarchy at all.
      rawLaneLabel: block?.laneLabel || block?.laneName || block?.lane || hierarchy?.lane || '',
      rawLaneId: block?.laneId || block?.masterPlanLaneId || hierarchy?.lane || hierarchy?.initiative || '',
      rawWorkType: block?.workType || block?.blockType || '',
      rawExpectedOutput:
        block?.producesArtifact || block?.expectedOutput || block?.artifactLabel || block?.outputArtifact || block?.outputLabel || '',
      rawAcceptanceEvidence: block?.acceptanceEvidence || block?.passEvidence || '',
      laneLabel: initiativeDisplay?.lane || '',
      workType: stabilizedResult.workType,
      intent: stabilizedResult.intent,
      expectedOutput: stabilizedResult.artifact,
      acceptanceEvidence: stabilizedResult.acceptanceEvidence,
      plainAction: stabilizedResult.plainAction,
      steps: stabilizedResult.steps,
      doneWhen: stabilizedResult.doneWhen,
      completionAssertion:
        stabilizedResult.completionAssertion || resolveCompletionAssertion(block, stabilizedResult.artifact, stabilizedResult.doneWhen),
      // Canonical-only — passed through directly from the block; resolver
      // does not synthesize substitutes.
      target: canonicalTarget,
      verificationSource: canonicalVerificationSource,
      operatorAttestation: canonicalOperatorAttestation,
      // Matrix Section 1A — the declared registry of verification sources.
      // The gate enforces membership only when the registry has ≥1 entry.
      declaredVerificationSourceLabels,
      // Matrix Section 2 — the declared registry of nodes / entities. The
      // gate enforces that block.entityId references a registered node.
      entityId: String(block?.entityId || '').trim() || null,
      declaredEntityIds,
      // Matrix Section 5 — declared projects. Gate enforces block.projectId
      // membership when the registry has ≥1 entry.
      projectId: String(block?.projectId || '').trim() || null,
      declaredProjectIds,
      // Matrix Section 6 — declared artifacts. Gate enforces
      // block.producesArtifactId membership when the registry has ≥1 entry.
      producesArtifactId: String(block?.producesArtifactId || '').trim() || null,
      declaredArtifactIds,
    }),
  };
}

export default resolveBlockPlainLanguage;
