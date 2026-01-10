// Deterministic completion stats derived from history (ledger or blocks with status=completed).
// history: array of { status, start, durationMinutes, domain }
export function computeUserCompletionStats(history = []) {
  const stats = {
    byTimeBucket: { morning: { success: 0, total: 0 }, afternoon: { success: 0, total: 0 }, evening: { success: 0, total: 0 }, night: { success: 0, total: 0 } },
    byDurationBucket: { '15': { success: 0, total: 0 }, '30': { success: 0, total: 0 }, '60': { success: 0, total: 0 }, '90': { success: 0, total: 0 }, '120': { success: 0, total: 0 } },
    byDomain: {}
  };

  const timeBucket = (date) => {
    if (!date) return 'morning';
    const h = date.getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    if (h < 21) return 'evening';
    return 'night';
  };

  const durationBucket = (m) => {
    if (m <= 15) return '15';
    if (m <= 30) return '30';
    if (m <= 60) return '60';
    if (m <= 90) return '90';
    return '120';
  };

  history.forEach((h) => {
    const start = h.start ? new Date(h.start) : null;
    const status = h.status || 'pending';
    const success = status === 'completed' || status === 'complete';
    const dur = Number(h.durationMinutes) || 0;
    const dBucket = durationBucket(dur);
    const tBucket = timeBucket(start);
    stats.byTimeBucket[tBucket].total += 1;
    stats.byTimeBucket[tBucket].success += success ? 1 : 0;
    stats.byDurationBucket[dBucket].total += 1;
    stats.byDurationBucket[dBucket].success += success ? 1 : 0;
    const domain = (h.domain || h.practice || 'FOCUS').toUpperCase();
    if (!stats.byDomain[domain]) stats.byDomain[domain] = { success: 0, total: 0 };
    stats.byDomain[domain].total += 1;
    stats.byDomain[domain].success += success ? 1 : 0;
  });

  const rate = (obj) => {
    const out = {};
    Object.keys(obj).forEach((k) => {
      const { success, total } = obj[k];
      out[k] = total ? success / total : 0;
    });
    return out;
  };

  return {
    rateByTimeBucket: rate(stats.byTimeBucket),
    rateByDurationBucket: rate(stats.byDurationBucket),
    rateByDomain: rate(stats.byDomain)
  };
}
