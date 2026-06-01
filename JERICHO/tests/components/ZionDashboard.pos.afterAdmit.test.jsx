import React from 'react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';

const noop = vi.fn();
let mockStore = {};

vi.mock('../../src/state/identityStore', () => ({
  useIdentityStore: () => mockStore,
}));

function buildStore({
  withFeasibility = true,
  livePos = null,
  planQualityGate = null,
  planQualityState = 'policy_clean',
  feasibilityPolicy = null,
  cycleFeasibilityScore = undefined,
  shotClock = null,
  containment = null,
  masterPlanPolicy = null,
} = {}) {
  const dayKey = '2026-03-10';
  const cycleId = 'cycle-1';
  const goalId = 'goal-1';
  const defaultContainment = containment || {
    activeProfileId: 'profile-local-default',
    profilesById: {
      'profile-local-default': {
        id: 'profile-local-default',
        goalIds: [goalId, 'goal-job', 'goal-income'],
        activeGoalId: goalId,
        masterCalendarId: 'calendar-profile-local-default',
        strategicClusterIds: ['cluster-oct17'],
      },
    },
    goalsById: {
      [goalId]: { id: goalId, title: 'Launch Jericho app', activeCycleId: cycleId },
      'goal-job': { id: 'goal-job', title: 'PM job search', activeCycleId: 'cycle-job' },
      'goal-income': { id: 'goal-income', title: 'Income and runway', activeCycleId: 'cycle-income' },
    },
    masterCalendarsById: {
      'calendar-profile-local-default': {
        id: 'calendar-profile-local-default',
        activeGoalIds: [goalId, 'goal-job', 'goal-income'],
        activeCycleIds: [cycleId, 'cycle-job', 'cycle-income'],
        baseWeeklyCapacityHours: 40,
        availableCapacityHours: 32,
      },
    },
    strategicClustersById: {
      'cluster-oct17': {
        id: 'cluster-oct17',
        label: 'oct17 launch',
        goalIds: [goalId],
        cycleIds: [cycleId],
        sharedAnchorDayKey: '2026-10-17',
      },
    },
    goalRelations: [
      {
        profileId: 'profile-local-default',
        fromGoalId: goalId,
        toGoalId: 'goal-job',
        relationType: 'competes_for_time',
      },
      {
        profileId: 'profile-local-default',
        fromGoalId: goalId,
        toGoalId: 'goal-job',
        relationType: 'independent_strategy',
      },
    ],
    constraintRelations: [
      {
        profileId: 'profile-local-default',
        sourceGoalId: 'goal-income',
        targetGoalId: goalId,
        relationType: 'capital_pressure',
        severity: 'high',
        scope: 'global',
      },
    ],
    frictionEvents: [
      {
        id: 'friction-job',
        profileId: 'profile-local-default',
        goalId: 'goal-job',
        frictionType: 'calendar_burden',
      },
      {
        id: 'friction-app',
        profileId: 'profile-local-default',
        goalId,
        frictionType: 'dependency_blocker',
      },
    ],
    frictionPropagationResults: [
      {
        frictionEventId: 'friction-job',
        profileId: 'profile-local-default',
        calendarImpactGoalIds: [goalId, 'goal-job', 'goal-income'],
        strategicImpactGoalIds: [],
        capacityDeltaHours: -8,
        requiresReallocation: true,
      },
      {
        frictionEventId: 'friction-app',
        profileId: 'profile-local-default',
        calendarImpactGoalIds: [goalId, 'goal-job', 'goal-income'],
        strategicImpactGoalIds: [goalId],
        capacityDeltaHours: -4,
        requiresReallocation: true,
      },
    ],
  };
  const canonicalLivePos =
    livePos ||
    (withFeasibility
      ? {
          state: 'eligible',
          liveState: 'stable',
          liveStateReasonCodes: ['LIVE_POS_STABLE_LINKED_EXECUTION_CONTINUITY'],
          reasonCodes: [],
          score: {
            state: 'available',
            value: 0.78,
            lowerBound: 0.72,
            upperBound: 0.86,
            capped: false,
            evidenceDensity: 'strong',
            reasonCodes: ['LIVE_POS_SCORE_STABLE_CONTINUITY', 'LIVE_POS_SCORE_EVIDENCE_DENSITY_STRONG'],
          },
        }
      : {
          state: 'withheld',
          liveState: 'withheld',
          liveStateReasonCodes: ['LIVE_POS_WITHHELD_UNTIL_EXECUTION_EVIDENCE'],
          reasonCodes: ['LIVE_POS_WITHHELD_UNTIL_EXECUTION_EVIDENCE'],
          score: {
            state: 'withheld',
            value: null,
            lowerBound: null,
            upperBound: null,
            capped: false,
            evidenceDensity: 'unavailable',
            reasonCodes: ['LIVE_POS_SCORE_WITHHELD'],
          },
        });

  return {
    activeProfileId: defaultContainment.activeProfileId,
    profilesById: defaultContainment.profilesById,
    goalsById: defaultContainment.goalsById,
    masterPlansById: masterPlanPolicy
      ? {
          'masterplan-1': {
            id: 'masterplan-1',
            profileId: 'profile-local-default',
            title: 'Operation Endgame',
            northStarOutcome: 'Launch the coordinated ecosystem by Oct 17',
            horizonStart: '2026-05-01',
            horizonEnd: '2026-10-17',
            laneIds: [],
            anchors: [{ id: 'anchor-oct17', label: 'Oct 17', date: '2026-10-17', isFixed: true }],
            policyState: { goalPolicy: masterPlanPolicy },
          },
        }
      : {},
    today: { date: dayKey, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: dayKey, days: [], metrics: {} },
    cycle: [],
    suggestionEvents: [],
    suggestedBlocks: [],
    appTime: { nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, timeZone: 'UTC' },
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: { goalId },
        metrics: withFeasibility
          ? {
              posScore: 0.64,
              feasibilityScore: cycleFeasibilityScore === undefined ? 0.8 : cycleFeasibilityScore,
              integrityScore: 0.7,
            }
          : { posScore: null, feasibilityScore: null, integrityScore: 1 },
        policyState: {
          goalPolicy: {
            intakeReadiness: { state: 'fully_admitted' },
            planQuality: { state: planQualityState },
            posTrust: { state: 'trusted' },
            feasibility:
              feasibilityPolicy ||
              (withFeasibility
                ? {
                    state: 'feasible',
                    percent: 80,
                    score: 0.8,
                    range: [0.73, 0.87],
                    confidence: 'high',
                    substrateLevel: 'trusted_feasibility',
                    summary: 'Structurally credible pre-execution path with enough substrate to state a forecast.',
                    reasonCodes: [],
                    assumptions: [],
                  }
                : {
                    state: 'withheld',
                    percent: null,
                    score: null,
                    range: null,
                    confidence: 'low',
                    substrateLevel: 'withheld',
                    summary: 'Initial feasibility is withheld until the minimum forecast substrate is available.',
                    reasonCodes: ['FEASIBILITY_STRUCTURAL_QUALITY_WEAK'],
                    assumptions: [],
                  }),
            livePos: canonicalLivePos,
          },
        },
      },
    },
    activeCycleId: masterPlanPolicy ? null : cycleId,
    goalExecutionContract: { goalId, startDayKey: '2026-03-01', endDayKey: '2026-04-01' },
    probabilityByGoal: {},
    feasibilityByGoal: {},
    planQualityGateByGoal: planQualityGate ? { [goalId]: planQualityGate } : {},
    systemShotClockByGoal: shotClock
      ? { [goalId]: shotClock }
      : {
          [goalId]: {
            goalId,
            cycleId,
            currentDate: dayKey,
            currentTime: '12:00',
            currentDateTimeISO: `${dayKey}T12:00:00.000Z`,
            timezone: 'UTC',
            contractStartDate: '2026-03-01',
            contractEndDate: '2026-04-01',
            totalHorizonDays: 31,
            elapsedDays: 9,
            remainingDays: 22,
            elapsedRatio: 0.29,
            remainingRatio: 0.71,
            scheduledBlockCount: 4,
            completedBlockCount: 0,
            completionRatio: 0,
            paceState: 'insufficient_evidence',
            timedDeadlines: [],
          },
        },
    constraints: {},
    masterCalendarsById: defaultContainment.masterCalendarsById,
    strategicClustersById: defaultContainment.strategicClustersById,
    goalRelations: defaultContainment.goalRelations,
    constraintRelations: defaultContainment.constraintRelations,
    frictionEvents: defaultContainment.frictionEvents,
    frictionPropagationResults: defaultContainment.frictionPropagationResults,
    profileLearning: {},
    deliverablesByCycleId: {},
    goalAdmissionByGoal: {},
    goalWorkById: {},
    actions: {},
    completeBlock: noop,
    cancelBlock: noop,
    splitBlock: noop,
    setDefiniteGoal: noop,
    setPatternTargets: noop,
    createBlock: noop,
    updateBlock: noop,
    deleteBlock: noop,
    rescheduleBlock: noop,
    setActiveDayKey: noop,
    jumpToToday: noop,
    tickNow: noop,
    setCalibrationDays: noop,
    acceptSuggestedBlock: noop,
    acceptSuggestedBlockWithPlacement: noop,
    rejectSuggestedBlock: noop,
    ignoreSuggestedBlock: noop,
    dismissSuggestedBlock: noop,
    setActiveCycle: noop,
    deleteCycle: noop,
    startNewCycle: noop,
    createDeliverable: noop,
    updateDeliverable: noop,
    deleteDeliverable: noop,
    createCriterion: noop,
    toggleCriterionDone: noop,
    deleteCriterion: noop,
    linkBlockToDeliverable: noop,
    assignSuggestionLink: noop,
    generatePlan: noop,
    generatePlanWithLLM: noop,
    commitPreviewItems: noop,
    applyPlan: noop,
    addFrictionEvent: noop,
  };
}

function buildBlankStabilityStore() {
  const dayKey = '2026-03-10';
  return {
    activeProfileId: 'profile-local-default',
    profilesById: {
      'profile-local-default': {
        id: 'profile-local-default',
        goalIds: [],
        activeGoalId: null,
        masterCalendarId: 'calendar-profile-local-default',
        strategicClusterIds: [],
      },
    },
    goalsById: {},
    masterPlansById: {},
    today: { date: dayKey, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: dayKey, days: [], metrics: {} },
    cycle: [],
    suggestionEvents: [],
    suggestedBlocks: [],
    appTime: { nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, timeZone: 'UTC' },
    cyclesById: {},
    activeCycleId: null,
    goalExecutionContract: null,
    probabilityByGoal: {},
    feasibilityByGoal: {},
    planQualityGateByGoal: {},
    systemShotClockByGoal: {},
    constraints: {},
    masterCalendarsById: {
      'calendar-profile-local-default': {
        id: 'calendar-profile-local-default',
        activeGoalIds: [],
        activeCycleIds: [],
        baseWeeklyCapacityHours: 40,
        availableCapacityHours: 40,
      },
    },
    strategicClustersById: {},
    goalRelations: [],
    constraintRelations: [],
    frictionEvents: [],
    frictionPropagationResults: [],
    profileLearning: { cycleCount: 0 },
    planRecovery: null,
    pendingPlanConfirmation: false,
    scheduleApplied: false,
    coreContinuity: { state: 'absent', activeMissionId: null, linkedMasterPlanIds: [], reasonCodes: [] },
    coreMissionContractsById: {},
    deliverablesByCycleId: {},
    goalAdmissionByGoal: {},
    goalWorkById: {},
    debug: { traceLog: [] },
    lastPlanError: null,
    cycleDynamicsByCycleId: {},
    blockStore: { blocks: {} },
    executionEvents: [],
    proposedBlocks: [],
    actions: {
      completeBlock: noop,
      missBlock: noop,
      skipBlock: noop,
      setDefiniteGoal: noop,
      setPatternTargets: noop,
      createBlock: noop,
      updateBlock: noop,
      deleteBlock: noop,
      rescheduleBlock: noop,
      setActiveDayKey: noop,
      jumpToToday: noop,
      tickNow: noop,
      acceptSuggestedBlock: noop,
      acceptSuggestedBlockWithPlacement: noop,
      rejectSuggestedBlock: noop,
      ignoreSuggestedBlock: noop,
      dismissSuggestedBlock: noop,
      setActiveCycle: noop,
      deleteCycle: noop,
      startNewCycle: noop,
      startNewCycleWithDecision: noop,
      generateScheduleForActiveCycle: noop,
      generatePlanWithLLM: noop,
      createDeliverable: noop,
      updateDeliverable: noop,
      deleteDeliverable: noop,
      createCriterion: noop,
      toggleCriterionDone: noop,
      deleteCriterion: noop,
      linkBlockToDeliverable: noop,
      assignSuggestionLink: noop,
      generatePlan: noop,
      commitPreviewItems: noop,
      applyPlan: noop,
      setPlanResolutionKind: noop,
      activateSchedule: noop,
      applyRenegotiationOption: noop,
      resetIdentity: noop,
      addFrictionEvent: noop,
    },
  };
}

describe('ZionDashboard POS after admit', () => {
  it('renders canonical live P.O.S. when execution evidence has admitted the score', () => {
    mockStore = buildStore({ withFeasibility: true });
    const { container } = render(<ZionDashboard initialView="stability" />);

    const posCard = within(container)
      .getByText(/Probability of Success/i)
      .closest('.rounded-xl');
    expect(posCard).toBeTruthy();
    expect(within(posCard).getByText(/^Live P\.O\.S\.$/i)).toBeInTheDocument();
    expect(within(posCard).getAllByText('78%').length).toBeGreaterThanOrEqual(1);
    expect(within(posCard).getByText(/Status: Available/i)).toBeInTheDocument();
    expect(within(posCard).getByText(/Live state: Stable/i)).toBeInTheDocument();
    expect(within(posCard).getByText('72-86%')).toBeInTheDocument();
    expect(within(posCard).getByText(/Strong evidence/i)).toBeInTheDocument();
    expect(within(posCard).getByText(/Uncapped/i)).toBeInTheDocument();
    expect(within(posCard).getByText(/Policy advisory/i)).toBeInTheDocument();
    expect(within(posCard).getByText(/^P\.O\.S\. trust$/i)).toBeInTheDocument();
    expect(within(posCard).getByText(/^Initial Feasibility$/i)).toBeInTheDocument();
    expect(within(posCard).getByText(/^Feasible$/i)).toBeInTheDocument();
    expect(within(posCard).getAllByText('80%').length).toBeGreaterThanOrEqual(1);
    expect(posCard).toHaveTextContent(/Substrate:\s*trusted feasibility/i);
    expect(posCard).toHaveTextContent(/Range:\s*73-87%\s*·\s*Confidence:\s*High/i);
  });

  it('separates passed plan-quality gate from degraded planning advisory', () => {
    mockStore = buildStore({
      withFeasibility: true,
      planQualityState: 'policy_degraded',
      planQualityGate: {
        status: 'PLAN_QUALITY_PASSED',
        failureCodes: [],
        reasonCodes: [],
      },
    });
    const { container } = render(<ZionDashboard initialView="stability" />);

    const posCard = within(container)
      .getByText(/Probability of Success/i)
      .closest('.rounded-xl');
    expect(posCard).toBeTruthy();
    expect(within(posCard).getByText(/Policy advisory/i)).toBeInTheDocument();
    expect(within(posCard).getByText(/Planning advisory:/i)).toBeInTheDocument();
    expect(
      within(posCard).getByText(/Canonical plan-quality gate passed; advisory signals may still flag pacing/i)
    ).toBeInTheDocument();
    expect(within(posCard).getByText(/Plan-quality diagnostics/i)).toBeInTheDocument();
    expect(within(posCard).getByText(/PLAN QUALITY PASSED/i)).toBeInTheDocument();
  });

  it('renders Live P.O.S. withheld intentionally when canonical evidence is absent', () => {
    mockStore = buildStore({ withFeasibility: false });
    const { container } = render(<ZionDashboard initialView="stability" />);

    const posCard = within(container)
      .getByText(/Probability of Success/i)
      .closest('.rounded-xl');
    expect(posCard).toBeTruthy();
    expect(posCard).toHaveTextContent(/^Probability of Success[\s\S]*Live P\.O\.S\.[\s\S]*Withheld/i);
    expect(within(posCard).getByText(/Status: Withheld/i)).toBeInTheDocument();
    expect(within(posCard).getByText(/No linked execution evidence exists yet\./i)).toBeInTheDocument();
    expect(within(posCard).getByText(/^Initial Feasibility$/i)).toBeInTheDocument();
    expect(posCard).toHaveTextContent(/Score:\s*No score awarded/i);
    expect(posCard).toHaveTextContent(/Substrate:\s*withheld/i);
  });

  it('surfaces one-profile master-calendar containment and friction propagation in Stability', () => {
    mockStore = buildStore({ withFeasibility: true });
    const { container } = render(<ZionDashboard initialView="stability" />);

    const containmentCard = within(container)
      .getByText(/Profile Containment/i)
      .closest('.rounded-md');
    expect(containmentCard).toBeTruthy();
    expect(within(containmentCard).getByText(/^profile-local-default$/i)).toBeInTheDocument();
    expect(within(containmentCard).getByText(/^calendar-profile-local-default$/i)).toBeInTheDocument();
    expect(within(containmentCard).getByText(/Integrated strategic clusters/i)).toBeInTheDocument();
    expect(within(containmentCard).getByText(/Oct17 Launch/i)).toBeInTheDocument();
    expect(within(containmentCard).getByText(/Independent strategies on the master calendar/i)).toBeInTheDocument();
    expect(within(containmentCard).getByText(/PM job search · Income and runway/i)).toBeInTheDocument();
    expect(within(containmentCard).getByText(/Global constraints/i)).toBeInTheDocument();
    expect(within(containmentCard).getByText(/Income and runway · Capital Pressure · High/i)).toBeInTheDocument();
    expect(within(containmentCard).getByText(/PM job search: Calendar Burden · -8h · calendar impact only/i)).toBeInTheDocument();
    expect(
      within(containmentCard).getByText(
        /Launch Jericho app: Dependency Blocker · -4h · strategic impact: Launch Jericho app · correction required/i
      )
    ).toBeInTheDocument();
  });

  it('shows a true blank Stability state when no goal or cycle is active', () => {
    mockStore = buildBlankStabilityStore();
    const { container } = render(<ZionDashboard initialView="stability" />);

    const posCard = within(container)
      .getByText(/Probability of Success/i)
      .closest('.rounded-xl');
    expect(posCard).toBeTruthy();
    expect(within(posCard).getByText(/^Live P\.O\.S\.$/i)).toBeInTheDocument();
    expect(posCard).toHaveTextContent(/Initial Feasibility/i);
    expect(posCard).toHaveTextContent(/Pending goal admission\./i);
    expect(posCard).toHaveTextContent(/Requires admitted goal and execution evidence\./i);
    expect(posCard).not.toHaveTextContent(/\b50%\b/);

    const stabilityCard = within(container)
      .getByText(/^Stability Score$/i)
      .closest('.rounded-xl');
    expect(stabilityCard).toBeTruthy();
    expect(stabilityCard).toHaveTextContent(/No active execution cycle\./i);
    expect(stabilityCard).toHaveTextContent(/Momentum[\s\S]*—/i);
    expect(stabilityCard).not.toHaveTextContent(/\b50%\b/);

    const containmentCard = within(container)
      .getByText(/Profile Containment/i)
      .closest('.rounded-md');
    expect(containmentCard).toBeTruthy();
    expect(containmentCard).toHaveTextContent(/Active goals\s*0/i);
    expect(containmentCard).toHaveTextContent(/Active cycles\s*0/i);
    expect(within(containmentCard).getByText(/Start an execution cycle before recording cycle friction\./i)).toBeInTheDocument();
    expect(screen.getByText(/^Record friction event$/i)).toBeInTheDocument();
  });

  it('keeps the Today calendar accessible in blank state without rerouting to Structure', () => {
    mockStore = buildBlankStabilityStore();
    render(<ZionDashboard initialView="today" initialZionView="day" />);

    expect(screen.getByText(/Add block/i)).toBeInTheDocument();
    expect(screen.getByText(/What moved today/i)).toBeInTheDocument();
    expect(screen.getByText(/Day details/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Structure/i })).not.toBeInTheDocument();
  });

  it('explains that Today only shows committed execution work while future roadmap stays in Plan', () => {
    mockStore = buildStore({
      withFeasibility: true,
      masterPlanPolicy: {
        intakeReadiness: { state: 'fully_admitted' },
        planQuality: { state: 'policy_clean' },
        posTrust: { state: 'provisional' },
        feasibility: {
          state: 'constrained',
          percent: 61,
          score: 0.61,
          range: [0.5, 0.72],
          confidence: 'moderate',
          substrateLevel: 'rough_feasibility',
          summary: 'Possible but dependent on a capital bridge, market conversion.',
          reasonCodes: ['FEASIBILITY_ASSUMPTION_BURDEN_HIGH'],
          assumptions: ['a capital bridge', 'market conversion'],
        },
      },
    });
    mockStore.profilesById['profile-local-default'].activeMasterPlanId = 'masterplan-1';
    render(<ZionDashboard initialView="today" initialZionView="day" />);

    expect(screen.getAllByText(/First execution cycle schedule/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Today shows committed execution work\. Future roadmap and forecast work remain visible in Plan\./i)
    ).toBeInTheDocument();
    expect(screen.getByText(/^Active Phase$/i)).toBeInTheDocument();
    expect(screen.getByText(/P1 · Foundation \/ Launch Proof/i)).toBeInTheDocument();
    expect(screen.getByText(/Next unlock:/i)).toBeInTheDocument();
  });

  it('submits user-reported friction events from Stability without changing schedule automatically', () => {
    const addFrictionEvent = vi.fn();
    mockStore = buildStore({ withFeasibility: true });
    mockStore.addFrictionEvent = addFrictionEvent;
    const { container } = render(<ZionDashboard initialView="stability" />);

    const containmentCard = within(container)
      .getByText(/Profile Containment/i)
      .closest('.rounded-md');
    expect(containmentCard).toBeTruthy();

    fireEvent.change(within(containmentCard).getByLabelText(/Friction source goal/i), {
      target: { value: 'goal-job' },
    });
    fireEvent.change(within(containmentCard).getByLabelText(/Friction event type/i), {
      target: { value: 'capacity_loss' },
    });
    fireEvent.change(within(containmentCard).getByLabelText(/Friction calendar impact hours/i), {
      target: { value: '6' },
    });
    fireEvent.change(within(containmentCard).getByLabelText(/Friction note/i), {
      target: { value: 'Interview loop consumed the week.' },
    });
    fireEvent.click(within(containmentCard).getByRole('button', { name: /Record friction/i }));

    expect(addFrictionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'profile-local-default',
        goalId: 'goal-job',
        cycleId: 'cycle-job',
        eventType: 'capacity_loss',
        severity: 'moderate',
        calendarImpactHours: 6,
        source: 'user_reported',
        note: 'Interview loop consumed the week.',
      })
    );
  });

  it('keeps live P.O.S. separate from feasibility when only the forecast exists', () => {
    mockStore = buildStore({
      withFeasibility: true,
      livePos: {
        state: 'withheld',
        liveState: 'withheld',
        liveStateReasonCodes: ['LIVE_POS_WITHHELD_UNTIL_EXECUTION_EVIDENCE'],
        reasonCodes: ['LIVE_POS_WITHHELD_UNTIL_EXECUTION_EVIDENCE'],
        score: {
          state: 'withheld',
          value: null,
          lowerBound: null,
          upperBound: null,
          capped: false,
          evidenceDensity: 'unavailable',
          reasonCodes: ['LIVE_POS_SCORE_WITHHELD'],
        },
      },
    });
    const { container } = render(<ZionDashboard initialView="stability" />);

    const posCard = within(container)
      .getByText(/Probability of Success/i)
      .closest('.rounded-xl');
    expect(posCard).toBeTruthy();
    expect(within(posCard).getByText(/^Withheld$/i)).toBeInTheDocument();
    expect(within(posCard).getByText(/^Initial Feasibility$/i)).toBeInTheDocument();
    expect(within(posCard).getAllByText('80%').length).toBeGreaterThanOrEqual(1);
    expect(posCard).toHaveTextContent(/Range:\s*73-87%\s*·\s*Confidence:\s*High/i);
    expect(
      within(posCard).getByText(
        /Pre-execution forecast only\. Live P\.O\.S\. remains separate and stays withheld until execution evidence exists\./i
      )
    ).toBeInTheDocument();
    expect(within(posCard).getByText(/Trust does not substitute for live execution evidence\./i)).toBeInTheDocument();
  });

  it('renders withheld initial feasibility reasons from canonical policy state', () => {
    mockStore = buildStore({
      withFeasibility: false,
      feasibilityPolicy: {
        state: 'withheld',
        percent: null,
        score: null,
        range: null,
        confidence: 'low',
        substrateLevel: 'withheld',
        summary: 'Initial feasibility is withheld until the minimum forecast substrate is available.',
        reasonCodes: ['FEASIBILITY_TEMPORAL_QUALITY_WEAK', 'FEASIBILITY_STRUCTURAL_QUALITY_WEAK'],
        assumptions: [],
      },
    });
    const { container } = render(<ZionDashboard initialView="stability" />);

    const posCard = within(container)
      .getByText(/Probability of Success/i)
      .closest('.rounded-xl');
    expect(posCard).toBeTruthy();
    expect(within(posCard).getByText(/^Initial Feasibility$/i)).toBeInTheDocument();
    expect(within(posCard).getByText(/temporal quality weak/i)).toBeInTheDocument();
    expect(within(posCard).getByText(/structural quality weak/i)).toBeInTheDocument();
  });

  it('falls back to active master-plan policy when no active execution cycle exists', () => {
    mockStore = buildStore({
      masterPlanPolicy: {
        intakeReadiness: { state: 'fully_admitted' },
        planQuality: { state: 'policy_clean' },
        posTrust: { state: 'provisional' },
        feasibility: {
          state: 'constrained',
          percent: 61,
          score: 0.61,
          range: [0.5, 0.72],
          confidence: 'moderate',
          substrateLevel: 'rough_feasibility',
          summary: 'Possible but dependent on a capital bridge, market conversion.',
          reasonCodes: ['FEASIBILITY_ASSUMPTION_BURDEN_HIGH'],
          assumptions: ['a capital bridge', 'market conversion'],
        },
        livePos: {
          state: 'withheld',
          liveState: 'withheld',
          liveStateReasonCodes: ['LIVE_POS_WITHHELD_SCHEDULE_NOT_LIVE'],
          reasonCodes: ['LIVE_POS_WITHHELD_SCHEDULE_NOT_LIVE'],
          score: {
            state: 'withheld',
            value: null,
            lowerBound: null,
            upperBound: null,
            capped: false,
            evidenceDensity: 'unavailable',
            reasonCodes: ['LIVE_POS_SCORE_WITHHELD'],
          },
        },
      },
    });
    mockStore.profilesById['profile-local-default'].activeMasterPlanId = 'masterplan-1';

    const { container } = render(<ZionDashboard initialView="stability" />);
    fireEvent.click(screen.getByRole('button', { name: /Stability/i }));
    const posCard = within(container)
      .getByText(/Probability of Success/i)
      .closest('.rounded-xl');

    expect(posCard).toBeTruthy();
    expect(within(posCard).getByText(/^Initial Feasibility$/i)).toBeInTheDocument();
    expect(within(posCard).getByText('61%')).toBeInTheDocument();
    expect(within(posCard).getByText(/^Constrained$/i)).toBeInTheDocument();
    expect(posCard).toHaveTextContent(/Substrate:\s*rough feasibility/i);
    expect(posCard).toHaveTextContent(/Range:\s*50-72%\s*·\s*Confidence:\s*Moderate/i);
    expect(posCard).toHaveTextContent(/capital bridge/i);
    expect(within(posCard).getByText(/^Withheld$/i)).toBeInTheDocument();
    expect(within(posCard).getByText(/^Status Report$/i)).toBeInTheDocument();
    expect(within(posCard).getByText(/P1 · Foundation \/ Launch Proof/i)).toBeInTheDocument();
    expect(within(posCard).getByText(/Next unlock readiness:/i)).toBeInTheDocument();
  });

  it('starts the first execution cycle directly from Structure when no active cycle exists', () => {
    const startNewCycleWithDecision = vi.fn();
    mockStore = buildStore({
      masterPlanPolicy: {
        intakeReadiness: { state: 'fully_admitted' },
        planQuality: { state: 'policy_clean' },
        posTrust: { state: 'provisional' },
        feasibility: {
          state: 'constrained',
          percent: 61,
          score: 0.61,
          range: [0.5, 0.72],
          confidence: 'moderate',
          substrateLevel: 'rough_feasibility',
          summary: 'Possible but dependent on a capital bridge, market conversion.',
          reasonCodes: ['FEASIBILITY_ASSUMPTION_BURDEN_HIGH'],
          assumptions: ['a capital bridge', 'market conversion'],
        },
      },
    });
    mockStore.profilesById['profile-local-default'].activeMasterPlanId = 'masterplan-1';
    mockStore.startNewCycleWithDecision = startNewCycleWithDecision;

    render(<ZionDashboard initialView="structure" />);

    const executionCycleSection = screen.getByText(/^Execution Cycle$/i).closest('details');
    expect(executionCycleSection).toBeTruthy();

    fireEvent.click(within(executionCycleSection).getByRole('button', { name: /Start Execution Cycle/i }));

    expect(startNewCycleWithDecision).toHaveBeenCalledWith({ mode: 'archive' });
    expect(screen.queryByRole('dialog', { name: /Replace active execution cycle/i })).not.toBeInTheDocument();
  });

  it('prefers canonical initial-feasibility percent over the legacy cycle metric fallback', () => {
    mockStore = buildStore({
      withFeasibility: true,
      cycleFeasibilityScore: null,
      feasibilityPolicy: {
        state: 'constrained',
        percent: 23,
        score: 0.23,
        range: [0.15, 0.32],
        confidence: 'low',
        substrateLevel: 'rough_feasibility',
        summary:
          'Possible but dependent on a capital bridge, regulated sourcing and compliance-safe claims, first-sales conversion.',
        reasonCodes: ['FEASIBILITY_SCHEDULE_STRAINED'],
        assumptions: ['a capital bridge', 'regulated sourcing and compliance-safe claims', 'first-sales conversion'],
      },
    });
    const { container } = render(<ZionDashboard initialView="stability" />);

    const posCard = within(container)
      .getByText(/Probability of Success/i)
      .closest('.rounded-xl');
    expect(posCard).toBeTruthy();
    expect(within(posCard).getByText('23%')).toBeInTheDocument();
    expect(within(posCard).getByText(/^Constrained$/i)).toBeInTheDocument();
    expect(posCard).toHaveTextContent(/Range:\s*15-32%\s*·\s*Confidence:\s*Low/i);
    expect(posCard).toHaveTextContent(/capital bridge/i);
    expect(posCard).not.toHaveTextContent(/Score:\s*No score awarded/i);
  });

  it('renders the system shot clock with current date, deadline, remaining days, and pace', () => {
    mockStore = buildStore({
      shotClock: {
        goalId: 'goal-1',
        cycleId: 'cycle-1',
        currentDate: '2026-05-01',
        currentTime: '16:55',
        currentDateTimeISO: '2026-05-01T16:55:00.000Z',
        timezone: 'UTC',
        contractStartDate: '2026-04-21',
        contractEndDate: '2027-07-30',
        totalHorizonDays: 465,
        elapsedDays: 10,
        remainingDays: 455,
        elapsedRatio: 0.02,
        remainingRatio: 0.98,
        scheduledBlockCount: 12,
        completedBlockCount: 0,
        completionRatio: 0,
        paceState: 'insufficient_evidence',
        timedDeadlines: [],
      },
    });
    const { container } = render(<ZionDashboard initialView="stability" />);

    const posCard = within(container)
      .getByText(/Probability of Success/i)
      .closest('.rounded-xl');
    expect(posCard).toBeTruthy();
    expect(within(posCard).getByText(/^System Shot Clock$/i)).toBeInTheDocument();
    expect(posCard).toHaveTextContent(/Today:\s*May 1, 2026\s*·\s*4:55 PM/i);
    expect(posCard).toHaveTextContent(/Deadline:\s*July 30, 2027/i);
    expect(posCard).toHaveTextContent(/Remaining:\s*455 days/i);
    expect(posCard).toHaveTextContent(/Horizon elapsed:\s*2%\s*·\s*Work complete:\s*0%/i);
    expect(posCard).toHaveTextContent(/Pace:\s*insufficient evidence/i);
  });

  it('renders timed action deadlines with deadline time and state', () => {
    mockStore = buildStore({
      shotClock: {
        goalId: 'goal-1',
        cycleId: 'cycle-1',
        currentDate: '2026-05-01',
        currentTime: '15:50',
        currentDateTimeISO: '2026-05-01T15:50:00.000Z',
        timezone: 'UTC',
        contractStartDate: '2026-04-21',
        contractEndDate: '2027-07-30',
        totalHorizonDays: 465,
        elapsedDays: 10,
        remainingDays: 455,
        elapsedRatio: 0.02,
        remainingRatio: 0.98,
        scheduledBlockCount: 12,
        completedBlockCount: 1,
        completionRatio: 0.08,
        paceState: 'behind',
        timedDeadlines: [
          {
            blockId: 'blk-1',
            goalId: 'goal-1',
            cycleId: 'cycle-1',
            dateISO: '2026-05-01',
            deadlineTime: '16:00',
            deadlineDateTime: '2026-05-01T16:00:00.000Z',
            deadlineLabel: 'Submit application',
            minutesRemaining: 10,
            deadlineState: 'due_now',
          },
          {
            blockId: 'blk-2',
            goalId: 'goal-1',
            cycleId: 'cycle-1',
            dateISO: '2026-05-01',
            deadlineTime: '11:59',
            deadlineDateTime: '2026-05-01T11:59:00.000Z',
            deadlineLabel: 'File voucher',
            minutesRemaining: -231,
            deadlineState: 'missed_candidate',
          },
        ],
      },
    });
    const { container } = render(<ZionDashboard initialView="stability" />);

    const posCard = within(container)
      .getByText(/Probability of Success/i)
      .closest('.rounded-xl');
    expect(posCard).toBeTruthy();
    expect(within(posCard).getByText(/^Timed Deadlines$/i)).toBeInTheDocument();
    expect(posCard).toHaveTextContent(/Submit application:\s*due by 4:00 PM\s*·\s*due now/i);
    expect(posCard).toHaveTextContent(/File voucher:\s*due by 11:59 AM\s*·\s*missed candidate/i);
  });
});
