import { computeUserCompletionStats } from './userStatsCompute.js';
import { dayKeyFromDate } from './time/time.ts';

const GOAL_TYPE_MAP = [
  { type: 'SHIP_CREATIVE', domain: 'CREATION', tokens: ['ship', 'publish', 'launch', 'album', 'book', 'design', 'music', 'art'] },
  { type: 'BUILD_SYSTEM', domain: 'FOCUS', tokens: ['system', 'process', 'automation', 'architecture', 'refactor', 'implementation'] },
  { type: 'RAISE_CAPITAL', domain: 'RESOURCES', tokens: ['fund', 'capital', 'investor', 'pitch', 'deck', 'finance'] },
  { type: 'STABILIZE_SELF', domain: 'BODY', tokens: ['health', 'sleep', 'recovery', 'rest', 'stress'] },
  { type: 'GROW_AUDIENCE', domain: 'RESOURCES', tokens: ['audience', 'subscribers', 'marketing', 'growth', 'followers'] },
  { type: 'OPERATIONS', domain: 'FOCUS', tokens: ['operations', 'ops', 'support', 'tickets', 'maintenance'] }
];

export function computeGoalProfile(goalText = '', deadlineISO = null, todayDayKey = null) {
  const text = (goalText || '').toLowerCase();
  const tokens = text.split(/[^a-z0-9]+/).filter(Boolean);
  let match = GOAL_TYPE_MAP[0];
  let bestScore = -1;
  GOAL_TYPE_MAP.forEach((entry) => {
    const overlap = entry.tokens.reduce((acc, t) => acc + (tokens.includes(t) ? 1 : 0), 0);
    if (overlap > bestScore) {
      bestScore = overlap;
      match = entry;
    }
  });
  const today = todayDayKey ? new Date(`${todayDayKey}T00:00:00`) : new Date();
  const deadline = deadlineISO ? new Date(deadlineISO) : null;
  const daysRemaining = deadline ? Math.max(0, Math.round((deadline.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))) : 90;
  const pressure = Math.max(0, Math.min(1, 1 - daysRemaining / 90));
  return {
    goalType: match.type,
    dominantDomain: match.domain,
    tokens: new Set(tokens),
    daysRemaining,
    pressure
  };
}

export function getTodayCandidates(blocksForDay = [], nowLocal = new Date(), profile, userStats = computeUserCompletionStats([])) {
  const pending = blocksForDay.filter((b) => (b.status || 'pending') === 'pending');
  const candidates = pending.map((b) => ({
    kind: 'EXECUTE_EXISTING',
    blockId: b.id,
    date: (b.start || '').slice(0, 10),
    title: b.label || `${b.practice || b.domain} block`,
    domain: (b.practice || b.domain || 'FOCUS').toUpperCase(),
    durationMinutes: b.durationMinutes || estimateDuration(b),
    start: b.start,
    block: b
  }));

  // Schedule candidate only if nothing to execute or zero pending
  const scheduleCandidate = {
    kind: 'SCHEDULE_NEW',
    blockId: null,
    date: dayKeyFromDate(nowLocal),
    title: `Goal-aligned work`,
    domain: profile?.dominantDomain || 'FOCUS',
    durationMinutes: recommendDuration(profile, userStats),
    start: null
  };

  if (!candidates.length) candidates.push(scheduleCandidate);
  return candidates;
}

export function scoreCandidate(candidate, profile, patternDiagnostics = {}, userStats = computeUserCompletionStats([])) {
  const domainMatch = candidate.domain === profile?.dominantDomain ? 40 : 0;
  const tokenOverlap = profile?.tokens ? overlapScore(candidate.title || '', profile.tokens) : 0; // 0-20
  const leverage = domainMatch + tokenOverlap;
  const deadlineFit = Math.round(20 * (profile?.pressure || 0));
  const feasibility = feasibilityScore(candidate, userStats); // 0-20
  const stabilityPenalty = stabilityScore(candidate, patternDiagnostics); // 0-10 (penalty)
  return leverage + deadlineFit + feasibility - stabilityPenalty;
}

export function computeNextBestMove(candidates = [], profile, dayContext = {}) {
  if (!candidates.length) {
    return {
      kind: 'NONE',
      dayKey: dayContext.dayKey || '',
      why: 'No feasible time remaining today.',
      doneWhen: 'Day ends.'
    };
  }
  const scored = candidates.map((c) => ({
    candidate: c,
    score: scoreCandidate(c, profile, dayContext.patternDiagnostics, dayContext.userStats || {})
  }));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aStart = a.candidate.start ? new Date(a.candidate.start).getTime() : Infinity;
    const bStart = b.candidate.start ? new Date(b.candidate.start).getTime() : Infinity;
    if (aStart !== bStart) return aStart - bStart;
    if ((b.candidate.durationMinutes || 0) !== (a.candidate.durationMinutes || 0)) return (b.candidate.durationMinutes || 0) - (a.candidate.durationMinutes || 0);
    return (a.candidate.title || '').localeCompare(b.candidate.title || '');
  });

  const top = scored[0].candidate;
  const why = buildWhy(top, profile, dayContext.patternDiagnostics);
  const doneWhen =
    top.kind === 'EXECUTE_EXISTING'
      ? `Done when block "${top.title}" is completed.`
      : `Done when the block is scheduled today with duration ${top.durationMinutes || 30}m.`;
  return {
    kind: top.kind,
    dayKey: top.date,
    blockId: top.blockId,
    proposedBlock: top.kind === 'SCHEDULE_NEW' ? top : null,
    domain: top.domain,
    title: top.title,
    durationMinutes: top.durationMinutes,
    startTimeCandidate: top.start,
    why,
    doneWhen
  };
}

// --- helpers ---

function overlapScore(text, tokenSet) {
  const words = (text || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  let hits = 0;
  words.forEach((w) => {
    if (tokenSet.has(w)) hits += 1;
  });
  return Math.min(20, hits * 5);
}

function feasibilityScore(candidate, userStats) {
  const start = candidate.start ? new Date(candidate.start) : null;
  const h = start ? start.getHours() : 9;
  const timeBucket = h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night';
  const dur = candidate.durationMinutes || 30;
  let durBucket = '30';
  if (dur <= 15) durBucket = '15';
  else if (dur <= 30) durBucket = '30';
  else if (dur <= 60) durBucket = '60';
  else if (dur <= 90) durBucket = '90';
  else durBucket = '120';

  const timeRate = userStats?.rateByTimeBucket?.[timeBucket] ?? 0;
  const durRate = userStats?.rateByDurationBucket?.[durBucket] ?? 0;
  const avg = (timeRate + durRate) / 2;
  return Math.round(avg * 20); // 0-20
}

function stabilityScore(candidate, patternDiagnostics = {}) {
  // Simple penalty: if domain completion gap is large, reduce heroic planning
  const domain = candidate.domain || 'FOCUS';
  const gap = patternDiagnostics?.gaps?.[domain] || 0;
  if (gap <= 0) return 0;
  return Math.min(10, Math.round(gap / 30)); // 1 penalty per 30m gap, capped at 10
}

function estimateDuration(block) {
  if (block?.durationMinutes) return block.durationMinutes;
  const start = block?.start ? new Date(block.start) : null;
  const end = block?.end ? new Date(block.end) : null;
  if (start && end) return Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
  return 30;
}

function recommendDuration(profile, userStats) {
  // Pressure pushes longer; feasibility pulls toward reliable durations
  const base = profile?.pressure > 0.6 ? 60 : 30;
  const durRates = userStats?.rateByDurationBucket || {};
  const bestBucket = Object.entries(durRates).sort((a, b) => b[1] - a[1])[0];
  const best = bestBucket ? Number(bestBucket[0]) : base;
  return Math.max(15, Math.min(120, best || base));
}

function buildWhy(candidate, profile, patternDiagnostics = {}) {
  const parts = [];
  if (profile?.pressure) parts.push(`Deadline pressure ${(profile.pressure * 100).toFixed(0)}%`);
  if (candidate.domain === profile?.dominantDomain) parts.push(`Matches dominant domain ${profile.dominantDomain}`);
  const gap = patternDiagnostics?.gaps?.[candidate.domain];
  if (gap > 0) parts.push(`Closes ${gap}m gap in ${candidate.domain}`);
  if (parts.length === 0) parts.push('Aligned with goal tokens');
  return parts.join('; ');
}

export const __testables = {
  overlapScore,
  feasibilityScore,
  stabilityScore,
  recommendDuration
};
