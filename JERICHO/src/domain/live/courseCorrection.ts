import type {
  LiveStateInput,
  CompletionLogEntry,
  LivePlanBlock,
  LiveRuntimeEvent,
  CapitalTrackState,
  PlanPosition,
  WaitPeriod,
  GateStatus,
} from './liveStateModel';
import { deriveLiveState } from './liveStateModel';
import { getLatestRuntimeEvent } from './liveStateEngine';
import { PROHIBITED_RECAP_PHRASES } from './reEngagement';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PrecisionRating =
  | 'PRECISE'
  | 'MINOR_DRIFT'
  | 'DRIFTING'
  | 'SIGNIFICANT_DRIFT'
  | 'CRITICAL';

export type EntropyReading = 'GREEN' | 'WATCH' | 'CAUTION' | 'ALERT' | 'CRITICAL';

export interface DimensionEntropy {
  dimension: 'capital' | 'timeline' | 'execution' | 'domain' | 'market';
  currentReading: EntropyReading;
  trend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
  trendEvidence: string;
  lastUpdated: string;
  correctionRequired: boolean;
  correctionUrgency: 'none' | 'soon' | 'now' | 'overdue';
}

export interface EntropySummary {
  asOf: string;
  overallPrecision: PrecisionRating;
  dimensions: DimensionEntropy[];
  activeCorrections: CourseCorrection[];
  completedCorrections: CourseCorrection[];
  entropyTrend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
  trendWindow: number;
}

export interface CorrectionOption {
  optionId: string;
  label: string;
  action: string;
  effort: 'low' | 'medium' | 'high';
  timeToEffect: string;
  tradeoff: string | null;
  recommended: boolean;
}

export interface CourseCorrection {
  correctionId: string;
  dimension: string;
  trigger: string;
  triggeredAt: string;
  status: 'active' | 'resolved' | 'escalated' | 'accepted';
  severity: 'minor' | 'moderate' | 'significant' | 'critical';
  diagnosis: string;
  rootCause: string;
  consequence: string;
  options: CorrectionOption[];
  selectedOption: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface SameSlotPattern {
  slotKey: string;
  dayOfWeek: number;
  hour: number;
  skippedCount: number;
  totalOccurrences: number;
  blockTitles: string[];
}

export interface EntropyHistoryEntry {
  date: string;
  overallPrecision: PrecisionRating;
  dimensionReadings: Record<string, EntropyReading>;
  correctionsActive: number;
  correctionsResolved: number;
  significantEvents: string[];
}

export interface EntropyHistory {
  entries: EntropyHistoryEntry[];
}

export interface CourseCorrectionInput {
  liveStateInput: LiveStateInput;
  entropyHistory?: EntropyHistory;
  existingCorrections?: CourseCorrection[];
  bufferRemainingWeeksOverride?: number;
  presaleCampaignStartISO?: string;
}

// ---------------------------------------------------------------------------
// Constants — mirror thresholds from feasibilityDerivation.ts and liveStateModel.ts
// ---------------------------------------------------------------------------

// Market engagement threshold (same value as MARKET_ENGAGEMENT_REVISION_THRESHOLD in feasibilityDerivation.ts)
export const ENTROPY_MARKET_ENGAGEMENT_GREEN = 0.3;
export const ENTROPY_MARKET_ENGAGEMENT_WATCH = 0.2;
export const ENTROPY_MARKET_ENGAGEMENT_CAUTION = 0.1;

// Manufacturer response windows (same as MANUFACTURER_TIMEOUT_* in liveStateModel.ts)
export const ENTROPY_MANUFACTURER_WATCH_DAYS = 15;
export const ENTROPY_MANUFACTURER_CAUTION_DAYS = 20;
export const ENTROPY_MANUFACTURER_ALERT_DAYS = 30;
export const ENTROPY_MANUFACTURER_CRITICAL_DAYS = 45;

// Capital conversion thresholds (ratios of projected rate)
export const ENTROPY_CAPITAL_GREEN_RATIO = 0.75;
export const ENTROPY_CAPITAL_WATCH_RATIO = 0.50;
export const ENTROPY_CAPITAL_CAUTION_RATIO = 0.25;

// Timeline session gap thresholds
export const ENTROPY_TIMELINE_ALERT_GAP = -11;
export const ENTROPY_TIMELINE_CAUTION_GAP = -6;
export const ENTROPY_TIMELINE_WATCH_GAP = -3;

// Prohibited phrases — extend from re-engagement layer
export const PROHIBITED_CORRECTION_PHRASES = [
  ...PROHIBITED_RECAP_PHRASES,
  'you failed',
  'you should have',
  'you need to do better',
] as const;

export type ProhibitedCorrectionPhrase = (typeof PROHIBITED_CORRECTION_PHRASES)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86400000;

function parseDate(v: unknown) {
  const d = new Date(String(v || ''));
  return Number.isNaN(d.getTime()) ? null : d;
}

function diffDays(a: unknown, b: unknown): number {
  const s = parseDate(a);
  const e = parseDate(b);
  if (!s || !e) return 0;
  return Math.floor((e.getTime() - s.getTime()) / MS_PER_DAY);
}

function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  if (!d) return iso;
  return new Date(d.getTime() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

function toDayKey(v: unknown): string {
  return String(v || '').trim().slice(0, 10);
}

function entropyScore(reading: EntropyReading): number {
  return { GREEN: 0, WATCH: 1, CAUTION: 2, ALERT: 3, CRITICAL: 4 }[reading] ?? 0;
}

function precisionScore(p: PrecisionRating): number {
  return { PRECISE: 5, MINOR_DRIFT: 4, DRIFTING: 3, SIGNIFICANT_DRIFT: 2, CRITICAL: 1 }[p] ?? 0;
}

function computeBufferWeeks(planPosition: PlanPosition): number {
  const days = diffDays(planPosition.projectedCompletionDate, planPosition.plannedCompletionDate);
  return Math.floor(days / 7);
}

// ---------------------------------------------------------------------------
// 1. Capital dimension entropy
// ---------------------------------------------------------------------------

export function classifyCapitalEntropy(
  capitalTrack: CapitalTrackState,
  nextGate: GateStatus,
  projectedRate: number
): EntropyReading {
  if (capitalTrack.strategy !== 'presale') {
    // Direct or mixed strategy — use gate proximity
    const gap = Math.max(0, (nextGate.capitalRequired ?? 0) - (nextGate.capitalAvailable ?? 0));
    if (nextGate.daysUntilGate <= 7 && gap > 1000) return 'CRITICAL';
    return capitalTrack.onTrackToMeetGate ? 'GREEN' : 'CAUTION';
  }

  const actualRate = Number(capitalTrack.presaleConversionRate ?? 0);
  const daysUntilGate = nextGate.daysUntilGate ?? 9999;
  const effectiveGap = Math.max(0, capitalTrack.target - capitalTrack.currentBalance);

  // CRITICAL: gate within 7 days and gap > $1,000, or no remaining path
  if (daysUntilGate <= 7 && effectiveGap > 1000) return 'CRITICAL';
  if (capitalTrack.percentToTarget === 0 && daysUntilGate <= 14) return 'CRITICAL';

  // ALERT
  if (projectedRate > 0 && actualRate > 0 && actualRate < projectedRate * ENTROPY_CAPITAL_CAUTION_RATIO) return 'ALERT';
  if (daysUntilGate <= 14 && effectiveGap > 0) return 'ALERT';

  // CAUTION
  if (projectedRate > 0 && actualRate > 0 && actualRate < projectedRate * ENTROPY_CAPITAL_WATCH_RATIO) return 'CAUTION';

  // WATCH
  if (projectedRate > 0 && actualRate > 0 && actualRate < projectedRate * ENTROPY_CAPITAL_GREEN_RATIO && daysUntilGate > 30) return 'WATCH';

  // GREEN
  return 'GREEN';
}

// ---------------------------------------------------------------------------
// 2. Timeline dimension entropy
// ---------------------------------------------------------------------------

export function classifyTimelineEntropy(planPosition: PlanPosition, bufferWeeks: number): EntropyReading {
  const gap = planPosition.sessionGap;

  // CRITICAL
  if (gap < -20) return 'CRITICAL';
  if (bufferWeeks < 1) return 'CRITICAL';

  // Check 90-day overrun
  const overrunDays = diffDays(planPosition.plannedCompletionDate, planPosition.projectedCompletionDate);
  if (overrunDays > 90) return 'CRITICAL';

  // ALERT
  if (gap <= -11 && gap >= -20) return 'ALERT';
  if (bufferWeeks >= 1 && bufferWeeks < 2) return 'ALERT';

  // CAUTION
  if (gap <= -6 && gap >= -10) return 'CAUTION';
  if (bufferWeeks >= 2 && bufferWeeks < 4) return 'CAUTION';

  // WATCH
  if (gap <= -3 && gap >= -5) return 'WATCH';
  if (bufferWeeks >= 4 && bufferWeeks < 6) return 'WATCH';

  return 'GREEN';
}

// ---------------------------------------------------------------------------
// 3. Execution dimension entropy + same-slot pattern
// ---------------------------------------------------------------------------

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function toSlotKey(startISO: string): { key: string; dayOfWeek: number; hour: number } | null {
  const d = parseDate(startISO);
  if (!d) return null;
  const dayOfWeek = d.getUTCDay();
  const hour = d.getUTCHours();
  return { key: `${DAY_NAMES[dayOfWeek]}:${String(hour).padStart(2, '0')}`, dayOfWeek, hour };
}

export function detectSameSlotPattern(
  completionLog: CompletionLogEntry[],
  scheduledBlocks: LivePlanBlock[],
  asOfISO: string
): SameSlotPattern[] {
  const completedIds = new Set(
    completionLog
      .filter((e) => e.kind === 'complete' || e.completed === true || e.status === 'completed')
      .map((e) => String(e.blockId || '').trim())
      .filter(Boolean)
  );

  // Group session blocks by slot key
  const slotMap = new Map<
    string,
    { dayOfWeek: number; hour: number; blocks: Array<{ id: string; startISO: string; title: string }> }
  >();

  for (const block of scheduledBlocks) {
    if (String(block?.blockType || 'execution') === 'waiting_period') continue;
    const startISO = String(block?.startISO || '');
    if (!startISO || startISO > asOfISO) continue;
    const slot = toSlotKey(startISO);
    if (!slot) continue;
    const id = String(block?.id || '').trim();
    if (!id) continue;

    if (!slotMap.has(slot.key)) {
      slotMap.set(slot.key, { dayOfWeek: slot.dayOfWeek, hour: slot.hour, blocks: [] });
    }
    slotMap.get(slot.key)!.blocks.push({ id, startISO, title: String(block?.title || '') });
  }

  const patterns: SameSlotPattern[] = [];

  for (const [key, { dayOfWeek, hour, blocks }] of slotMap) {
    // Only consider slots with enough occurrences
    if (blocks.length < 3) continue;

    // Sort by date descending, take last 5
    const sorted = [...blocks].sort((a, b) => b.startISO.localeCompare(a.startISO));
    const window = sorted.slice(0, 5);

    // Pattern resets if the most recent occurrence was completed
    if (!window[0] || completedIds.has(window[0].id)) continue;

    const skipped = window.filter((b) => !completedIds.has(b.id));
    if (skipped.length >= 3) {
      patterns.push({
        slotKey: key,
        dayOfWeek,
        hour,
        skippedCount: skipped.length,
        totalOccurrences: window.length,
        blockTitles: skipped.map((b) => b.title).slice(0, 3),
      });
    }
  }

  return patterns;
}

export function classifyExecutionEntropy(
  completionLog: CompletionLogEntry[],
  scheduledBlocks: LivePlanBlock[],
  asOfISO: string
): { reading: EntropyReading; sameSlotPatterns: SameSlotPattern[] } {
  const completedIds = new Set(
    completionLog
      .filter((e) => e.kind === 'complete' || e.completed === true || e.status === 'completed')
      .map((e) => String(e.blockId || '').trim())
      .filter(Boolean)
  );

  const window7Start = new Date(parseDate(asOfISO)!.getTime() - 7 * MS_PER_DAY).toISOString();
  const window10Start = new Date(parseDate(asOfISO)!.getTime() - 10 * MS_PER_DAY).toISOString();

  const scheduled7d = scheduledBlocks.filter(
    (b) =>
      String(b?.blockType || 'execution') !== 'waiting_period' &&
      String(b?.startISO || '') >= window7Start &&
      String(b?.startISO || '') <= asOfISO
  );
  const completed7d = scheduled7d.filter((b) => completedIds.has(String(b?.id || '').trim()));
  const rate7d = scheduled7d.length > 0 ? completed7d.length / scheduled7d.length : 1;

  const scheduled10d = scheduledBlocks.filter(
    (b) =>
      String(b?.blockType || 'execution') !== 'waiting_period' &&
      String(b?.startISO || '') >= window10Start &&
      String(b?.startISO || '') <= asOfISO
  );
  const completed10d = scheduled10d.filter((b) => completedIds.has(String(b?.id || '').trim()));

  const sameSlotPatterns = detectSameSlotPattern(completionLog, scheduledBlocks, asOfISO);
  const hasSlotPattern = sameSlotPatterns.length > 0;

  // CRITICAL: zero completions in last 10 scheduled days
  if (scheduled10d.length > 0 && completed10d.length === 0) return { reading: 'CRITICAL', sameSlotPatterns };

  // ALERT: completion rate < 40% or zero sessions in last 5 scheduled
  if (scheduled7d.length > 0 && rate7d < 0.4) return { reading: 'ALERT', sameSlotPatterns };

  // CAUTION: completion rate < 60% or slot pattern 3 of 5
  const heavySlotPattern = sameSlotPatterns.some((p) => p.skippedCount >= 3 && p.totalOccurrences >= 5);
  if (scheduled7d.length > 0 && rate7d < 0.6) return { reading: 'CAUTION', sameSlotPatterns };
  if (heavySlotPattern) return { reading: 'CAUTION', sameSlotPatterns };

  // WATCH: completion rate < 80% or slot pattern 2 of 5
  const lightSlotPattern = hasSlotPattern && sameSlotPatterns.some((p) => p.skippedCount >= 2);
  if (scheduled7d.length > 0 && rate7d < 0.8) return { reading: 'WATCH', sameSlotPatterns };
  if (lightSlotPattern) return { reading: 'WATCH', sameSlotPatterns };

  return { reading: 'GREEN', sameSlotPatterns };
}

// ---------------------------------------------------------------------------
// 4. Domain dimension entropy
// ---------------------------------------------------------------------------

export function classifyDomainEntropy(activeWaitPeriods: WaitPeriod[]): EntropyReading {
  const mfr = activeWaitPeriods.filter((w) => /manufacturer/i.test(w.title));
  if (mfr.length === 0) return 'GREEN';

  const maxDays = Math.max(...mfr.map((w) => w.daysElapsed));

  if (maxDays >= ENTROPY_MANUFACTURER_CRITICAL_DAYS) return 'CRITICAL';
  if (maxDays >= ENTROPY_MANUFACTURER_ALERT_DAYS) return 'ALERT';
  if (maxDays >= ENTROPY_MANUFACTURER_CAUTION_DAYS) return 'CAUTION';
  if (maxDays >= ENTROPY_MANUFACTURER_WATCH_DAYS) return 'WATCH';
  return 'GREEN';
}

// ---------------------------------------------------------------------------
// 5. Market dimension entropy
// ---------------------------------------------------------------------------

export function classifyMarketEntropy(
  runtimeEvents: LiveRuntimeEvent[],
  scheduledBlocks: LivePlanBlock[],
  asOfISO: string,
  presaleCampaignStartISO?: string
): EntropyReading {
  const latestEngagement = getLatestRuntimeEvent(runtimeEvents, 'content_engagement');
  const latestPresale = getLatestRuntimeEvent(runtimeEvents, 'presale_update');

  // Content engagement check
  if (latestEngagement) {
    const ratio = Number(latestEngagement.engagementRatio);
    if (ratio < ENTROPY_MARKET_ENGAGEMENT_CAUTION) return 'ALERT';
    if (ratio < ENTROPY_MARKET_ENGAGEMENT_WATCH) return 'CAUTION';
    if (ratio < ENTROPY_MARKET_ENGAGEMENT_GREEN) return 'WATCH';
  }

  // Presale: 0 orders after 14 days → ALERT
  if (latestPresale && Number(latestPresale.orderCount ?? 0) === 0) {
    const campaignStart = presaleCampaignStartISO ?? toDayKey(latestPresale.recordedAt);
    const daysSince = diffDays(campaignStart, asOfISO);
    if (daysSince >= 14) return 'ALERT';
  }

  // Presale: 30 days, fewer than 10 orders → CRITICAL
  if (latestPresale && Number(latestPresale.orderCount ?? 0) < 10) {
    const campaignStart = presaleCampaignStartISO ?? toDayKey(latestPresale.recordedAt);
    const daysSince = diffDays(campaignStart, asOfISO);
    if (daysSince >= 30) return 'CRITICAL';
  }

  // No content launched by day N
  const asOfDayKey = toDayKey(asOfISO);
  const planStart = scheduledBlocks.length > 0
    ? toDayKey(
        [...scheduledBlocks].sort((a, b) => String(a.startISO || '').localeCompare(String(b.startISO || '')))[0]?.startISO
      )
    : asOfDayKey;

  const daysSincePlanStart = planStart ? diffDays(`${planStart}T00:00:00.000Z`, asOfISO) : 0;
  const hasContentBlock = scheduledBlocks.some((b) =>
    /founder.?journey|content|audience|presale|warm list/i.test(String(b?.title || ''))
  );

  if (!hasContentBlock && !latestEngagement && !latestPresale) {
    if (daysSincePlanStart >= 45) return 'ALERT';
    if (daysSincePlanStart >= 30) return 'CAUTION';
    if (daysSincePlanStart >= 20) return 'WATCH';
  }

  return 'GREEN';
}

// ---------------------------------------------------------------------------
// Overall precision derivation
// ---------------------------------------------------------------------------

export function deriveOverallPrecision(readings: EntropyReading[]): PrecisionRating {
  const counts = { GREEN: 0, WATCH: 0, CAUTION: 0, ALERT: 0, CRITICAL: 0 };
  for (const r of readings) counts[r] = (counts[r] ?? 0) + 1;

  if (counts.CRITICAL > 0 || counts.CAUTION >= 3) return 'CRITICAL';
  if (counts.ALERT > 0 || counts.CAUTION >= 2) return 'SIGNIFICANT_DRIFT';
  if (counts.CAUTION === 1) return 'DRIFTING';
  if (counts.WATCH >= 2) return 'DRIFTING';
  if (counts.WATCH === 1) return 'MINOR_DRIFT';
  return 'PRECISE';
}

// ---------------------------------------------------------------------------
// Entropy trend from history
// ---------------------------------------------------------------------------

export function computeEntropyTrend(
  history: EntropyHistory,
  _asOf: string
): { trend: 'IMPROVING' | 'STABLE' | 'DEGRADING'; trendWindow: number } {
  const entries = history?.entries ?? [];
  if (entries.length < 2) return { trend: 'STABLE', trendWindow: entries.length };

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const oldest = sorted[0]!;
  const newest = sorted[sorted.length - 1]!;
  const trendWindow = Math.max(1, diffDays(`${oldest.date}T00:00:00.000Z`, `${newest.date}T00:00:00.000Z`));

  if (trendWindow < 7) return { trend: 'STABLE', trendWindow };

  // Find entry closest to 7 days before newest
  const targetDate = `${addDays(newest.date, -7)}T00:00:00.000Z`;
  const reference = sorted.reduce((best, entry) => {
    const diff = Math.abs(diffDays(`${entry.date}T00:00:00.000Z`, targetDate));
    const bestDiff = Math.abs(diffDays(`${best.date}T00:00:00.000Z`, targetDate));
    return diff < bestDiff ? entry : best;
  });

  const currentScore = precisionScore(newest.overallPrecision);
  const referenceScore = precisionScore(reference.overallPrecision);

  if (currentScore > referenceScore) return { trend: 'IMPROVING', trendWindow };
  if (currentScore < referenceScore) return { trend: 'DEGRADING', trendWindow };
  return { trend: 'STABLE', trendWindow };
}

// ---------------------------------------------------------------------------
// Dimension entropy object builder
// ---------------------------------------------------------------------------

function buildDimensionEntropy(
  dimension: DimensionEntropy['dimension'],
  reading: EntropyReading,
  asOf: string,
  history?: EntropyHistory
): DimensionEntropy {
  const correctionRequired = reading !== 'GREEN';
  const correctionUrgency: DimensionEntropy['correctionUrgency'] =
    reading === 'GREEN'
      ? 'none'
      : reading === 'WATCH'
      ? 'soon'
      : reading === 'CRITICAL'
      ? 'overdue'
      : 'now';

  let trend: DimensionEntropy['trend'] = 'STABLE';
  let trendEvidence = 'Insufficient history to compute trend.';

  if (history && history.entries.length > 0) {
    const sorted = [...history.entries].sort((a, b) => a.date.localeCompare(b.date));
    const lastEntry = sorted[sorted.length - 1]!;
    const previousReading = lastEntry.dimensionReadings?.[dimension];
    if (previousReading) {
      const prevScore = entropyScore(previousReading);
      const currScore = entropyScore(reading);
      if (currScore < prevScore) {
        trend = 'IMPROVING';
        trendEvidence = `Reading improved from ${previousReading} to ${reading}.`;
      } else if (currScore > prevScore) {
        trend = 'DEGRADING';
        trendEvidence = `Reading changed from ${previousReading} to ${reading}.`;
      } else {
        trendEvidence = `Reading unchanged at ${reading}.`;
      }
    }
  }

  return { dimension, currentReading: reading, trend, trendEvidence, lastUpdated: asOf, correctionRequired, correctionUrgency };
}

// ---------------------------------------------------------------------------
// Correction generators
// ---------------------------------------------------------------------------

function makeId(prefix: string, asOf: string): string {
  return `${prefix}-${asOf.slice(0, 10)}`;
}

function generateCapitalCorrections(
  reading: EntropyReading,
  capitalTrack: CapitalTrackState,
  nextGate: GateStatus,
  projectedRate: number,
  asOf: string
): CourseCorrection[] {
  if (reading === 'GREEN') return [];

  const gap = Math.max(0, capitalTrack.target - capitalTrack.currentBalance);
  const gapFormatted = `$${gap.toLocaleString()}`;
  const daysUntilGate = nextGate.daysUntilGate;
  const gateTitle = nextGate.gateTitle;
  const gateDate = toDayKey(nextGate.gateDate) || 'the gate date';
  const pct = Math.round((Number(capitalTrack.presaleConversionRate ?? 0) / Math.max(0.0001, projectedRate)) * 100);
  const targetFormatted = capitalTrack.target ? `$${capitalTrack.target.toLocaleString()}` : 'capital';

  if (reading === 'CRITICAL' || reading === 'ALERT') {
    // When the gate is within 14 days, only direct personal outreach has conversion potential
    // within the remaining window. Content strategy takes 7-14 days to produce signal —
    // there is not enough time for it to work. Network activation is the only realistic option.
    const networkIsOnlyRealisticOption = daysUntilGate <= 14;

    return [
      {
        correctionId: makeId('capital-alert', asOf),
        dimension: 'capital',
        trigger: `Capital gap of ${gapFormatted} with ${daysUntilGate} days until ${gateTitle}.`,
        triggeredAt: asOf,
        status: 'active',
        severity: reading === 'CRITICAL' ? 'critical' : 'significant',
        diagnosis: `Capital gap of ${gapFormatted} with ${daysUntilGate} days until ${gateTitle}. Immediate action required.`,
        rootCause: `Presale conversion has not reached the rate required to clear the ${gateTitle} before it closes.`,
        consequence: `${gateTitle} is ${daysUntilGate} days away with a ${gapFormatted} gap. Without immediate action the production commitment cannot be made.`,
        options: [
          {
            optionId: 'cap-a-network',
            label: 'Activate entrepreneur network directly',
            action: `Reach out to your personal network today with a specific presale ask. List 20 people who know your work. Send a direct message with a link to the presale page and a clear deadline.`,
            effort: 'medium',
            timeToEffect: 'Immediate signal within 72 hours',
            tradeoff: null,
            // Network activation is the only option that produces conversion signal fast enough
            // when the gate is within 14 days. Content strategy takes longer to convert.
            recommended: networkIsOnlyRealisticOption,
          },
          {
            optionId: 'cap-b-price',
            label: 'Reduce presale price point by 10-15%',
            action: `Reduce the presale price to lower the conversion barrier for hesitant buyers. Update the presale page and send an updated offer to your warm list.`,
            effort: 'low',
            timeToEffect: '1-3 days after campaign send',
            tradeoff: `Reduces total capital raised per order. Requires more orders to reach the ${targetFormatted} target.`,
            // Price reduction is viable at any time horizon but produces less conversion than
            // direct personal outreach when the gate is imminent.
            recommended: !networkIsOnlyRealisticOption,
          },
          {
            optionId: 'cap-c-extend',
            label: 'Request timeline extension from manufacturer',
            action: `Contact the manufacturer to negotiate a 30-day extension on the production slot reservation.`,
            effort: 'low',
            timeToEffect: '5-10 business days',
            tradeoff: 'Timeline extends. Does not close the capital gap — it only defers the gate deadline.',
            recommended: false,
          },
        ],
        selectedOption: null,
        resolvedAt: null,
        resolvedBy: null,
      },
    ];
  }

  // CAUTION or WATCH — gate is farther out; time window determines which option leads
  // When the gate is more than 30 days away, a content strategy shift can generate
  // enough audience engagement to move conversion before the gate closes.
  // When the gate is 15-30 days away, direct network activation is faster than
  // content-led conversion and becomes the lead option.
  const contentStrategyViable = daysUntilGate > 30;

  return [
    {
      correctionId: makeId('capital-watch', asOf),
      dimension: 'capital',
      trigger: `Presale conversion is running at ${pct}% of projected rate.`,
      triggeredAt: asOf,
      status: 'active',
      severity: reading === 'CAUTION' ? 'moderate' : 'minor',
      diagnosis: `Presale conversion is running at ${pct}% of projected rate. At this pace the ${targetFormatted} target will not be met by ${gateDate}.`,
      rootCause: `Audience conversion is trailing the projected rate of ${(projectedRate * 100).toFixed(2)}%. ${contentStrategyViable ? `With ${daysUntilGate} days until the gate, a content strategy shift can still move conversion before the deadline.` : `With ${daysUntilGate} days remaining, direct outreach is needed to convert faster than content can.`}`,
      consequence: `If the conversion gap continues at this rate, the ${targetFormatted} gate will not clear by ${gateDate}.`,
      options: [
        {
          optionId: 'cap-caution-a-content',
          label: 'Shift Founder Journey to direct conversion content',
          action: `Reframe the next 3 Founder Journey posts specifically around the presale offer — the problem it solves, what buyers get, and why now. Stop describing the product; start asking for the commitment.`,
          effort: 'low',
          timeToEffect: '7-14 days',
          tradeoff: null,
          // Content strategy is the lead option when the gate is far enough to benefit from
          // organic engagement building. Not viable when gate is within 30 days.
          recommended: contentStrategyViable,
        },
        {
          optionId: 'cap-caution-b-network',
          label: 'Activate entrepreneur network directly for presale asks',
          action: `Identify 20 people in your personal network who know your work. Send each a direct, personal message with a specific presale ask and a link. A personal ask converts at 3-5x the rate of a broadcast post.`,
          effort: 'medium',
          timeToEffect: 'Immediate signal within 72 hours',
          tradeoff: null,
          // Network activation is the lead option when the gate is close enough that
          // content engagement timelines cannot close the gap in time.
          recommended: !contentStrategyViable,
        },
        {
          optionId: 'cap-caution-c-price',
          label: 'Reduce presale price point by 10-15%',
          action: `Lower the presale price to reduce the conversion barrier. Update the offer and send an updated campaign to your warm list.`,
          effort: 'low',
          timeToEffect: '1-3 days after campaign send',
          tradeoff: `Reduces total capital raised per order. Requires more orders to reach the ${targetFormatted} target.`,
          recommended: false,
        },
      ],
      selectedOption: null,
      resolvedAt: null,
      resolvedBy: null,
    },
  ];
}

function generateTimelineCorrections(
  reading: EntropyReading,
  planPosition: PlanPosition,
  bufferWeeks: number,
  asOf: string
): CourseCorrection[] {
  if (reading === 'GREEN') return [];

  const gap = Math.abs(planPosition.sessionGap);
  const severity: CourseCorrection['severity'] =
    reading === 'CRITICAL' ? 'critical'
    : reading === 'ALERT' ? 'significant'
    : reading === 'CAUTION' ? 'moderate'
    : 'minor';

  return [
    {
      correctionId: makeId('timeline', asOf),
      dimension: 'timeline',
      trigger: `${gap} sessions behind plan with ${bufferWeeks} weeks of buffer remaining.`,
      triggeredAt: asOf,
      status: 'active',
      severity,
      diagnosis: `${gap} sessions are behind plan. ${bufferWeeks > 0 ? `${bufferWeeks} weeks of buffer remain.` : 'Buffer is exhausted.'}`,
      rootCause: 'Completed sessions have not kept pace with the planned schedule.',
      consequence:
        bufferWeeks < 2
          ? 'At current pace the plan will overrun its deadline. A replanning session is required.'
          : 'Continued drift will exhaust the remaining buffer and push the completion date.',
      options: [
        {
          optionId: 'tl-a-compress',
          label: 'Compress the next two weeks to close the gap',
          action: 'Schedule one additional work session per day for the next 14 days to recover the gap.',
          effort: 'high',
          timeToEffect: '14 days',
          tradeoff: 'Requires above-normal capacity for two weeks.',
          recommended: true,
        },
        {
          optionId: 'tl-b-deprioritize',
          label: 'Deprioritize lower-impact actions to protect the critical path',
          action: 'Identify the 3 lowest-priority actions in the current phase and move them to a later phase or remove them.',
          effort: 'medium',
          timeToEffect: 'Immediate timeline impact',
          tradeoff: 'Reduces scope.',
          recommended: false,
        },
        {
          optionId: 'tl-c-extend',
          label: 'Accept an extended timeline and update the plan',
          action: 'Update the completion target to reflect the current pace.',
          effort: 'low',
          timeToEffect: 'Immediate',
          tradeoff: `Extended timeline. Original deadline of ${planPosition.plannedCompletionDate.slice(0, 10)} moves to approximately ${planPosition.projectedCompletionDate.slice(0, 10)}.`,
          recommended: false,
        },
      ],
      selectedOption: null,
      resolvedAt: null,
      resolvedBy: null,
    },
  ];
}

function generateExecutionCorrections(
  reading: EntropyReading,
  sameSlotPatterns: SameSlotPattern[],
  asOf: string
): CourseCorrection[] {
  if (reading === 'GREEN') return [];

  const corrections: CourseCorrection[] = [];

  // Same-slot pattern correction (per pattern)
  for (const pattern of sameSlotPatterns) {
    const slotLabel = `${DAY_NAMES[pattern.dayOfWeek]} at ${String(pattern.hour).padStart(2, '0')}:00`;
    corrections.push({
      correctionId: makeId(`execution-slot-${pattern.slotKey}`, asOf),
      dimension: 'execution',
      trigger: `A pattern of ${slotLabel} sessions not being completed has been detected.`,
      triggeredAt: asOf,
      status: 'active',
      severity: 'moderate',
      diagnosis: `A pattern of ${slotLabel} sessions not being completed has been detected across ${pattern.skippedCount} of the last ${pattern.totalOccurrences} occurrences. The scheduled time appears to conflict with your actual availability.`,
      rootCause: `The ${slotLabel} slot was scheduled when it was expected to be available, but the current pattern shows it is not consistently usable.`,
      consequence: `If the ${slotLabel} slot is not addressed, this session type will continue to accumulate as unexecuted work.`,
      options: [
        {
          optionId: `exec-slot-a-move`,
          label: `Move ${slotLabel} sessions to a different time slot`,
          action: `Identify a time slot that is consistently available in your week. Reschedule these sessions to that slot going forward.`,
          effort: 'low',
          timeToEffect: 'Effective from next scheduled session',
          tradeoff: null,
          recommended: true,
        },
        {
          optionId: `exec-slot-b-reduce`,
          label: `Reduce the number of sessions scheduled in this slot`,
          action: `Keep one session per week in this slot and move the rest to adjacent days.`,
          effort: 'low',
          timeToEffect: 'Effective from next scheduled session',
          tradeoff: 'Smaller session density in this slot. Other days carry more work.',
          recommended: false,
        },
        {
          optionId: `exec-slot-c-consolidate`,
          label: 'Consolidate this work into other days',
          action: `Remove this slot entirely and add the session time to days that have consistent completion.`,
          effort: 'medium',
          timeToEffect: '1 week to re-establish rhythm',
          tradeoff: 'Other days have higher session load.',
          recommended: false,
        },
      ],
      selectedOption: null,
      resolvedAt: null,
      resolvedBy: null,
    });
  }

  // General execution rate correction if no slot pattern or rate is low
  if (reading === 'ALERT' || reading === 'CRITICAL') {
    corrections.push({
      correctionId: makeId('execution-rate', asOf),
      dimension: 'execution',
      trigger: 'Completion rate in the last 7 days has fallen below the minimum threshold.',
      triggeredAt: asOf,
      status: 'active',
      severity: reading === 'CRITICAL' ? 'critical' : 'significant',
      diagnosis: 'Fewer than 40% of scheduled sessions in the last 7 days have been completed.',
      rootCause: 'The current schedule does not reflect available capacity.',
      consequence: 'If the completion rate does not recover, the plan timeline will overrun.',
      options: [
        {
          optionId: 'exec-rate-a',
          label: 'Review and adjust the weekly schedule to match available capacity',
          action: 'Block off realistic work windows this week and reschedule overdue sessions into those windows.',
          effort: 'medium',
          timeToEffect: '1 week',
          tradeoff: null,
          recommended: true,
        },
        {
          optionId: 'exec-rate-b',
          label: 'Reduce session length to lower the completion barrier',
          action: 'Cut each session from 60 to 30 minutes for the next two weeks to rebuild the execution habit.',
          effort: 'low',
          timeToEffect: 'Immediate',
          tradeoff: 'Lower output per session. Requires more sessions to complete the same scope.',
          recommended: false,
        },
      ],
      selectedOption: null,
      resolvedAt: null,
      resolvedBy: null,
    });
  }

  return corrections;
}

function generateDomainCorrections(
  reading: EntropyReading,
  activeWaitPeriods: WaitPeriod[],
  asOf: string
): CourseCorrection[] {
  if (reading === 'GREEN') return [];

  const mfrWaits = activeWaitPeriods.filter((w) => /manufacturer/i.test(w.title));
  const longestWait = mfrWaits.reduce<WaitPeriod | null>(
    (best, w) => (!best || w.daysElapsed > best.daysElapsed ? w : best),
    null
  );

  if (!longestWait) return [];

  const days = longestWait.daysElapsed;
  const title = longestWait.title;
  const severity: CourseCorrection['severity'] =
    reading === 'CRITICAL' ? 'critical'
    : reading === 'ALERT' ? 'significant'
    : reading === 'CAUTION' ? 'moderate'
    : 'minor';

  return [
    {
      correctionId: makeId('domain-manufacturer', asOf),
      dimension: 'domain',
      trigger: `${title} has been open for ${days} business days without a response.`,
      triggeredAt: asOf,
      status: 'active',
      severity,
      diagnosis: `${title} has been open for ${days} business days without a logged response. This is past the ${ENTROPY_MANUFACTURER_ALERT_DAYS}-business-day response window.`,
      rootCause: 'No manufacturer response has been logged for this contact.',
      consequence:
        reading === 'CRITICAL'
          ? 'No manufacturer engagement after 45 business days with no fallback supplier identified. Formula selection and sampling cannot proceed.'
          : 'A single unresponsive manufacturer blocks catalog comparison and formula selection, creating a dependency risk on the responding manufacturer.',
      options: [
        {
          optionId: 'domain-a-followup',
          label: 'Send a follow-up to non-responsive manufacturers',
          action: `Send a follow-up to non-responsive manufacturers with a specific question about their capability for your order volume. A specific question gets a higher response rate than a general inquiry.`,
          effort: 'low',
          timeToEffect: '5-10 business days',
          tradeoff: null,
          recommended: true,
        },
        {
          optionId: 'domain-b-expand',
          label: 'Expand outreach to 3 additional manufacturers immediately',
          action: 'Identify 3 additional manufacturers from the target supplier list and send initial capability inquiries today.',
          effort: 'medium',
          timeToEffect: '15-20 business days',
          tradeoff: 'Delays formula selection if a new manufacturer is selected. Widens the pool, which reduces single-supplier dependency.',
          recommended: false,
        },
        {
          optionId: 'domain-c-proceed',
          label: 'Proceed with current respondents only',
          action: 'Accept the current response set and move forward with catalog evaluation using only the responding manufacturers.',
          effort: 'low',
          timeToEffect: 'Immediate',
          tradeoff: 'Smaller manufacturer pool increases dependency on a single supplier.',
          recommended: false,
        },
      ],
      selectedOption: null,
      resolvedAt: null,
      resolvedBy: null,
    },
  ];
}

function generateMarketCorrections(
  reading: EntropyReading,
  _runtimeEvents: LiveRuntimeEvent[],
  asOf: string
): CourseCorrection[] {
  if (reading === 'GREEN') return [];

  const severity: CourseCorrection['severity'] =
    reading === 'CRITICAL' ? 'critical'
    : reading === 'ALERT' ? 'significant'
    : reading === 'CAUTION' ? 'moderate'
    : 'minor';

  return [
    {
      correctionId: makeId('market', asOf),
      dimension: 'market',
      trigger: 'Audience engagement is trailing the threshold required for presale conversion.',
      triggeredAt: asOf,
      status: 'active',
      severity,
      diagnosis: 'Founder Journey content engagement is below the threshold needed to support the presale conversion target.',
      rootCause: 'The content format or angle is not resonating with the target audience at the rate required.',
      consequence: 'Low engagement at this stage means the presale audience will be too small to reach the capital gate.',
      options: [
        {
          optionId: 'market-a-content',
          label: 'Shift content to behind-the-scenes process documentation',
          action: 'Shift the next 3 Founder Journey posts from product announcement to behind-the-scenes process. Document the formula selection decision, the manufacturer outreach, the sample unboxing.',
          effort: 'low',
          timeToEffect: '7-14 days',
          tradeoff: null,
          recommended: true,
        },
        {
          optionId: 'market-b-network',
          label: 'Activate entrepreneur network before broader audience ask',
          action: 'Reach out directly to 10 founders in your network with a personal message asking them to share the Founder Journey with their audience.',
          effort: 'medium',
          timeToEffect: 'Immediate signal',
          tradeoff: 'Requires personal outreach. Network goodwill is a limited resource.',
          recommended: false,
        },
        {
          optionId: 'market-c-price',
          label: 'Revise presale price point down 10-15%',
          action: 'Lower the presale price to reduce the conversion barrier for hesitant buyers.',
          effort: 'low',
          timeToEffect: 'Next campaign send',
          tradeoff: 'Reduces total capital raised per order. Requires more orders to hit the capital gate.',
          recommended: false,
        },
      ],
      selectedOption: null,
      resolvedAt: null,
      resolvedBy: null,
    },
  ];
}

// ---------------------------------------------------------------------------
// Correction lifecycle
// ---------------------------------------------------------------------------

const ESCALATION_DAYS = 14;

const SEVERITY_ESCALATION: Record<CourseCorrection['severity'], CourseCorrection['severity']> = {
  minor: 'moderate',
  moderate: 'significant',
  significant: 'critical',
  critical: 'critical',
};

export function escalateStaleCorrections(
  corrections: CourseCorrection[],
  asOfISO: string
): CourseCorrection[] {
  return corrections.map((c) => {
    if (c.status !== 'active' && c.status !== 'escalated') return c;
    if (c.selectedOption) return c; // user acted — no auto-escalation
    const daysSince = diffDays(c.triggeredAt, asOfISO);
    if (daysSince >= ESCALATION_DAYS) {
      return {
        ...c,
        status: 'escalated' as const,
        severity: SEVERITY_ESCALATION[c.severity],
      };
    }
    return c;
  });
}

export function checkCorrectionResolution(
  correction: CourseCorrection,
  currentReading: EntropyReading,
  asOfISO: string
): CourseCorrection {
  if (correction.status === 'resolved' || correction.status === 'accepted') return correction;

  // A correction is resolved when the reading improves to GREEN
  const currentScore = entropyScore(currentReading);

  if (currentScore === 0) {
    // Reading is GREEN — correction resolved
    return { ...correction, status: 'resolved', resolvedAt: asOfISO, resolvedBy: 'dimension_improved' };
  }

  return correction;
}

// ---------------------------------------------------------------------------
// Main: computeEntropySummary
// ---------------------------------------------------------------------------

export function computeEntropySummary(input: CourseCorrectionInput): EntropySummary {
  const liveState = deriveLiveState(input.liveStateInput);
  const asOf = liveState.asOf;

  const projectedRate =
    Number(
      input.liveStateInput.plan?.summary?.capitalAcquisitionFeasibility
        ?.capitalAcquisitionPath?.presaleMath?.audienceConversionRequired ?? 0
    );

  const bufferWeeks =
    typeof input.bufferRemainingWeeksOverride === 'number'
      ? input.bufferRemainingWeeksOverride
      : computeBufferWeeks(liveState.planPosition);

  const capitalReading = classifyCapitalEntropy(liveState.capitalTrack, liveState.nextGate, projectedRate);
  const timelineReading = classifyTimelineEntropy(liveState.planPosition, bufferWeeks);
  const { reading: executionReading, sameSlotPatterns } = classifyExecutionEntropy(
    Array.isArray(input.liveStateInput.completionLog) ? input.liveStateInput.completionLog : [],
    Array.isArray(input.liveStateInput.plan?.scheduledBlocks) ? input.liveStateInput.plan.scheduledBlocks : [],
    asOf
  );
  const domainReading = classifyDomainEntropy(liveState.activeWaitPeriods);
  const marketReading = classifyMarketEntropy(
    Array.isArray(input.liveStateInput.runtimeEvents) ? input.liveStateInput.runtimeEvents : [],
    Array.isArray(input.liveStateInput.plan?.scheduledBlocks) ? input.liveStateInput.plan.scheduledBlocks : [],
    asOf,
    input.presaleCampaignStartISO
  );

  const history = input.entropyHistory ?? { entries: [] };
  const dimensions: DimensionEntropy[] = [
    buildDimensionEntropy('capital', capitalReading, asOf, history),
    buildDimensionEntropy('timeline', timelineReading, asOf, history),
    buildDimensionEntropy('execution', executionReading, asOf, history),
    buildDimensionEntropy('domain', domainReading, asOf, history),
    buildDimensionEntropy('market', marketReading, asOf, history),
  ];

  const overallPrecision = deriveOverallPrecision([
    capitalReading,
    timelineReading,
    executionReading,
    domainReading,
    marketReading,
  ]);

  const { trend: entropyTrend, trendWindow } = computeEntropyTrend(history, asOf);

  // Generate new corrections based on current readings
  const newCorrections: CourseCorrection[] = [
    ...generateCapitalCorrections(capitalReading, liveState.capitalTrack, liveState.nextGate, projectedRate, asOf),
    ...generateTimelineCorrections(timelineReading, liveState.planPosition, bufferWeeks, asOf),
    ...generateExecutionCorrections(executionReading, sameSlotPatterns, asOf),
    ...generateDomainCorrections(domainReading, liveState.activeWaitPeriods, asOf),
    ...generateMarketCorrections(marketReading, Array.isArray(input.liveStateInput.runtimeEvents) ? input.liveStateInput.runtimeEvents : [], asOf),
  ];

  // Merge with existing corrections
  const existing = Array.isArray(input.existingCorrections) ? input.existingCorrections : [];

  // Check resolution on previously active corrections
  const dimensionReadingMap: Record<string, EntropyReading> = {
    capital: capitalReading,
    timeline: timelineReading,
    execution: executionReading,
    domain: domainReading,
    market: marketReading,
  };

  const updatedExisting = existing.map((c) => {
    const currentReading = dimensionReadingMap[c.dimension] as EntropyReading | undefined;
    if (!currentReading) return c;
    return checkCorrectionResolution(c, currentReading, asOf);
  });

  const escalatedExisting = escalateStaleCorrections(
    updatedExisting.filter((c) => c.status === 'active'),
    asOf
  );

  const resolvedExisting = updatedExisting.filter((c) => c.status === 'resolved' || c.status === 'accepted');

  // Deduplicate new corrections if dimension already has an active correction
  const activeDimensions = new Set(escalatedExisting.map((c) => c.dimension));
  const deduplicatedNew = newCorrections.filter((c) => !activeDimensions.has(c.dimension));

  const activeCorrections = [...escalatedExisting, ...deduplicatedNew];
  const completedCorrections = resolvedExisting;

  return {
    asOf,
    overallPrecision,
    dimensions,
    activeCorrections,
    completedCorrections,
    entropyTrend,
    trendWindow,
  };
}

// ---------------------------------------------------------------------------
// Entropy history management
// ---------------------------------------------------------------------------

export function appendEntropyHistoryEntry(
  history: EntropyHistory | null | undefined,
  summary: EntropySummary
): EntropyHistory {
  const existing = history?.entries ?? [];
  const today = summary.asOf.slice(0, 10);

  // Append-only: do not overwrite an existing entry for the same day
  if (existing.some((e) => e.date === today)) {
    return { entries: existing };
  }

  const dimensionReadings: Record<string, EntropyReading> = {};
  for (const dim of summary.dimensions) {
    dimensionReadings[dim.dimension] = dim.currentReading;
  }

  const entry: EntropyHistoryEntry = {
    date: today,
    overallPrecision: summary.overallPrecision,
    dimensionReadings,
    correctionsActive: summary.activeCorrections.length,
    correctionsResolved: summary.completedCorrections.length,
    significantEvents: summary.activeCorrections
      .filter((c) => c.severity === 'significant' || c.severity === 'critical')
      .map((c) => c.trigger)
      .slice(0, 3),
  };

  return { entries: [...existing, entry] };
}
