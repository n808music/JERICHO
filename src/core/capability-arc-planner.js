// Deterministic capability arc planner (stub).
export function planCapabilityArcs({ capabilities = [] }) {
  const arcs = capabilities.map((cap) => {
    const drift = cap.driftRatio ?? 0;
    let stage = 'stabilize';
    if (drift >= 0.8) stage = 'extend';
    else if (drift >= 0.4) stage = 'build';
    return {
      capabilityId: cap.id || `${cap.domain || 'domain'}.${cap.capability || 'cap'}`,
      stage,
      pressure: cap.pressureScore ?? 0,
      recommendedFocus: false
    };
  });
  const sorted = [...arcs].sort((a, b) => (b.pressure || 0) - (a.pressure || 0));
  sorted.slice(0, 2).forEach((item) => {
    const target = arcs.find((a) => a.capabilityId === item.capabilityId);
    if (target) target.recommendedFocus = true;
  });
  return arcs;
}
