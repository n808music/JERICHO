import type {
  DriftSignal,
  DriftSignalCode,
  FailureClassCode,
  FailureClassResult,
  RecoveryContextState,
  RecoveryPlanState,
} from './recoveryTypes';

type MapperInput = {
  laneKey: string;
  archetype: string;
  subtype: string;
  driftSignals: DriftSignal[];
  planState?: RecoveryPlanState;
  contextState?: RecoveryContextState;
};

function has(signals: DriftSignalCode[], code: DriftSignalCode): boolean {
  return signals.includes(code);
}

function addScore(
  map: Map<FailureClassCode, { score: number; signals: Set<DriftSignalCode> }>,
  code: FailureClassCode,
  amount: number,
  signalCodes: DriftSignalCode[]
) {
  const entry = map.get(code) || { score: 0, signals: new Set<DriftSignalCode>() };
  entry.score += amount;
  signalCodes.forEach((signal) => entry.signals.add(signal));
  map.set(code, entry);
}

export function mapFailureClasses({ archetype, driftSignals, contextState = {} }: MapperInput): FailureClassResult[] {
  const signalCodes = driftSignals.map((signal) => signal.code);
  const scoreMap = new Map<FailureClassCode, { score: number; signals: Set<DriftSignalCode> }>();

  if (has(signalCodes, 'MISSED_SESSIONS') || has(signalCodes, 'LOW_ADHERENCE')) {
    addScore(scoreMap, 'CONSISTENCY_FAILURE', 3, ['MISSED_SESSIONS', 'LOW_ADHERENCE']);
  }

  if (has(signalCodes, 'OUTPUT_DELAY') && has(signalCodes, 'CAPACITY_OVERRUN')) {
    addScore(scoreMap, 'SCOPE_OVERLOAD', 4, ['OUTPUT_DELAY', 'CAPACITY_OVERRUN']);
  } else if (has(signalCodes, 'CAPACITY_OVERRUN')) {
    addScore(scoreMap, 'CAPACITY_MISMATCH', 3, ['CAPACITY_OVERRUN']);
  }

  if (has(signalCodes, 'DEPENDENCY_BLOCK')) {
    addScore(scoreMap, 'SEQUENCING_FAILURE', 3, ['DEPENDENCY_BLOCK']);
  }

  if (has(signalCodes, 'LOW_READINESS')) {
    addScore(scoreMap, 'READINESS_GAP', 3, ['LOW_READINESS']);
  }

  if (has(signalCodes, 'QUALITY_FAILURE')) {
    addScore(scoreMap, 'QUALITY_GAP', 3, ['QUALITY_FAILURE']);
  }

  if (has(signalCodes, 'RESOURCE_GAP')) {
    addScore(scoreMap, 'RESOURCE_GAP', 3, ['RESOURCE_GAP']);
  }

  if (has(signalCodes, 'LOW_THROUGHPUT')) {
    if (['JobSearchPipeline', 'SalesPipeline', 'Fundraising', 'VentureLaunch'].includes(archetype)) {
      addScore(scoreMap, 'CONVERSION_FAILURE', 4, ['LOW_THROUGHPUT']);
    } else {
      addScore(scoreMap, 'CAPACITY_MISMATCH', 2, ['LOW_THROUGHPUT']);
    }
  }

  if (
    archetype === 'PhysicalTraining' &&
    (has(signalCodes, 'LOW_READINESS') || has(signalCodes, 'QUALITY_FAILURE')) &&
    contextState.painOrSafetyRisk
  ) {
    addScore(scoreMap, 'RECOVERY_SAFETY_FAILURE', 5, ['LOW_READINESS', 'QUALITY_FAILURE']);
  }

  if (contextState.successDefinitionClear === false || (contextState.missingRequiredAnswers || []).length > 0) {
    addScore(scoreMap, 'UNCLEAR_SUCCESS_DEFINITION', 3, []);
  }

  if (has(signalCodes, 'EXTERNAL_TIMING_DISRUPTION')) {
    addScore(scoreMap, 'SEQUENCING_FAILURE', 1, ['EXTERNAL_TIMING_DISRUPTION']);
    addScore(scoreMap, 'CAPACITY_MISMATCH', 1, ['EXTERNAL_TIMING_DISRUPTION']);
  }

  const results = Array.from(scoreMap.entries())
    .sort((a, b) => b[1].score - a[1].score || a[0].localeCompare(b[0]))
    .map(
      ([code, entry]) =>
        ({
          code,
          confidence: entry.score >= 4 ? 'high' : 'medium',
          basedOn: Array.from(entry.signals),
        }) satisfies FailureClassResult
    );

  return results;
}
