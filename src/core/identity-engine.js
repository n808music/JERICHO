// Deterministic identity snapshot builder and in-memory buffer (stub for future persistence).
const identityStore = new Map(); // userId -> [snapshots]

export function buildIdentitySnapshot({ userId = 'default', capabilities = [], integrity = {}, history = [] }) {
  const snapshotCapabilities = capabilities.map((cap) => {
    const current = Number(cap.currentLevel) || 0;
    const target = Number(cap.targetLevel) || 0;
    const driftRatio = target > 0 ? Math.min(1, current / target) : 0;
    const pressureScore = 1 - driftRatio;
    return {
      id: cap.id || `${cap.domain || 'domain'}.${cap.capability || 'cap'}`,
      domain: cap.domain,
      capability: cap.capability,
      currentLevel: current,
      targetLevel: target,
      driftRatio,
      pressureScore
    };
  });

  const recent = history.slice(-3);
  const integrityScores = recent.map((h) => h?.integrity?.score ?? 0);
  const integritySlope = integrityScores.length >= 2 ? integrityScores[integrityScores.length - 1] - integrityScores[0] : 0;
  const avgPressure =
    snapshotCapabilities.length === 0
      ? 0
      : snapshotCapabilities.reduce((acc, c) => acc + (c.pressureScore || 0), 0) / snapshotCapabilities.length;
  const loadIndex = avgPressure * (integrity?.score ?? 0);

  return {
    userId,
    capabilities: snapshotCapabilities,
    integrity: {
      score: integrity?.score ?? 0,
      slope: integritySlope
    },
    loadIndex,
    createdAt: new Date().toISOString()
  };
}

export function appendIdentitySnapshot(userId = 'default', snapshot) {
  if (!snapshot) return;
  const list = identityStore.get(userId) || [];
  list.push(snapshot);
  while (list.length > 50) list.shift();
  identityStore.set(userId, list);
}

export function getRecentIdentitySnapshots(userId = 'default', n = 5) {
  const list = identityStore.get(userId) || [];
  return list.slice(-n);
}

export function getCurrentIdentity(userId = 'default') {
  const list = identityStore.get(userId) || [];
  return list[list.length - 1] || null;
}

export function getIdentityHistory(userId = 'default', n = 10) {
  return getRecentIdentitySnapshots(userId, n);
}
