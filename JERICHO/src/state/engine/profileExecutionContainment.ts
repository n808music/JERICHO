export type GoalPlanningTierRelation =
  | 'integrated_strategy'
  | 'independent_strategy'
  | 'supports'
  | 'competes_for_time'
  | 'shares_anchor'
  | 'shares_resource_pressure';

export type ConstraintRelationType =
  | 'calendar_capacity'
  | 'capital_pressure'
  | 'attention_pressure'
  | 'anchor_pressure';

export type FrictionType =
  | 'calendar_burden'
  | 'capital_shortfall'
  | 'attention_fragmentation'
  | 'dependency_blocker'
  | 'external_blocker';

export type FrictionEventType =
  | 'missed_work'
  | 'external_rejection'
  | 'unexpected_cost'
  | 'dependency_delay'
  | 'capacity_loss'
  | 'scope_growth'
  | 'quality_failure'
  | 'income_pressure';

export interface UserExecutionProfile {
  id: string;
  label: string;
  status: string;
  goalIds: string[];
  activeGoalId: string | null;
  masterCalendarId: string;
  strategicClusterIds: string[];
}

export interface MasterCalendar {
  id: string;
  profileId: string;
  activeGoalIds: string[];
  activeCycleIds: string[];
  baseWeeklyCapacityHours: number;
  capacityLoadHours: number;
  availableCapacityHours: number;
}

export interface StrategicCluster {
  id: string;
  profileId: string;
  masterCalendarId: string;
  label: string;
  goalIds: string[];
  cycleIds: string[];
  clusterType: 'integrated_strategy';
  sharedAnchorDayKey: string | null;
}

export interface GoalRelation {
  id: string;
  profileId: string;
  fromGoalId: string;
  toGoalId: string;
  relationType: GoalPlanningTierRelation;
}

export interface ConstraintRelation {
  id: string;
  profileId: string;
  sourceGoalId: string;
  targetGoalId: string;
  relationType: ConstraintRelationType;
  severity: 'low' | 'moderate' | 'high';
  scope: 'global' | 'strategic_cluster' | 'pairwise';
}

export interface FrictionEvent {
  id: string;
  profileId: string;
  goalId: string;
  cycleId?: string | null;
  blockId?: string | null;
  eventType: FrictionEventType;
  frictionType: FrictionType;
  severity: 'low' | 'moderate' | 'high';
  source: 'simulated' | 'user_reported' | 'derived';
  burdenHours?: number | null;
  startDateISO?: string | null;
  endDateISO?: string | null;
  note?: string;
}

export interface FrictionPropagationResult {
  frictionEventId: string;
  profileId: string;
  affectedClusterIds: string[];
  calendarImpactGoalIds: string[];
  strategicImpactGoalIds: string[];
  capacityDeltaHours: number;
  requiresReallocation: boolean;
}

function uniqueStrings(values: Array<string | null | undefined> = []): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function normalizeSeverity(value: any): FrictionEvent['severity'] {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'high') {
    return 'high';
  }
  if (raw === 'low') {
    return 'low';
  }
  return 'moderate';
}

function normalizeEventType(value: any): FrictionEventType | null {
  const raw = String(value || '').trim().toLowerCase();
  switch (raw) {
    case 'missed_work':
    case 'external_rejection':
    case 'unexpected_cost':
    case 'dependency_delay':
    case 'capacity_loss':
    case 'scope_growth':
    case 'quality_failure':
    case 'income_pressure':
      return raw;
    default:
      return null;
  }
}

export function mapEventTypeToFrictionType(eventType: FrictionEventType): FrictionType {
  switch (eventType) {
    case 'missed_work':
    case 'capacity_loss':
      return 'calendar_burden';
    case 'unexpected_cost':
    case 'income_pressure':
      return 'capital_shortfall';
    case 'dependency_delay':
      return 'dependency_blocker';
    case 'scope_growth':
      return 'attention_fragmentation';
    case 'external_rejection':
    case 'quality_failure':
      return 'external_blocker';
    default:
      return 'calendar_burden';
  }
}

export function buildFrictionEvent(payload: Record<string, any>) {
  const profileId = String(payload?.profileId || '').trim();
  const goalId = String(payload?.goalId || '').trim();
  const eventType = normalizeEventType(payload?.eventType);
  if (!profileId || !goalId || !eventType) {
    return null;
  }
  const cycleId = payload?.cycleId ? String(payload.cycleId).trim() || null : null;
  const blockId = payload?.blockId ? String(payload.blockId).trim() || null : null;
  const startDateISO = payload?.startDateISO ? String(payload.startDateISO).slice(0, 10) : null;
  const endDateISO = payload?.endDateISO ? String(payload.endDateISO).slice(0, 10) : null;
  const burdenHours = Number.isFinite(Number(payload?.burdenHours ?? payload?.calendarImpactHours))
    ? Math.max(0, Number(payload?.burdenHours ?? payload?.calendarImpactHours))
    : 0;
  const source = payload?.source === 'simulated' ? 'simulated' : payload?.source === 'derived' ? 'derived' : 'user_reported';
  const note = String(payload?.note || '').trim() || null;
  return {
    id:
      payload?.id ||
      [
        'friction',
        profileId,
        goalId,
        cycleId || 'cycle',
        blockId || 'block',
        eventType,
        startDateISO || 'date',
      ].join(':'),
    profileId,
    goalId,
    cycleId,
    blockId,
    eventType,
    frictionType: mapEventTypeToFrictionType(eventType),
    severity: normalizeSeverity(payload?.severity),
    source,
    burdenHours,
    startDateISO,
    endDateISO,
    note,
  } as FrictionEvent;
}

export function appendFrictionEvent(state: Record<string, any>, event: FrictionEvent) {
  if (!state || !event?.id) {
    return;
  }
  state.frictionEvents = Array.isArray(state.frictionEvents) ? state.frictionEvents : [];
  if (state.frictionEvents.some((candidate: any) => candidate?.id === event.id)) {
    return;
  }
  state.frictionEvents.push(event);
}

export function buildMasterCalendarId(profileId: string) {
  return `calendar-${String(profileId || 'profile-local-default').trim() || 'profile-local-default'}`;
}

function buildClusterId(profileId: string, clusterKey: string) {
  return `cluster-${profileId}-${clusterKey}`;
}

function buildRelationId(prefix: string, profileId: string, fromGoalId: string, toGoalId: string, relationType: string) {
  return `${prefix}-${profileId}-${fromGoalId}-${toGoalId}-${relationType}`;
}

function isActiveGoal(goalRecord: Record<string, any> | null | undefined) {
  const status = String(goalRecord?.status || 'active').trim().toLowerCase();
  return !['archived', 'completed', 'abandoned', 'reset'].includes(status);
}

function getGoalText(goalRecord: Record<string, any> | null | undefined, state: Record<string, any>) {
  const goalId = String(goalRecord?.id || '').trim();
  const cycleId = String(goalRecord?.activeCycleId || '').trim();
  const cycle = cycleId ? state?.cyclesById?.[cycleId] || null : null;
  return String(
    goalRecord?.title ||
      cycle?.goalContract?.goalText ||
      cycle?.goalContract?.goalLabel ||
      cycle?.goalGovernanceContract?.goalText ||
      ''
  ).trim();
}

function inferClusterKey(goalRecord: Record<string, any> | null | undefined, state: Record<string, any>) {
  const explicit =
    goalRecord?.strategicClusterKey ||
    goalRecord?.clusterHint ||
    goalRecord?.strategyClusterKey ||
    goalRecord?.integrationKey ||
    null;
  if (explicit) {
    return String(explicit).trim() || null;
  }
  const text = getGoalText(goalRecord, state).toLowerCase();
  if (!text) {
    return null;
  }
  const launchSignals = ['album', 'app', 'podcast', 'oct 17', 'launch campaign', 'drop'];
  const launchMatches = launchSignals.filter((signal) => text.includes(signal)).length;
  return launchMatches >= 2 ? 'launch-oct17' : null;
}

function inferAnchorDayKey(goalRecord: Record<string, any> | null | undefined, state: Record<string, any>) {
  return (
    goalRecord?.sharedAnchorDayKey ||
    goalRecord?.anchorDayKey ||
    state?.cyclesById?.[goalRecord?.activeCycleId || '']?.goalContract?.endDayKey ||
    state?.cyclesById?.[goalRecord?.activeCycleId || '']?.goalContract?.deadlineISO ||
    null
  );
}

function hasSupportRelation(sourceGoal: Record<string, any> | null | undefined, targetGoalId: string) {
  const values = uniqueStrings(
    ([] as Array<string | null | undefined>).concat(
      sourceGoal?.supportsGoalIds || [],
      sourceGoal?.supportGoalIds || [],
      sourceGoal?.relatedGoalIds || []
    )
  );
  return values.includes(String(targetGoalId || '').trim());
}

function inferGlobalConstraintRole(goalRecord: Record<string, any> | null | undefined, state: Record<string, any>) {
  const explicit = String(goalRecord?.globalConstraintRole || '').trim().toLowerCase();
  if (explicit) {
    return explicit;
  }
  const text = getGoalText(goalRecord, state).toLowerCase();
  if (text.includes('income') || text.includes('runway')) {
    return 'income_runway';
  }
  return null;
}

export function deriveProfileExecutionContainment(state: Record<string, any>) {
  if (!state || typeof state !== 'object') {
    return state;
  }

  state.masterCalendarsById =
    state?.masterCalendarsById && typeof state.masterCalendarsById === 'object' && !Array.isArray(state.masterCalendarsById)
      ? state.masterCalendarsById
      : {};
  state.strategicClustersById =
    state?.strategicClustersById && typeof state.strategicClustersById === 'object' && !Array.isArray(state.strategicClustersById)
      ? state.strategicClustersById
      : {};
  state.goalRelations = Array.isArray(state?.goalRelations) ? state.goalRelations : [];
  state.constraintRelations = Array.isArray(state?.constraintRelations) ? state.constraintRelations : [];
  state.frictionEvents = Array.isArray(state?.frictionEvents) ? state.frictionEvents : [];
  state.frictionPropagationResults = Array.isArray(state?.frictionPropagationResults)
    ? state.frictionPropagationResults
    : [];

  const calendarsById: Record<string, MasterCalendar> = {};
  const clustersById: Record<string, StrategicCluster> = {};
  const goalRelations: GoalRelation[] = [];
  const constraintRelations: ConstraintRelation[] = [];

  Object.values(state.profilesById || {}).forEach((profileRecord: any) => {
    if (!profileRecord?.id) {
      return;
    }
    const profileId = String(profileRecord.id);
    const masterCalendarId = String(profileRecord.masterCalendarId || buildMasterCalendarId(profileId));
    profileRecord.masterCalendarId = masterCalendarId;
    profileRecord.strategicClusterIds = [];

    const activeGoals = uniqueStrings(profileRecord.goalIds || [])
      .map((goalId) => state.goalsById?.[goalId] || null)
      .filter((goalRecord: any) => goalRecord?.id && isActiveGoal(goalRecord));

    const activeGoalIds = activeGoals.map((goalRecord: any) => String(goalRecord.id));
    const activeCycleIds = uniqueStrings(activeGoals.map((goalRecord: any) => goalRecord?.activeCycleId || null));
    const baseWeeklyCapacityHours = Number(profileRecord?.executionCapacityHoursPerWeek || 40);

    calendarsById[masterCalendarId] = {
      id: masterCalendarId,
      profileId,
      activeGoalIds,
      activeCycleIds,
      baseWeeklyCapacityHours,
      capacityLoadHours: 0,
      availableCapacityHours: baseWeeklyCapacityHours,
    };

    activeGoals.forEach((goalRecord: any) => {
      goalRecord.profileId = goalRecord.profileId || profileId;
      goalRecord.masterCalendarId = masterCalendarId;
      const cycleId = String(goalRecord?.activeCycleId || '').trim();
      if (cycleId && state?.cyclesById?.[cycleId]) {
        state.cyclesById[cycleId].profileId = state.cyclesById[cycleId].profileId || profileId;
        state.cyclesById[cycleId].masterCalendarId = masterCalendarId;
      }
    });

    const clusterGroups = new Map<string, any[]>();
    activeGoals.forEach((goalRecord: any) => {
      const clusterKey = inferClusterKey(goalRecord, state);
      if (!clusterKey) {
        return;
      }
      const group = clusterGroups.get(clusterKey) || [];
      group.push(goalRecord);
      clusterGroups.set(clusterKey, group);
    });

    clusterGroups.forEach((goals, clusterKey) => {
      if (!Array.isArray(goals) || goals.length < 2) {
        return;
      }
      const clusterId = buildClusterId(profileId, clusterKey);
      const sharedAnchorDayKey = inferAnchorDayKey(goals[0], state);
      clustersById[clusterId] = {
        id: clusterId,
        profileId,
        masterCalendarId,
        label: String(clusterKey).replace(/[_-]/g, ' '),
        goalIds: uniqueStrings(goals.map((goalRecord: any) => goalRecord?.id || null)),
        cycleIds: uniqueStrings(goals.map((goalRecord: any) => goalRecord?.activeCycleId || null)),
        clusterType: 'integrated_strategy',
        sharedAnchorDayKey: sharedAnchorDayKey ? String(sharedAnchorDayKey).slice(0, 10) : null,
      };
      profileRecord.strategicClusterIds.push(clusterId);
    });

    for (let i = 0; i < activeGoals.length; i += 1) {
      for (let j = i + 1; j < activeGoals.length; j += 1) {
        const fromGoal = activeGoals[i];
        const toGoal = activeGoals[j];
        const fromGoalId = String(fromGoal.id);
        const toGoalId = String(toGoal.id);
        const fromCluster = inferClusterKey(fromGoal, state);
        const toCluster = inferClusterKey(toGoal, state);
        const sameCluster = Boolean(fromCluster && toCluster && fromCluster === toCluster);

        goalRelations.push({
          id: buildRelationId('goalrel', profileId, fromGoalId, toGoalId, 'competes_for_time'),
          profileId,
          fromGoalId,
          toGoalId,
          relationType: 'competes_for_time',
        });

        if (sameCluster) {
          goalRelations.push({
            id: buildRelationId('goalrel', profileId, fromGoalId, toGoalId, 'integrated_strategy'),
            profileId,
            fromGoalId,
            toGoalId,
            relationType: 'integrated_strategy',
          });
          goalRelations.push({
            id: buildRelationId('goalrel', profileId, fromGoalId, toGoalId, 'shares_anchor'),
            profileId,
            fromGoalId,
            toGoalId,
            relationType: 'shares_anchor',
          });
        } else if (hasSupportRelation(fromGoal, toGoalId) || hasSupportRelation(toGoal, fromGoalId)) {
          goalRelations.push({
            id: buildRelationId('goalrel', profileId, fromGoalId, toGoalId, 'supports'),
            profileId,
            fromGoalId,
            toGoalId,
            relationType: 'supports',
          });
        } else {
          goalRelations.push({
            id: buildRelationId('goalrel', profileId, fromGoalId, toGoalId, 'independent_strategy'),
            profileId,
            fromGoalId,
            toGoalId,
            relationType: 'independent_strategy',
          });
        }

        constraintRelations.push({
          id: buildRelationId('constraint', profileId, fromGoalId, toGoalId, 'calendar_capacity'),
          profileId,
          sourceGoalId: fromGoalId,
          targetGoalId: toGoalId,
          relationType: 'calendar_capacity',
          severity: 'moderate',
          scope: 'pairwise',
        });
      }
    }

    const globalConstraintGoalIds = activeGoals
      .filter((goalRecord: any) => inferGlobalConstraintRole(goalRecord, state) === 'income_runway')
      .map((goalRecord: any) => String(goalRecord.id));

    globalConstraintGoalIds.forEach((sourceGoalId) => {
      activeGoalIds
        .filter((targetGoalId) => targetGoalId !== sourceGoalId)
        .forEach((targetGoalId) => {
          constraintRelations.push({
            id: buildRelationId('constraint', profileId, sourceGoalId, targetGoalId, 'capital_pressure'),
            profileId,
            sourceGoalId,
            targetGoalId,
            relationType: 'capital_pressure',
            severity: 'high',
            scope: 'global',
          });
        });
    });
  });

  const frictionResults: FrictionPropagationResult[] = [];
  (state.frictionEvents || []).forEach((event: any) => {
    if (!event?.id || !event?.profileId || !calendarsById[event.profileId ? buildMasterCalendarId(event.profileId) : '']) {
      return;
    }
    const profileId = String(event.profileId);
    const masterCalendarId = buildMasterCalendarId(profileId);
    const masterCalendar = calendarsById[masterCalendarId];
    if (!masterCalendar) {
      return;
    }
    const goalId = String(event.goalId || '').trim();
    const affectedClusterIds = Object.values(clustersById)
      .filter((cluster) => cluster.profileId === profileId && cluster.goalIds.includes(goalId))
      .map((cluster) => cluster.id);
    const strategicImpactGoalIds = uniqueStrings(
      affectedClusterIds.flatMap((clusterId) => clustersById[clusterId]?.goalIds || [])
    );
    const calendarImpactGoalIds = uniqueStrings(masterCalendar.activeGoalIds);
    const capacityDeltaHours =
      event.frictionType === 'calendar_burden'
        ? -Math.abs(Number(event.burdenHours || 0))
        : event.frictionType === 'dependency_blocker'
          ? -4
          : 0;
    masterCalendar.capacityLoadHours += Math.abs(capacityDeltaHours);
    masterCalendar.availableCapacityHours = Math.max(
      0,
      Number(masterCalendar.baseWeeklyCapacityHours || 0) - Number(masterCalendar.capacityLoadHours || 0)
    );
    frictionResults.push({
      frictionEventId: String(event.id),
      profileId,
      affectedClusterIds,
      calendarImpactGoalIds,
      strategicImpactGoalIds,
      capacityDeltaHours,
      requiresReallocation:
        event.frictionType === 'calendar_burden' ||
        event.frictionType === 'dependency_blocker' ||
        event.frictionType === 'capital_shortfall',
    });
  });

  state.masterCalendarsById = calendarsById;
  state.strategicClustersById = clustersById;
  state.goalRelations = goalRelations;
  state.constraintRelations = constraintRelations;
  state.frictionPropagationResults = frictionResults;

  return state;
}
