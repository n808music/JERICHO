import { ARCHETYPE_MATRIX_1_0 } from './archetypeMatrix1_0';
import { evaluateArchetypeRuleQuality } from '../engine/archetypeRuleQuality';
import { compileGoalToDeliverables } from '../engine/goalToDeliverables';
import {
  getBoundedRepresentativeGoals1_0,
  getRepresentativeGoals1_0,
  normalizeLaneKey,
  type RepresentativeGoalFixture,
} from './archetypeRepresentativeGoals1_0';

export type LaneRepresentativeGoal = {
  laneId: string;
  archetype: string;
  subtype: string;
  goalText: string;
};

export type LaneCompilerScore = {
  laneId: string;
  archetype: string;
  subtype: string;
  goalText: string;
  compiler: {
    usesCanonicalDeliverablePath: boolean;
    deliverableCount: number;
    actionSeedCount: number;
    estimatedSessionCount: number;
  };
  scorecard: {
    outputQuality: 'pass' | 'warn' | 'fail';
    actionQuality: 'pass' | 'warn' | 'fail';
    scheduleQuality: 'pass' | 'warn' | 'fail';
    correctionQuality: 'pass' | 'warn' | 'fail';
    progressTrackingQuality: 'pass' | 'warn' | 'fail';
  };
  overall: 'pass' | 'warn' | 'fail';
  issues: string[];
};

export type LaneCompilerScoreAggregate = {
  total: number;
  pass: number;
  warn: number;
  fail: number;
  byArchetype: Record<string, { pass: number; warn: number; fail: number }>;
  byLane: Record<string, { overall: 'pass' | 'warn' | 'fail'; dimensions: LaneCompilerScore['scorecard'] }>;
  weakestDimensions: Record<keyof LaneCompilerScore['scorecard'], string[]>;
};

function tokenize(value: string): string[] {
  return String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function overlapScore(targets: string[], observed: string[]): number {
  if (!targets.length) return 1;
  const observedTokens = new Set(observed.flatMap((entry) => tokenize(entry)));
  let hits = 0;
  targets.forEach((entry) => {
    const keywords = tokenize(entry);
    const matched = keywords.some((keyword) => observedTokens.has(keyword));
    if (matched) hits += 1;
  });
  return hits / targets.length;
}

function toRating(score: number, pass = 0.6, warn = 0.3): 'pass' | 'warn' | 'fail' {
  if (score >= pass) return 'pass';
  if (score >= warn) return 'warn';
  return 'fail';
}

function getExecutionType(archetype: string): string {
  if (archetype === 'SkillAcquisition') return 'SkillAcquisition';
  if (archetype === 'BrandLaunch') return 'BrandLaunch';
  if (archetype === 'SalesPipeline') return 'SalesPipeline';
  if (archetype === 'Fundraising') return 'Fundraising';
  return archetype;
}

function synthesizeActionsFromLane(archetype: string, subtype: string) {
  const archetypeSpec = ARCHETYPE_MATRIX_1_0.find((entry) => entry.archetype === archetype);
  const lane = archetypeSpec?.lanes.find((entry) => entry.subtype === subtype);
  if (!lane) return [];

  return lane.grammar.typicalDeliverables.map((deliverable, index) => ({
    id: `${archetype}:${subtype}:${index + 1}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title: `${lane.grammar.actionClasses[index % lane.grammar.actionClasses.length] || 'execute'}: ${deliverable}`,
    deliverable,
    definitionOfDone: `Output completed: ${deliverable}`,
    actionType: index === 0 ? 'preparation' : 'execution',
    estimateMin: 60,
    dependencies: index === 0 ? [] : [`${archetype}:${subtype}:${index}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')],
  }));
}

export function getBoundedRepresentativeGoals() {
  return getBoundedRepresentativeGoals1_0().map(toLaneGoal);
}

export function getFullRepresentativeGoals() {
  return getRepresentativeGoals1_0().map(toLaneGoal);
}

function toLaneGoal(fixture: RepresentativeGoalFixture): LaneRepresentativeGoal {
  return {
    laneId: normalizeLaneKey(fixture.archetype, fixture.subtype)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_'),
    archetype: fixture.archetype,
    subtype: fixture.subtype,
    goalText: fixture.representativeGoal,
  };
}

export function runCompilerScorecardForGoal(goal: LaneRepresentativeGoal): LaneCompilerScore {
  const laneSpec = ARCHETYPE_MATRIX_1_0.find((entry) => entry.archetype === goal.archetype)?.lanes.find(
    (entry) => entry.subtype === goal.subtype
  );
  if (!laneSpec) {
    throw new Error(`Unknown lane: ${goal.laneId}`);
  }

  const compiled = compileGoalToDeliverables({
    executionType: getExecutionType(goal.archetype),
    actions: synthesizeActionsFromLane(goal.archetype, goal.subtype),
    contract: { goalText: goal.goalText, terminalOutcome: { text: goal.goalText } },
    cycleId: `scorecard:${goal.laneId}`,
  });

  const quality = evaluateArchetypeRuleQuality(compiled);
  const outputOverlap = overlapScore(
    laneSpec.grammar.typicalDeliverables,
    compiled.deliverables.map((entry) => entry.title)
  );
  const actionOverlap = overlapScore(
    laneSpec.grammar.actionClasses,
    compiled.actionSeeds.map((entry) => entry.title)
  );

  const scorecard = {
    outputQuality: toRating(outputOverlap),
    actionQuality: toRating(actionOverlap),
    scheduleQuality: compiled.actionSeeds.length > 0 && compiled.estimatedSessionCount > 0 ? 'pass' : 'fail',
    correctionQuality: laneSpec.grammar.correctionPattern.trim() ? 'pass' : 'fail',
    progressTrackingQuality: laneSpec.grammar.typicalMilestones.length > 0 ? 'pass' : 'warn',
  } as LaneCompilerScore['scorecard'];

  const ratings = Object.values(scorecard);
  const overall: LaneCompilerScore['overall'] = ratings.includes('fail')
    ? 'fail'
    : ratings.includes('warn')
      ? 'warn'
      : 'pass';

  const issues: string[] = [];
  if (!compiled.usesCanonicalDeliverablePath) issues.push('COMPILER_NOT_ON_CANONICAL_PATH');
  if (quality.invalidCount > 0) issues.push('DELIVERABLE_QUALITY_ERRORS_PRESENT');
  if (quality.warningCount > 0) issues.push('DELIVERABLE_QUALITY_WARNINGS_PRESENT');

  return {
    laneId: goal.laneId,
    archetype: goal.archetype,
    subtype: goal.subtype,
    goalText: goal.goalText,
    compiler: {
      usesCanonicalDeliverablePath: compiled.usesCanonicalDeliverablePath,
      deliverableCount: compiled.deliverables.length,
      actionSeedCount: compiled.actionSeeds.length,
      estimatedSessionCount: compiled.estimatedSessionCount,
    },
    scorecard,
    overall,
    issues,
  };
}

export function runCompilerScorecardBoundedRollout(goals = getBoundedRepresentativeGoals()) {
  return runCompilerScorecard(goals);
}

export function runCompilerScorecardFullMatrix(goals = getFullRepresentativeGoals()) {
  return runCompilerScorecard(goals);
}

function runCompilerScorecard(goals: LaneRepresentativeGoal[]) {
  const laneResults = goals.map((goal) => runCompilerScorecardForGoal(goal));
  const weakestDimensions: LaneCompilerScoreAggregate['weakestDimensions'] = {
    outputQuality: [],
    actionQuality: [],
    scheduleQuality: [],
    correctionQuality: [],
    progressTrackingQuality: [],
  };
  const aggregate: LaneCompilerScoreAggregate = {
    total: laneResults.length,
    pass: 0,
    warn: 0,
    fail: 0,
    byArchetype: {},
    byLane: {},
    weakestDimensions,
  };

  laneResults.forEach((result) => {
    aggregate[result.overall] += 1;
    aggregate.byArchetype[result.archetype] = aggregate.byArchetype[result.archetype] || { pass: 0, warn: 0, fail: 0 };
    aggregate.byArchetype[result.archetype][result.overall] += 1;
    aggregate.byLane[normalizeLaneKey(result.archetype, result.subtype)] = {
      overall: result.overall,
      dimensions: result.scorecard,
    };

    const dimensions = result.scorecard;
    (Object.keys(dimensions) as Array<keyof LaneCompilerScore['scorecard']>).forEach((dimension) => {
      if (dimensions[dimension] !== 'pass') {
        aggregate.weakestDimensions[dimension].push(normalizeLaneKey(result.archetype, result.subtype));
      }
    });
  });

  return {
    goals,
    laneResults,
    aggregate,
  };
}
