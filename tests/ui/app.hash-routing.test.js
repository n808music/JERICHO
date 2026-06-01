
/**
 * Verify that the legacy App component delegates to Zion (AppShell) when hash routes are active.
 */

import { shouldRenderZionFromHash } from '../../src/ui/hashRouting.js';

describe('App hash routing', () => {
  it('returns true for an empty hash on the live root', () => {
    expect(shouldRenderZionFromHash('')).toBe(true);
  });

  it('returns true for #/structure (and variants)', () => {
    expect(shouldRenderZionFromHash('#/structure')).toBe(true);
    expect(shouldRenderZionFromHash('#/structure/')).toBe(true);
    expect(shouldRenderZionFromHash('#/structure?foo=bar')).toBe(true);
  });

  it('returns true for #/today', () => {
    expect(shouldRenderZionFromHash('#/today')).toBe(true);
  });

  it('returns true for #/stability', () => {
    expect(shouldRenderZionFromHash('#/stability')).toBe(true);
  });

  it('returns false for other hashes', () => {
    expect(shouldRenderZionFromHash('#/other')).toBe(false);
  });
});
