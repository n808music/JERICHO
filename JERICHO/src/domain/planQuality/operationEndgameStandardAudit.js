import { auditExecutionBlockAdmission, HARD_BLOCK_ADMISSION_FAILURE_CODES } from './evaluatePlanQualityGate.ts';
import { getInitiativeRegistrySyncOrEmpty } from '../product/initiativeRegistryLoader.js';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const STANDARD_AUDIT_HARD_FAILURE_CODES = new Set([
  ...HARD_BLOCK_ADMISSION_FAILURE_CODES,
  'SCHEDULE_DISTRIBUTION_CLUSTER_UNJUSTIFIED',
  'UNSPECIFIED_INITIATIVE_ACTIVE_SCHEDULE',
  'PROPOSAL_TRACE_CONTRADICTION',
]);

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function unique(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
}

function resolveArtifactDayKey(block) {
  const raw =
    normalizeText(block?.dayKey) ||
    normalizeText(block?.startDayKey) ||
    normalizeText(block?.date) ||
    normalizeText(block?.startISO) ||
    normalizeText(block?.start);
  return raw.length >= 10 ? raw.slice(0, 10) : '';
}

function buildAdmissionAuditIntakeText(state, cycleId = null) {
  const cycle = cycleId ? state?.cyclesById?.[cycleId] || null : null;
  const sources = [
    state?.masterPlanIntake?.answers || null,
    cycle?.goalContract?.planningIntake || null,
    cycle?.goalContract?.goalIntakeContract?.planningIntake || null,
    state?.goalExecutionContract?.planningIntake || null,
  ].filter(Boolean);
  return sources
    .flatMap((source) => {
      if (typeof source === 'string') {
        return [source];
      }
      if (Array.isArray(source)) {
        return source;
      }
      if (source && typeof source === 'object') {
        return Object.values(source);
      }
      return [];
    })
    .map((value) => (typeof value === 'string' ? value : JSON.stringify(value)))
    .filter(Boolean)
    .join(' ');
}

function buildHierarchy(block, cycle) {
  return {
    phase: block?.phaseLabel || null,
    lane: block?.laneLabel || null,
    initiative: block?.initiativeLabel || block?.projectLabel || null,
    operatingCycle: cycle?.goalContract?.cycleLabel || null,
  };
}

function classifyAdmissionStatus(block, hardFailureCodes) {
  const status = normalizeText(block?.status).toLowerCase();
  if (status === 'rejected') {
    return 'REJECTED';
  }
  if (status === 'withheld') {
    return 'WITHHELD';
  }
  if (normalizeText(block?.repairedAtISO) || normalizeText(block?.repairReason)) {
    return 'REPAIRED_THEN_ADMITTED';
  }
  return hardFailureCodes.length > 0 ? 'REJECTED' : 'ADMITTED';
}

function countBy(items, deriveKey) {
  return (Array.isArray(items) ? items : []).reduce((acc, item) => {
    const key = normalizeText(deriveKey(item)) || 'Unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function sortCountEntries(counts, limit = Infinity) {
  return Object.entries(counts || {})
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return a[0].localeCompare(b[0]);
    })
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function normalizeComparableText(value) {
  return normalizeText(value).toLowerCase().replace(/\s+/g, ' ');
}

function buildRecordIdentity(record) {
  return [
    normalizeText(record?.title),
    normalizeText(record?.entityLabel),
    normalizeText(record?.projectLabel),
    normalizeText(record?.laneLabel),
    normalizeText(record?.dayKey),
  ].join('|');
}

const COMPARISON_AUDIT_HARD_FAILURE_CODES = new Set([
  'DUPLICATE_BLOCK_TITLE',
  'DUPLICATE_BLOCK_BODY',
  'CONJUGATION_SHELL_COMPLIANCE',
  'FIELD_ROLE_COLLAPSE',
  'LANE_ECHO_SUBJECT',
  'FORBIDDEN_SYSTEM_PLUMBING_LANGUAGE',
  'FORBIDDEN_GENERIC_OWNER_LANGUAGE',
  'PRODUCES_TITLE_SHELL',
  'PURPOSE_FIELD_SHAPE_INVALID',
  'MISSING_COMPLETION_ASSERTION',
  'WORK_TYPE_TITLE_MISMATCH',
]);

const COMPLETED_PREFIX_BY_VERB = new Map([
  ['advance', 'advanced'],
  ['build', 'built'],
  ['close', 'closed'],
  ['complete', 'completed'],
  ['confirm', 'confirmed'],
  ['coordinate', 'coordinated'],
  ['define', 'defined'],
  ['document', 'documented'],
  ['edit', 'edited'],
  ['establish', 'established'],
  ['evaluate', 'evaluated'],
  ['execute', 'executed'],
  ['finalize', 'finalized'],
  ['map', 'mapped'],
  ['plan', 'planned'],
  ['prepare', 'prepared'],
  ['prove', 'proven'],
  ['publish', 'published'],
  ['record', 'recorded'],
  ['review', 'reviewed'],
  ['run', 'run'],
  ['select', 'selected'],
  ['stabilize', 'stabilized'],
  ['submit', 'submitted'],
  ['test', 'tested'],
  ['update', 'updated'],
  ['validate', 'validated'],
  ['verify', 'verified'],
  ['widen', 'widened'],
]);

const ACTION_VERB_TO_WORK_TYPE = new Map([
  ['build', 'Execution'],
  ['close', 'Execution'],
  ['complete', 'Execution'],
  ['coordinate', 'Execution'],
  ['document', 'Planning'],
  ['define', 'Planning'],
  ['edit', 'Execution'],
  ['evaluate', 'Validation'],
  ['finalize', 'Execution'],
  ['map', 'Planning'],
  ['plan', 'Planning'],
  ['prepare', 'Planning'],
  ['publish', 'Execution'],
  ['record', 'Execution'],
  ['review', 'Validation'],
  ['run', 'Execution'],
  ['submit', 'Execution'],
  ['test', 'Validation'],
  ['update', 'Execution'],
  ['validate', 'Validation'],
  ['verify', 'Validation'],
]);

const SUBJECT_SCAFFOLD_TOKENS = new Set([
  'operation',
  'endgame',
  'lane',
  'system',
  'work',
  'block',
  'initiative',
  'program',
  'project',
  'platform',
  'operations',
  'brand',
  'capital',
  'path',
  'revenue',
  'engine',
  'studio',
  'global',
  'state',
  'co',
  'corp',
]);

const FORBIDDEN_TEXT_PATTERNS = [
  { code: 'FORBIDDEN_SYSTEM_PLUMBING_LANGUAGE', pattern: /\blink the result to\b/i },
  { code: 'FORBIDDEN_SYSTEM_PLUMBING_LANGUAGE', pattern: /\blinked to the downstream owner\b/i },
  { code: 'FORBIDDEN_SYSTEM_PLUMBING_LANGUAGE', pattern: /\bmaster plan lane\b/i },
  { code: 'FORBIDDEN_SYSTEM_PLUMBING_LANGUAGE', pattern: /\blane-[0-9a-f-]{8,}\b/i },
  { code: 'FORBIDDEN_GENERIC_OWNER_LANGUAGE', pattern: /\bdownstream owner\b/i },
  { code: 'FORBIDDEN_GENERIC_OWNER_LANGUAGE', pattern: /\banother operator\b/i },
  { code: 'FORBIDDEN_GENERIC_OWNER_LANGUAGE', pattern: /\bthe team\b/i },
];

function normalizeDuplicateText(value) {
  return normalizeComparableText(value)
    .replace(/\b20\d{2}-\d{2}-\d{2}\b/g, '')
    .replace(/\bcopy\s+\d+\b/g, '')
    .trim();
}

function tokenizeComparableText(value) {
  return normalizeDuplicateText(value)
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function computeTokenOverlap(left, right) {
  const leftTokens = new Set(tokenizeComparableText(left));
  const rightTokens = new Set(tokenizeComparableText(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }
  let shared = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      shared += 1;
    }
  });
  return shared / Math.max(leftTokens.size, rightTokens.size);
}

function inferTitleVerbObject(title) {
  const normalized = normalizeDuplicateText(title);
  const match = normalized.match(/^([a-z]+)\s+(.+)$/i);
  if (!match) {
    return { verb: '', object: normalized };
  }
  return {
    verb: match[1].toLowerCase(),
    object: match[2].trim(),
  };
}

function buildConjugatedShell(title) {
  const parts = inferTitleVerbObject(title);
  const completedVerb = COMPLETED_PREFIX_BY_VERB.get(parts.verb);
  if (!completedVerb || !parts.object) {
    return '';
  }
  return `${completedVerb} ${parts.object}`.trim();
}

function buildRecordBodyText(record) {
  return [
    record?.meaning,
    record?.whyThisExists,
    record?.doThis,
    record?.doneWhen,
    record?.produces,
    record?.acceptanceEvidence,
    record?.completionAssertion,
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(' ');
}

function stripLaneEchoSubject(record) {
  const { object } = inferTitleVerbObject(record?.title);
  const removableTokens = new Set(
    [
      ...tokenizeComparableText(record?.laneLabel),
      ...tokenizeComparableText(record?.entityLabel),
      ...tokenizeComparableText(record?.projectLabel),
    ].filter(Boolean)
  );
  const subjectTokens = tokenizeComparableText(object).filter(
    (token) => !removableTokens.has(token) && !SUBJECT_SCAFFOLD_TOKENS.has(token)
  );
  return subjectTokens.join(' ');
}

function detectComparisonAuditCodes(record) {
  const codes = [];
  const { verb } = inferTitleVerbObject(record?.title);
  const comparisonFields = [
    record?.meaning,
    record?.whyThisExists,
    record?.doneWhen,
    record?.produces,
    record?.acceptanceEvidence,
  ];
  const titleShell = buildConjugatedShell(record?.title);
  const shellSensitiveVerbs = new Set(['document', 'review', 'map', 'prepare']);
  if (shellSensitiveVerbs.has(verb)) {
    comparisonFields.forEach((field) => {
      if (titleShell && computeTokenOverlap(field, titleShell) >= 0.9) {
        codes.push('CONJUGATION_SHELL_COMPLIANCE');
      }
    });
  }
  for (let index = 0; index < comparisonFields.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < comparisonFields.length; compareIndex += 1) {
      if (computeTokenOverlap(comparisonFields[index], comparisonFields[compareIndex]) >= 0.9) {
        codes.push('FIELD_ROLE_COLLAPSE');
      }
    }
  }
  if (!stripLaneEchoSubject(record)) {
    codes.push('LANE_ECHO_SUBJECT');
  }
  const visibleText = [record?.title, buildRecordBodyText(record)].join(' ');
  FORBIDDEN_TEXT_PATTERNS.forEach(({ code, pattern }) => {
    if (pattern.test(visibleText)) {
      codes.push(code);
    }
  });
  if (shellSensitiveVerbs.has(verb) && titleShell && computeTokenOverlap(record?.produces, titleShell) >= 0.9) {
    codes.push('PRODUCES_TITLE_SHELL');
  }
  const whyText = normalizeComparableText(record?.whyThisExists);
  if (!/\b(because|so that|so [a-z]|to [a-z])/i.test(whyText) || /^proof that\b/i.test(whyText)) {
    codes.push('PURPOSE_FIELD_SHAPE_INVALID');
  }
  if (!normalizeText(record?.completionAssertion)) {
    codes.push('MISSING_COMPLETION_ASSERTION');
  }
  const expectedWorkType = ACTION_VERB_TO_WORK_TYPE.get(verb);
  if (expectedWorkType && normalizeText(record?.workType) && normalizeText(record?.workType) !== expectedWorkType) {
    codes.push('WORK_TYPE_TITLE_MISMATCH');
  }
  return unique(codes);
}

function applyComparisonAudit(records) {
  const decorated = (Array.isArray(records) ? records : []).map((record) => ({
    ...record,
    comparisonReasonCodes: detectComparisonAuditCodes(record),
  }));

  const duplicateCandidates = decorated.filter((record) => record.source !== 'forecast');
  const titleBuckets = new Map();
  const bodyBuckets = new Map();
  duplicateCandidates.forEach((record) => {
    const normalizedTitle = normalizeDuplicateText(record?.title);
    const normalizedBody = normalizeDuplicateText(buildRecordBodyText(record));
    if (normalizedTitle) {
      if (!titleBuckets.has(normalizedTitle)) {
        titleBuckets.set(normalizedTitle, []);
      }
      titleBuckets.get(normalizedTitle).push(record);
    }
    if (normalizedBody) {
      if (!bodyBuckets.has(normalizedBody)) {
        bodyBuckets.set(normalizedBody, []);
      }
      bodyBuckets.get(normalizedBody).push(record);
    }
  });

  titleBuckets.forEach((bucket) => {
    if (bucket.length > 1) {
      bucket.forEach((record) => {
        record.comparisonReasonCodes.push('DUPLICATE_BLOCK_TITLE');
      });
    }
  });
  bodyBuckets.forEach((bucket) => {
    if (bucket.length > 1) {
      bucket.forEach((record) => {
        record.comparisonReasonCodes.push('DUPLICATE_BLOCK_BODY');
      });
    }
  });

  return decorated.map((record) => {
    const comparisonReasonCodes = unique(record.comparisonReasonCodes);
    const hardFailureCodes = unique([
      ...(record.hardFailureCodes || []),
      ...comparisonReasonCodes.filter((code) => COMPARISON_AUDIT_HARD_FAILURE_CODES.has(code)),
    ]);
    const reasonCodes = unique([...(record.reasonCodes || []), ...comparisonReasonCodes]);
    return {
      ...record,
      comparisonReasonCodes,
      hardFailureCodes,
      reasonCodes,
      admissionStatus:
        record.admissionStatus === 'ADMITTED' && hardFailureCodes.length > 0 ? 'REJECTED' : record.admissionStatus,
    };
  });
}

function computeCoverageIntegrity(records) {
  const seenTitles = new Set();
  const distinctRecords = [];
  (Array.isArray(records) ? records : []).forEach((record) => {
    const key = normalizeDuplicateText(record?.title);
    if (!key || seenTitles.has(key)) {
      return;
    }
    seenTitles.add(key);
    distinctRecords.push(record);
  });
  const distinctScheduledHours = distinctRecords.reduce((sum, record) => {
    const start = Date.parse(record?.block?.startISO || record?.block?.start || '');
    const end = Date.parse(record?.block?.endISO || record?.block?.end || '');
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      return sum + (end - start) / 3600000;
    }
    return sum;
  }, 0);
  return {
    distinctBlockCount: distinctRecords.length,
    distinctScheduledHours,
  };
}

function analyzeWeekdayDistribution(blocks, workWindows) {
  const counts = new Map();
  const scheduledDayKeys = (Array.isArray(blocks) ? blocks : [])
    .map((block) => resolveArtifactDayKey(block))
    .filter(Boolean);
  scheduledDayKeys.forEach((dayKey) => {
    const weekday = new Date(`${dayKey}T12:00:00.000Z`).getUTCDay();
    counts.set(weekday, (counts.get(weekday) || 0) + 1);
  });
  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const topTwoCount = ranked.slice(0, 2).reduce((sum, [, count]) => sum + count, 0);
  const topTwoRatio = topTwoCount / Math.max(1, scheduledDayKeys.length);
  const weekdayCounts = Object.fromEntries(
    Array.from(counts.entries()).map(([weekday, count]) => [WEEKDAY_LABELS[weekday], count])
  );
  const hasExplicitJustification = Boolean(
    normalizeText(workWindows?.distributionJustification) ||
      (Array.isArray(blocks) ? blocks : []).some((block) => normalizeText(block?.distributionJustification))
  );
  return {
    scheduledBlockCount: scheduledDayKeys.length,
    weekdayCounts,
    topTwoRatio,
    violatesThreshold: scheduledDayKeys.length >= 6 && topTwoRatio >= 0.75 && !hasExplicitJustification,
    justificationPresent: hasExplicitJustification,
  };
}

function classifyProposalTrace({ proposedBlocks, lastPlanError }) {
  const proposals = Array.isArray(proposedBlocks) ? proposedBlocks : [];
  const proposedCount = proposals.length;
  const suggestedCount = proposals.filter((block) => normalizeText(block?.status).toLowerCase() === 'suggested').length;
  const acceptedCount = proposals.filter((block) => normalizeText(block?.status).toLowerCase() === 'accepted').length;
  const rejectedCount = proposals.filter((block) => normalizeText(block?.status).toLowerCase() === 'rejected').length;
  const errorCode = normalizeText(lastPlanError?.code);

  let state = 'proposals_ready_for_review';
  let consistent = true;
  if (proposedCount === 0 || (acceptedCount === proposedCount && suggestedCount === 0 && rejectedCount === 0)) {
    state = 'no_proposals_generated';
    consistent = !errorCode || errorCode === 'NO_PROPOSED_BLOCKS';
  } else if (errorCode === 'NO_PROPOSED_BLOCKS') {
    state = 'contradictory_trace';
    consistent = false;
  } else if (errorCode === 'NO_ADMISSIBLE_PROPOSED_BLOCKS') {
    state = rejectedCount === proposedCount ? 'proposals_rejected_by_admission' : 'contradictory_trace';
    consistent = rejectedCount === proposedCount;
  } else if (errorCode === 'GENERATED_SCHEDULE_STALE') {
    state = 'stale_proposals_expired';
  } else if (errorCode) {
    state = 'proposals_withheld_for_repair';
  } else if (acceptedCount > 0 || suggestedCount > 0) {
    state = 'proposals_ready_for_review';
  }

  return {
    state,
    consistent,
    proposedCount,
    suggestedCount,
    acceptedCount,
    rejectedCount,
    errorCode: errorCode || null,
  };
}

function buildAuditRecord(block, admissionAudit, source, cycle, intakeText = '') {
  const detail = admissionAudit?.detailContract || {};
  const baseReasonCodes = unique([...(admissionAudit?.failureCodes || []), ...(detail?.quality?.failureCodes || [])]);
  const hardFailureCodes = baseReasonCodes.filter((code) => STANDARD_AUDIT_HARD_FAILURE_CODES.has(code));
  const hasUnspecifiedInitiative = /unspecified initiative/i.test(
    `${normalizeText(detail?.initiativeLabel)} ${normalizeText(block?.initiative)} ${normalizeText(block?.projectLabel)}`
  );
  const rawTitle = normalizeText(block?.title || block?.label || block?.displayTitle);
  const rawLaneId = normalizeText(block?.laneId);
  const rawLaneLabel = normalizeText(block?.laneLabel);
  const rawProjectLabel = normalizeText(block?.projectLabel);
  const rawEntityLabel = normalizeText(block?.entityLabel);
  if (source === 'active' && !rawLaneId && !rawLaneLabel && /^review$/i.test(rawTitle)) {
    hardFailureCodes.push('ACTIVE_BLOCK_UNKNOWN_LANE', 'ACTIVE_BLOCK_UNKNOWN_ENTITY', 'PROJECT_CONTEXT_MISSING');
  }
  if (source === 'active' && /^unspecified initiative$/i.test(rawTitle)) {
    hardFailureCodes.push('UNSPECIFIED_INITIATIVE_ACTIVE_SCHEDULE', 'PROJECT_CONTEXT_MISSING');
    if (!rawLaneId && !rawLaneLabel) {
      hardFailureCodes.push('ACTIVE_BLOCK_UNKNOWN_LANE', 'ACTIVE_BLOCK_UNKNOWN_ENTITY');
    }
  }
  if (/record and mix final album masters/i.test(rawTitle) && /ready-to-launch|final masters complete|ready for release/i.test(intakeText)) {
    hardFailureCodes.push('INTAKE_FACT_CONTRADICTION');
  }
  if (/stakeholder map created/i.test(rawTitle)) {
    hardFailureCodes.push('MILESTONE_RENDERED_AS_EXECUTION_BLOCK');
  }
  if (!rawProjectLabel && !normalizeText(detail?.projectLabel) && source === 'active') {
    hardFailureCodes.push('PROJECT_CONTEXT_MISSING');
  }
  if (!rawEntityLabel && !normalizeText(detail?.entityLabel) && source === 'active') {
    hardFailureCodes.push('ACTIVE_BLOCK_UNKNOWN_ENTITY');
  }
  if (hasUnspecifiedInitiative && source === 'active') {
    hardFailureCodes.push('UNSPECIFIED_INITIATIVE_ACTIVE_SCHEDULE');
  }
  const reasonCodes = unique([...baseReasonCodes, ...hardFailureCodes]);
  const dayKey = resolveArtifactDayKey(block) || null;
  return {
    block,
    source,
    cycleId: cycle?.id || block?.cycleId || null,
    title: normalizeText(block?.title || block?.label || block?.displayTitle) || 'Untitled block',
    dayKey,
    startISO: normalizeText(block?.startISO || block?.start) || null,
    entityLabel: normalizeText(detail?.entityLabel || block?.entityLabel),
    projectLabel: normalizeText(detail?.projectLabel || block?.projectLabel || block?.initiativeLabel),
    laneLabel: normalizeText(detail?.laneLabel || block?.laneLabel),
    phaseLabel: normalizeText(block?.phaseLabel || detail?.phaseLabel),
    workType: normalizeText(detail?.workType || block?.workType),
    phaseJustification: normalizeText(detail?.phaseJustification || block?.phaseJustification),
    meaning: normalizeText(detail?.intent),
    whyThisExists: normalizeText(detail?.whyThisExists),
    doThis: normalizeText(detail?.plainAction),
    doneWhen: normalizeText(detail?.doneWhen),
    produces: normalizeText(detail?.expectedOutput),
    acceptanceEvidence: normalizeText(detail?.acceptanceEvidence),
    completionAssertion: normalizeText(detail?.completionAssertion),
    unlocks: Array.isArray(detail?.dependencies?.unlocks) ? detail.dependencies.unlocks.filter(Boolean) : [],
    reasonCodes,
    hardFailureCodes: unique(hardFailureCodes),
    admissionStatus: classifyAdmissionStatus(block, hardFailureCodes),
  };
}

function evaluateSampleCognitiveIssues(sample) {
  const title = normalizeComparableText(sample?.title);
  const meaning = normalizeComparableText(sample?.meaning);
  const whyThisExists = normalizeComparableText(sample?.whyThisExists);
  const doThis = normalizeComparableText(sample?.doThis);
  const doneWhen = normalizeComparableText(sample?.doneWhen);
  const produces = normalizeComparableText(sample?.produces);
  const acceptanceEvidence = normalizeComparableText(sample?.acceptanceEvidence);
  const issues = [];

  if (!sample?.projectLabel) {
    issues.push('SAMPLE_PROJECT_CONTEXT_MISSING');
  }
  if (!sample?.entityLabel || !sample?.laneLabel) {
    issues.push('SAMPLE_IDENTITY_CONTEXT_MISSING');
  }
  if (/concrete next-state record|move .* forward|stable definition instead of conflicting interpretations/.test(meaning)) {
    issues.push('SAMPLE_MEANING_TOO_ABSTRACT');
  }
  if (/complete .* and save the resulting record or asset/.test(doThis) || doThis === title) {
    issues.push('SAMPLE_ACTION_GENERIC');
  }
  if (/the scheduled work is complete/.test(doneWhen) || doneWhen === title) {
    issues.push('SAMPLE_DONE_WHEN_GENERIC');
  }
  if (/resulting record or asset|completed .* completed/.test(produces) || produces === title) {
    issues.push('SAMPLE_OUTPUT_ARTIFACT_TOO_VAGUE');
  }
  if (!acceptanceEvidence || acceptanceEvidence === whyThisExists || acceptanceEvidence === produces) {
    issues.push('SAMPLE_ACCEPTANCE_EVIDENCE_NOT_OBSERVABLE');
  }
  if (/written review with pass\/fail determination and evidence summary/.test(acceptanceEvidence)) {
    issues.push('SAMPLE_ACCEPTANCE_EVIDENCE_TEMPLATE_REUSED');
  }

  return unique(issues);
}

function deriveEntitySampleCategories(initiativeRegistry, planningHorizonEndDate) {
  // Derive required-entity roster from LIVE INITIATIVE REGISTRY, independent of audit records.
  // Replaces hardcoded 14-entity list with entities that have real CONFIRMED work and Terminal Dates
  // within the planning horizon, read directly from the matrix.
  //
  // This roster is independent of what's being audited (the records parameter), so audit records
  // CAN flag entities as missing if they're required by the matrix but absent from the schedule.

  const today = new Date().toISOString().split('T')[0];
  const registry = Array.isArray(initiativeRegistry) ? initiativeRegistry : [];

  // Filter initiatives: Terminal Date is within planning horizon
  const requiredInitiatives = registry.filter((initiative) => {
    const terminalDate = normalizeText(initiative?.terminalDeadline);
    return (
      Boolean(terminalDate) && // Has a terminal date
      terminalDate >= today && // Date is in the future
      terminalDate <= planningHorizonEndDate // Date is within planning horizon
    );
  });

  // Extract unique entity owners from required initiatives
  const requiredEntities = Array.from(new Set(requiredInitiatives.map((init) => normalizeText(init?.owner))))
    .filter(Boolean)
    .sort();

  // Create a sample category for each required entity
  // All are marked required because the matrix says so (independent of audit records)
  return requiredEntities.map((entityLabel) => ({
    key: `entity_${entityLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    label: entityLabel,
    predicate: (record) => record.entityLabel === entityLabel,
    required: true, // Required by matrix, regardless of what's in the audit records
  }));
}

function buildSamples(records, initiativeRegistry, planningHorizonEndDate) {
  const all = Array.isArray(records) ? records : [];
  const activeAdmitted = all.filter((record) => record.source === 'active' && record.admissionStatus === 'ADMITTED');
  const combined = [...activeAdmitted, ...all];

  const firstMatch = (predicate, pool = combined, excludeKeys = new Set()) =>
    pool.find((record) => predicate(record) && !excludeKeys.has(buildRecordIdentity(record))) ||
    pool.find((record) => predicate(record)) ||
    null;

  // Dynamic entity categories: derived from INITIATIVE REGISTRY (independent of audit records)
  // This allows the audit to flag entities as MISSING if they're required by the matrix but absent from the schedule
  const entityCategories = deriveEntitySampleCategories(initiativeRegistry, planningHorizonEndDate);

  // Data-independent feature-based categories (6 checks that don't depend on hardcoded matrix roster)
  // Note: These predicates combine entity labels AND title/content patterns for robust matching
  const featureCategories = [
    {
      key: 'hard_anchor',
      label: 'Hard-anchor protection',
      predicate: (record) => /hard-anchor|timing-slip|dependency sequence|non-negotiables/i.test(record.title),
    },
    {
      key: 'runway_income',
      label: 'Runway / income support',
      predicate: (record) => /job-search|income demands|runway/i.test(record.title) || /Runway/i.test(record.projectLabel),
    },
    {
      key: 'app_product',
      label: 'App / product readiness',
      predicate: (record) =>
        record.entityLabel === 'Global State Systems' || /app platform|onboarding|jericho system|product/i.test(record.title),
    },
    {
      key: 'album_rollout',
      label: 'Album rollout',
      predicate: (record) =>
        record.entityLabel === 'Global State Corp.' || /album|release engine|drop/i.test(record.title),
    },
    {
      key: 'podcast_media',
      label: 'Podcast / media support',
      predicate: (record) =>
        record.entityLabel === 'Global State Productions' || /podcast|media narrative|content/i.test(record.title),
    },
    {
      key: 'milestone_validation',
      label: 'Milestone / dependency validation',
      predicate: (record) => /milestone|dependency|stakeholder map/i.test(record.title) && /Validation/i.test(record.workType),
    },
  ];

  // Combine: dynamic entities first, then data-independent features
  const categories = [...entityCategories, ...featureCategories];

  const usedKeys = new Set();
  const duplicateReuse = [];
  const selected = categories
    .map((category) => {
      const sample = firstMatch(category.predicate, combined, usedKeys);
      const sampleKey = sample ? buildRecordIdentity(sample) : null;
      if (sampleKey && usedKeys.has(sampleKey)) {
        duplicateReuse.push(category.label);
      }
      if (sampleKey) {
        usedKeys.add(sampleKey);
      }
      return {
      ...category,
      required: typeof category.required === 'boolean' ? category.required : all.some(category.predicate),
      sample,
    };
    })
    .filter((category) => category.sample || category.required !== false);

  const missingRequired = selected.filter((category) => !category.sample && category.required !== false).map((category) => category.label);
  const samples = selected
    .filter((category) => category.sample)
    .map((category) => ({
      category: category.label,
      ...category.sample,
      cognitiveIssues: evaluateSampleCognitiveIssues(category.sample),
    }));

  return {
    samples,
    missingRequired,
    duplicateReuse,
    cognitiveIssueCount: samples.reduce((sum, sample) => sum + sample.cognitiveIssues.length, 0),
  };
}

function buildRepresentativeSampleFailures(sampleReport) {
  return (sampleReport?.samples || [])
    .filter((sample) => (sample.reasonCodes || []).length > 0 || (sample.cognitiveIssues || []).length > 0)
    .map((sample) => ({
      title: sample.title,
      entityLabel: sample.entityLabel || 'Missing',
      projectLabel: sample.projectLabel || 'Missing',
      reasonCodes: sample.reasonCodes || [],
      cognitiveIssues: sample.cognitiveIssues || [],
    }));
}

export function deriveOperationEndgameStandardAuditInput(state, { cycleId = null } = {}) {
  const resolvedCycleId = cycleId || state?.activeCycleId || null;
  const cycle = resolvedCycleId ? state?.cyclesById?.[resolvedCycleId] || null : null;
  const profile = state?.activeProfileId ? state?.profilesById?.[state.activeProfileId] || null : null;
  const planId = cycle?.masterPlanId || profile?.activeMasterPlanId || null;
  const plan = planId ? state?.masterPlansById?.[planId] || null : null;
  const pickBlocks = (primary, fallback) =>
    Array.isArray(primary) && primary.length > 0
      ? primary
      : Array.isArray(fallback)
        ? fallback
        : [];
  const cycleSurfaceBlocks = Array.isArray(state?.cycle)
    ? state.cycle.flatMap((day) => (Array.isArray(day?.blocks) ? day.blocks : []))
    : [];
  const todaySurfaceBlocks = Array.isArray(state?.today?.blocks) ? state.today.blocks : [];
  return {
    state,
    cycleId: resolvedCycleId,
    cycle,
    plan,
    activeScheduledBlocks: pickBlocks(
      cycle?.scheduleReviewBlocks,
      pickBlocks(state?.scheduleReviewBlocks, pickBlocks(cycleSurfaceBlocks, todaySurfaceBlocks))
    ),
    forecastBlocks: state?.fullHorizonScheduleBlocks || [],
    proposedBlocks: pickBlocks(cycle?.proposedBlocks, state?.proposedBlocks),
    lastPlanError: state?.lastPlanError || null,
    workWindows: cycle?.goalContract?.workWindows || state?.availabilityPolicy?.workWindows || state?.goalExecutionContract?.workWindows || null,
    intakeText: buildAdmissionAuditIntakeText(state, resolvedCycleId),
    fullHorizonPlanQuality: state?.fullHorizonPlanQuality || null,
    fullHorizonCoverageAudit: state?.fullHorizonCoverageAudit || null,
  };
}

export function runOperationEndgameStandardComplianceAudit(input) {
  const context =
    input?.state && !input?.activeScheduledBlocks ? deriveOperationEndgameStandardAuditInput(input.state, { cycleId: input?.cycleId }) : input;
  const cycle = context?.cycle || null;
  const intakeText = normalizeText(context?.intakeText);
  const activeScheduledBlocks = Array.isArray(context?.activeScheduledBlocks) ? context.activeScheduledBlocks : [];
  const forecastBlocks = Array.isArray(context?.forecastBlocks) ? context.forecastBlocks : [];
  const proposedBlocks = Array.isArray(context?.proposedBlocks) ? context.proposedBlocks : [];
  const reviewableProposedBlocks = proposedBlocks.filter((block) => normalizeText(block?.status).toLowerCase() !== 'accepted');

  const activeRecords = activeScheduledBlocks.map((block) =>
    buildAuditRecord(
      block,
      auditExecutionBlockAdmission(block, { hierarchy: buildHierarchy(block, cycle), intakeText }),
      'active',
      cycle,
      intakeText
    )
  );
  const forecastRecords = forecastBlocks.map((block) =>
    buildAuditRecord(
      block,
      auditExecutionBlockAdmission(block, { hierarchy: buildHierarchy(block, cycle), intakeText }),
      'forecast',
      cycle,
      intakeText
    )
  );
  const proposedRecords = reviewableProposedBlocks.map((block) =>
    buildAuditRecord(
      block,
      auditExecutionBlockAdmission(block, { hierarchy: buildHierarchy(block, cycle), intakeText }),
      'proposed',
      cycle,
      intakeText
    )
  );

  const auditedRecords = applyComparisonAudit([...activeRecords, ...forecastRecords, ...proposedRecords]);
  const activeRecordsAudited = auditedRecords.filter((record) => record.source === 'active');
  const forecastRecordsAudited = auditedRecords.filter((record) => record.source === 'forecast');
  const proposedRecordsAudited = auditedRecords.filter((record) => record.source === 'proposed');
  const allRecords = auditedRecords;
  const distribution = analyzeWeekdayDistribution(activeScheduledBlocks, context?.workWindows || null);
  const proposalTrace = classifyProposalTrace({
    proposedBlocks,
    lastPlanError: context?.lastPlanError || null,
  });

  const activeHardFailureRecords = activeRecordsAudited.filter((record) => record.hardFailureCodes.length > 0);
  const forecastHardFailureRecords = forecastRecordsAudited.filter((record) => record.hardFailureCodes.length > 0);
  const proposedRejectedRecords = proposedRecordsAudited.filter((record) => record.admissionStatus === 'REJECTED');
  const allHardFailureCodes = unique(
    allRecords.flatMap((record) => record.hardFailureCodes).concat(distribution.violatesThreshold ? ['SCHEDULE_DISTRIBUTION_CLUSTER_UNJUSTIFIED'] : [])
  );
  const coverageIntegrity = computeCoverageIntegrity(activeRecordsAudited);

  // Derive roster-completeness sample categories from live Initiative registry (independent of audit records)
  // Planning horizon: P3 end, typically ~90 days out. Can be overridden via context.
  const initiativeRegistry = getInitiativeRegistrySyncOrEmpty();
  const planningHorizonEndDate = context?.planningHorizonEndDate || '2026-11-30'; // P3 default end

  const sampleReport = buildSamples(allRecords, initiativeRegistry, planningHorizonEndDate);
  const failureCountsByReasonCode = countBy(
    [
      ...allRecords.flatMap((record) => record.hardFailureCodes.map((code) => ({ code }))),
      ...(distribution.violatesThreshold ? [{ code: 'SCHEDULE_DISTRIBUTION_CLUSTER_UNJUSTIFIED' }] : []),
      ...(!proposalTrace.consistent ? [{ code: 'PROPOSAL_TRACE_CONTRADICTION' }] : []),
    ],
    (item) => item.code
  );
  const failureCountsByEntity = countBy(
    allRecords.filter((record) => record.hardFailureCodes.length > 0),
    (record) => record.entityLabel
  );
  const failureCountsByProjectProgram = countBy(
    allRecords.filter((record) => record.hardFailureCodes.length > 0),
    (record) => record.projectLabel
  );
  const representativeSampleFailures = buildRepresentativeSampleFailures(sampleReport);

  let verdict = 'STANDARD_COMPLIANT';
  if (activeHardFailureRecords.length > 0 || distribution.violatesThreshold || !proposalTrace.consistent) {
    verdict = 'REJECT_FOR_BROWSER_CERTIFICATION';
  } else if (
    forecastHardFailureRecords.length > 0 ||
    proposedRejectedRecords.length > 0 ||
    sampleReport.missingRequired.length > 0 ||
    sampleReport.cognitiveIssueCount > 0 ||
    normalizeText(context?.fullHorizonPlanQuality?.state) === 'degraded'
  ) {
    verdict = 'REPAIR_REQUIRED';
  }

  return {
    totalBlocksAudited: allRecords.length,
    activeScheduledBlocksAudited: activeRecordsAudited.length,
    forecastBlocksAudited: forecastRecordsAudited.length,
    admittedCount: allRecords.filter((record) => record.admissionStatus === 'ADMITTED').length,
    repairedCount: allRecords.filter((record) => record.admissionStatus === 'REPAIRED_THEN_ADMITTED').length,
    withheldCount: allRecords.filter((record) => record.admissionStatus === 'WITHHELD').length,
    rejectedCount: allRecords.filter((record) => record.admissionStatus === 'REJECTED').length,
    hardFailureCount: Object.values(failureCountsByReasonCode).reduce((sum, count) => sum + count, 0),
    failureCountsByReasonCode,
    failureCountsByEntity,
    failureCountsByProjectProgram,
    phaseEnergyViolations: activeRecordsAudited.filter((record) =>
      record.hardFailureCodes.some((code) => code === 'PHASE_ENERGY_VIOLATION' || code === 'PHASE_SCOPE_CONFLICT')
    ).length,
    intakeContradictions: activeRecordsAudited.filter((record) => record.hardFailureCodes.includes('INTAKE_FACT_CONTRADICTION')).length,
    weekdayDistributionRatio: distribution.topTwoRatio,
    weekdayDistribution: distribution,
    coverageIntegrity,
    proposalTrace,
    representativeSampleReport: sampleReport,
    representativeSampleFailures,
    cognitiveSampleState:
      sampleReport.missingRequired.length === 0 &&
      sampleReport.cognitiveIssueCount === 0
        ? 'STANDARD_COMPLIANT'
        : 'REPAIR_REQUIRED',
    activeScheduleHardFailures: activeHardFailureRecords,
    forecastDebt: {
      hardFailureRecords: forecastHardFailureRecords,
      fullHorizonPlanQualityState: normalizeText(context?.fullHorizonPlanQuality?.state) || null,
      fullHorizonReasonCodes: Array.isArray(context?.fullHorizonPlanQuality?.reasonCodes) ? context.fullHorizonPlanQuality.reasonCodes : [],
    },
    repairSummary: {
      topFailureCodes: sortCountEntries(failureCountsByReasonCode, 5),
      failuresByEntity: sortCountEntries(failureCountsByEntity),
      failuresByProjectProgram: sortCountEntries(failureCountsByProjectProgram),
      representativeSampleFailures,
    },
    browserCertificationBlocked: verdict !== 'STANDARD_COMPLIANT',
    verdict,
  };
}

export function formatOperationEndgameStandardAuditReport(report) {
  const lines = [
    'Operation Endgame Standard Compliance Audit',
    '',
    `Final verdict: ${report?.verdict || 'UNKNOWN'}`,
    `Cognitive sample state: ${report?.cognitiveSampleState || 'unknown'}`,
    '',
    `Total blocks audited: ${report?.totalBlocksAudited || 0}`,
    `Active/scheduled blocks audited: ${report?.activeScheduledBlocksAudited || 0}`,
    `Forecast blocks audited: ${report?.forecastBlocksAudited || 0}`,
    '',
    `Admitted: ${report?.admittedCount || 0}`,
    `Repaired: ${report?.repairedCount || 0}`,
    `Withheld: ${report?.withheldCount || 0}`,
    `Rejected: ${report?.rejectedCount || 0}`,
    '',
    `Hard failure count: ${report?.hardFailureCount || 0}`,
    `Distinct active blocks after dedupe: ${report?.coverageIntegrity?.distinctBlockCount || 0}`,
    `Distinct active scheduled hours: ${Number(report?.coverageIntegrity?.distinctScheduledHours || 0).toFixed(2)}`,
    '',
    'Top failure codes:',
  ];
  const topFailureLines = (report?.repairSummary?.topFailureCodes || []).map((entry, index) => `${index + 1}. ${entry.label}: ${entry.count}`);
  lines.push(...(topFailureLines.length > 0 ? topFailureLines : ['1. None']));
  lines.push('', 'Failures by entity:');
  const entityLines = (report?.repairSummary?.failuresByEntity || []).map((entry) => `- ${entry.label}: ${entry.count}`);
  lines.push(...(entityLines.length > 0 ? entityLines : ['- None']));
  lines.push('', 'Failures by project/program:');
  const projectLines = (report?.repairSummary?.failuresByProjectProgram || []).map((entry) => `- ${entry.label}: ${entry.count}`);
  lines.push(...(projectLines.length > 0 ? projectLines : ['- None']));
  lines.push('', `Phase-energy violations: ${report?.phaseEnergyViolations || 0}`);
  lines.push(`Intake contradictions: ${report?.intakeContradictions || 0}`);
  lines.push(`Distribution ratio: ${Number(report?.weekdayDistributionRatio || 0).toFixed(3)}`);
  lines.push(
    `Proposal trace status: ${report?.proposalTrace?.state || 'unknown'}${report?.proposalTrace?.consistent === false ? ' (contradiction)' : ''}`
  );
  lines.push('', 'Representative sample failures:');
  const sampleFailureLines = (report?.repairSummary?.representativeSampleFailures || []).map(
    (sample, index) =>
      `${index + 1}. ${sample.title} / ${sample.entityLabel} / ${sample.projectLabel} / ${sample.reasonCodes.join(', ') || 'None'} / ${
        sample.cognitiveIssues.join(', ') || 'None'
      }`
  );
  lines.push(...(sampleFailureLines.length > 0 ? sampleFailureLines : ['1. None']));
  lines.push('', `Verdict: ${report?.verdict || 'UNKNOWN'}`);
  const sampleLines = (report?.representativeSampleReport?.samples || []).flatMap((sample) => [
    '',
    `Sample: ${sample.category}`,
    `  title: ${sample.title}`,
    `  date/time: ${sample.startISO || sample.dayKey || 'Missing'}`,
    `  entity: ${sample.entityLabel || 'Missing'}`,
    `  project/program: ${sample.projectLabel || 'Missing'}`,
    `  lane: ${sample.laneLabel || 'Missing'}`,
    `  work type: ${sample.workType || 'Missing'}`,
    `  phase: ${sample.phaseLabel || 'Missing'}`,
    `  phase permission / why now: ${sample.phaseJustification || 'None'}`,
    `  what this means: ${sample.meaning || 'Missing'}`,
    `  why this block exists: ${sample.whyThisExists || 'Missing'}`,
    `  do this: ${sample.doThis || 'Missing'}`,
    `  done when: ${sample.doneWhen || 'Missing'}`,
    `  produces: ${sample.produces || 'Missing'}`,
    `  acceptance evidence: ${sample.acceptanceEvidence || 'Missing'}`,
    `  unlocks: ${(sample.unlocks || []).join('; ') || 'None'}`,
    `  reason codes: ${(sample.reasonCodes || []).join(', ') || 'None'}`,
    `  cognitive issues: ${(sample.cognitiveIssues || []).join(', ') || 'None'}`,
    `  admission status: ${sample.admissionStatus}`,
  ]);
  if (sampleLines.length > 0) {
    lines.push('', 'Representative samples:');
    lines.push(...sampleLines);
  }
  if ((report?.representativeSampleReport?.missingRequired || []).length > 0) {
    lines.push(`Missing required samples: ${report.representativeSampleReport.missingRequired.join(', ')}`);
  }
  if ((report?.representativeSampleReport?.duplicateReuse || []).length > 0) {
    lines.push(`Reused sample categories: ${report.representativeSampleReport.duplicateReuse.join(', ')}`);
  }
  return lines.join('\n');
}
