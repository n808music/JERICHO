
/**
 * Regression test: ensure /intake-dev is gated and does not become the default canonical surface.
 */

describe('route selector', () => {
  let resolveRootComponentKey, ENABLE_INTAKE_DEV;

  beforeAll(async () => {
    const mod = await import('../../src/ui/routeSelector.js');
    resolveRootComponentKey = mod.resolveRootComponentKey;
    ENABLE_INTAKE_DEV = mod.ENABLE_INTAKE_DEV;
  });

  it('defaults to App for /intake-dev when the gate is off', () => {
    expect(ENABLE_INTAKE_DEV).toBe(false);
    expect(resolveRootComponentKey({ pathname: '/intake-dev', enableIntakeDev: false })).toBe('App');
  });

  it('returns IntakeDev when the gate is explicitly enabled', () => {
    expect(resolveRootComponentKey({ pathname: '/intake-dev', enableIntakeDev: true })).toBe('IntakeDev');
  });
});
