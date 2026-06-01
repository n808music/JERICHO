import type { LiveStateInput, CompletionLogEntry, DimensionFlag, LiveRuntimeEvent } from './liveStateModel';
import { deriveLiveState } from './liveStateModel';
import { appendCompletionLogEntries } from './liveStateEngine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GapTier = 'SHORT' | 'MEDIUM' | 'LONG' | 'EXTENDED';
export type ReEngagementOptionKind = 'RESUME' | 'RESTRUCTURE' | 'CLOSE';

export type GapEventType =
  | 'wait_period_completed'
  | 'wait_period_expired'
  | 'manufacturer_responded'
  | 'gate_approached'
  | 'flag_raised'
  | 'presale_order_received'
  | 'capital_milestone_reached'
  | 'session_scheduled_not_completed';

export interface GapEvent {
  eventType: GapEventType;
  title: string;
  occurredAt: string;
  isPositive: boolean;
  detail: string;
}

export interface TimelineImpact {
  originalCompletionDate: string;
  revisedCompletionDate: string;
  daysAdded: number;
  bufferRemainingDays: number;
  bufferRemainingWeeks: number;
  onOriginalTimeline: boolean;
  timelineStatement: string;
}

export interface CapitalImpact {
  presaleOrdersDuringGap: number;
  presaleBalanceChange: number;
  daysUntilNextGate: number;
  gateOnTrack: boolean;
  capitalStatement: string;
}

export interface GateApproach {
  gateId: string;
  gateTitle: string;
  daysUntilGate: number;
  wasWithin21DaysAtGapStart: boolean;
  prerequisitesMet: boolean;
  urgency: 'watch' | 'caution' | 'alert' | 'missed';
}

export interface HardGateMissed {
  gateId: string;
  gateTitle: string;
  missedAt: string;
  recoverableAlternative: string | null;
}

export interface GapAnalysis {
  daysSinceLastCheckIn: number;
  gapTier: GapTier;
  eventsWhileAway: GapEvent[];
  sessionsSkipped: number;
  sessionsSkippedTitles: string[];
  timelineImpact: TimelineImpact;
  capitalImpact: CapitalImpact | null;
  flagsRaised: DimensionFlag[];
  gatesApproached: GateApproach[];
  recoverable: boolean;
  recoverableReason: string | null;
  nonRecoverableReason: string | null;
  recapText: string;
}

export interface TodayAction {
  blockId: string | null;
  title: string;
  reason: string;
  actionType: 'session' | 'flag_response' | 'gate_prep' | 'catalog_review' | 'restructure_session' | 'archive' | 'option_selection';
}

export interface ReEngagementOption {
  kind: ReEngagementOptionKind;
  available: boolean;
  unavailableReason: string | null;
  label: string;
  description: string;
  consequence: string;
  firstAction: string;
}

export interface ReEngagementState {
  liveState: ReturnType<typeof deriveLiveState>;
  gap: GapAnalysis;
  options: ReEngagementOption[];
  recommendedOption: ReEngagementOptionKind;
  todayFirstAction: TodayAction;
}

export interface RestructureGateOption {
  optionLabel: string;
  description: string;
  consequence: string;
  newCompletionDate: string | null;
}

export interface RestructureGateProposal {
  gateId: string;
  gateTitle: string;
  missedAt: string;
  optionA: RestructureGateOption;
  optionB: RestructureGateOption;
  optionC: RestructureGateOption;
}

export interface RestructureProposal {
  proposalFor: HardGateMissed[];
  gates: RestructureGateProposal[];
  proposedNewCompletionDate: string | null;
  requiresUserApproval: true;
}

export interface EvidenceSummary {
  sessionsCompleted: number;
  keyDecisions: string[];
  contactsEstablished: string[];
  capitalInvested: number;
  whatWasLearned: string[];
}

// Input extends LiveStateInput with explicit gap-context overrides for testability
export interface ReEngagementInput extends LiveStateInput {
  hardGatesMissed?: HardGateMissed[];
  productionSlotLost?: boolean;
  bufferRemainingWeeksOverride?: number;
  sessionsSkippedOverride?: number;
  additionalGapEvents?: GapEvent[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Permanent regression guard — any recap that contains these phrases fails the suite.
export const PROHIBITED_RECAP_PHRASES = [
  'welcome back',
  'you missed',
  "you're behind",
  "you've been missed",
  "don't worry",
  "it's okay that you were away",
  'streak',
] as const;

export type ProhibitedRecapPhrase = (typeof PROHIBITED_RECAP_PHRASES)[number];

const GAP_TIER_SHORT_MAX = 14;
const GAP_TIER_MEDIUM_MAX = 30;
const GAP_TIER_LONG_MAX = 90;
const MS_PER_DAY = 86400000;

// ---------------------------------------------------------------------------
// Gap tier classification
// ---------------------------------------------------------------------------

export function classifyGapTier(days: number): GapTier {
  if (days <= GAP_TIER_SHORT_MAX) return 'SHORT';
  if (days <= GAP_TIER_MEDIUM_MAX) return 'MEDIUM';
  if (days <= GAP_TIER_LONG_MAX) return 'LONG';
  return 'EXTENDED';
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function parseDate(value: unknown) {
  const d = new Date(String(value || ''));
  return Number.isNaN(d.getTime()) ? null : d;
}

function diffDays(startISO: unknown, endISO: unknown): number {
  const s = parseDate(startISO);
  const e = parseDate(endISO);
  if (!s || !e) return 0;
  return Math.floor((e.getTime() - s.getTime()) / MS_PER_DAY);
}

function addDays(isoDate: string, days: number): string {
  const d = parseDate(isoDate);
  if (!d) return isoDate;
  return new Date(d.getTime() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

function toDayKey(value: unknown): string {
  return String(value || '').slice(0, 10);
}

// ---------------------------------------------------------------------------
// Gap event derivation
// ---------------------------------------------------------------------------

function deriveGapEvents(
  input: ReEngagementInput,
  lastCheckInDay: string,
  asOfDay: string
): GapEvent[] {
  const events: GapEvent[] = [];
  const runtimeEvents = Array.isArray(input.runtimeEvents) ? input.runtimeEvents : [];

  for (const event of runtimeEvents) {
    if (event.kind === 'manufacturer_response') {
      const day = toDayKey(event.respondedAt);
      if (day >= lastCheckInDay && day <= asOfDay) {
        const name = String(event.manufacturerName || 'Manufacturer');
        events.push({
          eventType: 'manufacturer_responded',
          title: `${name} responded`,
          occurredAt: day,
          isPositive: true,
          detail: `${name} responded with a catalog. That response is waiting for your review.`,
        });
      }
    }
    if (event.kind === 'presale_update') {
      const day = toDayKey(event.recordedAt);
      if (day >= lastCheckInDay && day <= asOfDay) {
        const count = Number(event.orderCount || 0);
        if (count > 0) {
          events.push({
            eventType: 'presale_order_received',
            title: `${count} presale order${count !== 1 ? 's' : ''} received`,
            occurredAt: day,
            isPositive: true,
            detail: `${count} presale order${count !== 1 ? 's' : ''} were received during the gap.`,
          });
        }
      }
    }
  }

  // Wait periods that completed within the gap window
  const blocks = Array.isArray(input.plan?.scheduledBlocks) ? input.plan.scheduledBlocks : [];
  for (const block of blocks) {
    if (String(block?.blockType || '') !== 'waiting_period') continue;
    const endDay = toDayKey(block?.endISO);
    if (endDay >= lastCheckInDay && endDay <= asOfDay) {
      events.push({
        eventType: 'wait_period_completed',
        title: `${String(block?.title || 'Wait period')} completed`,
        occurredAt: endDay,
        isPositive: true,
        detail: `The ${String(block?.title || 'wait period').toLowerCase()} completed during the gap.`,
      });
    }
  }

  // Merge caller-supplied events
  if (Array.isArray(input.additionalGapEvents)) {
    events.push(...input.additionalGapEvents);
  }

  // Positive events before negative, then chronological within each group
  events.sort((a, b) => {
    if (a.isPositive !== b.isPositive) return a.isPositive ? -1 : 1;
    return a.occurredAt.localeCompare(b.occurredAt);
  });

  return events;
}

// ---------------------------------------------------------------------------
// Sessions skipped
// ---------------------------------------------------------------------------

function deriveSessionsSkipped(
  input: ReEngagementInput,
  lastCheckInDay: string,
  asOfDay: string
): { count: number; titles: string[] } {
  if (typeof input.sessionsSkippedOverride === 'number') {
    return { count: input.sessionsSkippedOverride, titles: [] };
  }

  const log = Array.isArray(input.completionLog) ? input.completionLog : [];
  const completedIds = new Set(
    log
      .filter((e) => e.kind === 'complete' || e.completed === true || e.status === 'completed')
      .map((e) => String(e.blockId || '').trim())
      .filter(Boolean)
  );

  const blocks = Array.isArray(input.plan?.scheduledBlocks) ? input.plan.scheduledBlocks : [];
  const skipped = blocks.filter((block) => {
    if (String(block?.blockType || '') === 'waiting_period') return false;
    const day = toDayKey(block?.dayKey || block?.startISO);
    if (!day || day <= lastCheckInDay || day > asOfDay) return false;
    const id = String(block?.id || '').trim();
    return !completedIds.has(id);
  });

  return {
    count: skipped.length,
    titles: skipped.slice(0, 5).map((b) => String(b?.title || '')),
  };
}

// ---------------------------------------------------------------------------
// Timeline impact
// ---------------------------------------------------------------------------

function deriveTimelineImpact(
  planPosition: { projectedCompletionDate: string; plannedCompletionDate: string },
  bufferOverride: number | undefined
): TimelineImpact {
  const original = planPosition.plannedCompletionDate;
  const revised = planPosition.projectedCompletionDate;
  const daysAdded = Math.max(0, diffDays(original, revised));
  const bufferDays =
    typeof bufferOverride === 'number'
      ? bufferOverride * 7
      : Math.max(0, diffDays(revised, original));
  const bufferWeeks = Math.floor(bufferDays / 7);
  const onOriginalTimeline = daysAdded === 0;

  const timelineStatement = onOriginalTimeline
    ? `The plan is on its original timeline. Completion projected by ${original}.`
    : `The gap added ${daysAdded} days to your projected timeline. Your original completion date was ${original}. At current pace you are now projected to complete by ${revised}. You have ${bufferWeeks} weeks of buffer remaining.`;

  return {
    originalCompletionDate: original,
    revisedCompletionDate: revised,
    daysAdded,
    bufferRemainingDays: bufferDays,
    bufferRemainingWeeks: bufferWeeks,
    onOriginalTimeline,
    timelineStatement,
  };
}

// ---------------------------------------------------------------------------
// Capital impact
// ---------------------------------------------------------------------------

function deriveCapitalImpact(
  liveState: ReturnType<typeof deriveLiveState>,
  gapEvents: GapEvent[]
): CapitalImpact | null {
  const ct = liveState.capitalTrack;
  if (!ct || ct.strategy === 'direct') return null;

  const presaleOrders = gapEvents
    .filter((e) => e.eventType === 'presale_order_received')
    .reduce((sum, e) => {
      const m = e.title.match(/(\d+) presale/);
      return sum + (m ? parseInt(m[1], 10) : 0);
    }, 0);

  const gateOnTrack = ct.onTrackToMeetGate;
  const pct = Math.round(ct.percentToTarget * 100);

  const capitalStatement = gateOnTrack
    ? `Capital acquisition is on track toward the ${ct.nextGateName} gate.`
    : `Presale is at ${pct}% of the ${ct.nextGateName} target ($${ct.currentBalance.toLocaleString()} of $${ct.nextGateAmount.toLocaleString()}). At current pace the gate will not be met by ${toDayKey(ct.nextGateDate)}.`;

  return {
    presaleOrdersDuringGap: presaleOrders,
    presaleBalanceChange: presaleOrders * 40,
    daysUntilNextGate: ct.daysUntilNextGate,
    gateOnTrack,
    capitalStatement,
  };
}

// ---------------------------------------------------------------------------
// Gate approaches
// ---------------------------------------------------------------------------

function deriveGateApproaches(
  liveState: ReturnType<typeof deriveLiveState>,
  hardGatesMissed: HardGateMissed[],
  daysSince: number
): GateApproach[] {
  const approaches: GateApproach[] = [];
  const g = liveState.nextGate;

  if (g.gateId && g.gateId !== 'none') {
    const daysUntil = g.daysUntilGate;
    const missedEntry = hardGatesMissed.find((m) => m.gateId === g.gateId);
    const urgency: GateApproach['urgency'] = missedEntry
      ? 'missed'
      : daysUntil <= 7
      ? 'alert'
      : daysUntil <= 14
      ? 'caution'
      : 'watch';
    approaches.push({
      gateId: g.gateId,
      gateTitle: g.gateTitle,
      daysUntilGate: daysUntil,
      wasWithin21DaysAtGapStart: daysUntil + daysSince <= 21,
      prerequisitesMet: g.prerequisitesMet,
      urgency,
    });
  }

  for (const missed of hardGatesMissed) {
    if (!approaches.some((a) => a.gateId === missed.gateId)) {
      approaches.push({
        gateId: missed.gateId,
        gateTitle: missed.gateTitle,
        daysUntilGate: 0,
        wasWithin21DaysAtGapStart: true,
        prerequisitesMet: false,
        urgency: 'missed',
      });
    }
  }

  return approaches;
}

// ---------------------------------------------------------------------------
// Recoverability
// ---------------------------------------------------------------------------

function assessRecoverability(
  hardGatesMissed: HardGateMissed[],
  bufferWeeks: number,
  liveState: ReturnType<typeof deriveLiveState>,
  productionSlotLost: boolean
): { recoverable: boolean; recoverableReason: string | null; nonRecoverableReason: string | null } {
  // Critical path exceeds horizon by more than 50%
  const horizon = liveState.planPosition.plannedCompletionDate;
  const projected = liveState.planPosition.projectedCompletionDate;
  const horizonDuration = diffDays(liveState.asOf, horizon);
  const overrun = diffDays(horizon, projected);
  if (horizonDuration > 0 && overrun > 0 && overrun / horizonDuration > 0.5) {
    return {
      recoverable: false,
      recoverableReason: null,
      nonRecoverableReason: 'The projected completion date exceeds the original plan horizon by more than 50%.',
    };
  }

  // Hard gate missed with lost production slot
  if (productionSlotLost && hardGatesMissed.length > 0) {
    const gate = hardGatesMissed[0];
    return {
      recoverable: false,
      recoverableReason: null,
      nonRecoverableReason: `${gate.gateTitle} was missed and the production slot was lost. Re-entry to the production queue is required before resuming.`,
    };
  }

  // Missed gates that have recovery paths → recoverable through restructure
  if (hardGatesMissed.length > 0) {
    return {
      recoverable: true,
      recoverableReason: 'Restructure can address missed gates and re-sequence the plan from today.',
      nonRecoverableReason: null,
    };
  }

  if (bufferWeeks < 0) {
    return {
      recoverable: false,
      recoverableReason: null,
      nonRecoverableReason: 'The plan has exhausted its buffer. A restructure is required before continuing.',
    };
  }

  return {
    recoverable: true,
    recoverableReason: bufferWeeks >= 2 ? `${bufferWeeks} weeks of buffer remain.` : null,
    nonRecoverableReason: null,
  };
}

// ---------------------------------------------------------------------------
// Option builders
// ---------------------------------------------------------------------------

function buildResumeOption(
  hardGatesMissed: HardGateMissed[],
  bufferWeeks: number,
  liveState: ReturnType<typeof deriveLiveState>,
  productionSlotLost: boolean,
  revisedDate: string,
  nextSessionTitle: string
): ReEngagementOption {
  // Hard gate missed with lost slot — resume not available
  if (hardGatesMissed.length > 0 && (productionSlotLost || hardGatesMissed.some((g) => !g.recoverableAlternative))) {
    const gate = hardGatesMissed[0];
    return {
      kind: 'RESUME',
      available: false,
      unavailableReason: `${gate.gateTitle} was missed and must be resolved before the plan can continue.`,
      label: 'Resume — continue from where you left off',
      description: 'Resume is not available because a hard gate was missed with no direct recovery path.',
      consequence: 'Resuming without addressing the missed gate would produce a structurally invalid plan.',
      firstAction: 'Select Restructure to generate a recovery proposal before resuming.',
    };
  }

  // No buffer
  if (bufferWeeks < 0) {
    return {
      kind: 'RESUME',
      available: false,
      unavailableReason: 'The plan has no remaining buffer.',
      label: 'Resume — continue from where you left off',
      description: 'Resume is not available. The plan has exhausted its buffer.',
      consequence: 'Resuming without replanning would result in a plan that cannot complete within its horizon.',
      firstAction: 'Select Restructure to replan before resuming.',
    };
  }

  // 50% overrun check
  const horizon = liveState.planPosition.plannedCompletionDate;
  const projected = liveState.planPosition.projectedCompletionDate;
  const horizonDuration = diffDays(liveState.asOf, horizon);
  const overrun = diffDays(horizon, projected);
  if (horizonDuration > 0 && overrun > 0 && overrun / horizonDuration > 0.5) {
    return {
      kind: 'RESUME',
      available: false,
      unavailableReason: 'The critical path completion date exceeds the original horizon by more than 50%.',
      label: 'Resume — continue from where you left off',
      description: 'Resume is not available. The projected completion significantly exceeds the original horizon.',
      consequence: 'Resuming would require an unrealistic timeline extension.',
      firstAction: 'Select Restructure or Close.',
    };
  }

  const bufferNote = bufferWeeks <= 4 ? ` ${bufferWeeks} weeks of buffer remain — close monitoring required.` : '';

  return {
    kind: 'RESUME',
    available: true,
    unavailableReason: null,
    label: 'Resume — continue from where you left off',
    description: `The plan is still executable. Your timeline extends to ${revisedDate}. ${bufferWeeks} weeks of buffer remain.${bufferNote}`,
    consequence: 'You continue from today. The gap sessions are logged as skipped. The plan adjusts forward.',
    firstAction: nextSessionTitle,
  };
}

function buildRestructureOption(
  hardGatesMissed: HardGateMissed[],
  bufferWeeks: number,
  revisedDate: string
): ReEngagementOption {
  let description: string;
  let firstAction: string;

  if (hardGatesMissed.length > 0) {
    const gate = hardGatesMissed[0];
    description = `Some gates were missed during the gap. The plan needs adjustment before resuming. ${gate.gateTitle} was missed on ${gate.missedAt}. Here is what needs to change.`;
    firstAction = `Restructuring session: address the ${gate.gateTitle} gap and generate a replanning proposal.`;
  } else {
    description = `Buffer has dropped to ${bufferWeeks} week${bufferWeeks !== 1 ? 's' : ''}. The plan needs adjustment to remain on track. New completion date: ${revisedDate}.`;
    firstAction = 'Restructuring session: review remaining scope and identify what can be compressed or deprioritized.';
  }

  return {
    kind: 'RESTRUCTURE',
    available: true,
    unavailableReason: null,
    label: 'Restructure — replan around what changed',
    description,
    consequence: `The plan is replanned from today. Missed gates are resolved or routed around. New completion date: ${revisedDate}.`,
    firstAction,
  };
}

function buildCloseOption(sessionsCompleted: number): ReEngagementOption {
  return {
    kind: 'CLOSE',
    available: true,
    unavailableReason: null,
    label: 'Close — archive this goal with what you learned',
    description:
      "Closing preserves everything you built — the research, the contacts, the decisions — so it can be resumed or restarted later.",
    consequence: 'The goal is archived. Nothing is deleted. You can restart with a new timeline at any point.',
    firstAction: `Goal archive with evidence summary capturing what was built across ${sessionsCompleted} completed session${sessionsCompleted !== 1 ? 's' : ''}.`,
  };
}

// ---------------------------------------------------------------------------
// Recommended option
// ---------------------------------------------------------------------------

function deriveRecommendedOption(
  resumeOption: ReEngagementOption,
  bufferWeeks: number
): ReEngagementOptionKind {
  if (!resumeOption.available) return 'RESTRUCTURE';
  if (bufferWeeks > 4) return 'RESUME';
  // Resume available but buffer <= 4 weeks → lean toward restructure
  return 'RESTRUCTURE';
}

// ---------------------------------------------------------------------------
// Today first action
// ---------------------------------------------------------------------------

function deriveTodayFirstAction(
  recommendedOption: ReEngagementOptionKind,
  liveState: ReturnType<typeof deriveLiveState>,
  gapEvents: GapEvent[],
  hardGatesMissed: HardGateMissed[]
): TodayAction {
  if (recommendedOption === 'CLOSE') {
    return {
      blockId: null,
      title: 'Archive goal with evidence summary',
      reason: 'Closing the goal. Generating evidence summary.',
      actionType: 'archive',
    };
  }

  if (recommendedOption === 'RESTRUCTURE' && hardGatesMissed.length > 0) {
    const gate = hardGatesMissed[0];
    return {
      blockId: null,
      title: `Address missed gate: ${gate.gateTitle}`,
      reason: `${gate.gateTitle} was missed. Restructuring is required before resuming.`,
      actionType: 'restructure_session',
    };
  }

  // Manufacturer catalog waiting for review is always the highest-priority action when present
  const mfrEvent = gapEvents.find((e) => e.eventType === 'manufacturer_responded');
  if (mfrEvent) {
    return {
      blockId: null,
      title: `Review ${mfrEvent.title}`,
      reason: 'A manufacturer responded during the gap. Reviewing their catalog is the highest-priority action.',
      actionType: 'catalog_review',
    };
  }

  const alertFlag = liveState.dimensionFlags.find((f) => f.severity === 'alert');
  if (alertFlag) {
    return {
      blockId: null,
      title: alertFlag.recommendedAction,
      reason: alertFlag.signal,
      actionType: 'flag_response',
    };
  }

  const nextSession = liveState.todaysSessions[0] ?? null;
  if (nextSession) {
    return {
      blockId: nextSession.blockId,
      title: nextSession.title,
      reason: 'Next scheduled session.',
      actionType: 'session',
    };
  }

  if (recommendedOption === 'RESTRUCTURE') {
    return {
      blockId: null,
      title: 'Review the options above and select how to proceed',
      reason: "Today's action is shown after you select Resume, Restructure, or Close.",
      actionType: 'option_selection',
    };
  }

  return {
    blockId: null,
    title: 'Review plan and resume next scheduled session',
    reason: 'Continue from the next scheduled session.',
    actionType: 'session',
  };
}

// ---------------------------------------------------------------------------
// Recap text builder
// ---------------------------------------------------------------------------

function buildRecapText(
  days: number,
  gapEvents: GapEvent[],
  sessionsSkipped: number,
  timelineImpact: TimelineImpact,
  capitalImpact: CapitalImpact | null
): string {
  const parts: string[] = [];

  parts.push(`${days} days since your last check-in.`);

  // Positive events first (already sorted by isPositive in gapEvents)
  for (const event of gapEvents.filter((e) => e.isPositive)) {
    parts.push(event.detail);
  }

  // Sessions skipped — stated without judgment language
  if (sessionsSkipped > 0) {
    parts.push(`${sessionsSkipped} sessions were scheduled and not completed.`);
    parts.push(`You are ${sessionsSkipped} sessions behind plan.`);
  }

  // Negative non-session events
  for (const event of gapEvents.filter((e) => !e.isPositive && e.eventType !== 'session_scheduled_not_completed')) {
    parts.push(event.detail);
  }

  // Capital impact (stated once, only when off track)
  if (capitalImpact && !capitalImpact.gateOnTrack) {
    parts.push(capitalImpact.capitalStatement);
  }

  // Timeline impact (stated once)
  if (!timelineImpact.onOriginalTimeline) {
    parts.push(timelineImpact.timelineStatement);
  }

  parts.push('Here is where you are now.');

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Main: computeReEngagement
// ---------------------------------------------------------------------------

export function computeReEngagement(input: ReEngagementInput): ReEngagementState {
  const liveState = deriveLiveState(input);
  const asOfISO = liveState.asOf;
  const lastCheckInISO = liveState.lastCheckIn || asOfISO;
  const lastCheckInDay = toDayKey(lastCheckInISO);
  const asOfDay = toDayKey(asOfISO);
  const days = liveState.daysSinceLastCheckIn;
  const gapTier = classifyGapTier(days);

  const hardGatesMissed = Array.isArray(input.hardGatesMissed) ? input.hardGatesMissed : [];
  const productionSlotLost = input.productionSlotLost === true;

  const gapEvents = deriveGapEvents(input, lastCheckInDay, asOfDay);
  const { count: sessionsSkipped, titles: sessionsSkippedTitles } = deriveSessionsSkipped(
    input,
    lastCheckInDay,
    asOfDay
  );

  const bufferOverride = input.bufferRemainingWeeksOverride;
  const timelineImpact = deriveTimelineImpact(liveState.planPosition, bufferOverride);
  const bufferWeeks = typeof bufferOverride === 'number' ? bufferOverride : timelineImpact.bufferRemainingWeeks;

  const capitalImpact = deriveCapitalImpact(liveState, gapEvents);
  const flagsRaised = liveState.dimensionFlags.filter((f) => f.severity === 'caution' || f.severity === 'alert');
  const gatesApproached = deriveGateApproaches(liveState, hardGatesMissed, days);

  const { recoverable, recoverableReason, nonRecoverableReason } = assessRecoverability(
    hardGatesMissed,
    bufferWeeks,
    liveState,
    productionSlotLost
  );

  const recapText = buildRecapText(days, gapEvents, sessionsSkipped, timelineImpact, capitalImpact);

  const gap: GapAnalysis = {
    daysSinceLastCheckIn: days,
    gapTier,
    eventsWhileAway: gapEvents,
    sessionsSkipped,
    sessionsSkippedTitles,
    timelineImpact,
    capitalImpact,
    flagsRaised,
    gatesApproached,
    recoverable,
    recoverableReason,
    nonRecoverableReason,
    recapText,
  };

  const revisedDate = timelineImpact.revisedCompletionDate;
  const nextSessionTitle =
    liveState.todaysSessions[0]?.title || 'Resume next scheduled session.';

  const resumeOption = buildResumeOption(
    hardGatesMissed,
    bufferWeeks,
    liveState,
    productionSlotLost,
    revisedDate,
    nextSessionTitle
  );
  const restructureOption = buildRestructureOption(hardGatesMissed, bufferWeeks, revisedDate);
  const closeOption = buildCloseOption(liveState.planPosition.sessionsCompleted);

  const options: ReEngagementOption[] = [resumeOption, restructureOption, closeOption];
  const recommendedOption = deriveRecommendedOption(resumeOption, bufferWeeks);

  const todayFirstAction = deriveTodayFirstAction(
    recommendedOption,
    liveState,
    gapEvents,
    hardGatesMissed
  );

  return { liveState, gap, options, recommendedOption, todayFirstAction };
}

// ---------------------------------------------------------------------------
// Plan mutation: RESUME
// ---------------------------------------------------------------------------

export function applyResume(input: ReEngagementInput): CompletionLogEntry[] {
  const liveState = deriveLiveState(input);
  const lastCheckInDay = toDayKey(liveState.lastCheckIn || liveState.asOf);
  const asOfDay = toDayKey(liveState.asOf);
  const asOfISO = liveState.asOf;
  const log = Array.isArray(input.completionLog) ? input.completionLog : [];

  const completedIds = new Set(
    log
      .filter((e) => e.kind === 'complete' || e.completed === true)
      .map((e) => String(e.blockId || '').trim())
      .filter(Boolean)
  );

  const blocks = Array.isArray(input.plan?.scheduledBlocks) ? input.plan.scheduledBlocks : [];
  const skippedEntries: CompletionLogEntry[] = [];

  for (const block of blocks) {
    if (String(block?.blockType || '') === 'waiting_period') continue;
    const day = toDayKey(block?.dayKey || block?.startISO);
    if (!day || day <= lastCheckInDay || day > asOfDay) continue;
    const id = String(block?.id || '').trim();
    if (!id || completedIds.has(id)) continue;
    skippedEntries.push({
      id: `skip-${id}-${asOfISO.slice(0, 10)}`,
      blockId: id,
      dateISO: asOfISO.slice(0, 10),
      kind: 'missed',
      completed: false,
      status: 'skipped',
      canonicalTitle: String(block?.title || ''),
    });
  }

  const resumeEntry: CompletionLogEntry = {
    id: `resume-${asOfISO.slice(0, 10)}`,
    dateISO: asOfISO.slice(0, 10),
    kind: 'create',
    status: 're_engaged',
    canonicalTitle: 'Re-engagement: RESUME selected',
  };

  return appendCompletionLogEntries(log, [...skippedEntries, resumeEntry]);
}

// ---------------------------------------------------------------------------
// Plan mutation: RESTRUCTURE proposal
// ---------------------------------------------------------------------------

export function generateRestructureProposal(
  input: ReEngagementInput,
  missedGates: HardGateMissed[]
): RestructureProposal {
  const liveState = deriveLiveState(input);
  const revisedDate = liveState.planPosition.projectedCompletionDate;
  const extendedDate = addDays(revisedDate, 60);
  const pivotDate = addDays(revisedDate, 30);

  const gates: RestructureGateProposal[] = missedGates.map((gate) => {
    const isMOQ = gate.gateId === 'moq_production_deposit';
    return {
      gateId: gate.gateId,
      gateTitle: gate.gateTitle,
      missedAt: gate.missedAt,
      optionA: {
        optionLabel: 'Extend timeline to accommodate',
        description: `Extend the plan by the lead time required to re-enter the ${gate.gateTitle} queue.`,
        consequence: `New completion date: ${extendedDate}. All downstream work shifts forward. Gate sequence is preserved.`,
        newCompletionDate: extendedDate,
      },
      optionB: {
        optionLabel: 'Route around with a pivot',
        description: isMOQ
          ? 'Pivot to a crowdfund launch first. Use campaign proceeds to fund the MOQ deposit. Decouples capital acquisition from production timeline.'
          : `Route around ${gate.gateTitle} by identifying an alternative path.`,
        consequence: `New completion date: ${pivotDate}. Requires campaign setup (3-4 weeks). Capital acquisition path changes.`,
        newCompletionDate: pivotDate,
      },
      optionC: {
        optionLabel: 'Descope the work that depended on it',
        description: isMOQ
          ? 'Descope to digital pre-launch only. Launch a digital product while the capital track catches up to the physical product requirement.'
          : `Descope the work that depended on ${gate.gateTitle}.`,
        consequence:
          'Physical product launch deferred. Digital pre-launch proceeds. Gate is re-approached when capital target is reached.',
        newCompletionDate: null,
      },
    };
  });

  const restructureEntry: CompletionLogEntry = {
    id: `restructure-${liveState.asOf.slice(0, 10)}`,
    dateISO: liveState.asOf.slice(0, 10),
    kind: 'create',
    status: 're_engaged',
    canonicalTitle: 'Re-engagement: RESTRUCTURE proposal generated',
  };

  // Log the proposal generation event — not a plan mutation; plan mutates only after approval
  const updatedLog = appendCompletionLogEntries(
    Array.isArray(input.completionLog) ? input.completionLog : [],
    [restructureEntry]
  );

  void updatedLog; // caller applies the log update; proposal is returned for user review

  return {
    proposalFor: missedGates,
    gates,
    proposedNewCompletionDate: gates[0]?.optionA.newCompletionDate ?? null,
    requiresUserApproval: true,
  };
}

// ---------------------------------------------------------------------------
// CLOSE: evidence summary and archive
// ---------------------------------------------------------------------------

export function generateEvidenceSummary(input: ReEngagementInput): EvidenceSummary {
  const log = Array.isArray(input.completionLog) ? input.completionLog : [];
  const runtimeEvents = Array.isArray(input.runtimeEvents) ? input.runtimeEvents : [];

  const sessionsCompleted = log.filter(
    (e) => e.kind === 'complete' || e.completed === true || e.status === 'completed'
  ).length;

  const keyDecisions = log
    .filter((e) => e.canonicalTitle && /decision|selected|chose|confirmed|locked/i.test(String(e.canonicalTitle)))
    .map((e) => String(e.canonicalTitle || ''))
    .slice(0, 5);

  const contactsEstablished = runtimeEvents
    .filter((e): e is Extract<LiveRuntimeEvent, { kind: 'manufacturer_response' }> => e.kind === 'manufacturer_response')
    .map((e) => String(e.manufacturerName || 'Manufacturer'))
    .filter(Boolean);

  const presaleEvents = runtimeEvents.filter(
    (e): e is Extract<LiveRuntimeEvent, { kind: 'presale_update' }> => e.kind === 'presale_update'
  );
  const capitalInvested = presaleEvents.reduce((sum, e) => sum + Number(e.balance || 0), 0);

  const whatWasLearned = log
    .filter((e) => (e.kind === 'complete' || e.completed === true) && e.canonicalTitle)
    .map((e) => String(e.canonicalTitle || ''))
    .slice(0, 5);

  return {
    sessionsCompleted,
    keyDecisions: keyDecisions.length > 0 ? keyDecisions : ['Plan research and domain assessment completed.'],
    contactsEstablished,
    capitalInvested,
    whatWasLearned:
      whatWasLearned.length > 0 ? whatWasLearned : ['Plan structure and domain requirements documented.'],
  };
}

export function applyClose(input: ReEngagementInput): CompletionLogEntry[] {
  const log = Array.isArray(input.completionLog) ? input.completionLog : [];
  const asOfISO = String(input.asOf || new Date().toISOString());

  const closeEntry: CompletionLogEntry = {
    id: `close-${asOfISO.slice(0, 10)}`,
    dateISO: asOfISO.slice(0, 10),
    kind: 'create',
    status: 'archived',
    canonicalTitle: 'Re-engagement: CLOSE selected — goal archived with evidence summary',
  };

  return appendCompletionLogEntries(log, [closeEntry]);
}
