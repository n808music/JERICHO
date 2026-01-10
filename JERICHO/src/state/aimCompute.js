// Phase 2A deterministic AIM compute (pure functions, no side effects).

// Domain inference keywords (lowercase)
const DOMAIN_KEYWORDS = {
  RESOURCES: ['money', 'revenue', 'sales', 'client', 'customers', 'customer', 'deal', 'cash'],
  CREATION: ['music', 'album', 'song', 'label', 'content', 'video', 'script', 'write', 'record'],
  BODY: ['sleep', 'gym', 'health', 'food', 'run', 'workout', 'exercise', 'rest'],
  FOCUS: [] // fallback
};

export function computeGoalProfile(goal = '', deadlineISO = null, todayKey = null) {
  const tokens = normalizeText(goal);
  const dominantDomain = inferDomain(tokens);
  const today = todayKey ? new Date(`${todayKey}T00:00:00`) : new Date();
  const deadline = deadlineISO ? new Date(deadlineISO) : null;
  const daysRemaining = deadline ? Math.max(0, Math.round((deadline.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))) : 999;
  const urgencyBand = daysRemaining <= 14 ? 'high' : daysRemaining <= 60 ? 'medium' : 'low';
  return {
    daysRemaining,
    urgencyBand,
    dominantDomain,
    goalTokens: tokens
  };
}

export function getTodayCandidates(blocks = [], todayKey) {
  const todayBlocks = (blocks || []).filter((b) => (b.start || '').slice(0, 10) === todayKey);
  const candidates = todayBlocks.map((b) => ({
    kind: 'scheduled_block',
    blockId: b.id,
    domain: (b.practice || b.domain || 'FOCUS').toUpperCase(),
    durationMinutes: b.durationMinutes || estimateDuration(b),
    startISO: b.start,
    title: b.label || `${b.practice || b.domain || 'Block'}`
  }));
  return candidates;
}

export function scoreCandidate(candidate, goalProfile, blocksForToday = []) {
  let score = 0;
  const rationale = [];
  if (candidate.domain === goalProfile.dominantDomain) {
    score += 40;
    rationale.push('Domain matches goal');
    if (goalProfile.urgencyBand === 'high') {
      score += 25;
      rationale.push('High urgency');
    }
  }
  if (candidate.kind === 'scheduled_block') {
    const status = findBlockStatus(blocksForToday, candidate.blockId);
    if (status === 'pending') {
      score += 15;
      rationale.push('Pending block ready to execute');
    }
    if (status === 'completed') {
      score -= 10;
      rationale.push('Already completed');
    }
  }
  if (candidate.durationMinutes >= 15 && candidate.durationMinutes <= 90) {
    score += 10;
    rationale.push('Duration in sweet spot');
  }
  if (candidate.durationMinutes > 180) {
    score -= 20;
    rationale.push('Duration too long');
  }
  return { score, rationale };
}

export function computeNextBestMove(goal, deadlineISO, blocks = [], history = [], todayKey) {
  const profile = computeGoalProfile(goal, deadlineISO, todayKey);
  const todayBlocks = blocks.filter((b) => (b.start || '').slice(0, 10) === todayKey);
  const candidates = getTodayCandidates(blocks, todayKey);

  // gap_fill if no block in dominant domain today
  const hasDominant = todayBlocks.some((b) => (b.practice || b.domain || '').toUpperCase() === profile.dominantDomain);
  if (!hasDominant) {
    candidates.push({
      kind: 'gap_fill',
      domain: profile.dominantDomain,
      durationMinutes: 30,
      title: `Goal-aligned ${profile.dominantDomain.toLowerCase()} block`
    });
  }
  if (!todayBlocks.length) {
    candidates.push({
      kind: 'first_move',
      domain: profile.dominantDomain,
      durationMinutes: 30,
      title: `First move toward goal`
    });
  }

  if (!candidates.length) return null;

  const ordered = [...candidates].sort(candidateOrder);
  const scored = ordered.map((c) => {
    const { score, rationale } = scoreCandidate(c, profile, todayBlocks);
    return { candidate: c, score, rationale };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if ((a.candidate.durationMinutes || 0) !== (b.candidate.durationMinutes || 0)) return (a.candidate.durationMinutes || 0) - (b.candidate.durationMinutes || 0);
    const aStart = a.candidate.startISO ? new Date(a.candidate.startISO).getTime() : Infinity;
    const bStart = b.candidate.startISO ? new Date(b.candidate.startISO).getTime() : Infinity;
    if (aStart !== bStart) return aStart - bStart;
    const aLex = a.candidate.blockId || a.candidate.title || '';
    const bLex = b.candidate.blockId || b.candidate.title || '';
    return aLex.localeCompare(bLex);
  });

  const top = scored[0];
  const c = top.candidate;
  const rationale = top.rationale.slice(0, 3);

  if (c.kind === 'scheduled_block') {
    return {
      type: 'execute',
      domain: toTitle(c.domain),
      durationMinutes: c.durationMinutes,
      blockId: c.blockId,
      rationale,
      doneWhen: 'When the referenced block is completed today.'
    };
  }

  return {
    type: 'schedule',
    domain: toTitle(c.domain),
    durationMinutes: 30,
    rationale,
    doneWhen: 'When a block of this domain and duration is completed today.'
  };
}

// --- helpers ---

function normalizeText(text) {
  return (text || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function inferDomain(tokens) {
  const match = (domain) => DOMAIN_KEYWORDS[domain].some((k) => tokens.includes(k));
  if (match('RESOURCES')) return 'RESOURCES';
  if (match('CREATION')) return 'CREATION';
  if (match('BODY')) return 'BODY';
  return 'FOCUS';
}

function estimateDuration(block) {
  if (block?.durationMinutes) return block.durationMinutes;
  const start = block?.start ? new Date(block.start) : null;
  const end = block?.end ? new Date(block.end) : null;
  if (start && end) return Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
  return 30;
}

function findBlockStatus(blocks, id) {
  const b = (blocks || []).find((x) => x.id === id);
  return b ? b.status || 'pending' : 'pending';
}

function toTitle(domain) {
  const lower = (domain || 'FOCUS').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

// Deterministic ordering to keep pinning stable regardless of input order.
function candidateOrder(a, b) {
  const aStart = a.startISO ? new Date(a.startISO).getTime() : Infinity;
  const bStart = b.startISO ? new Date(b.startISO).getTime() : Infinity;
  if (aStart !== bStart) return aStart - bStart;

  const aDur = a.durationMinutes || 0;
  const bDur = b.durationMinutes || 0;
  if (aDur !== bDur) return aDur - bDur;

  const aDomain = a.domain || '';
  const bDomain = b.domain || '';
  if (aDomain !== bDomain) return aDomain.localeCompare(bDomain);

  const aTitle = a.title || '';
  const bTitle = b.title || '';
  if (aTitle !== bTitle) return aTitle.localeCompare(bTitle);

  const aId = a.blockId || '';
  const bId = b.blockId || '';
  return aId.localeCompare(bId);
}
