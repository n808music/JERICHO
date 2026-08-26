import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// THE THIRD DESTRUCTION (2026-08-26) — a temporal dead zone, not a logic bug.
//
// PRE_SEED_LOCAL_SNAPSHOT calls readLocalUpdatedAt() during MODULE EVALUATION.
// readLocalUpdatedAt() reads IDENTITY_UPDATED_AT_KEY, which was declared with
// `const` ~2100 lines further down the file — still in its temporal dead zone at
// that moment. The read threw ReferenceError, readLocalUpdatedAt()'s own `catch`
// swallowed it, and `updatedAt` came back null on EVERY browser load regardless
// of what localStorage held.
//
// Downstream that silently disabled one branch of the mount pull:
//   localAt   = Date.parse(null)                     -> NaN
//   comparable = isFinite(serverAt) && isFinite(localAt) -> always false
//   if (comparable && serverAt > localAt) { adopt server }  -> unreachable
// leaving local-always-wins as the only outcome for any browser holding a
// non-empty blob, which is why the populated server row kept being overwritten.
//
// WHY THE EXISTING 10/10 SUITE PASSED: every test in
// identitySync.lastWriteWins.test.jsx calls __recapturePreSeedSnapshotForTests(),
// which re-reads AFTER module evaluation has finished — i.e. past the dead zone.
// The seam that made those tests possible is exactly the seam that hid this.
//
// So these tests must NOT use that seam. They seed storage first, then import
// the module fresh, which is the only shape that reproduces a real page load.
// ─────────────────────────────────────────────────────────────────────────────

const IDENTITY_MODULE = '../../src/state/identityStore.js';
const IDENTITY_KEY = 'jericho-identity';
const UPDATED_AT_KEY = 'jericho-identity-updated-at';
const STAMP = '2026-08-26T12:00:00.000Z';

// The store pushes on mount; keep the network out of a module-load test.
vi.mock('../../src/services/syncService.js', () => ({
  pushState: vi.fn(async () => ({ ok: true })),
  pullState: vi.fn(async () => null),
}));

// This environment does not supply localStorage. A no-op stub would prove
// nothing here — the module under test reads it during evaluation — so back it
// with a real map, matching identitySync.lastWriteWins.test.jsx.
function installMemoryStorage() {
  const map = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k) => (map.has(String(k)) ? map.get(String(k)) : null),
    setItem: (k, v) => { map.set(String(k), String(v)); },
    removeItem: (k) => { map.delete(String(k)); },
    clear: () => { map.clear(); },
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  });
}

beforeEach(() => {
  installMemoryStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('PRE_SEED_LOCAL_SNAPSHOT — captured on a real module load, no test seam', () => {
  it('reads the local stamp instead of swallowing a dead-zone ReferenceError', async () => {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify({ meta: { scenarioLabel: 'pre-existing' } }));
    localStorage.setItem(UPDATED_AT_KEY, STAMP);

    // Fresh evaluation with storage ALREADY populated — a page load, not a test.
    vi.resetModules();
    const fresh = await import(IDENTITY_MODULE);

    expect(fresh.PRE_SEED_LOCAL_SNAPSHOT.hasProfile).toBe(true);
    // Pre-fix this was null, which is what made the server-newer branch dead.
    expect(fresh.PRE_SEED_LOCAL_SNAPSHOT.updatedAt).toBe(STAMP);
  });

  it('yields a stamp the mount pull can actually compare (not NaN)', async () => {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify({ meta: {} }));
    localStorage.setItem(UPDATED_AT_KEY, STAMP);

    vi.resetModules();
    const fresh = await import(IDENTITY_MODULE);

    // This is the exact expression the pull handler evaluates. Asserting the
    // parse — not just non-null — is what ties this test to the failure mode:
    // the branch is gated on Number.isFinite(localAt).
    const localAt = Date.parse(fresh.PRE_SEED_LOCAL_SNAPSHOT.updatedAt || '');
    expect(Number.isFinite(localAt)).toBe(true);
    expect(localAt).toBe(Date.parse(STAMP));
  });

  it('still reports no stamp when storage genuinely has none', async () => {
    // Guard against "fixing" this by fabricating a timestamp: an unstamped
    // install must stay unstamped, because ambiguity is resolved toward local.
    localStorage.setItem(IDENTITY_KEY, JSON.stringify({ meta: {} }));

    vi.resetModules();
    const fresh = await import(IDENTITY_MODULE);

    expect(fresh.PRE_SEED_LOCAL_SNAPSHOT.hasProfile).toBe(true);
    expect(fresh.PRE_SEED_LOCAL_SNAPSHOT.updatedAt).toBeNull();
  });
});

describe('PRE_SEED_LOCAL_SNAPSHOT — declaration order invariant', () => {
  // A structural guard alongside the behavioural ones. Module caching and
  // transform order can mask a dead zone in a test runner; source order cannot.
  // Anything the snapshot touches at module scope must be declared above it.
  it('declares IDENTITY_UPDATED_AT_KEY above PRE_SEED_LOCAL_SNAPSHOT', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../src/state/identityStore.js'),
      'utf8'
    );
    const keyDecl = source.indexOf('const IDENTITY_UPDATED_AT_KEY');
    const snapshot = source.indexOf('export const PRE_SEED_LOCAL_SNAPSHOT');

    expect(keyDecl).toBeGreaterThan(-1);
    expect(snapshot).toBeGreaterThan(-1);
    expect(keyDecl).toBeLessThan(snapshot);
  });
});
