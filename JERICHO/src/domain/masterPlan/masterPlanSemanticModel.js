import { inferGoalArchitecture } from '../goal/goalArchitectureClassifier.ts';

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueStrings(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => normalizeText(value))
        .filter(Boolean)
    )
  );
}

function extractNamedMission(goalText) {
  const text = normalizeText(goalText);
  if (!text) {
    return '';
  }
  const prefixedMatch = text.match(
    /(?:build(?: and execute)?|execute|launch|scale|coordinate|run)\s+([A-Z][A-Za-z0-9&'/-]*(?:\s+[A-Z][A-Za-z0-9&'/-]*){0,4})\s*:/i
  );
  if (prefixedMatch?.[1]) {
    return normalizeText(prefixedMatch[1]);
  }
  const colonMatch = text.match(/^([A-Z][A-Za-z0-9&'/-]*(?:\s+[A-Z][A-Za-z0-9&'/-]*){0,4})\s*:/);
  if (colonMatch?.[1]) {
    return normalizeText(colonMatch[1]);
  }
  const codenameMatch = text.match(/\b(?:called|named)\s+([A-Z][A-Za-z0-9&'/-]*(?:\s+[A-Z][A-Za-z0-9&'/-]*){0,4})\b/);
  if (codenameMatch?.[1]) {
    return normalizeText(codenameMatch[1]);
  }
  return '';
}

function extractHorizonPhrase(goalText) {
  const text = normalizeText(goalText);
  const explicitMatch = text.match(
    /\b(?:within|over|through|across|in)\s+((?:\d+(?:\.\d+)?)(?:\s*(?:to|-)\s*\d+(?:\.\d+)?)?\s+(?:day|days|week|weeks|month|months|year|years))\b/i
  );
  if (explicitMatch?.[1]) {
    return normalizeText(explicitMatch[1]);
  }
  return '';
}

function extractNumericTarget(goalText) {
  const text = normalizeText(goalText);
  const moneyMatch = text.match(/\$\s?\d[\d,.]*(?:\s?(?:[BbMmKk]|billion|million|thousand))?/);
  if (moneyMatch?.[0]) {
    return normalizeText(moneyMatch[0]);
  }
  return '';
}

function classifyTarget(goalText, numericTarget) {
  const text = normalizeText(goalText).toLowerCase();
  if (numericTarget && /\b(net worth|valuation|worth|empire|enterprise)\b/.test(text)) {
    return {
      controllabilityClass: 'externally_mediated',
      terminalTargetClass: 'valuation_dependent',
    };
  }
  if (/\b(audience|market share|virality|mainstream|reach)\b/.test(text)) {
    return {
      controllabilityClass: 'externally_mediated',
      terminalTargetClass: 'market_dependent',
    };
  }
  if (/\b(client|sale|revenue|customer|buyer|investor|capital)\b/.test(text)) {
    return {
      controllabilityClass: 'semi_controllable',
      terminalTargetClass: 'market_dependent',
    };
  }
  return {
    controllabilityClass: 'controllable',
    terminalTargetClass: 'controllable',
  };
}

function buildSuccessSignals(extractedLanes = [], goalText = '') {
  const domains = new Set(
    (Array.isArray(extractedLanes) ? extractedLanes : [])
      .map((lane) => String(lane?.domain || '').trim().toLowerCase())
      .filter(Boolean)
  );
  const signals = [];
  if (domains.has('product')) {
    signals.push('product deployment');
  }
  if (domains.has('income') || domains.has('brand')) {
    signals.push('revenue architecture');
  }
  if (domains.has('media') || domains.has('brand') || domains.has('creative')) {
    signals.push('audience leverage');
  }
  signals.push('operating cadence');
  if (domains.has('creative') || domains.has('brand')) {
    signals.push('brand proof');
  }
  if (domains.has('product') || domains.has('income') || /\bpartner|capital|investor\b/i.test(goalText)) {
    signals.push('credible continuation path');
  }
  if (/\bpartner|capital|investor\b/i.test(goalText)) {
    signals.push('strategic partnerships or capital path');
  }
  return uniqueStrings(signals);
}

function buildMasterPlanSummary(extractedLanes = []) {
  const laneTitles = uniqueStrings((extractedLanes || []).map((lane) => lane?.title));
  if (laneTitles.length === 0) {
    return 'Structured master plan for the current goal.';
  }
  return `Master plan coordinating ${laneTitles.join(', ')}.`;
}

export function deriveMasterPlanSemanticModel({
  goalText = '',
  extractedLanes = [],
  horizonAnswer = null,
} = {}) {
  const normalizedGoalText = normalizeText(goalText);
  const namedMission = extractNamedMission(normalizedGoalText);
  const numericTarget = extractNumericTarget(normalizedGoalText);
  const horizonPhrase =
    extractHorizonPhrase(normalizedGoalText) ||
    normalizeText(horizonAnswer?.label || '') ||
    (Number.isFinite(Number(horizonAnswer?.months))
      ? `${Number(horizonAnswer.months)} months`
      : '');
  const architecture = inferGoalArchitecture(normalizedGoalText, {
    planningTier: 'master_plan',
    laneOverrides: extractedLanes,
  });
  const targetClassification = classifyTarget(normalizedGoalText, numericTarget);
  const successSignals = buildSuccessSignals(extractedLanes, normalizedGoalText);
  const targetPrefix =
    targetClassification.terminalTargetClass === 'valuation_dependent'
      ? 'Build toward'
      : targetClassification.controllabilityClass === 'semi_controllable'
        ? 'Reach'
        : 'Deliver';
  const outcomeTarget =
    numericTarget
      ? `${targetPrefix} a ${numericTarget}-scale outcome${horizonPhrase ? ` within ${horizonPhrase}` : ''}`
      : normalizedGoalText;
  const successSubject =
    extractedLanes.length >= 3 || /\becosystem|empire|enterprise|company|companies\b/i.test(normalizedGoalText)
      ? 'Active scaling ecosystem'
      : extractedLanes.length > 1
        ? 'Active scaling venture'
        : 'Meaningful mission progress';
  const successStandard = `${successSubject} with ${successSignals.join(', ')}.`;
  const externallyMediatedTargets =
    targetClassification.controllabilityClass === 'controllable' ? [] : uniqueStrings([numericTarget || outcomeTarget]);
  const coreMission = namedMission || normalizedGoalText;

  return {
    coreMission,
    outcomeTarget,
    successStandard,
    masterPlanSummary: buildMasterPlanSummary(extractedLanes),
    executionHorizon: horizonPhrase || normalizeText(horizonAnswer?.horizonEnd || ''),
    controllableSuccessSignals: successSignals,
    externallyMediatedTargets,
    controllabilityClass: targetClassification.controllabilityClass,
    terminalTargetClass: targetClassification.terminalTargetClass,
    goalArchitecture: architecture.goalArchitecture,
    executionModel: architecture.executionModel,
    primaryLane: architecture.primaryLane,
    supportingLanes: architecture.supportingLanes,
    laneComposition: architecture.laneComposition,
    laneClassificationConfidence: architecture.laneClassificationConfidence,
    classificationSource: architecture.classificationSource,
  };
}
