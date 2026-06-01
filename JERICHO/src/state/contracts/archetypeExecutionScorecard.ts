import { ARCHETYPE_MATRIX_1_0 } from './archetypeMatrix1_0';
import { buildExecutionSpecLaneRows } from './archetypeMatrixValidation';

export type ExecutionScoreDimension =
  | 'classificationQuality'
  | 'outputQuality'
  | 'actionQuality'
  | 'scheduleQuality'
  | 'correctionQuality'
  | 'progressTrackingQuality';

export type ExecutionScoreRating = 'pass' | 'warn' | 'fail';

export type LaneScoreDimensionResult = {
  dimension: ExecutionScoreDimension;
  rating: ExecutionScoreRating;
  reason: string;
};

export type LaneExecutionScorecard = {
  laneId: string;
  archetype: string;
  subtype: string;
  results: LaneScoreDimensionResult[];
  overall: ExecutionScoreRating;
};

export function scoreExecutionSpecBaseline(): LaneExecutionScorecard[] {
  const rows = buildExecutionSpecLaneRows(ARCHETYPE_MATRIX_1_0);

  return rows.map((row) => {
    const results: LaneScoreDimensionResult[] = [
      {
        dimension: 'classificationQuality',
        rating: 'pass',
        reason: 'Lane is explicitly bounded in canonical 1.0 matrix.',
      },
      {
        dimension: 'outputQuality',
        rating: row.deliverableCount >= 3 ? 'pass' : 'warn',
        reason:
          row.deliverableCount >= 3
            ? `Lane defines ${row.deliverableCount} representative deliverables.`
            : 'Lane deliverable surface is below baseline minimum (3).',
      },
      {
        dimension: 'actionQuality',
        rating: row.actionClassCount >= 3 ? 'pass' : 'warn',
        reason:
          row.actionClassCount >= 3
            ? `Lane defines ${row.actionClassCount} action classes.`
            : 'Lane action-class surface is below baseline minimum (3).',
      },
      {
        dimension: 'scheduleQuality',
        rating: row.hasSchedulePattern ? 'pass' : 'fail',
        reason: row.hasSchedulePattern
          ? 'Lane defines a minimum schedule shape pattern.'
          : 'Lane is missing a minimum schedule shape pattern.',
      },
      {
        dimension: 'correctionQuality',
        rating: row.hasCorrectionPattern ? 'pass' : 'fail',
        reason: row.hasCorrectionPattern
          ? 'Lane defines correction/degradation triggers.'
          : 'Lane is missing correction trigger guidance.',
      },
      {
        dimension: 'progressTrackingQuality',
        rating: row.milestoneCount >= 1 ? 'pass' : 'warn',
        reason:
          row.milestoneCount >= 1
            ? `Lane defines ${row.milestoneCount} progress milestones.`
            : 'Lane has no milestone baseline for progress tracking.',
      },
    ];

    const hasFail = results.some((result) => result.rating === 'fail');
    const hasWarn = results.some((result) => result.rating === 'warn');

    return {
      laneId: row.laneId,
      archetype: row.archetype,
      subtype: row.subtype,
      results,
      overall: hasFail ? 'fail' : hasWarn ? 'warn' : 'pass',
    };
  });
}

export function summarizeExecutionScorecards(scorecards: LaneExecutionScorecard[]) {
  const summary = {
    laneCount: scorecards.length,
    overall: {
      pass: 0,
      warn: 0,
      fail: 0,
    },
    byDimension: {
      classificationQuality: { pass: 0, warn: 0, fail: 0 },
      outputQuality: { pass: 0, warn: 0, fail: 0 },
      actionQuality: { pass: 0, warn: 0, fail: 0 },
      scheduleQuality: { pass: 0, warn: 0, fail: 0 },
      correctionQuality: { pass: 0, warn: 0, fail: 0 },
      progressTrackingQuality: { pass: 0, warn: 0, fail: 0 },
    },
  };

  scorecards.forEach((scorecard) => {
    summary.overall[scorecard.overall] += 1;
    scorecard.results.forEach((result) => {
      summary.byDimension[result.dimension][result.rating] += 1;
    });
  });

  return summary;
}
