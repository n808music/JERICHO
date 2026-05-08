import type { DriftDetectionInput, DriftSignal } from './recoveryTypes';

function pct(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return numerator / denominator;
}

export function detectDriftSignals(input: DriftDetectionInput): DriftSignal[] {
  const { laneKey, planState = {}, executionState = {}, scheduleState = {} } = input;

  const signals: DriftSignal[] = [];

  const plannedSessions = Number(executionState.plannedSessions ?? 0);
  const completedSessions = Number(executionState.completedSessions ?? 0);
  const missedSessions = Number(executionState.missedSessions ?? Math.max(0, plannedSessions - completedSessions));
  const missedRatio = pct(missedSessions, plannedSessions || 1);
  if (plannedSessions > 0 && (missedSessions >= 2 || missedRatio >= 0.25)) {
    signals.push({
      code: 'MISSED_SESSIONS',
      severity: missedRatio >= 0.5 ? 'critical' : 'warning',
      evidence: { missedSessions, plannedSessions, missedRatio },
      laneKey,
    });
  }

  const plannedOutputs = Number(planState.plannedOutputs ?? 0);
  const completedOutputs = Number(planState.completedOutputs ?? 0);
  const outputCompletionRatio = pct(completedOutputs, plannedOutputs || 1);
  if (plannedOutputs > 0 && outputCompletionRatio < 0.7) {
    signals.push({
      code: 'OUTPUT_DELAY',
      severity: outputCompletionRatio < 0.4 ? 'critical' : 'warning',
      evidence: { plannedOutputs, completedOutputs, outputCompletionRatio },
      laneKey,
    });
  }

  const readinessScore = Number(executionState.readinessScore ?? NaN);
  const benchmarkPassed = executionState.benchmarkPassed;
  if ((Number.isFinite(readinessScore) && readinessScore < 0.6) || benchmarkPassed === false) {
    signals.push({
      code: 'LOW_READINESS',
      severity: Number.isFinite(readinessScore) && readinessScore < 0.45 ? 'critical' : 'warning',
      evidence: { readinessScore: Number.isFinite(readinessScore) ? readinessScore : null, benchmarkPassed },
      laneKey,
    });
  }

  const throughputActual = Number(executionState.throughputActual ?? NaN);
  const throughputExpected = Number(executionState.throughputExpected ?? NaN);
  const throughputRatio = pct(throughputActual, throughputExpected || 1);
  if (
    Number.isFinite(throughputActual) &&
    Number.isFinite(throughputExpected) &&
    throughputExpected > 0 &&
    throughputRatio < 0.75
  ) {
    signals.push({
      code: 'LOW_THROUGHPUT',
      severity: throughputRatio < 0.5 ? 'critical' : 'warning',
      evidence: { throughputActual, throughputExpected, throughputRatio },
      laneKey,
    });
  }

  const qualityFailures = Number(executionState.qualityFailures ?? 0);
  const qualityScore = Number(executionState.qualityScore ?? NaN);
  if (qualityFailures > 0 || (Number.isFinite(qualityScore) && qualityScore < 0.65)) {
    signals.push({
      code: 'QUALITY_FAILURE',
      severity: qualityFailures > 1 || (Number.isFinite(qualityScore) && qualityScore < 0.45) ? 'critical' : 'warning',
      evidence: { qualityFailures, qualityScore: Number.isFinite(qualityScore) ? qualityScore : null },
      laneKey,
    });
  }

  const blockedDependencies = Number(planState.blockedDependencies ?? 0);
  if (blockedDependencies > 0 || executionState.dependencyBlocked) {
    signals.push({
      code: 'DEPENDENCY_BLOCK',
      severity: blockedDependencies > 1 ? 'critical' : 'warning',
      evidence: { blockedDependencies, dependencyBlocked: Boolean(executionState.dependencyBlocked) },
      laneKey,
    });
  }

  const requiredWeekly = Number(scheduleState.requiredWeeklySessions ?? planState.requiredWeeklySessions ?? 0);
  const availableWeekly = Number(scheduleState.availableWeeklySessions ?? planState.availableWeeklySessions ?? 0);
  const unplacedSessions = Number(scheduleState.unplacedSessions ?? 0);
  if ((requiredWeekly > 0 && availableWeekly > 0 && requiredWeekly > availableWeekly * 1.2) || unplacedSessions > 0) {
    signals.push({
      code: 'CAPACITY_OVERRUN',
      severity: requiredWeekly > availableWeekly * 1.5 || unplacedSessions > 2 ? 'critical' : 'warning',
      evidence: { requiredWeekly, availableWeekly, unplacedSessions },
      laneKey,
    });
  }

  const adherenceRate = Number(executionState.adherenceRate ?? NaN);
  if (Number.isFinite(adherenceRate) && adherenceRate < 0.65) {
    signals.push({
      code: 'LOW_ADHERENCE',
      severity: adherenceRate < 0.45 ? 'critical' : 'warning',
      evidence: { adherenceRate },
      laneKey,
    });
  }

  const setupOutputsIncomplete = Number(planState.setupOutputsIncomplete ?? 0);
  if (executionState.resourceGap || setupOutputsIncomplete > 0) {
    signals.push({
      code: 'RESOURCE_GAP',
      severity: setupOutputsIncomplete > 1 ? 'critical' : 'warning',
      evidence: { resourceGap: Boolean(executionState.resourceGap), setupOutputsIncomplete },
      laneKey,
    });
  }

  if (executionState.externalTimingDisruption) {
    signals.push({
      code: 'EXTERNAL_TIMING_DISRUPTION',
      severity: 'warning',
      evidence: { externalTimingDisruption: true },
      laneKey,
    });
  }

  return signals;
}
