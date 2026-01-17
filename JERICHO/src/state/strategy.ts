import { formatCanonicalTime, parseTimeString } from './time/time.ts';

export type RouteOption = 'FLAT' | 'RAMP_UP' | 'MILESTONE_QUARTERS' | 'WAVE_3_1';

export type StrategyDeliverable = {
  id: string;
  title: string;
  requiredBlocks: number;
};

export type StrategyConstraints = {
  tz: string;
  preferredDaysOfWeek?: number[];
  blackoutDayKeys?: string[];
  maxBlocksPerDay?: number;
  maxBlocksPerWeek?: number;
};

export type StrategyV1 = {
  strategyId: string;
  generatorVersion: 'coldPlan_v1';
  routeOption: RouteOption;
  deliverables: StrategyDeliverable[];
  deadlineISO: string;
  constraints: StrategyConstraints;
  milestoneProfile?: {
    checkpoints: { anchorISO: string; targetCumulative: number }[];
  };
  assumptionsHash: string;
};

function stableStringify(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) + hash + input.charCodeAt(i);
    hash &= 0xffffffff;
  }
  return `h${Math.abs(hash)}`;
}

export function buildAssumptionsHash(strategy: StrategyV1): string {
  const payload = {
    generatorVersion: strategy.generatorVersion,
    routeOption: strategy.routeOption,
    deliverables: strategy.deliverables,
    deadlineISO: strategy.deadlineISO,
    constraints: strategy.constraints,
    milestoneProfile: strategy.milestoneProfile || null
  };
  return hashString(stableStringify(payload));
}

export function normalizeDeliverables(input: StrategyDeliverable[] = []): StrategyDeliverable[] {
  return (input || [])
    .map((d, idx) => ({
      id: d.id || `deliv-${idx + 1}`,
      title: (d.title || '').trim() || `Deliverable ${idx + 1}`,
      requiredBlocks: Math.max(0, Math.round(Number(d.requiredBlocks) || 0))
    }))
    .filter((d) => d.requiredBlocks > 0);
}

export function normalizeRouteOption(value: string): RouteOption {
  const upper = String(value || '').toUpperCase();
  if (upper === 'RAMP_UP' || upper === 'MILESTONE_QUARTERS' || upper === 'WAVE_3_1') return upper;
  return 'FLAT';
}

export function normalizeTimeString(value: string) {
  const parsed = parseTimeString(value);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };
  return { ok: true, value: formatCanonicalTime(parsed) };
}
