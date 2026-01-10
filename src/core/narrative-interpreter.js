// Deterministic narrative interpreter (stub).
export function interpretIdentityNarrative({ goalText = '', identityHistory = [] }) {
  const recent = identityHistory.slice(-3);
  const slope = recent.length >= 2
    ? (recent[recent.length - 1]?.integrity?.score ?? 0) - (recent[0]?.integrity?.score ?? 0)
    : 0;
  const caps = recent[recent.length - 1]?.capabilities || [];
  const avgPressure = caps.length ? caps.reduce((a, c) => a + (c.pressureScore || 0), 0) / caps.length : 0;
  const identityIntent = goalText ? `You are steering toward: ${goalText}` : 'Define a concrete identity outcome to steer toward.';
  let frictionNarrative = 'Behavioral load is moderate.';
  if (slope < 0 && avgPressure > 0.5) frictionNarrative = 'Identity under strain; drift pressure is high.';
  else if (slope < 0) frictionNarrative = 'Integrity slipping; stabilize execution.';
  let breakthroughNarrative = 'Maintain current course to consolidate gains.';
  if (slope > 0 && avgPressure < 0.5) breakthroughNarrative = 'You are converging toward your stated identity.';
  else if (slope > 0 && avgPressure >= 0.5) breakthroughNarrative = 'Progress is emerging despite pressure; keep momentum with foundation tasks.';
  return { identityIntent, frictionNarrative, breakthroughNarrative };
}
