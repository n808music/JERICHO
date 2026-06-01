import { deriveIdentityRequirements } from './identity-requirements.js';
import { computeCapabilityGaps, rankCapabilityGaps } from './gap-analysis.js';
import { generateTasksForCycle } from './task-generator.js';
import { validateGoal } from './validate-goal.js';
import { computeIntegrityScore, explainIntegrityScore } from './scoring-engine.js';
import { applyIdentityUpdate } from './identity-update.js';
import { buildDaySlots, scheduleTasksIntoSlots } from './temporal-engine.js';
import { analyzeFailurePatterns } from './failure-engine.js';
import { computeForecast } from './forecast-engine.js';
import { evaluateSystemHealth } from './meta-engine.js';
import { decomposeGoal } from './goal-decomposition.js';
import { buildStrategicCalendar } from './strategic-calendar.js';
import { compressTasksForCycle } from './task-compression.js';
import { analyzeAndOptimizePortfolio } from './portfolio-optimizer.js';
import { evaluateCycleGovernance } from './cycle-governance.js';
import { explainTaskReasons } from './explanations.js';
import { analyzeIntegrityDeviations } from './integrity-deviation-engine.js';
import { analyzeTeamIdentity } from './team-identity-engine.js';
import evaluateTeamGovernance from './team-governance-engine.js';
import compileTeamNarrative from './team-narrative-engine.js';
import { normalizeGoalInput } from './goal-domain.js';
import { selectPacingMode } from './behavioral-control-engine.js';
import { assessFeasibility } from './feasibility-agent.js';
import { classifyGoalCategory } from './identity-requirements.js';
import { startTrace, addTraceEvent } from './diagnostics.js';
import { runIntegrationVerification } from './integration-verification-agent.js';

/**
 * Run the closed-loop pipeline once for the provided goal input and identity state.
 * goalInput: { goals: string[] }
 */
export function runPipeline(goalInput, identity, history = [], tasks = [], team = undefined) {
  // Start trace for this pipeline run
  const traceId = startTrace('pipeline_run', goalInput?.goals?.[0]?.id || 'unknown');

  const rawGoal = Array.isArray(goalInput?.goals) ? goalInput.goals[0] : '';
  const validation = validateGoal(rawGoal);
  const identityState = normalizeIdentity(identity);

  addTraceEvent('pipeline', 'goal_validation', validation.valid ? 'success' : 'failure',
    { rawGoal: rawGoal.substring(0, 100) },
    { valid: validation.valid, goal: validation.goal?.raw },
    validation.valid ? null : 'INVALID_GOAL_INPUT'
  );

  if (!validation.valid) {
    addTraceEvent('pipeline', 'early_exit', 'failure', {}, {}, 'INVALID_GOAL_INPUT');
    return {
      goal: null,
      error: validation.error,
      identityBefore: identityState,
      identityAfter: identityState,
      requirements: [],
      gaps: [],
      rankedGaps: [],
      tasks: [],
      integrity: {
        score: 0,
        completedCount: 0,
        missedCount: 0,
        pendingCount: 0,
        rawTotal: 0,
        maxPossible: 0,
        breakdown: {
          completedOnTime: 0,
          completedLate: 0,
          missed: 0,
          totalTasks: 0,
          completionRate: 0,
          onTimeRate: 0
        },
        lastRun: null
      },
      changes: [],
      history
    };
  }

  const goal = validation.goal;

  const requirements = deriveIdentityRequirements(goal);
  addTraceEvent('pipeline', 'requirements_derivation', 'success',
    { goal: goal.raw },
    { requirementsCount: requirements.length }
  );

  const gapsBefore = computeCapabilityGaps(identityState, requirements);
  const rankedGapsBefore = rankCapabilityGaps(gapsBefore);
  addTraceEvent('pipeline', 'gap_analysis', 'success',
    { requirementsCount: requirements.length },
    { gapsCount: gapsBefore.length, rankedGapsCount: rankedGapsBefore.length }
  );

  const goalMeta = normalizeGoalInput(goal.raw);

  const integritySummary = computeIntegrityScore(tasks);
  addTraceEvent('pipeline', 'integrity_scoring', 'success',
    { tasksCount: tasks.length },
    { integrityScore: integritySummary.score, completedCount: integritySummary.completedCount }
  );

  const integrityExplanation = explainIntegrityScore(tasks);

  const { updatedIdentity, changes } = applyIdentityUpdate(
    identityState,
    rankedGapsBefore,
    integritySummary,
    tasks
  );
  addTraceEvent('pipeline', 'identity_update', 'success',
    { gapsCount: rankedGapsBefore.length },
    { changesCount: changes.length }
  );

  const gapsAfter = computeCapabilityGaps(updatedIdentity, requirements);
  const rankedGapsAfter = rankCapabilityGaps(gapsAfter);
  const averagePressure =
    rankedGapsAfter && rankedGapsAfter.length
      ? rankedGapsAfter.reduce((acc, g) => acc + Math.max(0, g.weightedGap ?? 0), 0) /
        rankedGapsAfter.length
      : 0;
  const recentCompletionRate =
    integritySummary.completedCount + integritySummary.missedCount > 0
      ? integritySummary.completedCount /
        (integritySummary.completedCount + integritySummary.missedCount)
      : 0;
  const pacing = selectPacingMode({
    integrity: integritySummary.score,
    averagePressure,
    recentCompletionRate
  });

  const withFallbackGaps =
    rankedGapsAfter && rankedGapsAfter.length
      ? rankedGapsAfter
      : [
          {
            requirementId: goalMeta.domain,
            domain: goalMeta.domain,
            capability: goalMeta.capability,
            targetLevel: 5,
            currentLevel: 0,
            weight: 0.5,
            weightedGap: 1
          }
        ];

  const now = new Date();
  const nowIso = now.toISOString();
  const cycleStartIso = nowIso;
  const cycleEnd = new Date(now);
  cycleEnd.setDate(cycleEnd.getDate() + 7);
  const cycleEndIso = cycleEnd.toISOString();

  const nextCycleTasks = generateTasksForCycle(goal, withFallbackGaps, {
    maxTasks: 4 + (pacing.maxTasksDelta ?? 0),
    cycleDays: 7,
    domainHint: goalMeta.domain,
    capabilityHint: goalMeta.capability,
    integrityScore: integritySummary.score,
    goalLink: goal.raw || goal.outcome || 'goal',
    difficultyBias: pacing.difficultyBias,
    now: nowIso
  }).map(
    (task, idx) => ({
      ...task,
      id: `task-${withFallbackGaps[idx]?.capability || task.capability || 'cap'}-${idx}`
    })
  );
  if (nextCycleTasks.length === 0) {
    nextCycleTasks.push(buildFallbackTask(goal, goalMeta));
  }

  const daySlots = buildDaySlots(cycleStartIso, cycleEndIso);
  const { daySlots: scheduledDaySlots, overflowTasks, todayPriorityTaskId } = scheduleTasksIntoSlots(
    nextCycleTasks,
    daySlots,
    integritySummary,
    { currentDate: nowIso.split('T')[0] } // Pass deterministic current date
  );
  const finalToday = todayPriorityTaskId || nextCycleTasks[0]?.id || null;

  const historyEntry = {
    timestamp: nowIso,
    goalId: goal.id,
    integrity: {
      ...integritySummary,
      breakdown: integrityExplanation.breakdown
    },
    identityBefore: identityState,
    identityAfter: updatedIdentity,
    changes
  };
  const updatedHistory = [...(history || []), historyEntry];

  const failureAnalysis = analyzeFailurePatterns(updatedHistory, integritySummary);
  const forecast = computeForecast(goal, requirements, updatedHistory);

  // Feasibility assessment (Module 3) - use a default capacity vector for pipeline runs
  const category = classifyGoalCategory(goal);
  const familyMap = {
    product_launch: 'VentureLaunch',
    creative_project: 'CreativeProduction',
    body_composition: 'PhysicalTraining',
    learning_goal: 'SkillAcquisition',
    generic_execution: 'VentureLaunch'
  };
  const goalFamily = familyMap[category] || 'VentureLaunch';
  const goalSubtype = goalFamily === 'VentureLaunch' ? 'SaaS Product Launch' : null;

  const feasibilityInputs = {
    availableHoursPerWeek: 10,
    availableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    sessionLengthPreference: '1_hour',
    goalStartDate: nowIso,
    goalDeadline: goal.deadline || nowIso,
    currentLoadLevel: 'moderate',
    priorExperience: 'some_experience',
    externalDependencyCount: 0,
    familySpecificInputs: {}
  };

  const feasibilityResult = assessFeasibility(feasibilityInputs, goalFamily, goalSubtype);
  const capacityVector = feasibilityResult.capacityVector || {};
  const effortEstimate = feasibilityResult.effortEstimate || {};
  const feasibility = feasibilityResult.feasibility || { baselineFeasibilityScore: 0, limitingFactors: [] };
  const feasibilityScore = feasibility.baselineFeasibilityScore;
  const reasonCodes = feasibility.limitingFactors || [];

  addTraceEvent('pipeline', 'baseline_feasibility', 'success',
    { requirementsCount: requirements.length, gapsCount: rankedGapsAfter.length },
    { feasibilityScore, reasonCodes }
  );

  const totalScheduledTasks = scheduledDaySlots
    .flatMap((d) => d.slots)
    .reduce((acc, slot) => acc + slot.taskIds.length, 0);
  const scheduleSummary = {
    daySlotsCount: scheduledDaySlots.length,
    totalScheduledTasks,
    totalOverflowTasks: overflowTasks.length
  };
  const systemHealth = evaluateSystemHealth({
    goal,
    history: updatedHistory,
    integritySummary,
    scheduleSummary,
    failureAnalysis,
    forecast,
    feasibilityScore
  });

  const milestones = decomposeGoal(goal, requirements, forecast);
  const strategicCalendar = buildStrategicCalendar(goal, milestones, forecast);
  const tasksById = buildTasksByIdMap(nextCycleTasks);
  const nextCycleIndex = updatedHistory.length;
  const compressedPlan = compressTasksForCycle({
    goal,
    nextCycleIndex,
    tasks: nextCycleTasks.map((task) => ({
      id: task.id,
      capabilityId: task.requirementId || task.id,
      domain: task.domain,
      capability: task.capability,
      difficulty: task.difficulty ?? 3,
      impactWeight: task.estimatedImpact ?? 0,
      deadlineCycle: null
    })),
    governance: systemHealth?.governance,
    strategicCalendar
  });
  const portfolio = analyzeAndOptimizePortfolio({
    identityRequirements: requirements,
    strategicCalendar,
    nextCycleIndex,
    compressedPlan,
    tasksById
  });
  const cycleGovernance = evaluateCycleGovernance({
    goal,
    nextCycleIndex,
    systemHealth,
    failureAnalysis,
    forecast,
    strategicCalendar,
    compressedPlan,
    portfolioAnalysis: portfolio
  });
  // Behavior sim note: across burnout/steady profiles the governance mode often stayed reset_identity
  // with allowedTasks=2 even as integrity climbed into the 60–70s; revisit thresholds if we want T2/T3
  // to arrive faster once integrity rebounds.
  const teamGovernance = evaluateTeamGovernance(team || {}, goalInput?.goals || [], identityState, nextCycleTasks);
  const integrityDeviations = analyzeIntegrityDeviations(updatedHistory, integritySummary, teamGovernance);
  const teamIdentity = analyzeTeamIdentity({
    team,
    identity: identityState,
    goals: goalInput?.goals || requirements,
    history: updatedHistory
  });
  const teamNarrative = compileTeamNarrative({
    goals: Array.isArray(goalInput?.goals) ? goalInput.goals : goal ? [goal] : [],
    team: team || {},
    tasks: nextCycleTasks,
    teamGovernance,
    sessionMeta: { cycleIndex: updatedHistory.length }
  });

  const decisionById = buildDecisionMap(compressedPlan);
  const reasonsById = buildReasonMap(compressedPlan);
  const domainStatusByName = buildDomainStatusMap(portfolio);
  const allowedTasks = cycleGovernance?.allowedTasks ?? null;
  const governanceEligibleById = buildGovernanceEligibilityMap({
    tasks: nextCycleTasks,
    decisionById,
    allowedTasks,
    nextCycleIndex
  });

  const taskViews = nextCycleTasks.map((task) => {
    const decision = decisionById.get(task.id) || 'none';
    const domain = task.domain || task.capabilityDomain || 'unknown';
    const domainStatus = domainStatusByName.get(domain) || 'balanced';
    const baseReasons = reasonsById.get(task.id) || [];
    const governanceEligible = !!governanceEligibleById.get(task.id);
    const taskCycle = task.cycle != null ? task.cycle : nextCycleIndex;

    const reasons = [...baseReasons];
    if (domainStatus === 'over') reasons.push('over_weighted_domain');
    if (domainStatus === 'under') reasons.push('under_weighted_domain');
    if (decision === 'defer') reasons.push('deferred_by_compression');
    if (decision === 'drop') reasons.push('dropped_by_compression');
    if (decision === 'keep' && !governanceEligible && allowedTasks != null) {
      reasons.push('above_cycle_cap');
    }

    const explanations = explainTaskReasons({
      ...task,
      decision,
      governanceEligible,
      domainStatus,
      reasons,
      cycle: taskCycle
    });

    return {
      ...task,
      decision,
      governanceEligible,
      domainStatus,
      reasons,
      explanations,
      cycle: taskCycle
    };
  });

  const taskBoard = {
    tasks: taskViews,
    summary: {
      allowedTasks,
      keptCount: taskViews.filter((t) => t.decision === 'keep').length,
      deferredCount: taskViews.filter((t) => t.decision === 'defer').length,
      droppedCount: taskViews.filter((t) => t.decision === 'drop').length,
      eligibleCount: taskViews.filter((t) => t.decision === 'keep' && t.governanceEligible).length
    }
  };

  // Final trace event for pipeline completion
  addTraceEvent('pipeline', 'pipeline_complete', 'success',
    { totalSteps: 8 }, // Rough count of major steps
    {
      requirementsCount: requirements.length,
      tasksCount: nextCycleTasks.length,
      integrityScore: integritySummary.score,
      scheduledTasksCount: totalScheduledTasks,
      forecastAvailable: !!forecast
    }
  );

  // Agent 8: Integration Verification
  const verificationContext = {
    traceId,
    goal,
    actionGraph: [], // Not implemented yet
    graphValidation: { graphValidationStatus: 'VALID' }, // Placeholder
    capacityVector,
    effortEstimate,
    feasibility,
    schedulingPolicy: {}, // Not implemented yet
    scheduleProposal: {}, // Not implemented yet
    committedBlocks: [], // Not implemented yet
    executionSignals: [],
    stabilityRecords: [],
    driftDetection: {},
    failureClassification: {},
    recoveryRecommendation: {},
    userConfirmations: [] // No confirmations in pipeline run
  };

  const verificationRecord = runIntegrationVerification(verificationContext);

  return {
    goal,
    identityBefore: identityState,
    identityAfter: updatedIdentity,
    requirements,
    gaps: gapsAfter,
    rankedGaps: rankedGapsAfter,
    tasks: nextCycleTasks,
    integrity: {
      ...integritySummary,
      breakdown: integrityExplanation.breakdown,
      lastRun: nowIso
    },
    changes,
    history: updatedHistory,
    schedule: {
      daySlots: scheduledDaySlots,
      overflowTasks,
      todayPriorityTaskId: finalToday,
      cycleStart: cycleStartIso,
      cycleEnd: cycleEndIso
    },
    taskBoard,
    analysis: {
      failure: failureAnalysis,
      forecast,
      systemHealth,
      milestones,
      strategicCalendar,
    compressedPlan,
    portfolio,
    cycleGovernance,
    integrityDeviations,
    teamIdentity,
    teamGovernance,
    teamNarrative
  },
    verification: verificationRecord
  };
}

function buildTasksByIdMap(tasks = []) {
  const map = {};
  for (const task of tasks) {
    map[task.id] = task;
  }
  return map;
}

function buildDecisionMap(compressedPlan = {}) {
  const map = new Map();
  const add = (arr = [], decision) => {
    arr.forEach((item) => map.set(item.id, decision));
  };
  add(compressedPlan.kept, 'keep');
  add(compressedPlan.deferred || compressedPlan.defer, 'defer');
  add(compressedPlan.dropped, 'drop');
  return map;
}

function buildReasonMap(compressedPlan = {}) {
  const map = new Map();
  const add = (arr = []) => {
    arr.forEach((item) => {
      const reasons = Array.isArray(item.reasonCodes) ? [...item.reasonCodes] : [];
      map.set(item.id, reasons);
    });
  };
  add(compressedPlan.kept);
  add(compressedPlan.deferred || compressedPlan.defer);
  add(compressedPlan.dropped);
  return map;
}

function buildDomainStatusMap(portfolio = {}) {
  const map = new Map();
  const domains = portfolio?.currentMix?.domains || [];
  domains.forEach((d) => {
    if (d?.domain) {
      map.set(d.domain, d.status || 'balanced');
    }
  });
  return map;
}

function buildGovernanceEligibilityMap({ tasks = [], decisionById, allowedTasks, nextCycleIndex }) {
  const keptNextCycle = tasks.filter((task) => {
    const keep = decisionById.get(task.id) === 'keep';
    const cycleMatches = task.cycle === nextCycleIndex || task.cycle == null;
    return keep && cycleMatches;
  });

  keptNextCycle.sort((a, b) => {
    const impactA = a.estimatedImpact ?? a.impactWeight ?? 0;
    const impactB = b.estimatedImpact ?? b.impactWeight ?? 0;
    if (impactB !== impactA) return impactB - impactA;
    return (a.id || '').localeCompare(b.id || '');
  });

  const governanceEligibleById = new Map();
  const limit =
    allowedTasks == null ? keptNextCycle.length : Math.min(allowedTasks, keptNextCycle.length);

  keptNextCycle.forEach((task, index) => {
    governanceEligibleById.set(task.id, index < limit);
  });

  return governanceEligibleById;
}

function normalizeIdentity(identity) {
  if (Array.isArray(identity)) {
    return identity.map((entry) => ({
      id: entry.id || `${entry.domain || 'domain'}-${entry.capability || 'cap'}`,
      domain: entry.domain,
      capability: entry.capability,
      level: clamp(entry.level, 1, 10)
    }));
  }

  if (identity && typeof identity === 'object') {
    // identity keyed by capability id or by domain->capability
    const flattened = [];
    Object.entries(identity).forEach(([domainKey, value]) => {
      if (value && typeof value === 'object' && 'level' in value) {
        flattened.push({
          id: domainKey,
          domain: value.domain || domainKey,
          capability: value.capability || domainKey,
          level: clamp(value.level, 1, 10)
        });
      } else if (value && typeof value === 'object') {
        Object.entries(value).forEach(([capKey, capVal]) => {
          if (capVal && typeof capVal === 'object') {
            flattened.push({
              id: `${domainKey}-${capKey}`,
              domain: domainKey,
              capability: capKey,
              level: clamp(capVal.level, 1, 10)
            });
          }
        });
      }
    });
    return flattened;
  }

  return [];
}

function clamp(val, min, max) {
  const num = Number(val);
  if (Number.isNaN(num)) return min;
  return Math.min(Math.max(num, min), max);
}

function buildFallbackTask(goal, goalMeta) {
  const createdAt = new Date();
  const dueDate = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    id: `task-${goalMeta.capability || 'generic'}-direct`,
    requirementId: `fallback-${goalMeta.capability || 'generic'}`,
    domain: goalMeta.domain || 'execution',
    capability: goalMeta.capability || 'execution',
    title: `First move: ${goalMeta.capability || 'execute'}`,
    description: `Take a concrete step toward: ${goal.outcome || goal.raw || 'your goal'}.`,
    difficulty: 2,
    estimatedImpact: 0.6,
    dueDate: dueDate.toISOString(),
    status: 'pending',
    createdAt: createdAt.toISOString(),
    ladderIndex: 0
  };
}
