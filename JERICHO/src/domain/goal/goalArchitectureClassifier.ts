import { classifyGoalPlanningTier, type GoalPlanningTier } from './planningTierClassifier';
import { extractLanesFromDescription } from '../masterPlan/masterPlanIntakeEngine.js';

export type GoalArchitecture =
  | 'single_lane_goal'
  | 'multi_lane_goal'
  | 'integrated_master_plan'
  | 'portfolio_master_plan';

export type LaneClassificationConfidence = 'low' | 'medium' | 'high';

export type InferredLane = {
  domain: string;
  title: string;
  role?: string;
  confidence?: string;
  sourceTerms?: string[];
  assessedStage?: string;
  domainRole?: string;
  strategicRole?: string;
};

export type GoalArchitectureInference = {
  planningTier: GoalPlanningTier;
  goalArchitecture: GoalArchitecture;
  executionModel: 'single_track' | 'multi_lane_portfolio';
  primaryLane: string | null;
  supportingLanes: string[];
  laneComposition: InferredLane[];
  laneClassificationConfidence: LaneClassificationConfidence;
  classificationSource: 'inferred' | 'user_corrected' | 'fallback';
};

const PRIMARY_LANE_PRIORITY: Record<string, number> = {
  product: 100,
  creative: 90,
  media: 80,
  brand: 70,
  company: 65,
  income: 60,
  capital: 55,
  institution: 50,
  civic: 45,
};

function uniqueByDomain(lanes: InferredLane[] = []) {
  const seen = new Set<string>();
  return lanes.filter((lane) => {
    const key = String(lane?.domain || '').trim().toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function classifyLaneConfidence(lanes: InferredLane[], goalText: string): LaneClassificationConfidence {
  const lower = String(goalText || '').toLowerCase();
  const laneCount = lanes.length;
  const integrationSignals =
    /\b(anchor|hard convergence|work backward|master calendar|dependencies|sequence|capital needs|tradeoffs|milestones|risks)\b/.test(
      lower
    );
  if (laneCount >= 4 && integrationSignals) {
    return 'high';
  }
  if (laneCount >= 3) {
    return 'medium';
  }
  return 'low';
}

export function inferGoalArchitecture(
  goalText: string,
  options: {
    planningTier?: GoalPlanningTier | null;
    laneOverrides?: InferredLane[] | null;
    classificationSource?: 'inferred' | 'user_corrected' | 'fallback';
  } = {}
): GoalArchitectureInference {
  const planningTier =
    options.planningTier || classifyGoalPlanningTier(goalText);
  const extracted = uniqueByDomain(
    (Array.isArray(options.laneOverrides) && options.laneOverrides.length > 0
      ? options.laneOverrides
      : extractLanesFromDescription(goalText)) as InferredLane[]
  );
  const sorted = [...extracted].sort((left, right) => {
    const leftScore = PRIMARY_LANE_PRIORITY[String(left?.domain || '').trim().toLowerCase()] || 0;
    const rightScore = PRIMARY_LANE_PRIORITY[String(right?.domain || '').trim().toLowerCase()] || 0;
    return rightScore - leftScore;
  });
  const primaryLane = sorted[0]?.domain || null;
  const supportingLanes = sorted.slice(1).map((lane) => lane.domain);
  const lower = String(goalText || '').toLowerCase();
  const integratedSignals =
    /\b(anchor|hard convergence|work backward|integrated|coordinate|coordinating|dependencies|master calendar|ecosystem|support campaign|execution engine)\b/.test(
      lower
    ) ||
    (planningTier === 'master_plan' &&
      sorted.length >= 4 &&
      /\b(scale|through|company|companies|empire|operation endgame|global state)\b/.test(lower));

  let goalArchitecture: GoalArchitecture = 'single_lane_goal';
  if (planningTier === 'master_plan') {
    goalArchitecture = integratedSignals ? 'integrated_master_plan' : 'portfolio_master_plan';
  } else if (sorted.length > 1) {
    goalArchitecture = 'multi_lane_goal';
  }

  return {
    planningTier,
    goalArchitecture,
    executionModel: sorted.length > 1 || planningTier === 'master_plan' ? 'multi_lane_portfolio' : 'single_track',
    primaryLane,
    supportingLanes,
    laneComposition: sorted,
    laneClassificationConfidence: classifyLaneConfidence(sorted, goalText),
    classificationSource: options.classificationSource || (options.laneOverrides ? 'user_corrected' : 'inferred'),
  };
}
