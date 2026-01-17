const DOMAIN_KEYWORDS = [
  { match: /deep\s*work|focus|concentration|writing/i, domain: 'focus', capability: 'deep_work' },
  { match: /ship|deliver|launch|execute|execution|throughput|publish/i, domain: 'execution', capability: 'execution' },
  { match: /discipline|consistency|habit|routine/i, domain: 'discipline', capability: 'discipline' },
  { match: /revenue|sales|mrr|arr|customers|pipeline/i, domain: 'execution', capability: 'execution' },
  { match: /study|learn|course|exam|cert/i, domain: 'focus', capability: 'deep_work' }
];

const DEFAULT_DOMAIN = { domain: 'execution', capability: 'execution' };

export function resolveGoalDomain(text = '') {
  const trimmed = (text || '').toLowerCase();
  for (const entry of DOMAIN_KEYWORDS) {
    if (entry.match.test(trimmed)) return { domain: entry.domain, capability: entry.capability };
  }
  return { ...DEFAULT_DOMAIN, reason: 'fallback' };
}

export function normalizeGoalInput(rawGoal = '') {
  const resolution = resolveGoalDomain(rawGoal);
  const numericSignal = (rawGoal.match(/[\d,\.]+/) || [null])[0];
  const targetDate =
    (rawGoal.match(/\d{4}-\d{2}-\d{2}/) || [null])[0] ||
    (rawGoal.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s*\d{4}\b/i) || [null])[0];
  return {
    domain: resolution.domain,
    capability: resolution.capability,
    numericSignal,
    targetDate
  };
}
