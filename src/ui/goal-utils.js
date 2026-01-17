// Build a definite goal text from capability/domain inputs so it passes
// the server-side definite goal validator (number + timeframe required).
export function buildDefiniteGoalFromCapability({ domain, capability, targetLevel }) {
  const safeDomain = (domain || 'execution').trim();
  const safeCap = (capability || 'capability').trim();
  const level = Number.isFinite(Number(targetLevel)) ? Number(targetLevel) : 3;
  // Includes a numeric level and a clear timeframe so the validator accepts it.
  return `Elevate ${safeDomain}.${safeCap} to level ${level} within 90 days`;
}
